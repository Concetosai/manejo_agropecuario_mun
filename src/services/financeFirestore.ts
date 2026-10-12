import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import { PaymentOrder } from '../types';

const STORAGE_KEY = 'panuco_payment_orders_v1';

// =========================================================================
// FIX_PAGOS_SHEETS: Integracion con Google Sheets
// =========================================================================
const GOOGLE_API_URL = (import.meta as any).env?.VITE_GOOGLE_API_URL || '';
const GOOGLE_TOKEN = (import.meta as any).env?.VITE_GOOGLE_TOKEN || '';

interface SheetPagoResponse {
  success: boolean;
  pagos?: any[];
  total?: number;
  error?: string;
  folio?: string;
  action?: string;
}

/**
 * Envia una orden de pago al Sheet (backend Apps Script)
 */
async function subirPagoASheets(order: PaymentOrder): Promise<{ success: boolean; queued?: boolean; error?: string }> {
  if (!GOOGLE_API_URL || !GOOGLE_TOKEN) {
    console.warn('[Pagos] Google API no configurada');
    return { success: false, error: 'Google API no configurada' };
  }

  try {
    const payload = {
      data: {
        id_pago: order.id || '',
        folio: order.folio,
        folio_fierro: order.folioFierro || '',
        ejercicio: order.exercise,
        periodo: order.period,
        taxpayer_name: order.taxpayerName,
        rfc: order.rfc || '',
        curp: order.curp || '',
        address: order.address,
        concepts: order.concepts,
        amount: order.amount,
        date: order.date,
        status: order.status,
        cashier_name: order.cashierName || '',
        notes: order.notes || '',
        referencia_pago: order.referenciaPago || '',
        metodo_pago: order.metodoPago || '',
        created_at: order.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      token: GOOGLE_TOKEN,
    };

    const response = await fetch(GOOGLE_API_URL + '?action=guardarPago', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.success) {
      console.log('%c[Pagos] Sincronizado con Sheets:', 'color: #22c55e', order.folio, data.action);
      return { success: true };
    } else {
      console.warn('[Pagos] Error Sheets:', data.error);
      return { success: false, error: data.error };
    }
  } catch (err: any) {
    console.warn('[Pagos] Excepcion al subir a Sheets:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Descarga todos los pagos del Sheet
 */

// FIX_PARSE_CONCEPTS: parser robusto para concepts que puede venir como JSON, CSV o string plano
function parseConcepts(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [raw];
    } catch {
      return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  return [];
}
async function obtenerPagosDeSheet(): Promise<{ success: boolean; pagos?: PaymentOrder[]; error?: string }> {
  if (!GOOGLE_API_URL || !GOOGLE_TOKEN) {
    return { success: false, error: 'Google API no configurada' };
  }

  try {
    const url = GOOGLE_API_URL + '?action=obtenerPagos&token=' + encodeURIComponent(GOOGLE_TOKEN);
    const response = await fetch(url, { method: 'GET' });
    const data: SheetPagoResponse = await response.json();

    if (data.success && data.pagos) {
      const pagos: PaymentOrder[] = data.pagos.map((p: any) => ({
        id: p.id_pago || p.folio,
        folio: p.folio,
        folioFierro: p.folio_fierro || undefined,
        exercise: p.ejercicio || '2026-2029',
        taxpayerName: p.taxpayer_name || '',
        rfc: p.rfc || undefined,
        curp: p.curp || undefined,
        address: p.address || '',
        concepts: parseConcepts(p.concepts),
        amount: Number(p.amount) || 0,
        period: p.periodo || '',
        date: p.date || '',
        status: p.status || 'PENDING',
        cashierName: p.cashier_name || '',
        notes: p.notes || '',
        referenciaPago: p.referencia_pago || undefined,
        metodoPago: p.metodo_pago || undefined,
        createdAt: p.created_at || undefined,
        updatedAt: p.updated_at || undefined,
        // FASE_0_3_BLOQUE_C: mapear campos del recibo
        urlReciboCloudinary: p.url_recibo_cloudinary || undefined,
        urlReciboDrive: p.url_recibo_drive || undefined,
        urlReciboDriveId: p.url_recibo_drive_id || undefined,
        urlReporte: p.url_reporte || undefined,
        fechaPago: p.fecha_pago || undefined,
        cajeroConfirmo: p.cajero_confirmo || undefined,
        operadorEntrego: p.operador_entrego || undefined,
        reciboTesoreria: p.recibo_tesoreria || undefined,
      }));
      return { success: true, pagos: pagos };
    }
    return { success: false, error: data.error || 'Sin pagos en Sheet' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Actualiza el estatus de un pago en el Sheet
 */
async function actualizarPagoEnSheet(folio: string, newStatus: string): Promise<boolean> {
  if (!GOOGLE_API_URL || !GOOGLE_TOKEN) return false;

  try {
    const response = await fetch(GOOGLE_API_URL + '?action=actualizarPagoEstatus', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ data: { folio: folio, status: newStatus }, token: GOOGLE_TOKEN }),
    });
    const data = await response.json();
    return data.success === true;
  } catch (err) {
    console.warn('[Pagos] Error actualizando en Sheets:', err);
    return false;
  }
}

/**
 * Elimina un pago en el Sheet
 */
async function eliminarPagoEnSheet(folio: string): Promise<boolean> {
  if (!GOOGLE_API_URL || !GOOGLE_TOKEN) return false;

  try {
    const response = await fetch(GOOGLE_API_URL + '?action=eliminarPago', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ data: { folio: folio }, token: GOOGLE_TOKEN }),
    });
    const data = await response.json();
    return data.success === true;
  } catch (err) {
    console.warn('[Pagos] Error eliminando en Sheets:', err);
    return false;
  }
}

// Standard official tariffs for municipal services in Pánuco, Ver.
export const OFFICIAL_PAYMENT_CONCEPTS = [
  { id: 'alta_fierro', label: '1. ALTA DE FIERRO QUEMADOR', defaultAmount: 450 },
  { id: 'revalidacion', label: '2. REVALIDACION FIERRO QUEMADOR', defaultAmount: 350 },
  { id: 'multa_extemporanea', label: '3. MULTA POR PAGO EXTEMPORANEO', defaultAmount: 150 },
  { id: 'reposicion_patente', label: '4. REPOSICION POR PATENTE EXTRAVIADA', defaultAmount: 400 },
  { id: 'pago_constancia', label: '5. PAGO DE CONSTANCIA', defaultAmount: 180 },
  { id: 'baja_fierro', label: '6. BAJA DE FIERRO QUEMADOR', defaultAmount: 200 },
  { id: 'derecho_deguello', label: '7. DERECHO DE DEGÜELLO Y CONTROL SANITARIO', defaultAmount: 90 },
  { id: 'otros', label: '8. OTROS / CONCEPTO PERSONALIZADO', defaultAmount: 0 },
] as const;

// Initial sample data for immediate display and testing
// FIX_SEEDS_ELIMINADOS: Array vacio para no contaminar datos reales del Sheet
const INITIAL_SEED_ORDERS: PaymentOrder[] = [];

// Firebase app and firestore initialization
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
  } catch (err) {
    console.warn('Firebase Firestore initialization note: Using local municipal cache fallback', err);
    return null;
  }
}

// Local Storage Helper
function getLocalOrders(): PaymentOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(orders: PaymentOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (err) {
    console.warn('Could not save to localStorage', err);
  }
}

/**
 * Fetch all payment orders (attempts Firestore first, falls back to persistent local storage)
 */
export async function getPaymentOrders(): Promise<PaymentOrder[]> {
  // FIX_PAGOS_SHEETS: intentar primero desde Sheets
  try {
    const sheetResult = await obtenerPagosDeSheet();
    if (sheetResult.success && sheetResult.pagos && sheetResult.pagos.length > 0) {
      saveLocalOrders(sheetResult.pagos);
      console.log('%c[Pagos] ' + sheetResult.pagos.length + ' ordenes cargadas desde Sheets', 'color: #22c55e');
      return sheetResult.pagos;
    }
  } catch (err) {
    console.warn('[Pagos] Fallback a cache local:', err);
  }

  const db = getDb();
  if (db && (import.meta as any).env?.VITE_FIREBASE_API_KEY) {
    try {
      const q = query(collection(db, 'payment_orders'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const firestoreOrders: PaymentOrder[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        saveLocalOrders(firestoreOrders);
        return firestoreOrders;
      }
    } catch (err) {
      console.warn('Firestore read unavailable, using municipal storage:', err);
    }
  }

  return getLocalOrders();
}

/**
 * Create a new payment order
 */
export async function createPaymentOrder(
  orderData: Omit<PaymentOrder, 'id'>
): Promise<PaymentOrder> {
  const localOrders = getLocalOrders();
  const newId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const newOrder: PaymentOrder = {
    ...orderData,
    id: newId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save to local storage immediately
  const updatedList = [newOrder, ...localOrders];
  saveLocalOrders(updatedList);

  // FIX_PAGOS_SHEETS: subir a Google Sheets en background
  subirPagoASheets(newOrder).catch((err) => {
    console.warn('[Pagos] Error al sincronizar con Sheets, se guardo localmente:', err);
  });

  // Attempt Firestore save in background
  const db = getDb();
  if (db && (import.meta as any).env?.VITE_FIREBASE_API_KEY) {
    try {
      const docRef = await addDoc(collection(db, 'payment_orders'), {
        ...orderData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      newOrder.id = docRef.id;
      // Update local storage with official Firestore ID
      const reUpdated = updatedList.map((o) => (o.id === newId ? { ...o, id: docRef.id } : o));
      saveLocalOrders(reUpdated);
    } catch (err) {
      console.warn('Could not sync to Firestore server, saved locally:', err);
    }
  }

  return newOrder;
}

/**
 * Update payment order status (PENDING, PAID, CANCELLED)
 */
export async function updatePaymentOrderStatus(
  orderId: string,
  newStatus: 'PENDING' | 'PAID' | 'CANCELLED'
): Promise<void> {
  const localOrders = getLocalOrders();
  const updated = localOrders.map((o) =>
    o.id === orderId
      ? { ...o, status: newStatus, updatedAt: new Date().toISOString() }
      : o
  );
  saveLocalOrders(updated);

  // FIX_PAGOS_SHEETS: actualizar tambien en Sheets
  const affectedOrder = localOrders.find((o) => o.id === orderId);
  if (affectedOrder) {
    actualizarPagoEnSheet(affectedOrder.folio, newStatus).then((ok) => {
      if (ok) console.log('%c[Pagos] Estatus actualizado en Sheets:', 'color: #22c55e', affectedOrder.folio, newStatus);
    });
  }

  const db = getDb();
  if (db && (import.meta as any).env?.VITE_FIREBASE_API_KEY) {
    try {
      const docRef = doc(db, 'payment_orders', orderId);
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Could not update Firestore document status:', err);
    }
  }
}

/**
 * Delete a payment order
 */
export async function deletePaymentOrder(orderId: string): Promise<void> {
  const localOrders = getLocalOrders();
  const orderToDelete = localOrders.find((o) => o.id === orderId);
  const filtered = localOrders.filter((o) => o.id !== orderId);
  saveLocalOrders(filtered);

  // FIX_PAGOS_SHEETS: eliminar tambien en Sheets
  if (orderToDelete) {
    eliminarPagoEnSheet(orderToDelete.folio).then((ok) => {
      if (ok) console.log('%c[Pagos] Eliminado de Sheets:', 'color: #ef4444', orderToDelete.folio);
    });
  }

  const db = getDb();
  if (db && (import.meta as any).env?.VITE_FIREBASE_API_KEY) {
    try {
      const docRef = doc(db, 'payment_orders', orderId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Could not delete from Firestore:', err);
    }
  }
}

/**
 * Generates the next sequential official payment order folio for Pánuco
 */
/**
 * FIX_PAGOS_SHEETS: obtiene todos los pagos vinculados a un folio de fierro
 */
export async function getPagosByFolioFierro(folioFierro: string): Promise<PaymentOrder[]> {
  if (!folioFierro) return [];
  const allOrders = await getPaymentOrders();
  return allOrders.filter((o) => o.folioFierro === folioFierro);
}

export function generateNextFolio(currentOrders?: PaymentOrder[]): string {
  const orders = currentOrders || getLocalOrders();
  const year = new Date().getFullYear();
  let maxSeq = 104;

  for (const o of orders) {
    const match = o.folio?.match(/ORD-\d{4}-(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxSeq) maxSeq = num;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(5, '0');
  return `ORD-${year}-${nextSeq}`;
}
/**
 * FIX_FOLIO_ASYNC: Version asincrona que lee de Sheets para evitar colisiones.
 */
export async function generateNextFolioAsync(): Promise<string> {
  const orders = await getPaymentOrders();
  const year = new Date().getFullYear();
  let maxSeq = 0;
  for (const o of orders) {
    const match = o.folio?.match(/ORD-\d{4}-(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxSeq) maxSeq = num;
    }
  }
  return `ORD-${year}-${String(maxSeq + 1).padStart(5, '0')}`;
}

/**
 * Converts a number to written Spanish words for official treasury receipt
 * (e.g., 450 -> "CUATROCIENTOS CINCUENTA PESOS 00/100 M.N.")
 */
export function numberToSpanishCurrencyWords(amount: number): string {
  const integerPart = Math.floor(amount);
  const cents = Math.round((amount - integerPart) * 100);
  const centsStr = String(cents).padStart(2, '0') + '/100 M.N.';

  if (integerPart === 0) return `CERO PESOS ${centsStr}`;

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = [
    '',
    'DIEZ',
    'VEINTE',
    'TREINTA',
    'CUARENTA',
    'CINCUENTA',
    'SESENTA',
    'SETENTA',
    'OCHENTA',
    'NOVENTA',
  ];
  const especiales = [
    'DIEZ',
    'ONCE',
    'DOCE',
    'TRECE',
    'CATORCE',
    'QUINCE',
    'DIECISÉIS',
    'DIECISIETE',
    'DIECIOCHO',
    'DIECINUEVE',
  ];
  const centenas = [
    '',
    'CIENTO',
    'DOSCIENTOS',
    'TRESCIENTOS',
    'CUATROCIENTOS',
    'QUINIENTOS',
    'SEISCIENTOS',
    'SETECIENTOS',
    'OCHOCIENTOS',
    'NOVECIENTOS',
  ];

  function convertGroup(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';

    let res = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) res += centenas[c] + ' ';

    if (d === 1) {
      res += especiales[u] + ' ';
    } else if (d === 2 && u > 0) {
      res += 'VEINTI' + unidades[u] + ' ';
    } else {
      if (d > 0) res += decenas[d] + (u > 0 ? ' Y ' : ' ');
      if (u > 0) res += unidades[u] + ' ';
    }

    return res.trim();
  }

  let words = '';
  if (integerPart >= 1000) {
    const miles = Math.floor(integerPart / 1000);
    const resto = integerPart % 1000;
    words = (miles === 1 ? 'UN MIL' : convertGroup(miles) + ' MIL') + ' ';
    if (resto > 0) words += convertGroup(resto) + ' ';
  } else {
    words = convertGroup(integerPart) + ' ';
  }

  const pesoWord = integerPart === 1 ? 'PESO' : 'PESOS';
  return `${words.trim()} ${pesoWord} ${centsStr}`.toUpperCase();
}
