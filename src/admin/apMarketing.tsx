// ============================================================
// OficioYa · ADMIN — MARKETING: gasto en Ads (manual) y ROAS
// ============================================================
import React, { useMemo, useState } from "react";
import { db } from "../supabase";
import {
  C, F, Card, Btn, Pill, Cabecera, Sel, Campo, Tabla, Grid, Kpi, Titulo,
  SeccionProps, Gasto, ts, tsMadrid, ymdMadrid, sumarDias, diaSemana, mesHoy, mesMover, diasDelMes,
  fecha, eur, num, oficioDe,
} from "./apUi";
import { gastoEnRango } from "./apResumen";

const PLATAFORMA: Record<string, string> = { google_ads: "Google Ads", meta_ads: "Meta Ads", otro: "Otro" };

export default function Marketing({ d, recargar, aviso }: SeccionProps) {
  const hoy = ymdMadrid(Date.now());
  const lunes = sumarDias(hoy, -diaSemana(hoy));
  const [desde, setDesde] = useState(sumarDias(lunes, -7));
  const [hasta, setHasta] = useState(sumarDias(lunes, -1));
  const [plataforma, setPlataforma] = useState("google_ads");
  const [oficio, setOficio] = useState("");
  const [importe, setImporte] = useState("");
  const [clics, setClics] = useState("");
  const [conv, setConv] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const oficios = Array.from(new Set([...d.precios.filter((p) => p.trade_key !== "_default").map((p) => oficioDe(p.trade_key)), ...d.leads.map((l) => oficioDe(l.trade))]));

  const metricas = (a: number, b: number, of?: string | null) => {
    const leads = d.leads.filter((l) => !l.anulado && ts(l.created_at) >= a && ts(l.created_at) < b && (!of || oficioDe(l.trade) === oficioDe(of)));
    const solicitudes = d.solicitudes.filter((s) => ts(s.created_at) >= a && ts(s.created_at) < b && (!of || oficioDe(s.oficio) === oficioDe(of))).length
      + leads.filter((l) => l.canal === "llamada").length;
    return { leads: leads.length, solicitudes, ingresos: leads.reduce((s, l) => s + Number(l.price), 0) };
  };

  const periodo = (tipo: "semana" | "mes" | "mesAnt") => {
    if (tipo === "semana") { setDesde(sumarDias(lunes, -7)); setHasta(sumarDias(lunes, -1)); }
    if (tipo === "mes") { setDesde(mesHoy() + "-01"); setHasta(hoy); }
    if (tipo === "mesAnt") { const m = mesMover(mesHoy(), -1); setDesde(m + "-01"); setHasta(m + "-" + String(diasDelMes(m)).padStart(2, "0")); }
  };

  const guardar = async () => {
    const imp = Number(importe.replace(/\./g, "").replace(",", "."));
    if (!desde || !hasta || hasta < desde) { aviso("Revisa las fechas"); return; }
    if (!(imp >= 0) || importe.trim() === "") { aviso("Pon el importe gastado"); return; }
    setGuardando(true);
    const { error } = await db.from("ad_spend").insert({
      desde, hasta, plataforma, oficio: oficio || null, importe: imp,
      clics: clics ? Number(clics) : null, conversiones: conv ? Number(conv.replace(",", ".")) : null, nota: nota.trim() || null,
    });
    setGuardando(false);
    if (error) { aviso("Error: " + error.message); return; }
    setImporte(""); setClics(""); setConv(""); setNota("");
    aviso("Gasto guardado");
    recargar();
  };
  const borrar = async (g: Gasto) => {
    if (!confirm("¿Borrar el gasto de " + fecha(g.desde) + " a " + fecha(g.hasta) + " (" + eur(g.importe, 2) + ")?")) return;
    await db.from("ad_spend").delete().eq("id", g.id);
    aviso("Gasto borrado");
    recargar();
  };

  // Semanas (últimas 10)
  const semanas = useMemo(() => {
    const out = [];
    for (let i = 0; i < 10; i++) {
      const ini = sumarDias(lunes, -7 * i);
      const a = tsMadrid(ini), b = tsMadrid(sumarDias(ini, 7));
      const gasto = gastoEnRango(d.gastos, a, b);
      const m = metricas(a, b);
      out.push({ ini, gasto, ...m });
    }
    return out;
  }, [d, lunes]);

  const total30 = useMemo(() => {
    const b = Date.now(), a = b - 30 * 86400000;
    const gasto = gastoEnRango(d.gastos, a, b);
    return { gasto, ...metricas(a, b) };
  }, [d]);
  const roas30 = total30.gasto > 0 ? total30.ingresos / total30.gasto : null;
  const ultimoGasto = d.gastos.length ? d.gastos.reduce((m, g) => (g.hasta > m ? g.hasta : m), d.gastos[0].hasta) : null;

  return (
    <div>
      <Cabecera titulo="Marketing y ROAS" sub="Google Ads no está conectado: mete el coste cada semana o cada mes y aquí se calcula todo" />

      <Grid min={180}>
        <Kpi label="Gasto últimos 30 días" valor={total30.gasto ? eur(total30.gasto) : "Sin datos"} sub={ultimoGasto ? "Último gasto metido hasta el " + fecha(ultimoGasto) : "Aún no has metido gasto"} />
        <Kpi label="Ingresos por leads (30 días)" valor={eur(total30.ingresos)} color={C.green} sub={total30.leads + " leads a profesionales"} />
        <Kpi label="ROAS (30 días)" valor={roas30 ? num(roas30, 2) + "x" : "—"} color={roas30 && roas30 >= 1 ? C.green : roas30 ? C.red : C.text} sub="Por encima de 1x ganas dinero con los anuncios" />
        <Kpi label="Coste por solicitud" valor={total30.gasto && total30.solicitudes ? eur(total30.gasto / total30.solicitudes, 2) : "—"} sub={total30.solicitudes + " solicitudes en 30 días"} />
        <Kpi label="Margen (30 días)" valor={total30.gasto ? eur(total30.ingresos - total30.gasto) : "—"} color={total30.ingresos - total30.gasto >= 0 ? C.green : C.red} sub="Ingresos por leads menos gasto en Ads" />
      </Grid>

      <Titulo>Añadir gasto</Titulo>
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Btn small outline onClick={() => periodo("semana")}>Semana pasada</Btn>
          <Btn small outline onClick={() => periodo("mes")}>Este mes hasta hoy</Btn>
          <Btn small outline onClick={() => periodo("mesAnt")}>Mes pasado</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
          <Campo label="Desde" type="date" value={desde} onChange={setDesde} />
          <Campo label="Hasta (incluido)" type="date" value={hasta} onChange={setHasta} />
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>Plataforma</label>
            <Sel value={plataforma} onChange={setPlataforma} style={{ width: "100%" }} options={Object.entries(PLATAFORMA).map(([v, l]) => ({ v, l }))} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>Oficio</label>
            <Sel value={oficio} onChange={setOficio} style={{ width: "100%" }} options={[{ v: "", l: "Toda la campaña" }, ...oficios.map((o) => ({ v: o.toLowerCase(), l: o }))]} />
          </div>
          <Campo label="Coste (€)" value={importe} onChange={setImporte} inputMode="decimal" placeholder="Ej. 245,60" />
          <Campo label="Clics (opcional)" value={clics} onChange={setClics} inputMode="numeric" />
          <Campo label="Conversiones Ads (opcional)" value={conv} onChange={setConv} inputMode="decimal" />
        </div>
        <Campo label="Nota (opcional)" value={nota} onChange={setNota} placeholder="Ej. Campaña Profesionales_Sevilla_Busqueda" />
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Si el gasto es de toda la campaña, déjalo en "Toda la campaña". Si lo separas por grupos de anuncios, mete una línea por oficio y verás el ROAS de cada uno.</div>
        <Btn onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Guardar gasto"}</Btn>
      </Card>

      <Titulo>Por semana</Titulo>
      <Tabla
        cols={[{ k: "sem", l: "Semana" }, { k: "gasto", l: "Gasto", align: "right" }, { k: "sol", l: "Solicitudes", align: "right" }, { k: "leads", l: "Leads cobrables", align: "right" }, { k: "ing", l: "Ingresos", align: "right" }, { k: "cpl", l: "Coste/solicitud", align: "right" }, { k: "roas", l: "ROAS", align: "right" }, { k: "margen", l: "Margen", align: "right" }]}
        filas={semanas.map((s) => ({
          sem: <b>{fecha(s.ini)} – {fecha(sumarDias(s.ini, 6))}</b>,
          gasto: s.gasto ? eur(s.gasto) : <span style={{ color: C.muted }}>sin dato</span>,
          sol: num(s.solicitudes), leads: num(s.leads), ing: eur(s.ingresos),
          cpl: s.gasto && s.solicitudes ? eur(s.gasto / s.solicitudes, 2) : "—",
          roas: s.gasto ? <span style={{ color: s.ingresos / s.gasto >= 1 ? C.green : C.red, fontWeight: 800 }}>{num(s.ingresos / s.gasto, 2)}x</span> : "—",
          margen: s.gasto ? eur(s.ingresos - s.gasto) : "—",
        }))}
      />

      <Titulo>Gastos metidos</Titulo>
      <Tabla
        cols={[{ k: "per", l: "Periodo" }, { k: "pla", l: "Plataforma" }, { k: "of", l: "Oficio" }, { k: "imp", l: "Coste", align: "right" }, { k: "clics", l: "Clics", align: "right" }, { k: "leads", l: "Leads", align: "right" }, { k: "ing", l: "Ingresos", align: "right" }, { k: "roas", l: "ROAS", align: "right" }, { k: "acc", l: "", align: "right" }]}
        filas={d.gastos.map((g) => {
          const m = metricas(tsMadrid(g.desde), tsMadrid(sumarDias(g.hasta, 1)), g.oficio);
          return {
            per: fecha(g.desde) + " – " + fecha(g.hasta),
            pla: PLATAFORMA[g.plataforma] || g.plataforma,
            of: g.oficio ? oficioDe(g.oficio) : <span style={{ color: C.mutedL }}>Toda la campaña</span>,
            imp: <b>{eur(g.importe, 2)}</b>, clics: g.clics != null ? num(g.clics) : "—",
            leads: num(m.leads), ing: eur(m.ingresos),
            roas: g.importe > 0 ? <span style={{ color: m.ingresos / g.importe >= 1 ? C.green : C.red, fontWeight: 800 }}>{num(m.ingresos / g.importe, 2)}x</span> : "—",
            acc: <Btn small outline color={C.red} onClick={() => borrar(g)}>Borrar</Btn>,
          };
        })}
        vacio="Todavía no has metido ningún gasto"
      />
      <div style={{ fontSize: 12, color: C.muted }}>ROAS = ingresos por leads cobrables (sin IVA) ÷ coste de Ads del mismo periodo.</div>
    </div>
  );
}
