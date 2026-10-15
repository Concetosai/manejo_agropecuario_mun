import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Landmark,
  Receipt,
  PlusCircle,
  Search,
  Printer,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  User,
  MapPin,
  Check,
  X,
  Trash2,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  FileCheck2,
  PackageCheck,
  BadgeCheck,
  Eye,
  Camera,
} from 'lucide-react';
import { PaymentOrder, ProducerData, MunicipalUser, MunicipalConfig, PreloadedOrderData } from '../../types';
import {
  getPaymentOrders,
  createPaymentOrder,
  updatePaymentOrderStatus,
  deletePaymentOrder,
  generateNextFolio,
  OFFICIAL_PAYMENT_CONCEPTS,
  numberToSpanishCurrencyWords,
} from '../../services/financeFirestore';
import {
  confirmarPagoRecibidoEnSheet,
  marcarEntregaCompletadaEnSheet,
} from '../../services/googleSheetsService';
import { recordAuditLog } from '../../utils/auditAuth';
import { ConfirmarPagoModal } from './ConfirmarPagoModal';
import { ReciboPrintable } from './ReciboPrintable';

interface FinanceManagerProps {
  currentProducer?: ProducerData;
  currentUser: MunicipalUser;
  municipalConfig: MunicipalConfig;
  initialCategory?: 'ALTA' | 'REVALIDACION' | 'BAJA' | 'CONSTANCIA' | 'DEGUELLO' | null;
  preloadedOrderData?: PreloadedOrderData | null;
  onBackToHub?: () => void;
  onGoToCertificado?: () => void;
  onVerCertificadoImagen?: (folio: string) => void;
}

// Normalizer for concepts received from procedures or catalogs
export function normalizeConceptLabel(conceptKeyOrLabel: string): string {
  const cLower = conceptKeyOrLabel.toLowerCase().trim();
  if (cLower.includes('alta') || cLower === 'alta_fierro' || cLower === 'alta-fq') {
    return '1. ALTA DE FIERRO QUEMADOR';
  }
  if (cLower.includes('revalidacion') || cLower.includes('revalidación') || cLower === 'revalidacion' || cLower === 'rev-fq') {
    return '2. REVALIDACION FIERRO QUEMADOR';
  }
  if (cLower.includes('multa') || cLower.includes('extemporan') || cLower === 'multa_extemporanea' || cLower === 'multa-ext') {
    return '3. MULTA POR PAGO EXTEMPORANEO';
  }
  if (cLower.includes('reposicion') || cLower.includes('reposición') || cLower === 'reposicion_patente' || cLower === 'rep-pat') {
    return '4. REPOSICION POR PATENTE EXTRAVIADA';
  }
  if (cLower.includes('constancia') || cLower === 'pago_constancia' || cLower === 'const-pg') {
    return '5. PAGO DE CONSTANCIA';
  }
  if (cLower.includes('baja') || cLower === 'baja_fierro' || cLower === 'baja-fq') {
    return '6. BAJA DE FIERRO QUEMADOR';
  }
  if (cLower.includes('degüello') || cLower.includes('deguello') || cLower === 'derecho_deguello' || cLower === 'deg-san') {
    return '7. DERECHO DE DEGÜELLO Y CONTROL SANITARIO';
  }
  return conceptKeyOrLabel;
}

export const FinanceManager: React.FC<FinanceManagerProps> = ({
  currentProducer,
  currentUser,
  municipalConfig,
  initialCategory,
  preloadedOrderData,
  onBackToHub,
  onGoToCertificado,
  onVerCertificadoImagen,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'new_order'>(
    initialCategory || preloadedOrderData ? 'new_order' : 'history'
  );
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [conceptFilter, setConceptFilter] = useState<string>('ALL');

  // Form State for New Order
  const [taxpayerName, setTaxpayerName] = useState('');
  const [taxpayerRfc, setTaxpayerRfc] = useState('');
  const [address, setAddress] = useState('');
  const [exercise, setExercise] = useState('2026-2029');
  const [period, setPeriod] = useState(() => {
    const months = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    const now = new Date();
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  });
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([
    '1. ALTA DE FIERRO QUEMADOR',
  ]);
  const [customConcept, setCustomConcept] = useState('');
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [manualAmount, setManualAmount] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touchedSubmit, setTouchedSubmit] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Print Preview Modal State
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<PaymentOrder | null>(null);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Orden recien guardada
  const [lastSavedOrder, setLastSavedOrder] = useState<PaymentOrder | null>(null);

  // =========================================================================
  // SPRINT 1: Estados para los modales de "Confirmar Pago" y "Entregar Docs"
  // =========================================================================
  const [showConfirmPagoModal, setShowConfirmPagoModal] = useState(false);
  const [isProcessingModal, setIsProcessingModal] = useState(false);
  const [modalAlert, setModalAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<PaymentOrder | null>(null);
  const [orderToDeliver, setOrderToDeliver] = useState<PaymentOrder | null>(null);
  const [operadorEntregoDocs, setOperadorEntregoDocs] = useState('');

  // Load orders on mount
  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await getPaymentOrders();
      setOrders(data);
    } catch (err) {
      console.warn('Error loading payment orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Pre-configure concepts, amounts, and taxpayer info arriving from operational procedures
  useEffect(() => {
    if (preloadedOrderData) {
      setActiveSubTab('new_order');
      setTaxpayerName(preloadedOrderData.nombreContribuyente ? preloadedOrderData.nombreContribuyente.toUpperCase() : '');
      setTaxpayerRfc(preloadedOrderData.rfc ? preloadedOrderData.rfc.toUpperCase() : '');
      setAddress(preloadedOrderData.domicilioContribuyente || '');
      if (preloadedOrderData.ejercicioFiscal) setExercise(preloadedOrderData.ejercicioFiscal);
      if (preloadedOrderData.periodo) setPeriod(preloadedOrderData.periodo);
      if (preloadedOrderData.fechaExpedicion) setDate(preloadedOrderData.fechaExpedicion);
      
      if (preloadedOrderData.conceptosSeleccionados && preloadedOrderData.conceptosSeleccionados.length > 0) {
        const normalized = preloadedOrderData.conceptosSeleccionados.map(normalizeConceptLabel);
        setSelectedConcepts(normalized);
      }
      
      if (preloadedOrderData.montoTotal !== undefined && preloadedOrderData.montoTotal !== null) {
        setManualAmount(preloadedOrderData.montoTotal);
      } else {
        setManualAmount(null);
      }
      if (preloadedOrderData.notas) setNotes(preloadedOrderData.notas);
      if (preloadedOrderData.customConcept) setCustomConcept(preloadedOrderData.customConcept);
      setTouchedSubmit(false);
      return;
    }

    if (initialCategory) {
      setActiveSubTab('new_order');
      if (initialCategory === 'ALTA') {
        setSelectedConcepts(['1. ALTA DE FIERRO QUEMADOR', '5. PAGO DE CONSTANCIA']);
      } else if (initialCategory === 'REVALIDACION') {
        setSelectedConcepts([
          '2. REVALIDACION FIERRO QUEMADOR',
          '5. PAGO DE CONSTANCIA',
        ]);
      } else if (initialCategory === 'BAJA') {
        setSelectedConcepts(['6. BAJA DE FIERRO QUEMADOR']);
      } else if (initialCategory === 'CONSTANCIA') {
        setSelectedConcepts(['5. PAGO DE CONSTANCIA']);
      } else if (initialCategory === 'DEGUELLO') {
        setSelectedConcepts(['7. DERECHO DE DEGÜELLO Y CONTROL SANITARIO']);
      }
      setManualAmount(null);

      if (currentProducer?.fullName && !taxpayerName) {
        setTaxpayerName(currentProducer.fullName.toUpperCase());
        setTaxpayerRfc(currentProducer.rfc ? currentProducer.rfc.toUpperCase() : '');
        if (currentProducer.address) {
          setAddress(
            `${currentProducer.address}, ${currentProducer.ejido ? `Ejido ${currentProducer.ejido}, ` : ''}Pánuco, Ver.`
          );
        }
      }
      return;
    }

    if (!preloadedOrderData && !initialCategory) {
      setTaxpayerName('');
      setTaxpayerRfc('');
      setAddress('');
      setSelectedConcepts([]);
      setManualAmount(null);
      setCustomConcept('');
      setCustomAmount(0);
      setNotes('');
      setTouchedSubmit(false);
    }
  }, [preloadedOrderData, initialCategory, currentProducer]);

  const isNameMissing = !taxpayerName.trim();
  const isRfcMissing = !taxpayerRfc.trim();
  const isAddressMissing = !address.trim();
  const hasMissingFields = isNameMissing || isRfcMissing || isAddressMissing;

  const calculatedSuggestedAmount = useMemo(() => {
    let sum = 0;
    for (const cName of selectedConcepts) {
      const found = OFFICIAL_PAYMENT_CONCEPTS.find((c) => c.label === cName);
      if (found) {
        if (found.id === 'otros') {
          sum += customAmount || 0;
        } else if (
          found.id === 'derecho_deguello' &&
          preloadedOrderData?.tramiteOrigen === 'DEGUELLO' &&
          preloadedOrderData.montoTotal
        ) {
          sum += preloadedOrderData.montoTotal;
        } else {
          sum += found.defaultAmount;
        }
      }
    }
    return sum;
  }, [selectedConcepts, customAmount, preloadedOrderData]);

  const effectiveAmount = manualAmount !== null ? manualAmount : calculatedSuggestedAmount;

  const handleToggleConcept = (conceptLabel: string) => {
    setSelectedConcepts((prev) => {
      if (prev.includes(conceptLabel)) {
        return prev.filter((c) => c !== conceptLabel);
      } else {
        return [...prev, conceptLabel];
      }
    });
    setManualAmount(null);
  };

  const handlePopulateFromProducer = () => {
    if (!currentProducer || !currentProducer.fullName) {
      setAlertMessage({
        type: 'error',
        text: 'No hay datos de productor en el borrador de registro actual.',
      });
      setTimeout(() => setAlertMessage(null), 3500);
      return;
    }

    setTaxpayerName(currentProducer.fullName.toUpperCase());
    setAddress(
      currentProducer.address
        ? `${currentProducer.address}, ${currentProducer.ejido ? `Ejido ${currentProducer.ejido}, ` : ''}Pánuco, Ver.`
        : `Ejido ${currentProducer.ejido || 'Central'}, Pánuco, Ver.`
    );
    if (currentProducer.validityRange) {
      setExercise(currentProducer.validityRange);
    }

    setAlertMessage({
      type: 'success',
      text: `Datos del productor "${currentProducer.fullName}" cargados con éxito.`,
    });
    setTimeout(() => setAlertMessage(null), 3500);
  };

  // =========================================================================
  // SPRINT 1 · HANDLER: Confirmar Pago con Recibo de Tesorería
  // =========================================================================
  // SPRINT 1 · HANDLER: Abrir modal de confirmacion de pago
  const handleOpenConfirmPagoModal = (order: PaymentOrder) => {
    setOrderToConfirm(order);
    setShowConfirmPagoModal(true);
  };

  // =========================================================================
  // SPRINT 2 · HANDLER: Marcar Entrega de Documentos Completada
  // =========================================================================
  const handleOpenEntregaModal = (order: PaymentOrder) => {
    setOrderToDeliver(order);
    setOperadorEntregoDocs(currentUser.fullName || '');
    setModalAlert(null);
    setShowEntregaModal(true);
  };

  const handleMarcarEntrega = async () => {
    if (!orderToDeliver) return;
    if (!operadorEntregoDocs.trim()) {
      setModalAlert({ type: 'error', text: 'El nombre del operador que entrega es obligatorio.' });
      return;
    }

    setIsProcessingModal(true);
    setModalAlert(null);

    try {
      const result = await marcarEntregaCompletadaEnSheet({
        folio: orderToDeliver.folio,
        operador_entrego_docs: operadorEntregoDocs.trim(),
      });

      if (!result.success) {
        setModalAlert({ type: 'error', text: result.error || 'Error al marcar entrega' });
        setIsProcessingModal(false);
        return;
      }

      recordAuditLog({
        actionType: 'REGISTRO_MODIFICADO',
        folioAffected: orderToDeliver.folio,
        producerAffected: orderToDeliver.taxpayerName,
        details: `Entrega de certificado y credencial completada para orden ${orderToDeliver.folio}. Operador: ${operadorEntregoDocs}.`,
      });

      setModalAlert({ type: 'success', text: `✅ Entrega marcada correctamente. Ciclo cerrado.` });

      setTimeout(async () => {
        setShowEntregaModal(false);
        setOrderToDeliver(null);
        await loadOrders();
      }, 1200);

    } catch (err: any) {
      setModalAlert({ type: 'error', text: 'Excepción: ' + (err.message || 'desconocido') });
    } finally {
      setIsProcessingModal(false);
    }
  };

  // Change Status
  const handleUpdateStatus = async (order: PaymentOrder, newStatus: 'PENDING' | 'PAID' | 'CANCELLED') => {
    if (!order.id) return;
    try {
      await updatePaymentOrderStatus(order.id, newStatus);
      recordAuditLog({
        actionType: 'REGISTRO_MODIFICADO',
        folioAffected: order.folio,
        producerAffected: order.taxpayerName,
        details: `Estatus de orden de cobro ${order.folio} actualizado a ${newStatus} por ${currentUser.fullName}.`,
      });
      await loadOrders();
    } catch (err) {
      console.warn('Error updating status:', err);
    }
  };

  // Delete Order
  const handleDeleteOrder = async (order: PaymentOrder) => {
    if (!order.id) return;
    if (!window.confirm(`¿Está seguro de eliminar permanentemente la orden de cobro ${order.folio} de ${order.taxpayerName}?`)) {
      return;
    }
    try {
      await deletePaymentOrder(order.id);
      recordAuditLog({
        actionType: 'REGISTRO_ELIMINADO',
        folioAffected: order.folio,
        producerAffected: order.taxpayerName,
        details: `Orden de cobro ${order.folio} eliminada del sistema.`,
      });
      await loadOrders();
    } catch (err) {
      console.warn('Error deleting order:', err);
    }
  };

  // Submit New Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedSubmit(true);
    if (!taxpayerName.trim()) {
      setAlertMessage({
        type: 'error',
        text: 'Por favor ingrese el nombre del contribuyente antes de generar la orden.',
      });
      return;
    }
    if (!address.trim()) {
      setAlertMessage({
        type: 'error',
        text: 'Por favor ingrese el domicilio o predio del contribuyente antes de generar la orden.',
      });
      return;
    }
    if (selectedConcepts.length === 0) {
      setAlertMessage({
        type: 'error',
        text: 'Debe seleccionar al menos un concepto de pago reglamentario.',
      });
      return;
    }
    if (effectiveAmount <= 0) {
      setAlertMessage({
        type: 'error',
        text: 'El monto total a cobrar debe ser mayor a $0.00 pesos.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const folio = generateNextFolio(orders);
      const newOrder = await createPaymentOrder({
        folio,
        exercise,
        taxpayerName: taxpayerName.trim().toUpperCase(),
        rfc: taxpayerRfc.trim().toUpperCase() || 'XAXX010101000',
        curp: preloadedOrderData?.curp || '',
        address: address.trim() || 'Domicilio Conocido, Pánuco, Ver.',
        concepts: selectedConcepts,
        customConcept: selectedConcepts.some((c) => c.includes('OTROS')) ? customConcept : undefined,
        period,
        amount: effectiveAmount,
        date,
        status: 'PENDING',
        cashierName: currentUser.fullName,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      });

      recordAuditLog({
        actionType: 'REGISTRO_CREADO',
        folioAffected: folio,
        producerAffected: taxpayerName,
        details: `Orden de Cobro Municipal generada (${folio}) por $${effectiveAmount.toLocaleString()} MXN a nombre de ${taxpayerName} (RFC: ${taxpayerRfc || 'XAXX010101000'}). Conceptos: ${selectedConcepts.join(', ')}.`,
      });

      setAlertMessage({
        type: 'success',
        text: `¡Orden de cobro ${folio} generada exitosamente!`,
      });
      setTimeout(() => setAlertMessage(null), 4000);

      setLastSavedOrder(newOrder);

      await loadOrders();
      setSelectedOrderForPrint(newOrder);

      setTaxpayerName('');
      setTaxpayerRfc('');
      setAddress('');
      setManualAmount(null);
      setCustomConcept('');
      setCustomAmount(0);
      setNotes('');
      setActiveSubTab('history');
    } catch (err) {
      console.warn('Error creating order:', err);
      alert('Error al guardar la orden de cobro en el sistema.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        searchQuery === '' ||
        o.folio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.taxpayerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.concepts?.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const matchConcept =
        conceptFilter === 'ALL' || o.concepts?.some((c) => c.includes(conceptFilter));

      return matchSearch && matchStatus && matchConcept;
    });
  }, [orders, searchQuery, statusFilter, conceptFilter]);

  // Financial summary metrics (ahora con 4 estados)
  const summaryMetrics = useMemo(() => {
    const deliveredSum = orders.filter((o) => o.status === 'DELIVERED').reduce((acc, o) => acc + (o.amount || 0), 0);
    const paidSum = orders.filter((o) => o.status === 'PAID').reduce((acc, o) => acc + (o.amount || 0), 0);
    const pendingSum = orders.filter((o) => o.status === 'PENDING').reduce((acc, o) => acc + (o.amount || 0), 0);
    const totalCount = orders.length;
    return { deliveredSum, paidSum, pendingSum, totalCount };
  }, [orders]);

  // Format date helper in Spanish
  const formatDateSpanish = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      const months = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
      ];
      const mIdx = parseInt(m, 10) - 1;
      return `${parseInt(d, 10)} DE ${months[mIdx] || m} DEL ${y}`;
    } catch {
      return dateStr;
    }
  };

  // =========================================================================
  // ⚠️ AQUÍ SIGUE LA PARTE 2 (JSX del componente)
  // Cuando te la pase, la pegas DEBAJO de esta línea, sin borrar lo de arriba.
  // =========================================================================

    return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Back to Hub Banner */}
      {onBackToHub && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl px-4 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all cursor-pointer border border-stone-300 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-800" />
              <span>← Volver al Hub de Trámites</span>
            </button>
            {initialCategory && (
              <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                Trámite Activo: <strong>{initialCategory}</strong> (Conceptos y cuotas preconfigurados)
              </span>
            )}

            {currentProducer?.fullName && (onVerCertificadoImagen || onGoToCertificado) && (
              <button
                type="button"
                onClick={() => {
                  if (!lastSavedOrder) {
                    alert('Debe guardar primero la orden de cobro antes de ver el Certificado Oficial.');
                    return;
                  }
                  if (onVerCertificadoImagen && lastSavedOrder.folioFierro) {
                    onVerCertificadoImagen(lastSavedOrder.folioFierro);
                  } else if (onVerCertificadoImagen && currentProducer.folio) {
                    onVerCertificadoImagen(currentProducer.folio);
                  } else if (onGoToCertificado) {
                    onGoToCertificado();
                  }
                }}
                disabled={!lastSavedOrder}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                  lastSavedOrder
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700'
                    : 'bg-stone-100 text-stone-400 border-stone-300 cursor-not-allowed'
                }`}
                title={
                  lastSavedOrder
                    ? 'Ver la imagen del Certificado Oficial (Cloudinary)'
                    : 'Guarde primero la orden de cobro para habilitar este boton'
                }
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Ver Certificado Oficial</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] text-stone-500 hidden sm:inline">
            Ventanilla Única · H. Ayuntamiento de Pánuco
          </span>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white rounded-2xl p-5 sm:p-7 shadow-xl border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
            <Landmark className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-amber-400 text-stone-950">
                Tesorería Municipal · Dirección de Ingresos
              </span>
              <span className="text-stone-400 text-xs hidden sm:inline">
                H. Ayuntamiento de Pánuco, Ver.
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-cinzel font-bold text-white tracking-wide">
              Control de Finanzas y Órdenes de Cobro
            </h1>
            <p className="text-xs text-stone-300 max-w-2xl mt-0.5 leading-relaxed">
              Emisión, recaudación e impresión de órdenes oficiales de cobro por derechos de fierro quemador, revalidaciones trienales, multas, reposición de patentes y constancias ganaderas.
            </p>
          </div>
        </div>

        {/* Financial KPI Summary Cards — Ahora con 4 métricas */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-stone-950/70 border border-amber-500/30 rounded-xl p-3 shrink-0 self-stretch md:self-auto justify-between md:justify-start">
          <div className="text-center px-2">
            <span className="text-[10px] text-stone-400 block font-semibold uppercase">Por Cobrar</span>
            <span className="text-base sm:text-lg font-bold font-mono text-amber-400">
              ${summaryMetrics.pendingSum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-px h-8 bg-stone-700" />
          <div className="text-center px-2">
            <span className="text-[10px] text-stone-400 block font-semibold uppercase">Pagado</span>
            <span className="text-base sm:text-lg font-bold font-mono text-blue-400">
              ${summaryMetrics.paidSum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-px h-8 bg-stone-700" />
          <div className="text-center px-2">
            <span className="text-[10px] text-stone-400 block font-semibold uppercase">Entregado</span>
            <span className="text-base sm:text-lg font-bold font-mono text-emerald-400">
              ${summaryMetrics.deliveredSum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-px h-8 bg-stone-700" />
          <div className="text-center px-2">
            <span className="text-[10px] text-stone-400 block font-semibold uppercase">Órdenes</span>
            <span className="text-base sm:text-lg font-bold font-mono text-stone-200">
              {summaryMetrics.totalCount}
            </span>
          </div>
        </div>
      </div>

      {/* Alert Notification */}
      {alertMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-semibold ${
            alertMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
              : 'bg-rose-50 text-rose-950 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{alertMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertMessage(null)}
            className="text-stone-500 hover:text-stone-800 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Sub-Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-stone-200 bg-white rounded-t-xl px-4 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'history'
                ? 'border-amber-700 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Historial de Órdenes de Cobro ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('new_order')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'new_order'
                ? 'border-amber-700 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-amber-700" />
            <span>Nueva Orden de Cobro</span>
          </button>
        </div>

        <button
          type="button"
          onClick={loadOrders}
          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer text-xs flex items-center gap-1 mb-2"
          title="Sincronizar con Sheets"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sincronizar</span>
        </button>
      </div>

      {/* 3. SUBTAB 1: HISTORIAL DE ÓRDENES */}
      {activeSubTab === 'history' && (
        <div className="bg-white border-2 border-stone-200 rounded-b-2xl p-4 sm:p-6 shadow-xs space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                placeholder="Buscar por folio, contribuyente, domicilio o concepto..."
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Status Filter — 5 estados */}
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full py-2 px-3 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">Todos los Estatus</option>
                <option value="PENDING">Pendientes de Pago</option>
                <option value="PAID">Pagados (sin entregar)</option>
                <option value="DELIVERED">Entregados (cerrados)</option>
                <option value="CANCELLED">Cancelados</option>
              </select>
            </div>

            {/* Concept Filter */}
            <div className="sm:col-span-3">
              <select
                value={conceptFilter}
                onChange={(e) => setConceptFilter(e.target.value.toUpperCase())}
                className="w-full py-2 px-3 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">Todos los Conceptos</option>
                <option value="ALTA">Alta de Fierro</option>
                <option value="REVALIDACION">Revalidación</option>
                <option value="MULTA">Multa Extemporánea</option>
                <option value="PATENTE">Reposición Patente</option>
                <option value="CONSTANCIA">Constancia</option>
                <option value="BAJA">Baja de Fierro</option>
                <option value="DEGÜELLO">Degüello</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-700 uppercase font-bold border-b border-stone-200 text-[10px] tracking-wider">
                  <th className="py-3 px-3">Folio Oficial</th>
                  <th className="py-3 px-3">Contribuyente (C.)</th>
                  <th className="py-3 px-3">Concepto(s)</th>
                  <th className="py-3 px-3">Periodo</th>
                  <th className="py-3 px-3 text-right">Monto ($)</th>
                  <th className="py-3 px-3 text-center">Estatus</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-stone-500">
                      <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-stone-400" />
                      <p className="font-semibold text-xs">No se encontraron órdenes de cobro con los filtros seleccionados.</p>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('new_order')}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Crear Primera Orden de Cobro</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isPending = order.status === 'PENDING';
                    const isPaid = order.status === 'PAID';
                    const isDelivered = order.status === 'DELIVERED';
                    const isCancelled = order.status === 'CANCELLED';

                    return (
                      <tr key={order.id || order.folio} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-900 whitespace-nowrap">
                          {order.folio}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-stone-900">
                          <span className="block truncate max-w-[200px]" title={order.taxpayerName}>
                            {order.taxpayerName}
                          </span>
                          <span className="text-[10px] text-stone-500 block truncate max-w-[200px]" title={order.address}>
                            {order.address}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-stone-700">
                          <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {order.concepts?.map((c, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-800 text-[10px] font-medium border border-stone-200"
                              >
                                {c.replace(/^\d+\.\s*/, '')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-stone-600 whitespace-nowrap font-mono text-[11px]">
                          {order.period}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900 text-sm whitespace-nowrap">
                          ${(order.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" /> PENDIENTE
                            </span>
                          )}
                          {isPaid && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                              <DollarSign className="w-3 h-3 text-blue-600" /> PAGADO
                            </span>
                          )}
                          {isDelivered && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <BadgeCheck className="w-3 h-3 text-emerald-600" /> ENTREGADO
                            </span>
                          )}
                          {isCancelled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                              <XCircle className="w-3 h-3 text-rose-600" /> CANCELADO
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Ver / Imprimir */}
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForPrint(order)}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 transition-colors cursor-pointer"
                              title="Visualizar e Imprimir Orden Oficial"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* SPRINT 1: Botón Confirmar Pago (solo en PENDING) */}
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleOpenConfirmPagoModal(order)}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                                title="Confirmar pago con recibo de Tesorería"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* SPRINT 2: Botón Entregar Docs (solo en PAID) */}
                            {isPaid && (
                              <button
                                type="button"
                                onClick={() => handleOpenEntregaModal(order)}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                                title="Marcar entrega de certificado y credencial"
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Cancelar */}
                            {!isCancelled && !isDelivered && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(order, 'CANCELLED')}
                                className="p-1.5 rounded-lg bg-stone-100 hover:bg-rose-100 text-stone-500 hover:text-rose-700 transition-colors cursor-pointer"
                                title="Cancelar Orden"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* FASE_0_3_BLOQUE_C: Ver foto del recibo (Cloudinary) */}
                            {order.urlReciboCloudinary && (
                              <a
                                href={order.urlReciboCloudinary}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer inline-flex items-center"
                                title="Ver foto del recibo sellado (Cloudinary)"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </a>
                            )}

                            {/* FASE_0_3_BLOQUE_C: Ver recibo PDF (Drive) */}
                            {order.urlReciboDrive && (
                              <a
                                href={order.urlReciboDrive}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors cursor-pointer inline-flex items-center"
                                title="Ver recibo PDF oficial (abre en nueva pestaña)"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                            )}

                            {/* Eliminar */}
                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(order)}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-rose-100 text-stone-400 hover:text-rose-700 transition-colors cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SUBTAB 2: NUEVA ORDEN DE COBRO */}
      {activeSubTab === 'new_order' && (
        <form onSubmit={handleCreateOrder} className="bg-white border-2 border-stone-200 rounded-b-2xl p-4 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-cinzel font-bold text-stone-900">
                Formulario de Orden de Cobro Municipal
              </h2>
              <p className="text-xs text-stone-500">
                Llene los datos oficiales del contribuyente y seleccione los conceptos reglamentarios para el pago en caja.
              </p>
            </div>

            {currentProducer?.fullName && (
              <button
                type="button"
                onClick={handlePopulateFromProducer}
                className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Cargar Datos de "{currentProducer.fullName.split(' ')[0]}"</span>
              </button>
            )}
          </div>

          {preloadedOrderData && (
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-400 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-emerald-900 font-extrabold text-sm">
                      Vinculación Automática de Trámite Activa
                    </strong>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-200 text-emerald-900 border border-emerald-300">
                      {preloadedOrderData.tramiteOrigen || 'Ventanilla'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    Se han precargado automáticamente el contribuyente, domicilio y conceptos reglamentarios calculados. Revise los datos y haga clic en <strong>Generar e Imprimir Orden de Cobro</strong>.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-emerald-900 shrink-0 self-start sm:self-auto shadow-2xs">
                Total Trámite: ${preloadedOrderData.montoTotal.toFixed(2)} MXN
              </span>
            </div>
          )}

          {hasMissingFields && (touchedSubmit || Boolean(preloadedOrderData)) && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-400 rounded-2xl flex items-start gap-3 text-xs text-rose-950 shadow-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <strong className="font-extrabold text-rose-900 block text-sm">
                  ⚠️ Atención: Complete los campos requeridos marcados en rojo
                </strong>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Para emitir válidamente la orden de cobro municipal ante Tesorería, capture los datos pendientes del contribuyente:
                </p>
                <div className="flex flex-wrap gap-2 pt-1 font-bold text-[10px]">
                  {isNameMissing && (
                    <span className="px-2.5 py-0.5 bg-rose-200 text-rose-900 rounded-md border border-rose-300">
                      • Nombre del Contribuyente requerido
                    </span>
                  )}
                  {isRfcMissing && (
                    <span className="px-2.5 py-0.5 bg-rose-200 text-rose-900 rounded-md border border-rose-300">
                      • RFC requerido (o use el botón Genérico)
                    </span>
                  )}
                  {isAddressMissing && (
                    <span className="px-2.5 py-0.5 bg-rose-200 text-rose-900 rounded-md border border-rose-300">
                      • Domicilio del Predio requerido
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            <div className="lg:col-span-2 space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Nombre del Contribuyente (C. _____) *
                </label>
                {isNameMissing && (touchedSubmit || Boolean(preloadedOrderData)) && (
                  <span className="text-[10px] font-bold text-rose-600 animate-pulse">
                    ⚠️ Campo requerido para la orden
                  </span>
                )}
              </div>
              <div className="relative">
                <User
                  className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isNameMissing && (touchedSubmit || Boolean(preloadedOrderData))
                      ? 'text-rose-500'
                      : 'text-stone-400'
                  }`}
                />
                <input
                  type="text"
                  required
                  value={taxpayerName}
                  onChange={(e) => setTaxpayerName(e.target.value.toUpperCase())}
                  placeholder="Ej. C. AURELIO GUZMÁN ARADILLAS"
                  className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs sm:text-sm font-semibold uppercase focus:outline-none transition-colors ${
                    isNameMissing && (touchedSubmit || Boolean(preloadedOrderData))
                      ? 'bg-rose-50/70 border-rose-500 text-rose-950 focus:ring-2 focus:ring-rose-500 ring-1 ring-rose-400'
                      : 'bg-stone-50 border-stone-300 focus:ring-2 focus:ring-amber-500'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  RFC del Contribuyente *
                </label>
                {isRfcMissing && (touchedSubmit || Boolean(preloadedOrderData)) && (
                  <span className="text-[10px] font-bold text-rose-600 animate-pulse">
                    ⚠️ RFC Faltante
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={taxpayerRfc}
                  maxLength={13}
                  onChange={(e) => setTaxpayerRfc(e.target.value.toUpperCase())}
                  placeholder="Ej. GUAA62041530H"
                  className={`w-full px-3 py-2 border rounded-xl text-xs sm:text-sm font-mono font-bold uppercase focus:outline-none transition-colors ${
                    isRfcMissing && (touchedSubmit || Boolean(preloadedOrderData))
                      ? 'bg-rose-50/70 border-rose-500 text-rose-950 focus:ring-2 focus:ring-rose-500 ring-1 ring-rose-400'
                      : 'bg-stone-50 border-stone-300 focus:ring-2 focus:ring-amber-500'
                  }`}
                />
              </div>
              {isRfcMissing && (
                <button
                  type="button"
                  onClick={() => setTaxpayerRfc('XAXX010101000')}
                  className="text-[10px] text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer inline-flex items-center gap-1"
                >
                  + Asignar RFC Genérico (XAXX010101000)
                </button>
              )}
            </div>

            <div className="lg:col-span-2 space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Domicilio / Predio del Contribuyente *
                </label>
                {isAddressMissing && (touchedSubmit || Boolean(preloadedOrderData)) && (
                  <span className="text-[10px] font-bold text-rose-600 animate-pulse">
                    ⚠️ Domicilio requerido
                  </span>
                )}
              </div>
              <div className="relative">
                <MapPin
                  className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isAddressMissing && (touchedSubmit || Boolean(preloadedOrderData))
                      ? 'text-rose-500'
                      : 'text-stone-400'
                  }`}
                />
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value.toUpperCase())}
                  placeholder="Ej. Rancho La Huasteca Alta - Ejido Reventadero, Pánuco, Ver."
                  className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs sm:text-sm focus:outline-none transition-colors ${
                    isAddressMissing && (touchedSubmit || Boolean(preloadedOrderData))
                      ? 'bg-rose-50/70 border-rose-500 text-rose-950 focus:ring-2 focus:ring-rose-500 ring-1 ring-rose-400'
                      : 'bg-stone-50 border-stone-300 focus:ring-2 focus:ring-amber-500'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Ejercicio Fiscal *
              </label>
              <input
                type="text"
                required
                value={exercise}
                onChange={(e) => setExercise(e.target.value.toUpperCase())}
                placeholder="2026-2029"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Periodo Aplicable *
              </label>
              <input
                type="text"
                required
                value={period}
                onChange={(e) => setPeriod(e.target.value.toUpperCase())}
                placeholder="OCTUBRE 2026"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Fecha de Expedición *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-800">
                Conceptos de Pago Reglamentarios (Seleccione uno o varios) *
              </label>
              <span className="text-[11px] text-stone-500">
                Tarifas oficiales aprobadas por el H. Ayuntamiento
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {OFFICIAL_PAYMENT_CONCEPTS.map((concept) => {
                const isSelected = selectedConcepts.includes(concept.label);
                const isCustom = concept.id === 'otros';
                const isDeguelloWithCustomTotal =
                  concept.id === 'derecho_deguello' &&
                  preloadedOrderData?.tramiteOrigen === 'DEGUELLO' &&
                  preloadedOrderData.montoTotal;

                return (
                  <div
                    key={concept.id}
                    onClick={() => handleToggleConcept(concept.label)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-50/80 border-amber-600 shadow-xs'
                        : 'bg-stone-50 border-stone-200 hover:border-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-amber-700 border-amber-700 text-white'
                            : 'border-stone-400 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-xs font-bold text-stone-900 leading-tight">
                        {concept.label}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-stone-200/80 flex items-center justify-between text-xs">
                      <span className="text-stone-500 text-[10px]">Cuota Reglamentaria:</span>
                      <span className="font-mono font-bold text-stone-800">
                        {isCustom
                          ? 'Personalizada'
                          : isDeguelloWithCustomTotal
                          ? `$${preloadedOrderData.montoTotal.toFixed(2)} MXN (${preloadedOrderData.headCount || 3} cabezas)`
                          : `$${concept.defaultAmount.toFixed(2)} MXN`}
                      </span>
                    </div>

                    {isCustom && isSelected && (
                      <div className="mt-2 pt-2 border-t border-amber-300 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={customConcept}
                          onChange={(e) => setCustomConcept(e.target.value.toUpperCase())}
                          placeholder="Descripción del concepto personalizado..."
                          className="w-full px-2 py-1 bg-white border border-stone-300 rounded text-xs"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-stone-600">$</span>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={customAmount || ''}
                            onChange={(e) => setCustomAmount(parseFloat(e.target.value) || 0)}
                            placeholder="Monto ($)"
                            className="w-full px-2 py-1 bg-white border border-stone-300 rounded text-xs font-mono font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-stone-100 rounded-2xl border border-stone-300 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-7 space-y-1">
              <span className="text-[10px] uppercase font-bold text-stone-500 block">
                Importe con Letra (Para Recibo Oficial):
              </span>
              <p className="text-xs font-mono font-bold text-stone-800 uppercase leading-snug">
                {numberToSpanishCurrencyWords(effectiveAmount)}
              </p>
              <p className="text-[10px] text-stone-500">
                Suma calculada de conceptos seleccionados. Puede ajustarse manualmente si aplica subsidio o exención.
              </p>
            </div>

            <div className="md:col-span-5 flex items-center justify-end gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-stone-600 block">
                  Monto Total a Cobrar:
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-base font-bold text-stone-700">$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={effectiveAmount}
                    onChange={(e) => setManualAmount(parseFloat(e.target.value) || 0)}
                    className="w-36 px-2.5 py-1.5 bg-white border-2 border-amber-600 rounded-xl text-lg font-mono font-extrabold text-stone-900 text-right focus:outline-none shadow-xs"
                  />
                  <span className="text-xs font-mono text-stone-500">MXN</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
              Observaciones / Notas de Caja (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value.toUpperCase())}
              placeholder="Ej. Pago con transferencia bancaria / Trámite de nuevo registro ganadero."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-stone-200">
            <span className="text-xs text-stone-500">
              Operador emisor: <strong>{currentUser.fullName}</strong> ({currentUser.badgeNumber})
            </span>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveSubTab('history')}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>{isSubmitting ? 'Generando Orden...' : 'Generar e Imprimir Orden de Cobro'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ===========================================================================
          MODAL DE VISTA PREVIA E IMPRESION OFICIAL DEL DOCUMENTO MUNICIPAL
          Usa el componente <ReciboPrintable> para renderizar el recibo (1 solo tanto)
         =========================================================================== */}
      {selectedOrderForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden border-2 border-stone-800">
            {/* Modal Top Bar (No Print) */}
            <div className="no-print p-4 bg-stone-900 text-white flex items-center justify-between shrink-0 border-b border-stone-800">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold font-cinzel text-white leading-tight">
                    Orden Oficial de Cobro - {selectedOrderForPrint.folio}
                  </h3>
                  <span className="text-[11px] text-stone-400">
                    Formato Oficial de la Tesoreria Municipal de Panuco, Ver.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Documento</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForPrint(null)}
                  className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-stone-100 flex justify-center" ref={printContainerRef}>
              <ReciboPrintable
                order={selectedOrderForPrint}
                municipalConfig={municipalConfig}
                formatDateSpanish={formatDateSpanish}
                numberToSpanishCurrencyWords={numberToSpanishCurrencyWords}
              />
            </div>
          </div>
        </div>
      )}

            {/* ═══════════════════════════════════════════════════════════════════
          MODAL: CONFIRMAR PAGO CON RECIBO SELLADO
          Componente reutilizable que sube foto a Cloudinary + PDF a Drive
          y marca la orden como PAGADA en Sheets.
         ═══════════════════════════════════════════════════════════════════ */}
      <ConfirmarPagoModal
        isOpen={showConfirmPagoModal}
        onClose={() => {
          setShowConfirmPagoModal(false);
          setOrderToConfirm(null);
        }}
        order={orderToConfirm}
        currentUser={currentUser}
        municipalConfig={municipalConfig}
        onSuccess={async () => {
          await loadOrders();
        }}
      />

      {/* SPRINT 2 · MODAL: ENTREGAR CERTIFICADO Y CREDENCIAL
         ========================================================================= */}
      {showEntregaModal && orderToDeliver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border-2 border-blue-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Entregar Certificado y Credencial</h3>
                  <p className="text-[11px] text-blue-100">
                    Folio: <span className="font-mono font-bold">{orderToDeliver.folio}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowEntregaModal(false); setOrderToDeliver(null); }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                disabled={isProcessingModal}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Info de la orden */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500 font-bold uppercase text-[10px]">Contribuyente:</span>
                  <span className="font-bold text-stone-900 truncate ml-2">{orderToDeliver.taxpayerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 font-bold uppercase text-[10px]">Monto Pagado:</span>
                  <span className="font-mono font-bold text-blue-700">
                    ${(orderToDeliver.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 font-bold uppercase text-[10px]">Estado:</span>
                  <span className="font-bold text-blue-700">✅ PAGADO (listo para entregar)</span>
                </div>
              </div>

              {/* Alerta interna */}
              {modalAlert && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                    modalAlert.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-rose-50 text-rose-900 border-rose-300'
                  }`}
                >
                  {modalAlert.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="font-medium">{modalAlert.text}</span>
                </div>
              )}

              {/* Info importante */}
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-[11px] text-amber-900 space-y-1">
                <p className="font-bold">Al confirmar esta entrega:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[10px] pl-1">
                  <li>Se registra el cierre del trámite como <strong>ENTREGADO</strong></li>
                  <li>Se guarda fecha y hora de entrega en Sheets</li>
                  <li>El trámite no podrá revertirse</li>
                </ul>
              </div>

              {/* Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Nombre del Operador que Entrega *
                </label>
                <input
                  type="text"
                  value={operadorEntregoDocs}
                  onChange={(e) => setOperadorEntregoDocs(e.target.value.toUpperCase())}
                  placeholder="Nombre completo del operador"
                  className="w-full px-3 py-2.5 bg-stone-50 border-2 border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isProcessingModal}
                  autoFocus
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  Persona que físicamente entrega el certificado y credencial al productor.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowEntregaModal(false); setOrderToDeliver(null); }}
                disabled={isProcessingModal}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleMarcarEntrega}
                disabled={isProcessingModal || !operadorEntregoDocs.trim()}
                className="w-full sm:w-auto px-5 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
              >
                {isProcessingModal ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Marcando entrega...</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-4 h-4" />
                    <span>Confirmar Entrega · Cerrar Ciclo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
