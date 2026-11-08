// ============================================================
// OficioYa · ÁREA DEL CLIENTE (con sesión iniciada)
// Inicio · Solicitudes · Presupuestos · Calcular · Perfil
// Estilo de la portada nueva (/inicio). Sustituye a las pestañas antiguas del cliente.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../supabase";
import type { Cliente, Solicitud, Presupuesto, ProPublico } from "./clienteComun";
import { EstilosCliente, Icono, Avatar, lsGet, lsSet, lsJSON, esEmailProvisional, esNombreProvisional, necesitaAcceso, nombreOficio, activarAvisos, avisosActivos, esIOS, ms } from "./clienteComun";
import { cargarSolicitudes, cargarPresupuestos, cargarProfesionales, cargarCiudades, contarSinLeer, ADMIN, type Ciudad } from "./datos";
import ClienteInicio from "./ClienteInicio";
import ClienteSolicitudes, { NuevaSolicitudHoja, type PrefillSolicitud } from "./ClienteSolicitudes";
import ClientePresupuestos, { PresupuestoHoja } from "./ClientePresupuestos";
import ClienteCalculadora from "./ClienteCalculadora";
import ClientePerfil from "./ClientePerfil";
import { ProfesionalesHoja, ProfesionalHoja, ChatHoja, InstalarHoja, AvisoAccesoHoja, useDescargar, type DatosBienvenida } from "./ClienteExtras";
import ClienteGuia from "./ClienteGuia";

type Tab = "inicio" | "solicitudes" | "presupuestos" | "calcular" | "perfil";
const TABS: { id: Tab; t: string; ic: string }[] = [
  { id: "inicio", t: "Inicio", ic: "inicio" },
  { id: "solicitudes", t: "Solicitudes", ic: "solicitudes" },
  { id: "presupuestos", t: "Presupuestos", ic: "presupuestos" },
  { id: "calcular", t: "Calcular", ic: "calcular" },
  { id: "perfil", t: "Perfil", ic: "perfil" },
];

export default function ClienteArea({ user, onUpdate, onLogout, deepLinkProId }: {
  user: Cliente; onUpdate: (u: any) => void; onLogout: () => void; deepLinkProId?: string | null;
}) {
  const params = useRef(new URLSearchParams(window.location.search)).current;
  const vieneDePush = params.get("perfil") === "1";
  const irParam = params.get("ir") as Tab | null;
  const [tab, setTabEstado] = useState<Tab>(() => (vieneDePush ? "perfil" : irParam && TABS.some((t) => t.id === irParam) ? irParam : "inicio"));
  const scrollRef = useRef<HTMLDivElement>(null);
  const setTab = useCallback((t: Tab) => { setTabEstado(t); requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 })); }, []);

  const [toast, setToast] = useState<string | null>(null);
  const relojToast = useRef<any>(null);
  const aviso = useCallback((m: string) => { setToast(m); clearTimeout(relojToast.current); relojToast.current = setTimeout(() => setToast(null), 3200); }, []);

  // ── Datos ──
  const [sols, setSols] = useState<Solicitud[] | null>(null);
  const [presus, setPresus] = useState<Presupuesto[] | null>(null);
  const [presusErr, setPresusErr] = useState(false);
  const [pros, setPros] = useState<ProPublico[] | null>(null);
  const [ciudades, setCiudades] = useState<Record<string, Ciudad[]>>({ pintor: [], fontaner: [] });
  const [sinLeer, setSinLeer] = useState(0);
  const recargarSols = useCallback(async () => { try { setSols(await cargarSolicitudes(user.id)); } catch { setSols((s) => s || []); } }, [user.id]);
  const recargarPresus = useCallback(async () => { const r = await cargarPresupuestos(user.id); setPresus(r.lista); setPresusErr(r.error); }, [user.id]);
  useEffect(() => {
    recargarSols(); recargarPresus();
    cargarCiudades().then(setCiudades);
    cargarProfesionales().then(setPros).catch(() => setPros([]));
    contarSinLeer(user.id).then(setSinLeer).catch(() => {});
  }, [user.id, recargarSols, recargarPresus]);
  useEffect(() => {
    const reloj = setInterval(() => { if (document.visibilityState === "visible") recargarSols(); }, 60000);
    const alVolver = () => { if (document.visibilityState === "visible") { recargarSols(); contarSinLeer(user.id).then(setSinLeer).catch(() => {}); } };
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(reloj); document.removeEventListener("visibilitychange", alVolver); };
  }, [user.id, recargarSols]);

  // ── Mensajes de OficioYa en tiempo real ──
  const [chat, setChat] = useState(false);
  const chatAbierto = useRef(false);
  useEffect(() => { chatAbierto.current = chat; }, [chat]);
  useEffect(() => {
    const canal = db.channel("cy_notif_" + user.id)
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "messages", filter: "to_id=eq." + user.id }, (p: any) => {
        if (p?.new?.from_id === ADMIN && !chatAbierto.current) { setSinLeer((n) => n + 1); aviso("Tienes un mensaje nuevo de OficioYa"); }
        if (p?.new?.is_lead_alert || /presupuesto|profesional/i.test(p?.new?.text || "")) recargarSols();
      })
      .subscribe();
    return () => { db.removeChannel(canal); };
  }, [user.id, aviso, recargarSols]);
  const alLeer = useCallback(() => setSinLeer(0), []);

  // ── Limpiar la URL (?app=1&bienvenida=1&perfil=1…) ──
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      let cambia = false;
      ["app", "bienvenida", "perfil", "ir", "entrar", "with", "quick"].forEach((k) => { if (p.has(k)) { p.delete(k); cambia = true; } });
      if (cambia) window.history.replaceState({}, "", window.location.pathname + (p.toString() ? "?" + p.toString() : ""));
    } catch { /* nada */ }
  }, []);

  // ── Guía paso a paso: sola al llegar desde una landing (o el registro rápido) y la primera vez en este móvil ──
  const provisional = esEmailProvisional(user.email);
  const faltaAcceso = necesitaAcceso(user);
  const bienv = lsJSON<any>("oy_bienvenida", null);
  const bienvMia = bienv && bienv.id === user.id ? bienv : null;
  const desdeLanding = params.get("bienvenida") === "1" || !!(bienvMia && !bienvMia.vista && Date.now() - (bienvMia.t || 0) < 3 * 864e5);
  const claveGuia = "oy_guia_" + user.id;
  const [guia, setGuia] = useState<null | { recien: boolean }>(() =>
    vieneDePush || deepLinkProId ? null : desdeLanding ? { recien: true } : lsGet(claveGuia) ? null : { recien: false });
  useEffect(() => {
    if (guia && bienvMia && !bienvMia.vista) lsSet("oy_bienvenida", JSON.stringify({ ...bienvMia, vista: true }));
  }, [guia]);
  const cerrarGuia = useCallback((terminada: boolean) => {
    setGuia(null);
    lsSet(claveGuia, terminada ? "fin" : "saltada");
    if (terminada) aviso("¡Todo listo! Si necesitas algo, escríbenos.");
  }, [claveGuia, aviso]);
  const irInicio = useCallback(() => setTabEstado("inicio"), []);

  // ── Aviso «protege tu cuenta» (como mucho una vez al día) ──
  const [avisoAcceso, setAvisoAcceso] = useState(false);
  const [foco, setFoco] = useState(vieneDePush ? 1 : 0);
  useEffect(() => {
    if (!faltaAcceso || user.acceso_pendiente || guia || vieneDePush) return;
    const k = "oy_aviso_acceso_" + user.id;
    if (Date.now() - Number(lsGet(k) || 0) < 20 * 3600 * 1000) return;
    const t = setTimeout(() => { setAvisoAcceso(true); lsSet(k, String(Date.now())); }, 1800);
    return () => clearTimeout(t);
  }, []);
  const irAcceso = useCallback(() => { setGuia(null); setAvisoAcceso(false); setTab("perfil"); setFoco((f) => f + 1); }, [setTab]);
  const accesoCreado = useCallback((tipo: "clave" | "enlace") => {
    if (tipo === "clave") aviso("¡Listo! Ya puedes entrar con tu correo y tu contraseña");
    else aviso("Te hemos enviado un enlace a tu correo para elegir la contraseña");
  }, [aviso]);

  // ── Avisos (push) e instalación ──
  const [avisosOn, setAvisosOn] = useState(avisosActivos());
  const [instalarAbierto, setInstalarAbierto] = useState(false);
  // «Descargar la app»: en Android sale directamente el aviso de instalar; en iPhone, cómo hacerlo
  const { instalada, descargar } = useDescargar(() => setInstalarAbierto(true));
  const pedirAvisos = useCallback(async () => {
    const r = await activarAvisos(user.id);
    if (r === "ok") { setAvisosOn(true); aviso("Avisos activados"); }
    else if (r === "denegado") aviso("Los avisos están bloqueados en este navegador. Actívalos en sus ajustes.");
    else if (r === "no_soportado") aviso(esIOS() ? "En iPhone, instala primero la app para poder activar los avisos" : "Este navegador no permite avisos");
    else aviso("No se han podido activar los avisos. Inténtalo de nuevo.");
  }, [user.id, aviso]);
  const [pasosOcultos, setPasosOcultos] = useState(lsGet("oy_pasos_ocultos_" + user.id) === "1");
  const pasos = { pedido: (sols || []).length > 0, acceso: !faltaAcceso, avisos: avisosOn, instalada };

  // ── Hojas ──
  const [hojaSol, setHojaSol] = useState<PrefillSolicitud | null>(null);
  const [hojaPre, setHojaPre] = useState<Partial<Presupuesto> | null>(null);
  const [hojaPros, setHojaPros] = useState(false);
  const [proVer, setProVer] = useState<ProPublico | null>(null);

  // Enlace a un profesional (?with=ID): se abre su perfil para pedirle presupuesto
  const deepLinkHecho = useRef(false);
  useEffect(() => {
    if (!deepLinkProId || deepLinkHecho.current) return;
    if (deepLinkProId === ADMIN) { deepLinkHecho.current = true; setChat(true); return; }
    if (!pros) return;
    const p = pros.find((x) => x.id === deepLinkProId);
    deepLinkHecho.current = true;
    if (p) setProVer(p);
  }, [deepLinkProId, pros]);

  const guardarDesdeSolicitud = (s: Solicitud) => setHojaPre({
    trabajo: nombreOficio(s.oficio) + (s.zona ? " en " + s.zona : ""), oficio: s.oficio, empresa: s.pro ? (s.pro.empresa || s.pro.nombre) : "",
    importe: s.presupuesto_eur, telefono: s.pro?.telefono || null, origen: "oficioya", budget_request_id: s.id, estado: "pendiente",
  });
  const trabajos = Array.from(new Set((presus || []).map((p) => p.trabajo)));
  // Oficios que ya ha pedido a OficioYa: ahí «otra opinión» volvería al mismo profesional
  const oficiosPedidos = new Set((sols || []).map((s) => (s.oficio || "").trim().toLowerCase()));

  const solReciente = (sols || [])[0] || null;
  const avatarNombre = esNombreProvisional(user.name) ? "?" : user.name;

  return (
    <div className={"cy" + (guia ? " cy-guia-on" : "")} ref={scrollRef} data-scroll style={{ height: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" } as React.CSSProperties}>
      <EstilosCliente />
      <div className="cy-fondo" />
      <div className="cy-app">
        <header className="cy-cab">
          <div className="cy-cab-in">
            <button className="cy-logo" onClick={() => setTab("inicio")} aria-label="OficioYa, inicio">
              <span className="cy-logo-ic">🔨</span>
              <span className="cy-logo-tx">Oficio<b>Ya</b></span>
            </button>
            <div className="cy-cab-r">
              <button className="cy-icbtn" data-guia="chat" onClick={() => setChat(true)} aria-label={"Mensajes con OficioYa" + (sinLeer ? ", " + sinLeer + " sin leer" : "")}>
                <Icono n="chat" s={19} />
                {sinLeer > 0 && <span className="cy-badge">{sinLeer > 9 ? "9+" : sinLeer}</span>}
              </button>
              <button onClick={() => setTab("perfil")} aria-label="Tu perfil" style={{ background: "none", border: 0, padding: 0, position: "relative" }}>
                <Avatar nombre={avatarNombre} url={user.avatar_url} size={40} />
                {faltaAcceso && <span className="cy-badge" style={{ minWidth: 12, width: 12, height: 12, padding: 0, top: -1, right: -1 }} />}
              </button>
            </div>
          </div>
        </header>

        <main>
          {tab === "inicio" && (
            <ClienteInicio user={user} sols={sols} presus={presus} pros={pros} pasos={pasos} mostrarPasos={!pasosOcultos}
              onNueva={(p) => setHojaSol(p || {})} onApuntar={() => setHojaPre({})} onIr={setTab}
              onVerPros={() => setHojaPros(true)} onVerPro={setProVer} onChat={() => setChat(true)} onInstalar={descargar}
              appInstalada={instalada}
              onAvisos={pedirAvisos} onAcceso={irAcceso} onOcultarPasos={() => { setPasosOcultos(true); lsSet("oy_pasos_ocultos_" + user.id, "1"); }} />
          )}
          {tab === "solicitudes" && (
            <ClienteSolicitudes sols={sols} presus={presus} onNueva={() => setHojaSol({})} onChat={() => setChat(true)} onGuardarPresupuesto={guardarDesdeSolicitud} />
          )}
          {tab === "presupuestos" && (
            <ClientePresupuestos presus={presus} error={presusErr} ciudades={ciudades} oficiosPedidos={oficiosPedidos} onNuevo={(p) => setHojaPre(p || {})} onEditar={(p) => setHojaPre(p)}
              onPedirOtra={(g) => setHojaSol({ oficio: g.oficio || undefined, ref: g.tipo, descripcion: "Ya tengo presupuesto para «" + g.trabajo + "» y quiero comparar." })} />
          )}
          {tab === "calcular" && <ClienteCalculadora onPedir={(p) => setHojaSol(p)} onGuardar={(p) => setHojaPre(p)} />}
          {tab === "perfil" && (
            <ClientePerfil user={user} onUpdate={onUpdate} onLogout={onLogout} foco={foco} onAccesoCreado={accesoCreado}
              onAvisos={pedirAvisos} avisosOn={avisosOn} onInstalar={descargar} onChat={() => setChat(true)}
              onGuia={() => { setTab("inicio"); setGuia({ recien: false }); }} aviso={aviso} />
          )}
        </main>
      </div>

      <nav className="cy-tabs" aria-label="Secciones">
        {TABS.map((t) => (
          <button key={t.id} className="cy-tab" data-guia={"tab-" + t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>
            <Icono n={t.ic} s={21} w={tab === t.id ? 2.4 : 1.9} />
            <span>{t.t}</span>
            {t.id === "perfil" && faltaAcceso && tab !== "perfil" && <span className="cy-badge" style={{ minWidth: 10, width: 10, height: 10, padding: 0, border: "2px solid #11131A" }} />}
          </button>
        ))}
      </nav>

      {hojaSol && (
        <NuevaSolicitudHoja user={user} ciudades={ciudades} sols={sols} prefill={hojaSol} onClose={() => setHojaSol(null)}
          onEnviada={() => recargarSols()} onVerSolicitudes={() => setTab("solicitudes")} onAvisos={pedirAvisos} avisosOn={avisosOn} onChat={() => setChat(true)} />
      )}
      {hojaPre && (
        <PresupuestoHoja user={user} inicial={hojaPre} trabajos={trabajos} onClose={() => setHojaPre(null)} aviso={aviso}
          onGuardado={(p) => { setPresus((l) => { const lista = l || []; return lista.some((x) => x.id === p.id) ? lista.map((x) => (x.id === p.id ? p : x)) : [p, ...lista]; }); setPresusErr(false); aviso("Presupuesto guardado"); if (tab !== "presupuestos") setTab("presupuestos"); }}
          onBorrado={(id) => { setPresus((l) => (l || []).filter((x) => x.id !== id)); aviso("Presupuesto borrado"); }} />
      )}
      {hojaPros && <ProfesionalesHoja pros={pros} onClose={() => setHojaPros(false)} onVer={(p) => setProVer(p)} />}
      {proVer && <ProfesionalHoja p={proVer} onClose={() => setProVer(null)} onPedir={(p) => { setProVer(null); setHojaPros(false); setHojaSol({ pro: p, oficio: p.oficio }); }} />}
      {chat && <ChatHoja user={user} onClose={() => setChat(false)} onLeidos={alLeer} />}
      {instalarAbierto && <InstalarHoja onClose={() => setInstalarAbierto(false)} faltaAcceso={faltaAcceso} onAcceso={() => { setInstalarAbierto(false); irAcceso(); }} />}
      {avisoAcceso && <AvisoAccesoHoja user={user} onClose={() => setAvisoAcceso(false)} onIr={irAcceso} />}
      {guia && (
        <ClienteGuia user={user} sol={solReciente} datos={bienvMia as DatosBienvenida | null} recienLlegado={guia.recien}
          faltaAcceso={faltaAcceso} avisosOn={avisosOn} onUpdate={onUpdate} onAccesoCreado={accesoCreado} onAvisos={pedirAvisos}
          onIrInicio={irInicio} onIrAcceso={irAcceso} onCerrar={cerrarGuia} />
      )}
      {toast && <div className="cy-toast" role="status">{toast}</div>}
    </div>
  );
}
