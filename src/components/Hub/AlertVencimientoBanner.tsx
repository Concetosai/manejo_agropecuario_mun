import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  Clock,
  Phone,
  Check,
  Mail,
  X,
  ChevronRight,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { ProductorPorVencer } from '../../hooks/useRecordatoriosVencimiento';
import {
  abrirWhatsAppRecordatorio,
  marcarRecordatorioEnviado,
  fueEnviadoRecientemente,
  tieneTelefonoValido,
  tieneEmailValido,
  formatearFechaVencimiento,
} from '../../utils/recordatoriosUtils';

interface AlertVencimientoBannerProps {
  productoresPorVencer: ProductorPorVencer[];
  onVerTodos: () => void;
}

const STORAGE_BANNER_CERRADO = 'panuco_banner_vencimiento_cerrado_hasta';

const URGENCIA_CONFIG = {
  CRITICA: {
    bg: 'bg-gradient-to-r from-rose-600 to-rose-700',
    border: 'border-rose-800',
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    icon: AlertTriangle,
    label: 'CRÍTICO',
  },
  ALTA: {
    bg: 'bg-gradient-to-r from-orange-500 to-orange-600',
    border: 'border-orange-700',
    badge: 'bg-orange-100 text-orange-900 border-orange-300',
    icon: AlertTriangle,
    label: 'URGENTE',
  },
  MEDIA: {
    bg: 'bg-gradient-to-r from-amber-500 to-amber-600',
    border: 'border-amber-700',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: Clock,
    label: 'PRÓXIMO',
  },
};

/**
 * FASE_RECORDATORIOS_BANNER: Banner de alerta en el Hub de Trámites
 * Muestra productores cuyos certificados vencen en ≤ 30 días hábiles.
 * Se puede cerrar por 4 horas.
 *
 * REGLA: Al enviar un recordatorio, el productor desaparece inmediatamente
 * del banner y solo se muestra un toast de éxito por 3 segundos.
 */
export const AlertVencimientoBanner: React.FC<AlertVencimientoBannerProps> = ({
  productoresPorVencer,
  onVerTodos,
}) => {
  const [cerradoHasta, setCerradoHasta] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_BANNER_CERRADO);
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [refrescar, setRefrescar] = useState(0);

  // 🔥 NUEVO: Toast de éxito + folios recién enviados (para ocultar al instante)
  const [toast, setToast] = useState<{ nombre: string; folio: string } | null>(null);
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());

  // 🔥 NUEVO: Auto-ocultar el toast a los 3 segundos
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Verificar si el banner debe estar oculto (4 hrs)
  const ahora = Date.now();
  const estaCerrado = cerradoHasta > ahora;
  const horasRestantes = estaCerrado ? Math.ceil((cerradoHasta - ahora) / (1000 * 60 * 60)) : 0;

  const handleCerrar = () => {
    const hasta = Date.now() + 4 * 60 * 60 * 1000; // 4 hrs
    setCerradoHasta(hasta);
    try {
      localStorage.setItem(STORAGE_BANNER_CERRADO, String(hasta));
    } catch {}
  };

  const handleAbrirEmail = (p: ProductorPorVencer) => {
    if (fueEnviadoRecientemente(p.registro.folio || '')) {
      alert(`Ya se envió un recordatorio a este productor en los últimos 7 días.\n\nFolio: ${p.registro.folio}`);
      return;
    }
    const email = String(p.registro.email).trim();
    const fechaVenc = formatearFechaVencimiento(p.registro.vigencia);
    const asunto = encodeURIComponent(`⚠️ Recordatorio de Revalidación - Fierro ${p.registro.folio}`);
    const cuerpo = encodeURIComponent(
      `Estimado(a) ${p.registro.nombre_productor},\n\n` +
      `Le recordamos que su certificado de fierro quemador (Folio: ${p.registro.folio}) vence el próximo ${fechaVenc} (${p.diasHabilesRestantes} días hábiles).\n\n` +
      `Acuda a la Mesa de Ganadería para revalidar antes del vencimiento y evitar multas.\n\n` +
      `📞 846-109-6645\n` +
      `H. Ayuntamiento de Pánuco, Ver.`
    );
    window.open(`mailto:${email}?subject=${asunto}&body=${cuerpo}`, '_blank');
    
    marcarRecordatorioEnviado(p.registro.folio || '');
    setOcultos((prev) => new Set(prev).add(p.registro.folio || ''));
    setToast({ nombre: p.registro.nombre_productor || 'Productor', folio: p.registro.folio || '' });
    setRefrescar((r) => r + 1);
  };

  const handleNotificarConocimiento = (p: ProductorPorVencer) => {
    if (fueEnviadoRecientemente(p.registro.folio || '')) return;
    
    marcarRecordatorioEnviado(p.registro.folio || '');
    setOcultos((prev) => new Set(prev).add(p.registro.folio || ''));
    alert(`Se registró en el sistema que el productor ${p.registro.nombre_productor} fue notificado por otros medios (o no cuenta con contacto digital).`);
    setRefrescar((r) => r + 1);
  };

  const handleAbrirWhatsApp = (p: ProductorPorVencer) => {
    if (fueEnviadoRecientemente(p.registro.folio || '')) {
      alert(`Ya se envió un recordatorio a este productor en los últimos 7 días.\n\nFolio: ${p.registro.folio}`);
      return;
    }

    if (!tieneTelefonoValido(p.registro)) {
      alert('Este productor no tiene teléfono registrado o el número es inválido.');
      return;
    }

    const ok = abrirWhatsAppRecordatorio(p.registro, p.diasHabilesRestantes);
    if (ok) {
      marcarRecordatorioEnviado(p.registro.folio || '');
      // 🔥 NUEVO: ocultar la fila inmediatamente
      setOcultos((prev) => new Set(prev).add(p.registro.folio || ''));
      // 🔥 NUEVO: mostrar toast
      setToast({
        nombre: p.registro.nombre_productor || 'Productor',
        folio: p.registro.folio || '',
      });
      setRefrescar((r) => r + 1);
    }
  };

  // 🔥 NUEVO: Filtrar los que acabamos de enviar (para que desaparezcan al instante)
  const visibles = productoresPorVencer.filter(
    (p) => !ocultos.has(p.registro.folio || '')
  );

  // Si está cerrado o no hay alertas, no renderizar
  if (estaCerrado) return null;
  if (visibles.length === 0) return null;

  // Determinar urgencia global (la peor)
  const peorUrgencia = visibles.reduce(
    (peor, p) => {
      const orden = { CRITICA: 3, ALTA: 2, MEDIA: 1 };
      return orden[p.urgencia] > orden[peor] ? p.urgencia : peor;
    },
    'MEDIA' as 'CRITICA' | 'ALTA' | 'MEDIA'
  );

  const config = URGENCIA_CONFIG[peorUrgencia];
  const Icon = config.icon;
  const top3 = visibles.slice(0, 3);
  const resto = visibles.length - 3;

  return (
    <>
      <div className={`rounded-2xl border-2 ${config.border} shadow-xl overflow-hidden animate-fadeIn`}>
        {/* HEADER */}
        <div className={`${config.bg} text-white p-4 sm:p-5 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full ${config.badge}`}>
                  {config.label}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                  Recordatorio de Revalidación
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-cinzel font-bold text-white mt-0.5">
                {visibles.length === 1
                  ? '1 productor tiene su certificado por vencer'
                  : `${visibles.length} productores tienen su certificado por vencer`}
              </h3>
              <p className="text-[11px] text-white/90 mt-0.5">
                Vencen en los próximos {visibles[0]?.diasHabilesRestantes || 0} días hábiles. Envíeles un recordatorio.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCerrar}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
            title="Ocultar por 4 horas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY: Top 3 + Ver todos */}
        <div className="bg-white p-3 sm:p-4 space-y-2">
          {top3.map((p) => {
            const configP = URGENCIA_CONFIG[p.urgencia];
            const tieneTel = tieneTelefonoValido(p.registro);
          const tieneMail = tieneEmailValido(p.registro);

            return (
              <div
                key={p.registro.folio}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-all"
              >
                {/* Días */}
                <div
                  className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 border-2 ${
                    p.urgencia === 'CRITICA'
                      ? 'bg-rose-50 border-rose-400 text-rose-900'
                      : p.urgencia === 'ALTA'
                      ? 'bg-orange-50 border-orange-400 text-orange-900'
                      : 'bg-amber-50 border-amber-400 text-amber-900'
                  }`}
                >
                  <span className="text-lg font-black leading-none">
                    {p.diasHabilesRestantes}
                  </span>
                  <span className="text-[9px] font-bold uppercase leading-tight mt-0.5">
                    {p.diasHabilesRestantes === 1 ? 'día' : 'días'}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {p.registro.folio}
                    </span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${configP.badge}`}>
                      {configP.label}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-stone-900 truncate mt-0.5">
                    {p.registro.nombre_productor}
                  </p>
                  <p className="text-[11px] text-stone-500 truncate">
                    Vence el {formatearFechaVencimiento(p.registro.vigencia)}
                    {p.registro.ejido && ` · Ejido ${p.registro.ejido}`}
                  </p>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 self-stretch sm:self-auto">
                  {tieneTel && !fueEnviadoRecientemente(p.registro.folio || '') && (
                    <button
                      type="button"
                      onClick={() => handleAbrirWhatsApp(p)}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      title={`Enviar WhatsApp a ${p.registro.telefono}`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  )}
                  {tieneMail && !fueEnviadoRecientemente(p.registro.folio || '') && (
                    <button
                      type="button"
                      onClick={() => handleAbrirEmail(p)}
                      className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      title={`Enviar Email a ${p.registro.email}`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email</span>
                    </button>
                  )}
                  {!tieneTel && !tieneMail && !fueEnviadoRecientemente(p.registro.folio || '') && (
                    <>
                      <span className="px-2 py-2 rounded-lg bg-stone-100 text-stone-500 text-[11px] font-semibold border border-stone-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        Sin contacto
                      </span>
                      <button
                        type="button"
                        onClick={() => handleNotificarConocimiento(p)}
                        className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        title="Registrar notificación por otros medios"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Notificar</span>
                      </button>
                    </>
                  )}
                  {fueEnviadoRecientemente(p.registro.folio || '') && (
                    <span className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Notificado
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {resto > 0 && (
            <button
              type="button"
              onClick={onVerTodos}
              className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-stone-200"
            >
              <Eye className="w-4 h-4" />
              <span>
                Ver {resto === 1 ? 'el otro productor' : `los otros ${resto} productores`}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {resto === 0 && visibles.length > 0 && (
            <button
              type="button"
              onClick={onVerTodos}
              className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-stone-200"
            >
              <Eye className="w-4 h-4" />
              <span>Ver todos los detalles</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 🔥 TOAST de éxito (fixed, abajo a la derecha) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-fadeIn">
          <div className="bg-emerald-600 text-white rounded-xl shadow-2xl px-5 py-4 flex items-center gap-3 border-2 border-emerald-700 max-w-sm">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">¡Recordatorio enviado!</p>
              <p className="text-[11px] text-emerald-50 truncate">
                {toast.nombre} · {toast.folio}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};