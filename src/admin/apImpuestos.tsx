// ============================================================
// OficioYa · ADMIN — IMPUESTOS
// Con las facturas emitidas del panel, las facturas subidas a Archivos, el gasto
// real de anuncios y lo que se apunta a mano: IVA (303), IRPF (130), retenciones
// (111), operaciones con la UE (349), clientes y proveedores (347) y plazos.
// Es una estimación para preparar los modelos: la gestoría revisa antes de presentar.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../supabase";
import { C, F, Btn, Pill, Cabecera, Modal, Campo, Sel, Respuesta, Grid, Kpi, Titulo, Card, BarraH, SeccionProps, useAncho, eur, mesNombre } from "./apUi";
import {
  claveAdmin, FiscalDatos, FiscalConfig, Linea, Apunte, FormApunte, construirLineas, calcular303, calcular130, calcular111,
  calcular349, calcular347, csvLibro, descargarTexto, plazoTrimestre, periodoPorDefecto, diasHasta, fechaLarga, hoyMadrid,
  nombreCategoria, r2, aNumero, GOOGLE, META, minoracion130,
} from "./apFiscal";
import { Subida } from "./apArchivos";

const FUENTE: Record<string, { t: string; c: string }> = {
  factura: { t: "Factura del panel", c: C.green },
  apunte: { t: "Factura subida", c: C.blue },
  manual: { t: "Apuntado a mano", c: C.mutedL },
  comision: { t: "Estimado", c: C.orange },
  publicidad: { t: "Estimado", c: C.orange },
  autonomos: { t: "Fijo de ajustes", c: C.purple },
};
const fuenteDe = (l: Linea) => (l.fuente === "apunte" && !l.apunte?.archivo_id ? FUENTE.manual : FUENTE[l.fuente]);
const fechaCorta = (ymd: string) => ymd.slice(8, 10) + "/" + ymd.slice(5, 7);
const casilla303 = (tipo: number) => (tipo === 4 ? "01 · 03" : tipo === 10 ? "04 · 06" : tipo === 21 ? "07 · 09" : "150 · 152");

type Fila = { c?: string; l: React.ReactNode; base?: number | null; iva?: number | null; total?: boolean; titulo?: boolean; color?: string };
function TablaCasillas({ filas, colBase = "Base", colIva = "IVA" }: { filas: Fila[]; colBase?: string; colIva?: string }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F, fontSize: 13, minWidth: 420 }}>
        <thead>
          <tr>
            <th style={th}>Concepto</th>
            <th style={{ ...th, textAlign: "right" }}>{colBase}</th>
            <th style={{ ...th, textAlign: "right" }}>{colIva}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => f.titulo ? (
            <tr key={i}><td colSpan={3} style={{ padding: "12px 10px 4px", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.mutedL }}>{f.l}</td></tr>
          ) : (
            <tr key={i} style={{ borderTop: "1px solid " + C.border + (f.total ? "" : "66") }}>
              <td style={{ padding: "8px 10px", color: f.total ? C.text : C.mutedL, fontWeight: f.total ? 800 : 500 }}>
                {f.c && <span style={{ display: "inline-block", minWidth: 58, fontSize: 11, color: C.muted, fontWeight: 700 }}>[{f.c}]</span>}{f.l}
              </td>
              <td style={{ padding: "8px 10px", textAlign: "right", color: C.mutedL, whiteSpace: "nowrap" }}>{f.base == null ? "" : eur(f.base, 2)}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", color: f.color || (f.total ? C.text : C.text), fontWeight: f.total ? 800 : 600, whiteSpace: "nowrap" }}>{f.iva == null ? "" : eur(f.iva, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", color: C.mutedL, fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid " + C.border };

// ── AJUSTES FISCALES ────────────────────────────────────────
function Ajustes({ cfg, anio, onClose, onGuardado }: { cfg: FiscalConfig; anio: number; onClose: () => void; onGuardado: (m: string) => void }) {
  const [roi, setRoi] = useState<string>(cfg.roi || "nose");
  const [ss, setSs] = useState(cfg.autonomos_mensual != null ? String(cfg.autonomos_mensual).replace(".", ",") : "");
  const [ssDesde, setSsDesde] = useState(cfg.autonomos_desde || `${anio}-01`);
  const [rend, setRend] = useState(cfg.rendimiento_anterior != null ? String(cfg.rendimiento_anterior).replace(".", ",") : "0");
  const [dificil, setDificil] = useState(String(cfg.dificil_pct ?? 5));
  const [compensar, setCompensar] = useState(String(cfg.iva_compensar_inicio?.[anio] ?? 0).replace(".", ","));
  const [comIva, setComIva] = useState(cfg.comisiones_iva_incluido === false ? "no" : "si");
  const [ocupado, setOcupado] = useState(false);
  const [err, setErr] = useState("");

  const guardar = async () => {
    setErr("");
    const nSs = ss.trim() ? aNumero(ss) : null;
    const nRend = aNumero(rend);
    const nDif = aNumero(dificil);
    const nComp = aNumero(compensar);
    if ([nSs ?? 0, nRend, nDif, nComp].some((n) => Number.isNaN(n))) { setErr("Revisa los números"); return; }
    setOcupado(true);
    const valores: [string, any][] = [
      ["roi", roi],
      ["autonomos_mensual", nSs],
      ["autonomos_desde", nSs ? ssDesde : null],
      ["rendimiento_anterior", nRend],
      ["dificil_pct", nDif],
      ["iva_compensar_inicio", { ...(cfg.iva_compensar_inicio || {}), [anio]: r2(nComp) }],
      ["comisiones_iva_incluido", comIva === "si"],
    ];
    for (const [k, v] of valores) {
      const { error } = await db.rpc("fiscal_config_guardar", { p_admin: claveAdmin(), p_clave: k, p_valor: v });
      if (error) { setOcupado(false); setErr(error.message); return; }
    }
    setOcupado(false);
    onGuardado("Ajustes guardados");
  };
  const etiqueta = (t: string) => <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>{t}</label>;
  const nota = (t: React.ReactNode) => <div style={{ fontSize: 11.5, color: C.muted, marginTop: -6, marginBottom: 14, lineHeight: 1.45 }}>{t}</div>;
  return (
    <Modal titulo="Ajustes fiscales" onClose={onClose} ancho={560}>
      <div>{etiqueta("¿Estás dado de alta en el ROI (operador intracomunitario)?")}
        <Sel value={roi} onChange={setRoi} options={[{ v: "si", l: "Sí: Google y Meta me facturan sin IVA" }, { v: "no", l: "No: Google y Meta me cobran IVA" }, { v: "nose", l: "No lo sé" }]} style={{ width: "100%", marginBottom: 12 }} /></div>
      {nota("Cambia cómo cuenta el gasto de anuncios sin factura subida. Si no lo sabes, se calcula como si estuvieras en el ROI (sin IVA que descontar), que es lo prudente.")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Campo label="Autónomos (Seguridad Social) al mes €" value={ss} onChange={setSs} inputMode="decimal" placeholder="Ej.: 87,61" />
        <Campo label="Desde el mes" type="month" value={ssDesde} onChange={setSsDesde} />
      </div>
      {nota("Se suma sola como gasto cada mes (sin IVA). Si subes el recibo de un mes, manda el recibo.")}
      <Campo label="Rendimiento neto del año pasado €" value={rend} onChange={setRend} inputMode="decimal" />
      {nota(<>Para la deducción del 130 de hasta 100 € por trimestre (hoy: {eur(minoracion130(aNumero(rend)))}). Si empezaste este año, déjalo en 0.</>)}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Campo label="Gastos de difícil justificación %" value={dificil} onChange={setDificil} inputMode="decimal" />
        <Campo label={`IVA a compensar al empezar ${anio} €`} value={compensar} onChange={setCompensar} inputMode="decimal" />
      </div>
      {nota("Difícil justificación: 5 % del rendimiento (máx. 2.000 € al año) en estimación directa simplificada. IVA a compensar: lo que te quedó a tu favor en el 4T del año anterior.")}
      <div>{etiqueta("Las comisiones cobradas (modelo antiguo) llevaban el IVA dentro")}
        <Sel value={comIva} onChange={setComIva} options={[{ v: "si", l: "Sí: el importe cobrado es con IVA" }, { v: "no", l: "No: el importe cobrado es la base" }]} style={{ width: "100%", marginBottom: 14 }} /></div>
      {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={guardar} disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar"}</Btn>
        <Btn outline color={C.mutedL} onClick={onClose}>Cancelar</Btn>
      </div>
    </Modal>
  );
}

// ── PANTALLA ────────────────────────────────────────────────
export default function Impuestos({ d, aviso, irA }: SeccionProps) {
  const ancho = useAncho();
  const movil = ancho < 900;
  const def = useMemo(() => periodoPorDefecto(), []);
  const [anio, setAnio] = useState(def.anio);
  const [q, setQ] = useState<number>(def.q);
  const [datos, setDatos] = useState<FiscalDatos | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState<{ inicial: Partial<Apunte>; archivoNombre?: string } | null>(null);
  const [ajustes, setAjustes] = useState(false);
  const [subir, setSubir] = useState<{ carpeta: string; preset?: Partial<Apunte>; tipo: string } | null>(null);
  const [libro, setLibro] = useState<"gasto" | "ingreso">("gasto");
  const [verTodo, setVerTodo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await db.rpc("fiscal_datos", { p_admin: claveAdmin(), p_anio: anio });
    setCargando(false);
    if (error) { setError(error.message); return; }
    setDatos(data as FiscalDatos);
    setError("");
  }, [anio]);
  useEffect(() => { cargar(); }, [cargar]);

  const cfg: FiscalConfig = datos?.config || {};
  const lineas = useMemo(() => (datos ? construirLineas(datos) : []), [datos]);
  const r303 = useMemo(() => calcular303(lineas, Number(cfg.iva_compensar_inicio?.[anio]) || 0), [lineas, cfg, anio]);
  const r130 = useMemo(() => calcular130(lineas, cfg), [lineas, cfg]);
  const delPeriodo = useMemo(() => (q ? lineas.filter((l) => l.q === q) : lineas), [lineas, q]);

  if (error) {
    const sinClave = /clave de admin/i.test(error);
    return (
      <div>
        <Cabecera titulo="Impuestos" />
        <Respuesta pregunta="¿Cuánto toca pagar?" tono="mal" texto={sinClave ? "Falta la clave de admin en este dispositivo." : "No se han podido cargar los datos."}
          detalle={sinClave ? "Entra una vez en Captación desde aquí (con tu clave) y vuelve." : error} />
        {sinClave && <Btn onClick={() => irA("captacion")}>Ir a Captación</Btn>}
      </div>
    );
  }
  if (!datos) return <div style={{ color: C.mutedL, padding: 30 }}>Cargando impuestos…</div>;

  // ── cifras del periodo ──
  const ing = delPeriodo.filter((l) => l.tipo === "ingreso");
  const gas = delPeriodo.filter((l) => l.tipo === "gasto");
  const sumBase = (ls: Linea[]) => r2(ls.reduce((s, l) => s + l.base, 0));
  const gastosDed = r2(gas.reduce((s, l) => s + (l.inversion ? 0 : l.base * (l.deducible ?? 100) / 100), 0));
  const ingresos = sumBase(ing);
  const iva = q ? r303[q - 1].final : r2(r303.reduce((s, r) => s + r.resultado, 0));
  const irpf = q ? r130[q - 1].resultado : r2(r130.reduce((s, r) => s + Math.max(0, r.resultado), 0));
  const ret111 = calcular111(delPeriodo);
  const ue349 = calcular349(delPeriodo);
  const t347 = calcular347(lineas);
  const pagar = r2(Math.max(0, iva) + Math.max(0, irpf) + ret111.retenciones);
  const estimados = delPeriodo.filter((l) => l.estimado);
  const plazo = q ? plazoTrimestre(anio, q) : null;
  const hoy = hoyMadrid();
  const finTrim = q ? new Date(Date.UTC(anio, q * 3, 0)).toISOString().slice(0, 10) : `${anio}-12-31`;
  const cerrado = hoy > finTrim;
  const quedan = plazo ? diasHasta(plazo.hasta) : 0;

  // ── lo que falta para que salga exacto ──
  const pendientes: { k: string; t: React.ReactNode; acc?: React.ReactNode; grave?: boolean }[] = [];
  if (!cfg.roi || cfg.roi === "nose") pendientes.push({ k: "roi", t: "Dime si estás dado de alta en el ROI: cambia cómo cuentan Google y Meta.", acc: <Btn small outline onClick={() => setAjustes(true)}>Ajustes</Btn> });
  if (cfg.autonomos_mensual == null) pendientes.push({ k: "ss", t: "Falta lo que pagas de autónomos al mes (es gasto deducible).", acc: <Btn small outline onClick={() => setAjustes(true)}>Ajustes</Btn> });
  delPeriodo.filter((l) => l.fuente === "publicidad").forEach((l) => pendientes.push({
    k: l.key,
    t: <>Factura de {l.plataforma === "google" ? "Google Ads" : "Meta"} de {mesNombre(l.mes!).toLowerCase()}: hay {eur(l.base, 2)} de gasto de campañas sin factura subida{l.aviso?.includes("curso") ? " (mes en curso)" : ""}.</>,
    acc: <Btn small onClick={() => setSubir({
      carpeta: `Facturas recibidas/${l.mes!.slice(0, 4)}`, tipo: "factura_recibida",
      preset: {
        tipo: "gasto", categoria: "publicidad", plataforma: l.plataforma as any, periodo: l.mes, base: l.base, fecha: l.fecha,
        tercero_nombre: (l.plataforma === "google" ? GOOGLE : META).nombre, tercero_nif: (l.plataforma === "google" ? GOOGLE : META).nif, tercero_pais: "IE",
        iva_regimen: cfg.roi === "no" ? "general" : "intracomunitario", iva_tipo: 21,
        concepto: l.plataforma === "google" ? "Publicidad en Google Ads" : "Publicidad en Facebook e Instagram",
      },
    })}>Subir factura</Btn>,
  }));
  const comMeses: Record<string, { n: number; total: number }> = {};
  delPeriodo.filter((l) => l.fuente === "comision").forEach((l) => { comMeses[l.mes!] = comMeses[l.mes!] || { n: 0, total: 0 }; comMeses[l.mes!].n++; comMeses[l.mes!].total += l.total; });
  Object.entries(comMeses).forEach(([mes, x]) => pendientes.push({
    k: "com" + mes, t: <>Comisiones de {mesNombre(mes).toLowerCase()}: {x.n} cobro{x.n > 1 ? "s" : ""} ({eur(x.total, 2)}) sin las facturas subidas; cuentan con el IVA {cfg.comisiones_iva_incluido === false ? "aparte" : "dentro"}.</>,
    acc: <Btn small outline onClick={() => irA("archivos")}>Subirlas en Archivos</Btn>,
  }));
  (datos.pendientes || []).forEach((p) => pendientes.push({
    k: "arch" + p.id, grave: true, t: <>«{p.nombre}» está en Archivos sin datos fiscales: no cuenta.</>,
    acc: <Btn small color={C.orange} onClick={() => setForm({ inicial: { tipo: p.tipo === "factura_emitida" ? "ingreso" : "gasto", fecha: p.fecha_doc || hoy, archivo_id: p.id }, archivoNombre: p.nombre })}>Poner datos</Btn>,
  }));
  delPeriodo.filter((l) => l.fuente === "factura" && !l.nif).forEach((l) => pendientes.push({
    k: "nif" + l.key, grave: true, t: <>La factura {l.numero} ({l.tercero || "sin nombre"}) no tiene el NIF del cliente: una factura sin NIF no es completa.</>,
    acc: <Btn small outline onClick={() => irA("facturas")}>Ver en Facturas</Btn>,
  }));
  delPeriodo.filter((l) => l.fuente === "apunte" && l.aviso).forEach((l) => pendientes.push({
    k: "av" + l.key, t: <>{l.tercero || "Gasto"} del {fechaCorta(l.fecha)}: {l.aviso}.</>,
    acc: l.apunte && <Btn small outline onClick={() => setForm({ inicial: l.apunte! })}>Corregir</Btn>,
  }));

  // ── respuesta de arriba ──
  const pregunta = q ? `¿Cuánto toca pagar del ${q}T ${anio}?` : `¿Cómo va ${anio}?`;
  const textoQ = pagar > 0
    ? <>Unos {eur(pagar)}: IVA {eur(Math.max(0, iva))} + IRPF {eur(Math.max(0, irpf))}{ret111.retenciones ? <> + retenciones {eur(ret111.retenciones)}</> : null}.</>
    : <>Nada a pagar por ahora{iva < 0 ? <>: el IVA sale {eur(-iva, 2)} a tu favor</> : null}.</>;
  const textoPlazo = q && plazo ? (cerrado
    ? (quedan >= 0 ? ` Se presenta hasta el ${fechaLarga(plazo.hasta)} (quedan ${quedan} día${quedan === 1 ? "" : "s"}).` : ` El plazo acabó el ${fechaLarga(plazo.hasta)}.`)
    : ` El trimestre sigue abierto hasta el ${fechaLarga(finTrim)}; se presenta del ${fechaLarga(plazo.desde)} al ${fechaLarga(plazo.hasta)}.`) : "";
  const tono = pendientes.some((p) => p.grave) ? "mal" : estimados.length || pendientes.length ? "regular" : "bien";

  // ── piezas ──
  const r = q ? r303[q - 1] : null;
  const filas303: Fila[] = r ? [
    { titulo: true, l: "IVA de tus facturas (lo cobras para Hacienda)" },
    ...(r.rep.length ? r.rep.map((x) => ({ c: casilla303(x.tipo), l: `Al ${x.tipo} %`, base: x.base, iva: x.iva })) : [{ c: "07 · 09", l: "Al 21 %", base: 0, iva: 0 }]),
    ...(r.intraBase ? [{ c: "10 · 11", l: "Servicios de empresas de la UE (Google, Meta…)", base: r.intraBase, iva: r.intraIva }] : []),
    ...(r.ispBase ? [{ c: "12 · 13", l: "Servicios de fuera de la UE (inversión del sujeto pasivo)", base: r.ispBase, iva: r.ispIva }] : []),
    { c: "27", l: "Total IVA devengado", iva: r.devengado, total: true },
    { titulo: true, l: "IVA de tus gastos (te lo descuentas)" },
    { c: "28 · 29", l: "Facturas de gastos", base: r.corrBase, iva: r.corrIva },
    ...(r.invBase ? [{ c: "30 · 31", l: "Equipos y bienes que duran años", base: r.invBase, iva: r.invIva }] : []),
    ...(r.ueBase ? [{ c: "36 · 37", l: "Servicios de empresas de la UE", base: r.ueBase, iva: r.ueIva }] : []),
    ...(r.ueInvBase ? [{ c: "38 · 39", l: "Bienes de inversión de la UE", base: r.ueInvBase, iva: r.ueInvIva }] : []),
    { c: "45", l: "Total a deducir", iva: r.deducible, total: true },
    { titulo: true, l: "Resultado" },
    { c: "46", l: "Diferencia", iva: r.resultado },
    ...(r.compensado ? [{ c: "78", l: "IVA a tu favor de trimestres anteriores", iva: -r.compensado }] : []),
    { c: "71", l: r.final > 0 ? "A ingresar" : r.final < 0 ? (q === 4 ? "A devolver o compensar" : "A compensar en el siguiente") : "Resultado", iva: r.final, total: true, color: r.final > 0 ? C.orange : C.green },
    ...(r.entregasUE ? [{ c: "59", l: "Ventas a empresas de la UE (informativo)", base: r.entregasUE }] : []),
    ...(r.otrasSinIva ? [{ l: "Ingresos sin IVA o exentos (informativo)", base: r.otrasSinIva }] : []),
  ] : [];
  const p130 = q ? r130[q - 1] : null;
  const filas130: Fila[] = p130 ? [
    { c: "01", l: `Ingresos del 1 de enero al fin del ${q}T`, iva: p130.ingresos },
    { c: "02", l: <>Gastos deducibles{p130.dificil || p130.amortizacion ? <span style={{ color: C.muted }}> (incluye {[p130.amortizacion ? eur(p130.amortizacion, 2) + " de amortización" : "", p130.dificil ? eur(p130.dificil, 2) + " de difícil justificación" : ""].filter(Boolean).join(" y ")})</span> : null}</>, iva: p130.gastos },
    { c: "03", l: "Rendimiento neto", iva: p130.neto, total: true },
    { c: "04", l: "20 % del rendimiento (si es positivo)", iva: p130.veinte },
    { c: "05", l: "Lo pagado en trimestres anteriores", iva: -p130.anteriores },
    { c: "06", l: "Retenciones que te han hecho", iva: -p130.retenciones },
    { c: "07", l: "Resultado", iva: p130.c07, total: true },
    { c: "13", l: "Deducción por rendimientos bajos (art. 110.3.c)", iva: -p130.minoracion },
    ...(p130.negativosAnt ? [{ c: "15", l: "Resultados negativos de trimestres anteriores", iva: -p130.negativosAnt }] : []),
    { c: "19", l: p130.resultado > 0 ? "A ingresar" : "Sin pago (negativo o cero)", iva: Math.max(0, p130.resultado), total: true, color: p130.resultado > 0 ? C.orange : C.green },
  ] : [];

  const porCat = (ls: Linea[], tipo: "ingreso" | "gasto") => {
    const m: Record<string, number> = {};
    ls.forEach((l) => { m[l.categoria] = (m[l.categoria] || 0) + (tipo === "gasto" ? l.base * (l.deducible ?? 100) / 100 : l.base); });
    return Object.entries(m).map(([k, v]) => ({ k, v: r2(v) })).sort((a, b) => b.v - a.v);
  };
  const catIng = porCat(ing, "ingreso");
  const catGas = porCat(gas, "gasto");
  const colores = [C.accent, C.blue, C.green, C.orange, C.purple, C.red, C.mutedL];

  const filasLibro = delPeriodo.filter((l) => l.tipo === libro).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const verFilas = verTodo ? filasLibro : filasLibro.slice(0, 40);
  const abrirLinea = (l: Linea) => {
    if (l.apunte) { setForm({ inicial: l.apunte }); return; }
    if (l.fuente === "factura") { irA("facturas"); return; }
    if (l.fuente === "publicidad" || l.fuente === "comision" || l.fuente === "autonomos") {
      setForm({ inicial: {
        tipo: l.tipo, fecha: l.fecha, categoria: l.categoria, base: l.base, iva_regimen: l.regimen, iva_tipo: l.ivaTipo,
        tercero_nombre: l.tercero, tercero_nif: l.nif, tercero_pais: l.pais, concepto: l.concepto,
        plataforma: (l.plataforma as any) || null, periodo: l.mes || null, numero: l.fuente === "comision" ? l.numero : null,
      } });
    }
  };

  const plazos: { t: string; hasta: string }[] = [];
  if (q && plazo) {
    plazos.push({ t: `303 (IVA) y 130 (IRPF) del ${q}T`, hasta: plazo.hasta });
    if (ret111.retenciones) plazos.push({ t: `111 (retenciones) del ${q}T`, hasta: plazo.hasta111 });
    if (ue349.length) plazos.push({ t: `349 (operaciones con la UE) del ${q}T`, hasta: plazo.hasta });
    if (q === 4) {
      plazos.push({ t: `390 (resumen anual del IVA ${anio})`, hasta: plazo.hasta });
      if (t347.length) plazos.push({ t: `347 (más de 3.005,06 € con un mismo cliente o proveedor)`, hasta: `${anio + 1}-02-${(anio + 1) % 4 === 0 ? 29 : 28}` });
      plazos.push({ t: `Renta ${anio}`, hasta: `${anio + 1}-06-30` });
    }
  }

  const tabQ = (n: number, t: string) => (
    <button key={n} onClick={() => setQ(n)} style={{
      padding: "8px 13px", borderRadius: 8, border: "1px solid " + (q === n ? C.accent : C.border), cursor: "pointer", fontFamily: F,
      background: q === n ? C.accent + "18" : C.card, color: q === n ? C.accent : C.mutedL, fontWeight: 800, fontSize: 13,
    }}>{t}</button>
  );
  const anioMin = Math.min(datos.primer_anio || anio, anio);
  const anioMax = Math.max(Number(hoy.slice(0, 4)), anio);
  const flecha = (dis: boolean): React.CSSProperties => ({ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.border, background: C.card, color: dis ? C.muted : C.text, cursor: dis ? "default" : "pointer", fontSize: 16 });

  return (
    <div>
      <Cabecera titulo="Impuestos" sub="IVA, IRPF y plazos con las facturas del panel, las que subes a Archivos y el gasto de anuncios">
        <Btn onClick={() => setForm({ inicial: { tipo: "gasto" } })}>Apuntar gasto</Btn>
        <Btn outline onClick={() => setSubir({ carpeta: `Facturas recibidas/${anio}`, tipo: "factura_recibida" })}>Subir factura</Btn>
        <Btn outline color={C.mutedL} onClick={() => setAjustes(true)}>Ajustes</Btn>
      </Cabecera>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={flecha(anio <= anioMin)} disabled={anio <= anioMin} onClick={() => setAnio(anio - 1)} aria-label="Año anterior">‹</button>
          <span style={{ fontWeight: 800, fontSize: 15, color: C.text, minWidth: 44, textAlign: "center" }}>{anio}</span>
          <button style={flecha(anio >= anioMax)} disabled={anio >= anioMax} onClick={() => setAnio(anio + 1)} aria-label="Año siguiente">›</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[1, 2, 3, 4].map((n) => tabQ(n, n + "T"))}{tabQ(0, "Año")}
        </div>
        {cargando && <span style={{ fontSize: 12, color: C.muted }}>Actualizando…</span>}
        <span style={{ flex: 1 }} />
        <Btn small outline color={C.mutedL} onClick={() => descargarTexto(`Libro_ingresos_gastos_${anio}_${q ? q + "T" : "anual"}.csv`, csvLibro(delPeriodo))}>Descargar para la gestoría (CSV)</Btn>
      </div>

      <Respuesta pregunta={pregunta} tono={tono as any}
        texto={q ? <>{textoQ}{textoPlazo}</> : <>Ingresos {eur(ingresos)} · gastos {eur(gastosDed)} · beneficio {eur(ingresos - gastosDed)}.</>}
        detalle={<>
          {estimados.length ? <>Hay {estimados.length} apunte{estimados.length > 1 ? "s" : ""} estimado{estimados.length > 1 ? "s" : ""} (gasto de campañas o cobros sin la factura subida). </> : null}
          {pendientes.length ? <>Abajo tienes lo que falta para que salga exacto. </> : <>Todo lo del periodo tiene su factura. </>}
          Es un cálculo para preparar los modelos: revísalo con tu gestoría antes de presentar.
        </>} />

      <Grid min={165}>
        <Kpi label="Ingresos (sin IVA)" valor={eur(ingresos)} sub={ing.length + " facturas"} />
        <Kpi label="Gastos deducibles" valor={eur(gastosDed)} sub={gas.length + " apuntes"} />
        <Kpi label="Beneficio" valor={eur(ingresos - gastosDed)} color={ingresos - gastosDed >= 0 ? C.green : C.red} sub="Ingresos − gastos" />
        <Kpi label={q ? "IVA (303)" : "IVA del año"} valor={eur(iva)} color={iva > 0 ? C.orange : C.green} sub={iva > 0 ? "A ingresar" : iva < 0 ? "A tu favor" : "Cero"} />
        <Kpi label={q ? "IRPF (130)" : "Pagos de IRPF del año"} valor={eur(Math.max(0, irpf))} color={irpf > 0 ? C.orange : C.green} sub={q ? "Pago a cuenta" : "Suma de los 130"} />
        <Kpi label="Para apartar" valor={eur(pagar)} color={pagar > 0 ? C.accent : C.text} sub={q ? "IVA + IRPF de este trimestre" : "Lo que salió a pagar"} />
      </Grid>

      {plazos.length > 0 && (
        <Card>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.mutedL, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Plazos</div>
          {plazos.map((p, i) => {
            const dd = diasHasta(p.hasta);
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "2px 10px", padding: "7px 0", borderTop: i ? "1px solid " + C.border + "66" : undefined, fontSize: 13.5, flexWrap: "wrap" }}>
                <span style={{ color: C.text }}>{p.t}</span>
                <span style={{ color: dd < 0 ? C.muted : dd <= 15 ? C.orange : C.mutedL }}>hasta el {fechaLarga(p.hasta)}{dd >= 0 ? ` · ${dd} días` : " · pasado"}</span>
              </div>
            );
          })}
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Si domicilias el pago, el plazo acaba 5 días antes. Si el último día es festivo, pasa al siguiente día hábil.</div>
        </Card>
      )}

      {pendientes.length > 0 && (
        <>
          <Titulo>Para que salga exacto</Titulo>
          <div style={{ border: "1px solid " + C.border, borderRadius: 12, background: C.card, marginBottom: 12 }}>
            {pendientes.map((p, i) => (
              <div key={p.k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i ? "1px solid " + C.border + "88" : undefined, flexWrap: movil ? "wrap" : "nowrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: p.grave ? C.red : C.orange, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: C.text, lineHeight: 1.45, minWidth: 0 }}>{p.t}</span>
                {p.acc}
              </div>
            ))}
          </div>
        </>
      )}

      {q ? (
        <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1fr 1fr", gap: 12 }}>
          <Card style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>IVA · modelo 303</div>
              <div style={{ fontSize: 12, color: C.mutedL }}>{q}T {anio}</div>
            </div>
            <TablaCasillas filas={filas303} />
          </Card>
          <Card style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>IRPF · modelo 130</div>
              <div style={{ fontSize: 12, color: C.mutedL }}>acumulado del año</div>
            </div>
            <TablaCasillas filas={filas130} colBase="" colIva="Importe" />
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
              Estimación directa simplificada: 20 % del beneficio acumulado menos lo ya pagado. Los trimestres anteriores se calculan como presentados con estos datos.
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>Resumen del año por trimestres</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F, fontSize: 13, minWidth: 520 }}>
              <thead><tr>{["Trimestre", "Ingresos", "Gastos", "IVA (303)", "IRPF (130)", "Plazo"].map((h, i) => <th key={h} style={{ ...th, textAlign: i ? "right" : "left" }}>{h}</th>)}</tr></thead>
              <tbody>
                {[1, 2, 3, 4].map((n) => {
                  const ls = lineas.filter((l) => l.q === n);
                  const pl = plazoTrimestre(anio, n);
                  return (
                    <tr key={n} onClick={() => setQ(n)} style={{ borderTop: "1px solid " + C.border + "66", cursor: "pointer" }}>
                      <td style={{ padding: "8px 10px", color: C.text, fontWeight: 800 }}>{n}T</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: C.text }}>{eur(sumBase(ls.filter((l) => l.tipo === "ingreso")), 2)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: C.text }}>{eur(r2(ls.filter((l) => l.tipo === "gasto").reduce((s, l) => s + l.base * (l.deducible ?? 100) / 100, 0)), 2)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: r303[n - 1].final > 0 ? C.orange : C.green, fontWeight: 700 }}>{eur(r303[n - 1].final, 2)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: r130[n - 1].resultado > 0 ? C.orange : C.green, fontWeight: 700 }}>{eur(Math.max(0, r130[n - 1].resultado), 2)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: C.mutedL }}>{fechaLarga(pl.hasta)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 13, color: C.mutedL, marginTop: 10, lineHeight: 1.55 }}>
            Rendimiento neto del año (para la Renta): <b style={{ color: C.text }}>{eur(r130[3].neto, 2)}</b> · IVA devengado {eur(r2(r303.reduce((s, x) => s + x.devengado, 0)), 2)} · deducible {eur(r2(r303.reduce((s, x) => s + x.deducible, 0)), 2)}.
          </div>
        </Card>
      )}

      {(ret111.retenciones > 0 || ue349.length > 0 || (t347.length > 0 && (!q || q === 4))) && (
        <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginTop: 12 }}>
          {ret111.retenciones > 0 && (
            <Card style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>Retenciones · modelo 111</div>
              <div style={{ fontSize: 13, color: C.mutedL, lineHeight: 1.6 }}>
                {ret111.n} profesional{ret111.n > 1 ? "es" : ""} · base {eur(ret111.base, 2)} · a ingresar <b style={{ color: C.orange }}>{eur(ret111.retenciones, 2)}</b>
              </div>
            </Card>
          )}
          {ue349.length > 0 && (
            <Card style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>Operaciones con la UE · modelo 349</div>
              {ue349.map((x) => (
                <div key={x.clave + x.nif} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "5px 0", borderTop: "1px solid " + C.border + "55" }}>
                  <span style={{ color: C.text }}><b>{x.clave}</b> · {x.nombre} <span style={{ color: C.muted }}>{x.nif}</span></span>
                  <span style={{ color: C.text, fontWeight: 700 }}>{eur(x.base, 2)}</span>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>I = servicios que compras a empresas de la UE · S = servicios que vendes.</div>
            </Card>
          )}
          {t347.length > 0 && (!q || q === 4) && (
            <Card style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>Más de 3.005,06 € al año · modelo 347</div>
              {t347.map((x) => (
                <div key={x.lado + x.nombre} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "5px 0", borderTop: "1px solid " + C.border + "55" }}>
                  <span style={{ color: C.text }}>{x.nombre} <span style={{ color: C.muted }}>{x.nif || "sin NIF"} · {x.lado.toLowerCase()}</span></span>
                  <span style={{ color: C.text, fontWeight: 700 }}>{eur(x.total, 2)}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1fr 1fr", gap: 12, marginTop: 12 }}>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10 }}>De dónde vienen los ingresos</div>
          {catIng.length ? catIng.map((x, i) => <BarraH key={x.k} label={nombreCategoria("ingreso", x.k)} valor={Math.round(x.v)} total={Math.round(ingresos) || 1} color={colores[i % colores.length]} extra={eur(x.v)} />)
            : <div style={{ fontSize: 13, color: C.muted }}>Sin ingresos en este periodo.</div>}
        </Card>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10 }}>En qué se va el dinero</div>
          {catGas.length ? catGas.map((x, i) => <BarraH key={x.k} label={nombreCategoria("gasto", x.k)} valor={Math.round(x.v)} total={Math.round(catGas.reduce((s, y) => s + y.v, 0)) || 1} color={colores[i % colores.length]} extra={eur(x.v)} />)
            : <div style={{ fontSize: 13, color: C.muted }}>Sin gastos en este periodo.</div>}
        </Card>
      </div>

      <Titulo accion={<div style={{ display: "flex", gap: 6 }}>
        {(["gasto", "ingreso"] as const).map((t) => (
          <button key={t} onClick={() => { setLibro(t); setVerTodo(false); }} style={{
            padding: "6px 11px", borderRadius: 8, border: "1px solid " + (libro === t ? C.accent : C.border), cursor: "pointer", fontFamily: F,
            background: libro === t ? C.accent + "18" : C.card, color: libro === t ? C.accent : C.mutedL, fontWeight: 800, fontSize: 12,
          }}>{t === "gasto" ? `Gastos (${gas.length})` : `Ingresos (${ing.length})`}</button>
        ))}
      </div>}>Libro {libro === "gasto" ? "de gastos" : "de ingresos"} · {q ? q + "T " + anio : anio}</Titulo>
      <div style={{ overflowX: "auto", border: "1px solid " + C.border, borderRadius: 12, background: C.card, marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F, fontSize: 13, minWidth: 760 }}>
          <thead><tr>{["Fecha", "Nº", libro === "gasto" ? "Proveedor" : "Cliente", "Concepto", "Base", "IVA", "Total", "Origen"].map((h, i) => <th key={h} style={{ ...th, textAlign: i >= 4 && i <= 6 ? "right" : "left" }}>{h}</th>)}</tr></thead>
          <tbody>
            {verFilas.length === 0 && <tr><td colSpan={8} style={{ padding: 18, color: C.muted, textAlign: "center" }}>Nada en este periodo</td></tr>}
            {verFilas.map((l) => {
              const fu = fuenteDe(l);
              return (
                <tr key={l.key} onClick={() => abrirLinea(l)} style={{ borderTop: "1px solid " + C.border + "88", cursor: "pointer" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.cardHi; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <td style={td}>{fechaCorta(l.fecha)}</td>
                  <td style={{ ...td, color: C.mutedL }}>{l.numero || "—"}</td>
                  <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{l.tercero || "—"}{l.aviso && !l.estimado ? <span title={l.aviso} style={{ color: C.orange }}> ⚠</span> : null}</td>
                  <td style={{ ...td, color: C.mutedL, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>{l.concepto || nombreCategoria(l.tipo, l.categoria)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{eur(l.base, 2)}</td>
                  <td style={{ ...td, textAlign: "right", color: l.regimen === "general" ? C.text : C.muted }} title={l.regimen !== "general" ? "Sin IVA en la factura" : undefined}>{l.regimen === "general" ? eur(l.iva, 2) : l.regimen === "intracomunitario" || l.regimen === "isp_extranjero" ? "ISP" : "—"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{eur(l.total, 2)}</td>
                  <td style={td}><Pill texto={fu.t} color={fu.c} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filasLibro.length > 40 && !verTodo && <Btn small outline onClick={() => setVerTodo(true)}>Ver los {filasLibro.length}</Btn>}
      <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.55 }}>
        Cuenta la fecha de la factura, no la del cobro. «ISP»: factura sin IVA de una empresa de fuera (el IVA se suma y se resta en el 303). Pulsa una fila para corregirla o para apuntar su factura real.
      </div>

      {form && (
        <FormApunte inicial={form.inicial} roi={cfg.roi} archivoNombre={form.archivoNombre} onClose={() => setForm(null)}
          onGuardado={(_, m) => { setForm(null); aviso(m); cargar(); }} />
      )}
      {ajustes && <Ajustes cfg={cfg} anio={anio} onClose={() => setAjustes(false)} onGuardado={(m) => { setAjustes(false); aviso(m); cargar(); }} />}
      {subir && (
        <Subida carpetas={["Facturas recibidas", `Facturas recibidas/${anio}`, "Facturas emitidas", "Impuestos", "Banco y pagos", "Otros", subir.carpeta]}
          carpetaInicial={subir.carpeta} tipoInicial={subir.tipo} pros={d.pros}
          onClose={() => setSubir(null)}
          onHecho={(ids, tipo, m) => {
            const preset = subir.preset;
            setSubir(null); aviso(m);
            if (ids.length === 1) setForm({ inicial: { tipo: tipo === "factura_emitida" ? "ingreso" : "gasto", fecha: hoy, ...(preset || {}), archivo_id: ids[0] }, archivoNombre: "Factura recién subida" });
            else cargar();
          }} />
      )}
    </div>
  );
}
const td: React.CSSProperties = { padding: "9px 10px", color: C.text, whiteSpace: "nowrap", verticalAlign: "middle" };
