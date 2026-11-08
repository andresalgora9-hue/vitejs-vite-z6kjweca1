// ============================================================
// OficioYa · ÁREA DEL CLIENTE — Guía paso a paso (como el tutorial de un juego)
// Se abre sola al llegar desde una landing (y la primera vez que el cliente entra en su área
// en ese móvil). Cada paso señala la parte real de la pantalla. Se puede saltar en cualquier momento.
// Pasos: bienvenida · crear acceso (correo + contraseña) · tu solicitud · presupuestos · calcular ·
// mensajes · instalar la app (y avisos).
// ============================================================
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Cliente, Solicitud } from "./clienteComun";
import { Icono, Avatar, primerNombre, nombreOficio, telBonito, enlaceTel, avisosPosibles } from "./clienteComun";
import { TarjetaAcceso } from "./ClientePerfil";
import { InstruccionesInstalar, type DatosBienvenida } from "./ClienteExtras";

type Clave = "hola" | "acceso" | "solicitud" | "presupuestos" | "calcular" | "mensajes" | "app";
const SEL: Partial<Record<Clave, string>> = {
  solicitud: '[data-guia="solicitud"]',
  presupuestos: '[data-guia="tab-presupuestos"]',
  calcular: '[data-guia="tab-calcular"]',
  mensajes: '[data-guia="chat"]',
};
const TEXTOS: Partial<Record<Clave, { t: string; d: string }>> = {
  presupuestos: { t: "Guarda tus presupuestos", d: "Apunta los que te den, de OficioYa o de otros, con foto o PDF. Te marcamos el más barato y si el precio es justo." },
  calcular: { t: "Calcula el precio", d: "Mira cuánto suele costar pintar un piso o arreglar una fuga, para que no te cobren de más." },
  mensajes: { t: "¿Dudas? Escríbenos", d: "Te responde una persona del equipo de OficioYa, no un robot." },
};

export default function ClienteGuia({ user, sol, datos, recienLlegado, faltaAcceso, avisosOn, onUpdate, onAccesoCreado, onAvisos, onIrInicio, onIrAcceso, onCerrar }: {
  user: Cliente; sol: Solicitud | null; datos: DatosBienvenida | null; recienLlegado: boolean; faltaAcceso: boolean; avisosOn: boolean;
  onUpdate: (u: Cliente) => void; onAccesoCreado: (tipo: "clave" | "enlace") => void; onAvisos: () => void;
  onIrInicio: () => void; onIrAcceso: () => void; onCerrar: (terminada: boolean) => void;
}) {
  // Los pasos se fijan al abrir la guía (si crea el acceso a mitad, el contador no cambia)
  const pasos = useRef<Clave[]>(["hola", ...(faltaAcceso ? (["acceso"] as Clave[]) : []), "solicitud", "presupuestos", "calcular", "mensajes", "app"]).current;
  const [i, setI] = useState(0);
  const clave = pasos[i];
  const total = pasos.length;
  const ir = (n: number) => setI(Math.max(0, Math.min(total - 1, n)));
  const siguiente = () => (i >= total - 1 ? onCerrar(true) : ir(i + 1));
  // Si va a crear el acceso desde el último paso (iPhone), al terminar vuelve a ese paso
  const volverA = useRef<number | null>(null);
  const trasAcceso = () => { const v = volverA.current; volverA.current = null; if (v != null) ir(v); else siguiente(); };

  useEffect(() => { onIrInicio(); }, []);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(false); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  // ── Dónde está lo que se señala (y seguirlo si se mueve) ──
  const [foco, setFoco] = useState<{ r: DOMRect | null; listo: boolean; tipo: string | null }>({ r: null, listo: true, tipo: null });
  useEffect(() => {
    const sel = SEL[clave];
    if (!sel) { setFoco({ r: null, listo: true, tipo: null }); return; }
    setFoco({ r: null, listo: false, tipo: null });
    let vivo = true, intentos = 0, el: HTMLElement | null = null;
    const relojes: ReturnType<typeof setTimeout>[] = [];
    const sc = document.querySelector("[data-scroll]") as HTMLElement | null;
    const medir = () => {
      if (!vivo) return;
      if (!el || !el.isConnected) el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setFoco({ r, listo: true, tipo: el.getAttribute("data-guia-tipo") });
    };
    const buscar = () => {
      if (!vivo) return;
      el = document.querySelector(sel) as HTMLElement | null;
      if (!el) {
        if (intentos++ < 14) relojes.push(setTimeout(buscar, 150));
        else setFoco({ r: null, listo: true, tipo: null }); // no está en pantalla: la tarjeta sale centrada
        return;
      }
      const r = el.getBoundingClientRect();
      const fijo = !!el.closest(".cy-tabs, .cy-cab");
      if (!fijo && sc && (r.top < 84 || r.bottom > window.innerHeight - 130)) {
        sc.scrollTo({ top: Math.max(0, sc.scrollTop + r.top - 84), behavior: "smooth" });
        relojes.push(setTimeout(medir, 380), setTimeout(medir, 760));
      } else medir();
    };
    relojes.push(setTimeout(buscar, 60));
    window.addEventListener("resize", medir);
    sc?.addEventListener("scroll", medir, { passive: true });
    return () => { vivo = false; relojes.forEach(clearTimeout); window.removeEventListener("resize", medir); sc?.removeEventListener("scroll", medir); };
  }, [clave]);

  // Alto real de la tarjeta, para colocarla donde quepa entera
  const cardRef = useRef<HTMLDivElement>(null);
  const [altoCard, setAltoCard] = useState(0);
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight || 0;
    if (h && Math.abs(h - altoCard) > 2) setAltoCard(h);
  });

  const cabecera = (
    <>
      <div className="cy-between" style={{ marginBottom: 10 }}>
        <span className="cy-mini" style={{ fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "#FFE38A" }}>Paso {i + 1} de {total}</span>
        {i < total - 1 && <button className="cy-link" style={{ padding: "2px 0", color: "var(--ink3)", fontSize: 13.5 }} onClick={() => onCerrar(false)}>Saltar guía</button>}
      </div>
      <div className="cy-guia-barra" aria-hidden="true">{pasos.map((_, n) => <i key={n} className={n <= i ? "on" : ""} />)}</div>
    </>
  );

  // ── Pasos con ventana (bienvenida, acceso e instalar) ──
  if (clave === "hola" || clave === "acceso" || clave === "app") {
    const nom = primerNombre(user.name);
    let cuerpo: React.ReactNode;
    if (clave === "hola") {
      const proNombre = sol?.pro && !sol.anulado ? sol.pro.nombre : (datos?.profesional || "");
      const proTel = sol?.pro?.telefono || (datos?.telefono && !/656398014/.test(datos.telefono) ? datos.telefono : "");
      const oficio = nombreOficio(sol?.oficio || datos?.oficio || "").toLowerCase();
      cuerpo = recienLlegado ? (
        <>
          <div style={{ width: 74, height: 74, margin: "0 auto", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,214,143,.14)", border: "1px solid rgba(0,214,143,.45)", color: "var(--green)" }}><Icono n="check" s={34} w={2.6} /></div>
          <h2 id="cy-guia-t" className="cy-h1" style={{ fontSize: 28, marginTop: 16 }}>¡Listo{nom ? ", " + nom : ""}!</h2>
          <p className="cy-sub" style={{ marginTop: 8 }}>Tu solicitud{oficio && oficio !== "otro" ? " de " + oficio : ""} está en marcha. {proNombre ? proNombre + " ya la tiene y te llamará para darte el presupuesto." : "Te llamamos en breve para darte el presupuesto."}</p>
          {proNombre && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: 12, borderRadius: 18, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", textAlign: "left" }}>
              <Avatar nombre={proNombre} url={sol?.pro?.avatar} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontWeight: 800 }}>{proNombre}</p><p className="cy-mini">Tu profesional{proTel ? " · " + telBonito(proTel) : ""}</p></div>
              <span className="cy-pill ok"><Icono n="escudo" s={12} />Comprobado</span>
            </div>
          )}
          {proTel && <a className="cy-btn-g cy-full" style={{ marginTop: 12 }} href={enlaceTel(proTel)}><Icono n="tel" s={17} />Llamar a {proNombre || "tu profesional"}</a>}
          <p className="cy-mini" style={{ marginTop: 16, color: "var(--soft)" }}>Te enseñamos tu área en un minuto.</p>
          <button className="cy-btn" style={{ marginTop: 10 }} onClick={siguiente}>Empezar <Icono n="flecha" s={18} w={2.4} /></button>
        </>
      ) : (
        <>
          <img src="/icon-192.png" alt="" width={70} height={70} style={{ borderRadius: 20, margin: "0 auto", boxShadow: "0 18px 40px -16px rgba(255,160,0,.7)" }} />
          <h2 id="cy-guia-t" className="cy-h1" style={{ fontSize: 27, marginTop: 16 }}>{nom ? <>Hola, <span>{nom}</span></> : <>Tu área de <span>cliente</span></>}</h2>
          <p className="cy-sub" style={{ marginTop: 8 }}>Aquí sigues tus solicitudes, guardas tus presupuestos y calculas precios. Te la enseñamos en un minuto.</p>
          <button className="cy-btn" style={{ marginTop: 18 }} onClick={siguiente}>Empezar <Icono n="flecha" s={18} w={2.4} /></button>
        </>
      );
    } else if (clave === "acceso") {
      cuerpo = (
        <>
          <div style={{ width: 66, height: 66, margin: "0 auto", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--grad)", color: "#1A1200", boxShadow: "0 18px 40px -14px rgba(255,160,0,.8)" }}><Icono n="candado" s={30} w={2.2} /></div>
          <h2 id="cy-guia-t" className="cy-h1" style={{ fontSize: 26, marginTop: 14 }}>Crea tu <span>acceso</span></h2>
          <p className="cy-sub" style={{ marginTop: 6 }}>Pon tu correo y una contraseña. Así entras desde cualquier móvil y no pierdes tu solicitud.</p>
          <div style={{ marginTop: 14, textAlign: "left" }}>
            <TarjetaAcceso user={user} onUpdate={onUpdate} foco={0} compacta
              onHecho={(tipo) => { onAccesoCreado(tipo); setTimeout(trasAcceso, 350); }} />
          </div>
          <button className="cy-link" style={{ marginTop: 6, color: "var(--ink3)" }} onClick={trasAcceso}>Ahora no</button>
        </>
      );
    } else {
      const conAvisos = avisosPosibles() && !avisosOn;
      const iAcceso = pasos.indexOf("acceso");
      cuerpo = (
        <>
          <img src="/icon-192.png" alt="" width={66} height={66} style={{ borderRadius: 19, margin: "0 auto", boxShadow: "0 18px 40px -16px rgba(255,160,0,.7)" }} />
          <h2 id="cy-guia-t" className="cy-h1" style={{ fontSize: 26, marginTop: 14 }}>Llévatela <span>en el móvil</span></h2>
          <p className="cy-sub" style={{ marginTop: 6 }}>Instala OficioYa en tu pantalla de inicio{conAvisos ? " y activa los avisos" : ""}: te avisamos cuando el profesional te responda.</p>
          <div style={{ marginTop: 14, textAlign: "left" }}>
            <InstruccionesInstalar faltaAcceso={faltaAcceso} onAcceso={() => { if (iAcceso >= 0) { volverA.current = i; ir(iAcceso); } else { onCerrar(false); onIrAcceso(); } }} />
          </div>
          {conAvisos && <button className="cy-btn-s cy-full" style={{ marginTop: 10 }} onClick={onAvisos}><Icono n="campana" s={18} />Activar avisos</button>}
          <button className="cy-btn-g cy-full" style={{ marginTop: 10 }} onClick={() => onCerrar(true)}>Terminar</button>
        </>
      );
    }
    return (
      <div className="cy-guia" role="dialog" aria-modal="true" aria-labelledby="cy-guia-t">
        <div className="cy-guia-velo" />
        <div className="cy-guia-centro">
          <div className="cy-hoja cy-guia-caja">
            <div className="cy-hoja-cuerpo cy-entra" key={clave} style={{ textAlign: "center", paddingTop: 18, paddingBottom: 22 }}>
              <div style={{ textAlign: "left", marginBottom: 16 }}>{cabecera}</div>
              {cuerpo}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Pasos que señalan la pantalla ──
  if (!foco.listo) return <div className="cy-guia" aria-hidden="true" />;
  const vw = window.innerWidth, vh = window.innerHeight;
  const W = Math.min(400, vw - 32);
  const izq = Math.round((vw - W) / 2);
  const r = foco.r;
  const pad = 8;
  let hueco: React.CSSProperties | null = null;
  let estilo: React.CSSProperties = { top: Math.max(16, Math.round(vh / 2 - 130)) };
  let flecha: React.CSSProperties | null = null;
  if (r) {
    const top = r.top - pad, alto = r.height + pad * 2;
    hueco = { top, left: r.left - pad, width: r.width + pad * 2, height: alto, borderRadius: Math.min(26, Math.max(14, alto / 3)) };
    const H = altoCard || 240;
    const abajo = vh - (top + alto) - 22, arriba = top - 22;
    const fx = Math.max(22, Math.min(W - 22, r.left + r.width / 2 - izq));
    if (H <= abajo) { estilo = { top: top + alto + 14 }; flecha = { left: fx - 8, top: -9 }; }
    else if (H <= arriba) { estilo = { bottom: vh - top + 14 }; flecha = { left: fx - 8, bottom: -9, transform: "rotate(225deg)" }; }
    else estilo = { bottom: "calc(12px + env(safe-area-inset-bottom))" }; // no cabe ni arriba ni abajo: abajo del todo
  }
  let t = "", d = "";
  if (clave === "solicitud") {
    if (foco.tipo === "pedir") { t = "Pide aquí tu presupuesto"; d = "Elige qué necesitas y te asignamos un profesional de tu zona. Gratis y sin compromiso."; }
    else { t = "Aquí ves cómo va"; d = "Tu solicitud paso a paso: cuándo te llama el profesional y cuánto te pide. En «Solicitudes» tienes todas."; }
  } else { t = TEXTOS[clave]?.t || ""; d = TEXTOS[clave]?.d || ""; }

  return (
    <div className="cy-guia" role="dialog" aria-modal="true" aria-labelledby="cy-guia-t">
      {hueco ? <div className="cy-guia-hueco" style={hueco} /> : <div className="cy-guia-velo" />}
      <div className="cy-guia-card" key={clave} ref={cardRef} style={{ ...estilo, left: izq, width: W }}>
        {flecha && <span className="cy-guia-flecha" style={flecha} />}
        {cabecera}
        <h3 id="cy-guia-t" className="cy-h2" style={{ marginTop: 14 }}>{t}</h3>
        <p className="cy-sub" style={{ marginTop: 6 }}>{d}</p>
        <div className="cy-two" style={{ marginTop: 14 }}>
          <button className="cy-btn-g" onClick={() => ir(i - 1)}>Atrás</button>
          <button className="cy-btn cy-btn-sm" style={{ minHeight: 46, borderRadius: 14 }} onClick={siguiente}>Siguiente <Icono n="flecha" s={17} w={2.4} /></button>
        </div>
      </div>
    </div>
  );
}
