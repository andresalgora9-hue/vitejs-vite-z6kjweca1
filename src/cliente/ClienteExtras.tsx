// ============================================================
// OficioYa · ÁREA DEL CLIENTE — piezas sueltas: profesionales, mensajes con OficioYa,
// instalar la app, bienvenida guiada, aviso de acceso y «Primeros pasos».
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../supabase";
import type { Cliente, ProPublico, Solicitud } from "./clienteComun";
import { Icono, Avatar, Hoja, Vacio, FN, FN_HEADERS, ADMIN_ID, nombreOficio, primerNombre, telBonito, enlaceTel, fechaHora, lsSet, esIOS, appInstalada, avisosPosibles, ms } from "./clienteComun";

// ── Tarjeta de profesional (carrusel de Inicio) ─────────────
export function TarjetaPro({ p, onClick }: { p: ProPublico; onClick: () => void }) {
  return (
    <button onClick={onClick} className="cy-glass" style={{ width: 158, padding: "16px 12px 14px", borderRadius: 22, textAlign: "center", color: "var(--ink)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <Avatar nombre={p.nombre} url={p.avatar} size={58} />
      <p style={{ fontWeight: 800, fontSize: 14.5, marginTop: 4, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</p>
      <p className="cy-mini" style={{ marginTop: -4, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreOficio(p.oficio)}{p.zona ? " · " + p.zona : ""}</p>
      {p.contrato ? <span className="cy-pill ok" style={{ padding: "3px 8px", fontSize: 11 }}><Icono n="escudo" s={12} />Con contrato</span> : <span className="cy-pill" style={{ padding: "3px 8px", fontSize: 11 }}>Ver perfil</span>}
    </button>
  );
}

// ── Listado de profesionales ────────────────────────────────
export function ProfesionalesHoja({ pros, onClose, onVer }: { pros: ProPublico[] | null; onClose: () => void; onVer: (p: ProPublico) => void }) {
  const [oficio, setOficio] = useState("Todos");
  const [zona, setZona] = useState("Todas");
  const [q, setQ] = useState("");
  const [n, setN] = useState(12);
  const oficios = useMemo(() => ["Todos", ...Array.from(new Set((pros || []).map((p) => nombreOficio(p.oficio))))], [pros]);
  const zonas = useMemo(() => {
    const c: Record<string, number> = {};
    (pros || []).forEach((p) => { if (p.zona) c[p.zona] = (c[p.zona] || 0) + 1; });
    return ["Todas", ...Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0])];
  }, [pros]);
  const lista = (pros || []).filter((p) =>
    (oficio === "Todos" || nombreOficio(p.oficio) === oficio) && (zona === "Todas" || p.zona === zona)
    && (!q.trim() || (p.nombre + " " + (p.empresa || "") + " " + p.oficio + " " + p.zona).toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <Hoja titulo="Profesionales de OficioYa" onClose={onClose} ancho={640}>
      <p className="cy-mini" style={{ marginTop: -4, marginBottom: 12 }}>Tú nos dices qué necesitas y te asignamos el que encaja. Si te gusta alguno, pídele presupuesto desde su perfil.</p>
      <input className="cy-inp" value={q} onChange={(e) => { setQ(e.target.value); setN(12); }} placeholder="Buscar por nombre u oficio" style={{ marginBottom: 10 }} />
      <div className="cy-carril" style={{ paddingBottom: 6 }}>
        {oficios.map((o) => <button key={o} className="cy-chip" style={{ minHeight: 38, fontSize: 13 }} aria-pressed={oficio === o} onClick={() => { setOficio(o); setN(12); }}>{o}</button>)}
      </div>
      <div className="cy-carril" style={{ marginBottom: 8 }}>
        {zonas.map((z) => <button key={z} className="cy-chip" style={{ minHeight: 34, fontSize: 12.5 }} aria-pressed={zona === z} onClick={() => { setZona(z); setN(12); }}><Icono n="mapa" s={13} />{z}</button>)}
      </div>
      {pros === null && <p className="cy-mini" style={{ padding: 20, textAlign: "center" }}>Cargando…</p>}
      {pros && lista.length === 0 && <Vacio icono="grupo" titulo="No hay profesionales con ese filtro" texto="Prueba con otro oficio o ciudad." />}
      <div className="cy-col" style={{ gap: 8 }}>
        {lista.slice(0, n).map((p) => (
          <button key={p.id} onClick={() => onVer(p)} style={{ display: "flex", gap: 12, alignItems: "flex-start", width: "100%", padding: 12, borderRadius: 18, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "var(--ink)", textAlign: "left" }}>
            <Avatar nombre={p.nombre} url={p.avatar} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <p style={{ fontWeight: 800, fontSize: 15 }}>{p.nombre}</p>
                {p.contrato && <span className="cy-pill ok" style={{ padding: "2px 7px", fontSize: 10.5 }}><Icono n="escudo" s={11} />Con contrato</span>}
              </div>
              <p className="cy-mini">{nombreOficio(p.oficio)}{p.zona ? " · " + p.zona : ""}{p.empresa ? " · " + p.empresa : ""}</p>
              {p.bio && <p className="cy-mini cy-clamp2" style={{ marginTop: 4, color: "var(--ink2)" }}>{p.bio}</p>}
            </div>
            <Icono n="cheveron" s={18} c="#96A0B3" style={{ marginTop: 16 }} />
          </button>
        ))}
      </div>
      {lista.length > n && <button className="cy-btn-g cy-full" style={{ marginTop: 12 }} onClick={() => setN(n + 12)}>Ver más profesionales ({lista.length - n})</button>}
    </Hoja>
  );
}

// ── Perfil de un profesional (sin chat ni reseñas: pides presupuesto y OficioYa lo gestiona) ──
export function ProfesionalHoja({ p, onClose, onPedir }: { p: ProPublico; onClose: () => void; onPedir: (p: ProPublico) => void }) {
  return (
    <Hoja onClose={onClose} pie={
      <>
        <button className="cy-btn" onClick={() => onPedir(p)}>Pedir presupuesto <Icono n="flecha" s={18} w={2.4} /></button>
        <p className="cy-mini" style={{ textAlign: "center", marginTop: 8 }}>Gratis y sin compromiso · OficioYa revisa tu solicitud y te confirma el profesional</p>
      </>
    }>
      <div style={{ textAlign: "center", paddingTop: 6 }}>
        <Avatar nombre={p.nombre} url={p.avatar} size={84} />
        <p className="cy-h2" style={{ fontSize: 22, marginTop: 12 }}>{p.nombre}</p>
        <p className="cy-sub" style={{ marginTop: 2 }}>{nombreOficio(p.oficio)}{p.zona ? " · " + p.zona : ""}</p>
        {p.empresa && <p className="cy-mini" style={{ marginTop: 2 }}>{p.empresa}</p>}
        <div className="cy-row" style={{ justifyContent: "center", marginTop: 10 }}>
          {p.contrato && <span className="cy-pill ok"><Icono n="escudo" s={13} />Trabaja con contrato OficioYa</span>}
          {p.experiencia ? <span className="cy-pill">{p.experiencia} años de experiencia</span> : null}
        </div>
      </div>
      {p.bio && <p className="cy-sub" style={{ marginTop: 18, whiteSpace: "pre-line" }}>{p.bio}</p>}
      {p.especialidades && p.especialidades.length > 0 && (
        <>
          <p className="cy-lbl">Especialidades</p>
          <div className="cy-row">{p.especialidades.slice(0, 12).map((e) => <span key={e} className="cy-pill">{e}</span>)}</div>
        </>
      )}
      {p.fotos && p.fotos.length > 0 && (
        <>
          <p className="cy-lbl">Trabajos</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
            {p.fotos.slice(0, 6).map((u) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ display: "block", aspectRatio: "1", borderRadius: 12, overflow: "hidden", background: "#1A1D26" }}>
                <img src={u} alt="Trabajo" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
              </a>
            ))}
          </div>
        </>
      )}
    </Hoja>
  );
}

// ── Mensajes con OficioYa ───────────────────────────────────
interface Msg { id: string; from_id: string; to_id: string; text: string; read: boolean; created_at: string }
export function ChatHoja({ user, onClose, onLeidos }: { user: Cliente; onClose: () => void; onLeidos: () => void }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState("");
  const fin = useRef<HTMLDivElement>(null);
  const cargar = useCallback(async () => {
    const { data } = await db.from("messages").select("id,from_id,to_id,text,read,created_at")
      .or(`and(from_id.eq.${user.id},to_id.eq.${ADMIN_ID}),and(from_id.eq.${ADMIN_ID},to_id.eq.${user.id})`)
      .order("created_at", { ascending: false }).limit(80);
    const lista = ((data || []) as Msg[]).reverse();
    setMsgs(lista);
    const sinLeer = lista.filter((m) => m.from_id === ADMIN_ID && !m.read).map((m) => m.id);
    if (sinLeer.length) { await db.from("messages").update({ read: true }).in("id", sinLeer); onLeidos(); }
  }, [user.id, onLeidos]);
  useEffect(() => {
    cargar();
    const canal = db.channel("cy_chat_" + user.id)
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "messages", filter: "to_id=eq." + user.id }, () => cargar())
      .subscribe();
    return () => { db.removeChannel(canal); };
  }, [cargar, user.id]);
  useEffect(() => { setTimeout(() => fin.current?.scrollIntoView({ block: "end" }), 60); }, [msgs?.length]);
  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true); setErr("");
    const { error } = await db.from("messages").insert({ from_id: user.id, to_id: ADMIN_ID, text: t, read: false });
    setEnviando(false);
    if (error) { setErr("No se ha podido enviar. Inténtalo de nuevo."); return; }
    setTexto("");
    fetch(FN + "/notify-admin", { method: "POST", headers: FN_HEADERS, body: JSON.stringify({ type: "mensaje_admin", remitente: (primerNombre(user.name) || "Cliente") + " (cliente)", texto: t }) }).catch(() => {});
    cargar();
  };
  return (
    <Hoja id="cy-chat" titulo={<span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="cy-logo-ic" style={{ width: 32, height: 32 }}>🔨</span><span><span style={{ display: "block" }}>OficioYa</span><span className="cy-mini" style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}><span className="cy-dot" />Te responde una persona del equipo</span></span></span>} onClose={onClose} pie={
      <div>
        {err && <p className="cy-msg" style={{ marginTop: 0, marginBottom: 6 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea className="cy-inp" rows={1} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu mensaje…" style={{ minHeight: 50, maxHeight: 140 }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 720) { e.preventDefault(); enviar(); } }} />
          <button className="cy-btn" style={{ width: 54, minHeight: 50, padding: 0, borderRadius: 16, flex: "0 0 54px" }} disabled={enviando || !texto.trim()} onClick={enviar} aria-label="Enviar"><Icono n="flecha" s={20} w={2.4} /></button>
        </div>
      </div>
    }>
      {msgs === null && <p className="cy-mini" style={{ textAlign: "center", padding: 20 }}>Cargando…</p>}
      {msgs && msgs.length === 0 && (
        <Vacio icono="chat" titulo="¿En qué te ayudamos?" texto="Escríbenos lo que necesites sobre tu solicitud, un presupuesto o un profesional. Te respondemos aquí mismo." />
      )}
      <div className="cy-col" style={{ gap: 8 }}>
        {(msgs || []).map((m) => {
          const mio = m.from_id === user.id;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mio ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "84%", padding: "10px 12px", borderRadius: mio ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: mio ? "rgba(255,200,0,.16)" : "rgba(255,255,255,.06)", border: "1px solid " + (mio ? "rgba(255,200,0,.4)" : "rgba(255,255,255,.1)") }}>
                {!mio && <p style={{ fontSize: 11, fontWeight: 800, color: "var(--orange)", marginBottom: 3 }}>OficioYa</p>}
                <p style={{ fontSize: 14.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text.replace(/^\[Soporte oficioya\]\s*/i, "")}</p>
                <p style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 4, textAlign: "right" }}>{fechaHora(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={fin} />
      </div>
    </Hoja>
  );
}

// ── Instalar la app ─────────────────────────────────────────
type PromptEvt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let promptGuardado: PromptEvt | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); promptGuardado = e as PromptEvt; window.dispatchEvent(new Event("cy-instalable")); });
  window.addEventListener("appinstalled", () => { lsSet("oy_cliente_app_instalada", "1"); window.dispatchEvent(new Event("cy-instalada")); });
}
function plataforma() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const enApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|TikTok|; wv\)/i.test(ua);
  if (esIOS()) return /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\//i.test(ua) && !enApp ? "ios_safari" : "ios_otro";
  if (/android/i.test(ua)) return enApp ? "android_app" : "android";
  return "escritorio";
}
function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 10 }}>
      <span style={{ width: 24, height: 24, flex: "0 0 24px", borderRadius: "50%", background: "var(--grad)", color: "#1A1200", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
      <span className="cy-sub" style={{ fontSize: 14 }}>{children}</span>
    </div>
  );
}
export function useInstalable() {
  const [ok, setOk] = useState(!!promptGuardado);
  const [instalada, setInstalada] = useState(appInstalada());
  useEffect(() => {
    const a = () => setOk(true); const b = () => setInstalada(true);
    window.addEventListener("cy-instalable", a); window.addEventListener("cy-instalada", b);
    return () => { window.removeEventListener("cy-instalable", a); window.removeEventListener("cy-instalada", b); };
  }, []);
  const instalar = async () => {
    if (!promptGuardado) return false;
    const p = promptGuardado; promptGuardado = null; setOk(false);
    await p.prompt();
    const r = await p.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (r.outcome === "accepted") { lsSet("oy_cliente_app_instalada", "1"); setInstalada(true); return true; }
    return false;
  };
  return { instalable: ok, instalada, instalar };
}
export function InstruccionesInstalar({ compacto = false, faltaAcceso = false, onAcceso }: { compacto?: boolean; faltaAcceso?: boolean; onAcceso?: () => void }) {
  const { instalable, instalada, instalar } = useInstalable();
  const [copiado, setCopiado] = useState(false);
  const plat = plataforma();
  // En iPhone la app instalada no comparte la sesión de Safari: sin correo y contraseña no podría entrar
  if (esIOS() && faltaAcceso && !instalada) return (
    <div style={{ padding: 14, borderRadius: 16, background: "rgba(255,200,0,.08)", border: "1px solid rgba(255,200,0,.35)" }}>
      <p style={{ fontWeight: 800, fontSize: 14.5 }}>Primero, crea tu acceso</p>
      <p className="cy-mini" style={{ marginTop: 4, color: "var(--soft)" }}>En el iPhone la app se abre sin tu sesión y tendrás que entrar con tu correo y tu contraseña. Créalos antes de instalarla.</p>
      {onAcceso && <button className="cy-btn-s cy-full" style={{ marginTop: 12 }} onClick={onAcceso}><Icono n="candado" s={17} />Crear mi acceso</button>}
    </div>
  );
  const copiar = async () => { try { await navigator.clipboard.writeText(location.origin + "/?app=1"); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* nada */ } };
  if (instalada) return <p className="cy-sub"><Icono n="check" s={16} w={2.8} c="#7DF0C4" style={{ verticalAlign: "-3px", marginRight: 6 }} />Ya tienes OficioYa en este móvil. Ábrela desde su icono.</p>;
  if (instalable) return <button className="cy-btn" style={{ marginTop: compacto ? 0 : 6 }} onClick={instalar}><Icono n="movil" s={18} />Instalar OficioYa</button>;
  const IcoComp = <Icono n="compartir" s={16} c="#0A84FF" style={{ verticalAlign: "-3px", margin: "0 2px" }} />;
  if (plat === "ios_safari") return (<div><Paso n={1}>Pulsa <b>Compartir</b> {IcoComp} en la barra de Safari.</Paso><Paso n={2}>Baja y toca <b>«Añadir a pantalla de inicio»</b>.</Paso><Paso n={3}>Pulsa <b>«Añadir»</b>.</Paso></div>);
  if (plat === "ios_otro") return (<div><Paso n={1}>Copia el enlace con el botón.</Paso><Paso n={2}>Ábrelo en <b>Safari</b> y entra con tu correo y tu contraseña.</Paso><Paso n={3}>Pulsa <b>Compartir</b> {IcoComp} → <b>«Añadir a pantalla de inicio»</b>.</Paso><button className="cy-btn-s cy-full" style={{ marginTop: 12 }} onClick={copiar}><Icono n={copiado ? "check" : "copiar"} s={17} />{copiado ? "Enlace copiado" : "Copiar enlace"}</button></div>);
  if (plat === "android_app") return (<div><Paso n={1}>Pulsa los <b>tres puntos ⋮</b> de arriba.</Paso><Paso n={2}>Elige <b>«Abrir en Chrome»</b>.</Paso><Paso n={3}>Te saldrá el botón para instalarla.</Paso><button className="cy-btn-s cy-full" style={{ marginTop: 12 }} onClick={copiar}><Icono n={copiado ? "check" : "copiar"} s={17} />{copiado ? "Enlace copiado" : "Copiar enlace"}</button></div>);
  if (plat === "android") return (<div><Paso n={1}>Pulsa los <b>tres puntos ⋮</b> arriba a la derecha.</Paso><Paso n={2}>Toca <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.</Paso><Paso n={3}>Confirma con <b>«Instalar»</b>.</Paso></div>);
  return <p className="cy-sub">En el ordenador, pulsa el icono de instalar a la derecha de la barra de direcciones. Lo más útil es tenerla en el móvil: entra en aficioya.com desde él.</p>;
}
export function InstalarHoja({ onClose, faltaAcceso, onAcceso }: { onClose: () => void; faltaAcceso?: boolean; onAcceso?: () => void }) {
  return (
    <Hoja onClose={onClose}>
      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <img src="/icon-192.png" alt="" width={72} height={72} style={{ borderRadius: 20, margin: "0 auto", boxShadow: "0 18px 40px -16px rgba(255,160,0,.7)" }} />
        <p className="cy-h2" style={{ fontSize: 22, marginTop: 14 }}>Instala OficioYa</p>
        <p className="cy-sub" style={{ marginTop: 6 }}>Tenla en tu pantalla de inicio y te avisamos al momento cuando el profesional te responda. Gratis y ocupa menos de 1 MB.</p>
      </div>
      <div style={{ marginTop: 14 }}><InstruccionesInstalar faltaAcceso={faltaAcceso} onAcceso={onAcceso} /></div>
    </Hoja>
  );
}

// ── Bienvenida guiada (al llegar desde la landing) ──────────
export interface DatosBienvenida { oficio?: string; zona?: string; profesional?: string; telefono?: string }
export function Bienvenida({ paso, user, sol, datos, provisional, avisosOn, onPaso, onCerrar, onIrAcceso, onIrSolicitudes, onAvisos }: {
  paso: number; user: Cliente; sol: Solicitud | null; datos: DatosBienvenida | null; provisional: boolean; avisosOn: boolean;
  onPaso: (n: number) => void; onCerrar: () => void; onIrAcceso: (volverA: number) => void; onIrSolicitudes: () => void; onAvisos: () => void;
}) {
  const nom = primerNombre(user.name);
  const proNombre = sol?.pro && !sol.anulado ? sol.pro.nombre : (datos?.profesional || "");
  const proTel = sol?.pro?.telefono || (datos?.telefono && !/656398014/.test(datos.telefono) ? datos.telefono : "");
  const oficio = nombreOficio(sol?.oficio || datos?.oficio || "").toLowerCase();
  const total = 4;
  const puntos = (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => <span key={i} style={{ width: i === paso ? 22 : 7, height: 7, borderRadius: 99, background: i <= paso ? "var(--gold)" : "rgba(255,255,255,.18)", transition: "all .3s" }} />)}
    </div>
  );
  let cuerpo: React.ReactNode;
  if (paso === 0) {
    cuerpo = (
      <>
        <div style={{ width: 78, height: 78, margin: "0 auto", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,214,143,.14)", border: "1px solid rgba(0,214,143,.45)", color: "var(--green)" }}><Icono n="check" s={36} w={2.6} /></div>
        <h2 className="cy-h1" style={{ fontSize: 28, marginTop: 18 }}>¡Listo{nom ? ", " + nom : ""}!</h2>
        <p className="cy-sub" style={{ marginTop: 8 }}>Tu solicitud{oficio && oficio !== "otro" ? " de " + oficio : ""} está en marcha. {proNombre ? proNombre + " ya la tiene y te llamará para darte el presupuesto." : "Te llamamos en breve para darte el presupuesto."}</p>
        {proNombre && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, padding: 12, borderRadius: 18, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", textAlign: "left" }}>
            <Avatar nombre={proNombre} url={sol?.pro?.avatar} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontWeight: 800 }}>{proNombre}</p><p className="cy-mini">Tu profesional{proTel ? " · " + telBonito(proTel) : ""}</p></div>
            <span className="cy-pill ok"><Icono n="escudo" s={12} />Comprobado</span>
          </div>
        )}
        {proTel
          ? <a className="cy-btn cy-btn-verde" style={{ marginTop: 18 }} href={enlaceTel(proTel)}><Icono n="tel" s={18} />Llamar ahora a {proNombre || "tu profesional"}</a>
          : null}
        <button className={proTel ? "cy-btn-g cy-full" : "cy-btn"} style={{ marginTop: 10 }} onClick={() => onPaso(1)}>Continuar <Icono n="flecha" s={18} w={2.4} /></button>
      </>
    );
  } else if (paso === 1) {
    cuerpo = provisional ? (
      <>
        <div style={{ width: 74, height: 74, margin: "0 auto", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--grad)", color: "#1A1200", boxShadow: "0 18px 40px -14px rgba(255,160,0,.8)" }}><Icono n="candado" s={32} w={2.2} /></div>
        <h2 className="cy-h1" style={{ fontSize: 26, marginTop: 18 }}>Ahora, crea <span>tu acceso</span></h2>
        <p className="cy-sub" style={{ marginTop: 8 }}>Pon tu correo y una contraseña en tu perfil. Así entras desde cualquier móvil y no pierdes tu solicitud.</p>
        <button className="cy-btn" style={{ marginTop: 20 }} onClick={() => onIrAcceso(2)}>Poner correo y contraseña <Icono n="flecha" s={18} w={2.4} /></button>
        <button className="cy-link" style={{ marginTop: 10, color: "var(--ink3)" }} onClick={() => onPaso(2)}>Ahora no</button>
      </>
    ) : (
      <>
        <div style={{ width: 74, height: 74, margin: "0 auto", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,214,143,.14)", border: "1px solid rgba(0,214,143,.45)", color: "var(--green)" }}><Icono n="escudo" s={32} /></div>
        <h2 className="cy-h1" style={{ fontSize: 26, marginTop: 18 }}>Cuenta <span>protegida</span></h2>
        <p className="cy-sub" style={{ marginTop: 8 }}>Ya puedes entrar con tu correo y tu contraseña desde cualquier móvil.</p>
        <button className="cy-btn" style={{ marginTop: 20 }} onClick={() => onPaso(2)}>Siguiente <Icono n="flecha" s={18} w={2.4} /></button>
      </>
    );
  } else if (paso === 2) {
    cuerpo = (
      <>
        <h2 className="cy-h1" style={{ fontSize: 26 }}>Así funciona <span>tu área</span></h2>
        <div className="cy-col" style={{ marginTop: 18, gap: 10, textAlign: "left" }}>
          {[
            ["solicitudes", "Solicitudes", "Ves cuándo te llama el profesional y su presupuesto, paso a paso."],
            ["presupuestos", "Presupuestos", "Apunta todos los que te den y compáralos. Te decimos si son buen precio."],
            ["calcular", "Calcular", "Precios orientativos de pintura y fontanería para que no te cobren de más."],
          ].map(([ic, t, d]) => (
            <div key={t} style={{ display: "flex", gap: 12, padding: 12, borderRadius: 18, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.1)" }}>
              <span style={{ width: 40, height: 40, flex: "0 0 40px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,200,0,.12)", color: "var(--gold)" }}><Icono n={ic} s={20} /></span>
              <div><p style={{ fontWeight: 800, fontSize: 15 }}>{t}</p><p className="cy-mini" style={{ color: "var(--ink2)" }}>{d}</p></div>
            </div>
          ))}
        </div>
        <button className="cy-btn" style={{ marginTop: 20 }} onClick={() => onPaso(3)}>Siguiente <Icono n="flecha" s={18} w={2.4} /></button>
      </>
    );
  } else {
    cuerpo = (
      <>
        <img src="/icon-192.png" alt="" width={70} height={70} style={{ borderRadius: 20, margin: "0 auto", boxShadow: "0 18px 40px -16px rgba(255,160,0,.7)" }} />
        <h2 className="cy-h1" style={{ fontSize: 26, marginTop: 16 }}>Tenla <span>a mano</span></h2>
        <p className="cy-sub" style={{ marginTop: 8 }}>Instala OficioYa en tu móvil{avisosPosibles() && !avisosOn ? " y activa los avisos" : ""}: te avisamos al momento cuando el profesional te responda.</p>
        <div style={{ marginTop: 16, textAlign: "left" }}><InstruccionesInstalar faltaAcceso={provisional} onAcceso={() => onIrAcceso(3)} /></div>
        {avisosPosibles() && !avisosOn && <button className="cy-btn-s cy-full" style={{ marginTop: 10 }} onClick={onAvisos}><Icono n="campana" s={18} />Activar avisos</button>}
        <button className="cy-btn-g cy-full" style={{ marginTop: 10 }} onClick={() => { onCerrar(); onIrSolicitudes(); }}>Ver cómo va mi solicitud</button>
      </>
    );
  }
  return (
    <div className="cy-velo" style={{ alignItems: "center", padding: 16 }}>
      <div className="cy-hoja" role="dialog" aria-modal="true" style={{ maxWidth: 440, borderRadius: 28, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
        <div className="cy-hoja-cab" style={{ justifyContent: "flex-end", paddingBottom: 0 }}>
          <button className="cy-x" onClick={onCerrar} aria-label="Cerrar"><Icono n="x" s={18} /></button>
        </div>
        <div className="cy-hoja-cuerpo cy-entra" key={paso} style={{ textAlign: "center", paddingTop: 0, paddingBottom: 24 }}>
          {puntos}
          {cuerpo}
        </div>
      </div>
    </div>
  );
}

// ── Aviso «protege tu cuenta» (el «push» dentro de la app) ──
export function AvisoAccesoHoja({ user, onClose, onIr }: { user: Cliente; onClose: () => void; onIr: () => void }) {
  const nom = primerNombre(user.name);
  return (
    <Hoja onClose={onClose}>
      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <div style={{ width: 70, height: 70, margin: "0 auto", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--grad)", color: "#1A1200", boxShadow: "0 18px 40px -14px rgba(255,160,0,.8)" }}><Icono n="candado" s={30} w={2.2} /></div>
        <p className="cy-h2" style={{ fontSize: 22, marginTop: 16 }}>{nom ? nom + ", protege tu cuenta" : "Protege tu cuenta"}</p>
        <p className="cy-sub" style={{ marginTop: 6 }}>Entraste solo con tu teléfono y aún no tienes correo ni contraseña. Si cierras sesión o cambias de móvil, no podrás volver a entrar.</p>
        <button className="cy-btn" style={{ marginTop: 18 }} onClick={onIr}>Ir a mi perfil <Icono n="flecha" s={18} w={2.4} /></button>
        <button className="cy-link" style={{ marginTop: 8, color: "var(--ink3)" }} onClick={onClose}>Más tarde</button>
      </div>
    </Hoja>
  );
}

// ── Primeros pasos (lista en Inicio) ────────────────────────
export interface EstadoPasos { pedido: boolean; acceso: boolean; avisos: boolean; instalada: boolean }
export function PrimerosPasos({ e, onPedir, onAcceso, onAvisos, onInstalar, onOcultar }: { e: EstadoPasos; onPedir: () => void; onAcceso: () => void; onAvisos: () => void; onInstalar: () => void; onOcultar: () => void }) {
  const items: { k: keyof EstadoPasos; t: string; d: string; cta: string; fn: () => void; mostrar: boolean }[] = [
    { k: "pedido", t: "Pide tu presupuesto", d: "Te asignamos un profesional de tu zona", cta: "Pedir", fn: onPedir, mostrar: true },
    { k: "acceso", t: "Crea tu acceso", d: "Correo y contraseña para no perder tu área", cta: "Crear", fn: onAcceso, mostrar: true },
    { k: "avisos", t: "Activa los avisos", d: "Te avisamos cuando te respondan", cta: "Activar", fn: onAvisos, mostrar: avisosPosibles() },
    { k: "instalada", t: "Instala la app", d: "OficioYa en tu pantalla de inicio", cta: "Cómo", fn: onInstalar, mostrar: true },
  ];
  const visibles = items.filter((i) => i.mostrar);
  const hechos = visibles.filter((i) => e[i.k]).length;
  if (hechos === visibles.length) return null;
  const siguiente = visibles.find((i) => !e[i.k]);
  return (
    <div className="cy-glass cy-card cy-entra">
      <div className="cy-between">
        <p className="cy-h3">Primeros pasos</p>
        <span className="cy-pill oro">{hechos} de {visibles.length}</span>
      </div>
      <div className="cy-barra" style={{ marginTop: 10 }}><i style={{ width: (hechos / visibles.length) * 100 + "%" }} /></div>
      <div className="cy-col" style={{ marginTop: 12, gap: 6 }}>
        {visibles.map((i) => {
          const hecho = e[i.k];
          const es = siguiente?.k === i.k;
          return (
            <div key={i.k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", borderRadius: 14, background: es ? "rgba(255,200,0,.08)" : "transparent", border: "1px solid " + (es ? "rgba(255,200,0,.35)" : "transparent") }}>
              <span style={{ width: 26, height: 26, flex: "0 0 26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: hecho ? "var(--grad)" : "transparent", border: hecho ? "0" : "1.5px solid rgba(255,255,255,.22)", color: "#1A1200" }}>{hecho && <Icono n="check" s={15} w={3} />}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: 14.5, color: hecho ? "var(--ink3)" : "var(--ink)", textDecoration: hecho ? "line-through" : "none" }}>{i.t}</p>
                {!hecho && <p className="cy-mini">{i.d}</p>}
              </div>
              {!hecho && <button className={es ? "cy-btn-s cy-btn-sm" : "cy-btn-g cy-btn-sm"} onClick={i.fn}>{i.cta}</button>}
            </div>
          );
        })}
      </div>
      {hechos >= 2 && <button className="cy-link" style={{ marginTop: 6, color: "var(--ink3)", fontWeight: 600, fontSize: 13 }} onClick={onOcultar}>Ocultar</button>}
    </div>
  );
}

export const solicitudReciente = (sols: Solicitud[] | null, dias = 3) => (sols || []).find((s) => Date.now() - ms(s.created_at) < dias * 864e5) || null;
