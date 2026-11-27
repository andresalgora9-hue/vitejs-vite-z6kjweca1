// ============================================================
// OficioYa · Presupuesto de pintura en PDF (se genera en el móvil del profesional)
// Con el logo y el color del profesional y un sello discreto de OficioYa al pie.
// ============================================================
import {
  Marca, Presupuesto, totales, tituloPartida, detallePartida, tituloPresupuesto, proceso, incluye,
  tramosPago, plazoTxt, sumaM2, estanciasTxt, euros, cifra, fechaCorta, sumarDias, cap,
  TIPOS_PINTURA, ACABADOS, METODOS_PAGO, FORMAS_PAGO, ESTADOS_PARED, coloresTxt,
} from "./presupuestoDatos";

const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

export function cargarJsPDF(): Promise<any> {
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

// ── COLOR ───────────────────────────────────────────────────
type RGB = [number, number, number];
export function hexARgb(hex: string): RGB {
  const h = (hex || "").replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(v, 16);
  return isNaN(n) ? [40, 120, 168] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mezcla = (a: RGB, b: RGB, k: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k)) as RGB;
const luz = (c: RGB) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

export interface LogoPdf { data: string; w: number; h: number; formato: "PNG" | "JPEG" }

// Descarga el logo y lo deja listo para el PDF (dataURL + medidas)
export async function prepararLogo(url: string | null): Promise<LogoPdf | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: "force-cache" });
    if (!r.ok) return null;
    const blob = await r.blob();
    const data: string = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
    const dim: { w: number; h: number } = await new Promise((res) => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => res({ w: 1, h: 1 });
      img.src = data;
    });
    return { data, w: dim.w, h: dim.h, formato: /image\/png/.test(data.slice(0, 30)) ? "PNG" : "JPEG" };
  } catch {
    return null;
  }
}

// ── DIBUJO ──────────────────────────────────────────────────
export function dibujarPresupuesto(JsPDF: any, p: Presupuesto, marca: Marca, logo: LogoPdf | null) {
  const doc = new JsPDF({ unit: "mm", format: "a4", compress: true });
  const PW = 210, PH = 297, M = 16, W = PW - M * 2;
  const LIMITE = 274;

  const P = hexARgb(marca.color || "#2878A8");
  const OSC = mezcla(P, [8, 12, 22], 0.42);
  const TINTE = mezcla(P, [255, 255, 255], 0.93);
  const TINTE2 = mezcla(P, [255, 255, 255], 0.8);
  const TINTA: RGB = [27, 31, 42];
  const GRIS: RGB = [104, 112, 128];
  const GRIS_L: RGB = [150, 156, 170];
  const LINEA: RGB = [226, 229, 236];
  const BLANCO: RGB = [255, 255, 255];
  const NARANJA: RGB = [232, 134, 42];
  const sobreColor: RGB = luz(P) > 0.72 ? TINTA : BLANCO; // texto encima del color del profesional

  const t = totales(p);
  const nombre = (marca.nombre || "").trim() || "Presupuesto";
  const titulo = tituloPresupuesto(p);
  const validoHasta = sumarDias(p.fecha, Number(p.validez_dias) || 30);

  // «m²»: las fuentes básicas del PDF no traen el ², así que se pinta un «2» pequeño y subido
  const textoBase = doc.text.bind(doc);
  doc.text = (txt: any, x: number, y: number, op: any = {}) => {
    if (typeof txt === "string" && op.charSpace && (op.align === "right" || op.align === "center")) {
      const ancho = doc.getTextWidth(txt) + op.charSpace * (txt.length - 1);
      return textoBase(txt, op.align === "right" ? x - ancho : x - ancho / 2, y, { charSpace: op.charSpace });
    }
    if (typeof txt !== "string" || txt.indexOf("²") < 0) return textoBase(txt, x, y, op);
    const tam = doc.getFontSize();
    const trozos = txt.split("²");
    const anchoSup = doc.getTextWidth("2") * 0.62;
    const ancho = trozos.reduce((s: number, t: string) => s + doc.getTextWidth(t), 0) + anchoSup * (trozos.length - 1);
    let xx = op.align === "right" ? x - ancho : op.align === "center" ? x - ancho / 2 : x;
    trozos.forEach((t: string, i: number) => {
      if (t) { textoBase(t, xx, y); xx += doc.getTextWidth(t); }
      if (i < trozos.length - 1) {
        doc.setFontSize(tam * 0.62); textoBase("2", xx, y - tam * 0.3528 * 0.36); doc.setFontSize(tam);
        xx += anchoSup;
      }
    });
    return doc;
  };

  const opacidad = (o: number) => { try { doc.setGState(new doc.GState({ opacity: o })); } catch { /* sin transparencia */ } };
  const fuente = (estilo: "normal" | "bold" | "italic" | "bolditalic", tam: number, color: RGB) => {
    doc.setFont("helvetica", estilo); doc.setFontSize(tam); doc.setTextColor(...color);
  };
  const lineas = (txt: string, ancho: number): string[] => doc.splitTextToSize(txt || "", ancho);
  const altoLinea = (tam: number, k = 1.38) => tam * 0.3528 * k;

  // Sombra suave: varias capas transparentes desplazadas
  const sombra = (x: number, y: number, w: number, h: number, r: number) => {
    doc.setFillColor(20, 26, 40);
    [[1.6, 0.035], [1.1, 0.05], [0.6, 0.06]].forEach(([d, o]) => {
      opacidad(o); doc.roundedRect(x - d * 0.2, y + d, w + d * 0.4, h, r, r, "F");
    });
    opacidad(1);
  };
  const tarjeta = (x: number, y: number, w: number, h: number, relleno: RGB = BLANCO, borde: RGB | null = LINEA) => {
    sombra(x, y, w, h, 2.6);
    doc.setFillColor(...relleno);
    if (borde) { doc.setDrawColor(...borde); doc.setLineWidth(0.25); doc.roundedRect(x, y, w, h, 2.6, 2.6, "FD"); }
    else doc.roundedRect(x, y, w, h, 2.6, 2.6, "F");
  };
  const degradado = (x: number, y: number, w: number, h: number, de: RGB, a: RGB, pasos = 70) => {
    const paso = w / pasos;
    for (let i = 0; i < pasos; i++) {
      doc.setFillColor(...mezcla(de, a, i / (pasos - 1)));
      doc.rect(x + i * paso, y, paso + 0.3, h, "F");
    }
  };
  const etiqueta = (txt: string, x: number, y: number, color: RGB = P) => {
    fuente("bold", 7.2, color); doc.text(txt.toUpperCase(), x, y, { charSpace: 0.32 });
  };
  const check = (x: number, y: number, ok = true) => {
    if (ok) {
      doc.setFillColor(...TINTE2); doc.circle(x, y, 1.75, "F");
      doc.setDrawColor(...P); doc.setLineWidth(0.45);
      doc.line(x - 0.8, y + 0.05, x - 0.2, y + 0.7); doc.line(x - 0.2, y + 0.7, x + 0.95, y - 0.65);
    } else {
      doc.setFillColor(240, 241, 244); doc.circle(x, y, 1.75, "F");
      doc.setDrawColor(...GRIS_L); doc.setLineWidth(0.4);
      doc.line(x - 0.65, y - 0.65, x + 0.65, y + 0.65); doc.line(x + 0.65, y - 0.65, x - 0.65, y + 0.65);
    }
  };

  // Logo dentro de una caja, sin deformarlo. Sin logo: iniciales.
  const pintarLogo = (x: number, y: number, caja: number) => {
    if (logo) {
      const k = Math.min(caja / logo.w, caja / logo.h);
      const w = logo.w * k, h = logo.h * k;
      try { doc.addImage(logo.data, logo.formato, x + (caja - w) / 2, y + (caja - h) / 2, w, h, undefined, "FAST"); return; } catch { /* iniciales */ }
    }
    const ini = nombre.split(/\s+/).filter((s) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(s)).slice(0, 2).map((s) => s[0].toUpperCase()).join("") || "P";
    doc.setFillColor(...P); doc.circle(x + caja / 2, y + caja / 2, caja / 2, "F");
    fuente("bold", caja * 1.05, sobreColor);
    doc.text(ini, x + caja / 2, y + caja / 2 + caja * 0.13, { align: "center" });
  };

  let y = 0;

  // ── Cabecera de la primera página ──
  const cabecera = () => {
    const H = 56;
    degradado(0, 0, PW, H, OSC, P);
    // círculos de fondo para dar profundidad
    doc.setFillColor(255, 255, 255);
    opacidad(0.06); doc.circle(PW - 18, 6, 34, "F");
    opacidad(0.05); doc.circle(PW - 52, H + 6, 24, "F");
    opacidad(0.04); doc.circle(PW - 4, H - 6, 16, "F");
    opacidad(1);
    // franja inferior fina
    doc.setFillColor(...mezcla(P, BLANCO, 0.35)); doc.rect(0, H, PW, 1.1, "F");

    // logo en tarjeta blanca
    const L = 36, lx = M, ly = 10;
    doc.setFillColor(0, 0, 0);
    [[2.2, 0.06], [1.4, 0.08], [0.7, 0.1]].forEach(([d, o]) => { opacidad(o); doc.roundedRect(lx - d * 0.2, ly + d, L + d * 0.4, L, 4, 4, "F"); });
    opacidad(1);
    doc.setFillColor(...BLANCO); doc.roundedRect(lx, ly, L, L, 4, 4, "F");
    pintarLogo(lx + 3, ly + 3, L - 6);

    // datos del profesional
    const tx = lx + L + 7, anchoNombre = 92;
    let tam = 19;
    fuente("bold", tam, sobreColor);
    while (tam > 12 && doc.getTextWidth(nombre.toUpperCase()) > anchoNombre) { tam -= 0.5; doc.setFontSize(tam); }
    const nl = lineas(nombre.toUpperCase(), anchoNombre).slice(0, 2);
    let ty = 20.5;
    nl.forEach((l) => { doc.text(l, tx, ty, { charSpace: 0.2 }); ty += altoLinea(tam, 1.1); });
    if (marca.lema.trim()) {
      opacidad(0.88); fuente("italic", 9.5, sobreColor); doc.text(lineas(marca.lema.trim(), anchoNombre)[0], tx, ty + 0.6); opacidad(1);
      ty += 5.5;
    }
    ty += 1.5;
    fuente("normal", 8.2, sobreColor); opacidad(0.92);
    const contacto = [marca.telefono && "Tel. " + marca.telefono, marca.email].filter(Boolean).join("   ·   ");
    const fiscal = [marca.razon && marca.razon !== nombre ? marca.razon : "", marca.nif && "NIF " + marca.nif].filter(Boolean).join("   ·   ");
    [contacto, fiscal, marca.direccion, marca.web].filter(Boolean).slice(0, 4).forEach((l) => {
      if (ty > 50) return;
      doc.text(lineas(String(l), anchoNombre)[0], tx, ty); ty += 4.1;
    });
    opacidad(1);

    // bloque del documento (derecha)
    const rx = PW - M;
    opacidad(0.8); fuente("bold", 8, sobreColor); doc.text("PRESUPUESTO", rx, 17, { align: "right", charSpace: 0.9 }); opacidad(1);
    fuente("bold", 15, sobreColor); doc.text(p.numero || "—", rx, 24.5, { align: "right" });
    fuente("normal", 8.5, sobreColor); opacidad(0.92);
    doc.text("Fecha: " + fechaCorta(p.fecha), rx, 31, { align: "right" });
    doc.text("Válido hasta: " + fechaCorta(validoHasta), rx, 35.4, { align: "right" });
    opacidad(1);
    y = H + 12;
  };

  // ── Cabecera corta de las páginas siguientes ──
  const cabeceraCorta = () => {
    degradado(0, 0, PW, 15, OSC, P, 40);
    if (logo) {
      doc.setFillColor(...BLANCO); doc.roundedRect(M, 2.5, 10, 10, 2, 2, "F");
      pintarLogo(M + 0.8, 3.3, 8.4);
    }
    fuente("bold", 10, sobreColor); doc.text(nombre.toUpperCase(), M + (logo ? 13 : 0), 9.4, { charSpace: 0.2 });
    fuente("normal", 8.5, sobreColor); doc.text("Presupuesto " + (p.numero || ""), PW - M, 9.4, { align: "right" });
    y = 25;
  };

  const nuevaPagina = () => { doc.addPage(); cabeceraCorta(); };
  const asegurar = (h: number) => { if (y + h > LIMITE) nuevaPagina(); };

  const seccion = (txt: string, minimo = 24) => {
    asegurar(minimo);
    y += 3;
    doc.setFillColor(...P); doc.roundedRect(M, y - 3.4, 1.4, 4.4, 0.6, 0.6, "F");
    fuente("bold", 10.5, TINTA); doc.text(txt.toUpperCase(), M + 4, y, { charSpace: 0.3 });
    const fin = M + 4 + doc.getTextWidth(txt.toUpperCase()) + txt.length * 0.3 + 4;
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.3); doc.line(fin, y - 1.2, PW - M, y - 1.2);
    y += 6.5;
  };

  // ════════════════════════════════════════════════════════
  cabecera();

  // Título y obra
  fuente("bold", 17, TINTA);
  lineas(titulo, W).slice(0, 2).forEach((l) => { doc.text(l, M, y); y += 7.2; });
  const sub = [p.cliente.direccion, p.cliente.poblacion].filter(Boolean).join(", ");
  if (sub) { fuente("normal", 9.5, GRIS); doc.text(lineas("Obra en " + sub, W)[0], M, y - 1.2); y += 4.2; }
  doc.setFillColor(...P); doc.roundedRect(M, y, 18, 1.1, 0.5, 0.5, "F");
  y += 7;

  // Tarjetas: cliente y obra
  {
    const g = 6, cw = (W - g) / 2, pad = 5.5;
    const cli: [string, RGB, "bold" | "normal"][] = [];
    if (p.cliente.nombre) cli.push([p.cliente.nombre, TINTA, "bold"]);
    if (p.cliente.telefono) cli.push(["Tel. " + p.cliente.telefono, GRIS, "normal"]);
    if (p.cliente.email) cli.push([p.cliente.email, GRIS, "normal"]);
    if (p.cliente.direccion) cli.push([p.cliente.direccion, GRIS, "normal"]);
    if (p.cliente.poblacion) cli.push([p.cliente.poblacion, GRIS, "normal"]);
    if (!cli.length) cli.push(["—", GRIS, "normal"]);

    const obra: [string, RGB, "bold" | "normal"][] = [];
    const est = estanciasTxt(p.obra.estancias);
    obra.push([p.obra.inmueble || "Vivienda", TINTA, "bold"]);
    if (est) obra.push([cap(est), GRIS, "normal"]);
    const ocup = p.obra.ocupacion === "vacia" ? "Vivienda vacía" : p.obra.ocupacion === "habitada" ? "Habitada durante la obra" : p.obra.ocupacion === "amueblada" ? "Con muebles" : "";
    const m2v = Number(String(p.obra.m2_vivienda).replace(",", "."));
    const linea3 = [m2v > 0 ? cifra(m2v) + " m² construidos" : "", ocup].filter(Boolean).join(" · ");
    if (linea3) obra.push([linea3, GRIS, "normal"]);
    const estado = ESTADOS_PARED.filter((e) => p.estado.includes(e.id)).map((e) => e.label.toLowerCase());
    if (estado.length) obra.push(["Paredes: " + estado.join(", "), GRIS, "normal"]);

    const medir = (arr: [string, RGB, string][]) => arr.reduce((s, [txt]) => s + lineas(txt, cw - pad * 2).length * 4.3, 0);
    const h = Math.max(medir(cli), medir(obra)) + 13;
    asegurar(h + 4);
    const dibujar = (x: number, tit: string, arr: [string, RGB, "bold" | "normal"][]) => {
      tarjeta(x, y, cw, h);
      doc.setFillColor(...P); doc.roundedRect(x, y, cw, 1.3, 0.6, 0.6, "F");
      etiqueta(tit, x + pad, y + 7.2);
      let yy = y + 12.6;
      arr.forEach(([txt, color, estilo], i) => {
        fuente(estilo, i === 0 ? 10.2 : 8.8, color);
        lineas(txt, cw - pad * 2).forEach((l) => { doc.text(l, x + pad, yy); yy += 4.3; });
      });
    };
    dibujar(M, "Datos del cliente", cli);
    dibujar(M + cw + g, "La obra", obra);
    y += h + 7;
  }

  // Resumen en 4 cifras
  {
    const m2 = sumaM2(p);
    const plazo = plazoTxt(p);
    const tiles: { k: string; v: string; dest?: boolean }[] = [];
    tiles.push(m2 > 0 ? { k: "Superficie", v: cifra(m2) + " m²" } : { k: "Trabajos", v: String(p.partidas.length) });
    tiles.push({ k: "Plazo", v: plazo || "A convenir" });
    tiles.push({ k: "Garantía", v: p.garantia || "—" });
    tiles.push({ k: p.iva_pct ? "Total IVA incl." : "Total", v: euros(t.total), dest: true });
    const g = 4, tw = (W - g * 3) / 4, h = 19;
    asegurar(h + 6);
    tiles.forEach((ti, i) => {
      const x = M + i * (tw + g);
      if (ti.dest) {
        sombra(x, y, tw, h, 2.6);
        degradado(x, y, tw, h, P, OSC, 30);
        // esquinas redondeadas: tapamos las del degradado con un marco blanco
        doc.setDrawColor(...BLANCO); doc.setLineWidth(1.2); doc.roundedRect(x - 0.6, y - 0.6, tw + 1.2, h + 1.2, 3.2, 3.2, "S");
        opacidad(0.85); fuente("bold", 7, sobreColor); doc.text(ti.k.toUpperCase(), x + tw / 2, y + 6.8, { align: "center", charSpace: 0.5 }); opacidad(1);
        let tam = 13.5; fuente("bold", tam, sobreColor);
        while (tam > 9 && doc.getTextWidth(ti.v) > tw - 4) { tam -= 0.5; doc.setFontSize(tam); }
        doc.text(ti.v, x + tw / 2, y + 14.2, { align: "center" });
      } else {
        tarjeta(x, y, tw, h, TINTE, null);
        fuente("bold", 7, P); doc.text(ti.k.toUpperCase(), x + tw / 2, y + 6.8, { align: "center", charSpace: 0.5 });
        let tam = 12.5; fuente("bold", tam, TINTA);
        while (tam > 8 && doc.getTextWidth(ti.v) > tw - 4) { tam -= 0.5; doc.setFontSize(tam); }
        doc.text(ti.v, x + tw / 2, y + 14, { align: "center" });
      }
    });
    y += h + 8;
  }

  // Trabajos a realizar
  if (p.partidas.length) {
    seccion("Trabajos a realizar");
    p.partidas.forEach((x, i) => {
      const tx = M + 9, ancho = W - 9;
      const tit = tituloPartida(x);
      const det = lineas(detallePartida(x, p), ancho);
      const h = 5 + det.length * altoLinea(8.9) + 4;
      asegurar(h);
      doc.setFillColor(...P); doc.circle(M + 3, y - 1.2, 3, "F");
      fuente("bold", 8.5, sobreColor); doc.text(String(i + 1), M + 3, y + 0.15, { align: "center" });
      fuente("bold", 10.3, TINTA); doc.text(tit, tx, y);
      y += 4.9;
      fuente("normal", 8.9, GRIS);
      det.forEach((l) => { doc.text(l, tx, y); y += altoLinea(8.9); });
      y += 3.6;
    });
    y += 1;
  }

  // Cómo lo haremos
  {
    const pasos = proceso(p);
    const n = pasos.length, col = W / n;
    const altos = pasos.map((s) => { fuente("normal", 7.8, GRIS); return lineas(s.d, col - 5).length; });
    const h = 14 + Math.max(...altos) * altoLinea(7.8) + 4;
    seccion("Cómo lo haremos", h + 12);
    const cy = y + 3;
    doc.setDrawColor(...TINTE2); doc.setLineWidth(1.1);
    doc.line(M + col / 2, cy, M + col * (n - 0.5), cy);
    pasos.forEach((s, i) => {
      const cx = M + col * i + col / 2;
      doc.setFillColor(...BLANCO); doc.circle(cx, cy, 4.6, "F");
      doc.setFillColor(...P); doc.circle(cx, cy, 3.7, "F");
      fuente("bold", 8.5, sobreColor); doc.text(String(i + 1), cx, cy + 1.05, { align: "center" });
      fuente("bold", 9, TINTA); doc.text(s.t, cx, cy + 10, { align: "center" });
      fuente("normal", 7.8, GRIS);
      let yy = cy + 14;
      lineas(s.d, col - 5).forEach((l) => { doc.text(l, cx, yy, { align: "center" }); yy += altoLinea(7.8); });
    });
    y += h + 4;
  }

  // Materiales
  {
    const m = p.materiales;
    const tipo = TIPOS_PINTURA.find((x) => x.id === m.tipo)?.label || "Plástica";
    const acabado = ACABADOS.find((x) => x.id === m.acabado)?.label || "";
    const filas: [string, string][] = [
      ["Pintura", tipo + (acabado ? ", acabado " + acabado.toLowerCase() : "")],
      ["Marca", m.marca || "Primeras marcas"],
      ["Colores", cap(coloresTxt(p).replace(/^en (el |los )?/, ""))],
      ["Manos", (m.manos || 2) + " manos de acabado"],
      ["Imprimación", m.imprimacion ? "Sí, selladora antes de pintar" : "No necesaria"],
      ["Material", m.material_incluido ? "Incluido en el precio" : "Lo aporta el cliente"],
    ];
    const g = 6, cw = (W - g) / 2, pad = 5;
    const filasH = Math.ceil(filas.length / 2);
    const altoFila = (txt: string) => Math.max(1, lineas(txt, cw - 34 - pad).length) * 4.2 + 3.2;
    let h = 8;
    for (let r = 0; r < filasH; r++) h += Math.max(altoFila(filas[r * 2]?.[1] || ""), altoFila(filas[r * 2 + 1]?.[1] || ""));
    seccion("Materiales", h + 14);
    tarjeta(M, y, W, h, TINTE, null);
    let yy = y + 7.5;
    for (let r = 0; r < filasH; r++) {
      let alto = 0;
      [0, 1].forEach((c) => {
        const f = filas[r * 2 + c];
        if (!f) return;
        const x = M + pad + c * (cw + g);
        fuente("bold", 7.2, P); doc.text(f[0].toUpperCase(), x, yy, { charSpace: 0.4 });
        fuente("normal", 9, TINTA);
        const ls = lineas(f[1], cw - 34 - pad);
        ls.forEach((l, k) => doc.text(l, x + 28, yy + k * 4.2));
        alto = Math.max(alto, altoFila(f[1]));
      });
      yy += alto;
    }
    y += h + 7;
  }

  // Desglose económico
  if (p.partidas.length) {
    seccion("Desglose económico", 40);
    const cC = M + 4, cCant = M + W * 0.6, cPre = M + W * 0.79, cImp = PW - M - 4;
    const cabTabla = () => {
      doc.setFillColor(...P); doc.roundedRect(M, y, W, 9, 1.8, 1.8, "F");
      fuente("bold", 7.6, sobreColor);
      doc.text("CONCEPTO", cC, y + 5.9, { charSpace: 0.4 });
      doc.text("CANTIDAD", cCant, y + 5.9, { align: "right", charSpace: 0.4 });
      doc.text("PRECIO UD.", cPre, y + 5.9, { align: "right", charSpace: 0.4 });
      doc.text("IMPORTE", cImp, y + 5.9, { align: "right", charSpace: 0.4 });
      y += 9;
    };
    const nFilasTot = (t.descuento > 0 ? 2 : 0) + 2;
    const altoTotales = nFilasTot * 6.6 + 4 + 16 + 6;
    cabTabla();
    p.partidas.forEach((x, i) => {
      const tit = lineas(tituloPartida(x), W * 0.6 - 30);
      const h = Math.max(8.6, tit.length * 4.3 + 4.4);
      // la última fila nunca se queda sola: va a la misma página que los totales
      const ultima = i === p.partidas.length - 1;
      if (y + h + (ultima ? altoTotales : 0) > LIMITE) { nuevaPagina(); cabTabla(); }
      if (i % 2 === 1) { doc.setFillColor(...TINTE); doc.rect(M, y, W, h, "F"); }
      fuente("normal", 9.2, TINTA);
      tit.forEach((l, k) => doc.text(l, cC, y + 5.6 + k * 4.3));
      const global = x.unidad === "global";
      fuente("normal", 9, GRIS);
      doc.text(global ? "1" : cifra(x.cantidad) + " " + x.unidad, cCant, y + 5.6, { align: "right" });
      doc.text(global ? "Partida" : euros(x.precio) + "/" + x.unidad, cPre, y + 5.6, { align: "right" });
      fuente("bold", 9.2, TINTA);
      doc.text(euros((Number(x.cantidad) || 0) * (Number(x.precio) || 0)), cImp, y + 5.6, { align: "right" });
      y += h;
      doc.setDrawColor(...LINEA); doc.setLineWidth(0.2); doc.line(M, y, PW - M, y);
    });

    // Totales
    const filas: [string, string][] = [];
    if (t.descuento > 0) {
      filas.push(["Subtotal", euros(t.bruto)]);
      filas.push(["Descuento (" + cifra(p.descuento_pct) + " %)", "-" + euros(t.descuento)]);
    }
    filas.push(["Base imponible", euros(t.base)]);
    filas.push(p.iva_pct ? ["IVA (" + cifra(p.iva_pct) + " %)", euros(t.iva)] : ["IVA", "No incluido"]);
    const tw = 84, tx = PW - M - tw;
    const h = filas.length * 6.6 + 4 + 16;
    asegurar(h + 6);
    y += 5;
    filas.forEach(([k, v]) => {
      fuente("normal", 9.4, GRIS); doc.text(k, tx + 4, y + 3);
      fuente("bold", 9.4, TINTA); doc.text(v, PW - M - 4, y + 3, { align: "right" });
      y += 6.6;
    });
    y += 1.5;
    sombra(tx, y, tw, 15, 2.6);
    degradado(tx, y, tw, 15, OSC, P, 40);
    doc.setDrawColor(...BLANCO); doc.setLineWidth(1.2); doc.roundedRect(tx - 0.6, y - 0.6, tw + 1.2, 16.2, 3.2, 3.2, "S");
    fuente("bold", 8.2, sobreColor); doc.text(p.iva_pct ? "TOTAL (IVA INCLUIDO)" : "TOTAL (SIN IVA)", tx + 5, y + 9.4, { charSpace: 0.3 });
    fuente("bold", 15, sobreColor); doc.text(euros(t.total), PW - M - 5, y + 9.9, { align: "right" });

    // Nota a la izquierda de los totales
    fuente("italic", 8.3, GRIS_L);
    const nota = lineas(p.materiales.material_incluido
      ? "Incluye materiales y mano de obra completa para los trabajos descritos."
      : "Incluye la mano de obra completa para los trabajos descritos.", W - tw - 10);
    nota.forEach((l, k) => doc.text(l, M, y + 6 + k * 4));
    y += 15 + 9;
  }

  // Plazo y forma de pago
  {
    const g = 6, cw = (W - g) / 2, pad = 5.5;
    const tramos = tramosPago(p, t.total);
    const otro = p.pago === "otro" || !FORMAS_PAGO.some((f) => f.id === p.pago);
    const otroL = otro ? lineas(p.pago_txt || "A convenir con el cliente", cw - pad * 2) : [];
    const metodos = METODOS_PAGO.filter((x) => p.metodos.includes(x.id)).map((x) => (x.id === "bizum" ? x.label : x.label.toLowerCase()));
    const metTxt = metodos.length ? "Mediante " + (metodos.length === 1 ? metodos[0] : metodos.slice(0, -1).join(", ") + " o " + metodos[metodos.length - 1]) + "." : "";
    const inicioL = lineas("Inicio: " + (p.inicio || "a convenir"), cw - pad * 2);
    const hIzq = 12 + 8 + inicioL.length * 4.3 + 9;
    const hDer = 12 + (otro ? otroL.length * 4.4 : tramos.length * 6) + (metTxt ? 7 : 2);
    const h = Math.max(hIzq, hDer, 32);
    seccion("Plazo y forma de pago", h + 14);
    // plazo
    tarjeta(M, y, cw, h);
    etiqueta("Plazo de ejecución", M + pad, y + 7.2);
    fuente("bold", 15, TINTA); doc.text(plazoTxt(p) || "A convenir", M + pad, y + 16);
    let yy = y + 22.5;
    fuente("normal", 8.8, GRIS); inicioL.forEach((l) => { doc.text(l, M + pad, yy); yy += 4.3; });
    fuente("italic", 8.3, GRIS_L); doc.text("Con planificación y ejecución profesional.", M + pad, yy + 0.6);
    // pago
    const x2 = M + cw + g;
    tarjeta(x2, y, cw, h);
    etiqueta("Forma de pago", x2 + pad, y + 7.2);
    yy = y + 13.6;
    if (otro) {
      fuente("normal", 9, TINTA); otroL.forEach((l) => { doc.text(l, x2 + pad, yy); yy += 4.4; });
    } else {
      tramos.forEach((tr) => {
        doc.setFillColor(...TINTE2); doc.roundedRect(x2 + pad, yy - 3.6, 11.5, 5, 1.2, 1.2, "F");
        fuente("bold", 8, P); doc.text(tr.pct + " %", x2 + pad + 5.75, yy, { align: "center" });
        fuente("normal", 8.6, TINTA); doc.text(cap(tr.txt.split(",")[0]), x2 + pad + 14, yy);
        fuente("bold", 8.6, TINTA); doc.text(euros(tr.importe), x2 + cw - pad, yy, { align: "right" });
        yy += 6;
      });
    }
    if (metTxt) { fuente("italic", 8.3, GRIS_L); doc.text(lineas(metTxt, cw - pad * 2)[0], x2 + pad, yy + 1); }
    y += h + 7;
  }

  // Incluye / no incluye
  {
    const si = incluye(p), no = p.no_incluye;
    const g = 6, cw = (W - g) / 2, ancho = cw - 8;
    fuente("normal", 8.8, TINTA);
    const altoLista = (arr: string[]) => arr.reduce((s, x) => s + lineas(x, ancho).length * 4.2 + 2.2, 0);
    const h = Math.max(altoLista(si), altoLista(no)) + 10;
    seccion("Qué incluye", Math.min(h + 12, 80));
    const pintar = (x: number, tit: string, arr: string[], ok: boolean) => {
      let yy = y;
      etiqueta(tit, x, yy, ok ? P : GRIS);
      yy += 6.5;
      arr.forEach((s) => {
        const ls = lineas(s, ancho);
        if (yy + ls.length * 4.2 > LIMITE) return;
        check(x + 1.8, yy - 1.1, ok);
        fuente("normal", 8.8, ok ? TINTA : GRIS);
        ls.forEach((l, k) => doc.text(l, x + 6, yy + k * 4.2));
        yy += ls.length * 4.2 + 2.2;
      });
      return yy;
    };
    const a = pintar(M, "Incluido", si, true);
    const b = no.length ? pintar(M + cw + g, "No incluido", no, false) : y;
    y = Math.max(a, b) + 4;
  }

  // Garantía y condiciones
  {
    const cond: string[] = [];
    if (p.garantia) cond.push("Garantía de " + p.garantia + " sobre los trabajos realizados, desde la fecha de finalización.");
    cond.push("Presupuesto válido durante " + (p.validez_dias || 30) + " días, hasta el " + fechaCorta(validoHasta) + ".");
    cond.push("Las mediciones se han tomado en la visita. Si la medición real cambia, el importe se ajustará a la medición real.");
    cond.push("Cualquier trabajo no incluido en este presupuesto se valorará aparte y por escrito antes de hacerlo.");
    fuente("normal", 8.7, GRIS);
    const h = cond.reduce((s, c) => s + lineas(c, W - 6).length * 4.1 + 1.6, 0);
    seccion("Garantía y condiciones", h + 14);
    cond.forEach((c) => {
      const ls = lineas(c, W - 6);
      asegurar(ls.length * 4.1 + 2);
      doc.setFillColor(...P); doc.circle(M + 1.2, y - 1.15, 0.75, "F");
      fuente("normal", 8.7, GRIS);
      ls.forEach((l) => { doc.text(l, M + 5, y); y += 4.1; });
      y += 1.6;
    });
    y += 2;
  }

  // Notas del profesional
  if (p.notas.trim()) {
    fuente("normal", 9, TINTA);
    const ls = lineas(p.notas.trim(), W - 14);
    const h = ls.length * 4.4 + 13;
    asegurar(h + 4);
    tarjeta(M, y, W, h, TINTE, null);
    doc.setFillColor(...P); doc.roundedRect(M, y, 1.4, h, 0.6, 0.6, "F");
    etiqueta("Notas", M + 7, y + 7);
    fuente("normal", 9, TINTA);
    ls.forEach((l, k) => doc.text(l, M + 7, y + 12.6 + k * 4.4));
    y += h + 7;
  }

  // Aceptación
  {
    const h = 34;
    asegurar(h + 16);
    seccion("Aceptación del presupuesto", h + 12);
    fuente("normal", 8.7, GRIS);
    doc.text("Para aceptarlo, fírmelo abajo o confírmelo por WhatsApp o por correo.", M, y - 0.5);
    y += 4;
    const g = 6, cw = (W - g) / 2;
    [[M, "Conforme, el cliente", p.cliente.nombre], [M + cw + g, "El profesional", nombre]].forEach(([x, tit, quien]) => {
      const xx = Number(x);
      tarjeta(xx, y, cw, h - 6);
      etiqueta(String(tit), xx + 5, y + 7);
      fuente("normal", 8.8, TINTA); doc.text(String(quien || ""), xx + 5, y + 12.5);
      doc.setDrawColor(...LINEA); doc.setLineWidth(0.3);
      doc.line(xx + 5, y + 22, xx + cw - 5, y + 22);
      fuente("normal", 7.4, GRIS_L); doc.text("Firma y fecha", xx + 5, y + 25.4);
    });
    y += h;
  }

  // ── Pie en todas las páginas (con el sello de OficioYa) ──
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.3); doc.line(M, 281, PW - M, 281);
    fuente("normal", 7.6, GRIS);
    const pie = [nombre, marca.telefono, marca.email].filter(Boolean).join("  ·  ");
    doc.text(lineas(pie, W * 0.78)[0], M, 285.6);
    doc.text("Página " + i + " de " + n, PW - M, 285.6, { align: "right" });

    // Sello OficioYa: discreto, centrado
    fuente("normal", 7, GRIS_L);
    const a = "Profesional verificado en ", b1 = "Oficio", b2 = "Ya", c = "  ·  aficioya.com";
    const wa = doc.getTextWidth(a);
    doc.setFont("helvetica", "bold"); const wb1 = doc.getTextWidth(b1), wb2 = doc.getTextWidth(b2);
    doc.setFont("helvetica", "normal"); const wc = doc.getTextWidth(c);
    const icono = 3.2, total = icono + 1.6 + wa + wb1 + wb2 + wc;
    let sx = PW / 2 - total / 2;
    const sy = 291.2;
    doc.setFillColor(...NARANJA); doc.roundedRect(sx, sy - 2.55, icono, icono, 0.8, 0.8, "F");
    doc.setDrawColor(...BLANCO); doc.setLineWidth(0.38);
    doc.line(sx + 0.8, sy - 0.95, sx + 1.4, sy - 0.35); doc.line(sx + 1.4, sy - 0.35, sx + 2.45, sy - 1.75);
    sx += icono + 1.6;
    fuente("normal", 7, GRIS_L); doc.text(a, sx, sy); sx += wa;
    fuente("bold", 7, [70, 76, 90]); doc.text(b1, sx, sy); sx += wb1;
    fuente("bold", 7, NARANJA); doc.text(b2, sx, sy); sx += wb2;
    fuente("normal", 7, GRIS_L); doc.text(c, sx, sy);
  }

  return doc;
}

export function nombreArchivo(p: Presupuesto, marca: Marca) {
  const limpio = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return ["Presupuesto", limpio(p.numero), limpio(p.cliente.nombre)].filter(Boolean).join("_") + ".pdf"
    || "Presupuesto_" + limpio(marca.nombre) + ".pdf";
}

export async function generarPresupuestoPdf(p: Presupuesto, marca: Marca): Promise<{ blob: Blob; nombre: string }> {
  const [JsPDF, logo] = await Promise.all([cargarJsPDF(), prepararLogo(marca.logo_url)]);
  const doc = dibujarPresupuesto(JsPDF, p, marca, logo);
  return { blob: doc.output("blob"), nombre: nombreArchivo(p, marca) };
}
