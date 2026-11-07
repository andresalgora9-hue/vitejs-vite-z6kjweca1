// ============================================================
// OficioYa · Panel PROFESIONAL — menú «Pagar» de las facturas
// Transferencia (IBAN) o Bizum, cada dato con su botón de copiar,
// y «Ya he pagado»: envía el justificante por WhatsApp y marca la factura
// como avisada (oy_factura_aviso_pago) para que no se cobre también en la tarjeta.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { db } from "../supabase";
import { OY_IBAN, OY_TITULAR, OY_BIZUM } from "../shared/crm";
import { C, F, Boton, FacturaRow, eur, fecha } from "./proComun";

const WHATSAPP_OY = "34656398014";
const EMAIL_OY = "admin@algoracompound.com";

type Metodo = "transferencia" | "bizum";

async function copiarTexto(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

// Importe para pegar en la app del banco: 992,20 (sin el símbolo €)
const importe = (n: number) => eur(n).replace(/\s*€$/, "");

export default function PagarFactura({ facturas, nombre, userId, conTarjeta, onAvisado, onClose }: {
  facturas: FacturaRow[];   // vacío = solo datos de pago
  nombre?: string;
  userId?: string;          // para avisar de que ya está pagada
  conTarjeta?: boolean;     // tiene tarjeta guardada (pago automático)
  onAvisado?: () => void;
  onClose: () => void;
}) {
  const [metodo, setMetodo] = useState<Metodo>("transferencia");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const [avisado, setAvisado] = useState(false);
  const cerrar = useRef(onClose);
  cerrar.current = onClose;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar.current(); };
    document.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, []);

  const total = facturas.reduce((s, f) => s + Number(f.total || 0), 0);
  const concepto = facturas.map((f) => f.number).join(", ");
  const vence = facturas.length ? facturas.map((f) => f.due_at).sort()[0] : null;
  const vencida = vence ? Math.ceil((new Date(vence).getTime() - Date.now()) / 86400000) < 0 : false;
  const titulo = facturas.length === 0 ? "Datos de pago"
    : facturas.length === 1 ? "Pagar factura " + facturas[0].number
    : "Pagar " + facturas.length + " facturas";

  const copiar = async (id: string, texto: string) => {
    const ok = await copiarTexto(texto);
    setFallo(!ok);
    if (!ok) return;
    setCopiado(id);
    setTimeout(() => setCopiado((c) => (c === id ? null : c)), 1800);
  };

  const todo = [
    "Cuenta a ingresar (IBAN): " + OY_IBAN,
    "Titular: " + OY_TITULAR,
    "Concepto: " + (concepto || "nº de factura"),
    ...(total > 0 ? ["Importe: " + eur(total)] : []),
  ].join("\n");

  const saludo = nombre ? "Hola, soy " + nombre + ". " : "Hola. ";
  const textoWa = facturas.length
    ? saludo + "He pagado " + (facturas.length === 1 ? "la factura " : "las facturas ") + concepto + " (" + eur(total) + ") por "
      + (metodo === "bizum" ? "Bizum" : "transferencia") + ". Te mando el justificante."
    : saludo + "Te mando el justificante de pago de mi factura.";
  const enlaceWa = "https://wa.me/" + WHATSAPP_OY + "?text=" + encodeURIComponent(textoWa);

  // «Ya he pagado»: el enlace abre WhatsApp en otra ventana y a la vez se avisa a OficioYa
  const avisar = () => {
    if (!facturas.length || !userId || avisado) return;
    setAvisado(true);
    db.rpc("oy_factura_aviso_pago", { p_pro: userId, p_facturas: facturas.map((f) => f.id), p_metodo: metodo })
      .then(({ error }) => { if (error) setAvisado(false); else onAvisado?.(); });
  };

  const dato = (id: string, etiqueta: string, valor: string, copia?: string, nota?: string) => (
    <div style={{ padding: "10px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 9, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, fontSize: 11, color: C.mutedL, fontWeight: 700 }}>{etiqueta}</div>
        {copia && (
          <button onClick={() => copiar(id, copia)} style={{
            flexShrink: 0, padding: "5px 10px", borderRadius: 7, cursor: "pointer",
            fontFamily: F, fontSize: 12, fontWeight: 800,
            background: copiado === id ? C.green + "22" : "transparent",
            border: "1px solid " + (copiado === id ? C.green : C.accent),
            color: copiado === id ? C.green : C.accent,
          }}>{copiado === id ? "✓ Copiado" : "Copiar"}</button>
        )}
      </div>
      <div style={{
        fontSize: 15, color: C.text, fontWeight: 800, marginTop: 3,
        wordBreak: "break-word", userSelect: "all", WebkitUserSelect: "all",
      }}>{valor}</div>
      {nota && <div style={{ fontSize: 12, color: C.mutedL, marginTop: 3 }}>{nota}</div>}
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box",
        background: C.surface, border: "1px solid " + C.border, borderBottom: "none",
        borderRadius: "18px 18px 0 0", fontFamily: F,
        padding: "10px 16px calc(18px + env(safe-area-inset-bottom, 0px))",
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: C.border, margin: "0 auto 12px" }} />

        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{titulo}</div>
            {total > 0 && <div style={{ fontSize: 28, fontWeight: 900, color: C.accent, marginTop: 4 }}>{eur(total)}</div>}
            {vence && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: vencida ? C.red : C.orange, marginTop: 2 }}>
                {vencida ? "Vencida desde el " + fecha(vence) + " · paga cuanto antes" : "Pagar antes del " + fecha(vence)}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{
            background: "transparent", border: "none", color: C.mutedL, fontSize: 22,
            lineHeight: 1, cursor: "pointer", padding: 4, fontFamily: F,
          }}>✕</button>
        </div>

        {/* Transferencia o Bizum */}
        <div style={{ display: "flex", gap: 4, marginTop: 14, padding: 4, background: C.bg, border: "1px solid " + C.border, borderRadius: 10 }}>
          {(["transferencia", "bizum"] as Metodo[]).map((m) => (
            <button key={m} onClick={() => { setMetodo(m); setFallo(false); }} aria-pressed={metodo === m} style={{
              flex: 1, padding: "9px 8px", borderRadius: 7, border: "none", cursor: "pointer",
              fontFamily: F, fontSize: 13, fontWeight: 800,
              background: metodo === m ? C.card : "transparent",
              color: metodo === m ? C.accent : C.mutedL,
              boxShadow: metodo === m ? "0 0 0 1px " + C.border : "none",
            }}>{m === "transferencia" ? "Transferencia" : "Bizum"}</button>
          ))}
        </div>

        {metodo === "transferencia" ? (
          <>
            {dato("iban", "Cuenta a ingresar (IBAN)", OY_IBAN, OY_IBAN.replace(/\s/g, ""))}
            {dato("titular", "Titular", OY_TITULAR, OY_TITULAR)}
            {dato("concepto", "Concepto", concepto || "El número de tu factura", concepto || undefined)}
            {total > 0 && dato("importe", "Importe", eur(total), importe(total))}
            <div style={{ display: "flex", marginTop: 12 }}>
              <Boton onClick={() => copiar("todo", todo)} color={copiado === "todo" ? C.green : C.accent}>
                {copiado === "todo" ? "✓ Datos copiados" : "Copiar todos los datos"}
              </Boton>
            </div>
          </>
        ) : (
          <>
            {dato("bizum", "Número de Bizum", OY_BIZUM, OY_BIZUM.replace(/\s/g, ""), "Te saldrá a nombre de " + OY_TITULAR + ".")}
            {dato("concepto", "Concepto", concepto || "El número de tu factura", concepto || undefined)}
            {total > 0 && dato("importe", "Importe", eur(total), importe(total))}
          </>
        )}

        {fallo && (
          <div style={{ fontSize: 12.5, color: C.orange, marginTop: 10 }}>
            No se ha podido copiar. Mantén pulsado el dato para copiarlo a mano.
          </div>
        )}

        {/* Justificante */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid " + C.border }}>
          <div style={{ fontSize: 12.5, color: C.mutedL, lineHeight: 1.45 }}>
            {facturas.length
              ? "Cuando pagues, pulsa aquí y mándanos el justificante por WhatsApp (o a " + EMAIL_OY + ")"
                + (conTarjeta ? ": así no se intentará cobrar también en tu tarjeta." : ".")
              : "Cuando pagues, mándanos el justificante el mismo día por WhatsApp o a " + EMAIL_OY + "."}
          </div>
          <div style={{ display: "flex", marginTop: 10 }}>
            <a href={enlaceWa} target="_blank" rel="noreferrer" onClick={avisar} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "11px 12px", borderRadius: 9, textDecoration: "none", boxSizing: "border-box",
              background: C.green, color: "#000", fontFamily: F, fontSize: 13, fontWeight: 800, cursor: "pointer",
            }}>
              {!facturas.length ? "Enviar justificante por WhatsApp" : avisado ? "✓ Avisado · abrir WhatsApp otra vez" : "Ya he pagado · enviar justificante"}
            </a>
          </div>
          {avisado && (
            <div style={{ fontSize: 12.5, color: C.green, marginTop: 8, lineHeight: 1.45 }}>
              Gracias. Lo comprobamos y te marcamos {facturas.length === 1 ? "la factura" : "las facturas"} como {facturas.length === 1 ? "pagada" : "pagadas"}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
