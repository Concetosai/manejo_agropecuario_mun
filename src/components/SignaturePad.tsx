import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  PenTool,
  RotateCcw,
  Undo2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  FileSignature,
  Upload,
  Trash2,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface SignaturePadProps {
  value?: string;
  onChange: (signatureDataUrl: string) => void;
  signerName?: string;
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  value,
  onChange,
  signerName = 'Productor Titular',
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedValueRef = useRef<string | undefined>(value);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));
  const [strokeHistory, setStrokeHistory] = useState<ImageData[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  // Setup canvas resolution and background
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match display size with internal buffer
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);

    // Default pen settings
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#0f172a'; // Deep ink color

    // If an initial value exists and is different from current internal state, load it
    if (value) {
      const img = new Image();
      // FIX_CLOUDINARY_CORS: permite leer pixeles del canvas con imagenes de Cloudinary
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSignature(true);
      };
      img.onerror = () => {
        console.warn('Signature image failed to render, resetting canvas');
        ctx.clearRect(0, 0, rect.width, rect.height);
        setHasSignature(false);
      };
      img.src = value;
    } else {
      ctx.clearRect(0, 0, rect.width, rect.height);
      setHasSignature(false);
    }
  }, [value]);

  // Synchronize on mount or when value changes externally (different from last emitted value)
  useEffect(() => {
    if (value !== lastEmittedValueRef.current) {
      lastEmittedValueRef.current = value;
      initCanvas();
    } else if (!value) {
      setHasSignature(false);
    } else {
      setHasSignature(true);
    }
  }, [value, initCanvas]);

  const saveCurrentState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setStrokeHistory((prev) => [...prev.slice(-10), snapshot]);
    } catch (err) {
      // FIX_CLOUDINARY_CORS: evita que el canvas tainted rompa el dibujo
      console.warn('[SignaturePad] No se pudo guardar snapshot (canvas tainted):', err);
    }
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: (e as React.MouseEvent<HTMLCanvasElement>).clientX - rect.left,
        y: (e as React.MouseEvent<HTMLCanvasElement>).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveCurrentState();
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    lastEmittedValueRef.current = dataUrl;
    setHasSignature(true);
    onChange(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    saveCurrentState();
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
    lastEmittedValueRef.current = '';
    onChange('');
  };

  const handleUndo = () => {
    if (strokeHistory.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const previous = strokeHistory[strokeHistory.length - 1];
    ctx.putImageData(previous, 0, 0);
    setStrokeHistory((prev) => prev.slice(0, -1));
    const dataUrl = canvas.toDataURL('image/png');
    lastEmittedValueRef.current = dataUrl;
    onChange(dataUrl);
  };

  // Generate authentic fluid signature sample based on signer name
  const handleLoadSample = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();

    saveCurrentState();
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.strokeStyle = '#0c1a30'; // Dark official ink
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const baseY = rect.height * 0.62;
    const startX = rect.width * 0.15;
    const width = rect.width * 0.7;

    // Calligraphic rubric curve
    ctx.beginPath();
    ctx.moveTo(startX, baseY - 20);
    ctx.bezierCurveTo(startX + 30, baseY - 45, startX + 60, baseY + 15, startX + 80, baseY - 15);
    ctx.bezierCurveTo(startX + 110, baseY - 35, startX + 130, baseY + 20, startX + 160, baseY - 10);
    ctx.bezierCurveTo(startX + 200, baseY - 30, startX + 230, baseY + 10, startX + width * 0.6, baseY - 5);

    // Extended rubric loop
    ctx.bezierCurveTo(
      startX + width * 0.8,
      baseY - 40,
      startX + width,
      baseY - 10,
      startX + width * 0.85,
      baseY + 15
    );
    ctx.bezierCurveTo(
      startX + width * 0.65,
      baseY + 30,
      startX + width * 0.3,
      baseY + 22,
      startX + 20,
      baseY + 18
    );
    ctx.bezierCurveTo(startX - 10, baseY + 15, startX + 10, baseY + 26, startX + width * 0.95, baseY + 22);

    ctx.stroke();
    ctx.restore();

    setHasSignature(true);
    const dataUrl = canvas.toDataURL('image/png');
    lastEmittedValueRef.current = dataUrl;
    onChange(dataUrl);
  };

  // Upload external signature file (PNG, JPG, etc.)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();

        saveCurrentState();
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calculate aspect ratio fit
        const hRatio = rect.width / img.width;
        const vRatio = rect.height / img.height;
        const ratio = Math.min(hRatio, vRatio) * 0.85;
        const centerShiftX = (rect.width - img.width * ratio) / 2;
        const centerShiftY = (rect.height - img.height * ratio) / 2;

        ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);

        const exportedDataUrl = canvas.toDataURL('image/png');
        lastEmittedValueRef.current = exportedDataUrl;
        setHasSignature(true);
        onChange(exportedDataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white border-2 border-stone-300 rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
      {/* Hidden File Input for uploading signatures */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
        className="hidden"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 text-amber-900 rounded-lg shrink-0">
            <FileSignature className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-stone-900 font-cinzel flex items-center gap-2">
              <span>Lienzo de Firma Autógrafa Digital del Productor</span>
              {hasSignature && (
                <span className="text-[10px] font-sans font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  Activa en Registro
                </span>
              )}
            </h4>
            <p className="text-[11px] text-stone-500">
              Dibuje con mouse/táctil, suba una imagen o use muestra. La firma se mantiene en el registro, certificado oficial e impresión hasta que decida reemplazarla o removerla.
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {hasSignature ? (
            <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Firma Guardada</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded-full flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-amber-600" />
              <span>Pendiente de Firma</span>
            </span>
          )}
        </div>
      </div>

      {/* Signature Canvas Box */}
      <div
        className="relative border-2 border-stone-300 rounded-lg overflow-hidden bg-stone-50/70 touch-none shadow-inner mx-auto"
        style={{ width: '100%', maxWidth: '780px', height: '230px' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair block"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Signature Baseline Indicator */}
        <div className="absolute bottom-8 left-6 right-6 border-b border-stone-300 pointer-events-none flex items-center justify-between text-[9px] text-stone-400 font-mono-data">
          <span>X ____________________________________________________</span>
          <span>FIRMA DEL SOLICITANTE</span>
        </div>

        {/* Helper watermark when empty */}
        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-stone-400 text-xs">
            <PenTool className="w-6 h-6 mb-1 opacity-40 text-stone-500" />
            <span className="font-playfair italic text-stone-400 text-sm">
              Estampe aquí la firma del C. {signerName || 'Productor'}
            </span>
            <span className="text-[10px] text-stone-400 mt-0.5">
              (Use trazo táctil, mouse o pulse "Subir Imagen" o "Firma de Muestra")
            </span>
          </div>
        )}
      </div>

      {/* Persistent Active Signature Card: Shows user that the signature is maintained and gives replace/remove buttons */}
      {hasSignature && value && (
        <div className="p-2.5 sm:p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-24 h-12 bg-white border border-emerald-200 rounded-lg p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
              <img
                src={value}
                alt="Vista previa de firma digital"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="text-xs font-bold text-emerald-950 font-cinzel">
                  Firma Digital Preservada en el Expediente
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 truncate">
                Titular: <strong>{signerName || 'Productor Titular'}</strong> · Lista para certificado e impresión oficial.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Borrar o remover la firma del expediente"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Remover Firma</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleClear();
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Reemplazar la firma actual por una nueva"
            >
              <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
              <span>Reemplazar</span>
            </button>
          </div>
        </div>
      )}

      {/* Control Buttons Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleClear}
            className="px-2.5 py-1 text-xs text-stone-600 hover:text-rose-700 hover:bg-rose-50 border border-stone-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            title="Borrar lienzo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={strokeHistory.length === 0}
            className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            title="Deshacer último trazo"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Deshacer</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 text-xs text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            title="Subir archivo o foto de firma autógrafa (PNG, JPG)"
          >
            <Upload className="w-3.5 h-3.5 text-stone-600" />
            <span>Subir Archivo de Firma</span>
          </button>
        </div>

        {/* FIX_NO_MOCK: Boton de firma demo eliminado */}
      </div>
    </div>
  );
};

