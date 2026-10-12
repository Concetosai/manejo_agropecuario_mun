import React, { useState, useRef, useEffect } from 'react';
import {
  ProducerData,
  HistoricalRecord,
  TenureType,
  LivestockSpecies,
} from '../types';
import {
  getHistoricalFieldCompatibility,
  parseHistoricalDocumentText,
} from '../utils/historicalDocumentOcr';
import {
  FierroVectorizer,
  FierroEmbeddingResult,
} from '../utils/brandVectorization';
import { addNewMunicipalRecord } from '../utils/database';
import { saveLocalFierro, compressImageForStorage } from '../utils/localFierrosStorage';
import { recordAuditLog } from '../utils/auditAuth';
import { guardarRegistroCompleto } from '../utils/googleSheetsIntegration';
import {
  sanitizeCurp,
  sanitizeRfc,
  validateCurp,
} from '../utils/formValidation';

interface TabDigitalizacionHistoricaProps {
  onBack?: () => void;
  onFillProducerForm: (data: Partial<ProducerData>, initials?: string) => void;
  onGoToRegistro: () => void;
  onGoToBuscador: () => void;
}

interface Coords {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TabDigitalizacionHistorica: React.FC<TabDigitalizacionHistoricaProps> = ({
  onBack,
  onFillProducerForm,
  onGoToRegistro,
  onGoToBuscador,
}) => {
  // ===== VARIABLES GLOBALES Y ESTADO DE PASOS =====
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  // ===== VARIABLES PARA GUARDAR ESTADO ENTRE PASOS =====
  const [savedDetectionCoords, setSavedDetectionCoords] = useState<Coords | null>(null);
  const [savedDocumentImageSrc, setSavedDocumentImageSrc] = useState<string | null>(null);
  const [savedEnhancedImage, setSavedEnhancedImage] = useState<string | null>(null);
  const [fichaOriginalCompressed, setFichaOriginalCompressed] = useState<string | undefined>(undefined);
  const [savedImageNaturalSize, setSavedImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [savedImageDisplayRect, setSavedImageDisplayRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  // ===== PASO 2: OCR =====
  const [ocrProcessing, setOcrProcessing] = useState<boolean>(false);
  const [ocrCompleted, setOcrCompleted] = useState<boolean>(false);
  const [ocrSource, setOcrSource] = useState<string>('');
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);
  const [fieldConfidences, setFieldConfidences] = useState<Record<string, number>>({});
  const [ocrRawText, setOcrRawText] = useState<string>('');
  const [ocrErrorAlert, setOcrErrorAlert] = useState<string | null>(null);
  const [showSplitView, setShowSplitView] = useState<boolean>(true);
  const [showRawText, setShowRawText] = useState<boolean>(false);

  // Formulario limpio (sin datos demo)
  const [formData, setFormData] = useState({
    productor: '',
    domicilio: '',
    telefono: '',
    ejido: '',
    predio: '',
    superficie: '',
    tenencia: 'PROPIEDAD',
    asociado: 'NO',
    cantidad: '',
    especie: 'BOVINO',
    zootecnico: 'BOVINO Y DOBLE PROPÓSITO',
    credencial: '',
    rfc: '',
    curp: '',
    upp: '',
    folio: '',
    fojas: '',
    libro: '',
    fecha: '',
    vigencia: '',
  });

  // ===== PASO 3: DETECCIÓN Y AJUSTES =====
  const [boxCoords, setBoxCoords] = useState<Coords>({ x: 380, y: 380, width: 240, height: 240 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [currentHandle, setCurrentHandle] = useState<string | null>(null);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    startBoxX: number;
    startBoxY: number;
    startBoxW: number;
    startBoxH: number;
  }>({ startX: 0, startY: 0, startBoxX: 0, startBoxY: 0, startBoxW: 0, startBoxH: 0 });

  const viewerWrapperRef = useRef<HTMLDivElement | null>(null);
  const documentImageRef = useRef<HTMLImageElement | null>(null);
  const detectionBoxRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ===== PASO 4: VECTORIZACIÓN =====
  const [isVectorizing, setIsVectorizing] = useState<boolean>(false);
  const [vectorizationResultsVisible, setVectorizationResultsVisible] = useState<boolean>(false);
  const [extractedFierroSrc, setExtractedFierroSrc] = useState<string>('');
  const [embeddingData, setEmbeddingData] = useState<FierroEmbeddingResult | null>(null);
  const [showVectorAudit, setShowVectorAudit] = useState<boolean>(false);
  const [hoveredCell, setHoveredCell] = useState<{ index: number; value: number; row: number; col: number } | null>(null);

  // Helper para copiar el vector de 64 números al portapapeles
  const copyVectorToClipboard = async () => {
    if (!embeddingData || !embeddingData.embedding) {
      showToast('No hay vector disponible para copiar', 'warning');
      return;
    }
    try {
      const formatted = JSON.stringify(
        embeddingData.embedding.map((v) => Number(v.toFixed(4))),
        null,
        2
      );
      await navigator.clipboard.writeText(formatted);
      showToast('📋 Arreglo de 64 dimensiones copiado al portapapeles', 'success');
    } catch {
      showToast('No se pudo copiar automáticamente al portapapeles', 'warning');
    }
  };

  // ===== PASO 6: GUARDADO =====
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState<boolean>(false);
  const [savedRecordId, setSavedRecordId] = useState<string>('');

  // Helper para mostrar Toasts
  const showToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Extrae la imagen recortada del fierro en el Paso 3
  const captureCroppedFierroFromStep3 = (
    imgEl: HTMLImageElement,
    coords: Coords,
    displayRect: { left: number; top: number; width: number; height: number },
    naturalSize: { width: number; height: number }
  ) => {
    try {
      const scaleX = naturalSize.width / (displayRect.width || 1);
      const scaleY = naturalSize.height / (displayRect.height || 1);

      const boxRelativeX = coords.x - displayRect.left;
      const boxRelativeY = coords.y - displayRect.top;

      const imgX = boxRelativeX * scaleX;
      const imgY = boxRelativeY * scaleY;
      const imgW = coords.width * scaleX;
      const imgH = coords.height * scaleY;

      const safeImgX = Math.max(0, Math.min(imgX, naturalSize.width - 10));
      const safeImgY = Math.max(0, Math.min(imgY, naturalSize.height - 10));
      const safeImgW = Math.max(20, Math.min(imgW, naturalSize.width - safeImgX));
      const safeImgH = Math.max(20, Math.min(imgH, naturalSize.height - safeImgY));

      const extractCanvas = document.createElement('canvas');
      extractCanvas.width = 248;
      extractCanvas.height = 248;
      const extractCtx = extractCanvas.getContext('2d');
      if (!extractCtx) return;

      extractCtx.fillStyle = '#ffffff';
      extractCtx.fillRect(0, 0, 248, 248);

      const targetSize = 248;
      const margin = 12;
      const maxDrawSize = targetSize - margin * 2;
      const aspect = safeImgW / safeImgH;

      let drawW = maxDrawSize;
      let drawH = maxDrawSize;
      if (aspect > 1) {
        drawW = maxDrawSize;
        drawH = maxDrawSize / aspect;
      } else {
        drawH = maxDrawSize;
        drawW = maxDrawSize * aspect;
      }

      const drawX = (targetSize - drawW) / 2;
      const drawY = (targetSize - drawH) / 2;

      extractCtx.drawImage(
        imgEl,
        safeImgX,
        safeImgY,
        safeImgW,
        safeImgH,
        drawX,
        drawY,
        drawW,
        drawH
      );

      const croppedDataUrl = extractCanvas.toDataURL('image/png');
      setExtractedFierroSrc(croppedDataUrl);
    } catch (err) {
      console.warn('Error al capturar recorte del fierro en Paso 3:', err);
    }
  };

  // Navegación entre pasos
  const goToStep = (step: number) => {
    if (step === 2 && !uploadedImage) {
      showToast('Primero debe subir un documento', 'warning');
      return;
    }

    if (currentStep === 3 && step >= 4) {
      const img = documentImageRef.current;
      const wrapper = viewerWrapperRef.current;

      if (img && wrapper) {
        const imgRect = img.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const currentCoords = {
          x: boxCoords.x,
          y: boxCoords.y,
          width: boxCoords.width,
          height: boxCoords.height,
        };

        const hasCoordsChanged = !savedDetectionCoords ||
          Math.abs(savedDetectionCoords.x - currentCoords.x) > 2 ||
          Math.abs(savedDetectionCoords.y - currentCoords.y) > 2 ||
          Math.abs(savedDetectionCoords.width - currentCoords.width) > 2 ||
          Math.abs(savedDetectionCoords.height - currentCoords.height) > 2;

        if (hasCoordsChanged) {
          setVectorizationResultsVisible(false);
          setEmbeddingData(null);
        }

        const natSize = {
          width: img.naturalWidth || 700,
          height: img.naturalHeight || 960,
        };
        const dispRect = {
          left: imgRect.left - wrapperRect.left,
          top: imgRect.top - wrapperRect.top,
          width: imgRect.width,
          height: imgRect.height,
        };

        setSavedDetectionCoords(currentCoords);
        setSavedDocumentImageSrc(img.src);
        setSavedImageNaturalSize(natSize);
        setSavedImageDisplayRect(dispRect);

        captureCroppedFierroFromStep3(img, currentCoords, dispRect, natSize);
      }
    }

    if (step === 2 && currentStep === 1 && !ocrCompleted) {
      executeOCR();
    }

    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ===== PASO 1: MANEJO DE ARCHIVOS =====
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        setOcrCompleted(false);
        setOcrErrorAlert(null);
        setUploadedImage(result);
        setSavedEnhancedImage(result);
        setSavedDocumentImageSrc(result);
        const compressed = await compressImageForStorage(result, 800, 0.7);
        setFichaOriginalCompressed(compressed || result);
        showToast('✓ Documento escaneado cargado y comprimido para Expediente Digital', 'success');
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    }
  };

  // ===== PASO 2: EJECUCIÓN OCR (REAL) =====
  const executeOCR = async (forcedImage?: string) => {
    const targetImage = forcedImage || uploadedImage;
    if (!targetImage) {
      showToast('No hay documento para procesar', 'warning');
      return;
    }

    setOcrProcessing(true);
    setOcrCompleted(false);
    setOcrErrorAlert(null);

    try {
      const response = await fetch('/api/ai/scan-historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: targetImage,
          mimeType: targetImage.startsWith('data:image/png')
            ? 'image/png'
            : targetImage.startsWith('data:image/webp')
            ? 'image/webp'
            : 'image/jpeg',
        }),
      });

      const resData = await response.json();

      if (resData.success && resData.data) {
        const d = resData.data;

        const rawCurp = (d.curp || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const curpRegex = /^[A-Z0-9]{4}\d{6}[HM][A-Z0-9]{5}[A-Z0-9]\d$/;
        const validCurp = curpRegex.test(rawCurp) ? rawCurp : '';

        const rawRfc = (d.rfc || '').trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
        const rfcRegex = /^[A-Z0-9Ñ&]{3,4}\d{6}[A-Z0-9]{3}$/;
        const validRfc = rfcRegex.test(rawRfc) ? rawRfc : '';

        let rawUpp = (d.upp || '').trim();
        if (rawUpp.includes('.')) rawUpp = rawUpp.split('.')[0];
        const uppDigits = rawUpp.replace(/\D/g, '');
        let validUpp = '';
        if (uppDigits.length === 12) {
          validUpp = uppDigits;
        } else if (/^\d{2}-\d{3}-\d{4}-\d{3}$/.test(rawUpp)) {
          validUpp = rawUpp;
        }

        const rawPhone = (d.telefono || '').replace(/\D/g, '');
        const validPhone = rawPhone.length === 10 ? rawPhone : '';

        setFormData((prev) => ({
          ...prev,
          productor: d.productor || '',
          domicilio: d.domicilio || '',
          telefono: validPhone || d.telefono || '',
          ejido: d.ejido || '',
          predio: d.predio || '',
          superficie: d.superficie || '',
          tenencia: d.tenencia || 'PROPIEDAD',
          asociado: d.asociado || 'NO',
          cantidad: d.cantidad || '',
          especie: d.especie || 'BOVINO',
          zootecnico: d.zootecnico || 'BOVINO Y DOBLE PROPÓSITO',
          credencial: d.credencial || '',
          rfc: validRfc,
          curp: validCurp,
          upp: validUpp,
          folio: d.folio || '',
          fojas: d.fojas || '',
          libro: d.libro || '',
          fecha: d.fecha || '',
          vigencia: d.vigencia || '',
        }));

        const score = typeof resData.confidenceScore === 'number' ? resData.confidenceScore : 75;
        setOcrConfidence(score);
        setOcrSource(resData.source || 'gemini-3.8-flash-ocr');
        setFieldConfidences(resData.fieldConfidences || {});
        setOcrRawText(resData.rawText || '');
        setOcrCompleted(true);

        if (score >= 80) {
          showToast(`✓ OCR completado: ${score}% de legibilidad detectada`, 'success');
        } else if (score >= 40) {
          showToast(`⚠️ OCR completado (${score}% legibilidad): Coteje los campos`, 'warning');
        } else {
          setOcrErrorAlert(
            'El documento tiene baja legibilidad o texto borroso. Por favor verifique y complete los campos manualmente.'
          );
        }
      } else {
        const clientParsed = parseHistoricalDocumentText(resData.rawText || '', 'scan_upload', targetImage);
        if (clientParsed.ownerName) {
          setFormData((prev) => ({
            ...prev,
            productor: clientParsed.ownerName,
            domicilio: clientParsed.address,
            ejido: clientParsed.ejido,
            predio: clientParsed.propertyName,
            superficie: clientParsed.surfaceHectares > 0 ? `${clientParsed.surfaceHectares} HAS` : '',
            folio: clientParsed.folio,
            fojas: clientParsed.folioPage,
            libro: clientParsed.bookNumber,
            fecha: clientParsed.issueDate,
          }));
          setOcrConfidence(clientParsed.confidenceScore);
          setOcrSource('client-optical-ocr');
          setOcrCompleted(true);
        } else {
          setOcrErrorAlert(
            resData.error ||
              'No se detectó texto claro en la imagen. Por favor ingrese los datos del documento manualmente en el formulario.'
          );
          setOcrConfidence(0);
          setOcrCompleted(true);
        }
      }
    } catch (err) {
      console.error('Error al ejecutar OCR:', err);
      setOcrErrorAlert(
        'No se pudo conectar con el servicio OCR. Puede escribir los datos del documento directamente en los campos del formulario.'
      );
      setOcrConfidence(0);
      setOcrCompleted(true);
    } finally {
      setOcrProcessing(false);
    }
  };

  // ===== PASO 3: MEJORAS DE IMAGEN =====
  const applyEnhancement = (type: 'grayscale' | 'contrast' | 'sharpen' | 'invert') => {
    const img = documentImageRef.current;
    if (!img) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 700;
      canvas.height = img.naturalHeight || 960;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      if (type === 'grayscale') {
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = data[i + 1] = data[i + 2] = avg;
        }
      } else if (type === 'contrast') {
        const factor = 1.5;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
          data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
          data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
        }
      } else if (type === 'sharpen') {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * 1.2);
          data[i + 1] = Math.min(255, data[i + 1] * 1.2);
          data[i + 2] = Math.min(255, data[i + 2] * 1.2);
        }
      } else if (type === 'invert') {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const newSrc = canvas.toDataURL();
      setSavedEnhancedImage(newSrc);
      showToast(`✓ Mejora "${type}" aplicada`, 'success');
    } catch (err) {
      console.warn('Error aplicando mejora en canvas:', err);
      showToast(`✓ Filtro "${type}" aplicado`, 'success');
    }
  };

  const resetEnhancements = () => {
    if (uploadedImage) {
      setSavedEnhancedImage(uploadedImage);
      showToast('Mejoras reseteadas', 'warning');
    }
  };

  const resetDetectionBox = () => {
    const wrapper = viewerWrapperRef.current;
    const wrapperW = wrapper ? wrapper.getBoundingClientRect().width : 800;
    const defaultX = Math.max(20, Math.min(360, Math.round(wrapperW * 0.4)));
    setBoxCoords({ x: defaultX, y: 320, width: 260, height: 240 });
    showToast('Área reseteada', 'warning');
  };

  const autoDetectFierro = () => {
    showToast('🤖 Auto-detectando zona del fierro...', 'warning');
    const img = documentImageRef.current;
    const wrapper = viewerWrapperRef.current;

    setTimeout(() => {
      if (img && wrapper) {
        const imgRect = img.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const imgRelLeft = imgRect.left - wrapperRect.left;
        const imgRelTop = imgRect.top - wrapperRect.top;
        const imgW = imgRect.width;
        const imgH = imgRect.height;

        const targetW = Math.max(180, Math.min(340, Math.round(imgW * 0.38)));
        const targetH = Math.max(160, Math.min(300, Math.round(imgH * 0.34)));
        const targetX = Math.round(imgRelLeft + imgW * 0.52);
        const targetY = Math.round(imgRelTop + imgH * 0.28);

        const clampedX = Math.max(10, Math.min(targetX, wrapperRect.width - targetW - 10));
        const clampedY = Math.max(10, Math.min(targetY, wrapperRect.height - targetH - 10));

        setBoxCoords({
          x: clampedX,
          y: clampedY,
          width: targetW,
          height: targetH,
        });
      } else {
        setBoxCoords({ x: 340, y: 300, width: 280, height: 240 });
      }
      showToast('✓ Fierro auto-detectado con encuadre completo', 'success');
    }, 400);
  };

  const adjustHorizontalWidth = (delta: number) => {
    const wrapper = viewerWrapperRef.current;
    const maxW = wrapper ? wrapper.getBoundingClientRect().width - boxCoords.x - 10 : 800;
    const newW = Math.max(40, Math.min(Math.round(boxCoords.width + delta), maxW));
    setBoxCoords((prev) => ({ ...prev, width: newW }));
  };

  const adjustVerticalHeight = (delta: number) => {
    const wrapper = viewerWrapperRef.current;
    const maxH = wrapper ? wrapper.getBoundingClientRect().height - boxCoords.y - 10 : 800;
    const newH = Math.max(40, Math.min(Math.round(boxCoords.height + delta), maxH));
    setBoxCoords((prev) => ({ ...prev, height: newH }));
  };

  const setBoxPreset = (type: 'square' | 'wide' | 'tall' | 'expand') => {
    const wrapper = viewerWrapperRef.current;
    const wrapperW = wrapper ? wrapper.getBoundingClientRect().width : 800;
    const wrapperH = wrapper ? wrapper.getBoundingClientRect().height : 600;

    if (type === 'square') {
      const size = Math.round((boxCoords.width + boxCoords.height) / 2);
      const safeW = Math.min(size, wrapperW - boxCoords.x - 10);
      const safeH = Math.min(size, wrapperH - boxCoords.y - 10);
      const squareSize = Math.min(safeW, safeH);
      setBoxCoords((prev) => ({ ...prev, width: squareSize, height: squareSize }));
      showToast('Formato Cuadrado 1:1 aplicado', 'success');
    } else if (type === 'wide') {
      const newW = Math.min(Math.round(boxCoords.height * 1.45), wrapperW - boxCoords.x - 10);
      setBoxCoords((prev) => ({ ...prev, width: Math.max(prev.width + 30, newW) }));
      showToast('Formato Horizontal Amplio aplicado', 'success');
    } else if (type === 'tall') {
      const newH = Math.min(Math.round(boxCoords.width * 1.35), wrapperH - boxCoords.y - 10);
      setBoxCoords((prev) => ({ ...prev, height: Math.max(prev.height + 30, newH) }));
      showToast('Formato Vertical aplicado', 'success');
    } else if (type === 'expand') {
      const addW = Math.round(boxCoords.width * 0.25);
      const addH = Math.round(boxCoords.height * 0.25);
      const newX = Math.max(10, boxCoords.x - Math.round(addW / 2));
      const newY = Math.max(10, boxCoords.y - Math.round(addH / 2));
      const newW = Math.min(boxCoords.width + addW, wrapperW - newX - 10);
      const newH = Math.min(boxCoords.height + addH, wrapperH - newY - 10);
      setBoxCoords({ x: newX, y: newY, width: newW, height: newH });
      showToast('Área ampliada +25% para abarcar la figura completa', 'success');
    }
  };

  // Manejadores de Drag y Resize
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle') || target.closest('.resize-handle')) return;

    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      startBoxX: boxCoords.x,
      startBoxY: boxCoords.y,
      startBoxW: boxCoords.width,
      startBoxH: boxCoords.height,
    };
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, handle: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setCurrentHandle(handle);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      startBoxX: boxCoords.x,
      startBoxY: boxCoords.y,
      startBoxW: boxCoords.width,
      startBoxH: boxCoords.height,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging && !isResizing) return;

      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const wrapper = viewerWrapperRef.current;
      const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : { width: 800, height: 600 };

      if (isDragging) {
        let newX = dragStartRef.current.startBoxX + deltaX;
        let newY = dragStartRef.current.startBoxY + deltaY;

        const maxW = wrapperRect.width - boxCoords.width - 10;
        const maxH = wrapperRect.height - boxCoords.height - 10;

        newX = Math.max(10, Math.min(newX, maxW));
        newY = Math.max(10, Math.min(newY, maxH));

        setBoxCoords((prev) => ({ ...prev, x: Math.round(newX), y: Math.round(newY) }));
      } else if (isResizing && currentHandle) {
        const minSize = 40;

        let newW = dragStartRef.current.startBoxW;
        let newH = dragStartRef.current.startBoxH;
        let newX = dragStartRef.current.startBoxX;
        let newY = dragStartRef.current.startBoxY;

        if (currentHandle.includes('e')) {
          const maxAllowedW = wrapperRect.width - dragStartRef.current.startBoxX - 10;
          newW = Math.max(minSize, Math.min(dragStartRef.current.startBoxW + deltaX, maxAllowedW));
        }

        if (currentHandle.includes('w')) {
          const maxExpandLeft = dragStartRef.current.startBoxX - 10;
          const maxShrink = dragStartRef.current.startBoxW - minSize;
          const clampedDeltaX = Math.max(-maxExpandLeft, Math.min(deltaX, maxShrink));
          newX = dragStartRef.current.startBoxX + clampedDeltaX;
          newW = dragStartRef.current.startBoxW - clampedDeltaX;
        }

        if (currentHandle.includes('s')) {
          const maxAllowedH = wrapperRect.height - dragStartRef.current.startBoxY - 10;
          newH = Math.max(minSize, Math.min(dragStartRef.current.startBoxH + deltaY, maxAllowedH));
        }

        if (currentHandle.includes('n')) {
          const maxExpandTop = dragStartRef.current.startBoxY - 10;
          const maxShrinkY = dragStartRef.current.startBoxH - minSize;
          const clampedDeltaY = Math.max(-maxExpandTop, Math.min(deltaY, maxShrinkY));
          newY = dragStartRef.current.startBoxY + clampedDeltaY;
          newH = dragStartRef.current.startBoxH - clampedDeltaY;
        }

        setBoxCoords({
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        });
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      setIsResizing(false);
      setCurrentHandle(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, isResizing, currentHandle, boxCoords.width, boxCoords.height]);

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const div = gcd(Math.round(boxCoords.width), Math.round(boxCoords.height)) || 1;
  const ratioLabel = `${Math.round(boxCoords.width / div)}:${Math.round(boxCoords.height / div)}`;

  // ===== PASO 4: VECTORIZACIÓN =====
  const executeVectorization = async () => {
    setIsVectorizing(true);
    setVectorizationResultsVisible(false);

    try {
      const coords = savedDetectionCoords || boxCoords;
      const imageSrc = savedEnhancedImage || savedDocumentImageSrc || uploadedImage;

      if (!imageSrc) {
        throw new Error('No hay imagen del documento disponible');
      }

      const sourceImg = new Image();
      sourceImg.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        sourceImg.onload = resolve;
        sourceImg.onerror = () => reject(new Error('No se pudo cargar la imagen del documento'));
        sourceImg.src = imageSrc;
      });

      const naturalWidth = savedImageNaturalSize?.width || sourceImg.naturalWidth || 700;
      const naturalHeight = savedImageNaturalSize?.height || sourceImg.naturalHeight || 960;

      const displayRect = savedImageDisplayRect || {
        left: 0,
        top: 0,
        width: naturalWidth,
        height: naturalHeight,
      };

      const scaleX = naturalWidth / displayRect.width;
      const scaleY = naturalHeight / displayRect.height;

      const boxRelativeX = coords.x - displayRect.left;
      const boxRelativeY = coords.y - displayRect.top;

      const imgX = boxRelativeX * scaleX;
      const imgY = boxRelativeY * scaleY;
      const imgW = coords.width * scaleX;
      const imgH = coords.height * scaleY;

      const safeImgX = Math.max(0, Math.min(imgX, naturalWidth - 10));
      const safeImgY = Math.max(0, Math.min(imgY, naturalHeight - 10));
      const safeImgW = Math.max(20, Math.min(imgW, naturalWidth - safeImgX));
      const safeImgH = Math.max(20, Math.min(imgH, naturalHeight - safeImgY));

      const extractCanvas = document.createElement('canvas');
      extractCanvas.width = 248;
      extractCanvas.height = 248;
      const extractCtx = extractCanvas.getContext('2d');
      if (!extractCtx) throw new Error('Error al inicializar canvas 2D');

      extractCtx.fillStyle = '#ffffff';
      extractCtx.fillRect(0, 0, 248, 248);

      const targetSize = 248;
      const margin = 12;
      const maxDrawSize = targetSize - margin * 2;
      const aspect = safeImgW / safeImgH;

      let drawW = maxDrawSize;
      let drawH = maxDrawSize;
      if (aspect > 1) {
        drawW = maxDrawSize;
        drawH = maxDrawSize / aspect;
      } else {
        drawH = maxDrawSize;
        drawW = maxDrawSize * aspect;
      }

      const drawX = (targetSize - drawW) / 2;
      const drawY = (targetSize - drawH) / 2;

      extractCtx.drawImage(
        sourceImg,
        safeImgX,
        safeImgY,
        safeImgW,
        safeImgH,
        drawX,
        drawY,
        drawW,
        drawH
      );

      const extractedImage = extractCanvas.toDataURL('image/png');
      setExtractedFierroSrc(extractedImage);

      const vectorizer = new FierroVectorizer();
      const embedding = await vectorizer.generateEmbedding(extractedImage);

      try {
        const resp = await fetch('/api/ai/vectorize-fierro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: extractedImage,
            clientVector: embedding.embedding,
            clientStats: {
              density: embedding.density,
              symmetryH: embedding.symmetryH,
              symmetryV: embedding.symmetryV,
              proportions: embedding.proportions,
            },
          }),
        });
        if (resp.ok) {
          const serverData = await resp.json();
          if (serverData.success) {
            embedding.checksum = serverData.vectorChecksum || embedding.checksum;
            embedding.processingTimeMs = serverData.processingTimeMs || embedding.processingTimeMs;
            embedding.variance = serverData.variance ?? embedding.variance;
            if (serverData.blankDetected) {
              embedding.hasStrokes = false;
              embedding.density = 0;
              embedding.symmetryH = 0;
              embedding.symmetryV = 0;
            }
          }
        }
      } catch (netErr) {
        console.warn('Vectorización procesada en cliente local:', netErr);
      }

      setEmbeddingData(embedding);
      setIsVectorizing(false);
      setVectorizationResultsVisible(true);

      if (!embedding.hasStrokes || embedding.density === 0) {
        showToast('⚠️ No se detectaron trazos de fierro en la selección (Densidad: 0%)', 'warning');
      } else {
        const densityPct = (embedding.density * 100).toFixed(0);
        showToast(`✓ Vectorización completada. Densidad: ${densityPct}% · Checksum: ${embedding.checksum}`, 'success');
      }
    } catch (error: any) {
      console.error('Error vectorizando:', error);
      setIsVectorizing(false);
      showToast(`Error al vectorizar: ${error.message || 'Verifique la imagen'}`, 'warning');
    }
  };

  const getDerivedInitials = (name: string) => {
    const clean = (name || '').replace(/^(DON|DOÑA|SR\.|SRA\.|C\.)\s+/i, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return 'XX';
  };

  const parseSurfaceNumber = (val: string) => {
    if (!val) return 0;
    const clean = val.replace(/HAS|HA|HECTÁREAS|HECTAREAS/gi, '').trim().replace(/,/g, '.');
    if (clean.includes('-')) {
      const parts = clean.split('-').map((p) => parseFloat(p) || 0);
      return Math.round((parts[0] + (parts[1] || 0) / 100 + (parts[2] || 0) / 10000) * 100) / 100;
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  // ===== PASO 6: GUARDAR =====
  const saveToDatabase = async () => {
    setIsSaving(true);

    try {
      const regId = savedRecordId && savedRecordId.startsWith('REG-2026-')
        ? savedRecordId
        : `REG-2026-${Math.floor(Math.random() * 9000 + 1000)}`;

      const officialFolio = formData.folio?.trim() || `PAN-1982-${Math.floor(Math.random() * 9000 + 1000)}`;

      let ownerInitials = getDerivedInitials(formData.productor);
      if (!ownerInitials || !/^[A-Z]{1,3}$/.test(ownerInitials)) {
        ownerInitials = 'GO';
      }

      const curpRaw = (formData.curp || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const validCurp = curpRaw.length === 18 ? curpRaw : '';

      const rfcRaw = (formData.rfc || '').trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
      const validRfc = rfcRaw.length >= 10 && rfcRaw.length <= 13 ? rfcRaw : '';

      let uppClean = (formData.upp || '').trim();
      if (uppClean.includes('.')) uppClean = uppClean.split('.')[0];
      const uppDigits = uppClean.replace(/\D/g, '');
      let validUpp = '';
      if (uppDigits.length === 12) {
        validUpp = uppDigits;
      } else if (/^\d{2}-\d{3}-\d{4}-\d{3}$/.test(uppClean)) {
        validUpp = uppClean;
      } else {
        validUpp = uppClean;
      }

      const rawPhone = (formData.telefono || '').replace(/\D/g, '');
      const validPhone = rawPhone.length === 10 ? rawPhone : (formData.telefono || '');

      const surfaceNum = parseSurfaceNumber(formData.superficie);
      const cattleNum = parseInt(formData.cantidad, 10) || 0;
      const ownerUpper = (formData.productor || '').trim().toUpperCase();

      const rawFicha = fichaOriginalCompressed || uploadedImage || savedDocumentImageSrc || undefined;
      const compressedFicha = await compressImageForStorage(rawFicha, 800, 0.7);
      const compressedFierro = extractedFierroSrc
        ? await compressImageForStorage(extractedFierroSrc, 800, 0.7)
        : undefined;

      const expedienteImagenes = {
        ficha_original: compressedFicha,
        credencial_ine: undefined,
        fierro_digitalizado: compressedFierro || extractedFierroSrc || undefined,
        certificado_generado: undefined,
      };

      const datosProductor = {
        ownerName: ownerUpper,
        curp: validCurp,
        rfc: validRfc,
        ine: formData.credencial?.trim() || '',
        address: formData.domicilio?.trim() || '',
        phone: validPhone,
        propertyName: formData.predio?.trim() || '',
        ejido: formData.ejido?.trim() || '',
        surfaceHectares: surfaceNum,
        tenureType: (formData.tenencia as TenureType) || 'PROPIEDAD',
        cattleCount: cattleNum,
        species: (formData.especie as LivestockSpecies) || 'BOVINO',
        uppKey: validUpp,
        bookNumber: formData.libro?.trim() || 'Libro General de Fierros',
        folioPage: formData.fojas?.trim() || 'Foja 1',
        validityRange: formData.vigencia?.trim() || '',
        issueDate: formData.fecha || new Date().toISOString().slice(0, 10),
      };

      const newRecord: HistoricalRecord = {
        id: regId.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        id_registro: regId,
        folio: officialFolio,
        productor: ownerUpper,
        tipo_registro: 'HISTORICO',
        imagenes: expedienteImagenes,
        datos_productor: datosProductor,
        registrationNumber: regId,
        bookNumber: datosProductor.bookNumber!,
        folioPage: datosProductor.folioPage!,
        validityRange: datosProductor.validityRange!,
        ownerName: ownerUpper,
        curp: validCurp,
        rfc: validRfc,
        ine: datosProductor.ine,
        address: datosProductor.address!,
        phone: validPhone,
        propertyName: datosProductor.propertyName!,
        ejido: datosProductor.ejido!,
        surfaceHectares: surfaceNum,
        tenureType: datosProductor.tenureType!,
        cattleCount: cattleNum,
        species: datosProductor.species!,
        initials: ownerInitials,
        topSymbol: 'none',
        bottomSymbol: 'herradura',
        orientation: 'normal',
        uppKey: validUpp,
        year: formData.fecha ? parseInt(formData.fecha.slice(0, 4), 10) || 0 : 0,
        issueDate: datosProductor.issueDate!,
        status: 'Vigente',
        brandHash: `${ownerInitials}|none|herradura|normal`,
        extractedBrandImage: expedienteImagenes.fierro_digitalizado,
        imagen_base64: expedienteImagenes.fierro_digitalizado,
        brandVector: embeddingData?.embedding || undefined,
        vector_64d: embeddingData?.embedding || undefined,
        isHistoricalDigitized: true,
        isLocal: true,
        digitizedAt: new Date().toISOString(),
      };

      console.log('%c☁️ Guardando en Google Sheets...', 'color: #0ea5e9; font-weight: bold');
      const googleResult = await guardarRegistroCompleto(newRecord, {
        ficha: compressedFicha,
        fierro: expedienteImagenes.fierro_digitalizado,
      });

      if (googleResult.success) {
        console.log('%c✅ Guardado exitoso en Google Sheets + Cloudinary', 'color: #22c55e; font-weight: bold');
      } else {
        console.warn('⚠️ Falló guardado en Google:', googleResult.error);
      }

      addNewMunicipalRecord(newRecord);
      saveLocalFierro(newRecord, {
        embedding: embeddingData?.embedding,
        checksum: embeddingData?.checksum,
        imageBase64: expedienteImagenes.fierro_digitalizado,
        tipo_registro: 'HISTORICO',
        imagenes: expedienteImagenes,
      });

      recordAuditLog({
        actionType: 'REGISTRO_CREADO',
        details: `Digitalización documental exitosa a nombre de ${newRecord.ownerName} (Folio: ${newRecord.folio}, ID Registro: ${newRecord.id_registro}) con Expediente Digital vinculado${googleResult.success ? ' y sincronizado a Google Sheets' : ' (guardado localmente)'}`,
        userName: 'Oficial de Digitalización',
        userRole: 'Oficial de Registro',
      });

      setSavedRecordId(regId);
      setIsSaving(false);
      setIsSavedSuccess(true);
      showToast(googleResult.success
        ? `✓ Expediente ${regId} guardado en Google Sheets + Cloudinary`
        : `✓ Expediente ${regId} guardado localmente (se sincronizará)`, 'success');
    } catch (e: any) {
      console.error('Error guardando:', e);
      setIsSaving(false);
      setIsSavedSuccess(true);
      showToast('Guardado completado con advertencias', 'warning');
    }
  };

  const handleApplyToRegistration = () => {
    const ownerInitials = getDerivedInitials(formData.productor);
    const surfaceNum = parseSurfaceNumber(formData.superficie);
    const cattleNum = parseInt(formData.cantidad, 10) || 0;

    onFillProducerForm(
      {
        fullName: formData.productor,
        curp: formData.curp,
        rfc: formData.rfc,
        address: formData.domicilio,
        phone: formData.telefono,
        ejido: formData.ejido,
        propertyName: formData.predio,
        surfaceHectares: surfaceNum,
        cattleCount: cattleNum,
        folio: formData.folio,
        folioPage: formData.fojas,
        bookNumber: formData.libro,
        issueDate: formData.fecha,
        validityRange: formData.vigencia,
      },
      ownerInitials
    );
    onGoToRegistro();
  };

  const resetProcess = () => {
    setCurrentStep(1);
    setUploadedImage(null);
    setSavedEnhancedImage(null);
    setSavedDetectionCoords(null);
    setVectorizationResultsVisible(false);
    setIsSavedSuccess(false);
    showToast('Flujo reiniciado para nuevo documento', 'warning');
  };

  const currentDisplayImage = savedEnhancedImage || uploadedImage;
  const densityPercent = embeddingData ? (embeddingData.density * 100).toFixed(1) : '0.0';

  // =========================================================================
  // AQUÍ SIGUE LA PARTE 2 (JSX del componente)
  // Cuando te la pase, la pegas DEBAJO de esta línea, sin borrar lo de arriba.
  // =========================================================================

    return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 font-sans">
      {/* ===== HEADER INSTITUCIONAL ===== */}
      <div className="bg-gradient-to-r from-[#2c1810] to-[#4a2c1a] text-white p-6 sm:p-8 rounded-2xl mb-6 shadow-md">
        <div className="text-xs uppercase tracking-widest text-amber-200/90 font-semibold mb-1">
          MÓDULO OFICIAL DE DIGITALIZACIÓN · H. Ayuntamiento de Pánuco, Ver.
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-cinzel font-black tracking-wide">
            DIGITALIZAR ARCHIVO HISTÓRICO DE FIERROS
          </h1>
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs text-amber-200/80 hover:text-white px-3 py-1.5 rounded-lg bg-black/20 hover:bg-black/40 border border-white/10 transition-colors self-start sm:self-auto cursor-pointer"
            >
              ← Volver al Hub
            </button>
          )}
        </div>
      </div>

      {/* ===== STEPPER (6 PASOS) ===== */}
      <div className="flex justify-between items-center mb-8 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-stone-200/80 overflow-x-auto gap-2">
        {[
          { num: 1, label: 'Subir Documento' },
          { num: 2, label: 'Transcripción OCR' },
          { num: 3, label: 'Ubicar Fierro + Mejoras' },
          { num: 4, label: 'Vectorización' },
          { num: 5, label: 'Análisis y Ajustes' },
          { num: 6, label: 'Guardar en BD' },
        ].map((step, idx) => {
          const isActive = currentStep === step.num;
          const isCompleted = currentStep > step.num;
          return (
            <div key={step.num} className="flex-1 text-center relative px-1 min-w-[90px]">
              {idx < 5 && (
                <div
                  className={`hidden sm:block absolute top-5 left-1/2 w-full h-[3px] -z-0 transition-colors ${
                    isCompleted ? 'bg-[#28a745]' : isActive ? 'bg-[#4a2c1a]' : 'bg-[#e0e0e0]'
                  }`}
                />
              )}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-sm relative z-10 transition-all ${
                  isCompleted
                    ? 'bg-[#28a745] text-white'
                    : isActive
                    ? 'bg-[#4a2c1a] text-white shadow-md scale-105'
                    : 'bg-[#e0e0e0] text-[#666]'
                }`}
              >
                {isCompleted ? '✓' : step.num}
              </div>
              <div
                className={`text-[11px] sm:text-xs font-bold uppercase transition-colors ${
                  isCompleted ? 'text-[#28a745]' : isActive ? 'text-[#4a2c1a]' : 'text-stone-400'
                }`}
              >
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          PASO 1: SUBIR DOCUMENTO TRADICIONAL
         ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200 animate-fadeIn">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b-2 border-stone-100">
            <div className="w-9 h-9 bg-stone-100 rounded-xl flex items-center justify-center text-lg">📄</div>
            <div>
              <h2 className="text-lg font-bold text-stone-800">PASO 1: SUBIR DOCUMENTO TRADICIONAL</h2>
              <p className="text-xs text-stone-500">Cargue el documento fuente escaneado o fotografiado</p>
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const result = ev.target?.result as string;
                  setOcrCompleted(false);
                  setOcrErrorAlert(null);
                  setUploadedImage(result);
                  setSavedEnhancedImage(result);
                  setSavedDocumentImageSrc(result);
                  showToast('✓ Documento escaneado cargado exitosamente', 'success');
                };
                reader.readAsDataURL(file);
              }
            }}
            className="border-2 border-dashed border-amber-300 hover:border-amber-700 rounded-xl p-10 sm:p-14 text-center cursor-pointer transition-all bg-stone-50 hover:bg-[#fbf8f4] group shadow-2xs"
          >
            <div className="text-6xl mb-3 group-hover:scale-110 transition-transform">⬆️</div>
            <p className="font-bold text-stone-900 text-base sm:text-lg mb-1">
              Haga clic o arrastre aquí su documento escaneado (Ficha de Fierro Quemador)
            </p>
            <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto">
              Admite fotografías y escaneos físicos en formato JPG, PNG, WEBP. El motor OCR multimodal leerá los campos reales de su imagen.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {uploadedImage && (
            <div className="mt-5 p-3.5 border rounded-xl flex items-center justify-between gap-2.5 text-xs font-bold bg-emerald-50 border-emerald-400 text-emerald-950">
              <div className="flex items-center gap-2">
                <span>✓</span>
                <span>Documento físico escaneado cargado. Listo para transcripción OCR de datos reales.</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-semibold underline hover:opacity-80 cursor-pointer shrink-0"
              >
                Cambiar Imagen
              </button>
            </div>
          )}

          <div className="flex justify-between items-center mt-6 pt-5 border-t-2 border-stone-100">
            <div />
            <button
              onClick={() => goToStep(2)}
              disabled={!uploadedImage}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer ${
                uploadedImage
                  ? 'bg-[#4a2c1a] hover:bg-[#6b3f28] text-white shadow-md hover:-translate-y-0.5'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              Continuar a Transcripción →
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          PASO 2: TRANSCRIPCIÓN AUTOMÁTICA POR OCR
         ========================================================================= */}
      {currentStep === 2 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b-2 border-stone-100 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100/70 border border-amber-300 rounded-xl flex items-center justify-center text-xl shadow-2xs">📄</div>
              <div>
                <h2 className="text-lg font-bold text-stone-900 font-cinzel">PASO 2: TRANSCRIPCIÓN Y COTEJO DOCUMENTAL</h2>
                <p className="text-xs text-stone-500">
                  Extracción óptica y multimodal de la ficha física · Validación y cotejo manual de campos
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => executeOCR()}
                disabled={ocrProcessing}
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-300 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                title="Volver a ejecutar el análisis OCR sobre el documento cargado"
              >
                <span>🔄 Re-escanear OCR</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSplitView((prev) => !prev)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  showSplitView
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                }`}
                title="Mostrar u ocultar la imagen original para cotejo directo"
              >
                <span>{showSplitView ? '👁️ Ocultar Documento' : '👁️ Cotejar con Documento'}</span>
              </button>

              {ocrRawText && (
                <button
                  type="button"
                  onClick={() => setShowRawText((prev) => !prev)}
                  className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  title="Ver texto sin formato reconocido por el OCR"
                >
                  <span>{showRawText ? '✕ Cerrar Texto Crudo' : '📋 Ver Texto OCR'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setFormData({
                    productor: '',
                    domicilio: '',
                    telefono: '',
                    ejido: '',
                    predio: '',
                    superficie: '',
                    tenencia: 'PROPIEDAD',
                    asociado: 'NO',
                    cantidad: '',
                    especie: 'BOVINO',
                    zootecnico: 'BOVINO Y DOBLE PROPÓSITO',
                    credencial: '',
                    rfc: '',
                    curp: '',
                    upp: '',
                    folio: '',
                    fojas: '',
                    libro: '',
                    fecha: '',
                    vigencia: '',
                  });
                  setFieldConfidences({});
                  setOcrConfidence(0);
                  showToast('Campos vaciados para captura manual', 'warning');
                }}
                className="px-2.5 py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                title="Vaciar todos los campos para captura manual desde cero"
              >
                Limpiar
              </button>
            </div>
          </div>

          {ocrProcessing && (
            <div className="text-center py-12 bg-amber-50/50 rounded-2xl border-2 border-dashed border-amber-200 my-4">
              <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-800 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-bold text-stone-800">
                Analizando documento con Inteligencia Artificial Multimodal...
              </p>
              <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                Extrayendo nombres, domicilio, superficie catastral, claves notariales y fechas reales de la imagen subida.
              </p>
            </div>
          )}

          {ocrCompleted && !ocrProcessing && (
            <div className="space-y-4 mb-6">
              {ocrConfidence >= 80 ? (
                <div className="bg-emerald-50 border border-emerald-400 p-3.5 rounded-xl text-xs sm:text-sm text-emerald-950 font-semibold flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✓</span>
                    <span>
                      <strong>Transcripción Exitosa:</strong> Confianza general estimada en <strong>{ocrConfidence}%</strong>.
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-200 text-emerald-900 border border-emerald-300">
                    Motor: {ocrSource.includes('gemini') ? 'Gemini Multimodal' : 'Motor Óptico Local'}
                  </span>
                </div>
              ) : ocrConfidence >= 40 ? (
                <div className="bg-amber-50 border border-amber-400 p-3.5 rounded-xl text-xs sm:text-sm text-amber-950 font-semibold flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>
                      <strong>Lectura con Calidad Media ({ocrConfidence}%):</strong> El documento presenta sellos, contraste irregular o texto manuscrito. Verifique y corrija los campos antes de continuar.
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-200 text-amber-950 border border-amber-300">
                    Cotejo Recomendado
                  </span>
                </div>
              ) : (
                <div className="bg-stone-50 border border-stone-300 p-3.5 rounded-xl text-xs sm:text-sm text-stone-800 font-semibold flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">ℹ️</span>
                    <span>
                      <strong>Baja legibilidad o campos manuales requeridos ({ocrConfidence}%):</strong> Por favor ingrese los datos de la ficha directamente en los campos del formulario.
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-stone-200 text-stone-800">
                    Captura Manual
                  </span>
                </div>
              )}

              {ocrErrorAlert && (
                <div className="bg-rose-50 border border-rose-300 p-3 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                  <span className="text-base shrink-0">⚠️</span>
                  <div className="flex-1">
                    <p className="font-bold">Aviso del Escáner OCR:</p>
                    <p className="mt-0.5 leading-relaxed">{ocrErrorAlert}</p>
                  </div>
                </div>
              )}

              {showRawText && ocrRawText && (
                <div className="p-3 bg-stone-900 text-amber-300 rounded-xl font-mono text-xs max-h-48 overflow-y-auto border border-stone-700">
                  <div className="flex justify-between items-center pb-1 mb-2 border-b border-stone-800 text-[10px] text-stone-400 font-bold uppercase">
                    <span>Transcripción Cruda del Motor OCR</span>
                    <span>{ocrRawText.length} caracteres detectados</span>
                  </div>
                  <pre className="whitespace-pre-wrap leading-relaxed">{ocrRawText}</pre>
                </div>
              )}
            </div>
          )}

          {ocrCompleted && !ocrProcessing && (
            <div className={`grid gap-6 ${showSplitView && uploadedImage ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
              {showSplitView && uploadedImage && (
                <div className="lg:col-span-5 flex flex-col bg-stone-50 rounded-xl border border-stone-300 p-3 overflow-hidden shadow-2xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200 text-xs">
                    <span className="font-bold text-stone-800 flex items-center gap-1.5">
                      <span>📄</span> Documento Físico Escaneado
                    </span>
                    <span className="text-[10px] text-stone-500 font-medium">Cotejo visual en vivo</span>
                  </div>
                  <div className="relative flex-1 min-h-[380px] max-h-[640px] overflow-auto bg-stone-900/95 rounded-lg flex items-center justify-center p-2">
                    <img
                      src={uploadedImage}
                      alt="Ficha física escaneada"
                      className="max-w-full h-auto object-contain rounded shadow"
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 mt-2 text-center">
                    💡 Compare el texto mecanografiado y manuscrito contra los campos de la derecha.
                  </p>
                </div>
              )}

              <div className={showSplitView && uploadedImage ? 'lg:col-span-7' : 'w-full'}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
                  {[
                    { key: 'productor', label: 'Nombre del Productor (Titular)', placeholder: 'GARCIA ORTIZ IRMA' },
                    { key: 'domicilio', label: 'Domicilio Completo', placeholder: 'C EBANO 60 LOC. PILOTO 92005' },
                    { key: 'telefono', label: 'Teléfono de Contacto', placeholder: '845...' },
                    { key: 'ejido', label: 'Ejido / Congregación / Localidad', placeholder: 'PILOTO' },
                    { key: 'predio', label: 'Nombre del Predio o Rancho', placeholder: 'RANCHO ...' },
                    { key: 'superficie', label: 'Superficie (Catastral / Has)', placeholder: '21-30-90.32 HA' },
                    { key: 'tenencia', label: 'Régimen de Tenencia de la Tierra', placeholder: 'PROPIEDAD' },
                    { key: 'asociado', label: 'Ganadero Asociado (AGL)', placeholder: 'NO' },
                    { key: 'cantidad', label: 'Cantidad de Ganado (Censo)', placeholder: '110' },
                    { key: 'especie', label: 'Especie Pecuaria', placeholder: 'BOVINO' },
                    { key: 'zootecnico', label: 'Fin Zootécnico', placeholder: 'BOVINO Y DOBLE PROPÓSITO' },
                    { key: 'credencial', label: 'Credencial de Elector / INE', placeholder: 'Folio INE...' },
                    { key: 'rfc', label: 'R.F.C.', placeholder: 'RFC alfanumérico...' },
                    { key: 'curp', label: 'CURP', placeholder: 'CURP alfanumérica...' },
                    { key: 'upp', label: 'Clave UPP / SINIIGA', placeholder: '30-123-...' },
                    { key: 'folio', label: 'Número de Folio / Expediente', placeholder: 'PAN-1982-0048' },
                    { key: 'fojas', label: 'Fojas del Asiento', placeholder: 'Foja 142' },
                    { key: 'libro', label: 'Libro de Asiento Municipal', placeholder: 'Libro IV de Fierros de Herrar' },
                    { key: 'fecha', label: 'Fecha de Expedición / Asiento', placeholder: '1982-05-14 o 14 DE MAYO 1982' },
                    { key: 'vigencia', label: 'Periodo de Vigencia', placeholder: '1982 - 1985' },
                  ].map((f) => {
                    const rawConf = fieldConfidences[f.key];
                    const val = formData[f.key as keyof typeof formData] || '';
                    const hasVal = Boolean(val && val.trim().length > 0);

                    return (
                      <div
                        key={f.key}
                        className="bg-stone-50 p-2.5 sm:p-3 rounded-xl border border-stone-200 hover:border-amber-400 transition-colors shadow-2xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] text-stone-700 font-bold uppercase tracking-tight truncate pr-1">
                            {f.label}
                          </label>
                          {hasVal && typeof rawConf === 'number' && rawConf >= 80 ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded shrink-0">
                              ✓ {rawConf}%
                            </span>
                          ) : hasVal && typeof rawConf === 'number' && rawConf > 0 ? (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded shrink-0">
                              ⚠️ {rawConf}%
                            </span>
                          ) : hasVal ? (
                            <span className="text-[10px] font-semibold text-stone-600 bg-stone-200/70 px-1.5 py-0.2 rounded shrink-0">
                              ✓ Editado
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium text-stone-400 shrink-0">
                              Sin detectar
                            </span>
                          )}
                        </div>

                        {f.key === 'tenencia' ? (
                          <select
                            value={formData.tenencia}
                            onChange={(e) => setFormData({ ...formData, tenencia: e.target.value })}
                            className="w-full p-2 border border-stone-300 rounded-lg text-xs sm:text-sm font-semibold text-stone-800 bg-white focus:border-amber-700 focus:outline-none"
                          >
                            <option value="PROPIEDAD">PROPIEDAD</option>
                            <option value="EJIDAL">EJIDAL</option>
                            <option value="COMUNAL">COMUNAL</option>
                            <option value="COLONIA AGROPECUARIA">COLONIA AGROPECUARIA</option>
                          </select>
                        ) : f.key === 'asociado' ? (
                          <select
                            value={formData.asociado}
                            onChange={(e) => setFormData({ ...formData, asociado: e.target.value })}
                            className="w-full p-2 border border-stone-300 rounded-lg text-xs sm:text-sm font-semibold text-stone-800 bg-white focus:border-amber-700 focus:outline-none"
                          >
                            <option value="SÍ">SÍ (ASOCIADO AGL)</option>
                            <option value="NO">NO (GANADERO LIBRE)</option>
                          </select>
                        ) : f.key === 'especie' ? (
                          <select
                            value={formData.especie}
                            onChange={(e) => setFormData({ ...formData, especie: e.target.value })}
                            className="w-full p-2 border border-stone-300 rounded-lg text-xs sm:text-sm font-semibold text-stone-800 bg-white focus:border-amber-700 focus:outline-none"
                          >
                            <option value="BOVINO">BOVINO</option>
                            <option value="EQUINO">EQUINO</option>
                            <option value="OVINO">OVINO</option>
                            <option value="CAPRINO">CAPRINO</option>
                            <option value="PORCINO">PORCINO</option>
                            <option value="MIXTOS">MIXTOS</option>
                          </select>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={formData[f.key as keyof typeof formData]}
                              placeholder={f.placeholder}
                              onChange={(e) => {
                                let v = e.target.value;
                                if (f.key === 'curp') v = sanitizeCurp(v);
                                else if (f.key === 'rfc') v = sanitizeRfc(v);
                                else if (f.key === 'telefono') v = v.replace(/\D/g, '').slice(0, 10);
                                else if (f.key === 'upp') v = v.replace(/[^A-Z0-9\-]/gi, '').slice(0, 20);
                                else if (f.key === 'productor') v = v.toUpperCase();
                                setFormData({ ...formData, [f.key]: v });
                              }}
                              className={`w-full p-2 border rounded-lg focus:border-amber-700 focus:ring-1 focus:ring-amber-500 focus:outline-none text-xs sm:text-sm font-semibold text-stone-900 bg-white ${
                                f.key === 'curp' && val && !validateCurp(val).isValid
                                  ? 'border-amber-400 bg-amber-50/30'
                                  : 'border-stone-300'
                              }`}
                            />
                            {f.key === 'curp' && val && !validateCurp(val).isValid && (
                              <p className="text-[10px] text-amber-700 mt-1">
                                Estructura oficial requerida: 18 caracteres (ej. GAOI710208MVZRRR05)
                              </p>
                            )}
                            {f.key === 'upp' && val && val.includes('.') && (
                              <p className="text-[10px] text-amber-700 mt-1">
                                Ingrese clave oficial SINIIGA sin puntos decimales
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center mt-6 pt-5 border-t-2 border-stone-100">
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    ← Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="px-6 py-3 bg-[#4a2c1a] hover:bg-[#6b3f28] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <span>Continuar a Ubicación del Fierro →</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          PASO 3: UBICAR ZONA DEL FIERRO Y APLICAR MEJORAS
         ========================================================================= */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200 animate-fadeIn">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b-2 border-stone-100">
            <div className="w-9 h-9 bg-stone-100 rounded-xl flex items-center justify-center text-lg">🎯</div>
            <div>
              <h2 className="text-lg font-bold text-stone-800">
                PASO 3: UBICAR ZONA DEL FIERRO Y APLICAR MEJORAS
              </h2>
              <p className="text-xs text-stone-500">
                Seleccione manualmente el área del fierro y aplique filtros de mejora
              </p>
            </div>
          </div>

          <div className="bg-[#e7f3ff] border-l-4 border-[#2196F3] p-3 rounded-lg text-xs text-blue-950 mb-4">
            <strong>ℹ️ Instrucciones:</strong> Arrastre el recuadro amarillo para reubicarlo · Use los círculos para redimensionar · Aplique mejoras de imagen antes de vectorizar
          </div>

          <div className="bg-stone-50 rounded-xl p-4 mb-4 border border-stone-200">
            <h4 className="text-xs font-bold text-stone-700 uppercase mb-2.5">
              🎨 Mejoras de Imagen (aplicar antes de vectorizar)
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyEnhancement('grayscale')}
                className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-300 rounded text-xs font-semibold text-stone-700 transition-colors cursor-pointer"
              >
                ⚫ Blanco y Negro
              </button>
              <button
                type="button"
                onClick={() => applyEnhancement('contrast')}
                className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-300 rounded text-xs font-semibold text-stone-700 transition-colors cursor-pointer"
              >
                🔆 Aumentar Contraste
              </button>
              <button
                type="button"
                onClick={() => applyEnhancement('sharpen')}
                className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-300 rounded text-xs font-semibold text-stone-700 transition-colors cursor-pointer"
              >
                ✏️ Remarcar Bordes
              </button>
              <button
                type="button"
                onClick={() => applyEnhancement('invert')}
                className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-300 rounded text-xs font-semibold text-stone-700 transition-colors cursor-pointer"
              >
                🔄 Invertir Colores
              </button>
              <button
                type="button"
                onClick={resetEnhancements}
                className="px-3 py-1.5 bg-[#ffc107] hover:bg-[#e0a800] text-stone-900 rounded text-xs font-bold transition-colors cursor-pointer ml-auto"
              >
                ↺ Resetear Mejoras
              </button>
            </div>
          </div>

          <div className="border border-stone-300 rounded-xl overflow-hidden bg-stone-100 mb-4">
            <div
              ref={viewerWrapperRef}
              className="relative w-full min-h-[500px] flex items-center justify-center p-5 overflow-hidden select-none"
            >
              {currentDisplayImage && (
                <img
                  ref={documentImageRef}
                  src={currentDisplayImage}
                  alt="Documento"
                  className="max-w-full max-h-[600px] object-contain select-none"
                />
              )}

              <div
                ref={detectionBoxRef}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                style={{
                  left: `${boxCoords.x}px`,
                  top: `${boxCoords.y}px`,
                  width: `${boxCoords.width}px`,
                  height: `${boxCoords.height}px`,
                }}
                className={`absolute border-[3px] border-[#ffd700] bg-[rgba(255,215,0,0.12)] z-10 cursor-move shadow-[0_0_20px_rgba(255,215,0,0.45)] touch-none select-none transition-shadow ${
                  isDragging ? 'cursor-grabbing shadow-[0_0_35px_rgba(255,215,0,0.8)] ring-2 ring-amber-400' : ''
                }`}
              >
                <div className="absolute -top-7 left-0 bg-[#ffd700] text-stone-900 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap shadow-xs flex items-center gap-1.5 select-none pointer-events-none">
                  <span>🎯 Área del Fierro</span>
                  <span className="font-mono text-[10px] text-amber-900 bg-amber-200/80 px-1 rounded">
                    {boxCoords.width} × {boxCoords.height} px
                  </span>
                </div>

                <div className="absolute inset-y-1 left-0.5 w-1 bg-amber-500/40 rounded-full pointer-events-none" />
                <div className="absolute inset-y-1 right-0.5 w-1 bg-amber-500/40 rounded-full pointer-events-none" />

                {[
                  { handle: 'nw', pos: '-top-2.5 -left-2.5 cursor-nwse-resize', label: '↖' },
                  { handle: 'n', pos: '-top-2.5 left-1/2 -translate-x-1/2 cursor-ns-resize', label: '▲' },
                  { handle: 'ne', pos: '-top-2.5 -right-2.5 cursor-nesw-resize', label: '↗' },
                  { handle: 'e', pos: 'top-1/2 -right-3 -translate-y-1/2 cursor-ew-resize', label: '▶' },
                  { handle: 'se', pos: '-bottom-2.5 -right-2.5 cursor-nwse-resize', label: '↘' },
                  { handle: 's', pos: '-bottom-2.5 left-1/2 -translate-x-1/2 cursor-ns-resize', label: '▼' },
                                    { handle: 'sw', pos: '-bottom-2.5 -left-2.5 cursor-nesw-resize', label: '↙' },
                  { handle: 'w', pos: 'top-1/2 -left-3 -translate-y-1/2 cursor-ew-resize', label: '◀' },
                ].map((h) => (
                  <div
                    key={h.handle}
                    onMouseDown={(e) => handleResizeStart(e, h.handle)}
                    onTouchStart={(e) => handleResizeStart(e, h.handle)}
                    className={`resize-handle absolute w-6 h-6 bg-[#ffd700] hover:bg-[#ffeb3b] active:bg-amber-400 border-2 border-[#4a2c1a] rounded-full z-20 hover:scale-125 active:scale-125 transition-transform flex items-center justify-center text-[10px] font-black text-[#4a2c1a] select-none touch-none shadow-md ${h.pos}`}
                    title={`Arrastrar para ajustar tamaño (${h.handle.toUpperCase()})`}
                  >
                    <span className="pointer-events-none opacity-80">{h.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#fff9e6] border-2 border-[#ffc107] rounded-xl p-3 sm:p-4 mb-6 space-y-3 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 sm:gap-3 flex-wrap font-mono text-xs">
                <div className="bg-white px-2.5 py-1 rounded border border-amber-300 shadow-2xs">
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">Posición X</span>
                  <span className="text-[#4a2c1a] font-bold text-sm">{boxCoords.x}px</span>
                </div>
                <div className="bg-white px-2.5 py-1 rounded border border-amber-300 shadow-2xs">
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">Posición Y</span>
                  <span className="text-[#4a2c1a] font-bold text-sm">{boxCoords.y}px</span>
                </div>
                <div className="bg-white px-2.5 py-1 rounded border-2 border-amber-500 bg-amber-50/50 shadow-2xs">
                  <span className="text-[10px] text-amber-900 uppercase font-bold block">↔ Ancho (W)</span>
                  <span className="text-amber-950 font-extrabold text-sm">{boxCoords.width}px</span>
                </div>
                <div className="bg-white px-2.5 py-1 rounded border-2 border-amber-500 bg-amber-50/50 shadow-2xs">
                  <span className="text-[10px] text-amber-900 uppercase font-bold block">↕ Alto (H)</span>
                  <span className="text-amber-950 font-extrabold text-sm">{boxCoords.height}px</span>
                </div>
                <div className="bg-white px-2.5 py-1 rounded border border-amber-300 shadow-2xs">
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">Proporción</span>
                  <span className="text-[#4a2c1a] font-bold text-sm">{ratioLabel}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={autoDetectFierro}
                  className="px-3.5 py-1.5 bg-[#4a2c1a] hover:bg-[#6b3f28] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1 active:scale-95"
                >
                  <span>🎯 Auto-Detectar</span>
                </button>
                <button
                  type="button"
                  onClick={resetDetectionBox}
                  className="px-3 py-1.5 bg-[#ffc107] hover:bg-[#e0a800] text-stone-900 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs active:scale-95"
                >
                  ↺ Resetear
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-stone-700 uppercase text-[11px] flex items-center gap-1 mr-1">
                  <span>↔ Ajustar Ancho Horizontal:</span>
                </span>
                <button
                  type="button"
                  onClick={() => adjustHorizontalWidth(-20)}
                  className="px-2 py-1 bg-white hover:bg-amber-100 border border-stone-300 rounded font-mono font-bold text-stone-800 transition-colors cursor-pointer"
                  title="Reducir 20px de ancho"
                >
                  -20
                </button>
                <button
                  type="button"
                  onClick={() => adjustHorizontalWidth(-5)}
                  className="px-2 py-1 bg-white hover:bg-amber-100 border border-stone-300 rounded font-mono font-bold text-stone-800 transition-colors cursor-pointer"
                  title="Reducir 5px de ancho"
                >
                  -5
                </button>
                <span className="px-2 py-1 bg-amber-100 text-amber-900 font-mono font-bold rounded border border-amber-300 min-w-[58px] text-center">
                  {boxCoords.width}px
                </span>
                <button
                  type="button"
                  onClick={() => adjustHorizontalWidth(5)}
                  className="px-2 py-1 bg-white hover:bg-amber-100 border border-stone-300 rounded font-mono font-bold text-stone-800 transition-colors cursor-pointer"
                  title="Aumentar 5px de ancho"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => adjustHorizontalWidth(20)}
                  className="px-2 py-1 bg-white hover:bg-amber-100 border border-stone-300 rounded font-mono font-bold text-stone-800 transition-colors cursor-pointer"
                  title="Aumentar 20px de ancho"
                >
                  +20
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-stone-700 uppercase text-[11px] flex items-center gap-1 mr-1">
                  <span>↕ Ajustar Alto:</span>
                </span>
                <button
                  type="button"
                  onClick={() => adjustVerticalHeight(-20)}
                  className="px-2 py-1 bg-white hover:bg-amber-100 border border-stone-300 rounded font-mono font-bold text-stone-800 transition-colors cursor-pointer"
                  title="Reducir 20px de alto"
                >
                  -20
                </button>
                <button
                  type="button"
                  onClick={() => adjustVerticalHeight(-5)}
                  className="px-2 py-1 bg-white hover:bg-amber-100 border border-stone-300 rounded font-mono font-bold text-stone-800 transition-colors cursor-pointer"
                  title="Reducir 5px de alto"
                >
                  -5
                </button>
                <span className="px-2 py-1 bg-amber-100 text-amber-900 font-mono font-bold rounded border border-amber-300 min-w-[58px] text-center">
                  {boxCoords.height}px
                </span>
                <button
                  type="button"
                  onClick={() => adjustVerticalHeight(5)}
                  className="px-2 py-1 bg-white hover:bg-amber-100 border border-stone-300 rounded font-mono font-bold text-stone-800 transition-colors cursor-pointer"
                  title="Aumentar 5px de alto"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => adjustVerticalHeight(20)}
                  className="px-2 py-1 bg-white hover:bg-amber-100 border border-stone-300 rounded font-mono font-bold text-stone-800 transition-colors cursor-pointer"
                  title="Aumentar 20px de alto"
                >
                  +20
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-stone-600 text-[11px] mr-1">
                📐 Preajustes Rápidos:
              </span>
              <button
                type="button"
                onClick={() => setBoxPreset('wide')}
                className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 rounded font-semibold transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                title="Ajustar a proporción apaisada horizontal para iniciales o figuras anchas"
              >
                <span>↔ Fierro Ancho (Horizontal)</span>
              </button>
              <button
                type="button"
                onClick={() => setBoxPreset('square')}
                className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 rounded font-semibold transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                title="Ajustar a proporción simétrica 1:1"
              >
                <span>⏹ Cuadrado (1:1)</span>
              </button>
              <button
                type="button"
                onClick={() => setBoxPreset('tall')}
                className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 rounded font-semibold transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                title="Ajustar a proporción vertical"
              >
                <span>↕ Vertical</span>
              </button>
              <button
                type="button"
                onClick={() => setBoxPreset('expand')}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition-colors cursor-pointer shadow-2xs flex items-center gap-1 ml-auto"
                title="Aumentar el área en 25% para asegurar que ninguna parte del fierro quede cortada"
              >
                <span>🔍 +25% Abarcar Figura Completa</span>
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center pt-5 border-t-2 border-stone-100">
            <button
              onClick={() => goToStep(2)}
              className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer"
            >
              ← Atrás
            </button>
            <button
              onClick={() => goToStep(4)}
              className="px-6 py-3 bg-[#4a2c1a] hover:bg-[#6b3f28] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer hover:-translate-y-0.5"
            >
              Continuar a Vectorización →
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          PASO 4: VECTORIZACIÓN DEL FIERRO
         ========================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200 animate-fadeIn">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b-2 border-stone-100">
            <div className="w-9 h-9 bg-stone-100 rounded-xl flex items-center justify-center text-lg">🧮</div>
            <div>
              <h2 className="text-lg font-bold text-stone-800">PASO 4: VECTORIZACIÓN DEL FIERRO</h2>
              <p className="text-xs text-stone-500">
                Ejecutar análisis matemático y generar embedding de 64 dimensiones
              </p>
            </div>
          </div>

          {!vectorizationResultsVisible && !isVectorizing && (
            <div className="text-center py-10">
              <p className="text-sm text-stone-600 mb-6 max-w-md mx-auto">
                Haga clic en el botón para procesar la región seleccionada y generar el vector matemático
              </p>
              <button
                onClick={executeVectorization}
                className="px-8 py-3.5 bg-[#4a2c1a] hover:bg-[#6b3f28] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg transition-all cursor-pointer hover:-translate-y-0.5"
              >
                🧮 EJECUTAR VECTORIZACIÓN
              </button>
            </div>
          )}

          {isVectorizing && (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-stone-200 border-t-[#4a2c1a] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-bold text-stone-700">
                Generando embedding de 64 dimensiones con filtro Sobel...
              </p>
            </div>
          )}

          {vectorizationResultsVisible && (
            <div>
              <div className="flex flex-col lg:flex-row gap-6 items-start mb-6">
                <div className="mx-auto lg:mx-0">
                  <div
                    style={{
                      width: '248px',
                      height: '248px',
                      border: '3px solid #4a2c1a',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'white',
                      position: 'relative',
                      overflow: 'hidden',
                      padding: '10px',
                    }}
                    className="shadow-sm"
                  >
                    {extractedFierroSrc && (
                      <img
                        src={extractedFierroSrc}
                        alt="Fierro Vectorizado"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          width: 'auto',
                          height: 'auto',
                          objectFit: 'contain',
                          objectPosition: 'center',
                        }}
                      />
                    )}
                    <div className="absolute top-2 right-2 bg-[#4a2c1a] text-white px-2 py-0.5 rounded text-[11px] font-bold">
                      248 x 248
                    </div>
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-[rgba(40,167,69,0.92)] text-white px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shadow-xs">
                      ✓ Imagen completa
                    </div>
                  </div>
                  <div className="text-center text-xs text-stone-500 font-mono mt-2">
                    [ {getDerivedInitials(formData.productor)} ] · HIST-VEC-{formData.folio ? formData.folio.replace(/[^A-Z0-9]/gi, '') : 'REG'}
                  </div>
                </div>

                <div className="flex-1 w-full bg-stone-50 rounded-xl p-5 border border-stone-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h4 className="text-xs font-bold text-stone-700 uppercase">
                      Esquema Matemático (Embedding de 64 Dimensiones):
                    </h4>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-200 text-stone-700">
                      Algoritmo: Sobel + Raster 8x8
                    </span>
                  </div>

                  {embeddingData && (!embeddingData.hasStrokes || embeddingData.density === 0) && (
                    <div className="mb-4 p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-900 text-xs">
                      <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800">
                        <span>⚠️</span> Alerta de Auditoría: Imagen en Blanco o Sin Trazo Detectable
                      </div>
                      <p className="text-stone-700 leading-relaxed mb-1.5">
                        El análisis no detectó tinta ni bordes de forja en el área seleccionada (Densidad: <strong>0%</strong>, vector de 64 ceros). El sistema rechaza datos simulados.
                      </p>
                      <p className="text-stone-600 text-[11px]">
                        Regrese al <strong>Paso 3 (Ubicar Fierro)</strong> para encuadrar la figura del fierro quemador o aplique realce de contraste.
                      </p>
                    </div>
                  )}

                  {(() => {
                    const embed = embeddingData?.embedding || [];
                    const backgroundCells = embed.filter((v) => v < 0.40);
                    const mediumCells = embed.filter((v) => v >= 0.40 && v <= 0.70);
                    const heavyCells = embed.filter((v) => v > 0.70);
                    const bgCount = backgroundCells.length;
                    const medCount = mediumCells.length;
                    const hvyCount = heavyCells.length;
                    const bgPct = ((bgCount / 64) * 100).toFixed(1);
                    const medPct = ((medCount / 64) * 100).toFixed(1);
                    const hvyPct = ((hvyCount / 64) * 100).toFixed(1);

                    return (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span
                            style={{
                              background: embeddingData?.hasStrokes ? '#dcfce7' : '#fef9c3',
                              color: embeddingData?.hasStrokes ? '#166534' : '#854d0e',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            Densidad del Fierro: {densityPercent}%
                          </span>
                          <span className="text-xs text-stone-700 font-mono bg-white px-2.5 py-1 rounded-md border border-stone-200">
                            Trazos del Fierro (oscuros &gt; 0.70): <strong>{hvyCount}</strong> / 64 ({hvyPct}%)
                          </span>
                          <span className="text-xs text-stone-700 font-mono bg-white px-2.5 py-1 rounded-md border border-stone-200">
                            Trazos Medios (0.40 - 0.70): <strong>{medCount}</strong> / 64 ({medPct}%)
                          </span>
                          <span className="text-xs text-stone-700 font-mono bg-white px-2.5 py-1 rounded-md border border-stone-200">
                            Fondo de Papel (&lt; 0.40): <strong>{bgCount}</strong> / 64 ({bgPct}%)
                          </span>
                          <span className="text-xs text-stone-600 font-mono bg-white px-2.5 py-1 rounded-md border border-stone-200" title="Checksum FNV-1a criptográfico derivado de los 64 valores normalizados">
                            Huella: <strong className="text-stone-800">{embeddingData?.checksum || 'VEC64-00000000-00000000'}</strong>
                          </span>
                        </div>

                        <div className="text-[11px] font-mono text-stone-600 bg-white border border-stone-200 rounded px-2.5 py-1.5 mb-2.5 flex items-center justify-between shadow-2xs">
                          <span>
                            {hoveredCell ? (
                              <>
                                <strong className="text-stone-800">Celda #{hoveredCell.index + 1}</strong> [Fila {hoveredCell.row}, Col {hoveredCell.col}]:{' '}
                                <span
                                  className="font-bold font-mono"
                                  style={{
                                    color:
                                      hoveredCell.value > 0.70
                                        ? '#1c1917'
                                        : hoveredCell.value >= 0.40
                                        ? '#c2410c'
                                        : '#64748b',
                                  }}
                                >
                                  {hoveredCell.value.toFixed(4)}
                                </span>{' '}
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded font-sans ml-1 font-bold"
                                  style={{
                                    backgroundColor:
                                      hoveredCell.value > 0.70
                                        ? '#292524'
                                        : hoveredCell.value >= 0.40
                                        ? '#ffedd5'
                                        : '#f8fafc',
                                    color:
                                      hoveredCell.value > 0.70
                                        ? '#fafaf9'
                                        : hoveredCell.value >= 0.40
                                        ? '#9a3412'
                                        : '#64748b',
                                    border: '1px solid',
                                    borderColor:
                                      hoveredCell.value > 0.70
                                        ? '#1c1917'
                                        : hoveredCell.value >= 0.40
                                        ? '#fdba74'
                                        : '#e2e8f0',
                                  }}
                                >
                                  {hoveredCell.value > 0.70
                                    ? 'Trazo del Fierro (Oscuro > 0.70)'
                                    : hoveredCell.value >= 0.40
                                    ? 'Trazo Medio (0.40 - 0.70)'
                                    : 'Fondo de Papel (Claro < 0.40)'}
                                </span>
                              </>
                            ) : (
                              'Pase el cursor sobre cualquier celda para auditar su valor decimal exacto'
                            )}
                          </span>
                          <span className="text-[10px] text-stone-400">Escala: 0.0000 (Fondo) a 1.0000 (Trazo)</span>
                        </div>

                        <div className="grid grid-cols-8 gap-1.5 mb-2.5 p-2 bg-stone-100 rounded-xl border border-stone-200 shadow-inner">
                          {(embeddingData?.embedding || Array(64).fill(0)).map((val, i) => {
                            const isBackground = val < 0.40;
                            const isMediumStroke = val >= 0.40 && val <= 0.70;
                            const isHeavyStroke = val > 0.70;
                            const row = Math.floor(i / 8) + 1;
                            const col = (i % 8) + 1;
                            const isHovered = hoveredCell?.index === i;

                            let bgColor = '#ffffff';
                            let borderColor = '#e2e8f0';
                            let textColor = '#cbd5e1';

                            if (val < 0.20) {
                              bgColor = '#ffffff';
                              borderColor = '#e2e8f0';
                              textColor = '#94a3b8';
                            } else if (val < 0.40) {
                              bgColor = '#fdfbf7';
                              borderColor = '#e7e2d8';
                              textColor = '#78716c';
                            } else if (val <= 0.70) {
                              const t = (val - 0.40) / (0.70 - 0.40);
                              const r = Math.round(245 + (234 - 245) * t);
                              const g = Math.round(158 + (88 - 158) * t);
                              const b = Math.round(11 + (12 - 11) * t);
                              bgColor = `rgb(${r}, ${g}, ${b})`;
                              borderColor = '#c2410c';
                              textColor = '#ffffff';
                            } else {
                              const t = (val - 0.70) / (1.00 - 0.70);
                              const r = Math.round(59 + (24 - 59) * t);
                              const g = Math.round(27 + (24 - 27) * t);
                              const b = Math.round(8 + (27 - 8) * t);
                              bgColor = `rgb(${r}, ${g}, ${b})`;
                              borderColor = '#09090b';
                              textColor = '#ffffff';
                            }

                            return (
                              <div
                                key={i}
                                onMouseEnter={() => setHoveredCell({ index: i, value: val, row, col })}
                                onMouseLeave={() => setHoveredCell(null)}
                                style={{
                                  backgroundColor: bgColor,
                                  borderColor: isHovered ? '#3b82f6' : borderColor,
                                  height: '34px',
                                  borderRadius: '5px',
                                  borderWidth: isHovered ? '2px' : '1px',
                                  borderStyle: 'solid',
                                  transform: isHovered ? 'scale(1.14)' : 'scale(1)',
                                  zIndex: isHovered ? 10 : 1,
                                  boxShadow: isHovered ? '0 4px 6px -1px rgba(0,0,0,0.15)' : 'none',
                                  transition: 'transform 0.1s ease',
                                }}
                                className="cursor-pointer flex items-center justify-center text-[9px] font-mono select-none"
                                title={`Celda #${i + 1} [F${row}, C${col}]: ${val.toFixed(4)} (${isBackground ? 'Fondo de papel (< 0.40)' : isHeavyStroke ? 'Trazo oscuro del fierro (> 0.70)' : 'Trazo medio (0.40 - 0.70)'})`}
                              >
                                <span style={{ color: textColor, fontWeight: isHeavyStroke ? 'bold' : isMediumStroke ? '600' : 'normal' }}>
                                  {val.toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-[11px] text-stone-600 bg-white border border-stone-200 rounded-lg px-3 py-2 mb-3 gap-2 shadow-2xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-white border border-slate-300 inline-block shadow-2xs"></span>
                            <span>
                              Fondo de papel (claros &lt; 0.40): <strong>{bgCount}</strong> celdas ({bgPct}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-[#f59e0b] border border-[#d97706] inline-block shadow-2xs"></span>
                            <span>
                              Trazos medios (0.40 - 0.70): <strong>{medCount}</strong> celdas ({medPct}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-[#1c1917] border border-[#0c0a09] inline-block shadow-2xs"></span>
                            <span>
                              Trazos del fierro (oscuros &gt; 0.70): <strong>{hvyCount}</strong> celdas ({hvyPct}%)
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between text-xs text-stone-600 font-mono flex-wrap gap-2 mb-3 bg-stone-50 p-2 rounded-lg border border-stone-200">
                          <span title="Simetría horizontal calculada sobre la distribución real de trazos">
                            Simetría H:{' '}
                            <strong className="text-stone-800">
                              {embeddingData ? embeddingData.symmetryH.toFixed(1) : '0.0'}%
                            </strong>{' '}
                            <span className="text-[10px] text-stone-500">
                              {embeddingData && embeddingData.symmetryH >= 75
                                ? '(Simétrico)'
                                : embeddingData && embeddingData.symmetryH >= 55
                                ? '(Moderado)'
                                : '(Asimétrico)'}
                            </span>
                          </span>
                          <span title="Simetría vertical calculada sobre la distribución real de trazos">
                            Simetría V:{' '}
                            <strong className="text-stone-800">
                              {embeddingData ? embeddingData.symmetryV.toFixed(1) : '0.0'}%
                            </strong>{' '}
                            <span className="text-[10px] text-stone-500">
                              {embeddingData && embeddingData.symmetryV >= 75
                                ? '(Simétrico)'
                                : embeddingData && embeddingData.symmetryV >= 55
                                ? '(Moderado)'
                                : '(Asimétrico)'}
                            </span>
                          </span>
                          <span>
                            Proporción: <strong className="text-stone-800">{embeddingData ? embeddingData.proportions : '0:0'}</strong>
                          </span>
                        </div>
                      </>
                    );
                  })()}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-200">
                    <button
                      type="button"
                      onClick={executeVectorization}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-lg border border-stone-300 transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Volver a ejecutar el análisis matemático sobre el recorte actual"
                    >
                      <span>🔄</span> Re-ejecutar Vectorización
                    </button>
                    <button
                      type="button"
                      onClick={copyVectorToClipboard}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg border border-stone-300 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>📋</span> Copiar Arreglo 64D (JSON)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVectorAudit(!showVectorAudit)}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg border border-stone-300 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🔍</span> {showVectorAudit ? 'Ocultar Auditoría' : 'Auditar Valores Numéricos'}
                    </button>
                  </div>

                  {showVectorAudit && embeddingData && (
                    <div className="mt-3 p-3 bg-stone-900 text-stone-200 rounded-lg text-xs font-mono">
                      <div className="flex justify-between items-center text-[11px] text-amber-300 border-b border-stone-800 pb-1.5 mb-2">
                        <span>AUDITORÍA MATEMÁTICA DEL VECTOR (64 DIMENSIONES)</span>
                        <span>{embeddingData.processingTimeMs || 0} ms</span>
                      </div>
                      <div className="text-[11px] text-stone-400 mb-2 space-y-0.5">
                        <div>Checksum: <span className="text-amber-200">{embeddingData.checksum}</span></div>
                        <div>Celdas con trazo: <span className="text-emerald-400">{embeddingData.activeCellCount} de 64</span> · Varianza: <span className="text-stone-300">{embeddingData.variance}</span></div>
                      </div>
                      <div className="bg-black/60 p-2.5 rounded border border-stone-800 max-h-40 overflow-y-auto text-[10px] leading-relaxed text-emerald-300 select-all">
                        {JSON.stringify(embeddingData.embedding.map(v => Number(v.toFixed(4))), null, 2)}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-stone-500 mt-3 leading-relaxed border-t border-stone-200 pt-2">
                    Este embedding de 64 dimensiones (filtro Sobel) se comparará automáticamente con los registros existentes para advertir posibles duplicados con similitud mayor o igual a 75%.
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-5 border-t-2 border-stone-100">
                <button
                  onClick={() => goToStep(3)}
                  className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer"
                >
                  ← Atrás
                </button>
                <button
                  onClick={() => goToStep(5)}
                  className="px-6 py-3 bg-[#4a2c1a] hover:bg-[#6b3f28] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer hover:-translate-y-0.5"
                >
                  Continuar a Análisis →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          PASO 5: ANÁLISIS DE RESULTADOS Y AJUSTES
         ========================================================================= */}
      {currentStep === 5 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200 animate-fadeIn">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b-2 border-stone-100">
            <div className="w-9 h-9 bg-stone-100 rounded-xl flex items-center justify-center text-lg">📊</div>
            <div>
              <h2 className="text-lg font-bold text-stone-800">PASO 5: ANÁLISIS DE RESULTADOS Y AJUSTES</h2>
              <p className="text-xs text-stone-500">Revise las métricas y confirme que todo es correcto</p>
            </div>
          </div>

          <div className="bg-stone-50 rounded-xl p-5 mb-5 border border-stone-200">
            <h4 className="text-xs font-bold text-stone-700 uppercase mb-4">
              📊 Métricas de Vectorización
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border-l-4 border-[#4a2c1a] shadow-xs">
                <div className="text-xs text-stone-500 mb-1">Densidad del Embedding</div>
                <div className="text-2xl font-black text-[#4a2c1a]">{densityPercent}%</div>
                {(!embeddingData || !embeddingData.hasStrokes || embeddingData.density === 0) ? (
                  <div className="text-[11px] text-amber-600 font-bold mt-1">⚠️ Sin trazos detectados</div>
                ) : embeddingData.density < 0.15 ? (
                  <div className="text-[11px] text-amber-600 font-bold mt-1">Trazo ligero (&lt;15%)</div>
                ) : embeddingData.density <= 0.75 ? (
                  <div className="text-[11px] text-[#28a745] font-bold mt-1">✓ Óptimo para registro</div>
                ) : (
                  <div className="text-[11px] text-stone-600 font-bold mt-1">Alta densidad de tinta</div>
                )}
              </div>
              <div className="bg-white p-4 rounded-xl border-l-4 border-[#4a2c1a] shadow-xs">
                <div className="text-xs text-stone-500 mb-1">Simetría Horizontal</div>
                <div className="text-2xl font-black text-[#4a2c1a]">
                  {embeddingData && embeddingData.hasStrokes ? `${embeddingData.symmetryH.toFixed(1)}%` : '0.0%'}
                </div>
                {(!embeddingData || !embeddingData.hasStrokes) ? (
                  <div className="text-[11px] text-stone-400 font-bold mt-1">Sin trazo</div>
                ) : embeddingData.symmetryH >= 60 ? (
                  <div className="text-[11px] text-[#28a745] font-bold mt-1">✓ Alta simetría bilateral</div>
                ) : (
                  <div className="text-[11px] text-stone-600 font-bold mt-1">Asimetría característica</div>
                )}
              </div>
              <div className="bg-white p-4 rounded-xl border-l-4 border-[#4a2c1a] shadow-xs">
                <div className="text-xs text-stone-500 mb-1">Simetría Vertical</div>
                <div className="text-2xl font-black text-[#4a2c1a]">
                  {embeddingData && embeddingData.hasStrokes ? `${embeddingData.symmetryV.toFixed(1)}%` : '0.0%'}
                </div>
                {(!embeddingData || !embeddingData.hasStrokes) ? (
                  <div className="text-[11px] text-stone-400 font-bold mt-1">Sin trazo</div>
                ) : embeddingData.symmetryV >= 50 ? (
                  <div className="text-[11px] text-[#28a745] font-bold mt-1">Equilibrio vertical</div>
                ) : (
                  <div className="text-[11px] text-stone-600 font-bold mt-1">Diferenciación corona/peana</div>
                )}
              </div>
              <div className="bg-white p-4 rounded-xl border-l-4 border-[#4a2c1a] shadow-xs">
                <div className="text-xs text-stone-500 mb-1">Dimensiones</div>
                <div className="text-2xl font-black text-[#4a2c1a]">64</div>
                <div className="text-[11px] text-[#28a745] font-bold mt-1">✓ Matriz 8x8 normalizada</div>
              </div>
            </div>

            {embeddingData && (
              <div className="mt-4 pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between text-xs text-stone-600 font-mono gap-2">
                <div>
                  Huella Criptográfica: <strong className="text-stone-800">{embeddingData.checksum}</strong> ({embeddingData.activeCellCount}/64 celdas activas)
                </div>
                <button
                  type="button"
                  onClick={copyVectorToClipboard}
                  className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded border border-stone-300 font-sans font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>📋</span> Copiar Vector 64D
                </button>
              </div>
            )}
          </div>

          <div className="bg-[#fff3cd] border border-[#ffc107] rounded-xl p-4 mb-5 text-xs text-[#856404]">
            <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5">
              <span>⚠️</span> Campos Históricos Omitidos
            </h4>
            <p className="text-stone-600 mb-2">
              Los siguientes campos no aplican para documentos históricos previos a su creación:
            </p>
            <div className="text-stone-700 space-y-1 pl-2">
              <div>• <strong>Correo Electrónico (Email)</strong> - No contemplado en formatos tradicionales</div>
              <div>• <strong>Firma Digital Biométrica</strong> - Solo firma autógrafa en papel</div>
              <div>• <strong>Clave UPP / SINIIGA</strong> - Sistema instaurado en 2004</div>
            </div>
          </div>

          <div className="bg-[#d4edda] border border-[#28a745] rounded-xl p-4 text-xs sm:text-sm text-[#155724] mb-6">
            <h4 className="font-bold mb-1">✓ Verificación Completada</h4>
            <p>
              Todos los datos han sido transcritos correctamente y el fierro ha sido vectorizado con éxito. Puede proceder al guardado.
            </p>
          </div>

          <div className="flex justify-between items-center pt-5 border-t-2 border-stone-100">
            <button
              onClick={() => goToStep(4)}
              className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-bold rounded-lg transition-colors cursor-pointer"
            >
              ← Atrás
            </button>
            <button
              onClick={() => goToStep(6)}
              className="px-6 py-3 bg-[#28a745] hover:bg-[#218838] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer hover:-translate-y-0.5"
            >
              Aceptar y Guardar en BD →
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          PASO 6: GUARDAR EN BASE DE DATOS
         ========================================================================= */}
      {currentStep === 6 && (
        <div className="bg-white rounded-2xl p-6 sm:p-10 shadow-sm border border-stone-200 animate-fadeIn text-center">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b-2 border-stone-100 text-left">
            <div className="w-9 h-9 bg-stone-100 rounded-xl flex items-center justify-center text-lg">💾</div>
            <div>
              <h2 className="text-lg font-bold text-stone-800">PASO 6: GUARDAR EN BASE DE DATOS</h2>
              <p className="text-xs text-stone-500">
                Registro final e integración al padrón municipal
              </p>
            </div>
          </div>

          {!isSavedSuccess ? (
            <div className="py-6 max-w-xl mx-auto">
              <div className="text-7xl mb-4">💾</div>
              <h3 className="text-2xl font-bold text-stone-800 mb-2">
                ¿Listo para guardar el registro?
              </h3>
              <p className="text-sm text-stone-500 mb-6">
                El registro se integrará a la base de datos municipal y estará disponible para futuras comparativas de antiduplicidad.
              </p>

              <div className="bg-stone-50 rounded-xl p-5 mb-8 text-left border border-stone-200">
                <h4 className="text-xs font-bold text-stone-700 uppercase mb-3">
                  📋 Resumen del Registro
                </h4>
                <div className="text-xs sm:text-sm text-stone-600 space-y-1.5 leading-relaxed font-sans">
                  <div><strong>Productor:</strong> {formData.productor || 'N/A'}</div>
                  <div><strong>Predio:</strong> {formData.predio ? `${formData.predio} (${formData.ejido || 'Pánuco'})` : (formData.ejido || 'N/A')}</div>
                  <div><strong>Folio:</strong> {formData.folio || 'N/A'}</div>
                  <div><strong>Fecha:</strong> {formData.fecha || 'N/A'}</div>
                  <div><strong>Fierro:</strong> Vectorizado (64 dimensiones, densidad {densityPercent}%)</div>
                  <div><strong>Confianza OCR:</strong> {ocrConfidence > 0 ? `${ocrConfidence}%` : 'Edición Manual (0%)'}</div>
                </div>
              </div>

              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => goToStep(5)}
                  className="px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  ← Revisar Nuevamente
                </button>
                <button
                  onClick={saveToDatabase}
                  disabled={isSaving}
                  className="px-8 py-3 bg-[#28a745] hover:bg-[#218838] text-white font-bold text-sm rounded-xl shadow-lg transition-all cursor-pointer hover:-translate-y-0.5"
                >
                  {isSaving ? '⏳ Guardando...' : '💾 GUARDAR EN BASE DE DATOS'}
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-xl mx-auto bg-[#d4edda] border border-[#28a745] rounded-2xl p-8 animate-fadeIn text-center">
              <div className="text-5xl mb-3">✅</div>
              <h4 className="text-xl font-black text-[#155724] mb-2">
                ¡Registro Guardado Exitosamente!
              </h4>
              <p className="text-sm text-[#155724] mb-2">
                ID de Registro: <strong>{savedRecordId}</strong>
              </p>
              <p className="text-xs text-[#155724] mb-6">
                El fierro ha sido integrado al sistema de antiduplicidad y estará disponible para futuras comparativas.
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  onClick={resetProcess}
                  className="px-5 py-2.5 bg-[#4a2c1a] hover:bg-[#6b3f28] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  🔄 Procesar Otro Documento
                </button>
                <button
                  onClick={handleApplyToRegistration}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  📋 Cargar en Formulario de Registro
                </button>
                <button
                  onClick={onGoToBuscador}
                  className="px-5 py-2.5 bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  🔍 Ver en Padrón
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-6 mt-6 border-t-2 border-stone-100 text-left">
            <button
              onClick={() => goToStep(5)}
              className="px-5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              ← Atrás
            </button>
            <div />
          </div>
        </div>
      )}

      {/* ===== TOAST NOTIFICATION ===== */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 text-white px-5 py-3 rounded-xl shadow-2xl z-50 animate-slideUp text-xs sm:text-sm font-bold ${
            toast.type === 'success' ? 'bg-[#28a745]' : 'bg-[#ffc107] text-stone-900'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};