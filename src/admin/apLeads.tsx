// ============================================================
// OficioYa · ADMIN — LEADS, SIN ASIGNAR y AÑADIR LLAMADA
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../supabase";
import {
  C, F, Card, Btn, Pill, Cabecera, SelectorMes, Sel, Campo, Modal, Tabla, Grid, Kpi,
  SeccionProps, Lead, Solicitud, ESTADOS, ESTADO_INFO, CANAL_LABEL, MOTIVO_PERDIDO, INICIO_PAGO_POR_LEAD,
  ts, mesDe, mesHoy, fechaHora, eur, num, hace, oficioDe, waLink, digitos,
} from "./apUi";

export function precioDe(precios: { trade_key: string; price: number }[], oficio: string | null) {
  const o = (oficio || "").toLowerCase();
  const p = precios.find((x) => x.trade_key !== "_default" && o.includes(x.trade_key));
  return p ? p.price : (precios.find((x) => x.trade_key === "_default")?.price ?? 40);
}

// ── Añadir llamada ──────────────────────────────────────────
function NuevaLlamada({ d, onClose, onHecho }: { d: SeccionProps["d"]; onClose: () => void; onHecho: (m: string) => void }) {
  const repartidos = d.routing.filter((r) => r.active).map((r) => d.proPorId[r.pro_id]).filter(Boolean);
  const opciones = [...repartidos, ...d.pros.filter((p) => !repartidos.find((x) => x.id === p.id))];
  const ahoraLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [proId, setProId] = useState(repartidos[0]?.id || opciones[0]?.id || "");
  const [cuando, setCuando] = useState(ahoraLocal);
  const [min, setMin] = useState("");
  const [seg, setSeg] = useState("");
  const [tel, setTel] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState("");
  const pro = d.proPorId[proId];
  const oficio = pro?.trade || "";
  const precio = precioDe(d.precios, oficio);
  const segundos = (Number(min) || 0) * 60 + (Number(seg) || 0);

  const guardar = async () => {
    if (!pro) { setErr("Elige el profesional"); return; }
    if (!cuando) { setErr("Pon la fecha y hora de la llamada"); return; }
    setGuardando(true); setErr("");
    const momento = new Date(cuando).toISOString();
    const { error } = await db.from("pro_leads").insert({
      pro_id: pro.id, trade: oficio || "Sin oficio", city_slug: "sevilla", canal: "llamada",
      client_phone: tel.trim() || null, notas: nota.trim() || null, price: precio,
      llamada_at: momento, llamada_segundos: segundos || null, created_at: momento, created_by: "admin",
    });
    setGuardando(false);
    if (error) { setErr("No se ha podido guardar: " + error.message); return; }
    onHecho("Llamada añadida a " + pro.name + ". Le ha llegado el aviso.");
  };

  return (
    <Modal titulo="Añadir llamada" onClose={onClose}>
      <div style={{ fontSize: 13, color: C.mutedL, marginBottom: 14 }}>Sácala del informe de llamadas de Google Ads. Al profesional le llega un aviso para que complete los datos del cliente.</div>
      <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>Profesional</label>
      <Sel value={proId} onChange={setProId} style={{ width: "100%", marginBottom: 12 }}
        options={opciones.map((p) => ({ v: p.id, l: p.name + (p.trade ? " · " + oficioDe(p.trade) : "") + (repartidos.find((x) => x.id === p.id) ? " (recibe leads)" : "") }))} />
      <Campo label="Fecha y hora de la llamada" type="datetime-local" value={cuando} onChange={setCuando} />
      <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>Duración</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Campo value={min} onChange={setMin} inputMode="numeric" placeholder="Minutos" />
        <Campo value={seg} onChange={setSeg} inputMode="numeric" placeholder="Segundos" />
      </div>
      {segundos > 0 && segundos < 60 && <div style={{ fontSize: 12, color: C.orange, margin: "-6px 0 10px" }}>Dura menos de 60 s. Comprueba si cuenta como lead.</div>}
      <Campo label="Teléfono o código de zona del cliente (opcional)" value={tel} onChange={setTel} placeholder="Ej. 954 o 612345678" />
      <Campo label="Nota (opcional)" value={nota} onChange={setNota} multilinea placeholder="Ej. Llamada desde el anuncio de pintores" />
      <div style={{ fontSize: 13, color: C.text, margin: "4px 0 14px" }}>Se cobrará: <b>{eur(precio)}</b> + IVA {oficio ? "· " + oficioDe(oficio) : ""}</div>
      {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Btn outline color={C.mutedL} onClick={onClose}>Cancelar</Btn>
        <Btn onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Añadir llamada"}</Btn>
      </div>
    </Modal>
  );
}

// ── Ficha de un lead ────────────────────────────────────────
function FichaLead({ lead, d, onClose, onHecho }: { lead: Lead; d: SeccionProps["d"]; onClose: () => void; onHecho: (m: string) => void }) {
  const [proId, setProId] = useState(lead.pro_id);
  const [motivoAnular, setMotivoAnular] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const factura = lead.invoice_id ? d.facturas.find((f) => f.id === lead.invoice_id) : null;
  const est = ESTADO_INFO[lead.estado];

  const actualizar = async (cambios: any, msg: string) => {
    setOcupado(true);
    const { error } = await db.from("pro_leads").update(cambios).eq("id", lead.id);
    setOcupado(false);
    if (error) { alert("No se ha podido guardar: " + error.message); return; }
    onHecho(msg);
  };

  const fila = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid " + C.border + "66", fontSize: 13 }}>
      <span style={{ color: C.mutedL }}>{k}</span><span style={{ color: C.text, textAlign: "right" }}>{v || "—"}</span>
    </div>
  );

  return (
    <Modal titulo={lead.client_name || (lead.canal === "llamada" ? "Llamada" : "Lead")} onClose={onClose}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <Pill texto={CANAL_LABEL[lead.canal]} color={C.mutedL} />
        {lead.anulado ? <Pill texto="Anulado" color={C.muted} /> : <Pill texto={est.label} color={est.color} />}
        {factura ? <Pill texto={"Factura " + factura.number} color={C.green} /> : <Pill texto="Sin facturar" color={C.orange} />}
      </div>
      {fila("Entró", fechaHora(lead.created_at) + " · hace " + hace(lead.created_at))}
      {fila("Profesional", d.proPorId[lead.pro_id]?.name)}
      {fila("Oficio", oficioDe(lead.trade))}
      {fila("Precio", eur(lead.price) + " + IVA")}
      {lead.canal === "llamada" && fila("Llamada", fechaHora(lead.llamada_at) + (lead.llamada_segundos ? " · " + Math.floor(lead.llamada_segundos / 60) + " min " + (lead.llamada_segundos % 60) + " s" : ""))}
      {fila("Cliente", lead.client_name)}
      {fila("Teléfono", lead.client_phone)}
      {fila("Zona", lead.zona)}
      {fila("Qué necesita", lead.descripcion)}
      {fila("Primer contacto", lead.primer_contacto_at ? fechaHora(lead.primer_contacto_at) : "Aún sin contactar")}
      {lead.estado === "perdido" && fila("Motivo", MOTIVO_PERDIDO[lead.motivo_perdido || ""] || lead.motivo_perdido)}
      {lead.presupuesto_eur ? fila(lead.estado === "ganado" ? "Importe del trabajo" : "Presupuesto", eur(lead.presupuesto_eur)) : null}
      {fila("Notas", lead.notas)}
      {lead.anulado && fila("Motivo de anulación", lead.anulado_motivo)}

      {digitos(lead.client_phone).length >= 9 && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn small color={C.green} href={"tel:" + digitos(lead.client_phone)}>Llamar al cliente</Btn>
          <Btn small outline color={C.green} href={waLink(lead.client_phone)}>WhatsApp</Btn>
        </div>
      )}

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid " + C.border }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.mutedL, marginBottom: 8 }}>REASIGNAR A OTRO PROFESIONAL</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Sel value={proId} onChange={setProId} style={{ flex: 1 }} options={d.pros.map((p) => ({ v: p.id, l: p.name + (p.trade ? " · " + oficioDe(p.trade) : "") }))} />
          <Btn disabled={ocupado || proId === lead.pro_id || !!factura} onClick={() => actualizar({ pro_id: proId }, "Lead reasignado")}>Reasignar</Btn>
        </div>
        {factura && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Ya está facturado: no se puede reasignar ni anular. Anula antes la factura {factura.number} si hace falta.</div>}
      </div>

      {!factura && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.mutedL, marginBottom: 8 }}>{lead.anulado ? "REACTIVAR" : "ANULAR (NO SE COBRA)"}</div>
          {lead.anulado ? (
            <Btn outline color={C.green} disabled={ocupado} onClick={() => actualizar({ anulado: false, anulado_motivo: null }, "Lead reactivado")}>Volver a cobrarlo</Btn>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input value={motivoAnular} onChange={(e) => setMotivoAnular(e.target.value)} placeholder="Motivo: duplicado, spam, prueba..." style={{ flex: 1, background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "9px 10px", fontFamily: F, fontSize: 13 }} />
              <Btn color={C.red} disabled={ocupado || !motivoAnular.trim()} onClick={() => actualizar({ anulado: true, anulado_motivo: motivoAnular.trim() }, "Lead anulado")}>Anular</Btn>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Sin asignar ─────────────────────────────────────────────
function SinAsignar({ d, recargar, aviso, lista }: SeccionProps & { lista: Solicitud[] }) {
  const [contactos, setContactos] = useState<Record<string, { phone: string | null; email: string | null }>>({});
  const [elegido, setElegido] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    const ids = Array.from(new Set(lista.map((s) => s.client_id).filter((x) => x && /^[0-9a-f-]{36}$/i.test(x as string)))) as string[];
    if (!ids.length) return;
    db.from("users").select("id,phone,email").in("id", ids).then(({ data }: any) => {
      const m: Record<string, any> = {};
      (data || []).forEach((u: any) => { m[u.id] = { phone: u.phone, email: u.email }; });
      setContactos(m);
    });
  }, [lista]);

  const sugeridos = (oficio: string | null, pedido?: string | null) => {
    const o = oficioDe(oficio);
    return [...d.pros].sort((a, b) =>
      Number(b.id === pedido) - Number(a.id === pedido) || Number(oficioDe(b.trade) === o) - Number(oficioDe(a.trade) === o));
  };

  const asignar = async (s: Solicitud) => {
    const pro = elegido[s.id] || sugeridos(s.oficio, s.pro_solicitado)[0]?.id;
    if (!pro) return;
    setOcupado(s.id);
    const { error } = await db.rpc("oy_asignar_solicitud", { p_br: s.id, p_pro: pro });
    setOcupado(null);
    if (error) { aviso("Error: " + error.message); return; }
    aviso("Asignado a " + (d.proPorId[pro]?.name || "profesional") + ". Le ha llegado el aviso.");
    recargar();
  };
  const descartar = async (s: Solicitud) => {
    if (!confirm("¿Descartar esta solicitud? No se asignará a nadie.")) return;
    setOcupado(s.id);
    await db.from("budget_requests").update({ status: "descartado" }).eq("id", s.id);
    setOcupado(null);
    aviso("Solicitud descartada");
    recargar();
  };

  if (lista.length === 0) return <Card><div style={{ color: C.mutedL }}>No hay solicitudes sin profesional. Todo lo que entra tiene a quién ir.</div></Card>;

  return (
    <div>
      {lista.map((s) => {
        const c = s.client_id ? contactos[s.client_id] : undefined;
        const opts = sugeridos(s.oficio, s.pro_solicitado);
        const pedido = s.pro_solicitado ? d.proPorId[s.pro_solicitado] : null;
        return (
          <Card key={s.id} accent={C.orange + "66"}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
              <Pill texto={oficioDe(s.oficio)} color={C.orange} />
              <span style={{ fontSize: 12, color: C.mutedL }}>{fechaHora(s.created_at)} · hace {hace(s.created_at)}</span>
              {s.gclid && <Pill texto="Google Ads" color={C.blue} />}
              {s.pro_solicitado && <Pill texto={"Lo pidió a " + (pedido?.name || "un profesional")} color={C.accent} />}
            </div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{s.client_name || "Sin nombre"}{s.zona ? <span style={{ color: C.mutedL, fontWeight: 600 }}> · {s.zona}</span> : null}</div>
            {s.description && <div style={{ fontSize: 13, color: C.mutedL, marginTop: 4 }}>{s.description}</div>}
            {c?.phone && <div style={{ fontSize: 13, marginTop: 6 }}>Tel.: <a href={"tel:" + digitos(c.phone)} style={{ color: C.accent }}>{c.phone}</a></div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <Sel value={elegido[s.id] || opts[0]?.id || ""} onChange={(v) => setElegido({ ...elegido, [s.id]: v })} style={{ flex: 1, minWidth: 200 }}
                options={opts.map((p) => ({ v: p.id, l: p.name + (p.trade ? " · " + oficioDe(p.trade) : "") }))} />
              <Btn onClick={() => asignar(s)} disabled={ocupado === s.id}>Asignar ({eur(precioDe(d.precios, s.oficio))})</Btn>
              <Btn outline color={C.mutedL} onClick={() => descartar(s)} disabled={ocupado === s.id}>Descartar</Btn>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── Sección ─────────────────────────────────────────────────
export default function Leads(props: SeccionProps) {
  const { d, recargar, aviso } = props;
  const [pestana, setPestana] = useState<"leads" | "sin">("leads");
  const [mes, setMes] = useState(mesHoy());
  const [fPro, setFPro] = useState("todos");
  const [fOficio, setFOficio] = useState("todos");
  const [fEstado, setFEstado] = useState("todos");
  const [fCanal, setFCanal] = useState("todos");
  const [verAnulados, setVerAnulados] = useState(false);
  const [busca, setBusca] = useState("");
  const [ficha, setFicha] = useState<Lead | null>(null);
  const [nuevaLlamada, setNuevaLlamada] = useState(false);

  const usados = useMemo(() => new Set(d.leads.map((l) => l.budget_request_id).filter(Boolean)), [d.leads]);
  const sinAsignar = useMemo(() => d.solicitudes.filter((s) =>
    ts(s.created_at) >= ts(INICIO_PAGO_POR_LEAD) && !usados.has(s.id) && s.status !== "descartado" && s.status !== "cancelled"), [d.solicitudes, usados]);

  const delMes = d.leads.filter((l) => mesDe(l.created_at) === mes);
  const lista = delMes.filter((l) =>
    (verAnulados || !l.anulado) &&
    (fPro === "todos" || l.pro_id === fPro) &&
    (fOficio === "todos" || oficioDe(l.trade) === fOficio) &&
    (fEstado === "todos" || l.estado === fEstado) &&
    (fCanal === "todos" || l.canal === fCanal) &&
    (!busca.trim() || [l.client_name, l.client_phone, l.zona, l.descripcion].join(" ").toLowerCase().includes(busca.toLowerCase())));
  const validos = delMes.filter((l) => !l.anulado);
  const oficios = Array.from(new Set(d.leads.map((l) => oficioDe(l.trade))));
  const prosConLeads = Array.from(new Set(d.leads.map((l) => l.pro_id))).map((id) => d.proPorId[id]).filter(Boolean);
  const primerMes = d.leads.length ? mesDe(d.leads[d.leads.length - 1].created_at) : mesHoy();

  const hecho = (m: string) => { setFicha(null); setNuevaLlamada(false); aviso(m); recargar(); };
  const tabBtn = (id: "leads" | "sin", txt: string, n?: number) => (
    <button onClick={() => setPestana(id)} style={{
      padding: "8px 14px", borderRadius: 8, border: "1px solid " + (pestana === id ? C.accent : C.border), cursor: "pointer", fontFamily: F,
      background: pestana === id ? C.accent + "18" : C.card, color: pestana === id ? C.accent : C.mutedL, fontWeight: 800, fontSize: 13,
    }}>{txt}{n ? <span style={{ marginLeft: 6, background: C.orange, color: "#000", borderRadius: 99, padding: "1px 7px", fontSize: 11 }}>{n}</span> : null}</button>
  );

  return (
    <div>
      <Cabecera titulo="Leads" sub="Todos los clientes enviados a profesionales">
        <Btn onClick={() => setNuevaLlamada(true)}>+ Añadir llamada</Btn>
      </Cabecera>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabBtn("leads", "Leads")}
        {tabBtn("sin", "Sin asignar", sinAsignar.length)}
      </div>

      {pestana === "sin" ? <SinAsignar {...props} lista={sinAsignar} /> : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <SelectorMes mes={mes} onChange={setMes} min={primerMes} />
            <Sel value={fPro} onChange={setFPro} options={[{ v: "todos", l: "Todos los profesionales" }, ...prosConLeads.map((p) => ({ v: p.id, l: p.name }))]} />
            <Sel value={fOficio} onChange={setFOficio} options={[{ v: "todos", l: "Todos los oficios" }, ...oficios.map((o) => ({ v: o, l: o }))]} />
            <Sel value={fEstado} onChange={setFEstado} options={[{ v: "todos", l: "Todos los estados" }, ...ESTADOS.map((e) => ({ v: e.id, l: e.label }))]} />
            <Sel value={fCanal} onChange={setFCanal} options={[{ v: "todos", l: "Todos los canales" }, { v: "formulario", l: "Formulario" }, { v: "whatsapp", l: "WhatsApp" }, { v: "llamada", l: "Llamada" }]} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, teléfono, zona..." style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "8px 10px", fontFamily: F, fontSize: 13, minWidth: 200 }} />
            <label style={{ fontSize: 12.5, color: C.mutedL, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={verAnulados} onChange={(e) => setVerAnulados(e.target.checked)} /> Ver anulados
            </label>
          </div>

          <Grid min={150}>
            <Kpi label="Leads del mes" valor={num(validos.length)} sub={eur(validos.reduce((s, l) => s + Number(l.price), 0)) + " a cobrar"} />
            {ESTADOS.map((e) => <Kpi key={e.id} label={e.label} valor={num(validos.filter((l) => l.estado === e.id).length)} color={e.color} />)}
          </Grid>

          <Tabla
            cols={[{ k: "fecha", l: "Fecha" }, { k: "pro", l: "Profesional" }, { k: "oficio", l: "Oficio" }, { k: "canal", l: "Canal" }, { k: "cliente", l: "Cliente" }, { k: "estado", l: "Estado" }, { k: "precio", l: "Precio", align: "right" }, { k: "fact", l: "Factura" }]}
            filas={lista.map((l) => ({
              fecha: fechaHora(l.created_at),
              pro: d.proPorId[l.pro_id]?.name || "—",
              oficio: oficioDe(l.trade),
              canal: CANAL_LABEL[l.canal],
              cliente: <span style={{ color: l.client_name ? C.text : C.orange }}>{l.client_name || "Faltan datos"}{l.zona ? <span style={{ color: C.mutedL }}> · {l.zona}</span> : null}</span>,
              estado: l.anulado ? <Pill texto="Anulado" color={C.muted} /> : <Pill texto={ESTADO_INFO[l.estado].label} color={ESTADO_INFO[l.estado].color} />,
              precio: <span style={{ textDecoration: l.anulado ? "line-through" : "none", color: l.anulado ? C.muted : C.text }}>{eur(l.price)}</span>,
              fact: l.invoice_id ? (d.facturas.find((f) => f.id === l.invoice_id)?.number || "Sí") : <span style={{ color: C.muted }}>Pendiente</span>,
            }))}
            onFila={(i) => setFicha(lista[i])}
            vacio="No hay leads con estos filtros"
          />
        </>
      )}

      {ficha && <FichaLead lead={ficha} d={d} onClose={() => setFicha(null)} onHecho={hecho} />}
      {nuevaLlamada && <NuevaLlamada d={d} onClose={() => setNuevaLlamada(false)} onHecho={hecho} />}
    </div>
  );
}
