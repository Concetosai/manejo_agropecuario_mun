/**
 * Preferencias del usuario persistidas en localStorage.
 * 
 * Actualmente incluye:
 * - ReciboFotoEnabled: activa/desactiva la opción de tomar foto del recibo sellado
 *   al confirmar un pago en Tesorería.
 */

const KEY_RECIBO_FOTO_ENABLED = 'panuco_recibo_foto_enabled_v1';

/**
 * ¿Está activada la opción de tomar foto del recibo sellado?
 * Default: true (activado por defecto).
 */
export function getReciboFotoEnabled(): boolean {
  try {
    const raw = localStorage.getItem(KEY_RECIBO_FOTO_ENABLED);
    if (raw === null) return true; // default: activado
    return raw === 'true';
  } catch {
    return true;
  }
}

/**
 * Activa/desactiva la opción de tomar foto del recibo sellado.
 */
export function setReciboFotoEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY_RECIBO_FOTO_ENABLED, String(enabled));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('panuco_preferences_changed', {
        detail: { key: 'recibo_foto_enabled', value: enabled },
      }));
    }
  } catch (err) {
    console.warn('[preferences] No se pudo guardar recibo_foto_enabled:', err);
  }
}

/**
 * Limpia todas las preferencias (útil para reset o debugging).
 */
export function clearAllPreferences(): void {
  try {
    localStorage.removeItem(KEY_RECIBO_FOTO_ENABLED);
  } catch (err) {
    console.warn('[preferences] Error limpiando preferencias:', err);
  }
}