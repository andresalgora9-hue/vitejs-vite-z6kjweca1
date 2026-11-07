// ============================================================
// OficioYa · ADMIN — ARCHIVOS (como el explorador del ordenador)
// Contratos, facturas y papeles en carpetas. Lo que se sube va a un almacén
// privado (bucket «archivos», enlaces firmados de 1 h). Las facturas emitidas
// y los contratos firmados salen solos en la carpeta de cada profesional.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, SUPABASE_KEY } from "../supabase";
import { dibujarFactura } from "../pro/facturaPdf";
import { C, F, Btn, Pill, Cabecera, Modal, Sel, Campo, Respuesta, SeccionProps, useAncho, eur, SUPABASE_FN, Pro } from "./apUi";
import { claveAdmin, FormApunte, Apunte, hoyMadrid, trimestreDe } from "./apFiscal";

// ── TIPOS ───────────────────────────────────────────────────
export interface ArchivoReal {
  id: string; carpeta: string; nombre: string; mime: string | null; tamano: number | null; tipo: string;
  fecha_doc: string | null; notas: string | null; pro_id: string | null; origen: string; subido_por: string | null;
  created_at: string; updated_at: string; papelera_at: string | null; miniatura: boolean; apunte_id: string | null;
}
export interface ArchivoSistema {
  id: string; fuente: "factura" | "contrato"; ref: string; carpeta: string; nombre: string; fecha: string; tipo: string;
  mime: string; tamano?: number | null; importe?: number; estado?: string; pro_id?: string | null; concepto?: string;
  cliente?: string | null; profesional?: string | null; quien?: string | null; oficio?: string | null; ciudad?: string | null;
  firma?: boolean; plantilla?: boolean; original?: string | null;
}
interface Listado { carpetas: string[]; archivos: ArchivoReal[]; sistema: ArchivoSistema[]; }
interface Elem {
  key: string; nombre: string; carpeta: string; fecha: string; tamano: number | null; mime: string; tipo: string;
  real?: ArchivoReal; sis?: ArchivoSistema;
}

export const TIPOS_DOC: { v: string; l: string }[] = [
  { v: "contrato", l: "Contrato" },
  { v: "factura_emitida", l: "Factura emitida" },
  { v: "factura_recibida", l: "Factura de gasto" },
  { v: "ticket", l: "Ticket o recibo" },
  { v: "impuesto", l: "Impuestos (modelos, pagos)" },
  { v: "banco", l: "Banco y pagos" },
  { v: "legal", l: "Legal y administración" },
  { v: "otro", l: "Otro" },
];
const nombreTipo = (t: string) => TIPOS_DOC.find((x) => x.v === t)?.l || "Otro";
const FISCALES = ["factura_emitida", "factura_recibida", "ticket"];

const RAIZ_ORDEN = ["Profesionales", "Contratos", "Facturas recibidas", "Facturas emitidas", "Impuestos", "Banco y pagos", "Legal y administración", "Otros"];
const PAPELERA = "__papelera";
const esSistema = (r: string) => ["Profesionales", "Contratos", "Contratos/Modelos"].includes(r) || /^Profesionales\/[^/]+(\/(Facturas|Contratos))?$/.test(r);

// ── UTILIDADES ──────────────────────────────────────────────
// Misma regla que archivos_nombre_pro en la base de datos
export const nombrePro = (nombre: string | null | undefined, empresa: string | null | undefined) => {
  const n = (nombre || "").trim() || "Sin nombre";
  const e = (empresa || "").trim();
  const s = (n + (e && e.toLowerCase() !== (nombre || "").trim().toLowerCase() ? " · " + e : "")).trim();
  return s.replace(/[\/\\]+/g, "-").replace(/\s+/g, " ").slice(0, 80).trim();
};
export const limpiarRuta = (p: string) =>
  String(p || "").replace(/\\/g, "/").split("/").map((s) => s.trim().replace(/\s+/g, " ").slice(0, 80)).filter((s) => s && s !== "." && s !== "..").join("/");
const padre = (r: string) => (r.includes("/") ? r.slice(0, r.lastIndexOf("/")) : "");
const hoja = (r: string) => (r.includes("/") ? r.slice(r.lastIndexOf("/") + 1) : r);
const sinTildes = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const tamanoTxt = (b: number | null | undefined) => {
  const n = Number(b) || 0;
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
  return (n / 1024 / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " MB";
};
const fechaCorta = (ymd: string) => (ymd ? ymd.slice(8, 10) + "/" + ymd.slice(5, 7) + "/" + ymd.slice(2, 4) : "—");
export const tipoPorCarpeta = (r: string) => {
  if (/(^|\/)Contratos(\/|$)/.test(r)) return "contrato";
  if (/^Facturas recibidas/.test(r)) return "factura_recibida";
  if (/^Facturas emitidas/.test(r) || /^Profesionales\/[^/]+\/Facturas/.test(r)) return "factura_emitida";
  if (/^Impuestos/.test(r)) return "impuesto";
  if (/^Banco/.test(r)) return "banco";
  if (/^Legal/.test(r)) return "legal";
  return "otro";
};

export async function fnArchivos(accion: string, body: Record<string, unknown> = {}) {
  const res = await fetch(SUPABASE_FN + "/archivos", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
    body: JSON.stringify({ accion, clave: claveAdmin(), ...body }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j.error || "Error " + res.status);
  return j;
}

const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
function cargarJsPDF(): Promise<any> {
  const w = window as any;
  if (w.jspdf?.jsPDF) return Promise.resolve(w.jspdf.jsPDF);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = JSPDF_URL;
    s.onload = () => (w.jspdf?.jsPDF ? resolve(w.jspdf.jsPDF) : reject(new Error("PDF no disponible")));
    s.onerror = () => reject(new Error("No se ha podido cargar el generador de PDF"));
    document.head.appendChild(s);
  });
}

function leerImagen(f: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se puede leer la imagen")); };
    img.src = url;
  });
}
function lienzo(img: HTMLImageElement, maxLado: number) {
  const r = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * r));
  const h = Math.max(1, Math.round(img.naturalHeight * r));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}
const aBlob = (c: HTMLCanvasElement, calidad: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo comprimir"))), "image/jpeg", calidad));

interface Preparada { blob: Blob; ancho: number; alto: number; mini: string | null; }
// Foto lista para guardar: JPEG de 2400 px como mucho (se lee bien un contrato) + miniatura
async function prepararImagen(f: File): Promise<Preparada | null> {
  try {
    const img = await leerImagen(f);
    const grande = lienzo(img, 2400);
    const blob = await aBlob(grande, 0.84);
    const mini = lienzo(img, 360).toDataURL("image/jpeg", 0.7);
    // Si la foto original ya era pequeña y ocupa menos, se queda la original
    const final = f.type === "image/jpeg" && f.size <= blob.size ? f : blob;
    return { blob: final, ancho: grande.width, alto: grande.height, mini: mini.length <= 110000 ? mini : null };
  } catch { return null; }
}
async function fotosAPdf(fotos: Preparada[]): Promise<Blob> {
  const JsPDF = await cargarJsPDF();
  let doc: any = null;
  for (const p of fotos) {
    const horiz = p.ancho > p.alto;
    const W = horiz ? 297 : 210, H = horiz ? 210 : 297;
    if (!doc) doc = new JsPDF({ unit: "mm", format: "a4", orientation: horiz ? "landscape" : "portrait", compress: true });
    else doc.addPage("a4", horiz ? "landscape" : "portrait");
    const r = Math.min(W / p.ancho, H / p.alto);
    const w = p.ancho * r, h = p.alto * r;
    const datos = new Uint8Array(await p.blob.arrayBuffer());
    doc.addImage(datos, "JPEG", (W - w) / 2, (H - h) / 2, w, h, undefined, "FAST");
  }
  return doc.output("blob");
}
async function sha256Hex(b: Blob) {
  try {
    const h = await crypto.subtle.digest("SHA-256", await b.arrayBuffer());
    return Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}
const conExtension = (nombre: string, ext: string) => nombre.replace(/\.[A-Za-z0-9]{1,6}$/, "") + ext;

// Sube un archivo ya preparado: ficha → enlace firmado → subida → confirmación
export async function subirArchivo(blob: Blob, meta: { nombre: string; carpeta: string; tipo: string; fecha_doc?: string | null; notas?: string | null; pro_id?: string | null; miniatura?: string | null; mime?: string }) {
  const mime = meta.mime || blob.type || "application/octet-stream";
  const r = await fnArchivos("subir", { ...meta, mime, tamano: blob.size });
  const { error } = await db.storage.from("archivos").uploadToSignedUrl(r.path, r.token, blob, { contentType: mime, upsert: false });
  if (error) {
    await fnArchivos("cancelar", { id: r.id }).catch(() => undefined);
    throw new Error(error.message || "No se ha podido subir");
  }
  await fnArchivos("confirmar", { id: r.id, sha256: await sha256Hex(blob) });
  return r.id as string;
}

// ── ICONOS ──────────────────────────────────────────────────
function IconoCarpeta({ size = 46, color = C.accent }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 48 40" width={size} height={size * 40 / 48} aria-hidden>
      <path d="M3 7a4 4 0 0 1 4-4h11l4 4.5h19a4 4 0 0 1 4 4V33a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill={color} opacity="0.22" />
      <path d="M3 13.5a4 4 0 0 1 4-4h34a4 4 0 0 1 4 4V33a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill={color} opacity="0.55" />
    </svg>
  );
}
function IconoArchivo({ mime, nombre, size = 40 }: { mime: string | null; nombre: string; size?: number }) {
  const m = (mime || "").toLowerCase();
  const ext = (nombre.match(/\.([a-z0-9]{1,5})$/i)?.[1] || "").toUpperCase();
  const [col, et] = m.includes("pdf") ? [C.red, "PDF"]
    : m.startsWith("image/") ? [C.blue, ext || "IMG"]
    : /sheet|excel|csv/.test(m) || ["XLS", "XLSX", "CSV", "ODS"].includes(ext) ? [C.green, ext || "XLS"]
    : /word|document|text/.test(m) || ["DOC", "DOCX", "ODT", "TXT"].includes(ext) ? [C.blue, ext || "DOC"]
    : [C.mutedL, ext || "ARCH"];
  return (
    <svg viewBox="0 0 40 48" width={size} height={size * 48 / 40} aria-hidden>
      <path d="M6 2h20l10 10v32a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill={C.cardHi} stroke={C.border} strokeWidth="1.5" />
      <path d="M26 2v10h10" fill="none" stroke={C.border} strokeWidth="1.5" />
      <rect x="4" y="27" width="28" height="12" rx="2" fill={col} />
      <text x="18" y="36" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff" fontFamily="DM Sans, sans-serif">{et.slice(0, 4)}</text>
    </svg>
  );
}

// ── SUBIR ARCHIVOS ──────────────────────────────────────────
export function Subida({ carpetas, carpetaInicial, tipoInicial, archivosIniciales, pros, onClose, onHecho }: {
  carpetas: string[];
  carpetaInicial: string;
  tipoInicial?: string;
  archivosIniciales?: File[];
  pros: Pro[];
  onClose: () => void;
  onHecho: (ids: string[], tipo: string, mensaje: string) => void;
}) {
  const [lista, setLista] = useState<{ f: File; url: string | null }[]>(() =>
    (archivosIniciales || []).map((f) => ({ f, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null })));
  const [carpeta, setCarpeta] = useState(carpetaInicial || "");
  const [tipo, setTipo] = useState(tipoInicial || tipoPorCarpeta(carpetaInicial || ""));
  const [proId, setProId] = useState("");
  const [fechaDoc, setFechaDoc] = useState("");
  const [notas, setNotas] = useState("");
  const [juntar, setJuntar] = useState(true);
  const [nombrePdf, setNombrePdf] = useState("");
  const [estado, setEstado] = useState<Record<number, string>>({});
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState("");
  const inputArch = useRef<HTMLInputElement>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const anadir = useCallback((fs: File[]) => {
    setLista((l) => [...l, ...fs.map((f) => ({ f, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null }))]);
  }, []);
  useEffect(() => () => { lista.forEach((x) => x.url && URL.revokeObjectURL(x.url)); }, []); // eslint-disable-line

  const imagenes = lista.filter((x) => x.f.type.startsWith("image/"));
  const unirFotos = imagenes.length >= 2 && juntar;
  const proSel = pros.find((p) => p.id === proId) || null;
  const sub = (t: string) => (t === "contrato" ? "Contratos" : t === "factura_emitida" || t === "factura_recibida" ? "Facturas" : "Documentos");

  const elegirPro = (id: string) => {
    setProId(id);
    const p = pros.find((x) => x.id === id);
    if (p) setCarpeta("Profesionales/" + nombrePro(p.name, p.company_name) + "/" + sub(tipo));
  };
  const elegirTipo = (t: string) => {
    setTipo(t);
    if (proSel && /^Profesionales\//.test(carpeta)) setCarpeta("Profesionales/" + nombrePro(proSel.name, proSel.company_name) + "/" + sub(t));
  };
  const nombrePorDefecto = () => {
    const base = tipo === "contrato" ? "Contrato firmado" : tipo === "factura_recibida" ? "Factura" : tipo === "factura_emitida" ? "Factura emitida" : tipo === "otro" ? "Documento" : nombreTipo(tipo);
    return base + (proSel ? " - " + proSel.name : "") + " - " + (fechaDoc || hoyMadrid()).split("-").reverse().join("-") + ".pdf";
  };
  const mover = (i: number, d: number) => setLista((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const subir = async () => {
    setErr("");
    if (!lista.length) { setErr("Elige al menos un archivo"); return; }
    const big = lista.find((x) => x.f.size > 50 * 1024 * 1024);
    if (big) { setErr(big.f.name + " pesa más de 50 MB"); return; }
    setSubiendo(true);
    const ids: string[] = [];
    const meta = { carpeta: limpiarRuta(carpeta), tipo, fecha_doc: fechaDoc || null, notas: notas.trim() || null, pro_id: proId || null };
    try {
      if (unirFotos) {
        // Todas las fotos en un PDF (en el orden de la lista); lo demás, por separado
        const prep: Preparada[] = [];
        const sueltas: File[] = [];
        for (let i = 0; i < lista.length; i++) {
          const x = lista[i];
          if (!x.f.type.startsWith("image/")) continue;
          setEstado((e) => ({ ...e, [i]: "Preparando…" }));
          const p = await prepararImagen(x.f);
          if (p) { prep.push(p); setEstado((e) => ({ ...e, [i]: "En el PDF" })); }
          else { sueltas.push(x.f); setEstado((e) => ({ ...e, [i]: "No se puede leer: va aparte" })); }
        }
        if (prep.length) {
          const pdf = await fotosAPdf(prep);
          const nombre = conExtension((nombrePdf.trim() || nombrePorDefecto()), ".pdf");
          ids.push(await subirArchivo(pdf, { ...meta, nombre, miniatura: prep[0].mini, mime: "application/pdf" }));
        }
        for (let i = 0; i < lista.length; i++) {
          const x = lista[i];
          if (x.f.type.startsWith("image/") && !sueltas.includes(x.f)) continue;
          setEstado((e) => ({ ...e, [i]: "Subiendo…" }));
          ids.push(await subirArchivo(x.f, { ...meta, nombre: x.f.name, mime: x.f.type || undefined }));
          setEstado((e) => ({ ...e, [i]: "Subido" }));
        }
        lista.forEach((x, i) => x.f.type.startsWith("image/") && !sueltas.includes(x.f) && setEstado((e) => ({ ...e, [i]: "Subido en el PDF" })));
      } else {
        for (let i = 0; i < lista.length; i++) {
          const x = lista[i];
          setEstado((e) => ({ ...e, [i]: "Subiendo…" }));
          if (x.f.type.startsWith("image/")) {
            const p = await prepararImagen(x.f);
            if (p) ids.push(await subirArchivo(p.blob, { ...meta, nombre: p.blob === x.f ? x.f.name : conExtension(x.f.name, ".jpg"), miniatura: p.mini, mime: p.blob.type || "image/jpeg" }));
            else ids.push(await subirArchivo(x.f, { ...meta, nombre: x.f.name, mime: x.f.type || undefined }));
          } else {
            ids.push(await subirArchivo(x.f, { ...meta, nombre: x.f.name, mime: x.f.type || undefined }));
          }
          setEstado((e) => ({ ...e, [i]: "Subido" }));
        }
      }
      setSubiendo(false);
      onHecho(ids, tipo, ids.length === 1 ? "Archivo guardado" : ids.length + " archivos guardados");
    } catch (e: any) {
      setSubiendo(false);
      setErr((e?.message || "No se ha podido subir") + (ids.length ? ` (se guardaron ${ids.length} antes del fallo)` : ""));
    }
  };

  const opcionesCarpeta = Array.from(new Set(["", ...carpetas, carpeta].filter((x) => x !== undefined))).sort((a, b) => a.localeCompare(b, "es"));
  const etiqueta = (t: string) => <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>{t}</label>;
  const selSt = { width: "100%", marginBottom: 12, padding: "10px 10px" };
  const prosOrden = [...pros].sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

  return (
    <Modal titulo="Subir archivos" onClose={subiendo ? () => undefined : onClose} ancho={620}>
      <div
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); anadir(Array.from(e.dataTransfer.files || [])); }}
        style={{ border: "2px dashed " + C.border, borderRadius: 12, padding: "18px 14px", textAlign: "center", marginBottom: 14, background: C.card }}>
        <div style={{ fontSize: 13.5, color: C.mutedL, marginBottom: 10 }}>Arrastra aquí los archivos o</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn small onClick={() => inputArch.current?.click()}>Elegir archivos</Btn>
          <Btn small outline onClick={() => inputFoto.current?.click()}>📷 Hacer foto</Btn>
        </div>
        <input ref={inputArch} type="file" multiple hidden accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.odt,.ods,.zip,.xml"
          onChange={(e) => { anadir(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <input ref={inputFoto} type="file" hidden accept="image/*" capture="environment"
          onChange={(e) => { anadir(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Fotos de un contrato: hazlas una a una y se juntan en un PDF.</div>
      </div>

      {lista.length > 0 && (
        <div style={{ border: "1px solid " + C.border, borderRadius: 10, marginBottom: 14, maxHeight: 230, overflowY: "auto" }}>
          {lista.map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderTop: i ? "1px solid " + C.border + "88" : undefined }}>
              {x.url ? <img src={x.url} alt="" style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                : <IconoArchivo mime={x.f.type} nombre={x.f.name} size={30} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.f.name}</div>
                <div style={{ fontSize: 11.5, color: estado[i]?.startsWith("No") ? C.orange : C.muted }}>{tamanoTxt(x.f.size)}{estado[i] ? " · " + estado[i] : ""}</div>
              </div>
              {unirFotos && x.url && !subiendo && <>
                <button onClick={() => mover(i, -1)} title="Subir en el orden" style={btnMini}>↑</button>
                <button onClick={() => mover(i, 1)} title="Bajar en el orden" style={btnMini}>↓</button>
              </>}
              {!subiendo && <button onClick={() => setLista((l) => l.filter((_, j) => j !== i))} title="Quitar" style={{ ...btnMini, color: C.red }}>×</button>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 12px" }}>
        <div>{etiqueta("Tipo de documento")}<Sel value={tipo} onChange={elegirTipo} options={TIPOS_DOC} style={selSt} /></div>
        <div>{etiqueta("Profesional (opcional)")}<Sel value={proId} onChange={elegirPro} options={[{ v: "", l: "— Ninguno —" }, ...prosOrden.map((p) => ({ v: p.id, l: p.name + (p.company_name ? " · " + p.company_name : "") }))]} style={selSt} /></div>
      </div>
      <div>{etiqueta("Carpeta")}
        <Sel value={carpeta} onChange={setCarpeta} options={opcionesCarpeta.map((r) => ({ v: r, l: r ? r.split("/").join(" › ") : "Archivos (principal)" }))} style={selSt} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 12px" }}>
        <Campo label="Fecha del documento (opcional)" type="date" value={fechaDoc} onChange={setFechaDoc} />
        <Campo label="Notas (opcional)" value={notas} onChange={setNotas} placeholder="Ej.: firmado en mano" />
      </div>
      {imagenes.length >= 2 && (
        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: C.text, cursor: "pointer", fontWeight: 700 }}>
            <input type="checkbox" checked={juntar} onChange={(e) => setJuntar(e.target.checked)} />
            Juntar las {imagenes.length} fotos en un solo PDF
          </label>
          {juntar && <div style={{ marginTop: 10 }}><Campo label="Nombre del PDF" value={nombrePdf} onChange={setNombrePdf} placeholder={nombrePorDefecto()} /></div>}
        </div>
      )}
      {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={subir} disabled={subiendo || !lista.length}>{subiendo ? "Subiendo…" : lista.length ? `Guardar ${unirFotos ? "" : lista.length + " "}${unirFotos ? "el PDF" : lista.length === 1 ? "archivo" : "archivos"}` : "Guardar"}</Btn>
        {!subiendo && <Btn outline color={C.mutedL} onClick={onClose}>Cancelar</Btn>}
      </div>
    </Modal>
  );
}
const btnMini: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: "1px solid " + C.border, background: C.card, color: C.mutedL,
  cursor: "pointer", fontSize: 14, lineHeight: 1, flexShrink: 0,
};

// ── VER UN ARCHIVO ──────────────────────────────────────────
async function blobSistema(s: ArchivoSistema): Promise<Blob> {
  if (s.fuente === "factura") {
    const [{ data: f, error }, { data: leads }] = await Promise.all([
      db.from("lead_invoices").select("*").eq("id", s.ref).single(),
      db.from("pro_leads").select("created_at,trade,canal,zona,price").eq("invoice_id", s.ref),
    ]);
    if (error || !f) throw new Error("No se encuentra la factura");
    const JsPDF = await cargarJsPDF();
    return dibujarFactura(JsPDF, f as any, (leads || []) as any).output("blob");
  }
  const { data, error } = await db.rpc("captacion_descargar_documento", { p_clave: claveAdmin(), p_id: s.ref });
  if (error || !data) throw new Error(error?.message || "No se encuentra el contrato");
  const bin = atob((data as any).base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: (data as any).mime || s.mime || "application/pdf" });
}
function descargar(url: string, nombre: string) {
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.rel = "noreferrer";
  document.body.appendChild(a); a.click(); a.remove();
}

function VistaArchivo({ el, carpetas, pros, movil, onClose, onCambio, aviso }: {
  el: Elem; carpetas: string[]; pros: Pro[]; movil: boolean;
  onClose: () => void; onCambio: (m?: string) => void; aviso: (m: string) => void;
}) {
  const r = el.real, s = el.sis;
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ nombre: r?.nombre || "", carpeta: r?.carpeta || "", tipo: r?.tipo || "otro", fecha_doc: r?.fecha_doc || "", pro_id: r?.pro_id || "", notas: r?.notas || "" });
  const [ocupado, setOcupado] = useState(false);
  const [apunte, setApunte] = useState<Apunte | null>(null);
  const [form, setForm] = useState<Partial<Apunte> | null>(null);
  const blobUrl = useRef<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (r) {
          const j = await fnArchivos("urls", { ids: [r.id] });
          if (vivo) setUrl(j.urls?.[r.id] || null);
          if (!j.urls?.[r.id]) setErr("No se encuentra el archivo");
        } else if (s) {
          const b = await blobSistema(s);
          const u = URL.createObjectURL(b);
          blobUrl.current = u;
          if (vivo) setUrl(u);
        }
      } catch (e: any) { if (vivo) setErr(e?.message || "No se ha podido abrir"); }
    })();
    return () => { vivo = false; if (blobUrl.current) URL.revokeObjectURL(blobUrl.current); };
  }, [r?.id, s?.id]); // eslint-disable-line

  const cargarApunte = useCallback(async () => {
    if (!r?.apunte_id) { setApunte(null); return; }
    const { data } = await db.rpc("fiscal_apunte", { p_admin: claveAdmin(), p_id: r.apunte_id });
    setApunte((data as any) || null);
  }, [r?.apunte_id]);
  useEffect(() => { cargarApunte(); }, [cargarApunte]);

  const cambiado = !!r && (f.nombre !== r.nombre || limpiarRuta(f.carpeta) !== r.carpeta || f.tipo !== r.tipo || (f.fecha_doc || "") !== (r.fecha_doc || "") || (f.pro_id || "") !== (r.pro_id || "") || (f.notas || "") !== (r.notas || ""));
  const guardar = async () => {
    if (!r) return;
    setOcupado(true);
    const { error } = await db.rpc("archivos_actualizar", { p_admin: claveAdmin(), p_id: r.id, p_cambios: { ...f, carpeta: limpiarRuta(f.carpeta) } });
    setOcupado(false);
    if (error) { aviso("Error: " + error.message); return; }
    onCambio("Cambios guardados");
  };
  const papelera = async () => {
    if (!r) return;
    setOcupado(true);
    const { error } = await db.rpc("archivos_papelera", { p_admin: claveAdmin(), p_ids: [r.id], p_en: true });
    setOcupado(false);
    if (error) { aviso("Error: " + error.message); return; }
    onCambio("Movido a la papelera");
  };
  const bajar = async () => {
    try {
      if (r) {
        const j = await fnArchivos("urls", { ids: [r.id], descargar: true });
        if (j.urls?.[r.id]) descargar(j.urls[r.id], r.nombre);
      } else if (url && s) descargar(url, s.nombre);
    } catch (e: any) { aviso("Error: " + (e?.message || "no se pudo descargar")); }
  };

  const mime = (r?.mime || s?.mime || "").toLowerCase();
  const esImg = mime.startsWith("image/");
  const esPdf = mime.includes("pdf");
  const fila = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid " + C.border + "66", fontSize: 13 }}>
      <span style={{ color: C.mutedL }}>{k}</span><span style={{ textAlign: "right", color: C.text }}>{v || "—"}</span>
    </div>
  );
  const etiqueta = (t: string) => <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>{t}</label>;
  const selSt = { width: "100%", marginBottom: 12, padding: "9px 10px" };
  const prosOrden = [...pros].sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
  const opcionesCarpeta = Array.from(new Set(["", ...carpetas, f.carpeta])).sort((a, b) => a.localeCompare(b, "es"));

  const visor = (
    <div style={{ flex: movil ? undefined : 1.7, minWidth: 0, height: movil ? "52vh" : "74vh", background: esPdf ? "#fff" : C.bg, borderRadius: 10, border: "1px solid " + C.border, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {err ? <div style={{ color: C.red, padding: 20, fontSize: 14 }}>{err}</div>
        : !url ? <div style={{ color: C.mutedL, fontSize: 14 }}>Cargando…</div>
        : esImg ? <img src={url} alt={el.nombre} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        : esPdf ? <iframe title={el.nombre} src={url} style={{ width: "100%", height: "100%", border: 0, background: "#fff" }} />
        : <div style={{ textAlign: "center", color: C.mutedL, fontSize: 14, padding: 20 }}><IconoArchivo mime={mime} nombre={el.nombre} size={60} /><div style={{ marginTop: 10 }}>Sin vista previa: descárgalo para abrirlo.</div></div>}
    </div>
  );

  const fiscal = r && FISCALES.includes(f.tipo) && (
    <div style={{ background: C.card, border: "1px solid " + (apunte ? C.border : C.orange + "88"), borderRadius: 10, padding: "11px 12px", margin: "4px 0 12px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.mutedL, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>Para Impuestos</div>
      {apunte ? <>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
          {apunte.tipo === "gasto" ? "Gasto" : "Ingreso"} · {apunte.tercero_nombre || "—"}<br />
          Base {eur(+apunte.base, 2)} · IVA {eur(+apunte.iva_importe, 2)} · Total <b>{eur(+apunte.total, 2)}</b><br />
          <span style={{ color: C.mutedL }}>Cuenta en el {trimestreDe(apunte.fecha)}T {apunte.fecha.slice(0, 4)}</span>
        </div>
        <div style={{ marginTop: 8 }}><Btn small outline onClick={() => setForm(apunte)}>Editar datos</Btn></div>
      </> : <>
        <div style={{ fontSize: 13, color: C.orange, marginBottom: 8 }}>Sin datos fiscales: todavía no cuenta en Impuestos.</div>
        <Btn small color={C.orange} onClick={() => setForm({ tipo: f.tipo === "factura_emitida" ? "ingreso" : "gasto", fecha: f.fecha_doc || hoyMadrid(), archivo_id: r.id, origen: "panel" })}>Poner datos fiscales</Btn>
      </>}
    </div>
  );

  const panel = (
    <div style={{ width: movil ? undefined : 330, flexShrink: 0, marginTop: movil ? 14 : 0 }}>
      {r ? <>
        <Campo label="Nombre" value={f.nombre} onChange={(v: string) => setF({ ...f, nombre: v })} />
        <div>{etiqueta("Carpeta")}<Sel value={f.carpeta} onChange={(v) => setF({ ...f, carpeta: v })} options={opcionesCarpeta.map((x) => ({ v: x, l: x ? x.split("/").join(" › ") : "Archivos (principal)" }))} style={selSt} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
          <div>{etiqueta("Tipo")}<Sel value={f.tipo} onChange={(v) => setF({ ...f, tipo: v })} options={TIPOS_DOC} style={selSt} /></div>
          <Campo label="Fecha" type="date" value={f.fecha_doc} onChange={(v: string) => setF({ ...f, fecha_doc: v })} />
        </div>
        <div>{etiqueta("Profesional")}<Sel value={f.pro_id} onChange={(v) => setF({ ...f, pro_id: v })} options={[{ v: "", l: "— Ninguno —" }, ...prosOrden.map((p) => ({ v: p.id, l: p.name }))]} style={selSt} /></div>
        <Campo label="Notas" value={f.notas} onChange={(v: string) => setF({ ...f, notas: v })} multilinea />
        {cambiado && <div style={{ marginBottom: 12 }}><Btn onClick={guardar} disabled={ocupado} full>{ocupado ? "Guardando…" : "Guardar cambios"}</Btn></div>}
        {fiscal}
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          {tamanoTxt(r.tamano)} · subido el {fechaCorta(r.created_at.slice(0, 10))}{r.origen === "claude" ? " por Claude" : ""}
        </div>
      </> : s && <>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <Pill texto="Se guarda solo" color={C.green} />
          {s.fuente === "factura" && s.estado && <Pill texto={s.estado === "pagada" ? "Pagada" : s.estado === "pendiente" ? "Pendiente de cobro" : s.estado} color={s.estado === "pagada" ? C.green : C.orange} />}
          {s.firma && <Pill texto="Firmado electrónicamente" color={C.blue} />}
        </div>
        {s.profesional && fila("Profesional", s.profesional)}
        {s.fuente === "factura" && fila("Facturado a", s.cliente)}
        {s.fuente === "factura" && fila("Concepto", s.concepto)}
        {s.fuente === "factura" && fila("Total", <b>{eur(Number(s.importe) || 0, 2)}</b>)}
        {s.fuente === "contrato" && !s.plantilla && fila("Oficio y ciudad", [s.oficio, s.ciudad].filter(Boolean).join(" · "))}
        {fila("Fecha", fechaCorta(s.fecha))}
        <div style={{ fontSize: 12, color: C.muted, margin: "10px 0 12px", lineHeight: 1.5 }}>
          {s.fuente === "factura" ? "Sale de Facturas del panel. Cuenta sola en Impuestos." : s.plantilla ? "Contrato modelo subido en Captación." : "Sale de Captación (firma electrónica o contrato subido a mano)."}
        </div>
      </>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn small onClick={bajar} disabled={!url && !r}>Descargar</Btn>
        {url && <Btn small outline onClick={() => window.open(url, "_blank", "noopener")}>Abrir en otra pestaña</Btn>}
        {r && <Btn small outline color={C.red} onClick={papelera} disabled={ocupado}>A la papelera</Btn>}
      </div>
    </div>
  );

  return (
    <>
      <Modal titulo={el.nombre} onClose={onClose} ancho={1180}>
        <div style={{ display: "flex", flexDirection: movil ? "column" : "row", gap: 16, alignItems: "stretch" }}>
          {visor}
          {panel}
        </div>
      </Modal>
      {form && r && (
        <FormApunte inicial={form} archivoNombre={r.nombre} onClose={() => setForm(null)}
          onGuardado={(_, m) => { setForm(null); aviso(m); cargarApunte(); onCambio(); }} />
      )}
    </>
  );
}

// ── PANTALLA ────────────────────────────────────────────────
export default function Archivos({ d, aviso, irA }: SeccionProps) {
  const ancho = useAncho();
  const movil = ancho < 900;
  const [datos, setDatos] = useState<Listado | null>(null);
  const [error, setError] = useState("");
  const [ruta, setRuta] = useState<string>(() => { try { return sessionStorage.getItem("oy_archivos_ruta") || ""; } catch { return ""; } });
  const [busca, setBusca] = useState("");
  const [vista, setVista] = useState<"cuadricula" | "lista">(() => { try { return (localStorage.getItem("oy_archivos_vista") as any) || "cuadricula"; } catch { return "cuadricula"; } });
  const [minis, setMinis] = useState<Record<string, string>>({});
  const [abierto, setAbierto] = useState<Elem | null>(null);
  const [subida, setSubida] = useState<{ files?: File[]; carpeta: string } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [carpetaModal, setCarpetaModal] = useState<{ modo: "nueva" | "renombrar"; valor: string } | null>(null);
  const [fiscalNuevo, setFiscalNuevo] = useState<{ id: string; nombre: string; tipo: string } | null>(null);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({ Profesionales: true, Contratos: true });

  const cargar = useCallback(async () => {
    const { data, error } = await db.rpc("archivos_listar", { p_admin: claveAdmin() });
    if (error) { setError(error.message); return; }
    setDatos(data as Listado);
    setError("");
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { try { sessionStorage.setItem("oy_archivos_ruta", ruta); } catch { /* nada */ } }, [ruta]);
  useEffect(() => { try { localStorage.setItem("oy_archivos_vista", vista); } catch { /* nada */ } }, [vista]);

  const vivos = useMemo(() => (datos?.archivos || []).filter((a) => !a.papelera_at), [datos]);
  const enPapelera = useMemo(() => (datos?.archivos || []).filter((a) => a.papelera_at), [datos]);
  const elems: Elem[] = useMemo(() => [
    ...vivos.map((a) => ({ key: a.id, nombre: a.nombre, carpeta: a.carpeta, fecha: a.fecha_doc || a.created_at.slice(0, 10), tamano: a.tamano, mime: a.mime || "", tipo: a.tipo, real: a })),
    ...(datos?.sistema || []).map((s) => ({ key: s.id, nombre: s.nombre, carpeta: s.carpeta, fecha: s.fecha, tamano: s.tamano ?? null, mime: s.mime, tipo: s.tipo, sis: s })),
  ], [vivos, datos]);

  const carpetas = useMemo(() => {
    const s = new Set<string>();
    const add = (r: string) => { if (!r) return; const p = r.split("/"); for (let i = 1; i <= p.length; i++) s.add(p.slice(0, i).join("/")); };
    (datos?.carpetas || []).forEach(add);
    elems.forEach((e) => add(e.carpeta));
    return Array.from(s);
  }, [datos, elems]);
  const cuenta = useMemo(() => {
    const m: Record<string, number> = {};
    elems.forEach((e) => { const p = e.carpeta.split("/"); for (let i = 1; i <= p.length; i++) { const k = p.slice(0, i).join("/"); m[k] = (m[k] || 0) + 1; } });
    return m;
  }, [elems]);
  const ordenar = (a: string, b: string) => {
    const ia = RAIZ_ORDEN.indexOf(a), ib = RAIZ_ORDEN.indexOf(b);
    if (!a.includes("/") && !b.includes("/") && (ia >= 0 || ib >= 0)) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    const ha = hoja(a), hb = hoja(b);
    const pa = ["Contratos", "Facturas"].indexOf(ha), pb = ["Contratos", "Facturas"].indexOf(hb);
    if (pa >= 0 && pb >= 0) return pa - pb;
    return ha.localeCompare(hb, "es");
  };
  const hijas = useCallback((r: string) => carpetas.filter((c) => padre(c) === r).sort(ordenar), [carpetas]); // eslint-disable-line

  const enPapeleraVista = ruta === PAPELERA;
  const termino = sinTildes(busca.trim());
  const visibles: Elem[] = useMemo(() => {
    if (termino) return elems.filter((e) => sinTildes(e.nombre + " " + e.carpeta + " " + (e.real?.notas || "") + " " + (e.sis?.cliente || "")).includes(termino))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (enPapeleraVista) return enPapelera.map((a) => ({ key: a.id, nombre: a.nombre, carpeta: a.carpeta, fecha: a.fecha_doc || a.created_at.slice(0, 10), tamano: a.tamano, mime: a.mime || "", tipo: a.tipo, real: a }));
    return elems.filter((e) => e.carpeta === ruta).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.nombre.localeCompare(b.nombre, "es"));
  }, [termino, elems, enPapeleraVista, enPapelera, ruta]);
  const subcarpetas = termino || enPapeleraVista ? [] : hijas(ruta);

  // Miniaturas de lo que se ve
  useEffect(() => {
    const faltan = visibles.filter((e) => e.real?.miniatura && !minis[e.key]).map((e) => e.key).slice(0, 200);
    if (!faltan.length) return;
    db.rpc("archivos_miniaturas", { p_admin: claveAdmin(), p_ids: faltan }).then(({ data }) => {
      if (data) setMinis((m) => ({ ...m, ...(data as Record<string, string>) }));
    });
  }, [visibles]); // eslint-disable-line

  // Si la carpeta guardada ya no existe, a la principal
  useEffect(() => { if (datos && ruta && ruta !== PAPELERA && !carpetas.includes(ruta)) setRuta(""); }, [datos, carpetas, ruta]);

  const recargar = (m?: string) => { if (m) aviso(m); cargar(); };
  const carpetaParaSubir = enPapeleraVista ? "" : ruta;

  const crearCarpeta = async (nombre: string) => {
    const r = limpiarRuta((carpetaParaSubir ? carpetaParaSubir + "/" : "") + nombre.replace(/\//g, "-"));
    const { data, error } = await db.rpc("archivos_carpeta_crear", { p_admin: claveAdmin(), p_ruta: r });
    if (error) { aviso("Error: " + error.message); return; }
    setCarpetaModal(null); await cargar(); setRuta(String(data)); aviso("Carpeta creada");
  };
  const renombrarCarpeta = async (nombre: string) => {
    const nueva = limpiarRuta((padre(ruta) ? padre(ruta) + "/" : "") + nombre.replace(/\//g, "-"));
    const { data, error } = await db.rpc("archivos_carpeta_renombrar", { p_admin: claveAdmin(), p_de: ruta, p_a: nueva });
    if (error) { aviso("Error: " + error.message); return; }
    setCarpetaModal(null); await cargar(); setRuta(String(data)); aviso("Carpeta renombrada");
  };
  const borrarCarpeta = async () => {
    if (!confirm("¿Borrar la carpeta «" + hoja(ruta) + "»? Tiene que estar vacía.")) return;
    const { error } = await db.rpc("archivos_carpeta_borrar", { p_admin: claveAdmin(), p_ruta: ruta });
    if (error) { aviso("Error: " + error.message); return; }
    const p = padre(ruta); await cargar(); setRuta(p); aviso("Carpeta borrada");
  };
  const restaurar = async (ids: string[]) => {
    const { error } = await db.rpc("archivos_papelera", { p_admin: claveAdmin(), p_ids: ids, p_en: false });
    if (error) { aviso("Error: " + error.message); return; }
    recargar(ids.length === 1 ? "Archivo recuperado" : "Archivos recuperados");
  };
  const borrarDefinitivo = async (ids: string[]) => {
    if (!confirm(ids.length === 1 ? "¿Borrar este archivo para siempre? No se puede deshacer." : `¿Borrar ${ids.length} archivos para siempre? No se puede deshacer.`)) return;
    try { await fnArchivos("borrar", { ids }); recargar("Borrado para siempre"); }
    catch (e: any) { aviso("Error: " + (e?.message || "no se pudo borrar")); }
  };

  // Arrastrar archivos encima del explorador
  const contador = useRef(0);
  const conArchivos = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes("Files");
  const dragProps = {
    onDragEnter: (e: React.DragEvent) => { if (!conArchivos(e)) return; e.preventDefault(); contador.current++; setArrastrando(true); },
    onDragOver: (e: React.DragEvent) => { if (conArchivos(e)) e.preventDefault(); },
    onDragLeave: () => { contador.current = Math.max(0, contador.current - 1); if (!contador.current) setArrastrando(false); },
    onDrop: (e: React.DragEvent) => {
      if (!conArchivos(e)) return;
      e.preventDefault(); contador.current = 0; setArrastrando(false);
      const fs = Array.from(e.dataTransfer.files || []);
      if (fs.length && !subida) setSubida({ files: fs, carpeta: carpetaParaSubir });
    },
  };

  if (error) {
    const sinClave = /clave de admin/i.test(error);
    return (
      <div>
        <Cabecera titulo="Archivos" />
        <Respuesta pregunta="¿Está todo guardado?" tono="mal" texto={sinClave ? "Falta la clave de admin en este dispositivo." : "No se han podido cargar los archivos."}
          detalle={sinClave ? "Entra una vez en Captación desde aquí (con tu clave) y vuelve: Archivos usa la misma." : error} />
        {sinClave && <Btn onClick={() => irA("captacion")}>Ir a Captación</Btn>}
      </div>
    );
  }
  if (!datos) return <div style={{ color: C.mutedL, padding: 30 }}>Cargando archivos…</div>;

  const sinDatos = vivos.filter((a) => FISCALES.includes(a.tipo) && !a.apunte_id);
  const nPros = hijas("Profesionales").length;
  const bytes = (datos.archivos || []).reduce((s, a) => s + (Number(a.tamano) || 0), 0);
  const migas = ruta && !enPapeleraVista ? ruta.split("/") : [];

  // ── piezas ──
  const arbol = (r: string, nivel: number): React.ReactNode => hijas(r).map((c) => {
    const tiene = hijas(c).length > 0;
    const abierta = abiertas[c] || ruta === c || ruta.startsWith(c + "/");
    const act = ruta === c && !termino;
    return (
      <React.Fragment key={c}>
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 6 + nivel * 14 }}>
          <button onClick={() => setAbiertas((a) => ({ ...a, [c]: !abierta }))} aria-label={abierta ? "Cerrar" : "Abrir"} style={{
            width: 18, height: 18, border: "none", background: "none", color: C.muted, cursor: tiene ? "pointer" : "default", padding: 0, fontSize: 10, visibility: tiene ? "visible" : "hidden",
          }}>{abierta ? "▾" : "▸"}</button>
          <button onClick={() => { setBusca(""); setRuta(c); }} style={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderRadius: 7, border: "none", cursor: "pointer",
            background: act ? C.accent + "18" : "transparent", color: act ? C.accent : C.text, fontFamily: F, fontSize: 13, fontWeight: act ? 800 : 600, textAlign: "left",
          }}>
            <IconoCarpeta size={17} color={act ? C.accent : C.mutedL} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hoja(c)}</span>
            {cuenta[c] ? <span style={{ fontSize: 11, color: C.muted }}>{cuenta[c]}</span> : null}
          </button>
        </div>
        {tiene && abierta && arbol(c, nivel + 1)}
      </React.Fragment>
    );
  });

  const insignias = (e: Elem) => (
    <>
      {e.sis && <Pill texto={e.sis.fuente === "factura" ? (e.sis.estado === "pagada" ? "Pagada" : "Pendiente") : e.sis.plantilla ? "Modelo" : e.sis.firma ? "Firmado" : "Captación"} color={e.sis.fuente === "factura" ? (e.sis.estado === "pagada" ? C.green : C.orange) : C.blue} />}
      {e.real && FISCALES.includes(e.real.tipo) && !e.real.apunte_id && <Pill texto="Sin datos" color={C.orange} />}
    </>
  );
  const abrir = (e: Elem) => setAbierto(e);
  const tarjetaCarpeta = (c: string) => (
    <button key={c} onClick={() => setRuta(c)} onDoubleClick={() => setRuta(c)} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px 12px", borderRadius: 12,
      border: "1px solid " + C.border, background: C.card, cursor: "pointer", fontFamily: F, minWidth: 0,
    }}>
      <IconoCarpeta size={54} color={esSistema(c) ? C.accent : C.orange} />
      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: "center", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, wordBreak: "break-word" }}>{hoja(c)}</span>
      <span style={{ fontSize: 11.5, color: C.muted }}>{cuenta[c] ? cuenta[c] + (cuenta[c] === 1 ? " archivo" : " archivos") : "Vacía"}</span>
    </button>
  );
  const tarjetaArchivo = (e: Elem) => (
    <button key={e.key} onClick={() => abrir(e)} style={{
      display: "flex", flexDirection: "column", gap: 6, padding: 8, borderRadius: 12, border: "1px solid " + C.border, background: C.card,
      cursor: "pointer", fontFamily: F, minWidth: 0, textAlign: "left",
    }}>
      <div style={{ height: 112, borderRadius: 8, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {minis[e.key] ? <img src={minis[e.key]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconoArchivo mime={e.mime} nombre={e.nombre} size={44} />}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, wordBreak: "break-word", minHeight: 33 }}>{e.nombre}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{fechaCorta(e.fecha)}{e.tamano ? " · " + tamanoTxt(e.tamano) : ""}</span>
        <span style={{ display: "inline-flex", gap: 4 }}>{insignias(e)}</span>
      </div>
      {termino && <div style={{ fontSize: 11, color: C.mutedL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📁 {e.carpeta ? e.carpeta.split("/").join(" › ") : "Archivos"}</div>}
    </button>
  );
  const filaLista = (e: Elem) => (
    <div key={e.key} onClick={() => abrir(e)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: "1px solid " + C.border + "88", cursor: "pointer" }}
      onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = C.cardHi; }} onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = "transparent"; }}>
      {minis[e.key] ? <img src={minis[e.key]} alt="" style={{ width: 30, height: 30, objectFit: "cover", borderRadius: 5 }} /> : <IconoArchivo mime={e.mime} nombre={e.nombre} size={24} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nombre}</div>
        {(termino || enPapeleraVista) && <div style={{ fontSize: 11.5, color: C.muted }}>📁 {e.carpeta ? e.carpeta.split("/").join(" › ") : "Archivos"}</div>}
      </div>
      {!movil && <span style={{ fontSize: 12, color: C.mutedL, width: 150 }}>{nombreTipo(e.tipo)}</span>}
      <span style={{ display: "inline-flex", gap: 4 }}>{insignias(e)}</span>
      <span style={{ fontSize: 12, color: C.mutedL, width: 64, textAlign: "right" }}>{fechaCorta(e.fecha)}</span>
      {!movil && <span style={{ fontSize: 12, color: C.muted, width: 64, textAlign: "right" }}>{e.tamano ? tamanoTxt(e.tamano) : "—"}</span>}
      {enPapeleraVista && e.real && <span onClick={(ev) => ev.stopPropagation()} style={{ display: "inline-flex", gap: 6 }}>
        <Btn small outline onClick={() => restaurar([e.real!.id])}>Recuperar</Btn>
        <Btn small outline color={C.red} onClick={() => borrarDefinitivo([e.real!.id])}>Borrar</Btn>
      </span>}
    </div>
  );
  const vistaBtn = (v: "cuadricula" | "lista", t: string) => (
    <button onClick={() => setVista(v)} style={{
      padding: "7px 11px", border: "1px solid " + (vista === v ? C.accent : C.border), background: vista === v ? C.accent + "18" : C.card,
      color: vista === v ? C.accent : C.mutedL, fontFamily: F, fontWeight: 800, fontSize: 12, cursor: "pointer",
      borderRadius: v === "cuadricula" ? "8px 0 0 8px" : "0 8px 8px 0",
    }}>{t}</button>
  );

  return (
    <div {...dragProps} style={{ position: "relative" }}>
      <Cabecera titulo="Archivos" sub={`${elems.length} documentos · ${tamanoTxt(bytes)} subidos · privado, solo lo ves tú`}>
        <Btn onClick={() => setSubida({ carpeta: carpetaParaSubir })}>Subir</Btn>
        <Btn outline onClick={() => setCarpetaModal({ modo: "nueva", valor: "" })} disabled={enPapeleraVista}>Nueva carpeta</Btn>
      </Cabecera>

      <Respuesta pregunta="¿Está todo guardado?" tono={sinDatos.length ? "regular" : "bien"}
        texto={sinDatos.length
          ? <>Hay {sinDatos.length} factura{sinDatos.length > 1 ? "s" : ""} subida{sinDatos.length > 1 ? "s" : ""} sin datos fiscales: no cuenta{sinDatos.length > 1 ? "n" : ""} en Impuestos hasta que los pongas.</>
          : <>Sí: {elems.length} documentos en carpetas, {nPros} profesional{nPros === 1 ? "" : "es"} con su carpeta.</>}
        detalle={<>Las facturas emitidas ({datos.sistema.filter((s) => s.fuente === "factura").length}) y los contratos firmados ({datos.sistema.filter((s) => s.fuente === "contrato" && !s.plantilla).length}) se archivan solos en la carpeta de cada profesional. Para subir algo, arrástralo aquí o pulsa «Subir»; desde el móvil puedes hacer la foto.
          {sinDatos.length > 0 && <> <a onClick={() => setAbierto({ key: sinDatos[0].id, nombre: sinDatos[0].nombre, carpeta: sinDatos[0].carpeta, fecha: sinDatos[0].fecha_doc || sinDatos[0].created_at.slice(0, 10), tamano: sinDatos[0].tamano, mime: sinDatos[0].mime || "", tipo: sinDatos[0].tipo, real: sinDatos[0] })} style={{ color: C.accent, cursor: "pointer", fontWeight: 700 }}>Poner los datos de la primera →</a></>}
        </>} />

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {!movil && (
          <aside style={{ width: 250, flexShrink: 0, background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "8px 6px", position: "sticky", top: 70, maxHeight: "calc(100vh - 90px)", overflowY: "auto" }}>
            <button onClick={() => { setBusca(""); setRuta(""); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer",
              background: ruta === "" && !termino ? C.accent + "18" : "transparent", color: ruta === "" && !termino ? C.accent : C.text, fontFamily: F, fontSize: 13, fontWeight: 800, textAlign: "left",
            }}>🗂️ <span style={{ flex: 1 }}>Todos los archivos</span><span style={{ fontSize: 11, color: C.muted }}>{elems.length}</span></button>
            {arbol("", 0)}
            <div style={{ borderTop: "1px solid " + C.border, margin: "8px 4px 4px" }} />
            <button onClick={() => { setBusca(""); setRuta(PAPELERA); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer",
              background: enPapeleraVista ? C.accent + "18" : "transparent", color: enPapeleraVista ? C.accent : C.mutedL, fontFamily: F, fontSize: 13, fontWeight: 700, textAlign: "left",
            }}>🗑️ <span style={{ flex: 1 }}>Papelera</span><span style={{ fontSize: 11, color: C.muted }}>{enPapelera.length || ""}</span></button>
          </aside>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Barra: migas, buscar, vista */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", flex: 1, minWidth: 200, fontSize: 13.5 }}>
              {movil && ruta && !termino && <button onClick={() => setRuta(enPapeleraVista ? "" : padre(ruta))} style={{ ...btnMini, width: 32, height: 32, fontSize: 16 }} aria-label="Volver">‹</button>}
              <button onClick={() => { setBusca(""); setRuta(""); }} style={{ background: "none", border: "none", color: migas.length || enPapeleraVista || termino ? C.mutedL : C.text, fontWeight: 800, cursor: "pointer", fontFamily: F, fontSize: 13.5, padding: "4px 2px" }}>Archivos</button>
              {termino ? <><span style={{ color: C.muted }}>›</span><span style={{ color: C.text, fontWeight: 800 }}>Buscar «{busca.trim()}»</span></>
                : enPapeleraVista ? <><span style={{ color: C.muted }}>›</span><span style={{ color: C.text, fontWeight: 800 }}>Papelera</span></>
                : migas.map((m, i) => (
                  <React.Fragment key={i}>
                    <span style={{ color: C.muted }}>›</span>
                    <button onClick={() => setRuta(migas.slice(0, i + 1).join("/"))} style={{ background: "none", border: "none", color: i === migas.length - 1 ? C.text : C.mutedL, fontWeight: 800, cursor: "pointer", fontFamily: F, fontSize: 13.5, padding: "4px 2px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m}</button>
                  </React.Fragment>
                ))}
            </div>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar en todos los archivos…" style={{
              flex: movil ? "1 1 100%" : "0 1 260px", padding: "8px 11px", background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontFamily: F, fontSize: 13, outline: "none",
            }} />
            <div style={{ display: "flex" }}>{vistaBtn("cuadricula", "▦")}{vistaBtn("lista", "☰")}</div>
          </div>

          {/* Acciones de la carpeta */}
          {!termino && ruta && !enPapeleraVista && !esSistema(ruta) && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <Btn small outline color={C.mutedL} onClick={() => setCarpetaModal({ modo: "renombrar", valor: hoja(ruta) })}>Renombrar carpeta</Btn>
              {!cuenta[ruta] && !hijas(ruta).length && <Btn small outline color={C.red} onClick={borrarCarpeta}>Borrar carpeta</Btn>}
            </div>
          )}
          {movil && !termino && !ruta && (
            <div style={{ marginBottom: 10 }}><Btn small outline color={C.mutedL} onClick={() => setRuta(PAPELERA)}>🗑️ Papelera {enPapelera.length ? "(" + enPapelera.length + ")" : ""}</Btn></div>
          )}
          {enPapeleraVista && enPapelera.length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: C.mutedL }}>Lo que está aquí no cuenta y puedes recuperarlo cuando quieras.</span>
              <Btn small outline color={C.red} onClick={() => borrarDefinitivo(enPapelera.map((a) => a.id))}>Vaciar papelera</Btn>
            </div>
          )}

          {/* Contenido */}
          {subcarpetas.length === 0 && visibles.length === 0 ? (
            <div style={{ border: "2px dashed " + C.border, borderRadius: 12, padding: "38px 20px", textAlign: "center", color: C.mutedL, fontSize: 14 }}>
              {termino ? "No hay nada con ese nombre." : enPapeleraVista ? "La papelera está vacía." : <>Carpeta vacía. Arrastra aquí archivos o pulsa <a onClick={() => setSubida({ carpeta: carpetaParaSubir })} style={{ color: C.accent, cursor: "pointer", fontWeight: 800 }}>Subir</a>.</>}
            </div>
          ) : vista === "cuadricula" && !enPapeleraVista ? (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${movil ? 140 : 160}px, 1fr))`, gap: 10 }}>
              {subcarpetas.map(tarjetaCarpeta)}
              {visibles.map(tarjetaArchivo)}
            </div>
          ) : (
            <div style={{ border: "1px solid " + C.border, borderRadius: 12, background: C.card, overflow: "hidden" }}>
              {subcarpetas.map((c) => (
                <div key={c} onClick={() => setRuta(c)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: "1px solid " + C.border + "88", cursor: "pointer" }}
                  onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = C.cardHi; }} onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <IconoCarpeta size={26} color={esSistema(c) ? C.accent : C.orange} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text }}>{hoja(c)}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{cuenta[c] || 0} archivos</span>
                </div>
              ))}
              {visibles.map(filaLista)}
            </div>
          )}
        </div>
      </div>

      {arrastrando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,17,23,0.82)", zIndex: 30000, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ border: "3px dashed " + C.accent, borderRadius: 18, padding: "40px 50px", color: C.text, fontFamily: F, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>📥</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>Suelta para guardar en</div>
            <div style={{ fontSize: 15, color: C.accent, fontWeight: 800, marginTop: 4 }}>{carpetaParaSubir ? carpetaParaSubir.split("/").join(" › ") : "Archivos"}</div>
          </div>
        </div>
      )}

      {subida && (
        <Subida carpetas={carpetas} carpetaInicial={subida.carpeta} archivosIniciales={subida.files} pros={d.pros}
          onClose={() => setSubida(null)}
          onHecho={async (ids, tipo, m) => {
            setSubida(null); aviso(m); await cargar();
            if (ids.length === 1 && FISCALES.includes(tipo)) setFiscalNuevo({ id: ids[0], nombre: "", tipo });
          }} />
      )}
      {fiscalNuevo && (
        <FormApunte inicial={{ tipo: fiscalNuevo.tipo === "factura_emitida" ? "ingreso" : "gasto", fecha: hoyMadrid(), archivo_id: fiscalNuevo.id, origen: "panel" }}
          archivoNombre={(datos.archivos.find((a) => a.id === fiscalNuevo.id)?.nombre) || "Archivo recién subido"}
          onClose={() => setFiscalNuevo(null)} onGuardado={(_, m) => { setFiscalNuevo(null); recargar(m); }} />
      )}
      {abierto && (
        <VistaArchivo el={abierto} carpetas={carpetas} pros={d.pros} movil={movil} aviso={aviso}
          onClose={() => setAbierto(null)} onCambio={(m) => { setAbierto(null); recargar(m); }} />
      )}
      {carpetaModal && (
        <Modal titulo={carpetaModal.modo === "nueva" ? "Nueva carpeta" : "Renombrar carpeta"} onClose={() => setCarpetaModal(null)} ancho={420}>
          {carpetaModal.modo === "nueva" && <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 10 }}>Dentro de: {carpetaParaSubir ? carpetaParaSubir.split("/").join(" › ") : "Archivos (principal)"}</div>}
          <Campo label="Nombre" value={carpetaModal.valor} onChange={(v: string) => setCarpetaModal({ ...carpetaModal, valor: v })} placeholder="Ej.: Gestoría 2026" />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn disabled={!carpetaModal.valor.trim()} onClick={() => carpetaModal.modo === "nueva" ? crearCarpeta(carpetaModal.valor) : renombrarCarpeta(carpetaModal.valor)}>
              {carpetaModal.modo === "nueva" ? "Crear" : "Renombrar"}
            </Btn>
            <Btn outline color={C.mutedL} onClick={() => setCarpetaModal(null)}>Cancelar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
