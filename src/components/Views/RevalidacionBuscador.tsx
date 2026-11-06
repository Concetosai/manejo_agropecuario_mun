import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  User,
  MapPin,
  Award,
  Phone,
  Mail,
  Building2,
  Loader2,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { GoogleRegistro } from '../../services/googleSheetsService';

interface RevalidacionBuscadorProps {
  registros: GoogleRegistro[];
  onSelect: (registro: GoogleRegistro) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

/**
 * FASE_REVALIDACION_BUSCADOR: Buscador inteligente multi-criterio
 * 
 * Filtra en vivo por:
 * - Nombre (búsqueda parcial case-insensitive)
 * - CURP
 * - RFC
 * - INE
 * - Folio (PAN-2026-XXXXX)
 * - Ejido
 * - Email
 * - Teléfono
 * - Predio
 */
export const RevalidacionBuscador: React.FC<RevalidacionBuscadorProps> = ({
  registros,
  onSelect,
  isLoading = false,
  onRefresh,
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filtroEstatus, setFiltroEstatus] = useState<'ALL' | 'ACTIVO' | 'REVALIDADO' | 'CANCELADO'>('ALL');
  const [filtroEjido, setFiltroEjido] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Debounce de 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Normalizar texto (sin acentos, minúsculas)
  const normalize = (str?: string): string => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // Lista de ejidos únicos para el filtro
  const ejidosUnicos = useMemo(() => {
    const set = new Set<string>();
    registros.forEach((r) => {
      if (r.ejido) set.add(String(r.ejido).toUpperCase());
    });
    return Array.from(set).sort();
  }, [registros]);

  // Filtrar registros
  const resultados = useMemo(() => {
    const q = normalize(debouncedQuery);

    // Si no hay query ni filtros, mostrar últimos 20
    const filtered = registros.filter((r) => {
      // Filtro por estatus
      if (filtroEstatus !== 'ALL') {
        const estatus = String(r.estatus || 'ACTIVO').toUpperCase();
        if (estatus !== filtroEstatus) return false;
      }

      // Filtro por ejido
      if (filtroEjido) {
        const ejido = normalize(r.ejido);
        if (ejido !== normalize(filtroEjido)) return false;
      }

      // Si no hay query, aplicar solo filtros
      if (!q) return true;

      // Buscar en múltiples campos
      const haystack = [
        r.nombre_productor,
        r.curp,
        r.rfc,
        r.ine,
        r.folio,
        r.ejido,
        r.email,
        r.telefono,
        r.predio,
        r.numero_registro,
        r.upp,
      ]
        .map((v) => normalize(v))
        .join(' | ');

      return haystack.includes(q);
    });

    // Ordenar: primero los que empiezan con el query
    if (q) {
      filtered.sort((a, b) => {
        const aName = normalize(a.nombre_productor);
        const bName = normalize(b.nombre_productor);
        const aStarts = aName.startsWith(q) ? 0 : 1;
        const bStarts = bName.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return aName.localeCompare(bName);
      });
    }

    return filtered.slice(0, 30);
  }, [registros, debouncedQuery, filtroEstatus, filtroEjido]);

  const handleSelect = (registro: GoogleRegistro) => {
    onSelect(registro);
    setIsOpen(false);
    setQuery('');
    setDebouncedQuery('');
  };

  const handleLimpiar = () => {
    setQuery('');
    setDebouncedQuery('');
    setFiltroEstatus('ALL');
    setFiltroEjido('');
  };

  const hayFiltrosActivos = filtroEstatus !== 'ALL' || filtroEjido !== '';

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Barra de búsqueda principal */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Buscar por nombre, CURP, RFC, INE, folio, ejido, email, teléfono o predio..."
            className="w-full pl-10 pr-10 py-3 bg-white border-2 border-stone-300 rounded-xl text-sm font-medium text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setDebouncedQuery('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isLoading && (
            <Loader2 className="w-4 h-4 absolute right-10 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />
          )}
        </div>

        {/* Botón filtros */}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border-2 ${
            showFilters || hayFiltrosActivos
              ? 'bg-blue-700 text-white border-blue-700'
              : 'bg-white text-stone-700 border-stone-300 hover:border-blue-500'
          }`}
          title="Filtros adicionales"
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filtros</span>
          {hayFiltrosActivos && (
            <span className="w-5 h-5 rounded-full bg-white text-blue-700 text-[10px] font-bold flex items-center justify-center">
              {(filtroEstatus !== 'ALL' ? 1 : 0) + (filtroEjido ? 1 : 0)}
            </span>
          )}
        </button>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-3 rounded-xl text-xs font-bold bg-white text-stone-700 border-2 border-stone-300 hover:border-blue-500 transition-colors cursor-pointer"
            title="Recargar padrón desde Sheets"
          >
            <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Filtros adicionales */}
      {showFilters && (
        <div className="mt-2 p-3 bg-stone-50 border border-stone-200 rounded-xl flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-stone-600 uppercase">Estatus:</span>
            <select
              value={filtroEstatus}
              onChange={(e) => setFiltroEstatus(e.target.value as any)}
              className="px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVO">Activos</option>
              <option value="REVALIDADO">Revalidados</option>
              <option value="CANCELADO">Cancelados</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-stone-600 uppercase">Ejido:</span>
            <select
              value={filtroEjido}
              onChange={(e) => setFiltroEjido(e.target.value)}
              className="px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-semibold cursor-pointer min-w-[150px]"
            >
              <option value="">Todos</option>
              {ejidosUnicos.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={handleLimpiar}
              className="ml-auto px-2.5 py-1 text-xs font-bold text-rose-700 hover:text-rose-950 hover:bg-rose-50 rounded transition-colors cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Dropdown de resultados */}
      {isOpen && (
        <div className="absolute z-40 mt-2 w-full max-h-96 overflow-y-auto bg-white border-2 border-stone-300 rounded-xl shadow-2xl">
          {isLoading ? (
            <div className="p-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <span className="text-xs text-stone-600">Cargando padrón desde Sheets...</span>
            </div>
          ) : resultados.length === 0 ? (
            <div className="p-6 text-center">
              <Search className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-700">
                {debouncedQuery ? 'Sin coincidencias' : 'Escriba para buscar'}
              </p>
              <p className="text-[11px] text-stone-500 mt-1">
                {debouncedQuery
                  ? `No se encontró "${debouncedQuery}" en el padrón municipal`
                  : 'Puede buscar por nombre, CURP, RFC, folio, ejido y más'}
              </p>
            </div>
          ) : (
            <>
              <div className="p-2 bg-stone-50 border-b border-stone-200 text-[10px] font-bold text-stone-500 uppercase tracking-wider sticky top-0">
                {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
                {debouncedQuery && (
                  <span className="ml-1 text-blue-700 normal-case">
                    para "{debouncedQuery}"
                  </span>
                )}
              </div>
              {resultados.map((r, idx) => {
                const estatus = String(r.estatus || 'ACTIVO').toUpperCase();
                const estatusColor =
                  estatus === 'REVALIDADO'
                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                    : estatus === 'CANCELADO'
                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300';

                return (
                  <button
                    key={`${r.folio}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(r)}
                    className="w-full text-left p-3 hover:bg-blue-50 border-b border-stone-100 transition-colors cursor-pointer flex items-start gap-3"
                  >
                    {/* Avatar con iniciales */}
                    <div className="w-11 h-11 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center font-cinzel font-black text-sm shrink-0 border border-amber-500/30">
                      {r.iniciales || '??'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-stone-900 truncate">
                          {r.nombre_productor || 'Sin nombre'}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${estatusColor}`}>
                          {estatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[11px] text-stone-600">
                        <span className="font-mono font-bold text-amber-900 truncate">
                          {r.folio}
                        </span>
                        <span className="truncate">
                          Ejido: <strong className="text-stone-800">{r.ejido || 'N/D'}</strong>
                        </span>
                        <span className="font-mono truncate">
                          CURP: {r.curp ? String(r.curp).slice(0, 8) + '...' : 'N/D'}
                        </span>
                        <span className="truncate">
                          Vigencia: <strong className="text-stone-800">{r.vigencia || 'N/D'}</strong>
                        </span>
                      </div>
                    </div>

                    <CheckCircle2 className="w-4 h-4 text-stone-300 shrink-0 mt-1" />
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};