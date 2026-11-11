// ============================================================
// OficioYa · Panel PROFESIONAL — «Mi web» (11/11/2026)
// Enlace a su web pública (aficioya.com/pro/<slug>), enlace para pedir
// opiniones a sus clientes (salen al momento en su web) y sus opiniones.
// Lo monta el Perfil (ProPerfil.tsx), en el apartado «Tu web profesional».
// ============================================================
import React, { useEffect, useState } from "react";
import { db } from "../supabase";
import { C, F, Card, Boton, fecha } from "./proComun";

// € + IVA por cada cliente que le pide presupuesto desde su web (oy_config.precio_lead_web_pro),
// solo con las condiciones de su web aceptadas. Si no, ese cliente le cuesta como cualquier otro suyo
// (lo decide pro_leads_precio_pro). Las condiciones las lee de oy_condiciones_web, si ya existe.
const PRECIO_WEB = 15;

const slug = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const primero = (n: string) => {
  const p = (n || "").trim().split(/\s+/)[0] || "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

interface Opinion { id: string; client_name: string | null; stars: number | null; text: string | null; created_at: string; approved: boolean | null }

export default function ProMiWeb({ user }: { user: { id: string; name: string; trade?: string | null; company_name?: string | null } }) {
  const web = "https://www.aficioya.com/pro/" + slug((user.name || "") + " " + (user.trade || ""));
  const enlaceOpinion = web + "/opinion";
  const nombre = primero(user.name);
  const mensaje = "Hola, soy " + nombre + (user.company_name ? ", de " + user.company_name.trim() : "") +
    ". Si te ha gustado el trabajo, ¿me dejas tu opinión? Es un minuto: " + enlaceOpinion + " ¡Muchas gracias!";
  const [copiado, setCopiado] = useState<"" | "web" | "op">("");
  const [ops, setOps] = useState<Opinion[] | null>(null);
  const [todas, setTodas] = useState(false);
  // null: todavía no hay condiciones que aceptar (o no se han podido leer)
  const [cond, setCond] = useState<{ precio: number; aceptada: boolean } | null>(null);

  useEffect(() => {
    db.from("reviews").select("id,client_name,stars,text,created_at,approved")
      .eq("worker_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }: any) => setOps((data || []) as Opinion[]));
    db.rpc("oy_condiciones_web", { p_pro: user.id }).then(({ data, error }: any) => {
      if (error || !data || !data.vigente) { setCond(null); return; }
      setCond({ precio: Number(data.vigente.precio) || PRECIO_WEB, aceptada: !!data.aceptada });
    }, () => setCond(null));
  }, [user.id]);
  const euros = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

  const copiar = async (t: string, k: "web" | "op") => {
    try { await navigator.clipboard.writeText(t); } catch { window.prompt("Copia el enlace:", t); }
    setCopiado(k); setTimeout(() => setCopiado(""), 2000);
  };
  const compartir = async () => {
    const nav: any = navigator;
    if (nav.share) { try { await nav.share({ title: "Mi web en OficioYa", url: web }); return; } catch { /* cancelado */ } }
    copiar(web, "web");
  };

  const publicadas = (ops || []).filter((o) => o.approved !== false);
  const nota = publicadas.length ? publicadas.reduce((a, o) => a + (Number(o.stars) || 0), 0) / publicadas.length : 0;
  const lista = todas ? (ops || []) : (ops || []).slice(0, 3);

  const caja: React.CSSProperties = {
    display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 10, marginTop: 10,
    background: C.surface, border: "1px solid " + C.border, fontSize: 12.5, fontWeight: 700, color: C.accent,
    wordBreak: "break-all", lineHeight: 1.4,
  };
  const icono = (d: string) => (
    <span style={{ width: 36, height: 36, flex: "0 0 36px", borderRadius: 10, background: "linear-gradient(135deg,#FFD700,#FF8C00)", color: "#1A1200", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
    </span>
  );
  const cabecera = (ic: React.ReactNode, t: string, sub: string) => (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {ic}
      <div><p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: C.text }}>{t}</p><p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>{sub}</p></div>
    </div>
  );
  const estrellas = (n: number) => (
    <span style={{ color: C.accent, letterSpacing: 1, fontSize: 13 }} aria-label={n + " de 5 estrellas"}>{"★".repeat(Math.max(0, Math.min(5, Math.round(n))))}<span style={{ color: C.border }}>{"★".repeat(5 - Math.max(0, Math.min(5, Math.round(n))))}</span></span>
  );

  return (
    <div style={{ fontFamily: F }}>
      <Card style={{ padding: 16, marginBottom: 14 }}>
        {cabecera(icono("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"), "Tu web en OficioYa", "Pública, con tu logo, tus fotos y tus opiniones")}
        <div style={caja}>{web.replace("https://www.", "")}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Boton href={web}>Ver mi web</Boton>
          <Boton outline onClick={() => copiar(web, "web")}>{copiado === "web" ? "Copiado" : "Copiar"}</Boton>
          <Boton outline onClick={compartir}>Compartir</Boton>
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid " + C.border, display: "grid", gap: 8, fontSize: 12.5, color: C.mutedL, lineHeight: 1.45 }}>
          <span>🔎 Es pública: Google puede enseñarla cuando buscan tu nombre o tu oficio en tu ciudad.</span>
          {cond && cond.aceptada ? (
            <span>💶 Cada cliente que te pide presupuesto desde tu web: <b style={{ color: C.text }}>{euros(cond.precio)} € + IVA</b>. Te llega directo a ti.</span>
          ) : cond ? (
            <span>💶 Los clientes de tu web te llegan directos a ti. Si aceptas las condiciones de tu web, cada uno te cuesta <b style={{ color: C.text }}>{euros(cond.precio)} € + IVA</b>; si no, lo mismo que el resto de tus clientes.</span>
          ) : (
            <span>💶 Los clientes que te piden presupuesto desde tu web te llegan directos a ti, al mismo precio que el resto de tus clientes.</span>
          )}
        </div>
      </Card>

      <Card style={{ padding: 16, marginBottom: 14 }}>
        {cabecera(icono("M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"), "Pide opiniones a tus clientes", "Salen al momento en tu web")}
        <p style={{ margin: "12px 0 0", fontSize: 13, color: C.mutedL, lineHeight: 1.5 }}>
          Mándales este enlace al terminar un trabajo. Ponen su nota, su nombre y su comentario, y la opinión aparece en tu web.
        </p>
        <div style={caja}>{enlaceOpinion.replace("https://www.", "")}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Boton href={"https://wa.me/?text=" + encodeURIComponent(mensaje)} color={C.green}>Enviar por WhatsApp</Boton>
          <Boton outline onClick={() => copiar(enlaceOpinion, "op")}>{copiado === "op" ? "Copiado" : "Copiar enlace"}</Boton>
        </div>
        <p style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: C.muted }}>Así le llega a tu cliente</p>
        <div style={{ maxWidth: 320, padding: "9px 11px 7px", borderRadius: "12px 12px 12px 4px", background: "#0B3B33", border: "1px solid rgba(125,240,196,.18)", fontSize: 13, lineHeight: 1.45, color: "#E7F6F1", wordBreak: "break-word" }}>
          {mensaje}
        </div>
      </Card>

      <Card style={{ padding: 16, marginBottom: 14 }}>
        {cabecera(icono("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"), "Tus opiniones", publicadas.length ? "Las que salen en tu web" : "Todavía no tienes ninguna")}
        {ops === null && <p style={{ margin: "12px 0 0", fontSize: 13, color: C.muted }}>Cargando…</p>}
        {publicadas.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <b style={{ fontSize: 26, color: C.accent, lineHeight: 1 }}>{nota.toFixed(1).replace(".", ",")}</b>
            {estrellas(nota)}
            <span style={{ fontSize: 12.5, color: C.muted }}>{publicadas.length} {publicadas.length === 1 ? "opinión" : "opiniones"}</span>
          </div>
        )}
        {lista.map((o) => (
          <div key={o.id} style={{ marginTop: 10, padding: 12, borderRadius: 10, background: C.surface, border: "1px solid " + C.border, opacity: o.approved === false ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <b style={{ fontSize: 13.5, color: C.text }}>{o.client_name || "Cliente"}</b>
              <span style={{ fontSize: 11, fontWeight: 800, color: o.approved === false ? C.muted : C.green }}>{o.approved === false ? "Oculta por OficioYa" : "En tu web"}</span>
            </div>
            <div style={{ marginTop: 4 }}>{estrellas(Number(o.stars) || 0)}</div>
            {o.text && <p style={{ margin: "6px 0 0", fontSize: 13, color: C.mutedL, lineHeight: 1.5 }}>“{o.text}”</p>}
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: C.muted }}>{fecha(o.created_at)}</p>
          </div>
        ))}
        {(ops || []).length > 3 && !todas && (
          <div style={{ marginTop: 10, display: "flex" }}><Boton small outline onClick={() => setTodas(true)}>Ver todas ({(ops || []).length})</Boton></div>
        )}
      </Card>
    </div>
  );
}
