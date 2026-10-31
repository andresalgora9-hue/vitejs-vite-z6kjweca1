// ============================================================
// OficioYa · ADMIN — CHATS (estilo Slack/Teams)
// Canal #equipo + mensajes directos con Dirección general y con cada departamento.
// Datos: ia_chats_resumen · ia_chat_leer/ia_chat_enviar/ia_chat_borrar (Dirección) · ia_equipo_leer/ia_equipo_enviar/ia_equipo_marcar (resto)
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../supabase";
import { C, F, Btn, Card, useAncho } from "./apUi";

type J = any;
const CLAVE_LS = "oy_captacion_clave";
const LEIDO_LS = "oy_chat_leido";
const CANAL_LS = "oy_chat_canal";
const PERSONAJE: Record<string, string> = { direccion: "🧑‍💼", marketing: "👩‍💻", supervisor: "🕵️", ciberseguridad: "👨‍💻", expansion: "🧑‍🚀", captacion: "🤝", operaciones: "🧑‍🔧", finanzas: "👩‍💼", producto: "🧑‍🎨" };
const SUG_DIR = ["¿Cómo vamos este mes?", "¿Qué es lo más urgente hoy?", "¿Llegamos al objetivo?", "¿Qué riesgo de seguridad cierro primero?"];
const TZ = "Europe/Madrid";
const hora = (s: string) => new Date(s).toLocaleTimeString("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const diaClave = (s: string) => new Date(s).toLocaleDateString("en-CA", { timeZone: TZ });
function etiquetaDia(s: string) {
  const d = diaClave(s), hoy = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const ayer = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
  if (d === hoy) return "Hoy";
  if (d === ayer) return "Ayer";
  return new Date(s).toLocaleDateString("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
}
function haceCorto(s?: string | null) {
  if (!s) return "";
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return m + " min";
  const h = Math.round(m / 60);
  if (h < 24) return h + " h";
  return Math.round(h / 24) + " d";
}
const leerMapa = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(LEIDO_LS) || "{}"); } catch { return {}; } };

export default function Chats(_props: J) {
  const movil = useAncho() < 820;
  const [clave, setClave] = useState<string>(() => { try { return localStorage.getItem(CLAVE_LS) || ""; } catch { return ""; } });
  const [claveInput, setClaveInput] = useState("");
  const [res, setRes] = useState<J | null>(null);
  const [canal, setCanal] = useState<string>(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("canal");
      if (q && (q === "equipo" || /^dm:[a-z]+$/.test(q))) return q;
      return localStorage.getItem(CANAL_LS) || "dm:direccion";
    } catch { return "dm:direccion"; }
  });
  const [verLista, setVerLista] = useState(true);
  const [leido, setLeido] = useState<Record<string, number>>(leerMapa);
  const [error, setError] = useState("");

  const cargarResumen = useCallback(async () => {
    if (!clave) return;
    const { data, error: e } = await db.rpc("ia_chats_resumen", { p_clave: clave });
    if (e) { if (/acceso denegado/i.test(e.message)) { setClave(""); try { localStorage.removeItem(CLAVE_LS); } catch { /* nada */ } } setError(e.message); return; }
    setError(""); setRes(data);
  }, [clave]);
  useEffect(() => { cargarResumen(); const t = setInterval(cargarResumen, 6000); return () => clearInterval(t); }, [cargarResumen]);
  useEffect(() => { try { localStorage.setItem(CANAL_LS, canal); } catch { /* nada */ } }, [canal]);

  const marcarLeido = useCallback((c: string, id: number) => {
    setLeido((prev) => {
      if ((prev[c] || 0) >= id) return prev;
      const n = { ...prev, [c]: id };
      try { localStorage.setItem(LEIDO_LS, JSON.stringify(n)); } catch { /* nada */ }
      return n;
    });
  }, []);

  if (!clave) {
    return (
      <div style={{ maxWidth: 420, margin: "40px auto" }}>
        <Card>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Chats</div>
          <div style={{ fontSize: 13, color: C.mutedL, marginBottom: 14 }}>Introduce tu clave de administrador (la misma del CRM de captación).</div>
          <input type="password" value={claveInput} onChange={(ev) => setClaveInput(ev.target.value)} placeholder="Clave"
            onKeyDown={(ev) => { if (ev.key === "Enter" && claveInput.length >= 8) { try { localStorage.setItem(CLAVE_LS, claveInput); } catch { /* nada */ } setClave(claveInput); } }}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontFamily: F, fontSize: 14, marginBottom: 10 }} />
          {error && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <Btn full disabled={claveInput.length < 8} onClick={() => { try { localStorage.setItem(CLAVE_LS, claveInput); } catch { /* nada */ } setClave(claveInput); }}>Entrar</Btn>
        </Card>
      </div>
    );
  }
  if (!res) return <div style={{ color: C.mutedL, padding: 30, fontFamily: F }}>{error || "Abriendo los chats…"}</div>;

  const deps: J[] = res.departamentos || [];
  const info = (c: string) => (c === "dm:direccion" ? res.direccion : res.canales?.[c]) || {};
  const sinLeer = (c: string) => Number(info(c).ultimo_otros_id || 0) > Number(leido[c] || 0);
  const abrir = (c: string) => { setCanal(c); setVerLista(false); };

  const lista = (
    <div style={{ width: movil ? "100%" : 290, flexShrink: 0, background: "#12151d", borderRight: movil ? "none" : "1px solid " + C.border, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid " + C.border }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>💬 Chats</div>
        <div style={{ fontSize: 11.5, color: C.muted }}>OficioYa · equipo IA</div>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
        <Seccion t="Canales" />
        <Item activo={canal === "equipo"} onClick={() => abrir("equipo")} avatar={<span style={{ fontSize: 17, fontWeight: 800, color: C.mutedL }}>#</span>}
          nombre="equipo" sub={resumenUltimo(info("equipo").ultimo, deps)} negrita={sinLeer("equipo")} badge={Number(info("equipo").pendientes) || 0} escribiendo={info("equipo").escribiendo} hora={info("equipo").ultimo?.created_at} />
        <Seccion t="Mensajes directos" />
        {deps.map((x) => {
          const c = "dm:" + x.id;
          return (
            <Item key={x.id} activo={canal === c} deshabilitado={!x.activo} onClick={() => x.activo && abrir(c)}
              avatar={<Avatar id={x.id} estado={x.estado} activo={x.activo} />} nombre={x.nombre}
              sub={!x.activo ? "Se incorporará pronto" : resumenUltimo(info(c).ultimo, deps) || estadoTexto(x)} negrita={x.activo && sinLeer(c)}
              escribiendo={info(c).escribiendo} hora={info(c).ultimo?.created_at} />
          );
        })}
      </div>
    </div>
  );

  const conversacion = (
    <Conversacion key={canal} canal={canal} clave={clave} deps={deps} res={res} movil={movil} volver={() => setVerLista(true)}
      alLeer={(id) => marcarLeido(canal, id)} alCambiar={cargarResumen} />
  );

  return (
    <div style={{ fontFamily: F, display: "flex", height: movil ? "calc(100dvh - 130px)" : "calc(100dvh - 110px)", minHeight: 480, border: "1px solid " + C.border, borderRadius: 14, overflow: "hidden", background: C.card }}>
      {movil ? (verLista ? lista : conversacion) : <>{lista}{conversacion}</>}
      <style>{`@keyframes chCursor{0%,49%{opacity:1}50%,100%{opacity:0}} @keyframes chPunto{0%,80%,100%{opacity:.25}40%{opacity:1}} @keyframes chLatido{0%,100%{box-shadow:0 0 0 0 #00D68F88}50%{box-shadow:0 0 0 4px #00D68F00}}`}</style>
    </div>
  );
}

function estadoTexto(x: J) {
  if (x.estado === "trabajando") return "Trabajando ahora…";
  if (x.estado === "descansando") return "Descansando 😴";
  if (x.estado === "error") return "Su último trabajo falló";
  return x.ultimo_run_at ? "Activo · último informe hace " + haceCorto(x.ultimo_run_at) : "Disponible";
}
function resumenUltimo(u: J, deps: J[]) {
  if (!u) return "";
  if (u.estado === "escribiendo") return "escribiendo…";
  const quien = u.de === "andres" ? "Tú: " : u.de && u.de !== "direccion" ? (deps.find((d) => d.id === u.de)?.nombre?.split(" ")[0] || "") + ": " : "";
  return quien + String(u.texto || "").replace(/\s+/g, " ");
}
function Seccion({ t }: { t: string }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, padding: "12px 16px 6px" }}>{t}</div>;
}
function Avatar({ id, estado, activo, tam = 32 }: { id: string; estado?: string; activo?: boolean; tam?: number }) {
  const col = !activo ? C.muted : estado === "trabajando" ? C.green : estado === "descansando" ? C.blue : estado === "error" ? C.red : C.green;
  return (
    <div style={{ position: "relative", width: tam, height: tam, borderRadius: 8, background: "#1e2433", display: "flex", alignItems: "center", justifyContent: "center", fontSize: tam * 0.6, flexShrink: 0, filter: activo === false ? "grayscale(1)" : "none" }}>
      {id === "andres" ? "👤" : PERSONAJE[id] || "🧑"}
      {id !== "andres" && <span style={{ position: "absolute", right: -2, bottom: -2, width: 10, height: 10, borderRadius: "50%", background: estado === "descansando" ? "#12151d" : col, border: "2px solid #12151d", fontSize: 8, lineHeight: "8px", textAlign: "center", animation: estado === "trabajando" ? "chLatido 1.4s infinite" : "none" }}>{estado === "descansando" ? "🌙" : ""}</span>}
    </div>
  );
}
function Item({ activo, onClick, avatar, nombre, sub, negrita, badge = 0, escribiendo, hora: h, deshabilitado }: { activo: boolean; onClick: () => void; avatar: React.ReactNode; nombre: string; sub?: string; negrita?: boolean; badge?: number; escribiendo?: boolean; hora?: string; deshabilitado?: boolean }) {
  return (
    <div onClick={onClick} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 14px", margin: "1px 8px", borderRadius: 8, cursor: deshabilitado ? "default" : "pointer", background: activo ? C.accent + "22" : "transparent", opacity: deshabilitado ? 0.45 : 1 }}>
      {avatar}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: negrita || activo ? 800 : 600, color: activo ? C.accent : C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre}</span>
          {h && <span style={{ fontSize: 10.5, color: C.muted }}>{haceCorto(h)}</span>}
        </div>
        {sub && <div style={{ fontSize: 11.5, color: escribiendo ? C.green : negrita ? C.text : C.muted, fontWeight: negrita ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{escribiendo ? "escribiendo…" : sub}</div>}
      </div>
      {badge > 0 ? <span style={{ background: C.red, color: "#fff", fontSize: 11, fontWeight: 800, borderRadius: 99, padding: "1px 7px" }}>{badge}</span>
        : negrita ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent }} /> : null}
    </div>
  );
}

function Conversacion({ canal, clave, deps, res, movil, volver, alLeer, alCambiar }: { canal: string; clave: string; deps: J[]; res: J; movil: boolean; volver: () => void; alLeer: (id: number) => void; alCambiar: () => void }) {
  const esDir = canal === "dm:direccion";
  const esEquipo = canal === "equipo";
  const depId = canal.startsWith("dm:") ? canal.slice(3) : null;
  const dep = deps.find((x) => x.id === depId);
  const [msgs, setMsgs] = useState<J[]>([]);
  const [texto, setTexto] = useState("");
  const [resp, setResp] = useState<J | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const caja = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const cargar = useCallback(async () => {
    const r = esDir ? await db.rpc("ia_chat_leer", { p_clave: clave }) : await db.rpc("ia_equipo_leer", { p_clave: clave, p_canal: canal });
    if (r.error) return;
    const lista: J[] = (r.data || []).map((m: J) => (esDir ? { ...m, de: m.rol === "andres" ? "andres" : "direccion" } : m));
    setMsgs(lista);
    const ult = [...lista].reverse().find((m) => m.de !== "andres" && m.estado !== "escribiendo");
    if (ult) alLeer(Number(ult.id));
  }, [clave, canal, esDir, alLeer]);
  useEffect(() => { cargar(); }, [cargar]);
  const escribiendo = msgs.some((m) => m.estado === "escribiendo");
  useEffect(() => { const t = setInterval(cargar, escribiendo ? 1200 : 6000); return () => clearInterval(t); }, [escribiendo, cargar]);
  const ultimo = msgs[msgs.length - 1];
  useEffect(() => { if (caja.current) caja.current.scrollTop = caja.current.scrollHeight; }, [msgs.length, ultimo?.parcial, ultimo?.texto]);

  const porId = useMemo(() => Object.fromEntries(msgs.map((m) => [m.id, m])), [msgs]);
  const nombre = (id: string) => (id === "andres" ? "Tú" : deps.find((x) => x.id === id)?.nombre || id);
  const colorDe = (id: string) => (id === "andres" ? C.accent : deps.find((x) => x.id === id)?.color || C.mutedL);

  const enviar = async (t?: string) => {
    const q = (t ?? texto).trim();
    if (!q || escribiendo || enviando) return;
    setEnviando(true); setError("");
    const r = esDir
      ? await db.rpc("ia_chat_enviar", { p_clave: clave, p_texto: q })
      : await db.rpc("ia_equipo_enviar", { p_clave: clave, p_texto: q, p_responde_a: resp?.id ?? null, p_canal: canal });
    setEnviando(false);
    if (r.error) { setError(r.error.message); return; }
    setTexto(""); setResp(null); cargar(); alCambiar();
  };
  const marcar = async (m: J) => { await db.rpc("ia_equipo_marcar", { p_clave: clave, p_id: m.id, p_estado: "respondida" }); cargar(); alCambiar(); };
  const nueva = async () => {
    if (!window.confirm("¿Empezar una conversación nueva con Dirección? Se borra la actual.")) return;
    await db.rpc("ia_chat_borrar", { p_clave: clave }); cargar(); alCambiar();
  };

  const titulo = esEquipo ? "# equipo" : dep?.nombre || "Chat";
  const subtitulo = esEquipo ? "Canal de todo el equipo · aquí te preguntan lo que necesitan de ti · menciona con @ para hablar con alguien"
    : dep ? (dep.estado === "trabajando" ? "🟢 Trabajando ahora" : dep.estado === "descansando" ? "🌙 Descansando" : "🟢 " + (dep.ultimo_run_at ? "Último informe hace " + haceCorto(dep.ultimo_run_at) : "Disponible")) + (esDir ? " · tiene todos los datos e informes del equipo y puede pasar encargos" : " · chat directo") : "";

  // Agrupar por día y por remitente seguido
  let diaAnt = "", deAnt = "", tAnt = 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid " + C.border, background: C.card }}>
        {movil && <button onClick={volver} style={{ background: "none", border: "none", color: C.text, fontSize: 20, cursor: "pointer", padding: "0 6px 0 0" }}>←</button>}
        {esEquipo ? <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1e2433", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: C.mutedL }}>#</div> : <Avatar id={depId || ""} estado={dep?.estado} activo={dep?.activo} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{titulo}</div>
          <div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: movil ? "nowrap" : "normal" }}>{subtitulo}</div>
        </div>
        {esDir && msgs.length > 0 && <Btn small outline onClick={nueva}>Nueva conversación</Btn>}
      </div>

      <div ref={caja} style={{ flex: 1, overflowY: "auto", padding: "10px 16px 16px" }}>
        {!msgs.length && (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 10px", lineHeight: 1.6 }}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>{esEquipo ? "#" : PERSONAJE[depId || ""] || "💬"}</div>
            {esEquipo ? "Aquí escribirá el equipo cuando necesite algo de ti (te llegará un aviso al móvil)." : esDir ? "Pregúntale lo que quieras: cómo vamos, qué es urgente, qué hace cada departamento…" : "Escríbele lo que necesites. Te responde al momento y lo tiene en cuenta en su próximo turno."}
          </div>
        )}
        {msgs.map((m) => {
          const d = diaClave(m.created_at);
          const nuevoDia = d !== diaAnt;
          const t = new Date(m.created_at).getTime();
          const seguido = !nuevoDia && m.de === deAnt && t - tAnt < 5 * 60000 && !m.responde_a && m.tipo !== "pregunta";
          diaAnt = d; deAnt = m.de; tAnt = t;
          const txt = m.estado === "escribiendo" ? (m.parcial || "") : (m.texto || "");
          const pregunta = m.tipo === "pregunta";
          const ref = m.responde_a ? porId[m.responde_a] : null;
          const colP = pregunta ? (m.estado === "pendiente" ? C.orange : C.green) : null;
          return (
            <React.Fragment key={m.id}>
              {nuevoDia && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 8px" }}>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: C.mutedL, border: "1px solid " + C.border, borderRadius: 99, padding: "2px 10px", textTransform: "capitalize" }}>{etiquetaDia(m.created_at)}</span>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 10, padding: seguido ? "1px 0" : "8px 0 1px", alignItems: "flex-start" }}>
                <div style={{ width: 36, flexShrink: 0 }}>{!seguido && <Avatar id={m.de} estado={deps.find((x) => x.id === m.de)?.estado} activo tam={36} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!seguido && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: colorDe(m.de) }}>{nombre(m.de)}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{hora(m.created_at)}</span>
                      {pregunta && <span style={{ fontSize: 11, fontWeight: 800, color: colP || C.orange }}>{m.estado === "pendiente" ? "❓ Pregunta para ti" : "✓ Respondida"}{m.urgencia === "alta" ? " · urgente" : ""}</span>}
                    </div>
                  )}
                  {ref && <div style={{ fontSize: 12, color: C.muted, borderLeft: "3px solid " + C.border, paddingLeft: 8, margin: "3px 0" }}>↪ {nombre(ref.de)}: {String(ref.texto || "").slice(0, 120)}{String(ref.texto || "").length > 120 ? "…" : ""}</div>}
                  <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", color: m.estado === "error" ? C.red : C.text, ...(pregunta ? { background: (colP || C.orange) + "12", border: "1px solid " + (colP || C.orange) + "66", borderRadius: 8, padding: "7px 10px", marginTop: 3 } : {}) }}>
                    {txt}
                    {m.estado === "escribiendo" && (txt ? <span style={{ animation: "chCursor 1s infinite" }}>▌</span> : <span style={{ color: C.muted }}>{[0, 1, 2].map((i) => <span key={i} style={{ animation: `chPunto 1.2s ${i * 0.2}s infinite`, fontSize: 18 }}>•</span>)}</span>)}
                  </div>
                  {!esDir && m.de !== "andres" && m.estado !== "escribiendo" && (pregunta || esEquipo) && (
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button onClick={() => { setResp(m); setTimeout(() => area.current?.focus(), 50); }} style={{ fontFamily: F, fontSize: 11.5, fontWeight: 800, padding: "2px 9px", borderRadius: 99, border: "1px solid " + C.border, background: "transparent", color: C.mutedL, cursor: "pointer" }}>↩ Responder</button>
                      {pregunta && m.estado === "pendiente" && <button onClick={() => marcar(m)} style={{ fontFamily: F, fontSize: 11.5, padding: "2px 9px", borderRadius: 99, border: "1px solid " + C.border, background: "transparent", color: C.muted, cursor: "pointer" }}>Marcar resuelta</button>}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid " + C.border, padding: "10px 14px 12px", background: C.card }}>
        {esDir && !msgs.length && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {SUG_DIR.map((q) => <button key={q} disabled={escribiendo || enviando} onClick={() => enviar(q)} style={{ fontFamily: F, fontSize: 12, padding: "5px 10px", borderRadius: 99, border: "1px solid " + C.border, background: "transparent", color: C.mutedL, cursor: "pointer" }}>{q}</button>)}
          </div>
        )}
        {esEquipo && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {deps.filter((x) => x.activo).map((x) => (
              <button key={x.id} onClick={() => { const t = "@" + x.id; setTexto((v) => (v.includes(t) ? v : (t + " " + v).trim() + " ")); area.current?.focus(); }}
                style={{ fontFamily: F, fontSize: 11.5, padding: "3px 9px", borderRadius: 99, border: "1px solid " + C.border, background: "transparent", color: C.mutedL, cursor: "pointer" }}>{PERSONAJE[x.id] || ""} @{x.id}</button>
            ))}
          </div>
        )}
        {resp && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: C.mutedL, background: C.surface, borderRadius: 8, padding: "6px 9px", marginBottom: 8 }}>
            <span style={{ flex: 1 }}>↩ Respondiendo a <b style={{ color: C.text }}>{nombre(resp.de)}</b>: «{String(resp.texto || "").slice(0, 90)}{String(resp.texto || "").length > 90 ? "…" : ""}»</span>
            <button onClick={() => setResp(null)} style={{ background: "none", border: "none", color: C.mutedL, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 6 }}>
          <textarea ref={area} value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
            placeholder={escribiendo ? "Está respondiendo…" : esEquipo ? "Escribe en #equipo… (si no mencionas a nadie, contesta Dirección)" : "Escribe a " + (dep?.nombre || "") + "…"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(160, el.scrollHeight) + "px"; }}
            style={{ flex: 1, resize: "none", background: "transparent", border: "none", outline: "none", color: C.text, padding: "7px 8px", fontFamily: F, fontSize: 14, lineHeight: 1.45, maxHeight: 160 }} />
          <button onClick={() => enviar()} disabled={!texto.trim() || escribiendo || enviando}
            style={{ width: 38, height: 38, borderRadius: 9, border: "none", cursor: texto.trim() && !escribiendo ? "pointer" : "default", background: texto.trim() && !escribiendo ? C.accent : C.border, color: "#000", fontSize: 16, fontWeight: 800 }}>➤</button>
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 12.5, color: C.red }}>{error}</div>}
      </div>
    </div>
  );
}
