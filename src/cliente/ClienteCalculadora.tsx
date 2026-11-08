// ============================================================
// OficioYa · ÁREA DEL CLIENTE — Calculadoras (aporte de valor):
// precio orientativo de pintura y fontanería, litros de pintura y «¿es buen precio?»
// ============================================================
import React, { useState } from "react";
import { Icono, REF, eurRango, veredicto, claveRef, miles, parseImporte, type RefSel } from "./clienteComun";
import { RangoPrecios } from "./ClientePresupuestos";
import type { PrefillSolicitud } from "./ClienteSolicitudes";
import type { Presupuesto } from "./clienteComun";

type Modo = "pintura" | "fontaneria" | "precio";

function Selector({ grupo, tipo, tam, setTipo, setTam }: { grupo: "pintura" | "fontaneria"; tipo: string; tam: string; setTipo: (k: string) => void; setTam: (k: string) => void }) {
  const t = REF[grupo].tipos[tipo];
  return (
    <>
      <p className="cy-lbl" style={{ marginTop: 0 }}>{grupo === "pintura" ? "¿Qué pintamos?" : "¿Qué pasa?"}</p>
      <div className="cy-row">
        {Object.entries(REF[grupo].tipos).map(([k, x]) => <button key={k} className="cy-chip" aria-pressed={tipo === k} onClick={() => { setTipo(k); setTam(REF[grupo].tipos[k].tamanos[1]?.k || REF[grupo].tipos[k].tamanos[0].k); }}>{x.titulo}</button>)}
      </div>
      {t && (
        <>
          <p className="cy-q">{t.pregunta}</p>
          <div className="cy-row">
            {t.tamanos.map((x) => <button key={x.k} className="cy-chip" aria-pressed={tam === x.k} onClick={() => setTam(x.k)}>{x.t}</button>)}
          </div>
        </>
      )}
    </>
  );
}

export default function ClienteCalculadora({ onPedir, onGuardar }: { onPedir: (p: PrefillSolicitud) => void; onGuardar: (p: Partial<Presupuesto>) => void }) {
  const [modo, setModo] = useState<Modo>("pintura");
  const [pTipo, setPTipo] = useState("piso_completo");
  const [pTam, setPTam] = useState("p2");
  const [fTipo, setFTipo] = useState("atasco");
  const [fTam, setFTam] = useState("simple");
  // Litros de pintura
  const [m2, setM2] = useState(15);
  const [techo, setTecho] = useState(true);
  const [manos, setManos] = useState(2);
  // ¿Es buen precio?
  const [vGrupo, setVGrupo] = useState<"pintura" | "fontaneria">("pintura");
  const [vTipo, setVTipo] = useState("piso_completo");
  const [vTam, setVTam] = useState("p2");
  const [vImporte, setVImporte] = useState("");

  const pRef = REF.pintura.tipos[pTipo]?.tamanos.find((x) => x.k === pTam);
  const fRef = REF.fontaneria.tipos[fTipo]?.tamanos.find((x) => x.k === fTam);
  const litros = Math.ceil((m2 * (techo ? 3.4 : 2.6) * manos) / 11);
  const botes15 = Math.floor(litros / 15);
  const resto = litros - botes15 * 15;
  const botes4 = Math.ceil(resto / 4);
  const vRef = REF[vGrupo].tipos[vTipo]?.tamanos.find((x) => x.k === vTam);
  const vNum = parseImporte(vImporte);
  const ver = vRef && !isNaN(vNum) && vNum > 0 ? veredicto(vNum, vRef.r) : null;
  const sel = (g: "pintura" | "fontaneria", t: string, k: string): RefSel => ({ grupo: g, tipo: t, tam: k });
  const titulo = (g: "pintura" | "fontaneria", t: string, k: string) => {
    const x = REF[g].tipos[t]; const s = x?.tamanos.find((y) => y.k === k);
    return x ? x.titulo + (s ? " (" + s.t + ")" : "") : "";
  };

  return (
    <div className="cy-wrap" style={{ paddingTop: 18 }}>
      <p className="cy-eyebrow">Calcula antes de pedir</p>
      <h1 className="cy-h1" style={{ fontSize: 30, marginTop: 6 }}>¿Cuánto <span>cuesta?</span></h1>
      <p className="cy-sub" style={{ marginTop: 8, marginBottom: 16 }}>Precios orientativos de 2026 para que nadie te cobre de más.</p>

      <div className="cy-seg" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", marginBottom: 14 }}>
        <button aria-pressed={modo === "pintura"} onClick={() => setModo("pintura")}>Pintura</button>
        <button aria-pressed={modo === "fontaneria"} onClick={() => setModo("fontaneria")}>Fontanería</button>
        <button aria-pressed={modo === "precio"} onClick={() => setModo("precio")}>¿Buen precio?</button>
      </div>

      {modo === "pintura" && (
        <>
          <div className="cy-glass cy-card cy-entra">
            <Selector grupo="pintura" tipo={pTipo} tam={pTam} setTipo={setPTipo} setTam={setPTam} />
            {pRef && (
              <div className="cy-ticket">
                <div><small>PRECIO ORIENTATIVO</small><strong>{eurRango(pRef.r)}</strong></div>
                <p>{REF.pintura.tipos[pTipo].hint}</p>
              </div>
            )}
            <button className="cy-btn" style={{ marginTop: 14 }} onClick={() => onPedir({ oficio: "Pintor", ref: claveRef(sel("pintura", pTipo, pTam)) })}>Pedir presupuesto gratis <Icono n="flecha" s={18} w={2.4} /></button>
            <button className="cy-link" style={{ marginTop: 8 }} onClick={() => { setVGrupo("pintura"); setVTipo(pTipo); setVTam(pTam); setModo("precio"); }}>Ya tengo un presupuesto: ¿es buen precio? <Icono n="cheveron" s={15} /></button>
          </div>

          <div className="cy-glass cy-card cy-entra">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ width: 40, height: 40, flex: "0 0 40px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.07)", color: "var(--gold)" }}><Icono n="rodillo" s={20} /></span>
              <div><p className="cy-h3">¿Cuánta pintura necesitas?</p><p className="cy-mini">Para no comprar de más ni quedarte corto.</p></div>
            </div>
            <p className="cy-q" style={{ marginTop: 16 }}>Metros de suelo de lo que vas a pintar</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="cy-icbtn" aria-label="Menos metros" onClick={() => setM2(Math.max(4, m2 - 5))}><span style={{ fontSize: 22, fontWeight: 800 }}>−</span></button>
              <input type="range" min={4} max={200} step={1} value={m2} onChange={(e) => setM2(Number(e.target.value))} style={{ flex: 1, accentColor: "#FFD700" }} aria-label="Metros cuadrados de suelo" />
              <button className="cy-icbtn" aria-label="Más metros" onClick={() => setM2(Math.min(200, m2 + 5))}><span style={{ fontSize: 22, fontWeight: 800 }}>+</span></button>
            </div>
            <p style={{ textAlign: "center", fontWeight: 900, fontSize: 22, marginTop: 6 }}>{m2} m²</p>
            <div className="cy-two" style={{ marginTop: 10 }}>
              <div className="cy-seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <button aria-pressed={!techo} onClick={() => setTecho(false)}>Paredes</button>
                <button aria-pressed={techo} onClick={() => setTecho(true)}>+ Techo</button>
              </div>
              <div className="cy-seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <button aria-pressed={manos === 1} onClick={() => setManos(1)}>1 mano</button>
                <button aria-pressed={manos === 2} onClick={() => setManos(2)}>2 manos</button>
              </div>
            </div>
            <div className="cy-ticket">
              <div><small>PINTURA NECESARIA</small><strong>≈ {litros} litros</strong></div>
              <p>{botes15 > 0 ? botes15 + (botes15 === 1 ? " cubo" : " cubos") + " de 15 L" + (botes4 > 0 ? " + " + botes4 + " de 4 L" : "") : botes4 + (botes4 === 1 ? " bote" : " botes") + " de 4 L"}</p>
            </div>
            <p className="cy-mini" style={{ marginTop: 10 }}>Un litro de pintura plástica cubre unos 10–12 m² por mano. Para cambiar de color o tapar manchas, cuenta con 2 manos.</p>
          </div>
        </>
      )}

      {modo === "fontaneria" && (
        <div className="cy-glass cy-card cy-entra">
          <Selector grupo="fontaneria" tipo={fTipo} tam={fTam} setTipo={setFTipo} setTam={setFTam} />
          {fRef && (
            <div className="cy-ticket">
              <div><small>PRECIO ORIENTATIVO</small><strong>{eurRango(fRef.r)}</strong></div>
              <p>{REF.fontaneria.tipos[fTipo].hint}</p>
            </div>
          )}
          <div style={{ marginTop: 14, padding: 14, borderRadius: 16, background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)" }}>
            <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Antes de que empiece</p>
            {["Pide el precio cerrado (o al menos un máximo) antes de que toque nada.", "Pregunta si el desplazamiento está incluido.", "De noche, en fin de semana o festivo suele costar más."].map((t) => (
              <p key={t} className="cy-mini" style={{ display: "flex", gap: 8, marginBottom: 6, color: "var(--soft)" }}><Icono n="check" s={15} w={2.6} c="#7DF0C4" />{t}</p>
            ))}
          </div>
          <button className="cy-btn" style={{ marginTop: 14 }} onClick={() => onPedir({ oficio: "Fontanero", ref: claveRef(sel("fontaneria", fTipo, fTam)) })}>Pedir presupuesto gratis <Icono n="flecha" s={18} w={2.4} /></button>
          <button className="cy-link" style={{ marginTop: 8 }} onClick={() => { setVGrupo("fontaneria"); setVTipo(fTipo); setVTam(fTam); setModo("precio"); }}>Ya tengo un presupuesto: ¿es buen precio? <Icono n="cheveron" s={15} /></button>
        </div>
      )}

      {modo === "precio" && (
        <div className="cy-glass cy-card cy-entra">
          <p className="cy-h3">¿Te han dado un precio?</p>
          <p className="cy-mini" style={{ marginTop: 2, marginBottom: 14 }}>Dinos qué es y cuánto te piden: te decimos si está en precio.</p>
          <div className="cy-seg" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
            <button aria-pressed={vGrupo === "pintura"} onClick={() => { setVGrupo("pintura"); setVTipo("piso_completo"); setVTam("p2"); }}>Pintura</button>
            <button aria-pressed={vGrupo === "fontaneria"} onClick={() => { setVGrupo("fontaneria"); setVTipo("atasco"); setVTam("simple"); }}>Fontanería</button>
          </div>
          <Selector grupo={vGrupo} tipo={vTipo} tam={vTam} setTipo={setVTipo} setTam={setVTam} />
          <label className="cy-fld" style={{ marginTop: 14 }}>
            <span>¿Cuánto te piden? (€)</span>
            <input className="cy-inp" inputMode="decimal" value={vImporte} onChange={(e) => setVImporte(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="Ej: 1.100" style={{ fontSize: 20, fontWeight: 800 }} />
          </label>
          {vRef && (
            <div style={{ padding: "12px 12px 4px", borderRadius: 16, background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)" }}>
              <p className="cy-mini">Lo habitual: <b style={{ color: "var(--ink)" }}>{eurRango(vRef.r)}</b></p>
              <RangoPrecios rango={vRef.r} marcas={ver ? [{ etiqueta: "Tu precio", importe: vNum }] : []} />
            </div>
          )}
          {ver && (
            <div className="cy-entra" style={{ marginTop: 12, padding: "12px 14px", borderRadius: 16, background: ver.nivel === "justo" ? "rgba(0,214,143,.1)" : ver.nivel === "bajo" ? "rgba(255,255,255,.05)" : "rgba(255,173,138,.1)", border: "1px solid " + (ver.nivel === "justo" ? "rgba(0,214,143,.35)" : ver.nivel === "bajo" ? "rgba(255,255,255,.14)" : "rgba(255,173,138,.4)") }}>
              <p style={{ fontWeight: 900, fontSize: 17, color: ver.nivel === "justo" ? "var(--mint)" : ver.nivel === "bajo" ? "var(--ink)" : "var(--coral)" }}>{ver.txt}</p>
              <p className="cy-mini" style={{ marginTop: 3, color: "var(--soft)" }}>{ver.detalle}</p>
            </div>
          )}
          {ver && (
            <div className="cy-col" style={{ marginTop: 14 }}>
              <button className="cy-btn" onClick={() => onGuardar({ trabajo: titulo(vGrupo, vTipo, vTam).replace(/\s*\(.*\)$/, ""), oficio: REF[vGrupo].oficio, tipo: claveRef(sel(vGrupo, vTipo, vTam)), importe: vNum })}><Icono n="presupuestos" s={18} />Guardar en mis presupuestos</button>
              {ver.nivel !== "justo" && ver.nivel !== "bajo" && (
                <button className="cy-btn-s" onClick={() => onPedir({ oficio: REF[vGrupo].oficio, ref: claveRef(sel(vGrupo, vTipo, vTam)), descripcion: "Me han pedido " + miles(vNum) + " € y quiero comparar." })}><Icono n="chispa" s={17} />Pedir otra opinión gratis</button>
              )}
            </div>
          )}
        </div>
      )}

      <p className="cy-mini" style={{ textAlign: "center", margin: "4px 12px 0" }}>Precios orientativos con mano de obra. El profesional te confirma el precio al ver el trabajo.</p>
    </div>
  );
}
