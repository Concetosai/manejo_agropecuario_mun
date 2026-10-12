import { useState, useEffect, useRef } from 'react';
import { ProducerData, HistoricalRecord } from '../types';
import { getCachedRegistros } from '../utils/googleSheetsIntegration';

export interface DuplicateResult {
  found: boolean;
  folio?: string;
  matchField?: 'nombre' | 'curp' | 'ine';
  existingRecord?: HistoricalRecord;
  isChecking: boolean;
}

const EMPTY_RESULT: DuplicateResult = { found: false, isChecking: false };

function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useDuplicateCheck(producerData: ProducerData, delayMs: number = 700): DuplicateResult {
  const [result, setResult] = useState<DuplicateResult>(EMPTY_RESULT);
  const lastQueryRef = useRef<string>('');

  useEffect(() => {
    const curp = (producerData.curp || '').trim().toUpperCase();
    const ine = (producerData.ine || '').trim().toUpperCase();
    const nombre = (producerData.fullName || '').trim();

    if (!curp && !ine && !nombre) { setResult(EMPTY_RESULT); return; }

    const queryKey = curp + '|' + ine + '|' + normalizeName(nombre);
    if (queryKey === lastQueryRef.current) return;
    lastQueryRef.current = queryKey;

    setResult({ found: false, isChecking: true });

    const timer = setTimeout(() => {
      try {
        const registros = getCachedRegistros();
        if (!registros || registros.length === 0) { setResult(EMPTY_RESULT); return; }
        const nombreNorm = normalizeName(nombre);
        for (const r of registros) {
          if (curp && r.curp && r.curp.trim().toUpperCase() === curp) {
            setResult({ found: true, folio: r.folio, matchField: 'curp', existingRecord: r, isChecking: false });
            return;
          }
          if (ine && r.ine && r.ine.trim().toUpperCase() === ine) {
            setResult({ found: true, folio: r.folio, matchField: 'ine', existingRecord: r, isChecking: false });
            return;
          }
          if (nombreNorm && nombreNorm.split(' ').length >= 2 && r.ownerName) {
            if (normalizeName(r.ownerName) === nombreNorm) {
              setResult({ found: true, folio: r.folio, matchField: 'nombre', existingRecord: r, isChecking: false });
              return;
            }
          }
        }
        setResult(EMPTY_RESULT);
      } catch (err) {
        console.warn('[useDuplicateCheck] Error:', err);
        setResult(EMPTY_RESULT);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [producerData.curp, producerData.ine, producerData.fullName, delayMs]);

  return result;
}