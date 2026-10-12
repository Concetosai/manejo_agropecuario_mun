/**
 * Capa de Integración: Google Sheets (primario) + localStorage (cache offline)
 * 
 * Reglas:
 * - Al guardar: SIEMPRE intentar Google Sheets. Si falla, encolar offline.
 * - Al leer: usar cache local. Si vacío, leer de Google Sheets.
 * - Sincronización: al iniciar la app, bajar registros de Google y actualizar cache.
 */

import {
  guardarRegistroEnSheet,
  obtenerRegistrosDelSheet,
  pingGoogleBackend,
  processOfflineQueue,
  getQueueCount,
  GoogleRegistro,
} from '../services/googleSheetsService';
// FIX_CLOUDINARY_REAL: importar el servicio real de Cloudinary (no el alias roto de Google)
import { subirImagenACloudinary } from '../services/cloudinaryService';
import { HistoricalRecord, DigitalExpedienteImages } from '../types';

const CACHE_KEY = 'panuco_sheets_cache_v1';
const LAST_SYNC_KEY = 'panuco_last_sync_v1';

// =========================================================================
// CACHE LOCAL (para lecturas rápidas)
// =========================================================================

export function getCachedRegistros(): HistoricalRecord[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedRegistros(records: HistoricalRecord[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('Error guardando cache:', err);
  }
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

// =========================================================================
// CONVERSIÓN DE TIPOS
// =========================================================================

export function recordToGoogle(record: HistoricalRecord): GoogleRegistro {
  return {
    id_registro: record.id_registro || record.id,
    id_registro_tipo: record.tipo_registro || 'HISTORICO',
    folio: record.folio,
    nombre_productor: record.ownerName,
    curp: record.curp,
    rfc: record.rfc,
    ine: record.ine,
    telefono: record.phone,
    email: (record as any).email || '',
    domicilio: record.address,
    municipio: 'Pánuco',
    ejido: record.ejido,
    predio: record.propertyName,
    superficie: String(record.surfaceHectares),
    tenencia: record.tenureType,
    cantidad_ganado: String(record.cattleCount),
    especie: record.species,
    fin_zootecnico: (record as any).zootechnicalPurpose || 'BOVINO Y DOBLE PROPÓSITO',
    upp: record.uppKey,
    numero_registro: record.registrationNumber,
    libro: record.bookNumber,
    foja: record.folioPage,
    fecha_expedicion: record.issueDate,
    vigencia: record.validityRange,
    iniciales: record.initials,
    hash_vector: record.hash_vector || '',
    // FIX_VECTOR_64D: enviar el vector matematico de 64 dimensiones a Sheets
    vector_64d: record.vector_64d || record.brandVector || undefined,
    vector_checksum: record.vector_checksum || record.hash_vector || undefined,
    vector_density: record.vector_density,
    vector_symmetry_h: record.vector_symmetry_h,
    vector_symmetry_v: record.vector_symmetry_v,
    vector_proportions: record.vector_proportions,
    vector_varianza: record.vector_varianza,
    url_ine: record.imagenes?.credencial_ine || (record as any).ineDriveUrl || '',
    url_ficha: record.imagenes?.ficha_original || '',
    url_fierro: record.imagenes?.fierro_digitalizado || '',
    url_certificado: record.imagenes?.certificado_generado || (record as any).certificadoDriveUrl || '',
    url_foto_titular: (record as any).fotoTitularDriveUrl || record.imagenes?.foto_titular || '',
    url_firma: (record as any).firmaDriveUrl || record.imagenes?.firma || '',
    operador: (record as any).operador || 'OPERADOR',
    fecha_captura: record.digitizedAt || new Date().toISOString(),
  };
}

export function googleToRecord(g: GoogleRegistro): HistoricalRecord {
  const imagenes: DigitalExpedienteImages = {
    credencial_ine: g.url_ine || undefined,
    ficha_original: g.url_ficha || undefined,
    fierro_digitalizado: g.url_fierro || undefined,
    certificado_generado: g.url_certificado || undefined,
    foto_titular: g.url_foto_titular || undefined,
    firma: g.url_firma || undefined,
  };

  return {
    id: g.id_registro || g.folio || `rec-${Date.now()}`,
    id_registro: g.id_registro,
    folio: g.folio || '',
    productor: g.nombre_productor,
    tipo_registro: (g.id_registro_tipo as any) || 'HISTORICO',
    imagenes,
    ineDriveUrl: g.url_ine || undefined,
    fotoTitularDriveUrl: g.url_foto_titular || undefined,
    firmaDriveUrl: g.url_firma || undefined,
    fierroImageUrl: g.url_fierro || undefined,
    certificadoDriveUrl: g.url_certificado || undefined,
    ownerName: g.nombre_productor || '',
    curp: g.curp || '',
    rfc: g.rfc || '',
    ine: g.ine || '',
    address: g.domicilio || '',
    phone: g.telefono || '',
    propertyName: g.predio || '',
    ejido: g.ejido || '',
    surfaceHectares: parseFloat(g.superficie || '0') || 0,
    tenureType: (g.tenencia as any) || 'PROPIEDAD',
    cattleCount: parseInt(g.cantidad_ganado || '0', 10) || 0,
    species: (g.especie as any) || 'BOVINO',
    initials: g.iniciales || 'XX',
    topSymbol: 'none',
    bottomSymbol: 'herradura',
    orientation: 'normal',
    uppKey: g.upp || '',
    year: new Date(g.fecha_expedicion || Date.now()).getFullYear(),
    issueDate: g.fecha_expedicion || new Date().toISOString().split('T')[0],
    registrationNumber: g.numero_registro || '',
    bookNumber: g.libro || '',
    folioPage: g.foja || '',
    validityRange: g.vigencia || '',
    status: 'Vigente',
    brandHash: `${g.iniciales}|none|herradura|normal`,
    // FIX_VECTOR_64D_RECORD: recuperar el vector matematico desde Sheets
    vector_64d: g.vector_64d || undefined,
    brandVector: g.vector_64d || undefined,
    vector_checksum: g.vector_checksum || undefined,
    vector_density: g.vector_density || undefined,
    vector_symmetry_h: g.vector_symmetry_h || undefined,
    vector_symmetry_v: g.vector_symmetry_v || undefined,
    vector_proportions: g.vector_proportions || undefined,
    vector_varianza: g.vector_varianza || undefined,
    hash_vector: g.hash_vector,
    imagen_base64: g.url_fierro,
    extractedBrandImage: g.url_fierro,
    isLocal: true,
    isHistoricalDigitized: g.id_registro_tipo === 'HISTORICO',
    digitizedAt: g.fecha_captura,
  };
}

// =========================================================================
// GUARDADO (escritura a Google Sheets + cache local)
// =========================================================================

/**
 * Guarda un registro completo (datos + imágenes).
 * 1. Intenta subir las imágenes a Drive.
 * 2. Guarda el registro con las URLs de Drive en Sheets.
 * 3. Actualiza el cache local.
 * Si Google falla, todo se encola offline.
 */
export async function guardarRegistroCompleto(
  record: HistoricalRecord,
  imagenes?: {
    ine?: string;
    ficha?: string;
    fierro?: string;
    certificado?: string;
    fotoTitular?: string;
    firma?: string;
  }
): Promise<{
  success: boolean;
  folio: string;
  queued: boolean;
  urlsSubidas?: { ine?: string; ficha?: string; fierro?: string; certificado?: string; fotoTitular?: string; firma?: string };
  error?: string;
}> {
  try {
    const urlsSubidas: any = {};
    const subfolderMap: any = {
      ine: '01-INEs',
      ficha: '02-Fichas_Historicas',
      fierro: '06-Fierros',
      certificado: '07-Certificados',
      fotoTitular: '04-Fotos_Titular',
      firma: '05-Firmas',
    };

    // FIX_NO_DOBLE_SUBIDA: helper que verifica si una imagen YA tiene URL en el record
    const yaSubida = (url: string | undefined | null): boolean => {
      return Boolean(url && typeof url === 'string' && url.startsWith('http'));
    };

    // 1. Subir imágenes a Drive
    // FIX_INE_DUPLICADA: evitar doble subida si ya existe URL en el record
    if (imagenes?.ine) {
      const ineYaSubida = record.imagenes?.credencial_ine || (record as any).ineDriveUrl;
      if (ineYaSubida && ineYaSubida.startsWith('http')) {
        urlsSubidas.ine = ineYaSubida;
        console.log('[INE] Ya estaba subida, se reutiliza:', ineYaSubida);
      } else {
        const r = await subirImagenACloudinary(imagenes.ine, `INE_${record.folio}_${Date.now()}.jpg`, subfolderMap.ine);
        if (r.url) urlsSubidas.ine = r.url;
      }
    }
    // FICHA
    if (imagenes?.ficha) {
      const urlExistente = record.imagenes?.ficha_original;
      if (yaSubida(urlExistente)) {
        urlsSubidas.ficha = urlExistente;
        console.log('[Sync] Ficha ya subida, se reutiliza URL:', urlExistente);
      } else {
        const r = await subirImagenACloudinary(imagenes.ficha, `FICHA_${record.folio}_${Date.now()}.jpg`, subfolderMap.ficha);
        if (r.url) urlsSubidas.ficha = r.url;
      }
    }
    // FIERRO
    if (imagenes?.fierro) {
      const urlExistente = record.imagenes?.fierro_digitalizado;
      if (yaSubida(urlExistente)) {
        urlsSubidas.fierro = urlExistente;
        console.log('[Sync] Fierro ya subido, se reutiliza URL:', urlExistente);
      } else {
        const r = await subirImagenACloudinary(imagenes.fierro, `FIERRO_${record.folio}_${Date.now()}.png`, subfolderMap.fierro);
        if (r.url) urlsSubidas.fierro = r.url;
      }
    }
    // CERTIFICADO
    if (imagenes?.certificado) {
      const urlExistente = record.imagenes?.certificado_generado;
      if (yaSubida(urlExistente)) {
        urlsSubidas.certificado = urlExistente;
        console.log('[Sync] Certificado ya subido, se reutiliza URL:', urlExistente);
      } else {
        const r = await subirImagenACloudinary(imagenes.certificado, `CERT_${record.folio}_${Date.now()}.jpg`, '07-Certificados');
        if (r.url) urlsSubidas.certificado = r.url;
      }
    }

    // FOTO TITULAR
    if (imagenes?.fotoTitular) {
      const urlExistente = (record as any).fotoTitularDriveUrl;
      if (yaSubida(urlExistente)) {
        urlsSubidas.fotoTitular = urlExistente;
        console.log('[Sync] Foto titular ya subida, se reutiliza URL:', urlExistente);
      } else {
        const r = await subirImagenACloudinary(imagenes.fotoTitular, 'FOTO_' + record.folio + '_' + Date.now() + '.jpg', subfolderMap.fotoTitular);
        if (r.url) urlsSubidas.fotoTitular = r.url;
      }
    }
    // FIRMA
    if (imagenes?.firma) {
      const urlExistente = (record as any).firmaDriveUrl;
      if (yaSubida(urlExistente)) {
        urlsSubidas.firma = urlExistente;
        console.log('[Sync] Firma ya subida, se reutiliza URL:', urlExistente);
      } else {
        const r = await subirImagenACloudinary(imagenes.firma, 'FIRMA_' + record.folio + '_' + Date.now() + '.png', subfolderMap.firma);
        if (r.url) urlsSubidas.firma = r.url;
      }
    }

        // 2. Actualizar el record con las URLs de Drive
    const recordConUrls: HistoricalRecord = {
      ...record,
      // FIX_URLS_PERSISTIDAS: guardar URLs en campos directos ADEMAS de imagenes
      ineDriveUrl: urlsSubidas.ine || (record as any).ineDriveUrl || record.imagenes?.credencial_ine,
      fotoTitularDriveUrl: urlsSubidas.fotoTitular || (record as any).fotoTitularDriveUrl,
      firmaDriveUrl: urlsSubidas.firma || (record as any).firmaDriveUrl,
      certificadoDriveUrl: urlsSubidas.certificado || (record as any).certificadoDriveUrl,
      imagenes: {
        credencial_ine: urlsSubidas.ine || record.imagenes?.credencial_ine,
        ficha_original: urlsSubidas.ficha || record.imagenes?.ficha_original,
        fierro_digitalizado: urlsSubidas.fierro || record.imagenes?.fierro_digitalizado,
        certificado_generado: urlsSubidas.certificado || record.imagenes?.certificado_generado,
      },
    } as HistoricalRecord;

    // 3. Guardar en Google Sheets
    const result = await guardarRegistroEnSheet(recordToGoogle(recordConUrls));

    if (result.success) {
      // 4. Actualizar cache local
      const cache = getCachedRegistros();
      const idx = cache.findIndex((r) => r.folio === record.folio);
      if (idx >= 0) {
        cache[idx] = recordConUrls;
      } else {
        cache.unshift(recordConUrls);
      }
      saveCachedRegistros(cache);

      return {
        success: true,
        folio: record.folio,
        queued: Boolean(result.queued),
        urlsSubidas,
      };
    }

    return {
      success: false,
      folio: record.folio,
      queued: false,
      error: result.error,
    };
  } catch (err: any) {
    return {
      success: false,
      folio: record.folio,
      queued: true,
      error: err.message,
    };
  }
}

// =========================================================================
// LECTURA (descarga desde Google Sheets y actualiza cache)
// =========================================================================

/**
 * Descarga todos los registros de Google Sheets y actualiza el cache local.
 */
export async function sincronizarDesdeSheets(): Promise<{
  success: boolean;
  total: number;
  nuevos: number;
  error?: string;
}> {
  try {
    const result = await obtenerRegistrosDelSheet();

    if (!result.success) {
      return { success: false, total: 0, nuevos: 0, error: result.error };
    }

    // FASE_0_3_FIX_MERGE: re-sincronizar TODOS los registros (no solo nuevos)
    const localCache = getCachedRegistros();
    const todosLosRegistros = result.registros
      .filter((g) => g.folio)
      .map(googleToRecord);

    if (todosLosRegistros.length > 0) {
      const foliosFrescos = new Set(todosLosRegistros.map(r => r.folio));
      const cacheViejo = localCache.filter(r => !foliosFrescos.has(r.folio));
      const merged = [...todosLosRegistros, ...cacheViejo];
      saveCachedRegistros(merged);
      console.log('%c[Sync] ' + todosLosRegistros.length + ' registros re-sincronizados (merge completo)', 'color: #22c55e');
    }

    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

    return {
      success: true,
      total: result.total,
      nuevos: todosLosRegistros.length,
    };
  } catch (err: any) {
    return { success: false, total: 0, nuevos: 0, error: err.message };
  }
}

// =========================================================================
// SINCRONIZACIÓN AUTOMÁTICA AL INICIAR
// =========================================================================

/**
 * Se ejecuta al iniciar la app:
 * 1. Verifica que el backend esté en línea.
 * 2. Procesa la cola offline pendiente.
 * 3. Sincroniza registros nuevos desde Sheets.
 */
export async function inicializarSincronizacion(): Promise<{
  online: boolean;
  registrosDescargados: number;
  encoladosPendientes: number;
  procesados: number;
}> {
  const online = await pingGoogleBackend();
  const encoladosPendientes = getQueueCount();

  if (!online) {
    return {
      online: false,
      registrosDescargados: 0,
      encoladosPendientes,
      procesados: 0,
    };
  }

  let procesados = 0;
  if (encoladosPendientes > 0) {
    const r = await processOfflineQueue();
    procesados = r.processed;
  }

  const sync = await sincronizarDesdeSheets();

  return {
    online: true,
    registrosDescargados: sync.nuevos,
    encoladosPendientes: getQueueCount(),
    procesados,
  };
}