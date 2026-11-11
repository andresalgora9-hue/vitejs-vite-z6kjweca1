// ============================================================
// OficioYa · Panel PROFESIONAL — guía por pasos del PERFIL (11/11/2026)
// Sale la primera vez que el profesional abre «Perfil». Cada paso resalta un apartado de la pantalla
// y explica para qué sirve. Se puede omitir en cualquier momento («Omitir» o la tecla Esc) y volver
// a ver con el botón «Guía» de arriba del perfil.
// Los apartados se marcan en la pantalla con data-guia="..."; un paso sin «guia» sale centrado.
// ============================================================
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { C, F } from "./proComun";

export interface PasoGuia {
  guia?: string;              // data-guia del apartado que se resalta (sin él, el cuadro sale centrado)
  parte?: "datos" | "web";    // pestaña del perfil donde está ese apartado
  icono: React.ReactNode;
  titulo: string;
  texto: React.ReactNode;
  boton?: string;             // texto del botón principal (por defecto «Siguiente»)
  secundario?: string;        // en los cuadros centrados: texto del botón de salir (por defecto «Omitir»)
}

const MARGEN = 12;      // separación del cuadro con los bordes de la pantalla
const HUECO = 8;        // aire alrededor del apartado resaltado
const ALTO_CUADRO = 250; // alto del cuadro hasta medirlo, para decidir si va arriba o abajo

const ESTILOS = `
@keyframes oyGuiaEntra{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@keyframes oyGuiaFondo{from{opacity:0}to{opacity:1}}
@keyframes oyGuiaLatido{0%{box-shadow:0 0 0 0 rgba(255,215,0,.45)}70%{box-shadow:0 0 0 10px rgba(255,215,0,0)}100%{box-shadow:0 0 0 0 rgba(255,215,0,0)}}
`;

function buscar(guia?: string): HTMLElement | null {
  if (!guia) return null;
  return document.querySelector('[data-guia="' + guia + '"]') as HTMLElement | null;
}

type Caja = { top: number; left: number; width: number; height: number };
const medirEl = (el: HTMLElement): Caja => { const q = el.getBoundingClientRect(); return { top: q.top, left: q.left, width: q.width, height: q.height }; };

// Rectángulo con esquinas redondeadas, para recortar el hueco del fondo oscuro
function rectRedondo(x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}`
    + `H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
}

export default function ProPerfilGuia({ pasos, onTerminar, onParte }: {
  pasos: PasoGuia[];
  onTerminar: (completa: boolean) => void;
  onParte?: (parte: "datos" | "web") => void;
}) {
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [listo, setListo] = useState(false); // el apartado ya está en su sitio: se enseña el cuadro
  const [vista, setVista] = useState({ w: window.innerWidth, h: window.innerHeight });
  const principal = useRef<HTMLButtonElement>(null);
  const cuadro = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(ALTO_CUADRO);
  const paso = pasos[i];
  const numerados = pasos.filter((p) => p.guia);
  const n = paso.guia ? numerados.indexOf(paso) + 1 : 0;
  const ultimo = i === pasos.length - 1;

  // Al cambiar de paso: abre su pestaña, lleva el apartado a la vista y, cuando ha llegado, lo mide
  useEffect(() => {
    let vivo = true;
    const tiempos: number[] = [];
    setListo(false);
    if (paso.parte && onParte) onParte(paso.parte);
    if (!paso.guia) { setCaja(null); setListo(true); return; }
    tiempos.push(window.setTimeout(() => {
      if (!vivo) return;
      const el = buscar(paso.guia);
      if (!el) { setCaja(null); setListo(true); return; } // si no está en pantalla, el cuadro sale centrado
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // El apartado queda arriba y el cuadro debajo (si es muy alto, pegado arriba del todo)
      const destino = r.height > vh * 0.42 ? 64 : Math.max(70, Math.round(vh * 0.14));
      const delta = Math.round(r.top - destino);
      const contenedor = (el.closest("[data-scroll]") as HTMLElement | null) || (document.scrollingElement as HTMLElement | null);
      if (contenedor && Math.abs(delta) > 2) contenedor.scrollBy({ top: delta, behavior: "smooth" });
      tiempos.push(window.setTimeout(() => {
        if (!vivo) return;
        const x = buscar(paso.guia);
        setCaja(x ? medirEl(x) : null);
        setListo(true);
      }, Math.abs(delta) > 2 ? 460 : 0));
    }, 60));
    return () => { vivo = false; tiempos.forEach((t) => clearTimeout(t)); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si la pantalla cambia de tamaño o se mueve, el resaltado la sigue
  useEffect(() => {
    const medir = () => {
      setVista({ w: window.innerWidth, h: window.innerHeight });
      const el = buscar(paso.guia);
      if (el) setCaja(medirEl(el));
    };
    window.addEventListener("resize", medir);
    document.addEventListener("scroll", medir, true);
    return () => { window.removeEventListener("resize", medir); document.removeEventListener("scroll", medir, true); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Teclado: Esc omite, flechas o Intro avanzan / retroceden
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onTerminar(false); }
      else if (e.key === "ArrowRight") { e.preventDefault(); siguiente(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); atras(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  useEffect(() => { if (listo) principal.current?.focus({ preventScroll: true }); }, [i, listo]);

  // Alto real del cuadro (según lo largo que sea el texto), para colocarlo bien
  useLayoutEffect(() => {
    const h = cuadro.current ? cuadro.current.offsetHeight : 0;
    if (h && Math.abs(h - alto) > 2) setAlto(h);
  });

  const siguiente = () => { if (ultimo) onTerminar(true); else setI(i + 1); };
  const atras = () => { if (i > 0) setI(i - 1); };

  // ── Dónde va el cuadro ──
  const ancho = Math.min(vista.w - MARGEN * 2, 400);
  const izq = Math.round((vista.w - ancho) / 2);
  const centrado = !paso.guia || !caja;
  let posCuadro: React.CSSProperties = { inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: MARGEN };
  let flecha: { x: number; arriba: boolean } | null = null;
  const hueco = caja ? { x: caja.left - HUECO, y: caja.top - HUECO, w: caja.width + HUECO * 2, h: caja.height + HUECO * 2 } : null;
  if (!centrado && caja) {
    const abajo = vista.h - (caja.top + caja.height + HUECO);
    const arriba = caja.top - HUECO;
    const cx = Math.min(Math.max(caja.left + caja.width / 2 - izq, 26), ancho - 26);
    if (abajo >= alto + 18 || abajo >= arriba) {
      posCuadro = { left: izq, width: ancho, top: Math.min(caja.top + caja.height + HUECO + 14, vista.h - alto - MARGEN) };
      flecha = { x: cx, arriba: true };
    } else {
      posCuadro = { left: izq, width: ancho, bottom: Math.max(vista.h - caja.top + HUECO + 14, MARGEN) };
      flecha = { x: cx, arriba: false };
    }
  }

  const btnBase: React.CSSProperties = {
    minHeight: 44, borderRadius: 12, fontFamily: F, fontWeight: 800, fontSize: 14.5, cursor: "pointer", padding: "0 16px",
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="oy-guia-t" aria-describedby="oy-guia-d" style={{ position: "fixed", inset: 0, zIndex: 26000, fontFamily: F }}>
      <style>{ESTILOS}</style>

      {/* Fondo oscuro (recoge los toques para que no se pulse nada de debajo), con hueco sobre el apartado */}
      <svg aria-hidden="true" width={vista.w} height={vista.h} style={{ position: "absolute", inset: 0, display: "block", animation: "oyGuiaFondo .25s ease" }}>
        <path fillRule="evenodd" fill="rgba(5,7,12,0.78)"
          d={"M0 0H" + vista.w + "V" + vista.h + "H0Z" + (listo && !centrado && hueco ? " " + rectRedondo(hueco.x, hueco.y, hueco.w, hueco.h, 18) : "")} />
      </svg>
      {listo && !centrado && hueco && (
        <div aria-hidden="true" style={{
          position: "absolute", top: hueco.y, left: hueco.x, width: hueco.w, height: hueco.h, boxSizing: "border-box",
          borderRadius: 18, border: "2px solid rgba(255,215,0,0.95)", pointerEvents: "none",
          animation: "oyGuiaLatido 1.6s ease-out .2s 2",
        }} />
      )}

      {/* Cuadro de la explicación */}
      {listo && (
      <div key={i} style={{ position: "absolute", boxSizing: "border-box", ...posCuadro }}>
      <div ref={cuadro} style={{
        position: "relative", width: ancho, boxSizing: "border-box",
        background: "linear-gradient(180deg,#1C1F28 0%,#15171E 100%)", border: "1px solid rgba(255,215,0,0.28)", borderRadius: 18,
        padding: centrado ? "26px 20px 18px" : "16px 16px 14px", color: C.text,
        boxShadow: "0 24px 60px -12px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)",
        animation: "oyGuiaEntra .26s ease both",
      }}>
        {flecha && (
          <span aria-hidden="true" style={{
            position: "absolute", left: flecha.x - 8, width: 16, height: 16, background: flecha.arriba ? "#1C1F28" : "#15171E",
            borderLeft: "1px solid rgba(255,215,0,0.28)", borderTop: "1px solid rgba(255,215,0,0.28)",
            transform: flecha.arriba ? "rotate(45deg)" : "rotate(225deg)", ...(flecha.arriba ? { top: -9 } : { bottom: -9 }),
          }} />
        )}

        {centrado ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,rgba(255,215,0,0.16),rgba(255,140,0,0.10))", border: "1px solid rgba(255,215,0,0.3)", color: C.accent,
            }}>{paso.icono}</div>
            <h2 id="oy-guia-t" style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 900, letterSpacing: "-0.02em" }}>{paso.titulo}</h2>
            <div id="oy-guia-d" aria-live="polite" style={{ fontSize: 14.5, lineHeight: 1.6, color: C.mutedL, marginBottom: 20 }}>{paso.texto}</div>
            <button ref={principal} onClick={siguiente} style={{
              ...btnBase, width: "100%", minHeight: 48, border: "none", color: "#1A1200", fontWeight: 900, fontSize: 15.5,
              background: "linear-gradient(135deg,#FFFFFF 0%,#F0E6C0 45%,#FFD700 100%)", boxShadow: "0 12px 28px -14px rgba(255,200,0,0.8)",
            }}>{paso.boton || "Siguiente"}</button>
            {!ultimo && (
              <button onClick={() => onTerminar(false)} style={{ ...btnBase, width: "100%", marginTop: 6, border: "none", background: "transparent", color: C.muted, fontWeight: 700 }}>
                {paso.secundario || "Omitir"}
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.26)", color: C.accent,
              }}>{paso.icono}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent }}>
                Paso {n} de {numerados.length}
              </span>
              <span style={{ display: "flex", gap: 4 }} aria-hidden="true">
                {numerados.map((_, k) => (
                  <span key={k} style={{
                    width: k === n - 1 ? 16 : 6, height: 6, borderRadius: 99, transition: "all .25s",
                    background: k === n - 1 ? C.accent : k < n - 1 ? "rgba(255,215,0,0.45)" : "rgba(255,255,255,0.16)",
                  }} />
                ))}
              </span>
            </div>
            <h2 id="oy-guia-t" style={{ margin: "0 0 6px", fontSize: 18.5, fontWeight: 900, letterSpacing: "-0.015em" }}>{paso.titulo}</h2>
            <div id="oy-guia-d" aria-live="polite" style={{ fontSize: 14.5, lineHeight: 1.55, color: C.mutedL }}>{paso.texto}</div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
              <button onClick={() => onTerminar(false)} style={{
                ...btnBase, flex: 1, textAlign: "left", padding: "0 4px", border: "none", background: "transparent", color: C.muted, fontWeight: 700, fontSize: 14,
              }}>Omitir</button>
              {n > 1 && (
                <button onClick={atras} style={{ ...btnBase, border: "1px solid " + C.border, background: "transparent", color: C.text }}>Atrás</button>
              )}
              <button ref={principal} onClick={siguiente} style={{
                ...btnBase, border: "none", color: "#1A1200", fontWeight: 900, padding: "0 20px",
                background: "linear-gradient(135deg,#FFFFFF 0%,#F0E6C0 45%,#FFD700 100%)", boxShadow: "0 10px 24px -14px rgba(255,200,0,0.8)",
              }}>{paso.boton || "Siguiente"}</button>
            </div>
          </>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
