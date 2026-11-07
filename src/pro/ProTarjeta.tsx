// ============================================================
// OficioYa · Panel PROFESIONAL — pago automático con tarjeta (en Facturas)
// La tarjeta se guarda en Stripe con el enlace de la función «cobros».
// Si un cobro falla, se avisa aquí con la cuenta atrás de leads.
// El estado lo carga ProFacturas (oy_cobro_estado_pro) y llega por props.
// ============================================================
import React, { useEffect } from "react";
import { C, Card, Boton, eur } from "./proComun";

export interface EstadoCobro {
  enlace: string;
  tarjeta: { marca: string | null; ultimos4: string | null; caduca_mes: number | null; caduca_anio: number | null } | null;
  impago: { activo: boolean; usados?: number; limite?: number; bloqueado?: boolean };
  fallidas: { id: string; number: string; total: number; error: string | null }[];
}

// Vuelta de Stripe (?tarjeta=...)
const AVISOS: Record<string, string> = {
  ok: "Tarjeta guardada. Tus facturas se pagarán solas.",
  cobro_fallido: "Tarjeta guardada, pero no se ha podido cobrar tu factura pendiente.",
  cancelada: "No se ha guardado la tarjeta.",
  pendiente: "La tarjeta no llegó a guardarse. Inténtalo de nuevo.",
  error: "No se ha podido guardar la tarjeta. Inténtalo de nuevo.",
  enlace_no_valido: "El enlace de la tarjeta no es válido. Escríbenos y te mandamos otro.",
};

const marca = (m: string | null) => (m ? m.charAt(0).toUpperCase() + m.slice(1) : "Tarjeta");

// La tarjeta vale hasta el último día del mes que pone (11/26 → hasta el 30/11/2026)
function caducidad(t: EstadoCobro["tarjeta"]): "caducada" | "este_mes" | null {
  if (!t?.caduca_mes || !t?.caduca_anio) return null;
  const hoy = new Date();
  const y = hoy.getFullYear(), m = hoy.getMonth() + 1;
  const anio = t.caduca_anio < 100 ? 2000 + t.caduca_anio : t.caduca_anio;
  if (anio < y || (anio === y && t.caduca_mes < m)) return "caducada";
  if (anio === y && t.caduca_mes === m) return "este_mes";
  return null;
}

export default function ProTarjeta({ estado: e, onToast }: { estado: EstadoCobro | null; onToast?: (m: string) => void }) {
  // Aviso al volver de Stripe y limpieza de la dirección (?tarjeta=... / ?ir=facturas)
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const t = u.searchParams.get("tarjeta");
      if (!t && !u.searchParams.has("ir")) return;
      if (t && AVISOS[t]) onToast?.(AVISOS[t]);
      u.searchParams.delete("tarjeta");
      u.searchParams.delete("ir");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch { /* nada */ }
  }, []);

  if (!e) return null;
  const fallida = e.fallidas?.[0];
  const quedan = e.impago?.activo ? Math.max(0, Number(e.impago.limite || 0) - Number(e.impago.usados || 0)) : null;
  const cad = caducidad(e.tarjeta);

  return (
    <>
      {fallida && (
        <Card accent={C.red}>
          <div style={{ color: C.red, fontWeight: 800, fontSize: 13.5 }}>
            No hemos podido cobrar {e.fallidas.length > 1 ? "tus facturas " + e.fallidas.map((f) => f.number).join(", ") : "la factura " + fallida.number}
          </div>
          <div style={{ color: C.mutedL, fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>
            {eur(e.fallidas.reduce((s, f) => s + Number(f.total || 0), 0))}: {fallida.error || "el banco ha rechazado el cobro"}. Pon otra tarjeta o {e.fallidas.length > 1 ? "págalas" : "págala"} por transferencia o Bizum.
            {quedan !== null && (e.impago.bloqueado
              ? <b style={{ color: C.red }}> La entrada de clientes está parada hasta que se pague.</b>
              : <b style={{ color: C.orange }}> Te {quedan === 1 ? "queda 1 lead" : "quedan " + quedan + " leads"} antes de que se pare la entrada de clientes.</b>)}
          </div>
          <div style={{ display: "flex", marginTop: 10 }}>
            <Boton href={e.enlace} color={C.red} small>Poner otra tarjeta</Boton>
          </div>
        </Card>
      )}

      <Card accent={cad ? (cad === "caducada" ? C.red : C.orange) : undefined}>
        {e.tarjeta ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: C.text, fontWeight: 800 }}>Pago automático activado</div>
                <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 3 }}>
                  {marca(e.tarjeta.marca)} •••• {e.tarjeta.ultimos4 || "····"}
                  {e.tarjeta.caduca_mes ? " · caduca " + String(e.tarjeta.caduca_mes).padStart(2, "0") + "/" + String(e.tarjeta.caduca_anio || "").slice(-2) : ""}
                  . Cada factura se cobra sola al emitirse.
                </div>
              </div>
              <div style={{ display: "flex", flexShrink: 0 }}>
                <Boton href={e.enlace} small outline={!cad} color={cad === "caducada" ? C.red : cad ? C.orange : C.accent}>Cambiar</Boton>
              </div>
            </div>
            {cad && (
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8, color: cad === "caducada" ? C.red : C.orange }}>
                {cad === "caducada"
                  ? "Tu tarjeta ha caducado: pon otra para que se sigan pagando tus facturas."
                  : "Tu tarjeta caduca este mes: cámbiala para que no falle el próximo cobro."}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 13.5, color: C.text, fontWeight: 800 }}>Paga tus facturas sin acordarte</div>
            <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4, lineHeight: 1.45 }}>
              Guarda tu tarjeta y cada factura se pagará sola al emitirse, sin transferencias. Si tienes alguna pendiente, se cobra al guardarla.
            </div>
            <div style={{ display: "flex", marginTop: 10 }}>
              <Boton href={e.enlace} color={C.accent}>Guardar tarjeta</Boton>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
