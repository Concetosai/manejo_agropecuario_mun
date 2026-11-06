import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  User,
  Hash,
} from 'lucide-react';
import { MunicipalConfig, MunicipalUser, PreloadedOrderData } from '../../types';
import {
  buscarPropietarioEnSheet,
  revalidarRegistroEnSheet,
  guardarChecklistEnSheet,
  registrarRevalidacionHistorial,
  obtenerRegistrosDelSheet,
  GoogleRegistro,
} from '../../services/googleSheetsService';
import { getRequisitosPorTramite } from '../../utils/requisitosConfig';
import { recordAuditLog } from '../../utils/auditAuth';
import { RevalidacionBuscador } from './RevalidacionBuscador';
import { ModalVerificacionRevalidacion, CamposEditados } from './ModalVerificacionRevalidacion';
import { ModalResultadoVerificacion } from './ModalResultadoVerificacion';

interface RevalidacionViewProps {
  onBack: () => void;
  onGoToFinance: (category?: 'REVALIDACION', preloaded?: PreloadedOrderData) => void;
  // 🔥 NUEVO: callback para redirigir a TabCertificado con el registro revalidado
  onGoToCertificadoConProductor: (record: GoogleRegistro) => void;
  municipalConfig: MunicipalConfig;
  currentUser: MunicipalUser;
}

const REVALIDATION_FEE = 350;
const LATE_FEE = 150;
const CERTIFICATE_FEE = 180;

/**
 * Calcula la nueva vigencia sumando 3 años.
 * Formato: "2026 - 2029" → "2029-2032"
 */
function calcularNuevaVigencia(vigenciaActual?: string): string {
  const añoActual = new Date().getFullYear();
  const añoFinal = añoActual + 3;

  if (!vigenciaActual) {
    return `${añoActual}-${añoFinal}`;
  }

  const match = String(vigenciaActual).match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (match && match[2]) {
    const finalActual = parseInt(match[2], 10);
    if (finalActual >= añoActual) {
      return `${finalActual}-${finalActual + 3}`;
    }
  }

  return `${añoActual}-${añoFinal}`;
}

export const RevalidacionView: React.FC<RevalidacionViewProps> = ({
  onBack,
  onGoToFinance,
  onGoToCertificadoConProductor,
  municipalConfig,
  currentUser,
}) => {
  // ═══ FASE 1: BUSCADOR ═══
  const [registros, setRegistros] = useState<GoogleRegistro[]>([]);
  const [isLoadingRegistros, setIsLoadingRegistros] = useState(true);
  const [fierroSeleccionado, setFierroSeleccionado] = useState<GoogleRegistro | null>(null);

  // ═══ FASE 2: VERIFICACIÓN ═══
  const [showVerificacion, setShowVerificacion] = useState(false);
  const [camposEditados, setCamposEditados] = useState<CamposEditados>({});
  const [requisitosMarcados, setRequisitosMarcados] = useState<string[]>([]);
  const [totalCriticos, setTotalCriticos] = useState(0);

  // ═══ FASE 3: RESULTADO ═══
  const [showResultado, setShowResultado] = useState(false);
  const [exito, setExito] = useState(false);
  const [erroresResultado, setErroresResultado] = useState<string[]>([]);

  // ═══ ESTADOS GLOBALES ═══
  const [isProcessing, setIsProcessing] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ═══ CARGAR REGISTROS AL MONTAR ═══
  const cargarRegistros = useCallback(async () => {
    setIsLoadingRegistros(true);
    try {
      const result = await obtenerRegistrosDelSheet();
      if (result.success) {
        setRegistros(result.registros || []);
        console.log('%c[Revalidacion] Registros cargados:', 'color: #0ea5e9', result.total);
      } else {
        setAlertMsg({
          type: 'error',
          text: 'No se pudo cargar el padrón: ' + (result.error || 'desconocido'),
        });
      }
    } catch (err: any) {
      setAlertMsg({
        type: 'error',
        text: 'Error de conexión: ' + (err.message || 'desconocido'),
      });
    } finally {
      setIsLoadingRegistros(false);
    }
  }, []);

  useEffect(() => {
    cargarRegistros();
  }, [cargarRegistros]);

  // ═══ SELECCIONAR PRODUCTOR ═══
  const handleSelectProductor = (registro: GoogleRegistro) => {
    if (registro.estatus === 'CANCELADO') {
      setAlertMsg({
        type: 'error',
        text: `El fierro ${registro.folio} está CANCELADO (${registro.motivo_baja || 'sin motivo'}). No se puede revalidar.`,
      });
      setTimeout(() => setAlertMsg(null), 5000);
      return;
    }

    setFierroSeleccionado(registro);
    setShowVerificacion(true);
    console.log('%c[Revalidacion] Productor seleccionado:', 'color: #22c55e', registro.folio);
  };

  // ═══ CONFIRMAR VERIFICACIÓN ═══
  const handleConfirmarVerificacion = (resultado: {
    camposEditados: CamposEditados;
    requisitosMarcados: string[];
    totalCriticos: number;
  }) => {
    setCamposEditados(resultado.camposEditados);
    setRequisitosMarcados(resultado.requisitosMarcados);
    setTotalCriticos(resultado.totalCriticos);
    setShowVerificacion(false);

    // Verificar si hay cambios para validar
    const totalCambios = Object.keys(resultado.camposEditados).length;
    console.log('%c[Revalidacion] Verificación confirmada:', 'color: #22c55e', {
      cambios: totalCambios,
      requisitos: resultado.requisitosMarcados.length,
    });

    // Abrir modal de resultado
    setExito(true); // Siempre éxito si el modal de verificación permitió confirmar
    setErroresResultado([]);
    setShowResultado(true);
  };

  // ═══ GENERAR RECIBO (FASE FINAL) ═══
  const handleGenerarRecibo = async () => {
    if (!fierroSeleccionado) return;

    setIsProcessing(true);
    setShowResultado(false);

    try {
      const nuevaVigencia = calcularNuevaVigencia(fierroSeleccionado.vigencia);
      const totalCambios = Object.keys(camposEditados).length;

      // ═══════════════════════════════════════════════════════════════
      // PASO 1: Guardar cambios de campos en REGISTROS
      // ═══════════════════════════════════════════════════════════════
      console.log('%c[Revalidacion] Paso 1/4: Actualizando REGISTROS...', 'color: #0ea5e9');

      // Preparar payload con los cambios aplicados
      const cambiosAplicados: Record<string, string> = {};
      Object.entries(camposEditados).forEach(([key, { nuevo }]) => {
        cambiosAplicados[key] = nuevo;
      });

      // Llamar a revalidarRegistro que actualiza vigencia + estatus
      const revalidacionResult = await revalidarRegistroEnSheet({
        folio: fierroSeleccionado.folio || '',
        fecha_nueva_vigencia: nuevaVigencia,
        operador: currentUser.fullName,
      });

      if (!revalidacionResult.success) {
        setErroresResultado([revalidacionResult.error || 'Error al revalidar en Sheets']);
        setExito(false);
        setShowResultado(true);
        setIsProcessing(false);
        return;
      }

      // ═══════════════════════════════════════════════════════════════
      // PASO 2: Guardar checklist de requisitos en REGISTROS (cols 51-55)
      // ═══════════════════════════════════════════════════════════════
      console.log('%c[Revalidacion] Paso 2/4: Guardando checklist...', 'color: #0ea5e9');

      try {
        const checklistResult = await guardarChecklistEnSheet({
          folio: fierroSeleccionado.folio || '',
          tramite: 'REVALIDACION',
          requisitos_marcados: requisitosMarcados,
          total_criticos: totalCriticos,
          operador: currentUser.fullName,
        });

        if (!checklistResult.success) {
          console.warn('[Revalidacion] No se pudo guardar checklist:', checklistResult.error);
        }
      } catch (checklistErr) {
        console.warn('[Revalidacion] Error guardando checklist:', checklistErr);
      }

      // ═══════════════════════════════════════════════════════════════
      // PASO 3: Guardar historial en REVALIDACIONES
      // ═══════════════════════════════════════════════════════════════
      console.log('%c[Revalidacion] Paso 3/4: Guardando historial...', 'color: #0ea5e9');

      try {
        const historialResult = await registrarRevalidacionHistorial({
          folio_original: fierroSeleccionado.folio || '',
          vigencia_anterior: fierroSeleccionado.vigencia || '',
          vigencia_nueva: nuevaVigencia,
          operador: currentUser.fullName,
          notas:
            totalCambios > 0
              ? `Cambios aplicados: ${Object.keys(camposEditados).join(', ')}`
              : 'Sin cambios en datos',
        });

        if (historialResult.success) {
          console.log('%c[Revalidacion] Historial:', 'color: #22c55e', historialResult.folio_revalidacion);
        }
      } catch (histErr) {
        console.warn('[Revalidacion] Error guardando historial:', histErr);
      }

      // ═══════════════════════════════════════════════════════════════
      // PASO 3.5 (NUEVO): Regenerar certificado PNG + actualizar Sheets
      // ═══════════════════════════════════════════════════════════════
      console.log('%c[Revalidacion] Paso 3.5/5: Regenerando certificado PNG...', 'color: #0ea5e9');

      // FIX_MAP_REGISTRO: mapear GoogleRegistro → HistoricalRecord con todos los campos
      // que espera handleLoadRecordIntoCertificate (App.tsx)
      const registroRevalidado: any = {
        ...fierroSeleccionado,
        vigencia: nuevaVigencia,
        estatus: 'REVALIDADO',
        // Mapear campos de GoogleRegistro → HistoricalRecord
        id: fierroSeleccionado.id_registro || fierroSeleccionado.folio || '',
        id_registro: fierroSeleccionado.id_registro || fierroSeleccionado.folio || '',
        ownerName: fierroSeleccionado.nombre_productor || 'Productor sin nombre',
        fullName: fierroSeleccionado.nombre_productor || 'Productor sin nombre',
        curp: fierroSeleccionado.curp || '',
        rfc: fierroSeleccionado.rfc || '',
        ine: fierroSeleccionado.ine || '',
        address: fierroSeleccionado.domicilio || '',
        phone: fierroSeleccionado.telefono || '',
        email: fierroSeleccionado.email || '',
        propertyName: fierroSeleccionado.predio || '',
        ejido: fierroSeleccionado.ejido || '',
        municipio: fierroSeleccionado.municipio || 'Pánuco',
        surfaceHectares: Number(fierroSeleccionado.superficie) || 0,
        tenureType: fierroSeleccionado.tenencia || 'PRIVADA',
        cattleCount: Number(fierroSeleccionado.cantidad_ganado) || 0,
        species: fierroSeleccionado.especie || 'BOVINO',
        uppKey: fierroSeleccionado.upp || '',
        registrationNumber: fierroSeleccionado.numero_registro || '',
        bookNumber: fierroSeleccionado.libro || '',
        folioPage: fierroSeleccionado.foja || '',
        validityRange: nuevaVigencia,
        issueDate: fierroSeleccionado.fecha_expedicion || new Date().toISOString().split('T')[0],
        status: 'Vigente' as const,
        initials: fierroSeleccionado.iniciales || '',
        topSymbol: 'corona' as const,
        bottomSymbol: 'herradura' as const,
        orientation: 'enlazado' as const,
        vector_64d: fierroSeleccionado.vector_64d || undefined,
        brandVector: fierroSeleccionado.vector_64d || undefined,
        vector_checksum: fierroSeleccionado.vector_checksum || undefined,
        vector_density: fierroSeleccionado.vector_density || undefined,
        vector_symmetry_h: fierroSeleccionado.vector_symmetry_h || undefined,
        vector_symmetry_v: fierroSeleccionado.vector_symmetry_v || undefined,
        vector_proportions: fierroSeleccionado.vector_proportions || undefined,
        vector_varianza: fierroSeleccionado.vector_varianza || undefined,
        // URLs
        url_fierro: fierroSeleccionado.url_fierro || undefined,
        url_foto_titular: fierroSeleccionado.url_foto_titular || undefined,
        url_firma: fierroSeleccionado.url_firma || undefined,
        url_ine: fierroSeleccionado.url_ine || undefined,
        url_certificado: fierroSeleccionado.url_certificado || undefined,
        url_certificado_imagen: fierroSeleccionado.url_certificado_imagen || undefined,
        // Imágenes
        producerPhoto: fierroSeleccionado.url_foto_titular || undefined,
        producerSignature: fierroSeleccionado.url_firma || undefined,
        inePhoto: fierroSeleccionado.url_ine || undefined,
        fierroImageUrl: fierroSeleccionado.url_fierro || undefined,
        extractedBrandImage: fierroSeleccionado.url_fierro || undefined,
        imagenes: {
          credencial_ine: fierroSeleccionado.url_ine || undefined,
          fierro_digitalizado: fierroSeleccionado.url_fierro || undefined,
          certificado_generado: fierroSeleccionado.url_certificado || undefined,
        },
      };

      // 🔥 FIX_FORZAR_REGENERACION: borrar flag de subida previa
      const UPLOADED_KEY = 'panuco_cert_uploaded_' + fierroSeleccionado.folio;
      localStorage.removeItem(UPLOADED_KEY);
      console.log('%c[Revalidacion] 🗑️ Flag de subida previa eliminado:', 'color: #f59e0b', UPLOADED_KEY);

      // Limpiar cache local del certificado
      try {
        const DB_KEY = 'panuco_fierros_db_v2';
        const raw = localStorage.getItem(DB_KEY);
        if (raw) {
          const db = JSON.parse(raw);
          const registros = Array.isArray(db) ? db : (db.registros || []);
          let limpiados = 0;
          registros.forEach((r: any) => {
            if (r.folio === fierroSeleccionado.folio) {
              r.url_certificado_imagen = '';
              r.certificadoImagenUrl = '';
              limpiados++;
            }
          });
          localStorage.setItem(DB_KEY, JSON.stringify(Array.isArray(db) ? registros : { ...db, registros }));
          console.log(`%c[Revalidacion] 🗑️ Cache local limpiado (${limpiados} registro)`, 'color: #f59e0b');
        }
      } catch (err) {
        console.warn('[Revalidacion] No se pudo limpiar cache local:', err);
      }

      setAlertMsg({
        type: 'success',
        text: `✅ Fierro ${fierroSeleccionado.folio} revalidado. Regenerando certificado con nueva vigencia ${nuevaVigencia}...`,
      });

      // Redirigir a TabCertificado (modo preview) DESPUÉS de un delay
      // para que TabCertificado regenere el PNG y actualice url_certificado_imagen en Sheets
      setTimeout(() => {
        onGoToCertificadoConProductor(registroRevalidado);
      }, 1500);

      return; // ← IMPORTANTE: no seguir al Paso 4/5 (Finanzas) automáticamente

      // ═══════════════════════════════════════════════════════════════
      // PASO 4: Auditoría (solo si NO se regeneró el certificado)
      // ═══════════════════════════════════════════════════════════════
      recordAuditLog({
        actionType: 'REGISTRO_MODIFICADO',
        folioAffected: fierroSeleccionado.folio || '',
        producerAffected: fierroSeleccionado.nombre_productor || '',
        details: `Revalidación ejecutada. Nueva vigencia: ${nuevaVigencia}. Cambios: ${totalCambios}. Requisitos: ${requisitosMarcados.length}/${totalCriticos}. Operador: ${currentUser.fullName}.`,
      });

      // ═══════════════════════════════════════════════════════════════
      // PASO 5: Preparar PreloadedOrderData para Finanzas
      // ═══════════════════════════════════════════════════════════════
      console.log('%c[Revalidacion] Paso 4/4: Redirigiendo a Finanzas...', 'color: #0ea5e9');

      const conceptos = ['2. REVALIDACION FIERRO QUEMADOR'];
      const montoTotal = REVALIDATION_FEE;

      const payload: PreloadedOrderData = {
        nombreContribuyente: (fierroSeleccionado.nombre_productor || '').toUpperCase(),
        domicilioContribuyente: `${fierroSeleccionado.predio ? `${fierroSeleccionado.predio} - ` : ''}Ejido ${fierroSeleccionado.ejido || ''}, Pánuco, Ver.`,
        rfc: fierroSeleccionado.rfc || '',
        curp: fierroSeleccionado.curp || '',
        folio: fierroSeleccionado.folio || '',
        conceptosSeleccionados: conceptos,
        montoTotal: montoTotal,
        ejercicioFiscal: '2026-2029',
        periodo: 'OCTUBRE 2026',
        fechaExpedicion: new Date().toISOString().split('T')[0],
        tramiteOrigen: 'REVALIDACION',
        notas: `Revalidación del fierro "${fierroSeleccionado.iniciales}" (Folio: ${fierroSeleccionado.folio}). Nueva vigencia: ${nuevaVigencia}.${totalCambios > 0 ? ` Cambios aplicados: ${totalCambios}.` : ' Sin cambios en datos.'}`,
      };

      setAlertMsg({
        type: 'success',
        text: `✅ Fierro ${fierroSeleccionado.folio} revalidado. Nueva vigencia: ${nuevaVigencia}. Redirigiendo a Finanzas...`,
      });

      // Redirigir a Finanzas
      setTimeout(() => {
        onGoToFinance('REVALIDACION', payload);
      }, 1200);

    } catch (err: any) {
      console.error('[Revalidacion] Error:', err);
      setErroresResultado([err.message || 'Error desconocido al revalidar']);
      setExito(false);
      setShowResultado(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // ═══ VOLVER A EDITAR ═══
  const handleVolverAEditar = () => {
    setShowResultado(false);
    setShowVerificacion(true);
  };

  // ═══ CERRAR RESULTADO ═══
  const handleCloseResultado = () => {
    setShowResultado(false);
    setFierroSeleccionado(null);
    setCamposEditados({});
    setRequisitosMarcados([]);
    setTotalCriticos(0);
  };

  // ═══ REQUISITOS DEL TRÁMITE ═══
  const requisitosConfig = getRequisitosPorTramite('REVALIDACION');

  return (
    <div className="min-h-[85vh] bg-stone-100 py-6 px-3 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer shrink-0"
            >
              <ArrowLeft size={16} />
              <span>Volver al Hub</span>
            </button>
            <div className="h-8 w-px bg-stone-200" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase tracking-wider">
                  Trámite 2 de 5 · Tesorería Pánuco
                </span>
                <span className="text-xs font-mono font-bold text-stone-400">
                  Ejercicio Fiscal 2026
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 font-cinzel tracking-tight mt-0.5">
                Revalidación y Refrendo de Fierro Quemador
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onGoToFinance('REVALIDACION')}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Hash size={14} className="text-amber-400" />
            <span>Ver Órdenes en Finanzas</span>
          </button>
        </div>

        {/* ALERT */}
        {alertMsg && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-semibold ${
              alertMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                : 'bg-rose-50 text-rose-950 border-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {alertMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{alertMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlertMsg(null)}
              className="text-stone-500 hover:text-stone-800 font-bold ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* INFO BANNER */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <p className="font-bold text-blue-950">Flujo de Revalidación 2026</p>
            <ol className="mt-1.5 space-y-1 ml-1 list-decimal list-inside text-[11px]">
              <li>
                <strong>Busque al productor</strong> en el padrón (por nombre, CURP, RFC, folio, ejido, etc.)
              </li>
              <li>
                <strong>Verifique los datos</strong> con el productor presente (edite si es necesario) y marque los requisitos que trajo
              </li>
              <li>
                <strong>Confirme la verificación</strong> para aplicar los cambios en el padrón
              </li>
              <li>
                <strong>Genere el recibo de pago</strong> que se enviará a Finanzas para que pase a Tesorería
              </li>
            </ol>
          </div>
        </div>

        {/* FASE 1: BUSCADOR */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              1
            </div>
            <h2 className="text-sm font-bold text-stone-900">
              Buscar Productor en el Padrón Municipal
            </h2>
            {registros.length > 0 && (
              <span className="ml-auto text-[11px] text-stone-500 font-mono">
                {registros.length} registros disponibles
              </span>
            )}
          </div>

          <RevalidacionBuscador
            registros={registros}
            onSelect={handleSelectProductor}
            isLoading={isLoadingRegistros}
            onRefresh={cargarRegistros}
          />

          {fierroSeleccionado && !showVerificacion && (
            <div className="mt-4 p-3 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-emerald-900">
                  Productor seleccionado: {fierroSeleccionado.nombre_productor}
                </p>
                <p className="text-[11px] text-emerald-700 font-mono">
                  Folio: {fierroSeleccionado.folio} · Vigencia: {fierroSeleccionado.vigencia || '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ESTADO: PROCESANDO */}
        {isProcessing && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 text-center">
            <Loader2 className="w-8 h-8 text-amber-700 animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-amber-950">
              Procesando revalidación...
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Actualizando REGISTROS · Guardando historial · Redirigiendo a Finanzas
            </p>
          </div>
        )}
      </div>

      {/* ═══ FASE 2: MODAL DE VERIFICACIÓN ═══ */}
      {fierroSeleccionado && requisitosConfig && (
        <ModalVerificacionRevalidacion
          isOpen={showVerificacion}
          onClose={() => {
            setShowVerificacion(false);
            setFierroSeleccionado(null);
          }}
          registro={fierroSeleccionado}
          requisitos={requisitosConfig.requisitos}
          onConfirm={handleConfirmarVerificacion}
        />
      )}

      {/* ═══ FASE 3: MODAL DE RESULTADO ═══ */}
      <ModalResultadoVerificacion
        isOpen={showResultado}
        onClose={handleCloseResultado}
        exito={exito}
        camposEditados={camposEditados}
        requisitosMarcados={requisitosMarcados.length}
        totalRequisitos={requisitosConfig?.requisitos.length || 0}
        errores={erroresResultado}
        onGenerarRecibo={handleGenerarRecibo}
        onVolverAEditar={handleVolverAEditar}
      />
    </div>
  );
};