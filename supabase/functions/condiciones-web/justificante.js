// ============================================================
// OficioYa · Justificante de aceptación de las condiciones de la web (PDF)
// Lo usa la Edge Function condiciones-web. Recibe lo que devuelve oy_condiciones_web_archivo(id)
// más el sello de tiempo. Lleva dentro (adjuntos del PDF) el texto exacto aceptado, el registro que
// se firma con la huella y el sello RFC 3161, para poder comprobarlo todo sin depender de nada más.
// pdf-lib llega como parámetro (lib) para poder probarlo fuera de Deno.
// ============================================================

const WIN_EXTRA = new Set(Array.from("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"));
const CAMBIOS = { "→": "›", "←": "‹", "✓": "Sí", "✔": "Sí", "≈": "~", "−": "-", "​": "", "✅": "" };

// Solo caracteres que Helvetica (WinAnsi) sabe escribir
export function limpio(s) {
  return Array.from(String(s ?? "").normalize("NFC")).map((ch) => {
    const c = ch.codePointAt(0);
    if (c === 9 || c === 13) return " ";
    if (c === 10) return "\n";
    if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN_EXTRA.has(ch)) return ch;
    return CAMBIOS[ch] ?? "";
  }).join("");
}

const vacio = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

export function eur(v) {
  const x = Number(v);
  if (!isFinite(x)) return "—";
  const [e, d] = Math.abs(x).toFixed(2).split(".");
  return (x < 0 ? "-" : "") + e.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d + " €";
}

/** Fecha y hora en Madrid: { fecha: "11/11/2026", hora: "15:02:07", nombre: "11-11-2026 15.02" } */
export function madrid(iso) {
  const p = {};
  for (const x of new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso))) p[x.type] = x.value;
  return {
    fecha: `${p.day}/${p.month}/${p.year}`, hora: `${p.hour}:${p.minute}:${p.second}`,
    dia: `${p.year}-${p.month}-${p.day}`, nombre: `${p.day}-${p.month}-${p.year} ${p.hour}.${p.minute}`,
  };
}

export const ORIGENES = {
  guia_perfil: "En la app de OficioYa, en Perfil, al terminar la guía del perfil",
  guia_perfil_omitida: "En la app de OficioYa, en Perfil, al salir de la guía del perfil",
  perfil: "En la app de OficioYa, en Perfil",
  mi_web: "En la app de OficioYa, en Perfil › Mi web",
  contrato: "En la app de OficioYa, en Perfil › Contrato y condiciones",
  falta: "En la app de OficioYa, en Perfil (aviso «Te falta»)",
};

const OFICIOS = { pintor: "Pintor", fontanero: "Fontanero", electricista: "Electricista" };
const cap = (s) => (vacio(s) ? "" : String(s).charAt(0).toUpperCase() + String(s).slice(1));

export async function construirJustificante(d, opts, lib) {
  const { PDFDocument, StandardFonts, rgb } = lib;
  const naranja = rgb(0xE8 / 255, 0x86 / 255, 0x2A / 255);
  const verde = rgb(0, 150 / 255, 95 / 255);
  const verdeClaro = rgb(232 / 255, 248 / 255, 240 / 255);
  const naranjaClaro = rgb(253 / 255, 244 / 255, 234 / 255);
  const negro = rgb(0.13, 0.13, 0.13);
  const gris = rgb(0.42, 0.42, 0.42);
  const grisClaro = rgb(0.85, 0.85, 0.85);

  const a = d.aceptacion || {};
  const m = d.modelo || {};
  const cu = a.cuenta || {};
  const disp = a.dispositivo || {};
  const ses = a.sesion || {};
  const sello = d.sello || null;
  const cuando = madrid(a.aceptado_at);
  const nombre = d.nombre || cu.nombre || "Profesional";
  const precio = Number(a.precio ?? m.precio);
  const ivaPct = Number(a.iva_pct ?? m.iva_pct ?? 21);
  const precioIva = Math.round(precio * (1 + ivaPct / 100) * 100) / 100;
  const generado = opts.generado instanceof Date ? opts.generado : new Date();

  const pdf = await PDFDocument.create();
  pdf.setTitle(limpio("Condiciones de la web · " + nombre + " · " + cuando.fecha));
  pdf.setAuthor("OficioYa");
  pdf.setSubject("Justificante de aceptación de las condiciones de la web del profesional");
  pdf.setKeywords(["OficioYa", "condiciones", "aceptación", String(m.version || a.version || "")]);
  pdf.setCreator("OficioYa · condiciones-web");
  pdf.setProducer("OficioYa");
  pdf.setLanguage("es-ES");
  pdf.setCreationDate(generado);
  pdf.setModificationDate(generado);
  const fR = await pdf.embedFont(StandardFonts.Helvetica);
  const fB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fM = await pdf.embedFont(StandardFonts.Courier);

  const A4 = [595.28, 841.89];
  const M = 48;
  const W = A4[0] - 2 * M;
  const LW = 158;
  let page = null;
  let y = 0;

  function envolver(texto, font, size, ancho) {
    const lineas = [];
    for (const parrafo of limpio(texto).split("\n")) {
      const palabras = parrafo.split(/ +/).filter(Boolean);
      let linea = "";
      for (const p of palabras) {
        const prueba = linea ? linea + " " + p : p;
        if (font.widthOfTextAtSize(prueba, size) <= ancho) { linea = prueba; continue; }
        if (linea) lineas.push(linea);
        let resto = p;
        while (font.widthOfTextAtSize(resto, size) > ancho && resto.length > 1) {
          let n = resto.length;
          while (n > 1 && font.widthOfTextAtSize(resto.slice(0, n), size) > ancho) n--;
          lineas.push(resto.slice(0, n));
          resto = resto.slice(n);
        }
        linea = resto;
      }
      lineas.push(linea);
    }
    return lineas.length ? lineas : [""];
  }

  function nuevaPagina() {
    page = pdf.addPage(A4);
    y = A4[1] - M;
    page.drawText("OficioYa", { x: M, y: y - 16, size: 18, font: fB, color: naranja });
    const der = "Justificante de aceptación de condiciones";
    page.drawText(der, { x: A4[0] - M - fR.widthOfTextAtSize(der, 8.5), y: y - 13, size: 8.5, font: fR, color: gris });
    y -= 25;
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 1.2, color: naranja });
    y -= 24;
  }
  function sitio(h) { if (y - h < 58) nuevaPagina(); }

  function seccion(titulo) {
    sitio(48);
    y -= 6;
    page.drawText(limpio(titulo).toUpperCase(), { x: M, y, size: 10, font: fB, color: naranja });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.5, color: grisClaro });
    y -= 13.5;
  }

  function fila(etiqueta, valor, o = {}) {
    const lista = (Array.isArray(valor) ? valor : [valor]).filter((v) => !vacio(v)).map(String);
    if (!lista.length) lista.push("—");
    const size = o.size || 10;
    const font = o.mono ? fM : o.bold ? fB : fR;
    const salto = size + 2.8;
    const lineas = [];
    for (const v of lista) lineas.push(...envolver(v, font, size, W - LW));
    const etq = envolver(etiqueta, fR, 9, LW - 10);
    const n = Math.max(lineas.length, etq.length);
    sitio(n * salto + 4);
    etq.forEach((ln, i) => page.drawText(ln, { x: M, y: y - i * salto, size: 9, font: fR, color: gris }));
    lineas.forEach((ln, i) => page.drawText(ln, { x: M + LW, y: y - i * salto, size, font, color: o.color || negro }));
    y -= n * salto + 3.8;
  }

  function caja(texto, tipo) {
    const lineas = envolver(texto, fR, 10, W - 22);
    const alto = lineas.length * 13.2 + 14;
    sitio(alto + 8);
    const top = y + 4;
    page.drawRectangle({
      x: M, y: top - alto, width: W, height: alto,
      color: tipo === "ok" ? verdeClaro : naranjaClaro, borderColor: tipo === "ok" ? verde : naranja, borderWidth: 0.6,
    });
    lineas.forEach((ln, i) => page.drawText(ln, { x: M + 11, y: top - 17 - i * 13.2, size: 10, font: fR, color: negro }));
    y = top - alto - 14;
  }

  function parrafos(texto, size = 9.5) {
    const salto = size + 3.6;
    for (const ln of envolver(texto, fR, size, W)) {
      sitio(salto + 2);
      if (ln) {
        // Los títulos de las cláusulas («1. Tu web») van en negrita
        const negrita = /^\d{1,2}\. \S/.test(ln) && ln.length < 60 || /^CONDICIONES /.test(ln);
        page.drawText(ln, { x: M, y, size, font: negrita ? fB : fR, color: negro });
      }
      y -= salto;
    }
  }

  // ---------- Portada ----------
  nuevaPagina();
  page.drawText(limpio(m.titulo ? "Condiciones de la web del profesional" : "Condiciones"), { x: M, y, size: 17, font: fB, color: negro });
  y -= 19;
  page.drawText(limpio("Versión " + (m.version || a.version) + " · justificante de aceptación"), { x: M, y, size: 10.5, font: fR, color: gris });
  y -= 22;
  caja(
    `${nombre}${cu.nif ? " (NIF " + cu.nif + ")" : ""} aceptó estas condiciones el ${cuando.fecha} a las ${cuando.hora} (hora de Madrid). ` +
    `Precio por cada cliente que le llegue por su web: ${eur(precio)} + IVA (${eur(precioIva)} con el ${String(ivaPct).replace(".", ",")} % de IVA).`,
    "ok");

  // ---------- Profesional ----------
  seccion("Profesional");
  fila("Nombre y apellidos", nombre, { bold: true });
  if (!vacio(cu.empresa) && String(cu.empresa).toLowerCase() !== String(nombre).toLowerCase()) fila("Empresa", cu.empresa);
  fila("NIF / CIF", cu.nif || "No lo tenía puesto en su perfil");
  fila("Email", cu.email);
  if (!vacio(cu.email_facturas) && String(cu.email_facturas).toLowerCase() !== String(cu.email || "").toLowerCase()) fila("Email para facturas", cu.email_facturas);
  fila("Teléfono", cu.telefono);
  fila("Oficio", OFICIOS[String(cu.oficio || "").toLowerCase()] || cap(cu.oficio));
  const ciudadTxt = cap(String(cu.ciudad || "").replace(/-/g, " "));
  const igual = (x, z) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase() ===
    String(z || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  fila("Ciudad y zona", [ciudadTxt, igual(ciudadTxt, cu.zona) ? null : cu.zona].filter((x) => !vacio(x)).join(" · "));
  if (!vacio(cu.direccion_fiscal)) fila("Dirección fiscal", cu.direccion_fiscal);
  if (!vacio(cu.web)) fila("Su web", cu.web);
  fila("Cuenta en OficioYa", a.pro_id, { mono: true, size: 8.5 });

  // ---------- Cómo y cuándo ----------
  seccion("Cómo y cuándo las aceptó");
  fila("Fecha y hora (Madrid)", `${cuando.fecha} a las ${cuando.hora}`, { bold: true });
  fila("Hora del servidor (UTC)", String(d.aceptado_utc || a.aceptado_at), { mono: true, size: 8.5 });
  fila("Dónde", ORIGENES[a.origen] || "En la app de OficioYa");
  fila("Cómo", "Con su sesión iniciada en su cuenta, marcó la casilla «He leído y acepto las condiciones de mi web» y pulsó «Aceptar».");
  if (disp.leyo_texto_completo === true) fila("Texto completo", "Abrió y desplegó el texto completo antes de aceptar.");
  if (!vacio(disp.texto_sha256_en_pantalla)) {
    fila("Texto en su pantalla", disp.texto_sha256_en_pantalla === a.texto_sha256
      ? "Coincide letra por letra con el texto guardado (misma huella SHA-256)."
      : "Huella del texto en su pantalla: " + disp.texto_sha256_en_pantalla);
  }
  fila("IP", a.ip || "No disponible");
  fila("Navegador", a.user_agent || disp.navegador || "No disponible", { size: 8.5 });
  const dispositivo = [
    disp.plataforma ? "Sistema: " + disp.plataforma : null,
    disp.pantalla ? "pantalla " + disp.pantalla : null,
    disp.idioma ? "idioma " + disp.idioma : null,
    disp.zona_horaria ? "zona horaria " + disp.zona_horaria : null,
    disp.app_instalada === true ? "app instalada en el móvil" : disp.app_instalada === false ? "desde el navegador" : null,
  ].filter(Boolean).join(" · ");
  if (dispositivo) fila("Dispositivo", dispositivo);
  if (!vacio(disp.hora_dispositivo)) fila("Hora de su dispositivo", disp.hora_dispositivo, { size: 9 });
  const sesion = [
    ses.session_id ? "Sesión " + ses.session_id : null,
    ses.auth_uid ? "usuario de acceso " + ses.auth_uid : null,
    ses.emitida_utc ? "sesión iniciada el " + ses.emitida_utc : null,
  ].filter(Boolean);
  if (sesion.length) fila("Sesión", sesion, { mono: true, size: 8 });

  // ---------- Huellas y sello ----------
  seccion("Huellas y sello de tiempo");
  fila("Versión de las condiciones", m.version || a.version);
  fila("Huella del texto (SHA-256)", a.texto_sha256, { mono: true, size: 8 });
  fila("Huella del registro (SHA-256)", a.hash, { mono: true, size: 8 });
  fila("Registro anterior (SHA-256)", a.hash_anterior || "Es la primera aceptación registrada", { mono: !!a.hash_anterior, size: a.hash_anterior ? 8 : 10 });
  if (sello && sello.fecha) {
    const s = madrid(sello.fecha);
    fila("Sello de tiempo", [
      `${s.fecha} a las ${s.hora} (hora de Madrid) · ${String(sello.tsa || "").replace(/^https?:\/\//, "")}`,
      "Sello RFC 3161 de una autoridad de sellado de tiempo independiente sobre la huella del registro.",
    ]);
  } else {
    fila("Sello de tiempo", "No se pudo obtener al generar este justificante" + (d.selloError ? " (" + d.selloError + ")" : "") + ". Valen la hora del servidor y las huellas.", { color: naranja });
  }
  const adjuntos = ["condiciones-" + (m.version || a.version) + ".txt (el texto exacto que aceptó)", "registro.txt (los datos de la huella del registro)"];
  if (sello && sello.token) adjuntos.push("sello-de-tiempo.tsr (el sello)");
  fila("Archivos dentro de este PDF", adjuntos);

  // ---------- Texto aceptado ----------
  seccion("Texto que aceptó");
  parrafos(m.texto || "");

  // ---------- Cómo comprobarlo ----------
  seccion("Cómo comprobarlo");
  parrafos(
    "1. La huella SHA-256 del archivo adjunto condiciones-" + (m.version || a.version) + ".txt tiene que ser igual a la «Huella del texto».\n" +
    "2. La huella SHA-256 del adjunto registro.txt tiene que ser igual a la «Huella del registro». El registro recoge la fecha y la hora del servidor, la IP, el navegador, el dispositivo, la sesión, los datos de la cuenta y la huella de la aceptación anterior, de modo que no se puede cambiar ninguno sin que deje de cuadrar.\n" +
    (sello && sello.token ? "3. El sello se comprueba con: openssl ts -reply -in sello-de-tiempo.tsr -text (sella la huella del registro).\n" : "") +
    "OficioYa guarda además la aceptación en su base de datos, donde no se puede modificar ni borrar.", 8.5);

  // ---------- Adjuntos ----------
  const enc = new TextEncoder();
  await pdf.attach(enc.encode(m.texto || ""), "condiciones-" + (m.version || a.version) + ".txt", {
    mimeType: "text/plain", description: "Texto exacto de las condiciones aceptadas (UTF-8)", creationDate: generado, modificationDate: generado,
  });
  await pdf.attach(enc.encode(d.registro || ""), "registro.txt", {
    mimeType: "text/plain", description: "Registro de la aceptación: su SHA-256 es la huella del registro", creationDate: generado, modificationDate: generado,
  });
  if (sello && sello.token) {
    await pdf.attach(sello.token, "sello-de-tiempo.tsr", {
      mimeType: "application/timestamp-reply", description: "Sello de tiempo RFC 3161 sobre la huella del registro", creationDate: generado, modificationDate: generado,
    });
  }

  // ---------- Pie en cada página ----------
  const g = madrid(generado.toISOString());
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    const izq = limpio("OficioYa · Andrés Algora Marín · NIF 77860535S · Calle Condes de Bustillo 5, bajo D, 41010 Sevilla · Generado el " + g.fecha + " a las " + g.hora.slice(0, 5));
    p.drawLine({ start: { x: M, y: 44 }, end: { x: A4[0] - M, y: 44 }, thickness: 0.5, color: grisClaro });
    p.drawText(izq, { x: M, y: 32, size: 7, font: fR, color: gris });
    const der = "Página " + (i + 1) + " de " + paginas.length;
    p.drawText(der, { x: A4[0] - M - fR.widthOfTextAtSize(der, 7), y: 32, size: 7, font: fR, color: gris });
  });

  return await pdf.save({ useObjectStreams: false });
}
