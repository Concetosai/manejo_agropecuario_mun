import { ProducerData } from '../types';
import { validateFullProducerData } from './formValidation';

export interface RegistrationDraftVersion {
  id: string;
  timestamp: number;
  formattedDate: string;
  formattedTime: string;
  label: string;
  source: 'auto' | 'manual' | 'step_change';
  producerData: ProducerData;
  completionPercentage: number;
  totalFieldsCount: number;
  validFieldsCount: number;
  stepId: number;
  summary: {
    producerName: string;
    propertyName: string;
    ejido: string;
    uppKey: string;
    folio: string;
  };
}

const STORAGE_KEY_CURRENT_DRAFT = 'panuco_livestock_current_draft_v1';
const STORAGE_KEY_VERSION_HISTORY = 'panuco_livestock_draft_versions_v1';

// FIX_QUOTA: reducido de 20 -> 10 para no llenar localStorage
const MAX_VERSIONS = 10;

// FIX_QUOTA: limite de tamano de producerData serializado (50KB)
const MAX_PRODUCER_DATA_BYTES = 50 * 1024;

// FIX_QUIET_LOGS: Solo loggear ciertos warnings UNA VEZ por sesión
const loggedWarnings = new Set<string>();
function logOnce(key: string, ...args: any[]) {
  if (loggedWarnings.has(key)) return;
  loggedWarnings.add(key);
  console.warn(...args);
}

// =========================================================================
// FIX_QUOTA: Wrapper seguro para localStorage.setItem con auto-limpieza
// =========================================================================

/**
 * Intenta guardar en localStorage. Si falla por quota:
 * 1) Purga las versiones mas viejas
 * 2) Reintenta
 * 3) Si sigue fallando, cae a sessionStorage
 * 4) Si tambien falla, retorna false silenciosamente (no rompe la app)
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuota = err?.name === 'QuotaExceededError' ||
                    err?.code === 22 ||
                    err?.code === 1014 ||
                    /quota/i.test(String(err?.message || ''));

    if (!isQuota) {
      console.warn('[draftHistory] setItem fallo (no quota):', err);
      return false;
    }

    console.warn('[draftHistory] QuotaExceededError detectado. Iniciando limpieza...');

    // Intentar purgar versiones viejas
    try {
      const raw = localStorage.getItem(STORAGE_KEY_VERSION_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Dejar solo la mitad mas reciente
          const reducido = parsed.slice(0, Math.max(1, Math.floor(parsed.length / 2)));
          localStorage.setItem(STORAGE_KEY_VERSION_HISTORY, JSON.stringify(reducido));
          console.warn(`[draftHistory] Purga: ${parsed.length} -> ${reducido.length} versiones`);
        }
      }

      // Reintentar
      localStorage.setItem(key, value);
      console.log('[draftHistory] Guardado exitoso tras purga');
      return true;
    } catch (retryErr) {
      console.warn('[draftHistory] Reintento fallo. Fallback a sessionStorage...');

      // Fallback a sessionStorage
      try {
        sessionStorage.setItem(key, value);
        console.log('[draftHistory] Guardado en sessionStorage (temporal)');
        return true;
      } catch (sessionErr) {
        console.error('[draftHistory] sessionStorage tambien fallo. Draft perdido:', sessionErr);
        return false;
      }
    }
  }
}

/**
 * Lee un item de localStorage o sessionStorage (fallback)
 */
function safeGetItem(key: string): string | null {
  try {
    const fromLocal = localStorage.getItem(key);
    if (fromLocal !== null) return fromLocal;
  } catch (err) {
    console.warn('[draftHistory] getItem local fallo:', err);
  }
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Elimina de ambos storages
 */
function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch {}
  try { sessionStorage.removeItem(key); } catch {}
}

/**
 * FIX_QUOTA: mide el tamano en bytes de un objeto serializado
 */
function jsonSize(obj: any): number {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return 0;
  }
}

/**
 * FIX_QUOTA: si producerData es muy pesado, lo trunca
 * (ej. elimina campos base64 de imagenes si existieran)
 */
function sanitizeProducerData(data: ProducerData): ProducerData {
  const size = jsonSize(data);
  if (size <= MAX_PRODUCER_DATA_BYTES) return data;

  logOnce('size-warning', `[draftHistory] producerData pesa ${Math.round(size / 1024)}KB. Truncando campos pesados... (este aviso solo aparece una vez)`);

  const sanitized: any = { ...data };
  // Remover cualquier campo que parezca base64
  for (const key of Object.keys(sanitized)) {
    const val = sanitized[key];
    if (typeof val === 'string' && val.length > 10000 && /^data:/.test(val)) {
      sanitized[key] = '[imagen-omitida-por-tamano]';
      logOnce(`field-${key}`, `[draftHistory] Campo "${key}" truncado (base64 detectado) - solo aparece una vez`);
    }
  }
  return sanitized as ProducerData;
}

// =========================================================================
// FIN FIX_QUOTA
// =========================================================================

/**
 * Calculates form completion percentage (0 - 100)
 */
export function calculateCompletion(data: ProducerData): { percentage: number; valid: number; total: number } {
  const validation = validateFullProducerData(data);
  const total = 18;
  const invalid = validation.errors.length;
  const valid = Math.max(0, total - invalid);
  const percentage = Math.round((valid / total) * 100);
  return { percentage, valid, total };
}

/**
 * Checks if a ProducerData object contains any substantial entered data
 */
export function hasSubstantialData(data: ProducerData | null | undefined): boolean {
  if (!data) return false;
  return Boolean(
    data.fullName?.trim() ||
    data.curp?.trim() ||
    data.rfc?.trim() ||
    data.propertyName?.trim() ||
    data.uppKey?.trim() ||
    data.folio?.trim() ||
    (data.cattleCount && data.cattleCount > 0)
  );
}

/**
 * Gets all saved versions from localStorage
 */
export function getSavedDraftVersions(): RegistrationDraftVersion[] {
  try {
    const raw = safeGetItem(STORAGE_KEY_VERSION_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.timestamp - a.timestamp);
    }
  } catch (err) {
    console.warn('Error reading draft versions from localStorage:', err);
  }
  return [];
}

/**
 * Saves a new version snapshot to version history
 */
export function saveDraftVersion(
  data: ProducerData,
  source: 'auto' | 'manual' | 'step_change' = 'auto',
  customLabel?: string,
  stepId: number = 1
): RegistrationDraftVersion | null {
  if (!hasSubstantialData(data)) {
    return null;
  }

  try {
    const versions = getSavedDraftVersions();
    const now = new Date();
    const { percentage, valid, total } = calculateCompletion(data);

    // FIX_QUOTA: sanitizar antes de guardar
    const safeData = sanitizeProducerData(data);

    let defaultLabel = 'Guardado Automático';
    if (source === 'manual') {
      defaultLabel = customLabel || 'Punto de Restauración Manual';
    } else if (source === 'step_change') {
      defaultLabel = `Avance a Hoja ${stepId}`;
    }

    const newVersion: RegistrationDraftVersion = {
      id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      formattedDate: now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      formattedTime: now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      label: customLabel || defaultLabel,
      source,
      producerData: { ...safeData },
      completionPercentage: percentage,
      validFieldsCount: valid,
      totalFieldsCount: total,
      stepId,
      summary: {
        producerName: safeData.fullName || 'Sin nombre capturado',
        propertyName: safeData.propertyName || 'Sin predio especificado',
        ejido: safeData.ejido || safeData.municipio || 'Pánuco',
        uppKey: safeData.uppKey || 'Pendiente',
        folio: safeData.folio || 'Sin folio',
      },
    };

    // Prevent duplicate entries if nothing changed compared to last version
    if (versions.length > 0) {
      const latest = versions[0];
      const isIdentical =
        latest.producerData.fullName === safeData.fullName &&
        latest.producerData.curp === safeData.curp &&
        latest.producerData.propertyName === safeData.propertyName &&
        latest.producerData.uppKey === safeData.uppKey &&
        latest.producerData.folio === safeData.folio &&
        latest.producerData.cattleCount === safeData.cattleCount;

      if (isIdentical && Date.now() - latest.timestamp < 60000 && source === 'auto') {
        versions[0] = { ...latest, timestamp: Date.now(), formattedTime: newVersion.formattedTime };
        // FIX_QUOTA: usar safeSetItem
        safeSetItem(STORAGE_KEY_VERSION_HISTORY, JSON.stringify(versions));
        return versions[0];
      }
    }

    const updated = [newVersion, ...versions].slice(0, MAX_VERSIONS);
    // FIX_QUOTA: usar safeSetItem
    safeSetItem(STORAGE_KEY_VERSION_HISTORY, JSON.stringify(updated));

    // Also update current active draft pointer
    saveCurrentSessionDraft(safeData, stepId);

    return newVersion;
  } catch (err) {
    console.error('Error saving draft version:', err);
    return null;
  }
}

/**
 * Saves current active session draft for instant session recovery
 */
export function saveCurrentSessionDraft(data: ProducerData, currentStep: number = 1): void {
  if (!hasSubstantialData(data)) {
    return;
  }
  try {
    const safeData = sanitizeProducerData(data);
    const payload = {
      timestamp: Date.now(),
      producerData: safeData,
      currentStep,
    };
    // FIX_QUOTA: usar safeSetItem
    safeSetItem(STORAGE_KEY_CURRENT_DRAFT, JSON.stringify(payload));
  } catch (err) {
    console.warn('Error saving current session draft:', err);
  }
}

/**
 * Gets the last interrupted session draft if available
 */
export function getInterruptedSessionDraft(): {
  timestamp: number;
  producerData: ProducerData;
  currentStep: number;
  formattedTime: string;
} | null {
  try {
    const raw = safeGetItem(STORAGE_KEY_CURRENT_DRAFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.producerData && hasSubstantialData(parsed.producerData)) {
      const now = new Date(parsed.timestamp);
      return {
        timestamp: parsed.timestamp,
        producerData: parsed.producerData,
        currentStep: parsed.currentStep || 1,
        formattedTime: now.toLocaleString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Clears the interrupted session pointer
 */
export function clearCurrentSessionDraft(): void {
  try {
    safeRemoveItem(STORAGE_KEY_CURRENT_DRAFT);
  } catch (err) {
    console.warn('Error clearing current session draft:', err);
  }
}

/**
 * Deletes a specific version by ID
 */
export function deleteDraftVersion(id: string): RegistrationDraftVersion[] {
  try {
    const versions = getSavedDraftVersions();
    const filtered = versions.filter((v) => v.id !== id);
    safeSetItem(STORAGE_KEY_VERSION_HISTORY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.warn('Error deleting draft version:', err);
    return [];
  }
}

/**
 * Clears all version history
 */
export function clearAllDraftVersions(): void {
  try {
    safeRemoveItem(STORAGE_KEY_VERSION_HISTORY);
    safeRemoveItem(STORAGE_KEY_CURRENT_DRAFT);
  } catch (err) {
    console.warn('Error clearing draft versions:', err);
  }
}

/**
 * FIX_QUOTA: funcion de diagnostico - muestra el tamano actual del storage
 */
export function getDraftStorageStats(): {
  currentDraftBytes: number;
  versionHistoryBytes: number;
  versionsCount: number;
  estimatedTotalKB: number;
} {
  let currentDraftBytes = 0;
  let versionHistoryBytes = 0;
  let versionsCount = 0;

  try {
    const rawCurrent = localStorage.getItem(STORAGE_KEY_CURRENT_DRAFT);
    if (rawCurrent) currentDraftBytes = jsonSize(rawCurrent);

    const rawHistory = localStorage.getItem(STORAGE_KEY_VERSION_HISTORY);
    if (rawHistory) {
      versionHistoryBytes = jsonSize(rawHistory);
      const parsed = JSON.parse(rawHistory);
      if (Array.isArray(parsed)) versionsCount = parsed.length;
    }
  } catch {}

  return {
    currentDraftBytes,
    versionHistoryBytes,
    versionsCount,
    estimatedTotalKB: Math.round((currentDraftBytes + versionHistoryBytes) / 1024),
  };
}