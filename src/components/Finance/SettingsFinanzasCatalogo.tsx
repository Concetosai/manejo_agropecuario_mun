import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Tag,
  Settings,
  BarChart3,
  Edit,
  History,
  Power,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Check,
  ShieldCheck,
  Receipt,
  RotateCcw,
  Hammer,
  RefreshCw,
  FileText,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  ConceptoFinanciero,
  CategoriaConceptoFinanciero,
  ConfigFinanzas,
  MunicipalUser,
  PaymentOrder,
} from '../../types';
import {
  getFinanceConcepts,
  toggleFinanceConceptActive,
  softDeleteFinanceConcept,
  getFinanceGeneralConfig,
  saveFinanceGeneralConfig,
  computeIncomeByConcept,
  computeIncomeByPeriod,
  ConceptIncomeStat,
  PeriodIncomeStat,
} from '../../services/financeCatalogService';
import { getPaymentOrders } from '../../services/financeFirestore';
import { ModalEditarConcepto } from './ModalEditarConcepto';
import { ModalHistorialPrecios } from './ModalHistorialPrecios';

interface SettingsFinanzasCatalogoProps {
  currentUser: MunicipalUser;
  onNotice?: (msg: string) => void;
}

export const SettingsFinanzasCatalogo: React.FC<SettingsFinanzasCatalogoProps> = ({
  currentUser,
  onNotice,
}) => {
  const [activeTab, setActiveTab] = useState<'catalogo' | 'config' | 'reportes'>('catalogo');
  const [conceptos, setConceptos] = useState<ConceptoFinanciero[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [soloActivos, setSoloActivos] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedConceptoForEdit, setSelectedConceptoForEdit] = useState<ConceptoFinanciero | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedConceptoForHistory, setSelectedConceptoForHistory] = useState<ConceptoFinanciero | null>(null);

  // General Config Form State
  const [config, setConfig] = useState<ConfigFinanzas>(() => getFinanceGeneralConfig());
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // Reports data
  const [orders, setOrders] = useState<PaymentOrder[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await getFinanceConcepts();
      setConceptos(list);
      const ordersList = await getPaymentOrders();
      setOrders(ordersList);
    } catch (err) {
      console.warn('Error loading catalog data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered concepts
  const conceptosFiltrados = useMemo(() => {
    return conceptos.filter((c) => {
      const matchCat = filtroCategoria === 'todas' || c.categoria === filtroCategoria;
      const matchActivo = !soloActivos || c.activo;
      const q = busqueda.toLowerCase().trim();
      const matchBusqueda =
        !q ||
        c.nombre.toLowerCase().includes(q) ||
        c.codigo.toLowerCase().includes(q) ||
        (c.descripcion && c.descripcion.toLowerCase().includes(q));

      return matchCat && matchActivo && matchBusqueda;
    });
  }, [conceptos, filtroCategoria, soloActivos, busqueda]);

  // Handle Save Concept
  const handleConceptSaved = (saved: ConceptoFinanciero) => {
    setConceptos((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    if (onNotice) {
      onNotice(`Concepto [${saved.codigo}] guardado exitosamente.`);
    }
  };

  // Handle Toggle Active
  const handleToggleActive = async (c: ConceptoFinanciero) => {
    const nuevoEstado = !c.activo;
    const motivo = nuevoEstado ? 'Reactivación de concepto en catálogo' : 'Pausa de concepto en catálogo';
    await toggleFinanceConceptActive(c.id, nuevoEstado, currentUser.id, currentUser.fullName, motivo);
    setConceptos((prev) => prev.map((item) => (item.id === c.id ? { ...item, activo: nuevoEstado } : item)));
    if (onNotice) {
      onNotice(`Concepto [${c.codigo}] ${nuevoEstado ? 'activado' : 'desactivado'} con éxito.`);
    }
  };

  // Handle Soft Delete
  const handleDeleteConcept = async (c: ConceptoFinanciero) => {
    if (confirm(`¿Está seguro de retirar el concepto [${c.codigo}] "${c.nombre}" del catálogo municipal?`)) {
      await softDeleteFinanceConcept(c.id, currentUser.id, currentUser.fullName, 'Retiro administrativo de catálogo');
      setConceptos((prev) => prev.map((item) => (item.id === c.id ? { ...item, activo: false } : item)));
      if (onNotice) {
        onNotice(`Concepto [${c.codigo}] retirado del catálogo.`);
      }
    }
  };

  // Handle Save General Config
  const handleSaveGeneralConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const updated = saveFinanceGeneralConfig(config, currentUser.id);
      setConfig(updated);
      setConfigSuccess('Configuración general de finanzas actualizada correctamente.');
      setTimeout(() => setConfigSuccess(null), 4000);
      if (onNotice) onNotice('Configuración de tesorería guardada.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Reports Computations
  const incomeByConcept = useMemo(() => computeIncomeByConcept(orders), [orders]);
  const incomeByPeriod = useMemo(() => computeIncomeByPeriod(orders), [orders]);
  const totalRecaudadoGlobal = useMemo(
    () => incomeByConcept.reduce((acc, curr) => acc + curr.totalRecaudado, 0),
    [incomeByConcept]
  );

  return (
    <div className="bg-white border-2 border-stone-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-900/20">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                Tesorería Municipal · Ley de Ingresos 2026
              </span>
              <span className="text-stone-400 text-xs">Pánuco, Ver.</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-cinzel text-stone-900 mt-0.5">
              Catálogo de Servicios y Parámetros Tarifarios
            </h2>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-2xl border border-stone-200 text-xs font-bold overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('catalogo')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'catalogo'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
            }`}
          >
            <Tag size={14} />
            <span>Catálogo de Servicios ({conceptos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'config'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
            }`}
          >
            <Settings size={14} />
            <span>Configuración General</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reportes')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'reportes'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
            }`}
          >
            <BarChart3 size={14} />
            <span>Reportes de Ingresos</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: CATÁLOGO DE SERVICIOS Y PRECIOS (CRUD)
         ========================================================================= */}
      {activeTab === 'catalogo' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Top Actions & Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Buscador */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={15} className="absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                  placeholder="Buscar por código, nombre o concepto..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-medium"
                />
                {busqueda && (
                  <button
                    onClick={() => setBusqueda('')}
                    className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Categoría Selector */}
              <div className="flex items-center gap-1.5">
                <Filter size={14} className="text-stone-500" />
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="px-3 py-2 bg-white border border-stone-300 rounded-xl font-semibold text-stone-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="todas">Todas las categorías</option>
                  <option value="tramite">Trámites Oficiales</option>
                  <option value="constancia">Constancias</option>
                  <option value="multa">Multas y Recargos</option>
                  <option value="reposicion">Reposiciones</option>
                  <option value="otro">Otros Servicios</option>
                </select>
              </div>

              {/* Solo Activos Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none px-2 py-1 bg-white border border-stone-200 rounded-xl">
                <input
                  type="checkbox"
                  checked={soloActivos}
                  onChange={(e) => setSoloActivos(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="font-bold text-stone-700">Solo activos y vigentes</span>
              </label>
            </div>

            {/* Botón Nuevo Concepto */}
            <button
              type="button"
              onClick={() => {
                setSelectedConceptoForEdit(null);
                setIsEditModalOpen(true);
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
            >
              <Plus size={16} />
              <span>Nuevo Concepto</span>
            </button>
          </div>

          {/* Concepts Grid / List */}
          {conceptosFiltrados.length === 0 ? (
            <div className="p-12 text-center text-stone-500 border-2 border-dashed border-stone-200 rounded-3xl space-y-2">
              <Tag size={36} className="mx-auto text-stone-400 opacity-60" />
              <p className="font-bold text-sm text-stone-700">No se encontraron conceptos</p>
              <p className="text-xs text-stone-500">
                Ajuste los filtros de búsqueda o registre un nuevo concepto con el botón superior.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {conceptosFiltrados.map((c) => {
                const isOutOfRange =
                  c.vigenciaHasta && new Date(c.vigenciaHasta) < new Date();

                return (
                  <div
                    key={c.id}
                    className={`bg-white rounded-2xl p-5 border transition-all shadow-xs hover:shadow-md flex flex-col justify-between relative overflow-hidden ${
                      !c.activo
                        ? 'border-stone-200 bg-stone-50/60 opacity-60'
                        : 'border-stone-200 hover:border-amber-400'
                    }`}
                  >
                    {/* Top color bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: c.color || '#D97706' }}
                    />

                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0 shadow-xs"
                            style={{ backgroundColor: c.color || '#D97706' }}
                          >
                            <DollarSign size={20} />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-md text-white shadow-2xs"
                                style={{ backgroundColor: c.color || '#D97706' }}
                              >
                                {c.codigo}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                                {c.categoria}
                              </span>
                              {!c.activo && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                  Inactivo
                                </span>
                              )}
                              {isOutOfRange && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  Vigencia vencida
                                </span>
                              )}
                            </div>

                            <h3 className="font-extrabold text-stone-900 text-sm mt-1 leading-snug">
                              {c.nombre}
                            </h3>
                          </div>
                        </div>

                        {/* Precios */}
                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-lg text-stone-900 block">
                            ${c.precioBase.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-stone-500 font-mono block">
                            {c.ivaAplicable
                              ? `+ IVA (${c.ivaPorcentaje}%) = $${c.precioConIva.toFixed(2)}`
                              : 'IVA no aplica'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                        {c.descripcion || 'Sin descripción adicional registrada.'}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-stone-500 pt-2 border-t border-stone-100">
                        <div className="flex items-center gap-1 font-mono">
                          <Calendar size={12} className="text-stone-400" />
                          <span>
                            Vigencia: {c.vigenciaDesde} {c.vigenciaHasta ? `al ${c.vigenciaHasta}` : '(Indefinida)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-100 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedConceptoForHistory(c);
                          setIsHistoryModalOpen(true);
                        }}
                        className="text-stone-500 hover:text-stone-900 font-bold flex items-center gap-1 cursor-pointer"
                        title="Ver historial de cambios de precio"
                      >
                        <History size={13} className="text-amber-600" />
                        <span>Historial Precios</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(c)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            c.activo
                              ? 'text-stone-500 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={c.activo ? 'Desactivar concepto' : 'Reactivar concepto'}
                        >
                          <Power size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedConceptoForEdit(c);
                            setIsEditModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit size={12} />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteConcept(c)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar del catálogo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: CONFIGURACIÓN GENERAL DE FINANZAS
         ========================================================================= */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveGeneralConfig} className="space-y-5 animate-fadeIn max-w-2xl text-xs">
          {configSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
              <span>{configSuccess}</span>
            </div>
          )}

          <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-4">
            <h3 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
              <Settings size={16} className="text-amber-600" />
              <span>Parámetros de Facturación y Folios Oficiales</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Prefijo de Folio de Órdenes
                </label>
                <input
                  type="text"
                  value={config.prefijoOrden}
                  onChange={(e) => setConfig({ ...config, prefijoOrden: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Consecutivo Actual de Orden
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.consecutivoOrdenActual}
                  onChange={(e) =>
                    setConfig({ ...config, consecutivoOrdenActual: parseInt(e.target.value, 10) || 1 })
                  }
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Tasa de IVA General Predeterminada (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.ivaGeneral}
                  onChange={(e) =>
                    setConfig({ ...config, ivaGeneral: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Periodo Fiscal Activo
                </label>
                <input
                  type="text"
                  value={config.periodoActual}
                  onChange={(e) => setConfig({ ...config, periodoActual: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.permitirSobrescrituraPrecio}
                  onChange={(e) =>
                    setConfig({ ...config, permitirSobrescrituraPrecio: e.target.checked })
                  }
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-stone-900 block">
                    Permitir Sobrescritura Manual de Precios en Ventanilla
                  </span>
                  <span className="text-[10px] text-stone-500">
                    Permite a los operadores autorizados ajustar montos por exenciones o resoluciones de Cabildo.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.requiereMotivoSobrescritura}
                  onChange={(e) =>
                    setConfig({ ...config, requiereMotivoSobrescritura: e.target.checked })
                  }
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-stone-900 block">
                    Exigir Motivo Obligatorio al Sobrescribir Precio
                  </span>
                  <span className="text-[10px] text-stone-500">
                    Registra la justificación en la bitácora inmutable de auditoría para Contraloría.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingConfig}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              {isSavingConfig ? 'Guardando...' : 'Guardar Configuración General'}
            </button>
          </div>
        </form>
      )}

      {/* =========================================================================
          TAB 3: REPORTES DE INGRESOS Y RECAUDACIÓN MUNICIPAL
         ========================================================================= */}
      {activeTab === 'reportes' && (
        <div className="space-y-6 animate-fadeIn text-xs">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Total Recaudado</span>
              <span className="text-2xl font-black font-mono text-emerald-950 mt-1 block">
                ${totalRecaudadoGlobal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
              </span>
              <span className="text-[10px] text-emerald-700 mt-1 block">Órdenes con estatus PAGADO</span>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">Conceptos Cobrados</span>
              <span className="text-2xl font-black font-mono text-amber-950 mt-1 block">
                {incomeByConcept.length} Conceptos
              </span>
              <span className="text-[10px] text-amber-700 mt-1 block">Servicios demandados por ganaderos</span>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
              <span className="text-[10px] font-bold text-blue-800 uppercase block">Periodos Fiscales</span>
              <span className="text-2xl font-black font-mono text-blue-950 mt-1 block">
                {incomeByPeriod.length} Periodos
              </span>
              <span className="text-[10px] text-blue-700 mt-1 block">Trazabilidad contable municipal</span>
            </div>
          </div>

          {/* Table: Recaudación por Concepto */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-extrabold text-stone-900 text-sm flex items-center justify-between">
              <span>Recaudación por Concepto de Servicio:</span>
              <span className="text-[11px] font-normal text-stone-500">Ordenado por mayor monto</span>
            </h3>

            <div className="space-y-3">
              {incomeByConcept.map((item, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-stone-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                        {item.codigo}
                      </span>
                      <strong className="text-stone-900">{item.conceptoNombre}</strong>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-stone-900 text-sm">
                        ${item.totalRecaudado.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                      </span>
                      <span className="text-[10px] text-stone-500 ml-2">({item.porcentaje}%)</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(item.porcentaje, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Concepto */}
      <ModalEditarConcepto
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        concepto={selectedConceptoForEdit}
        userId={currentUser.id}
        userName={currentUser.fullName}
        onSaved={handleConceptSaved}
      />

      {/* Modal Historial de Precios */}
      <ModalHistorialPrecios
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        concepto={selectedConceptoForHistory}
      />
    </div>
  );
};
