// ============================================================
// OficioYa · ADMIN — FACTURAS (por profesional y todas)
// ============================================================
import React, { useMemo, useState } from "react";
import { db } from "../supabase";
import { descargarFacturaPdf } from "../pro/facturaPdf";
import {
  C, F, Card, Btn, Pill, Cabecera, Sel, Modal, Tabla, Grid, Kpi,
  SeccionProps, Factura, ts, fecha, eur, num,
} from "./apUi";

export function estadoFactura(f: Factura) {
  if (f.status === "pagada") return { t: "Pagada", c: C.green };
  if (f.status === "anulada") return { t: "Anulada", c: C.muted };
  const dias = Math.ceil((ts(f.due_at) - Date.now()) / 86400000);
  if (dias < 0) return { t: "Vencida " + Math.abs(dias) + " d", c: C.red };
  return { t: dias === 0 ? "Vence hoy" : "Vence en " + dias + " d", c: C.orange };
}

export function GestionFactura({ f, d, onClose, onHecho }: { f: Factura; d: SeccionProps["d"]; onClose: () => void; onHecho: (m: string) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const e = estadoFactura(f);
  const pro = d.proPorId[f.pro_id];

  const estado = async (nuevo: "pagada" | "pendiente" | "anulada") => {
    if (nuevo === "anulada" && !confirm("¿Anular la factura " + f.number + "? Sus leads volverán a quedar pendientes de facturar. Hazlo solo si es un error.")) return;
    setOcupado(true);
    const { error } = await db.rpc("oy_factura_estado", { p_id: f.id, p_estado: nuevo });
    setOcupado(false);
    if (error) { alert("Error: " + error.message); return; }
    onHecho(nuevo === "pagada" ? "Factura marcada como pagada" : nuevo === "pendiente" ? "Factura marcada como pendiente" : "Factura anulada");
  };
  const pdf = async () => {
    setOcupado(true);
    try {
      const { data } = await db.from("pro_leads").select("created_at,trade,canal,zona,price").eq("invoice_id", f.id);
      await descargarFacturaPdf(f as any, (data || []) as any);
    } catch { alert("No se ha podido generar el PDF"); }
    setOcupado(false);
  };

  const fila = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid " + C.border + "66", fontSize: 13 }}>
      <span style={{ color: C.mutedL }}>{k}</span><span style={{ textAlign: "right" }}>{v || "—"}</span>
    </div>
  );

  return (
    <Modal titulo={"Factura " + f.number} onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <Pill texto={e.t} color={e.c} />
        <Pill texto={f.tipo === "activacion" ? "Alta de profesional" : f.n_leads + " leads"} color={C.mutedL} />
      </div>
      {fila("Profesional", pro?.name || f.cliente_nombre)}
      {fila("Facturado a", <>{f.cliente_nombre}<br /><span style={{ color: C.mutedL }}>{f.cliente_nif || "Sin NIF"} · {f.cliente_direccion || "Sin dirección"}</span></>)}
      {fila("Emitida", fecha(f.issued_at))}
      {fila("Vence", fecha(f.due_at))}
      {f.paid_at && fila("Pagada", fecha(f.paid_at))}
      {fila("Base", eur(f.base, 2))}
      {fila("IVA " + num(f.iva_pct) + "%", eur(f.iva, 2))}
      {fila("Total", <b>{eur(f.total, 2)}</b>)}
      {(!f.cliente_nif || !f.cliente_direccion) && <div style={{ fontSize: 12, color: C.orange, marginTop: 8 }}>Faltaban datos fiscales del profesional al emitirla.</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        <Btn onClick={pdf} disabled={ocupado}>Descargar PDF</Btn>
        {f.status !== "pagada" && f.status !== "anulada" && <Btn color={C.green} onClick={() => estado("pagada")} disabled={ocupado}>Marcar pagada</Btn>}
        {f.status === "pagada" && <Btn outline color={C.orange} onClick={() => estado("pendiente")} disabled={ocupado}>Volver a pendiente</Btn>}
        {f.status !== "anulada" && <Btn outline color={C.red} onClick={() => estado("anulada")} disabled={ocupado}>Anular</Btn>}
        {pro?.phone && <Btn outline color={C.mutedL} href={"tel:" + pro.phone}>Llamar al profesional</Btn>}
      </div>
    </Modal>
  );
}

export default function Facturas({ d, recargar, aviso }: SeccionProps) {
  const [vista, setVista] = useState<"pros" | "todas">("pros");
  const [fEstado, setFEstado] = useState("todas");
  const [fTipo, setFTipo] = useState("todos");
  const [fPro, setFPro] = useState("todos");
  const [abierta, setAbierta] = useState<Factura | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const ahora = Date.now();

  const validas = d.facturas.filter((f) => f.status !== "anulada");
  const pend = validas.filter((f) => f.status === "pendiente");
  const venc = pend.filter((f) => ts(f.due_at) < ahora);
  const sinFacturarPor = useMemo(() => {
    const m: Record<string, number> = {};
    d.leads.filter((l) => !l.anulado && !l.invoice_id).forEach((l) => { m[l.pro_id] = (m[l.pro_id] || 0) + Number(l.price); });
    return m;
  }, [d.leads]);

  const porPro = useMemo(() => {
    const ids = Array.from(new Set([...d.facturas.map((f) => f.pro_id), ...Object.keys(sinFacturarPor)]));
    return ids.map((id) => {
      const fs = validas.filter((f) => f.pro_id === id);
      return {
        id, nombre: d.proPorId[id]?.name || fs[0]?.cliente_nombre || "—", n: fs.length,
        facturado: fs.reduce((s, f) => s + Number(f.total), 0),
        cobrado: fs.filter((f) => f.status === "pagada").reduce((s, f) => s + Number(f.total), 0),
        pendiente: fs.filter((f) => f.status === "pendiente").reduce((s, f) => s + Number(f.total), 0),
        vencido: fs.filter((f) => f.status === "pendiente" && ts(f.due_at) < ahora).reduce((s, f) => s + Number(f.total), 0),
        sinFacturar: sinFacturarPor[id] || 0,
        ultima: fs[0]?.issued_at || null,
      };
    }).sort((a, b) => b.vencido - a.vencido || b.pendiente - a.pendiente || b.facturado - a.facturado);
  }, [d.facturas, d.proPorId, sinFacturarPor, validas, ahora]);

  const emitirAhora = async (id: string) => {
    if (!confirm("¿Emitir ya la factura de los leads pendientes de " + (d.proPorId[id]?.name || "este profesional") + "?")) return;
    setOcupado(id);
    const { data, error } = await db.rpc("oy_emitir_ahora", { p_pro: id });
    setOcupado(null);
    if (error) { aviso("Error: " + error.message); return; }
    aviso(data ? "Factura emitida y avisado el profesional" : "No había leads pendientes");
    recargar();
  };

  const lista = d.facturas.filter((f) =>
    (fPro === "todos" || f.pro_id === fPro) &&
    (fTipo === "todos" || f.tipo === fTipo) &&
    (fEstado === "todas" || (fEstado === "vencida" ? f.status === "pendiente" && ts(f.due_at) < ahora : f.status === fEstado)));

  const hecho = (m: string) => { setAbierta(null); aviso(m); recargar(); };
  const tab = (id: "pros" | "todas", txt: string) => (
    <button onClick={() => setVista(id)} style={{
      padding: "8px 14px", borderRadius: 8, border: "1px solid " + (vista === id ? C.accent : C.border), cursor: "pointer", fontFamily: F,
      background: vista === id ? C.accent + "18" : C.card, color: vista === id ? C.accent : C.mutedL, fontWeight: 800, fontSize: 13,
    }}>{txt}</button>
  );

  return (
    <div>
      <Cabecera titulo="Facturas" sub={"Se emiten solas el día 1 o al llegar a " + eur(d.config.umbral_factura || 820) + " · " + (d.config.dias_pago || 5) + " días para pagar"} />

      <Grid min={170}>
        <Kpi label="Facturado (total)" valor={eur(validas.reduce((s, f) => s + Number(f.total), 0))} sub={validas.length + " facturas"} />
        <Kpi label="Cobrado" valor={eur(validas.filter((f) => f.status === "pagada").reduce((s, f) => s + Number(f.total), 0))} color={C.green} />
        <Kpi label="Pendiente de cobro" valor={eur(pend.reduce((s, f) => s + Number(f.total), 0))} color={C.orange} sub={pend.length + " facturas"} />
        <Kpi label="Vencido" valor={eur(venc.reduce((s, f) => s + Number(f.total), 0))} color={venc.length ? C.red : C.text} alerta={venc.length > 0} sub={venc.length ? venc.length + " sin pagar a tiempo" : "Nada vencido"} />
        <Kpi label="Leads sin facturar" valor={eur(Object.values(sinFacturarPor).reduce((a, b) => a + b, 0))} sub="Sin IVA · próxima factura" />
      </Grid>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>{tab("pros", "Por profesional")}{tab("todas", "Todas las facturas")}</div>

      {vista === "pros" ? (
        <>
          <Tabla
            cols={[{ k: "nombre", l: "Profesional" }, { k: "n", l: "Facturas", align: "right" }, { k: "facturado", l: "Facturado", align: "right" }, { k: "cobrado", l: "Cobrado", align: "right" }, { k: "pendiente", l: "Pendiente", align: "right" }, { k: "vencido", l: "Vencido", align: "right" }, { k: "sin", l: "Sin facturar", align: "right" }, { k: "acc", l: "", align: "right" }]}
            filas={porPro.map((p) => ({
              nombre: <b>{p.nombre}</b>, n: num(p.n), facturado: eur(p.facturado, 2), cobrado: eur(p.cobrado, 2),
              pendiente: p.pendiente ? <span style={{ color: C.orange, fontWeight: 700 }}>{eur(p.pendiente, 2)}</span> : "—",
              vencido: p.vencido ? <span style={{ color: C.red, fontWeight: 800 }}>{eur(p.vencido, 2)}</span> : "—",
              sin: eur(p.sinFacturar),
              acc: <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", gap: 6 }}>
                <Btn small outline onClick={() => { setFPro(p.id); setVista("todas"); }}>Ver</Btn>
                <Btn small outline color={C.green} disabled={!p.sinFacturar || ocupado === p.id} onClick={() => emitirAhora(p.id)}>Facturar ya</Btn>
              </span>,
            }))}
            vacio="Aún no hay facturas ni leads"
          />
          <div style={{ fontSize: 12, color: C.muted }}>"Facturar ya" emite en el momento la factura de los leads pendientes, sin esperar al día 1.</div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <Sel value={fEstado} onChange={setFEstado} options={[{ v: "todas", l: "Todos los estados" }, { v: "pendiente", l: "Pendientes" }, { v: "vencida", l: "Vencidas" }, { v: "pagada", l: "Pagadas" }, { v: "anulada", l: "Anuladas" }]} />
            <Sel value={fTipo} onChange={setFTipo} options={[{ v: "todos", l: "Leads y altas" }, { v: "leads", l: "Solo leads" }, { v: "activacion", l: "Solo altas" }]} />
            <Sel value={fPro} onChange={setFPro} options={[{ v: "todos", l: "Todos los profesionales" }, ...porPro.map((p) => ({ v: p.id, l: p.nombre }))]} />
          </div>
          <Tabla
            cols={[{ k: "num", l: "Nº" }, { k: "pro", l: "Profesional" }, { k: "tipo", l: "Concepto" }, { k: "emit", l: "Emitida" }, { k: "vence", l: "Vence" }, { k: "base", l: "Base", align: "right" }, { k: "total", l: "Total", align: "right" }, { k: "estado", l: "Estado" }]}
            filas={lista.map((f) => {
              const e = estadoFactura(f);
              return {
                num: <b>{f.number}</b>, pro: d.proPorId[f.pro_id]?.name || f.cliente_nombre,
                tipo: f.tipo === "activacion" ? "Alta" : f.n_leads + " leads",
                emit: fecha(f.issued_at), vence: fecha(f.due_at), base: eur(f.base, 2), total: <b>{eur(f.total, 2)}</b>,
                estado: <Pill texto={e.t} color={e.c} />,
              };
            })}
            onFila={(i) => setAbierta(lista[i])}
            vacio="No hay facturas con estos filtros"
          />
        </>
      )}

      {abierta && <GestionFactura f={abierta} d={d} onClose={() => setAbierta(null)} onHecho={hecho} />}
    </div>
  );
}
