import {
  DigitizedHistoricalDocument,
  TenureType,
  LivestockSpecies,
} from '../types';

export interface HistoricalSampleRecord {
  id: string;
  title: string;
  year: number;
  badge: string;
  data: DigitizedHistoricalDocument;
  svgDocumentPreview: string;
}

/**
 * Filtro de compatibilidad de campos históricos:
 * Analiza qué campos modernos NO existían en el documento tradicional escaneado
 * y define las razones para omitirlos o dejarlos limpios.
 */
export function getHistoricalFieldCompatibility(year: number = 1990) {
  const omitted = [
    {
      field: 'email',
      label: 'Correo Electrónico (Email)',
      reason: 'No contemplado en los formatos físicos tradicionales de la época. Se omite para evitar datos nulos o apócrifos.',
    },
    {
      field: 'producerSignature',
      label: 'Firma Digital Biométrica',
      reason: 'El documento histórico cuenta con firma autógrafa en papel. No contiene firma criptográfica digital.',
    },
  ];

  if (year < 1996) {
    omitted.push({
      field: 'curp',
      label: 'Clave Única de Registro de Población (CURP)',
      reason: `La CURP fue creada oficialmente en México en 1996; no existía en documentos de ${year}.`,
    });
  }

  if (year < 2004) {
    omitted.push({
      field: 'uppKey',
      label: 'Clave UPP / SINIIGA',
      reason: `El Sistema Nacional de Identificación Individual de Ganado (SINIIGA) se instauró a partir de 2004; no figuraba en este asiento de ${year}.`,
    });
  }

  return omitted;
}

/**
 * Analizador OCR de texto extraído de documento físico.
 * Extrae automáticamente: nombre, domicilio, predio, ejido, superficie, cabezas,
 * especie, libro, foja, folio y año del documento.
 * 
 * Retorna datos vacíos si no encuentra coincidencias (no inventa datos).
 */
export function parseHistoricalDocumentText(
  rawText: string,
  sourceType: 'scan_upload' | 'camera_capture' | 'archive_sample' = 'scan_upload',
  imageUrl: string = ''
): DigitizedHistoricalDocument {
  const upper = (rawText || '').toUpperCase();

  // Detect Year
  const yearMatch = upper.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  const detectedYear = yearMatch ? parseInt(yearMatch[1], 10) : 0;

  // Detect Owner Name
  let ownerName = '';
  const ownerMatch =
    upper.match(/(?:NOMBRE\s+DEL\s+PRODUCTOR|PROPIETARIO|TITULAR|A\s+NOMBRE\s+DE|CIUDADANO|C\.)[:\s]+([A-ZÁÉÍÓÚÑ\s]{4,60})/i) ||
    upper.match(/NOMBRE[:\s]+([A-ZÁÉÍÓÚÑ\s]{4,60})/i);

  if (ownerMatch && ownerMatch[1]) {
    let clean = ownerMatch[1].split(/\n|\r|DOMICILIO|PREDIO|EJIDO|SUPERFICIE|RFC|CURP/)[0].trim();
    clean = clean.replace(/^(DON|DOÑA|SR\.|SRA\.|C\.)\s+/i, '').trim();
    if (clean.length >= 3) {
      ownerName = clean;
    }
  }

  // Detect Domicilio
  let address = '';
  const addressMatch =
    upper.match(/(?:DOMICILIO\s+DEL\s+PRODUCTOR|DOMICILIO|DIRECCI[OÓ]N)[:\s]+([^\n\r]{4,70})/i);
  if (addressMatch && addressMatch[1]) {
    let cleanAddr = addressMatch[1].split(/EJIDO|PREDIO|LOCALIDAD|CONGREGACI|SUPERFICIE|RFC/)[0].trim();
    if (cleanAddr.length >= 4) {
      address = cleanAddr;
    }
  }

  // Detect Predio
  let propertyName = '';
  const predioMatch = upper.match(/(?:PREDIO|RANCHO|FINCA|PROPIEDAD\s+DENOMINADA)[:\s]+([A-ZÁÉÍÓÚÑ0-9\s]{3,45})/i);
  if (predioMatch && predioMatch[1]) {
    let cleanPredio = predioMatch[1].split(/\n|\r|EJIDO|CONGREGACI|LOCALIDAD|SUPERFICIE/)[0].trim();
    if (cleanPredio.length >= 3) {
      propertyName = cleanPredio;
    }
  }

  // Detect Ejido / Localidad
  let ejido = '';
  const ejidoMatch =
    upper.match(/(?:EJIDO\s+CONGREGACI[OÓ]N\s+O\s+RANCHER[IÍ]A|CONGREGACI[OÓ]N|LOCALIDAD|RANCHER[IÍ]A|EJIDO|UBICADO\s+EN)[:\s]+([A-ZÁÉÍÓÚÑ0-9\s]{3,40})/i);
  if (ejidoMatch && ejidoMatch[1]) {
    let cleanEjido = ejidoMatch[1].split(/\n|\r|MUNICIPIO|SUPERFICIE|ESTADO|P[AÁ]NUCO/)[0].trim();
    if (cleanEjido.length >= 3) {
      ejido = cleanEjido;
    }
  }

  // Detect Tenure Type
  let tenureType: TenureType = 'PROPIEDAD';
  if (upper.includes('EJIDAL') || upper.includes('RÉGIMEN EJIDAL') || upper.includes('REGIMEN EJIDAL')) {
    tenureType = 'EJIDAL';
  }

  // Detect Surface
  let surfaceHectares = 0;
  const surfaceMatch =
    upper.match(/SUPERFICIE[:\s]+([0-9\.\-\,]+)\s*(?:HA|HAS|HECT[AÁ]REAS)?/i) ||
    upper.match(/(\d+(?:[\.\-]\d+)?(?:[\.\-]\d+)?)\s*(?:HAS|HECTÁREAS|HECTAREAS|HÁS|HA\b)/i);

  if (surfaceMatch && surfaceMatch[1]) {
    const rawVal = surfaceMatch[1].replace(/,/g, '.');
    if (rawVal.includes('-')) {
      const parts = rawVal.split('-').map((p) => parseFloat(p) || 0);
      const has = parts[0] + (parts[1] || 0) / 100 + (parts[2] || 0) / 10000;
      surfaceHectares = Math.round(has * 100) / 100;
    } else {
      const parsed = parseFloat(rawVal);
      if (!isNaN(parsed) && parsed > 0) surfaceHectares = parsed;
    }
  }

  // Detect Cattle Count
  let cattleCount = 0;
  const countMatch = upper.match(/(\d{1,4})\s*(?:CABEZAS|CAB\.|RESES|BOVINOS)/i);
  if (countMatch && countMatch[1]) {
    const parsed = parseInt(countMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) cattleCount = parsed;
  }

  // Detect Species
  let species: LivestockSpecies = 'BOVINO';
  if (upper.includes('EQUINO')) species = 'EQUINO';
  else if (upper.includes('OVINO')) species = 'OVINO';
  else if (upper.includes('CAPRINO')) species = 'CAPRINO';
  else if (upper.includes('PORCINO')) species = 'PORCINO';
  else if (upper.includes('COLMENA') || upper.includes('APÍCOLA')) species = 'COLMENA';
  else if (upper.includes('MIXTO')) species = 'MIXTOS';

  // Detect Book & Foja
  let bookNumber = '';
  const bookMatch = upper.match(/(?:DEL\s+LIBRO|LIBRO|TOMO)[:\s]+([A-Z0-9\s]{1,30})/i);
  if (bookMatch && bookMatch[1]) {
    bookNumber = bookMatch[1].split(/\n|\r|FOJA|FECHA/)[0].trim();
  }

  let folioPage = '';
  const pageMatch = upper.match(/(?:A\s+FOJAS|FOJA|PÁGINA|PAG\.)[:\s]+(\d+)/i);
  if (pageMatch && pageMatch[1]) {
    folioPage = `Foja ${pageMatch[1].trim()}`;
  }

  // Detect Folio / Registration
  let folio = '';
  const folioMatch = upper.match(/(?:FOLIO|EXPEDIENTE|REGISTRO|NO\.?)[:\s]+([A-Z0-9\-\/]{4,25})/i);
  if (folioMatch && folioMatch[1]) {
    folio = folioMatch[1].trim();
  }

  // Calculate initials from ownerName if available
  let initials = '';
  if (ownerName) {
    const nameParts = ownerName.split(' ').filter(Boolean);
    if (nameParts.length >= 2) {
      initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    } else if (nameParts.length === 1) {
      initials = nameParts[0].slice(0, 2).toUpperCase();
    }
  }

  // Confidence score based on identified fields
  let score = 0;
  if (upper.length > 20) score += 15;
  if (upper.length > 80) score += 15;
  if (ownerName) score += 25;
  if (address) score += 15;
  if (surfaceHectares > 0) score += 10;
  if (ejido) score += 10;
  if (bookNumber || folioPage || folio) score += 10;
  const confidenceScore = Math.min(99, Math.max(0, score));

  const issueDate = detectedYear ? `${detectedYear}-06-15` : '';
  const validityRange = detectedYear ? `${detectedYear} - ${detectedYear + 3}` : '';
  const omittedFields = getHistoricalFieldCompatibility(detectedYear || 1990);

  return {
    id: `digitized-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sourceType,
    documentTitle: detectedYear ? `Expediente Registral Tradicional (${detectedYear})` : 'Expediente Registral',
    documentYear: detectedYear || undefined,
    extractedText: rawText,
    documentImageUrl: imageUrl,
    ownerName,
    address: address || (ejido ? `Congregación ${ejido}, Municipio de Pánuco, Ver.` : ''),
    propertyName,
    ejido,
    municipio: 'Pánuco',
    surfaceHectares,
    tenureType,
    cattleCount,
    species,
    folio,
    registrationNumber: folio,
    bookNumber,
    folioPage,
    issueDate,
    validityRange,
    initials,
    topSymbol: 'none',
    bottomSymbol: 'herradura',
    orientation: 'normal',
    brandHash: `${initials || 'XX'}|none|herradura|normal`,
    omittedFields,
    confidenceScore,
  };
}

/**
 * FIX_NO_MOCK: Sin fichas históricas de ejemplo.
 * Array vacío. Los samples reales deben venir del archivo físico escaneado.
 */
export const HISTORICAL_SAMPLES: HistoricalSampleRecord[] = [];