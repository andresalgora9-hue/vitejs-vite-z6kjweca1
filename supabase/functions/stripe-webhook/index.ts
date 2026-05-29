import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || "";

const PLAN_POR_PRICE: Record<string, string> = {
  "price_1TYuneCZe2kZYfZCxD24mHGx": "elite",
  "price_1TYxjFCZe2kZYfZCNN2TBfzs": "elite",
  "price_1TYuioCZe2kZYfZChYFbWcrt": "pro",
  "price_1TYugfCZe2kZYfZChXHjTrsg": "basico",
};

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";

  // Verificar firma del webhook
  try {
    await verifyStripeSignature(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Webhook signature invalid", { status: 400 });
  }

  const event = JSON.parse(body);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    switch (event.type) {

      // Suscripción creada o activada → actualizar plan
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const email = sub.metadata?.email;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan = PLAN_POR_PRICE[priceId] || "basico";
        const trialEnd = sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString().split("T")[0]
          : new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

        if (email) {
          await supabase.from("users").update({
            plan,
            trial_end: trialEnd,
            stripe_customer_id: sub.customer,
            stripe_subscription_id: sub.id,
          }).eq("email", email);
        }
        break;
      }

      // Pago exitoso → confirmar plan activo
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const email = invoice.customer_email;
        const priceId = invoice.lines?.data?.[0]?.price?.id;
        const plan = PLAN_POR_PRICE[priceId] || "basico";

        if (email) {
          await supabase.from("users").update({ plan }).eq("email", email);
        }
        break;
      }

      // Pago fallido → avisar, dar 5 días de gracia antes de bajar plan
      case "invoice.payment_failed": {
  const invoice = event.data.object;
  const customerId = invoice.customer;
  if (customerId) {
    const graceUntil = new Date(Date.now() + 5 * 86400000).toISOString();
    await supabase.from("users").update({
      payment_failed_at: new Date().toISOString(),
      grace_until: graceUntil,
    }).eq("stripe_customer_id", customerId);
  }
  break;
}

case "invoice.payment_failed_grace_expired": {
  const invoice = event.data.object;
  const customerId = invoice.customer;
  if (customerId) {
    const { data: usr } = await supabase
      .from("users")
      .select("grace_until")
      .eq("stripe_customer_id", customerId)
      .single();
    if (usr?.grace_until && new Date(usr.grace_until) < new Date()) {
      await supabase.from("users").update({
        plan: "gratis",
        stripe_subscription_id: null,
      }).eq("stripe_customer_id", customerId);
    }
  }
  break;
}
// Anticipo pagado → actualizar mensaje a ANTICIPO_PAGADO
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const jobId = pi.metadata?.job_id;
        const tipo = pi.metadata?.tipo;
        if (jobId && tipo === "anticipo") {
          await supabase.from("messages").update({
            anticipo_status: "ANTICIPO_PAGADO",
            anticipo_paid_at: new Date().toISOString(),
          }).eq("job_id", jobId).eq("anticipo_status", "pendiente");
        }
        break;
      }
      // Suscripción cancelada → bajar a gratis
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const email = sub.metadata?.email;
        if (email) {
          await supabase.from("users").update({
            plan: "gratis",
            stripe_subscription_id: null,
          }).eq("email", email);
        }
        break;
      }
    }

    await supabase.from("webhook_logs").insert({
      event_type: event.type,
      event_id: event.id,
      payload: JSON.stringify(event.data.object),
      processed_at: new Date().toISOString(),
      ok: true,
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });

 } catch (err: any) {
    await supabase.from("webhook_logs").insert({
      event_type: event?.type || "unknown",
      event_id: event?.id || "unknown",
      payload: JSON.stringify(event?.data?.object || {}),
      processed_at: new Date().toISOString(),
      ok: false,
      error_message: err.message,
    });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

// Verificación de firma HMAC de Stripe
async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const timestamp = parts["t"];
  const sig = parts["v1"];
  const signed = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const result = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const expected = Array.from(new Uint8Array(result)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (expected !== sig) throw new Error("Invalid signature");
}
