/**
 * Motor Especializado de OCR y Validación de Credenciales INE / IFE
 * H. Ayuntamiento de Pánuco, Veracruz · Dirección de Fomento Agropecuario
 */

export interface IneParsedData {
  fullName: string;
  names: string;
  firstLastName: string;
  secondLastName: string;
  curp: string;
  rfc: string;
  ine: string;
  address: string;
  municipio: string;
  state: string;
  ejido: string;
  section?: string;
  validity?: string;
  cic?: string;
  birthDate?: string;
  gender?: 'H' | 'M';
  suggestedInitials: string;
  confidenceScore: number;
  confidenceLevel: 'alta' | 'media' | 'baja';
  fieldStatus: {
    name: 'valido' | 'alerta' | 'error';
    curp: 'valido' | 'alerta' | 'error';
    rfc: 'valido' | 'alerta' | 'error';
    address: 'valido' | 'alerta' | 'error';
    ine: 'valido' | 'alerta' | 'error';
  };
  validationErrors: string[];
  crossValidationWarnings: string[];
  notes?: string;
}

export const PANUCO_EJIDOS_LIST = [
  'Reventadero', 'Tamos', 'Villa Cacalilao', 'Canoas', 'Moralillo',
  'Bermúdez', 'Oviedo', 'Topila', 'Corcovado', 'Mahuaves', 'El Barco',
  'Tancheche', 'Calentadores', 'Ex-Hacienda Chintón', 'Mayorazgo',
  'Ánimas', 'La Trinidad', 'Vega de Otates', 'Tampiquito',
];

export const MEXICAN_CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
export const MEXICAN_RFC_REGEX = /^[A-Z]{4}\d{6}([A-Z0-9]{3})?$/;

const NOISE_KEYWORDS_REGEX = /\b(INSTITUTO|NACIONAL|ELECTORAL|CREDENCIAL|PARA|VOTAR|M[EÉ]XICO|MEXICO|NOMBRE|DOMICILIO|CLAVE\s*DE\s*ELECTOR|CLAVE|ELECTOR|CURP|RFC|SEXO\s*[HM]|SEXO|HOMBRE|MUJER|\bH\b|\bM\b|EDAD\s*\d+|EDAD|FECHA\s*DE\s*NACIMIENTO|FECHA|NACIMIENTO|A[ÑN]O\s*DE\s*REGISTRO|REGISTRO|SECCI[OÓ]N\s*\d*|SECCION|LOCALIDAD|MUNICIPIO|ESTADO|VIGENCIA|FOLIO|EMISI[OÓ]N|IDMEX|FIRMA|TITULAR|HOLOGRAMA)\b/gi;

export function cleanIneName(rawNameText: string): {
  fullName: string;
  names: string;
  firstLastName: string;
  secondLastName: string;
  isValid: boolean;
  noiseDetected: string[];
} {
  const noiseDetected: string[] = [];
  if (!rawNameText || typeof rawNameText !== 'string') {
    return { fullName: '', names: '', firstLastName: '', secondLastName: '', isValid: false, noiseDetected };
  }

  const foundNoise = rawNameText.match(NOISE_KEYWORDS_REGEX);
  if (foundNoise) {
    foundNoise.forEach((k) => {
      const up = k.trim().toUpperCase();
      if (!noiseDetected.includes(up)) noiseDetected.push(up);
    });
  }

  let cleaned = rawNameText.replace(NOISE_KEYWORDS_REGEX, ' ');
  cleaned = cleaned.replace(/\bETE\b/gi, ' ');
  cleaned = cleaned.replace(/\b[0-9]+\b/g, ' ');
  cleaned = cleaned.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ' ');

  const words = cleaned
    .toUpperCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => (w.length > 1 && !['DE', 'DEL', 'LA', 'LAS', 'LOS'].includes(w)) || w.length > 2);

  const filteredWords = words.filter((w) => {
    return !/^(SEXO|H|M|EDAD|ANIO|ANO|REG|SEC|CVE|CURP|RFC|INE|IFE)$/.test(w);
  });

  if (filteredWords.length === 0) {
    return { fullName: '', names: '', firstLastName: '', secondLastName: '', isValid: false, noiseDetected };
  }

  let firstLastName = '';
  let secondLastName = '';
  let names = '';

  if (filteredWords.length >= 3) {
    firstLastName = filteredWords[0];
    secondLastName = filteredWords[1];
    names = filteredWords.slice(2).join(' ');
  } else if (filteredWords.length === 2) {
    firstLastName = filteredWords[0];
    names = filteredWords[1];
  } else {
    names = filteredWords[0];
  }

  const fullName = filteredWords.join(' ');
  const isValid = filteredWords.length >= 2 && fullName.length >= 5;

  return { fullName, names, firstLastName, secondLastName, isValid, noiseDetected };
}

export function computeExpectedInitials(
  firstLastName: string,
  secondLastName: string,
  names: string
): { curpPrefix: string; rfcPrefix: string; suggestedInitials: string } {
  const p = (firstLastName || '').trim().toUpperCase();
  const m = (secondLastName || '').trim().toUpperCase();
  const n = (names || '').trim().toUpperCase();

  if (!p) {
    return { curpPrefix: '', rfcPrefix: '', suggestedInitials: 'AG' };
  }

  const pFirst = p[0] || 'X';
  let pVowel = 'X';
  for (let i = 1; i < p.length; i++) {
    if (/[AEIOUÁÉÍÓÚ]/.test(p[i])) {
      pVowel = p[i].replace(/[Á]/, 'A').replace(/[É]/, 'E').replace(/[Í]/, 'I').replace(/[Ó]/, 'O').replace(/[Ú]/, 'U');
      break;
    }
  }

  const mFirst = m[0] || 'X';
  let nFirst = 'X';
  const nameParts = n.split(/\s+/).filter(Boolean);
  if (nameParts.length > 1 && (nameParts[0] === 'JOSE' || nameParts[0] === 'JOSÉ' || nameParts[0] === 'MARIA' || nameParts[0] === 'MARÍA')) {
    nFirst = nameParts[1][0] || nameParts[0][0];
  } else if (nameParts.length > 0) {
    nFirst = nameParts[0][0];
  }

  const curpPrefix = `${pFirst}${pVowel}${mFirst}${nFirst}`;
  const rfcPrefix = `${pFirst}${pVowel}${mFirst}${nFirst}`;

  let suggestedInitials = `${pFirst}${mFirst !== 'X' ? mFirst : nFirst}`;
  if (suggestedInitials.length < 2) suggestedInitials = p.slice(0, 2);

  return { curpPrefix, rfcPrefix, suggestedInitials };
}
export function crossValidateCurp(
  curp: string,
  firstLastName: string,
  secondLastName: string,
  names: string,
  allWords?: string[]
): {
  isValidFormat: boolean;
  matchesName: boolean;
  expectedPrefix: string;
  actualPrefix: string;
  errorMessage?: string;
  resolvedNames?: { firstLastName: string; secondLastName: string; names: string };
} {
  const cleanCurp = (curp || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isValidFormat = MEXICAN_CURP_REGEX.test(cleanCurp);
  const actualPrefix = cleanCurp.slice(0, 4);

  const h1 = computeExpectedInitials(firstLastName, secondLastName, names);

  let h2 = h1;
  let resolvedNames = { firstLastName, secondLastName, names };

  if (allWords && allWords.length >= 3) {
    const p2 = allWords[allWords.length - 2];
    const m2 = allWords[allWords.length - 1];
    const n2 = allWords.slice(0, allWords.length - 2).join(' ');
    h2 = computeExpectedInitials(p2, m2, n2);
  } else if (allWords && allWords.length === 2) {
    const p2 = allWords[1];
    const n2 = allWords[0];
    h2 = computeExpectedInitials(p2, '', n2);
  }

  let selectedPrefix = h1.curpPrefix;

  if (!cleanCurp) {
    return {
      isValidFormat: false,
      matchesName: false,
      expectedPrefix: selectedPrefix,
      actualPrefix: '',
      errorMessage: 'CURP no detectada o vacía. Se requiere cotejo y captura manual.',
      resolvedNames,
    };
  }

  if (!isValidFormat) {
    return {
      isValidFormat: false,
      matchesName: false,
      expectedPrefix: selectedPrefix,
      actualPrefix,
      errorMessage: `CURP "${cleanCurp}" no cumple con el formato estándar oficial de 18 caracteres de la RENAPO.`,
      resolvedNames,
    };
  }

  let matchesName = false;
  let errorMessage: string | undefined;

  const matchH1 = actualPrefix.slice(0, 2) === h1.curpPrefix.slice(0, 2);
  const matchH2 = actualPrefix.slice(0, 2) === h2.curpPrefix.slice(0, 2);

  if (matchH1) {
    matchesName = true;
    selectedPrefix = h1.curpPrefix;
  } else if (matchH2) {
    matchesName = true;
    selectedPrefix = h2.curpPrefix;
    if (allWords && allWords.length >= 3) {
      resolvedNames = {
        firstLastName: allWords[allWords.length - 2],
        secondLastName: allWords[allWords.length - 1],
        names: allWords.slice(0, allWords.length - 2).join(' '),
      };
    }
  } else {
    matchesName = false;
    errorMessage = `Incongruencia crítica detectada: La CURP (${actualPrefix}...) no coincide con los apellidos del titular "${firstLastName || names}" (esperado: ${h1.curpPrefix}...). Se rechaza asignación automática.`;
  }

  return { isValidFormat, matchesName, expectedPrefix: selectedPrefix, actualPrefix, errorMessage, resolvedNames };
}

export function crossValidateRfc(
  rfc: string,
  firstLastName: string,
  secondLastName: string,
  names: string,
  curp?: string
): {
  isValidFormat: boolean;
  matchesName: boolean;
  expectedPrefix: string;
  actualPrefix: string;
  errorMessage?: string;
} {
  const cleanRfc = (rfc || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isValidFormat = MEXICAN_RFC_REGEX.test(cleanRfc);
  const { rfcPrefix } = computeExpectedInitials(firstLastName, secondLastName, names);
  const actualPrefix = cleanRfc.slice(0, 4);

  if (!cleanRfc) {
    return {
      isValidFormat: false,
      matchesName: false,
      expectedPrefix: rfcPrefix,
      actualPrefix: '',
      errorMessage: 'RFC no visible en el plástico. Requiere cotejo con cédula fiscal SAT.',
    };
  }

  if (!isValidFormat) {
    return {
      isValidFormat: false,
      matchesName: false,
      expectedPrefix: rfcPrefix,
      actualPrefix,
      errorMessage: `RFC "${cleanRfc}" no cumple con la estructura fiscal mexicana (debe tener 10 o 13 caracteres).`,
    };
  }

  let matchesName = true;
  let errorMessage: string | undefined;

  if (rfcPrefix && rfcPrefix.length >= 3) {
    if (actualPrefix.slice(0, 2) !== rfcPrefix.slice(0, 2)) {
      matchesName = false;
      errorMessage = `Incongruencia detectada en RFC: "${actualPrefix}" no coincide con el titular "${firstLastName}" (esperado: ${rfcPrefix}).`;
    }
  }

  return { isValidFormat, matchesName, expectedPrefix: rfcPrefix, actualPrefix, errorMessage };
}

/**
 * FIX_ADDRESS_FORMAT: Embellece la dirección pegada que devuelve PaddleOCR.
 * Ej: "CSINNOMBREDET947,FRACCLOSHIGOS93994,PANUCO,VER"
 *  -> "C SIN NOMBRE DET 947, FRACC LOS HIGOS 93994, PÁNUCO, VER."
 */
function beautifyAddress(raw: string): string {
  if (!raw) return '';

  let addr = raw.toUpperCase();

  // 1. Insertar espacio entre letra y numero (pero NO dentro de numeros o siglas ya conocidas)
  addr = addr.replace(/([A-Z])(\d)/g, '$1 $2');

  // 2. Insertar espacio entre numero y letra
  addr = addr.replace(/(\d)([A-Z])/g, '$1 $2');

  // 3. Diccionario de abreviaciones tipicas
  addr = addr
    .replace(/\bC\b/g, 'C.')
    .replace(/\bCOL\b/g, 'COL.')
    .replace(/\bFRACC\b/g, 'FRACC.')
    .replace(/\bFRAC\b/g, 'FRACC.')
    .replace(/\bLOC\b/g, 'LOC.')
    .replace(/\bMZ\b/g, 'MZ.')
    .replace(/\bLT\b/g, 'LT.')
    .replace(/\bAV\b/g, 'AV.')
    .replace(/\bCP\b/g, 'C.P.')
    .replace(/\bNO\b/g, 'NO.')
    .replace(/\bDET\b/g, 'DET')
    .replace(/\bINT\b/g, 'INT.')
    .replace(/\bEXT\b/g, 'EXT.');

  // 4. Diccionario de palabras largas que PaddleOCR pega
  const palabrasComunes = [
    'SINNOMBRE', 'SIN NUMBRE', 'SIN NOMBRE',
    'CONGREGACION', 'FRACCIONAMIENTO', 'COLONIA',
    'PANUCO', 'VERACRUZ', 'TEMPOAL', 'REVENTADERO',
    'CACALILAO', 'MORALILLO', 'OVIEDO', 'TAMOS',
    'HIGOS', 'CHAPACAO', 'PILOTO'
  ];

  for (const palabra of palabrasComunes) {
    const regex = new RegExp(palabra, 'g');
    addr = addr.replace(regex, palabra + ' ');
  }

  // 5. Limpiar espacios multiples
  addr = addr.replace(/\s{2,}/g, ' ').trim();

  // 6. Espacio despues de comas
  addr = addr.replace(/,\s*/g, ', ');

  // 7. Quitar punto final duplicado
  addr = addr.replace(/\.\s*\./g, '.');

  // 8. Si termina sin punto, agregarlo
  if (addr && !addr.endsWith('.')) addr += '.';

  return addr;
}

export function cleanIneAddress(
  rawAddressText: string,
  fullText: string = ''
): {
  address: string;
  ejido: string;
  municipio: string;
  state: string;
  isDetailed: boolean;
} {
  if (!rawAddressText || typeof rawAddressText !== 'string') {
    return { address: '', ejido: '', municipio: 'Pánuco', state: 'Veracruz', isDetailed: false };
  }

  let addr = rawAddressText
    .replace(/\bDOMICILIO\b/gi, ' ')
    .replace(/\bCLAVE\s*DE\s*ELECTOR\b/gi, ' ')
    .replace(/\bCURP\b/gi, ' ')
    .replace(/\bSECCI[OÓ]N\b/gi, ' ')
    .replace(/\bVIGENCIA\b/gi, ' ')
    .trim();

  addr = addr.replace(/[\n\r]+/g, ', ').replace(/\s+/g, ' ').toUpperCase();
  addr = addr.replace(/,\s*,+/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();

  let detectedEjido = '';
  const combinedText = `${addr} ${fullText}`.toUpperCase();

  for (const ej of PANUCO_EJIDOS_LIST) {
    const ejUpper = ej.toUpperCase();
    if (combinedText.includes(ejUpper)) {
      detectedEjido = ej;
      break;
    }
  }

  if (!detectedEjido) {
    if (/CENTRO|BLVD|AVENIDA|CALLE|CABECERA|COLONIA/i.test(addr)) {
      detectedEjido = 'Cabecera Municipal';
    }
  }

  const isDetailed = addr.length >= 15 && /\d+/.test(addr);

  // FIX_ADDRESS_APPLY: Embellecer la direccion antes de devolverla
  const beautifiedAddress = beautifyAddress(addr);

  return { address: beautifiedAddress, ejido: detectedEjido, municipio: 'Pánuco', state: 'Veracruz', isDetailed };
}
export function calculateRealConfidenceScore(params: {
  isNameValid: boolean;
  nameWordsCount: number;
  noiseTokensCount: number;
  isCurpValidFormat: boolean;
  curpMatchesName: boolean;
  hasCurp: boolean;
  isRfcValidFormat: boolean;
  rfcMatchesName: boolean;
  hasRfc: boolean;
  isAddressDetailed: boolean;
  hasAddress: boolean;
  hasIneKey: boolean;
}): { score: number; level: 'alta' | 'media' | 'baja'; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (params.isNameValid && params.nameWordsCount >= 3) {
    score += 30;
  } else if (params.isNameValid && params.nameWordsCount === 2) {
    score += 20;
    reasons.push('Nombre con solo 2 componentes (posible falta de segundo apellido).');
  } else {
    reasons.push('Nombre no identificado o con caracteres inválidos.');
  }

  if (params.noiseTokensCount > 0) {
    score -= Math.min(25, params.noiseTokensCount * 12);
    reasons.push(`Se detectaron y eliminaron ${params.noiseTokensCount} etiquetas/ruidos de escaneo en el nombre.`);
  }

  if (params.hasCurp) {
    if (params.isCurpValidFormat) {
      if (params.curpMatchesName) {
        score += 25;
      } else {
        score -= 20;
        reasons.push('Incongruencia entre la CURP extraída y los apellidos del titular.');
      }
    } else {
      reasons.push('La CURP no cumple con el formato estándar de 18 caracteres.');
    }
  } else {
    reasons.push('CURP no detectada en la credencial.');
  }

  if (params.hasRfc) {
    if (params.isRfcValidFormat && params.rfcMatchesName) {
      score += 15;
    } else if (params.isRfcValidFormat) {
      score += 8;
    } else {
      reasons.push('RFC con formato no estándar.');
    }
  } else {
    reasons.push('RFC no visible en el documento.');
  }

  if (params.hasAddress) {
    if (params.isAddressDetailed) {
      score += 20;
    } else {
      score += 10;
      reasons.push('Domicilio incompleto (falta número exterior o código postal).');
    }
  } else {
    reasons.push('Domicilio no localizado.');
  }

  if (params.hasIneKey) {
    score += 10;
  } else {
    reasons.push('Clave de elector no localizada.');
  }

  score = Math.max(0, Math.min(99, Math.round(score)));

  let level: 'alta' | 'media' | 'baja' = 'baja';
  if (score >= 82) level = 'alta';
  else if (score >= 60) level = 'media';
  else level = 'baja';

  return { score, level, reasons };
}

export function parseIneTextWithCrossValidation(
  rawText: string,
  ocrLines?: Array<{ text: string; confidence?: number; box?: any[] }>
): IneParsedData {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 15) {
    return {
      fullName: '', names: '', firstLastName: '', secondLastName: '',
      curp: '', rfc: '', ine: '', address: '',
      municipio: 'Pánuco', state: 'Veracruz', ejido: '',
      suggestedInitials: '', confidenceScore: 0, confidenceLevel: 'baja',
      fieldStatus: { name: 'error', curp: 'error', rfc: 'error', address: 'error', ine: 'error' },
      validationErrors: ['No se detectó texto suficiente en la credencial electoral analizada.'],
      crossValidationWarnings: [],
      notes: 'No fue posible leer la credencial. Asegúrese de orientar horizontalmente y capturar con buena iluminación.',
    };
  }

  // FIX_USE_LINES: si tenemos ocrLines, procesar linea por linea para mejor precision
  if (ocrLines && ocrLines.length > 0) {
    console.log('[Parser-Lines] Procesando ' + ocrLines.length + ' lineas del OCR');

    // Filtrar lineas vacias
    const validLines = ocrLines
      .filter((l) => l.text && l.text.trim().length > 0)
      .map((l) => l.text.trim().toUpperCase());

    // Buscar CURP en las lineas
    let curpEncontrada = '';
    for (const line of validLines) {
      const noSpace = line.replace(/\s+/g, '');
      const curpMatch = noSpace.match(/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/);
      if (curpMatch) {
        curpEncontrada = curpMatch[0];
        console.log('[Parser-Lines] CURP detectada: ' + curpEncontrada);
        break;
      }
    }

    // Buscar clave de elector
    let ineEncontrada = '';
    for (const line of validLines) {
      const noSpace = line.replace(/\s+/g, '');
      const ineMatch = noSpace.match(/[A-Z]{6}\d{8}[HM]\d{3}/);
      if (ineMatch) {
        ineEncontrada = ineMatch[0];
        console.log('[Parser-Lines] Clave elector detectada: ' + ineEncontrada);
        break;
      }
    }

    // Buscar nombre entre "NOMBRE" y "DOMICILIO"
    const nombreIdx = validLines.findIndex((l) => /^NOMBRE\b/.test(l));
    const domicilioIdx = validLines.findIndex((l) => /^DOMICILIO\b/.test(l));

    let nombreAcumulado = '';
    if (nombreIdx >= 0 && domicilioIdx > nombreIdx) {
      const nameLines = validLines.slice(nombreIdx + 1, domicilioIdx);
      const cleanNameLines = nameLines.filter((l) =>
        !/^SEXO|^EDAD|^FECHA|^ANIO|^AÑO|^REGISTRO|^CLAVE|^CURP|^RFC/i.test(l)
      );
      nombreAcumulado = cleanNameLines.join(' ').trim();
      console.log('[Parser-Lines] Nombre acumulado: ' + nombreAcumulado);
    }

    // Buscar direccion
    let direccionAcumulada = '';
    if (domicilioIdx >= 0) {
      const endAddrIdx = validLines.findIndex(
        (l, i) => i > domicilioIdx && /^CLAVE|^CURP|^RFC/i.test(l)
      );
      const addLines = endAddrIdx > 0
        ? validLines.slice(domicilioIdx + 1, endAddrIdx)
        : validLines.slice(domicilioIdx + 1, domicilioIdx + 5);
      direccionAcumulada = addLines.join(', ').trim();
    }

    // Buscar seccion y vigencia
    let seccionEncontrada = '';
    let vigenciaEncontrada = '';
    for (const line of validLines) {
      if (/^\d{4}$/.test(line) && line.startsWith('28')) {
        seccionEncontrada = line;
      }
      const vigMatch = line.match(/\d{4}\s*-\s*\d{4}/);
      if (vigMatch) vigenciaEncontrada = vigMatch[0];
    }

    // Construir texto reconstruido con formato esperado por el parser
    const textReconstruido = [
      nombreAcumulado ? 'NOMBRE\n' + nombreAcumulado : '',
      direccionAcumulada ? 'DOMICILIO\n' + direccionAcumulada : '',
      ineEncontrada ? 'CLAVE DE ELECTOR ' + ineEncontrada : '',
      curpEncontrada ? 'CURP ' + curpEncontrada : '',
      seccionEncontrada ? 'SECCION ' + seccionEncontrada : '',
      vigenciaEncontrada ? 'VIGENCIA ' + vigenciaEncontrada : '',
    ].filter(Boolean).join('\n');

    console.log('[Parser-Lines] Texto reconstruido:');
    console.log(textReconstruido);

    // Reemplazar rawText con el texto reconstruido
    rawText = textReconstruido || rawText;
  }

  const lines = rawText.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const textUpper = rawText.toUpperCase();

  let rawName = '';
  const nombreLineIdx = lines.findIndex((l) => /^NOMBRE\b/i.test(l) || /NOMBRE/i.test(l));

  if (nombreLineIdx !== -1) {
    const nameLines: string[] = [];
    const sameLineName = lines[nombreLineIdx]
      .replace(/^.*?NOMBRE\s*[:.-]?\s*/i, '')
      .replace(/^ETE\s+/i, '')
      .trim();

    if (sameLineName.length > 2) {
      nameLines.push(sameLineName);
    } else {
      for (let i = nombreLineIdx + 1; i < Math.min(nombreLineIdx + 7, lines.length); i++) {
        const line = lines[i].trim();
        if (/^(DOMICILIO|CLAVE\s+DE\s+ELECTOR|CLAVE|CURP|RFC|FECHA|SECCI|VIGENCIA|A[ÑN]O)/i.test(line)) {
          break;
        }
        if (/^SEXO\s*[HM]?$/i.test(line)) {
          continue;
        }
        if (line.length > 0) {
          nameLines.push(line);
        }
      }
    }
    rawName = nameLines.join(' ');
  }

  if (!rawName) {
    for (const line of lines) {
      const lineUpper = line.toUpperCase().trim();
      if (
        lineUpper.length > 8 &&
        !/INSTITUTO|NACIONAL|ELECTORAL|CREDENCIAL|VOTAR|DOMICILIO|CLAVE|CURP|RFC|SECCI|ESTADO|MUNICIPIO|LOCALIDAD|IDMEX/i.test(lineUpper) &&
        /^[A-ZÁÉÍÓÚÑ\s]+$/.test(lineUpper)
      ) {
        rawName = lineUpper;
        break;
      }
    }
  }

  const cleanedNameResult = cleanIneName(rawName);

  const curpMatches = textUpper.match(/[A-Z]{4}\d{6}[HM][A-Z]{2}[A-Z0-9]{3}[0-9A-Z]\d/g);
  let rawCurp = curpMatches ? curpMatches[0] : '';

  let ineKey = '';
  const ineMatch =
    textUpper.match(/[A-Z]{4,6}\d{8}[HM]\d{3}/) ||
    textUpper.match(/CLAVE\s*(?:DE)?\s*ELECTOR[^\w]*([A-Z0-9]{15,18})/) ||
    textUpper.match(/IDMEX(\d{9})/);
  if (ineMatch) {
    ineKey = ineMatch[1] || ineMatch[0];
  }

  let rawAddress = '';
  const domLineIdx = lines.findIndex((l) => /DOMICILIO/i.test(l));
  if (domLineIdx !== -1) {
    const addrLines: string[] = [];
    const sameLineDom = lines[domLineIdx].replace(/^.*?DOMICILIO\s*[:.-]?\s*/i, '').trim();

    if (sameLineDom.length > 2) addrLines.push(sameLineDom);

    for (let i = domLineIdx + 1; i < Math.min(domLineIdx + 5, lines.length); i++) {
      const line = lines[i];
      if (/CLAVE|ELECTOR|CURP|RFC|FOLIO|SECCI|VIGENCIA|ESTADO/i.test(line)) {
        break;
      }
      addrLines.push(line);
    }
    rawAddress = addrLines.join(', ');
  }

  const cleanedAddressResult = cleanIneAddress(rawAddress, textUpper);

  const nameWords = cleanedNameResult.fullName.split(/\s+/).filter(Boolean);
  const curpValidation = crossValidateCurp(
    rawCurp,
    cleanedNameResult.firstLastName,
    cleanedNameResult.secondLastName,
    cleanedNameResult.names,

    
    nameWords
  );

  if (curpValidation.resolvedNames) {
    cleanedNameResult.firstLastName = curpValidation.resolvedNames.firstLastName;
    cleanedNameResult.secondLastName = curpValidation.resolvedNames.secondLastName;
    cleanedNameResult.names = curpValidation.resolvedNames.names;
  }

  let finalCurp = rawCurp;
  const crossValidationWarnings: string[] = [];
  const validationErrors: string[] = [];

  if (rawCurp && !curpValidation.matchesName) {
    crossValidationWarnings.push(
      curpValidation.errorMessage ||
        `Incongruencia: La CURP (${rawCurp}) no coincide con los apellidos del titular "${cleanedNameResult.fullName}". Se ha dejado en blanco para captura manual obligatoria.`
    );
    finalCurp = '';
  } else if (!rawCurp) {
    validationErrors.push('CURP no localizada. Debe capturarse manualmente.');
  }

  let rawRfc = '';
  const explicitRfcMatch = textUpper.match(/\bRFC\s*[:.-]?\s*([A-Z]{4}\d{6}[A-Z0-9]{3})/);
  if (explicitRfcMatch) {
    rawRfc = explicitRfcMatch[1];
  } else {
    const textWithoutKeys = textUpper
      .replace(/CLAVE\s*(?:DE)?\s*ELECTOR[^\n]*/gi, '')
      .replace(/CURP[^\n]*/gi, '');
    const rfcMatch = textWithoutKeys.match(/\b([A-Z]{4}\d{6}[A-Z0-9]{3})\b/);
    if (rfcMatch) rawRfc = rfcMatch[1];
  }

  let finalRfc = rawRfc;
  let rfcMatchesName = false;

  if (rawRfc) {
    const rfcValidation = crossValidateRfc(
      rawRfc,
      cleanedNameResult.firstLastName,
      cleanedNameResult.secondLastName,
      cleanedNameResult.names,
      finalCurp
    );
    rfcMatchesName = rfcValidation.matchesName;
    if (!rfcValidation.matchesName) {
      crossValidationWarnings.push(rfcValidation.errorMessage || 'El RFC detectado no coincide con las iniciales del titular.');
      finalRfc = '';
    }
  }

  if (!finalRfc && finalCurp && finalCurp.length >= 10 && curpValidation.matchesName) {
    finalRfc = `${finalCurp.slice(0, 10)}`;
    rfcMatchesName = true;
  }

  let section = '';
  const secMatch = textUpper.match(/SECCI[OÓ]N[^\d]*(\d{4})/) || textUpper.match(/\b(28\d{2})\b/);
  if (secMatch) section = secMatch[1];

  let validity = '';
  const vigMatch = textUpper.match(/(\d{4}\s*[-–]\s*\d{4})/);
  if (vigMatch) validity = vigMatch[1];

  const { suggestedInitials } = computeExpectedInitials(
    cleanedNameResult.firstLastName,
    cleanedNameResult.secondLastName,
    cleanedNameResult.names
  );

  const confidence = calculateRealConfidenceScore({
    isNameValid: cleanedNameResult.isValid,
    nameWordsCount: cleanedNameResult.fullName.split(/\s+/).length,
    noiseTokensCount: cleanedNameResult.noiseDetected.length,
    isCurpValidFormat: curpValidation.isValidFormat,
    curpMatchesName: curpValidation.matchesName,
    hasCurp: Boolean(finalCurp),
    isRfcValidFormat: Boolean(finalRfc && MEXICAN_RFC_REGEX.test(finalRfc)),
    rfcMatchesName: Boolean(finalRfc && rfcMatchesName),
    hasRfc: Boolean(finalRfc),
    isAddressDetailed: cleanedAddressResult.isDetailed,
    hasAddress: Boolean(cleanedAddressResult.address),
    hasIneKey: Boolean(ineKey && ineKey.length >= 10),
  });

  const fieldStatus = {
    name: cleanedNameResult.isValid ? ('valido' as const) : ('error' as const),
    curp: finalCurp && curpValidation.isValidFormat ? ('valido' as const) : ('error' as const),
    rfc: finalRfc ? ('valido' as const) : ('alerta' as const),
    address: cleanedAddressResult.isDetailed ? ('valido' as const) : ('alerta' as const),
    ine: ineKey ? ('valido' as const) : ('alerta' as const),
  };

  return {
    fullName: cleanedNameResult.fullName,
    names: cleanedNameResult.names,
    firstLastName: cleanedNameResult.firstLastName,
    secondLastName: cleanedNameResult.secondLastName,
    curp: finalCurp,
    rfc: finalRfc,
    ine: ineKey,
    address: cleanedAddressResult.address,
    municipio: cleanedAddressResult.municipio,
    state: cleanedAddressResult.state,
    ejido: cleanedAddressResult.ejido,
    section,
    validity,
    suggestedInitials,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    fieldStatus,
    validationErrors,
    crossValidationWarnings,
    notes:
      confidence.level === 'baja'
        ? '⚠️ Confiabilidad baja. El cotejo y corrección manual es obligatorio para CURP, RFC y Domicilio.'
        : 'Credencial analizada con motor de segmentación y cotejo de coherencia.',
  };
}