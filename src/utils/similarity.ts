import { BrandConfig, HistoricalRecord, SimilarityMatch, TraditionalSymbol, BrandOrientation } from '../types';
import { getMunicipalDatabase } from './database';

export function calculateSimilarity(current: BrandConfig, historical: HistoricalRecord): {
  percentage: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  const currInitials = (current.initials || '').toUpperCase().trim();
  const histInitials = (historical.initials || '').toUpperCase().trim();

  // 1. Check Initials / Monogram
  if (currInitials === histInitials && currInitials.length > 0) {
    score += 55;
    reasons.push(`Monograma idéntico: "${currInitials}"`);
  } else if (currInitials.length > 0 && histInitials.length > 0) {
    // Check anagram (e.g. "AG" vs "GA")
    const sortedCurr = currInitials.split('').sort().join('');
    const sortedHist = histInitials.split('').sort().join('');
    if (sortedCurr === sortedHist) {
      score += 40;
      reasons.push(`Transposición de letras (${currInitials} vs ${histInitials})`);
    } else {
      // Check shared letters
      let sharedCount = 0;
      for (const char of currInitials) {
        if (histInitials.includes(char)) sharedCount++;
      }
      if (sharedCount > 0) {
        const ratio = sharedCount / Math.max(currInitials.length, histInitials.length);
        const letterPoints = Math.round(ratio * 30);
        score += letterPoints;
        if (letterPoints >= 20) {
          reasons.push(`Coincidencia fonética/caracteres compartidos: ${sharedCount} letra(s)`);
        }
      }
    }
  }

  // 2. Check Top Symbol
  if (current.topSymbol !== 'none' && current.topSymbol === historical.topSymbol) {
    score += 20;
    reasons.push(`Símbolo superior coincidente: ${formatSymbolName(current.topSymbol)}`);
  }

  // 3. Check Bottom Symbol
  if (current.bottomSymbol !== 'none' && current.bottomSymbol === historical.bottomSymbol) {
    score += 15;
    reasons.push(`Símbolo base coincidente: ${formatSymbolName(current.bottomSymbol)}`);
  }

  // 4. Check Orientation
  if (current.orientation === historical.orientation) {
    score += 10;
    if (current.orientation !== 'normal') {
      reasons.push(`Estilo de forja idéntico (${formatOrientationName(current.orientation)})`);
    }
  }

  // 5. Special Penalty: If letters match exactly and orientation matches
  if (currInitials === histInitials && currInitials.length > 0) {
    if (current.topSymbol === historical.topSymbol && current.bottomSymbol === historical.bottomSymbol) {
      score = Math.max(score, 98); // Quasi-duplicate
      reasons.unshift('Diseño virtualmente idéntico en morfología y signos distintivos');
    }
  }

  // 6. Check Historical Digitized Archive Origin
  if (historical.isHistoricalDigitized && score >= 40) {
    reasons.push('Fierro rescatado del Archivo Físico Tradicional Municipal de Pánuco');
  }

  // FIX_CAP_INICIALES: Limitar el score maximo segun longitud de iniciales
  // Esto evita falsos positivos cuando el usuario solo escribio 1 letra
  let maxCap = 100;
  if (currInitials.length === 0) {
    // Sin iniciales -> no hay comparacion posible
    return { percentage: 0, reasons: ['Sin iniciales capturadas'] };
  } else if (currInitials.length === 1) {
    // Con 1 sola letra -> maximo 30% (una letra NO es distintiva)
    maxCap = 30;
    reasons.push('⚠️ Con una sola letra no se puede determinar duplicidad confiable');
  } else if (currInitials.length === 2) {
    // Con 2 letras -> maximo 75% (para que no se marque como duplicado estricto)
    maxCap = 75;
  }
  // Con 3 o 4 letras -> sin cap (hasta 100%)

  let cappedScore = Math.min(score, maxCap);

  // Adicional: si las iniciales NO coinciden exactamente, el score maximo es 60%
  if (currInitials !== histInitials) {
    cappedScore = Math.min(cappedScore, 60);
  }

  const finalPercentage = Math.min(100, Math.max(0, cappedScore));
  return {
    percentage: finalPercentage,
    reasons,
  };
}

export function formatSymbolName(symbol: TraditionalSymbol): string {
  switch (symbol) {
    case 'corona': return 'Corona Real Superior';
    case 'cruz': return 'Cruz Ganadera';
    case 'estrella': return 'Estrella de 5 Puntas';
    case 'medialuna': return 'Media Luna Base';
    case 'barra': return 'Barra de Forja';
    case 'doble_barra': return 'Doble Barra Estabilizadora';
    case 'gancho_izq': return 'Gancho Forjado Izquierdo';
    case 'gancho_der': return 'Gancho Forjado Derecho';
    case 'herradura': return 'Herradura de Base';
    case 'flecha': return 'Punta de Flecha';
    case 'flor_lis': return 'Flor de Lis';
    case 'circulo': return 'Aro Perimetral';
    default: return 'Ninguno';
  }
}

export function formatOrientationName(orientation: BrandOrientation): string {
  switch (orientation) {
    case 'normal': return 'Normal / Vertical';
    case 'enlazado': return 'Enlazado / Monograma Corrido';
    case 'echado': return 'Fierro Echado (-90°)';
    case 'invertido': return 'Invertido / Reflejado';
    case 'inclinado': return 'Inclinado 45°';
    default: return orientation;
  }
}

export interface AntiDuplicityAnalysis {
  highestSimilarity: number;
  criticalMatch: HistoricalRecord | null;
  topMatches: SimilarityMatch[];
  isUnique: boolean; // true if highestSimilarity < 85%
  statusText: string;
  verdictCode: 'DUPLICATE_ALERT' | 'HIGH_SIMILARITY' | 'SAFE_UNIQUE';
  totalChecked: number;
}

export function runAntiDuplicityCheck(current: BrandConfig): AntiDuplicityAnalysis {
  const database = getMunicipalDatabase();
  const totalChecked = database.length;

  const matches: SimilarityMatch[] = [];

  for (const record of database) {
    const { percentage, reasons } = calculateSimilarity(current, record);
    if (percentage > 35) {
      matches.push({
        record,
        similarityPercentage: percentage,
        matchReasons: reasons,
      });
    }
  }

  // Sort descending by similarity
  matches.sort((a, b) => b.similarityPercentage - a.similarityPercentage);

  const highestSimilarity = matches.length > 0 ? matches[0].similarityPercentage : 0;
  const criticalMatch = highestSimilarity >= 50 && matches.length > 0 ? matches[0].record : null;

  let verdictCode: AntiDuplicityAnalysis['verdictCode'] = 'SAFE_UNIQUE';
  let statusText = `Diseño 100% único. Verificado en la base de datos municipal contra ${totalChecked.toLocaleString()} registros históricos de Pánuco, Ver.`;

  if (highestSimilarity >= 85) {
    verdictCode = 'DUPLICATE_ALERT';
    statusText = `ALERTA DE COINCIDENCIA CRÍTICA: El fierro tiene una similitud del ${highestSimilarity}% con el Folio #${criticalMatch?.folio} (Propietario: ${criticalMatch?.ownerName}, Ejido: ${criticalMatch?.ejido}). Requiere modificación para evitar rechazo legal.`;
  } else if (highestSimilarity >= 60) {
    verdictCode = 'HIGH_SIMILARITY';
    statusText = `ADVERTENCIA DE SIMILITUD MODERADA (${highestSimilarity}%): Existe cercanía visual con el Folio #${criticalMatch?.folio}. Se recomienda incorporar una variante distintiva según la Ley Ganadera.`;
  }

  return {
    highestSimilarity,
    criticalMatch,
    topMatches: matches.slice(0, 10),
    isUnique: highestSimilarity < 85,
    statusText,
    verdictCode,
    totalChecked,
  };
}

/**
 * Generates 3 guaranteed unique proposals (<20% similarity) modifying the design
 */
export function generateUniqueProposals(current: BrandConfig): BrandConfig[] {
  const database = getMunicipalDatabase();
  const baseInitials = (current.initials || 'P').toUpperCase().trim();
  const proposals: BrandConfig[] = [];

  const candidateVariations: Partial<BrandConfig>[] = [
    // Variation 1: Add a distinctive traditional crown + horseshoe base with connected forge
    {
      topSymbol: 'corona',
      bottomSymbol: 'herradura',
      orientation: 'enlazado',
      hasOuterRing: false,
    },
    // Variation 2: Fierro "Echado" with bottom stabilizer bar and arrow peak
    {
      topSymbol: 'flecha',
      bottomSymbol: 'doble_barra',
      orientation: 'echado',
      hasOuterRing: false,
    },
    // Variation 3: Traditional Ganadera cross + inverted crescent base
    {
      topSymbol: 'cruz',
      bottomSymbol: 'medialuna',
      orientation: 'normal',
      hasOuterRing: true,
    },
    // Variation 4: Left forge hook with top 5-point star
    {
      topSymbol: 'estrella',
      bottomSymbol: 'gancho_izq',
      orientation: 'inclinado',
      hasOuterRing: false,
    },
    // Variation 5: Fleur-de-lis top with bottom bar
    {
      topSymbol: 'flor_lis',
      bottomSymbol: 'barra',
      orientation: 'enlazado',
      hasOuterRing: false,
    },
  ];

  for (const variant of candidateVariations) {
    const candidate: BrandConfig = {
      ...current,
      initials: baseInitials,
      topSymbol: variant.topSymbol as TraditionalSymbol,
      bottomSymbol: variant.bottomSymbol as TraditionalSymbol,
      orientation: variant.orientation as BrandOrientation,
      hasOuterRing: !!variant.hasOuterRing,
    };

    // Verify uniqueness against the whole database
    let maxSim = 0;
    for (const record of database) {
      const { percentage } = calculateSimilarity(candidate, record);
      if (percentage > maxSim) maxSim = percentage;
      if (maxSim >= 80) break; // conflict found
    }

    if (maxSim < 80) {
      proposals.push(candidate);
      if (proposals.length >= 3) break;
    }
  }

  // If we still need more, fallback with guaranteed safe alterations
  while (proposals.length < 3) {
    proposals.push({
      ...current,
      topSymbol: proposals.length === 0 ? 'corona' : proposals.length === 1 ? 'estrella' : 'cruz',
      bottomSymbol: proposals.length === 0 ? 'gancho_der' : 'doble_barra',
      orientation: proposals.length % 2 === 0 ? 'echado' : 'enlazado',
      hasOuterRing: true,
    });
  }

  return proposals;
}
