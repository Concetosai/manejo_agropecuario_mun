import { HistoricalRecord, DigitalExpedienteImages, TipoRegistroExpediente } from '../types';
import { calculateVectorCosineSimilarity, computeVectorChecksum } from './brandVectorization';

export const LOCAL_STORAGE_FIERROS_KEY = 'fierros_historicos';

/**
 * Redimensiona una imagen en un <canvas> a un máximo de 800px de ancho
 * y la comprime en formato JPEG con calidad 0.7 para evitar "Quota Exceeded" en localStorage.
 */
export function compressImageForStorage(
  sourceDataUrl?: string | null,
  maxWidth = 800,
  quality = 0.7
): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (!sourceDataUrl || typeof sourceDataUrl !== 'string' || !sourceDataUrl.trim()) {
      resolve(undefined);
      return;
    }

    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      resolve(sourceDataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width || 600;
        const origH = img.naturalHeight || img.height || 600;

        let targetW = origW;
        let targetH = origH;

        if (origW > maxWidth) {
          targetW = maxWidth;
          targetH = Math.max(1, Math.round((origH * maxWidth) / origW));
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sourceDataUrl);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (err) {
        console.warn('No se pudo comprimir la imagen en canvas, usando original:', err);
        resolve(sourceDataUrl);
      }
    };

    img.onerror = () => {
      resolve(sourceDataUrl);
    };

    img.src = sourceDataUrl;
  });
}

/**
 * FIX_NO_MOCK: Sin datos demo. Array vacío por defecto.
 * Los registros reales se agregan vía saveLocalFierro() o desde Sheets.
 */
export const DEFAULT_LOCAL_FIERROS: HistoricalRecord[] = [];

/**
 * Normaliza un registro asegurando la estructura del Expediente Digital
 * (id_registro, productor, tipo_registro, imagenes, vector_64d, datos_productor).
 */
export function normalizeExpedienteRecord(item: HistoricalRecord): HistoricalRecord {
  const vec = item.vector_64d || item.brandVector;
  const fierroImg =
    item.imagenes?.fierro_digitalizado ||
    item.imagen_base64 ||
    item.extractedBrandImage;

  const idRegistro =
    item.id_registro ||
    item.registrationNumber ||
    item.id;

  const tipoRegistro: TipoRegistroExpediente =
    item.tipo_registro ||
    (item.isHistoricalDigitized ? 'HISTORICO' : 'NUEVO_ALTA');

  const imagenes: DigitalExpedienteImages = {
    ficha_original: item.imagenes?.ficha_original,
    credencial_ine: item.imagenes?.credencial_ine,
    fierro_digitalizado: fierroImg,
    certificado_generado: item.imagenes?.certificado_generado,
  };

  return {
    ...item,
    id_registro: idRegistro,
    productor: item.productor || item.ownerName,
    tipo_registro: tipoRegistro,
    imagenes,
    datos_productor: item.datos_productor || {
      ownerName: item.ownerName,
      curp: item.curp,
      rfc: item.rfc,
      ine: item.ine,
      address: item.address,
      phone: item.phone,
      propertyName: item.propertyName,
      ejido: item.ejido,
      surfaceHectares: item.surfaceHectares,
      tenureType: item.tenureType,
      cattleCount: item.cattleCount,
      species: item.species,
      uppKey: item.uppKey,
      bookNumber: item.bookNumber,
      folioPage: item.folioPage,
      validityRange: item.validityRange,
      issueDate: item.issueDate,
    },
    isLocal: true,
    isHistoricalDigitized: tipoRegistro === 'HISTORICO',
    brandVector: vec,
    vector_64d: vec,
    hash_vector: item.hash_vector || (vec ? computeVectorChecksum(vec) : undefined),
    extractedBrandImage: fierroImg,
    imagen_base64: fierroImg,
  };
}

/**
 * Lee los registros locales almacenados en 'fierros_historicos'.
 * FIX_NO_MOCK: Si no hay datos → devuelve array vacío (sin seeds).
 */
export function getLocalFierros(): HistoricalRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FIERROS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => normalizeExpedienteRecord(item));
    }
    return [];
  } catch (err) {
    console.warn('Error al leer fierros_historicos de localStorage:', err);
    return [];
  }
}

/**
 * Guarda o actualiza un registro en 'fierros_historicos' de localStorage
 * con la estructura completa de Expediente Digital y evidencias comprimidas.
 */
export function saveLocalFierro(
  record: HistoricalRecord,
  vectorData?: {
    embedding?: number[];
    checksum?: string;
    imageBase64?: string;
    tipo_registro?: TipoRegistroExpediente;
    imagenes?: DigitalExpedienteImages;
  }
): HistoricalRecord {
  const current = getLocalFierros();
  const vec = vectorData?.embedding || record.vector_64d || record.brandVector;
  const chk = vectorData?.checksum || record.hash_vector || (vec ? computeVectorChecksum(vec) : undefined);
  const fierroImg =
    vectorData?.imagenes?.fierro_digitalizado ||
    vectorData?.imageBase64 ||
    record.imagenes?.fierro_digitalizado ||
    record.imagen_base64 ||
    record.extractedBrandImage;

  const idRegistro = record.id_registro || record.registrationNumber || record.id;
  const tipoRegistro: TipoRegistroExpediente =
    vectorData?.tipo_registro ||
    record.tipo_registro ||
    (record.isHistoricalDigitized ? 'HISTORICO' : 'NUEVO_ALTA');

  const mergedImagenes: DigitalExpedienteImages = {
    ficha_original: vectorData?.imagenes?.ficha_original ?? record.imagenes?.ficha_original,
    credencial_ine: vectorData?.imagenes?.credencial_ine ?? record.imagenes?.credencial_ine,
    fierro_digitalizado: fierroImg,
    certificado_generado: vectorData?.imagenes?.certificado_generado ?? record.imagenes?.certificado_generado,
  };

  const entryToSave: HistoricalRecord = {
    ...record,
    id_registro: idRegistro,
    productor: record.productor || record.ownerName,
    tipo_registro: tipoRegistro,
    imagenes: mergedImagenes,
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
    isLocal: true,
    isHistoricalDigitized: tipoRegistro === 'HISTORICO',
    brandVector: vec,
    vector_64d: vec,
    hash_vector: chk,
    extractedBrandImage: fierroImg,
    imagen_base64: fierroImg,
    digitizedAt: record.digitizedAt || new Date().toISOString(),
  };

  // Filtrar duplicados por id_registro, ID o folio y anteponer
  const updated = [
    entryToSave,
    ...current.filter(
      (item) =>
        item.id !== entryToSave.id &&
        item.folio !== entryToSave.folio &&
        (item.id_registro || item.registrationNumber) !== idRegistro
    ),
  ];

  try {
    localStorage.setItem(LOCAL_STORAGE_FIERROS_KEY, JSON.stringify(updated));
  } catch (quotaErr) {
    console.warn('Advertencia de cuota en localStorage, optimizando almacenamiento:', quotaErr);
    try {
      const trimmed = updated.slice(0, 8);
      localStorage.setItem(LOCAL_STORAGE_FIERROS_KEY, JSON.stringify(trimmed));
    } catch (innerErr) {
      console.error('Error crítico al guardar en fierros_historicos:', innerErr);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fierros_historicos_changed', { detail: entryToSave }));
  }

  return entryToSave;
}

/**
 * Busca y valida un Expediente Digital en localStorage por su id_registro exacto.
 */
export function findExpedienteInLocalStorage(
  rowRecord: HistoricalRecord
): {
  expediente: HistoricalRecord;
  foundInLocalStorage: boolean;
  idRegistroMatched: boolean;
  targetIdRegistro: string;
} {
  const targetIdRegistro = (
    rowRecord.id_registro ||
    rowRecord.registrationNumber ||
    rowRecord.id ||
    rowRecord.folio
  ).trim();

  // 1. Buscar primero en 'fierros_historicos' de localStorage
  const localRecords = getLocalFierros();
  const exactLocal = localRecords.find((item) => {
    const itemRegId = (item.id_registro || item.registrationNumber || item.id || '').trim();
    return (
      itemRegId.toLowerCase() === targetIdRegistro.toLowerCase() ||
      item.id.toLowerCase() === rowRecord.id.toLowerCase() ||
      item.folio.toLowerCase() === rowRecord.folio.toLowerCase()
    );
  });

  if (exactLocal) {
    const matchedId = (exactLocal.id_registro || exactLocal.registrationNumber || exactLocal.id || '').trim();
    return {
      expediente: exactLocal,
      foundInLocalStorage: true,
      idRegistroMatched:
        matchedId.toLowerCase() === targetIdRegistro.toLowerCase() ||
        exactLocal.folio.toLowerCase() === rowRecord.folio.toLowerCase(),
      targetIdRegistro: matchedId || targetIdRegistro,
    };
  }

  // 2. Buscar en 'panuco_fierros_db_v2' de localStorage si fue asentado allí
  try {
    const rawMunicipal = localStorage.getItem('panuco_fierros_db_v2');
    if (rawMunicipal) {
      const parsedMunicipal: HistoricalRecord[] = JSON.parse(rawMunicipal);
      if (Array.isArray(parsedMunicipal)) {
        const foundMun = parsedMunicipal.find((item) => {
          const itemRegId = (item.id_registro || item.registrationNumber || item.id || '').trim();
          return (
            itemRegId.toLowerCase() === targetIdRegistro.toLowerCase() ||
            item.id.toLowerCase() === rowRecord.id.toLowerCase() ||
            item.folio.toLowerCase() === rowRecord.folio.toLowerCase()
          );
        });
        if (foundMun) {
          const normalized = {
            ...foundMun,
            id_registro: foundMun.id_registro || foundMun.registrationNumber || foundMun.id,
            productor: foundMun.productor || foundMun.ownerName,
            tipo_registro: foundMun.tipo_registro || (foundMun.isHistoricalDigitized ? 'HISTORICO' : 'HISTORICO'),
          };
          return {
            expediente: normalized,
            foundInLocalStorage: true,
            idRegistroMatched: true,
            targetIdRegistro: normalized.id_registro || targetIdRegistro,
          };
        }
      }
    }
  } catch (e) {
    console.warn('Error consultando panuco_fierros_db_v2 en localStorage:', e);
  }

  // 3. Fallback al registro de la fila
  const fallbackRecord: HistoricalRecord = {
    ...rowRecord,
    id_registro: targetIdRegistro,
    productor: rowRecord.productor || rowRecord.ownerName,
    tipo_registro: rowRecord.tipo_registro || (rowRecord.isHistoricalDigitized ? 'HISTORICO' : 'HISTORICO'),
  };

  return {
    expediente: fallbackRecord,
    foundInLocalStorage: false,
    idRegistroMatched: Boolean(targetIdRegistro),
    targetIdRegistro,
  };
}

export interface VectorComparisonResult {
  candidate: HistoricalRecord;
  similarity: number;
  similarityPct: number;
  isMatch: boolean;
  isExact: boolean;
  diffVector: number[];
  mismatchedCellCount: number;
  maxDiff: number;
}

/**
 * Compara el vector de un registro contra todos los demás registros que cuenten con vector.
 * Calcula similitud de coseno y mapa de discrepancias celda por celda (8x8).
 */
export function runVectorSimilarityAnalysis(
  sourceRecord: HistoricalRecord,
  allRecords: HistoricalRecord[],
  threshold = 0.75
): {
  sourceRecord: HistoricalRecord;
  hasVector: boolean;
  comparedCount: number;
  matches: VectorComparisonResult[];
  topMatch: VectorComparisonResult | null;
  hasAnyMatch: boolean;
} {
  const sourceVec = sourceRecord.vector_64d || sourceRecord.brandVector;
  if (!sourceVec || sourceVec.length !== 256) {
    return {
      sourceRecord,
      hasVector: false,
      comparedCount: 0,
      matches: [],
      topMatch: null,
      hasAnyMatch: false,
    };
  }

  const results: VectorComparisonResult[] = [];

  for (const candidate of allRecords) {
    if (candidate.id === sourceRecord.id && candidate.folio === sourceRecord.folio) {
      continue;
    }

    const candVec = candidate.vector_64d || candidate.brandVector;
    if (!candVec || candVec.length !== 256) {
      continue;
    }

    const similarity = calculateVectorCosineSimilarity(sourceVec, candVec);
    const similarityPct = Number((similarity * 100).toFixed(1));

    const diffVector: number[] = [];
    let mismatchedCount = 0;
    let maxDiff = 0;

    for (let i = 0; i < 256; i++) {
      const diff = Math.abs((sourceVec[i] || 0) - (candVec[i] || 0));
      diffVector.push(diff);
      if (diff > 0.3) {
        mismatchedCount++;
      }
      if (diff > maxDiff) maxDiff = diff;
    }

    results.push({
      candidate,
      similarity,
      similarityPct,
      isMatch: similarity >= threshold,
      isExact: similarity >= 0.98,
      diffVector,
      mismatchedCellCount: mismatchedCount,
      maxDiff,
    });
  }

  results.sort((a, b) => b.similarity - a.similarity);

  const matches = results.filter((r) => r.isMatch);

  return {
    sourceRecord,
    hasVector: true,
    comparedCount: results.length,
    matches,
    topMatch: results.length > 0 ? results[0] : null,
    hasAnyMatch: matches.length > 0,
  };
}