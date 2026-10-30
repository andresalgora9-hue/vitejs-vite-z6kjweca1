// ============================================================
// OficioYa · ADMIN — ANÁLISIS: embudo completo, campañas y negocio
// Datos: RPC mkt_panel (Google Ads + Meta + GA4 sincronizados por Windsor, cruzados con el CRM)
// Acceso: misma clave que el CRM de captación (rol admin)
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../supabase";
import { C, F, Card, Btn, Pill, Grid, Titulo, Cabecera, Tabla, BarraH, ymdMadrid, sumarDias, mesHoy, mesMover, diasDelMes, eur, num, useAncho } from "./apUi";
import Prevision from "./apPrevision";

type J = any;
const CLAVE_LS = "oy_captacion_clave";
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

const pctTxt = (v: number | null | undefined, dec = 0) => (v === null || v === undefined || isNaN(Number(v)) ? "—" : (Number(v) * 100).toFixed(dec) + "%");
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const eur2 = (v: number | null | undefined) => (v === null || v === undefined ? "—" : eur(Number(v), 2));
const corto = (s: string | null | undefined, n = 38) => (!s ? "—" : s.length > n ? s.slice(0, n - 1) + "…" : s);
const nombreCamp = (s: string | null | undefined) => (s || "—").replace(/^r?ofesionales_Sevilla_Busqueda\/\s*/i, "Sevilla · ").replace(/_Busqueda$/i, "").replace(/_/g, " ");
const ddmm = (ymd: string) => ymd ? ymd.slice(8, 10) + "/" + ymd.slice(5, 7) : "";

// ---------- piezas visuales ----------
function Delta({ act, ant, bueno = "sube", formato = "pct" }: { act: number | null; ant: number | null; bueno?: "sube" | "baja"; formato?: "pct" | "pp" }) {
  if (act === null || ant === null || act === undefined || ant === undefined) return <span style={{ color: C.muted }}>sin comparación</span>;
  if (ant === 0 && act === 0) return <span style={{ color: C.muted }}>igual</span>;
  const d = formato === "pp" ? (act - ant) * 100 : ant === 0 ? 100 : ((act - ant) / Math.abs(ant)) * 100;
  const sube = d > 0;
  const bien = Math.abs(d) < 1 ? null : (sube && bueno === "sube") || (!sube && bueno === "baja");
  const col = bien === null ? C.mutedL : bien ? C.green : C.red;
  return <span style={{ color: col, fontWeight: 800 }}>{sube ? "▲" : "▼"} {Math.abs(d).toFixed(0)}{formato === "pp" ? " pp" : "%"} <span style={{ color: C.muted, fontWeight: 600 }}>vs anterior</span></span>;
}

function KpiD({ label, valor, act, ant, bueno, color, ayuda }: { label: string; valor: string; act: number | null; ant: number | null; bueno?: "sube" | "baja"; color?: string; ayuda?: string }) {
  return (
    <div title={ayuda} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 14px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || C.text, marginTop: 4, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</div>
      <div style={{ fontSize: 11.5, marginTop: 3 }}><Delta act={act} ant={ant} bueno={bueno} /></div>
    </div>
  );
}

function Leyenda({ items }: { items: { c: string; l: string; linea?: boolean }[] }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: C.mutedL, marginBottom: 8 }}>
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

// Embudo horizontal con % de paso entre etapas
function Embudo({ pasos }: { pasos: { l: string; v: number; c: string; nota?: string }[] }) {
  const max = Math.max(1, ...pasos.map((p) => p.v));
  return (
    <div>
      {pasos.map((p, i) => {
        const w = Math.max(2, (p.v / max) * 100);
        const prev = i > 0 ? pasos[i - 1].v : null;
        const paso = prev ? ratio(p.v, prev) : null;
        return (
          <div key={p.l} style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, gap: 8 }}>
              <span style={{ color: C.text, fontWeight: 700 }}>{p.l}{p.nota && <span style={{ color: C.muted, fontWeight: 600 }}> · {p.nota}</span>}</span>
              <span style={{ color: C.mutedL, whiteSpace: "nowrap" }}>
                <b style={{ color: C.text }}>{num(p.v)}</b>
                {paso !== null && <span style={{ marginLeft: 8, color: paso < 0.3 ? C.red : paso < 0.6 ? C.orange : C.green, fontWeight: 800 }}>{(paso * 100).toFixed(paso < 0.1 ? 1 : 0)}%</span>}
              </span>
            </div>
            <div style={{ height: 14, background: C.bg, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: w + "%", height: "100%", background: p.c, borderRadius: 6, transition: "width .4s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Gráfico diario: barras de gasto + líneas de leads reales y conversiones de Google
function GraficoDiario({ serie }: { serie: J[] }) {
  const [h, setH] = useState<number | null>(null);
  const W = 760, H = 220, pl = 40, pr = 40, pt = 12, pb = 26;
  const n = serie.length;
  if (!n) return <Vacio texto="Sin datos en el periodo" />;
  const maxG = Math.max(1, ...serie.map((d) => Number(d.gasto)));
  const maxL = Math.max(1, ...serie.map((d) => Math.max(Number(d.leads), Number(d.conv))));
  const cw = (W - pl - pr) / n;
  const x = (i: number) => pl + cw * i + cw / 2;
  const yG = (v: number) => pt + (H - pt - pb) * (1 - v / maxG);
  const yL = (v: number) => pt + (H - pt - pb) * (1 - v / maxL);
  const linea = (k: string) => serie.map((d, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + yL(Number(d[k])).toFixed(1)).join(" ");
  const cada = Math.ceil(n / 10);
  const sel = h !== null ? serie[h] : null;
  return (
    <div style={{ position: "relative" }}>
      <Leyenda items={[{ c: C.bar, l: "Gasto (€)" }, { c: C.green, l: "Leads reales (CRM)", linea: true }, { c: C.blue, l: "Conversiones Google", linea: true }]} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} onMouseLeave={() => setH(null)}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={pt + (H - pt - pb) * (1 - t)} y2={pt + (H - pt - pb) * (1 - t)} stroke={C.border} strokeDasharray="3 4" />
            <text x={pl - 6} y={pt + (H - pt - pb) * (1 - t) + 4} fill={C.muted} fontSize="10" textAnchor="end">{Math.round(maxG * t)}€</text>
            <text x={W - pr + 6} y={pt + (H - pt - pb) * (1 - t) + 4} fill={C.muted} fontSize="10">{Math.round(maxL * t)}</text>
          </g>
        ))}
        {serie.map((d, i) => (
          <rect key={i} x={pl + cw * i + cw * 0.15} y={yG(Number(d.gasto))} width={cw * 0.7} height={Math.max(0, H - pb - yG(Number(d.gasto)))} rx={2} fill={C.bar} opacity={h === null || h === i ? 0.9 : 0.4} />
        ))}
        <path d={linea("conv")} fill="none" stroke={C.blue} strokeWidth={2} strokeLinejoin="round" />
        <path d={linea("leads")} fill="none" stroke={C.green} strokeWidth={2.4} strokeLinejoin="round" />
        {serie.map((d, i) => (i % cada === 0 || i === n - 1) && (
          <text key={"t" + i} x={x(i)} y={H - 8} fill={C.muted} fontSize="10" textAnchor="middle">{ddmm(d.f)}</text>
        ))}
        {serie.map((_, i) => (
          <rect key={"h" + i} x={pl + cw * i} y={pt} width={cw} height={H - pt - pb} fill="transparent" onMouseEnter={() => setH(i)} onClick={() => setH(i)} />
        ))}
      </svg>
      {sel && (
        <div style={{ position: "absolute", top: 30, left: (h! / n) * 100 > 60 ? 10 : undefined, right: (h! / n) * 100 > 60 ? undefined : 10, background: C.cardHi, border: "1px solid " + C.border, borderRadius: 9, padding: "8px 11px", fontSize: 12, lineHeight: 1.6, pointerEvents: "none" }}>
          <b>{ddmm(sel.f)}</b><br />
          Gasto <b>{eur2(sel.gasto)}</b> · Clics <b>{num(sel.clics)}</b><br />
          Leads CRM <b style={{ color: C.green }}>{sel.leads}</b> ({sel.leads_google} con gclid) · Conv. Google <b style={{ color: C.blue }}>{sel.conv}</b><br />
          CPL real <b>{sel.leads > 0 ? eur2(sel.gasto / sel.leads) : "—"}</b>
        </div>
      )}
    </div>
  );
}

// Subasta: cuota ganada vs perdida por presupuesto vs perdida por ranking (barras apiladas al 100%)
function GraficoSubasta({ serie }: { serie: J[] }) {
  const datos = serie.filter((d) => d.cuota !== null);
  if (!datos.length) return <Vacio texto="Sin datos de subasta todavía" />;
  const W = 760, H = 150, pb = 22, pl = 6;
  const cw = (W - pl * 2) / datos.length;
  const cada = Math.ceil(datos.length / 10);
  return (
    <div>
      <Leyenda items={[{ c: C.green, l: "Cuota ganada" }, { c: C.orange, l: "Perdida por presupuesto" }, { c: C.red, l: "Perdida por ranking" }]} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {datos.map((d, i) => {
          const a = Number(d.cuota) || 0, b = Number(d.p_presupuesto) || 0, c = Number(d.p_ranking) || 0;
          const tot = Math.max(1, a + b + c);
          const hh = H - pb;
          const ha = (a / tot) * hh, hb = (b / tot) * hh, hc = (c / tot) * hh;
          const xx = pl + cw * i + cw * 0.12, ww = cw * 0.76;
          return (
            <g key={i}>
              <title>{ddmm(d.f)} · ganada {pctTxt(a)} · presupuesto {pctTxt(b)} · ranking {pctTxt(c)}</title>
              <rect x={xx} y={hh - ha} width={ww} height={ha} fill={C.green} />
              <rect x={xx} y={hh - ha - hb} width={ww} height={hb} fill={C.orange} />
              <rect x={xx} y={hh - ha - hb - hc} width={ww} height={hc} fill={C.red} opacity={0.85} />
              {(i % cada === 0 || i === datos.length - 1) && <text x={xx + ww / 2} y={H - 6} fill={C.muted} fontSize="10" textAnchor="middle">{ddmm(d.f)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Mapa de calor día × hora
function MapaCalor({ horas }: { horas: J[] }) {
  const [met, setMet] = useState<"leads" | "clics" | "conv" | "coste">("leads");
  const m: Record<string, J> = {};
  horas.forEach((x) => { m[x.d + "-" + x.h] = x; });
  const max = Math.max(1, ...horas.map((x) => Number(x[met]) || 0));
  const col = met === "coste" ? C.orange : met === "clics" ? C.blue : C.green;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {([["leads", "Leads CRM"], ["conv", "Conv. Google"], ["clics", "Clics"], ["coste", "Gasto"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMet(k)} style={{ fontFamily: F, fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 7, cursor: "pointer", border: "1px solid " + (met === k ? C.accent : C.border), background: met === k ? C.accent + "18" : "transparent", color: met === k ? C.accent : C.mutedL }}>{l}</button>
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "22px repeat(24, minmax(16px, 1fr))", gap: 2, minWidth: 460 }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => <div key={h} style={{ fontSize: 9.5, color: C.muted, textAlign: "center" }}>{h % 3 === 0 ? h : ""}</div>)}
          {DIAS.map((dn, di) => (
            <React.Fragment key={dn}>
              <div style={{ fontSize: 11, color: C.mutedL, fontWeight: 800, display: "flex", alignItems: "center" }}>{dn}</div>
              {Array.from({ length: 24 }, (_, h) => {
                const c = m[(di + 1) + "-" + h];
                const v = c ? Number(c[met]) || 0 : 0;
                const a = v / max;
                return <div key={h} title={`${dn} ${h}:00 · leads ${c?.leads || 0} · conv ${c?.conv || 0} · clics ${c?.clics || 0} · ${eur2(c?.coste || 0)}`}
                  style={{ height: 20, borderRadius: 3, background: v > 0 ? col : C.bg, opacity: v > 0 ? 0.18 + a * 0.82 : 1 }} />;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function QS({ v }: { v: number | null }) {
  if (v === null || v === undefined) return <span style={{ color: C.muted }}>—</span>;
  const c = v >= 7 ? C.green : v >= 5 ? C.orange : C.red;
  return <span style={{ display: "inline-block", minWidth: 22, textAlign: "center", fontWeight: 800, fontSize: 12, padding: "2px 6px", borderRadius: 5, background: c + "22", color: c }}>{v}</span>;
}
const CAL: Record<string, { t: string; c: string }> = {
  ABOVE_AVERAGE: { t: "Alta", c: C.green }, AVERAGE: { t: "Media", c: C.orange }, BELOW_AVERAGE: { t: "Baja", c: C.red },
};
function Cal({ v }: { v: string | null }) {
  const x = v ? CAL[v] : null;
  return x ? <span style={{ color: x.c, fontWeight: 700, fontSize: 12 }}>{x.t}</span> : <span style={{ color: C.muted }}>—</span>;
}
const EFICACIA: Record<string, { t: string; c: string }> = {
  EXCELLENT: { t: "Excelente", c: C.green }, GOOD: { t: "Buena", c: C.green }, AVERAGE: { t: "Media", c: C.orange }, POOR: { t: "Baja", c: C.red },
};

function Roas({ v }: { v: number | null }) {
  if (v === null) return <span style={{ color: C.muted }}>—</span>;
  const c = v >= 2 ? C.green : v >= 1 ? C.orange : C.red;
  return <Pill texto={v.toFixed(2) + "x"} color={c} />;
}

function MiniBarra({ v, max, color }: { v: number; max: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 70, height: 6, background: C.bg, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: (max > 0 ? Math.min(100, (v / max) * 100) : 0) + "%", height: "100%", background: color }} />
      </div>
    </div>
  );
}

// ---------- pantalla ----------
export default function Analisis(_props: any) {
  const movil = useAncho() < 900;
  const hoy = ymdMadrid(Date.now());
  const [desde, setDesde] = useState(sumarDias(hoy, -29));
  const [hasta, setHasta] = useState(hoy);
  const [rango, setRango] = useState("30");
  const [clave, setClave] = useState<string>(() => { try { return localStorage.getItem(CLAVE_LS) || ""; } catch { return ""; } });
  const [claveInput, setClaveInput] = useState("");
  const [data, setData] = useState<J | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [vista, setVista] = useState<"ahora" | "prevision">(() => { try { return (sessionStorage.getItem("oy_analisis_vista") as any) || "ahora"; } catch { return "ahora"; } });
  useEffect(() => { try { sessionStorage.setItem("oy_analisis_vista", vista); } catch { /* nada */ } }, [vista]);

  const cargar = useCallback(async () => {
    if (!clave) return;
    setCargando(true);
    const { data: r, error: e } = await db.rpc("mkt_panel", { p_clave: clave, p_desde: desde, p_hasta: hasta });
    setCargando(false);
    if (e) {
      if (/acceso denegado/i.test(e.message)) { setError("Clave no válida."); setClave(""); try { localStorage.removeItem(CLAVE_LS); } catch { /* nada */ } }
      else setError("Error al cargar: " + e.message);
      return;
    }
    setError("");
    setData(r);
  }, [clave, desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const elegir = (k: string) => {
    setRango(k);
    if (k === "7") { setDesde(sumarDias(hoy, -6)); setHasta(hoy); }
    if (k === "30") { setDesde(sumarDias(hoy, -29)); setHasta(hoy); }
    if (k === "90") { setDesde(sumarDias(hoy, -89)); setHasta(hoy); }
    if (k === "mes") { setDesde(mesHoy() + "-01"); setHasta(hoy); }
    if (k === "mesAnt") { const m = mesMover(mesHoy(), -1); setDesde(m + "-01"); setHasta(m + "-" + String(diasDelMes(m)).padStart(2, "0")); }
  };

  const k = data?.kpis || {};
  const ka = data?.kpis_ant || {};
  const e = data?.embudo || {};

  const campanas: J[] = useMemo(() => (data?.campanas || []), [data]);
  const maxCosteCamp = Math.max(1, ...campanas.map((c) => Number(c.coste)));

  if (!clave) {
    return (
      <div style={{ maxWidth: 420, margin: "40px auto" }}>
        <Card>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Panel de análisis</div>
          <div style={{ fontSize: 13, color: C.mutedL, marginBottom: 14 }}>Introduce tu clave de administrador (la misma del CRM de captación).</div>
          <input type="password" value={claveInput} onChange={(ev) => setClaveInput(ev.target.value)} placeholder="Clave"
            onKeyDown={(ev) => { if (ev.key === "Enter" && claveInput.length >= 8) { try { localStorage.setItem(CLAVE_LS, claveInput); } catch { /* nada */ } setClave(claveInput); setError(""); } }}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontFamily: F, fontSize: 14, marginBottom: 10 }} />
          {error && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <Btn full disabled={claveInput.length < 8} onClick={() => { try { localStorage.setItem(CLAVE_LS, claveInput); } catch { /* nada */ } setClave(claveInput); setError(""); }}>Entrar</Btn>
        </Card>
      </div>
    );
  }

  const salud = data?.salud || {};
  const alertas: J[] = data?.alertas || [];
  const serie: J[] = data?.serie || [];

  const pestanas = (
    <div style={{ display: "inline-flex", background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: 3, marginBottom: 12 }}>
      {([["ahora", "Situación actual"], ["prevision", "Previsión"]] as const).map(([k, l]) => (
        <button key={k} onClick={() => setVista(k)} style={{ fontFamily: F, fontSize: 13.5, fontWeight: 800, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: vista === k ? C.accent : "transparent", color: vista === k ? "#000" : C.mutedL }}>{l}</button>
      ))}
    </div>
  );

  if (vista === "prevision") {
    return (
      <div style={{ fontFamily: F }}>
        {pestanas}
        <Cabecera titulo="Previsión" sub="Próximos meses, probabilidades y dónde abrir" />
        <Prevision clave={clave} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: F }}>
      {pestanas}
      <Cabecera titulo="Análisis" sub={data ? `${ddmm(data.periodo.desde)} – ${ddmm(data.periodo.hasta)} · comparado con ${ddmm(data.periodo.ant_desde)} – ${ddmm(data.periodo.ant_hasta)}` : "Campañas, embudo y negocio en un solo sitio"}>
        {([["7", "7 días"], ["30", "30 días"], ["90", "90 días"], ["mes", "Este mes"], ["mesAnt", "Mes anterior"]] as const).map(([kk, l]) => (
          <button key={kk} onClick={() => elegir(kk)} style={{ fontFamily: F, fontSize: 12.5, fontWeight: 800, padding: "7px 11px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (rango === kk ? C.accent : C.border), background: rango === kk ? C.accent + "18" : "transparent", color: rango === kk ? C.accent : C.mutedL }}>{l}</button>
        ))}
        <input type="date" value={desde} max={hasta} onChange={(ev) => { setRango(""); setDesde(ev.target.value); }} style={{ background: C.surface, color: C.text, border: "1px solid " + C.border, borderRadius: 8, padding: "6px 8px", fontFamily: F, fontSize: 12.5 }} />
        <input type="date" value={hasta} min={desde} max={hoy} onChange={(ev) => { setRango(""); setHasta(ev.target.value); }} style={{ background: C.surface, color: C.text, border: "1px solid " + C.border, borderRadius: 8, padding: "6px 8px", fontFamily: F, fontSize: 12.5 }} />
        <Btn small outline onClick={cargar}>{cargando ? "Cargando…" : "Actualizar"}</Btn>
      </Cabecera>

      {error && <Card accent={C.red}><span style={{ color: C.red }}>{error}</span></Card>}
      {!data && !error && <div style={{ color: C.mutedL, padding: 30 }}>Cargando datos…</div>}

      {data && (
        <>
          {/* ALERTAS */}
          {alertas.length > 0 && (
            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              {alertas.map((a, i) => {
                const c = a.nivel === "alta" ? C.red : a.nivel === "media" ? C.orange : C.blue;
                return (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: c + "14", border: "1px solid " + c + "55", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
                    <span style={{ color: c, fontWeight: 900, fontSize: 14, lineHeight: 1.3 }}>{a.nivel === "alta" ? "!" : a.nivel === "media" ? "▲" : "i"}</span>
                    <span style={{ color: C.text, lineHeight: 1.45 }}>{a.texto}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* KPIs */}
          <Grid min={movil ? 150 : 175}>
            <KpiD label="Inversión (clientes)" valor={eur(k.gasto || 0)} act={k.gasto} ant={ka.gasto} bueno="baja" ayuda="Google Ads + Meta de clientes. La captación de profesionales va aparte." />
            <KpiD label="Leads reales (CRM)" valor={num(k.leads || 0)} act={k.leads} ant={ka.leads} color={C.green} ayuda="Solicitudes registradas en budget_requests" />
            <KpiD label="Coste por lead real" valor={eur2(k.cpl)} act={k.cpl} ant={ka.cpl} bueno="baja" ayuda="Gasto total / leads del CRM" />
            <KpiD label="Ingresos generados" valor={eur(k.ingresos || 0)} act={k.ingresos} ant={ka.ingresos} color={C.accent} ayuda="Leads vendidos válidos + comisiones cobradas" />
            <KpiD label="ROAS real" valor={k.roas === null || k.roas === undefined ? "—" : k.roas.toFixed(2) + "x"} act={k.roas} ant={ka.roas} color={k.roas >= 2 ? C.green : k.roas >= 1 ? C.orange : C.red} ayuda="Ingresos / inversión" />
            <KpiD label="Margen tras anuncios" valor={eur(k.margen || 0)} act={k.margen} ant={ka.margen} color={(k.margen || 0) >= 0 ? C.green : C.red} />
            <KpiD label="CPC medio Google" valor={eur2(k.cpc)} act={k.cpc} ant={ka.cpc} bueno="baja" />
            <KpiD label="Leads ganados por pros" valor={num(k.ganados || 0)} act={k.ganados} ant={ka.ganados} />
            {Number(k.gasto_pros) > 0 && <KpiD label="Captación de pros (Meta)" valor={eur(k.gasto_pros) + " · " + num(k.leads_pros) + " leads"} act={k.cpl_pros} ant={ka.cpl_pros} bueno="baja" color={C.purple} ayuda={"Coste por profesional interesado: " + eur2(k.cpl_pros)} />}
          </Grid>

          {/* EMBUDO */}
          <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1.25fr 1fr", gap: 12 }}>
            <Card>
              <Titulo>Embudo completo</Titulo>
              <Embudo pasos={[
                { l: "Impresiones", v: Number(e.impresiones) || 0, c: C.blue },
                { l: "Clics", v: Number(e.clics) || 0, c: C.blue, nota: "CTR " + (k.ctr ?? "—") + "%" },
                { l: "Leads en el CRM", v: Number(e.leads) || 0, c: C.green, nota: num(e.leads_google) + " de Google" },
                { l: "Enviados a profesionales", v: Number(e.enviados) || 0, c: C.purple },
                { l: "Válidos (no anulados)", v: Number(e.validos) || 0, c: C.purple },
                { l: "Contactados por el pro", v: Number(e.contactados) || 0, c: C.orange },
                { l: "Ganados", v: Number(e.ganados) || 0, c: C.accent },
              ]} />
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Google cuenta {num(e.conv_google, 1)} conversiones; en tu CRM entraron {num(e.leads_google)} leads con gclid.</div>
            </Card>
            <Card>
              <Titulo>Modelo comisión (deals)</Titulo>
              <BarraH label="Deals creados" valor={Number(e.deals) || 0} total={Number(e.deals) || 0} color={C.blue} />
              <BarraH label="Siguen en «entrada»" valor={Number(e.deals_entrada) || 0} total={Number(e.deals) || 0} color={C.red} />
              <BarraH label="Avanzan (aceptado o más)" valor={Number(e.deals_avanzan) || 0} total={Number(e.deals) || 0} color={C.orange} />
              <BarraH label="Cobrados / liquidados" valor={Number(e.deals_cobrados) || 0} total={Number(e.deals) || 0} color={C.green} />
              <BarraH label="Cerrados sin trabajo" valor={Number(e.deals_cerrados) || 0} total={Number(e.deals) || 0} color={C.muted} />
              <Titulo>Ingresos</Titulo>
              <BarraH label="Venta de leads válidos (€)" valor={Math.round(Number(k.venta_leads) || 0)} total={Math.max(1, Math.round(Number(k.ingresos) || 0))} color={C.accent} />
              <BarraH label="Comisiones cobradas (€)" valor={Math.round(Number(k.comisiones) || 0)} total={Math.max(1, Math.round(Number(k.ingresos) || 0))} color={C.green} />
              <div style={{ fontSize: 12, color: C.mutedL }}>Cobrado de verdad en el periodo: <b style={{ color: C.text }}>{eur(k.cobrado || 0)}</b></div>
            </Card>
          </div>

          {/* EVOLUCIÓN */}
          <Card>
            <Titulo>Evolución diaria</Titulo>
            <GraficoDiario serie={serie} />
          </Card>

          {/* SUBASTA */}
          <Card>
            <Titulo>¿Te frena el presupuesto o el ranking?</Titulo>
            <GraficoSubasta serie={serie} />
          </Card>

          {/* CAMPAÑAS */}
          <Titulo>Campañas</Titulo>
          <Tabla
            cols={[
              { k: "n", l: "Campaña" }, { k: "e", l: "Estado" }, { k: "g", l: "Gasto", align: "right" }, { k: "b", l: "" },
              { k: "cl", l: "Clics", align: "right" }, { k: "cv", l: "Conv. G.", align: "right" }, { k: "l", l: "Leads reales", align: "right" },
              { k: "cpl", l: "CPL real", align: "right" }, { k: "in", l: "Ingresos", align: "right" }, { k: "r", l: "ROAS", align: "center" },
              { k: "cu", l: "Cuota", align: "right" }, { k: "pp", l: "Pérd. presup.", align: "right" }, { k: "pr", l: "Pérd. ranking", align: "right" },
            ]}
            filas={campanas.map((c) => ({
              n: <span title={c.nombre}><b>{corto(nombreCamp(c.nombre), 30)}</b><br /><span style={{ fontSize: 11.5, color: C.muted }}>{c.oficio || "—"} · {c.ciudad || "—"} · {c.presupuesto_dia ? c.presupuesto_dia + " €/día" : ""}</span></span>,
              e: <Pill texto={c.estado === "ENABLED" ? "Activa" : c.estado === "PAUSED" ? "Pausada" : c.estado || "—"} color={c.estado === "ENABLED" ? C.green : C.muted} />,
              g: eur(c.coste), b: <MiniBarra v={Number(c.coste)} max={maxCosteCamp} color={C.bar} />,
              cl: num(c.clics), cv: num(c.conv, 1), l: <b style={{ color: C.green }}>{num(c.leads)}</b>,
              cpl: c.leads > 0 ? eur2(c.coste / c.leads) : "—", in: eur(c.ingresos), r: <Roas v={c.coste > 0 ? Number(c.ingresos) / Number(c.coste) : null} />,
              cu: pctTxt(c.cuota), pp: <span style={{ color: Number(c.pp) > 0.3 ? C.orange : C.text }}>{pctTxt(c.pp)}</span>, pr: <span style={{ color: Number(c.pr) > 0.5 ? C.red : C.text }}>{pctTxt(c.pr)}</span>,
            }))}
            vacio="Aún no hay datos de campañas sincronizados"
          />

          {/* KEYWORDS */}
          <Titulo>Palabras clave (leads e ingresos reales por gclid)</Titulo>
          <Tabla
            cols={[
              { k: "kw", l: "Keyword" }, { k: "qs", l: "QS", align: "center" }, { k: "ce", l: "CTR esp.", align: "center" }, { k: "ra", l: "Anuncio", align: "center" }, { k: "lp", l: "Landing", align: "center" },
              { k: "g", l: "Gasto", align: "right" }, { k: "cl", l: "Clics", align: "right" }, { k: "cpc", l: "CPC", align: "right" }, { k: "cv", l: "Conv. G.", align: "right" },
              { k: "l", l: "Leads", align: "right" }, { k: "cpl", l: "CPL real", align: "right" }, { k: "in", l: "Ingresos", align: "right" },
            ]}
            filas={(data.keywords || []).map((x: J) => ({
              kw: <span><b>{corto(x.keyword, 30)}</b><br /><span style={{ fontSize: 11.5, color: C.muted }}>{corto(x.grupo, 22)} · {corto(nombreCamp(campanas.find((c) => c.campaign_id === x.campaign_id)?.nombre), 22)}</span></span>,
              qs: <QS v={x.qs} />, ce: <Cal v={x.ctr_esp} />, ra: <Cal v={x.relevancia} />, lp: <Cal v={x.landing} />,
              g: eur2(x.coste), cl: num(x.clics), cpc: x.clics > 0 ? eur2(x.coste / x.clics) : "—", cv: num(x.conv, 1),
              l: <b style={{ color: x.leads > 0 ? C.green : C.muted }}>{x.leads}</b>,
              cpl: x.leads > 0 ? eur2(x.coste / x.leads) : <span style={{ color: x.coste > 15 ? C.red : C.muted }}>{x.coste > 15 ? "sin leads" : "—"}</span>,
              in: x.ingresos > 0 ? eur(x.ingresos) : "—",
            }))}
            vacio="Aún no hay datos de keywords sincronizados"
          />

          <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1fr 1fr", gap: 12 }}>
            {/* TÉRMINOS */}
            <Card>
              <Titulo>Búsquedas reales que pagas</Titulo>
              {(data.terminos || []).length === 0 && <Vacio texto="Sin términos todavía" />}
              {(data.terminos || []).slice(0, 18).map((t: J) => {
                const malo = Number(t.coste) >= 5 && Number(t.conv) === 0;
                const max = Number(data.terminos[0]?.coste) || 1;
                return (
                  <div key={t.termino} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, gap: 8 }}>
                      <span style={{ color: malo ? C.red : C.text, fontWeight: 700 }}>{malo ? "✕ " : ""}{corto(t.termino, 40)}</span>
                      <span style={{ color: C.mutedL, whiteSpace: "nowrap" }}>{eur2(t.coste)} · {t.clics} cl · <b style={{ color: Number(t.conv) > 0 ? C.green : C.muted }}>{t.conv} conv</b></span>
                    </div>
                    <div style={{ height: 5, background: C.bg, borderRadius: 99, overflow: "hidden", marginTop: 3 }}>
                      <div style={{ width: (Number(t.coste) / max) * 100 + "%", height: "100%", background: malo ? C.red : C.bar }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>En rojo: han gastado 5 € o más sin ninguna conversión. Candidatas a negativa.</div>
            </Card>

            {/* HORAS */}
            <Card>
              <Titulo>¿Cuándo entran los clientes?</Titulo>
              <MapaCalor horas={data.horas || []} />
              <Titulo>Dispositivos</Titulo>
              {(data.dispositivos || []).length === 0 && <Vacio texto="Sin datos" />}
              {(data.dispositivos || []).map((d: J) => (
                <BarraH key={d.dispositivo} label={d.dispositivo === "MOBILE" ? "Móvil" : d.dispositivo === "DESKTOP" ? "Ordenador" : d.dispositivo === "TABLET" ? "Tablet" : d.dispositivo}
                  valor={Number(d.clics)} total={(data.dispositivos || []).reduce((s: number, x: J) => s + Number(x.clics), 0)} color={C.blue} extra={eur(d.coste) + " · " + d.conv + " conv"} />
              ))}
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1fr 1fr", gap: 12 }}>
            {/* MUNICIPIOS */}
            <Card>
              <Titulo>Municipios</Titulo>
              {(data.municipios || []).length === 0 && <Vacio texto="Sin datos" />}
              {(data.municipios || []).slice(0, 12).map((m: J) => (
                <BarraH key={m.municipio} label={m.municipio === "Seville" ? "Sevilla" : m.municipio} valor={Number(m.clics)}
                  total={(data.municipios || []).reduce((s: number, x: J) => s + Number(x.clics), 0)} color={C.purple} extra={eur(m.coste) + " · " + m.conv + " conv"} />
              ))}
            </Card>
            {/* CANAL / OFICIO */}
            <Card>
              <Titulo>Leads por canal</Titulo>
              {(data.leads_canal || []).map((c: J) => (
                <BarraH key={c.canal} label={c.canal.charAt(0).toUpperCase() + c.canal.slice(1)} valor={Number(c.n)} total={Number(k.leads) || 1} color={C.green} />
              ))}
              <Titulo>Leads por oficio</Titulo>
              {(data.leads_oficio || []).map((c: J) => (
                <BarraH key={c.oficio} label={c.oficio} valor={Number(c.n)} total={Number(k.leads) || 1} color={C.accent} extra={c.google + " de Google"} />
              ))}
            </Card>
          </div>

          {/* ANUNCIOS */}
          <Titulo>Anuncios</Titulo>
          {(data.anuncios || []).length === 0 && <Card><Vacio texto="Aún no hay datos de anuncios sincronizados" /></Card>}
          <Grid min={movil ? 260 : 320}>
            {(data.anuncios || []).slice(0, 9).map((a: J) => {
              const ef = EFICACIA[a.eficacia] || { t: a.eficacia || "—", c: C.muted };
              const ctr = a.impr > 0 ? (a.clics / a.impr) * 100 : 0;
              return (
                <div key={a.ad_id} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <b style={{ fontSize: 13 }}>{corto(a.grupo, 28)}</b><Pill texto={ef.t} color={ef.c} />
                  </div>
                  <div style={{ fontSize: 12, color: C.mutedL, lineHeight: 1.5, minHeight: 36 }}>{corto((a.titulos || "").split(" | ").slice(0, 3).join(" · "), 110)}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, marginTop: 8, color: C.mutedL, flexWrap: "wrap" }}>
                    <span>{eur(a.coste)}</span><span>{num(a.clics)} clics</span><span>CTR <b style={{ color: C.text }}>{ctr.toFixed(1)}%</b></span><span><b style={{ color: Number(a.conv) > 0 ? C.green : C.muted }}>{a.conv}</b> conv</span>
                  </div>
                </div>
              );
            })}
          </Grid>

          {/* LANDINGS */}
          <Titulo>Landings (Google Analytics)</Titulo>
          <Tabla
            cols={[{ k: "l", l: "Página" }, { k: "s", l: "Sesiones", align: "right" }, { k: "p", l: "De pago", align: "right" }, { k: "e", l: "Interés", align: "right" }, { k: "c", l: "Leads", align: "right" }, { k: "t", l: "Tasa", align: "right" }]}
            filas={(data.landings || []).map((x: J) => ({
              l: corto(x.landing, 44), s: num(x.sesiones), p: num(x.sesiones_cpc || 0),
              e: pctTxt(ratio(Number(x.engaged), Number(x.sesiones))),
              c: num(x.conv, 1), t: <b style={{ color: Number(x.conv) > 0 ? C.green : C.muted }}>{pctTxt(ratio(Number(x.conv), Number(x.sesiones)), 1)}</b>,
            }))}
            vacio="Aún no hay datos de Google Analytics sincronizados"
          />

          {/* PROFESIONALES */}
          <Titulo>Profesionales: ¿aprovechan los leads?</Titulo>
          <Tabla
            cols={[{ k: "n", l: "Profesional" }, { k: "e", l: "Enviados", align: "right" }, { k: "a", l: "Anulados", align: "right" }, { k: "c", l: "Contactados", align: "right" },
              { k: "g", l: "Ganados", align: "right" }, { k: "h", l: "1er contacto", align: "right" }, { k: "i", l: "Facturable", align: "right" }]}
            filas={(data.profesionales || []).map((p: J) => {
              const pa = ratio(Number(p.anulados), Number(p.enviados)) || 0;
              return {
                n: <span><b>{p.nombre || "—"}</b><br /><span style={{ fontSize: 11.5, color: C.muted }}>{p.oficio}</span></span>,
                e: num(p.enviados), a: <span style={{ color: pa > 0.3 ? C.red : C.text, fontWeight: pa > 0.3 ? 800 : 400 }}>{p.anulados} ({pctTxt(pa)})</span>,
                c: num(p.contactados), g: <b style={{ color: Number(p.ganados) > 0 ? C.green : C.muted }}>{p.ganados}</b>,
                h: p.horas_contacto === null ? "—" : <span style={{ color: Number(p.horas_contacto) > 24 ? C.orange : C.text }}>{p.horas_contacto} h</span>,
                i: eur(p.importe),
              };
            })}
            vacio="Sin leads enviados en el periodo"
          />

          {/* META */}
          {(data.meta || []).length > 0 && (
            <>
              <Titulo>Meta Ads</Titulo>
              <Tabla
                cols={[{ k: "c", l: "Campaña" }, { k: "t", l: "Para", align: "center" }, { k: "g", l: "Gasto", align: "right" }, { k: "i", l: "Impresiones", align: "right" }, { k: "a", l: "Alcance", align: "right" }, { k: "cl", l: "Clics", align: "right" }, { k: "l", l: "Leads", align: "right" }, { k: "cpl", l: "CPL", align: "right" }]}
                filas={(data.meta || []).map((m: J) => ({ c: corto(m.campana, 36), t: <Pill texto={m.tipo === "profesionales" ? "Captar pros" : "Clientes"} color={m.tipo === "profesionales" ? C.purple : C.green} />, g: eur(m.coste), i: num(m.impr), a: num(m.alcance), cl: num(m.clics), l: num(m.leads, 1), cpl: Number(m.leads) > 0 ? eur2(m.coste / m.leads) : "—" }))}
              />
            </>
          )}

          {/* SALUD DE LOS DATOS */}
          <Titulo>Calidad de los datos</Titulo>
          <Grid min={movil ? 150 : 200}>
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>Leads con gclid</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{salud.pct_gclid ?? "—"}%</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>{salud.pct_atribuidos ?? "—"}% ya cruzados con su keyword</div>
            </div>
            <div style={{ background: C.card, border: "1px solid " + (salud.deals_atascados > 0 ? C.red + "88" : C.border), borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>Deals atascados en «entrada»</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: salud.deals_atascados > 0 ? C.red : C.text }}>{salud.deals_atascados ?? 0}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>más de 7 días sin moverse</div>
            </div>
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>Última sincronización</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{salud.ultimo_sync ? new Date(salud.ultimo_sync).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Pendiente"}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>{salud.datos_desde ? "Datos desde " + ddmm(salud.datos_desde) : "Se actualiza sola cada 6 h"}</div>
            </div>
          </Grid>
        </>
      )}
    </div>
  );
}
