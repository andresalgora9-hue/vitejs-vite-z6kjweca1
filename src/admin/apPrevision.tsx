// ============================================================
// OficioYa · ADMIN — PREVISIÓN: próximos meses, probabilidades y mapa de oportunidades
// Datos: RPC mkt_prevision (tus campañas + CRM + Planificador de Google por ciudad)
// Modelo: simulación Monte Carlo. Ciudades nuevas parten de los ratios de Sevilla y aprenden con sus propios datos.
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { db } from "../supabase";
import { C, F, Card, Pill, Grid, Titulo, Tabla, eur, num, useAncho } from "./apUi";

type J = any;
const OFICIOS = ["Fontanero", "Pintor"] as const;
type Of = typeof OFICIOS[number];
const NOMBRE_OF: Record<Of, string> = { Fontanero: "Fontanería", Pintor: "Pintura" };
const ESCENARIO = 15; // €/día por oficio para simular ciudades sin campaña
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const N_SIM = 1500;

// ---------- aleatoriedad reproducible ----------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function normal(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function gamma(r: () => number, k: number): number {
  if (k < 1) return gamma(r, k + 1) * Math.pow(r(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x = normal(r), v = 1 + c * x; if (v <= 0) continue; v = v * v * v; const u = r(); if (u < 1 - 0.0331 * x * x * x * x) return d * v; if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
}
function beta(r: () => number, a: number, b: number) { const x = gamma(r, Math.max(a, 0.01)), y = gamma(r, Math.max(b, 0.01)); return x / (x + y); }
function poisson(r: () => number, l: number) {
  if (l <= 0) return 0;
  if (l > 40) return Math.max(0, Math.round(l + Math.sqrt(l) * normal(r)));
  const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1;
}
const pct = (arr: number[], q: number) => { if (!arr.length) return 0; const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]; };

// ---------- meses a prever ----------
function proximosMeses(n = 3) {
  const out: { clave: string; mes: number; dias: number; nombre: string }[] = [];
  const hoy = new Date();
  for (let k = 1; k <= n; k++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + k, 1);
    const dias = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    out.push({ clave: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), mes: d.getMonth() + 1, dias, nombre: MESES_L[d.getMonth()] });
  }
  return out;
}

// ---------- modelo por ciudad y oficio ----------
interface Modelo {
  cpc: number; sigma: number; a: number; b: number; anA: number; anB: number; precio: number;
  potencial: number | null; temporada: (mes: number) => number;
  clicsPropios: number; leadsPropios: number; esBase: boolean; ratioCpc: number | null; tieneDemanda: boolean;
}
function temporadaDe(serie: J[] | null | undefined, media: number | null | undefined) {
  const m: Record<number, number> = {};
  (serie || []).forEach((x: J) => { const mm = Number(String(x.m).slice(5, 7)); if (x.b != null) m[mm] = Number(x.b); });
  const base = Number(media) || (Object.values(m).reduce((s, v) => s + v, 0) / Math.max(1, Object.values(m).length));
  return (mes: number) => (m[mes] && base > 0 ? Math.min(2.5, Math.max(0.3, m[mes] / base)) : 1);
}
function construir(c: J, of: Of, base: J, d: J): Modelo {
  const o = c.oficios?.[of] || {};
  const bo = base.oficios?.[of] || {};
  const bp = bo.propio || {};
  const esBase = c.slug === base.slug;
  const bClics30 = Number(bp.clics30) || 0, bClics = Number(bp.clics) || 0;
  // Base real: desde que se cobra por lead, todos los leads vendidos (formulario, llamada y WhatsApp) por clic de Google.
  // Si aún no hay venta suficiente, últimos 30 días (o 60) con los formularios de Google.
  const bv = bp.venta;
  const usaVenta = !!bv && Number(bv.clics) >= 60 && Number(bv.vendidos) > 0;
  const b30 = bClics30 >= 100;
  const bN = usaVenta ? Number(bv.clics) : b30 ? bClics30 : bClics;
  const bCoste = usaVenta ? Number(bv.coste) || 0 : b30 ? Number(bp.coste30) || 0 : Number(bp.coste) || 0;
  const bLeads = usaVenta ? Number(bv.vendidos) || 0 : b30 ? Number(bp.leads30) || 0 : Number(bp.leads) || 0;
  const bCpc = bN > 0 ? bCoste / bN : 1.5;
  const bCvr = bN > 0 ? Math.max(0.01, bLeads / bN) : 0.06;
  const bCuota = Math.max(0.1, Number(bp.cuota) || 0.4);
  const bPot = bClics30 > 0 ? bClics30 / bCuota : null;
  const mid = (x: J) => (x && x.cpc_bajo != null && x.cpc_alto != null ? (Number(x.cpc_bajo) + Number(x.cpc_alto)) / 2 : null);
  const midB = mid(bo.demanda), midC = mid(o.demanda);
  const ratio = esBase ? 1 : midB && midC ? Math.min(4, Math.max(0.4, midC / midB)) : null;
  const p = o.propio || {};
  const pv = p.venta;
  const usaPV = !esBase && !!pv && Number(pv.clics) > 0;
  const n = esBase ? bN : usaPV ? Number(pv.clics) : Number(p.clics) || 0;
  const leads = esBase ? bLeads : usaPV ? Number(pv.vendidos) || 0 : Number(p.leads) || 0;
  const coste = esBase ? bCoste : usaPV ? Number(pv.coste) || 0 : Number(p.coste) || 0;
  const cpcPrior = bCpc * (ratio ?? 1.3);
  const cpc = esBase ? bCpc : (cpcPrior * 60 + coste) / (60 + n);
  const sigma = 0.12 + (esBase ? 0.1 : 0.35 / Math.sqrt(1 + n / 40));
  // Ciudad nueva: parte de la conversión real de Sevilla (comprobado: la rebaja del 20% inflaba el coste por lead un 25%)
  const m = 80, cvrPrior = bCvr;
  const a = esBase ? leads + 1 : cvrPrior * m + leads;
  const b = esBase ? Math.max(1, n - leads + 1) : (1 - cvrPrior) * m + Math.max(0, n - leads);
  const an = d.anulacion?.[of] || { total: 0, anulados: 0 };
  const mediaC = Number(o.demanda?.media) || 0, mediaB = Number(bo.demanda?.media) || 0;
  const potencial = bPot == null ? null : esBase ? bPot : mediaB > 0 && mediaC > 0 ? bPot * (mediaC / mediaB) : null;
  return {
    cpc, sigma, a, b, anA: Number(an.anulados) + 1, anB: Number(an.total) - Number(an.anulados) + 1, precio: Number(c.precios?.[of]) || Number(d.precios?.[of]) || 0,
    potencial, temporada: temporadaDe(o.demanda?.serie, o.demanda?.media),
    clicsPropios: n, leadsPropios: leads, esBase, ratioCpc: ratio, tieneDemanda: !!o.demanda,
  };
}
interface Sim { leads: number[]; gasto: number[]; ingresos: number[]; benef: number[]; cpl: number[] }
function simular(md: Modelo, presupuesto: number, mes: { mes: number; dias: number }, seed: number): Sim {
  const r = rng(seed);
  const out: Sim = { leads: [], gasto: [], ingresos: [], benef: [], cpl: [] };
  const cap = md.potencial == null ? Infinity : md.potencial * (mes.dias / 30) * md.temporada(mes.mes);
  for (let i = 0; i < N_SIM; i++) {
    const cpc = md.cpc * Math.exp(md.sigma * normal(r) - (md.sigma * md.sigma) / 2);
    const clics = Math.min((presupuesto * mes.dias) / cpc, cap * (0.85 + 0.3 * r()));
    const cvr = beta(r, md.a, md.b);
    const leads = poisson(r, clics * cvr);
    const gasto = clics * cpc;
    const anul = beta(r, md.anA, md.anB);
    const ingresos = leads * (1 - anul) * md.precio;
    out.leads.push(leads); out.gasto.push(gasto); out.ingresos.push(ingresos); out.benef.push(ingresos - gasto);
    if (leads > 0) out.cpl.push(gasto / leads);
  }
  return out;
}
function resumen(s: Sim, md?: Modelo) {
  const umbral = md ? md.precio * (md.anB / (md.anA + md.anB)) : null;
  return {
    l10: pct(s.leads, 0.1), l50: pct(s.leads, 0.5), l90: pct(s.leads, 0.9),
    gasto: pct(s.gasto, 0.5), ingresos: pct(s.ingresos, 0.5),
    b10: pct(s.benef, 0.1), b50: pct(s.benef, 0.5), b90: pct(s.benef, 0.9),
    cpl: s.cpl.length ? pct(s.cpl, 0.5) : null,
    pBenef: s.benef.filter((x) => x > 0).length / Math.max(1, s.benef.length),
    pCpl: umbral != null && s.cpl.length ? s.cpl.filter((x) => x <= umbral).length / s.cpl.length : null,
    umbral,
  };
}
function sumar(sims: Sim[]): Sim {
  const out: Sim = { leads: [], gasto: [], ingresos: [], benef: [], cpl: [] };
  for (let i = 0; i < N_SIM; i++) {
    let l = 0, g = 0, ing = 0, b = 0;
    sims.forEach((s) => { l += s.leads[i] || 0; g += s.gasto[i] || 0; ing += s.ingresos[i] || 0; b += s.benef[i] || 0; });
    out.leads.push(l); out.gasto.push(g); out.ingresos.push(ing); out.benef.push(b); if (l > 0) out.cpl.push(g / l);
  }
  return out;
}
const semilla = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------- piezas visuales ----------
// Encuadra la península en cuanto el mapa tiene su tamaño real (y cada vez que cambia), salvo que lo hayas movido tú
function AjustarMapa({ puntos }: { puntos: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const pen = puntos.filter(([la, ln]) => la > 35.5 && ln > -10);
    let movidoAMano = false;
    const marcar = () => { movidoAMano = true; };
    const encuadrar = () => {
      map.invalidateSize({ pan: false });
      const t = map.getSize();
      if (t.x < 80 || t.y < 80) return;
      if (!movidoAMano && pen.length > 1) map.fitBounds(pen, { padding: [18, 18], maxZoom: 7, animate: false });
    };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => encuadrar()) : null;
    ro?.observe(map.getContainer());
    const t1 = setTimeout(encuadrar, 150), t2 = setTimeout(encuadrar, 900);
    map.on("dragstart", marcar);
    window.addEventListener("resize", encuadrar);
    return () => { ro?.disconnect(); clearTimeout(t1); clearTimeout(t2); map.off("dragstart", marcar); window.removeEventListener("resize", encuadrar); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}
const colorP = (p: number) => (p >= 0.7 ? C.green : p >= 0.45 ? C.orange : C.red);
function BarraProb({ label, p, ayuda }: { label: string; p: number | null; ayuda?: string }) {
  if (p === null) return null;
  return (
    <div style={{ marginBottom: 9 }} title={ayuda}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
        <span style={{ color: C.text, fontWeight: 700 }}>{label}</span>
        <b style={{ color: colorP(p) }}>{Math.round(p * 100)}%</b>
      </div>
      <div style={{ height: 8, background: C.bg, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: p * 100 + "%", height: "100%", background: colorP(p), borderRadius: 99 }} />
      </div>
    </div>
  );
}
function Rango({ bajo, medio, alto, max, color, fmt = (v: number) => num(v) }: { bajo: number; medio: number; alto: number; max: number; color: string; fmt?: (v: number) => string }) {
  const p = (v: number) => (max > 0 ? Math.min(100, Math.max(0, (v / max) * 100)) : 0);
  return (
    <div>
      <div style={{ position: "relative", height: 14, background: C.bg, borderRadius: 7 }}>
        <div style={{ position: "absolute", left: p(bajo) + "%", width: Math.max(1, p(alto) - p(bajo)) + "%", top: 2, bottom: 2, background: color + "55", borderRadius: 5 }} />
        <div style={{ position: "absolute", left: "calc(" + p(medio) + "% - 2px)", width: 4, top: 0, bottom: 0, background: color, borderRadius: 2 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginTop: 3 }}>
        <span>{fmt(bajo)}</span><b style={{ color: C.text }}>{fmt(medio)}</b><span>{fmt(alto)}</span>
      </div>
    </div>
  );
}
function Confianza({ clics }: { clics: number }) {
  const v = Math.min(1, clics / 150);
  const c = v >= 0.8 ? C.green : v >= 0.3 ? C.orange : C.red;
  return (
    <div title="Cuántos datos propios tiene la previsión. Con 150 clics propios ya no depende de Sevilla.">
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.mutedL, marginBottom: 3 }}>
        <span>Confianza</span><b style={{ color: c }}>{v >= 0.8 ? "Alta" : v >= 0.3 ? "Media" : "Baja"}</b>
      </div>
      <div style={{ height: 6, background: C.bg, borderRadius: 99, overflow: "hidden" }}><div style={{ width: Math.max(4, v * 100) + "%", height: "100%", background: c }} /></div>
    </div>
  );
}
function BarrasDemanda({ ciudad }: { ciudad: J }) {
  const series = OFICIOS.map((of) => {
    const m: Record<number, number> = {};
    (ciudad.oficios?.[of]?.demanda?.serie || []).forEach((x: J) => { m[Number(String(x.m).slice(5, 7))] = Number(x.b) || 0; });
    return m;
  });
  const max = Math.max(1, ...series.flatMap((m) => Object.values(m)));
  const prox = proximosMeses(3).map((x) => x.mes);
  const W = 720, H = 150, pb = 22, cw = W / 12;
  const cols = [C.blue, C.accent];
  return (
    <div>
      <div style={{ display: "flex", gap: 14, fontSize: 12, color: C.mutedL, marginBottom: 6 }}>
        {OFICIOS.map((of, i) => <span key={of} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: cols[i] }} />{NOMBRE_OF[of]}</span>)}
        <span style={{ marginLeft: "auto", color: C.muted }}>Búsquedas al mes en Google (último año)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {Array.from({ length: 12 }, (_, k) => {
          const mes = k + 1;
          const x0 = cw * k;
          return (
            <g key={k}>
              {prox.includes(mes) && <rect x={x0 + 2} y={0} width={cw - 4} height={H - pb + 2} fill={C.accent} opacity={0.07} rx={4} />}
              {series.map((m, i) => {
                const v = m[mes] || 0; const h = ((H - pb - 8) * v) / max;
                return <rect key={i} x={x0 + cw * 0.18 + i * cw * 0.33} y={H - pb - h} width={cw * 0.3} height={h} fill={cols[i]} rx={2}><title>{NOMBRE_OF[OFICIOS[i]]} · {MESES[k]}: {num(v)} búsquedas</title></rect>;
              })}
              <text x={x0 + cw / 2} y={H - 6} fill={prox.includes(mes) ? C.accent : C.muted} fontSize="11" textAnchor="middle" fontWeight={prox.includes(mes) ? 800 : 400}>{MESES[k]}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Resaltados en amarillo: los próximos 3 meses.</div>
    </div>
  );
}
function Calendario({ d }: { d: J }) {
  const filas = OFICIOS.map((of) => {
    const tot: Record<number, number> = {};
    (d.ciudades || []).forEach((c: J) => (c.oficios?.[of]?.demanda?.serie || []).forEach((x: J) => { const mm = Number(String(x.m).slice(5, 7)); tot[mm] = (tot[mm] || 0) + (Number(x.b) || 0); }));
    const vals = Object.values(tot); const media = vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
    return { of, idx: (mes: number) => (media > 0 && tot[mes] ? tot[mes] / media : 1) };
  });
  const prox = proximosMeses(3).map((x) => x.mes);
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "90px repeat(12, minmax(38px, 1fr))", gap: 4, minWidth: 560 }}>
        <div />
        {MESES.map((m, k) => <div key={m} style={{ fontSize: 11, textAlign: "center", color: prox.includes(k + 1) ? C.accent : C.muted, fontWeight: prox.includes(k + 1) ? 800 : 600 }}>{m}</div>)}
        {filas.map((f) => (
          <React.Fragment key={f.of}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text, display: "flex", alignItems: "center" }}>{NOMBRE_OF[f.of]}</div>
            {MESES.map((_, k) => {
              const v = f.idx(k + 1); const dlt = Math.round((v - 1) * 100);
              const col = v >= 1.08 ? C.green : v <= 0.92 ? C.red : C.mutedL;
              return (
                <div key={k} title={`${NOMBRE_OF[f.of]} en ${MESES_L[k]}: ${dlt >= 0 ? "+" : ""}${dlt}% sobre la media del año`}
                  style={{ height: 34, borderRadius: 6, background: col + (Math.abs(v - 1) > 0.25 ? "55" : Math.abs(v - 1) > 0.08 ? "33" : "14"), border: prox.includes(k + 1) ? "1.5px solid " + C.accent : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: col }}>
                  {dlt === 0 ? "=" : (dlt > 0 ? "+" : "") + dlt + "%"}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Demanda de cada mes frente a la media del año, sumando las 58 ciudades. Verde: más búsquedas de lo normal; rojo: menos.</div>
    </div>
  );
}

// ---------- pantalla ----------
export default function Prevision({ clave }: { clave: string }) {
  const movil = useAncho() < 900;
  const [d, setD] = useState<J | null>(null);
  const [error, setError] = useState("");
  const [ciudad, setCiudad] = useState<string>("");
  const [presu, setPresu] = useState<Record<string, number>>({});
  const meses = useMemo(() => proximosMeses(3), []);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await db.rpc("mkt_prevision", { p_clave: clave });
      if (e) { setError(/acceso denegado/i.test(e.message) ? "Clave no válida." : "Error al cargar: " + e.message); return; }
      setD(data);
    })();
  }, [clave]);

  const base = useMemo(() => (d?.ciudades || []).find((c: J) => c.slug === "sevilla"), [d]);

  // Modelos de todas las ciudades y oficios
  const modelos = useMemo(() => {
    const m: Record<string, Modelo> = {};
    if (!d || !base) return m;
    (d.ciudades || []).forEach((c: J) => OFICIOS.forEach((of) => { m[c.slug + "|" + of] = construir(c, of, base, d); }));
    return m;
  }, [d, base]);

  const presupuestoDe = (c: J, of: Of) => {
    const k = c.slug + "|" + of;
    if (presu[k] !== undefined) return presu[k];
    const p = Number(c.oficios?.[of]?.presupuesto) || 0;
    return p > 0 ? p : 0;
  };
  const activas = useMemo(() => (d?.ciudades || []).flatMap((c: J) => OFICIOS.filter((of) => Number(c.oficios?.[of]?.presupuesto) > 0).map((of) => ({ c, of }))), [d]);

  // Previsión general (ciudades con campaña activa), 3 meses
  const general = useMemo(() => {
    if (!d || !base) return null;
    return meses.map((mes) => {
      const sims = activas.map(({ c, of }: { c: J; of: Of }) => simular(modelos[c.slug + "|" + of], presupuestoDe(c, of), mes, semilla(c.slug + of + mes.clave)));
      return { mes, total: resumen(sumar(sims)), filas: activas.map(({ c, of }: { c: J; of: Of }, i: number) => ({ c, of, r: resumen(sims[i], modelos[c.slug + "|" + of]) })) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, base, modelos, activas, presu, meses]);

  // Oportunidades: ciudades/oficios sin campaña, simulados a ESCENARIO €/día el mes que viene
  const oportunidades = useMemo(() => {
    if (!d || !base) return [] as J[];
    const mes = meses[0];
    const out: J[] = [];
    (d.ciudades || []).forEach((c: J) => OFICIOS.forEach((of) => {
      if (Number(c.oficios?.[of]?.presupuesto) > 0) return;
      const md = modelos[c.slug + "|" + of];
      if (!md || !md.tieneDemanda) return;
      const r = resumen(simular(md, ESCENARIO, mes, semilla("op" + c.slug + of)), md);
      out.push({ c, of, r, md });
    }));
    return out.sort((x, y) => y.r.b50 - x.r.b50);
  }, [d, base, modelos, meses]);

  const mejorPorCiudad = useMemo(() => {
    const m: Record<string, J> = {};
    oportunidades.forEach((o: J) => { if (!m[o.c.slug] || o.r.b50 > m[o.c.slug].r.b50) m[o.c.slug] = o; });
    return m;
  }, [oportunidades]);

  if (error) return <Card accent={C.red}><span style={{ color: C.red }}>{error}</span></Card>;
  if (!d || !base) return <div style={{ color: C.mutedL, padding: 30 }}>Calculando previsiones…</div>;

  const sel = ciudad ? (d.ciudades || []).find((c: J) => c.slug === ciudad) : null;
  const g0 = general?.[0];

  const estado = (c: J) => {
    const conCamp = OFICIOS.some((of) => Number(c.oficios?.[of]?.presupuesto) > 0);
    const pros = (c.pros?.Fontanero || 0) + (c.pros?.Pintor || 0);
    if (conCamp) return { t: "Anunciándose", col: C.accent };
    if (pros > 0) return { t: "Pros firmados", col: C.green };
    if ((c.interesados?.total || 0) > 0) return { t: "Captando pros", col: C.blue };
    return { t: "Sin actividad", col: C.muted };
  };

  // ---------- selector ----------
  const selector = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
      <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={{ background: C.surface, color: C.text, border: "1px solid " + C.border, borderRadius: 8, padding: "8px 10px", fontFamily: F, fontSize: 13.5, fontWeight: 700, minWidth: 220 }}>
        <option value="">Vista general (toda España)</option>
        <optgroup label="Con campaña activa">
          {(d.ciudades || []).filter((c: J) => OFICIOS.some((of) => Number(c.oficios?.[of]?.presupuesto) > 0)).map((c: J) => <option key={c.slug} value={c.slug}>{c.ciudad}</option>)}
        </optgroup>
        <optgroup label="Resto de ciudades">
          {(d.ciudades || []).filter((c: J) => !OFICIOS.some((of) => Number(c.oficios?.[of]?.presupuesto) > 0)).map((c: J) => <option key={c.slug} value={c.slug}>{c.ciudad}</option>)}
        </optgroup>
      </select>
      {ciudad && <button onClick={() => setCiudad("")} style={{ fontFamily: F, fontSize: 12.5, fontWeight: 800, padding: "8px 11px", borderRadius: 8, cursor: "pointer", border: "1px solid " + C.border, background: "transparent", color: C.mutedL }}>← Volver a la vista general</button>}
      <span style={{ fontSize: 12, color: C.muted, marginLeft: "auto" }}>Previsión para {meses.map((m) => m.nombre).join(", ")}</span>
    </div>
  );

  // ---------- mapa ----------
  const mapa = (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ height: movil ? 380 : 480, width: "100%", position: "relative", zIndex: 0, isolation: "isolate" }}>
        <MapContainer center={[40.2, -3.7]} zoom={movil ? 5 : 6} minZoom={4} style={{ height: "100%", width: "100%", background: "#1b1e27" }} scrollWheelZoom={false} zoomControl={true}>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" maxZoom={16} />
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
          <AjustarMapa puntos={(d.ciudades || []).filter((c: J) => c.lat && c.lng).map((c: J) => [Number(c.lat), Number(c.lng)] as [number, number])} />
          {(d.ciudades || []).filter((c: J) => c.lat && c.lng).map((c: J) => {
            const dem = OFICIOS.reduce((s, of) => s + (Number(c.oficios?.[of]?.demanda?.media) || 0), 0);
            const best = mejorPorCiudad[c.slug];
            const activa = OFICIOS.some((of) => Number(c.oficios?.[of]?.presupuesto) > 0);
            const col = activa ? C.accent : best ? colorP(best.r.pBenef) : C.muted;
            return (
              <CircleMarker key={c.slug} center={[Number(c.lat), Number(c.lng)]} radius={Math.max(5, Math.min(26, Math.sqrt(dem) / 3))}
                pathOptions={{ color: activa ? "#ffffff" : col, weight: activa ? 2.5 : 1, fillColor: col, fillOpacity: 0.55 }}
                eventHandlers={{ click: () => setCiudad(c.slug) }}>
                <Tooltip direction="top" offset={[0, -6]}>
                  <div style={{ fontFamily: F, fontSize: 12, lineHeight: 1.5 }}>
                    <b>{c.ciudad}</b> · {estado(c).t}<br />
                    {OFICIOS.map((of) => <span key={of}>{NOMBRE_OF[of]}: {num(c.oficios?.[of]?.demanda?.media || 0)} búsq./mes{c.oficios?.[of]?.demanda?.cpc_alto ? ` · clic ${eur(c.oficios[of].demanda.cpc_bajo, 2)}–${eur(c.oficios[of].demanda.cpc_alto, 2)}` : ""}<br /></span>)}
                    Pros firmados: {(c.pros?.Fontanero || 0) + (c.pros?.Pintor || 0)} · interesados: {c.interesados?.total || 0}<br />
                    {best && !activa && <>Si abres {NOMBRE_OF[best.of as Of].toLowerCase()} a {ESCENARIO} €/día: <b>{Math.round(best.r.pBenef * 100)}%</b> de ser rentable</>}
                    {activa && <>Pulsa para ver su previsión</>}
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "10px 14px", fontSize: 12, color: C.mutedL, borderTop: "1px solid " + C.border }}>
        <span><b style={{ color: C.accent }}>●</b> Con campaña activa</span>
        <span><b style={{ color: C.green }}>●</b> Probable rentable si abres (≥70%)</span>
        <span><b style={{ color: C.orange }}>●</b> Dudoso</span>
        <span><b style={{ color: C.red }}>●</b> Probable pérdida</span>
        <span style={{ marginLeft: "auto" }}>Tamaño = búsquedas al mes · pulsa una ciudad para filtrar</span>
      </div>
    </Card>
  );

  // ---------- VISTA DE CIUDAD ----------
  if (sel) {
    const est = estado(sel);
    return (
      <div style={{ fontFamily: F }}>
        {selector}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{sel.ciudad}</h2>
          <Pill texto={est.t} color={est.col} />
          {sel.abierta && <Pill texto={"Abierta" + (sel.lanzada ? " desde " + String(sel.lanzada).slice(8, 10) + "/" + String(sel.lanzada).slice(5, 7) : "")} color={C.green} />}
          <span style={{ fontSize: 12.5, color: C.mutedL }}>Pros firmados: <b style={{ color: C.text }}>{sel.pros?.Fontanero || 0}</b> fontanería · <b style={{ color: C.text }}>{sel.pros?.Pintor || 0}</b> pintura · interesados en captación: <b style={{ color: C.text }}>{sel.interesados?.total || 0}</b></span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1fr 1fr", gap: 12 }}>
          {OFICIOS.map((of) => {
            const md = modelos[sel.slug + "|" + of];
            const dem = sel.oficios?.[of]?.demanda;
            if (!md || (!dem && !md.clicsPropios)) return <Card key={of}><Titulo>{NOMBRE_OF[of]}</Titulo><div style={{ color: C.muted, fontSize: 13 }}>Google no tiene datos de búsquedas suficientes para esta ciudad.</div></Card>;
            const tieneCamp = Number(sel.oficios?.[of]?.presupuesto) > 0;
            const k = sel.slug + "|" + of;
            const B = presu[k] !== undefined ? presu[k] : tieneCamp ? Number(sel.oficios?.[of]?.presupuesto) : ESCENARIO;
            const rs = meses.map((mes) => resumen(simular(md, B, mes, semilla(sel.slug + of + mes.clave + B)), md));
            const r = rs[0];
            const pros = sel.pros?.[of] || 0, interes = sel.interesados?.[of] || 0;
            const clicsDia = B / md.cpc;
            const diasSaber = md.clicsPropios >= 150 ? 0 : clicsDia > 0 ? Math.ceil((150 - md.clicsPropios) / clicsDia) : null;
            const rec = pros === 0
              ? `No tienes ningún profesional de ${NOMBRE_OF[of].toLowerCase()} firmado aquí${interes ? ` (hay ${interes} interesado${interes > 1 ? "s" : ""} en captación)` : ""}. Sin profesional no puedes vender los leads: firma al menos uno antes de anunciar.`
              : r.pBenef >= 0.7 ? `Rentable con alta probabilidad. Si mantienes ${B} €/día, lo esperado es ganar unos ${eur(r.b50)} el mes que viene.`
              : r.pBenef >= 0.45 ? `Resultado incierto. Con ${B} €/día puede salir bien o mal; revisa cuando haya más datos${diasSaber ? ` (en unos ${diasSaber} días)` : ""}.`
              : `Con el precio actual del lead lo más probable es perder dinero. Baja el presupuesto, mejora la conversión o sube el precio del lead.`;
            const maxL = Math.max(1, ...rs.map((x) => x.l90));
            return (
              <Card key={of} accent={tieneCamp ? C.accent + "66" : undefined}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{NOMBRE_OF[of]}</div>
                  <Pill texto={tieneCamp ? "Campaña activa" : "Simulación"} color={tieneCamp ? C.accent : C.blue} />
                </div>
                <div style={{ marginTop: 10, background: C.surface, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.mutedL, marginBottom: 6 }}>
                    <span>Presupuesto diario {tieneCamp ? "(el actual, puedes moverlo)" : "(prueba distintos importes)"}</span><b style={{ color: C.accent, fontSize: 15 }}>{B} €/día</b>
                  </div>
                  <input type="range" min={0} max={80} step={1} value={B} onChange={(e) => setPresu({ ...presu, [k]: Number(e.target.value) })} style={{ width: "100%", accentColor: C.accent }} />
                  <div style={{ fontSize: 11.5, color: C.muted }}>≈ {eur(B * 30)} al mes · clic estimado {eur(md.cpc, 2)} · lead vendido a {eur(md.precio)}</div>
                </div>

                <Titulo>Mes que viene ({meses[0].nombre})</Titulo>
                <Grid min={120} gap={8}>
                  <div><div style={{ fontSize: 11.5, color: C.mutedL }}>Leads</div><div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{num(r.l50)}</div><div style={{ fontSize: 11.5, color: C.muted }}>entre {num(r.l10)} y {num(r.l90)}</div></div>
                  <div><div style={{ fontSize: 11.5, color: C.mutedL }}>Coste por lead</div><div style={{ fontSize: 22, fontWeight: 800 }}>{r.cpl != null ? eur(r.cpl, 0) : "—"}</div><div style={{ fontSize: 11.5, color: C.muted }}>rentable si ≤ {r.umbral != null ? eur(r.umbral, 0) : "—"}</div></div>
                  <div><div style={{ fontSize: 11.5, color: C.mutedL }}>Beneficio</div><div style={{ fontSize: 22, fontWeight: 800, color: r.b50 >= 0 ? C.green : C.red }}>{eur(r.b50)}</div><div style={{ fontSize: 11.5, color: C.muted }}>entre {eur(r.b10)} y {eur(r.b90)}</div></div>
                </Grid>
                <BarraProb label="Probabilidad de ganar dinero" p={r.pBenef} ayuda="Ingresos por leads vendidos (descontando anulaciones) mayores que el gasto en anuncios" />
                <BarraProb label="Probabilidad de que el coste por lead sea rentable" p={r.pCpl} />

                <Titulo>Próximos 3 meses · leads</Titulo>
                {rs.map((x, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, color: C.mutedL, textTransform: "capitalize" }}>{meses[i].nombre}</span>
                    <Rango bajo={x.l10} medio={x.l50} alto={x.l90} max={maxL} color={C.green} />
                  </div>
                ))}

                <div style={{ marginTop: 10 }}><Confianza clics={md.clicsPropios} /></div>
                <div style={{ fontSize: 12, color: C.mutedL, marginTop: 8, lineHeight: 1.5 }}>
                  {md.esBase ? <>Basado en lo real desde que se cobra por lead: {num(md.clicsPropios)} clics y {num(md.leadsPropios)} leads vendidos (formulario, llamada y WhatsApp).</>
                    : md.clicsPropios > 0 ? <>Mezcla sus {num(md.clicsPropios)} clics propios con los ratios de Sevilla{md.ratioCpc ? `; aquí el clic sale ×${md.ratioCpc.toFixed(1)} que en Sevilla según Google` : ""}.</>
                    : <>Sin datos propios todavía: usa los ratios de Sevilla{md.ratioCpc ? ` y un clic ×${md.ratioCpc.toFixed(1)} más caro según Google` : ""}.</>}
                  {diasSaber ? <> Con este presupuesto tendrás datos fiables en unos <b style={{ color: C.text }}>{diasSaber} días</b>.</> : null}
                </div>
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: (pros === 0 ? C.red : colorP(r.pBenef)) + "14", border: "1px solid " + (pros === 0 ? C.red : colorP(r.pBenef)) + "55", fontSize: 13, lineHeight: 1.45 }}>{rec}</div>
              </Card>
            );
          })}
        </div>

        <Card>
          <Titulo>Demanda en Google mes a mes</Titulo>
          <BarrasDemanda ciudad={sel} />
          <Grid min={160} gap={8} style={{ marginTop: 10 }}>
            {OFICIOS.map((of) => {
              const dem = sel.oficios?.[of]?.demanda;
              return (
                <div key={of} style={{ background: C.surface, borderRadius: 10, padding: 12, fontSize: 12.5, lineHeight: 1.6 }}>
                  <b>{NOMBRE_OF[of]}</b><br />
                  {dem ? <>{num(dem.media)} búsquedas al mes<br />Clic arriba en Google: {eur(dem.cpc_bajo, 2)}–{eur(dem.cpc_alto, 2)}<br />Competencia: {dem.competencia ?? "—"}/100</> : <span style={{ color: C.muted }}>Sin datos de Google</span>}
                </div>
              );
            })}
          </Grid>
        </Card>
      </div>
    );
  }

  // ---------- VISTA GENERAL ----------
  const t = g0?.total;
  return (
    <div style={{ fontFamily: F }}>
      {selector}

      {t && (
        <Grid min={movil ? 150 : 180}>
          <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>Leads previstos en {meses[0].nombre}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{num(t.l50)}</div>
            <div style={{ fontSize: 12, color: C.muted }}>80% de probabilidad: {num(t.l10)}–{num(t.l90)}</div>
          </div>
          <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>Gasto previsto</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{eur(t.gasto)}</div>
            <div style={{ fontSize: 12, color: C.muted }}>con los presupuestos actuales</div>
          </div>
          <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>Ingresos por leads</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.accent }}>{eur(t.ingresos)}</div>
            <div style={{ fontSize: 12, color: C.muted }}>descontando anulaciones</div>
          </div>
          <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>Beneficio tras anuncios</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.b50 >= 0 ? C.green : C.red }}>{eur(t.b50)}</div>
            <div style={{ fontSize: 12, color: C.muted }}>entre {eur(t.b10)} y {eur(t.b90)}</div>
          </div>
          <div style={{ background: C.card, border: "1px solid " + colorP(t.pBenef) + "66", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>Probabilidad de ganar dinero</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: colorP(t.pBenef) }}>{Math.round(t.pBenef * 100)}%</div>
            <div style={{ fontSize: 12, color: C.muted }}>sumando todas las ciudades activas</div>
          </div>
        </Grid>
      )}

      <Card>
        <Titulo>Próximos 3 meses (ciudades con campaña activa)</Titulo>
        {general && general.map((g, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: movil ? "70px 1fr" : "90px 1fr 1fr", gap: 14, alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, textTransform: "capitalize" }}>{g.mes.nombre}</span>
            <div><div style={{ fontSize: 11, color: C.mutedL, marginBottom: 3 }}>Leads</div><Rango bajo={g.total.l10} medio={g.total.l50} alto={g.total.l90} max={Math.max(...general.map((x) => x.total.l90))} color={C.green} /></div>
            {!movil && <div><div style={{ fontSize: 11, color: C.mutedL, marginBottom: 3 }}>Beneficio</div><Rango bajo={g.total.b10} medio={g.total.b50} alto={g.total.b90} max={Math.max(1, ...general.map((x) => x.total.b90))} color={C.accent} fmt={(v) => eur(v)} /></div>}
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: C.muted }}>La raya marca lo más probable; la franja, el rango en el que caerá el resultado 8 de cada 10 veces.</div>
      </Card>

      <Titulo>Ciudades activas · {meses[0].nombre}</Titulo>
      <Tabla
        cols={[{ k: "c", l: "Ciudad / oficio" }, { k: "p", l: "Presupuesto", align: "right" }, { k: "l", l: "Leads", align: "right" }, { k: "cpl", l: "Coste/lead", align: "right" },
          { k: "b", l: "Beneficio", align: "right" }, { k: "pb", l: "Prob. ganar", align: "center" }, { k: "conf", l: "Confianza" }]}
        filas={(g0?.filas || []).map((x: J) => {
          const md = modelos[x.c.slug + "|" + x.of];
          return {
            c: <span style={{ cursor: "pointer" }} onClick={() => setCiudad(x.c.slug)}><b>{x.c.ciudad}</b><br /><span style={{ fontSize: 11.5, color: C.muted }}>{NOMBRE_OF[x.of as Of]}</span></span>,
            p: presupuestoDe(x.c, x.of) + " €/día",
            l: <span><b style={{ color: C.green }}>{num(x.r.l50)}</b> <span style={{ color: C.muted, fontSize: 11.5 }}>({num(x.r.l10)}–{num(x.r.l90)})</span></span>,
            cpl: x.r.cpl != null ? eur(x.r.cpl) : "—",
            b: <b style={{ color: x.r.b50 >= 0 ? C.green : C.red }}>{eur(x.r.b50)}</b>,
            pb: <Pill texto={Math.round(x.r.pBenef * 100) + "%"} color={colorP(x.r.pBenef)} />,
            conf: <div style={{ width: 110 }}><Confianza clics={md?.clicsPropios || 0} /></div>,
          };
        })}
        vacio="No hay campañas activas"
      />

      <Titulo>Mapa de oportunidades</Titulo>
      {mapa}

      <Titulo>Dónde abrir después · simulación a {ESCENARIO} €/día por oficio</Titulo>
      <Tabla
        cols={[{ k: "c", l: "Ciudad" }, { k: "o", l: "Oficio" }, { k: "d", l: "Búsq./mes", align: "right" }, { k: "cpc", l: "Clic en Google", align: "right" },
          { k: "l", l: "Leads/mes", align: "right" }, { k: "b", l: "Beneficio/mes", align: "right" }, { k: "pb", l: "Prob. ganar", align: "center" }, { k: "pr", l: "Profesionales" }]}
        filas={oportunidades.slice(0, 12).map((o: J) => {
          const dem = o.c.oficios?.[o.of]?.demanda || {};
          const pros = o.c.pros?.[o.of] || 0, inter = o.c.interesados?.[o.of] || 0;
          return {
            c: <span style={{ cursor: "pointer" }} onClick={() => setCiudad(o.c.slug)}><b>{o.c.ciudad}</b></span>,
            o: NOMBRE_OF[o.of as Of], d: num(dem.media || 0),
            cpc: dem.cpc_bajo != null ? eur(dem.cpc_bajo, 2) + "–" + eur(dem.cpc_alto, 2) : "—",
            l: <span><b>{num(o.r.l50)}</b> <span style={{ color: C.muted, fontSize: 11.5 }}>({num(o.r.l10)}–{num(o.r.l90)})</span></span>,
            b: <b style={{ color: o.r.b50 >= 0 ? C.green : C.red }}>{eur(o.r.b50)}</b>,
            pb: <Pill texto={Math.round(o.r.pBenef * 100) + "%"} color={colorP(o.r.pBenef)} />,
            pr: pros > 0 ? <span style={{ color: C.green, fontWeight: 700 }}>{pros} firmado{pros > 1 ? "s" : ""}</span> : inter > 0 ? <span style={{ color: C.orange }}>{inter} interesado{inter > 1 ? "s" : ""}</span> : <span style={{ color: C.red }}>ninguno</span>,
          };
        })}
      />

      <Card>
        <Titulo>Calendario de demanda</Titulo>
        <Calendario d={d} />
      </Card>

      <Card>
        <Titulo>Cómo se calcula</Titulo>
        <div style={{ fontSize: 12.5, color: C.mutedL, lineHeight: 1.65 }}>
          Para cada ciudad y oficio se simulan {num(N_SIM)} meses posibles: clics = presupuesto ÷ precio del clic (sin pasar de lo que da el mercado ese mes),
          leads = clics × conversión, ingresos = leads × precio del lead × (1 − anulaciones), beneficio = ingresos − gasto.
          En Sevilla se usa lo real desde que se cobra por lead: todos los leads vendidos (formulario, llamada y WhatsApp) por cada clic de Google, y lo que ha costado ese clic. En una ciudad nueva se parte de la conversión real de Sevilla, ajustando el precio del clic con lo que dice Google para esa ciudad (calibrado con lo que costó de verdad en Sevilla frente a lo que estimaba Google),
          y en cuanto llegan sus propios clics y leads la previsión va pasando a usar los suyos (con 150 clics ya depende solo de ella).
          La temporada sale de las búsquedas de Google del último año en cada ciudad. Se usa el precio del lead de cada ciudad (en Sevilla, {eur((d.ciudades || []).find((c: J) => c.slug === "sevilla")?.precios?.Fontanero || d.precios?.Fontanero || 0)} fontanería y {eur((d.ciudades || []).find((c: J) => c.slug === "sevilla")?.precios?.Pintor || d.precios?.Pintor || 0)} pintura);
          anulaciones de los últimos 90 días: {Math.round(100 * (d.anulacion?.Fontanero?.anulados || 0) / Math.max(1, d.anulacion?.Fontanero?.total || 0))}% fontanería, {Math.round(100 * (d.anulacion?.Pintor?.anulados || 0) / Math.max(1, d.anulacion?.Pintor?.total || 0))}% pintura.
        </div>
      </Card>
    </div>
  );
}
