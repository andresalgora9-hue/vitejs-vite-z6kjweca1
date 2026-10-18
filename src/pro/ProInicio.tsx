// ============================================================
// OficioYa · Panel PROFESIONAL — pestaña INICIO
// Clientes esperando llamada, trabajos en curso y avisos push.
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import { db } from "../supabase";
import {
  C, F, Card, Boton, Etiqueta, Titulo, LeadRow, CANAL_LABEL,
  eurCorto, haceCuanto, enlaceTel, enlaceWhatsApp, digitos,
  EstadoPush, estadoPush, activarPush, desactivarPush, probarPush,
} from "./proComun";

const TEXTO_PUSH: Record<EstadoPush, { titulo: string; detalle: string; color: string }> = {
  activado: { titulo: "Avisos activados", detalle: "Te avisamos al momento cuando entra un cliente, aunque tengas el móvil bloqueado.", color: C.green },
  desactivado: { titulo: "Avisos desactivados", detalle: "Actívalos para enterarte al momento de cada cliente nuevo.", color: C.orange },
  bloqueado: { titulo: "Avisos bloqueados", detalle: "Has bloqueado los avisos de OficioYa. Actívalos en los ajustes del navegador (icono del candado junto a la dirección) y vuelve aquí.", color: C.red },
  no_compatible: { titulo: "Avisos no disponibles", detalle: "Este navegador no permite avisos. Abre OficioYa en Chrome (Android) o instálala en la pantalla de inicio (iPhone).", color: C.muted },
  instalar_ios: { titulo: "Instala OficioYa para recibir avisos", detalle: "En iPhone: pulsa Compartir y \"Añadir a pantalla de inicio\". Abre OficioYa desde ese icono y activa los avisos aquí.", color: C.orange },
};

function TarjetaPush({ userId, onToast }: { userId: string; onToast?: (m: string) => void }) {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [info, setInfo] = useState(false);

  useEffect(() => { estadoPush(userId).then(setEstado).catch(() => setEstado("no_compatible")); }, [userId]);

  const cambiar = async () => {
    if (!estado || ocupado) return;
    setOcupado(true);
    try {
      const nuevo = estado === "activado" ? await desactivarPush(userId) : await activarPush(userId);
      setEstado(nuevo);
      if (nuevo === "activado") onToast?.("Avisos activados");
      else if (estado === "activado") onToast?.("Avisos desactivados");
    } catch {
      onToast?.("No se han podido cambiar los avisos. Inténtalo de nuevo.");
    }
    setOcupado(false);
  };

  const probar = async () => {
    setOcupado(true);
    const ok = await probarPush(userId);
    setOcupado(false);
    onToast?.(ok ? "Aviso de prueba enviado" : "No se ha podido enviar. Apaga y enciende los avisos.");
  };

  if (!estado) return null;
  const t = TEXTO_PUSH[estado];
  const encendido = estado === "activado";
  const sePuede = estado === "activado" || estado === "desactivado";

  return (
    <Card accent={t.color + "66"}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
            <span style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{t.titulo}</span>
            <button onClick={() => setInfo(!info)} aria-label="Información sobre los avisos" style={{
              width: 20, height: 20, borderRadius: "50%", border: "1px solid " + C.mutedL, background: "transparent",
              color: C.mutedL, fontSize: 11, fontWeight: 800, cursor: "pointer", lineHeight: "17px", padding: 0, flexShrink: 0,
            }}>i</button>
          </div>
          <div style={{ color: C.mutedL, fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>{t.detalle}</div>
        </div>
        {sePuede && (
          <button onClick={cambiar} disabled={ocupado} role="switch" aria-checked={encendido} aria-label="Activar o desactivar avisos" style={{
            width: 54, height: 30, borderRadius: 99, border: "none", cursor: ocupado ? "wait" : "pointer",
            background: encendido ? C.green : C.border, position: "relative", flexShrink: 0, transition: "background .2s",
          }}>
            <span style={{
              position: "absolute", top: 3, left: encendido ? 27 : 3, width: 24, height: 24, borderRadius: "50%",
              background: "#fff", transition: "left .2s",
            }} />
          </button>
        )}
      </div>

      {info && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: C.bg, borderRadius: 9, border: "1px solid " + C.border, fontSize: 12.5, color: C.mutedL, lineHeight: 1.5 }}>
          <b style={{ color: C.text }}>¿No te llegan los avisos?</b> Apágalos con el interruptor y vuelve a encenderlos.
          Así se renueva la conexión con tu móvil. Si cambias de móvil o borras los datos del navegador, hay que volver a activarlos.
          {encendido && (
            <div style={{ marginTop: 10, display: "flex" }}>
              <Boton small outline color={C.green} onClick={probar} disabled={ocupado}>Enviarme un aviso de prueba</Boton>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ProInicio({ user, onIrALeads, onToast }: {
  user: { id: string; name: string; trade?: string | null; zone?: string | null };
  onIrALeads: () => void;
  onToast?: (m: string) => void;
}) {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const toastRef = useRef(onToast);
  useEffect(() => { toastRef.current = onToast; }, [onToast]);

  const cargar = useCallback(async () => {
    const { data } = await db
      .from("pro_leads")
      .select("id,created_at,trade,canal,estado,estado_at,presupuesto_eur,client_name,client_phone,zona,descripcion,price,anulado,invoice_id,primer_contacto_at,llamada_segundos")
      .eq("pro_id", user.id)
      .eq("anulado", false)
      .order("created_at", { ascending: false });
    setLeads((data || []) as LeadRow[]);
    setCargando(false);
  }, [user.id]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const canal = db
      .channel("inicio_leads_" + user.id)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "pro_leads", filter: "pro_id=eq." + user.id }, (p: any) => {
        if (p?.eventType === "INSERT") toastRef.current?.("Te ha entrado un cliente nuevo");
        cargar();
      })
      .subscribe();
    const alVolver = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    const reloj = setInterval(cargar, 60000);
    return () => {
      db.removeChannel(canal);
      document.removeEventListener("visibilitychange", alVolver);
      clearInterval(reloj);
    };
  }, [user.id, cargar]);

  const esperando = leads.filter((l) => l.estado === "nuevo").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const enCurso = leads.filter((l) => l.estado === "contactado" || l.estado === "presupuesto");
  const mesActual = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }).slice(0, 7);
  const delMes = leads.filter((l) => new Date(l.created_at).toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }).slice(0, 7) === mesActual);
  const ganadosMes = delMes.filter((l) => l.estado === "ganado");
  const nombre = (user.name || "").split(" ")[0];

  return (
    <div style={{ fontFamily: F, paddingBottom: 24 }}>
      <div style={{ padding: "22px 0 12px" }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: C.text, margin: 0 }}>Hola{nombre ? ", " + nombre : ""}</h2>
        <div style={{ fontSize: 13, color: C.mutedL, marginTop: 4 }}>
          {cargando ? "Cargando..." : esperando.length === 0
            ? "No tienes clientes esperando tu llamada."
            : esperando.length === 1 ? "Tienes 1 cliente esperando tu llamada." : "Tienes " + esperando.length + " clientes esperando tu llamada."}
        </div>
      </div>

      <TarjetaPush userId={user.id} onToast={onToast} />

      {/* Esperando llamada */}
      <Titulo>Esperando tu llamada</Titulo>
      {!cargando && esperando.length === 0 && (
        <Card><div style={{ color: C.mutedL, fontSize: 13.5 }}>Todo al día. Cuando entre un cliente te aparecerá aquí.</div></Card>
      )}
      {esperando.map((l) => {
        const tel = digitos(l.client_phone) ? l.client_phone : null;
        return (
          <Card key={l.id} accent={C.accent}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Etiqueta texto={CANAL_LABEL[l.canal]} color={C.mutedL} />
              <span style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>Esperando {haceCuanto(l.created_at).replace("hace ", "")}</span>
            </div>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>
              {l.client_name || (l.canal === "llamada" ? "Llamada · faltan datos" : "Cliente sin nombre")}
            </div>
            {(l.zona || l.descripcion) && (
              <div style={{ color: C.mutedL, fontSize: 13, marginTop: 3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                {[l.zona, l.descripcion].filter(Boolean).join(" · ")}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {tel ? (
                <>
                  <Boton href={enlaceTel(tel)} color={C.green}>Llamar</Boton>
                  <Boton href={enlaceWhatsApp(tel)} color={C.green} outline>WhatsApp</Boton>
                </>
              ) : (
                <Boton onClick={onIrALeads} color={C.orange} outline>Completar datos</Boton>
              )}
              <Boton onClick={onIrALeads} color={C.mutedL} outline>Ficha</Boton>
            </div>
          </Card>
        );
      })}

      {/* En curso */}
      <Titulo>Trabajos en curso</Titulo>
      {enCurso.length === 0 ? (
        <Card><div style={{ color: C.mutedL, fontSize: 13.5 }}>No tienes trabajos en curso.</div></Card>
      ) : enCurso.map((l) => (
        <button key={l.id} onClick={onIrALeads} style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", fontFamily: F,
          background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer",
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", color: C.text, fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {l.client_name || "Cliente"}{l.zona ? " · " + l.zona : ""}
            </span>
            <span style={{ display: "block", color: C.mutedL, fontSize: 12.5, marginTop: 2 }}>
              {l.estado === "presupuesto"
                ? "Presupuesto enviado" + (l.presupuesto_eur ? " · " + eurCorto(l.presupuesto_eur) : "")
                : "Contactado"} · {haceCuanto(l.estado_at)}
            </span>
          </span>
          <Etiqueta texto={l.estado === "presupuesto" ? "Presupuesto" : "Contactado"} color={l.estado === "presupuesto" ? C.orange : C.blue} />
        </button>
      ))}

      {/* Este mes */}
      <Titulo>Este mes</Titulo>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{delMes.length}</div>
          <div style={{ fontSize: 12, color: C.mutedL }}>Clientes recibidos</div>
        </Card>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{ganadosMes.length}</div>
          <div style={{ fontSize: 12, color: C.mutedL }}>
            Trabajos ganados{ganadosMes.length ? " · " + eurCorto(ganadosMes.reduce((s, l) => s + Number(l.presupuesto_eur || 0), 0)) : ""}
          </div>
        </Card>
      </div>
      <div style={{ marginTop: 12, display: "flex" }}>
        <Boton onClick={onIrALeads} outline color={C.accent}>Ver todos mis leads</Boton>
      </div>
    </div>
  );
}
