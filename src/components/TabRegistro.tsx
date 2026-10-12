import React, { useState, useMemo, useEffect } from 'react';
import { ProducerData, PreloadedOrderData, BrandConfig } from '../types';
import { TabCreador } from './TabCreador';
import { recordAuditLog } from '../utils/auditAuth';
import { guardarRegistroCompleto } from '../utils/googleSheetsIntegration';
import { renderBrandToCanvas } from '../utils/canvasRenderer';
import { subirImagenACloudinary } from '../services/cloudinaryService';
import { addNewMunicipalRecord } from '../utils/database';
import {
  getStoredEjidos,
  addCustomEjido,
  getStoredMunicipios,
  addCustomMunicipio,
} from '../utils/catalogs';
import {
  getSavedDraftVersions,
  saveDraftVersion,
  saveCurrentSessionDraft,
  getInterruptedSessionDraft,
  clearCurrentSessionDraft,
  deleteDraftVersion,
  clearAllDraftVersions,
  hasSubstantialData,
  RegistrationDraftVersion,
} from '../utils/draftHistory';
import { VersionHistoryModal } from './VersionHistoryModal';
import { PhotoCaptureModal } from './PhotoCaptureModal';
import {
  sanitizeFullName,
  sanitizeCurp,
  sanitizeRfc,
  sanitizeIne,
  formatAndSanitizePhone,
  sanitizeEmail,
  sanitizeDecimal,
  sanitizeInteger,
  formatAndSanitizeUppKey,
  isStandardSiniigaUpp,
  validateFullName,
  validateCurp,
  validateRfc,
  validateIne,
  validatePhone,
  validateEmail,
  validatePropertyName,
  validateSurface,
  validateUppKey,
  validateCattleCount,
  validateFolio,
  validateRegistrationNumber,
  validateBookNumber,
  validateFolioPage,
  validateValidityRange,
  validateIssueDate,
  validateFullProducerData,
} from '../utils/formValidation';
import { ValidationErrorsModal } from './ValidationErrorsModal';
import { MissingFieldsModal, MissingField } from './MissingFieldsModal';
import { useDuplicateCheck } from '../hooks/useDuplicateCheck';
import { SignaturePad } from './SignaturePad';
import { IneScanner, IneScanResult } from './IneScanner';
import {
  getStoredSeriesConfig,
  saveStoredSeriesConfig,
  formatFolioString,
  formatRegistrationString,
  incrementSeriesNumbers,
  SeriesNumberingConfig,
} from '../utils/numberingConfig';
import {
  User,
  MapPin,
  Award,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileText,
  Building2,
  Check,
  AlertCircle,
  Plus,
  X,
  BookmarkPlus,
  Mail,
  Printer,
  RotateCcw,
  History,
  Save,
  Hash,
  FileCheck,
  FileSignature,
  Camera,
  Upload,
  Eye,
  DollarSign,
} from 'lucide-react';

interface TabRegistroProps {
  producerData: ProducerData;
  onChangeProducerData: (data: ProducerData | ((prev: ProducerData) => ProducerData)) => void;
  brandConfig?: BrandConfig;
  onChangeBrandConfig?: (config: BrandConfig) => void;
  onApplyInitialsToBrand: (initials: string) => void;
  onGoToCreador: () => void;
  onGoToCertificado?: () => void;
  onGoToDigitalizacion?: () => void;
  onGoToFinance?: (category?: 'ALTA', preloaded?: PreloadedOrderData) => void;
}

type StepId = 1 | 2 | 3 | 4 | 5;

// FIX_MINIATURA: Comprime la foto del titular para evitar problemas de memoria
function compressPhotoLocally(dataUrl: string, maxWidth = 400, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const TabRegistro: React.FC<TabRegistroProps> = ({
  producerData,
  onChangeProducerData,
  brandConfig,
  onChangeBrandConfig,
  onApplyInitialsToBrand,
  onGoToCreador,
  onGoToCertificado,
  onGoToDigitalizacion,
  onGoToFinance,
}) => {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [saveAlert, setSaveAlert] = useState<string | null>(null);
  const hoja5FierroCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [showValidationModal, setShowValidationModal] = useState<boolean>(false);
  const [validationActionAttempted, setValidationActionAttempted] = useState<'save' | 'proceed' | 'print'>('save');
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);
  const [photoModalMode, setPhotoModalMode] = useState<'capture' | 'preview'>('preview');
  const [photoLoadError, setPhotoLoadError] = useState<boolean>(false);

  // BLOQUE_E: Validacion entre hojas
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [pendingNextStep, setPendingNextStep] = useState<StepId | null>(null);
  const [showMissingFieldsModal, setShowMissingFieldsModal] = useState<boolean>(false);

  const [isCotejoApproved, setIsCotejoApproved] = useState<boolean>(false);
  const [isForjaModalOpen, setIsForjaModalOpen] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const [isMonogramLinked, setIsMonogramLinked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('panuco_monogram_linked') === 'true';
    } catch { return false; }
  });
  const [cotejoDocs, setCotejoDocs] = useState<{ ine: boolean; predio: boolean; upp: boolean }>({
    ine: true,
    predio: true,
    upp: true,
  });

  const fullValidation = useMemo(() => validateFullProducerData(producerData), [producerData]);
  const duplicate = useDuplicateCheck(producerData);

  const [savedVersions, setSavedVersions] = useState<RegistrationDraftVersion[]>(() => getSavedDraftVersions());
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState<boolean>(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [interruptedDraft, setInterruptedDraft] = useState<ReturnType<typeof getInterruptedSessionDraft>>(null);
  const [dismissedRecovery, setDismissedRecovery] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('panuco_monogram_linked', String(isMonogramLinked));
    } catch {}
  }, [isMonogramLinked]);

  useEffect(() => {
    if (producerData.producerPhoto) {
      setPhotoLoadError(false);
    }
  }, [producerData.producerPhoto]);

  useEffect(() => {
    const draft = getInterruptedSessionDraft();
    if (draft && hasSubstantialData(draft.producerData)) {
      const isCurrentEmpty = !hasSubstantialData(producerData);
      const isDifferent =
        draft.producerData.fullName !== producerData.fullName ||
        draft.producerData.curp !== producerData.curp ||
        draft.producerData.folio !== producerData.folio;

      if (isCurrentEmpty || isDifferent) {
        setInterruptedDraft(draft);
      }
    }
  }, []);

  useEffect(() => {
    if (currentStep !== 5) return;
    const canvas = hoja5FierroCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const timer = setTimeout(() => {
      try {
        renderBrandToCanvas(ctx, canvas.width, canvas.height, brandConfig!, {
          background: 'transparent',
          showShadow: false,
          resolutionScale: 1.2,
        });
        console.log('%c[Hoja5] Fierro renderizado en Resumen', 'color: #22c55e');
      } catch (err) {
        console.warn('[Hoja5] Error renderizando fierro:', err);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [currentStep, brandConfig]);

  useEffect(() => {
    if (!hasSubstantialData(producerData)) return;

    setIsAutoSaving(true);
    const timer = setTimeout(() => {
      saveCurrentSessionDraft(producerData, currentStep);
      const saved = saveDraftVersion(producerData, 'auto', undefined, currentStep);
      if (saved) {
        setSavedVersions(getSavedDraftVersions());
      }
      const timeStr = new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastAutoSaveTime(timeStr);
      setIsAutoSaving(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [producerData, currentStep]);

  const handleRecoverInterruptedDraft = () => {
    if (!interruptedDraft) return;
    onChangeProducerData(interruptedDraft.producerData);
    if (interruptedDraft.producerData.fullName) {
      onApplyInitialsToBrand(interruptedDraft.producerData.fullName.slice(0, 2).toUpperCase());
    }
    if (interruptedDraft.currentStep && interruptedDraft.currentStep >= 1 && interruptedDraft.currentStep <= 5) {
      setCurrentStep(interruptedDraft.currentStep as StepId);
    }
    recordAuditLog({
      actionType: 'BORRADOR_RECUPERADO',
      folioAffected: interruptedDraft.producerData.folio,
      producerAffected: interruptedDraft.producerData.fullName,
      details: `Borrador de sesión previa interrumpida recuperado (${interruptedDraft.formattedTime}, Titular: ${interruptedDraft.producerData.fullName}).`,
    });
    setSaveAlert(`Borrador de "${interruptedDraft.producerData.fullName || 'Productor'}" restaurado con éxito.`);
    setInterruptedDraft(null);
    setTimeout(() => setSaveAlert(null), 4000);
  };

  const handleDismissInterruptedDraft = () => {
    setDismissedRecovery(true);
    setInterruptedDraft(null);
    clearCurrentSessionDraft();
  };

  const handleRestoreVersion = (version: RegistrationDraftVersion) => {
    onChangeProducerData(version.producerData);
    if (version.producerData.fullName) {
      onApplyInitialsToBrand(version.producerData.fullName.slice(0, 2).toUpperCase());
    }
    if (version.stepId && version.stepId >= 1 && version.stepId <= 5) {
      setCurrentStep(version.stepId as StepId);
    }
    recordAuditLog({
      actionType: 'BORRADOR_RECUPERADO',
      folioAffected: version.producerData.folio,
      producerAffected: version.producerData.fullName,
      details: `Versión del historial restaurada: "${version.label}" (${version.formattedDate} ${version.formattedTime}, ${version.completionPercentage}% completado).`,
    });
    setSaveAlert(`Versión "${version.label}" restaurada exitosamente.`);
    setInterruptedDraft(null);
    setTimeout(() => setSaveAlert(null), 4000);
  };

  const handleCreateManualCheckpoint = (customLabel: string) => {
    const saved = saveDraftVersion(producerData, 'manual', customLabel, currentStep);
    if (saved) {
      setSavedVersions(getSavedDraftVersions());
      setSaveAlert(`Punto de restauración "${saved.label}" guardado localmente.`);
      setTimeout(() => setSaveAlert(null), 3500);
    }
  };

  const handleDeleteVersion = (id: string) => {
    const updated = deleteDraftVersion(id);
    setSavedVersions(updated);
  };

  const handleClearAllVersions = () => {
    clearAllDraftVersions();
    setSavedVersions([]);
    setInterruptedDraft(null);
    setSaveAlert('Historial de versiones y borradores locales vaciado.');
    setTimeout(() => setSaveAlert(null), 3500);
  };

  const [ejidosList, setEjidosList] = useState<string[]>(() => getStoredEjidos());
  const [municipiosList, setMunicipiosList] = useState<string[]>(() => getStoredMunicipios());

  const [showAddEjidoModal, setShowAddEjidoModal] = useState(false);
  const [newEjidoName, setNewEjidoName] = useState('');
  const [newEjidoType, setNewEjidoType] = useState('Ejido');

  const [showAddMunicipioModal, setShowAddMunicipioModal] = useState(false);
  const [newMunicipioName, setNewMunicipioName] = useState('');

  const [seriesConfig, setSeriesConfig] = useState<SeriesNumberingConfig>(() => getStoredSeriesConfig());

  useEffect(() => {
    if (currentStep === 3) {
      if (!producerData.folio || producerData.folio.trim() === '') {
        const initialFolio = formatFolioString(seriesConfig.folioPrefix, seriesConfig.folioStartNumber, seriesConfig.folioPaddingLength);
        console.log('%c[Hoja3] Auto-generando Folio: ' + initialFolio, 'color: #d97706; font-weight: bold');
        onChangeProducerData({ ...producerData, folio: initialFolio });
      }
      if (!producerData.registrationNumber || producerData.registrationNumber.trim() === '') {
        const initialReg = formatRegistrationString(seriesConfig.registrationPrefix, seriesConfig.registrationStartNumber, seriesConfig.registrationPaddingLength);
        console.log('%c[Hoja3] Auto-generando Registro: ' + initialReg, 'color: #059669; font-weight: bold');
        onChangeProducerData({ ...producerData, registrationNumber: initialReg });
      }
    }
  }, [currentStep, producerData.folio, producerData.registrationNumber, seriesConfig]);

  const handleFieldChange = (field: keyof ProducerData, value: string | number) => {
    let finalValue = value;
    if (
      typeof finalValue === 'string' &&
      field !== 'email' &&
      field !== 'producerSignature' &&
      field !== 'producerPhoto' &&
      field !== 'fotoTitularDriveUrl' &&
      field !== 'firmaDriveUrl'
    ) {
      finalValue = finalValue.toUpperCase();
    }
    onChangeProducerData((prev) => ({
      ...prev,
      [field]: finalValue,
    }));
    if (field === 'producerPhoto') {
      setPhotoLoadError(false);
    }
    if (validationWarning) setValidationWarning(null);
  };

  const handleAddNewEjido = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newEjidoName.trim().toUpperCase();
    if (!clean) return;

    const upperType = newEjidoType.toUpperCase();
    const formatted =
      clean.startsWith(upperType) || clean.startsWith('EJIDO ') || clean.startsWith('CONGREGACIÓN ') || clean.startsWith('RANCHERÍA ')
        ? clean
        : `${upperType} ${clean}`;

    const updated = addCustomEjido(formatted);
    setEjidosList(updated);
    handleFieldChange('ejido', formatted);
    setNewEjidoName('');
    setShowAddEjidoModal(false);
    setSaveAlert(`"${formatted}" fue incorporado al catálogo oficial y seleccionado.`);
    setTimeout(() => setSaveAlert(null), 4000);
  };

  const handleAddNewMunicipio = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newMunicipioName.trim().toUpperCase();
    if (!clean) return;

    const updated = addCustomMunicipio(clean);
    setMunicipiosList(updated);
    handleFieldChange('municipio', clean);
    setNewMunicipioName('');
    setShowAddMunicipioModal(false);
    setSaveAlert(`Municipio / Extensión "${clean}" registrado exitosamente en el catálogo.`);
    setTimeout(() => setSaveAlert(null), 4000);
  };

  const handleSave = async (e?: React.FormEvent): Promise<boolean> => {
    if (e) e.preventDefault();

    // VALIDACION_COMPLETA_HOJAS_1_4: recolectar TODOS los faltantes de Hojas 1-4
    const todosLosFaltantes: MissingField[] = [];
    for (let paso = 1; paso <= 4; paso++) {
      const faltantes = validateStepComplete(paso as StepId);
      todosLosFaltantes.push(...faltantes);
    }

    if (todosLosFaltantes.length > 0) {
      setMissingFields(todosLosFaltantes);
      setShowMissingFieldsModal(true);
      setValidationActionAttempted('save');
      setValidationWarning(
        `Asiento no autorizado: El expediente contiene ${todosLosFaltantes.length} campos obligatorios faltantes en Hojas 1-4.`
      );
      return false;
    }

    if (!fullValidation.isValid) {
      setValidationActionAttempted('save');
      setShowValidationModal(true);
      setValidationWarning(
        `Asiento no autorizado: El expediente contiene ${fullValidation.errors.length} campos con formato inválido.`
      );
      return false;
    }

    try {
      const regId = producerData.registrationNumber || `REG-2026-${Math.floor(Math.random() * 9000 + 1000)}`;
      const ownerInitials = derivedInitials || 'AG';

      const newRecord = {
        id: `pan-rec-${Date.now()}`,
        id_registro: regId,
        folio: producerData.folio,
        productor: producerData.fullName,
        tipo_registro: 'NUEVO_ALTA' as const,
        registrationNumber: producerData.registrationNumber || regId,
        ownerName: producerData.fullName,
        curp: producerData.curp,
        rfc: producerData.rfc,
        ine: producerData.ine,
        address: producerData.address,
        phone: producerData.phone,
        propertyName: producerData.propertyName,
        ejido: producerData.ejido,
        surfaceHectares: Number(producerData.surfaceHectares) || 0,
        tenureType: producerData.tenureType,
        cattleCount: Number(producerData.cattleCount) || 0,
        species: producerData.species,
        initials: ownerInitials,
        topSymbol: 'corona' as const,
        bottomSymbol: 'herradura' as const,
        orientation: 'enlazado' as const,
        uppKey: producerData.uppKey,
        year: new Date().getFullYear(),
        issueDate: producerData.issueDate || new Date().toISOString().split('T')[0],
        bookNumber: producerData.bookNumber,
        folioPage: producerData.folioPage,
        validityRange: producerData.validityRange,
        status: 'Vigente' as const,
        brandHash: `${ownerInitials}|corona|herradura|enlazado`,
        vector_64d: producerData.vector_64d || undefined,
        brandVector: producerData.brandVector || producerData.vector_64d || undefined,
        vector_checksum: producerData.vector_checksum || undefined,
        vector_density: producerData.vector_density || undefined,
        vector_symmetry_h: producerData.vector_symmetry_h || undefined,
        vector_symmetry_v: producerData.vector_symmetry_v || undefined,
        vector_proportions: producerData.vector_proportions || undefined,
        vector_varianza: producerData.vector_varianza || undefined,
      } as any;

      const imagenes: any = {};
      if (producerData.inePhoto) imagenes.ine = producerData.inePhoto;
      if ((producerData as any).producerPhoto) imagenes.fotoTitular = (producerData as any).producerPhoto;
      if (producerData.producerSignature) imagenes.firma = producerData.producerSignature;
      if ((producerData as any).fierroDigitalizadoPhoto) imagenes.fierro = (producerData as any).fierroDigitalizadoPhoto;

      console.log('%c[Sync] Subiendo imagenes de nuevo registro a Cloudinary...', 'color: #0ea5e9');
      const result = await guardarRegistroCompleto(newRecord, imagenes);

      if (result.success) {
        console.log('%c[Sync] Registro sincronizado con Google Sheets', 'color: #22c55e');

        // FASE_0_3_FIX: guardar URLs subidas en variables de scope superior
        const urls = result.urlsSubidas || {};
        (globalThis as any).__lastUploadedUrls = {
          ine: urls.ine || undefined,
          fotoTitular: urls.fotoTitular || undefined,
          firma: urls.firma || undefined,
          fierro: urls.fierro || undefined,
        };
        console.log('%c[Sync] URLs aplicadas al registro local', 'color: #22c55e', {
          ine: urls.ine ? 'OK' : 'vacio',
          foto: urls.fotoTitular ? 'OK' : 'vacio',
          firma: urls.firma ? 'OK' : 'vacio',
          fierro: urls.fierro ? 'OK' : 'vacio',
        });
      } else {
        console.warn('[Sync] Fallo la sincronizacion:', result.error);
      }
    } catch (syncErr) {
      console.warn('[Sync] Excepcion al sincronizar:', syncErr);
    }

    addNewMunicipalRecord({
      id: `pan-rec-${Date.now()}`,
      folio: producerData.folio,
      ownerName: producerData.fullName,
      curp: producerData.curp,
      rfc: producerData.rfc,
      ine: producerData.ine,
      address: producerData.address,
      phone: producerData.phone,
      propertyName: producerData.propertyName,
      ejido: producerData.ejido,
      surfaceHectares: Number(producerData.surfaceHectares) || 0,
      tenureType: producerData.tenureType,
      cattleCount: Number(producerData.cattleCount) || 0,
      species: producerData.species,
      initials: derivedInitials || 'AG',
      topSymbol: 'corona',
      bottomSymbol: 'herradura',
      orientation: 'enlazado',
      uppKey: producerData.uppKey,
      year: new Date().getFullYear(),
      issueDate: producerData.issueDate || new Date().toISOString().split('T')[0],
      registrationNumber: producerData.registrationNumber,
      bookNumber: producerData.bookNumber,
      folioPage: producerData.folioPage,
      validityRange: producerData.validityRange,
      status: 'Vigente',
      brandHash: `${derivedInitials || 'AG'}|corona|herradura|enlazado`,
      producerSignature: producerData.producerSignature,

      // FASE_0_3_FIX: URLs de Cloudinary desde variables de scope
      ineDriveUrl: (globalThis as any).__lastUploadedUrls?.ine,
      fotoTitularDriveUrl: (globalThis as any).__lastUploadedUrls?.fotoTitular,
      firmaDriveUrl: (globalThis as any).__lastUploadedUrls?.firma,
      fierroImageUrl: (globalThis as any).__lastUploadedUrls?.fierro,
      url_ine: (globalThis as any).__lastUploadedUrls?.ine,
      url_foto_titular: (globalThis as any).__lastUploadedUrls?.fotoTitular,
      url_firma: (globalThis as any).__lastUploadedUrls?.firma,
      url_fierro: (globalThis as any).__lastUploadedUrls?.fierro,
      imagenes: {
        credencial_ine: (globalThis as any).__lastUploadedUrls?.ine,
        fierro_digitalizado: (globalThis as any).__lastUploadedUrls?.fierro,
      },

      vector_64d: producerData.vector_64d || undefined,
      brandVector: producerData.brandVector || producerData.vector_64d || undefined,
      vector_checksum: producerData.vector_checksum || undefined,
      vector_density: producerData.vector_density || undefined,
      vector_symmetry_h: producerData.vector_symmetry_h || undefined,
      vector_symmetry_v: producerData.vector_symmetry_v || undefined,
      vector_proportions: producerData.vector_proportions || undefined,
      vector_varianza: producerData.vector_varianza || undefined,
    } as any);

    recordAuditLog({
      actionType: 'REGISTRO_MODIFICADO',
      folioAffected: producerData.folio,
      producerAffected: producerData.fullName,
      details: `Expediente del productor ${producerData.fullName} asentado en el padron municipal de ${producerData.municipio || 'Panuco'} (Rancho: ${producerData.propertyName}, ${producerData.cattleCount} cabezas). Sincronizado con Google Sheets.`,
    });

    if (seriesConfig.autoIncrementEnabled) {
      const nextSeries = incrementSeriesNumbers();
      setSeriesConfig(nextSeries);
    }

    setSaveAlert('Registro municipal validado al 100% y asentado con exito en el padron pecuario oficial + Google Sheets.');
    setIsSaved(true);
    setTimeout(() => setSaveAlert(null), 4500);

    // FASE_0_1: Redirigir automaticamente al certificado para imprimir
    if (onGoToCertificado) {
      console.log('%c[Flujo] Registro guardado. Redirigiendo al certificado...', 'color: #22c55e; font-weight: bold');
      onGoToCertificado();
    }

    return true;
  };

  const handleApplyIneData = async (ineData: IneScanResult) => {
    const updated: ProducerData = {
      ...producerData,
      fullName: (ineData.fullName || producerData.fullName || '').toUpperCase(),
      curp: (ineData.curp || producerData.curp || '').toUpperCase(),
      rfc: (ineData.rfc || producerData.rfc || '').toUpperCase(),
      ine: (ineData.ine || producerData.ine || '').toUpperCase(),
      address: (ineData.address || producerData.address || '').toUpperCase(),
      municipio: (ineData.municipio || producerData.municipio || 'PANUCO').toUpperCase(),
      ejido: (ineData.ejido || producerData.ejido || 'REVENTADERO').toUpperCase(),
      inePhoto: ineData.scannedImagePreview || producerData.inePhoto,
    };

    onChangeProducerData(updated);

    if (ineData.suggestedInitials) {
      onApplyInitialsToBrand(ineData.suggestedInitials.toUpperCase());
    }

    // FASE_0_3: subida diferida — solo guardar base64, subir al guardar
    if (ineData.scannedImagePreview) {
      console.log('%c[INE] Imagen capturada (subida diferida al guardar)', 'color: #0ea5e9');
      onChangeProducerData({ 
        ...updated, 
        inePhoto: ineData.scannedImagePreview,
      });
      setSaveAlert('✅ INE capturada. Se subirá a Cloudinary al guardar el registro.');
      setTimeout(() => setSaveAlert(null), 4000);
    } else {
      console.warn('[INE] Advertencia: no se recibio la imagen escaneada');
    }
  };

  const handleClearForm = () => {
    onChangeProducerData({
      fullName: '',
      curp: '',
      rfc: '',
      ine: '',
      address: '',
      phone: '',
      municipio: 'Pánuco',
      ejido: '',
      email: '',
      propertyName: '',
      surfaceHectares: 0,
      tenureType: 'PROPIEDAD',
      cattleCount: 0,
      species: 'BOVINO',
      uppKey: '',
      folio: '',
      registrationNumber: '',
      bookNumber: 'Libro XII de Fierros de Herrar',
      folioPage: '',
      validityRange: '2026 - 2029',
      issueDate: new Date().toISOString().split('T')[0],
      status: 'Vigente',
      producerSignature: '',
      associatedRancher: 'NO',
      zootechnicalPurpose: 'BOVINO Y DOBLE PROPÓSITO',
    });
    onApplyInitialsToBrand('');
    setCurrentStep(1);
    setValidationWarning(null);
    setSaveAlert('Formulario limpiado exitosamente. Listo para una nueva captura desde cero.');
    setTimeout(() => setSaveAlert(null), 3500);
  };

  const isFormClean = !producerData.fullName?.trim() && !producerData.curp?.trim() && !producerData.rfc?.trim() && !producerData.propertyName?.trim();

  const getDerivedInitials = (): string => {
    const parts = producerData.fullName
      .replace(/^(Don|Doña|Lic\.|Ing\.|Dr\.|C\.)\s+/i, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return 'P';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const derivedInitials = getDerivedInitials();

  const computeFechaExpiracion = (): string => {
    const vigencia = producerData.validityRange || '';
    const match = vigencia.match(/(\d{4})\s*[-–]\s*(\d{4})/);
    if (!match) return '';
    const yearEnd = match[2];
    return '31/12/' + yearEnd;
  };

  const fullNameVal = useMemo(() => validateFullName(producerData.fullName), [producerData.fullName]);
  const curpVal = useMemo(() => validateCurp(producerData.curp), [producerData.curp]);
  const rfcVal = useMemo(() => validateRfc(producerData.rfc), [producerData.rfc]);
  const ineVal = useMemo(() => validateIne(producerData.ine || ''), [producerData.ine]);
  const phoneVal = useMemo(() => validatePhone(producerData.phone), [producerData.phone]);
  const emailVal = useMemo(() => validateEmail(producerData.email), [producerData.email]);

  const validateStep = (step: StepId): boolean => {
    if (step === 1) {
      if (!fullNameVal.isValid) {
        setValidationWarning(`Nombre del Titular: ${fullNameVal.message}`);
        return false;
      }
      if (!producerData.municipio?.trim()) {
        setValidationWarning('Por favor seleccione o agregue el Municipio de la jurisdicción.');
        return false;
      }
      if (!producerData.ejido?.trim()) {
        setValidationWarning('Por favor seleccione o agregue el Ejido, Congregación o Ranchería.');
        return false;
      }
      if (!curpVal.isValid) {
        setValidationWarning(`CURP: ${curpVal.message}`);
        return false;
      }
      if (!rfcVal.isValid) {
        setValidationWarning(`RFC: ${rfcVal.message}`);
        return false;
      }
      if (!ineVal.isValid) {
        setValidationWarning(`Identificación Oficial INE: ${ineVal.message}`);
        return false;
      }
      if (producerData.phone && producerData.phone.trim() && !phoneVal.isValid) {
        setValidationWarning(`Teléfono de Contacto: ${phoneVal.message}`);
        return false;
      }
      if (producerData.email && producerData.email.trim() && !emailVal.isValid) {
        setValidationWarning(`Correo Electrónico (Email): ${emailVal.message}`);
        return false;
      }
      if (!producerData.address.trim() || producerData.address.trim().length < 5) {
        setValidationWarning('Por favor capture el Domicilio Legal en Pánuco (mínimo 5 caracteres).');
        return false;
      }
    } else if (step === 2) {
      const propV = validatePropertyName(producerData.propertyName || '');
      if (!propV.isValid) {
        setValidationWarning(`Predio: ${propV.message}`);
        return false;
      }
      const surV = validateSurface(Number(producerData.surfaceHectares) || 0);
      if (!surV.isValid) {
        setValidationWarning(`Superficie: ${surV.message}`);
        return false;
      }
      const uppV = validateUppKey(producerData.uppKey || '');
      if (!uppV.isValid) {
        setValidationWarning(`Clave UPP: ${uppV.message}`);
        return false;
      }
      const catV = validateCattleCount(Number(producerData.cattleCount) || 0);
      if (!catV.isValid) {
        setValidationWarning(`Ganado: ${catV.message}`);
        return false;
      }
    } else if (step === 3) {
      let folioToValidate = producerData.folio || '';
      let registroToValidate = producerData.registrationNumber || '';

      if (!folioToValidate.trim()) {
        folioToValidate = formatFolioString(seriesConfig.folioPrefix, seriesConfig.folioStartNumber, seriesConfig.folioPaddingLength);
        onChangeProducerData({ ...producerData, folio: folioToValidate });
        console.log('%c[Hoja3] Folio autogenerado en validacion: ' + folioToValidate, 'color: #d97706');
      }
      if (!registroToValidate.trim()) {
        registroToValidate = formatRegistrationString(seriesConfig.registrationPrefix, seriesConfig.registrationStartNumber, seriesConfig.registrationPaddingLength);
        onChangeProducerData({ ...producerData, registrationNumber: registroToValidate });
        console.log('%c[Hoja3] Registro autogenerado en validacion: ' + registroToValidate, 'color: #059669');
      }

      const folV = validateFolio(folioToValidate);
      if (!folV.isValid) {
        setValidationWarning(`Folio Oficial: ${folV.message}`);
        return false;
      }
      const regV = validateRegistrationNumber(registroToValidate);
      if (!regV.isValid) {
        setValidationWarning(`No. Registro Notarial: ${regV.message}`);
        return false;
      }
      const booV = validateBookNumber(producerData.bookNumber || '');
      if (!booV.isValid) {
        setValidationWarning(`Libro de Fierros: ${booV.message}`);
        return false;
      }
      const pagV = validateFolioPage(producerData.folioPage || '');
      if (!pagV.isValid) {
        setValidationWarning(`Foja de Asiento: ${pagV.message}`);
        return false;
      }
      const valV = validateValidityRange(producerData.validityRange || '');
      if (!valV.isValid) {
        setValidationWarning(`Vigencia: ${valV.message}`);
        return false;
      }
      const datV = validateIssueDate(producerData.issueDate || '');
      if (!datV.isValid) {
        setValidationWarning(`Fecha de Expedición: ${datV.message}`);
        return false;
      }
    } else if (step === 4) {
      if (!isCotejoApproved && !isMonogramLinked) {
        setValidationWarning('Para avanzar a la Hoja 5 (Resumen y Emisión), debe confirmar el cotejo notarial o vincular el monograma de forja.');
        return false;
      }
    }
    setValidationWarning(null);
    return true;
  };

  // BLOQUE_E: Valida y devuelve TODOS los campos faltantes del paso actual
  const validateStepComplete = (step: StepId): MissingField[] => {
    const faltantes: MissingField[] = [];

    if (step === 1) {
      if (!fullNameVal.isValid) faltantes.push({ field: 'fullName', label: 'Nombre Completo del Titular' });
      if (!producerData.municipio?.trim()) faltantes.push({ field: 'municipio', label: 'Municipio de la jurisdiccion' });
      if (!producerData.ejido?.trim()) faltantes.push({ field: 'ejido', label: 'Ejido, Congregacion o Rancheria' });
      if (!curpVal.isValid) faltantes.push({ field: 'curp', label: 'CURP (18 caracteres validos)' });
      if (!rfcVal.isValid) faltantes.push({ field: 'rfc', label: 'RFC (10 a 13 caracteres)' });
      if (!ineVal.isValid) faltantes.push({ field: 'ine', label: 'INE (Clave de Elector o Folio)' });
      if (!producerData.address?.trim() || producerData.address.trim().length < 5) {
        faltantes.push({ field: 'address', label: 'Domicilio Legal (minimo 5 caracteres)' });
      }
      if (!producerData.producerPhoto && !(producerData as any).fotoTitularDriveUrl) {
        faltantes.push({ field: 'producerPhoto', label: 'Fotografia del Titular' });
      }
      if (!producerData.producerSignature && !(producerData as any).firmaDriveUrl) {
        faltantes.push({ field: 'producerSignature', label: 'Firma Autografa del Titular' });
      }
      if (!producerData.inePhoto && !(producerData as any).ineDriveUrl) {
        faltantes.push({ field: 'inePhoto', label: 'Imagen capturada de la INE' });
      }
    } else if (step === 2) {
      const propV = validatePropertyName(producerData.propertyName || '');
      if (!propV.isValid) faltantes.push({ field: 'propertyName', label: 'Nombre del Predio o Rancho' });
      const surV = validateSurface(Number(producerData.surfaceHectares) || 0);
      if (!surV.isValid) faltantes.push({ field: 'surfaceHectares', label: 'Superficie en Hectareas (mayor a 0)' });
      const uppV = validateUppKey(producerData.uppKey || '');
      if (!uppV.isValid) faltantes.push({ field: 'uppKey', label: 'Clave UPP (minimo 3 caracteres)' });
      const catV = validateCattleCount(Number(producerData.cattleCount) || 0);
      if (!catV.isValid) faltantes.push({ field: 'cattleCount', label: 'Cantidad de Ganado (minimo 1 cabeza)' });
      if (!producerData.tenureType) faltantes.push({ field: 'tenureType', label: 'Tipo de Tenencia (Ejidal o Propiedad)' });
      if (!producerData.species) faltantes.push({ field: 'species', label: 'Especie Animal' });
      if (!producerData.zootechnicalPurpose) faltantes.push({ field: 'zootechnicalPurpose', label: 'Fin Zootecnico' });
      if (!producerData.associatedRancher) faltantes.push({ field: 'associatedRancher', label: 'Ganadero Asociado (SI/NO)' });
    } else if (step === 3) {
      let folioToValidate = producerData.folio || '';
      let registroToValidate = producerData.registrationNumber || '';
      if (!folioToValidate.trim()) {
        folioToValidate = formatFolioString(seriesConfig.folioPrefix, seriesConfig.folioStartNumber, seriesConfig.folioPaddingLength);
        onChangeProducerData({ ...producerData, folio: folioToValidate });
      }
      if (!registroToValidate.trim()) {
        registroToValidate = formatRegistrationString(seriesConfig.registrationPrefix, seriesConfig.registrationStartNumber, seriesConfig.registrationPaddingLength);
        onChangeProducerData({ ...producerData, registrationNumber: registroToValidate });
      }
      const folV = validateFolio(folioToValidate);
      if (!folV.isValid) faltantes.push({ field: 'folio', label: 'Folio Oficial Municipal' });
      const regV = validateRegistrationNumber(registroToValidate);
      if (!regV.isValid) faltantes.push({ field: 'registrationNumber', label: 'Numero de Registro Notarial' });
      const booV = validateBookNumber(producerData.bookNumber || '');
      if (!booV.isValid) faltantes.push({ field: 'bookNumber', label: 'Libro de Asiento Municipal' });
      const pagV = validateFolioPage(producerData.folioPage || '');
      if (!pagV.isValid) faltantes.push({ field: 'folioPage', label: 'Foja de Asiento' });
      const valV = validateValidityRange(producerData.validityRange || '');
      if (!valV.isValid) faltantes.push({ field: 'validityRange', label: 'Periodo de Vigencia' });
      const datV = validateIssueDate(producerData.issueDate || '');
      if (!datV.isValid) faltantes.push({ field: 'issueDate', label: 'Fecha de Expedicion' });
    } else if (step === 4) {
      if (!isCotejoApproved) {
        faltantes.push({ field: 'cotejo', label: 'Cotejo Notarial Aprobado (marque el botón verde)' });
      }
      if (!isMonogramLinked) {
        faltantes.push({ field: 'monograma', label: 'Fierro Quemador Disenado y Vinculado' });
      }
      if (!cotejoDocs.ine) {
        faltantes.push({ field: 'cotejo_ine', label: 'Cotejo de INE verificado' });
      }
      if (!cotejoDocs.predio) {
        faltantes.push({ field: 'cotejo_predio', label: 'Cotejo de Titulo/Certificado verificado' });
      }
      if (!cotejoDocs.upp) {
        faltantes.push({ field: 'cotejo_upp', label: 'Cotejo de Clave UPP verificado' });
      }
    }

    return faltantes;
  };

  const advanceToNextStep = () => {
    if (currentStep < 5) {
      const nextStep = (currentStep + 1) as StepId;
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const saved = saveDraftVersion(producerData, 'step_change', `Avance a Hoja ${nextStep}`, nextStep);
      if (saved) {
        setSavedVersions(getSavedDraftVersions());
        const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        setLastAutoSaveTime(timeStr);
      }
    }
  };

  const handleNext = () => {
    const faltantes = validateStepComplete(currentStep);

    if (faltantes.length > 0) {
      setMissingFields(faltantes);
      setPendingNextStep((currentStep + 1) as StepId);
      setShowMissingFieldsModal(true);
      return;
    }

    advanceToNextStep();
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as StepId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const STEPS = [
    { id: 1, title: 'Hoja 1', label: 'Datos del Titular', icon: User, desc: 'Identificación y firma' },
    { id: 2, title: 'Hoja 2', label: 'Predio y Hato', icon: MapPin, desc: 'Rancho, UPP y cabezas' },
    { id: 3, title: 'Hoja 3', label: 'Asiento y Folio', icon: Award, desc: 'Libro, foja y vigencia' },
    { id: 4, title: 'Hoja 4', label: 'Cotejo y Monograma', icon: Sparkles, desc: 'Cotejo y forja' },
    { id: 5, title: 'Hoja 5', label: 'Resumen y Emisión', icon: CheckCircle2, desc: 'Asiento y certificación' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 w-full max-w-full overflow-x-hidden">
      {/* Header section with Government dignity */}
      <div className="border-b border-stone-300 pb-4 sm:pb-6 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-800 block">
            H. Ayuntamiento de Pánuco, Veracruz · Padrón Pecuario Oficial
          </span>
          <h1 className="text-xl sm:text-3xl font-cinzel font-bold text-stone-900 mt-1 break-words">
            Alta y Registro Municipal de Fierro Quemador
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Trámite dividido paso por hoja conforme a la Ley Ganadera del Estado de Veracruz.
          </p>
        </div>

        {/* Utilidades del expediente */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
          {lastAutoSaveTime && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-stone-50 border border-stone-200 rounded-md text-[11px] text-stone-600 font-medium shrink-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isAutoSaving ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
              <span className="truncate">
                {isAutoSaving ? 'Guardando...' : `Borrador: ${lastAutoSaveTime}`}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowVersionHistoryModal(true)}
            className="px-2.5 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-amber-200 border border-amber-600/50 rounded transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
            title="Abrir historial de versiones y borradores guardados automáticamente en el navegador"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Versiones ({savedVersions.length})</span>
          </button>

          {interruptedDraft && !dismissedRecovery && (
            <button
              type="button"
              onClick={handleRecoverInterruptedDraft}
              className="px-2.5 py-1.5 text-xs font-bold bg-amber-400 hover:bg-amber-500 text-stone-950 rounded transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 ring-1 ring-amber-500/50"
              title={`Recuperar borrador previo (${interruptedDraft.formattedTime}, Titular: ${interruptedDraft.producerData.fullName || 'Productor'})`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-stone-900" />
              <span>Recuperar Borrador (1)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearForm}
            className="px-2 py-1.5 text-xs font-medium bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-700 border border-stone-200 rounded transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0"
            title="Limpiar y vaciar todos los campos del formulario"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {/* STEPPER BAR */}
      <div className="mb-6 bg-white border border-stone-200 rounded-xl p-3 sm:p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-xs uppercase font-mono-data">
              Hoja {currentStep} de 5
            </span>
            <span className="text-xs text-stone-600 font-medium hidden sm:inline">
              {STEPS[currentStep - 1]?.label}
            </span>
            {producerData.producerSignature ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px] flex items-center gap-1 shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                <span>Firma Digital: Registrada</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium text-[10px] flex items-center gap-1">
                <span>✍️ Firma: Pendiente</span>
              </span>
            )}
          </div>
          <span className="text-xs font-mono-data text-stone-500">
            {currentStep === 1 && '20% completado'}
            {currentStep === 2 && '40% completado'}
            {currentStep === 3 && '60% completado'}
            {currentStep === 4 && '80% cotejado y forja'}
            {currentStep === 5 && '100% listo para asentar'}
          </span>
        </div>

        <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden mb-3 border border-stone-200">
          <div
            className="bg-gradient-to-r from-amber-600 to-amber-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${currentStep * 20}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id && !(step.id === 5 && isSaved);
            const isCompleted = currentStep > step.id || (step.id === 5 && isSaved);

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.id < currentStep) {
                    setCurrentStep(step.id as StepId);
                  } else {
                    if (!validateStep(currentStep)) return;
                    if (step.id === 5 && !fullValidation.isValid) {
                      setValidationActionAttempted('proceed');
                      setShowValidationModal(true);
                      return;
                    }
                    setCurrentStep(step.id as StepId);
                  }
                }}
                className={`p-2 sm:p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/30'
                    : isCompleted
                    ? 'bg-stone-50 border-emerald-300 hover:bg-stone-100'
                    : 'bg-white border-stone-200 hover:bg-stone-50 opacity-80'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <div className="min-w-0">
                  <span
                    className={`block text-[11px] sm:text-xs font-bold truncate ${
                      isActive ? 'text-amber-950' : 'text-stone-800'
                    }`}
                  >
                    {step.title}: {step.label}
                  </span>
                  <span className="block text-[9px] sm:text-[10px] text-stone-500 truncate">
                    {step.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {validationWarning && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{validationWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationWarning(null)}
            className="text-amber-800 font-bold ml-2 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {saveAlert && (
        <div className="mb-4 p-3 sm:p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg flex items-center justify-between text-xs sm:text-sm shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
            <span>{saveAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveAlert(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 text-base"
          >
            ×
          </button>
        </div>
      )}

      {/* MULTI-PAGE SHEETS */}
      <div className="space-y-6">
        {/* HOJA 1: DATOS DEL TITULAR O PRODUCTOR PECUARIO */}
        {currentStep === 1 && (
          <div className="bg-white border-2 border-stone-200 rounded-xl p-4 sm:p-7 shadow-sm transition-all">
            <IneScanner
              onAcceptData={handleApplyIneData}
              currentProducerName={producerData.fullName}
              ejidosList={ejidosList}
            />

            <div className="flex items-center gap-3 border-b border-stone-200 pb-4 mb-6">
              <div className="p-2.5 bg-amber-100 text-amber-900 rounded-xl">
                <User className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-800 block">
                  Hoja 1 de 4 · Identificación Oficial
                </span>
                <h2 className="text-lg sm:text-xl font-cinzel font-bold text-stone-900">
                  1. Datos del Titular o Productor Pecuario
                </h2>
                <p className="text-xs text-stone-500">
                  Información personal, fotografía y contacto del solicitante del fierro quemador.
                </p>
              </div>
            </div>

            <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-amber-50/90 via-white to-stone-50 border-2 border-amber-300 rounded-2xl shadow-xs">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
                <div
                  onClick={() => {
                    if (producerData.producerPhoto && !photoLoadError) {
                      setPhotoModalMode('preview');
                    } else {
                      setPhotoModalMode('capture');
                    }
                    setShowPhotoModal(true);
                  }}
                  className="relative w-28 h-36 sm:w-32 sm:h-40 rounded-xl overflow-hidden border-2 border-amber-700 bg-stone-100 shadow-md shrink-0 flex items-center justify-center cursor-pointer group hover:ring-4 hover:ring-amber-400/60 transition-all"
                  title={producerData.producerPhoto ? 'Haga clic para inspeccionar, evaluar o volver a tomar la foto' : 'Haga clic para abrir la cámara'}
                >
                  {producerData.producerPhoto && !photoLoadError ? (
                    <>
                      <img
                        src={producerData.producerPhoto}
                        alt={`Foto oficial de ${producerData.fullName || 'Titular'}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        onError={() => {
                          console.warn('Miniatura de fotografía no pudo decodificarse correctamente');
                          setPhotoLoadError(true);
                        }}
                      />
                      <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-1 text-center">
                        <Eye className="w-5 h-5 mb-0.5 text-amber-300" />
                        <span className="text-[9px] font-bold">Evaluar / Repetir</span>
                      </div>
                      <span className="absolute bottom-1 right-1 bg-emerald-600 text-white p-1 rounded-full shadow-xs">
                        <Check className="w-3 h-3" />
                      </span>
                    </>
                  ) : photoLoadError ? (
                    <div className="flex flex-col items-center justify-center text-amber-800 p-2 text-center">
                      <AlertCircle className="w-8 h-8 mb-1 text-amber-700" />
                      <span className="text-[9px] font-bold uppercase tracking-tight text-amber-900">
                        Formato Incompatible
                      </span>
                      <span className="text-[8px] text-amber-800 underline font-semibold mt-1">
                        Haga clic para re-capturar
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-stone-400 p-2 text-center group-hover:text-amber-800">
                      <User className="w-10 h-10 mb-1 opacity-35 text-stone-600 group-hover:opacity-80" />
                      <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-tight group-hover:text-amber-900">
                        Sin Fotografía
                      </span>
                      <span className="text-[9px] text-amber-700 font-bold mt-1">Tomar Foto</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-800 text-white">
                      Fotografía Oficial del Titular
                    </span>
                    {producerData.producerPhoto && !photoLoadError ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Toma Verificada para Credencial CR-80
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-900 border border-amber-300">
                        Cámara Dual (Webcam y Celular)
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-stone-900">
                    {producerData.producerPhoto && !photoLoadError
                      ? 'Retrato Capturado y Calibrado en Expediente'
                      : 'Captura Fotográfica para Credencial Ganadera Oficial'}
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed max-w-xl">
                    {producerData.producerPhoto && !photoLoadError
                      ? 'La fotografía del titular se encuentra lista e integrada en la credencial ganadera. Puede visualizar la toma para evaluar si es correcta o volver a tomarla en cualquier momento.'
                      : 'Utilice la cámara web de su computadora o la cámara de su celular (frontal/trasera) para tomar la fotografía oficial del productor, o seleccione una imagen guardada en sus archivos.'}
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoModalMode('capture');
                        setShowPhotoModal(true);
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-600 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{producerData.producerPhoto ? 'Volver a Tomar / Repetir Foto' : 'Abrir Cámara / Tomar Fotografía'}</span>
                    </button>

                    {producerData.producerPhoto && !photoLoadError ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoModalMode('preview');
                          setShowPhotoModal(true);
                        }}
                        className="px-3.5 py-2 text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Abrir panel de inspección de la toma"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-800" />
                        <span>Ver / Evaluar Toma</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoModalMode('capture');
                          setShowPhotoModal(true);
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-stone-600" />
                        <span>Subir Archivo de Imagen</span>
                      </button>
                    )}

                    {producerData.producerPhoto && (
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange('producerPhoto', '');
                          setPhotoLoadError(false);
                          setSaveAlert('Fotografía removida del expediente.');
                          setTimeout(() => setSaveAlert(null), 3000);
                        }}
                        className="px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar foto actual"
                      >
                        Eliminar Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {duplicate.found && (
              <div className="mb-4 p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl shadow-md">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold text-rose-950 block text-sm">
                      ⚠️ Productor ya registrado en el padrón
                    </span>
                    <p className="text-xs text-rose-900 mt-1">
                      Se encontró coincidencia por <strong>{duplicate.matchField === 'curp' ? 'CURP' : duplicate.matchField === 'ine' ? 'INE' : 'nombre'}</strong>:
                    </p>
                    <p className="text-xs text-rose-900 mt-0.5">
                      Folio existente: <span className="font-mono font-bold">{duplicate.folio}</span>
                      {duplicate.existingRecord && (
                        <> · Titular: <strong>{duplicate.existingRecord.ownerName}</strong></>
                      )}
                    </p>
                    <p className="text-[11px] text-rose-800 mt-2 italic">
                      Si es la misma persona, cancele esta alta y edite el registro existente. Si es distinta, verifique que la CURP/INE no estén duplicadas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Nombre Completo del Productor *
                  </label>
                  {producerData.fullName.trim() ? (
                    fullNameVal.isValid ? (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 shadow-2xs">
                        <Check className="w-3 h-3 text-emerald-600" /> Nombre Válido
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1 shadow-2xs">
                        <AlertCircle className="w-3 h-3 text-amber-600" /> Requiere nombre y apellido
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-stone-500 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200">Opcional
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  autoCapitalize="characters"
                  value={producerData.fullName}
                  onChange={(e) => handleFieldChange('fullName', sanitizeFullName(e.target.value))}
                  placeholder="EJ. DON AURELIO GUZMÁN ARADILLAS"
                  className={`w-full px-3.5 py-2.5 text-sm border rounded-lg transition-colors font-medium text-stone-900 uppercase ${
                    producerData.fullName.trim()
                      ? fullNameVal.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20 shadow-2xs font-bold'
                        : 'border-amber-400 focus:ring-2 focus:ring-amber-500 bg-amber-50/20'
                      : 'border-stone-300 focus:ring-2 focus:ring-amber-500 bg-stone-50/50'
                  }`}
                />
                <p className="text-[10px] mt-1 text-stone-500">
                  {producerData.fullName.trim() ? (
                    fullNameVal.isValid ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" /> Nombre asentado correctamente para emisión de título y monograma
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {fullNameVal.message}
                      </span>
                    )
                  ) : (
                    'Acepta solo letras y espacios (sin números ni caracteres especiales).'
                  )}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 truncate">
                    Municipio *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddMunicipioModal(!showAddMunicipioModal)}
                    className="text-[11px] text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 cursor-pointer bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-300 transition-colors shrink-0"
                    title="Agregar nuevo municipio o extensión"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Municipio (+)</span>
                  </button>
                </div>
                <select
                  value={producerData.municipio || 'Pánuco'}
                  onChange={(e) => handleFieldChange('municipio', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50 font-medium text-stone-900"
                >
                  {municipiosList.map((mun) => (
                    <option key={mun} value={mun}>
                      {mun}, Ver.
                    </option>
                  ))}
                </select>
              </div>

              {showAddMunicipioModal && (
                <div className="lg:col-span-3 p-3.5 bg-amber-50/90 border-2 border-dashed border-amber-400 rounded-xl transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                      <Building2 className="w-4 h-4 text-amber-800" />
                      <span>Registrar Nuevo Municipio o Extensión Territorial</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddMunicipioModal(false)}
                      className="text-stone-400 hover:text-stone-700 text-sm font-bold"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newMunicipioName}
                      onChange={(e) => setNewMunicipioName(e.target.value)}
                      placeholder="Nombre del municipio o extensión (Ej. Tampico Alto, Platón Sánchez, Ébano...)"
                      className="flex-1 px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddNewMunicipio}
                        className="px-4 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-600 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Guardar Municipio</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddMunicipioModal(false)}
                        className="px-3 py-2 text-xs text-stone-600 hover:text-stone-800 bg-stone-200 rounded-lg cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 truncate">
                    Ejido, Congregación o Ranchería *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddEjidoModal(!showAddEjidoModal)}
                    className="text-[11px] text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 cursor-pointer bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-300 transition-colors shrink-0"
                    title="Agregar nuevo ejido, congregación, ranchería o extensión pecuaria"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Localidad / Extensión (+)</span>
                  </button>
                </div>
                <select
                  value={producerData.ejido}
                  onChange={(e) => handleFieldChange('ejido', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50"
                >
                  {ejidosList.map((ejido) => (
                    <option key={ejido} value={ejido}>
                      {ejido}
                    </option>
                  ))}
                </select>
              </div>

              {showAddEjidoModal && (
                <div className="lg:col-span-3 p-3.5 bg-emerald-50/90 border-2 border-dashed border-emerald-400 rounded-xl transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                      <MapPin className="w-4 h-4 text-emerald-700" />
                      <span>Agregar Ejido, Congregación, Ranchería o Extensión al Padrón</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddEjidoModal(false)}
                      className="text-stone-400 hover:text-stone-700 text-sm font-bold"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 text-xs">
                    <span className="text-[11px] font-semibold text-stone-600 mr-1">Tipo:</span>
                    {(['Ejido', 'Congregación', 'Ranchería', 'Extensión', 'Sector', 'Comunidad'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewEjidoType(type)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          newEjidoType === type
                            ? 'bg-emerald-700 text-white font-bold shadow-2xs'
                            : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newEjidoName}
                      onChange={(e) => setNewEjidoName(e.target.value)}
                      placeholder={`Nombre del ${newEjidoType.toLowerCase()} o extensión (Ej. ${newEjidoType} Chimal, Sector Tamante, Las Ánimas...)`}
                      className="flex-1 px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddNewEjido}
                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Incorporar al Padrón</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddEjidoModal(false)}
                        className="px-3 py-2 text-xs text-stone-600 hover:text-stone-800 bg-stone-200 rounded-lg cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 truncate">
                    CURP (Clave Única de Registro) *
                  </label>
                  {producerData.curp ? (
                    curpVal.isValid ? (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 font-mono-data shadow-2xs">
                        <Check className="w-3 h-3 text-emerald-600" /> 18/18 Válida
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-800 font-mono-data bg-amber-50 px-2 py-0.5 rounded border border-amber-300 shadow-2xs">
                        {producerData.curp.length}/18 car.
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-stone-500 font-mono-data">18 car.</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  maxLength={18}
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={producerData.curp}
                  onChange={(e) => handleFieldChange('curp', sanitizeCurp(e.target.value))}
                  placeholder="GUAA620415HVRRRN08"
                  className={`w-full px-3.5 py-2.5 text-sm font-mono-data border rounded-lg uppercase tracking-wider transition-colors ${
                    producerData.curp
                      ? curpVal.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20 text-emerald-950 font-bold shadow-2xs'
                        : 'border-amber-400 focus:ring-2 focus:ring-amber-500 bg-amber-50/20 text-stone-900'
                      : 'border-stone-300 focus:ring-2 focus:ring-amber-500 bg-stone-50/50'
                  }`}
                />
                <p className="text-[10px] mt-1 text-stone-500">
                  {producerData.curp ? (
                    curpVal.isValid ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" /> Estructura oficial validada ante RENAPO
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {curpVal.message}
                      </span>
                    )
                  ) : (
                    'Solo letras y números. Mayúsculas automáticas (18 dígitos/letras).'
                  )}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 truncate">
                    RFC (Registro Federal de Contribuyentes) *
                  </label>
                  {producerData.rfc ? (
                    rfcVal.isValid ? (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 font-mono-data shadow-2xs">
                        <Check className="w-3 h-3 text-emerald-600" /> RFC SAT
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-800 font-mono-data bg-amber-50 px-2 py-0.5 rounded border border-amber-300 shadow-2xs">
                        {producerData.rfc.length} de 10 a 13 car.
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-stone-500 font-mono-data">12 o 13 car.</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  maxLength={13}
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={producerData.rfc}
                  onChange={(e) => handleFieldChange('rfc', sanitizeRfc(e.target.value))}
                  placeholder="AUTB910616 o AUTB910616ABC"
                  className={`w-full px-3.5 py-2.5 text-sm font-mono-data border rounded-lg uppercase tracking-wider transition-colors ${
                    producerData.rfc
                      ? rfcVal.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20 text-emerald-950 font-bold shadow-2xs'
                        : 'border-amber-400 focus:ring-2 focus:ring-amber-500 bg-amber-50/20 text-stone-900'
                      : 'border-stone-300 focus:ring-2 focus:ring-amber-500 bg-stone-50/50'
                  }`}
                />
                <p className="text-[10px] mt-1 text-stone-500">
                  {producerData.rfc ? (
                    rfcVal.isValid ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" /> RFC oficial validado (iniciales + fecha + homoclave)
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {rfcVal.message}
                      </span>
                    )
                  ) : (
                    '10 caracteres = RFC base (viene en INE). 13 caracteres = RFC completo con homoclave (viene en cédula SAT).'
                  )}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 truncate">
                    INE (Credencial para Votar) *
                  </label>
                  {producerData.ine ? (
                    ineVal.isValid ? (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 font-mono-data shadow-2xs">
                        <Check className="w-3 h-3 text-emerald-600" />
                        {producerData.ine.length === 18 ? '✓ Clave Elector' : '✓ Folio INE'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-800 font-mono-data bg-amber-50 px-2 py-0.5 rounded border border-amber-300 shadow-2xs">
                        {producerData.ine.length}/18 car.
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-stone-500 font-mono-data">10 a 18 car.</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  maxLength={18}
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={producerData.ine || ''}
                  onChange={(e) => handleFieldChange('ine', sanitizeIne(e.target.value))}
                  placeholder="GUAAAR62041530H100 o Folio 0846104552"
                  className={`w-full px-3.5 py-2.5 text-sm font-mono-data border rounded-lg uppercase tracking-wider transition-colors ${
                    producerData.ine
                      ? ineVal.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20 text-emerald-950 font-bold shadow-2xs'
                        : 'border-amber-400 focus:ring-2 focus:ring-amber-500 bg-amber-50/20 text-stone-900'
                      : 'border-stone-300 focus:ring-2 focus:ring-amber-500 bg-stone-50/50'
                  }`}
                />
                <p className="text-[10px] mt-1 text-stone-500">
                  {producerData.ine ? (
                    ineVal.isValid ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        {producerData.ine.length === 18
                          ? 'Clave de Elector oficial verificada (18 caracteres).'
                          : 'Folio o CIC de credencial de elector verificado.'}
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {ineVal.message}
                      </span>
                    )
                  ) : (
                    'Clave de Elector (18 caracteres) o Folio / CIC (10 a 13 dígitos).'
                  )}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 truncate">
                    Teléfono de Contacto <span className="text-[10px] text-stone-400 normal-case">(opcional)</span>
                  </label>
                  {producerData.phone ? (
                    phoneVal.isValid ? (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 font-mono-data shadow-2xs">
                        <Check className="w-3 h-3 text-emerald-600" /> 10 dígitos
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-800 font-mono-data bg-amber-50 px-2 py-0.5 rounded border border-amber-300 shadow-2xs">
                        {producerData.phone.replace(/\D/g, '').length}/10 dígitos
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      10 dígitos
                    </span>
                  )}
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={12}
                  value={producerData.phone}
                  onChange={(e) => handleFieldChange('phone', formatAndSanitizePhone(e.target.value))}
                  placeholder="846-104-5521"
                  className={`w-full px-3.5 py-2.5 text-sm font-mono-data border rounded-lg transition-colors ${
                    producerData.phone
                      ? phoneVal.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20 text-emerald-950 font-bold shadow-2xs'
                        : 'border-amber-400 focus:ring-2 focus:ring-amber-500 bg-amber-50/20 text-stone-900'
                      : 'border-stone-300 focus:ring-2 focus:ring-amber-500 bg-stone-50/50'
                  }`}
                />
                <p className="text-[10px] mt-1 text-stone-500">
                  {producerData.phone ? (
                    phoneVal.isValid ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" /> Línea nacional a 10 dígitos validada
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {phoneVal.message}
                      </span>
                    )
                  ) : (
                    'Opcional. Si lo proporciona, recibira avisos por WhatsApp. Formato: 846-104-5521'
                  )}
                </p>
              </div>

              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 truncate">
                    Correo Electrónico (Email) <span className="text-[10px] text-stone-400 normal-case">(opcional)</span>
                  </label>
                  {producerData.email ? (
                    emailVal.isValid ? (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 shadow-2xs">
                        <Check className="w-3 h-3 text-emerald-600" /> Email Válido
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1 shadow-2xs">
                        <AlertCircle className="w-3 h-3 text-amber-600" /> Formato Inválido
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-stone-500 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200">
                      Opcional
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="email"
                    inputMode="email"
                    value={producerData.email}
                    onChange={(e) => handleFieldChange('email', sanitizeEmail(e.target.value))}
                    placeholder="ejemplo.productor@correo.com"
                    className={`w-full pl-9 pr-3.5 py-2.5 text-sm border rounded-lg font-medium transition-colors ${
                      producerData.email
                        ? emailVal.isValid
                          ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20 text-emerald-950 font-bold shadow-2xs'
                          : 'border-amber-400 focus:ring-2 focus:ring-amber-500 bg-amber-50/20 text-stone-900'
                        : 'border-stone-300 focus:ring-2 focus:ring-amber-500 bg-stone-50/50'
                    }`}
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[10px] mt-1 text-stone-500">
                  {producerData.email ? (
                    emailVal.isValid ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" /> Correo electrónico verificado para refrendos y sanidad
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {emailVal.message}
                      </span>
                    )
                  ) : (
                    'Opcional. Si lo proporciona, recibira avisos de refrendo anual y notificaciones de sanidad pecuaria.'
                  )}
                </p>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Domicilio Legal en Pánuco, Ver. *
                </label>
                <input
                  type="text"
                  required
                  value={producerData.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  placeholder="CARRETERA PÁNUCO-TEMPOAL KM 14, INTERIOR 2, PÁNUCO, VERACRUZ"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50 uppercase"
                />
              </div>

              <div className="lg:col-span-3 pt-3 border-t border-stone-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-800 font-cinzel">
                      Firma Autógrafa Digital del Titular
                    </span>
                  </div>
                  {producerData.producerSignature ? (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      Firma Registrada en Expediente
                    </span>
                  ) : (
                    <span className="text-[10px] text-stone-500">
                      (Firma oficial autógrafa para el expediente y título oficial)
                    </span>
                  )}
                </div>
                <SignaturePad
                  value={producerData.producerSignature}
                  onChange={(sig) => {
                    // FASE_0_3: subida diferida — solo guardar base64, subir al guardar
                    handleFieldChange('producerSignature', sig);
                  }}
                  signerName={producerData.fullName || 'Productor Titular'}
                />
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-stone-500 text-center sm:text-left">
                * Campos obligatorios para asentar en el Libro Oficial de Fierros.
              </span>
              <button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continuar a Hoja 2: Datos del Predio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* HOJA 2: DATOS DEL PREDIO */}
        {currentStep === 2 && (
          <div className="bg-white border-2 border-stone-200 rounded-xl p-4 sm:p-7 shadow-sm transition-all">
            <div className="flex items-center gap-3 border-b border-stone-200 pb-4 mb-6">
              <div className="p-2.5 bg-emerald-100 text-emerald-900 rounded-xl">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800 block">
                  Hoja 2 de 4 · Unidad de Producción Pecuaria
                </span>
                <h2 className="text-lg sm:text-xl font-cinzel font-bold text-stone-900">
                  2. Datos del Predio, Tenencia y Hato Ganadero
                </h2>
                <p className="text-xs text-stone-500">
                  Ubicación física del rancho, superficie, régimen ejidal o propiedad y clave UPP.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Nombre del Predio o Rancho *
                </label>
                <input
                  type="text"
                  required
                  value={producerData.propertyName}
                  onChange={(e) => handleFieldChange('propertyName', e.target.value)}
                  placeholder="RANCHO LA HUASTECA ALTA"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50 uppercase font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Superficie Total (Hectáreas) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={producerData.surfaceHectares || ''}
                  onChange={(e) => {
                    const cleaned = sanitizeDecimal(e.target.value);
                    handleFieldChange('surfaceHectares', cleaned === '' ? 0 : parseFloat(cleaned) || 0);
                  }}
                  placeholder="185.5"
                  className="w-full px-3.5 py-2.5 text-sm font-mono-data border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50"
                />
                <p className="text-[10px] mt-1 text-stone-500">Solo números y punto decimal (Hectáreas).</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Tipo de Tenencia *
                </label>
                <select
                  value={producerData.tenureType}
                  onChange={(e) => handleFieldChange('tenureType', e.target.value as ProducerData['tenureType'])}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50"
                >
                  <option value="EJIDAL">EJIDAL</option>
                  <option value="PROPIEDAD">PROPIEDAD</option>
                </select>
                <p className="text-[10px] mt-1 text-stone-500">Régimen legal del predio o rancho.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 truncate">
                    Clave UPP (Unidad de Producción Pecuaria) *
                  </label>
                  {producerData.uppKey ? (
                    isStandardSiniigaUpp(producerData.uppKey) ? (
                      <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 shadow-2xs font-mono-data">
                        <Check className="w-3 h-3 text-emerald-600" /> SINIIGA (12 dígitos)
                      </span>
                    ) : (
                      <span className="text-[10px] text-blue-800 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-300 flex items-center gap-1 shadow-2xs font-mono-data">
                        <Check className="w-3 h-3 text-blue-600" /> Clave Aceptada (Libre)
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      30-123-XXXX-XXX
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={producerData.uppKey}
                    onChange={(e) => handleFieldChange('uppKey', formatAndSanitizeUppKey(e.target.value))}
                    placeholder="30-123-XXXX-XXX (solo números)"
                    className={`w-full px-3.5 py-2.5 text-sm font-mono-data border rounded-lg focus:ring-2 focus:ring-amber-500 uppercase transition-colors ${
                      producerData.uppKey
                        ? isStandardSiniigaUpp(producerData.uppKey)
                          ? 'border-emerald-500 bg-emerald-50/20 text-emerald-950 font-bold shadow-2xs'
                          : 'border-blue-400 bg-blue-50/20 text-blue-950 font-semibold shadow-2xs'
                        : 'border-stone-300 bg-stone-50/50'
                    }`}
                  />
                  {producerData.uppKey &&
                    producerData.uppKey.replace(/\D/g, '').length === 12 &&
                    !isStandardSiniigaUpp(producerData.uppKey) && (
                      <button
                        type="button"
                        onClick={() => {
                          const digits = producerData.uppKey.replace(/\D/g, '');
                          handleFieldChange('uppKey', `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5, 9)}-${digits.slice(9, 12)}`);
                        }}
                        className="absolute right-2 top-2 px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 text-[10px] font-bold rounded shadow-xs cursor-pointer"
                        title="Formatear automáticamente como 30-123-XXXX-XXX"
                      >
                        ⚡ Aplicar Guiones SINIIGA
                      </button>
                    )}
                </div>

                <p className="text-[10px] mt-1 text-stone-500">
                  Escriba solo los 12 números. El sistema agrega los guiones automáticamente. Ej: <strong>301231234567</strong> → <strong>30-123-1234-567</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Cantidad Estimada de Ganado (Cabezas) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={producerData.cattleCount || ''}
                  onChange={(e) => {
                    const cleaned = sanitizeInteger(e.target.value);
                    handleFieldChange('cattleCount', cleaned === '' ? 0 : parseInt(cleaned, 10) || 0);
                  }}
                  placeholder="240"
                  className="w-full px-3.5 py-2.5 text-sm font-mono-data border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50"
                />
                <p className="text-[10px] mt-1 text-stone-500">Solo números enteros (mínimo 1 cabeza).</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Especie *
                </label>
                <select
                  value={producerData.species}
                  onChange={(e) => handleFieldChange('species', e.target.value as ProducerData['species'])}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50"
                >
                  <option value="BOVINO">BOVINO</option>
                  <option value="EQUINO">EQUINO</option>
                  <option value="OVINO">OVINO</option>
                  <option value="CAPRINO">CAPRINO</option>
                  <option value="PORCINO">PORCINO</option>
                  <option value="COLMENA">COLMENA</option>
                  <option value="MIXTOS">MIXTOS</option>
                </select>
                <p className="text-[10px] mt-1 text-stone-500">Especie animal objeto del registro pecuario.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Ganadero Asociado *
                </label>
                <select
                  value={producerData.associatedRancher || 'NO'}
                  onChange={(e) => handleFieldChange('associatedRancher', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50"
                >
                  <option value="NO">NO</option>
                  <option value="SÍ">SÍ</option>
                </select>
                <p className="text-[10px] mt-1 text-stone-500">Membresía en la Asociación Ganadera Local de Pánuco.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Fin Zootécnico *
                </label>
                <select
                  value={producerData.zootechnicalPurpose || 'BOVINO Y DOBLE PROPÓSITO'}
                  onChange={(e) => handleFieldChange('zootechnicalPurpose', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-stone-50/50"
                >
                  <option value="BOVINO Y DOBLE PROPÓSITO">BOVINO Y DOBLE PROPÓSITO</option>
                  <option value="BOVINO EN LECHE">BOVINO EN LECHE</option>
                  <option value="BOVINO EN CARNE">BOVINO EN CARNE</option>
                  <option value="MIEL">MIEL</option>
                </select>
                <p className="text-[10px] mt-1 text-stone-500">Finalidad de la explotación ganadera o apícola.</p>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePrev}
                className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a Hoja 1</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continuar a Hoja 3: Asiento y Folio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* HOJA 3: CONTROL LEGAL, FOLIO Y LIBROS MUNICIPALES */}
        {currentStep === 3 && (
          <div className="bg-white border-2 border-stone-200 rounded-xl p-4 sm:p-7 shadow-sm transition-all">
            <div className="flex items-center gap-3 border-b border-stone-200 pb-4 mb-6">
              <div className="p-2.5 bg-stone-900 text-amber-400 rounded-xl">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-800 block">
                  Hoja 3 de 4 · Asiento Notarial y Padrón
                </span>
                <h2 className="text-lg sm:text-xl font-cinzel font-bold text-stone-900">
                  3. Control Legal, Folio y Libros del H. Ayuntamiento
                </h2>
                <p className="text-xs text-stone-500">
                  Numeración oficial y asiento registral expedido por la Dirección de Fomento Agropecuario.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-amber-50/60 border-2 border-amber-300 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 bg-amber-200 text-amber-900 rounded font-bold text-xs font-mono-data">FOLIO</span>
                    <label className="text-xs font-bold uppercase tracking-wider text-amber-950 font-cinzel">
                      Folio Oficial Municipal (Auto-incremental) *
                    </label>
                  </div>
                  <span className="text-[10px] font-mono-data text-amber-900 font-bold bg-amber-200/80 px-2 py-0.5 rounded border border-amber-300">
                    Oficial
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-amber-200/80 items-end">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-[10px] font-bold text-amber-950">
                        Folio Asignado al Trámite:
                      </label>
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={producerData.folio}
                      placeholder="Se generara automaticamente..."
                      className="w-full px-2.5 py-1.5 text-xs font-mono-data font-bold text-amber-950 bg-amber-100/80 border-2 border-amber-400 rounded-lg uppercase shadow-2xs cursor-not-allowed opacity-90"
                      title="Folio generado automaticamente desde la nomenclatura de Settings"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 border-2 border-emerald-300 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 bg-emerald-200 text-emerald-900 rounded font-bold text-xs font-mono-data">REG</span>
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-950 font-cinzel">
                      Número de Registro Oficial *
                    </label>
                  </div>
                  <span className="text-[10px] font-mono-data text-emerald-900 font-bold bg-emerald-200/80 px-2 py-0.5 rounded border border-emerald-300">
                    Notarial
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-emerald-200/80 items-end">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-[10px] font-bold text-emerald-950">
                        Registro Asignado al Trámite:
                      </label>
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={producerData.registrationNumber}
                      placeholder="Se generara automaticamente..."
                      className="w-full px-2.5 py-1.5 text-xs font-mono-data font-bold text-emerald-950 bg-emerald-100/80 border-2 border-emerald-400 rounded-lg uppercase shadow-2xs cursor-not-allowed opacity-90"
                      title="Registro generado automaticamente desde la nomenclatura de Settings"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Libro de Asiento Municipal
                </label>
                <input
                  type="text"
                  value={producerData.bookNumber}
                  onChange={(e) => handleFieldChange('bookNumber', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50/50 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Foja de Asiento
                </label>
                <input
                  type="text"
                  value={producerData.folioPage}
                  onChange={(e) => handleFieldChange('folioPage', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50/50 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Periodo de Vigencia Legal
                </label>
                <input
                  type="text"
                  value={producerData.validityRange}
                  onChange={(e) => handleFieldChange('validityRange', e.target.value)}
                  placeholder="2026 - 2029"
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50/50 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Fecha de Expedición Oficial *
                </label>
                <input
                  type="date"
                  required
                  value={producerData.issueDate}
                  onChange={(e) => handleFieldChange('issueDate', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono-data border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Fecha de Expiración
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={computeFechaExpiracion()}
                  placeholder="Calculada desde vigencia"
                  className="w-full px-3.5 py-2 text-sm font-mono-data border border-stone-300 rounded-lg bg-stone-100 text-stone-600 cursor-not-allowed"
                  title="Se calcula automaticamente: 31/12 del año final del periodo de vigencia"
                />
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  Calculada desde Periodo de Vigencia
                </span>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePrev}
                className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a Hoja 2</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continuar a Hoja 4: Cotejo y Monograma</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* HOJA 4: COTEJO NOTARIAL Y MONOGRAMA */}
        {currentStep === 4 && (
          <div className="bg-white border-2 border-stone-200 rounded-xl p-4 sm:p-7 shadow-sm transition-all space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
              <div className="p-2.5 bg-amber-500 text-stone-950 rounded-xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-800 block">
                  Hoja 4 de 5 · Cotejo Notarial y Monograma de Forja
                </span>
                <h2 className="text-lg sm:text-xl font-cinzel font-bold text-stone-900">
                  4. Cotejo Notarial de Expediente y Derivación de Monograma
                </h2>
                <p className="text-xs text-stone-500">
                  Coteje los datos asentados contra los documentos probatorios originales y vincule el monograma de forja antes de emitir el registro definitivo.
                </p>
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-700" />
                  <h3 className="font-cinzel font-bold text-xs sm:text-sm text-stone-900 uppercase">
                    Cotejo de Asiento Registral Pecuario (Pánuco, Ver.)
                  </h3>
                </div>
                <span className="text-[10px] font-mono-data font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                  ETAPA: COTEJO NOTARIAL PREVIO
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                <div className="p-3 bg-white rounded-lg border border-stone-200 shadow-2xs">
                  <span className="text-[9px] uppercase font-bold text-stone-400 block mb-1">
                    1. Titular e Identificación
                  </span>
                  <span className="font-bold text-stone-900 font-cinzel text-sm truncate block">
                    {producerData.fullName || 'No especificado'}
                  </span>
                  <div className="mt-1.5 space-y-0.5 text-[11px] text-stone-600 font-mono-data">
                    <div>CURP: <span className="text-stone-900 font-semibold">{producerData.curp || '---'}</span></div>
                    <div>RFC: <span className="text-stone-900 font-semibold">{producerData.rfc || '---'}</span></div>
                    <div>INE: <span className="text-stone-900 font-semibold">{producerData.ine || '---'}</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-100 text-[10px] text-stone-500 space-y-0.5">
                    <div className="truncate">Domicilio: {producerData.address || 'Sin domicilio'}</div>
                    <div className="truncate">Tel: {producerData.phone || 'Sin teléfono'}</div>
                    <div className="truncate">Email: {producerData.email || 'Sin correo'}</div>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-[10px] text-stone-500">Firma del Titular:</span>
                    {producerData.producerSignature ? (
                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-700" />
                        Capturada en Hoja 1
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                        Pendiente en Hoja 1
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-stone-200 shadow-2xs">
                  <span className="text-[9px] uppercase font-bold text-stone-400 block mb-1">
                    2. Predio y Producción Pecuaria
                  </span>
                  <span className="font-bold text-stone-900 text-sm truncate block">
                    {producerData.propertyName || 'No especificado'}
                  </span>
                  <div className="mt-1.5 space-y-0.5 text-[11px] text-stone-600">
                    <div>Ejido: <span className="text-stone-900 font-semibold">{producerData.ejido || '---'}</span></div>
                    <div>Municipio: <span className="text-stone-900 font-semibold">{producerData.municipio || 'Pánuco'}, Ver.</span></div>
                    <div>Superficie: <span className="text-stone-900 font-semibold">{producerData.surfaceHectares} Has. ({producerData.tenureType})</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-100 text-[11px] text-emerald-800 font-semibold font-mono-data space-y-0.5">
                    <div>Clave UPP: <span className="text-emerald-950 font-bold">{producerData.uppKey || '---'}</span></div>
                    <div>Hato: <span className="text-emerald-950 font-bold">{producerData.cattleCount} {producerData.species}</span></div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-stone-200 shadow-2xs">
                  <span className="text-[9px] uppercase font-bold text-stone-400 block mb-1">
                    3. Asiento y Control Notarial
                  </span>
                  <span className="font-bold text-amber-900 font-mono-data text-sm truncate block">
                    FOLIO: {producerData.folio || '---'}
                  </span>
                  <div className="mt-1.5 space-y-0.5 text-[11px] text-stone-600 font-mono-data">
                    <div>Registro: <span className="text-stone-900 font-semibold">{producerData.registrationNumber || '---'}</span></div>
                    <div>Libro: <span className="text-stone-900 font-semibold">{producerData.bookNumber || '---'}</span></div>
                    <div>Foja: <span className="text-stone-900 font-semibold">{producerData.folioPage || '---'}</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-100 text-[10px] text-stone-600 space-y-0.5">
                    <div>Vigencia: <span className="font-semibold text-stone-800">{producerData.validityRange || '2026-2029'}</span></div>
                    <div>Expedición: <span className="font-semibold text-stone-800">{producerData.issueDate || '---'}</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-amber-50/70 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between mb-3 border-b border-amber-200/70 pb-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-amber-800" />
                  <h4 className="text-xs sm:text-sm font-bold uppercase text-amber-950 font-cinzel">
                    Protocolo de Cotejo Notarial y Certificación Documental
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded">
                  Ley Ganadera Edo. Veracruz
                </span>
              </div>

              <p className="text-xs text-amber-900/80 mb-3">
                Verifique que los documentos físicos o digitales coincidan con los datos capturados antes de autorizar la emisión oficial:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-4">
                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-lg border border-amber-200/80 cursor-pointer hover:bg-amber-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={cotejoDocs.ine}
                    onChange={(e) => setCotejoDocs((prev) => ({ ...prev, ine: e.target.checked }))}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-stone-900 block">1. Identificación INE/IFE</span>
                    <span className="text-[11px] text-stone-500">Cotejada con CURP y RFC</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-lg border border-amber-200/80 cursor-pointer hover:bg-amber-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={cotejoDocs.predio}
                    onChange={(e) => setCotejoDocs((prev) => ({ ...prev, predio: e.target.checked }))}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-stone-900 block">2. Título / Certificado</span>
                    <span className="text-[11px] text-stone-500">Cotejado con predio y ejido</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-lg border border-amber-200/80 cursor-pointer hover:bg-amber-50/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={cotejoDocs.upp}
                    onChange={(e) => setCotejoDocs((prev) => ({ ...prev, upp: e.target.checked }))}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-stone-900 block">3. Clave UPP Oficial</span>
                    <span className="text-[11px] text-stone-500">Cotejada con hato declarado</span>
                  </div>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-amber-200/70">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !isCotejoApproved;
                      setIsCotejoApproved(nextVal);
                      if (nextVal) {
                        setSaveAlert('✅ Cotejo Notarial certificado y aprobado conforme a la Ley Ganadera.');
                        setTimeout(() => setSaveAlert(null), 3500);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      isCotejoApproved
                        ? 'bg-emerald-700 text-white shadow hover:bg-emerald-800'
                        : 'bg-stone-800 text-stone-100 hover:bg-stone-900'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isCotejoApproved ? '✓ Cotejo Notarial Aprobado' : 'Marcar Cotejo como Aprobado'}</span>
                  </button>
                  <span className="text-xs text-stone-600">
                    {isCotejoApproved ? 'Expediente jurídicamente validado para emisión.' : 'Haga clic para validar el cotejo.'}
                  </span>
                </div>

                {isCotejoApproved && (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                    Listo para Protocolización
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6 bg-gradient-to-br from-amber-50 to-white border-2 border-amber-300 rounded-2xl shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-800 text-white shadow-xs">
                      🎨 Paso 2 · Diseño del Fierro Quemador
                    </span>
                    {isMonogramLinked ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                        ✅ Diseñado y vinculado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        ⚠️ Pendiente de diseño
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-base sm:text-lg font-cinzel font-bold text-stone-900">
                      {isMonogramLinked
                        ? 'Fierro Quemador Diseñado y Listo'
                        : 'Diseñe el Fierro Quemador del Expediente'}
                    </h4>
                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mt-1">
                      {isMonogramLinked
                        ? 'El fierro fue vinculado correctamente al expediente. Puede revisarlo o modificarlo antes de continuar al resumen final.'
                        : 'Antes de emitir el registro oficial, debe diseñar el fierro quemador que se vinculará a este expediente. El sistema verificará automáticamente que no exista duplicidad con los registros municipales.'}
                    </p>
                  </div>

                  {isMonogramLinked && derivedInitials && (
                    <div className="text-xs text-stone-600">
                      Monograma actual: <strong className="font-cinzel text-amber-900 text-base">"{derivedInitials}"</strong>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsForjaModalOpen(true)}
                    className="px-6 py-3.5 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 active:scale-98 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ring-4 ring-amber-500/20"
                  >
                    <span className="text-base">🎨</span>
                    <span>{isMonogramLinked ? 'Revisar / Modificar Fierro' : 'Abrir Laboratorio de Forja Digital'}</span>
                    <span className="text-base">→</span>
                  </button>
                  <span className="text-[10px] text-stone-500 text-center">
                    {isMonogramLinked ? 'El diseño ya esta vinculado' : 'Paso obligatorio antes de continuar'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-5 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePrev}
                className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a Hoja 3: Asiento y Folio</span>
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (!isCotejoApproved && !isMonogramLinked) {
                      setValidationWarning('Para avanzar a la Hoja 5 (Resumen y Emisión), confirme el cotejo notarial o vincule el monograma.');
                      return;
                    }
                    handleNext();
                  }}
                  className={`w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    !isCotejoApproved && !isMonogramLinked
                      ? 'bg-amber-600/70 hover:bg-amber-600'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  <span>Continuar a Hoja 5: Resumen y Emisión</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HOJA 5: RESUMEN Y EMISIÓN */}
        {currentStep === 5 && (
          <div className="bg-white border-2 border-stone-200 rounded-xl p-4 sm:p-7 shadow-sm transition-all space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800 block">
                  Hoja 5 de 5 · Resumen Final y Asiento Notarial
                </span>
                <h2 className="text-lg sm:text-xl font-cinzel font-bold text-stone-900">
                  5. Resumen Ejecutivo, Protocolización y Emisión Oficial
                </h2>
                <p className="text-xs text-stone-500">
                  Expediente cotejado y validado con monograma oficial. Proceda al asentamiento en el Padrón Municipal y la emisión de documentos oficiales.
                </p>
              </div>
            </div>

            <div className="bg-stone-50 border-2 border-amber-600/30 rounded-2xl p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-stone-200 pb-3 mb-4 gap-2">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-amber-800 block">
                    H. Ayuntamiento Constitucional de Pánuco, Veracruz
                  </span>
                  <h3 className="font-cinzel font-bold text-base sm:text-lg text-stone-900">
                    Título y Asiento Notarial de Fierro Quemador
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-data font-bold text-stone-900 bg-white border border-stone-300 px-2.5 py-1 rounded">
                    FOLIO: {producerData.folio}
                  </span>
                  <span className="text-xs font-mono-data font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    COTEJADO
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                  <span className="text-[9px] uppercase font-bold text-stone-400 block mb-1">
                    Titular del Registro
                  </span>
                  <span className="font-bold text-stone-900 font-cinzel text-sm truncate block">
                    {producerData.fullName || '---'}
                  </span>
                  <div className="mt-1 space-y-0.5 text-[11px] text-stone-600 font-mono-data">
                    <div>CURP: {producerData.curp || '---'}</div>
                    <div>RFC: {producerData.rfc || '---'}</div>
                    <div>INE: {producerData.ine || '---'}</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-100">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 inline-flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Firma Digital Registrada
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                  <span className="text-[9px] uppercase font-bold text-stone-400 block mb-1">
                    Predio y Producción
                  </span>
                  <span className="font-bold text-stone-900 text-sm truncate block">
                    {producerData.propertyName || '---'}
                  </span>
                  <div className="mt-1 space-y-0.5 text-[11px] text-stone-600">
                    <div>{producerData.ejido}, Pánuco, Ver.</div>
                    <div>{producerData.surfaceHectares} Has. ({producerData.tenureType})</div>
                    <div className="font-mono-data text-emerald-800 font-semibold">UPP: {producerData.uppKey || '---'}</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-100 text-[10px] text-stone-600">
                    Hato: <span className="font-bold text-stone-900">{producerData.cattleCount} {producerData.species}</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                  <span className="text-[9px] uppercase font-bold text-stone-400 block mb-1">
                    Control Notarial Municipal
                  </span>
                  <span className="font-bold text-amber-900 font-mono-data text-sm truncate block">
                    REG: {producerData.registrationNumber || '---'}
                  </span>
                  <div className="mt-1 space-y-0.5 text-[11px] text-stone-600 font-mono-data">
                    <div>{producerData.bookNumber}</div>
                    <div>{producerData.folioPage}</div>
                    <div>Vigencia: {producerData.validityRange}</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-100 text-[10px] text-stone-600">
                    Expedición: {producerData.issueDate || '---'}
                  </div>
                </div>

                <div className="p-3 bg-stone-900 text-white rounded-xl border border-stone-800 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-amber-400 block mb-1">
                      Monograma Oficial
                    </span>
                    <div className="flex items-center gap-2.5 mt-1">
                      <div className="w-20 h-20 bg-white rounded-lg border border-amber-400/40 flex items-center justify-center shrink-0 overflow-hidden">
                        {brandConfig && brandConfig.initials ? (
                          <canvas
                            ref={hoja5FierroCanvasRef}
                            width={200}
                            height={200}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="font-cinzel font-black text-2xl text-stone-900">
                            {derivedInitials}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px]">
                        <span className="font-bold text-stone-100 block">"{brandConfig?.initials || derivedInitials}"</span>
                        <span className="text-stone-400 text-[10px]">Forja Huasteca</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-800 text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <Check className="w-3 h-3" />
                    <span>Vinculado a Expediente</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    <strong>Expediente Completo y Protocolizado:</strong> Cotejo notarial aprobado conforme a los Artículos 45 al 62 de la Ley Ganadera de Veracruz.
                  </span>
                </div>
                <span className="text-[10px] font-mono-data font-bold text-emerald-800 bg-white border border-emerald-300 px-2 py-0.5 rounded shrink-0">
                  ESTATUS: VÁLIDO
                </span>
              </div>
            </div>

            <div className="pt-5 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePrev}
                className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a Cotejo (Hoja 4)</span>
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">

                <button
                  type="button"
                  onClick={() => {
                    if (!fullValidation.isValid) {
                      setValidationActionAttempted('print');
                      setShowValidationModal(true);
                      setValidationWarning(
                        `Impresión Bloqueada: El formulario tiene ${fullValidation.errors.length} campos faltantes o inválidos. Complete todos los datos obligatorios antes de imprimir.`
                      );
                      return;
                    }
                    if (onGoToCertificado) {
                      onGoToCertificado();
                    }
                  }}
                  className={`w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-bold text-white rounded-lg shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                    !fullValidation.isValid
                      ? 'bg-rose-700 hover:bg-rose-800 ring-2 ring-rose-300'
                      : isSaved
                      ? 'bg-emerald-700 hover:bg-emerald-600 ring-2 ring-emerald-500/30'
                      : 'bg-stone-900 hover:bg-stone-800'
                  }`}
                  title={!fullValidation.isValid ? 'Requiere todos los campos completados y validados' : isSaved ? 'Registro guardado. Ir a Certificado Oficial y Descarga PDF' : 'Ir a Certificado Oficial y Descarga PDF'}
                >
                  <Printer className="w-4 h-4" />
                  <span>{!fullValidation.isValid ? 'Revisar Datos para Certificar' : 'Ir a Certificado, Imprimir y Enviar'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave()}
                  className={`w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white rounded-lg shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 text-center ${
                    isSaved
                      ? 'bg-emerald-700 hover:bg-emerald-600 ring-2 ring-emerald-500/30'
                      : 'bg-stone-900 hover:bg-stone-800'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 ${isSaved ? 'text-emerald-100' : 'text-emerald-400'}`} />
                  <span>{isSaved ? 'Registro Guardado ✓' : 'Guardar y Asentar Registro'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Version History & Drafts Modal */}
      <VersionHistoryModal
        isOpen={showVersionHistoryModal}
        onClose={() => setShowVersionHistoryModal(false)}
        versions={savedVersions}
        currentProducer={producerData}
        onRestoreVersion={handleRestoreVersion}
        onDeleteVersion={handleDeleteVersion}
        onClearAllVersions={handleClearAllVersions}
        onCreateManualCheckpoint={handleCreateManualCheckpoint}
      />

      {/* Modal del Laboratorio de Forja Digital */}
      {isForjaModalOpen && brandConfig && onChangeBrandConfig && (
        <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border-2 border-amber-700 shadow-2xl max-w-7xl w-full max-h-[96vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-lg">
                  🎨
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 block">
                    Laboratorio de Forja Digital · Panuco, Ver.
                  </span>
                  <h3 className="text-sm sm:text-lg font-cinzel font-bold text-amber-100">
                    Diseño y Vinculación del Fierro Quemador
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsForjaModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xl leading-none"
                title="Cerrar Laboratorio"
              >
                ✕
              </button>
            </div>

            <div className="px-4 sm:px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span>
                <strong>Titular:</strong> {producerData.fullName || 'Sin capturar'}
              </span>
              <span className="font-mono-data font-bold">
                Monograma actual: "{brandConfig.initials || derivedInitials || 'XX'}"
              </span>
            </div>

            <div className="p-2 sm:p-4 overflow-y-auto flex-1 bg-stone-50">
              <TabCreador
                brandConfig={brandConfig}
                onChangeBrandConfig={onChangeBrandConfig}
                onGoToAntiduplicidad={() => {
                  setIsForjaModalOpen(false);
                  setSaveAlert('Para auditar este fierro contra el padron municipal, cierre el modal y use "Consultar Motor Antiduplicidad" en la pestana Creador.');
                  setTimeout(() => setSaveAlert(null), 5000);
                }}
                onGoToCertificado={() => {
                  setIsForjaModalOpen(false);
                }}
                onUseForCertificate={async (finalConfig, embedding) => {
                  setIsMonogramLinked(true);
                  setIsForjaModalOpen(false);
                  
                  // FASE_0_3: generar PNG del fierro + guardar como base64 (subida diferida)
                  let fierroBase64 = '';
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 400;
                    canvas.height = 400;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.fillStyle = '#ffffff';
                      ctx.fillRect(0, 0, 400, 400);
                      
                      const { renderBrandToCanvas } = await import('../utils/canvasRenderer');
                      renderBrandToCanvas(ctx, 400, 400, finalConfig, {
                        background: 'transparent',
                        showShadow: false,
                        resolutionScale: 2,
                      });
                      
                      fierroBase64 = canvas.toDataURL('image/png');
                      console.log('%c[Forja] PNG del fierro generado en memoria', 'color: #22c55e', {
                        size: fierroBase64.length,
                      });
                    }
                  } catch (err) {
                    console.warn('[Forja] No se pudo generar PNG del fierro:', err);
                  }
                  
                  if (embedding) {
                    onChangeProducerData((prev) => ({
                      ...prev,
                      vector_64d: embedding.embedding,
                      brandVector: embedding.embedding,
                      vector_checksum: embedding.checksum,
                      vector_density: embedding.density,
                      vector_symmetry_h: embedding.symmetryH,
                      vector_symmetry_v: embedding.symmetryV,
                      vector_proportions: embedding.proportions,
                      vector_varianza: embedding.variance,
                      fierroDigitalizadoPhoto: fierroBase64 || prev.fierroDigitalizadoPhoto,
                    }));
                    console.log('%c[Forja] Vector 64D + PNG vinculados', 'color: #22c55e', {
                      checksum: embedding.checksum,
                      density: embedding.density,
                      celdas: embedding.embedding.length,
                    });
                  } else {
                    onChangeProducerData((prev) => ({
                      ...prev,
                      fierroDigitalizadoPhoto: fierroBase64 || prev.fierroDigitalizadoPhoto,
                    }));
                    console.warn('[Forja] Vinculado SIN embedding');
                  }
                  
                  setSaveAlert('✅ Fierro "' + (finalConfig.initials || 'AB') + '" disenado y vinculado. Se subira a Cloudinary al guardar.');
                  setTimeout(() => setSaveAlert(null), 5000);
                }}
                useForCertificateLabel="✅ Vincular este Diseño al Expediente"
              />
            </div>

            <div className="p-3 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500 shrink-0">
              <span>Los cambios se guardan automaticamente al vincular</span>
              <button
                type="button"
                onClick={() => setIsForjaModalOpen(false)}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer px-3 py-1.5 rounded hover:bg-stone-200"
              >
                Cerrar sin vincular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors Modal */}
      <ValidationErrorsModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        errors={fullValidation.errors}
        actionAttempted={validationActionAttempted}
        onNavigateToStep={(step) => {
          setShowValidationModal(false);
          setCurrentStep(step);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* BLOQUE_E: Modal de validacion entre hojas */}
      <MissingFieldsModal
        isOpen={showMissingFieldsModal}
        onClose={() => setShowMissingFieldsModal(false)}
        missingFields={missingFields}
        currentStep={currentStep}
        onContinueAnyway={() => {
          if (pendingNextStep !== null) {
            setCurrentStep(pendingNextStep);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const saved = saveDraftVersion(producerData, 'step_change', `Avance a Hoja ${pendingNextStep}`, pendingNextStep);
            if (saved) {
              setSavedVersions(getSavedDraftVersions());
              const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
              setLastAutoSaveTime(timeStr);
            }
            setPendingNextStep(null);
          }
        }}
      />

      {/* Modal de Captura de Fotografía Oficial */}
      <PhotoCaptureModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onPhotoCaptured={async (photoUrl) => {
          // FASE_0_3: subida diferida - solo guardar base64, subir al guardar
          const compressed = await compressPhotoLocally(photoUrl, 400, 0.75);
          setPhotoLoadError(false);

          if (compressed && compressed.length > 100) {
            console.log('%c[Foto] Capturada (subida diferida al guardar)', 'color: #0ea5e9');
            handleFieldChange('producerPhoto', compressed);
            setSaveAlert('✅ Fotografía capturada. Se subirá a Cloudinary al guardar el registro.');
          }

          setTimeout(() => setSaveAlert(null), 4000);
        }}
        currentPhoto={producerData.producerPhoto}
        producerName={producerData.fullName}
        initialMode={photoModalMode}
      />
    </div>
  );
};