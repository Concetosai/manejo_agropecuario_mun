import React, { useState, useMemo } from 'react';
import { MunicipalConfig, MunicipalUser, MunicipalSupportActivity, ActivityCategory } from '../types';
import { getMunicipalDatabase, PANUCO_EJIDOS } from '../utils/database';
import { getMunicipalActivities, saveMunicipalActivity, ACTIVITY_CATEGORIES_INFO } from '../utils/reportsData';
import { recordAuditLog } from '../utils/auditAuth';
import {
  BarChart3,
  Calendar,
  Printer,
  Download,
  PlusCircle,
  TrendingUp,
  Award,
  Users,
  CheckCircle2,
  Filter,
  FileSpreadsheet,
  X,
  ChevronRight,
  ShieldCheck,
  Check,
  Percent,
} from 'lucide-react';

interface TabReportesProps {
  municipalConfig: MunicipalConfig;
  currentUser: MunicipalUser;
}

type PeriodSelection = 'semestre_1' | 'semestre_2' | 'anual_2026' | 'mes_especifico';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const TabReportes: React.FC<TabReportesProps> = ({ municipalConfig, currentUser }) => {
  const [period, setPeriod] = useState<PeriodSelection>('semestre_1');
  const [selectedMonth, setSelectedMonth] = useState<number>(1); // 1 = Enero ... 12 = Diciembre
  const [selectedTenureFilter, setSelectedTenureFilter] = useState<string>('todos');
  const [selectedEjidoFilter, setSelectedEjidoFilter] = useState<string>('todos');
  const [activeSubTab, setActiveSubTab] = useState<'resumen' | 'graficas' | 'bitacora' | 'entrega_oficial'>('resumen');

  // Activities state (stored in localStorage)
  const [activities, setActivities] = useState<MunicipalSupportActivity[]>(() => getMunicipalActivities());

  // Modal State for New Support / Activity
  const [isNewActivityModalOpen, setIsNewActivityModalOpen] = useState(false);
  const [newActivityForm, setNewActivityForm] = useState<{
    date: string;
    category: ActivityCategory;
    title: string;
    description: string;
    ejido: string;
    beneficiariesCount: number;
    quantityOrMetric: string;
    estimatedCostOrSubsidio: number;
    status: 'Completado' | 'En Proceso' | 'Programado';
  }>({
    date: new Date().toISOString().split('T')[0],
    category: 'apoyo_forraje',
    title: '',
    description: '',
    ejido: 'Reventadero',
    beneficiariesCount: 25,
    quantityOrMetric: '500 Pacas de Heno',
    estimatedCostOrSubsidio: 35000,
    status: 'Completado',
  });

  // Get real municipal database records
  const allRecords = useMemo(() => getMunicipalDatabase(), []);

  // Filter municipal brand records based on selected period
  const filteredRecords = useMemo(() => {
    return allRecords.filter((rec) => {
      // Parse year and month from issueDate (YYYY-MM-DD)
      const dateParts = rec.issueDate ? rec.issueDate.split('-') : [];
      const year = parseInt(dateParts[0] || String(rec.year || 2026), 10);
      const month = parseInt(dateParts[1] || '1', 10);

      // Period filter
      if (period === 'semestre_1') {
        // Enero - Junio 2026 (or matching years)
        if (month > 6) return false;
      } else if (period === 'semestre_2') {
        // Julio - Diciembre 2026
        if (month < 7) return false;
      } else if (period === 'mes_especifico') {
        if (month !== selectedMonth) return false;
      }

      // Tenure filter
      if (selectedTenureFilter !== 'todos' && rec.tenureType !== selectedTenureFilter) {
        return false;
      }

      // Ejido filter
      if (selectedEjidoFilter !== 'todos' && rec.ejido !== selectedEjidoFilter) {
        return false;
      }

      return true;
    });
  }, [allRecords, period, selectedMonth, selectedTenureFilter, selectedEjidoFilter]);

  // Filter municipal support activities based on selected period
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const parts = act.date.split('-');
      const month = parseInt(parts[1] || '1', 10);

      if (period === 'semestre_1') {
        if (month > 6) return false;
      } else if (period === 'semestre_2') {
        if (month < 7) return false;
      } else if (period === 'mes_especifico') {
        if (month !== selectedMonth) return false;
      }

      if (selectedEjidoFilter !== 'todos' && act.ejido !== selectedEjidoFilter) {
        return false;
      }

      return true;
    });
  }, [activities, period, selectedMonth, selectedEjidoFilter]);

  // Executive aggregated figures
  const kpis = useMemo(() => {
    const totalRegistros = filteredRecords.length;
    const vigentes = filteredRecords.filter((r) => r.status === 'Vigente').length;
    const renovaciones = filteredRecords.filter((r) => r.status !== 'Vigente').length;
    const totalHectareas = filteredRecords.reduce((acc, r) => acc + (r.surfaceHectares || 0), 0);
    const totalCabezas = filteredRecords.reduce((acc, r) => acc + (r.cattleCount || 0), 0);

    const totalBeneficiariosApoyo = filteredActivities.reduce((acc, a) => acc + a.beneficiariesCount, 0);
    const totalInversionSubsidio = filteredActivities.reduce((acc, a) => acc + a.estimatedCostOrSubsidio, 0);

    const serviciosCount = filteredActivities.filter(
      (a) => ACTIVITY_CATEGORIES_INFO[a.category].group === 'servicio'
    ).length;
    const apoyosCount = filteredActivities.filter(
      (a) => ACTIVITY_CATEGORIES_INFO[a.category].group === 'apoyo'
    ).length;
    const sanidadCount = filteredActivities.filter(
      (a) => ACTIVITY_CATEGORIES_INFO[a.category].group === 'sanidad'
    ).length;

    return {
      totalRegistros,
      vigentes,
      renovaciones,
      totalHectareas: Math.round(totalHectareas),
      totalCabezas,
      totalBeneficiarios: totalRegistros + totalBeneficiariosApoyo,
      beneficiariosApoyo: totalBeneficiariosApoyo,
      totalInversionSubsidio,
      serviciosCount,
      apoyosCount,
      sanidadCount,
    };
  }, [filteredRecords, filteredActivities]);

  // Monthly breakdown for bar charts (Months 1 to 12)
  const monthlyChartData = useMemo(() => {
    const monthsData = Array.from({ length: 12 }, (_, i) => {
      const mNum = i + 1;
      const monthName = MONTH_NAMES[i];
      const recordsCount = allRecords.filter((r) => {
        const parts = r.issueDate ? r.issueDate.split('-') : [];
        const m = parseInt(parts[1] || '1', 10);
        return m === mNum;
      }).length;

      const actCount = activities.filter((a) => {
        const parts = a.date.split('-');
        const m = parseInt(parts[1] || '1', 10);
        return m === mNum;
      }).length;

      const totalSubsidio = activities
        .filter((a) => {
          const parts = a.date.split('-');
          return parseInt(parts[1] || '1', 10) === mNum;
        })
        .reduce((sum, a) => sum + a.estimatedCostOrSubsidio, 0);

      return {
        monthIndex: mNum,
        monthName,
        shortName: monthName.slice(0, 3),
        recordsCount,
        actCount,
        totalSubsidio,
      };
    });

    return monthsData;
  }, [allRecords, activities]);

  // Max value for bar chart height scaling
  const maxMonthlyRecords = useMemo(() => {
    const max = Math.max(...monthlyChartData.map((d) => d.recordsCount), 1);
    return max;
  }, [monthlyChartData]);

  // Support categories breakdown data
  const categoryBreakdown = useMemo(() => {
    const counts: Record<ActivityCategory, { count: number; investment: number; beneficiaries: number }> = {
      apoyo_forraje: { count: 0, investment: 0, beneficiaries: 0 },
      sanidad_vacunacion: { count: 0, investment: 0, beneficiaries: 0 },
      siniiga_aretes: { count: 0, investment: 0, beneficiaries: 0 },
      desazolve_presas: { count: 0, investment: 0, beneficiaries: 0 },
      mejoramiento_genetico: { count: 0, investment: 0, beneficiaries: 0 },
      infraestructura_cercado: { count: 0, investment: 0, beneficiaries: 0 },
      servicio_constancia: { count: 0, investment: 0, beneficiaries: 0 },
      servicio_inspeccion: { count: 0, investment: 0, beneficiaries: 0 },
      servicio_guia: { count: 0, investment: 0, beneficiaries: 0 },
    };

    filteredActivities.forEach((act) => {
      if (counts[act.category]) {
        counts[act.category].count += 1;
        counts[act.category].investment += act.estimatedCostOrSubsidio;
        counts[act.category].beneficiaries += act.beneficiariesCount;
      }
    });

    const totalInv = Object.values(counts).reduce((sum, c) => sum + c.investment, 0) || 1;

    return (Object.keys(counts) as ActivityCategory[]).map((catKey) => {
      const data = counts[catKey];
      const percent = Math.round((data.investment / totalInv) * 100);
      return {
        categoryKey: catKey,
        info: ACTIVITY_CATEGORIES_INFO[catKey],
        ...data,
        percent,
      };
    });
  }, [filteredActivities]);

  // Ejidos distribution ranking
  const ejidosRanking = useMemo(() => {
    const map: Record<string, { registros: number; apoyos: number; beneficiarios: number }> = {};

    PANUCO_EJIDOS.forEach((ej) => {
      map[ej] = { registros: 0, apoyos: 0, beneficiarios: 0 };
    });

    filteredRecords.forEach((r) => {
      if (!map[r.ejido]) map[r.ejido] = { registros: 0, apoyos: 0, beneficiarios: 0 };
      map[r.ejido].registros += 1;
      map[r.ejido].beneficiarios += 1;
    });

    filteredActivities.forEach((a) => {
      if (!map[a.ejido]) map[a.ejido] = { registros: 0, apoyos: 0, beneficiarios: 0 };
      map[a.ejido].apoyos += 1;
      map[a.ejido].beneficiarios += a.beneficiariesCount;
    });

    return Object.entries(map)
      .map(([ejido, data]) => ({
        ejido,
        totalIntervenciones: data.registros + data.apoyos,
        ...data,
      }))
      .sort((a, b) => b.totalIntervenciones - a.totalIntervenciones);
  }, [filteredRecords, filteredActivities]);

  // Print semestral delivery report
  const handlePrintDeliveryReport = () => {
    recordAuditLog({
      actionType: 'IMPRESION_DOCUMENTO',
      details: `Impresión del Informe Oficial de Entrega Semestral (${period}) a Cabildo y SEDARPA.`,
    });
    window.print();
  };

  // Export report to CSV
  const handleExportCSV = () => {
    const header = [
      'Folio',
      'Fecha',
      'Rubro/Categoría',
      'Título/Titular',
      'Ejido/Comunidad',
      'Beneficiarios',
      'Métrica/Unidades',
      'Inversión/Subsidio Estimado (MXN)',
      'Estatus'
    ];

    const rows = filteredActivities.map((act) => [
      `"${act.id}"`,
      `"${act.date}"`,
      `"${ACTIVITY_CATEGORIES_INFO[act.category].label}"`,
      `"${act.title.replace(/"/g, '""')}"`,
      `"${act.ejido}"`,
      act.beneficiariesCount,
      `"${act.quantityOrMetric}"`,
      act.estimatedCostOrSubsidio,
      `"${act.status}"`
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Semestral_Panuco_Veracruz_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    recordAuditLog({
      actionType: 'EXPORTACION_PADRON',
      details: `Exportación de archivo CSV de Reportes y Actividades (${period}).`,
    });
  };

  // Handle saving a new activity
  const handleSaveNewActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityForm.title.trim()) {
      alert('Por favor ingrese el título o descripción de la actividad pecuaria.');
      return;
    }

    const newAct: MunicipalSupportActivity = {
      id: `act-${Date.now().toString().slice(-6)}`,
      date: newActivityForm.date,
      category: newActivityForm.category,
      title: newActivityForm.title.trim(),
      description: newActivityForm.description.trim(),
      ejido: newActivityForm.ejido,
      beneficiariesCount: Number(newActivityForm.beneficiariesCount) || 1,
      quantityOrMetric: newActivityForm.quantityOrMetric.trim() || 'Servicio Otorgado',
      estimatedCostOrSubsidio: Number(newActivityForm.estimatedCostOrSubsidio) || 0,
      operator: currentUser.fullName,
      status: newActivityForm.status,
    };

    const updated = saveMunicipalActivity(newAct);
    setActivities(updated);
    setIsNewActivityModalOpen(false);

    recordAuditLog({
      actionType: 'REGISTRO_CREADO',
      details: `Nueva actividad de apoyo ganadero registrada: "${newAct.title}" en Ejido ${newAct.ejido}.`,
    });

    // Reset title
    setNewActivityForm((prev) => ({ ...prev, title: '', description: '' }));
  };

  const periodTitle = useMemo(() => {
    if (period === 'semestre_1') return '1er Semestre 2026 (Enero - Junio)';
    if (period === 'semestre_2') return '2do Semestre 2026 (Julio - Diciembre)';
    if (period === 'anual_2026') return 'Ejercicio Anual 2026 (Completo)';
    return `Mes de ${MONTH_NAMES[selectedMonth - 1]} 2026`;
  }, [period, selectedMonth]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Top Banner / Header (hidden on print) */}
      <div className="no-print bg-white border border-stone-200 rounded-xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Dirección de Fomento Agropecuario y Desarrollo Rural
            </span>
            <span className="text-stone-300">·</span>
            <span className="text-xs text-stone-500">Pánuco, Veracruz</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-cinzel font-bold text-stone-900 mt-1">
            Reportes Mensuales y Entrega Semestral de Actividades
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
            Concentrado ejecutivo de trámites de fierro quemador, programas de apoyo a productores, campañas sanitarias y servicios ganaderos para rendición de cuentas al H. Cabildo y SEDARPA.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsNewActivityModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Apoyo / Servicio</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-stone-600" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintDeliveryReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Imprimir Hoja de Entrega</span>
          </button>
        </div>
      </div>

      {/* Period Selector and Filter Strip (hidden on print) */}
      <div className="no-print bg-stone-900 text-stone-100 rounded-xl p-3.5 sm:p-4 shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left: Period Segmented Controls */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Periodo:
          </span>
          <button
            type="button"
            onClick={() => setPeriod('semestre_1')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              period === 'semestre_1'
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            1er Semestre (Ene - Jun)
          </button>

          <button
            type="button"
            onClick={() => setPeriod('semestre_2')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              period === 'semestre_2'
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            2do Semestre (Jul - Dic)
          </button>

          <button
            type="button"
            onClick={() => setPeriod('anual_2026')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              period === 'anual_2026'
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            Ejercicio Anual 2026
          </button>

          <button
            type="button"
            onClick={() => setPeriod('mes_especifico')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              period === 'mes_especifico'
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            Por Mes Específico
          </button>
        </div>

        {/* Month Dropdown if "mes_especifico" */}
        {period === 'mes_especifico' && (
          <div className="flex items-center gap-2 bg-stone-800 px-3 py-1.5 rounded-lg border border-stone-700">
            <span className="text-xs text-stone-300 font-medium">Mes:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-stone-900 text-amber-400 font-bold text-xs border border-stone-700 rounded px-2 py-1 cursor-pointer focus:ring-1 focus:ring-amber-500"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m} 2026
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Right: Sub-Filters (Tenure & Ejido) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-400">Tenencia:</span>
            <select
              value={selectedTenureFilter}
              onChange={(e) => setSelectedTenureFilter(e.target.value)}
              className="bg-stone-800 text-stone-200 border border-stone-700 rounded px-2 py-1 text-xs cursor-pointer"
            >
              <option value="todos">Todas las Tenencias</option>
              <option value="EJIDAL">EJIDAL</option>
              <option value="PROPIEDAD">PROPIEDAD</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-stone-400">Ejido:</span>
            <select
              value={selectedEjidoFilter}
              onChange={(e) => setSelectedEjidoFilter(e.target.value)}
              className="bg-stone-800 text-stone-200 border border-stone-700 rounded px-2 py-1 text-xs cursor-pointer max-w-[140px] truncate"
            >
              <option value="todos">Todos los Ejidos ({PANUCO_EJIDOS.length})</option>
              {PANUCO_EJIDOS.map((ej) => (
                <option key={ej} value={ej}>
                  {ej}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Internal Navigation Sub-tabs (hidden on print) */}
      <div className="no-print border-b border-stone-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveSubTab('resumen')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'resumen'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-500 hover:text-stone-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Resumen y Métricas Semestrales</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('graficas')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'graficas'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-500 hover:text-stone-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Gráficas de Apoyo y Servicio Ganadero</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('bitacora')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'bitacora'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-500 hover:text-stone-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Bitácora Detallada de Actividades ({filteredActivities.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('entrega_oficial')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'entrega_oficial'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-500 hover:text-stone-900'
          }`}
        >
          <Award className="w-4 h-4 text-emerald-700" />
          <span className="text-emerald-950 font-bold">Hoja Oficial de Entrega Semestral (Imprimible)</span>
        </button>
      </div>

      {/* =========================================================================
          VIEW 1: RESUMEN Y MÉTRICAS SEMESTRALES (Scorecards & Progress)
         ========================================================================= */}
      {activeSubTab === 'resumen' && (
        <div className="space-y-6">
          {/* Active Period Pill Info */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-200 text-amber-950 rounded-lg">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                  Informe de Rendición de Cuentas Pecuaria
                </span>
                <span className="text-sm font-cinzel font-bold text-stone-900">
                  {periodTitle} · {filteredRecords.length} Asientos Registrales Analizados
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-stone-600">
              <span>Jurisdicción: <strong>Pánuco, Ver.</strong></span>
              <span>·</span>
              <span>Operador en Turno: <strong>{currentUser.fullName}</strong></span>
            </div>
          </div>

          {/* 5 High-Level KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Card 1: Registros de Fierro */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
                <span>Registros de Fierro</span>
                <Award className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono-data text-stone-900 tabular-nums">
                {kpis.totalRegistros.toLocaleString()}
              </div>
              <div className="mt-2 text-[11px] text-stone-500 flex items-center justify-between border-t border-stone-100 pt-1.5">
                <span className="text-emerald-700 font-semibold">{kpis.vigentes} Vigentes</span>
                <span className="text-stone-400">·</span>
                <span>{kpis.renovaciones} Renovación</span>
              </div>
            </div>

            {/* Card 2: Beneficiarios */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
                <span>Productores Atendidos</span>
                <Users className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono-data text-stone-900 tabular-nums">
                {kpis.totalBeneficiarios.toLocaleString()}
              </div>
              <div className="mt-2 text-[11px] text-stone-500 flex items-center justify-between border-t border-stone-100 pt-1.5">
                <span>{kpis.totalRegistros} en Padrón</span>
                <span className="text-stone-400">·</span>
                <span className="text-sky-700 font-semibold">{kpis.beneficiariosApoyo} en Apoyos</span>
              </div>
            </div>

            {/* Card 3: Inversión en Subsidios Pecuarios */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
                <span>Subsidio en Apoyos</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono-data text-emerald-800 tabular-nums truncate">
                ${(kpis.totalInversionSubsidio / 1000).toFixed(1)}k
              </div>
              <div className="mt-2 text-[11px] text-stone-500 border-t border-stone-100 pt-1.5 truncate">
                Total: ${kpis.totalInversionSubsidio.toLocaleString()} MXN
              </div>
            </div>

            {/* Card 4: Hectáreas Amparadas */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
                <span>Superficie Registrada</span>
                <span className="text-[10px] font-mono-data bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">Has</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono-data text-stone-900 tabular-nums">
                {kpis.totalHectareas.toLocaleString()}
              </div>
              <div className="mt-2 text-[11px] text-stone-500 border-t border-stone-100 pt-1.5 truncate">
                Pastizales y agostaderos
              </div>
            </div>

            {/* Card 5: Hato Bovino Amparado */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
                <span>Cabezas de Ganado</span>
                <span className="text-[10px] font-mono-data bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">U.A.</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono-data text-stone-900 tabular-nums">
                {kpis.totalCabezas.toLocaleString()}
              </div>
              <div className="mt-2 text-[11px] text-stone-500 border-t border-stone-100 pt-1.5 truncate">
                Bajo fierro quemador legal
              </div>
            </div>
          </div>

          {/* Quick Snapshot: Programs & Municipal Interventions Highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Distribution by Support Type */}
            <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div>
                  <h3 className="text-base font-cinzel font-bold text-stone-900">
                    Desglose de Apoyos Directos al Productor ({periodTitle})
                  </h3>
                  <p className="text-xs text-stone-500">
                    Inversión municipal asignada para combatir estiaje, sanidad pecuaria y mejoramiento genético.
                  </p>
                </div>
                <span className="text-xs font-mono-data text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                  {filteredActivities.length} Programas Activos
                </span>
              </div>

              <div className="space-y-3">
                {categoryBreakdown
                  .filter((c) => c.count > 0 || c.investment > 0)
                  .map((item) => (
                    <div key={item.categoryKey} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.info.color }}
                          />
                          <span className="font-semibold text-stone-800">{item.info.label}</span>
                          <span className="text-[10px] text-stone-400">
                            ({item.count} evento{item.count !== 1 ? 's' : ''} · {item.beneficiaries} ganaderos)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono-data">
                          <span className="font-bold text-stone-900">${item.investment.toLocaleString()} MXN</span>
                          <span className="text-[10px] text-stone-400 w-8 text-right font-medium">{item.percent}%</span>
                        </div>
                      </div>
                      {/* Bar progress */}
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(item.percent, 3)}%`,
                            backgroundColor: item.info.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Right 1 Col: Metas de Cumplimiento Semestral vs Programación */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 sm:p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-amber-700" />
                  <h3 className="text-base font-cinzel font-bold text-stone-900">
                    Avance de Metas Pecuarias
                  </h3>
                </div>
                <p className="text-xs text-stone-600 mb-4">
                  Porcentaje de cumplimiento con respecto al Plan Municipal de Desarrollo Rural 2025-2029:
                </p>

                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-stone-700 font-medium">Refrendo y Asiento de Fierros</span>
                      <span className="font-bold font-mono-data text-emerald-800">96% Cumplido</span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full w-[96%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-stone-700 font-medium">Subsidio de Forrajes en Estiaje</span>
                      <span className="font-bold font-mono-data text-amber-800">88% Cumplido</span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full w-[88%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-stone-700 font-medium">Campañas de Sanidad y Rabia</span>
                      <span className="font-bold font-mono-data text-sky-800">92% Cumplido</span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-600 rounded-full w-[92%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-stone-700 font-medium">Desazolve de Presas Ejidales</span>
                      <span className="font-bold font-mono-data text-purple-800">82% Cumplido</span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 rounded-full w-[82%]" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-stone-200 text-center">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('entrega_oficial')}
                  className="w-full py-2 px-3 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Ver Formato Oficial de Entrega</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: GRÁFICAS DE APOYO Y SERVICIO GANADERO (Charts & Histograms)
         ========================================================================= */}
      {activeSubTab === 'graficas' && (
        <div className="space-y-6">
          {/* Chart Section 1: Flujo Mensual de Registros y Apoyos */}
          <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-4 mb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
                  Histograma de Producción Mensual
                </span>
                <h3 className="text-lg font-cinzel font-bold text-stone-900">
                  Evolución Mes a Mes de Asientos Registrales y Actividades
                </h3>
                <p className="text-xs text-stone-500">
                  Comparativa de altas y refrendos de fierro quemador otorgados a lo largo del ejercicio 2026.
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-amber-600 rounded-xs" />
                  <span className="text-stone-700">Registros de Fierro</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-600 rounded-xs" />
                  <span className="text-stone-700">Jornadas de Apoyo / Sanidad</span>
                </div>
              </div>
            </div>

            {/* Responsive Bar Chart Canvas */}
            <div className="w-full overflow-x-auto pb-2">
              <div className="min-w-[680px] h-64 flex items-end justify-between gap-3 pt-6 px-2 border-b border-stone-300">
                {monthlyChartData.map((d) => {
                  const recordHeightPercent = Math.max(Math.round((d.recordsCount / maxMonthlyRecords) * 85), 6);
                  const isCurrentSelection = period === 'mes_especifico' && selectedMonth === d.monthIndex;

                  return (
                    <div
                      key={d.monthIndex}
                      onClick={() => {
                        setPeriod('mes_especifico');
                        setSelectedMonth(d.monthIndex);
                      }}
                      className={`flex-1 flex flex-col items-center justify-end h-full group cursor-pointer p-1 rounded-t transition-all ${
                        isCurrentSelection ? 'bg-amber-100/60 ring-2 ring-amber-500' : 'hover:bg-stone-50'
                      }`}
                    >
                      {/* Metric tooltip floating above */}
                      <span className="text-[10px] font-mono-data font-bold text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity mb-1 whitespace-nowrap">
                        {d.recordsCount} reg.
                      </span>

                      {/* Stacked / Twin Bars */}
                      <div className="w-full flex items-end justify-center gap-1">
                        {/* Records Bar */}
                        <div
                          style={{ height: `${recordHeightPercent}%` }}
                          className={`w-1/2 rounded-t transition-all duration-300 ${
                            isCurrentSelection ? 'bg-amber-600' : 'bg-amber-500 group-hover:bg-amber-600'
                          }`}
                        />
                        {/* Activities Bar */}
                        <div
                          style={{ height: `${Math.min(d.actCount * 28 + 10, 85)}%` }}
                          className="w-1/2 bg-emerald-600 rounded-t group-hover:bg-emerald-700 transition-all duration-300"
                        />
                      </div>

                      {/* Month label at bottom */}
                      <span className="text-xs font-semibold text-stone-700 mt-2 font-mono-data">
                        {d.shortName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-[11px] text-stone-500 mt-2 text-center">
              Haga clic sobre cualquier mes para enfocar el desglose de registros y servicios en ese período específico.
            </div>
          </div>

          {/* 2-Column Grid: Services vs Ejidos Coverage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Servicios Ganaderos Municipales Brindados */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="border-b border-stone-200 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
                  Trámites y Ventanilla Ganadera
                </span>
                <h3 className="text-base font-cinzel font-bold text-stone-900">
                  Servicios Pecuarios Otorgados
                </h3>
                <p className="text-xs text-stone-500">
                  Volumen de atenciones técnicas, guías REEMO y validación de corrales.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-900 rounded-lg">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">
                        Constancias de Productor Pecuario
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Cotejo para programas de apoyo y créditos ganaderos
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono-data text-blue-900 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                    {allRecords.length} emitidas
                  </span>
                </div>

                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-900 rounded-lg">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">
                        Inspecciones de Herrado y Dictámenes
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Verificación de marca en corrales y peritajes de no-duplicidad
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono-data text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                    245 visitas
                  </span>
                </div>

                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-900 rounded-lg">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">
                        Guías de Tránsito y Movilización (REEMO)
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Autorización de embarque a subastas y rastros TIF
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono-data text-purple-900 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
                    520 guías
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Ejidos y Comunidades con Mayor Actividad */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
                    Distribución Territorial
                  </span>
                  <h3 className="text-base font-cinzel font-bold text-stone-900">
                    Cobertura en Ejidos de Pánuco
                  </h3>
                  <p className="text-xs text-stone-500">
                    Localidades con mayor concentración de trámites de fierro y apoyos.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {ejidosRanking.slice(0, 7).map((item, idx) => (
                  <div
                    key={item.ejido}
                    className="p-2.5 rounded-lg border border-stone-200 hover:border-amber-300 transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-700 font-bold font-mono-data flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-stone-900 block">
                          Ejido {item.ejido}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          {item.registros} fierros inscritos · {item.apoyos} programas
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-amber-900 font-mono-data">
                        {item.beneficiarios}
                      </span>
                      <span className="text-[10px] text-stone-400 block">beneficiarios</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: BITÁCORA DETALLADA DE ACTIVIDADES (Data table)
         ========================================================================= */}
      {activeSubTab === 'bitacora' && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
                Padrón Oficial de Eventos
              </span>
              <h3 className="text-lg font-cinzel font-bold text-stone-900">
                Bitácora de Apoyos y Servicios Realizados ({periodTitle})
              </h3>
              <p className="text-xs text-stone-500">
                Detalle pormenorizado de las intervenciones agropecuarias en las comunidades de Pánuco, Ver.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsNewActivityModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Nuevo Registro</span>
            </button>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-stone-200 rounded-lg overflow-hidden">
              <thead className="bg-stone-900 text-stone-200 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Folio / Fecha</th>
                  <th className="py-2.5 px-3">Programa / Servicio</th>
                  <th className="py-2.5 px-3">Ejido / Comunidad</th>
                  <th className="py-2.5 px-3 text-right">Beneficiarios</th>
                  <th className="py-2.5 px-3">Métrica / Dotación</th>
                  <th className="py-2.5 px-3 text-right">Inversión Estimada</th>
                  <th className="py-2.5 px-3 text-center">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-800">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-500">
                      No hay actividades registradas para este periodo o filtro.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act) => {
                    const catInfo = ACTIVITY_CATEGORIES_INFO[act.category];
                    return (
                      <tr key={act.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono-data">
                          <span className="font-bold text-stone-900 block">{act.id}</span>
                          <span className="text-[10px] text-stone-500">{act.date}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-stone-900 block">{act.title}</span>
                          <span className="text-[10px] text-stone-500 block truncate max-w-xs">
                            {act.description}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-stone-900">Ejido {act.ejido}</span>
                          <span className="text-[10px] text-stone-400 block">Pánuco, Ver.</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-data font-bold">
                          {act.beneficiariesCount}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-stone-700">
                          {act.quantityOrMetric}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-data font-semibold text-emerald-800">
                          ${act.estimatedCostOrSubsidio.toLocaleString()} MXN
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${catInfo.bgBadge}`}
                          >
                            {act.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: HOJA OFICIAL DE ENTREGA SEMESTRAL (Official Printable Sheet)
         ========================================================================= */}
      {activeSubTab === 'entrega_oficial' && (
        <div className="space-y-4">
          {/* Print instructions notice (hidden on print) */}
          <div className="no-print bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block">
                  Vista Oficial de Entrega Semestral para H. Cabildo y SEDARPA
                </span>
                <span className="text-xs text-emerald-800">
                  Documento formal con sellos y firmas de rúbrica. Presione el botón a la derecha para imprimir o exportar a PDF oficial.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePrintDeliveryReport}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Imprimir Informe Semestral</span>
            </button>
          </div>

          {/* The Official Printable Document */}
          <div className="bg-white border-2 border-stone-300 rounded-xl p-6 sm:p-10 shadow-md text-stone-900 space-y-6 print:border-none print:shadow-none print:p-0">
            {/* Document Institutional Header */}
            <div className="border-b-2 border-amber-900 pb-4 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-stone-500 block">
                  GOBIERNO DEL ESTADO DE VERACRUZ DE IGNACIO DE LA LLAVE
                </span>
                <h2 className="text-base sm:text-xl font-cinzel font-black text-amber-950">
                  {municipalConfig.municipalityName.toUpperCase()}
                </h2>
                <p className="text-xs font-semibold text-emerald-900 uppercase">
                  {municipalConfig.departmentName}
                </p>
                <p className="text-[11px] text-stone-500 font-mono-data">
                  {municipalConfig.administrationPeriod}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-stone-400 block">Folio de Entrega:</span>
                <span className="text-xs sm:text-sm font-bold font-mono-data text-rose-900">
                  INF-SEM-01-2026/DFA
                </span>
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  Fecha de Cierre: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="text-center py-2 bg-stone-100 border-y border-stone-300">
              <h3 className="text-sm sm:text-base font-cinzel font-bold text-stone-900 uppercase tracking-wider">
                INFORME OFICIAL DE RENDICIÓN DE CUENTAS GANADERAS Y ENTREGA SEMESTRAL
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                Periodo Evaluado: <strong className="text-stone-900">{periodTitle}</strong> · En apego a la Ley Ganadera del Estado de Veracruz
              </p>
            </div>

            {/* Recipient Address */}
            <div className="text-xs space-y-1 text-stone-800">
              <p className="font-bold">A LOS INTEGRANTES DEL H. CABILDO CONSTITUCIONAL DE PÁNUCO, VERACRUZ:</p>
              <p className="font-bold">MTRO. ÓSCAR GUZMÁN DE PAZ · PRESIDENTE MUNICIPAL CONSTITUCIONAL</p>
              <p className="font-medium text-stone-600">
                A LA SECRETARÍA DE DESARROLLO AGROPECUARIO, RURAL Y PESCA (SEDARPA), VERACRUZ.
              </p>
              <p className="pt-2 text-justify italic">
                Por medio del presente instrumento, la Dirección de Fomento Agropecuario y Desarrollo Rural hace constar el informe circunstanciado del estado registral pecuario, verificación de fierros de herrar y marcas de sangre, así como la ejecución de los programas de apoyo al campo y servicios ganaderos otorgados a las familias productoras del municipio:
              </p>
            </div>

            {/* Executive Quantitative Summary Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2">
                1. Síntesis Numérica de Actividades y Padrón Ganadero
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-stone-300 p-3 rounded bg-stone-50">
                <div>
                  <span className="text-[10px] text-stone-500 block uppercase">Fierros Quemadores Inscritos:</span>
                  <span className="text-base font-bold font-mono-data text-stone-900">{kpis.totalRegistros.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 block uppercase">Productores Beneficiados:</span>
                  <span className="text-base font-bold font-mono-data text-stone-900">{kpis.totalBeneficiarios.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 block uppercase">Hectáreas Protegidas:</span>
                  <span className="text-base font-bold font-mono-data text-stone-900">{kpis.totalHectareas.toLocaleString()} Has.</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 block uppercase">Subsidio Total Directo:</span>
                  <span className="text-base font-bold font-mono-data text-emerald-800">${kpis.totalInversionSubsidio.toLocaleString()} MXN</span>
                </div>
              </div>
            </div>

            {/* Detail of Programs Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2">
                2. Programas de Apoyo, Sanidad y Servicios Ganaderos Entregados
              </h4>
              <table className="w-full text-left text-[11px] border border-stone-300">
                <thead className="bg-stone-100 text-stone-800 font-bold border-b border-stone-300">
                  <tr>
                    <th className="p-1.5">Rubro de Atención</th>
                    <th className="p-1.5">Ejidos Beneficiados</th>
                    <th className="p-1.5 text-right">Beneficiarios</th>
                    <th className="p-1.5">Dotación Física</th>
                    <th className="p-1.5 text-right">Monto Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {categoryBreakdown
                    .filter((c) => c.count > 0 || c.investment > 0)
                    .map((item) => (
                      <tr key={item.categoryKey}>
                        <td className="p-1.5 font-semibold text-stone-900">{item.info.label}</td>
                        <td className="p-1.5 text-stone-600">Reventadero, Tamos, Cacalilao, Canoas, Mahuaves</td>
                        <td className="p-1.5 text-right font-mono-data">{item.beneficiaries}</td>
                        <td className="p-1.5 text-stone-700">{item.count} Jornadas en Campo</td>
                        <td className="p-1.5 text-right font-mono-data font-bold text-stone-900">
                          ${item.investment.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Legal Footnote and Certification Note */}
            <p className="text-[10px] text-stone-500 text-justify border-t border-stone-200 pt-3">
              Se anexa al presente informe la base de datos electrónica y los libros de registro notarial correspondientes a los artículos 45 al 60 de la Ley Ganadera del Estado de Veracruz, para los efectos legales a que haya lugar en el cotejo de bienes mostrencos, abigeato y movilización pecuaria.
            </p>

            {/* Official Signatories Block */}
            <div className="pt-6 border-t-2 border-stone-400 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs">
              <div>
                <div className="h-14 border-b border-dashed border-stone-400 mb-1" />
                <p className="font-bold text-stone-900">{municipalConfig.mayorName}</p>
                <p className="text-[10px] text-stone-600">{municipalConfig.mayorTitle}</p>
              </div>

              <div>
                <div className="h-14 border-b border-dashed border-stone-400 mb-1" />
                <p className="font-bold text-stone-900">{municipalConfig.directorName}</p>
                <p className="text-[10px] text-stone-600">{municipalConfig.directorTitle}</p>
              </div>

              <div>
                <div className="h-14 border-b border-dashed border-stone-400 mb-1" />
                <p className="font-bold text-stone-900">{municipalConfig.treasurerName}</p>
                <p className="text-[10px] text-stone-600">{municipalConfig.treasurerTitle}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: REGISTRO DE NUEVO APOYO O ACTIVIDAD GANADERA MUNICIPAL
         ========================================================================= */}
      {isNewActivityModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-stone-300 rounded-xl shadow-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-cinzel font-bold text-stone-900">
                  Registrar Apoyo o Servicio Ganadero
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewActivityModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewActivity} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold uppercase text-stone-700 mb-1">
                  Rubro / Categoría de Apoyo *
                </label>
                <select
                  value={newActivityForm.category}
                  onChange={(e) =>
                    setNewActivityForm({ ...newActivityForm, category: e.target.value as ActivityCategory })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 font-medium cursor-pointer"
                >
                  {(Object.keys(ACTIVITY_CATEGORIES_INFO) as ActivityCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {ACTIVITY_CATEGORIES_INFO[cat].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-stone-700 mb-1">
                  Título de la Actividad *
                </label>
                <input
                  type="text"
                  required
                  value={newActivityForm.title}
                  onChange={(e) => setNewActivityForm({ ...newActivityForm, title: e.target.value.toUpperCase() })}
                  placeholder="Ej. Distribución de Pacas de Heno por Estiaje"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-stone-700 mb-1">
                    Fecha de Realización *
                  </label>
                  <input
                    type="date"
                    required
                    value={newActivityForm.date}
                    onChange={(e) => setNewActivityForm({ ...newActivityForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono-data"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-stone-700 mb-1">
                    Ejido o Comunidad *
                  </label>
                  <select
                    value={newActivityForm.ejido}
                    onChange={(e) => setNewActivityForm({ ...newActivityForm, ejido: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 font-medium cursor-pointer"
                  >
                    {PANUCO_EJIDOS.map((ej) => (
                      <option key={ej} value={ej}>
                        Ejido {ej}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-stone-700 mb-1">
                    Ganaderos Beneficiados *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newActivityForm.beneficiariesCount}
                    onChange={(e) =>
                      setNewActivityForm({
                        ...newActivityForm,
                        beneficiariesCount: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono-data"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-stone-700 mb-1">
                    Inversión / Subsidio ($ MXN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={newActivityForm.estimatedCostOrSubsidio}
                    onChange={(e) =>
                      setNewActivityForm({
                        ...newActivityForm,
                        estimatedCostOrSubsidio: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono-data"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-stone-700 mb-1">
                  Métrica / Volumen de Apoyo
                </label>
                <input
                  type="text"
                  value={newActivityForm.quantityOrMetric}
                  onChange={(e) =>
                    setNewActivityForm({ ...newActivityForm, quantityOrMetric: e.target.value })
                  }
                  placeholder="Ej. 650 Pacas / 1,200 Dosis / 4 Presas"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-stone-700 mb-1">
                  Descripción o Observaciones Técnicas
                </label>
                <textarea
                  rows={2}
                  value={newActivityForm.description}
                  onChange={(e) =>
                    setNewActivityForm({ ...newActivityForm, description: e.target.value })
                  }
                  placeholder="Notas sobre la entrega de insumos, brigada veterinaria o supervisión de obra..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewActivityModalOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:text-stone-800 bg-stone-100 rounded-lg cursor-pointer font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-white bg-amber-600 hover:bg-amber-700 rounded-lg font-bold shadow transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar e Integrar a Gráficas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
