// ============================================================
// OficioYa · Panel PROFESIONAL — condiciones de su web (11/11/2026)
// Al terminar (u omitir) la guía del Perfil, el profesional acepta las condiciones de su web:
// 15 € + IVA por cada cliente que le llegue por ella. El texto, la versión y su huella vienen de la base
// (oy_condiciones_web) y la aceptación se guarda con todas las pruebas (oy_condiciones_web_aceptar):
// hora del servidor, IP, navegador, dispositivo, sesión y el texto exacto. El justificante en PDF con
// sello de tiempo lo guarda solo el servidor en Admin → Archivos y se le manda por email.
// Si pulsa «Ahora no», los clientes de su web le siguen llegando pero a su precio normal (decisión de Andrés,
// 11/11: lo hace pro_leads_precio_pro), y se le vuelve a pedir la próxima vez que entre en Perfil.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { db } from "../supabase";
import { C, F, TZ } from "./proComun";

export interface CondicionesWeb {
  vigente: {
    version: string; titulo: string; resumen: string[]; texto: string; sha256: string;
    precio: number; iva_pct: number; precio_iva: number;
  } | null;
  aceptada: { id: string; aceptado_at: string; version: string; origen: string; email: boolean; justificante: boolean } | null;
  anterior: { version: string; aceptado_at: string } | null;
  pendiente: boolean;
}
export type OrigenCondiciones = "guia_perfil" | "guia_perfil_omitida" | "perfil" | "mi_web" | "contrato" | "falta";

// ── Formato ─────────────────────────────────────────────────
export const eurosWeb = (n: number) => {
  const x = Math.round((Number(n) || 0) * 100) / 100;
  return (Number.isInteger(x) ? String(x) : x.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + " €";
};
export const cuandoAceptada = (iso: string) => {
  const d = new Date(iso);
  const f = d.toLocaleDateString("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
  const h = d.toLocaleTimeString("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return f + " a las " + h;
};

const MENSAJES_OK = [
  "Las condiciones han cambiado", "Marca la casilla", "Solo puedes aceptar", "Cuenta no válida", "Ahora mismo no hay condiciones",
];
function textoError(e: any): string {
  const m = String(e?.message || "");
  if (MENSAJES_OK.some((x) => m.startsWith(x))) return m;
  if (/fetch|network|Load failed/i.test(m)) return "Sin conexión. Comprueba tu internet e inténtalo de nuevo.";
  return "No se ha podido guardar. Inténtalo de nuevo y, si sigue sin ir, escríbenos.";
}

async function huella(t: string): Promise<string | null> {
  try {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}

// Lo que se guarda del dispositivo como prueba (además de la IP y el navegador que ve el servidor)
function dispositivo() {
  const n: any = navigator;
  const pad = (x: number) => String(x).padStart(2, "0");
  const d = new Date();
  const off = -d.getTimezoneOffset();
  let zona = "";
  try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* nada */ }
  let instalada = false;
  try { instalada = n.standalone === true || window.matchMedia("(display-mode: standalone)").matches; } catch { /* nada */ }
  return {
    ua: n.userAgent || "",
    idioma: (Array.isArray(n.languages) && n.languages.length ? n.languages.slice(0, 3).join(", ") : n.language) || "",
    zona_horaria: zona,
    pantalla: (window.screen ? window.screen.width + "x" + window.screen.height : "") + (window.devicePixelRatio ? " @" + window.devicePixelRatio + "x" : ""),
    plataforma: (n.userAgentData && n.userAgentData.platform) || n.platform || "",
    app_instalada: String(instalada),
    hora: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} UTC${off >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`,
  };
}

// ── Iconos ──────────────────────────────────────────────────
const TRAZOS: Record<string, React.ReactNode> = {
  web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" /></>,
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  flecha: <path d="M9 6l6 6-6 6" />,
  contrato: <><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" /><path d="M14 3.5v5h5" /><path d="M8.5 16.2c1.4-1.9 2.5-1.9 3.2 0 .5 1.2 1.5 1.2 3-.6" /></>,
  aviso: <><path d="M12 4l9 16H3z" /><path d="M12 10v4.5" /><path d="M12 17.4v.1" /></>,
  candado: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
};
function Icono({ n, s = 20, grosor = 1.9, style }: { n: string; s?: number; grosor?: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
      {TRAZOS[n]}
    </svg>
  );
}

const btnBase: React.CSSProperties = {
  minHeight: 48, borderRadius: 12, fontFamily: F, fontWeight: 900, fontSize: 15.5, cursor: "pointer", padding: "0 16px", width: "100%",
};
const btnOro: React.CSSProperties = {
  ...btnBase, border: "none", color: "#1A1200",
  background: "linear-gradient(135deg,#FFFFFF 0%,#F0E6C0 45%,#FFD700 100%)", boxShadow: "0 12px 28px -14px rgba(255,200,0,0.8)",
};
const btnTexto: React.CSSProperties = { ...btnBase, minHeight: 44, marginTop: 4, border: "none", background: "transparent", color: C.muted, fontWeight: 700, fontSize: 14.5 };

function TextoCompleto({ texto, alto = "38vh" }: { texto: string; alto?: string }) {
  return (
    <div tabIndex={0} aria-label="Texto completo de las condiciones" style={{
      marginTop: 10, maxHeight: alto, overflowY: "auto", WebkitOverflowScrolling: "touch" as any, whiteSpace: "pre-wrap",
      fontSize: 13, lineHeight: 1.6, color: C.mutedL, background: C.bg, border: "1px solid " + C.border, borderRadius: 12, padding: "12px 13px",
    }}>{texto}</div>
  );
}

// ════════════════════════════════════════════════════════════
// Ventana para leer y aceptar las condiciones
// ════════════════════════════════════════════════════════════
export default function ProCondicionesWeb({ proId, nombre, datos, origen, onCerrar, onAceptada }: {
  proId: string;
  nombre?: string;
  datos: CondicionesWeb;
  origen: OrigenCondiciones;
  onCerrar: (aceptada: boolean) => void;
  onAceptada?: (r: { id: string; aceptado_at: string; version: string }) => void;
}) {
  const v = datos.vigente!;
  const [paso, setPaso] = useState<"leer" | "salir" | "hecho">("leer");
  const [marcada, setMarcada] = useState(false);
  const [verTexto, setVerTexto] = useState(false);
  const [leyo, setLeyo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecha, setHecha] = useState<{ aceptado_at: string } | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const bloqueTexto = useRef<HTMLDivElement>(null);
  const desdeGuia = origen === "guia_perfil" || origen === "guia_perfil_omitida";
  const cambiaron = !!datos.anterior;

  // Esc: primero pregunta si quiere salir sin aceptar
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || enviando) return;
      e.preventDefault();
      if (paso === "leer") setPaso("salir");
      else if (paso === "salir") onCerrar(false);
      else onCerrar(true);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });
  useEffect(() => { caja.current?.scrollTo({ top: 0 }); caja.current?.focus({ preventScroll: true }); }, [paso]);
  // Al desplegar el texto completo, se sube para que se vea desde el principio
  useEffect(() => {
    if (!verTexto) return;
    const t = setTimeout(() => {
      const c = caja.current, b = bloqueTexto.current;
      if (c && b) c.scrollBy({ top: b.getBoundingClientRect().top - c.getBoundingClientRect().top - 6, behavior: "smooth" });
    }, 30);
    return () => clearTimeout(t);
  }, [verTexto]);

  const aceptar = async () => {
    if (!marcada || enviando) return;
    setEnviando(true); setError(null);
    try {
      const enPantalla = await huella(v.texto);
      const { data, error: e } = await db.rpc("oy_condiciones_web_aceptar", {
        p_pro: proId,
        p: { acepto: true, version: v.version, sha256: v.sha256, sha256_pantalla: enPantalla, origen, leyo: String(leyo), ...dispositivo() },
      });
      if (e || !(data as any)?.ok) throw e || new Error("");
      setHecha(data as any);
      setPaso("hecho");
      onAceptada?.(data as any);
    } catch (e) {
      setError(textoError(e));
    }
    setEnviando(false);
  };

  const nombre1 = (nombre || "").trim().split(/\s+/)[0];
  const etiqueta = paso !== "leer" ? null : desdeGuia ? "Último paso" : cambiaron ? "Han cambiado" : "Tu web";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="oy-cw-t" style={{
      position: "fixed", inset: 0, zIndex: 26000, fontFamily: F, background: "rgba(5,7,12,0.82)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12, boxSizing: "border-box",
    }}>
      <style>{"@keyframes oyCwEntra{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}"}</style>
      <div key={paso} style={{
        width: "100%", maxWidth: 440, maxHeight: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box",
        background: "linear-gradient(180deg,#1C1F28 0%,#15171E 100%)", border: "1px solid rgba(255,215,0,0.28)", borderRadius: 18, color: C.text,
        boxShadow: "0 24px 60px -12px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)", animation: "oyCwEntra .26s ease both", overflow: "hidden",
      }}>
        {/* ── Contenido (se desplaza si no cabe) ── */}
        <div ref={caja} tabIndex={-1} style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" as any, padding: "24px 20px 14px", outline: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 60, height: 60, borderRadius: 18, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center",
              background: paso === "hecho" ? C.green + "1F" : paso === "salir" ? C.orange + "1A" : "linear-gradient(135deg,rgba(255,215,0,0.16),rgba(255,140,0,0.10))",
              border: "1px solid " + (paso === "hecho" ? C.green + "55" : paso === "salir" ? C.orange + "55" : "rgba(255,215,0,0.3)"),
              color: paso === "hecho" ? C.green : paso === "salir" ? C.orange : C.accent,
            }}><Icono n={paso === "hecho" ? "check" : paso === "salir" ? "aviso" : "contrato"} s={28} grosor={paso === "hecho" ? 2.6 : 1.9} /></div>
            {etiqueta && (
              <div style={{ display: "inline-block", marginBottom: 10, fontSize: 11.5, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1A1200", background: C.accent, borderRadius: 99, padding: "4px 10px" }}>{etiqueta}</div>
            )}
          </div>

          {paso === "leer" && (
            <>
              <h2 id="oy-cw-t" style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 900, letterSpacing: "-0.02em", textAlign: "center" }}>
                {cambiaron ? "Hemos actualizado las condiciones de tu web" : "Las condiciones de tu web"}
              </h2>
              <p style={{ margin: "0 0 16px", fontSize: 14.5, lineHeight: 1.55, color: C.mutedL, textAlign: "center" }}>
                Acéptalas y cada cliente que te llegue por tu web te costará solo esto.
              </p>

              <div style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: 14, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em", color: C.text }}>{eurosWeb(v.precio)}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#FFE38A" }}>+ IVA</span>
                </div>
                <div style={{ fontSize: 13.5, color: C.mutedL, marginTop: 2 }}>por cada cliente que te llegue por tu web</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>({eurosWeb(v.precio_iva)} con IVA)</div>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0" }}>
                {(v.resumen || []).map((t, i) => (
                  <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, color: C.text, padding: "6px 0" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: C.green + "1F", color: C.green }}>
                      <Icono n="check" s={12} grosor={3} />
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>

              <div ref={bloqueTexto}>
                <button onClick={() => { setVerTexto(!verTexto); setLeyo(true); }} aria-expanded={verTexto} style={{
                  display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: "10px 0 0", cursor: "pointer",
                  color: C.accent, fontFamily: F, fontWeight: 800, fontSize: 14,
                }}>
                  <Icono n="flecha" s={16} style={{ transform: verTexto ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
                  {verTexto ? "Ocultar" : "Leer"} las condiciones completas
                </button>
                {verTexto && <TextoCompleto texto={v.texto} />}
              </div>
            </>
          )}

          {paso === "salir" && (
            <>
              <h2 id="oy-cw-t" style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 900, letterSpacing: "-0.02em", textAlign: "center" }}>¿Las dejas para otro momento?</h2>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: C.mutedL, textAlign: "center" }}>
                Sin aceptarlas, los clientes de tu web te siguen llegando, pero cada uno te cuesta lo mismo que el resto de
                tus clientes, no {eurosWeb(v.precio)} + IVA. Te lo volveremos a preguntar la próxima vez que entres en tu perfil.
              </p>
            </>
          )}

          {paso === "hecho" && (
            <>
              <h2 id="oy-cw-t" style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 900, letterSpacing: "-0.02em", textAlign: "center" }}>
                ¡Hecho{nombre1 ? ", " + nombre1 : ""}!
              </h2>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: C.mutedL, textAlign: "center" }}>
                Aceptaste las condiciones de tu web el <b style={{ color: C.text }}>{cuandoAceptada(hecha?.aceptado_at || new Date().toISOString())}</b>.
                Te mandamos una copia a tu email y siempre las tienes en <b style={{ color: C.text }}>Perfil › Contrato y condiciones</b>.
              </p>
            </>
          )}
        </div>

        {/* ── Pie fijo: casilla y botones ── */}
        <div style={{ padding: "12px 20px 16px", borderTop: paso === "leer" ? "1px solid " + C.border : "none", background: "rgba(0,0,0,0.12)" }}>
          {paso === "leer" && (
            <>
              <label style={{ display: "flex", gap: 11, alignItems: "flex-start", cursor: "pointer", marginBottom: 12 }}>
                <input type="checkbox" checked={marcada} onChange={(e) => { setMarcada(e.target.checked); setError(null); }}
                  style={{ width: 22, height: 22, margin: "1px 0 0", accentColor: C.accent, flexShrink: 0, cursor: "pointer" }} />
                <span style={{ fontSize: 14.5, lineHeight: 1.45, color: C.text, fontWeight: 700 }}>
                  He leído y acepto las condiciones de mi web
                  <span style={{ display: "block", fontSize: 12, color: C.muted, fontWeight: 600, marginTop: 2 }}>Versión {v.version}</span>
                </span>
              </label>
              {error && <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: C.red, margin: "0 0 10px", lineHeight: 1.45 }}>{error}</div>}
              <button onClick={aceptar} disabled={!marcada || enviando} style={{
                ...btnOro, ...(!marcada || enviando ? { background: C.border, color: C.muted, boxShadow: "none", cursor: "not-allowed" } : {}),
              }}>{enviando ? "Guardando…" : "Aceptar"}</button>
              <button onClick={() => setPaso("salir")} disabled={enviando} style={btnTexto}>Ahora no</button>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start", justifyContent: "center", fontSize: 11.5, color: C.muted, lineHeight: 1.45, marginTop: 6, textAlign: "left" }}>
                <Icono n="candado" s={13} style={{ marginTop: 1 }} />
                <span>Guardamos la fecha, la hora, tu IP y tu dispositivo como prueba de tu aceptación.</span>
              </div>
            </>
          )}
          {paso === "salir" && (
            <>
              <button onClick={() => setPaso("leer")} style={btnOro}>Volver a las condiciones</button>
              <button onClick={() => onCerrar(false)} style={btnTexto}>Salir sin aceptar</button>
            </>
          )}
          {paso === "hecho" && <button onClick={() => onCerrar(true)} style={btnOro}>Ver mi perfil</button>}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Piezas para el Perfil
// ════════════════════════════════════════════════════════════

/** En «Mi web»: aviso para aceptarlas (o confirmación de que ya están aceptadas) */
export function AvisoCondicionesWeb({ datos, onAbrir }: { datos: CondicionesWeb | null; onAbrir: () => void }) {
  if (!datos?.vigente) return null;
  const v = datos.vigente;
  if (!datos.pendiente) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 12px", borderRadius: 12, background: C.green + "12", border: "1px solid " + C.green + "40", fontSize: 13, color: C.mutedL, lineHeight: 1.45 }}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: C.green + "26", color: C.green }}>
          <Icono n="check" s={13} grosor={3} />
        </span>
        <span><b style={{ color: C.text }}>Condiciones aceptadas</b> · {eurosWeb(v.precio)} + IVA por cada cliente que te llegue por tu web</span>
      </div>
    );
  }
  return (
    <div data-guia="condiciones-web" style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "linear-gradient(160deg,rgba(255,140,0,0.12) 0%,rgba(26,28,36,1) 70%)", border: "1px solid " + C.orange + "66" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: C.orange + "1F", border: "1px solid " + C.orange + "55", color: C.orange }}>
          <Icono n="web" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", color: C.text, fontWeight: 900, fontSize: 15.5 }}>{datos.anterior ? "Han cambiado las condiciones de tu web" : "Acepta las condiciones de tu web"}</span>
          <span style={{ display: "block", color: C.mutedL, fontSize: 13, lineHeight: 1.5, marginTop: 3 }}>
            Acéptalas y cada cliente que te llegue por tu web te costará {eurosWeb(v.precio)} + IVA. Hasta entonces, te cuesta lo mismo que el resto de tus clientes.
          </span>
        </span>
      </div>
      <button onClick={onAbrir} style={{ ...btnOro, minHeight: 44, fontSize: 14.5, marginTop: 12 }}>Ver las condiciones</button>
    </div>
  );
}

/** En «Contrato y condiciones»: precio de los clientes de su web, cuándo las aceptó y el texto */
export function ResumenCondicionesWeb({ datos, onAbrir }: { datos: CondicionesWeb | null; onAbrir: () => void }) {
  const [ver, setVer] = useState(false);
  if (!datos?.vigente) return null;
  const v = datos.vigente;
  const a = datos.aceptada;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ background: C.bg, border: "1px solid " + (datos.pendiente ? C.orange + "66" : C.border), borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 700 }}>Precio por cada cliente que te llegue por tu web</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-0.02em" }}>{eurosWeb(v.precio)}</span>
          <span style={{ fontSize: 13, color: C.mutedL }}>+ IVA ({eurosWeb(v.precio_iva)} en total)</span>
        </div>
        {a ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: C.green, fontWeight: 700, marginTop: 8 }}>
            <Icono n="check" s={14} grosor={3} />Aceptadas el {cuandoAceptada(a.aceptado_at)}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#FFC27A", fontWeight: 700, marginTop: 8, lineHeight: 1.45 }}>
              Sin aceptar: hasta que las aceptes, cada cliente de tu web te cuesta lo mismo que el resto de tus clientes.
            </div>
            <button onClick={onAbrir} style={{ ...btnOro, minHeight: 42, fontSize: 14, marginTop: 10 }}>Leer y aceptar</button>
          </>
        )}
      </div>
      {a && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setVer(!ver)} aria-expanded={ver} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer",
            color: C.accent, fontFamily: F, fontWeight: 800, fontSize: 13.5,
          }}>
            <Icono n="flecha" s={16} style={{ transform: ver ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
            {ver ? "Ocultar" : "Leer"} las condiciones de tu web
          </button>
          {ver && <TextoCompleto texto={v.texto} alto="46vh" />}
        </div>
      )}
    </div>
  );
}
