// ============================================================
// OficioYa · Panel PROFESIONAL — Anexos al contrato (11/11/2026)
// Salen a los profesionales que ya tenían contrato firmado cada vez que entran en la app, hasta que aceptan con un
// clic los anexos que les faltan, de uno en uno: primero el de cobro con tarjeta y después el de clientes que no
// contestan. Quien firma el contrato nuevo ya los lleva dentro y no los ve.
// Datos: RPC oy_anexo_siguiente / oy_anexo_aceptar(p_pro, p_version, p_anexo). La aceptación queda guardada con hora,
// cuenta, IP y navegador (pro_contrato_anexos) y el PDF del anexo aceptado va a Archivos, junto con su contrato y su ficha.
// Si la base no tuviera las funciones nuevas, usa las de antes (oy_anexo_pendiente: solo el de la tarjeta).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { db } from "../supabase";
import { C, F } from "./proComun";

type Anexo = { mostrar: boolean; anexo?: string; version?: string; titulo?: string; texto?: string; nombre?: string | null };

// Lo que se le explica de cada anexo (el texto que acepta viene de la base)
type Textos = { titulo: (nombre: string) => string; intro: string; hecho: string };
const TEXTOS: Record<string, Textos> = {
  cobro_tarjeta: {
    titulo: (n) => (n ? n + ", tu" : "Tu") + " contrato pasa a pago con tarjeta",
    intro: "Tus facturas se pagarán con tu tarjeta guardada, como en los contratos nuevos. Léelo y acéptalo con un clic: el resto de tu contrato no cambia.",
    hecho: "",
  },
  no_contesta: {
    titulo: (n) => (n ? n + ", ya" : "Ya") + " no pagas los clientes que no contestan",
    intro: "Si no consigues hablar con un cliente en 24 horas pese a llamarle y escribirle, y nosotros tampoco, no lo pagas. Léelo y acéptalo con un clic: el resto de tu contrato no cambia.",
    hecho: "Si un cliente no te contesta, avísanos en 48 horas por WhatsApp (656 398 014) o por email, con capturas de tus llamadas y mensajes.",
  },
};
const GENERICO: Textos = {
  titulo: (n) => (n ? n + ", un" : "Un") + " anexo a tu contrato",
  intro: "Léelo y acéptalo con un clic: el resto de tu contrato no cambia.",
  hecho: "",
};
const noExiste = (e: any) => /PGRST202|Could not find the function/i.test(String(e?.code || "") + " " + String(e?.message || ""));

export default function ProAnexoTarjeta({ userId, oculto = false, onAbierta }: {
  userId: string; oculto?: boolean; onAbierta?: (abierta: boolean, ofreceTarjeta?: boolean) => void;
}) {
  const [anexo, setAnexo] = useState<Anexo | null>(null);
  const [luego, setLuego] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState<{ enlace: string | null; tarjeta: boolean; anexo: string } | null>(null);
  const tipo = anexo?.anexo || "cobro_tarjeta";
  const t = TEXTOS[tipo] || GENERICO;
  // Avisa a la app de si está abierto (para que las demás ventanas de entrada esperen) y de si es el de la tarjeta
  // (ese ya le ofrece guardarla, así que en esta entrada no se le vuelve a pedir)
  const abierta = !!anexo && !oculto && !luego;
  useEffect(() => { onAbierta?.(abierta, tipo === "cobro_tarjeta"); }, [abierta, tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  // El siguiente anexo que le falta (null si ninguno)
  const cargar = useCallback(async (): Promise<Anexo | null> => {
    let r: any = await db.rpc("oy_anexo_siguiente", { p_pro: userId });
    if (r.error && noExiste(r.error)) {
      r = await db.rpc("oy_anexo_pendiente", { p_pro: userId });
      if (!r.error && r.data && r.data.mostrar) r.data = { ...r.data, anexo: r.data.anexo || "cobro_tarjeta" };
    }
    return !r.error && r.data && r.data.mostrar ? (r.data as Anexo) : null;
  }, [userId]);

  useEffect(() => {
    let vivo = true;
    cargar().then((a) => { if (vivo && a) setAnexo(a); }, () => {});
    return () => { vivo = false; };
  }, [cargar]);

  if (!anexo || oculto || luego) return null;

  const aceptar = async () => {
    if (enviando) return;
    setEnviando(true); setError("");
    let { error: e } = await db.rpc("oy_anexo_aceptar", { p_pro: userId, p_version: anexo.version, p_anexo: tipo });
    if (e && noExiste(e) && tipo === "cobro_tarjeta") {
      ({ error: e } = await db.rpc("oy_anexo_aceptar", { p_pro: userId, p_version: anexo.version }));
    }
    if (e) {
      setEnviando(false);
      setError(/cambiado/.test(e.message || "") ? e.message : "No se ha podido guardar. Inténtalo de nuevo.");
      return;
    }
    // Con el de la tarjeta: ¿tiene ya su tarjeta guardada? Si no, se le ofrece guardarla ahora
    let enlace: string | null = null, tarjeta = false;
    if (tipo === "cobro_tarjeta") {
      try {
        const { data: est }: any = await db.rpc("oy_cobro_estado_pro", { p_pro: userId });
        enlace = est?.enlace || null; tarjeta = !!est?.tarjeta;
      } catch { /* sin estado: se cierra igual */ }
    }
    setEnviando(false);
    setHecho({ enlace, tarjeta, anexo: tipo });
  };

  // Al cerrar el «Anexo aceptado», si le falta otro sale ese; si no, se cierra
  const seguir = async () => {
    setHecho(null); setError("");
    setAnexo(await cargar().catch(() => null));
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
  const conTarjeta = hecho?.anexo === "cobro_tarjeta";

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
            {conTarjeta
              ? (hecho.tarjeta
                ? " Tus facturas se cobrarán solas en tu tarjeta guardada."
                : " Ahora guarda tu tarjeta para que tus facturas se paguen solas, sin transferencias.")
              : ((TEXTOS[hecho.anexo] || GENERICO).hecho ? " " + (TEXTOS[hecho.anexo] || GENERICO).hecho : "")}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {conTarjeta && !hecho.tarjeta && hecho.enlace && (
              <button style={btn(true)} onClick={() => { window.location.href = hecho.enlace as string; }}>Guardar mi tarjeta</button>
            )}
            <button style={btn(!(conTarjeta && !hecho.tarjeta && hecho.enlace))} onClick={seguir}>
              {conTarjeta && !hecho.tarjeta && hecho.enlace ? "Más tarde" : "Cerrar"}
            </button>
          </div>
        </div>
      ) : (
        <div style={caja}>
          <h2 id="oy-anexo-t" style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 900, letterSpacing: "-0.01em" }}>
            {t.titulo(anexo.nombre || "")}
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 14.5, lineHeight: 1.55, color: C.mutedL }}>
            {t.intro}
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
