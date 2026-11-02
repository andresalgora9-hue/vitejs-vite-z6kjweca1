/* ============================================================
   OficioYa · oy-ab.js · Test A/B "formulario arriba" (v1)
   Solo en landings de pintura que envían el lead por la RPC
   (las que tienen OY_RPC / OY_KEY y la calculadora #presupuesto).

   A = la landing tal cual (calculadora primero).
   B = formulario corto (nombre + teléfono) en la primera pantalla;
       la calculadora sigue debajo y también sirve para pedir.

   - Reparto 50/50 por visitante, guardado en localStorage.
   - Forzar una variante para revisar: ?ab=a  o  ?ab=b
   - Cada lead de la página (calculadora, formulario de arriba o
     llamada) se guarda con ab_test / ab_variante / ab_origen en
     budget_requests. Solo lo ve el admin: el profesional no ve nada
     del test (la descripción no se toca).
   - Evento GA4 por visita: ab_form_arriba_a / ab_form_arriba_b
   ============================================================ */
(function () {
  "use strict";
  if (window.OYAB) return;

  var TEST = "form_arriba_v1";
  var CLAVE = "oy_ab_" + TEST;

  /* ---------- ¿Esta página entra en el test? ---------- */
  function apta() {
    if (typeof window.OY_RPC !== "string" || typeof window.OY_KEY !== "string") return false;
    if (!document.getElementById("presupuesto")) return false;
    if (!document.querySelector(".hero-grid h1")) return false;
    var s = document.querySelector('script[src*="oy-contacto"]');
    var oficio = s && s.dataset ? (s.dataset.oficio || "") : "";
    if (oficio) return oficio.toLowerCase() === "pintor";
    return /pint|gotele|alisar|moho|humedad|fachada/i.test(location.pathname);
  }

  /* ---------- Variante ---------- */
  function elegirVariante() {
    var q = "";
    try { q = (new URLSearchParams(location.search).get("ab") || "").toUpperCase(); } catch (e) {}
    if (q === "A" || q === "B") {
      try { localStorage.setItem(CLAVE, q); } catch (e) {}
      return q;
    }
    var v = null;
    try { v = localStorage.getItem(CLAVE); } catch (e) {}
    if (v !== "A" && v !== "B") {
      v = Math.random() < 0.5 ? "A" : "B";
      try { localStorage.setItem(CLAVE, v); } catch (e) {}
    }
    return v;
  }

  /* ---------- Guardar la variante en cada lead de la página (campos solo de admin) ---------- */
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

  /* ---------- Utilidades ---------- */
  function g() { if (typeof window.gtag === "function") { try { window.gtag.apply(null, arguments); } catch (e) {} } }

  function valorLead() {
    var s = document.querySelector('script[src*="oy-contacto"]');
    var n = s && s.dataset ? Number(s.dataset.valor) : NaN;
    if (!isNaN(n) && n > 0) return n;
    if (typeof window.VALOR_LEAD === "number") return window.VALOR_LEAD;
    return 80;
  }

  function origen() {
    var o = {};
    try { o = Object.assign({}, window.ORIGEN || {}); } catch (e) {}
    try {
      var q = new URLSearchParams(location.search);
      ["gclid", "utm_source", "utm_campaign", "utm_content"].forEach(function (k) { if (q.get(k) && !o[k]) o[k] = q.get(k); });
    } catch (e) {}
    if (!o.gclid && typeof window.gclidGuardado === "function") { try { o.gclid = window.gclidGuardado() || ""; } catch (e) {} }
    if (!o.gclid) {
      try {
        var raw = JSON.parse(localStorage.getItem("oy_gclid") || "null");
        if (raw && raw.v && Date.now() - (raw.t || 0) < 90 * 864e5) o.gclid = raw.v;
      } catch (e) {}
    }
    if (!o.gclid) {
      var m = document.cookie.match(/(?:^|;\s*)_gcl_aw=([^;]+)/);
      if (m) { var p = decodeURIComponent(m[1]).split("."); if (p.length >= 3) o.gclid = p.slice(2).join("."); }
    }
    if (!o.landing) o.landing = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
    if (!o.city_slug) o.city_slug = "sevilla";
    return o;
  }

  function zonaBonita(o) {
    var z = o.zona || o.city_slug || "sevilla";
    if (typeof window.bonitoZona === "function") { try { return window.bonitoZona(z); } catch (e) {} }
    return String(z).replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- Estilos de la variante B ---------- */
  var CSS = [
    ".oyfa{background:#fff;border:1.5px solid var(--line,#E7E9EE);border-radius:16px;padding:16px;margin:16px 0 14px;box-shadow:var(--shadow,0 10px 30px rgba(16,24,44,.06));max-width:480px;box-sizing:border-box}",
    ".oyfa-t{font-family:Sora,Inter,sans-serif;font-weight:800;font-size:17px;line-height:1.25;color:var(--ink,#10182C);margin:0}",
    ".oyfa-s{font-size:13px;line-height:1.45;color:var(--ink-soft,#5B6472);margin:4px 0 12px}",
    ".oyfa-f{display:grid;grid-template-columns:1fr;gap:8px}",
    "@media(min-width:480px){.oyfa-f{grid-template-columns:1fr 1fr}}",
    ".oyfa-in{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:12px 13px;border:1.5px solid var(--line,#E7E9EE);border-radius:10px;color:var(--ink,#10182C);background:#fff;outline:none}",
    ".oyfa-in:focus{border-color:var(--cta,#F0A93B)}",
    ".oyfa-legal{display:flex;gap:8px;align-items:flex-start;margin:10px 0 0;cursor:pointer}",
    ".oyfa-legal input{width:18px;height:18px;margin:1px 0 0;accent-color:#B7860F;flex-shrink:0;cursor:pointer}",
    ".oyfa-legal span{font-size:11.5px;line-height:1.45;color:var(--ink-faint,#8891A0)}",
    ".oyfa-legal a{color:var(--gold-deep,#8C670C);text-decoration:underline}",
    ".oyfa-legal.err span{color:#B42318}",
    ".oyfa-legal.err input{outline:2px solid #B42318;outline-offset:2px;border-radius:3px}",
    ".oyfa-err{font-size:12.5px;line-height:1.4;color:#B42318;font-weight:600;margin-top:6px}",
    ".oyfa-err:empty{display:none}",
    ".oyfa-btn{display:block;width:100%;margin-top:10px;padding:14px 16px;border:0;border-radius:10px;background:var(--cta,#F0A93B);color:var(--cta-ink,#1D1305);font:inherit;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px rgba(240,169,59,.35)}",
    ".oyfa-btn:hover{background:var(--cta-hover,#E3971F)}",
    ".oyfa-btn[disabled]{opacity:.6;cursor:default}",
    ".oyfa-trampa{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important}",
    ".oyfa-ok{text-align:center;padding:4px 0}",
    ".oyfa-ok h3{font-family:Sora,Inter,sans-serif;font-size:18px;font-weight:700;color:var(--ink,#10182C);margin:8px 0 6px}",
    ".oyfa-ok p{font-size:13.5px;line-height:1.55;color:var(--ink-soft,#5B6472);margin:0 0 12px}",
    ".oyfa-calc{display:inline-block;font-size:14px;line-height:1.4;color:var(--ink-soft,#5B6472);text-decoration:none}",
    ".oyfa-calc b{color:var(--gold-deep,#8C670C);text-decoration:underline}",
    "@keyframes oyfaShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}",
    ".oyfa-shake{animation:oyfaShake .3s ease}"
  ].join("\n");

  /* ---------- Variante B: formulario corto arriba ---------- */
  function montarB(v) {
    var h1 = document.querySelector(".hero-grid h1");
    var col = h1.parentElement;
    var sub = col.querySelector(".hero-sub");

    var st = document.createElement("style");
    st.id = "oyfa-css";
    st.textContent = CSS;
    document.head.appendChild(st);

    var card = document.createElement("div");
    card.className = "oyfa";
    card.id = "oyFormArriba";
    card.innerHTML =
      '<p class="oyfa-t">Pide tu presupuesto gratis</p>' +
      '<p class="oyfa-s">Te llama un pintor verificado de tu zona. Sin compromiso.</p>' +
      '<div class="oyfa-f">' +
        '<input class="oyfa-in" id="oyfaNombre" type="text" autocomplete="name" maxlength="80" placeholder="Tu nombre" aria-label="Tu nombre">' +
        '<input class="oyfa-in" id="oyfaTel" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="Teléfono" aria-label="Teléfono">' +
      '</div>' +
      '<input class="oyfa-trampa" id="oyfaWeb" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<label class="oyfa-legal" id="oyfaLegal"><input type="checkbox" id="oyfaCk">' +
        '<span>He leído y acepto las <a href="/terminos" target="_blank" rel="noopener">Condiciones de Uso</a> y la <a href="/privacidad" target="_blank" rel="noopener">Política de Privacidad</a>.</span></label>' +
      '<div class="oyfa-err" id="oyfaErr" role="alert"></div>' +
      '<button type="button" class="oyfa-btn" id="oyfaBtn">Pedir presupuesto gratis &rarr;</button>';
    (sub || h1).insertAdjacentElement("afterend", card);

    /* El botón grande de "Ver mi precio" pasa a ser un enlace discreto a la calculadora */
    var ctas = col.querySelector(".hero-ctas");
    if (ctas) {
      var principal = ctas.querySelector('a[href="#presupuesto"], .btn-main');
      if (principal) principal.style.display = "none";
      var enlace = document.createElement("a");
      enlace.href = "#presupuesto";
      enlace.className = "oyfa-calc";
      enlace.innerHTML = "¿Prefieres ver antes el precio? <b>Calcúlalo en 20 segundos ↓</b>";
      enlace.addEventListener("click", function (e) {
        e.preventDefault();
        g("event", "select_content", { event_category: "ab_form_arriba", event_label: "ver_precio" });
        if (typeof window.irAPresupuesto === "function") { window.irAPresupuesto(); return; }
        var p = document.getElementById("presupuesto");
        if (p) p.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      ctas.appendChild(enlace);
    }

    var inNombre = document.getElementById("oyfaNombre");
    var inTel = document.getElementById("oyfaTel");
    var inWeb = document.getElementById("oyfaWeb");
    var ck = document.getElementById("oyfaCk");
    var lab = document.getElementById("oyfaLegal");
    var err = document.getElementById("oyfaErr");
    var btn = document.getElementById("oyfaBtn");
    var enviando = false;
    var empezado = false;

    function error(msg, sacudir) {
      err.textContent = msg;
      if (sacudir) { lab.classList.remove("oyfa-shake"); void lab.offsetWidth; lab.classList.add("oyfa-shake"); }
    }
    ck.addEventListener("change", function () { if (ck.checked) { lab.classList.remove("err"); if (/condiciones/.test(err.textContent)) err.textContent = ""; } });
    [inNombre, inTel].forEach(function (el) {
      el.addEventListener("focus", function () {
        if (empezado) return;
        empezado = true;
        g("event", "form_start", { event_category: "ab_form_arriba", event_label: v });
      });
    });

    function mostrarOk(res, nombre, tel) {
      var pro = res.profesional || "";
      var num = tel.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
      card.innerHTML =
        '<div class="oyfa-ok"><div style="font-size:34px;line-height:1">&#9989;</div>' +
        "<h3>Listo, " + esc(nombre.split(" ")[0]) + ". Solicitud enviada</h3>" +
        "<p>" + (pro ? esc(pro) + " ya tiene tu solicitud y te llamará al " : "Ya tenemos tu solicitud. Te llamamos al ") + num + " para darte el presupuesto.</p>" +
        (res.telefono ? '<button type="button" class="oyfa-btn" id="oyfaLlamar">&#128222; ' + (pro ? "Llamar ahora a " + esc(pro) : "Llamar ahora") + "</button>" : "") +
        "</div>";
      var bl = document.getElementById("oyfaLlamar");
      if (bl) bl.onclick = function () {
        g("event", "contact", { event_category: "contacto_llamada", event_label: "tras_formulario_arriba" });
        window.location.href = "tel:" + res.telefono;
      };
    }

    function guardarAceptacion(o) {
      try {
        var reg = JSON.stringify({
          terminos: (window.OY && window.OY.TERMINOS_VERSION) || "2.0",
          privacidad: (window.OY && window.OY.TERMINOS_VERSION) || "2.0",
          at: new Date().toISOString(),
          punto: "landing:" + o.landing + ":form_arriba",
          ciudad: (window.OY && window.OY.ciudad) || "",
          ua: navigator.userAgent.slice(0, 180)
        });
        localStorage.setItem("oy_terms", reg);
      } catch (e) {}
    }

    btn.addEventListener("click", function () {
      if (enviando) return;
      var nombre = inNombre.value.trim().replace(/\s+/g, " ");
      var tel = inTel.value.replace(/\D/g, "").slice(-9);
      err.textContent = "";
      if (inWeb.value) { mostrarOk({}, nombre || "gracias", tel || "000000000"); return; }
      if (nombre.length < 2) { error("Escribe tu nombre."); inNombre.focus(); return; }
      if (!/^[6789]\d{8}$/.test(tel)) { error("Escribe un teléfono de 9 cifras."); inTel.focus(); return; }
      if (!ck.checked) { lab.classList.add("err"); error("Debes aceptar las condiciones para continuar.", true); return; }

      var o = origen();
      guardarAceptacion(o);
      enviando = true;
      btn.disabled = true;
      btn.textContent = "Enviando...";

      var desc = "Quiere presupuesto de pintura. No ha indicado tipo de trabajo ni metros.";
      var cuerpo = {
        nombre: nombre, telefono: tel, oficio: "Pintor", canal: "formulario",
        city_slug: o.city_slug || "sevilla", zona: zonaBonita(o),
        landing: o.landing || "", gclid: o.gclid || "",
        utm_source: o.utm_source || "", utm_campaign: o.utm_campaign || "", utm_content: o.utm_content || "",
        descripcion: desc,
        ab_test: TEST, ab_variante: v, ab_origen: "formulario_arriba"
      };
      var terminado = false;

      function respaldo() {
        if (terminado) return;
        terminado = true;
        var datos = { quick: "1", oficio: "Pintor", nombre: nombre, telefono: tel, email: "lead" + tel + "@aficioya-lead.com", desc: desc };
        Object.keys(o).forEach(function (k) { if (o[k] != null && datos[k] == null) datos[k] = o[k]; });
        if (o.city_slug) datos.city = o.city_slug;
        window.location.href = "/?" + new URLSearchParams(datos).toString();
      }
      var reloj = setTimeout(respaldo, 12000);

      window.fetch(window.OY_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: window.OY_KEY, Authorization: "Bearer " + window.OY_KEY },
        body: JSON.stringify({ p: cuerpo })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (terminado) return;
          clearTimeout(reloj);
          if (res && res.ok === false && (res.error === "telefono" || res.error === "nombre")) {
            enviando = false;
            btn.disabled = false;
            btn.innerHTML = "Pedir presupuesto gratis &rarr;";
            error("Revisa tu nombre y tu teléfono (9 cifras).");
            return;
          }
          if (!res || !res.ok) { respaldo(); return; }
          terminado = true;
          if (res.nuevo) {
            g("event", "generate_lead", { event_category: "solicitud_pintor", event_label: "formulario_arriba", value: valorLead(), currency: "EUR" });
            if (typeof window.fbq === "function") { try { window.fbq("track", "Lead", { content_name: "formulario_arriba", content_category: "Pintor" }); } catch (e) {} }
          } else {
            g("event", "contact", { event_category: "solicitud_pintor", event_label: "repetido" });
          }
          mostrarOk(res, nombre, tel);
        })
        .catch(function () { clearTimeout(reloj); respaldo(); });
    });
  }

  /* ---------- Arranque ---------- */
  function arrancar() {
    if (!apta()) return;
    var v = elegirVariante();
    window.OYAB = { test: TEST, variante: v };
    marcarLeads(v);
    if (v === "B") { try { montarB(v); } catch (e) {} }
    g("event", "ab_form_arriba_" + v.toLowerCase(), { test: TEST, variante: v, landing: (window.ORIGEN && window.ORIGEN.landing) || location.pathname });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else { arrancar(); }
})();
