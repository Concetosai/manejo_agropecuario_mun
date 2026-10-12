import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Printer,
  DollarSign,
  Loader2,
  User,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { MunicipalConfig, MunicipalUser, PreloadedOrderData } from '../../types';
import {
  buscarPropietarioEnSheet,
  revalidarRegistroEnSheet,
  GoogleRegistro,
} from '../../services/googleSheetsService';
import { recordAuditLog } from '../../utils/auditAuth';

interface RevalidacionViewProps {
  onBack: () => void;
  onGoToFinance: (category?: 'REVALIDACION', preloaded?: PreloadedOrderData) => void;
  municipalConfig: MunicipalConfig;
  currentUser: MunicipalUser;
}

const REVALIDATION_FEE = 350;
const LATE_FEE = 150;
const CERTIFICATE_FEE = 180;

/**
 * Calcula la nueva vigencia sumando 3 años a la vigencia actual.
 * Formato esperado: "2023-2026" o "2026 - 2029"
 */
function calcularNuevaVigencia(vigenciaActual?: string): string {
  const añoActual = new Date().getFullYear();
  const añoFinal = añoActual + 3;

  if (!vigenciaActual) {
    return `${añoActual}-${añoFinal}`;
  }

  // Intentar extraer el año final de la vigencia actual
  const match = String(vigenciaActual).match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (match && match[2]) {
    const finalActual = parseInt(match[2], 10);
    // Si el año final de la vigencia es >= al año actual, sumar 3 años
    if (finalActual >= añoActual) {
      return `${finalActual}-${finalActual + 3}`;
    }
  }

  // Fallback: usar año actual + 3
  return `${añoActual}-${añoFinal}`;
}

export const RevalidacionView: React.FC<RevalidacionViewProps> = ({
  onBack,
  onGoToFinance,
  municipalConfig,
  currentUser,
}) => {
  // Búsqueda
  const [folioQuery, setFolioQuery] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [fierroEncontrado, setFierroEncontrado] = useState<GoogleRegistro | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  // Opciones de cobro
  const [includeLateFee, setIncludeLateFee] = useState(false);
  const [includeCertificate, setIncludeCertificate] = useState(true);

  // Estados de emisión
  const [isGeneratingOrder, setIsGeneratingOrder] = useState(false);
  const [createdOrderFolio, setCreatedOrderFolio] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fierroValidado = fierroEncontrado !== null;

  // Nueva vigencia calculada
  const nuevaVigencia = useMemo(() => {
    return calcularNuevaVigencia(fierroEncontrado?.vigencia);
  }, [fierroEncontrado]);

  // Monto total
  const totalAmount = useMemo(() => {
    let sum = REVALIDATION_FEE;
    if (includeLateFee) sum += LATE_FEE;
    if (includeCertificate) sum += CERTIFICATE_FEE;
    return sum;
  }, [includeLateFee, includeCertificate]);

  // =========================================================================
  // BUSCAR FIERRO
  // =========================================================================
  const handleBuscarFolio = async () => {
    const q = folioQuery.trim();
    if (!q) {
      setErrorBusqueda('Ingrese un folio, CURP o RFC para buscar');
      return;
    }

    setBuscando(true);
    setErrorBusqueda(null);
    setFierroEncontrado(null);
    setCreatedOrderFolio(null);

    try {
      const result = await buscarPropietarioEnSheet(q);

      if (result.success && result.registro) {
        const r = result.registro;

        // Bloquear si está cancelado
        if (r.estatus === 'CANCELADO') {
          setErrorBusqueda(
            `El fierro ${r.folio} está CANCELADO (${r.motivo_baja || 'sin motivo'}). No se puede revalidar.`
          );
          setBuscando(false);
          return;
        }

        setFierroEncontrado(r);

        // Autoactivar multa si la vigencia ya venció
        const añoActual = new Date().getFullYear();
        const match = String(r.vigencia || '').match(/(\d{4})\s*[-–]\s*(\d{4})/);
        if (match && match[2]) {
          const finalVig = parseInt(match[2], 10);
          if (finalVig < añoActual) {
            setIncludeLateFee(true);
          }
        }

        setAlertMsg({
          type: 'success',
          text: `Fierro encontrado: ${r.folio} — ${r.nombre_productor}`,
        });
        setTimeout(() => setAlertMsg(null), 4000);
      } else {
        setErrorBusqueda(result.error || 'No se encontró el fierro. Verifique el folio, CURP o RFC.');
      }
    } catch (err: any) {
      setErrorBusqueda('Error de conexión: ' + (err.message || 'desconocido'));
    } finally {
      setBuscando(false);
    }
  };

  // =========================================================================
  // GENERAR ORDEN DE REVALIDACIÓN (CABLEADO)
  // =========================================================================
  const handleGeneratePaymentOrder = async () => {
    if (!fierroValidado || !fierroEncontrado) {
      setAlertMsg({
        type: 'error',
        text: 'Primero debe buscar y validar un fierro existente en el padrón.',
      });
      setTimeout(() => setAlertMsg(null), 4000);
      return;
    }

    setIsGeneratingOrder(true);
    setAlertMsg(null);

    try {
      // 1) Llamar al endpoint revalidarRegistro
      const revalidacionResult = await revalidarRegistroEnSheet({
        folio: fierroEncontrado.folio || '',
        fecha_nueva_vigencia: nuevaVigencia,
        operador: currentUser.fullName,
      });

      if (!revalidacionResult.success) {
        setAlertMsg({
          type: 'error',
          text: 'Error al revalidar: ' + (revalidacionResult.error || 'desconocido'),
        });
        setIsGeneratingOrder(false);
        return;
      }

      // 2) Audit log
      recordAuditLog({
        actionType: 'REGISTRO_MODIFICADO',
        folioAffected: fierroEncontrado.folio || '',
        producerAffected: fierroEncontrado.nombre_productor || '',
        details: `Revalidación 2026 ejecutada. Nueva vigencia: ${nuevaVigencia}. Multa: ${includeLateFee ? 'SÍ' : 'NO'}. Constancia: ${includeCertificate ? 'SÍ' : 'NO'}. Total: $${totalAmount}.00 MXN.`,
      });

      setAlertMsg({
        type: 'success',
        text: `✅ Fierro revalidado. Nueva vigencia: ${nuevaVigencia}`,
      });

      // 3) Preparar conceptos para FinanceManager
      const concepts = ['2. REVALIDACION FIERRO QUEMADOR'];
      if (includeLateFee) concepts.push('3. MULTA POR PAGO EXTEMPORANEO');
      if (includeCertificate) concepts.push('5. PAGO DE CONSTANCIA');

      const payload: PreloadedOrderData = {
        nombreContribuyente: (fierroEncontrado.nombre_productor || '').toUpperCase(),
        domicilioContribuyente: `${fierroEncontrado.predio ? `${fierroEncontrado.predio} - ` : ''}Ejido ${fierroEncontrado.ejido || ''}, Pánuco, Ver.`,
        rfc: fierroEncontrado.rfc || '',
        curp: fierroEncontrado.curp || '',
        folio: fierroEncontrado.folio || '',
        conceptosSeleccionados: concepts,
        montoTotal: totalAmount,
        ejercicioFiscal: '2026-2029',
        periodo: 'OCTUBRE 2026',
        fechaExpedicion: new Date().toISOString().split('T')[0],
        tramiteOrigen: 'REVALIDACION',
        notas: `Revalidación anual 2026 de fierro "${fierroEncontrado.iniciales}" (Folio: ${fierroEncontrado.folio}). Nueva vigencia: ${nuevaVigencia}.${includeLateFee ? ' Incluye multa por extemporáneo.' : ''}${includeCertificate ? ' Incluye constancia de refrendo.' : ''}`,
      };

      // 4) Redirigir a FinanceManager
      setTimeout(() => {
        onGoToFinance('REVALIDACION', payload);
      }, 1500);

    } catch (err: any) {
      setAlertMsg({
        type: 'error',
        text: 'Excepción: ' + (err.message || 'desconocido'),
      });
    } finally {
      setIsGeneratingOrder(false);
    }
  };

  // =========================================================================
  // LIMPIAR
  // =========================================================================
  const handleLimpiar = () => {
    setFolioQuery('');
    setFierroEncontrado(null);
    setErrorBusqueda(null);
    setIncludeLateFee(false);
    setIncludeCertificate(true);
    setCreatedOrderFolio(null);
  };

  return (
    <div className="min-h-[85vh] bg-stone-100 py-6 px-3 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer shrink-0"
            >
              <ArrowLeft size={16} />
              <span>Volver al Hub</span>
            </button>
            <div className="h-8 w-px bg-stone-200" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase tracking-wider">
                  Trámite 2 de 5 · Tesorería Pánuco
                </span>
                <span className="text-xs font-mono font-bold text-stone-400">Ejercicio Fiscal 2026</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 font-cinzel tracking-tight mt-0.5">
                Revalidación y Refrendo de Fierro Quemador
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onGoToFinance('REVALIDACION')}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <DollarSign size={14} className="text-amber-400" />
            <span>Ver Órdenes en Finanzas</span>
          </button>
        </div>

        {/* Alert */}
        {alertMsg && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-semibold ${
              alertMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                : 'bg-rose-50 text-rose-950 border-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {alertMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{alertMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlertMsg(null)}
              className="text-stone-500 hover:text-stone-800 font-bold ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Buscador */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Search size={16} className="text-blue-600" />
                <span>1. Localizar Titular en el Padrón</span>
              </h2>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-700 block">
                  Folio, CURP o RFC del fierro:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={folioQuery}
                      onChange={(e) => setFolioQuery(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarFolio(); }}
                      placeholder="Ej. PAN-2026-04293"
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={buscando}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBuscarFolio}
                    disabled={buscando || !folioQuery.trim()}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {buscando ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Buscando...</span>
                      </>
                    ) : (
                      <>
                        <Search size={14} />
                        <span>Buscar</span>
                      </>
                    )}
                  </button>
                  {(fierroEncontrado || errorBusqueda) && (
                    <button
                      type="button"
                      onClick={handleLimpiar}
                      className="px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="Limpiar búsqueda"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {errorBusqueda && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
                    <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-rose-900 font-medium">{errorBusqueda}</span>
                  </div>
                )}

                {fierroValidado && fierroEncontrado && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-700" />
                      <strong className="text-xs font-bold text-emerald-900">
                        Fierro validado: {fierroEncontrado.folio}
                      </strong>
                      {fierroEncontrado.estatus && (
                        <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          {fierroEncontrado.estatus}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      {fierroEncontrado.nombre_productor}
                    </p>
                  </div>
                )}
              </div>

              {/* Info del fierro (mini profile) */}
              {fierroValidado && fierroEncontrado && (
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center font-cinzel font-black text-sm shadow-inner shrink-0">
                      {fierroEncontrado.iniciales || '??'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-900 truncate">{fierroEncontrado.nombre_productor}</p>
                      <p className="text-[10px] text-stone-500 truncate">
                        {fierroEncontrado.predio || 'Sin predio'} · Ejido {fierroEncontrado.ejido || 'N/D'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200 text-[10px]">
                    <div>
                      <span className="text-stone-400 uppercase font-bold block">UPP</span>
                      <span className="font-mono font-bold text-stone-800">{fierroEncontrado.upp || 'N/D'}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 uppercase font-bold block">RFC</span>
                      <span className="font-mono font-bold text-stone-800">{fierroEncontrado.rfc || 'N/D'}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 uppercase font-bold block">Censo</span>
                      <span className="font-bold text-stone-800">{fierroEncontrado.cantidad_ganado || '0'} cabezas</span>
                    </div>
                    <div>
                      <span className="text-stone-400 uppercase font-bold block">Superficie</span>
                      <span className="font-bold text-stone-800">{fierroEncontrado.superficie || '0'} has</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Liquidación */}
          <div className="lg:col-span-7 space-y-4">
            {fierroValidado && fierroEncontrado ? (
              <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-6">
                {/* Profile Header */}
                <div className="flex items-center justify-between pb-5 border-b border-stone-100">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 text-amber-400 flex items-center justify-center font-cinzel font-black text-xl shadow-md shrink-0 border border-amber-500/30">
                      {fierroEncontrado.iniciales || '??'}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-stone-900 font-cinzel">
                        {fierroEncontrado.nombre_productor}
                      </h3>
                      <p className="text-xs text-stone-600">
                        {fierroEncontrado.predio || 'Sin predio'} · Ejido {fierroEncontrado.ejido || 'N/D'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 uppercase font-bold block">Vigencia Actual:</span>
                    <span className="text-xs font-mono font-bold text-stone-800">
                      {fierroEncontrado.vigencia || 'N/D'}
                    </span>
                  </div>
                </div>

                {/* Nueva vigencia calculada */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2.5">
                  <Calendar size={16} className="text-emerald-700 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">Nueva Vigencia (Calculada):</span>
                    <span className="font-mono font-extrabold text-emerald-900 text-sm">{nuevaVigencia}</span>
                  </div>
                </div>

                {/* Conceptos */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Liquidación de Derechos Fiscales 2026:
                  </h4>

                  <div className="space-y-2">
                    <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={16} className="text-blue-600" />
                        <div>
                          <p className="font-bold text-stone-900">Revalidación Anual de Fierro Quemador</p>
                          <p className="text-[10px] text-stone-500">Cuota Reglamentaria Ejercicio 2026</p>
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-stone-900">${REVALIDATION_FEE}.00</span>
                    </div>

                    <label className="p-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 flex items-center justify-between text-xs cursor-pointer transition-colors">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={includeLateFee}
                          onChange={(e) => setIncludeLateFee(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-stone-900">Multa por Pago Extemporáneo</p>
                          <p className="text-[10px] text-stone-500">Aplicable si el plazo reglamentario venció</p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-stone-700">+${LATE_FEE}.00</span>
                    </label>

                    <label className="p-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 flex items-center justify-between text-xs cursor-pointer transition-colors">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={includeCertificate}
                          onChange={(e) => setIncludeCertificate(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-stone-900">Emisión de Constancia Oficial de Refrendo</p>
                          <p className="text-[10px] text-stone-500">Formato membretado y sellado para tránsito</p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-stone-700">+${CERTIFICATE_FEE}.00</span>
                    </label>
                  </div>

                  {/* Total Bar */}
                  <div className="p-4 rounded-xl bg-stone-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">
                        Total Liquidación Tesorería:
                      </span>
                      <span className="text-xl font-mono font-extrabold text-amber-400">
                        ${totalAmount}.00 MXN
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGeneratePaymentOrder}
                        disabled={isGeneratingOrder}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {isGeneratingOrder ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Revalidando...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={16} />
                            <span>Revalidar y Generar Orden</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPrintModal(true)}
                        className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Imprimir Tarjetón"
                      >
                        <Printer size={16} />
                        <span>Tarjetón</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-stone-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <RefreshCw size={24} />
                </div>
                <h3 className="text-base font-bold text-stone-800">Seleccione un Registro Ganadero</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Utilice el buscador de la izquierda para seleccionar al titular a quien se aplicará el refrendo anual y liquidación fiscal.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Tarjetón */}
        {showPrintModal && fierroEncontrado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border-2 border-stone-800 shadow-2xl space-y-6">
              <div className="text-center space-y-1 border-b border-stone-200 pb-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-900">
                  {municipalConfig.municipalityName}
                </span>
                <h2 className="text-lg font-black font-cinzel text-stone-900">
                  CONSTANCIA Y TARJETÓN DE REVALIDACIÓN 2026
                </h2>
                <p className="text-xs text-stone-500">Dirección de Fomento Agropecuario y Desarrollo Rural</p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-300 rounded-2xl space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Titular del Fierro:</span>
                  <strong className="text-stone-900 font-bold">{fierroEncontrado.nombre_productor}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Monograma Oficial:</span>
                  <strong className="text-amber-800 font-cinzel font-black text-base">{fierroEncontrado.iniciales}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Predio y Ejido:</span>
                  <span>{fierroEncontrado.predio}, Ejido {fierroEncontrado.ejido}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Folio de Registro:</span>
                  <span className="font-mono font-bold text-stone-800">{fierroEncontrado.folio}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Nuevo Periodo Vigente:</span>
                  <span className="font-mono font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    {nuevaVigencia} (Refrendado)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Imprimir Tarjetón</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};