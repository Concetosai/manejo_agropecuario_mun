import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { ProducerData, BrandConfig, MunicipalConfig } from '../types';

export interface GeneratePdfOptions {
  selection: 'both' | 'certificate' | 'id_card';
  certificateElement: HTMLElement | null;
  cardElement: HTMLElement | null;
  producerData: ProducerData;
  brandConfig: BrandConfig;
  municipalConfig: MunicipalConfig;
  formatType?: 'traditional' | 'modern';
  onProgress?: (status: string) => void;
  // FIX_PDF_BLOB: si es true, no descarga el PDF, solo devuelve el blob
  noDescargar?: boolean;
}

export interface PdfGenerationResult {
  success: boolean;
  filename?: string;
  error?: string;
  securityHash?: string;
  // FIX_PDF_BLOB: blob del PDF para subir a Cloudinary
  blob?: Blob;
  // FIX_PDF_BLOB: URL del PDF en Cloudinary (si se subio)
  cloudinaryUrl?: string;
}

/**
 * Generates a pseudo-cryptographic document security hash for anti-tamper verification.
 */
export function generateDocumentSecurityHash(producerData: ProducerData, issueDate: string): string {
  const seedString = `${producerData.folio}|${producerData.curp}|${producerData.uppKey}|${producerData.registrationNumber}|${issueDate}|PANUCO-VER-HAYTO-2026`;
  let hash1 = 0x811c9dc5;
  let hash2 = 0x5a179b3c;
  for (let i = 0; i < seedString.length; i++) {
    const ch = seedString.charCodeAt(i);
    hash1 ^= ch;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 ^= ch + (i * 31);
    hash2 = Math.imul(hash2, 0x01000193);
  }
  const h1 = (hash1 >>> 0).toString(16).padStart(8, '0').toUpperCase();
  const h2 = (hash2 >>> 0).toString(16).padStart(8, '0').toUpperCase();
  const h3 = ((hash1 ^ hash2) >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return `SEC-PAN-${h1}-${h2}-${h3}`;
}

/**
 * Captures an HTML element and adds it to a jsPDF instance.
 */
async function captureElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  return await html2canvas(element, {
    scale: 2.5, // High DPI (300 DPI equivalent) for razor-sharp text and borders
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
    imageTimeout: 15000,
    onclone: (clonedDoc) => {
      // Ensure elements marked with no-print or print-only behave as on paper
      const noPrintElements = clonedDoc.querySelectorAll('.no-print');
      noPrintElements.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
      const printOnlyElements = clonedDoc.querySelectorAll('.print-only');
      printOnlyElements.forEach((el) => {
        (el as HTMLElement).style.display = 'block';
      });
    },
  });
}

/**
 * Generates an official, secure PDF file of the municipal livestock certificate and/or ID card.
 */
export async function generateSecureCertificatePdf(
  options: GeneratePdfOptions
): Promise<PdfGenerationResult> {
  const {
    selection,
    certificateElement,
    cardElement,
    producerData,
    onProgress,
  } = options;

  try {
    onProgress?.('Preparando formato oficial y sellos criptográficos...');

    const cleanName = (producerData.fullName || 'PRODUCTOR')
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_')
      .slice(0, 35);
    const folioStr = (producerData.folio || 'PAN-2026-00000').replace(/[^a-zA-Z0-9-]/g, '_');
    const isTraditional = options.formatType === 'traditional';
    const docTypeLabel = isTraditional
      ? 'FICHA_REGISTRO_TRADICIONAL'
      : selection === 'both'
      ? 'EXPEDIENTE_COMPLETO'
      : selection === 'certificate'
      ? 'TITULO'
      : 'CREDENCIAL';
    const filename = `${docTypeLabel}_OFICIAL_${folioStr}_${cleanName}.pdf`;

    const securityHash = generateDocumentSecurityHash(producerData, producerData.issueDate || new Date().toISOString());

    // Create jsPDF in portrait, letter size (215.9 x 279.4 mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
      compress: true,
    });

    // Set PDF Security Metadata
    pdf.setProperties({
      title: isTraditional
        ? `Ficha de Registro de Fierro Quemador para Ganado - ${producerData.fullName}`
        : `Título y Registro de Marca de Fuego - ${producerData.fullName} (Folio: ${producerData.folio})`,
      subject: `Secretaría de Desarrollo Agropecuario y Pesquero de Pánuco, Ver. - Folio: ${producerData.folio} - UPP: ${producerData.uppKey}`,
      author: 'H. Ayuntamiento Constitucional de Pánuco, Ver. - Dirección de Fomento Agropecuario',
      keywords: `Pánuco, Ganadería, Veracruz, Fierro Quemador, Registro Pecuario, SINIIGA, ${securityHash}`,
      creator: 'Sistema Oficial de Registro Ganadero Municipal de Pánuco',
    });

    let pagesAdded = 0;

    // PAGE 1: TÍTULO OFICIAL EN TAMAÑO CARTA
    if ((selection === 'both' || selection === 'certificate') && certificateElement) {
      onProgress?.('Procesando Título Oficial de Propiedad en alta resolución...');
      const canvasCert = await captureElementToCanvas(certificateElement);
      const imgData = canvasCert.toDataURL('image/jpeg', 0.95);

      const pageWidth = 215.9; // letter width in mm
      const pageHeight = 279.4; // letter height in mm
      const margin = 5; // 5 mm margin
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;

      // Fit inside printable area maintaining aspect ratio
      const imgAspect = canvasCert.width / canvasCert.height;
      let renderWidth = printableWidth;
      let renderHeight = printableWidth / imgAspect;

      if (renderHeight > printableHeight) {
        renderHeight = printableHeight;
        renderWidth = printableHeight * imgAspect;
      }

      const xPos = margin + (printableWidth - renderWidth) / 2;
      const yPos = margin + (printableHeight - renderHeight) / 2;

      pdf.addImage(imgData, 'JPEG', xPos, yPos, renderWidth, renderHeight, undefined, 'FAST');
      pagesAdded++;
    }

    // PAGE 2: CREDENCIAL GANADERA OFICIAL (CR-80)
    if ((selection === 'both' || selection === 'id_card') && cardElement) {
      onProgress?.('Procesando Credencial Ganadera de Bolsillo (CR-80)...');

      if (pagesAdded > 0) {
        pdf.addPage('letter', 'portrait');
      }

      const canvasCard = await captureElementToCanvas(cardElement);
      const imgCardData = canvasCard.toDataURL('image/jpeg', 0.95);

      const pageWidth = 215.9;
      const pageHeight = 279.4;
      const margin = 10;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;

      const imgAspect = canvasCard.width / canvasCard.height;
      let renderWidth = Math.min(printableWidth, 190);
      let renderHeight = renderWidth / imgAspect;

      if (renderHeight > printableHeight) {
        renderHeight = printableHeight;
        renderWidth = printableHeight * imgAspect;
      }

      const xPos = margin + (printableWidth - renderWidth) / 2;
      const yPos = margin + (printableHeight - renderHeight) / 2;

      pdf.addImage(imgCardData, 'JPEG', xPos, yPos, renderWidth, renderHeight, undefined, 'FAST');
      pagesAdded++;
    }

    if (pagesAdded === 0) {
      throw new Error('No se pudo encontrar el contenedor de documento visual para generar el PDF.');
    }

    // FIX_PDF_BLOB: generar el blob siempre
    const pdfBlob: Blob = pdf.output('blob');

    if (options.noDescargar) {
      // FIX_PDF_BLOB: solo devolver el blob, no descargar
      onProgress?.('PDF generado correctamente (sin descargar).');
      return {
        success: true,
        filename,
        securityHash,
        blob: pdfBlob,
      };
    }

    // Comportamiento original: descargar el PDF
    onProgress?.('Finalizando y descargando archivo PDF seguro...');
    pdf.save(filename);

    return {
      success: true,
      filename,
      securityHash,
      blob: pdfBlob,
    };
  } catch (err: any) {
    console.error('Error generating secure PDF:', err);
    return {
      success: false,
      error: err?.message || 'Error desconocido al generar el archivo PDF.',
    };
  }
}
