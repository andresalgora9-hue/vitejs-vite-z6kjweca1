// ============================================================
// OficioYa · Panel PROFESIONAL — bloque superior de PERFIL
// Resultados con OficioYa, previsión de 7 días y datos de empresa.
// ============================================================
import React, { useState, useEffect } from "react";
import { db } from "../supabase";
import { C, F, Card, Boton, Titulo, eurCorto, duracionMin } from "./proComun";

const ETAPAS_GANADO_HIST = ["precio_acordado", "programado", "completado", "cobrado_cliente", "facturado", "liquidado"];
const DIA = 86400000;

interface LeadStat {
  created_at: string;
  estado: string;
  presupuesto_eur: number | null;
  price: number;
  primer_contacto_at: string | null;
  budget_request_id: string | null;
}
interface DealStat { stage: string; price: number | null; budget_request_id: string | null; }

function Kpi({ valor, texto, color = C.text }: { valor: string; texto: string; color?: string }) {
  return (
    <Card style={{ marginBottom: 0, padding: "13px 12px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: C.mutedL, marginTop: 2, lineHeight: 1.35 }}>{texto}</div>
    </Card>
  );
}

function CampoEmpresa({ label, value, onChange, placeholder = "", type = "text", inputMode }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 6, fontWeight: 600 }}>{label}</label>
      <input type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{
        width: "100%", boxSizing: "border-box", padding: "11px 12px", background: C.bg, border: "1px solid " + C.border,
        borderRadius: 9, color: C.text, fontSize: 15, fontFamily: F, outline: "none",
      }} />
    </div>
  );
}

export default function ProNegocio({ user, onUpdate, onToast }: {
  user: any;
  onUpdate: (u: any) => void;
  onToast?: (m: string) => void;
}) {
  const [leads, setLeads] = useState<LeadStat[]>([]);
  const [hist, setHist] = useState<DealStat[]>([]);
  const [desde, setDesde] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Datos de empresa
  const [empresa, setEmpresa] = useState(user.company_name || "");
  const [cif, setCif] = useState(user.cif || "");
  const [direccion, setDireccion] = useState(user.fiscal_address || "");
  const [cp, setCp] = useState(user.fiscal_zip || "");
  const [ciudad, setCiudad] = useState(user.fiscal_city || "");
  const [emailFact, setEmailFact] = useState(user.billing_email || "");
  const [telefono, setTelefono] = useState(user.phone || "");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      const [ls, ds, us] = await Promise.all([
        db.from("pro_leads").select("created_at,estado,presupuesto_eur,price,primer_contacto_at,budget_request_id").eq("pro_id", user.id).eq("anulado", false),
        db.from("deals").select("stage,price,budget_request_id").eq("pro_id", user.id),
        db.from("users").select("joined_at,created_at,company_name,cif,fiscal_address,fiscal_zip,fiscal_city,billing_email,phone").eq("id", user.id).maybeSingle(),
      ]);
      const l = (ls.data || []) as LeadStat[];
      const ids = new Set(l.map((x) => x.budget_request_id).filter(Boolean));
      setLeads(l);
      setHist(((ds.data || []) as DealStat[]).filter((d) => !d.budget_request_id || !ids.has(d.budget_request_id)));
      const u: any = us.data || {};
      setDesde(u.joined_at || u.created_at || null);
      // Rellena el formulario con lo último guardado
      setEmpresa(u.company_name || ""); setCif(u.cif || ""); setDireccion(u.fiscal_address || "");
      setCp(u.fiscal_zip || ""); setCiudad(u.fiscal_city || ""); setEmailFact(u.billing_email || ""); setTelefono(u.phone || "");
      setCargando(false);
    })();
  }, [user.id]);

  const guardar = async () => {
    setGuardando(true);
    const cambios = {
      company_name: empresa.trim() || null,
      cif: cif.trim().toUpperCase() || null,
      fiscal_address: direccion.trim() || null,
      fiscal_zip: cp.trim() || null,
      fiscal_city: ciudad.trim() || null,
      billing_email: emailFact.trim().toLowerCase() || null,
      phone: telefono.trim() || null,
    };
    const { error } = await db.from("users").update(cambios).eq("id", user.id);
    setGuardando(false);
    if (error) { onToast?.("No se han podido guardar los datos"); return; }
    const nuevo = { ...user, ...cambios };
    onUpdate(nuevo);
    try { localStorage.setItem("oy_user", JSON.stringify(nuevo)); } catch { /* nada */ }
    onToast?.("Datos de empresa guardados");
  };

  // ── Cálculos ──
  const ahora = Date.now();
  const ganadosLeads = leads.filter((l) => l.estado === "ganado");
  const ganadosHist = hist.filter((d) => ETAPAS_GANADO_HIST.includes(d.stage));
  const clientes = leads.length + hist.length;
  const ganados = ganadosLeads.length + ganadosHist.length;
  const importeLeads = ganadosLeads.reduce((s, l) => s + Number(l.presupuesto_eur || 0), 0);
  const importeTotal = importeLeads + ganadosHist.reduce((s, d) => s + Number(d.price || 0), 0);
  const invertido = leads.reduce((s, l) => s + Number(l.price || 0), 0);
  const retorno = invertido > 0 && importeLeads > 0 ? importeLeads / invertido : null;
  const tasa = leads.length >= 3 ? ganadosLeads.length / leads.length : null;
  const tiempos = leads
    .filter((l) => l.primer_contacto_at)
    .map((l) => (new Date(l.primer_contacto_at as string).getTime() - new Date(l.created_at).getTime()) / 60000)
    .filter((m) => m >= 0);
  const respuesta = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;
  const ticket = ganadosLeads.filter((l) => l.presupuesto_eur).length
    ? importeLeads / ganadosLeads.filter((l) => l.presupuesto_eur).length : null;

  // Previsión: los próximos 7 días según los 7 anteriores
  const ult7 = leads.filter((l) => ahora - new Date(l.created_at).getTime() < 7 * DIA).length;
  const ant7 = leads.filter((l) => {
    const t = ahora - new Date(l.created_at).getTime();
    return t >= 7 * DIA && t < 14 * DIA;
  }).length;
  const tendencia = ant7 > 0 ? Math.round(((ult7 - ant7) / ant7) * 100) : null;
  const trabajosPrev = tasa != null ? ult7 * tasa : null;
  const importePrev = trabajosPrev != null && ticket ? trabajosPrev * ticket : null;

  const desdeTexto = desde
    ? new Date(desde).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "Europe/Madrid" })
    : null;

  return (
    <div style={{ fontFamily: F }}>
      <div style={{ padding: "22px 0 4px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: C.text, margin: 0 }}>Tu negocio con OficioYa</h2>
        {desdeTexto && <div style={{ fontSize: 13, color: C.mutedL, marginTop: 4 }}>Con nosotros desde {desdeTexto}</div>}
      </div>

      {cargando ? (
        <div style={{ padding: "24px 0", color: C.mutedL, fontSize: 13 }}>Cargando tus datos...</div>
      ) : (
        <>
          <Titulo>Desde que empezaste</Titulo>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Kpi valor={String(clientes)} texto="Clientes que te ha conseguido OficioYa" />
            <Kpi valor={String(ganados)} texto="Trabajos ganados" color={C.green} />
            <Kpi valor={importeTotal ? eurCorto(importeTotal) : "—"} texto="En trabajos cerrados" color={C.green} />
            <Kpi valor={retorno ? retorno.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " €" : "—"} texto="En trabajos por cada 1 € invertido en leads" color={C.accent} />
            <Kpi valor={tasa != null ? Math.round(tasa * 100) + "%" : "—"} texto="De tus leads acaban en trabajo" />
            <Kpi valor={respuesta != null ? duracionMin(respuesta) : "—"} texto="Tardas de media en contactar a un cliente nuevo" />
          </div>
          {(retorno == null || tasa == null) && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
              Marca tus leads como "Ganado" con su importe para ver tu retorno y tu tasa de cierre.
            </div>
          )}

          <Titulo>Previsión de los próximos 7 días</Titulo>
          <Card accent={C.accent + "66"}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: C.accent }}>~{ult7}</span>
              <span style={{ fontSize: 14, color: C.text, fontWeight: 700 }}>{ult7 === 1 ? "cliente nuevo" : "clientes nuevos"}</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4, lineHeight: 1.5 }}>
              Según los últimos 7 días ({ult7}){ant7 || tendencia != null ? " y los 7 anteriores (" + ant7 + ")" : ""}.
              {tendencia != null && tendencia !== 0 && (
                <span style={{ color: tendencia > 0 ? C.green : C.orange, fontWeight: 700 }}>
                  {" "}{tendencia > 0 ? "Subiendo un " + tendencia + "%." : "Bajando un " + Math.abs(tendencia) + "%."}
                </span>
              )}
            </div>
            {trabajosPrev != null && (
              <div style={{ fontSize: 13, color: C.text, marginTop: 10, paddingTop: 10, borderTop: "1px solid " + C.border }}>
                Con tu tasa de cierre, unos <b>{trabajosPrev.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</b> trabajos
                {importePrev ? <> · <b style={{ color: C.green }}>~{eurCorto(importePrev)}</b> en facturación</> : null}.
              </div>
            )}
          </Card>
        </>
      )}

      <Titulo>Datos de empresa y contacto</Titulo>
      <Card>
        <div style={{ fontSize: 12.5, color: C.mutedL, marginBottom: 12 }}>Salen en tus facturas. Revisa que estén bien.</div>
        <CampoEmpresa label="Nombre o razón social" value={empresa} onChange={setEmpresa} placeholder="Ej. Pinturas García S.L." />
        <CampoEmpresa label="NIF / CIF" value={cif} onChange={setCif} placeholder="Ej. B12345678" />
        <CampoEmpresa label="Dirección fiscal" value={direccion} onChange={setDireccion} placeholder="Calle, número, piso" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 10 }}>
          <CampoEmpresa label="Código postal" value={cp} onChange={setCp} inputMode="numeric" placeholder="41001" />
          <CampoEmpresa label="Ciudad" value={ciudad} onChange={setCiudad} placeholder="Sevilla" />
        </div>
        <CampoEmpresa label="Email para facturas" value={emailFact} onChange={setEmailFact} type="email" placeholder="facturas@tuempresa.com" />
        <CampoEmpresa label="Teléfono de contacto" value={telefono} onChange={setTelefono} type="tel" inputMode="tel" placeholder="600 000 000" />
        <div style={{ display: "flex" }}>
          <Boton onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Guardar datos de empresa"}</Boton>
        </div>
      </Card>
    </div>
  );
}
