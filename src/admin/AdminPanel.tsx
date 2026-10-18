// ============================================================
// OficioYa · ADMIN nuevo (modelo pago por lead)
// Resumen · Leads · Facturas · Profesionales · Mensajes · Marketing · Ajustes · CRM antiguo
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { db } from "../supabase";
import Admin from "../Admin";
import { C, F, useAncho, Pro, Lead, Factura, Solicitud, Routing, Gasto, Datos, INICIO_PAGO_POR_LEAD, INICIO_ALTAS, ts } from "./apUi";
import Resumen from "./apResumen";
import Leads from "./apLeads";
import Facturas from "./apFacturas";
import Profesionales from "./apProfesionales";
import Mensajes from "./apMensajes";
import Marketing from "./apMarketing";
import Ajustes from "./apAjustes";

type Seccion = "resumen" | "leads" | "facturas" | "profesionales" | "mensajes" | "marketing" | "ajustes" | "antiguo";

const NAV: { id: Seccion; label: string; icono: string }[] = [
  { id: "resumen", label: "Resumen", icono: "M4 13h4v7H4zM10 8h4v12h-4zM16 4h4v16h-4z" },
  { id: "leads", label: "Leads", icono: "M4 6h16M4 12h16M4 18h10" },
  { id: "facturas", label: "Facturas", icono: "M6.5 3.5h8l4 4v13h-12zM14.5 3.5v4h4M9.5 12h6M9.5 15.5h6" },
  { id: "profesionales", label: "Profesionales", icono: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.7-3.7 3.7-5.8 7.5-5.8s6.8 2.1 7.5 5.8" },
  { id: "mensajes", label: "Mensajes", icono: "M20.5 12.2c0 3.9-3.8 7-8.5 7a10 10 0 0 1-2.6-.34L4.2 20.5l1.5-3.7A6.7 6.7 0 0 1 3.5 12.2c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" },
  { id: "marketing", label: "Marketing y ROAS", icono: "M4 18l5-6 4 3 7-9M15 6h5v5" },
  { id: "ajustes", label: "Ajustes", icono: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" },
  { id: "antiguo", label: "CRM antiguo", icono: "M4 7h16v12H4zM4 7l2-3h12l2 3M10 11h4" },
];

function Icono({ d, size = 18 }: { d: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

export default function AdminPanel({ onLogout, nombre }: { onLogout: () => void; nombre?: string }) {
  const ancho = useAncho();
  const movil = ancho < 900;
  const [sec, setSec] = useState<Seccion>(() => {
    try { return (sessionStorage.getItem("oy_admin_sec") as Seccion) || "resumen"; } catch { return "resumen"; }
  });
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const aviso = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(""), 2800); }, []);

  const cargar = useCallback(async () => {
    const [pros, leads, facts, sols, rout, gastos, precios, cfg, subs] = await Promise.all([
      db.from("users").select("id,name,email,phone,whatsapp,trade,zone,company_name,cif,fiscal_address,fiscal_zip,fiscal_city,billing_email,joined_at,created_at,activacion_estado,activacion_invoice_id,deleted,banned,plan").eq("type", "profesional"),
      db.from("pro_leads").select("*").order("created_at", { ascending: false }).limit(5000),
      db.from("lead_invoices").select("*").order("issued_at", { ascending: false }).limit(5000),
      db.from("budget_requests").select("id,created_at,client_id,client_name,oficio,zona,description,status,city_slug,landing,gclid,canal").order("created_at", { ascending: false }).limit(5000),
      db.from("lead_routing").select("*"),
      db.from("ad_spend").select("*").order("desde", { ascending: false }),
      db.from("lead_prices").select("*"),
      db.from("oy_config").select("*"),
      db.from("push_subscriptions").select("user_id"),
    ]);
    const err = [pros, leads, facts, sols].find((r: any) => r.error);
    if (err) { setError("No se han podido cargar los datos. Recarga la página."); return; }
    const listaPros = ((pros.data || []) as Pro[]).filter((p) => !p.deleted);
    const proPorId: Record<string, Pro> = {};
    listaPros.forEach((p) => { proPorId[p.id] = p; });
    const config: Record<string, number> = {};
    ((cfg.data || []) as any[]).forEach((c) => { config[c.clave] = Number(c.valor); });
    setD({
      pros: listaPros,
      leads: (leads.data || []) as Lead[],
      facturas: (facts.data || []) as Factura[],
      solicitudes: (sols.data || []) as Solicitud[],
      routing: (rout.data || []) as Routing[],
      gastos: (gastos.data || []) as Gasto[],
      precios: ((precios.data || []) as any[]).map((p) => ({ trade_key: p.trade_key, price: Number(p.price) })),
      config,
      conPush: new Set(((subs.data || []) as any[]).map((s) => s.user_id)),
      proPorId,
    });
    setError("");
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") cargar(); }, 60000);
    return () => clearInterval(t);
  }, [cargar]);
  useEffect(() => { try { sessionStorage.setItem("oy_admin_sec", sec); } catch { /* nada */ } }, [sec]);

  // CRM antiguo: el panel de siempre, a pantalla completa, con botón para volver
  if (sec === "antiguo") {
    return (
      <div>
        <Admin onLogout={onLogout} />
        <button onClick={() => setSec("resumen")} style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 18, zIndex: 50000,
          background: C.accent, color: "#000", border: "none", borderRadius: 99, padding: "11px 18px",
          fontFamily: F, fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>← Volver al panel nuevo</button>
      </div>
    );
  }

  // Avisos en el menú
  const usados = new Set((d?.leads || []).map((l) => l.budget_request_id).filter(Boolean));
  const sinAsignar = d ? d.solicitudes.filter((s) => ts(s.created_at) >= ts(INICIO_PAGO_POR_LEAD) && !usados.has(s.id) && s.status !== "descartado" && s.status !== "cancelled").length : 0;
  const vencidas = d ? d.facturas.filter((f) => f.status === "pendiente" && ts(f.due_at) < Date.now()).length : 0;
  const altas = d ? d.pros.filter((p) => ts(p.joined_at || p.created_at) >= ts(INICIO_ALTAS) && !["pagada", "exento"].includes(p.activacion_estado || "")).length : 0;
  const globo: Partial<Record<Seccion, number>> = { leads: sinAsignar, facturas: vencidas, profesionales: altas };

  const contenido = () => {
    if (error) return <div style={{ color: C.red, padding: 30 }}>{error}</div>;
    if (!d) return <div style={{ color: C.mutedL, padding: 30 }}>Cargando datos...</div>;
    const props = { d, recargar: cargar, aviso, irA: (s: string) => setSec(s as Seccion) };
    switch (sec) {
      case "resumen": return <Resumen {...props} />;
      case "leads": return <Leads {...props} />;
      case "facturas": return <Facturas {...props} />;
      case "profesionales": return <Profesionales {...props} />;
      case "mensajes": return <Mensajes {...props} />;
      case "marketing": return <Marketing {...props} />;
      case "ajustes": return <Ajustes {...props} />;
      default: return null;
    }
  };

  const botonNav = (n: typeof NAV[number], horizontal: boolean) => {
    const act = sec === n.id;
    const g = globo[n.id] || 0;
    return (
      <button key={n.id} onClick={() => setSec(n.id)} style={{
        display: "flex", alignItems: "center", gap: 10, width: horizontal ? undefined : "100%", flexShrink: 0,
        padding: horizontal ? "8px 12px" : "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: F,
        background: act ? C.accent + "18" : "transparent", color: act ? C.accent : C.mutedL,
        fontWeight: act ? 800 : 700, fontSize: 13.5, textAlign: "left", position: "relative",
        marginTop: !horizontal && n.id === "antiguo" ? 14 : 0,
      }}>
        <Icono d={n.icono} />
        <span style={{ flex: horizontal ? undefined : 1 }}>{n.label}</span>
        {g > 0 && <span style={{ background: n.id === "facturas" ? C.red : C.orange, color: "#fff", borderRadius: 99, minWidth: 18, height: 18, fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{g > 99 ? "99+" : g}</span>}
      </button>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: F }}>
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,10,15,0.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid " + C.border, paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 900, fontSize: 19, letterSpacing: "-0.03em" }}>Oficio<span style={{ color: C.accent }}>Ya</span></span>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.orange, background: C.orange + "1F", padding: "3px 8px", borderRadius: 5 }}>ADMIN</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {nombre && !movil && <span style={{ fontSize: 12.5, color: C.mutedL }}>{nombre}</span>}
            <button onClick={() => cargar().then(() => aviso("Datos actualizados"))} style={{ background: "none", border: "1px solid " + C.border, borderRadius: 7, color: C.mutedL, cursor: "pointer", padding: "5px 10px", fontSize: 12, fontFamily: F }}>Actualizar</button>
            <button onClick={onLogout} style={{ background: "none", border: "1px solid " + C.border, borderRadius: 7, color: C.mutedL, cursor: "pointer", padding: "5px 10px", fontSize: 12, fontFamily: F }}>Salir</button>
          </div>
        </div>
        {movil && (
          <nav style={{ display: "flex", gap: 4, overflowX: "auto", padding: "0 10px 8px", WebkitOverflowScrolling: "touch" as any }}>
            {NAV.map((n) => botonNav(n, true))}
          </nav>
        )}
      </header>

      <div style={{ display: "flex" }}>
        {!movil && (
          <aside style={{ width: 220, flexShrink: 0, borderRight: "1px solid " + C.border, padding: "16px 10px", position: "sticky", top: 54, height: "calc(100vh - 54px)", boxSizing: "border-box", overflowY: "auto" }}>
            {NAV.map((n) => botonNav(n, false))}
          </aside>
        )}
        <main style={{ flex: 1, minWidth: 0, padding: movil ? "14px 14px 60px" : "20px 28px 60px", maxWidth: 1240, boxSizing: "border-box" }}>
          {contenido()}
        </main>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: C.cardHi, color: C.text, border: "1px solid " + C.border, borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, zIndex: 60000, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>{toast}</div>
      )}
    </div>
  );
}
