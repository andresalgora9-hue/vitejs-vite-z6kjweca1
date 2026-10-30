// ============================================================
// OficioYa · ADMIN — AJUSTES (precios, facturación, reparto)
// ============================================================
import React, { useState } from "react";
import { db } from "../supabase";
import { C, F, Card, Btn, Cabecera, Titulo, Tabla, SeccionProps, eur, oficioDe, fecha, precioLeadDe } from "./apUi";

const CONFIG: { clave: string; label: string; sufijo: string }[] = [
  { clave: "activacion_eur", label: "Alta de profesional nuevo (sin IVA)", sufijo: "€" },
  { clave: "umbral_factura", label: "Facturar al llegar a (leads sin IVA)", sufijo: "€" },
  { clave: "iva_pct", label: "IVA de las facturas", sufijo: "%" },
  { clave: "dias_pago", label: "Días para pagar cada factura", sufijo: "días" },
];

function Numero({ value, onChange, sufijo }: { value: string; onChange: (v: string) => void; sufijo: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" style={{ width: 90, background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "7px 9px", fontFamily: F, fontSize: 14, textAlign: "right" }} />
      <span style={{ color: C.mutedL, fontSize: 13 }}>{sufijo}</span>
    </span>
  );
}

export default function Ajustes({ d, recargar, aviso, irA }: SeccionProps) {
  const [precios, setPrecios] = useState<Record<string, string>>(Object.fromEntries(d.precios.map((p) => [p.trade_key, String(p.price).replace(".", ",")])));
  const [cfg, setCfg] = useState<Record<string, string>>(Object.fromEntries(CONFIG.map((c) => [c.clave, String(d.config[c.clave] ?? "").replace(".", ",")])));
  const [nuevaClave, setNuevaClave] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const n = (s: string) => Number(String(s).replace(",", "."));

  const guardarPrecio = async (k: string, v: string) => {
    if (!(n(v) >= 0)) { aviso("Precio no válido"); return; }
    setOcupado(true);
    const { error } = await db.rpc("oy_set_precio", { p_trade_key: k, p_price: n(v) });
    setOcupado(false);
    if (error) { aviso("Error: " + error.message); return; }
    aviso("Precio de " + (k === "_default" ? "otros oficios" : oficioDe(k)) + " guardado");
    recargar();
  };
  const guardarCfg = async (k: string) => {
    if (!(n(cfg[k]) >= 0)) { aviso("Valor no válido"); return; }
    setOcupado(true);
    const { error } = await db.rpc("oy_set_config", { p_clave: k, p_valor: n(cfg[k]) });
    setOcupado(false);
    if (error) { aviso("Error: " + error.message); return; }
    aviso("Ajuste guardado");
    recargar();
  };

  return (
    <div>
      <Cabecera titulo="Ajustes" sub="Precios y reglas de facturación. Los cambios valen para los leads y facturas nuevos, no para los ya emitidos." />

      <Titulo>Precio por lead (sin IVA)</Titulo>
      <Card>
        {[...d.precios].sort((a, b) => (a.trade_key === "_default" ? 1 : b.trade_key === "_default" ? -1 : a.trade_key.localeCompare(b.trade_key))).map((p) => (
          <div key={p.trade_key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid " + C.border + "66" }}>
            <span style={{ fontWeight: 700 }}>{p.trade_key === "_default" ? "Resto de oficios" : oficioDe(p.trade_key)}
              <span style={{ color: C.muted, fontSize: 12, fontWeight: 400 }}> · clave "{p.trade_key}"</span></span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Numero value={precios[p.trade_key] ?? ""} onChange={(v) => setPrecios({ ...precios, [p.trade_key]: v })} sufijo="€" />
              <Btn small disabled={ocupado || n(precios[p.trade_key]) === p.price} onClick={() => guardarPrecio(p.trade_key, precios[p.trade_key])}>Guardar</Btn>
            </span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
          <input value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value.toLowerCase())} placeholder="Nuevo oficio (ej. electric)" style={{ background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.text, padding: "7px 9px", fontFamily: F, fontSize: 13, width: 200 }} />
          <Numero value={nuevoPrecio} onChange={setNuevoPrecio} sufijo="€" />
          <Btn small outline disabled={ocupado || !nuevaClave.trim() || !nuevoPrecio} onClick={() => { guardarPrecio(nuevaClave.trim(), nuevoPrecio); setNuevaClave(""); setNuevoPrecio(""); }}>Añadir oficio</Btn>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>La clave se busca dentro del nombre del oficio: "fontaner" vale para fontanero y fontanería, "pintor" para pintor.</div>
      </Card>

      <Titulo>Facturación y altas</Titulo>
      <Card>
        {CONFIG.map((c) => (
          <div key={c.clave} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid " + C.border + "66" }}>
            <span style={{ fontWeight: 700 }}>{c.label}</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Numero value={cfg[c.clave]} onChange={(v) => setCfg({ ...cfg, [c.clave]: v })} sufijo={c.sufijo} />
              <Btn small disabled={ocupado || n(cfg[c.clave]) === d.config[c.clave]} onClick={() => guardarCfg(c.clave)}>Guardar</Btn>
            </span>
          </div>
        ))}
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Las facturas de fin de mes se emiten solas el día 1 de madrugada. En el panel del profesional el texto del límite sigue diciendo 820 €: si lo cambias, avísame y lo actualizo.</div>
      </Card>

      <Titulo accion={<Btn small outline onClick={() => irA("profesionales")}>Cambiar en Profesionales</Btn>}>Reparto actual</Titulo>
      <Tabla
        cols={[{ k: "of", l: "Oficio" }, { k: "ciudad", l: "Ciudad" }, { k: "pro", l: "Lo recibe" }, { k: "precio", l: "Precio", align: "right" }]}
        filas={d.routing.filter((r) => r.active).map((r) => ({
          of: <b>{oficioDe(r.trade_key)}</b>, ciudad: r.city_slug, pro: d.proPorId[r.pro_id]?.name || "—",
          precio: eur(precioLeadDe(d, r.trade_key, r.city_slug, d.proPorId[r.pro_id])),
        }))}
        vacio="Ningún oficio tiene profesional asignado"
      />
      <div style={{ fontSize: 12, color: C.muted }}>Los oficios sin profesional entran en Leads → Sin asignar.</div>
    </div>
  );
}
