import React, { useState, useMemo } from 'react';
import {
  X,
  Bell,
  AlertTriangle,
  Clock,
  Phone,
  Mail,
  Check,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  Eye,
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

interface ModalRecordatoriosProps {
  isOpen: boolean;
  onClose: () => void;
  productoresPorVencer: ProductorPorVencer[];
  onRecargar: () => Promise<void>;
}

const URGENCIA_COLORS = {
  CRITICA: {
    bg: 'bg-rose-50',
    border: 'border-rose-400',
    text: 'text-rose-900',
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    dot: 'bg-rose-500',
  },
  ALTA: {
    bg: 'bg-orange-50',
    border: 'border-orange-400',
    text: 'text-orange-900',
    badge: 'bg-orange-100 text-orange-900 border-orange-300',
    dot: 'bg-orange-500',
  },
  MEDIA: {
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    text: 'text-amber-900',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    dot: 'bg-amber-500',
  },
};

/**
 * FASE_RECORDATORIOS_MODAL: Modal con lista completa
 * Filtra por búsqueda, ordena por urgencia, permite enviar WhatsApp/Email.
 */
export const ModalRecordatorios: React.FC<ModalRecordatoriosProps> = ({
  isOpen,
  onClose,
  productoresPorVencer,
  onRecargar,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroUrgencia, setFiltroUrgencia] = useState<'ALL' | 'CRITICA' | 'ALTA' | 'MEDIA'>('ALL');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtrar
  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return productoresPorVencer.filter((p) => {
      if (filtroUrgencia !== 'ALL' && p.urgencia !== filtroUrgencia) return false;
      if (!q) return true;
      const haystack = [
        p.registro.nombre_productor,
        p.registro.folio,
        p.registro.ejido,
        p.registro.curp,
        p.registro.rfc,
      ]
        .map((v) => String(v || '').toLowerCase())
        .join(' | ');
      return haystack.includes(q);
    });
  }, [productoresPorVencer, busqueda, filtroUrgencia]);

  // Métricas
  const metricas = useMemo(() => {
    const criticos = productoresPorVencer.filter((p) => p.urgencia === 'CRITICA').length;
    const altos = productoresPorVencer.filter((p) => p.urgencia === 'ALTA').length;
    const medios = productoresPorVencer.filter((p) => p.urgencia === 'MEDIA').length;
    const conTel = productoresPorVencer.filter((p) => tieneTelefonoValido(p.registro)).length;
    return { criticos, altos, medios, conTel };
  }, [productoresPorVencer]);

  const handleWhatsApp = (p: ProductorPorVencer) => {
    if (fueEnviadoRecientemente(p.registro.folio)) {
      alert(`Ya se envió un recordatorio a este productor en los últimos 7 días.\n\nFolio: ${p.registro.folio}`);
      return;
    }

    if (!tieneTelefonoValido(p.registro)) {
      alert('Este productor no tiene teléfono registrado o el número es inválido.');
      return;
    }

    const ok = abrirWhatsAppRecordatorio(p.registro, p.diasHabilesRestantes);
    if (ok) {
      marcarRecordatorioEnviado(p.registro.folio);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleEmail = (p: ProductorPorVencer) => {
    if (fueEnviadoRecientemente(p.registro.folio)) {
      alert(`Ya se envió un recordatorio a este productor en los últimos 7 días.\n\nFolio: ${p.registro.folio}`);
      return;
    }

    if (!tieneEmailValido(p.registro)) {
      alert('Este productor no tiene email registrado.');
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
    marcarRecordatorioEnviado(p.registro.folio);
    setRefreshKey((k) => k + 1);
  };

  const handleNotificarConocimiento = (p: ProductorPorVencer) => {
    if (fueEnviadoRecientemente(p.registro.folio)) return;
    
    marcarRecordatorioEnviado(p.registro.folio);
    alert(`Se registró en el sistema que el productor ${p.registro.nombre_productor} fue notificado por otros medios.`);
    setRefreshKey((k) => k + 1);
  };

  const handleRecargar = async () => {
    setIsRefreshing(true);
    try {
      await onRecargar();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden border-2 border-amber-700">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-600 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-100 block">
                Recordatorios de Revalidación
              </span>
              <h3 className="text-base sm:text-lg font-cinzel font-bold text-white">
                Certificados por Vencer
              </h3>
              <p className="text-[11px] text-amber-100">
                {productoresPorVencer.length} productor{productoresPorVencer.length !== 1 ? 'es' : ''} con vencimiento próximo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRecargar}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Recargar padrón"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MÉTRICAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-stone-50 border-b border-stone-200 shrink-0">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-800 block">
              Críticos (≤1d)
            </span>
            <span className="text-xl font-black text-rose-900">{metricas.criticos}</span>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-orange-800 block">
              Urgentes (2-3d)
            </span>
            <span className="text-xl font-black text-orange-900">{metricas.altos}</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 block">
              Próximos (4-5d)
            </span>
            <span className="text-xl font-black text-amber-900">{metricas.medios}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 block">
              Con teléfono
            </span>
            <span className="text-xl font-black text-emerald-900">{metricas.conTel}</span>
          </div>
        </div>

        {/* FILTROS */}
        <div className="p-3 bg-white border-b border-stone-200 flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
              placeholder="Buscar por nombre, folio, ejido, CURP..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
            {(['ALL', 'CRITICA', 'ALTA', 'MEDIA'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltroUrgencia(f)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  filtroUrgencia === f
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-white'
                }`}
              >
                {f === 'ALL' ? 'Todos' : f === 'CRITICA' ? 'Críticos' : f === 'ALTA' ? 'Urgentes' : 'Próximos'}
              </button>
            ))}
          </div>
        </div>

        {/* LISTA */}
        <div className="flex-1 overflow-y-auto bg-stone-50 p-3 sm:p-4">
          {filtrados.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-stone-800">
                {busqueda || filtroUrgencia !== 'ALL'
                  ? 'Sin resultados con los filtros aplicados'
                  : '¡Excelente! No hay certificados por vencer'}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                {busqueda || filtroUrgencia !== 'ALL'
                  ? 'Prueba con otros filtros'
                  : 'Todos los certificados están vigentes'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map((p) => {
                const config = URGENCIA_COLORS[p.urgencia];
                const tieneTel = tieneTelefonoValido(p.registro);
                const tieneMail = tieneEmailValido(p.registro);
                const enviadoReciente = fueEnviadoRecientemente(p.registro.folio);

                return (
                  <div
                    key={p.registro.folio}
                    className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border-2 ${config.border} ${config.bg} transition-all`}
                  >
                    {/* Días */}
                    <div className={`w-16 h-16 rounded-xl bg-white border-2 ${config.border} flex flex-col items-center justify-center shrink-0`}>
                      <span className={`text-2xl font-black leading-none ${config.text}`}>
                        {p.diasHabilesRestantes}
                      </span>
                      <span className={`text-[9px] font-bold uppercase leading-tight mt-0.5 ${config.text}`}>
                        {p.diasHabilesRestantes === 1 ? 'día' : 'días'}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-amber-900 bg-white px-1.5 py-0.5 rounded border border-amber-300">
                          {p.registro.folio}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${config.badge}`}>
                          {p.urgencia}
                        </span>
                        {enviadoReciente && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border bg-blue-100 text-blue-900 border-blue-300 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Enviado recientemente
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-stone-900 truncate mt-1">
                        {p.registro.nombre_productor}
                      </p>
                      <p className="text-[11px] text-stone-600">
                        Vence el <strong>{formatearFechaVencimiento(p.registro.vigencia)}</strong>
                        {p.registro.ejido && ` · Ejido ${p.registro.ejido}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-500 flex-wrap">
                        {p.registro.telefono && (
                          <span className="font-mono">📞 {p.registro.telefono}</span>
                        )}
                        {p.registro.email && (
                          <span className="truncate">✉️ {p.registro.email}</span>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-stretch sm:self-auto">
                      {tieneTel && !enviadoReciente && (
                        <button
                          type="button"
                          onClick={() => handleWhatsApp(p)}
                          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                          title="Enviar WhatsApp"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>
                      )}
                      {tieneMail && !enviadoReciente && (
                        <button
                          type="button"
                          onClick={() => handleEmail(p)}
                          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                          title="Enviar Email"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Email</span>
                        </button>
                      )}
                      {!tieneTel && !tieneMail && !enviadoReciente && (
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
                      {enviadoReciente && (
                        <span className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Notificado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 bg-stone-100 border-t border-stone-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-stone-500 font-mono">
            {filtrados.length} de {productoresPorVencer.length} · Umbral: 5 días hábiles
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};