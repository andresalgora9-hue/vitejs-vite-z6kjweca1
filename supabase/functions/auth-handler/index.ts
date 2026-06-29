import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const db = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);
const rateLimitMap = new Map<string, { count: number; reset: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.reset < now) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}
async function handleLogin(email: string, password: string) {
  const { data: user, error } = await db
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (error || !user) {
    return { success: false, error: "Email o contraseña incorrectos." };
  }
  const passwordMatch = await bcrypt.compare(password, user.password_hash || "");
  if (!passwordMatch) {
    const plainMatch = user.password === password;
    if (!plainMatch) {
      return { success: false, error: "Email o contraseña incorrectos." };
    }
    const hashed = await bcrypt.hash(password);
    await db
      .from("users")
      .update({ password_hash: hashed })
      .eq("id", user.id);
  }
  return { success: true, user };
}
async function handleRegister(
  name: string,
  email: string,
  password: string,
  type: string,
  phone: string,
  trial_end: string
) {
  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return { success: false, error: "Ya existe una cuenta con ese email." };
  }
  const passwordHash = await bcrypt.hash(password);
  const { data: newUser, error } = await db
    .from("users")
    .insert({
      name,
      email,
      password_hash: passwordHash,
      password: "",
      type,
      phone,
      whatsapp: phone,
      bio: "",
      price: 0,
      available: true,
      verified: false,
      jobs: 0,
      rating: 0,
      reviews: 0,
      plan: "gratis",
      trial_end,
    })
    .select()
    .single();
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, user: newUser };
}

// ── NUEVO: guardar lead cliente desde landing ──
async function handleSaveClientLead(
  nombre: string, telefono: string, oficio: string, descripcion: string,
  utm_source: string, utm_medium: string, utm_campaign: string, utm_content: string
) {
  const { error } = await db.from("client_leads").insert({
    nombre, telefono, oficio,
    descripcion: descripcion || null,
    utm_source: utm_source || "directo",
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
    utm_content: utm_content || null,
    registered: false,
  });
  if (error) return { success: false, error: error.message };

  // Push al admin (fire & forget, no bloquea)
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      },
      body: JSON.stringify({
        user_id: "00000000-0000-0000-0000-000000000002",
        title: "🔔 Nuevo lead cliente — " + (oficio || ""),
        body: (nombre || "") + " · " + (telefono || ""),
        url: "/",
      }),
    });
  } catch(_) {}

  return { success: true };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json();
    const { action, email, password, name, type, phone, trial_end,
            nombre, telefono, oficio, descripcion,
            utm_source, utm_medium, utm_campaign, utm_content } = body;
    let response;
    if (action === "login") {
      response = await handleLogin(email, password);
    } else if (action === "register") {
      response = await handleRegister(name, email, password, type, phone, trial_end);
    } else if (action === "save_client_lead") {
      response = await handleSaveClientLead(nombre, telefono, oficio, descripcion, utm_source, utm_medium, utm_campaign, utm_content);
    } else {
      response = { success: false, error: "Invalid action" };
    }
    return new Response(JSON.stringify(response), {
      status: response.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
