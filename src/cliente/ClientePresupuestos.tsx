// ============================================================
// OficioYa · ÁREA DEL CLIENTE — Presupuestos: el cliente apunta los que le dan
// (de OficioYa o de fuera), los compara y ve si son buen precio.
// ============================================================
import React, { useMemo, useRef, useState } from "react";
import type { Cliente, Presupuesto } from "./clienteComun";
import { Icono, Hoja, Vacio, Esqueleto, REF, leerRef, claveRef, veredicto, eur, eurRango, miles, parseImporte, fechaDia, diasHasta, hoyISO, nombreOficio, iconoOficio, enlaceTel, enlaceWa, telBonito, subirArchivo, OFICIOS_Q } from "./clienteComun";
import { guardarPresupuesto, borrarPresupuesto, claveOficio, type Ciudad } from "./datos";

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const ESTADOS: [Presupuesto["estado"], string][] = [["pendiente", "Pendiente"], ["aceptado", "Aceptado"], ["descartado", "Descartado"]];

interface Grupo { clave: string; trabajo: string; oficio: string | null; items: Presupuesto[]; ref: ReturnType<typeof leerRef> }
function agrupar(lista: Presupuesto[]): Grupo[] {
  const m = new Map<string, Grupo>();
  lista.forEach((p) => {
    const k = norm(p.trabajo);
    if (!m.has(k)) m.set(k, { clave: k, trabajo: p.trabajo, oficio: p.oficio, items: [], ref: null });
    const g = m.get(k)!;
    g.items.push(p);
    if (!g.oficio && p.oficio) g.oficio = p.oficio;
    if (!g.ref && p.tipo) g.ref = leerRef(p.tipo);
  });
  const peso = (p: Presupuesto) => (p.estado === "aceptado" ? 0 : p.estado === "pendiente" ? 1 : 2);
  m.forEach((g) => g.items.sort((a, b) => peso(a) - peso(b) || (a.importe ?? 1e12) - (b.importe ?? 1e12)));
  return Array.from(m.values()).sort((a, b) => Math.max(...b.items.map((x) => +new Date(x.created_at))) - Math.max(...a.items.map((x) => +new Date(x.created_at))));
}

function caducidad(p: Presupuesto) {
  if (!p.valido_hasta || p.estado !== "pendiente") return null;
  const d = diasHasta(p.valido_hasta);
  if (d < 0) return { txt: "Caducado", warn: true };
  if (d === 0) return { txt: "Caduca hoy", warn: true };
  if (d <= 3) return { txt: "Caduca en " + d + (d === 1 ? " día" : " días"), warn: true };
  return { txt: "Válido hasta el " + fechaDia(p.valido_hasta), warn: false };
}

// ── Barra con el precio habitual y dónde cae cada presupuesto ──
export function RangoPrecios({ rango, marcas }: { rango: [number, number]; marcas: { etiqueta: string; importe: number }[] }) {
  const [a, b] = rango;
  const min = Math.min(a * 0.7, ...marcas.map((m) => m.importe));
  const max = Math.max(b * 1.35, ...marcas.map((m) => m.importe));
  const pos = (v: number) => Math.min(98, Math.max(2, ((v - min) / (max - min)) * 100));
  return (
    <div className="cy-rango" aria-hidden="true" style={{ background: `linear-gradient(90deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.08) ${pos(a)}%, rgba(0,214,143,.55) ${pos(a)}%, rgba(0,214,143,.55) ${pos(b)}%, rgba(255,173,138,.5) ${pos(b)}%, rgba(255,173,138,.5) 100%)` }}>
      <span className="cy-rango-e" style={{ left: pos(a) + "%", transform: "translateX(-50%)" }}>{miles(a)} €</span>
      <span className="cy-rango-e" style={{ left: pos(b) + "%", transform: "translateX(-50%)" }}>{miles(b)} €</span>
      {marcas.slice(0, 4).map((m, i) => (
        <span key={i} className="cy-rango-m" style={{ left: pos(m.importe) + "%", zIndex: 2 + i }}><span style={i % 2 ? { bottom: "auto", top: 22 } : undefined}>{m.etiqueta}</span></span>
      ))}
    </div>
  );
}

// ── Pestaña Presupuestos ────────────────────────────────────
export default function ClientePresupuestos({ presus, error, ciudades, oficiosPedidos, onNuevo, onEditar, onPedirOtra }: {
  presus: Presupuesto[] | null; error: boolean; ciudades: Record<string, Ciudad[]>; oficiosPedidos: Set<string>;
  onNuevo: (p?: Partial<Presupuesto>) => void; onEditar: (p: Presupuesto) => void; onPedirOtra: (g: { trabajo: string; oficio: string | null; tipo: string | null }) => void;
}) {
  const grupos = useMemo(() => agrupar(presus || []), [presus]);
  const ahorro = grupos.reduce((t, g) => {
    const vals = g.items.filter((p) => p.estado !== "descartado" && p.importe != null).map((p) => Number(p.importe));
    return vals.length >= 2 ? t + (Math.max(...vals) - Math.min(...vals)) : t;
  }, 0);
  const atendido = (oficio: string | null) => !!(oficio && (ciudades[claveOficio(oficio)] || []).length);
  // «Otra opinión» solo tiene sentido si aún no se lo ha pedido a OficioYa (hay un profesional por oficio y ciudad)
  const puedeOtra = (g: Grupo) => atendido(g.oficio) && !g.items.some((p) => p.origen === "oficioya") && !oficiosPedidos.has((g.oficio || "").trim().toLowerCase());

  return (
    <div className="cy-wrap" style={{ paddingTop: 18 }}>
      <p className="cy-eyebrow">Tus presupuestos</p>
      <h1 className="cy-h1" style={{ fontSize: 30, marginTop: 6 }}>Compara y <span>acierta</span></h1>
      <p className="cy-sub" style={{ marginTop: 8 }}>Apunta todos los que te den, de OficioYa o de fuera, y mira de un vistazo cuál te conviene.</p>
      <button className="cy-btn" style={{ marginTop: 16, marginBottom: 18 }} onClick={() => onNuevo()}><Icono n="mas" s={18} w={2.6} />Apuntar un presupuesto</button>

      {error && (
        <div className="cy-glass cy-card"><Vacio icono="info" titulo="No hemos podido cargar tus presupuestos" texto="Vuelve a intentarlo en un rato. Si sigue igual, escríbenos." /></div>
      )}
      {!error && presus === null && <Esqueleto alto={200} n={2} />}
      {!error && presus && presus.length === 0 && (
        <div className="cy-glass cy-card">
          <p className="cy-h3" style={{ marginBottom: 12 }}>Tu carpeta de presupuestos</p>
          {[
            ["archivo", "Todos en un sitio", "Haz una foto al papel o sube el PDF. Se acabó buscar en WhatsApp."],
            ["euro", "Sabrás si es buen precio", "Lo comparamos con lo que se suele cobrar en tu ciudad."],
            ["reloj", "Que no se te pase", "Ves de un vistazo cuándo caduca cada uno."],
          ].map(([ic, t, d]) => (
            <div key={t} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <span style={{ width: 36, height: 36, flex: "0 0 36px", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,200,0,.1)", border: "1px solid rgba(255,200,0,.3)", color: "var(--gold)" }}><Icono n={ic} s={18} /></span>
              <div><p style={{ fontWeight: 800, fontSize: 14.5 }}>{t}</p><p className="cy-mini">{d}</p></div>
            </div>
          ))}
        </div>
      )}

      {grupos.length > 0 && (
        <div className="cy-row" style={{ marginBottom: 14 }}>
          <span className="cy-pill">{(presus || []).length} {(presus || []).length === 1 ? "presupuesto" : "presupuestos"}</span>
          <span className="cy-pill">{grupos.length} {grupos.length === 1 ? "trabajo" : "trabajos"}</span>
          {ahorro > 0 && <span className="cy-pill ok">Diferencia entre ofertas: {eur(ahorro)}</span>}
        </div>
      )}

      {grupos.map((g) => {
        const vivos = g.items.filter((p) => p.estado !== "descartado" && p.importe != null);
        const minimo = vivos.length >= 2 ? Math.min(...vivos.map((p) => Number(p.importe))) : null;
        const aceptado = g.items.find((p) => p.estado === "aceptado");
        return (
          <div key={g.clave} className="cy-glass cy-card cy-entra">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ width: 42, height: 42, flex: "0 0 42px", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.07)", color: "var(--gold)" }}><Icono n={iconoOficio(g.oficio)} s={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="cy-h3" style={{ overflowWrap: "anywhere" }}>{g.trabajo}</p>
                <p className="cy-mini">{g.oficio ? nombreOficio(g.oficio) + " · " : ""}{g.items.length} {g.items.length === 1 ? "presupuesto" : "presupuestos"}{aceptado ? " · elegido: " + aceptado.empresa : ""}</p>
              </div>
            </div>

            {g.ref && vivos.length > 0 && (
              <div style={{ marginTop: 14, padding: "12px 12px 4px", borderRadius: 16, background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)" }}>
                <div className="cy-between"><span className="cy-mini">Lo habitual: <b style={{ color: "var(--ink)" }}>{eurRango(g.ref.rango)}</b></span><span className="cy-mini">{g.ref.titulo} · {g.ref.tam}</span></div>
                <RangoPrecios rango={g.ref.rango} marcas={vivos.map((p) => ({ etiqueta: (p.empresa || "").split(/\s+/)[0].slice(0, 10), importe: Number(p.importe) }))} />
              </div>
            )}

            <div className="cy-col" style={{ marginTop: 12, gap: 8 }}>
              {g.items.map((p) => {
                const cad = caducidad(p);
                const v = g.ref && p.importe != null ? veredicto(Number(p.importe), g.ref.rango) : null;
                const masBarato = minimo != null && p.importe != null && Number(p.importe) === minimo && p.estado !== "descartado";
                return (
                  <button key={p.id} onClick={() => onEditar(p)} style={{ display: "block", width: "100%", textAlign: "left", padding: 14, borderRadius: 16, background: p.estado === "aceptado" ? "rgba(0,214,143,.08)" : "rgba(255,255,255,.04)", border: "1px solid " + (p.estado === "aceptado" ? "rgba(0,214,143,.4)" : "rgba(255,255,255,.1)"), opacity: p.estado === "descartado" ? 0.55 : 1, color: "var(--ink)" }}>
                    <div className="cy-between" style={{ alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 800, fontSize: 15, overflowWrap: "anywhere", textDecoration: p.estado === "descartado" ? "line-through" : "none" }}>{p.empresa}</p>
                        <p className="cy-mini" style={{ marginTop: 2 }}>
                          {p.origen === "oficioya" ? "De OficioYa · " : ""}Recibido el {fechaDia(p.fecha)}
                          {p.archivo_url ? " · 📎" : ""}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                        <p style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-.02em", color: "#FFD200", fontVariantNumeric: "tabular-nums" }}>{p.importe != null ? eur(Number(p.importe)) : "—"}</p>
                        {p.iva === "aparte" && <p className="cy-mini">+ IVA</p>}
                      </div>
                    </div>
                    <div className="cy-row" style={{ marginTop: 8, gap: 6 }}>
                      {p.estado === "aceptado" && <span className="cy-pill ok"><Icono n="check" s={13} w={3} />Elegido</span>}
                      {p.estado === "descartado" && <span className="cy-pill">Descartado</span>}
                      {masBarato && <span className="cy-pill oro">El más barato</span>}
                      {v && p.estado !== "descartado" && <span className={"cy-pill " + (v.nivel === "justo" ? "ok" : v.nivel === "bajo" ? "" : "warn")}>{v.txt}</span>}
                      {cad && <span className={"cy-pill " + (cad.warn ? "warn" : "")}><Icono n="reloj" s={13} />{cad.txt}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="cy-row" style={{ marginTop: 12 }}>
              <button className="cy-btn-g cy-btn-sm" onClick={() => onNuevo({ trabajo: g.trabajo, oficio: g.oficio, tipo: g.items.find((x) => x.tipo)?.tipo || null })}><Icono n="mas" s={16} w={2.6} />Añadir otro</button>
              {!aceptado && puedeOtra(g) && (
                <button className="cy-btn-s cy-btn-sm" onClick={() => onPedirOtra({ trabajo: g.trabajo, oficio: g.oficio, tipo: g.items.find((x) => x.tipo)?.tipo || null })}><Icono n="chispa" s={16} />Otra opinión gratis</button>
              )}
            </div>
          </div>
        );
      })}

      {grupos.length > 0 && (
        <p className="cy-mini" style={{ textAlign: "center", margin: "6px 12px 0" }}>Se guardan en tu cuenta para que los tengas siempre a mano.</p>
      )}
    </div>
  );
}

// ── Hoja para apuntar o editar un presupuesto ───────────────
export function PresupuestoHoja({ user, inicial, trabajos, onClose, onGuardado, onBorrado, aviso }: {
  user: Cliente; inicial: Partial<Presupuesto>; trabajos: string[]; onClose: () => void;
  onGuardado: (p: Presupuesto) => void; onBorrado: (id: string) => void; aviso: (m: string) => void;
}) {
  const editando = !!inicial.id;
  const [trabajo, setTrabajo] = useState(inicial.trabajo || "");
  const [oficio, setOficio] = useState<string>(inicial.oficio || "");
  const [empresa, setEmpresa] = useState(inicial.empresa || "");
  const [importe, setImporte] = useState(inicial.importe != null ? String(Math.round(Number(inicial.importe) * 100) / 100).replace(".", ",") : "");
  const [iva, setIva] = useState<Presupuesto["iva"]>(inicial.iva || "incluido");
  const [fecha, setFecha] = useState(inicial.fecha || hoyISO());
  const [validoHasta, setValidoHasta] = useState(inicial.valido_hasta || "");
  const [telefono, setTelefono] = useState(inicial.telefono ? telBonito(inicial.telefono) : "");
  const [incluye, setIncluye] = useState(inicial.incluye || "");
  const [notas, setNotas] = useState(inicial.notas || "");
  const [estado, setEstado] = useState<Presupuesto["estado"]>(inicial.estado || "pendiente");
  const [archivo, setArchivo] = useState<{ url: string; tipo: string } | null>(inicial.archivo_url ? { url: inicial.archivo_url, tipo: inicial.archivo_tipo || "" } : null);
  const [subiendo, setSubiendo] = useState(false);
  const refValida = leerRef(inicial.tipo);
  const refIni = refValida && (inicial.oficio || "").toLowerCase().startsWith(refValida.sel.grupo === "pintura" ? "pint" : "fontan") ? inicial.tipo!.split(".") : null;
  const [refTipo, setRefTipo] = useState<string>(refIni ? refIni[1] : "");
  const [refTam, setRefTam] = useState<string>(refIni ? refIni[2] : "");
  const [mas, setMas] = useState(editando && !!(inicial.incluye || inicial.notas || inicial.valido_hasta || inicial.telefono));
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const grupoRef: "pintura" | "fontaneria" | null = oficio.toLowerCase().startsWith("pint") ? "pintura" : oficio.toLowerCase().startsWith("fontan") ? "fontaneria" : null;
  const refSel = grupoRef && refTipo && refTam ? claveRef({ grupo: grupoRef, tipo: refTipo, tam: refTam }) : null;
  const ref = leerRef(refSel);
  const num = parseImporte(importe);
  const v = ref && !isNaN(num) && num > 0 ? veredicto(num, ref.rango) : null;
  const sugerencias = trabajos.filter((t) => norm(t) !== norm(trabajo)).slice(0, 4);

  const elegirArchivo = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { aviso("El archivo es demasiado grande (máximo 15 MB)"); return; }
    setSubiendo(true);
    const r = await subirArchivo(f, "presupuestos/" + user.id);
    setSubiendo(false);
    if (!r) { aviso("No se ha podido subir. Inténtalo de nuevo."); return; }
    setArchivo(r);
  };

  const guardar = async () => {
    setErr("");
    if (trabajo.trim().length < 2) { setErr("Escribe para qué trabajo es (ej: Pintar el salón)."); return; }
    if (empresa.trim().length < 2) { setErr("Escribe quién te lo ha dado."); return; }
    if (importe.trim() && (isNaN(num) || num < 0)) { setErr("El importe no es válido."); return; }
    if (!importe.trim() && !archivo) { setErr("Pon el importe o adjunta el presupuesto."); return; }
    setGuardando(true);
    try {
      const p = await guardarPresupuesto({
        id: inicial.id, client_id: user.id, trabajo: trabajo.trim().slice(0, 120), oficio: oficio || null, tipo: refSel,
        empresa: empresa.trim().slice(0, 120), telefono: telefono.trim() || null, importe: importe.trim() ? Math.round(num * 100) / 100 : null,
        iva, fecha: fecha || hoyISO(), valido_hasta: validoHasta || null, incluye: incluye.trim() || null, notas: notas.trim() || null,
        estado, archivo_url: archivo?.url || null, archivo_tipo: archivo?.tipo || null,
        origen: inicial.origen || "manual", budget_request_id: inicial.budget_request_id || null,
      });
      onGuardado(p);
      onClose();
    } catch {
      setErr("No se ha podido guardar. Revisa tu conexión e inténtalo de nuevo.");
    }
    setGuardando(false);
  };

  const borrar = async () => {
    if (!inicial.id) return;
    setGuardando(true);
    try { await borrarPresupuesto(inicial.id); onBorrado(inicial.id); onClose(); }
    catch { setErr("No se ha podido borrar. Inténtalo de nuevo."); setGuardando(false); }
  };

  return (
    <Hoja titulo={editando ? "Tu presupuesto" : "Apuntar presupuesto"} onClose={onClose} pie={
      <>
        {err && <p className="cy-msg" style={{ marginTop: 0, marginBottom: 8 }}>{err}</p>}
        <button className="cy-btn" disabled={guardando || subiendo} onClick={guardar}>{guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar presupuesto"}</button>
      </>
    }>
      {editando && telefono && (
        <div className="cy-two" style={{ marginBottom: 10 }}>
          <a className="cy-btn-g" href={enlaceTel(telefono)}><Icono n="tel" s={17} />Llamar</a>
          <a className="cy-btn-g" href={enlaceWa(telefono)} target="_blank" rel="noopener noreferrer"><Icono n="wa" s={17} />WhatsApp</a>
        </div>
      )}

      <label className="cy-fld">
        <span>¿Para qué trabajo es?</span>
        <input className="cy-inp" value={trabajo} onChange={(e) => setTrabajo(e.target.value)} placeholder="Ej: Pintar el piso" maxLength={120} />
      </label>
      {sugerencias.length > 0 && !editando && (
        <div className="cy-row" style={{ marginTop: -4, marginBottom: 12 }}>
          {sugerencias.map((t) => <button key={t} className="cy-chip" style={{ minHeight: 36, fontSize: 13 }} onClick={() => setTrabajo(t)}>{t}</button>)}
        </div>
      )}

      <p className="cy-q" style={{ marginTop: 4 }}>Oficio</p>
      <div className="cy-row" style={{ marginBottom: 12 }}>
        {OFICIOS_Q.map((o) => <button key={o} className="cy-chip" aria-pressed={oficio === o} onClick={() => { setOficio(oficio === o ? "" : o); setRefTipo(""); setRefTam(""); }}>{nombreOficio(o)}</button>)}
      </div>

      <label className="cy-fld">
        <span>¿Quién te lo ha dado?</span>
        <input className="cy-inp" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nombre del profesional o empresa" maxLength={120} />
      </label>

      <div className="cy-two">
        <label className="cy-fld">
          <span>Importe (€)</span>
          <input className="cy-inp" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="Ej: 950" style={{ fontSize: 20, fontWeight: 800 }} />
        </label>
        <label className="cy-fld">
          <span>Fecha</span>
          <input className="cy-inp" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
        </label>
      </div>
      <div className="cy-seg" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", marginBottom: 12 }}>
        {([["incluido", "IVA incluido"], ["aparte", "+ IVA"], ["no_se", "No lo sé"]] as const).map(([k, t]) => <button key={k} aria-pressed={iva === k} onClick={() => setIva(k)}>{t}</button>)}
      </div>

      {grupoRef && (
        <div style={{ padding: 14, borderRadius: 18, background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.09)", marginBottom: 12 }}>
          <p style={{ fontWeight: 800, fontSize: 14 }}><Icono n="chispa" s={16} c="#FFD700" style={{ verticalAlign: "-3px", marginRight: 6 }} />¿Es buen precio?</p>
          <p className="cy-mini" style={{ marginTop: 2 }}>Dinos qué es y lo comparamos con lo habitual.</p>
          <div className="cy-row" style={{ marginTop: 10 }}>
            {Object.entries(REF[grupoRef].tipos).map(([k, t]) => <button key={k} className="cy-chip" style={{ minHeight: 38, fontSize: 13 }} aria-pressed={refTipo === k} onClick={() => { setRefTipo(k); setRefTam(""); }}>{t.titulo}</button>)}
          </div>
          {refTipo && REF[grupoRef].tipos[refTipo] && (
            <div className="cy-row" style={{ marginTop: 8 }}>
              {REF[grupoRef].tipos[refTipo].tamanos.map((x) => <button key={x.k} className="cy-chip" style={{ minHeight: 38, fontSize: 13 }} aria-pressed={refTam === x.k} onClick={() => setRefTam(x.k)}>{x.t}</button>)}
            </div>
          )}
          {ref && (
            <div style={{ marginTop: 12 }}>
              <p className="cy-mini">Lo habitual: <b style={{ color: "var(--ink)" }}>{eurRango(ref.rango)}</b></p>
              {v && (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 14, background: v.nivel === "justo" ? "rgba(0,214,143,.1)" : v.nivel === "bajo" ? "rgba(255,255,255,.05)" : "rgba(255,173,138,.1)", border: "1px solid " + (v.nivel === "justo" ? "rgba(0,214,143,.35)" : v.nivel === "bajo" ? "rgba(255,255,255,.14)" : "rgba(255,173,138,.4)") }}>
                  <p style={{ fontWeight: 800, fontSize: 14, color: v.nivel === "justo" ? "var(--mint)" : v.nivel === "bajo" ? "var(--ink)" : "var(--coral)" }}>{v.txt}</p>
                  <p className="cy-mini" style={{ marginTop: 2 }}>{v.detalle}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="cy-q">Foto o PDF del presupuesto</p>
      {archivo ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", marginBottom: 12 }}>
          {archivo.tipo.includes("pdf")
            ? <span style={{ width: 54, height: 54, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,200,0,.1)", color: "var(--gold)" }}><Icono n="archivo" s={26} /></span>
            : <img src={archivo.url} alt="Presupuesto" style={{ width: 54, height: 54, borderRadius: 12, objectFit: "cover" }} />}
          <a className="cy-link" href={archivo.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>Ver {archivo.tipo.includes("pdf") ? "PDF" : "foto"} <Icono n="externo" s={14} /></a>
          <button className="cy-x" aria-label="Quitar archivo" onClick={() => setArchivo(null)}><Icono n="x" s={16} /></button>
        </div>
      ) : (
        <div className="cy-two" style={{ marginBottom: 12 }}>
          <button className="cy-btn-g" disabled={subiendo} onClick={() => fotoRef.current?.click()}><Icono n="camara" s={18} />{subiendo ? "Subiendo…" : "Hacer foto"}</button>
          <button className="cy-btn-g" disabled={subiendo} onClick={() => fileRef.current?.click()}><Icono n="archivo" s={18} />Subir archivo</button>
          <input ref={fotoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { elegirArchivo(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { elegirArchivo(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}

      <p className="cy-q">Estado</p>
      <div className="cy-seg" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", marginBottom: 12 }}>
        {ESTADOS.map(([k, t]) => <button key={k} aria-pressed={estado === k} onClick={() => setEstado(k)}>{t}</button>)}
      </div>

      {!mas ? (
        <button className="cy-link" onClick={() => setMas(true)}><Icono n="mas" s={16} />Añadir teléfono, caducidad o notas</button>
      ) : (
        <div className="cy-entra">
          <div className="cy-two">
            <label className="cy-fld">
              <span>Válido hasta</span>
              <input className="cy-inp" type="date" value={validoHasta} onChange={(e) => setValidoHasta(e.target.value)} />
            </label>
            <label className="cy-fld">
              <span>Teléfono</span>
              <input className="cy-inp" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="612 345 678" maxLength={16} />
            </label>
          </div>
          <label className="cy-fld">
            <span>¿Qué incluye?</span>
            <textarea className="cy-inp" rows={2} value={incluye} onChange={(e) => setIncluye(e.target.value)} placeholder="Ej: Material, dos manos, tapar grietas, limpieza final" maxLength={2000} />
          </label>
          <label className="cy-fld">
            <span>Notas para ti</span>
            <textarea className="cy-inp" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: Puede empezar el lunes. Pide la mitad por adelantado." maxLength={2000} />
          </label>
        </div>
      )}

      {editando && (
        <div style={{ marginTop: 18, textAlign: "center" }}>
          {!confirmarBorrar
            ? <button className="cy-link" style={{ color: "var(--coral)" }} onClick={() => setConfirmarBorrar(true)}><Icono n="papelera" s={16} />Borrar este presupuesto</button>
            : <div className="cy-row" style={{ justifyContent: "center" }}>
                <span className="cy-mini" style={{ width: "100%" }}>¿Seguro? No se puede deshacer.</span>
                <button className="cy-btn-g cy-btn-sm" onClick={() => setConfirmarBorrar(false)}>Cancelar</button>
                <button className="cy-btn-g cy-btn-sm" style={{ borderColor: "rgba(255,173,138,.5)", color: "var(--coral)" }} onClick={borrar}>Sí, borrar</button>
              </div>}
        </div>
      )}
    </Hoja>
  );
}
