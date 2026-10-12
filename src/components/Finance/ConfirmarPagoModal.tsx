import React, { useState, useRef } from 'react';
import { PaymentOrder, MunicipalUser, MunicipalConfig } from '../../types';
import {
  X,
  ShieldCheck,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  DollarSign,
} from 'lucide-react';
import { ReciboPrintable } from './ReciboPrintable';
import {
  subirArchivoADrive,
  actualizarUrlsRecibo,
  confirmarPagoRecibidoEnSheet,
} from '../../services/googleSheetsService';
import { subirImagenACloudinary } from '../../services/cloudinaryService';
import { getReciboFotoEnabled } from '../../utils/preferences';
import { numberToSpanishCurrencyWords } from '../../services/financeFirestore';
import { recordAuditLog } from '../../utils/auditAuth';

interface ConfirmarPagoModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PaymentOrder | null;
  currentUser: MunicipalUser;
  municipalConfig: MunicipalConfig;
  onSuccess?: () => void;
}

/**
 * Modal para confirmar el pago de una orden de cobro.
 * 
 * Flujo:
 * 1. Operador marca checkbox [✓] PAGADO (obligatorio)
 * 2. (Opcional, si toggle Settings activo) Toma foto del recibo sellado
 * 3. Click en "Guardar Recibo"
 * 4. Al guardar:
 *    - Si hay foto → sube a Cloudinary (08-Recibos)
 *    - Genera PDF del recibo (con sello PAGADO + miniatura) → sube a Drive
 *    - Actualiza PAGOS con las URLs + fileId
 *    - Marca la orden como PAID
 *    - Cierra el modal
 */
export const ConfirmarPagoModal: React.FC<ConfirmarPagoModalProps> = ({
  isOpen,
  onClose,
  order,
  currentUser,
  municipalConfig,
  onSuccess,
}) => {
  const [isPaidChecked, setIsPaidChecked] = useState(false);
  const [reciboFoto, setReciboFoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hiddenReciboRef = useRef<HTMLDivElement | null>(null);

  const showFotoSection = getReciboFotoEnabled();

  // Formato de fecha en español
  const formatDateSpanish = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const [y, m, d] = clean.split('-');
      const months = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
      ];
      const mIdx = parseInt(m, 10) - 1;
      return `${parseInt(d, 10)} DE ${months[mIdx] || m} DEL ${y}`;
    } catch {
      return dateStr;
    }
  };

  // Cuando el operador sube/toma la foto
  const handleFotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setReciboFoto(result);
      setAlert(null);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  // Quitar la foto
  const handleQuitarFoto = () => {
    setReciboFoto(null);
  };

  // Reset al cerrar
  const handleCerrar = () => {
    if (isProcessing) return; // no cerrar mientras procesa
    setIsPaidChecked(false);
    setReciboFoto(null);
    setAlert(null);
    setProcessingStatus('');
    onClose();
  };

  // ═══════════════════════════════════════════════════════════════════
  // GUARDAR RECIBO — Flujo completo
  // ═══════════════════════════════════════════════════════════════════
  const handleGuardarRecibo = async () => {
    if (!order) return;

    if (!isPaidChecked) {
      setAlert({ type: 'error', text: 'Debe marcar el checkbox "PAGADO" antes de guardar.' });
      return;
    }

    setIsProcessing(true);
    setAlert(null);

    try {
      // ═══ PASO 1: Subir foto a Cloudinary (si existe) ═══
      let urlReciboCloudinary: string | undefined;
      if (reciboFoto) {
        setProcessingStatus('Subiendo foto del recibo sellado a Cloudinary...');
        const filename = `RECIBO_${order.folio}_${Date.now()}.jpg`;
        const fotoResult = await subirImagenACloudinary(reciboFoto, filename, '08-Recibos');
        if (fotoResult.success && fotoResult.url) {
          urlReciboCloudinary = fotoResult.url;
          console.log('%c[Recibo] Foto subida a Cloudinary:', 'color: #22c55e', urlReciboCloudinary);
        } else {
          console.warn('[Recibo] No se pudo subir la foto:', fotoResult.error);
        }
      }

      // ═══ PASO 2: Generar PDF del recibo (con sello PAGADO + miniatura) ═══
      setProcessingStatus('Generando PDF del recibo oficial...');
      let urlReciboDrive: string | undefined;
      let urlReciboDriveId: string | undefined;

      try {
        const html2canvas = (await import('html2canvas-pro')).default;
        const { jsPDF } = await import('jspdf');

        const reciboElement = hiddenReciboRef.current;
        if (!reciboElement) throw new Error('No se encontró el elemento del recibo');

        const canvas = await html2canvas(reciboElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'letter',
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 20) / imgHeight);
        const finalWidth = imgWidth * ratio;
        const finalHeight = imgHeight * ratio;
        const marginX = (pdfWidth - finalWidth) / 2;
        const marginY = 10;

        pdf.addImage(imgData, 'PNG', marginX, marginY, finalWidth, finalHeight);

        const pdfBase64 = pdf.output('datauristring');

        // ═══ PASO 3: Subir PDF a Drive (nombre fijo → sobrescribe si hay fileId) ═══
        setProcessingStatus(
          order.urlReciboDriveId
            ? 'Actualizando PDF del recibo en Google Drive...'
            : 'Subiendo PDF del recibo a Google Drive...'
        );
        const pdfFilename = `RECIBO_${order.folio}.pdf`;
        const driveResult = await subirArchivoADrive(
          pdfBase64,
          pdfFilename,
          '08-Recibos',
          'application/pdf',
          order.urlReciboDriveId
        );

        if (driveResult.success && driveResult.url) {
          urlReciboDrive = driveResult.url;
          urlReciboDriveId = driveResult.fileId;
          console.log(
            `%c[Recibo] PDF ${driveResult.overwritten ? 'SOBRESCRITO' : 'subido'} en Drive:`,
            'color: #22c55e',
            urlReciboDrive,
            '| fileId:',
            urlReciboDriveId,
            '| overwritten:',
            driveResult.overwritten
          );
        } else {
          throw new Error('No se pudo subir el PDF a Drive: ' + (driveResult.error || 'desconocido'));
        }
      } catch (pdfErr: any) {
        console.error('[Recibo] Error generando/subiendo PDF:', pdfErr);
        setAlert({
          type: 'error',
          text: 'No se pudo generar/subir el PDF del recibo. La orden NO se marcó como PAGADA. ' + (pdfErr.message || ''),
        });
        setIsProcessing(false);
        setProcessingStatus('');
        return;
      }

      // ═══ PASO 4: Actualizar URLs en PAGOS (Cloudinary + Drive + fileId) ═══
      if (urlReciboCloudinary || urlReciboDrive) {
        setProcessingStatus('Actualizando URLs en la base de datos...');
        const updResult = await actualizarUrlsRecibo(order.folio, {
          url_recibo_cloudinary: urlReciboCloudinary,
          url_recibo_drive: urlReciboDrive,
          url_recibo_drive_id: urlReciboDriveId,
        });
        if (!updResult.success) {
          console.warn('[Recibo] No se pudieron guardar URLs:', updResult.error);
        }
      }

      // ═══ PASO 5: Marcar la orden como PAID ═══
      setProcessingStatus('Marcando orden como PAGADA...');
      const paidResult = await confirmarPagoRecibidoEnSheet({
        folio: order.folio,
        recibo_tesoreria: order.folio,
        cajero_confirmo: currentUser.fullName,
        operador_entrego: currentUser.fullName,
      });

      if (!paidResult.success) {
        setAlert({
          type: 'error',
          text: paidResult.error || 'No se pudo marcar como PAGADO en Sheets. El PDF sí se subió.',
        });
        setIsProcessing(false);
        setProcessingStatus('');
        return;
      }

      // ═══ PASO 6: Auditoría ═══
      recordAuditLog({
        actionType: 'REGISTRO_MODIFICADO',
        folioAffected: order.folio,
        producerAffected: order.taxpayerName,
        details: `Pago confirmado para orden ${order.folio}. Operador: ${currentUser.fullName}.${urlReciboCloudinary ? ' Foto: sí.' : ''}${urlReciboDrive ? ' PDF: sí.' : ''}`,
      });

      setAlert({ type: 'success', text: '✅ Pago confirmado y recibo guardado correctamente.' });
      setProcessingStatus('');

      setTimeout(() => {
        handleCerrar();
        if (onSuccess) onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error('[Recibo] Error general:', err);
      setAlert({
        type: 'error',
        text: 'Error al guardar el recibo: ' + (err.message || 'desconocido'),
      });
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[96vh] flex flex-col overflow-hidden border-2 border-emerald-700">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Abrir Recibo · Confirmar Pago</h3>
              <p className="text-[11px] text-emerald-100">
                Orden: <span className="font-mono font-bold">{order.folio}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCerrar}
            disabled={isProcessing}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Datos de la orden */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500 font-bold uppercase text-[10px]">Contribuyente:</span>
              <span className="font-bold text-stone-900 truncate ml-2">{order.taxpayerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500 font-bold uppercase text-[10px]">Monto:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">
                ${(order.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500 font-bold uppercase text-[10px]">Periodo:</span>
              <span className="font-mono text-stone-800">{order.period}</span>
            </div>
          </div>

          {/* Alert */}
          {alert && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                alert.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-rose-50 text-rose-900 border-rose-300'
              }`}
            >
              {alert.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{alert.text}</span>
            </div>
          )}

          {/* Checkbox PAGADO */}
          <div className="p-3.5 bg-emerald-50/60 border-2 border-emerald-300 rounded-xl">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPaidChecked}
                onChange={(e) => setIsPaidChecked(e.target.checked)}
                disabled={isProcessing}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-5 h-5 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-emerald-950 block text-sm">[✓] PAGADO</span>
                <span className="text-emerald-800 text-[11px]">
                  Confirmar que esta orden fue pagada en Tesorería Municipal. Al guardar se generará el PDF del recibo y se marcará como PAGADA.
                </span>
              </div>
            </label>
          </div>

          {/* Área de foto (si toggle activo) */}
          {showFotoSection && (
            <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <Camera className="w-4 h-4 text-blue-700" />
                <span className="font-bold text-blue-950 uppercase">Foto del recibo sellado (opcional)</span>
              </div>
              <p className="text-[11px] text-blue-800">
                Tome una foto del recibo que trajo el productor (con sello de Tesorería) y súbala como evidencia. Se mostrará en el portafolio del propietario.
              </p>

              {!reciboFoto ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFotoSelect}
                    className="hidden"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tomar Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 bg-white hover:bg-stone-100 border border-blue-300 disabled:opacity-50 text-blue-800 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Subir Archivo</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative bg-white border-2 border-blue-400 rounded-lg overflow-hidden">
                    <img
                      src={reciboFoto}
                      alt="Foto del recibo sellado"
                      className="w-full max-h-64 object-contain"
                    />
                    <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Foto lista
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isProcessing}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                    >
                      Tomar otra
                    </button>
                    <button
                      type="button"
                      onClick={handleQuitarFoto}
                      disabled={isProcessing}
                      className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline cursor-pointer ml-auto"
                    >
                      Quitar foto
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!showFotoSection && (
            <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-[11px] text-stone-600 text-center">
              📷 Captura de foto desactivada en Configuración
            </div>
          )}

          {/* Status de procesamiento */}
          {isProcessing && processingStatus && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-900">
              <Loader2 className="w-4 h-4 animate-spin text-amber-700 shrink-0" />
              <span className="font-medium">{processingStatus}</span>
            </div>
          )}

          {/* RECIBO OCULTO para generar el PDF (P4: forcePaid + miniatura) */}
          <div
            style={{
              position: 'absolute',
              left: '-9999px',
              top: 0,
              width: '800px',
              pointerEvents: 'none',
              opacity: 0,
            }}
            aria-hidden="true"
          >
            <div ref={hiddenReciboRef}>
              <ReciboPrintable
                order={order}
                municipalConfig={municipalConfig}
                formatDateSpanish={formatDateSpanish}
                numberToSpanishCurrencyWords={numberToSpanishCurrencyWords}
                forPrint={true}
                forcePaid={true}
                miniaturaReciboFisico={reciboFoto || undefined}
                folioFierro={order.folioFierro}
                nombreProductor={order.taxpayerName}
              />
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCerrar}
            disabled={isProcessing}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardarRecibo}
            disabled={isProcessing || !isPaidChecked}
            className="w-full sm:w-auto px-5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4" />
                <span>Guardar Recibo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};