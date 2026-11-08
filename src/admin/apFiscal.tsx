// ============================================================
// OficioYa · ADMIN — piezas fiscales (las usan Archivos e Impuestos)
// Libro de ingresos y gastos, IVA (303), IRPF (130), retenciones (111),
// operaciones con la UE (349) y terceros (347). Es un cálculo orientativo
// para preparar los modelos; la gestoría revisa antes de presentar.
// ============================================================
import React, { useMemo, useState } from "react";
import { db } from "../supabase";
import { C, F, Btn, Campo, Modal, Sel, eur, mesNombre } from "./apUi";

export const claveAdmin = () => { try { return localStorage.getItem("oy_captacion_clave") || ""; } catch { return ""; } };

// ── TIPOS ───────────────────────────────────────────────────
export type Regimen = "general" | "intracomunitario" | "isp_extranjero" | "exento" | "no_sujeto";
export interface Apunte {
  id?: string;
  tipo: "ingreso" | "gasto";
  fecha: string;
  numero: string | null;
  tercero_nombre: string | null;
  tercero_nif: string | null;
  tercero_pais: string;
  concepto: string | null;
  categoria: string;
  base: number;
  iva_tipo: number;
  iva_importe: number;
  iva_regimen: Regimen;
  irpf_tipo: number;
  irpf_importe: number;
  total: number;
  deducible_pct: number;
  inversion: boolean;
  amort_anios: number | null;
  plataforma: "google" | "meta" | null;
  periodo: string | null;
  archivo_id: string | null;
  origen?: string;
  notas: string | null;
}
export interface FacturaFiscal {
  id: string; numero: string; fecha: string; tipo: string; n_leads: number; base: number; iva_pct: number; iva: number;
  total: number; estado: string; pagada: string | null; cliente: string | null; nif: string | null; pro_id: string;
}
export interface ComisionFiscal { id: string; fecha: string; importe: number; referencia: string | null; pro: string | null; nif: string | null; }
export interface PublicidadMes { plataforma: "google" | "meta"; mes: string; importe: number; }
export interface PendienteArchivo { id: string; nombre: string; carpeta: string; tipo: string; fecha_doc: string | null; created_at: string; }
export interface FiscalConfig {
  roi?: "si" | "no" | "nose";
  autonomos_mensual?: number;
  autonomos_desde?: string;
  alta?: string | null; // mes del alta de autónomo (AAAA-MM): lo anterior no entra en los modelos
  presentados?: Record<string, string>; // "2026-3" → fecha en que se marcó presentado el 303/130 de ese trimestre
  rendimiento_anterior?: number | null;
  dificil_pct?: number;
  iva_compensar_inicio?: Record<string, number>;
  comisiones_iva_incluido?: boolean;
}
export interface FiscalDatos {
  anio: number;
  apuntes: Apunte[];
  facturas: FacturaFiscal[];
  comisiones: ComisionFiscal[];
  publicidad: PublicidadMes[];
  pendientes: PendienteArchivo[];
  config: FiscalConfig;
  primer_anio: number | null;
}

// ── CATÁLOGOS ───────────────────────────────────────────────
export const CAT_GASTO: { v: string; l: string }[] = [
  { v: "publicidad", l: "Publicidad (Google, Meta…)" },
  { v: "software", l: "Programas y servicios web" },
  { v: "comerciales", l: "Comerciales (comisiones)" },
  { v: "profesionales", l: "Gestoría, abogados y asesores" },
  { v: "autonomos", l: "Seguridad Social (autónomos)" },
  { v: "telefono", l: "Teléfono e internet" },
  { v: "bancos", l: "Bancos y cobros con tarjeta" },
  { v: "material", l: "Material y equipos" },
  { v: "formacion", l: "Formación" },
  { v: "viajes", l: "Viajes y desplazamientos" },
  { v: "local", l: "Local, alquiler y suministros" },
  { v: "seguros", l: "Seguros" },
  { v: "tributos", l: "Tasas y tributos" },
  { v: "otros", l: "Otros gastos" },
];
export const CAT_INGRESO: { v: string; l: string }[] = [
  { v: "leads", l: "Venta de leads" },
  { v: "activaciones", l: "Altas de profesionales" },
  { v: "comisiones", l: "Comisiones por trabajos" },
  { v: "otros", l: "Otros ingresos" },
];
export const nombreCategoria = (tipo: string, v: string) =>
  (tipo === "ingreso" ? CAT_INGRESO : CAT_GASTO).find((c) => c.v === v)?.l || v;

export const REGIMENES: { v: Regimen; l: string; ayuda: string }[] = [
  { v: "general", l: "IVA español", ayuda: "La factura lleva IVA (21 %, 10 % o 4 %)." },
  { v: "intracomunitario", l: "Empresa de la UE, sin IVA en la factura", ayuda: "Google Ireland, Meta Ireland… Se declara por inversión del sujeto pasivo: suma y resta lo mismo en el 303 y va al 349." },
  { v: "isp_extranjero", l: "Empresa de fuera de la UE, sin IVA", ayuda: "Servicios de EE. UU. u otros países: inversión del sujeto pasivo (suma y resta lo mismo en el 303)." },
  { v: "exento", l: "Exento de IVA", ayuda: "Seguros, bancos, formación reglada…" },
  { v: "no_sujeto", l: "Sin IVA (no sujeto)", ayuda: "Seguridad Social, tasas, multas…" },
];
export const nombreRegimen = (r: string) => REGIMENES.find((x) => x.v === r)?.l || r;

export const GOOGLE = { nombre: "Google Ireland Limited", nif: "IE6388047V", pais: "IE" };
export const META = { nombre: "Meta Platforms Ireland Limited", nif: "IE9692928F", pais: "IE" };

type Plantilla = { id: string; l: string; a: Partial<Apunte> };
export function plantillas(tipo: "ingreso" | "gasto", roi?: string): Plantilla[] {
  const regUE: Regimen = roi === "no" ? "general" : "intracomunitario";
  if (tipo === "ingreso") return [
    { id: "iva21", l: "Con IVA 21 %", a: { iva_regimen: "general", iva_tipo: 21, tercero_pais: "ES" } },
    { id: "ue", l: "Cliente de otro país de la UE", a: { iva_regimen: "intracomunitario", iva_tipo: 0 } },
  ];
  return [
    { id: "google", l: "Google Ads", a: { tercero_nombre: GOOGLE.nombre, tercero_nif: GOOGLE.nif, tercero_pais: "IE", categoria: "publicidad", iva_regimen: regUE, iva_tipo: 21, plataforma: "google", concepto: "Publicidad en Google Ads" } },
    { id: "meta", l: "Meta (Facebook e Instagram)", a: { tercero_nombre: META.nombre, tercero_nif: META.nif, tercero_pais: "IE", categoria: "publicidad", iva_regimen: regUE, iva_tipo: 21, plataforma: "meta", concepto: "Publicidad en Facebook e Instagram" } },
    { id: "es21", l: "Proveedor español (21 %)", a: { tercero_pais: "ES", iva_regimen: "general", iva_tipo: 21 } },
    { id: "fuera", l: "Empresa de fuera de la UE", a: { tercero_pais: "US", iva_regimen: "isp_extranjero", iva_tipo: 21, categoria: "software" } },
    { id: "ss", l: "Seguridad Social", a: { tercero_nombre: "Tesorería General de la Seguridad Social", tercero_nif: null, tercero_pais: "ES", iva_regimen: "no_sujeto", iva_tipo: 0, categoria: "autonomos", concepto: "Autónomos (RETA)" } },
    { id: "ret", l: "Profesional con retención 15 %", a: { tercero_pais: "ES", iva_regimen: "general", iva_tipo: 21, irpf_tipo: 15, categoria: "profesionales" } },
  ];
}

// ── NÚMEROS Y FECHAS ────────────────────────────────────────
export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
// Acepta «1.234,56», «1234,56», «1234.56» y «1.234»
export const aNumero = (s: unknown): number => {
  let t = String(s ?? "").trim().replace(/\s|€/g, "");
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
export const fmtNum = (n: number) => (Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const trimestreDe = (f: string) => Math.floor((Number(f.slice(5, 7)) - 1) / 3) + 1;
export const finDeMes = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
export const hoyMadrid = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
export const fechaLarga = (ymd: string) =>
  new Date(ymd + "T12:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Plazo para presentar el trimestre (si cae en fin de semana, pasa al lunes)
function habil(ymd: string) {
  const d = new Date(ymd + "T12:00:00Z");
  const dia = d.getUTCDay();
  if (dia === 6) d.setUTCDate(d.getUTCDate() + 2);
  if (dia === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function plazoTrimestre(anio: number, q: number) {
  if (q === 4) return { desde: `${anio + 1}-01-01`, hasta: habil(`${anio + 1}-01-30`), hasta111: habil(`${anio + 1}-01-20`) };
  const mes = String(q * 3 + 1).padStart(2, "0");
  return { desde: `${anio}-${mes}-01`, hasta: habil(`${anio}-${mes}-20`), hasta111: habil(`${anio}-${mes}-20`) };
}
export function periodoPorDefecto(): { anio: number; q: number } {
  const [y, m, d] = hoyMadrid().split("-").map(Number);
  if (m === 1 && d <= 30) return { anio: y - 1, q: 4 };
  if ((m === 4 || m === 7 || m === 10) && d <= 20) return { anio: y, q: (m - 1) / 3 };
  return { anio: y, q: Math.floor((m - 1) / 3) + 1 };
}
export const diasHasta = (ymd: string) =>
  Math.round((new Date(ymd + "T12:00:00Z").getTime() - new Date(hoyMadrid() + "T12:00:00Z").getTime()) / 86400000);

// ── LIBRO: todo lo que cuenta, con su origen ────────────────
export interface Linea {
  key: string;
  tipo: "ingreso" | "gasto";
  fecha: string;
  q: number;
  numero: string | null;
  tercero: string | null;
  nif: string | null;
  pais: string;
  concepto: string;
  categoria: string;
  base: number;
  ivaTipo: number;
  iva: number;
  regimen: Regimen;
  irpfTipo: number;
  irpf: number;
  total: number;
  deducible: number;
  inversion: boolean;
  amortAnios: number | null;
  fuente: "factura" | "apunte" | "comision" | "publicidad" | "autonomos";
  estimado: boolean;
  aviso?: string;
  fuera?: boolean; // antes del alta de autónomo: se ve en el libro pero no cuenta en los modelos
  sinNifIva?: boolean; // gasto con IVA sin NIF del proveedor: el gasto cuenta, su IVA no se descuenta
  plataforma?: string | null;
  mes?: string;
  apunte?: Apunte;
  factura?: FacturaFiscal;
}

export function construirLineas(d: FiscalDatos): Linea[] {
  const L: Linea[] = [];
  const cfg = d.config || {};
  const mesHoy = hoyMadrid().slice(0, 7);
  const mesDe = (f: string) => f.slice(0, 7);

  // 1) Facturas emitidas desde el panel (leads y altas)
  for (const f of d.facturas || []) {
    L.push({
      key: "f" + f.id, tipo: "ingreso", fecha: f.fecha, q: trimestreDe(f.fecha), numero: f.numero, tercero: f.cliente, nif: f.nif,
      pais: "ES", concepto: f.tipo === "activacion" ? "Alta de profesional" : `${f.n_leads} leads`,
      categoria: f.tipo === "activacion" ? "activaciones" : "leads", base: +f.base, ivaTipo: +f.iva_pct, iva: +f.iva,
      regimen: "general", irpfTipo: 0, irpf: 0, total: +f.total, deducible: 100, inversion: false, amortAnios: null,
      fuente: "factura", estimado: false, factura: f,
      aviso: f.nif ? undefined : "Factura sin NIF del cliente",
    });
  }
  // 2) Apuntes: facturas subidas a Archivos y gastos/ingresos metidos a mano
  for (const a of d.apuntes || []) {
    L.push({
      key: "a" + a.id, tipo: a.tipo, fecha: a.fecha, q: trimestreDe(a.fecha), numero: a.numero, tercero: a.tercero_nombre,
      nif: a.tercero_nif, pais: a.tercero_pais || "ES", concepto: a.concepto || "", categoria: a.categoria, base: +a.base,
      ivaTipo: +a.iva_tipo, iva: +a.iva_importe, regimen: a.iva_regimen, irpfTipo: +a.irpf_tipo, irpf: +a.irpf_importe,
      total: +a.total, deducible: +a.deducible_pct, inversion: !!a.inversion, amortAnios: a.amort_anios != null ? +a.amort_anios : null,
      fuente: "apunte", estimado: false, plataforma: a.plataforma, apunte: a,
      sinNifIva: a.tipo === "gasto" && a.iva_regimen === "general" && +a.iva_importe > 0 && !a.tercero_nif,
      aviso: a.tipo === "gasto" && a.iva_regimen === "general" && +a.iva_importe > 0 && !a.tercero_nif ? "Sin NIF del proveedor: su IVA no se descuenta hasta que lo pongas" : undefined,
    });
  }
  // 3) Comisiones cobradas (modelo de comisión): cuentan en los meses sin facturas de comisión subidas
  const mesesComision = new Set((d.apuntes || []).filter((a) => a.tipo === "ingreso" && a.categoria === "comisiones").map((a) => a.periodo || mesDe(a.fecha)));
  const ivaIncluido = cfg.comisiones_iva_incluido !== false;
  for (const c of d.comisiones || []) {
    const mes = mesDe(c.fecha);
    if (mesesComision.has(mes)) continue;
    const imp = +c.importe;
    const base = ivaIncluido ? r2(imp / 1.21) : r2(imp);
    const iva = ivaIncluido ? r2(imp - base) : r2(imp * 0.21);
    L.push({
      key: "c" + c.id, tipo: "ingreso", fecha: c.fecha, q: trimestreDe(c.fecha), numero: c.referencia, tercero: c.pro, nif: c.nif,
      pais: "ES", concepto: "Comisión cobrada", categoria: "comisiones", base, ivaTipo: 21, iva, regimen: "general",
      irpfTipo: 0, irpf: 0, total: r2(base + iva), deducible: 100, inversion: false, amortAnios: null, fuente: "comision",
      estimado: true, mes, aviso: "Sale del cobro apuntado; sube la factura de comisión para que sea exacto",
    });
  }
  // 4) Gasto real de anuncios (Google y Meta): cuenta en los meses sin la factura de esa plataforma
  const cubiertos = new Set((d.apuntes || []).filter((a) => a.tipo === "gasto" && a.plataforma).map((a) => a.plataforma + "|" + (a.periodo || mesDe(a.fecha))));
  const regPub: Regimen = cfg.roi === "no" ? "general" : "intracomunitario";
  for (const p of d.publicidad || []) {
    if (cubiertos.has(p.plataforma + "|" + p.mes)) continue;
    const base = r2(p.importe);
    const iva = r2(base * 0.21);
    const t = p.plataforma === "google" ? GOOGLE : META;
    L.push({
      key: "p" + p.plataforma + p.mes, tipo: "gasto", fecha: finDeMes(p.mes), q: trimestreDe(p.mes + "-01"), numero: null,
      tercero: t.nombre, nif: t.nif, pais: t.pais, concepto: (p.plataforma === "google" ? "Google Ads" : "Meta Ads") + " · " + mesNombre(p.mes),
      categoria: "publicidad", base, ivaTipo: 21, iva, regimen: regPub, irpfTipo: 0, irpf: 0,
      total: regPub === "general" ? r2(base + iva) : base, deducible: 100, inversion: false, amortAnios: null,
      fuente: "publicidad", estimado: true, plataforma: p.plataforma, mes: p.mes,
      aviso: p.mes === mesHoy ? "Mes en curso: gasto de las campañas hasta hoy" : "Gasto real de las campañas; falta subir la factura",
    });
  }
  // 5) Seguridad Social (autónomos), cada mes desde el alta
  const ss = Number(cfg.autonomos_mensual) || 0;
  const alta = /^\d{4}-\d{2}$/.test(String(cfg.alta || "")) ? String(cfg.alta) : null;
  if (ss > 0) {
    const desde = [cfg.autonomos_desde, alta].filter(Boolean).sort().pop() || `${d.anio}-01`;
    const conApunte = new Set((d.apuntes || []).filter((a) => a.tipo === "gasto" && a.categoria === "autonomos").map((a) => a.periodo || mesDe(a.fecha)));
    for (let m = 1; m <= 12; m++) {
      const mes = `${d.anio}-${String(m).padStart(2, "0")}`;
      if (mes < desde || mes > mesHoy || conApunte.has(mes)) continue;
      L.push({
        key: "s" + mes, tipo: "gasto", fecha: finDeMes(mes), q: Math.floor((m - 1) / 3) + 1, numero: null,
        tercero: "Tesorería General de la Seguridad Social", nif: null, pais: "ES", concepto: "Autónomos · " + mesNombre(mes),
        categoria: "autonomos", base: ss, ivaTipo: 0, iva: 0, regimen: "no_sujeto", irpfTipo: 0, irpf: 0, total: ss,
        deducible: 100, inversion: false, amortAnios: null, fuente: "autonomos", estimado: false, mes,
      });
    }
  }
  // 6) Lo de antes del alta se queda en el libro, pero fuera de los modelos
  if (alta) for (const l of L) {
    if (l.fecha.slice(0, 7) < alta) {
      l.fuera = true;
      l.aviso = "Antes de tu alta de autónomo: no entra en los modelos";
    }
  }
  return L.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.key.localeCompare(b.key));
}

// Mes del alta (AAAA-MM) o null, y «septiembre de 2026»
export const mesAlta = (cfg: FiscalConfig) => (/^\d{4}-\d{2}$/.test(String(cfg.alta || "")) ? String(cfg.alta) : null);
export const mesLargo = (mes: string) =>
  new Date(mes + "-15T12:00:00Z").toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

// ── IVA · MODELO 303 ────────────────────────────────────────
export interface Res303 {
  q: number;
  rep: { tipo: number; base: number; iva: number }[];
  intraBase: number; intraIva: number;
  ispBase: number; ispIva: number;
  devengado: number;
  corrBase: number; corrIva: number;
  invBase: number; invIva: number;
  ueBase: number; ueIva: number;
  ueInvBase: number; ueInvIva: number;
  deducible: number;
  resultado: number;
  entregasUE: number;
  otrasSinIva: number;
  compensado: number;
  final: number;
  pendienteCompensar: number;
}
export function calcular303(lineas: Linea[], compensarInicio = 0): Res303[] {
  let bolsa = Math.max(0, compensarInicio);
  const out: Res303[] = [];
  for (let q = 1; q <= 4; q++) {
    const ls = lineas.filter((l) => l.q === q);
    const rep: Record<string, { tipo: number; base: number; iva: number }> = {};
    const r: Res303 = {
      q, rep: [], intraBase: 0, intraIva: 0, ispBase: 0, ispIva: 0, devengado: 0, corrBase: 0, corrIva: 0, invBase: 0, invIva: 0,
      ueBase: 0, ueIva: 0, ueInvBase: 0, ueInvIva: 0, deducible: 0, resultado: 0, entregasUE: 0, otrasSinIva: 0,
      compensado: 0, final: 0, pendienteCompensar: 0,
    };
    for (const l of ls) {
      if (l.tipo === "ingreso") {
        if (l.regimen === "general") {
          const k = String(l.ivaTipo);
          rep[k] = rep[k] || { tipo: l.ivaTipo, base: 0, iva: 0 };
          rep[k].base += l.base; rep[k].iva += l.iva;
        } else if (l.regimen === "intracomunitario") r.entregasUE += l.base;
        else r.otrasSinIva += l.base;
        continue;
      }
      const ded = (l.deducible ?? 100) / 100;
      const cuotaAuto = l.iva || r2(l.base * (l.ivaTipo || 21) / 100);
      if (l.regimen === "intracomunitario") {
        r.intraBase += l.base; r.intraIva += cuotaAuto;
        if (l.inversion) { r.ueInvBase += l.base * ded; r.ueInvIva += cuotaAuto * ded; }
        else { r.ueBase += l.base * ded; r.ueIva += cuotaAuto * ded; }
      } else if (l.regimen === "isp_extranjero") {
        r.ispBase += l.base; r.ispIva += cuotaAuto;
        if (l.inversion) { r.invBase += l.base * ded; r.invIva += cuotaAuto * ded; }
        else { r.corrBase += l.base * ded; r.corrIva += cuotaAuto * ded; }
      } else if (l.regimen === "general" && l.iva && !l.sinNifIva) {
        if (l.inversion) { r.invBase += l.base * ded; r.invIva += l.iva * ded; }
        else { r.corrBase += l.base * ded; r.corrIva += l.iva * ded; }
      }
    }
    r.rep = Object.values(rep).sort((a, b) => b.tipo - a.tipo).map((x) => ({ tipo: x.tipo, base: r2(x.base), iva: r2(x.iva) }));
    for (const k of ["intraBase", "intraIva", "ispBase", "ispIva", "corrBase", "corrIva", "invBase", "invIva", "ueBase", "ueIva", "ueInvBase", "ueInvIva", "entregasUE", "otrasSinIva"] as const) {
      (r as any)[k] = r2((r as any)[k]);
    }
    r.devengado = r2(r.rep.reduce((s, x) => s + x.iva, 0) + r.intraIva + r.ispIva);
    r.deducible = r2(r.corrIva + r.invIva + r.ueIva + r.ueInvIva);
    r.resultado = r2(r.devengado - r.deducible);
    r.compensado = r2(Math.min(bolsa, Math.max(0, r.resultado)));
    bolsa = r2(bolsa - r.compensado);
    r.final = r2(r.resultado - r.compensado);
    if (r.final < 0 && q < 4) { bolsa = r2(bolsa - r.final); r.pendienteCompensar = bolsa; r.final = r2(r.final); }
    else r.pendienteCompensar = bolsa;
    out.push(r);
  }
  return out;
}

// ── IRPF · MODELO 130 (acumulado desde el 1 de enero) ───────
export interface Res130 {
  q: number;
  ingresos: number;
  gastosFacturas: number;
  amortizacion: number;
  dificil: number;
  gastos: number;
  neto: number;
  veinte: number;
  anteriores: number;
  retenciones: number;
  c07: number;
  minoracion: number;
  c14: number;
  negativosAnt: number;
  resultado: number;
}
export function minoracion130(rendimientoAnterior: number | null | undefined) {
  const r = Number(rendimientoAnterior ?? 0) || 0;
  if (r <= 9000) return 100;
  if (r <= 10000) return 75;
  if (r <= 11000) return 50;
  if (r <= 12000) return 25;
  return 0;
}
export function calcular130(lineas: Linea[], cfg: FiscalConfig): Res130[] {
  const pct = (cfg.dificil_pct ?? 5) / 100;
  const minor = minoracion130(cfg.rendimiento_anterior);
  let pagados = 0;
  let negativos = 0;
  const out: Res130[] = [];
  for (let q = 1; q <= 4; q++) {
    const hasta = lineas.filter((l) => l.q <= q);
    const ingresos = r2(hasta.filter((l) => l.tipo === "ingreso").reduce((s, l) => s + l.base, 0));
    const gastosFacturas = r2(hasta.filter((l) => l.tipo === "gasto" && !l.inversion).reduce((s, l) => s + l.base * (l.deducible ?? 100) / 100, 0));
    const amortizacion = r2(hasta.filter((l) => l.tipo === "gasto" && l.inversion).reduce((s, l) => {
      const anios = l.amortAnios && l.amortAnios > 0 ? l.amortAnios : 4;
      const meses = Math.max(0, q * 3 - (Number(l.fecha.slice(5, 7)) - 1));
      return s + (l.base * (l.deducible ?? 100) / 100) / anios * Math.min(12, meses) / 12;
    }, 0));
    const previo = ingresos - gastosFacturas - amortizacion;
    const dificil = r2(Math.min(2000, Math.max(0, previo) * pct));
    const gastos = r2(gastosFacturas + amortizacion + dificil);
    const neto = r2(ingresos - gastos);
    const veinte = r2(Math.max(0, neto) * 0.2);
    const retenciones = r2(hasta.filter((l) => l.tipo === "ingreso").reduce((s, l) => s + l.irpf, 0));
    const c07 = r2(veinte - pagados - retenciones);
    const c14 = r2(c07 - minor);
    const negativosAnt = c14 > 0 ? r2(Math.min(negativos, c14)) : 0;
    negativos = r2(negativos - negativosAnt);
    const resultado = r2(c14 - negativosAnt);
    if (resultado < 0) negativos = r2(negativos - resultado);
    out.push({ q, ingresos, gastosFacturas, amortizacion, dificil, gastos, neto, veinte, anteriores: pagados, retenciones, c07, minoracion: minor, c14, negativosAnt, resultado });
    pagados = r2(pagados + Math.max(0, c07));
  }
  return out;
}

// ── 111 · 349 · 347 ─────────────────────────────────────────
export function calcular111(lineas: Linea[]) {
  const ls = lineas.filter((l) => l.tipo === "gasto" && l.irpf > 0);
  const perceptores = new Set(ls.map((l) => (l.nif || l.tercero || "?").toUpperCase()));
  return { n: perceptores.size, base: r2(ls.reduce((s, l) => s + l.base, 0)), retenciones: r2(ls.reduce((s, l) => s + l.irpf, 0)), lineas: ls };
}
export function calcular349(lineas: Linea[]) {
  const m: Record<string, { nif: string; nombre: string; clave: "I" | "S"; base: number }> = {};
  for (const l of lineas.filter((x) => x.regimen === "intracomunitario")) {
    const clave = l.tipo === "gasto" ? "I" : "S";
    const k = clave + "|" + (l.nif || l.tercero || "?");
    m[k] = m[k] || { nif: l.nif || "Sin NIF", nombre: l.tercero || "—", clave, base: 0 };
    m[k].base += l.base;
  }
  return Object.values(m).map((x) => ({ ...x, base: r2(x.base) })).sort((a, b) => b.base - a.base);
}
export function calcular347(lineas: Linea[]) {
  const m: Record<string, { nif: string | null; nombre: string; lado: "Ventas" | "Compras"; total: number; t: number[] }> = {};
  for (const l of lineas) {
    if (l.pais && l.pais !== "ES") continue;
    if (!["general", "exento"].includes(l.regimen)) continue;
    if (l.irpf > 0 || l.fuente === "autonomos") continue;
    const lado = l.tipo === "ingreso" ? "Ventas" : "Compras";
    const k = lado + "|" + ((l.nif || "").toUpperCase() || (l.tercero || "?").toLowerCase());
    m[k] = m[k] || { nif: l.nif, nombre: l.tercero || "—", lado, total: 0, t: [0, 0, 0, 0] };
    m[k].total += l.total;
    m[k].t[l.q - 1] += l.total;
  }
  return Object.values(m).filter((x) => x.total > 3005.06)
    .map((x) => ({ ...x, total: r2(x.total), t: x.t.map(r2) })).sort((a, b) => b.total - a.total);
}

// ── CSV para la gestoría ────────────────────────────────────
export function csvLibro(lineas: Linea[]) {
  const fuente: Record<string, string> = { factura: "Factura del panel", apunte: "Factura subida / a mano", comision: "Cobro de comisión (sin factura subida)", publicidad: "Gasto de campañas (sin factura subida)", autonomos: "Seguridad Social (ajuste)" };
  const cab = ["Tipo", "Fecha", "Trimestre", "Nº factura", "Cliente o proveedor", "NIF", "País", "Concepto", "Categoría", "Base", "% IVA", "IVA", "Régimen IVA", "% Retención", "Retención", "Total", "% Deducible", "Origen", "Estimado", "Entra en los modelos", "Aviso"];
  const n = (x: number) => fmtNum(x).replace(/\./g, "");
  const esc = (s: unknown) => { const t = String(s ?? ""); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const filas = lineas.map((l) => [
    l.tipo === "ingreso" ? "Ingreso" : "Gasto", l.fecha, l.q + "T", l.numero || "", l.tercero || "", l.nif || "", l.pais, l.concepto,
    nombreCategoria(l.tipo, l.categoria), n(l.base), n(l.ivaTipo), n(l.iva), nombreRegimen(l.regimen), n(l.irpfTipo), n(l.irpf), n(l.total),
    n(l.deducible), fuente[l.fuente] || l.fuente, l.estimado ? "Sí" : "No", l.fuera ? "No (antes del alta)" : "Sí", l.aviso || "",
  ].map(esc).join(";"));
  return "﻿" + [cab.join(";"), ...filas].join("\r\n");
}
export function descargarTexto(nombre: string, texto: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ── FORMULARIO DE UN APUNTE (factura de gasto o de ingreso) ─
export function apunteVacio(tipo: "ingreso" | "gasto" = "gasto"): Apunte {
  return {
    tipo, fecha: hoyMadrid(), numero: null, tercero_nombre: null, tercero_nif: null, tercero_pais: "ES", concepto: null,
    categoria: tipo === "gasto" ? "otros" : "otros", base: 0, iva_tipo: 21, iva_importe: 0, iva_regimen: "general",
    irpf_tipo: 0, irpf_importe: 0, total: 0, deducible_pct: 100, inversion: false, amort_anios: null,
    plataforma: null, periodo: null, archivo_id: null, notas: null,
  };
}

const txt = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "" : (Math.round(n * 100) / 100).toFixed(2).replace(".", ","));

export function FormApunte({ inicial, roi, archivoNombre, onClose, onGuardado, onVerArchivo }: {
  inicial: Partial<Apunte>;
  roi?: string;
  archivoNombre?: string | null;
  onClose: () => void;
  onGuardado: (id: string | null, mensaje: string) => void;
  onVerArchivo?: () => void;
}) {
  const ini = { ...apunteVacio(inicial.tipo || "gasto"), ...inicial } as Apunte;
  const [a, setA] = useState<Apunte>(ini);
  const [base, setBase] = useState(txt(ini.base || null));
  const [iva, setIva] = useState(txt(ini.iva_importe || null));
  const [irpf, setIrpf] = useState(txt(ini.irpf_importe || null));
  const [total, setTotal] = useState(txt(ini.total || null));
  const [manual, setManual] = useState({ iva: !!ini.id, irpf: !!ini.id, total: !!ini.id });
  const [ocupado, setOcupado] = useState(false);
  const [err, setErr] = useState("");

  const set = (c: Partial<Apunte>) => setA((x) => ({ ...x, ...c }));
  const sinIva = a.iva_regimen === "exento" || a.iva_regimen === "no_sujeto";
  const nBase = aNumero(base);
  const ivaCalc = sinIva ? 0 : r2((Number.isNaN(nBase) ? 0 : nBase) * (a.iva_tipo || 0) / 100);
  const irpfCalc = r2((Number.isNaN(nBase) ? 0 : nBase) * (a.irpf_tipo || 0) / 100);
  const nIva = manual.iva && !sinIva ? aNumero(iva) : ivaCalc;
  const nIrpf = manual.irpf ? aNumero(irpf) : irpfCalc;
  const totalCalc = r2((Number.isNaN(nBase) ? 0 : nBase) + (a.iva_regimen === "general" ? (Number.isNaN(nIva) ? 0 : nIva) : 0) - (Number.isNaN(nIrpf) ? 0 : nIrpf));
  const nTotal = manual.total ? aNumero(total) : totalCalc;

  const cats = a.tipo === "ingreso" ? CAT_INGRESO : CAT_GASTO;
  const q = a.fecha ? trimestreDe(a.fecha) : 0;
  const ded = (a.deducible_pct ?? 100) / 100;

  const aplicar = (p: Plantilla) => {
    set({ ...p.a });
    setManual((m) => ({ ...m, iva: false, irpf: false, total: false }));
  };

  const guardar = async () => {
    setErr("");
    if (!a.fecha) { setErr("Falta la fecha de la factura"); return; }
    if (Number.isNaN(nBase) || Number.isNaN(nIva) || Number.isNaN(nIrpf) || Number.isNaN(nTotal)) { setErr("Revisa los importes: hay alguno que no es un número"); return; }
    if (!nBase && !nTotal) { setErr("Falta el importe"); return; }
    if (a.plataforma && !a.periodo) { setErr("Indica de qué mes es la factura de publicidad"); return; }
    setOcupado(true);
    const p = {
      ...a, base: r2(nBase), iva_importe: sinIva ? 0 : r2(nIva), irpf_importe: r2(nIrpf), total: r2(nTotal),
      iva_tipo: sinIva ? 0 : a.iva_tipo, plataforma: a.categoria === "publicidad" ? a.plataforma : null,
      amort_anios: a.inversion ? (a.amort_anios || 4) : null,
    };
    const { data, error } = await db.rpc("fiscal_guardar", { p_admin: claveAdmin(), p });
    setOcupado(false);
    if (error) { setErr(error.message); return; }
    onGuardado(data as string, a.id ? "Datos actualizados" : a.tipo === "gasto" ? "Gasto apuntado" : "Ingreso apuntado");
  };
  const anular = async () => {
    if (!a.id || !confirm("¿Quitar este apunte de Impuestos? El archivo, si lo hay, se queda en Archivos.")) return;
    setOcupado(true);
    const { error } = await db.rpc("fiscal_anular", { p_admin: claveAdmin(), p_id: a.id });
    setOcupado(false);
    if (error) { setErr(error.message); return; }
    onGuardado(null, "Apunte quitado");
  };

  const chip = (activo: boolean, texto: string, onClick: () => void) => (
    <button key={texto} onClick={onClick} style={{
      padding: "7px 11px", borderRadius: 99, border: "1px solid " + (activo ? C.accent : C.border), cursor: "pointer",
      background: activo ? C.accent + "18" : C.card, color: activo ? C.accent : C.mutedL, fontFamily: F, fontWeight: 700, fontSize: 12.5,
    }}>{texto}</button>
  );
  const fila = (children: React.ReactNode) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0 12px" }}>{children}</div>;
  const etiqueta = (t: string) => <label style={{ display: "block", fontSize: 12, color: C.mutedL, marginBottom: 5, fontWeight: 700 }}>{t}</label>;
  const selSt = { width: "100%", marginBottom: 12, padding: "10px 10px" };

  return (
    <Modal titulo={a.id ? "Datos fiscales" : a.tipo === "gasto" ? "Apuntar un gasto" : "Apuntar un ingreso"} onClose={onClose} ancho={640}>
      {archivoNombre && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: C.card, border: "1px solid " + C.border, borderRadius: 9, padding: "9px 12px", marginBottom: 14, fontSize: 13 }}>
          <span style={{ color: C.mutedL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {archivoNombre}</span>
          {onVerArchivo && <Btn small outline onClick={onVerArchivo}>Ver</Btn>}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {chip(a.tipo === "gasto", "Gasto (factura recibida)", () => set({ tipo: "gasto", categoria: "otros" }))}
        {chip(a.tipo === "ingreso", "Ingreso (factura emitida)", () => set({ tipo: "ingreso", categoria: "otros", plataforma: null }))}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 700 }}>Rellenar rápido</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {plantillas(a.tipo, roi).map((p) => chip(false, p.l, () => aplicar(p)))}
      </div>

      {fila(<>
        <Campo label="Fecha de la factura" type="date" value={a.fecha || ""} onChange={(v: string) => set({ fecha: v })} />
        <Campo label="Nº de factura" value={a.numero || ""} onChange={(v: string) => set({ numero: v })} placeholder="Opcional" />
      </>)}
      {fila(<>
        <Campo label={a.tipo === "gasto" ? "Proveedor" : "Cliente"} value={a.tercero_nombre || ""} onChange={(v: string) => set({ tercero_nombre: v })} />
        <Campo label="NIF" value={a.tercero_nif || ""} onChange={(v: string) => set({ tercero_nif: v })} placeholder="B12345678 / IE…" />
        <Campo label="País" value={a.tercero_pais || ""} onChange={(v: string) => set({ tercero_pais: v.toUpperCase().slice(0, 2) })} placeholder="ES" />
      </>)}
      <Campo label="Concepto" value={a.concepto || ""} onChange={(v: string) => set({ concepto: v })} placeholder={a.tipo === "gasto" ? "Qué has comprado o contratado" : "Qué has facturado"} />
      {fila(<>
        <div>{etiqueta("Categoría")}<Sel value={a.categoria} onChange={(v) => set({ categoria: v, plataforma: v === "publicidad" ? a.plataforma : null })} options={cats} style={selSt} /></div>
        <div>{etiqueta("IVA")}<Sel value={a.iva_regimen} onChange={(v) => { set({ iva_regimen: v as Regimen, iva_tipo: v === "exento" || v === "no_sujeto" ? 0 : (a.iva_tipo || 21) }); setManual((m) => ({ ...m, iva: false, total: false })); }} options={REGIMENES.map((r) => ({ v: r.v, l: r.l }))} style={selSt} /></div>
      </>)}
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: -6, marginBottom: 12 }}>{REGIMENES.find((r) => r.v === a.iva_regimen)?.ayuda}</div>

      {fila(<>
        <Campo label="Base (sin IVA) €" value={base} inputMode="decimal" onChange={(v: string) => { setBase(v); }} placeholder="0,00" />
        {!sinIva && <div>{etiqueta("% IVA")}<Sel value={String(a.iva_tipo)} onChange={(v) => { set({ iva_tipo: Number(v) }); setManual((m) => ({ ...m, iva: false })); }} options={[21, 10, 4, 0].map((n) => ({ v: String(n), l: n + " %" }))} style={selSt} /></div>}
        {!sinIva && <Campo label={a.iva_regimen === "general" ? "IVA €" : "IVA a declarar €"} value={manual.iva ? iva : txt(ivaCalc)} inputMode="decimal" onChange={(v: string) => { setIva(v); setManual((m) => ({ ...m, iva: true })); }} />}
      </>)}
      {fila(<>
        <div>{etiqueta(a.tipo === "gasto" ? "Retención que practicas" : "Retención que te hacen")}<Sel value={String(a.irpf_tipo)} onChange={(v) => { set({ irpf_tipo: Number(v) }); setManual((m) => ({ ...m, irpf: false })); }} options={[0, 7, 15, 19].map((n) => ({ v: String(n), l: n ? n + " %" : "Sin retención" }))} style={selSt} /></div>
        {a.irpf_tipo > 0 && <Campo label="Retención €" value={manual.irpf ? irpf : txt(irpfCalc)} inputMode="decimal" onChange={(v: string) => { setIrpf(v); setManual((m) => ({ ...m, irpf: true })); }} />}
        <Campo label="Total factura €" value={manual.total ? total : txt(totalCalc)} inputMode="decimal" onChange={(v: string) => { setTotal(v); setManual((m) => ({ ...m, total: true })); }} />
      </>)}

      {a.tipo === "gasto" && fila(<>
        <Campo label="% que es del negocio" value={String(a.deducible_pct ?? 100)} inputMode="numeric" onChange={(v: string) => set({ deducible_pct: Math.max(0, Math.min(100, Number(v.replace(/[^0-9]/g, "")) || 0)) })}
          ayuda="100 si es solo del negocio; p. ej. 50 si el móvil también es personal" />
        <div style={{ marginBottom: 12 }}>
          {etiqueta("¿Dura varios años?")}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text, cursor: "pointer", padding: "9px 0" }}>
            <input type="checkbox" checked={a.inversion} onChange={(e) => set({ inversion: e.target.checked, amort_anios: e.target.checked ? (a.amort_anios || 4) : null })} />
            Ordenador, móvil, mobiliario… (más de 300 €)
          </label>
          {a.inversion && <Campo label="Años para repartir el gasto" value={String(a.amort_anios || 4)} inputMode="numeric" onChange={(v: string) => set({ amort_anios: Math.max(1, Math.min(50, Number(v.replace(/[^0-9]/g, "")) || 4)) })} ayuda="Equipos informáticos: 4 años" />}
        </div>
      </>)}

      {a.tipo === "gasto" && a.categoria === "publicidad" && fila(<>
        <div>{etiqueta("Plataforma")}<Sel value={a.plataforma || ""} onChange={(v) => set({ plataforma: (v || null) as any })} options={[{ v: "", l: "Otra" }, { v: "google", l: "Google Ads" }, { v: "meta", l: "Meta" }]} style={selSt} /></div>
        {a.plataforma && <Campo label="Mes que factura" type="month" value={a.periodo || (a.fecha ? a.fecha.slice(0, 7) : "")} onChange={(v: string) => set({ periodo: v || null })}
          ayuda="Sustituye al gasto de campañas de ese mes" />}
      </>)}
      {a.tipo === "gasto" && a.categoria === "autonomos" && (
        <Campo label="Mes que pagas" type="month" value={a.periodo || (a.fecha ? a.fecha.slice(0, 7) : "")} onChange={(v: string) => set({ periodo: v || null })} ayuda="Sustituye al importe fijo de ese mes en Ajustes" />
      )}
      {a.tipo === "ingreso" && a.categoria === "comisiones" && (
        <Campo label="Mes de las comisiones" type="month" value={a.periodo || (a.fecha ? a.fecha.slice(0, 7) : "")} onChange={(v: string) => set({ periodo: v || null })} ayuda="Las facturas de comisión de ese mes sustituyen a los cobros apuntados" />
      )}
      <Campo label="Notas" value={a.notas || ""} onChange={(v: string) => set({ notas: v })} multilinea placeholder="Opcional" />

      {!Number.isNaN(nBase) && nBase > 0 && a.fecha && (
        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 9, padding: "10px 12px", fontSize: 12.5, color: C.mutedL, lineHeight: 1.55, marginBottom: 12 }}>
          Cuenta en el <b style={{ color: C.text }}>{q}T {a.fecha.slice(0, 4)}</b>
          {a.tipo === "gasto" ? <>
            {a.iva_regimen === "general" && nIva > 0 && (a.tercero_nif
              ? <> · IVA que te descuentas: <b style={{ color: C.green }}>{eur(nIva * ded, 2)}</b></>
              : <> · <b style={{ color: C.orange }}>Pon el NIF del proveedor</b>: sin él no te descuentas los {eur(nIva * ded, 2)} de IVA</>)}
            {(a.iva_regimen === "intracomunitario" || a.iva_regimen === "isp_extranjero") && <> · IVA: suma y resta {eur(ivaCalc, 2)} (sale a 0)</>}
            {" "}· Gasto para el IRPF: <b style={{ color: C.text }}>{a.inversion ? eur(nBase * ded / (a.amort_anios || 4), 2) + " al año" : eur(nBase * ded, 2)}</b>
          </> : <>
            {a.iva_regimen === "general" && <> · IVA a pagar: <b style={{ color: C.orange }}>{eur(nIva, 2)}</b></>}
            {" "}· Ingreso para el IRPF: <b style={{ color: C.text }}>{eur(nBase, 2)}</b>
          </>}
        </div>
      )}
      {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={guardar} disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar"}</Btn>
          <Btn outline color={C.mutedL} onClick={onClose}>Cancelar</Btn>
        </div>
        {a.id && <Btn outline color={C.red} onClick={anular} disabled={ocupado}>Quitar de Impuestos</Btn>}
      </div>
    </Modal>
  );
}

// Resumen de una línea para mostrar en tablas
export function useTotales(lineas: Linea[]) {
  return useMemo(() => {
    const ing = lineas.filter((l) => l.tipo === "ingreso");
    const gas = lineas.filter((l) => l.tipo === "gasto");
    return {
      ingresos: r2(ing.reduce((s, l) => s + l.base, 0)),
      gastos: r2(gas.reduce((s, l) => s + (l.inversion ? 0 : l.base * (l.deducible ?? 100) / 100), 0)),
      estimados: lineas.filter((l) => l.estimado).length,
    };
  }, [lineas]);
}
