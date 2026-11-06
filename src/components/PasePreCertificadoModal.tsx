import React, { useState } from 'react';
import { X, User, Phone, CreditCard, MapPin, FileText, AlertTriangle } from 'lucide-react';

interface PasePreCertificadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (datos: {
    solicitante_nombre: string;
    solicitante_telefono: string;
    solicitante_curp?: string;
    solicitante_rfc?: string;
    solicitante_ejido?: string;
    solicitante_municipio?: string;
    solicitante_notas?: string;
  }) => void;
  checksumVector: string;
  diasVigencia: number;
}

export const PasePreCertificadoModal: React.FC<PasePreCertificadoModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  checksumVector,
  diasVigencia,
}) => {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [curp, setCurp] = useState('');
  const [rfc, setRfc] = useState('');
  const [ejido, setEjido] = useState('');
  const [municipio, setMunicipio] = useState('PÁNUCO');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!nombre.trim()) {
      setError('El nombre del solicitante es obligatorio');
      return;
    }
    if (!telefono.trim() || telefono.replace(/\D/g, '').length < 10) {
      setError('El teléfono es obligatorio (mínimo 10 dígitos)');
      return;
    }
    onConfirm({
      solicitante_nombre: nombre.trim().toUpperCase(),
      solicitante_telefono: telefono.trim(),
      solicitante_curp: curp.trim().toUpperCase() || undefined,
      solicitante_rfc: rfc.trim().toUpperCase() || undefined,
      solicitante_ejido: ejido.trim().toUpperCase() || undefined,
      solicitante_municipio: municipio.trim().toUpperCase() || 'PÁNUCO',
      solicitante_notas: notas.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[96vh] flex flex-col overflow-hidden border-2 border-emerald-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200 block">
                Emisión de Pase Pre-Certificado
              </span>
              <h3 className="text-base sm:text-lg font-cinzel font-bold text-white">
                Datos del Solicitante
              </h3>
              <p className="text-[11px] text-emerald-100 font-mono">
                Vector: {checksumVector}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info */}
        <div className="px-4 sm:px-6 py-3 bg-amber-50 border-b-2 border-amber-300">
          <div className="flex items-start gap-2 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Vigencia del pase:</strong> {diasVigencia} días hábiles a partir de la emisión.
              <br />
              <span className="text-amber-800">
                Este documento autoriza únicamente la hechura del fierro. El productor deberá presentar el fierro físico antes de la fecha de vencimiento.
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-700" />
                Nombre completo del solicitante *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value.toUpperCase())}
                placeholder="Ej. JUAN PÉREZ LÓPEZ"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-stone-50/50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                Teléfono de contacto *
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej. 8461234567"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                CURP (opcional)
              </label>
              <input
                type="text"
                maxLength={18}
                value={curp}
                onChange={(e) => setCurp(e.target.value.toUpperCase())}
                placeholder="18 caracteres"
                className="w-full px-3.5 py-2 text-sm font-mono border border-stone-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                RFC (opcional)
              </label>
              <input
                type="text"
                maxLength={13}
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
                placeholder="13 caracteres"
                className="w-full px-3.5 py-2 text-sm font-mono border border-stone-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                Ejido / Congregación (opcional)
              </label>
              <input
                type="text"
                value={ejido}
                onChange={(e) => setEjido(e.target.value.toUpperCase())}
                placeholder="Ej. REVENTADERO"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                Municipio
              </label>
              <input
                type="text"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-stone-50/50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                Notas adicionales (opcional)
              </label>
              <textarea
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value.toUpperCase())}
                placeholder="Observaciones sobre el fierro o el productor"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-stone-50/50 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-stone-100 border-t border-stone-200 flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>Emitir Pase Pre-Certificado</span>
          </button>
        </div>
      </div>
    </div>
  );
};