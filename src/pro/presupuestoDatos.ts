// ============================================================
// OficioYa · Presupuestos de pintura — datos, catálogo de trabajos y textos
// Lo usan el asistente (ProPresupuesto.tsx) y el PDF (presupuestoPdf.ts).
// Los textos detallados salen solos de las respuestas: es lo que hace que el
// cliente entienda qué paga (lo que mejor le funciona a Cándido en Valencia).
// ============================================================

export type Unidad = "m²" | "ml" | "ud" | "global";

export interface Marca {
  nombre: string;        // nombre comercial: «Reforma Zelaya»
  razon: string;         // razón social (opcional): «Reformas Zelaya, S.L.»
  nif: string;
  telefono: string;
  email: string;
  direccion: string;
  web: string;
  lema: string;          // «Su proyecto en buenas manos.»
  color: string;         // color principal del presupuesto (#RRGGBB)
  logo_url: string | null;
  precios?: Record<string, number>; // últimos precios que usó en cada trabajo
}

export interface Partida {
  id: string;
  tipo: string;          // id del catálogo (o «otro»)
  titulo: string;        // solo para «otro»; el resto sale del catálogo
  detalle: string;       // solo para «otro»
  cantidad: number;
  unidad: Unidad;
  precio: number;        // € por unidad, sin IVA
}

export interface Presupuesto {
  id?: string;
  lead_id: string | null;
  numero: string;
  fecha: string;          // AAAA-MM-DD
  validez_dias: number;
  cliente: { nombre: string; telefono: string; email: string; direccion: string; poblacion: string };
  obra: {
    inmueble: string;     // «Piso»
    estancias: Record<string, number>; // { salon: 1, dormitorio: 3 }
    m2_vivienda: string;  // m² de suelo (opcional, para calcular)
    ocupacion: string;    // «vacia» | «amueblada» | «habitada»
  };
  estado: string[];       // cómo están las paredes
  preparacion: string[];  // protecciones y trabajos previos incluidos
  materiales: {
    marca: string;
    tipo: string;         // «plastica» | «lavable» | «antimoho» | «ecologica»
    acabado: string;      // «mate» | «satinado» | «brillo»
    colores: string;      // «blanco» | «uno» | «varios» | «cliente»
    colores_txt: string;
    manos: number;
    imprimacion: boolean;
    material_incluido: boolean;
  };
  partidas: Partida[];
  descuento_pct: number;
  iva_pct: number;        // 21 | 10 | 0
  plazo_min: string;
  plazo_max: string;
  inicio: string;         // texto libre: «A convenir» o una fecha
  pago: string;           // id de FORMAS_PAGO o «otro»
  pago_txt: string;       // si es «otro»
  metodos: string[];      // transferencia, bizum, efectivo, tarjeta
  garantia: string;       // «1 año»
  no_incluye: string[];
  notas: string;
}

// ── CATÁLOGO DE TRABAJOS DE PINTURA ─────────────────────────
export interface TipoTrabajo {
  id: string;
  label: string;          // en el asistente
  titulo: string;         // en el desglose del PDF
  unidad: Unidad;
  pregunta: string;       // «¿Cuántos m² de pared?»
  ejemplo: number;        // precio de ejemplo (solo de pista, no se rellena solo)
  icono: string;
}

export const TRABAJOS: TipoTrabajo[] = [
  { id: "paredes", label: "Pintar paredes", titulo: "Pintura de paredes", unidad: "m²", pregunta: "¿Cuántos m² de pared?", ejemplo: 7, icono: "🧱" },
  { id: "techos", label: "Pintar techos", titulo: "Pintura de techos", unidad: "m²", pregunta: "¿Cuántos m² de techo?", ejemplo: 8, icono: "⬆️" },
  { id: "gotele", label: "Quitar gotelé / alisar", titulo: "Alisado sobre gotelé e imprimación", unidad: "m²", pregunta: "¿Cuántos m² de gotelé?", ejemplo: 15, icono: "✨" },
  { id: "grietas", label: "Grietas y desconchones", titulo: "Reparación de grietas y desperfectos", unidad: "global", pregunta: "Precio de la reparación", ejemplo: 150, icono: "🩹" },
  { id: "humedad", label: "Humedad / moho", titulo: "Tratamiento antihumedad y antimoho", unidad: "m²", pregunta: "¿Cuántos m² con humedad?", ejemplo: 14, icono: "💧" },
  { id: "puertas", label: "Lacar puertas", titulo: "Lacado de puertas con marco", unidad: "ud", pregunta: "¿Cuántas puertas?", ejemplo: 110, icono: "🚪" },
  { id: "ventanas", label: "Ventanas y carpintería", titulo: "Pintura de ventanas y carpintería", unidad: "ud", pregunta: "¿Cuántas ventanas?", ejemplo: 70, icono: "🪟" },
  { id: "radiadores", label: "Radiadores", titulo: "Pintura de radiadores", unidad: "ud", pregunta: "¿Cuántos radiadores?", ejemplo: 45, icono: "♨️" },
  { id: "rodapies", label: "Rodapiés", titulo: "Pintura de rodapiés", unidad: "ml", pregunta: "¿Cuántos metros lineales?", ejemplo: 5, icono: "📏" },
  { id: "rejas", label: "Rejas y barandillas", titulo: "Rejas, barandillas y cerrajería", unidad: "ml", pregunta: "¿Cuántos metros lineales?", ejemplo: 20, icono: "🔩" },
  { id: "fachada", label: "Fachada / exterior", titulo: "Pintura de fachada", unidad: "m²", pregunta: "¿Cuántos m² de fachada?", ejemplo: 16, icono: "🏠" },
  { id: "escalera", label: "Escalera / zonas comunes", titulo: "Escalera y zonas comunes", unidad: "m²", pregunta: "¿Cuántos m²?", ejemplo: 10, icono: "🪜" },
  { id: "papel", label: "Quitar papel pintado", titulo: "Retirada de papel pintado", unidad: "m²", pregunta: "¿Cuántos m² de papel?", ejemplo: 7, icono: "📜" },
];
export const TRABAJO: Record<string, TipoTrabajo> = TRABAJOS.reduce((a, t) => ({ ...a, [t.id]: t }), {} as any);

export const ESTANCIAS: { id: string; label: string; plural: string; contable: boolean }[] = [
  { id: "salon", label: "Salón", plural: "salones", contable: false },
  { id: "dormitorio", label: "Dormitorios", plural: "dormitorios", contable: true },
  { id: "cocina", label: "Cocina", plural: "cocinas", contable: false },
  { id: "bano", label: "Baños", plural: "baños", contable: true },
  { id: "pasillo", label: "Pasillo / recibidor", plural: "pasillos", contable: false },
  { id: "comedor", label: "Comedor", plural: "comedores", contable: false },
  { id: "terraza", label: "Terraza", plural: "terrazas", contable: false },
  { id: "escalera", label: "Escalera", plural: "escaleras", contable: false },
  { id: "garaje", label: "Garaje / trastero", plural: "garajes", contable: false },
];

export const INMUEBLES = ["Piso", "Casa / chalet", "Ático", "Local", "Oficina", "Comunidad", "Nave"];

export const ESTADOS_PARED = [
  { id: "bien", label: "Buen estado" },
  { id: "agujeros", label: "Agujeros y desconchones" },
  { id: "grietas", label: "Grietas o fisuras" },
  { id: "humedad", label: "Manchas de humedad o moho" },
  { id: "humo", label: "Manchas de humo o grasa" },
  { id: "levantada", label: "Pintura vieja que se levanta" },
  { id: "gotele", label: "Gotelé" },
  { id: "colores_fuertes", label: "Colores oscuros o fuertes" },
];

export const PREPARACION = [
  { id: "suelos", label: "Proteger suelos con plástico y cartón", incluye: "Protección de suelos con plástico y cartón" },
  { id: "muebles", label: "Tapar los muebles", incluye: "Protección de muebles y enseres" },
  { id: "encintado", label: "Encintar enchufes, marcos y carpinterías", incluye: "Encintado de enchufes, interruptores, marcos y carpinterías" },
  { id: "mover", label: "Mover y volver a colocar muebles", incluye: "Movimiento y recolocación de muebles dentro de la vivienda" },
  { id: "tapas", label: "Desmontar y montar tapas y lámparas", incluye: "Desmontaje y montaje de tapas de enchufes, interruptores y lámparas" },
  { id: "limpieza", label: "Limpieza final y retirada de residuos", incluye: "Limpieza final y retirada de residuos a punto limpio" },
  { id: "medios", label: "Andamios, escaleras y medios auxiliares", incluye: "Andamios, escaleras y medios auxiliares necesarios" },
];
export const PREPARACION_POR_DEFECTO = ["suelos", "muebles", "encintado", "limpieza"];

export const NO_INCLUYE = [
  "Trabajos no descritos en este presupuesto",
  "Albañilería, fontanería o electricidad",
  "Retirada de muebles fuera de la vivienda",
  "Licencias o permisos municipales",
  "Reparación de humedades de origen (filtraciones, tuberías)",
];
export const NO_INCLUYE_POR_DEFECTO = [NO_INCLUYE[0], NO_INCLUYE[1]];

export const MARCAS_PINTURA = ["Bruguer", "Titanlux", "Jotun", "Montó", "Isaval", "Valentine", "Procolor", "Sherwin-Williams", "Juno"];

export const TIPOS_PINTURA = [
  { id: "plastica", label: "Plástica de interior", txt: "pintura plástica" },
  { id: "lavable", label: "Lavable de alta calidad", txt: "pintura plástica lavable de alta calidad" },
  { id: "antimoho", label: "Antimoho / baños y cocinas", txt: "pintura antimoho" },
  { id: "ecologica", label: "Ecológica sin olor", txt: "pintura ecológica sin olor" },
];

export const ACABADOS = [
  { id: "mate", label: "Mate" },
  { id: "satinado", label: "Satinado" },
  { id: "brillo", label: "Brillo" },
];

export const COLORES = [
  { id: "blanco", label: "Blanco" },
  { id: "uno", label: "Un color" },
  { id: "varios", label: "Varios colores" },
  { id: "cliente", label: "Lo elige el cliente" },
];

export const FORMAS_PAGO: { id: string; label: string; tramos: [number, string][] }[] = [
  { id: "40-40-20", label: "40 % · 40 % · 20 %", tramos: [[40, "al inicio de la obra"], [40, "durante la ejecución"], [20, "al finalizar la obra"]] },
  { id: "50-50", label: "50 % · 50 %", tramos: [[50, "al inicio de la obra"], [50, "al finalizar la obra"]] },
  { id: "30-70", label: "30 % · 70 %", tramos: [[30, "al inicio de la obra"], [70, "al finalizar la obra"]] },
  { id: "100-fin", label: "Todo al terminar", tramos: [[100, "al finalizar la obra, con el trabajo revisado"]] },
];

export const METODOS_PAGO = [
  { id: "transferencia", label: "Transferencia" },
  { id: "bizum", label: "Bizum" },
  { id: "efectivo", label: "Efectivo" },
  { id: "tarjeta", label: "Tarjeta" },
];

export const GARANTIAS = ["6 meses", "1 año", "2 años", "3 años"];

export const COLORES_MARCA = [
  { hex: "#2878A8", label: "Azul" },
  { hex: "#1F3A5F", label: "Marino" },
  { hex: "#E8862A", label: "Naranja" },
  { hex: "#1E8C5A", label: "Verde" },
  { hex: "#9B2C3B", label: "Granate" },
  { hex: "#2E3440", label: "Grafito" },
  { hex: "#B08A3E", label: "Dorado" },
];

// ── VALORES INICIALES ───────────────────────────────────────
export const uid = () => Math.random().toString(36).slice(2, 10);

export const hoyISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });

export function presupuestoVacio(lead?: {
  id?: string; client_name?: string | null; client_phone?: string | null; client_email?: string | null;
  direccion?: string | null; zona?: string | null;
} | null): Presupuesto {
  return {
    lead_id: lead?.id || null,
    numero: "",
    fecha: hoyISO(),
    validez_dias: 30,
    cliente: {
      nombre: lead?.client_name || "",
      telefono: lead?.client_phone || "",
      email: lead?.client_email || "",
      direccion: lead?.direccion || "",
      poblacion: lead?.zona || "",
    },
    obra: { inmueble: "Piso", estancias: {}, m2_vivienda: "", ocupacion: "amueblada" },
    estado: [],
    preparacion: [...PREPARACION_POR_DEFECTO],
    materiales: {
      marca: "", tipo: "lavable", acabado: "mate", colores: "blanco", colores_txt: "",
      manos: 2, imprimacion: true, material_incluido: true,
    },
    partidas: [],
    descuento_pct: 0,
    iva_pct: 21,
    plazo_min: "",
    plazo_max: "",
    inicio: "A convenir con el cliente",
    pago: "40-40-20",
    pago_txt: "",
    metodos: ["transferencia", "bizum"],
    garantia: "1 año",
    no_incluye: [...NO_INCLUYE_POR_DEFECTO],
    notas: "",
  };
}

export function marcaVacia(u?: {
  company_name?: string | null; name?: string | null; cif?: string | null; phone?: string | null; whatsapp?: string | null;
  email?: string | null; billing_email?: string | null; fiscal_address?: string | null; fiscal_zip?: string | null; fiscal_city?: string | null;
} | null): Marca {
  const dir = [u?.fiscal_address, [u?.fiscal_zip, u?.fiscal_city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return {
    nombre: u?.company_name || u?.name || "",
    razon: "",
    nif: u?.cif || "",
    telefono: u?.phone || u?.whatsapp || "",
    email: u?.billing_email || u?.email || "",
    direccion: dir,
    web: "",
    lema: "Su proyecto en buenas manos.",
    color: COLORES_MARCA[0].hex,
    logo_url: null,
    precios: {},
  };
}

// ── NÚMEROS ─────────────────────────────────────────────────
// «2.801,15 €» siempre con punto de miles (toLocaleString en español no lo pone en 4 cifras)
export function euros(n: number, decimales = 2): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const neg = v < 0;
  const [ent, dec] = Math.abs(v).toFixed(decimales).split(".");
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + miles + (dec ? "," + dec : "") + " €";
}
export function cifra(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const [ent, dec] = v.toFixed(2).split(".");
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec === "00" ? miles : miles + "," + dec.replace(/0$/, "");
}
// «1.200», «1200,50», «15» → número
export function aNumero(s: string | number): number {
  if (typeof s === "number") return s;
  let t = (s || "").replace(/[\s€]/g, "");
  if (!t) return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, "");
  return Number(t);
}

export function totales(p: Presupuesto) {
  const bruto = p.partidas.reduce((s, x) => s + (Number(x.cantidad) || 0) * (Number(x.precio) || 0), 0);
  const descuento = Math.round(bruto * (Number(p.descuento_pct) || 0)) / 100;
  const base = Math.round((bruto - descuento) * 100) / 100;
  const iva = Math.round(base * (Number(p.iva_pct) || 0)) / 100;
  const total = Math.round((base + iva) * 100) / 100;
  return { bruto, descuento, base, iva, total };
}

// ── TEXTOS ──────────────────────────────────────────────────
const MANOS = ["", "una mano", "dos manos", "tres manos", "cuatro manos"];
const manosTxt = (n: number) => MANOS[n] || n + " manos";

export function pinturaTxt(p: Presupuesto): string {
  const m = p.materiales;
  const tipo = TIPOS_PINTURA.find((t) => t.id === m.tipo)?.txt || "pintura plástica";
  const acabado = m.acabado === "mate" ? "de acabado mate" : m.acabado === "satinado" ? "de acabado satinado" : m.acabado === "brillo" ? "de acabado brillo" : "";
  return [tipo, acabado, m.marca ? "de " + m.marca : ""].filter(Boolean).join(" ");
}

export function coloresTxt(p: Presupuesto): string {
  const m = p.materiales;
  if (m.colores_txt.trim()) return "en " + m.colores_txt.trim();
  if (m.colores === "blanco") return "en color blanco";
  if (m.colores === "uno") return "en el color elegido por el cliente";
  if (m.colores === "varios") return "en los colores elegidos por el cliente para cada estancia";
  return "en el color o colores que elija el cliente";
}

export function tituloPartida(x: Partida): string {
  if (x.tipo === "otro") return x.titulo.trim() || "Otros trabajos";
  return TRABAJO[x.tipo]?.titulo || x.titulo;
}

const cant = (x: Partida) => (x.unidad === "global" ? "" : " (" + cifra(x.cantidad) + " " + x.unidad + ")");

export function detallePartida(x: Partida, p: Presupuesto): string {
  const m = p.materiales;
  const manos = manosTxt(m.manos || 2);
  const pintura = pinturaTxt(p);
  const color = coloresTxt(p);
  const imp = m.imprimacion;
  switch (x.tipo) {
    case "paredes":
      return "Pintura de paredes" + cant(x) + ": limpieza y lijado de las superficies, plastecido y lijado de pequeños desperfectos"
        + (imp ? ", imprimación selladora en las zonas reparadas" : "")
        + " y aplicación de " + manos + " de " + pintura + " " + color + ", con recortes limpios en esquinas, techos y carpinterías.";
    case "techos":
      return "Pintura de techos" + cant(x) + " con pintura plástica mate antigoteo de alta cubrición, " + manos
        + ", con recorte limpio en los encuentros con paredes, molduras y puntos de luz.";
    case "gotele":
      return "Alisado completo de paredes sobre gotelé" + cant(x) + ": rascado y saneado del gotelé, aplicación de masilla de alisar"
        + " en dos pasadas, lijado fino hasta dejar la superficie totalmente lisa e imprimación selladora para fijar el soporte antes de pintar.";
    case "grietas":
      return "Reparación de grietas, fisuras, agujeros y desconchones" + (x.unidad !== "global" && x.cantidad > 1 ? cant(x) : "")
        + ": apertura y saneado de cada grieta, relleno con masilla elástica y malla donde sea necesario, y lijado hasta igualar con el resto de la pared.";
    case "humedad":
      return "Tratamiento de humedades y moho" + cant(x) + ": limpieza con producto fungicida, secado del soporte,"
        + " sellado con imprimación antihumedad y acabado con pintura antimoho para que la mancha no vuelva a salir.";
    case "puertas":
      return "Lacado de puertas" + cant(x) + ", por las dos caras y con su marco: lijado, imprimación de agarre y "
        + manos + " de esmalte al agua sin olor " + (m.acabado === "brillo" ? "brillante" : "satinado")
        + ", con desmontaje y montaje de herrajes cuando sea necesario.";
    case "ventanas":
      return "Pintura de ventanas y carpintería" + cant(x) + ": lijado, imprimación y esmalte de alta resistencia, protegiendo cristales y herrajes.";
    case "radiadores":
      return "Pintura de radiadores" + cant(x) + ": limpieza, lijado y esmalte especial para radiadores, resistente al calor y sin amarillear.";
    case "rodapies":
      return "Pintura de rodapiés" + cant(x) + " con esmalte, con encintado del suelo para un acabado limpio.";
    case "rejas":
      return "Pintura de rejas, barandillas y cerrajería" + cant(x) + ": cepillado del óxido, imprimación antioxidante y esmalte metálico de exterior.";
    case "fachada":
      return "Pintura de fachada" + cant(x) + ": limpieza a presión, reparación de fisuras, fijador y " + manos
        + " de pintura de fachada impermeable y transpirable" + (m.marca ? " de " + m.marca : "") + ".";
    case "escalera":
      return "Pintura de escalera y zonas comunes" + cant(x) + ": preparación de paramentos y " + manos + " de " + pintura + " " + color
        + ", trabajando por tramos para no cortar el paso a los vecinos.";
    case "papel":
      return "Retirada de papel pintado" + cant(x) + ": humedecido, despegado, limpieza de restos de cola y preparación de la pared para pintar.";
    default: {
      const t = x.detalle.trim() || x.titulo.trim() || "Otros trabajos";
      return t + (x.unidad !== "global" && !/\d/.test(t) ? cant(x) : "") + (/[.!?]$/.test(t) ? "" : ".");
    }
  }
}

export function estanciasTxt(e: Record<string, number>): string {
  const partes = ESTANCIAS.filter((x) => (e[x.id] || 0) > 0).map((x) => {
    const n = e[x.id];
    if (x.id === "dormitorio") return n === 1 ? "1 dormitorio" : n + " dormitorios";
    if (x.id === "bano") return n === 1 ? "1 baño" : n + " baños";
    return x.label.toLowerCase();
  });
  if (partes.length <= 1) return partes.join("");
  return partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1];
}

// Título grande del PDF: «Presupuesto de alisado de gotelé y pintura de paredes»
export function tituloPresupuesto(p: Presupuesto): string {
  const ids = p.partidas.map((x) => x.tipo);
  const tiene = (t: string) => ids.includes(t);
  const partes: string[] = [];
  if (tiene("gotele")) partes.push("alisado de gotelé");
  if (tiene("paredes") || tiene("techos")) {
    const casa = p.obra.inmueble === "Piso" || p.obra.inmueble === "Ático" ? "vivienda" : p.obra.inmueble === "Casa / chalet" ? "vivienda" : (p.obra.inmueble || "").toLowerCase();
    partes.push("pintura de " + (casa || "interior"));
  }
  if (tiene("fachada")) partes.push("pintura de fachada");
  if (tiene("puertas")) partes.push("lacado de puertas");
  if (tiene("humedad")) partes.push("tratamiento de humedades");
  if (tiene("escalera") && !partes.length) partes.push("pintura de zonas comunes");
  if (!partes.length) return "Presupuesto de trabajos de pintura";
  const txt = partes.length === 1 ? partes[0] : partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1];
  return "Presupuesto de " + txt;
}

// Pasos del proceso de trabajo (línea de tiempo del PDF)
export function proceso(p: Presupuesto): { t: string; d: string }[] {
  const ids = p.partidas.map((x) => x.tipo);
  const pasos: { t: string; d: string }[] = [];
  if (p.preparacion.some((x) => ["suelos", "muebles", "encintado"].includes(x)))
    pasos.push({ t: "Protección", d: "Suelos, muebles y carpinterías tapados antes de empezar" });
  const prep: string[] = [];
  if (ids.includes("papel")) prep.push("retirada de papel");
  if (ids.includes("gotele")) prep.push("rascado y alisado");
  if (ids.includes("grietas") || p.estado.some((e) => ["agujeros", "grietas", "levantada"].includes(e))) prep.push("reparación de grietas");
  if (ids.includes("humedad") || p.estado.includes("humedad")) prep.push("tratamiento antimoho");
  pasos.push({ t: "Preparación", d: prep.length ? cap(prep.join(", ")) + " y lijado" : "Limpieza, plastecido y lijado del soporte" });
  if (p.materiales.imprimacion || ids.includes("gotele")) pasos.push({ t: "Imprimación", d: "Sellado del soporte para un acabado uniforme" });
  pasos.push({ t: "Pintura", d: cap(manosTxt(p.materiales.manos || 2)) + (p.materiales.marca ? " de " + p.materiales.marca : " de pintura de calidad") });
  pasos.push({ t: "Entrega", d: p.preparacion.includes("limpieza") ? "Limpieza final y repaso del trabajo con el cliente" : "Repaso del trabajo con el cliente" });
  return pasos;
}

export function incluye(p: Presupuesto): string[] {
  const out: string[] = [];
  if (p.materiales.material_incluido) out.push("Materiales de primera calidad y mano de obra completa");
  else out.push("Mano de obra completa (la pintura la aporta el cliente)");
  PREPARACION.forEach((x) => { if (p.preparacion.includes(x.id)) out.push(x.incluye); });
  return out;
}

export function tramosPago(p: Presupuesto, total: number): { pct: number; txt: string; importe: number }[] {
  const f = FORMAS_PAGO.find((x) => x.id === p.pago);
  if (!f) return [];
  return f.tramos.map(([pct, txt]) => ({ pct, txt, importe: Math.round(total * pct) / 100 }));
}

export function plazoTxt(p: Presupuesto): string {
  const a = String(p.plazo_min || "").trim(), b = String(p.plazo_max || "").trim();
  if (a && b && a !== b) return a + " a " + b + " días";
  if (a || b) { const n = a || b; return n + (n === "1" ? " día" : " días"); }
  return "";
}

export function sumaM2(p: Presupuesto): number {
  return p.partidas.filter((x) => x.unidad === "m²" && ["paredes", "techos", "gotele", "fachada", "escalera"].includes(x.tipo))
    .reduce((s, x) => s + (Number(x.cantidad) || 0), 0);
}

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const fechaLarga = (iso: string) => {
  const [y, m, d] = (iso || hoyISO()).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
export const fechaCorta = (iso: string) => {
  const [y, m, d] = (iso || hoyISO()).split("-").map(Number);
  return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + y;
};
export const sumarDias = (iso: string, dias: number) => {
  const [y, m, d] = (iso || hoyISO()).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
};

export const esPintor = (trade?: string | null) => /pint/i.test(trade || "");
