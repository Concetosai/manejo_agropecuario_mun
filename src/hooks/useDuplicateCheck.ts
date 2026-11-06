import { useState, useEffect, useRef } from 'react';
import { ProducerData, HistoricalRecord } from '../types';
import { getCachedRegistros } from '../utils/googleSheetsIntegration';

export interface DuplicateResult {
  found: boolean;
  folio?: string;
  matchField?: 'nombre' | 'curp' | 'rfc' | 'ine';
  existingRecord?: HistoricalRecord;
  isChecking: boolean;
}

const EMPTY_RESULT: DuplicateResult = { found: false, isChecking: false };

// FIX_DUPLICADO_RFC: RFC genericos (publico en general) no deben bloquear el alta
const RFC_GENERICOS = new Set(['XAXX010101000', 'XEXX010101000', 'XAXX010101000']);

function isRfcUtil(rfc: string): boolean {
  const r = (rfc || '').trim().toUpperCase();
  return r.length >= 12 && !RFC_GENERICOS.has(r) && !r.startsWith('XAXX') && !r.startsWith('XEXX');
}

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
    const rfc = (producerData.rfc || '').trim().toUpperCase();
    const ine = (producerData.ine || '').trim().toUpperCase();
    const nombre = (producerData.fullName || '').trim();
    const folioActual = (producerData.folio || '').trim().toUpperCase();

    if (!curp && !ine && !nombre && !isRfcUtil(rfc)) { setResult(EMPTY_RESULT); return; }

    const queryKey = curp + '|' + rfc + '|' + ine + '|' + normalizeName(nombre) + '|' + folioActual;
    if (queryKey === lastQueryRef.current) return;
    lastQueryRef.current = queryKey;

    setResult({ found: false, isChecking: true });

    const timer = setTimeout(() => {
      try {
        const registros = getCachedRegistros();
        if (!registros || registros.length === 0) { setResult(EMPTY_RESULT); return; }
        const nombreNorm = normalizeName(nombre);
        for (const r of registros) {
          // FIX_DUPLICADO_EDIT: ignorar el propio registro que se esta editando
          if (folioActual && String(r.folio || '').trim().toUpperCase() === folioActual) continue;
          // FIX_STRING_TRIM: r.curp puede ser numero (Sheets auto-detecta tipos)
          if (curp && r.curp && String(r.curp || '').trim().toUpperCase() === curp) {
            setResult({ found: true, folio: r.folio, matchField: 'curp', existingRecord: r, isChecking: false });
            return;
          }
          // FIX_DUPLICADO_RFC: coincidencia por RFC (ignora genericos)
          if (isRfcUtil(rfc) && r.rfc && String(r.rfc || '').trim().toUpperCase() === rfc) {
            setResult({ found: true, folio: r.folio, matchField: 'rfc', existingRecord: r, isChecking: false });
            return;
          }
          // FIX_STRING_TRIM: r.ine puede ser numero (Sheets auto-detecta tipos)
          if (ine && r.ine && String(r.ine || '').trim().toUpperCase() === ine) {
            setResult({ found: true, folio: r.folio, matchField: 'ine', existingRecord: r, isChecking: false });
            return;
          }
          if (nombreNorm && nombreNorm.split(' ').length >= 2 && r.ownerName) {
            if (r.ownerName && normalizeName(String(r.ownerName)) === nombreNorm) {
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
  }, [producerData.curp, producerData.rfc, producerData.ine, producerData.fullName, producerData.folio, delayMs]);

  return result;
}