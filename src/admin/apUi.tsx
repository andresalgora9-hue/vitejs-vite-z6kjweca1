// ============================================================
// OficioYa · ADMIN nuevo — piezas compartidas
// ============================================================
import React, { useEffect, useState } from "react";

export const C = {
  bg: "#0F1117", surface: "#161B27", card: "#1E2536", cardHi: "#263148", border: "#2D3A52",
  accent: "#FFD700", orange: "#FF8C00", red: "#FF4455", green: "#00D68F",
  blue: "#3B82F6", purple: "#8B5CF6", text: "#E8EDF5", muted: "#5A6A8A", mutedL: "#8899BB",
  bar: "#D07A0E", // color de barras validado para fondo oscuro
};
export const F = "'DM Sans',sans-serif";
export const TZ = "Europe/Madrid";
export const ADMIN_IDS = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];
export const ADMIN_CHAT_ID = "00000000-0000-0000-0000-000000000002";
export const INICIO_PAGO_POR_LEAD = "2026-10-14T00:00:00+02:00"; // firma del primer contrato por lead
export const INICIO_ALTAS = "2026-10-21T00:00:00+02:00";         // desde aquí, cada registro nuevo paga alta
export const SUPABASE_FN = "https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1";

// ── TIPOS ───────────────────────────────────────────────────
export interface Pro {
  id: string; name: string; email: string | null; phone: string | null; whatsapp: string | null;
  trade: string | null; zone: string | null; company_name: string | null; cif: string | null;
  fiscal_address: string | null; fiscal_zip: string | null; fiscal_city: string | null; billing_email: string | null;
  joined_at: string | null; created_at: string | null; activacion_estado: string | null; activacion_invoice_id: string | null;
  deleted: boolean | null; banned: boolean | null; plan: string | null;
  precio_lead?: number | null; city_slug?: string | null; captacion_lead_id?: string | null; ficha_captacion?: any;
}
export interface Lead {
  id: string; created_at: string; pro_id: string; trade: string; city_slug: string; canal: "formulario" | "whatsapp" | "llamada";
  estado: "nuevo" | "contactado" | "presupuesto" | "ganado" | "perdido"; estado_at: string; motivo_perdido: string | null;
  presupuesto_eur: number | null; client_name: string | null; client_phone: string | null; client_email: string | null;
  zona: string | null; direccion: string | null; descripcion: string | null; notas: string | null; price: number;
  anulado: boolean; anulado_motivo: string | null; budget_request_id: string | null; llamada_at: string | null;
  llamada_segundos: number | null; gclid: string | null; invoice_id: string | null; created_by: string;
  primer_contacto_at: string | null;
}
export interface Factura {
  id: string; number: string; pro_id: string; issued_at: string; due_at: string; period_start: string | null;
  period_end: string | null; motivo: string; tipo: "leads" | "activacion"; concepto: string | null; n_leads: number;
  base: number; iva_pct: number; iva: number; total: number; status: "pendiente" | "pagada" | "anulada";
  paid_at: string | null; cliente_nombre: string | null; cliente_nif: string | null; cliente_direccion: string | null;
  cliente_email: string | null; cliente_telefono: string | null;
}
export interface Solicitud {
  id: string; created_at: string; client_id: string | null; client_name: string | null; oficio: string | null;
  zona: string | null; description: string | null; status: string | null; city_slug: string | null; landing: string | null;
  gclid: string | null; canal: string | null; pro_solicitado: string | null;
}
export interface Routing { trade_key: string; city_slug: string; pro_id: string; active: boolean; }
export interface Gasto {
  id: string; desde: string; hasta: string; plataforma: string; oficio: string | null; importe: number;
  clics: number | null; conversiones: number | null; nota: string | null; created_at: string;
}

export interface Datos {
  pros: Pro[];
  leads: Lead[];
  facturas: Factura[];
  solicitudes: Solicitud[];
  routing: Routing[];
  gastos: Gasto[];
  precios: { trade_key: string; price: number }[];
  config: Record<string, number>;
  conPush: Set<string>;
  proPorId: Record<string, Pro>;
}
export interface SeccionProps {
  d: Datos;
  recargar: () => Promise<void>;
  aviso: (m: string) => void;
  irA: (s: string) => void;
}

export const ESTADOS = [
  { id: "nuevo", label: "Nuevo", color: C.accent },
  { id: "contactado", label: "Contactado", color: C.blue },
  { id: "presupuesto", label: "Presupuesto", color: C.orange },
  { id: "ganado", label: "Ganado", color: C.green },
  { id: "perdido", label: "Perdido", color: C.red },
] as const;
export const ESTADO_INFO: Record<string, { label: string; color: string }> =
  Object.fromEntries(ESTADOS.map((e) => [e.id, { label: e.label, color: e.color }]));
export const CANAL_LABEL: Record<string, string> = { formulario: "Formulario", whatsapp: "WhatsApp", llamada: "Llamada" };
export const MOTIVO_PERDIDO: Record<string, string> = {
  no_contesta: "No contesta", caro: "Le pareció caro", otro_profesional: "Eligió a otro",
  ya_no_lo_necesita: "Ya no lo necesita", fuera_de_zona: "Fuera de zona", no_puedo_atenderlo: "No puede atenderlo", otros: "Otros",
};

// ── FECHAS (las tablas antiguas guardan la hora sin zona: es UTC) ──
export const ts = (s: string | null | undefined): number => {
  if (!s) return 0;
  const conZona = /[zZ]$|[+-]\d\d:?\d\d$/.test(s);
  return new Date(conZona ? s : s.replace(" ", "T") + "Z").getTime();
};
// Diferencia de Madrid con UTC en un instante (tiene en cuenta horario de verano)
function offsetMadrid(t: number) {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - t;
}
// Medianoche de Madrid de un día "YYYY-MM-DD", en milisegundos
export const tsMadrid = (ymd: string) => {
  const [y, m, dd] = ymd.split("-").map(Number);
  const g = Date.UTC(y, m - 1, dd);
  return g - offsetMadrid(g - offsetMadrid(g));
};
export const ymdMadrid = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
export const sumarDias = (ymd: string, n: number) => {
  const [y, m, dd] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
};
export const diaSemana = (ymd: string) => { // lunes = 0
  const [y, m, dd] = ymd.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7;
};

export const mesDe = (s: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date(ts(s)));
export const mesHoy = () => mesDe(new Date().toISOString());
export const mesMover = (k: string, d: number) => {
  const [y, m] = k.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1 + d, 1));
  return f.getUTCFullYear() + "-" + String(f.getUTCMonth() + 1).padStart(2, "0");
};
export const mesNombre = (k: string, corto = false) => {
  const [y, m] = k.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-ES", corto ? { month: "short", year: "2-digit", timeZone: "UTC" } : { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const diasDelMes = (k: string) => { const [y, m] = k.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const fecha = (s: string | null) => s ? new Date(ts(s)).toLocaleDateString("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
export const fechaHora = (s: string | null) => s ? new Date(ts(s)).toLocaleString("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
export const hace = (s: string) => {
  const min = Math.max(0, Math.round((Date.now() - ts(s)) / 60000));
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60);
  if (h < 48) return h + " h";
  return Math.floor(h / 24) + " días";
};
export const duracion = (min: number | null) => {
  if (min == null) return "—";
  if (min < 60) return Math.max(1, Math.round(min)) + " min";
  const h = min / 60;
  if (h < 48) return h.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " h";
  return Math.round(h / 24) + " días";
};

// ── NÚMEROS ─────────────────────────────────────────────────
export const eur = (n: number, dec = 0) =>
  (Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: true }) + " €";
export const num = (n: number, dec = 0) => (Number(n) || 0).toLocaleString("es-ES", { maximumFractionDigits: dec });
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) + "%" : "—");
export const digitos = (t: string | null) => (t || "").replace(/[^0-9]/g, "");
export const waLink = (t: string | null) => { let d = digitos(t); if (d.length === 9) d = "34" + d; return "https://wa.me/" + d; };
export const oficioDe = (t: string | null | undefined) => {
  const s = (t || "").toLowerCase();
  if (s.includes("pint")) return "Pintor";
  if (s.includes("fontan")) return "Fontanero";
  if (s.includes("electric")) return "Electricista";
  if (s.includes("carpint")) return "Carpintero";
  if (s.includes("cerraj")) return "Cerrajero";
  if (s.includes("albañil") || s.includes("albanil")) return "Albañil";
  if (s.includes("reform")) return "Reformas";
  if (s.includes("manitas")) return "Manitas";
  if (s.includes("aire") || s.includes("clima")) return "Climatización";
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Sin oficio";
};

export function useAncho() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const f = () => setW(window.innerWidth);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return w;
}

// ── PIEZAS ──────────────────────────────────────────────────
export function Card({ children, style = {}, accent, onClick }: any) {
  return (
    <div onClick={onClick} style={{
      background: C.card, border: "1px solid " + (accent || C.border), borderRadius: 12, padding: 16,
      marginBottom: 12, cursor: onClick ? "pointer" : undefined, ...style,
    }}>{children}</div>
  );
}

export function Btn({ children, onClick, color = C.accent, outline = false, small = false, disabled = false, full = false, href }: any) {
  const st: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none",
    padding: small ? "6px 10px" : "9px 14px", borderRadius: 8, fontFamily: F, fontWeight: 800,
    fontSize: small ? 12 : 13, cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
    background: disabled ? C.border : outline ? "transparent" : color,
    border: "1px solid " + (disabled ? C.border : color),
    color: disabled ? C.muted : outline ? color : (color === C.accent || color === C.green || color === C.orange ? "#000" : "#fff"),
    width: full ? "100%" : undefined, boxSizing: "border-box",
  };
  if (href && !disabled) return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" style={st}>{children}</a>;
  return <button onClick={disabled ? undefined : onClick} disabled={disabled} style={st}>{children}</button>;
}

export function Pill({ texto, color }: { texto: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 5, background: color + "1F", color, whiteSpace: "nowrap" }}>{texto}</span>;
}

export function Kpi({ label, valor, sub, color = C.text, alerta }: { label: string; valor: string; sub?: React.ReactNode; color?: string; alerta?: boolean }) {
  return (
    <div style={{ background: C.card, border: "1px solid " + (alerta ? C.red + "88" : C.border), borderRadius: 12, padding: "14px 14px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700, letterSpacing: "0.02em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: C.mutedL, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

export function Grid({ children, min = 170, gap = 10, style = {} }: any) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap, marginBottom: 12, ...style }}>{children}</div>;
}

export function Titulo({ children, accion }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "22px 0 10px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedL }}>{children}</div>
      {accion}
    </div>
  );
}

export function Cabecera({ titulo, sub, children }: any) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "6px 0 16px" }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>{titulo}</h1>
        {sub && <div style={{ fontSize: 13, color: C.mutedL, marginTop: 4 }}>{sub}</div>}
      </div>
      {children && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{children}</div>}
    </div>
  );
}

export function SelectorMes({ mes, onChange, min, max }: { mes: string; onChange: (m: string) => void; min?: string; max?: string }) {
  const tope = max || mesHoy();
  const b = (dis: boolean): React.CSSProperties => ({
    width: 34, height: 34, borderRadius: 8, border: "1px solid " + C.border, background: C.card,
    color: dis ? C.muted : C.text, cursor: dis ? "default" : "pointer", fontSize: 16,
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button style={b(!!min && mes <= min)} disabled={!!min && mes <= min} onClick={() => onChange(mesMover(mes, -1))} aria-label="Mes anterior">‹</button>
      <span style={{ color: C.text, fontWeight: 800, fontSize: 14, minWidth: 128, textAlign: "center" }}>{mesNombre(mes)}</span>
      <button style={b(mes >= tope)} disabled={mes >= tope} onClick={() => onChange(mesMover(mes, 1))} aria-label="Mes siguiente">›</button>
    </div>
  );
}

export function Sel({ value, onChange, options, style = {} }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; style?: any }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      background: C.card, color: C.text, border: "1px solid " + C.border, borderRadius: 8, padding: "8px 10px",
      fontFamily: F, fontSize: 13, outline: "none", ...style,
    }}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

export function Campo({ label, value, onChange, type = "text", placeholder = "", multilinea = false, inputMode, ayuda }: any) {
  const base: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.bg, border: "1px solid " + C.border,
    borderRadius: 8, color: C.text, fontSize: 14, fontFamily: F, outline: "none",
  };
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>{label}</label>}
      {multilinea
        ? <textarea value={value} rows={3} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ ...base, resize: "vertical" }} />
        : <input type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={base} />}
      {ayuda && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{ayuda}</div>}
    </div>
  );
}

export function Modal({ titulo, onClose, children, ancho = 560 }: any) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 40000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, border: "1px solid " + C.border, borderRadius: 14, width: "100%", maxWidth: ancho,
        maxHeight: "92vh", overflowY: "auto", padding: 20, boxSizing: "border-box", fontFamily: F,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
          <h3 style={{ margin: 0, color: C.text, fontSize: 17, fontWeight: 800 }}>{titulo}</h3>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", color: C.muted, fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Tabla con scroll horizontal en móvil
export function Tabla({ cols, filas, vacio = "Sin datos", onFila }: {
  cols: { k: string; l: string; align?: "left" | "right" | "center"; w?: number }[];
  filas: Record<string, React.ReactNode>[];
  vacio?: string;
  onFila?: (i: number) => void;
}) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid " + C.border, borderRadius: 12, background: C.card, marginBottom: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F, fontSize: 13, minWidth: cols.length * 95 }}>
        <thead>
          <tr>{cols.map((c) => (
            <th key={c.k} style={{ textAlign: c.align || "left", padding: "10px 12px", color: C.mutedL, fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid " + C.border, whiteSpace: "nowrap", width: c.w }}>{c.l}</th>
          ))}</tr>
        </thead>
        <tbody>
          {filas.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 18, color: C.muted, textAlign: "center" }}>{vacio}</td></tr>}
          {filas.map((f, i) => (
            <tr key={i} onClick={onFila ? () => onFila(i) : undefined} style={{ cursor: onFila ? "pointer" : undefined, borderTop: i ? "1px solid " + C.border + "88" : undefined }}
              onMouseEnter={(e) => { if (onFila) (e.currentTarget as HTMLElement).style.background = C.cardHi; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              {cols.map((c) => <td key={c.k} style={{ padding: "10px 12px", color: C.text, textAlign: c.align || "left", verticalAlign: "middle", whiteSpace: "nowrap" }}>{f[c.k]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Barra de progreso horizontal (para estados y repartos)
export function BarraH({ label, valor, total, color, extra }: { label: string; valor: number; total: number; color: string; extra?: string }) {
  const p = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: C.text, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{label}
        </span>
        <span style={{ color: C.mutedL }}><b style={{ color: C.text }}>{valor}</b> · {p}%{extra ? " · " + extra : ""}</span>
      </div>
      <div style={{ height: 8, background: C.bg, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: p + "%", height: "100%", background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

// Gráfico de barras de una sola serie, con aviso al pasar el ratón o tocar
export function Barras({ datos, alto = 170, formato = (v: number) => num(v) }: {
  datos: { etiqueta: string; valor: number; detalle?: string }[];
  alto?: number;
  formato?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const paso = Math.pow(10, Math.floor(Math.log10(max)));
  const tope = Math.ceil(max / paso) * paso;
  const marcas = [0, tope / 2, tope];
  return (
    <div style={{ position: "relative", fontFamily: F }}>
      <div style={{ display: "flex", height: alto, alignItems: "stretch", gap: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingRight: 8, fontSize: 10.5, color: C.muted, textAlign: "right", minWidth: 26 }}>
          {[...marcas].reverse().map((m) => <span key={m} style={{ lineHeight: "10px" }}>{num(m)}</span>)}
        </div>
        <div style={{ flex: 1, position: "relative", borderBottom: "1px solid " + C.border }}>
          {marcas.slice(1).map((m) => (
            <div key={m} style={{ position: "absolute", left: 0, right: 0, bottom: (m / tope) * 100 + "%", borderTop: "1px dashed " + C.border + "99" }} />
          ))}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 2 }}>
            {datos.map((d, i) => (
              <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}
                style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", cursor: "default", position: "relative" }}>
                <div style={{
                  width: "62%", maxWidth: 34, height: d.valor > 0 ? Math.max(2, (d.valor / tope) * 100) + "%" : 0,
                  background: hover === i ? "#E8901F" : C.bar, borderRadius: "4px 4px 0 0", transition: "height .25s",
                }} />
                {hover === i && (
                  <div style={{
                    position: "absolute", bottom: "100%", left: "50%", transform: "translate(-50%, -6px)", background: C.surface,
                    border: "1px solid " + C.border, borderRadius: 8, padding: "6px 9px", fontSize: 12, color: C.text, whiteSpace: "nowrap",
                    zIndex: 5, boxShadow: "0 6px 18px rgba(0,0,0,0.4)", pointerEvents: "none",
                  }}>
                    <div style={{ color: C.mutedL, fontSize: 11 }}>{d.etiqueta}</div>
                    <b>{formato(d.valor)}</b>{d.detalle ? <span style={{ color: C.mutedL }}> · {d.detalle}</span> : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", paddingLeft: 34, marginTop: 6, gap: 2 }}>
        {datos.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: C.muted, overflow: "hidden", whiteSpace: "nowrap" }}>
            {datos.length > 8 && i % 2 === 1 ? "" : d.etiqueta}
          </div>
        ))}
      </div>
    </div>
  );
}

export async function avisarPush(userId: string, title: string, body: string) {
  try {
    await fetch(SUPABASE_FN + "/send-push", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, title, body, url: "/" }),
    });
  } catch { /* nada */ }
}
