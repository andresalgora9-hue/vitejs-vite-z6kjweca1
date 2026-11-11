// ============================================================
// OficioYa · Panel PROFESIONAL — Anexo al contrato: cobro con tarjeta (11/11/2026)
// Sale a los profesionales que ya tenían contrato firmado (con domiciliación SEPA o transferencia) cada vez que
// entran en la app, hasta que lo aceptan con un clic. Quien firma el contrato nuevo ya lo lleva dentro y no lo ve.
// Datos: RPC oy_anexo_pendiente / oy_anexo_aceptar. La aceptación queda guardada con hora, cuenta, IP y navegador
// (pro_contrato_anexos) y el PDF del anexo aceptado va a Archivos, junto con su contrato y su ficha.
// ============================================================
import React, { useEffect, useState } from "react";
import { db } from "../supabase";
import { C, F } from "./proComun";

type Anexo = { mostrar: boolean; version?: string; titulo?: string; texto?: string; nombre?: string | null };

export default function ProAnexoTarjeta({ userId, oculto = false }: { userId: string; oculto?: boolean }) {
  const [anexo, setAnexo] = useState<Anexo | null>(null);
  const [luego, setLuego] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState<{ enlace: string | null; tarjeta: boolean } | null>(null);

  useEffect(() => {
    let vivo = true;
    db.rpc("oy_anexo_pendiente", { p_pro: userId }).then(({ data, error }: any) => {
      if (vivo && !error && data && data.mostrar) setAnexo(data as Anexo);
    }, () => {});
    return () => { vivo = false; };
  }, [userId]);

  if (!anexo || oculto || luego) return null;

  const aceptar = async () => {
    if (enviando) return;
    setEnviando(true); setError("");
    const { error: e } = await db.rpc("oy_anexo_aceptar", { p_pro: userId, p_version: anexo.version });
    if (e) {
      setEnviando(false);
      setError(/cambiado/.test(e.message || "") ? e.message : "No se ha podido guardar. Inténtalo de nuevo.");
      return;
    }
    // ¿Tiene ya su tarjeta guardada? Si no, se le ofrece guardarla ahora
    let enlace: string | null = null, tarjeta = false;
    try {
      const { data: est }: any = await db.rpc("oy_cobro_estado_pro", { p_pro: userId });
      enlace = est?.enlace || null; tarjeta = !!est?.tarjeta;
    } catch { /* sin estado: se cierra igual */ }
    setEnviando(false);
    setHecho({ enlace, tarjeta });
  };

  const caja: React.CSSProperties = {
    width: "100%", maxWidth: 460, maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", boxSizing: "border-box",
    background: C.surface, border: "1px solid " + C.border, borderRadius: 18, padding: "22px 18px 18px",
    boxShadow: "0 18px 50px rgba(0,0,0,0.55)", color: C.text,
  };
  const btn = (principal: boolean): React.CSSProperties => ({
    flex: 1, minHeight: 46, borderRadius: 12, cursor: "pointer", fontFamily: F, fontSize: 15,
    border: principal ? "none" : "1px solid " + C.border, background: principal ? C.accent : "transparent",
    color: principal ? "#000" : C.text, fontWeight: principal ? 900 : 800,
  });

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="oy-anexo-t" style={{
      position: "fixed", inset: 0, zIndex: 24000, background: "rgba(0,0,0,0.72)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16, fontFamily: F,
    }}>
      {hecho ? (
        <div style={caja}>
          <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 10 }}>✅</div>
          <h2 id="oy-anexo-t" style={{ margin: "0 0 10px", fontSize: 21, fontWeight: 900 }}>Anexo aceptado</h2>
          <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.55 }}>
            Lo hemos guardado junto con tu contrato y tu ficha.
            {hecho.tarjeta
              ? " Tus facturas se cobrarán solas en tu tarjeta guardada."
              : " Ahora guarda tu tarjeta para que tus facturas se paguen solas, sin transferencias."}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {!hecho.tarjeta && hecho.enlace && (
              <button style={btn(true)} onClick={() => { window.location.href = hecho.enlace as string; }}>Guardar mi tarjeta</button>
            )}
            <button style={btn(hecho.tarjeta || !hecho.enlace)} onClick={() => setAnexo(null)}>
              {!hecho.tarjeta && hecho.enlace ? "Más tarde" : "Cerrar"}
            </button>
          </div>
        </div>
      ) : (
        <div style={caja}>
          <h2 id="oy-anexo-t" style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 900, letterSpacing: "-0.01em" }}>
            {anexo.nombre ? anexo.nombre + ", tu" : "Tu"} contrato pasa a pago con tarjeta
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 14.5, lineHeight: 1.55, color: C.mutedL }}>
            Tus facturas se pagarán con tu tarjeta guardada, como en los contratos nuevos. Léelo y acéptalo con un clic: el resto de tu contrato no cambia.
          </p>
          <div style={{
            flex: "1 1 auto", minHeight: 120, overflowY: "auto", background: C.card, border: "1px solid " + C.border, borderRadius: 12,
            padding: "12px 12px", marginBottom: 12, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", color: C.text,
          }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{anexo.titulo}</div>
            {anexo.texto}
          </div>
          {error && <div style={{ color: C.red, fontSize: 13.5, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn(false)} onClick={() => setLuego(true)} disabled={enviando}>Ahora no</button>
            <button style={btn(true)} onClick={aceptar} disabled={enviando} autoFocus>
              {enviando ? "Guardando…" : "Acepto el anexo"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.45 }}>
            Al pulsar «Acepto el anexo» queda registrada tu aceptación (fecha y hora, tu cuenta, IP y navegador).
          </div>
        </div>
      )}
    </div>
  );
}
