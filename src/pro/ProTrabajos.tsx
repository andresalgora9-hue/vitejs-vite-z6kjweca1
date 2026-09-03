// ============================================================
// OficioYa · Panel PROFESIONAL — pestaña TRABAJOS
// Archivo independiente. No toca Perfil ni Mensajes.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { db } from "../supabase";
import {
  DealRow, DealEventRow, DealRequestRow, InvoiceRow, Stage,
  STAGES_ACTIVOS, STAGES_SALDO, SUBSTAGES,
  CLOSE_REASONS_SIN_PRECIO, CLOSE_REASONS_CON_PRECIO, REASONS_REASIGNAR,
  PAUSE_REASONS, UNPAID_REASONS, labelDe,
  eur, fechaCorta, tiempoRestante, conceptoTransferencia,
  OY_IBAN, OY_TITULAR,
} from "../shared/crm";

const C = {
  bg: "#0F1117", surface: "#161B27", card: "#1E2536", border: "#2D3A52",
  accent: "#FFD700", orange: "#FF8C00", red: "#FF4455", green: "#00D68F",
  blue: "#3B82F6", text: "#E8EDF5", muted: "#5A6A8A", mutedL: "#8899BB",
};
const F = "'DM Sans',sans-serif";

// ── PIEZAS DE INTERFAZ ──────────────────────────────────────
function Card({ children, style = {}, accent }: any) {
  return (
    <div style={{
      background: C.card, border: "1px solid " + (accent || C.border),
      borderRadius: 12, padding: 14, marginBottom: 10, ...style,
    }}>{children}</div>
  );
}

function Boton({ children, onClick, color = C.accent, outline = false, full = false, small = false, disabled = false }: any) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      padding: small ? "8px 12px" : "11px 14px",
      background: disabled ? C.border : outline ? "transparent" : color,
      border: outline ? "1px solid " + color : "none",
      borderRadius: 9,
      color: disabled ? C.muted : outline ? color : (color === C.accent || color === C.green ? "#000" : "#fff"),
      fontFamily: F, fontSize: small ? 12 : 13, fontWeight: 800,
      cursor: disabled ? "not-allowed" : "pointer",
      width: full ? "100%" : undefined, flex: full ? undefined : 1,
    }}>{children}</button>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 30000,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 520,
        maxHeight: "92vh", overflowY: "auto", padding: 20,
        paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
        border: "1px solid " + C.border,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ color: C.text, fontSize: 17, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Radios({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          display: "flex", alignItems: "center", gap: 10, textAlign: "left",
          padding: "11px 12px", borderRadius: 9, cursor: "pointer", fontFamily: F,
          background: value === o.id ? C.accent + "18" : "transparent",
          border: "1px solid " + (value === o.id ? C.accent : C.border),
          color: value === o.id ? C.text : C.mutedL, fontSize: 13, fontWeight: 600,
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
            border: "2px solid " + (value === o.id ? C.accent : C.muted),
            background: value === o.id ? C.accent : "transparent",
          }} />
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Campo({ label, value, onChange, type = "text", placeholder = "", sufijo }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 6, fontWeight: 600 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type={type} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1, padding: "11px 12px", background: C.bg, border: "1px solid " + C.border,
            borderRadius: 9, color: C.text, fontSize: 15, fontFamily: F, outline: "none",
          }}
        />
        {sufijo && <span style={{ color: C.mutedL, fontSize: 15, fontWeight: 700 }}>{sufijo}</span>}
      </div>
    </div>
  );
}

function Reloj({ deal }: { deal: DealRow }) {
  const t = tiempoRestante(deal.deadline_at);
  if (!deal.deadline_at) return null;
  const esCobro = deal.stage === "completado";
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 5,
      background: t.vencido ? C.red + "22" : esCobro ? C.blue + "18" : C.orange + "18",
      color: t.vencido ? C.red : esCobro ? C.blue : C.orange,
    }}>
      {t.vencido ? "⚠ vencido hace " + t.texto : (esCobro ? "se dará por cobrado en " : "quedan ") + t.texto}
    </span>
  );
}

// ── COMPONENTE PRINCIPAL ────────────────────────────────────
export default function ProTrabajos({ user, onToast }: { user: { id: string; name: string }; onToast?: (m: string) => void }) {
  const [sub, setSub] = useState<"activos" | "espera" | "saldo" | "historial">("activos");
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [pagos, setPagos] = useState<{ amount: number }[]>([]);
  const [facturas, setFacturas] = useState<InvoiceRow[]>([]);
  const [solicitudes, setSolicitudes] = useState<DealRequestRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroHist, setFiltroHist] = useState<"liquidados" | "cancelados">("liquidados");

  // modales
  const [mPrecio, setMPrecio] = useState<DealRow | null>(null);
  const [mFecha, setMFecha] = useState<DealRow | null>(null);
  const [mCobro, setMCobro] = useState<DealRow | null>(null);
  const [mImpago, setMImpago] = useState<DealRow | null>(null);
  const [mDevolver, setMDevolver] = useState<DealRow | null>(null);
  const [mAparcar, setMAparcar] = useState<DealRow | null>(null);
  const [mFicha, setMFicha] = useState<DealRow | null>(null);
    const [mNotas, setMNotas] = useState<DealRow | null>(null);
  const [notas, setNotas] = useState<any[]>([]);
  const [cargandoNotas, setCargandoNotas] = useState(false);

  const aviso = (m: string) => { if (onToast) onToast(m); };

  const cargar = useCallback(async () => {
    const [d, p, f, s] = await Promise.all([
      db.from("deals").select("*").eq("pro_id", user.id).order("created_at", { ascending: false }),
      db.from("commission_payments").select("amount").eq("pro_id", user.id),
      db.from("commission_invoices").select("*").eq("pro_id", user.id).order("issued_at", { ascending: false }),
      db.from("deal_requests").select("*").eq("pro_id", user.id).eq("status", "pendiente"),
    ]);
    setDeals((d.data as DealRow[]) || []);
    setPagos((p.data as any[]) || []);
    setFacturas((f.data as InvoiceRow[]) || []);
    setSolicitudes((s.data as DealRequestRow[]) || []);
    setCargando(false);
  }, [user.id]);

  useEffect(() => { cargar(); }, [cargar]);

  // Tiempo real: si admin cambia algo, se ve al momento
  useEffect(() => {
    const ch = db.channel("pro-deals-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: "pro_id=eq." + user.id }, () => cargar())
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [user.id, cargar]);

  // Refrescar los relojes cada minuto
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 60000); return () => clearInterval(i); }, []);

  const guardar = async (id: string, cambios: any, mensaje?: string) => {
    const { error } = await db.from("deals").update(cambios).eq("id", id);
    if (error) { aviso("No se pudo guardar. Inténtalo otra vez."); return false; }
    await cargar();
    if (mensaje) aviso(mensaje);
    return true;
  };

    const evento = async (dealId: string, event: string, detail: string) => {
    await db.from("deal_events").insert({
      deal_id: dealId, actor_id: user.id, actor_name: user.name,
      actor_role: "pro", event, detail,
    });
  };

  const cargarNotas = useCallback(async (dealId: string) => {
    setCargandoNotas(true);
    const { data } = await db.from("deal_events").select("*").eq("deal_id", dealId).order("created_at", { ascending: false });
    setNotas(data || []);
    setCargandoNotas(false);
  }, []);

  const abrirNotas = (d: DealRow) => { setMNotas(d); setNotas([]); cargarNotas(d.id); };

  const anadirNota = async (dealId: string, texto: string) => {
    const t = texto.trim();
    if (!t) return false;
    const { error } = await db.from("deal_events").insert({
      deal_id: dealId, actor_id: user.id, actor_name: user.name,
      actor_role: "pro", event: "nota", detail: t,
    });
    if (error) { aviso("No se pudo guardar la nota."); return false; }
    await cargarNotas(dealId);
    return true;
  };

  // ── CLASIFICACIÓN ──
  const tieneSolicitud = (id: string) => solicitudes.some((s) => s.deal_id === id);
  const activos = deals.filter((d) => STAGES_ACTIVOS.includes(d.stage) ||
    (d.stage === "cobrado_cliente" && Number(d.collected_amount) < Number(d.price || 0)));
  const nuevos = activos.filter((d) => d.stage === "asignado");
  const sinPrecio = activos.filter((d) => d.stage === "aceptado" || d.stage === "presupuestando");
  const enMarcha = activos.filter((d) => d.stage === "precio_acordado" || d.stage === "programado");
  const esperandoCobro = activos.filter((d) => d.stage === "completado" || d.stage === "cobrado_cliente");
  const enEspera = deals.filter((d) => d.stage === "en_espera");
  const historialLiq = deals.filter((d) => d.stage === "liquidado" || d.settled_at);
  const historialCanc = deals.filter((d) => d.stage === "cerrado");

  // ── SALDO ──
  const dealsSaldo = deals.filter((d) => STAGES_SALDO.includes(d.stage) && !d.settled_at);
  const devengado = dealsSaldo.reduce((a, d) => a + Number(d.commission_due || 0), 0);
  const pagado = pagos.reduce((a, p) => a + Number(p.amount || 0), 0);
  const pendiente = Math.max(0, devengado - pagado);
  const concepto = conceptoTransferencia(user.name);

  const copiarDatos = () => {
    const txt = `${OY_TITULAR}\n${OY_IBAN}\nConcepto: ${concepto}\nImporte: ${eur(pendiente)}`;
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => aviso("✓ Datos copiados"));
  };

  // ── ACCIONES ──
  const aceptar = (d: DealRow) => guardar(d.id, { stage: "aceptado" }, "✓ Trabajo aceptado. Ya puedes ver el teléfono.");

  const noPuedo = (d: DealRow) =>
    guardar(d.id, { stage: "cerrado", close_reason: "pro_no_atiende", close_price: 0, returned_to_admin: true },
      "Devuelto a OficioYa. Se lo asignaremos a otro.");

  const marcarSubstage = async (d: DealRow, id: string, fecha: string) => {
    const opt = SUBSTAGES.find((s) => s.id === id);
    const cambios: any = { stage: "presupuestando", substage: id };
    if (opt?.pideFecha && fecha) {
      cambios.next_step_at = new Date(fecha + "T12:00:00").toISOString();
      cambios.deadline_at = new Date(new Date(fecha + "T12:00:00").getTime() + 86400000).toISOString();
    } else if (id === "confirma") {
      cambios.deadline_at = new Date(Date.now() + 5 * 86400000).toISOString();
    } else {
      cambios.deadline_at = new Date(Date.now() + 2 * 86400000).toISOString();
    }
    await guardar(d.id, cambios);
    await evento(d.id, "seguimiento", opt?.label || id);
  };

  // ── RENDER ──
  if (cargando) {
    return <div style={{ padding: 50, textAlign: "center", color: C.muted, fontSize: 13 }}>Cargando tus trabajos…</div>;
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ padding: "20px 0 14px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: C.text, margin: 0 }}>Mis trabajos</h2>
      </div>

      {/* SUB-PESTAÑAS */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {([
          ["activos", "Activos", activos.length ? String(activos.length) : ""],
          ["espera", "En espera", enEspera.length ? String(enEspera.length) : ""],
          ["saldo", "Saldo", pendiente > 0 ? eur(pendiente) : ""],
          ["historial", "Historial", ""],
        ] as const).map(([id, label, badge]) => (
          <button key={id} onClick={() => setSub(id as any)} style={{
            flexShrink: 0, padding: "9px 13px", borderRadius: 9, cursor: "pointer", fontFamily: F,
            border: "1px solid " + (sub === id ? C.accent : C.border),
            background: sub === id ? C.accent + "18" : "transparent",
            color: sub === id ? C.accent : C.muted, fontSize: 12, fontWeight: 700,
          }}>
            {label}{badge ? " · " + badge : ""}
          </button>
        ))}
      </div>

      {/* ═══ ACTIVOS ═══ */}
      {sub === "activos" && (
        <>
          {activos.length === 0 && (
            <Card style={{ textAlign: "center", padding: 34 }}>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No tienes trabajos activos ahora mismo.</p>
              <p style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>Te avisaremos en cuanto te asignemos uno.</p>
            </Card>
          )}

          {/* NUEVOS */}
          {nuevos.length > 0 && (
            <>
              <Titulo color={C.orange}>🔴 Nuevos · acepta o rechaza</Titulo>
              {nuevos.map((d) => (
                <Card key={d.id} accent={C.orange + "55"} style={{ background: "#1a1500" }}>
                  <Cabecera d={d} ocultarTelefono onFicha={() => abrirNotas(d)} />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <Boton onClick={() => aceptar(d)} color={C.accent}>✓ Aceptar</Boton>
                    <Boton onClick={() => noPuedo(d)} color={C.red} outline small>No puedo</Boton>
                  </div>
                </Card>
              ))}
            </>
          )}

          {/* PRESUPUESTANDO */}
          {sinPrecio.length > 0 && (
            <>
              <Titulo color={C.blue}>🔵 Pendientes de precio</Titulo>
              {sinPrecio.map((d) => (
                <Card key={d.id}>
                  <Cabecera d={d} onFicha={() => abrirNotas(d)} />
                  <div style={{ marginTop: 12, marginBottom: 10 }}>
                    <p style={{ fontSize: 11, color: C.mutedL, marginBottom: 7, fontWeight: 700 }}>¿Cómo va?</p>
                    <Radios
                      options={SUBSTAGES.map((s) => ({ id: s.id, label: s.label }))}
                      value={d.substage || ""}
                      onChange={(v) => {
                        const opt = SUBSTAGES.find((s) => s.id === v);
                        if (opt?.pideFecha) {
                          const f = window.prompt("¿Qué día vas a visitarlo? (formato 2026-08-12)");
                          if (f) marcarSubstage(d, v, f);
                        } else marcarSubstage(d, v, "");
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Boton onClick={() => setMPrecio(d)} color={C.accent}>Poner precio</Boton>
                    <Boton onClick={() => setMAparcar(d)} color={C.mutedL} outline small disabled={tieneSolicitud(d.id)}>
                      {tieneSolicitud(d.id) ? "Pedido" : "Aparcar"}
                    </Boton>
                    <Boton onClick={() => setMDevolver(d)} color={C.red} outline small>Devolver</Boton>
                  </div>
                </Card>
              ))}
            </>
          )}

          {/* EN MARCHA */}
          {enMarcha.length > 0 && (
            <>
              <Titulo color={C.green}>🟡 En marcha</Titulo>
              {enMarcha.map((d) => (
                <Card key={d.id}>
                  <Cabecera d={d} onFicha={() => abrirNotas(d)} />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {d.stage === "precio_acordado"
                      ? <Boton onClick={() => setMFecha(d)} color={C.blue}>Fijar fecha</Boton>
                      : <Boton onClick={() => guardar(d.id, { stage: "completado" }, "✓ Trabajo completado")} color={C.green}>Marcar completado</Boton>}
                    <Boton onClick={() => setMPrecio(d)} color={C.mutedL} outline small>Editar precio</Boton>
                    <Boton onClick={() => setMDevolver(d)} color={C.red} outline small>Devolver</Boton>
                  </div>
                </Card>
              ))}
            </>
          )}

          {/* ESPERANDO COBRO */}
          {esperandoCobro.length > 0 && (
            <>
              <Titulo color={C.blue}>⏳ Esperando cobro del cliente</Titulo>
              {esperandoCobro.map((d) => {
                const parcial = Number(d.collected_amount) > 0 && Number(d.collected_amount) < Number(d.price || 0);
                return (
                  <Card key={d.id}>
                    <Cabecera d={d} onFicha={() => abrirNotas(d)} />
                    {parcial && (
                      <p style={{ fontSize: 12, color: C.orange, marginTop: 8, fontWeight: 700 }}>
                        Cobrado {eur(d.collected_amount)} de {eur(d.price)} · quedan {eur(Number(d.price || 0) - Number(d.collected_amount))}
                      </p>
                    )}
                    {d.unpaid_reason && (
                      <p style={{ fontSize: 12, color: C.red, marginTop: 8 }}>
                        Impago declarado: {labelDe(UNPAID_REASONS, d.unpaid_reason)}
                        {d.unpaid_expected_date ? " · previsto " + fechaCorta(d.unpaid_expected_date) : ""}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <Boton onClick={() => setMCobro(d)} color={C.green}>{parcial ? "Añadir cobro" : "Ya he cobrado"}</Boton>
                      <Boton onClick={() => setMImpago(d)} color={C.red} outline small>No me ha pagado</Boton>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </>
      )}

      {/* ═══ EN ESPERA ═══ */}
      {sub === "espera" && (
        <>
          {solicitudes.length > 0 && (
            <>
              <Titulo color={C.orange}>Pendientes de aprobación</Titulo>
              {solicitudes.map((s) => {
                const d = deals.find((x) => x.id === s.deal_id);
                return (
                  <Card key={s.id} accent={C.orange + "44"}>
                    <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: 0 }}>{d?.client_name || "Trabajo"}</p>
                                       <p style={{ color: C.mutedL, fontSize: 12, marginTop: 4 }}>
                      {s.kind === "correccion"
                        ? "Pediste corregir la ficha" + (s.note ? ": " + s.note : "")
                        : "Pediste aparcar hasta el " + fechaCorta(s.requested_until) + " · " + labelDe(PAUSE_REASONS, s.reason)}
                    </p>
                    <p style={{ color: C.orange, fontSize: 12, marginTop: 8, fontWeight: 700 }}>
                                            {s.kind === "correccion" ? "⏳ Pendiente de que OficioYa lo revise" : "⏳ El reloj sigue corriendo hasta que OficioYa lo apruebe"}
                    </p>
                  </Card>
                );
              })}
            </>
          )}
          {enEspera.length === 0 && solicitudes.length === 0 && (
            <Card style={{ textAlign: "center", padding: 34 }}>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No tienes trabajos aparcados.</p>
            </Card>
          )}
          {enEspera.map((d) => (
            <Card key={d.id}>
              <p style={{ fontSize: 11, color: C.mutedL, fontWeight: 800, marginBottom: 6 }}>
                💤 Se reactiva el {fechaCorta(d.pause_until)}
              </p>
              <Cabecera d={d} onFicha={() => abrirNotas(d)} />
              <p style={{ color: C.mutedL, fontSize: 12, marginTop: 8 }}>{labelDe(PAUSE_REASONS, d.pause_reason)}</p>
            </Card>
          ))}
        </>
      )}

      {/* ═══ SALDO ═══ */}
      {sub === "saldo" && (
        <>
          <Card style={{ textAlign: "center", padding: "26px 16px" }}>
            <p style={{ color: C.mutedL, fontSize: 12, marginBottom: 6 }}>Pendiente de liquidar</p>
            <p style={{ color: pendiente > 0 ? C.accent : C.green, fontSize: 38, fontWeight: 900, margin: 0 }}>{eur(pendiente)}</p>
            <p style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>Comisión del 20% sobre lo que ya has cobrado</p>
          </Card>

          {pendiente > 0 && (
            <Card>
              <p style={{ fontSize: 11, color: C.mutedL, fontWeight: 800, marginBottom: 10 }}>DATOS PARA LA TRANSFERENCIA</p>
              <Fila k="Titular" v={OY_TITULAR} />
              <Fila k="IBAN" v={OY_IBAN} />
              <Fila k="Concepto" v={concepto} />
              <Fila k="Importe" v={eur(pendiente)} destacado />
              <div style={{ marginTop: 12 }}><Boton full onClick={copiarDatos}>Copiar datos</Boton></div>
            </Card>
          )}

          {dealsSaldo.length > 0 && (
            <>
              <Titulo color={C.mutedL}>Incluye estos trabajos</Titulo>
              <Card>
                {dealsSaldo.map((d, i) => (
                  <div key={d.id} style={{
                    display: "flex", justifyContent: "space-between", padding: "9px 0",
                    borderTop: i === 0 ? "none" : "1px solid " + C.border,
                  }}>
                    <span style={{ color: C.text, fontSize: 13 }}>{d.client_name}</span>
                    <span style={{ color: C.mutedL, fontSize: 13 }}>
                      {eur(d.collected_amount)} → <b style={{ color: C.accent }}>{eur(d.commission_due)}</b>
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}

          {pagado > 0 && (
            <p style={{ textAlign: "center", color: C.green, fontSize: 12, marginTop: 10 }}>
              ✓ Ya has liquidado {eur(pagado)} en total
            </p>
          )}
        </>
      )}

      {/* ═══ HISTORIAL ═══ */}
      {sub === "historial" && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {(["liquidados", "cancelados"] as const).map((f) => (
              <button key={f} onClick={() => setFiltroHist(f)} style={{
                padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 700,
                border: "1px solid " + (filtroHist === f ? C.mutedL : C.border),
                background: "transparent", color: filtroHist === f ? C.text : C.muted,
                textTransform: "capitalize" as const,
              }}>{f}</button>
            ))}
          </div>

          {facturas.length > 0 && filtroHist === "liquidados" && (
            <>
              <Titulo color={C.mutedL}>Facturas</Titulo>
              {facturas.map((f) => (
                <Card key={f.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ color: C.text, fontWeight: 700, fontSize: 13, margin: 0 }}>Factura {f.number}</p>
                      <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
                        {fechaCorta(f.period_start)} – {fechaCorta(f.period_end)} · {eur(f.total)}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 5,
                      background: f.status === "cobrada" ? C.green + "22" : C.orange + "22",
                      color: f.status === "cobrada" ? C.green : C.orange,
                    }}>{f.status === "cobrada" ? "LIQUIDADA" : "PENDIENTE"}</span>
                  </div>
                </Card>
              ))}
            </>
          )}

          {(filtroHist === "liquidados" ? historialLiq : historialCanc).length === 0 && (
            <Card style={{ textAlign: "center", padding: 34 }}>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Nada por aquí todavía.</p>
            </Card>
          )}

          {(filtroHist === "liquidados" ? historialLiq : historialCanc).map((d) => (
            <Card key={d.id} style={{ opacity: 0.75 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: C.text, fontWeight: 700, fontSize: 13, margin: 0 }}>{d.client_name}</p>
                  <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
                    {d.trade}{d.zone ? " · " + d.zone : ""} · {fechaCorta(d.closed_at || d.settled_at || d.created_at)}
                  </p>
                  {d.close_reason && (
                    <p style={{ color: C.mutedL, fontSize: 12, marginTop: 6 }}>
                      {labelDe([...CLOSE_REASONS_CON_PRECIO, ...CLOSE_REASONS_SIN_PRECIO], d.close_reason)}
                      {d.close_note ? " — " + d.close_note : ""}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                  {d.settled_at
                    ? <><p style={{ color: C.green, fontSize: 13, fontWeight: 800, margin: 0 }}>🔒 {eur(d.commission_due)}</p>
                        <p style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>liquidado</p></>
                    : <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>{d.close_price ? eur(d.close_price) : "—"}</p>}
                </div>
              </div>
              {d.settled_at && (
                <button onClick={() => setMFicha(d)} style={{
                  marginTop: 10, background: "none", border: "1px solid " + C.border, borderRadius: 7,
                  color: C.mutedL, fontSize: 11, padding: "6px 10px", cursor: "pointer", fontFamily: F,
                }}>Solicitar corrección</button>
              )}
            </Card>
          ))}
        </>
      )}

      {/* ═══════════ MODALES ═══════════ */}
      {mPrecio && <ModalPrecio d={mPrecio} onClose={() => setMPrecio(null)} onSave={async (p) => {
        await guardar(mPrecio.id, { stage: "precio_acordado", price: p, deadline_at: null }, "✓ Precio guardado: " + eur(p));
        setMPrecio(null);
      }} />}

      {mFecha && <ModalFecha d={mFecha} onClose={() => setMFecha(null)} onSave={async (f) => {
        await guardar(mFecha.id, { stage: "programado", scheduled_for: f }, "✓ Fecha fijada");
        setMFecha(null);
      }} />}

      {mCobro && <ModalCobro d={mCobro} onClose={() => setMCobro(null)} onSave={async (imp, fecha) => {
        const total = Number(mCobro.collected_amount || 0) + imp;
        await guardar(mCobro.id, {
          stage: "cobrado_cliente", collected_amount: total, collected_at: fecha,
          unpaid_reason: null, unpaid_expected_date: null, deadline_at: null,
        }, "✓ Cobro registrado");
        setMCobro(null);
      }} />}

      {mImpago && <ModalImpago d={mImpago} onClose={() => setMImpago(null)} onSave={async (motivo, fecha) => {
        await guardar(mImpago.id, {
          unpaid_reason: motivo, unpaid_expected_date: fecha || null,
          deadline_at: fecha ? new Date(fecha + "T12:00:00").toISOString() : null,
        }, "Impago registrado. OficioYa lo ha recibido.");
        await evento(mImpago.id, "impago", labelDe(UNPAID_REASONS, motivo));
        setMImpago(null);
      }} />}

      {mDevolver && <ModalDevolver d={mDevolver} onClose={() => setMDevolver(null)} onSave={async (precio, motivo, nota) => {
        await guardar(mDevolver.id, {
          stage: "cerrado", close_reason: motivo, close_price: precio, close_note: nota || null,
          returned_to_admin: REASONS_REASIGNAR.includes(motivo), deadline_at: null,
        }, "Devuelto a OficioYa");
        setMDevolver(null);
      }} />}

      {mAparcar && <ModalAparcar d={mAparcar} onClose={() => setMAparcar(null)} onSave={async (hasta, motivo, nota) => {
        const { error } = await db.from("deal_requests").insert({
          deal_id: mAparcar.id, pro_id: user.id, pro_name: user.name, kind: "pausa",
          requested_until: hasta, reason: motivo, note: nota || null,
        });
        if (error) { aviso("No se pudo enviar."); return; }
        await evento(mAparcar.id, "solicitud_pausa", "Pide aparcar hasta " + hasta);
        await cargar();
        aviso("Solicitud enviada. El reloj sigue hasta que se apruebe.");
        setMAparcar(null);
      }} />}

      {mFicha && <ModalCorreccion d={mFicha} onClose={() => setMFicha(null)} onSave={async (imp, nota) => {
        await db.from("deal_requests").insert({
          deal_id: mFicha.id, pro_id: user.id, pro_name: user.name, kind: "correccion",
          new_amount: imp, note: nota,
        });
        await cargar();
        aviso("Solicitud enviada a OficioYa.");
        setMFicha(null);
      }} />}
       {mNotas && <ModalFichaTecnica d={mNotas} notas={notas} cargando={cargandoNotas} onClose={() => setMNotas(null)} onAddNota={anadirNota} />}
    </div>
  );
}

// ── SUB-COMPONENTES ─────────────────────────────────────────
function Titulo({ children, color }: any) {
  return (
    <p style={{
      fontSize: 11, color, fontWeight: 800, textTransform: "uppercase" as const,
      letterSpacing: "0.07em", margin: "18px 0 9px",
    }}>{children}</p>
  );
}

function Fila({ k, v, destacado }: { k: string; v: string; destacado?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
      <span style={{ color: C.muted, fontSize: 12 }}>{k}</span>
      <span style={{ color: destacado ? C.accent : C.text, fontSize: 13, fontWeight: destacado ? 800 : 600 }}>{v}</span>
    </div>
  );
}

function Cabecera({ d, ocultarTelefono, onFicha, notas }: { d: DealRow; ocultarTelefono?: boolean; onFicha?: () => void; notas?: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          {onFicha ? (             <button onClick={onFicha} style={{               background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: F,               color: C.text, fontWeight: 800, fontSize: 15, textAlign: "left",               display: "flex", alignItems: "center", gap: 7,             }}>               {d.client_name}               <span style={{                 fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999,                 background: C.border, color: C.mutedL,               }}>{notas ? "📝 " + notas : "ficha"}</span>             </button>           ) : (             <p style={{ color: C.text, fontWeight: 800, fontSize: 15, margin: 0 }}>{d.client_name}</p>           )}
          <p style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>
            {d.trade}{d.zone ? " · " + d.zone : ""}{d.city_name ? " · " + d.city_name : ""}
          </p>
        </div>
        <Reloj deal={d} />
      </div>

      {d.description && (
        <p style={{ color: C.mutedL, fontSize: 13, marginTop: 8, lineHeight: 1.45 }}>{d.description}</p>
      )}

      {ocultarTelefono ? (
        <p style={{ color: C.muted, fontSize: 11, marginTop: 8, fontStyle: "italic" }}>
          🔒 Verás el teléfono al aceptar
        </p>
      ) : (
        <a href={"tel:" + d.client_phone} style={{
          display: "inline-block", marginTop: 8, color: C.accent, fontSize: 14,
          fontWeight: 700, textDecoration: "none",
        }}>📞 {d.client_phone}</a>
      )}

      {d.price != null && (
        <p style={{ color: C.text, fontSize: 14, marginTop: 8, fontWeight: 700 }}>
          {eur(d.price)}
          <span style={{ color: C.muted, fontSize: 12, fontWeight: 500 }}> · comisión {eur(d.commission_committed)}</span>
          {d.scheduled_for && <span style={{ color: C.mutedL, fontSize: 12, fontWeight: 500 }}> · {fechaCorta(d.scheduled_for)}</span>}
        </p>
      )}
    </div>
  );
}

// ── MODALES ─────────────────────────────────────────────────
function ModalPrecio({ d, onClose, onSave }: any) {
  const [v, setV] = useState(d.price ? String(d.price) : "");
  const num = parseFloat(v.replace(",", "."));
  const ok = !isNaN(num) && num > 0;
  return (
    <Modal title="Precio acordado con el cliente" onClose={onClose}>
      <Campo label="Importe total del trabajo" value={v} onChange={setV} type="number" placeholder="400" sufijo="€" />
      {ok && (
        <p style={{ color: C.mutedL, fontSize: 13, marginBottom: 16 }}>
          Comisión de OficioYa: <b style={{ color: C.accent }}>{eur(num * 0.2)}</b> (20%, IVA incluido)
        </p>
      )}
      <Boton full disabled={!ok} onClick={() => onSave(num)}>Guardar precio</Boton>
    </Modal>
  );
}

function ModalFecha({ d, onClose, onSave }: any) {
  const [f, setF] = useState(d.scheduled_for || "");
  return (
    <Modal title="¿Qué día haces el trabajo?" onClose={onClose}>
      <Campo label="Fecha prevista" value={f} onChange={setF} type="date" />
      <Boton full disabled={!f} onClick={() => onSave(f)}>Guardar fecha</Boton>
    </Modal>
  );
}

function ModalCobro({ d, onClose, onSave }: any) {
  const restante = Number(d.price || 0) - Number(d.collected_amount || 0);
  const [v, setV] = useState(restante > 0 ? String(restante) : "");
  const [f, setF] = useState(new Date().toISOString().slice(0, 10));
  const num = parseFloat(v.replace(",", "."));
  const ok = !isNaN(num) && num > 0;
  return (
    <Modal title="¿Cuánto te ha pagado el cliente?" onClose={onClose}>
      <Campo label="Importe cobrado" value={v} onChange={setV} type="number" sufijo="€" />
      <Campo label="Fecha del cobro" value={f} onChange={setF} type="date" />
      {ok && (
        <p style={{ color: C.mutedL, fontSize: 13, marginBottom: 16 }}>
          Comisión que se genera: <b style={{ color: C.accent }}>{eur(num * 0.2)}</b>
          {num < restante && <span style={{ color: C.orange }}> · quedará pendiente {eur(restante - num)}</span>}
        </p>
      )}
      <Boton full color={C.green} disabled={!ok} onClick={() => onSave(num, f)}>Confirmar cobro</Boton>
    </Modal>
  );
}

function ModalImpago({ onClose, onSave }: any) {
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState("");
  return (
    <Modal title="El cliente no me ha pagado" onClose={onClose}>
      <p style={{ color: C.mutedL, fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
        No se genera comisión hasta que cobres. Dinos qué pasa para que no te reclamemos nada.
      </p>
      <p style={{ fontSize: 12, color: C.mutedL, marginBottom: 8, fontWeight: 700 }}>Motivo</p>
      <Radios options={UNPAID_REASONS} value={motivo} onChange={setMotivo} />
      <div style={{ height: 14 }} />
      <Campo label="¿Cuándo esperas cobrar? (opcional)" value={fecha} onChange={setFecha} type="date" />
      <Boton full color={C.red} disabled={!motivo} onClick={() => onSave(motivo, fecha)}>Enviar a OficioYa</Boton>
    </Modal>
  );
}

function ModalDevolver({ d, onClose, onSave }: any) {
  const [sinPrecio, setSinPrecio] = useState(!d.price);
  const [v, setV] = useState(d.price ? String(d.price) : "");
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const num = sinPrecio ? 0 : parseFloat(v.replace(",", "."));
  const precioOk = sinPrecio || (!isNaN(num) && num > 0);
  const lista = sinPrecio ? CLOSE_REASONS_SIN_PRECIO : CLOSE_REASONS_CON_PRECIO;
  const notaOk = motivo !== "otros" || nota.trim().length > 2;
  const ok = precioOk && !!motivo && notaOk;

  return (
    <Modal title="Devolver este trabajo a OficioYa" onClose={onClose}>
      <p style={{ fontSize: 12, color: C.mutedL, marginBottom: 8, fontWeight: 700 }}>1. ¿Qué precio le diste al cliente?</p>
      {!sinPrecio && <Campo label="" value={v} onChange={setV} type="number" placeholder="400" sufijo="€" />}
      <button onClick={() => { setSinPrecio(!sinPrecio); setMotivo(""); }} style={{
        display: "flex", alignItems: "center", gap: 9, background: "none", cursor: "pointer",
        border: "1px solid " + (sinPrecio ? C.accent : C.border), borderRadius: 9,
        padding: "10px 12px", width: "100%", marginBottom: 18, fontFamily: F,
        color: sinPrecio ? C.text : C.mutedL, fontSize: 13, fontWeight: 600,
      }}>
        <span style={{
          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
          border: "2px solid " + (sinPrecio ? C.accent : C.muted),
          background: sinPrecio ? C.accent : "transparent",
        }} />
        No llegué a dar precio (0 €)
      </button>

      <p style={{ fontSize: 12, color: C.mutedL, marginBottom: 8, fontWeight: 700 }}>2. ¿Por qué se cae?</p>
      <Radios options={lista} value={motivo} onChange={setMotivo} />

      {motivo === "otros" && (
        <div style={{ marginTop: 14 }}>
          <Campo label="Cuéntanos qué ha pasado" value={nota} onChange={setNota} placeholder="Escribe aquí…" />
        </div>
      )}

      <div style={{ height: 8 }} />
      <p style={{ color: C.muted, fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
        Al enviarlo dejarás de ver este trabajo. OficioYa decidirá si lo cierra o se lo pasa a otro profesional.
      </p>
      <Boton full color={C.red} disabled={!ok} onClick={() => onSave(num, motivo, nota)}>Devolver a OficioYa</Boton>
    </Modal>
  );
}

function ModalAparcar({ onClose, onSave }: any) {
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const notaOk = motivo !== "otros" || nota.trim().length > 2;
  const ok = !!hasta && !!motivo && notaOk;
  return (
    <Modal title="Pedir aparcar este trabajo" onClose={onClose}>
      <p style={{ fontSize: 12, color: C.mutedL, marginBottom: 8, fontWeight: 700 }}>1. ¿Hasta cuándo?</p>
      <Campo label="" value={hasta} onChange={setHasta} type="date" />
      <p style={{ fontSize: 12, color: C.mutedL, marginBottom: 8, fontWeight: 700 }}>2. ¿Por qué?</p>
      <Radios options={PAUSE_REASONS} value={motivo} onChange={setMotivo} />
      {motivo === "otros" && (
        <div style={{ marginTop: 14 }}>
          <Campo label="Cuéntanos por qué" value={nota} onChange={setNota} placeholder="Escribe aquí…" />
        </div>
      )}
      <div style={{ height: 8 }} />
      <p style={{ color: C.muted, fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
        OficioYa tiene que aprobarlo. Mientras tanto el trabajo sigue activo.
      </p>
      <Boton full disabled={!ok} onClick={() => onSave(hasta, motivo, nota)}>Enviar solicitud</Boton>
    </Modal>
  );
}

function ModalCorreccion({ d, onClose, onSave }: any) {
  const [v, setV] = useState(String(d.collected_amount || d.price || ""));
  const [nota, setNota] = useState("");
  const num = parseFloat(v.replace(",", "."));
  const ok = !isNaN(num) && num > 0 && nota.trim().length > 2;
  return (
    <Modal title="Solicitar corrección" onClose={onClose}>
      <p style={{ color: C.mutedL, fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
        Este trabajo ya está liquidado. Puedes pedir un cambio y OficioYa lo revisará.
      </p>
      <Campo label="Importe correcto" value={v} onChange={setV} type="number" sufijo="€" />
      <Campo label="¿Qué hay que corregir?" value={nota} onChange={setNota} placeholder="Escribe aquí…" />
      <Boton full disabled={!ok} onClick={() => onSave(num, nota)}>Enviar solicitud</Boton>
    </Modal>
  );
}
function ModalFichaTecnica({ d, notas, cargando, onClose, onAddNota }: any) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const ICONO: any = {
    nota: "📝", estado: "🔄", precio: "💶", cobro: "💰", creado: "🆕",
    asignacion: "👤", liquidado: "🔒", seguimiento: "👀", impago: "⚠️", solicitud_pausa: "⏸",
  };

  const enviar = async () => {
    setEnviando(true);
    const ok = await onAddNota(d.id, texto);
    if (ok) setTexto("");
    setEnviando(false);
  };

  const fechaLarga = (iso?: string | null) => {
    if (!iso) return "—";
    const f = new Date(iso);
    if (isNaN(f.getTime())) return "—";
    return f.toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Modal title={d.client_name} onClose={onClose}>
      <div style={{ background: C.bg, border: "1px solid " + C.border, borderRadius: 10, padding: "4px 12px", marginBottom: 16 }}>
        <Fila k="Referencia" v={"#" + d.ref} />
        <Fila k="Estado" v={d.stage} />
        <Fila k="Teléfono" v={d.client_phone || "—"} />
        <Fila k="Oficio" v={d.trade || "—"} />
        <Fila k="Zona" v={[d.zone, d.city_name].filter(Boolean).join(" · ") || "—"} />
        {d.price != null && <Fila k="Precio" v={eur(d.price)} />}
        {d.price != null && <Fila k="Comisión" v={eur(d.commission_committed)} destacado />}
        {Number(d.collected_amount) > 0 && <Fila k="Cobrado del cliente" v={eur(d.collected_amount)} />}
        <Fila k="Entró el" v={fechaLarga(d.created_at)} />
        {d.scheduled_for && <Fila k="Programado" v={fechaCorta(d.scheduled_for)} />}
        {d.completed_at && <Fila k="Terminado" v={fechaLarga(d.completed_at)} />}
        {d.collected_at && <Fila k="Cobrado" v={fechaLarga(d.collected_at)} />}
        {d.settled_at && <Fila k="Liquidado" v={fechaLarga(d.settled_at)} />}
        {d.close_reason && <Fila k="Motivo de cierre" v={labelDe([...CLOSE_REASONS_CON_PRECIO, ...CLOSE_REASONS_SIN_PRECIO], d.close_reason)} />}
      </div>

      {d.description && (
        <p style={{ color: C.mutedL, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>{d.description}</p>
      )}

      <p style={{ fontSize: 11, color: C.mutedL, fontWeight: 800, letterSpacing: "0.07em", marginBottom: 10 }}>AÑADIR NOTA</p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Lo que quieras dejar apuntado…"
        rows={3}
        style={{
          width: "100%", padding: "11px 12px", background: C.bg, border: "1px solid " + C.border,
          borderRadius: 9, color: C.text, fontSize: 14, fontFamily: F, outline: "none",
          resize: "vertical" as const, marginBottom: 10, boxSizing: "border-box" as const,
        }}
      />
      <Boton full disabled={!texto.trim() || enviando} onClick={enviar}>
        {enviando ? "Guardando…" : "Guardar nota"}
      </Boton>

      <p style={{ fontSize: 11, color: C.mutedL, fontWeight: 800, letterSpacing: "0.07em", margin: "22px 0 10px" }}>HISTORIAL</p>
      {cargando && <p style={{ color: C.muted, fontSize: 13 }}>Cargando…</p>}
      {!cargando && notas.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>Todavía no hay nada apuntado.</p>}
      {notas.map((n: any) => (
        <div key={n.id} style={{
          display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid " + C.border,
        }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>{ICONO[n.event] || "•"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              color: n.event === "nota" ? C.text : C.mutedL,
              fontSize: 13, margin: 0, lineHeight: 1.45,
              fontWeight: n.event === "nota" ? 600 : 400,
            }}>{n.detail}</p>
            <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
              {fechaLarga(n.created_at)}{n.actor_name ? " · " + n.actor_name : n.actor_role === "sistema" ? " · sistema" : ""}
            </p>
          </div>
        </div>
      ))}
      <div style={{ height: 10 }} />
    </Modal>
  );
}
