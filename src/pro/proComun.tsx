// ============================================================
// OficioYa · Panel PROFESIONAL — piezas compartidas
// Lo usan ProInicio, ProFacturas y ProNegocio.
// ============================================================
import React from "react";
import { db } from "../supabase";

export const C = {
  bg: "#0F1117", surface: "#161B27", card: "#1E2536", border: "#2D3A52",
  accent: "#FFD700", orange: "#FF8C00", red: "#FF4455", green: "#00D68F",
  blue: "#3B82F6", text: "#E8EDF5", muted: "#5A6A8A", mutedL: "#8899BB",
};
export const F = "'DM Sans',sans-serif";
export const TZ = "Europe/Madrid";
export const UMBRAL_FACTURA = 820;
export const IVA_PCT = 21;

// Datos del emisor de las facturas
export const OY_EMISOR = {
  nombre: "Andrés Algora",
  comercial: "OficioYa",
  nif: "77860535S",
  direccion: "C/ Condes de Bustillo 5, bajo D",
  cpCiudad: "41010 Sevilla",
  web: "aficioya.com",
};

// ── TIPOS ───────────────────────────────────────────────────
export type Estado = "nuevo" | "contactado" | "presupuesto" | "ganado" | "perdido";
export type Canal = "formulario" | "whatsapp" | "llamada";

export interface LeadRow {
  id: string;
  created_at: string;
  trade: string;
  canal: Canal;
  estado: Estado;
  estado_at: string;
  presupuesto_eur: number | null;
  client_name: string | null;
  client_phone: string | null;
  zona: string | null;
  descripcion: string | null;
  price: number;
  anulado: boolean;
  invoice_id: string | null;
  primer_contacto_at: string | null;
  llamada_segundos: number | null;
}

export interface FacturaRow {
  id: string;
  number: string;
  issued_at: string;
  due_at: string;
  period_start: string | null;
  period_end: string | null;
  motivo: "fin_de_mes" | "umbral";
  n_leads: number;
  base: number;
  iva_pct: number;
  iva: number;
  total: number;
  status: "pendiente" | "pagada" | "anulada";
  paid_at: string | null;
  cliente_nombre: string | null;
  cliente_nif: string | null;
  cliente_direccion: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
}

export const CANAL_LABEL: Record<Canal, string> = {
  formulario: "Formulario",
  whatsapp: "WhatsApp",
  llamada: "Llamada",
};

// ── FORMATO ─────────────────────────────────────────────────
export const eur = (n: number) =>
  (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
export const eurCorto = (n: number) =>
  (Math.round(Number(n) || 0)).toLocaleString("es-ES") + " €";
export const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const haceCuanto = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "ahora mismo";
  if (min < 60) return "hace " + min + " min";
  const h = Math.floor(min / 60);
  if (h < 24) return "hace " + h + " h";
  const d = Math.floor(h / 24);
  return "hace " + d + (d === 1 ? " día" : " días");
};

export const duracionMin = (min: number) => {
  if (min < 60) return Math.max(1, Math.round(min)) + " min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return h + " h" + (m ? " " + m + " min" : "");
  const d = Math.floor(h / 24);
  return d + (d === 1 ? " día" : " días") + (h % 24 ? " " + (h % 24) + " h" : "");
};

export const digitos = (t: string | null) => (t || "").replace(/[^0-9]/g, "");
export const enlaceWhatsApp = (tel: string | null) => {
  let d = digitos(tel);
  if (d.length === 9) d = "34" + d;
  return "https://wa.me/" + d;
};
export const enlaceTel = (tel: string | null) => "tel:" + (tel || "").replace(/[^0-9+]/g, "");

// ── PIEZAS DE INTERFAZ ──────────────────────────────────────
export function Card({ children, style = {}, accent }: any) {
  return (
    <div style={{
      background: C.card, border: "1px solid " + (accent || C.border),
      borderRadius: 12, padding: 14, marginBottom: 10, ...style,
    }}>{children}</div>
  );
}

export function Boton({ children, onClick, color = C.accent, outline = false, disabled = false, href, small = false }: any) {
  const estilo: React.CSSProperties = {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: small ? "8px 10px" : "11px 12px", borderRadius: 9, textDecoration: "none",
    background: disabled ? C.border : outline ? "transparent" : color,
    border: outline ? "1px solid " + (disabled ? C.border : color) : "none",
    color: disabled ? C.muted : outline ? color : (color === C.accent || color === C.green ? "#000" : "#fff"),
    fontFamily: F, fontSize: small ? 12 : 13, fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer", boxSizing: "border-box",
  };
  if (href && !disabled) {
    return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" style={estilo}>{children}</a>;
  }
  return <button onClick={disabled ? undefined : onClick} disabled={disabled} style={estilo}>{children}</button>;
}

export function Etiqueta({ texto, color }: { texto: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 5,
      background: color + "1F", color, whiteSpace: "nowrap",
    }}>{texto}</span>
  );
}

export function Titulo({ children }: any) {
  return (
    <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: C.muted, margin: "18px 0 10px" }}>{children}</p>
  );
}

// ── AVISOS PUSH ─────────────────────────────────────────────
const VAPID_PUBLIC_KEY = "BMrAW5LQ8VwjrILPDpsnq98IodkFOoA0p7eUJV0uXN6UdXX83MNVlb9fXpXbZR30rIv5IFKYqs_QjFoKh9KlpvQ";
const PUSH_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/send-push";

export type EstadoPush = "activado" | "desactivado" | "bloqueado" | "no_compatible" | "instalar_ios";

function claveAUint8(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const bin = window.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function swListo(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) await navigator.serviceWorker.register("/sw.js");
  } catch { /* nada */ }
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 5000)),
  ]);
}

const esIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const instalada = () =>
  (navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;

export async function estadoPush(userId: string): Promise<EstadoPush> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return esIOS() && !instalada() ? "instalar_ios" : "no_compatible";
  }
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission !== "granted") return "desactivado";
  try {
    if (localStorage.getItem("oy_push_off") === "1") return "desactivado";
  } catch { /* nada */ }
  const reg = await swListo();
  if (!reg) return "no_compatible";
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return "desactivado";
  const { data } = await db.from("push_subscriptions").select("subscription").eq("user_id", userId).maybeSingle();
  const guardado = (data as any)?.subscription?.endpoint;
  return guardado && guardado === sub.endpoint ? "activado" : "desactivado";
}

export async function activarPush(userId: string): Promise<EstadoPush> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return esIOS() && !instalada() ? "instalar_ios" : "no_compatible";
  }
  const permiso = await Notification.requestPermission();
  if (permiso === "denied") return "bloqueado";
  if (permiso !== "granted") return "desactivado";
  const reg = await swListo();
  if (!reg) return "no_compatible";
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveAUint8(VAPID_PUBLIC_KEY) });
  }
  const { error } = await db.from("push_subscriptions").upsert(
    { user_id: userId, subscription: sub.toJSON() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("No se ha podido guardar el aviso");
  try { localStorage.removeItem("oy_push_off"); } catch { /* nada */ }
  try {
    await reg.showNotification("Avisos activados", {
      body: "Te avisaremos cada vez que entre un cliente nuevo.",
      icon: "/icon-192.png",
    });
  } catch { /* nada */ }
  return "activado";
}

export async function desactivarPush(userId: string): Promise<EstadoPush> {
  try { localStorage.setItem("oy_push_off", "1"); } catch { /* nada */ }
  let endpoint: string | null = null;
  try {
    const reg = await swListo();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) { endpoint = sub.endpoint; await sub.unsubscribe(); }
  } catch { /* nada */ }
  await db.rpc("oy_push_desactivar", { p_user: userId, p_endpoint: endpoint });
  return "desactivado";
}

// Manda un aviso real desde el servidor, para comprobar que llega con el móvil bloqueado
export async function probarPush(userId: string): Promise<boolean> {
  try {
    const r = await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, title: "Aviso de prueba", body: "Así te llegarán los clientes nuevos.", url: "/" }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
