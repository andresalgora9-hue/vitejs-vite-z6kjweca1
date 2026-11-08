// ============================================================
// OficioYa · ÁREA DEL CLIENTE — Inicio
// ============================================================
import React from "react";
import type { Cliente, Solicitud, Presupuesto, ProPublico } from "./clienteComun";
import { Icono, Esqueleto, primerNombre, eur, enlaceWa, WA_OY, TZ } from "./clienteComun";
import { estadoSolicitud } from "./datos";
import { TarjetaSolicitud, type PrefillSolicitud } from "./ClienteSolicitudes";
import { PrimerosPasos, TarjetaPro, type EstadoPasos } from "./ClienteExtras";

function saludo() {
  const h = Number(new Date().toLocaleString("es-ES", { timeZone: TZ, hour: "2-digit", hour12: false }));
  return h >= 6 && h < 13 ? "Buenos días" : h >= 13 && h < 21 ? "Buenas tardes" : "Buenas noches";
}

export default function ClienteInicio({ user, sols, presus, pros, pasos, mostrarPasos, onNueva, onApuntar, onIr, onVerPros, onVerPro, onChat, onInstalar, onAvisos, onAcceso, onOcultarPasos }: {
  user: Cliente; sols: Solicitud[] | null; presus: Presupuesto[] | null; pros: ProPublico[] | null; pasos: EstadoPasos; mostrarPasos: boolean;
  onNueva: (p?: PrefillSolicitud) => void; onApuntar: () => void; onIr: (t: "solicitudes" | "presupuestos" | "calcular" | "perfil") => void;
  onVerPros: () => void; onVerPro: (p: ProPublico) => void; onChat: () => void; onInstalar: () => void; onAvisos: () => void; onAcceso: () => void; onOcultarPasos: () => void;
}) {
  const nom = primerNombre(user.name);
  const activa = (sols || []).find((s) => !estadoSolicitud(s).fin) || null;
  const conPrecio = (presus || []).filter((p) => p.importe != null && p.estado !== "descartado");
  const minimo = conPrecio.length ? Math.min(...conPrecio.map((p) => Number(p.importe))) : null;

  return (
    <div className="cy-wrap" style={{ paddingTop: 18 }}>
      <p className="cy-eyebrow">{saludo()}</p>
      <h1 className="cy-h1" style={{ marginTop: 6 }}>{nom ? <>Hola, <span>{nom}</span></> : <>Tu casa, <span>en orden</span></>}</h1>
      <p className="cy-sub" style={{ marginTop: 8, marginBottom: 18 }}>Tus solicitudes, tus presupuestos y lo que cuesta cada cosa, en un solo sitio.</p>

      {mostrarPasos && <PrimerosPasos e={pasos} onPedir={() => onNueva()} onAcceso={onAcceso} onAvisos={onAvisos} onInstalar={onInstalar} onOcultar={onOcultarPasos} />}

      {sols === null && <Esqueleto alto={190} />}
      {activa && (
        <div data-guia="solicitud" data-guia-tipo="activa">
          <div className="cy-sec" style={{ marginTop: 6 }}>
            <p className="cy-h2">Tu solicitud</p>
            <button className="cy-link" onClick={() => onIr("solicitudes")}>Ver todas <Icono n="cheveron" s={15} /></button>
          </div>
          <TarjetaSolicitud s={activa} compacta onVer={() => onIr("solicitudes")} />
        </div>
      )}
      {sols && !activa && (
        <div className="cy-glass cy-card cy-card-oro cy-entra" data-guia="solicitud" data-guia-tipo="pedir">
          <p className="cy-h2">¿Qué necesitas arreglar?</p>
          <p className="cy-mini" style={{ marginTop: 4, marginBottom: 14, color: "var(--soft)" }}>Te asignamos un profesional comprobado de tu zona. Gratis y sin compromiso.</p>
          <div className="cy-tiles">
            <button className="cy-tile" onClick={() => onNueva({ oficio: "Pintor" })}><span className="ic"><Icono n="rodillo" s={20} /></span><span><b>Pintura</b><small>Pisos, habitaciones y fachadas</small></span></button>
            <button className="cy-tile" onClick={() => onNueva({ oficio: "Fontanero" })}><span className="ic"><Icono n="gota" s={20} /></span><span><b>Fontanería</b><small>Fugas, atascos y tuberías</small></span></button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 4, marginBottom: 14 }}>
        {[
          { ic: "mas", t: "Pedir presupuesto", fn: () => onNueva() },
          { ic: "presupuestos", t: "Apuntar presupuesto", fn: onApuntar },
          { ic: "calcular", t: "Calcular precio", fn: () => onIr("calcular") },
        ].map((a) => (
          <button key={a.t} onClick={a.fn} className="cy-glass" style={{ borderRadius: 20, padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--ink)", minHeight: 96 }}>
            <span style={{ width: 40, height: 40, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,200,0,.12)", border: "1px solid rgba(255,200,0,.3)", color: "var(--gold)" }}><Icono n={a.ic} s={20} w={2.2} /></span>
            <span style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.2, textAlign: "center" }}>{a.t}</span>
          </button>
        ))}
      </div>

      {presus && presus.length > 0 && (
        <button className="cy-glass cy-card" onClick={() => onIr("presupuestos")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", color: "var(--ink)" }}>
          <span style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--grad)", color: "#1A1200" }}><Icono n="presupuestos" s={21} w={2.2} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="cy-h3">Tus presupuestos</p>
            <p className="cy-mini">{presus.length} apuntado{presus.length === 1 ? "" : "s"}{minimo != null ? " · el más bajo, " + eur(minimo) : ""}</p>
          </div>
          <Icono n="cheveron" s={20} c="#96A0B3" />
        </button>
      )}

      <div className="cy-sec">
        <p className="cy-h2">Profesionales de OficioYa</p>
        <button className="cy-link" onClick={onVerPros}>Ver todos <Icono n="cheveron" s={15} /></button>
      </div>
      {pros === null ? <Esqueleto alto={170} /> : (
        <div className="cy-carril">
          {pros.slice(0, 10).map((p) => <TarjetaPro key={p.id} p={p} onClick={() => onVerPro(p)} />)}
          <button onClick={onVerPros} className="cy-glass" style={{ width: 130, borderRadius: 22, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#FFE38A", fontWeight: 800, fontSize: 14 }}>
            <span style={{ width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,200,0,.45)" }}><Icono n="flecha" s={20} w={2.4} /></span>
            Ver los {pros.length}
          </button>
        </div>
      )}

      <div className="cy-glass cy-card" style={{ marginTop: 14 }}>
        <p className="cy-h3" style={{ marginBottom: 12 }}>Así trabajamos</p>
        {[
          ["escudo", "Autónomos comprobados", "Comprobamos su alta de autónomo y firma un contrato con OficioYa."],
          ["usuario", "Un profesional, no seis llamadas", "Te asignamos uno de tu zona y hablas directamente con él."],
          ["euro", "Pagas al profesional, no a nosotros", "Tu dinero no pasa por OficioYa en ningún momento."],
        ].map(([ic, t, d]) => (
          <div key={t} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <span style={{ width: 34, height: 34, flex: "0 0 34px", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.06)", color: "var(--gold)" }}><Icono n={ic} s={18} /></span>
            <div><p style={{ fontWeight: 800, fontSize: 14.5 }}>{t}</p><p className="cy-mini">{d}</p></div>
          </div>
        ))}
      </div>

      <div className="cy-glass cy-card">
        <p className="cy-h3">¿Alguna duda?</p>
        <p className="cy-mini" style={{ marginTop: 3 }}>Te responde una persona del equipo, no un robot.</p>
        <div className="cy-two" style={{ marginTop: 12 }}>
          <button className="cy-btn-s" onClick={onChat}><Icono n="chat" s={18} />Escribirnos</button>
          <a className="cy-btn-g" href={enlaceWa(WA_OY, "Hola, soy cliente de OficioYa y tengo una duda.")} target="_blank" rel="noopener noreferrer"><Icono n="wa" s={18} />WhatsApp</a>
        </div>
      </div>
    </div>
  );
}
