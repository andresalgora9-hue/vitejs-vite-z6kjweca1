/* ============================================================
   OficioYa · Al terminar una landing, el cliente entra directo en su área
   Escucha la respuesta de oy_lead_contacto (la misma función que ya usan las
   landings y la portada). Si la cuenta se acaba de crear, la respuesta trae
   «sesion»: se guarda en este navegador y:
     - formulario (pintura, portada…): tras enseñar el «Listo», abre su área
       con la bienvenida guiada (crear acceso, cómo va, instalar la app).
     - llamada o WhatsApp: no se interrumpe nada; se ofrece «Ver mi solicitud».
   Nunca pisa otra sesión abierta en este navegador (profesional, admin u otro
   cliente). Si el cliente toca algo o sale de la página, no se le redirige.
   No toca el formulario ni la medición (los eventos de Google y Meta ya se han
   enviado cuando esto actúa).
   ============================================================ */
(function () {
  "use strict";
  if (window.OYSesion) return;

  var RPC = /\/rest\/v1\/rpc\/oy_lead_contacto/;
  var DESTINO = "/?app=1&bienvenida=1";
  var ESPERA_MS = 2800;

  function leer(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function poner(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  function guardar(res, cuerpo) {
    var s = res && res.sesion;
    if (!s || !s.id || s.type !== "cliente") return false;
    var actual = leer("oy_user");
    if (actual && actual.id && actual.id !== s.id) return false;     // hay otra sesión abierta: no se toca
    var base = actual && actual.id === s.id ? actual : {};
    var u = Object.assign({}, base, { id: s.id, name: s.name, email: s.email, phone: s.phone, type: "cliente", plan: s.plan || "gratis" });
    if (!poner("oy_user", u)) return false;
    if (s.clave) poner("oy_clave_temp", { id: s.id, c: s.clave });
    poner("oy_bienvenida", {
      id: s.id, t: Date.now(), oficio: cuerpo.oficio || "", zona: cuerpo.zona || "",
      profesional: res.profesional || "", telefono: res.telefono || ""
    });
    return true;
  }

  var css = [
    ".oys{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483600;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 24px);padding:12px 16px 12px 12px;border-radius:16px;background:#10182C;color:#fff;font:700 14px/1.3 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;box-shadow:0 18px 40px -12px rgba(0,0,0,.55);border:1px solid rgba(255,215,0,.35);text-decoration:none;opacity:0;transition:opacity .25s,transform .25s;transform:translateX(-50%) translateY(10px)}",
    ".oys.ver{opacity:1;transform:translateX(-50%) translateY(0)}",
    ".oys i{width:22px;height:22px;flex:0 0 22px;border-radius:50%;border:3px solid rgba(255,215,0,.25);border-top-color:#FFD700;animation:oysg .8s linear infinite}",
    ".oys b{display:block;font-weight:800}",
    ".oys small{display:block;font-weight:600;font-size:12px;color:#C9D1DF}",
    ".oys .fl{width:30px;height:30px;flex:0 0 30px;border-radius:10px;background:linear-gradient(135deg,#FFD700,#FF8C00);color:#1A1200;display:flex;align-items:center;justify-content:center;font-size:16px}",
    ".oys-link{display:block;margin-top:14px;font-weight:700;font-size:14px;color:#8C670C;text-decoration:underline;text-underline-offset:3px}",
    "@keyframes oysg{to{transform:rotate(360deg)}}"
  ].join("\n");
  function estilos() {
    if (document.getElementById("oys-css")) return;
    var st = document.createElement("style");
    st.id = "oys-css";
    st.textContent = css;
    document.head.appendChild(st);
  }
  function aviso(html, enlace) {
    estilos();
    var viejo = document.querySelector(".oys");
    if (viejo && viejo.parentNode) viejo.parentNode.removeChild(viejo);
    var el = document.createElement(enlace ? "a" : "div");
    el.className = "oys";
    if (enlace) el.href = DESTINO;
    el.innerHTML = html;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("ver"); });
    return el;
  }

  function despues(cuerpo) {
    var listaEspera = /sin profesionales de OficioYa/i.test(cuerpo.descripcion || "");
    if (cuerpo.canal === "formulario" && !listaEspera) {
      // Si toca cualquier cosa (llamar, WhatsApp…) o sale de la página, no se le redirige: se queda el enlace
      var relojes = [];
      var cancelar = function (e) {
        if (e && e.target && e.target.closest && e.target.closest(".oys")) return;
        relojes.forEach(clearTimeout); relojes = [];
        quitar();
        pastilla();
      };
      var quitar = function () {
        document.removeEventListener("click", cancelar, true);
        window.removeEventListener("pagehide", cancelar);
        document.removeEventListener("visibilitychange", alOcultar);
      };
      var alOcultar = function () { if (document.visibilityState === "hidden") cancelar(); };
      document.addEventListener("click", cancelar, true);
      window.addEventListener("pagehide", cancelar);
      document.addEventListener("visibilitychange", alOcultar);
      relojes.push(setTimeout(function () {
        aviso('<i></i><span><b>Abriendo tu área de cliente…</b><small>Ahí verás cómo va tu solicitud</small></span>', true);
      }, 900));
      relojes.push(setTimeout(function () { quitar(); location.href = DESTINO; }, ESPERA_MS));
    } else {
      // Llamada, WhatsApp o lista de espera: sin interrumpir, se ofrece entrar.
      // Si está abierta la ventana de «Ya tenemos tus datos», el enlace va dentro (sin tapar el botón de llamar).
      setTimeout(function () {
        var ok = document.querySelector(".oyc-caja .oyc-ok");
        if (ok) {
          if (!ok.querySelector(".oys-link")) {
            estilos();
            var a = document.createElement("a");
            a.className = "oys-link";
            a.href = DESTINO;
            a.textContent = "Ver mi solicitud en tu área de cliente →";
            ok.appendChild(a);
          }
          var reloj = setInterval(function () {
            if (!document.querySelector(".oyc-fondo")) { clearInterval(reloj); pastilla(); }
          }, 800);
          setTimeout(function () { clearInterval(reloj); }, 10 * 60 * 1000);
        } else {
          pastilla();
        }
      }, 1200);
    }
  }
  function pastilla() {
    aviso('<span class="fl">→</span><span><b>Ver mi solicitud</b><small>Tu área de cliente en OficioYa</small></span>', true);
  }

  var original = window.fetch;
  if (typeof original === "function") {
    window.fetch = function (input, init) {
      var p = original.apply(this, arguments);
      var url = "";
      try { url = typeof input === "string" ? input : (input && input.url) || ""; } catch (e) {}
      if (!RPC.test(url)) return p;
      var cuerpo = {};
      try { var b = init && init.body ? JSON.parse(init.body) : null; cuerpo = (b && b.p) || {}; } catch (e) {}
      return p.then(function (r) {
        try {
          r.clone().json().then(function (res) {
            if (res && res.ok && res.sesion && guardar(res, cuerpo)) despues(cuerpo);
          }).catch(function () {});
        } catch (e) {}
        return r;
      });
    };
  }

  window.OYSesion = { guardar: guardar };
})();
