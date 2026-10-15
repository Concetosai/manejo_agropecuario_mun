import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BrandConfig, HistoricalRecord } from '../types';
import { AntiduplicidadModal } from './AntiduplicidadModal';
import { getLocalFierros } from '../utils/localFierrosStorage';
import {
  FierroVectorizer,
  FierroEmbeddingResult,
  preprocessFierroImage,
} from '../utils/brandVectorization';
import {
  Upload,
  Camera,
  RotateCw,
  RotateCcw,
  Sparkles,
  Check,
  Loader2,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  Info,
} from 'lucide-react';

interface ImportarImagenFierroProps {
  onUseForCertificate: (config: BrandConfig, embedding: FierroEmbeddingResult | null, sourceImage?: string | null) => void;
  useForCertificateLabel?: string;
  currentBrandConfig?: BrandConfig;
  derivedInitials?: string;
}

type ProcessState = 'idle' | 'preprocessing' | 'preprocessed' | 'vectorizing' | 'vectorized' | 'error';

export const ImportarImagenFierro: React.FC<ImportarImagenFierroProps> = ({
  onUseForCertificate,
  useForCertificateLabel = 'Usar este Fierro en el Expediente',
  currentBrandConfig,
  derivedInitials,
}) => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [preprocessedImage, setPreprocessedImage] = useState<string | null>(null);
  const [preprocessMeta, setPreprocessMeta] = useState<{
    wasInverted: boolean;
    rotationAngle: number;
    rotationConfidence: number;
    processingTimeMs: number;
  } | null>(null);
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [embedding, setEmbedding] = useState<FierroEmbeddingResult | null>(null);
  const [showComparison, setShowComparison] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualRotation, setManualRotation] = useState(0);
  const [invertManual, setInvertManual] = useState(false);
  
  // FASE 1+2: estado del modal de antiduplicidad
  const [showAntiModal, setShowAntiModal] = useState(false);
  const [pendingEmbedding, setPendingEmbedding] = useState<FierroEmbeddingResult | null>(null);
  
  // FIX_TOGGLE_AUTOROTATE: switch para activar el auto-rotador bajo demanda
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ===== HANDLERS =====
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (JPG, PNG, WEBP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen no debe pesar más de 10 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setUploadedImage(result);
      setPreprocessedImage(null);
      setPreprocessMeta(null);
      setEmbedding(null);
      setError(null);
      setProcessState('idle');
      setManualRotation(0);
      setInvertManual(false);
      console.log('%c[Importar] Imagen cargada:', 'color: #0ea5e9', file.name, `(${Math.round(file.size / 1024)} KB)`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handlePreprocess = useCallback(async () => {
    if (!uploadedImage) return;
    setProcessState('preprocessing');
    setError(null);
    setPreprocessMeta(null);
    setEmbedding(null);
    const t0 = performance.now();
    try {
      let workingImage = uploadedImage;
      if (manualRotation !== 0) {
        workingImage = await rotateDataUrl(workingImage, manualRotation);
      }
      if (invertManual) {
        workingImage = await invertDataUrl(workingImage);
      }
      const result = await preprocessFierroImage(workingImage, {
        enableAutoRotation: autoRotateEnabled,
      });
      const elapsed = Math.round(performance.now() - t0);
      setPreprocessedImage(result.dataUrl);
      setPreprocessMeta({
        wasInverted: result.wasInverted || invertManual,
        rotationAngle: result.rotationAngle,
        rotationConfidence: result.rotationConfidence,
        processingTimeMs: elapsed,
      });
      setProcessState('preprocessed');
      console.log('%c[Importar] Preprocesamiento OK:', 'color: #22c55e', { ...result, elapsed: elapsed + 'ms' });
    } catch (err: any) {
      console.error('[Importar] Error en preprocesamiento:', err);
      setError(err?.message || 'Error al preprocesar la imagen');
      setProcessState('error');
    }
  }, [uploadedImage, manualRotation, invertManual]);

  const handleVectorize = useCallback(async () => {
    const sourceImage = preprocessedImage || uploadedImage;
    if (!sourceImage) return;
    setProcessState('vectorizing');
    setError(null);
    try {
      const vectorizer = new FierroVectorizer();
      const result = await vectorizer.generateEmbedding(sourceImage);
      if (!result.hasStrokes || result.density === 0) {
        setError('No se detectaron trazos del fierro en la imagen. Verifique que la foto muestre claramente el fierro sobre fondo claro.');
        setEmbedding(null);
        setProcessState('error');
      } else {
        setEmbedding(result);
        setProcessState('vectorized');
        console.log('%c[Importar] Vectorización OK:', 'color: #22c55e', {
          density: (result.density * 100).toFixed(1) + '%',
          checksum: result.checksum,
          activeCells: result.activeCellCount,
        });
      }
    } catch (err: any) {
      console.error('[Importar] Error en vectorización:', err);
      setError(err?.message || 'Error al vectorizar la imagen');
      setProcessState('error');
    }
  }, [preprocessedImage, uploadedImage]);

  const handleReset = useCallback(() => {
    setUploadedImage(null);
    setPreprocessedImage(null);
    setPreprocessMeta(null);
    setEmbedding(null);
    setError(null);
    setProcessState('idle');
    setManualRotation(0);
    setInvertManual(false);
  }, []);

  const handleUseInExpediente = useCallback(() => {
    if (!embedding) {
      setError('Debe vectorizar el fierro antes de usarlo en el expediente');
      return;
    }
    setPendingEmbedding(embedding);
    setShowAntiModal(true);
  }, [embedding]);

  const handleAcceptWithAdvertencia = useCallback((advertencia?: {
    nivel: 'LOW' | 'MEDIUM' | 'HIGH';
    similarA?: string;
    similitudPct?: number;
  }) => {
    if (!pendingEmbedding) return;
    const config: BrandConfig = {
      initials: currentBrandConfig?.initials || derivedInitials || 'AG',
      topSymbol: 'none',
      bottomSymbol: 'none',
      centerSymbol: 'none',
      orientation: 'normal',
      strokeWidth: currentBrandConfig?.strokeWidth || 14,
      slantAngle: 45,
      finish: 'forja_negra',
      hasOuterRing: false,
      hasSpurs: false,
      freehandPaths: [],
    };
    (config as any).antiduplicidad = {
      hasAdvertencia: !!advertencia,
      nivelAdvertencia: advertencia?.nivel || null,
      similarA: advertencia?.similarA || null,
      similitudPct: advertencia?.similitudPct || null,
      fechaVerificacion: new Date().toISOString(),
    };
    console.log('%c[Importar] Aceptado con advertencia:', 'color: #22c55e; font-weight: bold', advertencia || 'sin advertencia');
    setShowAntiModal(false);
    setPendingEmbedding(null);
    onUseForCertificate(config, pendingEmbedding, preprocessedImage || uploadedImage);
  }, [pendingEmbedding, currentBrandConfig, derivedInitials, onUseForCertificate, preprocessedImage, uploadedImage]);

  const handleLinkToExpediente = useCallback(() => {
    if (!pendingEmbedding) return;
    const config: BrandConfig = {
      initials: currentBrandConfig?.initials || derivedInitials || 'AG',
      topSymbol: 'none',
      bottomSymbol: 'none',
      centerSymbol: 'none',
      orientation: 'normal',
      strokeWidth: currentBrandConfig?.strokeWidth || 14,
      slantAngle: 45,
      finish: 'forja_negra',
      hasOuterRing: false,
      hasSpurs: false,
      freehandPaths: [],
    };
    (config as any).antiduplicidad = {
      hasAdvertencia: false,
      nivelAdvertencia: null,
      similarA: null,
      similitudPct: null,
      fechaVerificacion: new Date().toISOString(),
    };
    console.log('%c[Importar] Vinculado al expediente exitosamente', 'color: #22c55e; font-weight: bold');
    setShowAntiModal(false);
    setPendingEmbedding(null);
    onUseForCertificate(config, pendingEmbedding, preprocessedImage || uploadedImage);
  }, [pendingEmbedding, currentBrandConfig, derivedInitials, onUseForCertificate, preprocessedImage, uploadedImage]);

  const [allRecordsForComparison, setAllRecordsForComparison] = useState<HistoricalRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  useEffect(() => {
    if (!showAntiModal) return;
    const load = async () => {
      setIsLoadingRecords(true);
      try {
        console.log('%c[Antiduplicidad] Consultando hoja REGISTROS de Sheets (fuente oficial)...', 'color: #0ea5e9; font-weight: bold');
        const { obtenerRegistrosDelSheet } = await import('../services/googleSheetsService');
        const result = await obtenerRegistrosDelSheet();
        if (!result.success) {
          console.warn('[Antiduplicidad] No se pudo obtener registros de Sheets:', result.error);
          setAllRecordsForComparison([]);
          setIsLoadingRecords(false);
          return;
        }
        const officialRecords: HistoricalRecord[] = (result.registros || []).map((r: any) => ({
          id: r.folio || r.id_registro,
          folio: r.folio,
          ownerName: r.nombre_productor,
          curp: r.curp,
          rfc: r.rfc,
          ine: r.ine,
          phone: r.telefono,
          address: r.domicilio,
          propertyName: r.predio,
          ejido: r.ejido,
          surfaceHectares: parseFloat(r.superficie) || 0,
          tenureType: r.tenencia,
          cattleCount: parseInt(r.cantidad_ganado, 10) || 0,
          species: r.especie,
          initials: r.iniciales,
          uppKey: r.upp,
          registrationNumber: r.numero_registro,
          bookNumber: r.libro,
          folioPage: r.foja,
          issueDate: r.fecha_expedicion,
          validityRange: r.vigencia,
          status: r.estatus === 'ACTIVO' ? 'Vigente' : 'Cancelado',
          vector_64d: Array.isArray(r.vector_64d) ? r.vector_64d : undefined,
          vector_checksum: r.vector_checksum,
          vector_density: r.vector_density,
          vector_symmetry_h: r.vector_symmetry_h,
          vector_symmetry_v: r.vector_symmetry_v,
          vector_proportions: r.vector_proportions,
          extractedBrandImage: r.url_fierro || r.url_miniatura_fierro,
          imagen_base64: r.url_fierro || r.url_miniatura_fierro,
          fierroImageUrl: r.url_fierro,
        } as any));
        const conVector = officialRecords.filter(r => Array.isArray(r.vector_64d) && r.vector_64d.length === 256);
        console.log('%c[Antiduplicidad] Registros OFICIALES cargados de Sheets:', 'color: #22c55e; font-weight: bold', {
          total: officialRecords.length,
          conVector: conVector.length,
          sinVector: officialRecords.length - conVector.length,
        });
        setAllRecordsForComparison(officialRecords);
      } catch (err) {
        console.warn('[Antiduplicidad] Error consultando Sheets:', err);
        setAllRecordsForComparison([]);
      } finally {
        setIsLoadingRecords(false);
      }
    };
    load();
  }, [showAntiModal]);

  // ===== HELPERS =====
  const rotateDataUrl = async (dataUrl: string, angleDeg: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const rad = (angleDeg * Math.PI) / 180;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const newW = Math.ceil(w * cos + h * sin);
        const newH = Math.ceil(w * sin + h * cos);
        const canvas = document.createElement('canvas');
        canvas.width = newW;
        canvas.height = newH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, newW, newH);
        ctx.translate(newW / 2, newH / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const invertDataUrl = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const isProcessing = processState === 'preprocessing' || processState === 'vectorizing';

  // ===== RENDER =====
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-950">Modo Importar Foto del Fierro Físico</h3>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Suba una foto o escaneo del fierro ya forjado. El sistema lo vectorizará para el análisis de antiduplicidad contra el padrón municipal.
            </p>
          </div>
        </div>
      </div>

      {!uploadedImage && (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setUploadedImage(ev.target?.result as string);
                  setError(null);
                  setProcessState('idle');
                };
                reader.readAsDataURL(file);
              }
            }}
            className="border-2 border-dashed border-emerald-400 hover:border-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl p-10 sm:p-14 text-center cursor-pointer transition-all group"
          >
            <Upload className="w-12 h-12 text-emerald-700 mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-stone-900 text-base mb-1">Haga clic o arrastre aquí la foto del fierro</p>
            <p className="text-xs text-stone-600 max-w-md mx-auto">
              Formatos admitidos: JPG, PNG, WEBP. Tamaño máximo: 10 MB.<br />Recomendado: foto frontal, con buena iluminación, fondo claro.
            </p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        </>
      )}

      {uploadedImage && (
        <>
          <div className="flex items-center justify-between bg-white border border-stone-200 rounded-xl p-3">
            <span className="text-xs font-bold text-stone-700 uppercase">Imagen cargada</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowComparison(!showComparison)}
                className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {showComparison ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showComparison ? 'Ocultar comparación' : 'Ver comparación'}</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isProcessing}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cambiar imagen</span>
              </button>
            </div>
          </div>

          {showComparison && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-stone-200 rounded-xl p-3">
                <span className="text-[11px] font-bold uppercase text-stone-500 block mb-2">📷 Imagen Original</span>
                <div className="aspect-square bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={uploadedImage} alt="Original" className="w-full h-full object-contain" />
                </div>
              </div>
              <div className="bg-white border-2 border-emerald-300 rounded-xl p-3">
                <span className="text-[11px] font-bold uppercase text-emerald-800 block mb-2">✨ Preprocesada (auto-rotada + normalizada)</span>
                <div className="aspect-square bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {preprocessedImage ? (
                    <img src={preprocessedImage} alt="Preprocesada" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center text-stone-400 text-xs p-4">
                      <Info className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <span>Presione "Preprocesar" para ver la versión optimizada</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-stone-700 uppercase">🔧 Ajustes Manuales (opcional)</h4>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">Rotación manual: <strong>{manualRotation}°</strong></label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setManualRotation((r) => Math.max(-180, r - 5))} disabled={isProcessing} className="p-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 disabled:opacity-50 cursor-pointer" title="Rotar -5°">
                  <RotateCcw className="w-4 h-4 text-stone-700" />
                </button>
                <input type="range" min={-180} max={180} step={1} value={manualRotation} onChange={(e) => setManualRotation(parseInt(e.target.value, 10))} disabled={isProcessing} className="flex-1 accent-emerald-600" />
                <button type="button" onClick={() => setManualRotation((r) => Math.min(180, r + 5))} disabled={isProcessing} className="p-2 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 disabled:opacity-50 cursor-pointer" title="Rotar +5°">
                  <RotateCw className="w-4 h-4 text-stone-700" />
                </button>
                <button type="button" onClick={() => setManualRotation(0)} disabled={isProcessing} className="px-2 py-1 text-[10px] font-bold text-stone-500 hover:text-stone-800 disabled:opacity-50">Reset</button>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={invertManual} onChange={(e) => setInvertManual(e.target.checked)} disabled={isProcessing} className="w-4 h-4 rounded accent-emerald-600" />
              <span className="text-xs font-semibold text-stone-700">Invertir colores (para imágenes en negativo)</span>
            </label>
            <div className="pt-2 border-t border-stone-200">
              <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-amber-50 transition-colors">
                <input type="checkbox" checked={autoRotateEnabled} onChange={(e) => setAutoRotateEnabled(e.target.checked)} disabled={isProcessing} className="w-4 h-4 rounded accent-amber-600 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-amber-900 block">🔄 Activar auto-rotación automática</span>
                  <span className="text-[10px] text-stone-500 leading-snug block mt-0.5">
                    Solo usar si la imagen está <strong>muy inclinada</strong> (más de 10°). Puede rotar incorrectamente fierros con protuberancias asimétricas.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePreprocess}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 shadow-md active:scale-95"
            >
              {processState === 'preprocessing' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Preprocesando (11 ángulos)...</span></>
              ) : (
                <><Sparkles className="w-4 h-4" /><span>{preprocessedImage ? 'Re-preprocesar' : 'Preprocesar Imagen'}</span></>
              )}
            </button>
            <button
              type="button"
              onClick={handleVectorize}
              disabled={isProcessing || (!preprocessedImage && !uploadedImage)}
              className="px-4 py-2.5 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 shadow-md active:scale-95"
            >
              {processState === 'vectorizing' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Vectorizando...</span></>
              ) : (
                <><RefreshCw className="w-4 h-4" /><span>{embedding ? 'Re-vectorizar' : 'Vectorizar Fierro'}</span></>
              )}
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2">
          <X className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold block">Error:</strong>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {autoRotateEnabled && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2">
          <span className="text-base shrink-0">⚠️</span>
          <div>
            <strong className="font-bold block">Auto-rotación ACTIVA</strong>
            <p className="mt-0.5 text-[11px]">El sistema probará 11 ángulos y elegirá el de mejor ajuste. Esto puede tardar 10-15 segundos por imagen.</p>
          </div>
        </div>
      )}

      {preprocessMeta && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl p-3 text-xs text-blue-950 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Metadatos del preprocesamiento ({preprocessMeta.processingTimeMs}ms):</p>
            <ul className="list-disc list-inside text-[11px] space-y-0.5">
              {preprocessMeta.wasInverted && <li>Imagen invertida (negativo → positivo)</li>}
              <li>
                Rotación aplicada: <strong>{preprocessMeta.rotationAngle}°</strong>
                {preprocessMeta.rotationAngle !== 0 && <span className="text-blue-700"> (confianza {(preprocessMeta.rotationConfidence * 100).toFixed(0)}%)</span>}
                {preprocessMeta.rotationAngle === 0 && <span className="text-blue-700"> (sin rotación necesaria)</span>}
              </li>
            </ul>
          </div>
        </div>
      )}

      {embedding && (
        <div className="bg-white border-2 border-emerald-400 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-stone-200 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-emerald-950 block">Fierro Vectorizado Exitosamente</span>
                <span className="text-[10px] text-stone-500 font-mono">{embedding.checksum}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                Densidad: {(embedding.density * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-300">
                Trazos: {embedding.heavyCellCount ?? 0}/256
              </span>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-stone-500 block mb-1.5">Matriz 16×16 del vector</span>
            <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5 p-2 bg-stone-100 rounded-lg">
              {embedding.embedding.map((val, i) => {
                const isDark = val > 0.70;
                const isMed = val >= 0.40 && val <= 0.70;
                const bg = isDark ? '#1c1917' : isMed ? '#f59e0b' : '#ffffff';
                const fg = isDark || isMed ? '#ffffff' : '#94a3b8';
                return (
                  <div key={i} style={{ backgroundColor: bg, color: fg }} className="h-6 rounded flex items-center justify-center text-[8px] font-mono border border-stone-300" title={`Celda #${i + 1}: ${val.toFixed(4)}`}>
                    {val.toFixed(2)}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-stone-600 font-mono">
            <span>Simetría H: <strong className="text-stone-800">{embedding.symmetryH.toFixed(1)}%</strong></span>
            <span>Simetría V: <strong className="text-stone-800">{embedding.symmetryV.toFixed(1)}%</strong></span>
            <span>Proporción: <strong className="text-stone-800">{embedding.proportions}</strong></span>
            <span>Varianza: <strong className="text-stone-800">{embedding.variance}</strong></span>
          </div>
          <div className="pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={handleUseInExpediente}
              className="w-full px-5 py-3 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ring-2 ring-amber-500/30 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{useForCertificateLabel}</span>
            </button>
          </div>
        </div>
      )}

      {showAntiModal && pendingEmbedding && (
        <AntiduplicidadModal
          isOpen={showAntiModal}
          onClose={() => {
            setShowAntiModal(false);
            setPendingEmbedding(null);
          }}
          newVector={pendingEmbedding.embedding}
          newImageSrc={preprocessedImage || uploadedImage || ''}
          newChecksum={pendingEmbedding.checksum}
          allRecords={allRecordsForComparison}
          isLoading={isLoadingRecords}
          onLinkToExpediente={handleLinkToExpediente}
          onEditWithPen={() => console.log('[Antiduplicidad] Edit with pen clicked')}
          onUploadEdited={() => {
            console.log('[Antiduplicidad] Upload edited clicked');
            setShowAntiModal(false);
            setPendingEmbedding(null);
            handleReset();
          }}
          onGenerateProposals={() => console.log('[Antiduplicidad] Generate proposals clicked')}
          onAcceptAndContinue={handleAcceptWithAdvertencia}
        />
      )}
    </div>
  );
};
