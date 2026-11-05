// ============================================================
// OficioYa · ADMIN — MARKETING: cada pestaña responde a una pregunta
// Datos: RPC mkt_marketing (Google Ads, Meta y GA4 sincronizados + CRM + visitas propias de las landings)
// Acceso: clave del CRM de captación. Admin decide; la oficina (gestor) ve todo y propone.
// El gasto de anuncios se mete solo en ad_spend cada hora (mkt_gasto_auto); a mano solo otros gastos.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { db } from "../supabase";
import {
  C, F, Card, Btn, Pill, Grid, Titulo, Cabecera, Tabla, BarraH, Barras, Modal, Campo, Sel,
  SeccionProps, Gasto, ymdMadrid, sumarDias, mesHoy, mesMover, diasDelMes, eur, num, fecha, hace, useAncho,
} from "./apUi";

type J = any;
const CLAVE_LS = "oy_captacion_clave";
const TAB_LS = "oy_mkt_tab";

// Paleta categórica validada sobre el fondo de las tarjetas (#1E2536). Orden fijo: el color sigue a la entidad.
const SERIE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];
const COL_INGRESOS = SERIE[0];
const COL_GASTO = SERIE[1];

const OFICIO_TXT: Record<string, string> = { pintura: "Pintura", fontaneria: "Fontanería", electricidad: "Electricidad", otros: "Otros" };
const CIUDAD_TXT: Record<string, string> = {
  sevilla: "Sevilla", valencia: "Valencia", malaga: "Málaga", granada: "Granada", madrid: "Madrid", cordoba: "Córdoba", cadiz: "Cádiz",
  huelva: "Huelva", almeria: "Almería", jaen: "Jaén", barcelona: "Barcelona", alicante: "Alicante", murcia: "Murcia", zaragoza: "Zaragoza", bilbao: "Bilbao",
};
const COORD: Record<string, [number, number]> = {
  sevilla: [37.389, -5.984], valencia: [39.47, -0.376], malaga: [36.721, -4.421], granada: [37.177, -3.599], madrid: [40.417, -3.704],
  cordoba: [37.888, -4.779], cadiz: [36.527, -6.288], huelva: [37.261, -6.945], almeria: [36.834, -2.463], jaen: [37.779, -3.79],
  barcelona: [41.385, 2.173], alicante: [38.345, -0.481], murcia: [37.992, -1.13], zaragoza: [41.649, -0.889], bilbao: [43.263, -2.935],
};
const FASES: Record<string, { t: string; d: string; c: string }> = {
  aprendizaje: { t: "Aprendizaje", d: "La campaña acaba de cambiar: no se toca, solo se mira.", c: C.blue },
  rentabilizar: { t: "Rentabilizar", d: "Bajar el coste por lead por debajo de lo que se cobra.", c: C.orange },
  conversion: { t: "Mejorar la web", d: "Sacar más leads de las mismas visitas con tests A/B.", c: C.purple },
  escalar: { t: "Escalar", d: "Ya es rentable: más presupuesto o más zonas.", c: C.green },
  pausa: { t: "En pausa", d: "Parado a propósito.", c: C.muted },
};
const ORDEN_FASES = ["aprendizaje", "rentabilizar", "conversion", "escalar"];
const AREAS: Record<string, string> = { dinero: "Rentabilidad", leads: "Leads y profesionales", campanas: "Campañas", web: "Web", tests: "Tests", otro: "Otro" };
const ESTADO_PROP: Record<string, { t: string; c: string }> = {
  propuesta: { t: "Pendiente", c: C.accent }, aprobada: { t: "Aprobada", c: C.blue }, en_marcha: { t: "En marcha", c: C.purple },
  hecha: { t: "Hecha", c: C.green }, descartada: { t: "Descartada", c: C.muted },
};
const ESTADO_TEST: Record<string, { t: string; c: string }> = {
  propuesto: { t: "Propuesto", c: C.accent }, en_curso: { t: "En curso", c: C.blue }, pausado: { t: "Pausado", c: C.muted },
  gana_a: { t: "Gana A", c: C.green }, gana_b: { t: "Gana B", c: C.green }, gana_c: { t: "Gana C", c: C.green }, sin_diferencia: { t: "Sin diferencia", c: C.mutedL }, cancelado: { t: "Cancelado", c: C.muted },
  en_curso_ia: { t: "En curso", c: C.blue }, revertido: { t: "Revertido", c: C.red }, descartado: { t: "Descartado", c: C.muted },
  sin_concluir: { t: "Sin concluir", c: C.orange }, aprobado: { t: "Aprobado", c: C.blue }, ganador: { t: "Ganador", c: C.green }, perdedor: { t: "Perdedor", c: C.red },
};

const n = (v: any) => Number(v) || 0;
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const eur2 = (v: number | null | undefined) => (v === null || v === undefined || !isFinite(Number(v)) ? "—" : eur(Number(v), 2));
const pctTxt = (v: number | null | undefined, dec = 0) => (v === null || v === undefined || !isFinite(Number(v)) ? "—" : (Number(v) * 100).toFixed(dec).replace(".", ",") + "%");
const xTxt = (v: number | null | undefined) => (v === null || v === undefined || !isFinite(Number(v)) ? "—" : Number(v).toFixed(2).replace(".", ",") + "x");
const ddmm = (ymd: string) => (ymd ? String(ymd).slice(8, 10) + "/" + String(ymd).slice(5, 7) : "");
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
const ofTxt = (o: string) => OFICIO_TXT[o] || cap(o);
const ciTxt = (c: string) => CIUDAD_TXT[c] || cap(c);
const frenteTxt = (o: string, c: string) => ofTxt(o) + " " + ciTxt(c);
const nombreCamp = (s: string) => (s || "—").replace(/^r?ofesionales_Sevilla_Busqueda\/\s*/i, "Sevilla · ").replace(/_Busqueda$/i, "").replace(/_/g, " ");
const diasEntre = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000));

// Intervalo de confianza 95% de la diferencia de proporciones (B − A)
function diferencia(la: number, va: number, lb: number, vb: number) {
  if (va <= 0 || vb <= 0) return null;
  const pa = la / va, pb = lb / vb;
  const se = Math.sqrt((pa * (1 - pa)) / va + (pb * (1 - pb)) / vb);
  const d = pb - pa;
  return { pa, pb, d, lo: d - 1.96 * se, hi: d + 1.96 * se };
}

// ============================================================
// PIEZAS VISUALES
// ============================================================
function Respuesta({ pregunta, tono, texto, detalle }: { pregunta: string; tono: "bien" | "mal" | "regular" | "neutro"; texto: React.ReactNode; detalle?: React.ReactNode }) {
  const col = tono === "bien" ? C.green : tono === "mal" ? C.red : tono === "regular" ? C.orange : C.mutedL;
  const icono = tono === "bien" ? "✓" : tono === "mal" ? "✕" : tono === "regular" ? "!" : "i";
  const etiqueta = tono === "bien" ? "Bien" : tono === "mal" ? "Problema" : tono === "regular" ? "Atención" : "Info";
  return (
    <div style={{ background: C.card, border: "1px solid " + col + "66", borderLeft: "4px solid " + col, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: C.mutedL }}>{pregunta}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 8 }}>
        <span title={etiqueta} style={{ width: 24, height: 24, borderRadius: 99, background: col + "22", color: col, fontWeight: 900, fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icono}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: C.text, lineHeight: 1.35 }}>{texto}</div>
          {detalle && <div style={{ fontSize: 13, color: C.mutedL, marginTop: 6, lineHeight: 1.55 }}>{detalle}</div>}
        </div>
      </div>
    </div>
  );
}

function Delta({ act, ant, bueno = "sube" }: { act: number | null; ant: number | null; bueno?: "sube" | "baja" }) {
  if (act === null || ant === null || act === undefined || ant === undefined || !isFinite(act) || !isFinite(ant)) return <span style={{ color: C.muted }}>sin comparación</span>;
  if (ant === 0 && act === 0) return <span style={{ color: C.muted }}>igual que antes</span>;
  if (ant === 0) return <span style={{ color: C.mutedL }}>antes 0</span>;
  const d = ((act - ant) / Math.abs(ant)) * 100;
  const sube = d > 0;
  const bien = Math.abs(d) < 3 ? null : (sube && bueno === "sube") || (!sube && bueno === "baja");
  const col = bien === null ? C.mutedL : bien ? C.green : C.red;
  return <span style={{ color: col, fontWeight: 800 }}>{sube ? "▲" : "▼"} {Math.abs(d).toFixed(0)}% <span style={{ color: C.muted, fontWeight: 600 }}>vs periodo anterior</span></span>;
}

function KpiD({ label, valor, act, ant, bueno, sub, ayuda }: { label: string; valor: string; act?: number | null; ant?: number | null; bueno?: "sube" | "baja"; sub?: React.ReactNode; ayuda?: string }) {
  return (
    <div title={ayuda} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "13px 14px 11px", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 23, fontWeight: 800, color: C.text, marginTop: 4, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</div>
      <div style={{ fontSize: 11.5, marginTop: 3, color: C.mutedL }}>{sub !== undefined ? sub : <Delta act={act ?? null} ant={ant ?? null} bueno={bueno} />}</div>
    </div>
  );
}

function Leyenda({ items }: { items: { c: string; l: string; linea?: boolean }[] }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: C.mutedL, marginBottom: 10 }}>
      {items.map((it) => (
        <span key={it.l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: it.linea ? 14 : 10, height: it.linea ? 3 : 10, borderRadius: 2, background: it.c }} />{it.l}
        </span>
      ))}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <div style={{ padding: "22px 10px", textAlign: "center", color: C.muted, fontSize: 13 }}>{texto}</div>;
}

function Burbuja({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", bottom: "100%", left: "50%", transform: "translate(-50%, -8px)", background: C.surface,
      border: "1px solid " + C.border, borderRadius: 8, padding: "7px 10px", fontSize: 12, color: C.text, whiteSpace: "nowrap",
      zIndex: 6, boxShadow: "0 6px 18px rgba(0,0,0,0.45)", pointerEvents: "none", lineHeight: 1.5,
    }}>{children}</div>
  );
}

// Eje con 3 marcas redondas
function escala(max: number) {
  const m = max > 0 ? max : 1;
  const paso = Math.pow(10, Math.floor(Math.log10(m)));
  const tope = Math.ceil(m / paso) * paso;
  return { tope, marcas: [0, tope / 2, tope] };
}

// Barras emparejadas (p. ej. gasto frente a ingresos por semana). Un solo eje: las dos series están en €.
function BarrasPar({ etiquetas, a, b, alto = 190, formato = (v: number) => eur(v), extra }: {
  etiquetas: string[]; a: { nombre: string; color: string; valores: number[] }; b: { nombre: string; color: string; valores: number[] };
  alto?: number; formato?: (v: number) => string; extra?: (i: number) => React.ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { tope, marcas } = escala(Math.max(...a.valores, ...b.valores, 1));
  return (
    <div style={{ fontFamily: F }}>
      <Leyenda items={[{ c: a.color, l: a.nombre }, { c: b.color, l: b.nombre }]} />
      <div style={{ display: "flex", height: alto }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingRight: 8, fontSize: 10.5, color: C.muted, textAlign: "right", minWidth: 34 }}>
          {[...marcas].reverse().map((m) => <span key={m} style={{ lineHeight: "10px" }}>{num(m)}</span>)}
        </div>
        <div style={{ flex: 1, position: "relative", borderBottom: "1px solid " + C.border }}>
          {marcas.slice(1).map((m) => <div key={m} style={{ position: "absolute", left: 0, right: 0, bottom: (m / tope) * 100 + "%", borderTop: "1px dashed " + C.border + "99" }} />)}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end" }}>
            {etiquetas.map((e, i) => (
              <div key={e + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}
                style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, position: "relative", background: hover === i ? C.cardHi + "66" : "transparent" }}>
                {[a, b].map((s) => (
                  <div key={s.nombre} style={{ width: "30%", maxWidth: 16, height: s.valores[i] > 0 ? Math.max(2, (s.valores[i] / tope) * 100) + "%" : 0, background: s.color, borderRadius: "4px 4px 0 0" }} />
                ))}
                {hover === i && (
                  <Burbuja>
                    <div style={{ color: C.mutedL, fontSize: 11 }}>{e}</div>
                    <div><span style={{ color: a.color }}>■</span> {a.nombre}: <b>{formato(a.valores[i])}</b></div>
                    <div><span style={{ color: b.color }}>■</span> {b.nombre}: <b>{formato(b.valores[i])}</b></div>
                    {extra && extra(i)}
                  </Burbuja>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", paddingLeft: 42, marginTop: 6 }}>
        {etiquetas.map((e, i) => <div key={e + i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: C.muted, overflow: "hidden", whiteSpace: "nowrap" }}>{etiquetas.length > 8 && i % 2 === 1 ? "" : e}</div>)}
      </div>
    </div>
  );
}

// Barras apiladas por día (p. ej. gasto por campaña). Huecos de 2px entre segmentos.
function Apiladas({ etiquetas, series, alto = 190, formato = (v: number) => eur(v) }: {
  etiquetas: string[]; series: { nombre: string; color: string; valores: number[] }[]; alto?: number; formato?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totales = etiquetas.map((_, i) => series.reduce((s, x) => s + (x.valores[i] || 0), 0));
  const { tope, marcas } = escala(Math.max(...totales, 1));
  return (
    <div style={{ fontFamily: F }}>
      {series.length > 1 && <Leyenda items={series.map((s) => ({ c: s.color, l: s.nombre }))} />}
      <div style={{ display: "flex", height: alto }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingRight: 8, fontSize: 10.5, color: C.muted, textAlign: "right", minWidth: 34 }}>
          {[...marcas].reverse().map((m) => <span key={m} style={{ lineHeight: "10px" }}>{num(m)}</span>)}
        </div>
        <div style={{ flex: 1, position: "relative", borderBottom: "1px solid " + C.border }}>
          {marcas.slice(1).map((m) => <div key={m} style={{ position: "absolute", left: 0, right: 0, bottom: (m / tope) * 100 + "%", borderTop: "1px dashed " + C.border + "99" }} />)}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 2 }}>
            {etiquetas.map((e, i) => (
              <div key={e + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}
                style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column-reverse", alignItems: "center", position: "relative" }}>
                <div style={{ width: "66%", maxWidth: 30, height: (totales[i] / tope) * 100 + "%", display: "flex", flexDirection: "column-reverse", gap: totales[i] > 0 ? 2 : 0 }}>
                  {series.map((s, k) => (s.valores[i] > 0 ? (
                    <div key={s.nombre} style={{ flex: s.valores[i], minHeight: 2, background: hover === i ? s.color : s.color + "DD", borderRadius: k === series.length - 1 || series.slice(k + 1).every((x) => !(x.valores[i] > 0)) ? "4px 4px 0 0" : 0 }} />
                  ) : null))}
                </div>
                {hover === i && (
                  <Burbuja>
                    <div style={{ color: C.mutedL, fontSize: 11 }}>{e} · total <b style={{ color: C.text }}>{formato(totales[i])}</b></div>
                    {series.filter((s) => s.valores[i] > 0).map((s) => <div key={s.nombre}><span style={{ color: s.color }}>■</span> {s.nombre}: <b>{formato(s.valores[i])}</b></div>)}
                  </Burbuja>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", paddingLeft: 42, marginTop: 6, gap: 2 }}>
        {etiquetas.map((e, i) => <div key={e + i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: C.muted, overflow: "hidden", whiteSpace: "nowrap" }}>{etiquetas.length > 10 && i % Math.ceil(etiquetas.length / 8) !== 0 ? "" : e}</div>)}
      </div>
    </div>
  );
}

// Líneas con cruz al pasar el ratón. Todas las series en la misma unidad.
function Lineas({ etiquetas, series, alto = 180, formato = (v: number) => num(v) }: {
  etiquetas: string[]; series: { nombre: string; color: string; valores: (number | null)[] }[]; alto?: number; formato?: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const vals = series.flatMap((s) => s.valores.filter((v) => v !== null && isFinite(v as number)) as number[]);
  const { tope, marcas } = escala(Math.max(...vals, 0.0001));
  const W = 1000, H = 100;
  const N = Math.max(1, etiquetas.length - 1);
  const x = (i: number) => (etiquetas.length === 1 ? W / 2 : (i / N) * W);
  const y = (v: number) => H - (v / tope) * H;
  const mover = (ev: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const i = Math.round(((ev.clientX - r.left) / r.width) * N);
    setHover(Math.max(0, Math.min(etiquetas.length - 1, i)));
  };
  return (
    <div style={{ fontFamily: F }}>
      {series.length > 1 && <Leyenda items={series.map((s) => ({ c: s.color, l: s.nombre, linea: true }))} />}
      <div style={{ display: "flex", height: alto }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingRight: 8, fontSize: 10.5, color: C.muted, textAlign: "right", minWidth: 34 }}>
          {[...marcas].reverse().map((m) => <span key={m} style={{ lineHeight: "10px" }}>{formato(m)}</span>)}
        </div>
        <div ref={ref} onMouseMove={mover} onMouseLeave={() => setHover(null)} onClick={mover} style={{ flex: 1, position: "relative", borderBottom: "1px solid " + C.border, cursor: "crosshair" }}>
          {marcas.slice(1).map((m) => <div key={m} style={{ position: "absolute", left: 0, right: 0, bottom: (m / tope) * 100 + "%", borderTop: "1px dashed " + C.border + "99" }} />)}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            {series.map((s) => {
              let d = "";
              s.valores.forEach((v, i) => { if (v === null || !isFinite(v)) return; d += (d && s.valores[i - 1] !== null && s.valores[i - 1] !== undefined ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); });
              return <path key={s.nombre} d={d} fill="none" stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />;
            })}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke={C.mutedL} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />}
          </svg>
          {hover !== null && series.map((s) => (s.valores[hover] !== null && isFinite(s.valores[hover] as number) ? (
            <div key={s.nombre} style={{ position: "absolute", left: (x(hover) / W) * 100 + "%", top: (y(s.valores[hover] as number) / H) * 100 + "%", width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, borderRadius: 99, background: s.color, border: "2px solid " + C.card, pointerEvents: "none" }} />
          ) : null))}
          {hover !== null && (
            <div style={{ position: "absolute", left: Math.min(78, Math.max(8, (x(hover) / W) * 100)) + "%", top: 0, transform: "translate(-50%, -110%)", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "6px 9px", fontSize: 12, color: C.text, whiteSpace: "nowrap", zIndex: 6, pointerEvents: "none", lineHeight: 1.5 }}>
              <div style={{ color: C.mutedL, fontSize: 11 }}>{etiquetas[hover]}</div>
              {series.map((s) => <div key={s.nombre}><span style={{ color: s.color }}>■</span> {s.nombre}: <b>{s.valores[hover] === null ? "—" : formato(s.valores[hover] as number)}</b></div>)}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 42, marginTop: 6, fontSize: 10, color: C.muted }}>
        <span>{etiquetas[0]}</span>{etiquetas.length > 2 && <span>{etiquetas[Math.floor(etiquetas.length / 2)]}</span>}<span>{etiquetas[etiquetas.length - 1]}</span>
      </div>
    </div>
  );
}

// Barra horizontal segmentada (estados de los leads de un profesional)
const SEG_PRO = [
  { k: "ganados", l: "Ganados", c: SERIE[2] },
  { k: "en_curso", l: "Contactados / presupuesto", c: SERIE[0] },
  { k: "sin_tocar", l: "Sin tocar", c: SERIE[3] },
  { k: "perdidos", l: "Perdidos", c: SERIE[5] },
  { k: "anulados", l: "Anulados", c: SERIE[4] },
];
function BarraSeg({ fila, max }: { fila: J; max: number }) {
  const total = SEG_PRO.reduce((s, x) => s + n(fila[x.k]), 0);
  const ancho = max > 0 ? Math.max(6, (total / max) * 100) : 0;
  return (
    <div title={SEG_PRO.map((x) => x.l + ": " + n(fila[x.k])).join(" · ")} style={{ width: 170, height: 12, background: C.bg, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: ancho + "%", height: "100%", display: "flex", gap: 2 }}>
        {SEG_PRO.map((x) => (n(fila[x.k]) > 0 ? <div key={x.k} style={{ flex: n(fila[x.k]), background: x.c }} /> : null))}
      </div>
    </div>
  );
}

function Encajar({ puntos }: { puntos: [number, number][] }) {
  const map = useMap();
  const k = puntos.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (!puntos.length) return;
    if (puntos.length === 1) map.setView(puntos[0], 8);
    else map.fitBounds(puntos as any, { padding: [50, 50], maxZoom: 8 });
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Chips({ valor, opciones, onChange }: { valor: string; opciones: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {opciones.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{ fontFamily: F, fontSize: 12.5, fontWeight: 800, padding: "6px 11px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (valor === o.v ? C.accent : C.border), background: valor === o.v ? C.accent + "18" : "transparent", color: valor === o.v ? C.accent : C.mutedL }}>{o.l}</button>
      ))}
    </div>
  );
}

const textoArea: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontSize: 14, fontFamily: F, outline: "none", minHeight: 90, resize: "vertical" };
const etiq: React.CSSProperties = { display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 };

// ============================================================
// PÁGINA
// ============================================================
export default function Marketing({ d, recargar, aviso }: SeccionProps) {
  const ancho = useAncho();
  const movil = ancho < 760;
  const hoy = ymdMadrid(Date.now());
  const [clave, setClave] = useState(() => { try { return localStorage.getItem(CLAVE_LS) || ""; } catch { return ""; } });
  const [claveInput, setClaveInput] = useState("");
  const [tab, setTab] = useState<string>(() => { try { return localStorage.getItem(TAB_LS) || "dinero"; } catch { return "dinero"; } });
  const [rango, setRango] = useState("30");
  const [desde, setDesde] = useState(sumarDias(hoy, -29));
  const [hasta, setHasta] = useState(hoy);
  const [frente, setFrente] = useState("");
  const [data, setData] = useState<J>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!clave) return;
    setCargando(true);
    const { data: r, error: e } = await db.rpc("mkt_marketing", { p_clave: clave, p_desde: desde, p_hasta: hasta });
    setCargando(false);
    if (e) {
      if (/acceso denegado/i.test(e.message)) { try { localStorage.removeItem(CLAVE_LS); } catch { /* nada */ } setClave(""); setError("Clave incorrecta"); return; }
      setError(e.message); return;
    }
    setError(""); setData(r);
  }, [clave, desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  const elegirTab = (t: string) => { setTab(t); try { localStorage.setItem(TAB_LS, t); } catch { /* nada */ } };
  const elegirRango = (k: string) => {
    setRango(k);
    if (k === "7") { setDesde(sumarDias(hoy, -6)); setHasta(hoy); }
    if (k === "30") { setDesde(sumarDias(hoy, -29)); setHasta(hoy); }
    if (k === "90") { setDesde(sumarDias(hoy, -89)); setHasta(hoy); }
    if (k === "mes") { setDesde(mesHoy() + "-01"); setHasta(hoy); }
    if (k === "mesAnt") { const m = mesMover(mesHoy(), -1); setDesde(m + "-01"); setHasta(m + "-" + String(diasDelMes(m)).padStart(2, "0")); }
  };

  const llamar = async (fn: string, args: J, ok: string) => {
    const { error: e } = await db.rpc(fn, { p_clave: clave, ...args });
    if (e) { aviso("No se pudo: " + e.message); return false; }
    aviso(ok); await cargar(); return true;
  };

  if (!clave) {
    const entrar = () => { try { localStorage.setItem(CLAVE_LS, claveInput); } catch { /* nada */ } setClave(claveInput); setError(""); };
    return (
      <div style={{ maxWidth: 420, margin: "40px auto", fontFamily: F }}>
        <Card>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Marketing</div>
          <div style={{ fontSize: 13, color: C.mutedL, marginBottom: 14 }}>Entra con tu clave del CRM de captación (la tuya o la de la oficina).</div>
          <input type="password" value={claveInput} onChange={(ev) => setClaveInput(ev.target.value)} placeholder="Clave"
            onKeyDown={(ev) => { if (ev.key === "Enter" && claveInput.length >= 8) entrar(); }}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontFamily: F, fontSize: 14, marginBottom: 10 }} />
          {error && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <Btn full disabled={claveInput.length < 8} onClick={entrar}>Entrar</Btn>
        </Card>
      </div>
    );
  }

  const esAdmin = data?.rol === "admin";
  const frentes: { v: string; l: string }[] = useMemoFrentes(data);
  const pasaFrente = (o: string, c: string) => !frente || frente === o + "|" + c;
  const tabInfo = TABS.find((t) => t.id === tab) || TABS[0];

  const cabecera = (
    <>
      <Cabecera titulo="Marketing" sub={data ? `${data.nombre} · ${esAdmin ? "administrador" : "oficina"} · del ${ddmm(data.periodo.desde)} al ${ddmm(data.periodo.hasta)}, comparado con los ${data.periodo.dias} días anteriores` : "Cargando…"}>
        {([["7", "7 días"], ["30", "30 días"], ["90", "90 días"], ["mes", "Este mes"], ["mesAnt", "Mes anterior"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => elegirRango(k)} style={{ fontFamily: F, fontSize: 12.5, fontWeight: 800, padding: "7px 11px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (rango === k ? C.accent : C.border), background: rango === k ? C.accent + "18" : "transparent", color: rango === k ? C.accent : C.mutedL }}>{l}</button>
        ))}
        <Sel value={frente} onChange={setFrente} options={[{ v: "", l: "Todos los oficios y ciudades" }, ...frentes]} />
        <Btn small outline onClick={cargar}>{cargando ? "Cargando…" : "Actualizar"}</Btn>
      </Cabecera>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: "1px solid " + C.border, marginBottom: 14, paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => elegirTab(t.id)} style={{
            fontFamily: F, fontSize: 13.5, fontWeight: 800, padding: "10px 13px", border: "none", cursor: "pointer", whiteSpace: "nowrap", background: "transparent",
            color: tab === t.id ? C.accent : C.mutedL, borderBottom: "3px solid " + (tab === t.id ? C.accent : "transparent"), marginBottom: -1,
          }}>{t.t}</button>
        ))}
      </div>
      {data && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.muted, marginBottom: 12 }}>
          <span>Anuncios actualizados {data.salud?.ultimo_sync ? "hace " + hace(data.salud.ultimo_sync) : "—"}</span>
          <span>Visitas propias {data.salud?.visitas_desde ? "desde el " + ddmm(data.salud.visitas_desde) + " · hoy " + num(data.salud.visitas_hoy) : "empiezan a contarse hoy"}</span>
          <span>Gasto automático hasta el {data.salud?.gasto_auto_hasta ? ddmm(data.salud.gasto_auto_hasta) : "—"}</span>
        </div>
      )}
    </>
  );

  if (!data) {
    return (
      <div style={{ fontFamily: F }}>
        {cabecera}
        {error ? <Card accent={C.red}><span style={{ color: C.red }}>{error}</span></Card> : <div style={{ color: C.mutedL, padding: 30 }}>Cargando datos…</div>}
      </div>
    );
  }

  const comun = { data, frente, pasaFrente, esAdmin, movil, llamar, d, aviso, recargar, pregunta: tabInfo.q, setFrente };
  return (
    <div style={{ fontFamily: F }}>
      {cabecera}
      {error && <Card accent={C.red}><span style={{ color: C.red }}>{error}</span></Card>}
      {tab === "dinero" && <TabDinero {...comun} />}
      {tab === "leads" && <TabLeads {...comun} />}
      {tab === "campanas" && <TabCampanas {...comun} />}
      {tab === "web" && <TabWeb {...comun} />}
      {tab === "tests" && <TabTests {...comun} />}
      {tab === "plan" && <TabPlan {...comun} />}
    </div>
  );
}

const TABS = [
  { id: "dinero", t: "¿Ganamos dinero?", q: "¿Ganamos dinero con los anuncios?" },
  { id: "leads", t: "¿Dónde entran los leads?", q: "¿Dónde entran los leads y quién los aprovecha?" },
  { id: "campanas", t: "¿Dónde se va el dinero?", q: "¿Dónde se va el dinero de las campañas?" },
  { id: "web", t: "¿Convierte la web?", q: "¿Las landings convierten las visitas en leads?" },
  { id: "tests", t: "Tests A/B", q: "¿Qué cambios funcionan de verdad?" },
  { id: "plan", t: "Plan y propuestas", q: "¿En qué fase está cada oficio y qué hacemos ahora?" },
];

function useMemoFrentes(data: J): { v: string; l: string }[] {
  if (!data) return [];
  const vistos = new Map<string, string>();
  (data.frentes || []).forEach((f: J) => vistos.set(f.oficio + "|" + f.ciudad, frenteTxt(f.oficio, f.ciudad)));
  (data.dinero || []).filter((r: J) => n(r.gasto) + n(r.leads) > 0).forEach((r: J) => { if (r.oficio !== "otros") vistos.set(r.oficio + "|" + r.ciudad, frenteTxt(r.oficio, r.ciudad)); });
  return Array.from(vistos.entries()).map(([v, l]) => ({ v, l })).sort((a, b) => a.l.localeCompare(b.l));
}

type Comun = {
  data: J; frente: string; pasaFrente: (o: string, c: string) => boolean; esAdmin: boolean; movil: boolean;
  llamar: (fn: string, args: J, ok: string) => Promise<boolean>; d: SeccionProps["d"]; aviso: (m: string) => void; recargar: () => Promise<void>;
  pregunta: string; setFrente: (f: string) => void;
};

// Precio al que se vende el lead (para saber si un coste por lead es bueno)
function precioLead(d: SeccionProps["d"], oficio: string, ciudad: string) {
  const k = oficio === "pintura" ? "pintor" : "fontanero";
  const pc = (d.preciosCiudad || {})[ciudad] as J;
  if (pc && n(pc[k]) > 0) return n(pc[k]);
  const p = (d.precios || []).find((x) => x.trade_key !== "_default" && (oficio === "pintura" ? /pint/.test(x.trade_key) : /fontan/.test(x.trade_key)));
  return p ? n(p.price) : oficio === "pintura" ? 80 : 40;
}

// ============================================================
// 1 · ¿GANAMOS DINERO?
// ============================================================
function TabDinero({ data, frente, pasaFrente, pregunta, d, aviso, recargar, esAdmin }: Comun) {
  const filas: J[] = (data.dinero || []).filter((r: J) => pasaFrente(r.oficio, r.ciudad));
  const t = filas.reduce((s, r) => ({
    gasto: s.gasto + n(r.gasto), gasto_ant: s.gasto_ant + n(r.gasto_ant), leads: s.leads + n(r.leads), leads_ant: s.leads_ant + n(r.leads_ant),
    vendidos: s.vendidos + n(r.vendidos), anulados: s.anulados + n(r.anulados), ingresos: s.ingresos + n(r.ingresos), ingresos_ant: s.ingresos_ant + n(r.ingresos_ant),
  }), { gasto: 0, gasto_ant: 0, leads: 0, leads_ant: 0, vendidos: 0, anulados: 0, ingresos: 0, ingresos_ant: 0 });
  const roas = ratio(t.ingresos, t.gasto), roasAnt = ratio(t.ingresos_ant, t.gasto_ant);
  const margen = t.ingresos - t.gasto, margenAnt = t.ingresos_ant - t.gasto_ant;
  const comisiones = !frente ? n(data.kpis?.comisiones) : 0;

  let tono: "bien" | "mal" | "regular" | "neutro" = "neutro";
  let texto: React.ReactNode = "No hay gasto en anuncios en este periodo.";
  if (t.gasto > 0) {
    if ((roas || 0) >= 1.2) { tono = "bien"; texto = <>Sí. Por cada euro en anuncios vuelven {xTxt(roas)}: margen de {eur(margen)}.</>; }
    else if ((roas || 0) >= 1) { tono = "regular"; texto = <>Justo. Se cubre el gasto ({xTxt(roas)}) pero el margen es pequeño: {eur(margen)}.</>; }
    else { tono = "mal"; texto = <>No. Se gastan {eur(t.gasto)} y entran {eur(t.ingresos)}: perdemos {eur(-margen)}.</>; }
  }
  const pierden = filas.filter((r) => n(r.gasto) > 20 && n(r.ingresos) < n(r.gasto));
  const detalle = (
    <>
      Ingresos = leads vendidos a profesionales (sin anulados){comisiones > 0 ? `; además hay ${eur(comisiones)} de comisiones cobradas` : ""}.
      {pierden.length > 0 && <> Pierden dinero: <b style={{ color: C.text }}>{pierden.map((r) => frenteTxt(r.oficio, r.ciudad)).join(", ")}</b>.</>}
    </>
  );

  const semanas: J[] = (data.semanas || []).filter((r: J) => pasaFrente(r.oficio, r.ciudad));
  const porSemana = Array.from(new Set(semanas.map((r) => r.s))).sort().map((s) => {
    const rs = semanas.filter((r) => r.s === s);
    return { s, gasto: rs.reduce((a, r) => a + n(r.gasto), 0), ingresos: rs.reduce((a, r) => a + n(r.ingresos), 0), leads: rs.reduce((a, r) => a + n(r.leads), 0) };
  });

  return (
    <>
      <Respuesta pregunta={pregunta} tono={tono} texto={texto} detalle={detalle} />
      <Grid min={160}>
        <KpiD label="Gasto en anuncios" valor={eur(t.gasto)} act={t.gasto} ant={t.gasto_ant} bueno="baja" ayuda="Google Ads + Meta de clientes (automático)" />
        <KpiD label="Ingresos por leads" valor={eur(t.ingresos)} act={t.ingresos} ant={t.ingresos_ant} ayuda="Leads enviados a profesionales, sin anulados" />
        <KpiD label="Margen tras anuncios" valor={eur(margen)} act={margen} ant={margenAnt} />
        <KpiD label="ROAS" valor={xTxt(roas)} act={roas} ant={roasAnt} ayuda="Ingresos ÷ gasto. Por encima de 1x se gana dinero" />
        <KpiD label="Coste por solicitud" valor={eur2(ratio(t.gasto, t.leads))} act={ratio(t.gasto, t.leads)} ant={ratio(t.gasto_ant, t.leads_ant)} bueno="baja" ayuda="Gasto ÷ solicitudes de clientes" />
        <KpiD label="Leads anulados" valor={pctTxt(ratio(t.anulados, t.vendidos + t.anulados))} sub={`${num(t.anulados)} de ${num(t.vendidos + t.anulados)} enviados`} />
      </Grid>

      <Titulo>Gasto frente a ingresos por semana (últimas 12)</Titulo>
      <Card>
        {porSemana.length ? (
          <BarrasPar etiquetas={porSemana.map((w) => ddmm(w.s))}
            a={{ nombre: "Ingresos por leads", color: COL_INGRESOS, valores: porSemana.map((w) => w.ingresos) }}
            b={{ nombre: "Gasto en anuncios", color: COL_GASTO, valores: porSemana.map((w) => w.gasto) }}
            extra={(i) => <div style={{ color: C.mutedL }}>{num(porSemana[i].leads)} solicitudes · ROAS <b style={{ color: C.text }}>{xTxt(ratio(porSemana[i].ingresos, porSemana[i].gasto))}</b></div>} />
        ) : <Vacio texto="Sin datos" />}
      </Card>

      <Titulo>Por oficio y ciudad</Titulo>
      <Tabla
        cols={[{ k: "f", l: "Oficio y ciudad" }, { k: "v", l: "¿Gana?" }, { k: "g", l: "Gasto", align: "right" }, { k: "s", l: "Solicitudes", align: "right" }, { k: "ve", l: "Vendidos", align: "right" },
          { k: "an", l: "Anulados", align: "right" }, { k: "i", l: "Ingresos", align: "right" }, { k: "m", l: "Margen", align: "right" }, { k: "r", l: "ROAS", align: "right" },
          { k: "c", l: "Coste/solicitud", align: "right" }, { k: "p", l: "Precio lead", align: "right" }]}
        filas={filas.map((r) => {
          const g = n(r.gasto), i = n(r.ingresos), cps = ratio(g, n(r.leads)), precio = precioLead(d, r.oficio, r.ciudad);
          const v = g === 0 ? <Pill texto="Sin anuncios" color={C.mutedL} /> : i >= g * 1.2 ? <Pill texto="✓ Gana" color={C.green} /> : i >= g ? <Pill texto="! Justo" color={C.orange} /> : <Pill texto="✕ Pierde" color={C.red} />;
          return {
            f: <b>{frenteTxt(r.oficio, r.ciudad)}</b>, v, g: eur(g), s: num(r.leads), ve: num(r.vendidos), an: num(r.anulados), i: eur(i),
            m: <span style={{ color: i - g >= 0 ? C.green : C.red, fontWeight: 800 }}>{eur(i - g)}</span>, r: xTxt(ratio(i, g)),
            c: cps === null || g === 0 ? "—" : <span style={{ color: cps <= precio ? C.text : C.red }}>{eur2(cps)}</span>, p: r.oficio === "pintura" || r.oficio === "fontaneria" ? eur(precio) : "—",
          };
        })}
        vacio="Sin datos en el periodo"
      />
      <div style={{ fontSize: 12, color: C.muted, marginTop: -4 }}>El coste por solicitud sale en rojo cuando supera lo que paga el profesional por el lead.</div>

      <GastoManual d={d} aviso={aviso} recargar={recargar} esAdmin={esAdmin} hasta={data.salud?.gasto_auto_hasta} />
    </>
  );
}

// Gastos que no vienen de Google Ads ni de Meta: se meten a mano. El resto ya entra solo.
function GastoManual({ d, aviso, recargar, hasta }: { d: SeccionProps["d"]; aviso: (m: string) => void; recargar: () => Promise<void>; esAdmin: boolean; hasta?: string }) {
  const [abierto, setAbierto] = useState(false);
  const hoy = ymdMadrid(Date.now());
  const [f, setF] = useState({ desde: hoy, hasta: hoy, plataforma: "otro", oficio: "", ciudad: "sevilla", importe: "", nota: "" });
  const [guardando, setGuardando] = useState(false);
  const manuales = (d.gastos || []).filter((g: Gasto & J) => !g.auto_key);
  const auto = (d.gastos || []).filter((g: Gasto & J) => !!g.auto_key);
  const guardar = async () => {
    const imp = Number(f.importe.replace(/\./g, "").replace(",", "."));
    if (!f.desde || !f.hasta || f.hasta < f.desde) { aviso("Revisa las fechas"); return; }
    if (!(imp > 0)) { aviso("Pon el importe"); return; }
    setGuardando(true);
    const { error } = await db.from("ad_spend").insert({ desde: f.desde, hasta: f.hasta, plataforma: f.plataforma, oficio: f.oficio || null, ciudad: f.ciudad || null, importe: imp, nota: f.nota.trim() || null });
    setGuardando(false);
    if (error) { aviso("Error: " + error.message); return; }
    setF({ ...f, importe: "", nota: "" }); aviso("Gasto guardado"); recargar();
  };
  const borrar = async (g: Gasto) => {
    if (!confirm("¿Borrar el gasto de " + fecha(g.desde) + " a " + fecha(g.hasta) + " (" + eur(g.importe, 2) + ")?")) return;
    await db.from("ad_spend").delete().eq("id", g.id);
    aviso("Gasto borrado"); recargar();
  };
  return (
    <>
      <Titulo accion={<Btn small outline onClick={() => setAbierto(!abierto)}>{abierto ? "Ocultar" : "Ver / añadir"}</Btn>}>Otros gastos de publicidad</Titulo>
      <Card>
        <div style={{ fontSize: 13, color: C.mutedL, lineHeight: 1.55 }}>
          El gasto de <b style={{ color: C.text }}>Google Ads y Meta</b> se mete solo cada hora, por campaña, oficio y ciudad ({num(auto.length)} días-campaña{hasta ? ", último el " + ddmm(hasta) : ""}).
          Aquí apunta solo lo que no sale de ahí: flyers, otra plataforma, un influencer…
        </div>
        {abierto && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              <Campo label="Desde" type="date" value={f.desde} onChange={(v: string) => setF({ ...f, desde: v })} />
              <Campo label="Hasta (incluido)" type="date" value={f.hasta} onChange={(v: string) => setF({ ...f, hasta: v })} />
              <div style={{ marginBottom: 12 }}><label style={etiq}>Plataforma</label>
                <Sel value={f.plataforma} onChange={(v) => setF({ ...f, plataforma: v })} style={{ width: "100%" }} options={[{ v: "otro", l: "Otro" }, { v: "meta_ads", l: "Meta (a mano)" }]} /></div>
              <div style={{ marginBottom: 12 }}><label style={etiq}>Oficio</label>
                <Sel value={f.oficio} onChange={(v) => setF({ ...f, oficio: v })} style={{ width: "100%" }} options={[{ v: "", l: "General" }, { v: "pintor", l: "Pintura" }, { v: "fontanero", l: "Fontanería" }]} /></div>
              <div style={{ marginBottom: 12 }}><label style={etiq}>Ciudad</label>
                <Sel value={f.ciudad} onChange={(v) => setF({ ...f, ciudad: v })} style={{ width: "100%" }} options={Object.entries(CIUDAD_TXT).map(([v, l]) => ({ v, l }))} /></div>
              <Campo label="Importe (€)" value={f.importe} onChange={(v: string) => setF({ ...f, importe: v })} inputMode="decimal" placeholder="Ej. 120" />
            </div>
            <Campo label="Nota" value={f.nota} onChange={(v: string) => setF({ ...f, nota: v })} placeholder="Ej. Flyers buzoneo Nervión" />
            <Btn onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar gasto"}</Btn>
            <div style={{ height: 14 }} />
            <Tabla
              cols={[{ k: "p", l: "Periodo" }, { k: "pl", l: "Plataforma" }, { k: "o", l: "Oficio" }, { k: "i", l: "Importe", align: "right" }, { k: "no", l: "Nota" }, { k: "a", l: "" }]}
              filas={manuales.map((g: Gasto & J) => ({
                p: fecha(g.desde) + " – " + fecha(g.hasta), pl: g.plataforma === "google_ads" ? "Google (a mano)" : g.plataforma === "meta_ads" ? "Meta" : "Otro",
                o: g.oficio ? cap(g.oficio) : "General", i: <b>{eur(g.importe, 2)}</b>, no: g.nota || "—",
                a: <Btn small outline color={C.red} onClick={() => borrar(g)}>Borrar</Btn>,
              }))}
              vacio="No hay gastos metidos a mano"
            />
          </div>
        )}
      </Card>
    </>
  );
}

// ============================================================
// 2 · ¿DÓNDE ENTRAN LOS LEADS Y QUIÉN LOS APROVECHA?
// ============================================================
function TabLeads({ data, pasaFrente, pregunta, movil }: Comun) {
  const [ciudadSel, setCiudadSel] = useState("");
  const filas: J[] = (data.dinero || []).filter((r: J) => pasaFrente(r.oficio, r.ciudad));
  const porCiudad = useMemo(() => {
    const m: Record<string, J> = {};
    filas.forEach((r) => {
      const c = (m[r.ciudad] = m[r.ciudad] || { ciudad: r.ciudad, leads: 0, leads_ant: 0, vendidos: 0, anulados: 0, ingresos: 0, gasto: 0, oficios: {} as Record<string, number> });
      c.leads += n(r.leads); c.leads_ant += n(r.leads_ant); c.vendidos += n(r.vendidos); c.anulados += n(r.anulados); c.ingresos += n(r.ingresos); c.gasto += n(r.gasto);
      c.oficios[r.oficio] = (c.oficios[r.oficio] || 0) + n(r.leads);
    });
    return Object.values(m).filter((c: J) => c.leads + c.vendidos + c.gasto > 0).sort((a: J, b: J) => b.leads - a.leads);
  }, [data, pasaFrente]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = porCiudad.reduce((s: number, c: J) => s + c.leads, 0);
  const pros: J[] = (data.pros || []).filter((p: J) => pasaFrente(p.oficio, p.ciudad) && (!ciudadSel || p.ciudad === ciudadSel));
  const sinLlamar = pros.filter((p) => n(p.sin_llamar_48h) > 0);
  const top: J = porCiudad[0];

  let tono: "bien" | "mal" | "regular" | "neutro" = total ? "bien" : "neutro";
  let texto: React.ReactNode = "No han entrado leads en este periodo.";
  if (top) texto = <>{ciTxt(top.ciudad)} trae el {pctTxt(top.leads / Math.max(1, total))} de los leads ({num(top.leads)} de {num(total)}){porCiudad.length > 1 ? `; le sigue ${ciTxt(porCiudad[1].ciudad)} con ${num(porCiudad[1].leads)}` : ""}.</>;
  if (sinLlamar.length) tono = "regular";
  const detalle = sinLlamar.length
    ? <>Hay leads sin llamar después de 48 h: <b style={{ color: C.text }}>{sinLlamar.map((p) => (p.nombre || "Sin profesional") + " (" + p.sin_llamar_48h + ")").join(", ")}</b>. Un lead frío casi nunca se cierra.</>
    : <>Todos los profesionales han llamado sus leads en menos de 48 h.</>;

  // Leads por día y ciudad (las 4 ciudades con más leads, el resto en «Otras»)
  const dias: string[] = [];
  for (let x = data.periodo.desde; x <= data.periodo.hasta; x = sumarDias(x, 1)) dias.push(x);
  const ciudadesTop = porCiudad.slice(0, 4).map((c: J) => c.ciudad);
  const ld: J[] = (data.leads_dia || []).filter((r: J) => pasaFrente(r.oficio, r.ciudad));
  const seriesDia = [...ciudadesTop, "otras"].map((c, k) => ({
    nombre: c === "otras" ? "Otras" : ciTxt(c), color: SERIE[k],
    valores: dias.map((dd) => ld.filter((r) => String(r.f) === dd && (c === "otras" ? !ciudadesTop.includes(r.ciudad) : r.ciudad === c)).reduce((s, r) => s + n(r.n), 0)),
  })).filter((s) => s.valores.some((v) => v > 0));

  const maxPro = Math.max(1, ...pros.map((p) => n(p.enviados)));
  const zonas: J[] = (data.zonas || []).filter((z: J) => !ciudadSel || z.ciudad === ciudadSel);
  const zonasUtiles = zonas.filter((z) => (z.zona || "").toLowerCase() !== ciTxt(z.ciudad).toLowerCase());
  const puntos = porCiudad.filter((c: J) => COORD[c.ciudad]).map((c: J) => COORD[c.ciudad]);
  const maxLeads = Math.max(1, ...porCiudad.map((c: J) => c.leads));

  return (
    <>
      <Respuesta pregunta={pregunta} tono={tono} texto={texto} detalle={detalle} />
      <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1.25fr 1fr", gap: 12 }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: movil ? 320 : 400, position: "relative", zIndex: 0, isolation: "isolate" }}>
            <MapContainer center={[39.2, -3.7]} zoom={6} minZoom={4} style={{ height: "100%", width: "100%", background: "#1b1e27" }} scrollWheelZoom={false}>
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" maxZoom={16} />
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
              <Encajar puntos={puntos} />
              {porCiudad.filter((c: J) => COORD[c.ciudad]).map((c: J) => {
                const col = c.gasto <= 0 ? C.blue : c.ingresos >= c.gasto ? C.green : C.red;
                const sel = ciudadSel === c.ciudad;
                return (
                  <CircleMarker key={c.ciudad} center={COORD[c.ciudad]} radius={8 + 22 * Math.sqrt(c.leads / maxLeads)}
                    pathOptions={{ color: sel ? "#ffffff" : col, weight: sel ? 3 : 1.5, fillColor: col, fillOpacity: 0.5 }}
                    eventHandlers={{ click: () => setCiudadSel(sel ? "" : c.ciudad) }}>
                    <Tooltip direction="top" offset={[0, -6]}>
                      <div style={{ fontFamily: F, fontSize: 12, lineHeight: 1.55 }}>
                        <b>{ciTxt(c.ciudad)}</b><br />
                        {num(c.leads)} solicitudes · {num(c.vendidos)} vendidos · {num(c.anulados)} anulados<br />
                        {Object.entries(c.oficios).filter(([, v]) => (v as number) > 0).map(([o, v]) => ofTxt(o) + " " + v).join(" · ")}<br />
                        Ingresos {eur(c.ingresos)} · gasto {eur(c.gasto)}{c.gasto > 0 ? " · ROAS " + xTxt(ratio(c.ingresos, c.gasto)) : ""}<br />
                        <span style={{ color: "#666" }}>{sel ? "Pulsa para quitar el filtro" : "Pulsa para ver solo esta ciudad"}</span>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "10px 14px", fontSize: 12, color: C.mutedL, borderTop: "1px solid " + C.border }}>
            <span><b style={{ color: C.green }}>●</b> Gana dinero</span>
            <span><b style={{ color: C.red }}>●</b> Pierde dinero</span>
            <span><b style={{ color: C.blue }}>●</b> Sin anuncios</span>
            <span style={{ marginLeft: "auto" }}>Tamaño = solicitudes</span>
          </div>
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <b style={{ fontSize: 14 }}>Por ciudad</b>
            {ciudadSel && <Btn small outline onClick={() => setCiudadSel("")}>Ver todas</Btn>}
          </div>
          {porCiudad.length ? porCiudad.map((c: J) => (
            <div key={c.ciudad} onClick={() => setCiudadSel(ciudadSel === c.ciudad ? "" : c.ciudad)} style={{ cursor: "pointer", opacity: ciudadSel && ciudadSel !== c.ciudad ? 0.45 : 1 }}>
              <BarraH label={ciTxt(c.ciudad)} valor={c.leads} total={Math.max(1, total)} color={SERIE[Math.max(0, ciudadesTop.indexOf(c.ciudad))] || SERIE[4]}
                extra={`${num(c.vendidos)} vendidos · ${eur(c.ingresos)}`} />
            </div>
          )) : <Vacio texto="Sin leads" />}
          {(data.canales || []).length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.mutedL, margin: "14px 0 8px" }}>CÓMO CONTACTAN</div>
              {(data.canales || []).map((c: J) => <BarraH key={c.canal} label={cap(c.canal)} valor={n(c.n)} total={Math.max(1, (data.canales || []).reduce((s: number, x: J) => s + n(x.n), 0))} color={C.mutedL} extra={`${num(c.google)} de Google`} />)}
            </>
          )}
        </Card>
      </div>

      <Titulo>Solicitudes por día</Titulo>
      <Card>{seriesDia.length ? <Apiladas etiquetas={dias.map(ddmm)} series={seriesDia} formato={(v) => num(v)} /> : <Vacio texto="Sin solicitudes" />}</Card>

      <Titulo accion={ciudadSel ? <Pill texto={"Solo " + ciTxt(ciudadSel)} color={C.accent} /> : null}>Profesionales: ¿aprovechan los leads?</Titulo>
      <Leyenda items={SEG_PRO.map((s) => ({ c: s.c, l: s.l }))} />
      <Tabla
        cols={[{ k: "p", l: "Profesional" }, { k: "o", l: "Oficio y ciudad" }, { k: "e", l: "Recibidos", align: "right" }, { k: "b", l: "Estado de sus leads" },
          { k: "c", l: "Contactados", align: "right" }, { k: "g", l: "Ganados", align: "right" }, { k: "h", l: "1ª llamada", align: "right" },
          { k: "s", l: "Sin llamar +48 h", align: "right" }, { k: "f", l: "Facturado", align: "right" }]}
        filas={pros.map((p) => {
          const validos = n(p.enviados) - n(p.anulados);
          const contact = n(p.en_curso) + n(p.ganados) + n(p.perdidos);
          return {
            p: <b>{p.nombre || "Sin profesional"}</b>, o: frenteTxt(p.oficio, p.ciudad), e: num(p.enviados), b: <BarraSeg fila={p} max={maxPro} />,
            c: pctTxt(ratio(contact, validos)), g: num(p.ganados),
            h: p.horas_contacto === null || p.horas_contacto === undefined ? "—" : <span style={{ color: n(p.horas_contacto) > 24 ? C.red : n(p.horas_contacto) > 4 ? C.orange : C.text }}>{num(p.horas_contacto, 1)} h</span>,
            s: n(p.sin_llamar_48h) > 0 ? <Pill texto={"! " + p.sin_llamar_48h} color={C.red} /> : "0",
            f: eur(p.importe),
          };
        })}
        vacio="Ningún lead enviado en el periodo"
      />

      {zonasUtiles.length > 0 && (
        <>
          <Titulo>Zonas que indican los clientes</Titulo>
          <Card>{zonasUtiles.slice(0, 12).map((z: J) => <BarraH key={z.ciudad + z.zona} label={z.zona + " · " + ciTxt(z.ciudad)} valor={n(z.n)} total={Math.max(1, zonas.reduce((s, x) => s + n(x.n), 0))} color={C.mutedL} />)}</Card>
        </>
      )}
    </>
  );
}

// ============================================================
// 3 · ¿DÓNDE SE VA EL DINERO?
// ============================================================
function TabCampanas({ data, pasaFrente, pregunta, d }: Comun) {
  const camps: J[] = (data.campanas || []).filter((c: J) => pasaFrente(c.oficio, c.ciudad));
  // El color sigue a la campaña: orden fijo por id, no por gasto
  const orden = [...(data.campanas || [])].sort((a: J, b: J) => String(a.campaign_id).localeCompare(String(b.campaign_id)));
  const colorDe = (id: string) => SERIE[orden.findIndex((c: J) => c.campaign_id === id) % SERIE.length];
  const tot = camps.reduce((s, c) => ({ coste: s.coste + n(c.coste), coste_ant: s.coste_ant + n(c.coste_ant), clics: s.clics + n(c.clics), clics_ant: s.clics_ant + n(c.clics_ant), conv: s.conv + n(c.conv), conv_ant: s.conv_ant + n(c.conv_ant), leads: s.leads + n(c.leads), leads_ant: s.leads_ant + n(c.leads_ant) }),
    { coste: 0, coste_ant: 0, clics: 0, clics_ant: 0, conv: 0, conv_ant: 0, leads: 0, leads_ant: 0 });

  const alertas: { nivel: "mal" | "regular"; t: React.ReactNode }[] = [];
  camps.forEach((c) => {
    const nom = <b style={{ color: C.text }}>{nombreCamp(c.nombre)}</b>;
    const precio = precioLead(d, c.oficio, c.ciudad);
    const cpc = ratio(n(c.coste), n(c.clics)), cpcAnt = ratio(n(c.coste_ant), n(c.clics_ant));
    if (n(c.coste) >= precio * 2 && n(c.leads) === 0) alertas.push({ nivel: "mal", t: <>{nom} ha gastado {eur(c.coste)} sin ningún lead en el CRM.</> });
    else if (n(c.leads) > 0 && n(c.coste) / n(c.leads) > precio) alertas.push({ nivel: "mal", t: <>{nom}: cada lead cuesta {eur2(n(c.coste) / n(c.leads))} y se vende a {eur(precio)}.</> });
    if (n(c.p_presupuesto) > 0.3) alertas.push({ nivel: "regular", t: <>{nom} pierde el {pctTxt(c.p_presupuesto)} de las impresiones por presupuesto ({eur(c.presupuesto_dia)}/día).</> });
    if (cpc !== null && cpcAnt !== null && n(c.clics) >= 15 && n(c.clics_ant) >= 15 && cpc > cpcAnt * 1.25) alertas.push({ nivel: "regular", t: <>El clic de {nom} ha subido un {pctTxt(cpc / cpcAnt - 1)} ({eur2(cpcAnt)} → {eur2(cpc)}).</> });
    if (n(c.conv) >= 3 && n(c.leads) <= n(c.conv) * 0.4) alertas.push({ nivel: "regular", t: <>Google cuenta {num(c.conv, 1)} conversiones en {nom} pero el CRM solo tiene {num(c.leads)} leads con su clic: revisar el seguimiento.</> });
  });
  const mayor = [...camps].sort((a, b) => n(b.coste) - n(a.coste))[0];
  let tono: "bien" | "mal" | "regular" | "neutro" = alertas.some((a) => a.nivel === "mal") ? "mal" : alertas.length ? "regular" : tot.coste > 0 ? "bien" : "neutro";
  const texto: React.ReactNode = !mayor || tot.coste === 0 ? "Sin gasto en el periodo." : (
    <>«{nombreCamp(mayor.nombre)}» se lleva el {pctTxt(n(mayor.coste) / tot.coste)} del gasto ({eur(mayor.coste)}) y trae {num(mayor.leads)} leads{n(mayor.leads) ? ` a ${eur2(n(mayor.coste) / n(mayor.leads))} cada uno` : ""}.</>
  );
  if (!alertas.length && tono === "bien") tono = "bien";

  const dias: string[] = [];
  for (let x = data.periodo.desde; x <= data.periodo.hasta; x = sumarDias(x, 1)) dias.push(x);
  const serie: J[] = data.serie_campanas || [];
  const idsVis = camps.filter((c) => n(c.coste) > 0).map((c) => c.campaign_id);
  const series = idsVis.map((id) => ({
    nombre: nombreCamp((camps.find((c) => c.campaign_id === id) || {}).nombre), color: colorDe(id),
    valores: dias.map((dd) => serie.filter((r) => r.c === id && String(r.f) === dd).reduce((s, r) => s + n(r.coste), 0)),
  }));

  return (
    <>
      <Respuesta pregunta={pregunta} tono={tono} texto={texto} detalle={alertas.length ? `${alertas.length} aviso${alertas.length > 1 ? "s" : ""} abajo.` : "Ninguna campaña da avisos en este periodo."} />
      <Grid min={150}>
        <KpiD label="Gasto" valor={eur(tot.coste)} act={tot.coste} ant={tot.coste_ant} bueno="baja" />
        <KpiD label="Clics" valor={num(tot.clics)} act={tot.clics} ant={tot.clics_ant} />
        <KpiD label="Coste por clic" valor={eur2(ratio(tot.coste, tot.clics))} act={ratio(tot.coste, tot.clics)} ant={ratio(tot.coste_ant, tot.clics_ant)} bueno="baja" />
        <KpiD label="Conversiones (Google)" valor={num(tot.conv, 1)} act={tot.conv} ant={tot.conv_ant} />
        <KpiD label="Leads con clic de anuncio" valor={num(tot.leads)} act={tot.leads} ant={tot.leads_ant} ayuda="Leads del CRM cuyo gclid se ha cruzado con la campaña" />
        <KpiD label="Coste por lead (anuncios)" valor={eur2(ratio(tot.coste, tot.leads))} act={ratio(tot.coste, tot.leads)} ant={ratio(tot.coste_ant, tot.leads_ant)} bueno="baja" />
      </Grid>

      {alertas.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          {alertas.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: i ? "1px solid " + C.border + "88" : undefined, fontSize: 13, color: C.mutedL, lineHeight: 1.5 }}>
              <Pill texto={a.nivel === "mal" ? "✕ Problema" : "! Atención"} color={a.nivel === "mal" ? C.red : C.orange} /><span>{a.t}</span>
            </div>
          ))}
        </Card>
      )}

      <Titulo>Gasto por día y campaña</Titulo>
      <Card>{series.length ? <Apiladas etiquetas={dias.map(ddmm)} series={series} /> : <Vacio texto="Sin gasto" />}</Card>

      <Titulo>Campañas</Titulo>
      <Tabla
        cols={[{ k: "n", l: "Campaña" }, { k: "e", l: "Puja" }, { k: "pr", l: "€/día", align: "right" }, { k: "g", l: "Gasto", align: "right" }, { k: "cl", l: "Clics", align: "right" },
          { k: "cpc", l: "CPC", align: "right" }, { k: "cv", l: "Conv. Google", align: "right" }, { k: "l", l: "Leads CRM", align: "right" }, { k: "cpl", l: "€/lead", align: "right" },
          { k: "cu", l: "Cuota impr.", align: "right" }, { k: "pp", l: "Pierde presup.", align: "right" }, { k: "pk", l: "Pierde ranking", align: "right" }]}
        filas={camps.map((c) => {
          const precio = precioLead(d, c.oficio, c.ciudad), cpl = ratio(n(c.coste), n(c.leads));
          return {
            n: <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: colorDe(c.campaign_id) }} /><b>{nombreCamp(c.nombre)}</b>{c.estado !== "ENABLED" && c.estado !== "ACTIVE" ? <Pill texto="Pausada" color={C.muted} /> : null}</span>,
            e: <span style={{ fontSize: 12, color: C.mutedL }}>{String(c.estrategia || "—").replace("MAXIMIZE_CONVERSION_VALUE", "Máx. valor").replace("MAXIMIZE_CONVERSIONS", "Máx. conversiones").replace("TARGET_CPA", "CPA objetivo").replace("MANUAL_CPC", "CPC manual")}</span>,
            pr: c.presupuesto_dia ? eur(c.presupuesto_dia) : "—", g: <b>{eur(c.coste)}</b>, cl: num(c.clics), cpc: eur2(ratio(n(c.coste), n(c.clics))),
            cv: num(c.conv, 1), l: num(c.leads), cpl: cpl === null ? "—" : <span style={{ color: cpl <= precio ? C.green : C.red, fontWeight: 800 }}>{eur2(cpl)}</span>,
            cu: pctTxt(c.cuota), pp: <span style={{ color: n(c.p_presupuesto) > 0.3 ? C.orange : C.text }}>{pctTxt(c.p_presupuesto)}</span>, pk: pctTxt(c.p_ranking),
          };
        })}
        vacio="Sin campañas"
      />

      <Titulo>Búsquedas que gastan sin convertir</Titulo>
      <Tabla
        cols={[{ k: "t", l: "Búsqueda" }, { k: "c", l: "Campaña" }, { k: "g", l: "Gasto", align: "right" }, { k: "cl", l: "Clics", align: "right" }, { k: "e", l: "" }]}
        filas={(data.terminos || []).filter((t: J) => { const c = (data.campanas || []).find((x: J) => x.campaign_id === t.campaign_id); return !c || pasaFrente(c.oficio, c.ciudad); }).map((t: J) => ({
          t: <b>{t.termino}</b>, c: nombreCamp(((data.campanas || []).find((x: J) => x.campaign_id === t.campaign_id) || {}).nombre), g: eur2(t.coste), cl: num(t.clics),
          e: t.excluido ? <Pill texto="Ya excluida" color={C.muted} /> : <Pill texto="Candidata a negativa" color={C.orange} />,
        }))}
        vacio="Ninguna búsqueda ha gastado 3 € o más sin convertir"
      />
    </>
  );
}

// ============================================================
// 4 · ¿CONVIERTE LA WEB?
// ============================================================
function TabWeb({ data, pasaFrente, pregunta }: Comun) {
  const propias = data.web_fuente === "propias";
  const vis = (l: J) => (propias ? n(l.visitas) : n(l.sesiones));
  const lands: J[] = (data.landings || []).filter((l: J) => pasaFrente(l.oficio, l.ciudad));
  const totVis = lands.reduce((s, l) => s + vis(l), 0), totLeads = lands.reduce((s, l) => s + n(l.leads), 0);
  const conv = ratio(totLeads, totVis);
  const sesAnt = lands.reduce((s, l) => s + n(l.sesiones_ant), 0), leadsAnt = lands.reduce((s, l) => s + n(l.leads_ant), 0);
  const convAnt = propias ? null : ratio(leadsAnt, sesAnt);
  const muertas = lands.filter((l) => vis(l) >= 30 && n(l.leads) === 0);
  const tono: "bien" | "mal" | "regular" | "neutro" = !totVis ? "neutro" : muertas.length ? "regular" : (conv || 0) >= 0.05 ? "bien" : "regular";
  const texto: React.ReactNode = !totVis ? "Aún no hay visitas registradas en este periodo." : (
    <>De cada 100 visitas salen {num((conv || 0) * 100, 1)} solicitudes ({num(totLeads)} de {num(totVis)} visitas).</>
  );
  const detalle = (
    <>
      {muertas.length > 0 && <>Con visitas y sin ningún lead: <b style={{ color: C.text }}>{muertas.map((l) => l.landing).join(", ")}</b>. </>}
      {propias ? "Visitas contadas por nuestra web (sin cookies ni datos personales)." : `Visitas según Google Analytics, que cuenta menos porque depende de las cookies. Las visitas propias empezaron el ${data.salud?.visitas_desde ? ddmm(data.salud.visitas_desde) : "—"}; elige un periodo que empiece después para usarlas.`}
    </>
  );

  const webDia: J[] = data.web_dia || [];
  const visDia = webDia.map((r) => (propias ? n(r.visitas) : n(r.sesiones)));
  const convDia = webDia.map((r, i) => (visDia[i] >= 5 ? n(r.leads) / visDia[i] : null));
  const media = conv || 0;
  const disp: J[] = data.web_dispositivos || [], fuentes: J[] = data.web_fuentes || [];
  const totDisp = disp.reduce((s, x) => s + n(x.n), 0), totFu = fuentes.reduce((s, x) => s + n(x.n), 0);
  const FUENTE: Record<string, string> = { google_ads: "Anuncios de Google", google: "Google (orgánico)", meta: "Meta", directo: "Directo", otro: "Otras webs" };

  return (
    <>
      <Respuesta pregunta={pregunta} tono={tono} texto={texto} detalle={detalle} />
      <Grid min={160}>
        <KpiD label={propias ? "Visitas a landings" : "Sesiones (GA4)"} valor={num(totVis)} act={propias ? null : totVis} ant={propias ? null : sesAnt} sub={propias ? `${num(lands.reduce((s, l) => s + n(l.visitas_ads), 0))} desde anuncios` : undefined} />
        <KpiD label="Solicitudes desde landings" valor={num(totLeads)} act={totLeads} ant={leadsAnt} />
        <KpiD label="Conversión" valor={pctTxt(conv, 1)} act={conv} ant={convAnt} sub={convAnt === null ? "Solicitudes ÷ visitas" : undefined} />
        <KpiD label="Por llamada" valor={pctTxt(ratio(lands.reduce((s, l) => s + n(l.leads_llamada), 0), totLeads))} sub={`${num(lands.reduce((s, l) => s + n(l.leads_whatsapp), 0))} por WhatsApp`} />
      </Grid>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        <div>
          <Titulo>{propias ? "Visitas por día" : "Sesiones por día (GA4)"}</Titulo>
          <Card><Barras datos={webDia.map((r, i) => ({ etiqueta: ddmm(r.f), valor: visDia[i], detalle: num(r.leads) + " solicitudes" }))} alto={160} /></Card>
        </div>
        <div>
          <Titulo>Conversión por día</Titulo>
          <Card>
            {convDia.some((v) => v !== null) ? <Lineas etiquetas={webDia.map((r) => ddmm(r.f))} series={[{ nombre: "Conversión", color: SERIE[0], valores: convDia }]} formato={(v) => pctTxt(v, v < 0.1 ? 1 : 0)} alto={160} />
              : <Vacio texto="Hacen falta al menos 5 visitas al día" />}
          </Card>
        </div>
      </div>

      <Titulo>Landings</Titulo>
      <Tabla
        cols={[{ k: "l", l: "Landing" }, { k: "f", l: "Oficio y ciudad" }, { k: "v", l: propias ? "Visitas" : "Sesiones", align: "right" }, { k: "le", l: "Solicitudes", align: "right" },
          { k: "c", l: "Conversión", align: "right" }, { k: "ll", l: "Llamadas", align: "right" }, { k: "w", l: "WhatsApp", align: "right" }, { k: "e", l: "Estado" }]}
        filas={lands.map((l) => {
          const v = vis(l), c = ratio(n(l.leads), v);
          const est = v >= 30 && n(l.leads) === 0 ? <Pill texto="✕ Revisar" color={C.red} /> : v < 20 ? <Pill texto="Pocos datos" color={C.muted} />
            : c !== null && c >= media * 1.3 ? <Pill texto="✓ Por encima" color={C.green} /> : c !== null && c < media * 0.6 ? <Pill texto="! Por debajo" color={C.orange} /> : <Pill texto="En la media" color={C.mutedL} />;
          return {
            l: <a href={"https://aficioya.com/" + l.landing + ".html"} target="_blank" rel="noreferrer" style={{ color: C.text, fontWeight: 700, textDecoration: "none" }}>{l.landing} ↗</a>,
            f: frenteTxt(l.oficio, l.ciudad), v: num(v), le: num(l.leads), c: pctTxt(c, 1), ll: num(l.leads_llamada), w: num(l.leads_whatsapp), e: est,
          };
        })}
        vacio="Sin visitas en el periodo"
      />

      {propias && totDisp > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <div><Titulo>Dispositivo</Titulo><Card>{disp.map((x) => <BarraH key={x.dispositivo} label={x.dispositivo === "movil" ? "Móvil" : x.dispositivo === "ordenador" ? "Ordenador" : "Otro"} valor={n(x.n)} total={totDisp} color={C.mutedL} />)}</Card></div>
          <div><Titulo>De dónde vienen</Titulo><Card>{fuentes.map((x) => <BarraH key={x.fuente} label={FUENTE[x.fuente] || x.fuente} valor={n(x.n)} total={totFu} color={C.mutedL} />)}</Card></div>
        </div>
      )}
    </>
  );
}

// ============================================================
// 5 · TESTS A/B
// ============================================================
function TabTests({ data, pregunta, esAdmin, llamar }: Comun) {
  const tests: J[] = data.tests || [];
  const [cerrar, setCerrar] = useState<J>(null);
  const [concl, setConcl] = useState("");
  const enCurso = tests.filter((t) => t.estado === "en_curso");
  const exps: J[] = data.experimentos || [];
  const hips: J[] = data.hipotesis || [];

  const resumen = (t: J) => {
    const vs = t.variante_c ? ["A", "B", "C"] : ["A", "B"];
    const get = (k: string) => (t.variantes || []).find((v: J) => v.variante === k) || {};
    const A = get("A"), B = get("B"), C3 = t.variante_c ? get("C") : null;
    const r = diferencia(n(A.leads), n(A.visitas), n(B.leads), n(B.visitas));
    const rc = C3 ? diferencia(n(A.leads), n(A.visitas), n(C3.leads), n(C3.visitas)) : null;
    const obj = n(t.objetivo_visitas) || 430;
    const faltan = vs.reduce((acc: number, k: string) => acc + Math.max(0, obj - n(get(k).visitas)), 0);
    const listo = vs.every((k: string) => n(get(k).visitas) >= obj);
    const dias = t.inicio ? Math.max(1, diasEntre(t.inicio, ymdMadrid(Date.now())) + 1) : 1;
    const ritmo = vs.reduce((acc: number, k: string) => acc + n(get(k).visitas), 0) / dias;
    let veredicto = "Faltan datos";
    if (listo && r && !C3) veredicto = r.lo > 0 ? "Gana B" : r.hi < 0 ? "Gana A" : n(B.leads) >= n(A.leads) ? "Sin diferencia clara: quedarse con B (más leads)" : "Sin diferencia clara: quedarse con A (más leads)";
    if (listo && r && rc && C3) {
      const conv = (x: J) => ratio(n(x.leads), n(x.visitas)) || 0;
      const mejor = [["A", A], ["B", B], ["C", C3]].sort((p: J, q: J) => conv(q[1]) - conv(p[1]))[0][0];
      if (r.lo > 0 && rc.lo > 0) veredicto = "Gana " + (conv(B) >= conv(C3) ? "B" : "C");
      else if (r.lo > 0) veredicto = "Gana B";
      else if (rc.lo > 0) veredicto = "Gana C";
      else if (r.hi < 0 && rc.hi < 0) veredicto = "Gana A";
      else veredicto = "Sin diferencia clara: quedarse con " + mejor + " (mejor conversión)";
    }
    return { A, B, C: C3, r, rc, obj, faltan, listo, ritmo, veredicto, diasFaltan: ritmo > 0 ? Math.ceil(faltan / ritmo) : null };
  };

  const principal = enCurso[0];
  let tono: "bien" | "mal" | "regular" | "neutro" = "neutro";
  let texto: React.ReactNode = "No hay ningún test A/B en marcha.";
  let detalle: React.ReactNode = null;
  if (principal) {
    const s = resumen(principal);
    tono = s.listo ? "bien" : "neutro";
    texto = s.listo ? <>«{principal.nombre}»: {s.veredicto}.</> : <>«{principal.nombre}» sigue en marcha: aún no se puede decidir.</>;
    detalle = s.listo ? `Ya hay visitas suficientes en las ${principal.variante_c ? "tres" : "dos"} versiones.` : <>Faltan {num(s.faltan)} visitas entre las {principal.variante_c ? "tres" : "dos"} versiones{s.diasFaltan ? ` (≈ ${s.diasFaltan} días al ritmo actual)` : ""}. Hasta entonces, cualquier diferencia puede ser casualidad.</>;
  }

  return (
    <>
      <Respuesta pregunta={pregunta} tono={tono} texto={texto} detalle={detalle} />
      {tests.map((t) => {
        const s = resumen(t);
        const est = ESTADO_TEST[t.estado] || { t: t.estado, c: C.mutedL };
        const fechas = Array.from(new Set((t.dias || []).map((x: J) => String(x.f)))).sort() as string[];
        const acum = (v: string) => { let vi = 0, le = 0; return fechas.map((f) => { (t.dias || []).filter((x: J) => String(x.f) === f && x.variante === v).forEach((x: J) => { vi += n(x.visitas); le += n(x.leads); }); return vi >= 20 ? le / vi : null; }); };
        return (
          <Card key={t.clave} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{t.nombre} <Pill texto={est.t} color={est.c} /></div>
                <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4 }}>Desde el {fecha(t.inicio)}{t.fin ? " hasta el " + fecha(t.fin) : ""} · {num((t.landings || []).length)} landings · métrica: {t.metrica}</div>
              </div>
              {esAdmin && t.estado === "en_curso" && <Btn small outline onClick={() => { setCerrar(t); setConcl(t.conclusion || ""); }}>Cerrar el test</Btn>}
            </div>
            <div style={{ fontSize: 13, color: C.mutedL, margin: "10px 0 12px", lineHeight: 1.5 }}>Hipótesis: {t.hipotesis}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
              {[{ v: s.A, k: "A", desc: t.variante_a, col: SERIE[0] }, { v: s.B, k: "B", desc: t.variante_b, col: SERIE[1] }, ...(s.C ? [{ v: s.C, k: "C", desc: t.variante_c, col: SERIE[2] }] : [])].map((x) => (
                <div key={x.k} style={{ background: C.bg, borderRadius: 10, padding: 12, border: "1px solid " + C.border }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: x.col }} /><b>Versión {x.k}</b></div>
                  <div style={{ fontSize: 12, color: C.mutedL, margin: "4px 0 10px" }}>{x.desc}</div>
                  <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                    <span><b style={{ fontSize: 18 }}>{num(x.v.visitas)}</b> visitas</span>
                    <span><b style={{ fontSize: 18 }}>{num(x.v.leads)}</b> leads</span>
                    <span><b style={{ fontSize: 18 }}>{pctTxt(ratio(n(x.v.leads), n(x.v.visitas)), 1)}</b> conv.</span>
                  </div>
                  <div style={{ marginTop: 10 }}><BarraH label="Hacia el objetivo de visitas" valor={n(x.v.visitas)} total={s.obj} color={x.col} extra={"objetivo " + num(s.obj)} /></div>
                  {x.k === "B" && n(x.v.leads_form_arriba) > 0 && <div style={{ fontSize: 12, color: C.mutedL }}>{num(x.v.leads_form_arriba)} de sus leads vienen del formulario de arriba</div>}
                </div>
              ))}
            </div>
            {s.r && (
              <div style={{ marginTop: 12, fontSize: 13, color: C.mutedL, lineHeight: 1.55 }}>
                Diferencia B − A: <b style={{ color: C.text }}>{(s.r.d * 100).toFixed(1).replace(".", ",")} puntos</b> (con un 95% de seguridad, entre {(s.r.lo * 100).toFixed(1).replace(".", ",")} y {(s.r.hi * 100).toFixed(1).replace(".", ",")}).
                {" "}<b style={{ color: s.listo ? C.text : C.mutedL }}>{s.listo ? s.veredicto : "Aún no se decide: faltan visitas."}</b>
              </div>
            )}
            {s.rc && (
              <div style={{ marginTop: 6, fontSize: 13, color: C.mutedL, lineHeight: 1.55 }}>
                Diferencia C − A: <b style={{ color: C.text }}>{(s.rc.d * 100).toFixed(1).replace(".", ",")} puntos</b> (con un 95% de seguridad, entre {(s.rc.lo * 100).toFixed(1).replace(".", ",")} y {(s.rc.hi * 100).toFixed(1).replace(".", ",")}).
              </div>
            )}
            {fechas.length > 1 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.mutedL, marginBottom: 8 }}>CONVERSIÓN ACUMULADA (desde 20 visitas)</div>
                <Lineas etiquetas={fechas.map(ddmm)} series={[{ nombre: "Versión A", color: SERIE[0], valores: acum("A") }, { nombre: "Versión B", color: SERIE[1], valores: acum("B") }, ...(s.C ? [{ nombre: "Versión C", color: SERIE[2], valores: acum("C") }] : [])]} formato={(v) => pctTxt(v, 1)} alto={140} />
              </div>
            )}
            {(t.por_ciudad || []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Tabla cols={[{ k: "c", l: "Ciudad" }, { k: "a", l: "A: visitas · leads", align: "right" }, { k: "b", l: "B: visitas · leads", align: "right" }, ...(s.C ? [{ k: "cc", l: "C: visitas · leads", align: "right" as const }] : [])]}
                  filas={Array.from(new Set((t.por_ciudad || []).map((x: J) => x.ciudad))).map((c: J) => {
                    const g = (v: string) => (t.por_ciudad || []).find((x: J) => x.ciudad === c && x.variante === v) || {};
                    return { c: ciTxt(c), a: `${num(g("A").visitas)} · ${num(g("A").leads)}`, b: `${num(g("B").visitas)} · ${num(g("B").leads)}`, cc: `${num(g("C").visitas)} · ${num(g("C").leads)}` };
                  })} />
              </div>
            )}
            {t.conclusion && <div style={{ marginTop: 10, fontSize: 13 }}><b>Conclusión:</b> {t.conclusion}</div>}
          </Card>
        );
      })}

      <Titulo>Experimentos del Equipo IA (marketing)</Titulo>
      <Tabla
        cols={[{ k: "t", l: "Experimento" }, { k: "e", l: "Estado" }, { k: "f", l: "Fechas" }, { k: "m", l: "Qué mide" }, { k: "c", l: "Conclusión" }]}
        filas={exps.map((e) => {
          const est = ESTADO_TEST[e.estado === "en_curso" ? "en_curso_ia" : e.estado] || { t: e.estado, c: C.mutedL };
          return {
            t: <b style={{ whiteSpace: "normal", display: "block", minWidth: 220 }}>{e.titulo}</b>, e: <Pill texto={est.t} color={est.c} />,
            f: (e.inicio ? fecha(e.inicio) : "—") + (e.fin ? " – " + fecha(e.fin) : ""),
            m: <span style={{ whiteSpace: "normal", display: "block", minWidth: 200, fontSize: 12, color: C.mutedL }}>{e.metrica || "—"}</span>,
            c: <span style={{ whiteSpace: "normal", display: "block", minWidth: 220, fontSize: 12, color: C.mutedL }}>{e.conclusion || e.aprendizaje || "—"}</span>,
          };
        })}
        vacio="Sin experimentos"
      />

      <Titulo>Preguntas abiertas</Titulo>
      <Card>
        {hips.length ? hips.map((h, i) => (
          <div key={h.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i ? "1px solid " + C.border + "88" : undefined, alignItems: "flex-start" }}>
            <Pill texto={h.estado === "abierta" ? "Abierta" : cap(h.estado)} color={h.estado === "abierta" ? C.accent : C.green} />
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ color: C.mutedL }}>{h.oficio === "todos" ? "Todos" : ofTxt(h.oficio)} · </span>{h.pregunta}
              {h.respuesta && <div style={{ color: C.mutedL, marginTop: 3 }}>→ {h.respuesta}</div>}
            </div>
          </div>
        )) : <Vacio texto="Sin preguntas" />}
      </Card>

      {cerrar && (
        <Modal titulo={"Cerrar «" + cerrar.nombre + "»"} onClose={() => setCerrar(null)}>
          <div style={{ fontSize: 13, color: C.mutedL, marginBottom: 10 }}>Lo que digan los datos: {resumen(cerrar).veredicto}.</div>
          <label style={etiq}>Conclusión</label>
          <textarea value={concl} onChange={(e) => setConcl(e.target.value)} style={textoArea} placeholder="Qué hemos aprendido y qué versión se queda" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {[["gana_b", "Gana B"], ...(cerrar.variante_c ? [["gana_c", "Gana C"]] : []), ["gana_a", "Gana A"], ["sin_diferencia", "Sin diferencia"], ["pausado", "Pausar"], ["cancelado", "Cancelar"]].map(([k, l]) => (
              <Btn key={k} small outline={k !== "gana_b"} onClick={async () => { if (await llamar("mkt_test_guardar", { p: { clave: cerrar.clave, estado: k, conclusion: concl } }, "Test actualizado")) setCerrar(null); }}>{l}</Btn>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Cerrar el test aquí no cambia la web: el código de la versión ganadora se deja fijo aparte.</div>
        </Modal>
      )}
    </>
  );
}

// ============================================================
// 6 · PLAN Y PROPUESTAS
// ============================================================
function TabPlan({ data, pregunta, esAdmin, llamar }: Comun) {
  const frentes: J[] = data.frentes || [];
  const props: J[] = data.propuestas || [];
  const cambios: J[] = data.cambios || [];
  const hoy = ymdMadrid(Date.now());
  const [filtro, setFiltro] = useState("propuesta");
  const [abiertaId, setAbiertaId] = useState("");
  const [editFrente, setEditFrente] = useState<J>(null);
  const [nueva, setNueva] = useState<J>(null);
  const [cambio, setCambio] = useState<J>(null);
  const [decidir, setDecidir] = useState<J>(null);
  const [nota, setNota] = useState("");

  const pendientes = props.filter((p) => p.estado === "propuesta");
  const toca = frentes.filter((f) => f.revisar_el && f.revisar_el <= hoy);
  const tono: "bien" | "mal" | "regular" | "neutro" = toca.length || pendientes.length ? "regular" : "bien";
  const texto: React.ReactNode = <>{frentes.map((f) => f.nombre + ": " + (FASES[f.fase]?.t || f.fase).toLowerCase()).join(" · ") || "Sin frentes"}.</>;
  const detalle = (
    <>
      {toca.length > 0 && <>Toca revisar: <b style={{ color: C.text }}>{toca.map((f) => f.nombre).join(", ")}</b>. </>}
      {pendientes.length > 0 ? <>{pendientes.length} propuesta{pendientes.length > 1 ? "s" : ""} esperando decisión{esAdmin ? "" : " de Andrés"}.</> : "No hay propuestas pendientes."}
    </>
  );
  const filtradas = props.filter((p) => filtro === "todas" || p.estado === filtro);
  const dineroDe = (f: J) => (data.dinero || []).find((r: J) => r.oficio === f.oficio && r.ciudad === f.ciudad);

  return (
    <>
      <Respuesta pregunta={pregunta} tono={tono} texto={texto} detalle={detalle} />

      <Titulo>Fase de cada oficio y ciudad</Titulo>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 12 }}>
        {frentes.map((f) => {
          const fase = FASES[f.fase] || FASES.aprendizaje;
          const r = dineroDe(f);
          const revisar = f.revisar_el && f.revisar_el <= hoy;
          return (
            <Card key={f.id} accent={fase.c + "66"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <b style={{ fontSize: 16 }}>{f.nombre}</b>
                {esAdmin && <Btn small outline onClick={() => setEditFrente({ ...f })}>Editar</Btn>}
              </div>
              <div style={{ display: "flex", gap: 3, margin: "12px 0 8px" }}>
                {ORDEN_FASES.map((k) => (
                  <div key={k} title={FASES[k].d} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ height: 6, borderRadius: 3, background: k === f.fase ? fase.c : ORDEN_FASES.indexOf(k) < ORDEN_FASES.indexOf(f.fase) ? fase.c + "55" : C.bg }} />
                    <div style={{ fontSize: 10.5, marginTop: 4, color: k === f.fase ? C.text : C.muted, fontWeight: k === f.fase ? 800 : 600 }}>{FASES[k].t}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: C.mutedL, lineHeight: 1.6 }}>
                <div><b style={{ color: C.text }}>{fase.t}</b> desde el {fecha(f.fase_desde)} ({diasEntre(f.fase_desde, hoy)} días). {fase.d}</div>
                {f.objetivo && <div>🎯 {f.objetivo}</div>}
                {f.siguiente_hito && <div>→ {f.siguiente_hito}</div>}
                {f.revisar_el && <div style={{ color: revisar ? C.orange : C.mutedL, fontWeight: revisar ? 800 : 600 }}>{revisar ? "! Toca revisar (" + fecha(f.revisar_el) + ")" : "Revisar el " + fecha(f.revisar_el)}</div>}
                {f.nota && <div style={{ marginTop: 4 }}>{f.nota}</div>}
                {r && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid " + C.border, color: C.text }}>En el periodo: {eur(r.gasto)} de gasto · {num(r.leads)} solicitudes · ROAS {xTxt(ratio(n(r.ingresos), n(r.gasto)))}</div>}
                <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Actualizado por {f.updated_by || "—"} {f.updated_at ? "hace " + hace(f.updated_at) : ""}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <Titulo accion={<Btn small onClick={() => setNueva({ titulo: "", detalle: "", area: "campanas", frente: "", impacto: "" })}>+ Nueva propuesta</Btn>}>Propuestas del equipo</Titulo>
      <div style={{ marginBottom: 10 }}>
        <Chips valor={filtro} onChange={setFiltro} opciones={[
          { v: "propuesta", l: `Pendientes (${pendientes.length})` }, { v: "aprobada", l: "Aprobadas" }, { v: "en_marcha", l: "En marcha" },
          { v: "hecha", l: "Hechas" }, { v: "descartada", l: "Descartadas" }, { v: "todas", l: "Todas" }]} />
      </div>
      <Card>
        {filtradas.length ? filtradas.map((p, i) => {
          const est = ESTADO_PROP[p.estado] || { t: p.estado, c: C.mutedL };
          const id = p.origen + ":" + p.id;
          const abierta = abiertaId === id;
          return (
            <div key={id} style={{ padding: "10px 0", borderTop: i ? "1px solid " + C.border + "88" : undefined }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1, cursor: "pointer" }} onClick={() => setAbiertaId(abierta ? "" : id)}>
                  <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.4 }}>{p.titulo}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5, alignItems: "center" }}>
                    <Pill texto={est.t} color={est.c} />
                    <Pill texto={p.origen === "ia" ? "Equipo IA" : p.autor} color={p.origen === "ia" ? C.purple : C.blue} />
                    {p.area && p.area !== "otro" && <Pill texto={AREAS[p.area] || p.area} color={C.mutedL} />}
                    {p.frente && <Pill texto={frenteTxt(p.frente.split("|")[0], p.frente.split("|")[1])} color={C.mutedL} />}
                    <span style={{ fontSize: 11.5, color: C.muted }}>{fecha(p.created_at)}{p.impacto ? " · " + p.impacto : ""}</span>
                  </div>
                </div>
                {esAdmin && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {p.estado === "propuesta" && <Btn small onClick={() => { setDecidir({ p, estado: "aprobada" }); setNota(""); }}>Aprobar</Btn>}
                    {p.estado === "aprobada" && p.origen === "oficina" && <Btn small outline onClick={() => { setDecidir({ p, estado: "en_marcha" }); setNota(""); }}>En marcha</Btn>}
                    {(p.estado === "aprobada" || p.estado === "en_marcha") && <Btn small outline color={C.green} onClick={() => { setDecidir({ p, estado: "hecha" }); setNota(""); }}>Hecha</Btn>}
                    {p.estado !== "descartada" && p.estado !== "hecha" && <Btn small outline color={C.red} onClick={() => { setDecidir({ p, estado: "descartada" }); setNota(""); }}>Descartar</Btn>}
                    {(p.estado === "descartada" || p.estado === "hecha") && <Btn small outline onClick={() => llamar("mkt_propuesta_decidir", { p_origen: p.origen, p_id: p.id, p_estado: "propuesta", p_nota: null }, "Vuelve a pendientes")}>Reabrir</Btn>}
                  </div>
                )}
              </div>
              {abierta && (
                <div style={{ fontSize: 13, color: C.mutedL, marginTop: 8, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {p.detalle || "Sin detalle."}
                  {p.nota_decision && <div style={{ marginTop: 6, color: C.text }}><b>Decisión:</b> {p.nota_decision}{p.decided_by ? " (" + p.decided_by + ")" : ""}</div>}
                </div>
              )}
            </div>
          );
        }) : <Vacio texto="Nada en esta lista" />}
      </Card>

      <Titulo accion={<Btn small outline onClick={() => setCambio({ fecha: hoy, ambito: "campana", oficio: "pintura", que: "", por_que: "" })}>+ Apuntar un cambio</Btn>}>Registro de cambios</Titulo>
      <Card>
        {cambios.length ? cambios.map((c, i) => (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 10, padding: "9px 0", borderTop: i ? "1px solid " + C.border + "88" : undefined }}>
            <div style={{ fontSize: 12, color: C.mutedL, fontWeight: 800 }}>{fecha(c.fecha)}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                <Pill texto={cap(c.ambito || "otro")} color={C.mutedL} />
                {c.oficio && <Pill texto={c.oficio === "todos" ? "Todos" : ofTxt(c.oficio)} color={C.mutedL} />}
                {c.veredicto && <Pill texto={cap(c.veredicto)} color={/mejor/i.test(c.veredicto) ? C.green : /peor/i.test(c.veredicto) ? C.red : C.orange} />}
                <span style={{ fontSize: 11.5, color: C.muted }}>{c.quien}</span>
              </div>
              <div style={{ color: C.text }}>{c.que}</div>
              {c.por_que && <div style={{ color: C.mutedL }}>Por qué: {c.por_que}</div>}
              {c.lectura && <div style={{ color: C.mutedL }}>Lectura: {c.lectura}</div>}
            </div>
          </div>
        )) : <Vacio texto="Sin cambios apuntados" />}
      </Card>

      {/* ---------- modales ---------- */}
      {editFrente && (
        <Modal titulo={"Fase de " + editFrente.nombre} onClose={() => setEditFrente(null)}>
          <label style={etiq}>Fase</label>
          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            {Object.entries(FASES).map(([k, f]) => (
              <button key={k} onClick={() => setEditFrente({ ...editFrente, fase: k })} style={{ textAlign: "left", fontFamily: F, cursor: "pointer", padding: "9px 11px", borderRadius: 8, border: "1px solid " + (editFrente.fase === k ? f.c : C.border), background: editFrente.fase === k ? f.c + "1F" : "transparent", color: C.text }}>
                <b>{f.t}</b> <span style={{ color: C.mutedL, fontSize: 12.5 }}>· {f.d}</span>
              </button>
            ))}
          </div>
          <Campo label="Objetivo" value={editFrente.objetivo || ""} onChange={(v: string) => setEditFrente({ ...editFrente, objetivo: v })} />
          <Campo label="Siguiente paso" value={editFrente.siguiente_hito || ""} onChange={(v: string) => setEditFrente({ ...editFrente, siguiente_hito: v })} />
          <Campo label="Revisar el" type="date" value={editFrente.revisar_el || ""} onChange={(v: string) => setEditFrente({ ...editFrente, revisar_el: v })} />
          <label style={etiq}>Nota (si cambias de fase, queda en el registro)</label>
          <textarea value={editFrente.nota || ""} onChange={(e) => setEditFrente({ ...editFrente, nota: e.target.value })} style={textoArea} />
          <div style={{ marginTop: 12 }}>
            <Btn onClick={async () => {
              const ok = await llamar("mkt_frente_guardar", { p: { id: editFrente.id, fase: editFrente.fase, objetivo: editFrente.objetivo || "", siguiente_hito: editFrente.siguiente_hito || "", revisar_el: editFrente.revisar_el || "", nota: editFrente.nota || "" } }, "Fase guardada");
              if (ok) setEditFrente(null);
            }}>Guardar</Btn>
          </div>
        </Modal>
      )}

      {nueva && (
        <Modal titulo="Nueva propuesta" onClose={() => setNueva(null)}>
          <Campo label="¿Qué propones?" value={nueva.titulo} onChange={(v: string) => setNueva({ ...nueva, titulo: v })} placeholder="Ej. Probar un anuncio con precio por m² en pintura Sevilla" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ marginBottom: 12 }}><label style={etiq}>Tema</label>
              <Sel value={nueva.area} onChange={(v) => setNueva({ ...nueva, area: v })} style={{ width: "100%" }} options={Object.entries(AREAS).map(([v, l]) => ({ v, l }))} /></div>
            <div style={{ marginBottom: 12 }}><label style={etiq}>Oficio y ciudad</label>
              <Sel value={nueva.frente} onChange={(v) => setNueva({ ...nueva, frente: v })} style={{ width: "100%" }} options={[{ v: "", l: "General" }, ...frentes.map((f) => ({ v: f.id, l: f.nombre }))]} /></div>
          </div>
          <label style={etiq}>Por qué y cómo (qué dato lo justifica)</label>
          <textarea value={nueva.detalle} onChange={(e) => setNueva({ ...nueva, detalle: e.target.value })} style={textoArea} />
          <Campo label="Qué esperas conseguir (opcional)" value={nueva.impacto} onChange={(v: string) => setNueva({ ...nueva, impacto: v })} placeholder="Ej. +3 leads a la semana" />
          <Btn onClick={async () => { if (await llamar("mkt_propuesta_crear", { p: nueva }, "Propuesta enviada")) setNueva(null); }}>Enviar propuesta</Btn>
        </Modal>
      )}

      {cambio && (
        <Modal titulo="Apuntar un cambio" onClose={() => setCambio(null)}>
          <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 10 }}>Apunta cualquier cambio en campañas o en la web: así sabremos qué movió los números.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Campo label="Fecha" type="date" value={cambio.fecha} onChange={(v: string) => setCambio({ ...cambio, fecha: v })} />
            <div style={{ marginBottom: 12 }}><label style={etiq}>Dónde</label>
              <Sel value={cambio.ambito} onChange={(v) => setCambio({ ...cambio, ambito: v })} style={{ width: "100%" }} options={[
                { v: "campana", l: "Campaña" }, { v: "puja", l: "Puja" }, { v: "presupuesto", l: "Presupuesto" }, { v: "anuncio", l: "Anuncio" },
                { v: "palabras clave", l: "Palabras clave" }, { v: "landing", l: "Landing" }, { v: "test", l: "Test A/B" }, { v: "otro", l: "Otro" }]} /></div>
            <div style={{ marginBottom: 12 }}><label style={etiq}>Oficio</label>
              <Sel value={cambio.oficio} onChange={(v) => setCambio({ ...cambio, oficio: v })} style={{ width: "100%" }} options={[{ v: "pintura", l: "Pintura" }, { v: "fontaneria", l: "Fontanería" }, { v: "todos", l: "Todos" }]} /></div>
          </div>
          <Campo label="Qué se ha cambiado" value={cambio.que} onChange={(v: string) => setCambio({ ...cambio, que: v })} placeholder="Ej. Presupuesto de pintura Valencia de 35 a 40 €/día" />
          <label style={etiq}>Por qué</label>
          <textarea value={cambio.por_que} onChange={(e) => setCambio({ ...cambio, por_que: e.target.value })} style={textoArea} />
          <div style={{ marginTop: 12 }}><Btn onClick={async () => { if (await llamar("mkt_cambio_registrar", { p: cambio }, "Cambio apuntado")) setCambio(null); }}>Guardar</Btn></div>
        </Modal>
      )}

      {decidir && (
        <Modal titulo={(ESTADO_PROP[decidir.estado]?.t || decidir.estado) + ": " + decidir.p.titulo} onClose={() => setDecidir(null)}>
          <label style={etiq}>Nota para el equipo (opcional)</label>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} style={textoArea} placeholder="Ej. Adelante, pero solo en Sevilla" />
          <div style={{ marginTop: 12 }}>
            <Btn onClick={async () => { if (await llamar("mkt_propuesta_decidir", { p_origen: decidir.p.origen, p_id: decidir.p.id, p_estado: decidir.estado, p_nota: nota || null }, "Guardado")) setDecidir(null); }}>Confirmar</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
