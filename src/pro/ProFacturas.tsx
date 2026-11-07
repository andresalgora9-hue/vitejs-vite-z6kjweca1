// ============================================================
// OficioYa · Panel PROFESIONAL — pestaña FACTURAS
// Facturas de leads: se emiten el día 1 o al llegar a 820 €.
// Con la tarjeta guardada se cobran solas; si no, transferencia o Bizum.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { db } from "../supabase";
import PagarFactura from "./PagarFactura";
import ProTarjeta, { EstadoCobro } from "./ProTarjeta";
import {
  C, F, Card, Boton, Etiqueta, Titulo, FacturaRow, UMBRAL_FACTURA, IVA_PCT,
  eur, fecha,
} from "./proComun";
import { descargarFacturaPdf, LeadFactura } from "./facturaPdf";
import ProChatOficioYa from "./ProChatOficioYa";

// Los campos del cobro con tarjeta llegan con select("*")
type Factura = FacturaRow & { cobro_estado?: string | null; cobro_error?: string | null; cobro_intentos?: number | null; metodo_pago?: string | null };

// Cómo se paga cada factura pendiente:
//   auto       → se cobra sola en la tarjeta guardada
//   procesando → el banco está tramitando el cobro
//   rechazada  → falló el cobro en la tarjeta (hay que pagarla o poner otra tarjeta)
//   avisada    → el profesional ha dicho que ya la ha pagado (lo comprueba OficioYa)
//   manual     → transferencia o Bizum
type Modo = "auto" | "procesando" | "rechazada" | "avisada" | "manual";
function modoPago(f: Factura, conTarjeta: boolean): Modo {
  const ce = f.cobro_estado || "";
  if (ce === "aviso_pago") return "avisada";
  if (ce === "procesando") return "procesando";
  if (ce === "rechazada") return "rechazada";
  if (conTarjeta && f.tipo !== "activacion" && ["", "pendiente_cobro", "cobrando", "sin_tarjeta"].includes(ce)) return "auto";
  return "manual";
}
const aMano = (m: Modo) => m === "manual" || m === "rechazada";

function estadoFactura(f: Factura, modo: Modo) {
  if (f.status === "pagada") return { texto: "Pagada", color: C.green };
  if (f.status === "anulada") return { texto: "Anulada", color: C.muted };
  if (modo === "auto") return { texto: "Pago automático", color: C.accent };
  if (modo === "procesando") return { texto: "En proceso", color: C.accent };
  if (modo === "avisada") return { texto: "Comprobando pago", color: C.blue };
  if (modo === "rechazada") return { texto: "Cobro fallido", color: C.red };
  const dias = Math.ceil((new Date(f.due_at).getTime() - Date.now()) / 86400000);
  if (dias < 0) return { texto: "Vencida", color: C.red };
  if (dias === 0) return { texto: "Vence hoy", color: C.orange };
  return { texto: "Vence en " + dias + (dias === 1 ? " día" : " días"), color: C.orange };
}

function textoPendiente(f: Factura, modo: Modo, conTarjeta: boolean) {
  if (modo === "auto") return f.cobro_estado === "cobrando" ? "Cobrándose ahora en tu tarjeta…" : "Se cobra sola en tu tarjeta. No tienes que hacer nada.";
  if (modo === "procesando") return "Tu banco está tramitando el cobro en la tarjeta.";
  if (modo === "avisada") return "Nos has avisado de que ya la has pagado. Lo comprobamos y te la marcamos como pagada.";
  if (modo === "rechazada") return "No se ha podido cobrar en tu tarjeta" + (f.cobro_error ? " (" + f.cobro_error + ")" : "") + ". Págala por transferencia o Bizum, o pon otra tarjeta.";
  if (f.cobro_estado === "error" && conTarjeta && Number(f.cobro_intentos || 0) < 3) {
    return "No se pudo cobrar en tu tarjeta por un fallo técnico: lo volveremos a intentar. Si prefieres, págala antes del " + fecha(f.due_at) + ".";
  }
  return "Pagar antes del " + fecha(f.due_at);
}

export default function ProFacturas({ user, onIrAPerfil, onToast }: {
  user: { id: string; name: string; cif?: string | null; fiscal_address?: string | null; company_name?: string | null };
  onIrAPerfil: () => void;
  onToast?: (m: string) => void;
}) {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [cobro, setCobro] = useState<EstadoCobro | null>(null);
  const [pendiente, setPendiente] = useState(0);
  const [nPendientes, setNPendientes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [datosFiscales, setDatosFiscales] = useState(true);
  const [pagando, setPagando] = useState<Factura[] | null>(null);

  const cargar = useCallback(async () => {
    const [fs, ls, us, cs] = await Promise.all([
      db.from("lead_invoices").select("*").eq("pro_id", user.id).order("issued_at", { ascending: false }),
      db.from("pro_leads").select("price").eq("pro_id", user.id).eq("anulado", false).is("invoice_id", null),
      db.from("users").select("cif,fiscal_address,fiscal_zip,fiscal_city").eq("id", user.id).maybeSingle(),
      db.rpc("oy_cobro_estado_pro", { p_pro: user.id }),
    ]);
    setFacturas(((fs.data || []) as Factura[]).filter((f) => f.status !== "anulada"));
    const pend = (ls.data || []) as { price: number }[];
    setPendiente(pend.reduce((s, l) => s + Number(l.price || 0), 0));
    setNPendientes(pend.length);
    const u: any = us.data || {};
    setDatosFiscales(!!(u.cif && u.fiscal_address && u.fiscal_zip && u.fiscal_city));
    if (cs.data) setCobro(cs.data as EstadoCobro);
    setCargando(false);
  }, [user.id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [cargar]);

  const descargar = async (f: Factura) => {
    setDescargando(f.id);
    try {
      const { data } = await db.from("pro_leads").select("created_at,trade,canal,zona,price").eq("invoice_id", f.id);
      await descargarFacturaPdf(f, (data || []) as LeadFactura[]);
    } catch {
      onToast?.("No se ha podido descargar la factura. Inténtalo de nuevo.");
    }
    setDescargando(null);
  };

  const conTarjeta = !!cobro?.tarjeta;
  const pct = Math.min(100, Math.round((pendiente / UMBRAL_FACTURA) * 100));
  const porPagar = facturas.filter((f) => f.status === "pendiente" && aMano(modoPago(f, conTarjeta)));

  if (cargando) {
    return <div style={{ padding: "40px 0", textAlign: "center", color: C.mutedL, fontFamily: F, fontSize: 14 }}>Cargando tus facturas...</div>;
  }

  return (
    <div style={{ fontFamily: F, paddingBottom: 24 }}>
      <div style={{ padding: "22px 0 12px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: C.text, margin: 0 }}>Facturas</h2>
        <div style={{ fontSize: 13, color: C.mutedL, marginTop: 4 }}>
          Se emiten el día 1 de cada mes o al llegar a {eur(UMBRAL_FACTURA).replace(",00", "")} en leads.
          {conTarjeta ? " Se cobran solas en tu tarjeta." : " Tienes 5 días para pagar cada una."}
        </div>
      </div>

      {!datosFiscales && (
        <Card accent={C.orange}>
          <div style={{ color: C.orange, fontWeight: 800, fontSize: 13.5 }}>Faltan tus datos de facturación</div>
          <div style={{ color: C.mutedL, fontSize: 12.5, marginTop: 4 }}>Añade tu NIF/CIF y dirección fiscal para que salgan en tus facturas.</div>
          <div style={{ display: "flex", marginTop: 10 }}>
            <Boton small onClick={onIrAPerfil} color={C.orange} outline>Completar en Perfil</Boton>
          </div>
        </Card>
      )}

      {/* Próxima factura */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 13.5, color: C.text, fontWeight: 800 }}>Próxima factura</div>
          <div style={{ fontSize: 13, color: C.mutedL }}><b style={{ color: C.text, fontSize: 15 }}>{eur(pendiente)}</b> de {eur(UMBRAL_FACTURA)}</div>
        </div>
        <div style={{ height: 8, background: C.bg, borderRadius: 99, marginTop: 10, overflow: "hidden" }}>
          <div style={{ width: pct + "%", height: "100%", background: C.accent, borderRadius: 99 }} />
        </div>
        <div style={{ fontSize: 12, color: C.mutedL, marginTop: 8 }}>
          {nPendientes} {nPendientes === 1 ? "lead" : "leads"} sin facturar · se sumará el {IVA_PCT}% de IVA
          ({eur(pendiente * (1 + IVA_PCT / 100))} en total).
        </div>
      </Card>

      {/* Pago automático con tarjeta */}
      <ProTarjeta estado={cobro} onToast={onToast} />

      {/* Cómo pagar (con tarjeta: solo si un cobro falla) */}
      <Card accent={porPagar.length ? C.orange + "88" : undefined}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 13.5, color: C.text, fontWeight: 800 }}>{conTarjeta ? "Pagar a mano" : "Cómo pagar"}</div>
          {porPagar.length > 0 && (
            <div style={{ fontSize: 13, color: C.orange, fontWeight: 800 }}>{eur(porPagar.reduce((s, f) => s + Number(f.total || 0), 0))} por pagar</div>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4, lineHeight: 1.45 }}>
          {!conTarjeta
            ? "Por transferencia o Bizum, en los 5 días siguientes a la emisión. Pon el número de factura como concepto."
            : porPagar.length
              ? "Las facturas que no se han podido cobrar en tu tarjeta se pagan por transferencia o Bizum. Pon el número de factura como concepto."
              : "No hace falta: cada factura se cobra sola en tu tarjeta. Si algún cobro falla, te avisamos y puedes pagarla aquí por transferencia o Bizum."}
        </div>
        <div style={{ display: "flex", marginTop: 10 }}>
          <Boton color={C.accent} outline={!porPagar.length && conTarjeta} small={!porPagar.length && conTarjeta}
            onClick={() => setPagando(porPagar)}>{porPagar.length ? "Pagar" : "Ver datos de pago"}</Boton>
        </div>
      </Card>

      {/* Chat con OficioYa */}
      <ProChatOficioYa user={{ id: user.id, name: user.name }} onToast={onToast} />

      {/* Lista */}
      <Titulo>Tus facturas</Titulo>
      {facturas.length === 0 ? (
        <Card><div style={{ color: C.mutedL, fontSize: 13.5 }}>Aún no tienes facturas. La primera se emitirá el día 1 o al llegar a {eur(UMBRAL_FACTURA).replace(",00", "")}.</div></Card>
      ) : facturas.map((f) => {
        const modo = modoPago(f, conTarjeta);
        const e = estadoFactura(f, modo);
        const pagarAMano = f.status === "pendiente" && aMano(modo);
        return (
          <Card key={f.id} accent={f.status === "pendiente" ? e.color + "88" : undefined}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{f.number}</div>
                <div style={{ color: C.mutedL, fontSize: 12.5, marginTop: 2 }}>
                  Emitida el {fecha(f.issued_at)} · {f.tipo === "activacion" ? "Alta en OficioYa" : f.n_leads + (f.n_leads === 1 ? " lead" : " leads")}
                  {f.motivo === "umbral" ? " · al llegar a 820 €" : ""}
                </div>
              </div>
              <Etiqueta texto={e.texto} color={e.color} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10, fontSize: 12, color: C.mutedL }}>
              <div>Base<br /><b style={{ color: C.text, fontSize: 13 }}>{eur(f.base)}</b></div>
              <div>IVA {Number(f.iva_pct)}%<br /><b style={{ color: C.text, fontSize: 13 }}>{eur(f.iva)}</b></div>
              <div style={{ textAlign: "right" }}>Total<br /><b style={{ color: C.text, fontSize: 15 }}>{eur(f.total)}</b></div>
            </div>
            {f.status === "pendiente" && (
              <div style={{ fontSize: 12.5, color: e.color, fontWeight: 700, marginTop: 8, lineHeight: 1.4 }}>{textoPendiente(f, modo, conTarjeta)}</div>
            )}
            {f.status === "pagada" && f.paid_at && (
              <div style={{ fontSize: 12.5, color: C.green, fontWeight: 700, marginTop: 8 }}>Pagada el {fecha(f.paid_at)}{f.metodo_pago === "tarjeta" ? " con tarjeta" : ""}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {pagarAMano && (
                <Boton onClick={() => setPagando([f])} color={C.accent}>Pagar</Boton>
              )}
              <Boton onClick={() => descargar(f)} disabled={descargando === f.id} color={C.accent} outline={pagarAMano}>
                {descargando === f.id ? "Preparando PDF..." : pagarAMano ? "Descargar PDF" : "Descargar factura (PDF)"}
              </Boton>
            </div>
          </Card>
        );
      })}

      {pagando && (
        <PagarFactura facturas={pagando} nombre={user.name} userId={user.id} conTarjeta={conTarjeta}
          onAvisado={cargar} onClose={() => setPagando(null)} />
      )}
    </div>
  );
}
