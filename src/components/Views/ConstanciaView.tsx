import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Award,
  Printer,
  DollarSign,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { MunicipalConfig, MunicipalUser, ProducerData, PreloadedOrderData } from '../../types';
import { PANUCO_EJIDOS } from '../../utils/database';
import {
  buscarPropietarioEnSheet,
  emitirConstanciaEnSheet,
  GoogleRegistro,
} from '../../services/googleSheetsService';
import { recordAuditLog } from '../../utils/auditAuth';

interface ConstanciaViewProps {
  onBack: () => void;
  onGoToFinance: (category?: 'CONSTANCIA', preloaded?: PreloadedOrderData) => void;
  municipalConfig: MunicipalConfig;
  currentUser: MunicipalUser;
  currentProducer?: ProducerData;
}

const CONSTANCIA_TYPES = [
  {
    id: 'propiedad',
    title: 'Constancia de Propiedad y Registro de Fierro Quemador',
    amount: 180,
    concept: '5. PAGO DE CONSTANCIA',
    apiTipo: 'CONSTANCIA' as const,
    description: 'Acredita la legítima posesión y uso exclusivo del fierro de herrar registrado en el padrón.',
  },
  {
    id: 'reposicion',
    title: 'Reposición por Patente o Título Extraviado',
    amount: 250,
    concept: '4. REPOSICION POR PATENTE EXTRAVIADA',
    apiTipo: 'REPOSICION_PATENTE' as const,
    description: 'Emisión de duplicado oficial con certificación municipal por extravío o deterioro del título original.',
  },
  {
    id: 'productor_activo',
    title: 'Constancia de Productor Pecuario Activo y Censo',
    amount: 180,
    concept: '5. PAGO DE CONSTANCIA',
    apiTipo: 'CONSTANCIA' as const,
    description: 'Certifica la actividad ganadera continua, predio y cabezas de ganado para trámites de crédito o apoyo.',
  },
  {
    id: 'no_afectacion',
    title: 'Constancia de Marca Única y No Afectación Ganadera',
    amount: 180,
    concept: '5. PAGO DE CONSTANCIA',
    apiTipo: 'CONSTANCIA' as const,
    description: 'Certifica la no duplicidad y pleno registro ante la Dirección de Fomento Agropecuario.',
  },
];

export const ConstanciaView: React.FC<ConstanciaViewProps> = ({
  onBack,
  onGoToFinance,
  municipalConfig,
  currentUser,
  currentProducer,
}) => {
  const [selectedTypeId, setSelectedTypeId] = useState<string>('propiedad');

  // Búsqueda de folio real contra Sheets
  const [folioQuery, setFolioQuery] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [fierroEncontrado, setFierroEncontrado] = useState<GoogleRegistro | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  // Datos (autocompletados desde Sheets)
  const [producerName, setProducerName] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [ejido, setEjido] = useState('Canoas');
  const [uppKey, setUppKey] = useState('');
  const [initials, setInitials] = useState('');
  const [rfc, setRfc] = useState('');
  const [curp, setCurp] = useState('');
  const [purpose, setPurpose] = useState('Trámite de Acreditación de Hato y Solicitud de Crédito Pecuario');

  const [isGeneratingOrder, setIsGeneratingOrder] = useState(false);
  const [createdFolioConstancia, setCreatedFolioConstancia] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeType = CONSTANCIA_TYPES.find((t) => t.id === selectedTypeId) || CONSTANCIA_TYPES[0];
  const fierroValidado = fierroEncontrado !== null;

  // =========================================================================
  // BUSCAR FIERRO EN SHEETS
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
    setCreatedFolioConstancia(null);

    try {
      const result = await buscarPropietarioEnSheet(q);

      if (result.success && result.registro) {
        const r = result.registro;

        // Verificar que el fierro no esté cancelado
        if (r.estatus === 'CANCELADO') {
          setErrorBusqueda(`El fierro ${r.folio} está CANCELADO. No se puede emitir constancia.`);
          setBuscando(false);
          return;
        }

        // Autocompletar datos REALES
        setFierroEncontrado(r);
        setProducerName(r.nombre_productor || '');
        setPropertyName(r.predio || '');
        setEjido(r.ejido || 'Canoas');
        setUppKey(r.upp || '');
        setInitials(r.iniciales || '');
        setRfc(r.rfc || '');
        setCurp(r.curp || '');

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
  // GENERAR ORDEN DE COBRO (CABLEADO A SHEETS)
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

    if (!producerName.trim()) {
      setAlertMsg({
        type: 'error',
        text: 'Falta el nombre del productor.',
      });
      setTimeout(() => setAlertMsg(null), 4000);
      return;
    }

    setIsGeneratingOrder(true);
    setAlertMsg(null);

    try {
      // 1) Llamar al endpoint de Sheets para emitir constancia
      const constanciaResult = await emitirConstanciaEnSheet({
        folio: fierroEncontrado.folio || '',
        tipo: activeType.apiTipo,
        nombre_productor: producerName,
        curp: curp,
        rfc: rfc,
        proposito: purpose,
        operador: currentUser.fullName,
      });

      if (!constanciaResult.success) {
        setAlertMsg({
          type: 'error',
          text: 'Error al emitir constancia: ' + (constanciaResult.error || 'desconocido'),
        });
        setIsGeneratingOrder(false);
        return;
      }

      // 2) Guardar folio generado
      setCreatedFolioConstancia(constanciaResult.folio_constancia || null);

      // 3) Audit log
      recordAuditLog({
        actionType: 'CONSTANCIA_EMITIDA',
        folioAffected: fierroEncontrado.folio || '',
        producerAffected: producerName,
        details: `Constancia "${activeType.title}" emitida (${constanciaResult.folio_constancia}) para ${producerName}. Monto: $${activeType.amount}.00 MXN.`,
      });

      setAlertMsg({
        type: 'success',
        text: `✅ Constancia ${constanciaResult.folio_constancia} emitida correctamente.`,
      });

      // 4) Preparar payload para FinanceManager
      const payload: PreloadedOrderData = {
        nombreContribuyente: producerName.toUpperCase(),
        domicilioContribuyente: `${propertyName ? `${propertyName} - ` : ''}Ejido ${ejido}, Pánuco, Ver.`,
        rfc: rfc,
        curp: curp,
        folio: fierroEncontrado.folio || '',
        conceptosSeleccionados: [activeType.concept],
        montoTotal: activeType.amount,
        ejercicioFiscal: '2026-2029',
        periodo: 'OCTUBRE 2026',
        fechaExpedicion: new Date().toISOString().split('T')[0],
        tramiteOrigen: 'CONSTANCIA',
        notas: `${activeType.title} (${constanciaResult.folio_constancia}) para ${producerName}. UPP: ${uppKey}. Destino: ${purpose}.`,
      };

      // 5) Redirigir a FinanceManager (después de 1.5s para que se vea el mensaje)
      setTimeout(() => {
        onGoToFinance('CONSTANCIA', payload);
      }, 1500);

    } catch (err: any) {
      setAlertMsg({
        type: 'error',
        text: 'Excepción al emitir constancia: ' + (err.message || 'desconocido'),
      });
    } finally {
      setIsGeneratingOrder(false);
    }
  };

  // =========================================================================
  // LIMPIAR BÚSQUEDA
  // =========================================================================
  const handleLimpiar = () => {
    setFolioQuery('');
    setFierroEncontrado(null);
    setErrorBusqueda(null);
    setProducerName('');
    setPropertyName('');
    setEjido('Canoas');
    setUppKey('');
    setInitials('');
    setRfc('');
    setCurp('');
    setCreatedFolioConstancia(null);
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
              title="Volver a la Ventanilla Principal"
            >
              <ArrowLeft size={16} />
              <span>Volver al Hub</span>
            </button>
            <div className="h-8 w-px bg-stone-200" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider">
                  Trámite 4 de 5 · Tesorería Pánuco
                </span>
                <span className="text-xs font-mono font-bold text-stone-400">Acreditación Oficial</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 font-cinzel tracking-tight mt-0.5">
                Expedición de Constancias Ganaderas
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onGoToFinance('CONSTANCIA')}
              className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <DollarSign size={14} className="text-amber-400" />
              <span>Ver Órdenes en Finanzas</span>
            </button>
          </div>
        </div>

        {/* Alert Banner */}
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
          {/* Left Column: Type Selector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Award size={16} className="text-amber-600" />
                <span>1. Seleccione el Tipo de Constancia</span>
              </h2>

              <div className="space-y-2.5">
                {CONSTANCIA_TYPES.map((type) => {
                  const isSelected = selectedTypeId === type.id;
                  return (
                    <div
                      key={type.id}
                      onClick={() => {
                        setSelectedTypeId(type.id);
                        setCreatedFolioConstancia(null);
                      }}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/30'
                          : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <strong className="font-bold text-stone-900 leading-snug">{type.title}</strong>
                        <span className="font-mono font-extrabold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200 shrink-0">
                          ${type.amount}.00
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">{type.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Applicant Details */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-6">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 pb-4 border-b border-stone-100">
                <Search size={16} className="text-amber-600" />
                <span>2. Buscar Fierro en el Padrón (Datos Reales)</span>
              </h3>

              {/* Buscador de folio */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-700 block">
                  Folio, CURP o RFC del fierro a consultar:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={folioQuery}
                      onChange={(e) => setFolioQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarFolio(); }}
                      placeholder="Ej. PAN-2026-04293 o HERR730609HVZRMD01"
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      disabled={buscando}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBuscarFolio}
                    disabled={buscando || !folioQuery.trim()}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
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
                      {fierroEncontrado.nombre_productor} · {fierroEncontrado.predio || 'Sin predio'}
                    </p>
                  </div>
                )}
              </div>

              {/* Form Fields (autocompletados, pero editables) */}
              {fierroValidado && (
                <div className="space-y-4 pt-2 border-t border-stone-100">
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      Nombre Completo del Ganadero:
                    </label>
                    <input
                      type="text"
                      value={producerName}
                      onChange={(e) => setProducerName(e.target.value)}
                      className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Nombre del Predio / Rancho:
                      </label>
                      <input
                        type="text"
                        value={propertyName}
                        onChange={(e) => setPropertyName(e.target.value)}
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Ejido / Localidad (Pánuco):
                      </label>
                      <select
                        value={ejido}
                        onChange={(e) => setEjido(e.target.value)}
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {PANUCO_EJIDOS.map((ej) => (
                          <option key={ej} value={ej}>{ej}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Clave UPP (SINIIGA):
                      </label>
                      <input
                        type="text"
                        value={uppKey}
                        onChange={(e) => setUppKey(e.target.value)}
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Monograma de Fierro:
                      </label>
                      <input
                        type="text"
                        value={initials}
                        onChange={(e) => setInitials(e.target.value)}
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-cinzel font-black uppercase text-amber-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      Destino o Finalidad de la Constancia:
                    </label>
                    <input
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Total y Acciones */}
                  <div className="p-4 rounded-xl bg-stone-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md mt-2">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">
                        Cuota Reglamentaria:
                      </span>
                      <span className="text-xl font-mono font-extrabold text-amber-400">
                        ${activeType.amount}.00 MXN
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGeneratePaymentOrder}
                        disabled={isGeneratingOrder}
                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {isGeneratingOrder ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Emitiendo...</span>
                          </>
                        ) : (
                          <>
                            <DollarSign size={16} />
                            <span>Emitir Constancia y Orden de Cobro</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPrintModal(true)}
                        className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Ver formato oficial"
                      >
                        <Printer size={16} />
                        <span>Formato</span>
                      </button>
                    </div>
                  </div>

                  {/* Success alert con folio */}
                  {createdFolioConstancia && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                        <div>
                          <strong>Constancia emitida: {createdFolioConstancia}</strong>
                          <p className="text-[11px] text-emerald-800">
                            Registrada en Tesorería por ${activeType.amount}.00 MXN.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onGoToFinance('CONSTANCIA')}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
                      >
                        Ver en Finanzas
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Estado vacío */}
              {!fierroValidado && !buscando && (
                <div className="p-6 bg-stone-50 rounded-xl border border-dashed border-stone-300 text-center space-y-2">
                  <User size={28} className="mx-auto text-stone-400" />
                  <p className="text-xs font-semibold text-stone-600">
                    Busque un fierro por folio, CURP o RFC para continuar
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Los datos del productor se autocompletarán desde el padrón municipal.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal: Documento Oficial de Constancia */}
        {showPrintModal && fierroEncontrado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border-2 border-stone-800 shadow-2xl space-y-6">
              <div className="text-center space-y-1 border-b border-stone-200 pb-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-900">
                  {municipalConfig.municipalityName}
                </span>
                <h2 className="text-base font-black font-cinzel text-stone-900 uppercase">
                  {activeType.title}
                </h2>
                <p className="text-xs text-stone-500">Dirección de Fomento Agropecuario y Desarrollo Rural</p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-300 rounded-2xl space-y-3 text-xs leading-relaxed text-stone-800">
                <p>
                  El que suscribe, Director de Fomento Agropecuario de Pánuco, Veracruz, <strong>HACE CONSTAR:</strong>
                </p>
                <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-1 font-mono text-[11px]">
                  <div><strong>Titular:</strong> {producerName}</div>
                  <div><strong>Predio:</strong> {propertyName}, Ejido {ejido}</div>
                  <div><strong>Clave UPP:</strong> {uppKey}</div>
                  <div><strong>Monograma:</strong> {initials}</div>
                  <div><strong>Folio de Fierro:</strong> {fierroEncontrado.folio}</div>
                  <div><strong>Finalidad:</strong> {purpose}</div>
                </div>
                <p className="text-[11px] text-stone-500 italic">
                  Se expide la presente a petición del interesado para los fines legales que al mismo convengan, en la Heroica Ciudad de Pánuco, Veracruz.
                </p>
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
                  <span>Imprimir Constancia</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};