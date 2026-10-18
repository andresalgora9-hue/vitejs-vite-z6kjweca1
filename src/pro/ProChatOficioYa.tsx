// ============================================================
// OficioYa · Panel PROFESIONAL — chat con OficioYa (dudas de facturas, leads...)
// Los mensajes llegan al admin, en Mensajes → "Con OficioYa".
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import { db } from "../supabase";
import { C, F, Card, Boton } from "./proComun";

const ADMIN_ID = "00000000-0000-0000-0000-000000000002";
const FN = "https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1";

interface Msg { id: string; from_id: string; to_id: string; text: string; read: boolean; created_at: string; }

// La tabla de mensajes guarda la hora sin zona (es UTC)
const ms = (s: string) => new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z").getTime();
const hora = (s: string) => new Date(ms(s)).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function ProChatOficioYa({ user, onToast }: { user: { id: string; name: string }; onToast?: (m: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const { data } = await db
      .from("messages")
      .select("id,from_id,to_id,text,read,created_at")
      .or(`and(from_id.eq.${user.id},to_id.eq.${ADMIN_ID}),and(from_id.eq.${ADMIN_ID},to_id.eq.${user.id})`)
      .order("created_at", { ascending: false })
      .limit(60);
    setMsgs(((data || []) as Msg[]).reverse());
  }, [user.id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const canal = db
      .channel("chat_oy_" + user.id)
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "messages", filter: "to_id=eq." + user.id }, () => cargar())
      .subscribe();
    const reloj = setInterval(cargar, 45000);
    return () => { db.removeChannel(canal); clearInterval(reloj); };
  }, [user.id, cargar]);

  const sinLeer = msgs.filter((m) => m.from_id === ADMIN_ID && !m.read);

  useEffect(() => {
    if (!abierto) return;
    if (sinLeer.length) db.from("messages").update({ read: true }).in("id", sinLeer.map((m) => m.id)).then(() => {});
    setTimeout(() => finRef.current?.scrollIntoView({ block: "end" }), 50);
  }, [abierto, msgs.length]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    const { error } = await db.from("messages").insert({ from_id: user.id, to_id: ADMIN_ID, text: t, read: false });
    setEnviando(false);
    if (error) { onToast?.("No se ha podido enviar. Inténtalo de nuevo."); return; }
    setTexto("");
    fetch(FN + "/notify-admin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "mensaje_admin", remitente: user.name + " (profesional)", texto: t }),
    }).catch(() => {});
    cargar();
  };

  return (
    <Card accent={sinLeer.length ? C.accent : undefined}>
      <button onClick={() => setAbierto(!abierto)} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none",
        padding: 0, cursor: "pointer", fontFamily: F, textAlign: "left",
      }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", color: C.text, fontWeight: 800, fontSize: 14 }}>Habla con OficioYa</span>
          <span style={{ display: "block", color: C.mutedL, fontSize: 12.5, marginTop: 2 }}>Dudas con tus facturas, tus leads o el pago</span>
        </span>
        {sinLeer.length > 0 && (
          <span style={{ background: C.accent, color: "#000", borderRadius: 99, minWidth: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, padding: "0 6px" }}>{sinLeer.length}</span>
        )}
        <span style={{ color: C.mutedL, fontSize: 18 }}>{abierto ? "▾" : "›"}</span>
      </button>

      {abierto && (
        <div style={{ marginTop: 12 }}>
          <div style={{ maxHeight: 320, overflowY: "auto", background: C.bg, border: "1px solid " + C.border, borderRadius: 10, padding: "6px 4px" }}>
            {msgs.length === 0 && <div style={{ color: C.muted, fontSize: 13, padding: 12, textAlign: "center" }}>Escríbenos y te respondemos aquí mismo.</div>}
            {msgs.map((m) => {
              const mio = m.from_id === user.id;
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: mio ? "flex-end" : "flex-start", padding: "4px 6px" }}>
                  <div style={{
                    maxWidth: "82%", borderRadius: 10, padding: "8px 10px", fontSize: 13.5, color: C.text,
                    background: mio ? C.accent + "22" : C.card, border: "1px solid " + (mio ? C.accent + "55" : C.border),
                  }}>
                    {!mio && <div style={{ fontSize: 11, color: C.orange, fontWeight: 800, marginBottom: 3 }}>OficioYa</div>}
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4, textAlign: "right" }}>{hora(m.created_at)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={finRef} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "flex-end" }}>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Escribe tu mensaje..." style={{
              flex: 1, background: C.bg, border: "1px solid " + C.border, borderRadius: 9, color: C.text,
              padding: "10px 12px", fontFamily: F, fontSize: 15, resize: "vertical", outline: "none",
            }} />
            <div style={{ width: 96, display: "flex" }}>
              <Boton onClick={enviar} disabled={enviando || !texto.trim()}>{enviando ? "..." : "Enviar"}</Boton>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
