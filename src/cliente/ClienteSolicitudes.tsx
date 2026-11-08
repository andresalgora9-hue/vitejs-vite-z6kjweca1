// ============================================================
// OficioYa · ÁREA DEL CLIENTE — Solicitudes (cómo va cada una) y «Pedir presupuesto»
// ============================================================
import React, { useMemo, useState } from "react";
import type { Cliente, Solicitud, Presupuesto, ProPublico } from "./clienteComun";
import { Icono, Avatar, Hoja, Vacio, Esqueleto, REF, eurRango, eur, haceCuanto, fechaHora, nombreOficio, iconoOficio, enlaceTel, enlaceWa, telBonito, digitos, slug, ms } from "./clienteComun";
import { estadoSolicitud, crearSolicitud, claveOficio, type Ciudad } from "./datos";

// ── Tarjeta de una solicitud ────────────────────────────────
export function TarjetaSolicitud({ s, compacta = false, guardada, onGuardarPresupuesto, onChat, onVer }: {
  s: Solicitud; compacta?: boolean; guardada?: boolean; onGuardarPresupuesto?: (s: Solicitud) => void; onChat?: () => void; onVer?: () => void;
}) {
  const e = estadoSolicitud(s);
  const pro = s.pro && !s.anulado ? s.pro : null;
  const desc = (s.descripcion || "").replace(/\s*Desde (la portada|el área de cliente)\.?\s*$/i, "").replace(/Quiere hablar por (teléfono|WhatsApp) \(dejó sus datos en la web antes de (llamar|escribir)\)\.?/i, (_m: string, c: string) => "Pediste hablar por " + c + ".");
  return (
    <div className="cy-glass cy-card cy-entra">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div className="cy-tile-ic" style={{ width: 44, height: 44, borderRadius: 14, flex: "0 0 44px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--grad)", color: "#1A1200", boxShadow: "0 10px 22px -12px rgba(255,160,0,.8)" }}>
          <Icono n={iconoOficio(s.oficio)} s={22} w={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cy-between" style={{ alignItems: "flex-start" }}>
            <p className="cy-h3">{nombreOficio(s.oficio)}{s.zona ? <span style={{ color: "var(--ink3)", fontWeight: 600 }}> · {s.zona}</span> : null}</p>
            <span className="cy-mini" style={{ whiteSpace: "nowrap" }}>{haceCuanto(s.created_at)}</span>
          </div>
          {desc && <p className="cy-mini cy-clamp2" style={{ marginTop: 3, color: "var(--ink2)" }}>{desc}</p>}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <span className={"cy-pill " + (e.tono === "ok" ? "ok" : e.tono === "oro" ? "oro" : e.tono === "warn" ? "warn" : "")}>
          {e.tono === "ok" || e.tono === "oro" ? <span className="cy-dot" style={e.tono === "oro" ? { background: "var(--gold)" } : undefined} /> : null}
          {e.resumen}
        </span>
      </div>

      {!compacta && !e.cerrada && (
        <ol className="cy-pasos">
          {e.pasos.map((p, i) => (
            <li key={i} className={"cy-paso " + p.e}>
              <span className="cy-paso-c">{p.e === "hecho" && <Icono n="check" s={14} w={3} />}</span>
              <div><b>{p.t}</b>{p.d && <small>{p.d}{i === 0 ? " · " + fechaHora(s.created_at) : ""}</small>}</div>
            </li>
          ))}
        </ol>
      )}
      {compacta && !e.cerrada && !e.fin && (
        <div style={{ marginTop: 12 }}>
          <div className="cy-barra"><i style={{ width: Math.max(12, e.progreso * 100) + "%" }} /></div>
          <div className="cy-between cy-mini" style={{ marginTop: 6 }}><span>Recibida</span><span>Presupuesto</span><span>Confirmado</span></div>
        </div>
      )}

      {pro && s.presupuesto_eur != null && s.presupuesto_eur > 0 && (
        <div className="cy-ticket">
          <div><small>PRESUPUESTO DE {pro.nombre.toUpperCase()}</small><strong>{eur(s.presupuesto_eur)}</strong></div>
          {onGuardarPresupuesto && (guardada
            ? <span className="cy-pill ok"><Icono n="check" s={14} w={3} />Guardado</span>
            : <button className="cy-btn-s cy-btn-sm" onClick={() => onGuardarPresupuesto(s)}>Guardar y comparar</button>)}
        </div>
      )}

      {pro && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: 12, borderRadius: 16, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)" }}>
          <Avatar nombre={pro.nombre} url={pro.avatar} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 14.5, color: "var(--ink)" }}>{pro.nombre}{pro.empresa ? <span style={{ fontWeight: 600, color: "var(--ink3)" }}> · {pro.empresa}</span> : null}</p>
            <p className="cy-mini">{pro.telefono ? "Tu profesional · " + telBonito(pro.telefono) : "Tu profesional asignado"}</p>
          </div>
          {pro.telefono && !e.cerrada && (
            <a className="cy-icbtn" href={enlaceTel(pro.telefono)} aria-label={"Llamar a " + pro.nombre} style={{ background: "rgba(0,214,143,.12)", borderColor: "rgba(0,214,143,.4)", color: "var(--mint)" }}><Icono n="tel" s={18} /></a>
          )}
        </div>
      )}

      {(onVer || onChat) && (
        <div className="cy-row" style={{ marginTop: 12 }}>
          {onVer && <button className="cy-btn-g cy-btn-sm" onClick={onVer}>Ver cómo va <Icono n="cheveron" s={16} /></button>}
          {onChat && <button className="cy-link" onClick={onChat} style={{ marginLeft: "auto" }}><Icono n="chat" s={16} />¿Alguna duda?</button>}
        </div>
      )}
    </div>
  );
}

// ── Pestaña Solicitudes ─────────────────────────────────────
export default function ClienteSolicitudes({ sols, presus, onNueva, onChat, onGuardarPresupuesto }: {
  sols: Solicitud[] | null; presus: Presupuesto[] | null; onNueva: () => void; onChat: () => void; onGuardarPresupuesto: (s: Solicitud) => void;
}) {
  const activas = (sols || []).filter((s) => !estadoSolicitud(s).fin);
  const cerradas = (sols || []).filter((s) => estadoSolicitud(s).fin);
  const guardada = (s: Solicitud) => (presus || []).some((p) => p.budget_request_id === s.id);
  return (
    <div className="cy-wrap" style={{ paddingTop: 18 }}>
      <div className="cy-between" style={{ alignItems: "flex-end", marginBottom: 6 }}>
        <div>
          <p className="cy-eyebrow">Tus solicitudes</p>
          <h1 className="cy-h1" style={{ fontSize: 30, marginTop: 6 }}>Cómo va <span>lo tuyo</span></h1>
        </div>
        <button className="cy-btn-s cy-btn-sm" onClick={onNueva} style={{ flex: "0 0 auto" }}><Icono n="mas" s={16} w={2.6} />Nueva</button>
      </div>
      <p className="cy-sub" style={{ marginBottom: 16 }}>Verás aquí cuándo te llama el profesional y su presupuesto.</p>

      {sols === null && <Esqueleto alto={220} n={2} />}
      {sols && sols.length === 0 && (
        <div className="cy-glass cy-card">
          <Vacio icono="solicitudes" titulo="Aún no has pedido nada" texto="Cuéntanos qué necesitas y te asignamos un profesional comprobado de tu zona. Gratis y sin compromiso.">
            <button className="cy-btn" style={{ marginTop: 18 }} onClick={onNueva}>Pedir presupuesto gratis <Icono n="flecha" s={18} w={2.4} /></button>
          </Vacio>
        </div>
      )}
      {activas.map((s) => <TarjetaSolicitud key={s.id} s={s} guardada={guardada(s)} onGuardarPresupuesto={onGuardarPresupuesto} onChat={onChat} />)}
      {cerradas.length > 0 && (
        <>
          <p className="cy-lbl" style={{ marginTop: 24 }}>Terminadas</p>
          {cerradas.map((s) => <TarjetaSolicitud key={s.id} s={s} compacta guardada={guardada(s)} onGuardarPresupuesto={onGuardarPresupuesto} />)}
        </>
      )}
    </div>
  );
}

// ── Hoja «Pedir presupuesto» ────────────────────────────────
export interface PrefillSolicitud { oficio?: string; descripcion?: string; pro?: ProPublico | null; ref?: string | null }
const URGENCIAS = [["hoy", "Hoy"], ["semana", "Esta semana"], ["sin_prisa", "Sin prisa"]] as const;
const OTROS = ["Electricista", "Reformas Integrales", "Otro"] as const;

export function NuevaSolicitudHoja({ user, ciudades, sols, prefill, onClose, onEnviada, onVerSolicitudes, onAvisos, avisosOn, onChat }: {
  user: Cliente; ciudades: Record<string, Ciudad[]>; sols: Solicitud[] | null; prefill: PrefillSolicitud; onClose: () => void;
  onEnviada: () => void; onVerSolicitudes: () => void; onAvisos?: () => void; avisosOn?: boolean; onChat?: () => void;
}) {
  const ofIni = (prefill.oficio || prefill.pro?.oficio || "").toLowerCase();
  const refIni = prefill.ref ? prefill.ref.split(".") : null;
  const [grupo, setGrupo] = useState<"pintura" | "fontaneria" | "otro">(
    refIni ? (refIni[0] as any) : ofIni.startsWith("pint") ? "pintura" : ofIni.startsWith("fontan") ? "fontaneria" : ofIni ? "otro" : "pintura");
  const [otro, setOtro] = useState<string>(() => (ofIni && !ofIni.startsWith("pint") && !ofIni.startsWith("fontan")) ? (prefill.oficio || prefill.pro?.oficio || "Otro") : "Electricista");
  const [tipo, setTipo] = useState<string>(refIni ? refIni[1] : "");
  const [tam, setTam] = useState<string>(refIni ? refIni[2] : "");
  const [urg, setUrg] = useState<string>("semana");
  const oficio = grupo === "pintura" ? "Pintor" : grupo === "fontaneria" ? "Fontanero" : otro;
  const lista = useMemo(() => {
    if (grupo !== "otro") return ciudades[claveOficio(oficio)] || [];
    const todas: Ciudad[] = [];
    Object.values(ciudades).forEach((l) => l.forEach((c) => { if (!todas.some((x) => x.slug === c.slug)) todas.push(c); }));
    return todas;
  }, [ciudades, grupo, oficio]);
  const ciudadGuardada = (() => { try { return localStorage.getItem("oy_ciudad") || ""; } catch { return ""; } })();
  const [ciudad, setCiudad] = useState<string>(() => {
    const ult = sols && sols[0] ? (sols[0].city_slug || slug(sols[0].zona || "")) : slug(ciudadGuardada);
    return ult || "";
  });
  const [otraCiudad, setOtraCiudad] = useState("");
  const [esOtra, setEsOtra] = useState(false);
  const [texto, setTexto] = useState(prefill.descripcion || "");
  const [tel, setTel] = useState(telBonito(user.phone || ""));
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<null | { atendida: boolean; tel: string; repetida?: boolean }>(null);

  const ciudadOk = !esOtra && lista.some((c) => c.slug === ciudad);
  const zonaNombre = esOtra ? otraCiudad.trim() : (lista.find((c) => c.slug === ciudad)?.nombre || "");
  const refTipo = grupo !== "otro" ? (REF as any)[grupo].tipos[tipo] : null;
  const refTam = refTipo?.tamanos.find((x: any) => x.k === tam);
  // Misma regla que las landings: mismo oficio en 7 días = la misma solicitud (no se cobra dos veces al profesional)
  const repetida = useMemo(() => prefill.pro ? null : (sols || []).find((s) => (s.oficio || "").trim().toLowerCase() === oficio.trim().toLowerCase()
    && Date.now() - ms(s.created_at) < 7 * 864e5) || null, [sols, oficio, prefill.pro]);

  const enviar = async () => {
    setErr("");
    const d = digitos(tel).slice(-9);
    if (esOtra && otraCiudad.trim().length < 2) { setErr("Escribe tu ciudad."); return; }
    if (!esOtra && !ciudadOk) { setErr("Elige dónde es el trabajo."); return; }
    if (grupo === "otro" && texto.trim().length < 6) { setErr("Cuéntanos qué necesitas."); return; }
    if (!/^[6789]\d{8}$/.test(d)) { setErr("Escribe un teléfono válido (9 cifras) para que te puedan llamar."); return; }
    let desc = "";
    if (grupo === "pintura") desc = "Pintura: " + (refTipo ? refTipo.titulo : "por concretar") + (refTam ? " (" + refTam.t + "). Precio orientativo mostrado: " + eurRango(refTam.r) + "." : ".");
    else if (grupo === "fontaneria") desc = "Fontanería: " + (refTipo ? refTipo.titulo + (refTam ? " — " + refTam.t : "") : "por concretar") + ". Urgencia: " + (URGENCIAS.find((u) => u[0] === urg)?.[1] || "") + ".";
    else desc = nombreOficio(otro) + ".";
    if (esOtra) desc += " Ciudad todavía sin profesionales de OficioYa (" + zonaNombre + ").";
    if (texto.trim()) desc += " " + texto.trim();
    desc += " Desde el área de cliente.";
    setEnviando(true);
    try {
      const zona = zonaNombre || (ciudad ? ciudad.charAt(0).toUpperCase() + ciudad.slice(1) : "");
      const r = await crearSolicitud(user, { oficio, zona, citySlug: esOtra ? slug(zonaNombre) : ciudad, descripcion: desc.slice(0, 1000), telefono: d, proSolicitado: prefill.pro?.id || null });
      try { localStorage.setItem("oy_ciudad", zona); } catch { /* nada */ }
      setHecho({ atendida: ciudadOk && grupo !== "otro" && !prefill.pro, tel: r.tel, repetida: !!r.repetida });
      onEnviada();
    } catch {
      setErr("No se ha podido enviar. Revisa tu conexión e inténtalo de nuevo.");
    }
    setEnviando(false);
  };

  if (hecho) {
    return (
      <Hoja onClose={onClose}>
        <div style={{ textAlign: "center", padding: "10px 4px 6px" }}>
          <div style={{ width: 74, height: 74, margin: "0 auto", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,214,143,.14)", border: "1px solid rgba(0,214,143,.45)", color: "var(--green)" }}>
            <Icono n="check" s={34} w={2.6} />
          </div>
          <h3 className="cy-h2" style={{ fontSize: 22, marginTop: 16 }}>{hecho.repetida ? "Ya tenemos tu solicitud" : "¡Solicitud enviada!"}</h3>
          <p className="cy-sub" style={{ marginTop: 6 }}>
            {hecho.repetida ? "Ya nos habías pedido " + nombreOficio(oficio).toLowerCase() + " estos días y la tenemos en marcha. Te llamamos al "
              : hecho.atendida ? "Te asignamos el profesional de tu zona y te llamará al " : "Una persona de OficioYa la revisa y te llamamos al "}
            <b style={{ color: "var(--ink)" }}>{telBonito(hecho.tel)}</b>.
          </p>
          <button className="cy-btn" style={{ marginTop: 20 }} onClick={() => { onVerSolicitudes(); onClose(); }}>Ver cómo va <Icono n="flecha" s={18} w={2.4} /></button>
          {!avisosOn && onAvisos && (
            <button className="cy-btn-g cy-full" style={{ marginTop: 10 }} onClick={onAvisos}><Icono n="campana" s={18} />Avísame cuando me respondan</button>
          )}
        </div>
      </Hoja>
    );
  }

  return (
    <Hoja titulo="Pedir presupuesto" onClose={onClose} pie={repetida ? (
      <>
        <p className="cy-mini" style={{ color: "var(--soft)", marginBottom: 10 }}>Ya tienes una solicitud de {nombreOficio(repetida.oficio).toLowerCase()} de {haceCuanto(repetida.created_at)}{repetida.pro && !repetida.anulado ? " con " + repetida.pro.nombre : ""}. Si es para otro trabajo, escríbenos y lo vemos.</p>
        <div className="cy-two">
          {repetida.pro?.telefono && !repetida.anulado
            ? <a className="cy-btn-s" href={enlaceTel(repetida.pro.telefono)}><Icono n="tel" s={17} />Llamar a {repetida.pro.nombre}</a>
            : <button className="cy-btn-s" onClick={() => { onVerSolicitudes(); onClose(); }}>Ver cómo va</button>}
          <button className="cy-btn-g" onClick={() => { onClose(); onChat?.(); }}><Icono n="chat" s={17} />Escribirnos</button>
        </div>
      </>
    ) : (
      <>
        {err && <p className="cy-msg" style={{ marginTop: 0, marginBottom: 8 }}>{err}</p>}
        <button className="cy-btn" disabled={enviando} onClick={enviar}>{enviando ? "Enviando…" : <>Pedir presupuesto gratis <Icono n="flecha" s={18} w={2.4} /></>}</button>
        <p className="cy-mini" style={{ textAlign: "center", marginTop: 8 }}>Gratis y sin compromiso · Hablas directamente con el profesional</p>
      </>
    )}>
      {prefill.pro && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderRadius: 16, marginBottom: 6, background: "rgba(255,200,0,.08)", border: "1px solid rgba(255,200,0,.35)" }}>
          <Avatar nombre={prefill.pro.nombre} url={prefill.pro.avatar} size={38} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 14 }}>Para {prefill.pro.nombre} · {nombreOficio(prefill.pro.oficio)}</p>
            <p className="cy-mini">OficioYa revisa tu solicitud y te confirma el profesional.</p>
          </div>
        </div>
      )}

      <p className="cy-lbl" style={{ marginTop: 6 }}>1 · ¿Qué necesitas?</p>
      <div className="cy-tiles">
        <button className="cy-tile" aria-pressed={grupo === "pintura"} onClick={() => { setGrupo("pintura"); setTipo(""); setTam(""); }}>
          <span className="ic"><Icono n="rodillo" s={20} /></span><span><b>Pintura</b><small>Pisos, habitaciones y fachadas</small></span>
        </button>
        <button className="cy-tile" aria-pressed={grupo === "fontaneria"} onClick={() => { setGrupo("fontaneria"); setTipo(""); setTam(""); }}>
          <span className="ic"><Icono n="gota" s={20} /></span><span><b>Fontanería</b><small>Fugas, atascos y tuberías</small></span>
        </button>
      </div>
      <div className="cy-row" style={{ marginTop: 10 }}>
        <button className="cy-chip dash" aria-pressed={grupo === "otro"} onClick={() => setGrupo("otro")}>Otro oficio</button>
        {grupo === "otro" && OTROS.map((o) => <button key={o} className="cy-chip" aria-pressed={otro === o} onClick={() => setOtro(o)}>{nombreOficio(o)}</button>)}
      </div>

      <div className="cy-between" style={{ margin: "18px 0 10px" }}>
        <p className="cy-lbl" style={{ margin: 0 }}>2 · ¿Dónde?</p>
        {grupo !== "otro" && lista.length > 0 && <span className="cy-mini">{grupo === "pintura" ? "Pintores" : "Fontaneros"} en {lista.map((c) => c.nombre).join(" y ")}</span>}
      </div>
      <div className="cy-row">
        {lista.map((c) => <button key={c.slug} className="cy-chip" aria-pressed={!esOtra && ciudad === c.slug} onClick={() => { setEsOtra(false); setCiudad(c.slug); }}>{c.nombre}</button>)}
        <button className="cy-chip dash" aria-pressed={esOtra} onClick={() => setEsOtra(true)}>Otra ciudad</button>
      </div>
      {esOtra && (
        <label className="cy-fld" style={{ marginTop: 10 }}>
          <span>Tu ciudad</span>
          <input className="cy-inp" value={otraCiudad} onChange={(e) => setOtraCiudad(e.target.value)} placeholder="Ej: Córdoba" maxLength={60} />
          {grupo !== "otro" && <small className="cy-mini" style={{ display: "block", marginTop: 6 }}>Todavía no tenemos {grupo === "pintura" ? "pintores" : "fontaneros"} ahí: lo revisamos y te decimos algo.</small>}
        </label>
      )}

      {grupo !== "otro" && (
        <>
          <p className="cy-lbl">3 · {grupo === "pintura" ? "¿Qué pintamos?" : "¿Qué pasa?"}</p>
          <div className="cy-row">
            {Object.entries((REF as any)[grupo].tipos).map(([k, t]: any) => (
              <button key={k} className="cy-chip" aria-pressed={tipo === k} onClick={() => { setTipo(k); setTam(""); }}>{t.titulo}</button>
            ))}
          </div>
          {refTipo && (
            <>
              <p className="cy-q">{refTipo.pregunta}</p>
              <div className="cy-row">
                {refTipo.tamanos.map((x: any) => <button key={x.k} className="cy-chip" aria-pressed={tam === x.k} onClick={() => setTam(x.k)}>{x.t}</button>)}
              </div>
            </>
          )}
          {refTam && (
            <div className="cy-ticket cy-entra">
              <div><small>PRECIO ORIENTATIVO</small><strong>{eurRango(refTam.r)}</strong></div>
              <p>{grupo === "pintura" ? "El pintor te confirma el precio al ver la vivienda." : "El fontanero te confirma el precio antes de empezar."}</p>
            </div>
          )}
          {grupo === "fontaneria" && (
            <>
              <p className="cy-q">¿Para cuándo?</p>
              <div className="cy-seg" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
                {URGENCIAS.map(([k, t]) => <button key={k} aria-pressed={urg === k} onClick={() => setUrg(k)}>{t}</button>)}
              </div>
            </>
          )}
        </>
      )}

      <p className="cy-lbl">{grupo === "otro" ? "3" : "4"} · Cuéntanoslo {grupo === "otro" ? "" : "(opcional)"}</p>
      <textarea className="cy-inp" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={600}
        placeholder={grupo === "pintura" ? "Ej: Salón y dos dormitorios, paredes en blanco roto. Hay que tapar alguna grieta." : grupo === "fontaneria" ? "Ej: Gotea el sifón del fregadero desde ayer." : "Ej: Cambiar dos enchufes y una lámpara del salón."} />

      <label className="cy-fld" style={{ marginTop: 14 }}>
        <span>¿A qué teléfono te llamamos?</span>
        <input className="cy-inp" type="tel" inputMode="tel" autoComplete="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="612 345 678" maxLength={16} />
      </label>

    </Hoja>
  );
}

export const linkWaOficioYa = (texto: string) => enlaceWa("656398014", texto);
