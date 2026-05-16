/*
SQL to create required new tables (run these in Supabase SQL editor):

-- CREATE TABLE leads_log
CREATE TABLE IF NOT EXISTS leads_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pro_id uuid REFERENCES users(id) ON DELETE CASCADE,
  visitor_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  visitor_zone text,
  type text CHECK (type IN ('whatsapp','call','message')),
  blocked boolean DEFAULT false,
  month varchar(7) NOT NULL, -- format "YYYY-MM"
  created_at timestamp DEFAULT now()
);

-- CREATE TABLE visit_requests
CREATE TABLE IF NOT EXISTS visit_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pro_id uuid REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES users(id) ON DELETE SET NULL,
  client_name text,
  date date NOT NULL,
  slot text CHECK (slot IN ('mañana','tarde')) NOT NULL,
  description text,
  photo_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','proposed','cancelled')),
  proposed_date date,
  proposed_slot text,
  deposit_amount numeric DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_log_pro_month ON leads_log(pro_id, month);
CREATE INDEX IF NOT EXISTS idx_visit_requests_pro ON visit_requests(pro_id);
*/

import { useState, useEffect, useRef, useCallback } from "react";
import { db, STORAGE_URL } from "./supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { UserRow, MessageRow, JobRow, CertRow, Plan, PhotoRow } from "./supabase";

// ---------- Constants & Config ----------
const C = {
  bg: "#0A0A0F",
  surface: "#111118",
  card: "#16161F",
  cardHover: "#1C1C2A",
  border: "#1E1E30",
  accent: "#FFD700",
  orange: "#FF8C00",
  red: "#FF4455",
  green: "#00D68F",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  pink: "#EC4899",
  text: "#F0F0FA",
  muted: "#44445A",
  mutedL: "#7777AA",
};

const ZONAS = ["Sevilla", "Madrid", "Barcelona", "Valencia", "Málaga", "Bilbao"];
const OFICIOS = ["Electricista", "Fontanero", "Pintor", "Albañil", "Carpintero"];

const PLAN_COLORS: Record<Plan, string> = { gratis: "#7777AA", basico: "#3B82F6", pro: "#FFD700", elite: "#FF8C00" };
const PLAN_PRICES: Record<Plan, number> = { gratis: 0, basico: 9.99, pro: 24.99, elite: 49.99 };

const PLAN_GATES = {
  contacts: { gratis: 5, basico: 15, pro: 999, elite: 999 } as Record<Plan, number>,
  photos: { gratis: 0, basico: 5, pro: 20, elite: 999 } as Record<Plan, number>,
  ranking: { gratis: false, basico: false, pro: true, elite: true } as Record<Plan, boolean>,
  chat: { gratis: false, basico: true, pro: true, elite: true } as Record<Plan, boolean>,
  priority: { gratis: 0, basico: 1, pro: 2, elite: 3 } as Record<Plan, number>,
};

// ---------- Helpers ----------
function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

async function uploadImage(file: File, path: string): Promise<string | null> {
  // validate size and type
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Max 5MB");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Tipo no permitido");
  }
  const ext = file.name.split('.').pop();
  const fileName = `${path}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from("photos").upload(fileName, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  return STORAGE_URL + fileName;
}

async function hashPasswordSHA256(password: string): Promise<string> {
  // Using Web Crypto as we cannot add extra native deps; note: not bcrypt but better than plain text.
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const arr = Array.from(new Uint8Array(hash));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- UI Atoms ----------
function Spin() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 28, height: 28, border: "3px solid " + C.border, borderTop: "3px solid " + C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

function GCard({ children, style = {}, onClick, glow = "" }: any) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{ background: hov && onClick ? C.cardHover : C.card, borderRadius: 14, border: "1px solid " + C.border, padding: 18, transition: "all 0.2s", cursor: onClick ? "pointer" : "default", ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, outline, color = C.accent, disabled = false }: any) {
  const bg = color;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "10px 16px", background: outline ? "transparent" : "linear-gradient(135deg," + bg + "," + bg + "BB)", border: "1px solid " + bg + (outline ? "66" : "22"), borderRadius: 8, color: outline ? bg : "#000", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
}

function Inp({ label, value, onChange, type = "text", placeholder = "" }: any) {
  const s: any = { width: "100%", background: C.card, border: "1px solid " + C.border, borderRadius: 8, padding: "11px 14px", color: C.text, fontSize: 14, outline: "none" };
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", marginBottom: 5, fontWeight: 700 }}>{label}</p>}
      <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} style={s} />
    </div>
  );
}

// ---------- Leads logic ----------
async function getLeadsUsed(pro_id: string) {
  try {
    const m = monthKey();
    const { data: rows, error } = await db.from('leads_log').select('*').eq('pro_id', pro_id).eq('month', m).eq('blocked', false);
    if (error) throw error;
    return (rows || []).length;
  } catch (e) {
    console.error('getLeadsUsed', e);
    return 0;
  }
}

async function recordLead(params: { pro_id: string; visitor_id?: string | null; visitor_zone?: string; type: 'whatsapp' | 'call' | 'message'; blocked?: boolean; }) {
  const m = monthKey();
  try {
    const { data, error } = await db.from('leads_log').insert([{ pro_id: params.pro_id, visitor_id: params.visitor_id || null, visitor_zone: params.visitor_zone || null, type: params.type, blocked: !!params.blocked, month: m }]);
    if (error) throw error;
    return data?.[0] ?? null;
  } catch (e) {
    console.error('recordLead', e);
    return null;
  }
}

async function hasConversation(pro_id: string, visitor_id?: string | null) {
  if (!visitor_id) return false;
  try {
    const { data, error } = await db.from('messages').select('*').or(`and(from_id.eq.${visitor_id},to_id.eq.${pro_id}),and(from_id.eq.${pro_id},to_id.eq.${visitor_id})`).limit(1);
    if (error) throw error;
    return (data || []).length > 0;
  } catch (e) {
    console.error('hasConversation', e);
    return false;
  }
}

// ---------- WorkerSheet (profile) with contact buttons & visit request ----------
function WorkerSheet({ pro, visitor, onClose }: { pro: UserRow; visitor: UserRow | null; onClose: () => void; }) {
  const [showVisit, setShowVisit] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitSlot, setVisitSlot] = useState<'mañana' | 'tarde'>('mañana');
  const [visitDesc, setVisitDesc] = useState("");
  const [visitFile, setVisitFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const contact = async (type: 'whatsapp' | 'call' | 'message') => {
    try {
      // Check if conversation exists -> free
      const conv = await hasConversation(pro.id, visitor?.id);
      if (conv) {
        // open chat
        if (type === 'whatsapp') {
          window.open(`https://wa.me/${pro.whatsapp || ''}`);
        } else if (type === 'call') {
          window.open(`tel:${pro.phone || ''}`);
        } else {
          // open chat UI - here we just alert
          alert('Abrir chat con ' + pro.name);
        }
        return;
      }
      // check leads
      const used = await getLeadsUsed(pro.id);
      const limit = PLAN_GATES.contacts[pro.plan || 'gratis'];
      if (used >= limit) {
        // record blocked
        await recordLead({ pro_id: pro.id, visitor_id: visitor?.id || null, visitor_zone: visitor?.zone || null, type, blocked: true });
        alert('Este profesional ha agotado sus leads este mes. Tu intento ha sido registrado.');
        return;
      }
      // consume lead and proceed
      await recordLead({ pro_id: pro.id, visitor_id: visitor?.id || null, visitor_zone: visitor?.zone || null, type, blocked: false });
      if (type === 'whatsapp') window.open(`https://wa.me/${pro.whatsapp || ''}`);
      if (type === 'call') window.open(`tel:${pro.phone || ''}`);
      if (type === 'message') alert('Abrir chat con ' + pro.name);
    } catch (e: any) {
      console.error(e);
      alert('Error procesando contacto: ' + (e.message || e));
    }
  };

  const submitVisit = async () => {
    try {
      if (!visitDate || !visitDesc) { alert('Rellena fecha y descripción'); return; }
      setLoading(true);
      // check lead
      const used = await getLeadsUsed(pro.id);
      const limit = PLAN_GATES.contacts[pro.plan || 'gratis'];
      if (used >= limit) {
        await recordLead({ pro_id: pro.id, visitor_id: visitor?.id || null, visitor_zone: visitor?.zone || null, type: 'message', blocked: true });
        alert('Este profesional ha agotado sus leads este mes. Tu solicitud ha sido registrada como pendiente.');
        setLoading(false); setShowVisit(false); return;
      }
      // upload photo if any
      let url: string | null = null;
      if (visitFile) {
        url = await uploadImage(visitFile, `visits/${pro.id}`);
      }
      // insert visit request
      const { data, error } = await db.from('visit_requests').insert([{ pro_id: pro.id, client_id: visitor?.id || null, client_name: visitor?.name || 'Anon', date: visitDate, slot: visitSlot, description: visitDesc, photo_url: url }]).select().single();
      if (error || !data) throw error || new Error('No data');
      // consume lead
      await recordLead({ pro_id: pro.id, visitor_id: visitor?.id || null, visitor_zone: visitor?.zone || null, type: 'message', blocked: false });
      alert('Solicitud enviada. El profesional la verá en su panel.');
      setShowVisit(false);
    } catch (e: any) {
      console.error(e);
      alert('Error al enviar solicitud: ' + (e.message || e));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,12,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 680, background: C.card, borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ color: C.text }}>{pro.name}</h3>
            <div style={{ color: C.muted }}>{pro.trade} · {pro.zone}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => contact('message')}>💬 Mensaje</Btn>
            <Btn onClick={() => contact('whatsapp')}>📱 WhatsApp</Btn>
            <Btn onClick={() => setShowVisit(true)}>📅 Solicitar visita</Btn>
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          <p style={{ color: C.muted }}>{pro.bio}</p>
        </div>
        {showVisit && (
          <div style={{ marginTop: 12, background: C.surface, padding: 12, borderRadius: 10 }}>
            <h4 style={{ color: C.text, marginBottom: 8 }}>Solicitar visita</h4>
            <Inp label="Fecha" value={visitDate} onChange={setVisitDate} type="date" />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setVisitSlot('mañana')} style={{ padding: 8, borderRadius: 8, border: '1px solid ' + (visitSlot === 'mañana' ? C.accent : C.border), background: visitSlot === 'mañana' ? C.accent + '15' : 'transparent' }}>Mañana</button>
              <button onClick={() => setVisitSlot('tarde')} style={{ padding: 8, borderRadius: 8, border: '1px solid ' + (visitSlot === 'tarde' ? C.accent : C.border), background: visitSlot === 'tarde' ? C.accent + '15' : 'transparent' }}>Tarde</button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 11, color: C.muted }}>Descripción</p>
              <textarea value={visitDesc} onChange={(e: any) => setVisitDesc(e.target.value)} style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 8, background: C.card, border: '1px solid ' + C.border, color: C.text }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="file" accept="image/*" onChange={(e: any) => setVisitFile(e.target.files?.[0] || null)} />
              <div style={{ flex: 1 }} />
              <Btn onClick={submitVisit} disabled={loading}>{loading ? 'Enviando...' : 'Enviar solicitud'}</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- ProDashboard: leads widget & blocked list ----------
function ProDashboard({ user, onLogout }: { user: UserRow; onLogout: () => void; }) {
  const [used, setUsed] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const m = monthKey();
      const { data: usedRows, error: e1 } = await db.from('leads_log').select('*').eq('pro_id', user.id).eq('month', m).eq('blocked', false);
      if (e1) throw e1;
      setUsed((usedRows || []).length);
      const { data: blockedRows, error: e2 } = await db.from('leads_log').select('*').eq('pro_id', user.id).eq('month', m).eq('blocked', true);
      if (e2) throw e2;
      setBlocked(blockedRows || []);
    } catch (e) {
      console.error('fetchLeads', e);
      setUsed(0);
      setBlocked([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLeads(); }, []);

  const limit = PLAN_GATES.contacts[user.plan || 'gratis'];
  const pct = limit >= 999 ? 100 : Math.round(((used || 0) / limit) * 100);

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ color: C.text }}>Panel Profesional</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onLogout} color={C.red}>Salir</Btn>
        </div>
      </div>

      <GCard style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: C.muted }}>Leads este mes</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>{used ?? '—'} / {limit >= 999 ? 'Ilimitado' : limit}</div>
          </div>
          <div style={{ width: 220 }}>
            <div style={{ height: 12, borderRadius: 8, background: C.border, overflow: 'hidden' }}>
              <div style={{ width: `${limit >= 999 ? 100 : pct}%`, height: '100%', background: C.accent }} />
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{limit >= 999 ? 'Leads ilimitados' : `${pct}% usados`}</div>
          </div>
        </div>
      </GCard>

      <GCard>
        <h3 style={{ color: C.text, marginBottom: 8 }}>Interesados bloqueados</h3>
        {loading ? <Spin /> : (blocked.length === 0 ? <div style={{ color: C.muted }}>No hay interesados bloqueados</div> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {blocked.map((b: any) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderRadius: 8, background: C.surface }}>
                <div>
                  <div style={{ color: C.text }}>{b.visitor_zone || 'Anónimo'}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{new Date(b.created_at).toLocaleString()}</div>
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>Intentó contactar vía {b.type}</div>
              </div>
            ))}
          </div>
        ))}
      </GCard>

      <div style={{ marginTop: 12 }}>
        <Btn onClick={() => window.alert('Ir a planes...')}>Mejorar plan →</Btn>
      </div>
    </div>
  );
}

// ---------- Admin: moderate reviews ----------
function Admin({ onLogout }: { onLogout: () => void }) {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const { data, error } = await db.from('reviews').select('*').or('approved.is.null,approved.eq.false').limit(100);
      if (error) throw error;
      setPending(data || []);
    } catch (e) { console.error(e); setPending([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPending(); }, []);

  const approve = async (id: string) => {
    try {
      const { error } = await db.from('reviews').update({ approved: true }).eq('id', id);
      if (error) throw error;
      setPending(prev => prev.filter(p => p.id !== id));
    } catch (e) { console.error(e); alert('Error al aprobar'); }
  };
  const reject = async (id: string) => {
    try {
      const { error } = await db.from('reviews').update({ approved: false }).eq('id', id);
      if (error) throw error;
      setPending(prev => prev.filter(p => p.id !== id));
    } catch (e) { console.error(e); alert('Error al rechazar'); }
  };

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: C.text }}>Admin - Moderación de reseñas</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onLogout} color={C.red}>Salir</Btn>
        </div>
      </div>
      <GCard style={{ marginTop: 12 }}>
        <h4 style={{ color: C.text }}>Reseñas pendientes ({pending.length})</h4>
        {loading ? <Spin /> : (pending.length === 0 ? <div style={{ color: C.muted }}>No hay reseñas pendientes</div> : (
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {pending.map(r => (
              <div key={r.id} style={{ background: C.surface, padding: 10, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div><strong style={{ color: C.text }}>{r.client_name}</strong> · <span style={{ color: C.muted }}>{r.stars}★</span></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => approve(r.id)}>✓ Aprobar</Btn>
                    <Btn outline onClick={() => reject(r.id)}>✗ Rechazar</Btn>
                  </div>
                </div>
                <div style={{ color: C.muted }}>{r.text}</div>
                {r.photo_url && <img src={r.photo_url} style={{ width: 120, marginTop: 8, borderRadius: 8 }} />}
              </div>
            ))}
          </div>
        ))}
      </GCard>
    </div>
  );
}

// ---------- Simple Worker list and App main ----------
function WorkerCard({ w, onClick }: { w: UserRow; onClick: (w: UserRow) => void }) {
  return (
    <div onClick={() => onClick(w)} style={{ padding: 12, borderRadius: 10, border: '1px solid ' + C.border, background: C.card, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: C.text, fontWeight: 800 }}>{w.name}</div>
          <div style={{ color: C.muted }}>{w.trade} · {w.zone}</div>
        </div>
        <div style={{ color: C.muted }}>{w.rating || 0}★</div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<UserRow | null>(null);
  const [ready, setReady] = useState(false);
  const [workers, setWorkers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);

  useEffect(() => {
    const s = localStorage.getItem('oy_user');
    if (s) {
      try { setUser(JSON.parse(s)); } catch { localStorage.removeItem('oy_user'); }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await db.from('users').select('*').in('type', ['profesional']).limit(50);
        if (!error && data) setWorkers(data as UserRow[]);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const login = (u: UserRow) => { setUser(u); localStorage.setItem('oy_user', JSON.stringify(u)); };
  const logout = () => { setUser(null); localStorage.removeItem('oy_user'); };

  if (!ready) return <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>;

  if (!user) return <Auth onLogin={login} />;
  if (user.type === 'admin') return <Admin onLogout={logout} />;
  if (user.type === 'profesional') return <ProDashboard user={user} onLogout={logout} />;

  // cliente view
  return (
    <div style={{ minHeight: '100dvh', background: C.bg, padding: 16 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ color: C.text }}>Buscar profesionales</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={logout} color={C.red}>Cerrar sesión</Btn>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {workers.map(w => <WorkerCard key={w.id} w={w} onClick={setSelected} />)}
      </div>
      {selected && <WorkerSheet pro={selected} visitor={user} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ---------- Auth component (with client-side SHA256 hashing) ----------
function Auth({ onLogin }: { onLogin: (u: UserRow) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'cliente' | 'profesional'>('cliente');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const doLogin = async () => {
    if (!email || !pass) { setErr('Introduce email y contraseña'); return; }
    setLoading(true); setErr('');
    try {
      const hashed = await hashPasswordSHA256(pass);
      // Attempt to find by hashed password or plain (for legacy users)
      const { data, error } = await db.from('users').select('*').or(`and(email.eq.${email},password.eq.${hashed}),and(email.eq.${email},password.eq.${pass})`).single();
      if (error || !data) { setErr('Usuario o contraseña incorrectos'); setLoading(false); return; }
      onLogin(data as UserRow);
      localStorage.setItem('oy_user', JSON.stringify(data));
    } catch (e: any) { console.error(e); setErr('Error al iniciar sesión'); }
    finally { setLoading(false); }
  };

  const doRegister = async () => {
    if (!email || !pass || !name) { setErr('Rellena todos los campos'); return; }
    setLoading(true); setErr('');
    try {
      const hashed = await hashPasswordSHA256(pass);
      const trial_end = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const { data, error } = await db.from('users').insert([{ name, email: email.toLowerCase(), password: hashed, phone: '', type, plan: 'gratis', bio: '', price: 30, available: true, verified: false, jobs: 0, rating: 0, reviews: 0, trial_end }]).select().single();
      if (error) throw error;
      onLogin(data as UserRow);
      localStorage.setItem('oy_user', JSON.stringify(data));
    } catch (e: any) { console.error(e); setErr('Error al crear cuenta'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <h1 style={{ color: C.text }}>Oficio<span style={{ color: C.accent }}>Ya</span></h1>
        </div>
        <GCard>
          {err && <div style={{ color: C.red, marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button onClick={() => setMode('login')} style={{ flex: 1, padding: 8, borderRadius: 8, background: mode === 'login' ? C.accent : 'transparent', border: 'none', fontWeight: 800 }}>{'Entrar'}</button>
            <button onClick={() => setMode('register')} style={{ flex: 1, padding: 8, borderRadius: 8, background: mode === 'register' ? C.accent : 'transparent', border: 'none', fontWeight: 800 }}>{'Crear cuenta'}</button>
          </div>
          {mode === 'register' && <Inp label="Nombre" value={name} onChange={setName} />}
          <Inp label="Email" value={email} onChange={setEmail} type="email" />
          <Inp label="Contraseña" value={pass} onChange={setPass} type="password" />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={mode === 'login' ? doLogin : doRegister} disabled={loading}>{loading ? '...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</Btn>
          </div>
        </GCard>
      </div>
    </div>
  );
}
