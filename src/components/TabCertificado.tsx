import React, { useEffect, useState, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import { buildVerificationData, buildVerificationUrl } from '../utils/qrVerification';
import { ProducerData, BrandConfig, MunicipalConfig } from '../types';
import { renderBrandToCanvas } from '../utils/canvasRenderer';
import { recordAuditLog } from '../utils/auditAuth';
import { validateFullProducerData } from '../utils/formValidation';
import { ValidationErrorsModal } from './ValidationErrorsModal';
import { PanucoMunicipalLogo } from './PanucoMunicipalLogo';
import { TexasGuillocheCertificateBorder } from './TexasGuillocheCertificateBorder';
import { generateSecureCertificatePdf } from '../utils/pdfGenerator';
import { subirImagenACloudinary } from '../services/cloudinaryService';
import { actualizarUrlCertificadoImagen } from '../services/googleSheetsService';
import html2canvas from 'html2canvas-pro';
import { captureElementSafe } from '../utils/captureSafe';
import { DocumentDispatchSection } from './DocumentDispatchSection';
import { FichaRegistroTradicional } from './FichaRegistroTradicional';
import { PhotoCaptureModal } from './PhotoCaptureModal';

const formatOfficialDate = (dateStr?: string): string => {
  if (!dateStr) return '23 DE SEPTIEMBRE DE 2026';
  try {
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr.toUpperCase();
    const months = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    const monthIndex = parseInt(m, 10) - 1;
    const monthName = months[monthIndex] || m;
    const day = parseInt(d, 10);
    return `${day} DE ${monthName} DE ${y}`;
  } catch {
    return dateStr.toUpperCase();
  }
};
import {
  Printer,
  ShieldCheck,
  Award,
  QrCode as QrIcon,
  Camera,
  CheckCircle2,
  FileText,
  CreditCard,
  Scissors,
  Check,
  RotateCw,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  FileDown,
  Loader2,
  MessageSquare,
  Mail,
  Send,
  Save,
  LogOut,
  Eye,
  DollarSign,
} from 'lucide-react';

interface TabCertificadoProps {
  producerData: ProducerData;
  brandConfig: BrandConfig;
  municipalConfig: MunicipalConfig;
  onGoToRegistro?: (step?: 1 | 2 | 3) => void;
  onChangeProducerData?: (data: ProducerData) => void;
  // FIX_BOTON_VOLVER: callback para regresar al modulo anterior
  onBack?: () => void;
  // FIX_FLUJO: callback para cerrar el ciclo completo (limpia + hub)
  onCerrarCiclo?: () => void;
  // FASE_0_2: callback para generar orden de pago desde el certificado
  onGoToFinance?: (category?: 'ALTA', preloaded?: any) => void;
  // FIX_CERT_MODE: si es true, mostrar el PDF consolidado (no editable)
  forceConsolidatedMode?: boolean;
}

export const TabCertificado: React.FC<TabCertificadoProps> = ({
  producerData,
  brandConfig,
  municipalConfig,
  onGoToRegistro,
  onChangeProducerData,
  onBack,
  onCerrarCiclo,
  onGoToFinance,
  forceConsolidatedMode = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [producerPhoto, setProducerPhoto] = useState<string>(producerData.producerPhoto || '');
  const [showCertPhotoModal, setShowCertPhotoModal] = useState<boolean>(false);
  // FIX_FORMATO_DEFAULT: por defecto mostrar el Formato Moderno (Acta + CR-80)
  const [documentFormat, setDocumentFormat] = useState<'traditional' | 'modern'>('modern');
  const [printDocSelection, setPrintDocSelection] = useState<'both' | 'certificate' | 'id_card'>('both');
  const [cardOrientation, setCardOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [showValidationModal, setShowValidationModal] = useState(false);

  // FIX_SYNC_PHOTO: Sync bidireccional para asegurar que la foto persista
  useEffect(() => {
    if (producerData.producerPhoto) {
      setProducerPhoto(producerData.producerPhoto);
      console.log('[Certificado] Foto del titular cargada:', producerData.producerPhoto.length, 'bytes');
    } else {
      console.warn('[Certificado] producerData.producerPhoto esta vacio');
    }
  }, [producerData.producerPhoto]);

  // Validate entire producer record
  const validationState = useMemo(() => validateFullProducerData(producerData), [producerData]);

  // FIX_FIERRO_REAL: imagen real del fierro (foto importada/validada por antiduplicidad o URL de Cloudinary)
  const realFierroImage = useMemo(
    () => producerData.fierroDigitalizadoPhoto || producerData.fierroImageUrl || '',
    [producerData.fierroDigitalizadoPhoto, producerData.fierroImageUrl]
  );

  const certCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const idCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const idCanvasBackRef = useRef<HTMLCanvasElement | null>(null);
  const certificateContainerRef = useRef<HTMLDivElement | null>(null);
  const traditionalContainerRef = useRef<HTMLDivElement | null>(null);
  const cardContainerRef = useRef<HTMLDivElement | null>(null);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  // FIX_IMG_AUTO: estados para la captura del certificado como imagen
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const [imageGenError, setImageGenError] = useState<string | null>(null);
  const [pdfProgressText, setPdfProgressText] = useState('');
  const [pdfSuccessNotice, setPdfSuccessNotice] = useState<{ filename: string; hash: string } | null>(null);

  // P4-QR: genera un QR real que codifica la URL pública de verificación del
  // certificado. Cualquier cámara (PC o celular) abre la página de verificación
  // y el escáner interno lee el mismo código para abrir el expediente.
  useEffect(() => {
    const verificationData = buildVerificationData(producerData);
    const verificationUrl = buildVerificationUrl(verificationData);

    QRCode.toDataURL(verificationUrl, {
      width: 250,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#171717',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR', err));
  }, [producerData]);


  // FIX_PDF_AUTO_V2: generar el PDF automáticamente al montar en modo consolidado
  useEffect(() => {
    if (!forceConsolidatedMode) return;
    if (producerData.certificadoDriveUrl) return;
    if (isGeneratingPdf) return;
    if (!validationState.isValid) {
      console.warn('[PDF-AUTO-V2] No se puede generar PDF: validación fallida');
      return;
    }

    let mounted = true;
    (async () => {
      try {
        console.log('[PDF-AUTO-V2] Generando PDF automáticamente...');
        setIsGeneratingPdf(true);
        setPdfProgressText('Generando PDF oficial del certificado...');

        // Esperar a que el DOM esté listo
        await new Promise(r => setTimeout(r, 800));

        if (!mounted) return;

        await handleDownloadPdf('both');

        if (mounted) {
          console.log('%c[PDF-AUTO-V2] PDF generado y persistido', 'color: #22c55e; font-weight: bold');
        }
      } catch (err) {
        console.warn('[PDF-AUTO-V2] Error:', err);
      } finally {
        if (mounted) {
          setIsGeneratingPdf(false);
          setPdfProgressText('');
        }
      }
    })();

    return () => { mounted = false; };
  }, [forceConsolidatedMode, producerData.certificadoDriveUrl, validationState.isValid]);

  // FIX_IMG_AUTO_SIN_CONSOLIDADO: capturar el certificado como imagen JPG
  // (corre SIEMPRE que haya certificado en el DOM, no solo en modo consolidado)
  useEffect(() => {
    // FIX_CONSOLIDADO_NO_CAPTURA: en modo consolidado (no editable) no hay certificado
    // en el DOM que capturar; se muestra la imagen ya generada.
    if (forceConsolidatedMode) return;
    if (producerData.certificadoImagenUrl) return;
    if (isGeneratingImage) return;
    // FIX_DEDUP_UPLOAD_V3: chequear si YA se subio exitosamente (URL final persistida)
    // Este flag es permanente hasta que el folio cambie. Sobrevive StrictMode.
    const UPLOADED_KEY = 'panuco_cert_uploaded_' + producerData.folio;
    const uploadedRaw = localStorage.getItem(UPLOADED_KEY);
    if (uploadedRaw) {
      try {
        const { url } = JSON.parse(uploadedRaw);
        if (url) {
          console.log('[IMG-AUTO] Ya existe imagen subida para este folio, saltando:', url);
          return;
        }
      } catch {}
    }
    if (!validationState.isValid) {
      console.warn('[IMG-AUTO] Validacion fallida, no se genera imagen');
      return;
    }

    let mounted = true;
    (async () => {
      try {
        console.log('%c[IMG-AUTO] Iniciando captura del certificado...', 'color: #0ea5e9; font-weight: bold');
        setIsGeneratingImage(true);
        setImageGenError(null);

        await new Promise(r => setTimeout(r, 1500));
        if (!mounted) return;

        const certElement = document.querySelector('.print-page-letter') as HTMLElement;
        if (!certElement) {
          throw new Error('No se encontro .print-page-letter en el DOM');
        }

                console.log('[CERT-DIAG] fonts:', document.fonts?.status);
        console.log('[CERT-DIAG] dpr:', window.devicePixelRatio);
        console.log('[CERT-DIAG] svg count:', document.querySelectorAll('svg').length);
        console.log('[CERT-DIAG] imgs:', [...document.querySelectorAll('img')].map(i => ({
          src: i.src.slice(0, 60),
          complete: i.complete,
          w: i.naturalWidth,
        })));

        console.log('%c[IMG-AUTO] Capturando con captureElementSafe...', 'color: #0ea5e9');
        const canvas = await captureElementSafe(certElement, { backgroundColor: '#faf7ef' });

        const jpgBase64 = canvas.toDataURL('image/jpeg', 0.85);
        console.log('%c[IMG-AUTO] JPG generado:', 'color: #22c55e', {
          sizeKB: Math.round(jpgBase64.length / 1024),
        });

        const filename = 'CERTIFICADO_' + producerData.folio + '_' + Date.now() + '.jpg';
        console.log('%c[IMG-AUTO] Subiendo a Cloudinary...', 'color: #0ea5e9');
        const upload = await subirImagenACloudinary(jpgBase64, filename, '07-Certificados');

        if (!upload.success || !upload.url) {
          throw new Error('Cloudinary fallo: ' + (upload.error || 'desconocido'));
        }

        console.log('%c[IMG-AUTO] Subida exitosa:', 'color: #22c55e; font-weight: bold', upload.url);

                if (onChangeProducerData) {
          onChangeProducerData({
            ...producerData,
            certificadoImagenUrl: upload.url,
          });
        }

        // FIX_CACHE_CERTIFICADO: actualizar el cache local para que el modal lo vea
        try {
          const DB_KEY = 'panuco_fierros_db_v2';
          const raw = localStorage.getItem(DB_KEY);
          if (raw) {
            const db = JSON.parse(raw);
            const registros = Array.isArray(db) ? db : (db.registros || []);
            let updated = false;
            registros.forEach((r: any) => {
              if (r.folio === producerData.folio) {
                r.url_certificado_imagen = upload.url;
                r.certificadoImagenUrl = upload.url;
                updated = true;
              }
            });
            if (updated) {
              localStorage.setItem(DB_KEY, JSON.stringify(Array.isArray(db) ? registros : { ...db, registros }));
              console.log('%c[IMG-AUTO] Cache local actualizado con url_certificado_imagen', 'color: #22c55e');
            }
          }
        } catch (cacheErr) {
          console.warn('[IMG-AUTO] No se pudo actualizar cache local:', cacheErr);
        }

        const sheetsResult = await actualizarUrlCertificadoImagen(producerData.folio, upload.url);
        if (sheetsResult.success) {
          console.log('%c[IMG-AUTO] URL persistida en Sheets', 'color: #22c55e');
        } else {
          console.warn('[IMG-AUTO] No se pudo persistir en Sheets:', sheetsResult.error);
        }

        // FIX_RESYNC: forzar re-sincronización del cache desde Sheets
        // (para que el cache local tenga el url_certificado_imagen recién guardado)
        try {
          const { inicializarSincronizacion } = await import('../utils/googleSheetsIntegration');
          const resyncResult = await inicializarSincronizacion();
          console.log('%c[IMG-AUTO] Cache re-sincronizado desde Sheets', 'color: #22c55e; font-weight: bold', {
            online: resyncResult.online,
            registros: resyncResult.registrosDescargados,
          });
        } catch (resyncErr: any) {
          console.warn('[IMG-AUTO] No se pudo re-sincronizar cache:', resyncErr?.message || resyncErr);
        }

        // FIX_DEDUP_UPLOAD_V3: persistir la URL exitosa para futuras ejecuciones
        try {
          localStorage.setItem(
            'panuco_cert_uploaded_' + producerData.folio,
            JSON.stringify({ url: upload.url, ts: Date.now() })
          );
          console.log('[IMG-AUTO] Flag de subida exitosa persistido');
        } catch {}

        if (mounted) setIsGeneratingImage(false);
            } catch (err: any) {
        console.error('[IMG-AUTO] Error:', err);
        if (mounted) {
          setImageGenError(err?.message || 'Error desconocido');
          setIsGeneratingImage(false);
        }
      }
    })();

    return () => { mounted = false; };
  }, [producerData.certificadoImagenUrl, validationState.isValid, producerData.folio]);

  // Render high-res brand onto the Certificate ornamental frame
  useEffect(() => {
    const canvas = certCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderBrandToCanvas(ctx, canvas.width, canvas.height, brandConfig, {
      background: 'transparent',
      showShadow: false,
      resolutionScale: 1.2,
    });
  }, [brandConfig]);

  // Render miniature brand onto the ID Card Front & Back
  useEffect(() => {
    const canvas = idCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderBrandToCanvas(ctx, canvas.width, canvas.height, brandConfig, {
          background: 'transparent',
          showShadow: false,
          resolutionScale: 0.8,
        });
      }
    }

    const canvasBack = idCanvasBackRef.current;
    if (canvasBack) {
      const ctxBack = canvasBack.getContext('2d');
      if (ctxBack) {
        renderBrandToCanvas(ctxBack, canvasBack.width, canvasBack.height, brandConfig, {
          background: 'transparent',
          showShadow: false,
          resolutionScale: 0.8,
        });
      }
    }
  }, [brandConfig, cardOrientation]);

  useEffect(() => {
    const handleBeforePrint = (e: Event) => {
      if (!validationState.isValid) {
        setShowValidationModal(true);
      }
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    return () => window.removeEventListener('beforeprint', handleBeforePrint);
  }, [validationState.isValid]);

  const handlePrint = () => {
    // CRITICAL: Block print if form is incomplete or invalid!
    if (!validationState.isValid) {
      recordAuditLog({
        actionType: 'IMPRESION_DOCUMENTO',
        folioAffected: producerData.folio,
        producerAffected: producerData.fullName,
        details: `Intento de impresión bloqueado por la Dirección: Faltan ${validationState.errors.length} campos válidos en el expediente del productor.`,
      });
      setShowValidationModal(true);
      return;
    }

    recordAuditLog({
      actionType: 'IMPRESION_DOCUMENTO',
      folioAffected: producerData.folio,
      producerAffected: producerData.fullName,
      details: `Impresión física oficial autorizada (Modo: ${printDocSelection}, Papel Carta / Tarjeta CR-80, Folio: ${producerData.folio}).`,
    });
    window.print();
  };

  const handleDownloadPdf = async (customSelection?: 'both' | 'certificate' | 'id_card') => {
    // CRITICAL: Block PDF download if form is incomplete or invalid!
    if (!validationState.isValid) {
      recordAuditLog({
        actionType: 'IMPRESION_DOCUMENTO',
        folioAffected: producerData.folio,
        producerAffected: producerData.fullName,
        details: `Intento de descarga PDF bloqueado por la Dirección: Faltan ${validationState.errors.length} campos válidos en el expediente del productor.`,
      });
      setShowValidationModal(true);
      return;
    }

    const targetSelection = customSelection || printDocSelection;

    try {
      setIsGeneratingPdf(true);
      setPdfProgressText('Iniciando procesamiento de documento oficial en alta resolución...');

      const targetCertElement =
        documentFormat === 'traditional'
          ? traditionalContainerRef.current
          : certificateContainerRef.current;

      const targetCardElement =
        documentFormat === 'traditional' ? null : cardContainerRef.current;

      const effectiveSelection =
        documentFormat === 'traditional' ? 'certificate' : targetSelection;

      const result = await generateSecureCertificatePdf({
        selection: effectiveSelection,
        certificateElement: targetCertElement,
        cardElement: targetCardElement,
        producerData,
        brandConfig,
        municipalConfig,
        formatType: documentFormat,
        onProgress: (status) => setPdfProgressText(status),
      });

      if (result.success && result.filename) {
        // FIX_PDF_PERSIST_TABCERT: subir el PDF a Cloudinary si no está persistido
        if (!producerData.certificadoDriveUrl && result.blob && onChangeProducerData) {
          try {
            setPdfProgressText('Subiendo PDF a Cloudinary...');
            const pdfBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(result.blob!);
            });

            const uploadResult = await subirImagenACloudinary(
              pdfBase64,
              result.filename,
              '07-Certificados'
            );

            if (uploadResult.success && uploadResult.url) {
              onChangeProducerData({
                ...producerData,
                certificadoDriveUrl: uploadResult.url,
              });
              console.log('%c[PDF] Subido a Cloudinary:', 'color: #22c55e', uploadResult.url);
            } else {
              console.warn('[PDF] No se pudo subir a Cloudinary:', uploadResult.error);
            }
          } catch (err) {
            console.warn('[PDF] Error subiendo a Cloudinary:', err);
          }
        }

        recordAuditLog({
          actionType: 'IMPRESION_DOCUMENTO',
          folioAffected: producerData.folio,
          producerAffected: producerData.fullName,
          details: `Generación y descarga de archivo PDF seguro autorizada: ${result.filename} (Hash: ${result.securityHash || 'N/A'}, Modo: ${targetSelection}).`,
        });

        setPdfSuccessNotice({
          filename: result.filename,
          hash: result.securityHash || 'SEC-PAN-VER-2026',
        });
        setTimeout(() => setPdfSuccessNotice(null), 6000);
      } else {
        alert(`No se pudo generar el PDF: ${result.error || 'Error desconocido'}`);
      }
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      alert(`Error al generar el PDF: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgressText('');
    }
  };

  const scrollToDispatchSection = () => {
    const el = document.getElementById('seccion-envio-documentos');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGenerarOrdenFinanzas = () => {
    if (!onGoToFinance) return;
    const payload = {
      nombreContribuyente: (producerData.fullName || 'CONTRIBUYENTE NUEVO').toUpperCase(),
      domicilioContribuyente: producerData.address
        ? `${producerData.propertyName ? `${producerData.propertyName} - ` : ''}${producerData.address}, Ejido ${producerData.ejido || ''}, Pánuco, Ver.`
        : `Ejido ${producerData.ejido || ''}, Pánuco, Ver.`,
      rfc: producerData.rfc || '',
      curp: producerData.curp || '',
      folio: producerData.folio || '',
      conceptosSeleccionados: ['1. ALTA DE FIERRO QUEMADOR', '5. PAGO DE CONSTANCIA'],
      montoTotal: 630,
      ejercicioFiscal: producerData.validityRange || '2026-2029',
      periodo: 'OCTUBRE 2026',
      fechaExpedicion: producerData.issueDate || new Date().toISOString().split('T')[0],
      tramiteOrigen: 'ALTA',
      notas: `Alta inicial de registro de fierro marcador para C. ${producerData.fullName || 'Nuevo Productor'}.`,
    };
    onGoToFinance('ALTA', payload);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setProducerPhoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // FIX_CERT_MODE: Vista consolidada (PDF no editable)
  if (forceConsolidatedMode) {
    // FIX_IMG_AUTO: mostrar imagen si existe, o loader, o fallback al PDF viejo
    const certUrl = producerData.certificadoImagenUrl || producerData.certificadoDriveUrl;
    const isImage = !!producerData.certificadoImagenUrl;

    return (
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8 w-full max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white rounded-2xl p-4 sm:p-5 shadow-lg mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200 block">
                Certificado Oficial · {isImage ? 'Imagen Consolidada' : 'PDF Consolidado'}
              </span>
              <h1 className="text-lg sm:text-xl font-cinzel font-bold">
                {producerData.fullName || 'Productor'}
              </h1>
              <p className="text-xs text-emerald-100">
                Folio: <strong>{producerData.folio}</strong> · REG: {producerData.registrationNumber || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 mb-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-950">
              {isImage ? '✅ Certificado generado como imagen' : '✅ Certificado generado como PDF'}
            </p>
            <p className="text-xs text-emerald-800 mt-1">
              {isImage
                ? 'La imagen del certificado ha sido generada y almacenada en Cloudinary. Este documento es inmutable.'
                : 'El PDF oficial ha sido generado y persistido. Este documento es inmutable.'}
            </p>
          </div>
        </div>

        {/* Imagen o PDF */}
        <div className="bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden mb-6">
          {isImage ? (
            <img
              src={certUrl}
              alt="Certificado Oficial"
              className="w-full h-auto"
            />
          ) : isGeneratingImage ? (
            <div className="flex flex-col items-center justify-center py-20 bg-stone-50">
              <Loader2 className="w-12 h-12 animate-spin text-amber-600" />
              <p className="text-sm font-semibold text-stone-700 mt-3">
                Generando imagen del certificado...
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Esto puede tomar unos segundos
              </p>
            </div>
          ) : imageGenError ? (
            <div className="flex flex-col items-center justify-center py-20 bg-rose-50">
              <AlertTriangle className="w-12 h-12 text-rose-600 mb-3" />
              <p className="text-sm font-semibold text-rose-800">
                Error generando la imagen
              </p>
              <p className="text-xs text-rose-600 mt-1">{imageGenError}</p>
              {producerData.certificadoDriveUrl && (
                <iframe
                  src={producerData.certificadoDriveUrl}
                  className="w-full h-[70vh] border-0 mt-4"
                  title="Certificado PDF Oficial"
                />
              )}
            </div>
          ) : certUrl ? (
            <iframe
              src={certUrl}
              className="w-full h-[70vh] border-0"
              title="Certificado PDF Oficial"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-stone-50">
              <FileText className="w-16 h-16 text-stone-300 mb-3" />
              <p className="text-sm text-stone-500">Certificado pendiente de generar</p>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => window.open(certUrl, '_blank')}
            className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isImage ? 'Abrir Imagen' : 'Abrir PDF'}</span>
          </button>
          <a
            href={certUrl}
            download={isImage ? ('CERTIFICADO_' + producerData.folio + '.jpg') : ('CERTIFICADO_' + producerData.folio + '.pdf')}
            className="px-4 py-2.5 bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Descargar</span>
          </a>
          {onGoToFinance && (
            <button
              type="button"
              onClick={handleGenerarOrdenFinanzas}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center gap-2 cursor-pointer ring-2 ring-emerald-400/40"
            >
              <DollarSign className="w-4 h-4" />
              <span>Generar Recibo de Pago en Finanzas</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-lg border border-stone-300 transition-colors flex items-center gap-2 cursor-pointer ml-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8 w-full max-w-full overflow-x-hidden">
      {/* SELECTOR OFICIAL DE FORMATO DE IMPRESIÓN */}
      <div className="no-print bg-white border-2 border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-800 text-white shadow-2xs">
                Secretaría de Desarrollo Agropecuario y Pesquero · Pánuco, Ver.
              </span>
              <span className="text-xs text-stone-500 font-medium hidden sm:inline">
                Selector de Tipo de Impresión Oficial
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-stone-900 mt-1.5">
              ¿Qué formato de impresión oficial deseas utilizar para este registro?
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Elija la plantilla reglamentaria según el trámite de la Dirección General de Ganadería.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto shrink-0">
            {/* OPCIÓN 1 */}
            <button
              type="button"
              onClick={() => {
                setDocumentFormat('traditional');
                setPrintDocSelection('certificate');
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                documentFormat === 'traditional'
                  ? 'bg-amber-50/80 border-amber-800 ring-2 ring-amber-700/30 shadow-xs'
                  : 'bg-stone-50 border-stone-300 hover:bg-stone-100 text-stone-700'
              }`}
            >
              <div
                className={`mt-0.5 p-1 rounded-full shrink-0 ${
                  documentFormat === 'traditional' ? 'bg-amber-800 text-white' : 'bg-stone-300 text-stone-600'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-950 flex items-center gap-1.5">
                  <span>1. Formato Sencillo / Tradicional</span>
                  {documentFormat === 'traditional' && (
                    <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-mono font-bold">
                      ACTIVO
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-stone-600 mt-0.5 leading-snug">
                  Ficha única con 15 datos esenciales limpios, texto legal Art. 30-33 y sin QR ni folios excedentes.
                </div>
              </div>
            </button>

            {/* OPCIÓN 2 */}
            <button
              type="button"
              onClick={() => {
                setDocumentFormat('modern');
                setPrintDocSelection('both');
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                documentFormat === 'modern'
                  ? 'bg-amber-50/80 border-amber-800 ring-2 ring-amber-700/30 shadow-xs'
                  : 'bg-stone-50 border-stone-300 hover:bg-stone-100 text-stone-700'
              }`}
            >
              <div
                className={`mt-0.5 p-1 rounded-full shrink-0 ${
                  documentFormat === 'modern' ? 'bg-amber-800 text-white' : 'bg-stone-300 text-stone-600'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-950 flex items-center gap-1.5">
                  <span>2. Formato Completo / Moderno</span>
                  {documentFormat === 'modern' && (
                    <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-mono font-bold">
                      ACTIVO
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-stone-600 mt-0.5 leading-snug">
                  Acta certificada con marco Guilloche, código QR de verificación, folios y credencial CR-80.
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Action header bar (hidden on print) */}
      <div className="no-print bg-white border border-stone-200 rounded-xl p-3 sm:p-5 shadow-sm mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full max-w-full">
        <div>
          {/* FIX_BOTON_VOLVER: boton para regresar al modulo anterior */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 px-3 py-1.5 text-xs font-bold text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-lg shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Regresar al modulo anterior"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver</span>
            </button>
          )}
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-800 block">
            Módulo de Expedición y Validez Jurídica
          </span>
          <h1 className="text-lg sm:text-2xl font-cinzel font-bold text-stone-900 mt-1 break-words">
            {documentFormat === 'traditional'
              ? 'Ficha de Registro de Fierro Quemador para Ganado'
              : 'Vista Previa de Impresión Oficial y Título Ganadero'}
          </h1>
          <p className="text-[11px] sm:text-xs text-stone-600 mt-0.5">
            {documentFormat === 'traditional' ? (
              <>
                <strong className="text-stone-900">Formato Tradicional de Ficha Única</strong> en Papel Tamaño Carta (8.5 × 11") conforme a la Ley Ganadera de Veracruz.
              </>
            ) : (
              <>
                <strong className="text-stone-900">Documento de Propiedad en Tamaño Carta</strong> (8.5 × 11") y{' '}
                <strong className="text-stone-900">Credencial Ganadera en Tamaño Tarjeta</strong> (54 × 85.6 mm / CR-80).
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* Document selection */}
          {documentFormat === 'modern' ? (
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg text-xs overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setPrintDocSelection('both')}
                className={`px-2.5 sm:px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
                  printDocSelection === 'both' ? 'bg-white font-semibold text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                Ambos Documentos
              </button>
              <button
                type="button"
                onClick={() => setPrintDocSelection('certificate')}
                className={`px-2.5 sm:px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
                  printDocSelection === 'certificate' ? 'bg-white font-semibold text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                Título (Tamaño Carta)
              </button>
              <button
                type="button"
                onClick={() => setPrintDocSelection('id_card')}
                className={`px-2.5 sm:px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
                  printDocSelection === 'id_card' ? 'bg-white font-semibold text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                Credencial (Tamaño Tarjeta)
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-stone-100 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-800">
              <FileText className="w-3.5 h-3.5 text-amber-800" />
              <span>Ficha Única Tradicional (Carta)</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {onGoToFinance && validationState.isValid && (
              <button
                type="button"
                onClick={handleGenerarOrdenFinanzas}
                className="w-full sm:w-auto px-4 py-2 text-xs font-black text-amber-950 bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-center ring-2 ring-amber-500/50"
                title="Generar orden de cobro en el modulo de Finanzas"
              >
                <DollarSign className="w-4 h-4 shrink-0 text-amber-950" />
                <span className="truncate">Generar Orden en Finanzas</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDownloadPdf()}
              disabled={isGeneratingPdf}
              className={`w-full sm:w-auto px-4 sm:px-5 py-2 text-xs font-bold text-white rounded-lg shadow transition-colors flex items-center justify-center gap-2 cursor-pointer text-center ${
                !validationState.isValid
                  ? 'bg-rose-700 hover:bg-rose-800 ring-2 ring-rose-300'
                  : 'bg-amber-800 hover:bg-amber-700 ring-1 ring-amber-600'
              }`}
              title="Descargar archivo PDF oficial seguro con sellos digitales y resolución de 300 DPI"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-amber-200" />
                  <span className="truncate">Generando PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 shrink-0 text-amber-300" />
                  <span className="truncate">
                    {!validationState.isValid ? 'Revisar para Descargar PDF' : 'Descargar PDF Seguro (.pdf)'}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className={`w-full sm:w-auto px-4 sm:px-5 py-2 text-xs font-bold text-white rounded-lg shadow transition-colors flex items-center justify-center gap-2 cursor-pointer text-center ${
                !validationState.isValid
                  ? 'bg-rose-700 hover:bg-rose-800 ring-2 ring-rose-300'
                  : 'bg-emerald-700 hover:bg-emerald-600'
              }`}
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {!validationState.isValid ? 'Revisar Datos para Imprimir' : 'Imprimir Documentos'}
              </span>
            </button>

            <button
              type="button"
              onClick={scrollToDispatchSection}
              className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
              title="Ir a la sección de envío rápido por WhatsApp"
            >
              <MessageSquare className="w-4 h-4 shrink-0 text-emerald-100" />
              <span className="truncate">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={scrollToDispatchSection}
              className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
              title="Ir a la sección de envío rápido por Correo Electrónico"
            >
              <Mail className="w-4 h-4 shrink-0 text-blue-100" />
              <span className="truncate">Email</span>
            </button>

            {/* FIX_FLUJO: boton para cerrar el ciclo completo (limpia + hub) */}
            {onCerrarCiclo && (
              <button
                type="button"
                onClick={() => {
                  const confirmacion = window.confirm(
                    '✅ ¿Cerrar el ciclo completo?\n\n' +
                    'Se limpiará el formulario y regresarás al menú principal.\n\n' +
                    '¿Deseas continuar?'
                  );
                  if (confirmacion) {
                    onCerrarCiclo();
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-center ring-2 ring-emerald-400/40 hover:scale-[1.02] active:scale-98"
                title="Cerrar el ciclo completo (limpia el formulario y regresa al menú principal)"
              >
                <Save className="w-4 h-4 shrink-0 text-emerald-100" />
                <span className="truncate">Cerrar Ciclo</span>
                <LogOut className="w-3.5 h-3.5 shrink-0 text-emerald-200" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PDF Generation In-Progress Banner */}
      {isGeneratingPdf && (
        <div className="no-print mb-6 bg-amber-50 border border-amber-300 rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3 animate-pulse">
          <Loader2 className="w-5 h-5 text-amber-800 shrink-0 animate-spin" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
              Generando Archivo PDF Seguro Oficial
            </h4>
            <p className="text-xs text-amber-900 mt-0.5 font-medium">
              {pdfProgressText || 'Renderizando documento a 300 DPI con sellos de seguridad...'}
            </p>
          </div>
        </div>
      )}

      {/* PDF Success Download Banner */}
      {pdfSuccessNotice && (
        <div className="no-print mb-6 bg-emerald-50 border border-emerald-400 rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-200 text-emerald-900 rounded-lg shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                Documento PDF Descargado Exitosamente
              </h4>
              <p className="text-xs text-emerald-900 font-mono-data mt-0.5">
                Archivo: <strong>{pdfSuccessNotice.filename}</strong> · Sello: <span className="bg-emerald-200/80 px-1 py-0.5 rounded text-[10px]">{pdfSuccessNotice.hash}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPdfSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 text-xs font-bold p-1 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Prominent Warning Banner if validation failed */}
      {!validationState.isValid && (
        <div className="no-print mb-6 bg-rose-50 border-2 border-rose-400 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="p-2 bg-rose-200 text-rose-800 rounded-lg shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-900 block">
                  Impresión Oficial Bloqueada · Expediente Incompleto
                </span>
                <span className="text-[10px] font-mono-data font-bold bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded">
                  {validationState.errors.length} {validationState.errors.length === 1 ? 'campo pendiente' : 'campos pendientes'}
                </span>
              </div>
              <p className="text-xs text-rose-800 mt-1">
                La legislación pecuaria vigente prohíbe expedir certificados o credenciales oficiales sin todos los datos validados. Corrija los errores para habilitar la impresión.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowValidationModal(true)}
              className="px-3 py-1.5 text-xs font-bold text-rose-900 bg-rose-200 hover:bg-rose-300 rounded-lg transition-colors cursor-pointer"
            >
              Ver {validationState.errors.length} Observaciones
            </button>
            {onGoToRegistro && (
              <button
                type="button"
                onClick={() => onGoToRegistro(validationState.errors[0]?.step || 1)}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Corregir en Registro</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          RENDERIZADO CONDICIONAL SEGÚN EL FORMATO SELECCIONADO
         ========================================================================= */}
      {documentFormat === 'traditional' ? (
        /* OPCIÓN 1: FORMATO SENCILLO / TRADICIONAL (BASADO EN FICHA ÚNICA) */
        <div className="mb-8 sm:mb-12">
          {/* On-screen description note */}
          <div className="no-print mb-2 flex items-center justify-between text-xs text-stone-500 px-1">
            <span className="flex items-center gap-1.5 font-semibold text-stone-800">
              <FileText className="w-4 h-4 text-amber-800" />
              Opción 1: Ficha de Registro de Fierro Quemador para Ganado (Formato Sencillo / Tradicional)
            </span>
            <span className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">
              1 página Letter · Formato limpio reglamentario
            </span>
          </div>

          <FichaRegistroTradicional
            producerData={producerData}
            brandConfig={brandConfig}
            municipalConfig={municipalConfig}
            containerRef={traditionalContainerRef}
          />
        </div>
      ) : (
        /* OPCIÓN 2: FORMATO COMPLETO / MODERNO (ACTA CERTIFICADA + CREDENCIAL CR-80) */
        <>
          {/* =========================================================================
              DOCUMENT 1: DOCUMENTO DE PROPIEDAD / TÍTULO OFICIAL (TAMAÑO CARTA EXACTO)
             ========================================================================= */}
          {(printDocSelection === 'both' || printDocSelection === 'certificate') && (
            <div className="mb-8 sm:mb-12">
              {/* On-screen description note */}
              <div className="no-print mb-2 flex items-center justify-between text-xs text-stone-500 px-1">
                <span className="flex items-center gap-1.5 font-semibold text-stone-700">
                  <FileText className="w-4 h-4 text-amber-800" />
                  Documento 1: Título Oficial de Propiedad de Marca de Fuego (Tamaño Carta: 215.9 × 279.4 mm)
                </span>
                <span className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">
                  Ajustado para 1 página Letter
                </span>
              </div>

              {/* Letter Size Printable Container */}
              <div
                ref={certificateContainerRef}
                className={`print-page-letter bg-[#faf7ef] shadow-2xl border border-stone-300 rounded-lg overflow-hidden w-full max-w-[840px] mx-auto text-stone-900 relative ${
                  !validationState.isValid ? 'print:hidden' : ''
                }`}
              >
                {/* Texas / Banknote Guilloché Security Border Frame */}
                <TexasGuillocheCertificateBorder className="w-full">
                  {/* Subtle Coat of Arms Watermark in Center */}
                  <div className="watermark-panuco flex flex-col items-center pointer-events-none opacity-4">
                    <Award className="w-80 h-80 print:w-72 print:h-72 text-stone-900" />
                    <span className="font-cinzel text-3xl font-black tracking-widest text-stone-900 mt-2">
                      PÁNUCO · VERACRUZ
                    </span>
                  </div>

                  {/* =========================================================================
                      CERTIFICATE HEADER (Matches CERT.jpeg)
                     ========================================================================= */}
                  <div className="text-center relative z-10 mb-4 print:mb-3">
                    {/* 1. REPÚBLICA MEXICANA Pill Frame */}
                    <div className="inline-block border-[1.5px] border-stone-900 rounded-full px-7 py-0.5 bg-white/90 shadow-2xs mb-1.5">
                      <span className="font-cinzel font-black tracking-[0.25em] text-xs sm:text-sm print:text-xs text-stone-950 uppercase">
                        REPÚBLICA MEXICANA
                      </span>
                    </div>

                    {/* 2. ESTADO DE VERACRUZ Ribbon Banner */}
                    <div className="relative max-w-md sm:max-w-lg mx-auto my-1">
                      <div className="bg-gradient-to-r from-[#14532d] via-[#15803d] to-[#14532d] text-amber-100 py-1 px-8 rounded shadow-xs border-y-[1.5px] border-[#d97706] text-center flex items-center justify-center">
                        <span className="font-cinzel font-black tracking-[0.18em] text-[10px] sm:text-xs print:text-[9px] text-amber-100 uppercase drop-shadow-xs">
                          ESTADO DE VERACRUZ DE IGNACIO DE LA LLAVE
                        </span>
                      </div>
                    </div>

                    {/* 3. Official Title */}
                    <h1 className="font-cinzel font-black text-stone-950 text-base sm:text-xl print:text-base tracking-wide uppercase mt-1 leading-tight">
                      ACTA DE CERTIFICACIÓN Y REGISTRO
                    </h1>
                    <h2 className="font-cinzel font-black text-stone-950 text-lg sm:text-2xl print:text-lg tracking-wide uppercase leading-tight mt-0.5">
                      OFICIAL DE FIERRO QUEMADOR
                    </h2>
                <h3 className="font-cinzel font-bold text-stone-900 text-xs sm:text-sm print:text-xs tracking-widest uppercase mt-0.5">
                  MUNICIPIO DE PANUCO, VER.
                </h3>

                {/* 4. Bracketed Folio and Date Boxes */}
                <div className="flex items-center justify-center gap-3 sm:gap-6 print:gap-4 mt-2 print:mt-1">
                  <div className="border border-stone-800 bg-white/95 px-3 py-0.5 text-[11px] sm:text-xs print:text-[10px] font-mono-data font-bold text-stone-900 shadow-2xs">
                    FOLIO: <span className="text-[#831843] font-black">[{producerData.folio || '000123'}]</span>
                  </div>
                  <div className="border border-stone-800 bg-white/95 px-3 py-0.5 text-[11px] sm:text-xs print:text-[10px] font-mono-data font-bold text-stone-900 shadow-2xs">
                    FECHA: <span className="text-stone-950">[{formatOfficialDate(producerData.issueDate)}]</span>
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  BODY: TWO COLUMNS (Matches CERT.jpeg Left Producer Data + Right Brand Frame)
                 ========================================================================= */}
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-3 sm:gap-4 print:gap-2.5 items-start mb-3 print:mb-2">
                {/* -------------------------------------------------------------
                    LEFT COLUMN: DATOS DEL PRODUCTOR (Fill-in Underline Lines)
                   ------------------------------------------------------------- */}
                <div className="md:col-span-7 print:col-span-7 space-y-1.5 print:space-y-1 text-[10px] sm:text-[11.5px] print:text-[9px] font-sans text-stone-900">
                  <div className="flex items-center gap-1.5 mb-2 pb-0.5 border-b border-stone-400">
                    <h3 className="font-cinzel font-bold text-xs sm:text-sm print:text-xs uppercase tracking-wider text-stone-950">
                      DATOS DEL PRODUCTOR
                    </h3>
                    <span className="text-[10px] text-amber-700">◆</span>
                  </div>

                  {/* Line 1: NOMBRE DEL PRODUCTOR */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      NOMBRE DEL PRODUCTOR:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 font-cinzel font-bold text-stone-950 uppercase truncate px-1 text-[11px] sm:text-xs print:text-[10px]">
                      {producerData.fullName || '__________________________________'}
                    </span>
                  </div>

                  {/* Line 2: DOMICILIO */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      DOMICILIO:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 text-stone-900 truncate px-1">
                      {producerData.address || '__________________________________'}
                    </span>
                  </div>

                  {/* Line 3: TELÉFONO */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      TELÉFONO:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 font-mono-data text-stone-900 px-1">
                      {producerData.phone || '__________________________________'}
                    </span>
                  </div>

                  {/* Line 4: EJIDO CONGREGACIÓN O RANCHERIA */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      EJIDO CONGREGACIÓN O RANCHERIA:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 text-stone-900 truncate px-1">
                      {producerData.ejido ? `${producerData.ejido}, ${producerData.municipio || 'Pánuco'}, Ver.` : '__________________________________'}
                    </span>
                  </div>

                  {/* Line 5: NOMBRE DEL PREDIO */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      NOMBRE DEL PREDIO:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 font-semibold text-stone-950 uppercase truncate px-1">
                      {producerData.propertyName || '__________________________________'}
                    </span>
                  </div>

                  {/* Spacing gap as in CERT.jpeg */}
                  <div className="pt-1" />

                  {/* Line 6: SUPERFICIE */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      SUPERFICIE:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 text-stone-900 px-1">
                      {producerData.surfaceHectares ? `${producerData.surfaceHectares} HECTÁREAS` : '__________________________________'}
                    </span>
                  </div>

                  {/* Line 7: TIPO DE TENENCIA */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      TIPO DE TENENCIA:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 text-stone-900 font-semibold uppercase px-1">
                      {producerData.tenureType || 'EJIDAL'}
                    </span>
                  </div>

                  {/* Line 8: GANADERO ASOCIADO */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      GANADERO ASOCIADO:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 text-stone-900 font-semibold uppercase px-1">
                      {producerData.associatedRancher || 'NO'}
                    </span>
                  </div>

                  {/* Line 9: CANTIDAD DE GANADO QUE POSEE */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      CANTIDAD DE GANADO QUE POSEE:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 text-stone-900 font-mono-data font-bold px-1">
                      {producerData.cattleCount ? `${producerData.cattleCount} CABEZAS` : '__________________________________'}
                    </span>
                  </div>

                  {/* Line 10: ESPECIE */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      ESPECIE:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 text-stone-900 font-semibold uppercase px-1">
                      {producerData.species || 'BOVINO'}
                    </span>
                  </div>

                  {/* Line 11: FIN ZOOTECNICO */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      FIN ZOOTECNICO:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 text-stone-900 font-semibold uppercase px-1">
                      {producerData.zootechnicalPurpose || 'BOVINO Y DOBLE PROPÓSITO'}
                    </span>
                  </div>

                  {/* Line 12: CREDENCIAL DE ELECTOR */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      CREDENCIAL DE ELECTOR:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 font-mono-data text-stone-900 px-1">
                      {producerData.ine || '__________________________________'}
                    </span>
                  </div>

                  {/* Line 13: R.F.C. */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      R.F.C.:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 font-mono-data text-stone-900 px-1">
                      {producerData.rfc || '__________________________________'}
                    </span>
                  </div>

                  {/* Line 14: CURP */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      CURP:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 font-mono-data text-stone-900 px-1">
                      {producerData.curp || '__________________________________'}
                    </span>
                  </div>

                  {/* Line 15: CLAVE UPP */}
                  <div className="flex items-baseline">
                    <span className="font-bold shrink-0 uppercase tracking-tight text-stone-800">
                      CLAVE UPP:
                    </span>
                    <span className="ml-1.5 flex-1 border-b border-stone-800 font-mono-data font-bold text-stone-900 px-1">
                      {producerData.uppKey || '__________________________________'}
                    </span>
                  </div>
                </div>

                {/* -------------------------------------------------------------
                    RIGHT COLUMN: BRAND ORNAMENTAL FRAME + SECURITY QR
                   ------------------------------------------------------------- */}
                <div className="md:col-span-5 print:col-span-5 flex flex-col items-center gap-4 pt-1">
                  {/* FIX_LAYOUT_A: Foto del titular (pequeña, arriba) */}
                  <div className="w-full flex flex-col items-center">
                    <div className="p-2 bg-gradient-to-b from-[#fdfcf9] to-[#f4eee1] border-2 border-[#6d1624] rounded-lg shadow-sm w-full max-w-[180px] print:max-w-[160px]">
                      <div className="border border-[#d97706] p-1 rounded-xs bg-[#faf7ee]">
                        <div className="border border-[#7c1a29]/60 p-1 rounded-xs flex items-center justify-center bg-white">
                          {producerPhoto ? (
                            <img
                              src={producerPhoto}
                              alt="Foto del titular"
                              className="w-[140px] h-[180px] sm:w-[150px] sm:h-[190px] print:w-[130px] print:h-[165px] object-cover rounded-xs"
                            />
                          ) : (
                            <div className="w-[140px] h-[180px] sm:w-[150px] sm:h-[190px] print:w-[130px] print:h-[165px] flex flex-col items-center justify-center text-stone-400 text-center">
                              <Camera className="w-7 h-7 mb-1 opacity-40" />
                              <span className="text-[8px] font-sans font-bold">FOTO DEL TITULAR</span>
                              <span className="text-[7px] font-sans">Sin capturar</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-cinzel font-bold uppercase text-stone-700 mt-1 tracking-wider">
                      FOTOGRAFÍA DEL TITULAR
                    </span>
                  </div>

                  {/* Verification QR Code Section with Legal Link */}
                  <div className="w-full flex items-center gap-2.5 mt-3 sm:mt-4 print:mt-2 px-1">
                    <div className="p-1 bg-white border border-stone-400 rounded shrink-0 shadow-2xs">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="Código QR Oficial"
                          className="w-16 h-16 sm:w-20 sm:h-20 print:w-14 print:h-14"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 print:w-14 print:h-14 flex items-center justify-center bg-stone-100 text-stone-400">
                          <QrIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="text-[7.5px] sm:text-[8.5px] print:text-[6.5px] text-stone-700 leading-tight">
                      <p className="font-bold uppercase tracking-wider text-stone-900 font-cinzel">
                        ESCÁNEE PARA ACCEDER A LA BASE DE DATOS DEL PROPIETARIO
                      </p>
                      <p className="font-mono-data text-[7px] sm:text-[8px] print:text-[6px] text-stone-500 mt-0.5">
                        CÓDIGO DE VINCULACIÓN AL SISTEMA
                      </p>
                    </div>
                  </div>

                  {/* P4-QR: acceso a la vista pública de verificación (solo pantalla) */}
                  <button
                    type="button"
                    onClick={() =>
                      window.open(buildVerificationUrl(buildVerificationData(producerData)), '_blank')
                    }
                    className="no-print w-full max-w-[200px] px-3 py-1.5 text-[10px] font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Ver página pública del QR
                  </button>
                </div>
              </div>

              {/* =========================================================================
                  FULL WIDTH LEGAL CONFIRMATION (Matches CERT.jpeg)
                 ========================================================================= */}
              <div className="relative z-10 text-[9px] sm:text-[10px] print:text-[8px] leading-tight text-stone-900 text-justify border-t border-stone-400 pt-2 mb-2 sm:mb-3 print:mb-1 font-sans">
                <p>
                  EL H. AYUNTAMIENTO CONSTITUCIONAL DE PANUCO, VER., HACE CONSTAR QUE LO DISPUESTO POR ARTÍCULOS 30, 31, 32 Y 33 Y DEMÁS RELATIVOS DE LA LEY GANADERA DEL ESTADO: ENARCADOR DE EL(LA) C.{' '}
                  <strong className="font-cinzel">{producerData.fullName.toUpperCase()}</strong>{' '}
                  REGISTRADO BAJO EL NUMERO:{' '}
                  <strong className="font-mono-data">{producerData.registrationNumber || '_________'}</strong>{' '}
                  A FOJAS:{' '}
                  <strong className="font-mono-data">{producerData.folioPage || '_________'}</strong>{' '}
                  DEL LIBRO:{' '}
                  <strong className="font-mono-data">{producerData.bookNumber || '_________'}</strong>{' '}
                  QUE LLEVA ESTE H. AYUNTAMIENTO CON FECHA:{' '}
                  <strong>{formatOfficialDate(producerData.issueDate)}</strong>.
                </p>
              </div>

              {/* MOVIMIENTOS Section */}
              <div className="relative z-10 text-center mb-2">
                <span className="text-[10px] sm:text-xs print:text-[9px] font-cinzel font-bold uppercase tracking-widest text-stone-800">
                  MOVIMIENTOS
                </span>
              </div>

              {/* FIX_LAYOUT_A: FIERRO QUEMADOR centrado, tamaño grande (260x260) */}
              <div className="relative z-10 flex flex-col items-center justify-center my-3 print:my-2">
                <div className="p-3 bg-gradient-to-b from-[#fdfcf9] to-[#f4eee1] border-[3px] border-[#6d1624] rounded-xl shadow-lg">
                  <div className="border-[1.5px] border-[#d97706] p-1.5 rounded-sm bg-[#faf7ee]">
                    <div className="border border-[#7c1a29]/60 p-2 rounded-xs flex items-center justify-center bg-white">
                      {realFierroImage ? (
                        <img
                          src={realFierroImage}
                          alt="Diseño autorizado del fierro quemador"
                          crossOrigin="anonymous"
                          className="w-[220px] h-[220px] sm:w-[260px] sm:h-[260px] print:w-[200px] print:h-[200px] object-contain"
                        />
                      ) : (
                        <div className="w-[220px] h-[220px] sm:w-[260px] sm:h-[260px] print:w-[200px] print:h-[200px] flex flex-col items-center justify-center text-stone-400 text-center px-4">
                          <Award className="w-12 h-12 mb-2 opacity-40" />
                          <span className="text-[10px] font-sans font-bold">FIERRO QUEMADOR</span>
                          <span className="text-[9px] font-sans leading-tight">Aquí se mostrará el fierro aceptado por el sistema de antiduplicidad</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-cinzel font-bold uppercase text-stone-800 mt-2 tracking-widest print:text-[9px]">
                  DISEÑO AUTORIZADO DEL FIERRO QUEMADOR
                </span>
                <span className="text-[8px] sm:text-[9px] print:text-[7.5px] text-stone-500 mt-0.5 font-sans">
                  MARCA DE FUEGO Y HERRAR REGISTRADA
                </span>
              </div>

              {/* =========================================================================
                  SEALS & SIGNATURES ROW (Matches CERT.jpeg with Digital Signature)
                 ========================================================================= */}
              <div className="relative z-10 grid grid-cols-12 gap-2 sm:gap-3 print:gap-1 items-end pt-1 print:pt-0">
                {/* 1. Left: Vigencia & Panuco */}
                <div className="col-span-3 text-center">
                  <div className="h-10 print:h-8 flex flex-col justify-end">
                    <span className="text-[9px] sm:text-[10px] print:text-[7.5px] font-mono-data font-bold text-stone-800">
                      {producerData.validityRange || '2026 - 2029'}
                    </span>
                  </div>
                  <div className="border-t border-stone-800 pt-0.5">
                    <span className="text-[9px] sm:text-[10px] print:text-[8px] font-bold uppercase tracking-wider text-stone-900 block font-cinzel">
                      VIGENCIA
                    </span>
                    <span className="text-[8px] sm:text-[9px] print:text-[7px] text-stone-600 block">
                      PANUCO, VER
                    </span>
                  </div>
                </div>

                {/* 2. Center: FIRMA DEL PRODUCTOR (Digital Signature Display) */}
                <div className="col-span-4 text-center">
                  <div className="h-12 print:h-10 flex items-end justify-center w-full relative">
                    {producerData.producerSignature ? (
                      <img
                        src={producerData.producerSignature}
                        alt="Firma Digital del Productor"
                        className="h-22 max-w-[340px] print:h-18 print:max-w-[280px] object-contain drop-shadow-xs"
                      />
                    ) : (
                      <span className="font-playfair italic text-[9px] sm:text-xs print:text-[8px] text-stone-400">
                        (Firma Autógrafa)
                      </span>
                    )}
                  </div>
                  <div className="border-t border-stone-800 pt-0.5">
                    <span className="text-[9px] sm:text-[10px] print:text-[8px] font-bold uppercase tracking-wider text-stone-900 block font-cinzel">
                      FIRMA DEL PRODUCTOR
                    </span>
                    <span className="text-[7.5px] sm:text-[8.5px] print:text-[6.5px] text-stone-600 truncate block">
                      {producerData.fullName || 'C. TITULAR'}
                    </span>
                  </div>
                </div>

                {/* 3. Center-Right: Embossed Municipal Foil Seal & Hologram */}
                <div className="col-span-2 flex items-center justify-center gap-1.5 print:gap-1">
                  {/* Embossed Gold Municipal Foil Seal of Veracruz */}
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 print:w-10 print:h-10 rounded-full border-2 border-amber-600 shadow-md flex items-center justify-center text-center relative overflow-hidden shrink-0"
                    style={{
                      background: 'radial-gradient(circle, #fde047 0%, #ca8a04 70%, #854d0e 100%)',
                      boxShadow: 'inset 0 0 6px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.2)',
                    }}
                    title="Sello Oficial Foliado en Relieve Dorado"
                  >
                    <div className="absolute inset-0 rounded-full border border-yellow-200 opacity-60 pointer-events-none" />
                    <div className="flex flex-col items-center justify-center leading-none text-amber-950 font-cinzel font-black">
                      <Award className="w-4 h-4 sm:w-5 sm:h-5 print:w-3.5 print:h-3.5 text-amber-950 drop-shadow-xs" />
                      <span className="text-[4px] sm:text-[5px] print:text-[4px] uppercase tracking-tighter mt-0.5">
                        VERACRUZ
                      </span>
                    </div>
                  </div>

                  {/* Hologram Security Sticker */}
                  <div
                    className="w-8 h-8 sm:w-9 sm:h-9 print:w-7 print:h-7 rounded border border-stone-400 shadow-xs flex items-center justify-center text-center relative overflow-hidden shrink-0"
                    style={{
                      background:
                        'linear-gradient(135deg, #a5f3fc 0%, #c084fc 35%, #86efac 70%, #fde047 100%)',
                    }}
                    title="Etiqueta Holográfica de Autenticidad"
                  >
                    <span className="text-[4.5px] sm:text-[5px] print:text-[4px] font-mono-data font-black text-slate-900 tracking-tighter uppercase leading-none">
                      AUTÉNTICO<br />SEGURIDAD
                    </span>
                  </div>
                </div>

                {/* 4. Right: Date Line (Matches CERT.jpeg) */}
                <div className="col-span-3 text-center">
                  <div className="h-10 print:h-8 flex flex-col justify-end">
                    <span className="text-[8px] sm:text-[9px] print:text-[7px] text-stone-700 font-mono-data">
                      {producerData.issueDate ? formatOfficialDate(producerData.issueDate) : '23 DE SEPTIEMBRE DEL 2026'}
                    </span>
                  </div>
                  <div className="border-t border-stone-800 pt-0.5">
                    <span className="text-[8px] sm:text-[9.5px] print:text-[7.5px] text-stone-900 uppercase font-sans leading-tight block">
                      PANUCO, VER A ___ DE _______ DEL 20___
                    </span>
                  </div>
                </div>
              </div>
            </TexasGuillocheCertificateBorder>
          </div>
        </div>
      )}

      {/* =========================================================================
          DOCUMENT 2: CREDENCIAL GANADERA OFICIAL (TAMAÑO TARJETA ESTÁNDAR CR-80)
         ========================================================================= */}
      {(printDocSelection === 'both' || printDocSelection === 'id_card') && (
        <div className={`bg-white shadow-xl border border-stone-300 rounded-xl p-3 sm:p-6 w-full max-w-[840px] mx-auto mb-8 sm:mb-12 overflow-hidden print:p-2 print:border-none print:shadow-none ${!validationState.isValid ? 'print:hidden' : ''}`}>
          {/* Header Controls (hidden on print) */}
          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-200 pb-3 mb-4 gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <h3 className="font-cinzel font-bold text-stone-900 text-xs sm:text-sm">
                  Credencial Ganadera Oficial (Tamaño Tarjeta Estándar CR-80: 54 × 85.6 mm)
                </h3>
                <p className="text-[11px] text-stone-500">
                  Formato de bolsillo listo para enmicado térmico con marcas de corte y doblado.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Orientation switcher */}
              <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded text-xs">
                <button
                  type="button"
                  onClick={() => setCardOrientation('vertical')}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    cardOrientation === 'vertical' ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Vertical
                </button>
                <button
                  type="button"
                  onClick={() => setCardOrientation('horizontal')}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    cardOrientation === 'horizontal' ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Horizontal
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowCertPhotoModal(true)}
                className="text-xs text-amber-800 hover:text-amber-950 font-semibold cursor-pointer flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded shadow-2xs transition-colors"
                title="Tomar fotografía con cámara web o celular, o subir archivo"
              >
                <Camera className="w-3.5 h-3.5 text-amber-700" />
                <span>Foto Productor (Cámara/Subir)</span>
              </button>
            </div>
          </div>

          {/* Printable Card Sheet with Trim & Fold Guidelines */}
          <div ref={cardContainerRef} className="print-card-sheet flex flex-col items-center">
            {/* Trim instruction banner */}
            <div className="flex items-center gap-2 text-[10px] text-stone-500 mb-3 border-dashed border-b border-stone-300 pb-1 w-full max-w-[500px] justify-center text-center font-mono-data">
              <Scissors className="w-3.5 h-3.5 text-stone-400" />
              <span>LÍNEA GUÍA DE CORTE Y ENMICADO · FORMATO CREDENCIAL ESTÁNDAR CR-80</span>
            </div>

            {/* CARD LAYOUT: ANVERSO (FRENTE) Y REVERSO (DORSO) */}
            {cardOrientation === 'vertical' ? (
              /* VERTICAL CR-80 FORMAT (54mm x 85.6mm per side) */
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 print:gap-4 print:flex-row">
                {/* 1. ANVERSO (FRENTE) */}
                <div className="card-cr80-vertical w-[260px] h-[410px] sm:w-[54mm] sm:h-[85.6mm] bg-gradient-to-b from-stone-900 via-stone-850 to-amber-950 text-white rounded-xl shadow-xl p-2.5 flex flex-col justify-between border-2 border-amber-500/70 relative overflow-hidden print:shadow-none print:border-amber-600">
                  {/* Security guilloché header banner */}
                  <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-amber-600/30 via-emerald-600/30 to-purple-600/30 pointer-events-none opacity-50" />

                  {/* Header */}
                  <div className="relative z-10 text-center border-b border-amber-500/40 pb-1.5">
                    <div className="flex items-center justify-between px-1 mb-0.5">
                      <Award className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="min-w-0 px-1">
                        <p className="text-[7.5px] font-cinzel font-bold tracking-wider text-amber-300 truncate">
                          H. AYUNTAMIENTO DE PÁNUCO
                        </p>
                        <p className="text-[6.5px] font-semibold text-stone-300 uppercase">
                          CREDENCIAL GANADERA OFICIAL
                        </p>
                      </div>
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                    <div className="bg-amber-500/25 text-amber-300 text-[6.5px] font-mono-data py-0.5 rounded truncate px-1 font-bold">
                      FOLIO: {producerData.folio} · {producerData.validityRange}
                    </div>
                  </div>

                  {/* Photo & Brand Matrix Section */}
                  <div className="relative z-10 grid grid-cols-2 gap-1.5 items-center my-1">
                    {/* Producer Photo */}
                    <div className="flex flex-col items-center">
                      <div
                        onClick={() => setShowCertPhotoModal(true)}
                        className="w-18 h-22 sm:w-16 sm:h-20 bg-stone-800 border border-amber-400/80 rounded overflow-hidden shadow-inner flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-amber-300 transition-all group"
                        title="Haga clic para inspeccionar, evaluar o volver a tomar la fotografía"
                      >
                        {producerPhoto ? (
                          <img src={producerPhoto} alt="Foto" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="text-center p-1 text-stone-400 group-hover:text-amber-300">
                            <Camera className="w-5 h-5 mx-auto mb-0.5 opacity-50 group-hover:opacity-100" />
                            <span className="text-[6px] block">Tomar Foto</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[6px] text-stone-300 mt-0.5 uppercase font-semibold text-center truncate w-full">
                        TITULAR
                      </span>
                    </div>

                    {/* Brand Mini Canvas */}
                    <div className="flex flex-col items-center">
                      <div className="w-18 h-22 sm:w-16 sm:h-20 bg-stone-100 border border-amber-400/80 rounded overflow-hidden shadow-inner flex items-center justify-center p-0.5">
                        <canvas ref={idCanvasRef} width={140} height={140} className="w-full h-full object-contain" />
                      </div>
                      <span className="text-[6px] text-amber-300 mt-0.5 uppercase font-semibold text-center truncate w-full">
                        FIERRO REGISTRADO
                      </span>
                    </div>
                  </div>

                  {/* Producer Info */}
                  <div className="relative z-10 bg-black/50 border border-stone-700/80 rounded p-1.5 text-[7.5px] space-y-0.5">
                    <div>
                      <span className="text-[6px] text-stone-400 block uppercase leading-none">Titular:</span>
                      <span className="font-bold text-amber-200 font-cinzel truncate block text-[8px] leading-tight">
                        {producerData.fullName}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[7px]">
                      <div className="truncate">
                        <span className="text-[5.5px] text-stone-400 uppercase block">Predio:</span>
                        <span className="font-semibold text-stone-200 truncate block">{producerData.propertyName}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-[5.5px] text-stone-400 uppercase block">Localidad / Mun:</span>
                        <span className="font-semibold text-stone-200 truncate block">{producerData.ejido}, {producerData.municipio || 'Pánuco'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[7px] pt-0.5 border-t border-stone-700/60">
                      <div className="truncate">
                        <span className="text-[5.5px] text-stone-400 uppercase block">UPP:</span>
                        <span className="font-mono-data font-bold text-emerald-300 truncate block">{producerData.uppKey}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-[5.5px] text-stone-400 uppercase block">Hato:</span>
                        <span className="font-mono-data text-stone-200 truncate block">{producerData.cattleCount} {producerData.species}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Strip */}
                  <div className="relative z-10 border-t border-stone-700 pt-1 text-[6px] text-stone-400 flex items-center justify-between">
                    <span>ANVERSO · PÁNUCO, VER.</span>
                    <span className="text-amber-300 font-bold font-cinzel">VÁLIDO</span>
                  </div>
                </div>

                {/* FOLD / CUT DIVIDER (visible on screen and print) */}
                <div className="flex sm:flex-col items-center justify-center text-stone-400 text-[9px] font-mono-data py-1">
                  <div className="border-l-2 border-dashed border-stone-300 h-8 sm:h-32 mx-2 hidden sm:block" />
                  <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded text-[8px] border border-stone-200 whitespace-nowrap">
                    ✂️ Doblar aquí
                  </span>
                  <div className="border-l-2 border-dashed border-stone-300 h-8 sm:h-32 mx-2 hidden sm:block" />
                </div>

                {/* 2. REVERSO (DORSO) */}
                <div className="card-cr80-vertical w-[260px] h-[410px] sm:w-[54mm] sm:h-[85.6mm] bg-gradient-to-b from-stone-900 via-stone-850 to-stone-950 text-white rounded-xl shadow-xl p-2.5 flex flex-col justify-between border-2 border-amber-500/70 relative overflow-hidden print:shadow-none print:border-amber-600">
                  {/* Header */}
                  <div className="relative z-10 text-center border-b border-stone-700 pb-1">
                    <p className="text-[7.5px] font-cinzel font-bold text-amber-300">
                      REGISTRO PÚBLICO AGROPECUARIO MUNICIPAL
                    </p>
                    <p className="text-[6.5px] text-stone-400 uppercase">
                      H. AYUNTAMIENTO CONSTITUCIONAL DE PÁNUCO
                    </p>
                  </div>

                  {/* Center QR & Security Seal */}
                  <div className="relative z-10 flex flex-col items-center justify-center my-1 bg-black/40 border border-stone-700 rounded p-1.5">
                    {qrDataUrl && (
                      <img src={qrDataUrl} alt="QR Verificación" className="w-20 h-20 bg-white p-0.5 rounded shadow-xs" />
                    )}
                    <span className="text-[6.5px] font-mono-data text-emerald-400 font-bold mt-1">
                      SHA256:PAN-{producerData.folio}
                    </span>
                    <span className="text-[5.5px] text-stone-400 text-center">
                      Escanee para verificar vigencia oficial en padrón
                    </span>
                  </div>

                  {/* Legal Quote */}
                  <div className="relative z-10 text-[6px] text-stone-300 text-justify leading-tight bg-stone-800/60 p-1 rounded border border-stone-700">
                    Documento expedido conforme a la Ley Ganadera de Veracruz. Obligatorio para movilización, guías de tránsito y facturación ganadera.
                  </div>

                  {/* Official Signatures Mini with Producer Signature */}
                  <div className="relative z-10 grid grid-cols-3 gap-1 border-t border-stone-700 pt-1 text-center">
                    <div>
                      {producerData.producerSignature ? (
                        <div className="h-8 flex items-center justify-center">
                          <img src={producerData.producerSignature} alt="Firma Titular" className="max-h-full max-w-full object-contain filter invert" />
                        </div>
                      ) : (
                        <span className="font-playfair italic text-[6px] text-stone-400 block h-8 leading-8">(Firma)</span>
                      )}
                      <span className="text-[5px] text-stone-300 uppercase block font-bold border-t border-stone-600 pt-0.5 truncate">
                        TITULAR
                      </span>
                    </div>
                    <div>
                      <div className="h-5 flex items-center justify-center">
                        <span className="font-playfair italic text-[6px] text-stone-400 block truncate">
                          {municipalConfig.directorName}
                        </span>
                      </div>
                      <span className="text-[5px] text-stone-300 uppercase block font-bold border-t border-stone-600 pt-0.5">
                        DIR. FOMENTO
                      </span>
                    </div>
                    <div>
                      <div className="h-5 flex items-center justify-center">
                        <span className="font-playfair italic text-[6px] text-stone-400 block truncate">
                          {municipalConfig.treasurerName}
                        </span>
                      </div>
                      <span className="text-[5px] text-stone-300 uppercase block font-bold border-t border-stone-600 pt-0.5">
                        TESORERÍA
                      </span>
                    </div>
                  </div>

                  {/* Bottom Strip */}
                  <div className="relative z-10 text-[6px] text-stone-500 flex items-center justify-between pt-0.5">
                    <span>REVERSO OFICIAL</span>
                    <span>CR-80 (54 × 85.6 mm)</span>
                  </div>
                </div>
              </div>
            ) : (
              /* HORIZONTAL CR-80 FORMAT (85.6mm x 54mm per side) */
              <div className="flex flex-col items-center justify-center gap-4 print:gap-3">
                {/* 1. ANVERSO HORIZONTAL */}
                <div className="card-cr80-horizontal w-[360px] h-[228px] sm:w-[85.6mm] sm:h-[54mm] bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white rounded-xl shadow-xl p-2.5 flex flex-col justify-between border-2 border-amber-500/70 relative overflow-hidden print:shadow-none print:border-amber-600">
                  <div className="flex items-center justify-between border-b border-amber-500/40 pb-1">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <p className="text-[7.5px] font-cinzel font-bold text-amber-300">
                          H. AYUNTAMIENTO DE PÁNUCO, VERACRUZ
                        </p>
                        <p className="text-[6.5px] text-stone-300 uppercase">
                          CREDENCIAL GANADERA OFICIAL (HORIZONTAL CR-80)
                        </p>
                      </div>
                    </div>
                    <span className="text-[6.5px] font-mono-data bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded font-bold">
                      {producerData.folio}
                    </span>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center my-1">
                    <div className="col-span-3 flex justify-center">
                      <div
                        onClick={() => setShowCertPhotoModal(true)}
                        className="w-14 h-16 bg-stone-800 border border-amber-400 rounded overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-amber-300 transition-all group"
                        title="Haga clic para inspeccionar, evaluar o volver a tomar la fotografía"
                      >
                        {producerPhoto ? (
                          <img src={producerPhoto} alt="Foto" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="text-center p-1 text-stone-400 group-hover:text-amber-300">
                            <Camera className="w-4 h-4 mx-auto opacity-60 group-hover:opacity-100" />
                            <span className="text-[5.5px] block mt-0.5">Tomar Foto</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col-span-6 text-[7px] space-y-0.5">
                      <p className="font-cinzel font-bold text-amber-200 text-[8px] truncate">
                        {producerData.fullName}
                      </p>
                      <p className="text-stone-300 truncate">
                        Predio: <strong className="text-white">{producerData.propertyName}</strong>
                      </p>
                      <p className="text-stone-300 truncate">
                        Ejido: <strong className="text-white">{producerData.ejido}, {producerData.municipio || 'Pánuco'}, Ver.</strong>
                      </p>
                      <p className="font-mono-data text-emerald-300 truncate">
                        UPP: {producerData.uppKey} · {producerData.cattleCount} {producerData.species}
                      </p>
                      <p className="text-stone-400 text-[6.5px]">
                        Vigencia: {producerData.validityRange}
                      </p>
                    </div>

                    <div className="col-span-3 flex flex-col items-center">
                      <div className="w-14 h-16 bg-stone-100 border border-amber-400 rounded p-0.5 flex items-center justify-center">
                        <canvas ref={idCanvasBackRef} width={100} height={100} className="w-full h-full object-contain" />
                      </div>
                      <span className="text-[5.5px] text-amber-300 mt-0.5 font-bold">FIERRO</span>
                    </div>
                  </div>

                  <div className="border-t border-stone-700 pt-0.5 text-[6px] text-stone-400 flex items-center justify-between">
                    <span>DIR. FOMENTO AGROPECUARIO · PÁNUCO</span>
                    <span>ANVERSO 85.6 × 54 mm</span>
                  </div>
                </div>

                {/* Cut line */}
                <div className="flex items-center gap-2 text-stone-400 text-[8px] font-mono-data">
                  <span>✂️ Cortar y doblar aquí para plastificar</span>
                </div>

                {/* 2. REVERSO HORIZONTAL */}
                <div className="card-cr80-horizontal w-[360px] h-[228px] sm:w-[85.6mm] sm:h-[54mm] bg-gradient-to-r from-stone-950 via-stone-900 to-stone-900 text-white rounded-xl shadow-xl p-2.5 flex flex-col justify-between border-2 border-amber-500/70 relative overflow-hidden print:shadow-none print:border-amber-600">
                  <div className="flex items-center justify-between border-b border-stone-700 pb-0.5 text-[7px]">
                    <span className="font-cinzel font-bold text-amber-300">REGISTRO PÚBLICO AGROPECUARIO MUNICIPAL</span>
                    <span className="font-mono-data text-emerald-400">VALIDEZ OFICIAL</span>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center my-1">
                    <div className="col-span-4 flex flex-col items-center">
                      {qrDataUrl && (
                        <img src={qrDataUrl} alt="QR" className="w-16 h-16 bg-white p-0.5 rounded shadow-xs" />
                      )}
                      <span className="text-[5.5px] font-mono-data text-stone-300 mt-0.5">SHA256:PAN</span>
                    </div>

                    <div className="col-span-8 text-[6.5px] space-y-1 text-stone-300 leading-tight">
                      <p>
                        Acredita registro y legítima propiedad del fierro conforme a la Ley Ganadera de Veracruz.
                      </p>
                      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-stone-700 text-center">
                        <div>
                          {producerData.producerSignature ? (
                            <div className="h-7 flex items-center justify-center">
                              <img src={producerData.producerSignature} alt="Firma Titular" className="max-h-full max-w-full object-contain filter invert" />
                            </div>
                          ) : (
                            <p className="font-playfair italic text-[5.5px] text-stone-400 h-7 leading-7">(Firma)</p>
                          )}
                          <p className="text-[5px] uppercase font-bold text-stone-300 border-t border-stone-600 truncate">TITULAR</p>
                        </div>
                        <div>
                          <div className="h-4 flex items-center justify-center">
                            <p className="font-playfair italic text-[5.5px] text-stone-400 truncate">{municipalConfig.directorName}</p>
                          </div>
                          <p className="text-[5px] uppercase font-bold text-stone-300 border-t border-stone-600">FOMENTO</p>
                        </div>
                        <div>
                          <div className="h-4 flex items-center justify-center">
                            <p className="font-playfair italic text-[5.5px] text-stone-400 truncate">{municipalConfig.treasurerName}</p>
                          </div>
                          <p className="text-[5px] uppercase font-bold text-stone-300 border-t border-stone-600">TESORERÍA</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-stone-700 pt-0.5 text-[6px] text-stone-500 flex items-center justify-between">
                    <span>PÁNUCO, VERACRUZ · EXPEDIDO: {producerData.issueDate}</span>
                    <span>REVERSO 85.6 × 54 mm</span>
                  </div>
                </div>
              </div>
            )}

            {/* Explanatory note */}
            <p className="text-center text-[10px] text-stone-500 mt-3 no-print">
              Dimensiones de impresión calibradas a <strong>54 × 85.6 mm</strong> (estándar internacional ISO/IEC 7810 ID-1 / CR-80) para credencial de bolsillo plastificable.
            </p>
          </div>
        </div>
      )}
      </>
      )}

      {/* =========================================================================
          SECCIÓN AL FINAL DE LA IMPRESIÓN: DESPACHO RÁPIDO POR WHATSAPP Y EMAIL
         ========================================================================= */}
      <DocumentDispatchSection
        producerData={producerData}
        brandConfig={brandConfig}
        municipalConfig={municipalConfig}
        onDownloadPdf={() => handleDownloadPdf()}
        isGeneratingPdf={isGeneratingPdf}
        isValid={validationState.isValid}
        onShowValidationModal={() => setShowValidationModal(true)}
      />

      {/* Official Print Blocker (Rendered physically on paper if printed while incomplete) */}
      {!validationState.isValid && (
        <div className="print-only fixed inset-0 bg-white z-50 p-8 flex flex-col items-center justify-center text-center">
          <div className="border-4 border-rose-800 bg-rose-50/90 p-8 rounded-2xl max-w-xl mx-auto shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <h1 className="text-xl font-cinzel font-black tracking-wider text-rose-900 mb-1 uppercase">
              IMPRESIÓN BLOQUEADA POR EL SISTEMA MUNICIPAL
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-rose-800 mb-4 font-mono-data">
              EXPEDIENTE GANADERO INCOMPLETO · TRÁMITE NO CONCLUIDO
            </p>
            <p className="text-xs leading-relaxed text-stone-700 mb-4">
              De conformidad con la Ley Ganadera del Estado de Veracruz de Ignacio de la Llave, la Dirección de Fomento Agropecuario del H. Ayuntamiento Constitucional de Pánuco tiene estrictamente prohibido emitir, certificar o imprimir títulos de propiedad de fierro de herrar y credenciales ganaderas con datos faltantes o sin cotejo legal.
            </p>
            <div className="bg-white border border-rose-300 rounded-lg p-3 text-left mb-4">
              <span className="block font-bold text-[11px] text-rose-900 mb-1">
                Motivos del Bloqueo ({validationState.errors.length} campos pendientes):
              </span>
              <ul className="list-disc pl-5 text-[10px] text-stone-700 space-y-0.5">
                {validationState.errors.slice(0, 8).map((err, i) => (
                  <li key={i}><strong className="text-stone-900">{err.label}:</strong> {err.message}</li>
                ))}
              </ul>
            </div>
            <p className="text-[10px] text-stone-500 font-mono-data">
              H. AYUNTAMIENTO DE PÁNUCO, VERACRUZ · DIRECCIÓN DE FOMENTO AGROPECUARIO
            </p>
          </div>
        </div>
      )}

      {/* Validation Errors Modal Dialog */}
      <ValidationErrorsModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        errors={validationState.errors}
        actionAttempted="print"
        onNavigateToStep={onGoToRegistro}
      />

      {/* Modal de Captura de Fotografía Oficial */}
      <PhotoCaptureModal
        isOpen={showCertPhotoModal}
        onClose={() => setShowCertPhotoModal(false)}
        onPhotoCaptured={(dataUrl) => {
          setProducerPhoto(dataUrl);
          if (onChangeProducerData) {
            onChangeProducerData({ ...producerData, producerPhoto: dataUrl });
          }
        }}
        currentPhoto={producerPhoto}
        producerName={producerData.fullName}
      />
    </div>
  );
};
