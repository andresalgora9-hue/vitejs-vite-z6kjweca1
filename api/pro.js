// api/pro.js — Perfil público /pro/[slug] · OficioYa
// Landing personalizada por profesional: hero + chips + servicios + proceso + galería + FAQ + CTA
// Datos 100% reales desde Supabase. 404 real si el slug no existe.

// Logo de OficioYa: sube tu logo a public/logo.png en GitHub y esta URL funcionará sola.
const LOGO_URL = "https://aficioya.com/logo.png";
const SLOGAN = "Profesionales de confianza. Trabajos bien hechos.";

const SUPABASE_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE";

const slugify = (s) => (s || "")
  .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Palabras del hero y servicios genéricos por oficio (sin inventar datos del pro)
const TRADE_CONTENT = {
  "Electricista": {
    words: ["Averías", "Instalaciones", "Cuadros eléctricos", "Iluminación", "Urgencias"],
    servicios: [["🔌","Averías eléctricas"],["⚡","Instalaciones nuevas"],["💡","Iluminación y LED"],["🔧","Cuadros y diferenciales"],["📺","Antenas y porteros"],["🏠","Reformas eléctricas"]],
    faq: [
      ["¿Qué tipo de averías eléctricas atiende?","Cortes de luz, diferenciales que saltan, enchufes sin corriente, problemas en el cuadro eléctrico y fallos de instalación. Describe tu avería por el chat de OficioYa y recibirás respuesta directa."],
      ["¿Hace instalaciones completas?","Consulta directamente por el chat: cada profesional detalla su experiencia en instalaciones de vivienda, local u oficina y te orienta sin compromiso."],
    ],
  },
  "Fontanero": {
    words: ["Fugas", "Desatascos", "Termos", "Grifería", "Urgencias"],
    servicios: [["💧","Fugas y humedades"],["🚿","Grifería y sanitarios"],["🔥","Termos y calentadores"],["🌀","Desatascos"],["🛁","Reformas de baño"],["🔧","Tuberías e instalación"]],
    faq: [
      ["¿Atiende urgencias de fontanería?","Escríbele por OficioYa describiendo la urgencia; verás su tiempo medio de respuesta en el perfil y podrás valorar si encaja con tu necesidad."],
      ["¿Cambia termos y calentadores?","Sí, es uno de los trabajos habituales del oficio. Detalla el modelo actual y el que quieres instalar por el chat y recibirás una valoración."],
    ],
  },
  "Pintor": {
    words: ["Interiores", "Fachadas", "Alisados", "Lacados", "Acabados"],
    servicios: [["🎨","Pintura de interiores"],["🏢","Fachadas y exteriores"],["🧱","Alisado de paredes"],["🚪","Lacado de puertas"],["✨","Papel pintado"],["🛡️","Antihumedad"]],
    faq: [
      ["¿Cómo pido presupuesto para pintar mi piso?","Envía por el chat los metros aproximados, número de habitaciones y estado de las paredes. Con eso podrá darte una estimación orientativa sin visita."],
      ["¿Trabaja con alisado de gotelé?","Consúltalo por el chat: es un trabajo habitual del oficio y te confirmará plazos y método."],
    ],
  },
  "Reformas Integrales": {
    words: ["Baños", "Cocinas", "Pisos completos", "Locales", "Llave en mano"],
    servicios: [["🛁","Reformas de baño"],["🍳","Reformas de cocina"],["🏠","Pisos completos"],["🏢","Locales comerciales"],["🧱","Albañilería"],["📐","Proyectos llave en mano"]],
    faq: [
      ["¿Hace reformas completas o también parciales?","Ambas. Describe tu proyecto por el chat de OficioYa — desde cambiar un baño hasta reformar el piso entero — y recibirás una primera valoración."],
      ["¿Cuánto tarda una reforma de baño?","Depende del alcance. Al contactar por OficioYa puedes pedir una estimación de plazos junto al presupuesto, sin compromiso."],
    ],
  },
  "Cerrajero": {
    words: ["Aperturas", "Cerraduras", "Bombines", "Persianas", "Urgencias"],
    servicios: [["🔑","Apertura de puertas"],["🔒","Cambio de cerraduras"],["🛡️","Bombines de seguridad"],["🚪","Puertas blindadas"],["🪟","Persianas"],["🏢","Cierres de local"]],
    faq: [
      ["¿Atiende aperturas urgentes?","Contacta por OficioYa y verás su tiempo medio de respuesta. En el chat puedes confirmar disponibilidad inmediata para tu zona."],
      ["¿Cambia cerraduras el mismo día?","Consúltalo directamente: indica el tipo de puerta y cerradura por el chat y te confirmará disponibilidad."],
    ],
  },
};
const DEFAULT_CONTENT = {
  words: ["Profesional", "De confianza", "En tu zona", "Verificado"],
  servicios: [["🛠️","Servicio profesional"],["📋","Presupuesto sin compromiso"],["📍","Desplazamiento en tu zona"],["💬","Contacto directo por chat"],["⭐","Valoraciones reales"],["🤝","Trato directo"]],
  faq: [
    ["¿Cómo pido presupuesto?","Pulsa \"Contactar\" y descríbele tu necesidad por el chat de OficioYa. Recibirás respuesta directa del profesional, sin intermediarios ni compromiso."],
  ],
};

const FAQ_COMUNES = [
  ["¿El presupuesto tiene coste?","No. Contactar y pedir presupuesto a través de OficioYa es gratis y sin compromiso."],
  ["¿Cómo contacto con este profesional?","Pulsa cualquier botón \"Contactar\" de esta página: entrarás en OficioYa y se abrirá el chat directo con él. Sin llamadas comerciales ni datos compartidos con terceros."],
  ["¿Qué es OficioYa?","La plataforma de profesionales verificados de Sevilla. Los clientes contactan gratis y valoran cada trabajo, para que elijas con información real."],
];

export default async function handler(req, res) {
  try {
    const slug = (req.query.slug || (req.url || "").split("/pro/")[1] || "").split("?")[0].replace(/\/$/, "");
    if (!slug) { res.status(404).send(html404()); return; }

    const headers = { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY };
    const r = await fetch(SUPABASE_URL + "/rest/v1/users?type=eq.profesional&select=id,name,trade,zone,service_zones,bio,rating,reviews,jobs,verified,avatar_url,response_time,schedule,experience_years,specialties,free_quote,plan,available,joined_at", { headers });
    const pros = await r.json();
    const pro = Array.isArray(pros) ? pros.find(p => slugify(p.name + "-" + (p.trade || "")) === slug) : null;
    if (!pro) { res.status(404).send(html404()); return; }

    let gallery = [];
    try {
      const g = await fetch(SUPABASE_URL + "/rest/v1/photos?worker_id=eq." + pro.id + "&select=url,caption&order=created_at.asc&limit=8", { headers });
      gallery = await g.json();
      if (!Array.isArray(gallery)) gallery = [];
    } catch (_) {}

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(renderPage(pro, slug, gallery));
  } catch (e) {
    res.status(500).send("Error temporal. Vuelve a intentarlo en unos minutos.");
  }
}

function html404() {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Perfil no encontrado — OficioYa</title><style>body{background:#0A0A0F;color:#F2F2F7;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}a{color:#FF8C00}</style></head><body><div><h1>Perfil no encontrado</h1><p>Este profesional no existe o ya no está en OficioYa.</p><p><a href="https://aficioya.com">← Buscar profesionales en OficioYa</a></p></div></body></html>`;
}

function renderPage(pro, slug, gallery) {
  const c = TRADE_CONTENT[pro.trade] || DEFAULT_CONTENT;
  const zonas = (pro.service_zones && pro.service_zones.length ? pro.service_zones : [pro.zone]).filter(Boolean);
  const zonaTxt = zonas.length ? zonas.join(", ") : "Sevilla";
  const ctaUrl = "https://aficioya.com/?pro=" + slug;
  const hasRating = Number(pro.reviews) > 0 && Number(pro.rating) > 0;
  const specialties = (pro.specialties || []).filter(Boolean);
  const servicios = specialties.length >= 3 ? specialties.map(s => ["✅", s]) : c.servicios;
  const stats = [];
  if (hasRating) stats.push({ n: Number(pro.rating).toFixed(1), suf: "★", label: pro.reviews + (pro.reviews == 1 ? " reseña" : " reseñas") });
  if (Number(pro.jobs) > 0) stats.push({ n: pro.jobs, suf: "", label: "trabajos por OficioYa" });
  if (Number(pro.experience_years) > 0) stats.push({ n: pro.experience_years, suf: "", label: "años de experiencia" });
  if (pro.response_time) stats.push({ n: "", suf: pro.response_time, label: "tiempo de respuesta" });
  const faqs = [...(c.faq || []), ...FAQ_COMUNES];
  const initials = esc((pro.name || "P").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase());
  const planBadge = pro.plan === "elite" ? "⭐ Profesional Élite" : pro.plan === "pro" ? "🏅 Profesional Destacado" : "";
  const scheduleChips = String(pro.schedule || "").split("|").map(s => s.trim()).filter(Boolean);
  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  let miembroDesde = "";
  if (pro.joined_at) { const d = new Date(pro.joined_at); if (!isNaN(d)) miembroDesde = "Miembro de OficioYa desde " + MESES[d.getMonth()] + " de " + d.getFullYear(); }
  const title = esc(pro.name) + " — " + esc(pro.trade) + " en " + esc(zonas[0] || "Sevilla") + " | OficioYa";
  const desc = esc(pro.name) + ", " + esc((pro.trade || "").toLowerCase()) + " en " + esc(zonaTxt) + ". " + (hasRating ? "Valoración " + Number(pro.rating).toFixed(1) + "★ (" + pro.reviews + " reseñas). " : "") + "Contacta gratis y pide presupuesto sin compromiso en OficioYa.";

  const jsonLd = {
    "@context": "https://schema.org", "@type": "LocalBusiness",
    name: pro.name, description: desc, image: pro.avatar_url || undefined,
    url: "https://www.aficioya.com/pro/" + slug,
    address: { "@type": "PostalAddress", addressLocality: zonas[0] || "Sevilla", addressRegion: "Sevilla", addressCountry: "ES" },
    ...(hasRating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(pro.rating).toFixed(1), reviewCount: pro.reviews } } : {}),
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="https://www.aficioya.com/pro/${esc(slug)}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="profile">
<meta property="og:url" content="https://www.aficioya.com/pro/${esc(slug)}">
${pro.avatar_url ? `<meta property="og:image" content="${esc(pro.avatar_url)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,800;9..40,900&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
:root{--bg:#0A0A0F;--card:#12121A;--card2:#16161F;--border:rgba(255,255,255,.08);--text:#F2F2F7;--muted:#8A8FA3;--accent:#FF8C00;--accent2:#FFB347;--green:#00D68F}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',system-ui,sans-serif;line-height:1.55;overflow-x:hidden}
a{color:inherit;text-decoration:none}
.wrap{max-width:920px;margin:0 auto;padding:0 20px}
/* topbar */
.top{position:sticky;top:0;z-index:50;background:rgba(10,10,15,.8);backdrop-filter:blur(18px);border-bottom:1px solid var(--border)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;height:56px}
.logo{font-weight:900;font-size:18px;letter-spacing:-.02em;display:flex;align-items:center;gap:9px}
.logo span{background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.logo img{height:30px;width:auto;border-radius:8px;display:block}
.tagline{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.02em}
.plan-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#000;background:linear-gradient(135deg,#FFD700,var(--accent));padding:5px 12px;border-radius:99px;margin-left:8px;vertical-align:middle;box-shadow:0 4px 14px rgba(255,140,0,.3)}
.chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
.chip{font-size:12px;font-weight:700;color:var(--muted);background:var(--card);border:1px solid var(--border);padding:6px 12px;border-radius:99px}
.chip.hl{color:var(--green);border-color:rgba(0,214,143,.3);background:rgba(0,214,143,.07)}
.member{font-size:12px;color:var(--muted);margin-top:10px;display:flex;align-items:center;gap:6px}
footer .brand{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:14px}
footer .brand img{height:38px;width:auto;border-radius:9px}
footer .slogan{font-size:15px;font-weight:800;background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.top a.mini{font-size:13px;font-weight:800;color:#000;background:linear-gradient(135deg,var(--accent),var(--accent2));padding:8px 16px;border-radius:99px}
/* hero */
.hero{padding:56px 0 40px;position:relative}
.hero::before{content:"";position:absolute;inset:-40% -20% auto;height:480px;background:radial-gradient(600px 300px at 70% 0%,rgba(255,140,0,.14),transparent 70%);pointer-events:none}
.badge{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--green);background:rgba(0,214,143,.09);border:1px solid rgba(0,214,143,.25);padding:6px 12px;border-radius:99px;margin-bottom:18px}
.dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 1.6s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(0,214,143,.5)}60%{box-shadow:0 0 0 7px rgba(0,214,143,0)}}
.hero-grid{display:flex;gap:26px;align-items:center}
.ava{width:104px;height:104px;border-radius:26px;flex-shrink:0;object-fit:cover;border:2px solid rgba(255,140,0,.4);box-shadow:0 12px 40px rgba(255,140,0,.18)}
.ava-fallback{width:104px;height:104px;border-radius:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:900;color:#000;background:linear-gradient(135deg,var(--accent),var(--accent2))}
h1{font-size:clamp(30px,6vw,46px);font-weight:900;letter-spacing:-.03em;line-height:1.06}
.sub{color:var(--muted);font-size:16px;margin-top:8px}
.sub b{color:var(--text)}
.rot{display:block;margin-top:14px;font-size:clamp(19px,4vw,26px);font-weight:800;min-height:1.4em}
.rot .w{background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block;animation:wordIn .5s cubic-bezier(.2,.9,.3,1.2)}
@keyframes wordIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.cta-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}
.cta{display:inline-flex;align-items:center;gap:8px;font-weight:900;font-size:16px;color:#000;background:linear-gradient(135deg,var(--accent),var(--accent2));padding:15px 28px;border-radius:14px;box-shadow:0 10px 34px rgba(255,140,0,.3);transition:transform .18s,box-shadow .18s}
.cta:hover{transform:translateY(-2px);box-shadow:0 16px 44px rgba(255,140,0,.42)}
.cta.ghost{color:var(--text);background:transparent;border:1px solid var(--border);box-shadow:none}
/* stats */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:38px 0 0}
.stat{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px 16px;text-align:center}
.stat .n{font-size:26px;font-weight:900;background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.stat .l{font-size:12px;color:var(--muted);margin-top:4px}
/* sections */
section{padding:56px 0}
.eyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
h2{font-size:clamp(24px,5vw,32px);font-weight:900;letter-spacing:-.02em;margin-bottom:26px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.svc{display:flex;gap:14px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;transition:border-color .2s,transform .2s}
.svc:hover{border-color:rgba(255,140,0,.35);transform:translateY(-2px)}
.svc .ic{font-size:24px;width:46px;height:46px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(255,140,0,.1);border-radius:12px}
.svc p{font-weight:700;font-size:15px}
/* bio */
.bio{background:var(--card);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:16px;padding:22px;color:var(--muted);font-size:15px}
.bio b{color:var(--text)}
/* steps */
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.step{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:22px;position:relative}
.step .num{position:absolute;top:-14px;left:20px;width:30px;height:30px;border-radius:99px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#000;font-weight:900;font-size:14px;display:flex;align-items:center;justify-content:center}
.step h3{font-size:16px;font-weight:800;margin:8px 0 6px}
.step p{font-size:14px;color:var(--muted)}
/* gallery */
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.gal .ph{aspect-ratio:1;border-radius:14px;overflow:hidden;border:1px solid var(--border)}
.gal img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.gal .ph:hover img{transform:scale(1.05)}
/* zones */
.zones{display:flex;flex-wrap:wrap;gap:8px}
.zone{font-size:13px;font-weight:700;background:var(--card);border:1px solid var(--border);padding:8px 14px;border-radius:99px;color:var(--muted)}
/* faq */
details{background:var(--card);border:1px solid var(--border);border-radius:14px;margin-bottom:10px;overflow:hidden}
summary{cursor:pointer;padding:17px 20px;font-weight:800;font-size:15px;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";font-size:20px;color:var(--accent);transition:transform .2s;flex-shrink:0}
details[open] summary::after{transform:rotate(45deg)}
details p{padding:0 20px 17px;color:var(--muted);font-size:14px}
/* final cta */
.final{background:linear-gradient(135deg,rgba(255,140,0,.12),rgba(255,179,71,.05));border:1px solid rgba(255,140,0,.25);border-radius:22px;padding:44px 26px;text-align:center}
.final h2{margin-bottom:10px}
.final p{color:var(--muted);margin-bottom:24px}
/* footer */
footer{border-top:1px solid var(--border);padding:28px 0 110px;color:var(--muted);font-size:13px;text-align:center}
footer a{color:var(--accent);font-weight:700}
/* sticky mobile cta */
.sticky-cta{position:fixed;bottom:0;left:0;right:0;z-index:60;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:rgba(10,10,15,.85);backdrop-filter:blur(18px);border-top:1px solid var(--border);transform:translateY(110%);transition:transform .35s cubic-bezier(.2,.9,.3,1)}
.sticky-cta.show{transform:none}
.sticky-cta a{display:flex;justify-content:center}
/* scroll reveal */
.reveal{opacity:0;transform:translateY(26px);transition:opacity .6s ease,transform .6s cubic-bezier(.2,.9,.3,1)}
.reveal.visible{opacity:1;transform:none}
.reveal.d1{transition-delay:.08s}.reveal.d2{transition-delay:.16s}.reveal.d3{transition-delay:.24s}.reveal.d4{transition-delay:.32s}.reveal.d5{transition-delay:.4s}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}.rot .w{animation:none}}
@media (max-width:640px){.hero-grid{flex-direction:column;align-items:flex-start;gap:18px}.ava,.ava-fallback{width:84px;height:84px}}
</style>
</head>
<body>

<div class="top"><div class="wrap">
  <a class="logo" href="https://aficioya.com">
    <img src="${LOGO_URL}" alt="OficioYa" onerror="this.style.display='none'">
    <span style="display:flex;flex-direction:column;line-height:1.15"><span style="color:var(--text)">Oficio<span>Ya</span></span><span class="tagline">${esc(SLOGAN)}</span></span>
  </a>
  <a class="mini" href="${ctaUrl}">Contactar</a>
</div></div>

<header class="hero"><div class="wrap">
  <div class="badge reveal">${pro.available !== false ? '<span class="dot"></span> Disponible ahora' : '📍 ' + esc(zonas[0] || "Sevilla")}</div>
  <div class="hero-grid">
    ${pro.avatar_url ? `<img class="ava reveal d1" src="${esc(pro.avatar_url)}" alt="${esc(pro.name)}" onerror="this.outerHTML='<div class=&quot;ava-fallback&quot;>${initials}</div>'">` : `<div class="ava-fallback reveal d1">${initials}</div>`}
    <div>
      <h1 class="reveal d1">${esc(pro.name)}</h1>
      <p class="sub reveal d2"><b>${esc(pro.trade || "Profesional")}</b>${pro.verified ? " · ✓ Verificado" : ""} · ${esc(zonaTxt)}${planBadge ? `<span class="plan-badge">${planBadge}</span>` : ""}</p>
      <span class="rot reveal d2"><span class="w" id="rotWord">${esc(c.words[0])}</span></span>
      ${scheduleChips.length ? `<div class="chips reveal d3">${scheduleChips.map(s => `<span class="chip${/urgencia/i.test(s) ? " hl" : ""}">${/urgencia/i.test(s) ? "🚨 " : "🗓 "}${esc(s)}</span>`).join("")}</div>` : ""}
      ${miembroDesde ? `<p class="member reveal d3">🛡 ${esc(miembroDesde)}</p>` : ""}
    </div>
  </div>
  <div class="cta-row reveal d3">
    <a class="cta" href="${ctaUrl}">💬 Contactar gratis →</a>
    ${gallery.length ? `<a class="cta ghost" href="#trabajos">Ver sus trabajos</a>` : ""}
  </div>
  ${stats.length ? `<div class="stats">${stats.map((s, i) => `<div class="stat reveal d${i + 1}">${s.n !== "" ? `<div class="n" data-count="${esc(s.n)}">0${esc(s.suf)}</div>` : `<div class="n">${esc(s.suf)}</div>`}<div class="l">${esc(s.label)}</div></div>`).join("")}</div>` : ""}
</div></header>

<section><div class="wrap">
  <p class="eyebrow reveal">Servicios</p>
  <h2 class="reveal">¿En qué te puede ayudar?</h2>
  <div class="grid">
    ${servicios.slice(0, 6).map(([ic, t], i) => `<div class="svc reveal d${(i % 3) + 1}"><span class="ic">${esc(ic)}</span><p>${esc(t)}</p></div>`).join("")}
  </div>
</div></section>

${pro.bio ? `<section style="padding-top:0"><div class="wrap">
  <p class="eyebrow reveal">Sobre ${esc((pro.name || "").split(" ")[0])}</p>
  <div class="bio reveal d1">${esc(pro.bio)}</div>
</div></section>` : ""}

${gallery.length ? `<section id="trabajos" style="padding-top:0"><div class="wrap">
  <p class="eyebrow reveal">Galería</p>
  <h2 class="reveal">Trabajos realizados</h2>
  <div class="gal">
    ${gallery.map((g, i) => `<div class="ph reveal d${(i % 4) + 1}"><img src="${esc(g.url)}" alt="Trabajo de ${esc(pro.name)}${g.caption ? " — " + esc(g.caption) : ""}" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`).join("")}
  </div>
</div></section>` : ""}

<section style="padding-top:0"><div class="wrap">
  <p class="eyebrow reveal">Cómo funciona</p>
  <h2 class="reveal">Contacta en 3 pasos, gratis</h2>
  <div class="steps">
    <div class="step reveal d1"><span class="num">1</span><h3>Pulsa "Contactar"</h3><p>Entras en OficioYa y se abre el chat directo con ${esc((pro.name || "").split(" ")[0])}. Sin llamadas comerciales.</p></div>
    <div class="step reveal d2"><span class="num">2</span><h3>Cuéntale tu necesidad</h3><p>Describe el trabajo, añade fotos si quieres y pide presupuesto sin compromiso.</p></div>
    <div class="step reveal d3"><span class="num">3</span><h3>Cierra el trabajo</h3><p>Acordáis precio y fecha directamente. Después podrás dejar tu reseña.</p></div>
  </div>
</div></section>

${zonas.length > 1 ? `<section style="padding-top:0"><div class="wrap">
  <p class="eyebrow reveal">Zonas</p>
  <h2 class="reveal">Dónde trabaja</h2>
  <div class="zones reveal d1">${zonas.map(z => `<span class="zone">📍 ${esc(z)}</span>`).join("")}</div>
</div></section>` : ""}

<section style="padding-top:0"><div class="wrap">
  <p class="eyebrow reveal">Dudas</p>
  <h2 class="reveal">Preguntas frecuentes</h2>
  ${faqs.map(([q, a], i) => `<details class="reveal d${(i % 3) + 1}"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
</div></section>

<section style="padding-top:0"><div class="wrap">
  <div class="final reveal">
    <h2>¿Necesitas un ${esc((pro.trade || "profesional").toLowerCase())} en ${esc(zonas[0] || "Sevilla")}?</h2>
    <p>Contacta con ${esc((pro.name || "").split(" ")[0])} ahora — gratis y sin compromiso.</p>
    <a class="cta" href="${ctaUrl}">💬 Contactar con ${esc((pro.name || "").split(" ")[0])} →</a>
  </div>
</div></section>

<footer><div class="wrap">
  <div class="brand">
    <img src="${LOGO_URL}" alt="OficioYa" onerror="this.style.display='none'">
    <span class="slogan">${esc(SLOGAN)}</span>
  </div>
  Perfil publicado en <a href="https://aficioya.com">OficioYa</a> — los oficios de Sevilla, a un toque.<br>
  <a href="https://aficioya.com">Ver más profesionales →</a>
</div></footer>

<div class="sticky-cta" id="stickyCta"><a class="cta" href="${ctaUrl}" style="width:100%;max-width:480px">💬 Contactar gratis →</a></div>

<script>
(function(){
  // Scroll reveal
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("visible");io.unobserve(e.target);}});},{threshold:.12,rootMargin:"0px 0px -8% 0px"});
  document.querySelectorAll(".reveal").forEach(function(el){io.observe(el);});

  // Palabras rotando en el hero
  var words=${JSON.stringify(c.words)};
  var i=0,el=document.getElementById("rotWord");
  if(el&&words.length>1&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
    setInterval(function(){i=(i+1)%words.length;var n=el.cloneNode();n.textContent=words[i];el.replaceWith(n);el=n;},2400);
  }

  // Contadores animados
  var cio=new IntersectionObserver(function(es){es.forEach(function(e){
    if(!e.isIntersecting)return;cio.unobserve(e.target);
    var t=e.target,target=parseFloat(t.dataset.count),suf=t.textContent.replace(/[0-9.,]/g,""),dec=(t.dataset.count.indexOf(".")>-1)?1:0,start=null;
    function tick(ts){if(!start)start=ts;var p=Math.min((ts-start)/900,1);p=1-Math.pow(1-p,3);t.textContent=(target*p).toFixed(dec)+suf;if(p<1)requestAnimationFrame(tick);}
    requestAnimationFrame(tick);
  });},{threshold:.5});
  document.querySelectorAll("[data-count]").forEach(function(el){cio.observe(el);});

  // CTA fijo móvil al pasar el hero
  var sticky=document.getElementById("stickyCta"),hero=document.querySelector(".hero");
  if(sticky&&hero){new IntersectionObserver(function(es){sticky.classList.toggle("show",!es[0].isIntersecting);},{threshold:0}).observe(hero);}
})();
</script>
</body>
</html>`;
}
