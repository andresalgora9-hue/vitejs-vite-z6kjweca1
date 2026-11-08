// ============================================================
// OficioYa · cobros — pago automático de las facturas con tarjeta (Stripe)
//   GET  ?t=TOKEN         → abre Stripe Checkout (modo setup) para guardar la tarjeta del profesional
//                           (enlace público: https://www.aficioya.com/tarjeta/TOKEN → rewrite de vercel.json)
//   GET  ?ok=SESSION_ID   → vuelta de Stripe: guarda la tarjeta, cobra lo pendiente y vuelve a la app
//   POST {accion:"cobrar", factura}  → cobra una factura recién emitida (lo llama la base de datos)
//   POST {accion:"reintentar"}       → reintento diario de cobros fallidos (cron)
// Las llamadas POST llevan la cabecera x-cobros-clave (clave guardada en Vault: cobros_clave).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FN_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/cobros";
const WEB = "https://www.aficioya.com/";
const APP = WEB + "?app=1";
const BOTS = /whatsapp|facebookexternalhit|facebot|telegrambot|slackbot|twitterbot|discordbot|googlebot|bingbot|linkedinbot|skypeuripreview|embedly|preview/i;

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

type Res = { ok: boolean; status: number; data: any };

async function stripe(method: "GET" | "POST", path: string, params: Record<string, string> = {}, idem?: string): Promise<Res> {
  const headers: Record<string, string> = { Authorization: "Bearer " + STRIPE_KEY, "Stripe-Version": "2024-06-20" };
  let url = "https://api.stripe.com/v1/" + path;
  let body: string | undefined;
  const qs = new URLSearchParams(params).toString();
  if (method === "GET") { if (qs) url += "?" + qs; }
  else { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = qs; }
  if (idem) headers["Idempotency-Key"] = idem;
  try {
    const r = await fetch(url, { method, headers, body });
    const data = await r.json().catch(() => ({ error: { message: "Respuesta no válida de Stripe" } }));
    return { ok: r.ok && !data?.error, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: { type: "red", message: "Sin conexión con Stripe: " + (e as Error).message } } };
  }
}

const ir = (url: string) => new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store" } });
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "Content-Type": "application/json" } });
const euros = (n: number) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2).replace(".", ",") + " €";

const MOTIVOS: Record<string, string> = {
  insufficient_funds: "fondos insuficientes",
  expired_card: "la tarjeta está caducada",
  card_declined: "el banco ha rechazado el cobro",
  generic_decline: "el banco ha rechazado el cobro",
  do_not_honor: "el banco ha rechazado el cobro",
  authentication_required: "tu banco pide confirmar el pago",
  requires_action: "tu banco pide confirmar el pago",
  incorrect_cvc: "el código de seguridad no es correcto",
  incorrect_number: "el número de tarjeta no es correcto",
  lost_card: "la tarjeta figura como perdida",
  stolen_card: "la tarjeta figura como robada",
  pickup_card: "el banco ha bloqueado la tarjeta",
  restricted_card: "el banco ha bloqueado la tarjeta",
  card_velocity_exceeded: "se ha superado el límite de la tarjeta",
  withdrawal_count_limit_exceeded: "se ha superado el límite de la tarjeta",
  card_not_supported: "la tarjeta no admite este tipo de cobro",
  currency_not_supported: "la tarjeta no admite cobros en euros",
  processing_error: "error del banco al procesar el pago",
  resource_missing: "la tarjeta guardada ya no es válida",
  payment_method_unactivated: "la tarjeta guardada ya no es válida",
};
const motivo = (e: any, codigo?: string) =>
  MOTIVOS[e?.decline_code] || MOTIVOS[e?.code] || (codigo ? MOTIVOS[codigo] : "") || "el banco ha rechazado el cobro";

let claveCache: string | null = null;
async function claveOk(req: Request): Promise<boolean> {
  const h = req.headers.get("x-cobros-clave") || "";
  if (!h) return false;
  if (!claveCache) {
    const { data } = await db.rpc("oy_cobros_clave");
    claveCache = typeof data === "string" && data.length >= 32 ? data : null;
  }
  return !!claveCache && h === claveCache;
}

function emailValido(e?: string | null) {
  return !!e && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e) && !/\.local$|@aficioya-lead\.com$|@cliente\.oficioya\.com$/i.test(e);
}

async function clienteStripe(u: any, actual: string | null): Promise<string> {
  for (const id of [actual, u.stripe_customer_id]) {
    if (!id) continue;
    const r = await stripe("GET", "customers/" + encodeURIComponent(id));
    if (r.ok && !r.data?.deleted) return id;
  }
  const p: Record<string, string> = {
    name: u.company_name || u.name || "Profesional OficioYa",
    description: "Profesional de OficioYa",
    "metadata[pro_id]": u.id,
  };
  const email = emailValido(u.billing_email) ? u.billing_email : emailValido(u.email) ? u.email : null;
  if (email) p.email = email;
  const r = await stripe("POST", "customers", p, "oy-cliente-" + u.id);
  if (!r.ok) throw new Error(r.data?.error?.message || "No se ha podido crear el cliente en Stripe");
  return r.data.id;
}

// ── Enlace del profesional → página de Stripe para guardar la tarjeta ──
async function abrirTarjeta(token: string): Promise<Response> {
  const { data: fila } = await db.from("pro_tarjetas").select("pro_id, stripe_customer_id").eq("enlace_token", token).maybeSingle();
  if (!fila) return ir(APP + "&tarjeta=enlace_no_valido");
  const { data: u } = await db.from("users")
    .select("id,name,company_name,email,billing_email,stripe_customer_id").eq("id", fila.pro_id).maybeSingle();
  if (!u) return ir(APP + "&tarjeta=enlace_no_valido");

  const cus = await clienteStripe(u, fila.stripe_customer_id);
  if (cus !== fila.stripe_customer_id) {
    await db.from("pro_tarjetas").update({ stripe_customer_id: cus, actualizada_at: new Date().toISOString() }).eq("pro_id", u.id);
  }

  const [{ data: pend }, { data: umbral }] = await Promise.all([
    db.from("lead_invoices").select("number,total,cobro_estado").eq("pro_id", u.id).eq("status", "pendiente").eq("tipo", "leads").order("issued_at"),
    db.from("oy_config").select("valor").eq("clave", "umbral_factura").maybeSingle(),
  ]);
  // Las que se cobrarán al guardar la tarjeta (no las que ya se están cobrando ni las que dice que ya ha pagado)
  const lista = (pend || []).filter((f: any) => !["cobrando", "cobrada", "procesando", "aviso_pago"].includes(f.cobro_estado || ""))
    .map((f: any) => f.number + " (" + euros(f.total) + ")").join(", ");
  const texto = "Al guardar la tarjeta autorizas a OficioYa a cobrar en ella, de forma automática, cada factura de leads cuando se emita "
    + "(el día 1 de cada mes o al llegar a " + Math.round(Number(umbral?.valor || 820)) + " € + IVA)."
    + (lista ? " Ahora se cobrarán tus facturas pendientes: " + lista + "." : " Hoy no se cobra nada.");

  const r = await stripe("POST", "checkout/sessions", {
    mode: "setup",
    "payment_method_types[0]": "card",
    customer: cus,
    locale: "es",
    success_url: FN_URL + "?ok={CHECKOUT_SESSION_ID}",
    cancel_url: APP + "&tarjeta=cancelada",
    "metadata[pro_id]": u.id,
    "metadata[tipo]": "tarjeta_facturas",
    "setup_intent_data[metadata][pro_id]": u.id,
    "setup_intent_data[description]": "Pago automático de las facturas de OficioYa",
    "custom_text[submit][message]": texto.slice(0, 1200),
  });
  if (!r.ok) { console.error("checkout", JSON.stringify(r.data?.error)); return ir(APP + "&tarjeta=error"); }
  await db.from("pro_tarjetas").update({ checkout_session_id: r.data.id }).eq("pro_id", u.id);
  return ir(r.data.url);
}

// ── Vuelta de Stripe: guarda la tarjeta y cobra lo pendiente ──
async function vueltaTarjeta(sid: string): Promise<Response> {
  const r = await stripe("GET", "checkout/sessions/" + encodeURIComponent(sid), { "expand[]": "setup_intent.payment_method" });
  if (!r.ok) return ir(APP + "&tarjeta=error");
  const s = r.data;
  const proId = s.metadata?.pro_id;
  if (s.mode !== "setup" || s.metadata?.tipo !== "tarjeta_facturas" || !proId) return ir(APP + "&tarjeta=error");
  const si = s.setup_intent;
  if (s.status !== "complete" || !si || si.status !== "succeeded" || !si.payment_method) return ir(APP + "&tarjeta=pendiente");

  let pm = si.payment_method;
  if (typeof pm === "string") pm = (await stripe("GET", "payment_methods/" + encodeURIComponent(pm))).data;
  if (!pm?.id) return ir(APP + "&tarjeta=error");
  const card = pm.card || {};
  const cus = typeof s.customer === "string" ? s.customer : s.customer?.id;
  if (cus) await stripe("POST", "customers/" + encodeURIComponent(cus), { "invoice_settings[default_payment_method]": pm.id });

  const g = await db.rpc("oy_tarjeta_guardar", {
    p_pro: proId, p_customer: cus, p_pm: pm.id, p_marca: card.brand ?? null, p_ultimos4: card.last4 ?? null,
    p_mes: card.exp_month ?? null, p_anio: card.exp_year ?? null, p_session: s.id,
  });
  if (g.error) { console.error("guardar", g.error.message); return ir(APP + "&tarjeta=error"); }

  let fallo = false;
  for (const id of (g.data?.pendientes || []) as string[]) {
    const res = await cobrar(id, "tarjeta_guardada");
    if (res === "rechazada" || res === "error") fallo = true;
  }
  return ir(APP + "&tarjeta=" + (fallo ? "cobro_fallido" : "ok"));
}

// Si no se puede apuntar el resultado, la factura se queda «cobrando» y el reintento la revisa en Stripe
async function resultado(f: string, estado: string, pi: string | null, codigo: string | null, mensaje: string | null, detalle: string | null, origen: string): Promise<string> {
  const r = await db.rpc("oy_cobro_resultado", {
    p_factura: f, p_estado: estado, p_pi: pi, p_codigo: codigo, p_mensaje: mensaje, p_detalle: detalle, p_origen: origen,
  });
  if (r.error) { console.error("resultado", f, r.error.message); return "error"; }
  return estado;
}

// ── Cobro de una factura (sin cobros dobles: reclamo atómico + clave de idempotencia) ──
async function cobrar(facturaId: string, origen: string): Promise<string> {
  const c = await db.rpc("oy_cobro_reclamar", { p_factura: facturaId, p_origen: origen });
  if (c.error) { console.error("reclamar", c.error.message); return "error"; }
  const x = c.data;
  if (!x) return "nada";
  if (x.sin_tarjeta) return "sin_tarjeta";

  // Un intento anterior se quedó sin respuesta: antes de volver a cobrar, mira si ya se cobró
  if (x.revisar) {
    const b = await stripe("GET", "payment_intents/search", { query: "metadata['factura_id']:'" + x.factura + "' AND status:'succeeded'" });
    const hecho = b.ok ? b.data?.data?.[0] : null;
    if (hecho) return await resultado(x.factura, "cobrada", hecho.id, null, null, null, origen);
  }

  const r = await stripe("POST", "payment_intents", {
    amount: String(Math.round(Number(x.total) * 100)),
    currency: "eur",
    customer: x.customer,
    payment_method: x.pm,
    "payment_method_types[0]": "card",
    off_session: "true",
    confirm: "true",
    description: "Factura " + x.number + " · OficioYa",
    "metadata[factura_id]": x.factura,
    "metadata[factura]": x.number,
    "metadata[pro_id]": x.pro_id,
    "metadata[tipo]": "factura_leads",
  }, "oy-factura-" + x.factura + "-" + x.intento);

  const err = r.data?.error;
  const pi = err ? err.payment_intent : r.data;
  if (r.ok && pi?.status === "succeeded") return await resultado(x.factura, "cobrada", pi.id, null, null, null, origen);
  if (r.ok && pi?.status === "processing") return await resultado(x.factura, "procesando", pi.id, null, null, null, origen);
  if (r.status === 0 || r.status === 429 || r.status >= 500) {
    // No sabemos si se cobró: se queda «cobrando» y el reintento lo revisa en Stripe antes de nada
    console.error("cobro sin respuesta clara", x.number, r.status, err?.message);
    return "error";
  }
  const e = err || pi?.last_payment_error || {};
  const codigo = e.decline_code || e.code || pi?.status || "desconocido";
  const deTarjeta = e.type === "card_error" || e.code === "resource_missing" || e.code === "payment_method_unactivated" || (!err && !!pi);
  return await resultado(x.factura, deTarjeta ? "rechazada" : "error", pi?.id ?? null, codigo, motivo(e, codigo), e.message || null, origen);
}

async function reintentar() {
  const { data, error } = await db.rpc("oy_cobros_para_reintentar");
  if (error) return { error: error.message };
  const out: [string, string][] = [];
  for (const f of (data || []) as any[]) {
    if (f.estado === "procesando" && f.pi) {
      const r = await stripe("GET", "payment_intents/" + encodeURIComponent(f.pi));
      const st = r.data?.status;
      if (st === "succeeded") { await resultado(f.factura, "cobrada", f.pi, null, null, null, "reintento"); out.push([f.factura, "cobrada"]); }
      else if (st === "requires_payment_method" || st === "canceled") {
        const e = r.data?.last_payment_error || {};
        await resultado(f.factura, "rechazada", f.pi, e.decline_code || e.code || st, motivo(e, st), e.message || null, "reintento");
        out.push([f.factura, "rechazada"]);
      }
      continue;
    }
    out.push([f.factura, await cobrar(f.factura, "reintento")]);
  }
  return { revisadas: out.length, resultado: out };
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    if (req.method === "GET") {
      if (BOTS.test(req.headers.get("user-agent") || "")) return ir(WEB);
      const t = url.searchParams.get("t");
      const ok = url.searchParams.get("ok");
      if (t && /^[a-f0-9]{32}$/.test(t)) return await abrirTarjeta(t);
      if (ok && /^cs_(live|test)_[A-Za-z0-9]+$/.test(ok)) return await vueltaTarjeta(ok);
      return ir(APP);
    }
    if (req.method === "POST") {
      if (!(await claveOk(req))) return json({ error: "no autorizado" }, 401);
      const b = await req.json().catch(() => ({}));
      if (b.accion === "cobrar" && b.factura) return json({ resultado: await cobrar(String(b.factura), "emision") });
      if (b.accion === "reintentar") return json(await reintentar());
      return json({ error: "acción no válida" }, 400);
    }
    return json({ error: "método no permitido" }, 405);
  } catch (e) {
    console.error("cobros", (e as Error).message);
    if (req.method === "GET") return ir(APP + "&tarjeta=error");
    return json({ error: (e as Error).message }, 500);
  }
});
