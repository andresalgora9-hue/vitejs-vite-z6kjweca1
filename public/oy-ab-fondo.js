/* ============================================================
   OficioYa · oy-ab-fondo.js · Test A/B/C «fondo del hero» (fondo_hero_v1)
   Lo carga /oy-consent.js, que ya ha elegido la versión y ha puesto la clase
   ab-fondo-a|b|c en <html> antes de pintar la página.
   A = la cabecera de siempre.
   B = pared que primero se ve vieja y un rodillo pinta en franjas.
   C = salón de fondo con velo azul y texto en blanco.
   Solo en landings de pintura con calculadora que envían el lead por la RPC;
   si la página no encaja, se deshace todo y no se mide.
   - Visitas: window.OYAB hace que oy-consent.js las guarde con ab_test / ab_variante.
   - Leads: se guardan con ab_test / ab_variante / ab_origen en budget_requests.
   - Evento GA4 por visita: ab_fondo_a / ab_fondo_b / ab_fondo_c.
   - Fotos de banco (Unsplash), provisionales.
   ============================================================ */
(function () {
  "use strict";
  var F = window.OY_FONDO;
  if (!F || !F.variante || window.OYAB) return;
  var TEST = F.test, V = F.variante, raiz = document.documentElement;
  var PARED = "1643699302640-e8dd689194f4", SALON = "1762529716272-b316f61502e7";
  var ROD = '<svg viewBox="0 0 152 130" aria-hidden="true" focusable="false"><rect x="6" y="6" width="132" height="34" rx="15" fill="#FBFAF6" stroke="#CFC8B8" stroke-width="2"/><path d="M22 13h100M16 20h112M14 27h116M16 34h112" stroke="#E4DED0" stroke-width="2" stroke-linecap="round"/><path d="M138 23h4c4 0 6 2 6 6v24c0 4-2 6-6 6H104c-5 0-8 3-8 8v9" fill="none" stroke="#6B7383" stroke-width="5" stroke-linecap="round"/><rect x="85" y="74" width="22" height="52" rx="11" fill="#10182C"/><rect x="94" y="82" width="4" height="34" rx="2" fill="#B7860F" opacity=".9"/></svg>';

  function g() { try { if (typeof window.gtag === "function") window.gtag.apply(window, arguments); } catch (e) {} }
  function foto(id, w) { return "https://images.unsplash.com/photo-" + id + "?auto=format&amp;fit=crop&amp;q=72&amp;w=" + w; }
  function juego(id) { return foto(id, 800) + " 800w, " + foto(id, 1400) + " 1400w, " + foto(id, 2000) + " 2000w"; }

  /* ---------- ¿Esta página entra en el test? ---------- */
  function apta() {
    if (typeof window.OY_RPC !== "string" || typeof window.OY_KEY !== "string") return false;
    if (!document.getElementById("presupuesto")) return false;
    if (!document.querySelector("section.hero .hero-grid h1")) return false;
    var s = document.querySelector('script[src*="oy-contacto"]');
    var oficio = (s && s.getAttribute("data-oficio")) || "";
    if (oficio) return oficio.toLowerCase() === "pintor";
    return /pint|gotele|alisar|moho|humedad|fachada/i.test(location.pathname);
  }
  function deshacer() {
    raiz.classList.remove("ab-fondo-a", "ab-fondo-b", "ab-fondo-c");
    var st = document.getElementById("oy-ab-fondo-css");
    if (st && st.parentNode) st.parentNode.removeChild(st);
    window.OY_FONDO = null;
  }

  /* ---------- Guardar la versión en cada lead de la página (campos solo de admin) ---------- */
  function marcarLeads(v) {
    var original = window.fetch;
    if (typeof original !== "function") return;
    window.fetch = function (input, init) {
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        if (url.indexOf("oy_lead_contacto") > -1 && init && typeof init.body === "string") {
          var b = JSON.parse(init.body);
          if (b && b.p && !b.p.ab_test) {
            b.p.ab_test = TEST;
            b.p.ab_variante = v;
            if (!b.p.ab_origen) b.p.ab_origen = b.p.canal === "llamada" ? "llamada" : b.p.canal === "whatsapp" ? "whatsapp" : "calculadora";
            init = Object.assign({}, init, { body: JSON.stringify(b) });
          }
        }
      } catch (e) {}
      return original.call(this, input, init);
    };
  }

  /* ---------- Fondo B (pared) o C (salón) ---------- */
  function montar() {
    var hero = document.querySelector("section.hero");
    if (!hero) return;
    var grid = hero.querySelector(".hero-grid"), col = grid && grid.firstElementChild;
    var bg = document.createElement("div");
    bg.className = "hero-bg";
    bg.setAttribute("aria-hidden", "true");
    if (V === "B") {
      bg.innerHTML = '<img class="pared-antes" src="' + foto(PARED, 1400) + '" srcset="' + juego(PARED) + '" sizes="100vw" alt="" fetchpriority="high"><div class="pared-manchas"></div><div class="pared-tiras"></div><div class="pared-luz"></div><div class="rodillo">' + ROD + '</div>';
    } else {
      bg.innerHTML = '<img class="salon-foto" src="' + foto(SALON, 1400) + '" srcset="' + juego(SALON) + '" sizes="100vw" alt="" fetchpriority="high"><div class="salon-velo"></div>';
    }
    hero.insertBefore(bg, hero.firstChild);
    var anchoAntes = window.innerWidth, anims = [], espera;

    function medir() {
      if (!col) return;
      var hr = hero.getBoundingClientRect(), cr = col.getBoundingClientRect();
      var h = window.innerWidth <= 900 ? Math.round(cr.bottom - hr.top + 34) : Math.round(hr.height);
      if (h > 0) hero.style.setProperty("--bg-h", h + "px");
    }
    function parar() {
      for (var i = 0; i < anims.length; i++) { try { anims[i].cancel(); } catch (e) {} }
      anims = [];
    }
    function pintar() {
      var tiras = bg.querySelector(".pared-tiras"), rod = bg.querySelector(".rodillo"), antes = bg.querySelector(".pared-antes");
      if (!tiras || !rod || !antes) return;
      parar();
      tiras.innerHTML = "";
      var W = bg.clientWidth, H = bg.clientHeight;
      if (!W || !H) return;
      var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      var n = Math.max(4, Math.min(10, Math.round(W / 115))), sw = W / n;
      var T = Math.min(950, Math.max(520, 4400 / n)), st = T * 0.86, d0 = 350;
      var src = antes.currentSrc || antes.src, rw = Math.round(sw * 152 / 132), rh = rw * 130 / 152;
      rod.style.setProperty("--rod-w", rw + "px");
      function pos(x, y) { return "translate(" + (x - 0.4737 * rw).toFixed(1) + "px," + (y - 0.1769 * rh).toFixed(1) + "px)"; }
      var tot = d0 + n * T + 700, kf = [], yFin = 0;
      function en(t) { return Math.min(1, Math.max(0, t / tot)); }
      kf.push({ offset: 0, transform: pos(sw / 2, 0), opacity: 0 });
      kf.push({ offset: en(d0), transform: pos(sw / 2, 0), opacity: 1, easing: "ease-in-out" });
      for (var i = 0; i < n; i++) {
        var baja = i % 2 === 0, y0 = baja ? 0 : H, y1 = baja ? H : 0, x = i * sw + sw / 2, ini = d0 + i * T;
        yFin = y1;
        var tira = document.createElement("div");
        tira.className = "tira " + (baja ? "baja" : "sube");
        tira.style.left = (i * sw).toFixed(1) + "px";
        tira.style.width = (Math.ceil(sw) + 1) + "px";
        var im = document.createElement("img");
        im.alt = "";
        im.src = src;
        im.style.left = (-i * sw).toFixed(1) + "px";
        im.style.width = W + "px";
        im.style.height = H + "px";
        var brillo = document.createElement("i");
        tira.appendChild(im);
        tira.appendChild(brillo);
        tiras.appendChild(tira);
        if (reduce || !tira.animate) { tira.style.height = H + "px"; continue; }
        anims.push(tira.animate([{ height: "0px" }, { height: H + "px" }], { delay: ini, duration: st, easing: "ease-in-out", fill: "both" }));
        anims.push(brillo.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0 }], { delay: ini, duration: T * 2.4, fill: "both" }));
        if (i > 0) kf.push({ offset: en(ini), transform: pos(x, y0), opacity: 1, easing: "ease-in-out" });
        kf.push({ offset: en(ini + st), transform: pos(x, y1), opacity: 1, easing: "ease-in-out" });
      }
      if (reduce || !rod.animate) { rod.style.opacity = "0"; return; }
      kf.push({ offset: 1, transform: pos(W + rw, yFin), opacity: 0 });
      anims.push(rod.animate(kf, { duration: tot, fill: "both" }));
    }

    medir();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { medir(); });
    window.addEventListener("load", medir);
    window.addEventListener("resize", function () {
      if (Math.abs(window.innerWidth - anchoAntes) < 2) return;
      anchoAntes = window.innerWidth;
      clearTimeout(espera);
      espera = setTimeout(function () { medir(); if (V === "B") pintar(); }, 200);
    });
    if (V === "B") {
      var antes = bg.querySelector(".pared-antes");
      if (antes.complete && antes.naturalWidth) pintar();
      else antes.addEventListener("load", function () { medir(); pintar(); });
    }
  }

  /* ---------- Arranque ---------- */
  function arrancar() {
    if (!apta()) { deshacer(); return; }
    window.OYAB = { test: TEST, variante: V };
    marcarLeads(V);
    if (V === "B" || V === "C") { try { montar(); } catch (e) {} }
    g("event", "ab_fondo_" + V.toLowerCase(), { test: TEST, variante: V, landing: (window.ORIGEN && window.ORIGEN.landing) || location.pathname });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
