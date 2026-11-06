import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  FileEdit,
  RotateCcw,
  Sparkles,
  DollarSign,
  FileText,
} from 'lucide-react';

export interface CamposEditados {
  [campo: string]: {
    anterior: string;
    nuevo: string;
  };
}

interface ModalResultadoVerificacionProps {
  isOpen: boolean;
  onClose: () => void;
  exito: boolean;
  camposEditados: CamposEditados;
  requisitosMarcados: number;
  totalRequisitos: number;
  errores?: string[];
  onGenerarRecibo: () => void;
  onVolverAEditar: () => void;
}

/**
 * FASE_REVALIDACION_RESULTADO: Modal de resultado verde (éxito) o rojo (error)
 */
export const ModalResultadoVerificacion: React.FC<ModalResultadoVerificacionProps> = ({
  isOpen,
  onClose,
  exito,
  camposEditados,
  requisitosMarcados,
  totalRequisitos,
  errores = [],
  onGenerarRecibo,
  onVolverAEditar,
}) => {
  if (!isOpen) return null;

  const totalCambios = Object.keys(camposEditados).length;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[96vh] flex flex-col overflow-hidden border-2 ${
          exito ? 'border-emerald-600' : 'border-rose-600'
        }`}
      >
        {/* HEADER */}
        <div
          className={`text-white p-5 sm:p-6 flex items-center gap-4 shrink-0 ${
            exito
              ? 'bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-700'
              : 'bg-gradient-to-r from-rose-700 via-rose-800 to-rose-700'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              exito ? 'bg-white/20' : 'bg-white/20'
            }`}
          >
            {exito ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-100" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-rose-100" />
            )}
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/80 block">
              Paso 3 de 4 · Resultado de la Verificación
            </span>
            <h3 className="text-lg sm:text-2xl font-cinzel font-bold text-white">
              {exito ? '✅ Verificación Exitosa' : '🔴 Verificación con Problemas'}
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              {exito
                ? 'Los datos fueron verificados correctamente. Puede generar el recibo de pago.'
                : 'Se encontraron problemas que impiden continuar. Corrija antes de proceder.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto bg-stone-50 p-5 sm:p-6 space-y-4">
          {/* RESUMEN DE VERIFICACIÓN */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-stone-200 rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Requisitos Verificados
              </span>
              <span className={`text-3xl font-black block mt-1 ${exito ? 'text-emerald-700' : 'text-stone-600'}`}>
                {requisitosMarcados}/{totalRequisitos}
              </span>
              <span className="text-[10px] text-stone-500 mt-0.5 block">
                {requisitosMarcados === totalRequisitos ? '✅ Completos' : `Faltan ${totalRequisitos - requisitosMarcados}`}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Cambios Aplicados
              </span>
              <span className={`text-3xl font-black block mt-1 ${totalCambios > 0 ? 'text-blue-700' : 'text-stone-600'}`}>
                {totalCambios}
              </span>
              <span className="text-[10px] text-stone-500 mt-0.5 block">
                {totalCambios === 0 ? 'Sin modificaciones' : `Campo(s) modificado(s)`}
              </span>
            </div>
          </div>

          {/* ÉXITO — Resumen de cambios */}
          {exito && totalCambios > 0 && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileEdit className="w-5 h-5 text-blue-700" />
                <h4 className="text-sm font-bold text-blue-900">
                  📝 Cambios que se aplicarán al padrón
                </h4>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {Object.entries(camposEditados).map(([key, { anterior, nuevo }]) => (
                  <div
                    key={key}
                    className="bg-white rounded-lg p-2.5 border border-blue-200 text-xs"
                  >
                    <span className="font-bold text-blue-900 uppercase block text-[10px] mb-0.5">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-stone-500 line-through truncate max-w-[200px]">
                        {anterior || '(vacío)'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-blue-700 shrink-0" />
                      <span className="text-blue-900 font-bold truncate max-w-[250px]">
                        {nuevo || '(vacío)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {exito && totalCambios === 0 && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 text-center">
              <Sparkles className="w-8 h-8 text-emerald-700 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-900">
                ✅ Sin cambios detectados
              </p>
              <p className="text-xs text-emerald-800 mt-1">
                Los datos del productor coinciden con el padrón. Se revalidará con los mismos datos.
              </p>
            </div>
          )}

          {/* ERROR — Lista de problemas */}
          {!exito && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
                <h4 className="text-sm font-bold text-rose-900">
                  ⛔ No se puede continuar por:
                </h4>
              </div>
              <ul className="space-y-1.5">
                {errores.map((err, idx) => (
                  <li
                    key={idx}
                    className="bg-white rounded-lg p-2.5 border border-rose-200 text-xs text-rose-900 flex items-start gap-2"
                  >
                    <span className="text-rose-600 font-bold shrink-0">•</span>
                    <span>{err}</span>
                  </li>
                ))}
                {errores.length === 0 && (
                  <li className="text-xs text-rose-800 italic">
                    Error desconocido. Intente nuevamente.
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* NOTA INFORMATIVA */}
          {exito && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 flex items-start gap-2">
              <FileText className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Al generar el recibo:</p>
                <ul className="mt-1 space-y-0.5 text-[10px]">
                  <li>• Los cambios se aplicarán a REGISTROS (nombre, CURP, etc.)</li>
                  <li>• El estatus cambiará a <strong>REVALIDADO</strong></li>
                  <li>• La vigencia se actualizará (+3 años)</li>
                  <li>• Se guardará el historial en REVALIDACIONES</li>
                  <li>• Se generará la orden de cobro en Finanzas</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-stone-500 font-mono">
            Verificación {exito ? 'exitosa' : 'con errores'}
          </span>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={exito ? onClose : onVolverAEditar}
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {exito ? (
                <>
                  <X className="w-4 h-4" />
                  <span>Cerrar</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Corregir</span>
                </>
              )}
            </button>

            {exito && (
              <button
                type="button"
                onClick={onGenerarRecibo}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white text-xs font-black rounded-lg shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ring-2 ring-emerald-400/40"
              >
                <DollarSign className="w-4 h-4" />
                <span>Generar Recibo de Pago</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};