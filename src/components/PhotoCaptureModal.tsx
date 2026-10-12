import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  User,
  ShieldCheck,
  Sparkles,
  SwitchCamera,
  Image as ImageIcon,
  Smartphone,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CreditCard,
  Eye,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface PhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (dataUrl: string) => void;
  currentPhoto?: string;
  producerName?: string;
  initialMode?: 'capture' | 'preview';
}

// Sample official portraits for instant testing in sandboxes/iframes without camera hardware
const SAMPLE_PORTRAITS = [
  {
    id: 'sample-1',
    name: '',
    role: 'Productor Titular (Ejemplo)',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23d6d3d1"/><stop offset="100%" stop-color="%23a8a29e"/></linearGradient><linearGradient id="skin" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23d4a373"/><stop offset="100%" stop-color="%23bc8a5f"/></linearGradient><linearGradient id="vest" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23431407"/><stop offset="100%" stop-color="%23290b04"/></linearGradient><linearGradient id="hat" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23fef3c7"/><stop offset="100%" stop-color="%23fde68a"/></linearGradient></defs><rect width="480" height="640" fill="url(%23bg)"/><path d="M90 640 C90 520 150 470 240 470 C330 470 390 520 390 640 Z" fill="url(%23vest)"/><path d="M185 470 L240 570 L295 470 Z" fill="%23f8fafc"/><path d="M225 510 L240 570 L255 510 Z" fill="%23991b1b"/><rect x="210" y="380" width="60" height="100" rx="10" fill="url(%23skin)"/><ellipse cx="240" cy="330" rx="85" ry="110" fill="url(%23skin)"/><path d="M205 320 Q240 340 275 320" stroke="%23854d0e" stroke-width="6" fill="none" stroke-linecap="round"/><ellipse cx="195" cy="305" rx="8" ry="12" fill="%23292524"/><ellipse cx="285" cy="305" rx="8" ry="12" fill="%23292524"/><path d="M175 285 Q195 275 215 285" stroke="%2344403c" stroke-width="5" fill="none"/><path d="M265 285 Q285 275 305 285" stroke="%2344403c" stroke-width="5" fill="none"/><path d="M190 350 Q240 375 290 350 Q240 395 190 350 Z" fill="%23292524"/><ellipse cx="240" cy="225" rx="195" ry="38" fill="url(%23hat)" stroke="%23d97706" stroke-width="3"/><path d="M150 225 C150 140 330 140 330 225 Z" fill="url(%23hat)"/><rect x="155" y="210" width="170" height="16" fill="%2378350f"/><rect x="15" y="585" width="450" height="40" rx="8" fill="%230c0a09" opacity="0.85"/><text x="240" y="610" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="%23f59e0b" text-anchor="middle">H. AYUNTAMIENTO DE PÁNUCO · EXPEDIENTE PECUARIO</text></svg>`,
  },
  {
    id: 'sample-2',
    name: '',
    role: 'Productora Titular (Ejemplo)',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640"><defs><linearGradient id="bg2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23e7e5e4"/><stop offset="100%" stop-color="%23a8a29e"/></linearGradient><linearGradient id="skin2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23e0a96d"/><stop offset="100%" stop-color="%23c68b59"/></linearGradient><linearGradient id="blouse" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23047857"/><stop offset="100%" stop-color="%23064e3b"/></linearGradient></defs><rect width="480" height="640" fill="url(%23bg2)"/><path d="M100 640 C100 510 160 460 240 460 C320 460 380 510 380 640 Z" fill="url(%23blouse)"/><rect x="210" y="370" width="60" height="100" rx="10" fill="url(%23skin2)"/><path d="M140 280 C140 180 340 180 340 280 C350 420 320 460 320 460 L160 460 C160 460 130 420 140 280 Z" fill="%231c1917"/><ellipse cx="240" cy="335" rx="80" ry="105" fill="url(%23skin2)"/><ellipse cx="195" cy="315" rx="7" ry="10" fill="%23292524"/><ellipse cx="285" cy="315" rx="7" ry="10" fill="%23292524"/><path d="M175 295 Q195 285 215 295" stroke="%23292524" stroke-width="4" fill="none"/><path d="M265 295 Q285 285 305 295" stroke="%23292524" stroke-width="4" fill="none"/><path d="M210 375 Q240 395 270 375" stroke="%23991b1b" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="150" cy="350" r="10" fill="%23f59e0b"/><circle cx="330" cy="350" r="10" fill="%23f59e0b"/><rect x="15" y="585" width="450" height="40" rx="8" fill="%230c0a09" opacity="0.85"/><text x="240" y="610" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="%23f59e0b" text-anchor="middle">H. AYUNTAMIENTO DE PÁNUCO · EXPEDIENTE PECUARIO</text></svg>`,
  },
];

export const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
  currentPhoto,
  producerName,
  initialMode = 'preview',
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'samples'>('camera');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Evaluation & Visual Inspection States
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [previewMode, setPreviewMode] = useState<'single' | 'card_mockup'>('single');
  const [isFlashing, setIsFlashing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Play subtle synthetic camera shutter sound (Web Audio API)
  const playShutterSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // ignore
    }
  }, []);

  // Stop current camera stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Enumerate video devices
  const updateDeviceList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch {
      // ignore
    }
  }, [selectedDeviceId]);

  // Start camera stream safely
  const startCamera = useCallback(async () => {
    stopStream();
    setCameraError(null);
    setIsCameraStarting(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Su navegador no soporta el acceso directo a la cámara web o móvil.');
      setIsCameraStarting(false);
      setActiveTab('upload');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 960 } }
          : { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      await updateDeviceList();
    } catch (err: any) {
      console.warn('Camera access unavailable:', err?.message || err);
      let msg = 'No se pudo iniciar la cámara en este entorno. Puede tomar una foto con la cámara nativa de su celular o seleccionar una imagen guardada.';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.message?.includes('Permission')) {
        msg = 'Permiso de cámara no concedido en el navegador o iFrame. Puede utilizar la cámara nativa de su celular o subir un archivo directamente.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        msg = 'No se detectó cámara física disponible. Puede subir una foto desde sus archivos o galería.';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        msg = 'La cámara está siendo utilizada por otra aplicación o pestaña. Ciérrela o suba un archivo.';
      }
      setCameraError(msg);
    } finally {
      setIsCameraStarting(false);
    }
  }, [facingMode, selectedDeviceId, stopStream, updateDeviceList]);

  // Effect to manage modal initial state and camera lifecycle
  useEffect(() => {
    if (isOpen) {
      if (currentPhoto && currentPhoto.trim().length > 0 && initialMode !== 'capture') {
        setPreviewImage(currentPhoto);
        setZoomLevel(1);
        setRotationDegrees(0);
      } else {
        setPreviewImage(null);
        if (activeTab === 'camera') {
          startCamera();
        }
      }
    } else {
      setPreviewImage(null);
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, currentPhoto, initialMode]);

  // Effect to manage camera on open / close / tab switch
  useEffect(() => {
    if (isOpen && activeTab === 'camera' && !previewImage) {
      startCamera();
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, activeTab, previewImage, startCamera, stopStream]);

  // Toggle front/rear camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    setSelectedDeviceId('');
  };

  // Compress and crop an image to official 3:4 ID proportions (480x640) with rotation support
  const processAndCompressCanvas = (
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    rotation: number = 0
  ): string => {
    const targetWidth = 480;
    const targetHeight = 640;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No se pudo inicializar el procesador gráfico');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Apply rotation if requested (90, 180, 270)
    ctx.save();
    ctx.translate(targetWidth / 2, targetHeight / 2);
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    const isRotated90or270 = rotation % 180 !== 0;
    const effTargetW = isRotated90or270 ? targetHeight : targetWidth;
    const effTargetH = isRotated90or270 ? targetWidth : targetHeight;

    const targetRatio = effTargetW / effTargetH;
    const sourceRatio = sourceWidth / sourceHeight;

    let sx = 0;
    let sy = 0;
    let sWidth = sourceWidth;
    let sHeight = sourceHeight;

    if (sourceRatio > targetRatio) {
      sWidth = sourceHeight * targetRatio;
      sx = (sourceWidth - sWidth) / 2;
    } else {
      sHeight = sourceWidth / targetRatio;
      sy = (sourceHeight - sHeight) / 2;
    }

    if (facingMode === 'user' && source instanceof HTMLVideoElement && rotation === 0) {
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-effTargetW / 2, -effTargetH / 2, effTargetW, effTargetH);
    ctx.drawImage(source, sx, sy, sWidth, sHeight, -effTargetW / 2, -effTargetH / 2, effTargetW, effTargetH);
    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.90);
  };

  // Capture from live video stream
  const executeCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      alert('La señal de video aún se está sincronizando. Por favor intente en un momento.');
      return;
    }

    // Trigger visual flash and sound feedback
    setIsFlashing(true);
    playShutterSound();
    setTimeout(() => setIsFlashing(false), 220);

    try {
      const compressedDataUrl = processAndCompressCanvas(
        video,
        video.videoWidth,
        video.videoHeight,
        0
      );
      setPreviewImage(compressedDataUrl);
      setRotationDegrees(0);
      setZoomLevel(1);
      stopStream();
    } catch (err) {
      console.warn('Could not process video frame to canvas:', err);
      alert('Hubo un inconveniente al procesar la captura. Por favor intente nuevamente.');
    }
  };

  // Shutter button handler with countdown option
  const handleCaptureFromVideo = () => {
    if (countdown !== null) return;
    executeCapture();
  };

  // Timed 3-second capture
  const handleTimedCapture = () => {
    if (countdown !== null) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          executeCapture();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Handle file upload or native camera file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccione un archivo de imagen válido (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      const img = new Image();
      img.onload = () => {
        try {
          const compressed = processAndCompressCanvas(img, img.width, img.height, 0);
          setPreviewImage(compressed);
          setRotationDegrees(0);
          setZoomLevel(1);
        } catch {
          setPreviewImage(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);

    // Reset input value so selecting the same photo or taking another immediately works
    e.target.value = '';
  };

  // Rotate preview 90 degrees
  const handleRotatePreview = () => {
    if (!previewImage) return;
    const img = new Image();
    img.onload = () => {
      const nextRotation = (rotationDegrees + 90) % 360;
      setRotationDegrees(nextRotation);
      const rotated = processAndCompressCanvas(img, img.width, img.height, 90);
      setPreviewImage(rotated);
    };
    img.src = previewImage;
  };

  // Retake photo: clears preview and reactivates live camera immediately
  const handleRetake = () => {
    setPreviewImage(null);
    setRotationDegrees(0);
    setZoomLevel(1);
    setPreviewMode('single');
    if (activeTab === 'camera') {
      startCamera();
    }
  };

  // Confirm photo: passes it to parent state and closes
  const handleConfirm = () => {
    if (previewImage) {
      onPhotoCaptured(previewImage);
      handleClose();
    }
  };

  // Close and clean up
  const handleClose = () => {
    stopStream();
    setPreviewImage(null);
    setCameraError(null);
    setCountdown(null);
    setRotationDegrees(0);
    setZoomLevel(1);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border-2 border-stone-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-amber-300 font-bold block">
                Expediente Ganadero Municipal · Pánuco, Ver.
              </span>
              <h3 className="text-base sm:text-lg font-bold font-cinzel text-white leading-tight">
                {previewImage ? 'Revisión y Evaluación de la Fotografía' : 'Fotografía Oficial del Titular'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection (Cámara vs Subir Archivo vs Muestras) */}
        {!previewImage && (
          <div className="flex border-b border-stone-200 bg-stone-50 px-3 sm:px-4 pt-3 gap-1 sm:gap-2 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab('camera');
                setCameraError(null);
              }}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                activeTab === 'camera'
                  ? 'border-amber-700 text-amber-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Cámara Web en Vivo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('upload');
                stopStream();
              }}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                activeTab === 'upload'
                  ? 'border-amber-700 text-amber-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir / Celular</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('samples');
                stopStream();
              }}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                activeTab === 'samples'
                  ? 'border-amber-700 text-amber-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Retratos Oficiales Demo</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col items-center justify-center relative">
          {/* =========================================================================
              ESTADO 1: PREVISUALIZACIÓN, MINIATURA Y EVALUACIÓN DE LA TOMA
             ========================================================================= */}
          {previewImage ? (
            <div className="w-full flex flex-col items-center space-y-4 animate-fadeIn">
              {/* Header de la Toma */}
              <div className="w-full flex items-center justify-between text-xs border-b border-stone-200 pb-2">
                <div className="flex items-center gap-1.5 text-stone-800 font-bold">
                  <Eye className="w-4 h-4 text-amber-700" />
                  <span>Inspección de la Toma Realizada</span>
                </div>

                {/* Alternador de vista: Retrato individual vs Simulación Credencial */}
                <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('single')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      previewMode === 'single'
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Retrato
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('card_mockup')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      previewMode === 'card_mockup'
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <CreditCard className="w-3 h-3 text-amber-700" />
                    <span>En Credencial</span>
                  </button>
                </div>
              </div>

              {/* Vista Central: Retrato Ampliado o Simulación de Credencial */}
              {previewMode === 'single' ? (
                <div className="flex flex-col items-center space-y-2">
                  {/* Visor con Marco Oficial y Zoom */}
                  <div className="relative w-48 sm:w-56 aspect-[3/4] rounded-2xl overflow-hidden border-4 border-amber-600 shadow-xl bg-stone-100 flex items-center justify-center">
                    <img
                      src={previewImage}
                      alt="Vista previa de foto oficial"
                      className="w-full h-full object-cover transition-transform duration-150"
                      style={{ transform: `scale(${zoomLevel})` }}
                    />

                    {/* Guía Tenue Oficial para validar encuadre */}
                    <div className="absolute inset-0 pointer-events-none border border-amber-400/30 rounded-xl m-1 flex flex-col items-center justify-center">
                      <div className="w-28 h-36 border border-dashed border-white/40 rounded-full opacity-60" />
                    </div>

                    <div className="absolute top-2 right-2 bg-emerald-600 text-white p-1 rounded-full shadow-md">
                      <Check className="w-3.5 h-3.5" />
                    </div>

                    <span className="absolute bottom-2 left-2 bg-stone-950/75 text-white text-[9px] font-mono px-2 py-0.5 rounded">
                      480 × 640 px
                    </span>
                  </div>

                  {/* Herramientas de Inspección: Zoom y Rotación */}
                  <div className="flex items-center justify-center gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(1, z - 0.25))}
                      disabled={zoomLevel <= 1}
                      className="px-2 py-1 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
                      title="Alejar zoom"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                      <span>Alejar</span>
                    </button>

                    <span className="text-[10px] font-mono font-bold text-stone-600 bg-stone-100 px-2 py-1 rounded">
                      {Math.round(zoomLevel * 100)}%
                    </span>

                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(2, z + 0.25))}
                      disabled={zoomLevel >= 2}
                      className="px-2 py-1 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
                      title="Acercar para inspeccionar nitidez de ojos y rostro"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Acercar</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRotatePreview}
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer text-[11px] ml-1"
                      title="Girar 90 grados"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-amber-800" />
                      <span>Girar 90°</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Simulación de la Credencial Ganadera Oficial CR-80 con la foto tomada */
                <div className="w-full flex flex-col items-center py-1">
                  <div className="w-[260px] h-[164px] bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white rounded-xl shadow-xl p-3 border-2 border-amber-500/80 flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-amber-500/40 pb-1">
                      <div>
                        <span className="text-[7px] uppercase tracking-wider text-amber-300 font-bold block">
                          H. Ayuntamiento de Pánuco, Ver.
                        </span>
                        <span className="text-[8px] font-bold text-white block font-cinzel">
                          CREDENCIAL GANADERA OFICIAL
                        </span>
                      </div>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>

                    <div className="flex items-center gap-3 my-1">
                      {/* Miniatura de la foto tomada */}
                      <div className="w-14 h-18 rounded overflow-hidden border border-amber-400 shadow-sm bg-stone-800 shrink-0">
                        <img src={previewImage} alt="Foto en credencial" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[6.5px] uppercase text-stone-400 block font-semibold">Titular Registrado</span>
                        <span className="text-[10px] font-bold text-white block truncate">
                          {producerName || ''}
                        </span>
                        <span className="text-[7.5px] text-amber-200 block truncate">
                          Mpio. de Pánuco · Expediente Pecuario
                        </span>
                        <span className="inline-block mt-1 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded text-[7px] font-mono">
                          FOLIO: 2026-OFICIAL
                        </span>
                      </div>
                    </div>

                    <div className="text-[6px] text-stone-400 font-mono text-center pt-0.5 border-t border-stone-800">
                      VÁLIDA PARA TRÁNSITO PECUARIO Y CONTROL DE MOVILIZACIÓN
                    </div>
                  </div>
                  <span className="text-[10px] text-stone-500 mt-2">
                    Visualización previa del anverso oficial en plástico CR-80
                  </span>
                </div>
              )}

              {/* Panel de Evaluación y Criterios Oficiales */}
              <div className="w-full p-3 bg-amber-50/70 border border-amber-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Evaluación de Calidad Oficial
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                    Formato CR-80 Listo
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-stone-700">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Rostro Centrado</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Luz Adecuada</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Proporción 3:4</span>
                  </div>
                </div>
              </div>

              {/* Botones de Decisión: Volver a Tomar vs Aceptar y Guardar */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full">
                {/* BOTÓN REPETIR / VOLVER A TOMAR */}
                <button
                  type="button"
                  onClick={handleRetake}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 border-2 border-stone-300 hover:border-stone-400 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
                >
                  <RefreshCw className="w-4 h-4 text-amber-700" />
                  <span>Volver a Tomar / Repetir Foto</span>
                </button>

                {/* BOTÓN ACEPTAR Y GUARDAR */}
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-600 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Aceptar y Guardar en Expediente</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'camera' ? (
            /* =========================================================================
               ESTADO 2: CÁMARA WEB / CELULAR EN VIVO
               ========================================================================= */
            <div className="w-full flex flex-col items-center space-y-3">
              {cameraError ? (
                <div className="w-full p-4 bg-amber-50/90 border-2 border-amber-300 rounded-xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-2xs">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">Alternativas de Captura Fotográfica</h4>
                    <p className="text-xs text-stone-700 mt-1 max-w-sm mx-auto">{cameraError}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => nativeCameraInputRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-600 rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Cámara Nativa del Celular</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-stone-800 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Subir desde Galería / Archivo</span>
                    </button>
                  </div>

                  {/* Quick sample portrait trigger */}
                  <div className="pt-2 border-t border-amber-200">
                    <button
                      type="button"
                      onClick={() => {
                        const sample = SAMPLE_PORTRAITS[0];
                        setPreviewImage(sample.dataUrl);
                      }}
                      className="text-xs text-amber-900 hover:text-amber-950 font-bold underline cursor-pointer"
                    >
                      ⚡ Usar Foto Oficial de Muestra (Don Aurelio Guzmán)
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Visor de Cámara con Retícula y Flash */}
                  <div className="relative w-full max-w-[320px] aspect-[3/4] bg-black rounded-2xl overflow-hidden border-2 border-stone-800 shadow-inner flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className={`w-full h-full object-cover ${
                        facingMode === 'user' ? 'scale-x-[-1]' : ''
                      }`}
                    />

                    {/* Flash visual al disparar */}
                    {isFlashing && (
                      <div className="absolute inset-0 bg-white z-20 pointer-events-none animate-flash" />
                    )}

                    {/* Cuenta regresiva en pantalla */}
                    {countdown !== null && (
                      <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center pointer-events-none">
                        <span className="text-6xl font-extrabold text-amber-300 animate-pulse font-mono">
                          {countdown}
                        </span>
                      </div>
                    )}

                    {isCameraStarting && (
                      <div className="absolute inset-0 bg-stone-900/80 flex flex-col items-center justify-center text-white p-4">
                        <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mb-2" />
                        <span className="text-xs font-semibold">Conectando con la cámara...</span>
                      </div>
                    )}

                    {/* Guía Oficial de Retrato Oval con retículas de alineación */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                      <div className="w-40 h-52 border-2 border-dashed border-amber-300/80 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] flex items-center justify-center relative">
                        <div className="absolute top-2 w-12 border-t border-amber-300/60" />
                        <div className="absolute bottom-4 w-16 border-t border-amber-300/60" />
                      </div>
                      <span className="text-[10px] text-amber-200 bg-stone-950/80 px-2 py-0.5 rounded mt-3 font-semibold tracking-wide">
                        Alinee el rostro dentro de la guía
                      </span>
                    </div>
                  </div>

                  {/* Barra de opciones de cámara */}
                  <div className="flex items-center justify-between w-full max-w-[320px] px-1 text-xs">
                    <button
                      type="button"
                      onClick={handleToggleFacingMode}
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Cambiar entre cámara frontal y trasera"
                    >
                      <SwitchCamera className="w-3.5 h-3.5 text-amber-800" />
                      <span>{facingMode === 'user' ? 'Cámara Frontal' : 'Cámara Trasera'}</span>
                    </button>

                    {availableDevices.length > 1 && (
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                        className="text-[11px] bg-stone-100 border border-stone-300 rounded px-2 py-1 max-w-[150px] truncate"
                      >
                        {availableDevices.map((d, idx) => (
                          <option key={d.deviceId || idx} value={d.deviceId}>
                            {d.label || `Cámara ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Botones Disparadores */}
                  <div className="pt-2 flex items-center gap-4">
                    {/* Temporizador 3s */}
                    <button
                      type="button"
                      onClick={handleTimedCapture}
                      disabled={isCameraStarting || countdown !== null}
                      className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-300"
                      title="Disparo con temporizador de 3 segundos"
                    >
                      <span>3s</span>
                    </button>

                    {/* Disparador Primario */}
                    <button
                      type="button"
                      onClick={handleCaptureFromVideo}
                      disabled={isCameraStarting || countdown !== null}
                      className="w-16 h-16 rounded-full bg-amber-600 hover:bg-amber-500 text-white shadow-xl flex items-center justify-center ring-4 ring-amber-200 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
                      title="Tomar Fotografía Ahora"
                    >
                      <Camera className="w-7 h-7" />
                    </button>

                    <button
                      type="button"
                      onClick={() => nativeCameraInputRef.current?.click()}
                      className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors cursor-pointer border border-stone-300"
                      title="Usar app de cámara del celular"
                    >
                      <Smartphone className="w-4 h-4 text-amber-700" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : activeTab === 'upload' ? (
            /* =========================================================================
               ESTADO 3: CARGA DESDE DISPOSITIVO O CÁMARA NATIVA
               ========================================================================= */
            <div className="w-full flex flex-col items-center space-y-4 py-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-sm border-2 border-dashed border-stone-300 hover:border-amber-600 bg-stone-50 hover:bg-amber-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2"
              >
                <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-stone-900">
                  Seleccionar fotografía del dispositivo
                </h4>
                <p className="text-xs text-stone-500 max-w-xs">
                  Formatos soportados: JPG, PNG o WEBP. Al seleccionarla se mostrará el panel para evaluar la toma antes de guardar.
                </p>
                <span className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-xs mt-2 inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Examinar Archivos
                </span>
              </div>

              {/* Disparador de cámara nativa del celular */}
              <div className="w-full max-w-sm flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-stone-300"
                >
                  <Smartphone className="w-4 h-4 text-amber-700" />
                  <span>Tomar con la Cámara Nativa del Celular</span>
                </button>
              </div>

              {currentPhoto && (
                <div className="text-center pt-2">
                  <span className="text-[11px] text-stone-500 block mb-1">Foto actual registrada:</span>
                  <img
                    src={currentPhoto}
                    alt="Foto actual"
                    className="w-16 h-20 object-cover rounded-lg border border-stone-300 mx-auto shadow-xs"
                  />
                </div>
              )}
            </div>
          ) : (
            /* =========================================================================
               ESTADO 4: RETRATOS OFICIALES DE MUESTRA
               ========================================================================= */
            <div className="w-full space-y-3 py-2">
              <div className="text-center pb-1">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                  Retratos Oficiales de Muestra
                </h4>
                <p className="text-xs text-stone-500">
                  Seleccione una fotografía de prueba para evaluar la toma y su previsualización en la credencial:
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                {SAMPLE_PORTRAITS.map((sample) => (
                  <div
                    key={sample.id}
                    onClick={() => {
                      setPreviewImage(sample.dataUrl);
                      setRotationDegrees(0);
                      setZoomLevel(1);
                    }}
                    className="p-2.5 bg-stone-50 hover:bg-amber-50/60 border border-stone-200 hover:border-amber-500 rounded-xl cursor-pointer transition-all flex flex-col items-center text-center space-y-2 group shadow-2xs"
                  >
                    <div className="w-20 aspect-[3/4] rounded-lg overflow-hidden border-2 border-stone-300 group-hover:border-amber-600 shadow-xs">
                      <img src={sample.dataUrl} alt={sample.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block truncate leading-tight">
                        {sample.name}
                      </span>
                      <span className="text-[10px] text-stone-500 block">{sample.role}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] font-semibold opacity-90 group-hover:opacity-100">
                      Seleccionar y Evaluar
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Footer info */}
        <div className="px-4 py-3 bg-stone-100 border-t border-stone-200 text-center text-[10px] text-stone-500 flex items-center justify-between shrink-0">
          <span>Normativa Oficial de Pánuco, Ver.</span>
          <span>Calibrado para Credencial CR-80 (480 × 640 px)</span>
        </div>
      </div>
    </div>
  );
};
