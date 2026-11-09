import { createClient, type Session } from '@supabase/supabase-js';

const SUPABASE_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE";

// ============================================================
// Sesión segura (seguridad, 09/11/2026)
// La app sigue guardando el usuario en localStorage.oy_user como siempre, pero ahora cada
// petición a la base de datos lleva además una sesión de Supabase Auth de ESE usuario
// (la crea el servidor: auth-handler al entrar o registrarse, u oy-sesion para quien ya tenía
// la sesión abierta). Las políticas de la base usan esa sesión para saber quién pide qué.
// - Al entrar, auth-handler devuelve user.oy_ses: se guarda aparte (nunca llega al resto de la app).
// - Si oy_user cambia de cuenta, se cambia la sesión. Sin oy_user, las peticiones van anónimas.
// - Si no hay forma de conseguir sesión (cuenta borrada, datos que no cuadran…), se avisa con el
//   evento "oy-sesion-perdida" para que la app pida volver a entrar.
// ============================================================
type SesionServidor = { access_token: string; refresh_token: string; expires_at?: number; n?: string };
type UsuarioLocal = { id: string; email?: string; type?: string; created_at?: string; joined_at?: string };

const K_USUARIO = "oy_user";
const K_PEND = "oy_ses_pend";
const K_USADAS = "oy_ses_usadas";
const K_META = "oy_ses_meta";
const K_FALLO = "oy_ses_fallo";
const FUNCIONES = SUPABASE_URL + "/functions/v1/";
const fetchOriginal: typeof fetch = typeof window !== "undefined" && window.fetch ? window.fetch.bind(window) : fetch;

function lsLeer<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } }
function lsPoner(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* nada */ } }
function lsQuitar(k: string) { try { localStorage.removeItem(k); } catch { /* nada */ } }

const usada = (n?: string) => !!n && (lsLeer<string[]>(K_USADAS) || []).includes(n);
function marcarUsada(n?: string) {
  if (!n) return;
  const l = (lsLeer<string[]>(K_USADAS) || []).filter((x) => x !== n);
  l.push(n);
  lsPoner(K_USADAS, l.slice(-20));
}
function guardarPendiente(id: unknown, s: any) {
  if (typeof id !== "string" || !id || !s || !s.access_token || !s.refresh_token || usada(s.n)) return;
  lsPoner(K_PEND, { id, s, t: Date.now() });
}
function leerPendiente(): { id: string; s: SesionServidor; t: number } | null {
  const p = lsLeer<{ id: string; s: SesionServidor; t: number }>(K_PEND);
  if (!p || !p.id || !p.s) return null;
  if (Date.now() - (p.t || 0) > 10 * 60 * 1000 || usada(p.s.n)) { lsQuitar(K_PEND); return null; }
  return p;
}
// Las páginas sueltas (registro, nueva contraseña…) guardan el usuario tal cual llega, con la sesión dentro
function sacarSesionDeUsuario() {
  try {
    const raw = localStorage.getItem(K_USUARIO);
    if (!raw || raw.indexOf("oy_ses") < 0) return;
    const u = JSON.parse(raw);
    if (u && typeof u === "object" && u.oy_ses) {
      guardarPendiente(u.id, u.oy_ses);
      delete u.oy_ses;
      localStorage.setItem(K_USUARIO, JSON.stringify(u));
    }
  } catch { /* nada */ }
}
sacarSesionDeUsuario();

// Las respuestas de auth-handler llegan al resto de la app sin la sesión (se guarda aparte)
// Los avisos (push, emails, avisos al admin) van con la sesión del usuario para que el servidor sepa quién los pide
const FUNCIONES_CON_SESION = /\/functions\/v1\/(send-push|notify-admin|clever-api|send-delete-email)(\?|$)/;
if (typeof window !== "undefined" && !(window as any).__oySesionFetch) {
  (window as any).__oySesionFetch = true;
  const anterior = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const u0 = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (u0.indexOf(SUPABASE_URL) === 0 && FUNCIONES_CON_SESION.test(u0)) {
        const token = await asegurarSesion();
        if (token) {
          const h = new Headers(init && init.headers ? init.headers : input instanceof Request ? input.headers : undefined);
          h.set("Authorization", "Bearer " + token);
          init = { ...(init || {}), headers: h };
        }
      }
    } catch { /* sigue sin sesión */ }
    const r = await anterior(input, init);
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.indexOf("/functions/v1/auth-handler") < 0) return r;
      const texto = await r.clone().text();
      if (texto.indexOf("oy_ses") < 0) return r;
      const j = JSON.parse(texto);
      if (!j || !j.user || !j.user.oy_ses) return r;
      guardarPendiente(j.user.id, j.user.oy_ses);
      delete j.user.oy_ses;
      const h = new Headers(r.headers);
      h.delete("content-length");
      h.delete("content-encoding");
      return new Response(JSON.stringify(j), { status: r.status, statusText: r.statusText, headers: h });
    } catch { return r; }
  };
}

function usuarioLocal(): UsuarioLocal | null {
  const u = lsLeer<any>(K_USUARIO);
  return u && typeof u === "object" && typeof u.id === "string" && u.id ? (u as UsuarioLocal) : null;
}
function uidDe(s: Session | null | undefined): string | null {
  const am: any = s && s.user ? s.user.app_metadata : null;
  return am && typeof am.oy_uid === "string" ? am.oy_uid : null;
}
async function sesionGuardada(): Promise<Session | null> {
  try { const { data } = await db.auth.getSession(); return data.session || null; } catch { return null; }
}
async function cerrarLocal() {
  lsQuitar(K_META);
  try { await db.auth.signOut({ scope: "local" }); } catch { /* nada */ }
}
async function aplicar(id: string, s: SesionServidor | null | undefined): Promise<Session | null> {
  if (!s || !s.access_token || !s.refresh_token || usada(s.n)) return null;
  marcarUsada(s.n);
  try {
    const { data, error } = await db.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
    if (error || !data.session) return null;
    if (uidDe(data.session) !== id) { await cerrarLocal(); return null; }
    lsPoner(K_META, { id, t: Date.now() });
    lsQuitar(K_FALLO);
    return data.session;
  } catch { return null; }
}
function enEspera(id: string) {
  const f = lsLeer<{ id: string; hasta: number }>(K_FALLO);
  return !!f && f.id === id && Date.now() < f.hasta;
}
function marcarFallo(id: string, status: number) {
  const definitivo = status === 401 || status === 403;
  lsPoner(K_FALLO, { id, hasta: Date.now() + (definitivo ? 30 : 1) * 60 * 1000 });
  if (definitivo) { try { window.dispatchEvent(new CustomEvent("oy-sesion-perdida", { detail: { id } })); } catch { /* nada */ } }
}
const cabecerasFn = () => ({ "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY });

async function conseguirSesion(u: UsuarioLocal): Promise<Session | null> {
  // 1) Cuentas creadas desde una landing o la portada: clave temporal guardada en este navegador
  const ct = lsLeer<{ id?: string; c?: string }>("oy_clave_temp");
  if (ct && ct.id === u.id && ct.c && u.email) {
    try {
      const r = await fetchOriginal(FUNCIONES + "auth-handler", {
        method: "POST", headers: cabecerasFn(),
        body: JSON.stringify({ action: "login", email: u.email, password: ct.c }),
      });
      const j = await r.json().catch(() => null);
      if (j && j.success && j.user && j.user.id === u.id && j.user.oy_ses) {
        const s = await aplicar(u.id, j.user.oy_ses);
        if (s) return s;
      }
    } catch { /* se intenta lo siguiente */ }
  }
  // 2) Sesión abierta antes del cambio: el servidor la pasa a sesión segura si los datos cuadran
  const cuerpo: Record<string, unknown> = { accion: "migrar", uid: u.id, created_at: u.created_at || null };
  if (u.type === "admin") { try { cuerpo.clave = localStorage.getItem("oy_captacion_clave") || ""; } catch { /* nada */ } }
  try {
    const r = await fetchOriginal(FUNCIONES + "oy-sesion", { method: "POST", headers: cabecerasFn(), body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.ok && j.sesion) {
      const s = await aplicar(u.id, j.sesion);
      if (s) return s;
    }
    marcarFallo(u.id, r.status);
  } catch { marcarFallo(u.id, 0); }
  return null;
}

async function asegurar(): Promise<string | null> {
  sacarSesionDeUsuario();
  const u = usuarioLocal();
  let s = await sesionGuardada();
  const p = leerPendiente();
  if (p && (!u || u.id === p.id)) {
    lsQuitar(K_PEND);
    if (!s || uidDe(s) !== p.id) {
      const nueva = await aplicar(p.id, p.s);
      if (nueva) s = nueva;
    }
  }
  if (!u) {
    // Sin usuario: anónimo. Salvo justo al entrar o registrarse (la app aún no ha guardado oy_user)
    const m = lsLeer<{ id: string; t: number }>(K_META);
    if (s && m && m.id === uidDe(s) && Date.now() - m.t < 3 * 60 * 1000) return s.access_token;
    if (s) await cerrarLocal();
    return null;
  }
  if (s && uidDe(s) === u.id) return s.access_token;
  if (s) await cerrarLocal(); // era de otra cuenta
  if (enEspera(u.id)) return null;
  const nueva = await conseguirSesion(u);
  return nueva ? nueva.access_token : null;
}
let enCurso: Promise<string | null> | null = null;
/** Devuelve el token de la sesión del usuario guardado en oy_user (o null si va anónimo). */
export function asegurarSesion(): Promise<string | null> {
  if (!enCurso) enCurso = asegurar().catch(() => null).finally(() => { enCurso = null; });
  return enCurso;
}
/** Cerrar sesión: además de borrar oy_user (lo hace la app), se cierra la sesión segura. */
export async function cerrarSesion() {
  lsQuitar(K_PEND);
  lsQuitar(K_FALLO);
  await cerrarLocal();
}

// Las peticiones a datos y archivos esperan a tener la sesión correcta del usuario
const RUTA_DATOS = /\/(rest|storage)\/v1\//;
async function fetchConSesion(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  if (url.indexOf(SUPABASE_URL) !== 0 || !RUTA_DATOS.test(url)) return fetchOriginal(input, init);
  const token = await asegurarSesion();
  const h = new Headers(init && init.headers ? init.headers : input instanceof Request ? input.headers : undefined);
  h.set("Authorization", "Bearer " + (token || SUPABASE_KEY));
  return fetchOriginal(input, { ...(init || {}), headers: h });
}

export const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storageKey: "oy-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { fetch: fetchConSesion },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
export const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/photos/`;

export type Plan = "gratis" | "basico" | "pro" | "elite";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  type: "cliente" | "profesional" | "admin";
  plan: Plan;
  bio: string;
  price: number;
  category?: string;
  trade: string;
  zone: string;
  rating: number;
  reviews: number;
  jobs: number;
  verified: boolean;
  available: boolean;
  whatsapp: string;
  service_zones: string[];
  schedule: string;
  response_time: string;
  free_quote: boolean;
  experience_years: number;
  specialties: string[];
  photos?: string[];
  profile_views?: number;
  leads_count?: number;
 trial_end: string;
  joined_at: string;
  role?: string;
  banned?: boolean;
  company_name?: string;
  has_stripe?: boolean;
}

export interface MessageRow {
  id: string;
  from_id: string;
  to_id: string;
  text: string;
  read: boolean;
  created_at: string;
}

export interface JobRow {
  id: string;
  worker_id: string;
  client_id: string;
  client_name: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "done" | "cancelled";
  created_at: string;
  updated_at?: string;
  job_code?: string;
}

export interface ReviewRow {
  id: string;
  worker_id: string;
  client_id?: string;
  client_name: string;
  stars: number;
  text: string;
  photo?: string;
  photo_url?: string;
  approved?: boolean;
  reported?: boolean;
  created_at: string;
}

export interface CertRow {
  id: string;
  worker_id: string;
  name: string;
  url: string;
  verified: boolean;
  created_at: string;
}

export interface PhotoRow {
  id: string;
  worker_id: string;
  url: string;
  caption?: string;
  created_at: string;
}

export interface LeadLogRow {
  id: string;
  pro_id: string;
  visitor_id?: string;
  visitor_zone?: string;
  type: 'whatsapp' | 'call' | 'message';
  blocked: boolean;
  month: string;
  created_at: string;
}
export const ADMIN_USER: UserRow = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "oficioya Soporte",
  email: "admin@oficioya.com",
  password: "",
  phone: "",
  type: "admin",
  plan: "elite",
  bio: "",
  price: 0,
  trade: "",
  zone: "",
  rating: 0,
  reviews: 0,
  jobs: 0,
  verified: true,
  available: true,
  whatsapp: "",
  service_zones: [],
  schedule: "",
  response_time: "",
  free_quote: false,
  experience_years: 0,
  specialties: [],
  trial_end: "",
  joined_at: "",
};
