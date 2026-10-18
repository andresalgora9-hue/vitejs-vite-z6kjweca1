// ============================================================
// OficioYa · Panel PROFESIONAL — pestaña LEADS (pago por lead)
// Sustituye a ProTrabajos. Lee y edita la tabla pro_leads.
// Archivo independiente: no toca Perfil ni Mensajes.
// ============================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { db } from "../supabase";

const C = {
  bg: "#0F1117", surface: "#161B27", card: "#1E2536", border: "#2D3A52",
  accent: "#FFD700", orange: "#FF8C00", red: "#FF4455", green: "#00D68F",
  blue: "#3B82F6", text: "#E8EDF5", muted: "#5A6A8A", mutedL: "#8899BB",
};
const F = "'DM Sans',sans-serif";
const TZ = "Europe/Madrid";
const UMBRAL_FACTURA = 820;

// ── TIPOS Y LISTAS ──────────────────────────────────────────
type Estado = "nuevo" | "contactado" | "presupuesto" | "ganado" | "perdido";
type Canal = "formulario" | "whatsapp" | "llamada";

interface Lead {
  id: string;
  created_at: string;
  pro_id: string;
  trade: string;
  canal: Canal;
  estado: Estado;
  estado_at: string;
  motivo_perdido: string | null;
  presupuesto_eur: number | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  zona: string | null;
  direccion: string | null;
  descripcion: string | null;
  notas: string | null;
  price: number;
  anulado: boolean;
  anulado_motivo: string | null;
  llamada_at: string | null;
  llamada_segundos: number | null;
  invoice_id: string | null;
}

const ESTADOS: { id: Estado; label: string; corto: string; color: string }[] = [
  { id: "nuevo", label: "Nuevo", corto: "Nuevos", color: C.accent },
  { id: "contactado", label: "Contactado", corto: "Contactados", color: C.blue },
  { id: "presupuesto", label: "Presupuesto enviado", corto: "Presupuesto", color: C.orange },
  { id: "ganado", label: "Ganado", corto: "Ganados", color: C.green },
  { id: "perdido", label: "Perdido", corto: "Perdidos", color: C.red },
];
const ESTADO: Record<Estado, { label: string; color: string }> = ESTADOS.reduce(
  (acc, e) => ({ ...acc, [e.id]: e }), {} as any,
);

const CANAL_LABEL: Record<Canal, string> = {
  formulario: "Formulario",
  whatsapp: "WhatsApp",
  llamada: "Llamada",
};

const MOTIVOS_PERDIDO = [
  { id: "no_contesta", label: "No contesta" },
  { id: "caro", label: "Le pareció caro" },
  { id: "otro_profesional", label: "Eligió a otro profesional" },
  { id: "ya_no_lo_necesita", label: "Ya no lo necesita" },
  { id: "fuera_de_zona", label: "Está fuera de mi zona" },
  { id: "no_puedo_atenderlo", label: "No puedo atenderlo" },
  { id: "otros", label: "Otros" },
];

// ── UTILIDADES ──────────────────────────────────────────────
const mesDe = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date(iso));

const mesLabel = (clave: string) => {
  const [y, m] = clave.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const mesMover = (clave: string, delta: number) => {
  const [y, m] = clave.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const eur = (n: number) =>
  (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";

const duracion = (s: number | null) => {
  if (s == null) return "";
  const min = Math.floor(s / 60);
  return (min > 0 ? min + " min " : "") + (s % 60) + " s";
};

const digitos = (t: string | null) => (t || "").replace(/[^0-9]/g, "");
const enlaceWhatsApp = (tel: string | null) => {
  let d = digitos(tel);
  if (d.length === 9) d = "34" + d;
  return "https://wa.me/" + d;
};
const enlaceTel = (tel: string | null) => "tel:" + (tel || "").replace(/[^0-9+]/g, "");

const faltanDatos = (l: Lead) => !l.client_name || !digitos(l.client_phone);

// ── PIEZAS DE INTERFAZ ──────────────────────────────────────
function Card({ children, style = {}, accent }: any) {
  return (
    <div style={{
      background: C.card, border: "1px solid " + (accent || C.border),
      borderRadius: 12, padding: 14, marginBottom: 10, ...style,
    }}>{children}</div>
  );
}

function Boton({ children, onClick, color = C.accent, outline = false, disabled = false, href }: any) {
  const estilo: React.CSSProperties = {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "11px 12px", borderRadius: 9, textDecoration: "none",
    background: disabled ? C.border : outline ? "transparent" : color,
    border: outline ? "1px solid " + (disabled ? C.border : color) : "none",
    color: disabled ? C.muted : outline ? color : (color === C.accent || color === C.green ? "#000" : "#fff"),
    fontFamily: F, fontSize: 13, fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
  };
  if (href && !disabled) {
    return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" style={estilo}>{children}</a>;
  }
  return <button onClick={disabled ? undefined : onClick} disabled={disabled} style={estilo}>{children}</button>;
}

function Etiqueta({ texto, color }: { texto: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 5,
      background: color + "1F", color, whiteSpace: "nowrap",
    }}>{texto}</span>
  );
}

function Campo({ label, value, onChange, type = "text", placeholder = "", multilinea = false, inputMode }: any) {
  const base: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "11px 12px", background: C.bg,
    border: "1px solid " + C.border, borderRadius: 9, color: C.text, fontSize: 15,
    fontFamily: F, outline: "none",
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 6, fontWeight: 600 }}>{label}</label>
      {multilinea
        ? <textarea value={value} placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} style={{ ...base, resize: "vertical" }} />
        : <input type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={base} />}
    </div>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 30000,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 520,
        maxHeight: "92vh", overflowY: "auto", padding: 20, boxSizing: "border-box",
        paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
        border: "1px solid " + C.border,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
          <h3 style={{ color: C.text, fontSize: 17, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", color: C.muted, fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: any) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.mutedL, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>{titulo}</div>
      {children}
    </div>
  );
}

// ── FICHA DEL LEAD ──────────────────────────────────────────
function FichaLead({ lead, userId, onClose, onGuardado }: { lead: Lead; userId: string; onClose: () => void; onGuardado: (msg: string) => void }) {
  const [estado, setEstado] = useState<Estado>(lead.estado);
  const [motivo, setMotivo] = useState(lead.motivo_perdido || "");
  const [presupuesto, setPresupuesto] = useState(lead.presupuesto_eur != null ? String(lead.presupuesto_eur).replace(".", ",") : "");
  const [nombre, setNombre] = useState(lead.client_name || "");
  const [telefono, setTelefono] = useState(lead.client_phone || "");
  const [email, setEmail] = useState(lead.client_email || "");
  const [zona, setZona] = useState(lead.zona || "");
  const [direccion, setDireccion] = useState(lead.direccion || "");
  const [descripcion, setDescripcion] = useState(lead.descripcion || "");
  const [notas, setNotas] = useState(lead.notas || "");
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState("");

  const guardar = async () => {
    if (estado === "perdido" && !motivo) { setErr("Elige por qué se ha perdido."); return; }
    const importe = presupuesto.trim() === "" ? null : Number(presupuesto.replace(/\./g, "").replace(",", "."));
    if (importe != null && (isNaN(importe) || importe < 0)) { setErr("El importe del presupuesto no es válido."); return; }
    setGuardando(true); setErr("");
    const { error } = await db.from("pro_leads").update({
      estado,
      motivo_perdido: estado === "perdido" ? motivo : null,
      presupuesto_eur: importe,
      client_name: nombre.trim() || null,
      client_phone: telefono.trim() || null,
      client_email: email.trim() || null,
      zona: zona.trim() || null,
      direccion: direccion.trim() || null,
      descripcion: descripcion.trim() || null,
      notas: notas.trim() || null,
    }).eq("id", lead.id).eq("pro_id", userId);
    setGuardando(false);
    if (error) { setErr("No se ha podido guardar. Inténtalo de nuevo."); return; }
    onGuardado("Lead guardado");
  };

  const tel = telefono.trim();
  const pidePresupuesto = estado === "presupuesto" || estado === "ganado";

  return (
    <Modal title={nombre.trim() || (lead.canal === "llamada" ? "Llamada recibida" : "Lead sin nombre")} onClose={onClose}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 }}>
        <Etiqueta texto={CANAL_LABEL[lead.canal]} color={C.mutedL} />
        <span style={{ fontSize: 12, color: C.mutedL }}>{fechaHora(lead.created_at)}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.mutedL }}>
          Coste: <b style={{ color: lead.anulado ? C.muted : C.text, textDecoration: lead.anulado ? "line-through" : "none" }}>{eur(lead.price)}</b>
        </span>
      </div>

      {lead.anulado && (
        <Card accent={C.green} style={{ background: C.green + "12" }}>
          <div style={{ fontSize: 13, color: C.green, fontWeight: 800 }}>Lead anulado: no se cobra</div>
          {lead.anulado_motivo && <div style={{ fontSize: 12, color: C.mutedL, marginTop: 4 }}>{lead.anulado_motivo}</div>}
        </Card>
      )}

      {lead.canal === "llamada" && (
        <Card>
          <div style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>
            Llamada del {lead.llamada_at ? fechaHora(lead.llamada_at) : fechaHora(lead.created_at)}
            {lead.llamada_segundos != null && <span style={{ color: C.mutedL, fontWeight: 600 }}> · {duracion(lead.llamada_segundos)}</span>}
          </div>
          {faltanDatos(lead) && (
            <div style={{ fontSize: 12, color: C.orange, marginTop: 6 }}>Rellena el nombre y el teléfono del cliente para tenerlo localizado.</div>
          )}
        </Card>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <Boton href={tel ? enlaceTel(tel) : undefined} disabled={!tel} color={C.green}>Llamar</Boton>
        <Boton href={tel ? enlaceWhatsApp(tel) : undefined} disabled={!tel} color={C.green} outline>WhatsApp</Boton>
      </div>

      <Seccion titulo="Estado">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {ESTADOS.map((e) => {
            const act = estado === e.id;
            return (
              <button key={e.id} onClick={() => { setEstado(e.id); setErr(""); }} style={{
                padding: "9px 12px", borderRadius: 9, cursor: "pointer", fontFamily: F,
                fontSize: 13, fontWeight: 700,
                background: act ? e.color + "22" : "transparent",
                border: "1px solid " + (act ? e.color : C.border),
                color: act ? e.color : C.mutedL,
              }}>{e.label}</button>
            );
          })}
        </div>

        {pidePresupuesto && (
          <div style={{ marginTop: 12 }}>
            <Campo label={estado === "ganado" ? "Importe del trabajo (€)" : "Importe del presupuesto (€)"} value={presupuesto}
              onChange={setPresupuesto} inputMode="decimal" placeholder="Ej. 850" />
          </div>
        )}

        {estado === "perdido" && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
            {MOTIVOS_PERDIDO.map((m) => {
              const act = motivo === m.id;
              return (
                <button key={m.id} onClick={() => { setMotivo(m.id); setErr(""); }} style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  padding: "10px 12px", borderRadius: 9, cursor: "pointer", fontFamily: F,
                  background: act ? C.red + "14" : "transparent",
                  border: "1px solid " + (act ? C.red : C.border),
                  color: act ? C.text : C.mutedL, fontSize: 13, fontWeight: 600,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                    border: "2px solid " + (act ? C.red : C.muted), background: act ? C.red : "transparent",
                  }} />
                  {m.label}
                </button>
              );
            })}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Datos del cliente">
        <Campo label="Nombre" value={nombre} onChange={setNombre} placeholder="Nombre del cliente" />
        <Campo label="Teléfono" value={telefono} onChange={setTelefono} type="tel" inputMode="tel" placeholder="600 000 000" />
        <Campo label="Email" value={email} onChange={setEmail} type="email" placeholder="Opcional" />
        <Campo label="Zona o barrio" value={zona} onChange={setZona} placeholder="Ej. Triana" />
        <Campo label="Dirección" value={direccion} onChange={setDireccion} placeholder="Opcional" />
        <Campo label="Qué necesita" value={descripcion} onChange={setDescripcion} multilinea placeholder="Ej. Pintar piso de 3 habitaciones" />
      </Seccion>

      <Seccion titulo="Notas">
        <Campo label="Solo las ves tú" value={notas} onChange={setNotas} multilinea placeholder="Ej. Visita el jueves a las 10:00" />
      </Seccion>

      {err && <div style={{ color: C.red, fontSize: 13, fontWeight: 700, marginTop: 4, marginBottom: 10 }}>{err}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Boton onClick={onClose} color={C.mutedL} outline>Cancelar</Boton>
        <Boton onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</Boton>
      </div>
    </Modal>
  );
}

// ── COMPONENTE PRINCIPAL ────────────────────────────────────
export default function ProLeads({ user, onToast }: { user: { id: string; name: string }; onToast?: (m: string) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const mesActual = mesDe(new Date().toISOString());
  const [mes, setMes] = useState(mesActual);
  const [filtro, setFiltro] = useState<Estado | "todos">("todos");
  const [abierto, setAbierto] = useState<Lead | null>(null);

  const toastRef = useRef(onToast);
  useEffect(() => { toastRef.current = onToast; }, [onToast]);

  const cargar = useCallback(async () => {
    const { data, error: e } = await db
      .from("pro_leads")
      .select("*")
      .eq("pro_id", user.id)
      .order("created_at", { ascending: false });
    if (e) setError("No se han podido cargar tus leads. Desliza para recargar o vuelve a entrar.");
    else { setLeads((data || []) as Lead[]); setError(""); }
    setCargando(false);
  }, [user.id]);

  useEffect(() => { cargar(); }, [cargar]);

  // Leads nuevos en directo + recarga al volver a la app
  useEffect(() => {
    const canal = db
      .channel("pro_leads_" + user.id)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "pro_leads", filter: "pro_id=eq." + user.id }, (p: any) => {
        if (p?.eventType === "INSERT") toastRef.current?.("Te ha entrado un lead nuevo");
        cargar();
      })
      .subscribe();
    const alVolver = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      db.removeChannel(canal);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [user.id, cargar]);

  const primerMes = leads.length ? mesDe(leads[leads.length - 1].created_at) : mesActual;
  const delMes = useMemo(() => leads.filter((l) => mesDe(l.created_at) === mes), [leads, mes]);
  const validos = delMes.filter((l) => !l.anulado);
  const gastoMes = validos.reduce((s, l) => s + Number(l.price || 0), 0);
  const cuenta = (e: Estado) => validos.filter((l) => l.estado === e).length;
  const ganados = validos.filter((l) => l.estado === "ganado");
  const importeGanado = ganados.reduce((s, l) => s + Number(l.presupuesto_eur || 0), 0);
  const pendiente = leads.filter((l) => !l.anulado && !l.invoice_id).reduce((s, l) => s + Number(l.price || 0), 0);
  const precioLead = leads.find((l) => !l.anulado)?.price;

  const lista = useMemo(() => {
    const base = filtro === "todos" ? delMes : delMes.filter((l) => l.estado === filtro && !l.anulado);
    // Los nuevos arriba; el resto por fecha
    return [...base].sort((a, b) => {
      const an = a.estado === "nuevo" && !a.anulado ? 0 : 1;
      const bn = b.estado === "nuevo" && !b.anulado ? 0 : 1;
      if (an !== bn) return an - bn;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [delMes, filtro]);

  const pct = Math.min(100, Math.round((pendiente / UMBRAL_FACTURA) * 100));

  if (cargando) {
    return <div style={{ padding: "40px 0", textAlign: "center", color: C.mutedL, fontFamily: F, fontSize: 14 }}>Cargando tus leads...</div>;
  }

  return (
    <div style={{ fontFamily: F, paddingBottom: 24 }}>
      {/* Cabecera */}
      <div style={{ padding: "22px 0 14px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: C.text, margin: 0 }}>Mis leads</h2>
        <div style={{ fontSize: 13, color: C.mutedL, marginTop: 4 }}>
          Clientes que te enviamos{precioLead ? " · " + eur(precioLead) + " por lead" : ""}
        </div>
      </div>

      {error && <Card accent={C.red}><div style={{ color: C.red, fontSize: 13, fontWeight: 700 }}>{error}</div></Card>}

      {/* Selector de mes */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => { setMes(mesMover(mes, -1)); setFiltro("todos"); }} disabled={mes <= primerMes}
          aria-label="Mes anterior" style={{
            width: 40, height: 40, borderRadius: 10, border: "1px solid " + C.border, background: C.card,
            color: mes <= primerMes ? C.muted : C.text, fontSize: 18, cursor: mes <= primerMes ? "default" : "pointer",
          }}>‹</button>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>{mesLabel(mes)}</div>
        <button onClick={() => { setMes(mesMover(mes, 1)); setFiltro("todos"); }} disabled={mes >= mesActual}
          aria-label="Mes siguiente" style={{
            width: 40, height: 40, borderRadius: 10, border: "1px solid " + C.border, background: C.card,
            color: mes >= mesActual ? C.muted : C.text, fontSize: 18, cursor: mes >= mesActual ? "default" : "pointer",
          }}>›</button>
      </div>

      {/* Resumen del mes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 12, color: C.mutedL, fontWeight: 600 }}>Leads del mes</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text, marginTop: 2 }}>{validos.length}</div>
          <div style={{ fontSize: 12, color: C.mutedL }}>Gasto: <b style={{ color: C.text }}>{eur(gastoMes)}</b></div>
        </Card>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 12, color: C.mutedL, fontWeight: 600 }}>Ganados</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.green, marginTop: 2 }}>
            {ganados.length}
            <span style={{ fontSize: 13, color: C.mutedL, fontWeight: 700 }}>{validos.length ? " · " + Math.round((ganados.length / validos.length) * 100) + "%" : ""}</span>
          </div>
          <div style={{ fontSize: 12, color: C.mutedL }}>Trabajos: <b style={{ color: C.text }}>{eur(importeGanado)}</b></div>
        </Card>
      </div>

      {/* Factura */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 13, color: C.text, fontWeight: 800 }}>Pendiente de facturar</div>
          <div style={{ fontSize: 13, color: C.mutedL }}><b style={{ color: C.text, fontSize: 15 }}>{eur(pendiente)}</b> de {eur(UMBRAL_FACTURA)}</div>
        </div>
        <div style={{ height: 8, background: C.bg, borderRadius: 99, marginTop: 10, overflow: "hidden" }}>
          <div style={{ width: pct + "%", height: "100%", background: pct >= 100 ? C.orange : C.accent, borderRadius: 99, transition: "width .3s" }} />
        </div>
        <div style={{ fontSize: 12, color: C.mutedL, marginTop: 8 }}>
          Se factura al llegar a {eur(UMBRAL_FACTURA)} o a final de mes, lo que ocurra antes.
        </div>
      </Card>

      {/* Filtro por estado */}
      <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "4px 0 10px", WebkitOverflowScrolling: "touch" as any }}>
        {[{ id: "todos" as const, corto: "Todos", color: C.text, n: delMes.length }, ...ESTADOS.map((e) => ({ ...e, n: cuenta(e.id) }))].map((e) => {
          const act = filtro === e.id;
          return (
            <button key={e.id} onClick={() => setFiltro(e.id)} style={{
              flexShrink: 0, padding: "8px 12px", borderRadius: 99, cursor: "pointer", fontFamily: F,
              fontSize: 12.5, fontWeight: 700,
              background: act ? e.color + "22" : C.card,
              border: "1px solid " + (act ? e.color : C.border),
              color: act ? e.color : C.mutedL,
            }}>{e.corto} <span style={{ opacity: 0.8 }}>{e.n}</span></button>
          );
        })}
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "26px 16px" }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
            {filtro === "todos" ? "No hay leads en " + mesLabel(mes).toLowerCase() : "No hay leads en este estado"}
          </div>
          {filtro === "todos" && mes === mesActual && (
            <div style={{ color: C.mutedL, fontSize: 13, marginTop: 6 }}>Cuando te entre uno, aparecerá aquí al momento.</div>
          )}
        </Card>
      ) : lista.map((l) => {
        const est = ESTADO[l.estado];
        const esNuevo = l.estado === "nuevo" && !l.anulado;
        const titulo = l.client_name || (l.canal === "llamada" ? "Llamada · faltan datos" : "Sin nombre");
        const detalle = [l.zona, l.descripcion].filter(Boolean).join(" · ");
        return (
          <button key={l.id} onClick={() => setAbierto(l)} style={{
            display: "block", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: F,
            background: C.card, border: "1px solid " + (esNuevo ? C.accent : C.border),
            borderRadius: 12, padding: 14, marginBottom: 10, opacity: l.anulado ? 0.6 : 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Etiqueta texto={CANAL_LABEL[l.canal]} color={C.mutedL} />
              <span style={{ fontSize: 12, color: C.mutedL }}>{fechaHora(l.created_at)}</span>
              <span style={{ marginLeft: "auto" }}>
                {l.anulado ? <Etiqueta texto="Anulado" color={C.muted} /> : <Etiqueta texto={est.label} color={est.color} />}
              </span>
            </div>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{titulo}</div>
            {detalle && (
              <div style={{
                color: C.mutedL, fontSize: 13, marginTop: 3, overflow: "hidden",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
              }}>{detalle}</div>
            )}
            <div style={{ display: "flex", alignItems: "center", marginTop: 8, gap: 8 }}>
              {faltanDatos(l) && !l.anulado && <span style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>Completa los datos</span>}
              <span style={{
                marginLeft: "auto", fontSize: 13, fontWeight: 800,
                color: l.anulado ? C.muted : C.text, textDecoration: l.anulado ? "line-through" : "none",
              }}>{eur(l.price)}</span>
            </div>
          </button>
        );
      })}

      {abierto && (
        <FichaLead
          lead={abierto}
          userId={user.id}
          onClose={() => setAbierto(null)}
          onGuardado={(msg) => { setAbierto(null); onToast?.(msg); cargar(); }}
        />
      )}
    </div>
  );
}
