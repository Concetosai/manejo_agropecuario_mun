import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, AlertCircle, Loader2, Upload, RefreshCw, SwitchCamera } from 'lucide-react';
import { extractFolioFromScan } from '../utils/qrVerification';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (folio: string) => void;
}

interface CameraDevice {
  id: string;
  label: string;
}

function describeCameraError(err: any): string {
  const name = String(err?.name || '');
  const msg = String(err?.message || err || '');
  const all = `${name} ${msg}`;
  if (/NotAllowedError|Permission|denied/i.test(all)) {
    return 'Permiso de cámara denegado. Habilite el acceso a la cámara en su navegador e intente de nuevo.';
  }
  if (/NotFoundError|DevicesNotFound|Requested device not found|no camera/i.test(all)) {
    return 'No se encontró ninguna cámara conectada. Conecte una cámara o use la opción de subir una imagen del QR.';
  }
  if (/NotReadableError|TrackStartError|in use|busy/i.test(all)) {
    return 'La cámara está siendo usada por otra aplicación. Ciérrela e intente de nuevo.';
  }
  if (/OverconstrainedError|ConstraintNotSatisfied/i.test(all)) {
    return 'La cámara solicitada no está disponible en este dispositivo. Intente con otra cámara.';
  }
  return 'No se pudo iniciar la cámara. Verifique los permisos o use la opción de subir una imagen del QR.';
}

/**
 * P4-QR · Escáner interno de QR.
 * Funciona con la cámara de una PC (webcam) o de un celular. Prueba primero la
 * cámara trasera, luego la frontal y, si es necesario, la lista de dispositivos.
 */
export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);
  const containerId = 'qr-reader-container';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopScanner = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
      } catch {
        /* noop */
      }
      try {
        s.clear();
      } catch {
        /* noop */
      }
    }
  };

  const handleQrDetected = (decodedText: string) => {
    const folio = extractFolioFromScan(decodedText);
    if (folio) {
      stopScanner();
      onScanSuccess(folio);
    } else {
      setError(
        'El código escaneado no contiene un folio válido de Pánuco. Verifique que sea el certificado oficial.'
      );
    }
  };

  const startWith = async (cameraIdOrConfig: any) => {
    const scanner = new Html5Qrcode(containerId, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    await scanner.start(
      cameraIdOrConfig,
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      (decodedText) => {
        if (mountedRef.current) handleQrDetected(decodedText);
      },
      () => {
        /* errores de frame: silenciosos */
      }
    );
    scannerRef.current = scanner;
  };

  const startScanner = async (preferredDeviceId?: string) => {
    setIsStarting(true);
    setIsScanning(false);
    setError(null);
    await stopScanner();
    await new Promise((r) => setTimeout(r, 120));
    if (!mountedRef.current) return;

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('La cámara requiere una conexión segura (HTTPS) o ejecutarse en localhost.');
      setIsStarting(false);
      return;
    }

    const attempts: any[] = [];
    if (preferredDeviceId) attempts.push({ deviceId: { exact: preferredDeviceId } });
    attempts.push({ facingMode: 'environment' });
    attempts.push({ facingMode: 'user' });

    let lastErr: any = null;
    let started = false;

    for (const cfg of attempts) {
      try {
        await startWith(cfg);
        started = true;
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!started) {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          setCameras(devices.map((d) => ({ id: d.id, label: d.label })));
          await startWith({ deviceId: { exact: devices[0].id } });
          started = true;
        }
      } catch (e) {
        lastErr = e;
      }
    }

    if (!mountedRef.current) return;
    if (started) {
      setIsScanning(true);
      setIsStarting(false);
    } else {
      setError(describeCameraError(lastErr));
      setIsStarting(false);
    }
  };

  // Iniciar/detener scanner al abrir/cerrar
  useEffect(() => {
    if (!isOpen) return;
    mountedRef.current = true;

    // Enumerar cámaras (no bloqueante) para el botón de cambio de cámara
    (async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (mountedRef.current && devices?.length) {
          setCameras(devices.map((d) => ({ id: d.id, label: d.label })));
        }
      } catch {
        /* noop */
      }
    })();

    startScanner();

    return () => {
      mountedRef.current = false;
      stopScanner();
      setIsScanning(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const next = (cameraIndex + 1) % cameras.length;
    setCameraIndex(next);
    startScanner(cameras[next].id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      await stopScanner();
      const scanner = new Html5Qrcode(containerId);
      const result = await scanner.scanFile(file, false);
      handleQrDetected(result);
    } catch (err) {
      console.warn('[QrScanner] Error al escanear archivo:', err);
      setError('No se pudo leer el QR desde la imagen. Intente con otra imagen más nítida.');
    } finally {
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-amber-500 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Escanear QR del Certificado</h3>
              <p className="text-[11px] text-amber-100">
                Apunte la cámara al código QR del documento oficial
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Área de la cámara */}
          <div className="relative w-full aspect-square bg-stone-900 rounded-xl overflow-hidden border-2 border-stone-700">
            <div id={containerId} className="w-full h-full" />

            {/* Overlay de enfoque */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-4 border-amber-400/80 rounded-lg animate-pulse" />
              </div>
            )}

            {/* Estado de inicio */}
            {isStarting && (
              <div className="absolute inset-0 bg-stone-900/80 flex flex-col items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <span className="text-xs">Iniciando cámara...</span>
              </div>
            )}
          </div>

          {/* Controles de cámara */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startScanner()}
              className="flex-1 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar cámara
            </button>
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="flex-1 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                Cambiar cámara
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2 text-xs text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Instrucciones */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
            <strong className="block mb-1">📋 ¿Cómo escanear?</strong>
            Apunte la cámara al QR del certificado. El sistema detectará el folio automáticamente y
            abrirá el expediente del productor. En una PC funciona con su webcam; en un celular, con
            la cámara trasera.
          </div>

          {/* Alternativa: subir imagen */}
          <div className="pt-1">
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
              className="w-full px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>O subir imagen del QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
