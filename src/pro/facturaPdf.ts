// ============================================================
// OficioYa · Factura de leads en PDF (se genera en el móvil del profesional)
// ============================================================
import { OY_IBAN, OY_TITULAR } from "../shared/crm";
import { OY_EMISOR, FacturaRow, CANAL_LABEL, Canal } from "./proComun";

const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

export interface LeadFactura {
  created_at: string;
  trade: string;
  canal: Canal;
  zona: string | null;
  price: number;
}

function cargarJsPDF(): Promise<any> {
  const w = window as any;
  if (w.jspdf?.jsPDF) return Promise.resolve(w.jspdf.jsPDF);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = JSPDF_URL;
    s.onload = () => (w.jspdf?.jsPDF ? resolve(w.jspdf.jsPDF) : reject(new Error("PDF no disponible")));
    s.onerror = () => reject(new Error("No se ha podido cargar el generador de PDF"));
    document.head.appendChild(s);
  });
}

const num = (n: number) =>
  (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" });
const oficio = (t: string) => {
  const s = (t || "").toLowerCase();
  if (s.includes("pint")) return "pintura";
  if (s.includes("fontan")) return "fontanería";
  return s || "servicios del hogar";
};

export function dibujarFactura(JsPDF: any, f: FacturaRow, leads: LeadFactura[]) {
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const M = 18;           // margen
  const W = 210 - M * 2;  // ancho útil
  const naranja: [number, number, number] = [232, 134, 42];
  const gris: [number, number, number] = [110, 118, 135];
  const negro: [number, number, number] = [25, 28, 36];
  let y = 20;

  // Cabecera
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...negro);
  doc.text("Oficio", M, y);
  doc.setTextColor(...naranja); doc.text("Ya", M + doc.getTextWidth("Oficio"), y);
  doc.setFontSize(18); doc.setTextColor(...negro);
  doc.text("FACTURA", 210 - M, y, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...gris);
  doc.text("Nº " + f.number, 210 - M, y + 6, { align: "right" });
  doc.text("Fecha de emisión: " + dia(f.issued_at), 210 - M, y + 11, { align: "right" });
  doc.text("Vencimiento: " + dia(f.due_at), 210 - M, y + 16, { align: "right" });
  doc.setDrawColor(...naranja); doc.setLineWidth(0.8); doc.line(M, y + 21, 210 - M, y + 21);
  y += 31;

  // Emisor y cliente
  const col2 = M + W / 2 + 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...gris);
  doc.text("EMISOR", M, y); doc.text("CLIENTE", col2, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...negro);
  const emisor = [
    OY_EMISOR.nombre + " (" + OY_EMISOR.comercial + ")",
    "NIF: " + OY_EMISOR.nif,
    OY_EMISOR.direccion,
    OY_EMISOR.cpCiudad,
  ];
  const cliente = [
    f.cliente_nombre || "—",
    "NIF/CIF: " + (f.cliente_nif || "—"),
    ...(doc.splitTextToSize(f.cliente_direccion || "Dirección: —", W / 2 - 4) as string[]),
    f.cliente_email || "",
    f.cliente_telefono ? "Tel.: " + f.cliente_telefono : "",
  ].filter(Boolean);
  emisor.forEach((t, i) => doc.text(t, M, y + 6 + i * 5));
  cliente.forEach((t, i) => doc.text(t, col2, y + 6 + i * 5));
  y += 8 + Math.max(emisor.length, cliente.length) * 5 + 6;

  // Concepto agrupado por oficio y precio
  const grupos: Record<string, { texto: string; uds: number; precio: number }> = {};
  leads.forEach((l) => {
    const k = oficio(l.trade) + "|" + l.price;
    if (!grupos[k]) grupos[k] = { texto: "Captación de clientes (leads) de " + oficio(l.trade), uds: 0, precio: Number(l.price) };
    grupos[k].uds++;
  });
  const filas = Object.values(grupos);
  if (filas.length === 0) filas.push({ texto: "Captación de clientes (leads)", uds: f.n_leads, precio: f.n_leads ? f.base / f.n_leads : 0 });

  const cConcepto = M + 2, cUds = M + W * 0.62, cPrecio = M + W * 0.8, cImporte = 210 - M - 2;
  doc.setFillColor(245, 246, 249); doc.rect(M, y, W, 9, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...gris);
  doc.text("CONCEPTO", cConcepto, y + 6);
  doc.text("UDS.", cUds, y + 6, { align: "right" });
  doc.text("PRECIO", cPrecio, y + 6, { align: "right" });
  doc.text("IMPORTE", cImporte, y + 6, { align: "right" });
  y += 9;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...negro);
  filas.forEach((r) => {
    y += 7;
    doc.text(r.texto, cConcepto, y);
    doc.text(String(r.uds), cUds, y, { align: "right" });
    doc.text(num(r.precio), cPrecio, y, { align: "right" });
    doc.text(num(r.uds * r.precio), cImporte, y, { align: "right" });
  });
  if (f.period_start && f.period_end) {
    y += 5.5;
    doc.setFontSize(9); doc.setTextColor(...gris);
    doc.text("Leads recibidos del " + dia(f.period_start) + " al " + dia(f.period_end) + " (detalle en la página siguiente)", cConcepto, y);
  }
  y += 5;
  doc.setDrawColor(225, 228, 235); doc.setLineWidth(0.3); doc.line(M, y, 210 - M, y);

  // Totales
  y += 8;
  const xEt = M + W * 0.62, xVal = 210 - M - 2;
  doc.setFontSize(10.5); doc.setTextColor(...negro); doc.setFont("helvetica", "normal");
  doc.text("Base imponible", xEt, y); doc.text(num(f.base), xVal, y, { align: "right" });
  y += 6.5;
  doc.text("IVA (" + Number(f.iva_pct) + " %)", xEt, y); doc.text(num(f.iva), xVal, y, { align: "right" });
  y += 4;
  doc.setDrawColor(...naranja); doc.setLineWidth(0.6); doc.line(xEt, y, 210 - M, y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("TOTAL", xEt, y); doc.text(num(f.total), xVal, y, { align: "right" });

  // Forma de pago
  y += 16;
  doc.setFillColor(253, 244, 234); doc.setDrawColor(...naranja); doc.setLineWidth(0.4);
  doc.roundedRect(M, y, W, 31, 2, 2, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...negro);
  doc.text("Forma de pago: transferencia bancaria", M + 5, y + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("IBAN: " + OY_IBAN, M + 5, y + 13);
  doc.text("Titular: " + OY_TITULAR, M + 5, y + 18.5);
  doc.text("Concepto de la transferencia: " + f.number, M + 5, y + 24);
  doc.setFont("helvetica", "bold");
  doc.text("Pagar antes del " + dia(f.due_at) + " (5 días desde la emisión)", 210 - M - 5, y + 7, { align: "right" });

  // Pie
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...gris);
  doc.text(OY_EMISOR.comercial + " · " + OY_EMISOR.web + " · " + OY_EMISOR.nombre + " · NIF " + OY_EMISOR.nif, 105, 287, { align: "center" });

  // Detalle de leads
  if (leads.length) {
    doc.addPage();
    let yy = 20;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...negro);
    doc.text("Detalle de leads · Factura " + f.number, M, yy);
    yy += 9;
    const cab = () => {
      doc.setFillColor(245, 246, 249); doc.rect(M, yy, W, 8, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...gris);
      doc.text("Nº", M + 2, yy + 5.5);
      doc.text("FECHA", M + 12, yy + 5.5);
      doc.text("CANAL", M + 52, yy + 5.5);
      doc.text("ZONA", M + 85, yy + 5.5);
      doc.text("IMPORTE", 210 - M - 2, yy + 5.5, { align: "right" });
      yy += 8;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...negro);
    };
    cab();
    const orden = [...leads].sort((a, b) => a.created_at.localeCompare(b.created_at));
    orden.forEach((l, i) => {
      if (yy > 275) { doc.addPage(); yy = 20; cab(); }
      yy += 6;
      const fh = new Date(l.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      doc.text(String(i + 1), M + 2, yy);
      doc.text(fh, M + 12, yy);
      doc.text(CANAL_LABEL[l.canal] || l.canal, M + 52, yy);
      doc.text(String(l.zona || "—").slice(0, 40), M + 85, yy);
      doc.text(num(l.price), 210 - M - 2, yy, { align: "right" });
    });
  }
  return doc;
}

export async function descargarFacturaPdf(f: FacturaRow, leads: LeadFactura[]) {
  const JsPDF = await cargarJsPDF();
  const doc = dibujarFactura(JsPDF, f, leads);
  doc.save("Factura-" + f.number + ".pdf");
}
