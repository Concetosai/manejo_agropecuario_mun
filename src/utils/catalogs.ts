import { PANUCO_EJIDOS } from './database';

export const DEFAULT_MUNICIPIOS = [
  'Pánuco',
  'Tempoal',
  'El Higo',
  'Pueblo Viejo',
  'Tampico Alto',
  'Platón Sánchez',
  'Ozuluama de Mascareñas',
  'Tantoyuca',
  'Chinampa de Gorostiza',
  'Tamiahua',
  'Naranjos Amatlán',
  'Chicontepec',
  'Tuxpan',
  'Ébano',
  'San Vicente Tancuayalab',
];

const STORAGE_KEY_EJIDOS = 'panuco_custom_localities_v1';
const STORAGE_KEY_MUNICIPIOS = 'panuco_custom_municipios_v1';

/**
 * Retrieve all registered Ejidos, Congregaciones, Rancherías and Extensiones.
 * Combines standard catalog with persistent custom entries created by the user.
 */
export function getStoredEjidos(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EJIDOS);
    if (!raw) return [...PANUCO_EJIDOS];
    const customList = JSON.parse(raw);
    if (Array.isArray(customList)) {
      const combined = Array.from(new Set([...PANUCO_EJIDOS, ...customList]));
      return combined.sort((a, b) => a.localeCompare(b, 'es'));
    }
  } catch (err) {
    console.error('Error loading custom localities/ejidos:', err);
  }
  return [...PANUCO_EJIDOS];
}

/**
 * Add a new Ejido, Congregación, Ranchería or Extensión to the municipal catalog.
 */
export function addCustomEjido(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return getStoredEjidos();

  try {
    const current = getStoredEjidos();
    if (!current.includes(trimmed)) {
      const customOnly = current.filter((item) => !PANUCO_EJIDOS.includes(item));
      customOnly.push(trimmed);
      localStorage.setItem(STORAGE_KEY_EJIDOS, JSON.stringify(customOnly));
    }
  } catch (err) {
    console.error('Error saving custom locality:', err);
  }
  return getStoredEjidos();
}

/**
 * Retrieve all registered Municipios and Territorial Extensions.
 */
export function getStoredMunicipios(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MUNICIPIOS);
    if (!raw) return [...DEFAULT_MUNICIPIOS];
    const customList = JSON.parse(raw);
    if (Array.isArray(customList)) {
      const combined = Array.from(new Set([...DEFAULT_MUNICIPIOS, ...customList]));
      return combined.sort((a, b) => a.localeCompare(b, 'es'));
    }
  } catch (err) {
    console.error('Error loading custom municipios:', err);
  }
  return [...DEFAULT_MUNICIPIOS];
}

/**
 * Add a new Municipio or Territorial Extension to the catalog.
 */
export function addCustomMunicipio(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return getStoredMunicipios();

  try {
    const current = getStoredMunicipios();
    if (!current.includes(trimmed)) {
      const customOnly = current.filter((item) => !DEFAULT_MUNICIPIOS.includes(item));
      customOnly.push(trimmed);
      localStorage.setItem(STORAGE_KEY_MUNICIPIOS, JSON.stringify(customOnly));
    }
  } catch (err) {
    console.error('Error saving custom municipio:', err);
  }
  return getStoredMunicipios();
}
