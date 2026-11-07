// ============================================================
// OficioYa · ADMIN — PROFESIONALES › ALTAS (altas automáticas, 07/11/2026)
// Al pagar la activación con Stripe, la ficha pasa sola a «Pagado», se crea su cuenta y aparece aquí.
// Andrés confirma el alta cuando arrancan sus campañas: se le asignan los leads y se le avisa en la app.
// Datos: RPC oy_altas · oy_alta_confirmar · oy_pago_asignar · oy_pago_descartar (con la clave de Captación).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { db } from "../supabase";
import { C, Card, Btn, Pill, Titulo, Sel, SeccionProps, eur, fecha, fechaHora, hace, oficioDe, ts } from "./apUi";

type Pendiente = {
  id: string; nombre: string; oficio: string | null; ciudad: string | null; slug: string | null; precio_lead: number | null;
  email: string | null; telefono: string | null; pagada_at: string | null; push: boolean; ficha: boolean;
  comercial: string | null; firmado_at: string | null; lead_id: string | null; importe: number | null;
  trade_key: string; reparto_pro: string | null; reparto_nombre: string | null;
};
type Pago = {
  id: string; created_at: string; estado: string; motivo: string | null; email: string | null; nombre: string | null; nif: string | null;
  importe: number | null; lead_id: string | null; lead_nombre: string | null; lead_oficio: string | null; lead_ciudad: string | null;
};
type Firmado = { id: string; nombre: string; oficio: string; ciudad: string | null; comercial: string | null; firmado_at: string | null; importe: number | null };
type Confirmada = { id: string; nombre: string; oficio: string | null; ciudad: string | null; confirmada_at: string; aviso_visto_at: string | null };
type Ficha = { id: string; nombre: string; oficio: string; ciudad: string | null; estado: string };
type DatosAltas = { pendientes: Pendiente[]; pagos: Pago[]; firmados: Firmado[]; confirmadas: Confirmada[]; fichas: Ficha[] };

const ESTADO_PAGO: Record<string, { t: string; c: string }> = {
  sin_identificar: { t: "Sin identificar", c: C.red },
  revisar: { t: "Revisar", c: C.orange },
  esperando_firma: { t: "Falta que firme", c: C.blue },
  aplicado_sin_cuenta: { t: "Falta su cuenta", c: C.orange },
};
const oficioTxt = (o: string | null | undefined) => {
  const s = (o || "").toLowerCase();
  return s.startsWith("fontan") ? "fontanería" : s.startsWith("pint") ? "pintura" : s || "su oficio";
};

export default function AltasPendientes({ d, recargar, aviso, irA, onVerFicha }: SeccionProps & { onVerFicha?: (id: string) => void }) {
  const clave = (() => { try { return localStorage.getItem("oy_captacion_clave"); } catch { return null; } })();
  const [datos, setDatos] = useState<DatosAltas | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [asignar, setAsignar] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    if (!clave) return;
    const { data, error: e } = await db.rpc("oy_altas", { p_admin: clave });
    if (e) { setError(e.message); return; }
    setError("");
    setDatos(data as DatosAltas);
  }, [clave]);
  useEffect(() => { cargar(); }, [cargar, d]);

  if (!clave) {
    return <Card><div style={{ fontSize: 13, color: C.mutedL }}>Entra una vez en <b>Captación</b> desde este dispositivo para ver y confirmar aquí las altas.</div></Card>;
  }
  if (error) return <Card accent={C.red + "88"}><div style={{ fontSize: 13, color: C.red }}>No se han podido cargar las altas: {error}</div></Card>;
  if (!datos) return <Card><div style={{ fontSize: 13, color: C.mutedL }}>Cargando altas…</div></Card>;

  const rpc = async (id: string, fn: string, args: Record<string, unknown>, ok: string) => {
    setOcupado(id);
    const { error: e } = await db.rpc(fn, args);
    setOcupado(null);
    if (e) { alert("Error: " + e.message); return false; }
    aviso(ok);
    await cargar();
    await recargar();
    return true;
  };

  const confirmar = (p: Pendiente, reparto: "asignar" | "no") => {
    const donde = oficioTxt(p.oficio) + (p.ciudad ? " en " + p.ciudad : "");
    const txt = "¿Las campañas de " + donde + " ya están en marcha?\n\n"
      + (reparto === "asignar" ? "Le pasamos los leads de " + donde + " y le " : "Sin tocar el reparto de leads, le ")
      + "avisamos en la app de que desde ahora le pueden llegar clientes.";
    if (!window.confirm(txt)) return;
    rpc(p.id, "oy_alta_confirmar", { p_admin: clave, p_pro: p.id, p_reparto: reparto }, "Alta confirmada: " + p.nombre + " ya está avisado");
  };

  const { pendientes, pagos, firmados, confirmadas, fichas } = datos;
  const nada = !pendientes.length && !pagos.length && !firmados.length;

  return (
    <div style={{ marginBottom: 18 }}>
      <Card accent={pendientes.length ? C.green + "88" : undefined} style={{ background: pendientes.length ? C.green + "10" : C.card }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
          {pendientes.length
            ? pendientes.length + (pendientes.length === 1 ? " alta pagada espera" : " altas pagadas esperan") + " a que arranquen sus campañas"
            : "No hay altas pendientes de confirmar"}
        </div>
        <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4, lineHeight: 1.5 }}>
          Al pagar la activación, la ficha pasa sola a «Pagado», se crea su cuenta con los datos del contrato y le llega la bienvenida.
          Cuando arranques sus campañas, confirma aquí: le pasamos los leads y le avisamos en la app.
        </div>
      </Card>

      {pendientes.map((p) => {
        const ocupadoPorOtro = !!p.reparto_pro && p.reparto_pro !== p.id;
        const yaRecibe = p.reparto_pro === p.id;
        const donde = oficioTxt(p.oficio) + (p.ciudad ? " en " + p.ciudad : "");
        return (
          <Card key={p.id} accent={C.green + "66"}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{p.nombre}</div>
                <div style={{ fontSize: 13, color: C.mutedL, marginTop: 2 }}>
                  {oficioDe(p.oficio)} · {p.ciudad || "Sin ciudad"}{p.precio_lead != null ? " · " + eur(Number(p.precio_lead)) + " + IVA por lead" : ""}
                </div>
                <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4 }}>
                  Pagó {p.importe != null ? eur(Number(p.importe), 2) : "la activación"} el {fechaHora(p.pagada_at)}
                  {p.firmado_at ? " · firmó el " + fecha(p.firmado_at) : ""}{p.comercial ? " · " + p.comercial : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {p.push ? <Pill texto="Avisos activados" color={C.green} /> : <Pill texto="Aún sin avisos" color={C.orange} />}
                {p.ficha ? <Pill texto="Ficha completa" color={C.green} /> : <Pill texto="Falta horario y servicios" color={C.orange} />}
              </div>
            </div>
            <div style={{ fontSize: 12.5, marginTop: 10, color: ocupadoPorOtro ? C.orange : C.mutedL }}>
              {ocupadoPorOtro ? "Ahora los leads de " + donde + " los recibe " + (p.reparto_nombre || "otro profesional") + "."
                : yaRecibe ? "Ya tiene asignados los leads de " + donde + "."
                : "Los leads de " + donde + " están libres: se los pasamos al confirmar."}
              {!p.push && " Si no activa los avisos, verá el mensaje de bienvenida la próxima vez que entre en la app."}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {ocupadoPorOtro ? (
                <>
                  <Btn color={C.green} disabled={ocupado === p.id} onClick={() => confirmar(p, "asignar")}>Confirmar y pasarle los leads</Btn>
                  <Btn outline color={C.green} disabled={ocupado === p.id} onClick={() => confirmar(p, "no")}>Confirmar sin tocar el reparto</Btn>
                </>
              ) : (
                <Btn color={C.green} disabled={ocupado === p.id} onClick={() => confirmar(p, "asignar")}>Confirmar alta · campañas en marcha</Btn>
              )}
              {onVerFicha && <Btn outline color={C.mutedL} onClick={() => onVerFicha(p.id)}>Ver ficha</Btn>}
            </div>
          </Card>
        );
      })}

      {pagos.length > 0 && <Titulo>Pagos de activación por revisar ({pagos.length})</Titulo>}
      {pagos.map((g) => {
        const e = ESTADO_PAGO[g.estado] || { t: g.estado, c: C.muted };
        return (
          <Card key={g.id} accent={e.c + "66"}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{g.lead_nombre || g.nombre || g.email || "Sin nombre"}</div>
                <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 2 }}>
                  {eur(Number(g.importe) || 0, 2)} · {fechaHora(g.created_at)}{g.email ? " · " + g.email : ""}{g.nif ? " · NIF " + g.nif : ""}
                  {g.lead_nombre ? " · " + oficioDe(g.lead_oficio) + (g.lead_ciudad ? " en " + g.lead_ciudad : "") : ""}
                </div>
              </div>
              <Pill texto={e.t} color={e.c} />
            </div>
            {g.motivo && <div style={{ fontSize: 13, marginTop: 8 }}>{g.motivo}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
              {g.estado === "sin_identificar" && (
                <>
                  <Sel value={asignar[g.id] || ""} onChange={(v) => setAsignar({ ...asignar, [g.id]: v })} style={{ maxWidth: 320 }}
                    options={[{ v: "", l: "Elige su ficha de captación…" }, ...fichas.map((f) => ({ v: f.id, l: f.nombre + " · " + oficioDe(f.oficio) + (f.ciudad ? " · " + f.ciudad : "") + " · " + f.estado }))]} />
                  <Btn small disabled={!asignar[g.id] || ocupado === g.id}
                    onClick={() => rpc(g.id, "oy_pago_asignar", { p_admin: clave, p_pago: g.id, p_lead: asignar[g.id] }, "Pago asignado")}>Asignar y aplicar</Btn>
                </>
              )}
              {(g.estado === "revisar" || g.estado === "aplicado_sin_cuenta") && (
                <Btn small disabled={ocupado === g.id}
                  onClick={() => window.confirm(g.estado === "revisar" ? "¿Aplicar este pago igualmente? Se da por pagada su activación y se crea su cuenta si no la tiene." : "¿Reintentar? Hazlo después de arreglar lo que falta (por ejemplo, el email en su ficha).")
                    && rpc(g.id, "oy_pago_asignar", { p_admin: clave, p_pago: g.id, p_lead: null }, "Pago aplicado")}>
                  {g.estado === "revisar" ? "Aplicar igualmente" : "Reintentar"}
                </Btn>
              )}
              {g.estado === "aplicado_sin_cuenta" && <Btn small outline color={C.blue} onClick={() => irA("captacion")}>Abrir Captación</Btn>}
              <Btn small outline color={C.red} disabled={ocupado === g.id} onClick={() => {
                const m = window.prompt("¿Por qué lo descartas? (por ejemplo: devuelto en Stripe, pago repetido)");
                if (m !== null) rpc(g.id, "oy_pago_descartar", { p_admin: clave, p_pago: g.id, p_motivo: m }, "Pago descartado");
              }}>Descartar</Btn>
            </div>
          </Card>
        );
      })}

      {firmados.length > 0 && <Titulo>Han firmado y falta que paguen ({firmados.length})</Titulo>}
      {firmados.length > 0 && (
        <Card style={{ padding: "6px 14px" }}>
          {firmados.map((f) => {
            const tarde = !!f.firmado_at && Date.now() - ts(f.firmado_at) > 5 * 86400000;
            return (
              <div key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: "1px solid " + C.border + "55", fontSize: 13, flexWrap: "wrap" }}>
                <span style={{ minWidth: 0 }}><b>{f.nombre}</b> · {oficioDe(f.oficio)}{f.ciudad ? " · " + f.ciudad : ""}{f.comercial ? <span style={{ color: C.mutedL }}> · {f.comercial}</span> : null}</span>
                <span style={{ color: tarde ? C.red : C.mutedL, fontWeight: tarde ? 800 : 600 }}>
                  {f.importe != null ? eur(Number(f.importe), 2) + " · " : ""}firmó hace {f.firmado_at ? hace(f.firmado_at) : "—"}{tarde ? " (más de 5 días)" : ""}
                </span>
              </div>
            );
          })}
        </Card>
      )}

      {confirmadas.length > 0 && <Titulo>Confirmadas en las últimas semanas</Titulo>}
      {confirmadas.length > 0 && (
        <Card style={{ padding: "6px 14px" }}>
          {confirmadas.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: "1px solid " + C.border + "55", fontSize: 13, flexWrap: "wrap", cursor: onVerFicha ? "pointer" : undefined }}
              onClick={() => onVerFicha && onVerFicha(c.id)}>
              <span><b>{c.nombre}</b> · {oficioDe(c.oficio)}{c.ciudad ? " · " + c.ciudad : ""}</span>
              <span style={{ color: C.mutedL }}>
                Confirmada el {fecha(c.confirmada_at)} · {c.aviso_visto_at ? <span style={{ color: C.green }}>ha visto el aviso</span> : <span style={{ color: C.orange }}>aún no ha entrado</span>}
              </span>
            </div>
          ))}
        </Card>
      )}

      {nada && confirmadas.length === 0 && (
        <div style={{ fontSize: 12.5, color: C.muted, margin: "-4px 0 8px" }}>Cuando alguien firme y pague, lo verás aquí.</div>
      )}
    </div>
  );
}
