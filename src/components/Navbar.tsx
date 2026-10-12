import React from 'react';
import {
  Search,
  Printer,
  Sparkles,
  ShieldCheck,
  FolderArchive,
  Landmark,
  Building2,
  ArrowLeft,
  Settings,
  DollarSign,
  Fingerprint,
} from 'lucide-react';
import { MunicipalUser } from '../types';
import { getStoredBiometricCredentials } from '../services/biometricsService';

export type AppTab =
  | 'hub'
  | 'alta'
  | 'registro'
  | 'revalidacion'
  | 'baja'
  | 'constancia'
  | 'deguello'
  | 'creador'
  | 'buscador'
  | 'antiduplicidad'
  | 'certificado'
  | 'reportes'
  | 'auditoria'
  | 'configuracion'
  | 'settings'
  | 'digitalizacion'
  | 'finanzas'
  | 'finance';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  currentUser: MunicipalUser;
  onOpenAuth: () => void;
  onQuickPrint: () => void;
  onGenerateUnique: () => void;
}

const VIEW_METADATA: Record<string, { title: string; subtitle: string; badge: string; color: string }> = {
  alta: {
    title: 'Alta de Fierro Quemador',
    subtitle: 'Registro Municipal Pecuario (Hojas 1 a 4)',
    badge: 'Trámite 1 de 5',
    color: 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40',
  },
  registro: {
    title: 'Alta de Fierro Quemador',
    subtitle: 'Registro Municipal Pecuario (Hojas 1 a 4)',
    badge: 'Trámite 1 de 5',
    color: 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40',
  },
  revalidacion: {
    title: 'Revalidación y Refrendo',
    subtitle: 'Vigencia de Patente y Anualidad 2026',
    badge: 'Trámite 2 de 5',
    color: 'bg-blue-900/60 text-blue-300 border-blue-500/40',
  },
  baja: {
    title: 'Baja y Cancelación de Fierro',
    subtitle: 'Cancelación Registral y Acta Oficial',
    badge: 'Trámite 3 de 5',
    color: 'bg-rose-900/60 text-rose-300 border-rose-500/40',
  },
  constancia: {
    title: 'Expedición de Constancias',
    subtitle: 'Acreditación y Reposición Ganadera',
    badge: 'Trámite 4 de 5',
    color: 'bg-amber-900/60 text-amber-300 border-amber-500/40',
  },
  deguello: {
    title: 'Permiso de Degüello',
    subtitle: 'Control Sanitario e Inspección Pecuaria',
    badge: 'Trámite 5 de 5',
    color: 'bg-purple-900/60 text-purple-300 border-purple-500/40',
  },
  finanzas: {
    title: 'Tesorería Municipal',
    subtitle: 'Órdenes de Cobro y Recaudación de Derechos',
    badge: 'Finanzas',
    color: 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40',
  },
  finance: {
    title: 'Tesorería Municipal',
    subtitle: 'Órdenes de Cobro y Recaudación de Derechos',
    badge: 'Finanzas',
    color: 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40',
  },
  settings: {
    title: 'Ajustes Municipales',
    subtitle: 'Firmas Oficiales y Parámetros del Sistema',
    badge: 'Ajustes',
    color: 'bg-stone-800 text-stone-300 border-stone-600',
  },
  configuracion: {
    title: 'Ajustes Municipales',
    subtitle: 'Firmas Oficiales y Parámetros del Sistema',
    badge: 'Ajustes',
    color: 'bg-stone-800 text-stone-300 border-stone-600',
  },
  digitalizacion: {
    title: 'Digitalización Histórica',
    subtitle: 'Motor OCR y Vectorización de Marcas Tradicionales',
    badge: 'Archivo Histórico',
    color: 'bg-amber-900/60 text-amber-300 border-amber-500/40',
  },
  creador: {
    title: 'Forja y Monogramas',
    subtitle: 'Diseñador Vectorial de Fierro de Herrar',
    badge: 'Creador',
    color: 'bg-amber-900/60 text-amber-300 border-amber-500/40',
  },
  buscador: {
    title: 'Buscador Histórico',
    subtitle: 'Padrón Municipal de Fierros Registrados',
    badge: 'Padrón',
    color: 'bg-blue-900/60 text-blue-300 border-blue-500/40',
  },
  certificado: {
    title: 'Credencial y Certificado',
    subtitle: 'Título Oficial de Registro y Tarjetón CR-80',
    badge: 'Certificado',
    color: 'bg-indigo-900/60 text-indigo-300 border-indigo-500/40',
  },
  antiduplicidad: {
    title: 'Validación Antiduplicidad',
    subtitle: 'Algoritmo de Similitud Geométrica',
    badge: 'Antiduplicidad',
    color: 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40',
  },
  reportes: {
    title: 'Reportes Semestrales',
    subtitle: 'Libros y Estadísticas de Registro',
    badge: 'Reportes',
    color: 'bg-stone-800 text-stone-300 border-stone-600',
  },
  auditoria: {
    title: 'Bitácora de Auditoría',
    subtitle: 'Registro Inmutable de Operaciones',
    badge: 'Auditoría',
    color: 'bg-stone-800 text-stone-300 border-stone-600',
  },
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenAuth,
  onQuickPrint,
  onGenerateUnique,
}) => {
  const isHub = activeTab === 'hub';
  const meta = VIEW_METADATA[activeTab] || VIEW_METADATA['alta'];

  return (
    <header className="no-print sticky top-0 z-40 bg-stone-900 border-b border-stone-800 text-stone-100 shadow-md w-full">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Left Section: Context Dependent */}
        {isHub ? (
          /* Hub Branding */
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 text-white flex items-center justify-center font-cinzel font-black text-sm shadow-md border border-amber-400/30 shrink-0">
              PV
            </div>
            <div>
              <span className="text-[10px] text-amber-400/90 font-bold uppercase tracking-wider block">
                H. Ayuntamiento Constitucional de Pánuco, Ver.
              </span>
              <h1 className="text-sm sm:text-base font-cinzel font-bold tracking-wider text-amber-400 leading-tight">
                SISTEMA DE FIERRO QUEMADOR Y TESORERÍA
              </h1>
            </div>
          </div>
        ) : (
          /* Sub-Module Back Button & Title */
          <div className="flex items-center gap-3 truncate">
            <button
              type="button"
              onClick={() => onSelectTab('hub')}
              className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 active:scale-95 rounded-xl shadow-md transition-all cursor-pointer shrink-0 border border-amber-300"
              title="Volver al Hub de Trámites Ganaderos"
            >
              <ArrowLeft className="w-4 h-4 text-amber-950" />
              <span className="hidden sm:inline">← Volver al Hub</span>
              <span className="sm:hidden">← Hub</span>
            </button>

            <div className="h-6 w-px bg-stone-800 hidden sm:block shrink-0" />

            {/* Current View Title & Badge */}
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.color} shrink-0`}
                >
                  {meta.badge}
                </span>
                <span className="text-xs sm:text-sm font-bold text-white truncate font-cinzel">
                  {meta.title}
                </span>
              </div>
              <p className="text-[10px] text-stone-400 truncate hidden md:block">
                {meta.subtitle}
              </p>
            </div>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* BUSCADOR — Siempre visible, destacado ámbar */}
          <button
            type="button"
            onClick={() => onSelectTab('buscador')}
            title="Buscador del Padrón Municipal de Fierros (Folio, CURP, RFC o Nombre)"
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer shrink-0 border ${
              activeTab === 'buscador'
                ? 'bg-amber-300 text-amber-950 border-amber-200 ring-2 ring-amber-300/60'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white border-amber-400'
            }`}
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline font-extrabold tracking-wide">BUSCADOR</span>
            <span className="sm:hidden font-extrabold">Buscar</span>
          </button>
          {/* If on Hub, show quick shortcuts to Finance, Historical OCR and Settings */}
          {isHub && (
            <>
              <button
                type="button"
                onClick={() => onSelectTab('finanzas')}
                title="Gestión de Finanzas y Órdenes de Cobro Municipal"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-stone-200 bg-stone-800 hover:bg-stone-700 border border-stone-700 transition-colors cursor-pointer"
              >
                <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xs:inline">Finanzas</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('digitalizacion')}
                title="Digitalizar documentos físicos tradicionales y crear base de datos"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 transition-colors cursor-pointer"
              >
                <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                <span>Digitalizar Histórico</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('configuracion')}
                title="Configuración de Parámetros Oficiales"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl text-stone-300 bg-stone-800 hover:bg-stone-700 border border-stone-700 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-stone-400" />
                <span className="hidden xs:inline">Ajustes</span>
              </button>
            </>
          )}

          {/* Quick Print Button (visible on Certificate, Alta/Registro or Constancia) */}
          {(activeTab === 'certificado' || activeTab === 'registro' || activeTab === 'alta') && (
            <button
              onClick={onQuickPrint}
              title="Vista e impresión directa del certificado e ID ganadera"
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl shadow transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="text-[11px] sm:text-xs">Imprimir</span>
            </button>
          )}

          {/* Operator Badge (Always accessible) */}
          {(() => {
            const hasBio = getStoredBiometricCredentials(currentUser.id).length > 0;
            return (
              <button
                type="button"
                onClick={onOpenAuth}
                title={hasBio ? 'Sesión con huella digital activa' : 'Gestionar sesión y huella digital'}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs transition-colors cursor-pointer shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline font-semibold text-stone-200 truncate max-w-[120px]">
                  {currentUser.fullName.split(' ')[0]} {currentUser.fullName.split(' ')[1] || ''}
                </span>
                <span className="sm:hidden text-[10px] text-amber-400 font-semibold">Gafete</span>
                {hasBio && (
                  <span className="inline-flex items-center text-emerald-400" title="Huella dactilar activa">
                    <Fingerprint className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })()}
        </div>
      </div>
    </header>
  );
};
