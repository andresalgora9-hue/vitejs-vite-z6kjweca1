// ============================================================
// OficioYa · ADMIN — OFICINA 3D EN DIRECTO
// Un gran salón en un edificio, con cada departamento en su zona y su supervisor en otra parte.
// Personajes 3D estilizados (cabezones, contorno de dibujo animado, sombras suaves) que llegan a las 6:00,
// se reúnen con Dirección para el plan del día, trabajan en su mesa, van a por café, descansan en el sofá
// y se marchan a la 1:00. Encima de cada uno, una mini pantalla con lo que está pensando en ese momento.
// Pulsar a cualquiera abre su chat directo.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type J = any;
type V3 = THREE.Vector3;
export type PersonaOficina = {
  id: string; nombre: string; icono: string; color: string; activo: boolean;
  estado: string; tipo: string | null; paso: string | null; progreso: string | null;
  cafe: boolean; cafeClave: string; ultimo: string | null; tarea: string | null;
};
export type DatosOficina = {
  personas: PersonaOficina[];
  reunion: "plan" | "reunion" | null;
  eventos: { titulo: string; created_at: string }[];
  objetivo: { actual: number; objetivo: number } | null;
  foco: string | null;
  tareasPlan: { departamento: string; texto: string }[];
};

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const TZ = "Europe/Madrid";
const fmtHora = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
let horaSimulada: number | null = null;
export function simularHora(h: number | null) { horaSimulada = h; }
function horaMadrid() {
  if (horaSimulada !== null) { const d = new Date(); const h = Math.floor(horaSimulada), m = d.getMinutes(), s = d.getSeconds(); const z = (n: number) => String(n).padStart(2, "0"); return { h, m, s, frac: h + m / 60 + s / 3600, texto: `${z(h)}:${z(m)}:${z(s)}` }; }
  const p = Object.fromEntries(fmtHora.formatToParts(new Date()).map((x) => [x.type, x.value]));
  const h = Number(p.hour) % 24, m = Number(p.minute), s = Number(p.second);
  return { h, m, s, frac: h + m / 60 + s / 3600, texto: `${p.hour}:${p.minute}:${p.second}` };
}
const enJornada = (h: number) => !(h >= 1 && h < 6);

// ---------------- Distribución del salón ----------------
type Pose = "de_pie" | "sentado";
type Destino = { clave: string; p: V3; rot: number; pose: Pose; lado?: V3; puerta?: V3; via?: V3[] };
const PASILLOS = [-4.8, 5.8];
const PUERTA_REUNION = V(0, 0, -6.0);
const PUERTA_DIRECCION = V(13.2, 0, -5.6);
const ASCENSOR = V(-20.4, 0, 9.5);
const MESAS: Record<string, { x: number; z: number }> = {
  marketing: { x: -11, z: -1 }, supervisor: { x: -6.2, z: 3.0 },
  ciberseguridad: { x: 8, z: -1 }, auditor: { x: 12.6, z: 3.0 },
  direccion: { x: 16.8, z: -10.5 },
  asistente: { x: 17.6, z: -2.4 },
  expansion: { x: -9.5, z: 8.5 }, captacion: { x: -4.5, z: 8.5 }, operaciones: { x: 0.5, z: 8.5 }, finanzas: { x: 5.5, z: 8.5 }, producto: { x: 10.5, z: 8.5 },
};
const ASIENTOS_REUNION: [number, number, number][] = [[-3.1, -10.2, Math.PI / 2], [-1.7, -11.25, 0], [0, -11.25, 0], [1.7, -11.25, 0], [-1.7, -9.15, Math.PI], [0, -9.15, Math.PI], [1.7, -9.15, Math.PI], [3.1, -10.2, -Math.PI / 2]];
const VISITAS: Record<string, string> = { supervisor: "marketing", auditor: "ciberseguridad" };

function destinoMesa(id: string): Destino {
  const m = MESAS[id] || { x: 0, z: 0 };
  const p = V(m.x, 0, m.z - 0.82);
  return { clave: "mesa", p, rot: 0, pose: "sentado", lado: V(m.x + 1.15, 0, m.z - 0.82), puerta: id === "direccion" ? PUERTA_DIRECCION : undefined };
}
function destinoReunion(i: number): Destino {
  const [x, z, r] = ASIENTOS_REUNION[Math.min(i, ASIENTOS_REUNION.length - 1)];
  const ex = x < 0 ? -3.95 : 3.95;
  const via = z > -10 && Math.abs(x) < 3 ? [V(x, 0, -8.3)]
    : Math.abs(x) >= 3 ? [V(ex, 0, -8.3), V(ex, 0, z)]
    : [V(ex, 0, -8.3), V(ex, 0, -12.25), V(x, 0, -12.25)];
  return { clave: "reunion:" + i, p: V(x, 0, z), rot: r, pose: "sentado", puerta: PUERTA_REUNION, via };
}
const destinoCafe = (i: number): Destino => ({ clave: "cafe", p: V(-17.6 + i * 1.3, 0, -11.0), rot: Math.PI, pose: "de_pie" });
const destinoSofa = (i: number): Destino => ({ clave: "sofa:" + i, p: V(-19.0, 0, 2.85 + i * 0.95), rot: Math.PI / 2, pose: "sentado", lado: V(-18.2, 0, 2.85 + i * 0.95) });
const destinoAscensor = (): Destino => ({ clave: "casa", p: ASCENSOR.clone(), rot: -Math.PI / 2, pose: "de_pie" });
function destinoVisita(objetivo: string): Destino {
  const m = MESAS[objetivo];
  return { clave: "visita:" + objetivo, p: V(m.x + 1.0, 0, m.z - 1.35), rot: -Math.PI / 2 - 0.35, pose: "de_pie" };
}
// La Asistente se para al lado de cada compañero para recoger o llevar información
function destinoRecado(id: string): Destino {
  const m = MESAS[id];
  if (id === "direccion") return { clave: "recado:direccion", p: V(m.x - 1.3, 0, m.z - 0.55), rot: Math.PI / 2, pose: "de_pie", puerta: PUERTA_DIRECCION };
  return { clave: "recado:" + id, p: V(m.x - 1.15, 0, m.z - 1.3), rot: Math.PI / 2 + 0.3, pose: "de_pie" };
}
function ruta(desde: Destino, hasta: Destino): V3[] {
  const a = desde.p, b = hasta.p;
  const zc = PASILLOS.reduce((best, z) => (Math.abs(a.z - z) + Math.abs(b.z - z) < Math.abs(a.z - best) + Math.abs(b.z - best) ? z : best), PASILLOS[0]);
  const pts: V3[] = [];
  const salida = [...(desde.via || []).slice().reverse(), desde.lado, desde.puerta].filter(Boolean) as V3[];
  for (const s of salida) pts.push(s.clone());
  const ultimo = pts.length ? pts[pts.length - 1] : a;
  pts.push(V(ultimo.x, 0, zc));
  const entrada = [hasta.puerta, hasta.lado, ...(hasta.via || [])].filter(Boolean) as V3[];
  const primero = entrada.length ? entrada[0] : b;
  pts.push(V(primero.x, 0, zc));
  for (const e of entrada) pts.push(e.clone());
  pts.push(b.clone());
  return pts;
}

// ---------------- Materiales y utilidades ----------------
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, rough = 0.62, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const k = color + ":" + rough + ":" + JSON.stringify(extra);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02, ...extra }));
  return matCache.get(k)!;
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x2a1c12, side: THREE.BackSide });
function malla(geo: THREE.BufferGeometry, m: THREE.Material, pos?: [number, number, number], sombra = true) {
  const x = new THREE.Mesh(geo, m);
  if (pos) x.position.set(...pos);
  x.castShadow = sombra; x.receiveShadow = true;
  return x;
}
function contorno(m: THREE.Mesh, k = 1.06) {
  const o = new THREE.Mesh(m.geometry, OUTLINE);
  o.scale.setScalar(k); o.castShadow = false; o.receiveShadow = false;
  o.raycast = () => {};
  m.add(o);
  return m;
}
function texturaTexto(lineas: { t: string; size: number; color: string; peso?: string }[], w = 512, h = 128, fondo: string | null = null) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  if (fondo) { g.fillStyle = fondo; g.fillRect(0, 0, w, h); }
  let y = 0; const total = lineas.reduce((s, l) => s + l.size * 1.25, 0);
  y = (h - total) / 2;
  for (const l of lineas) {
    g.font = `${l.peso || "800"} ${l.size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    g.fillStyle = l.color; g.textAlign = "center"; g.textBaseline = "top";
    g.fillText(l.t, w / 2, y); y += l.size * 1.25;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------- Personajes ----------------
type Cfg = { piel: number; pelo: number; peinado: "tupe" | "coleta" | "corto" | "rizado" | "calvo" | "melena"; camisa: number; pantalon: number; zapatos?: number; extras: string[]; mujer?: boolean };
const CFG: Record<string, Cfg> = {
  direccion: { piel: 0xf1c7a3, pelo: 0x3b2417, peinado: "tupe", camisa: 0x22324d, pantalon: 0x2b2b33, extras: ["corbata", "cuello"] },
  asistente: { piel: 0xf0c9a6, pelo: 0x5b2c1a, peinado: "coleta", camisa: 0x14b8a6, pantalon: 0x1f2937, extras: ["gafas"], mujer: true },
  marketing: { piel: 0xf3d0b5, pelo: 0x9a3e1c, peinado: "coleta", camisa: 0xe8862a, pantalon: 0x2f4f8f, extras: ["cascos"], mujer: true },
  supervisor: { piel: 0xe0b18f, pelo: 0x9a9a9a, peinado: "corto", camisa: 0x7c5cc4, pantalon: 0x3a3a46, extras: ["gafas", "barba", "sombrero"] },
  ciberseguridad: { piel: 0xc98e64, pelo: 0x1d1d1d, peinado: "rizado", camisa: 0x1f8a70, pantalon: 0x26262e, extras: ["capucha", "gafas"] },
  auditor: { piel: 0xa86f4c, pelo: 0x1a1a1a, peinado: "corto", camisa: 0x9cc3e6, pantalon: 0x1e2a44, extras: ["gorra_policia", "bigote"] },
  expansion: { piel: 0xf0c8a8, pelo: 0xd9a441, peinado: "melena", camisa: 0x2b7bd6, pantalon: 0x33334a, extras: [], mujer: true },
  captacion: { piel: 0xb57a52, pelo: 0x2a1a10, peinado: "tupe", camisa: 0x10a37f, pantalon: 0x2b2b33, extras: ["barba"] },
  operaciones: { piel: 0xe8b996, pelo: 0x5a3a22, peinado: "corto", camisa: 0xf2b134, pantalon: 0x2d3f5c, extras: ["gafas"] },
  finanzas: { piel: 0xf3d6c0, pelo: 0x111111, peinado: "melena", camisa: 0x6b7280, pantalon: 0x1f2937, extras: ["gafas"], mujer: true },
  producto: { piel: 0xd29f7a, pelo: 0x704214, peinado: "rizado", camisa: 0xdb2777, pantalon: 0x312e81, extras: ["cascos"] },
};

class Personaje {
  id: string;
  raiz = new THREE.Group();
  cuerpo = new THREE.Group();
  torso!: THREE.Mesh; cabeza = new THREE.Group();
  hombroI = new THREE.Group(); hombroD = new THREE.Group(); codoI = new THREE.Group(); codoD = new THREE.Group();
  musloI = new THREE.Group(); musloD = new THREE.Group(); rodillaI = new THREE.Group(); rodillaD = new THREE.Group();
  ojos: THREE.Object3D[] = [];
  tazaMano!: THREE.Group;
  aura!: THREE.Mesh;
  golpe!: THREE.Mesh;
  ubicacion: Destino; destino: Destino;
  camino: V3[] = [];
  rot = 0; fase = Math.random() * 10; semilla = Math.random() * 100;
  visible = false;
  parpadeo = 1 + Math.random() * 3; parpadeando = 0;
  estiramiento = 40 + Math.random() * 60; estirando = 0;
  cafeHecho = ""; bebiendo = 0;
  enCasa = true;

  constructor(id: string, escena: THREE.Scene) {
    this.id = id;
    const c = CFG[id] || CFG.operaciones;
    const piel = mat(c.piel, 0.55), pelo = mat(c.pelo, 0.7), camisa = mat(c.camisa, 0.75), pant = mat(c.pantalon, 0.8), zap = mat(c.zapatos ?? 0x1c1c1f, 0.5);
    const blanco = mat(0xffffff, 0.3), negro = mat(0x15110e, 0.35);
    // piernas con rodilla
    const pierna = (g: THREE.Group, rod: THREE.Group, x: number) => {
      g.position.set(x, 0.62, 0);
      const muslo = contorno(malla(new THREE.CapsuleGeometry(0.105, 0.17, 4, 12), pant, [0, -0.16, 0]));
      rod.position.set(0, -0.32, 0);
      const espinilla = contorno(malla(new THREE.CapsuleGeometry(0.095, 0.15, 4, 12), pant, [0, -0.13, 0]));
      const zapato = contorno(malla(new THREE.SphereGeometry(0.12, 14, 10), zap, [0, -0.29, 0.06]));
      zapato.scale.set(1, 0.62, 1.55);
      rod.add(espinilla, zapato); g.add(muslo, rod);
      this.cuerpo.add(g);
    };
    pierna(this.musloI, this.rodillaI, -0.13); pierna(this.musloD, this.rodillaD, 0.13);
    // cadera y torso
    this.cuerpo.add(contorno(malla(new THREE.CylinderGeometry(0.255, 0.235, 0.2, 18), pant, [0, 0.67, 0])));
    this.torso = contorno(malla(new THREE.CapsuleGeometry(0.26, 0.26, 6, 16), camisa, [0, 0.98, 0]));
    this.torso.scale.set(1.12, 1, 0.84);
    this.cuerpo.add(this.torso);
    if (c.mujer) { const falda = contorno(malla(new THREE.CylinderGeometry(0.27, 0.33, 0.22, 18), camisa, [0, 0.66, 0])); this.cuerpo.add(falda); }
    if (c.extras.includes("corbata")) {
      this.cuerpo.add(malla(new THREE.BoxGeometry(0.075, 0.34, 0.03), mat(0xc0392b, 0.5), [0, 1.03, 0.215]));
      this.cuerpo.add(malla(new THREE.BoxGeometry(0.09, 0.06, 0.04), mat(0xa93226, 0.5), [0, 1.22, 0.215]));
    }
    if (c.extras.includes("cuello")) { const cu = malla(new THREE.TorusGeometry(0.13, 0.035, 8, 20), blanco, [0, 1.29, 0.02]); cu.rotation.x = Math.PI / 2; this.cuerpo.add(cu); }
    if (c.extras.includes("capucha")) {
      const cap = contorno(malla(new THREE.SphereGeometry(0.22, 16, 12), camisa, [0, 1.3, -0.2])); cap.scale.set(1.2, 0.7, 0.9); this.cuerpo.add(cap);
      [-0.08, 0.08].forEach((x) => this.cuerpo.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 0.22), blanco, [x, 1.1, 0.22])));
    }
    // brazos
    const brazo = (h: THREE.Group, codo: THREE.Group, x: number) => {
      h.position.set(x, 1.22, 0);
      h.add(contorno(malla(new THREE.CapsuleGeometry(0.085, 0.17, 4, 12), camisa, [0, -0.15, 0])));
      codo.position.set(0, -0.31, 0);
      codo.add(contorno(malla(new THREE.CapsuleGeometry(0.078, 0.15, 4, 12), camisa, [0, -0.12, 0])));
      codo.add(contorno(malla(new THREE.SphereGeometry(0.085, 14, 10), piel, [0, -0.28, 0.01])));
      h.add(codo); this.cuerpo.add(h);
    };
    brazo(this.hombroI, this.codoI, -0.37); brazo(this.hombroD, this.codoD, 0.37);
    this.tazaMano = new THREE.Group();
    const taza = malla(new THREE.CylinderGeometry(0.055, 0.048, 0.12, 14), blanco); this.tazaMano.add(taza);
    const asa = malla(new THREE.TorusGeometry(0.035, 0.01, 6, 12), blanco, [0.06, 0, 0]); asa.rotation.y = Math.PI / 2; this.tazaMano.add(asa);
    this.tazaMano.position.set(0, -0.36, 0.06); this.tazaMano.visible = false; this.codoD.add(this.tazaMano);
    // cuello y cabeza (grande, estilo dibujo)
    this.cuerpo.add(malla(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 12), piel, [0, 1.36, 0]));
    this.cabeza.position.set(0, 1.4, 0);
    const craneo = contorno(malla(new THREE.SphereGeometry(0.34, 28, 22), piel, [0, 0.3, 0]), 1.04);
    craneo.scale.set(1, 1.04, 0.98); this.cabeza.add(craneo);
    [-1, 1].forEach((s) => {
      const oreja = contorno(malla(new THREE.SphereGeometry(0.07, 12, 10), piel, [s * 0.335, 0.29, 0])); oreja.scale.set(0.55, 1, 0.8); this.cabeza.add(oreja);
      const ojo = new THREE.Group(); ojo.position.set(s * 0.12, 0.33, 0.285);
      const blancoOjo = malla(new THREE.SphereGeometry(0.078, 16, 12), blanco); blancoOjo.scale.set(1, 1.12, 0.62);
      const pupila = malla(new THREE.SphereGeometry(0.044, 12, 10), mat(0x2b1a10, 0.25), [0, -0.005, 0.042]);
      const brillo = malla(new THREE.SphereGeometry(0.014, 8, 6), mat(0xffffff, 0.1, { emissive: 0xffffff, emissiveIntensity: 0.6 }), [-0.016, 0.018, 0.075]);
      ojo.add(blancoOjo, pupila, brillo); this.cabeza.add(ojo); this.ojos.push(ojo);
      const ceja = malla(new THREE.BoxGeometry(0.12, 0.028, 0.03), pelo, [s * 0.12, 0.445, 0.3]); ceja.rotation.z = -s * 0.14; this.cabeza.add(ceja);
      const mejilla = malla(new THREE.SphereGeometry(0.05, 10, 8), mat(0xff8a8a, 0.8, { transparent: true, opacity: 0.45 }), [s * 0.2, 0.2, 0.265]); mejilla.scale.set(1.1, 0.6, 0.4); mejilla.castShadow = false; this.cabeza.add(mejilla);
    });
    this.cabeza.add(malla(new THREE.SphereGeometry(0.058, 12, 10), mat(Math.max(0, c.piel - 0x101010), 0.55), [0, 0.245, 0.335]));
    const boca = malla(new THREE.TorusGeometry(0.065, 0.014, 8, 18, Math.PI), mat(0x7a1f1f, 0.4), [0, 0.165, 0.305]); boca.rotation.z = Math.PI; this.cabeza.add(boca);
    // pelo
    if (c.peinado !== "calvo") {
      const gorro = contorno(malla(new THREE.SphereGeometry(0.36, 26, 16, 0, Math.PI * 2, 0, Math.PI * (c.peinado === "corto" ? 0.42 : 0.5)), pelo, [0, 0.31, -0.02]), 1.03);
      gorro.rotation.x = -0.2; this.cabeza.add(gorro);
    }
    if (c.peinado === "tupe") { const t = contorno(malla(new THREE.SphereGeometry(0.17, 16, 12), pelo, [0.04, 0.6, 0.17])); t.scale.set(1.7, 0.7, 1.1); this.cabeza.add(t); }
    if (c.peinado === "coleta") {
      const col = contorno(malla(new THREE.CapsuleGeometry(0.095, 0.3, 4, 12), pelo, [0, 0.28, -0.4])); col.rotation.x = 0.45; this.cabeza.add(col);
      this.cabeza.add(malla(new THREE.TorusGeometry(0.07, 0.022, 8, 14), mat(0xffffff, 0.5), [0, 0.45, -0.33]));
      [-1, 1].forEach((s) => { const m = contorno(malla(new THREE.CapsuleGeometry(0.06, 0.16, 4, 10), pelo, [s * 0.3, 0.3, 0.12])); this.cabeza.add(m); });
    }
    if (c.peinado === "melena") { const m = contorno(malla(new THREE.SphereGeometry(0.37, 22, 16, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.55), pelo, [0, 0.25, -0.05])); m.scale.set(1.05, 1.1, 1); this.cabeza.add(m); }
    if (c.peinado === "rizado") for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2; this.cabeza.add(contorno(malla(new THREE.SphereGeometry(0.1, 10, 8), pelo, [Math.cos(a) * 0.25, 0.56 + Math.sin(i * 1.7) * 0.03, Math.sin(a) * 0.22 - 0.03]))); }
    // complementos
    if (c.extras.includes("gafas")) {
      const marco = mat(0x1d1d1d, 0.3);
      [-1, 1].forEach((s) => { const r = malla(new THREE.TorusGeometry(0.085, 0.013, 8, 20), marco, [s * 0.12, 0.33, 0.33]); this.cabeza.add(r); });
      this.cabeza.add(malla(new THREE.BoxGeometry(0.08, 0.014, 0.014), marco, [0, 0.34, 0.335]));
    }
    if (c.extras.includes("barba")) { const b = malla(new THREE.SphereGeometry(0.33, 20, 12, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.44), pelo, [0, 0.31, 0.02]); b.scale.set(1.04, 1, 1.04); this.cabeza.add(b); boca.position.z = 0.33; }
    if (c.extras.includes("bigote")) { const b = malla(new THREE.CapsuleGeometry(0.024, 0.14, 4, 8), pelo, [0, 0.205, 0.33]); b.rotation.z = Math.PI / 2; this.cabeza.add(b); }
    if (c.extras.includes("cascos")) {
      const neg = mat(0x222222, 0.4);
      const arco = malla(new THREE.TorusGeometry(0.37, 0.025, 8, 24, Math.PI), neg, [0, 0.33, 0]); arco.rotation.z = 0; this.cabeza.add(arco);
      [-1, 1].forEach((s) => { const cup = malla(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 16), neg, [s * 0.36, 0.3, 0]); cup.rotation.z = Math.PI / 2; this.cabeza.add(cup); });
      const mic = malla(new THREE.CylinderGeometry(0.01, 0.01, 0.26, 6), neg, [-0.27, 0.2, 0.2]); mic.rotation.set(0.9, 0.5, 0); this.cabeza.add(mic);
    }
    if (c.extras.includes("sombrero")) {
      const marron = mat(0x5a4632, 0.7);
      this.cabeza.add(contorno(malla(new THREE.CylinderGeometry(0.47, 0.47, 0.035, 26), marron, [0, 0.6, 0])));
      this.cabeza.add(contorno(malla(new THREE.CylinderGeometry(0.27, 0.31, 0.24, 22), marron, [0, 0.72, 0])));
      this.cabeza.add(malla(new THREE.CylinderGeometry(0.315, 0.315, 0.05, 22), mat(0x2b2018, 0.6), [0, 0.63, 0]));
    }
    if (c.extras.includes("gorra_policia")) {
      const azul = mat(0x1b2a4a, 0.55);
      this.cabeza.add(contorno(malla(new THREE.CylinderGeometry(0.33, 0.31, 0.16, 22), azul, [0, 0.62, 0])));
      this.cabeza.add(contorno(malla(new THREE.CylinderGeometry(0.39, 0.39, 0.05, 24), azul, [0, 0.71, 0.02])));
      const visera = malla(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), mat(0x0b0b0b, 0.3), [0, 0.56, 0.22]); visera.scale.set(1.3, 1, 0.8); this.cabeza.add(visera);
      const placa = malla(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 6), mat(0xd4af37, 0.3, { metalness: 0.7 }), [0, 0.64, 0.325]); placa.rotation.x = Math.PI / 2; this.cabeza.add(placa);
    }
    this.cuerpo.add(this.cabeza);
    // aura del café y zona de clic
    this.aura = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xffa53a, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
    this.aura.rotation.x = -Math.PI / 2; this.aura.position.y = 0.02;
    this.golpe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 10), new THREE.MeshBasicMaterial({ visible: false }));
    this.golpe.position.y = 1.0; this.golpe.userData.persona = id;
    this.cuerpo.scale.setScalar(0.84);
    this.raiz.add(this.cuerpo, this.aura, this.golpe);
    this.raiz.visible = false;
    escena.add(this.raiz);
    this.ubicacion = destinoAscensor(); this.destino = this.ubicacion;
  }

  colocar(d: Destino) {
    this.raiz.position.copy(d.p); this.rot = d.rot; this.raiz.rotation.y = d.rot;
    this.ubicacion = d; this.destino = d; this.camino = []; this.raiz.visible = true; this.enCasa = false;
  }
  ir(d: Destino) {
    if (d.clave === this.destino.clave && (this.camino.length || this.ubicacion.clave === d.clave)) return;
    this.destino = d;
    this.camino = ruta(this.ubicacion, d);
    this.raiz.visible = true; this.enCasa = false;
  }
  get andando() { return this.camino.length > 0; }
}

// ---------------- Motor de la escena ----------------
class Motor {
  renderer: THREE.WebGLRenderer; escena = new THREE.Scene(); camara: THREE.PerspectiveCamera; controles: OrbitControls;
  reloj = new THREE.Clock(); raf = 0; caja: HTMLDivElement; capa: HTMLDivElement;
  personas = new Map<string, Personaje>();
  pantallas = new Map<string, HTMLDivElement>();
  mesas = new Map<string, { pantalla: THREE.MeshStandardMaterial; taza: THREE.Group; humo: THREE.Mesh[]; lampara: THREE.MeshStandardMaterial }>();
  vacantes = new Map<string, HTMLDivElement>();
  datos: DatosOficina | null = null;
  sol!: THREE.DirectionalLight; hemi!: THREE.HemisphereLight; amb!: THREE.AmbientLight; puntos: THREE.PointLight[] = [];
  tv!: { c: HTMLCanvasElement; t: THREE.CanvasTexture }; led!: { c: HTMLCanvasElement; t: THREE.CanvasTexture }; plan!: { c: HTMLCanvasElement; t: THREE.CanvasTexture };
  cielo!: { c: HTMLCanvasElement; t: THREE.CanvasTexture; hora: number };
  puertasAscensor: THREE.Mesh[] = [];
  ultimoSegundo = -1; ultimoTv = 0;
  onClick: (id: string) => void;
  raycaster = new THREE.Raycaster(); puntero = new THREE.Vector2(); bajada: { x: number; y: number } | null = null;
  movil: boolean;

  constructor(caja: HTMLDivElement, capa: HTMLDivElement, onClick: (id: string) => void) {
    this.caja = caja; this.capa = capa; this.onClick = onClick;
    this.movil = caja.clientWidth < 700;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.movil ? 1.5 : 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    caja.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.camara = new THREE.PerspectiveCamera(42, 1, 0.5, 300);
    this.camara.position.set(4, 24, 30);
    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.target.set(0, 0, -1); this.controles.enableDamping = true; this.controles.dampingFactor = 0.08;
    this.controles.minDistance = 8; this.controles.maxDistance = 60; this.controles.maxPolarAngle = 1.3; this.controles.minPolarAngle = 0.25;
    this.controles.autoRotateSpeed = 0.5;
    this.escena.background = new THREE.Color(0x0e1320);
    this.escena.fog = new THREE.Fog(0x0e1320, 70, 160);
    this.construir();
    this.redimensionar();
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.alBajar); el.addEventListener("pointerup", this.alSubir); el.addEventListener("pointermove", this.alMover);
    this.bucle();
  }

  // ------- Construcción del edificio -------
  construir() {
    const E = this.escena;
    // luces
    this.hemi = new THREE.HemisphereLight(0xe8f1ff, 0x8a7560, 1.4); E.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff, 0.35); E.add(this.amb);
    this.sol = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sol.position.set(26, 32, 14); this.sol.castShadow = true;
    const s = this.sol.shadow; s.mapSize.set(this.movil ? 1024 : 2048, this.movil ? 1024 : 2048);
    s.camera.left = -30; s.camera.right = 30; s.camera.top = 22; s.camera.bottom = -22; s.camera.near = 1; s.camera.far = 90; s.bias = -0.0004; s.normalBias = 0.03;
    E.add(this.sol);
    [[-17.5, 3, -10.5], [0, 3.2, -10.2], [16.8, 3, -10.5], [-18, 3, 4.5]].forEach(([x, y, z]) => { const p = new THREE.PointLight(0xffd9a8, 0, 14, 2); p.position.set(x, y, z); E.add(p); this.puntos.push(p); });

    // suelo de madera
    const cs = document.createElement("canvas"); cs.width = 512; cs.height = 512; const g = cs.getContext("2d")!;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) {
      const tono = 150 + ((i * 37 + j * 53) % 40);
      g.fillStyle = `rgb(${tono + 40},${tono + 8},${tono - 40})`; g.fillRect(j * 128 + (i % 2) * 64, i * 32, 128, 31);
      g.fillStyle = "rgba(60,35,15,0.25)"; g.fillRect(j * 128 + (i % 2) * 64, i * 32 + 31, 128, 1);
      for (let k = 0; k < 5; k++) { g.strokeStyle = "rgba(90,55,25,0.12)"; g.beginPath(); g.moveTo(j * 128 + (i % 2) * 64, i * 32 + 6 + k * 5); g.lineTo(j * 128 + (i % 2) * 64 + 128, i * 32 + 4 + k * 5); g.stroke(); }
    }
    const tex = new THREE.CanvasTexture(cs); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(9, 6); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(44, 28), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
    suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; E.add(suelo);
    const losa = malla(new THREE.BoxGeometry(44.6, 1.2, 28.6), mat(0x3a3f4a, 0.9), [0, -0.61, 0], false); E.add(losa);
    // paredes
    const pared = mat(0xebe4d8, 0.9);
    const muro = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = pared) => { const b = malla(new THREE.BoxGeometry(w, h, d), m, [x, y, z]); E.add(b); return b; };
    muro(8, 3.8, 0.3, -18, 1.9, -14.15); muro(8, 3.8, 0.3, -10, 1.9, -14.15); muro(6, 3.8, 0.3, 9, 1.9, -14.15);
    muro(0.3, 3.8, 28.6, -22.15, 1.9, 0);
    // ventanales: fondo de sala de reuniones, despacho de Dirección y pared derecha
    const vidrio = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false });
    const marco = mat(0x2d3340, 0.5);
    const ventanal = (x: number, z: number, w: number, rotY: number) => {
      const gr = new THREE.Group(); gr.position.set(x, 0, z); gr.rotation.y = rotY;
      gr.add(malla(new THREE.BoxGeometry(w, 3.8, 0.05), vidrio, [0, 1.9, 0], false));
      for (let i = 0; i <= Math.round(w / 2); i++) gr.add(malla(new THREE.BoxGeometry(0.08, 3.8, 0.1), marco, [-w / 2 + (i * w) / Math.round(w / 2), 1.9, 0]));
      gr.add(malla(new THREE.BoxGeometry(w, 0.1, 0.12), marco, [0, 3.8, 0])); gr.add(malla(new THREE.BoxGeometry(w, 0.5, 0.14), mat(0xd9d2c4, 0.9), [0, 0.25, 0]));
      E.add(gr);
    };
    ventanal(0, -14.15, 12, 0); ventanal(17, -14.15, 10, 0); ventanal(22.15, 0, 28.6, Math.PI / 2);
    // cielo y ciudad (Sevilla) tras los ventanales
    const cc = document.createElement("canvas"); cc.width = 2048; cc.height = 512;
    this.cielo = { c: cc, t: new THREE.CanvasTexture(cc), hora: -1 }; this.cielo.t.colorSpace = THREE.SRGBColorSpace;
    const fondoCiudad = new THREE.MeshBasicMaterial({ map: this.cielo.t, fog: false });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(170, 42), fondoCiudad); p1.position.set(0, 12, -48); E.add(p1);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(170, 42), fondoCiudad); p2.position.set(50, 12, 0); p2.rotation.y = -Math.PI / 2; E.add(p2);
    // columnas
    [[-14.5, 1.0], [3.2, 1.0], [19.5, 1.0], [-1.5, 11.6]].forEach(([x, z]) => E.add(malla(new THREE.CylinderGeometry(0.28, 0.28, 3.8, 18), mat(0xf3efe8, 0.8), [x, 1.9, z])));

    // sala de reuniones (cristal) con mesa y pantalla del plan
    this.salaCristal(-6, 6, -13.9, -6.5, PUERTA_REUNION.x);
    const mesaR = malla(new THREE.BoxGeometry(5.4, 0.08, 1.7), mat(0x6b4a2e, 0.45), [0, 0.76, -10.2]); E.add(mesaR);
    [[-2.4, -0.6], [2.4, -0.6], [-2.4, 0.6], [2.4, 0.6]].forEach(([x, z]) => E.add(malla(new THREE.BoxGeometry(0.08, 0.74, 0.08), mat(0x2d2d33, 0.4), [x, 0.37, -10.2 + z])));
    ASIENTOS_REUNION.forEach(([x, z, r]) => this.silla(x, z, r, 0x384152));
    this.alfombra(0, -10.2, 8, 4.4, 0x3b4a63);
    const cp = document.createElement("canvas"); cp.width = 1024; cp.height = 640; this.plan = { c: cp, t: new THREE.CanvasTexture(cp) }; this.plan.t.colorSpace = THREE.SRGBColorSpace;
    const pantallaPlan = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), new THREE.MeshBasicMaterial({ map: this.plan.t, toneMapped: false }));
    pantallaPlan.position.set(-5.85, 1.9, -10.2); pantallaPlan.rotation.y = Math.PI / 2; E.add(pantallaPlan);
    E.add(malla(new THREE.BoxGeometry(0.06, 2.15, 3.35), mat(0x111111, 0.3), [-5.9, 1.9, -10.2], false));

    // despacho de Dirección (cristal)
    this.salaCristal(12, 22, -13.9, -6.0, PUERTA_DIRECCION.x);
    this.alfombra(16.8, -10.5, 5, 4, 0x5a2e2e);
    E.add(malla(new THREE.BoxGeometry(1.2, 2.1, 0.5), mat(0x5b3d26, 0.6), [20.6, 1.05, -12.8]));
    this.planta(13, -13); this.planta(21, -7);

    // mesas de trabajo
    for (const id of Object.keys(MESAS)) this.mesa(id);

    // cafetería
    E.add(malla(new THREE.BoxGeometry(6.5, 0.95, 0.75), mat(0xf5f5f2, 0.5), [-18, 0.475, -13.55]));
    E.add(malla(new THREE.BoxGeometry(6.6, 0.06, 0.82), mat(0x2f2f35, 0.3), [-18, 0.98, -13.52]));
    const cafetera = new THREE.Group(); cafetera.position.set(-17.6, 1.01, -13.6);
    cafetera.add(malla(new THREE.BoxGeometry(0.62, 0.72, 0.5), mat(0x2b2f36, 0.3, { metalness: 0.6 }), [0, 0.36, 0]));
    cafetera.add(malla(new THREE.BoxGeometry(0.64, 0.1, 0.52), mat(0xe8862a, 0.4), [0, 0.75, 0]));
    cafetera.add(malla(new THREE.SphereGeometry(0.04, 10, 8), mat(0x22ff88, 0.2, { emissive: 0x22ff88, emissiveIntensity: 2 }), [0.18, 0.55, 0.26]));
    cafetera.add(malla(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 12), mat(0xffffff, 0.3), [0, 0.12, 0.12]));
    E.add(cafetera);
    E.add(malla(new THREE.BoxGeometry(0.8, 2.0, 0.7), mat(0xdfe3e8, 0.35, { metalness: 0.3 }), [-21.2, 1.0, -13.4]));
    [-16.2, -14.9].forEach((x) => { E.add(malla(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), mat(0xe8862a, 0.5), [x, 0.78, -12.2])); E.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 0.76, 8), mat(0x333333, 0.3), [x, 0.38, -12.2])); });
    this.planta(-14.6, -13.4);

    // zona de descanso
    this.alfombra(-17.8, 4.8, 5.5, 5, 0x6b5b8c);
    const sofa = new THREE.Group(); sofa.position.set(-19.4, 0, 3.8);
    const tela = mat(0x2f8f83, 0.95);
    sofa.add(malla(new THREE.BoxGeometry(0.9, 0.42, 3.3), tela, [0, 0.21, 0])); sofa.add(malla(new THREE.BoxGeometry(0.25, 0.85, 3.3), tela, [-0.42, 0.45, 0]));
    sofa.add(malla(new THREE.BoxGeometry(0.9, 0.62, 0.22), tela, [0, 0.31, -1.6])); sofa.add(malla(new THREE.BoxGeometry(0.9, 0.62, 0.22), tela, [0, 0.31, 1.6]));
    [-1, 0, 1].forEach((i) => sofa.add(malla(new THREE.BoxGeometry(0.7, 0.14, 1.0), mat(0x37a596, 0.95), [0.05, 0.47, i * 1.05])));
    E.add(sofa);
    E.add(malla(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 24), mat(0x6b4a2e, 0.45), [-17.4, 0.45, 4.6])); E.add(malla(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 10), mat(0x333333, 0.3), [-17.4, 0.21, 4.6]));
    const lamp = new THREE.Group(); lamp.position.set(-20.8, 0, 7.2);
    lamp.add(malla(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 8), mat(0x222222, 0.3), [0, 0.85, 0])); lamp.add(malla(new THREE.ConeGeometry(0.28, 0.32, 18, 1, true), mat(0xfff1d0, 0.6, { emissive: 0xffd28a, emissiveIntensity: 0.6, side: THREE.DoubleSide }), [0, 1.75, 0]));
    E.add(lamp);
    this.planta(-21, 1.5); this.planta(-14.6, 7.6);

    // ascensor
    const ascMarco = new THREE.Group(); ascMarco.position.set(-22.0, 0, 9.5);
    ascMarco.add(malla(new THREE.BoxGeometry(0.2, 2.6, 1.9), mat(0x9aa3ad, 0.25, { metalness: 0.8 }), [0, 1.3, 0]));
    const puertaMat = mat(0xc5ccd4, 0.2, { metalness: 0.85 });
    [-0.42, 0.42].forEach((z) => { const p = malla(new THREE.BoxGeometry(0.06, 2.3, 0.84), puertaMat, [0.12, 1.15, z]); ascMarco.add(p); this.puertasAscensor.push(p); });
    ascMarco.add(malla(new THREE.BoxGeometry(0.05, 0.25, 0.6), mat(0x111111, 0.3, { emissive: 0xff3322, emissiveIntensity: 1.2 }), [0.13, 2.75, 0]));
    E.add(ascMarco);

    // TV de eventos en directo, reloj LED rojo y cartel
    const ct = document.createElement("canvas"); ct.width = 1024; ct.height = 576; this.tv = { c: ct, t: new THREE.CanvasTexture(ct) }; this.tv.t.colorSpace = THREE.SRGBColorSpace;
    E.add(malla(new THREE.BoxGeometry(3.45, 2.0, 0.1), mat(0x0c0c0c, 0.3), [-10, 2.2, -13.95], false));
    const tvp = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.86), new THREE.MeshBasicMaterial({ map: this.tv.t, toneMapped: false })); tvp.position.set(-10, 2.2, -13.89); E.add(tvp);
    const cl = document.createElement("canvas"); cl.width = 640; cl.height = 200; this.led = { c: cl, t: new THREE.CanvasTexture(cl) }; this.led.t.colorSpace = THREE.SRGBColorSpace;
    E.add(malla(new THREE.BoxGeometry(2.9, 0.95, 0.1), mat(0x0a0000, 0.3), [9, 2.55, -13.95], false));
    const ledp = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 0.86), new THREE.MeshBasicMaterial({ map: this.led.t, toneMapped: false })); ledp.position.set(9, 2.55, -13.89); E.add(ledp);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.6), new THREE.MeshBasicMaterial({ map: texturaTexto([{ t: "OficioYa", size: 96, color: "#E8862A" }], 640, 150, "#ffffff"), toneMapped: false }));
    logo.position.set(-10, 3.5, -13.98); E.add(logo);
    // rótulos en el suelo
    const rotulo = (t: string, x: number, z: number, w = 5) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: texturaTexto([{ t, size: 70, color: "rgba(255,255,255,0.85)" }], 640, 160), transparent: true, opacity: 0.55, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.015, z); E.add(m); };
    rotulo("MARKETING", -9, -3.4); rotulo("CIBERSEGURIDAD", 10.3, -3.4, 6); rotulo("SALA DE REUNIONES", 0, -7.2, 6); rotulo("DIRECCIÓN", 16.8, -7.0); rotulo("CAFETERÍA", -17.8, -9.4); rotulo("DESCANSO", -17.8, 8.6); rotulo("PRÓXIMOS DEPARTAMENTOS", 0.5, 10.6, 8);
    // plantas sueltas y lámparas colgantes
    [[-13.5, 2.5], [4.5, -2.5], [15.5, 2.0], [-2, 3.2], [20.5, 8.5], [-13, 11.5], [14, 11.5]].forEach(([x, z]) => this.planta(x, z));
    for (const id of ["marketing", "supervisor", "ciberseguridad", "auditor", "asistente"]) { const m = MESAS[id]; this.colgante(m.x, m.z); }
    this.colgante(-1.4, -10.2); this.colgante(1.4, -10.2);
  }
  salaCristal(x0: number, x1: number, z0: number, z1: number, puertaX: number) {
    const vidrio = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0.2, depthWrite: false });
    const marco = mat(0x3a4150, 0.4);
    const E = this.escena;
    const panel = (w: number, x: number, z: number, rot: number) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
      g.add(malla(new THREE.BoxGeometry(w, 2.6, 0.04), vidrio, [0, 1.3, 0], false));
      g.add(malla(new THREE.BoxGeometry(w, 0.06, 0.08), marco, [0, 2.6, 0], false)); g.add(malla(new THREE.BoxGeometry(w, 0.06, 0.08), marco, [0, 0.03, 0], false));
      E.add(g);
    };
    panel(z0 - z1 < 0 ? z1 - z0 : z0 - z1, x0, (z0 + z1) / 2, Math.PI / 2);
    panel(Math.abs(z1 - z0), x1, (z0 + z1) / 2, Math.PI / 2);
    const izq = puertaX - 0.8 - x0, der = x1 - (puertaX + 0.8);
    if (izq > 0) panel(izq, x0 + izq / 2, z1, 0);
    if (der > 0) panel(der, x1 - der / 2, z1, 0);
    [puertaX - 0.8, puertaX + 0.8].forEach((x) => E.add(malla(new THREE.BoxGeometry(0.08, 2.6, 0.1), marco, [x, 1.3, z1], false)));
  }
  silla(x: number, z: number, rot: number, color: number) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const m = mat(color, 0.7);
    g.add(malla(new THREE.BoxGeometry(0.52, 0.08, 0.5), m, [0, 0.47, 0])); g.add(malla(new THREE.BoxGeometry(0.52, 0.6, 0.08), m, [0, 0.82, -0.25]));
    g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), mat(0x2a2a2a, 0.3), [0, 0.24, 0]));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const p = malla(new THREE.BoxGeometry(0.05, 0.04, 0.3), mat(0x2a2a2a, 0.3), [Math.sin(a) * 0.15, 0.04, Math.cos(a) * 0.15]); p.rotation.y = a; g.add(p); }
    this.escena.add(g);
  }
  alfombra(x: number, z: number, w: number, d: number, color: number) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color, 1)); a.rotation.x = -Math.PI / 2; a.position.set(x, 0.01, z); a.receiveShadow = true; this.escena.add(a);
  }
  planta(x: number, z: number) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    g.add(malla(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 16), mat(0xb5653a, 0.8), [0, 0.25, 0]));
    const verde = [0x2f7d32, 0x3e9b43, 0x2b6e2e];
    for (let i = 0; i < 6; i++) { const h = malla(new THREE.IcosahedronGeometry(0.3 - i * 0.02, 0), mat(verde[i % 3], 0.85, { flatShading: true }), [Math.sin(i * 2.1) * 0.18, 0.75 + i * 0.13, Math.cos(i * 2.1) * 0.18]); g.add(h); }
    this.escena.add(g);
  }
  colgante(x: number, z: number) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    g.add(malla(new THREE.CylinderGeometry(0.006, 0.006, 1.0, 4), mat(0x111111, 0.3), [0, 3.5, 0], false));
    g.add(malla(new THREE.ConeGeometry(0.32, 0.28, 20, 1, true), mat(0x1f2937, 0.4, { side: THREE.DoubleSide }), [0, 2.95, 0], false));
    g.add(malla(new THREE.SphereGeometry(0.09, 10, 8), mat(0xffffff, 0.2, { emissive: 0xffe2b0, emissiveIntensity: 1.6 }), [0, 2.85, 0], false));
    this.escena.add(g);
  }
  mesa(id: string) {
    const m = MESAS[id]; const E = this.escena;
    const g = new THREE.Group(); g.position.set(m.x, 0, m.z);
    g.add(malla(new THREE.BoxGeometry(1.75, 0.06, 0.85), mat(0xc79a6b, 0.45), [0, 0.75, 0]));
    [[-0.8, -0.36], [0.8, -0.36], [-0.8, 0.36], [0.8, 0.36]].forEach(([x, z]) => g.add(malla(new THREE.BoxGeometry(0.05, 0.75, 0.05), mat(0x2a2d33, 0.3), [x, 0.375, z])));
    g.add(malla(new THREE.BoxGeometry(1.7, 0.45, 0.03), mat(0xb08457, 0.5), [0, 0.5, 0.41]));
    // portátil mirando a la silla (la silla queda en -z)
    g.add(malla(new THREE.BoxGeometry(0.46, 0.022, 0.32), mat(0x3a3f47, 0.3, { metalness: 0.6 }), [0, 0.79, -0.08]));
    const tapa = new THREE.Group(); tapa.position.set(0, 0.8, 0.08); tapa.rotation.x = 0.28;
    tapa.add(malla(new THREE.BoxGeometry(0.46, 0.3, 0.016), mat(0x3a3f47, 0.3, { metalness: 0.6 }), [0, 0.15, 0]));
    const pantallaMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: 0x112233, emissiveIntensity: 0.4, roughness: 0.3 });
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), pantallaMat); pantalla.position.set(0, 0.15, -0.009); pantalla.rotation.y = Math.PI; tapa.add(pantalla);
    g.add(tapa);
    // lámpara, papeles, nombre y taza
    const lamparaMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc870, emissiveIntensity: 0.0, roughness: 0.5 });
    g.add(malla(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 12), mat(0x222222, 0.3), [0.65, 0.79, 0.25]));
    g.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 6), mat(0x222222, 0.3), [0.65, 0.98, 0.25]));
    g.add(malla(new THREE.ConeGeometry(0.11, 0.13, 14, 1, true), lamparaMat, [0.65, 1.17, 0.2]));
    g.add(malla(new THREE.BoxGeometry(0.3, 0.012, 0.22), mat(0xffffff, 0.8), [-0.55, 0.785, 0.05]));
    g.add(malla(new THREE.BoxGeometry(0.28, 0.012, 0.2), mat(0xf6f2e6, 0.8), [-0.52, 0.797, 0.08]));
    const taza = new THREE.Group(); taza.position.set(0.42, 0.84, -0.18);
    taza.add(malla(new THREE.CylinderGeometry(0.05, 0.044, 0.1, 14), mat(0xffffff, 0.3)));
    taza.add(malla(new THREE.CylinderGeometry(0.044, 0.044, 0.005, 14), mat(0x3b2412, 0.3), [0, 0.048, 0]));
    const humo: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); h.position.set(0, 0.1 + i * 0.07, 0); taza.add(h); humo.push(h); }
    taza.visible = false; g.add(taza);
    E.add(g);
    this.silla(m.x, m.z - 0.82, 0, 0x2f3a4d);
    this.mesas.set(id, { pantalla: pantallaMat, taza, humo, lampara: lamparaMat });
  }

  // ------- Cielo de Sevilla según la hora -------
  pintarCielo(h: number) {
    const hb = Math.floor(h * 2) / 2;
    if (hb === this.cielo.hora) return; this.cielo.hora = hb;
    const g = this.cielo.c.getContext("2d")!; const W = 2048, H = 512;
    const noche = h < 6.5 || h >= 21, alba = h >= 6.5 && h < 8.5, tarde = h >= 18.5 && h < 21;
    const grad = g.createLinearGradient(0, 0, 0, H);
    if (noche) { grad.addColorStop(0, "#050914"); grad.addColorStop(1, "#1a2440"); }
    else if (alba) { grad.addColorStop(0, "#3d5a9e"); grad.addColorStop(0.6, "#f2a46b"); grad.addColorStop(1, "#ffd59e"); }
    else if (tarde) { grad.addColorStop(0, "#2b2d6e"); grad.addColorStop(0.55, "#d9667a"); grad.addColorStop(1, "#ffb36b"); }
    else { grad.addColorStop(0, "#5aa6ec"); grad.addColorStop(1, "#cfe8fb"); }
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    if (noche) for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + ((i * 17) % 7) / 10})`; g.fillRect((i * 337) % W, (i * 131) % (H * 0.55), 2, 2); }
    else { g.fillStyle = alba || tarde ? "rgba(255,230,180,0.95)" : "rgba(255,255,230,0.95)"; g.beginPath(); g.arc(alba ? 300 : tarde ? 1700 : 1000, alba || tarde ? 330 : 90, 46, 0, Math.PI * 2); g.fill(); }
    let rnd = 7; const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
    const capas = [{ y: 330, h: 120, c: noche ? "#141b2e" : "#7d8ea6" }, { y: 380, h: 110, c: noche ? "#0d1220" : "#5c6b80" }];
    for (const capa of capas) {
      let x = 0;
      while (x < W) {
        const w = 40 + r() * 90, hh = capa.h * (0.35 + r());
        g.fillStyle = capa.c; g.fillRect(x, capa.y - hh, w, H);
        if (noche) for (let wy = capa.y - hh + 10; wy < H - 20; wy += 16) for (let wx = x + 8; wx < x + w - 8; wx += 14) if (r() > 0.55) { g.fillStyle = "rgba(255,210,120,0.85)"; g.fillRect(wx, wy, 6, 8); }
        x += w + 4;
      }
    }
    // la Giralda
    const gx = 1250, base = 420; g.fillStyle = noche ? "#0a0f1c" : "#c9a06a";
    g.fillRect(gx, base - 260, 60, 260); g.fillRect(gx + 8, base - 310, 44, 50); g.fillRect(gx + 16, base - 345, 28, 35);
    g.beginPath(); g.moveTo(gx + 22, base - 345); g.lineTo(gx + 30, base - 375); g.lineTo(gx + 38, base - 345); g.fill();
    if (noche) { g.fillStyle = "rgba(255,200,120,0.5)"; g.fillRect(gx + 10, base - 300, 40, 30); }
    this.cielo.t.needsUpdate = true;
  }
  pintarLed(texto: string) {
    const g = this.led.c.getContext("2d")!;
    g.fillStyle = "#0a0000"; g.fillRect(0, 0, 640, 200);
    g.font = "800 132px 'Courier New', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = "#ff1a1a"; g.shadowBlur = 28; g.fillStyle = "#ff2b2b"; g.fillText(texto, 320, 104);
    g.shadowBlur = 0; g.fillStyle = "rgba(255,80,80,0.12)"; g.fillText("88:88:88", 320, 104);
    this.led.t.needsUpdate = true;
  }
  pintarTv() {
    const g = this.tv.c.getContext("2d")!; const d = this.datos;
    const grad = g.createLinearGradient(0, 0, 0, 576); grad.addColorStop(0, "#0d1730"); grad.addColorStop(1, "#060a14"); g.fillStyle = grad; g.fillRect(0, 0, 1024, 576);
    g.fillStyle = "#e8862a"; g.fillRect(0, 0, 1024, 70);
    g.fillStyle = "#fff"; g.font = "800 38px system-ui"; g.textBaseline = "middle"; g.textAlign = "left"; g.fillText("● EN DIRECTO · OficioYa", 28, 36);
    g.textAlign = "right"; g.font = "700 30px system-ui"; g.fillText(horaMadrid().texto.slice(0, 5), 996, 36);
    g.textAlign = "left";
    const ev = (d?.eventos || []).slice(0, 6);
    if (!ev.length) { g.fillStyle = "#8fa3c4"; g.font = "600 30px system-ui"; g.fillText("Esperando novedades del negocio…", 34, 140); }
    ev.forEach((e, i) => {
      const y = 112 + i * 64;
      g.fillStyle = i % 2 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)"; g.fillRect(20, y - 28, 984, 58);
      g.fillStyle = "#7f93b5"; g.font = "600 24px system-ui"; g.fillText(new Date(e.created_at).toLocaleTimeString("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }), 34, y);
      g.fillStyle = "#eaf1ff"; g.font = "700 27px system-ui";
      const t = e.titulo.length > 52 ? e.titulo.slice(0, 51) + "…" : e.titulo; g.fillText(t, 120, y);
    });
    const o = d?.objetivo;
    if (o && o.objetivo > 0) {
      const p = Math.min(1, o.actual / o.objetivo);
      g.fillStyle = "#8fa3c4"; g.font = "700 24px system-ui"; g.fillText(`Objetivo del mes: ${Math.round(o.actual).toLocaleString("es-ES")} € de ${Math.round(o.objetivo).toLocaleString("es-ES")} €`, 34, 520);
      g.fillStyle = "#1c2742"; g.fillRect(560, 506, 430, 28); g.fillStyle = p >= 1 ? "#22c55e" : "#e8862a"; g.fillRect(560, 506, 430 * p, 28);
    }
    this.tv.t.needsUpdate = true;
  }
  pintarPlan() {
    const g = this.plan.c.getContext("2d")!; const d = this.datos;
    g.fillStyle = "#f7f5ef"; g.fillRect(0, 0, 1024, 640);
    g.fillStyle = "#1f2937"; g.font = "800 46px system-ui"; g.textAlign = "left"; g.textBaseline = "top"; g.fillText("📋 PLAN DEL DÍA", 40, 30);
    g.fillStyle = "#e8862a"; g.fillRect(40, 92, 944, 5);
    const envolver = (texto: string, x: number, y: number, ancho: number, alto: number, max: number) => {
      const palabras = texto.split(" "); let linea = "", n = 0;
      for (const w of palabras) { const prueba = linea ? linea + " " + w : w; if (g.measureText(prueba).width > ancho && linea) { g.fillText(linea, x, y + n * alto); linea = w; n++; if (n >= max) return n; } else linea = prueba; }
      if (linea && n < max) { g.fillText(linea, x, y + n * alto); n++; } return n;
    };
    if (!d?.foco) { g.fillStyle = "#6b7280"; g.font = "600 34px system-ui"; g.fillText("Dirección lo prepara a las 6:00", 40, 130); this.plan.t.needsUpdate = true; return; }
    g.fillStyle = "#111827"; g.font = "700 34px system-ui"; const n = envolver("🎯 " + d.foco, 40, 120, 944, 44, 3);
    let y = 130 + n * 44 + 16;
    g.font = "600 28px system-ui"; g.fillStyle = "#374151";
    for (const t of d.tareasPlan.slice(0, 6)) { if (y > 590) break; const k = envolver("• " + t.texto, 40, y, 944, 36, 2); y += k * 36 + 8; }
    this.plan.t.needsUpdate = true;
  }

  setDatos(d: DatosOficina) {
    this.datos = d;
    const { h } = horaMadrid();
    for (const p of d.personas) {
      if (!p.activo) { this.etiquetaVacante(p); continue; }
      let per = this.personas.get(p.id);
      if (!per) {
        per = new Personaje(p.id, this.escena);
        this.personas.set(p.id, per);
        per.cafeHecho = p.cafe ? p.cafeClave : "";
        const des = this.decidir(per, p, h);
        if (des.clave !== "casa") per.colocar(des);
      }
      this.vacantes.get(p.id)?.remove(); this.vacantes.delete(p.id);
    }
    this.pintarTv(); this.pintarPlan();
  }
  etiquetaVacante(p: PersonaOficina) {
    if (this.vacantes.has(p.id) || !MESAS[p.id]) return;
    const el = document.createElement("div");
    el.className = "oy3d-vacante"; el.textContent = "🪑 " + p.nombre + " · próximamente";
    this.capa.appendChild(el); this.vacantes.set(p.id, el);
  }

  // Qué debería estar haciendo ahora cada uno
  decidir(per: Personaje, p: PersonaOficina, h: number): Destino {
    const d = this.datos!;
    const trabajando = p.estado === "trabajando";
    if (!enJornada(h) && !trabajando) return destinoAscensor();
    if (d.reunion) {
      const activos = d.personas.filter((x) => x.activo);
      const orden = ["direccion", ...activos.map((x) => x.id).filter((x) => x !== "direccion")];
      return destinoReunion(Math.max(0, orden.indexOf(p.id)));
    }
    if (p.cafe && per.cafeHecho !== p.cafeClave) return destinoCafe(["marketing", "ciberseguridad", "direccion"].includes(p.id) ? 0 : 1);
    if (p.id === "asistente") return this.rondaAsistente(p);
    if (trabajando && VISITAS[p.id] && (p.tipo === "revision" || (p.id === "auditor" && p.tipo === "diario"))) return destinoVisita(VISITAS[p.id]);
    if (p.estado === "descansando" && !trabajando) {
      const libres = ["supervisor", "auditor", "marketing", "ciberseguridad", "direccion"];
      return destinoSofa(Math.max(0, libres.indexOf(p.id)) % 3);
    }
    return destinoMesa(p.id);
  }

  // La Asistente nunca se queda quieta mucho rato: recorre las mesas recogiendo novedades y se las lleva a Dirección.
  // Cuando está preparando un boletín o un dossier va más deprisa de mesa en mesa.
  rondaAsistente(p: PersonaOficina): Destino {
    const companeros = this.datos!.personas.filter((x) => x.activo && x.id !== "asistente" && x.id !== "direccion" && MESAS[x.id]).map((x) => x.id);
    const trabajando = p.estado === "trabajando";
    const paradas = trabajando
      ? [...companeros, "direccion"]
      : ["mesa", ...companeros.slice(0, 2), "direccion", "mesa", ...companeros.slice(2), "direccion"];
    const periodo = trabajando ? 14 : 24;
    const objetivo = paradas[Math.floor(performance.now() / 1000 / periodo) % paradas.length];
    return objetivo === "mesa" ? destinoMesa("asistente") : destinoRecado(objetivo);
  }

  // ------- Bucle -------
  bucle = () => {
    this.raf = requestAnimationFrame(this.bucle);
    if (document.hidden) return;
    const dt = Math.min(0.05, this.reloj.getDelta()); const t = this.reloj.elapsedTime;
    const hm = horaMadrid();
    if (hm.s !== this.ultimoSegundo) { this.ultimoSegundo = hm.s; this.pintarLed(hm.texto); this.pintarCielo(hm.frac); this.luzDelDia(hm.frac); if (t - this.ultimoTv > 30) { this.ultimoTv = t; this.pintarTv(); } }
    const d = this.datos;
    let cercaAscensor = false;
    if (d) for (const p of d.personas) {
      const per = this.personas.get(p.id); if (!per || !p.activo) continue;
      const des = this.decidir(per, p, hm.h);
      if (des.clave !== per.destino.clave) {
        if (per.enCasa && des.clave !== "casa") { per.colocar(destinoAscensor()); per.raiz.visible = true; per.enCasa = false; }
        if (!per.enCasa) per.ir(des);
      }
      this.animar(per, p, dt, t);
      if (per.raiz.visible && per.raiz.position.distanceTo(ASCENSOR) < 2.2) cercaAscensor = true;
      const mesa = this.mesas.get(p.id);
      if (mesa) {
        const jornada = enJornada(hm.h);
        const trabajando = p.estado === "trabajando";
        mesa.pantalla.emissive.set(trabajando ? p.color : "#1d3557");
        mesa.pantalla.emissiveIntensity = !jornada && !trabajando ? 0.02 : trabajando ? 1.1 + Math.sin(t * 6) * 0.25 : 0.35;
        mesa.lampara.emissiveIntensity = jornada && (hm.frac >= 19 || hm.frac < 8) ? 1.6 : 0.05;
        const tazaEnMesa = p.cafe && per.cafeHecho === p.cafeClave && per.destino.clave === "mesa" && !per.andando;
        mesa.taza.visible = tazaEnMesa;
        if (tazaEnMesa) mesa.humo.forEach((hh, i) => { const k = (t * 0.6 + i / 3) % 1; hh.position.y = 0.07 + k * 0.22; hh.position.x = Math.sin(t * 2 + i) * 0.02; (hh.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k); });
      }
    }
    this.puertasAscensor.forEach((pu, i) => { const objetivo = cercaAscensor ? (i ? 0.95 : -0.95) : (i ? 0.42 : -0.42); pu.position.z += (objetivo - pu.position.z) * Math.min(1, dt * 4); });
    this.controles.update();
    this.renderer.render(this.escena, this.camara);
    this.actualizarPantallas();
  };

  luzDelDia(h: number) {
    const jornada = enJornada(h);
    let sol = 0;
    if (h >= 7 && h < 19) sol = 1; else if (h >= 6 && h < 7) sol = h - 6; else if (h >= 19 && h < 21) sol = 1 - (h - 19) / 2;
    this.sol.intensity = 0.25 + sol * 2.4;
    this.sol.color.set(sol < 0.6 ? 0xffc89a : 0xfff1dc);
    const interior = jornada ? (sol < 0.7 ? 1 : 0.35) : 0.12;
    this.hemi.intensity = (jornada ? 0.5 : 0.18) + sol * 0.9;
    this.amb.intensity = jornada ? 0.25 + interior * 0.2 : 0.1;
    this.puntos.forEach((p) => (p.intensity = jornada ? interior * 22 : 0));
    this.renderer.toneMappingExposure = jornada ? 1.05 : 0.75;
  }

  animar(per: Personaje, p: PersonaOficina, dt: number, t: number) {
    if (!per.raiz.visible) return;
    const trabajando = p.estado === "trabajando";
    const potenciado = trabajando && p.cafe;
    // desplazamiento
    if (per.camino.length) {
      const objetivo = per.camino[0];
      const pos = per.raiz.position;
      const dx = objetivo.x - pos.x, dz = objetivo.z - pos.z; const dist = Math.hypot(dx, dz);
      const vel = (potenciado ? 2.0 : 1.4) * dt;
      if (dist <= vel) { pos.x = objetivo.x; pos.z = objetivo.z; per.camino.shift(); }
      else { pos.x += (dx / dist) * vel; pos.z += (dz / dist) * vel; }
      const ang = Math.atan2(dx, dz);
      let dif = ang - per.rot; while (dif > Math.PI) dif -= Math.PI * 2; while (dif < -Math.PI) dif += Math.PI * 2;
      per.rot += dif * Math.min(1, dt * 10);
      if (!per.camino.length) {
        per.ubicacion = per.destino;
        if (per.destino.clave === "casa") { per.raiz.visible = false; per.enCasa = true; return; }
        if (per.destino.clave === "cafe") per.bebiendo = 7;
      }
      per.fase += dt * (potenciado ? 11 : 8.5);
      const s = Math.sin(per.fase);
      per.musloI.rotation.x = s * 0.6; per.musloD.rotation.x = -s * 0.6;
      per.rodillaI.rotation.x = Math.max(0, -s) * 0.7; per.rodillaD.rotation.x = Math.max(0, s) * 0.7;
      per.hombroI.rotation.set(-s * 0.55, 0, 0.08); per.hombroD.rotation.set(s * 0.55, 0, -0.08);
      per.codoI.rotation.x = -0.35; per.codoD.rotation.x = per.tazaMano.visible ? -1.2 : -0.35;
      per.cuerpo.position.y = Math.abs(Math.cos(per.fase)) * 0.04;
      per.cuerpo.rotation.x = 0.04; per.cabeza.rotation.set(0, 0, 0);
    } else {
      // girar a la orientación final
      let dif = per.destino.rot - per.rot; while (dif > Math.PI) dif -= Math.PI * 2; while (dif < -Math.PI) dif += Math.PI * 2;
      per.rot += dif * Math.min(1, dt * 6);
      per.cuerpo.position.y = 0; per.cuerpo.rotation.x = 0;
      const sentado = per.destino.pose === "sentado";
      if (sentado) {
        per.musloI.rotation.x = per.musloD.rotation.x = -1.5; per.rodillaI.rotation.x = per.rodillaD.rotation.x = 1.45;
        per.cuerpo.position.y = per.destino.clave.startsWith("sofa") ? -0.08 : -0.02;
      } else { per.musloI.rotation.x = per.musloD.rotation.x = 0; per.rodillaI.rotation.x = per.rodillaD.rotation.x = 0; }
      const enMesa = per.destino.clave === "mesa";
      const durmiendo = per.destino.clave.startsWith("sofa");
      const visitando = per.destino.clave.startsWith("visita");
      const reunido = per.destino.clave.startsWith("reunion");
      // café en la cafetera
      if (per.destino.clave === "cafe") {
        per.bebiendo -= dt; per.tazaMano.visible = true;
        const sorbo = (t % 3) < 1.1;
        per.hombroD.rotation.set(sorbo ? -1.35 : -0.5, 0, -0.15); per.codoD.rotation.x = sorbo ? -1.9 : -1.3;
        per.hombroI.rotation.set(0.05, 0, 0.1); per.codoI.rotation.x = -0.2;
        per.cabeza.rotation.set(sorbo ? -0.2 : 0, 0, 0);
        if (per.bebiendo <= 0) { per.cafeHecho = p.cafeClave; }
      } else if (enMesa && trabajando) {
        per.tazaMano.visible = false;
        const vel = potenciado ? 26 : 16, amp = potenciado ? 0.11 : 0.07;
        per.hombroI.rotation.set(-0.95 + Math.sin(t * vel) * amp, 0, 0.12); per.hombroD.rotation.set(-0.95 + Math.sin(t * vel + 1.7) * amp, 0, -0.12);
        per.codoI.rotation.x = -0.6; per.codoD.rotation.x = -0.6;
        per.cabeza.rotation.set(0.12 + Math.sin(t * 3) * 0.03, Math.sin(t * 0.7 + per.semilla) * 0.08, 0);
      } else if (durmiendo) {
        per.tazaMano.visible = false;
        per.cuerpo.rotation.x = -0.3;
        per.hombroI.rotation.set(-0.3, 0, 0.35); per.hombroD.rotation.set(-0.3, 0, -0.35); per.codoI.rotation.x = per.codoD.rotation.x = -0.8;
        per.cabeza.rotation.set(0.25 + Math.sin(t * 1.2) * 0.04, 0, 0.35);
      } else if (visitando) {
        per.tazaMano.visible = false;
        per.hombroI.rotation.set(-0.7, 0, 0.55); per.hombroD.rotation.set(-0.7, 0, -0.55); per.codoI.rotation.x = per.codoD.rotation.x = -1.7;
        per.cuerpo.rotation.x = 0.12; per.cabeza.rotation.set(0.3 + Math.sin(t * 2) * 0.05, Math.sin(t * 0.8) * 0.15, 0);
      } else {
        // en su mesa sin turno, o en la reunión: atento, con micro movimientos y algún estiramiento
        per.tazaMano.visible = false;
        per.estiramiento -= dt;
        if (per.estiramiento <= 0 && per.estirando <= 0 && enMesa) { per.estirando = 2.4; per.estiramiento = 50 + Math.random() * 70; }
        if (per.estirando > 0) {
          per.estirando -= dt; const k = Math.sin(Math.min(1, (2.4 - per.estirando) / 0.5) * Math.PI / 2);
          per.hombroI.rotation.set(-2.9 * k, 0, 0.2); per.hombroD.rotation.set(-2.9 * k, 0, -0.2); per.codoI.rotation.x = per.codoD.rotation.x = -0.3 * k;
          per.cabeza.rotation.set(-0.25 * k, 0, 0);
        } else {
          per.hombroI.rotation.set(sentado ? -0.75 : 0.05, 0, 0.1); per.hombroD.rotation.set(sentado ? -0.75 : 0.05, 0, -0.1);
          per.codoI.rotation.x = per.codoD.rotation.x = sentado ? -0.6 : -0.15;
          const mira = reunido ? Math.sin(t * 0.5 + per.semilla) * 0.5 : Math.sin(t * 0.35 + per.semilla) * 0.3;
          per.cabeza.rotation.set(0.04, mira, 0);
        }
      }
      per.torso.scale.y = 1 + Math.sin(t * 2.1 + per.semilla) * 0.012;
    }
    per.raiz.rotation.y = per.rot;
    // parpadeo (y ojos cerrados al dormir)
    per.parpadeo -= dt;
    if (per.parpadeo <= 0) { per.parpadeando = 0.13; per.parpadeo = 2.5 + Math.random() * 3.5; }
    if (per.parpadeando > 0) per.parpadeando -= dt;
    const cerrados = per.destino.clave.startsWith("sofa") && !per.andando;
    per.ojos.forEach((o) => (o.scale.y = cerrados || per.parpadeando > 0 ? 0.12 : 1));
    // aura del café mientras trabaja potenciado
    const aura = per.aura.material as THREE.MeshBasicMaterial;
    aura.opacity = potenciado && !per.andando ? 0.35 + Math.sin(t * 5) * 0.15 : 0;
    per.aura.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
  }

  textoPantalla(p: PersonaOficina, per: Personaje) {
    const d = this.datos!;
    const corto = (s: string | null | undefined, n: number) => (s ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : "");
    const clave = per.destino.clave;
    if (p.id === "asistente" && !clave.startsWith("reunion") && clave !== "casa" && clave !== "cafe") {
      const quien = clave.startsWith("recado:") ? clave.slice(7) : null;
      const nombre = (id: string) => d.personas.find((x) => x.id === id)?.nombre || id;
      if (p.estado === "trabajando") return { icono: per.andando ? "📨" : "📝", texto: corto(p.paso || "Preparando novedades para Dirección", 70), vivo: corto(p.progreso, 120), barra: 100 };
      if (quien === "direccion") return { icono: "📨", texto: per.andando ? "Lleva las novedades a Dirección" : "Dando el parte a Dirección", vivo: corto(p.ultimo, 110), barra: -1 };
      if (quien) return { icono: "📥", texto: (per.andando ? "Va a ver a " : "Recogiendo novedades de ") + nombre(quien), vivo: "", barra: -1 };
      return { icono: "🗂️", texto: per.andando ? "Vuelve a su mesa a ordenar la información" : "Ordenando la información en su mesa", vivo: corto(p.ultimo, 110), barra: -1 };
    }
    if (per.andando) {
      if (per.destino.clave === "cafe") return { icono: "☕", texto: "Va a por un café", vivo: "" , barra: -1 };
      if (per.destino.clave === "casa") return { icono: "🏠", texto: "Se va a casa: fin de la jornada", vivo: "", barra: -1 };
      if (per.destino.clave.startsWith("reunion")) return { icono: "📋", texto: d.reunion === "reunion" ? "Va a la reunión semanal" : "Va al plan del día con Dirección", vivo: "", barra: -1 };
      if (per.destino.clave.startsWith("visita")) return { icono: "🔍", texto: "Va a revisar a su compañero", vivo: "", barra: -1 };
      if (per.ubicacion.clave === "casa") return { icono: "👋", texto: "Llega a la oficina", vivo: "", barra: -1 };
      return { icono: "🚶", texto: "Vuelve a su mesa", vivo: "", barra: -1 };
    }
    if (per.destino.clave === "cafe") return { icono: "☕", texto: "Tomándose un café: su próximo trabajo será a fondo", vivo: "", barra: -1 };
    if (per.destino.clave.startsWith("reunion")) return { icono: "📋", texto: d.reunion === "reunion" ? "En la reunión semanal" : "Planificando el día con Dirección", vivo: p.estado === "trabajando" ? corto(p.progreso || p.paso, 110) : "", barra: -1 };
    if (p.estado === "trabajando") {
      const icono = per.destino.clave.startsWith("visita") ? "🔍" : "💭";
      return { icono, texto: corto(p.paso || "Trabajando", 70), vivo: corto(p.progreso, 120), barra: p.cafe ? 150 : 100 };
    }
    if (p.estado === "error") return { icono: "⚠️", texto: "Su último trabajo falló", vivo: "", barra: -1 };
    if (per.destino.clave.startsWith("sofa")) return { icono: "😴", texto: "Descansando: no hay cambios en sus datos", vivo: "", barra: -1 };
    if (p.tarea) return { icono: "📋", texto: "Hoy: " + corto(p.tarea, 90), vivo: "", barra: -1 };
    return { icono: "✔", texto: corto(p.ultimo || "Esperando su turno", 90), vivo: "", barra: -1 };
  }

  actualizarPantallas() {
    const d = this.datos; if (!d) return;
    const w = this.caja.clientWidth, h = this.caja.clientHeight;
    const v = new THREE.Vector3();
    for (const p of d.personas) {
      const per = this.personas.get(p.id);
      let el = this.pantallas.get(p.id);
      if (!per || !p.activo) continue;
      if (!el) {
        el = document.createElement("div"); el.className = "oy3d-pantalla"; el.style.setProperty("--c", p.color);
        el.addEventListener("click", () => this.onClick(p.id));
        this.capa.appendChild(el); this.pantallas.set(p.id, el);
      }
      if (!per.raiz.visible) { el.style.display = "none"; continue; }
      v.set(0, 2.25, 0); per.raiz.localToWorld(v);
      const dist = v.distanceTo(this.camara.position);
      v.project(this.camara);
      if (v.z > 1) { el.style.display = "none"; continue; }
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      const esc = Math.max(0.62, Math.min(1.05, 26 / dist));
      el.style.display = "block";
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${esc})`;
      el.style.zIndex = String(1000 - Math.round(dist * 10));
      const c = this.textoPantalla(p, per);
      const html = `<div class="cab"><span>${p.icono}</span><b>${p.nombre}</b>${p.estado === "trabajando" ? '<i class="vivo"></i>' : ""}</div>`
        + `<div class="txt">${c.icono} ${escapar(c.texto)}</div>`
        + (c.vivo ? `<div class="pens">«…${escapar(c.vivo)}<span class="cur">▌</span>»</div>` : "")
        + (c.barra > 0 ? `<div class="barra"><i style="width:${Math.min(100, c.barra)}%"></i><span>${c.barra > 100 ? "⚡ Potenciado por el café · 150%" : "Concentración 100%"}</span></div>` : "");
      if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    }
    // etiquetas de puestos libres
    for (const [id, el] of this.vacantes) {
      const m = MESAS[id]; v.set(m.x, 1.45, m.z); v.project(this.camara);
      if (v.z > 1) { el.style.display = "none"; continue; }
      el.style.display = "block";
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    }
  }

  // ------- Interacción -------
  alBajar = (e: PointerEvent) => { this.bajada = { x: e.clientX, y: e.clientY }; this.controles.autoRotate = false; };
  alSubir = (e: PointerEvent) => {
    if (!this.bajada || Math.hypot(e.clientX - this.bajada.x, e.clientY - this.bajada.y) > 6) { this.bajada = null; return; }
    this.bajada = null;
    const id = this.tocado(e); if (id) this.onClick(id);
  };
  alMover = (e: PointerEvent) => { this.renderer.domElement.style.cursor = this.tocado(e) ? "pointer" : "grab"; };
  tocado(e: PointerEvent): string | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.puntero, this.camara);
    const objetivos = [...this.personas.values()].filter((p) => p.raiz.visible).map((p) => p.golpe);
    const hit = this.raycaster.intersectObjects(objetivos, false)[0];
    return hit ? (hit.object.userData.persona as string) : null;
  }
  vistaGeneral() { this.camara.position.set(4, 24, 30); this.controles.target.set(0, 0, -1); }
  girar(v: boolean) { this.controles.autoRotate = v; }
  redimensionar = () => {
    const w = this.caja.clientWidth, h = this.caja.clientHeight;
    this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + "px"; this.renderer.domElement.style.height = h + "px";
    this.camara.aspect = w / Math.max(1, h); this.camara.updateProjectionMatrix();
  };
  destruir() {
    cancelAnimationFrame(this.raf);
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.alBajar); el.removeEventListener("pointerup", this.alSubir); el.removeEventListener("pointermove", this.alMover);
    this.controles.dispose();
    this.escena.traverse((o: J) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: J) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
    matCache.clear();
    this.renderer.dispose(); el.remove();
    this.capa.innerHTML = "";
  }
}
function escapar(s: string) { return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string)); }
export function hayWebGL() {
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch { return false; }
}

// ---------------- Componente React ----------------
export default function Oficina3D({ datos, alPulsar, alto = 560 }: { datos: DatosOficina; alPulsar: (id: string) => void; alto?: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const motor = useRef<Motor | null>(null);
  const pulsar = useRef(alPulsar); pulsar.current = alPulsar;
  const [girando, setGirando] = useState(false);
  const [fallo, setFallo] = useState("");
  useEffect(() => {
    if (!caja.current || !capa.current) return;
    let m: Motor | null = null;
    try { m = new Motor(caja.current, capa.current, (id) => pulsar.current(id)); motor.current = m; }
    catch (e) { setFallo(String((e as Error).message || e)); return; }
    const ro = new ResizeObserver(() => m?.redimensionar()); ro.observe(caja.current);
    return () => { ro.disconnect(); m?.destruir(); motor.current = null; };
  }, []);
  useEffect(() => { motor.current?.setDatos(datos); }, [datos]);
  if (fallo) return <div style={{ padding: 20, color: "#f87171", fontSize: 13 }}>No se pudo abrir la vista 3D en este dispositivo: {fallo}</div>;
  return (
    <div style={{ position: "relative", width: "100%", height: alto, borderRadius: 14, overflow: "hidden", border: "1px solid #232a3a", background: "#0e1320" }}>
      <style>{CSS}</style>
      <div ref={caja} style={{ position: "absolute", inset: 0 }} />
      <div ref={capa} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6 }}>
        <button className="oy3d-btn" onClick={() => motor.current?.vistaGeneral()}>🎥 Vista general</button>
        <button className="oy3d-btn" onClick={() => { const v = !girando; setGirando(v); motor.current?.girar(v); }}>{girando ? "⏸ Parar" : "🔄 Girar"}</button>
      </div>
      <div className="oy3d-ayuda">Arrastra para girar · rueda o pellizco para acercar · pulsa a cualquiera para hablar con él</div>
    </div>
  );
}

const CSS = `
.oy3d-pantalla{position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;min-width:150px;max-width:230px;background:rgba(7,11,20,.9);border:1px solid var(--c);border-radius:10px;padding:6px 9px 7px;color:#e6eefc;font:600 11px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 0 14px color-mix(in srgb,var(--c) 45%,transparent),0 6px 16px rgba(0,0,0,.45);transform-origin:50% 100%;will-change:transform}
.oy3d-pantalla::after{content:"";position:absolute;left:50%;bottom:-7px;margin-left:-6px;border:6px solid transparent;border-top-color:var(--c);border-bottom:0}
.oy3d-pantalla .cab{display:flex;align-items:center;gap:5px;font-size:11.5px;margin-bottom:3px}
.oy3d-pantalla .cab b{color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oy3d-pantalla .vivo{width:7px;height:7px;border-radius:50%;background:#22c55e;margin-left:auto;box-shadow:0 0 0 0 #22c55e88;animation:oy3dLat 1.3s infinite}
.oy3d-pantalla .txt{color:#c9d6ee}
.oy3d-pantalla .pens{margin-top:3px;color:#8ff7c0;font:500 10.5px/1.35 'Courier New',monospace;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.oy3d-pantalla .cur{animation:oy3dCur 1s infinite}
.oy3d-pantalla .barra{position:relative;margin-top:5px;height:13px;border-radius:99px;background:#1b2436;overflow:hidden}
.oy3d-pantalla .barra i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,var(--c),#ffd166);border-radius:99px}
.oy3d-pantalla .barra span{position:relative;display:block;text-align:center;font-size:9.5px;line-height:13px;color:#0b0f19;font-weight:800}
.oy3d-vacante{position:absolute;left:0;top:0;background:rgba(15,20,32,.75);border:1px dashed #475569;color:#94a3b8;border-radius:8px;padding:3px 8px;font:600 10.5px system-ui;white-space:nowrap}
.oy3d-btn{font:700 12px system-ui;padding:6px 11px;border-radius:99px;border:1px solid #334155;background:rgba(10,14,24,.8);color:#e2e8f0;cursor:pointer}
.oy3d-ayuda{position:absolute;left:10px;bottom:8px;font:600 11px system-ui;color:#94a3b8;background:rgba(10,14,24,.7);padding:4px 9px;border-radius:99px;pointer-events:none}
@keyframes oy3dLat{0%{box-shadow:0 0 0 0 #22c55e88}70%{box-shadow:0 0 0 6px #22c55e00}100%{box-shadow:0 0 0 0 #22c55e00}}
@keyframes oy3dCur{0%,49%{opacity:1}50%,100%{opacity:0}}
`;
