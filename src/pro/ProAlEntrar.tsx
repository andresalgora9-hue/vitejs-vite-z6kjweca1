// ============================================================
// OficioYa · Panel PROFESIONAL — ventanas al entrar en la app (11/11/2026)
// Cada vez que el profesional entra, por este orden y de una en una:
//   1. «Falta actualizar este cliente»: los clientes que no ha movido de etapa, uno a uno
//      (Contactado · Presupuestado · Ganado, con el importe aproximado · Perdido, con el motivo).
//      Es obligatoria: no se cierra sin contestar. Salen 5 cada vez; el resto, la próxima vez que entre.
//   2. «Activa los avisos», si los avisos de clientes nuevos no le llegan a ningún dispositivo.
//   3. «Guarda tu tarjeta», si no tiene tarjeta para el cobro de sus facturas (o ha caducado, o falló un cobro).
//   La 2 y la 3 se quitan con «Ahora no», pero vuelven a salir cada vez que entra hasta que lo haga.
// «Entrar» = abrir la app (también al tocar un aviso del móvil) o volver a ella tras 15 minutos fuera.
// Si está abierta la presentación, la ficha, «¡Ya estás en marcha!» o el anexo de tarjeta, espera a que se cierren.
// Datos: RPC oy_pro_al_entrar (las reglas de qué clientes toca actualizar están en la base de datos)
// y oy_lead_etapa (guarda la etapa). Avisos: estadoPush / activarPush / asegurarPush de proComun.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../supabase";
import {
  C, F, CANAL_LABEL, eur, eurCorto, fechaHora, haceCuanto, digitos, enlaceTel, enlaceWhatsApp,
  estadoPush, activarPush, asegurarPush, esIOS, instalada,
} from "./proComun";
import type { Estado, Canal, EstadoPush } from "./proComun";

// ── TIPOS ───────────────────────────────────────────────────
type LeadPend = {
  id: string; created_at: string; estado: Estado; estado_at: string; canal: Canal; trade: string | null;
  client_name: string | null; client_phone: string | null; zona: string | null; descripcion: string | null;
  presupuesto_eur: number | null; falta: "etapa" | "importe";
};
type Fallida = { id: string; number: string; total: number; error: string | null };
type DatosTarjeta = {
  falta: null | "sin_tarjeta" | "caducada" | "cobro_fallido";
  enlace: string | null;
  tarjeta: { marca: string | null; ultimos4: string | null; caduca_mes: number | null; caduca_anio: number | null } | null;
  fallidas: Fallida[];
  impago: { activo?: boolean; usados?: number; limite?: number; bloqueado?: boolean };
};
type Entrada = { activo: boolean; leads?: { total: number; lista: LeadPend[] }; tarjeta?: DatosTarjeta; push_guardado?: boolean };

const VUELTA_MIN = 15;   // minutos fuera de la app para que al volver cuente como entrar otra vez
const ESPERA_MS = 700;   // deja que carguen antes las otras ventanas de entrada (ficha, «¡Ya estás en marcha!»)
const Z = 25800;

const ETAPA: Record<Estado, { t: string; c: string }> = {
  nuevo: { t: "Nuevo", c: C.accent },
  contactado: { t: "Contactado", c: C.blue },
  presupuesto: { t: "Presupuesto enviado", c: C.orange },
  ganado: { t: "Ganado", c: C.green },
  perdido: { t: "Perdido", c: C.red },
};

// Los mismos motivos que la ficha del lead (pestaña Leads)
const MOTIVOS_PERDIDO = [
  { id: "no_contesta", label: "No contesta" },
  { id: "caro", label: "Le pareció caro" },
  { id: "otro_profesional", label: "Eligió a otro profesional" },
  { id: "ya_no_lo_necesita", label: "Ya no lo necesita" },
  { id: "fuera_de_zona", label: "Está fuera de mi zona" },
  { id: "no_puedo_atenderlo", label: "No puedo atenderlo" },
  { id: "otros", label: "Otros" },
];

const esMovil = () =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
const esAndroid = () => /Android/i.test(navigator.userAgent);

// «1.200», «1200,50», «1.200,50», «1200.5», «1200 €» → número
function aNumero(s: string): number {
  let t = (s || "").replace(/[\s€]/g, "");
  if (!t) return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, "");
  return Number(t);
}

const lsLeer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsPoner = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* nada */ } };

// ── PIEZAS ──────────────────────────────────────────────────
function Ventana({ titulo, children, onEsc }: { titulo: string; children: React.ReactNode; onEsc?: () => void }) {
  useEffect(() => {
    if (!onEsc) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onEsc(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onEsc]);
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} style={{
      position: "fixed", inset: 0, zIndex: Z, background: "rgba(0,0,0,0.74)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16, fontFamily: F,
    }}>
      <div style={{
        width: "100%", maxWidth: 420, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxSizing: "border-box",
        background: C.surface, border: "1px solid " + C.border, borderRadius: 18, padding: "20px 18px 18px",
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)", color: C.text, animation: "oyAlEntrar .22s ease-out",
      }}>
        <style>{"@keyframes oyAlEntrar{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}"}</style>
        {children}
      </div>
    </div>
  );
}

function Chip({ texto, color }: { texto: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 11.5, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "4px 9px", borderRadius: 99, background: color + "22", color,
    }}>{texto}</span>
  );
}

const boton = (fondo: string, texto = "#000"): React.CSSProperties => ({
  width: "100%", minHeight: 48, borderRadius: 12, border: "none", background: fondo, color: texto, fontFamily: F,
  fontWeight: 900, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  gap: 8, textDecoration: "none", boxSizing: "border-box", padding: "0 14px",
});
const botonSuave: React.CSSProperties = {
  width: "100%", minHeight: 44, borderRadius: 12, border: "1px solid " + C.border, background: "transparent",
  color: C.mutedL, fontFamily: F, fontWeight: 800, fontSize: 14, cursor: "pointer", marginTop: 8,
};
const nota: React.CSSProperties = { fontSize: 12.5, color: C.muted, lineHeight: 1.45, marginTop: 12, textAlign: "center" };
const h2: React.CSSProperties = { margin: "10px 0 8px", fontSize: 21, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.2 };
const parrafo: React.CSSProperties = { margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.55, color: C.mutedL };

function Pasos({ lista }: { lista: React.ReactNode[] }) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
      {lista.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: i ? 10 : 0 }}>
          <span style={{
            width: 22, height: 22, borderRadius: "50%", background: C.accent, color: "#000", fontSize: 12, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>{i + 1}</span>
          <span style={{ fontSize: 14, lineHeight: 1.45, color: C.text }}>{p}</span>
        </div>
      ))}
    </div>
  );
}

// ── 1. «FALTA ACTUALIZAR ESTE CLIENTE» ──────────────────────
function VentanaCliente({ lead, n, de, onHecho, onSaltar }: {
  lead: LeadPend; n: number; de: number; onHecho: () => void; onSaltar: () => void;
}) {
  const soloImporte = lead.falta === "importe";
  const [paso, setPaso] = useState<"elegir" | "ganado" | "perdido">(soloImporte ? "ganado" : "elegir");
  const [importe, setImporte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [fallos, setFallos] = useState(0);

  const guardar = async (estado: string, imp: number | null = null, mot: string | null = null) => {
    if (guardando) return;
    setGuardando(true); setError("");
    const { error: e } = await db.rpc("oy_lead_etapa", { p_lead: lead.id, p_estado: estado, p_importe: imp, p_motivo: mot });
    setGuardando(false);
    if (e) { setError("No se ha podido guardar. Revisa la conexión e inténtalo otra vez."); setFallos((f) => f + 1); return; }
    onHecho();
  };

  const guardarGanado = () => {
    const v = aNumero(importe);
    if (!importe.trim() || isNaN(v) || v <= 0) { setError("Pon el importe aproximado del trabajo, en euros."); return; }
    if (v > 1000000) { setError("Revisa el importe: parece demasiado alto."); return; }
    guardar("ganado", Math.round(v * 100) / 100);
  };
  const guardarPerdido = () => {
    if (!motivo) { setError("Elige por qué no ha salido."); return; }
    guardar("perdido", null, motivo);
  };

  const nombre = (lead.client_name || "").trim() || (lead.canal === "llamada" ? "Llamada sin nombre" : "Cliente sin nombre");
  const tel = digitos(lead.client_phone) ? lead.client_phone : null;
  const donde = [lead.zona, tel ? "Tel. " + tel : ""].filter(Boolean).join(" · ");
  const et = ETAPA[lead.estado] || ETAPA.nuevo;
  const opciones = [
    { id: "contactado", t: "Contactado", d: lead.estado === "contactado" ? "Sigue igual" : "Ya he hablado con él", c: C.blue },
    { id: "presupuesto", t: "Presupuestado", d: lead.estado === "presupuesto" ? "Esperando respuesta" : "Le he pasado precio", c: C.orange },
    { id: "ganado", t: "Ganado", d: "Me ha contratado", c: C.green },
    { id: "perdido", t: "Perdido", d: "No sale el trabajo", c: C.red },
  ].filter((o) => !(lead.estado === "presupuesto" && o.id === "contactado"));

  const elegir = (id: string) => {
    setError("");
    if (id === "ganado") { setImporte(lead.presupuesto_eur ? String(lead.presupuesto_eur).replace(".", ",") : ""); setPaso("ganado"); return; }
    if (id === "perdido") { setPaso("perdido"); return; }
    guardar(id);
  };

  return (
    <Ventana titulo="Falta actualizar este cliente">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Chip texto={de > 1 ? "Cliente " + n + " de " + de : "Por actualizar"} color={C.accent} />
      </div>
      <h2 style={h2}>{soloImporte ? "Falta el importe de este trabajo" : "Falta actualizar este cliente"}</h2>
      {paso === "elegir" && n === 1 && (
        <p style={{ ...parrafo, fontSize: 14 }}>
          Dinos en qué etapa está. Así sabemos qué clientes te interesan de verdad y te mandamos más como los que ganas.
        </p>
      )}

      {/* El cliente */}
      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 5, background: C.mutedL + "1F", color: C.mutedL }}>
            {CANAL_LABEL[lead.canal] || "Formulario"}
          </span>
          <span style={{ fontSize: 12, color: C.mutedL }}>Te llegó el {fechaHora(lead.created_at)}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text, overflowWrap: "anywhere" }}>{nombre}</div>
        {donde && <div style={{ fontSize: 13, color: C.mutedL, marginTop: 2 }}>{donde}</div>}
        {lead.descripcion && (
          <div style={{
            fontSize: 13.5, color: C.text, marginTop: 6, lineHeight: 1.45, overflow: "hidden",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
          }}>«{lead.descripcion}»</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12.5, color: C.mutedL }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: et.c, flexShrink: 0 }} />
          <span>
            Ahora: <b style={{ color: et.c }}>{et.t}</b>
            {lead.estado === "ganado" && lead.presupuesto_eur ? " · " + eurCorto(lead.presupuesto_eur) : ""}
            {" "}{lead.estado === "nuevo" ? "· sin contactar " + haceCuanto(lead.created_at).replace("hace ", "desde hace ") : "· " + haceCuanto(lead.estado_at).replace("hace ", "desde hace ")}
          </span>
        </div>
        {tel && paso === "elegir" && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <a href={enlaceTel(tel)} style={{ ...boton("transparent", C.green), minHeight: 38, fontSize: 13, border: "1px solid " + C.green + "88" }}>Llamar</a>
            <a href={enlaceWhatsApp(tel)} target="_blank" rel="noreferrer" style={{ ...boton("transparent", C.green), minHeight: 38, fontSize: 13, border: "1px solid " + C.green + "88" }}>WhatsApp</a>
          </div>
        )}
      </div>

      {paso === "elegir" && (
        <>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>¿En qué etapa está?</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {opciones.map((o, i) => (
              <button key={o.id} onClick={() => elegir(o.id)} disabled={guardando} style={{
                gridColumn: opciones.length === 3 && i === 0 ? "1 / -1" : undefined,
                minHeight: 62, borderRadius: 12, border: "1px solid " + o.c + "77", background: o.c + "16",
                color: C.text, fontFamily: F, cursor: guardando ? "wait" : "pointer", textAlign: "left", padding: "9px 12px",
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, opacity: guardando ? 0.6 : 1,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 900, color: o.c }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: o.c, flexShrink: 0 }} />{o.t}
                </span>
                <span style={{ fontSize: 12, color: C.mutedL, fontWeight: 600 }}>{o.d}</span>
              </button>
            ))}
          </div>
          {lead.estado === "nuevo" && (
            <button onClick={() => guardar("sin_hablar")} disabled={guardando} style={{ ...botonSuave, marginTop: 10 }}>
              Todavía no he hablado con él
            </button>
          )}
        </>
      )}

      {paso === "ganado" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>{soloImporte ? "Lo marcaste como ganado 🎉" : "¡Enhorabuena! 🎉"}</div>
          <label htmlFor="oy-importe" style={{ display: "block", fontSize: 14, color: C.mutedL, marginBottom: 8 }}>
            ¿Por cuánto es el trabajo, más o menos?
          </label>
          <div style={{ position: "relative" }}>
            <input id="oy-importe" value={importe} onChange={(e) => { setImporte(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") guardarGanado(); }}
              inputMode="decimal" autoFocus placeholder="Ej. 1.200" autoComplete="off" style={{
                width: "100%", boxSizing: "border-box", padding: "13px 40px 13px 14px", background: C.bg,
                border: "1px solid " + (error ? C.red : C.border), borderRadius: 12, color: C.text, fontSize: 20,
                fontWeight: 800, fontFamily: F, outline: "none",
              }} />
            <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: C.mutedL, fontSize: 18, fontWeight: 800 }}>€</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
            Aproximado vale. El cliente no lo ve: nos sirve para saber qué clientes te funcionan mejor.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {!soloImporte && <button onClick={() => { setPaso("elegir"); setError(""); }} style={{ ...botonSuave, marginTop: 0, flex: "0 0 96px" }}>Atrás</button>}
            <button onClick={guardarGanado} disabled={guardando} style={{ ...boton(C.green), flex: 1 }}>{guardando ? "Guardando..." : "Guardar"}</button>
          </div>
        </>
      )}

      {paso === "perdido" && (
        <>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>¿Por qué no ha salido?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {MOTIVOS_PERDIDO.map((m) => {
              const act = motivo === m.id;
              return (
                <button key={m.id} onClick={() => { setMotivo(m.id); setError(""); }} style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left", minHeight: 44,
                  padding: "9px 12px", borderRadius: 10, cursor: "pointer", fontFamily: F,
                  background: act ? C.red + "14" : "transparent", border: "1px solid " + (act ? C.red : C.border),
                  color: act ? C.text : C.mutedL, fontSize: 14, fontWeight: 700,
                }}>
                  <span style={{
                    width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
                    border: "2px solid " + (act ? C.red : C.muted), background: act ? C.red : "transparent",
                  }} />
                  {m.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => { setPaso("elegir"); setError(""); }} style={{ ...botonSuave, marginTop: 0, flex: "0 0 96px" }}>Atrás</button>
            <button onClick={guardarPerdido} disabled={guardando} style={{ ...boton(C.red, "#fff"), flex: 1 }}>{guardando ? "Guardando..." : "Guardar"}</button>
          </div>
        </>
      )}

      {error && <div role="alert" style={{ color: C.red, fontSize: 13, fontWeight: 700, marginTop: 10 }}>{error}</div>}
      {fallos >= 2 && (
        <button onClick={onSaltar} style={{ ...botonSuave, border: "none", textDecoration: "underline", marginTop: 4 }}>
          Saltar este cliente por ahora
        </button>
      )}
    </Ventana>
  );
}

// ── 2. «ACTIVA LOS AVISOS» ──────────────────────────────────
type VariantePush = Exclude<EstadoPush, "activado"> | "otro";

function VentanaAvisos({ userId, variante: inicial, onActivados, onAhoraNo, onDejarOtro }: {
  userId: string; variante: VariantePush; onActivados: () => void; onAhoraNo: () => void; onDejarOtro: () => void;
}) {
  const [variante, setVariante] = useState<VariantePush>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");

  const activar = async () => {
    if (ocupado) return;
    setOcupado(true); setAviso("");
    try {
      const r = await activarPush(userId);
      if (r === "activado") { onActivados(); return; }
      if (r === "desactivado") setAviso("No se han activado. Cuando el móvil te pregunte, pulsa «Permitir».");
      else setVariante(r);
    } catch {
      setAviso("No se han podido activar. Inténtalo otra vez.");
    }
    setOcupado(false);
  };

  const yaPermitidos = async () => {
    if (ocupado) return;
    setOcupado(true); setAviso("");
    const e = await estadoPush(userId).catch(() => "bloqueado" as EstadoPush);
    if (e === "activado") { onActivados(); return; }
    if (e === "bloqueado") { setAviso("Siguen bloqueados. Revisa los pasos y vuelve a probar."); setOcupado(false); return; }
    setOcupado(false);
    activar();
  };

  const movil = esMovil();
  const titulo =
    variante === "otro" ? "¿Quieres los avisos en este móvil?"
    : variante === "bloqueado" ? "Tienes los avisos bloqueados"
    : variante === "instalar_ios" ? "Instala OficioYa para recibir avisos"
    : variante === "no_compatible" ? "Desde aquí no te pueden llegar avisos"
    : "Activa los avisos de clientes nuevos";

  const pasosBloqueado = esIOS()
    ? [<>Abre <b>Ajustes</b> del iPhone y entra en <b>Notificaciones</b>.</>, <>Busca <b>OficioYa</b> y activa <b>«Permitir notificaciones»</b>.</>, <>Vuelve aquí y pulsa <b>«Ya los he permitido»</b>.</>]
    : esAndroid()
      ? [<>Toca el <b>candado</b> junto a la dirección (o los tres puntos <b>⋮</b> → <b>Configuración del sitio</b>). Si tienes la app instalada: mantén pulsado su icono → <b>Información de la app</b>.</>, <>Entra en <b>Notificaciones</b> y elige <b>Permitir</b>.</>, <>Vuelve aquí y pulsa <b>«Ya los he permitido»</b>.</>]
      : [<>Pulsa el <b>candado</b> a la izquierda de la dirección de la web.</>, <>En <b>Notificaciones</b>, elige <b>Permitir</b>.</>, <>Vuelve aquí y pulsa <b>«Ya los he permitido»</b>.</>];

  return (
    <Ventana titulo={titulo} onEsc={variante === "otro" ? onDejarOtro : onAhoraNo}>
      <div style={{ fontSize: 38, lineHeight: 1 }}>🔔</div>
      <h2 style={h2}>{titulo}</h2>

      {variante === "otro" && (
        <>
          <p style={parrafo}>
            Ahora los avisos de clientes nuevos te llegan a otro dispositivo. Solo pueden llegar a uno: si los activas aquí, dejarán de llegar al otro.
          </p>
          <button onClick={activar} disabled={ocupado} autoFocus style={boton(C.accent)}>{ocupado ? "Activando..." : "Recibirlos en este móvil"}</button>
          <button onClick={onDejarOtro} style={botonSuave}>Dejarlo como está</button>
        </>
      )}

      {variante === "desactivado" && (
        <>
          <p style={parrafo}>
            Ahora mismo no te llegan avisos: si entra un cliente, no te enterarás hasta que abras la app. Y el primero que llama suele llevarse el trabajo.
          </p>
          {!movil && (
            <p style={{ ...parrafo, fontSize: 13, color: C.muted }}>
              Si usas OficioYa en el móvil, mejor actívalos allí: los avisos solo llegan a un dispositivo.
            </p>
          )}
          <button onClick={activar} disabled={ocupado} autoFocus style={boton(C.accent)}>{ocupado ? "Activando..." : "Activar avisos"}</button>
          <button onClick={onAhoraNo} style={botonSuave}>Ahora no</button>
        </>
      )}

      {variante === "bloqueado" && (
        <>
          <p style={parrafo}>Bloqueaste los avisos de OficioYa en este {movil ? "móvil" : "navegador"}. Para enterarte al momento de cada cliente, vuelve a permitirlos:</p>
          <Pasos lista={pasosBloqueado} />
          <button onClick={yaPermitidos} disabled={ocupado} autoFocus style={boton(C.accent)}>{ocupado ? "Comprobando..." : "Ya los he permitido"}</button>
          <button onClick={onAhoraNo} style={botonSuave}>Ahora no</button>
        </>
      )}

      {variante === "instalar_ios" && (
        <>
          <p style={parrafo}>En iPhone los avisos solo llegan con la app instalada. Es un momento:</p>
          <Pasos lista={[
            <>Pulsa <b>Compartir</b> en la barra de Safari.</>,
            <>Toca <b>«Añadir a pantalla de inicio»</b> y luego <b>«Añadir»</b>.</>,
            <>Abre OficioYa desde el icono nuevo y activa los avisos.</>,
          ]} />
          <button onClick={onAhoraNo} autoFocus style={boton(C.accent)}>Entendido</button>
        </>
      )}

      {variante === "no_compatible" && (
        <>
          <p style={parrafo}>
            {esIOS() && !instalada()
              ? "Ábrela en Safari e instálala en la pantalla de inicio: así te llegarán los avisos de cada cliente nuevo."
              : "Este navegador no permite avisos. Abre aficioya.com en Chrome (Android) o en Safari (iPhone) e instala la app para enterarte al momento de cada cliente nuevo."}
          </p>
          <button onClick={onAhoraNo} autoFocus style={boton(C.accent)}>Entendido</button>
        </>
      )}

      {aviso && <div role="alert" style={{ color: C.orange, fontSize: 13, fontWeight: 700, marginTop: 10, lineHeight: 1.45 }}>{aviso}</div>}
      {variante !== "otro" && <div style={nota}>Te lo recordaremos cada vez que entres hasta que estén activados.</div>}
    </Ventana>
  );
}

// ── 3. «GUARDA TU TARJETA» ──────────────────────────────────
function VentanaTarjeta({ t, onAhoraNo, onVerFacturas }: { t: DatosTarjeta; onAhoraNo: () => void; onVerFacturas?: () => void }) {
  const marca = t.tarjeta?.marca ? t.tarjeta.marca.charAt(0).toUpperCase() + t.tarjeta.marca.slice(1) : "Tu tarjeta";
  const caduca = t.tarjeta?.caduca_mes ? String(t.tarjeta.caduca_mes).padStart(2, "0") + "/" + String(t.tarjeta.caduca_anio || "").slice(-2) : "";
  const fallidas = t.fallidas || [];
  const quedan = t.impago?.activo ? Math.max(0, Number(t.impago.limite || 0) - Number(t.impago.usados || 0)) : null;
  const titulo =
    t.falta === "cobro_fallido" ? (fallidas.length > 1 ? "No hemos podido cobrar tus facturas" : "No hemos podido cobrar tu factura")
    : t.falta === "caducada" ? "Tu tarjeta ha caducado"
    : "Guarda tu tarjeta para tus facturas";

  return (
    <Ventana titulo={titulo} onEsc={onAhoraNo}>
      <div style={{ fontSize: 38, lineHeight: 1 }}>💳</div>
      <h2 style={h2}>{titulo}</h2>

      {t.falta === "sin_tarjeta" && (
        <p style={parrafo}>
          Con tu tarjeta guardada, cada factura de clientes se paga sola al emitirse: sin transferencias ni Bizum. Si tienes alguna pendiente, se cobra al guardarla.
        </p>
      )}
      {t.falta === "caducada" && (
        <p style={parrafo}>
          {marca} •••• {t.tarjeta?.ultimos4 || "····"}{caduca ? " caducó en " + caduca : " ha caducado"}. Pon otra para que tus facturas se sigan pagando solas.
        </p>
      )}
      {t.falta === "cobro_fallido" && (
        <>
          <p style={parrafo}>
            {fallidas.map((f) => f.number).join(", ")} · <b style={{ color: C.text }}>{eur(fallidas.reduce((s, f) => s + Number(f.total || 0), 0))}</b>: {fallidas[0]?.error || "el banco ha rechazado el cobro"}.
            {" "}Pon otra tarjeta o {fallidas.length > 1 ? "págalas" : "págala"} por transferencia o Bizum.
          </p>
          {quedan !== null && (
            <p style={{ ...parrafo, color: t.impago?.bloqueado ? C.red : C.orange, fontWeight: 800 }}>
              {t.impago?.bloqueado
                ? "La entrada de clientes está parada hasta que se pague."
                : quedan === 1 ? "Te queda 1 cliente antes de que se pare la entrada de clientes." : "Te quedan " + quedan + " clientes antes de que se pare la entrada de clientes."}
            </p>
          )}
        </>
      )}

      <a href={t.enlace || "#"} target="_blank" rel="noreferrer" autoFocus style={boton(t.falta === "cobro_fallido" ? C.red : C.accent, t.falta === "cobro_fallido" ? "#fff" : "#000")}>
        {t.falta === "sin_tarjeta" ? "Guardar mi tarjeta" : "Poner otra tarjeta"}
      </a>
      {t.falta === "cobro_fallido" && onVerFacturas && <button onClick={onVerFacturas} style={botonSuave}>Ver mis facturas</button>}
      <button onClick={onAhoraNo} style={botonSuave}>Ahora no</button>
      <div style={nota}>
        {t.falta === "sin_tarjeta" ? "Se guarda de forma segura en Stripe. " : ""}Te lo recordaremos cada vez que entres hasta que {t.falta === "sin_tarjeta" ? "la guardes" : "lo soluciones"}.
      </div>
    </Ventana>
  );
}

// ── COMPONENTE PRINCIPAL ────────────────────────────────────
export default function ProAlEntrar({ userId, oculto = false, sinTarjeta = false, onAbierta, onIrAFacturas, onToast }: {
  userId: string;
  oculto?: boolean;                        // otra ventana encima (presentación, ficha, «¡Ya estás en marcha!», anexo de tarjeta)
  sinTarjeta?: boolean;                    // el anexo de cobro con tarjeta ya le ha ofrecido guardarla: en esta entrada no se repite
  onAbierta?: (abierta: boolean) => void;
  onIrAFacturas?: () => void;
  onToast?: (m: string) => void;
}) {
  const [listo, setListo] = useState(false);
  const [activo, setActivo] = useState<boolean | null>(null);  // profesional de pago por lead (null = no se sabe)
  const [cola, setCola] = useState<LeadPend[]>([]);              // clientes que se le piden en esta entrada
  const [inicial, setInicial] = useState(0);
  const [total, setTotal] = useState(0);                          // pendientes en total (puede haber más de los que se piden)
  const [tarjeta, setTarjeta] = useState<DatosTarjeta | null>(null);
  const [push, setPush] = useState<EstadoPush | null>(null);
  const [pushOtro, setPushOtro] = useState(false);               // los avisos llegan a otro dispositivo suyo
  const [quitados, setQuitados] = useState<{ push?: boolean; tarjeta?: boolean }>({});
  const [gracias, setGracias] = useState<number | null>(null);   // al acabar los clientes: cuántos quedan por actualizar
  const [entradaN, setEntradaN] = useState(0);                    // 1 = la primera entrada desde que se abrió la app
  const [otroVale, setOtroVale] = useState(() => lsLeer("oy_push_otro_ok_" + userId) === "1");
  const saltados = useRef<Set<string>>(new Set());
  const colaRef = useRef<LeadPend[]>([]);
  colaRef.current = cola;
  const tarjetaRef = useRef<DatosTarjeta | null>(null);
  tarjetaRef.current = tarjeta;
  // Vuelve de guardar la tarjeta en Stripe (?tarjeta=...): esta vez no se le pide (Stripe puede tardar unos segundos en avisarnos)
  const vieneDeStripe = useRef<boolean>((() => { try { return new URLSearchParams(window.location.search).has("tarjeta"); } catch { return false; } })());
  const toastRef = useRef(onToast);
  toastRef.current = onToast;

  // Devuelve cuándo están los datos de la base de datos (los avisos del dispositivo se miran a la vez, sin esperarlos)
  const mirar = useCallback((entradaNueva: boolean): Promise<void> => {
    if (entradaNueva) { setQuitados({}); setEntradaN((n) => n + 1); }
    // Avisos de este dispositivo: renovar en silencio si ya tiene permiso y ver cómo están
    const pPush = (async () => {
      try { await asegurarPush(userId); } catch { /* nada */ }
      return estadoPush(userId).catch(() => "no_compatible" as EstadoPush);
    })();
    // Clientes por actualizar y tarjeta
    const pDatos = Promise.resolve(db.rpc("oy_pro_al_entrar", { p_pro: userId })).then(
      ({ data, error }: any) => (error || !data ? null : (data as Entrada)),
      () => null,
    ).then((d: Entrada | null) => {
      if (!d) { setActivo((a) => (a === null ? true : a)); return null; }   // sin datos: solo la ventana de los avisos, como antes
      setActivo(!!d.activo);
      const antes = tarjetaRef.current;
      const ahora = d.activo ? d.tarjeta || null : null;
      if (antes?.falta && antes.falta !== "cobro_fallido" && ahora && !ahora.falta) {
        toastRef.current?.(antes.falta === "sin_tarjeta" ? "✓ Tarjeta guardada" : "✓ Tarjeta cambiada");
      }
      setTarjeta(ahora);
      // Si está contestando, no se le cambia la lista a mitad
      if (d.activo && entradaNueva && !colaRef.current.length) {
        const lista = (d.leads?.lista || []).filter((l) => !saltados.current.has(l.id));
        setCola(lista); setInicial(lista.length); setTotal(Math.max(Number(d.leads?.total || 0), lista.length));
      }
      return d;
    });
    // Con las dos cosas: ¿le llegan los avisos a otro dispositivo suyo?
    Promise.all([pPush, pDatos]).then(async ([ep, d]) => {
      let otro = false;
      if (ep !== "activado") {
        if (d) otro = !!d.push_guardado;
        else {
          const r: any = await db.from("push_subscriptions").select("id").eq("user_id", userId).maybeSingle().then((x: any) => x, () => ({ data: null }));
          otro = !!r?.data;
        }
      }
      setPushOtro(otro);
      setPush(ep);
    }).catch(() => { /* nada */ });
    return pDatos.then(() => undefined, () => undefined);
  }, [userId]);

  // Al entrar y al volver a la app
  useEffect(() => {
    let vivo = true;
    let fuera: number | null = null;
    mirar(true).finally(() => { setTimeout(() => { if (vivo) setListo(true); }, ESPERA_MS); });
    const porSiAcaso = setTimeout(() => { if (vivo) setListo(true); }, 8000);   // si la base de datos no contesta, al menos los avisos
    const alCambiar = () => {
      if (document.visibilityState === "hidden") { fuera = Date.now(); return; }
      const nueva = fuera !== null && Date.now() - fuera >= VUELTA_MIN * 60000;
      fuera = null;
      if (nueva) vieneDeStripe.current = false;
      mirar(nueva);
    };
    document.addEventListener("visibilitychange", alCambiar);
    return () => { vivo = false; clearTimeout(porSiAcaso); document.removeEventListener("visibilitychange", alCambiar); };
  }, [mirar]);

  // Qué toca enseñar ahora
  const variantePush: VariantePush | null =
    push === null || push === "activado" ? null
    : !pushOtro ? push
    : esMovil() && push === "desactivado" && !otroVale ? "otro"
    : null;   // los avisos ya llegan a otro dispositivo suyo
  // El anexo de cobro con tarjeta solo sale al abrir la app y ya ofrece guardarla: en esa primera entrada no se repite
  const pideTarjeta = activo === true && !!tarjeta?.falta && !!tarjeta?.enlace && !vieneDeStripe.current && !(sinTarjeta && entradaN <= 1);
  const paso: "cliente" | "gracias" | "avisos" | "tarjeta" | null =
    cola.length ? "cliente"
    : gracias !== null ? "gracias"
    : activo !== false && variantePush && !quitados.push ? "avisos"
    : pideTarjeta && !quitados.tarjeta ? "tarjeta"
    : null;
  const visible = listo && !oculto && paso !== null;
  useEffect(() => { onAbierta?.(visible); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  // El «¡Gracias!» se va solo a los pocos segundos
  useEffect(() => {
    if (gracias === null || !visible) return;
    const t = setTimeout(() => setGracias(null), 3500);
    return () => clearTimeout(t);
  }, [gracias, visible]);

  if (!visible) return null;

  if (paso === "gracias") {
    return (
      <Ventana titulo="Gracias" onEsc={() => setGracias(null)}>
        <div style={{ textAlign: "center", padding: "6px 2px 0" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: C.green + "22", color: C.green, fontSize: 34, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px",
          }}>✓</div>
          <h2 style={{ ...h2, textAlign: "center" }}>¡Gracias!</h2>
          <p style={{ ...parrafo, textAlign: "center", marginBottom: gracias ? 8 : 16 }}>
            Con esto vemos qué clientes te funcionan y te mandamos más como esos.
          </p>
          {!!gracias && (
            <p style={{ ...parrafo, textAlign: "center", fontSize: 13.5, color: C.muted }}>
              Te {gracias === 1 ? "queda 1 cliente" : "quedan " + gracias + " clientes"} por actualizar: te los iremos pidiendo cuando entres.
            </p>
          )}
          <button onClick={() => setGracias(null)} autoFocus style={boton(C.accent)}>Seguir</button>
        </div>
      </Ventana>
    );
  }

  if (paso === "cliente") {
    const lead = cola[0];
    const n = inicial - cola.length + 1;
    const siguiente = (saltado: boolean) => {
      if (saltado) saltados.current.add(lead.id);
      const resto = cola.slice(1);
      setCola(resto);
      if (!resto.length) setGracias(Math.max(0, total - inicial));
    };
    return <VentanaCliente key={lead.id} lead={lead} n={n} de={inicial} onHecho={() => siguiente(false)} onSaltar={() => siguiente(true)} />;
  }

  if (paso === "avisos" && variantePush) {
    return (
      <VentanaAvisos
        key={variantePush}
        userId={userId}
        variante={variantePush}
        onActivados={() => { setPush("activado"); setPushOtro(false); toastRef.current?.("✓ Avisos activados"); }}
        onAhoraNo={() => setQuitados((q) => ({ ...q, push: true }))}
        onDejarOtro={() => { lsPoner("oy_push_otro_ok_" + userId, "1"); setOtroVale(true); }}
      />
    );
  }

  if (paso === "tarjeta" && tarjeta) {
    return (
      <VentanaTarjeta
        t={tarjeta}
        onAhoraNo={() => setQuitados((q) => ({ ...q, tarjeta: true }))}
        onVerFacturas={onIrAFacturas ? () => { setQuitados((q) => ({ ...q, tarjeta: true })); onIrAFacturas(); } : undefined}
      />
    );
  }
  return null;
}
