// api/pro.js — Web propia de cada profesional · OficioYa (rehecha el 11/11/2026)
//
//   /pro/<slug>                  → su web: diseño de la home, sello OficioYa, trabajos, opiniones y formulario
//   /pro/<slug>/opinion          → página para que sus clientes le dejen una opinión (sale al momento)
//   /sitemap-profesionales.xml   → las webs con contenido, para Google
//
// Datos: RPC oy_web_pro / oy_web_pros_lista (solo datos públicos: nunca teléfono, email ni facturación).
// Formulario → oy_lead_contacto con landing «web-pro» y su id: si el profesional está recibiendo clientes
// de OficioYa, el cliente va directo a él y se le cobra a 15 € + IVA (oy_config.precio_lead_web_pro) si tiene
// aceptadas las condiciones de su web; si no, como cualquier otro cliente suyo (pro_leads_precio_pro).
// Si no recibe clientes, lo atiende OficioYa (Admin → Leads) y no se le cobra. Opiniones → oy_opinion_enviar.
// ?prueba=1 en la web o en la página de opinión: no se envía nada (para probar).

const SUPABASE_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co";
const KEY = "sb_publishable_ReA-g1IhCfbhwMfkei7naw_BgtOs9nv";
const SITE = "https://www.aficioya.com";
const OY_TEL = "656398014";

export default async function handler(req, res) {
  const q = req.query || {};
  const vista = String(q.v || "");
  try {
    if (vista === "sitemap") return await sitemap(res);
    const slug = String(q.slug || (req.url || "").split("/pro/")[1] || "")
      .split("?")[0].split("/")[0].trim().toLowerCase();
    if (!slug) return enviar(res, 404, pagina404(), "public, s-maxage=60");
    const pro = await rpc("oy_web_pro", { p_slug: slug });
    if (!pro || !pro.id) return enviar(res, 404, pagina404(), "public, s-maxage=60");
    const prueba = String(q.prueba || "") === "1";
    if (vista === "opinion") return enviar(res, 200, paginaOpinion(datos(pro), prueba), "public, s-maxage=300, stale-while-revalidate=3600");
    return enviar(res, 200, paginaWeb(datos(pro), prueba), "public, s-maxage=60, stale-while-revalidate=600");
  } catch (e) {
    return enviar(res, 500, "Error temporal. Vuelve a intentarlo en unos minutos.", "no-store");
  }
}

function enviar(res, code, html, cache) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.status(code).send(html);
}

async function rpc(fn, args) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) throw new Error("rpc " + fn + " " + r.status);
  return r.json();
}

async function sitemap(res) {
  const lista = await rpc("oy_web_pros_lista", {});
  const urls = (Array.isArray(lista) ? lista : []).filter((x) => x && x.slug).map((x) =>
    `<url><loc>${SITE}/pro/${esc(x.slug)}</loc>${x.actualizado ? `<lastmod>${String(x.actualizado).slice(0, 10)}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.6</priority></url>`);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
}

// ── utilidades ──────────────────────────────────────────────
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const sinTildes = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesAnio = (d) => { const f = new Date(d); return isNaN(f) ? "" : MESES[f.getMonth()] + " de " + f.getFullYear(); };
const MENORES = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "do", "dos", "van", "von"]);
const bonito = (n) => String(n || "").trim().split(/\s+/).map((w, i) => {
  const l = w.toLocaleLowerCase("es");
  if (i > 0 && MENORES.has(l)) return l;
  return l.split("-").map((p) => p.charAt(0).toLocaleUpperCase("es") + p.slice(1)).join("-");
}).join(" ");
const capital = (s) => { const t = String(s || "").trim(); return t.charAt(0).toLocaleUpperCase("es") + t.slice(1); };
// «Cuadros eléctricos» → «cuadros eléctricos», pero «LED y luces» o «Cargadores VE» no se tocan
const minus1 = (s) => { const t = String(s || "").trim(); return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]/.test(t) ? t.charAt(0).toLocaleLowerCase("es") + t.slice(1) : t; };
const CIUDADES = { sevilla: "Sevilla", valencia: "Valencia", madrid: "Madrid", cordoba: "Córdoba", malaga: "Málaga", granada: "Granada", cadiz: "Cádiz", huelva: "Huelva", jaen: "Jaén", almeria: "Almería", barcelona: "Barcelona", bilbao: "Bilbao", zaragoza: "Zaragoza", alicante: "Alicante", murcia: "Murcia" };
const GRANDES = Object.values(CIUDADES);

function familia(oficio) {
  const s = sinTildes(oficio);
  if (/electr/.test(s)) return "electr";
  if (/fontan|desatasc/.test(s)) return "fontan";
  if (/pint/.test(s)) return "pint";
  if (/cerraj/.test(s)) return "cerraj";
  if (/clima|aire|calefac/.test(s)) return "clima";
  if (/reform|alban|obra/.test(s)) return "reform";
  return "otro";
}
const PERSONA = { electr: "electricista", fontan: "fontanero", pint: "pintor", cerraj: "cerrajero", clima: "técnico de climatización", reform: "profesional de reformas" };
const TIPO_LD = { electr: "Electrician", fontan: "Plumber", pint: "HousePainter", cerraj: "Locksmith", clima: "HVACBusiness", reform: "GeneralContractor" };

// Opciones del formulario según el oficio: [título, detalle, icono]
const NECESIDADES = {
  electr: [["Avería", "Algo no funciona", "zap"], ["Instalación", "Nueva o ampliación", "plug"], ["Cuadro eléctrico", "Cambio o boletín", "panel"], ["Iluminación LED", "Interior o exterior", "bulb"]],
  fontan: [["Fuga de agua", "Gotea o sale agua", "drop"], ["Atasco", "Fregadero, váter o ducha", "swirl"], ["Grifo o cisterna", "Cambio o reparación", "wrench"], ["Instalación", "Baño, cocina o tuberías", "home"]],
  pint: [["Piso completo", "Paredes y techos", "roller"], ["Habitaciones", "Una o varias", "door"], ["Fachada", "Exterior o patio", "building"], ["Alisar paredes", "Quitar gotelé", "brush"]],
  cerraj: [["Apertura", "Puerta cerrada", "key"], ["Cerradura", "Cambio o reparación", "lock"], ["Bombín", "De seguridad", "shield"], ["Otro trabajo", "Persiana, cierre…", "wrench"]],
  clima: [["Instalación", "Aire acondicionado", "snow"], ["Avería", "No enfría o no calienta", "zap"], ["Mantenimiento", "Limpieza y revisión", "wrench"], ["Otro trabajo", "Cuéntaselo al hablar", "chat"]],
  reform: [["Baño", "Reforma o plato de ducha", "drop"], ["Cocina", "Completa o parcial", "home"], ["Piso completo", "Reforma integral", "building"], ["Otro trabajo", "Albañilería y más", "wrench"]],
  otro: [["Reparación", "Algo no funciona", "wrench"], ["Instalación", "Algo nuevo", "plug"], ["Presupuesto", "Para un trabajo", "doc"], ["Otro trabajo", "Cuéntaselo al hablar", "chat"]],
};
// Trabajos típicos por oficio (solo si el profesional no ha puesto sus especialidades)
const TIPICOS = {
  electr: ["Averías eléctricas", "Instalaciones nuevas", "Cuadros eléctricos", "Iluminación LED", "Boletines", "Reformas eléctricas"],
  fontan: ["Fugas de agua", "Desatascos", "Grifos y cisternas", "Termos", "Cambio de bañera por plato", "Tuberías"],
  pint: ["Pintura de pisos", "Habitaciones", "Fachadas", "Quitar gotelé y alisar", "Lacado de puertas", "Humedades y moho"],
  cerraj: ["Apertura de puertas", "Cambio de cerraduras", "Bombines de seguridad", "Puertas blindadas", "Persianas", "Cierres de local"],
  clima: ["Instalación de aire acondicionado", "Averías", "Mantenimiento", "Calefacción"],
  reform: ["Reformas de baño", "Reformas de cocina", "Pisos completos", "Locales", "Albañilería"],
  otro: [],
};

function iconoDe(t) {
  const s = sinTildes(t);
  if (/cuadro|boletin|diferencial|esquema/.test(s)) return "panel";
  if (/led|ilumin|luz|luces|lumin|lampar/.test(s)) return "bulb";
  if (/cargador|\bve\b|vehicul|coche/.test(s)) return "car";
  if (/averia|urgenc|solar|fotovolt|placa/.test(s)) return "zap";
  if (/domotic|automat/.test(s)) return "home";
  if (/mantenim|revision/.test(s)) return "wrench";
  if (/industri|nave|local|oficina|comunidad|garaje/.test(s)) return "factory";
  if (/atasco|desatasc/.test(s)) return "swirl";
  if (/fuga|agua|humedad|bano|ducha|banera|plato|cisterna|grifo|tuberi|bajante|termo/.test(s)) return "drop";
  if (/pint|gotele|alisa|fachada|lacad|barniz|papel|moho|imperme/.test(s)) return "roller";
  if (/cerradur|bombin|apertura|llave|puerta|blindad/.test(s)) return "key";
  if (/aire|clima|calefac|frio/.test(s)) return "snow";
  if (/reforma|cocina|alban|obra|piso/.test(s)) return "building";
  return "check";
}

// ── iconos (trazo, 24×24) ───────────────────────────────────
const IC = {
  zap: '<path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2z"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/>',
  panel: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7v4M12 7v4M16 7v4M8 16h8"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  car: '<path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4z"/><path d="m2 22 3-3"/><path d="M7.5 13.5 10 11"/><path d="M10.5 16.5 13 14"/><path d="m18 3-4 4h6l-4 4"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 15a3.5 3.5 0 0 1 5 0"/><path d="M12 18h.01"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M17 18h1M12 18h1M7 18h1"/>',
  drop: '<path d="M12 2.7c-3.3 4.1-6 7.6-6 11a6 6 0 0 0 12 0c0-3.4-2.7-6.9-6-11z"/>',
  swirl: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M12 11a1 1 0 1 0 1 1"/>',
  roller: '<rect x="3" y="3" width="15" height="6" rx="2"/><path d="M18 6h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-8v3"/><rect x="10" y="14" width="4" height="7" rx="1"/>',
  door: '<path d="M4 21V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v17"/><path d="M2 21h20"/><path d="M15 12h.01"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  brush: '<path d="M18.4 2.6 14 7l-1.6-1.6a2 2 0 0 0-2.8 0L8 7l9 9 1.6-1.6a2 2 0 0 0 0-2.8L17 10l4.4-4.4a2.1 2.1 0 1 0-3-3z"/><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  snow: '<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9"/>',
  doc: '<path d="M6.5 3.5h8l4 4v13h-12z"/><path d="M14.5 3.5v4h4M9.5 12h6M9.5 15.5h6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9"/><path d="M4 14h9"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  hammer: '<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const svg = (k, s = 20, w = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k] || IC.check}</svg>`;
const STAR = '<path fill="currentColor" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/>';
const estrella = (s = 17) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`;
const estrellas = (n, s = 17) => `<span class="stars" role="img" aria-label="${n} de 5 estrellas">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= Math.round(n) ? "on" : "off"}">${estrella(s)}</span>`).join("")}</span>`;

function sello(id, cls) {
  return `<svg class="${cls || "seal"}" viewBox="0 0 160 160" role="img" aria-label="Sello OficioYa: profesional verificado">
<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD700"/><stop offset="1" stop-color="#FF8C00"/></linearGradient>
<path id="${id}p" d="M80 80m-60 0a60 60 0 1 1 120 0a60 60 0 1 1-120 0"/></defs>
<circle cx="80" cy="80" r="78" fill="#12141B" stroke="rgba(255,215,0,.6)" stroke-width="1.5"/>
<circle cx="80" cy="80" r="48" fill="none" stroke="rgba(255,215,0,.35)" stroke-width="1" stroke-dasharray="2 3"/>
<g class="seal-ring"><text style="font:800 11px 'DM Sans',sans-serif;letter-spacing:2px;fill:#FFD200"><textPath href="#${id}p" textLength="370" lengthAdjust="spacing">PROFESIONAL VERIFICADO · OFICIOYA · ${new Date().getFullYear()} ·</textPath></text></g>
<circle cx="80" cy="80" r="40" fill="url(#${id}g)"/>
<g transform="translate(56 56) scale(2)" fill="none" stroke="#1A1200" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC.hammer}</g>
</svg>`;
}

// Fondo decorativo según el oficio (como en la home): cable (electricidad), tubería (fontanería), rodillo (pintura)
function fondo(fam) {
  const glow = '<div class="glow"></div>';
  if (fam === "pint") return `<div class="deco" aria-hidden="true">${glow}<div class="band"><div class="paint"></div><div class="roller"></div></div></div>`;
  const d = fam === "fontan"
    ? "M -40 980 H 300 Q 340 980 340 940 V 690 Q 340 650 380 650 H 860 Q 900 650 900 610 V 470 Q 900 430 940 430 H 1160 Q 1200 430 1200 390 V 200 Q 1200 160 1240 160 H 1500"
    : "M -60 1010 C 260 1010 300 820 560 800 S 900 860 1040 640 S 1180 300 1500 250";
  return `<div class="deco" aria-hidden="true">${glow}<svg class="cable${fam === "fontan" ? " agua" : ""}" viewBox="0 0 1440 1150" preserveAspectRatio="xMaxYMin slice"><path class="c0" d="${d}"/><path class="c1" d="${d}"/><path class="c2" d="${d}"/></svg></div>`;
}

// ── datos de la web a partir del RPC ────────────────────────
function datos(p) {
  const fam = familia(p.oficio);
  const nombre = bonito(p.nombre);
  const corto = nombre.split(" ")[0] || nombre;
  const empresa = p.empresa ? String(p.empresa).trim() : "";
  const marca = empresa || nombre;
  const zonasRaw = Array.from(new Set((p.zonas || []).map((z) => String(z || "").trim()).filter(Boolean)));
  let ciudad = p.ciudad ? (CIUDADES[p.ciudad] || bonito(String(p.ciudad).replace(/-/g, " "))) : (p.zona ? String(p.zona).trim() : "");
  if (!ciudad) ciudad = zonasRaw.find((z) => GRANDES.includes(z)) || zonasRaw[0] || "Sevilla";
  const zonas = [ciudad].concat(zonasRaw.filter((z) => sinTildes(z) !== sinTildes(ciudad)).sort((a, b) => a.localeCompare(b, "es")));
  const horarioItems = String(p.horario || "").split("|").map((s) => s.trim()).filter(Boolean);
  const urgencias = horarioItems.some((s) => /urgenc/i.test(s));
  const horario = horarioItems.find((s) => /todos los d/i.test(s)) || horarioItems.find((s) => !/urgenc/i.test(s)) || "";
  const rt = String(p.respuesta || "").trim();
  const respuesta = /mismo d/i.test(rt) ? "el mismo día" : /^24\s*h|24 horas/i.test(rt) ? "en 24 horas" : /^1\s*h/i.test(rt) ? "en 1 hora" : rt ? rt.toLowerCase() : "";
  const especialidades = (p.especialidades || []).map((s) => String(s || "").trim()).filter(Boolean).slice(0, 8);
  const propias = especialidades.length >= 2;
  const servicios = propias ? especialidades : (TIPICOS[fam] || []);
  // Presentación: si es una lista de cosas cortas, se enseña como «También hace»; si no, como texto
  const bio = String(p.bio || "").trim();
  const lineas = bio.split(/\n+|\.\s+(?=[A-ZÁÉÍÓÚÑ])/).map((s) => s.replace(/\.$/, "").trim()).filter((s) => s.length >= 3);
  const esLista = lineas.length >= 4 && lineas.filter((s) => s.length <= 42).length >= lineas.length * 0.7;
  const yaEsta = (s) => servicios.some((e) => sinTildes(e).includes(sinTildes(s)) || sinTildes(s).includes(sinTildes(e)));
  const tambien = esLista ? Array.from(new Set(lineas.map(capital))).filter((s) => !yaEsta(s)).slice(0, 12) : [];
  const fotos = (p.fotos || []).filter((f) => f && f.url).slice(0, 12).map((f) => ({ url: f.url, titulo: capital(String(f.titulo || "").trim()) }));
  const opiniones = (p.opiniones || []).filter((o) => o && o.texto).map((o) => ({ nombre: bonito(o.nombre || "Cliente"), estrellas: Number(o.estrellas) || 5, texto: String(o.texto).trim(), fecha: o.fecha }));
  const n = Number(p.n_opiniones) || opiniones.length;
  const nota = Number(p.nota) || 0;
  const exp = Number(p.experiencia) || 0;
  const so = sinTildes(p.oficio);
  const persona = PERSONA[fam] || (/manitas/.test(so) ? "manitas" : /limpieza|domestic/.test(so) ? "profesional de limpieza" : String(p.oficio || "profesional").trim().toLowerCase());
  const rico = !!(p.verificado || bio.length >= 40 || fotos.length || n || especialidades.length >= 3);
  return { id: p.id, slug: p.slug, fam, nombre, corto, empresa, marca, ciudad, zonas, urgencias, horario, respuesta, especialidades, propias, servicios,
    bio: esLista ? "" : bio, tambien, fotos, opiniones, n, nota, exp, persona, oficio: String(p.oficio || "Profesional").trim(),
    verificado: !!p.verificado, gratis: p.presupuesto_gratis !== false, disponible: p.disponible !== false, logo: p.logo || "", desde: p.desde, rico };
}

// ── CSS común (mismo diseño que la home: DM Sans, fondo oscuro, dorado) ──
const CSS_BASE = `
:root{--ink:#F2F5FA;--ink2:#B4BCCB;--ink3:#96A0B3;--soft:#C9D1DF;--gold:#FFD700;--gold2:#FFD200;--warn:#FFC94D;--green:#00D68F;--mint:#7DF0C4;--btn:linear-gradient(135deg,#FFFFFF 0%,#F0E6C0 45%,#FFD700 100%);--grad:linear-gradient(135deg,#FFD700,#FF8C00);--spring:cubic-bezier(.34,1.56,.64,1)}
*{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;background:radial-gradient(1100px 700px at 88% -12%,rgba(255,184,0,.14),rgba(255,184,0,0) 62%),linear-gradient(180deg,#11131A 0%,#0D0F15 55%,#0A0B10 100%);background-color:#0F1117;color:#E8EDF5;font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5;overflow-x:clip}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
button,input,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
[hidden]{display:none!important}
.glass{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.11);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 40px 80px -40px rgba(0,0,0,.9);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%)}
.dark{background:rgba(14,16,23,.82);border:1px solid rgba(255,255,255,.13);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 40px 90px -36px rgba(0,0,0,.95),0 12px 28px -16px rgba(0,0,0,.7);-webkit-backdrop-filter:blur(26px) saturate(150%);backdrop-filter:blur(26px) saturate(150%)}
.stars{display:inline-flex;gap:2px;color:var(--gold)}
.stars .off{color:rgba(255,255,255,.22)}
.stars span{display:inline-flex}
.oy-ic{width:26px;height:26px;border-radius:8px;background:var(--grad);color:#1A1200;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:inset 0 1px 0 rgba(255,255,255,.45)}
.oy-w{font-weight:900;color:var(--ink);letter-spacing:-.01em}
.oy-w span{color:var(--gold)}
.prueba{margin:0 0 14px;padding:8px 12px;border-radius:12px;background:rgba(154,219,255,.1);border:1px solid rgba(154,219,255,.35);color:#BFE7FF;font-size:12.5px;font-weight:700}
.lbl{margin:18px 0 10px;font-size:11px;font-weight:800;letter-spacing:.12em;color:#A9B1C2;text-transform:uppercase}
.fld{display:block}
.fld span{display:block;margin-bottom:6px;font-size:12px;color:#A9B1C2;font-weight:600}
.inp{display:block;width:100%;height:50px;padding:0 16px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:var(--ink);font-size:16px;outline:none}
.inp::placeholder{color:#7F889A}
.inp:focus{border-color:rgba(255,200,0,.7);box-shadow:0 0 0 3px rgba(255,200,0,.15)}
.terms{display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:12.5px;line-height:1.45;color:var(--ink2);cursor:pointer}
.terms input{margin:2px 0 0;width:16px;height:16px;flex:0 0 16px;accent-color:#FFD200}
.terms a{color:#FFE38A;text-decoration:underline}
.btn{width:100%;height:56px;margin-top:14px;border:none;border-radius:18px;background:var(--btn);color:#1A1200;font-size:16px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 18px 40px -16px rgba(255,200,0,.75),inset 0 -2px 0 rgba(0,0,0,.08)}
.btn[disabled]{opacity:.7;cursor:wait}
.note{margin:10px 0 0;text-align:center;font-size:12.5px;line-height:1.45;color:var(--ink3)}
.msg{margin:10px 0 0;font-size:13.5px;font-weight:700;color:#FFB4B4;min-height:0}
.trampa{position:absolute!important;left:-9999px;width:1px;height:1px;opacity:0}
.big{width:74px;height:74px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,214,143,.14);border:1px solid rgba(0,214,143,.45);color:var(--mint)}
.oyb{display:inline-flex;align-items:center;gap:10px;padding:7px 14px 7px 7px;border-radius:14px;background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.22);color:var(--soft);font-size:13px;font-weight:700}
.seal-ring{transform-origin:80px 80px;animation:spin 30s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}html{scroll-behavior:auto}}
`;

const CSS_WEB = `
.wrap{max-width:1200px;margin:0 auto;padding:0 32px}
.deco{position:absolute;left:0;right:0;top:0;height:1150px;pointer-events:none;z-index:0;overflow:hidden}
.glow{position:absolute;top:-300px;right:-240px;width:1000px;height:1000px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,0,.24),rgba(255,140,0,.09) 40%,rgba(255,140,0,0) 68%)}
.cable{position:absolute;inset:0;width:100%;height:100%}
.cable path{fill:none;stroke-linecap:round;stroke-linejoin:round}
.cable .c0{stroke:rgba(255,255,255,.045);stroke-width:22}
.cable .c1{stroke:rgba(255,184,0,.26);stroke-width:4}
.cable .c2{stroke:#FFF1A8;stroke-width:5;stroke-dasharray:46 2300;animation:spark 5.5s linear infinite}
.cable.agua .c1{stroke:rgba(255,184,0,.3);stroke-width:9}
.cable.agua .c2{stroke:#9ADBFF;stroke-width:6;stroke-dasharray:14 70}
@keyframes spark{from{stroke-dashoffset:2346}to{stroke-dashoffset:0}}
.band{position:absolute;left:-12%;top:30%;width:124%;height:30vh;max-height:300px;transform:rotate(-8deg)}
.paint{position:absolute;inset:0;transform-origin:0 50%;border-radius:0 80px 80px 0;opacity:.22;background:repeating-linear-gradient(90deg,rgba(255,255,255,.14) 0 2px,rgba(255,255,255,0) 2px 9px),linear-gradient(90deg,#FF8C00 0%,#FFB800 45%,#FFD700 100%);animation:pinta 2.4s cubic-bezier(.2,.8,.2,1) both}
.roller{position:absolute;top:-3vh;bottom:-3vh;right:-13px;width:26px;border-radius:13px;background:linear-gradient(90deg,#E9E2D3,#fff 40%,#D4CCBC);box-shadow:0 24px 50px -12px rgba(0,0,0,.7);opacity:.85}
@keyframes pinta{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.nav{position:sticky;top:12px;z-index:50;padding:0 24px}
.nav-in{max-width:1200px;margin:12px auto 0;height:68px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 10px 0 12px;border-radius:20px;background:rgba(15,17,23,.7);border:1px solid rgba(255,255,255,.10);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 20px 40px -24px rgba(0,0,0,.85);-webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%)}
.brand{display:flex;align-items:center;gap:11px;min-width:0;flex:0 1 auto}
.brand img,.brand .ini{width:46px;height:46px;flex:0 0 46px;border-radius:12px;object-fit:cover;box-shadow:0 0 0 1px rgba(255,215,0,.35),0 8px 18px -8px rgba(255,170,0,.6)}
.ini{display:flex;align-items:center;justify-content:center;background:var(--grad);color:#1A1200;font-weight:900;font-size:17px}
.brand-tx{display:flex;flex-direction:column;line-height:1.15;min-width:0}
.brand-tx b{font-size:17px;font-weight:900;letter-spacing:-.02em;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand-tx small{font-size:12px;font-weight:600;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nav-links{display:flex;gap:2px}
.nav-links a{padding:10px 13px;border-radius:12px;color:var(--soft);font-size:14px;font-weight:600}
.nav-links a:hover{background:rgba(255,255,255,.06);color:#fff}
.nav-r{display:flex;align-items:center;gap:10px;flex:0 0 auto}
.oy-mini{display:inline-flex;align-items:center;gap:8px;padding:6px 11px 6px 6px;border-radius:12px;background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.22);font-size:12.5px;font-weight:700;color:var(--soft);white-space:nowrap}
.btn-s{display:inline-flex;align-items:center;height:44px;padding:0 16px;border-radius:14px;background:var(--btn);color:#1A1200;font-size:14px;font-weight:800;white-space:nowrap;box-shadow:0 10px 24px -12px rgba(255,200,0,.8)}
main,footer{position:relative;z-index:1}
.hero{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:44px;align-items:center;padding-top:52px;padding-bottom:10px}
.pill{display:inline-flex;align-items:center;gap:9px;margin:0;padding:7px 13px 7px 11px;border-radius:999px;background:rgba(0,214,143,.08);border:1px solid rgba(0,214,143,.3);color:var(--mint);font-size:12.5px;font-weight:700}
.pill.neutro{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.14);color:var(--soft)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green);flex:0 0 auto;animation:pulse 2.4s ease-out infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(0,214,143,.45)}70%{box-shadow:0 0 0 9px rgba(0,214,143,0)}100%{box-shadow:0 0 0 0 rgba(0,214,143,0)}}
.hero h1{margin:22px 0 0;font-size:clamp(38px,4.5vw,64px);line-height:1.02;letter-spacing:-.04em;font-weight:900;color:var(--ink)}
.hero h1 span{display:block;color:var(--gold2);text-shadow:0 0 46px rgba(255,170,0,.35)}
.sub{margin:22px 0 0;max-width:540px;font-size:clamp(16px,1.35vw,19px);line-height:1.6;color:var(--ink2)}
.tchips{display:flex;flex-wrap:wrap;gap:10px;margin:26px 0 0;padding:0;list-style:none}
.tchips li{display:flex;align-items:center;gap:8px;padding:10px 13px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);font-size:13.5px;font-weight:600;color:#D5DBE6}
.tchips svg{color:var(--gold)}
.rate{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;margin-top:26px;font-size:14px;color:var(--ink2)}
.rate b{font-size:18px;font-weight:900;color:var(--ink)}
.rate a{color:#FFE38A;font-weight:700;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(255,227,138,.45)}
.hv{position:relative;min-height:800px}
.photo{position:absolute;top:0;left:0;right:0;height:590px;border-radius:36px;overflow:hidden;background:#1A1D26;box-shadow:0 60px 120px -50px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.10)}
.photo img{width:100%;height:100%;object-fit:cover;object-position:50% 42%}
.photo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,11,16,0) 40%,rgba(10,11,16,.6))}
.photo.logo{display:flex;align-items:flex-start;justify-content:center;padding-top:70px;background:radial-gradient(420px 320px at 50% 30%,rgba(255,200,0,.22),rgba(255,200,0,0)),linear-gradient(160deg,#1C1F29,#12141B)}
.photo.logo::after{display:none}
.photo.logo img,.photo.logo .ini{width:150px;height:150px;border-radius:36px;object-fit:cover;font-size:54px;box-shadow:0 0 0 1px rgba(255,215,0,.35),0 30px 60px -20px rgba(0,0,0,.8)}
.fl{position:absolute;z-index:4}
.fchip{display:flex;align-items:center;gap:10px;padding:10px 14px 10px 10px;border-radius:18px;background:rgba(14,16,23,.72);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 24px 50px -20px rgba(0,0,0,.85);-webkit-backdrop-filter:blur(18px) saturate(150%);backdrop-filter:blur(18px) saturate(150%);animation:bob 5s ease-in-out infinite alternate}
.fchip small{display:block;font-size:11px;color:#A9B1C2;font-weight:600}
.fchip b{display:block;font-size:15px;font-weight:800;color:var(--ink)}
.fchip img,.fchip .ini{width:40px;height:40px;flex:0 0 40px;border-radius:11px;object-fit:cover;font-size:15px}
.fic{width:40px;height:40px;flex:0 0 40px;border-radius:12px;background:var(--grad);color:#1A1200;display:flex;align-items:center;justify-content:center}
@keyframes bob{from{transform:translateY(-8px)}to{transform:translateY(8px)}}
.fa{top:22px;left:-26px}
.fb{top:330px;right:-22px}
.fb .fchip{animation-delay:-2.4s}
.seal-hero{position:absolute;z-index:4;top:-36px;right:-28px;width:136px;height:136px;filter:drop-shadow(0 20px 30px rgba(0,0,0,.6))}
.seal{display:block;width:100%;height:100%}
.card{position:relative;z-index:3;width:410px;max-width:100%;margin-top:200px;border-radius:28px;padding:24px;scroll-margin-top:96px}
.ft{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ft h2{margin:0;font-size:21px;font-weight:900;letter-spacing:-.02em;line-height:1.15;color:var(--ink)}
.tag-ok{font-size:11px;font-weight:800;color:var(--mint);padding:4px 9px;border-radius:999px;background:rgba(0,214,143,.1);border:1px solid rgba(0,214,143,.3);white-space:nowrap}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tile{display:flex;align-items:center;gap:10px;min-height:64px;padding:10px 12px;text-align:left;cursor:pointer;color:var(--ink);border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);transition:all .45s var(--spring)}
.tile .ic{width:36px;height:36px;flex:0 0 36px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.07);color:var(--gold)}
.tile b{display:block;font-size:14.5px;font-weight:800;line-height:1.2}
.tile small{display:block;margin-top:2px;font-size:11.5px;color:#A9B1C2;font-weight:500}
.tile[aria-pressed="true"]{border-radius:20px;background:linear-gradient(160deg,rgba(255,215,0,.2),rgba(255,140,0,.08));border-color:rgba(255,200,0,.62);box-shadow:0 18px 40px -18px rgba(255,160,0,.65),inset 0 1px 0 rgba(255,255,255,.14)}
.tile[aria-pressed="true"] .ic{background:var(--grad);color:#1A1200}
.seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:5px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.seg button{min-height:44px;border:none;border-radius:12px;background:transparent;color:var(--soft);font-weight:800;font-size:13.5px;cursor:pointer;transition:all .4s var(--spring)}
.seg button[aria-pressed="true"]{background:rgba(255,200,0,.16);color:#FFE38A;box-shadow:inset 0 0 0 1px rgba(255,200,0,.55)}
.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.done{text-align:center;padding:22px 6px 6px}
.done h3{margin:18px 0 8px;font-size:22px;font-weight:900;letter-spacing:-.02em;color:var(--ink)}
.done p{margin:0;font-size:15px;line-height:1.55;color:var(--ink2)}
.link{margin-top:14px;background:none;border:0;padding:6px;color:#FFE38A;font-weight:800;text-decoration:underline;cursor:pointer;font-size:14px}
.s{padding-top:110px;scroll-margin-top:90px}
.head{max-width:760px}
.eyebrow{margin:0;font-size:12px;font-weight:800;letter-spacing:.16em;color:var(--warn)}
.h{margin:12px 0 0;font-size:clamp(30px,3.5vw,50px);line-height:1.05;letter-spacing:-.035em;font-weight:900;color:var(--ink)}
.lead{margin:14px 0 0;font-size:17px;line-height:1.55;color:var(--ink2)}
.gal{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:206px;grid-auto-flow:dense;gap:16px;margin-top:40px}
.gal.pocas{grid-template-columns:repeat(var(--n),minmax(0,1fr));grid-auto-rows:420px}
.gi{position:relative;display:block;width:100%;height:100%;padding:0;border:0;border-radius:24px;overflow:hidden;background:#1A1D26;cursor:zoom-in;box-shadow:0 30px 60px -36px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.08)}
.gi img{width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.8,.2,1)}
.gi:hover img{transform:scale(1.05)}
.gi::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,11,16,0) 55%,rgba(10,11,16,.72))}
.gcap{position:absolute;z-index:1;left:14px;right:14px;bottom:14px;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:#fff;text-align:left}
.gcap i{width:26px;height:26px;flex:0 0 26px;border-radius:8px;background:rgba(255,215,0,.16);border:1px solid rgba(255,215,0,.4);color:var(--gold);display:inline-flex;align-items:center;justify-content:center}
.g-a{grid-column:span 2;grid-row:span 2}
.g-b{grid-row:span 2}
.gal.pocas .gi{grid-column:auto;grid-row:auto}
.lb{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;gap:12px;padding:16px;background:rgba(6,7,10,.94);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.lb-img{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center}
.lb-img img{max-height:100%;max-width:100%;object-fit:contain;border-radius:18px}
.lb-bar{display:flex;align-items:center;gap:10px;max-width:900px;width:100%;margin:0 auto}
.lb-cap{flex:1 1 auto;min-width:0;font-size:16px;font-weight:800;color:var(--ink)}
.lb-num{font-size:13px;font-weight:700;color:var(--ink3)}
.lb-btn{width:46px;height:46px;flex:0 0 46px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.svc{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:40px}
.sc{display:flex;flex-direction:column;gap:16px;padding:22px;border-radius:24px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
.si{width:46px;height:46px;flex:0 0 46px;border-radius:14px;background:var(--grad);color:#1A1200;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px -12px rgba(255,170,0,.8)}
.sc h3{margin:0;font-size:17.5px;font-weight:800;letter-spacing:-.01em;line-height:1.25;color:var(--ink)}
.also{background:linear-gradient(160deg,rgba(255,215,0,.09),rgba(255,140,0,.03));border:1px dashed rgba(255,200,0,.45);grid-column:1/-1;flex-direction:row;align-items:flex-start}
.also .si{background:rgba(255,215,0,.12);color:var(--gold);box-shadow:none;border:1px solid rgba(255,215,0,.35)}
.also ul{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.also li{font-size:12.5px;font-weight:700;color:#FFE38A;padding:5px 9px;border-radius:999px;background:rgba(255,200,0,.10);border:1px solid rgba(255,200,0,.28)}
.sobre{margin-top:16px;padding:24px;border-radius:24px;font-size:16px;line-height:1.65;color:var(--ink2);white-space:pre-line}
.sobre b{display:block;margin-bottom:8px;font-size:12px;letter-spacing:.14em;color:var(--warn);text-transform:uppercase}
.rev{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:20px;margin-top:40px;align-items:start}
.score{padding:28px;border-radius:28px}
.bigs{display:flex;align-items:center;gap:16px;margin-top:6px}
.bigs b{font-size:76px;font-weight:900;letter-spacing:-.04em;line-height:1;color:var(--gold2);text-shadow:0 0 40px rgba(255,170,0,.3)}
.cnt{margin:6px 0 0;font-size:14px;color:var(--ink2)}
.bars{margin-top:20px;display:grid;gap:9px}
.bar{display:grid;grid-template-columns:14px minmax(0,1fr) 22px;align-items:center;gap:10px;font-size:13px;font-weight:700;color:var(--ink3)}
.bar i{display:block;height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.bar i span{display:block;height:100%;border-radius:99px;background:var(--grad)}
.mod{margin:20px 0 0;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5;color:var(--ink3)}
.mod svg{flex:0 0 auto;color:var(--mint);margin-top:1px}
.rlist{display:grid;gap:14px}
.rcard{margin:0;padding:26px 28px;border-radius:26px}
.rq{color:rgba(255,215,0,.4)}
.rcard blockquote{margin:12px 0 0;font-size:clamp(18px,1.7vw,24px);line-height:1.38;font-weight:700;letter-spacing:-.01em;color:var(--ink)}
.rcard.primera blockquote{font-size:clamp(21px,2.2vw,30px)}
.who{display:flex;align-items:center;gap:12px;margin-top:18px}
.who .av{width:44px;height:44px;flex:0 0 44px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:17px;color:var(--gold)}
.who b{display:block;font-size:15.5px;color:var(--ink)}
.who small{display:block;font-size:13px;color:var(--ink3)}
.mas{justify-self:start;min-height:44px;padding:0 16px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:var(--ink);font-size:14px;font-weight:800;cursor:pointer}
.leave{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:20px;padding:18px 18px 18px 22px;border-radius:22px;border:1px dashed rgba(255,255,255,.18);color:var(--ink2);font-size:15px}
.btn-g{min-height:44px;padding:0 16px;border-radius:14px;background:rgba(255,200,0,.12);border:1px solid rgba(255,200,0,.55);color:#FFE38A;font-size:14px;font-weight:800;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
.zg{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:40px;align-items:start}
.zchips{list-style:none;margin:28px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.zchips li{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.11);font-size:13.5px;font-weight:600;color:var(--soft)}
.zchips li.zm{background:rgba(255,200,0,.14);border-color:rgba(255,200,0,.55);color:#FFE38A;font-weight:800}
.info{padding:24px 24px 14px;border-radius:28px}
.info h3{margin:0 0 4px;font-size:18px;font-weight:800;color:var(--ink)}
.irow{display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid rgba(255,255,255,.08)}
.irow:first-of-type{border-top:0}
.ii{width:40px;height:40px;flex:0 0 40px;border-radius:12px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.25);color:var(--gold);display:flex;align-items:center;justify-content:center}
.irow small{display:block;font-size:12px;color:var(--ink3);font-weight:600}
.irow b{display:block;font-size:15.5px;color:var(--ink);font-weight:800}
.trust{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:56px;align-items:center}
.sealbox{display:flex;align-items:center;justify-content:center;width:100%;max-width:420px;aspect-ratio:1/1;margin:0 auto;border-radius:50%;background:radial-gradient(closest-side,rgba(255,200,0,.2),rgba(255,200,0,0))}
.sealbox svg{width:76%;height:76%;filter:drop-shadow(0 30px 50px rgba(0,0,0,.6))}
.tlist{list-style:none;padding:0;margin:26px 0 0;display:grid;gap:12px}
.tlist li{display:flex;gap:14px;align-items:flex-start;padding:16px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.tic{flex:0 0 40px;width:40px;height:40px;border-radius:13px;background:var(--grad);color:#1A1200;display:flex;align-items:center;justify-content:center}
.tlist strong{display:block;font-size:16px;color:var(--ink)}
.tlist em{display:block;margin-top:4px;font-style:normal;font-size:14px;line-height:1.5;color:var(--ink2)}
.steps{list-style:none;margin:40px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.steps li{padding:24px;border-radius:26px}
.num{width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:var(--gold);background:rgba(255,255,255,.05);border:1px solid rgba(255,200,0,.5)}
.steps h3{margin:18px 0 8px;font-size:19px;font-weight:800;letter-spacing:-.01em;color:var(--ink)}
.steps p{margin:0;font-size:14.5px;line-height:1.55;color:var(--ink2)}
.cta{position:relative;overflow:hidden;margin:110px 0 56px;border-radius:40px;padding:60px 40px;text-align:center}
.cta::before{content:"";position:absolute;left:50%;top:100%;width:900px;height:520px;transform:translate(-50%,-52%);border-radius:50%;background:radial-gradient(closest-side,rgba(255,200,0,.3),rgba(255,200,0,0));pointer-events:none}
.cta .lg,.cta .ini{position:relative;width:78px;height:78px;border-radius:20px;margin:0 auto 20px;object-fit:cover;font-size:28px;box-shadow:0 0 0 1px rgba(255,215,0,.35),0 16px 34px -12px rgba(255,170,0,.6)}
.cta h2{position:relative;margin:0;font-size:clamp(32px,4.2vw,60px);font-weight:900;letter-spacing:-.04em;line-height:1.04;color:var(--ink)}
.cta p{position:relative;margin:14px auto 0;max-width:520px;font-size:17px;line-height:1.55;color:var(--ink2)}
.bp{position:relative;display:inline-flex;align-items:center;gap:10px;height:62px;padding:0 30px;margin-top:28px;border-radius:22px;background:var(--btn);color:#1A1200;font-size:17px;font-weight:800;box-shadow:0 20px 44px -18px rgba(255,200,0,.8)}
footer{border-top:1px solid rgba(255,255,255,.08)}
.foot{display:flex;flex-wrap:wrap;gap:18px 26px;align-items:center;justify-content:space-between;max-width:1200px;margin:0 auto;padding:28px 32px 44px;color:var(--ink3);font-size:13px}
.flogo{display:flex;align-items:center;gap:10px;color:#E8EDF5;min-width:0}
.flogo img,.flogo .ini{width:34px;height:34px;flex:0 0 34px;border-radius:9px;object-fit:cover;font-size:13px}
.flogo b{display:block;font-weight:900;font-size:16px;letter-spacing:-.02em}
.flogo small{display:block;font-size:12px;color:var(--ink3)}
.fnav{display:flex;gap:18px;flex-wrap:wrap}
.fnav a{color:var(--ink2)}
.mbar{display:none;position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:60;transform:translateY(160%);transition:transform .45s var(--spring)}
.mbar.ver{transform:none}
.mbar a{display:flex;align-items:center;justify-content:center;gap:10px;height:56px;border-radius:18px;background:var(--btn);color:#1A1200;font-size:16px;font-weight:800;box-shadow:0 18px 40px -12px rgba(0,0,0,.8),0 10px 30px -14px rgba(255,200,0,.7)}
@media (max-width:980px){
  .nav-links{display:none}
  .hero{grid-template-columns:minmax(0,1fr);gap:26px;padding-top:28px}
  .hv{min-height:0}
  .photo{position:relative;height:340px;border-radius:28px}
  .photo.logo{padding-top:60px}
  .photo.logo img,.photo.logo .ini{width:120px;height:120px}
  .card{width:100%;margin-top:-84px;padding:18px}
  .fa{left:12px;top:14px}
  .fb{display:none}
  .seal-hero{top:-22px;right:-8px;width:104px;height:104px}
  .svc{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rev{grid-template-columns:minmax(0,1fr)}
  .zg{grid-template-columns:minmax(0,1fr);gap:28px}
  .trust{grid-template-columns:minmax(0,1fr);gap:24px}
  .sealbox{max-width:300px}
  .steps{grid-template-columns:minmax(0,1fr)}
  .gal{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:170px;gap:12px}
  .gal.pocas{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:300px}
  .foot{padding-bottom:100px}
  .mbar{display:block}
}
@media (max-width:700px){
  .deco .cable,.deco .band{opacity:.4}
  .wrap{padding:0 16px}
  .nav{padding:0 10px}
  .nav-in{height:62px}
  .oy-mini{display:none}
  .brand img,.brand .ini{width:40px;height:40px;flex-basis:40px}
  .s{padding-top:76px}
  .gal{grid-auto-rows:150px;gap:10px}
  .gal.pocas{grid-auto-rows:240px}
  .gcap{left:10px;right:10px;bottom:10px;font-size:13px}
  .svc{grid-template-columns:minmax(0,1fr);gap:10px}
  .sc{flex-direction:row;align-items:center;gap:14px;padding:14px 16px}
  .sc h3{font-size:16.5px}
  .si{width:42px;height:42px;flex-basis:42px}
  .also{align-items:flex-start}
  .two{grid-template-columns:minmax(0,1fr)}
  .score{padding:22px}
  .bigs b{font-size:62px}
  .rcard{padding:22px}
  .cta{margin:76px 0 32px;padding:44px 20px;border-radius:30px}
  .foot{padding:24px 16px 100px}
}
@media (max-width:420px){.brand-tx small{display:none}.btn-s{padding:0 12px;font-size:13.5px}}
`;

// ── la web ──────────────────────────────────────────────────
function paginaWeb(d, prueba) {
  const url = `${SITE}/pro/${d.slug}`;
  const persona = d.persona;
  const titulo = `${d.nombre} · ${capital(persona)} en ${d.ciudad}${d.empresa ? " · " + d.empresa : " | OficioYa"}`;
  const top = d.servicios.slice(0, 3).map(minus1);
  const desc = (`${d.nombre}${d.empresa ? " (" + d.empresa + ")" : ""}, ${persona} en ${d.ciudad}${d.zonas.length > 1 ? " y alrededores" : ""}. ` +
    (d.n ? `${d.nota.toFixed(1).replace(".", ",")}★ con ${d.n} ${d.n === 1 ? "opinión" : "opiniones"}. ` : "") +
    (top.length ? capital(top.join(", ")) + ". " : "") + "Pide presupuesto gratis y sin compromiso.").slice(0, 300);
  const img = d.logo || (d.fotos[0] && d.fotos[0].url) || `${SITE}/icon-512.png`;
  const iniciales = esc(d.marca.split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase());
  const logoEl = (cls, alt) => d.logo ? `<img class="${cls || ""}" src="${esc(d.logo)}" alt="${esc(alt || "")}" width="46" height="46">` : `<span class="ini ${cls || ""}" aria-hidden="true">${iniciales}</span>`;
  const tipo = TIPO_LD[d.fam] || "HomeAndConstructionBusiness";
  const ld = {
    "@context": "https://schema.org", "@type": tipo, "@id": url + "#negocio", name: d.marca, url, image: img,
    description: desc,
    address: { "@type": "PostalAddress", addressLocality: d.ciudad, addressCountry: "ES" },
    areaServed: d.zonas.map((z) => ({ "@type": "City", name: z })),
    knowsAbout: d.servicios,
    ...(d.empresa ? { founder: { "@type": "Person", name: d.nombre } } : {}),
    ...(d.n ? { aggregateRating: { "@type": "AggregateRating", ratingValue: d.nota.toFixed(1), reviewCount: d.n, bestRating: 5, worstRating: 1 } } : {}),
    ...(d.opiniones.length ? { review: d.opiniones.slice(0, 10).map((o) => ({ "@type": "Review", author: { "@type": "Person", name: o.nombre }, datePublished: String(o.fecha || "").slice(0, 10), reviewBody: o.texto, reviewRating: { "@type": "Rating", ratingValue: o.estrellas, bestRating: 5, worstRating: 1 } })) } : {}),
  };
  const ldTxt = JSON.stringify(ld).replace(/</g, "\\u003c");
  const nec = NECESIDADES[d.fam] || NECESIDADES.otro;
  const pill = d.disponible
    ? `<p class="pill"><span class="dot" aria-hidden="true"></span><span>Disponible${d.respuesta ? " · responde " + esc(d.respuesta) : ""}</span></p>`
    : `<p class="pill neutro">${svg("pin", 15)}<span>${esc(capital(persona))} en ${esc(d.ciudad)}</span></p>`;
  const subTxt = `${d.corto} es ${persona} en ${d.ciudad}${d.zonas.length > 1 ? " y alrededores" : ""}${d.exp > 0 ? `, con ${d.exp} ${d.exp === 1 ? "año" : "años"} de experiencia` : ""}.` +
    (top.length ? " " + capital(top.join(", ").replace(/, ([^,]*)$/, " y $1")) + "." : "");
  const chips = [];
  if (d.exp > 0) chips.push([`${d.exp} ${d.exp === 1 ? "año" : "años"} de experiencia`, "award"]);
  if (d.urgencias) chips.push(["Urgencias 24 h", "clock"]);
  if (d.gratis) chips.push(["Presupuesto gratis", "euro"]);
  if (d.verificado && chips.length < 3) chips.push(["Verificado por OficioYa", "shield"]);
  const heroFoto = d.fotos[0];
  const n = d.fotos.length;
  const galCls = n < 4 ? "gal pocas" : "gal";
  const patron = ["g-a", "g-b", "g-b", "g-b", "g-b", "g-a"];
  const reparto = [5, 4, 3, 2, 1].map((s) => d.opiniones.filter((o) => o.estrellas === s).length);
  const totalRep = d.opiniones.length || 1;
  const opinar = `/pro/${esc(d.slug)}/opinion`;
  const ano = new Date().getFullYear();
  const cfg = { url: SUPABASE_URL, key: KEY, pro: d.id, oficio: d.oficio, zona: d.ciudad, corto: d.corto, slug: d.slug, prueba: !!prueba, oyTel: OY_TEL,
    nec: nec.map((x) => x[0]), fotos: d.fotos.map((f) => ({ u: f.url, t: f.titulo })) };

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${d.rico ? "index, follow" : "noindex, follow"}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="#0F1117">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/icon-192.png">
<meta property="og:type" content="profile">
<meta property="og:locale" content="es_ES">
<meta property="og:site_name" content="OficioYa">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="${SUPABASE_URL}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..900&display=swap">
${heroFoto ? `<link rel="preload" as="image" href="${esc(heroFoto.url)}" fetchpriority="high">` : ""}
<script type="application/ld+json">${ldTxt}</script>
<style>${CSS_BASE}${CSS_WEB}</style>
</head>
<body>
${fondo(d.fam)}

<header class="nav">
  <div class="nav-in">
    <a class="brand" href="#inicio" aria-label="${esc(d.marca)}, ir arriba">
      ${logoEl("", "Logo de " + d.marca)}
      <span class="brand-tx"><b>${esc(d.marca)}</b><small>${esc(d.empresa ? d.nombre + " · " + d.oficio : d.oficio + " en " + d.ciudad)}</small></span>
    </a>
    <nav class="nav-links" aria-label="Secciones">
      ${n ? '<a href="#trabajos">Trabajos</a>' : ""}
      <a href="#servicios">Servicios</a>
      ${d.n ? '<a href="#opiniones">Opiniones</a>' : ""}
      <a href="#zonas">Zonas</a>
    </nav>
    <div class="nav-r">
      ${d.verificado ? `<span class="oy-mini"><span class="oy-ic">${svg("hammer", 15, 2.3)}</span>Verificado por <span class="oy-w">Oficio<span>Ya</span></span></span>` : ""}
      <a class="btn-s" href="#pedir">Pedir presupuesto</a>
    </div>
  </div>
</header>

<main>
<section class="wrap hero" id="inicio">
  <div class="hero-copy">
    ${pill}
    <h1>Tu ${esc(persona)} de confianza <span>en ${esc(d.ciudad)}.</span></h1>
    <p class="sub">${esc(subTxt)}</p>
    ${chips.length ? `<ul class="tchips">${chips.map(([t, i]) => `<li>${svg(i, 18, 2)}${esc(t)}</li>`).join("")}</ul>` : ""}
    ${d.n ? `<div class="rate">${estrellas(d.nota)}<b>${d.nota.toFixed(1).replace(".", ",")}</b><span>· ${d.n} ${d.n === 1 ? "opinión" : "opiniones"} en OficioYa${n ? " ·" : ""}</span>${n ? '<a href="#trabajos">Ver sus trabajos</a>' : ""}</div>` : (n ? `<div class="rate"><a href="#trabajos">Ver sus trabajos</a></div>` : "")}
  </div>

  <div class="hv">
    ${heroFoto
      ? `<div class="photo"><img src="${esc(heroFoto.url)}" alt="${esc(heroFoto.titulo || "Trabajo de " + d.nombre)}" fetchpriority="high"></div>`
      : `<div class="photo logo">${logoEl("", "Logo de " + d.marca)}</div>`}
    ${d.verificado ? `<div class="fl fa"><div class="fchip"><span class="fic">${svg("shield", 20)}</span><span><small>Profesional verificado</small><b>Sello OficioYa</b></span></div></div>` : ""}
    ${d.desde ? `<div class="fl fb"><div class="fchip">${logoEl("", "")}<span><small>En OficioYa desde</small><b>${esc(mesAnio(d.desde))}</b></span></div></div>` : ""}
    ${d.verificado ? `<div class="seal-hero">${sello("s1")}</div>` : ""}

    <div class="card dark" id="pedir">
      <div id="pForm">
        ${prueba ? '<p class="prueba">Modo prueba: no se envía nada.</p>' : ""}
        <div class="ft"><h2>Pide presupuesto a ${esc(d.corto)}</h2>${d.gratis ? '<span class="tag-ok">Gratis</span>' : ""}</div>
        <p class="lbl">1 · ¿Qué necesitas?</p>
        <div class="tiles" role="group" aria-label="Qué necesitas">
          ${nec.map(([t, s, i], k) => `<button type="button" class="tile" data-i="${k}" aria-pressed="${k === 0 ? "true" : "false"}"><span class="ic">${svg(i, 18)}</span><span><b>${esc(t)}</b><small>${esc(s)}</small></span></button>`).join("\n          ")}
        </div>
        <p class="lbl">2 · ¿Para cuándo?</p>
        <div class="seg" role="group" aria-label="Para cuándo">
          <button type="button" data-u="Hoy" aria-pressed="false">Hoy</button>
          <button type="button" data-u="Esta semana" aria-pressed="true">Esta semana</button>
          <button type="button" data-u="Sin prisa" aria-pressed="false">Sin prisa</button>
        </div>
        <p class="lbl">3 · Tus datos</p>
        <div class="two">
          <label class="fld"><span>Tu nombre</span><input class="inp" id="nombre" type="text" autocomplete="name" placeholder="Nombre" maxlength="60"></label>
          <label class="fld"><span>Tu teléfono</span><input class="inp" id="tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="612 345 678" maxlength="16"></label>
        </div>
        <input class="trampa" id="web" name="web" tabindex="-1" autocomplete="off" aria-hidden="true">
        <label class="terms"><input type="checkbox" id="terms"><span>He leído y acepto las <a href="/terminos" target="_blank" rel="noopener">Condiciones de Uso</a> y la <a href="/privacidad" target="_blank" rel="noopener">Política de Privacidad</a>.</span></label>
        <p class="msg" id="msg" aria-live="polite"></p>
        <button type="button" class="btn" id="enviar"><span>Enviar a ${esc(d.corto)}</span>${svg("arrow", 18, 2.4)}</button>
        <p class="note">Gratis y sin compromiso. Solo usamos tus datos para tu presupuesto.</p>
      </div>
      <div class="done" id="pOk" hidden aria-live="polite">
        <div class="big">${svg("check", 34, 2.6)}</div>
        <h3>¡Listo! ${esc(d.corto)} tiene tu solicitud</h3>
        <p>Te llamará para ver el trabajo y darte el precio. Gratis y sin compromiso.</p>
        <a class="btn" id="llamar" href="tel:+34${OY_TEL}">${svg("phone", 18)}<span id="llamarTx">Llamar ahora</span></a>
        ${prueba ? '<p class="prueba" style="margin:16px 0 0">Modo prueba: no se ha enviado nada.</p>' : ""}
        <button type="button" class="link" id="otra">Hacer otra solicitud</button>
      </div>
    </div>
  </div>
</section>

${n ? `<section class="wrap s" id="trabajos">
  <div class="head">
    <p class="eyebrow">TRABAJOS REALIZADOS</p>
    <h2 class="h">Trabajos reales, hechos por ${esc(d.corto)}.</h2>
    <p class="lead">Fotos que ${esc(d.corto)} ha subido a su perfil de OficioYa. Toca una para verla en grande.</p>
  </div>
  <div class="${galCls}" style="--n:${Math.max(1, n)}">
    ${d.fotos.map((f, i) => `<button type="button" class="gi ${n < 4 ? "" : patron[i % 6]}" data-f="${i}" aria-label="Ver en grande${f.titulo ? ": " + esc(f.titulo) : ""}"><img src="${esc(f.url)}" alt="${esc(f.titulo || "Trabajo de " + d.nombre)}" loading="lazy" decoding="async">${f.titulo ? `<span class="gcap"><i>${svg(iconoDe(f.titulo + " " + d.oficio), 14, 2.4)}</i>${esc(f.titulo)}</span>` : ""}</button>`).join("\n    ")}
  </div>
</section>` : ""}

<section class="wrap s" id="servicios">
  <div class="head">
    <p class="eyebrow">QUÉ HACE</p>
    <h2 class="h">${d.propias ? "Sus especialidades." : `Trabajos de ${esc(persona)}.`}</h2>
    <p class="lead">${d.propias ? "Tal como las tiene en su perfil de OficioYa." : "Pídele presupuesto para cualquiera de estos trabajos."}</p>
  </div>
  ${d.servicios.length ? `<div class="svc">
    ${d.servicios.map((s) => `<div class="sc"><span class="si">${svg(iconoDe(s), 22, 2.1)}</span><h3>${esc(capital(s))}</h3></div>`).join("\n    ")}
    ${d.tambien.length ? `<div class="sc also"><span class="si">${svg("plus", 22, 2.3)}</span><div><h3>También hace</h3><ul>${d.tambien.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div></div>` : ""}
  </div>` : ""}
  ${d.bio ? `<div class="sobre glass"><b>Sobre ${esc(d.corto)}</b>${esc(d.bio)}</div>` : ""}
</section>

${d.n ? `<section class="wrap s" id="opiniones">
  <div class="head">
    <p class="eyebrow">OPINIONES</p>
    <h2 class="h">Lo que dicen sus clientes.</h2>
  </div>
  <div class="rev">
    <div class="score glass">
      <div class="bigs"><b>${d.nota.toFixed(1).replace(".", ",")}</b>${estrellas(d.nota, 22)}</div>
      <p class="cnt">${d.n} ${d.n === 1 ? "opinión" : "opiniones"} de clientes en OficioYa</p>
      <div class="bars">${reparto.map((c, i) => `<div class="bar"><span>${5 - i}</span><i><span style="width:${Math.round((c / totalRep) * 100)}%"></span></i><span>${c}</span></div>`).join("")}</div>
      <p class="mod">${svg("shield", 18)}<span>Escritas por sus clientes. OficioYa retira las que no sean reales.</span></p>
    </div>
    <div class="rlist">
      ${d.opiniones.map((o, i) => `<figure class="rcard dark${i === 0 ? " primera" : ""}"${i >= 4 ? " hidden" : ""}>
        ${estrellas(o.estrellas, 18)}
        <blockquote>“${esc(o.texto)}”</blockquote>
        <figcaption class="who"><span class="av" aria-hidden="true">${esc(o.nombre.charAt(0).toUpperCase())}</span><span><b>${esc(o.nombre)}</b><small>${esc(mesAnio(o.fecha))}</small></span></figcaption>
      </figure>`).join("\n      ")}
      ${d.opiniones.length > 4 ? `<button type="button" class="mas" id="mas">Ver las ${d.opiniones.length} opiniones</button>` : ""}
    </div>
  </div>
  <div class="leave"><span>¿Has trabajado con ${esc(d.corto)}? Tu opinión ayuda a otros vecinos.</span><a class="btn-g" href="${opinar}">Dejar mi opinión</a></div>
</section>` : ""}

<section class="wrap s" id="zonas">
  <div class="zg">
    <div>
      <p class="eyebrow">DÓNDE TRABAJA</p>
      <h2 class="h">${d.zonas.length > 1 ? `${esc(d.ciudad)} y ${d.zonas.length - 1} ${d.zonas.length - 1 === 1 ? "sitio" : "municipios"} más.` : `En ${esc(d.ciudad)}.`}</h2>
      <ul class="zchips">${d.zonas.map((z, i) => `<li${i === 0 ? ' class="zm"' : ""}>${i === 0 ? svg("pin", 15) : ""}${esc(z)}</li>`).join("")}</ul>
    </div>
    <aside class="info glass" aria-label="Datos rápidos">
      <h3>Datos rápidos</h3>
      ${d.horario ? `<div class="irow"><span class="ii">${svg("cal", 19, 2.1)}</span><span><small>Horario</small><b>${esc(capital(d.horario))}</b></span></div>` : ""}
      ${d.urgencias ? `<div class="irow"><span class="ii">${svg("zap", 19, 2.1)}</span><span><small>Urgencias</small><b>24 horas</b></span></div>` : ""}
      ${d.respuesta ? `<div class="irow"><span class="ii">${svg("clock", 19, 2.1)}</span><span><small>Responde</small><b>${esc(capital(d.respuesta))}</b></span></div>` : ""}
      ${d.exp > 0 ? `<div class="irow"><span class="ii">${svg("award", 19, 2.1)}</span><span><small>Experiencia</small><b>${d.exp} ${d.exp === 1 ? "año" : "años"}</b></span></div>` : ""}
      ${d.gratis ? `<div class="irow"><span class="ii">${svg("euro", 19, 2.1)}</span><span><small>Presupuesto</small><b>Gratis y sin compromiso</b></span></div>` : ""}
      ${d.desde ? `<div class="irow"><span class="ii">${svg("hammer", 19, 2.1)}</span><span><small>En OficioYa desde</small><b>${esc(capital(mesAnio(d.desde)))}</b></span></div>` : ""}
    </aside>
  </div>
</section>

${d.verificado ? `<section class="wrap s trust" id="sello">
  <div class="sealbox">${sello("s2")}</div>
  <div>
    <p class="eyebrow">EL SELLO OFICIOYA</p>
    <h2 class="h">Un profesional comprobado, no un anuncio cualquiera.</h2>
    <ul class="tlist">
      <li><span class="tic">${svg("shield", 20)}</span><span><strong>Comprobado por OficioYa</strong><em>Para llevar el sello, OficioYa revisa sus datos antes de publicar su web.</em></span></li>
      <li><span class="tic">${estrella(20)}</span><span><strong>Opiniones de sus clientes</strong><em>Las escriben sus clientes y OficioYa retira las que no sean reales.</em></span></li>
      <li><span class="tic">${svg("euro", 20)}</span><span><strong>Pagas al profesional, no a nosotros</strong><em>Pedir presupuesto es gratis y tu dinero no pasa por OficioYa.</em></span></li>
    </ul>
  </div>
</section>` : ""}

<section class="wrap s" id="como">
  <div class="head">
    <p class="eyebrow">CÓMO FUNCIONA</p>
    <h2 class="h">Tu presupuesto, en tres pasos.</h2>
  </div>
  <ol class="steps">
    <li class="glass"><div class="num">1</div><h3>Le cuentas qué necesitas</h3><p>Desde el móvil y en menos de un minuto. Gratis y sin compromiso.</p></li>
    <li class="glass"><div class="num">2</div><h3>Te llama ${esc(d.corto)}</h3><p>Para ver el trabajo y darte el precio, sin intermediarios.</p></li>
    <li class="glass"><div class="num">3</div><h3>Le pagas a él directamente</h3><p>Tu dinero no pasa por OficioYa en ningún momento.</p></li>
  </ol>
  ${d.n ? "" : `<div class="leave"><span>¿Has trabajado con ${esc(d.corto)}? Sé el primero en dejar tu opinión.</span><a class="btn-g" href="${opinar}">Dejar mi opinión</a></div>`}
</section>

<section class="wrap" id="final">
  <div class="cta glass">
    ${d.logo ? `<img class="lg" src="${esc(d.logo)}" alt="Logo de ${esc(d.marca)}" width="78" height="78" loading="lazy">` : `<span class="ini" aria-hidden="true" style="display:flex;margin:0 auto 20px">${iniciales}</span>`}
    <h2>¿Necesitas un ${esc(persona)} en ${esc(d.ciudad)}?</h2>
    <p>Pide presupuesto a ${esc(d.corto)}. Gratis y sin compromiso.</p>
    <a class="bp" href="#pedir">${svg("zap", 20)}Pedir presupuesto</a>
  </div>
</section>
</main>

<footer>
  <div class="foot">
    <a class="flogo" href="#inicio" aria-label="${esc(d.marca)}, ir arriba">${logoEl("", "")}<span><b>${esc(d.marca)}</b><small>${esc(d.empresa ? d.nombre + " · " : "")}${esc(capital(persona))} en ${esc(d.ciudad)}</small></span></a>
    <a class="oyb" href="${SITE}/inicio"><span class="oy-ic">${svg("hammer", 15, 2.3)}</span>${d.verificado ? "Web verificada por" : "Web en"} <span class="oy-w">Oficio<span>Ya</span></span></a>
    <nav class="fnav" aria-label="Pie de página">
      <a href="/terminos">Condiciones de uso</a>
      <a href="/privacidad">Privacidad</a>
      <a href="/cookies">Cookies</a>
    </nav>
    <span>© ${ano} ${esc(d.marca)}</span>
  </div>
</footer>

<div class="mbar" id="mbar"><a href="#pedir">Pedir presupuesto gratis</a></div>

<div class="lb" id="lb" hidden role="dialog" aria-modal="true" aria-label="Foto en grande">
  <div class="lb-img"><img id="lbImg" alt=""></div>
  <div class="lb-bar">
    <span class="lb-cap" id="lbCap"></span><span class="lb-num" id="lbNum"></span>
    <button type="button" class="lb-btn" id="lbPrev" aria-label="Foto anterior">${svg("left", 20, 2.4)}</button>
    <button type="button" class="lb-btn" id="lbNext" aria-label="Foto siguiente">${svg("right", 20, 2.4)}</button>
    <button type="button" class="lb-btn" id="lbClose" aria-label="Cerrar">${svg("x", 20, 2.4)}</button>
  </div>
</div>

<script>
(function () {
  "use strict";
  var C = ${JSON.stringify(cfg).replace(/</g, "\\u003c")};
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  var nec = 0, urg = "Esta semana";

  $$(".tile").forEach(function (b) {
    b.addEventListener("click", function () {
      nec = +b.getAttribute("data-i");
      $$(".tile").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    });
  });
  $$(".seg button").forEach(function (b) {
    b.addEventListener("click", function () {
      urg = b.getAttribute("data-u");
      $$(".seg button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    });
  });

  var msg = $("#msg"), btn = $("#enviar");
  function aviso(t) { msg.textContent = t || ""; }
  function listo(r) {
    $("#pForm").hidden = true; $("#pOk").hidden = false;
    var tel = r && r.telefono ? String(r.telefono) : "+34" + C.oyTel;
    var quien = r && r.profesional ? r.profesional : (r && r.prueba ? C.corto : "OficioYa");
    $("#llamar").setAttribute("href", "tel:" + tel.replace(/[^0-9+]/g, ""));
    $("#llamarTx").textContent = "Llamar a " + quien;
    try { $("#pedir").scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
  }
  btn.addEventListener("click", function () {
    aviso("");
    var nombre = ($("#nombre").value || "").trim();
    var tel = ($("#tel").value || "").replace(/\\D/g, "").slice(-9);
    if (nombre.length < 2) { aviso("Escribe tu nombre."); $("#nombre").focus(); return; }
    if (!/^[6789]\\d{8}$/.test(tel)) { aviso("Revisa tu teléfono: tienen que ser 9 números."); $("#tel").focus(); return; }
    if (!$("#terms").checked) { aviso("Acepta las Condiciones de Uso para continuar."); return; }
    if (($("#web").value || "").trim()) { listo({ prueba: true }); return; }
    if (C.prueba) { listo({ prueba: true }); return; }
    btn.disabled = true;
    var p = { telefono: tel, nombre: nombre, oficio: C.oficio, zona: C.zona, canal: "formulario", landing: "web-pro", utm_source: "web-pro",
      utm_campaign: C.slug, pro: C.pro, descripcion: C.nec[nec] + " · " + urg + " · Pedido desde su web en OficioYa" };
    fetch(C.url + "/rest/v1/rpc/oy_lead_contacto", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: C.key, Authorization: "Bearer " + C.key },
      body: JSON.stringify({ p: p })
    }).then(function (r) { return r.json(); }).then(function (r) {
      btn.disabled = false;
      if (r && r.ok) return listo(r);
      if (r && r.error === "telefono") return aviso("Revisa tu teléfono: tienen que ser 9 números.");
      if (r && r.error === "nombre") return aviso("Escribe tu nombre.");
      aviso("No se ha podido enviar. Llámanos al 656 39 80 14.");
    }).catch(function () { btn.disabled = false; aviso("No se ha podido enviar. Llámanos al 656 39 80 14."); });
  });
  $("#otra").addEventListener("click", function () { $("#pOk").hidden = true; $("#pForm").hidden = false; });

  var mas = $("#mas");
  if (mas) mas.addEventListener("click", function () { $$(".rcard[hidden]").forEach(function (x) { x.hidden = false; }); mas.hidden = true; });

  // Visor de fotos
  var lb = $("#lb"), i = 0, n = C.fotos.length;
  function ver(k) {
    i = (k + n) % n;
    $("#lbImg").src = C.fotos[i].u; $("#lbImg").alt = C.fotos[i].t || "Trabajo";
    $("#lbCap").textContent = C.fotos[i].t || ""; $("#lbNum").textContent = (i + 1) + " / " + n;
  }
  function abrir(k) { ver(k); lb.hidden = false; document.addEventListener("keydown", teclas); $("#lbClose").focus(); }
  function cerrar() { lb.hidden = true; document.removeEventListener("keydown", teclas); }
  function teclas(e) { if (e.key === "Escape") cerrar(); else if (e.key === "ArrowRight") ver(i + 1); else if (e.key === "ArrowLeft") ver(i - 1); }
  $$(".gi").forEach(function (g) { g.addEventListener("click", function () { abrir(+g.getAttribute("data-f")); }); });
  $("#lbPrev").addEventListener("click", function () { ver(i - 1); });
  $("#lbNext").addEventListener("click", function () { ver(i + 1); });
  $("#lbClose").addEventListener("click", cerrar);
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("lb-img")) cerrar(); });

  // Botón fijo en el móvil: se esconde mientras se ve el formulario
  var mbar = $("#mbar"), pedir = $("#pedir");
  if ("IntersectionObserver" in window && mbar && pedir) {
    var visible = true, arriba = true;
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; mbar.classList.toggle("ver", !visible && !arriba); }, { threshold: 0.15 }).observe(pedir);
    window.addEventListener("scroll", function () { arriba = window.scrollY < 300; mbar.classList.toggle("ver", !visible && !arriba); }, { passive: true });
  }
})();
</script>
</body>
</html>`;
}

// ── página de opinión ───────────────────────────────────────
function paginaOpinion(d, prueba) {
  const iniciales = esc(d.marca.split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase());
  const logo = d.logo ? `<img src="${esc(d.logo)}" alt="Logo de ${esc(d.marca)}" width="42" height="42">` : `<span class="ini" aria-hidden="true">${iniciales}</span>`;
  const cfg = { url: SUPABASE_URL, key: KEY, pro: d.id, slug: d.slug, prueba: !!prueba };
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Deja tu opinión sobre ${esc(d.nombre)} · ${esc(d.marca === d.nombre ? capital(d.persona) : d.marca)}</title>
<meta name="description" content="Cuéntanos qué tal el trabajo con ${esc(d.nombre)}. Tu opinión sale en su web de OficioYa.">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${SITE}/pro/${esc(d.slug)}/opinion">
<meta name="theme-color" content="#0F1117">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:title" content="¿Qué tal el trabajo con ${esc(d.corto)}? Deja tu opinión">
<meta property="og:description" content="Es un minuto: tu nota, tu nombre y tu comentario. Sale en su web de OficioYa.">
${d.logo ? `<meta property="og:image" content="${esc(d.logo)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..900&display=swap">
<style>${CSS_BASE}
.op{max-width:520px;margin:0 auto;padding:12px 16px 28px}
.top{display:flex;align-items:center;justify-content:space-between;gap:10px;height:62px;padding:0 8px 0 10px;border-radius:20px;background:rgba(15,17,23,.66);border:1px solid rgba(255,255,255,.10);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 20px 40px -24px rgba(0,0,0,.85)}
.brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto}
.brand img,.brand .ini{width:42px;height:42px;flex:0 0 42px;border-radius:11px;object-fit:cover;box-shadow:0 0 0 1px rgba(255,215,0,.35)}
.ini{display:flex;align-items:center;justify-content:center;background:var(--grad);color:#1A1200;font-weight:900;font-size:16px}
.bt{min-width:0}
.brand b{display:block;font-size:16.5px;font-weight:900;letter-spacing:-.02em;color:var(--ink);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand small{display:block;font-size:11.5px;font-weight:600;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oy{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:5px 9px 5px 5px;border-radius:11px;background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.22);font-size:11.5px;font-weight:800;white-space:nowrap}
.oy .oy-ic{width:22px;height:22px;border-radius:7px}
.caja{margin-top:18px;padding:22px 18px;border-radius:28px}
.eyebrow{margin:0;font-size:11.5px;font-weight:800;letter-spacing:.16em;color:var(--warn)}
.caja h1{margin:10px 0 0;font-size:29px;line-height:1.08;letter-spacing:-.035em;font-weight:900;color:var(--ink)}
.lead{margin:12px 0 0;font-size:15px;line-height:1.55;color:var(--ink2)}
.lbl{margin:22px 0 10px}
.estr{display:flex;gap:6px}
.st{width:52px;height:52px;flex:0 0 52px;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .35s var(--spring)}
.st.on{color:#FFD700;background:rgba(255,200,0,.12);border-color:rgba(255,200,0,.5)}
.slabel{margin:10px 0 0;font-size:14px;font-weight:800;color:#FFE38A}
.fld{margin-top:14px}
.area{height:124px;padding:13px 16px;resize:vertical;line-height:1.5}
.done{text-align:center;padding:8px 2px 2px}
.done h2{margin:18px 0 6px;font-size:25px;font-weight:900;letter-spacing:-.03em;color:var(--ink)}
.done p{margin:0;font-size:15px;line-height:1.55;color:var(--ink2)}
.ghost{display:flex;align-items:center;justify-content:center;gap:8px;height:52px;margin-top:18px;border-radius:16px;border:1px solid rgba(255,200,0,.55);background:rgba(255,200,0,.1);color:#FFE38A;font-weight:800;font-size:15px}
.pie{margin-top:22px;display:flex;justify-content:center}
@media (max-width:360px){.st{width:46px;height:46px;flex-basis:46px}.oy span.t{display:none}}
</style>
</head>
<body>
<div class="op">
  <header class="top">
    <a class="brand" href="/pro/${esc(d.slug)}" aria-label="Ir a la web de ${esc(d.marca)}">${logo}<span class="bt"><b>${esc(d.marca)}</b><small>${esc(capital(d.persona))} en ${esc(d.ciudad)}</small></span></a>
    <span class="oy"><span class="oy-ic">${svg("shield", 13, 2.4)}</span><span class="t oy-w">Oficio<span>Ya</span></span></span>
  </header>

  <main class="caja dark">
    <div id="pForm">
      ${prueba ? '<p class="prueba">Modo prueba: no se publica nada.</p>' : ""}
      <p class="eyebrow">TU OPINIÓN</p>
      <h1>¿Qué tal el trabajo con ${esc(d.corto)}?</h1>
      <p class="lead">Tu opinión sale al momento en su web de OficioYa y ayuda a otros vecinos a elegir.</p>
      <p class="lbl">1 · Tu nota</p>
      <div class="estr" role="group" aria-label="Tu nota de 1 a 5 estrellas">
        ${[1, 2, 3, 4, 5].map((k) => `<button type="button" class="st on" data-n="${k}" aria-label="${k} ${k === 1 ? "estrella" : "estrellas"}">${estrella(28)}</button>`).join("")}
      </div>
      <p class="slabel" id="slabel" aria-live="polite">¡Excelente!</p>
      <p class="lbl">2 · Cuéntanos</p>
      <label class="fld"><span>Tu nombre</span><input class="inp" id="nombre" type="text" autocomplete="given-name" placeholder="Nombre" maxlength="60"></label>
      <label class="fld"><span>Tu comentario</span><textarea class="inp area" id="texto" placeholder="Qué te hizo y qué tal fue: puntualidad, limpieza, precio…" maxlength="1200"></textarea></label>
      <input class="trampa" id="web" name="web" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label class="terms"><input type="checkbox" id="acepto"><span>Acepto que mi nombre y mi opinión se publiquen en la web de ${esc(d.corto)} en OficioYa. <a href="/privacidad" target="_blank" rel="noopener">Privacidad</a>.</span></label>
      <p class="msg" id="msg" aria-live="polite"></p>
      <button type="button" class="btn" id="enviar"><span>Publicar mi opinión</span>${svg("arrow", 18, 2.4)}</button>
      <p class="note">Solo tu nombre y tu comentario salen en su web. No te pedimos teléfono ni email.</p>
    </div>
    <div class="done" id="pOk" hidden aria-live="polite">
      <div class="big">${svg("check", 34, 2.6)}</div>
      <h2>¡Gracias por tu opinión!</h2>
      <p>${prueba ? "Modo prueba: no se ha publicado nada." : `Ya está publicada en la web de ${esc(d.corto)}.`}</p>
      <a class="ghost" id="verWeb" href="/pro/${esc(d.slug)}#opiniones">Ver la web de ${esc(d.corto)}${svg("arrow", 17, 2.4)}</a>
    </div>
  </main>

  <div class="pie"><a class="oyb" href="${SITE}/inicio"><span class="oy-ic">${svg("hammer", 13, 2.3)}</span>Web ${d.verificado ? "verificada por" : "en"} <span class="oy-w">Oficio<span>Ya</span></span></a></div>
</div>
<script>
(function () {
  "use strict";
  var C = ${JSON.stringify(cfg).replace(/</g, "\\u003c")};
  var NOTAS = ["", "Mal", "Regular", "Bien", "Muy bien", "¡Excelente!"];
  function $(s) { return document.querySelector(s); }
  var est = 5, btn = $("#enviar"), msg = $("#msg");
  Array.prototype.forEach.call(document.querySelectorAll(".st"), function (b) {
    b.addEventListener("click", function () {
      est = +b.getAttribute("data-n");
      Array.prototype.forEach.call(document.querySelectorAll(".st"), function (x) { x.classList.toggle("on", +x.getAttribute("data-n") <= est); });
      $("#slabel").textContent = NOTAS[est];
    });
  });
  function aviso(t) { msg.textContent = t || ""; }
  function listo(id) {
    $("#pForm").hidden = true; $("#pOk").hidden = false;
    if (id) $("#verWeb").setAttribute("href", "/pro/" + C.slug + "?op=" + encodeURIComponent(String(id).slice(0, 8)) + "#opiniones");
  }
  btn.addEventListener("click", function () {
    aviso("");
    var nombre = ($("#nombre").value || "").trim(), texto = ($("#texto").value || "").trim();
    if (nombre.length < 2) { aviso("Escribe tu nombre."); $("#nombre").focus(); return; }
    if (texto.length < 8) { aviso("Cuéntanos un poco más en tu comentario."); $("#texto").focus(); return; }
    if (!$("#acepto").checked) { aviso("Marca la casilla para poder publicarla."); return; }
    if (C.prueba || ($("#web").value || "").trim()) { listo(); return; }
    btn.disabled = true;
    fetch(C.url + "/rest/v1/rpc/oy_opinion_enviar", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: C.key, Authorization: "Bearer " + C.key },
      body: JSON.stringify({ p: { pro: C.pro, nombre: nombre, texto: texto, estrellas: est, acepto: true, web: $("#web").value || "" } })
    }).then(function (r) { return r.json(); }).then(function (r) {
      btn.disabled = false;
      if (r && r.ok) return listo(r.id);
      var e = r && r.error;
      aviso(e === "repetida" ? "Ya has dejado una opinión a este profesional hace poco. ¡Gracias!"
        : e === "limite" ? "Hoy ya se han enviado varias opiniones desde esta conexión. Inténtalo mañana."
        : e === "texto" ? "Cuéntanos un poco más en tu comentario."
        : e === "nombre" ? "Escribe tu nombre."
        : e === "acepto" ? "Marca la casilla para poder publicarla."
        : "No se ha podido publicar. Inténtalo de nuevo en un momento.");
    }).catch(function () { btn.disabled = false; aviso("No se ha podido publicar. Inténtalo de nuevo en un momento."); });
  });
})();
</script>
</body>
</html>`;
}

function pagina404() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Esta web no existe · OficioYa</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..900&display=swap">
<style>${CSS_BASE}.c{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}.c div{max-width:460px}h1{margin:18px 0 8px;font-size:32px;font-weight:900;letter-spacing:-.03em;color:var(--ink)}p{color:var(--ink2);font-size:16px}.b{display:inline-flex;margin-top:22px;height:52px;align-items:center;padding:0 22px;border-radius:16px;background:var(--btn);color:#1A1200;font-weight:800}</style></head>
<body><div class="c"><div><span class="oy-ic" style="width:56px;height:56px;border-radius:16px">${svg("hammer", 28, 2.2)}</span><h1>Esta web no existe</h1><p>El profesional ya no está en OficioYa o el enlace no es correcto.</p><a class="b" href="${SITE}/inicio">Buscar un profesional en OficioYa</a></div></div></body></html>`;
}
