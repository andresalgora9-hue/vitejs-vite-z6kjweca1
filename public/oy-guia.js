/* ============================================================
   OficioYa · oy-guia.js · Guías SEO con herramienta (el gancho) y lead
   Cada guía define window.OY_GUIA antes de cargar este archivo:
     { slug, titulo, city, zona, oficio: "Pintor"|"Fontanero", gremio, valor,
       modo: "formulario" (pintura) | "llamada" (fontanería, solo llamada),
       calcular: function (estado) -> { titulo, html, rango:[min,max]|null, nota, resumen },
       despues: function (cajaResultado, estado) (opcional) }
   La herramienta (#calc) puede ser "quiz" (preguntas de una en una) o "calc" (en vivo).
   - Pintura: el lead va por oy_lead_contacto (CRM del pintor de la ciudad o de OficioYa);
     si falla, sigue por el flujo /?quick=1, como las landings.
   - Fontanería: solo llamada, con OYContacto.abrir("llamada") de /oy-contacto.js.
   - No entra en el test A/B del hero: no usa .hero ni deja OY_RPC/OY_KEY globales.
   - La casilla de condiciones la pone /oy-consent.js en el botón que llama a enviarSolicitud().
   ============================================================ */
(function () {
  "use strict";
  if (window.OYGuia) return;
  var G = window.OY_GUIA || {};
  var RPC = "https://rjwojxwrsbvwwshwwpvq.supabase.co/rest/v1/rpc/oy_lead_contacto";
  var KEY = "sb_publishable_ReA-g1IhCfbhwMfkei7naw_BgtOs9nv";
  var CAT = "guia_" + (G.slug || "sin_slug");
  var LLAMADA = G.modo === "llamada";
  var USTED = !!G.usted;
  var OY_TEL = "+34656398014";

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function g() { try { if (typeof window.gtag === "function") window.gtag.apply(window, arguments); } catch (e) {} }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function r10(n) { return Math.round(n / 10) * 10; }
  function rango(r) { return fmt(r[0]) + " € – " + fmt(r[1]) + " €"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- Precios orientativos de OficioYa (los mismos que las landings) ---------- */
  var P = {
    piso: { p1: [380, 680], p2: [680, 1200], p3: [1200, 1950] },
    hab: { h1: [100, 165], h23: [200, 420], h4: [420, 760] },
    gotPiso: { p1: [530, 1160], p2: [950, 2040], p3: [1680, 3320] },
    gotHab: { h1: [140, 280], h23: [280, 710], h4: [590, 1290] },
    fachada: { f1: [900, 1500], f2: [1500, 2600], f3: [2600, 5250] },
    escalera: { e1: [900, 1800], e2: [1800, 3500], e3: [3500, 6000] },
    // Fontanería Sevilla (landing fontanero-sevilla): [desde, rango]
    fuga: { desde: 35, r: [65, 250] },
    atasco: { desde: 30, r: [55, 220] },
    grifo: { desde: 25, r: [45, 150] },
    termo: { desde: 40, r: [70, 220] },
    instalacion: { desde: 55, r: [90, 320] },
    renovacion: { pequeno: [1500, 2500], medio: [2000, 3500], grande: [3000, 5000], tramo: 400 }
  };
  // Pintar por metros (misma tabla que la calculadora por m² de las landings de pintura)
  var M2 = [[30, 300, 540], [45, 380, 680], [80, 680, 1200], [130, 1200, 1950], [200, 1850, 3000]];
  function porMetros(m, gotele) {
    var p = [M2[M2.length - 1][1], M2[M2.length - 1][2]];
    for (var i = 0; i < M2.length - 1; i++) {
      var a = M2[i], b = M2[i + 1];
      if (m <= b[0]) { var t = Math.max(0, (m - a[0]) / (b[0] - a[0])); p = [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]; break; }
    }
    if (gotele) p = [p[0] * 1.4, p[1] * 1.7];
    return [r10(p[0]), r10(p[1])];
  }
  function tamano(m) { return m < 60 ? "p1" : m <= 100 ? "p2" : "p3"; }

  // Utilidades que reciben calcular() y despues(): definidas antes de pintar la herramienta
  var api = { P: P, fmt: fmt, r10: r10, rango: rango, esc: esc, porMetros: porMetros, tamano: tamano,
    evento: function (l) { evento(l); }, irAHerramienta: function (l) { irAHerramienta(l); },
    mostrarLead: function () { mostrarLead(); }, estado: function () { return estado; } };

  /* ---------- Origen del lead: landing, ciudad y zona fijas por guía + utm / gclid ---------- */
  var ORIGEN = (function () {
    var o = { landing: G.slug, city_slug: G.city || "sevilla" };
    if (G.zona) o.zona = G.zona;
    try {
      var q = new URLSearchParams(location.search);
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid"].forEach(function (k) { var v = q.get(k); if (v) o[k] = v; });
      if (o.gclid) { try { localStorage.setItem("oy_gclid", JSON.stringify({ v: o.gclid, t: Date.now() })); } catch (e) {} }
      sessionStorage.setItem("oy_origen", JSON.stringify(o));
    } catch (e) {}
    return o;
  })();
  function gclidGuardado() {
    try { var raw = JSON.parse(localStorage.getItem("oy_gclid") || "null"); if (raw && raw.v && Date.now() - (raw.t || 0) < 90 * 864e5) return raw.v; } catch (e) {}
    var m = document.cookie.match(/(?:^|;\s*)_gcl_aw=([^;]+)/);
    if (m) { var p = decodeURIComponent(m[1]).split("."); if (p.length >= 3) return p.slice(2).join("."); }
    return "";
  }

  /* ---------- Herramienta ---------- */
  var tool = document.getElementById("calc");
  var tipo = tool ? tool.getAttribute("data-tipo") : "";
  var estado = {};
  var resultado = null;
  var empezado = false;
  var resBox = tool ? $("#gRes", tool) : null;
  var leadBox = $("#gLead");
  var okBox = $("#leadOk");
  var enviado = false;

  function evento(label) { g("event", "view_item", { event_category: CAT, event_label: label }); }
  function primera() { if (!empezado) { empezado = true; evento("inicio"); } }

  function cumple(el) {
    var c = el.getAttribute("data-si");
    if (!c) return true;
    return c.split(";").every(function (par) {
      var p = par.split("="), k = p[0], vals = (p[1] || "").split("|");
      var neg = k.charAt(k.length - 1) === "!";
      if (neg) k = k.slice(0, -1);
      var ok = vals.indexOf(String(estado[k])) > -1;
      return neg ? !ok : ok;
    });
  }

  function pintarResultado() {
    if (!resBox || typeof G.calcular !== "function") return;
    try { resultado = G.calcular(estado, api) || null; } catch (e) { resultado = null; }
    if (!resultado) { resBox.innerHTML = ""; return; }
    var h = '<div class="g-res-in">';
    if (resultado.etiqueta) h += '<p class="g-res-k">' + esc(resultado.etiqueta) + "</p>";
    if (resultado.titulo) h += "<h3>" + resultado.titulo + "</h3>";
    if (resultado.html) h += '<div class="g-res-body">' + resultado.html + "</div>";
    if (resultado.rango) {
      h += '<div class="price-box"><p class="price-label">' + esc(resultado.rangoLabel || "Precio orientativo") + "</p>" +
        '<div class="price-big">' + rango(resultado.rango) + "</div>" +
        (resultado.nota ? '<p class="price-hint">' + resultado.nota + "</p>" : "") + "</div>";
    } else if (resultado.nota) {
      h += '<p class="g-res-nota">' + resultado.nota + "</p>";
    }
    if (tipo === "quiz") h += '<button type="button" class="g-again" id="gAgain">↺ Volver a empezar</button>';
    h += "</div>";
    resBox.innerHTML = h;
    resBox.hidden = false;
    var again = $("#gAgain", resBox);
    if (again) again.addEventListener("click", reiniciar);
    if (typeof G.despues === "function") { try { G.despues(resBox, estado, api); } catch (e) {} }
    var sp = $("#gStickyTxt");
    if (sp && resultado.rango && !LLAMADA) sp.innerHTML = "Desde <b>" + fmt(resultado.rango[0]) + " €</b>";
  }

  function mostrarLead() {
    if (!leadBox || enviado) return;
    leadBox.hidden = false;
    var s = $("#gSkip"); if (s) s.hidden = true;
  }

  /* --- Quiz: preguntas de una en una --- */
  var preguntas = tool && tipo === "quiz" ? $$(".g-q", tool) : [];
  var historial = [];
  var prog = tool ? $(".g-prog i", tool) : null;
  var back = tool ? $("#gBack", tool) : null;

  function siguienteDesde(idx) {
    for (var i = idx + 1; i < preguntas.length; i++) if (cumple(preguntas[i])) return preguntas[i];
    return null;
  }
  function mostrar(q) {
    preguntas.forEach(function (x) { x.hidden = x !== q; });
    if (resBox) resBox.hidden = true;
    var n = historial.length + 1;
    var lab = $(".g-qn", q); if (lab) lab.textContent = "Pregunta " + n;
    if (prog) prog.style.width = Math.min(90, 12 + historial.length * 22) + "%";
    if (back) back.hidden = historial.length === 0;
  }
  function finalizar() {
    preguntas.forEach(function (x) { x.hidden = true; });
    if (prog) prog.style.width = "100%";
    if (back) back.hidden = historial.length === 0;
    pintarResultado();
    mostrarLead();
    evento("resultado");
    if (resBox) setTimeout(function () { resBox.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
  }
  function reiniciar() {
    estado = {}; historial = []; resultado = null;
    $$(".g-opt.sel", tool).forEach(function (b) { b.classList.remove("sel"); });
    if (resBox) { resBox.hidden = true; resBox.innerHTML = ""; }
    if (preguntas[0]) mostrar(preguntas[0]);
    evento("reiniciar");
  }
  if (tipo === "quiz" && preguntas.length) {
    preguntas.forEach(function (q, idx) {
      $$(".g-opt", q).forEach(function (b) {
        b.addEventListener("click", function () {
          primera();
          var k = q.getAttribute("data-q"), v = b.getAttribute("data-v");
          estado[k] = v;
          $$(".g-opt", q).forEach(function (x) { x.classList.toggle("sel", x === b); });
          evento(k + "_" + v);
          historial.push(q);
          // si cambia una respuesta anterior, se olvidan las que dependían de ella
          for (var j = idx + 1; j < preguntas.length; j++) { var kk = preguntas[j].getAttribute("data-q"); if (!cumple(preguntas[j])) delete estado[kk]; }
          var sig = siguienteDesde(idx);
          setTimeout(function () { if (sig) mostrar(sig); else finalizar(); }, 140);
        });
      });
    });
    if (back) back.addEventListener("click", function () {
      var prev = historial.pop();
      if (prev) mostrar(prev);
    });
    mostrar(preguntas[0]);
  }

  /* --- Calculadora en vivo: pastillas, deslizadores, contadores y casillas --- */
  function leerCalc() {
    $$("[data-campo]", tool).forEach(function (c) { c.hidden = !cumple(c); });
    pintarResultado();
  }
  if (tool && tipo === "calc") {
    $$(".g-pills", tool).forEach(function (grupo) {
      var k = grupo.getAttribute("data-k");
      var sel = $(".g-pill.sel", grupo) || $(".g-pill", grupo);
      if (sel) { sel.classList.add("sel"); estado[k] = sel.getAttribute("data-v"); }
      $$(".g-pill", grupo).forEach(function (b) {
        b.addEventListener("click", function () {
          primera();
          $$(".g-pill", grupo).forEach(function (x) { x.classList.toggle("sel", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
          estado[k] = b.getAttribute("data-v");
          evento(k + "_" + estado[k]);
          leerCalc();
        });
      });
    });
    $$("input[type=range][data-k]", tool).forEach(function (r) {
      var k = r.getAttribute("data-k");
      function upd() { estado[k] = +r.value; $$('[data-out="' + k + '"]').forEach(function (o) { o.textContent = r.value; }); }
      upd();
      r.addEventListener("input", function () { primera(); upd(); leerCalc(); });
      r.addEventListener("change", function () { evento(k + "_" + r.value); });
    });
    $$("input[type=checkbox][data-k]", tool).forEach(function (c) {
      var k = c.getAttribute("data-k");
      estado[k] = c.checked;
      c.addEventListener("change", function () { primera(); estado[k] = c.checked; evento(k + "_" + c.checked); leerCalc(); });
    });
    $$(".g-step", tool).forEach(function (st) {
      var k = st.getAttribute("data-k"), min = +st.getAttribute("data-min"), max = +st.getAttribute("data-max");
      var out = $(".g-step-v", st);
      estado[k] = +st.getAttribute("data-val");
      function pinta() { out.textContent = estado[k]; }
      pinta();
      $$("button", st).forEach(function (b) {
        b.addEventListener("click", function () {
          primera();
          var d = +b.getAttribute("data-d");
          estado[k] = Math.max(min, Math.min(max, estado[k] + d));
          pinta(); leerCalc();
        });
      });
    });
    leerCalc();
  }

  var skip = $("#gSkip");
  if (skip) skip.addEventListener("click", function () {
    g("event", "select_content", { event_category: CAT, event_label: "saltar_a_contacto" });
    mostrarLead();
    var n = $("#leadNombre"); if (n) setTimeout(function () { n.focus({ preventScroll: true }); }, 200);
    if (leadBox) leadBox.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  /* ---------- Ir a la herramienta desde cualquier botón del texto ---------- */
  function irAHerramienta(label) {
    if (!tool) return;
    var nav = $("nav"), margen = (nav ? nav.offsetHeight : 0) + 10;
    window.scrollTo({ top: tool.getBoundingClientRect().top + window.pageYOffset - margen, behavior: "smooth" });
    g("event", "select_content", { event_category: CAT, event_label: "cta_" + (label || "texto") });
  }
  $$("[data-ir]").forEach(function (b) {
    b.addEventListener("click", function (e) { e.preventDefault(); irAHerramienta(b.getAttribute("data-ir")); });
  });

  /* ---------- Datos guardados de una visita anterior ---------- */
  try {
    var prev = JSON.parse(localStorage.getItem("oy_contacto_datos") || "null");
    if (prev) {
      if (prev.nombre && $("#leadNombre")) $("#leadNombre").value = prev.nombre;
      if (prev.telefono && $("#leadTelefono")) $("#leadTelefono").value = prev.telefono;
    }
  } catch (e) {}

  /* ---------- Envío: formulario (pintura) o llamada (fontanería) ---------- */
  var enviando = false;
  function descripcion() {
    var base = "Desde la guía «" + (G.titulo || G.slug) + "».";
    var r = resultado && resultado.resumen ? " " + resultado.resumen : "";
    return (base + r).slice(0, 950);
  }
  function errorForm(msg, campo) {
    var e = $("#leadErr"); if (e) e.textContent = msg;
    ["leadNombre", "leadTelefono"].forEach(function (id) { var x = document.getElementById(id); if (x) x.removeAttribute("aria-invalid"); });
    if (campo) { campo.setAttribute("aria-invalid", "true"); campo.focus(); }
  }

  window.enviarSolicitud = function () {
    if (enviando) return;
    var inN = $("#leadNombre"), inT = $("#leadTelefono"), btn = $("#leadBtn");
    if (!inN || !inT) return;
    var nombre = (inN.value || "").trim();
    var tel = (inT.value || "").replace(/\D/g, "").replace(/^(0034|34)(?=\d{9}$)/, "").slice(-9);
    errorForm("", null);
    if (nombre.length < 2) { errorForm(USTED ? "Escriba su nombre para que el fontanero sepa quién es." : "Escribe tu nombre para que el pintor sepa a quién llamar.", inN); return; }
    if (!/^[6789]\d{8}$/.test(tel)) { errorForm(USTED ? "Escriba un teléfono de 9 cifras, por ejemplo 600 000 000." : "Escribe un teléfono de 9 cifras, por ejemplo 600 000 000.", inT); return; }
    var hp = $("#leadWeb"); if (hp && hp.value) return;
    try { localStorage.setItem("oy_contacto_datos", JSON.stringify({ nombre: nombre, telefono: inT.value.trim() })); } catch (e) {}
    var desc = descripcion();

    if (LLAMADA) {
      g("event", "select_content", { event_category: CAT, event_label: "llamar_con_datos" });
      if (window.OYContacto && typeof window.OYContacto.abrir === "function") {
        window.OYContacto.abrir("llamada", { detalle: desc, nombre: nombre, telefono: tel, auto: true });
      } else { location.href = "tel:" + OY_TEL; }
      return;
    }

    enviando = true; btn.disabled = true; btn.textContent = "Enviando...";
    var gclid = ORIGEN.gclid || gclidGuardado();
    var cuerpo = {
      nombre: nombre, telefono: tel, oficio: G.oficio || "Pintor", canal: "formulario",
      city_slug: ORIGEN.city_slug, zona: G.zonaNombre || "", landing: ORIGEN.landing, gclid: gclid,
      utm_source: ORIGEN.utm_source || "", utm_campaign: ORIGEN.utm_campaign || "", utm_content: ORIGEN.utm_content || "",
      descripcion: desc
    };
    var terminado = false;
    function respaldo() {
      if (terminado) return; terminado = true;
      var datos = { quick: "1", oficio: G.oficio || "Pintor", nombre: nombre, telefono: tel, email: "lead" + tel + "@aficioya-lead.com", desc: desc };
      Object.keys(ORIGEN).forEach(function (k) { datos[k] = ORIGEN[k]; });
      datos.city = ORIGEN.city_slug;
      var ido = false;
      function ir() { if (ido) return; ido = true; location.href = "/?" + new URLSearchParams(datos).toString(); }
      g("event", "generate_lead", { event_category: "solicitud_" + (G.gremio || "pintor"), event_label: ORIGEN.landing, value: G.valor || 0, currency: "EUR", event_callback: ir, event_timeout: 900 });
      setTimeout(ir, 1100);
    }
    var reloj = setTimeout(respaldo, 12000);
    fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY }, body: JSON.stringify({ p: cuerpo }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (terminado) return;
        clearTimeout(reloj);
        if (res && res.ok === false && (res.error === "telefono" || res.error === "nombre")) {
          enviando = false; btn.disabled = false; btn.innerHTML = G.boton || "Pedir presupuesto gratis →";
          if (res.error === "telefono") errorForm("Escribe un teléfono de 9 cifras, por ejemplo 600 000 000.", inT);
          else errorForm("Escribe tu nombre para que el pintor sepa a quién llamar.", inN);
          return;
        }
        if (!res || !res.ok) { respaldo(); return; }
        terminado = true;
        if (res.nuevo) {
          g("event", "generate_lead", { event_category: "solicitud_" + (G.gremio || "pintor"), event_label: ORIGEN.landing, value: G.valor || 0, currency: "EUR" });
          if (typeof window.fbq === "function") { try { window.fbq("track", "Lead", { content_name: "formulario", content_category: G.oficio || "Pintor" }); } catch (e) {} }
        } else {
          g("event", "contact", { event_category: "solicitud_" + (G.gremio || "pintor"), event_label: "repetido" });
        }
        mostrarOk(res, nombre, tel);
      })
      .catch(function () { clearTimeout(reloj); respaldo(); });
  };

  var PRO_FICHA = { "Cándido": { empresa: "Reformas Zelaya", logo: "/img/pros/zelaya-logo.webp" } };
  function mostrarOk(res, nombre, tel) {
    enviado = true;
    var pro = res.profesional || "", ficha = PRO_FICHA[pro];
    if (ficha) {
      var img = $("#leadOkLogo");
      if (img) { img.src = ficha.logo; img.alt = ficha.empresa; img.hidden = false; }
      var ico = $("#leadOkIco"); if (ico) ico.hidden = true;
    }
    var numCliente = tel.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
    $("#leadOkTit").textContent = "Listo, " + nombre.split(" ")[0] + ". Solicitud enviada";
    $("#leadOkTxt").textContent = pro
      ? pro + (ficha ? ", de " + ficha.empresa + "," : "") + " ya tiene tu solicitud y te llamará al " + numCliente + " para darte el presupuesto."
      : "Ya tenemos tu solicitud. Te llamamos al " + numCliente + " para darte el presupuesto.";
    var bLlamar = $("#leadOkLlamar"), bWa = $("#leadOkWa");
    if (bLlamar) {
      bLlamar.textContent = "📞 " + (pro ? "Llamar ahora a " + pro : "Llamar ahora");
      bLlamar.onclick = function () { g("event", "contact", { event_category: "contacto_llamada", event_label: "tras_formulario" }); location.href = "tel:" + res.telefono; };
    }
    if (bWa) bWa.onclick = function () {
      g("event", "contact", { event_category: "contacto_whatsapp", event_label: "tras_formulario" });
      var txt = "Hola, soy " + nombre + " (" + tel + "). Acabo de pedir presupuesto en OficioYa (" + (G.ciudadNombre || "") + ").";
      location.href = "https://wa.me/" + res.whatsapp + "?text=" + encodeURIComponent(txt);
    };
    if (leadBox) leadBox.hidden = true;
    if (okBox) { okBox.hidden = false; okBox.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  /* ---------- Barra fija en móvil: aparece al dejar atrás la herramienta ---------- */
  (function () {
    var bar = $("#gSticky");
    if (!bar || !tool || !("IntersectionObserver" in window)) return;
    var visible = true, pasada = false, escribiendo = false;
    function pinta() {
      var banner = document.getElementById("oyCk") || document.querySelector(".oyc-fondo");
      bar.classList.toggle("on", !visible && pasada && !escribiendo && !banner && window.innerWidth < 900);
    }
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      pasada = en[0].boundingClientRect.top < 0;
      pinta();
    }, { threshold: 0.05 }).observe(tool);
    document.addEventListener("focusin", function (e) { if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { escribiendo = true; pinta(); } });
    document.addEventListener("focusout", function () { escribiendo = false; pinta(); });
    window.addEventListener("resize", pinta);
    setInterval(pinta, 1500);
  })();

  /* ---------- Índice desplegable ---------- */
  $$(".g-toc-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      var box = b.parentNode; var abierto = box.classList.toggle("abierto");
      b.setAttribute("aria-expanded", abierto ? "true" : "false");
    });
  });

  window.OYGuia = api;
})();
