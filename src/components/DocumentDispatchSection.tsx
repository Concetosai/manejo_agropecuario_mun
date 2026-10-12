import React, { useState, useMemo } from 'react';
import { ProducerData, BrandConfig, MunicipalConfig } from '../types';
import { recordAuditLog } from '../utils/auditAuth';
import {
  MessageSquare,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Share2,
  FileDown,
  Loader2,
  Send,
  Smartphone,
  ShieldCheck,
  Info,
  Clock,
  CheckCircle2,
  AlertCircle,
  QrCode,
  FileText,
} from 'lucide-react';

interface DocumentDispatchSectionProps {
  producerData: ProducerData;
  brandConfig: BrandConfig;
  municipalConfig: MunicipalConfig;
  onDownloadPdf: () => Promise<void> | void;
  isGeneratingPdf?: boolean;
  isValid: boolean;
  onShowValidationModal?: () => void;
}

export const DocumentDispatchSection: React.FC<DocumentDispatchSectionProps> = ({
  producerData,
  brandConfig,
  municipalConfig,
  onDownloadPdf,
  isGeneratingPdf = false,
  isValid,
  onShowValidationModal,
}) => {
  // Local state for editable recipient destinations
  const [recipientPhone, setRecipientPhone] = useState(producerData.phone || '');
  const [recipientEmail, setRecipientEmail] = useState(producerData.email || '');

  // Active channel tab: 'both', 'whatsapp', 'email'
  const [activeTab, setActiveTab] = useState<'both' | 'whatsapp' | 'email'>('both');

  // Clipboard copy state feedback
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Dispatch history tracking for current session
  const [dispatchHistory, setDispatchHistory] = useState<
    Array<{ type: 'whatsapp' | 'email' | 'share'; timestamp: string; target: string }>
  >([]);

  // Feedback banner
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Clean Mexican phone number for WhatsApp wa.me API
  const cleanPhoneForWa = useMemo(() => {
    let digits = (recipientPhone || '').replace(/\D/g, '');
    if (!digits) return '';
    // If it has 10 digits (Mexican national standard), prepend 52
    if (digits.length === 10) {
      digits = `52${digits}`;
    } else if (digits.length === 12 && digits.startsWith('52')) {
      // already has 52
    } else if (digits.length === 13 && digits.startsWith('521')) {
      // old mobile prefix 521 -> standardize to 52
      digits = `52${digits.slice(3)}`;
    }
    return digits;
  }, [recipientPhone]);

  // Formatted official WhatsApp message
  const whatsappMessage = useMemo(() => {
    const initials = brandConfig.initials || 'S/N';
    const folio = producerData.folio || 'S/F';
    const producer = producerData.fullName || 'Productor Ganadero';
    const predio = producerData.propertyName || 'Predio no especificado';
    const ejido = producerData.ejido || 'Pánuco';
    const upp = producerData.uppKey || '30-123-XXXX-XXX';
    const vigencia = producerData.validityRange || '2026 - 2029';
    const cabezas = `${producerData.cattleCount || 0} ${producerData.species || 'BOVINO'}`;
    const verifyUrl = `https://panuco.gob.mx/ganaderia/verificar?folio=${encodeURIComponent(folio)}`;

    return (
      `🏛️ *H. AYUNTAMIENTO CONSTITUCIONAL DE PÁNUCO, VERACRUZ*\n` +
      `*DIRECCIÓN DE FOMENTO AGROPECUARIO Y DESARROLLO RURAL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Estimado(a) Productor(a): *${producer}*\n\n` +
      `Le informamos que su *Título Oficial de Registro de Fierro Quemador* y su *Credencial Ganadera Oficial* han sido expedidos exitosamente con plena validez jurídica.\n\n` +
      `📋 *DATOS OFICIALES DEL EXPEDIENTE:*\n` +
      `• *Folio Notarial:* ${folio}\n` +
      `• *No. de Registro:* ${producerData.registrationNumber || '---'} (Libro ${producerData.bookNumber || '---'}, Foja ${producerData.folioPage || '---'})\n` +
      `• *Clave UPP:* ${upp}\n` +
      `• *Predio Registrado:* ${predio}, Ejido ${ejido}, Pánuco, Ver.\n` +
      `• *Hectáreas:* ${producerData.surfaceHectares || 0} Has. (${producerData.tenureType || 'PROPIEDAD'})\n` +
      `• *Cabezas / Especie:* ${cabezas}\n` +
      `• *Monograma / Iniciales:* [ ${initials} ]\n` +
      `• *Vigencia Oficial:* ${vigencia}\n` +
      `• *Fecha de Asiento:* ${producerData.issueDate || '2026-09-24'}\n\n` +
      `🔒 *VERIFICACIÓN CON CÓDIGO QR Y SELLO DIGITAL:*\n` +
      `Su registro cuenta con candados criptográficos y sello del Ayuntamiento. Puede consultar su autenticidad en:\n` +
      `${verifyUrl}\n\n` +
      `📄 *DOCUMENTO PDF SEGURO:*\n` +
      `Conserve este mensaje y el archivo PDF oficial adjunto como comprobante para movilización de ganado (REEMO), inspección sanitaria y trámites ante la Asociación Ganadera Local.\n\n` +
      `_Atentamente:_\n` +
      `*${municipalConfig.directorName || 'Dirección de Fomento Agropecuario'}*\n` +
      `_${municipalConfig.directorTitle || 'Director de Fomento Agropecuario'}_ · H. Ayuntamiento de Pánuco, Ver.`
    );
  }, [producerData, brandConfig, municipalConfig]);

  // Formatted official Email subject and body
  const emailSubject = useMemo(() => {
    const folio = producerData.folio || 'EXPEDIENTE';
    return `Expedición de Título Oficial de Fierro de Herrar - Folio ${folio} - H. Ayuntamiento de Pánuco, Ver.`;
  }, [producerData.folio]);

  const emailBody = useMemo(() => {
    const initials = brandConfig.initials || 'S/N';
    const folio = producerData.folio || 'S/F';
    const producer = producerData.fullName || 'Productor Ganadero';
    const predio = producerData.propertyName || 'Predio no especificado';
    const ejido = producerData.ejido || 'Pánuco';
    const upp = producerData.uppKey || '30-123-XXXX-XXX';
    const vigencia = producerData.validityRange || '2026 - 2029';
    const cabezas = `${producerData.cattleCount || 0} ${producerData.species || 'BOVINO'}`;
    const verifyUrl = `https://panuco.gob.mx/ganaderia/verificar?folio=${encodeURIComponent(folio)}`;

    return (
      `H. AYUNTAMIENTO CONSTITUCIONAL DE PÁNUCO, VERACRUZ\n` +
      `DIRECCIÓN DE FOMENTO AGROPECUARIO Y DESARROLLO RURAL\n` +
      `============================================================\n\n` +
      `NOTIFICACIÓN OFICIAL DE EXPEDICIÓN DE MARCA DE HERRAR Y CREDENCIAL GANADERA\n\n` +
      `Estimado(a) Productor(a): ${producer}\n\n` +
      `Por medio del presente conducto, la Dirección de Fomento Agropecuario del Municipio de Pánuco, Veracruz, le notifica que su trámite registral de fierro quemador ha concluido satisfactoriamente conforme a las disposiciones de la Ley Ganadera del Estado de Veracruz de Ignacio de la Llave.\n\n` +
      `RESUMEN DEL ASIENTO REGISTRAL:\n` +
      `------------------------------------------------------------\n` +
      `• Folio Notarial: ${folio}\n` +
      `• Número de Registro: ${producerData.registrationNumber || '---'}\n` +
      `• Libro Municipal: ${producerData.bookNumber || '---'} · Foja: ${producerData.folioPage || '---'}\n` +
      `• Clave UPP (SINIIGA): ${upp}\n` +
      `• Predio Acreditado: ${predio}\n` +
      `• Localidad / Ejido: ${ejido}, Municipio de Pánuco, Veracruz\n` +
      `• Superficie: ${producerData.surfaceHectares || 0} Hectáreas (${producerData.tenureType || 'PROPIEDAD'})\n` +
      `• Padrón y Especie: ${cabezas}\n` +
      `• Iniciales / Monograma Registrado: [ ${initials} ]\n` +
      `• Periodo de Vigencia: ${vigencia}\n` +
      `• Fecha de Expedición: ${producerData.issueDate || '2026-09-24'}\n\n` +
      `VERIFICACIÓN DE AUTENTICIDAD DIGITAL:\n` +
      `El documento cuenta con código QR y certificación digital oficial. Puede verificar la vigencia de su fierro quemador en cualquier momento en el portal municipal:\n` +
      `${verifyUrl}\n\n` +
      `INSTRUCCIONES DE USO:\n` +
      `1. Descargue y guarde el archivo PDF oficial con sellos de seguridad.\n` +
      `2. Imprima el Título en tamaño carta para sus expedientes legales de tenencia de la tierra.\n` +
      `3. La Credencial Ganadera de bolsillo (CR-80) debe plastificarse para su portación en movilizaciones de ganado.\n\n` +
      `Atentamente,\n` +
      `${municipalConfig.directorName || 'Dirección de Fomento Agropecuario'}\n` +
      `${municipalConfig.directorTitle || 'Director de Fomento Agropecuario'}\n` +
      `H. Ayuntamiento Constitucional de Pánuco, Veracruz\n` +
      `"Cuna del Huapango"`
    );
  }, [producerData, brandConfig, municipalConfig]);

  // Handle WhatsApp Dispatch
  const handleSendWhatsapp = () => {
    if (!isValid) {
      onShowValidationModal?.();
      return;
    }

    if (!cleanPhoneForWa) {
      alert('Por favor ingrese un número de teléfono o celular válido para enviar por WhatsApp.');
      return;
    }

    const encodedText = encodeURIComponent(whatsappMessage);
    const waUrl = `https://wa.me/${cleanPhoneForWa}?text=${encodedText}`;

    // Record in official municipal audit log
    recordAuditLog({
      actionType: 'ENVIO_DOCUMENTO_WHATSAPP',
      folioAffected: producerData.folio,
      producerAffected: producerData.fullName,
      details: `Expediente enviado por WhatsApp al número +${cleanPhoneForWa} (Folio: ${producerData.folio}, Titular: ${producerData.fullName}).`,
    });

    // Record in local session log
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDispatchHistory((prev) => [
      { type: 'whatsapp', timestamp: timeStr, target: `+${cleanPhoneForWa}` },
      ...prev,
    ]);

    setSuccessBanner(`Se ha preparado y abierto el chat de WhatsApp con el productor (+${cleanPhoneForWa}).`);
    setTimeout(() => setSuccessBanner(null), 5000);

    // Open WhatsApp
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle Email Dispatch
  const handleSendEmail = () => {
    if (!isValid) {
      onShowValidationModal?.();
      return;
    }

    const targetEmail = (recipientEmail || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      alert('Por favor ingrese una dirección de correo electrónico válida.');
      return;
    }

    const mailtoUrl = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;

    // Record in official audit log
    recordAuditLog({
      actionType: 'ENVIO_DOCUMENTO_EMAIL',
      folioAffected: producerData.folio,
      producerAffected: producerData.fullName,
      details: `Expediente enviado por Correo Electrónico a ${targetEmail} (Folio: ${producerData.folio}, Asunto: ${emailSubject}).`,
    });

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDispatchHistory((prev) => [
      { type: 'email', timestamp: timeStr, target: targetEmail },
      ...prev,
    ]);

    setSuccessBanner(`Se ha abierto el cliente de correo para enviar el expediente a ${targetEmail}.`);
    setTimeout(() => setSuccessBanner(null), 5000);

    // Open mail client
    window.location.href = mailtoUrl;
  };

  // Copy WhatsApp text to clipboard
  const handleCopyWhatsapp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopiedWhatsapp(true);
      setTimeout(() => setCopiedWhatsapp(false), 2500);
    } catch {
      alert('No se pudo copiar el texto automáticamente. Puede seleccionarlo manualmente.');
    }
  };

  // Copy Email text to clipboard
  const handleCopyEmail = async () => {
    try {
      const fullText = `Asunto: ${emailSubject}\n\n${emailBody}`;
      await navigator.clipboard.writeText(fullText);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch {
      alert('No se pudo copiar el texto automáticamente.');
    }
  };

  // Web Share API (native share on mobile)
  const handleNativeShare = async () => {
    if (!navigator.share) {
      handleSendWhatsapp();
      return;
    }

    try {
      await navigator.share({
        title: emailSubject,
        text: whatsappMessage,
        url: `https://panuco.gob.mx/ganaderia/verificar?folio=${encodeURIComponent(producerData.folio)}`,
      });

      recordAuditLog({
        actionType: 'ENVIO_DOCUMENTO_WHATSAPP',
        folioAffected: producerData.folio,
        producerAffected: producerData.fullName,
        details: `Expediente compartido mediante Compartir Nativo del dispositivo (Folio: ${producerData.folio}).`,
      });

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDispatchHistory((prev) => [
        { type: 'share', timestamp: timeStr, target: 'Dispositivo / Compartir' },
        ...prev,
      ]);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        handleSendWhatsapp();
      }
    }
  };

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div id="seccion-envio-documentos" className="no-print mt-10 pt-8 border-t-2 border-amber-200/80">
      {/* Module Title Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 rounded-2xl p-5 sm:p-7 text-white shadow-xl border border-amber-500/40 relative overflow-hidden">
        {/* Subtle background ornamentation */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 border-b border-stone-700/80 pb-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl text-white shadow-lg shrink-0">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                  Despacho Rápido Digital
                </span>
                <span className="text-[10px] text-stone-300 font-mono-data">
                  Folio: <strong className="text-amber-300">{producerData.folio}</strong>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-cinzel font-bold text-white mt-1">
                Enviar Expediente por WhatsApp o Correo Electrónico
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 max-w-2xl mt-0.5">
                Agilice la entrega de documentos al ganadero enviando el comprobante oficial con código QR y datos del fierro directamente a su teléfono móvil o email.
              </p>
            </div>
          </div>

          {/* Quick PDF download button right on top */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onDownloadPdf()}
              disabled={isGeneratingPdf}
              className="px-4 py-2 text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Descargar archivo PDF antes de enviar para adjuntarlo en el chat o correo"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-950" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5 text-stone-950" />
                  <span>Descargar PDF para Adjuntar</span>
                </>
              )}
            </button>

            {hasNativeShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="px-3.5 py-2 text-xs font-bold text-white bg-stone-700 hover:bg-stone-600 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartir</span>
              </button>
            )}
          </div>
        </div>

        {/* Success Feedback Notification */}
        {successBanner && (
          <div className="mt-4 bg-emerald-900/90 border border-emerald-400 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-100 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-300 hover:text-white font-bold text-[11px] ml-2"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Producer Summary Header Pill */}
        <div className="mt-4 bg-stone-900/80 rounded-xl p-3 border border-stone-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-cinzel font-bold text-xs flex items-center justify-center">
              {brandConfig.initials || 'RP'}
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Productor Titular</span>
              <span className="font-bold text-white text-sm">{producerData.fullName || 'No especificado'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-stone-300 text-[11px] font-mono-data">
            <span>UPP: <strong className="text-emerald-400">{producerData.uppKey}</strong></span>
            <span>Predio: <strong className="text-white">{producerData.propertyName}</strong> ({producerData.ejido})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('both')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'both' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-300 hover:bg-stone-800'
              }`}
            >
              Ambos Canales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                activeTab === 'whatsapp' ? 'bg-emerald-600 text-white font-bold' : 'text-stone-300 hover:bg-stone-800'
              }`}
            >
              <MessageSquare className="w-3 h-3 text-emerald-300" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                activeTab === 'email' ? 'bg-blue-600 text-white font-bold' : 'text-stone-300 hover:bg-stone-800'
              }`}
            >
              <Mail className="w-3 h-3 text-blue-300" />
              Correo
            </button>
          </div>
        </div>

        {/* 2-COLUMN CHANNELS: WHATSAPP & EMAIL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          {/* =========================================================================
              CANAL 1: WHATSAPP
             ========================================================================= */}
          {(activeTab === 'both' || activeTab === 'whatsapp') && (
            <div className="bg-stone-900/90 border border-emerald-600/40 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
                        Canal 1: WhatsApp Oficial
                        <span className="text-[10px] bg-emerald-950 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.2 rounded font-normal">
                          Inmediato
                        </span>
                      </h3>
                      <p className="text-[11px] text-stone-400">
                        Abre chat directo con mensaje oficial pre-redactado
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyWhatsapp}
                    className="px-2.5 py-1 text-xs font-semibold text-stone-300 bg-stone-800 hover:bg-stone-700 rounded-md border border-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Copiar texto para pegar manualmente"
                  >
                    {copiedWhatsapp ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-400" />
                        <span>Copiar Texto</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Recipient phone input */}
                <div className="mb-3.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-300 mb-1">
                    Número de Celular del Productor (WhatsApp) *
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Smartphone className="w-4 h-4 text-emerald-500" />
                      </div>
                      <input
                        type="text"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="Ej. 846 123 4567 o 528461234567"
                        className="w-full pl-9 pr-3 py-2 text-xs font-mono-data font-semibold bg-stone-950 border border-stone-700 rounded-lg text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                    {cleanPhoneForWa && (
                      <span className="text-[10px] font-mono-data text-emerald-400 bg-emerald-950/80 px-2 py-2 rounded border border-emerald-700/60 shrink-0">
                        +{cleanPhoneForWa}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">
                    Formato nacional mexicano de 10 dígitos. El sistema añade el prefijo +52 automáticamente.
                  </p>
                </div>

                {/* WhatsApp Message Preview */}
                <div className="mb-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                    Vista Previa del Mensaje Oficial Pre-redactado
                  </label>
                  <div className="bg-stone-950 border border-stone-800 rounded-lg p-3 text-[11px] text-stone-300 max-h-40 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed select-all">
                    {whatsappMessage}
                  </div>
                </div>
              </div>

              {/* WhatsApp Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendWhatsapp}
                  className="w-full sm:flex-1 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Abrir Chat y Enviar WhatsApp</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </button>

                <button
                  type="button"
                  onClick={handleCopyWhatsapp}
                  className="w-full sm:w-auto px-3 py-2.5 text-xs font-semibold text-stone-300 bg-stone-800 hover:bg-stone-700 rounded-lg border border-stone-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedWhatsapp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWhatsapp ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              CANAL 2: CORREO ELECTRÓNICO (EMAIL)
             ========================================================================= */}
          {(activeTab === 'both' || activeTab === 'email') && (
            <div className="bg-stone-900/90 border border-blue-600/40 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-blue-400 flex items-center gap-1.5">
                        Canal 2: Correo Electrónico
                        <span className="text-[10px] bg-blue-950 border border-blue-500/40 text-blue-300 px-1.5 py-0.2 rounded font-normal">
                          Oficial
                        </span>
                      </h3>
                      <p className="text-[11px] text-stone-400">
                        Envía mediante cliente de correo (Gmail, Outlook, etc.)
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="px-2.5 py-1 text-xs font-semibold text-stone-300 bg-stone-800 hover:bg-stone-700 rounded-md border border-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Copiar asunto y cuerpo completo"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-blue-400">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-400" />
                        <span>Copiar Todo</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Recipient Email input */}
                <div className="mb-3.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-300 mb-1">
                    Correo Electrónico del Productor *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-blue-400" />
                    </div>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="Ej. productor@correo.com"
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono-data bg-stone-950 border border-stone-700 rounded-lg text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">
                    Asunto pre-configurado: <span className="text-stone-300 font-mono-data truncate inline-block max-w-[280px] align-bottom">{emailSubject}</span>
                  </p>
                </div>

                {/* Email Body Preview */}
                <div className="mb-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                    Vista Previa del Oficio Municipal en Texto
                  </label>
                  <div className="bg-stone-950 border border-stone-800 rounded-lg p-3 text-[11px] text-stone-300 max-h-40 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed select-all">
                    {emailBody}
                  </div>
                </div>
              </div>

              {/* Email Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="w-full sm:flex-1 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Redactar y Enviar por Correo</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </button>

                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="w-full sm:w-auto px-3 py-2.5 text-xs font-semibold text-stone-300 bg-stone-800 hover:bg-stone-700 rounded-lg border border-stone-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEmail ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Operational Best Practices Footer Notice */}
        <div className="mt-5 bg-stone-900/60 rounded-xl p-3.5 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex items-start sm:items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              💡 <strong>Protocolo Municipal:</strong> Descargue el archivo PDF oficial con el botón superior para adjuntarlo como documento formal en el chat de WhatsApp o en el correo enviado al productor.
            </span>
          </div>

          {dispatchHistory.length > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono-data text-[11px] shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>Último: {dispatchHistory[0].type.toUpperCase()} ({dispatchHistory[0].timestamp})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
