import React, { useState, useMemo } from 'react';
import { BrandConfig, HistoricalRecord, SimilarityMatch } from '../types';
import { getMunicipalDatabase } from '../utils/database';
import {
  runAntiDuplicityCheck,
  calculateSimilarity,
  generateUniqueProposals,
  formatSymbolName,
  formatOrientationName,
} from '../utils/similarity';
import { renderBrandToCanvas } from '../utils/canvasRenderer';
import {
  Search,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Database,
  Eye,
  CheckCircle2,
  Filter,
} from 'lucide-react';

interface TabAntiduplicidadProps {
  brandConfig: BrandConfig;
  onApplyBrandProposal: (config: BrandConfig) => void;
  onGoToCreador: () => void;
}

// Mini Canvas preview for proposals or historical records
const MiniBrandCanvas: React.FC<{
  initials: string;
  topSymbol: any;
  bottomSymbol: any;
  orientation: any;
  size?: number;
}> = ({ initials, topSymbol, bottomSymbol, orientation, size = 64 }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderBrandToCanvas(
      ctx,
      canvas.width,
      canvas.height,
      {
        initials,
        topSymbol,
        bottomSymbol,
        centerSymbol: 'none',
        orientation,
        strokeWidth: 10,
        slantAngle: 45,
        finish: 'forja_negra',
        hasOuterRing: false,
        hasSpurs: false,
      },
      { background: 'transparent', showShadow: false }
    );
  }, [initials, topSymbol, bottomSymbol, orientation]);

  return (
    <div
      className="bg-stone-50 border border-stone-300 rounded flex items-center justify-center overflow-hidden shrink-0 shadow-xs"
      style={{ width: size, height: size }}
    >
      <canvas ref={canvasRef} width={size * 2} height={size * 2} className="w-full h-full object-contain" />
    </div>
  );
};

export const TabAntiduplicidad: React.FC<TabAntiduplicidadProps> = ({
  brandConfig,
  onApplyBrandProposal,
  onGoToCreador,
}) => {
  const database = useMemo(() => getMunicipalDatabase(), []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEjido, setSelectedEjido] = useState('ALL');
  const [filterMode, setFilterMode] = useState<'all' | 'high_similarity' | 'vigente'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);
  const [comparedRecord, setComparedRecord] = useState<HistoricalRecord | null>(null);

  // Run real-time check against all records
  const analysis = useMemo(() => runAntiDuplicityCheck(brandConfig), [brandConfig]);

  // Generate 3 unique proposals for when there's conflict or user wants alternatives
  const uniqueProposals = useMemo(() => generateUniqueProposals(brandConfig), [brandConfig]);

  // Filtered list of database records
  const filteredRecords = useMemo(() => {
    let result = database;

    if (filterMode === 'high_similarity') {
      // Sort by similarity descending
      result = [...database].map((rec) => ({
        ...rec,
        _sim: calculateSimilarity(brandConfig, rec).percentage,
      })).filter((item: any) => item._sim > 30).sort((a: any, b: any) => b._sim - a._sim);
    } else if (filterMode === 'vigente') {
      result = result.filter((r) => r.status === 'Vigente');
    }

    if (selectedEjido !== 'ALL') {
      result = result.filter((r) => r.ejido === selectedEjido);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.folio.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.initials.toLowerCase().includes(q) ||
          r.propertyName.toLowerCase().includes(q) ||
          r.uppKey.toLowerCase().includes(q)
      );
    }

    return result;
  }, [database, brandConfig, filterMode, selectedEjido, searchTerm]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const handleApplyAlternative = (proposal: BrandConfig) => {
    onApplyBrandProposal(proposal);
    setAppliedNotice('Propuesta libre de duplicidad aplicada exitosamente a su diseño.');
    setTimeout(() => setAppliedNotice(null), 3500);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 w-full max-w-full overflow-x-hidden">
      {/* Title */}
      <div className="border-b border-stone-300 pb-4 sm:pb-6 mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-800 block">
            Padrón Histórico de Marcas y Señales de Sangre · Pánuco, Ver.
          </span>
          <h1 className="text-xl sm:text-3xl font-cinzel font-bold text-stone-900 mt-1 break-words">
            Motor Antiduplicidad y Búsqueda por Similitud
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Validación algorítmica obligatoria en tiempo real contra los{' '}
            <span className="font-semibold text-stone-900">{database.length.toLocaleString()} registros</span> del
            H. Ayuntamiento.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-stone-100 border border-stone-300 rounded-md text-[11px] sm:text-xs font-mono-data text-stone-700 whitespace-nowrap">
            Base: {database.length.toLocaleString()} fierros
          </div>
        </div>
      </div>

      {appliedNotice && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{appliedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAppliedNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Diagnostic Banner (Status Indicator) */}
      <div
        className={`p-6 rounded-xl border mb-8 shadow-sm transition-all ${
          analysis.verdictCode === 'DUPLICATE_ALERT'
            ? 'bg-red-50 border-red-300 text-red-950'
            : analysis.verdictCode === 'HIGH_SIMILARITY'
            ? 'bg-amber-50 border-amber-300 text-amber-950'
            : 'bg-emerald-50 border-emerald-300 text-emerald-950'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                analysis.verdictCode === 'DUPLICATE_ALERT'
                  ? 'bg-red-200 text-red-800'
                  : analysis.verdictCode === 'HIGH_SIMILARITY'
                  ? 'bg-amber-200 text-amber-800'
                  : 'bg-emerald-200 text-emerald-800'
              }`}
            >
              {analysis.verdictCode === 'DUPLICATE_ALERT' || analysis.verdictCode === 'HIGH_SIMILARITY' ? (
                <AlertTriangle className="w-7 h-7" />
              ) : (
                <ShieldCheck className="w-7 h-7" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded ${
                    analysis.verdictCode === 'DUPLICATE_ALERT'
                      ? 'bg-red-600 text-white'
                      : analysis.verdictCode === 'HIGH_SIMILARITY'
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-700 text-white'
                  }`}
                >
                  {analysis.verdictCode === 'DUPLICATE_ALERT'
                    ? '🔴 ALERTA DE COINCIDENCIA'
                    : analysis.verdictCode === 'HIGH_SIMILARITY'
                    ? '🟡 ADVERTENCIA DE SIMILITUD'
                    : '🟢 LIBRE DE REGISTRO'}
                </span>
                <span className="text-sm font-mono-data font-bold">
                  Índice de similitud máxima: {analysis.highestSimilarity}%
                </span>
              </div>

              <h2 className="text-lg font-cinzel font-bold mt-2">
                {analysis.verdictCode === 'DUPLICATE_ALERT'
                  ? `Conflicto detectado con el Folio #${analysis.criticalMatch?.folio}`
                  : analysis.verdictCode === 'HIGH_SIMILARITY'
                  ? `Similitud moderada con el Folio #${analysis.criticalMatch?.folio}`
                  : 'Fierro 100% Inédito y Original'}
              </h2>

              <p className="text-xs sm:text-sm mt-1 leading-relaxed max-w-3xl">
                {analysis.statusText}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onGoToCreador}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Modificar en el Creador
            </button>
          </div>
        </div>
      </div>

      {/* Section: 3 Alternative Proposals (Generador Automático de 3 Opciones Libres de Registro) */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm mb-8">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-cinzel font-bold text-stone-900">
              Propuestas Alternativas Garantizadas Libres de Registro
            </h2>
          </div>
          <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Similitud &lt; 20% Garantizada
          </span>
        </div>

        <p className="text-xs text-stone-600 mb-4">
          Si su monograma presenta conflicto o desea una variante legalmente blindada, el sistema municipal ha calculado estas 3 opciones distintivas preservando sus iniciales:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {uniqueProposals.map((prop, idx) => (
            <div
              key={idx}
              className="border border-stone-200 rounded-lg p-4 bg-stone-50/50 hover:bg-amber-50/30 hover:border-amber-300 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-stone-500 uppercase">
                    Variante Oficial #{idx + 1}
                  </span>
                  <span className="text-xs text-emerald-700 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded">
                    0% Conflicto
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <MiniBrandCanvas
                    initials={prop.initials}
                    topSymbol={prop.topSymbol}
                    bottomSymbol={prop.bottomSymbol}
                    orientation={prop.orientation}
                    size={80}
                  />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-stone-900 font-cinzel text-sm">
                      "{prop.initials}" · {formatOrientationName(prop.orientation)}
                    </p>
                    <p className="text-stone-600">
                      Superior: <span className="font-medium text-stone-800">{formatSymbolName(prop.topSymbol)}</span>
                    </p>
                    <p className="text-stone-600">
                      Base: <span className="font-medium text-stone-800">{formatSymbolName(prop.bottomSymbol)}</span>
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleApplyAlternative(prop)}
                className="w-full px-3 py-2 text-xs font-semibold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Aplicar esta variante al Creador</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Historical Database Explorer */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-100 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-stone-700" />
            <div>
              <h2 className="text-base font-cinzel font-bold text-stone-900">
                Padrón Municipal de Fierros de Herrar (4,250 Registros)
              </h2>
              <p className="text-xs text-stone-500">
                Archivo oficial de marcas de fuego y señales de sangre del H. Ayuntamiento de Pánuco
              </p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => {
                setFilterMode('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded transition-colors ${
                filterMode === 'all' ? 'bg-white font-semibold text-stone-900 shadow-xs' : 'text-stone-600'
              }`}
            >
              Todos ({database.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode('high_similarity');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded transition-colors ${
                filterMode === 'high_similarity' ? 'bg-white font-semibold text-amber-900 shadow-xs' : 'text-stone-600'
              }`}
            >
              Por Similitud con Actual
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode('vigente');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded transition-colors ${
                filterMode === 'vigente' ? 'bg-white font-semibold text-emerald-900 shadow-xs' : 'text-stone-600'
              }`}
            >
              Solo Vigentes
            </button>
          </div>
        </div>

        {/* Search controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por propietario, folio (ej. PAN-1985), letras, rancho o UPP..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
            />
          </div>

          <div>
            <select
              value={selectedEjido}
              onChange={(e) => {
                setSelectedEjido(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
            >
              <option value="ALL">Todos los Ejidos / Congregaciones</option>
              {Array.from(new Set(database.map((d) => d.ejido)))
                .sort()
                .map((ejido) => (
                  <option key={ejido} value={ejido}>
                    {ejido}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Records Table */}
        <div className="overflow-x-auto border border-stone-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-100 text-stone-700 font-semibold uppercase tracking-wider border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-3">Fierro</th>
                <th className="py-2.5 px-3">Folio</th>
                <th className="py-2.5 px-3">Propietario</th>
                <th className="py-2.5 px-3">Predio / Ejido</th>
                <th className="py-2.5 px-3">UPP</th>
                <th className="py-2.5 px-3">Letras & Símbolos</th>
                <th className="py-2.5 px-3">Similitud</th>
                <th className="py-2.5 px-3 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-500">
                    No se encontraron registros que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => {
                  const sim = calculateSimilarity(brandConfig, record);
                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-stone-50 transition-colors ${
                        sim.percentage >= 85
                          ? 'bg-red-50/60'
                          : sim.percentage >= 60
                          ? 'bg-amber-50/60'
                          : ''
                      }`}
                    >
                      <td className="py-2 px-3">
                        <MiniBrandCanvas
                          initials={record.initials}
                          topSymbol={record.topSymbol}
                          bottomSymbol={record.bottomSymbol}
                          orientation={record.orientation}
                          size={40}
                        />
                      </td>
                      <td className="py-2 px-3 font-mono-data font-semibold text-stone-900 whitespace-nowrap">
                        {record.folio}
                      </td>
                      <td className="py-2 px-3 font-medium text-stone-900">
                        {record.ownerName}
                      </td>
                      <td className="py-2 px-3 text-stone-600">
                        <span className="block font-medium text-stone-800">{record.propertyName}</span>
                        <span className="text-stone-500">{record.ejido}, Pánuco</span>
                      </td>
                      <td className="py-2 px-3 font-mono-data text-stone-600 whitespace-nowrap">
                        {record.uppKey}
                      </td>
                      <td className="py-2 px-3 text-stone-600">
                        <span className="font-bold text-stone-900 font-cinzel mr-1">
                          "{record.initials}"
                        </span>
                        <span className="text-stone-500">
                          ({record.topSymbol !== 'none' ? record.topSymbol : 'sin corona'} / {record.bottomSymbol !== 'none' ? record.bottomSymbol : 'sin base'})
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono-data font-bold ${
                            sim.percentage >= 85
                              ? 'bg-red-100 text-red-800'
                              : sim.percentage >= 60
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {sim.percentage}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setComparedRecord(record)}
                          className="px-2 py-1 text-xs text-amber-800 hover:text-amber-950 hover:bg-amber-50 rounded transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Cotejar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
          <div>
            Mostrando registros {(currentPage - 1) * pageSize + 1} a{' '}
            {Math.min(currentPage * pageSize, filteredRecords.length)} de{' '}
            <span className="font-bold text-stone-900">{filteredRecords.length.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 border border-stone-300 rounded hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
            >
              Anterior
            </button>
            <span className="px-3 font-mono-data">
              Página {currentPage} de {totalPages || 1}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 border border-stone-300 rounded hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Modal */}
      {comparedRecord && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl border border-stone-300">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
              <h3 className="font-cinzel font-bold text-stone-900 text-lg">
                Cotejo Forense de Fierro Marcador
              </h3>
              <button
                type="button"
                onClick={() => setComparedRecord(null)}
                className="text-stone-400 hover:text-stone-700 text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center mb-6">
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg">
                <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold block mb-2">
                  Su Diseño Actual
                </span>
                <div className="flex justify-center mb-2">
                  <MiniBrandCanvas
                    initials={brandConfig.initials}
                    topSymbol={brandConfig.topSymbol}
                    bottomSymbol={brandConfig.bottomSymbol}
                    orientation={brandConfig.orientation}
                    size={90}
                  />
                </div>
                <p className="font-cinzel font-bold text-sm">"{brandConfig.initials}"</p>
                <p className="text-xs text-stone-500">{formatOrientationName(brandConfig.orientation)}</p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg">
                <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold block mb-2">
                  Registro Folio #{comparedRecord.folio}
                </span>
                <div className="flex justify-center mb-2">
                  <MiniBrandCanvas
                    initials={comparedRecord.initials}
                    topSymbol={comparedRecord.topSymbol}
                    bottomSymbol={comparedRecord.bottomSymbol}
                    orientation={comparedRecord.orientation}
                    size={90}
                  />
                </div>
                <p className="font-cinzel font-bold text-sm">"{comparedRecord.initials}"</p>
                <p className="text-xs text-stone-500">{formatOrientationName(comparedRecord.orientation)}</p>
              </div>
            </div>

            {/* Match breakdown reasons */}
            {(() => {
              const res = calculateSimilarity(brandConfig, comparedRecord);
              return (
                <div className="bg-stone-50 rounded-lg p-4 mb-4 border border-stone-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase text-stone-700">
                      Diagnóstico de Similitud:
                    </span>
                    <span
                      className={`font-mono-data font-bold text-sm ${
                        res.percentage >= 85
                          ? 'text-red-700'
                          : res.percentage >= 60
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {res.percentage}% de Coincidencia
                    </span>
                  </div>
                  <ul className="text-xs text-stone-600 space-y-1 list-disc pl-4">
                    {res.reasons.length === 0 ? (
                      <li>Sin elementos coincidentes de riesgo.</li>
                    ) : (
                      res.reasons.map((r, i) => <li key={i}>{r}</li>)
                    )}
                  </ul>
                  <div className="mt-3 pt-2 border-t border-stone-200 text-xs text-stone-500">
                    Propietario registrado: <span className="font-semibold text-stone-800">{comparedRecord.ownerName}</span> · {comparedRecord.propertyName}, Ejido {comparedRecord.ejido}.
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setComparedRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg cursor-pointer"
              >
                Cerrar Cotejo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
