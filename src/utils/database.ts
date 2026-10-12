import { HistoricalRecord } from '../types';

/**
 * Catálogo oficial de ejidos y congregaciones de Pánuco, Veracruz.
 * Se usa en formularios y validaciones.
 */
export const PANUCO_EJIDOS = [
  'Reventadero', 'Tamos', 'Tampiquito', 'Villa Cacalilao', 'Canoas', 'Moralillo',
  'Bermúdez', 'Oviedo', 'Topila', 'Corcovado', 'Mahuaves', 'El Barco', 'Tancheche',
  'Calentadores', 'Ex-Hacienda Chintón', 'Mayorazgo', 'Ánimas', 'La Trinidad', 'Vega de Otates'
];

let cachedDatabase: HistoricalRecord[] | null = null;

/**
 * Verifica si un registro municipal está corrupto (blindaje contra datos inválidos).
 */
export function isCorruptedMunicipalRecord(r: HistoricalRecord): boolean {
  if (!r || typeof r !== 'object') return true;

  const toStr = (v: any): string => (v === null || v === undefined) ? '' : String(v);

  const initials = toStr(r.initials);
  const phone = toStr(r.phone);
  if (initials === '8451062154' || (phone && initials === phone)) return true;

  const uppKey = toStr(r.uppKey);
  if (uppKey && (uppKey.includes('.55') || uppKey === '848487812692.55')) return true;

  const curp = toStr(r.curp);
  if (curp && (curp.includes('1856550JH8GV') || curp.length > 18)) return true;

  return false;
}

/**
 * Limpia los registros corruptos del cache y de localStorage.
 * Devuelve el número de registros eliminados.
 */
export function cleanCorruptedTestRecords(): number {
  const db = getMunicipalDatabase();
  const initialCount = db.length;
  const cleaned = db.filter((r) => !isCorruptedMunicipalRecord(r));
  cachedDatabase = cleaned;
  try {
    localStorage.setItem('panuco_fierros_db_v2', JSON.stringify(cleaned));
  } catch (err) {
    console.warn('Error saving cleaned database to localStorage:', err);
  }
  return initialCount - cleaned.length;
}

/**
 * Obtiene el padrón municipal.
 * 
 * FIX_NO_MOCK: Ya NO genera datos de prueba. Solo devuelve datos reales de:
 *   1. localStorage 'panuco_fierros_db_v2' (registros agregados localmente)
 *   2. localStorage 'panuco_sheets_cache_v1' (registros sincronizados desde Google Sheets)
 * 
 * Si no hay datos reales → devuelve array vacío.
 */
export function getMunicipalDatabase(): HistoricalRecord[] {
  if (cachedDatabase) return cachedDatabase || [];

  // Fuente 1: cache local de registros agregados
  let localRecords: HistoricalRecord[] = [];
  try {
    const stored = localStorage.getItem('panuco_fierros_db_v2');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        localRecords = parsed.filter((r) => !isCorruptedMunicipalRecord(r));
      }
    }
  } catch (err) {
    console.warn('Error leyendo cache local:', err);
  }

  // Fuente 2: cache de registros sincronizados desde Google Sheets
  let sheetsRecords: HistoricalRecord[] = [];
  try {
    const sheetsCacheRaw = localStorage.getItem('panuco_sheets_cache_v1');
    if (sheetsCacheRaw) {
      const parsed = JSON.parse(sheetsCacheRaw);
      if (Array.isArray(parsed)) {
        sheetsRecords = parsed.filter((r: any) => !isCorruptedMunicipalRecord(r));
      }
    }
  } catch (err) {
    console.warn('Error leyendo cache de Sheets:', err);
  }

  // FASE_0_3_FIX_V3: MERGE INTELIGENTE.
  // Por cada folio, combinamos el registro local con el de Sheets
  // para NO perder campos que solo estan en uno de los dos.
  const localMap = new Map(localRecords.map(r => [r.folio, r]));

  const merged = sheetsRecords.map(sheetRec => {
    const localRec = localMap.get(sheetRec.folio);
    if (!localRec) return sheetRec;

    // Combinar: Sheets pisa sobre local, EXCEPTO en imagenes y campos de fierro
    const imagenesMerge: any = {
      ...(localRec.imagenes || {}),
      ...(sheetRec.imagenes || {}),
    };

    // Preservar fierro del local si Sheets no lo tiene
    const fierroUrl = sheetRec.imagenes?.fierro_digitalizado
      || localRec.imagenes?.fierro_digitalizado
      || (sheetRec as any).url_fierro
      || (sheetRec as any).fierroImageUrl
      || (localRec as any).fierroImageUrl
      || (localRec as any).url_fierro;

    if (fierroUrl) {
      imagenesMerge.fierro_digitalizado = fierroUrl;
    }

    return {
      ...localRec,
      ...sheetRec,
      imagenes: imagenesMerge,
      fierroImageUrl: fierroUrl,
      url_fierro: fierroUrl,
      // Preservar URLs de INE/Foto/Firma si Sheets las trae pero en campos distintos
      ineDriveUrl: (sheetRec as any).ineDriveUrl || (localRec as any).ineDriveUrl || sheetRec.imagenes?.credencial_ine,
      fotoTitularDriveUrl: (sheetRec as any).fotoTitularDriveUrl || (localRec as any).fotoTitularDriveUrl || sheetRec.imagenes?.foto_titular,
      firmaDriveUrl: (sheetRec as any).firmaDriveUrl || (localRec as any).firmaDriveUrl || sheetRec.imagenes?.firma,
    };
  });

  // Añadir los locales que no estan en Sheets
  const foliosSheets = new Set(sheetsRecords.map(r => r.folio));
  const soloLocales = localRecords.filter(r => !foliosSheets.has(r.folio));

  const final = [...merged, ...soloLocales];

  cachedDatabase = final;
  return cachedDatabase || [];
}

/**
 * Agrega o actualiza un registro municipal en el cache local.
 * Estructura completa del Expediente Digital (id_registro, productor, tipo_registro, imagenes, datos_productor).
 */
export function addNewMunicipalRecord(record: HistoricalRecord): void {
  const db = getMunicipalDatabase();
  const idReg = record.id_registro || record.registrationNumber || record.id;
  const enrichedRecord: HistoricalRecord = {
    ...record,
    id_registro: idReg,
    productor: record.productor || record.ownerName,
    tipo_registro: record.tipo_registro || (record.isHistoricalDigitized ? 'HISTORICO' : 'NUEVO_ALTA'),
    imagenes: record.imagenes || {
      fierro_digitalizado: record.extractedBrandImage || record.imagen_base64,
    },
    datos_productor: record.datos_productor || {
      ownerName: record.ownerName,
      curp: record.curp,
      rfc: record.rfc,
      ine: record.ine,
      address: record.address,
      phone: record.phone,
      propertyName: record.propertyName,
      ejido: record.ejido,
      surfaceHectares: record.surfaceHectares,
      tenureType: record.tenureType,
      cattleCount: record.cattleCount,
      species: record.species,
      uppKey: record.uppKey,
      bookNumber: record.bookNumber,
      folioPage: record.folioPage,
      validityRange: record.validityRange,
      issueDate: record.issueDate,
    },
  };

  const filtered = db.filter(
    (r) =>
      r.id !== enrichedRecord.id &&
      r.folio !== enrichedRecord.folio &&
      r.registrationNumber !== enrichedRecord.registrationNumber &&
      (r.id_registro || r.registrationNumber) !== idReg
  );
  filtered.unshift(enrichedRecord);
  cachedDatabase = filtered;
  try {
    localStorage.setItem('panuco_fierros_db_v2', JSON.stringify(filtered));
  } catch (err) {
    console.warn('Error guardando en localStorage (panuco_fierros_db_v2):', err);
  }
}

/**
 * Limpia el cache en memoria (útil para forzar recarga desde localStorage).
 */
export function clearMunicipalDatabaseCache(): void {
  cachedDatabase = null;
}