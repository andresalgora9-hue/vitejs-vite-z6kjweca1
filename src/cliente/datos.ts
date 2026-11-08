// ============================================================
// OficioYa · ÁREA DEL CLIENTE — lectura y escritura de datos
// ============================================================
import { db } from "../supabase";
import type { Solicitud, ProPublico, Presupuesto, Cliente } from "./clienteComun";
import { FN, FN_HEADERS, gtagEvento, fbqEvento, slug, digitos, miles } from "./clienteComun";

// ── Solicitudes (con su estado) ─────────────────────────────
export async function cargarSolicitudes(clienteId: string): Promise<Solicitud[]> {
  const { data, error } = await db.rpc("oy_cliente_solicitudes", { p_cliente: clienteId });
  if (!error && Array.isArray(data)) return data as Solicitud[];
  // Respaldo (por si la función aún no está en la base de datos)
  const { data: brs } = await db.from("budget_requests")
    .select("id,created_at,oficio,zona,city_slug,description,status,canal,pro_solicitado")
    .eq("client_id", clienteId).order("created_at", { ascending: false }).limit(40);
  const lista = (brs || []) as any[];
  if (!lista.length) return [];
  const { data: leads } = await db.from("pro_leads")
    .select("budget_request_id,pro_id,estado,estado_at,presupuesto_eur,primer_contacto_at,llamada_at,anulado")
    .in("budget_request_id", lista.map((b) => b.id));
  const proIds = Array.from(new Set((leads || []).map((l: any) => l.pro_id).filter(Boolean)));
  const pros: Record<string, any> = {};
  if (proIds.length) {
    const { data: us } = await db.from("users").select("id,name,company_name,avatar_url,trade,phone,whatsapp").in("id", proIds);
    (us || []).forEach((u: any) => { pros[u.id] = u; });
  }
  return lista.map((b) => {
    const l: any = (leads || []).find((x: any) => x.budget_request_id === b.id);
    const u = l ? pros[l.pro_id] : null;
    const tel = u ? digitos(u.phone || u.whatsapp) : "";
    return {
      id: b.id, created_at: b.created_at, oficio: b.oficio, zona: b.zona, city_slug: b.city_slug, descripcion: b.description,
      estado: b.status, canal: b.canal, pro_solicitado: b.pro_solicitado,
      lead_estado: l?.estado || null, lead_estado_at: l?.estado_at || null, presupuesto_eur: l?.presupuesto_eur ?? null,
      contactado_at: l?.primer_contacto_at || l?.llamada_at || null, anulado: !!l?.anulado,
      pro: u ? {
        id: u.id, nombre: String(u.name || "").trim().split(/\s+/)[0] || "Tu profesional", empresa: u.company_name || null,
        avatar: u.avatar_url || null, oficio: u.trade || null, telefono: tel.length === 9 ? "+34" + tel : tel.length >= 11 ? "+" + tel : null,
      } : null,
    } as Solicitud;
  });
}

export type Tono = "ok" | "oro" | "neutro" | "warn";
export interface EstadoSol { pasos: { t: string; d?: string; e: "hecho" | "ahora" | "falta" }[]; resumen: string; tono: Tono; cerrada: boolean; fin: boolean; progreso: number }
export function estadoSolicitud(s: Solicitud): EstadoSol {
  const pro = s.pro && !s.anulado ? s.pro : null;
  const nom = pro?.nombre || "El profesional";
  const est = (s.lead_estado || "").toLowerCase();
  const cerrada = s.estado === "closed" || est === "perdido" || s.anulado;
  const contactado = !!pro && (!!s.contactado_at || ["contactado", "presupuesto", "ganado"].includes(est));
  const conPresu = !!pro && (est === "presupuesto" || est === "ganado" || (s.presupuesto_eur != null && s.presupuesto_eur > 0));
  const ganado = !!pro && est === "ganado";
  const pasos: EstadoSol["pasos"] = [
    { t: "Solicitud recibida", d: "Ha llegado a OficioYa", e: "hecho" },
    { t: pro ? nom + " se encarga" : "Te asignamos un profesional", d: pro ? "Profesional asignado de tu zona" : (s.pro_solicitado ? "Estamos revisando tu solicitud" : "Normalmente en minutos"), e: pro ? "hecho" : "ahora" },
    { t: pro ? nom + " te llama" : "Te llama para ver el trabajo", d: contactado ? "Ya habéis hablado" : "Para conocer lo que necesitas", e: contactado ? "hecho" : pro ? "ahora" : "falta" },
    { t: "Te pasa el presupuesto", d: conPresu && s.presupuesto_eur ? "Presupuesto: " + miles(s.presupuesto_eur) + " €" : "Sin compromiso", e: conPresu ? "hecho" : contactado ? "ahora" : "falta" },
    { t: "Trabajo confirmado", d: ganado ? "¡A por ello!" : "Tú decides si sigues adelante", e: ganado ? "hecho" : conPresu ? "ahora" : "falta" },
  ];
  const hechos = pasos.filter((p) => p.e === "hecho").length;
  let resumen = "Te asignamos un profesional"; let tono: Tono = "oro";
  if (cerrada && !ganado) { resumen = "Solicitud cerrada"; tono = "neutro"; }
  else if (ganado) { resumen = "Trabajo confirmado con " + nom; tono = "ok"; }
  else if (conPresu) { resumen = s.presupuesto_eur ? nom + " te ha pasado presupuesto" : "Presupuesto en camino"; tono = "ok"; }
  else if (contactado) { resumen = nom + " ya ha hablado contigo"; tono = "ok"; }
  else if (pro) { resumen = nom + " te llamará pronto"; tono = "oro"; }
  return { pasos, resumen, tono, cerrada: cerrada && !ganado, fin: (cerrada && !ganado) || ganado, progreso: hechos / pasos.length };
}

// ── Crear solicitud (desde el área) ─────────────────────────
// Misma regla que oy_lead_contacto: mismo cliente y mismo oficio en 7 días = la misma solicitud
// (cada solicitud se le cobra al profesional, así que no se crea otra).
export async function solicitudRepetida(clienteId: string, oficio: string): Promise<{ id: string; created_at: string } | null> {
  const desde = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data } = await db.from("budget_requests").select("id,oficio,created_at")
    .eq("client_id", clienteId).gte("created_at", desde).order("created_at", { ascending: false }).limit(20);
  const r = (data || []).find((b: any) => (b.oficio || "").trim().toLowerCase() === oficio.trim().toLowerCase());
  return r ? { id: r.id, created_at: r.created_at } : null;
}
export async function crearSolicitud(u: Cliente, d: { oficio: string; zona: string; citySlug: string; descripcion: string; telefono: string; proSolicitado?: string | null; maxBudget?: number | null }): Promise<{ id: string; tel: string; repetida?: boolean }> {
  const tel = digitos(d.telefono).slice(-9);
  if (!d.proSolicitado) {
    const rep = await solicitudRepetida(u.id, d.oficio);
    if (rep) return { id: rep.id, tel, repetida: true };
  }
  if (tel && tel !== digitos(u.phone).slice(-9)) {
    await db.from("users").update({ phone: tel, whatsapp: tel }).eq("id", u.id);
  }
  const { data: req, error } = await db.from("budget_requests").insert({
    client_id: u.id, client_name: u.name, oficio: d.oficio, zona: d.zona, description: d.descripcion,
    max_budget: d.maxBudget || null, status: "open", notified_pros: [], city_slug: d.citySlug || slug(d.zona) || "sevilla",
    landing: "app", canal: "formulario", pro_solicitado: d.proSolicitado || null,
  }).select().single();
  if (error || !req) throw new Error(error?.message || "No se pudo enviar");
  fetch(FN + "/notify-admin", {
    method: "POST", headers: FN_HEADERS,
    body: JSON.stringify({ type: "sin_profesional", cliente: u.name, oficio: d.oficio, zona: d.zona, descripcion: d.descripcion, telefono: tel, email: u.email || "", request_id: req.id }),
  }).catch(() => {});
  // Mismos eventos que ya mandaba la app al pedir presupuesto con sesión iniciada
  gtagEvento("generate_lead", { content_name: "solicitud_presupuesto", oficio: d.oficio, zona: d.zona });
  fbqEvento("Lead", { content_name: "solicitud_presupuesto", content_category: d.oficio });
  return { id: req.id as string, tel };
}

// ── Ciudades con profesional asignado (las mismas que /inicio) ──
export interface Ciudad { slug: string; nombre: string }
export async function cargarCiudades(): Promise<Record<string, Ciudad[]>> {
  const res: Record<string, Ciudad[]> = { pintor: [], fontaner: [] };
  try {
    const { data: rutas } = await db.from("lead_routing").select("trade_key,city_slug").eq("active", true).not("pro_id", "is", null);
    const slugs = Array.from(new Set((rutas || []).map((r: any) => r.city_slug).filter(Boolean)));
    if (!slugs.length) throw new Error("sin rutas");
    const { data: cs } = await db.from("cities").select("name,slug,launched_at").in("slug", slugs).order("launched_at", { ascending: true, nullsFirst: false });
    const nombre = (s: string) => (cs || []).find((c: any) => c.slug === s)?.name || s.charAt(0).toUpperCase() + s.slice(1);
    (rutas || []).forEach((r: any) => {
      const k = String(r.trade_key || "").toLowerCase();
      if (!res[k]) res[k] = [];
      if (!res[k].some((c) => c.slug === r.city_slug)) res[k].push({ slug: r.city_slug, nombre: nombre(r.city_slug) });
    });
    const orden = (cs || []).map((c: any) => c.slug);
    Object.values(res).forEach((l) => l.sort((a, b) => orden.indexOf(a.slug) - orden.indexOf(b.slug)));
  } catch {
    res.pintor = [{ slug: "sevilla", nombre: "Sevilla" }, { slug: "valencia", nombre: "Valencia" }];
    res.fontaner = [{ slug: "sevilla", nombre: "Sevilla" }];
  }
  return res;
}
export const claveOficio = (oficio: string) => (oficio || "").toLowerCase().startsWith("pint") ? "pintor" : (oficio || "").toLowerCase().startsWith("fontan") ? "fontaner" : "";

// ── Profesionales (solo datos públicos) ─────────────────────
export async function cargarProfesionales(): Promise<ProPublico[]> {
  const { data, error } = await db.rpc("oy_cliente_profesionales");
  if (!error && Array.isArray(data)) return data as ProPublico[];
  const { data: us } = await db.from("users")
    .select("id,name,company_name,trade,zone,city_slug,avatar_url,bio,specialties,experience_years,email,es_prueba,login_as,available,deleted,banned")
    .eq("type", "profesional");
  const { data: rutas } = await db.from("lead_routing").select("pro_id").eq("active", true);
  const conContrato = new Set((rutas || []).map((r: any) => r.pro_id));
  return ((us || []) as any[])
    .filter((u) => !u.deleted && !u.banned && !u.es_prueba && !u.login_as && u.available !== false && (u.trade || "").trim() && (u.name || "").trim()
      && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(u.email || "") && !/\.\./.test(u.email || "") && !/algora/i.test(u.email || ""))
    .map((u) => {
      const ps = String(u.name).trim().split(/\s+/);
      const nombre = ps[0].charAt(0).toUpperCase() + ps[0].slice(1).toLowerCase() + (ps[1] ? " " + ps[1].charAt(0).toUpperCase() + "." : "");
      const contrato = conContrato.has(u.id);
      const orden = contrato ? 0 : u.avatar_url && (u.bio || "").length > 20 ? 1 : u.avatar_url || (u.bio || "").length > 20 ? 2 : 3;
      return { p: { id: u.id, nombre, empresa: u.company_name || null, oficio: u.trade, zona: u.zone || u.city_slug || "", avatar: u.avatar_url || null, bio: u.bio || null, especialidades: u.specialties || [], experiencia: u.experience_years ?? null, contrato, fotos: [] } as ProPublico, orden };
    })
    .sort((a, b) => a.orden - b.orden || a.p.nombre.localeCompare(b.p.nombre))
    .map((x) => x.p);
}

// ── Presupuestos apuntados por el cliente ───────────────────
export async function cargarPresupuestos(clienteId: string): Promise<{ lista: Presupuesto[]; error: boolean }> {
  const { data, error } = await db.from("client_quotes").select("*").eq("client_id", clienteId).order("created_at", { ascending: false });
  if (error) return { lista: [], error: true };
  return { lista: (data || []) as Presupuesto[], error: false };
}
export async function guardarPresupuesto(p: Partial<Presupuesto> & { client_id: string }): Promise<Presupuesto> {
  const fila: any = { ...p };
  delete fila.created_at; delete fila.updated_at;
  if (p.id) {
    const id = fila.id; delete fila.id;
    const { data, error } = await db.from("client_quotes").update(fila).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data as Presupuesto;
  }
  delete fila.id;
  const { data, error } = await db.from("client_quotes").insert(fila).select().single();
  if (error) throw new Error(error.message);
  return data as Presupuesto;
}
export async function borrarPresupuesto(id: string) {
  const { error } = await db.from("client_quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Mensajes con OficioYa ───────────────────────────────────
export const ADMIN = "00000000-0000-0000-0000-000000000002";
export async function contarSinLeer(clienteId: string): Promise<number> {
  const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("to_id", clienteId).eq("from_id", ADMIN).eq("read", false);
  return count || 0;
}
