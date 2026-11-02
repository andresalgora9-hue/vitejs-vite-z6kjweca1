// ============================================================
// OficioYa · ADMIN — SEGUIMIENTO DEL OBJETIVO: cómo vamos cada día, previsión y lo que falta
// Datos: RPC mkt_seguimiento (clave del CRM de captación; admin y oficina). El objetivo lo cambia solo el admin.
// Ingresos = leads vendidos a profesionales (sin anulados) + comisiones cobradas, por día de entrada.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../supabase";
import { C, F, Card, Btn, Pill, Titulo, Tabla, Respuesta, eur, num } from "./apUi";

type J = any;
const CLAVE_LS = "oy_captacion_clave";
const AZUL = "#3987e5", NARANJA = "#d95926", GRIS = "#8899BB";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (ym: string) => MESES[Number(String(ym).slice(5, 7)) - 1] || ym;
const n = (v: any) => Number(v) || 0;
const pctTxt = (v: number | null) => (v === null || !isFinite(v) ? "—" : Math.round(v * 100) + "%");
const dec = (v: number, d = 1) => (isFinite(v) ? v.toFixed(d).replace(".", ",") : "—");
const OFICIO: Record<string, string> = { pintura: "Pintura", fontaneria: "Fontanería", electricidad: "Electricidad" };
const CIUDAD: Record<string, string> = { sevilla: "Sevilla", valencia: "Valencia", malaga: "Málaga", granada: "Granada", madrid: "Madrid" };
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
const frente = (o: string, c: string) => (OFICIO[o] || cap(o)) + " " + (CIUDAD[c] || cap(c));

function Grande({ label, valor, sub, color }: { label: string; valor: string; sub?: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 15px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || C.text, marginTop: 4, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 4, color: C.mutedL, lineHeight: 1.45 }}>{sub}</div>}
    </div>
  );
}

// Acumulado del mes: real, objetivo (línea recta) y previsión al ritmo de 7 días. Todo en €.
function Acumulado({ dias, obj, ritmo, hoy }: { dias: J[]; obj: number; ritmo: number; hoy: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  const N = dias.length;
  let acc = 0;
  const real = dias.map((d) => { if (d.ingresos === null) return null; acc += n(d.ingresos); return acc; });
  const iHoy = real.reduce((k, v, i) => (v !== null ? i : k), -1);
  const prev = dias.map((_, i) => (iHoy >= 0 && i >= iHoy ? (real[iHoy] as number) + ritmo * (i - iHoy) : null));
  const objD = dias.map((_, i) => (obj * (i + 1)) / N);
  const tope = Math.max(obj, ...prev.filter((v) => v !== null) as number[], ...real.filter((v) => v !== null) as number[], 1) * 1.05;
  const W = 1000, H = 100;
  const x = (i: number) => (N > 1 ? (i / (N - 1)) * W : W / 2);
  const y = (v: number) => H - (v / tope) * H;
  const linea = (vals: (number | null)[]) => vals.reduce((p, v, i) => (v === null ? p : p + (p && vals[i - 1] !== null && vals[i - 1] !== undefined ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1)), "");
  const mover = (ev: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    setH(Math.max(0, Math.min(N - 1, Math.round(((ev.clientX - r.left) / r.width) * (N - 1)))));
  };
  const marcas = [0, tope / 2, tope];
  return (
    <div style={{ fontFamily: F }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: C.mutedL, marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: AZUL, borderRadius: 2 }} />Llevamos</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 0, borderTop: "2px dashed " + NARANJA }} />Previsión (ritmo de 7 días)</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 0, borderTop: "2px dashed " + GRIS }} />Ritmo para llegar al objetivo</span>
      </div>
      <div style={{ display: "flex", height: 200 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingRight: 8, fontSize: 10.5, color: C.muted, textAlign: "right", minWidth: 44 }}>
          {[...marcas].reverse().map((m) => <span key={m} style={{ lineHeight: "10px" }}>{num(m)}</span>)}
        </div>
        <div ref={ref} onMouseMove={mover} onMouseLeave={() => setH(null)} onClick={mover} style={{ flex: 1, position: "relative", borderBottom: "1px solid " + C.border, cursor: "crosshair" }}>
          {marcas.slice(1).map((m) => <div key={m} style={{ position: "absolute", left: 0, right: 0, bottom: (m / tope) * 100 + "%", borderTop: "1px dashed " + C.border + "99" }} />)}
          <svg viewBox={"0 0 " + W + " " + H} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <path d={linea(objD)} fill="none" stroke={GRIS} strokeWidth={1.5} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
            <path d={linea(prev)} fill="none" stroke={NARANJA} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            <path d={linea(real)} fill="none" stroke={AZUL} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {h !== null && <line x1={x(h)} x2={x(h)} y1={0} y2={H} stroke={C.mutedL} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          </svg>
          {iHoy >= 0 && <div style={{ position: "absolute", left: (x(iHoy) / W) * 100 + "%", top: (y(real[iHoy] as number) / H) * 100 + "%", width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: 99, background: AZUL, border: "2px solid " + C.card }} />}
          {h !== null && (
            <div style={{ position: "absolute", left: Math.min(80, Math.max(10, (x(h) / W) * 100)) + "%", top: 0, transform: "translate(-50%, -105%)", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "6px 10px", fontSize: 12, color: C.text, whiteSpace: "nowrap", zIndex: 6, pointerEvents: "none", lineHeight: 1.55 }}>
              <div style={{ color: C.mutedL, fontSize: 11 }}>Día {Number(String(dias[h].f).slice(8, 10))}{String(dias[h].f) === hoy ? " (hoy)" : ""}</div>
              {real[h] !== null && <div><span style={{ color: AZUL }}>■</span> Llevamos: <b>{eur(real[h] as number)}</b> · ese día {eur(n(dias[h].ingresos))}</div>}
              {real[h] === null && prev[h] !== null && <div><span style={{ color: NARANJA }}>■</span> Previsión: <b>{eur(prev[h] as number)}</b></div>}
              <div><span style={{ color: GRIS }}>■</span> Para ir al objetivo: <b>{eur(objD[h])}</b></div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 52, marginTop: 6, fontSize: 10, color: C.muted }}>
        <span>Día 1</span><span>Día {Math.ceil(N / 2)}</span><span>Día {N}</span>
      </div>
    </div>
  );
}

// Ingresos de cada día frente a lo que hace falta al día
function CadaDia({ dias, necesario }: { dias: J[]; necesario: number }) {
  const [h, setH] = useState<number | null>(null);
  const vals = dias.map((d) => (d.ingresos === null ? null : n(d.ingresos)));
  const tope = Math.max(necesario, ...vals.filter((v) => v !== null) as number[], 1) * 1.1;
  return (
    <div style={{ fontFamily: F }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: C.mutedL, marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: AZUL, borderRadius: 2 }} />Ingresos del día</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 0, borderTop: "2px dashed " + NARANJA }} />Hace falta al día ({eur(necesario)})</span>
      </div>
      <div style={{ position: "relative", height: 150, display: "flex", alignItems: "flex-end", gap: 2, borderBottom: "1px solid " + C.border }}>
        {necesario > 0 && <div style={{ position: "absolute", left: 0, right: 0, bottom: (necesario / tope) * 100 + "%", borderTop: "2px dashed " + NARANJA, zIndex: 2, pointerEvents: "none" }} />}
        {dias.map((d, i) => (
          <div key={String(d.f)} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} onClick={() => setH(h === i ? null : i)}
            style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", position: "relative" }}>
            {vals[i] !== null && <div style={{ width: "70%", maxWidth: 18, height: Math.max(vals[i] as number > 0 ? 2 : 0, ((vals[i] as number) / tope) * 100) + "%", background: AZUL, opacity: h === i ? 1 : 0.85, borderRadius: "4px 4px 0 0" }} />}
            {vals[i] === null && <div style={{ width: "70%", maxWidth: 18, height: 3, background: C.border, borderRadius: 2 }} />}
            {h === i && (
              <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translate(-50%, -6px)", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "6px 9px", fontSize: 12, color: C.text, whiteSpace: "nowrap", zIndex: 6, pointerEvents: "none", lineHeight: 1.5 }}>
                <div style={{ color: C.mutedL, fontSize: 11 }}>Día {Number(String(d.f).slice(8, 10))}</div>
                {vals[i] === null ? <div>Aún no ha llegado</div> : <>
                  <div><b>{eur(vals[i] as number)}</b> · {num(d.vendidos)} leads vendidos</div>
                  <div style={{ color: C.mutedL }}>{num(d.solicitudes)} solicitudes · gasto {eur(n(d.gasto))}</div>
                </>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: C.muted }}>
        <span>Día 1</span><span>Día {Math.ceil(dias.length / 2)}</span><span>Día {dias.length}</span>
      </div>
    </div>
  );
}

export default function Seguimiento({ mes, aviso }: { mes: string; aviso?: (m: string) => void }) {
  const [clave, setClave] = useState(() => { try { return localStorage.getItem(CLAVE_LS) || ""; } catch { return ""; } });
  const [claveInput, setClaveInput] = useState("");
  const [s, setS] = useState<J>(null);
  const [error, setError] = useState("");
  const [editObj, setEditObj] = useState(false);
  const [objInput, setObjInput] = useState("");

  const cargar = useCallback(async () => {
    if (!clave) return;
    const { data, error: e } = await db.rpc("mkt_seguimiento", { p_clave: clave, p_mes: mes });
    if (e) {
      if (/acceso denegado/i.test(e.message)) { try { localStorage.removeItem(CLAVE_LS); } catch { /* nada */ } setClave(""); setError("Clave incorrecta"); return; }
      setError(e.message); return;
    }
    setError(""); setS(data);
  }, [clave, mes]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!clave) {
    const entrar = () => { try { localStorage.setItem(CLAVE_LS, claveInput); } catch { /* nada */ } setClave(claveInput); setError(""); };
    return (
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>¿Cómo vamos este mes?</div>
        <div style={{ fontSize: 13, color: C.mutedL, marginBottom: 10 }}>Entra con tu clave del CRM de captación para ver el objetivo, la previsión y lo que falta.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="password" value={claveInput} onChange={(e) => setClaveInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && claveInput.length >= 8) entrar(); }} placeholder="Clave"
            style={{ flex: 1, padding: "9px 11px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontFamily: F, fontSize: 14 }} />
          <Btn disabled={claveInput.length < 8} onClick={entrar}>Entrar</Btn>
        </div>
        {error && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{error}</div>}
      </Card>
    );
  }
  if (!s) return <Card style={{ marginBottom: 14 }}><div style={{ color: error ? C.red : C.mutedL, fontSize: 13 }}>{error || "Cargando el seguimiento…"}</div></Card>;

  const obj = n(s.objetivo), llevamos = n(s.llevamos), dias: J[] = s.dias_detalle || [];
  const enCurso = !!s.en_curso, quedan = n(s.quedan), transc = n(s.transcurridos), totalDias = n(s.dias);
  const prevision = n(s.prevision_cierre);
  const r7 = s.ritmo_7d || {}, rt = s.ratios_14d || {};
  const ritmo = n(r7.ingresos_dia);
  const falta = Math.max(0, obj - llevamos);
  const necesarioDia = enCurso && quedan > 0 ? falta / quedan : obj / Math.max(1, totalDias);
  const deberiamos = obj * (transc / Math.max(1, totalDias));
  const precio = n(rt.precio_medio_lead) || 50;
  const leadsNec = necesarioDia / precio, leadsAhora = n(r7.vendidos_dia);
  const ventaPorSol = n(rt.vendidos_por_solicitud) || 0.5;
  const solNec = leadsNec / ventaPorSol, solAhora = n(r7.solicitudes_dia);
  const cps = n(rt.coste_por_solicitud);
  const gastoExtra = Math.max(0, solNec - solAhora) * cps;
  const anul = n(rt.anulados_pct);
  const enviadosDia = anul < 1 ? leadsAhora / (1 - anul) : leadsAhora;
  const ganaSiAnulMenos10 = enviadosDia * 0.1 * precio * 30;
  const motivos = Object.entries(s.anulados_motivos_14d || {}).sort((a: J, b: J) => n(b[1]) - n(a[1]));
  const evitables = motivos.filter(([k]) => /duplic|teléfono|admin/.test(k)).reduce((t, [, v]) => t + n(v), 0);
  const totalAnul = motivos.reduce((t, [, v]) => t + n(v), 0);
  const pctObj = obj > 0 ? llevamos / obj : 0, pctPrev = obj > 0 ? prevision / obj : 0;
  const tono: "bien" | "mal" | "regular" | "neutro" = obj <= 0 ? "neutro" : (enCurso ? pctPrev : pctObj) >= 1 ? "bien" : (enCurso ? pctPrev : pctObj) >= 0.8 ? "regular" : "mal";
  const colPrev = pctPrev >= 1 ? C.green : pctPrev >= 0.8 ? C.orange : C.red;
  const hoyD = s.hoy_datos || {};
  const colHoy = n(hoyD.ingresos) >= necesarioDia ? C.green : C.text;
  const comp = n(s.mes_anterior_mismo_dia);
  const frentes: J[] = s.por_frente || [];
  const esAdmin = s.rol === "admin";

  const guardarObj = async () => {
    const v = Number(objInput.replace(/\./g, "").replace(",", "."));
    if (!(v > 0)) return;
    const { error: e } = await db.rpc("mkt_objetivo_fijar", { p_clave: clave, p_valor: v });
    if (e) { aviso && aviso("No se pudo: " + e.message); return; }
    setEditObj(false); aviso && aviso("Objetivo guardado"); cargar();
  };

  const escalaBarra = Math.max(obj, prevision, llevamos, 1) * 1.04;
  const xb = (v: number) => Math.min(100, (v / escalaBarra) * 100) + "%";

  return (
    <div style={{ fontFamily: F }}>
      <Respuesta pregunta={"¿Llegamos al objetivo de " + nombreMes(s.mes) + "?"} tono={tono}
        texto={obj <= 0 ? "No hay objetivo puesto para este mes." : enCurso
          ? <>Llevamos {eur(llevamos)} de {eur(obj)} ({pctTxt(pctObj)}). Al ritmo de los últimos 7 días cerraríamos en ~{eur(prevision)} ({pctTxt(pctPrev)}).</>
          : <>{n(s.transcurridos) === 0 ? "El mes aún no ha empezado." : <>Cerramos con {eur(llevamos)} de {eur(obj)} ({pctTxt(pctObj)}).</>}</>}
        detalle={enCurso && obj > 0 ? (falta > 0
          ? <>Faltan {eur(falta)}: hacen falta <b style={{ color: C.text }}>{eur(necesarioDia)} al día</b> durante los {quedan} días que quedan, y ahora entran {eur(ritmo)} al día.</>
          : <>Objetivo cumplido: todo lo que entre a partir de ahora es extra.</>) : undefined} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Grande label={"Llevamos en " + nombreMes(s.mes)} valor={eur(llevamos)} color={C.text}
          sub={<>{pctTxt(pctObj)} de {eur(obj)}{enCurso ? <> · a estas alturas tocaría <b style={{ color: llevamos >= deberiamos ? C.green : C.orange }}>{eur(deberiamos)}</b></> : null}</>} />
        {enCurso && <Grande label="Hoy" valor={eur(n(hoyD.ingresos))} color={colHoy}
          sub={<>{num(hoyD.vendidos)} leads vendidos · {num(hoyD.solicitudes)} solicitudes<br />Hace falta {eur(necesarioDia)} al día</>} />}
        {enCurso && <Grande label="Previsión de cierre" valor={eur(prevision)} color={colPrev} sub={<>{pctTxt(pctPrev)} del objetivo · al ritmo de {eur(ritmo)} al día</>} />}
        {enCurso && <Grande label="Nos falta" valor={eur(falta)} color={falta > 0 ? C.text : C.green} sub={falta > 0 ? <>{eur(necesarioDia)} al día · {quedan} días</> : "Objetivo cumplido"} />}
        <Grande label={"Mes anterior" + (enCurso ? " a estas alturas" : "")} valor={eur(enCurso ? comp : n(s.mes_anterior_total))}
          sub={enCurso ? <>Total del mes: {eur(n(s.mes_anterior_total))}{comp > 0 ? <> · vamos {llevamos >= comp ? "+" : "−"}{pctTxt(Math.abs(llevamos / comp - 1))}</> : null}</> : undefined} />
      </div>

      {obj > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ position: "relative", height: 22, background: C.surface, borderRadius: 11 }}>
            {enCurso && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: xb(prevision), background: colPrev + "2E", borderRadius: 11 }} />}
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: xb(llevamos), background: AZUL, borderRadius: 11, transition: "width .6s" }} />
            {enCurso && <div title={"A estas alturas tocaría " + eur(deberiamos)} style={{ position: "absolute", left: xb(deberiamos), top: -5, bottom: -5, width: 2, background: C.text, opacity: 0.75 }} />}
            <div title={"Objetivo " + eur(obj)} style={{ position: "absolute", left: xb(obj), top: -5, bottom: -5, width: 3, background: C.green, borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.mutedL, marginTop: 8, alignItems: "center" }}>
            <span><b style={{ color: AZUL }}>■</b> Llevamos {eur(llevamos)}</span>
            {enCurso && <span><b style={{ color: colPrev, opacity: 0.5 }}>■</b> Previsión {eur(prevision)}</span>}
            {enCurso && <span><b style={{ color: C.text }}>|</b> Tocaría hoy {eur(deberiamos)}</span>}
            <span><b style={{ color: C.green }}>|</b> Objetivo {eur(obj)}</span>
            <span style={{ marginLeft: "auto" }}>
              {esAdmin && !editObj && <Btn small outline onClick={() => { setObjInput(String(obj)); setEditObj(true); }}>Cambiar objetivo</Btn>}
              {esAdmin && editObj && (
                <span style={{ display: "inline-flex", gap: 6 }}>
                  <input value={objInput} onChange={(e) => setObjInput(e.target.value)} inputMode="decimal" style={{ width: 90, padding: "5px 8px", background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.text, fontFamily: F }} />
                  <Btn small onClick={guardarObj}>Guardar</Btn><Btn small outline onClick={() => setEditObj(false)}>Cancelar</Btn>
                </span>
              )}
            </span>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <div>
          <Titulo>Acumulado del mes</Titulo>
          <Card>{dias.length ? <Acumulado dias={dias} obj={obj} ritmo={enCurso ? ritmo : 0} hoy={String(s.hoy)} /> : null}</Card>
        </div>
        <div>
          <Titulo>Cada día</Titulo>
          <Card>{dias.length ? <CadaDia dias={dias} necesario={necesarioDia} /> : null}</Card>
        </div>
      </div>

      {enCurso && falta > 0 && obj > 0 && (
        <>
          <Titulo>Qué nos falta para llegar</Titulo>
          <Card>
            {[
              { ok: leadsAhora >= leadsNec, t: <>Vender <b>{dec(leadsNec)} leads al día</b>; ahora vendemos {dec(leadsAhora)} (precio medio {eur(precio)}).</> },
              { ok: solAhora >= solNec, t: <>Eso son unas <b>{dec(solNec)} solicitudes al día</b>; ahora entran {dec(solAhora)}. De cada solicitud se vende el {pctTxt(ventaPorSol)}.</> },
              { ok: gastoExtra <= 0, t: gastoExtra > 0 ? <>Con el coste actual por solicitud ({eur(cps, 2)}), harían falta unos <b>{eur(gastoExtra)} más de anuncios al día</b>, si la conversión se mantiene.</> : <>El ritmo de solicitudes ya alcanza: toca no perderlas.</> },
              { ok: anul < 0.2, t: <>Se anula el <b>{pctTxt(anul)}</b> de lo que se envía a los profesionales{motivos.length ? <> ({motivos.map(([k, v]) => v + " " + k).join(", ")})</> : null}.{evitables > 0 ? <> {evitables} de {totalAnul} son duplicados, teléfonos erróneos o anulados a mano: no son clientes nuevos y hay que frenarlos antes de enviarlos.</> : null}</> },
            ].map((x, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i ? "1px solid " + C.border + "88" : undefined, fontSize: 13.5, lineHeight: 1.5, color: C.mutedL }}>
                <Pill texto={x.ok ? "✓ Bien" : "! Falta"} color={x.ok ? C.green : C.orange} /><span style={{ color: C.text }}>{x.t}</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Ritmo = media de los últimos 7 días. Conversión, precio medio, coste por solicitud y anulaciones = últimos 14 días.</div>
          </Card>
        </>
      )}

      <Titulo>De dónde sale el dinero este mes</Titulo>
      <Tabla
        cols={[{ k: "f", l: "Oficio y ciudad" }, { k: "l", l: "Llevamos", align: "right" }, { k: "p", l: "% del total", align: "right" }, { k: "r", l: "Ritmo (€/día)", align: "right" },
          { k: "c", l: "Previsión cierre", align: "right" }, { k: "s", l: "Solicitudes", align: "right" }, { k: "v", l: "Vendidos", align: "right" }, { k: "g", l: "Gasto", align: "right" }, { k: "ro", l: "ROAS", align: "right" }]}
        filas={frentes.map((x) => {
          const cierre = enCurso ? n(x.llevamos) + n(x.ritmo_dia) * Math.max(0, quedan - 1) : n(x.llevamos);
          return {
            f: <b>{frente(x.oficio, x.ciudad)}</b>, l: eur(n(x.llevamos)), p: pctTxt(llevamos > 0 ? n(x.llevamos) / llevamos : null),
            r: eur(n(x.ritmo_dia)), c: eur(cierre), s: num(x.solicitudes), v: num(x.vendidos), g: eur(n(x.gasto)),
            ro: n(x.gasto) > 0 ? <span style={{ color: n(x.llevamos) >= n(x.gasto) ? C.green : C.red, fontWeight: 800 }}>{dec(n(x.llevamos) / n(x.gasto), 2)}x</span> : "—",
          };
        })}
        vacio="Sin movimiento este mes"
      />
    </div>
  );
}
