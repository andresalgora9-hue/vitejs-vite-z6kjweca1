const SUPABASE_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE";

function toSlug(name, trade) {
  return ((name || "") + " " + (trade || "")).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || "").toLowerCase();
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  let pros = [];
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/users?type=eq.profesional&select=name,trade,zone,bio,rating,reviews,verified,experience_years,specialties,schedule,response_time,free_quote,avatar_url,plan,deleted,banned", {
      headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY }
    });
    pros = await r.json();
  } catch (e) { pros = []; }
  if (!Array.isArray(pros)) pros = [];

  const pro = pros.find(p => !p.deleted && !p.banned && toSlug(p.name, p.trade) === slug);

  if (!pro) {
    res.statusCode = 404;
    res.setHeader("Cache-Control", "public, s-maxage=600");
    res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Perfil no encontrado — OficioYa</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;background:#0D0D14;color:#fff;text-align:center;padding:80px 20px"><h1 style="color:#FFB800">Perfil no encontrado</h1><p>Este profesional ya no está disponible en OficioYa.</p><a href="https://www.aficioya.com/" style="color:#FFB800">Buscar profesionales en Sevilla →</a></body></html>`);
    return;
  }

  const nombre = esc(pro.name);
  const oficio = esc(pro.trade || "Profesional");
  const zona = esc(pro.zone || "Sevilla");
  const bio = esc(pro.bio || "");
  const url = "https://www.aficioya.com/pro/" + slug;
  const titulo = `${nombre} — ${oficio} en ${zona} | OficioYa`;
  const desc = bio ? bio.slice(0, 155) : `${nombre}, ${oficio.toLowerCase()} en ${zona}. Perfil verificado en OficioYa. Pide presupuesto sin compromiso.`;
  const tieneRating = pro.reviews > 0 && pro.rating > 0;

  const schema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "name": nombre + " — " + oficio,
    "url": url,
    "areaServed": zona,
    "address": { "@type": "PostalAddress", "addressLocality": zona, "addressRegion": "Andalucía", "addressCountry": "ES" }
  };
  if (tieneRating) schema.aggregateRating = { "@type": "AggregateRating", "ratingValue": pro.rating, "reviewCount": pro.reviews };
  if (pro.avatar_url) schema.image = pro.avatar_url;

  res.statusCode = 200;
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.end(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<meta name="description" content="${desc}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${titulo}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
${pro.avatar_url ? `<meta property="og:image" content="${esc(pro.avatar_url)}">` : ""}
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
body{margin:0;font-family:-apple-system,'Segoe UI',sans-serif;background:#0D0D14;color:#EDEDF2}
.wrap{max-width:640px;margin:0 auto;padding:32px 20px}
.card{background:#15151F;border:1px solid #26263A;border-radius:16px;padding:24px;margin-bottom:16px}
h1{font-size:26px;margin:0 0 4px;color:#fff}
.oficio{color:#FFB800;font-weight:700;font-size:16px;margin:0 0 12px}
.meta{color:#9A9AB0;font-size:14px;line-height:1.8}
.badge{display:inline-block;background:#FFB80022;color:#FFB800;border:1px solid #FFB80055;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;margin-right:6px}
.cta{display:block;text-align:center;background:#FFB800;color:#0D0D14;font-weight:800;font-size:16px;padding:16px;border-radius:12px;text-decoration:none;margin-top:20px}
.avatar{width:80px;height:80px;border-radius:16px;object-fit:cover;margin-bottom:12px}
</style>
</head>
<body>
<div class="wrap">
  <p style="color:#FFB800;font-weight:800;font-size:18px">🔨 OficioYa</p>
  <div class="card">
    ${pro.avatar_url ? `<img class="avatar" src="${esc(pro.avatar_url)}" alt="${nombre}">` : ""}
    <h1>${nombre}</h1>
    <p class="oficio">${oficio} en ${zona}</p>
    <div>
      ${pro.verified ? `<span class="badge">✓ Verificado</span>` : ""}
      ${tieneRating ? `<span class="badge">★ ${pro.rating} (${pro.reviews} reseñas)</span>` : ""}
      ${pro.experience_years ? `<span class="badge">${pro.experience_years} años de experiencia</span>` : ""}
    </div>
    ${bio ? `<p class="meta" style="margin-top:14px">${bio}</p>` : ""}
    <p class="meta">
      ${pro.schedule ? `🗓 ${esc(pro.schedule)}<br>` : ""}
      ${pro.response_time ? `⚡ Responde en ${esc(pro.response_time).toLowerCase()}<br>` : ""}
      ${pro.free_quote ? `💬 Presupuesto gratis` : ""}
    </p>
    <a class="cta" href="https://www.aficioya.com/">Pedir presupuesto en OficioYa →</a>
  </div>
  <p class="meta" style="text-align:center">OficioYa — Profesionales verificados en Sevilla · <a href="https://www.aficioya.com/" style="color:#FFB800">aficioya.com</a></p>
</div>
</body>
</html>`);
}
