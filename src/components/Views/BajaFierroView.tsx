import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  FileX,
  Printer,
  DollarSign,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Fingerprint,
} from 'lucide-react';
import { MunicipalConfig, MunicipalUser, PreloadedOrderData } from '../../types';
import {
  buscarPropietarioEnSheet,
  cancelarRegistroEnSheet,
  GoogleRegistro,
} from '../../services/googleSheetsService';
import { recordAuditLog } from '../../utils/auditAuth';
import { BiometricVerificationModal } from '../Biometrics/BiometricVerificationModal';

interface BajaFierroViewProps {
  onBack: () => void;
  onGoToFinance: (category?: 'BAJA', preloaded?: PreloadedOrderData) => void;
  municipalConfig: MunicipalConfig;
  currentUser: MunicipalUser;
}

// FEATURE FLAG: biometría desactivada por el momento
const BIOMETRIA_ENABLED = false;

const BAJA_FEE = 200;

const MOTIVOS_BAJA = [
  'DEFUNCION_DEL_TITULAR',
  'CESION_DE_DERECHOS_PECUARIOS',
  'VENTA_TOTAL_DE_HATO_GANADERO',
  'CAMBIO_DE_RESIDENCIA',
  'DESISTIMIENTO_VOLUNTARIO',
  'RESOLUCION_O_SENTENCIA_AGRARIA',
];

const MOTIVOS_LABEL: Record<string, string> = {
  'DEFUNCION_DEL_TITULAR': 'DEFUNCIÓN DEL TITULAR',
  'CESION_DE_DERECHOS_PECUARIOS': 'CESIÓN DE DERECHOS PECUARIOS',
  'VENTA_TOTAL_DE_HATO_GANADERO': 'VENTA TOTAL DE HATO GANADERO',
  'CAMBIO_DE_RESIDENCIA': 'CAMBIO DE RESIDENCIA / MUNICIPIO',
  'DESISTIMIENTO_VOLUNTARIO': 'DESISTIMIENTO VOLUNTARIO',
  'RESOLUCION_O_SENTENCIA_AGRARIA': 'RESOLUCIÓN O SENTENCIA AGRARIA',
};

export const BajaFierroView: React.FC<BajaFierroViewProps> = ({
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

  // Formulario de baja
  const [bajaReason, setBajaReason] = useState(MOTIVOS_BAJA[0]);
  const [supportingDocument, setSupportingDocument] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [applicantRole, setApplicantRole] = useState('HEREDERO / ALBACEA');
  const [notes, setNotes] = useState(
    'Trámite de baja definitiva por sucesión y entrega de fierro físico a la tesorería.'
  );

  // Estados de emisión
  const [isGeneratingOrder, setIsGeneratingOrder] = useState(false);
  const [createdOrderFolio, setCreatedOrderFolio] = useState<string | null>(null);
  const [showActaModal, setShowActaModal] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Biometría (desactivada por ahora)
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [biometricAuthorizedToken, setBiometricAuthorizedToken] = useState<string | null>(null);

  const fierroValidado = fierroEncontrado !== null;

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

        // Bloquear si ya está cancelado
        if (r.estatus === 'CANCELADO') {
          setErrorBusqueda(
            `El fierro ${r.folio} YA ESTÁ CANCELADO (${r.motivo_baja || 'sin motivo especificado'}). No se puede dar de baja nuevamente.`
          );
          setBuscando(false);
          return;
        }

        setFierroEncontrado(r);
        setApplicantName(r.nombre_productor || '');

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
  // GENERAR ORDEN DE BAJA (CABLEADO A SHEETS)
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

    if (!applicantName.trim()) {
      setAlertMsg({
        type: 'error',
        text: 'Falta el nombre del promovente / solicitante.',
      });
      setTimeout(() => setAlertMsg(null), 4000);
      return;
    }

    setIsGeneratingOrder(true);
    setAlertMsg(null);

    try {
      // 1) Llamar al endpoint cancelarRegistro
      const cancelacionResult = await cancelarRegistroEnSheet({
        folio: fierroEncontrado.folio || '',
        motivo: bajaReason,
        operador: currentUser.fullName,
      });

      if (!cancelacionResult.success) {
        setAlertMsg({
          type: 'error',
          text: 'Error al dar de baja: ' + (cancelacionResult.error || 'desconocido'),
        });
        setIsGeneratingOrder(false);
        return;
      }

      // 2) Generar folio local de orden (FinanceManager lo reemplazará)
      const folioOrden = 'BAJA-' + Date.now().toString().slice(-8);
      setCreatedOrderFolio(folioOrden);

      // 3) Audit log
      recordAuditLog({
        actionType: 'CANCELACION_DOCUMENTO',
        folioAffected: fierroEncontrado.folio || '',
        producerAffected: fierroEncontrado.nombre_productor || '',
        details: `Baja definitiva de fierro "${fierroEncontrado.iniciales}" (Folio: ${fierroEncontrado.folio}). Causa: ${MOTIVOS_LABEL[bajaReason] || bajaReason}. Promovente: ${applicantName} (${applicantRole}). Documento: ${supportingDocument || 'No especificado'}.`,
      });

      setAlertMsg({
        type: 'success',
        text: `✅ Fierro ${fierroEncontrado.folio} marcado como CANCELADO correctamente.`,
      });

      // 4) Preparar payload para FinanceManager
      const payload: PreloadedOrderData = {
        nombreContribuyente: applicantName.toUpperCase(),
        domicilioContribuyente: `${fierroEncontrado.predio ? `${fierroEncontrado.predio} - ` : ''}Ejido ${fierroEncontrado.ejido || ''}, Pánuco, Ver.`,
        rfc: fierroEncontrado.rfc || '',
        curp: fierroEncontrado.curp || '',
        folio: fierroEncontrado.folio || '',
        conceptosSeleccionados: ['6. BAJA DE FIERRO QUEMADOR'],
        montoTotal: BAJA_FEE,
        ejercicioFiscal: '2026-2029',
        periodo: 'OCTUBRE 2026',
        fechaExpedicion: new Date().toISOString().split('T')[0],
        tramiteOrigen: 'BAJA',
        notas: `Baja definitiva de fierro "${fierroEncontrado.iniciales}" (Folio: ${fierroEncontrado.folio}, Causa: ${MOTIVOS_LABEL[bajaReason] || bajaReason}). Promovente: ${applicantName} (${applicantRole}). Doc: ${supportingDocument}.`,
      };

      // 5) Redirigir a FinanceManager
      setTimeout(() => {
        onGoToFinance('BAJA', payload);
      }, 1500);

    } catch (err: any) {
      setAlertMsg({
        type: 'error',
        text: 'Excepción al dar de baja: ' + (err.message || 'desconocido'),
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
    setBajaReason(MOTIVOS_BAJA[0]);
    setSupportingDocument('');
    setApplicantName('');
    setApplicantRole('HEREDERO / ALBACEA');
    setNotes('Trámite de baja definitiva por sucesión y entrega de fierro físico a la tesorería.');
    setCreatedOrderFolio(null);
    setBiometricAuthorizedToken(null);
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
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold uppercase tracking-wider">
                  Trámite 3 de 5 · Tesorería Pánuco
                </span>
                <span className="text-xs font-mono font-bold text-stone-400">Cancelación Registral</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 font-cinzel tracking-tight mt-0.5">
                Baja y Cancelación de Fierro Quemador
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onGoToFinance('BAJA')}
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
                <Search size={16} className="text-rose-600" />
                <span>1. Buscar Fierro Activo a Dar de Baja</span>
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
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      disabled={buscando}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBuscarFolio}
                    disabled={buscando || !folioQuery.trim()}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
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
                </div>

                {(fierroEncontrado || errorBusqueda) && (
                  <button
                    type="button"
                    onClick={handleLimpiar}
                    className="w-full px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Limpiar búsqueda
                  </button>
                )}

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
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        {fierroEncontrado.estatus || 'ACTIVO'}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      {fierroEncontrado.nombre_productor} · {fierroEncontrado.predio || 'Sin predio'}
                    </p>
                  </div>
                )}
              </div>

              {/* Mini profile */}
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
                      <span className="text-stone-400 uppercase font-bold block">Folio Pecuario</span>
                      <span className="font-mono font-bold text-stone-800">{fierroEncontrado.numero_registro || 'N/D'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Formulario de Baja */}
          <div className="lg:col-span-7 space-y-4">
            {fierroValidado && fierroEncontrado ? (
              <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-6">
                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-100">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-stone-900 to-rose-950 text-amber-400 flex items-center justify-center font-cinzel font-black text-xl shadow-md shrink-0 border border-rose-500/30">
                      {fierroEncontrado.iniciales || '??'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          En Proceso de Baja
                        </span>
                        <span className="text-xs font-mono font-bold text-stone-500">{fierroEncontrado.folio}</span>
                      </div>
                      <h3 className="text-lg font-bold text-stone-900 font-cinzel mt-0.5">
                        {fierroEncontrado.nombre_productor}
                      </h3>
                      <p className="text-xs text-stone-600">
                        {fierroEncontrado.predio || 'Sin predio'} · Ejido {fierroEncontrado.ejido || 'N/D'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 uppercase font-bold block">Folio Pecuario:</span>
                    <span className="text-xs font-mono font-bold text-stone-800">
                      {fierroEncontrado.numero_registro || fierroEncontrado.folio}
                    </span>
                  </div>
                </div>

                {/* Formulario */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    2. Causa Legal y Documentación de Soporte:
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Causa Principal de la Baja: *
                      </label>
                      <select
                        value={bajaReason}
                        onChange={(e) => setBajaReason(e.target.value.toUpperCase())}
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        {MOTIVOS_BAJA.map((m) => (
                          <option key={m} value={m}>{MOTIVOS_LABEL[m]}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Documento Probatorio / Expediente:
                      </label>
                      <input
                        type="text"
                        value={supportingDocument}
                        onChange={(e) => setSupportingDocument(e.target.value.toUpperCase())}
                        placeholder="Ej. Acta Defunción 402/2026, Escritura..."
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Nombre del Promovente / Solicitante: *
                      </label>
                      <input
                        type="text"
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value.toUpperCase())}
                        placeholder="Nombre completo..."
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Personalidad Jurídica:
                      </label>
                      <select
                        value={applicantRole}
                        onChange={(e) => setApplicantRole(e.target.value.toUpperCase())}
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="TITULAR DEL REGISTRO">TITULAR DEL REGISTRO</option>
                        <option value="HEREDERO / ALBACEA">HEREDERO / ALBACEA</option>
                        <option value="CESIONARIO">CESIONARIO</option>
                        <option value="APODERADO LEGAL">APODERADO LEGAL</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      Observaciones Oficiales y Destino del Fierro Físico:
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.toUpperCase())}
                      rows={2}
                      className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {/* Total y Acciones */}
                  <div className="p-4 rounded-xl bg-stone-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">
                        Derecho por Baja de Fierro Quemador:
                      </span>
                      <span className="text-xl font-mono font-extrabold text-amber-400">
                        ${BAJA_FEE}.00 MXN
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Botón biometría: solo si feature flag está activo */}
                      {BIOMETRIA_ENABLED && (
                        <button
                          type="button"
                          onClick={() => setIsBiometricModalOpen(true)}
                          className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Fingerprint size={16} className="text-stone-900" />
                          <span>
                            {biometricAuthorizedToken ? 'Baja Autorizada Biométricamente' : 'Autorizar con Huella'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleGeneratePaymentOrder}
                        disabled={isGeneratingOrder || !applicantName.trim()}
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {isGeneratingOrder ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Procesando Baja...</span>
                          </>
                        ) : (
                          <>
                            <DollarSign size={16} />
                            <span>Dar de Baja y Generar Orden</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowActaModal(true)}
                        className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Imprimir Acta Oficial"
                      >
                        <Printer size={16} />
                        <span>Acta</span>
                      </button>
                    </div>
                  </div>

                  {/* Success */}
                  {createdOrderFolio && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                        <div>
                          <strong>Fierro dado de baja correctamente</strong>
                          <p className="text-[11px] text-emerald-800">
                            Registro marcado como CANCELADO. Orden de cobro en proceso...
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onGoToFinance('BAJA')}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
                      >
                        Ver en Finanzas
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-stone-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <FileX size={24} />
                </div>
                <h3 className="text-base font-bold text-stone-800">Seleccione un Registro a Cancelar</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Localice en el buscador de la izquierda al ganadero cuya patente o fierro quemador será dado de baja en el padrón municipal.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Acta Oficial de Baja */}
        {showActaModal && fierroEncontrado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border-2 border-stone-800 shadow-2xl space-y-6">
              <div className="text-center space-y-1 border-b border-stone-200 pb-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-900">
                  {municipalConfig.municipalityName}
                </span>
                <h2 className="text-lg font-black font-cinzel text-stone-900">
                  ACTA DE CANCELACIÓN Y BAJA DE FIERRO QUEMADOR
                </h2>
                <p className="text-xs text-stone-500">Dirección de Fomento Agropecuario · Tesorería Municipal</p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-300 rounded-2xl space-y-3 text-xs leading-relaxed text-stone-700">
                <p>
                  En la ciudad de <strong>Pánuco, Veracruz</strong>, se hace constar la <strong>CANCELACIÓN DEFINITIVA</strong> del registro de fierro quemador correspondiente a:
                </p>
                <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-1 font-mono text-[11px]">
                  <div><strong>Titular:</strong> {fierroEncontrado.nombre_productor}</div>
                  <div><strong>Folio:</strong> {fierroEncontrado.folio} | <strong>Monograma:</strong> {fierroEncontrado.iniciales}</div>
                  <div><strong>Predio:</strong> {fierroEncontrado.predio}, Ejido {fierroEncontrado.ejido}</div>
                  <div><strong>Causa:</strong> {MOTIVOS_LABEL[bajaReason] || bajaReason}</div>
                  <div><strong>Promovente:</strong> {applicantName} ({applicantRole})</div>
                </div>
                <p className="text-[11px] text-stone-500 italic">
                  Con fundamento en la Ley Ganadera del Estado de Veracruz, el fierro de herrar queda deshabilitado del padrón pecuario municipal para efectos legales.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowActaModal(false)}
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
                  <span>Imprimir Acta Oficial</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Biométrico (solo si está habilitado) */}
        {BIOMETRIA_ENABLED && (
          <BiometricVerificationModal
            currentUser={currentUser}
            isOpen={isBiometricModalOpen}
            onClose={() => setIsBiometricModalOpen(false)}
            actionTitle="Autorización Biométrica de Baja Registral"
            actionDescription={`Coloque su dedo sobre el sensor para validar la cancelación jurídica definitiva del fierro con folio ${fierroEncontrado?.folio || 'N/A'}.`}
            onSuccess={(result) => {
              setBiometricAuthorizedToken(result.sessionToken || 'AUTH-OK');
              setIsBiometricModalOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
};