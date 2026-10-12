import React, { useState } from 'react';
import {
  History,
  X,
  RotateCcw,
  CheckCircle2,
  Clock,
  Trash2,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BookmarkPlus,
  Shield,
  Layers,
  ArrowRight,
  Database,
} from 'lucide-react';
import { RegistrationDraftVersion } from '../utils/draftHistory';
import { ProducerData } from '../types';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: RegistrationDraftVersion[];
  currentProducer: ProducerData;
  onRestoreVersion: (version: RegistrationDraftVersion) => void;
  onDeleteVersion: (id: string) => void;
  onClearAllVersions: () => void;
  onCreateManualCheckpoint: (label: string) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  versions,
  currentProducer,
  onRestoreVersion,
  onDeleteVersion,
  onClearAllVersions,
  onCreateManualCheckpoint,
}) => {
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [showNewCheckpointInput, setShowNewCheckpointInput] = useState(false);
  const [checkpointLabel, setCheckpointLabel] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [restoredId, setRestoredId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    const label = checkpointLabel.trim() || 'Punto de Restauración Manual';
    onCreateManualCheckpoint(label);
    setCheckpointLabel('');
    setShowNewCheckpointInput(false);
  };

  const handleRestore = (version: RegistrationDraftVersion) => {
    onRestoreVersion(version);
    setRestoredId(version.id);
    setTimeout(() => {
      setRestoredId(null);
      onClose();
    }, 800);
  };

  const getSourceBadge = (source: RegistrationDraftVersion['source']) => {
    switch (source) {
      case 'manual':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-full flex items-center gap-1">
            <BookmarkPlus className="w-3 h-3" />
            <span>Punto Manual</span>
          </span>
        );
      case 'step_change':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 rounded-full flex items-center gap-1">
            <Layers className="w-3 h-3" />
            <span>Cambio de Hoja</span>
          </span>
        );
      case 'auto':
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-300 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3 text-stone-500" />
            <span>Autoguardado</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-stone-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-400/50 rounded-xl text-amber-300 shadow-inner">
              <History className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-cinzel font-bold text-amber-100">
                  Historial de Versiones y Borradores Locales
                </h3>
                <span className="text-[10px] font-mono-data bg-amber-900/80 text-amber-200 px-2 py-0.5 rounded border border-amber-500/40">
                  {versions.length} {versions.length === 1 ? 'Versión' : 'Versiones'}
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                Recuperación automática de sesiones interrumpidas guardadas en este navegador.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Create Manual Checkpoint */}
        <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {!showNewCheckpointInput ? (
              <button
                type="button"
                onClick={() => setShowNewCheckpointInput(true)}
                className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-amber-800" />
                <span>Crear Punto de Restauración Ahora</span>
              </button>
            ) : (
              <form onSubmit={handleCreateCheckpoint} className="flex items-center gap-2">
                <input
                  type="text"
                  value={checkpointLabel}
                  onChange={(e) => setCheckpointLabel(e.target.value)}
                  placeholder="Etiqueta (ej. Antes de cambiar RFC)..."
                  className="px-2.5 py-1 text-xs border border-amber-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-600 bg-white w-52"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xs font-bold text-white bg-amber-800 hover:bg-amber-700 rounded-lg cursor-pointer"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCheckpointInput(false)}
                  className="px-2 py-1 text-xs text-stone-500 hover:text-stone-700 cursor-pointer"
                >
                  Cancelar
                </button>
              </form>
            )}
          </div>

          <div className="text-[11px] text-stone-500 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Almacenamiento Local Cifrado en Navegador</span>
          </div>
        </div>

        {/* Versions List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-stone-100/60">
          {versions.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white rounded-xl border border-dashed border-stone-300">
              <History className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h4 className="font-cinzel font-bold text-stone-700 text-sm sm:text-base">
                No hay versiones guardadas todavía
              </h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 leading-relaxed">
                El sistema guarda automáticamente versiones de respaldo conforme captura información en el formulario, al cambiar de hoja o al crear puntos de restauración manuales.
              </p>
            </div>
          ) : (
            versions.map((ver) => {
              const isExpanded = expandedVersionId === ver.id;
              const isRestored = restoredId === ver.id;

              return (
                <div
                  key={ver.id}
                  className={`bg-white rounded-xl border transition-all shadow-xs overflow-hidden ${
                    isRestored
                      ? 'border-emerald-500 ring-2 ring-emerald-200'
                      : 'border-stone-200 hover:border-amber-300 hover:shadow-sm'
                  }`}
                >
                  <div className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5 mb-2.5">
                      <div className="flex items-center gap-2">
                        {getSourceBadge(ver.source)}
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900 font-cinzel">
                          {ver.label}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-stone-500 text-[11px]">
                        <Clock className="w-3 h-3 text-stone-400" />
                        <span className="font-mono-data">
                          {ver.formattedDate} a las {ver.formattedTime}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                      <div className="bg-stone-50 p-2 rounded border border-stone-150">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wide block">Titular</span>
                        <strong className="text-stone-900 truncate block">
                          {ver.summary.producerName}
                        </strong>
                      </div>
                      <div className="bg-stone-50 p-2 rounded border border-stone-150">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wide block">Predio</span>
                        <strong className="text-stone-900 truncate block">
                          {ver.summary.propertyName}
                        </strong>
                      </div>
                      <div className="bg-stone-50 p-2 rounded border border-stone-150">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wide block">Ejido / Ubicación</span>
                        <strong className="text-stone-900 truncate block">
                          {ver.summary.ejido}
                        </strong>
                      </div>
                      <div className="bg-stone-50 p-2 rounded border border-stone-150">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wide block">Folio</span>
                        <strong className="text-amber-900 font-mono-data truncate block">
                          {ver.summary.folio}
                        </strong>
                      </div>
                    </div>

                    {/* Completion progress bar */}
                    <div className="flex items-center justify-between gap-3 text-xs mb-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-stone-600 font-medium">Completitud del Expediente</span>
                          <span className="font-mono-data font-bold text-amber-950">
                            {ver.completionPercentage}% ({ver.validFieldsCount}/{ver.totalFieldsCount} campos)
                          </span>
                        </div>
                        <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              ver.completionPercentage === 100
                                ? 'bg-emerald-600'
                                : ver.completionPercentage >= 50
                                ? 'bg-amber-600'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${ver.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedVersionId(isExpanded ? null : ver.id)}
                        className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>Ocultar datos completos</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>Ver detalles capturados</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onDeleteVersion(ver.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Eliminar esta versión"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRestore(ver)}
                          disabled={isRestored}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                            isRestored
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-800 hover:bg-amber-900 text-white'
                          }`}
                        >
                          {isRestored ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>¡Restaurado!</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restaurar Esta Versión</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details breakdown */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-stone-200 bg-stone-50/80 p-3 rounded-lg text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-stone-500 block">CURP:</span>
                          <span className="font-mono-data font-semibold">{ver.producerData.curp || '(Vacío)'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-500 block">RFC:</span>
                          <span className="font-mono-data font-semibold">{ver.producerData.rfc || '(Vacío)'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-500 block">Clave UPP:</span>
                          <span className="font-mono-data font-semibold">{ver.producerData.uppKey || '(Vacío)'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-500 block">Superficie:</span>
                          <span>{ver.producerData.surfaceHectares} ha ({ver.producerData.tenureType})</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-500 block">Censo Pecuario:</span>
                          <span>{ver.producerData.cattleCount} cabezas ({ver.producerData.species})</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-500 block">Libro Notarial:</span>
                          <span>{ver.producerData.bookNumber} · {ver.producerData.folioPage}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-stone-50 px-4 py-3 border-t border-stone-200 flex items-center justify-between shrink-0">
          <div>
            {versions.length > 0 && (
              !confirmClearAll ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="text-xs text-rose-700 hover:text-rose-900 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar Todo el Historial</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-800 font-bold">¿Borrar todas las versiones?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllVersions();
                      setConfirmClearAll(false);
                    }}
                    className="px-2 py-0.5 text-xs bg-rose-700 text-white rounded font-bold hover:bg-rose-800 cursor-pointer"
                  >
                    Sí, vaciar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="px-2 py-0.5 text-xs text-stone-600 hover:text-stone-800 cursor-pointer"
                  >
                    No
                  </button>
                </div>
              )
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-stone-700 hover:text-stone-900 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
