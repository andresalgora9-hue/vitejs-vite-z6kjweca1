// ============================================================
// OficioYa · Archivos del admin (almacén privado «archivos»)
// - subir:     crea la ficha y devuelve un enlace firmado para subir el archivo
// - confirmar: comprueba que el archivo llegó y lo deja visible en el panel
// - cancelar:  quita una subida que falló
// - urls:      enlaces temporales (1 h) para ver o descargar
// - borrar:    borra para siempre lo que está en la papelera
// Acceso: clave de admin del CRM (la misma que usa el panel) o un pase temporal
// de archivos_tokens (solo el hash), que es lo que usa Claude para subir lo que
// Andrés le pasa por el chat.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const BUCKET = "archivos";
const MAX_BYTES = 50 * 1024 * 1024;
const TIPOS = ["contrato", "factura_emitida", "factura_recibida", "ticket", "impuesto", "banco", "legal", "otro"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esUuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const limpiarRuta = (p: unknown) =>
  String(p ?? "").replace(/\\/g, "/").split("/")
    .map((s) => s.trim().replace(/\s+/g, " ").slice(0, 80))
    .filter((s) => s && s !== "." && s !== "..").join("/");
const limpiarNombre = (n: unknown) => {
  const s = String(n ?? "").replace(/[\/\\]+/g, "-").replace(/[\u0000-\u001f]/g, "").trim();
  if (s.length <= 200) return s;
  const m = s.match(/(\.[A-Za-z0-9]{1,6})$/);
  return m ? s.slice(0, 200 - m[1].length) + m[1] : s.slice(0, 200);
};
const extension = (n: string) => {
  const m = n.match(/\.([A-Za-z0-9]{1,6})$/);
  return m ? "." + m[1].toLowerCase() : "";
};
const fechaOk = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;

async function sha256Hex(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ¿Quién llama? admin (clave del CRM) o un pase temporal
async function quienEs(body: any): Promise<string | null> {
  if (body?.clave) {
    const { data } = await sb.rpc("captacion_rol", { p_clave: String(body.clave) });
    if (data === "admin") return "admin";
  }
  if (body?.token && String(body.token).length >= 24) {
    const h = await sha256Hex(String(body.token));
    const { data } = await sb.from("archivos_tokens").select("token_hash, expira_at, usos, creado_por").eq("token_hash", h).maybeSingle();
    if (data && new Date(data.expira_at).getTime() > Date.now()) {
      await sb.from("archivos_tokens").update({ usos: (data.usos || 0) + 1 }).eq("token_hash", h);
      return data.creado_por || "claude";
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "cuerpo no válido" }, 400); }

  try {
    const quien = await quienEs(body);
    if (!quien) return json({ error: "acceso denegado: falta la clave de admin (entra una vez en Captación desde este dispositivo)" }, 403);
    const accion = String(body.accion || "");

    if (accion === "subir") {
      const nombre = limpiarNombre(body.nombre);
      if (!nombre) return json({ error: "Falta el nombre del archivo" }, 400);
      const tamano = Number(body.tamano) || null;
      if (tamano && tamano > MAX_BYTES) return json({ error: "El archivo pesa más de 50 MB" }, 400);
      const tipo = TIPOS.includes(body.tipo) ? body.tipo : "otro";
      const mini = typeof body.miniatura === "string" && body.miniatura.startsWith("data:image/") && body.miniatura.length <= 120000
        ? body.miniatura : null;
      const id = crypto.randomUUID();
      const d = new Date();
      const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${id}${extension(nombre)}`;
      const { error } = await sb.from("archivos").insert({
        id, carpeta: limpiarRuta(body.carpeta), nombre, storage_path: path,
        mime: String(body.mime || "").slice(0, 120) || null, tamano, tipo,
        fecha_doc: fechaOk(body.fecha_doc), notas: body.notas ? String(body.notas).slice(0, 4000) : null,
        pro_id: esUuid(body.pro_id) ? body.pro_id : null, miniatura: mini,
        estado: "subiendo", origen: quien === "admin" ? "panel" : "claude", subido_por: quien,
      });
      if (error) throw error;
      const { data: s, error: e2 } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
      if (e2 || !s) {
        await sb.from("archivos").delete().eq("id", id);
        throw e2 || new Error("No se ha podido preparar la subida");
      }
      return json({ id, path, token: s.token, signedUrl: s.signedUrl });
    }

    if (accion === "confirmar") {
      if (!esUuid(body.id)) return json({ error: "id no válido" }, 400);
      const { data, error } = await sb.rpc("archivos_confirmar_interno", { p_id: body.id, p_sha256: body.sha256 ? String(body.sha256) : null });
      if (error) throw error;
      return json({ ok: true, archivo: data });
    }

    if (accion === "cancelar") {
      if (!esUuid(body.id)) return json({ error: "id no válido" }, 400);
      const { data } = await sb.from("archivos").select("id, storage_path").eq("id", body.id).eq("estado", "subiendo").maybeSingle();
      if (data) {
        await sb.storage.from(BUCKET).remove([data.storage_path]);
        await sb.from("archivos").delete().eq("id", data.id);
      }
      return json({ ok: true });
    }

    if (accion === "urls") {
      const ids: string[] = (Array.isArray(body.ids) ? body.ids : []).filter(esUuid).slice(0, 100);
      if (!ids.length) return json({ urls: {} });
      const { data, error } = await sb.from("archivos").select("id, storage_path, nombre").in("id", ids).eq("estado", "ok");
      if (error) throw error;
      const urls: Record<string, string> = {};
      await Promise.all((data || []).map(async (f: any) => {
        const { data: u } = await sb.storage.from(BUCKET).createSignedUrl(
          f.storage_path, 3600, body.descargar ? { download: f.nombre } : undefined);
        if (u?.signedUrl) urls[f.id] = u.signedUrl;
      }));
      return json({ urls });
    }

    if (accion === "borrar") {
      if (quien !== "admin") return json({ error: "Solo el administrador puede borrar" }, 403);
      const ids: string[] = (Array.isArray(body.ids) ? body.ids : []).filter(esUuid).slice(0, 200);
      if (!ids.length) return json({ ok: true, borrados: 0 });
      const { data, error } = await sb.from("archivos").select("id, storage_path").in("id", ids).not("papelera_at", "is", null);
      if (error) throw error;
      const filas = data || [];
      if (filas.length) {
        const { error: e2 } = await sb.storage.from(BUCKET).remove(filas.map((f: any) => f.storage_path));
        if (e2) throw e2;
        const { error: e3 } = await sb.from("archivos").delete().in("id", filas.map((f: any) => f.id));
        if (e3) throw e3;
      }
      return json({ ok: true, borrados: filas.length });
    }

    return json({ error: "acción no válida" }, 400);
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message || "error" }, 500);
  }
});
