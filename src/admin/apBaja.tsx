// ============================================================
// OficioYa · ADMIN — Rescindir contrato / dar de baja a un profesional (09/11/2026)
// En su ficha (Profesionales): «Rescindir contrato» → motivo, efecto y escribir RESCINDIR.
// Al confirmar, la Edge Function baja-profesional: deja de darle leads, libera su plaza, emite la
// factura final de lo no facturado, genera la carta de resolución con los datos del contrato firmado
// (día y hora si constan) y le envía por email la carta y sus facturas pendientes con el enlace de pago
// de cada una (copia oculta a admin). La carta y los PDF quedan en Archivos.
// ============================================================
import React, { useEffect, useState } from "react";
import { db, SUPABASE_KEY } from "../supabase";
import { C, F, Btn, Pill, Modal, Titulo, eur, fecha, fechaHora, SUPABASE_FN, Pro, oficioDe } from "./apUi";
import { claveAdmin } from "./apFiscal";
import { fnArchivos } from "./apArchivos";

type Motivo = "impago" | "incumplimiento" | "fin" | "peticion";
type Modo = "inmediato" | "preaviso";

export const MOTIVO_BAJA: Record<string, string> = {
  impago: "Impago de facturas",
  incumplimiento: "Incumplimiento del contrato",
  fin: "Fin del contrato (sin incumplimiento)",
  peticion: "A petición del profesional",
};
const MOTIVOS: { v: Motivo; d: string }[] = [
  { v: "impago", d: "Facturas vencidas sin pagar. Deja de recibir leads en el acto." },
  { v: "incumplimiento", d: "Reventa de leads, quejas, datos falsos… Deja de recibir leads en el acto." },
  { v: "fin", d: "Lo terminas tú sin que haya incumplido: con los 15 días de preaviso del contrato." },
  { v: "peticion", d: "Te ha pedido darse de baja: queda constancia por escrito." },
];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLarga = (ymd: string | null | undefined) => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return "";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return d + " de " + MESES[m - 1] + " de " + y;
};

export async function fnBaja(accion: string, body: Record<string, unknown>) {
  const res = await fetch(SUPABASE_FN + "/baja-profesional", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
    body: JSON.stringify({ accion, clave: claveAdmin(), ...body }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j.error || "Error " + res.status);
  return j;
}

const pdfUrl = (b64: string) => {
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
};

const caja = (color: string): React.CSSProperties => ({
  background: color + "14", border: "1px solid " + color + "55", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, color: C.text, fontFamily: F,
});
const inputSt: React.CSSProperties = {
  background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "8px 10px", fontFamily: F, fontSize: 13, boxSizing: "border-box",
};

// ── Modal: rescindir el contrato ─────────────────────────────
export function RescindirContrato({ p, onClose, onHecho }: { p: Pro; onClose: () => void; onHecho: (m: string) => void }) {
  const [prep, setPrep] = useState<any>(null);
  const [error, setError] = useState("");
  const [motivo, setMotivo] = useState<Motivo>("impago");
  const [modo, setModo] = useState<Modo>("inmediato");
  const [texto, setTexto] = useState("");
  const [fechaC, setFechaC] = useState("");
  const [horaC, setHoraC] = useState("");
  const [facturar, setFacturar] = useState(true);
  const [confirma, setConfirma] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [previa, setPrevia] = useState<{ url?: string; cargando?: boolean; error?: string }>({});

  useEffect(() => {
    if (!claveAdmin()) { setError("Entra una vez en Captación desde este dispositivo para poder rescindir contratos."); return; }
    db.rpc("oy_baja_preparar", { p_admin: claveAdmin(), p_pro: p.id }).then(({ data, error }: any) => {
      if (error) { setError(error.message); return; }
      setPrep(data);
      const vencidas = (data?.facturas || []).some((f: any) => f.vencida);
      setMotivo(vencidas ? "impago" : "fin");
      setModo(vencidas ? "inmediato" : "preaviso");
      if (data?.contrato?.fuente === "documento_subido" && data?.contrato?.fecha) setFechaC(data.contrato.fecha);
    });
  }, [p.id]);
  useEffect(() => () => { if (previa.url) URL.revokeObjectURL(previa.url); }, [previa.url]);

  const cambiarMotivo = (m: Motivo) => { setMotivo(m); setModo(m === "fin" || m === "peticion" ? "preaviso" : "inmediato"); setPrevia({}); };
  const contrato = prep?.contrato || {};
  const exacta = !!contrato.exacta;
  const facturas: any[] = prep?.facturas || [];
  const total = facturas.reduce((s, f) => s + Number(f.total || 0), 0);
  const sinFacturar = prep?.sin_facturar || { n: 0, base: 0 };
  const cortaYa = modo === "inmediato" || motivo === "impago" || motivo === "incumplimiento";
  const email = prep?.pro?.email || null;
  const opciones = {
    motivo, modo, motivo_texto: texto.trim() || null, facturar,
    contrato_fecha: !exacta && fechaC ? fechaC : null, contrato_hora: !exacta && fechaC && horaC ? horaC : null,
  };
  const faltaTexto = motivo === "incumplimiento" && texto.trim().length < 5;
  const listo = !!prep && !faltaTexto && confirma.trim().toUpperCase() === "RESCINDIR" && !enviando;

  const verPrevia = async () => {
    setPrevia({ cargando: true });
    try {
      const j = await fnBaja("previa", { pro: p.id, opciones });
      setPrevia({ url: pdfUrl(j.carta) });
    } catch (e: any) { setPrevia({ error: e.message }); }
  };
  const confirmar = async () => {
    if (!listo) return;
    setEnviando(true); setError("");
    try {
      const j = await fnBaja("confirmar", { pro: p.id, opciones });
      setRes(j);
    } catch (e: any) { setError(e.message); }
    setEnviando(false);
  };

  const radio = (activo: boolean, onClick: () => void, titulo: React.ReactNode, sub?: React.ReactNode, color = C.red) => (
    <div onClick={onClick} style={{
      display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "9px 10px", borderRadius: 9, marginBottom: 6,
      border: "1px solid " + (activo ? color : C.border), background: activo ? color + "12" : C.card,
    }}>
      <span style={{ width: 16, height: 16, borderRadius: 99, border: "2px solid " + (activo ? color : C.muted), flexShrink: 0, marginTop: 1,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {activo && <span style={{ width: 8, height: 8, borderRadius: 99, background: color }} />}
      </span>
      <span style={{ fontSize: 13 }}><b>{titulo}</b>{sub && <span style={{ display: "block", color: C.mutedL, fontSize: 12, marginTop: 2 }}>{sub}</span>}</span>
    </div>
  );

  // ── Hecho ──
  if (res) {
    const ok = res.estado === "enviado";
    return (
      <Modal titulo={"Contrato rescindido · " + p.name} onClose={() => onHecho(ok ? "Contrato rescindido y email enviado a " + res.to : "Contrato rescindido")} ancho={560}>
        <div style={caja(ok ? C.green : C.orange)}>
          {ok ? <>✓ <b>{p.name}</b> queda dado de baja. Le hemos enviado a <b>{res.to}</b> la carta de resolución
            {res.facturas?.length ? <> y {res.facturas.length === 1 ? "su factura pendiente" : "sus " + res.facturas.length + " facturas pendientes"} con el enlace de pago</> : null} (copia oculta a admin@algoracompound.com).</>
            : res.estado === "sin_email" ? <><b>{p.name}</b> queda dado de baja, pero no tiene email: la carta está en Archivos para que se la mandes por WhatsApp.</>
            : <><b>{p.name}</b> queda dado de baja, pero <b>el email no ha salido</b>: {res.error || "error desconocido"}. Puedes reintentarlo desde su ficha.</>}
        </div>
        {res.facturas?.length > 0 && (
          <>
            <Titulo>Facturas enviadas</Titulo>
            {res.facturas.map((f: any) => (
              <div key={f.numero} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + C.border + "55", fontSize: 13 }}>
                <span><b>{f.numero}</b> · {f.vencida ? <span style={{ color: C.red }}>vencida</span> : "vence el " + fecha(f.vence)}</span>
                <span><b>{eur(f.total, 2)}</b> · <Pill texto="Pendiente de pago" color={C.orange} /></span>
              </div>
            ))}
          </>
        )}
        {res.avisos?.length > 0 && <div style={{ ...caja(C.orange), marginTop: 12 }}>{res.avisos.join(" ")}</div>}
        <div style={{ marginTop: 16 }}><Btn onClick={() => onHecho(ok ? "Contrato rescindido y email enviado" : "Contrato rescindido")}>Cerrar</Btn></div>
      </Modal>
    );
  }

  return (
    <Modal titulo={"Rescindir contrato · " + p.name} onClose={enviando ? () => {} : onClose} ancho={620}>
      {error && <div style={{ ...caja(C.red), marginBottom: 12 }}>{error}</div>}
      {!prep && !error && <div style={{ fontSize: 13, color: C.muted }}>Cargando sus datos…</div>}
      {prep && (
        <div style={{ color: C.text }}>
          <Titulo>Contrato</Titulo>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            {oficioDe(contrato.oficio || p.trade)}{contrato.ciudad ? " · " + contrato.ciudad : ""}
            {contrato.precio != null ? " · " + eur(Number(contrato.precio), 2) + " + IVA por lead" : ""}
            <br />
            {exacta
              ? <span style={{ color: C.green }}>Firmado el {fechaLarga(contrato.fecha)}{contrato.hora ? " a las " + contrato.hora : ""}{contrato.fuente === "firma_electronica" ? " (firma electrónica)" : ""}</span>
              : <span style={{ color: C.orange }}>
                  {contrato.fuente === "documento_subido" ? "Hay un contrato firmado subido el " + fechaLarga(contrato.fecha) + ": revisa la fecha de firma." : "En el panel no consta la fecha de firma."}
                  {" "}Si la sabes, escríbela y saldrá en la carta:
                </span>}
          </div>
          {!exacta && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input type="date" value={fechaC} onChange={(e) => { setFechaC(e.target.value); setPrevia({}); }} style={inputSt} />
              <input type="time" value={horaC} onChange={(e) => { setHoraC(e.target.value); setPrevia({}); }} style={{ ...inputSt, width: 110 }} />
              <span style={{ fontSize: 12, color: C.muted }}>La hora, si no la sabes, déjala vacía.</span>
            </div>
          )}

          <Titulo>Motivo</Titulo>
          {MOTIVOS.map((m) => <React.Fragment key={m.v}>{radio(motivo === m.v, () => cambiarMotivo(m.v), MOTIVO_BAJA[m.v], m.d)}</React.Fragment>)}
          {(motivo === "incumplimiento" || motivo === "peticion") && (
            <textarea value={texto} onChange={(e) => { setTexto(e.target.value); setPrevia({}); }} rows={2}
              placeholder={motivo === "incumplimiento" ? "En qué ha incumplido (sale en la carta). Ej.: ha revendido leads a otro pintor" : "Detalle (opcional, sale en la carta)"}
              style={{ ...inputSt, width: "100%", resize: "vertical", marginTop: 2 }} />
          )}
          {motivo === "impago" && !facturas.some((f) => f.vencida) && (
            <div style={{ ...caja(C.orange), marginTop: 4 }}>No tiene ninguna factura vencida. Revisa si el motivo es el correcto.</div>
          )}

          <Titulo>Efecto</Titulo>
          {radio(modo === "inmediato", () => { setModo("inmediato"); setPrevia({}); }, "Desde hoy", "El contrato se extingue hoy.")}
          {radio(modo === "preaviso", () => { setModo("preaviso"); setPrevia({}); }, "Con 15 días de preaviso",
            "Se extingue el " + fechaLarga(prep.preaviso_hasta) + "." + (cortaYa ? " Por " + (motivo === "impago" ? "el impago" : "el incumplimiento") + " deja de recibir leads ya." : " Hasta entonces sigue recibiendo leads."))}

          <Titulo>Facturas pendientes de pago</Titulo>
          {facturas.length === 0 && sinFacturar.n === 0 && <div style={{ fontSize: 13, color: C.muted }}>No tiene facturas pendientes.</div>}
          {facturas.map((f) => (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid " + C.border + "55", fontSize: 13 }}>
              <span><b>{f.numero}</b>{f.rectificativa ? " (rectificativa)" : ""} · {f.vencida ? <span style={{ color: C.red }}>vencida el {fecha(f.vence)}</span> : "vence el " + fecha(f.vence)}</span>
              <b style={{ whiteSpace: "nowrap" }}>{eur(Number(f.total), 2)}</b>
            </div>
          ))}
          {facturas.length > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}><b>Total</b><b>{eur(total, 2)}</b></div>}
          {sinFacturar.n > 0 && (cortaYa ? (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, marginTop: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={facturar} onChange={(e) => { setFacturar(e.target.checked); setPrevia({}); }} style={{ marginTop: 3 }} />
              <span>Emitir ahora la <b>factura final</b> de {sinFacturar.n} {sinFacturar.n === 1 ? "lead" : "leads"} sin facturar ({eur(Number(sinFacturar.base), 2)} + IVA) y mandársela con las demás.</span>
            </label>
          ) : <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Tiene {sinFacturar.n} leads sin facturar: se facturan con la facturación normal.</div>)}

          <Titulo>Qué va a pasar</Titulo>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.65, color: C.text }}>
            <li>{cortaYa ? "Deja de recibir leads ahora" : "Recibe leads hasta el " + fechaLarga(prep.preaviso_hasta) + " y ese día se le quitan"}
              {prep.reparto?.length ? " (" + prep.reparto.map((r: any) => oficioDe(r.trade_key) + " en " + r.city_slug).join(", ") + ")" : ""}.
              {prep.plazas?.length ? " Su plaza en " + prep.plazas.map((x: any) => x.ciudad || x.slug).join(", ") + " queda libre." : ""}</li>
            {email
              ? <li>Se le envía a <b>{email}</b> un email con la <b>carta de {motivo === "impago" || motivo === "incumplimiento" ? "resolución" : "terminación"}</b> en PDF (con los datos de su contrato){facturas.length || (sinFacturar.n && cortaYa && facturar) ? <> y sus <b>facturas pendientes</b>, cada una con su botón de <b>pagar con tarjeta</b> (también transferencia o Bizum)</> : null}. Copia oculta a admin@algoracompound.com.</li>
              : <li style={{ color: C.orange }}>No tiene un email válido: no se le envía nada. La carta se guarda en Archivos para que se la mandes tú por WhatsApp.</li>}
            <li>La carta y los PDF se guardan en Archivos → Profesionales → su carpeta.</li>
            <li>Queda como «Dado de baja». La baja se puede deshacer; el email, no.</li>
          </ul>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
            <Btn small outline color={C.mutedL} disabled={previa.cargando || faltaTexto} onClick={verPrevia}>{previa.cargando ? "Preparando…" : "Ver cómo queda la carta"}</Btn>
            {previa.url && <a href={previa.url} target="_blank" rel="noreferrer" style={{ fontFamily: F, fontWeight: 800, fontSize: 12, color: C.accent, border: "1px solid " + C.accent, borderRadius: 8, padding: "6px 10px", textDecoration: "none" }}>Abrir la carta (PDF)</a>}
            {previa.error && <span style={{ fontSize: 12, color: C.red }}>{previa.error}</span>}
          </div>

          <div style={{ ...caja(C.red), marginTop: 16 }}>
            <div style={{ marginBottom: 8 }}>Para confirmar, escribe <b>RESCINDIR</b>:</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={confirma} onChange={(e) => setConfirma(e.target.value)} placeholder="RESCINDIR" autoComplete="off"
                style={{ ...inputSt, width: 160, textTransform: "uppercase" }} />
              <Btn color={C.red} disabled={!listo} onClick={confirmar}>{enviando ? "Rescindiendo y enviando…" : "Rescindir contrato y enviar"}</Btn>
            </div>
            {faltaTexto && <div style={{ fontSize: 12, color: C.orange, marginTop: 6 }}>Escribe en qué ha incumplido el contrato.</div>}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── En la ficha de un profesional dado de baja ───────────────
export function BajaInfo({ p, onHecho }: { p: Pro; onHecho: (m: string) => void }) {
  const [b, setB] = useState<any>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const cargar = () => {
    if (!claveAdmin()) { setB(null); return; }
    db.rpc("oy_baja_info", { p_admin: claveAdmin(), p_pro: p.id }).then(({ data, error }: any) => setB(error ? null : data || null));
  };
  useEffect(cargar, [p.id, p.baja_at]);

  const verCarta = async () => {
    const w = window.open("", "_blank");
    try {
      const j = await fnArchivos("urls", { ids: [b.carta_archivo_id] });
      const url = j.urls?.[b.carta_archivo_id];
      if (!url) throw new Error("La carta no está en Archivos");
      if (w) w.location.href = url; else window.location.href = url;
    } catch (e: any) { if (w) w.close(); alert(e.message); }
  };
  const reenviar = async () => {
    setOcupado(true);
    try {
      const j = await fnBaja("reenviar", { pro: p.id });
      onHecho(j.estado === "enviado" ? "Email enviado a " + j.to : "No se ha podido enviar: " + (j.error || j.estado));
    } catch (e: any) { alert("Error: " + e.message); }
    setOcupado(false); cargar();
  };
  const deshacer = async () => {
    if (!confirm("¿Deshacer la baja de " + p.name + "? No se le avisa de nada. Si tiene que volver a recibir leads, dáselos desde «Reparto de leads».")) return;
    setOcupado(true);
    const { error } = await db.rpc("oy_baja_deshacer", { p_admin: claveAdmin(), p_pro: p.id });
    setOcupado(false);
    if (error) { alert("Error: " + error.message); return; }
    onHecho("Baja deshecha: " + p.name + " vuelve a estar activo");
  };

  if (b === undefined) return <div style={{ ...caja(C.red), marginTop: 12 }}>Dado de baja el {fechaHora(p.baja_at || null)}.</div>;
  if (!b) return <div style={{ ...caja(C.red), marginTop: 12 }}>Dado de baja el {fechaHora(p.baja_at || null)}. {claveAdmin() ? "" : "Entra una vez en Captación desde este dispositivo para ver el detalle."}</div>;
  const efectoPasado = !!b.efecto_pasado;
  const facts: any[] = Array.isArray(b.facturas) ? b.facturas : [];
  return (
    <div style={{ ...caja(C.red), marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>Dado de baja · {MOTIVO_BAJA[b.motivo] || b.motivo}</div>
      <div>Comunicada el {fechaHora(b.comunicada_at)} · {b.modo === "preaviso" ? "con preaviso: " : ""}{efectoPasado ? "contrato extinguido el " : "se extingue el "}{fecha(b.efecto_at)}
        {b.reparto_quitado_at ? " · ya no recibe leads" : " · recibe leads hasta esa fecha"}.</div>
      {b.motivo_texto && <div style={{ color: C.mutedL }}>«{b.motivo_texto}»</div>}
      <div style={{ marginTop: 4 }}>
        {b.email_estado === "enviado" && <span style={{ color: C.green }}>Carta y facturas enviadas a {b.email_to}{b.email_at ? " el " + fechaHora(b.email_at) : ""}.</span>}
        {b.email_estado === "error" && <span style={{ color: C.orange }}>El email no ha salido: {b.email_error || "error"}.</span>}
        {b.email_estado === "pendiente" && <span style={{ color: C.orange }}>El email no se llegó a enviar.</span>}
        {b.email_estado === "sin_email" && <span style={{ color: C.orange }}>No tiene email: mándale la carta por WhatsApp (está en Archivos).</span>}
      </div>
      {facts.length > 0 && <div style={{ color: C.mutedL, marginTop: 2 }}>Facturas enviadas: {facts.map((f) => f.numero + " (" + eur(Number(f.total), 2) + ")").join(", ")}.</div>}
      {b.notas && <div style={{ color: C.mutedL, marginTop: 2 }}>{b.notas}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {b.carta_archivo_id && <Btn small outline color={C.text} onClick={verCarta}>Ver la carta</Btn>}
        {(b.email_estado === "error" || b.email_estado === "pendiente") && <Btn small color={C.orange} disabled={ocupado} onClick={reenviar}>{ocupado ? "Enviando…" : "Reintentar el envío"}</Btn>}
        <Btn small outline color={C.mutedL} disabled={ocupado} onClick={deshacer}>Deshacer la baja</Btn>
      </div>
    </div>
  );
}
