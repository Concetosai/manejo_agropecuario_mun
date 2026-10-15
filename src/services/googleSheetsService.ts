/**
 * Servicio de Comunicación con Google Apps Script
 * 
 * Backend: Google Apps Script Web App
 * Almacena en: Google Sheets (registros) · Cloudinary (imagenes)
 * 
 * VERSIÓN 2.1 · 10/Oct/2026
 * 
 * Provee:
 * - Guardar/actualizar registros en el Sheet
 * - Subir imágenes a Cloudinary (ver cloudinaryService.ts para el upload real)
 * - Leer registros (todos o por folio)
 * - Trámites 2026: revalidar, cancelar, constancia, degüello, buscar propietario
 * - Ciclo de pago: confirmar recibo + marcar entrega
 * - Cola offline en localStorage si falla el internet
 */

const GOOGLE_API_URL = (import.meta as any).env?.VITE_GOOGLE_API_URL || '';
const GOOGLE_TOKEN = (import.meta as any).env?.VITE_GOOGLE_TOKEN || '';

const OFFLINE_QUEUE_KEY = 'panuco_offline_queue_v1';

// =========================================================================
// TIPOS
// =========================================================================

export interface GoogleRegistro {
  id_registro?: string;
  id_registro_tipo?: string;
  folio?: string;
  nombre_productor?: string;
  curp?: string;
  rfc?: string;
  ine?: string;
  telefono?: string;
  email?: string;
  domicilio?: string;
  municipio?: string;
  ejido?: string;
  predio?: string;
  superficie?: string;
  tenencia?: string;
  cantidad_ganado?: string;
  especie?: string;
  fin_zootecnico?: string;
  upp?: string;
  numero_registro?: string;
  libro?: string;
  foja?: string;
  fecha_expedicion?: string;
  vigencia?: string;
  iniciales?: string;
  hash_vector?: string;
  // Vector 64D
  vector_64d?: number[];
  vector_checksum?: string;
  vector_density?: number;
  vector_symmetry_h?: number;
  vector_symmetry_v?: number;
  vector_proportions?: string;
  vector_varianza?: number;
  // URLs de imágenes
  url_ine?: string;
  url_ficha?: string;
  url_fierro?: string;
  url_certificado?: string;
  url_foto_titular?: string;
  url_firma?: string;
  // Metadata
  operador?: string;
  fecha_captura?: string;
  // Estatus y baja
  estatus?: 'ACTIVO' | 'REVALIDADO' | 'CANCELADO' | 'SUSPENDIDO' | string;
  fecha_baja?: string;
  motivo_baja?: string;
  operador_baja?: string;
}

export interface GoogleApiResponse {
  success: boolean;
  error?: string;
  action?: string;
  folio?: string;
  row?: number;
  fileId?: string;
  url?: string;
  filename?: string;
  registros?: GoogleRegistro[];
  registro?: GoogleRegistro;
  total?: number;
}

export interface OfflineQueueItem {
  id: string;
  type: 'guardarRegistro' | 'subirImagen';
  payload: any;
  timestamp: number;
  retries: number;
}

// Tipos para Constancias y Degüellos
export interface GoogleConstancia {
  id_constancia?: string;
  folio_constancia?: string;
  folio_fierro?: string;
  tipo?: 'CONSTANCIA' | 'REPOSICION_PATENTE' | string;
  nombre_productor?: string;
  curp?: string;
  rfc?: string;
  proposito?: string;
  operador?: string;
  fecha_emision?: string;
  url_pdf?: string;
}

export interface GoogleDeguello {
  id_deguello?: string;
  folio_guia?: string;
  folio_fierro?: string;
  nombre_introductor?: string;
  especie?: string;
  numero_cabezas?: number;
  cuota_por_cabeza?: number;
  monto_total?: number;
  instalacion?: string;
  guia_transito?: string;
  certificado_sanitario?: string;
  inspector_mvz?: string;
  fecha_sacrificio?: string;
  operador?: string;
}

// =========================================================================
// COLA OFFLINE
// =========================================================================

function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineQueueItem[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('No se pudo guardar la cola offline:', err);
  }
}

function addToOfflineQueue(type: OfflineQueueItem['type'], payload: any): OfflineQueueItem {
  const queue = getOfflineQueue();
  const item: OfflineQueueItem = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };
  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

export function getQueueCount(): number {
  return getOfflineQueue().length;
}

export async function processOfflineQueue(): Promise<{ processed: number; failed: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  const remaining: OfflineQueueItem[] = [];
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      let result: GoogleApiResponse;
      if (item.type === 'guardarRegistro') {
        result = await callGoogleApi('guardarRegistro', 'POST', item.payload);
      } else {
        result = await callGoogleApi('subirImagen', 'POST', item.payload);
      }

      if (result.success) {
        processed++;
      } else {
        item.retries++;
        if (item.retries < 5) {
          remaining.push(item);
        }
        failed++;
      }
    } catch (err) {
      item.retries++;
      if (item.retries < 5) {
        remaining.push(item);
      }
      failed++;
    }
  }

  saveOfflineQueue(remaining);
  return { processed, failed };
}

// =========================================================================
// LLAMADA PRINCIPAL
// =========================================================================

async function callGoogleApi(
  action: string,
  method: 'GET' | 'POST' = 'POST',
  payload: any = null,
  timeoutMs = 60000
): Promise<GoogleApiResponse> {
  if (!GOOGLE_API_URL || !GOOGLE_TOKEN) {
    throw new Error('Configuración de Google API incompleta (revisar .env)');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fullUrl = `${GOOGLE_API_URL}?action=${action}&token=${encodeURIComponent(GOOGLE_TOKEN)}`;

    const options: RequestInit = {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
    };

    if (method === 'POST' && payload) {
      options.body = JSON.stringify({ ...payload, token: GOOGLE_TOKEN });
    }

    const response = await fetch(fullUrl, options);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as GoogleApiResponse;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Timeout al conectar con Google Sheets (15s)');
    }
    throw err;
  }
}

// =========================================================================
// REGISTROS BÁSICOS
// =========================================================================

export async function pingGoogleBackend(): Promise<boolean> {
  try {
    const r = await callGoogleApi('health', 'GET');
    return r.success !== false;
  } catch {
    return false;
  }
}

export async function guardarRegistroEnSheet(registro: GoogleRegistro): Promise<{
  success: boolean;
  action?: string;
  folio?: string;
  queued?: boolean;
  error?: string;
}> {
  try {
    const result = await callGoogleApi('guardarRegistro', 'POST', { data: registro });

    if (result.success) {
      return {
        success: true,
        action: result.action,
        folio: result.folio,
      };
    }

    return {
      success: false,
      error: result.error || 'Error desconocido al guardar',
    };
  } catch (err: any) {
    addToOfflineQueue('guardarRegistro', { data: registro });
    console.warn('Guardado offline en cola:', err.message);

    return {
      success: true,
      queued: true,
      folio: registro.folio,
      error: `Guardado offline (se sincronizará automáticamente): ${err.message}`,
    };
  }
}

export async function obtenerRegistrosDelSheet(folio?: string): Promise<{
  success: boolean;
  registros: GoogleRegistro[];
  total: number;
  error?: string;
}> {
  try {
    const action = folio ? `obtenerRegistro&folio=${encodeURIComponent(folio)}` : 'obtenerRegistros';
    const result = await callGoogleApi(action, 'GET');

    if (result.success) {
      return {
        success: true,
        registros: result.registros || (result.registro ? [result.registro] : []),
        total: result.total || 1,
      };
    }

    return {
      success: false,
      registros: [],
      total: 0,
      error: result.error,
    };
  } catch (err: any) {
    return {
      success: false,
      registros: [],
      total: 0,
      error: err.message,
    };
  }
}

export async function obtenerRegistroPorFolio(folio: string): Promise<{
  success: boolean;
  registro?: GoogleRegistro;
  error?: string;
}> {
  try {
    const result = await callGoogleApi(`obtenerRegistro&folio=${encodeURIComponent(folio)}`, 'GET');

    if (result.success && result.registro) {
      return { success: true, registro: result.registro };
    }

    return {
      success: false,
      error: result.error || 'Registro no encontrado',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}

// =========================================================================
// TRÁMITES 2026
// =========================================================================

export async function revalidarRegistroEnSheet(params: {
  folio: string;
  fecha_nueva_vigencia: string;
  operador: string;
}): Promise<{
  success: boolean;
  folio?: string;
  estatus?: string;
  error?: string;
}> {
  try {
    const result = await callGoogleApi('revalidarRegistro', 'POST', { data: params });

    if (result.success) {
      return {
        success: true,
        folio: params.folio,
        estatus: 'REVALIDADO',
      };
    }

    return { success: false, error: result.error || 'Error al revalidar' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function cancelarRegistroEnSheet(params: {
  folio: string;
  motivo: string;
  operador: string;
}): Promise<{
  success: boolean;
  folio?: string;
  estatus?: string;
  error?: string;
}> {
  try {
    const result = await callGoogleApi('cancelarRegistro', 'POST', {
      data: {
        folio: params.folio,
        motivo: params.motivo,
        operador: params.operador,
      },
    });

    if (result.success) {
      return {
        success: true,
        folio: params.folio,
        estatus: 'CANCELADO',
      };
    }

    return { success: false, error: result.error || 'Error al cancelar' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function emitirConstanciaEnSheet(params: {
  folio: string;
  tipo: 'CONSTANCIA' | 'REPOSICION_PATENTE';
  nombre_productor: string;
  curp?: string;
  rfc?: string;
  proposito?: string;
  operador: string;
}): Promise<{
  success: boolean;
  id_constancia?: string;
  folio_constancia?: string;
  error?: string;
}> {
  try {
    const result = await callGoogleApi('emitirConstancia', 'POST', { data: params });

    if (result.success) {
      return {
        success: true,
        id_constancia: (result as any).id_constancia,
        folio_constancia: (result as any).folio_constancia,
      };
    }

    return { success: false, error: result.error || 'Error al emitir constancia' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function registrarDeguelloEnSheet(params: {
  folio_fierro: string;
  numero_cabezas: number;
  cuota_por_cabeza?: number;
  nombre_introductor: string;
  especie?: string;
  instalacion?: string;
  guia_transito?: string;
  certificado_sanitario?: string;
  inspector_mvz?: string;
  fecha_sacrificio?: string;
  operador: string;
}): Promise<{
  success: boolean;
  id_deguello?: string;
  folio_guia?: string;
  monto?: number;
  error?: string;
}> {
  try {
    const result = await callGoogleApi('registrarDeguello', 'POST', { data: params });

    if (result.success) {
      return {
        success: true,
        id_deguello: (result as any).id_deguello,
        folio_guia: (result as any).folio_guia,
        monto: (result as any).monto,
      };
    }

    return { success: false, error: result.error || 'Error al registrar degüello' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function buscarPropietarioEnSheet(q: string): Promise<{
  success: boolean;
  registro?: GoogleRegistro;
  error?: string;
}> {
  try {
    const result = await callGoogleApi(`buscarPropietario&q=${encodeURIComponent(q)}`, 'GET');

    if (result.success && result.registro) {
      return { success: true, registro: result.registro };
    }

    return {
      success: false,
      error: result.error || 'Propietario no encontrado',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}

// =========================================================================
// LECTURA DE CONSTANCIAS Y DEGÜELLOS
// =========================================================================

export async function obtenerConstanciasDeSheet(params?: {
  folio_fierro?: string;
  curp?: string;
}): Promise<{
  success: boolean;
  constancias: GoogleConstancia[];
  total: number;
  error?: string;
}> {
  try {
    let action = 'obtenerConstancias';
    if (params?.folio_fierro) action += `&folio_fierro=${encodeURIComponent(params.folio_fierro)}`;
    if (params?.curp) action += `&curp=${encodeURIComponent(params.curp)}`;

    const result = await callGoogleApi(action, 'GET');

    if (result.success) {
      return {
        success: true,
        constancias: (result as any).constancias || [],
        total: (result as any).total || 0,
      };
    }

    return {
      success: false,
      constancias: [],
      total: 0,
      error: result.error,
    };
  } catch (err: any) {
    return {
      success: false,
      constancias: [],
      total: 0,
      error: err.message,
    };
  }
}

export async function obtenerDeguellosDeSheet(params?: {
  folio_fierro?: string;
}): Promise<{
  success: boolean;
  deguellos: GoogleDeguello[];
  total: number;
  error?: string;
}> {
  try {
    let action = 'obtenerDeguellos';
    if (params?.folio_fierro) action += `&folio_fierro=${encodeURIComponent(params.folio_fierro)}`;

    const result = await callGoogleApi(action, 'GET');

    if (result.success) {
      return {
        success: true,
        deguellos: (result as any).deguellos || [],
        total: (result as any).total || 0,
      };
    }

    return {
      success: false,
      deguellos: [],
      total: 0,
      error: result.error,
    };
  } catch (err: any) {
    return {
      success: false,
      deguellos: [],
      total: 0,
      error: err.message,
    };
  }
}

// =========================================================================
// NUEVAS v2.1 — CICLO DE PAGO (Sprint 1)
// =========================================================================

/**
 * SPRINT 1: Confirmar pago con recibo de Tesorería
 * - Cambia status PENDING → PAID
 * - Guarda: fecha_pago, cajero_confirmo, operador_entrego, recibo_tesoreria
 * 
 * @param params.recibo_tesoreria  OBLIGATORIO
 * @param params.cajero_confirmo   OPCIONAL (puede ir vacío)
 */
export async function confirmarPagoRecibidoEnSheet(params: {
  folio: string;
  recibo_tesoreria: string;
  cajero_confirmo?: string;
  operador_entrego: string;
}): Promise<{
  success: boolean;
  folio?: string;
  status?: string;
  fecha_pago?: string;
  error?: string;
}> {
  try {
    const result = await callGoogleApi('confirmarPagoRecibido', 'POST', {
      data: {
        folio: params.folio,
        recibo_tesoreria: params.recibo_tesoreria,
        cajero_confirmo: params.cajero_confirmo || '',
        operador_entrego: params.operador_entrego,
      },
    });

    if (result.success) {
      return {
        success: true,
        folio: (result as any).folio,
        status: (result as any).status,
        fecha_pago: (result as any).fecha_pago,
      };
    }

    return { success: false, error: result.error || 'Error al confirmar pago' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * SPRINT 2: Marcar entrega de documentos completada
 * - Cambia status PAID → DELIVERED
 * - Solo si status actual es PAID (bloqueo estricto)
 * 
 * @param params.operador_entrego_docs  OBLIGATORIO
 */
export async function marcarEntregaCompletadaEnSheet(params: {
  folio: string;
  operador_entrego_docs: string;
}): Promise<{
  success: boolean;
  folio?: string;
  status?: string;
  fecha_entrega?: string;
  error?: string;
}> {
  try {
    const result = await callGoogleApi('marcarEntregaCompletada', 'POST', {
      data: {
        folio: params.folio,
        operador_entrego_docs: params.operador_entrego_docs,
      },
    });

    if (result.success) {
      return {
        success: true,
        folio: (result as any).folio,
        status: (result as any).status,
        fecha_entrega: (result as any).fecha_entrega,
      };
    }

    return { success: false, error: result.error || 'Error al marcar entrega' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// NUEVAS v2.2 — SUBIDA DE PDFs A DRIVE + URLs DE RECIBO
// =========================================================================

/**
 * Sube un archivo (PDF) a Google Drive.
 * Crea la subcarpeta si no existe.
 * 
 * @param fileBase64  Contenido del archivo en base64 (con o sin prefijo data:)
 * @param filename    Nombre del archivo (ej. RECIBO_ORD-2026-00109_1234567.pdf)
 * @param subfolder   Subcarpeta destino (ej. '08-Recibos', '09-Reportes')
 * @param mimeType    MIME type (default: application/pdf)
 */
export async function subirArchivoADrive(
  fileBase64: string,
  filename: string,
  subfolder: string = 'sin-carpeta',
  mimeType: string = 'application/pdf',
  fileId?: string
): Promise<{
  success: boolean;
  url?: string;
  urlPreview?: string;
  fileId?: string;
  filename?: string;
  provider?: string;
  overwritten?: boolean;
  error?: string;
}> {
  
  try {
    const result = await callGoogleApi('subirArchivo', 'POST', {
      fileBase64,
      filename,
      subfolder,
      mimeType,
      fileId: fileId || '',
    });

    if (result.success) {
      return {
        success: true,
        url: (result as any).url,
        urlPreview: (result as any).urlPreview,
        fileId: (result as any).fileId,
        filename: (result as any).filename,
        provider: (result as any).provider,
        overwritten: (result as any).overwritten === true,
      };
    }

    return { success: false, error: result.error || 'Error al subir archivo a Drive' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Actualiza las URLs del recibo (Cloudinary + Drive) en la hoja PAGOS.
 * 
 * @param folio                Folio de la orden (ej. ORD-2026-00109)
 * @param url_recibo_cloudinary URL de la foto del recibo en Cloudinary (opcional)
 * @param url_recibo_drive      URL del PDF del recibo en Drive (opcional)
 * @param url_reporte           URL del reporte financiero (opcional)
 */
export async function actualizarUrlsRecibo(
  folio: string,
  urls: {
    url_recibo_cloudinary?: string;
    url_recibo_drive?: string;
    url_recibo_drive_id?: string;
    url_reporte?: string;
  }
): Promise<{
  success: boolean;
  folio?: string;
  error?: string;
}> {
  try {
    const result = await callGoogleApi('actualizarUrlsRecibo', 'POST', {
      data: {
        folio,
        url_recibo_cloudinary: urls.url_recibo_cloudinary,
        url_recibo_drive: urls.url_recibo_drive,
        url_recibo_drive_id: urls.url_recibo_drive_id,
        url_reporte: urls.url_reporte,
      },
    });

    if (result.success) {
      return {
        success: true,
        folio: (result as any).folio,
      };
    }

    return { success: false, error: result.error || 'Error al actualizar URLs de recibo' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Actualiza la URL de la imagen del certificado (PNG) en la hoja REGISTROS.
 * FIX_CERTIFICADO_IMAGEN: persiste la imagen del certificado generada en Cloudinary.
 */
export async function actualizarUrlCertificadoImagen(
  folio: string,
  urlCertificadoImagen: string
): Promise<{ success: boolean; error?: string }> {
  if (!folio) {
    return { success: false, error: 'Falta folio' };
  }
  if (!urlCertificadoImagen) {
    return { success: false, error: 'Falta URL del certificado' };
  }

  try {
    const result = await callGoogleApi('actualizarUrlCertificado', 'POST', {
      folio,
      url_certificado_imagen: urlCertificadoImagen,
    });

    if (result && result.success) {
      console.log('%c[Sheets] URL del certificado actualizada:', 'color: #22c55e', folio);
      return { success: true };
    }

    return {
      success: false,
      error: (result && result.error) || 'Respuesta invalida del servidor',
    };
  } catch (err: any) {
    console.error('[Sheets] Error actualizando URL del certificado:', err);
    return { success: false, error: err?.message || 'Error desconocido' };
  }
}
