// ============================================================
// OficioYa · Panel PROFESIONAL — «¡Ya te pueden llegar clientes!»
// Sale una sola vez cuando Andrés confirma el alta (Admin → Profesionales → Altas, al arrancar las campañas):
// al tocar el aviso del móvil o la próxima vez que el profesional entra en la app.
// Datos: RPC oy_aviso_inicio / oy_aviso_inicio_visto.
// ============================================================
import React, { useEffect, useState } from "react";
import { db } from "../supabase";
import { C, F } from "./proComun";

type Aviso = { mostrar: boolean; nombre?: string; oficio?: string; ciudad?: string };

const ETAPAS = [
  { t: "Contactado", c: C.blue },
  { t: "Presupuesto enviado", c: C.orange },
  { t: "Ganado", c: C.green },
  { t: "Perdido", c: C.red },
];

export default function ProAvisoInicio({ userId, oculto = false, onIrALeads }: { userId: string; oculto?: boolean; onIrALeads?: () => void }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    let vivo = true;
    const mirar = async () => {
      const { data, error } = await db.rpc("oy_aviso_inicio", { p_pro: userId });
      if (vivo && !error && data && (data as Aviso).mostrar) setAviso(data as Aviso);
    };
    mirar();
    // Si la app ya estaba abierta y vuelve a primer plano (por ejemplo, al tocar el aviso), se mira otra vez
    const alVolver = () => { if (document.visibilityState === "visible") mirar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; document.removeEventListener("visibilitychange", alVolver); };
  }, [userId]);

  if (!aviso || oculto) return null;

  const cerrar = (irALeads: boolean) => {
    setAviso(null);
    db.rpc("oy_aviso_inicio_visto", { p_pro: userId }).then(() => {}, () => {});
    if (irALeads && onIrALeads) onIrALeads();
  };
  const donde = [aviso.oficio, aviso.ciudad ? "en " + aviso.ciudad : ""].filter(Boolean).join(" ");

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="oy-aviso-inicio-t" style={{
      position: "fixed", inset: 0, zIndex: 25000, background: "rgba(0,0,0,0.72)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16, fontFamily: F,
    }}>
      <div style={{
        width: "100%", maxWidth: 420, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxSizing: "border-box",
        background: C.surface, border: "1px solid " + C.border, borderRadius: 18, padding: "24px 20px 20px",
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)", color: C.text,
      }}>
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>🚀</div>
        <h2 id="oy-aviso-inicio-t" style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>
          ¡Ya estás en marcha{aviso.nombre ? ", " + aviso.nombre : ""}!
        </h2>
        <p style={{ margin: "0 0 10px", fontSize: 15, lineHeight: 1.55, color: C.text }}>
          Tus campañas{donde ? " de " + donde : ""} ya están funcionando. Desde hoy te puede llegar un cliente en cualquier momento, y te avisaremos al instante.
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.55, color: C.mutedL }}>
          Un consejo: llama en cuanto entre. El primero que llama suele ser el que se lleva el trabajo.
        </p>

        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "14px 14px 12px", marginBottom: 18 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 8, color: C.accent }}>Lo que más te va a ayudar</div>
          <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 10 }}>
            Ve moviendo cada cliente a su etapa en la pestaña <b>Leads</b>:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {ETAPAS.map((e) => (
              <span key={e.t} style={{ fontSize: 12.5, fontWeight: 800, padding: "4px 9px", borderRadius: 99, background: e.c + "22", color: e.c }}>{e.t}</span>
            ))}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: C.mutedL }}>
            Con cada trabajo que marcas como <b style={{ color: C.green }}>Ganado</b> aprendemos qué cliente es el tuyo, y afinamos la publicidad para traerte cada vez más clientes como ese. Cuanto más al día lo tengas, mejores clientes te llegarán.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {onIrALeads && (
            <button onClick={() => cerrar(true)} style={{
              flex: 1, minHeight: 46, borderRadius: 12, border: "1px solid " + C.border, background: "transparent",
              color: C.text, fontFamily: F, fontWeight: 800, fontSize: 14.5, cursor: "pointer",
            }}>Ver mis leads</button>
          )}
          <button onClick={() => cerrar(false)} autoFocus style={{
            flex: 1, minHeight: 46, borderRadius: 12, border: "none", background: C.accent,
            color: "#000", fontFamily: F, fontWeight: 900, fontSize: 15, cursor: "pointer",
          }}>¡A por ello!</button>
        </div>
      </div>
    </div>
  );
}
