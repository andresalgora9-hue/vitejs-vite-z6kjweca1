// ============================================================
// OficioYa · Panel PROFESIONAL — "chat" para instalar la app (PWA)
// Sale abajo a la derecha como un chat, con botón de instalar e instrucciones
// según el móvil: Android/Chrome (botón directo), iPhone Safari (pasos),
// iPhone desde WhatsApp/Instagram/Chrome (abrir en Safari), resto (menú del navegador).
// ============================================================
import React, { useEffect, useRef, useState } from "react";

const NARANJA = "#FF8C00";
const AMARILLO = "#FFD700";
const VERDE = "#00C27A";
const TEXTO = "#1F2430";
const GRIS = "#6B7385";
const F = "'DM Sans',sans-serif";
const CLAVE_INSTALADA = "oy_pro_app_instalada";
const CLAVE_POSPUESTO = "oy_pro_app_pospuesto_hasta";
const DIAS_POSPONER = 2;

// Guardamos el aviso de instalación de Chrome en cuanto llega, aunque el chat aún no esté montado
type PromptEvt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let promptGuardado: PromptEvt | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptGuardado = e as PromptEvt;
    window.dispatchEvent(new Event("oy-instalable"));
  });
}

function plataforma() {
  if (typeof navigator === "undefined") return "otro" as const;
  const ua = navigator.userAgent || "";
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  const enApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|TikTok|; wv\)/i.test(ua);
  if (ios) {
    const safari = /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\//i.test(ua) && !enApp;
    return safari ? ("ios_safari" as const) : ("ios_otro" as const);
  }
  if (/android/i.test(ua)) return enApp ? ("android_app" as const) : ("android" as const);
  return "escritorio" as const;
}
const yaInstalada = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true || localStorage.getItem(CLAVE_INSTALADA) === "1");

function Burbuja({ children, retraso = 0 }: { children: React.ReactNode; retraso?: number }) {
  const [visible, setVisible] = useState(retraso === 0);
  useEffect(() => { if (retraso) { const t = setTimeout(() => setVisible(true), retraso); return () => clearTimeout(t); } }, [retraso]);
  if (!visible) return (
    <div style={{ alignSelf: "flex-start", background: "#F1F3F7", borderRadius: "14px 14px 14px 4px", padding: "10px 14px", display: "flex", gap: 4 }}>
      {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#A3AAB8", animation: `oyPunto 1s ${i * 0.15}s infinite` }} />)}
    </div>
  );
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "88%", background: "#F1F3F7", color: TEXTO, borderRadius: "14px 14px 14px 4px", padding: "10px 13px", fontSize: 14, lineHeight: 1.45, animation: "oyEntra .25s ease-out" }}>
      {children}
    </div>
  );
}
function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 8 }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: NARANJA, color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
      <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{children}</span>
    </div>
  );
}
const IconoCompartir = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-3px", margin: "0 2px" }}>
    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

export default function ProInstalarApp({ nombre }: { nombre?: string | null }) {
  const [mostrar, setMostrar] = useState(() => !yaInstalada());
  const [abierto, setAbierto] = useState(false);
  const [instalable, setInstalable] = useState<boolean>(() => !!promptGuardado);
  const [hecho, setHecho] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [visto, setVisto] = useState(false);
  const plat = useRef(plataforma()).current;
  const primerNombre = (nombre || "").trim().split(/\s+/)[0] || "";

  useEffect(() => {
    if (!mostrar) return;
    const alInstalable = () => setInstalable(true);
    const alInstalar = () => { localStorage.setItem(CLAVE_INSTALADA, "1"); setHecho(true); setAbierto(true); setTimeout(() => setMostrar(false), 4000); };
    window.addEventListener("oy-instalable", alInstalable);
    window.addEventListener("appinstalled", alInstalar);
    // Se abre solo a los pocos segundos, salvo que lo haya pospuesto
    const hasta = Number(localStorage.getItem(CLAVE_POSPUESTO) || 0);
    const t = Date.now() >= hasta ? setTimeout(() => setAbierto(true), 3500) : null;
    return () => { window.removeEventListener("oy-instalable", alInstalable); window.removeEventListener("appinstalled", alInstalar); if (t) clearTimeout(t); };
  }, [mostrar]);
  useEffect(() => { if (abierto) setVisto(true); }, [abierto]);

  if (!mostrar) return null;

  const instalar = async () => {
    if (!promptGuardado) return;
    const p = promptGuardado;
    promptGuardado = null;
    setInstalable(false);
    await p.prompt();
    const r = await p.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (r.outcome === "accepted") { localStorage.setItem(CLAVE_INSTALADA, "1"); setHecho(true); setTimeout(() => setMostrar(false), 4000); }
  };
  const posponer = () => {
    localStorage.setItem(CLAVE_POSPUESTO, String(Date.now() + DIAS_POSPONER * 86400000));
    setAbierto(false);
  };
  const copiarEnlace = async () => {
    try { await navigator.clipboard.writeText(window.location.origin + "/pro"); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* nada */ }
  };

  const boton = (texto: string, onClick: () => void, color = NARANJA) => (
    <button onClick={onClick} style={{ width: "100%", marginTop: 10, padding: "12px 14px", border: "none", borderRadius: 12, background: color, color: "#fff", fontFamily: F, fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 14px " + color + "55" }}>{texto}</button>
  );

  let instrucciones: React.ReactNode;
  if (hecho) {
    instrucciones = <Burbuja>✅ <b>¡Listo!</b> Ya tienes OficioYa en tu móvil. Ábrela desde su icono y, en Inicio, activa los avisos para enterarte de cada cliente nuevo.</Burbuja>;
  } else if (instalable) {
    instrucciones = (
      <Burbuja retraso={1600}>
        Es un momento, sin pasar por la tienda de apps 👇
        {boton("📲 Instalar la app", instalar)}
      </Burbuja>
    );
  } else if (plat === "ios_safari") {
    instrucciones = (
      <Burbuja retraso={1600}>
        En iPhone se instala así:
        <Paso n={1}>Pulsa el botón <b>Compartir</b> <IconoCompartir /> en la barra de abajo de Safari.</Paso>
        <Paso n={2}>Baja y toca <b>«Añadir a pantalla de inicio»</b>.</Paso>
        <Paso n={3}>Pulsa <b>«Añadir»</b> arriba a la derecha.</Paso>
        <div style={{ marginTop: 10, fontSize: 12.5, color: GRIS }}>Después abre OficioYa desde el icono nuevo y activa los avisos en Inicio.</div>
      </Burbuja>
    );
  } else if (plat === "ios_otro") {
    instrucciones = (
      <Burbuja retraso={1600}>
        Desde aquí el iPhone no deja instalarla. Ábrela en <b>Safari</b>:
        <Paso n={1}>Copia el enlace con el botón de abajo.</Paso>
        <Paso n={2}>Abre <b>Safari</b>, pégalo arriba y entra con tu cuenta.</Paso>
        <Paso n={3}>Pulsa <b>Compartir</b> <IconoCompartir /> → <b>«Añadir a pantalla de inicio»</b>.</Paso>
        {boton(copiado ? "✓ Enlace copiado" : "Copiar enlace", copiarEnlace, copiado ? VERDE : NARANJA)}
      </Burbuja>
    );
  } else if (plat === "android_app") {
    instrucciones = (
      <Burbuja retraso={1600}>
        Estás dentro de otra app (WhatsApp, Instagram…). Ábrela en <b>Chrome</b>:
        <Paso n={1}>Pulsa los <b>tres puntos ⋮</b> arriba a la derecha.</Paso>
        <Paso n={2}>Elige <b>«Abrir en Chrome»</b> (o «Abrir en el navegador»).</Paso>
        <Paso n={3}>Te aparecerá este mismo chat con el botón para instalar.</Paso>
        {boton(copiado ? "✓ Enlace copiado" : "Copiar enlace", copiarEnlace, copiado ? VERDE : NARANJA)}
      </Burbuja>
    );
  } else if (plat === "android") {
    instrucciones = (
      <Burbuja retraso={1600}>
        Instálala desde el menú del navegador:
        <Paso n={1}>Pulsa los <b>tres puntos ⋮</b> arriba a la derecha.</Paso>
        <Paso n={2}>Toca <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.</Paso>
        <Paso n={3}>Confirma con <b>«Instalar»</b>.</Paso>
      </Burbuja>
    );
  } else {
    instrucciones = (
      <Burbuja retraso={1600}>
        En el ordenador, pulsa el icono de <b>instalar</b> que aparece a la derecha de la barra de direcciones de Chrome o Edge.
        <div style={{ marginTop: 8, fontSize: 12.5, color: GRIS }}>Lo más útil es instalarla en el móvil: entra en aficioya.com/pro desde él y te saldrá este mismo chat.</div>
      </Burbuja>
    );
  }

  const abajo = "calc(86px + env(safe-area-inset-bottom, 0px))";
  return (
    <>
      <style>{`
        @keyframes oyEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes oySube{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:none}}
        @keyframes oyPunto{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
        @keyframes oyLatido{0%{box-shadow:0 0 0 0 ${NARANJA}66}70%{box-shadow:0 0 0 14px ${NARANJA}00}100%{box-shadow:0 0 0 0 ${NARANJA}00}}
      `}</style>

      {abierto ? (
        <div role="dialog" aria-label="Instalar la app de OficioYa" style={{
          position: "fixed", right: 12, left: "auto", bottom: abajo, zIndex: 1500, width: "min(360px, calc(100vw - 24px))",
          maxHeight: "calc(100dvh - 150px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 18,
          boxShadow: "0 18px 50px rgba(0,0,0,.35)", overflow: "hidden", fontFamily: F, animation: "oySube .3s cubic-bezier(.2,.9,.3,1.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "linear-gradient(135deg," + AMARILLO + "," + NARANJA + ")" }}>
            <img src="/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 10, background: "#fff" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#1A1300" }}>OficioYa</div>
              <div style={{ fontSize: 12, color: "#3A2A00", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0A7A3E" }} />Equipo de OficioYa</div>
            </div>
            <button onClick={posponer} aria-label="Cerrar" style={{ background: "rgba(0,0,0,.12)", border: "none", width: 30, height: 30, borderRadius: "50%", color: "#1A1300", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
            <Burbuja>¡Hola{primerNombre ? " " + primerNombre : ""}! 👋</Burbuja>
            <Burbuja retraso={800}>Instala la app de OficioYa en tu móvil y te avisamos <b>al momento</b> cuando entre un cliente nuevo, aunque tengas el móvil bloqueado.</Burbuja>
            {instrucciones}
          </div>
          {!hecho && (
            <div style={{ padding: "8px 14px 12px", borderTop: "1px solid #EEF0F4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11.5, color: GRIS }}>Gratis · ocupa menos de 1 MB</span>
              <button onClick={posponer} style={{ background: "none", border: "none", color: GRIS, fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 4 }}>Ahora no</button>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setAbierto(true)} aria-label="Instalar la app de OficioYa" style={{
          position: "fixed", right: 14, bottom: abajo, zIndex: 1500, width: 58, height: 58, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "linear-gradient(135deg," + AMARILLO + "," + NARANJA + ")", boxShadow: "0 8px 22px rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center",
          animation: visto ? "none" : "oyLatido 2s infinite",
        }}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#1A1300" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="7" y="2.5" width="10" height="19" rx="2.2" /><path d="M12 7.5v7" /><path d="M9.2 11.8 12 14.6l2.8-2.8" />
          </svg>
          {!visto && <span style={{ position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, background: "#FF3B30", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>1</span>}
        </button>
      )}
    </>
  );
}
