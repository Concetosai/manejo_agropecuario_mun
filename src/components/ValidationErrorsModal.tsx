import React from 'react';
import { AlertTriangle, X, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { FullFormValidationError } from '../utils/formValidation';

interface ValidationErrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  errors: FullFormValidationError[];
  actionAttempted?: 'print' | 'save' | 'proceed';
  onNavigateToStep?: (step: 1 | 2 | 3) => void;
}

export const ValidationErrorsModal: React.FC<ValidationErrorsModalProps> = ({
  isOpen,
  onClose,
  errors,
  actionAttempted = 'print',
  onNavigateToStep,
}) => {
  if (!isOpen || errors.length === 0) return null;

  const step1Errors = errors.filter((e) => e.step === 1);
  const step2Errors = errors.filter((e) => e.step === 2);
  const step3Errors = errors.filter((e) => e.step === 3);

  const actionTitle =
    actionAttempted === 'print'
      ? 'Impresión Bloqueada: Expediente Pecuario Incompleto'
      : actionAttempted === 'save'
      ? 'Asiento Notarial Bloqueado: Faltan Datos Obligatorios'
      : 'Trámite Bloqueado: Se Requiere Formulario Completo';

  const actionDescription =
    actionAttempted === 'print'
      ? 'De conformidad con los Artículos 45 al 62 de la Ley Ganadera del Estado de Veracruz, está prohibido expedir o imprimir títulos de marca, certificados de fierro o credenciales ganaderas con datos incompletos o formatos no validados.'
      : 'Para garantizar la seguridad jurídica del productor y la no-duplicidad en el padrón municipal, el expediente debe contar con el 100% de los campos debidamente validados antes de continuar.';

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white border-2 border-rose-500 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 text-white p-4 sm:p-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="p-2 bg-rose-500/30 border border-rose-400/50 rounded-xl shrink-0 mt-0.5">
              <ShieldAlert className="w-6 h-6 text-rose-200" />
            </span>
            <div>
              <span className="text-[10px] sm:text-xs uppercase font-bold tracking-wider text-rose-300 block">
                Control Jurídico y Notarial · H. Ayuntamiento de Pánuco
              </span>
              <h2 className="text-base sm:text-lg font-cinzel font-bold text-white">
                {actionTitle}
              </h2>
              <p className="text-xs text-rose-100 mt-1 leading-relaxed">
                {actionDescription}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-rose-200 hover:text-white p-1 rounded-lg hover:bg-rose-700/50 transition-colors cursor-pointer shrink-0"
            title="Cerrar aviso"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counter Strip */}
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-rose-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            Se encontraron {errors.length} {errors.length === 1 ? 'campo pendiente o inválido' : 'campos pendientes o con formato inválido'}:
          </span>
          <span className="font-mono-data text-[11px] font-bold text-rose-700 bg-rose-200/70 px-2 py-0.5 rounded">
            Estatus: RECHAZADO HASTA CORRECCIÓN
          </span>
        </div>

        {/* Error List Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Step 1 Errors */}
          {step1Errors.length > 0 && (
            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-stone-100 px-3.5 py-2 border-b border-stone-200 flex items-center justify-between">
                <span className="font-bold text-stone-800 font-cinzel text-xs">
                  Paso 1: Datos del Titular o Productor Pecuario ({step1Errors.length})
                </span>
                {onNavigateToStep && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToStep(1);
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ir a Paso 1</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <ul className="divide-y divide-stone-100 p-2 space-y-1 bg-white">
                {step1Errors.map((err) => (
                  <li key={err.field} className="p-2 bg-rose-50/50 rounded-lg flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                    <div>
                      <strong className="text-stone-900 font-semibold">{err.label}: </strong>
                      <span className="text-rose-800">{err.message}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 2 Errors */}
          {step2Errors.length > 0 && (
            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-stone-100 px-3.5 py-2 border-b border-stone-200 flex items-center justify-between">
                <span className="font-bold text-stone-800 font-cinzel text-xs">
                  Paso 2: Datos del Predio y Producción ({step2Errors.length})
                </span>
                {onNavigateToStep && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToStep(2);
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ir a Paso 2</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <ul className="divide-y divide-stone-100 p-2 space-y-1 bg-white">
                {step2Errors.map((err) => (
                  <li key={err.field} className="p-2 bg-rose-50/50 rounded-lg flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                    <div>
                      <strong className="text-stone-900 font-semibold">{err.label}: </strong>
                      <span className="text-rose-800">{err.message}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 3 Errors */}
          {step3Errors.length > 0 && (
            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-stone-100 px-3.5 py-2 border-b border-stone-200 flex items-center justify-between">
                <span className="font-bold text-stone-800 font-cinzel text-xs">
                  Paso 3: Control Notarial y Asiento en Libros ({step3Errors.length})
                </span>
                {onNavigateToStep && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToStep(3);
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ir a Paso 3</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <ul className="divide-y divide-stone-100 p-2 space-y-1 bg-white">
                {step3Errors.map((err) => (
                  <li key={err.field} className="p-2 bg-rose-50/50 rounded-lg flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                    <div>
                      <strong className="text-stone-900 font-semibold">{err.label}: </strong>
                      <span className="text-rose-800">{err.message}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-stone-100 p-3.5 sm:p-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[11px] text-stone-500 text-center sm:text-left">
            Complete y valide los campos marcados para habilitar el trámite e impresión.
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onNavigateToStep && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  const firstStep = errors[0]?.step || 1;
                  onNavigateToStep(firstStep);
                }}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Corregir en Paso {errors[0]?.step || 1}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-200 hover:bg-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
