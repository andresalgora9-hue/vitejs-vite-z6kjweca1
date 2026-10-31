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

const ddmm = (f: string) => { const t = String(f).slice(0, 10); return t.slice(8, 10) + "/" + t.slice(5, 7); };
const corto = (f: string) => { const t = String(f).slice(0, 10); return Number(t.slice(8, 10)) + " " + (MESES_L[Number(t.slice(5, 7)) - 1] || "").slice(0, 3); };
const finDeMes = (ymd: string) => { const d = new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)), 0); return ymd.slice(0, 8) + String(d.getDate()).padStart(2, "0"); };

// Barra de objetivo que sigue al filtro de fechas del panel: mes en curso, 7 días, 30 días, mes anterior o rango libre.
// El objetivo mensual se reparte por días; debajo, el objetivo de cada semana (lunes a domingo) y cómo va.
export function BarraObjetivo({ clave, desde, hasta, rango }: { clave: string; desde: string; hasta: string; rango?: string }) {
  const [o, setO] = useState<J | null>(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  // "7 días" = semana en curso (lunes a domingo, se reinicia cada lunes)
  // "30 días" y "Este mes" = mes en curso (del 1 al último día, se reinicia cada día 1)
  const modoSemana = rango === "7";
  const modoMes = rango === "mes" || rango === "30";
  const fRef = hasta || desde;
  const lunes = (() => { const d = new Date(fRef + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
  const iso = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const domingo = new Date(lunes.getTime() + 6 * 86400000);
  const d1 = modoSemana ? iso(lunes) : modoMes ? fRef.slice(0, 8) + "01" : desde;
  const d2 = modoSemana ? iso(domingo) : modoMes ? finDeMes(fRef) : hasta;

  const cargar = useCallback(async () => {
    if (!d1 || !d2) return;
    const { data, error: e } = await db.rpc("mkt_objetivo_periodo", { p_clave: clave, p_desde: d1, p_hasta: d2 });
    if (e) { setError(e.message); return; }
    setError(""); setO(data);
  }, [clave, d1, d2]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!valor) return;
    const { error: e } = await db.rpc("mkt_objetivo_guardar", { p_clave: clave, p_valor: Number(valor) });
    if (e) { setError(e.message); return; }
    setEditando(false); cargar();
  };

  if (error && !o) return null;
  if (!o) return <Card><div style={{ color: C.mutedL, fontSize: 13 }}>Cargando objetivo…</div></Card>;

  const objMes = Number(o.objetivo_mes) || 0;
  const obj = Number(o.objetivo) || 0;
  const ing = Number(o.ingresos) || 0;
  const dias = Number(o.dias) || 1;
  const hoy = String(o.hoy);
  const transcurridos = Math.max(0, Math.min(dias, Math.round((new Date(hoy).getTime() - new Date(String(o.desde)).getTime()) / 86400000) + 1));
  const enCurso = transcurridos > 0 && transcurridos < dias;
  const quedan = dias - transcurridos;
  const deberias = obj * (transcurridos / dias);
  const ritmoDia = transcurridos > 0 ? ing / transcurridos : 0;
  const proyeccion = enCurso ? ritmoDia * dias : ing;
  const falta = Math.max(0, obj - ing);
  const pct = obj > 0 ? ing / obj : 0;
  const ref = enCurso ? (obj > 0 ? proyeccion / obj : 0) : pct;
  const col = ref >= 1 ? C.green : ref >= 0.8 ? C.orange : C.red;
  const escala = Math.max(obj, proyeccion, ing) * 1.04 || 1;
  const x = (v: number) => Math.min(100, (v / escala) * 100) + "%";
  const mesCompleto = String(o.desde).slice(8, 10) === "01" && String(o.hasta).slice(0, 10) === finDeMes(String(o.desde).slice(0, 10));
  const titulo = modoSemana ? "Objetivo de esta semana · lun " + corto(o.desde) + " – dom " + corto(o.hasta)
    : modoMes || mesCompleto ? "Objetivo de " + nombreMes(String(o.desde).slice(0, 7))
    : dias === 7 ? "Objetivo semanal · " + ddmm(o.desde) + " – " + ddmm(o.hasta)
    : "Objetivo del periodo · " + ddmm(o.desde) + " – " + ddmm(o.hasta) + " (" + dias + " días)";
  const semanas: J[] = dias > 7 ? (o.semanas || []) : [];

  return (
    <Card accent={col + "66"} style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontFamily: F }}>
          <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>{titulo}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{eur(ing)}</span>
            <span style={{ fontSize: 14, color: C.mutedL }}>de {eur(obj)}</span>
            {!modoMes && <span style={{ fontSize: 12, color: C.muted }}>({eur(objMes)} al mes repartido por días)</span>}
            {(modoMes || modoSemana) && <span style={{ fontSize: 11.5, color: C.muted }}>· se reinicia {modoSemana ? "cada lunes" : "el día 1"}</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", fontFamily: F }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: col }}>{Math.round(pct * 100)}%</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>{enCurso ? "día " + transcurridos + " de " + dias : transcurridos === 0 ? "aún no ha empezado" : "periodo completo"}</div>
        </div>
      </div>

      <div style={{ position: "relative", height: 22, background: C.surface, borderRadius: 11 }}>
        {enCurso && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: x(proyeccion), background: col + "26", borderRadius: 11 }} title={"A este ritmo: " + eur(proyeccion)} />}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: x(ing), background: "linear-gradient(90deg," + col + "bb," + col + ")", borderRadius: 11, transition: "width .6s" }} />
        {enCurso && <div style={{ position: "absolute", left: x(deberias), top: -5, bottom: -5, width: 2, background: C.text, opacity: 0.7 }} title={"Hoy deberías ir por " + eur(deberias)} />}
        <div style={{ position: "absolute", left: x(obj), top: -5, bottom: -5, width: 3, background: C.green, borderRadius: 2 }} title={"Objetivo: " + eur(obj)} />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.mutedL, marginTop: 8, fontFamily: F }}>
        <span><b style={{ color: col }}>■</b> Llevas {eur(ing)}</span>
        {enCurso && <span><b style={{ color: col, opacity: 0.4 }}>■</b> A este ritmo acabarías en {eur(proyeccion)}</span>}
        {enCurso && <span><b style={{ color: C.text }}>|</b> Hoy deberías ir por {eur(deberias)}</span>}
        <span><b style={{ color: C.green }}>|</b> Objetivo {eur(obj)}</span>
      </div>
      <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 9, background: col + "14", border: "1px solid " + col + "44", fontSize: 13, lineHeight: 1.45, fontFamily: F }}>
        {falta <= 0 ? <>🎉 <b>Objetivo cumplido.</b> Llevas {eur(ing - obj)} por encima.</>
          : !enCurso ? <>{transcurridos === 0 ? "Este periodo aún no ha empezado." : <>Se quedó en <b>{eur(ing)}</b> de {eur(obj)}: faltaron <b>{eur(falta)}</b> ({Math.round(pct * 100)}%).</>}</>
          : <>Te faltan <b>{eur(falta)}</b>: necesitas <b>{eur(falta / Math.max(1, quedan))} al día</b> en los {quedan} día{quedan > 1 ? "s" : ""} que quedan (ahora vas a {eur(ritmoDia)} al día).
            {ref >= 1 ? " A este ritmo lo cumples." : ref >= 0.8 ? " Vas cerca: un empujón y llegas." : " A este ritmo no llegas."}</>}
      </div>

      {semanas.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11.5, color: C.mutedL, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8, fontFamily: F }}>
            Objetivos semanales · {eur(Number(o.objetivo_semana) || 0)} por semana completa
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            {semanas.map((w: J, i: number) => {
              const wi = Number(w.ingresos) || 0, wo = Number(w.objetivo) || 0;
              const esperado = w.en_curso ? wo * (Number(w.transcurridos) / Math.max(1, Number(w.dias))) : wo;
              const r = esperado > 0 ? wi / esperado : 0;
              const c = w.futura ? C.muted : r >= 1 ? C.green : r >= 0.8 ? C.orange : C.red;
              return (
                <div key={i} style={{ background: C.surface, border: "1px solid " + (w.en_curso ? C.accent + "88" : C.border), borderRadius: 10, padding: "9px 10px", fontFamily: F }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.mutedL, marginBottom: 4 }}>
                    <span>{corto(w.desde)} – {corto(w.hasta)}</span>
                    {w.en_curso && <span style={{ color: C.accent, fontWeight: 800 }}>en curso</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: w.futura ? C.mutedL : C.text }}>{w.futura ? "—" : eur(wi)} <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>/ {eur(wo)}</span></div>
                  <div style={{ height: 6, background: C.bg, borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
                    <div style={{ width: Math.min(100, wo > 0 ? (wi / wo) * 100 : 0) + "%", height: "100%", background: c }} />
                  </div>
                  <div style={{ fontSize: 11, color: c, fontWeight: 700, marginTop: 4 }}>
                    {w.futura ? "por venir" : w.en_curso ? (r >= 1 ? "va bien" : "por debajo del ritmo") : wi >= wo ? "✓ cumplida" : Math.round((wi / Math.max(1, wo)) * 100) + "% del objetivo"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: F }}>
        {editando ? (
          <>
            <span style={{ fontSize: 12.5, color: C.mutedL }}>Objetivo mensual:</span>
            <input autoFocus value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric"
              onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setEditando(false); }}
              style={{ width: 110, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "6px 9px", fontFamily: F, fontSize: 14, fontWeight: 800 }} />
            <span style={{ color: C.mutedL }}>€</span>
            <button onClick={guardar} style={{ fontFamily: F, fontWeight: 800, fontSize: 12.5, padding: "6px 12px", borderRadius: 8, border: "none", background: C.accent, color: "#000", cursor: "pointer" }}>Guardar</button>
            <button onClick={() => setEditando(false)} style={{ fontFamily: F, fontSize: 12.5, padding: "6px 10px", borderRadius: 8, border: "1px solid " + C.border, background: "transparent", color: C.mutedL, cursor: "pointer" }}>Cancelar</button>
          </>
        ) : (
          <button onClick={() => { setValor(String(Math.round(objMes))); setEditando(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedL, fontFamily: F, fontSize: 12, padding: 0 }}>
            ✎ Objetivo mensual: <b style={{ color: C.text }}>{eur(objMes)}</b> (≈ {eur(objMes * 7 / 30.4)} por semana)
          </button>
        )}
      </div>
    </Card>
  );
}
