// ============================================================
// OficioYa · Panel PROFESIONAL — pestaña PERFIL (rediseño 11/11/2026)
// Ordenada en dos partes:
//   · Mis datos (privados, solo para OficioYa): datos personales, facturación, zona y trabajos,
//     pago de facturas, contrato y condiciones, resultados y cuenta.
//   · Mi web (lo que verán sus clientes): foto, presentación, experiencia, fotos de trabajos y títulos.
//     La web completa de cada profesional se prepara más adelante; aquí ya puede ir rellenándola.
// Arriba se ve lo completo que está el perfil y lo que falta (cada cosa lleva directa a rellenarla).
// La primera vez que entra sale sí o sí el aviso de las novedades con la guía por pasos (ProPerfilGuia):
// se puede omitir a partir del paso 2 y volver a ver con el botón «Guía».
// Sustituye al bloque antiguo de «Perfil» de App.tsx (ProNegocio + «Mi perfil público»).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, STORAGE_URL, SUPABASE_KEY } from "../supabase";
import { C, F, Boton, Card, fecha, duracionMin, digitos } from "./proComun";
import ProFicha from "./ProFicha";
import ProTarjeta, { EstadoCobro } from "./ProTarjeta";
import ProChatOficioYa from "./ProChatOficioYa";
import { TarjetaPush } from "./ProInicio";
import ProPerfilGuia, { PasoGuia } from "./ProPerfilGuia";
import ProMiWeb from "./ProMiWeb";

const FN = "https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1";
const CABECERAS_FN = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY };
const CLAVE_GUIA = "oy_guia_perfil_v1_";
const ORO_SUAVE = "#FFE38A";
const ETAPAS_GANADO_HIST = ["precio_acordado", "programado", "completado", "cobrado_cliente", "facturado", "liquidado"];
const DIA = 86400000;
const CAMPOS_USUARIO = "id,name,email,phone,whatsapp,trade,zone,city_slug,bio,experience_years,avatar_url,verified,joined_at,created_at,company_name,cif,fiscal_address,fiscal_zip,fiscal_city,billing_email,precio_lead";

type Parte = "datos" | "web";

// ── Formato y comprobaciones ───────────────────────────────
const miles = (n: number) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const euros = (n: number) => miles(n) + " €";
const euros2 = (n: number) => (Math.round(Number(n) * 100) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const mesAnio = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "Europe/Madrid" });
const fechaLarga = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
const slug = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** DNI, NIE o CIF: "ok", "mal" o null si está vacío */
function revisarNif(v: string): "ok" | "mal" | null {
  const s = (v || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!s) return null;
  const L = "TRWAGMYFPDXBNJZSQVHLCKE";
  if (/^\d{8}[A-Z]$/.test(s)) return L[parseInt(s.slice(0, 8), 10) % 23] === s[8] ? "ok" : "mal";
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) return L[parseInt("XYZ".indexOf(s[0]) + s.slice(1, 8), 10) % 23] === s[8] ? "ok" : "mal";
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(s)) {
    let suma = 0;
    for (let i = 0; i < 7; i++) {
      const x = parseInt(s[i + 1], 10);
      if (i % 2 === 0) { const y = x * 2; suma += Math.floor(y / 10) + (y % 10); } else suma += x;
    }
    const c = (10 - (suma % 10)) % 10;
    return s[8] === String(c) || s[8] === "JABCDEFGHI"[c] ? "ok" : "mal";
  }
  return "mal";
}
const cpOk = (v: string) => /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/.test((v || "").trim());
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());
const telOk = (v: string) => /^[6789]\d{8}$/.test(digitos(v).replace(/^34(?=\d{9}$)/, ""));
const iniciales = (n?: string) => (n || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
const guiaVista = (id: string) => { try { return localStorage.getItem(CLAVE_GUIA + id) === "1"; } catch { return true; } };

async function comprimir(file: File, max = 1200, calidad = 0.82): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / img.width);
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const ctx = cv.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => resolve(b || file), "image/jpeg", calidad);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}
async function subirImagen(file: File, carpeta: string): Promise<string | null> {
  const blob = await comprimir(file);
  const nombre = carpeta + "/" + Date.now() + ".jpg";
  const { error } = await db.storage.from("photos").upload(nombre, blob, { contentType: "image/jpeg", upsert: true });
  return error ? null : STORAGE_URL + nombre;
}

// ── Iconos (trazo, como los de la barra de abajo) ───────────
const TRAZOS: Record<string, React.ReactNode> = {
  perfil: <><circle cx="12" cy="8.4" r="3.7" /><path d="M4.8 20c.6-3.6 3.6-5.6 7.2-5.6s6.6 2 7.2 5.6" /></>,
  factura: <><path d="M6.5 3.5h8l4 4v13h-12z" /><path d="M14.5 3.5v4h4" /><path d="M9.5 12h6" /><path d="M9.5 15.5h6" /></>,
  mapa: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>,
  tarjeta: <><rect x="3" y="5.5" width="18" height="13" rx="2.2" /><path d="M3 10h18" /><path d="M7 15h4" /></>,
  contrato: <><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" /><path d="M14 3.5v5h5" /><path d="M8.5 16.2c1.4-1.9 2.5-1.9 3.2 0 .5 1.2 1.5 1.2 3-.6" /></>,
  grafica: <><path d="M4 20V11" /><path d="M10 20V5" /><path d="M16 20v-7" /><path d="M3 20.5h18" /></>,
  escudo: <><path d="M12 3l7 3v5.5c0 4.4-3 7.8-7 9.5-4-1.7-7-5.1-7-9.5V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" /></>,
  camara: <><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.6" /></>,
  texto: <><path d="M5 6.5h14" /><path d="M5 11h14" /><path d="M5 15.5h9" /></>,
  medalla: <><circle cx="12" cy="9" r="5.5" /><path d="M8.7 13.4 7.3 21l4.7-2.6 4.7 2.6-1.4-7.6" /></>,
  fotos: <><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="M21 15.5l-5-5-8.5 9" /></>,
  titulo: <><path d="M3 9l9-4.5L21 9l-9 4.5z" /><path d="M7 11v4.5c1.6 1.4 3.2 2 5 2s3.4-.6 5-2V11" /></>,
  ayuda: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6" /><path d="M12 17.2v.1" /></>,
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  flecha: <path d="M9 6l6 6-6 6" />,
  candado: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  mas: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  compartir: <><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>,
  salir: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l5-5-5-5" /><path d="M15 12H4" /></>,
  chispa: <><path d="M12 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z" /><path d="M19 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>,
  papelera: <><path d="M4.5 7h15" /><path d="M9.5 7V4.5h5V7" /><path d="M6.5 7l1 13h9l1-13" /></>,
};
function Icono({ n, s = 20, grosor = 1.9, style }: { n: string; s?: number; grosor?: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
      {TRAZOS[n]}
    </svg>
  );
}
function Baldosa({ n }: { n: string }) {
  return (
    <span style={{
      width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(255,215,0,0.09)", border: "1px solid rgba(255,215,0,0.22)", color: C.accent,
    }}><Icono n={n} /></span>
  );
}

// ── Piezas ──────────────────────────────────────────────────
type EstadoSec = { tipo: "ok" | "falta" | "info"; texto: string } | null;

function Chip({ e }: { e: NonNullable<EstadoSec> }) {
  const col = e.tipo === "ok" ? C.green : e.tipo === "falta" ? C.orange : C.mutedL;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 800, padding: "4px 8px", borderRadius: 99,
      background: col + "1A", color: col, whiteSpace: "nowrap", flexShrink: 0,
    }}>{e.tipo === "ok" && <Icono n="check" s={12} grosor={3} />}{e.texto}</span>
  );
}

function Grupo({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: C.muted, margin: "20px 2px 10px" }}>{children}</p>;
}

function Seccion({ id, icono, titulo, resumen, estado, abierta, onAlternar, children }: {
  id: string; icono: string; titulo: string; resumen: React.ReactNode; estado?: EstadoSec;
  abierta: boolean; onAlternar: (id: string) => void; children: React.ReactNode;
}) {
  return (
    <div data-sec={id} data-guia={id} style={{
      background: C.card, border: "1px solid " + (abierta ? "rgba(255,215,0,0.38)" : C.border), borderRadius: 14,
      marginBottom: 10, overflow: "hidden", transition: "border-color .2s", scrollMarginTop: 70,
    }}>
      <button onClick={() => onAlternar(id)} aria-expanded={abierta} style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 12px 13px 13px", background: "none", border: "none",
        cursor: "pointer", textAlign: "left", fontFamily: F, color: C.text,
      }}>
        <Baldosa n={icono} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em" }}>{titulo}</span>
          <span style={{ display: "block", color: C.mutedL, fontSize: 12.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{resumen}</span>
        </span>
        {estado && (estado.tipo === "ok" ? (
          <span role="img" aria-label={estado.texto} title={estado.texto} style={{
            width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: C.green + "1F", color: C.green,
          }}><Icono n="check" s={14} grosor={3} /></span>
        ) : <Chip e={estado} />)}
        <Icono n="flecha" s={18} style={{ color: C.muted, transform: abierta ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
      </button>
      {abierta && <div style={{ padding: "14px 14px 16px", borderTop: "1px solid " + C.border }}>{children}</div>}
    </div>
  );
}

function Campo({ label, value, onChange, placeholder = "", type = "text", inputMode, ayuda, aviso, ok, autoComplete, id }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; inputMode?: any;
  ayuda?: React.ReactNode; aviso?: string | null; ok?: string | null; autoComplete?: string; id?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={{ display: "block", fontSize: 12.5, color: C.mutedL, marginBottom: 6, fontWeight: 700 }}>{label}</label>
      <input id={id} type={type} inputMode={inputMode} value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} style={{
        width: "100%", boxSizing: "border-box", minHeight: 46, padding: "11px 12px", background: C.bg,
        border: "1px solid " + (aviso ? C.orange + "AA" : C.border), borderRadius: 11, color: C.text, fontSize: 16, fontFamily: F, outline: "none",
      }} />
      {aviso ? <div style={{ fontSize: 12.5, color: C.orange, marginTop: 6, fontWeight: 700 }}>{aviso}</div>
        : ok ? <div style={{ fontSize: 12.5, color: C.green, marginTop: 6, fontWeight: 700, display: "flex", gap: 5, alignItems: "center" }}><Icono n="check" s={13} grosor={3} />{ok}</div>
          : ayuda ? <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>{ayuda}</div> : null}
    </div>
  );
}

function Fijo({ label, valor, ayuda }: { label: string; valor: React.ReactNode; ayuda?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 6, fontWeight: 700 }}>{label}</div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, minHeight: 46, boxSizing: "border-box", padding: "11px 12px",
        background: "rgba(255,255,255,0.025)", border: "1px dashed " + C.border, borderRadius: 11, color: C.text, fontSize: 15.5,
      }}>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</span>
        <Icono n="candado" s={16} style={{ color: C.muted }} />
      </div>
      {ayuda && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>{ayuda}</div>}
    </div>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: "1px solid " + C.border }}>
      <span style={{ width: 118, flexShrink: 0, fontSize: 13, color: C.muted }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.text, lineHeight: 1.45 }}>{children}</span>
    </div>
  );
}

function Nota({ children, color = C.mutedL }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 13, color, lineHeight: 1.5, marginBottom: 14 }}>{children}</div>;
}

function Kpi({ valor, texto, color = C.text }: { valor: string; texto: string; color?: string }) {
  return (
    <div style={{ background: C.bg, border: "1px solid " + C.border, borderRadius: 11, padding: "11px 11px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: C.mutedL, marginTop: 2, lineHeight: 1.35 }}>{texto}</div>
    </div>
  );
}

function Avatar({ u, size, onClick, cargando }: { u: any; size: number; onClick?: () => void; cargando?: boolean }) {
  const contenido = u.avatar_url
    ? <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
    : <span style={{ fontSize: size * 0.34, fontWeight: 900, color: "#1A1200" }}>{iniciales(u.name)}</span>;
  return (
    <button onClick={onClick} disabled={!onClick} aria-label={onClick ? "Cambiar tu foto de perfil" : undefined} style={{
      position: "relative", width: size, height: size, borderRadius: "50%", padding: 0, flexShrink: 0, cursor: onClick ? "pointer" : "default",
      border: "2px solid " + (u.avatar_url ? "rgba(255,215,0,0.7)" : "rgba(255,215,0,0.35)"),
      background: u.avatar_url ? C.card : "linear-gradient(135deg,#FFE38A,#FFB300)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {contenido}
      {onClick && (
        <span style={{
          position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: "50%", background: C.accent, color: "#1A1200",
          display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid " + C.card,
        }}>{cargando ? <span style={{ fontSize: 12, animation: "spin 1s linear infinite" }}>⟳</span> : <Icono n="camara" s={14} grosor={2.2} />}</span>
      )}
    </button>
  );
}

// Vista previa (orientativa) de la web del profesional con sus datos
function VistaWeb({ u, fotos, ficha }: { u: any; fotos: any[]; ficha: any }) {
  const anios = Number(u.experience_years) || 0;
  const ciudad = ficha?.ciudad || u.zone || "";
  const oficio = (u.trade || "Profesional");
  const trabajos: string[] = Array.isArray(ficha?.ficha?.servicios_lista) ? ficha.ficha.servicios_lista.slice(0, 3) : [];
  const huecos = [0, 1, 2].map((k) => fotos[k] || null);
  return (
    <div aria-label="Vista previa de tu web" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.14)", background: "#F7F5F0", color: "#1B1E25", boxShadow: "0 20px 40px -24px rgba(0,0,0,0.9)" }}>
      <div style={{ height: 30, background: "#E7E3DA", display: "flex", alignItems: "center", gap: 6, padding: "0 10px" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}
        <span style={{ flex: 1, marginLeft: 6, background: "#fff", borderRadius: 99, fontSize: 10.5, color: "#6B7280", padding: "3px 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          aficioya.com/pro/{slug((u.name || "") + " " + (u.trade || ""))}
        </span>
      </div>
      <div style={{ height: 58, background: "linear-gradient(120deg,#FFD700 0%,#FF8C00 100%)" }} />
      <div style={{ padding: "0 14px 14px", marginTop: -26 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", border: "3px solid #F7F5F0", overflow: "hidden", background: "linear-gradient(135deg,#FFE38A,#FFB300)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#1A1200", flexShrink: 0 }}>
            {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : iniciales(u.name)}
          </div>
          <span style={{ marginBottom: 4, fontSize: 10.5, fontWeight: 800, color: "#0F7B53", background: "#DDF5EA", borderRadius: 99, padding: "3px 8px" }}>✓ Verificado por OficioYa</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, marginTop: 8, letterSpacing: "-0.01em" }}>{u.company_name && u.company_name !== u.name ? u.company_name : u.name}</div>
        <div style={{ fontSize: 12, color: "#5B6170", marginTop: 1 }}>
          {oficio}{ciudad ? " en " + ciudad : ""}{anios ? " · " + anios + " años de experiencia" : ""}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 8, color: u.bio ? "#2A2F3A" : "#9AA0AA", fontStyle: u.bio ? "normal" : "italic", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
          {u.bio || "Aquí irá tu presentación: quién eres y cómo trabajas."}
        </div>
        {trabajos.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            {trabajos.map((t) => <span key={t} style={{ fontSize: 10, fontWeight: 700, background: "#ECE8DF", color: "#4B5060", borderRadius: 99, padding: "3px 7px" }}>{t}</span>)}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, marginTop: 10 }}>
          {huecos.map((f, k) => (
            <div key={k} style={{ aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", background: f ? "#ddd" : "#ECE8DF", border: f ? "none" : "1px dashed #C9C3B6", display: "flex", alignItems: "center", justifyContent: "center", color: "#A39C8E" }}>
              {f ? <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icono n="camara" s={18} />}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, background: "#1B1E25", color: "#fff", borderRadius: 10, textAlign: "center", fontSize: 12.5, fontWeight: 800, padding: "9px 0" }}>Pedir presupuesto</div>
      </div>
    </div>
  );
}

// ── Pantalla ────────────────────────────────────────────────
export default function ProPerfil({ user, onUpdate, onToast, onLogout, onIrAFacturas, pausada = false, seccion = null, onSeccionVista }: {
  user: any;
  onUpdate: (u: any) => void;
  onToast?: (m: string) => void;
  onLogout: () => void;
  onIrAFacturas?: () => void;
  pausada?: boolean;          // hay otra ventana abierta (presentación, ficha…): la guía espera
  seccion?: string | null;    // abrir directamente un apartado de «Mis datos» (p. ej. "facturacion" desde Facturas)
  onSeccionVista?: () => void;
}) {
  const [u, setU] = useState<any>(user);
  const [parte, setParte] = useState<Parte>("datos");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [ficha, setFicha] = useState<any>(null);
  const [cobro, setCobro] = useState<EstadoCobro | null>(null);
  const [contrato, setContrato] = useState<any>(null);
  const [fotos, setFotos] = useState<any[]>([]);
  const [titulos, setTitulos] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [hist, setHist] = useState<any[]>([]);
  // Guía: «novedades» = aviso obligatorio la primera vez (se puede omitir desde el paso 2); «repaso» = botón «Guía»
  const [guia, setGuia] = useState<"novedades" | "repaso" | null>(null);
  const seccionTrasGuia = useRef<string | null>(null);
  const [editarFicha, setEditarFicha] = useState(false);
  const [verCondiciones, setVerCondiciones] = useState(false);

  // Formularios
  const [tel, setTel] = useState(""); const [wa, setWa] = useState("");
  const [empresa, setEmpresa] = useState(""); const [nif, setNif] = useState(""); const [dir, setDir] = useState("");
  const [cp, setCp] = useState(""); const [ciudad, setCiudad] = useState(""); const [emailF, setEmailF] = useState("");
  const [bio, setBio] = useState(""); const [anios, setAnios] = useState("");
  const [pie, setPie] = useState(""); const [titulo, setTitulo] = useState("");
  const [guardando, setGuardando] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<"avatar" | "foto" | null>(null);
  const [claves, setClaves] = useState({ actual: "", nueva: "", repite: "" });
  const [msgClave, setMsgClave] = useState<{ ok: boolean; t: string } | null>(null);
  const [borrar, setBorrar] = useState<"no" | "preguntar" | "enviado">("no");
  const avatarRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  const rellenar = (x: any) => {
    setTel(x.phone || ""); setWa(x.whatsapp && digitos(x.whatsapp) !== digitos(x.phone) ? x.whatsapp : "");
    setEmpresa(x.company_name || ""); setNif(x.cif || ""); setDir(x.fiscal_address || ""); setCp(x.fiscal_zip || "");
    setCiudad(x.fiscal_city || ""); setEmailF(x.billing_email || "");
    setBio(x.bio || ""); setAnios(Number(x.experience_years) > 0 ? String(x.experience_years) : "");
  };

  const cargar = useCallback(async () => {
    const [us, fi, co, ct, fo, ti, ls, ds] = await Promise.all([
      db.from("users").select(CAMPOS_USUARIO).eq("id", user.id).maybeSingle(),
      db.rpc("oy_ficha_pro", { p_pro: user.id }),
      db.rpc("oy_cobro_estado_pro", { p_pro: user.id }),
      db.rpc("oy_mi_contrato", { p_pro: user.id }),
      db.from("photos").select("*").eq("worker_id", user.id).order("created_at", { ascending: false }),
      db.from("certificates").select("*").eq("worker_id", user.id),
      db.from("pro_leads").select("created_at,estado,presupuesto_eur,price,primer_contacto_at,budget_request_id").eq("pro_id", user.id).eq("anulado", false),
      db.from("deals").select("stage,price,budget_request_id").eq("pro_id", user.id),
    ] as any[]);
    const x = { ...user, ...((us as any).data || {}) };
    setU(x); rellenar(x);
    if (!(fi as any).error) setFicha((fi as any).data || null);
    if (!(co as any).error) setCobro((co as any).data || null);
    if (!(ct as any).error) setContrato((ct as any).data || null);
    setFotos((fo as any).data || []);
    setTitulos((ti as any).data || []);
    const l = (ls as any).data || [];
    const ids = new Set(l.map((y: any) => y.budget_request_id).filter(Boolean));
    setLeads(l);
    setHist(((ds as any).data || []).filter((d: any) => !d.budget_request_id || !ids.has(d.budget_request_id)));
    setCargado(true);
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargar(); }, [cargar]);

  // Si llega para rellenar algo en concreto, se abre ese apartado (si antes tiene que ver las novedades, al acabar)
  useEffect(() => {
    if (!cargado || !seccion) return;
    if (guiaVista(user.id)) irA("datos", seccion);
    else seccionTrasGuia.current = seccion;
    onSeccionVista?.();
  }, [cargado, seccion]); // eslint-disable-line react-hooks/exhaustive-deps

  // La primera vez que entra, sale sí o sí el aviso de las novedades con la guía (espera si hay otra ventana encima)
  useEffect(() => {
    if (!cargado || pausada || guia || guiaVista(user.id)) return;
    const t = setTimeout(() => setGuia("novedades"), 500);
    return () => clearTimeout(t);
  }, [cargado, pausada, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrarGuia = () => {
    try { localStorage.setItem(CLAVE_GUIA + user.id, "1"); } catch { /* nada */ }
    setGuia(null); setParte("datos"); setAbierta(null);
    const pendiente = seccionTrasGuia.current;
    seccionTrasGuia.current = null;
    if (pendiente) { irA("datos", pendiente); return; }
    const s = document.querySelector("[data-scroll]") as HTMLElement | null;
    if (s) s.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardarUsuario = async (clave: string, cambios: Record<string, any>, ok: string) => {
    setGuardando(clave);
    const { error } = await db.from("users").update(cambios).eq("id", user.id);
    setGuardando(null);
    if (error) { onToast?.("No se ha podido guardar. Inténtalo de nuevo."); return false; }
    const nuevo = { ...u, ...cambios };
    setU(nuevo);
    onUpdate({ ...user, ...cambios });
    try { localStorage.setItem("oy_user", JSON.stringify({ ...user, ...cambios })); } catch { /* nada */ }
    onToast?.(ok);
    return true;
  };

  // ── Lo que falta para tener el perfil completo ──
  const conFicha = !!ficha && (ficha.mostrar || ficha.aceptada_at);
  const tareas = useMemo(() => {
    const t = [
      { id: "foto", texto: "Foto de perfil", hecho: !!u.avatar_url, parte: "web" as Parte, sec: "foto" },
      { id: "tel", texto: "Teléfono", hecho: telOk(u.phone || ""), parte: "datos" as Parte, sec: "contacto" },
      { id: "fact", texto: "Datos de facturación", hecho: !!(u.cif && u.fiscal_address && u.fiscal_zip && u.fiscal_city), parte: "datos" as Parte, sec: "facturacion" },
    ];
    if (conFicha) t.push({ id: "ficha", texto: "Tu zona y tus trabajos", hecho: !!ficha.aceptada_at, parte: "datos", sec: "zona" });
    if (cobro) t.push({ id: "tarjeta", texto: "Tarjeta para tus facturas", hecho: !!cobro.tarjeta, parte: "datos", sec: "pagos" });
    t.push(
      { id: "bio", texto: "Tu presentación", hecho: (u.bio || "").trim().length >= 40, parte: "web", sec: "presentacion" },
      { id: "anios", texto: "Años de experiencia", hecho: Number(u.experience_years) > 0, parte: "web", sec: "experiencia" },
      { id: "fotos", texto: "3 fotos de tus trabajos", hecho: fotos.length >= 3, parte: "web", sec: "trabajos" },
    );
    return t;
  }, [u, ficha, cobro, fotos, conFicha]);
  const hechas = tareas.filter((t) => t.hecho).length;
  const pct = Math.round((hechas / tareas.length) * 100);
  const pendientes = tareas.filter((t) => !t.hecho);
  const pendientesDe = (p: Parte) => pendientes.filter((t) => t.parte === p).length;

  const irA = (p: Parte, sec: string) => {
    setParte(p); setAbierta(sec);
    setTimeout(() => {
      const el = document.querySelector('[data-sec="' + sec + '"]') as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };
  const alternar = (id: string) => setAbierta((a) => (a === id ? null : id));

  // ── Resultados (lo que antes era «Tu negocio con OficioYa») ──
  const r = useMemo(() => {
    const ahora = Date.now();
    const gl = leads.filter((l) => l.estado === "ganado");
    const gh = hist.filter((d) => ETAPAS_GANADO_HIST.includes(d.stage));
    const importeLeads = gl.reduce((s, l) => s + Number(l.presupuesto_eur || 0), 0);
    const invertido = leads.reduce((s, l) => s + Number(l.price || 0), 0);
    const tiempos = leads.filter((l) => l.primer_contacto_at)
      .map((l) => (new Date(l.primer_contacto_at).getTime() - new Date(l.created_at).getTime()) / 60000).filter((m) => m >= 0);
    const conImporte = gl.filter((l) => l.presupuesto_eur).length;
    const tasa = leads.length >= 3 ? gl.length / leads.length : null;
    const ult7 = leads.filter((l) => ahora - new Date(l.created_at).getTime() < 7 * DIA).length;
    return {
      clientes: leads.length + hist.length,
      ganados: gl.length + gh.length,
      importe: importeLeads + gh.reduce((s, d) => s + Number(d.price || 0), 0),
      retorno: invertido > 0 && importeLeads > 0 ? importeLeads / invertido : null,
      tasa,
      respuesta: tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null,
      ult7,
      prevision: tasa != null && conImporte ? ult7 * tasa * (importeLeads / conImporte) : null,
    };
  }, [leads, hist]);

  // ── Acciones ──
  const cambiarAvatar = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { onToast?.("La foto pesa demasiado (máx. 8 MB)"); return; }
    setSubiendo("avatar");
    const url = await subirImagen(f, "avatars/" + user.id);
    setSubiendo(null);
    if (!url) { onToast?.("No se ha podido subir la foto. Inténtalo de nuevo."); return; }
    await guardarUsuario("avatar", { avatar_url: url }, "Foto de perfil actualizada");
  };
  const anadirFoto = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { onToast?.("La foto pesa demasiado (máx. 8 MB)"); return; }
    setSubiendo("foto");
    const url = await subirImagen(f, "workers/" + user.id);
    if (!url) { setSubiendo(null); onToast?.("No se ha podido subir la foto. Inténtalo de nuevo."); return; }
    const { data, error } = await db.from("photos").insert({ worker_id: user.id, url, caption: pie.trim() }).select().single();
    setSubiendo(null);
    if (error || !data) { onToast?.("No se ha podido guardar la foto."); return; }
    setFotos((p) => [data, ...p]); setPie(""); onToast?.("Foto añadida");
  };
  const quitarFoto = async (id: string) => {
    const { error } = await db.from("photos").delete().eq("id", id);
    if (error) { onToast?.("No se ha podido quitar la foto."); return; }
    setFotos((p) => p.filter((x) => x.id !== id)); onToast?.("Foto quitada");
  };
  const anadirTitulo = async () => {
    const t = titulo.trim();
    if (!t) return;
    const { data, error } = await db.from("certificates").insert({ worker_id: user.id, name: t, url: "", verified: false }).select().single();
    if (error || !data) { onToast?.("No se ha podido añadir."); return; }
    setTitulos((p) => [...p, data]); setTitulo(""); onToast?.("Título añadido");
  };
  const cambiarClave = async () => {
    if (!claves.actual) { setMsgClave({ ok: false, t: "Escribe tu contraseña actual." }); return; }
    if (claves.nueva.length < 6) { setMsgClave({ ok: false, t: "La nueva contraseña necesita al menos 6 caracteres." }); return; }
    if (claves.nueva !== claves.repite) { setMsgClave({ ok: false, t: "Las dos contraseñas nuevas no coinciden." }); return; }
    setGuardando("clave"); setMsgClave(null);
    try {
      const res = await fetch(FN + "/auth-handler", { method: "POST", headers: CABECERAS_FN, body: JSON.stringify({ action: "change_password", userId: user.id, current: claves.actual, password: claves.nueva }) });
      const j = await res.json().catch(() => ({}));
      if (j.success) { setMsgClave({ ok: true, t: "Contraseña cambiada." }); setClaves({ actual: "", nueva: "", repite: "" }); }
      else setMsgClave({ ok: false, t: j.error || "No se ha podido cambiar. Inténtalo de nuevo." });
    } catch { setMsgClave({ ok: false, t: "Sin conexión. Inténtalo de nuevo." }); }
    setGuardando(null);
  };
  const pedirBorrado = async () => {
    setGuardando("borrar");
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await db.from("users").update({ delete_token: token, delete_requested_at: new Date().toISOString() }).eq("id", user.id);
    await fetch(FN + "/send-delete-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, name: u.name, token }) }).catch(() => {});
    setGuardando(null); setBorrar("enviado");
    setTimeout(() => { try { localStorage.removeItem("oy_user"); } catch { /* nada */ } onLogout(); }, 4000);
  };
  const compartir = async () => {
    const url = "https://aficioya.com/pro/" + slug((u.name || "") + " " + (u.trade || ""));
    try {
      if ((navigator as any).share) await (navigator as any).share({ title: u.name + " · OficioYa", text: "Mira mi perfil en OficioYa", url });
      else { await navigator.clipboard.writeText(url); onToast?.("Enlace copiado"); }
    } catch { /* cancelado */ }
  };

  // ── Estados y resúmenes de cada apartado ──
  const nifEstado = revisarNif(nif);
  const factOk = !!(u.cif && u.fiscal_address && u.fiscal_zip && u.fiscal_city);
  const cambiosContacto = tel.trim() !== (u.phone || "").trim() || (wa.trim() && wa.trim() !== (u.whatsapp || "").trim()) || (!wa.trim() && u.whatsapp && digitos(u.whatsapp) !== digitos(tel));
  const cambiosFact = empresa.trim() !== (u.company_name || "") || nif.trim().toUpperCase() !== (u.cif || "") || dir.trim() !== (u.fiscal_address || "")
    || cp.trim() !== (u.fiscal_zip || "") || ciudad.trim() !== (u.fiscal_city || "") || emailF.trim().toLowerCase() !== (u.billing_email || "");
  const servicios: string[] = Array.isArray(ficha?.ficha?.servicios_lista) ? ficha.ficha.servicios_lista : [];
  const otros = (ficha?.ficha?.servicios_otros || "").trim();
  const zonasTxt = ficha?.ficha?.zonas || (u.service_zones || []).join(", ") || u.zone || "";
  const precio = Number(contrato?.precio ?? u.precio_lead) || 0;
  const contratoFirmado = !!(contrato && contrato.fuente); // fecha exacta solo con firma electrónica
  const tarjetaTxt = cobro?.tarjeta ? (cobro.tarjeta.marca ? cobro.tarjeta.marca.charAt(0).toUpperCase() + cobro.tarjeta.marca.slice(1) : "Tarjeta") + " •••• " + (cobro.tarjeta.ultimos4 || "····") : null;

  // ── Pasos de la guía ──
  const nombre = (u.name || "").trim().split(/\s+/)[0];
  const pasos: PasoGuia[] = [
    guia === "repaso" ? {
      icono: <Icono n="chispa" s={30} />, titulo: "Te enseñamos tu perfil" + (nombre ? ", " + nombre : ""),
      texto: "En un minuto verás qué hay en cada apartado y para qué sirve. Puedes saltarte la guía cuando quieras.",
      boton: "Empezar", secundario: "Ahora no",
    } : {
      icono: <Icono n="chispa" s={30} />, etiqueta: "Novedad", titulo: "Hemos renovado tu perfil" + (nombre ? ", " + nombre : ""),
      texto: <>Ahora está ordenado en dos partes, <b style={{ color: C.text }}>tus datos</b> y <b style={{ color: C.text }}>tu web</b>, con una barra que te dice qué te falta. Te enseñamos los cambios en un minuto.</>,
      boton: "Ver los cambios",
    },
    {
      guia: "progreso", parte: "datos", icono: <Icono n="grafica" />, titulo: "Cómo va tu perfil",
      texto: "Esta barra te dice qué te falta para tenerlo completo. Toca cualquier cosa pendiente y te llevamos directo a rellenarla.",
    },
    {
      guia: "partes", parte: "datos", icono: <Icono n="perfil" />, titulo: "Dos partes: tus datos y tu web",
      texto: <><b style={{ color: C.text }}>Mis datos</b> son privados: solo los vemos tú y OficioYa. <b style={{ color: C.text }}>Mi web</b> es lo que verán tus clientes. El número naranja te dice cuántas cosas te faltan en cada parte.</>,
    },
    {
      guia: "contacto", parte: "datos", icono: <Icono n="perfil" />, titulo: "Datos personales",
      texto: "Tu teléfono es el número en el que te llamamos y te localizamos. Si cambias de número, cámbialo aquí para no perderte nada.",
    },
    {
      guia: "facturacion", parte: "datos", icono: <Icono n="factura" />, titulo: "Datos de facturación",
      texto: "Son los datos que salen en las facturas que te hacemos. Revisa que tu NIF y tu dirección fiscal estén bien.",
    },
    {
      guia: "zona", parte: "datos", icono: <Icono n="mapa" />, titulo: "Tu zona y tus trabajos",
      texto: "Con esto preparamos tus campañas: te llegan clientes de tus zonas y de los trabajos que haces. Puedes cambiarlo cuando quieras.",
    },
    {
      guia: "pagos-contrato", parte: "datos", icono: <Icono n="tarjeta" />, titulo: "Pagos y contrato",
      texto: "Tu tarjeta para que las facturas se paguen solas, tu precio por cliente y tu contrato, siempre a mano.",
    },
    {
      guia: "cuenta", parte: "datos", icono: <Icono n="escudo" />, titulo: "Cuenta y seguridad",
      texto: "Tu email para entrar, tu contraseña y los avisos del móvil para enterarte al momento de cada cliente.",
    },
    {
      guia: "web", parte: "web", icono: <Icono n="web" />, titulo: "Tu web",
      texto: "Tu propia página para enseñar tu trabajo y mandársela a tus clientes. Ya está publicada: aquí tienes su enlace y el enlace para pedir opiniones a tus clientes. Lo que rellenes sale en ella.",
    },
    {
      icono: <Icono n="check" s={30} grosor={2.4} />, titulo: "¡Listo!",
      texto: <>Si tienes cualquier duda, escríbenos en <b style={{ color: C.text }}>Habla con OficioYa</b>, al final de Mis datos. Y si quieres repasar esta guía, toca <b style={{ color: C.text }}>Guía</b> arriba del todo.</>,
      boton: "Ver mi perfil",
    },
  ];

  // ════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: F, paddingBottom: 28 }}>
      <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { cambiarAvatar(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={fotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { anadirFoto(e.target.files?.[0]); e.target.value = ""; }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0 12px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: C.text, margin: 0 }}>Tu perfil</h2>
        <button onClick={() => setGuia("repaso")} style={{
          display: "flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px", borderRadius: 99, cursor: "pointer",
          border: "1px solid " + C.border, background: "rgba(255,255,255,0.04)", color: C.mutedL, fontFamily: F, fontWeight: 800, fontSize: 13,
        }}><Icono n="ayuda" s={17} /> Guía</button>
      </div>

      {/* ── Cabecera: quién eres + lo completo que está tu perfil + las dos partes ── */}
      <div>
        <div data-guia="progreso" style={{
          background: "linear-gradient(160deg,rgba(255,215,0,0.07) 0%,rgba(26,28,36,1) 46%)", border: "1px solid " + C.border,
          borderRadius: 16, padding: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar u={u} size={66} onClick={() => avatarRef.current?.click()} cargando={subiendo === "avatar"} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontWeight: 900, fontSize: 18, letterSpacing: "-0.015em", lineHeight: 1.2 }}>{u.name}</div>
              <div style={{ color: C.mutedL, fontSize: 13.5, marginTop: 3 }}>{[u.trade, ficha?.ciudad || u.zone].filter(Boolean).join(" · ")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {u.verified && <Chip e={{ tipo: "ok", texto: "Verificado" }} />}
                {(u.joined_at || u.created_at) && <Chip e={{ tipo: "info", texto: "Desde " + mesAnio(u.joined_at || u.created_at) }} />}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ color: C.text, fontWeight: 800, fontSize: 14.5 }}>
                {!cargado ? "Mirando tu perfil…" : pct === 100 ? "Tu perfil está completo" : "Tu perfil está al " + pct + " %"}
              </span>
              {cargado && <span style={{ color: C.mutedL, fontSize: 12.5, fontWeight: 700 }}>{hechas} de {tareas.length}</span>}
            </div>
            <div style={{ height: 8, background: C.bg, borderRadius: 99, marginTop: 8, overflow: "hidden" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: (cargado ? pct : 0) + "%", height: "100%", borderRadius: 99, transition: "width .6s ease", background: pct === 100 ? C.green : "linear-gradient(90deg,#FFD700,#FF8C00)" }} />
            </div>
            {cargado && pendientes.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 7, fontWeight: 700 }}>Te falta:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {pendientes.map((t) => (
                    <button key={t.id} onClick={() => irA(t.parte, t.sec)} style={{
                      display: "inline-flex", alignItems: "center", gap: 5, minHeight: 34, padding: "0 11px 0 9px", borderRadius: 99, cursor: "pointer",
                      border: "1px solid " + C.orange + "55", background: C.orange + "14", color: "#FFC27A", fontFamily: F, fontWeight: 800, fontSize: 12.5,
                    }}><Icono n="mas" s={14} grosor={2.6} />{t.texto}</button>
                  ))}
                </div>
              </div>
            )}
            {cargado && pendientes.length === 0 && (
              <div style={{ fontSize: 13, color: C.green, marginTop: 10, fontWeight: 700 }}>Tienes todo al día. Así da gusto.</div>
            )}
          </div>
        </div>

        {/* Las dos partes del perfil */}
        <div data-guia="partes" role="tablist" aria-label="Partes de tu perfil" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 5, marginTop: 12,
          background: C.surface, border: "1px solid " + C.border, borderRadius: 15,
        }}>
          {([["datos", "Mis datos", "Privados", "perfil"], ["web", "Mi web", "La ven tus clientes", "web"]] as const).map(([id, t, sub, ic]) => {
            const act = parte === id;
            const n = cargado ? pendientesDe(id) : 0;
            return (
              <button key={id} role="tab" aria-selected={act} onClick={() => { setParte(id); setAbierta(null); }} style={{
                position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "10px 10px", borderRadius: 11, cursor: "pointer", textAlign: "left",
                border: "1px solid " + (act ? "rgba(255,215,0,0.5)" : "transparent"), background: act ? "rgba(255,215,0,0.11)" : "transparent",
                color: act ? ORO_SUAVE : C.mutedL, fontFamily: F, transition: "all .2s",
              }}>
                <Icono n={ic} s={20} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 900, fontSize: 14.5 }}>{t}</span>
                  <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: act ? "#D9C784" : C.muted, whiteSpace: "nowrap" }}>{sub}</span>
                </span>
                {n > 0 && (
                  <span style={{
                    position: "absolute", top: 7, right: 8, minWidth: 18, height: 18, borderRadius: 99, padding: "0 5px", boxSizing: "border-box",
                    background: C.orange, color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
                  }} aria-label={n + " pendientes"}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═════════════ MIS DATOS ═════════════ */}
      {parte === "datos" && (
        <div role="tabpanel">
          <Grupo>Tus datos</Grupo>

          <Seccion id="contacto" icono="perfil" titulo="Datos personales" abierta={abierta === "contacto"} onAlternar={alternar}
            resumen={[u.phone, u.email].filter(Boolean).join(" · ") || "Tu teléfono y tu email"}
            estado={telOk(u.phone || "") ? { tipo: "ok", texto: "Completo" } : { tipo: "falta", texto: "Falta teléfono" }}>
            <Fijo label="Nombre y apellidos" valor={u.name} ayuda="Es el nombre de tu contrato. Si está mal, escríbenos y lo cambiamos." />
            <Campo id="pf-tel" label="Teléfono" value={tel} onChange={setTel} type="tel" inputMode="tel" autoComplete="tel" placeholder="600 000 000"
              aviso={tel.trim() && !telOk(tel) ? "Revisa el número: tiene que tener 9 cifras." : null}
              ayuda="Es el número en el que te llamamos y te localizamos." />
            <Campo id="pf-wa" label="WhatsApp (si es otro número)" value={wa} onChange={setWa} type="tel" inputMode="tel" placeholder={tel || "El mismo que el teléfono"}
              aviso={wa.trim() && !telOk(wa) ? "Revisa el número: tiene que tener 9 cifras." : null}
              ayuda="Déjalo vacío si usas WhatsApp en el mismo número." />
            <Fijo label="Email para entrar en la app" valor={u.email} ayuda="Para cambiarlo, escríbenos." />
            <div style={{ display: "flex" }}>
              <Boton disabled={!cambiosContacto || !telOk(tel) || (!!wa.trim() && !telOk(wa)) || guardando === "contacto"}
                onClick={() => guardarUsuario("contacto", { phone: tel.trim(), whatsapp: (wa.trim() || tel.trim()) }, "Datos personales guardados")}>
                {guardando === "contacto" ? "Guardando..." : "Guardar cambios"}
              </Boton>
            </div>
          </Seccion>

          <Seccion id="facturacion" icono="factura" titulo="Datos de facturación" abierta={abierta === "facturacion"} onAlternar={alternar}
            resumen={factOk ? [u.cif, [u.fiscal_address, u.fiscal_zip, u.fiscal_city].filter(Boolean).join(", ")].join(" · ") : "Salen en las facturas que te hacemos"}
            estado={factOk ? { tipo: "ok", texto: "Completo" } : { tipo: "falta", texto: !u.cif ? "Falta NIF" : "Falta dirección" }}>
            <Nota>Salen en las facturas que te hacemos cada mes. Si eres autónomo, pon tu nombre completo y tu DNI.</Nota>
            <Campo id="pf-emp" label="Nombre o razón social" value={empresa} onChange={setEmpresa} placeholder="Ej.: Pinturas García S.L." autoComplete="organization" />
            <Campo id="pf-nif" label="NIF / CIF / NIE" value={nif} onChange={(v) => setNif(v.toUpperCase())} placeholder="Ej.: 12345678Z" autoComplete="off"
              aviso={nifEstado === "mal" ? "Revisa el NIF: la letra o algún número no cuadra." : null}
              ok={nifEstado === "ok" ? "NIF correcto" : null} />
            <Campo id="pf-dir" label="Dirección fiscal" value={dir} onChange={setDir} placeholder="Calle, número, piso" autoComplete="street-address" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10 }}>
              <Campo id="pf-cp" label="Código postal" value={cp} onChange={(v) => setCp(v.replace(/[^0-9]/g, "").slice(0, 5))} inputMode="numeric" placeholder="Ej.: 14001" autoComplete="postal-code"
                aviso={cp.trim().length === 5 && !cpOk(cp) ? "No parece un código postal." : null} />
              <Campo id="pf-ciu" label="Ciudad" value={ciudad} onChange={setCiudad} placeholder="Ej.: Sevilla" autoComplete="address-level2" />
            </div>
            <Campo id="pf-ef" label="Email para las facturas" value={emailF} onChange={setEmailF} type="email" inputMode="email" placeholder="facturas@tuempresa.com"
              aviso={emailF.trim() && !emailOk(emailF) ? "Revisa el email." : null} ayuda="Te mandamos aquí cada factura." />
            <div style={{ display: "flex" }}>
              <Boton disabled={!cambiosFact || guardando === "fact" || (!!emailF.trim() && !emailOk(emailF))} onClick={() => guardarUsuario("fact", {
                company_name: empresa.trim() || null, cif: nif.trim().toUpperCase().replace(/[\s.-]/g, "") || null, fiscal_address: dir.trim() || null,
                fiscal_zip: cp.trim() || null, fiscal_city: ciudad.trim() || null, billing_email: emailF.trim().toLowerCase() || null,
              }, "Datos de facturación guardados")}>{guardando === "fact" ? "Guardando..." : "Guardar datos de facturación"}</Boton>
            </div>
          </Seccion>

          <Seccion id="zona" icono="mapa" titulo="Tu zona y tus trabajos" abierta={abierta === "zona"} onAlternar={alternar}
            resumen={zonasTxt ? zonasTxt + (servicios.length ? " · " + servicios.length + " trabajos" : "") : "Dónde trabajas y qué haces"}
            estado={!conFicha ? null : ficha.aceptada_at ? { tipo: "ok", texto: "Confirmada" } : { tipo: "falta", texto: "Sin rellenar" }}>
            <Nota>Con esto preparamos tus campañas: solo te llegan clientes de tus zonas y de los trabajos que haces. Si lo cambias, vale para los clientes que lleguen después.</Nota>
            <Dato label="Zonas">{zonasTxt || "—"}</Dato>
            <Dato label="Trabajos">
              {servicios.length || otros ? (
                <span style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {servicios.map((s) => <span key={s} style={{ fontSize: 12.5, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: C.accent + "18", color: ORO_SUAVE }}>{s}</span>)}
                  {otros && <span style={{ fontSize: 12.5, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "rgba(255,255,255,0.06)", color: C.mutedL }}>{otros}</span>}
                </span>
              ) : (u.specialties || []).join(", ") || "—"}
            </Dato>
            {ficha?.ficha?.capacidad_semana && <Dato label="Clientes a la semana">{ficha.ficha.capacidad_semana}</Dato>}
            {ficha?.ficha && (
              <Dato label="Disponibilidad">
                {[ficha.ficha.horario || null, ficha.ficha.fines_semana ? "Fines de semana" : "Sin fines de semana", ficha.ficha.urgencias_24h ? "Urgencias 24 h" : null].filter(Boolean).join(" · ")}
              </Dato>
            )}
            {ficha?.aceptada_at && <div style={{ fontSize: 12.5, color: C.muted, margin: "10px 0 14px" }}>Confirmada el {fecha(ficha.aceptada_at)}</div>}
            {conFicha && (
              <div style={{ display: "flex", marginTop: ficha?.aceptada_at ? 0 : 14 }}>
                <Boton outline={!!ficha.aceptada_at} onClick={() => setEditarFicha(true)}>{ficha.aceptada_at ? "Cambiar mi zona o mis trabajos" : "Rellenar ahora"}</Boton>
              </div>
            )}
          </Seccion>

          <Grupo>Pagos y contrato</Grupo>
          <div data-guia="pagos-contrato">
            <Seccion id="pagos" icono="tarjeta" titulo="Pago de tus facturas" abierta={abierta === "pagos"} onAlternar={alternar}
              resumen={tarjetaTxt ? tarjetaTxt + " · se pagan solas" : "Guarda tu tarjeta y olvídate"}
              estado={!cobro ? null : cobro.tarjeta ? { tipo: "ok", texto: "Activado" } : { tipo: "falta", texto: "Sin tarjeta" }}>
              <ProTarjeta estado={cobro} onToast={onToast} />
              {onIrAFacturas && <div style={{ display: "flex", marginTop: 4 }}><Boton outline color={C.mutedL} onClick={onIrAFacturas}>Ver mis facturas</Boton></div>}
            </Seccion>

            <Seccion id="contrato" icono="contrato" titulo="Contrato y condiciones" abierta={abierta === "contrato"} onAlternar={alternar}
              resumen={[precio ? euros(precio) + " + IVA por cliente" : null, contratoFirmado ? (contrato.exacta && contrato.fecha ? "firmado el " + fecha(contrato.fecha) : "contrato firmado") : null].filter(Boolean).join(" · ") || "Tu precio y tus condiciones"}
              estado={contratoFirmado ? { tipo: "ok", texto: "Firmado" } : null}>
              {precio > 0 && (
                <div style={{ background: C.bg, border: "1px solid " + C.border, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                  <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 700 }}>Precio por cada cliente que te pasamos</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: "-0.02em" }}>{euros(precio)}</span>
                    <span style={{ fontSize: 13, color: C.mutedL }}>+ IVA ({euros2(precio * 1.21)} en total)</span>
                  </div>
                </div>
              )}
              {contratoFirmado && (
                <Dato label="Contrato">
                  {contrato.exacta && contrato.fecha
                    ? <>Firmado el {fechaLarga(contrato.fecha)}{contrato.hora ? " a las " + contrato.hora : ""}{contrato.fuente === "firma_electronica" ? " con firma electrónica" : ""}</>
                    : "Firmado. Tenemos tu copia firmada."}
                </Dato>
              )}
              {ficha?.aceptada_at && <Dato label="Condiciones">Aceptadas el {fechaLarga(ficha.aceptada_at)} al confirmar tu ficha</Dato>}
              {ficha?.texto && (
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => setVerCondiciones(!verCondiciones)} style={{
                    display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer",
                    color: C.accent, fontFamily: F, fontWeight: 800, fontSize: 13.5,
                  }}>
                    <Icono n="flecha" s={16} style={{ transform: verCondiciones ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
                    {verCondiciones ? "Ocultar" : "Leer"} qué clientes se pagan y cuáles no
                  </button>
                  {verCondiciones && (
                    <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: C.mutedL, background: C.bg, border: "1px solid " + C.border, borderRadius: 12, padding: 12 }}>{ficha.texto}</div>
                  )}
                </div>
              )}
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 14, lineHeight: 1.5 }}>¿Quieres una copia de tu contrato? Pídela en <b style={{ color: C.mutedL }}>Habla con OficioYa</b> y te la mandamos.</div>
            </Seccion>
          </div>

          <Grupo>Tu negocio</Grupo>
          <Seccion id="resultados" icono="grafica" titulo="Tus resultados con OficioYa" abierta={abierta === "resultados"} onAlternar={alternar}
            resumen={r.clientes ? r.clientes + " clientes · " + r.ganados + " ganados" + (r.importe ? " · " + euros(r.importe) : "") : "Aún no te ha llegado ningún cliente"}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Kpi valor={String(r.clientes)} texto="Clientes que te ha pasado OficioYa" />
              <Kpi valor={String(r.ganados)} texto="Trabajos ganados" color={C.green} />
              <Kpi valor={r.importe ? euros(r.importe) : "—"} texto="En trabajos cerrados" color={C.green} />
              <Kpi valor={r.retorno ? r.retorno.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " €" : "—"} texto="En trabajos por cada 1 € en clientes" color={C.accent} />
              <Kpi valor={r.tasa != null ? Math.round(r.tasa * 100) + " %" : "—"} texto="De tus clientes acaban en trabajo" />
              <Kpi valor={r.respuesta != null ? duracionMin(r.respuesta) : "—"} texto="Tardas de media en llamar" />
            </div>
            <div style={{ fontSize: 13, color: C.mutedL, marginTop: 12, lineHeight: 1.5 }}>
              Últimos 7 días: <b style={{ color: C.text }}>{r.ult7} {r.ult7 === 1 ? "cliente" : "clientes"}</b>
              {r.prevision ? <> · con tu tasa de cierre, unos <b style={{ color: C.green }}>{euros(r.prevision)}</b> en trabajos la semana que viene.</> : "."}
            </div>
            {(r.retorno == null || r.tasa == null) && (
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>Marca tus clientes como «Ganado» con su importe en Leads para ver tu retorno.</div>
            )}
          </Seccion>

          <Grupo>Cuenta</Grupo>
          <Seccion id="cuenta" icono="escudo" titulo="Cuenta y seguridad" abierta={abierta === "cuenta"} onAlternar={alternar}
            resumen={"Entras con " + (u.email || "tu email")}>
            <Fijo label="Email para entrar" valor={u.email} />
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "4px 0 10px" }}>Cambiar contraseña</div>
            <Campo id="pf-c0" label="Contraseña actual" type="password" autoComplete="current-password" value={claves.actual} onChange={(v) => setClaves({ ...claves, actual: v })} />
            <Campo id="pf-c1" label="Contraseña nueva" type="password" autoComplete="new-password" value={claves.nueva} onChange={(v) => setClaves({ ...claves, nueva: v })} ayuda="Mínimo 6 caracteres." />
            <Campo id="pf-c2" label="Repite la contraseña nueva" type="password" autoComplete="new-password" value={claves.repite} onChange={(v) => setClaves({ ...claves, repite: v })} />
            {msgClave && <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: msgClave.ok ? C.green : C.red, marginBottom: 10 }}>{msgClave.t}</div>}
            <div style={{ display: "flex" }}>
              <Boton outline disabled={guardando === "clave" || !claves.nueva} onClick={cambiarClave}>{guardando === "clave" ? "Guardando..." : "Cambiar contraseña"}</Boton>
            </div>

            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "22px 0 10px" }}>Avisos en el móvil</div>
            <TarjetaPush userId={user.id} onToast={onToast} />

            <div style={{ borderTop: "1px solid " + C.border, marginTop: 14, paddingTop: 12 }}>
              {borrar === "no" && (
                <button onClick={() => setBorrar("preguntar")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.muted, fontFamily: F, fontSize: 12.5, textDecoration: "underline" }}>
                  Eliminar mi cuenta
                </button>
              )}
              {borrar === "preguntar" && (
                <div style={{ background: C.red + "0F", border: "1px solid " + C.red + "33", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 13, color: C.mutedL, lineHeight: 1.5, marginBottom: 10 }}>
                    Si eliminas tu cuenta perderás el acceso a tus datos. Te mandaremos un email para confirmarlo. Si tienes un contrato en vigor, escríbenos antes en <b>Habla con OficioYa</b>.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Boton small outline color={C.mutedL} onClick={() => setBorrar("no")}>Cancelar</Boton>
                    <Boton small color={C.red} disabled={guardando === "borrar"} onClick={pedirBorrado}>{guardando === "borrar" ? "Enviando..." : "Sí, eliminar"}</Boton>
                  </div>
                </div>
              )}
              {borrar === "enviado" && <div style={{ fontSize: 13, color: C.mutedL }}>Te hemos mandado un email para confirmarlo. Cerrando sesión…</div>}
            </div>
          </Seccion>

          <div data-guia="ayuda" style={{ marginTop: 18 }}>
            <ProChatOficioYa user={{ id: user.id, name: u.name }} onToast={onToast} />
          </div>

          <button onClick={onLogout} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 48, marginTop: 8,
            borderRadius: 13, border: "1px solid " + C.red + "55", background: "transparent", color: "#FF7B87", fontFamily: F, fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}><Icono n="salir" s={18} /> Cerrar sesión</button>
        </div>
      )}

      {/* ═════════════ MI WEB ═════════════ */}
      {parte === "web" && (
        <div role="tabpanel">
          <div style={{ marginTop: 14 }}>
            <Card style={{ padding: 16, borderRadius: 16, marginBottom: 0 }}>
              <div data-guia="web">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Baldosa n="web" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", color: C.text, fontWeight: 900, fontSize: 16.5 }}>Tu web profesional</span>
                    <span style={{ display: "block", color: C.mutedL, fontSize: 12.5, marginTop: 2 }}>Una página solo tuya, para tus clientes</span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 900, padding: "5px 9px", borderRadius: 99, background: C.green, color: "#062A1E", whiteSpace: "nowrap" }}>Publicada</span>
                </div>
                <div style={{ fontSize: 13.5, color: C.mutedL, lineHeight: 1.55, margin: "12px 0 0" }}>
                  Con tus trabajos, tu presentación y las opiniones de tus clientes, para mandarla por WhatsApp o ponerla en tus redes. Ya está publicada: lo que rellenes aquí sale en ella.
                </div>
              </div>
              <div style={{ height: 14 }} />
              <VistaWeb u={u} fotos={fotos} ficha={ficha} />
              <div style={{ fontSize: 11.5, color: C.muted, textAlign: "center", marginTop: 8 }}>Vista previa con tus datos</div>
            </Card>
          </div>

          {/* 11/11/2026: enlace a su web, enlace para pedir opiniones (WhatsApp) y sus opiniones */}
          <div style={{ marginTop: 14 }}><ProMiWeb user={u} /></div>

          <Grupo>Ve preparándola</Grupo>

          <Seccion id="foto" icono="camara" titulo="Foto de perfil" abierta={abierta === "foto"} onAlternar={alternar}
            resumen={u.avatar_url ? "Puesta" : "Una foto tuya da confianza"}
            estado={u.avatar_url ? { tipo: "ok", texto: "Hecho" } : { tipo: "falta", texto: "Falta" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <Avatar u={u} size={72} />
              <div style={{ fontSize: 13, color: C.mutedL, lineHeight: 1.5 }}>Mejor una foto tuya, de frente y con buena luz. Si trabajas con un logo, también vale.</div>
            </div>
            <div style={{ display: "flex" }}>
              <Boton disabled={subiendo === "avatar"} onClick={() => avatarRef.current?.click()}>
                <Icono n="camara" s={17} grosor={2.1} />{subiendo === "avatar" ? "Subiendo..." : u.avatar_url ? "Cambiar foto" : "Subir foto"}
              </Boton>
            </div>
          </Seccion>

          <Seccion id="presentacion" icono="texto" titulo="Tu presentación" abierta={abierta === "presentacion"} onAlternar={alternar}
            resumen={u.bio ? u.bio : "Quién eres y cómo trabajas, en 2 o 3 frases"}
            estado={(u.bio || "").trim().length >= 40 ? { tipo: "ok", texto: "Hecho" } : { tipo: "falta", texto: "Falta" }}>
            <Nota>Cuenta desde cuándo trabajas, qué haces mejor y qué te diferencia. Es lo primero que leerán tus clientes.</Nota>
            <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 500))} rows={5}
              placeholder={"Ej.: Pintor en " + (ficha?.ciudad || u.zone || "tu ciudad") + " desde 2010. Pisos, fachadas y lacados. Protejo muebles y suelos, cumplo los plazos y dejo la casa recogida."}
              style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: "1px solid " + C.border, borderRadius: 11, color: C.text, padding: "11px 12px", fontFamily: F, fontSize: 15.5, lineHeight: 1.5, resize: "vertical", outline: "none" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: bio.trim().length >= 40 ? C.muted : C.orange, margin: "6px 0 12px" }}>
              <span>{bio.trim().length < 40 ? "Escribe al menos 40 caracteres" : "Perfecto"}</span><span>{bio.length}/500</span>
            </div>
            <div style={{ display: "flex" }}>
              <Boton disabled={bio.trim() === (u.bio || "").trim() || guardando === "bio"} onClick={() => guardarUsuario("bio", { bio: bio.trim() }, "Presentación guardada")}>
                {guardando === "bio" ? "Guardando..." : "Guardar presentación"}
              </Boton>
            </div>
          </Seccion>

          <Seccion id="experiencia" icono="medalla" titulo="Años de experiencia" abierta={abierta === "experiencia"} onAlternar={alternar}
            resumen={Number(u.experience_years) > 0 ? u.experience_years + " años en el oficio" : "Cuántos años llevas en el oficio"}
            estado={Number(u.experience_years) > 0 ? { tipo: "ok", texto: "Hecho" } : { tipo: "falta", texto: "Falta" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <button aria-label="Un año menos" onClick={() => setAnios(String(Math.max(0, (parseInt(anios, 10) || 0) - 1)))} style={{ width: 46, height: 46, borderRadius: 11, border: "1px solid " + C.border, background: C.bg, color: C.text, fontSize: 22, cursor: "pointer" }}>−</button>
              <input value={anios} onChange={(e) => setAnios(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} inputMode="numeric" placeholder="0" aria-label="Años de experiencia"
                style={{ width: 80, height: 46, boxSizing: "border-box", textAlign: "center", background: C.bg, border: "1px solid " + C.border, borderRadius: 11, color: C.text, fontFamily: F, fontSize: 20, fontWeight: 800, outline: "none" }} />
              <button aria-label="Un año más" onClick={() => setAnios(String(Math.min(60, (parseInt(anios, 10) || 0) + 1)))} style={{ width: 46, height: 46, borderRadius: 11, border: "1px solid " + C.border, background: C.bg, color: C.text, fontSize: 22, cursor: "pointer" }}>+</button>
              <span style={{ fontSize: 14, color: C.mutedL }}>años</span>
            </div>
            <div style={{ display: "flex" }}>
              <Boton disabled={(parseInt(anios, 10) || 0) === (Number(u.experience_years) || 0) || guardando === "anios"} onClick={() => guardarUsuario("anios", { experience_years: parseInt(anios, 10) || 0 }, "Experiencia guardada")}>
                {guardando === "anios" ? "Guardando..." : "Guardar"}
              </Boton>
            </div>
          </Seccion>

          <Seccion id="trabajos" icono="fotos" titulo="Fotos de tus trabajos" abierta={abierta === "trabajos"} onAlternar={alternar}
            resumen={fotos.length ? fotos.length + (fotos.length === 1 ? " foto" : " fotos") + (fotos.length < 3 ? " · te recomendamos 3 o más" : "") : "Enseña lo que haces: mínimo 3"}
            estado={fotos.length >= 3 ? { tipo: "ok", texto: "Hecho" } : { tipo: "falta", texto: fotos.length + " de 3" }}>
            <Nota>Con buena luz y la obra terminada. Si tienes el antes y el después, mejor aún.</Nota>
            {fotos.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
                {fotos.map((f) => (
                  <div key={f.id} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 10, overflow: "hidden", background: C.bg, border: "1px solid " + C.border }}>
                    <img src={f.url} alt={f.caption || "Trabajo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button onClick={() => quitarFoto(f.id)} aria-label="Quitar esta foto" style={{
                      position: "absolute", top: 5, right: 5, width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
                      background: "rgba(0,0,0,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    }}><Icono n="papelera" s={15} /></button>
                  </div>
                ))}
              </div>
            )}
            <Campo id="pf-pie" label="Qué se ve en la foto (opcional)" value={pie} onChange={setPie} placeholder="Ej.: Salón en blanco roto, Ciudad Jardín" />
            <div style={{ display: "flex" }}>
              <Boton disabled={subiendo === "foto"} onClick={() => fotoRef.current?.click()}>
                <Icono n="mas" s={17} grosor={2.4} />{subiendo === "foto" ? "Subiendo..." : "Añadir foto"}
              </Boton>
            </div>
          </Seccion>

          <Seccion id="titulos" icono="titulo" titulo="Títulos y certificados" abierta={abierta === "titulos"} onAlternar={alternar}
            resumen={titulos.length ? titulos.map((t) => t.name).join(" · ") : "Opcional: cursos, carnés, certificados"}
            estado={titulos.length ? { tipo: "ok", texto: String(titulos.length) } : { tipo: "info", texto: "Opcional" }}>
            {titulos.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 10, marginBottom: 8 }}>
                <Icono n="titulo" s={18} style={{ color: C.accent }} />
                <span style={{ flex: 1, fontSize: 14, color: C.text }}>{t.name}</span>
                {t.verified && <Chip e={{ tipo: "ok", texto: "Verificado" }} />}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Campo id="pf-tit" label="Añadir título o certificado" value={titulo} onChange={setTitulo} placeholder="Ej.: Curso de aplicador de microcemento" />
              </div>
              <div style={{ width: 96, display: "flex", marginBottom: 14 }}>
                <Boton disabled={!titulo.trim()} onClick={anadirTitulo}>Añadir</Boton>
              </div>
            </div>
          </Seccion>

        </div>
      )}

      {editarFicha && <ProFicha userId={user.id} abrir onCerrar={(g) => { setEditarFicha(false); if (g) cargar(); }} />}
      {guia && <ProPerfilGuia pasos={pasos} omitibleDesde={guia === "novedades" ? 2 : 0} onTerminar={cerrarGuia} onParte={(p) => { setParte(p); setAbierta(null); }} />}
    </div>
  );
}
