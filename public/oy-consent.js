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
  function inyectarCasilla() {
    var btn = document.getElementById("resultCta");
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
