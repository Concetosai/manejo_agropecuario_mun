import React, { useState, useMemo } from 'react';
import { HistoricalRecord } from '../types';
import {
  calculateVectorCosineSimilarity,
  computeVectorChecksum,
} from '../utils/brandVectorization';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Edit3,
  Upload,
  Sparkles,
  ArrowRight,
  FileWarning,
  FileCheck2,
  Link as LinkIcon,
} from 'lucide-react';

interface MatchResult {
  record: HistoricalRecord;
  similarityPct: number;
  isCritical: boolean;
}

interface AntiduplicidadModalProps {
  isOpen: boolean;
  onClose: () => void;
  newVector: number[];
  newImageSrc: string;
  newChecksum: string;
  allRecords: HistoricalRecord[];
  isLoading?: boolean;
  onEditWithPen: () => void;
  onUploadEdited: () => void;
  onGenerateProposals: () => void;
  onLinkToExpediente: () => void;
  onAcceptAndContinue: (advertencia?: {
    nivel: 'LOW' | 'MEDIUM' | 'HIGH';
    similarA?: string;
    similitudPct?: number;
  }) => void;
}

export const AntiduplicidadModal: React.FC<AntiduplicidadModalProps> = ({
  isOpen,
  onClose,
  newVector,
  newImageSrc,
  newChecksum,
  allRecords,
  isLoading = false,
  onEditWithPen,
  onUploadEdited,
  onGenerateProposals,
  onLinkToExpediente,
  onAcceptAndContinue,
}) => {
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);

  const analysis = useMemo(() => {
    if (!newVector || newVector.length !== 256) {
      return { matches: [], maxSimilarity: 0, totalChecked: 0, verdict: 'UNKNOWN' };
    }

    const results: MatchResult[] = [];

    // DIAGNÓSTICO TEMPORAL: trazar la procedencia y validez de cada vector comparado
    console.groupCollapsed('%c[DEBUG ANTIDUPLICIDAD] Comparación vectorial', 'color:#e11d48;font-weight:bold');
    console.log('Vector NUEVO (fierro propuesto):', {
      longitud: newVector.length,
      checksumDeclarado: newChecksum,
      checksumRecalculado: computeVectorChecksum(newVector),
      todosFinitos: newVector.every((v) => Number.isFinite(v)),
      suma: +newVector.reduce((a, b) => a + b, 0).toFixed(4),
      celdasActivas: newVector.filter((v) => v > 0.70).length,
      primeras8: newVector.slice(0, 8).map((v) => +v.toFixed(4)),
    });
    console.log('Registros recibidos:', allRecords.length, '· con vector 256D:',
      allRecords.filter((r) => Array.isArray(r.vector_64d || r.brandVector) && (r.vector_64d || r.brandVector)!.length === 256).length);

    for (const rec of allRecords) {
      const recVec = rec.vector_64d || rec.brandVector;
      if (!Array.isArray(recVec) || recVec.length !== 256) continue;
      if (!rec.folio) continue;

      const sim = calculateVectorCosineSimilarity(newVector, recVec);
      const pct = Math.round(sim * 1000) / 10;

      console.log(`[DEBUG] vs ${rec.folio}`, {
        folio: rec.folio,
        longitudNuevo: newVector.length,
        longitudGuardado: recVec.length,
        vectorNuevoValido: newVector.length === 256 && newVector.every(Number.isFinite),
        vectorGuardadoValido: recVec.length === 256 && recVec.every(Number.isFinite),
        checksumNuevo: newChecksum,
        checksumGuardado: rec.vector_checksum || computeVectorChecksum(recVec),
        checksumRecalculadoGuardado: computeVectorChecksum(recVec),
        sonIdenticos: newChecksum === (rec.vector_checksum || computeVectorChecksum(recVec)),
        similitudCalculada: sim,
        similitudPct: pct,
      });

      if (pct > 0) {
        results.push({
          record: rec,
          similarityPct: pct,
          isCritical: pct >= 85,
        });
      }
    }
    console.groupEnd();

    results.sort((a, b) => b.similarityPct - a.similarityPct);
    const maxSimilarity = results.length > 0 ? results[0].similarityPct : 0;

    let verdict: 'LIBRE' | 'REVISAR' | 'ALERTA' | 'DUPLICADO' = 'LIBRE';
    if (maxSimilarity >= 90) verdict = 'DUPLICADO';
    else if (maxSimilarity >= 80) verdict = 'ALERTA';
    else if (maxSimilarity >= 70) verdict = 'REVISAR';

    return {
      matches: results.slice(0, 5),
      maxSimilarity,
      totalChecked: results.length,
      verdict,
    };
  }, [newVector, allRecords]);

  const verdictConfig = {
    LIBRE: {
      color: 'emerald',
      bg: 'bg-emerald-50',
      border: 'border-emerald-400',
      text: 'text-emerald-950',
      badge: 'bg-emerald-600',
      icon: ShieldCheck,
      title: 'LIBRE DE DUPLICIDAD',
      subtitle: `Similitud máxima: ${analysis.maxSimilarity}% - No se encontraron coincidencias significativas`,
      canEmit: true,
      showAdvertencia: false,
    },
    REVISAR: {
      color: 'amber',
      bg: 'bg-amber-50',
      border: 'border-amber-400',
      text: 'text-amber-950',
      badge: 'bg-amber-600',
      icon: AlertTriangle,
      title: 'SIMILITUD MODERADA',
      subtitle: `Similitud máxima: ${analysis.maxSimilarity}% - Se recomienda revisar`,
      canEmit: true,
      showAdvertencia: true,
      nivelAdvertencia: 'LOW' as const,
    },
    ALERTA: {
      color: 'orange',
      bg: 'bg-orange-50',
      border: 'border-orange-400',
      text: 'text-orange-950',
      badge: 'bg-orange-600',
      icon: FileWarning,
      title: 'ALERTA DE SIMILITUD',
      subtitle: `Similitud máxima: ${analysis.maxSimilarity}% - Requiere atención`,
      canEmit: true,
      showAdvertencia: true,
      nivelAdvertencia: 'MEDIUM' as const,
    },
    DUPLICADO: {
      color: 'rose',
      bg: 'bg-rose-50',
      border: 'border-rose-400',
      text: 'text-rose-950',
      badge: 'bg-rose-600',
      icon: ShieldAlert,
      title: 'DUPLICADO DETECTADO',
      subtitle: `Similitud máxima: ${analysis.maxSimilarity}% - Requiere edición antes de continuar`,
      canEmit: false,
      showAdvertencia: true,
      nivelAdvertencia: 'HIGH' as const,
    },
    UNKNOWN: {
      color: 'stone',
      bg: 'bg-stone-50',
      border: 'border-stone-400',
      text: 'text-stone-950',
      badge: 'bg-stone-600',
      icon: AlertTriangle,
      title: 'SIN ANÁLISIS',
      subtitle: 'No se pudo analizar el fierro',
      canEmit: false,
      showAdvertencia: false,
    },
  };

  const config = verdictConfig[analysis.verdict as keyof typeof verdictConfig];
  const VerdictIcon = config.icon;

  if (!isOpen) return null;

  const handleLink = () => {
    onLinkToExpediente();
  };

  const handleAccept = () => {
    if (!config.canEmit) return;

    const advertencia = config.showAdvertencia
      ? {
          nivel: (config as any).nivelAdvertencia || 'LOW',
          similarA: analysis.matches[0]?.record.folio,
          similitudPct: analysis.maxSimilarity,
        }
      : undefined;

    onAcceptAndContinue(advertencia);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden border-2 border-stone-800">
        <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${config.badge} flex items-center justify-center text-white shrink-0`}>
              <VerdictIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 block">
                Verificación de Antiduplicidad · Comparación Vectorial 256D
              </span>
              <h3 className="text-base sm:text-lg font-cinzel font-bold text-amber-100">
                {config.title}
              </h3>
              <p className="text-[11px] text-stone-300 font-mono">
                {newChecksum}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`px-4 sm:px-6 py-4 ${config.bg} border-b-2 ${config.border}`}>
          <div className="flex items-start gap-3">
            <VerdictIcon className={`w-8 h-8 ${config.text} shrink-0`} />
            <div className="flex-1">
              <p className={`text-sm sm:text-base font-bold ${config.text}`}>
                {config.subtitle}
              </p>
              <p className="text-[11px] text-stone-600 mt-1">
                Comparado contra <strong>{analysis.totalChecked}</strong> registro(s) con vector 256D en el padrón municipal.
              </p>
            </div>
            <div className={`text-center shrink-0 ${config.text}`}>
              <span className="text-2xl sm:text-3xl font-black font-mono block">
                {analysis.maxSimilarity}%
              </span>
              <span className="text-[9px] uppercase tracking-wider block opacity-70">
                Similitud máx.
              </span>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center bg-stone-50 p-8">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-700 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm font-bold text-stone-700">
                Consultando padrón oficial de fierros...
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Comparando contra la hoja REGISTROS de Google Sheets
              </p>
            </div>
          </div>
        )}

        {!isLoading && (
        <div className="flex-1 overflow-y-auto bg-stone-50 p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border-2 border-emerald-300 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Fierro Propuesto
                </span>
                <span className="text-[10px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                  Este análisis
                </span>
              </div>
              <div className="aspect-square bg-stone-50 rounded-lg overflow-hidden flex items-center justify-center border border-stone-200">
                <img
                  src={newImageSrc}
                  alt="Fierro propuesto"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="mt-2 pt-2 border-t border-stone-200 text-[10px] font-mono text-stone-600">
                <div>Checksum: <span className="text-stone-900">{newChecksum}</span></div>
              </div>
            </div>

            <div className={`bg-white border-2 rounded-xl p-3 shadow-2xs ${
              analysis.maxSimilarity >= 90 ? 'border-rose-300' :
              analysis.maxSimilarity >= 70 ? 'border-amber-300' :
              'border-stone-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-stone-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Coincidencia más alta
                </span>
                {analysis.matches.length > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    analysis.maxSimilarity >= 85 ? 'bg-rose-100 text-rose-900' :
                    analysis.maxSimilarity >= 50 ? 'bg-amber-100 text-amber-900' :
                    'bg-stone-100 text-stone-700'
                  }`}>
                    {analysis.maxSimilarity}%
                  </span>
                )}
              </div>
              {analysis.matches.length > 0 ? (
                <>
                  <div className="aspect-square bg-stone-50 rounded-lg overflow-hidden flex items-center justify-center border border-stone-200">
                    {(() => {
                      const rec = selectedMatch?.record || analysis.matches[0].record;
                      const img = rec.extractedBrandImage || rec.imagen_base64 || (rec as any).fierroImageUrl || (rec as any).url_fierro || (rec as any).url_miniatura_fierro;
                      return img ? (
                        <img src={img} alt="Fierro similar" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-stone-400 text-xs p-4 text-center">
                          Sin imagen disponible
                          <br />
                          <span className="font-mono text-[10px]">{rec.folio}</span>
                        </span>
                      );
                    })()}
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-200 text-[10px] text-stone-700 space-y-0.5">
                    <div><strong>Folio:</strong> <span className="font-mono">{analysis.matches[0].record.folio}</span></div>
                    <div><strong>Productor:</strong> {analysis.matches[0].record.ownerName}</div>
                    <div><strong>Predio:</strong> {analysis.matches[0].record.propertyName || '—'}</div>
                    <div className="font-mono text-stone-500">
                      {analysis.matches[0].record.vector_checksum || analysis.matches[0].record.hash_vector || '—'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="aspect-square bg-stone-50 rounded-lg flex items-center justify-center border border-stone-200">
                  <div className="text-center text-stone-400 text-xs p-4">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <span>Sin coincidencias</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {analysis.matches.length > 1 && (
            <div className="bg-white border border-stone-200 rounded-xl p-3">
              <span className="text-[11px] font-bold uppercase text-stone-600 block mb-2">
                Otras coincidencias ({analysis.matches.length - 1})
              </span>
              <div className="space-y-1">
                {analysis.matches.slice(1).map((m, idx) => (
                  <button
                    key={m.record.folio || idx}
                    type="button"
                    onClick={() => setSelectedMatch(m)}
                    className="w-full flex items-center justify-between p-2 hover:bg-stone-50 rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-stone-500 shrink-0">
                        {m.record.folio}
                      </span>
                      <span className="text-xs text-stone-700 truncate">
                        {m.record.ownerName}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      m.similarityPct >= 85 ? 'bg-rose-100 text-rose-900' :
                      m.similarityPct >= 50 ? 'bg-amber-100 text-amber-900' :
                      'bg-stone-100 text-stone-700'
                    }`}>
                      {m.similarityPct}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(analysis.verdict === 'DUPLICADO' || analysis.verdict === 'ALERTA' || analysis.verdict === 'REVISAR') && (
            <div className={`${config.bg} border-2 ${config.border} rounded-xl p-4 space-y-3`}>
              <div className="flex items-start gap-2">
                <Sparkles className={`w-5 h-5 ${config.text} shrink-0 mt-0.5`} />
                <div>
                  <p className={`text-sm font-bold ${config.text}`}>
                    ¿Cómo desea resolverlo?
                  </p>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    Puede editar el fierro o aceptarlo con advertencia (según el nivel de similitud).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={onEditWithPen}
                  className="p-3 bg-white hover:bg-stone-50 border-2 border-stone-300 hover:border-stone-800 rounded-xl transition-all cursor-pointer flex items-start gap-2 text-left group"
                >
                  <Edit3 className="w-4 h-4 text-stone-700 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      ✏️ Editar con pincel
                    </span>
                    <span className="text-[10px] text-stone-500 leading-snug block mt-0.5">
                      Ajuste manual del fierro en el canvas
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onUploadEdited}
                  className="p-3 bg-white hover:bg-stone-50 border-2 border-stone-300 hover:border-stone-800 rounded-xl transition-all cursor-pointer flex items-start gap-2 text-left group"
                >
                  <Upload className="w-4 h-4 text-stone-700 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      📷 Subir editada
                    </span>
                    <span className="text-[10px] text-stone-500 leading-snug block mt-0.5">
                      El productor trae nueva foto
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onGenerateProposals}
                  className="p-3 bg-amber-50 hover:bg-amber-100 border-2 border-amber-400 hover:border-amber-700 rounded-xl transition-all cursor-pointer flex items-start gap-2 text-left group"
                >
                  <Sparkles className="w-4 h-4 text-amber-800 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="text-xs font-bold text-amber-950 block">
                      ⚡ Propuestas automáticas
                    </span>
                    <span className="text-[10px] text-amber-800 leading-snug block mt-0.5">
                      3 variaciones basadas en tu imagen
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        <div className="p-3 sm:p-4 bg-stone-100 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-stone-500 font-mono">
            Vector 256D · Similitud de Coseno · Umbral ≥50% advertencia · ≥85% bloqueo
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            {config.canEmit && (
              <>
                <button
                  type="button"
                  onClick={handleLink}
                  className="px-4 py-2 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5 ring-2 ring-blue-500/30"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Vincular al Expediente</span>
                </button>

                <button
                  type="button"
                  onClick={handleAccept}
                  className={`px-5 py-2 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-2 ${
                    config.color === 'emerald' ? 'bg-emerald-700 hover:bg-emerald-600' :
                    config.color === 'amber' ? 'bg-amber-700 hover:bg-amber-600' :
                    config.color === 'orange' ? 'bg-orange-700 hover:bg-orange-600' :
                    'bg-stone-700 hover:bg-stone-600'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>
                    {config.showAdvertencia ? 'Aceptar con advertencia' : 'Emitir pase pre-certificado'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
            {!config.canEmit && (
              <div className="px-4 py-2 bg-rose-100 border border-rose-400 text-rose-900 text-xs font-bold rounded-lg flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Edite el fierro para continuar</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
