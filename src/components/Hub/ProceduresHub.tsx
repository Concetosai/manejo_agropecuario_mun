import React, { useState } from 'react';
import {
  PlusCircle,
  RefreshCw,
  FileX,
  FileText,
  Beef,
  DollarSign,
  Search,
  ArrowRight,
  ShieldCheck,
  Building2,
  Sparkles,
  FolderArchive,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MunicipalConfig, MunicipalUser, ProducerData, PreloadedOrderData } from '../../types';

export type ProcedureCategoryId = 'ALTA' | 'REVALIDACION' | 'BAJA' | 'CONSTANCIA' | 'DEGUELLO';

interface ProceduresHubProps {
  onNavigateTo: (view: string) => void;
  activeTab?: string;
  municipalConfig?: MunicipalConfig;
  currentUser?: MunicipalUser;
  currentProducer?: ProducerData;
  totalRegisteredRecords?: number;
}

export const ProceduresHub: React.FC<ProceduresHubProps> = ({
  onNavigateTo,
  activeTab = 'hub',
  municipalConfig,
  currentUser,
  currentProducer,
  totalRegisteredRecords = 4250,
}) => {


  // 5 Categorías principales de trámites oficiales de Pánuco
  const categories = [
    {
      id: 'ALTA' as const,
      title: 'ALTA DE FIERRO',
      subtitle: 'Registro de Marca de Herrar / Fierro Quemador',
      description: 'Alta de nuevo contribuyente ganadero, digitalización de marca, asignación de patente y orden de cobro.',
      icon: PlusCircle,
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-700',
      accentColor: 'emerald',
      badge: 'Nuevo Registro',
      tariff: '$450.00 MXN',
      concepts: ['Alta de Fierro Quemador', 'Pago de Constancia'],
      // subActions eliminado (modal deprecado)
    },
    {
      id: 'REVALIDACION' as const,
      title: 'REVALIDACIÓN',
      subtitle: 'Refrendo Anual y Actualización de Vigencia',
      description: 'Pago de anualidad de patente ganadera, verificación de vigencia y cálculo de recargo por pago extemporáneo.',
      icon: RefreshCw,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      accentColor: 'blue',
      badge: 'Ejercicio 2026',
      tariff: '$350.00 MXN',
      concepts: ['Revalidación Fierro Quemador', 'Multa por Pago Extemporáneo'],
      // subActions eliminado (modal deprecado)
    },
    {
      id: 'BAJA' as const,
      title: 'BAJA DE FIERRO',
      subtitle: 'Cancelación o Suspensión de Registro',
      description: 'Trámite de cancelación por cesión de derechos, defunción del titular, cambio de domicilio o baja definitiva.',
      icon: FileX,
      color: 'from-rose-500 to-red-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      textColor: 'text-rose-700',
      accentColor: 'rose',
      badge: 'Cancelación',
      tariff: '$200.00 MXN',
      concepts: ['Baja de Fierro Quemador'],
      // subActions eliminado (modal deprecado)
    },
    {
      id: 'CONSTANCIA' as const,
      title: 'CONSTANCIA',
      subtitle: 'Acreditación y Reposición de Patente',
      description: 'Emisión de constancias oficiales de propiedad ganadera y reposición por patentes extraviadas o deterioradas.',
      icon: FileText,
      color: 'from-amber-500 to-yellow-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-700',
      accentColor: 'amber',
      badge: 'Documentación Oficial',
      tariff: '$180.00 MXN',
      concepts: ['Pago de Constancia', 'Reposición por Patente Extraviada'],
      // subActions eliminado (modal deprecado)
    },
    {
      id: 'DEGUELLO' as const,
      title: 'DEGÜELLO',
      subtitle: 'Permisos de Sacrificio e Inspección Sanitaria',
      description: 'Verificación de fierro de procedencia, guía de tránsito pecuario, control sanitario y derechos de sacrificio en rastro.',
      icon: Beef,
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      accentColor: 'purple',
      badge: 'Control Sanitario',
      tariff: '$90.00 / cabeza',
      concepts: ['Derecho de Degüello y Control Sanitario', 'Guía de Tránsito'],
      // subActions eliminado (modal deprecado)
    },
  ];


  return (
    <div className="space-y-8 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-16">
      {/* 1. Encabezado Oficial Institucional Compacto y Elegante */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden border border-amber-500/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-amber-300 border border-white/10 shadow-sm">
            <Building2 size={14} className="text-amber-400" />
            <span>
              {municipalConfig?.municipalityName || 'H. Ayuntamiento Constitucional de Pánuco, Ver.'} · Tesorería Municipal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-cinzel text-white">
            Ventanilla Única de Trámites Ganaderos
          </h1>
          <p className="text-stone-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Plataforma oficial centralizada para la recaudación de derechos, registro de marcas de herrar, refrendos, constancias ganaderas y permisos de sacrificio en Pánuco, Veracruz.
          </p>
        </div>

        {/* Resumen de Métricas del Padrón y Trámites */}
        <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Padrón Pecuario</span>
            <span className="text-base sm:text-lg font-bold font-mono text-amber-300">
              {totalRegisteredRecords.toLocaleString()} Fierros
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Ejercicio Fiscal</span>
            <span className="text-base sm:text-lg font-bold font-mono text-emerald-300">2026 - 2029</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Operador en Turno</span>
            <span className="text-xs sm:text-sm font-semibold text-stone-200 truncate block">
              {currentUser?.fullName?.split(' ')[0] || 'Oficial'} ({currentUser?.badgeNumber || 'PAN-2026'})
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Jurisdicción</span>
            <span className="text-xs sm:text-sm font-semibold text-stone-200">19 Ejidos de Pánuco</span>
          </div>
        </div>
      </div>

      {/* 2. Sección Principal: Trámites Ganaderos Diarios (Alta, Revalidación, Baja) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500" size={20} />
            <h2 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight">
              Seleccione el Trámite a Realizar
            </h2>
          </div>
          <span className="text-xs font-bold text-stone-500 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
            Tarifario Oficial 2026
          </span>
        </div>

        {/* Fila Principal: Los 3 Trámites Operativos Clave (Alta, Revalidación, Baja) */}
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 mb-2.5 block">
            Trámites Principales de Registro y Patente:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {categories.slice(0, 3).map((cat) => {
              const IconComponent = cat.icon;
              return (
                <motion.div
                  key={cat.id}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => onNavigateTo(cat.id === 'ALTA' ? 'alta' : cat.id === 'REVALIDACION' ? 'revalidacion' : cat.id === 'BAJA' ? 'baja' : cat.id === 'CONSTANCIA' ? 'constancia' : 'deguello')}
                  className={`bg-white rounded-3xl p-6 border-2 ${cat.borderColor} shadow-md hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden`}
                >
                  {/* Banner superior de color gradiente */}
                  <div className={`absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r ${cat.color}`} />

                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-14 h-14 rounded-2xl ${cat.bgColor} ${cat.textColor} flex items-center justify-center font-bold shadow-inner`}
                      >
                        <IconComponent size={28} />
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${cat.bgColor} ${cat.textColor} border ${cat.borderColor}`}
                        >
                          {cat.badge}
                        </span>
                        <span className="block text-[11px] font-mono font-bold text-stone-700 mt-1">
                          {cat.tariff}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-black text-stone-900 group-hover:text-amber-800 transition-colors">
                        {cat.title}
                      </h3>
                      <p className="text-xs font-bold text-stone-400 mt-0.5">{cat.subtitle}</p>
                      <p className="text-xs text-stone-600 mt-2 leading-relaxed">{cat.description}</p>
                    </div>

                    {/* Conceptos incluidos */}
                    <div className="pt-2 border-t border-stone-100">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                        Conceptos Oficiales de Cobro:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {cat.concepts.map((concept, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium bg-stone-50 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200"
                          >
                            • {concept}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Botón de Acción */}
                  <div className="pt-5 mt-4 border-t border-stone-100 flex items-center justify-between">
                    <span className={`text-xs font-bold ${cat.textColor}`}>Iniciar Trámite</span>
                    <div
                      className={`w-8 h-8 rounded-full ${cat.bgColor} ${cat.textColor} flex items-center justify-center group-hover:translate-x-1 transition-transform`}
                    >
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Fila Secundaria: Trámites Complementarios (Constancia y Degüello) */}
        <div className="pt-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 mb-2.5 block">
            Trámites Complementarios de Sanidad y Acreditación:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {categories.slice(3, 5).map((cat) => {
              const IconComponent = cat.icon;
              return (
                <motion.div
                  key={cat.id}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => onNavigateTo(cat.id === 'ALTA' ? 'alta' : cat.id === 'REVALIDACION' ? 'revalidacion' : cat.id === 'BAJA' ? 'baja' : cat.id === 'CONSTANCIA' ? 'constancia' : 'deguello')}
                  className={`bg-white rounded-3xl p-6 border ${cat.borderColor} shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden`}
                >
                  {/* Banner superior de color gradiente */}
                  <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${cat.color}`} />

                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-14 h-14 rounded-2xl ${cat.bgColor} ${cat.textColor} flex items-center justify-center font-bold shadow-inner`}
                      >
                        <IconComponent size={28} />
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${cat.bgColor} ${cat.textColor} border ${cat.borderColor}`}
                        >
                          {cat.badge}
                        </span>
                        <span className="block text-[11px] font-mono font-bold text-stone-700 mt-1">
                          {cat.tariff}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-black text-stone-900 group-hover:text-amber-800 transition-colors">
                        {cat.title}
                      </h3>
                      <p className="text-xs font-bold text-stone-400 mt-0.5">{cat.subtitle}</p>
                      <p className="text-xs text-stone-600 mt-2 leading-relaxed">{cat.description}</p>
                    </div>

                    {/* Conceptos incluidos */}
                    <div className="pt-2 border-t border-stone-100">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                        Conceptos Oficiales de Cobro:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {cat.concepts.map((concept, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium bg-stone-50 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200"
                          >
                            • {concept}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Botón de Acción */}
                  <div className="pt-5 mt-4 border-t border-stone-100 flex items-center justify-between">
                    <span className={`text-xs font-bold ${cat.textColor}`}>Iniciar Trámite</span>
                    <div
                      className={`w-8 h-8 rounded-full ${cat.bgColor} ${cat.textColor} flex items-center justify-center group-hover:translate-x-1 transition-transform`}
                    >
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Módulos Complementarios de Navegación Rápida */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest">
            Módulos del Sistema Ganadero Municipal
          </h3>
          <span className="text-[11px] text-stone-400">Acceso Directo a Submódulos</span>
        </div>

        {/* BUSCADOR DESTACADO — Tarjeta grande ámbar arriba */}
        <button
          onClick={() => onNavigateTo('buscador')}
          className={`w-full p-5 sm:p-6 rounded-3xl border-2 text-left transition-all cursor-pointer group relative overflow-hidden shadow-lg hover:shadow-2xl ${
            activeTab === 'buscador'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-700 ring-4 ring-amber-400/40'
              : 'bg-gradient-to-r from-amber-400 to-amber-500 border-amber-600 hover:from-amber-500 hover:to-amber-600'
          }`}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/25 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
                <Search className="text-white" size={28} />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/80 block">
                  Consulta Rápida del Padrón
                </span>
                <h3 className="text-lg sm:text-2xl font-black font-cinzel text-white leading-tight">
                  BUSCADOR DE FIERROS
                </h3>
                <p className="text-xs sm:text-sm text-amber-50 font-medium mt-0.5">
                  Padrón Municipal · Búsqueda por Folio, CURP, RFC o Nombre del Productor
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-white/90 bg-white/20 px-3 py-1.5 rounded-full border border-white/30">
                Acceder
              </span>
              <ArrowRight className="text-white group-hover:translate-x-1 transition-transform" size={24} />
            </div>
            <ArrowRight className="sm:hidden text-white group-hover:translate-x-1 transition-transform shrink-0" size={22} />
          </div>
        </button>

        {/* CUADRÍCULA DE MÓDULOS SECUNDARIOS (5 botones) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => onNavigateTo('registro')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'registro'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <PlusCircle className="text-emerald-700 mb-1.5" size={18} />
            <p className="text-xs font-bold text-stone-900 truncate">1. Registro</p>
            <p className="text-[10px] text-stone-500 truncate">Alta y Fotografía</p>
          </button>

          <button
            onClick={() => onNavigateTo('creador')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'creador'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Sparkles className="text-amber-700 mb-1.5" size={18} />
            <p className="text-xs font-bold text-stone-900 truncate">2. Creador</p>
            <p className="text-[10px] text-stone-500 truncate">Forja de Fierro</p>
          </button>

          <button
            onClick={() => onNavigateTo('certificado')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'certificado'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Printer className="text-indigo-700 mb-1.5" size={18} />
            <p className="text-xs font-bold text-stone-900 truncate">5. Certificado</p>
            <p className="text-[10px] text-stone-500 truncate">Credencial CR-80</p>
          </button>

          <button
            onClick={() => onNavigateTo('digitalizacion')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'digitalizacion'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <FolderArchive className="text-amber-700 mb-1.5" size={18} />
            <p className="text-xs font-bold text-stone-900 truncate">9. Digitalización</p>
            <p className="text-[10px] text-stone-500 truncate">OCR Archivo Histórico</p>
          </button>

          <button
            onClick={() => onNavigateTo('finanzas')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'finanzas'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <DollarSign className="text-emerald-700 mb-1.5" size={18} />
            <p className="text-xs font-bold text-stone-900 truncate">10. Finanzas</p>
            <p className="text-[10px] text-stone-500 truncate">Órdenes de Cobro</p>
          </button>
        </div>
      </div>

    </div>
  );
};
