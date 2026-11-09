// ============================================================
// OficioYa · Panel PROFESIONAL — Ficha «Tu zona y tus trabajos» (09/11/2026)
// Sale al entrar en la app a los que pagan por lead hasta que la confirman. Con ella se preparan sus campañas y,
// al guardarla, acepta qué leads son válidos según su contrato. Cada confirmación queda guardada como prueba
// (lo que rellenó, el texto exacto que aceptó, la fecha, la IP y el navegador: tabla pro_ficha_aceptaciones).
// También se abre desde «Mi negocio» para cambiarla. Datos: RPC oy_ficha_pro / oy_ficha_guardar.
// ============================================================
import React, { useEffect, useState } from "react";
import { db } from "../supabase";
import { C, F } from "./proComun";

type Datos = {
  mostrar: boolean; aceptada_at?: string | null; nombre?: string; oficio?: string | null; ciudad?: string;
  ficha?: any; servicios?: string[]; texto?: string; version?: string;
};

const campo: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "11px 12px", background: C.bg, border: "1px solid " + C.border,
  borderRadius: 10, color: C.text, fontSize: 16, fontFamily: F, outline: "none",
};
const etiqueta: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 800, color: C.text, margin: "16px 0 8px" };
const ayuda: React.CSSProperties = { fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.45 };

function Interruptor({ activo, onChange, texto }: { activo: boolean; onChange: (v: boolean) => void; texto: string }) {
  return (
    <button type="button" onClick={() => onChange(!activo)} aria-pressed={activo} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none",
      padding: "8px 0", cursor: "pointer", fontFamily: F, color: C.text, fontSize: 14.5, textAlign: "left",
    }}>
      <span style={{
        width: 40, height: 23, borderRadius: 99, background: activo ? C.green : C.border, position: "relative", flex: "0 0 auto",
        transition: "background .15s",
      }}>
        <span style={{
          position: "absolute", top: 3, left: activo ? 20 : 3, width: 17, height: 17, borderRadius: 99, background: "#fff",
          transition: "left .15s",
        }} />
      </span>
      {texto}
    </button>
  );
}

export default function ProFicha({ userId, oculto = false, abrir = false, onCerrar, onAbierta }: {
  userId: string; oculto?: boolean; abrir?: boolean;
  onCerrar?: (guardada: boolean) => void; onAbierta?: (abierta: boolean) => void;
}) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cerrada, setCerrada] = useState(false);
  const [zonas, setZonas] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [otros, setOtros] = useState("");
  const [horario, setHorario] = useState("");
  const [finde, setFinde] = useState(false);
  const [urg, setUrg] = useState(false);
  const [cap, setCap] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  useEffect(() => {
    let vivo = true;
    db.rpc("oy_ficha_pro", { p_pro: userId }).then(({ data, error }: any) => {
      if (!vivo || error || !data) return;
      const d = data as Datos;
      const f = d.ficha || {};
      const lista = Array.isArray(d.servicios) ? d.servicios : [];
      const delPro = f.hecha_por === "profesional";
      setZonas(f.zonas || d.ciudad || "");
      setMarcados(Array.isArray(f.servicios_lista) ? f.servicios_lista.filter((s: string) => lista.includes(s)) : []);
      setOtros(delPro ? f.servicios_otros || "" : lista.length ? "" : f.servicios || "");
      setHorario(f.horario || "");
      setFinde(!!f.fines_semana);
      setUrg(!!f.urgencias_24h);
      setCap(f.capacidad_semana != null && f.capacidad_semana !== "" ? String(f.capacidad_semana) : "");
      setDatos(d);
    }, () => {});
    return () => { vivo = false; };
  }, [userId]);

  const visible = !!datos && !cerrada && !oculto && (abrir || datos.mostrar || hecho);
  useEffect(() => { if (onAbierta) onAbierta(visible); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !datos) return null;

  const lista = Array.isArray(datos.servicios) ? datos.servicios : [];
  const oficio = datos.oficio || "tu oficio";
  const cambiar = !!datos.aceptada_at;

  const marcar = (s: string) => setMarcados((m) => (m.includes(s) ? m.filter((x) => x !== s) : [...m, s]));
  const cerrar = (guardada: boolean) => { setCerrada(true); if (onCerrar) onCerrar(guardada); };

  const guardar = async () => {
    setError(null);
    const n = parseInt(cap.replace(/[^0-9]/g, ""), 10);
    if (zonas.trim().length < 2) { setError("Dinos en qué pueblos o zonas trabajas."); return; }
    if (!marcados.length && !otros.trim()) { setError("Marca los trabajos que haces."); return; }
    if (!n || n < 1 || n > 200) { setError("Dinos cuántos clientes nuevos puedes atender a la semana."); return; }
    if (!acepta) { setError("Para guardar tu ficha tienes que aceptar las condiciones."); return; }
    setGuardando(true);
    const { error: e } = await db.rpc("oy_ficha_guardar", {
      p_pro: userId,
      p_ficha: {
        zonas, servicios: marcados, otros, horario, fines_semana: finde, urgencias_24h: urg,
        capacidad_semana: String(n), acepta: true, ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
    });
    setGuardando(false);
    if (e) { setError(e.message || "No se ha podido guardar. Inténtalo de nuevo."); return; }
    setHecho(true);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="oy-ficha-t" style={{
      position: "fixed", inset: 0, zIndex: 25500, background: "rgba(0,0,0,0.72)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 12, fontFamily: F,
    }}>
      <div style={{
        width: "100%", maxWidth: 460, maxHeight: "calc(100vh - 24px)", overflowY: "auto", boxSizing: "border-box",
        background: C.surface, border: "1px solid " + C.border, borderRadius: 18, padding: "22px 18px 18px",
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)", color: C.text,
      }}>
        {hecho ? (
          <>
            <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>✅</div>
            <h2 id="oy-ficha-t" style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>¡Ficha guardada!</h2>
            <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.55 }}>
              Ya tenemos lo que necesitamos para preparar tus campañas. Si algo cambia, puedes cambiarla cuando quieras en «Mi negocio».
            </p>
            <button onClick={() => cerrar(true)} autoFocus style={{
              width: "100%", minHeight: 46, borderRadius: 12, border: "none", background: C.accent,
              color: "#000", fontFamily: F, fontWeight: 900, fontSize: 15, cursor: "pointer",
            }}>Listo</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 10 }}>📋</div>
            <h2 id="oy-ficha-t" style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 900, letterSpacing: "-0.02em" }}>
              {cambiar ? "Cambia tu ficha" : "Tu zona y tus trabajos" + (datos.nombre ? ", " + datos.nombre : "")}
            </h2>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: C.mutedL }}>
              Con esto preparamos tus campañas{datos.ciudad ? " en " + datos.ciudad : ""}: te buscaremos clientes en tus zonas y para los trabajos que haces. Es un minuto.
            </p>

            <label style={etiqueta} htmlFor="oy-ficha-zonas">¿En qué pueblos o zonas trabajas?</label>
            <input id="oy-ficha-zonas" value={zonas} onChange={(e) => setZonas(e.target.value)} placeholder="Ej.: Córdoba capital, Lucena, Montilla" style={campo} />
            <div style={ayuda}>Sepáralos con comas. Solo te llegarán clientes de estas zonas.</div>

            <span style={etiqueta}>¿Qué trabajos de {oficio} haces?</span>
            {lista.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {lista.map((s) => {
                  const si = marcados.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => marcar(s)} aria-pressed={si} style={{
                      padding: "8px 11px", borderRadius: 99, cursor: "pointer", fontFamily: F, fontSize: 13.5, fontWeight: 700,
                      border: "1px solid " + (si ? C.accent : C.border), background: si ? C.accent + "22" : C.card,
                      color: si ? C.accent : C.mutedL, textAlign: "left",
                    }}>{si ? "✓ " : ""}{s}</button>
                  );
                })}
              </div>
            )}
            <input value={otros} onChange={(e) => setOtros(e.target.value)} placeholder={lista.length ? "Otros trabajos que haces (opcional)" : "Ej.: los trabajos que haces, separados por comas"}
              style={{ ...campo, marginTop: lista.length ? 10 : 0 }} />

            <span style={etiqueta}>Disponibilidad</span>
            <Interruptor activo={finde} onChange={setFinde} texto="Trabajo fines de semana y festivos" />
            <Interruptor activo={urg} onChange={setUrg} texto="Atiendo urgencias 24 h" />
            <input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Horario (opcional). Ej.: L-V de 8 a 18 h" style={{ ...campo, marginTop: 8 }} />

            <label style={etiqueta} htmlFor="oy-ficha-cap">¿Cuántos clientes nuevos puedes atender a la semana?</label>
            <input id="oy-ficha-cap" value={cap} onChange={(e) => setCap(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} inputMode="numeric" placeholder="Ej.: 5" style={{ ...campo, maxWidth: 140 }} />

            <div style={{ background: C.card, border: "1px solid " + (acepta ? C.green + "88" : C.border), borderRadius: 12, padding: 12, marginTop: 18 }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: C.mutedL, maxHeight: 150, overflowY: "auto", marginBottom: 10 }}>{datos.texto}</div>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 14.5, fontWeight: 800 }}>
                <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: C.green, flex: "0 0 auto" }} />
                He leído y acepto estas condiciones
              </label>
            </div>

            {error && <div role="alert" style={{ marginTop: 12, fontSize: 13.5, fontWeight: 700, color: C.red }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => cerrar(false)} disabled={guardando} style={{
                flex: "0 0 auto", minHeight: 46, padding: "0 14px", borderRadius: 12, border: "1px solid " + C.border, background: "transparent",
                color: C.mutedL, fontFamily: F, fontWeight: 800, fontSize: 14, cursor: "pointer",
              }}>{abrir ? "Cancelar" : "Más tarde"}</button>
              <button onClick={guardar} disabled={guardando} style={{
                flex: 1, minHeight: 46, borderRadius: 12, border: "none", background: guardando ? C.border : C.accent,
                color: guardando ? C.muted : "#000", fontFamily: F, fontWeight: 900, fontSize: 15, cursor: guardando ? "default" : "pointer",
              }}>{guardando ? "Guardando..." : "Guardar mi ficha"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
