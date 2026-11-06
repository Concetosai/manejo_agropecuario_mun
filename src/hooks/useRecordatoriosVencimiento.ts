/**
 * FASE_RECORDATORIOS_HOOK: Detecta productores cuyos certificados
 * vencen en ≤ 30 días hábiles.
 *
 * - Lee TODOS los registros de REGISTROS (Sheets)
 * - Filtra solo los ACTIVO o REVALIDADO (no cancelados)
 * - Calcula días hábiles restantes usando vigencia
 * - Ordena por urgencia (menos días primero)
 * - Se ejecuta al montar el Hub (automático)
 */

import { useState, useEffect, useCallback } from 'react';
import { obtenerRegistrosDelSheet, GoogleRegistro } from '../services/googleSheetsService';
import { calcularDiasHabiles, RECORDATORIOS_CONFIG, fueEnviadoRecientemente } from '../utils/recordatoriosUtils';

export interface ProductorPorVencer {
  registro: GoogleRegistro;
  diasHabilesRestantes: number;
  urgencia: 'CRITICA' | 'ALTA' | 'MEDIA';
}

interface UseRecordatoriosVencimientoReturn {
  productoresPorVencer: ProductorPorVencer[];
  total: number;
  hayAlertas: boolean;
  isLoading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
}

export function useRecordatoriosVencimiento(): UseRecordatoriosVencimientoReturn {
  const [productoresPorVencer, setProductoresPorVencer] = useState<ProductorPorVencer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarYFiltrar = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('%c[Recordatorios] Cargando registros...', 'color: #0ea5e9');

      const result = await obtenerRegistrosDelSheet();
      if (!result.success) {
        setError(result.error || 'Error al cargar el padrón');
        setProductoresPorVencer([]);
        return;
      }

      const registros = result.registros || [];
      console.log(`%c[Recordatorios] ${registros.length} registros cargados`, 'color: #0ea5e9');

      const porVencer: ProductorPorVencer[] = [];

      for (const r of registros) {
        // Filtrar solo ACTIVOS o REVALIDADO (no cancelados)
        const estatus = String(r.estatus || 'ACTIVO').toUpperCase();
        if (estatus === 'CANCELADO' || estatus === 'INACTIVO') continue;

// REGLA: Si ya se envió recordatorio, NO volver a mostrar
        if (fueEnviadoRecientemente(r.folio || '')) {
          console.log(`[Recordatorios] ${r.folio} ya fue notificado, se omite`);
          continue;
        }

        // Solo si tiene fecha de expiración
        if (!r.vigencia) continue;

        // Calcular días hábiles restantes
        const dias = calcularDiasHabiles(r.vigencia);

        // Solo alertar si vence en ≤ 5 días hábiles (y no ha vencido ya)
        if (dias > RECORDATORIOS_CONFIG.DIAS_ALERTA || dias < 0) continue;

        let urgencia: 'CRITICA' | 'ALTA' | 'MEDIA' = 'MEDIA';
        if (dias <= 1) urgencia = 'CRITICA';
        else if (dias <= 3) urgencia = 'ALTA';

        porVencer.push({
          registro: r,
          diasHabilesRestantes: dias,
          urgencia,
        });
      }

      // Ordenar por urgencia (menos días primero)
      porVencer.sort((a, b) => a.diasHabilesRestantes - b.diasHabilesRestantes);

      console.log(
        `%c[Recordatorios] ${porVencer.length} productores por vencer (≤ ${RECORDATORIOS_CONFIG.DIAS_ALERTA} días hábiles)`,
        'color: #f59e0b; font-weight: bold',
        porVencer.map((p) => `${p.registro.folio}: ${p.diasHabilesRestantes}d`)
      );

      setProductoresPorVencer(porVencer);
    } catch (err: any) {
      console.error('[Recordatorios] Error:', err);
      setError(err.message || 'Error desconocido');
      setProductoresPorVencer([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Ejecutar al montar (automático)
  useEffect(() => {
    cargarYFiltrar();
  }, [cargarYFiltrar]);

  return {
    productoresPorVencer,
    total: productoresPorVencer.length,
    hayAlertas: productoresPorVencer.length > 0,
    isLoading,
    error,
    recargar: cargarYFiltrar,
  };
}