// ============================================================
// OficioYa · ADMIN — EQUIPO IA: departamentos que analizan el negocio, proponen y se reúnen los lunes
// Datos: RPCs ia_panel, ia_informe, ia_propuesta_decidir, ia_lanzar_manual, ia_cultura_guardar, ia_mensaje_resolver
// Las IAs trabajan en la Edge Function "equipo-ia" (Claude). Proponen; Andrés decide.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../supabase";
import { C, F, Card, Btn, Pill, Grid, Titulo, Cabecera, Modal, eur, num, hace, fechaHora, useAncho } from "./apUi";

type J = any;
const CLAVE_LS = "oy_captacion_clave";
const COL_ESTADO: Record<string, string> = { bien: C.green, atencion: C.orange, mal: C.red };
const TXT_ESTADO: Record<string, string> = { bien: "Va bien", atencion: "Atención", mal: "Mal" };
const COL_NIVEL: Record<string, string> = { alta: C.red, media: C.orange, baja: C.blue };
type Pestana = "oficina" | "equipo" | "laboratorio" | "propuestas" | "tablon" | "reuniones" | "cultura";

export default function EquipoIA(_props: J) {
  const movil = useAncho() < 820;
  const [clave, setClave] = useState<string>(() => { try { return localStorage.getItem(CLAVE_LS) || ""; } catch { return ""; } });
  const [claveInput, setClaveInput] = useState("");
  const [d, setD] = useState<J | null>(null);
  const [lab, setLab] = useState<J | null>(null);
  const [error, setError] = useState("");
  const [pest, setPest] = useState<Pestana>(() => { try { const g = sessionStorage.getItem("oy_equipo_pest") as Pestana; return g && g !== ("chat" as Pestana) ? g : "oficina"; } catch { return "oficina"; } });
  const [verInforme, setVerInforme] = useState<J | null>(null);
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    if (!clave) return;
    const { data, error: e } = await db.rpc("ia_panel", { p_clave: clave });
    if (e) {
      if (/acceso denegado/i.test(e.message)) { setError("Clave no válida."); setClave(""); try { localStorage.removeItem(CLAVE_LS); } catch { /* nada */ } }
      else setError("Error al cargar: " + e.message);
      return;
    }
    setError(""); setD(data);
    const l = await db.rpc("ia_lab", { p_clave: clave });
    if (!l.error) setLab(l.data);
  }, [clave]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { try { sessionStorage.setItem("oy_equipo_pest", pest); } catch { /* nada */ } }, [pest]);

  // Si alguien está trabajando, refresca cada 8 segundos
  const trabajando = useMemo(() => (d?.departamentos || []).some((x: J) => x.estado === "trabajando"), [d]);
  useEffect(() => { if (!trabajando) return; const t = setInterval(cargar, 3000); return () => clearInterval(t); }, [trabajando, cargar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 3500); return () => clearTimeout(t); }, [aviso]);

  const deps: J[] = d?.departamentos || [];
  const depPorId = useMemo(() => Object.fromEntries(deps.map((x) => [x.id, x])), [deps]);
  const nombreDep = (id: string) => (depPorId[id] ? depPorId[id].icono + " " + depPorId[id].nombre : id);
  const propuestas: J[] = d?.propuestas || [];
  const mensajes: J[] = d?.mensajes || [];
  const pendientes = propuestas.filter((p) => p.estado === "propuesta").length;
  const abiertos = mensajes.filter((m) => m.estado === "abierto").length;

  const lanzar = async (dep: string, modo = "diario") => {
    setOcupado(dep + modo);
    const { error: e } = await db.rpc("ia_lanzar_manual", { p_clave: clave, p_dep: dep, p_modo: modo });
    setOcupado("");
    if (e) { setAviso(e.message); return; }
    setAviso(modo === "reunion" ? "Reunión convocada: el acta tardará uno o dos minutos." : "Trabajando… el informe tardará uno o dos minutos.");
    setTimeout(cargar, 1500);
  };
  const decidir = async (p: J, estado: string) => {
    let nota: string | null = null;
    if (estado === "descartada") nota = window.prompt("¿Por qué la descartas? (opcional, ayuda a que el equipo aprenda)") || null;
    const { error: e } = await db.rpc("ia_propuesta_decidir", { p_clave: clave, p_id: p.id, p_estado: estado, p_nota: nota });
    if (e) { setAviso(e.message); return; }
    cargar();
  };
  const abrirInforme = async (id: number) => {
    const { data, error: e } = await db.rpc("ia_informe", { p_clave: clave, p_id: id });
    if (e) { setAviso(e.message); return; }
    setVerInforme(data);
  };

  if (!clave) {
    return (
      <div style={{ maxWidth: 420, margin: "40px auto" }}>
        <Card>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Equipo IA</div>
          <div style={{ fontSize: 13, color: C.mutedL, marginBottom: 14 }}>Introduce tu clave de administrador (la misma del CRM de captación).</div>
          <input type="password" value={claveInput} onChange={(ev) => setClaveInput(ev.target.value)} placeholder="Clave"
            onKeyDown={(ev) => { if (ev.key === "Enter" && claveInput.length >= 8) { try { localStorage.setItem(CLAVE_LS, claveInput); } catch { /* nada */ } setClave(claveInput); } }}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontFamily: F, fontSize: 14, marginBottom: 10 }} />
          {error && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <Btn full disabled={claveInput.length < 8} onClick={() => { try { localStorage.setItem(CLAVE_LS, claveInput); } catch { /* nada */ } setClave(claveInput); }}>Entrar</Btn>
        </Card>
      </div>
    );
  }
  if (!d) return <div style={{ color: error ? C.red : C.mutedL, padding: 30, fontFamily: F }}>{error || "Reuniendo al equipo…"}</div>;

  const activos = deps.filter((x) => x.activo).length;
  const exps: J[] = lab?.experimentos || [];
  const labPend = exps.filter((e) => e.estado === "propuesto" || (e.estado === "perdedor" && !e.nota_andres)).length;
  const pestanas: [Pestana, string, number?][] = [["oficina", "🏢 Oficina"], ["equipo", "Equipo"], ["laboratorio", "Laboratorio", labPend], ["propuestas", "Propuestas", pendientes], ["tablon", "Tablón", abiertos], ["reuniones", "Reuniones"], ["cultura", "Cultura y reglas"]];

  return (
    <div style={{ fontFamily: F }}>
      <Cabecera titulo="Equipo IA" sub={`${deps.length} departamentos · ${activos} trabajando ya · proponen, tú decides`}>
        <Btn small outline onClick={cargar}>Actualizar</Btn>
      </Cabecera>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {pestanas.map(([k, l, n]) => (
          <button key={k} onClick={() => setPest(k)} style={{ fontFamily: F, fontSize: 13.5, fontWeight: 800, padding: "8px 14px", borderRadius: 9, cursor: "pointer",
            border: "1px solid " + (pest === k ? C.accent : C.border), background: pest === k ? C.accent : "transparent", color: pest === k ? "#000" : C.mutedL }}>
            {l}{n ? <span style={{ marginLeft: 6, background: pest === k ? "#0002" : C.red, color: pest === k ? "#000" : "#fff", borderRadius: 99, padding: "1px 7px", fontSize: 11.5 }}>{n}</span> : null}
          </button>
        ))}
      </div>

      {aviso && <div style={{ marginBottom: 12, padding: "9px 12px", borderRadius: 9, background: C.accent + "18", border: "1px solid " + C.accent + "55", fontSize: 13 }}>{aviso}</div>}

      {pest === "equipo" && (
        <>
          <Grid min={movil ? 260 : 300} gap={12}>
            {deps.map((x) => {
              const u = d.ultimos?.[x.id];
              const abiertas = propuestas.filter((p) => p.departamento === x.id && p.estado === "propuesta").length;
              const enCurso = (d.historial || []).find((h: J) => h.departamento === x.id && h.estado === "trabajando");
              const est = x.estado === "trabajando" ? { t: (enCurso?.paso || "Trabajando") + "…", c: C.accent } : x.estado === "descansando" ? { t: "Descansando 😴 · " + (x.updated_at ? hace(x.updated_at) : ""), c: C.blue } : x.estado === "error" ? { t: "Error en el último trabajo", c: C.red }
                : x.ultimo_run_at ? { t: "Listo · " + hace(x.ultimo_run_at), c: C.green } : { t: x.activo ? "Aún no ha trabajado" : "Próximamente", c: C.muted };
              return (
                <div key={x.id} style={{ background: C.card, border: "1px solid " + (x.activo ? x.color + "55" : C.border), borderRadius: 14, padding: 14, opacity: x.activo ? 1 : 0.55, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: (x.color || C.accent) + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                      animation: x.estado === "trabajando" ? "oyLatidoIA 1.4s infinite" : "none" }}>{x.icono}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{x.nombre}</div>
                      <div style={{ fontSize: 12, color: est.c, fontWeight: 700 }}>{est.t}</div>
                    </div>
                    {u?.estado_general && <Pill texto={TXT_ESTADO[u.estado_general] || u.estado_general} color={COL_ESTADO[u.estado_general] || C.muted} />}
                  </div>
                  <div style={{ fontSize: 12.5, color: C.mutedL, lineHeight: 1.45 }}>{x.mision}</div>
                  {x.activo && u?.estado === "listo" && (
                    <div style={{ background: C.surface, borderRadius: 10, padding: "9px 11px", cursor: "pointer" }} onClick={() => setVerInforme(u)}>
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 3 }}>{u.titulo}</div>
                      <div style={{ fontSize: 12.5, color: C.mutedL, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{u.resumen}</div>
                    </div>
                  )}
                  {x.activo && u?.estado === "error" && <div style={{ fontSize: 12, color: C.red }}>{String(u.error || "").slice(0, 160)}</div>}
                  {x.activo && <ExtrasDep x={x} d={d} clave={clave} recargar={cargar} />}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "auto", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, color: C.muted, flex: 1 }}>{x.horario}</span>
                    {abiertas > 0 && <span style={{ fontSize: 11.5, color: C.accent, fontWeight: 800, cursor: "pointer" }} onClick={() => setPest("propuestas")}>{abiertas} propuesta{abiertas > 1 ? "s" : ""}</span>}
                    {x.activo && u?.estado === "listo" && <Btn small outline onClick={() => setVerInforme(u)}>Ver informe</Btn>}
                    {x.activo && <Btn small disabled={x.estado === "trabajando" || !!ocupado} onClick={() => lanzar(x.id)}>{x.estado === "trabajando" ? "Trabajando…" : "Trabajar ahora"}</Btn>}
                  </div>
                </div>
              );
            })}
          </Grid>
          <style>{`@keyframes oyLatidoIA{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
          <Marcador d={d} deps={deps} />

          <Titulo>Últimos trabajos</Titulo>
          <Card style={{ padding: 0 }}>
            {(d.historial || []).slice(0, 15).map((h: J) => (
              <div key={h.id} onClick={() => h.estado === "listo" && abrirInforme(h.id)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid " + C.border, cursor: h.estado === "listo" ? "pointer" : "default" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: h.estado === "error" ? C.red : h.estado === "trabajando" ? C.accent : h.estado === "descanso" ? C.blue : COL_ESTADO[h.estado_general] || C.muted, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: C.mutedL, width: 190, flexShrink: 0 }}>{nombreDep(h.departamento)}{h.tipo === "reunion" ? " · reunión" : ""}</span>
                <span style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.estado === "trabajando" ? "Trabajando…" : h.estado === "error" ? "Error" : h.estado === "descanso" ? "😴 " + (h.titulo || "Descanso") : h.titulo}</span>
                <span style={{ fontSize: 11.5, color: C.muted, flexShrink: 0 }}>{fechaHora(h.created_at)}</span>
              </div>
            ))}
            {!(d.historial || []).length && <div style={{ padding: 14, color: C.muted, fontSize: 13 }}>Todavía no hay trabajos. Pulsa "Trabajar ahora" en un departamento.</div>}
          </Card>
          <UsoMes d={d} deps={deps} />
        </>
      )}

      {pest === "oficina" && <Oficina d={d} lab={lab} clave={clave} recargar={cargar} abrir={(inf: J) => setVerInforme(inf)} irA={(p: Pestana) => setPest(p)}
        abrirChats={(c: string) => { try { localStorage.setItem("oy_chat_canal", c); } catch { /* nada */ } if (_props?.irA) _props.irA("chats"); }} />}
      {pest === "laboratorio" && <Laboratorio lab={lab} clave={clave} recargar={cargar} lanzar={lanzar} depPorId={depPorId} ocupado={ocupado} />}
      {pest === "propuestas" && <Propuestas propuestas={propuestas} nombreDep={nombreDep} deps={deps} decidir={decidir} />}
      {pest === "tablon" && <Tablon mensajes={mensajes} nombreDep={nombreDep} clave={clave} recargar={cargar} />}
      {pest === "reuniones" && <Reuniones reuniones={d.reuniones || []} nombreDep={nombreDep} lanzar={() => lanzar("direccion", "reunion")} trabajando={depPorId["direccion"]?.estado === "trabajando"} />}
      {pest === "cultura" && <Cultura cultura={d.cultura || []} clave={clave} recargar={cargar} />}

      {verInforme && (
        <Modal titulo={nombreDep(verInforme.departamento) + (verInforme.tipo === "reunion" ? " · Reunión" : " · Informe")} onClose={() => setVerInforme(null)} ancho={780}>
          {verInforme.tipo === "reunion" ? <Acta r={verInforme} nombreDep={nombreDep} /> : <Informe inf={verInforme} nombreDep={nombreDep} propuestas={propuestas} decidir={decidir} />}
        </Modal>
      )}
    </div>
  );
}

// ---------- piezas ----------
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: C.mutedL, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 }}>{titulo}</div>
      {children}
    </div>
  );
}
function ListaKpis({ kpis }: { kpis: J[] }) {
  if (!kpis?.length) return null;
  return (
    <Seccion titulo="Indicadores">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8 }}>
        {kpis.map((k: J, i: number) => (
          <div key={i} style={{ background: C.surface, borderRadius: 10, padding: "9px 11px" }}>
            <div style={{ fontSize: 11.5, color: C.mutedL }}>{k.nombre}</div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{k.valor}</div>
            {k.cambio && <div style={{ fontSize: 11.5, color: C.muted }}>{k.cambio}</div>}
            {k.lectura && <div style={{ fontSize: 11.5, color: C.mutedL, marginTop: 3, lineHeight: 1.35 }}>{k.lectura}</div>}
          </div>
        ))}
      </div>
    </Seccion>
  );
}
function TarjetaPropuesta({ p, nombreDep, decidir, compacta = false }: { p: J; nombreDep: (id: string) => string; decidir: (p: J, e: string) => void; compacta?: boolean }) {
  const [abierta, setAbierta] = useState(!compacta);
  const colEstado: Record<string, string> = { propuesta: C.accent, aprobada: C.blue, hecha: C.green, descartada: C.muted };
  return (
    <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 11, padding: "11px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }} onClick={() => setAbierta(!abierta)}>
        <span style={{ fontSize: 11, fontWeight: 800, color: p.prioridad === 1 ? C.red : p.prioridad === 3 ? C.muted : C.orange, border: "1px solid currentColor", borderRadius: 6, padding: "1px 6px", flexShrink: 0, marginTop: 2 }}>P{p.prioridad || 2}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>{p.titulo}</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
            {nombreDep(p.departamento)} · {fechaHora(p.created_at)}
            {p.impacto_eur_mes != null && <> · <b style={{ color: C.green }}>{eur(Number(p.impacto_eur_mes))}/mes</b></>}
            {p.esfuerzo && <> · esfuerzo {p.esfuerzo}</>}{p.confianza && <> · confianza {p.confianza}</>}
          </div>
        </div>
        <Pill texto={p.estado} color={colEstado[p.estado] || C.muted} />
      </div>
      {abierta && (
        <>
          {p.detalle && <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginTop: 8, whiteSpace: "pre-wrap" }}>{p.detalle}</div>}
          {p.nota_decision && <div style={{ fontSize: 12, color: C.mutedL, marginTop: 6 }}>Tu nota: {p.nota_decision}</div>}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {p.estado === "propuesta" && <><Btn small color={C.green} onClick={() => decidir(p, "aprobada")}>Aprobar</Btn><Btn small outline onClick={() => decidir(p, "descartada")}>Descartar</Btn></>}
            {p.estado === "aprobada" && <><Btn small color={C.green} onClick={() => decidir(p, "hecha")}>Marcar como hecha</Btn><Btn small outline onClick={() => decidir(p, "propuesta")}>Deshacer</Btn></>}
            {(p.estado === "descartada" || p.estado === "hecha") && <Btn small outline onClick={() => decidir(p, "propuesta")}>Reabrir</Btn>}
          </div>
        </>
      )}
    </div>
  );
}
function Informe({ inf, nombreDep, propuestas, decidir }: { inf: J; nombreDep: (id: string) => string; propuestas: J[]; decidir: (p: J, e: string) => void }) {
  const c = inf.contenido || {};
  const suyas = propuestas.filter((p) => p.informe_id === inf.id);
  return (
    <div style={{ fontFamily: F }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>{inf.titulo}</div>
        {inf.estado_general && <Pill texto={TXT_ESTADO[inf.estado_general] || inf.estado_general} color={COL_ESTADO[inf.estado_general] || C.muted} />}
      </div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{fechaHora(inf.created_at)}</div>
      {inf.resumen && <div style={{ marginTop: 10, padding: "10px 12px", background: C.accent + "12", border: "1px solid " + C.accent + "44", borderRadius: 10, fontSize: 13.5, lineHeight: 1.5 }}>{inf.resumen}</div>}
      {(c.alertas || []).length > 0 && (
        <Seccion titulo="Alertas">
          {c.alertas.map((a: J, i: number) => (
            <div key={i} style={{ fontSize: 13, padding: "8px 11px", borderRadius: 9, marginBottom: 6, background: (COL_NIVEL[a.nivel] || C.muted) + "14", borderLeft: "3px solid " + (COL_NIVEL[a.nivel] || C.muted), lineHeight: 1.45 }}>{a.texto}</div>
          ))}
        </Seccion>
      )}
      <ListaKpis kpis={c.kpis} />
      {(c.hallazgos || []).length > 0 && (
        <Seccion titulo="Lo que ha visto">
          {c.hallazgos.map((h: J, i: number) => (
            <div key={i} style={{ background: C.surface, borderRadius: 10, padding: "10px 12px", marginBottom: 7, borderLeft: "3px solid " + (COL_NIVEL[h.importancia] || C.muted) }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{h.titulo}</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginTop: 3 }}>{h.detalle}</div>
              {h.dato && <div style={{ fontSize: 12, color: C.mutedL, marginTop: 4 }}>📊 {h.dato}</div>}
            </div>
          ))}
        </Seccion>
      )}
      {suyas.length > 0 && <Seccion titulo="Sus propuestas">{suyas.map((p) => <TarjetaPropuesta key={p.id} p={p} nombreDep={nombreDep} decidir={decidir} />)}</Seccion>}
      {(c.mensajes || []).length > 0 && (
        <Seccion titulo="Ha pedido a otros departamentos">
          {c.mensajes.map((m: J, i: number) => <div key={i} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.45 }}>→ <b>{nombreDep(m.para)}</b>: {m.texto}</div>)}
        </Seccion>
      )}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 14 }}>{inf.modelo} · {num((inf.tokens_entrada || 0) + (inf.tokens_salida || 0))} tokens</div>
    </div>
  );
}
function Acta({ r, nombreDep }: { r: J; nombreDep: (id: string) => string }) {
  const c = r.contenido || {};
  return (
    <div style={{ fontFamily: F }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>{r.titulo}</div>
        {r.estado_general && <Pill texto={TXT_ESTADO[r.estado_general] || r.estado_general} color={COL_ESTADO[r.estado_general] || C.muted} />}
      </div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{fechaHora(r.created_at)}</div>
      {r.resumen && <div style={{ marginTop: 10, padding: "10px 12px", background: C.accent + "12", border: "1px solid " + C.accent + "44", borderRadius: 10, fontSize: 13.5, lineHeight: 1.5 }}>{r.resumen}</div>}
      {c.objetivo && (
        <Seccion titulo="Objetivo">
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{c.objetivo.semana_pasada && <div>📅 <b>Semana:</b> {c.objetivo.semana_pasada}</div>}{c.objetivo.mes && <div>🎯 <b>Mes:</b> {c.objetivo.mes}</div>}</div>
        </Seccion>
      )}
      <ListaKpis kpis={c.kpis} />
      {(c.logros || []).length > 0 && <Seccion titulo="Logros">{c.logros.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>✅ {x}</div>)}</Seccion>}
      {(c.problemas || []).length > 0 && <Seccion titulo="Problemas">{c.problemas.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>⚠️ {x}</div>)}</Seccion>}
      {(c.seguimiento_semana_anterior || []).length > 0 && (
        <Seccion titulo="Seguimiento de la semana anterior">
          {c.seguimiento_semana_anterior.map((s: J, i: number) => <div key={i} style={{ fontSize: 13, marginBottom: 5 }}><Pill texto={s.estado} color={s.estado === "hecha" ? C.green : s.estado === "en curso" ? C.orange : C.red} /> <b>{s.prioridad}</b> — {s.comentario}</div>)}
        </Seccion>
      )}
      {(c.prioridades || []).length > 0 && (
        <Seccion titulo="Prioridades de esta semana">
          {c.prioridades.map((p: J, i: number) => (
            <div key={i} style={{ background: C.surface, borderRadius: 10, padding: "10px 12px", marginBottom: 7 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{i + 1}. {p.titulo}</div>
              <div style={{ fontSize: 12, color: C.accent, marginTop: 2 }}>Responsable: {nombreDep(p.responsable)}</div>
              {p.por_que && <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>{p.por_que}</div>}
              {p.resultado_esperado && <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4 }}>🎯 {p.resultado_esperado}</div>}
            </div>
          ))}
        </Seccion>
      )}
      {(c.decisiones_para_andres || []).length > 0 && (
        <Seccion titulo="Decisiones que necesita de ti">
          {c.decisiones_para_andres.map((x: J, i: number) => (
            <div key={i} style={{ border: "1px solid " + C.accent + "66", borderRadius: 10, padding: "10px 12px", marginBottom: 7 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>❓ {x.pregunta}</div>
              {(x.opciones || []).length > 0 && <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4 }}>Opciones: {x.opciones.join(" · ")}</div>}
              {x.recomendacion && <div style={{ fontSize: 13, marginTop: 5 }}>👉 <b>Recomendación:</b> {x.recomendacion}</div>}
            </div>
          ))}
        </Seccion>
      )}
      {(c.por_departamento || []).length > 0 && (
        <Seccion titulo="Por departamento">
          {c.por_departamento.map((x: J, i: number) => <div key={i} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.45 }}><b>{nombreDep(x.departamento)}:</b> {x.resumen}</div>)}
        </Seccion>
      )}
    </div>
  );
}
function Propuestas({ propuestas, nombreDep, deps, decidir }: { propuestas: J[]; nombreDep: (id: string) => string; deps: J[]; decidir: (p: J, e: string) => void }) {
  const [estado, setEstado] = useState("propuesta");
  const [dep, setDep] = useState("");
  const lista = propuestas.filter((p) => (estado === "todas" || p.estado === estado) && (!dep || p.departamento === dep))
    .sort((a, b) => (a.prioridad || 2) - (b.prioridad || 2) || String(b.created_at).localeCompare(String(a.created_at)));
  const impacto = lista.reduce((s, p) => s + (Number(p.impacto_eur_mes) || 0), 0);
  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        {[["propuesta", "Pendientes"], ["aprobada", "Aprobadas"], ["hecha", "Hechas"], ["descartada", "Descartadas"], ["todas", "Todas"]].map(([k, l]) => (
          <button key={k} onClick={() => setEstado(k)} style={{ fontFamily: F, fontSize: 12.5, fontWeight: 800, padding: "6px 11px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (estado === k ? C.accent : C.border), background: estado === k ? C.accent + "22" : "transparent", color: estado === k ? C.accent : C.mutedL }}>
            {l} ({k === "todas" ? propuestas.length : propuestas.filter((p) => p.estado === k).length})
          </button>
        ))}
        <select value={dep} onChange={(e) => setDep(e.target.value)} style={{ marginLeft: "auto", background: C.surface, color: C.text, border: "1px solid " + C.border, borderRadius: 8, padding: "6px 9px", fontFamily: F, fontSize: 12.5 }}>
          <option value="">Todos los departamentos</option>
          {deps.filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.icono} {x.nombre}</option>)}
        </select>
      </div>
      {impacto > 0 && <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 10 }}>Impacto estimado de esta lista: <b style={{ color: C.green }}>{eur(impacto)}/mes</b></div>}
      {lista.map((p) => <TarjetaPropuesta key={p.id} p={p} nombreDep={nombreDep} decidir={decidir} compacta />)}
      {!lista.length && <Card><div style={{ color: C.muted, fontSize: 13 }}>No hay propuestas aquí.</div></Card>}
    </>
  );
}
function Tablon({ mensajes, nombreDep, clave, recargar }: { mensajes: J[]; nombreDep: (id: string) => string; clave: string; recargar: () => void }) {
  const resolver = async (id: number) => { await db.rpc("ia_mensaje_resolver", { p_clave: clave, p_id: id, p_respuesta: null }); recargar(); };
  return (
    <>
      <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 10 }}>Lo que se piden y se avisan los departamentos entre ellos. Cada uno lee sus mensajes antes de trabajar y responde.</div>
      {mensajes.map((m) => (
        <div key={m.id} style={{ background: C.card, border: "1px solid " + (m.estado === "abierto" ? C.accent + "55" : C.border), borderRadius: 11, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
            <b>{nombreDep(m.de)}</b><span style={{ color: C.muted }}>→</span><b>{nombreDep(m.para)}</b>
            <Pill texto={m.tipo === "aviso" ? "aviso" : "petición"} color={m.tipo === "aviso" ? C.blue : C.orange} />
            <span style={{ marginLeft: "auto", color: C.muted, fontSize: 11.5 }}>{fechaHora(m.created_at)}</span>
          </div>
          <div style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>{m.texto}</div>
          {m.respuesta && <div style={{ fontSize: 13, marginTop: 6, color: C.green, lineHeight: 1.45 }}>↳ {m.respuesta}</div>}
          {m.estado === "abierto" && <div style={{ marginTop: 8 }}><Btn small outline onClick={() => resolver(m.id)}>Marcar resuelto</Btn></div>}
        </div>
      ))}
      {!mensajes.length && <Card><div style={{ color: C.muted, fontSize: 13 }}>Aún no hay mensajes entre departamentos.</div></Card>}
    </>
  );
}
function Reuniones({ reuniones, nombreDep, lanzar, trabajando }: { reuniones: J[]; nombreDep: (id: string) => string; lanzar: () => void; trabajando: boolean }) {
  const listas = reuniones.filter((r) => r.estado === "listo");
  const [sel, setSel] = useState<number>(0);
  const r = listas[sel];
  return (
    <>
      <Card>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, fontSize: 13, color: C.mutedL, lineHeight: 1.5 }}>Cada <b style={{ color: C.text }}>lunes a las 9:00</b> la Dirección general reúne lo que han visto todos los departamentos y deja el acta: cómo fue la semana, prioridades y decisiones que necesita de ti.</div>
          <Btn small disabled={trabajando} onClick={lanzar}>{trabajando ? "Reunidos…" : "Hacer reunión ahora"}</Btn>
        </div>
        {listas.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {listas.map((x, i) => <button key={x.id} onClick={() => setSel(i)} style={{ fontFamily: F, fontSize: 12, padding: "5px 9px", borderRadius: 7, cursor: "pointer", border: "1px solid " + (i === sel ? C.accent : C.border), background: i === sel ? C.accent + "22" : "transparent", color: i === sel ? C.accent : C.mutedL }}>{fechaHora(x.created_at)}</button>)}
          </div>
        )}
      </Card>
      {r ? <Card><Acta r={r} nombreDep={nombreDep} /></Card> : <Card><div style={{ color: C.muted, fontSize: 13 }}>Todavía no hay ninguna reunión. La primera será el lunes, o pulsa "Hacer reunión ahora".</div></Card>}
    </>
  );
}
function Cultura({ cultura, clave, recargar }: { cultura: J[]; clave: string; recargar: () => void }) {
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const guardar = async (k: string) => {
    const { error } = await db.rpc("ia_cultura_guardar", { p_clave: clave, p_cultura: k, p_contenido: edit[k] });
    if (error) { setMsg(error.message); return; }
    setMsg("Guardado. Todos los departamentos lo leerán en su próximo trabajo.");
    const n = { ...edit }; delete n[k]; setEdit(n); recargar();
  };
  return (
    <>
      <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 10 }}>Esto es lo que cada IA lee antes de trabajar. Cámbialo cuando quieras: es la forma de enseñarles cómo quieres que trabajen.</div>
      {msg && <div style={{ marginBottom: 10, fontSize: 13, color: C.green }}>{msg}</div>}
      {cultura.map((c) => (
        <Card key={c.clave}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>{c.titulo}</div>
            {edit[c.clave] === undefined ? <Btn small outline onClick={() => setEdit({ ...edit, [c.clave]: c.contenido })}>Editar</Btn>
              : <><Btn small onClick={() => guardar(c.clave)}>Guardar</Btn><Btn small outline onClick={() => { const n = { ...edit }; delete n[c.clave]; setEdit(n); }}>Cancelar</Btn></>}
          </div>
          {edit[c.clave] === undefined ? <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: C.text }}>{c.contenido}</div>
            : <textarea value={edit[c.clave]} onChange={(e) => setEdit({ ...edit, [c.clave]: e.target.value })} rows={10}
                style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.text, padding: 10, fontFamily: F, fontSize: 13, lineHeight: 1.55 }} />}
        </Card>
      ))}
    </>
  );
}
function UsoMes({ d, deps }: { d: J; deps: J[] }) {
  const u = d.uso_mes || {};
  const ids = Object.keys(u);
  if (!ids.length) return null;
  const tot = ids.reduce((s, k) => ({ inf: s.inf + Number(u[k].informes || 0), te: s.te + Number(u[k].tokens_entrada || 0), ts: s.ts + Number(u[k].tokens_salida || 0) }), { inf: 0, te: 0, ts: 0 });
  return (
    <div style={{ fontSize: 12, color: C.muted, marginTop: 12, lineHeight: 1.6 }}>
      Uso este mes: {num(tot.inf)} trabajos · {num(tot.te)} tokens leídos · {num(tot.ts)} tokens escritos
      {" "}({ids.map((k) => (deps.find((x) => x.id === k)?.icono || "") + " " + num(u[k].informes)).join(" · ")}). El coste exacto lo ves en console.anthropic.com.
    </div>
  );
}

// ---------- LABORATORIO DE MARKETING ----------
const EST_EXP: Record<string, { t: string; c: string }> = {
  debate: { t: "En debate", c: C.orange }, propuesto: { t: "Lista para decidir", c: C.accent }, aprobado: { t: "Aprobada · falta aplicarla", c: C.blue },
  en_curso: { t: "En curso", c: C.green }, ganador: { t: "Ganadora", c: C.green }, perdedor: { t: "No funcionó", c: C.red },
  sin_concluir: { t: "Sin concluir", c: C.muted }, revertido: { t: "Revertida", c: C.muted }, descartado: { t: "Descartada", c: C.muted },
};
const COL_DE: Record<string, string> = { marketing: C.blue, supervisor: "#A78BFA", andres: C.accent };
const NOM_DE: Record<string, string> = { marketing: "📣 Marketing", supervisor: "🔍 Supervisor", andres: "👤 Tú" };
function Debate({ debate }: { debate: J[] }) {
  if (!debate?.length) return null;
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      {debate.map((m: J, i: number) => (
        <div key={i} style={{ alignSelf: m.de === "marketing" ? "flex-start" : "flex-end", maxWidth: "88%", background: (COL_DE[m.de] || C.muted) + "18", border: "1px solid " + (COL_DE[m.de] || C.muted) + "44", borderRadius: 10, padding: "8px 11px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: COL_DE[m.de] || C.muted, marginBottom: 3 }}>
            {NOM_DE[m.de] || m.de}{m.veredicto ? " · " + m.veredicto : ""}{m.sin_consenso ? " · sin consenso, decides tú" : ""}
            <span style={{ fontWeight: 400, color: C.muted, marginLeft: 6 }}>{m.fecha ? fechaHora(m.fecha) : ""}</span>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.texto}</div>
        </div>
      ))}
    </div>
  );
}
function Campo2({ l, v }: { l: string; v: any }) {
  if (v === null || v === undefined || v === "") return null;
  const txt = typeof v === "object" ? Object.entries(v).map(([k, x]) => k + ": " + (typeof x === "object" ? JSON.stringify(x) : x)).join(" · ") : String(v);
  return <div style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 4 }}><b style={{ color: C.mutedL }}>{l}:</b> {txt}</div>;
}
function TarjetaExperimento({ e, accion, abierta: abiertaIni = false }: { e: J; accion: (e: J, estado: string, pedirNota?: boolean) => void; abierta?: boolean }) {
  const [abierta, setAbierta] = useState(abiertaIni);
  const est = EST_EXP[e.estado] || { t: e.estado, c: C.muted };
  const riesgoCol = e.riesgo_aprendizaje === "ninguno" || e.riesgo_aprendizaje === "bajo" ? C.green : e.riesgo_aprendizaje === "medio" ? C.orange : C.red;
  const diasTot = Number(e.duracion_dias) || 7;
  const diasPas = e.inicio ? Math.max(0, Math.min(diasTot, Math.round((Date.now() - new Date(e.inicio).getTime()) / 86400000))) : 0;
  return (
    <div style={{ background: C.card, border: "1px solid " + est.c + "55", borderRadius: 12, padding: "12px 13px", marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }} onClick={() => setAbierta(!abierta)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.35 }}>{e.titulo}</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>
            {e.campana || "—"} · {e.tipo || "—"} · {e.duracion_dias || 7} días
            {e.riesgo_aprendizaje && <> · <b style={{ color: riesgoCol }}>riesgo para el aprendizaje: {e.riesgo_aprendizaje}</b></>}
          </div>
        </div>
        <Pill texto={est.t} color={est.c} />
      </div>
      {e.estado === "en_curso" && (
        <div style={{ marginTop: 9 }}>
          <div style={{ height: 6, background: C.bg, borderRadius: 99, overflow: "hidden" }}><div style={{ width: (100 * diasPas / diasTot) + "%", height: "100%", background: C.green }} /></div>
          <div style={{ fontSize: 11.5, color: C.mutedL, marginTop: 4 }}>Día {diasPas} de {diasTot} · desde {e.inicio}{e.fin ? " hasta " + e.fin : ""}</div>
        </div>
      )}
      {abierta && (
        <>
          <Campo2 l="Hipótesis" v={e.hipotesis} />
          <Campo2 l="Qué se cambia" v={e.cambio} />
          <Campo2 l="Cómo aplicarlo" v={e.como_aplicarlo} />
          <Campo2 l="Métrica" v={e.metrica_principal} />
          <Campo2 l="Línea base" v={e.linea_base} />
          <Campo2 l="Éxito si" v={e.criterio_exito} />
          <Campo2 l="Volver atrás" v={e.plan_reversion} />
          {e.resultado && <Campo2 l="Resultado" v={e.resultado} />}
          {e.conclusion && <Campo2 l="Conclusión" v={e.conclusion} />}
          {e.aprendizaje && <div style={{ marginTop: 8, padding: "8px 11px", borderRadius: 9, background: C.green + "14", border: "1px solid " + C.green + "44", fontSize: 12.5 }}>📚 Aprendizaje guardado: {e.aprendizaje}</div>}
          <Debate debate={e.debate} />
        </>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {(e.estado === "propuesto" || e.estado === "debate") && <><Btn small color={C.green} onClick={() => accion(e, "aprobado")}>Aprobar</Btn><Btn small outline onClick={() => accion(e, "descartado", true)}>Descartar</Btn></>}
        {e.estado === "aprobado" && <><Btn small color={C.green} onClick={() => accion(e, "en_curso")}>Ya lo he aplicado: empieza</Btn><Btn small outline onClick={() => accion(e, "descartado", true)}>Descartar</Btn></>}
        {e.estado === "en_curso" && <Btn small outline onClick={() => accion(e, "revertido", true)}>Volver atrás ahora</Btn>}
        {e.estado === "perdedor" && <Btn small onClick={() => accion(e, "revertido")}>Ya lo he revertido</Btn>}
        {!abierta && <Btn small outline onClick={() => setAbierta(true)}>Ver detalle y debate</Btn>}
      </div>
    </div>
  );
}
function Laboratorio({ lab, clave, recargar, lanzar, depPorId, ocupado }: { lab: J | null; clave: string; recargar: () => void; lanzar: (dep: string, modo?: string) => void; depPorId: Record<string, J>; ocupado: string }) {
  const [vista, setVista] = useState<"pruebas" | "biblioteca">("pruebas");
  const [editK, setEditK] = useState<J | null>(null);
  if (!lab) return <Card><div style={{ color: C.muted, fontSize: 13 }}>Cargando el laboratorio…</div></Card>;
  const exps: J[] = lab.experimentos || [];
  const accion = async (e: J, estado: string, pedirNota = false) => {
    let nota: string | null = null;
    if (pedirNota) { nota = window.prompt(estado === "descartado" ? "¿Por qué la descartas? (ayuda a que aprendan)" : "¿Por qué vuelves atrás? (opcional)") ; if (nota === null && estado === "descartado") return; }
    const { error } = await db.rpc("ia_experimento_estado", { p_clave: clave, p_id: e.id, p_estado: estado, p_nota: nota || null });
    if (error) { alert(error.message); return; }
    recargar();
  };
  const enCurso = exps.filter((e) => e.estado === "en_curso");
  const decidir = exps.filter((e) => ["propuesto", "aprobado", "debate"].includes(e.estado));
  const resultados = exps.filter((e) => ["ganador", "perdedor", "sin_concluir", "revertido", "descartado"].includes(e.estado));
  const k: J[] = lab.conocimiento || [];
  const trabajandoMkt = depPorId["marketing"]?.estado === "trabajando", trabajandoSup = depPorId["supervisor"]?.estado === "trabajando";
  const guardarK = async () => {
    if (!editK) return;
    const { error } = await db.rpc("ia_conocimiento_guardar", { p_clave: clave, p_id: editK.id || null, p_tipo: editK.tipo, p_titulo: editK.titulo, p_detalle: editK.detalle || "", p_activo: editK.activo !== false });
    if (error) { alert(error.message); return; }
    setEditK(null); recargar();
  };
  return (
    <>
      <Card>
        <div style={{ fontSize: 13, color: C.mutedL, lineHeight: 1.55 }}>
          Cada <b style={{ color: C.text }}>domingo</b> Marketing evalúa la prueba de la semana y propone la siguiente; el <b style={{ color: C.text }}>Supervisor</b> la revisa y debaten (hasta dos rondas). El lunes decides tú: apruebas, la aplicas y pulsas "empieza". Una sola prueba por semana, sin reiniciar el aprendizaje y siempre con plan para volver atrás. Lo que funciona y lo que no se guarda en la biblioteca.
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          <Btn small disabled={trabajandoMkt || !!ocupado} onClick={() => lanzar("marketing", "experimento")}>{trabajandoMkt ? "Marketing trabajando…" : "1 · Marketing: evaluar y proponer"}</Btn>
          <Btn small outline disabled={trabajandoSup || !!ocupado} onClick={() => lanzar("supervisor", "revision")}>{trabajandoSup ? "Supervisor revisando…" : "2 · Supervisor: revisar"}</Btn>
          <Btn small outline disabled={trabajandoMkt || !!ocupado} onClick={() => lanzar("marketing", "replica")}>3 · Marketing: responder</Btn>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {([["pruebas", "Pruebas"], ["biblioteca", "Biblioteca de aprendizajes (" + k.filter((x) => x.activo).length + ")"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)} style={{ fontFamily: F, fontSize: 12.5, fontWeight: 800, padding: "6px 11px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (vista === v ? C.accent : C.border), background: vista === v ? C.accent + "22" : "transparent", color: vista === v ? C.accent : C.mutedL }}>{l}</button>
        ))}
      </div>
      {vista === "pruebas" && (
        <>
          <Titulo>En curso</Titulo>
          {enCurso.length ? enCurso.map((e) => <TarjetaExperimento key={e.id} e={e} accion={accion} />) : <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>No hay ninguna prueba en marcha.</div>}
          <Titulo>Para decidir</Titulo>
          {decidir.length ? decidir.map((e) => <TarjetaExperimento key={e.id} e={e} accion={accion} abierta={e.estado === "propuesto"} />) : <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Nada pendiente. La próxima propuesta llega el domingo.</div>}
          <Titulo>Resultados</Titulo>
          {resultados.length ? resultados.map((e) => <TarjetaExperimento key={e.id} e={e} accion={accion} />) : <div style={{ fontSize: 13, color: C.muted }}>Aún no hay resultados.</div>}
        </>
      )}
      {vista === "biblioteca" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}><Btn small onClick={() => setEditK({ tipo: "minimo", titulo: "", detalle: "", activo: true })}>Añadir regla o aprendizaje</Btn></div>
          {([["minimo", "Mínimos (lo que ya sabemos y no se discute)", C.accent], ["aprendizaje", "Aprendizajes (lo que ha funcionado)", C.green], ["error", "Errores (lo que no funcionó y por qué)", C.red]] as const).map(([t, l, col]) => {
            const lista = k.filter((x) => x.tipo === t);
            return (
              <div key={t} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: col, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{l} · {lista.length}</div>
                {lista.map((x) => (
                  <div key={x.id} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "9px 11px", marginBottom: 6, opacity: x.activo ? 1 : 0.5 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800 }}>{x.titulo}</div>
                        {x.detalle && <div style={{ fontSize: 12.5, color: C.mutedL, lineHeight: 1.5, marginTop: 2 }}>{x.detalle}</div>}
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{x.fuente === "andres" ? "De Andrés" : x.fuente?.startsWith("experimento") ? "De un experimento" : x.fuente} · {fechaHora(x.created_at)}{x.activo ? "" : " · desactivado"}</div>
                      </div>
                      <Btn small outline onClick={() => setEditK({ ...x })}>Editar</Btn>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
      {editK && (
        <Modal titulo={editK.id ? "Editar" : "Añadir a la biblioteca"} onClose={() => setEditK(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: F }}>
            <select value={editK.tipo} onChange={(e) => setEditK({ ...editK, tipo: e.target.value })} style={{ background: C.surface, color: C.text, border: "1px solid " + C.border, borderRadius: 8, padding: "8px 10px", fontFamily: F }}>
              <option value="minimo">Mínimo (regla fija)</option><option value="aprendizaje">Aprendizaje</option><option value="error">Error</option>
            </select>
            <input value={editK.titulo} onChange={(e) => setEditK({ ...editK, titulo: e.target.value })} placeholder="Título" style={{ background: C.surface, color: C.text, border: "1px solid " + C.border, borderRadius: 8, padding: "8px 10px", fontFamily: F, fontSize: 13.5 }} />
            <textarea value={editK.detalle || ""} onChange={(e) => setEditK({ ...editK, detalle: e.target.value })} rows={5} placeholder="Detalle" style={{ background: C.surface, color: C.text, border: "1px solid " + C.border, borderRadius: 8, padding: "8px 10px", fontFamily: F, fontSize: 13 }} />
            <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={editK.activo !== false} onChange={(e) => setEditK({ ...editK, activo: e.target.checked })} /> Activo (lo leen las IAs)</label>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><Btn small outline onClick={() => setEditK(null)}>Cancelar</Btn><Btn small onClick={guardarK}>Guardar</Btn></div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------- objetivos, energía y marcador ----------
function progresoObjetivo(o: J) {
  const a = Number(o.actual), ob = Number(o.objetivo);
  if (o.actual == null || isNaN(a)) return 0;
  if (o.sentido === "subir") return ob > 0 ? Math.min(1, a / ob) : 1;
  if (a <= ob) return 1;
  return ob > 0 ? Math.min(1, ob / a) : Math.max(0.04, 1 - Math.min(1, a / 30));
}
const fmtVal = (v: any, u?: string) => (v == null || v === "" ? "—" : (u === "€" ? eur(Number(v), Number(v) < 100 ? 2 : 0) : num(Number(v), 2) + (u ? " " + u : "")));
function ExtrasDep({ x, d, clave, recargar }: { x: J; d: J; clave: string; recargar: () => void }) {
  const objs: J[] = (d.objetivos || []).filter((o: J) => o.departamento === x.id);
  const m = d.marcador?.[x.id];
  const u = d.uso_mes?.[x.id];
  const usado = u ? Number(u.tokens_entrada || 0) + Number(u.tokens_salida || 0) : 0;
  const tope = Number(x.energia_tokens_mes) || 1500000;
  const energia = Math.max(0, 1 - usado / tope);
  const editarObj = async (o: J) => {
    const v = window.prompt(`Nuevo objetivo para "${o.titulo}" (${o.sentido === "subir" ? "llegar a" : "bajar a"}, en ${o.unidad || ""})`, String(o.objetivo ?? ""));
    if (v === null || v.trim() === "") return;
    const { error } = await db.rpc("ia_objetivo_guardar", { p_clave: clave, p_id: o.id, p_objetivo: Number(v.replace(",", ".")), p_activo: true });
    if (error) alert(error.message); else recargar();
  };
  const editarEnergia = async () => {
    const v = window.prompt("Energía del mes (tope de tokens). Ahora: " + tope.toLocaleString("es-ES"), String(tope));
    if (v === null) return;
    const { error } = await db.rpc("ia_energia_guardar", { p_clave: clave, p_dep: x.id, p_tokens: parseInt(v.replace(/\D/g, ""), 10) });
    if (error) alert(error.message); else recargar();
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {objs.length > 0 && (
        <div style={{ background: C.surface, borderRadius: 10, padding: "8px 10px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.mutedL, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>🎯 Objetivos</div>
          {objs.map((o) => {
            const p = progresoObjetivo(o);
            const col = o.cumplido ? C.green : p >= 0.7 ? C.orange : C.red;
            return (
              <div key={o.id} style={{ marginBottom: 6, cursor: "pointer" }} onClick={() => editarObj(o)} title="Pulsa para cambiar el objetivo">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 6 }}>
                  <span style={{ color: C.text }}>{o.cumplido ? "✓ " : ""}{o.titulo}</span>
                  <b style={{ color: col, whiteSpace: "nowrap" }}>{fmtVal(o.actual, o.unidad)} <span style={{ color: C.muted, fontWeight: 400 }}>/ {fmtVal(o.objetivo, o.unidad)}</span></b>
                </div>
                <div style={{ height: 5, background: C.bg, borderRadius: 99, overflow: "hidden", marginTop: 3 }}><div style={{ width: Math.max(3, p * 100) + "%", height: "100%", background: col }} /></div>
                {o.fecha_limite && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>antes del {String(o.fecha_limite).slice(8, 10)}/{String(o.fecha_limite).slice(5, 7)}</div>}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 120, cursor: "pointer" }} onClick={editarEnergia} title="Energía del mes: pulsa para cambiar el tope">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.mutedL }}><span>⚡ Energía del mes</span><b style={{ color: energia > 0.3 ? C.green : energia > 0.1 ? C.orange : C.red }}>{Math.round(energia * 100)}%</b></div>
          <div style={{ height: 5, background: C.bg, borderRadius: 99, overflow: "hidden", marginTop: 3 }}><div style={{ width: energia * 100 + "%", height: "100%", background: energia > 0.3 ? C.green : energia > 0.1 ? C.orange : C.red }} /></div>
        </div>
        {m && <span style={{ fontSize: 12, fontWeight: 800, color: C.accent }}>🏅 {num(m.puntos)} pts</span>}
      </div>
      {m?.medallas?.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{m.medallas.map((t: string, i: number) => <span key={i} style={{ fontSize: 11, background: C.accent + "18", border: "1px solid " + C.accent + "44", borderRadius: 99, padding: "2px 8px" }}>{t}</span>)}</div>}
    </div>
  );
}
function Marcador({ d, deps }: { d: J; deps: J[] }) {
  const filas = deps.filter((x) => x.activo && d.marcador?.[x.id]).map((x) => ({ x, m: d.marcador[x.id] })).sort((a, b) => b.m.puntos - a.m.puntos);
  if (!filas.length) return null;
  return (
    <>
      <Titulo>🏆 Marcador del equipo</Titulo>
      <Card style={{ padding: 0 }}>
        {filas.map(({ x, m }, i) => (
          <div key={x.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid " + C.border }}>
            <span style={{ width: 22, fontSize: 15, fontWeight: 800, color: i === 0 ? C.accent : C.mutedL }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, width: 210, flexShrink: 0 }}>{x.icono} {x.nombre}</span>
            <span style={{ fontSize: 12, color: C.mutedL, flex: 1 }}>{m.propuestas_aprobadas + m.propuestas_hechas} propuestas aprobadas · {m.mensajes_respondidos} mensajes respondidos · {m.objetivos_cumplidos} objetivos cumplidos {m.medallas?.length ? "· " + m.medallas.join(" ") : ""}</span>
            <b style={{ fontSize: 15, color: C.accent }}>{num(m.puntos)}</b>
          </div>
        ))}
        <div style={{ padding: "9px 14px", fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
          Puntos por resultados reales: +1 por informe, +10 por propuesta que apruebas, +20 si se hace, +2 por mensaje respondido, +100 por objetivo cumplido. Marketing: +50 por prueba ganadora y +15 por perdedora (el error también enseña). Supervisor: +5 por revisión y +15 cuando Marketing acepta sus correcciones. Cada IA ve el marcador y los motivos por los que descartas sus propuestas antes de trabajar.
        </div>
      </Card>
    </>
  );
}

// ---------- OFICINA ----------
const PERSONAJE: Record<string, string> = { direccion: "🧑‍💼", marketing: "👩‍💻", supervisor: "🕵️", ciberseguridad: "👨‍💻", expansion: "🧑‍🚀", captacion: "🤝", operaciones: "🧑‍🔧", finanzas: "👩‍💼", producto: "🧑‍🎨" };
// Turnos en hora del servidor (UTC). Días: 0 = domingo.
const TURNOS: Record<string, { dias: number[]; h: number; m: number; tarea: string }[]> = {
  ciberseguridad: [{ dias: [1, 2, 3, 4, 5, 6], h: 6, m: 0, tarea: "Revisión de seguridad" }],
  marketing: [{ dias: [1, 2, 3, 4, 5, 6], h: 6, m: 20, tarea: "Informe diario" }, { dias: [0], h: 9, m: 0, tarea: "Laboratorio: evaluar y proponer" }, { dias: [0], h: 10, m: 0, tarea: "Laboratorio: responder al Supervisor" }],
  supervisor: [{ dias: [1, 2, 3, 4, 5, 6], h: 6, m: 40, tarea: "Revisión diaria" }, { dias: [0], h: 9, m: 30, tarea: "Laboratorio: revisar" }, { dias: [0], h: 10, m: 30, tarea: "Laboratorio: veredicto" }],
  direccion: [{ dias: [2, 3, 4, 5, 6], h: 7, m: 0, tarea: "Informe de dirección" }, { dias: [1], h: 8, m: 0, tarea: "Reunión semanal" }],
};
const QUE_HACE: Record<string, string> = { diario: "Analizando sus datos", reunion: "En la reunión semanal", experimento: "Diseñando la prueba de la semana", revision: "Revisando el trabajo de Marketing", replica: "Respondiendo al Supervisor" };
const TZ_M = "Europe/Madrid";
function proximoTurno(id: string, ahora: Date) {
  const t = TURNOS[id];
  if (!t) return null;
  let mejor: { fecha: Date; tarea: string } | null = null;
  for (let k = 0; k < 8; k++) {
    const dia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + k));
    for (const x of t) {
      if (!x.dias.includes(dia.getUTCDay())) continue;
      const f = new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), x.h, x.m));
      if (f > ahora && (!mejor || f < mejor.fecha)) mejor = { fecha: f, tarea: x.tarea };
    }
  }
  return mejor;
}
const horaM = (f: Date, opts: Intl.DateTimeFormatOptions) => f.toLocaleString("es-ES", { timeZone: TZ_M, ...opts });
function falta(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " h " + (m % 60) + " min";
  return Math.floor(h / 24) + " d " + (h % 24) + " h";
}
function Oficina({ d, lab, clave, recargar, abrir, irA, abrirChats }: { d: J; lab: J | null; clave: string; recargar: () => void; abrir: (inf: J) => void; irA: (p: Pestana) => void; abrirChats: (canal: string) => void }) {
  const [ahora, setAhora] = useState(new Date());
  const [aviso, setAviso] = useState("");
  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 4000); return () => clearTimeout(t); }, [aviso]);
  const deps: J[] = d.departamentos || [];
  const hist: J[] = d.historial || [];
  const msgs: J[] = d.mensajes || [];
  const hM = Number(horaM(ahora, { hour: "2-digit", hour12: false }));
  const cerrada = hM < 7 || hM >= 21;
  const nombreDep = (id: string) => { const x = deps.find((y) => y.id === id); return x ? x.icono + " " + x.nombre : id; };
  const hoyM = horaM(ahora, { year: "numeric", month: "2-digit", day: "2-digit" });
  const cafeHoy = (x: J) => x.cafe_ultimo && horaM(new Date(x.cafe_ultimo), { year: "numeric", month: "2-digit", day: "2-digit" }) === hoyM;
  const invitar = async (x: J, trabajar: boolean) => {
    const { data, error } = await db.rpc("ia_cafe", { p_clave: clave, p_dep: x.id, p_trabajar: trabajar });
    setAviso(error ? error.message : "☕ " + x.nombre + ": " + data);
    recargar();
  };
  const dir = deps.find((x) => x.id === "direccion");
  const reunionEnCurso = dir?.estado === "trabajando" && hist.find((h) => h.departamento === "direccion" && h.estado === "trabajando")?.tipo === "reunion";
  const proxReunion = proximoTurno("direccion", ahora);
  let lunes = proxReunion;
  for (let k = 0; k < 8 && lunes && lunes.tarea !== "Reunión semanal"; k++) lunes = proximoTurno("direccion", new Date(lunes.fecha.getTime() + 60000));
  const objMes = (d.objetivos || []).find((o: J) => o.metrica === "ingresos_mes");
  const exps: J[] = lab?.experimentos || [];
  const expActivo = exps.find((e) => e.estado === "en_curso") || exps.find((e) => ["propuesto", "aprobado", "debate"].includes(e.estado));
  const ultimaReunion = (d.reuniones || [])[0];

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        @keyframes ofBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes ofZzz{0%{opacity:0;transform:translate(0,0) scale(.7)}30%{opacity:1}100%{opacity:0;transform:translate(14px,-22px) scale(1.1)}}
        @keyframes ofVapor{0%{opacity:0;transform:translateY(0)}40%{opacity:.8}100%{opacity:0;transform:translateY(-12px)}}
        @keyframes ofCursor{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes ofPunto{0%,80%,100%{opacity:.25}40%{opacity:1}}
        @keyframes ofParpadeo{0%,100%{opacity:1}50%{opacity:.35}}
      `}</style>

      {/* Cabecera con el reloj rojo */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: "linear-gradient(180deg,#151a26,#0f131c)", border: "1px solid " + C.border, borderRadius: 14, padding: "14px 18px", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🏢 Oficina de OficioYa</div>
          {Number(d.preguntas_pendientes) > 0 && (
            <button onClick={() => abrirChats("equipo")} style={{ marginTop: 6, fontFamily: F, fontSize: 12.5, fontWeight: 800, padding: "5px 11px", borderRadius: 99, border: "1px solid " + C.orange, background: C.orange + "22", color: C.orange, cursor: "pointer", animation: "ofParpadeo 1.6s infinite" }}>
              💬 {d.preguntas_pendientes} pregunta{Number(d.preguntas_pendientes) > 1 ? "s" : ""} del equipo para ti
            </button>
          )}
          <div style={{ fontSize: 12.5, color: cerrada ? C.blue : C.green, fontWeight: 700, marginTop: 3 }}>
            {cerrada ? "🌙 Oficina cerrada · el equipo vuelve a las 7:00" : ahora.getDay() === 0 ? "☀️ Domingo: solo trabaja el laboratorio" : "☀️ Jornada en marcha"}
          </div>
        </div>
        <div style={{ textAlign: "center", background: "#0a0000", border: "2px solid #3a0d0d", borderRadius: 12, padding: "6px 16px", boxShadow: "inset 0 0 18px #ff1a1a22" }}>
          <div style={{ fontFamily: "'Courier New',monospace", fontSize: 34, fontWeight: 800, color: "#FF2B2B", letterSpacing: 3, textShadow: "0 0 10px #ff1a1a99, 0 0 22px #ff1a1a55", lineHeight: 1.1 }}>
            {horaM(ahora, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </div>
          <div style={{ fontSize: 11, color: "#ff6b6b", textTransform: "capitalize", letterSpacing: 0.5 }}>{horaM(ahora, { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
      </div>

      {aviso && <div style={{ marginBottom: 10, padding: "9px 12px", borderRadius: 9, background: C.accent + "18", border: "1px solid " + C.accent + "55", fontSize: 13 }}>{aviso}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
        {/* Mesas */}
        <div style={{ position: "relative", background: "repeating-linear-gradient(45deg,#121722,#121722 22px,#131926 22px,#131926 44px)", border: "1px solid " + C.border, borderRadius: 14, padding: 12 }}>
          {cerrada && <div style={{ position: "absolute", inset: 0, background: "#05070dcc", borderRadius: 14, zIndex: 1, pointerEvents: "none" }} />}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12, position: "relative" }}>
            {deps.map((x) => {
              const trabajando = x.estado === "trabajando";
              const durmiendo = x.estado === "descansando" || (!trabajando && cerrada && x.activo);
              const actual = hist.find((h) => h.departamento === x.id && h.estado === "trabajando");
              const ultimo = d.ultimos?.[x.id];
              const prox = proximoTurno(x.id, ahora);
              const dijo = msgs.find((m) => m.de === x.id && Date.now() - new Date(m.created_at).getTime() < 36 * 3600000);
              const pantalla = !x.activo ? "Puesto vacante · próximamente"
                : trabajando ? (actual?.paso || QUE_HACE[actual?.tipo] || "Trabajando") + (x.cafe_pendiente && !actual?.paso ? " a fondo ☕" : "")
                : x.estado === "error" ? "⚠️ Algo falló en su último trabajo"
                : durmiendo ? "Descansando"
                : ultimo?.titulo ? "✔ " + ultimo.titulo : "Esperando su turno";
              return (
                <div key={x.id} onClick={() => x.activo && ultimo?.estado === "listo" && abrir(ultimo)} style={{ background: "#1a2030", border: "1px solid " + (x.activo ? (x.color || C.accent) + "66" : C.border), borderRadius: 12, padding: 10, cursor: x.activo && ultimo ? "pointer" : "default", opacity: x.activo ? 1 : 0.5, position: "relative", minHeight: 210 }}>
                  {/* Monitor */}
                  <div style={{ background: "#05080f", border: "3px solid #2b3245", borderRadius: 8, padding: "7px 9px", minHeight: 50, fontFamily: "'Courier New',monospace", fontSize: 11.5, color: trabajando ? "#7CFFB2" : x.estado === "error" ? "#ff6b6b" : "#9fb3d1", lineHeight: 1.35 }}>
                    <div style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {pantalla}
                      {trabajando && <span style={{ marginLeft: 2 }}>{[0, 1, 2].map((i) => <span key={i} style={{ animation: `ofPunto 1.2s ${i * 0.2}s infinite` }}>.</span>)}</span>}
                      {trabajando && !actual?.progreso && <span style={{ animation: "ofCursor 1s infinite" }}>▌</span>}
                    </div>
                    {trabajando && actual?.progreso && (
                      <div style={{ marginTop: 4, color: "#e8f5ee", fontSize: 11, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        «…{String(actual.progreso).slice(-150)}<span style={{ animation: "ofCursor 1s infinite" }}>▌</span>»
                      </div>
                    )}
                  </div>
                  <div style={{ width: 26, height: 8, background: "#2b3245", margin: "0 auto", borderRadius: "0 0 4px 4px" }} />
                  {/* Persona y mesa */}
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 6, marginTop: 6, position: "relative", height: 62 }}>
                    <div style={{ fontSize: 44, lineHeight: 1, animation: trabajando ? "ofBob .9s infinite" : "none", transform: durmiendo ? "rotate(-12deg)" : "none", filter: x.activo ? "none" : "grayscale(1)" }}>{x.activo ? PERSONAJE[x.id] || "🧑" : "🪑"}</div>
                    {durmiendo && x.activo && <span style={{ position: "absolute", left: "58%", top: 0, fontSize: 14, fontWeight: 800, color: C.blue, animation: "ofZzz 2.2s infinite" }}>z</span>}
                    {durmiendo && x.activo && <span style={{ position: "absolute", left: "62%", top: 6, fontSize: 11, fontWeight: 800, color: C.blue, animation: "ofZzz 2.2s .8s infinite" }}>z</span>}
                    {x.cafe_pendiente && (
                      <div style={{ position: "relative", fontSize: 20 }} title={x.cafe_motivo || "Café pendiente"}>
                        <span style={{ position: "absolute", left: 6, top: -10, fontSize: 10, animation: "ofVapor 1.6s infinite" }}>〰</span>☕
                      </div>
                    )}
                    {x.estado === "error" && <span style={{ position: "absolute", right: 18, top: 0, fontSize: 18, animation: "ofParpadeo 1s infinite" }}>❗</span>}
                  </div>
                  <div style={{ height: 6, background: "#3a2f22", borderRadius: 3, margin: "2px -4px 8px" }} />
                  {/* Placa */}
                  <div style={{ fontSize: 13, fontWeight: 800, textAlign: "center" }}>{x.icono} {x.nombre}</div>
                  <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 2 }}>
                    {!x.activo ? "Se incorporará pronto" : trabajando ? "Trabajando ahora" : prox ? "Próximo turno: " + horaM(prox.fecha, { weekday: "short", hour: "2-digit", minute: "2-digit" }) + " · " + prox.tarea : ""}
                  </div>
                  {x.id === "direccion" && x.activo && (
                    <div style={{ textAlign: "center", marginTop: 6 }}>
                      <button onClick={(ev) => { ev.stopPropagation(); abrirChats("dm:direccion"); }}
                        style={{ fontFamily: F, fontSize: 12, fontWeight: 800, padding: "5px 11px", borderRadius: 99, border: "1px solid " + C.accent, background: C.accent + "22", color: C.accent, cursor: "pointer" }}>💬 Preguntarle</button>
                    </div>
                  )}
                  {d.marcador?.[x.id] && <div style={{ fontSize: 11, color: C.accent, textAlign: "center", marginTop: 3 }}>🏅 {num(d.marcador[x.id].puntos)} pts {(d.marcador[x.id].medallas || []).map((m: string) => m.split(" ")[0]).join("")}</div>}
                  {dijo && (
                    <div style={{ marginTop: 8, background: "#ffffff10", border: "1px solid #ffffff22", borderRadius: "10px 10px 10px 2px", padding: "6px 8px", fontSize: 11.5, lineHeight: 1.4 }}>
                      💬 <b>→ {nombreDep(dijo.para)}:</b> {String(dijo.texto).slice(0, 110)}{String(dijo.texto).length > 110 ? "…" : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Acceso a los chats */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: C.card, border: "1px solid " + C.accent + "55", borderRadius: 14, padding: "12px 14px" }}>
          <span style={{ fontSize: 26 }}>💬</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800 }}>Chats del equipo</div>
            <div style={{ fontSize: 12, color: C.mutedL }}>Habla con Dirección, con cada departamento o con todos en #equipo.</div>
          </div>
          <Btn small onClick={() => abrirChats("dm:direccion")}>🧑‍💼 Hablar con Dirección</Btn>
          <Btn small outline onClick={() => abrirChats("equipo")}># equipo{Number(d.preguntas_pendientes) > 0 ? " · " + d.preguntas_pendientes + " pendientes" : ""}</Btn>
        </div>

        {/* Zonas comunes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
          <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>🗓️ Sala de reuniones</div>
            {reunionEnCurso ? <div style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>Reunión en curso<span style={{ animation: "ofCursor 1s infinite" }}>…</span></div>
              : lunes ? <div style={{ fontSize: 13, lineHeight: 1.5 }}>Próxima reunión: <b>{horaM(lunes.fecha, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</b><br /><span style={{ color: C.muted }}>dentro de {falta(lunes.fecha.getTime() - ahora.getTime())}</span></div> : null}
            {ultimaReunion && <div style={{ marginTop: 8 }}><Btn small outline onClick={() => abrir(ultimaReunion)}>Ver última acta</Btn></div>}
          </div>

          <div style={{ background: "#f4f1e8", color: "#1f2430", borderRadius: 12, padding: 12, border: "6px solid #c9c2b0" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>📋 Pizarra</div>
            {objMes && (() => {
              const p = Math.min(1, (Number(objMes.actual) || 0) / Math.max(1, Number(objMes.objetivo) || 1));
              return (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>Objetivo del mes: {eur(Number(objMes.actual) || 0)} de {eur(Number(objMes.objetivo) || 0)}</div>
                  <div style={{ height: 8, background: "#d9d3c4", borderRadius: 99, overflow: "hidden", marginTop: 4 }}><div style={{ width: p * 100 + "%", height: "100%", background: p >= 1 ? "#0a9a5a" : "#d9822b" }} /></div>
                </div>
              );
            })()}
            {expActivo ? <div style={{ fontSize: 12.5, lineHeight: 1.45, cursor: "pointer" }} onClick={() => irA("laboratorio")}>🧪 <b>Prueba de la semana:</b> {expActivo.titulo} <span style={{ color: "#6b6556" }}>({EST_EXP[expActivo.estado]?.t || expActivo.estado})</span></div>
              : <div style={{ fontSize: 12.5, color: "#6b6556" }}>🧪 Sin prueba en marcha</div>}
          </div>

          <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>☕ Máquina de café</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8, lineHeight: 1.4 }}>Su próximo trabajo será más a fondo (más esfuerzo de razonamiento). Uno al día por persona; ellos también pueden pedirlo.</div>
            {deps.filter((x) => x.activo).map((x) => (
              <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={x.cafe_motivo || ""}>
                  {PERSONAJE[x.id] || "🧑"} {x.nombre.split(" ")[0]}{x.cafe_pendiente ? " · ☕ en la mesa" + (x.cafe_motivo && x.cafe_motivo !== "Invitado por Andrés" ? " (lo pidió)" : "") : cafeHoy(x) ? " · ya tomó hoy" : ""}
                </span>
                <Btn small outline disabled={x.cafe_pendiente || cafeHoy(x)} onClick={() => invitar(x, false)}>☕</Btn>
                <Btn small disabled={x.cafe_pendiente || cafeHoy(x) || x.estado === "trabajando"} onClick={() => invitar(x, true)}>☕ y a trabajar</Btn>
              </div>
            ))}
          </div>

          <div style={{ background: "#2a2016", border: "6px solid #5a4430", borderRadius: 12, padding: 12, color: "#f3e9da" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>📌 Tablón de corcho</div>
            {msgs.slice(0, 4).map((m) => (
              <div key={m.id} style={{ background: m.estado === "abierto" ? "#fff6a8" : "#e8e2d4", color: "#2a2016", borderRadius: 4, padding: "6px 8px", marginBottom: 6, fontSize: 11.5, lineHeight: 1.4, transform: `rotate(${(m.id % 3) - 1}deg)`, boxShadow: "0 2px 4px #0006" }}>
                <b>{nombreDep(m.de)} → {nombreDep(m.para)}</b><br />{String(m.texto).slice(0, 120)}{String(m.texto).length > 120 ? "…" : ""}
                {m.respuesta && <div style={{ marginTop: 3, color: "#0a6b3a" }}>↳ {String(m.respuesta).slice(0, 90)}…</div>}
              </div>
            ))}
            {!msgs.length && <div style={{ fontSize: 12 }}>Sin notas todavía.</div>}
            <div style={{ marginTop: 4 }}><Btn small outline onClick={() => irA("tablon")}>Ver todo el tablón</Btn></div>
          </div>
        </div>
      </div>
    </div>
  );
}

