import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Firestore,
} from 'firebase/firestore';
import {
  ConceptoFinanciero,
  HistorialPrecio,
  ConfigFinanzas,
  ConceptoEnOrden,
  PaymentOrder,
} from '../types';
import { recordAuditLog } from '../utils/auditAuth';

const CONCEPTS_STORAGE_KEY = 'panuco_finance_concepts_v1';
const HISTORY_STORAGE_KEY = 'panuco_finance_history_v1';
const CONFIG_STORAGE_KEY = 'panuco_finance_config_v1';

// Seed initial municipal catalog for Pánuco, Ver.
export const INITIAL_FINANCE_CONCEPTS: ConceptoFinanciero[] = [
  {
    id: 'ALTA-FQ',
    codigo: 'ALTA-FQ',
    nombre: 'Alta de Fierro Quemador',
    descripcion: 'Registro inicial de fierro marcador de herrar y alta de patente pecuaria',
    categoria: 'tramite',
    precioBase: 450,
    moneda: 'MXN',
    ivaAplicable: true,
    ivaPorcentaje: 16,
    precioConIva: 522,
    vigenciaDesde: '2026-01-01',
    vigenciaHasta: '2026-12-31',
    activo: true,
    ordenVisual: 1,
    color: '#D97706', // amber-600
    icono: 'hammer',
    requiereAutorizacion: false,
    createdAt: '2026-01-01T08:00:00Z',
    createdBy: 'SISTEMA',
    updatedAt: '2026-01-01T08:00:00Z',
    updatedBy: 'SISTEMA',
  },
  {
    id: 'REV-FQ',
    codigo: 'REV-FQ',
    nombre: 'Revalidación de Fierro Quemador',
    descripcion: 'Pago de anualidad o refrendo de vigencia de patente ganadera',
    categoria: 'tramite',
    precioBase: 350,
    moneda: 'MXN',
    ivaAplicable: true,
    ivaPorcentaje: 16,
    precioConIva: 406,
    vigenciaDesde: '2026-01-01',
    vigenciaHasta: '2026-12-31',
    activo: true,
    ordenVisual: 2,
    color: '#2563EB', // blue-600
    icono: 'refresh',
    requiereAutorizacion: false,
    createdAt: '2026-01-01T08:00:00Z',
    createdBy: 'SISTEMA',
    updatedAt: '2026-01-01T08:00:00Z',
    updatedBy: 'SISTEMA',
  },
  {
    id: 'BAJA-FQ',
    codigo: 'BAJA-FQ',
    nombre: 'Baja de Fierro Quemador',
    descripcion: 'Cancelación definitiva o suspensión de patente por defunción o venta de hato',
    categoria: 'tramite',
    precioBase: 200,
    moneda: 'MXN',
    ivaAplicable: false,
    ivaPorcentaje: 0,
    precioConIva: 200,
    vigenciaDesde: '2026-01-01',
    vigenciaHasta: null,
    activo: true,
    ordenVisual: 3,
    color: '#E11D48', // rose-600
    icono: 'cancel',
    requiereAutorizacion: true,
    createdAt: '2026-01-01T08:00:00Z',
    createdBy: 'SISTEMA',
    updatedAt: '2026-01-01T08:00:00Z',
    updatedBy: 'SISTEMA',
  },
  {
    id: 'CONST-PG',
    codigo: 'CONST-PG',
    nombre: 'Constancia de Propiedad Ganadera',
    descripcion: 'Acreditación municipal de fierro y propiedad de semovientes pecuarios',
    categoria: 'constancia',
    precioBase: 180,
    moneda: 'MXN',
    ivaAplicable: false,
    ivaPorcentaje: 0,
    precioConIva: 180,
    vigenciaDesde: '2026-01-01',
    vigenciaHasta: null,
    activo: true,
    ordenVisual: 4,
    color: '#059669', // emerald-600
    icono: 'description',
    requiereAutorizacion: false,
    createdAt: '2026-01-01T08:00:00Z',
    createdBy: 'SISTEMA',
    updatedAt: '2026-01-01T08:00:00Z',
    updatedBy: 'SISTEMA',
  },
  {
    id: 'REP-PAT',
    codigo: 'REP-PAT',
    nombre: 'Reposición por Patente Extraviada',
    descripcion: 'Reposición física y tarjetón de título de fierro por pérdida o deterioro',
    categoria: 'reposicion',
    precioBase: 400,
    moneda: 'MXN',
    ivaAplicable: true,
    ivaPorcentaje: 16,
    precioConIva: 464,
    vigenciaDesde: '2026-01-01',
    vigenciaHasta: null,
    activo: true,
    ordenVisual: 5,
    color: '#7C3AED', // violet-600
    icono: 'receipt',
    requiereAutorizacion: false,
    createdAt: '2026-01-01T08:00:00Z',
    createdBy: 'SISTEMA',
    updatedAt: '2026-01-01T08:00:00Z',
    updatedBy: 'SISTEMA',
  },
  {
    id: 'MULTA-EXT',
    codigo: 'MULTA-EXT',
    nombre: 'Multa por Pago Extemporáneo',
    descripcion: 'Recargo reglamentario por omisión o retraso de refrendo de fierro de fuego',
    categoria: 'multa',
    precioBase: 250,
    moneda: 'MXN',
    ivaAplicable: false,
    ivaPorcentaje: 0,
    precioConIva: 250,
    vigenciaDesde: '2026-01-01',
    vigenciaHasta: null,
    activo: true,
    ordenVisual: 6,
    color: '#DC2626', // red-600
    icono: 'warning',
    requiereAutorizacion: false,
    createdAt: '2026-01-01T08:00:00Z',
    createdBy: 'SISTEMA',
    updatedAt: '2026-01-01T08:00:00Z',
    updatedBy: 'SISTEMA',
  },
  {
    id: 'DEG-SAN',
    codigo: 'DEG-SAN',
    nombre: 'Derecho de Degüello y Control Sanitario',
    descripcion: 'Tasa por sacrificio de ganado bovino/porcino e inspección zoosanitaria en rastro',
    categoria: 'tramite',
    precioBase: 90,
    moneda: 'MXN',
    ivaAplicable: false,
    ivaPorcentaje: 0,
    precioConIva: 90,
    vigenciaDesde: '2026-01-01',
    vigenciaHasta: null,
    activo: true,
    ordenVisual: 7,
    color: '#9333EA', // purple-600
    icono: 'receipt',
    requiereAutorizacion: false,
    createdAt: '2026-01-01T08:00:00Z',
    createdBy: 'SISTEMA',
    updatedAt: '2026-01-01T08:00:00Z',
    updatedBy: 'SISTEMA',
  },
  {
    id: 'OTRO-SERV',
    codigo: 'OTRO-SERV',
    nombre: 'Otros Servicios y Derechos Municipales',
    descripcion: 'Conceptos personalizados o derechos extraordinarios autorizados por Cabildo',
    categoria: 'otro',
    precioBase: 100,
    moneda: 'MXN',
    ivaAplicable: true,
    ivaPorcentaje: 16,
    precioConIva: 116,
    vigenciaDesde: '2026-01-01',
    vigenciaHasta: null,
    activo: true,
    ordenVisual: 8,
    color: '#4B5563', // gray-600
    icono: 'receipt',
    requiereAutorizacion: false,
    createdAt: '2026-01-01T08:00:00Z',
    createdBy: 'SISTEMA',
    updatedAt: '2026-01-01T08:00:00Z',
    updatedBy: 'SISTEMA',
  },
];

export const DEFAULT_FINANCE_CONFIG: ConfigFinanzas = {
  ivaGeneral: 16,
  moneda: 'MXN',
  prefijoOrden: 'ORD-2026-',
  consecutivoOrdenActual: 105,
  rellenoOrden: 5,
  periodoActual: 'OCTUBRE 2026',
  permitirSobrescrituraPrecio: true,
  requiereMotivoSobrescritura: true,
  actualizadoPor: 'SISTEMA',
  actualizadoEn: new Date().toISOString(),
};

// Seed initial price history
const INITIAL_PRICE_HISTORY: HistorialPrecio[] = [
  {
    id: 'hist-1',
    conceptoId: 'ALTA-FQ',
    precioAnterior: 400,
    precioNuevo: 450,
    motivo: 'Actualización anual según Ley de Ingresos 2026 aprobada por Cabildo',
    fechaCambio: '2026-01-01T10:00:00Z',
    userId: 'admin',
    userName: 'C.P. Fernando Aradillas Castillo',
  },
  {
    id: 'hist-2',
    conceptoId: 'REV-FQ',
    precioAnterior: 300,
    precioNuevo: 350,
    motivo: 'Ajuste del Ejercicio Fiscal 2026',
    fechaCambio: '2026-01-01T10:00:00Z',
    userId: 'admin',
    userName: 'C.P. Fernando Aradillas Castillo',
  },
];

// Firebase Firestore helper
let dbInstance: Firestore | null = null;
function getDb(): Firestore | null {
  if (dbInstance) return dbInstance;
  try {
    const firebaseConfig = {
      apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || 'AIzaSyDemoDummyKeyForMunicipalApp12345',
      authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || 'panuco-ganaderia.firebaseapp.com',
      projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || 'panuco-ganaderia',
      storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || 'panuco-ganaderia.appspot.com',
      messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
      appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef123456789',
    };
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    dbInstance = getFirestore(app);
    return dbInstance;
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════
// LOCAL STORAGE CACHE HELPERS
// ═════════════════════════════════════════════════════════════════════

export function getLocalConcepts(): ConceptoFinanciero[] {
  try {
    const raw = localStorage.getItem(CONCEPTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CONCEPTS_STORAGE_KEY, JSON.stringify(INITIAL_FINANCE_CONCEPTS));
      return INITIAL_FINANCE_CONCEPTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_FINANCE_CONCEPTS;
  } catch {
    return INITIAL_FINANCE_CONCEPTS;
  }
}

export function saveLocalConcepts(concepts: ConceptoFinanciero[]): void {
  try {
    localStorage.setItem(CONCEPTS_STORAGE_KEY, JSON.stringify(concepts));
  } catch (err) {
    console.warn('Error saving local concepts:', err);
  }
}

export function getLocalPriceHistory(): HistorialPrecio[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(INITIAL_PRICE_HISTORY));
      return INITIAL_PRICE_HISTORY;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_PRICE_HISTORY;
  } catch {
    return INITIAL_PRICE_HISTORY;
  }
}

export function saveLocalPriceHistory(history: HistorialPrecio[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn('Error saving price history:', err);
  }
}

export function getLocalFinanceConfig(): ConfigFinanzas {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(DEFAULT_FINANCE_CONFIG));
      return DEFAULT_FINANCE_CONFIG;
    }
    return JSON.parse(raw) || DEFAULT_FINANCE_CONFIG;
  } catch {
    return DEFAULT_FINANCE_CONFIG;
  }
}

export function saveLocalFinanceConfig(config: ConfigFinanzas): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Error saving local finance config:', err);
  }
}

// ═════════════════════════════════════════════════════════════════════
// SERVICE METHODS: CRUD FOR FINANCE CONCEPTS
// ═════════════════════════════════════════════════════════════════════

/**
 * Get all concepts with optional filters
 */
export async function getFinanceConcepts(filter?: {
  soloActivos?: boolean;
  categoria?: string;
  querySearch?: string;
}): Promise<ConceptoFinanciero[]> {
  const db = getDb();
  let list = getLocalConcepts();

  if (db && (import.meta as any).env?.VITE_FIREBASE_API_KEY) {
    try {
      const snap = await getDocs(collection(db, 'finance_concepts'));
      if (!snap.empty) {
        list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        saveLocalConcepts(list);
      }
    } catch {
      // Fallback local
    }
  }

  // Apply filters
  let filtered = [...list];

  if (filter?.soloActivos) {
    const now = new Date().toISOString().split('T')[0];
    filtered = filtered.filter((c) => {
      if (!c.activo) return false;
      if (c.vigenciaDesde && c.vigenciaDesde > now) return false;
      if (c.vigenciaHasta && c.vigenciaHasta < now) return false;
      return true;
    });
  }

  if (filter?.categoria && filter.categoria !== 'todas') {
    filtered = filtered.filter((c) => c.categoria === filter.categoria);
  }

  if (filter?.querySearch && filter.querySearch.trim()) {
    const q = filter.querySearch.toLowerCase().trim();
    filtered = filtered.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.codigo.toLowerCase().includes(q) ||
        c.descripcion.toLowerCase().includes(q)
    );
  }

  // Sort by ordenVisual
  filtered.sort((a, b) => (a.ordenVisual || 99) - (b.ordenVisual || 99));

  return filtered;
}

/**
 * Get single concept by ID or code
 */
export async function getFinanceConceptById(idOrCode: string): Promise<ConceptoFinanciero | null> {
  const all = await getFinanceConcepts();
  return all.find((c) => c.id === idOrCode || c.codigo === idOrCode) || null;
}

/**
 * Create a new service concept in the catalog
 */
export async function createFinanceConcept(
  conceptData: Omit<ConceptoFinanciero, 'id' | 'createdAt' | 'updatedAt' | 'precioConIva' | 'createdBy' | 'updatedBy'>,
  userId: string,
  userName = 'Administrador'
): Promise<ConceptoFinanciero> {
  const concepts = getLocalConcepts();
  const id = conceptData.codigo.trim().toUpperCase() || `CON-${Date.now()}`;
  const now = new Date().toISOString();

  const ivaMonto = conceptData.ivaAplicable
    ? conceptData.precioBase * (conceptData.ivaPorcentaje / 100)
    : 0;
  const precioConIva = Number((conceptData.precioBase + ivaMonto).toFixed(2));

  const newConcept: ConceptoFinanciero = {
    ...conceptData,
    id,
    codigo: conceptData.codigo.trim().toUpperCase(),
    nombre: conceptData.nombre.trim(),
    precioBase: Number(conceptData.precioBase),
    precioConIva,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const updatedList = [...concepts.filter((c) => c.id !== id), newConcept];
  saveLocalConcepts(updatedList);

  // Sync to Firestore
  const db = getDb();
  if (db && (import.meta as any).env?.VITE_FIREBASE_API_KEY) {
    try {
      await setDoc(doc(db, 'finance_concepts', id), newConcept);
    } catch (err) {
      console.warn('Firestore setDoc note:', err);
    }
  }

  // Audit
  recordAuditLog({
    actionType: 'REGISTRO_CREADO',
    details: `Nuevo concepto financiero creado: [${newConcept.codigo}] ${newConcept.nombre} ($${newConcept.precioBase} ${newConcept.moneda}).`,
    userName,
    userRole: 'Administrador',
    badgeNumber: 'TESORERIA',
  });

  return newConcept;
}

/**
 * Update an existing service concept. If precioBase changes, records an entry in price history!
 */
export async function updateFinanceConcept(
  conceptoId: string,
  updates: Partial<ConceptoFinanciero>,
  userId: string,
  userName = 'Administrador',
  motivoCambio = 'Actualización ordinaria'
): Promise<ConceptoFinanciero> {
  const concepts = getLocalConcepts();
  const existing = concepts.find((c) => c.id === conceptoId);
  if (!existing) {
    throw new Error(`Concepto no encontrado: ${conceptoId}`);
  }

  const now = new Date().toISOString();
  const oldPrice = existing.precioBase;
  const newPrice = updates.precioBase !== undefined ? Number(updates.precioBase) : existing.precioBase;
  const ivaApp = updates.ivaAplicable !== undefined ? updates.ivaAplicable : existing.ivaAplicable;
  const ivaPct = updates.ivaPorcentaje !== undefined ? updates.ivaPorcentaje : existing.ivaPorcentaje;

  const ivaMonto = ivaApp ? newPrice * (ivaPct / 100) : 0;
  const precioConIva = Number((newPrice + ivaMonto).toFixed(2));

  const merged: ConceptoFinanciero = {
    ...existing,
    ...updates,
    id: conceptoId,
    precioBase: newPrice,
    ivaAplicable: ivaApp,
    ivaPorcentaje: ivaPct,
    precioConIva,
    updatedAt: now,
    updatedBy: userId,
  };

  const updatedList = concepts.map((c) => (c.id === conceptoId ? merged : c));
  saveLocalConcepts(updatedList);

  // If price changed, record in history!
  if (oldPrice !== newPrice) {
    const historyEntry: HistorialPrecio = {
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      conceptoId,
      precioAnterior: oldPrice,
      precioNuevo: newPrice,
      motivo: motivoCambio,
      fechaCambio: now,
      userId,
      userName,
    };
    const currentHist = getLocalPriceHistory();
    saveLocalPriceHistory([historyEntry, ...currentHist]);

    recordAuditLog({
      actionType: 'REGISTRO_MODIFICADO',
      details: `Precio de concepto [${existing.codigo}] actualizado: $${oldPrice} -> $${newPrice} MXN. Motivo: ${motivoCambio}.`,
      userName,
      userRole: 'Administrador',
      badgeNumber: 'TESORERIA',
    });
  }

  // Sync to Firestore
  const db = getDb();
  if (db && (import.meta as any).env?.VITE_FIREBASE_API_KEY) {
    try {
      await setDoc(doc(db, 'finance_concepts', conceptoId), merged);
    } catch {
      // Fallback local
    }
  }

  return merged;
}

/**
 * Toggle active status (soft disable)
 */
export async function toggleFinanceConceptActive(
  conceptoId: string,
  activo: boolean,
  userId: string,
  userName = 'Administrador',
  motivo = 'Cambio de estatus operativo'
): Promise<void> {
  const concepts = getLocalConcepts();
  const existing = concepts.find((c) => c.id === conceptoId);
  if (!existing) return;

  await updateFinanceConcept(
    conceptoId,
    { activo },
    userId,
    userName,
    `${motivo} (Estatus: ${activo ? 'ACTIVADO' : 'DESACTIVADO'})`
  );
}

/**
 * Soft delete concept
 */
export async function softDeleteFinanceConcept(
  conceptoId: string,
  userId: string,
  userName = 'Administrador',
  motivo = 'Concepto marcado como inactivo / retirado'
): Promise<void> {
  await toggleFinanceConceptActive(conceptoId, false, userId, userName, motivo);
}

/**
 * Get price history for a given concept
 */
export function getConceptPriceHistory(conceptoId: string): HistorialPrecio[] {
  const all = getLocalPriceHistory();
  return all
    .filter((h) => h.conceptoId === conceptoId)
    .sort((a, b) => (b.fechaCambio > a.fechaCambio ? 1 : -1));
}

// ═════════════════════════════════════════════════════════════════════
// GENERAL FINANCE CONFIG
// ═════════════════════════════════════════════════════════════════════

export function getFinanceGeneralConfig(): ConfigFinanzas {
  return getLocalFinanceConfig();
}

export function saveFinanceGeneralConfig(
  updates: Partial<ConfigFinanzas>,
  userId: string
): ConfigFinanzas {
  const current = getLocalFinanceConfig();
  const merged: ConfigFinanzas = {
    ...current,
    ...updates,
    actualizadoPor: userId,
    actualizadoEn: new Date().toISOString(),
  };
  saveLocalFinanceConfig(merged);

  const db = getDb();
  if (db && (import.meta as any).env?.VITE_FIREBASE_API_KEY) {
    try {
      setDoc(doc(db, 'config', 'finanzas'), merged).catch(() => {});
    } catch {}
  }
  return merged;
}

// ═════════════════════════════════════════════════════════════════════
// SNAPSHOT & CALCULATION HELPERS FOR ORDERS
// ═════════════════════════════════════════════════════════════════════

/**
 * Builds a ConceptoEnOrden item from a ConceptoFinanciero with quantity and optional overwrite
 */
export function buildConceptoEnOrden(
  concept: ConceptoFinanciero,
  cantidad = 1,
  precioSobrescrito?: number,
  motivoSobrescritura?: string
): ConceptoEnOrden {
  const finalUnitPrice = precioSobrescrito !== undefined ? Number(precioSobrescrito) : concept.precioBase;
  const subtotal = Number((finalUnitPrice * cantidad).toFixed(2));
  const ivaMonto = concept.ivaAplicable
    ? Number((subtotal * (concept.ivaPorcentaje / 100)).toFixed(2))
    : 0;
  const total = Number((subtotal + ivaMonto).toFixed(2));

  return {
    conceptoId: concept.id,
    codigo: concept.codigo,
    nombre: concept.nombre,
    precioUnitario: finalUnitPrice,
    cantidad,
    subtotal,
    ivaAplicable: concept.ivaAplicable,
    ivaPorcentaje: concept.ivaPorcentaje,
    ivaMonto,
    total,
    precioSobrescrito: precioSobrescrito !== undefined && precioSobrescrito !== concept.precioBase,
    motivoSobrescritura: motivoSobrescritura || null,
  };
}

/**
 * Calculates financial totals (subtotal, IVA, total) from an array of ConceptoEnOrden
 */
export function calculateOrderTotals(items: ConceptoEnOrden[]): {
  subtotal: number;
  iva: number;
  total: number;
} {
  let subtotal = 0;
  let iva = 0;
  let total = 0;

  for (const item of items) {
    subtotal += item.subtotal;
    iva += item.ivaMonto;
    total += item.total;
  }

  return {
    subtotal: Number(subtotal.toFixed(2)),
    iva: Number(iva.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

// ═════════════════════════════════════════════════════════════════════
// FINANCIAL REPORTS HELPERS
// ═════════════════════════════════════════════════════════════════════

export interface ConceptIncomeStat {
  conceptoNombre: string;
  codigo: string;
  totalRecaudado: number;
  cantidadOrdenes: number;
  porcentaje: number;
}

export function computeIncomeByConcept(orders: PaymentOrder[]): ConceptIncomeStat[] {
  const map = new Map<string, { codigo: string; nombre: string; total: number; count: number }>();
  let grandTotal = 0;

  const validOrders = orders.filter((o) => o.status === 'PAID');

  for (const o of validOrders) {
    if (o.itemsConceptos && o.itemsConceptos.length > 0) {
      for (const item of o.itemsConceptos) {
        const key = item.nombre;
        const current = map.get(key) || { codigo: item.codigo, nombre: item.nombre, total: 0, count: 0 };
        current.total += item.total;
        current.count += item.cantidad;
        map.set(key, current);
        grandTotal += item.total;
      }
    } else if (o.concepts && o.concepts.length > 0) {
      // Fallback for legacy orders
      for (const cStr of o.concepts) {
        const key = cStr;
        const current = map.get(key) || { codigo: 'SRV', nombre: key, total: 0, count: 0 };
        const portion = o.amount / o.concepts.length;
        current.total += portion;
        current.count += 1;
        map.set(key, current);
        grandTotal += portion;
      }
    }
  }

  const result: ConceptIncomeStat[] = [];
  map.forEach((val) => {
    result.push({
      conceptoNombre: val.nombre,
      codigo: val.codigo,
      totalRecaudado: Number(val.total.toFixed(2)),
      cantidadOrdenes: val.count,
      porcentaje: grandTotal > 0 ? Number(((val.total / grandTotal) * 100).toFixed(1)) : 0,
    });
  });

  return result.sort((a, b) => b.totalRecaudado - a.totalRecaudado);
}

export interface PeriodIncomeStat {
  periodo: string;
  totalRecaudado: number;
  totalOrdenes: number;
}

export function computeIncomeByPeriod(orders: PaymentOrder[]): PeriodIncomeStat[] {
  const map = new Map<string, { total: number; count: number }>();

  const validOrders = orders.filter((o) => o.status === 'PAID');
  for (const o of validOrders) {
    const p = o.period || 'General';
    const current = map.get(p) || { total: 0, count: 0 };
    current.total += o.amount || 0;
    current.count += 1;
    map.set(p, current);
  }

  const list: PeriodIncomeStat[] = [];
  map.forEach((val, key) => {
    list.push({
      periodo: key,
      totalRecaudado: Number(val.total.toFixed(2)),
      totalOrdenes: val.count,
    });
  });

  return list;
}
