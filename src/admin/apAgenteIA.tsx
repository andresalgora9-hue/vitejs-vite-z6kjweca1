// ============================================================
// OficioYa · ADMIN — AGENTE IA (Lucía): la vista de director comercial
// Pipeline, números, gestión, objeciones y guion del agente de llamadas.
// Datos: RPC voz_panel(p_clave, p_pruebas) y voz_llamada_detalle(p_clave, p_id). Solo admin.
// 18/11/2026 Claude (lo pide Andrés)
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../supabase";
import { C, F, Card, Btn, Pill, Kpi, Grid, Titulo, Cabecera, Modal, Tabla, BarraH, Barras, num, fechaHora, hace, useAncho } from "./apUi";

type J = any;
const CLAVE_LS = "oy_captacion_clave";
type Pestana = "resumen" | "pipeline" | "llamadas" | "objeciones" | "guion" | "director";

const ESTADOS: { k: string; l: string; c: string }[] = [
  { k: "nuevo", l: "Nuevo", c: C.blue },
  { k: "no_contesta", l: "No contesta", c: C.muted },
  { k: "contactado", l: "Contactado", c: C.purple },
  { k: "interesado", l: "Interesado", c: C.orange },
  { k: "contrato_enviado", l: "Contrato enviado", c: C.accent },
  { k: "completado", l: "Firmado", c: "#22C55E" },
  { k: "pagado", l: "Pagado", c: C.green },
  { k: "lista_espera", l: "Lista de espera", c: C.mutedL },
  { k: "no_interesado", l: "No interesado", c: C.red },
];
const EST = Object.fromEntries(ESTADOS.map((e) => [e.k, e]));
const ETAPA: Record<string, string> = { primera: "1.ª llamada", seguimiento: "Seguimiento", contrato: "Que firme", pago: "Que pague", fin: "Terminada" };
const RES: Record<string, { l: string; c: string }> = {
  cierre: { l: "Cierre", c: C.green }, firmando: { l: "Firmando", c: C.green }, ya_pagado: { l: "Ya pagado", c: C.green },
  rellamar: { l: "Rellamar", c: C.orange }, dudas: { l: "Dudas", c: C.orange }, no_interesado: { l: "No interesado", c: C.red },
  otro: { l: "Otro", c: C.mutedL }, sin_analizar: { l: "Sin analizar", c: C.muted },
};
const res = (r: string | null | undefined) => RES[r || "sin_analizar"] || { l: r || "—", c: C.mutedL };
const usd = (n: number | null | undefined) => (n == null ? "—" : (Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $");
const seg = (s: number | null | undefined) => (s == null ? "—" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`);
const oficio = (o: string | null) => (o === "fontanero" ? "Fontanero" : o === "pintor" ? "Pintor" : o || "—");
const pctTxt = (v: number | null | undefined) => (v == null ? "—" : v + "%");

// Variación contra la semana anterior
function Delta({ a, b, inverso = false, sufijo = "" }: { a: number | null; b: number | null; inverso?: boolean; sufijo?: string }) {
  if (a == null || b == null) return null;
  const d = Math.round((Number(a) - Number(b)) * 10) / 10;
  if (!d) return <span style={{ color: C.mutedL }}>igual que la semana anterior</span>;
  const bueno = inverso ? d < 0 : d > 0;
  return <span style={{ color: bueno ? C.green : C.red, fontWeight: 700 }}>{d > 0 ? "▲ +" : "▼ "}{num(d, 1)}{sufijo} vs semana anterior</span>;
}

export default function AgenteIA(_props: J) {
  const movil = useAncho() < 820;
  const [clave, setClave] = useState<string>(() => { try { return localStorage.getItem(CLAVE_LS) || ""; } catch { return ""; } });
  const [claveInput, setClaveInput] = useState("");
  const [pruebas, setPruebas] = useState(false);
  const [d, setD] = useState<J | null>(null);
  const [error, setError] = useState("");
  const [pest, setPest] = useState<Pestana>(() => { try { return (sessionStorage.getItem("oy_agente_pest") as Pestana) || "resumen"; } catch { return "resumen"; } });
  const [llamada, setLlamada] = useState<J | null>(null);
  const [ficha, setFicha] = useState<J | null>(null);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    if (!clave) return;
    const { data, error: e } = await db.rpc("voz_panel", { p_clave: clave, p_pruebas: pruebas });
    if (e) {
      if (/acceso denegado/i.test(e.message)) { setError("Clave no válida (hace falta la de administrador)."); setClave(""); try { localStorage.removeItem(CLAVE_LS); } catch { void 0; } }
      else setError("Error al cargar: " + e.message);
      return;
    }
    setError(""); setD(data);
  }, [clave, pruebas]);
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t); }, [cargar]);
  useEffect(() => { try { sessionStorage.setItem("oy_agente_pest", pest); } catch { void 0; } }, [pest]);

  const abrirLlamada = async (l: J) => {
    setLlamada({ ...l, cargando: true });
    const { data, error: e } = await db.rpc("voz_llamada_detalle", { p_clave: clave, p_id: l.id });
    if (e) { setAviso(e.message); return; }
    setLlamada({ ...l, ...(data || {}), cargando: false });
  };
  const lanzarDirector = async () => {
    const { error: e } = await db.rpc("ia_lanzar_manual", { p_clave: clave, p_dep: "captacion", p_modo: "diario" });
    setAviso(e ? e.message : "El director comercial está revisando a Lucía: el informe tarda uno o dos minutos.");
    if (!e) setTimeout(cargar, 90000);
  };

  if (!clave) {
    return (
      <div style={{ maxWidth: 420, margin: "40px auto", fontFamily: F }}>
        <Card>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Agente IA · Lucía</div>
          <div style={{ fontSize: 13, color: C.mutedL, marginBottom: 14 }}>Introduce tu clave de administrador (la misma del CRM de captación).</div>
          <input type="password" value={claveInput} onChange={(ev) => setClaveInput(ev.target.value)} placeholder="Clave"
            onKeyDown={(ev) => { if (ev.key === "Enter" && claveInput.length >= 8) { try { localStorage.setItem(CLAVE_LS, claveInput); } catch { void 0; } setClave(claveInput); } }}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontFamily: F, fontSize: 14, marginBottom: 10 }} />
          {error && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <Btn full disabled={claveInput.length < 8} onClick={() => { try { localStorage.setItem(CLAVE_LS, claveInput); } catch { void 0; } setClave(claveInput); }}>Entrar</Btn>
        </Card>
      </div>
    );
  }
  if (!d) return <div style={{ color: error ? C.red : C.mutedL, padding: 30, fontFamily: F }}>{error || "Cargando a Lucía…"}</div>;

  const k7 = d.kpis?.["7d"] || {}, kA = d.kpis?.["7d_anteriores"] || {}, kH = d.kpis?.hoy || {}, kT = d.kpis?.total || {};
  const fichas: J[] = d.fichas || [];
  const enCurso = fichas.filter((f) => f.en_curso).length;
  const enCola = fichas.filter((f) => f.proxima).length;
  const dir = d.director_comercial || {};
  const propPend = (dir.propuestas || []).filter((p: J) => p.estado === "pendiente").length;

  const pestanas: [Pestana, string, number?][] = [
    ["resumen", "Resumen"], ["pipeline", "Pipeline"], ["llamadas", "Llamadas"], ["objeciones", "Objeciones"], ["guion", "Guion y aprendizaje"], ["director", "Director comercial", propPend],
  ];

  return (
    <div style={{ fontFamily: F }}>
      <Cabecera titulo="Agente IA · Lucía"
        sub={<span>{d.config?.activo ? <b style={{ color: C.green }}>● Llamando</b> : <b style={{ color: C.red }}>● Parada</b>} · {String(d.config?.numero || "").replace(/^\+34/, "").replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4")} · {enCurso ? `${enCurso} en llamada ahora · ` : ""}{enCola} fichas en cola</span>}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.mutedL, cursor: "pointer" }}>
          <input type="checkbox" checked={pruebas} onChange={(e) => setPruebas(e.target.checked)} /> Incluir pruebas
        </label>
        <Btn small outline onClick={cargar}>Actualizar</Btn>
      </Cabecera>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {pestanas.map(([k, l, n]) => (
          <button key={k} onClick={() => setPest(k)} style={{
            padding: "7px 12px", borderRadius: 8, border: "1px solid " + (pest === k ? C.accent : C.border), cursor: "pointer", fontFamily: F,
            background: pest === k ? C.accent + "18" : "transparent", color: pest === k ? C.accent : C.mutedL, fontWeight: 800, fontSize: 12.5,
          }}>{l}{n ? <span style={{ marginLeft: 6, background: C.red, color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 10.5 }}>{n}</span> : null}</button>
        ))}
      </div>
      {aviso && <Card accent={C.blue} style={{ fontSize: 13 }}><span>{aviso}</span> <button onClick={() => setAviso("")} style={{ float: "right", background: "none", border: "none", color: C.muted, cursor: "pointer" }}>×</button></Card>}

      {pest === "resumen" && <Resumen d={d} k7={k7} kA={kA} kH={kH} kT={kT} />}
      {pest === "pipeline" && <Pipeline d={d} fichas={fichas} movil={movil} onFicha={setFicha} />}
      {pest === "llamadas" && <Llamadas d={d} onLlamada={abrirLlamada} />}
      {pest === "objeciones" && <Objeciones d={d} />}
      {pest === "guion" && <Guion d={d} />}
      {pest === "director" && <Director dir={dir} onLanzar={lanzarDirector} />}

      {llamada && <DetalleLlamada l={llamada} onClose={() => setLlamada(null)} />}
      {ficha && <DetalleFicha f={ficha} llamadas={(d.ultimas_llamadas || []).filter((x: J) => x.lead_id === ficha.id)} onLlamada={(l: J) => { setFicha(null); abrirLlamada(l); }} onClose={() => setFicha(null)} />}
    </div>
  );
}

// ── RESUMEN: los números como los pide un director comercial ─────────────
function Resumen({ d, k7, kA, kH, kT }: J) {
  const serie: J[] = d.serie_14d || [];
  const embudo = [
    { l: "Llamadas", v: k7.llamadas || 0, c: C.blue },
    { l: "Contesta", v: k7.contestadas || 0, c: C.purple },
    { l: "Conversación (+45 s)", v: k7.conversaciones || 0, c: C.orange },
    { l: "Cierre (contrato enviado)", v: k7.cierres || 0, c: C.accent },
    { l: "Firmado", v: k7.firmados || 0, c: "#22C55E" },
    { l: "Pagado", v: k7.pagados || 0, c: C.green },
  ];
  const sinDatos = !(kT.llamadas > 0);
  return (
    <>
      {sinDatos && <Card accent={C.orange} style={{ fontSize: 13, color: C.mutedL }}>Todavía no hay llamadas reales{d.incluye_pruebas ? "" : " (las de prueba están ocultas: marca «Incluir pruebas» para verlas)"}. En cuanto Lucía empiece a llamar, aquí verás sus números.</Card>}
      <Titulo>Hoy</Titulo>
      <Grid min={150}>
        <Kpi label="Llamadas" valor={num(kH.llamadas)} sub={`${num(kH.contestadas)} contestadas · ${num(kH.buzon)} buzón`} />
        <Kpi label="Conversaciones" valor={num(kH.conversaciones)} sub={`${num(kH.minutos, 1)} min al teléfono`} />
        <Kpi label="Cierres" valor={num(kH.cierres)} color={kH.cierres ? C.green : C.text} sub={`${num(kH.rellamar)} para rellamar`} />
        <Kpi label="Coste" valor={usd(kH.coste_usd)} />
      </Grid>
      <Titulo>Últimos 7 días</Titulo>
      <Grid min={170}>
        <Kpi label="Llamadas" valor={num(k7.llamadas)} sub={<Delta a={k7.llamadas} b={kA.llamadas} />} />
        <Kpi label="% contesta" valor={pctTxt(k7.tasa_contacto_pct)} sub={<Delta a={k7.tasa_contacto_pct} b={kA.tasa_contacto_pct} sufijo=" pts" />} />
        <Kpi label="% cierre (de las que contestan)" valor={pctTxt(k7.tasa_cierre_pct)} color={C.accent} sub={<Delta a={k7.tasa_cierre_pct} b={kA.tasa_cierre_pct} sufijo=" pts" />} />
        <Kpi label="Cierres" valor={num(k7.cierres)} sub={<Delta a={k7.cierres} b={kA.cierres} />} />
        <Kpi label="Firmados / pagados" valor={`${num(k7.firmados)} / ${num(k7.pagados)}`} color={k7.pagados ? C.green : C.text} />
        <Kpi label="Coste por cierre" valor={usd(k7.coste_por_cierre_usd)} sub={`Gasto ${usd(k7.coste_usd)}`} />
        <Kpi label="Duración media" valor={seg(k7.duracion_media_s)} sub="de las que contestan" />
        <Kpi label="Interés medio" valor={k7.interes_medio == null ? "—" : num(k7.interes_medio, 1) + " / 10"} />
      </Grid>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <Card>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Embudo de la semana</div>
          {embudo.map((e) => <BarraH key={e.l} label={e.l} valor={e.v} total={embudo[0].v} color={e.c} />)}
        </Card>
        <Card>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Llamadas por día (14 días)</div>
          <Barras datos={serie.map((s) => ({ etiqueta: new Date(s.dia).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", timeZone: "UTC" }), valor: s.llamadas, detalle: `${s.contestadas} contestan · ${s.cierres} cierres` }))} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <Card>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Cómo acaban las conversaciones</div>
          {Object.entries(d.resultados || {}).sort((a: J, b: J) => b[1] - a[1]).map(([r, n]: J) => (
            <BarraH key={r} label={res(r).l} valor={n} total={Object.values(d.resultados || {}).reduce((s: number, x: J) => s + Number(x), 0) as number} color={res(r).c} />
          ))}
          {!Object.keys(d.resultados || {}).length && <div style={{ color: C.muted, fontSize: 13 }}>Sin conversaciones todavía.</div>}
        </Card>
        <Card>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Tipo de profesional con el que habla</div>
          {(d.perfiles || []).map((p: J) => (
            <BarraH key={p.perfil} label={p.perfil} valor={p.n} total={(d.perfiles || []).reduce((s: number, x: J) => s + x.n, 0)} color={C.purple} extra={`${p.cierres} cierres`} />
          ))}
          {!(d.perfiles || []).length && <div style={{ color: C.muted, fontSize: 13 }}>Sin datos todavía.</div>}
        </Card>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Total desde el principio: {num(kT.llamadas)} llamadas · {num(kT.cierres)} cierres · {usd(kT.coste_usd)}. Las llamadas web son pruebas y no cuentan salvo con «Incluir pruebas».</div>
    </>
  );
}

// ── PIPELINE: dónde está cada ficha que lleva Lucía ─────────────────────
function Pipeline({ d, fichas, movil, onFicha }: J) {
  const [filtro, setFiltro] = useState("");
  const total = (d.pipeline || []).reduce((s: number, p: J) => s + p.n, 0);
  const q = filtro.trim().toLowerCase();
  const vis = useMemo(() => fichas.filter((f: J) => !q || `${f.nombre} ${f.ciudad} ${f.oficio}`.toLowerCase().includes(q)), [fichas, q]);
  const por = (k: string) => vis.filter((f: J) => f.estado === k);
  return (
    <>
      <Grid min={120}>
        {(d.pipeline || []).map((p: J) => (
          <div key={p.estado} style={{ background: C.card, border: "1px solid " + C.border, borderTop: "3px solid " + (EST[p.estado]?.c || C.border), borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>{EST[p.estado]?.l || p.estado}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{p.n}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{total ? Math.round((100 * p.n) / total) : 0}%</div>
          </div>
        ))}
      </Grid>
      <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por nombre, ciudad u oficio"
        style={{ width: movil ? "100%" : 320, boxSizing: "border-box", padding: "9px 12px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontFamily: F, fontSize: 13, marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10, alignItems: "flex-start" }}>
        {ESTADOS.map((e) => {
          const lista = por(e.k);
          return (
            <div key={e.k} style={{ minWidth: 250, width: 250, flexShrink: 0, background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px 8px" }}>
                <span style={{ fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: e.c }} />{e.l}</span>
                <span style={{ fontSize: 12, color: C.mutedL, fontWeight: 800 }}>{lista.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "62vh", overflowY: "auto" }}>
                {lista.map((f: J) => (
                  <div key={f.id} onClick={() => onFicha(f)} style={{ background: C.card, border: "1px solid " + (f.en_curso ? C.green : f.cerrado_ia ? C.accent + "88" : C.border), borderRadius: 9, padding: "9px 10px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <b style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre || "Sin nombre"}</b>
                      {f.en_curso ? <Pill texto="● En llamada" color={C.green} /> : f.cerrado_ia ? <Pill texto="🤖 Cierre IA" color={C.accent} /> : null}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.mutedL, marginTop: 2 }}>{oficio(f.oficio)} · {f.ciudad || "—"}</div>
                    <div style={{ fontSize: 11.5, color: C.mutedL, marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {f.etapa && <span>{ETAPA[f.etapa] || f.etapa}</span>}
                      <span>· {f.conversaciones}/{f.llamadas} hablado</span>
                      {f.sin_respuesta > 0 && <span style={{ color: C.orange }}>· {f.sin_respuesta} sin respuesta</span>}
                      {f.no_llamar && <span style={{ color: C.red }}>· no llamar</span>}
                    </div>
                    {f.ultima_llamada?.resultado && <div style={{ marginTop: 5 }}><Pill texto={res(f.ultima_llamada.resultado).l + (f.ultima_llamada.interes != null ? ` · interés ${f.ultima_llamada.interes}` : "")} color={res(f.ultima_llamada.resultado).c} /></div>}
                    {f.proxima && <div style={{ fontSize: 11, color: C.blue, marginTop: 5 }}>Próxima llamada: {fechaHora(f.proxima)}</div>}
                  </div>
                ))}
                {!lista.length && <div style={{ fontSize: 12, color: C.muted, padding: 8 }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DetalleFicha({ f, llamadas, onLlamada, onClose }: J) {
  return (
    <Modal titulo={f.nombre || "Ficha"} onClose={onClose} ancho={620}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <Pill texto={EST[f.estado]?.l || f.estado} color={EST[f.estado]?.c || C.mutedL} />
        {f.etapa && <Pill texto={ETAPA[f.etapa] || f.etapa} color={C.blue} />}
        {f.perfil && <Pill texto={"Perfil: " + f.perfil} color={C.purple} />}
        {f.cerrado_ia && <Pill texto="🤖 Cerrado por Lucía" color={C.accent} />}
        {f.no_llamar && <Pill texto="No volver a llamar" color={C.red} />}
      </div>
      <div style={{ fontSize: 13, color: C.mutedL, lineHeight: 1.7 }}>
        {oficio(f.oficio)} · {f.ciudad || "—"} · registrado {hace(f.creado)}<br />
        Llamadas: <b style={{ color: C.text }}>{f.llamadas}</b> · conversaciones: <b style={{ color: C.text }}>{f.conversaciones}</b> · seguidas sin respuesta: <b style={{ color: C.text }}>{f.sin_respuesta || 0}</b><br />
        Última llamada: {f.ultima ? fechaHora(f.ultima) : "—"} · próxima: {f.proxima ? <b style={{ color: C.blue }}>{fechaHora(f.proxima)}</b> : "—"}
        {f.motivo && <><br />Motivo: {f.motivo}</>}
      </div>
      {f.ultima_llamada?.resumen && <Card style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55 }}><b>Última conversación</b><br />{f.ultima_llamada.resumen}{f.ultima_llamada.objecion && <><br /><span style={{ color: C.orange }}>Objeción: {f.ultima_llamada.objecion}</span></>}</Card>}
      {llamadas.length > 0 && <Titulo>Llamadas</Titulo>}
      {llamadas.map((l: J) => (
        <div key={l.id} onClick={() => onLlamada(l)} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 8, marginBottom: 6, cursor: "pointer", fontSize: 13 }}>
          <span>{fechaHora(l.fecha)} · {seg(l.duracion_s)}</span><Pill texto={l.contestada ? res(l.resultado).l : l.buzon ? "Buzón" : "No contesta"} color={l.contestada ? res(l.resultado).c : C.muted} />
        </div>
      ))}
      <div style={{ marginTop: 14 }}><Btn small outline href={`/captacion.html#lead=${f.id}`}>Abrir la ficha en Captación</Btn></div>
    </Modal>
  );
}

// ── LLAMADAS: el registro de actividad ──────────────────────────────────
function Llamadas({ d, onLlamada }: J) {
  const ls: J[] = d.ultimas_llamadas || [];
  return (
    <>
      <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 10 }}>Últimas {ls.length} llamadas. Toca una para ver el resumen, escuchar la grabación y leer la transcripción.</div>
      <Tabla cols={[{ k: "f", l: "Cuándo" }, { k: "n", l: "Profesional" }, { k: "e", l: "Etapa" }, { k: "dur", l: "Duración", align: "right" }, { k: "r", l: "Resultado" }, { k: "i", l: "Interés", align: "center" }, { k: "o", l: "Objeción principal" }, { k: "c", l: "Coste", align: "right" }]}
        filas={ls.map((l) => ({
          f: fechaHora(l.fecha),
          n: <span><b>{l.nombre || "—"}</b> <span style={{ color: C.mutedL }}>{oficio(l.oficio)} · {l.ciudad || "—"}</span>{l.direccion === "web" && <span style={{ color: C.muted }}> · prueba</span>}{l.direccion === "entrante" && <span style={{ color: C.blue }}> · entrante</span>}</span>,
          e: ETAPA[l.etapa] || l.etapa || "—",
          dur: seg(l.duracion_s),
          r: l.estado === "en_curso" ? <Pill texto="● En curso" color={C.green} /> : l.contestada === false ? <Pill texto={l.buzon ? "Buzón" : "No contesta"} color={C.muted} /> : <Pill texto={res(l.resultado).l} color={res(l.resultado).c} />,
          i: l.interes == null ? "—" : l.interes,
          o: <span style={{ display: "inline-block", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "bottom" }}>{l.objecion_principal || "—"}</span>,
          c: usd(l.coste_usd),
        }))}
        onFila={(i) => onLlamada(ls[i])} vacio="Sin llamadas todavía" />
    </>
  );
}

function DetalleLlamada({ l, onClose }: J) {
  const [verTr, setVerTr] = useState(false);
  return (
    <Modal titulo={`${l.nombre || "Llamada"} · ${fechaHora(l.fecha)}`} onClose={onClose} ancho={720}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <Pill texto={l.contestada === false ? (l.buzon ? "Buzón" : "No contesta") : res(l.resultado).l} color={l.contestada === false ? C.muted : res(l.resultado).c} />
        {l.interes != null && <Pill texto={`Interés ${l.interes}/10`} color={C.orange} />}
        {l.perfil && <Pill texto={"Perfil: " + l.perfil} color={C.purple} />}
        <Pill texto={seg(l.duracion_s)} color={C.blue} />
        {l.sentimiento && <Pill texto={"Tono: " + l.sentimiento} color={C.mutedL} />}
        <Pill texto={usd(l.coste_usd)} color={C.mutedL} />
      </div>
      {l.resumen && <Card style={{ fontSize: 13.5, lineHeight: 1.55 }}>{l.resumen}</Card>}
      <Grid min={220}>
        {l.momento_clave && <Card style={{ margin: 0, fontSize: 13 }}><div style={{ color: C.mutedL, fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>MOMENTO CLAVE</div>{l.momento_clave}</Card>}
        {(l.objeciones || []).length > 0 && <Card style={{ margin: 0, fontSize: 13 }}><div style={{ color: C.orange, fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>OBJECIONES</div>{(l.objeciones || []).join(" · ")}</Card>}
        {l.argumento_ganador && <Card style={{ margin: 0, fontSize: 13 }}><div style={{ color: C.green, fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>LO QUE FUNCIONÓ</div>{l.argumento_ganador}</Card>}
        {l.mejora && <Card style={{ margin: 0, fontSize: 13 }}><div style={{ color: C.accent, fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>QUÉ MEJORAR</div>{l.mejora}</Card>}
        {l.siguiente_paso && <Card style={{ margin: 0, fontSize: 13 }}><div style={{ color: C.blue, fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>SIGUIENTE PASO</div>{l.siguiente_paso}</Card>}
      </Grid>
      {(l.herramientas || []).length > 0 && (
        <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 10 }}>Lo que hizo en la llamada: {(l.herramientas || []).map((h: J) => `${h.nombre} (${h.res})`).join(" · ")}</div>
      )}
      {l.grabacion_url && <audio controls preload="none" src={l.grabacion_url} style={{ width: "100%", marginBottom: 10 }} />}
      {l.cargando ? <div style={{ color: C.mutedL, fontSize: 13 }}>Cargando transcripción…</div> : l.transcripcion ? (
        <>
          <Btn small outline onClick={() => setVerTr(!verTr)}>{verTr ? "Ocultar transcripción" : "Ver transcripción"}</Btn>
          {verTr && <pre style={{ whiteSpace: "pre-wrap", fontFamily: F, fontSize: 13, lineHeight: 1.55, background: C.bg, border: "1px solid " + C.border, borderRadius: 10, padding: 12, marginTop: 10, maxHeight: 420, overflowY: "auto" }}>{l.transcripcion}</pre>}
        </>
      ) : null}
      {l.lead_id && <div style={{ marginTop: 12 }}><Btn small outline href={`/captacion.html#lead=${l.lead_id}`}>Abrir la ficha en Captación</Btn></div>}
    </Modal>
  );
}

// ── OBJECIONES: qué le frena y qué está aprendiendo a resolver ──────────
function Objeciones({ d }: J) {
  const os: J[] = d.objeciones || [];
  const max = Math.max(1, ...os.map((o) => o.llamadas));
  return (
    <>
      <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 10 }}>Las objeciones de cada llamada, agrupadas. «Superada» = la llamada acabó en cierre, firma o en volver a llamar pese a la objeción.</div>
      {!os.length && <Card style={{ color: C.muted, fontSize: 13 }}>Sin objeciones registradas todavía.</Card>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 12 }}>
        {os.map((o) => {
          const t = o.tasa_superada_pct ?? 0;
          const col = t >= 50 ? C.green : t >= 20 ? C.orange : C.red;
          return (
            <Card key={o.categoria} style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <b style={{ fontSize: 15 }}>{o.categoria}</b>
                <span style={{ fontSize: 12, color: C.mutedL }}>{o.llamadas} llamadas{o.llamadas_7d ? ` · ${o.llamadas_7d} esta semana` : ""}</span>
              </div>
              <div style={{ height: 6, background: C.bg, borderRadius: 99, margin: "8px 0 10px", overflow: "hidden" }}><div style={{ width: (100 * o.llamadas) / max + "%", height: "100%", background: C.bar }} /></div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <Pill texto={`Superada ${pctTxt(o.tasa_superada_pct)}`} color={col} />
                <Pill texto={`${o.cierres} cierres`} color={C.green} />
                <Pill texto={`${o.perdidas} perdidas`} color={C.red} />
                {o.interes_medio != null && <Pill texto={`Interés ${num(o.interes_medio, 1)}`} color={C.orange} />}
              </div>
              <div style={{ fontSize: 12.5, color: C.mutedL, lineHeight: 1.5 }}>Lo que dicen: {(o.ejemplos || []).map((e: string) => `«${e}»`).join(", ")}</div>
              {o.argumento_que_funciono && <div style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}><b style={{ color: C.green }}>Lo que funcionó:</b> {o.argumento_que_funciono}</div>}
              {o.que_mejorar && <div style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}><b style={{ color: C.accent }}>Qué está probando mejorar:</b> {o.que_mejorar}</div>}
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ── GUION Y APRENDIZAJE: variantes A/B, playbook, mejoras ───────────────
function Guion({ d }: J) {
  const vs: J[] = d.variantes || [];
  const slots = ["apertura", "valor", "cierre"];
  const nombreSlot: Record<string, string> = { apertura: "Apertura", valor: "Argumento central", cierre: "Cierre" };
  const pb: J[] = d.playbook || [];
  const [verPb, setVerPb] = useState<number | null>(pb[0]?.version ?? null);
  return (
    <>
      <Titulo>Variantes del guion que está probando</Titulo>
      <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 10 }}>Lucía reparte cada parte del guion entre varias versiones y va dando más llamadas a la que mejor cierra. No hay ganadora fiable hasta unas 20 conversaciones por versión.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        {slots.map((s) => {
          const lista = vs.filter((v) => v.slot === s);
          const mejor = lista.filter((v) => v.conversaciones >= 20).sort((a, b) => (b.tasa_pct ?? 0) - (a.tasa_pct ?? 0))[0];
          return (
            <Card key={s} style={{ margin: 0 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>{nombreSlot[s] || s}</div>
              {lista.map((v) => (
                <div key={v.codigo} style={{ borderTop: "1px solid " + C.border, padding: "9px 0", opacity: v.activa ? 1 : 0.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <b style={{ fontSize: 12.5 }}>{v.codigo}{mejor?.codigo === v.codigo && <span style={{ color: C.green }}> · va ganando</span>}{!v.activa && " · retirada"}</b>
                    <span style={{ fontSize: 12, color: C.mutedL }}>{v.exitos}/{v.conversaciones} · {pctTxt(v.tasa_pct)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4, lineHeight: 1.5 }}>{v.texto}</div>
                </div>
              ))}
            </Card>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginTop: 4 }}>
        <div>
          <Titulo>Qué está aprendiendo (llamada a llamada)</Titulo>
          {(d.mejoras || []).map((m: J, i: number) => (
            <Card key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}><b>{m.nombre || "—"}</b><span style={{ color: C.muted, fontSize: 12 }}>{fechaHora(m.fecha)} · {res(m.resultado).l}</span></div>
              {m.momento_clave && <div style={{ color: C.mutedL }}>{m.momento_clave}</div>}
              <div style={{ marginTop: 4 }}><b style={{ color: C.accent }}>Mejora:</b> {m.mejora}</div>
            </Card>
          ))}
          {!(d.mejoras || []).length && <Card style={{ color: C.muted, fontSize: 13 }}>Sin datos todavía.</Card>}
        </div>
        <div>
          <Titulo>Argumentos que han funcionado</Titulo>
          {(d.argumentos_ganadores || []).map((a: J, i: number) => (
            <Card key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}><b>{a.nombre || "—"}</b><Pill texto={res(a.resultado).l} color={res(a.resultado).c} /></div>
              {a.argumento}
            </Card>
          ))}
          {!(d.argumentos_ganadores || []).length && <Card style={{ color: C.muted, fontSize: 13 }}>Todavía ninguno.</Card>}
        </div>
      </div>

      <Titulo>Manual de ventas (playbook)</Titulo>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {pb.map((p) => <Btn key={p.version} small outline={verPb !== p.version} onClick={() => setVerPb(p.version)}>v{p.version}{p.activo ? " · activa" : ""}</Btn>)}
      </div>
      {pb.filter((p) => p.version === verPb).map((p) => (
        <Card key={p.version}>
          <div style={{ fontSize: 12, color: C.mutedL, marginBottom: 8 }}>{p.autor} · {fechaHora(p.fecha)} · {p.cambios}</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}>{p.texto}</div>
        </Card>
      ))}
    </>
  );
}

// ── DIRECTOR COMERCIAL: el Equipo IA supervisando a Lucía ───────────────
function Director({ dir, onLanzar }: J) {
  const dep = dir.departamento || {};
  return (
    <>
      <Card accent={dep.activo ? C.green : C.orange}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <b>Departamento de Captación del Equipo IA</b>
            <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4 }}>
              {dep.activo ? <>Revisa a Lucía como su director comercial · {dep.horario}{dep.ultimo_run_at ? ` · última revisión ${hace(dep.ultimo_run_at)}` : ""}</> : "Está apagado. Cuando esté encendido revisará cada día los números, el pipeline, las objeciones y el guion de Lucía y te propondrá una mejora concreta."}
            </div>
          </div>
          {dep.activo && <Btn small onClick={onLanzar}>Pedir revisión ahora</Btn>}
        </div>
      </Card>
      <Titulo>Propuestas para Lucía</Titulo>
      {(dir.propuestas || []).map((p: J) => (
        <Card key={p.id} accent={p.estado === "pendiente" ? C.accent + "88" : undefined}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{p.titulo}</b><Pill texto={p.estado} color={p.estado === "pendiente" ? C.accent : C.mutedL} /></div>
          <div style={{ fontSize: 13, color: C.mutedL, marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{p.detalle}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{fechaHora(p.fecha)} · se aprueban o descartan en Equipo IA → Propuestas</div>
        </Card>
      ))}
      {!(dir.propuestas || []).length && <Card style={{ color: C.muted, fontSize: 13 }}>Sin propuestas todavía.</Card>}
      <Titulo>Revisiones</Titulo>
      {(dir.informes || []).map((i: J) => (
        <Card key={i.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{i.titulo}</b><span style={{ fontSize: 12, color: C.muted }}>{fechaHora(i.fecha)}</span></div>
          <div style={{ fontSize: 13, color: C.mutedL, marginTop: 6, lineHeight: 1.55 }}>{i.resumen}</div>
        </Card>
      ))}
      {!(dir.informes || []).length && <Card style={{ color: C.muted, fontSize: 13 }}>Sin revisiones todavía.</Card>}
    </>
  );
}
