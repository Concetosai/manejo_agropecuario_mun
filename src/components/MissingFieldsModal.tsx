import React from 'react';
import { AlertCircle, X, ArrowRight, ArrowLeft } from 'lucide-react';

export interface MissingField {
  field: string;
  label: string;
}

interface MissingFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingFields: MissingField[];
  currentStep: number;
  onContinueAnyway: () => void;
}

export const MissingFieldsModal: React.FC<MissingFieldsModalProps> = ({
  isOpen,
  onClose,
  missingFields,
  currentStep,
  onContinueAnyway,
}) => {
  if (!isOpen || missingFields.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white border-2 border-amber-500 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-800 via-amber-700 to-amber-900 text-white p-4 sm:p-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="p-2 bg-amber-500/30 border border-amber-400/50 rounded-xl shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-amber-100" />
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-200 block">
                Validacion de Paso · Hoja {currentStep}
              </span>
              <h2 className="text-base font-cinzel font-bold text-white">
                Campos Obligatorios Faltantes
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-amber-200 hover:text-white p-1 rounded-lg hover:bg-amber-700/50 transition-colors cursor-pointer shrink-0"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3">
          <p className="text-xs text-stone-600 leading-relaxed">
            Para garantizar la integridad del expediente pecuario, los siguientes campos son obligatorios. Puede corregirlos ahora o continuar bajo su responsabilidad:
          </p>

          <ul className="space-y-1.5">
            {missingFields.map((item, idx) => (
              <li
                key={idx}
                className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                <span className="text-xs font-semibold text-amber-950">{item.label}</span>
              </li>
            ))}
          </ul>

          <div className="pt-3 border-t border-stone-200">
            <p className="text-[11px] text-stone-500 italic leading-relaxed">
              <strong className="text-amber-900">Nota:</strong> Si continua sin completar estos campos, el registro se guardara con informacion faltante y puede ser rechazado en la revision final.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-100 p-3.5 sm:p-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-stone-800 hover:bg-stone-900 rounded-lg shadow transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Corregir ahora</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onContinueAnyway();
            }}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Continuar de todas formas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};