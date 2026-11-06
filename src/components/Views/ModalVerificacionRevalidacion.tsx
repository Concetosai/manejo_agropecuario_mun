import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Check,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Save,
  User,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Home,
  Award,
  Hash,
  Calendar,
  FileText,
  Camera,
  Package,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { GoogleRegistro } from '../../services/googleSheetsService';
import { RequisitoItem } from '../../utils/requisitosConfig';

export interface CamposEditados {
  [campo: string]: {
    anterior: string;
    nuevo: string;
  };
}

interface ModalVerificacionRevalidacionProps {
  isOpen: boolean;
  onClose: () => void;
  registro: GoogleRegistro;
  requisitos: RequisitoItem[];
  onConfirm: (resultado: {
    camposEditados: CamposEditados;
    requisitosMarcados: string[];
    totalCriticos: number;
  }) => void;
}

interface CampoConfig {
  key: keyof GoogleRegistro | 'vigencia_nueva';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  grupo: 'titular' | 'domicilio' | 'predio' | 'asiento';
  tipo?: 'text' | 'date' | 'readonly';
  esVigenciaCalculada?: boolean;
}

const CAMPOS_CONFIG: CampoConfig[] = [
  // Titular
  { key: 'nombre_productor', label: 'Nombre Completo', icon: User, grupo: 'titular' },
  { key: 'curp', label: 'CURP', icon: CreditCard, grupo: 'titular' },
  { key: 'rfc', label: 'RFC', icon: FileText, grupo: 'titular' },
  { key: 'ine', label: 'INE (Clave de Elector)', icon: CreditCard, grupo: 'titular' },
  { key: 'telefono', label: 'Teléfono', icon: Phone, grupo: 'titular' },
  { key: 'email', label: 'Email', icon: Mail, grupo: 'titular' },

  // Domicilio
  { key: 'domicilio', label: 'Domicilio', icon: Home, grupo: 'domicilio' },
  { key: 'ejido', label: 'Ejido / Congregación', icon: MapPin, grupo: 'domicilio' },

  // Predio
  { key: 'predio', label: 'Predio / Rancho', icon: Home, grupo: 'predio' },
  { key: 'upp', label: 'Clave UPP', icon: Hash, grupo: 'predio' },
  { key: 'cantidad_ganado', label: 'Cantidad de Ganado', icon: Award, grupo: 'predio' },

  // Asiento
  { key: 'vigencia', label: 'Vigencia Actual', icon: Calendar, grupo: 'asiento', tipo: 'readonly' },
  { key: 'vigencia_nueva', label: 'Nueva Vigencia (+3 años)', icon: Calendar, grupo: 'asiento', esVigenciaCalculada: true },
  { key: 'numero_registro', label: 'No. Registro', icon: Hash, grupo: 'asiento', tipo: 'readonly' },
];

const GRUPO_LABELS: Record<string, string> = {
  titular: 'Datos del Titular',
  domicilio: 'Domicilio y Ubicación',
  predio: 'Predio y Producción',
  asiento: 'Asiento Registral',
};

const GRUPO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  titular: User,
  domicilio: MapPin,
  predio: Home,
  asiento: Award,
};

/**
 * FASE_REVALIDACION_VERIFICACION: Modal de verificación con campos editables + checklist
 */
export const ModalVerificacionRevalidacion: React.FC<ModalVerificacionRevalidacionProps> = ({
  isOpen,
  onClose,
  registro,
  requisitos,
  onConfirm,
}) => {
  // ═══ ESTADO DE CAMPOS ═══
  const [camposActuales, setCamposActuales] = useState<Record<string, string>>({});
  const [camposOriginales, setCamposOriginales] = useState<Record<string, string>>({});
  const [camposVerificados, setCamposVerificados] = useState<Set<string>>(new Set());
  const [editandoCampo, setEditandoCampo] = useState<string | null>(null);
  const [valorTemp, setValorTemp] = useState<string>('');

  // ═══ ESTADO DE CHECKLIST ═══
  const [requisitosMarcados, setRequisitosMarcados] = useState<Set<string>>(new Set());

  // ═══ CALCULAR NUEVA VIGENCIA ═══
  const calcularNuevaVigencia = (vigenciaActual?: string): string => {
    const añoActual = new Date().getFullYear();
    const añoFinal = añoActual + 3;
    if (!vigenciaActual) return `${añoActual}-${añoFinal}`;
    const match = String(vigenciaActual).match(/(\d{4})\s*[-–]\s*(\d{4})/);
    if (match && match[2]) {
      const finalActual = parseInt(match[2], 10);
      if (finalActual >= añoActual) {
        return `${finalActual}-${finalActual + 3}`;
      }
    }
    return `${añoActual}-${añoFinal}`;
  };

  // ═══ INICIALIZAR AL ABRIR ═══
  useEffect(() => {
    if (!isOpen || !registro) return;

    const valores: Record<string, string> = {};
    CAMPOS_CONFIG.forEach((c) => {
      if (c.esVigenciaCalculada) {
        valores[c.key as string] = calcularNuevaVigencia(registro.vigencia);
      } else {
        const valor = (registro as any)[c.key];
        valores[c.key as string] = valor !== null && valor !== undefined ? String(valor) : '';
      }
    });

    setCamposActuales(valores);
    setCamposOriginales({ ...valores });
    setCamposVerificados(new Set());
    setRequisitosMarcados(new Set());
    setEditandoCampo(null);
  }, [isOpen, registro]);

  // ═══ CAMPOS POR GRUPO ═══
  const camposPorGrupo = useMemo(() => {
    const grupos: Record<string, CampoConfig[]> = {};
    CAMPOS_CONFIG.forEach((c) => {
      if (!grupos[c.grupo]) grupos[c.grupo] = [];
      grupos[c.grupo].push(c);
    });
    return grupos;
  }, []);

  // ═══ REQUISITOS CRÍTICOS FALTANTES ═══
  const criticosFaltantes = useMemo(() => {
    return requisitos.filter((r) => r.critico && !requisitosMarcados.has(r.id));
  }, [requisitos, requisitosMarcados]);

  // ═══ CAMPOS SIN VERIFICAR ═══
  const camposSinVerificar = useMemo(() => {
    return CAMPOS_CONFIG.filter((c) => {
      if (c.tipo === 'readonly') return false;
      return !camposVerificados.has(c.key as string);
    });
  }, [camposVerificados]);

  // ═══ DETECTAR CAMBIOS ═══
  const cambiosDetectados = useMemo((): CamposEditados => {
    const cambios: CamposEditados = {};
    Object.keys(camposActuales).forEach((key) => {
      const original = camposOriginales[key] || '';
      const actual = camposActuales[key] || '';
      if (original !== actual) {
        cambios[key] = { anterior: original, nuevo: actual };
      }
    });
    return cambios;
  }, [camposActuales, camposOriginales]);

  const totalCambios = Object.keys(cambiosDetectados).length;

  // ═══ PUEDE CONFIRMAR ═══
  const puedeConfirmar = criticosFaltantes.length === 0 && camposSinVerificar.length === 0;

  // ═══ HELPERS ═══
  const toggleCampoVerificado = (key: string) => {
    setCamposVerificados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRequisito = (id: string) => {
    setRequisitosMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const iniciarEdicion = (key: string) => {
    setEditandoCampo(key);
    setValorTemp(camposActuales[key] || '');
  };

  const guardarEdicion = () => {
    if (!editandoCampo) return;
    setCamposActuales((prev) => ({ ...prev, [editandoCampo]: valorTemp.toUpperCase() }));
    setCamposVerificados((prev) => new Set(prev).add(editandoCampo));
    setEditandoCampo(null);
    setValorTemp('');
  };

  const cancelarEdicion = () => {
    setEditandoCampo(null);
    setValorTemp('');
  };

  const handleConfirmar = () => {
    if (!puedeConfirmar) return;
    onConfirm({
      camposEditados: cambiosDetectados,
      requisitosMarcados: Array.from(requisitosMarcados),
      totalCriticos: requisitosMarcados.size,
    });
  };

  const handleMarcarTodosRequisitos = () => {
    setRequisitosMarcados(new Set(requisitos.map((r) => r.id)));
  };

  const handleVerificarTodosCampos = () => {
    const all = new Set(CAMPOS_CONFIG.filter((c) => c.tipo !== 'readonly').map((c) => c.key as string));
    setCamposVerificados(all);
  };

  // 🔥 MASTER_CHECKBOX_1: Verificar TODOS los campos de la Sección 1 (toggle)
  const toggleTodosCampos = (marcar: boolean) => {
    if (marcar) {
      const all = new Set(CAMPOS_CONFIG.filter((c) => c.tipo !== 'readonly').map((c) => c.key as string));
      setCamposVerificados(all);
    } else {
      setCamposVerificados(new Set());
    }
  };

  // 🔥 MASTER_CHECKBOX_2: Marcar TODOS los requisitos de la Sección 2 (toggle)
  const toggleTodosRequisitos = (marcar: boolean) => {
    if (marcar) {
      setRequisitosMarcados(new Set(requisitos.map((r) => r.id)));
    } else {
      setRequisitosMarcados(new Set());
    }
  };

  // Estados de los checkboxes maestros
  const totalCamposVerificables = CAMPOS_CONFIG.filter((c) => c.tipo !== 'readonly').length;
  const todosCamposMarcados = camposVerificados.size === totalCamposVerificables && totalCamposVerificables > 0;
  const algunCampoMarcado = camposVerificados.size > 0 && !todosCamposMarcados;

  const todosRequisitosMarcados = requisitosMarcados.size === requisitos.length && requisitos.length > 0;
  const algunRequisitoMarcado = requisitosMarcados.size > 0 && !todosRequisitosMarcados;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden border-2 border-blue-700">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-200 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-200 block">
                Paso 2 de 4 · Verificación de Datos
              </span>
              <h3 className="text-base sm:text-lg font-cinzel font-bold text-white">
                Revalidación de {registro.nombre_productor || 'Productor'}
              </h3>
              <p className="text-[11px] text-blue-100 font-mono">
                Folio: {registro.folio} · REG: {registro.numero_registro || '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BARRA DE PROGRESO */}
        <div className={`px-4 sm:px-6 py-3 border-b-2 ${puedeConfirmar ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {puedeConfirmar ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              )}
              <div>
                <p className={`text-sm font-bold ${puedeConfirmar ? 'text-emerald-900' : 'text-amber-900'}`}>
                  {puedeConfirmar
                    ? '✅ Todo verificado. Puede continuar.'
                    : `⚠️ Faltan ${camposSinVerificar.length} campo(s) y ${criticosFaltantes.length} requisito(s) crítico(s)`}
                </p>
                <p className="text-[11px] text-stone-600">
                  {camposVerificados.size}/{totalCamposVerificables} campos verificados
                  {' · '}
                  {requisitosMarcados.size}/{requisitos.length} requisitos marcados
                  {totalCambios > 0 && (
                    <span className="ml-2 text-blue-700 font-bold">
                      📝 {totalCambios} cambio(s) detectado(s)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto bg-stone-50 p-4 sm:p-6 space-y-5">

          {/* ═══ SECCIÓN 1: CAMPOS DEL PRODUCTOR ═══ */}
          <div className="bg-white border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-100">
              <User className="w-4 h-4 text-blue-700" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Sección 1 · Verificación de Datos del Productor
              </h4>
              <span className="ml-auto text-[10px] font-mono text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                {camposVerificados.size}/{totalCamposVerificables}
              </span>
            </div>

            {/* 🔥 MASTER_CHECKBOX_1: Seleccionar TODOS los campos */}
            <label className="flex items-center gap-3 p-3 mb-3 rounded-lg border-2 border-dashed border-blue-400 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-all select-none">
              <input
                type="checkbox"
                checked={todosCamposMarcados}
                ref={(el) => {
                  if (el) el.indeterminate = algunCampoMarcado;
                }}
                onChange={(e) => toggleTodosCampos(e.target.checked)}
                className="w-5 h-5 rounded accent-blue-700 cursor-pointer shrink-0"
              />
              <div className="flex-1">
                <span className="text-xs font-black uppercase tracking-wider text-blue-950 block">
                  ⚡ Seleccionar TODOS los campos de esta sección
                </span>
                <span className="text-[10px] text-blue-700">
                  Marca o desmarca los {totalCamposVerificables} campos de una sola vez
                </span>
              </div>
              {todosCamposMarcados && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                  ✓ Todos
                </span>
              )}
            </label>

            {Object.entries(camposPorGrupo).map(([grupoKey, campos]) => {
              const GrupoIcon = GRUPO_ICONS[grupoKey] || User;
              return (
                <div key={grupoKey} className="mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <GrupoIcon className="w-3.5 h-3.5 text-stone-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      {GRUPO_LABELS[grupoKey] || grupoKey}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {campos.map((campo) => {
                      const key = campo.key as string;
                      const Icon = campo.icon;
                      const valor = camposActuales[key] || '';
                      const valorOriginal = camposOriginales[key] || '';
                      const isVerificado = camposVerificados.has(key);
                      const isEditando = editandoCampo === key;
                      const fueEditado = valor !== valorOriginal;
                      const esReadonly = campo.tipo === 'readonly';

                      return (
                        <div
                          key={key}
                          className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all ${
                            isVerificado
                              ? 'bg-emerald-50 border-emerald-300'
                              : fueEditado
                              ? 'bg-blue-50 border-blue-300'
                              : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          {/* Checkbox */}
                          {!esReadonly && (
                            <input
                              type="checkbox"
                              checked={isVerificado}
                              onChange={() => toggleCampoVerificado(key)}
                              disabled={isEditando}
                              className="mt-0.5 w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
                            />
                          )}

                          {/* Icon */}
                          <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isVerificado ? 'text-emerald-700' : 'text-stone-500'}`} />

                          {/* Contenido */}
                          <div className="flex-1 min-w-0">
                            <label className="text-[10px] font-bold uppercase tracking-wide text-stone-500 block">
                              {campo.label}
                              {fueEditado && !isEditando && (
                                <span className="ml-2 text-blue-700 font-bold normal-case">
                                  ✏️ Modificado
                                </span>
                              )}
                            </label>

                            {isEditando ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <input
                                  type="text"
                                  value={valorTemp}
                                  onChange={(e) => setValorTemp(e.target.value.toUpperCase())}
                                  className="flex-1 px-2 py-1 text-sm font-medium bg-white border-2 border-blue-500 rounded-lg focus:outline-none"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') guardarEdicion();
                                    if (e.key === 'Escape') cancelarEdicion();
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={guardarEdicion}
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer"
                                  title="Guardar cambio"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelarEdicion}
                                  className="p-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <span
                                  className={`text-sm font-bold truncate ${
                                    !valor
                                      ? 'text-stone-400 italic'
                                      : fueEditado
                                      ? 'text-blue-900'
                                      : 'text-stone-900'
                                  }`}
                                >
                                  {valor || '(sin capturar)'}
                                </span>

                                {fueEditado && valorOriginal && (
                                  <span className="text-[10px] text-stone-400 line-through truncate">
                                    {valorOriginal}
                                  </span>
                                )}

                                {!esReadonly && (
                                  <button
                                    type="button"
                                    onClick={() => iniciarEdicion(key)}
                                    className="p-1 text-stone-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer shrink-0"
                                    title="Editar este campo"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══ SECCIÓN 2: CHECKLIST DE REQUISITOS ═══ */}
          <div className="bg-white border-2 border-amber-300 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-100">
              <FileText className="w-4 h-4 text-amber-700" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Sección 2 · Checklist de Requisitos ({requisitosMarcados.size}/{requisitos.length})
              </h4>
              {criticosFaltantes.length > 0 && (
                <span className="ml-auto text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  Faltan {criticosFaltantes.length} críticos
                </span>
              )}
            </div>

            {/* 🔥 MASTER_CHECKBOX_2: Marcar TODOS los requisitos */}
            <label className="flex items-center gap-3 p-3 mb-3 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-all select-none">
              <input
                type="checkbox"
                checked={todosRequisitosMarcados}
                ref={(el) => {
                  if (el) el.indeterminate = algunRequisitoMarcado;
                }}
                onChange={(e) => toggleTodosRequisitos(e.target.checked)}
                className="w-5 h-5 rounded accent-amber-700 cursor-pointer shrink-0"
              />
              <div className="flex-1">
                <span className="text-xs font-black uppercase tracking-wider text-amber-950 block">
                  ⚡ Marcar TODOS los requisitos de esta sección
                </span>
                <span className="text-[10px] text-amber-700">
                  Marca o desmarca los {requisitos.length} requisitos de una sola vez
                </span>
              </div>
              {todosRequisitosMarcados && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                  ✓ Todos
                </span>
              )}
            </label>

            <div className="space-y-1.5">
              {requisitos.map((req) => {
                const isMarcado = requisitosMarcados.has(req.id);
                return (
                  <label
                    key={req.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isMarcado
                        ? 'bg-emerald-50 border-emerald-300'
                        : req.critico
                        ? 'bg-white border-stone-300 hover:border-amber-400'
                        : 'bg-white border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isMarcado}
                      onChange={() => toggleRequisito(req.id)}
                      className="mt-0.5 w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isMarcado ? 'text-emerald-900' : 'text-stone-900'}`}>
                          {req.label}
                        </span>
                        {req.critico && !isMarcado && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            Crítico
                          </span>
                        )}
                      </div>
                      {req.descripcion && (
                        <p className="text-[10px] text-stone-500 mt-0.5 leading-snug">
                          {req.descripcion}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ═══ RESUMEN DE CAMBIOS ═══ */}
          {totalCambios > 0 && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Edit3 className="w-4 h-4 text-blue-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                  📝 Cambios detectados ({totalCambios})
                </h4>
              </div>
              <div className="space-y-1">
                {Object.entries(cambiosDetectados).map(([key, { anterior, nuevo }]) => {
                  const campo = CAMPOS_CONFIG.find((c) => c.key === key);
                  return (
                    <div key={key} className="flex items-center gap-2 text-[11px] py-1 border-b border-blue-100 last:border-0">
                      <span className="font-bold text-stone-700 min-w-[140px]">
                        {campo?.label || key}:
                      </span>
                      <span className="text-stone-500 line-through truncate max-w-[180px]">
                        {anterior || '(vacío)'}
                      </span>
                      <span className="text-blue-700">→</span>
                      <span className="text-blue-900 font-bold truncate max-w-[200px]">
                        {nuevo || '(vacío)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ ALERTA DE CRÍTICOS FALTANTES ═══ */}
          {criticosFaltantes.length > 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-rose-900">
                    ⛔ Faltan requisitos críticos:
                  </p>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-rose-800">
                    {criticosFaltantes.map((r) => (
                      <li key={r.id}>• {r.label}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 sm:p-4 bg-stone-100 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-stone-500 font-mono">
            {camposVerificados.size} campos · {requisitosMarcados.size}/{requisitos.length} requisitos
            {totalCambios > 0 && ` · ${totalCambios} cambios`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={!puedeConfirmar}
              className={`px-5 py-2 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-2 ${
                puedeConfirmar
                  ? 'bg-blue-700 hover:bg-blue-600 cursor-pointer'
                  : 'bg-stone-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {puedeConfirmar
                  ? totalCambios > 0
                    ? `Confirmar y Aplicar ${totalCambios} Cambio(s)`
                    : 'Confirmar Verificación'
                  : 'Complete la verificación'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};