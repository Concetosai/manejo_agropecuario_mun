import React, { useRef, useEffect, useState } from 'react';
import { BrandConfig, TraditionalSymbol, BrandOrientation, FinishStyle } from '../types';
import { renderBrandToCanvas, getBrandDataUrl } from '../utils/canvasRenderer';
import { runAntiDuplicityCheck, generateUniqueProposals, formatSymbolName, formatOrientationName } from '../utils/similarity';
import { VectorizacionFierroPanel } from './VectorizacionFierroPanel';
import { ImportarImagenFierro } from './ImportarImagenFierro';
import type { FierroEmbeddingResult } from '../utils/brandVectorization';
import {
  Sparkles,
  Download,
  RotateCcw,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  PenTool,
  Eraser,
  Check,
  Flame,
  ArrowRight,
} from 'lucide-react';

interface TabCreadorProps {
  brandConfig: BrandConfig;
  onChangeBrandConfig: (config: BrandConfig) => void;
  onGoToAntiduplicidad: () => void;
  onGoToCertificado: () => void;
  /** FIX_FORJA_MODAL: cuando se pasa, muestra boton "Usar en Expediente" (para modal de Hoja 4) */
  onUseForCertificate?: (config: BrandConfig, embedding?: FierroEmbeddingResult | null, sourceImage?: string | null) => void;
  /** FIX_FORJA_MODAL: texto personalizado para el boton de vinculo */
  useForCertificateLabel?: string;
  derivedInitials?: string;
}

export const TabCreador: React.FC<TabCreadorProps> = ({
  brandConfig,
  onChangeBrandConfig,
  onGoToAntiduplicidad,
  onGoToCertificado,
  onUseForCertificate,
  useForCertificateLabel,
  derivedInitials,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [backgroundView, setBackgroundView] = useState<'transparent' | 'white' | 'parchment' | 'leather'>('parchment');
  const [freehandMode, setFreehandMode] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);
  const [lastUniqueNotice, setLastUniqueNotice] = useState<string | null>(null);
  // FIX_VECTORIZACION_MODAL: estado del panel de vectorizacion
  const [hasVectorizado, setHasVectorizado] = useState<boolean>(false);
  const [fierroEmbedding, setFierroEmbedding] = useState<FierroEmbeddingResult | null>(null);
  // FIX_REANALIZAR: Estado para forzar recalculo manual + timestamp del ultimo analisis
  const [scanVersion, setScanVersion] = useState<number>(0);
  const [lastScanTime, setLastScanTime] = useState<string>(() => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [scanHistory, setScanHistory] = useState<Array<{ time: string; initials: string; hash: string; similarity: number }>>([]);
  // FASE_3_MODO_IMPORTAR: selector de modo (disenar o importar imagen)
  const [modo, setModo] = useState<'disenar' | 'importar'>('disenar');

  // FIX_REANALIZAR: Real-time similarity check. Se recalcula en cada cambio + manualmente via scanVersion
  const antiDuplicityStatus = React.useMemo(
    () => runAntiDuplicityCheck(brandConfig),
    [brandConfig, scanVersion]
  );

  // FIX_REANALIZAR: Efecto que registra cada cambio en el historial
  React.useEffect(() => {
    const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const brandHash = brandConfig.initials + '|' + brandConfig.topSymbol + '|' + brandConfig.bottomSymbol + '|' + brandConfig.orientation;
    const sim = antiDuplicityStatus.highestSimilarity;

    setLastScanTime(timeStr);
    setScanHistory((prev) => {
      const nuevo = { time: timeStr, initials: brandConfig.initials || 'XX', hash: brandHash, similarity: sim };
      return [nuevo, ...prev].slice(0, 8);
    });

    console.log(
      '%c[Auditoria Forja] Analisis #' + (scanVersion + 1) + ' · ' + timeStr +
      ' · Monograma: "' + (brandConfig.initials || 'XX') + '"' +
      ' · Hash: ' + brandHash +
      ' · Similitud: ' + sim + '%',
      sim >= 85 ? 'color: #dc2626; font-weight: bold' :
      sim >= 60 ? 'color: #ea580c; font-weight: bold' :
      'color: #16a34a; font-weight: bold'
    );
  }, [brandConfig, scanVersion, antiDuplicityStatus.highestSimilarity]);

  // FIX_REANALIZAR: Handler para forzar re-analisis manual
  const handleReanalizar = () => {
    setScanVersion((v) => v + 1);
    console.log('%c[Auditoria Forja] Re-analisis MANUAL solicitado por el usuario', 'color: #0ea5e9; font-weight: bold');
  };

  // Redraw canvas whenever brandConfig or backgroundView changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderBrandToCanvas(ctx, canvas.width, canvas.height, brandConfig, {
      background: backgroundView,
      showShadow: true,
      resolutionScale: 1,
    });
  }, [brandConfig, backgroundView]);

  // Handle Freehand Mouse/Touch on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!freehandMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setIsDrawing(true);
    setCurrentStroke([{ x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!freehandMode || !isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setCurrentStroke((prev) => [...prev, { x, y }]);

    // Quick draw directly to canvas for smooth responsiveness
    const ctx = canvas.getContext('2d');
    if (ctx && currentStroke.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#171717';
      ctx.lineWidth = brandConfig.strokeWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const last = currentStroke[currentStroke.length - 1];
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handleMouseUp = () => {
    if (!freehandMode || !isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 1) {
      const existing = brandConfig.freehandPaths || [];
      onChangeBrandConfig({
        ...brandConfig,
        freehandPaths: [...existing, { points: currentStroke, strokeWidth: brandConfig.strokeWidth }],
      });
    }
    setCurrentStroke([]);
  };

  const handleClearFreehand = () => {
    onChangeBrandConfig({
      ...brandConfig,
      freehandPaths: [],
    });
  };

  const handleGenerateGuaranteedUnique = () => {
    const proposals = generateUniqueProposals(brandConfig);
    if (proposals.length > 0) {
      onChangeBrandConfig(proposals[0]);
      setLastUniqueNotice('¡Propuesta 100% Única Garantizada aplicada! Se verificó contra los 4,250 registros de Pánuco.');
      setTimeout(() => setLastUniqueNotice(null), 4000);
    }
  };

  const handleDownloadPng = () => {
    const dataUrl = getBrandDataUrl(brandConfig, 1024);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Fierro_Panuco_${brandConfig.initials || 'MARCA'}_1024px.png`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 w-full max-w-full overflow-x-hidden">
      {/* Title */}
      <div className="border-b border-stone-300 pb-4 sm:pb-6 mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-800 block">
            Laboratorio de Forja Digital · Pánuco, Ver.
          </span>
          <h1 className="text-xl sm:text-3xl font-cinzel font-bold text-stone-900 mt-1 break-words">
            Creador y Generador Asistido de Fierros Únicos
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Diseñe el monograma forjado, agregue ornamentos de herrería huasteca y valide su originalidad.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleGenerateGuaranteedUnique}
            className="w-full sm:w-auto px-3 py-2 text-xs font-bold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="truncate">⚡ Generar Propuesta Única Garantizada</span>
          </button>
        </div>
      </div>

      {lastUniqueNotice && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg flex items-center justify-between text-xs sm:text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
            <span>{lastUniqueNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setLastUniqueNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 text-base"
          >
            ×
          </button>
        </div>
      )}

      {/* FASE_3_MODO_IMPORTAR: Selector de modo */}
      <div className="mb-6 bg-white border-2 border-stone-200 rounded-xl p-2 flex items-center gap-2 shadow-sm">
        <button
          type="button"
          onClick={() => setModo('disenar')}
          className={`flex-1 px-4 py-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            modo === 'disenar'
              ? 'bg-amber-700 text-white shadow-md ring-2 ring-amber-400/50'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <span className="text-lg">🎨</span>
          <span>Diseñar Fierro (Laboratorio de Forja)</span>
        </button>
        <button
          type="button"
          onClick={() => setModo('importar')}
          className={`flex-1 px-4 py-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            modo === 'importar'
              ? 'bg-emerald-700 text-white shadow-md ring-2 ring-emerald-400/50'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <span className="text-lg">📷</span>
          <span>Importar Foto del Fierro Físico</span>
        </button>
      </div>

      {/* FASE_3_MODO_IMPORTAR: Modo Diseñar (existente) */}
      {modo === 'disenar' && (
      <>
      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start w-full max-w-full">
        {/* Left Column: Canvas Viewport & Background Switcher (5 cols) */}
        <div className="lg:col-span-5 space-y-4 w-full max-w-full">
          <div className="bg-white border border-stone-200 rounded-xl p-3 sm:p-5 shadow-sm w-full max-w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-stone-600">
                Placa de Marcaje en Vivo (Canvas)
              </span>
              {/* Texture backdrop selector */}
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-md text-[10px] sm:text-xs overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setBackgroundView('parchment')}
                  className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                    backgroundView === 'parchment' ? 'bg-white font-semibold text-amber-900 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Pergamino
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundView('white')}
                  className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                    backgroundView === 'white' ? 'bg-white font-semibold text-stone-900 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Blanco
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundView('leather')}
                  className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                    backgroundView === 'leather' ? 'bg-white font-semibold text-amber-950 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Cuero
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundView('transparent')}
                  className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                    backgroundView === 'transparent' ? 'bg-white font-semibold text-stone-900 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Transparente
                </button>
              </div>
            </div>

            {/* Canvas Container with decorative government border */}
            <div className="relative aspect-square w-full max-w-[320px] sm:max-w-[420px] mx-auto border-2 border-stone-400/60 rounded-lg overflow-hidden shadow-inner flex items-center justify-center bg-stone-50">
              <canvas
                ref={canvasRef}
                width={460}
                height={460}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`w-full h-full object-contain ${freehandMode ? 'cursor-crosshair' : 'cursor-default'}`}
              />

              {/* Freehand indicator badge */}
              {freehandMode && (
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-stone-900/80 text-amber-400 text-xs rounded font-medium backdrop-blur-xs">
                  Modo Retoque Manual Activo
                </div>
              )}
            </div>

            {/* Canvas Toolbar under viewport */}
            <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFreehandMode(!freehandMode)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1 cursor-pointer ${
                    freehandMode ? 'bg-amber-600 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{freehandMode ? 'Terminar Retoque' : 'Pincel de Forja'}</span>
                </button>

                {brandConfig.freehandPaths && brandConfig.freehandPaths.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFreehand}
                    className="px-2.5 py-1.5 text-xs font-medium bg-stone-100 hover:bg-red-50 hover:text-red-700 text-stone-600 rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Limpiar Trazos</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleDownloadPng}
                className="px-3 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar PNG (1024px)</span>
              </button>
            </div>
          </div>

          {/* FIX_REANALIZAR: Banner de duplicidad con boton re-analizar + timestamp + historial */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              antiDuplicityStatus.verdictCode === 'DUPLICATE_ALERT'
                ? 'bg-red-50 border-red-300 text-red-950'
                : antiDuplicityStatus.verdictCode === 'HIGH_SIMILARITY'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-emerald-50 border-emerald-300 text-emerald-950'
            }`}
          >
            <div className="flex items-start gap-3">
              {antiDuplicityStatus.verdictCode === 'DUPLICATE_ALERT' ? (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              ) : antiDuplicityStatus.verdictCode === 'HIGH_SIMILARITY' ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs uppercase font-bold tracking-wider">
                    {antiDuplicityStatus.verdictCode === 'DUPLICATE_ALERT'
                      ? '🔴 ALERTA DE COINCIDENCIA'
                      : antiDuplicityStatus.verdictCode === 'HIGH_SIMILARITY'
                      ? '🟡 ADVERTENCIA DE SIMILITUD'
                      : '🟢 LIBRE DE REGISTRO'}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono-data text-stone-600">
                      Analisis #{scanVersion + 1} · {lastScanTime}
                    </span>
                    <span className="text-sm font-mono-data font-black">
                      {antiDuplicityStatus.highestSimilarity}% Similitud
                    </span>
                  </div>
                </div>
                <p className="text-xs mt-1 leading-relaxed">
                  {antiDuplicityStatus.statusText}
                </p>

                <div className="mt-3 flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-stone-200/60">
                  <span className="text-xs text-stone-500">
                    Cotejado vs {antiDuplicityStatus.totalChecked.toLocaleString()} registros de Pánuco
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReanalizar}
                      className="px-3 py-1.5 text-[11px] font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                      title="Volver a ejecutar el analisis de duplicidad con los cambios actuales"
                    >
                      <span>🔄</span>
                      <span>Re-analizar Duplicidad</span>
                    </button>
                    <button
                      type="button"
                      onClick={onGoToAntiduplicidad}
                      className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Ver comparativa completa</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* FIX_REANALIZAR: Historial de los ultimos analisis */}
                {scanHistory.length > 1 && (
                  <details className="mt-3 pt-2 border-t border-stone-200/60">
                    <summary className="text-[10px] font-bold uppercase tracking-wider text-stone-500 cursor-pointer hover:text-stone-800">
                      📊 Ver historial de analisis ({scanHistory.length})
                    </summary>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {scanHistory.map((h, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] font-mono-data bg-white/60 px-2 py-1 rounded border border-stone-200/60">
                          <span className="text-stone-500">{h.time}</span>
                          <span className="font-bold text-stone-800">"{h.initials}"</span>
                          <span className={h.similarity >= 85 ? 'text-red-700 font-bold' : h.similarity >= 60 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                            {h.similarity}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Forge Customization Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Group 1: Iniciales y Monograma */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-cinzel font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4">
              1. Iniciales y Estructura del Monograma Ganadero
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Iniciales / Letras del Fierro (Hasta 4 car.) *
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={brandConfig.initials}
                  onChange={(e) =>
                    onChangeBrandConfig({
                      ...brandConfig,
                      initials: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="Ej. AG"
                  className="w-full px-4 py-2 text-xl font-cinzel font-bold tracking-widest text-center border-2 border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-amber-50/40 text-stone-900"
                />
                <span className="text-xs text-stone-500 mt-1 block">
                  Letras forjadas según la usanza tradicional de la Huasteca.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Estilo de Forja y Orientación *
                </label>
                <select
                  value={brandConfig.orientation}
                  onChange={(e) =>
                    onChangeBrandConfig({
                      ...brandConfig,
                      orientation: e.target.value as BrandOrientation,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
                >
                  <option value="normal">Normal (Vertical Clásico)</option>
                  <option value="enlazado">Enlazado / Monograma Fundido</option>
                  <option value="echado">Fierro Echado (Rotado -90°)</option>
                  <option value="invertido">Invertido / Reflejado Horizontal</option>
                  <option value="inclinado">Inclinado a 45°</option>
                </select>
                <span className="text-xs text-stone-500 mt-1 block">
                  El "Fierro Echado" es legalmente un distintivo tradicional válido.
                </span>
              </div>
            </div>
          </div>

          {/* Group 2: Símbolos Tradicionales Ganaderos */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-cinzel font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4">
              2. Símbolos Tradicionales de Herrería y Distintivos
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Símbolo Superior */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Símbolo Coronario / Superior
                </label>
                <select
                  value={brandConfig.topSymbol}
                  onChange={(e) =>
                    onChangeBrandConfig({
                      ...brandConfig,
                      topSymbol: e.target.value as TraditionalSymbol,
                    })
                  }
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
                >
                  <option value="none">Sin Símbolo Superior</option>
                  <option value="corona">👑 Corona Real Superior</option>
                  <option value="cruz">✝️ Cruz Ganadera Flared</option>
                  <option value="estrella">⭐ Estrella de 5 Puntas</option>
                  <option value="flecha">🏹 Punta de Flecha / Lanza</option>
                  <option value="flor_lis">⚜️ Flor de Lis Heraldica</option>
                </select>
              </div>

              {/* Símbolo Base / Inferior */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Símbolo de Base / Inferior
                </label>
                <select
                  value={brandConfig.bottomSymbol}
                  onChange={(e) =>
                    onChangeBrandConfig({
                      ...brandConfig,
                      bottomSymbol: e.target.value as TraditionalSymbol,
                    })
                  }
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
                >
                  <option value="none">Sin Símbolo Inferior</option>
                  <option value="medialuna">🌙 Media Luna Cuna</option>
                  <option value="herradura">🧲 Herradura de Base</option>
                  <option value="barra">➖ Barra de Forja Simple</option>
                  <option value="doble_barra">⚌ Doble Barra Estabilizadora</option>
                  <option value="gancho_izq">🪝 Gancho Forjado Izquierdo</option>
                  <option value="gancho_der">🪝 Gancho Forjado Derecho</option>
                </select>
              </div>
            </div>

            {/* Quick Símbolos Grid chips for fast clicking */}
            <div className="mt-4 pt-3 border-t border-stone-100">
              <span className="text-xs text-stone-500 block mb-2 font-medium">
                Distintivos rápidos recomendados:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Corona + Herradura', top: 'corona', bottom: 'herradura' },
                  { label: 'Cruz + Media Luna', top: 'cruz', bottom: 'medialuna' },
                  { label: 'Estrella + Barra', top: 'estrella', bottom: 'barra' },
                  { label: 'Flecha + Doble Barra', top: 'flecha', bottom: 'doble_barra' },
                  { label: 'Flor de Lis + Gancho', top: 'flor_lis', bottom: 'gancho_der' },
                ].map((combo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      onChangeBrandConfig({
                        ...brandConfig,
                        topSymbol: combo.top as TraditionalSymbol,
                        bottomSymbol: combo.bottom as TraditionalSymbol,
                      })
                    }
                    className="px-2.5 py-1 text-xs bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-700 rounded transition-colors cursor-pointer"
                  >
                    {combo.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Group 3: Calibre de Hierro, Adornos y Acabado */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-cinzel font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4">
              3. Calibre de Varilla, Adornos y Temple de Fragua
            </h2>

            <div className="space-y-4">
              {/* Slider: Grosor de varilla */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  <span>Grosor de Varilla Forjada</span>
                  <span className="font-mono-data text-amber-800">{brandConfig.strokeWidth} px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={24}
                  step={1}
                  value={brandConfig.strokeWidth}
                  onChange={(e) =>
                    onChangeBrandConfig({
                      ...brandConfig,
                      strokeWidth: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-stone-400">
                  <span>Delgado (8px)</span>
                  <span>Estándar Ganadero (14px)</span>
                  <span>Grueso Forja (24px)</span>
                </div>
              </div>

              {/* Slant Angle (for inclinado) */}
              {brandConfig.orientation === 'inclinado' && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    <span>Ángulo de Inclinación</span>
                    <span className="font-mono-data text-amber-800">{brandConfig.slantAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min={-60}
                    max={60}
                    step={5}
                    value={brandConfig.slantAngle}
                    onChange={(e) =>
                      onChangeBrandConfig({
                        ...brandConfig,
                        slantAngle: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>
              )}

              {/* Toggles: Outer Ring & Terminal Spurs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={brandConfig.hasOuterRing}
                    onChange={(e) =>
                      onChangeBrandConfig({
                        ...brandConfig,
                        hasOuterRing: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600"
                  />
                  <div>
                    <span className="text-xs font-semibold text-stone-800 block">
                      Aro Perimetral de Hierro
                    </span>
                    <span className="text-xs text-stone-500">
                      Circunferencia de contención exterior
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={brandConfig.hasSpurs}
                    onChange={(e) =>
                      onChangeBrandConfig({
                        ...brandConfig,
                        hasSpurs: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600"
                  />
                  <div>
                    <span className="text-xs font-semibold text-stone-800 block">
                      Espuelas en Terminales
                    </span>
                    <span className="text-xs text-stone-500">
                      Puntas de anclaje tradicionales
                    </span>
                  </div>
                </label>
              </div>

              {/* Finish selector */}
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-2">
                  Acabado Visual de Presentación
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'forja_negra', label: 'Forja Negra', desc: 'Tradicional' },
                    { id: 'candente', label: 'Candente', desc: 'Al rojo vivo' },
                    { id: 'oxido', label: 'Pátina Óxido', desc: 'Envejecido' },
                    { id: 'plata', label: 'Acero Templado', desc: 'Pulido' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() =>
                        onChangeBrandConfig({
                          ...brandConfig,
                          finish: style.id as FinishStyle,
                        })
                      }
                      className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        brandConfig.finish === style.id
                          ? 'border-amber-600 bg-amber-50 text-amber-950 font-semibold shadow-xs'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{style.label}</span>
                      <span className="block text-xs text-stone-500">{style.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FIX_VECTORIZACION_MODAL: Panel de vectorizacion embebido */}
          <VectorizacionFierroPanel
            canvasRef={canvasRef}
            highestSimilarity={antiDuplicityStatus.highestSimilarity}
            onVectorizado={(result) => {
              setFierroEmbedding(result);
              setHasVectorizado(true);
              console.log('%c[Vectorizacion] Aceptada, boton Continuar desbloqueado', 'color: #22c55e');
            }}
          />

          {/* Navigation Action */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={onGoToAntiduplicidad}
              className="px-5 py-2.5 text-xs font-semibold text-stone-800 bg-stone-200 hover:bg-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              Consultar Motor Antiduplicidad
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {/* FIX_BLOQUEO_CERT: boton condicional segun vectorizacion + similitud */}
              {(() => {
                const enModoModal = Boolean(onUseForCertificate);
                const similitudAlta = antiDuplicityStatus.highestSimilarity >= 85;
                const bloqueadoTotal = enModoModal && (!hasVectorizado || similitudAlta);

                if (bloqueadoTotal) {
                  return (
                    <button
                      type="button"
                      disabled
                      title={similitudAlta
                        ? '🔒 Similitud mayor al 85% detectada. Modifique el diseño antes de continuar.'
                        : '🔒 Debe primero ejecutar la vectorización del fierro para continuar'}
                      className="px-6 py-2.5 text-xs font-semibold text-stone-400 bg-stone-200 border-2 border-dashed border-stone-300 rounded-lg cursor-not-allowed flex items-center gap-1.5 opacity-90"
                    >
                      <span className="text-base">🔒</span>
                      <span>Continuar a Certificado Oficial</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  );
                }

                return (
                  <button
                    type="button"
                    onClick={onGoToCertificado}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg shadow transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Continuar a Certificado Oficial</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* FASE_3_MODO_IMPORTAR: Modo Importar Imagen */}
      {modo === 'importar' && (
        <div className="max-w-4xl mx-auto">
          <ImportarImagenFierro
            onUseForCertificate={(config, embedding, sourceImage) => {
              // Actualizar el brandConfig global
              onChangeBrandConfig(config);
              // Guardar el embedding para que onUseForCertificate original lo use
              setFierroEmbedding(embedding);
              setHasVectorizado(!!embedding);
              // Llamar al callback original (si existe)
              if (onUseForCertificate) {
                onUseForCertificate(config, embedding, sourceImage);
              }
            }}
            useForCertificateLabel={useForCertificateLabel || 'Usar este Fierro en el Expediente'}
            currentBrandConfig={brandConfig}
         derivedInitials={derivedInitials}
       />
        </div>
      )}
    </div>
  );
};








