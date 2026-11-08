// ============================================================
// OficioYa · ÁREA DEL CLIENTE — piezas compartidas
// Mismo estilo que la portada nueva (/inicio): fondo oscuro, cristal y dorado.
// ============================================================
import React, { useEffect, useRef } from "react";
import { db, SUPABASE_KEY } from "../supabase";

export const FN = "https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1";
export const FN_HEADERS = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY };
export const ADMIN_ID = "00000000-0000-0000-0000-000000000002";
export const TEL_OY = "+34656398014";
export const WA_OY = "34656398014";
export const TZ = "Europe/Madrid";
const VAPID_PUBLIC_KEY = "BMrAW5LQ8VwjrILPDpsnq98IodkFOoA0p7eUJV0uXN6UdXX83MNVlb9fXpXbZR30rIv5IFKYqs_QjFoKh9KlpvQ";

// ── TIPOS ───────────────────────────────────────────────────
export interface Cliente {
  id: string; name: string; email: string; phone?: string; type: string; avatar_url?: string; [k: string]: any;
}
export interface ProPublico {
  id: string; nombre: string; empresa: string | null; oficio: string; zona: string; avatar: string | null;
  bio: string | null; especialidades: string[]; experiencia: number | null; contrato: boolean; fotos: string[];
}
export interface ProAsignado { id: string; nombre: string; empresa: string | null; avatar: string | null; oficio: string | null; telefono: string | null; }
export interface Solicitud {
  id: string; created_at: string; oficio: string; zona: string; city_slug: string | null; descripcion: string | null;
  estado: string | null; canal: string | null; pro_solicitado: string | null;
  lead_estado: string | null; lead_estado_at: string | null; presupuesto_eur: number | null; contactado_at: string | null;
  anulado: boolean; pro: ProAsignado | null;
}
export interface Presupuesto {
  id: string; client_id: string; trabajo: string; oficio: string | null; tipo: string | null; empresa: string;
  telefono: string | null; importe: number | null; iva: "incluido" | "aparte" | "no_se"; fecha: string; valido_hasta: string | null;
  incluye: string | null; notas: string | null; estado: "pendiente" | "aceptado" | "descartado"; archivo_url: string | null;
  archivo_tipo: string | null; origen: "manual" | "oficioya"; budget_request_id: string | null; created_at: string; updated_at: string;
}

// ── ALMACÉN LOCAL SEGURO ────────────────────────────────────
export const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
export const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* nada */ } };
export const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* nada */ } };
export const lsJSON = <T,>(k: string, def: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; } };

// Clave aleatoria que se crea con la cuenta (landing o registro rápido): permite poner
// correo y contraseña sin pedir la contraseña actual, que el cliente nunca ha visto.
export function claveTemporal(userId: string): string | null {
  const c = lsJSON<{ id?: string; c?: string } | null>("oy_clave_temp", null);
  return c && c.id === userId && c.c ? c.c : null;
}
export const borrarClaveTemporal = () => lsDel("oy_clave_temp");

// ── FORMATO ─────────────────────────────────────────────────
// Miles con punto siempre (1.150 €), como en las landings
export const miles = (n: number) => { const r = Math.round(Number(n) || 0); return (r < 0 ? "-" : "") + String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
export const eur = (n: number | null | undefined) => (n == null || isNaN(Number(n)) ? "—" : miles(Number(n)) + " €");
export const eurRango = (r: [number, number]) => miles(r[0]) + " – " + miles(r[1]) + " €";
// Algunas tablas guardan la hora sin zona (es UTC)
export const ms = (s: string) => new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : String(s).replace(" ", "T") + "Z").getTime();
export const fechaCorta = (s: string) => new Date(ms(s)).toLocaleDateString("es-ES", { timeZone: TZ, day: "numeric", month: "short" });
export const fechaHora = (s: string) => new Date(ms(s)).toLocaleString("es-ES", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fechaDia = (iso: string) => {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  const mismoAno = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("es-ES", mismoAno ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
};
export const haceCuanto = (s: string) => {
  const min = Math.max(0, Math.round((Date.now() - ms(s)) / 60000));
  if (min < 1) return "ahora mismo";
  if (min < 60) return "hace " + min + " min";
  const h = Math.floor(min / 60);
  if (h < 24) return "hace " + h + " h";
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : "hace " + d + " días";
};
export const hoyISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
export const diasHasta = (iso: string) => Math.round((new Date(iso + "T12:00:00").getTime() - new Date(hoyISO() + "T12:00:00").getTime()) / 86400000);
export const digitos = (t?: string | null) => (t || "").replace(/\D/g, "");
export const telBonito = (t?: string | null) => {
  const d = digitos(t).replace(/^34(?=\d{9}$)/, "");
  return d.length === 9 ? d.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : (t || "");
};
export const enlaceTel = (t?: string | null) => "tel:" + (digitos(t).length === 9 ? "+34" + digitos(t) : "+" + digitos(t));
export const enlaceWa = (t?: string | null, texto?: string) => {
  let d = digitos(t);
  if (d.length === 9) d = "34" + d;
  return "https://wa.me/" + d + (texto ? "?text=" + encodeURIComponent(texto) : "");
};
export const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const primerNombre = (n?: string | null) => {
  const p = (n || "").trim().split(/\s+/)[0] || "";
  if (!p || /^(cliente|lead)$/i.test(p) || /\d/.test(p)) return "";
  return p.charAt(0).toUpperCase() + p.slice(1);
};
export const iniciales = (n?: string | null) => {
  const ps = (n || "").trim().split(/\s+/).filter((x) => x && !/\d/.test(x));
  return ((ps[0] || "?").charAt(0) + (ps[1] || "").charAt(0)).toUpperCase();
};
export const esEmailProvisional = (e?: string | null) => !e || /@aficioya-lead\.com$|@cliente\.oficioya\.com$/i.test(e);
export const esNombreProvisional = (n?: string | null) => !n || /^\s*(cliente|lead)\b/i.test(n) || /^\s*\d/.test(n);
export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
// Le falta crear su acceso: email provisional, enlace de contraseña pendiente o clave aleatoria sin cambiar
export const necesitaAcceso = (u: { id: string; email?: string | null; acceso_pendiente?: boolean | null }) =>
  esEmailProvisional(u.email) || u.acceso_pendiente === true || !!claveTemporal(u.id);
// «950», «950,50», «1.150», «1.150,50» y también «950.50»
export function parseImporte(t: string): number {
  let s = (t || "").trim().replace(/[\s€]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
  return parseFloat(s);
}
export const esIOS = () => typeof navigator !== "undefined" && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1));
export const appInstalada = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true || lsGet("oy_cliente_app_instalada") === "1");
export const avisosActivos = () => typeof Notification !== "undefined" && Notification.permission === "granted";
export const avisosPosibles = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

// Las mismas medidas de la app (gtag/píxel), sin tocar nada de la configuración de campañas
export function gtagEvento(evento: string, datos: Record<string, any> = {}) {
  let d = datos;
  if (evento === "generate_lead" && d.value === undefined) {
    const of = String(d.oficio || "").toLowerCase();
    d = { ...d, value: of.includes("pint") ? 80 : 40, currency: "EUR" };
  }
  try { (window as any).gtag && (window as any).gtag("event", evento, d); } catch { /* nada */ }
}
export function fbqEvento(evento: string, datos: Record<string, any> = {}) {
  try { (window as any).fbq && (window as any).fbq("track", evento, datos); } catch { /* nada */ }
}

// ── AVISOS (push) ───────────────────────────────────────────
export async function activarAvisos(userId: string): Promise<"ok" | "denegado" | "no_soportado" | "error"> {
  if (!avisosPosibles()) return "no_soportado";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denegado";
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY }));
    const { error } = await db.from("push_subscriptions").upsert({ user_id: userId, subscription: sub.toJSON() }, { onConflict: "user_id" });
    return error ? "error" : "ok";
  } catch {
    return "error";
  }
}

// ── SUBIR FOTOS / PDF ───────────────────────────────────────
async function comprimir(file: File): Promise<Blob> {
  if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const max = 1600;
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.82));
    return blob || file;
  } catch { return file; }
}
export async function subirArchivo(file: File, carpeta: string): Promise<{ url: string; tipo: string } | null> {
  const esPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const datos = esPdf ? file : await comprimir(file);
  const tipo = esPdf ? "application/pdf" : (datos.type || "image/jpeg");
  const ext = esPdf ? "pdf" : tipo.includes("png") && datos === file ? "png" : "jpg";
  const nombre = carpeta + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  const { error } = await db.storage.from("photos").upload(nombre, datos, { contentType: tipo, upsert: false });
  if (error) return null;
  return { url: db.storage.from("photos").getPublicUrl(nombre).data.publicUrl, tipo };
}

// ── PRECIOS ORIENTATIVOS (los mismos de las landings y páginas de precios, 2026) ──
export interface RefTipo { titulo: string; pregunta: string; hint?: string; tamanos: { k: string; t: string; r: [number, number] }[] }
export const REF: Record<"pintura" | "fontaneria", { oficio: string; titulo: string; tipos: Record<string, RefTipo> }> = {
  pintura: {
    oficio: "Pintor",
    titulo: "Pintura",
    tipos: {
      piso_completo: { titulo: "Piso completo", pregunta: "¿De qué tamaño es el piso?", hint: "Mano de obra y pintura plástica lisa", tamanos: [
        { k: "p1", t: "Menos de 60 m²", r: [380, 680] }, { k: "p2", t: "60–100 m²", r: [680, 1200] }, { k: "p3", t: "Más de 100 m²", r: [1200, 1950] }] },
      habitaciones: { titulo: "Habitaciones", pregunta: "¿Cuántas habitaciones?", hint: "Paredes, techos y rodapiés", tamanos: [
        { k: "p1", t: "1 habitación", r: [100, 165] }, { k: "p2", t: "2–3 habitaciones", r: [200, 420] }, { k: "p3", t: "4 o más", r: [420, 760] }] },
      fachada: { titulo: "Fachada", pregunta: "¿De qué tamaño es la fachada?", hint: "Varía según la altura y el estado de la pared", tamanos: [
        { k: "p1", t: "Menos de 50 m²", r: [900, 1500] }, { k: "p2", t: "50–120 m²", r: [1500, 2600] }, { k: "p3", t: "Más de 120 m²", r: [2600, 5250] }] },
      gotele: { titulo: "Quitar gotelé", pregunta: "¿Cuántas habitaciones?", hint: "Alisar y dejar lista para pintar", tamanos: [
        { k: "p1", t: "1 habitación", r: [140, 280] }, { k: "p2", t: "2–3 habitaciones", r: [280, 710] }, { k: "p3", t: "4 o más", r: [590, 1290] }] },
    },
  },
  fontaneria: {
    oficio: "Fontanero",
    titulo: "Fontanería",
    tipos: {
      atasco: { titulo: "Atasco", pregunta: "¿Cómo es el atasco?", hint: "Desplazamiento y mano de obra", tamanos: [
        { k: "simple", t: "Fregadero, lavabo o WC", r: [75, 150] }, { k: "maquina", t: "Hace falta máquina", r: [120, 200] }, { k: "camara", t: "Con cámara para localizarlo", r: [200, 300] }] },
      fuga: { titulo: "Fuga de agua", pregunta: "¿Dónde está la fuga?", hint: "Si hay que picar, la albañilería va aparte", tamanos: [
        { k: "visible", t: "A la vista (grifo, sifón…)", r: [70, 130] }, { k: "pared", t: "En la pared, hay que buscarla", r: [150, 250] }, { k: "rotura", t: "Hay que romper tabique", r: [250, 300] }] },
      tuberias: { titulo: "Cambiar tuberías", pregunta: "¿Qué hay que cambiar?", hint: "Mano de obra y material", tamanos: [
        { k: "estancia", t: "Un baño o una cocina", r: [800, 1800] }, { k: "piso_s", t: "Piso hasta 70 m²", r: [2000, 4000] }, { k: "piso_m", t: "Piso de 70 a 120 m²", r: [3500, 7000] }] },
      instalacion: { titulo: "Instalación nueva", pregunta: "¿Cómo es la vivienda?", hint: "Toda la fontanería de la vivienda", tamanos: [
        { k: "pequeno", t: "Piso pequeño", r: [1500, 2500] }, { k: "medio", t: "1 baño + aseo", r: [2000, 3500] }, { k: "grande", t: "2 baños", r: [3000, 5000] }] },
    },
  },
};
export interface RefSel { grupo: "pintura" | "fontaneria"; tipo: string; tam: string }
export const claveRef = (s: RefSel) => s.grupo + "." + s.tipo + "." + s.tam;
export function leerRef(clave?: string | null): { sel: RefSel; titulo: string; tam: string; rango: [number, number]; hint?: string; oficio: string } | null {
  if (!clave) return null;
  const [g, t, k] = clave.split(".");
  const grupo = (REF as any)[g];
  const tipo = grupo?.tipos?.[t];
  const tam = tipo?.tamanos?.find((x: any) => x.k === k);
  if (!tam) return null;
  return { sel: { grupo: g as any, tipo: t, tam: k }, titulo: tipo.titulo, tam: tam.t, rango: tam.r, hint: tipo.hint, oficio: grupo.oficio };
}
// Dónde cae un precio frente al rango habitual
export function veredicto(importe: number, r: [number, number]) {
  const [a, b] = r;
  if (importe < a * 0.85) return { nivel: "bajo" as const, txt: "Muy por debajo de lo habitual", detalle: "Pregunta bien qué incluye: a veces falta material o algún trabajo." };
  if (importe <= b) return { nivel: "justo" as const, txt: "En precio", detalle: "Está dentro de lo que se suele cobrar." };
  const pct = Math.round(((importe - b) / b) * 100);
  if (pct <= 15) return { nivel: "algo" as const, txt: "Un poco por encima (+" + pct + "%)", detalle: "Puede estar justificado si incluye extras. Compáralo con otro." };
  return { nivel: "alto" as const, txt: "Por encima de lo habitual (+" + pct + "%)", detalle: "Te conviene pedir otro presupuesto antes de decidir." };
}

// ── OFICIOS ─────────────────────────────────────────────────
export const OFICIOS_Q = ["Pintor", "Fontanero", "Electricista", "Reformas", "Otro"] as const;
export const nombreOficio = (o?: string | null) => {
  const s = (o || "").toLowerCase();
  if (s.startsWith("pint")) return "Pintura";
  if (s.startsWith("fontan")) return "Fontanería";
  if (s.startsWith("electric")) return "Electricidad";
  if (s.startsWith("reform")) return "Reformas";
  if (s.startsWith("cerraj")) return "Cerrajería";
  if (s.startsWith("climat")) return "Climatización";
  if (s.startsWith("manitas")) return "Manitas";
  return o || "Otro";
};
export const iconoOficio = (o?: string | null): IconName => {
  const s = (o || "").toLowerCase();
  if (s.startsWith("pint")) return "rodillo";
  if (s.startsWith("fontan")) return "gota";
  if (s.startsWith("electric")) return "rayo";
  if (s.startsWith("reform")) return "casa";
  return "llave";
};

// ── ICONOS ──────────────────────────────────────────────────
const P: Record<string, React.ReactNode> = {
  inicio: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>,
  solicitudes: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M9 3.5V5h6V3.5" /><path d="M9 11h6M9 15h4" /></>,
  presupuestos: <><path d="M6 2.8h12a1 1 0 0 1 1 1V21l-3-1.8-2.5 1.8-2.5-1.8-2.5 1.8L6 19.2V3.8a1 1 0 0 1 1-1z" /><path d="M14.6 8.2a2.7 2.7 0 1 0 0 4.6M9 9.5h4M9 11.5h4" /></>,
  calcular: <><rect x="4.5" y="2.5" width="15" height="19" rx="2.5" /><rect x="7.5" y="5.5" width="9" height="4" rx="1" /><path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01M16 16.5h.01" /></>,
  perfil: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  tel: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  wa: <><path d="M3.5 20.5l1.3-4.1A8.5 8.5 0 1 1 8 19.6z" /><path d="M9 8.6c.2 2.6 2.3 5 5.2 5.7.5.1 1.3-.4 1.6-1l-1.6-1-1 .7c-.9-.4-1.8-1.3-2.3-2.3l.6-1-1-1.6c-.6.3-1.2.8-1.5 1.5z" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  mas: <path d="M12 5v14M5 12h14" />,
  flecha: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  cheveron: <path d="m9 6 6 6-6 6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  camara: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  archivo: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  escudo: <><path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  usuario: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  euro: <><path d="M17.5 6.5A7 7 0 1 0 17.5 17.5" /><path d="M4 10h9M4 14h9" /></>,
  campana: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  movil: <><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><path d="M12 7.5v7" /><path d="m9.2 11.8 2.8 2.8 2.8-2.8" /></>,
  candado: <><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  correo: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  ojo: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  ojoNo: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.3 4.2M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5h.01" /></>,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  mapa: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  papelera: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3" /></>,
  lapiz: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  salir: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></>,
  rodillo: <><rect x="3" y="3" width="14" height="6" rx="2" /><path d="M17 6h2a2 2 0 0 1 2 2v1.5a2 2 0 0 1-2 2h-7v2.5" /><rect x="10" y="14" width="4" height="7" rx="1.2" /></>,
  gota: <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z" />,
  rayo: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  casa: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  llave: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z" />,
  estrella: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  chispa: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>,
  ayuda: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.6M12 17h.01" /></>,
  grupo: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20" /></>,
  compartir: <><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>,
  copiar: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  bajar: <><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
  externo: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
};
export type IconName = keyof typeof P | string;
export function Icono({ n, s = 20, w = 2, c = "currentColor", style }: { n: IconName; s?: number; w?: number; c?: string; style?: React.CSSProperties }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto", ...style }}>
      {P[n as string] || P.info}
    </svg>
  );
}

// ── PIEZAS DE INTERFAZ ──────────────────────────────────────
export function Avatar({ nombre, url, size = 44 }: { nombre?: string | null; url?: string | null; size?: number }) {
  const [roto, setRoto] = React.useState(false);
  if (url && !roto) {
    return <img src={url} alt="" width={size} height={size} onError={() => setRoto(true)} className="cy-ava" style={{ width: size, height: size }} />;
  }
  return <span className="cy-ava cy-ava-ini" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>{iniciales(nombre)}</span>;
}

export function Hoja({ titulo, children, onClose, ancho = 560, pie, id }: { titulo?: React.ReactNode; children: React.ReactNode; onClose: () => void; ancho?: number; pie?: React.ReactNode; id?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const y0 = useRef(0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="cy-velo" onClick={onClose} role="presentation">
      <div ref={caja} id={id} className="cy-hoja" role="dialog" aria-modal="true" style={{ maxWidth: ancho }} onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { const r = caja.current?.getBoundingClientRect(); y0.current = r && e.touches[0].clientY - r.top < 72 ? e.touches[0].clientY : -1; }}
        onTouchEnd={(e) => { if (y0.current >= 0 && e.changedTouches[0].clientY - y0.current > 90) onClose(); y0.current = -1; }}>
        <div className="cy-asa" />
        {titulo !== undefined && (
          <div className="cy-hoja-cab">
            <div className="cy-h2" style={{ flex: 1, minWidth: 0 }}>{titulo}</div>
            <button className="cy-x" onClick={onClose} aria-label="Cerrar"><Icono n="x" s={18} /></button>
          </div>
        )}
        <div className="cy-hoja-cuerpo">{children}</div>
        {pie && <div className="cy-hoja-pie">{pie}</div>}
      </div>
    </div>
  );
}

export function Vacio({ icono, titulo, texto, children }: { icono: IconName; titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="cy-vacio">
      <div className="cy-vacio-ic"><Icono n={icono} s={28} /></div>
      <p className="cy-vacio-t">{titulo}</p>
      {texto && <p className="cy-vacio-p">{texto}</p>}
      {children}
    </div>
  );
}

export function Esqueleto({ alto = 120, n = 1 }: { alto?: number; n?: number }) {
  return <>{Array.from({ length: n }).map((_, i) => <div key={i} className="cy-skel" style={{ height: alto }} />)}</>;
}

// ── ESTILOS ─────────────────────────────────────────────────
export function EstilosCliente() {
  return <style>{CSS}</style>;
}
const CSS = `
.cy{--bg:#0F1117;--ink:#F2F5FA;--ink2:#B4BCCB;--ink3:#96A0B3;--soft:#C9D1DF;--gold:#FFD700;--gold2:#FFD200;--orange:#FF8C00;--warn:#FFC94D;--green:#00D68F;--mint:#7DF0C4;--coral:#FFAD8A;
  --glass:rgba(255,255,255,.055);--line:rgba(255,255,255,.11);--btn:linear-gradient(135deg,#FFFFFF 0%,#F0E6C0 45%,#FFD700 100%);--grad:linear-gradient(135deg,#FFD700,#FF8C00);--spring:cubic-bezier(.34,1.56,.64,1);
  font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#E8EDF5;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
:where(.cy) *,:where(.cy) *::before,:where(.cy) *::after{box-sizing:border-box}
:where(.cy) :where(button,input,textarea,select){font:inherit;color:inherit}
:where(.cy) button{cursor:pointer}
:where(.cy) :focus-visible{outline:2px solid var(--gold);outline-offset:3px}
:where(.cy) p{margin:0}
.cy-fondo{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(1100px 700px at 88% -12%,rgba(255,184,0,.14),rgba(255,184,0,0) 62%),linear-gradient(180deg,#11131A 0%,#0D0F15 55%,#0A0B10 100%)}
.cy-fondo::after{content:"";position:absolute;top:-18vh;right:-30vw;width:90vw;height:90vw;max-width:900px;max-height:900px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,0,.16),rgba(255,140,0,.06) 40%,rgba(255,140,0,0) 68%)}
.cy-app{position:relative;z-index:1;min-height:100vh;min-height:100dvh;padding-bottom:calc(112px + env(safe-area-inset-bottom))}
.cy-wrap{max-width:720px;margin:0 auto;padding:0 16px}
.cy-glass{background:var(--glass);border:1px solid var(--line);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 40px 80px -40px rgba(0,0,0,.9);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%)}
.cy-card{border-radius:24px;padding:18px;margin-bottom:14px}
.cy-card-oro{background:linear-gradient(160deg,rgba(255,215,0,.14),rgba(255,140,0,.05));border:1px solid rgba(255,200,0,.45);box-shadow:0 18px 40px -22px rgba(255,160,0,.55),inset 0 1px 0 rgba(255,255,255,.12)}
.cy-sec{margin:26px 0 12px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.cy-h1{margin:0;font-size:clamp(28px,7.4vw,36px);line-height:1.04;letter-spacing:-.04em;font-weight:900;color:var(--ink)}
.cy-h1 span{color:var(--gold2);text-shadow:0 0 40px rgba(255,170,0,.3)}
.cy-h2{margin:0;font-size:19px;line-height:1.2;font-weight:800;letter-spacing:-.015em;color:var(--ink)}
.cy-h3{margin:0;font-size:16px;line-height:1.25;font-weight:800;color:var(--ink)}
.cy-eyebrow{font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#A9B1C2}
.cy-sub{font-size:14.5px;line-height:1.55;color:var(--ink2)}
.cy-mini{font-size:12.5px;line-height:1.45;color:var(--ink3)}
.cy-oro{color:#FFE38A}
.cy-mint{color:var(--mint)}
.cy-row{display:flex;flex-wrap:wrap;gap:8px}
.cy-between{display:flex;align-items:center;justify-content:space-between;gap:10px}
.cy-col{display:flex;flex-direction:column;gap:10px}
.cy-sep{height:1px;background:rgba(255,255,255,.09);margin:14px 0;border:0}

/* Cabecera */
.cy-cab{position:sticky;top:0;z-index:60;padding:calc(env(safe-area-inset-top) + 10px) 12px 0}
.cy-cab-in{max-width:720px;margin:0 auto;height:58px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 8px 0 14px;border-radius:20px;background:rgba(15,17,23,.62);border:1px solid rgba(255,255,255,.10);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 20px 40px -24px rgba(0,0,0,.85);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%)}
.cy-logo{display:flex;align-items:center;gap:9px;background:none;border:0;padding:0;color:#E8EDF5}
.cy-logo-ic{width:30px;height:30px;border-radius:8px;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 6px 16px -6px rgba(255,160,0,.75),inset 0 1px 0 rgba(255,255,255,.45)}
.cy-logo-tx{font-weight:900;font-size:19px;letter-spacing:-.02em}
.cy-logo-tx b{color:var(--gold);font-weight:900}
.cy-cab-r{display:flex;align-items:center;gap:6px}
.cy-icbtn{position:relative;width:42px;height:42px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#D5DBE6;display:flex;align-items:center;justify-content:center;padding:0}
.cy-icbtn:active{transform:scale(.96)}
.cy-badge{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:linear-gradient(135deg,#FF4455,#FF6677);color:#fff;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #0F1117}
.cy-ava{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;border-radius:50%;object-fit:cover;border:1px solid rgba(255,200,0,.35);box-shadow:0 8px 20px -12px rgba(255,160,0,.6)}
.cy-ava-ini{background:linear-gradient(135deg,rgba(255,215,0,.28),rgba(255,140,0,.14));color:#FFE38A;font-weight:900;letter-spacing:-.02em}

/* Botones */
.cy-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:54px;padding:0 20px;border:0;border-radius:18px;background:var(--btn);color:#1A1200;font-size:16px;font-weight:800;letter-spacing:-.01em;text-decoration:none;box-shadow:0 18px 40px -16px rgba(255,200,0,.75),inset 0 -2px 0 rgba(0,0,0,.08);transition:transform .18s ease,box-shadow .2s ease,opacity .2s}
.cy-btn:active{transform:scale(.98)}
.cy-btn[disabled]{opacity:.6;cursor:default;transform:none}
.cy-btn-s{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 16px;border-radius:16px;background:rgba(255,200,0,.12);border:1px solid rgba(255,200,0,.5);color:#FFE38A;font-size:14.5px;font-weight:800;text-decoration:none;transition:all .3s ease}
.cy-btn-s:active{transform:scale(.98)}
.cy-btn-g{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 15px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.16);color:#E8EDF5;font-size:14px;font-weight:700;text-decoration:none}
.cy-btn-g:active{transform:scale(.98)}
.cy-btn-verde{background:linear-gradient(135deg,#2FE0A2,#00B377);color:#03130C;box-shadow:0 18px 40px -18px rgba(0,214,143,.8)}
.cy-btn-sm{min-height:40px;padding:0 13px;border-radius:12px;font-size:13.5px}
.cy-full{width:100%}
.cy-link{background:none;border:0;padding:6px 2px;color:#FFE38A;font-weight:700;font-size:14px;text-decoration:none;display:inline-flex;align-items:center;gap:5px}
.cy-x{width:36px;height:36px;flex:0 0 auto;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);color:var(--ink2);display:flex;align-items:center;justify-content:center;padding:0}

/* Chips, mosaicos y segmentos (como /inicio) */
.cy-chip{min-height:44px;padding:0 15px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);color:var(--soft);font-size:14px;font-weight:600;transition:all .35s var(--spring);display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.cy-chip[aria-pressed="true"]{background:rgba(255,200,0,.16);border-color:rgba(255,200,0,.65);color:#FFE38A;font-weight:800}
.cy-chip.dash{border-style:dashed}
.cy-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.cy-tile{display:flex;flex-direction:column;align-items:flex-start;gap:9px;min-height:96px;padding:14px;text-align:left;color:var(--ink);border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);transition:all .5s var(--spring)}
.cy-tile .ic{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.07);color:var(--gold);transition:all .5s var(--spring)}
.cy-tile b{display:block;font-size:15.5px;font-weight:800}
.cy-tile small{display:block;margin-top:2px;font-size:12px;color:#A9B1C2;font-weight:500;line-height:1.35}
.cy-tile[aria-pressed="true"]{border-radius:24px;background:linear-gradient(160deg,rgba(255,215,0,.2),rgba(255,140,0,.08));border-color:rgba(255,200,0,.62);box-shadow:0 18px 40px -18px rgba(255,160,0,.65),inset 0 1px 0 rgba(255,255,255,.14);transform:translateY(-2px)}
.cy-tile[aria-pressed="true"] .ic{border-radius:50%;background:var(--grad);color:#1A1200}
.cy-seg{display:grid;gap:6px;padding:5px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.cy-seg button{min-height:42px;border:0;border-radius:12px;background:transparent;color:var(--soft);font-weight:800;font-size:13.5px;transition:all .4s var(--spring);padding:0 6px}
.cy-seg button[aria-pressed="true"]{background:var(--grad);color:#1A1200;box-shadow:0 8px 18px -8px rgba(255,160,0,.8)}
.cy-lbl{margin:18px 0 10px;font-size:11px;font-weight:800;letter-spacing:.12em;color:#A9B1C2;text-transform:uppercase}
.cy-q{margin:14px 0 8px;font-size:13px;color:var(--soft);font-weight:600}

/* Campos */
.cy-fld{display:block;margin-bottom:12px}
.cy-fld>span{display:block;margin-bottom:6px;font-size:12.5px;color:#A9B1C2;font-weight:600}
.cy-inp{display:block;width:100%;min-height:50px;padding:0 16px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:var(--ink);font-size:16px;outline:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;appearance:none}
textarea.cy-inp{padding:13px 16px;min-height:92px;resize:vertical;line-height:1.5}
select.cy-inp{background-image:linear-gradient(45deg,transparent 50%,#A9B1C2 50%),linear-gradient(135deg,#A9B1C2 50%,transparent 50%);background-position:calc(100% - 20px) 50%,calc(100% - 15px) 50%;background-size:5px 5px;background-repeat:no-repeat;padding-right:36px}
select.cy-inp option{background:#1A1C24;color:#F2F5FA}
.cy-inp:focus{border-color:rgba(255,200,0,.7);box-shadow:0 0 0 3px rgba(255,200,0,.15)}
.cy-inp::placeholder{color:#7F889A}
.cy-inp.bad{border-color:#FF9F7A}
.cy-inp-ic{position:relative}
.cy-inp-ic .cy-inp{padding-right:52px}
.cy-inp-ic button{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:40px;height:40px;border:0;background:none;color:var(--ink3);display:flex;align-items:center;justify-content:center}
.cy-msg{min-height:18px;margin:6px 0 0;font-size:13px;font-weight:600;color:var(--coral)}
.cy-ok{color:var(--mint)}
.cy-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}

/* Precio orientativo */
.cy-ticket{margin-top:14px;padding:14px 16px;border-radius:18px;background:linear-gradient(135deg,rgba(255,215,0,.13),rgba(255,140,0,.06));border:1px dashed rgba(255,200,0,.5);display:flex;align-items:center;justify-content:space-between;gap:12px}
.cy-ticket small{display:block;font-size:11px;font-weight:800;letter-spacing:.1em;color:var(--warn)}
.cy-ticket>div{min-width:0}
.cy-ticket strong{display:block;margin-top:2px;font-size:22px;font-weight:900;color:#fff;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap}
.cy-ticket p{max-width:132px;font-size:11.5px;line-height:1.4;color:var(--ink2);text-align:right}

/* Píldoras de estado */
.cy-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:var(--soft)}
.cy-pill.ok{background:rgba(0,214,143,.1);border-color:rgba(0,214,143,.35);color:var(--mint)}
.cy-pill.oro{background:rgba(255,200,0,.12);border-color:rgba(255,200,0,.45);color:#FFE38A}
.cy-pill.warn{background:rgba(255,173,138,.1);border-color:rgba(255,173,138,.4);color:var(--coral)}
.cy-dot{width:8px;height:8px;border-radius:50%;background:var(--green);flex:0 0 auto;animation:cyPulse 2.4s ease-out infinite}
@keyframes cyPulse{0%{box-shadow:0 0 0 0 rgba(0,214,143,.45)}70%{box-shadow:0 0 0 9px rgba(0,214,143,0)}100%{box-shadow:0 0 0 0 rgba(0,214,143,0)}}

/* Seguimiento de la solicitud */
.cy-pasos{list-style:none;margin:14px 0 0;padding:0;position:relative}
.cy-paso{position:relative;display:flex;gap:12px;padding-bottom:14px}
.cy-paso:last-child{padding-bottom:0}
.cy-paso::before{content:"";position:absolute;left:11px;top:24px;bottom:0;width:2px;background:rgba(255,255,255,.1)}
.cy-paso:last-child::before{display:none}
.cy-paso.hecho::before{background:linear-gradient(180deg,#FFD700,rgba(255,140,0,.5))}
.cy-paso-c{width:24px;height:24px;flex:0 0 24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(255,255,255,.2);background:#141720;color:transparent}
.cy-paso.hecho .cy-paso-c{background:var(--grad);border-color:transparent;color:#1A1200}
.cy-paso.ahora .cy-paso-c{border-color:var(--gold);box-shadow:0 0 0 4px rgba(255,215,0,.14)}
.cy-paso.ahora .cy-paso-c::after{content:"";width:8px;height:8px;border-radius:50%;background:var(--gold);animation:cyLate 1.6s ease-in-out infinite}
@keyframes cyLate{50%{transform:scale(.6);opacity:.5}}
.cy-paso b{display:block;font-size:14.5px;font-weight:800;color:var(--ink)}
.cy-paso small{display:block;margin-top:2px;font-size:12.5px;color:var(--ink3);line-height:1.4}
.cy-paso.falta b{color:#8C95A8;font-weight:700}
.cy-barra{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.cy-barra i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#FFD700,#FF8C00);transition:width .8s cubic-bezier(.4,0,.2,1)}

/* Rango de precios con marcas */
.cy-rango{position:relative;height:10px;margin:28px 6px 26px;border-radius:99px;background:linear-gradient(90deg,rgba(0,214,143,.25),rgba(0,214,143,.55) 30%,rgba(0,214,143,.55) 70%,rgba(255,173,138,.55))}
.cy-rango-m{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#fff;border:3px solid #FFB800;box-shadow:0 4px 10px rgba(0,0,0,.5)}
.cy-rango-m span{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:800;color:#F2F5FA;white-space:nowrap;background:rgba(15,17,23,.9);padding:2px 6px;border-radius:6px;border:1px solid rgba(255,255,255,.14)}
.cy-rango-e{position:absolute;top:16px;font-size:11px;color:var(--ink3);font-weight:700;white-space:nowrap}

/* Barra de pestañas */
.cy-tabs{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:200;max-width:560px;margin:0 auto;display:flex;padding:6px;border-radius:22px;background:rgba(15,17,23,.82);border:1px solid rgba(255,255,255,.10);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 24px 50px -20px rgba(0,0,0,.9);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%)}
.cy-tab{flex:1;min-width:0;min-height:56px;padding:7px 0 6px;border:0;border-radius:16px;background:none;color:#96A0B3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;position:relative;transition:background .25s}
.cy-tab span{font-size:10px;font-weight:700;letter-spacing:-.02em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-tab[aria-current="page"]{background:linear-gradient(160deg,rgba(255,215,0,.16),rgba(255,140,0,.06));color:var(--gold)}
.cy-tab[aria-current="page"] span{color:#FFE38A;font-weight:800}
.cy-tab .cy-badge{top:2px;right:calc(50% - 22px)}
@media (max-width:370px){.cy-tab span{font-size:9px;letter-spacing:-.03em}.cy-tabs{left:6px;right:6px;padding:5px}}

/* Hojas (paneles que suben desde abajo) */
.cy-velo{position:fixed;inset:0;z-index:3000;background:rgba(6,7,11,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;animation:cyFade .2s ease}
@media (min-width:720px){.cy-velo{align-items:center;padding:24px}}
.cy-hoja{position:relative;width:100%;max-height:92vh;max-height:92dvh;display:flex;flex-direction:column;border-radius:28px 28px 0 0;background:rgba(17,19,26,.97);border:1px solid rgba(255,255,255,.12);border-bottom:0;box-shadow:0 -20px 60px -20px rgba(0,0,0,.8);animation:cySube .34s cubic-bezier(.2,.9,.3,1.1)}
@media (min-width:720px){.cy-hoja{border-radius:28px;border-bottom:1px solid rgba(255,255,255,.12)}}
.cy-asa{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.18);margin:10px auto 0;flex:0 0 auto}
.cy-hoja-cab{display:flex;align-items:center;gap:12px;padding:14px 20px 4px;flex:0 0 auto}
.cy-hoja-cuerpo{padding:12px 20px 20px;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1 1 auto}
.cy-hoja-pie{padding:12px 20px calc(14px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.08);flex:0 0 auto;background:rgba(17,19,26,.97)}
#cy-chat{min-height:64vh;min-height:64dvh}
@keyframes cySube{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes cyFade{from{opacity:0}to{opacity:1}}
@keyframes cyEntra{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.cy-entra{animation:cyEntra .35s ease both}

/* Aviso flotante */
.cy-toast{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:4000;max-width:calc(100vw - 32px);padding:12px 16px;border-radius:14px;background:rgba(17,19,26,.95);border:1px solid rgba(255,200,0,.45);color:#F2F5FA;font-size:14px;font-weight:700;box-shadow:0 18px 40px -16px rgba(0,0,0,.9);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);animation:cyEntra .25s ease;text-align:center}

/* Vacío y esqueleto */
.cy-vacio{text-align:center;padding:28px 12px 8px}
.cy-vacio-ic{width:64px;height:64px;margin:0 auto 14px;border-radius:20px;display:flex;align-items:center;justify-content:center;background:rgba(255,200,0,.1);border:1px solid rgba(255,200,0,.35);color:var(--gold)}
.cy-vacio-t{font-size:17px;font-weight:800;color:var(--ink)}
.cy-vacio-p{margin-top:6px !important;font-size:14px;line-height:1.5;color:var(--ink2)}
.cy-skel{border-radius:22px;margin-bottom:12px;background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 37%,rgba(255,255,255,.04) 63%);background-size:400% 100%;animation:cyShim 1.4s ease infinite}
@keyframes cyShim{0%{background-position:100% 50%}100%{background-position:0 50%}}

/* Resaltado (guía hacia la tarjeta del perfil) */
.cy-foco{animation:cyFoco 1.6s ease-in-out 3;border-color:rgba(255,200,0,.8) !important}
@keyframes cyFoco{0%,100%{box-shadow:0 0 0 0 rgba(255,215,0,.0),0 18px 40px -22px rgba(255,160,0,.55)}50%{box-shadow:0 0 0 6px rgba(255,215,0,.22),0 18px 40px -22px rgba(255,160,0,.55)}}

/* Listas tipo menú */
.cy-lista{border-radius:22px;overflow:hidden;margin-bottom:14px}
.cy-item{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;background:none;border:0;border-bottom:1px solid rgba(255,255,255,.07);color:var(--ink);text-align:left;text-decoration:none;font-size:15px;font-weight:700}
.cy-item:last-child{border-bottom:0}
.cy-item small{display:block;font-size:12.5px;font-weight:500;color:var(--ink3);margin-top:2px}
.cy-item .ic{width:36px;height:36px;border-radius:11px;flex:0 0 36px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);color:var(--gold)}
.cy-carril{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 16px 8px;margin:0 -16px;scrollbar-width:none}
.cy-carril::-webkit-scrollbar{display:none}
.cy-carril>*{scroll-snap-align:start;flex:0 0 auto}
.cy-clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cy-clamp3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
`;
