/**
 * ============================================================================
 * GENERADOR DE PDF DE ORDENES DE COBRO
 * H. Ayuntamiento Constitucional de Panuco, Veracruz
 * ============================================================================
 * 
 * Genera el PDF de la Orden Oficial de Cobro con 2 tantos:
 * - Tanto 1: Ejemplar para el Contribuyente
 * - Tanto 2: Talon de Control de Ingresos
 * 
 * Formatos de salida:
 * - dataUrl: para descargar localmente
 * - blob: para subir a Cloudinary
 */

import jsPDF from 'jspdf';
import { PaymentOrder, MunicipalConfig } from '../types';
import { OFFICIAL_PAYMENT_CONCEPTS, numberToSpanishCurrencyWords } from '../services/financeFirestore';

interface PdfOrdenResult {
  success: boolean;
  dataUrl?: string;
  blob?: Blob;
  error?: string;
}

/**
 * Formatea fecha en espanol (ej. "9 DE OCTUBRE DE 2026")
 */
function formatDateSpanish(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    const months = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    const mIdx = parseInt(m, 10) - 1;
    return `${parseInt(d, 10)} DE ${months[mIdx] || m} DEL ${y}`;
  } catch {
    return dateStr;
  }
}

/**
 * Genera el PDF de la Orden Oficial de Cobro con 2 tantos.
 * 
 * @param order - Datos de la orden
 * @param municipalConfig - Datos del municipio (nombre, direccion, etc.)
 * @returns Objeto con dataUrl y blob listos para descargar/subir
 */
export function generarPdfOrdenCobro(
  order: PaymentOrder,
  municipalConfig: MunicipalConfig
): PdfOrdenResult {
  try {
    // Formato Carta: 215.9 x 279.4 mm
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    const pageWidth = 215.9;
    const pageHeight = 279.4;
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // =========================================================
    // TANTO 1: EJEMPLAR PARA EL CONTRIBUYENTE
    // =========================================================
    let y = margin;

    // Encabezado oficial
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(municipalConfig.municipalityName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 4;

    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text('TESORERIA MUNICIPAL - DIRECCION DE INGRESOS', pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(9);
    doc.setTextColor(120, 60, 20);
    doc.text('ORDEN OFICIAL DE COBRO Y ENTERO DE DERECHOS PECUARIOS', pageWidth / 2, y, { align: 'center' });
    y += 6;

    // Linea separadora
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Folio / Ejercicio / Fecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('FOLIO OFICIAL:', margin, y);
    doc.text('EJERCICIO FISCAL:', pageWidth / 2, y, { align: 'center' });
    doc.text('EXPEDICION:', pageWidth - margin, y, { align: 'right' });
    y += 4;

    doc.setFontSize(10);
    doc.setTextColor(140, 30, 20);
    doc.setFont('courier', 'bold');
    doc.text(order.folio, margin, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(order.exercise, pageWidth / 2, y, { align: 'center' });
    doc.setFontSize(8);
    doc.text(formatDateSpanish(order.date), pageWidth - margin, y, { align: 'right' });
    y += 6;

    // Datos del contribuyente
    doc.setFillColor(245, 245, 240);
    doc.rect(margin, y - 2, contentWidth, 20, 'F');
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(margin, y - 2, contentWidth, 20, 'S');
    y += 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('CONTRIBUYENTE:', margin + 2, y);
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text('C. ' + order.taxpayerName, margin + 35, y);
    y += 5;

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('RFC:', margin + 2, y);
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(order.rfc || 'XAXX010101000', margin + 35, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('DOMICILIO:', margin + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 20);
    const addressLines = doc.splitTextToSize(order.address, contentWidth - 40);
    doc.text(addressLines[0], margin + 35, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('PERIODO APLICABLE:', margin + 2, y);
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(order.period, margin + 45, y);
    y += 7;

    // Titulo: Desglose de conceptos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('DESGLOSE DE CONCEPTOS DE PAGO:', margin, y);
    y += 3;

    // Tabla de conceptos
    const tableTop = y;
    const rowHeight = 6;
    const colConceptoX = margin + 2;
    const colAplicaX = pageWidth - margin - 35;
    const colImporteX = pageWidth - margin - 2;

    // Header
    doc.setFillColor(50, 30, 20);
    doc.rect(margin, tableTop, contentWidth, rowHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('CONCEPTO REGLAMENTARIO', colConceptoX, tableTop + 4);
    doc.text('APLICA', colAplicaX, tableTop + 4, { align: 'center' });
    doc.text('IMPORTE', colImporteX, tableTop + 4, { align: 'right' });
    y = tableTop + rowHeight;

    // Filas de conceptos
    OFFICIAL_PAYMENT_CONCEPTS.forEach((c, idx) => {
      const isIncluded = order.concepts.includes(c.label);
      const amount = c.id === 'otros' ? order.amount : c.defaultAmount;

      if (isIncluded) {
        doc.setFillColor(250, 240, 220);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

      doc.setTextColor(isIncluded ? 20 : 150, isIncluded ? 20 : 150, isIncluded ? 20 : 150);
      doc.setFont('helvetica', isIncluded ? 'bold' : 'normal');
      doc.setFontSize(7);

      const conceptText = c.label + (c.id === 'otros' && isIncluded && order.customConcept ? ' (' + order.customConcept + ')' : '');
      const conceptLines = doc.splitTextToSize(conceptText, colAplicaX - colConceptoX - 3);
      doc.text(conceptLines[0], colConceptoX, y + 4);

      doc.setFont('courier', 'bold');
      doc.text(isIncluded ? '[ X ]' : '[   ]', colAplicaX, y + 4, { align: 'center' });
      doc.text(isIncluded ? '$' + amount.toFixed(2) : '-', colImporteX, y + 4, { align: 'right' });

      y += rowHeight;
    });

    // Fila total
    doc.setFillColor(230, 220, 200);
    doc.rect(margin, y, contentWidth, rowHeight + 1, 'F');
    doc.setDrawColor(50, 30, 20);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TOTAL A LIQUIDAR EN VENTANILLA:', colAplicaX, y + 5, { align: 'right' });
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text('$' + (order.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) + ' MXN', colImporteX, y + 5, { align: 'right' });
    y += rowHeight + 3;

    // Importe con letra
    doc.setFillColor(245, 245, 240);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 10, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text('CANTIDAD EN LETRA:', margin + 2, y + 3);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 20);
    const letraText = numberToSpanishCurrencyWords(order.amount || 0);
    const letraLines = doc.splitTextToSize(letraText, contentWidth - 4);
    doc.text(letraLines[0], margin + 2, y + 7);
    y += 13;

    // Firmas
    const firmaY = y + 8;
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.3);
    // Firma cajero
    doc.line(margin + 5, firmaY, margin + 75, firmaY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(20, 20, 20);
    doc.text(order.cashierName || 'DIRECCION DE INGRESOS', margin + 40, firmaY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text('SELLO Y FIRMA DE CAJA', margin + 40, firmaY + 7, { align: 'center' });

    // Firma contribuyente
    doc.line(pageWidth - margin - 75, firmaY, pageWidth - margin - 5, firmaY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(20, 20, 20);
    doc.text('C. ' + order.taxpayerName, pageWidth - margin - 40, firmaY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text('FIRMA DEL CONTRIBUYENTE', pageWidth - margin - 40, firmaY + 7, { align: 'center' });

    y = firmaY + 12;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(150, 150, 150);
    doc.text('EJEMPLAR PARA EL CONTRIBUYENTE - CONSERVE ESTE COMPROBANTE', pageWidth / 2, y, { align: 'center' });
    y += 5;

    // =========================================================
    // LINEA DE CORTE
    // =========================================================
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text('- - - LINEA DE CORTE PARA CONTROL INTERNO - - -', pageWidth / 2, y + 3, { align: 'center' });
    y += 8;

    // =========================================================
    // TANTO 2: TALON DE CAJA
    // =========================================================
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.4);
    doc.rect(margin, y, contentWidth, 30, 'S');
    y += 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 20);
    doc.text('TALON DE CONTROL DE INGRESOS - H. AYUNTAMIENTO DE PANUCO', margin + 3, y + 4);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(140, 30, 20);
    doc.text('FOLIO: ' + order.folio, margin + 3, y + 9);

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text('$' + (order.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) + ' MXN', pageWidth - margin - 3, y + 8, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.text('CONTRIBUYENTE: ' + order.taxpayerName, margin + 3, y + 15);
    doc.text('RFC: ' + (order.rfc || 'XAXX010101000'), margin + 3, y + 19);
    doc.text('PERIODO: ' + order.period, margin + 3, y + 23);
    doc.text('EJERCICIO: ' + order.exercise, pageWidth / 2 + 5, y + 23);

    const conceptosStr = order.concepts.join(', ');
    const conceptLines = doc.splitTextToSize('CONCEPTOS: ' + conceptosStr, contentWidth - 6);
    doc.text(conceptLines[0], margin + 3, y + 27);

    // =========================================================
    // GENERAR SALIDAS
    // =========================================================
    const dataUrl = doc.output('datauristring');
    const blob = doc.output('blob');

    return {
      success: true,
      dataUrl,
      blob,
    };
  } catch (err: any) {
    console.error('[PDF Orden] Error generando PDF:', err);
    return {
      success: false,
      error: err?.message || 'Error desconocido al generar PDF',
    };
  }
}
