import { PasePreCertificado, BrandConfig } from '../types';
import { getDiasVigenciaPreCertificado } from '../utils/preferences';

const GOOGLE_API_URL = import.meta.env.VITE_GOOGLE_API_URL;
const GOOGLE_TOKEN = import.meta.env.VITE_GOOGLE_TOKEN;

function calcularVencimientoHabiles(fechaEmision: Date, diasHabiles: number): Date {
  const festivos = [
    '2026-01-01', '2026-02-02', '2026-03-16', '2026-05-01',
    '2026-09-16', '2026-11-16', '2026-12-25'
  ];
  const fecha = new Date(fechaEmision);
  let contador = 0;
  while (contador < diasHabiles) {
    fecha.setDate(fecha.getDate() + 1);
    const dia = fecha.getDay();
    const iso = fecha.toISOString().split('T')[0];
    if (dia !== 0 && dia !== 6 && festivos.indexOf(iso) === -1) contador++;
  }
  return fecha;
}

function generarFolioPase(): string {
  const KEY = 'panuco_pase_folio_counter_v1';
  const year = new Date().getFullYear();
  let counter = parseInt(localStorage.getItem(KEY) || '0', 10);
  counter++;
  localStorage.setItem(KEY, String(counter));
  return 'PRE-PAN-' + year + '-' + String(counter).padStart(5, '0');
}

export async function emitirPasePreCertificado(params: {
  checksum_vector: string;
  vector_64d: number[];
  brand_vector?: number[];
  vector_density?: number;
  vector_symmetry_h?: number;
  vector_symmetry_v?: number;
  vector_proportions?: string;
  vector_varianza?: number;
  fierro_image_url: string;
  fierro_brand_config?: BrandConfig;
  solicitante_nombre: string;
  solicitante_telefono: string;
  solicitante_curp?: string;
  solicitante_rfc?: string;
  solicitante_ejido?: string;
  solicitante_municipio?: string;
  solicitante_notas?: string;
  emitido_por: string;
}): Promise<{ success: boolean; pase?: PasePreCertificado; error?: string }> {
  try {
    const dias = getDiasVigenciaPreCertificado();
    const ahora = new Date();
    const vencimiento = calcularVencimientoHabiles(ahora, dias);
    const pase: PasePreCertificado = {
      id: crypto.randomUUID(),
      folio_pase: generarFolioPase(),
      checksum_vector: params.checksum_vector,
      vector_64d: params.vector_64d,
      brand_vector: params.brand_vector,
      vector_density: params.vector_density,
      vector_symmetry_h: params.vector_symmetry_h,
      vector_symmetry_v: params.vector_symmetry_v,
      vector_proportions: params.vector_proportions,
      vector_varianza: params.vector_varianza,
      fierro_image_url: params.fierro_image_url,
      fierro_brand_config: params.fierro_brand_config,
      solicitante_nombre: params.solicitante_nombre,
      solicitante_telefono: params.solicitante_telefono,
      solicitante_curp: params.solicitante_curp,
      solicitante_rfc: params.solicitante_rfc,
      solicitante_ejido: params.solicitante_ejido,
      solicitante_municipio: params.solicitante_municipio || 'Pánuco',
      solicitante_notas: params.solicitante_notas,
      fecha_emision: ahora.toISOString(),
      fecha_vencimiento: vencimiento.toISOString(),
      dias_vigencia: dias,
      estado: 'RESERVADO',
      emitido_por: params.emitido_por,
      emitido_en: ahora.toISOString(),
    };
    const response = await fetch(GOOGLE_API_URL + '?action=guardarPasePreCertificado', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: GOOGLE_TOKEN, data: pase }),
    });
    const result = await response.json();
    if (!result.success) return { success: false, error: result.error || 'Error guardando' };
    console.log('[Pase] Emitido:', pase.folio_pase);
    return { success: true, pase: pase };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error' };
  }
}

export async function listarPases(): Promise<PasePreCertificado[]> {
  try {
    const response = await fetch(GOOGLE_API_URL + '?action=listarPasesPreCertificados&token=' + GOOGLE_TOKEN);
    const result = await response.json();
    return result.pases || [];
  } catch (err) {
    return [];
  }
}

export async function listarPasesVencidos(): Promise<PasePreCertificado[]> {
  const todos = await listarPases();
  const ahora = new Date();
  return todos.filter(function(p) { return p.estado === 'RESERVADO' && new Date(p.fecha_vencimiento) < ahora; });
}

export async function cerrarPaseConAlta(folio_pase: string, folio_certificado: string): Promise<boolean> {
  try {
    const response = await fetch(GOOGLE_API_URL + '?action=actualizarEstadoPase', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: GOOGLE_TOKEN, folio_pase: folio_pase, nuevoEstado: 'CERRADO_CON_ALTA', folio_certificado_vinculado: folio_certificado }),
    });
    const result = await response.json();
    return result.success;
  } catch (err) {
    return false;
  }
}

export async function cancelarPase(folio_pase: string): Promise<boolean> {
  try {
    const response = await fetch(GOOGLE_API_URL + '?action=actualizarEstadoPase', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: GOOGLE_TOKEN, folio_pase: folio_pase, nuevoEstado: 'CANCELADO' }),
    });
    const result = await response.json();
    return result.success;
  } catch (err) {
    return false;
  }
}

export async function expirarPase(folio_pase: string): Promise<boolean> {
  try {
    const response = await fetch(GOOGLE_API_URL + '?action=actualizarEstadoPase', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: GOOGLE_TOKEN, folio_pase: folio_pase, nuevoEstado: 'EXPIRADO' }),
    });
    const result = await response.json();
    return result.success;
  } catch (err) {
    return false;
  }
}


/**
 * Genera la imagen PNG del documento del pase y la sube a Cloudinary.
 * Devuelve la URL de la imagen en Cloudinary, o null si falla.
 */
export async function generarImagenPaseYSubir(
  pase: PasePreCertificado,
  captureFn: (element: HTMLElement) => Promise<HTMLCanvasElement>,
  container: HTMLElement
): Promise<string | null> {
  try {
    const canvas = await captureFn(container);
    const jpgBase64 = canvas.toDataURL('image/jpeg', 0.9);

    const { subirImagenACloudinary } = await import('./cloudinaryService');
    const upload = await subirImagenACloudinary(
      jpgBase64,
      'PASE_' + pase.folio_pase + '_' + Date.now() + '.jpg',
      '08-Pases'
    );

    if (!upload.success || !upload.url) {
      console.warn('[Pase] Cloudinary fallo:', upload.error);
      return null;
    }
    return upload.url;
  } catch (err) {
    console.error('[Pase] Error generando imagen:', err);
    return null;
  }
}

/**
 * FASE_1_PASE: Persiste la URL del documento PNG del pase en Sheets.
 * Se llama después de subir el PNG a Cloudinary.
 */
export async function actualizarUrlDocumentoPase(
  folio_pase: string,
  url_documento_png: string
): Promise<boolean> {
  try {
    const response = await fetch(GOOGLE_API_URL + '?action=actualizarUrlDocumentoPase', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: GOOGLE_TOKEN,
        folio_pase: folio_pase,
        url_documento_png: url_documento_png,
      }),
    });
    const result = await response.json();
    return result.success === true;
  } catch (err) {
    console.error('[Pase] Error actualizando URL documento:', err);
    return false;
  }
}