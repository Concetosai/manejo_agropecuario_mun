import React, { useState } from 'react';
import { FierroVectorizer, FierroEmbeddingResult } from '../utils/brandVectorization';

interface VectorizacionFierroPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onVectorizado?: (embedding: FierroEmbeddingResult) => void;
  highestSimilarity?: number;
}

export const VectorizacionFierroPanel: React.FC<VectorizacionFierroPanelProps> = ({
  canvasRef,
  onVectorizado,
  highestSimilarity = 0,
}) => {
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [embedding, setEmbedding] = useState<FierroEmbeddingResult | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ index: number; value: number; row: number; col: number } | null>(null);

  const executeVectorization = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('[Vectorizacion] Canvas no disponible');
      return;
    }

    setIsVectorizing(true);
    setEmbedding(null);

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 256;
      exportCanvas.height = 256;
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) throw new Error('No se pudo inicializar canvas');

      exportCtx.fillStyle = '#ffffff';
      exportCtx.fillRect(0, 0, 256, 256);

      const srcW = canvas.width;
      const srcH = canvas.height;
      const scale = Math.min(256 / srcW, 256 / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const drawX = (256 - drawW) / 2;
      const drawY = (256 - drawH) / 2;
      exportCtx.drawImage(canvas, drawX, drawY, drawW, drawH);

      const pngDataUrl = exportCanvas.toDataURL('image/png');

      console.log('%c[Vectorizacion] Ejecutando FierroVectorizer...', 'color: #0ea5e9');
      const vectorizer = new FierroVectorizer();
      const result = await vectorizer.generateEmbedding(pngDataUrl);

      console.log('%c[Vectorizacion] Completado', 'color: #22c55e');
      console.log('   Densidad:', (result.density * 100).toFixed(1) + '%');
      console.log('   Trazos activos:', result.activeCellCount + '/64');
      console.log('   Checksum:', result.checksum);

      setEmbedding(result);
      if (onVectorizado) onVectorizado(result);
    } catch (err: any) {
      console.error('[Vectorizacion] Error:', err);
    } finally {
      setIsVectorizing(false);
    }
  };

  const bgCount = embedding ? embedding.embedding.filter((v) => v < 0.40).length : 0;
  const medCount = embedding ? embedding.embedding.filter((v) => v >= 0.40 && v <= 0.70).length : 0;
  const hvyCount = embedding ? embedding.embedding.filter((v) => v > 0.70).length : 0;
  const bloqueoSimilitud = highestSimilarity >= 85;

  return (
    <div className="mt-4 p-3 sm:p-4 bg-stone-50 border-2 border-dashed border-amber-400 rounded-xl">
      <div className="flex items-center justify-between mb-3 border-b border-amber-200 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🧮</span>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-amber-950 uppercase tracking-wider">
              Paso 4: Vectorización del Fierro
            </h4>
            <p className="text-[10px] text-stone-500">
              Análisis matemático con embedding de 64 dimensiones (Sobel + Raster 8x8)
            </p>
          </div>
        </div>
        {embedding && (
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
            ✓ Vectorizado
          </span>
        )}
      </div>

      {!embedding && !isVectorizing && (
        <div className="text-center py-5">
          <p className="text-xs text-stone-600 mb-3 max-w-md mx-auto">
            Haga clic en el botón para procesar el fierro actual y generar el vector matemático de 64 dimensiones.
          </p>
          <button
            type="button"
            onClick={executeVectorization}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-800 to-amber-700 hover:from-amber-700 hover:to-amber-600 text-white font-bold text-xs sm:text-sm rounded-lg shadow-md transition-all cursor-pointer active:scale-95"
          >
            🔵 EJECUTAR VECTORIZACIÓN
          </button>
        </div>
      )}

      {isVectorizing && (
        <div className="text-center py-6">
          <div className="w-10 h-10 border-4 border-stone-200 border-t-amber-700 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-stone-700">
            Generando embedding de 64 dimensiones...
          </p>
        </div>
      )}

      {embedding && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={embedding.hasStrokes ? 'text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300' : 'text-[11px] font-bold px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300'}>
              Densidad: {(embedding.density * 100).toFixed(1)}%
            </span>
            <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded-md border border-stone-200 text-stone-700">
              Trazos: <strong>{hvyCount}</strong>/64
            </span>
            <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded-md border border-stone-200 text-stone-700">
              Medios: <strong>{medCount}</strong>/64
            </span>
            <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded-md border border-stone-200 text-stone-700">
              Fondo: <strong>{bgCount}</strong>/64
            </span>
            <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded-md border border-stone-200 text-stone-600" title="Checksum FNV-1a">
              Huella: <strong className="text-stone-800">{embedding.checksum}</strong>
            </span>
          </div>

          <div className="text-[10px] font-mono text-stone-600 bg-white border border-stone-200 rounded px-2.5 py-1.5 flex items-center justify-between">
            <span>
              {hoveredCell ? (
                <><strong>Celda #{hoveredCell.index + 1}</strong> [F{hoveredCell.row}, C{hoveredCell.col}]: <span className="font-bold">{hoveredCell.value.toFixed(4)}</span></>
              ) : (
                'Pase el cursor sobre cualquier celda para auditar su valor'
              )}
            </span>
            <span className="text-[9px] text-stone-400">0.0000 (Fondo) → 1.0000 (Trazo)</span>
          </div>

          <div className="grid grid-cols-8 gap-1 p-2 bg-stone-100 rounded-lg border border-stone-200">
            {embedding.embedding.map((val, i) => {
              const isBackground = val < 0.40;
              const isHeavy = val > 0.70;
              const row = Math.floor(i / 8) + 1;
              const col = (i % 8) + 1;
              const isHovered = hoveredCell?.index === i;

              let bgColor = '#ffffff';
              let textColor = '#94a3b8';
              let borderColor = '#e2e8f0';

              if (val < 0.20) {
                bgColor = '#ffffff'; textColor = '#94a3b8'; borderColor = '#e2e8f0';
              } else if (val < 0.40) {
                bgColor = '#fdfbf7'; textColor = '#78716c'; borderColor = '#e7e2d8';
              } else if (val <= 0.70) {
                const t = (val - 0.40) / 0.30;
                const r = Math.round(245 + (234 - 245) * t);
                const g = Math.round(158 + (88 - 158) * t);
                const b = Math.round(11 + (12 - 11) * t);
                bgColor = 'rgb(' + r + ', ' + g + ', ' + b + ')';
                borderColor = '#c2410c'; textColor = '#ffffff';
              } else {
                const t = (val - 0.70) / 0.30;
                const r = Math.round(59 + (24 - 59) * t);
                const g = Math.round(27 + (24 - 27) * t);
                const b = Math.round(8 + (27 - 8) * t);
                bgColor = 'rgb(' + r + ', ' + g + ', ' + b + ')';
                borderColor = '#09090b'; textColor = '#ffffff';
              }

              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredCell({ index: i, value: val, row, col })}
                  onMouseLeave={() => setHoveredCell(null)}
                  style={{
                    backgroundColor: bgColor,
                    borderColor: isHovered ? '#3b82f6' : borderColor,
                    color: textColor,
                    height: '30px',
                    borderRadius: '4px',
                    borderWidth: isHovered ? '2px' : '1px',
                    borderStyle: 'solid',
                    transform: isHovered ? 'scale(1.12)' : 'scale(1)',
                    transition: 'transform 0.1s ease',
                  }}
                  className="cursor-pointer flex items-center justify-center text-[9px] font-mono select-none"
                  title={'Celda #' + (i + 1) + ' [F' + row + ', C' + col + ']: ' + val.toFixed(4) + ' (' + (isBackground ? 'Fondo' : isHeavy ? 'Trazo oscuro' : 'Trazo medio') + ')'}
                >
                  {val.toFixed(2)}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between text-[10px] text-stone-600 bg-white border border-stone-200 rounded px-2.5 py-1.5 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-white border border-slate-300 inline-block"></span>
              <span>Fondo (&lt;0.40): <strong>{bgCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#f59e0b] border border-[#d97706] inline-block"></span>
              <span>Medios (0.40-0.70): <strong>{medCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#1c1917] border border-[#0c0a09] inline-block"></span>
              <span>Trazos (&gt;0.70): <strong>{hvyCount}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap justify-between text-[10px] text-stone-600 font-mono bg-stone-50 p-2 rounded border border-stone-200 gap-2">
            <span>Simetría H: <strong className="text-stone-800">{embedding.symmetryH.toFixed(1)}%</strong></span>
            <span>Simetría V: <strong className="text-stone-800">{embedding.symmetryV.toFixed(1)}%</strong></span>
            <span>Proporción: <strong className="text-stone-800">{embedding.proportions}</strong></span>
            <span>Varianza: <strong className="text-stone-800">{embedding.variance}</strong></span>
          </div>

          {bloqueoSimilitud && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-[11px] flex items-start gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <div>
                <strong>Similitud mayor al 85% detectada.</strong> El botón "Continuar a Certificado" permanecerá bloqueado. Modifique el diseño para reducir el riesgo de confusión con otro registro del padrón.
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-stone-200">
            <span className="text-[10px] text-stone-500">
              {embedding.processingTimeMs}ms · {new Date(embedding.timestamp).toLocaleTimeString('es-MX')}
            </span>
            <button
              type="button"
              onClick={executeVectorization}
              className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 text-[11px] font-semibold rounded border border-stone-300 transition-colors cursor-pointer"
            >
              🔄 Re-ejecutar Vectorización
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
