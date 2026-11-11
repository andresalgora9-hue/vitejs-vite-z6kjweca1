// ============================================================
// OficioYa · ADMIN — Opiniones de un profesional (11/11/2026)
// Las opiniones que dejan sus clientes con su enlace salen al momento en su
// web (aficioya.com/pro/<slug>). Desde aquí se ocultan o se vuelven a mostrar
// (reviews.approved). La nota y el número de opiniones se recalculan solos.
// ============================================================
import React, { useEffect, useState } from "react";
import { db } from "../supabase";
import { C, Btn, Pill, Titulo, fecha } from "./apUi";

const slug = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function OpinionesPro({ proId, nombre, oficio }: { proId: string; nombre: string; oficio?: string | null }) {
  const [ops, setOps] = useState<any[] | null>(null);
  const [ocupado, setOcupado] = useState("");
  const web = "https://www.aficioya.com/pro/" + slug((nombre || "") + " " + (oficio || ""));

  const cargar = () => {
    db.from("reviews").select("id,client_name,stars,text,created_at,approved,origen")
      .eq("worker_id", proId).order("created_at", { ascending: false })
      .then(({ data, error }: any) => setOps(error ? [] : (data || [])));
  };
  useEffect(cargar, [proId]);

  const cambiar = async (id: string, approved: boolean) => {
    setOcupado(id);
    const { error } = await db.from("reviews").update({ approved }).eq("id", id);
    setOcupado("");
    if (error) { alert("Error: " + error.message); return; }
    cargar();
  };

  const n = (ops || []).filter((o) => o.approved !== false).length;
  return (
    <>
      <Titulo accion={<Btn small outline href={web}>Ver su web</Btn>}>Opiniones ({n} en su web)</Titulo>
      {ops === null && <div style={{ fontSize: 13, color: C.muted }}>Cargando…</div>}
      {ops && ops.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Todavía no tiene opiniones. Las pide desde su perfil con su enlace (…/opinion).</div>}
      {(ops || []).map((o) => (
        <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid " + C.border + "55", fontSize: 13, opacity: o.approved === false ? 0.6 : 1 }}>
          <div style={{ minWidth: 0 }}>
            <div><b>{o.client_name || "Cliente"}</b> · <span style={{ color: C.accent }}>{"★".repeat(Math.max(0, Math.min(5, Number(o.stars) || 0)))}</span> · <span style={{ color: C.muted }}>{fecha(o.created_at)}{o.origen === "enlace" ? " · por su enlace" : ""}</span></div>
            {o.text && <div style={{ color: C.mutedL, marginTop: 3, lineHeight: 1.45 }}>“{o.text}”</div>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: "0 0 auto" }}>
            {o.approved === false ? <Pill texto="Oculta" color={C.muted} /> : <Pill texto="En su web" color={C.green} />}
            {o.approved === false
              ? <Btn small outline color={C.green} disabled={ocupado === o.id} onClick={() => cambiar(o.id, true)}>Mostrar</Btn>
              : <Btn small outline color={C.red} disabled={ocupado === o.id} onClick={() => cambiar(o.id, false)}>Ocultar</Btn>}
          </div>
        </div>
      ))}
    </>
  );
}
