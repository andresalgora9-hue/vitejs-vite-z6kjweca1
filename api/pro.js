const SUPABASE_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE";
const H = { headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY } };

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
function stars(n) {
  const f = Math.round(Number(n) || 0);
  return "★★★★★".slice(0, f) + "☆☆☆☆☆".slice(0, 5 - f);
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || "").toLowerCase();
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  let pros = [];
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/users?type=eq.profesional&select=id,name,trade,zone,service_zones,bio,rating,reviews,verified,experience_years,specialties,schedule,response_time,free_quote,avatar_url,plan,jobs,deleted,banned", H);
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

  let fotos = [], resenas = [];
  try {
    const [fR, rR] = await Promise.all([
      fetch(SUPABASE_URL + "/rest/v1/photos?worker_id=eq." + pro.id + "&select=url,caption&order=created_at.desc&limit=12", H),
      fetch(SUPABASE_URL + "/rest/v1/reviews?worker_id=eq." + pro.id + "&approved=not.is.false&select=client_name,stars,text,created_at&order=created_at.desc&limit=10", H)
    ]);
    fotos = await fR.json();
    resenas = await rR.json();
  } catch (e) {}
  if (!Array.isArray(fotos)) fotos = [];
  if (!Array.isArray(resenas)) resenas = [];
  fotos = fotos.filter(f => f.url);
  resenas = resenas.filter(r => r.text || r.stars);

  const nombre = esc(pro.name);
  const primerNombre = esc((pro.name || "").split(" ")[0]);
  const oficio = esc(pro.trade || "Profesional");
  const zona = esc(pro.zone || "Sevilla");
  const bio = esc(pro.bio || "");
  const url = "https://www.aficioya.com/pro/" + slug;
  const chatUrl = "https://www.aficioya.com/?pro=" + slug;
  const titulo = `${nombre} — ${oficio} en ${zona} | OficioYa`;
  const desc = bio ? bio.slice(0, 155) : `${nombre}, ${oficio.toLowerCase()} en ${zona}. Habla con él directamente por chat en OficioYa y pide presupuesto sin compromiso.`;
  const tieneRating = resenas.length > 0 || (pro.reviews > 0 && pro.rating > 0);
  const nResenas = resenas.length > 0 ? resenas.length : (pro.reviews || 0);
  const especialidades = Array.isArray(pro.specialties) ? pro.specialties.filter(Boolean) : [];
  const zonas = Array.isArray(pro.service_zones) ? pro.service_zones.filter(Boolean) : [];

  const schema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "name": nombre + " — " + oficio,
    "url": url,
    "areaServed": zonas.length ? zonas : zona,
    "address": { "@type": "PostalAddress", "addressLocality": zona, "addressRegion": "Andalucía", "addressCountry": "ES" }
  };
  if (tieneRating && pro.rating > 0) schema.aggregateRating = { "@type": "AggregateRating", "ratingValue": pro.rating, "reviewCount": Math.max(nResenas, 1) };
  if (pro.avatar_url) schema.image = pro.avatar_url;

  res.statusCode = 200;
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
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
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,'Segoe UI',sans-serif;background:#0D0D14;color:#EDEDF2;padding-bottom:90px}
.wrap{max-width:680px;margin:0 auto;padding:24px 18px}
.logo{color:#FFB800;font-weight:800;font-size:18px;margin:0 0 18px}
.card{background:#15151F;border:1px solid #26263A;border-radius:16px;padding:22px;margin-bottom:14px}
h1{font-size:26px;margin:0 0 2px;color:#fff}
h2{font-size:16px;color:#FFB800;margin:0 0 12px}
.oficio{color:#FFB800;font-weight:700;font-size:16px;margin:0 0 10px}
.slogan{font-size:15px;color:#C9C9D8;line-height:1.5;margin:12px 0 0;border-left:3px solid #FFB800;padding-left:12px}
.meta{color:#9A9AB0;font-size:14px;line-height:1.8;margin:0}
.badge{display:inline-block;background:#FFB80022;color:#FFB800;border:1px solid #FFB80055;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;margin:0 6px 6px 0}
.chip{display:inline-block;background:#1E1E2C;color:#C9C9D8;border:1px solid #33334A;border-radius:20px;padding:5px 13px;font-size:13px;margin:0 6px 8px 0}
.cta{display:block;text-align:center;background:#FFB800;color:#0D0D14;font-weight:800;font-size:16px;padding:16px;border-radius:12px;text-decoration:none}
.stickybar{position:fixed;bottom:0;left:0;right:0;background:#0D0D14EE;border-top:1px solid #26263A;padding:12px 18px;backdrop-filter:blur(8px)}
.stickybar .cta{max-width:644px;margin:0 auto}
.avatar{width:88px;height:88px;border-radius:18px;object-fit:cover;margin-bottom:12px;border:2px solid #FFB80044}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.grid img{width:100%;height:130px;object-fit:cover;border-radius:10px;border:1px solid #26263A}
.caption{font-size:11px;color:#9A9AB0;margin:4px 0 0}
.review{border-bottom:1px solid #26263A;padding:12px 0}
.review:last-child{border-bottom:none}
.rstars{color:#FFB800;font-size:14px}
.rname{font-weight:700;font-size:13px;color:#fff}
.rtext{font-size:14px;color:#C9C9D8;line-height:1.5;margin:6px 0 0}
.step{display:flex;gap:12px;margin-bottom:14px;align-items:flex-start}
.stepnum{background:#FFB800;color:#0D0D14;font-weight:900;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px}
.steptext{font-size:14px;color:#C9C9D8;line-height:1.5}
.steptext b{color:#fff}
.foot{text-align:center;font-size:13px;color:#9A9AB0}
.foot a{color:#FFB800}
</style>
</head>
<body>
<div class="wrap">
  <p class="logo">🔨 OficioYa</p>

  <div class="card">
    ${pro.avatar_url ? `<img class="avatar" src="${esc(pro.avatar_url)}" alt="${nombre}, ${oficio.toLowerCase()} en ${zona}">` : ""}
    <h1>${nombre}</h1>
    <p class="oficio">${oficio} en ${zona}</p>
    <div>
      ${pro.verified ? `<span class="badge">✓ Verificado</span>` : ""}
      ${tieneRating && pro.rating > 0 ? `<span class="badge">★ ${pro.rating}${nResenas ? ` (${nResenas} reseñas)` : ""}</span>` : ""}
      ${pro.experience_years ? `<span class="badge">${pro.experience_years} años de experiencia</span>` : ""}
      ${pro.jobs > 0 ? `<span class="badge">${pro.jobs} trabajos en OficioYa</span>` : ""}
      ${pro.free_quote ? `<span class="badge">💬 Presupuesto gratis</span>` : ""}
    </div>
    <p class="slogan">Trato directo con ${primerNombre}: le escribes por chat y te responde él, no un call center.${pro.response_time ? ` Suele responder en ${esc(pro.response_time).toLowerCase()}.` : ""}</p>
    <a class="cta" style="margin-top:18px" href="${chatUrl}">💬 Hablar con ${primerNombre}</a>
  </div>

  ${bio ? `<div class="card"><h2>Sobre ${primerNombre}</h2><p class="meta">${bio}</p></div>` : ""}

  ${especialidades.length ? `<div class="card"><h2>Especialidades</h2>${especialidades.map(e => `<span class="chip">${esc(e)}</span>`).join("")}</div>` : ""}

  ${fotos.length ? `<div class="card"><h2>Trabajos realizados</h2><div class="grid">${fotos.map(f => `<div><img src="${esc(f.url)}" alt="${f.caption ? esc(f.caption) : "Trabajo de " + nombre + ", " + oficio.toLowerCase()}" loading="lazy">${f.caption ? `<p class="caption">${esc(f.caption)}</p>` : ""}</div>`).join("")}</div></div>` : ""}

  ${resenas.length ? `<div class="card"><h2>Reseñas de clientes</h2>${resenas.map(r => `<div class="review"><span class="rstars">${stars(r.stars)}</span> <span class="rname">${esc(r.client_name || "Cliente")}</span>${r.text ? `<p class="rtext">${esc(r.text)}</p>` : ""}</div>`).join("")}</div>` : ""}

  <div class="card">
    <h2>Disponibilidad</h2>
    <p class="meta">
      ${pro.schedule ? `🗓 ${esc(pro.schedule)}<br>` : ""}
      ${pro.response_time ? `⚡ Responde en ${esc(pro.response_time).toLowerCase()}<br>` : ""}
      📍 ${zonas.length ? zonas.map(z => esc(z)).join(" · ") : zona}
    </p>
  </div>

  <div class="card">
    <h2>Cómo funciona</h2>
    <div class="step"><div class="stepnum">1</div><p class="steptext"><b>Escríbele gratis.</b> Pulsa el botón, crea tu cuenta en 30 segundos y el chat con ${primerNombre} se abre solo.</p></div>
    <div class="step"><div class="stepnum">2</div><p class="steptext"><b>Cuéntale qué necesitas.</b> Puedes enviarle fotos del problema y pedirle presupuesto sin compromiso.</p></div>
    <div class="step"><div class="stepnum">3</div><p class="steptext"><b>Contrata con tranquilidad.</b> Todo el contacto queda registrado dentro de OficioYa.</p></div>
  </div>

  <p class="foot">OficioYa — Profesionales verificados en Sevilla · <a href="https://www.aficioya.com/">aficioya.com</a></p>
</div>

<div class="stickybar"><a class="cta" href="${chatUrl}">💬 Hablar con ${primerNombre}</a></div>
</body>
</html>`);
}
