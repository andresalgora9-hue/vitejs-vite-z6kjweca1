// ============================================================
// OficioYa · ADMIN — RESUMEN (métricas, estados y previsiones)
// ============================================================
import React, { useMemo, useState } from "react";
import {
  C, Card, Kpi, Grid, Titulo, Cabecera, SelectorMes, Tabla, BarraH, Barras, Pill, Btn,
  SeccionProps, Gasto, ESTADOS, CANAL_LABEL, INICIO_ALTAS,
  ts, tsMadrid, ymdMadrid, sumarDias, diaSemana,
  mesDe, mesHoy, mesMover, mesNombre, diasDelMes, eur, num, pct, duracion, hace, oficioDe,
} from "./apUi";

const DIA = 86400000;

// Gasto de Ads repartido por días entre [ini, fin)
export function gastoEnRango(gastos: Gasto[], ini: number, fin: number, oficio?: string) {
  return gastos.reduce((s, g) => {
    if (oficio && g.oficio && oficioDe(g.oficio) !== oficio) return s;
    if (oficio && !g.oficio) return s; // el gasto general no se reparte por oficio
    const gi = tsMadrid(g.desde);
    const gf = tsMadrid(sumarDias(g.hasta, 1));
    const solape = Math.max(0, Math.min(fin, gf) - Math.max(ini, gi));
    return s + (gf > gi ? Number(g.importe) * (solape / (gf - gi)) : 0);
  }, 0);
}

export function rangoMes(k: string): [number, number] {
  return [tsMadrid(k + "-01"), tsMadrid(mesMover(k, 1) + "-01")];
}

export default function Resumen({ d, irA }: SeccionProps) {
  const [mes, setMes] = useState(mesHoy());
  const ahora = Date.now();
  const [ini, fin] = rangoMes(mes);
  const [iniAnt, finAnt] = rangoMes(mesMover(mes, -1));
  const esMesActual = mes === mesHoy();

  const r = useMemo(() => {
    const enRango = (s: string, a: number, b: number) => { const t = ts(s); return t >= a && t < b; };
    const leads = d.leads.filter((l) => !l.anulado);
    const leadsMes = leads.filter((l) => enRango(l.created_at, ini, fin));
    const leadsAnt = leads.filter((l) => enRango(l.created_at, iniAnt, finAnt));
    const llamadas = (a: number, b: number) => leads.filter((l) => l.canal === "llamada" && enRango(l.created_at, a, b)).length;
    const demanda = (a: number, b: number) => d.solicitudes.filter((s) => enRango(s.created_at, a, b)).length + llamadas(a, b);
    const ingresos = (ls: typeof leads) => ls.reduce((s, l) => s + Number(l.price || 0), 0);
    const facts = d.facturas.filter((f) => f.status !== "anulada");
    const facturadoMes = facts.filter((f) => enRango(f.issued_at, ini, fin)).reduce((s, f) => s + Number(f.total), 0);
    const cobradoMes = facts.filter((f) => f.status === "pagada" && f.paid_at && enRango(f.paid_at, ini, fin)).reduce((s, f) => s + Number(f.total), 0);
    const pendientes = facts.filter((f) => f.status === "pendiente");
    const vencidas = pendientes.filter((f) => ts(f.due_at) < ahora);
    const sinFacturar = leads.filter((l) => !l.invoice_id).reduce((s, l) => s + Number(l.price || 0), 0);
    const gastoMes = gastoEnRango(d.gastos, ini, fin);
    const gastoAnt = gastoEnRango(d.gastos, iniAnt, finAnt);
    const ingMes = ingresos(leadsMes);
    const ingAnt = ingresos(leadsAnt);

    // Previsión de cierre de mes (ritmo diario)
    const diasMes = diasDelMes(mes);
    const diaHoy = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }).slice(8, 10));
    const factor = esMesActual ? diasMes / Math.max(1, diaHoy) : 1;

    // Próximos 7 días = últimos 7
    const ult7 = leads.filter((l) => ahora - ts(l.created_at) < 7 * DIA);
    const ant7 = leads.filter((l) => { const t = ahora - ts(l.created_at); return t >= 7 * DIA && t < 14 * DIA; });

    // Estados
    const porEstado = ESTADOS.map((e) => ({ ...e, n: leadsMes.filter((l) => l.estado === e.id).length }));
    const tiempos = leadsMes.filter((l) => l.primer_contacto_at).map((l) => (ts(l.primer_contacto_at) - ts(l.created_at)) / 60000).filter((m) => m >= 0);
    const respuesta = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;
    const sinContactar = leads.filter((l) => l.estado === "nuevo" && ahora - ts(l.created_at) > 2 * 3600000)
      .sort((a, b) => ts(a.created_at) - ts(b.created_at));

    // Por oficio
    const oficios = Array.from(new Set(leadsMes.map((l) => oficioDe(l.trade))));
    const porOficio = oficios.map((o) => {
      const ls = leadsMes.filter((l) => oficioDe(l.trade) === o);
      const g = ls.filter((l) => l.estado === "ganado");
      const gasto = gastoEnRango(d.gastos, ini, fin, o);
      const ing = ingresos(ls);
      return { o, n: ls.length, ing, g: g.length, imp: g.reduce((s, l) => s + Number(l.presupuesto_eur || 0), 0), gasto, roas: gasto > 0 ? ing / gasto : null };
    }).sort((a, b) => b.ing - a.ing);

    // Por canal
    const porCanal = ["formulario", "whatsapp", "llamada"].map((c) => ({ c, n: leadsMes.filter((l) => l.canal === c).length }));

    // Por profesional
    const proIds = Array.from(new Set(leadsMes.map((l) => l.pro_id)));
    const porPro = proIds.map((id) => {
      const ls = leadsMes.filter((l) => l.pro_id === id);
      const t = ls.filter((l) => l.primer_contacto_at).map((l) => (ts(l.primer_contacto_at) - ts(l.created_at)) / 60000);
      const pend = leads.filter((l) => l.pro_id === id && !l.invoice_id).reduce((s, l) => s + Number(l.price || 0), 0);
      const venc = vencidas.filter((f) => f.pro_id === id).reduce((s, f) => s + Number(f.total), 0);
      return {
        id, nombre: d.proPorId[id]?.name || "—", n: ls.length, ing: ingresos(ls),
        g: ls.filter((l) => l.estado === "ganado").length, nuevos: ls.filter((l) => l.estado === "nuevo").length,
        resp: t.length ? t.reduce((a, b) => a + b, 0) / t.length : null, pend, venc,
      };
    }).sort((a, b) => b.n - a.n);

    // Semanas (demanda total: solicitudes + llamadas)
    const semanas: { etiqueta: string; valor: number; detalle?: string }[] = [];
    const hoy = ymdMadrid(ahora);
    const lunes = sumarDias(hoy, -diaSemana(hoy));
    for (let i = 11; i >= 0; i--) {
      const ymd = sumarDias(lunes, -i * 7);
      const a = tsMadrid(ymd);
      const b = tsMadrid(sumarDias(ymd, 7));
      const n = demanda(a, b);
      const conPro = leads.filter((l) => enRango(l.created_at, a, b)).length;
      semanas.push({ etiqueta: ymd.slice(8, 10) + "/" + ymd.slice(5, 7), valor: n, detalle: conPro + " a profesionales" });
    }

    // Histórico mensual desde el primer lead
    const primero = d.solicitudes.length ? mesDe(d.solicitudes[d.solicitudes.length - 1].created_at) : mesHoy();
    const meses: string[] = [];
    for (let k = mesHoy(); k >= primero && meses.length < 24; k = mesMover(k, -1)) meses.push(k);
    const historico = meses.map((k) => {
      const [a, b] = rangoMes(k);
      const ls = leads.filter((l) => enRango(l.created_at, a, b));
      const gasto = gastoEnRango(d.gastos, a, b);
      const ing = ingresos(ls);
      return {
        k, demanda: demanda(a, b), conPro: ls.length, ing, gasto, roas: gasto > 0 ? ing / gasto : null,
        facturado: facts.filter((f) => enRango(f.issued_at, a, b)).reduce((s, f) => s + Number(f.total), 0),
        cobrado: facts.filter((f) => f.status === "pagada" && f.paid_at && enRango(f.paid_at, a, b)).reduce((s, f) => s + Number(f.total), 0),
      };
    });

    // Altas de profesionales
    const nuevos = d.pros.filter((p) => ts(p.joined_at || p.created_at) >= ts(INICIO_ALTAS));
    const altasPend = nuevos.filter((p) => !["pagada", "exento"].includes(p.activacion_estado || ""));
    const altasMes = d.pros.filter((p) => enRango(p.joined_at || p.created_at || "", ini, fin)).length;
    const altasFact = facts.filter((f) => f.tipo === "activacion");

    return {
      leadsMes, leadsAnt, demandaMes: demanda(ini, fin), demandaAnt: demanda(iniAnt, finAnt), ingMes, ingAnt,
      facturadoMes, cobradoMes, pendiente: pendientes.reduce((s, f) => s + Number(f.total), 0),
      vencido: vencidas.reduce((s, f) => s + Number(f.total), 0), nVencidas: vencidas.length, sinFacturar,
      gastoMes, gastoAnt, factor, ult7, ant7, porEstado, respuesta, sinContactar, porOficio, porCanal, porPro,
      semanas, historico, nuevos, altasPend, altasMes,
      altasCobradas: altasFact.filter((f) => f.status === "pagada").reduce((s, f) => s + Number(f.base), 0),
    };
  }, [d, mes, ini, fin, iniAnt, finAnt, esMesActual, ahora]);

  const delta = (a: number, b: number) => {
    if (!b) return null;
    const p = Math.round(((a - b) / b) * 100);
    return <span style={{ color: p >= 0 ? C.green : C.red, fontWeight: 700 }}>{p >= 0 ? "▲ " : "▼ "}{Math.abs(p)}% vs mes anterior</span>;
  };
  const roas = r.gastoMes > 0 ? r.ingMes / r.gastoMes : null;
  const ingPrev = r.ingMes * r.factor;
  const gastoPrev = r.gastoMes * r.factor;
  const ing7 = r.ult7.reduce((s, l) => s + Number(l.price || 0), 0);
  const tend7 = r.ant7.length ? Math.round(((r.ult7.length - r.ant7.length) / r.ant7.length) * 100) : null;

  return (
    <div>
      <Cabecera titulo="Resumen" sub="Cómo va el negocio de leads, en un vistazo">
        <SelectorMes mes={mes} onChange={setMes} />
      </Cabecera>

      {/* Dinero */}
      <Grid min={160}>
        <Kpi label="Leads a profesionales" valor={num(r.leadsMes.length)} sub={<>{delta(r.leadsMes.length, r.leadsAnt.length) || "Mes anterior: " + r.leadsAnt.length}<br />Demanda total: {num(r.demandaMes)} solicitudes</>} />
        <Kpi label="Ingresos por leads (sin IVA)" valor={eur(r.ingMes)} color={C.green} sub={delta(r.ingMes, r.ingAnt) || undefined} />
        <Kpi label="Gasto en Ads" valor={r.gastoMes ? eur(r.gastoMes) : "Sin datos"} sub={r.gastoMes ? "CPL " + eur(r.gastoMes / Math.max(1, r.demandaMes), 2) : <a onClick={() => irA("marketing")} style={{ color: C.accent, cursor: "pointer" }}>Añadir gasto →</a>} />
        <Kpi label="ROAS" valor={roas ? num(roas, 2) + "x" : "—"} color={roas && roas >= 1 ? C.green : C.text} sub={r.gastoMes ? "Margen: " + eur(r.ingMes - r.gastoMes) : "Necesita el gasto en Ads"} />
        <Kpi label="Facturado este mes" valor={eur(r.facturadoMes)} sub={"Cobrado: " + eur(r.cobradoMes)} />
        <Kpi label="Pendiente de cobro" valor={eur(r.pendiente)} alerta={r.vencido > 0} color={r.vencido > 0 ? C.red : C.text}
          sub={r.vencido > 0 ? <span style={{ color: C.red, fontWeight: 700 }}>{r.nVencidas} vencidas · {eur(r.vencido)}</span> : "Nada vencido"} />
      </Grid>

      {/* Previsiones */}
      <Titulo>Previsiones</Titulo>
      <Grid min={160}>
        <Kpi label={esMesActual ? "Cierre de mes (al ritmo actual)" : "Mes cerrado"} valor={eur(ingPrev)} color={C.accent}
          sub={<>~{num(r.leadsMes.length * r.factor)} leads{gastoPrev ? " · gasto ~" + eur(gastoPrev) + " · ROAS ~" + num(ingPrev / gastoPrev, 1) + "x" : ""}</>} />
        <Kpi label="Próximos 7 días (según los últimos 7)" valor={"~" + r.ult7.length + " leads"} color={C.accent}
          sub={<>~{eur(ing7)} en leads{tend7 != null ? <> · <span style={{ color: tend7 >= 0 ? C.green : C.red, fontWeight: 700 }}>{tend7 >= 0 ? "▲" : "▼"} {Math.abs(tend7)}% vs semana anterior</span></> : null}</>} />
        <Kpi label="Próxima facturación (leads sin facturar)" valor={eur(r.sinFacturar)} sub={"Con IVA: " + eur(r.sinFacturar * (1 + (d.config.iva_pct || 21) / 100))} />
        <Kpi label="Profesionales nuevos" valor={String(r.nuevos.length)}
          sub={<>{r.altasPend.length} pendientes de alta ({eur(r.altasPend.length * (d.config.activacion_eur || 99))}) · altas cobradas {eur(r.altasCobradas)}</>} />
      </Grid>

      {/* Demanda semanal */}
      <Titulo>Solicitudes por semana (últimas 12)</Titulo>
      <Card>
        <Barras datos={r.semanas} formato={(v) => num(v) + " solicitudes"} />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Incluye formularios, WhatsApp y llamadas registradas, con o sin profesional asignado.</div>
      </Card>

      {/* Estados */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        <div>
          <Titulo>Estado de los leads del mes</Titulo>
          <Card>
            {r.porEstado.map((e) => <BarraH key={e.id} label={e.label} valor={e.n} total={r.leadsMes.length} color={e.color} />)}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: C.mutedL, marginTop: 6 }}>
              <span>Cierre: <b style={{ color: C.text }}>{pct(r.porEstado.find((e) => e.id === "ganado")!.n, r.leadsMes.length)}</b></span>
              <span>Respuesta media: <b style={{ color: C.text }}>{duracion(r.respuesta)}</b></span>
            </div>
          </Card>
        </div>
        <div>
          <Titulo accion={r.sinContactar.length ? <Pill texto={r.sinContactar.length + " sin llamar"} color={C.red} /> : null}>Sin contactar hace más de 2 h</Titulo>
          <Card accent={r.sinContactar.length ? C.red + "66" : undefined}>
            {r.sinContactar.length === 0
              ? <div style={{ color: C.mutedL, fontSize: 13 }}>Todos los leads están atendidos.</div>
              : r.sinContactar.slice(0, 8).map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid " + C.border + "66", fontSize: 13 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <b>{d.proPorId[l.pro_id]?.name || "—"}</b> · {l.client_name || CANAL_LABEL[l.canal]}{l.zona ? " · " + l.zona : ""}
                  </span>
                  <span style={{ color: C.red, fontWeight: 700, whiteSpace: "nowrap" }}>{hace(l.created_at)}</span>
                </div>
              ))}
            {r.sinContactar.length > 0 && <div style={{ marginTop: 10 }}><Btn small outline onClick={() => irA("leads")}>Ver en Leads</Btn></div>}
          </Card>
          <Titulo>Por canal</Titulo>
          <Card>
            {r.porCanal.map((c) => <BarraH key={c.c} label={CANAL_LABEL[c.c]} valor={c.n} total={r.leadsMes.length} color={c.c === "llamada" ? C.purple : c.c === "whatsapp" ? C.green : C.blue} />)}
          </Card>
        </div>
      </div>

      {/* Por oficio */}
      <Titulo>Por oficio · {mesNombre(mes)}</Titulo>
      <Tabla
        cols={[{ k: "o", l: "Oficio" }, { k: "n", l: "Leads", align: "right" }, { k: "ing", l: "Ingresos", align: "right" }, { k: "g", l: "Ganados", align: "right" }, { k: "imp", l: "Trabajos cerrados", align: "right" }, { k: "gasto", l: "Gasto Ads", align: "right" }, { k: "roas", l: "ROAS", align: "right" }]}
        filas={r.porOficio.map((x) => ({
          o: <b>{x.o}</b>, n: num(x.n), ing: eur(x.ing), g: x.g + " · " + pct(x.g, x.n), imp: x.imp ? eur(x.imp) : "—",
          gasto: x.gasto ? eur(x.gasto) : "—", roas: x.roas ? num(x.roas, 2) + "x" : "—",
        }))}
        vacio="Sin leads este mes"
      />

      {/* Por profesional */}
      <Titulo>Por profesional · {mesNombre(mes)}</Titulo>
      <Tabla
        cols={[{ k: "nombre", l: "Profesional" }, { k: "n", l: "Leads", align: "right" }, { k: "ing", l: "Le cobramos", align: "right" }, { k: "nuevos", l: "Sin llamar", align: "right" }, { k: "g", l: "Ganados", align: "right" }, { k: "resp", l: "Respuesta", align: "right" }, { k: "pend", l: "Sin facturar", align: "right" }, { k: "venc", l: "Vencido", align: "right" }]}
        filas={r.porPro.map((x) => ({
          nombre: <b>{x.nombre}</b>, n: num(x.n), ing: eur(x.ing), nuevos: x.nuevos ? <span style={{ color: C.orange, fontWeight: 800 }}>{x.nuevos}</span> : "0",
          g: x.g + " · " + pct(x.g, x.n), resp: duracion(x.resp), pend: eur(x.pend), venc: x.venc ? <span style={{ color: C.red, fontWeight: 800 }}>{eur(x.venc)}</span> : "—",
        }))}
        onFila={() => irA("profesionales")}
        vacio="Sin leads este mes"
      />

      {/* Histórico */}
      <Titulo>Histórico mensual (incluye los leads antiguos)</Titulo>
      <Tabla
        cols={[{ k: "k", l: "Mes" }, { k: "demanda", l: "Solicitudes", align: "right" }, { k: "conPro", l: "A profesionales", align: "right" }, { k: "ing", l: "Ingresos leads", align: "right" }, { k: "gasto", l: "Gasto Ads", align: "right" }, { k: "roas", l: "ROAS", align: "right" }, { k: "facturado", l: "Facturado", align: "right" }, { k: "cobrado", l: "Cobrado", align: "right" }]}
        filas={r.historico.map((h) => ({
          k: <b>{mesNombre(h.k)}</b>, demanda: num(h.demanda), conPro: h.conPro ? num(h.conPro) : "—", ing: h.ing ? eur(h.ing) : "—",
          gasto: h.gasto ? eur(h.gasto) : "—", roas: h.roas ? num(h.roas, 2) + "x" : "—", facturado: h.facturado ? eur(h.facturado) : "—", cobrado: h.cobrado ? eur(h.cobrado) : "—",
        }))}
      />
      <div style={{ fontSize: 12, color: C.muted }}>Antes del 14/10/2026 el modelo era a comisión: esos meses solo tienen solicitudes. El detalle antiguo está en "CRM antiguo".</div>
    </div>
  );
}
