/* ============================================================
   OficioYa · oy-consent.js  ·  v1.0
   Un solo archivo para las 363 landings de /public.

   Hace cuatro cosas:
     1. Consent Mode v2 en denegado por defecto + banner de cookies
     2. Casilla obligatoria de Condiciones de Uso en el formulario
     3. Captura de ciudad desde el nombre del archivo o utm_campaign
     4. Añade el enlace a /cookies en el pie

   INSTALACIÓN: en el <head>, ANTES del bloque de gtag:
     <script src="/oy-consent.js"></script>

   INTERRUPTOR: OY.BLOQUEAR_HASTA_CONSENTIR
     false → el banner se muestra pero GA4/Ads siguen midiendo (fase 1)
     true  → nada mide hasta que el usuario acepta (fase 2, tras
             cerrar la ventana de observación de los sitelinks)
   ============================================================ */
(function () {
  "use strict";

  var OY = {
    BLOQUEAR_HASTA_CONSENTIR: false,   // ← cámbialo a true cuando cierre la ventana de Ads
    TERMINOS_VERSION: "2.0",
    COOKIES_VERSION: "1.0",
    DIAS_CONSENTIMIENTO: 180,
    DOMINIO_COOKIE: ".aficioya.com"
  };
  window.OY = OY;

  /* ---------- utilidades ---------- */
  function setCookie(n, v, dias) {
    try {
      var d = new Date();
      d.setTime(d.getTime() + dias * 864e5);
      document.cookie = n + "=" + encodeURIComponent(v) +
        ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax" +
        (location.hostname.indexOf("aficioya.com") > -1 ? ";domain=" + OY.DOMINIO_COOKIE : "");
    } catch (e) {}
  }
  function getCookie(n) {
    try {
      var m = document.cookie.match("(^|;)\\s*" + n + "\\s*=\\s*([^;]+)");
      return m ? decodeURIComponent(m[2]) : null;
    } catch (e) { return null; }
  }
  function leerConsent() {
    var raw = getCookie("oy_consent");
    if (!raw) { try { raw = localStorage.getItem("oy_consent"); } catch (e) {} }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function guardarConsent(obj) {
    obj.v = OY.COOKIES_VERSION;
    obj.t = new Date().toISOString();
    var s = JSON.stringify(obj);
    setCookie("oy_consent", s, OY.DIAS_CONSENTIMIENTO);
    try { localStorage.setItem("oy_consent", s); } catch (e) {}
  }

  /* ---------- 1. CONSENT MODE (antes de que cargue gtag) ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtagLocal() { window.dataLayer.push(arguments); }

  var previo = leerConsent();
  var concedido = previo
    ? { analytics: !!previo.analytics, ads: !!previo.ads }
    : { analytics: !OY.BLOQUEAR_HASTA_CONSENTIR, ads: !OY.BLOQUEAR_HASTA_CONSENTIR };

  gtagLocal("consent", "default", {
    ad_storage: concedido.ads ? "granted" : "denied",
    ad_user_data: concedido.ads ? "granted" : "denied",
    ad_personalization: concedido.ads ? "granted" : "denied",
    analytics_storage: concedido.analytics ? "granted" : "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500
  });

  function actualizarConsent(c) {
    gtagLocal("consent", "update", {
      ad_storage: c.ads ? "granted" : "denied",
      ad_user_data: c.ads ? "granted" : "denied",
      ad_personalization: c.ads ? "granted" : "denied",
      analytics_storage: c.analytics ? "granted" : "denied"
    });
  }

  /* ---------- 2. CIUDAD DESDE EL NOMBRE DEL ARCHIVO ---------- */
  var CIUDADES = {
    sevilla: "Sevilla", malaga: "Málaga", granada: "Granada", cordoba: "Córdoba",
    almeria: "Almería", jerez: "Jerez", huelva: "Huelva", cadiz: "Cádiz", jaen: "Jaén",
    "dos-hermanas": "Sevilla", "alcala-de-guadaira": "Sevilla",
    "mairena-del-aljarafe": "Sevilla", tomares: "Sevilla", camas: "Sevilla",
    bormujos: "Sevilla", "san-juan-de-aznalfarache": "Sevilla", gelves: "Sevilla",
    "la-rinconada": "Sevilla", "coria-del-rio": "Sevilla", montequinto: "Sevilla"
  };
  function detectarCiudad() {
    var ruta = location.pathname.toLowerCase().replace(/\.html?$/, "");
    var claves = Object.keys(CIUDADES).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < claves.length; i++) {
      if (ruta.indexOf(claves[i]) > -1) return CIUDADES[claves[i]];
    }
    try {
      var camp = (new URLSearchParams(location.search).get("utm_campaign") || "").toLowerCase();
      for (var j = 0; j < claves.length; j++) {
        if (camp.indexOf(claves[j]) > -1) return CIUDADES[claves[j]];
      }
    } catch (e) {}
    return "";   // en blanco → aparece en amarillo en el admin
  }
  OY.ciudad = detectarCiudad();
  OY.landing = location.pathname.replace(/^\//, "").replace(/\.html?$/, "") || "index";

  try {
    var qs = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (k) {
      var v = qs.get(k);
      if (v) { try { localStorage.setItem("oy_" + k, v); } catch (e) {} }
    });
    // gclid / wbraid / gbraid — algunas landings no lo capturan por su cuenta
    ["gclid", "wbraid", "gbraid"].forEach(function (k) {
      var v = qs.get(k);
      if (v) { try { localStorage.setItem("oy_" + k, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {} }
    });
  } catch (e) {}

  function leerUtm() {
    var out = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (k) {
      try { var v = localStorage.getItem("oy_" + k); if (v) out[k] = v; } catch (e) {}
    });
    return out;
  }
  OY.leerUtm = leerUtm;

  /* ---------- 3. ESTILOS ---------- */
  function inyectarEstilos() {
    var s = document.createElement("style");
    s.textContent = [
      "#oyCk{position:fixed;left:0;right:0;bottom:0;z-index:9000;background:#fff;border-top:1px solid #E7E9EE;box-shadow:0 -6px 28px rgba(16,24,44,.14);padding:16px 20px calc(16px + env(safe-area-inset-bottom));font-family:Inter,Arial,sans-serif;animation:oyUp .28s ease both}",
      "@keyframes oyUp{from{transform:translateY(100%)}to{transform:translateY(0)}}",
      "#oyCk .oyIn{max-width:1120px;margin:0 auto;display:flex;gap:18px;align-items:center;flex-wrap:wrap}",
      "#oyCk p{flex:1;min-width:240px;font-size:13px;line-height:1.6;color:#5B6472;margin:0}",
      "#oyCk a{color:#8C670C;text-decoration:underline}",
      "#oyCk .oyBt{display:flex;gap:8px;flex-wrap:wrap}",
      "#oyCk button{font-family:inherit;font-size:13.5px;font-weight:700;padding:11px 20px;border-radius:9px;cursor:pointer;border:1px solid #E7E9EE;background:#fff;color:#5B6472}",
      "#oyCk button.oyOk{background:#F0A93B;border-color:#F0A93B;color:#1D1305}",
      "#oyCk button:hover{border-color:#B7860F}",
      "@media(max-width:768px){#oyCk{bottom:0;padding-bottom:calc(14px + env(safe-area-inset-bottom))}#oyCk .oyIn{gap:12px}#oyCk .oyBt{width:100%}#oyCk .oyBt button{flex:1}.mcta{bottom:auto!important}}",
      "#oyCfg{position:fixed;inset:0;z-index:9100;background:rgba(16,24,44,.55);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,Arial,sans-serif}",
      "#oyCfg .oyBox{background:#fff;border-radius:16px;max-width:460px;width:100%;padding:26px;max-height:86vh;overflow:auto}",
      "#oyCfg h3{font-size:17px;font-weight:800;color:#10182C;margin:0 0 6px}",
      "#oyCfg .oyRow{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-top:1px solid #E7E9EE}",
      "#oyCfg .oyRow strong{display:block;font-size:13.5px;color:#10182C;margin-bottom:3px}",
      "#oyCfg .oyRow span{font-size:12.5px;color:#5B6472;line-height:1.55}",
      "#oyCfg input[type=checkbox]{width:19px;height:19px;margin-top:2px;accent-color:#B7860F;flex-shrink:0}",
      "#oyTerms{display:flex;gap:9px;align-items:flex-start;margin:2px 0 12px;cursor:pointer;padding:2px 0}",
      "#oyTerms input{width:18px;height:18px;margin-top:1px;accent-color:#B7860F;flex-shrink:0;cursor:pointer}",
      "#oyTerms span{font-size:11.5px;line-height:1.5;color:#8891A0}",
      "#oyTerms a{color:#8C670C;text-decoration:underline}",
      "#oyTerms.err span{color:#B42318}",
      "#oyTerms.err input{outline:2px solid #B42318;outline-offset:2px;border-radius:3px}",
      "#oyTermsErr{display:none;font-size:11.5px;color:#B42318;font-weight:600;margin:-8px 0 12px;padding-left:27px}",
      "#oyTermsErr.on{display:block}",
      "@keyframes oyShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}",
      ".oyShake{animation:oyShake .3s ease}"
    ].join("");
    document.head.appendChild(s);
  }

  /* ---------- 4. BANNER ---------- */
  function pintarBanner() {
    if (document.getElementById("oyCk")) return;
    var d = document.createElement("div");
    d.id = "oyCk";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-label", "Preferencias de cookies");
    d.innerHTML =
      '<div class="oyIn">' +
        '<p>Usamos cookies propias necesarias y, con su permiso, cookies de análisis y publicidad para medir nuestras campañas. Puede aceptarlas, rechazarlas o elegir. Más detalle en la <a href="/cookies">Política de Cookies</a>.</p>' +
        '<div class="oyBt">' +
          '<button type="button" id="oyCfgBtn">Configurar</button>' +
          '<button type="button" id="oyNo">Rechazar</button>' +
          '<button type="button" class="oyOk" id="oySi">Aceptar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(d);

    document.getElementById("oySi").onclick = function () { decidir(true, true); };
    document.getElementById("oyNo").onclick = function () { decidir(false, false); };
    document.getElementById("oyCfgBtn").onclick = abrirPanel;
  }

  function decidir(analytics, ads) {
    var c = { analytics: analytics, ads: ads };
    guardarConsent(c);
    actualizarConsent(c);
    var b = document.getElementById("oyCk"); if (b) b.remove();
    var p = document.getElementById("oyCfg"); if (p) p.remove();
  }

  function abrirPanel() {
    if (document.getElementById("oyCfg")) return;
    var prev = leerConsent() || { analytics: false, ads: false };
    var d = document.createElement("div");
    d.id = "oyCfg";
    d.innerHTML =
      '<div class="oyBox">' +
        '<h3>Configurar cookies</h3>' +
        '<div class="oyRow"><input type="checkbox" checked disabled>' +
          '<div><strong>Necesarias</strong><span>Imprescindibles para que la web funcione. No se pueden desactivar.</span></div></div>' +
        '<div class="oyRow"><input type="checkbox" id="oyA"' + (prev.analytics ? " checked" : "") + '>' +
          '<div><strong>Análisis</strong><span>Nos permiten saber qué páginas se visitan para mejorar el servicio (Google Analytics).</span></div></div>' +
        '<div class="oyRow"><input type="checkbox" id="oyP"' + (prev.ads ? " checked" : "") + '>' +
          '<div><strong>Publicidad</strong><span>Miden la eficacia de nuestros anuncios (Google Ads y Meta).</span></div></div>' +
        '<div style="display:flex;gap:8px;margin-top:18px">' +
          '<button type="button" id="oyCancel" style="flex:1;font-family:inherit;font-size:13.5px;font-weight:700;padding:11px;border-radius:9px;border:1px solid #E7E9EE;background:#fff;color:#5B6472;cursor:pointer">Cancelar</button>' +
          '<button type="button" id="oySave" style="flex:1;font-family:inherit;font-size:13.5px;font-weight:700;padding:11px;border-radius:9px;border:none;background:#F0A93B;color:#1D1305;cursor:pointer">Guardar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(d);
    document.getElementById("oySave").onclick = function () {
      decidir(document.getElementById("oyA").checked, document.getElementById("oyP").checked);
    };
    document.getElementById("oyCancel").onclick = function () { d.remove(); };
  }
  OY.abrir = abrirPanel;
  window.OYConsent = { abrir: abrirPanel };

  /* ---------- 5. CASILLA DE CONDICIONES ---------- */
  function buscarBotonEnvio() {
    // Cada plantilla de landing usa un id/clase distinto. Lo fiable es
    // localizar el elemento cuyo onclick llama a enviarSolicitud().
    var todos = document.querySelectorAll("button, a, input[type=button], input[type=submit]");
    for (var i = 0; i < todos.length; i++) {
      var oc = todos[i].getAttribute("onclick") || "";
      if (oc.indexOf("enviarSolicitud") > -1) return todos[i];
    }
    return document.getElementById("resultCta") ||
           document.querySelector(".btn-send") ||
           document.querySelector(".btn-result-cta");
  }

  function inyectarCasilla() {
    var btn = buscarBotonEnvio();
    if (!btn || document.getElementById("oyTerms")) return;

    var lab = document.createElement("label");
    lab.id = "oyTerms";
    lab.innerHTML =
      '<input type="checkbox" id="oyTermsCk">' +
      '<span>He leído y acepto las <a href="/terminos" target="_blank" rel="noopener">Condiciones de Uso</a> y la <a href="/privacidad" target="_blank" rel="noopener">Política de Privacidad</a>.</span>';

    var err = document.createElement("p");
    err.id = "oyTermsErr";
    err.textContent = "Debe aceptar las condiciones para continuar";

    btn.parentNode.insertBefore(lab, btn);
    btn.parentNode.insertBefore(err, btn);

    document.getElementById("oyTermsCk").addEventListener("change", function () {
      if (this.checked) { lab.classList.remove("err"); err.classList.remove("on"); }
    });

    // Envolvemos la función de envío de la landing
    var orig = window.enviarSolicitud;
    if (typeof orig !== "function") return;

    window.enviarSolicitud = function () {
      var ck = document.getElementById("oyTermsCk");
      if (ck && !ck.checked) {
        lab.classList.add("err");
        err.classList.add("on");
        lab.classList.remove("oyShake");
        void lab.offsetWidth;
        lab.classList.add("oyShake");
        lab.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      // Registro de la aceptación para que la app lo guarde en legal_acceptances
      guardarAceptacion();
      return orig.apply(this, arguments);
    };
  }

  function guardarAceptacion() {
    var reg = {
      terminos: OY.TERMINOS_VERSION,
      privacidad: OY.TERMINOS_VERSION,
      at: new Date().toISOString(),
      punto: "landing:" + OY.landing,
      ciudad: OY.ciudad,
      ua: navigator.userAgent.slice(0, 180)
    };
    var s = JSON.stringify(reg);
    setCookie("oy_terms", s, 30);
    try { localStorage.setItem("oy_terms", s); } catch (e) {}
    try {
      localStorage.setItem("oy_ciudad", OY.ciudad);
      localStorage.setItem("oy_landing", OY.landing);
    } catch (e) {}
  }

  /* ---------- 6. ENLACE A COOKIES EN EL PIE ---------- */
  function arreglarPie() {
    var fl = document.querySelector(".foot-links");
    if (!fl || fl.querySelector('[href="/cookies"]')) return;
    var a = document.createElement("a");
    a.href = "/cookies";
    a.textContent = "Cookies";
    var inicio = fl.querySelector('[href="/"]');
    if (inicio) fl.insertBefore(a, inicio); else fl.appendChild(a);
  }

  /* ---------- TEST A/B/C «fondo del hero» (fondo_hero_v1) ----------
     A = cabecera de siempre · B = pared que pinta un rodillo · C = salón de fondo.
     La versión se elige aquí, antes de pintar la página (sin parpadeo), y
     /oy-ab-fondo.js monta el fondo, marca visitas y leads, y lo deshace si la
     página no es una landing de pintura con calculadora.
     Reparto 1/3 por visitante (localStorage); forzar con ?ab=a, ?ab=b o ?ab=c. */
  /* 09/11/2026: Córdoba fuera del test (ahí va solo la cabecera de siempre). */
  try {
    (function () {
      var ruta = location.pathname || "";
      if (!/pint|gotele|alisar|moho|humedad/i.test(ruta) || /fachada|local|baratos|carpinter|admin|captacion|panel|cordoba/i.test(ruta)) return;
      var TEST = "fondo_hero_v1", CLAVE = "oy_ab_" + TEST, v = "";
      try { v = (new URLSearchParams(location.search).get("ab") || "").toUpperCase(); } catch (e) {}
      if (v === "A" || v === "B" || v === "C") {
        try { localStorage.setItem(CLAVE, v); } catch (e) {}
      } else {
        try { v = localStorage.getItem(CLAVE) || ""; } catch (e) { v = ""; }
        if (v !== "A" && v !== "B" && v !== "C") {
          var r = Math.random();
          v = r < 1 / 3 ? "A" : r < 2 / 3 ? "B" : "C";
          try { localStorage.setItem(CLAVE, v); } catch (e) {}
        }
      }
      window.OY_FONDO = { test: TEST, variante: v };
      var raiz = document.documentElement, cab = document.head || raiz;
      raiz.classList.add("ab-fondo-" + v.toLowerCase());
      if (v !== "A") {
        var st = document.createElement("style");
        st.id = "oy-ab-fondo-css";
        st.textContent = "html.ab-fondo-b,html.ab-fondo-c,.ab-fondo-b body,.ab-fondo-c body{overflow-x:clip}\n.ab-fondo-b .hero,.ab-fondo-c .hero{position:relative;isolation:isolate}\n.ab-fondo-b .hero-foto,.ab-fondo-c .hero-foto{display:none}\n.ab-fondo-b .hero::before,.ab-fondo-c .hero::before{content:\"\";position:absolute;top:0;left:50%;width:100vw;margin-left:-50vw;height:var(--bg-h,560px);z-index:-2;background:#DCD5C6}\n.ab-fondo-c .hero::before{background:#1B2335}\n@media(min-width:901px){.ab-fondo-b .hero::before,.ab-fondo-c .hero::before{height:var(--bg-h,100%)}}\n.hero-bg{position:absolute;top:0;left:50%;width:100vw;margin-left:-50vw;height:var(--bg-h,100%);z-index:-1;overflow:hidden;pointer-events:none}\n.hero-bg img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;max-width:none}\n.pared-antes{filter:sepia(.7) saturate(.75) brightness(.72) contrast(.88)}\n.pared-manchas{position:absolute;inset:0;mix-blend-mode:multiply;background:radial-gradient(ellipse 30% 22% at 16% 82%,rgba(122,94,48,.34),transparent 70%),radial-gradient(ellipse 22% 16% at 74% 88%,rgba(98,84,58,.28),transparent 70%),radial-gradient(ellipse 18% 12% at 88% 18%,rgba(120,98,60,.2),transparent 70%),radial-gradient(ellipse 14% 10% at 40% 30%,rgba(120,100,70,.14),transparent 70%),linear-gradient(to top,rgba(104,88,58,.3),transparent 34%)}\n.pared-tiras{position:absolute;inset:0}\n.tira{position:absolute;height:0;overflow:hidden}\n.tira.baja{top:0}\n.tira.sube{bottom:0}\n.tira img{filter:brightness(1.05) saturate(.95)}\n.tira.sube img{top:auto;bottom:0}\n.tira i{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.38),rgba(255,255,255,.1));opacity:0}\n.pared-luz{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.16) 58%,rgba(255,255,255,.78) 90%,#fff 100%)}\n@media(min-width:901px){.pared-luz{background:linear-gradient(90deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,.2) 50%,rgba(255,255,255,0) 100%)}}\n.rodillo{position:absolute;left:0;top:0;width:var(--rod-w,110px);opacity:0;filter:drop-shadow(0 8px 12px rgba(16,24,44,.28));will-change:transform}\n.rodillo svg{display:block;width:100%;height:auto}\n.ab-fondo-b .hero h1,.ab-fondo-b .hero-sub{text-shadow:0 1px 16px rgba(255,255,255,.9)}\n.salon-foto{transform-origin:60% 40%;animation:oyKen 16s ease-out both}\n@keyframes oyKen{from{transform:scale(1.08)}to{transform:scale(1)}}\n.salon-velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,24,44,.48) 0%,rgba(16,24,44,.66) 55%,rgba(16,24,44,.82) 100%)}\n@media(min-width:901px){.salon-velo{background:linear-gradient(90deg,rgba(16,24,44,.86) 0%,rgba(16,24,44,.6) 50%,rgba(16,24,44,.22) 100%)}}\n.ab-fondo-c .hero h1{color:#fff}\n.ab-fondo-c .hero h1 em{color:#F5C96B}\n.ab-fondo-c .hero-sub{color:rgba(255,255,255,.86)}\n.ab-fondo-c .hero-sub strong{color:#fff}\n.ab-fondo-c .eyebrow{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.32);color:#fff}\n.ab-fondo-c .trust-chip{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.26);color:#fff}\n.ab-fondo-c .hero-note{color:rgba(255,255,255,.72)}\n@media(prefers-reduced-motion:reduce){.salon-foto{animation:none}}";
        cab.appendChild(st);
        var pc = document.createElement("link");
        pc.rel = "preconnect";
        pc.href = "https://images.unsplash.com";
        cab.appendChild(pc);
      }
      var sc = document.createElement("script");
      sc.src = "/oy-ab-fondo.js?v=1";
      sc.async = false;
      cab.appendChild(sc);
    })();
  } catch (e) {}

  /* ---------- TEST A/B formulario arriba: CERRADO el 04/11/2026 ----------
     Ganó A (la calculadora): 3 leads en 44 visitas frente a 0 en 64 con el
     formulario corto arriba (B). Ya no se carga /oy-ab.js: todas las visitas
     ven la calculadora. oy-ab.js se queda en el repo solo como histórico. */

  /* ---------- VISITA a la landing: una por carga, sin cookies ni datos personales ---------- */
  try {
    var contarVisita = function () {
      try {
        var q = location.search || "", ref = document.referrer || "";
        var fuente = /[?&](gclid|gbraid|wbraid)=/.test(q) || (/utm_source=google/i.test(q) && /utm_medium=(cpc|ppc|paid)/i.test(q)) ? "google_ads"
          : /[?&]fbclid=/.test(q) || /utm_source=(facebook|instagram|meta|fb|ig)/i.test(q) ? "meta"
          : /\/\/(www\.)?google\./i.test(ref) ? "google" : !ref ? "directo" : "otro";
        var tag = document.querySelector("script[data-oficio]");
        var ab = window.OYAB || {};
        var k = window.OY_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE";
        fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/rest/v1/rpc/mkt_visita", {
          method: "POST", keepalive: true,
          headers: { "Content-Type": "application/json", apikey: k, Authorization: "Bearer " + k },
          body: JSON.stringify({ p: {
            landing: location.pathname, oficio: tag ? tag.getAttribute("data-oficio") : "", fuente: fuente,
            dispositivo: (window.innerWidth || 1024) < 768 ? "movil" : "ordenador",
            ab_test: ab.test || "", ab_variante: ab.variante || ""
          } })
        }).catch(function () {});
      } catch (e) {}
    };
    if (!/\/(admin|captacion|panel)/i.test(location.pathname) && location.pathname !== "/") {
      if (document.readyState === "complete") setTimeout(contarVisita, 600);
      else window.addEventListener("load", function () { setTimeout(contarVisita, 600); });
    }
  } catch (e) {}

  /* ---------- ARRANQUE ---------- */
  function init() {
    inyectarEstilos();
    arreglarPie();
    inyectarCasilla();
    if (!leerConsent()) pintarBanner();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
