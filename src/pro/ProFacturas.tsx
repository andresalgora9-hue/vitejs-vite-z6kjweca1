// ============================================================
// OficioYa · Panel PROFESIONAL — pestaña FACTURAS
// Facturas de leads: se emiten el día 1 o al llegar a 820 €.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { db } from "../supabase";
import { OY_IBAN, OY_TITULAR } from "../shared/crm";
import {
  C, F, Card, Boton, Etiqueta, Titulo, FacturaRow, UMBRAL_FACTURA, IVA_PCT,
  eur, fecha,
} from "./proComun";
import { descargarFacturaPdf, LeadFactura } from "./facturaPdf";

function estadoFactura(f: FacturaRow) {
  if (f.status === "pagada") return { texto: "Pagada", color: C.green };
  if (f.status === "anulada") return { texto: "Anulada", color: C.muted };
  const dias = Math.ceil((new Date(f.due_at).getTime() - Date.now()) / 86400000);
  if (dias < 0) return { texto: "Vencida", color: C.red };
  if (dias === 0) return { texto: "Vence hoy", color: C.orange };
  return { texto: "Vence en " + dias + (dias === 1 ? " día" : " días"), color: C.orange };
}

export default function ProFacturas({ user, onIrAPerfil, onToast }: {
  user: { id: string; name: string; cif?: string | null; fiscal_address?: string | null; company_name?: string | null };
  onIrAPerfil: () => void;
  onToast?: (m: string) => void;
}) {
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [pendiente, setPendiente] = useState(0);
  const [nPendientes, setNPendientes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [datosFiscales, setDatosFiscales] = useState(true);

  const cargar = useCallback(async () => {
    const [fs, ls, us] = await Promise.all([
      db.from("lead_invoices").select("*").eq("pro_id", user.id).order("issued_at", { ascending: false }),
      db.from("pro_leads").select("price").eq("pro_id", user.id).eq("anulado", false).is("invoice_id", null),
      db.from("users").select("cif,fiscal_address,fiscal_zip,fiscal_city").eq("id", user.id).maybeSingle(),
    ]);
    setFacturas(((fs.data || []) as FacturaRow[]).filter((f) => f.status !== "anulada"));
    const pend = (ls.data || []) as { price: number }[];
    setPendiente(pend.reduce((s, l) => s + Number(l.price || 0), 0));
    setNPendientes(pend.length);
    const u: any = us.data || {};
    setDatosFiscales(!!(u.cif && u.fiscal_address && u.fiscal_zip && u.fiscal_city));
    setCargando(false);
  }, [user.id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [cargar]);

  const descargar = async (f: FacturaRow) => {
    setDescargando(f.id);
    try {
      const { data } = await db.from("pro_leads").select("created_at,trade,canal,zona,price").eq("invoice_id", f.id);
      await descargarFacturaPdf(f, (data || []) as LeadFactura[]);
    } catch {
      onToast?.("No se ha podido descargar la factura. Inténtalo de nuevo.");
    }
    setDescargando(null);
  };

  const copiarIban = async () => {
    try { await navigator.clipboard.writeText(OY_IBAN.replace(/\s/g, "")); onToast?.("IBAN copiado"); }
    catch { onToast?.(OY_IBAN); }
  };

  const pct = Math.min(100, Math.round((pendiente / UMBRAL_FACTURA) * 100));
  const porPagar = facturas.filter((f) => f.status === "pendiente");

  if (cargando) {
    return <div style={{ padding: "40px 0", textAlign: "center", color: C.mutedL, fontFamily: F, fontSize: 14 }}>Cargando tus facturas...</div>;
  }

  return (
    <div style={{ fontFamily: F, paddingBottom: 24 }}>
      <div style={{ padding: "22px 0 12px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: C.text, margin: 0 }}>Facturas</h2>
        <div style={{ fontSize: 13, color: C.mutedL, marginTop: 4 }}>
          Se emiten el día 1 de cada mes o al llegar a {eur(UMBRAL_FACTURA).replace(",00", "")} en leads. Tienes 5 días para pagar cada una.
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

      {/* Cómo pagar */}
      <Card accent={porPagar.length ? C.orange + "88" : undefined}>
        <div style={{ fontSize: 13.5, color: C.text, fontWeight: 800 }}>Cómo pagar</div>
        <div style={{ fontSize: 12.5, color: C.mutedL, marginTop: 4 }}>Transferencia bancaria en los 5 días siguientes a la emisión. Pon el número de factura como concepto.</div>
        <div style={{ marginTop: 10, padding: "10px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 9 }}>
          <div style={{ fontSize: 11, color: C.mutedL, fontWeight: 700 }}>IBAN</div>
          <div style={{ fontSize: 15, color: C.text, fontWeight: 800, letterSpacing: "0.02em", marginTop: 2, wordBreak: "break-all" }}>{OY_IBAN}</div>
          <div style={{ fontSize: 12, color: C.mutedL, marginTop: 4 }}>Titular: {OY_TITULAR}</div>
        </div>
        <div style={{ display: "flex", marginTop: 10 }}>
          <Boton small outline color={C.accent} onClick={copiarIban}>Copiar IBAN</Boton>
        </div>
      </Card>

      {/* Lista */}
      <Titulo>Tus facturas</Titulo>
      {facturas.length === 0 ? (
        <Card><div style={{ color: C.mutedL, fontSize: 13.5 }}>Aún no tienes facturas. La primera se emitirá el día 1 o al llegar a {eur(UMBRAL_FACTURA).replace(",00", "")}.</div></Card>
      ) : facturas.map((f) => {
        const e = estadoFactura(f);
        return (
          <Card key={f.id} accent={f.status === "pendiente" ? e.color + "88" : undefined}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{f.number}</div>
                <div style={{ color: C.mutedL, fontSize: 12.5, marginTop: 2 }}>
                  Emitida el {fecha(f.issued_at)} · {f.n_leads} {f.n_leads === 1 ? "lead" : "leads"}
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
              <div style={{ fontSize: 12.5, color: e.color, fontWeight: 700, marginTop: 8 }}>Pagar antes del {fecha(f.due_at)}</div>
            )}
            {f.status === "pagada" && f.paid_at && (
              <div style={{ fontSize: 12.5, color: C.green, fontWeight: 700, marginTop: 8 }}>Pagada el {fecha(f.paid_at)}</div>
            )}
            <div style={{ display: "flex", marginTop: 10 }}>
              <Boton onClick={() => descargar(f)} disabled={descargando === f.id} color={C.accent}>
                {descargando === f.id ? "Preparando PDF..." : "Descargar factura (PDF)"}
              </Boton>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
