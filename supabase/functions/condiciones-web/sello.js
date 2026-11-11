// ============================================================
// OficioYa · sello de tiempo RFC 3161 (lo usa la Edge Function condiciones-web)
// Se pide el sello sobre una huella SHA-256 a una autoridad de sellado (DigiCert y, si falla, Sectigo),
// igual que en la firma electrónica de contratos. Se guarda la respuesta entera (token en base64), que
// se puede comprobar con: openssl ts -reply -in sello-de-tiempo.tsr -text
// Sin dependencias: JavaScript puro para poder probarlo fuera de Deno.
// ============================================================

export const AUTORIDADES = ["http://timestamp.digicert.com", "http://timestamp.sectigo.com"];

// ── DER mínimo ──
function largo(n) {
  if (n < 0x80) return [n];
  if (n < 0x100) return [0x81, n];
  if (n < 0x10000) return [0x82, n >> 8, n & 0xff];
  return [0x83, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
function tlv(tag, bytes) {
  return [tag, ...largo(bytes.length), ...bytes];
}
const SHA256_ALG = [0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00];

/** Petición TimeStampReq (v1, SHA-256, nonce de 8 bytes, con el certificado de la autoridad) */
export function peticionSello(huella, nonce) {
  if (!(huella instanceof Uint8Array) || huella.length !== 32) throw new Error("La huella tiene que ser SHA-256 (32 bytes)");
  const n = Uint8Array.from(nonce && nonce.length === 8 ? nonce : crypto.getRandomValues(new Uint8Array(8)));
  n[0] = (n[0] & 0x7f) | 0x01; // entero positivo y en su forma mínima
  const imprint = tlv(0x30, [...SHA256_ALG, ...tlv(0x04, [...huella])]);
  const cuerpo = [...tlv(0x02, [0x01]), ...imprint, ...tlv(0x02, [...n]), 0x01, 0x01, 0xff];
  return { der: Uint8Array.from(tlv(0x30, cuerpo)), nonce: n };
}

// Lee un TLV en la posición i: { tag, ini (contenido), fin }
function leer(b, i) {
  const tag = b[i];
  let l = b[i + 1];
  let p = i + 2;
  if (l & 0x80) {
    const k = l & 0x7f;
    if (k < 1 || k > 4) throw new Error("Longitud DER no válida");
    l = 0;
    for (let j = 0; j < k; j++) l = l * 256 + b[p + j];
    p += k;
  }
  if (p + l > b.length) throw new Error("Respuesta del sello cortada");
  return { tag, ini: p, fin: p + l };
}

function buscar(b, aguja) {
  outer: for (let i = 0; i + aguja.length <= b.length; i++) {
    for (let j = 0; j < aguja.length; j++) if (b[i + j] !== aguja[j]) continue outer;
    return i;
  }
  return -1;
}

const ESTADOS = { 0: "concedido", 1: "concedido con cambios", 2: "rechazado", 3: "en espera", 4: "revocación avisada", 5: "revocado" };

/**
 * Lee la respuesta TimeStampResp. Comprueba que está concedida, que sella NUESTRA huella y nuestro nonce,
 * y saca la fecha (genTime) del TSTInfo. Devuelve { fecha: "2026-11-11T14:02:09Z", token: <bytes de la respuesta> }.
 */
export function leerRespuestaSello(bytes, huella, nonce) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 20 || b[0] !== 0x30) throw new Error("La autoridad no ha devuelto un sello");
  const raiz = leer(b, 0);
  const info = leer(b, raiz.ini);                 // PKIStatusInfo
  if (info.tag !== 0x30) throw new Error("Sello sin estado");
  const est = leer(b, info.ini);                  // status INTEGER
  if (est.tag !== 0x02) throw new Error("Sello sin estado");
  let estado = 0;
  for (let i = est.ini; i < est.fin; i++) estado = estado * 256 + b[i];
  if (estado !== 0 && estado !== 1) throw new Error("La autoridad ha rechazado el sello (" + (ESTADOS[estado] || estado) + ")");
  if (info.fin >= raiz.fin) throw new Error("La respuesta no trae el sello");
  const token = b.subarray(info.fin, raiz.fin);   // timeStampToken (ContentInfo con el TSTInfo firmado)
  if (buscar(token, [0x04, 0x20, ...huella]) < 0) throw new Error("El sello no corresponde a esta huella");
  if (nonce && buscar(token, [0x02, nonce.length, ...nonce]) < 0) throw new Error("El sello no corresponde a esta petición");
  // genTime: el primer GeneralizedTime del token es el del TSTInfo (va antes que los certificados y la firma)
  let fecha = null;
  for (let i = 0; i < token.length - 17 && !fecha; i++) {
    if (token[i] !== 0x18) continue;
    const l = token[i + 1];
    if (l < 15 || l > 24) continue;
    const s = String.fromCharCode(...token.subarray(i + 2, i + 2 + l));
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/.exec(s);
    if (m) fecha = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  }
  if (!fecha) throw new Error("El sello no trae la fecha");
  return { fecha, estado: ESTADOS[estado], token: b };
}

/** Pide el sello a la primera autoridad que responda. Devuelve { tsa, fecha, token (Uint8Array) } */
export async function sellar(huella, opciones = {}) {
  const fetchFn = opciones.fetch || fetch;
  const autoridades = opciones.autoridades || AUTORIDADES;
  const errores = [];
  for (const tsa of autoridades) {
    try {
      const { der, nonce } = peticionSello(huella);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), opciones.timeoutMs || 15000);
      let r;
      try {
        r = await fetchFn(tsa, { method: "POST", headers: { "Content-Type": "application/timestamp-query" }, body: der, signal: ctrl.signal });
      } finally {
        clearTimeout(t);
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const out = leerRespuestaSello(new Uint8Array(await r.arrayBuffer()), huella, nonce);
      return { tsa, fecha: out.fecha, token: out.token };
    } catch (e) {
      errores.push(tsa.replace(/^https?:\/\//, "") + ": " + ((e && e.message) || String(e)));
    }
  }
  throw new Error("No se pudo sellar: " + errores.join(" · "));
}
