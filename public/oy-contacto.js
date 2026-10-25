/* ============================================================
   OficioYa · Llamar / WhatsApp con datos primero
   Antes de llamar o escribir por WhatsApp, el cliente deja nombre y teléfono.
   Así cada llamada y cada WhatsApp queda guardado como lead (CRM del profesional
   y panel de admin) y cuenta como conversión en Google Ads con su valor.

   Uso en cada landing, justo antes de </body>:
   <script src="/oy-contacto.js?v=1" data-oficio="Pintor" data-valor="80" data-gremio="pintor" defer></script>
   Solo llamada (sin WhatsApp): añadir data-solo-llamada="1". Cualquier botón de WhatsApp pasa a ser llamada.
   ============================================================ */
(function () {
  "use strict";
  if (window.OYContacto) return;

  var S = document.currentScript || document.querySelector('script[src*="oy-contacto.js"]');
  var DS = (S && S.dataset) || {};
  var OFICIO = DS.oficio || "Sin oficio";
  var VALOR = Number(DS.valor || 0);
  var GREMIO = DS.gremio || "profesional";
  var SOLO_LLAMADA = DS.soloLlamada === "1";

  var RPC = "https://rjwojxwrsbvwwshwwpvq.supabase.co/rest/v1/rpc/oy_lead_contacto";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE";
  var GUARDADO = "oy_contacto_datos";

  /* ---------- Origen de la visita (landing, gclid, utm) ---------- */
  function origen() {
    var o = {};
    try { o = JSON.parse(sessionStorage.getItem("oy_origen") || "{}") || {}; } catch (e) { o = {}; }
    try {
      var q = new URLSearchParams(location.search);
      ["gclid", "utm_source", "utm_campaign", "utm_content"].forEach(function (k) { if (q.get(k)) o[k] = q.get(k); });
    } catch (e) {}
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
  function bonito(slug) {
    return String(slug || "").replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  /* ---------- Estilos ---------- */
  var css = [
    ".oyc-fondo{position:fixed;inset:0;background:rgba(16,24,44,.55);z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .18s}",
    ".oyc-fondo.oyc-ver{opacity:1}",
    "@media(min-width:640px){.oyc-fondo{align-items:center}}",
    ".oyc-caja{background:#fff;color:#10182C;width:100%;max-width:420px;border-radius:18px 18px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.25);font-family:inherit;transform:translateY(16px);transition:transform .2s;max-height:92vh;overflow:auto}",
    "@media(min-width:640px){.oyc-caja{border-radius:18px}}",
    ".oyc-ver .oyc-caja{transform:none}",
    ".oyc-top{display:flex;align-items:flex-start;gap:10px}",
    ".oyc-tit{flex:1;font-size:19px;font-weight:800;line-height:1.25;margin:0}",
    ".oyc-x{background:none;border:0;font-size:22px;line-height:1;color:#8891A0;cursor:pointer;padding:2px 4px}",
    ".oyc-sub{font-size:14px;color:#5B6472;margin:6px 0 14px;line-height:1.45}",
    ".oyc-lab{display:block;font-size:12.5px;font-weight:700;color:#5B6472;margin:10px 0 5px}",
    ".oyc-in{width:100%;box-sizing:border-box;font-size:16px;padding:13px 14px;border:1.5px solid #E7E9EE;border-radius:11px;outline:none;color:#10182C;background:#fff;font-family:inherit}",
    ".oyc-in:focus{border-color:#F0A93B}",
    ".oyc-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:16px;padding:15px;border:0;border-radius:12px;background:#F0A93B;color:#1D1305;font-size:16.5px;font-weight:800;cursor:pointer;font-family:inherit;text-decoration:none;box-sizing:border-box}",
    ".oyc-btn:hover{background:#E3971F}",
    ".oyc-btn[disabled]{opacity:.6;cursor:default}",
    ".oyc-btn.oyc-wa{background:#1F8A5F;color:#fff}",
    ".oyc-err{color:#C0392B;font-size:13px;font-weight:600;margin-top:8px;min-height:1px}",
    ".oyc-legal{font-size:11.5px;color:#8891A0;margin-top:10px;text-align:center;line-height:1.4}",
    ".oyc-legal a{color:#8891A0}",
    ".oyc-ok{text-align:center;padding:6px 0 2px}",
    ".oyc-ok-ico{font-size:40px;line-height:1}",
    ".oyc-ok-t{font-size:18px;font-weight:800;margin:8px 0 4px}",
    ".oyc-ok-s{font-size:14px;color:#5B6472;line-height:1.45}",
    ".oyc-trampa{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}"
  ].join("\n");
  function ponerEstilos() {
    if (document.getElementById("oyc-css")) return;
    var st = document.createElement("style");
    st.id = "oyc-css";
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- Ventana ---------- */
  var abierta = null;
  function cerrar() {
    if (!abierta) return;
    var f = abierta;
    abierta = null;
    f.classList.remove("oyc-ver");
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 200);
    document.removeEventListener("keydown", alEscape);
  }
  function alEscape(e) { if (e.key === "Escape") cerrar(); }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function abrir(canal, extra) {
    canal = canal === "whatsapp" ? "whatsapp" : "llamada";
    if (SOLO_LLAMADA) canal = "llamada";
    extra = extra || {};
    ponerEstilos();
    cerrar();

    var previo = {};
    try { previo = JSON.parse(localStorage.getItem(GUARDADO) || "{}") || {}; } catch (e) {}

    var esWa = canal === "whatsapp";
    var titulo = esWa ? "Antes de escribir por WhatsApp" : "Antes de llamar, déjanos tus datos";
    var sub = "Así el " + esc(GREMIO) + " sabe quién eres y te atiende antes. Gratis y sin compromiso.";
    var textoBoton = esWa ? "Continuar a WhatsApp" : "Llamar ahora";

    var f = document.createElement("div");
    f.className = "oyc-fondo";
    f.setAttribute("role", "dialog");
    f.setAttribute("aria-modal", "true");
    f.setAttribute("aria-label", titulo);
    f.innerHTML =
      '<div class="oyc-caja">' +
        '<div class="oyc-top"><h2 class="oyc-tit">' + (esWa ? "💬 " : "📞 ") + titulo + '</h2>' +
        '<button type="button" class="oyc-x" aria-label="Cerrar">×</button></div>' +
        '<p class="oyc-sub">' + sub + '</p>' +
        '<form novalidate>' +
          '<label class="oyc-lab" for="oyc-nombre">Tu nombre</label>' +
          '<input class="oyc-in" id="oyc-nombre" name="nombre" autocomplete="name" placeholder="Nombre" maxlength="60">' +
          '<label class="oyc-lab" for="oyc-tel">Tu teléfono</label>' +
          '<input class="oyc-in" id="oyc-tel" name="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="600 000 000" maxlength="16">' +
          '<input class="oyc-trampa" name="web" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<div class="oyc-err" aria-live="polite"></div>' +
          '<button type="submit" class="oyc-btn' + (esWa ? " oyc-wa" : "") + '">' + (esWa ? "💬 " : "📞 ") + textoBoton + '</button>' +
          '<div class="oyc-legal">Solo usamos tus datos para atender tu solicitud. <a href="/privacidad" target="_blank" rel="noopener">Privacidad</a></div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(f);
    abierta = f;
    requestAnimationFrame(function () { f.classList.add("oyc-ver"); });
    document.addEventListener("keydown", alEscape);
    f.addEventListener("click", function (e) { if (e.target === f) cerrar(); });
    f.querySelector(".oyc-x").addEventListener("click", cerrar);

    var form = f.querySelector("form");
    var inNombre = f.querySelector("#oyc-nombre");
    var inTel = f.querySelector("#oyc-tel");
    var err = f.querySelector(".oyc-err");
    var btn = f.querySelector(".oyc-btn");
    if (previo.nombre) inNombre.value = previo.nombre;
    if (previo.telefono) inTel.value = previo.telefono;
    if (extra.nombre) inNombre.value = extra.nombre;
    if (extra.telefono) inTel.value = extra.telefono;
    setTimeout(function () { (previo.nombre ? inTel : inNombre).focus({ preventScroll: true }); }, 220);

    if (typeof gtag === "function") gtag("event", "contacto_abierto", { event_category: "contacto_" + canal, event_label: OFICIO });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.textContent = "";
      var nombre = inNombre.value.trim();
      var tel = inTel.value.replace(/\D/g, "").slice(-9);
      if (nombre.length < 2) { err.textContent = "Escribe tu nombre."; inNombre.focus(); return; }
      if (!/^[6789]\d{8}$/.test(tel)) { err.textContent = "Escribe un teléfono válido (9 cifras)."; inTel.focus(); return; }
      if (f.querySelector(".oyc-trampa").value) { cerrar(); return; }

      btn.disabled = true;
      btn.textContent = "Un momento...";
      try { localStorage.setItem(GUARDADO, JSON.stringify({ nombre: nombre, telefono: inTel.value.trim() })); } catch (e2) {}

      var o = origen();
      var cuerpo = {
        nombre: nombre, telefono: tel, oficio: OFICIO, canal: canal,
        city_slug: o.city_slug, zona: bonito(o.zona || o.city_slug),
        landing: o.landing, gclid: o.gclid || "",
        utm_source: o.utm_source || "", utm_campaign: o.utm_campaign || "", utm_content: o.utm_content || "",
        descripcion: extra.detalle ? ((esWa ? "Quiere hablar por WhatsApp. " : "Quiere hablar por teléfono. ") + extra.detalle) : ""
      };

      // Si el servidor falla o tarda, el cliente llama igualmente a OficioYa: nunca se pierde la llamada
      var RESPALDO = { ok: true, nuevo: false, telefono: "+34656398014", whatsapp: "34656398014", profesional: null, respaldo: true };
      var terminado = false;
      function continuar(res) {
        if (terminado) return;
        terminado = true;
        var destino = esWa
          ? "https://wa.me/" + res.whatsapp + "?text=" + encodeURIComponent(
              "Hola, soy " + nombre + " (" + tel + "). Vengo de OficioYa y necesito un " + GREMIO +
              (cuerpo.zona ? " en " + cuerpo.zona : "") + "." + (extra.detalle ? " Mi caso: " + extra.detalle + "." : ""))
          : "tel:" + res.telefono;

        var seguido = false;
        function seguir() {
          if (seguido) return;
          seguido = true;
          mostrarOk(f, esWa, destino, res);
          location.href = destino;
        }
        if (res.nuevo && typeof gtag === "function") {
          gtag("event", "generate_lead", {
            event_category: "solicitud_" + canal, event_label: o.landing || OFICIO,
            value: VALOR, currency: "EUR",
            event_callback: seguir, event_timeout: 900
          });
          if (typeof fbq === "function") { try { fbq("track", "Lead", { content_name: canal, content_category: OFICIO }); } catch (e3) {} }
          setTimeout(seguir, 1100);
        } else {
          if (typeof gtag === "function") gtag("event", "contact", { event_category: "contacto_" + canal, event_label: res.respaldo ? "respaldo" : "repetido" });
          seguir();
        }
      }
      var reloj = setTimeout(function () { continuar(RESPALDO); }, 8000);

      fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY },
        body: JSON.stringify({ p: cuerpo })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (terminado) return;
          if (res && !res.ok && (res.error === "telefono" || res.error === "nombre")) {
            clearTimeout(reloj);
            btn.disabled = false;
            btn.textContent = (esWa ? "💬 " : "📞 ") + textoBoton;
            err.textContent = res.error === "telefono" ? "Escribe un teléfono válido (9 cifras)." : "Escribe tu nombre.";
            return;
          }
          clearTimeout(reloj);
          continuar(res && res.ok ? res : RESPALDO);
        })
        .catch(function () { clearTimeout(reloj); continuar(RESPALDO); });
    });

    // Si la landing ya tiene nombre y teléfono (formulario del presupuesto), se llama sin volver a pedirlos
    if (extra.auto && extra.nombre && extra.telefono) {
      setTimeout(function () {
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event("submit", { cancelable: true }));
      }, 60);
    }
  }

  function mostrarOk(f, esWa, destino, res) {
    var caja = f.querySelector(".oyc-caja");
    if (!caja) return;
    var quien = res.profesional ? esc(res.profesional) : "Te atendemos";
    var numero = String(res.telefono || "").replace(/^\+34/, "").replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
    caja.innerHTML =
      '<div class="oyc-top"><div style="flex:1"></div><button type="button" class="oyc-x" aria-label="Cerrar">×</button></div>' +
      '<div class="oyc-ok"><div class="oyc-ok-ico">✅</div>' +
      '<div class="oyc-ok-t">' + (res.profesional ? quien + " ya tiene tus datos" : "Ya tenemos tus datos") + '</div>' +
      '<div class="oyc-ok-s">' + (esWa ? "Se está abriendo WhatsApp. Si no se abre, pulsa el botón." : "Se está abriendo la llamada. Si no se abre, llama al <b>" + esc(numero) + "</b>.") + '</div>' +
      '<a class="oyc-btn' + (esWa ? " oyc-wa" : "") + '" href="' + esc(destino) + '">' + (esWa ? "💬 Abrir WhatsApp" : "📞 Llamar al " + esc(numero)) + '</a></div>';
    caja.querySelector(".oyc-x").addEventListener("click", cerrar);
  }

  /* ---------- Quitar el número visible de los botones de llamada ---------- */
  var NUM = /(\s*(?:\bal\b\s*|:\s*))?(?:\+?34[\s.]?)?[6789]\d{2}[\s.]?\d{3}[\s.]?\d{3}/g;
  function limpiarNumeros() {
    var enlaces = document.querySelectorAll('a[href^="tel:"]');
    for (var i = 0; i < enlaces.length; i++) {
      var a = enlaces[i];
      var w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT, null);
      var nodos = [], n;
      while ((n = w.nextNode())) nodos.push(n);
      nodos.forEach(function (t) {
        if (!NUM.test(t.nodeValue)) { NUM.lastIndex = 0; return; }
        NUM.lastIndex = 0;
        var v = t.nodeValue.replace(NUM, "").replace(/\s+$/, "");
        if (!v.trim()) v = (t.nodeValue.match(/^\s*/) || [""])[0] + "Llamar";
        else if (/Llamar(\s+ahora)?$/i.test(v)) v = v.replace(/Llamar(\s+ahora)?$/i, "Llamar ahora");
        else if (/Llame$/i.test(v)) v = v.replace(/Llame$/i, "Llámenos");
        t.nodeValue = v;
      });
      a.setAttribute("data-oyc", "1");
    }
  }

  /* ---------- Interceptar clics en llamar / WhatsApp ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="tel:"], a[href*="wa.me/"], a[href*="api.whatsapp.com"]') : null;
    if (!a || (abierta && abierta.contains(a))) return;
    e.preventDefault();
    e.stopPropagation();
    abrir(/^tel:/.test(a.getAttribute("href")) ? "llamada" : "whatsapp");
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", limpiarNumeros);
  else limpiarNumeros();

  window.OYContacto = { abrir: abrir };
})();
