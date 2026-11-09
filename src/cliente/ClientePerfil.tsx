// ============================================================
// OficioYa · ÁREA DEL CLIENTE — Perfil: crear el acceso (correo + contraseña),
// datos, avisos, instalar la app, ayuda y cerrar sesión.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { db } from "../supabase";
import type { Cliente } from "./clienteComun";
import { Icono, Avatar, Hoja, FN, FN_HEADERS, TEL_OY, claveTemporal, borrarClaveTemporal, lsSet, esEmailProvisional, esNombreProvisional, necesitaAcceso, emailValido, telBonito, digitos, subirArchivo, avisosActivos, avisosPosibles, appInstalada, enlaceWa, WA_OY } from "./clienteComun";

async function authHandler(body: Record<string, any>): Promise<{ success?: boolean; error?: string }> {
  try {
    const r = await fetch(FN + "/auth-handler", { method: "POST", headers: FN_HEADERS, body: JSON.stringify(body) });
    return await r.json().catch(() => ({}));
  } catch { return { error: "Error de conexión. Inténtalo de nuevo." }; }
}

// ── Tarjeta «Crea tu acceso» (para quien entró solo con su teléfono, sin correo ni contraseña) ──
// Con la clave aleatoria guardada en este móvil se elige la contraseña al momento; sin ella,
// se guarda el correo y se envía un enlace para crearla (la cuenta sigue «pendiente» hasta entonces).
async function guardarUsuario(id: string, cambios: Record<string, any>) {
  let { error } = await db.from("users").update(cambios).eq("id", id);
  if (error && "acceso_pendiente" in cambios && /acceso_pendiente/.test(error.message || "")) {
    const { acceso_pendiente, ...resto } = cambios;
    ({ error } = await db.from("users").update(resto).eq("id", id));
  }
  return error;
}
export function TarjetaAcceso({ user, onUpdate, onHecho, foco, compacta = false }: { user: Cliente; onUpdate: (u: Cliente) => void; onHecho: (tipo: "clave" | "enlace") => void; foco: number; compacta?: boolean }) {
  const temp = claveTemporal(user.id);
  const emailReal = !esEmailProvisional(user.email);
  const pideNombre = esNombreProvisional(user.name);
  const [modo, setModo] = useState<"form" | "pendiente">(user.acceso_pendiente && emailReal && !temp ? "pendiente" : "form");
  const [otroCorreo, setOtroCorreo] = useState(false);
  const pideCorreo = !emailReal || otroCorreo;
  const [nombre, setNombre] = useState(pideNombre ? "" : user.name);
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const correoRef = useRef<HTMLInputElement>(null);
  const [resaltar, setResaltar] = useState(false);

  useEffect(() => {
    if (!foco) return;
    const t = setTimeout(() => {
      caja.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setResaltar(true);
      setTimeout(() => (caja.current?.querySelector("input") as HTMLInputElement | null)?.focus({ preventScroll: true }), 450);
      setTimeout(() => setResaltar(false), 5200);
    }, 120);
    return () => clearTimeout(t);
  }, [foco]);

  const guardar = async () => {
    setErr(""); setInfo("");
    const email = pideCorreo ? correo.trim().toLowerCase() : (user.email || "").toLowerCase();
    const nom = nombre.trim().replace(/\s+/g, " ");
    if (pideNombre && nom.length < 2) { setErr("Escribe tu nombre."); return; }
    if (!emailValido(email) || esEmailProvisional(email)) { setErr("Escribe un correo válido."); return; }
    if (temp && clave.length < 6) { setErr("La contraseña debe tener al menos 6 caracteres."); return; }
    setGuardando(true);
    if (pideCorreo) {
      // Seguridad: la base de datos dice si el correo está libre (el navegador ya no puede leer otras cuentas)
      const { data: libre } = await db.rpc("oy_email_libre", { p_email: email });
      if (libre === false) { setErr("Ese correo ya tiene una cuenta en OficioYa. Si es tuya, cierra sesión y entra con él."); setGuardando(false); return; }
    }
    const cambios: Record<string, any> = {};
    if (pideCorreo) cambios.email = email;
    if (pideNombre) cambios.name = nom;

    if (temp) {
      const r = await authHandler({ action: "change_password", userId: user.id, current: temp, password: clave });
      if (!r.success) { setErr(r.error || "No se ha podido guardar la contraseña. Inténtalo de nuevo."); setGuardando(false); return; }
      // Hasta que se guarde el correo, la clave buena es la nueva (por si hay que reintentar)
      lsSet("oy_clave_temp", JSON.stringify({ id: user.id, c: clave }));
      if (Object.keys(cambios).length) {
        const e = await guardarUsuario(user.id, { ...cambios, acceso_pendiente: false });
        if (e) { setErr("Tu contraseña está guardada, pero no el correo. Pulsa otra vez para reintentarlo."); setGuardando(false); return; }
      }
      const nuevo = { ...user, ...cambios, acceso_pendiente: false };
      try { localStorage.setItem("oy_user", JSON.stringify(nuevo)); } catch { /* nada */ }
      borrarClaveTemporal();
      setGuardando(false);
      onUpdate(nuevo);
      onHecho("clave");
      return;
    }

    // Sin clave en este móvil: se guarda el correo (pendiente) y el enlace confirma que es suyo
    const anterior = { email: user.email, acceso_pendiente: !!user.acceso_pendiente };
    const e1 = await guardarUsuario(user.id, { ...cambios, acceso_pendiente: true });
    if (e1) { setErr("No se ha podido guardar el correo. Inténtalo de nuevo."); setGuardando(false); return; }
    const r = await authHandler({ action: "request_reset", email });
    if (!r.success) {
      await guardarUsuario(user.id, anterior);
      setErr(r.error || "No hemos podido enviarte el enlace. Inténtalo de nuevo en un rato.");
      setGuardando(false);
      return;
    }
    const nuevo = { ...user, ...cambios, acceso_pendiente: true };
    try { localStorage.setItem("oy_user", JSON.stringify(nuevo)); } catch { /* nada */ }
    setGuardando(false);
    setOtroCorreo(false);
    setModo("pendiente");
    onUpdate(nuevo);
    onHecho("enlace");
  };

  const reenviar = async () => {
    setErr(""); setInfo("");
    setGuardando(true);
    const r = await authHandler({ action: "request_reset", email: user.email });
    setGuardando(false);
    if (r.success) setInfo("Te lo hemos vuelto a enviar. Mira también en spam.");
    else setErr(r.error || "No hemos podido enviarlo. Inténtalo más tarde.");
  };

  const icono = (n: string) => <span style={{ width: 42, height: 42, flex: "0 0 42px", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--grad)", color: "#1A1200", boxShadow: "0 10px 22px -12px rgba(255,160,0,.8)" }}><Icono n={n} s={20} w={2.2} /></span>;

  const claseCaja = compacta ? undefined : "cy-card cy-card-oro" + (resaltar ? " cy-foco" : "");
  if (modo === "pendiente" && !otroCorreo) {
    return (
      <div id={compacta ? undefined : "cy-acceso"} ref={caja} className={claseCaja}>
        <div style={{ display: "flex", gap: 12 }}>
          {icono("correo")}
          <div style={{ minWidth: 0 }}>
            <p className="cy-h3">Revisa tu correo</p>
            <p className="cy-mini" style={{ marginTop: 3, color: "var(--soft)", overflowWrap: "anywhere" }}>Te hemos enviado un enlace a <b>{user.email}</b> para que elijas tu contraseña. Ábrelo desde este móvil; caduca en 60 minutos.</p>
          </div>
        </div>
        {err && <p className="cy-msg" style={{ marginTop: 10 }}>{err}</p>}
        {info && <p className="cy-msg cy-ok" style={{ marginTop: 10 }}>{info}</p>}
        <div className="cy-two" style={{ marginTop: 14 }}>
          <button className="cy-btn-s" disabled={guardando} onClick={reenviar}>{guardando ? "Enviando…" : "Reenviar enlace"}</button>
          <button className="cy-btn-g" onClick={() => { setOtroCorreo(true); setErr(""); setInfo(""); }}>Usar otro correo</button>
        </div>
      </div>
    );
  }

  return (
    <div id={compacta ? undefined : "cy-acceso"} ref={caja} className={claseCaja}>
      {!compacta && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {icono("candado")}
          <div style={{ minWidth: 0 }}>
            <p className="cy-h3">{pideCorreo ? "Crea tu acceso" : "Elige tu contraseña"}</p>
            <p className="cy-mini" style={{ marginTop: 3, color: "var(--soft)", overflowWrap: "anywhere" }}>
              {pideCorreo
                ? "Pon tu correo" + (temp ? " y una contraseña" : "") + " para entrar desde cualquier móvil y no perder tu solicitud ni tus presupuestos."
                : "Para entrar con tu correo " + user.email + " desde cualquier móvil."}
            </p>
          </div>
        </div>
      )}
      {compacta && !pideCorreo && <p className="cy-mini" style={{ marginBottom: 10, color: "var(--soft)", overflowWrap: "anywhere" }}>Tu correo: <b>{user.email}</b></p>}
      <div style={{ marginTop: compacta ? 0 : 14 }}>
        {pideNombre && (
          <label className="cy-fld"><span>Tu nombre</span>
            <input className="cy-inp" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" placeholder="Nombre y apellido" maxLength={60} />
          </label>
        )}
        {pideCorreo && (
          <label className="cy-fld"><span>Correo</span>
            <input ref={correoRef} className="cy-inp" type="email" inputMode="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" maxLength={120} />
          </label>
        )}
        {temp && (
          <label className="cy-fld"><span>Contraseña</span>
            <div className="cy-inp-ic">
              <input className="cy-inp" type={ver ? "text" : "password"} autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Mínimo 6 caracteres" maxLength={72} />
              <button type="button" aria-label={ver ? "Ocultar contraseña" : "Ver contraseña"} onClick={() => setVer(!ver)}><Icono n={ver ? "ojoNo" : "ojo"} s={19} /></button>
            </div>
          </label>
        )}
        {err && <p className="cy-msg" style={{ marginBottom: 8 }}>{err}</p>}
        <button className="cy-btn" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : temp ? "Guardar mi acceso" : "Enviarme el enlace"}</button>
        {!temp && <p className="cy-mini" style={{ textAlign: "center", marginTop: 8 }}>Te mandamos un enlace para que elijas tu contraseña.</p>}
        {otroCorreo && <button className="cy-link" style={{ marginTop: 6, color: "var(--ink3)" }} onClick={() => setOtroCorreo(false)}>Cancelar</button>}
      </div>
    </div>
  );
}

// ── Cambiar contraseña (cuentas con correo) ─────────────────
function CambiarClave({ userId }: { userId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [ver, setVer] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    setMsg(null);
    if (!actual) { setMsg({ ok: false, t: "Escribe tu contraseña actual." }); return; }
    if (nueva.length < 6) { setMsg({ ok: false, t: "La nueva debe tener al menos 6 caracteres." }); return; }
    setGuardando(true);
    const r = await authHandler({ action: "change_password", userId, current: actual, password: nueva });
    setGuardando(false);
    if (r.success) { setMsg({ ok: true, t: "Contraseña actualizada." }); setActual(""); setNueva(""); }
    else setMsg({ ok: false, t: r.error || "No se ha podido cambiar. Inténtalo de nuevo." });
  };
  return (
    <>
      <button className="cy-item" onClick={() => setAbierto(!abierto)}>
        <span className="ic"><Icono n="candado" s={18} /></span>
        <span style={{ flex: 1 }}>Cambiar contraseña</span>
        <Icono n="cheveron" s={18} style={{ transform: abierto ? "rotate(90deg)" : "none", transition: "transform .2s", color: "var(--ink3)" }} />
      </button>
      {abierto && (
        <div style={{ padding: "4px 16px 16px" }}>
          <label className="cy-fld"><span>Contraseña actual</span><input className="cy-inp" type={ver ? "text" : "password"} autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} /></label>
          <label className="cy-fld"><span>Nueva contraseña</span>
            <div className="cy-inp-ic">
              <input className="cy-inp" type={ver ? "text" : "password"} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Mínimo 6 caracteres" />
              <button type="button" aria-label="Ver contraseñas" onClick={() => setVer(!ver)}><Icono n={ver ? "ojoNo" : "ojo"} s={19} /></button>
            </div>
          </label>
          {msg && <p className={"cy-msg" + (msg.ok ? " cy-ok" : "")} style={{ marginBottom: 8 }}>{msg.t}</p>}
          <button className="cy-btn-s cy-full" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar contraseña"}</button>
        </div>
      )}
    </>
  );
}

// ── Pestaña Perfil ──────────────────────────────────────────
export default function ClientePerfil({ user, onUpdate, onLogout, foco, onAccesoCreado, onAvisos, avisosOn, onInstalar, onChat, onGuia, aviso }: {
  user: Cliente; onUpdate: (u: Cliente) => void; onLogout: () => void; foco: number; onAccesoCreado: (tipo: "clave" | "enlace") => void;
  onAvisos: () => void; avisosOn: boolean; onInstalar: () => void; onChat: () => void; onGuia?: () => void; aviso: (m: string) => void;
}) {
  const provisional = esEmailProvisional(user.email);
  const falta = necesitaAcceso(user);
  const [editar, setEditar] = useState<null | "nombre" | "telefono">(null);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [salir, setSalir] = useState(false);
  const [baja, setBaja] = useState<null | "pregunta" | "enviando" | "enviado">(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const guardarCampo = async () => {
    if (!editar) return;
    const v = valor.trim();
    let cambios: Record<string, any>;
    if (editar === "nombre") {
      if (v.length < 2) { aviso("Escribe tu nombre"); return; }
      cambios = { name: v };
    } else {
      const d = digitos(v).slice(-9);
      if (!/^[6789]\d{8}$/.test(d)) { aviso("Escribe un teléfono de 9 cifras"); return; }
      cambios = { phone: d, whatsapp: d };
    }
    setGuardando(true);
    const { error } = await db.from("users").update(cambios).eq("id", user.id);
    setGuardando(false);
    if (error) { aviso("No se ha podido guardar"); return; }
    const nuevo = { ...user, ...cambios };
    try { localStorage.setItem("oy_user", JSON.stringify(nuevo)); } catch { /* nada */ }
    onUpdate(nuevo);
    setEditar(null);
    aviso("Guardado");
  };

  const cambiarFoto = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { aviso("La foto es demasiado grande"); return; }
    setSubiendo(true);
    const r = await subirArchivo(f, "avatars/" + user.id);
    if (r) {
      await db.from("users").update({ avatar_url: r.url }).eq("id", user.id);
      const nuevo = { ...user, avatar_url: r.url };
      try { localStorage.setItem("oy_user", JSON.stringify(nuevo)); } catch { /* nada */ }
      onUpdate(nuevo);
    } else aviso("No se ha podido subir la foto");
    setSubiendo(false);
  };

  const pedirBaja = async () => {
    setBaja("enviando");
    try {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await db.from("users").update({ delete_token: token, delete_requested_at: new Date().toISOString() }).eq("id", user.id);
      const r = await fetch(FN + "/send-delete-email", { method: "POST", headers: FN_HEADERS, body: JSON.stringify({ email: user.email, name: user.name, token }) });
      if (!r.ok) throw new Error("x");
      setBaja("enviado");
    } catch { aviso("No se ha podido enviar el correo. Inténtalo de nuevo."); setBaja("pregunta"); }
  };

  const fila = (campo: "nombre" | "telefono", icono: string, titulo: string, valorActual: string) => (
    editar === campo ? (
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <label className="cy-fld" style={{ marginBottom: 8 }}><span>{titulo}</span>
          <input className="cy-inp" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} type={campo === "telefono" ? "tel" : "text"} inputMode={campo === "telefono" ? "tel" : "text"} maxLength={campo === "telefono" ? 16 : 60} />
        </label>
        <div className="cy-two">
          <button className="cy-btn-g cy-btn-sm" onClick={() => setEditar(null)}>Cancelar</button>
          <button className="cy-btn-s cy-btn-sm" disabled={guardando} onClick={guardarCampo}>{guardando ? "…" : "Guardar"}</button>
        </div>
      </div>
    ) : (
      <button className="cy-item" onClick={() => { setEditar(campo); setValor(campo === "telefono" ? telBonito(user.phone) : (esNombreProvisional(user.name) ? "" : user.name)); }}>
        <span className="ic"><Icono n={icono} s={18} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>{titulo}<small>{valorActual || "Añadir"}</small></span>
        <Icono n="lapiz" s={16} c="#96A0B3" />
      </button>
    )
  );

  return (
    <div className="cy-wrap" style={{ paddingTop: 18 }}>
      <div className="cy-glass cy-card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <button onClick={() => fotoRef.current?.click()} aria-label="Cambiar foto" style={{ position: "relative", background: "none", border: 0, padding: 0 }}>
          <Avatar nombre={esNombreProvisional(user.name) ? "?" : user.name} url={user.avatar_url} size={66} />
          <span style={{ position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: "50%", background: "var(--grad)", color: "#1A1200", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0F1117" }}>
            {subiendo ? <span style={{ fontSize: 11, fontWeight: 900 }}>…</span> : <Icono n="camara" s={13} w={2.4} />}
          </span>
        </button>
        <input ref={fotoRef} type="file" accept="image/*" hidden onChange={(e) => { cambiarFoto(e.target.files?.[0]); e.target.value = ""; }} />
        <div style={{ minWidth: 0 }}>
          <p className="cy-h2" style={{ overflowWrap: "anywhere" }}>{esNombreProvisional(user.name) ? "Tu perfil" : user.name}</p>
          <p className="cy-mini" style={{ marginTop: 2 }}>{user.phone ? telBonito(user.phone) : "Sin teléfono"}{!provisional ? " · " + user.email : ""}</p>
          {falta
            ? <span className="cy-pill warn" style={{ marginTop: 8 }}><Icono n="info" s={13} />{user.acceso_pendiente && !provisional ? "Falta crear tu contraseña" : "Falta crear tu acceso"}</span>
            : <span className="cy-pill ok" style={{ marginTop: 8 }}><Icono n="escudo" s={13} />Cuenta protegida</span>}
        </div>
      </div>

      {falta && <TarjetaAcceso user={user} onUpdate={onUpdate} onHecho={onAccesoCreado} foco={foco} />}

      <p className="cy-lbl">Tus datos</p>
      <div className="cy-glass cy-lista">
        {fila("nombre", "usuario", "Nombre", esNombreProvisional(user.name) ? "" : user.name)}
        {fila("telefono", "tel", "Teléfono", telBonito(user.phone))}
        {!provisional && (
          <div className="cy-item" style={{ cursor: "default" }}>
            <span className="ic"><Icono n="correo" s={18} /></span>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>Correo<small>{user.email}</small></span>
          </div>
        )}
        {!falta && <CambiarClave userId={user.id} />}
      </div>

      <p className="cy-lbl">Tu app</p>
      <div className="cy-glass cy-lista">
        {avisosPosibles() && (
          <button className="cy-item" onClick={avisosOn ? undefined : onAvisos} style={avisosOn ? { cursor: "default" } : undefined}>
            <span className="ic"><Icono n="campana" s={18} /></span>
            <span style={{ flex: 1 }}>Avisos<small>{avisosOn || avisosActivos() ? "Activados: te avisamos cuando el profesional responda" : "Te avisamos cuando el profesional responda"}</small></span>
            {avisosOn || avisosActivos() ? <span className="cy-pill ok">Activados</span> : <span className="cy-pill oro">Activar</span>}
          </button>
        )}
        <button className="cy-item" onClick={onInstalar}>
          <span className="ic"><Icono n="movil" s={18} /></span>
          <span style={{ flex: 1 }}>Descargar la app<small>{appInstalada() ? "Ya la tienes en este móvil" : "Te avisamos al momento cuando el profesional responda"}</small></span>
          <Icono n="cheveron" s={18} c="#96A0B3" />
        </button>
      </div>

      <p className="cy-lbl">Ayuda</p>
      <div className="cy-glass cy-lista">
        {onGuia && (
          <button className="cy-item" onClick={onGuia}>
            <span className="ic"><Icono n="info" s={18} /></span>
            <span style={{ flex: 1 }}>Ver la guía otra vez<small>Cómo funciona tu área, paso a paso</small></span>
            <Icono n="cheveron" s={18} c="#96A0B3" />
          </button>
        )}
        <button className="cy-item" onClick={onChat}>
          <span className="ic"><Icono n="chat" s={18} /></span>
          <span style={{ flex: 1 }}>Habla con OficioYa<small>Te responde una persona del equipo</small></span>
          <Icono n="cheveron" s={18} c="#96A0B3" />
        </button>
        <a className="cy-item" href={enlaceWa(WA_OY, "Hola, soy cliente de OficioYa y tengo una duda.")} target="_blank" rel="noopener noreferrer">
          <span className="ic"><Icono n="wa" s={18} /></span>
          <span style={{ flex: 1 }}>WhatsApp<small>{telBonito(TEL_OY)}</small></span>
          <Icono n="externo" s={16} c="#96A0B3" />
        </a>
      </div>

      <button className="cy-btn-g cy-full" style={{ marginTop: 6 }} onClick={() => (provisional ? setSalir(true) : onLogout())}><Icono n="salir" s={18} />Cerrar sesión</button>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <a className="cy-mini" href="/terminos" style={{ color: "var(--ink3)" }}>Condiciones</a>
        <span className="cy-mini"> · </span>
        <a className="cy-mini" href="/privacidad" style={{ color: "var(--ink3)" }}>Privacidad</a>
        <span className="cy-mini"> · </span>
        <a className="cy-mini" href="/cookies" style={{ color: "var(--ink3)" }}>Cookies</a>
      </div>
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <button className="cy-link" style={{ color: "#7F889A", fontWeight: 600, fontSize: 13 }} onClick={() => setBaja("pregunta")}>Eliminar mi cuenta</button>
      </div>

      {salir && (
        <Hoja titulo="¿Cerrar sesión?" onClose={() => setSalir(false)}>
          <p className="cy-sub">Todavía no has creado tu acceso. Si cierras sesión <b style={{ color: "var(--ink)" }}>no podrás volver a entrar</b> a tu área ni ver tus presupuestos.</p>
          <button className="cy-btn" style={{ marginTop: 18 }} onClick={() => { setSalir(false); setTimeout(() => document.getElementById("cy-acceso")?.scrollIntoView({ behavior: "smooth", block: "center" }), 150); }}>Crear mi acceso</button>
          <button className="cy-btn-g cy-full" style={{ marginTop: 10 }} onClick={() => { setSalir(false); onLogout(); }}>Cerrar sesión igualmente</button>
        </Hoja>
      )}
      {baja && (
        <Hoja titulo="Eliminar tu cuenta" onClose={() => setBaja(null)}>
          {provisional ? (
            <>
              <p className="cy-sub">Escríbenos y la eliminamos en menos de 24 horas.</p>
              <button className="cy-btn-g cy-full" style={{ marginTop: 16 }} onClick={() => { setBaja(null); onChat(); }}><Icono n="chat" s={18} />Escribir a OficioYa</button>
            </>
          ) : baja === "enviado" ? (
            <p className="cy-sub">Te hemos enviado un correo a <b style={{ color: "var(--ink)" }}>{user.email}</b>. Confírmalo desde ahí y eliminaremos tu cuenta.</p>
          ) : (
            <>
              <p className="cy-sub">Te enviaremos un correo a <b style={{ color: "var(--ink)" }}>{user.email}</b> para confirmarlo. Al confirmar perderás tu área, tus solicitudes y tus presupuestos.</p>
              <button className="cy-btn-g cy-full" style={{ marginTop: 16, borderColor: "rgba(255,173,138,.5)", color: "var(--coral)" }} disabled={baja === "enviando"} onClick={pedirBaja}>{baja === "enviando" ? "Enviando…" : "Enviarme el correo de confirmación"}</button>
            </>
          )}
        </Hoja>
      )}
    </div>
  );
}
