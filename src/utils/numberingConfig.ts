/**
 * Official Pánuco Municipal Folio & Registration Series Numbering Configuration
 * Enables operators to customize prefixes, formats, starting numbers, and padding
 * to adapt to municipal administration needs, fiscal years, or specific registry books.
 */

export interface SeriesNumberingConfig {
  folioPrefix: string;          // e.g. "PAN-2026-" or "PAN-"
  folioStartNumber: number;      // e.g. 4290 or 1
  folioPaddingLength: number;    // e.g. 5 -> "04290", 4 -> "4290"
  registrationPrefix: string;    // e.g. "REG-HAYTO-" or "REG-PAN-"
  registrationStartNumber: number; // e.g. 4290 or 1
  registrationPaddingLength: number; // e.g. 4 -> "4290"
  autoIncrementEnabled: boolean;
}

const STORAGE_KEY = 'panuco_series_numbering_config';

export const DEFAULT_SERIES_CONFIG: SeriesNumberingConfig = {
  folioPrefix: 'PAN-2026-',
  folioStartNumber: 4290,
  folioPaddingLength: 5,
  registrationPrefix: 'REG-HAYTO-',
  registrationStartNumber: 4290,
  registrationPaddingLength: 4,
  autoIncrementEnabled: true,
};

export function getStoredSeriesConfig(): SeriesNumberingConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SERIES_CONFIG,
        ...parsed,
        folioStartNumber: Number(parsed.folioStartNumber) || DEFAULT_SERIES_CONFIG.folioStartNumber,
        registrationStartNumber: Number(parsed.registrationStartNumber) || DEFAULT_SERIES_CONFIG.registrationStartNumber,
        folioPaddingLength: Number(parsed.folioPaddingLength) || DEFAULT_SERIES_CONFIG.folioPaddingLength,
        registrationPaddingLength: Number(parsed.registrationPaddingLength) || DEFAULT_SERIES_CONFIG.registrationPaddingLength,
      };
    }
  } catch (e) {
    console.error('Error reading series numbering config:', e);
  }
  return DEFAULT_SERIES_CONFIG;
}

export function saveStoredSeriesConfig(config: SeriesNumberingConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving series numbering config:', e);
  }
}

/**
 * Builds the Folio string from the prefix and starting number with padding.
 * Example: ("PAN-2026-", 4290, 5) -> "PAN-2026-04290"
 */
export function formatFolioString(prefix: string, num: number, padding: number): string {
  const cleanPrefix = (prefix || '').toUpperCase();
  const safeNum = Math.max(0, Math.floor(num));
  const paddedNum = padding > 0 ? String(safeNum).padStart(padding, '0') : String(safeNum);
  return `${cleanPrefix}${paddedNum}`.toUpperCase();
}

/**
 * Builds the Registration Number string from prefix and starting number with padding.
 * Example: ("REG-HAYTO-", 4290, 4) -> "REG-HAYTO-4290"
 */
export function formatRegistrationString(prefix: string, num: number, padding: number): string {
  const cleanPrefix = (prefix || '').toUpperCase();
  const safeNum = Math.max(0, Math.floor(num));
  const paddedNum = padding > 0 ? String(safeNum).padStart(padding, '0') : String(safeNum);
  return `${cleanPrefix}${paddedNum}`.toUpperCase();
}

/**
 * Increments the stored series config by 1 for the next registration.
 */
export function incrementSeriesNumbers(): SeriesNumberingConfig {
  const current = getStoredSeriesConfig();
  const nextConfig: SeriesNumberingConfig = {
    ...current,
    folioStartNumber: current.folioStartNumber + 1,
    registrationStartNumber: current.registrationStartNumber + 1,
  };
  saveStoredSeriesConfig(nextConfig);
  return nextConfig;
}
