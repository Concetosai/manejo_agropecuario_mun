/**
 * FASE_RECORDATORIOS: Utilidades para recordatorios de vencimiento
 * 
 * - Detecta certificados por vencer (≤ 5 días hábiles)
 * - Genera plantilla de WhatsApp
 * - Abre WhatsApp Desktop (whatsapp://send)
 * - Anti-duplicado con localStorage (TTL 7 días)
 */

import { GoogleRegistro } from '../services/googleSheetsService';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════

const DIAS_ALERTA = 30; // Alertar cuando falten ≤ 5 días hábiles
const DIAS_ANTI_DUPLICADO = 7; // No enviar más de 1 vez cada 7 días
const STORAGE_KEY = 'panuco_recordatorios_enviados_v1';

// Feriados oficiales en México (fijos + móviles aproximados)
const FERIADOS_MEXICO = [
  '01-01', // Año Nuevo
  '02-05', // Constitución (primer lunes de febrero, aprox)
  '03-21', // Natalicio Benito Juárez (tercer lunes de marzo, aprox)
  '05-01', // Día del Trabajo
  '09-16', // Independencia
  '11-20', // Revolución Mexicana (tercer lunes de noviembre, aprox)
  '12-25', // Navidad
];

// ═══════════════════════════════════════════════════════════════════
// CÁLCULO DE DÍAS HÁBILES
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica si una fecha es día hábil (L-V, sin feriados)
 */
function esDiaHabil(fecha: Date): boolean {
  const dia = fecha.getDay(); // 0 = domingo, 6 = sábado
  if (dia === 0 || dia === 6) return false;

  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const diaMes = String(fecha.getDate()).padStart(2, '0');
  const mmdd = `${mes}-${diaMes}`;

  return !FERIADOS_MEXICO.includes(mmdd);
}

/**
 * Parsea la fecha de vencimiento (formato YYYY-MM-DD)
 */
export function parsearFechaVencimiento(fechaStr?: string | null): Date | null {
  if (!fechaStr) return null;
  try {
    // Acepta: "2026-10-20" o "20/10/2026" o "20 DE OCTUBRE DE 2026"
    const clean = String(fechaStr).trim();

    // Formato ISO: YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }

    // Formato: DD/MM/YYYY
    const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      return new Date(parseInt(slashMatch[3]), parseInt(slashMatch[2]) - 1, parseInt(slashMatch[1]));
    }

    // Fallback: intentar Date nativo
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) return parsed;

    return null;
  } catch {
    return null;
  }
}

/**
 * Calcula días hábiles restantes entre hoy y la fecha de vencimiento
 * (excluye sábados, domingos y feriados)
 */
export function calcularDiasHabiles(fechaVencimiento?: string | null): number {
  const fecha = parsearFechaVencimiento(fechaVencimiento);
  if (!fecha) return -999;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);

  if (fecha < hoy) return -1; // Ya venció

  let dias = 0;
  const cursor = new Date(hoy);
  cursor.setDate(cursor.getDate() + 1); // Empezar desde mañana

  while (cursor <= fecha) {
    if (esDiaHabil(cursor)) {
      dias++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dias;
}

/**
 * Formatea fecha de vencimiento para mostrar al usuario
 */
export function formatearFechaVencimiento(fechaStr?: string | null): string {
  const fecha = parsearFechaVencimiento(fechaStr);
  if (!fecha) return '—';

  const meses = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];

  return `${fecha.getDate()} DE ${meses[fecha.getMonth()]} DE ${fecha.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════════
// VALIDACIÓN DE CONTACTO
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica si el productor tiene teléfono válido (10 dígitos)
 */
export function tieneTelefonoValido(registro: GoogleRegistro): boolean {
  const tel = String(registro.telefono || '').replace(/\D/g, '');
  return tel.length === 10;
}

/**
 * Verifica si el productor tiene email válido
 */
export function tieneEmailValido(registro: GoogleRegistro): boolean {
  const email = String(registro.email || '').trim();
  return email.length > 5 && email.includes('@');
}

// ═══════════════════════════════════════════════════════════════════
// PLANTILLA DE WHATSAPP
// ═══════════════════════════════════════════════════════════════════

export function getWhatsAppRecordatorio(registro: GoogleRegistro, diasRestantes: number): string {
  const fechaVenc = formatearFechaVencimiento(registro.vigencia);

  const texto =
    `🔔 *RECORDATORIO DE REVALIDACIÓN*\n\n` +
    `Estimado(a) *${registro.nombre_productor}*,\n\n` +
    `Le informamos que su certificado de fierro quemador con folio *${registro.folio}* vence el próximo *${fechaVenc}* (${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} hábil${diasRestantes !== 1 ? 'es' : ''}).\n\n` +
    `⚠️ *IMPORTANTE:* Acuda a la Mesa de Ganadería antes del vencimiento para evitar multas por pago extemporáneo.\n\n` +
    `📅 Le recomendamos agendar su cita cuanto antes.\n` +
    `📍 H. Ayuntamiento de Pánuco, Ver.\n` +
    `🏛 Dirección de Fomento Agropecuario\n` +
    `📞 846-109-6645\n\n` +
    `Ley Ganadera del Estado de Veracruz`;

  return encodeURIComponent(texto);
}

/**
 * Abre WhatsApp Desktop con el chat y texto prediseñado
 */
export function abrirWhatsAppRecordatorio(registro: GoogleRegistro, diasRestantes: number): boolean {
  const tel = String(registro.telefono || '').replace(/\D/g, '');
  if (tel.length !== 10) return false;

  const numeroConPais = `52${tel}`; // 52 = México
  const texto = getWhatsAppRecordatorio(registro, diasRestantes);

  // Protocolo que abre WhatsApp Desktop si está instalado
  const url = `whatsapp://send?phone=${numeroConPais}&text=${texto}`;

  // Fallback a WhatsApp Web si Desktop no está
  window.open(url, '_blank');

  return true;
}

// ═══════════════════════════════════════════════════════════════════
// ANTI-DUPLICADO (localStorage con TTL 7 días)
// ═══════════════════════════════════════════════════════════════════

interface RecordatoriosEnviados {
  [folio: string]: number; // timestamp
}

function getRecordatoriosEnviados(): RecordatoriosEnviados {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveRecordatoriosEnviados(data: RecordatoriosEnviados): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * Marca un folio como "recordatorio enviado" (timestamp actual)
 */
export function marcarRecordatorioEnviado(folio: string): void {
  if (!folio) return;
  const data = getRecordatoriosEnviados();
  data[folio] = Date.now();
  saveRecordatoriosEnviados(data);
}

/**
 * Verifica si ya se envió un recordatorio en los últimos 7 días
 */
export function fueEnviadoRecientemente(folio: string): boolean {
  const data = getRecordatoriosEnviados();
  const ts = data[folio];
  if (!ts) return false;

  const diffDias = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return diffDias < DIAS_ANTI_DUPLICADO;
}

/**
 * Limpia recordatorios antiguos (> 30 días)
 */
export function limpiarRecordatoriosAntiguos(): void {
  const data = getRecordatoriosEnviados();
  const ahora = Date.now();
  const limpieza: RecordatoriosEnviados = {};

  Object.entries(data).forEach(([folio, ts]) => {
    const diffDias = (ahora - ts) / (1000 * 60 * 60 * 24);
    if (diffDias < 30) {
      limpieza[folio] = ts;
    }
  });

  saveRecordatoriosEnviados(limpieza);
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN EXPORTADA
// ═══════════════════════════════════════════════════════════════════

export const RECORDATORIOS_CONFIG = {
  DIAS_ALERTA,
  DIAS_ANTI_DUPLICADO,
};