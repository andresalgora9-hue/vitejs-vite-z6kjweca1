// ============================================================
// OficioYa · ADMIN — Objetivo de ingresos del mes: cómo vamos ahora mismo
// Datos: RPC mkt_objetivo / mkt_objetivo_guardar (clave de admin del CRM de captación)
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { db } from "../supabase";
import { C, F, Card, eur } from "./apUi";

type J = any;
const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const nombreMes = (ym: string) => MESES_L[Number(String(ym).slice(5, 7)) - 1] || ym;

export function useObjetivo(clave: string) {
  const [data, setData] = useState<J | null>(null);
  const [error, setError] = useState("");
  const recargar = useCallback(async () => {
    const { data: d, error: e } = await db.rpc("mkt_objetivo", { p_clave: clave });
    if (e) { setError(e.message); return; }
    setError(""); setData(d);
  }, [clave]);
  useEffect(() => { recargar(); }, [recargar]);
  const guardar = async (valor: number) => {
    const { data: d, error: e } = await db.rpc("mkt_objetivo_guardar", { p_clave: clave, p_valor: valor });
    if (e) { setError(e.message); return false; }
    setData(d); return true;
  };
  return { data, error, recargar, guardar };
}

export function BarraObjetivo({ clave }: { clave: string }) {
  const { data: o, error, guardar } = useObjetivo(clave);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  if (error && !o) return null;
  if (!o) return <Card><div style={{ color: C.mutedL, fontSize: 13 }}>Cargando objetivo del mes…</div></Card>;

  const obj = Number(o.objetivo) || 0;
  const ing = Number(o.ingresos) || 0;
  const dia = Number(o.dia) || 1, dias = Number(o.dias_mes) || 30;
  const quedan = Math.max(0, dias - dia);
  const ritmoDia = ing / dia;
  const proyeccion = ritmoDia * dias;
  const deberias = obj * (dia / dias);
  const falta = Math.max(0, obj - ing);
  const necesitasDia = quedan > 0 ? falta / quedan : falta;
  const pct = obj > 0 ? ing / obj : 0;
  const pctProy = obj > 0 ? proyeccion / obj : 0;
  const col = pctProy >= 1 ? C.green : pctProy >= 0.8 ? C.orange : C.red;
  const escala = Math.max(obj, proyeccion, ing) * 1.04 || 1;
  const x = (v: number) => Math.min(100, (v / escala) * 100) + "%";
  const mes = nombreMes(o.mes);

  return (
    <Card accent={col + "66"} style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontFamily: F }}>
          <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>Objetivo de {mes}</div>
          {editando ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
              <input autoFocus value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric"
                onKeyDown={async (e) => { if (e.key === "Enter" && valor) { if (await guardar(Number(valor))) setEditando(false); } if (e.key === "Escape") setEditando(false); }}
                style={{ width: 120, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "7px 9px", fontFamily: F, fontSize: 16, fontWeight: 800 }} />
              <span style={{ color: C.mutedL }}>€</span>
              <button onClick={async () => { if (valor && await guardar(Number(valor))) setEditando(false); }} style={{ fontFamily: F, fontWeight: 800, fontSize: 12.5, padding: "7px 12px", borderRadius: 8, border: "none", background: C.accent, color: "#000", cursor: "pointer" }}>Guardar</button>
              <button onClick={() => setEditando(false)} style={{ fontFamily: F, fontSize: 12.5, padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, background: "transparent", color: C.mutedL, cursor: "pointer" }}>Cancelar</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 800 }}>{eur(ing)}</span>
              <span style={{ fontSize: 14, color: C.mutedL }}>de {eur(obj)}</span>
              <button onClick={() => { setValor(String(Math.round(obj))); setEditando(true); }} title="Cambiar objetivo" style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedL, fontSize: 14, padding: 2 }}>✎</button>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", fontFamily: F }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: col }}>{Math.round(pct * 100)}%</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>día {dia} de {dias}</div>
        </div>
      </div>

      <div style={{ position: "relative", height: 22, background: C.surface, borderRadius: 11, overflow: "visible" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: x(proyeccion), background: col + "26", borderRadius: 11 }} title={"Si sigues a este ritmo: " + eur(proyeccion)} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: x(ing), background: "linear-gradient(90deg," + col + "bb," + col + ")", borderRadius: 11, transition: "width .6s" }} />
        <div style={{ position: "absolute", left: x(deberias), top: -5, bottom: -5, width: 2, background: C.text, opacity: 0.7 }} title={"Donde deberías ir hoy: " + eur(deberias)} />
        <div style={{ position: "absolute", left: x(obj), top: -5, bottom: -5, width: 3, background: C.green, borderRadius: 2 }} title={"Objetivo: " + eur(obj)} />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.mutedL, marginTop: 8, fontFamily: F }}>
        <span><b style={{ color: col }}>■</b> Llevas {eur(ing)}</span>
        <span><b style={{ color: col, opacity: 0.4 }}>■</b> A este ritmo acabarías en {eur(proyeccion)}</span>
        <span><b style={{ color: C.text }}>|</b> Hoy deberías ir por {eur(deberias)}</span>
        <span><b style={{ color: C.green }}>|</b> Objetivo</span>
      </div>
      <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 9, background: col + "14", border: "1px solid " + col + "44", fontSize: 13, lineHeight: 1.45, fontFamily: F }}>
        {falta <= 0 ? <>🎉 <b>Objetivo cumplido.</b> Llevas {eur(ing - obj)} por encima.</>
          : quedan === 0 ? <>Hoy es el último día del mes: faltan <b>{eur(falta)}</b> para el objetivo.</>
          : <>Te faltan <b>{eur(falta)}</b>: necesitas <b>{eur(necesitasDia)} al día</b> en los {quedan} días que quedan (ahora vas a {eur(ritmoDia)} al día).
            {pctProy >= 1 ? " A este ritmo lo cumples." : pctProy >= 0.8 ? " Vas cerca: un empujón y llegas." : " A este ritmo no llegas."}</>}
      </div>
    </Card>
  );
}
