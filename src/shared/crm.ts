// ============================================================
// OficioYa · CRM — tipos y listas compartidas
// Este archivo lo usan el panel del PROFESIONAL y el panel ADMIN.
// Si cambias una lista aquí, cambia en los dos sitios a la vez.
// ============================================================

// ── DATOS DE COBRO (cámbialos aquí si cambia el banco) ──
export const OY_IBAN = "ES45 1465 0100 9117 4426 4278";
export const OY_TITULAR = "Andrés Algora";

// ── LOS 13 ESTADOS ──
export type Stage =
  | "entrada"
  | "cualificado"
  | "asignado"
  | "aceptado"
  | "presupuestando"
  | "precio_acordado"
  | "programado"
  | "completado"
  | "cobrado_cliente"
  | "facturado"
  | "liquidado"
  | "en_espera"
  | "cerrado";

export const STAGE_LABEL: Record<Stage, string> = {
  entrada: "Entrada",
  cualificado: "Cualificado",
  asignado: "Asignado",
  aceptado: "Aceptado",
  presupuestando: "Presupuestando",
  precio_acordado: "Precio acordado",
  programado: "Programado",
  completado: "Completado",
  cobrado_cliente: "Cobrado del cliente",
  facturado: "Facturado",
  liquidado: "Liquidado",
  en_espera: "En espera",
  cerrado: "Cerrado",
};

// Estados en los que el profesional ve el trabajo en "Activos"
export const STAGES_ACTIVOS: Stage[] = [
  "asignado",
  "aceptado",
  "presupuestando",
  "precio_acordado",
  "programado",
  "completado",
];

// Estados en los que ya hay dinero devengado
export const STAGES_SALDO: Stage[] = ["cobrado_cliente", "facturado"];

// ── QUÉ ESTÁ HACIENDO EL PRO MIENTRAS PRESUPUESTA ──
export const SUBSTAGES = [
  { id: "visita", label: "Voy a visitarlo", pideFecha: true },
  { id: "fotos", label: "Esperando fotos o vídeo", pideFecha: false },
  { id: "confirma", label: "Esperando que me confirme", pideFecha: false },
] as const;
// ── MOTIVOS DE DEVOLUCIÓN (cancelar) ──
// OJO: los ids tienen que coincidir con el CHECK deals_close_reason_chk de la base de datos.
// Si NO llegó a dar precio (0 €)
export const CLOSE_REASONS_SIN_PRECIO = [
  { id: "cliente_no_responde", label: "No consigo hablar con el cliente" },
  { id: "cliente_cancela", label: "El cliente ya no lo necesita" },
  { id: "pro_no_atiende", label: "No puedo atenderlo (agenda)" },
  { id: "fuera_de_zona", label: "Está fuera de mi zona" },
  { id: "otros", label: "Otros" },
];

// Si SÍ dio precio
export const CLOSE_REASONS_CON_PRECIO = [
  { id: "precio_alto", label: "Le pareció caro" },
  { id: "cerro_con_otro", label: "Eligió otro presupuesto" },
  { id: "cliente_cancela", label: "Lo ha aplazado" },
  { id: "cliente_no_contesta", label: "No contesta desde que le pasé el presupuesto" },
  { id: "pro_no_atiende", label: "No puedo atenderlo yo" },
  { id: "otros", label: "Otros" },
];

// Motivos que devuelven el lead a la bandeja de admin para reasignar
export const REASONS_REASIGNAR = ["pro_no_atiende", "fuera_de_zona", "cliente_no_responde", "cliente_no_contesta"];

// ── MOTIVOS PARA APARCAR ──
// OJO: los ids tienen que coincidir con el CHECK deals_pause_reason_chk de la base de datos.
export const PAUSE_REASONS = [
  { id: "sin_presupuesto_ahora", label: "El cliente lo ha aplazado" },
  { id: "espera_a_tercero", label: "Espera decisión de otra persona (propietario, comunidad, pareja)" },
  { id: "obra_futura", label: "Obra o reforma sin terminar" },
  { id: "cliente_ausente", label: "El cliente está fuera" },
  { id: "seguro", label: "Tema de seguro o peritaje" },
  { id: "otros", label: "Otros" },
];

// ── MOTIVOS DE IMPAGO DEL CLIENTE ──
export const UNPAID_REASONS = [
  { id: "plazo", label: "Me paga a plazos" },
  { id: "espera_factura", label: "Espera mi factura" },
  { id: "no_responde", label: "No me responde" },
  { id: "disconforme", label: "No está conforme con el trabajo" },
  { id: "otros", label: "Otros" },
];

export function labelDe(lista: { id: string; label: string }[], id?: string | null) {
  if (!id) return "";
  return lista.find((x) => x.id === id)?.label || id;
}

// ── LA FILA DE LA TABLA deals ──
export interface DealRow {
  id: string;
  ref: number;
  created_at: string;
  updated_at: string;

  city_id?: string | null;
  city_name?: string | null;
  zone?: string | null;

  client_id?: string | null;
  client_name: string;
  client_phone: string;
  client_email?: string | null;

  trade: string;
  title?: string | null;
  description?: string | null;
  urgency: number;
  source: string;

  pro_id?: string | null;
  pro_name?: string | null;
  assigned_at?: string | null;
  accepted_at?: string | null;

  stage: Stage;
  substage?: string | null;
  stage_before_pause?: string | null;
  deadline_at?: string | null;
  next_step_at?: string | null;
  pause_until?: string | null;
  pause_reason?: string | null;
  pause_note?: string | null;

  price?: number | null;
  commission_rate: number;
  commission_committed: number;
  collected_amount: number;
  commission_due: number;
  collected_at?: string | null;
  unpaid_reason?: string | null;
  unpaid_expected_date?: string | null;

  scheduled_for?: string | null;
  completed_at?: string | null;

  close_reason?: string | null;
  close_note?: string | null;
  close_price?: number | null;
  closed_at?: string | null;
  returned_to_admin: boolean;

  invoice_id?: string | null;
  settled_at?: string | null;
  admin_note?: string | null;
}

export interface DealEventRow {
  id: string;
  deal_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_role: string;
  event: string;
  detail?: string | null;
  created_at: string;
}

export interface DealRequestRow {
  id: string;
  deal_id: string;
  pro_id?: string | null;
  pro_name?: string | null;
  kind: "pausa" | "correccion";
  requested_until?: string | null;
  reason?: string | null;
  note?: string | null;
  new_amount?: number | null;
  status: "pendiente" | "aprobada" | "rechazada";
  admin_note?: string | null;
  created_at: string;
}

export interface InvoiceRow {
  id: string;
  number: string;
  pro_id: string;
  pro_name?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  base: number;
  iva: number;
  total: number;
  status: string;
  issued_at: string;
  paid_at?: string | null;
}

// ── AYUDAS DE FORMATO ──
export function eur(n?: number | null) {
  const v = Number(n || 0);
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function fechaCorta(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** Devuelve el tiempo que queda hasta una fecha. negativo = vencido */
export function tiempoRestante(iso?: string | null): { ms: number; texto: string; vencido: boolean } {
  if (!iso) return { ms: 0, texto: "", vencido: false };
  const ms = new Date(iso).getTime() - Date.now();
  const vencido = ms < 0;
  const abs = Math.abs(ms);
  const min = Math.floor(abs / 60000);
  const horas = Math.floor(min / 60);
  const dias = Math.floor(horas / 24);
  let texto = "";
  if (dias >= 1) texto = dias + (dias === 1 ? " día" : " días");
  else if (horas >= 1) texto = horas + " h";
  else texto = min + " min";
  return { ms, texto, vencido };
}

/** Semana ISO tipo "S31" para el concepto de la transferencia */
export function semanaISO(d: Date = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((t.getTime() - inicio.getTime()) / 86400000 + 1) / 7);
  return "S" + semana;
}

/** Concepto fijo de transferencia: OY-MARCOS-S31 */
export function conceptoTransferencia(proName?: string | null) {
  const limpio = (proName || "PRO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(" ")[0]
    .replace(/[^A-Z0-9]/g, "");
  return "OY-" + limpio + "-" + semanaISO();
}
