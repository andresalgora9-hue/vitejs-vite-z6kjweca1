// ============================================================
// CreceYa · by OficioYa — CRM de la agencia de redes sociales (clínicas estéticas, Sevilla) · 28/11/2026
// Leads de /creceya (tabla creceya_leads) + historial (creceya_eventos). Solo admin.
// Etapas: Nuevo → Contactado → Reunión → Propuesta → Ganado / Perdido.
// Avisos: push + email al entrar un lead y recordatorio si sigue en Nuevo a los 30 min (función creceya-aviso).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../supabase";
import { C, F, useAncho, Btn, Pill, Kpi, Grid, Titulo, Cabecera, Campo, Modal, Sel, eur, pct, ts, hace, fechaHora, mesDe, mesHoy, digitos } from "./apUi";

type Estado = "nuevo" | "contactado" | "reunion" | "propuesta" | "ganado" | "perdido";
interface CyLead {
  id: string; created_at: string; updated_at: string; nombre: string; negocio: string | null; telefono: string;
  email: string | null; instagram: string | null; zona: string | null; sector: string; presupuesto: string | null;
  gestion_actual: string | null; mensaje: string | null; estado: Estado; estado_at: string; motivo_perdido: string | null;
  cuota_mensual: number | null; reunion_at: string | null; proxima_accion: string | null; proxima_accion_at: string | null;
  notas: string | null; primer_contacto_at: string | null; ganado_at: string | null; origen: Record<string, string>;
  duplicado_de: string | null;
}
interface CyEvento { id: number; lead_id: string; created_at: string; tipo: string; de: string | null; a: string | null; detalle: string | null; }

const ETAPAS: { id: Estado; label: string; color: string }[] = [
  { id: "nuevo", label: "Nuevo", color: C.accent },
  { id: "contactado", label: "Contactado", color: C.blue },
  { id: "reunion", label: "Reunión", color: C.purple },
  { id: "propuesta", label: "Propuesta", color: C.orange },
  { id: "ganado", label: "Ganado", color: C.green },
  { id: "perdido", label: "Perdido", color: C.red },
];
const ETAPA: Record<string, { label: string; color: string }> = Object.fromEntries(ETAPAS.map((e) => [e.id, e]));
const ACTIVAS: Estado[] = ["nuevo", "contactado", "reunion", "propuesta"];
const PRES: Record<string, string> = { menos_200: "< 200 €", "200_400": "200–400 €", "400_700": "400–700 €", mas_700: "> 700 €" };
const PRES_LARGO: Record<string, string> = { menos_200: "Menos de 200 €/mes", "200_400": "200–400 €/mes", "400_700": "400–700 €/mes", mas_700: "Más de 700 €/mes" };
const presColor = (p: string | null) => (p === "400_700" || p === "mas_700" ? C.green : p === "200_400" ? C.orange : C.mutedL);
const cualificado = (p: string | null) => p === "400_700" || p === "mas_700";
const GEST: Record<string, string> = { nadie: "Nadie, las tienen paradas", equipo: "Alguien de la clínica", agencia: "Agencia o freelance" };
const MOTIVOS: Record<string, string> = {
  no_contesta: "No contesta", caro: "Le parece caro", ya_tiene_agencia: "Se queda con su agencia",
  no_es_momento: "No es el momento", no_encaja: "No encaja (presupuesto o tipo de negocio)", otros: "Otros",
};
const OBJETIVO_MES = 5;
const CUOTA_BASE = 450;

const telVer = (t: string) => { const d = digitos(t); return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : t; };
const telHref = (t: string) => { const d = digitos(t); return "tel:" + (d.length === 9 ? "+34" + d : d); };
const igHref = (ig: string | null) => { const h = String(ig || "").trim().replace(/^@/, "").replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, "").replace(/\/.*$/, ""); return h ? "https://instagram.com/" + h : ""; };
const waHref = (l: CyLead) => {
  let d = digitos(l.telefono); if (d.length === 9) d = "34" + d;
  const n1 = (l.nombre || "").trim().split(/\s+/)[0] || "";
  const txt = `Hola ${n1}, soy Andrés de CreceYa. Te escribo por la propuesta de redes sociales que has pedido${l.negocio ? " para " + l.negocio : ""}. ¿Te viene bien que te llame 5 minutos?`;
  return `https://wa.me/${d}?text=${encodeURIComponent(txt)}`;
};
// ISO <-> valor de <input type="datetime-local"> en la hora del dispositivo
const aLocal = (iso: string | null) => { if (!iso) return ""; const t = new Date(ts(iso)); return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const deLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const llegoTarde = (l: CyLead) => l.estado === "nuevo" && Date.now() - ts(l.created_at) > 60 * 60000;
const vencida = (l: CyLead) => !!l.proxima_accion_at && ACTIVAS.includes(l.estado) && ts(l.proxima_accion_at) < Date.now();

// Botón que es un enlace (tel:, WhatsApp) y además apunta el contacto en el historial
function BotonEnlace({ href, onClick, color, outline = false, small = false, nueva = false, children }: { href: string; onClick?: () => void; color: string; outline?: boolean; small?: boolean; nueva?: boolean; children: React.ReactNode }) {
  return (
    <a href={href} onClick={onClick} target={nueva ? "_blank" : undefined} rel={nueva ? "noreferrer" : undefined} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none",
      padding: small ? "6px 10px" : "9px 14px", borderRadius: 8, fontFamily: F, fontWeight: 800, fontSize: small ? 12 : 13,
      whiteSpace: "nowrap", background: outline ? "transparent" : color, border: "1px solid " + color, color: outline ? color : "#000",
    }}>{children}</a>
  );
}

// ── Ficha de un lead ─────────────────────────────────────────
function Ficha({ lead, onClose, onCambio, aviso }: { lead: CyLead; onClose: () => void; onCambio: (l: CyLead | null) => void; aviso: (m: string) => void }) {
  const [eventos, setEventos] = useState<CyEvento[]>([]);
  const [nota, setNota] = useState("");
  const [motivo, setMotivo] = useState(lead.motivo_perdido || "");
  const [cuota, setCuota] = useState(String(lead.cuota_mensual ?? CUOTA_BASE));
  const [reunion, setReunion] = useState(aLocal(lead.reunion_at));
  const [accion, setAccion] = useState(lead.proxima_accion || "");
  const [accionAt, setAccionAt] = useState(aLocal(lead.proxima_accion_at));
  const [pidiendo, setPidiendo] = useState<Estado | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState("");

  const cargarEventos = useCallback(async () => {
    const { data } = await db.from("creceya_eventos").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(200);
    setEventos((data || []) as CyEvento[]);
  }, [lead.id]);
  useEffect(() => { cargarEventos(); }, [cargarEventos]);

  const guardar = async (patch: Partial<CyLead>, ok: string) => {
    setGuardando(true); setErr("");
    const { data, error } = await db.from("creceya_leads").update(patch).eq("id", lead.id).select("*").single();
    setGuardando(false);
    if (error || !data) { setErr("No se ha podido guardar: " + (error?.message || "sin respuesta")); return false; }
    onCambio(data as CyLead); aviso(ok); cargarEventos();
    return true;
  };
  const apuntar = async (tipo: "llamada" | "whatsapp" | "nota", detalle?: string) => {
    const { error } = await db.from("creceya_eventos").insert({ lead_id: lead.id, tipo, detalle: detalle || null });
    if (error) { setErr("No se ha podido apuntar: " + error.message); return false; }
    cargarEventos();
    return true;
  };

  const cambiarEtapa = async (e: Estado) => {
    if (e === lead.estado) return;
    if (e === "perdido" || e === "ganado") { setPidiendo(e); return; }
    await guardar({ estado: e }, "Movido a " + ETAPA[e].label);
  };
  const confirmar = async () => {
    if (pidiendo === "perdido") {
      if (!motivo) { setErr("Elige el motivo"); return; }
      if (await guardar({ estado: "perdido", motivo_perdido: motivo }, "Movido a Perdido")) setPidiendo(null);
    } else if (pidiendo === "ganado") {
      const n = Number(String(cuota).replace(",", "."));
      if (!(n > 0)) { setErr("Pon la cuota mensual"); return; }
      if (await guardar({ estado: "ganado", cuota_mensual: n }, "¡Clínica ganada! " + eur(n) + "/mes")) setPidiendo(null);
    }
  };
  const borrar = async () => {
    if (!window.confirm("¿Borrar este lead y su historial? No se puede deshacer.")) return;
    const { error } = await db.from("creceya_leads").delete().eq("id", lead.id);
    if (error) { setErr("No se ha podido borrar: " + error.message); return; }
    aviso("Lead borrado"); onCambio(null); onClose();
  };

  const o = lead.origen || {};
  const origenTxt = o.canal === "manual" ? "Añadido a mano" : [o.utm_source, o.utm_campaign, o.utm_content].filter(Boolean).join(" · ") || (o.fbclid ? "Meta (sin UTM)" : o.ref ? "Desde " + o.ref : "Directo / sin UTM");
  const ig = igHref(lead.instagram);
  const fila = (k: string, v: React.ReactNode) => v ? (
    <div style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: "1px solid " + C.border + "88", fontSize: 13.5 }}>
      <span style={{ color: C.mutedL, width: 118, flexShrink: 0 }}>{k}</span><span style={{ color: C.text, minWidth: 0, wordBreak: "break-word" }}>{v}</span>
    </div>) : null;
  const evTexto = (e: CyEvento) => {
    if (e.tipo === "alta") return e.detalle === "manual" ? "Añadido a mano" : "Pidió propuesta en la web";
    if (e.tipo === "estado") return `${ETAPA[e.de || ""]?.label || e.de} → ${ETAPA[e.a || ""]?.label || e.a}${e.a === "perdido" && e.detalle ? " (" + (MOTIVOS[e.detalle] || e.detalle) + ")" : ""}${e.a === "ganado" && e.detalle ? " · " + eur(Number(e.detalle)) + "/mes" : ""}`;
    if (e.tipo === "llamada") return "Llamada";
    if (e.tipo === "whatsapp") return "WhatsApp";
    if (e.tipo === "reunion") return "Reunión fijada: " + (e.detalle || "");
    if (e.tipo === "aviso") return "Aviso enviado al móvil y al email";
    if (e.tipo === "recordatorio") return "Recordatorio: seguía en Nuevo";
    return e.detalle || e.tipo;
  };

  return (
    <Modal titulo={lead.negocio || lead.nombre} onClose={onClose} ancho={640}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: -6, marginBottom: 14 }}>
        {lead.negocio && <span style={{ color: C.mutedL, fontSize: 14 }}>{lead.nombre}</span>}
        <Pill texto={PRES[lead.presupuesto || ""] || "Sin presupuesto"} color={presColor(lead.presupuesto)} />
        <Pill texto={ETAPA[lead.estado].label} color={ETAPA[lead.estado].color} />
        {lead.duplicado_de && <Pill texto="Ya había escrito" color={C.orange} />}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <BotonEnlace href={telHref(lead.telefono)} onClick={() => { apuntar("llamada"); }} color={C.green}>📞 Llamar · {telVer(lead.telefono)}</BotonEnlace>
        <BotonEnlace href={waHref(lead)} onClick={() => { apuntar("whatsapp"); }} color={C.green} outline nueva>WhatsApp</BotonEnlace>
        {ig && <Btn href={ig} color={C.purple} outline>Ver Instagram</Btn>}
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: C.mutedL, marginBottom: 8 }}>Etapa</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {ETAPAS.map((e) => {
          const act = lead.estado === e.id || pidiendo === e.id;
          return (
            <button key={e.id} onClick={() => cambiarEtapa(e.id)} disabled={guardando} style={{
              fontFamily: F, fontSize: 13, fontWeight: 800, padding: "8px 12px", borderRadius: 8, cursor: "pointer",
              border: "1px solid " + (act ? e.color : C.border), background: act ? e.color + "22" : "transparent", color: act ? e.color : C.mutedL,
            }}>{e.label}</button>
          );
        })}
      </div>
      {pidiendo === "perdido" && (
        <div style={{ background: C.card, border: "1px solid " + C.red + "66", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>¿Por qué se pierde?</label>
          <Sel value={motivo} onChange={setMotivo} style={{ width: "100%", marginBottom: 10 }} options={[{ v: "", l: "Elige el motivo" }, ...Object.entries(MOTIVOS).map(([v, l]) => ({ v, l }))]} />
          <div style={{ display: "flex", gap: 8 }}><Btn color={C.red} onClick={confirmar} disabled={guardando}>Mover a Perdido</Btn><Btn outline color={C.mutedL} onClick={() => setPidiendo(null)}>Cancelar</Btn></div>
        </div>
      )}
      {pidiendo === "ganado" && (
        <div style={{ background: C.card, border: "1px solid " + C.green + "66", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <Campo label="Cuota mensual (€ sin IVA)" value={cuota} onChange={setCuota} inputMode="decimal" />
          <div style={{ display: "flex", gap: 8 }}><Btn color={C.green} onClick={confirmar} disabled={guardando}>Marcar como ganado</Btn><Btn outline color={C.mutedL} onClick={() => setPidiendo(null)}>Cancelar</Btn></div>
        </div>
      )}
      {lead.estado === "ganado" && lead.cuota_mensual != null && <div style={{ fontSize: 13.5, color: C.green, fontWeight: 800, marginBottom: 12 }}>Cliente activo: {eur(Number(lead.cuota_mensual))}/mes</div>}
      {lead.estado === "perdido" && lead.motivo_perdido && <div style={{ fontSize: 13.5, color: C.red, fontWeight: 800, marginBottom: 12 }}>Perdido: {MOTIVOS[lead.motivo_perdido] || lead.motivo_perdido}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 12px" }}>
        <Campo label="Reunión" type="datetime-local" value={reunion} onChange={setReunion} />
        <Campo label="Próximo paso (fecha)" type="datetime-local" value={accionAt} onChange={setAccionAt} />
      </div>
      <Campo label="Próximo paso" value={accion} onChange={setAccion} placeholder="Ej.: mandar propuesta, volver a llamar el lunes…" />
      <div style={{ marginBottom: 16 }}>
        <Btn small disabled={guardando} onClick={() => guardar({ reunion_at: deLocal(reunion), proxima_accion: accion.trim() || null, proxima_accion_at: deLocal(accionAt) }, "Guardado")}>Guardar reunión y próximo paso</Btn>
      </div>

      {fila("Teléfono", telVer(lead.telefono))}
      {fila("Email", lead.email)}
      {fila("Instagram", lead.instagram)}
      {fila("Zona", lead.zona)}
      {fila("Inversión", PRES_LARGO[lead.presupuesto || ""] || "Sin indicar")}
      {fila("Redes hoy", GEST[lead.gestion_actual || ""])}
      {fila("Mensaje", lead.mensaje)}
      {fila("Origen", origenTxt)}
      {fila("Entró", fechaHora(lead.created_at) + " (hace " + hace(lead.created_at) + ")")}
      {fila("Primer contacto", lead.primer_contacto_at ? fechaHora(lead.primer_contacto_at) : null)}

      <Titulo>Notas e historial</Titulo>
      <Campo value={nota} onChange={setNota} multilinea placeholder="Qué te ha dicho, qué tratamientos hace, objeciones…" />
      <div style={{ marginBottom: 12 }}>
        <Btn small disabled={!nota.trim()} onClick={async () => { if (await apuntar("nota", nota.trim())) { setNota(""); aviso("Nota guardada"); } }}>Guardar nota</Btn>
      </div>
      <div>
        {eventos.map((e) => (
          <div key={e.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid " + C.border + "66", fontSize: 13 }}>
            <span style={{ color: C.muted, width: 92, flexShrink: 0 }}>{fechaHora(e.created_at)}</span>
            <span style={{ color: e.tipo === "nota" ? C.text : C.mutedL, whiteSpace: "pre-wrap", minWidth: 0, wordBreak: "break-word" }}>{evTexto(e)}</span>
          </div>
        ))}
      </div>

      {err && <div style={{ color: C.red, fontSize: 13, marginTop: 12 }}>{err}</div>}
      <div style={{ marginTop: 18, textAlign: "right" }}>
        <button onClick={borrar} style={{ background: "none", border: "none", color: C.muted, fontFamily: F, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Borrar lead</button>
      </div>
    </Modal>
  );
}

// ── Añadir a mano (WhatsApp en frío, recomendaciones…) ──────
function Nuevo({ onClose, onHecho }: { onClose: () => void; onHecho: (l: CyLead) => void }) {
  const [nombre, setNombre] = useState("");
  const [negocio, setNegocio] = useState("");
  const [tel, setTel] = useState("");
  const [ig, setIg] = useState("");
  const [pres, setPres] = useState("");
  const [nota, setNota] = useState("");
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    let d = digitos(tel);
    if (d.length === 11 && d.startsWith("34")) d = d.slice(2);
    if (nombre.trim().length < 2 && negocio.trim().length < 2) { setErr("Pon el nombre o la clínica"); return; }
    if (!/^[6789]\d{8}$/.test(d)) { setErr("Teléfono de 9 cifras"); return; }
    setGuardando(true); setErr("");
    const { data, error } = await db.from("creceya_leads").insert({
      nombre: nombre.trim() || negocio.trim(), negocio: negocio.trim() || null, telefono: d, instagram: ig.trim() || null,
      presupuesto: pres || null, mensaje: nota.trim() || null, origen: { canal: "manual" },
    }).select("*").single();
    setGuardando(false);
    if (error || !data) { setErr("No se ha podido guardar: " + (error?.message || "")); return; }
    onHecho(data as CyLead);
  };
  return (
    <Modal titulo="Añadir clínica a mano" onClose={onClose}>
      <div style={{ fontSize: 13, color: C.mutedL, marginBottom: 14 }}>Para las que consigas por WhatsApp, en persona o por recomendación. No manda avisos.</div>
      <Campo label="Clínica" value={negocio} onChange={setNegocio} />
      <Campo label="Persona de contacto" value={nombre} onChange={setNombre} />
      <Campo label="Teléfono" value={tel} onChange={setTel} inputMode="tel" />
      <Campo label="Instagram (opcional)" value={ig} onChange={setIg} placeholder="@clinica" />
      <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>Inversión al mes</label>
      <Sel value={pres} onChange={setPres} style={{ width: "100%", marginBottom: 12 }} options={[{ v: "", l: "Sin saber" }, ...Object.entries(PRES_LARGO).map(([v, l]) => ({ v, l }))]} />
      <Campo label="Nota (opcional)" value={nota} onChange={setNota} multilinea />
      {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <Btn full onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Añadir"}</Btn>
    </Modal>
  );
}

// ── Pantalla ─────────────────────────────────────────────────
export default function CreceYa({ aviso }: { aviso: (m: string) => void }) {
  const ancho = useAncho();
  const movil = ancho < 900;
  const [leads, setLeads] = useState<CyLead[] | null>(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState<"activos" | Estado>("activos");
  const [buscar, setBuscar] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [toques, setToques] = useState<Record<string, number>>({});

  const cargar = useCallback(async () => {
    const { data, error } = await db.from("creceya_leads").select("*").order("created_at", { ascending: false }).limit(2000);
    if (error) { setError("No se han podido cargar los leads de CreceYa: " + error.message); return; }
    setLeads((data || []) as CyLead[]); setError("");
    const { data: ev } = await db.from("creceya_eventos").select("lead_id,tipo").in("tipo", ["llamada", "whatsapp"]).limit(5000);
    const t: Record<string, number> = {};
    ((ev || []) as any[]).forEach((e) => { t[e.lead_id] = (t[e.lead_id] || 0) + 1; });
    setToques(t);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") cargar(); }, 30000);
    return () => clearInterval(t);
  }, [cargar]);
  // Abrir el lead del aviso: /?panel=creceya#lead=<id>
  useEffect(() => {
    const leer = () => { const m = window.location.hash.match(/lead=([0-9a-f-]{36})/i); if (m) setAbierto(m[1]); };
    leer();
    window.addEventListener("hashchange", leer);
    return () => window.removeEventListener("hashchange", leer);
  }, []);
  const cerrar = () => {
    setAbierto(null);
    if (/lead=/.test(window.location.hash)) { try { window.history.replaceState({}, "", window.location.pathname + window.location.search); } catch { /* nada */ } }
  };

  const mes = mesHoy();
  const k = useMemo(() => {
    const l = leads || [];
    const delMes = l.filter((x) => mesDe(x.created_at) === mes);
    const cual = delMes.filter((x) => cualificado(x.presupuesto));
    const ganadosMes = l.filter((x) => x.estado === "ganado" && x.ganado_at && mesDe(x.ganado_at) === mes);
    const activos = l.filter((x) => x.estado === "ganado");
    const cuota = activos.reduce((s, x) => s + Number(x.cuota_mensual || 0), 0);
    const reunionesMes = l.filter((x) => x.reunion_at && mesDe(x.reunion_at) === mes).length;
    const sinLlamar = l.filter((x) => x.estado === "nuevo").length;
    const tarde = l.filter(llegoTarde).length;
    const conContacto = l.filter((x) => x.primer_contacto_at && x.origen?.canal !== "manual");
    const minContacto = conContacto.length ? conContacto.map((x) => (ts(x.primer_contacto_at) - ts(x.created_at)) / 60000).sort((a, b) => a - b)[Math.floor(conContacto.length / 2)] : null;
    return { delMes, cual, ganadosMes, activos, cuota, reunionesMes, sinLlamar, tarde, minContacto };
  }, [leads, mes]);

  const cuenta = (e: Estado) => (leads || []).filter((x) => x.estado === e).length;
  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const orden = (x: CyLead) => (x.estado === "nuevo" ? 0 : vencida(x) ? 1 : 2);
    return (leads || [])
      .filter((x) => (filtro === "activos" ? ACTIVAS.includes(x.estado) : x.estado === filtro))
      .filter((x) => !q || [x.nombre, x.negocio, x.telefono, x.instagram].some((v) => String(v || "").toLowerCase().includes(q)))
      .sort((a, b) => orden(a) - orden(b) || ts(b.created_at) - ts(a.created_at));
  }, [leads, filtro, buscar]);

  const contacto = (id: string, tipo: "llamada" | "whatsapp") => {
    db.from("creceya_eventos").insert({ lead_id: id, tipo }).then(({ error }) => {
      if (!error) setToques((t) => ({ ...t, [id]: (t[id] || 0) + 1 }));
    });
  };
  const leadAbierto = (leads || []).find((x) => x.id === abierto) || null;
  const actualizarUno = (l: CyLead | null, id?: string) => {
    setLeads((prev) => {
      if (!prev) return prev;
      if (!l) return prev.filter((x) => x.id !== (id || abierto));
      return prev.some((x) => x.id === l.id) ? prev.map((x) => (x.id === l.id ? l : x)) : [l, ...prev];
    });
  };

  if (error) return <div style={{ color: C.red, padding: 30, fontFamily: F }}>{error}</div>;
  if (!leads) return <div style={{ color: C.mutedL, padding: 30, fontFamily: F }}>Cargando CreceYa…</div>;

  const chip = (id: "activos" | Estado, label: string, n: number, color: string) => {
    const act = filtro === id;
    return (
      <button key={id} onClick={() => setFiltro(id)} style={{
        fontFamily: F, fontSize: 13, fontWeight: 800, padding: "7px 11px", borderRadius: 99, cursor: "pointer", whiteSpace: "nowrap",
        border: "1px solid " + (act ? color : C.border), background: act ? color + "22" : "transparent", color: act ? color : C.mutedL,
      }}>{label} <span style={{ opacity: .8 }}>{n}</span></button>
    );
  };

  return (
    <div style={{ fontFamily: F }}>
      <Cabecera titulo="CreceYa · Clínicas" sub="Redes sociales para clínicas estéticas de Sevilla. Leads de aficioya.com/creceya.">
        <Btn outline color={C.mutedL} small href="/creceya">Ver landing</Btn>
        <Btn small onClick={() => setNuevo(true)}>+ Añadir a mano</Btn>
      </Cabecera>

      <Grid min={movil ? 150 : 170}>
        <Kpi label="Sin llamar" valor={String(k.sinLlamar)} color={k.sinLlamar ? C.accent : C.text} alerta={k.tarde > 0} sub={k.tarde ? `${k.tarde} llevan más de 1 h` : "Llama en menos de 1 h"} />
        <Kpi label="Leads este mes" valor={String(k.delMes.length)} sub={`${k.cual.length} con 400 € o más (${pct(k.cual.length, k.delMes.length)})`} />
        <Kpi label="Reuniones este mes" valor={String(k.reunionesMes)} />
        <Kpi label="Ganadas este mes" valor={`${k.ganadosMes.length} / ${OBJETIVO_MES}`} color={k.ganadosMes.length >= OBJETIVO_MES ? C.green : C.text} sub={`Objetivo: ${OBJETIVO_MES} clínicas al mes`} />
        <Kpi label="Facturación mensual" valor={eur(k.cuota)} color={k.cuota ? C.green : C.text} sub={`${k.activos.length} clínica${k.activos.length === 1 ? "" : "s"} activa${k.activos.length === 1 ? "" : "s"}`} />
        <Kpi label="Tiempo hasta 1.er contacto" valor={k.minContacto == null ? "—" : k.minContacto < 60 ? Math.max(1, Math.round(k.minContacto)) + " min" : (k.minContacto / 60).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " h"} sub="Mediana de los leads web" />
      </Grid>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "4px 0 10px", WebkitOverflowScrolling: "touch" as any }}>
        {chip("activos", "En curso", leads.filter((x) => ACTIVAS.includes(x.estado)).length, C.text)}
        {ETAPAS.map((e) => chip(e.id, e.label, cuenta(e.id), e.color))}
      </div>
      <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por clínica, nombre, teléfono o Instagram" style={{
        width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.card, border: "1px solid " + C.border,
        borderRadius: 8, color: C.text, fontSize: 14, fontFamily: F, outline: "none", marginBottom: 12,
      }} />

      {lista.length === 0 && (
        <div style={{ background: C.card, border: "1px dashed " + C.border, borderRadius: 12, padding: 24, color: C.mutedL, fontSize: 14, lineHeight: 1.6 }}>
          {leads.length === 0
            ? <>Aún no ha entrado ninguna clínica. Cuando alguien pida propuesta en <a href="/creceya" style={{ color: C.accent }}>aficioya.com/creceya</a> te llegará un aviso al móvil y un email, y aparecerá aquí.</>
            : "No hay leads en esta etapa."}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: 10 }}>
        {lista.map((l) => {
          const e = ETAPA[l.estado];
          const tarde = llegoTarde(l);
          return (
            <div key={l.id} onClick={() => setAbierto(l.id)} style={{
              background: C.card, border: "1px solid " + (tarde ? C.red + "99" : vencida(l) ? C.orange + "99" : C.border), borderLeft: "4px solid " + e.color,
              borderRadius: 12, padding: 14, cursor: "pointer",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.negocio || l.nombre}</div>
                  {l.negocio && <div style={{ fontSize: 13, color: C.mutedL, marginTop: 2 }}>{l.nombre}</div>}
                </div>
                <Pill texto={PRES[l.presupuesto || ""] || "¿€?"} color={presColor(l.presupuesto)} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10, fontSize: 12.5, color: C.mutedL }}>
                <Pill texto={e.label} color={e.color} />
                <span style={{ color: tarde ? C.red : C.mutedL, fontWeight: tarde ? 800 : 400 }}>hace {hace(l.created_at)}</span>
                {l.origen?.canal === "manual" && <span>· a mano</span>}
                {l.duplicado_de && <span style={{ color: C.orange }}>· ya había escrito</span>}
                {(toques[l.id] || 0) > 0 && <span>· {toques[l.id]} contacto{toques[l.id] === 1 ? "" : "s"}</span>}
              </div>
              {(l.reunion_at || l.proxima_accion) && (
                <div style={{ fontSize: 12.5, color: vencida(l) ? C.orange : C.mutedL, marginTop: 8 }}>
                  {l.reunion_at && <>📅 Reunión {fechaHora(l.reunion_at)}{l.proxima_accion ? " · " : ""}</>}
                  {l.proxima_accion && <>➡️ {l.proxima_accion}{l.proxima_accion_at ? " (" + fechaHora(l.proxima_accion_at) + ")" : ""}</>}
                </div>
              )}
              {ACTIVAS.includes(l.estado) && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }} onClick={(ev) => ev.stopPropagation()}>
                  <BotonEnlace small color={C.green} href={telHref(l.telefono)} onClick={() => contacto(l.id, "llamada")}>📞 Llamar</BotonEnlace>
                  <BotonEnlace small color={C.green} outline nueva href={waHref(l)} onClick={() => contacto(l.id, "whatsapp")}>WhatsApp</BotonEnlace>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {leadAbierto && <Ficha key={leadAbierto.id} lead={leadAbierto} onClose={cerrar} aviso={aviso} onCambio={(l) => actualizarUno(l, leadAbierto.id)} />}
      {nuevo && <Nuevo onClose={() => setNuevo(false)} onHecho={(l) => { setNuevo(false); actualizarUno(l); aviso("Clínica añadida"); setAbierto(l.id); }} />}
    </div>
  );
}
