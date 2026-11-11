// ============================================================
// OficioYa · condiciones-web (11/11/2026)
// Cuando un profesional acepta las condiciones de su web (15 € + IVA por cliente que le llegue por ella):
//  1. Comprueba que el registro guardado cuadra con su huella (no se ha tocado nada).
//  2. Pide un sello de tiempo RFC 3161 sobre esa huella (DigiCert; si falla, Sectigo).
//  3. Genera el PDF justificante (datos, cómo y cuándo, huellas, sello y el texto íntegro, con el texto,
//     el registro y el sello adjuntos dentro del PDF) y lo guarda en Admin → Archivos:
//     Profesionales/<Nombre · Empresa>/Contratos.
//  4. Le manda una copia al profesional por email.
// La llama la base de datos al aceptar (oy_condiciones_web_archivar) y el cron cada 10 minutos si algo falló.
// Acceso: solo con la clave interna de oy_secretos ('condiciones_web').
// Acciones: «archivar» {id} · «prueba» (sello + PDF de ejemplo, sin guardar nada: para comprobar que todo va).
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import * as PDFLib from "npm:pdf-lib@1.17.1";
import { construirJustificante, madrid, eur } from "./justificante.js";
import { sellar } from "./sello.js";

// Llave de servidor (09/11/2026): la llave secreta nueva del proyecto; la antigua (service_role) solo si no existe.
const OY_LLAVE_SERVIDOR: string = (() => { try { const j = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); return String(j["default"] || Object.values(j)[0] || ""); } catch { return ""; } })() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, OY_LLAVE_SERVIDOR, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const BUCKET = "archivos";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const esUuid = (s: unknown) =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const mensaje = (e: unknown) => ((e as { message?: string })?.message || String(e)).slice(0, 400);
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (bytes: Uint8Array) => hex(await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource));
const deHex = (h: string) => Uint8Array.from((h.match(/../g) || []).map((x) => parseInt(x, 16)));
function aBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function deBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function iguales(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function ruta(id: string) {
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${id}.pdf`;
}
// La hora exacta que lleva el registro (la misma que se firmó con la huella)
const utcDelRegistro = (registro: string) => (/^aceptado_utc=(.+)$/m.exec(registro || "")?.[1] || "").trim();

async function claveOk(clave: unknown) {
  const { data } = await sb.from("oy_secretos").select("valor").eq("clave", "condiciones_web").maybeSingle();
  return !!data?.valor && typeof clave === "string" && iguales(clave, String(data.valor));
}

// Sube el PDF y lo deja visible en Archivos. null = otra llamada ya lo había guardado (mismo ref).
async function subir(o: {
  ref: string; carpeta: string; nombre: string; bytes: Uint8Array; sha: string; fecha_doc: string; notas: string; pro_id: string;
}): Promise<{ id: string; storage_path: string } | null> {
  const id = crypto.randomUUID();
  const path = ruta(id);
  const up = await sb.storage.from(BUCKET).upload(path, o.bytes, { contentType: "application/pdf", upsert: false });
  if (up.error) throw up.error;
  const { error } = await sb.from("archivos").insert({
    id, ref: o.ref, carpeta: o.carpeta, nombre: o.nombre, storage_path: path, mime: "application/pdf",
    tamano: o.bytes.length, sha256: o.sha, tipo: "contrato", fecha_doc: o.fecha_doc, notas: o.notas,
    pro_id: o.pro_id, estado: "subiendo", origen: "sistema", subido_por: "sistema",
  });
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);
    if ((error as { code?: string }).code === "23505") return null;
    throw error;
  }
  const { error: e2 } = await sb.rpc("archivos_confirmar_interno", { p_id: id, p_sha256: o.sha });
  if (e2) throw e2;
  return { id, storage_path: path };
}

async function marcar(id: string, cambios: Record<string, unknown>, soloSinArchivo = false) {
  let q = sb.from("pro_condiciones_aceptaciones").update(cambios).eq("id", id);
  if (soloSinArchivo) q = q.is("archivo_id", null);
  const { error } = await q;
  if (error) console.error("marcar", id, error);
}

async function mandarEmail(d: any, pdf: Uint8Array) {
  const a = d.aceptacion;
  const c = madrid(a.aceptado_at);
  const precio = Number(a.precio);
  const precioIva = Math.round(precio * (1 + Number(a.iva_pct ?? 21) / 100) * 100) / 100;
  const nombre1 = String(d.nombre || "").trim().split(/\s+/)[0] || "";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "OficioYa <noreply@algoracompound.com>",
      to: d.email,
      reply_to: "admin@algoracompound.com",
      subject: "Has aceptado las condiciones de tu web en OficioYa",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0F1117;color:#E8EDF5;padding:32px;border-radius:16px">
          <h2 style="color:#FFD700;margin:0 0 16px">OficioYa</h2>
          <p>Hola${nombre1 ? " <strong>" + esc(nombre1) + "</strong>" : ""},</p>
          <p>El ${esc(c.fecha)} a las ${esc(c.hora.slice(0, 5))} aceptaste en la app las <strong>condiciones de tu web</strong>.</p>
          <p style="background:#1A1C24;border:1px solid #2A2D36;border-radius:12px;padding:14px 16px;line-height:1.5">
            Cada cliente que te llegue por tu web cuesta <strong>${esc(eur(precio))} + IVA</strong> (${esc(eur(precioIva))} con IVA).
            Los clientes de nuestras campañas siguen con el precio de tu contrato.
          </p>
          <p>Te adjuntamos el justificante con el texto completo que aceptaste. También lo puedes leer en la app, en
            <strong>Perfil › Contrato y condiciones</strong>.</p>
          <p style="color:#8A93A6;font-size:13px">Si no has sido tú, escríbenos cuanto antes a
            <a href="mailto:admin@algoracompound.com" style="color:#FFD700">admin@algoracompound.com</a> o al WhatsApp 656 398 014.</p>
        </div>`,
      attachments: [{ filename: `Condiciones-de-tu-web-OficioYa-${c.nombre.slice(0, 10)}.pdf`, content: aBase64(pdf) }],
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Resend " + r.status + ": " + JSON.stringify(out).slice(0, 200));
  return (out as { id?: string }).id || null;
}

// deno-lint-ignore no-explicit-any
async function archivar(id: string): Promise<any> {
  const { data: d, error } = await sb.rpc("oy_condiciones_web_archivo", { p_id: id });
  if (error) throw error;
  if (!d) return { ok: false, motivo: "no existe" };
  const a = d.aceptacion;
  const enc = new TextEncoder();

  // 1) Nada se ha tocado: la huella del registro y la del texto tienen que cuadrar
  if ((await sha256(enc.encode(d.registro))) !== a.hash) throw new Error("La huella del registro no cuadra con lo guardado");
  const hTexto = await sha256(enc.encode(d.modelo.texto));
  if (hTexto !== a.texto_sha256 || hTexto !== d.modelo.sha256) throw new Error("La huella del texto no cuadra con lo guardado");

  let pdf: Uint8Array | null = null;
  let archivo: { id: string; storage_path: string } | null = d.archivo ? { id: d.archivo.id, storage_path: d.archivo.storage_path } : null;
  const hecho: Record<string, unknown> = {};

  if (!a.archivo_id) {
    // 2) Sello de tiempo sobre la huella del registro
    // deno-lint-ignore no-explicit-any
    let sello: any = null;
    let selloError: string | null = null;
    if (a.sello?.token) sello = { ...a.sello, token: deBase64(a.sello.token) };
    else {
      try {
        const s = await sellar(deHex(a.hash));
        sello = { tsa: s.tsa, hash: a.hash, fecha: s.fecha, token: s.token };
      } catch (e) {
        selloError = mensaje(e);
        console.error("sello", id, selloError);
      }
    }

    // 3) PDF y Archivos
    const doc: Uint8Array = await construirJustificante({ ...d, sello, selloError, aceptado_utc: utcDelRegistro(d.registro) || a.aceptado_at },
      { generado: new Date() }, PDFLib);
    pdf = doc;
    const sha = await sha256(doc);
    const c = madrid(a.aceptado_at);
    const notas = `Aceptación en la app (${String(a.origen || "perfil").replace(/_/g, " ")}) de las condiciones de su web, versión ${a.version}: ` +
      `${eur(Number(a.precio))} + IVA por cada cliente que le llegue por su web. Fecha y hora del servidor: ${c.fecha} ${c.hora} (Madrid). ` +
      `IP ${a.ip || "—"}. Huella del registro (SHA-256): ${a.hash}.` +
      (sello ? ` Sello de tiempo ${String(sello.tsa).replace(/^https?:\/\//, "")}: ${sello.fecha}.` : " Sin sello de tiempo.") +
      " Dentro del PDF van el texto exacto, el registro y el sello.";
    archivo = await subir({
      ref: "condiciones:" + a.id, carpeta: d.carpeta, nombre: `Condiciones de la web · aceptadas el ${c.nombre}.pdf`,
      bytes: doc, sha, fecha_doc: c.dia, notas, pro_id: a.pro_id,
    });
    if (!archivo) {
      // Otra llamada lo guardó a la vez: se usa ese
      const { data: ex } = await sb.from("archivos").select("id,storage_path").eq("ref", "condiciones:" + a.id).maybeSingle();
      archivo = ex ? { id: ex.id, storage_path: ex.storage_path } : null;
      pdf = null;
      hecho.archivo = "ya estaba";
    } else {
      await marcar(a.id, {
        archivo_id: archivo.id, pdf_sha256: sha, archivo_at: new Date().toISOString(),
        sello: sello ? { tsa: sello.tsa, hash: a.hash, fecha: sello.fecha, token: aBase64(sello.token) } : null,
        archivo_error: selloError ? "Guardado sin sello de tiempo: " + selloError : null,
      }, true);
      hecho.archivo = "guardado";
      hecho.carpeta = d.carpeta;
      hecho.sello = sello ? sello.fecha : null;
    }
  }

  // 4) Copia por email al profesional
  if (!a.email_enviado_at) {
    if (!d.email) {
      await marcar(a.id, { email_error: "Su cuenta no tiene un email válido", email_intentos: 99 });
      hecho.email = "sin email";
    } else if (!RESEND_KEY) {
      await marcar(a.id, { email_error: "Falta RESEND_API_KEY" });
      hecho.email = "sin clave de Resend";
    } else if (archivo) {
      try {
        if (!pdf) {
          const { data: blob, error: ed } = await sb.storage.from(BUCKET).download(archivo.storage_path);
          if (ed || !blob) throw ed || new Error("No se pudo leer el justificante");
          pdf = new Uint8Array(await blob.arrayBuffer());
        }
        await mandarEmail(d, pdf);
        await marcar(a.id, { email_enviado_at: new Date().toISOString(), email_error: null });
        hecho.email = "enviado";
      } catch (e) {
        await marcar(a.id, { email_error: mensaje(e) });
        hecho.email = "error: " + mensaje(e);
      }
    }
  }
  return { ok: true, ...hecho };
}

// Prueba sin guardar nada: sello real sobre una huella de prueba y PDF de ejemplo con el texto vigente
async function prueba() {
  const { data: m } = await sb.from("pro_condiciones_modelo").select("*").eq("tipo", "web_pro").eq("vigente", true).maybeSingle();
  if (!m) return { ok: false, motivo: "no hay condiciones vigentes" };
  const ahora = new Date();
  const registro = "OficioYa - prueba de justificante (no es una aceptacion real)\nfecha=" + ahora.toISOString();
  const hash = await sha256(new TextEncoder().encode(registro));
  // deno-lint-ignore no-explicit-any
  let sello: any = null;
  let selloError: string | null = null;
  try {
    const s = await sellar(deHex(hash));
    sello = { tsa: s.tsa, hash, fecha: s.fecha, token: s.token };
  } catch (e) {
    selloError = mensaje(e);
  }
  const d = {
    nombre: "Profesional de prueba",
    aceptacion: {
      id: "00000000-0000-4000-8000-000000000000", pro_id: "00000000-0000-4000-8000-000000000000", version: m.version,
      texto_sha256: m.sha256, precio: m.precio, iva_pct: m.iva_pct, aceptado_at: ahora.toISOString(), origen: "guia_perfil",
      ip: "0.0.0.0", user_agent: "Prueba", dispositivo: {}, sesion: {}, cuenta: { nombre: "Profesional de prueba" },
      hash, hash_anterior: null,
    },
    modelo: m, registro, sello, selloError, aceptado_utc: ahora.toISOString(),
  };
  const pdf = await construirJustificante(d, { generado: ahora }, PDFLib);
  return {
    ok: true, sello: sello ? { tsa: sello.tsa, fecha: sello.fecha, bytes: sello.token.length } : null, selloError,
    pdf_bytes: pdf.length, pdf_sha256: await sha256(pdf), pdf_base64: aBase64(pdf),
    texto_ok: (await sha256(new TextEncoder().encode(m.texto))) === m.sha256,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "cuerpo no válido" }, 400); }
  if (!(await claveOk(body?.clave))) return json({ error: "acceso denegado" }, 403);
  try {
    if (body.accion === "prueba") return json(await prueba());
    if (body.accion !== "archivar" || !esUuid(body.id)) return json({ error: "petición no válida" }, 400);
    return json(await archivar(String(body.id)));
  } catch (e) {
    const msg = mensaje(e);
    console.error("condiciones-web", body?.id, msg);
    if (esUuid(body?.id)) await marcar(String(body.id), { archivo_error: msg });
    return json({ error: msg }, 500);
  }
});
