// ============================================================
// OficioYa · Panel PROFESIONAL — pago automático con tarjeta (en Facturas)
// La tarjeta se guarda en Stripe con el enlace de la función «cobros».
// Si un cobro falla, se avisa aquí con la cuenta atrás de leads.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { db } from "../supabase";
import { C, Card, Boton, eur } from "./proComun";

interface EstadoCobro {
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

export default function ProTarjeta({ userId, onToast }: { userId: string; onToast?: (m: string) => void }) {
  const [e, setE] = useState<EstadoCobro | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await db.rpc("oy_cobro_estado_pro", { p_pro: userId });
    if (data) setE(data as EstadoCobro);
  }, [userId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [cargar]);

  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const t = u.searchParams.get("tarjeta");
      if (!t) return;
      if (AVISOS[t]) onToast?.(AVISOS[t]);
      u.searchParams.delete("tarjeta");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch { /* nada */ }
  }, []);

  if (!e) return null;
  const fallida = e.fallidas?.[0];
  const quedan = e.impago?.activo ? Math.max(0, Number(e.impago.limite || 0) - Number(e.impago.usados || 0)) : null;

  return (
    <>
      {fallida && (
        <Card accent={C.red}>
          <div style={{ color: C.red, fontWeight: 800, fontSize: 13.5 }}>No hemos podido cobrar la factura {fallida.number}</div>
          <div style={{ color: C.mutedL, fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>
            {eur(fallida.total)}: {fallida.error || "el banco ha rechazado el cobro"}. Pon otra tarjeta o págala por transferencia o Bizum.
            {quedan !== null && (e.impago.bloqueado
              ? <b style={{ color: C.red }}> La entrada de clientes está parada hasta que se pague.</b>
              : <b style={{ color: C.orange }}> Te {quedan === 1 ? "queda 1 lead" : "quedan " + quedan + " leads"} antes de que se pare la entrada de clientes.</b>)}
          </div>
          <div style={{ display: "flex", marginTop: 10 }}>
            <Boton href={e.enlace} color={C.red} small>Poner otra tarjeta</Boton>
          </div>
        </Card>
      )}

      <Card>
        {e.tarjeta ? (
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
              <Boton href={e.enlace} small outline color={C.accent}>Cambiar</Boton>
            </div>
          </div>
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
