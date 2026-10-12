import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  DollarSign,
  Calendar,
  Tag,
  Palette,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Check,
} from 'lucide-react';
import { ConceptoFinanciero, CategoriaConceptoFinanciero } from '../../types';
import { createFinanceConcept, updateFinanceConcept } from '../../services/financeCatalogService';

interface ModalEditarConceptoProps {
  isOpen: boolean;
  onClose: () => void;
  concepto: ConceptoFinanciero | null;
  userId: string;
  userName?: string;
  onSaved: (savedConcept: ConceptoFinanciero) => void;
}

const CATEGORIAS: { id: CategoriaConceptoFinanciero; label: string; color: string }[] = [
  { id: 'tramite', label: 'Trámite Oficial', color: 'bg-amber-100 text-amber-800' },
  { id: 'constancia', label: 'Constancia Ganadera', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'multa', label: 'Multa / Recargo', color: 'bg-rose-100 text-rose-800' },
  { id: 'reposicion', label: 'Reposición de Patente', color: 'bg-violet-100 text-violet-800' },
  { id: 'otro', label: 'Otro Servicio', color: 'bg-stone-100 text-stone-800' },
];

const COLORES_PRESET = [
  '#D97706', // amber-600
  '#2563EB', // blue-600
  '#059669', // emerald-600
  '#E11D48', // rose-600
  '#7C3AED', // violet-600
  '#DC2626', // red-600
  '#0D9488', // teal-600
  '#4B5563', // gray-600
];

const ICONOS_PRESET = [
  { id: 'hammer', label: 'Martillo / Forja' },
  { id: 'refresh', label: 'Refrendo / Actualizar' },
  { id: 'description', label: 'Documento / Constancia' },
  { id: 'receipt', label: 'Recibo / Pago' },
  { id: 'cancel', label: 'Baja / Cancelar' },
  { id: 'warning', label: 'Alerta / Multa' },
];

export const ModalEditarConcepto: React.FC<ModalEditarConceptoProps> = ({
  isOpen,
  onClose,
  concepto,
  userId,
  userName = 'Administrador',
  onSaved,
}) => {
  const isEditing = Boolean(concepto);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState<CategoriaConceptoFinanciero>('tramite');
  const [precioBase, setPrecioBase] = useState<string>('450');
  const [ivaAplicable, setIvaAplicable] = useState(true);
  const [ivaPorcentaje, setIvaPorcentaje] = useState<string>('16');
  const [vigenciaDesde, setVigenciaDesde] = useState('2026-01-01');
  const [vigenciaHasta, setVigenciaHasta] = useState<string>('');
  const [activo, setActivo] = useState(true);
  const [color, setColor] = useState('#D97706');
  const [icono, setIcono] = useState('hammer');
  const [ordenVisual, setOrdenVisual] = useState<number>(1);
  const [motivoCambio, setMotivoCambio] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (concepto) {
      setCodigo(concepto.codigo);
      setNombre(concepto.nombre);
      setDescripcion(concepto.descripcion || '');
      setCategoria(concepto.categoria || 'tramite');
      setPrecioBase(concepto.precioBase.toString());
      setIvaAplicable(concepto.ivaAplicable);
      setIvaPorcentaje((concepto.ivaPorcentaje ?? 16).toString());
      setVigenciaDesde(concepto.vigenciaDesde ? concepto.vigenciaDesde.split('T')[0] : '2026-01-01');
      setVigenciaHasta(concepto.vigenciaHasta ? concepto.vigenciaHasta.split('T')[0] : '');
      setActivo(concepto.activo);
      setColor(concepto.color || '#D97706');
      setIcono(concepto.icono || 'receipt');
      setOrdenVisual(concepto.ordenVisual || 1);
      setMotivoCambio('');
    } else {
      setCodigo('');
      setNombre('');
      setDescripcion('');
      setCategoria('tramite');
      setPrecioBase('450');
      setIvaAplicable(true);
      setIvaPorcentaje('16');
      setVigenciaDesde(new Date().toISOString().split('T')[0]);
      setVigenciaHasta('');
      setActivo(true);
      setColor('#D97706');
      setIcono('hammer');
      setOrdenVisual(1);
      setMotivoCambio('');
    }
    setErrorMsg(null);
  }, [concepto, isOpen]);

  if (!isOpen) return null;

  // Cálculos reactivos de IVA y Precio Total
  const numericPrecio = parseFloat(precioBase) || 0;
  const numericIvaPct = parseFloat(ivaPorcentaje) || 0;
  const ivaMonto = ivaAplicable ? numericPrecio * (numericIvaPct / 100) : 0;
  const precioConIva = numericPrecio + ivaMonto;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!codigo.trim()) {
      setErrorMsg('El código del concepto es obligatorio (ej: ALTA-FQ).');
      return;
    }
    if (!nombre.trim()) {
      setErrorMsg('El nombre del concepto es obligatorio.');
      return;
    }
    if (numericPrecio <= 0) {
      setErrorMsg('El precio base debe ser mayor a $0.00 MXN.');
      return;
    }
    if (isEditing && concepto && concepto.precioBase !== numericPrecio && !motivoCambio.trim()) {
      setErrorMsg('Debe especificar el motivo del cambio de precio para el registro de auditoría.');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && concepto) {
        const updated = await updateFinanceConcept(
          concepto.id,
          {
            codigo: codigo.trim().toUpperCase(),
            nombre: nombre.trim(),
            descripcion: descripcion.trim(),
            categoria,
            precioBase: numericPrecio,
            ivaAplicable,
            ivaPorcentaje: numericIvaPct,
            vigenciaDesde,
            vigenciaHasta: vigenciaHasta.trim() || null,
            activo,
            color,
            icono,
            ordenVisual: Number(ordenVisual) || 1,
          },
          userId,
          userName,
          motivoCambio.trim() || 'Actualización de parámetros del catálogo'
        );
        onSaved(updated);
      } else {
        const created = await createFinanceConcept(
          {
            codigo: codigo.trim().toUpperCase(),
            nombre: nombre.trim(),
            descripcion: descripcion.trim(),
            categoria,
            precioBase: numericPrecio,
            moneda: 'MXN',
            ivaAplicable,
            ivaPorcentaje: numericIvaPct,
            vigenciaDesde,
            vigenciaHasta: vigenciaHasta.trim() || null,
            activo,
            ordenVisual: Number(ordenVisual) || 1,
            color,
            icono,
            requiereAutorizacion: false,
          },
          userId,
          userName
        );
        onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar el concepto financiero.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full border-2 border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
              style={{ backgroundColor: color }}
            >
              <DollarSign size={20} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 block">
                Catálogo de Servicios · Tesorería Pánuco
              </span>
              <h3 className="text-lg font-black font-cinzel text-white">
                {isEditing ? `Editar Concepto: ${concepto?.codigo}` : 'Nuevo Concepto de Servicio'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Código y Nombre */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                Código / Clave *
              </label>
              <input
                type="text"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ej. ALTA-FQ"
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono uppercase font-bold focus:ring-2 focus:ring-amber-500 bg-stone-50 focus:bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                Nombre del Servicio o Derecho *
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value.toUpperCase())}
                placeholder="Ej. Alta de Fierro Quemador"
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold focus:ring-2 focus:ring-amber-500 bg-stone-50 focus:bg-white"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
              Descripción Oficial del Trámite
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
              placeholder="Detalle del servicio que figurará en el comprobante municipal..."
              className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-stone-50 focus:bg-white"
            />
          </div>

          {/* Categoría y Orden Visual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                Categoría *
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaConceptoFinanciero)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-semibold bg-stone-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
              >
                {CATEGORIAS.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                Orden de Despliegue en Listas
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={ordenVisual}
                onChange={(e) => setOrdenVisual(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold bg-stone-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Precios e IVA */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <DollarSign size={14} className="text-amber-700" />
              <span>Estructura Tarifaria e Impuestos</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1">
                  Precio Base (Sin IVA) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-stone-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={precioBase}
                    onChange={(e) => setPrecioBase(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold text-sm text-stone-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={ivaAplicable}
                    onChange={(e) => setIvaAplicable(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-stone-800">Aplica IVA</span>
                </label>
              </div>

              {ivaAplicable && (
                <div>
                  <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1">
                    Tasa IVA (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={ivaPorcentaje}
                      onChange={(e) => setIvaPorcentaje(e.target.value)}
                      className="w-full pr-7 pl-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold text-stone-900 focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-2 text-stone-400 font-bold">%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Resumen Calculado */}
            <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs font-mono">
              <span className="text-stone-600 font-sans font-medium">
                Precio al Contribuyente (Total a Cobrar):
              </span>
              <div className="text-right">
                <span className="text-lg font-black text-amber-900 block font-mono">
                  ${precioConIva.toFixed(2)} MXN
                </span>
                {ivaAplicable && (
                  <span className="text-[10px] text-stone-500 font-sans block">
                    (Base: ${numericPrecio.toFixed(2)} + IVA: ${ivaMonto.toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Vigencia del Precio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                Vigencia Desde *
              </label>
              <input
                type="date"
                required
                value={vigenciaDesde}
                onChange={(e) => setVigenciaDesde(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono bg-stone-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                Vigencia Hasta (Opcional)
              </label>
              <input
                type="date"
                value={vigenciaHasta}
                onChange={(e) => setVigenciaHasta(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono bg-stone-50 focus:bg-white"
              />
            </div>
          </div>

          {/* Color e Icono */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                Color Distintivo
              </label>
              <div className="flex items-center gap-2">
                {COLORES_PRESET.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                      color === c ? 'scale-125 ring-2 ring-stone-900' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                Ícono
              </label>
              <select
                value={icono}
                onChange={(e) => setIcono(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-stone-50 focus:bg-white"
              >
                {ICONOS_PRESET.map((ic) => (
                  <option key={ic.id} value={ic.id}>
                    {ic.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Activo Checkbox */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="font-bold text-stone-900 block">Estatus del Concepto</span>
              <span className="text-[10px] text-stone-500">
                Los conceptos inactivos no se muestran en el selector de órdenes de cobro.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
            </label>
          </div>

          {/* Motivo de cambio si es edición */}
          {isEditing && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
              <label className="block text-[11px] font-bold text-amber-950 uppercase">
                Motivo del Cambio / Justificación (Auditoría Municipal) *
              </label>
              <input
                type="text"
                value={motivoCambio}
                onChange={(e) => setMotivoCambio(e.target.value.toUpperCase())}
                placeholder="Ej. Actualización por decreto de Cabildo 2026..."
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs"
              />
              <span className="text-[10px] text-amber-800">
                Este motivo se guardará permanentemente en el historial de precios y bitácora de auditoría.
              </span>
            </div>
          )}

          {/* Botones de acción */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Save size={15} />
              <span>{isSaving ? 'Guardando...' : 'Guardar Concepto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
