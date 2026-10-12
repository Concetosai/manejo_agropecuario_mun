import React, { useState, useMemo } from 'react';
import { HistoricalRecord } from '../types';
import {
  runVectorSimilarityAnalysis,
  VectorComparisonResult,
} from '../utils/localFierrosStorage';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Eye,
  Layers,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface VectorComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceRecord: HistoricalRecord | null;
  allRecords: HistoricalRecord[];
  onSelectCandidateForCertificate?: (record: HistoricalRecord) => void;
}

export const VectorComparisonModal: React.FC<VectorComparisonModalProps> = ({
  isOpen,
  onClose,
  sourceRecord,
  allRecords,
  onSelectCandidateForCertificate,
}) => {
  const [selectedDetail, setSelectedDetail] = useState<VectorComparisonResult | null>(null);

  // Compute similarity analysis reactively
  const analysis = useMemo(() => {
    if (!sourceRecord) return null;
    return runVectorSimilarityAnalysis(sourceRecord, allRecords, 0.75);
  }, [sourceRecord, allRecords]);

  if (!isOpen || !sourceRecord || !analysis) return null;

  const sourceVec = sourceRecord.vector_64d || sourceRecord.brandVector || [];

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white border-2 border-stone-300 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className={`px-5 py-4 text-white flex items-center justify-between gap-3 ${
            analysis.hasAnyMatch
              ? 'bg-gradient-to-r from-amber-700 via-amber-800 to-rose-900'
              : 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-stone-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              {analysis.hasAnyMatch ? (
                <AlertTriangle className="w-6 h-6 text-amber-200" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-200" />
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-80 block">
                Auditoría Biométrica de Fierros · Similitud de Coseno (64D)
              </span>
              <h3 className="text-base sm:text-lg font-cinzel font-bold leading-tight">
                {selectedDetail
                  ? 'Auditoría Lado a Lado de Vectores (8x8)'
                  : analysis.hasAnyMatch
                  ? '⚠️ Posibles Coincidencias Detectadas en el Padrón'
                  : '✅ No se Encontraron Fierros Duplicados'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedDetail(null);
              onClose();
            }}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-stone-50/50">
          {/* Target Record Card */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 bg-stone-50 border border-stone-300 rounded-lg p-1 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                {sourceRecord.extractedBrandImage || sourceRecord.imagen_base64 ? (
                  <img
                    src={sourceRecord.extractedBrandImage || sourceRecord.imagen_base64}
                    alt="Fierro Auditado"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-2xl font-cinzel font-bold text-stone-800">
                    {sourceRecord.initials || 'S/F'}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                    FIERRO AUDITADO
                  </span>
                  {sourceRecord.isLocal && (
                    <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                      ⭐ Local / Histórico
                    </span>
                  )}
                </div>
                <h4 className="text-sm sm:text-base font-bold font-cinzel text-stone-900 mt-1">
                  {sourceRecord.ownerName}
                </h4>
                <p className="text-xs text-stone-600 font-mono-data">
                  Folio: <strong className="text-stone-800">{sourceRecord.folio}</strong> · Predio:{' '}
                  {sourceRecord.propertyName} ({sourceRecord.ejido}, Ver.)
                </p>
                <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                  Huella: <span className="text-amber-800 font-bold">{sourceRecord.hash_vector || 'VEC64-ACTIVO'}</span>
                </p>
              </div>
            </div>

            <div className="text-center sm:text-right shrink-0 bg-stone-50 sm:bg-transparent p-2.5 rounded-lg border sm:border-0 border-stone-200 w-full sm:w-auto">
              <span className="text-[11px] text-stone-500 block">Fierros Comparados</span>
              <span className="text-xl sm:text-2xl font-mono-data font-black text-stone-800">
                {analysis.comparedCount}
              </span>
              <span className="text-[10px] text-stone-400 block">Umbral de alerta: ≥ 75.0%</span>
            </div>
          </div>

          {/* VIEW A: SIDE-BY-SIDE 8x8 DETAIL AUDIT */}
          {selectedDetail ? (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  className="px-3.5 py-1.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>← Volver a Lista de Coincidencias</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">Similitud de Coseno:</span>
                  <span
                    className={`px-3 py-1 rounded-lg text-sm font-black font-mono-data ${
                      selectedDetail.similarityPct >= 90
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {selectedDetail.similarityPct}%
                  </span>
                </div>
              </div>

              {/* Side by Side Grid Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lado 1: Fierro Original */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-stone-500">
                      Fierro Original (A)
                    </span>
                    <span className="text-xs font-mono font-bold text-stone-800">
                      {sourceRecord.folio}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-stone-50 border border-stone-300 rounded p-1 shrink-0 flex items-center justify-center overflow-hidden">
                      {sourceRecord.extractedBrandImage || sourceRecord.imagen_base64 ? (
                        <img
                          src={sourceRecord.extractedBrandImage || sourceRecord.imagen_base64}
                          alt="Fierro A"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="font-bold text-xl">{sourceRecord.initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-stone-900 truncate">
                        {sourceRecord.ownerName}
                      </p>
                      <p className="text-xs text-stone-500 truncate">
                        {sourceRecord.propertyName} · {sourceRecord.ejido}
                      </p>
                      <p className="text-[10px] font-mono text-stone-400 truncate">
                        {sourceRecord.hash_vector}
                      </p>
                    </div>
                  </div>

                  {/* Matriz 8x8 Original */}
                  <div>
                    <span className="text-[10px] font-mono uppercase text-stone-400 block mb-1">
                      Matriz 8x8 Normalizada (Sobel)
                    </span>
                    <div className="grid grid-cols-8 gap-1 p-2 bg-stone-100 rounded-lg border border-stone-200">
                      {sourceVec.map((val, i) => {
                        const isDiff = selectedDetail.diffVector[i] > 0.3;
                        return (
                          <div
                            key={i}
                            className={`h-7 rounded flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
                              isDiff
                                ? 'bg-rose-500 text-white ring-1 ring-rose-700 shadow-xs'
                                : val > 0.7
                                ? 'bg-stone-900 text-amber-300'
                                : val > 0.35
                                ? 'bg-amber-500 text-stone-950'
                                : 'bg-white text-stone-500 border border-stone-200'
                            }`}
                            title={`Celda #${i + 1}: ${val.toFixed(2)} ${
                              isDiff ? `(Discrepancia Δ=${selectedDetail.diffVector[i].toFixed(2)} > 0.30)` : ''
                            }`}
                          >
                            {val.toFixed(2)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Lado 2: Fierro Similar Detectado */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-amber-800">
                      Fierro Similar Detectado (B)
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-900">
                      {selectedDetail.candidate.folio}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-stone-50 border border-stone-300 rounded p-1 shrink-0 flex items-center justify-center overflow-hidden">
                      {selectedDetail.candidate.extractedBrandImage ||
                      selectedDetail.candidate.imagen_base64 ? (
                        <img
                          src={
                            selectedDetail.candidate.extractedBrandImage ||
                            selectedDetail.candidate.imagen_base64
                          }
                          alt="Fierro B"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="font-bold text-xl">
                          {selectedDetail.candidate.initials || 'S/F'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-stone-900 truncate">
                        {selectedDetail.candidate.ownerName}
                      </p>
                      <p className="text-xs text-stone-500 truncate">
                        {selectedDetail.candidate.propertyName} · {selectedDetail.candidate.ejido}
                      </p>
                      <p className="text-[10px] font-mono text-amber-800 truncate">
                        {selectedDetail.candidate.hash_vector || 'VEC64-CANDIDATO'}
                      </p>
                    </div>
                  </div>

                  {/* Matriz 8x8 Candidato */}
                  <div>
                    <span className="text-[10px] font-mono uppercase text-stone-400 block mb-1">
                      Matriz 8x8 Normalizada (Sobel)
                    </span>
                    <div className="grid grid-cols-8 gap-1 p-2 bg-stone-100 rounded-lg border border-stone-200">
                      {(selectedDetail.candidate.vector_64d || selectedDetail.candidate.brandVector || []).map(
                        (val, i) => {
                          const isDiff = selectedDetail.diffVector[i] > 0.3;
                          return (
                            <div
                              key={i}
                              className={`h-7 rounded flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
                                isDiff
                                  ? 'bg-rose-500 text-white ring-1 ring-rose-700 shadow-xs'
                                  : val > 0.7
                                  ? 'bg-stone-900 text-amber-300'
                                  : val > 0.35
                                  ? 'bg-amber-500 text-stone-950'
                                  : 'bg-white text-stone-500 border border-stone-200'
                              }`}
                              title={`Celda #${i + 1}: ${val.toFixed(2)} ${
                                isDiff ? `(Discrepancia Δ=${selectedDetail.diffVector[i].toFixed(2)} > 0.30)` : ''
                              }`}
                            >
                              {val.toFixed(2)}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Leyenda y Diagnóstico de Discrepancia */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2 text-stone-700">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/70 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-rose-500 inline-block shadow-2xs"></span>
                    <span className="font-bold text-rose-900">
                      Celdas con Discrepancia Significativa (|A - B| &gt; 0.30):{' '}
                      <strong>{selectedDetail.mismatchedCellCount}</strong> de 64
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-stone-900 inline-block shadow-2xs"></span>
                    <span>Trazos Coincidentes (|A - B| ≤ 0.30): <strong>{64 - selectedDetail.mismatchedCellCount}</strong> celdas</span>
                  </div>
                </div>

                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Las celdas resaltadas en <strong>rojo</strong> muestran los bloques espaciales donde los trazos difieren significativamente entre ambos fierros quemadores. Si la similitud supera el <strong>75%</strong>, la Ley Ganadera de Veracruz recomienda verificar que no exista riesgo de confusión visual en campo.
                </p>
              </div>
            </div>
          ) : (
            /* VIEW B: LIST OF MATCHES OR SUCCESS EMPTY STATE */
            <div className="space-y-4">
              {analysis.hasAnyMatch ? (
                <>
                  <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block">Alerta de Similitud Vectorial:</strong>
                      Se detectaron <strong>{analysis.matches.length}</strong> registro(s) en el Padrón Municipal con similitud igual o superior al 75.0%. Haga clic en <strong>"Ver Detalles de Comparación"</strong> para auditar visualmente las matrices 8x8 lado a lado.
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {analysis.matches.map((match, idx) => (
                      <div
                        key={match.candidate.id || idx}
                        className="bg-white p-4 rounded-xl border border-stone-200 hover:border-amber-400 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-14 h-14 bg-stone-50 border border-stone-300 rounded-lg p-1 shrink-0 flex items-center justify-center overflow-hidden">
                            {match.candidate.extractedBrandImage || match.candidate.imagen_base64 ? (
                              <img
                                src={
                                  match.candidate.extractedBrandImage ||
                                  match.candidate.imagen_base64
                                }
                                alt={match.candidate.ownerName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="font-bold text-lg text-stone-800">
                                {match.candidate.initials || 'S/F'}
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono-data text-xs font-bold text-stone-900">
                                {match.candidate.folio}
                              </span>
                              {match.candidate.isLocal && (
                                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                                  ⭐ Local
                                </span>
                              )}
                              <span className="text-[10px] text-stone-400 font-mono">
                                {match.candidate.registrationNumber}
                              </span>
                            </div>
                            <h5 className="font-bold text-sm text-stone-900 font-cinzel mt-0.5">
                              {match.candidate.ownerName}
                            </h5>
                            <p className="text-xs text-stone-500">
                              Predio: {match.candidate.propertyName} ({match.candidate.ejido}, Ver.)
                            </p>
                          </div>
                        </div>

                        {/* Similarity badge and detail button */}
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100">
                          <div className="text-right">
                            <span
                              className={`px-3 py-1 rounded-lg text-xs font-black font-mono-data inline-block ${
                                match.similarityPct >= 90
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              {match.similarityPct}% de similitud
                            </span>
                            <span className="text-[10px] text-stone-400 block mt-0.5">
                              {match.mismatchedCellCount} celdas dif.
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedDetail(match)}
                            className="px-3.5 py-2 text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                            title="Auditar matrices numéricas 8x8 lado a lado"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Detalles</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-8 bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-bold text-emerald-950 font-cinzel">
                    ✅ No se Encontraron Fierros Duplicados
                  </h4>
                  <p className="text-xs sm:text-sm text-emerald-800 max-w-lg mx-auto leading-relaxed">
                    Este fierro es <strong>matemáticamente único en el padrón municipal</strong>. No se registraron marcas de fuego con similitud igual o superior al umbral legal del 75.0%.
                  </p>
                  {analysis.topMatch && (
                    <div className="inline-block p-2 bg-white rounded-lg border border-emerald-200 text-xs text-stone-600 font-mono-data mt-2">
                      Máxima similitud encontrada:{' '}
                      <strong className="text-stone-900">{analysis.topMatch.similarityPct}%</strong> con{' '}
                      {analysis.topMatch.candidate.ownerName} ({analysis.topMatch.candidate.folio})
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
          <span className="font-mono text-[11px] text-stone-500">
            Filtro Sobel + Raster 8x8 · Checksum FNV-1a
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedDetail(null);
              onClose();
            }}
            className="px-5 py-2 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
