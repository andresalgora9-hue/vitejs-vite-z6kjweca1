/* oy-geo.js · Landings de pintura de Córdoba (25/11/2026, revisar el 10/12/2026)
   La campaña Clientes_Cordoba_Pintura añade a la URL ?oyloc={loc_physical_ms}: el ID de Google
   del sitio donde está físicamente quien hace clic. Si está en la provincia de Sevilla, la MISMA
   landing (mismo servicio, mismos precios y el mismo pintor) cambia "Córdoba" por su ciudad.
   El lead sigue yendo al pintor de Córdoba (city_slug "cordoba"), con la zona real del cliente.
   Sin oyloc (orgánico, Googlebot, enlaces) no hace nada. Probar: ?oyloc=1005421 (Sevilla).
   Medición: mkt_visitas.ab_test = "geo_cordoba_v1", variante "sevilla" | "cordoba" | "otra".
   IDs sacados de los geotargets de Google (CSV del 06/10/2026). Para quitarlo: borra el
   <script src="/oy-geo.js"> de las 6 landings. */
(function () {
  var raiz = document.documentElement;
  function mostrar() { raiz.className = raiz.className.replace(/\s*oy-geo-pend/g, ""); }
  try {
    var SEV = {"1005408":"Brenes","1005410":"Constantina","1005421":"Sevilla","1005422":"Tomares",
      "9048964":"Alcalá de Guadaíra","9048986":"Arahal","9049022":"Camas","9049027":"Carmona",
      "9049028":"Casariche","9049048":"Coria del Río","9049057":"El Cuervo de Sevilla",
      "9049059":"El Viso del Alcor","9049064":"Espartinas","9049068":"Estepa","9049095":"La Algaba",
      "9049102":"La Puebla de Cazalla","9049104":"La Rinconada","9049109":"Lebrija",
      "9049117":"Lora del Río","9049120":"Los Palacios y Villafranca","9049122":"Mairena del Alcor",
      "9049123":"Mairena del Aljarafe","9049127":"Marchena","9049140":"Montequinto",
      "9049143":"Morón de la Frontera","9049157":"Osuna","9049169":"Pilas",
      "9049194":"San José de la Rinconada","9049199":"Sanlúcar la Mayor","9049232":"Utrera",
      "9195738":"Dos Hermanas","9213918":"Écija","9218461":"Bormujos","9245685":"Palomares del Río",
      "9219920":"Sevilla" /* Comarca Metropolitana de Sevilla */};
    /* Códigos postales 41xxx (provincia de Sevilla): se muestra "Sevilla" */
    var CP41 = ",9194145,9198006,9198101,9198177,9198266,9198281,9198451,9207100,9207571,9207618,9208153," +
      "9208301,9208524,9208544,9209009,9209166,9209242,9210067,9210236,9210962,9211809,9212500," +
      "9212608,9212980,9213077,9213334,9214307,9214376,9214417,9214437,9215897,9216515,9216805," +
      "9217070,9217334,9217749,9218601,9219665,9220255,9220680,9220916,9220979,9221150,9221405," +
      "9221779,9221930,9222068,9222172,9241236,";
    var CORDOBA = "1005411";

    var m = (location.search || "").match(/[?&]oyloc=(\d{4,10})(?:&|$)/), id = m ? m[1] : "";
    if (!id) {
      try { id = (JSON.parse(sessionStorage.getItem("oy_geo") || "null") || {}).id || ""; } catch (e) { id = ""; }
      if (!id) return;
    }
    try { sessionStorage.setItem("oy_geo", JSON.stringify({ id: id })); } catch (e) {}
    var ciudad = SEV[id] || (CP41.indexOf("," + id + ",") >= 0 ? "Sevilla" : "");
    if (!window.OYAB) window.OYAB = { test: "geo_cordoba_v1", variante: ciudad ? "sevilla" : (id === CORDOBA ? "cordoba" : "otra") };
    if (!ciudad) return;
    window.OYGEO = { id: id, ciudad: ciudad };

    /* Se oculta la página un instante para que no se vea "Córdoba" antes del cambio */
    raiz.className += " oy-geo-pend";
    var st = document.createElement("style");
    st.textContent = "html.oy-geo-pend body{opacity:0}";
    (document.head || raiz).appendChild(st);

    var zonaTxt = ciudad === "Sevilla" ? "Sevilla y alrededores" : ciudad + ", Sevilla y alrededores";
    function cambiar(t) {
      return t.replace(/Córdoba, Sevilla y alrededores/g, zonaTxt)
        .replace(/Córdoba capital y alrededores/g, ciudad === "Sevilla" ? "Sevilla y alrededores" : ciudad + " y alrededores")
        .replace(/Córdoba/g, ciudad);
    }
    function slug(s) {
      return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    var hecho = false;
    function aplicar() {
      if (hecho) return; hecho = true;
      try {
        document.title = cambiar(document.title);
        var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: function (n) {
            var p = n.parentNode ? n.parentNode.nodeName : "";
            return /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(p) || n.nodeValue.indexOf("Córdoba") < 0 ? 2 : 1;
          }
        });
        var lista = [], n;
        while ((n = w.nextNode())) lista.push(n);
        for (var i = 0; i < lista.length; i++) lista[i].nodeValue = cambiar(lista[i].nodeValue);
        /* Los barrios de Córdoba no pintan nada para quien está en Sevilla; los pueblos sí se quedan */
        var barrios = document.querySelector("#zona .zones");
        if (barrios) barrios.style.display = "none";
        /* El lead lleva la zona real del cliente; el reparto sigue siendo Córdoba */
        if (window.ORIGEN) {
          var s = slug(ciudad);
          if (window.ZONAS_N && typeof window.ZONAS_N === "object") window.ZONAS_N[s] = ciudad;
          window.ORIGEN.zona = s;
          try { sessionStorage.setItem("oy_origen", JSON.stringify(window.ORIGEN)); } catch (e) {}
        }
      } catch (e) {}
      mostrar();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplicar);
    else aplicar();
    setTimeout(mostrar, 2500); /* pase lo que pase, la página se ve */
  } catch (e) { mostrar(); }
})();
