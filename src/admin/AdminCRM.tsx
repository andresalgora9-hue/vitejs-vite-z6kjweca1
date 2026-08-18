// ============================================================
// OficioYa · Panel ADMIN — CRM de comisión
// Archivo independiente. No toca el resto de Admin.tsx.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { db } from "../supabase";
import {
  DealRow as DealBase, DealRequestRow, Stage, STAGE_LABEL,
  CLOSE_REASONS_SIN_PRECIO, CLOSE_REASONS_CON_PRECIO, PAUSE_REASONS, UNPAID_REASONS,
  labelDe, eur, fechaCorta, tiempoRestante,
} from "../shared/crm";

type DealRow = DealBase & {
  expected_payment_date?: string | null;
  last_contact_at?: string | null;
  last_contact_note?: string | null;
  next_followup_at?: string | null;
};

const C = {
  bg: "#0B0D12", card: "#12151E", card2: "#1A1F2E", border: "#222839",
  accent: "#FFD700", orange: "#FF8C00", red: "#FF4455", green: "#00D68F",
  blue: "#3B82F6", purple: "#8B5CF6",
  text: "#E8EDF5", muted: "#5A6A8A", mutedL: "#8899BB",
};
const F = "'DM Sans',sans-serif";

const MOTIVOS_DESCARTE = [
  { id: "no_cualifica", label: "No cualifica" },
  { id: "cliente_no_contesta", label: "El cliente no contesta" },
  { id: "sin_pro_disponible", label: "Sin profesional disponible" },
  { id: "presupuesto_rechazado", label: "Presupuesto rechazado" },
  { id: "cliente_cancela", label: "El cliente cancela" },
  { id: "fuera_de_zona", label: "Fuera de zona" },
  { id: "duplicado", label: "Duplicado" },
];

const TRADES = [
  "Fontanero", "Electricista", "Pintor", "Cerrajero", "Albañil", "Carpintero",
  "Climatización", "Reformas Integrales", "Desatascos y Camión Cuba", "Técnico de Gas",
  "Yesero", "Cristalero", "Techador", "Montador de Pladur", "Soldador",
  "Parquetista / Pulidor de Suelos", "Instalador Solar", "Jardinero", "Mudanzas", "Limpieza",
];

const ORIGENES = ["llamada", "whatsapp", "app", "google_ads", "meta", "referido", "otro"];

// ── PIEZAS ──────────────────────────────────────────────────
function Caja({ children, style = {}, borde }: any) {
  return <div style={{ background: C.card, border: "1px solid " + (borde || C.border), borderRadius: 10, padding: 14, marginBottom: 10, ...style }}>{children}</div>;
}

function Bt({ children, onClick, color = C.accent, ghost = false, small = false, disabled = false, full = false }: any) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      padding: small ? "6px 10px" : "9px 14px",
      background: disabled ? C.border : ghost ? "transparent" : color,
      border: ghost ? "1px solid " + color : "none", borderRadius: 8,
      color: disabled ? C.muted : ghost ? color : (color === C.accent || color === C.green ? "#000" : "#fff"),
      fontFamily: F, fontSize: small ? 11 : 12, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", width: full ? "100%" : undefined,
    }}>{children}</button>
  );
}

function Modal({ title, children, onClose, ancho = 520 }: any) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 40000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, width: "100%", maxWidth: ancho, maxHeight: "90vh", overflowY: "auto", padding: 20, border: "1px solid " + C.border }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ color: C.text, fontSize: 16, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function In({ label, value, onChange, type = "text", ph = "", req }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, color: C.mutedL, marginBottom: 5, fontWeight: 600 }}>
        {label}{req && <span style={{ color: C.orange }}> *</span>}
      </label>
      <input type={type} value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "9px 11px", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontSize: 14, fontFamily: F, outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

function Sel({ label, value, onChange, options, req }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, color: C.mutedL, marginBottom: 5, fontWeight: 600 }}>
        {label}{req && <span style={{ color: C.orange }}> *</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "9px 11px", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontSize: 14, fontFamily: F, outline: "none", boxSizing: "border-box" }}>
        <option value="">— elegir —</option>
        {options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function Kpi({ label, valor, color }: any) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 12px", flex: 1, minWidth: 130 }}>
      <p style={{ fontSize: 22, fontWeight: 900, color, margin: 0 }}>{valor}</p>
      <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{label}</p>
    </div>
  );
}

function Etiqueta({ texto, color }: any) {
  return <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 7px", borderRadius: 4, background: color + "22", color }}>{texto}</span>;
}

const colorEstado = (s: Stage) =>
  s === "entrada" ? C.orange : s === "cerrado" ? C.muted :
  s === "liquidado" ? C.green : s === "cobrado_cliente" || s === "facturado" ? C.blue :
  s === "en_espera" ? C.purple : C.accent;

// ── PRINCIPAL ───────────────────────────────────────────────
export default function AdminCRM({ sub, rol = "admin", ciudadesGestor }: { sub: string; rol?: "admin" | "gestor"; ciudadesGestor?: string[] | null }) {
  const esAdmin = rol === "admin";
  const verDinero = true; // Sandra sí ve la comisión: su función es cobrarla
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [pros, setPros] = useState<any[]>([]);
  const [reqs, setReqs] = useState<DealRequestRow[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ciudadF, setCiudadF] = useState("");
  const [rango, setRango] = useState<"7d"|"30d"|"mes"|"todo"|"custom">("30d");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [mNuevo, setMNuevo] = useState(false);
  const [mAsignar, setMAsignar] = useState<DealRow | null>(null);
  const [mDescartar, setMDescartar] = useState<DealRow | null>(null);
  const [mPago, setMPago] = useState<DealRow | null>(null);
  const [mFicha, setMFicha] = useState<DealRow | null>(null);
  const [colDrop, setColDrop] = useState<string | null>(null);
  const [mPidePrecio, setMPidePrecio] = useState<{ d: DealRow; destino: Stage } | null>(null);
  const [mPideCobro, setMPideCobro] = useState<DealRow | null>(null);
  const [mGestion, setMGestion] = useState<DealRow | null>(null);
  const [mSeguimiento, setMSeguimiento] = useState<DealRow | null>(null);
  const [mNota, setMNota] = useState<DealRow | null>(null);

  const aviso = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const cargar = useCallback(async () => {
    const [d, c, u, r, p] = await Promise.all([
      db.from("deals").select("*").order("created_at", { ascending: false }),
      db.from("cities").select("*").order("name"),
      db.from("users").select("id,name,trade,zone,phone,available").eq("type", "profesional"),
      db.from("deal_requests").select("*").eq("status", "pendiente").order("created_at", { ascending: false }),
      db.from("commission_payments").select("*"),
    ]);
    setDeals((d.data as DealRow[]) || []);
    const todas = c.data || [];
    setCities(ciudadesGestor && ciudadesGestor.length ? todas.filter((x: any) => ciudadesGestor.includes(x.name)) : todas);
    setPros(u.data || []);
    setReqs((r.data as DealRequestRow[]) || []);
    setPagos(p.data || []);
    setCargando(false);
  }, [ciudadesGestor]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const ch = db.channel("admin-crm")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => cargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_requests" }, () => cargar())
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [cargar]);

  const guardar = async (id: string, cambios: any, msg?: string) => {
    const { error } = await db.from("deals").update(cambios).eq("id", id);
    if (error) { aviso("Error: " + error.message); return; }
    await cargar();
    if (msg) aviso(msg);
  };

  const evt = async (dealId: string, event: string, detail: string) => {
    await db.from("deal_events").insert({ deal_id: dealId, actor_role: "admin", actor_name: "Andrés", event, detail });
  };

  // ── FILTRO CIUDAD ──
  const idsPermitidos = cities.map((c) => c.id);
  const filtra = (ds: DealRow[]) => {
    let r = ds;
    if (ciudadesGestor && ciudadesGestor.length) r = r.filter((d) => !d.city_id || idsPermitidos.includes(d.city_id));
    return ciudadF ? r.filter((d) => d.city_id === ciudadF) : r;
  };

  // ── FILTRO FECHA ──
  const limites = () => {
    const hoy = new Date();
    if (rango === "custom") return { a: desde ? new Date(desde + "T00:00:00") : null, b: hasta ? new Date(hasta + "T23:59:59") : null };
    if (rango === "todo") return { a: null, b: null };
    if (rango === "mes") return { a: new Date(hoy.getFullYear(), hoy.getMonth(), 1), b: null };
    const dias = rango === "7d" ? 7 : 30;
    return { a: new Date(Date.now() - dias * 86400000), b: null };
  };
  const enRango = (ds: DealRow[]) => {
    const { a, b } = limites();
    if (!a && !b) return ds;
    return ds.filter((d) => {
      const t = new Date(d.created_at).getTime();
      if (a && t < a.getTime()) return false;
      if (b && t > b.getTime()) return false;
      return true;
    });
  };
  const periodo = enRango(filtra(deals));

  // ── LISTAS ──
  const bandeja = filtra(deals.filter((d) => d.stage === "entrada" || d.returned_to_admin));
  const abiertos = filtra(deals.filter((d) => !["cerrado", "liquidado"].includes(d.stage) && !d.returned_to_admin));
  const paraCobrar = filtra(deals.filter((d) => Number(d.commission_due) > 0 && !d.settled_at));
  const sinCiudad = deals.filter((d) => !d.city_id && d.stage !== "cerrado");

  const pagadoDe = (proId?: string | null) => pagos.filter((p) => p.pro_id === proId).reduce((a, p) => a + Number(p.amount || 0), 0);
  const pagadoDeal = (dealId: string) => pagos.filter((p) => p.deal_id === dealId).reduce((a, p) => a + Number(p.amount || 0), 0);

  // ── ACCIONES ──
  const cualificar = (d: DealRow) => guardar(d.id, { stage: "cualificado" }, "Cualificado");

  // Mover un trabajo de columna. Pide los datos que falten en vez de dejar huecos.
  const moverDeal = async (d: DealRow, destino: Stage) => {
    if (d.stage === destino) return;
    if (destino === "asignado" && !d.pro_id) { setMAsignar(d); return; }
    if (["precio_acordado", "programado"].includes(destino) && !Number(d.price)) { setMPidePrecio({ d, destino }); return; }
    if (destino === "cobrado_cliente" && !Number(d.collected_amount)) { setMPideCobro(d); return; }

    // Obligaciones: no se avanza de etapa sin los datos que esa etapa significa
    if (destino === "cualificado" && (!d.city_id || !d.client_phone || d.client_phone === "—")) { setMFicha(d); aviso("Falta ciudad o teléfono"); return; }
    if (destino === "programado" && !d.scheduled_for) { setMPidePrecio({ d, destino }); return; }
    if (destino === "en_espera" && !d.pause_until) { setMSeguimiento(d); aviso("Pon hasta cuándo se aparca"); return; }

    const cambios: any = { stage: destino };
    if (destino === "aceptado" && !d.accepted_at) cambios.accepted_at = new Date().toISOString();
    if (destino === "completado" && !d.completed_at) cambios.completed_at = new Date().toISOString();
    if (destino === "en_espera") cambios.stage_before_pause = d.stage;
    if (destino === "entrada" || destino === "cualificado") { cambios.deadline_at = null; }
    await guardar(d.id, cambios, STAGE_LABEL[destino]);
  };

  const asignar = async (d: DealRow, pro: any) => {
    await guardar(d.id, {
      stage: "asignado", pro_id: pro.id, pro_name: pro.name,
      assigned_at: new Date().toISOString(),
      deadline_at: new Date(Date.now() + 30 * 60000).toISOString(),
      returned_to_admin: false, close_reason: null, closed_at: null,
    }, "Asignado a " + pro.name);
    try {
      await db.from("messages").insert({
        from_id: "00000000-0000-0000-0000-000000000001",
        to_id: pro.id,
        text: `🔴 *TRABAJO ASIGNADO*|DEAL_ID:${d.id}|${d.client_name} · ${d.trade} · ${d.city_name || ""}${d.zone ? " (" + d.zone + ")" : ""}\n📝 ${d.description || ""}\n📞 ${d.client_phone}\n\nTienes 30 minutos para aceptarlo.`,
        read: false, is_lead_alert: true,
      });
      await fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/send-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: pro.id,
          title: "🔴 Trabajo asignado · " + d.trade,
          body: d.client_name + " · " + (d.city_name || "") + (d.zone ? " (" + d.zone + ")" : ""),
          url: "/",
        }),
      });
    } catch (e) { /* si falla el aviso, la asignación ya está guardada */ }
    setMAsignar(null);
  };

  const descartar = async (d: DealRow, motivo: string, nota: string) => {
    await guardar(d.id, {
      stage: "cerrado", close_reason: motivo, close_note: nota || null,
      returned_to_admin: false, deadline_at: null,
    }, "Descartado");
    await evt(d.id, "descartado", labelDe(MOTIVOS_DESCARTE, motivo));
    setMDescartar(null);
  };

  const registrarPago = async (d: DealRow, importe: number, fecha: string, ref: string) => {
    await db.from("commission_payments").insert({
      pro_id: d.pro_id, deal_id: d.id, amount: importe, paid_at: fecha, reference: ref || null,
    });
    const yaPagado = pagos.filter((p) => p.deal_id === d.id).reduce((a, p) => a + Number(p.amount || 0), 0) + importe;
    if (yaPagado >= Number(d.commission_due)) {
      await guardar(d.id, { stage: "liquidado", settled_at: new Date().toISOString() }, "Liquidado ✓");
    } else {
      await cargar(); aviso("Cobro parcial registrado");
    }
    setMPago(null);
  };

  const resolverSolicitud = async (r: DealRequestRow, aprobar: boolean) => {
    await db.from("deal_requests").update({ status: aprobar ? "aprobada" : "rechazada", resolved_at: new Date().toISOString() }).eq("id", r.id);
    if (aprobar && r.kind === "pausa") {
      const d = deals.find((x) => x.id === r.deal_id);
      await guardar(r.deal_id, {
        stage: "en_espera", stage_before_pause: d?.stage,
        pause_until: r.requested_until, pause_reason: r.reason, pause_note: r.note,
      }, "Aparcado hasta " + fechaCorta(r.requested_until));
    } else {
      await cargar(); aviso(aprobar ? "Aprobada" : "Rechazada");
    }
  };

  if (cargando) return <div style={{ padding: 50, textAlign: "center", color: C.muted }}>Cargando CRM…</div>;

  const barraFechas = (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {([["7d","7 días"],["30d","30 días"],["mes","Este mes"],["todo","Todo"],["custom","Fechas"]] as const).map(([id, l]) => (
        <button key={id} onClick={() => setRango(id as any)} style={{
          padding: "6px 11px", borderRadius: 7, cursor: "pointer", fontFamily: F, fontSize: 11, fontWeight: 700,
          border: "1px solid " + (rango === id ? C.accent : C.border),
          background: rango === id ? C.accent + "18" : "transparent",
          color: rango === id ? C.accent : C.muted,
        }}>{l}</button>
      ))}
      {rango === "custom" && (
        <>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            style={{ padding: "5px 8px", background: C.card, border: "1px solid " + C.border, borderRadius: 7, color: C.text, fontSize: 11, fontFamily: F }} />
          <span style={{ color: C.muted, fontSize: 11 }}>a</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            style={{ padding: "5px 8px", background: C.card, border: "1px solid " + C.border, borderRadius: 7, color: C.text, fontSize: 11, fontFamily: F }} />
        </>
      )}
    </div>
  );

  const selCiudad = (
    <select value={ciudadF} onChange={(e) => setCiudadF(e.target.value)}
      style={{ padding: "7px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontSize: 12, fontFamily: F }}>
      <option value="">Todas las ciudades</option>
      {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );

  return (
    <div style={{ fontFamily: F }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 50000, background: C.card2, border: "1px solid " + C.accent, borderRadius: 9, padding: "11px 16px", color: C.text, fontSize: 13, fontWeight: 600 }}>{toast}</div>
      )}

      {/* ══ RESUMEN ══ */}
      {sub === "resumen" && (() => {
        const leads = periodo.length;
        const asign = periodo.filter((d) => d.assigned_at).length;
        const conPrecio = periodo.filter((d) => Number(d.price) > 0).length;
        // Comprometida = precio acordado pero el pro AÚN NO ha cobrado del cliente
        const comprometida = periodo
          .filter((d) => ["precio_acordado", "programado", "completado"].includes(d.stage))
          .reduce((a, d) => a + Number(d.commission_committed || 0), 0);
        // Generada = el pro ya cobró del cliente, la comisión existe
        const devengada = periodo.reduce((a, d) => a + Number(d.commission_due || 0), 0);
        // Cobrada = dinero que ya está en la cuenta de OficioYa
        const cobrada = periodo.reduce((a, d) => a + pagadoDeal(d.id), 0);
        const porCobrar = Math.max(0, devengada - cobrada);
        const perdidos = periodo.filter((d) => d.stage === "cerrado").length;
        const conv = leads ? Math.round((conPrecio / leads) * 100) : 0;
        const ticket = conPrecio ? periodo.filter((d) => Number(d.price) > 0).reduce((a, d) => a + Number(d.price), 0) / conPrecio : 0;

        const porGrupo = (key: (d: DealRow) => string) => {
          const m: Record<string, { n: number; comp: number; dev: number; cob: number; cerr: number }> = {};
          periodo.forEach((d) => {
            const k = key(d) || "—";
            if (!m[k]) m[k] = { n: 0, comp: 0, dev: 0, cob: 0, cerr: 0 };
            m[k].n++;
            if (["precio_acordado", "programado", "completado"].includes(d.stage)) m[k].comp += Number(d.commission_committed || 0);
            m[k].dev += Number(d.commission_due || 0);
            m[k].cob += pagadoDeal(d.id);
            if (Number(d.price) > 0) m[k].cerr++;
          });
          return Object.entries(m).sort((a, b) => (b[1].dev + b[1].comp) - (a[1].dev + a[1].comp));
        };

        const tabla = (titulo: string, filas: [string, any][]) => (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: C.mutedL, fontWeight: 800, letterSpacing: "0.07em", marginBottom: 8 }}>{titulo}</p>
            <Caja style={{ padding: 0 }}>
              <div style={{ display: "flex", padding: "9px 14px", borderBottom: "1px solid " + C.border }}>
                <span style={{ flex: 2, color: C.muted, fontSize: 10, fontWeight: 700 }}>NOMBRE</span>
                <span style={{ flex: 1, color: C.muted, fontSize: 10, fontWeight: 700, textAlign: "right" }}>LEADS</span>
                <span style={{ flex: 1, color: C.muted, fontSize: 10, fontWeight: 700, textAlign: "right" }}>CERRADOS</span>
                <span style={{ flex: 1, color: C.muted, fontSize: 10, fontWeight: 700, textAlign: "right" }}>COMPROMET.</span>
                <span style={{ flex: 1, color: C.muted, fontSize: 10, fontWeight: 700, textAlign: "right" }}>GENERADA</span>
                <span style={{ flex: 1, color: C.muted, fontSize: 10, fontWeight: 700, textAlign: "right" }}>TE DEBEN</span>
              </div>
              {filas.length === 0 && <p style={{ color: C.muted, fontSize: 12, padding: 14, margin: 0 }}>Sin datos en este periodo.</p>}
              {filas.map(([k, v]) => (
                <div key={k} style={{ display: "flex", padding: "9px 14px", borderBottom: "1px solid " + C.border }}>
                  <span style={{ flex: 2, color: C.text, fontSize: 12, fontWeight: 600 }}>{k}</span>
                  <span style={{ flex: 1, color: C.mutedL, fontSize: 12, textAlign: "right" }}>{v.n}</span>
                  <span style={{ flex: 1, color: C.mutedL, fontSize: 12, textAlign: "right" }}>{v.cerr} ({v.n ? Math.round((v.cerr / v.n) * 100) : 0}%)</span>
                  <span style={{ flex: 1, color: C.orange, fontSize: 12, textAlign: "right" }}>{eur(v.comp)}</span>
                  <span style={{ flex: 1, color: C.blue, fontSize: 12, textAlign: "right" }}>{eur(v.dev)}</span>
                  <span style={{ flex: 1, color: C.accent, fontSize: 12, textAlign: "right", fontWeight: 700 }}>{eur(Math.max(0, v.dev - v.cob))}</span>
                </div>
              ))}
            </Caja>
          </div>
        );

        return (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              {barraFechas}{selCiudad}
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <Kpi label="Leads entrados" valor={leads} color={C.text} />
              <Kpi label="Asignados" valor={asign} color={C.blue} />
              <Kpi label="Cerrados con precio" valor={conPrecio} color={C.green} />
              <Kpi label="Perdidos" valor={perdidos} color={C.red} />
              <Kpi label="Conversión" valor={conv + "%"} color={C.purple} />
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <Kpi label="Comprometida · sin cobrar aún" valor={eur(comprometida)} color={C.orange} />
              <Kpi label="Generada · el pro ya cobró" valor={eur(devengada)} color={C.blue} />
              <Kpi label="Cobrada · en tu cuenta" valor={eur(cobrada)} color={C.green} />
              <Kpi label="Te deben ahora mismo" valor={eur(porCobrar)} color={C.accent} />
            </div>
            <p style={{ color: C.muted, fontSize: 11, marginTop: -12, marginBottom: 18 }}>
              Ticket medio {eur(ticket)} · la comisión solo nace cuando el profesional cobra del cliente
            </p>
            {tabla("POR CIUDAD", porGrupo((d) => d.city_name || ""))}
            {tabla("POR OFICIO", porGrupo((d) => d.trade))}
            {tabla("POR PROFESIONAL", porGrupo((d) => d.pro_name || "sin asignar"))}
            {tabla("POR ORIGEN", porGrupo((d) => d.source))}
          </>
        );
      })()}

      {/* ══ BANDEJA ══ */}
      {sub === "bandeja" && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <Bt onClick={() => setMNuevo(true)} color={C.accent}>+ Nuevo lead</Bt>
            {selCiudad}
            <span style={{ color: C.muted, fontSize: 12 }}>{bandeja.length} en bandeja</span>
          </div>

          {sinCiudad.length > 0 && (
            <Caja borde={C.orange + "55"} style={{ background: C.orange + "0E" }}>
              <p style={{ color: C.orange, fontSize: 12, fontWeight: 700, margin: 0 }}>
                ⚠ {sinCiudad.length} lead{sinCiudad.length > 1 ? "s" : ""} sin ciudad detectada — ponla al cualificar
              </p>
            </Caja>
          )}

          {bandeja.length === 0 && <Caja style={{ textAlign: "center", padding: 30 }}><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Bandeja vacía. Todo asignado.</p></Caja>}

          {bandeja.map((d) => {
            const devuelto = d.returned_to_admin;
            const conPrecio = devuelto && Number(d.close_price) > 0;
            return (
              <Caja key={d.id} borde={conPrecio ? C.red + "66" : devuelto ? C.orange + "55" : C.border}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                      <span style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{d.client_name}</span>
                      <span style={{ color: C.muted, fontSize: 12 }}>#{d.ref}</span>
                      {devuelto && <Etiqueta texto={conPrecio ? "DEVUELTO CON PRECIO" : "DEVUELTO"} color={conPrecio ? C.red : C.orange} />}
                      {!d.city_id && <Etiqueta texto="SIN CIUDAD" color={C.orange} />}
                      {d.urgency === 2 && <Etiqueta texto="URGENTE" color={C.red} />}
                    </div>
                    <p style={{ color: C.mutedL, fontSize: 12, margin: 0 }}>
                      {d.trade} · {d.city_name || "—"}{d.zone ? " · " + d.zone : ""} · 📞 {d.client_phone}
                    </p>
                    {d.description && <p style={{ color: C.mutedL, fontSize: 13, marginTop: 6 }}>{d.description}</p>}
                    {devuelto && (
                      <p style={{ color: conPrecio ? C.red : C.orange, fontSize: 12, marginTop: 7, fontWeight: 700 }}>
                        {d.pro_name} dio {eur(d.close_price)} → "{labelDe([...CLOSE_REASONS_CON_PRECIO, ...CLOSE_REASONS_SIN_PRECIO], d.close_reason)}"
                        {d.close_note ? " — " + d.close_note : ""}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Bt small onClick={() => setMAsignar(d)} color={C.accent}>Asignar →</Bt>
                    <Bt small ghost color={C.red} onClick={() => setMDescartar(d)}>Descartar</Bt>
                  </div>
                </div>
              </Caja>
            );
          })}
        </>
      )}

      {/* ══ TABLERO KANBAN ══ */}
      {sub === "tablero" && (() => {
        const COLS: Stage[] = ["entrada","cualificado","asignado","aceptado","presupuestando","precio_acordado","programado","completado","cobrado_cliente","en_espera"];
        return (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              {selCiudad}
              <span style={{ color: C.muted, fontSize: 12 }}>{abiertos.length} trabajos abiertos</span>
              <span style={{ color: C.muted, fontSize: 11 }}>· arrastra las tarjetas entre columnas</span>
            </div>

            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
              {(() => {
                const hoy = new Date().toISOString().slice(0, 10);
                const paraHoy = abiertos.filter((d) => d.next_followup_at && d.next_followup_at <= hoy);
                const sinNada = abiertos.filter((d) => !d.next_followup_at && !["completado","cobrado_cliente"].includes(d.stage));
                const lista = [...paraHoy, ...sinNada];
                return (
                  <div style={{ minWidth: 250, maxWidth: 250, flexShrink: 0, background: C.orange + "0C", border: "1px solid " + C.orange + "55", borderRadius: 10, padding: 9, minHeight: 130 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9, paddingBottom: 7, borderBottom: "2px solid " + C.orange + "55" }}>
                      <span style={{ color: C.orange, fontSize: 11, fontWeight: 800, textTransform: "uppercase" as const }}>📞 Para hoy</span>
                      <span style={{ color: C.muted, fontSize: 11, fontWeight: 700 }}>{lista.length}</span>
                    </div>
                    {lista.length === 0 && <p style={{ color: C.border, fontSize: 11, textAlign: "center", padding: "14px 0", margin: 0 }}>Todo al día ✓</p>}
                    {lista.map((d) => {
                      const vencido = !!d.next_followup_at && d.next_followup_at < hoy;
                      return (
                        <div key={d.id} onClick={() => setMSeguimiento(d)}
                          style={{ background: C.card, border: "1px solid " + (vencido ? C.red + "66" : C.border), borderLeft: "3px solid " + C.orange, borderRadius: 8, padding: "9px 10px", marginBottom: 7, cursor: "pointer" }}>
                          <p style={{ color: C.text, fontWeight: 700, fontSize: 12.5, margin: 0 }}>{d.client_name}</p>
                          <p style={{ color: C.muted, fontSize: 10.5, margin: "3px 0 0" }}>{STAGE_LABEL[d.stage]}{d.pro_name ? " · " + d.pro_name : ""}</p>
                          {d.last_contact_note && <p style={{ color: C.mutedL, fontSize: 10.5, margin: "5px 0 0", fontStyle: "italic" }}>"{d.last_contact_note.substring(0, 60)}"</p>}
                          <div style={{ marginTop: 6 }}>
                            <Etiqueta texto={d.next_followup_at ? (vencido ? "⚠ tocaba " + fechaCorta(d.next_followup_at) : "hoy") : "sin próximo paso"} color={vencido ? C.red : C.orange} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {COLS.map((st) => {
                const lista = abiertos.filter((d) => d.stage === st);
                const suma = lista.reduce((a, d) => a + Number(d.commission_committed || 0), 0);
                const col = colorEstado(st);
                return (
                  <div key={st}
                    onDragOver={(e) => { e.preventDefault(); setColDrop(st); }}
                    onDragLeave={() => setColDrop(null)}
                    onDrop={(e) => { e.preventDefault(); setColDrop(null); const id = e.dataTransfer.getData("text/plain"); const d = deals.find((x) => x.id === id); if (d) moverDeal(d, st); }}
                    style={{
                      minWidth: 250, maxWidth: 250, flexShrink: 0,
                      background: colDrop === st ? col + "12" : C.bg,
                      border: "1px solid " + (colDrop === st ? col : C.border),
                      borderRadius: 10, padding: 9, minHeight: 130,
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9, paddingBottom: 7, borderBottom: "2px solid " + col + "55" }}>
                      <span style={{ color: col, fontSize: 11, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                        {STAGE_LABEL[st]}
                      </span>
                      <span style={{ color: C.muted, fontSize: 11, fontWeight: 700 }}>{lista.length}</span>
                    </div>
                    {suma > 0 && (
                      <p style={{ color: C.accent, fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>{eur(suma)}</p>
                    )}
                    {lista.length === 0 && (
                      <p style={{ color: C.border, fontSize: 11, textAlign: "center", padding: "14px 0", margin: 0 }}>—</p>
                    )}
                    {lista.map((d) => {
                      const t = tiempoRestante(d.deadline_at);
                      const rojo = t.vencido && !!d.deadline_at;
                      return (
                        <div key={d.id} draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", d.id)}
                          onClick={() => setMFicha(d)}
                          style={{
                            background: C.card, border: "1px solid " + (rojo ? C.red + "66" : C.border),
                            borderLeft: "3px solid " + (rojo ? C.red : col),
                            borderRadius: 8, padding: "9px 10px", marginBottom: 7, cursor: "grab",
                          }}>
                          <p style={{ color: C.text, fontWeight: 700, fontSize: 12.5, margin: 0 }}>{d.client_name}</p>
                          <p style={{ color: C.muted, fontSize: 10.5, margin: "3px 0 0" }}>
                            {d.trade}{d.zone ? " · " + d.zone : ""}
                          </p>
                          {d.pro_name && (
                            <p style={{ color: C.blue, fontSize: 10.5, margin: "4px 0 0", fontWeight: 600 }}>🔨 {d.pro_name}</p>
                          )}
                          {d.price ? (
                            <p style={{ color: C.accent, fontSize: 11.5, margin: "5px 0 0", fontWeight: 700 }}>
                              {eur(d.price)} <span style={{ color: C.muted, fontWeight: 500 }}>→ {eur(d.commission_committed)}</span>
                            </p>
                          ) : null}
                          <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                            {d.deadline_at && <Etiqueta texto={t.vencido ? "⚠ " + t.texto : t.texto} color={rojo ? C.red : C.mutedL} />}
                            {d.urgency === 2 && <Etiqueta texto="URGENTE" color={C.red} />}
                            {!d.city_id && <Etiqueta texto="SIN CIUDAD" color={C.orange} />}
                            {d.pause_until && <Etiqueta texto={"💤 " + fechaCorta(d.pause_until)} color={C.purple} />}
                            {d.next_followup_at && <Etiqueta texto={"📞 " + fechaCorta(d.next_followup_at)} color={C.blue} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* ══ COBROS ══ */}
      {sub === "cobros" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <Kpi label="Comisión devengada" valor={eur(paraCobrar.reduce((a, d) => a + Number(d.commission_due), 0))} color={C.accent} />
            <Kpi label="Ya liquidado" valor={eur(pagos.reduce((a, p) => a + Number(p.amount || 0), 0))} color={C.green} />
            <Kpi label="Trabajos por cobrar" valor={paraCobrar.length} color={C.blue} />
          </div>
          <div style={{ marginBottom: 14 }}>{selCiudad}</div>

          {paraCobrar.length === 0 && <Caja style={{ textAlign: "center", padding: 30 }}><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Nada pendiente de cobro.</p></Caja>}

          {(() => {
            const conFecha = paraCobrar.filter((d) => d.expected_payment_date);
            const sinFecha = paraCobrar.filter((d) => !d.expected_payment_date);
            const totalPrev = conFecha.reduce((a, d) => a + Number(d.commission_due), 0);
            const totalSin = sinFecha.reduce((a, d) => a + Number(d.commission_due), 0);
            return (
              <Caja borde={C.blue + "44"} style={{ background: C.blue + "0A" }}>
                <p style={{ fontSize: 11, color: C.blue, fontWeight: 800, marginBottom: 9 }}>PREVISIÓN DE INGRESOS</p>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <span style={{ color: C.mutedL, fontSize: 12 }}>Con fecha prevista: <b style={{ color: C.green }}>{eur(totalPrev)}</b> ({conFecha.length})</span>
                  <span style={{ color: C.mutedL, fontSize: 12 }}>Sin fecha — hay que llamar: <b style={{ color: C.orange }}>{eur(totalSin)}</b> ({sinFecha.length})</span>
                </div>
              </Caja>
            );
          })()}

          {[...paraCobrar].sort((a, b) => {
            const fa = a.expected_payment_date || "9999";
            const fb = b.expected_payment_date || "9999";
            return fa.localeCompare(fb);
          }).map((d) => {
            const dias = d.collected_at ? Math.floor((Date.now() - new Date(d.collected_at).getTime()) / 86400000) : 0;
            const prevPasada = d.expected_payment_date && new Date(d.expected_payment_date) < new Date();
            return (
              <Caja key={d.id} borde={dias > 21 || prevPasada ? C.red + "55" : C.border}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{d.pro_name}</span>
                    <span style={{ color: C.muted, fontSize: 12 }}> · {d.client_name} · {d.trade}{d.city_name ? " · " + d.city_name : ""}</span>
                    <p style={{ color: C.mutedL, fontSize: 12, margin: "5px 0 0" }}>
                      Cobró {eur(d.collected_amount)} el {fechaCorta(d.collected_at)}
                      {dias > 0 && <span style={{ color: dias > 21 ? C.red : C.muted }}> · hace {dias} días</span>}
                    </p>
                    <div style={{ display: "flex", gap: 7, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {d.expected_payment_date
                        ? <Etiqueta texto={"📅 previsto " + fechaCorta(d.expected_payment_date)} color={prevPasada ? C.red : C.green} />
                        : <Etiqueta texto="SIN FECHA PREVISTA" color={C.orange} />}
                      {d.last_contact_at && <span style={{ color: C.muted, fontSize: 11 }}>última gestión {fechaCorta(d.last_contact_at)}</span>}
                    </div>
                    {d.last_contact_note && <p style={{ color: C.mutedL, fontSize: 11, marginTop: 5, fontStyle: "italic" }}>"{d.last_contact_note}"</p>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ color: C.accent, fontWeight: 900, fontSize: 17 }}>{eur(d.commission_due)}</span>
                    <Bt small ghost color={C.blue} onClick={() => setMGestion(d)}>Gestión</Bt>
                    {esAdmin && <Bt small color={C.green} onClick={() => setMPago(d)}>Liquidar</Bt>}
                  </div>
                </div>
              </Caja>
            );
          })}
        </>
      )}

      {/* ══ PROFESIONALES ══ */}
      {sub === "pros" && (
        <>
          {pros.length === 0 && <Caja><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No hay profesionales.</p></Caja>}
          {pros.map((p) => {
            const suyos = deals.filter((d) => d.pro_id === p.id);
            const asignados = suyos.filter((d) => d.assigned_at).length;
            const aceptados = suyos.filter((d) => d.accepted_at).length;
            const cerrados = suyos.filter((d) => Number(d.price) > 0).length;
            const devueltos = suyos.filter((d) => d.returned_to_admin || (d.stage === "cerrado" && d.close_reason)).length;
            const devengado = suyos.filter((d) => !d.settled_at).reduce((a, d) => a + Number(d.commission_due), 0);
            const debe = Math.max(0, devengado - 0);
            const tasaAcep = asignados ? Math.round((aceptados / asignados) * 100) : 0;
            const tasaCierre = aceptados ? Math.round((cerrados / aceptados) * 100) : 0;
            const semaforo = debe > 200 ? C.red : debe > 0 ? C.orange : C.green;
            if (!suyos.length) return null;
            return (
              <Caja key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: semaforo }} />
                      <span style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{p.name}</span>
                      <span style={{ color: C.muted, fontSize: 12 }}>{p.trade}</span>
                    </div>
                    <p style={{ color: C.mutedL, fontSize: 11, margin: "6px 0 0" }}>
                      {asignados} asignados · acepta {tasaAcep}% · cierra {tasaCierre}% · {devueltos} devueltos
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: debe > 0 ? C.accent : C.green, fontWeight: 900, fontSize: 16, margin: 0 }}>{eur(debe)}</p>
                    <p style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>pendiente · pagado {eur(pagadoDe(p.id))}</p>
                  </div>
                </div>
              </Caja>
            );
          })}
        </>
      )}

      {/* ══ CIUDADES ══ */}
      {sub === "ciudades" && esAdmin && (
        <>
          {cities.map((c) => {
            const ds = deals.filter((d) => d.city_id === c.id);
            const comprometida = ds.reduce((a, d) => a + Number(d.commission_committed || 0), 0);
            const devengada = ds.reduce((a, d) => a + Number(d.commission_due || 0), 0);
            const prosCiudad = pros.filter((p) => (p.zone || "").toLowerCase().includes(c.name.toLowerCase()));
            const fontaneros = prosCiudad.filter((p) => p.trade === "Fontanero").length;
            const electricistas = prosCiudad.filter((p) => p.trade === "Electricista").length;
            const puedeAbrir = fontaneros >= 2 && electricistas >= 2;
            return (
              <Caja key={c.id} borde={c.active ? C.green + "44" : C.border}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{c.name}</span>
                      <Etiqueta texto={c.active ? "ACTIVA" : "CERRADA"} color={c.active ? C.green : C.muted} />
                    </div>
                    <p style={{ color: C.mutedL, fontSize: 11, margin: "6px 0 0" }}>
                      {c.province} · {(c.population || 0).toLocaleString("es-ES")} hab · {ds.length} leads
                      {c.ads_daily_budget > 0 ? " · " + c.ads_daily_budget + " €/día ads" : ""}
                    </p>
                    {!c.active && (
                      <p style={{ color: puedeAbrir ? C.green : C.orange, fontSize: 11, marginTop: 6, fontWeight: 700 }}>
                        {puedeAbrir ? "✓ Lista para abrir" : `Faltan pros: ${fontaneros}/2 fontaneros · ${electricistas}/2 electricistas`}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: C.accent, fontWeight: 900, fontSize: 16, margin: 0 }}>{eur(comprometida)}</p>
                    <p style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>comprometida · {eur(devengada)} devengada</p>
                  </div>
                </div>
              </Caja>
            );
          })}
        </>
      )}

      {/* ══ DECISIONES ══ */}
      {sub === "decisiones" && (
        <>
          {reqs.length === 0 && deals.filter((d) => d.unpaid_reason).length === 0 && (
            <Caja style={{ textAlign: "center", padding: 30 }}><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Nada que decidir. Todo al día.</p></Caja>
          )}

          {reqs.map((r) => {
            const d = deals.find((x) => x.id === r.deal_id);
            return (
              <Caja key={r.id} borde={C.purple + "55"}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <Etiqueta texto={r.kind === "pausa" ? "PIDE APARCAR" : "PIDE CORRECCIÓN"} color={C.purple} />
                    <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: "7px 0 0" }}>
                      {r.pro_name} · {d?.client_name || "—"}
                    </p>
                    <p style={{ color: C.mutedL, fontSize: 12, marginTop: 4 }}>
                      {r.kind === "pausa"
                        ? `Hasta el ${fechaCorta(r.requested_until)} · ${labelDe(PAUSE_REASONS, r.reason)}`
                        : `Nuevo importe: ${eur(r.new_amount)}`}
                      {r.note ? " — " + r.note : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Bt small color={C.green} onClick={() => resolverSolicitud(r, true)}>Aprobar</Bt>
                    <Bt small ghost color={C.red} onClick={() => resolverSolicitud(r, false)}>Rechazar</Bt>
                  </div>
                </div>
              </Caja>
            );
          })}

          {deals.filter((d) => d.unpaid_reason && !d.settled_at).map((d) => (
            <Caja key={d.id} borde={C.red + "44"}>
              <Etiqueta texto="IMPAGO DECLARADO" color={C.red} />
              <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: "7px 0 0" }}>{d.pro_name} · {d.client_name}</p>
              <p style={{ color: C.mutedL, fontSize: 12, marginTop: 4 }}>
                {labelDe(UNPAID_REASONS, d.unpaid_reason)} · {eur(d.price)}
                {d.unpaid_expected_date ? " · previsto " + fechaCorta(d.unpaid_expected_date) : ""}
              </p>
            </Caja>
          ))}
        </>
      )}

      {/* ══════ MODALES ══════ */}
      {mNuevo && <ModalNuevoLead cities={cities} onClose={() => setMNuevo(false)} onSave={async (datos, asignarLuego) => {
        const { data, error } = await db.from("deals").insert(datos).select().single();
        if (error) { aviso("Error: " + error.message); return; }
        await cargar();
        setMNuevo(false);
        aviso("Lead creado #" + (data as any).ref);
        if (asignarLuego) setMAsignar(data as DealRow);
      }} />}

      {mAsignar && <ModalAsignar d={mAsignar} pros={pros} onClose={() => setMAsignar(null)} onPick={(p: any) => asignar(mAsignar, p)} onCualificar={() => { cualificar(mAsignar); setMAsignar(null); }} />}

      {mDescartar && <ModalDescartar onClose={() => setMDescartar(null)} onSave={(m: string, n: string) => descartar(mDescartar, m, n)} />}

      {mPago && <ModalPago d={mPago} onClose={() => setMPago(null)} onSave={(imp: number, f: string, ref: string) => registrarPago(mPago, imp, f, ref)} />}

      {mSeguimiento && <ModalSeguimiento d={mSeguimiento} onClose={() => setMSeguimiento(null)} onSave={async (nota: string, proxima: string, pausa: string) => {
        const cambios: any = { last_contact_at: new Date().toISOString(), last_contact_note: nota || null, next_followup_at: proxima || null };
        if (pausa) { cambios.pause_until = pausa; cambios.stage = "en_espera"; cambios.stage_before_pause = mSeguimiento.stage; }
        await guardar(mSeguimiento.id, cambios, "Seguimiento guardado");
        await evt(mSeguimiento.id, "seguimiento", nota + (proxima ? " · volver el " + proxima : ""));
        setMSeguimiento(null);
      }} />}

      {mGestion && <ModalGestion d={mGestion} onClose={() => setMGestion(null)} onSave={async (fecha: string, nota: string) => {
        await guardar(mGestion.id, {
          expected_payment_date: fecha || null,
          last_contact_at: new Date().toISOString(),
          last_contact_note: nota || null,
        }, "Gestión registrada");
        await evt(mGestion.id, "gestion_cobro", (fecha ? "Cobro previsto " + fecha : "Sin fecha") + (nota ? " · " + nota : ""));
        setMGestion(null);
      }} />}

      {mFicha && <ModalFicha d={mFicha} cities={cities} onClose={() => setMFicha(null)} onMover={(st: Stage) => { setMFicha(null); moverDeal(mFicha, st); }} onGuardar={async (cambios: any) => { await guardar(mFicha.id, cambios, "Ficha actualizada"); setMFicha(null); }} />}
      {mPidePrecio && <ModalPrecioAdmin d={mPidePrecio.d} onClose={() => setMPidePrecio(null)} onSave={async (precio: number) => {
        await guardar(mPidePrecio.d.id, { stage: mPidePrecio.destino, price: precio, deadline_at: null }, "Precio " + eur(precio));
        setMPidePrecio(null);
      }} />}

      {mPideCobro && <ModalCobroAdmin d={mPideCobro} onClose={() => setMPideCobro(null)} onSave={async (imp: number, fecha: string) => {
        await guardar(mPideCobro.id, { stage: "cobrado_cliente", collected_amount: imp, collected_at: fecha, deadline_at: null }, "Cobro registrado");
        setMPideCobro(null);
      }} />}
    </div>
  );
}

// ── MODALES ─────────────────────────────────────────────────
function ModalNuevoLead({ cities, onClose, onSave }: any) {
  const [f, setF] = useState<any>({
    client_phone: "", client_name: "", city_id: "", zone: "", trade: "",
    description: "", urgency: 1, price: "", source: "llamada",
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const ciudad = cities.find((c: any) => c.id === f.city_id);
  const oficios = ciudad && ciudad.trades_enabled && ciudad.trades_enabled.length
    ? ciudad.trades_enabled : TRADES;
  const ok = f.client_phone.trim() && f.client_name.trim() && f.city_id && f.trade && f.description.trim();

  const construir = () => ({
    client_phone: f.client_phone.trim(), client_name: f.client_name.trim(),
    city_id: f.city_id, city_name: ciudad?.name || null, zone: f.zone.trim() || null,
    trade: f.trade, description: f.description.trim(),
    urgency: Number(f.urgency), source: f.source, stage: "entrada",
    price: f.price ? parseFloat(String(f.price).replace(",", ".")) : null,
  });

  return (
    <Modal title="Nuevo lead" onClose={onClose}>
      <In label="Teléfono" req value={f.client_phone} onChange={(v: string) => set("client_phone", v)} ph="656 39 80 14" />
      <In label="Nombre" req value={f.client_name} onChange={(v: string) => set("client_name", v)} ph="Lucía" />
      <Sel label="Ciudad" req value={f.city_id} onChange={(v: string) => set("city_id", v)}
        options={cities.map((c: any) => ({ v: c.id, l: c.name + (c.active ? "" : " (cerrada)") }))} />
      <In label="Zona o barrio" value={f.zone} onChange={(v: string) => set("zone", v)} ph="Nervión" />
      <Sel label="Oficio" req value={f.trade} onChange={(v: string) => set("trade", v)}
        options={oficios.map((t: string) => ({ v: t, l: t }))} />
      <In label="Descripción" req value={f.description} onChange={(v: string) => set("description", v)} ph="Cuadro que salta al enchufar la lavadora" />
      <Sel label="Urgencia" value={String(f.urgency)} onChange={(v: string) => set("urgency", v)}
        options={[{ v: "0", l: "Baja" }, { v: "1", l: "Normal" }, { v: "2", l: "Alta — urgente" }]} />
      <In label="Importe orientativo (€)" type="number" value={f.price} onChange={(v: string) => set("price", v)} ph="200" />
      <Sel label="Origen" value={f.source} onChange={(v: string) => set("source", v)}
        options={ORIGENES.map((o) => ({ v: o, l: o }))} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Bt full ghost color={C.mutedL} disabled={!ok} onClick={() => onSave(construir(), false)}>Guardar</Bt>
        <Bt full color={C.accent} disabled={!ok} onClick={() => onSave(construir(), true)}>Guardar y asignar →</Bt>
      </div>
    </Modal>
  );
}

function ModalAsignar({ d, pros, onClose, onPick, onCualificar }: any) {
  const [q, setQ] = useState("");
  const mismos = pros.filter((p: any) => p.trade === d.trade);
  const otros = pros.filter((p: any) => p.trade !== d.trade);
  const filtra = (l: any[]) => q ? l.filter((p) => (p.name || "").toLowerCase().includes(q.toLowerCase())) : l;

  const fila = (p: any) => (
    <button key={p.id} onClick={() => onPick(p)} style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
      padding: "11px 12px", marginBottom: 6, borderRadius: 9, cursor: "pointer", fontFamily: F,
      background: "transparent", border: "1px solid " + C.border, textAlign: "left",
    }}>
      <span>
        <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{p.name}</span>
        <span style={{ color: C.muted, fontSize: 11 }}> · {p.trade}{p.zone ? " · " + p.zone : ""}</span>
      </span>
      <span style={{ color: C.accent, fontSize: 11, fontWeight: 700 }}>Asignar →</span>
    </button>
  );

  return (
    <Modal title={"Asignar · " + d.client_name} onClose={onClose}>
      <p style={{ color: C.mutedL, fontSize: 12, marginBottom: 12 }}>
        {d.trade} · {d.city_name || "sin ciudad"}{d.zone ? " · " + d.zone : ""} · {d.description}
      </p>
      {d.stage === "entrada" && (
        <div style={{ marginBottom: 14 }}>
          <Bt full ghost color={C.blue} onClick={onCualificar}>Marcar cualificado sin asignar todavía</Bt>
        </div>
      )}
      <In label="Buscar profesional" value={q} onChange={setQ} ph="Marcos…" />
      {filtra(mismos).length > 0 && (
        <>
          <p style={{ fontSize: 11, color: C.accent, fontWeight: 800, margin: "10px 0 7px" }}>DEL OFICIO · {d.trade}</p>
          {filtra(mismos).map(fila)}
        </>
      )}
      {filtra(otros).length > 0 && (
        <>
          <p style={{ fontSize: 11, color: C.muted, fontWeight: 800, margin: "14px 0 7px" }}>OTROS OFICIOS</p>
          {filtra(otros).slice(0, 12).map(fila)}
        </>
      )}
    </Modal>
  );
}

function ModalDescartar({ onClose, onSave }: any) {
  const [m, setM] = useState("");
  const [n, setN] = useState("");
  return (
    <Modal title="Descartar lead" onClose={onClose} ancho={420}>
      <Sel label="Motivo" req value={m} onChange={setM} options={MOTIVOS_DESCARTE.map((x) => ({ v: x.id, l: x.label }))} />
      <In label="Nota (opcional)" value={n} onChange={setN} />
      <Bt full color={C.red} disabled={!m} onClick={() => onSave(m, n)}>Descartar</Bt>
    </Modal>
  );
}

function ModalPago({ d, onClose, onSave }: any) {
  const [v, setV] = useState(String(d.commission_due));
  const [f, setF] = useState(new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState("");
  const num = parseFloat(String(v).replace(",", "."));
  const ok = !isNaN(num) && num > 0;
  return (
    <Modal title="Registrar liquidación" onClose={onClose} ancho={420}>
      <p style={{ color: C.mutedL, fontSize: 12, marginBottom: 14 }}>
        {d.pro_name} · {d.client_name} · comisión {eur(d.commission_due)}
      </p>
      <In label="Importe recibido (€)" req type="number" value={v} onChange={setV} />
      <In label="Fecha de la transferencia" req type="date" value={f} onChange={setF} />
      <In label="Concepto o referencia" value={ref} onChange={setRef} ph="OY-MARCOS-S32" />
      <Bt full color={C.green} disabled={!ok} onClick={() => onSave(num, f, ref)}>Registrar</Bt>
    </Modal>
  );
}

function ModalFicha({ d, cities, onClose, onMover, onGuardar }: any) {
  const [eventos, setEventos] = useState<any[]>([]);
  const [editando, setEditando] = useState(false);
  const [cityId, setCityId] = useState(d.city_id || "");
  const [zona, setZona] = useState(d.zone || "");
  const [tel, setTel] = useState(d.client_phone === "—" ? "" : (d.client_phone || ""));
  useEffect(() => {
    db.from("deal_events").select("*").eq("deal_id", d.id).order("created_at", { ascending: true })
      .then(({ data }: any) => setEventos(data || []));
  }, [d.id]);
  const ciudadSel = (cities || []).find((c: any) => c.id === cityId);
  const puedeGuardar = !!cityId && tel.trim().length >= 6;
  const canal = d.source === "google_ads" ? "Google Ads" : d.source === "seo" ? "Búsqueda natural" : d.source === "llamada" ? "Llamada directa" : d.source || "—";
  return (
    <Modal title={"#" + d.ref + " · " + d.client_name} onClose={onClose}>
      {!d.city_id && (
        <Caja borde={C.orange} style={{ background: C.orange + "18" }}>
          <p style={{ color: C.orange, fontSize: 12, fontWeight: 800, margin: 0 }}>
            ⚠ Este lead no tiene ciudad. Ponla aquí abajo para poder cualificarlo.
          </p>
        </Caja>
      )}

      {!editando && (
        <>
          <p style={{ color: C.mutedL, fontSize: 13, marginBottom: 6 }}>
            {d.trade} · {d.city_name || "SIN CIUDAD"}{d.zone ? " · " + d.zone : ""} · 📞 {d.client_phone}
          </p>
          <p style={{ color: C.text, fontSize: 13, marginBottom: 10 }}>{d.description}</p>
          <div style={{ marginBottom: 16 }}>
            <Bt small ghost onClick={() => setEditando(true)}>✎ Corregir ciudad, barrio o teléfono</Bt>
          </div>
        </>
      )}

      {editando && (
        <Caja style={{ background: C.bg }}>
          <Sel label="Ciudad" req value={cityId} onChange={setCityId}
            options={(cities || []).map((c: any) => ({ v: c.id, l: c.name }))} />
          <In label="Barrio o pueblo" value={zona} onChange={setZona} ph="Triana, Nervión, Dos Hermanas…" />
          <In label="Teléfono del cliente" req value={tel} onChange={setTel} ph="600000000" />
          <div style={{ display: "flex", gap: 8 }}>
            <Bt disabled={!puedeGuardar} onClick={() => onGuardar({
              city_id: cityId,
              city_name: ciudadSel ? ciudadSel.name : null,
              zone: zona.trim() || null,
              client_phone: tel.trim(),
            })}>Guardar</Bt>
            <Bt ghost color={C.muted} onClick={() => setEditando(false)}>Cancelar</Bt>
          </div>
        </Caja>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Etiqueta texto={STAGE_LABEL[d.stage as Stage]} color={colorEstado(d.stage)} />
        {d.pro_name && <Etiqueta texto={d.pro_name} color={C.blue} />}
        {d.price ? <Etiqueta texto={eur(d.price) + " → " + eur(d.commission_committed)} color={C.accent} /> : null}
      </div>

      <Caja style={{ background: C.bg, marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: C.mutedL, fontWeight: 800, margin: "0 0 8px" }}>DE DÓNDE VIENE</p>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 12px", fontSize: 12 }}>
          <span style={{ color: C.muted }}>Canal</span>
          <span style={{ color: C.text }}>{canal}</span>
          <span style={{ color: C.muted }}>Página</span>
          <span style={{ color: C.text }}>{d.landing && d.landing !== "app" && d.landing !== "historico" ? d.landing : "—"}</span>
          <span style={{ color: C.muted }}>Campaña</span>
          <span style={{ color: C.text }}>{d.utm_campaign || "—"}</span>
          <span style={{ color: C.muted }}>Anuncio</span>
          <span style={{ color: C.text }}>{d.utm_content || "—"}</span>
          <span style={{ color: C.muted }}>Entró el</span>
          <span style={{ color: C.text }}>{fechaCorta(d.created_at)}</span>
        </div>
      </Caja>

      {onMover && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: C.mutedL, fontWeight: 800, marginBottom: 6 }}>MOVER A</p>
          <select defaultValue="" onChange={(e) => { if (e.target.value) onMover(e.target.value); }}
            style={{ width: "100%", padding: "9px 11px", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: F }}>
            <option value="">— elegir etapa —</option>
            {(["entrada","cualificado","asignado","aceptado","presupuestando","precio_acordado","programado","completado","cobrado_cliente","en_espera","cerrado"] as Stage[])
              .filter((x) => x !== d.stage)
              .map((x) => <option key={x} value={x}>{STAGE_LABEL[x]}</option>)}
          </select>
        </div>
      )}
      <p style={{ fontSize: 11, color: C.mutedL, fontWeight: 800, marginBottom: 8 }}>HISTORIAL</p>
      {eventos.length === 0 && <p style={{ color: C.muted, fontSize: 12 }}>Sin movimientos.</p>}
      {eventos.map((e) => (
        <div key={e.id} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid " + C.border }}>
          <span style={{ color: C.muted, fontSize: 11, minWidth: 92 }}>
            {new Date(e.created_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span style={{ color: C.mutedL, fontSize: 11, minWidth: 60 }}>{e.actor_name || e.actor_role}</span>
          <span style={{ color: C.text, fontSize: 12, flex: 1 }}>{e.detail || e.event}</span>
        </div>
      ))}
    </Modal>
  );
}

function ModalPrecioAdmin({ d, onClose, onSave }: any) {
  const [v, setV] = useState(d.price ? String(d.price) : "");
  const num = parseFloat(String(v).replace(",", "."));
  const ok = !isNaN(num) && num > 0;
  return (
    <Modal title="Falta el precio acordado" onClose={onClose} ancho={400}>
      <p style={{ color: C.mutedL, fontSize: 12, marginBottom: 14 }}>
        {d.client_name} · {d.trade}{d.pro_name ? " · " + d.pro_name : ""}
      </p>
      <In label="Precio del trabajo (€)" req type="number" value={v} onChange={setV} ph="400" />
      {ok && <p style={{ color: C.mutedL, fontSize: 12, marginBottom: 12 }}>Comisión: <b style={{ color: C.accent }}>{eur(num * Number(d.commission_rate || 0.2))}</b></p>}
      <Bt full color={C.accent} disabled={!ok} onClick={() => onSave(num)}>Guardar y mover</Bt>
    </Modal>
  );
}

function ModalCobroAdmin({ d, onClose, onSave }: any) {
  const [v, setV] = useState(d.price ? String(d.price) : "");
  const [f, setF] = useState(new Date().toISOString().slice(0, 10));
  const num = parseFloat(String(v).replace(",", "."));
  const ok = !isNaN(num) && num > 0;
  return (
    <Modal title="¿Cuánto ha cobrado el profesional?" onClose={onClose} ancho={400}>
      <p style={{ color: C.mutedL, fontSize: 12, marginBottom: 14 }}>
        {d.client_name} · {d.pro_name || "sin asignar"}
      </p>
      <In label="Importe cobrado del cliente (€)" req type="number" value={v} onChange={setV} />
      <In label="Fecha del cobro" req type="date" value={f} onChange={setF} />
      {ok && <p style={{ color: C.mutedL, fontSize: 12, marginBottom: 12 }}>Comisión que nace: <b style={{ color: C.accent }}>{eur(num * Number(d.commission_rate || 0.2))}</b></p>}
      <Bt full color={C.green} disabled={!ok} onClick={() => onSave(num, f)}>Confirmar</Bt>
    </Modal>
  );
}

function ModalGestion({ d, onClose, onSave }: any) {
  const [f, setF] = useState(d.expected_payment_date || "");
  const [n, setN] = useState(d.last_contact_note || "");
  return (
    <Modal title="Gestión de cobro" onClose={onClose} ancho={420}>
      <p style={{ color: C.mutedL, fontSize: 12, marginBottom: 4 }}>
        {d.pro_name} · {d.client_name}
      </p>
      <p style={{ color: C.accent, fontSize: 15, fontWeight: 800, marginBottom: 16 }}>
        Debe {eur(d.commission_due)}
      </p>
      <In label="¿Cuándo dice que va a pagar?" type="date" value={f} onChange={setF} />
      <In label="¿Qué te ha dicho?" value={n} onChange={setN} ph="Paga el lunes por transferencia" />
      <Bt full color={C.blue} onClick={() => onSave(f, n)}>Guardar gestión</Bt>
    </Modal>
  );
}

function ModalSeguimiento({ d, onClose, onSave }: any) {
  const [nota, setNota] = useState("");
  const [prox, setProx] = useState(d.next_followup_at || "");
  const [pausa, setPausa] = useState("");
  const ok = nota.trim().length > 2;
  return (
    <Modal title={"Seguimiento · " + d.client_name} onClose={onClose} ancho={440}>
      <p style={{ color: C.mutedL, fontSize: 12, marginBottom: 4 }}>
        {d.trade}{d.zone ? " · " + d.zone : ""} · {STAGE_LABEL[d.stage as Stage]}
      </p>
      <a href={"tel:" + d.client_phone} style={{ color: C.accent, fontSize: 15, fontWeight: 700, textDecoration: "none", display: "block", marginBottom: 6 }}>
        📞 {d.client_phone}
      </a>
      {d.pro_name && <p style={{ color: C.blue, fontSize: 12, marginBottom: 14 }}>🔨 {d.pro_name}</p>}
      {d.last_contact_note && (
        <Caja style={{ padding: 10, background: C.card2 }}>
          <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, margin: 0 }}>ÚLTIMA GESTIÓN · {fechaCorta(d.last_contact_at)}</p>
          <p style={{ color: C.mutedL, fontSize: 12, margin: "4px 0 0", fontStyle: "italic" }}>"{d.last_contact_note}"</p>
        </Caja>
      )}
      <In label="¿Qué ha pasado?" req value={nota} onChange={setNota} ph="Le mandé WhatsApp pidiendo el vídeo otra vez" />
      <In label="¿Cuándo hay que volver a llamar?" type="date" value={prox} onChange={setProx} />
      <div style={{ borderTop: "1px solid " + C.border, paddingTop: 12, marginBottom: 12 }}>
        <In label="Aparcar hasta (opcional — lo saca del pipeline activo)" type="date" value={pausa} onChange={setPausa} />
      </div>
      <Bt full color={C.accent} disabled={!ok} onClick={() => onSave(nota, prox, pausa)}>Guardar seguimiento</Bt>
    </Modal>
  );
}
