import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Scan,
  Camera,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  RotateCw,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Check,
  FileCheck,
  Layers,
  FlipHorizontal,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  cleanIneName,
  crossValidateCurp,
  crossValidateRfc,
  calculateRealConfidenceScore,
  computeExpectedInitials,
} from '../utils/ineOcrUtils';

export interface IneScanResult {
  fullName: string;
  names?: string;
  firstLastName?: string;
  secondLastName?: string;
  curp: string;
  rfc: string;
  ine: string;
  address: string;
  municipio: string;
  state: string;
  ejido: string;
  section?: string;
  validity?: string;
  cic?: string;
  birthDate?: string;
  gender?: 'H' | 'M';
  suggestedInitials: string;
  confidenceScore?: number;
  confidenceLevel?: 'alta' | 'media' | 'baja';
  fieldStatus?: {
    name: 'valido' | 'alerta' | 'error';
    curp: 'valido' | 'alerta' | 'error';
    rfc: 'valido' | 'alerta' | 'error';
    address: 'valido' | 'alerta' | 'error';
    ine: 'valido' | 'alerta' | 'error';
  };
  validationErrors?: string[];
  crossValidationWarnings?: string[];
  notes?: string;
  scannedImagePreview?: string;
}

interface IneScannerProps {
  onAcceptData: (data: IneScanResult) => void;
  currentProducerName?: string;
  ejidosList?: string[];
}

const PANUCO_EJIDOS_LIST = [
  'Reventadero',
  'Tamos',
  'Villa Cacalilao',
  'Canoas',
  'Moralillo',
  'Bermúdez',
  'Oviedo',
  'Topila',
  'Corcovado',
  'Mahuaves',
  'El Barco',
  'Tancheche',
  'Calentadores',
  'Ex-Hacienda Chintón',
  'Mayorazgo',
  'Ánimas',
  'La Trinidad',
  'Vega de Otates',
  'Tampiquito',
];

/**
 * Aplica transformaciones físicas (rotación y espejo) a una imagen mediante un elemento Canvas,
 * devolviendo la nueva imagen en formato base64 con los píxeles físicamente reorientados.
 */
function applyTransformToImage(
  sourceUrl: string,
  rotationAngle: number,
  flipHorizontal: boolean
): Promise<string> {
  return new Promise((resolve) => {
    if (rotationAngle === 0 && !flipHorizontal) {
      resolve(sourceUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const is90or270 = rotationAngle === 90 || rotationAngle === 270;
      const targetW = is90or270 ? img.naturalHeight || img.height : img.naturalWidth || img.width;
      const targetH = is90or270 ? img.naturalWidth || img.width : img.naturalHeight || img.height;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceUrl);
        return;
      }

      ctx.save();
      ctx.translate(targetW / 2, targetH / 2);
      ctx.rotate((rotationAngle * Math.PI) / 180);
      if (flipHorizontal) {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(
        img,
        -(img.naturalWidth || img.width) / 2,
        -(img.naturalHeight || img.height) / 2
      );
      ctx.restore();

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(sourceUrl);
    img.src = sourceUrl;
  });
}

export const IneScanner: React.FC<IneScannerProps> = ({
  onAcceptData,
  currentProducerName,
  ejidosList = PANUCO_EJIDOS_LIST,
}) => {
  type ScannerMode = 'idle' | 'camera' | 'adjusting' | 'scanning' | 'verifying' | 'alert' | 'applied';

  const [mode, setMode] = useState<ScannerMode>('idle');
  const [rawCapturedImage, setRawCapturedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showRoiGrid, setShowRoiGrid] = useState<boolean>(true);

  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [cameraOrientationGuide, setCameraOrientationGuide] = useState<'horizontal' | 'vertical'>('horizontal');

  const [verifyingData, setVerifyingData] = useState<IneScanResult | null>(null);

  const liveValidation = useMemo(() => {
    if (!verifyingData) return null;

    const nameParsed = cleanIneName(verifyingData.fullName || '');
    const curpVal = crossValidateCurp(
      verifyingData.curp || '',
      nameParsed.firstLastName,
      nameParsed.secondLastName,
      nameParsed.names
    );
    const rfcVal = crossValidateRfc(
      verifyingData.rfc || '',
      nameParsed.firstLastName,
      nameParsed.secondLastName,
      nameParsed.names,
      verifyingData.curp
    );
    const isAddressValid = Boolean(verifyingData.address && verifyingData.address.trim().length >= 6);
    const isIneValid = Boolean(verifyingData.ine && verifyingData.ine.trim().length >= 10);

    const confidenceResult = calculateRealConfidenceScore({
      isNameValid: nameParsed.isValid,
      nameWordsCount: nameParsed.fullName.split(/\s+/).filter(Boolean).length,
      noiseTokensCount: nameParsed.noiseDetected.length,
      isCurpValidFormat: curpVal.isValidFormat,
      curpMatchesName: curpVal.matchesName,
      hasCurp: Boolean(verifyingData.curp && verifyingData.curp.trim().length > 0),
      isRfcValidFormat: rfcVal.isValidFormat,
      rfcMatchesName: rfcVal.matchesName,
      hasRfc: Boolean(verifyingData.rfc && verifyingData.rfc.trim().length > 0),
      isAddressDetailed: isAddressValid,
      hasAddress: Boolean(verifyingData.address && verifyingData.address.trim().length > 0),
      hasIneKey: isIneValid,
    });

    const alerts: string[] = [];
    if (verifyingData.curp && !curpVal.isValidFormat) {
      alerts.push('CURP con formato inválido (debe tener exactamente 18 caracteres alfanuméricos oficiales).');
    } else if (verifyingData.curp && !curpVal.matchesName) {
      alerts.push(`Incongruencia crítica en CURP: ${curpVal.errorMessage || 'No coincide con el nombre del titular'}.`);
    } else if (!verifyingData.curp) {
      alerts.push('CURP no detectada o ilegible. Campo dejado en blanco para captura manual obligatoria.');
    }

    if (verifyingData.rfc && !rfcVal.isValidFormat) {
      alerts.push('RFC con formato no válido.');
    } else if (verifyingData.rfc && !rfcVal.matchesName) {
      alerts.push(`Incongruencia en RFC: ${rfcVal.errorMessage || 'No coincide con las iniciales del titular'}.`);
    } else if (!verifyingData.rfc) {
      alerts.push('RFC dejado en blanco para verificación manual del operador.');
    }

    if (!verifyingData.address || verifyingData.address.trim().length < 6) {
      alerts.push('Domicilio incompleto o no detectado. Ingrese calle y número visibles en el plástico.');
    }

    return {
      nameParsed,
      curpVal,
      rfcVal,
      isAddressValid,
      isIneValid,
      confidenceScore: confidenceResult.score,
      confidenceLevel: confidenceResult.level,
      alerts,
    };
  }, [verifyingData]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const handleStartCamera = async () => {
    setCameraError(null);
    setErrorMessage(null);
    setMode('camera');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraError(
        'No se pudo acceder a la cámara. Verifique los permisos del navegador o use la opción de subir fotografía.'
      );
    }
  };

  const handleCaptureCamera = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

      stopCameraStream();
      setRawCapturedImage(dataUrl);
      setImagePreview(dataUrl);
      setRotationDegrees(cameraOrientationGuide === 'vertical' ? 90 : 0);
      setIsFlipped(false);
      setErrorMessage(null);
      setMode('adjusting');
    } catch (err) {
      console.warn('Error capturing camera frame:', err);
      setErrorMessage('Error al capturar la imagen de la cámara.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setRawCapturedImage(dataUrl);
      setImagePreview(dataUrl);
      setRotationDegrees(0);
      setIsFlipped(false);
      setMode('adjusting');
    };
    reader.onerror = () => {
      setErrorMessage('Error al leer el archivo de imagen seleccionado.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRotateCw = () => {
    setRotationDegrees((prev) => (prev + 90) % 360);
  };

  const handleRotateCcw = () => {
    setRotationDegrees((prev) => (prev - 90 + 360) % 360);
  };

  const handleSetOrientation = (orientation: 'horizontal' | 'vertical') => {
    if (orientation === 'horizontal') {
      setRotationDegrees(0);
    } else {
      setRotationDegrees(90);
    }
  };

  const handleToggleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleResetOrientation = () => {
    setRotationDegrees(0);
    setIsFlipped(false);
  };

  const handleProcessFromAdjusting = async () => {
    if (!rawCapturedImage) return;

    setIsProcessing(true);
    setMode('scanning');

    try {
      const transformedImage = await applyTransformToImage(
        rawCapturedImage,
        rotationDegrees,
        isFlipped
      );
      setImagePreview(transformedImage);
      await executeOcrExtraction(transformedImage, 'image/jpeg');
    } catch (err: any) {
      console.warn('Error transformando imagen:', err);
      await executeOcrExtraction(rawCapturedImage, 'image/jpeg');
    }
  };

  const executeOcrExtraction = async (
    imageBase64: string,
    mimeType: string,
    sampleId?: string
  ) => {
    setImagePreview(imageBase64);
    setMode('scanning');
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/ai/scan-ine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          sampleId,
        }),
      });

      let result: any = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (response.ok && result && result.success && result.data) {
        setRawCapturedImage(imageBase64);
        setImagePreview(imageBase64);
        setRotationDegrees(0);
        setIsFlipped(false);
        setVerifyingData({
          ...result.data,
          scannedImagePreview: imageBase64,
        });
        setMode('verifying');
      } else if (!response.ok && !result) {
        setErrorMessage(
          'El servicio de lectura está saturado o no disponible en este momento. Espere unos segundos e intente de nuevo.'
        );
        setMode('alert');
      } else {
        const errorDesc =
          (result && result.error) ||
          'No se pudo transcribir la credencial. Verifique que la imagen esté nítida y orientada correctamente (horizontal o vertical).';
        setErrorMessage(errorDesc);
        setMode('alert');
      }
    } catch (err: any) {
      console.warn('Error en llamada a endpoint OCR:', err);
      setErrorMessage(
        'El motor óptico no pudo procesar la credencial. Asegúrese de que el documento esté bien iluminado y ajustado en posición horizontal o vertical.'
      );
      setMode('alert');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecheckOcrFromVerifying = async () => {
    if (!rawCapturedImage && !verifyingData?.scannedImagePreview) return;
    const baseImg = rawCapturedImage || verifyingData?.scannedImagePreview || '';

    setIsProcessing(true);
    setMode('scanning');

    try {
      const transformedImage = await applyTransformToImage(
        baseImg,
        rotationDegrees,
        isFlipped
      );
      await executeOcrExtraction(transformedImage, 'image/jpeg');
    } catch (err) {
      await executeOcrExtraction(baseImg, 'image/jpeg');
    }
  };

  const handleConfirmAndApply = () => {
    if (!verifyingData) return;
    onAcceptData(verifyingData);
    setMode('applied');
  };

  const handleResetScanner = () => {
    stopCameraStream();
    setImagePreview(null);
    setRawCapturedImage(null);
    setVerifyingData(null);
    setErrorMessage(null);
    setRotationDegrees(0);
    setIsFlipped(false);
    setMode('idle');
  };

  const handleReturnToAdjust = () => {
    if (!rawCapturedImage) {
      if (imagePreview) {
        setRawCapturedImage(imagePreview);
      } else if (verifyingData?.scannedImagePreview) {
        setRawCapturedImage(verifyingData.scannedImagePreview);
      }
    }
    setErrorMessage(null);
    setMode('adjusting');
  };

  const isCurrentlyVertical = rotationDegrees === 90 || rotationDegrees === 270;
  const orientationLabel = isCurrentlyVertical
    ? `Vertical (${rotationDegrees}°)`
    : `Horizontal (${rotationDegrees}° - Estándar INE)`;

  return (
    <div className="w-full mb-6 transition-all duration-300">
      {/* STATE 1: IDLE / COMPACT SCANNER TRIGGER */}
      {mode === 'idle' && (
        <div className="bg-gradient-to-r from-emerald-900 via-stone-900 to-amber-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border-2 border-emerald-600/40 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full border border-amber-500/20 pointer-events-none" />
          <div className="absolute right-4 top-2 text-stone-500/10 pointer-events-none font-cinzel font-black text-7xl select-none">
            INE
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 uppercase tracking-widest font-mono-data">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Módulo de Captura Oficial
                </span>
                <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider font-cinzel">
                  Pánuco, Ver.
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-cinzel font-black tracking-wide text-amber-100 flex items-center gap-2">
                <Scan className="w-5 h-5 text-emerald-400 shrink-0" />
                Lector Óptico OCR de Credencial INE / IFE
              </h3>
              <p className="text-xs sm:text-[13px] text-stone-300 leading-snug">
                Llenado rápido automático: escanee o fotografíe la credencial de elector del productor para transcribir su <strong>Nombre</strong>, <strong>CURP</strong>, <strong>RFC</strong>, <strong>Clave de Elector</strong> y <strong>Domicilio ejidal</strong> sin errores manuales.
              </p>
            </div>

            {/* Acquisition Buttons Group */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/30 hover:scale-102"
                title="Subir archivo de imagen (PNG, JPG, WebP) de la credencial"
              >
                <UploadCloud className="w-4 h-4 text-emerald-200" />
                <span>Subir Foto INE</span>
              </button>

              <button
                type="button"
                onClick={handleStartCamera}
                className="px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-stone-900 text-amber-200 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer border border-amber-500/30 hover:scale-102"
                title="Abrir cámara del dispositivo para capturar credencial en vivo"
              >
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Escanear con Cámara</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATE 2: LIVE CAMERA STREAM */}
      {mode === 'camera' && (
        <div className="bg-stone-900 text-white rounded-2xl p-4 sm:p-5 shadow-2xl border-2 border-emerald-500 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400 animate-pulse" />
              <h3 className="font-cinzel font-bold text-sm sm:text-base text-amber-100">
                Alineación Óptica de Credencial INE
              </h3>
            </div>

            <div className="flex items-center gap-1 bg-stone-800 px-2 py-1 rounded-lg border border-stone-700">
              <span className="text-[10px] text-stone-400 font-bold uppercase mr-1">Guía:</span>
              <button
                type="button"
                onClick={() => setCameraOrientationGuide('horizontal')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  cameraOrientationGuide === 'horizontal'
                    ? 'bg-emerald-600 text-white'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                Horizontal
              </button>
              <button
                type="button"
                onClick={() => setCameraOrientationGuide('vertical')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  cameraOrientationGuide === 'vertical'
                    ? 'bg-emerald-600 text-white'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                Vertical
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetScanner}
              className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {cameraError ? (
            <div className="p-4 bg-rose-950/80 border border-rose-600 rounded-xl text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-xs text-rose-200">{cameraError}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                Subir Foto desde Archivo
              </button>
            </div>
          ) : (
            <div className="relative flex flex-col items-center">
              <div
                className={`relative w-full max-w-xl ${
                  cameraOrientationGuide === 'vertical' ? 'aspect-[0.72] max-w-xs' : 'aspect-[1.58]'
                } bg-black rounded-xl overflow-hidden border-2 border-dashed border-emerald-400 shadow-inner flex items-center justify-center transition-all duration-300`}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                <div className="absolute inset-4 sm:inset-6 border-2 border-emerald-400/90 rounded-xl pointer-events-none flex flex-col justify-between p-3 bg-emerald-500/5 shadow-[0_0_20px_rgba(52,211,153,0.2)]">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono-data text-emerald-300 font-bold bg-black/70 px-2 py-0.5 rounded">
                      [INE / IFE OFICIAL]
                    </span>
                    <span className="text-[10px] font-mono-data text-amber-300 font-bold bg-black/70 px-2 py-0.5 rounded uppercase">
                      {cameraOrientationGuide}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] sm:text-xs font-sans font-semibold text-white drop-shadow-md bg-black/75 px-3 py-1 rounded-full inline-block border border-white/20">
                      Enfoque la credencial dentro del recuadro
                    </span>
                  </div>
                  <div className="flex justify-between items-end text-[9px] font-mono-data text-stone-400">
                    <span>NOMBRE Y CURP</span>
                    <span>CLAVE DE ELECTOR</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleCaptureCamera}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm shadow-lg transition-all flex items-center gap-2 cursor-pointer ring-4 ring-emerald-500/20"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capturar Fotografía</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetScanner}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATE 3: MANUAL POSITION & ORIENTATION ADJUSTER */}
      {mode === 'adjusting' && rawCapturedImage && (
        <div className="bg-stone-900 text-white rounded-2xl p-4 sm:p-5 shadow-2xl border-2 border-amber-500/60 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-800 mb-4 gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono-data block">
                Paso de Ajuste Previo
              </span>
              <h3 className="font-cinzel font-black text-sm sm:text-base text-amber-100 flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-amber-400" />
                Ajuste Manual de Posición y Orientación de la Credencial
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono-data px-2.5 py-1 bg-stone-800 text-amber-300 rounded-lg border border-amber-500/30">
                {orientationLabel}
              </span>
              <button
                type="button"
                onClick={handleResetScanner}
                className="text-stone-400 hover:text-white p-1 rounded hover:bg-stone-800 transition-colors"
                title="Cancelar y volver"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mb-4 p-3 bg-stone-950/80 rounded-xl border border-stone-800 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-stone-300 mr-1 flex items-center gap-1">
                📐 Posición:
              </span>
              <button
                type="button"
                onClick={() => handleSetOrientation('horizontal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  !isCurrentlyVertical && rotationDegrees === 0
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/30'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                <span>🔄 Horizontal (0° INE)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetOrientation('vertical')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isCurrentlyVertical && rotationDegrees === 90
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/30'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                <span>🔄 Vertical (90°)</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRotateCcw}
                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                title="Girar 90 grados a la izquierda (antihorario)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>-90°</span>
              </button>
              <button
                type="button"
                onClick={handleRotateCw}
                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                title="Girar 90 grados a la derecha (horario)"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                <span>+90°</span>
              </button>
              <button
                type="button"
                onClick={() => setRotationDegrees((prev) => (prev + 180) % 360)}
                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                title="Girar 180 grados (invertir)"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>180°</span>
              </button>
              <button
                type="button"
                onClick={handleToggleFlip}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  isFlipped ? 'bg-amber-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                }`}
                title="Voltear horizontalmente (espejo)"
              >
                <FlipHorizontal className="w-3.5 h-3.5 text-amber-300" />
                <span>Espejo</span>
              </button>
              <button
                type="button"
                onClick={handleResetOrientation}
                className="px-2 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs transition-colors cursor-pointer"
                title="Restablecer posición inicial"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowRoiGrid((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  showRoiGrid ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400/40' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
                title="Mostrar u ocultar cuadrícula de segmentación por Regiones de Interés (Grid INE / ROI)"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-300" />
                <span>Grid INE (ROI)</span>
              </button>
            </div>
          </div>

          <div className="relative w-full max-w-xl mx-auto min-h-[220px] max-h-[360px] bg-black/90 rounded-xl overflow-hidden border-2 border-stone-700 p-3 flex items-center justify-center">
            <img
              src={rawCapturedImage}
              alt="Credencial en ajuste"
              style={{
                transform: `rotate(${rotationDegrees}deg) scaleX(${isFlipped ? -1 : 1})`,
                maxWidth: isCurrentlyVertical ? '240px' : '100%',
                maxHeight: '320px',
                objectFit: 'contain',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              className="drop-shadow-2xl rounded"
            />

            <div className="absolute inset-4 border border-dashed border-emerald-400/40 rounded-lg pointer-events-none flex flex-col justify-between p-2">
              <span className="text-[9px] font-mono-data text-emerald-300 bg-black/60 px-1.5 py-0.5 rounded self-start">
                {isCurrentlyVertical ? 'MODO VERTICAL' : 'MODO HORIZONTAL'}
              </span>
              <span className="text-[9px] font-mono-data text-amber-300 bg-black/60 px-1.5 py-0.5 rounded self-end">
                {rotationDegrees}°
              </span>
            </div>

            {showRoiGrid && !isCurrentlyVertical && (
              <div className="absolute inset-4 pointer-events-none rounded border border-emerald-500/30 overflow-hidden">
                <div className="absolute left-[3%] top-[19%] w-[23%] h-[58%] border-2 border-dashed border-rose-400/70 rounded-md flex flex-col items-center justify-center bg-rose-950/25 p-1 text-center">
                  <span className="text-[8px] font-mono-data font-bold text-rose-300 uppercase tracking-tighter">Zona Excluida</span>
                  <span className="text-[7.5px] font-sans text-rose-200">Fotografía</span>
                </div>

                <div className="absolute left-[28%] top-[19%] w-[49%] h-[59%] border-2 border-emerald-400 rounded-md flex flex-col justify-between p-1.5 bg-emerald-500/15 shadow-[0_0_15px_rgba(52,211,153,0.35)]">
                  <div className="flex justify-between items-center text-[8px] font-mono-data font-bold text-emerald-300">
                    <span className="bg-emerald-900/80 px-1 rounded">✓ ROI TEXTO AISLADO</span>
                    <span>NOMBRE / CURP</span>
                  </div>
                  <div className="text-[7.5px] font-mono-data text-emerald-200 text-center font-bold">
                    DOMICILIO OFICIAL &amp; RFC
                  </div>
                  <div className="flex justify-between items-center text-[7.5px] font-mono-data text-emerald-300">
                    <span>CLAVE ELECTOR</span>
                    <span className="text-emerald-400">SIN RUIDO</span>
                  </div>
                </div>

                <div className="absolute right-[3%] top-[20%] w-[17%] h-[44%] border-2 border-dashed border-amber-400/70 rounded-md flex flex-col items-center justify-center bg-amber-950/25 p-0.5 text-center">
                  <span className="text-[7.5px] font-mono-data font-bold text-amber-300">Excluido</span>
                  <span className="text-[7px] font-sans text-amber-200">Holograma</span>
                </div>

                <div className="absolute left-[28%] bottom-[3%] w-[69%] h-[13%] border-2 border-dashed border-stone-400/70 rounded-md flex items-center justify-center bg-black/60">
                  <span className="text-[7.5px] font-mono-data text-stone-300 uppercase tracking-wider">
                    Código Óptico MRZ (Excluido)
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-stone-400 mt-3 font-mono-data">
            💡 Asegúrese de que el texto de la credencial (Nombre, CURP) esté orientado horizontalmente de izquierda a derecha antes de procesar el OCR.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-stone-800">
            <button
              type="button"
              onClick={handleProcessFromAdjusting}
              disabled={isProcessing}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-98 text-white font-cinzel font-black text-sm shadow-xl transition-all flex items-center gap-2 cursor-pointer ring-4 ring-emerald-500/25"
            >
              <Scan className="w-5 h-5 text-emerald-200" />
              <span>Procesar Lectura Óptica OCR</span>
            </button>
            <button
              type="button"
              onClick={handleResetScanner}
              className="px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancelar / Tomar Otra
            </button>
          </div>
        </div>
      )}

      {/* STATE 4: SCANNING & OCR EXTRACTION */}
      {mode === 'scanning' && (
        <div className="bg-stone-900 text-white rounded-2xl p-6 shadow-2xl border-2 border-emerald-500 flex flex-col items-center justify-center text-center animate-fadeIn">
          <div className="relative w-72 h-44 sm:w-80 sm:h-48 rounded-xl overflow-hidden border-2 border-emerald-400 shadow-xl mb-4 bg-black/80 flex items-center justify-center">
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Documento INE"
                style={{
                  transform: `rotate(${rotationDegrees}deg) scaleX(${isFlipped ? -1 : 1})`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  opacity: 0.75,
                }}
              />
            )}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-bounce" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
              <h3 className="font-cinzel font-bold text-base text-amber-200">
                Transcribiendo Credencial de Elector con Motor Óptico...
              </h3>
            </div>
            <p className="text-xs text-stone-300 font-mono-data">
              Extrayendo Nombre Completo, Clave de Elector, CURP, RFC y Domicilio Oficial...
            </p>
          </div>
        </div>
      )}

      {/* STATE 5: MANDATORY ERROR ALERT */}
      {mode === 'alert' && (
        <div className="bg-gradient-to-b from-rose-950 via-stone-900 to-stone-950 border-2 border-rose-600 rounded-2xl p-5 sm:p-6 shadow-2xl animate-fadeIn text-white">
          <div className="flex items-start gap-3.5 mb-4">
            <div className="p-3 bg-rose-600/30 text-rose-400 border border-rose-500/50 rounded-2xl shrink-0">
              <AlertTriangle className="w-7 h-7 text-rose-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-300 font-mono-data bg-rose-900/60 px-2 py-0.5 rounded border border-rose-500/40">
                Alerta del Lector Óptico OCR
              </span>
              <h3 className="text-base sm:text-lg font-cinzel font-black text-rose-100">
                No se pudo realizar la lectura de la credencial
              </h3>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                {errorMessage ||
                  'No se detectó una credencial para votar INE/IFE válida en la imagen analizada, o el texto es ilegible.'}
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-black/40 border border-rose-500/30 rounded-xl mb-5 space-y-2 text-xs text-stone-300">
            <strong className="text-amber-300 flex items-center gap-1.5">
              <span>🔍</span> Causas frecuentes y recomendaciones operativas:
            </strong>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-stone-300">
              <li>
                <strong>Orientación invertida o vertical:</strong> La credencial puede estar de lado o boca abajo. Use el botón de <em>Ajustar Posición</em> para girarla 90° o 180°.
              </li>
              <li>
                <strong>Falta de nitidez o reflejo:</strong> Si la credencial tiene reflejos de luz o está desenfocada, capture una nueva fotografía.
              </li>
              <li>
                <strong>Documento recortado:</strong> Asegúrese de que el frente completo de la credencial (con nombre y clave de elector) aparezca dentro de la foto.
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-rose-900/50">
            <div className="flex flex-wrap items-center gap-2">
              {(rawCapturedImage || imagePreview) && (
                <button
                  type="button"
                  onClick={handleReturnToAdjust}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer ring-2 ring-amber-400/50"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Ajustar Posición (Horizontal / Vertical)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleStartCamera}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Tomar Otra Foto</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4 text-cyan-400" />
                <span>Subir Otra Imagen</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetScanner}
                className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white text-xs cursor-pointer"
              >
                Descartar Alerta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATE 6: VERIFICATION & EDIT VIEW */}
      {mode === 'verifying' && verifyingData && (
        <div className="bg-white border-2 border-emerald-600 rounded-2xl p-4 sm:p-6 shadow-xl animate-fadeIn relative text-stone-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-emerald-500/40 gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block font-mono-data">
                  Lectura OCR Exitosa · Cotejo Obligatorio
                </span>
                <h3 className="font-cinzel font-black text-base sm:text-lg text-stone-900">
                  Verificación de Datos Extraídos de la Credencial INE
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(() => {
                const displayScore: number = liveValidation ? liveValidation.confidenceScore : (verifyingData.confidenceScore ?? 0);
                const isLowScore = displayScore < 70;
                const isMediumScore = displayScore >= 70 && displayScore < 85;

                return (
                  <span
                    className={`text-xs font-mono-data font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 shadow-2xs ${
                      isLowScore
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : isMediumScore
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Confiabilidad Real: <strong>{displayScore}%</strong></span>
                    <span
                      className={`text-[9.5px] uppercase font-black px-1.5 py-0.5 rounded ${
                        isLowScore
                          ? 'bg-rose-200 text-rose-900'
                          : isMediumScore
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-emerald-200 text-emerald-900'
                      }`}
                    >
                      {isLowScore ? 'Baja · Cotejo Forzoso' : isMediumScore ? 'Media' : 'Alta (Óptima)'}
                    </span>
                  </span>
                );
              })()}

              <button
                type="button"
                onClick={handleResetScanner}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                title="Cerrar y descartar escaneo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {(() => {
            const displayScore: number = liveValidation ? liveValidation.confidenceScore : (verifyingData.confidenceScore ?? 0);
            const isLowScore = displayScore < 70;

            return (
              <div
                className={`mb-4 p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                  isLowScore
                    ? 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs'
                    : 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
                }`}
              >
                <AlertCircle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    isLowScore ? 'text-rose-600' : 'text-amber-700'
                  }`}
                />
                <div className="space-y-1">
                  <p>
                    <strong>Instrucción Obligatoria para el Operador:</strong> Revise que cada campo transcrito coincida fielmente con el plástico de la credencial oficial.
                    Dado que el OCR óptico es propenso a fallas incluso en fotos nítidas, <strong>la corrección manual es obligatoria para campos críticos como CURP, RFC y Domicilio</strong>.
                  </p>
                  <p className="text-[11px] text-stone-700">
                    Por seguridad jurídica y para evitar datos inventados o incongruentes, si un campo no se leyó con total certeza se deja en blanco para que usted lo capture manualmente. Edite cualquier campo directamente en este panel antes de pulsar <strong>"Aceptar y Llenar Expediente"</strong>.
                  </p>
                </div>
              </div>
            );
          })()}

          {liveValidation && liveValidation.alerts.length > 0 && (
            <div className="mb-4 p-3 bg-rose-50 border-2 border-rose-400/80 rounded-xl space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs uppercase tracking-wider font-mono-data">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Observaciones del Motor de Validación Cruzada (Cotejo Requerido):</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1 text-xs text-rose-900 font-medium">
                {liveValidation.alerts.map((alertMsg, idx) => (
                  <li key={idx}>{alertMsg}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-4 flex flex-col items-center bg-stone-50 border border-stone-200 rounded-xl p-3 shadow-xs">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 font-mono-data">
                  Documento Escaneado
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleReturnToAdjust}
                    className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 mr-1"
                    title="Abrir ajustador manual de posición (horizontal / vertical)"
                  >
                    <RotateCw className="w-2.5 h-2.5 text-amber-700" />
                    <span>Ajustar Posición</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetOrientation('horizontal')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      !isCurrentlyVertical
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                    }`}
                    title="Forzar orientación horizontal"
                  >
                    Horiz
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetOrientation('vertical')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      isCurrentlyVertical
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                    }`}
                    title="Forzar orientación vertical"
                  >
                    Vert
                  </button>
                  <button
                    type="button"
                    onClick={handleRotateCw}
                    className="p-1 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                    title="Girar 90°"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="w-full aspect-[1.58] bg-stone-200 rounded-lg overflow-hidden border border-stone-300 shadow-sm flex items-center justify-center relative">
                {verifyingData.scannedImagePreview ? (
                  <img
                    src={verifyingData.scannedImagePreview}
                    alt="Credencial INE"
                    style={{
                      transform: `rotate(${rotationDegrees}deg) scaleX(${isFlipped ? -1 : 1})`,
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                ) : (
                  <CreditCard className="w-12 h-12 text-stone-400" />
                )}
                <div className="absolute bottom-1 right-1 bg-emerald-800 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-xs">
                  Vigencia: {verifyingData.validity || '2026 - 2029'}
                </div>
              </div>

              {rotationDegrees !== 0 && (
                <button
                  type="button"
                  onClick={handleRecheckOcrFromVerifying}
                  className="mt-2 w-full py-1.5 px-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3 text-amber-700" />
                  <span>Reintentar OCR con este ángulo</span>
                </button>
              )}

              <div className="w-full mt-3 space-y-1 text-[11px] text-stone-600 border-t border-stone-200 pt-2 font-mono-data">
                <div className="flex justify-between">
                  <span className="text-stone-400">Sección:</span>
                  <span className="font-bold text-stone-800">{verifyingData.section || '2841'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Estado:</span>
                  <span className="font-bold text-stone-800">{verifyingData.state || '30 - VERACRUZ'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Iniciales Sugeridas:</span>
                  <span className="font-bold text-[#831843] bg-amber-100 px-1.5 rounded">
                    "{verifyingData.suggestedInitials || ''}"
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                    Nombre Completo del Productor (Titular de la Credencial) *
                  </label>
                  {liveValidation?.nameParsed.isValid ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> Solo alfabético
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Revisar nombre (sin prefijos)
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={verifyingData.fullName}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      const parsed = cleanIneName(val);
                      const initialsObj = computeExpectedInitials(parsed.firstLastName, parsed.secondLastName, parsed.names);
                      setVerifyingData({
                        ...verifyingData,
                        fullName: val,
                        suggestedInitials: initialsObj.suggestedInitials || verifyingData.suggestedInitials,
                      });
                    }}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-cinzel font-bold text-stone-900 border-2 border-emerald-400 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-emerald-50/20"
                    placeholder="NOMBRE(S) APELLIDO PATERNO APELLIDO MATERNO"
                  />
                  <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-2.5" />
                </div>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  Debe contener únicamente nombres y apellidos (sin términos como SEXO, EDAD o etiquetas de credencial).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                      CURP (18 Caracteres) *
                    </label>
                    {liveValidation?.curpVal.isValidFormat && liveValidation.curpVal.matchesName ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Coincide con titular
                      </span>
                    ) : liveValidation?.curpVal.isValidFormat && !liveValidation.curpVal.matchesName ? (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <AlertCircle className="w-3 h-3" /> Incongruente
                      </span>
                    ) : !verifyingData.curp ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        Captura manual
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full">
                        Formato inválido
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={18}
                    value={verifyingData.curp}
                    onChange={(e) =>
                      setVerifyingData({ ...verifyingData, curp: e.target.value.toUpperCase().trim() })
                    }
                    className={`w-full px-3 py-2 text-xs sm:text-sm font-mono-data font-bold text-stone-900 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      liveValidation?.curpVal.isValidFormat && liveValidation.curpVal.matchesName
                        ? 'border-emerald-400 bg-emerald-50/20'
                        : verifyingData.curp
                        ? 'border-rose-400 bg-rose-50/30'
                        : 'border-amber-400 bg-amber-50/20'
                    }`}
                    placeholder="18 caracteres alfanuméricos"
                  />
                  <p className={`text-[10px] mt-0.5 ${!liveValidation?.curpVal.matchesName && verifyingData.curp ? 'text-rose-600 font-semibold' : 'text-stone-500'}`}>
                    {verifyingData.curp
                      ? liveValidation?.curpVal.errorMessage || 'Validado con formato oficial'
                      : 'Requerido: 18 caracteres. Si no fue legible, capture la CURP visible en el plástico.'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                      R.F.C. con Homoclave *
                    </label>
                    {liveValidation?.rfcVal.isValidFormat && liveValidation.rfcVal.matchesName ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Válido y Coherente
                      </span>
                    ) : !verifyingData.rfc ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        Captura manual
                      </span>
                    ) : !liveValidation?.rfcVal.matchesName ? (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <AlertCircle className="w-3 h-3" /> Incongruente
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        Revisar formato
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={13}
                    value={verifyingData.rfc}
                    onChange={(e) =>
                      setVerifyingData({ ...verifyingData, rfc: e.target.value.toUpperCase().trim() })
                    }
                    className={`w-full px-3 py-2 text-xs sm:text-sm font-mono-data font-bold text-stone-900 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      liveValidation?.rfcVal.isValidFormat && liveValidation.rfcVal.matchesName
                        ? 'border-emerald-400 bg-emerald-50/20'
                        : !verifyingData.rfc
                        ? 'border-amber-400 bg-amber-50/20'
                        : 'border-rose-400 bg-rose-50/30'
                    }`}
                    placeholder="10 o 13 caracteres"
                  />
                  <p className={`text-[10px] mt-0.5 ${!liveValidation?.rfcVal.matchesName && verifyingData.rfc ? 'text-rose-600 font-semibold' : 'text-stone-500'}`}>
                    {verifyingData.rfc
                      ? liveValidation?.rfcVal.errorMessage || '13 caracteres para persona física'
                      : 'Capture el RFC del titular si no fue detectado en la credencial'}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                    Clave de Elector (INE / IFE) *
                  </label>
                  {liveValidation?.isIneValid ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Clave detectada
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                      Captura manual
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={18}
                  value={verifyingData.ine}
                  onChange={(e) =>
                    setVerifyingData({ ...verifyingData, ine: e.target.value.toUpperCase().trim() })
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm font-mono-data font-bold text-stone-900 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Clave de 18 caracteres de la credencial"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                    Domicilio Completo (Calle, Número, Localidad, C.P.) *
                  </label>
                  {liveValidation?.isAddressValid ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> Dirección Completa
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Incompleto · Captura manual requerida
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={verifyingData.address}
                  onChange={(e) =>
                    setVerifyingData({ ...verifyingData, address: e.target.value.toUpperCase() })
                  }
                  className={`w-full px-3 py-2 text-xs sm:text-sm text-stone-900 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                    liveValidation?.isAddressValid
                      ? 'border-emerald-400 bg-emerald-50/20'
                      : 'border-amber-400 bg-amber-50/20'
                  }`}
                  placeholder="Calle, número, colonia, código postal"
                />
                <p className="text-[10px] text-stone-500 mt-0.5">
                  Debe transcribir la calle y número oficial del domicilio. No sustituir por Ejido salvo que el domicilio esté vacío.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Municipio
                  </label>
                  <input
                    type="text"
                    value={verifyingData.municipio || 'Pánuco'}
                    onChange={(e) =>
                      setVerifyingData({ ...verifyingData, municipio: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-stone-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Ejido o Congregación de Pánuco *
                  </label>
                  <select
                    value={verifyingData.ejido || 'Reventadero'}
                    onChange={(e) =>
                      setVerifyingData({ ...verifyingData, ejido: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 border-2 border-emerald-400 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-emerald-50/20"
                  >
                    {ejidosList.map((ej) => (
                      <option key={ej} value={ej}>
                        {ej}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t-2 border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-stone-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Al aceptar, los datos se volcarán al <strong>Paso 1</strong> y se sincronizarán las iniciales con el forjador de fierro.
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleResetScanner}
                className="px-4 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex-1 sm:flex-initial text-center"
              >
                Escanear Otra
              </button>

              <button
                type="button"
                onClick={handleConfirmAndApply}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 hover:from-emerald-600 hover:to-teal-800 active:scale-98 text-white font-cinzel font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer ring-4 ring-emerald-500/25 flex-1 sm:flex-initial"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <span>ACEPTAR Y LLENAR EXPEDIENTE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATE 7: APPLIED SUCCESS BANNER */}
      {mode === 'applied' && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-950 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 font-cinzel">
                  Credencial INE Validada y Vinculada al Expediente
                </span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 font-mono-data px-1.5 py-0.5 rounded font-bold">
                  OCR Verificado
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Los datos de <strong>{verifyingData?.fullName || currentProducerName}</strong> (Clave INE: <strong>{verifyingData?.ine}</strong>, CURP: <strong>{verifyingData?.curp}</strong>) han sido aplicados con éxito.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetScanner}
            className="px-3 py-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-300 cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Escanear Otra Credencial</span>
          </button>
        </div>
      )}
    </div>
  );
};