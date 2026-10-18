// ============================================================
// OficioYa · ADMIN — MENSAJES (todos los chats de la app)
// Cada conversación muestra quién es el cliente y quién el profesional.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../supabase";
import {
  C, F, Card, Btn, Pill, Cabecera, Sel, SeccionProps, ADMIN_IDS, ADMIN_CHAT_ID,
  ts, fechaHora, hace, oficioDe, digitos, waLink, avisarPush, useAncho,
} from "./apUi";

interface Msg { id: string; from_id: string; to_id: string; text: string; read: boolean; created_at: string; is_lead_alert?: boolean; }
interface Persona { id: string; name: string; type: string; phone: string | null; trade: string | null; }

const ROL: Record<string, { t: string; c: string }> = {
  cliente: { t: "Cliente", c: C.blue },
  profesional: { t: "Profesional", c: C.accent },
  admin: { t: "OficioYa", c: C.orange },
  gestor: { t: "OficioYa", c: C.orange },
};

function Texto({ t }: { t: string }) {
  const partes = (t || "").split(/(https?:\/\/\S+)/g);
  return (
    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {partes.map((p, i) => /^https?:\/\//.test(p)
        ? (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(p)
          ? <a key={i} href={p} target="_blank" rel="noreferrer"><img src={p} alt="Imagen" style={{ maxWidth: 220, borderRadius: 8, display: "block", marginTop: 4 }} /></a>
          : <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: C.accent }}>{p}</a>)
        : <React.Fragment key={i}>{p}</React.Fragment>)}
    </span>
  );
}

export default function Mensajes({ aviso }: SeccionProps) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [gente, setGente] = useState<Record<string, Persona>>({});
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<"cp" | "oy" | "todas">("cp");
  const [busca, setBusca] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [destino, setDestino] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const movil = useAncho() < 900;

  const cargar = useCallback(async () => {
    const desde = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 19);
    const { data } = await db.from("messages").select("id,from_id,to_id,text,read,created_at,is_lead_alert")
      .gte("created_at", desde).order("created_at", { ascending: false }).limit(4000);
    const lista = ((data || []) as Msg[]).filter((m) => !m.is_lead_alert);
    setMsgs(lista);
    const ids = Array.from(new Set(lista.flatMap((m) => [m.from_id, m.to_id])));
    const mapa: Record<string, Persona> = {};
    for (let i = 0; i < ids.length; i += 150) {
      const { data: us } = await db.from("users").select("id,name,type,phone,trade").in("id", ids.slice(i, i + 150));
      (us || []).forEach((u: any) => { mapa[u.id] = u; });
    }
    setGente(mapa);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); const t = setInterval(cargar, 30000); return () => clearInterval(t); }, [cargar]);

  const tipoDe = (id: string) => ADMIN_IDS.includes(id) ? "admin" : (gente[id]?.type || "cliente");
  const nombreDe = (id: string) => ADMIN_IDS.includes(id) ? "OficioYa" : (gente[id]?.name || "Usuario borrado");

  const convs = useMemo(() => {
    const m: Record<string, Msg[]> = {};
    msgs.forEach((x) => { const k = [x.from_id, x.to_id].sort().join("|"); (m[k] = m[k] || []).push(x); });
    return Object.entries(m).map(([k, lista]) => {
      const [a, b] = k.split("|");
      const ids = [a, b].sort((x, y) => {
        const orden = (id: string) => ({ cliente: 0, profesional: 1, admin: 2, gestor: 2 } as any)[tipoDe(id)] ?? 3;
        return orden(x) - orden(y);
      });
      const conAdmin = ids.some((id) => ADMIN_IDS.includes(id));
      const sinLeer = lista.filter((x) => !x.read && ADMIN_IDS.includes(x.to_id)).length;
      const sinLeerPro = lista.filter((x) => !x.read && tipoDe(x.to_id) === "profesional").length;
      return { k, ids, lista, ultimo: lista[0], conAdmin, sinLeer, sinLeerPro };
    }).sort((x, y) => ts(y.ultimo.created_at) - ts(x.ultimo.created_at));
  }, [msgs, gente]);

  const visibles = convs.filter((c) =>
    (filtro === "todas" || (filtro === "oy" ? c.conAdmin : !c.conAdmin)) &&
    (!busca.trim() || c.ids.map(nombreDe).join(" ").toLowerCase().includes(busca.toLowerCase()) || c.lista.some((x) => (x.text || "").toLowerCase().includes(busca.toLowerCase()))));

  const conv = abierta ? convs.find((c) => c.k === abierta) : null;
  const otros = conv ? conv.ids.filter((id) => !ADMIN_IDS.includes(id)) : [];

  useEffect(() => {
    if (!conv) return;
    setDestino(otros.find((id) => tipoDe(id) === "cliente") || otros[0] || "");
    const pendientes = conv.lista.filter((x) => !x.read && ADMIN_IDS.includes(x.to_id)).map((x) => x.id);
    if (pendientes.length) db.from("messages").update({ read: true }).in("id", pendientes).then(() => {});
    setTimeout(() => finRef.current?.scrollIntoView({ block: "end" }), 50);
  }, [abierta]);

  const enviar = async () => {
    if (!texto.trim() || !destino) return;
    setEnviando(true);
    const { error } = await db.from("messages").insert({ from_id: ADMIN_CHAT_ID, to_id: destino, text: texto.trim(), read: false });
    setEnviando(false);
    if (error) { aviso("No se ha podido enviar: " + error.message); return; }
    avisarPush(destino, "Mensaje de OficioYa", texto.trim().slice(0, 120));
    setTexto("");
    aviso("Mensaje enviado a " + nombreDe(destino));
    cargar();
  };

  const tab = (id: typeof filtro, txt: string) => (
    <button onClick={() => setFiltro(id)} style={{
      padding: "8px 14px", borderRadius: 8, border: "1px solid " + (filtro === id ? C.accent : C.border), cursor: "pointer", fontFamily: F,
      background: filtro === id ? C.accent + "18" : C.card, color: filtro === id ? C.accent : C.mutedL, fontWeight: 800, fontSize: 13,
    }}>{txt}</button>
  );
  const etiqueta = (id: string) => { const r = ROL[tipoDe(id)] || ROL.cliente; return <Pill texto={r.t} color={r.c} />; };

  return (
    <div>
      <Cabecera titulo="Mensajes" sub="Todos los chats de la app. Los profesionales ya no tienen chat: lo que les escriben llega aquí." />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {tab("cp", "Cliente ↔ Profesional")}{tab("oy", "Con OficioYa")}{tab("todas", "Todas")}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar persona o texto..." style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "8px 10px", fontFamily: F, fontSize: 13, minWidth: 220 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: conv && !movil ? "minmax(260px, 380px) 1fr" : "1fr", gap: 14, alignItems: "start" }}>
        <div style={{ display: conv && movil ? "none" : "block" }}>
          {cargando && <div style={{ color: C.mutedL }}>Cargando mensajes...</div>}
          {!cargando && visibles.length === 0 && <Card><div style={{ color: C.mutedL }}>No hay conversaciones.</div></Card>}
          {visibles.slice(0, 150).map((c) => (
            <div key={c.k} onClick={() => setAbierta(c.k)} style={{
              background: abierta === c.k ? C.cardHi : C.card, border: "1px solid " + (c.sinLeer ? C.orange + "88" : C.border), borderRadius: 12,
              padding: 12, marginBottom: 8, cursor: "pointer",
            }}>
              {c.ids.map((id) => (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, minWidth: 0 }}>
                  {etiqueta(id)}<span style={{ fontWeight: 800, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(id)}</span>
                  {tipoDe(id) === "profesional" && gente[id]?.trade && <span style={{ fontSize: 12, color: C.mutedL }}>· {oficioDe(gente[id].trade)}</span>}
                </div>
              ))}
              <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <b style={{ color: C.text }}>{nombreDe(c.ultimo.from_id)}:</b> {c.ultimo.text}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 11.5, color: C.muted }}>
                <span>hace {hace(c.ultimo.created_at)} · {c.lista.length} mensajes</span>
                {c.sinLeer > 0 && <Pill texto={c.sinLeer + " sin leer"} color={C.orange} />}
                {!c.conAdmin && c.sinLeerPro > 0 && <Pill texto="El profesional no lo ha visto" color={C.red} />}
              </div>
            </div>
          ))}
        </div>

        {conv && (
          <Card style={{ position: movil ? "static" : "sticky", top: 70, marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                {conv.ids.map((id) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                    {etiqueta(id)}<b>{nombreDe(id)}</b>
                    {gente[id]?.phone && digitos(gente[id].phone).length >= 9 && (
                      <>
                        <a href={"tel:" + digitos(gente[id].phone)} style={{ color: C.accent, fontSize: 12.5 }}>{gente[id].phone}</a>
                        <a href={waLink(gente[id].phone)} target="_blank" rel="noreferrer" style={{ color: C.green, fontSize: 12.5 }}>WhatsApp</a>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <Btn small outline color={C.mutedL} onClick={() => setAbierta(null)}>Cerrar</Btn>
            </div>
            <div style={{ maxHeight: "52vh", overflowY: "auto", padding: "4px 2px", background: C.bg, borderRadius: 10, border: "1px solid " + C.border }}>
              {[...conv.lista].reverse().map((x) => {
                const deAdmin = ADMIN_IDS.includes(x.from_id);
                const r = ROL[tipoDe(x.from_id)] || ROL.cliente;
                return (
                  <div key={x.id} style={{ display: "flex", justifyContent: deAdmin ? "flex-end" : "flex-start", padding: "4px 8px" }}>
                    <div style={{ maxWidth: "80%", background: deAdmin ? C.orange + "22" : C.card, border: "1px solid " + (deAdmin ? C.orange + "55" : C.border), borderRadius: 10, padding: "8px 10px", fontSize: 13.5 }}>
                      <div style={{ fontSize: 11, color: r.c, fontWeight: 800, marginBottom: 3 }}>{r.t} · {nombreDe(x.from_id)}</div>
                      <Texto t={x.text} />
                      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4, textAlign: "right" }}>{fechaHora(x.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={finRef} />
            </div>
            {otros.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, color: C.mutedL }}>Responder como OficioYa a:</span>
                  <Sel value={destino} onChange={setDestino} options={otros.map((id) => ({ v: id, l: (ROL[tipoDe(id)]?.t || "") + " · " + nombreDe(id) }))} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Escribe tu respuesta..." style={{ flex: 1, background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "9px 10px", fontFamily: F, fontSize: 13.5, resize: "vertical" }} />
                  <Btn onClick={enviar} disabled={enviando || !texto.trim()}>{enviando ? "..." : "Enviar"}</Btn>
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Le llega como mensaje de OficioYa en su chat y con aviso al móvil.</div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
