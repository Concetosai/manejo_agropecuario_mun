import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Beef,
  Search,
  Printer,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck2,
} from 'lucide-react';
import { MunicipalConfig, MunicipalUser, PreloadedOrderData } from '../../types';
import {
  buscarPropietarioEnSheet,
  registrarDeguelloEnSheet,
  GoogleRegistro,
} from '../../services/googleSheetsService';
import { recordAuditLog } from '../../utils/auditAuth';

interface DeguelloViewProps {
  onBack: () => void;
  onGoToFinance: (category?: 'DEGUELLO', preloaded?: PreloadedOrderData) => void;
  municipalConfig: MunicipalConfig;
  currentUser: MunicipalUser;
  // Prop legacy: no se usa (los datos vienen de Sheets), pero App.tsx lo envia
  currentProducer?: any;
}

const SPECIES_RATES: Record<string, { label: string; rate: number; apiValue: string }> = {
  BOVINO: { label: 'Bovino (Res / Vaca / Novillo)', rate: 90, apiValue: 'BOVINO' },
  PORCINO: { label: 'Porcino (Cerdo / Puerco)', rate: 60, apiValue: 'PORCINO' },
  OVINO_CAPRINO: { label: 'Ovino / Caprino (Borrego / Chivo)', rate: 45, apiValue: 'OVINO_CAPRINO' },
};

function generarFolioGuia(): string {
  const año = new Date().getFullYear();
  const random = Math.floor(Math.random() * 900000) + 100000;
  return `GTZ-VER-${año}-${random}`;
}

export const DeguelloView: React.FC<DeguelloViewProps> = ({
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

  // Formulario
  const [species, setSpecies] = useState<keyof typeof SPECIES_RATES>('BOVINO');
  const [headCount, setHeadCount] = useState<number>(1);
  const [facility, setFacility] = useState('RASTRO MUNICIPAL DE PÁNUCO');
  const [introductorName, setIntroductorName] = useState('');
  const [originBrand, setOriginBrand] = useState('');
  const [transitGuideNumber, setTransitGuideNumber] = useState('');
  const [sanitaryCertificate, setSanitaryCertificate] = useState('');
  const [inspectorName, setInspectorName] = useState('M.V.Z. Carlos Del Ángel Morales');
  const [slaughterDate, setSlaughterDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Estados de emisión
  const [isGeneratingOrder, setIsGeneratingOrder] = useState(false);
  const [createdOrderResult, setCreatedOrderResult] = useState<{ folio: string; monto: number } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fierroValidado = fierroEncontrado !== null;

  // Autogenerar folio de guía cuando se valida un fierro
  useEffect(() => {
    if (fierroEncontrado && !transitGuideNumber) {
      setTransitGuideNumber(generarFolioGuia());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fierroEncontrado]);

  const unitRate = SPECIES_RATES[species].rate;
  const totalAmount = headCount * unitRate;

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
    setCreatedOrderResult(null);

    try {
      const result = await buscarPropietarioEnSheet(q);

      if (result.success && result.registro) {
        const r = result.registro;

        if (r.estatus === 'CANCELADO') {
          setErrorBusqueda(
            `El fierro ${r.folio} está CANCELADO (${r.motivo_baja || 'sin motivo'}). No se puede registrar degüello.`
          );
          setBuscando(false);
          return;
        }

        setFierroEncontrado(r);
        setIntroductorName(r.nombre_productor || '');
        setOriginBrand(
          r.iniciales
            ? `${r.iniciales} - ${r.predio || 'Sin predio'}`
            : r.predio || ''
        );

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
  // GENERAR ORDEN DE DEGÜELLO
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

    if (!introductorName.trim()) {
      setAlertMsg({
        type: 'error',
        text: 'Falta el nombre del introductor / ganadero.',
      });
      setTimeout(() => setAlertMsg(null), 4000);
      return;
    }

    if (headCount <= 0) {
      setAlertMsg({
        type: 'error',
        text: 'El número de cabezas debe ser mayor a 0.',
      });
      setTimeout(() => setAlertMsg(null), 4000);
      return;
    }

    setIsGeneratingOrder(true);
    setAlertMsg(null);

    try {
      const deguelloResult = await registrarDeguelloEnSheet({
        folio_fierro: fierroEncontrado.folio || '',
        numero_cabezas: headCount,
        cuota_por_cabeza: unitRate,
        nombre_introductor: introductorName,
        especie: SPECIES_RATES[species].apiValue,
        instalacion: facility,
        guia_transito: transitGuideNumber,
        certificado_sanitario: sanitaryCertificate,
        inspector_mvz: inspectorName,
        fecha_sacrificio: slaughterDate,
        operador: currentUser.fullName,
      });

      if (!deguelloResult.success) {
        setAlertMsg({
          type: 'error',
          text: 'Error al registrar degüello: ' + (deguelloResult.error || 'desconocido'),
        });
        setIsGeneratingOrder(false);
        return;
      }

      setCreatedOrderResult({
        folio: deguelloResult.folio_guia || 'N/A',
        monto: deguelloResult.monto || totalAmount,
      });

      recordAuditLog({
        actionType: 'ORDEN_COBRO_CREADA',
        folioAffected: fierroEncontrado.folio || '',
        producerAffected: introductorName,
        details: `Permiso de degüello ${deguelloResult.folio_guia} (${headCount} cabezas ${species}) por $${totalAmount}.00 MXN. Instalación: ${facility}. MVZ: ${inspectorName}.`,
      });

      setAlertMsg({
        type: 'success',
        text: `✅ Degüello registrado. Guía: ${deguelloResult.folio_guia}`,
      });

      const payload: PreloadedOrderData = {
        nombreContribuyente: introductorName.toUpperCase(),
        domicilioContribuyente: `${fierroEncontrado.predio ? `${fierroEncontrado.predio} - ` : ''}Ejido ${fierroEncontrado.ejido || ''}, Pánuco, Ver.`,
        rfc: fierroEncontrado.rfc || '',
        curp: fierroEncontrado.curp || '',
        folio: fierroEncontrado.folio || '',
        conceptosSeleccionados: ['7. DERECHO DE DEGÜELLO Y CONTROL SANITARIO'],
        montoTotal: totalAmount,
        ejercicioFiscal: '2026-2029',
        periodo: 'OCTUBRE 2026',
        fechaExpedicion: slaughterDate || new Date().toISOString().split('T')[0],
        tramiteOrigen: 'DEGUELLO',
        headCount,
        species: SPECIES_RATES[species].label,
        notas: `Permiso de degüello ${deguelloResult.folio_guia} para ${headCount} cabezas de ganado ${SPECIES_RATES[species].label} (${facility}). Guía: ${transitGuideNumber}. Fierro origen: ${originBrand}. Inspector: ${inspectorName}.`,
      };

      setTimeout(() => {
        onGoToFinance('DEGUELLO', payload);
      }, 1500);

    } catch (err: any) {
      setAlertMsg({
        type: 'error',
        text: 'Excepción al registrar degüello: ' + (err.message || 'desconocido'),
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
    setSpecies('BOVINO');
    setHeadCount(1);
    setFacility('RASTRO MUNICIPAL DE PÁNUCO');
    setIntroductorName('');
    setOriginBrand('');
    setTransitGuideNumber('');
    setSanitaryCertificate('');
    setInspectorName('M.V.Z. Carlos Del Ángel Morales');
    setSlaughterDate(new Date().toISOString().split('T')[0]);
    setCreatedOrderResult(null);
  };

  const handleRegenerarGuia = () => {
    setTransitGuideNumber(generarFolioGuia());
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
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-extrabold uppercase tracking-wider">
                  Trámite 5 de 5 · Tesorería Pánuco
                </span>
                <span className="text-xs font-mono font-bold text-stone-400">Inspección Sanitaria</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 font-cinzel tracking-tight mt-0.5">
                Permiso de Degüello y Control de Sacrificio
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onGoToFinance('DEGUELLO')}
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
          {/* Left Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-5">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Search size={16} className="text-purple-600" />
                <span>1. Buscar Fierro de Procedencia</span>
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
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={buscando}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBuscarFolio}
                    disabled={buscando || !folioQuery.trim()}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {buscando ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>...</span>
                      </>
                    ) : (
                      <Search size={14} />
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
                        Fierro: {fierroEncontrado.folio}
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

              <div className="pt-3 border-t border-stone-100 space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">
                    Especie Animal a Sacrificar:
                  </label>
                  <div className="space-y-2">
                    {(Object.keys(SPECIES_RATES) as Array<keyof typeof SPECIES_RATES>).map((spKey) => {
                      const isSelected = species === spKey;
                      return (
                        <div
                          key={spKey}
                          onClick={() => setSpecies(spKey)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-500/30'
                              : 'bg-white border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <span className="font-bold text-stone-900">{SPECIES_RATES[spKey].label}</span>
                          <span className="font-mono font-extrabold text-stone-800 bg-stone-100 px-2 py-0.5 rounded">
                            ${SPECIES_RATES[spKey].rate}.00
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">
                    Número de Cabezas:
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setHeadCount((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-extrabold text-stone-800 text-lg flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={headCount}
                      onChange={(e) => setHeadCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 text-center text-lg font-mono font-extrabold py-2 bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setHeadCount((prev) => prev + 1)}
                      className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-extrabold text-stone-800 text-lg flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Cuota por cabeza:</span>
                  <span className="font-mono font-bold">${unitRate}.00 MXN</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Cabezas:</span>
                  <span className="font-mono font-bold">{headCount}</span>
                </div>
                <div className="pt-2 border-t border-purple-200 flex justify-between items-center text-stone-900">
                  <strong className="text-xs uppercase font-extrabold">Total Degüello:</strong>
                  <span className="text-lg font-mono font-extrabold text-purple-900">
                    ${totalAmount}.00 MXN
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7 space-y-4">
            {fierroValidado && fierroEncontrado ? (
              <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 pb-4 border-b border-stone-100">
                  <FileCheck2 size={16} className="text-purple-600" />
                  <span>2. Verificación de Procedencia y Control Sanitario</span>
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Instalación de Sacrificio:
                      </label>
                      <select
                        value={facility}
                        onChange={(e) => setFacility(e.target.value.toUpperCase())}
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="RASTRO MUNICIPAL DE PÁNUCO">RASTRO MUNICIPAL DE PÁNUCO</option>
                        <option value="MATADERO FRIGORÍFICO AUTORIZADO">MATADERO FRIGORÍFICO AUTORIZADO</option>
                        <option value="RASTRO PARTICULAR AUTORIZADO">RASTRO PARTICULAR AUTORIZADO</option>
                        <option value="CONSUMO DOMÉSTICO / PARTICULAR">CONSUMO DOMÉSTICO / PARTICULAR</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Fecha Programada de Sacrificio:
                      </label>
                      <input
                        type="date"
                        value={slaughterDate}
                        onChange={(e) => setSlaughterDate(e.target.value.toUpperCase())}
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Nombre del Introductor / Ganadero: *
                      </label>
                      <input
                        type="text"
                        value={introductorName}
                        onChange={(e) => setIntroductorName(e.target.value.toUpperCase())}
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Fierro Quemador de Procedencia:
                      </label>
                      <input
                        type="text"
                        value={originBrand}
                        onChange={(e) => setOriginBrand(e.target.value.toUpperCase())}
                        placeholder="Monograma o rancho..."
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-stone-700">
                          Guía de Tránsito Zoosanitaria:
                        </label>
                        <button
                          type="button"
                          onClick={handleRegenerarGuia}
                          className="text-[10px] font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                        >
                          Regenerar
                        </button>
                      </div>
                      <input
                        type="text"
                        value={transitGuideNumber}
                        onChange={(e) => setTransitGuideNumber(e.target.value.toUpperCase())}
                        placeholder="Ej. GTZ-VER-2026-123456"
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Certificado Sanitario (opcional):
                      </label>
                      <input
                        type="text"
                        value={sanitaryCertificate}
                        onChange={(e) => setSanitaryCertificate(e.target.value.toUpperCase())}
                        placeholder="Ej. CFS-PAN-109/2026"
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      Inspector Sanitario / M.V.Z. Responsable:
                    </label>
                    <input
                      type="text"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value.toUpperCase())}
                      className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-stone-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">
                        Total a Liquidar ({headCount} cabezas):
                      </span>
                      <span className="text-xl font-mono font-extrabold text-amber-400">
                        ${totalAmount}.00 MXN
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGeneratePaymentOrder}
                        disabled={isGeneratingOrder || !introductorName.trim()}
                        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {isGeneratingOrder ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Registrando...</span>
                          </>
                        ) : (
                          <>
                            <Beef size={16} />
                            <span>Registrar Degüello y Orden</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPrintModal(true)}
                        className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer size={16} />
                        <span>Autorización</span>
                      </button>
                    </div>
                  </div>

                  {createdOrderResult && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                        <div>
                          <strong>Degüello registrado: {createdOrderResult.folio}</strong>
                          <p className="text-[11px] text-emerald-800">
                            Guardado en hoja DEGÜELLOS · Total ${createdOrderResult.monto}.00 MXN
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onGoToFinance('DEGUELLO')}
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
                <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                  <Beef size={24} />
                </div>
                <h3 className="text-base font-bold text-stone-800">Seleccione un Fierro de Procedencia</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Busque en el padrón municipal el fierro de origen del ganado a sacrificar para verificar su procedencia legal.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Autorización Oficial */}
        {showPrintModal && fierroEncontrado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border-2 border-stone-800 shadow-2xl space-y-6">
              <div className="text-center space-y-1 border-b border-stone-200 pb-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-900">
                  {municipalConfig.municipalityName}
                </span>
                <h2 className="text-base font-black font-cinzel text-stone-900 uppercase">
                  AUTORIZACIÓN MUNICIPAL DE DEGÜELLO E INSPECCIÓN SANITARIA
                </h2>
                <p className="text-xs text-stone-500">Dirección de Fomento Agropecuario · Tesorería Municipal</p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-300 rounded-2xl space-y-3 text-xs leading-relaxed text-stone-800">
                <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-1 font-mono text-[11px]">
                  <div><strong>Introductor:</strong> {introductorName}</div>
                  <div><strong>Instalación:</strong> {facility}</div>
                  <div><strong>Volumen Autorizado:</strong> {headCount} cabezas de ganado {SPECIES_RATES[species].label}</div>
                  <div><strong>Fierro de Procedencia:</strong> {originBrand}</div>
                  <div><strong>Guía Zoosanitaria:</strong> {transitGuideNumber}</div>
                  {sanitaryCertificate && <div><strong>Certificado Sanitario:</strong> {sanitaryCertificate}</div>}
                  <div><strong>Inspector Responsable:</strong> {inspectorName}</div>
                  <div><strong>Fecha de Sacrificio:</strong> {slaughterDate}</div>
                </div>
                <p className="text-[11px] text-stone-500 italic">
                  Se autoriza el sacrificio habiéndose verificado la legal procedencia de los semovientes y el pago de los derechos correspondientes ante la Tesorería Municipal.
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
                  <span>Imprimir Autorización</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};