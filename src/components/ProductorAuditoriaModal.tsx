import React, { useEffect, useMemo, useState } from 'react';
import { HistoricalRecord } from '../types';
import { runVectorSimilarityAnalysis } from '../utils/localFierrosStorage';
import { getPaymentOrders } from '../services/financeFirestore';
import { PaymentOrder } from '../types';
import { computeVectorChecksum } from '../utils/brandVectorization';
import {
  X, Camera, FileSignature, Award, FileText, CreditCard,
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  DollarSign, Receipt, Clock, Check, XCircle, Sparkles,
  Eye, ExternalLink, Calendar, Hash,
  FileCheck2,
} from 'lucide-react';

interface ProductorAuditoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: HistoricalRecord | null;
  allRecords: HistoricalRecord[];
  onLoadRecordIntoCertificate?: (record: HistoricalRecord) => void;
  onCreatePaymentOrder?: (record: HistoricalRecord) => void;
  onNavigateToCertificado?: () => void;
}

type TabId = 'imagenes' | 'vector' | 'pagos' | 'antiduplicidad';

/**
 * FIX_AUDITORIA_MODAL: Ventana emergente de auditoria completa por productor.
 * Muestra imagenes, vector 64D, historial de pagos y estado de no duplicidad.
 */
export const ProductorAuditoriaModal: React.FC<ProductorAuditoriaModalProps> = ({
  isOpen,
  onClose,
  record,
  allRecords,
  onLoadRecordIntoCertificate,
  onCreatePaymentOrder,
  onNavigateToCertificado,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('imagenes');
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Cargar pagos cuando se abre el modal
  useEffect(() => {
    if (!isOpen || !record) return;
    let mounted = true;
    setLoadingOrders(true);
    (async () => {
      try {
        const orders = await getPaymentOrders();
        if (mounted) setPaymentOrders(orders);
      } catch (err) {
        console.warn('[Auditoria] Error cargando pagos:', err);
      } finally {
        if (mounted) setLoadingOrders(false);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, record]);

  // Analisis de antiduplicidad
  const analysis = useMemo(() => {
    if (!record || !allRecords || allRecords.length === 0) return null;
    try {
      return runVectorSimilarityAnalysis(record, allRecords, 0.75);
    } catch (err) {
      console.warn('[Auditoria] Error en analisis:', err);
      return null;
    }
  }, [record, allRecords]);

  // Filtrar pagos del productor (por CURP, RFC o nombre)
  const productorPagos = useMemo(() => {
    if (!record) return [];
    const curp = (record.curp || '').toUpperCase().trim();
    const rfc = (record.rfc || '').toUpperCase().trim();
    const nombre = (record.ownerName || '').toUpperCase().trim();

    return paymentOrders.filter((order) => {
      if (curp && order.curp && order.curp.toUpperCase().trim() === curp) return true;
      if (rfc && order.rfc && order.rfc.toUpperCase().trim() === rfc) return true;
      if (nombre && order.taxpayerName && order.taxpayerName.toUpperCase().trim() === nombre) return true;
      return false;
    });
  }, [record, paymentOrders]);

  // Metricas de pagos
  const pagosMetrics = useMemo(() => {
    const pagado = productorPagos.filter((o) => o.status === 'PAID').reduce((s, o) => s + (o.amount || 0), 0);
    const pendiente = productorPagos.filter((o) => o.status === 'PENDING').reduce((s, o) => s + (o.amount || 0), 0);
    return { pagado, pendiente, total: productorPagos.length };
  }, [productorPagos]);

  if (!isOpen || !record) return null;

    // FASE_0_3: leer TODAS las fuentes posibles (Sheets crudo, Drive URLs, imagenes[])
  const imgIne = (record as any).ineDriveUrl
    || (record as any).url_ine
    || record.imagenes?.credencial_ine
    || (record as any).inePhoto;

  const imgFoto = (record as any).fotoTitularDriveUrl
    || (record as any).url_foto_titular
    || record.imagenes?.foto_titular
    || record.producerPhoto;

  const imgFirma = (record as any).firmaDriveUrl
    || (record as any).url_firma
    || record.imagenes?.firma
    || record.producerSignature;

  const imgFierro = (record as any).url_fierro
    || (record as any).fierroImageUrl
    || record.imagenes?.fierro_digitalizado
    || record.extractedBrandImage
    || record.imagen_base64;

  const imgFicha = (record as any).url_ficha || record.imagenes?.ficha_original;

  const vector = record.vector_64d || record.brandVector || [];
  const checksum = record.vector_checksum || record.hash_vector || (vector.length ? computeVectorChecksum(vector) : 'SIN-VECTOR');

  const imgCount = [imgIne, imgFoto, imgFirma, imgFierro, imgFicha].filter(Boolean).length;
  const hasVector = vector.length === 64;

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'imagenes', label: 'Imágenes', icon: <Camera className="w-4 h-4" />, badge: String(imgCount) },
    { id: 'vector', label: 'Vectorización', icon: <Hash className="w-4 h-4" />, badge: hasVector ? '64D' : '—' },
    { id: 'pagos', label: 'Historial Pagos', icon: <Receipt className="w-4 h-4" />, badge: String(pagosMetrics.total) },
    { id: 'antiduplicidad', label: 'Antiduplicidad', icon: <ShieldCheck className="w-4 h-4" />, badge: analysis ? `${(analysis as any)?.highestSimilarity}%` : '—' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden border-2 border-amber-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 block">
                Expediente Oficial · {record.isLocal ? 'Local/Histórico' : 'Municipal'}
              </span>
              <h3 className="text-sm sm:text-base font-cinzel font-bold text-amber-100">
                {record.ownerName}
              </h3>
              <p className="text-[11px] text-stone-300 font-mono-data">
                Folio: <strong className="text-amber-200">{record.folio}</strong> · REG: {record.registrationNumber || '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-stone-100 border-b border-stone-200 px-3 pt-2 shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white text-amber-900 border-x border-t border-stone-200 -mb-px'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                  activeTab === t.id ? 'bg-amber-100 text-amber-900' : 'bg-stone-200 text-stone-600'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-stone-50 p-4 sm:p-6">
          {/* TAB IMAGENES */}
          {activeTab === 'imagenes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider">
                  📸 Imágenes del Expediente ({imgCount}/6)
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* INE */}
                <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase text-stone-600 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      Credencial INE
                    </span>
                    {imgIne ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-stone-300" />}
                  </div>
                  <div className="aspect-[3/2] bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {imgIne ? (
                      <img src={imgIne} alt="INE" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-stone-400 text-xs">Sin imagen</span>
                    )}
                  </div>
                </div>

                {/* Foto titular */}
                <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase text-stone-600 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-purple-600" />
                      Foto Titular
                    </span>
                    {imgFoto ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-stone-300" />}
                  </div>
                  <div className="aspect-[3/4] bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center max-w-[180px] mx-auto">
                    {imgFoto ? (
                      <img src={imgFoto} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-stone-400 text-xs">Sin imagen</span>
                    )}
                  </div>
                </div>

                {/* Firma */}
                <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase text-stone-600 flex items-center gap-1.5">
                      <FileSignature className="w-3.5 h-3.5 text-amber-700" />
                      Firma Autógrafa
                    </span>
                    {imgFirma ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-stone-300" />}
                  </div>
                  <div className="aspect-[3/1] bg-white rounded-lg border border-dashed border-stone-300 overflow-hidden flex items-center justify-center">
                    {imgFirma ? (
                      <img src={imgFirma} alt="Firma" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-stone-400 text-xs">Sin firma</span>
                    )}
                  </div>
                </div>

                {/* Fierro */}
                <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase text-stone-600 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-stone-800" />
                      Fierro Quemador
                    </span>
                    {imgFierro ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-stone-300" />}
                  </div>
                  <div className="aspect-square bg-white rounded-lg border border-stone-300 overflow-hidden flex items-center justify-center max-w-[180px] mx-auto">
                    {imgFierro ? (
                      <img src={imgFierro} alt="Fierro" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-stone-400 text-xs">Sin fierro</span>
                    )}
                  </div>
                </div>

                {/* FIX_TARJETA_CERTIFICADO: Tarjeta del Certificado Oficial */}
                <div className="bg-white rounded-xl border-2 border-emerald-300 p-3 shadow-2xs sm:col-span-2 lg:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase text-emerald-800 flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-700" />
                      Certificado Oficial (Acta + CR-80)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                      DOCUMENTO PRINCIPAL
                    </span>
                  </div>
                  <div className="aspect-[16/10] bg-gradient-to-br from-emerald-50 to-amber-50 rounded-lg border border-emerald-200 overflow-hidden flex flex-col items-center justify-center gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-md">
                        <FileCheck2 className="w-8 h-8" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-stone-900 font-cinzel">
                          {record?.ownerName || 'Productor'}
                        </p>
                        <p className="text-[11px] text-stone-600 font-mono">
                          Folio: {record?.folio || '—'}
                        </p>
                        <p className="text-[11px] text-stone-600 font-mono">
                          REG: {record?.registrationNumber || '—'}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-stone-500 text-center max-w-md">
                      Documento oficial con Acta Certificada (Tamaño Carta) y Credencial Ganadera CR-80 (54 × 85.6 mm) listos para imprimir o enviar.
                    </p>
                  </div>
                  {onNavigateToCertificado && (
                    <button
                      type="button"
                      onClick={() => {
                        onLoadRecordIntoCertificate?.(record!);
                        onNavigateToCertificado();
                        onClose();
                      }}
                      className="mt-3 w-full px-4 py-2.5 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ring-2 ring-emerald-400/30 active:scale-98"
                      title="Abrir el Certificado Oficial completo con Acta y Credencial CR-80"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Ver Certificado Completo</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </button>
                  )}
                </div>

                {/* Ficha histórica */}
                <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs sm:col-span-2 lg:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase text-stone-600 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-stone-600" />
                      Ficha Original (Digitalización)
                    </span>
                    {imgFicha ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-stone-300" />}
                  </div>
                  <div className="aspect-[16/10] bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {imgFicha ? (
                      <img src={imgFicha} alt="Ficha" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-stone-400 text-xs">No aplica (registro de alta nueva)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB VECTOR */}
          {activeTab === 'vector' && (
            <div className="space-y-4">
              {!hasVector ? (
                <div className="p-8 text-center bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl">
                  <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-amber-950 mb-1">
                    Sin vector 64D registrado
                  </h4>
                  <p className="text-xs text-stone-600 max-w-md mx-auto">
                    Este registro no tiene un vector matematico. Se puede generar abriendo el Laboratorio de Forja desde la Hoja 4 y ejecutando la vectorizacion.
                  </p>
                </div>
              ) : (
                <>
                  {/* Metricas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-stone-200">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Checksum</span>
                      <span className="text-xs font-mono font-bold text-stone-900 break-all">{checksum}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-stone-200">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Densidad</span>
                      <span className="text-lg font-black text-amber-900">
                        {record.vector_density ? `${(record.vector_density * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-stone-200">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Simetría H/V</span>
                      <span className="text-sm font-bold text-stone-800">
                        {record.vector_symmetry_h?.toFixed(1) || '—'}% / {record.vector_symmetry_v?.toFixed(1) || '—'}%
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-stone-200">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Proporción</span>
                      <span className="text-sm font-mono font-bold text-stone-800">
                        {record.vector_proportions || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Matriz 8x8 */}
                  <div>
                    <span className="text-xs font-bold uppercase text-stone-700 block mb-2">
                      Matriz 8×8 (heatmap):
                    </span>
                    <div className="grid grid-cols-8 gap-1 p-3 bg-stone-100 rounded-xl border border-stone-200">
                      {vector.map((val: number, i: number) => {
                        const bgColor = val > 0.70 ? '#1c1917' : val >= 0.40 ? '#f59e0b' : '#ffffff';
                        const textColor = val > 0.70 ? '#ffffff' : val >= 0.40 ? '#ffffff' : '#94a3b8';
                        return (
                          <div
                            key={i}
                            style={{ backgroundColor: bgColor, color: textColor, height: '34px' }}
                            className="rounded flex items-center justify-center text-[9px] font-mono border border-stone-300"
                            title={`Celda #${i + 1}: ${val.toFixed(4)}`}
                          >
                            {val.toFixed(2)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB PAGOS */}
          {activeTab === 'pagos' && (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Pagado</span>
                  <span className="text-lg font-black text-emerald-900">
                    ${pagosMetrics.pagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Pendiente de Pago</span>
                  <span className="text-lg font-black text-amber-900">
                    ${pagosMetrics.pendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-300 rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-stone-600 block">Total Órdenes</span>
                  <span className="text-lg font-black text-stone-800">{pagosMetrics.total}</span>
                </div>
              </div>

              {/* Lista de pagos */}
              {loadingOrders ? (
                <div className="text-center py-8 text-sm text-stone-500">
                  <Clock className="w-6 h-6 mx-auto mb-2 animate-spin text-amber-700" />
                  Cargando pagos...
                </div>
              ) : productorPagos.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 border-2 border-dashed border-stone-300 rounded-2xl">
                  <Receipt className="w-12 h-12 text-stone-400 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-stone-700 mb-1">
                    Sin pagos registrados
                  </h4>
                  <p className="text-xs text-stone-500">
                    No hay órdenes de cobro vinculadas a este productor ({record.ownerName}).
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-100 text-stone-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3 text-left">Folio</th>
                        <th className="py-2 px-3 text-left">Fecha</th>
                        <th className="py-2 px-3 text-left">Conceptos</th>
                        <th className="py-2 px-3 text-right">Monto</th>
                        <th className="py-2 px-3 text-center">Estatus</th>
                        <th className="py-2 px-3 text-center">Recibo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {productorPagos.map((order, i) => (
                        <tr key={order.id || i} className="hover:bg-stone-50">
                          <td className="py-2 px-3 font-mono font-bold text-amber-900">{order.folio}</td>
                          <td className="py-2 px-3 text-stone-600 font-mono">{order.date}</td>
                          <td className="py-2 px-3 text-stone-700">
                            {order.concepts.map((c: string, j: number) => (
                              <span key={j} className="inline-block px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded text-[10px] mr-1 mb-0.5">
                                {c.replace(/^\d+\.\s*/, '')}
                              </span>
                            ))}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            ${(order.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {order.status === 'PAID' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">
                                <Check className="w-3 h-3" /> PAGADO
                              </span>
                            )}
                            {order.status === 'PENDING' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                                <Clock className="w-3 h-3" /> PENDIENTE
                              </span>
                            )}
                            {order.status === 'CANCELLED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900">
                                <XCircle className="w-3 h-3" /> CANCELADO
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* FASE_0_3_BLOQUE_D: Ver foto del recibo sellado (Cloudinary) */}
                              {order.urlReciboCloudinary ? (
                                <a
                                  href={order.urlReciboCloudinary}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer inline-flex items-center"
                                  title="Ver foto del recibo sellado (Cloudinary)"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <span className="p-1.5 text-stone-300" title="Sin foto de recibo">
                                  <Camera className="w-3.5 h-3.5" />
                                </span>
                              )}

                              {/* FASE_0_3_BLOQUE_D: Ver recibo PDF (Drive) */}
                              {order.urlReciboDrive ? (
                                <a
                                  href={order.urlReciboDrive}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors cursor-pointer inline-flex items-center"
                                  title="Ver recibo PDF oficial (Drive)"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <span className="p-1.5 text-stone-300" title="Sin PDF del recibo">
                                  <Eye className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Boton crear nueva orden */}
              {onCreatePaymentOrder && (
                <button
                  type="button"
                  onClick={() => {
                    onCreatePaymentOrder(record);
                    onClose();
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Generar Nueva Orden de Cobro</span>
                </button>
              )}
            </div>
          )}

          {/* TAB ANTIDUPLICIDAD */}
          {activeTab === 'antiduplicidad' && (
            <div className="space-y-4">
              {!analysis ? (
                <div className="p-8 text-center bg-stone-50 border-2 border-dashed border-stone-300 rounded-2xl">
                  <ShieldAlert className="w-12 h-12 text-stone-400 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-stone-700 mb-1">
                    Sin análisis disponible
                  </h4>
                  <p className="text-xs text-stone-500">
                    Este registro no tiene vector para comparar.
                  </p>
                </div>
              ) : (
                <>
                  {/* Banner de veredicto */}
                  <div className={`p-4 rounded-xl border-2 flex items-start gap-3 ${
                    analysis.hasAnyMatch
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-emerald-50 border-emerald-300'
                  }`}>
                    {analysis.hasAnyMatch ? (
                      <AlertTriangle className="w-8 h-8 text-amber-700 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-8 h-8 text-emerald-700 shrink-0" />
                    )}
                    <div>
                      <h4 className={`text-base font-bold ${analysis.hasAnyMatch ? 'text-amber-950' : 'text-emerald-950'}`}>
                        {analysis.hasAnyMatch
                          ? '⚠️ Posibles Coincidencias Detectadas'
                          : '✅ Libre de Registro · Fierro Único'}
                      </h4>
                      <p className={`text-xs mt-1 ${analysis.hasAnyMatch ? 'text-amber-900' : 'text-emerald-900'}`}>
                        {analysis.hasAnyMatch
                          ? `Se encontraron ${analysis.matches.length} registros con similitud ≥ 75%.`
                          : `No hay duplicados. Similitud máxima: ${analysis.topMatch?.similarityPct || 0}%.`}
                      </p>
                      <p className="text-[10px] text-stone-500 mt-1">
                        Comparado contra {analysis.comparedCount} registros del padrón municipal.
                      </p>
                    </div>
                  </div>

                  {/* Lista de matches */}
                  {analysis.matches && analysis.matches.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-stone-700 uppercase">
                        Top coincidencias ({analysis.matches.length}):
                      </h4>
                      {analysis.matches.slice(0, 5).map((match, i) => (
                        <div key={i} className="bg-white p-3 rounded-xl border border-stone-200 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-stone-900 truncate">
                              {match.candidate.ownerName}
                            </p>
                            <p className="text-[11px] text-stone-500 font-mono">
                              {match.candidate.folio} · {match.candidate.propertyName}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono ${
                              match.similarityPct >= 90
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}>
                              {match.similarityPct}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-stone-100 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-stone-500 font-mono">
            Folio: {record.folio} · Última actualización: {record.issueDate || '—'}
          </span>
          <div className="flex items-center gap-2">
            {onLoadRecordIntoCertificate && (
              <button
                type="button"
                onClick={() => {
                  onLoadRecordIntoCertificate(record);
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Ver / Cargar en Certificado</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
