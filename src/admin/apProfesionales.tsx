// ============================================================
// OficioYa · ADMIN — PROFESIONALES (reparto, altas, rendimiento)
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../supabase";
import {
  C, F, Card, Btn, Pill, Cabecera, Sel, Campo, Modal, Tabla, Grid, Kpi, Titulo,
  SeccionProps, Pro, INICIO_ALTAS, ESTADO_INFO, CANAL_LABEL,
  ts, mesDe, mesHoy, fecha, fechaHora, eur, num, pct, duracion, oficioDe, waLink, digitos, precioLeadDe } from "./apUi";
import { GestionFactura, estadoFactura } from "./apFacturas";

const ALTA: Record<string, { t: string; c: string }> = {
  pagada: { t: "Alta pagada", c: C.green },
  pendiente: { t: "Alta pendiente", c: C.orange },
  exento: { t: "Exento de alta", c: C.blue },
};

function FichaPro({ p, d, onClose, onHecho }: { p: Pro; d: SeccionProps["d"]; onClose: () => void; onHecho: (m: string, cerrar?: boolean) => void }) {
  const claves = d.precios.filter((x) => x.trade_key !== "_default").map((x) => x.trade_key);
  const reparto = d.routing.filter((r) => r.pro_id === p.id && r.active);
  const sugerida = claves.find((k) => (p.trade || "").toLowerCase().includes(k)) || claves[0] || "";
  const [clave, setClave] = useState(sugerida);
  const [ciudad, setCiudad] = useState(p.city_slug || "sevilla");
  const [ocupado, setOcupado] = useState(false);
  const [factura, setFactura] = useState<any>(null);
  const leads = d.leads.filter((l) => l.pro_id === p.id);
  const facturas = d.facturas.filter((f) => f.pro_id === p.id);
  const nuevo = ts(p.joined_at || p.created_at) >= ts(INICIO_ALTAS);
  const alta = p.activacion_estado ? ALTA[p.activacion_estado] : null;
  const ocupante = (k: string, c: string) => d.routing.find((r) => r.trade_key === k && r.city_slug === c && r.active && r.pro_id !== p.id);
  const precioPro = p.precio_lead != null ? Number(p.precio_lead) : null;
  const ficha = p.ficha_captacion || null;

  // Contrato firmado subido por Sandra en captación (usa la clave del CRM de captación guardada en este dispositivo)
  const claveCapt = (() => { try { return localStorage.getItem("oy_captacion_clave"); } catch { return null; } })();
  const [contratos, setContratos] = useState<any[] | null>(null);
  useEffect(() => {
    if (!p.captacion_lead_id || !claveCapt) return;
    db.rpc("captacion_contrato_pro", { p_clave: claveCapt, p_pro: p.id }).then(({ data, error }: any) => { if (!error) setContratos(data || []); });
  }, [p.id, p.captacion_lead_id, claveCapt]);
  const descargarContrato = async (id: string) => {
    const { data, error }: any = await db.rpc("captacion_descargar_documento", { p_clave: claveCapt, p_id: id });
    if (error || !data) { alert("No se ha podido descargar el contrato"); return; }
    const bin = atob(data.base64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: data.mime }));
    const a = document.createElement("a"); a.href = url; a.download = data.nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  };

  const rpc = async (fn: string, args: any, msg: string) => {
    setOcupado(true);
    const { error } = await db.rpc(fn, args);
    setOcupado(false);
    if (error) { alert("Error: " + error.message); return; }
    onHecho(msg);
  };

  const fila = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid " + C.border + "66", fontSize: 13 }}>
      <span style={{ color: C.mutedL }}>{k}</span><span style={{ textAlign: "right" }}>{v || "—"}</span>
    </div>
  );

  return (
    <Modal titulo={p.name} onClose={onClose} ancho={640}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <Pill texto={oficioDe(p.trade)} color={C.accent} />
        {reparto.length ? <Pill texto="Recibe leads" color={C.green} /> : <Pill texto="Sin reparto" color={C.muted} />}
        {alta && <Pill texto={alta.t} color={alta.c} />}
        {p.captacion_lead_id && <Pill texto="Alta hecha por Sandra" color={C.blue} />}
        {d.conPush.has(p.id) ? <Pill texto="Avisos activados" color={C.green} /> : <Pill texto="Sin avisos" color={C.orange} />}
      </div>
      {fila("Ciudad", p.zone)}
      {fila("Precio por lead", precioPro != null ? <b>{eur(precioPro)} + IVA</b> : "El general de su oficio")}
      {fila("Empresa", p.company_name)}
      {fila("NIF/CIF", p.cif || <span style={{ color: C.orange }}>Falta</span>)}
      {fila("Dirección fiscal", [p.fiscal_address, p.fiscal_zip, p.fiscal_city].filter(Boolean).join(", ") || <span style={{ color: C.orange }}>Falta</span>)}
      {fila("Teléfono", p.phone || p.whatsapp)}
      {fila("Email", p.billing_email || p.email)}
      {fila("Registro", fecha(p.joined_at || p.created_at))}
      {digitos(p.phone || p.whatsapp).length >= 9 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn small color={C.green} href={"tel:" + digitos(p.phone || p.whatsapp)}>Llamar</Btn>
          <Btn small outline color={C.green} href={waLink(p.whatsapp || p.phone)}>WhatsApp</Btn>
        </div>
      )}

      {p.captacion_lead_id && (
        <>
          <Titulo>Ficha de Sandra</Titulo>
          {ficha ? (
            <>
              {fila("Horario", ficha.horario)}
              {fila("Urgencias 24 h", ficha.urgencias_24h ? "Sí" : "No")}
              {fila("Fines de semana y festivos", ficha.fines_semana ? "Sí" : "No")}
              {fila("Zonas que cubre", ficha.zonas)}
              {fila("Servicios", ficha.servicios)}
              {fila("No quiere recibir", ficha.no_hace)}
              {fila("Clientes nuevos por semana", ficha.capacidad_semana != null ? String(ficha.capacidad_semana) : null)}
              {fila("Notas", ficha.notas)}
            </>
          ) : <div style={{ fontSize: 13, color: C.muted }}>Sin ficha.</div>}
          <Titulo>Contrato firmado</Titulo>
          {!claveCapt && <div style={{ fontSize: 13, color: C.muted }}>Entra una vez en Captación desde este dispositivo para poder ver el contrato aquí.</div>}
          {claveCapt && contratos === null && <div style={{ fontSize: 13, color: C.muted }}>Cargando…</div>}
          {contratos && contratos.length === 0 && <div style={{ fontSize: 13, color: C.orange }}>No hay contrato subido.</div>}
          {contratos && contratos.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre_archivo} · {fecha(c.created_at)}</span>
              <Btn small outline onClick={() => descargarContrato(c.id)}>Descargar</Btn>
            </div>
          ))}
        </>
      )}

      <Titulo>Reparto de leads</Titulo>
      {reparto.map((r) => (
        <div key={r.trade_key + r.city_slug} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", fontSize: 13 }}>
          <span>Recibe <b>{oficioDe(r.trade_key)}</b> en <b>{r.city_slug}</b></span>
          <Btn small outline color={C.red} disabled={ocupado} onClick={() => rpc("oy_quitar_routing", { p_trade_key: r.trade_key, p_city: r.city_slug }, "Reparto quitado")}>Quitar</Btn>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
        <Sel value={clave} onChange={setClave} options={claves.map((k) => ({ v: k, l: oficioDe(k) + " (" + eur(precioPro ?? precioLeadDe(d, k, ciudad, null)) + "/lead)" }))} />
        <input value={ciudad} onChange={(e) => setCiudad(e.target.value.toLowerCase())} style={{ width: 110, background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "8px 10px", fontFamily: F, fontSize: 13 }} />
        <Btn disabled={ocupado || !clave} onClick={() => {
          const otro = ocupante(clave, ciudad);
          if (otro && !confirm(oficioDe(clave) + " en " + ciudad + " lo recibe ahora " + (d.proPorId[otro.pro_id]?.name || "otro profesional") + ". ¿Pasárselo a " + p.name + "?")) return;
          rpc("oy_set_routing", { p_trade_key: clave, p_city: ciudad, p_pro: p.id }, "Ahora " + p.name + " recibe los leads de " + oficioDe(clave));
        }}>Darle estos leads</Btn>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Solo un profesional por oficio y ciudad. Los leads nuevos le llegan solos{precioPro != null ? ", a " + eur(precioPro) + " + IVA cada uno (su precio de contrato)" : ""}.</div>

      <Titulo>Alta ({eur(d.config.activacion_eur || 99)} + IVA)</Titulo>
      <div style={{ fontSize: 13, color: C.mutedL, marginBottom: 10 }}>
        {nuevo ? "Se registró después del " + fecha(INICIO_ALTAS) + ": le corresponde pagar el alta." : "Registro anterior al " + fecha(INICIO_ALTAS) + ": no paga alta salvo que tú quieras."}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {p.activacion_estado !== "pagada" && p.activacion_estado !== "pendiente" && (
          <Btn disabled={ocupado} onClick={() => confirm("¿Emitir la factura de alta a " + p.name + "?") && rpc("oy_emitir_activacion", { p_pro: p.id }, "Factura de alta emitida y avisado el profesional")}>Emitir factura de alta</Btn>
        )}
        {p.activacion_estado !== "exento" && p.activacion_estado !== "pagada" && (
          <Btn outline color={C.blue} disabled={ocupado} onClick={() => rpc("oy_activacion_estado", { p_pro: p.id, p_estado: "exento" }, p.name + " queda exento de alta")}>Marcar exento</Btn>
        )}
        {p.activacion_estado === "exento" && (
          <Btn outline color={C.mutedL} disabled={ocupado} onClick={() => rpc("oy_activacion_estado", { p_pro: p.id, p_estado: "" }, "Exención quitada")}>Quitar exención</Btn>
        )}
      </div>

      <Titulo>Últimos leads ({leads.length} en total)</Titulo>
      {leads.slice(0, 8).map((l) => (
        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid " + C.border + "55", fontSize: 13 }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fechaHora(l.created_at)} · {CANAL_LABEL[l.canal]} · {l.client_name || "sin datos"}</span>
          {l.anulado ? <Pill texto="Anulado" color={C.muted} /> : <Pill texto={ESTADO_INFO[l.estado].label} color={ESTADO_INFO[l.estado].color} />}
        </div>
      ))}
      {leads.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Todavía no ha recibido leads.</div>}

      <Titulo>Facturas</Titulo>
      {facturas.map((f) => {
        const e = estadoFactura(f);
        return (
          <div key={f.id} onClick={() => setFactura(f)} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid " + C.border + "55", fontSize: 13, cursor: "pointer" }}>
            <span><b>{f.number}</b> · {f.tipo === "activacion" ? "Alta" : f.n_leads + " leads"} · {fecha(f.issued_at)}</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}><b>{eur(f.total, 2)}</b><Pill texto={e.t} color={e.c} /></span>
          </div>
        );
      })}
      {facturas.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Sin facturas todavía.</div>}

      {factura && <GestionFactura f={factura} d={d} onClose={() => setFactura(null)} onHecho={(m) => { setFactura(null); onHecho(m); }} />}
    </Modal>
  );
}

export default function Profesionales({ d, recargar, aviso }: SeccionProps) {
  const [filtro, setFiltro] = useState<"activos" | "altas" | "todos">("activos");
  const [busca, setBusca] = useState("");
  const [ficha, setFicha] = useState<string | null>(null);
  const mes = mesHoy();
  const ahora = Date.now();

  const activos = new Set(d.routing.filter((r) => r.active).map((r) => r.pro_id));
  const esNuevo = (p: Pro) => ts(p.joined_at || p.created_at) >= ts(INICIO_ALTAS);
  const pendAlta = d.pros.filter((p) => esNuevo(p) && !["pagada", "exento"].includes(p.activacion_estado || ""));

  const filas = useMemo(() => {
    let lista = d.pros;
    if (filtro === "activos") lista = lista.filter((p) => activos.has(p.id) || d.leads.some((l) => l.pro_id === p.id));
    if (filtro === "altas") lista = lista.filter((p) => esNuevo(p) || p.activacion_estado);
    if (busca.trim()) lista = lista.filter((p) => [p.name, p.company_name, p.trade, p.phone, p.email].join(" ").toLowerCase().includes(busca.toLowerCase()));
    return lista.map((p) => {
      const ls = d.leads.filter((l) => l.pro_id === p.id && !l.anulado);
      const lm = ls.filter((l) => mesDe(l.created_at) === mes);
      const t = ls.filter((l) => l.primer_contacto_at).map((l) => (ts(l.primer_contacto_at) - ts(l.created_at)) / 60000);
      const fs = d.facturas.filter((f) => f.pro_id === p.id && f.status === "pendiente");
      return {
        p, lm: lm.length, total: ls.length, sinLlamar: ls.filter((l) => l.estado === "nuevo").length,
        cierre: pct(ls.filter((l) => l.estado === "ganado").length, ls.length),
        resp: t.length ? t.reduce((a, b) => a + b, 0) / t.length : null,
        sinFact: ls.filter((l) => !l.invoice_id).reduce((s, l) => s + Number(l.price), 0),
        vencido: fs.filter((f) => ts(f.due_at) < ahora).reduce((s, f) => s + Number(f.total), 0),
        fiscal: !!(p.cif && p.fiscal_address && p.fiscal_zip && p.fiscal_city),
      };
    }).sort((a, b) => Number(activos.has(b.p.id)) - Number(activos.has(a.p.id)) || b.total - a.total || ts(b.p.joined_at || b.p.created_at) - ts(a.p.joined_at || a.p.created_at));
  }, [d, filtro, busca, mes]);

  const pro = ficha ? d.proPorId[ficha] : null;
  const tab = (id: typeof filtro, txt: string, n?: number) => (
    <button onClick={() => setFiltro(id)} style={{
      padding: "8px 14px", borderRadius: 8, border: "1px solid " + (filtro === id ? C.accent : C.border), cursor: "pointer", fontFamily: F,
      background: filtro === id ? C.accent + "18" : C.card, color: filtro === id ? C.accent : C.mutedL, fontWeight: 800, fontSize: 13,
    }}>{txt}{n ? <span style={{ marginLeft: 6, background: C.orange, color: "#000", borderRadius: 99, padding: "1px 7px", fontSize: 11 }}>{n}</span> : null}</button>
  );

  return (
    <div>
      <Cabecera titulo="Profesionales" sub={"Desde el " + fecha(INICIO_ALTAS) + " cada registro nuevo paga " + eur(d.config.activacion_eur || 99) + " + IVA de alta"} />
      <Grid min={170}>
        <Kpi label="Reciben leads" valor={String(activos.size)} sub={d.routing.filter((r) => r.active).map((r) => oficioDe(r.trade_key)).join(" · ") || "Nadie todavía"} />
        <Kpi label="Registros nuevos" valor={String(d.pros.filter(esNuevo).length)} sub={"Desde el " + fecha(INICIO_ALTAS)} />
        <Kpi label="Altas pendientes" valor={String(pendAlta.length)} color={pendAlta.length ? C.orange : C.text} sub={eur(pendAlta.length * (d.config.activacion_eur || 99)) + " + IVA por cobrar"} />
        <Kpi label="Sin avisos activados" valor={String(Array.from(activos).filter((id) => !d.conPush.has(id)).length)} sub="De los que reciben leads" />
      </Grid>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {tab("activos", "Con leads")}{tab("altas", "Altas", pendAlta.length)}{tab("todos", "Todos (" + d.pros.length + ")")}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nombre, oficio, teléfono..." style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "8px 10px", fontFamily: F, fontSize: 13, minWidth: 220 }} />
      </div>

      <Tabla
        cols={[{ k: "nombre", l: "Profesional" }, { k: "oficio", l: "Oficio" }, { k: "reparto", l: "Leads" }, { k: "precio", l: "€/lead", align: "right" }, { k: "alta", l: "Alta" }, { k: "mes", l: "Este mes", align: "right" }, { k: "sin", l: "Sin llamar", align: "right" }, { k: "cierre", l: "Cierre", align: "right" }, { k: "resp", l: "Respuesta", align: "right" }, { k: "fact", l: "Sin facturar", align: "right" }, { k: "venc", l: "Vencido", align: "right" }, { k: "push", l: "Avisos" }, { k: "fiscal", l: "Datos fiscales" }, { k: "reg", l: "Registro" }]}
        filas={filas.map((x) => ({
          nombre: <span><b>{x.p.name}</b>{x.p.company_name ? <span style={{ color: C.mutedL }}> · {x.p.company_name}</span> : null}</span>,
          oficio: oficioDe(x.p.trade),
          reparto: activos.has(x.p.id) ? <Pill texto="Recibe" color={C.green} /> : <span style={{ color: C.muted }}>—</span>,
          precio: x.p.precio_lead != null ? eur(Number(x.p.precio_lead)) : <span>{eur(precioLeadDe(d, x.p.trade, x.p.city_slug || "sevilla", null))} <span style={{ color: C.muted, fontSize: 11 }}>ciudad</span></span>,
          alta: x.p.activacion_estado ? <Pill texto={ALTA[x.p.activacion_estado]?.t || x.p.activacion_estado} color={ALTA[x.p.activacion_estado]?.c || C.muted} />
            : esNuevo(x.p) ? <Pill texto="Sin emitir" color={C.orange} /> : <span style={{ color: C.muted }}>—</span>,
          mes: num(x.lm), sin: x.sinLlamar ? <span style={{ color: C.orange, fontWeight: 800 }}>{x.sinLlamar}</span> : "0",
          cierre: x.total ? x.cierre : "—", resp: duracion(x.resp), fact: x.sinFact ? eur(x.sinFact) : "—",
          venc: x.vencido ? <span style={{ color: C.red, fontWeight: 800 }}>{eur(x.vencido, 2)}</span> : "—",
          push: d.conPush.has(x.p.id) ? <span style={{ color: C.green }}>Sí</span> : <span style={{ color: C.muted }}>No</span>,
          fiscal: x.fiscal ? <span style={{ color: C.green }}>Completos</span> : <span style={{ color: C.orange }}>Faltan</span>,
          reg: fecha(x.p.joined_at || x.p.created_at),
        }))}
        onFila={(i) => setFicha(filas[i].p.id)}
        vacio="No hay profesionales con este filtro"
      />

      {pro && <FichaPro p={pro} d={d} onClose={() => setFicha(null)} onHecho={(m) => { aviso(m); recargar(); }} />}
    </div>
  );
}
