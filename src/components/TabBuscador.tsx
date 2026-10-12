import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HistoricalRecord, BrandConfig, ProducerData, BrandOrientation } from '../types';
import { getMunicipalDatabase, cleanCorruptedTestRecords } from '../utils/database';
import { getStoredEjidos } from '../utils/catalogs';
import { renderBrandToCanvas } from '../utils/canvasRenderer';
import { recordAuditLog } from '../utils/auditAuth';
import { getLocalFierros } from '../utils/localFierrosStorage';
import { computeVectorChecksum } from '../utils/brandVectorization';
import { VectorComparisonModal } from './VectorComparisonModal';
import { ProductorAuditoriaModal } from './ProductorAuditoriaModal';
import { QrScannerModal } from './QrScannerModal';
import {
  Search,
  Filter,
  RotateCcw,
  CheckCircle2,
  FileCheck,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar,
  Sparkles,
  Download,
  AlertTriangle,
  Layers,
  Camera,
} from 'lucide-react';

interface TabBuscadorProps {
  onLoadRecordIntoCertificate: (record: HistoricalRecord) => void;
  onGoToCertificado: () => void;
  onGoToRegistro: () => void;
}

// Mini Canvas renderer for table rows
const TableBrandCanvas: React.FC<{
  initials: string;
  topSymbol: any;
  bottomSymbol: any;
  orientation: any;
}> = ({ initials, topSymbol, bottomSymbol, orientation }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
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
    <div className="w-12 h-12 bg-amber-50/50 border border-stone-200 rounded flex items-center justify-center p-0.5 shrink-0 shadow-2xs">
      <canvas ref={canvasRef} width={96} height={96} className="w-full h-full object-contain" />
    </div>
  );
};

export const TabBuscador: React.FC<TabBuscadorProps> = ({
  onLoadRecordIntoCertificate,
  onGoToCertificado,
  onGoToRegistro,
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [localFierros, setLocalFierros] = useState<HistoricalRecord[]>(() => getLocalFierros());

  // Escuchar eventos de cambios en almacenamiento local para actualización reactiva
  useEffect(() => {
    const handleStorageUpdate = () => {
      setLocalFierros(getLocalFierros());
    };
    handleStorageUpdate();
    window.addEventListener('fierros_historicos_changed', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('fierros_historicos_changed', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  // Fusión de Base de Datos: Los fierros locales se anteponen con máxima prioridad
  const combinedDatabase = useMemo(() => {
    const municipalDb = getMunicipalDatabase();
    const localIdSet = new Set(localFierros.map((r) => r.id.toLowerCase()));
    const localFolioSet = new Set(localFierros.map((r) => r.folio.toLowerCase()));

    const filteredMunicipal = municipalDb.filter(
      (r) => !localIdSet.has(r.id.toLowerCase()) && !localFolioSet.has(r.folio.toLowerCase())
    );

    return [...localFierros, ...filteredMunicipal];
  }, [localFierros, refreshKey]);

  const database = combinedDatabase;
  const ejidosList = useMemo(() => getStoredEjidos(), []);

  useEffect(() => {
    const purged = cleanCorruptedTestRecords();
    if (purged > 0) {
      setRefreshKey((k) => k + 1);
    }
  }, []);

  // 1. Global Reactive Search Input
  const [globalSearch, setGlobalSearch] = useState('');

  // 2. Advanced Combinable Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [filterOnlyLocal, setFilterOnlyLocal] = useState(false);
  const [filterOwner, setFilterOwner] = useState('');
  const [filterFolio, setFilterFolio] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [filterEjido, setFilterEjido] = useState('ALL');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterYear, setFilterYear] = useState('ALL');
  const [filterUppCurp, setFilterUppCurp] = useState('');
  const [filterInitials, setFilterInitials] = useState('');
  const [filterOrientation, setFilterOrientation] = useState<'ALL' | BrandOrientation>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Vector Comparison Modal State
  const [comparisonSourceRecord, setComparisonSourceRecord] = useState<HistoricalRecord | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // FIX_AUDITORIA_MODAL: estado del modal de auditoria completa por productor
  const [auditoriaRecord, setAuditoriaRecord] = useState<HistoricalRecord | null>(null);
  const [showQrScanner, setShowQrScanner] = useState<boolean>(false);

  const handleCompareSimilarity = (record: HistoricalRecord) => {
    setComparisonSourceRecord(record);
    setShowComparisonModal(true);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Success Notice
  const [loadedNotice, setLoadedNotice] = useState<{ record: HistoricalRecord; message: string } | null>(null);

  // Quick Preset Filters
  const applyPreset = (presetName: string) => {
    resetFilters();
    switch (presetName) {
      case 'local_only':
        setFilterOnlyLocal(true);
        break;
      case 'irma':
        setFilterOwner('GARCIA ORTIZ IRMA');
        break;
      case 'guzman':
        setFilterOwner('Guzmán');
        setFilterEjido('Reventadero');
        break;
      case 'recent':
        setFilterDateStart('2024-01-01');
        break;
      case 'echado':
        setFilterOrientation('echado');
        break;
      case 'canoas':
        setFilterEjido('Canoas');
        break;
      case 'litigio':
        setFilterStatus('En Litigio');
        break;
      default:
        break;
    }
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setGlobalSearch('');
    setFilterOnlyLocal(false);
    setFilterOwner('');
    setFilterFolio('');
    setFilterProperty('');
    setFilterEjido('ALL');
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterYear('ALL');
    setFilterUppCurp('');
    setFilterInitials('');
    setFilterOrientation('ALL');
    setFilterStatus('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(globalSearch) ||
    Boolean(filterOnlyLocal) ||
    Boolean(filterOwner) ||
    Boolean(filterFolio) ||
    Boolean(filterProperty) ||
    filterEjido !== 'ALL' ||
    Boolean(filterDateStart) ||
    Boolean(filterDateEnd) ||
    filterYear !== 'ALL' ||
    Boolean(filterUppCurp) ||
    Boolean(filterInitials) ||
    filterOrientation !== 'ALL' ||
    filterStatus !== 'ALL';

  // Multi-criteria filter engine
  const filteredRecords = useMemo(() => {
    const qGlobal = globalSearch.trim().toLowerCase();
    const qOwner = filterOwner.trim().toLowerCase();
    const qFolio = filterFolio.trim().toLowerCase();
    const qProp = filterProperty.trim().toLowerCase();
    const qUpp = filterUppCurp.trim().toLowerCase();
    const qInitials = filterInitials.trim().toUpperCase();

    return database.filter((rec) => {
      // 0. Filtro exclusivo: Solo Fierros Locales (Digitalizados)
      if (filterOnlyLocal && !rec.isLocal && !rec.isHistoricalDigitized) {
        return false;
      }

      // 1. Global search matches any field
      if (qGlobal) {
        const matchesGlobal =
          rec.ownerName.toLowerCase().includes(qGlobal) ||
          rec.folio.toLowerCase().includes(qGlobal) ||
          (rec.registrationNumber && rec.registrationNumber.toLowerCase().includes(qGlobal)) ||
          rec.propertyName.toLowerCase().includes(qGlobal) ||
          rec.ejido.toLowerCase().includes(qGlobal) ||
          rec.uppKey.toLowerCase().includes(qGlobal) ||
          rec.curp.toLowerCase().includes(qGlobal) ||
          rec.rfc.toLowerCase().includes(qGlobal) ||
          (rec.phone && rec.phone.includes(qGlobal)) ||
          rec.initials.toUpperCase().includes(qGlobal.toUpperCase()) ||
          rec.issueDate.includes(qGlobal) ||
          String(rec.year).includes(qGlobal);

        if (!matchesGlobal) return false;
      }

      // 2. Specific Owner
      if (qOwner && !rec.ownerName.toLowerCase().includes(qOwner)) {
        return false;
      }

      // 3. Specific Folio
      if (qFolio && !rec.folio.toLowerCase().includes(qFolio)) {
        return false;
      }

      // 4. Specific Property
      if (qProp && !rec.propertyName.toLowerCase().includes(qProp)) {
        return false;
      }

      // 5. Ejido
      if (filterEjido !== 'ALL' && rec.ejido !== filterEjido) {
        return false;
      }

      // 6. Date Range & Year
      if (filterYear !== 'ALL' && String(rec.year) !== filterYear) {
        return false;
      }
      if (filterDateStart && rec.issueDate < filterDateStart) {
        return false;
      }
      if (filterDateEnd && rec.issueDate > filterDateEnd) {
        return false;
      }

      // 7. UPP / CURP / RFC
      if (qUpp) {
        const matchUpp =
          rec.uppKey.toLowerCase().includes(qUpp) ||
          rec.curp.toLowerCase().includes(qUpp) ||
          rec.rfc.toLowerCase().includes(qUpp);
        if (!matchUpp) return false;
      }

      // 8. Initials
      if (qInitials && !rec.initials.toUpperCase().includes(qInitials)) {
        return false;
      }

      // 9. Orientation
      if (filterOrientation !== 'ALL' && rec.orientation !== filterOrientation) {
        return false;
      }

      // 10. Status
      if (filterStatus !== 'ALL' && rec.status !== filterStatus) {
        return false;
      }

      return true;
    });
  }, [
    database,
    filterOnlyLocal,
    globalSearch,
    filterOwner,
    filterFolio,
    filterProperty,
    filterEjido,
    filterDateStart,
    filterDateEnd,
    filterYear,
    filterUppCurp,
    filterInitials,
    filterOrientation,
    filterStatus,
  ]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Action: "Ver / Cargar en Certificado"
  
  // P4-QR: Al escanear QR, buscar el registro por folio y abrir el portafolio
  const handleQrScanSuccess = (folio: string) => {
    setShowQrScanner(false);
    const found = combinedDatabase.find(
      (r) => r.folio.toUpperCase() === folio.toUpperCase() ||
             (r.registrationNumber && r.registrationNumber.toUpperCase() === folio.toUpperCase())
    );
    if (found) {
      recordAuditLog({
        actionType: 'CONSULTA_PADRON',
        folioAffected: found.folio,
        producerAffected: found.ownerName,
        details: `Consulta vía escaneo QR: Folio ${folio} (${found.ownerName}).`,
      });
      setAuditoriaRecord(found);
    } else {
      alert(`No se encontró el folio "${folio}" en el padrón municipal.`);
    }
  };

  const handleLoadRecord = (record: HistoricalRecord) => {
    onLoadRecordIntoCertificate(record);
    recordAuditLog({
      actionType: 'CARGA_CERTIFICADO',
      folioAffected: record.folio,
      producerAffected: record.ownerName,
      details: `Carga oficial de datos del Folio #${record.folio} (${record.ownerName}) al Certificado y Creador para consulta/reimpresión.`,
    });

    setLoadedNotice({
      record,
      message: `¡Registro Folio #${record.folio} cargado exitosamente! Los datos y el fierro han sido transferidos al Certificado Oficial y al Formulario Municipal.`,
    });
  };

  const handleExportSearchResults = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Folio,Propietario,Predio,Ejido,Iniciales,Orientacion,UPP,CURP,Fecha_Expedicion,Estado',
        ...filteredRecords.map(
          (r) =>
            `"${r.folio}","${r.ownerName}","${r.propertyName}","${r.ejido}","${r.initials}","${r.orientation}","${r.uppKey}","${r.curp}","${r.issueDate}","${r.status}"`
        ),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Padron_Panuco_Busqueda_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 w-full max-w-full overflow-x-hidden">
      {/* Title */}
      <div className="border-b border-stone-300 pb-4 sm:pb-6 mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-800 block">
            Padrón Pecuario Municipal · H. Ayuntamiento de Pánuco, Ver.
          </span>
          <h1 className="text-xl sm:text-3xl font-cinzel font-bold text-stone-900 mt-1 break-words">
            Buscador Inteligente y Consulta Multi-Criterio
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Motor de búsqueda reactivo en tiempo real sobre los{' '}
            <strong className="text-stone-900">{database.length.toLocaleString()} registros oficiales</strong> de
            marcas de fuego y señales de sangre.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportSearchResults}
            className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Exportar CSV ({filteredRecords.length.toLocaleString()})</span>
          </button>
        </div>
      </div>

      {/* Loaded Notification Banner */}
      {loadedNotice && (
        <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-400 text-emerald-950 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-emerald-900 font-cinzel">
                {loadedNotice.message}
              </p>
              <p className="text-xs text-emerald-800 mt-0.5">
                Titular: <strong>{loadedNotice.record.ownerName}</strong> · Predio:{' '}
                <strong>{loadedNotice.record.propertyName}</strong> ({loadedNotice.record.ejido}, Ver.) · Clave UPP:{' '}
                <span className="font-mono-data font-semibold">{loadedNotice.record.uppKey}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onGoToCertificado}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              <span>Ver en Certificado Oficial A4</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setLoadedNotice(null)}
              className="text-stone-400 hover:text-stone-600 font-bold px-2 py-1 text-lg"
            >
              ×
            </button>
          </div>
        </div>
      )}

            {/* P4-QR: RECUADRO GRANDE DE ESCANEO QR */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-5 sm:p-6 shadow-lg mb-6 border-2 border-amber-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/25 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
              <Camera className="text-white" size={28} />
            </div>
            <div className="text-left">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/90 block">
                Acceso Rápido por Código QR
              </span>
              <h3 className="text-lg sm:text-xl font-black font-cinzel text-white leading-tight">
                ESCANEAR QR DEL CERTIFICADO
              </h3>
              <p className="text-xs sm:text-sm text-amber-50 font-medium mt-0.5">
                Apunte la cámara al QR del documento oficial para abrir el portafolio de evidencias del productor.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowQrScanner(true)}
            className="w-full md:w-auto px-6 py-3 bg-white hover:bg-amber-50 text-amber-900 font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ring-4 ring-white/30 hover:scale-[1.02] active:scale-98 shrink-0"
          >
            <Camera className="w-5 h-5" />
            <span>ABRIR CÁMARA Y ESCANEAR</span>
          </button>
        </div>
      </div>
{/* 1. GLOBAL SEARCH BAR (Búsqueda Reactiva en Tiempo Real) */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm mb-6">
        <div className="relative mb-3">
          <Search className="w-5 h-5 text-amber-600 absolute left-4 top-3.5" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Búsqueda global reactiva: Escriba nombre del productor, folio, rancho, ejido, UPP, CURP, letras..."
            className="w-full pl-12 pr-10 py-3 text-sm sm:text-base border-2 border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50 text-stone-900 placeholder-stone-400 shadow-inner"
          />
          {globalSearch && (
            <button
              type="button"
              onClick={() => setGlobalSearch('')}
              className="absolute right-4 top-3.5 text-stone-400 hover:text-stone-700 font-bold text-lg cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Quick Filter Presets and Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-stone-500 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Filtros Rápidos:
            </span>

            {/* Checkbox Requerido: Solo Fierros Locales */}
            <label className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-100 transition-colors shadow-2xs select-none">
              <input
                type="checkbox"
                checked={filterOnlyLocal}
                onChange={(e) => {
                  setFilterOnlyLocal(e.target.checked);
                  setCurrentPage(1);
                }}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>⭐ Solo Fierros Locales ({localFierros.length})</span>
            </label>

            <button
              type="button"
              onClick={() => applyPreset('irma')}
              className="px-2.5 py-1 bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-700 rounded transition-colors cursor-pointer font-medium"
            >
              Irma García (Piloto)
            </button>

            <button
              type="button"
              onClick={() => applyPreset('guzman')}
              className="px-2.5 py-1 bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-700 rounded transition-colors cursor-pointer"
            >
              {/* FIX_NO_MOCK: filtro demo removido */}
            </button>
            <button
              type="button"
              onClick={() => applyPreset('recent')}
              className="px-2.5 py-1 bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-700 rounded transition-colors cursor-pointer"
            >
              Recientes 2024–2026
            </button>
            <button
              type="button"
              onClick={() => applyPreset('canoas')}
              className="px-2.5 py-1 bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-700 rounded transition-colors cursor-pointer"
            >
              Canoas, Ver.
            </button>
            <button
              type="button"
              onClick={() => applyPreset('echado')}
              className="px-2.5 py-1 bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-700 rounded transition-colors cursor-pointer"
            >
              Fierros "Echados"
            </button>
            <button
              type="button"
              onClick={() => applyPreset('litigio')}
              className="px-2.5 py-1 bg-stone-100 hover:bg-red-100 hover:text-red-900 text-stone-700 rounded transition-colors cursor-pointer"
            >
              En Litigio
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                showAdvancedFilters
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Combinables'}</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar Todo</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. ADVANCED COMBINABLE FILTERS PANEL */}
        {showAdvancedFilters && (
          <div className="mt-5 pt-4 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-stone-50/70 p-4 rounded-xl border">
            {/* Filter 1: Propietario */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Nombre del Productor
              </label>
              <input
                type="text"
                value={filterOwner}
                onChange={(e) => {
                  setFilterOwner(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Ej. Aurelio, Pecero, Zúñiga..."
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>

            {/* Filter 2: Folio */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Folio / Registro Municipal
              </label>
              <input
                type="text"
                value={filterFolio}
                onChange={(e) => {
                  setFilterFolio(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Ej. PAN-1980-00001"
                className="w-full px-3 py-1.5 text-xs font-mono-data border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>

            {/* Filter 3: Predio / Rancho */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Nombre del Predio / Rancho
              </label>
              <input
                type="text"
                value={filterProperty}
                onChange={(e) => {
                  setFilterProperty(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Ej. Huasteca, Roble, Herradura..."
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>

            {/* Filter 4: Ejido */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Ejido / Congregación
              </label>
              <select
                value={filterEjido}
                onChange={(e) => {
                  setFilterEjido(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="ALL">Todos los Ejidos y Extensiones ({ejidosList.length})</option>
                {ejidosList.map((ejido) => (
                  <option key={ejido} value={ejido}>
                    {ejido}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 5: Rango de Fechas */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Fecha Inicio Expedición
              </label>
              <input
                type="date"
                value={filterDateStart}
                onChange={(e) => {
                  setFilterDateStart(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Fecha Fin Expedición
              </label>
              <input
                type="date"
                value={filterDateEnd}
                onChange={(e) => {
                  setFilterDateEnd(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>

            {/* Filter 6: Clave UPP / CURP */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Clave UPP, CURP o RFC
              </label>
              <input
                type="text"
                value={filterUppCurp}
                onChange={(e) => {
                  setFilterUppCurp(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Ej. 30-123-1001 o CURP..."
                className="w-full px-3 py-1.5 text-xs font-mono-data border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>

            {/* Filter 7: Iniciales o Estilo de Fierro */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Letras Fierro
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={filterInitials}
                  onChange={(e) => {
                    setFilterInitials(e.target.value.toUpperCase());
                    setCurrentPage(1);
                  }}
                  placeholder="AG"
                  className="w-full px-2 py-1.5 text-xs font-cinzel font-bold text-center border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Orientación
                </label>
                <select
                  value={filterOrientation}
                  onChange={(e) => {
                    setFilterOrientation(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="ALL">Todas</option>
                  <option value="normal">Normal</option>
                  <option value="enlazado">Enlazado</option>
                  <option value="echado">Echado</option>
                  <option value="invertido">Invertido</option>
                  <option value="inclinado">Inclinado</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. DYNAMIC COUNTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 text-xs">
        <div className="text-stone-700">
          Mostrando{' '}
          <strong className="text-stone-900 font-mono-data">
            {paginatedRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
          </strong>{' '}
          a{' '}
          <strong className="text-stone-900 font-mono-data">
            {Math.min(currentPage * pageSize, filteredRecords.length)}
          </strong>{' '}
          de <strong className="text-stone-900 font-mono-data">{filteredRecords.length.toLocaleString()}</strong>{' '}
          registros encontrados
          {hasActiveFilters && (
            <span className="ml-1 text-amber-800 font-semibold">
              (Filtros activos sobre {database.length.toLocaleString()} registros)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-stone-500">Por página:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 border border-stone-300 rounded bg-white text-xs"
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* 4. RESULTS TABLE (Interactive Data Table) */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-100 text-stone-700 font-semibold uppercase tracking-wider border-b border-stone-200">
              <tr>
                <th className="py-3 px-3 w-16 text-center">Fierro</th>
                <th className="py-3 px-3">Folio Oficial</th>
                <th className="py-3 px-3">Productor / Titular</th>
                <th className="py-3 px-3">Predio / Ubicación</th>
                <th className="py-3 px-3">Fecha Exp.</th>
                <th className="py-3 px-3">Clave UPP</th>
                <th className="py-3 px-3">Huella / Vector</th>
                <th className="py-3 px-3">Estado</th>
                <th className="py-3 px-3 text-right">Acciones Oficiales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-500">
                    <p className="text-sm font-semibold">No se encontraron registros con los criterios especificados.</p>
                    <p className="text-xs text-stone-400 mt-1">
                      Intente modificar las palabras clave o presione "Limpiar Todo".
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-3 px-4 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-md text-xs font-semibold cursor-pointer"
                    >
                      Restablecer Filtros
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-2 px-3 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        {record.extractedBrandImage || record.imagen_base64 ? (
                          <div className="w-12 h-12 bg-white border border-stone-300 rounded flex items-center justify-center p-0.5 shrink-0 shadow-2xs overflow-hidden">
                            <img
                              src={record.extractedBrandImage || record.imagen_base64}
                              alt="Fierro Físico"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <TableBrandCanvas
                            initials={record.initials && !/\d{5,}/.test(record.initials) ? record.initials : 'S/F'}
                            topSymbol={record.topSymbol}
                            bottomSymbol={record.bottomSymbol}
                            orientation={record.orientation}
                          />
                        )}
                        <span className="text-[10px] font-mono font-bold text-amber-900 leading-none">
                          {record.registrationNumber || record.folio || `[ ${record.initials} ]`}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-mono-data whitespace-nowrap">
                      <span className="font-bold text-stone-900 block text-xs">{record.folio}</span>
                      <span className="block text-[10px] text-amber-800 font-mono font-bold">{record.registrationNumber}</span>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-stone-900 block">{record.ownerName}</span>
                        {record.isLocal && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                            ⭐ Local / Histórico
                          </span>
                        )}
                      </div>
                      {record.curp ? (
                        <span className="text-[10px] text-stone-600 font-mono-data block">CURP: {record.curp}</span>
                      ) : null}
                      {record.phone ? (
                        <span className="text-[10px] text-stone-400 font-mono-data block">Tel: {record.phone}</span>
                      ) : null}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-medium text-stone-800 block">{record.propertyName}</span>
                      <span className="text-stone-500 text-[11px]">
                        {record.ejido}, Pánuco ({record.surfaceHectares} Ha)
                      </span>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-stone-600 font-mono-data">
                      {record.issueDate}
                    </td>

                    <td className="py-2.5 px-3 font-mono-data whitespace-nowrap text-stone-700">
                      <span className="font-semibold text-xs">{record.uppKey}</span>
                      <span className="block text-[10px] text-stone-400 font-sans">
                        {record.cattleCount} {record.species}
                      </span>
                    </td>

                    {/* Nueva Columna: Huella Vectorial */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {record.vector_64d || record.brandVector ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-mono text-[10px] font-bold text-stone-800 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                            {record.hash_vector || computeVectorChecksum(record.vector_64d || record.brandVector || [])}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCompareSimilarity(record)}
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded shadow-2xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Comparar vector 64D contra los demás fierros en el padrón"
                          >
                            <Sparkles className="w-3 h-3 text-amber-900" />
                            <span>Comparar Similitud</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-stone-400 italic text-[11px]">Sin vector</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          record.status === 'Vigente'
                            ? 'bg-emerald-100 text-emerald-800'
                            : record.status === 'En Litigio'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setAuditoriaRecord(record)}
                        className="px-3 py-1.5 text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        title="Abrir panel de auditoria completa del expediente (imagenes, vector, pagos, antiduplicidad)"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Auditar Expediente</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-stone-50 px-4 py-3 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
          <div>
            Página <strong className="text-stone-900 font-mono-data">{currentPage}</strong> de{' '}
            <strong className="text-stone-900 font-mono-data">{totalPages || 1}</strong>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="px-2 py-1 border border-stone-300 rounded hover:bg-white disabled:opacity-30 cursor-pointer"
            >
              « Primera
            </button>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 border border-stone-300 rounded hover:bg-white disabled:opacity-30 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 border border-stone-300 rounded hover:bg-white disabled:opacity-30 cursor-pointer flex items-center gap-1"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-2 py-1 border border-stone-300 rounded hover:bg-white disabled:opacity-30 cursor-pointer"
            >
              Última »
            </button>
          </div>
        </div>
      </div>

      {/* P4-QR: Modal del escáner de QR */}
      <QrScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onScanSuccess={handleQrScanSuccess}
      />
      {/* Modal de Alerta y Auditoría Comparativa de Vectores 8x8 */}
      {/* FIX_AUDITORIA_MODAL: modal de auditoria completa por productor */}
      <ProductorAuditoriaModal
        isOpen={Boolean(auditoriaRecord)}
        onClose={() => setAuditoriaRecord(null)}
        record={auditoriaRecord}
        allRecords={combinedDatabase}
        onLoadRecordIntoCertificate={(rec) => {
          handleLoadRecord(rec);
        }}
        onCreatePaymentOrder={(rec) => {
          console.log('[Auditoria] Generar orden de cobro para:', rec.ownerName);
          // TODO: conectar con FinanceManager
        }}
        onNavigateToCertificado={() => {
          // FIX_TARJETA_CERTIFICADO: navegar al certificado desde el modal de auditoria
          onGoToCertificado();
        }}
      />

      <VectorComparisonModal
        isOpen={showComparisonModal}
        onClose={() => {
          setShowComparisonModal(false);
          setComparisonSourceRecord(null);
        }}
        sourceRecord={comparisonSourceRecord}
        allRecords={combinedDatabase}
        onSelectCandidateForCertificate={handleLoadRecord}
      />
    </div>
  );
};
