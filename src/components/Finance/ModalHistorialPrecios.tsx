import React from 'react';
import {
  X,
  Clock,
  TrendingUp,
  User,
  Calendar,
  AlertCircle,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import { ConceptoFinanciero, HistorialPrecio } from '../../types';
import { getConceptPriceHistory } from '../../services/financeCatalogService';

interface ModalHistorialPreciosProps {
  isOpen: boolean;
  onClose: () => void;
  concepto: ConceptoFinanciero | null;
}

export const ModalHistorialPrecios: React.FC<ModalHistorialPreciosProps> = ({
  isOpen,
  onClose,
  concepto,
}) => {
  if (!isOpen || !concepto) return null;

  const history = getConceptPriceHistory(concepto.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full border-2 border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
              style={{ backgroundColor: concepto.color || '#D97706' }}
            >
              <TrendingUp size={20} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 block">
                Auditoría y Trazabilidad de Precios
              </span>
              <h3 className="text-base font-black font-cinzel text-white truncate max-w-xs">
                {concepto.codigo} · {concepto.nombre}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Price Banner */}
        <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs shrink-0">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-800 block">Precio Actual Vigente</span>
            <span className="text-xl font-black font-mono text-amber-950">
              ${concepto.precioBase.toFixed(2)} MXN
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-stone-500 block">Con IVA ({concepto.ivaPorcentaje}%):</span>
            <span className="text-sm font-bold font-mono text-stone-800">
              ${concepto.precioConIva.toFixed(2)} MXN
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Registro Histórico de Modificaciones ({history.length}):
          </h4>

          {history.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-500 border border-dashed border-stone-300 rounded-2xl">
              <Clock className="w-8 h-8 text-stone-400 mx-auto mb-2 opacity-60" />
              <span>No se registran cambios de precio previos para este concepto. El precio inicial es el vigente.</span>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
              {history.map((h) => (
                <div key={h.id} className="relative group">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow-xs" />
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs space-y-1.5 hover:bg-white transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-stone-900 text-sm">
                        ${h.precioAnterior.toFixed(2)} → <span className="text-emerald-700">${h.precioNuevo.toFixed(2)} MXN</span>
                      </span>
                      <span className="text-[10px] font-mono text-stone-400">
                        {new Date(h.fechaCambio).toLocaleDateString()} {new Date(h.fechaCambio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-stone-700 font-medium">
                      <strong>Motivo:</strong> {h.motivo}
                    </p>

                    <div className="flex items-center gap-1.5 text-[10px] text-stone-500 pt-1 border-t border-stone-100">
                      <User size={12} className="text-stone-400" />
                      <span>Modificado por: <strong>{h.userName || h.userId}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  );
};
