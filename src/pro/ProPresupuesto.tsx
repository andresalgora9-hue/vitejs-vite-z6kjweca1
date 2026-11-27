// ============================================================
// OficioYa · Panel PROFESIONAL — «Crear presupuesto» (pintura)
// Desde la tarjeta de un cliente (Inicio y Leads) se abre un asistente que va
// preguntando lo necesario para un presupuesto de pintura muy detallado y genera
// un PDF con el logo del profesional, listo para mandarlo por WhatsApp.
// Al enviarlo, el cliente pasa solo a «Presupuesto enviado» con el importe.
// Tablas: pro_presupuestos y pro_presupuesto_marca (supabase/presupuestos_pintura.sql).
// Si aún no existen, funciona igual guardando en el móvil.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, STORAGE_URL } from "../supabase";
import { C, F } from "./proComun";
import {
  Marca, Presupuesto, Partida, Unidad, TRABAJOS, TRABAJO, ESTANCIAS, INMUEBLES, ESTADOS_PARED, PREPARACION,
  NO_INCLUYE, MARCAS_PINTURA, TIPOS_PINTURA, ACABADOS, COLORES, FORMAS_PAGO, METODOS_PAGO, GARANTIAS,
  COLORES_MARCA, presupuestoVacio, marcaVacia, totales, euros, cifra, aNumero, uid, tituloPartida,
  detallePartida, tramosPago, plazoTxt, esPintor,
} from "./presupuestoDatos";
import { generarPresupuestoPdf, hexARgb } from "./presupuestoPdf";

export { esPintor };

// ── LEAD MÍNIMO QUE NECESITA ────────────────────────────────
export interface LeadPresu {
  id: string;
  trade?: string | null;
  estado?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  direccion?: string | null;
  zona?: string | null;
  descripcion?: string | null;
}
export interface ResumenPresu { id: string; numero: string; total: number }

// ── GUARDADO EN EL MÓVIL (si las tablas aún no están) ───────
const lsClave = (u: string) => "oy_presu_" + u;
function lsLeer(u: string): { seq: Record<string, number>; marca: Marca | null; porLead: Record<string, Presupuesto> } {
  try { const v = JSON.parse(localStorage.getItem(lsClave(u)) || "null"); if (v) return { seq: {}, marca: null, porLead: {}, ...v }; } catch { /* nada */ }
  return { seq: {}, marca: null, porLead: {} };
}
function lsPoner(u: string, v: ReturnType<typeof lsLeer>) { try { localStorage.setItem(lsClave(u), JSON.stringify(v)); } catch { /* nada */ } }

// Presupuestos hechos, por cliente (para el botón de la tarjeta)
export function usePresupuestosPorLead(userId: string, aviso = 0) {
  const [mapa, setMapa] = useState<Record<string, ResumenPresu>>({});
  const cargar = useCallback(async () => {
    const out: Record<string, ResumenPresu> = {};
    const loc = lsLeer(userId).porLead;
    Object.entries(loc).forEach(([lid, p]) => { out[lid] = { id: p.id || "", numero: p.numero, total: totales(p).total }; });
    const { data, error } = await db.from("pro_presupuestos").select("id,lead_id,numero,total,created_at")
      .eq("pro_id", userId).not("lead_id", "is", null).order("created_at", { ascending: true });
    if (!error) (data || []).forEach((r: any) => { out[r.lead_id] = { id: r.id, numero: r.numero, total: Number(r.total || 0) }; });
    setMapa(out);
  }, [userId]);
  useEffect(() => { cargar(); }, [cargar, aviso]);
  return { mapa, recargar: cargar };
}

// ── EL «CUADRADITO» DE LA TARJETA ───────────────────────────
const IconoDoc = ({ s = 20, color = "currentColor" }: { s?: number; color?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3.5H7.2a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V8.3z" />
    <path d="M14 3.5v4.8h4.8" />
    <path d="M8.8 12.6h6.4M8.8 16h4" />
  </svg>
);

export function BotonPresupuesto({ hecho, onClick, ancho = 80 }: { hecho?: ResumenPresu | null; onClick: () => void; ancho?: number }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={hecho ? "Ver presupuesto " + hecho.numero : "Crear presupuesto"}
      style={{
        width: ancho, minHeight: 66, flexShrink: 0, borderRadius: 12, cursor: "pointer", fontFamily: F,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: "8px 4px",
        border: "1px solid " + (hecho ? C.green + "88" : C.accent + "88"),
        background: hecho
          ? "linear-gradient(160deg, rgba(0,214,143,0.16), rgba(0,214,143,0.05))"
          : "linear-gradient(160deg, rgba(255,215,0,0.18), rgba(255,140,0,0.07))",
        color: hecho ? C.green : C.accent, boxShadow: "0 6px 16px -10px " + (hecho ? C.green : C.accent),
      }}>
      <IconoDoc s={20} />
      <span style={{ fontSize: 10.5, fontWeight: 800, lineHeight: 1.15, textAlign: "center" }}>
        {hecho ? <>Ver<br />presupuesto</> : <>Crear<br />presupuesto</>}
      </span>
      {hecho && hecho.total > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.mutedL }}>{euros(hecho.total, 0)}</span>}
    </button>
  );
}

// ── PIEZAS DE INTERFAZ ──────────────────────────────────────
function useZonaVisible(): { top: number; height: number } | null {
  const [zona, setZona] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv: any = (window as any).visualViewport;
    if (!vv || typeof vv.addEventListener !== "function") return;
    const medir = () => {
      const conZoom = Math.abs((vv.scale || 1) - 1) > 0.01;
      const tapado = window.innerHeight - vv.height;
      const nueva = !conZoom && tapado > 120 ? { top: Math.max(0, Math.round(vv.offsetTop || 0)), height: Math.round(vv.height) } : null;
      setZona((a) => (a?.top === nueva?.top && a?.height === nueva?.height ? a : nueva));
    };
    medir();
    vv.addEventListener("resize", medir); vv.addEventListener("scroll", medir);
    return () => { vv.removeEventListener("resize", medir); vv.removeEventListener("scroll", medir); };
  }, []);
  return zona;
}

const inputBase: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 12px", background: C.bg,
  border: "1px solid " + C.border, borderRadius: 10, color: C.text, fontSize: 16, fontFamily: F, outline: "none",
};

function Campo({ label, value, onChange, placeholder = "", multilinea = false, inputMode, type = "text", ayuda, sufijo }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 12.5, color: C.mutedL, marginBottom: 6, fontWeight: 700 }}>{label}</label>}
      <div style={{ position: "relative" }}>
        {multilinea
          ? <textarea value={value} placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} style={{ ...inputBase, resize: "vertical", lineHeight: 1.4 }} />
          : <input type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
              style={{ ...inputBase, paddingRight: sufijo ? 52 : 12 }} />}
        {sufijo && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 14, fontWeight: 700, pointerEvents: "none" }}>{sufijo}</span>}
      </div>
      {ayuda && <div style={{ fontSize: 12, color: C.muted, marginTop: 5, lineHeight: 1.4 }}>{ayuda}</div>}
    </div>
  );
}

function Chip({ act, onClick, children, color = C.accent, grande = false }: any) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!act} style={{
      padding: grande ? "12px 12px" : "9px 13px", borderRadius: 10, cursor: "pointer", fontFamily: F,
      fontSize: 13.5, fontWeight: 700, textAlign: "left", display: "flex", alignItems: "center", gap: 8,
      background: act ? color + "22" : "transparent", border: "1px solid " + (act ? color : C.border),
      color: act ? (color === C.accent ? C.accent : C.text) : C.mutedL, transition: "all .15s",
    }}>{children}</button>
  );
}

function Pregunta({ titulo, ayuda, children }: any) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: ayuda ? 3 : 10 }}>{titulo}</div>
      {ayuda && <div style={{ color: C.muted, fontSize: 12.5, marginBottom: 10, lineHeight: 1.4 }}>{ayuda}</div>}
      {children}
    </div>
  );
}

const Fila = ({ children, gap = 8 }: any) => <div style={{ display: "flex", flexWrap: "wrap", gap }}>{children}</div>;

function Interruptor({ on, onClick, texto, detalle }: { on: boolean; onClick: () => void; texto: string; detalle?: string }) {
  return (
    <button type="button" onClick={onClick} role="switch" aria-checked={on} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", fontFamily: F, cursor: "pointer",
      background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "12px 14px", marginBottom: 8,
    }}>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", color: C.text, fontWeight: 700, fontSize: 14 }}>{texto}</span>
        {detalle && <span style={{ display: "block", color: C.muted, fontSize: 12, marginTop: 2 }}>{detalle}</span>}
      </span>
      <span style={{ width: 46, height: 26, borderRadius: 99, background: on ? C.green : C.border, position: "relative", flexShrink: 0, transition: "background .2s" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
      </span>
    </button>
  );
}

function Contador({ n, onChange }: { n: number; onChange: (n: number) => void }) {
  const b: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: "1px solid " + C.border, background: C.bg, color: C.text, fontSize: 17, fontWeight: 800, cursor: "pointer", lineHeight: 1 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Menos" style={b} onClick={() => onChange(Math.max(0, n - 1))}>−</button>
      <span style={{ minWidth: 14, textAlign: "center", color: C.text, fontWeight: 800 }}>{n}</span>
      <button type="button" aria-label="Más" style={b} onClick={() => onChange(Math.min(12, n + 1))}>+</button>
    </span>
  );
}

const Check = ({ on }: { on: boolean }) => (
  <span style={{
    width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "2px solid " + (on ? C.green : C.muted), background: on ? C.green : "transparent",
  }}>
    {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.2 4.2L19 7" /></svg>}
  </span>
);

function FilaCheck({ on, onClick, texto }: { on: boolean; onClick: () => void; texto: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", fontFamily: F, cursor: "pointer",
      background: on ? C.green + "10" : "transparent", border: "1px solid " + (on ? C.green + "66" : C.border),
      borderRadius: 10, padding: "11px 12px", marginBottom: 7, color: on ? C.text : C.mutedL, fontSize: 13.5, fontWeight: 600,
    }}><Check on={on} />{texto}</button>
  );
}

// ── LOGO: reducir, mantener la transparencia y sacar el color ──
function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => rej(new Error("imagen"));
    img.src = url;
  });
}
function colorDominante(cv: HTMLCanvasElement): string | null {
  try {
    const k = Math.min(1, 80 / Math.max(cv.width, cv.height));
    const c2 = document.createElement("canvas");
    c2.width = Math.max(1, Math.round(cv.width * k)); c2.height = Math.max(1, Math.round(cv.height * k));
    const ctx = c2.getContext("2d"); if (!ctx) return null;
    ctx.drawImage(cv, 0, 0, c2.width, c2.height);
    const d = ctx.getImageData(0, 0, c2.width, c2.height).data;
    const cubos: { n: number; r: number; g: number; b: number }[] = Array.from({ length: 24 }, () => ({ n: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
      const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
      if (s < 0.3 || l > 0.93 || l < 0.15) continue;
      let h = 0;
      if (max === r) h = ((g - b) / (max - min)) % 6; else if (max === g) h = (b - r) / (max - min) + 2; else h = (r - g) / (max - min) + 4;
      const cubo = cubos[Math.floor((((h * 60) + 360) % 360) / 15)];
      const peso = s; // manda el color que más superficie ocupa
      cubo.n += peso; cubo.r += d[i] * peso; cubo.g += d[i + 1] * peso; cubo.b += d[i + 2] * peso;
    }
    const mejor = cubos.reduce((a, b) => (b.n > a.n ? b : a));
    if (mejor.n < 3) return null;
    // Mismo tono que el logo, pero con fuerza y oscuro para que el texto blanco se lea encima
    const r = mejor.r / mejor.n / 255, g = mejor.g / mejor.n / 255, b = mejor.b / mejor.n / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, dd = max - min;
    const s = dd === 0 ? 0 : dd / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (dd) h = max === r ? ((g - b) / dd) % 6 : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
    h = (h * 60 + 360) % 360;
    const s2 = Math.min(0.85, Math.max(0.55, s)), l2 = Math.min(0.42, Math.max(0.25, l));
    const c = (1 - Math.abs(2 * l2 - 1)) * s2, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l2 - c / 2;
    const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return "#" + [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}
async function prepararLogo(file: File): Promise<{ blob: Blob; color: string | null }> {
  const img = await cargarImagen(file);
  const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const color = colorDominante(cv);
  const blob: Blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
  return { blob, color };
}

// ── PASOS ───────────────────────────────────────────────────
const PASOS = [
  { id: "marca", titulo: "Tu marca", sub: "Sale en la cabecera de todos tus presupuestos" },
  { id: "cliente", titulo: "Cliente y vivienda", sub: "¿Para quién es y cómo es la vivienda?" },
  { id: "trabajos", titulo: "¿Qué hay que hacer?", sub: "Marca los trabajos y pon medidas y precio" },
  { id: "estado", titulo: "Estado y preparación", sub: "Lo que encontraste y lo que incluyes" },
  { id: "materiales", titulo: "Materiales", sub: "Qué pintura vas a poner" },
  { id: "precio", titulo: "Precio", sub: "Repasa el desglose, descuento e IVA" },
  { id: "condiciones", titulo: "Plazo y pago", sub: "Cuándo, cómo se paga y garantía" },
  { id: "listo", titulo: "Presupuesto listo", sub: "Envíalo al cliente" },
] as const;
type PasoId = typeof PASOS[number]["id"];

// Al empezar uno nuevo, se copian sus ajustes de siempre del último presupuesto
function ajustesDe(prev: Presupuesto | null, base: Presupuesto): Presupuesto {
  if (!prev) return base;
  return {
    ...base,
    validez_dias: prev.validez_dias || base.validez_dias,
    preparacion: prev.preparacion?.length ? prev.preparacion : base.preparacion,
    materiales: { ...base.materiales, ...prev.materiales, colores: "blanco", colores_txt: "" },
    iva_pct: prev.iva_pct ?? base.iva_pct,
    pago: prev.pago || base.pago,
    pago_txt: prev.pago_txt || "",
    metodos: prev.metodos?.length ? prev.metodos : base.metodos,
    garantia: prev.garantia || base.garantia,
    no_incluye: prev.no_incluye?.length ? prev.no_incluye : base.no_incluye,
  };
}

// ── ASISTENTE ───────────────────────────────────────────────
export default function ProPresupuesto({ userId, lead, onClose, onCambio, onToast }: {
  userId: string;
  lead: LeadPresu;
  onClose: () => void;
  onCambio?: () => void;
  onToast?: (m: string) => void;
}) {
  const zona = useZonaVisible();
  const cuerpo = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [cargando, setCargando] = useState(true);
  const [paso, setPaso] = useState<PasoId>("cliente");
  const [marca, setMarca] = useState<Marca>(marcaVacia());
  const [p, setP] = useState<Presupuesto>(presupuestoVacio(lead));
  const [txt, setTxt] = useState<Record<string, string>>({});   // lo que escribe en cantidades y precios
  const [descTxt, setDescTxt] = useState("");
  const [err, setErr] = useState("");
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [enBD, setEnBD] = useState(true);                       // false: tablas aún no creadas → guarda en el móvil
  const [pdf, setPdf] = useState<{ blob: Blob; nombre: string; url: string } | null>(null);
  const [generando, setGenerando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [marcaOtra, setMarcaOtra] = useState(false);
  const leadEstado = useRef(lead.estado || "");

  // ── Carga: marca, presupuesto de este cliente (si ya hay) y datos del lead ──
  useEffect(() => {
    let vivo = true;
    (async () => {
      const loc = lsLeer(userId);
      const [rUser, rLead, rMarca, rPresu, rUltimo] = await Promise.all([
        db.from("users").select("name,company_name,cif,phone,whatsapp,email,billing_email,fiscal_address,fiscal_zip,fiscal_city").eq("id", userId).maybeSingle(),
        db.from("pro_leads").select("id,estado,client_name,client_phone,client_email,direccion,zona,descripcion").eq("id", lead.id).maybeSingle(),
        db.from("pro_presupuesto_marca").select("datos").eq("pro_id", userId).maybeSingle(),
        db.from("pro_presupuestos").select("id,numero,datos").eq("pro_id", userId).eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(1),
        db.from("pro_presupuestos").select("datos").eq("pro_id", userId).order("created_at", { ascending: false }).limit(1),
      ]);
      if (!vivo) return;
      const sinTablas = !!(rMarca.error || rPresu.error);
      setEnBD(!sinTablas);

      const l = { ...lead, ...((rLead.data as any) || {}) };
      leadEstado.current = l.estado || lead.estado || "";
      const m0 = marcaVacia(rUser.data as any);
      const guardada: Marca | null = (rMarca.data as any)?.datos?.nombre ? (rMarca.data as any).datos : loc.marca;
      const m = guardada ? { ...m0, ...guardada } : m0;
      setMarca(m);

      let pres: Presupuesto | null = null;
      const fila = (rPresu.data as any[])?.[0];
      if (fila) pres = { ...presupuestoVacio(l), ...fila.datos, id: fila.id, numero: fila.numero, lead_id: lead.id };
      else if (loc.porLead[lead.id]) pres = loc.porLead[lead.id];
      let inicial: Presupuesto;
      if (pres) {
        // Ya tiene presupuesto: se abre listo para enviarlo otra vez (o cambiar algo)
        inicial = pres;
        const t: Record<string, string> = {};
        pres.partidas.forEach((x) => { t[x.id + ":c"] = x.cantidad ? cifra(x.cantidad) : ""; t[x.id + ":p"] = x.precio ? cifra(x.precio) : ""; });
        setTxt(t);
        setDescTxt(pres.descuento_pct ? cifra(pres.descuento_pct) : "");
        setPaso("listo");
      } else {
        const ultimo: Presupuesto | null = (rUltimo.data as any[])?.[0]?.datos || Object.values(loc.porLead).slice(-1)[0] || null;
        inicial = ajustesDe(ultimo, presupuestoVacio(l));
        setPaso(guardada ? "cliente" : "marca");
      }
      setP(inicial);
      const mk = inicial.materiales?.marca || "";
      setMarcaOtra(!!mk && !MARCAS_PINTURA.includes(mk));
      setCargando(false);
      if (pres) prepararPdf(pres, m);
    })();
    return () => { vivo = false; };
  }, [userId, lead.id]);

  useEffect(() => { cuerpo.current?.scrollTo({ top: 0 }); setErr(""); }, [paso]);
  useEffect(() => () => { if (pdf?.url) URL.revokeObjectURL(pdf.url); }, [pdf]);

  // ── Ayudantes de estado ──
  const upd = (cambios: Partial<Presupuesto>) => { setP((x) => ({ ...x, ...cambios })); setPdf(null); setErr(""); };
  const updCliente = (k: keyof Presupuesto["cliente"], v: string) => upd({ cliente: { ...p.cliente, [k]: v } });
  const updObra = (k: keyof Presupuesto["obra"], v: any) => upd({ obra: { ...p.obra, [k]: v } });
  const updMat = (k: keyof Presupuesto["materiales"], v: any) => upd({ materiales: { ...p.materiales, [k]: v } });
  const alternar = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  const updMarca = (k: keyof Marca, v: any) => { setMarca((m) => ({ ...m, [k]: v })); setPdf(null); setErr(""); };

  const t = useMemo(() => totales(p), [p]);
  const m2Vivienda = aNumero(p.obra.m2_vivienda);

  const partidaDe = (tipo: string) => p.partidas.find((x) => x.tipo === tipo);
  const alternarTrabajo = (tipo: string) => {
    const ya = partidaDe(tipo);
    if (ya) { upd({ partidas: p.partidas.filter((x) => x.id !== ya.id) }); return; }
    const tt = TRABAJO[tipo];
    const precio = Number(marca.precios?.[tipo] || 0);
    const id = uid();
    let cantidad = tt.unidad === "global" ? 1 : 0;
    if (m2Vivienda > 0 && tipo === "paredes") cantidad = Math.round(m2Vivienda * 2.8);
    if (m2Vivienda > 0 && tipo === "techos") cantidad = Math.round(m2Vivienda);
    setTxt((x) => ({ ...x, [id + ":c"]: cantidad && tt.unidad !== "global" ? String(cantidad) : "", [id + ":p"]: precio ? cifra(precio) : "" }));
    upd({ partidas: [...p.partidas, { id, tipo, titulo: "", detalle: "", cantidad, unidad: tt.unidad, precio }] });
  };
  const anadirOtro = () => {
    const id = uid();
    setTxt((x) => ({ ...x, [id + ":c"]: "1", [id + ":p"]: "" }));
    upd({ partidas: [...p.partidas, { id, tipo: "otro", titulo: "", detalle: "", cantidad: 1, unidad: "global", precio: 0 }] });
  };
  const updPartida = (id: string, cambios: Partial<Partida>) => upd({ partidas: p.partidas.map((x) => (x.id === id ? { ...x, ...cambios } : x)) });
  const escribir = (id: string, campo: "c" | "p", v: string) => {
    setTxt((x) => ({ ...x, [id + ":" + campo]: v }));
    const n = aNumero(v);
    updPartida(id, campo === "c" ? { cantidad: isNaN(n) ? 0 : n } : { precio: isNaN(n) ? 0 : n });
  };
  const quitarPartida = (id: string) => upd({ partidas: p.partidas.filter((x) => x.id !== id) });

  // ── Logo ──
  const subirLogo = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 12 * 1024 * 1024) { setErr("El logo pesa demasiado (máx. 12 MB)."); return; }
    setSubiendoLogo(true); setErr("");
    try {
      const { blob, color } = await prepararLogo(f);
      const ruta = "logos/" + userId + "/" + Date.now() + ".png";
      const { error } = await db.storage.from("photos").upload(ruta, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      setMarca((m) => ({ ...m, logo_url: STORAGE_URL + ruta, color: color || m.color }));
      setPdf(null);
      onToast?.(color ? "Logo subido. Hemos puesto el color de tu logo." : "Logo subido");
    } catch {
      setErr("No se ha podido subir el logo. Prueba con otra imagen (JPG o PNG).");
    }
    setSubiendoLogo(false);
  };

  const guardarMarca = async (m: Marca) => {
    const loc = lsLeer(userId); loc.marca = m; lsPoner(userId, loc);
    if (!enBD) return;
    await db.from("pro_presupuesto_marca").upsert({ pro_id: userId, datos: m, updated_at: new Date().toISOString() }, { onConflict: "pro_id" });
  };

  // ── Guardar el presupuesto (al llegar al último paso) ──
  const guardar = async (): Promise<Presupuesto> => {
    const precios = { ...(marca.precios || {}) };
    p.partidas.forEach((x) => { if (x.tipo !== "otro" && x.precio > 0) precios[x.tipo] = x.precio; });
    const m = { ...marca, precios };
    setMarca(m);
    guardarMarca(m);

    let final: Presupuesto = { ...p };
    const datos: any = { ...final }; delete datos.id;
    let ok = false;
    if (enBD) {
      const fila = { pro_id: userId, lead_id: lead.id, datos, base: t.base, iva: t.iva, total: t.total };
      const r = p.id
        ? await db.from("pro_presupuestos").update(fila).eq("id", p.id).select("id,numero").maybeSingle()
        : await db.from("pro_presupuestos").insert(fila).select("id,numero").single();
      if (!r.error && r.data) { final = { ...final, id: (r.data as any).id, numero: (r.data as any).numero }; ok = true; }
    }
    if (!ok) {
      // Sin tablas: número correlativo guardado en el móvil
      const loc = lsLeer(userId);
      if (!final.numero) {
        const anio = final.fecha.slice(0, 4);
        loc.seq[anio] = (loc.seq[anio] || 0) + 1;
        final.numero = "P-" + anio + "-" + String(loc.seq[anio]).padStart(3, "0");
      }
      loc.porLead[lead.id] = final;
      lsPoner(userId, loc);
    } else {
      const loc = lsLeer(userId);
      if (loc.porLead[lead.id]) { delete loc.porLead[lead.id]; lsPoner(userId, loc); }
    }
    setP(final);
    return final;
  };

  const prepararPdf = async (pp: Presupuesto, mm: Marca) => {
    setGenerando(true);
    try {
      const r = await generarPresupuestoPdf(pp, mm);
      setPdf((viejo) => { if (viejo?.url) URL.revokeObjectURL(viejo.url); return { ...r, url: URL.createObjectURL(r.blob) }; });
    } catch {
      setErr("No se ha podido crear el PDF. Revisa tu conexión e inténtalo de nuevo.");
    }
    setGenerando(false);
  };

  // Al enviarlo/descargarlo: el cliente pasa a «Presupuesto enviado» con el importe
  const marcarEnviado = async () => {
    if (enviado) return;
    setEnviado(true);
    if (p.id && enBD) db.from("pro_presupuestos").update({ enviado_at: new Date().toISOString() }).eq("id", p.id).then(() => {});
    const est = leadEstado.current;
    if (est === "ganado" || est === "perdido") { onCambio?.(); return; }
    const { error } = await db.from("pro_leads").update({ estado: "presupuesto", presupuesto_eur: t.total }).eq("id", lead.id).eq("pro_id", userId);
    if (!error) {
      leadEstado.current = "presupuesto";
      onToast?.("Cliente pasado a «Presupuesto enviado» · " + euros(t.total, 0));
    }
    onCambio?.();
  };

  const compartir = async () => {
    if (!pdf) return;
    const nombre = (p.cliente.nombre || "").split(" ")[0];
    const texto = "Hola" + (nombre ? " " + nombre : "") + ", te envío el presupuesto " + p.numero + " de " + (marca.nombre || "los trabajos de pintura")
      + ". Cualquier duda me dices. Un saludo.";
    const archivo = new File([pdf.blob], pdf.nombre, { type: "application/pdf" });
    const nav: any = navigator;
    if (nav.canShare && nav.canShare({ files: [archivo] })) {
      try {
        await nav.share({ files: [archivo], title: "Presupuesto " + p.numero, text: texto });
        marcarEnviado();
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    // Sin compartir archivos (ordenador): se descarga y se abre WhatsApp con el mensaje
    descargar();
    const tel = (p.cliente.telefono || "").replace(/[^0-9]/g, "");
    const d = tel.length === 9 ? "34" + tel : tel;
    window.open("https://wa.me/" + d + "?text=" + encodeURIComponent(texto + " (Te lo adjunto aquí.)"), "_blank");
  };

  const descargar = () => {
    if (!pdf) return;
    const a = document.createElement("a");
    a.href = pdf.url; a.download = pdf.nombre; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    marcarEnviado();
  };
  const ver = () => { if (pdf) window.open(pdf.url, "_blank"); };

  // ── Navegación ──
  const orden = PASOS.map((x) => x.id) as PasoId[];
  const i = orden.indexOf(paso);
  const validar = (): string => {
    if (paso === "marca") {
      if (!marca.nombre.trim()) return "Pon el nombre de tu empresa o el tuyo.";
      if (!marca.telefono.trim()) return "Pon tu teléfono: el cliente tiene que poder llamarte.";
    }
    if (paso === "cliente" && !p.cliente.nombre.trim()) return "Pon el nombre del cliente.";
    if (paso === "trabajos") {
      if (!p.partidas.length) return "Marca al menos un trabajo.";
      for (const x of p.partidas) {
        const nom = tituloPartida(x);
        if (x.tipo === "otro" && !x.titulo.trim()) return "Ponle nombre al trabajo que has añadido.";
        if (x.unidad !== "global" && !(x.cantidad > 0)) return "Falta la medida de «" + nom + "».";
        if (!(x.precio > 0)) return "Falta el precio de «" + nom + "».";
      }
    }
    if (paso === "precio") {
      const d = aNumero(descTxt || "0");
      if (isNaN(d) || d < 0 || d >= 100) return "El descuento tiene que ser un porcentaje entre 0 y 99.";
    }
    return "";
  };
  const siguiente = async () => {
    const e = validar();
    if (e) { setErr(e); return; }
    if (paso === "marca") guardarMarca(marca);
    const sig = orden[i + 1];
    if (sig === "listo") {
      setGenerando(true);
      const final = await guardar();
      setPaso("listo");
      await prepararPdf(final, { ...marca });
      return;
    }
    setPaso(sig);
  };
  const atras = () => { if (i > 0) setPaso(orden[i - 1]); };

  const pasoInfo = PASOS[i];
  const nPasos = PASOS.length - 2; // sin «marca» ni «listo»
  const nActual = Math.max(0, i);  // cliente = 1

  // ════════════════════════════════════════════════════════
  // PANTALLAS
  const pantallaMarca = (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, marginBottom: 18,
        background: "linear-gradient(120deg," + marca.color + "," + marca.color + "AA)", boxShadow: "0 10px 26px -14px " + marca.color,
      }}>
        <button type="button" onClick={() => logoRef.current?.click()} aria-label="Subir logo" style={{
          width: 72, height: 72, borderRadius: 14, background: "#fff", border: "none", cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 6, boxShadow: "0 6px 16px -6px rgba(0,0,0,.45)",
        }}>
          {subiendoLogo ? <span style={{ fontSize: 11, color: "#555", fontWeight: 700 }}>Subiendo…</span>
            : marca.logo_url ? <img src={marca.logo_url} alt="Tu logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            : <span style={{ fontSize: 11, color: "#555", fontWeight: 800, lineHeight: 1.2, textAlign: "center" }}>＋<br />Tu logo</span>}
        </button>
        <div style={{ minWidth: 0, color: luzHex(marca.color) > 0.72 ? "#111" : "#fff" }}>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: "0.02em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis" }}>{marca.nombre || "Tu empresa"}</div>
          {marca.lema && <div style={{ fontSize: 12, fontStyle: "italic", opacity: 0.9, marginTop: 2 }}>{marca.lema}</div>}
          <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 4 }}>{[marca.telefono, marca.email].filter(Boolean).join(" · ") || "Así se verá la cabecera"}</div>
        </div>
      </div>
      <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { subirLogo(e.target.files?.[0]); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <BotonLinea onClick={() => logoRef.current?.click()}>{marca.logo_url ? "Cambiar logo" : "Subir mi logo"}</BotonLinea>
        {marca.logo_url && <BotonLinea onClick={() => updMarca("logo_url", null)} color={C.muted}>Quitar logo</BotonLinea>}
      </div>
      <Campo label="Nombre de tu empresa (como quieres que salga)" value={marca.nombre} onChange={(v: string) => updMarca("nombre", v)} placeholder="Ej. Reforma Zelaya" />
      <Campo label="Razón social (opcional)" value={marca.razon} onChange={(v: string) => updMarca("razon", v)} placeholder="Ej. Reformas Zelaya, S.L." />
      <Campo label="NIF / CIF" value={marca.nif} onChange={(v: string) => updMarca("nif", v.toUpperCase())} placeholder="Ej. B12345678" />
      <Campo label="Teléfono" value={marca.telefono} onChange={(v: string) => updMarca("telefono", v)} type="tel" inputMode="tel" placeholder="600 000 000" />
      <Campo label="Email" value={marca.email} onChange={(v: string) => updMarca("email", v)} type="email" placeholder="tucorreo@gmail.com" />
      <Campo label="Dirección (opcional)" value={marca.direccion} onChange={(v: string) => updMarca("direccion", v)} placeholder="Calle, número, CP y ciudad" />
      <Campo label="Web o Instagram (opcional)" value={marca.web} onChange={(v: string) => updMarca("web", v)} placeholder="Ej. instagram.com/reformazelaya" />
      <Campo label="Frase (opcional)" value={marca.lema} onChange={(v: string) => updMarca("lema", v)} placeholder="Ej. Su proyecto en buenas manos." />
      <Pregunta titulo="Color de tu presupuesto" ayuda={marca.logo_url ? "Al subir el logo cogemos su color. Puedes cambiarlo." : undefined}>
        <Fila gap={10}>
          {COLORES_MARCA.map((c) => (
            <button key={c.hex} type="button" onClick={() => updMarca("color", c.hex)} aria-label={c.label} style={{
              width: 40, height: 40, borderRadius: 12, background: c.hex, cursor: "pointer",
              border: marca.color.toLowerCase() === c.hex.toLowerCase() ? "3px solid #fff" : "2px solid transparent",
              boxShadow: marca.color.toLowerCase() === c.hex.toLowerCase() ? "0 0 0 2px " + c.hex : "none",
            }} />
          ))}
          {!COLORES_MARCA.some((c) => c.hex.toLowerCase() === marca.color.toLowerCase()) && (
            <span title="Color de tu logo" style={{ width: 40, height: 40, borderRadius: 12, background: marca.color, border: "3px solid #fff", boxShadow: "0 0 0 2px " + marca.color }} />
          )}
        </Fila>
      </Pregunta>
    </>
  );

  const pantallaCliente = (
    <>
      <Campo label="Nombre del cliente" value={p.cliente.nombre} onChange={(v: string) => updCliente("nombre", v)} placeholder="Ej. Pepe García" />
      <Campo label="Teléfono" value={p.cliente.telefono} onChange={(v: string) => updCliente("telefono", v)} type="tel" inputMode="tel" placeholder="600 000 000" />
      <Campo label="Dirección de la obra" value={p.cliente.direccion} onChange={(v: string) => updCliente("direccion", v)} placeholder="Ej. Calle Rincón n.º 7" />
      <Campo label="Población" value={p.cliente.poblacion} onChange={(v: string) => updCliente("poblacion", v)} placeholder="Ej. El Puig de Santa María" />
      <Campo label="Email (opcional)" value={p.cliente.email} onChange={(v: string) => updCliente("email", v)} type="email" placeholder="Opcional" />
      {lead.descripcion && (
        <div style={{ fontSize: 12.5, color: C.mutedL, background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "10px 12px", margin: "4px 0 18px", lineHeight: 1.45 }}>
          <b style={{ color: C.text }}>Lo que pidió:</b> {lead.descripcion}
        </div>
      )}
      <Pregunta titulo="¿Qué es?">
        <Fila>{INMUEBLES.map((x) => <Chip key={x} act={p.obra.inmueble === x} onClick={() => updObra("inmueble", x)}>{x}</Chip>)}</Fila>
      </Pregunta>
      <Pregunta titulo="¿Qué estancias se pintan?" ayuda="Salen en el presupuesto para que el cliente vea que lo tienes todo controlado.">
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {ESTANCIAS.map((e) => {
            const n = p.obra.estancias[e.id] || 0;
            const set = (v: number) => updObra("estancias", { ...p.obra.estancias, [e.id]: v });
            return (
              <div key={e.id} role="button" tabIndex={0} onClick={() => !e.contable && set(n ? 0 : 1)} onKeyDown={(k) => { if (k.key === "Enter" && !e.contable) set(n ? 0 : 1); }} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: e.contable ? "default" : "pointer",
                border: "1px solid " + (n ? C.accent + "99" : C.border), background: n ? C.accent + "12" : "transparent",
              }}>
                {!e.contable && <Check on={!!n} />}
                <span style={{ flex: 1, color: n ? C.text : C.mutedL, fontSize: 14, fontWeight: 700 }}>{e.label}</span>
                {e.contable && <Contador n={n} onChange={set} />}
              </div>
            );
          })}
        </div>
      </Pregunta>
      <Campo label="m² de la vivienda (opcional)" value={p.obra.m2_vivienda} onChange={(v: string) => updObra("m2_vivienda", v)} inputMode="decimal" placeholder="Ej. 90" sufijo="m²"
        ayuda="Si lo pones, te calculamos los m² de paredes y techos en el siguiente paso." />
      <Pregunta titulo="¿Cómo estará la vivienda?">
        <Fila>
          {[["vacia", "Vacía"], ["amueblada", "Con muebles"], ["habitada", "Habitada durante la obra"]].map(([id, l]) => (
            <Chip key={id} act={p.obra.ocupacion === id} onClick={() => updObra("ocupacion", id)}>{l}</Chip>
          ))}
        </Fila>
      </Pregunta>
    </>
  );

  const pantallaTrabajos = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
        {TRABAJOS.map((tt) => {
          const act = !!partidaDe(tt.id);
          return (
            <button key={tt.id} type="button" onClick={() => alternarTrabajo(tt.id)} aria-pressed={act} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 10px", borderRadius: 12, cursor: "pointer", fontFamily: F, textAlign: "left",
              border: "1px solid " + (act ? C.accent : C.border), background: act ? C.accent + "18" : C.card,
              color: act ? C.text : C.mutedL, fontSize: 13, fontWeight: 700, minHeight: 50,
            }}>
              <span style={{ fontSize: 17 }} aria-hidden>{tt.icono}</span>
              <span style={{ flex: 1, lineHeight: 1.2 }}>{tt.label}</span>
              {act && <Check on />}
            </button>
          );
        })}
      </div>

      {p.partidas.map((x) => {
        const tt = TRABAJO[x.tipo];
        const global = x.unidad === "global";
        const importe = (global ? 1 : x.cantidad) * x.precio;
        const sugerido = tt && m2Vivienda > 0 && (x.tipo === "paredes" || x.tipo === "techos")
          ? Math.round(m2Vivienda * (x.tipo === "paredes" ? 2.8 : 1)) : 0;
        return (
          <div key={x.id} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }} aria-hidden>{tt?.icono || "🛠️"}</span>
              <span style={{ flex: 1, color: C.text, fontWeight: 800, fontSize: 14.5 }}>{tt ? tt.titulo : "Otro trabajo"}</span>
              <button type="button" onClick={() => quitarPartida(x.id)} aria-label="Quitar" style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            {x.tipo === "otro" && (
              <>
                <Campo label="Nombre del trabajo" value={x.titulo} onChange={(v: string) => updPartida(x.id, { titulo: v })} placeholder="Ej. Regatas para subir enchufes" />
                <Campo label="Explícalo con detalle (lo verá el cliente)" value={x.detalle} onChange={(v: string) => updPartida(x.id, { detalle: v })} multilinea
                  placeholder="Ej. Dos regatas de 5 metros para empotrar y subir las tomas de corriente a 30 cm" />
                <Fila gap={6}>
                  {(["global", "m²", "ml", "ud"] as Unidad[]).map((u) => (
                    <Chip key={u} act={x.unidad === u} onClick={() => updPartida(x.id, { unidad: u, cantidad: u === "global" ? 1 : x.cantidad })}>
                      {u === "global" ? "Precio cerrado" : u === "ud" ? "Por unidad" : "Por " + u}
                    </Chip>
                  ))}
                </Fila>
                <div style={{ height: 12 }} />
              </>
            )}
            <div style={{ display: "grid", gridTemplateColumns: global ? "1fr" : "1fr 1fr", gap: 10 }}>
              {!global && (
                <Campo label={tt?.pregunta || "Cantidad"} value={txt[x.id + ":c"] ?? ""} onChange={(v: string) => escribir(x.id, "c", v)} inputMode="decimal" placeholder="0" sufijo={x.unidad} />
              )}
              <Campo label={global ? "Precio de este trabajo" : "Precio por " + x.unidad} value={txt[x.id + ":p"] ?? ""} onChange={(v: string) => escribir(x.id, "p", v)}
                inputMode="decimal" placeholder={tt ? "Ej. " + cifra(tt.ejemplo) : "Ej. 200"} sufijo={global ? "€" : "€/" + x.unidad} />
            </div>
            {sugerido > 0 && Math.round(x.cantidad) !== sugerido && (
              <button type="button" onClick={() => escribir(x.id, "c", String(sugerido))} style={{
                background: "none", border: "none", color: C.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, marginTop: -4, marginBottom: 8, fontFamily: F,
              }}>Usar {cifra(sugerido)} m² (calculado con los {cifra(m2Vivienda)} m² de la vivienda)</button>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px dashed " + C.border, paddingTop: 10, marginTop: 2 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{importe > 0 && !global ? cifra(x.cantidad) + " " + x.unidad + " × " + euros(x.precio) : "Importe"}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: importe > 0 ? C.text : C.muted }}>{euros(importe)}</span>
            </div>
          </div>
        );
      })}

      <button type="button" onClick={anadirOtro} style={{
        width: "100%", padding: "13px", borderRadius: 12, border: "1px dashed " + C.mutedL, background: "transparent",
        color: C.mutedL, fontFamily: F, fontSize: 13.5, fontWeight: 800, cursor: "pointer", marginTop: 4,
      }}>＋ Añadir otro trabajo (albañilería, regatas, derribos…)</button>

      {p.partidas.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, color: C.mutedL, fontSize: 13, fontWeight: 700 }}>
          <span>Suma sin IVA</span><span style={{ color: C.text, fontWeight: 800 }}>{euros(t.bruto)}</span>
        </div>
      )}
    </>
  );

  const pantallaEstado = (
    <>
      <Pregunta titulo="¿Cómo están las paredes?" ayuda="Marca todo lo que viste en la visita.">
        <Fila>{ESTADOS_PARED.map((e) => <Chip key={e.id} act={p.estado.includes(e.id)} onClick={() => upd({ estado: alternar(p.estado, e.id) })}>{e.label}</Chip>)}</Fila>
      </Pregunta>
      <Pregunta titulo="¿Qué incluyes?" ayuda="Saldrá en el presupuesto con un ✓. Es lo que más tranquiliza al cliente.">
        {PREPARACION.map((x) => (
          <FilaCheck key={x.id} on={p.preparacion.includes(x.id)} onClick={() => upd({ preparacion: alternar(p.preparacion, x.id) })} texto={x.label} />
        ))}
      </Pregunta>
    </>
  );

  const pantallaMateriales = (
    <>
      <Pregunta titulo="Marca de pintura">
        <Fila>
          {MARCAS_PINTURA.map((x) => <Chip key={x} act={!marcaOtra && p.materiales.marca === x} onClick={() => { setMarcaOtra(false); updMat("marca", p.materiales.marca === x ? "" : x); }}>{x}</Chip>)}
          <Chip act={marcaOtra} onClick={() => { setMarcaOtra(true); updMat("marca", ""); }}>Otra</Chip>
        </Fila>
        {marcaOtra && <div style={{ marginTop: 10 }}><Campo value={p.materiales.marca} onChange={(v: string) => updMat("marca", v)} placeholder="Escribe la marca" /></div>}
      </Pregunta>
      <Pregunta titulo="Tipo de pintura">
        <Fila>{TIPOS_PINTURA.map((x) => <Chip key={x.id} act={p.materiales.tipo === x.id} onClick={() => updMat("tipo", x.id)}>{x.label}</Chip>)}</Fila>
      </Pregunta>
      <Pregunta titulo="Acabado">
        <Fila>{ACABADOS.map((x) => <Chip key={x.id} act={p.materiales.acabado === x.id} onClick={() => updMat("acabado", x.id)}>{x.label}</Chip>)}</Fila>
      </Pregunta>
      <Pregunta titulo="Colores">
        <Fila>{COLORES.map((x) => <Chip key={x.id} act={p.materiales.colores === x.id} onClick={() => updMat("colores", x.id)}>{x.label}</Chip>)}</Fila>
        <div style={{ marginTop: 10 }}>
          <Campo value={p.materiales.colores_txt} onChange={(v: string) => updMat("colores_txt", v)} placeholder="Detalle (opcional): blanco roto en salón y gris perla en dormitorios" />
        </div>
      </Pregunta>
      <Pregunta titulo="¿Cuántas manos?">
        <Fila>{[1, 2, 3].map((n) => <Chip key={n} act={p.materiales.manos === n} onClick={() => updMat("manos", n)}>{n === 1 ? "1 mano" : n + " manos"}</Chip>)}</Fila>
      </Pregunta>
      <Interruptor on={p.materiales.imprimacion} onClick={() => updMat("imprimacion", !p.materiales.imprimacion)} texto="Imprimación selladora" detalle="Para que la pintura agarre y quede uniforme" />
      <Interruptor on={p.materiales.material_incluido} onClick={() => updMat("material_incluido", !p.materiales.material_incluido)} texto="Material incluido en el precio" detalle={p.materiales.material_incluido ? "Pones tú la pintura" : "La pintura la pone el cliente"} />
    </>
  );

  const pantallaPrecio = (
    <>
      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
        {p.partidas.map((x, k) => (
          <div key={x.id} style={{ display: "flex", gap: 10, padding: "12px 14px", borderTop: k ? "1px solid " + C.border : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13.5 }}>{tituloPartida(x)}</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{x.unidad === "global" ? "Precio cerrado" : cifra(x.cantidad) + " " + x.unidad + " × " + euros(x.precio)}</div>
            </div>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{euros((x.unidad === "global" ? 1 : x.cantidad) * x.precio)}</div>
          </div>
        ))}
        <button type="button" onClick={() => setPaso("trabajos")} style={{
          width: "100%", padding: "11px", background: C.bg, border: "none", borderTop: "1px solid " + C.border, color: C.accent,
          fontFamily: F, fontWeight: 800, fontSize: 12.5, cursor: "pointer",
        }}>Cambiar trabajos o precios</button>
      </div>
      <Campo label="Descuento (opcional)" value={descTxt} onChange={(v: string) => { setDescTxt(v); const n = aNumero(v || "0"); upd({ descuento_pct: isNaN(n) ? 0 : n }); }} inputMode="decimal" placeholder="0" sufijo="%" />
      <Pregunta titulo="IVA" ayuda={p.iva_pct === 10 ? "El 10 % solo vale para obras en vivienda particular con condiciones. Si dudas, consulta a tu gestor." : undefined}>
        <Fila>
          <Chip act={p.iva_pct === 21} onClick={() => upd({ iva_pct: 21 })}>21 %</Chip>
          <Chip act={p.iva_pct === 10} onClick={() => upd({ iva_pct: 10 })}>10 % (vivienda)</Chip>
          <Chip act={p.iva_pct === 0} onClick={() => upd({ iva_pct: 0 })}>Sin IVA</Chip>
        </Fila>
      </Pregunta>
      <Totales t={t} p={p} color={marca.color} />
    </>
  );

  const otroPago = !FORMAS_PAGO.some((f) => f.id === p.pago);
  const pantallaCondiciones = (
    <>
      <Pregunta titulo="¿Cuánto vas a tardar?" ayuda="En días de trabajo.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Campo label="De" value={p.plazo_min} onChange={(v: string) => upd({ plazo_min: v.replace(/[^0-9]/g, "") })} inputMode="numeric" placeholder="Ej. 15" sufijo="días" />
          <Campo label="A (opcional)" value={p.plazo_max} onChange={(v: string) => upd({ plazo_max: v.replace(/[^0-9]/g, "") })} inputMode="numeric" placeholder="Ej. 17" sufijo="días" />
        </div>
      </Pregunta>
      <Pregunta titulo="¿Cuándo podrías empezar?">
        <Fila>
          {["A convenir con el cliente", "Esta semana", "La semana que viene", "En 15 días"].map((x) => <Chip key={x} act={p.inicio === x} onClick={() => upd({ inicio: x })}>{x}</Chip>)}
        </Fila>
        <div style={{ marginTop: 10 }}><Campo value={p.inicio} onChange={(v: string) => upd({ inicio: v })} placeholder="O escribe una fecha: lunes 14 de diciembre" /></div>
      </Pregunta>
      <Pregunta titulo="Forma de pago" ayuda={!otroPago && t.total > 0 ? tramosPago(p, t.total).map((x) => x.pct + " % " + x.txt.split(",")[0] + ": " + euros(x.importe)).join(" · ") : undefined}>
        <Fila>
          {FORMAS_PAGO.map((f) => <Chip key={f.id} act={p.pago === f.id} onClick={() => upd({ pago: f.id })}>{f.label}</Chip>)}
          <Chip act={otroPago} onClick={() => upd({ pago: "otro" })}>Otra</Chip>
        </Fila>
        {otroPago && <div style={{ marginTop: 10 }}><Campo value={p.pago_txt} onChange={(v: string) => upd({ pago_txt: v })} multilinea placeholder="Ej. 200 € al aceptar y el resto al terminar" /></div>}
      </Pregunta>
      <Pregunta titulo="¿Cómo te pueden pagar?">
        <Fila>{METODOS_PAGO.map((x) => <Chip key={x.id} act={p.metodos.includes(x.id)} onClick={() => upd({ metodos: alternar(p.metodos, x.id) })}>{x.label}</Chip>)}</Fila>
      </Pregunta>
      <Pregunta titulo="Garantía">
        <Fila>{GARANTIAS.map((x) => <Chip key={x} act={p.garantia === x} onClick={() => upd({ garantia: x })}>{x}</Chip>)}</Fila>
      </Pregunta>
      <Pregunta titulo="Validez del presupuesto">
        <Fila>{[15, 30, 60].map((n) => <Chip key={n} act={p.validez_dias === n} onClick={() => upd({ validez_dias: n })}>{n} días</Chip>)}</Fila>
      </Pregunta>
      <Pregunta titulo="¿Qué NO incluye?" ayuda="Así no hay sorpresas ni discusiones después.">
        {NO_INCLUYE.map((x) => <FilaCheck key={x} on={p.no_incluye.includes(x)} onClick={() => upd({ no_incluye: alternar(p.no_incluye, x) })} texto={x} />)}
      </Pregunta>
      <Campo label="Nota para el cliente (opcional)" value={p.notas} onChange={(v: string) => upd({ notas: v })} multilinea
        placeholder="Ej. Los muebles del salón se agrupan en el centro y se cubren. Dejar libre una habitación para guardar cosas." />
    </>
  );

  const pantallaListo = (
    <>
      <div style={{
        borderRadius: 18, padding: "20px 18px", marginBottom: 16, position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg," + oscurecer(marca.color, 0.45) + "," + marca.color + ")", boxShadow: "0 16px 34px -18px " + marca.color,
        color: luzHex(marca.color) > 0.72 ? "#111" : "#fff",
      }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 4, flexShrink: 0 }}>
            {marca.logo_url ? <img src={marca.logo_url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <IconoDoc s={26} color={marca.color} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", opacity: 0.85 }}>PRESUPUESTO {p.numero}</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cliente.nombre}</div>
          </div>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.85, fontWeight: 700 }}>{p.iva_pct ? "Total IVA incluido" : "Total sin IVA"}</div>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em" }}>{euros(t.total)}</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
          {[p.partidas.length + (p.partidas.length === 1 ? " trabajo" : " trabajos"), plazoTxt(p), p.garantia && "garantía " + p.garantia].filter(Boolean).join(" · ")}
        </div>
      </div>

      {generando && <div style={{ textAlign: "center", color: C.mutedL, fontSize: 13.5, padding: "14px 0" }}>Preparando el PDF…</div>}

      {pdf && (
        <>
          <button type="button" onClick={compartir} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "15px", borderRadius: 13,
            border: "none", background: "linear-gradient(135deg,#25D366,#128C7E)", color: "#fff", fontFamily: F, fontSize: 15.5, fontWeight: 900, cursor: "pointer",
            boxShadow: "0 12px 26px -14px #25D366", marginBottom: 10,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.3c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" /></svg>
            Enviar al cliente
          </button>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <BotonLinea onClick={ver}>Ver PDF</BotonLinea>
            <BotonLinea onClick={descargar}>Descargar</BotonLinea>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, textAlign: "center", marginBottom: 16 }}>
            {enviado
              ? (leadEstado.current === "presupuesto" ? "Listo: el cliente está en «Presupuesto enviado» con " + euros(t.total, 0) + "." : "Listo.")
              : "Al enviarlo o descargarlo, el cliente pasa a «Presupuesto enviado» con este importe."}
          </div>
        </>
      )}

      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "12px 14px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: "0.08em", marginBottom: 8 }}>LO QUE VERÁ EL CLIENTE</div>
        {p.partidas.slice(0, 3).map((x, k) => (
          <div key={x.id} style={{ fontSize: 12.5, color: C.mutedL, lineHeight: 1.45, marginBottom: 8 }}>
            <b style={{ color: C.text }}>{k + 1}. {tituloPartida(x)}.</b> {detallePartida(x, p)}
          </div>
        ))}
        {p.partidas.length > 3 && <div style={{ fontSize: 12, color: C.muted }}>…y {p.partidas.length - 3} más, con proceso de trabajo, materiales, desglose, pagos, garantía y firma.</div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <BotonLinea onClick={() => { setEnviado(false); setPaso("trabajos"); }} color={C.mutedL}>Cambiar algo</BotonLinea>
        <BotonLinea onClick={() => { setEnviado(false); setPaso("marca"); }} color={C.mutedL}>Logo y datos</BotonLinea>
      </div>
      {!enBD && <div style={{ fontSize: 11.5, color: C.muted, textAlign: "center", marginTop: 12 }}>Guardado en este móvil.</div>}
    </>
  );

  const pantallas: Record<PasoId, React.ReactNode> = {
    marca: pantallaMarca, cliente: pantallaCliente, trabajos: pantallaTrabajos, estado: pantallaEstado,
    materiales: pantallaMateriales, precio: pantallaPrecio, condiciones: pantallaCondiciones, listo: pantallaListo,
  };

  // ════════════════════════════════════════════════════════
  return (
    <div style={{
      position: "fixed", left: 0, right: 0, ...(zona ? { top: zona.top, height: zona.height } : { top: 0, bottom: 0 }),
      background: "rgba(0,0,0,0.78)", zIndex: 31000, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: F,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Crear presupuesto" style={{
        background: C.surface, width: "100%", maxWidth: 560, height: zona ? "100%" : "96%", borderRadius: zona ? 0 : "20px 20px 0 0",
        display: "flex", flexDirection: "column", border: "1px solid " + C.border, overflow: "hidden", boxSizing: "border-box",
      }}>
        {/* Cabecera */}
        <div style={{ padding: "16px 18px 12px", flexShrink: 0, borderBottom: "1px solid " + C.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.accent, display: "flex" }}><IconoDoc s={22} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontWeight: 900, fontSize: 16.5 }}>{cargando ? "Presupuesto" : pasoInfo.titulo}</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cargando ? "Cargando…" : pasoInfo.sub + (p.cliente.nombre && paso !== "cliente" && paso !== "marca" ? " · " + p.cliente.nombre : "")}
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", color: C.muted, fontSize: 28, cursor: "pointer", lineHeight: 1, padding: 2 }}>×</button>
          </div>
          {!cargando && paso !== "marca" && paso !== "listo" && (
            <div style={{ display: "flex", gap: 4, marginTop: 12 }} aria-label={"Paso " + nActual + " de " + nPasos}>
              {Array.from({ length: nPasos }).map((_, k) => (
                <span key={k} style={{ flex: 1, height: 4, borderRadius: 99, background: k < nActual ? C.accent : C.border, transition: "background .2s" }} />
              ))}
            </div>
          )}
        </div>

        {/* Contenido */}
        <div ref={cuerpo} style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" as any, padding: "18px 18px 22px" }}>
          {cargando ? <div style={{ textAlign: "center", color: C.mutedL, padding: "40px 0" }}>Cargando…</div> : pantallas[paso]}
        </div>

        {/* Pie */}
        {!cargando && paso !== "listo" && (
          <div style={{ flexShrink: 0, borderTop: "1px solid " + C.border, padding: "12px 18px", paddingBottom: zona ? 12 : "calc(12px + env(safe-area-inset-bottom))", background: C.surface }}>
            {err && <div role="alert" style={{ color: C.red, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{err}</div>}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {i > 0 && (
                <button type="button" onClick={atras} style={{
                  padding: "13px 16px", borderRadius: 11, border: "1px solid " + C.border, background: "transparent", color: C.mutedL,
                  fontFamily: F, fontWeight: 800, fontSize: 14, cursor: "pointer",
                }}>{paso === "cliente" ? "Mi marca" : "Atrás"}</button>
              )}
              {(paso === "precio" || paso === "condiciones") && t.total > 0 && (
                <div style={{ flex: 1, textAlign: "right", paddingRight: 4 }}>
                  <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>TOTAL</div>
                  <div style={{ fontSize: 15, color: C.text, fontWeight: 900 }}>{euros(t.total, 0)}</div>
                </div>
              )}
              <button type="button" onClick={siguiente} disabled={generando || subiendoLogo} style={{
                flex: paso === "precio" || paso === "condiciones" ? "0 0 auto" : 1, padding: "13px 20px", borderRadius: 11, border: "none",
                background: generando ? C.border : C.accent, color: "#000", fontFamily: F, fontWeight: 900, fontSize: 14.5, cursor: generando ? "wait" : "pointer",
              }}>{generando ? "Creando…" : paso === "condiciones" ? "Crear presupuesto" : paso === "marca" ? "Guardar y seguir" : "Siguiente"}</button>
            </div>
          </div>
        )}
        {!cargando && paso === "listo" && err && (
          <div role="alert" style={{ color: C.red, fontSize: 13, fontWeight: 700, padding: "10px 18px" }}>{err}</div>
        )}
      </div>
    </div>
  );
}

// ── Piezas pequeñas ──
function BotonLinea({ children, onClick, color = C.accent }: any) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: "11px 12px", borderRadius: 10, border: "1px solid " + color, background: "transparent", color,
      fontFamily: F, fontWeight: 800, fontSize: 13, cursor: "pointer",
    }}>{children}</button>
  );
}

function Totales({ t, p, color }: { t: ReturnType<typeof totales>; p: Presupuesto; color: string }) {
  const fila = (k: string, v: string, fuerte = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: fuerte ? 14 : 13, color: fuerte ? C.text : C.mutedL, fontWeight: fuerte ? 800 : 600, padding: "4px 0" }}>
      <span>{k}</span><span style={{ color: C.text, fontWeight: 800 }}>{v}</span>
    </div>
  );
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: 14 }}>
      {t.descuento > 0 && fila("Subtotal", euros(t.bruto))}
      {t.descuento > 0 && fila("Descuento (" + cifra(p.descuento_pct) + " %)", "-" + euros(t.descuento))}
      {fila("Base imponible", euros(t.base))}
      {fila(p.iva_pct ? "IVA (" + p.iva_pct + " %)" : "IVA", p.iva_pct ? euros(t.iva) : "No incluido")}
      <div style={{
        marginTop: 10, borderRadius: 12, padding: "14px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "linear-gradient(135deg," + oscurecer(color, 0.45) + "," + color + ")", color: luzHex(color) > 0.72 ? "#111" : "#fff",
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em" }}>{p.iva_pct ? "TOTAL (IVA INCLUIDO)" : "TOTAL"}</span>
        <span style={{ fontSize: 22, fontWeight: 900 }}>{euros(t.total)}</span>
      </div>
    </div>
  );
}

function luzHex(hex: string) { const [r, g, b] = hexARgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function oscurecer(hex: string, k: number) {
  const [r, g, b] = hexARgb(hex);
  return "#" + [r, g, b].map((v) => Math.round(v * (1 - k) + 10 * k).toString(16).padStart(2, "0")).join("");
}
