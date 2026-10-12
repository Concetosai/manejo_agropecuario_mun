import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { X, Camera, AlertCircle, Loader2, Upload } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (folio: string) => void;
}

/**
 * Modal de escaneo de QR para el certificado ganadero.
 * 
 * El QR contiene un JSON con el folio del productor.
 * Al detectarlo, extrae el folio y llama a onScanSuccess(folio).
 */
export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-reader-container';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Extraer folio del texto escaneado (JSON o texto plano)
  const extractFolio = (text: string): string | null => {
    try {
      // Intentar parsear como JSON
      const parsed = JSON.parse(text);
      if (parsed && parsed.folio) return String(parsed.folio);
      // Si es objeto pero sin folio, buscar cualquier campo 'folio'
      if (parsed && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        const folioKey = keys.find((k) => k.toLowerCase().includes('folio'));
        if (folioKey && parsed[folioKey]) return String(parsed[folioKey]);
      }
    } catch {
      // No es JSON, intentar regex
    }
    // Buscar patrón PAN-YYYY-XXXXX en texto plano
    const match = text.match(/PAN-\d{4}-\d{5}/i);
    if (match) return match[0].toUpperCase();
    // Buscar cualquier folio que empiece con PAN
    const match2 = text.match(/PAN[-_]?[A-Z0-9-]+/i);
    if (match2) return match2[0].toUpperCase();
    return null;
  };

  // Callback al escanear exitosamente
  const handleQrDetected = (decodedText: string) => {
    const folio = extractFolio(decodedText);
    if (folio) {
      // Detener el scanner
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
      onScanSuccess(folio);
    } else {
      setError('El QR no contiene un folio válido de Pánuco. Verifique que sea el certificado oficial.');
    }
  };

  // Iniciar el scanner
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const startScanner = async () => {
      setIsStarting(true);
      setError(null);

      // Esperar a que el div esté en el DOM
      await new Promise((r) => setTimeout(r, 100));

      try {
        const scanner = new Html5Qrcode(containerId, {
          verbose: false,
          formatsToSupport: [
            // @ts-ignore
            0, // QR_CODE
          ],
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (mounted) handleQrDetected(decodedText);
          },
          () => {
            // Errores de frame (silencioso)
          }
        );

        if (mounted) {
          setIsScanning(true);
          setIsStarting(false);
        }
      } catch (err: any) {
        console.warn('[QrScanner] Error al iniciar:', err);
        if (mounted) {
          setError(
            'No se pudo acceder a la cámara. Verifique los permisos o use la opción de subir una imagen del QR.'
          );
          setIsStarting(false);
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
      setIsScanning(false);
    };
  }, [isOpen]);

  // Subir imagen del QR como alternativa
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
      }
      const scanner = new Html5Qrcode(containerId);
      const result = await scanner.scanFile(file, false);
      handleQrDetected(result);
    } catch (err: any) {
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
            Apunte la cámara al QR del certificado impreso. El sistema detectará el folio automáticamente y abrirá el portafolio del productor.
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