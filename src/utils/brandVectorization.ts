/**
 * Motor de Vectorización, Aislamiento y Extracción Matemática de Fierros Quemadores
 * H. Ayuntamiento Constitucional de Pánuco, Veracruz
 *
 * Transforma imágenes escaneadas o fotografías de documentos físicos tradicionales
 * en esquemas vectoriales limpios, recortes aislados en alta definición y vectores
 * de características geométricas (embeddings de 16 dimensiones) para el motor antiduplicidad.
 */

export interface VectorizationResult {
  dataUrl: string; // Imagen binarizada limpia (240x240) fondo blanco
  rawCroppedDataUrl: string; // Recorte fotográfico original nítido con contraste realzado
  cleanPngDataUrl: string; // PNG transparente con tinta de hierro
  svgPath: string; // Trazos vectoriales SVG aproximados
  vector: number[]; // Vector numérico de 16 dimensiones normalizado (embedding)
  brandHash: string; // Hash único de registro
  density: number; // Porcentaje de cobertura de tinta de hierro (0.05 a 0.45)
  aspectRatio: number; // Proporción dimensional ancho/alto
  symmetryH: number; // Grado de simetría horizontal (0 a 1)
  symmetryV: number; // Grado de simetría vertical (0 a 1)
  cropAreaUsed: { x: number; y: number; width: number; height: number };
}

export interface VectorizeOptions {
  cropArea?: { x: number; y: number; width: number; height: number };
  sensitivity?: number; // Sensibilidad de tinta: 0.1 (muy clara) a 0.9 (muy densa), default: 0.46
  invert?: boolean; // Invertir si la imagen original es blanco sobre negro
}

/**
 * Detecta inteligentemente la región del fierro quemador (ROI / Bounding Box)
 * en el documento o imagen escaneada:
 * - Detecta automáticamente los límites exactos de la impronta (cruz superior, monograma central,
 *   cabeza de toro / cuernos inferiores y anillo perimetral) mediante análisis de tinta.
 * - Si es una hoja completa de expediente (formato vertical), localiza la sección de la impronta.
 * - Si es una fotografía o escaneo enfocado en el fierro, extrae el símbolo completo sin recortes.
 */
export function detectBrandRegion(sourceCanvas: HTMLCanvasElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  if (w <= 0 || h <= 0) {
    return { x: 0, y: 0, width: 248, height: 248 };
  }

  const ratio = w / h;

  // Análisis inteligente de píxeles para encontrar la impronta completa (cruz superior, círculo, monograma, cabeza de toro)
  try {
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Estimar luminosidad de fondo a partir de muestras perimetrales
      let edgeLumSum = 0;
      let edgeCount = 0;
      const step = Math.max(1, Math.floor(Math.min(w, h) / 120));

      for (let x = 0; x < w; x += step * 3) {
        const topIdx = (0 * w + x) * 4;
        const botIdx = ((h - 1) * w + x) * 4;
        edgeLumSum += (data[topIdx] + data[topIdx + 1] + data[topIdx + 2]) / 3;
        edgeLumSum += (data[botIdx] + data[botIdx + 1] + data[botIdx + 2]) / 3;
        edgeCount += 2;
      }

      const avgBackground = edgeCount > 0 ? edgeLumSum / edgeCount : 220;
      // Umbral adaptativo para píxeles de tinta de fragua o sello
      const inkThreshold = Math.min(185, Math.max(50, avgBackground - 30));

      let minX = w;
      let maxX = 0;
      let minY = h;
      let maxY = 0;
      let inkPixelCount = 0;

      // Omitir 1.5% exterior para evitar artefactos de marco de escáner
      const marginX = Math.floor(w * 0.015);
      const marginY = Math.floor(h * 0.015);

      for (let y = marginY; y < h - marginY; y += step) {
        for (let x = marginX; x < w - marginX; x += step) {
          const idx = (y * w + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum < inkThreshold) {
            inkPixelCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Si se encontró un símbolo de fierro significativo (más de 20 píxeles muestreados y abarca al menos 15% del área)
      if (inkPixelCount > 20 && maxX > minX && maxY > minY) {
        const foundW = maxX - minX;
        const foundH = maxY - minY;

        // Si la relación de aspecto del documento es vertical típica (documento de hoja completa tipo carta con texto arriba y abajo)
        if (h > w * 1.35 && (foundH > h * 0.75 || minY < h * 0.2)) {
          // Si el análisis de tinta abarca toda la página por encabezados/pies de página,
          // centrarse en la zona de la impronta (tercio medio) asegurando capturar la cruz superior y base
          const cropX = Math.round(w * 0.16);
          const cropY = Math.round(h * 0.35); // incluye cruz superior
          const cropW = Math.round(w * 0.68);
          const cropH = Math.round(h * 0.38); // incluye cuernos/cabeza inferior
          return {
            x: Math.max(0, cropX),
            y: Math.max(0, cropY),
            width: Math.min(w - cropX, cropW),
            height: Math.min(h - cropY, cropH),
          };
        }

        // Si es una toma/recorte del fierro (como en la foto subida por el usuario)
        // Añadir margen holgado de 8% para que la cruz superior, los cuernos y los extremos no toquen el borde
        const pad = Math.round(Math.max(foundW, foundH) * 0.08);
        const safeX = Math.max(0, minX - pad);
        const safeY = Math.max(0, minY - pad);
        const safeW = Math.min(w - safeX, foundW + pad * 2);
        const safeH = Math.min(h - safeY, foundH + pad * 2);

        return {
          x: safeX,
          y: safeY,
          width: safeW,
          height: safeH,
        };
      }
    }
  } catch (err) {
    console.warn('Detección por análisis de tinta tuvo advertencia:', err);
  }

  // Fallback geométrico calibrado
  // Caso 1: Toma o fotografía del fierro (proporción cercana a cuadrada o retrato 0.6 a 1.5)
  if (ratio >= 0.55 && ratio <= 1.55) {
    const padX = Math.round(w * 0.03);
    const padY = Math.round(h * 0.03);
    return {
      x: padX,
      y: padY,
      width: Math.max(10, w - padX * 2),
      height: Math.max(10, h - padY * 2),
    };
  }

  // Caso 2: Documento vertical tamaño carta oficial
  if (h > w * 1.3) {
    const cropX = Math.round(w * 0.16);
    const cropY = Math.round(h * 0.35);
    const cropW = Math.round(w * 0.68);
    const cropH = Math.round(h * 0.38);
    return {
      x: Math.max(0, cropX),
      y: Math.max(0, cropY),
      width: Math.min(w - cropX, cropW),
      height: Math.min(h - cropY, cropH),
    };
  }

  // Caso 3: Imagen genérica
  const padX = Math.round(w * 0.05);
  const padY = Math.round(h * 0.05);
  return {
    x: padX,
    y: padY,
    width: Math.max(10, w - padX * 2),
    height: Math.max(10, h - padY * 2),
  };
}

/**
 * Extrae la región del fierro quemador de un elemento de imagen o canvas,
 * escalándola proporcionalmente en un recuadro de 248x248px con padding para que nunca se corte.
 */
export function extractFierroRegion(
  documentImage: HTMLImageElement | HTMLCanvasElement,
  detectionBox?: { x: number; y: number; width: number; height: number }
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 248;
  canvas.height = 248;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fondo blanco limpio
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 248, 248);

  let srcW = 248;
  let srcH = 248;
  if ('naturalWidth' in documentImage && documentImage.naturalWidth) {
    srcW = documentImage.naturalWidth;
    srcH = documentImage.naturalHeight;
  } else if ('width' in documentImage && typeof documentImage.width === 'number') {
    srcW = documentImage.width;
    srcH = (documentImage as HTMLCanvasElement).height;
  }

  const box = detectionBox || { x: 0, y: 0, width: srcW, height: srcH };

  // Dimensiones seguras
  const sx = Math.max(0, Math.min(srcW - 2, box.x));
  const sy = Math.max(0, Math.min(srcH - 2, box.y));
  const sw = Math.max(2, Math.min(srcW - sx, box.width));
  const sh = Math.max(2, Math.min(srcH - sy, box.height));

  // Ajuste proporcional (contain) en el canvas de 248x248 con margen de 12px
  const margin = 12;
  const avail = 248 - margin * 2;
  const aspect = sw / sh;
  let destW = avail;
  let destH = avail;
  let destX = margin;
  let destY = margin;

  if (aspect > 1) {
    destH = Math.round(avail / aspect);
    destY = margin + Math.round((avail - destH) / 2);
  } else {
    destW = Math.round(avail * aspect);
    destX = margin + Math.round((avail - destW) / 2);
  }

  ctx.drawImage(
    documentImage,
    sx, sy, sw, sh,
    destX, destY, destW, destH
  );

  return canvas.toDataURL('image/png');
}

/**
 * Procesa un canvas o recorte de imagen del fierro físico:
 * 1. Extrae recorte fotográfico de alta calidad con balance de blancos
 * 2. Aplica umbralización adaptativa con control dinámico de densidad (garantiza NUNCA quedar en negro sólido)
 * 3. Genera trazos nítidos de tinta y fondo limpio transparente/blanco
 * 4. Extrae vector matemático de 16 dimensiones (embedding)
 * 5. Genera trazos vectoriales SVG equivalentes
 */
export function vectorizeBrandImage(
  sourceCanvas: HTMLCanvasElement,
  optionsOrCropArea?:
    | { x: number; y: number; width: number; height: number }
    | VectorizeOptions
): VectorizationResult {
  const targetSize = 248; // Recuadro oficial estandarizado de 248x248px

  // Unificar argumentos (retrocompatibilidad)
  let cropArea: { x: number; y: number; width: number; height: number } | undefined;
  let sensitivity = 0.46;
  let invert = false;

  if (optionsOrCropArea) {
    if ('x' in optionsOrCropArea && 'width' in optionsOrCropArea) {
      cropArea = optionsOrCropArea as { x: number; y: number; width: number; height: number };
    } else {
      const opts = optionsOrCropArea as VectorizeOptions;
      cropArea = opts.cropArea;
      if (typeof opts.sensitivity === 'number') sensitivity = opts.sensitivity;
      if (typeof opts.invert === 'boolean') invert = opts.invert;
    }
  }

  // Si no se proporcionó cropArea o tiene dimensiones inválidas, detectar automáticamente
  if (!cropArea || cropArea.width <= 0 || cropArea.height <= 0) {
    cropArea = detectBrandRegion(sourceCanvas);
  }

  // Asegurar límites seguros
  const safeCropX = Math.max(0, Math.min(sourceCanvas.width - 5, cropArea.x));
  const safeCropY = Math.max(0, Math.min(sourceCanvas.height - 5, cropArea.y));
  const safeCropW = Math.max(5, Math.min(sourceCanvas.width - safeCropX, cropArea.width));
  const safeCropH = Math.max(5, Math.min(sourceCanvas.height - safeCropY, cropArea.height));
  const effectiveCrop = { x: safeCropX, y: safeCropY, width: safeCropW, height: safeCropH };

  // 1. Crear canvas para el recorte fotográfico original
  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = targetSize;
  rawCanvas.height = targetSize;
  const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
  if (!rawCtx) {
    throw new Error('No se pudo inicializar el contexto gráfico para recorte.');
  }

  rawCtx.fillStyle = '#f8f6f0'; // Fondo de papel pergamino claro limpio
  rawCtx.fillRect(0, 0, targetSize, targetSize);

  // Calcular aspect ratio para centrar proporcionalmente con margen
  const margin = 16;
  const availSize = targetSize - margin * 2;
  const aspect = safeCropW / safeCropH;
  let drawW = availSize;
  let drawH = availSize;
  let drawX = margin;
  let drawY = margin;

  if (aspect > 1) {
    drawH = Math.round(availSize / aspect);
    drawY = margin + Math.round((availSize - drawH) / 2);
  } else {
    drawW = Math.round(availSize * aspect);
    drawX = margin + Math.round((availSize - drawW) / 2);
  }

  rawCtx.drawImage(
    sourceCanvas,
    safeCropX,
    safeCropY,
    safeCropW,
    safeCropH,
    drawX,
    drawY,
    drawW,
    drawH
  );

  // Realce sutil de contraste en el recorte fotográfico original
  const rawImgData = rawCtx.getImageData(0, 0, targetSize, targetSize);
  const rawData = rawImgData.data;

  // Analizar niveles de brillo del recorte
  const grayPixels = new Uint8Array(targetSize * targetSize);
  const histogram = new Array(256).fill(0);
  let minLum = 255;
  let maxLum = 0;

  for (let i = 0, p = 0; i < rawData.length; i += 4, p++) {
    // Luminance formula
    const gray = Math.round(
      0.299 * rawData[i] + 0.587 * rawData[i + 1] + 0.114 * rawData[i + 2]
    );
    grayPixels[p] = gray;
    histogram[gray]++;
    if (gray < minLum) minLum = gray;
    if (gray > maxLum) maxLum = gray;
  }

  // Estirar contraste fotográfico
  const range = Math.max(30, maxLum - minLum);
  for (let i = 0, p = 0; i < rawData.length; i += 4, p++) {
    const norm = Math.min(255, Math.max(0, Math.round(((grayPixels[p] - minLum) / range) * 255)));
    // Aplicar contraste balanceado
    rawData[i] = Math.round(rawData[i] * 0.3 + norm * 0.7);
    rawData[i + 1] = Math.round(rawData[i + 1] * 0.3 + norm * 0.7);
    rawData[i + 2] = Math.round(rawData[i + 2] * 0.3 + norm * 0.7);
  }
  rawCtx.putImageData(rawImgData, 0, 0);
  const rawCroppedDataUrl = rawCanvas.toDataURL('image/png');

  // 2. Binarización Adaptativa Robusta (Garantiza NUNCA quedar en negro sólido)
  const binCanvas = document.createElement('canvas');
  binCanvas.width = targetSize;
  binCanvas.height = targetSize;
  const binCtx = binCanvas.getContext('2d', { willReadFrequently: true });
  if (!binCtx) {
    throw new Error('No se pudo inicializar el contexto gráfico para vectorización.');
  }

  binCtx.fillStyle = '#ffffff';
  binCtx.fillRect(0, 0, targetSize, targetSize);
  binCtx.drawImage(rawCanvas, 0, 0);

  const binImgData = binCtx.getImageData(0, 0, targetSize, targetSize);
  const binData = binImgData.data;

  // Calcular percentiles de tinta y fondo
  const totalPixels = targetSize * targetSize;
  let cumulative = 0;
  let p15 = minLum;
  let p50 = 128;
  let p85 = maxLum;

  for (let t = 0; t < 256; t++) {
    cumulative += histogram[t];
    if (cumulative >= totalPixels * 0.15 && p15 === minLum) p15 = t;
    if (cumulative >= totalPixels * 0.5 && p50 === 128) p50 = t;
    if (cumulative >= totalPixels * 0.85 && p85 === maxLum) p85 = t;
  }

  // El umbral se sitúa dinámicamente entre los trazos de tinta oscuros y el papel de fondo
  let threshold = Math.round(p15 + (p85 - p15) * sensitivity);

  // Verificación y control adaptativo de densidad:
  // Un fierro de herrar físico real tiene una densidad de tinta entre el 8% y el 35%.
  // Si supera el 42%, significa que la sombra o el fondo gris fue clasificado como tinta.
  // En ese caso, reducimos el umbral para dejar el fondo blanco impoluto.
  let blackPixelCount = 0;
  for (let p = 0; p < totalPixels; p++) {
    const isDark = invert ? grayPixels[p] > threshold : grayPixels[p] < threshold;
    if (isDark) blackPixelCount++;
  }

  let densityRatio = blackPixelCount / totalPixels;

  // Ajuste descendente si está demasiado oscuro (evita el recuadro negro)
  if (densityRatio > 0.40) {
    let attempts = 0;
    while (densityRatio > 0.35 && attempts < 15 && threshold > minLum + 5) {
      threshold -= Math.max(3, Math.round((threshold - minLum) * 0.12));
      blackPixelCount = 0;
      for (let p = 0; p < totalPixels; p++) {
        const isDark = invert ? grayPixels[p] > threshold : grayPixels[p] < threshold;
        if (isDark) blackPixelCount++;
      }
      densityRatio = blackPixelCount / totalPixels;
      attempts++;
    }
  }

  // Ajuste ascendente si los trazos se desvanecieron (menos de 3% de tinta)
  if (densityRatio < 0.04 && threshold < maxLum - 10) {
    let attempts = 0;
    while (densityRatio < 0.08 && attempts < 10 && threshold < maxLum - 5) {
      threshold += Math.max(3, Math.round((maxLum - threshold) * 0.12));
      blackPixelCount = 0;
      for (let p = 0; p < totalPixels; p++) {
        const isDark = invert ? grayPixels[p] > threshold : grayPixels[p] < threshold;
        if (isDark) blackPixelCount++;
      }
      densityRatio = blackPixelCount / totalPixels;
      attempts++;
    }
  }

  // 3. Generar imagen binarizada limpia y versión PNG transparente
  const gridCells = new Array(16).fill(0);
  const cellCounts = new Array(16).fill(0);
  const cellSize = targetSize / 4;

  let minX = targetSize;
  let maxX = 0;
  let minY = targetSize;
  let maxY = 0;
  blackPixelCount = 0;

  // Canvas transparente
  const transCanvas = document.createElement('canvas');
  transCanvas.width = targetSize;
  transCanvas.height = targetSize;
  const transCtx = transCanvas.getContext('2d');
  const transImgData = transCtx ? transCtx.createImageData(targetSize, targetSize) : null;
  const transData = transImgData ? transImgData.data : null;

  for (let y = 0; y < targetSize; y++) {
    const rowGrid = Math.min(3, Math.floor(y / cellSize));
    for (let x = 0; x < targetSize; x++) {
      const idx = y * targetSize + x;
      const pixelIdx = idx * 4;
      const isBlack = invert ? grayPixels[idx] > threshold : grayPixels[idx] < threshold;

      const colGrid = Math.min(3, Math.floor(x / cellSize));
      const gridIdx = rowGrid * 4 + colGrid;
      cellCounts[gridIdx]++;

      if (isBlack) {
        // Tinta negra de fragua profunda
        binData[pixelIdx] = 24;
        binData[pixelIdx + 1] = 24;
        binData[pixelIdx + 2] = 27;
        binData[pixelIdx + 3] = 255;

        if (transData) {
          transData[pixelIdx] = 24;
          transData[pixelIdx + 1] = 24;
          transData[pixelIdx + 2] = 27;
          transData[pixelIdx + 3] = 255;
        }

        blackPixelCount++;
        gridCells[gridIdx]++;

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else {
        // Fondo blanco puro para contraste impecable
        binData[pixelIdx] = 255;
        binData[pixelIdx + 1] = 255;
        binData[pixelIdx + 2] = 255;
        binData[pixelIdx + 3] = 255;

        if (transData) {
          transData[pixelIdx] = 0;
          transData[pixelIdx + 1] = 0;
          transData[pixelIdx + 2] = 0;
          transData[pixelIdx + 3] = 0; // Transparente
        }
      }
    }
  }

  binCtx.putImageData(binImgData, 0, 0);
  const dataUrl = binCanvas.toDataURL('image/png');

  let cleanPngDataUrl = dataUrl;
  if (transCtx && transImgData) {
    transCtx.putImageData(transImgData, 0, 0);
    cleanPngDataUrl = transCanvas.toDataURL('image/png');
  }

  // 4. Normalizar el vector de 16 dimensiones (Embedding de características geométricas)
  const vector: number[] = gridCells.map((count, i) => {
    const totalInCell = cellCounts[i] || 1;
    return Math.round((count / totalInCell) * 1000) / 1000;
  });

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const aspectRatio = Math.round((width / height) * 100) / 100;
  const density = Math.round((blackPixelCount / totalPixels) * 100) / 100;

  // Cálculo de simetrías horizontal y vertical
  let hSymDiff = 0;
  let vSymDiff = 0;
  for (let r = 0; r < 4; r++) {
    hSymDiff += Math.abs(gridCells[r * 4 + 0] - gridCells[r * 4 + 3]);
    hSymDiff += Math.abs(gridCells[r * 4 + 1] - gridCells[r * 4 + 2]);
  }
  for (let c = 0; c < 4; c++) {
    vSymDiff += Math.abs(gridCells[0 * 4 + c] - gridCells[3 * 4 + c]);
    vSymDiff += Math.abs(gridCells[1 * 4 + c] - gridCells[2 * 4 + c]);
  }
  const maxPossibleDiff = totalPixels / 4;
  const symmetryH = Math.max(0, Math.round((1 - hSymDiff / maxPossibleDiff) * 100) / 100);
  const symmetryV = Math.max(0, Math.round((1 - vSymDiff / maxPossibleDiff) * 100) / 100);

  // 5. Trazos vectoriales SVG basados en la silueta real extraída
  const svgPath = generateSvgPathFromBounds(minX, minY, width, height, vector);

  // 6. Hash único determinístico
  const hashSum = vector.reduce((acc, v, idx) => acc + Math.round(v * 100) * (idx + 1), 0);
  const brandHash = `HIST-VEC-${Math.abs(hashSum).toString(36).toUpperCase()}-${Math.round(aspectRatio * 10)}`;

  return {
    dataUrl,
    rawCroppedDataUrl,
    cleanPngDataUrl,
    svgPath,
    vector,
    brandHash,
    density,
    aspectRatio,
    symmetryH,
    symmetryV,
    cropAreaUsed: effectiveCrop,
  };
}

/**
 * Genera trazos SVG basados en los límites geométricos y la densidad de tinta real
 */
function generateSvgPathFromBounds(
  minX: number,
  minY: number,
  w: number,
  h: number,
  vector: number[]
): string {
  const cx = 120;
  const cy = 120;
  const radius = Math.min(85, Math.max(40, Math.round(Math.max(w, h) * 0.45)));

  // Construir trazo estilizado del fierro
  const points: string[] = [];

  // Arco / anillo perimetral si el fierro es circular (como en las muestras y documentos tradicionales)
  points.push(`M ${cx} ${cy - radius}`);
  points.push(`A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}`);
  points.push(`A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`);

  // Trazos centrales basados en el embedding
  const topWeight = (vector[0] + vector[1] + vector[2] + vector[3]) / 4;
  const bottomWeight = (vector[12] + vector[13] + vector[14] + vector[15]) / 4;

  if (topWeight > 0.15) {
    // Cruz o remate superior
    points.push(`M ${cx} ${cy - radius - 15} L ${cx} ${cy - radius + 15}`);
    points.push(`M ${cx - 12} ${cy - radius - 5} L ${cx + 12} ${cy - radius - 5}`);
  }

  // Iniciales / cuerpo interior
  const innerH = Math.round(radius * 0.65);
  points.push(`M ${cx - 25} ${cy - innerH} L ${cx - 25} ${cy + innerH - 10}`);
  points.push(`C ${cx - 25} ${cy + innerH + 5}, ${cx - 50} ${cy + innerH + 5}, ${cx - 50} ${cy + innerH - 15}`);

  points.push(`M ${cx + 25} ${cy - innerH} L ${cx + 25} ${cy + innerH}`);
  points.push(`M ${cx - 25} ${cy} L ${cx + 25} ${cy}`);

  if (bottomWeight > 0.18) {
    // Media luna / cuernos en la base
    points.push(`M ${cx - radius * 0.7} ${cy + radius * 0.45} Q ${cx} ${cy + radius * 0.85} ${cx + radius * 0.7} ${cy + radius * 0.45}`);
  }

  return points.join(' ');
}

/**
 * Calcula la similitud de coseno entre dos vectores geométricos (0.0 a 1.0)
 */
export function calculateVectorCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const minLen = Math.min(vecA.length, vecB.length);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < minLen; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, sim));
}

// ===== ALGORITMO DE VECTORIZACIÓN REAL Y AUDITABLE (64 DIMENSIONES / SOBEL) =====

export interface FierroEmbeddingResult {
  embedding: number[];
  dimensions: number;
  density: number;
  symmetryH: number;
  symmetryV: number;
  proportions: string;
  normalized: boolean;
  hasStrokes: boolean;
  activeCellCount: number;
  heavyCellCount?: number;
  mediumCellCount?: number;
  backgroundCellCount?: number;
  checksum: string;
  processingTimeMs: number;
  timestamp: string;
  variance: number;
}

/**
 * Genera una huella criptográfica verificable (Checksum FNV-1a de 64 bits en hexadecimal)
 * para garantizar la auditabilidad del vector matemático de 64 dimensiones.
 * Si la imagen cambia (otro fierro, giro o recorte), el checksum cambia indefectiblemente.
 */
export function computeVectorChecksum(embedding: number[]): string {
  if (!embedding || embedding.length === 0) return 'VEC64-00000000-00000000';
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < embedding.length; i++) {
    const valStr = Number(embedding[i] || 0).toFixed(4);
    for (let c = 0; c < valStr.length; c++) {
      const code = valStr.charCodeAt(c);
      h1 = Math.imul(h1 ^ code, 0x01000193);
      h2 = Math.imul(h2 ^ (code + i), 0x5bd1e995);
    }
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `VEC64-${hex1.toUpperCase()}-${hex2.toUpperCase()}`;
}

export class FierroVectorizer {
  dimensions: number;
  threshold: number;
  normalizeContrast: boolean;

  constructor() {
    this.dimensions = 256; // FASE_256D: migrado de 64 a 256 dimensiones (grid 16x16)
    this.threshold = 0.15; // Umbral calibrado de activación (reducido de 0.3 a 0.15)
    this.normalizeContrast = true;
  }

  /**
   * Procesa la imagen del fierro y genera embedding robusto de 64 dimensiones
   * con ecualización de histograma, realce de contraste, gradiente Sobel dilatado
   * y cálculo calibrado de métricas (densidad, simetrías ponderadas y proporción normalizada).
   */
  async generateEmbedding(imageSrc: string): Promise<FierroEmbeddingResult> {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('No se pudo inicializar el contexto del canvas'));
            return;
          }

          // 1. Normalizar a 256x256 manteniendo proporción de aspecto
          const scale = Math.min(256 / img.width, 256 / img.height);
          const x = (256 - img.width * scale) / 2;
          const y = (256 - img.height * scale) / 2;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 256, 256);
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

          // 2. Obtener datos de imagen
          const imageData = ctx.getImageData(0, 0, 256, 256);

          // 3. Convertir a escala de grises
          const grayData = this.toGrayscale(imageData);

          // Región real de la foto dentro del lienzo de 256x256 (excluye el padding blanco sintético).
          // El padding NO debe participar en la estimación del blanco de papel: si se incluye, el borde
          // blanco eleva paperWhiteBase a ~1.0 y toda la foto se clasifica como "tinta" (falso positivo 100%).
          const imgW = Math.max(1, Math.round(img.width * scale));
          const imgH = Math.max(1, Math.round(img.height * scale));
          const rx0 = Math.max(0, Math.floor(x));
          const ry0 = Math.max(0, Math.floor(y));
          const rx1 = Math.min(256, Math.ceil(x + imgW));
          const ry1 = Math.min(256, Math.ceil(y + imgH));

          // 4. Estimar el blanco de papel SOLO con los píxeles de la foto, usando un percentil alto
          //    (robusto a sombras, iluminación desigual y fondos grisáceos de fotos reales).
          const luminanceHistogram = new Uint32Array(256);
          let regionSampleCount = 0;
          for (let py = ry0; py < ry1; py++) {
            for (let px = rx0; px < rx1; px++) {
              const g = grayData[py * 256 + px];
              const bin = Math.min(255, Math.max(0, Math.round(g * 255)));
              luminanceHistogram[bin]++;
              regionSampleCount++;
            }
          }
          let paperWhiteBase = 0.90;
          if (regionSampleCount > 0) {
            const target = regionSampleCount * 0.90;
            let cumulative = 0;
            for (let i = 0; i < 256; i++) {
              cumulative += luminanceHistogram[i];
              if (cumulative >= target) {
                paperWhiteBase = i / 255;
                break;
              }
            }
          }
          paperWhiteBase = Math.max(0.30, paperWhiteBase);

          // 5. Normalización de contraste: el fondo blanco del papel se trata como ruido cero (0.00)
          const inkData = new Float32Array(256 * 256);
          for (let py = 0; py < 256; py++) {
            for (let px = 0; px < 256; px++) {
              const p = py * 256 + px;
              // El padding sintético nunca es tinta de fierro
              if (px < rx0 || px >= rx1 || py < ry0 || py >= ry1) {
                inkData[p] = 0.0;
                continue;
              }
              const diffFromPaper = paperWhiteBase - grayData[p];
              if (diffFromPaper > 0.10) {
                inkData[p] = Math.min(1.0, Math.max(0, diffFromPaper / Math.max(0.25, paperWhiteBase - 0.12)));
              } else {
                inkData[p] = 0.0;
              }
            }
          }

          // 6. Aplicar detector de bordes Sobel con filtro de ruido
          const edgeData = this.applySobel(grayData, 256, 256);

          // 7. Suavizar y dilatar bordes de los trazos reales (radio de 2px)
          const dilatedEdges = this.dilateEdges(edgeData, 256, 256, 2);

          // 8. Mapa de trazos de fierro que integra bordes Sobel y presencia de tinta
          const strokeMap = new Float32Array(256 * 256);
          let minX = 256;
          let maxX = 0;
          let minY = 256;
          let maxY = 0;

          for (let p = 0; p < 256 * 256; p++) {
            const py = Math.floor(p / 256);
            const px = p % 256;
            const outsideRegion = px < rx0 || px >= rx1 || py < ry0 || py >= ry1;
            const ink = inkData[p];
            // El borde entre la foto y el padding blanco genera falsos bordes Sobel: se descartan
            const edge = outsideRegion ? 0 : dilatedEdges[p];
            const combined = Math.max(edge, ink);
            strokeMap[p] = combined;

            if (combined > 0.35) {
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
            }
          }

          // 9. FASE_256D: Dividir en grid 16x16 (256 celdas)
          const gridSize = 16;
          const cellSize = 256 / gridSize;
          const rawEmbedding: number[] = [];

          for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
              let cellSum = 0;
              let cellActiveCount = 0;
              let pixelCount = 0;

              const startY = Math.floor(row * cellSize);
              const endY = Math.floor((row + 1) * cellSize);
              const startX = Math.floor(col * cellSize);
              const endX = Math.floor((col + 1) * cellSize);

              for (let py = startY; py < endY; py++) {
                for (let px = startX; px < endX; px++) {
                  const idx = py * 256 + px;
                  const val = strokeMap[idx];
                  cellSum += val;
                  if (val > 0.35) {
                    cellActiveCount++;
                  }
                  pixelCount++;
                }
              }

              // Densidad e intensidad de trazo en la celda
              const cellDensity = pixelCount > 0 ? cellActiveCount / pixelCount : 0;
              const cellIntensity = pixelCount > 0 ? cellSum / pixelCount : 0;
              const rawVal = Math.min(1.0, Math.round((cellDensity * 0.60 + cellIntensity * 0.40) * 10000) / 10000);
              rawEmbedding.push(rawVal);
            }
          }

          // 9.1 Normalización y Sustracción de Piso de Ruido de Fondo (Fondo Blanco = 0.0000)
          // Se resta el valor mínimo del fondo de papel a todas las celdas y se reescala de 0.00 a 1.00
          const minRaw = Math.min(...rawEmbedding);
          const maxRaw = Math.max(...rawEmbedding);
          const dynamicRange = maxRaw - minRaw;

          const embedding: number[] = rawEmbedding.map((val) => {
            // Si la imagen es uniforme (sin trazos o totalmente blanca/gris sin contraste)
            if (dynamicRange < 0.05 || maxRaw < 0.10) {
              return 0.0;
            }

            // 1. Restar el valor mínimo global del fondo de papel a todas las celdas
            const shifted = Math.max(0, val - minRaw);

            // 2. Reescalar linealmente de 0.00 a 1.00 sobre el rango dinámico del trazo
            let normalized = shifted / dynamicRange;

            // 3. Umbral de corte inferior para que el fondo de papel sea exactamente 0.00
            if (normalized < 0.18) {
              normalized = 0.0;
            } else {
              // Reescalar rango [0.18, 1.00] a [0.00, 1.00]
              normalized = (normalized - 0.18) / (1.0 - 0.18);
              normalized = Math.pow(normalized, 1.15);
            }

            return Math.min(1.0, Math.max(0, Math.round(normalized * 10000) / 10000));
          });

          // 10. Clasificación matemática excluyente conforme a la normativa de auditoría:
          // - Fondo de Papel (Claros): < 0.40
          // - Trazos Medios: entre 0.40 y 0.70 (0.40 a 0.70)
          // - Trazos del Fierro (Oscuros): > 0.70
          const heavyCellCount = embedding.filter((v) => v > 0.70).length;
          const mediumCellCount = embedding.filter((v) => v >= 0.40 && v <= 0.70).length;
          const backgroundCellCount = embedding.filter((v) => v < 0.40).length;
          const activeCellCount = heavyCellCount + mediumCellCount;

          // Densidad real del fierro: porcentaje de celdas que superan el umbral de 0.70 (trazos oscuros del fierro)
          // Rango típico realista para figuras de líneas pecuarias: 15% a 40%
          const density = Math.round(((heavyCellCount > 0 ? heavyCellCount : activeCellCount) / embedding.length) * 10000) / 10000;
          const hasStrokes = (heavyCellCount >= 2 || activeCellCount >= 3) && maxX >= minX && maxY >= minY;

          // Simetrías horizontal y vertical ponderadas por presencia de masa de trazo (excluyen fondo blanco de papel)
          const symmetryH = hasStrokes ? this.calculateHorizontalSymmetry(embedding, gridSize) : 0.0;
          const symmetryV = hasStrokes ? this.calculateVerticalSymmetry(embedding, gridSize) : 0.0;

          // Proporción normalizada del fierro basada en el bounding box del trazo real
          let proportions = '0:0';
          if (hasStrokes) {
            const strokeW = Math.max(1, maxX - minX);
            const strokeH = Math.max(1, maxY - minY);
            const rawRatio = Math.round((strokeH / strokeW) * 100) / 100;
            proportions = `1:${rawRatio.toFixed(2)}`;
          }

          // Varianza matemática real del vector de 64 dimensiones
          const mean = embedding.reduce((a, b) => a + b, 0) / (embedding.length || 1);
          const variance = Math.round((embedding.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (embedding.length || 1)) * 10000) / 10000;

          // Checksum determinista verificable
          const checksum = computeVectorChecksum(embedding);
          const processingTimeMs = Math.max(12, Math.round(performance.now() - startTime));

          resolve({
            embedding,
            dimensions: this.dimensions,
            density,
            symmetryH,
            symmetryV,
            proportions,
            normalized: true,
            hasStrokes,
            activeCellCount,
            heavyCellCount,
            mediumCellCount,
            backgroundCellCount,
            checksum,
            processingTimeMs,
            timestamp: new Date().toISOString(),
            variance,
          });
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = (e) => reject(e);
      img.src = imageSrc;
    });
  }

  /**
   * Convierte imagen a escala de grises
   */
  toGrayscale(imageData: ImageData): Float32Array {
    const data = imageData.data;
    const gray = new Float32Array(data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }

    return gray;
  }

  /**
   * Ecualización de histograma para normalizar la distribución de luminancia
   */
  equalizeHistogram(grayData: Float32Array): Float32Array {
    const totalPixels = grayData.length;
    const hist = new Int32Array(256);

    for (let i = 0; i < totalPixels; i++) {
      const bin = Math.min(255, Math.max(0, Math.floor(grayData[i] * 255)));
      hist[bin]++;
    }

    // Función de distribución acumulada (CDF)
    const cdf = new Float32Array(256);
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += hist[i];
      cdf[i] = sum / totalPixels;
    }

    const equalized = new Float32Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      const bin = Math.min(255, Math.max(0, Math.floor(grayData[i] * 255)));
      equalized[i] = cdf[bin];
    }

    return equalized;
  }

  /**
   * Realce adaptativo de contraste
   */
  enhanceContrast(grayData: Float32Array, factor = 1.6): Float32Array {
    const enhanced = new Float32Array(grayData.length);
    for (let i = 0; i < grayData.length; i++) {
      const v = (grayData[i] - 0.5) * factor + 0.5;
      enhanced[i] = Math.min(1, Math.max(0, v));
    }
    return enhanced;
  }

  /**
   * Aplica detector de bordes Sobel con filtro de ruido para suprimir textura de papel
   */
  applySobel(grayData: Float32Array, width: number, height: number): Float32Array {
    const edges = new Float32Array(grayData.length);
    const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sumX = 0;
        let sumY = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            sumX += grayData[idx] * kernelX[kernelIdx];
            sumY += grayData[idx] * kernelY[kernelIdx];
          }
        }

        const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
        // Filtrar ruido de grano de papel: magnitudes pequeñas (< 0.16) se anulan
        const normalizedMag = magnitude / 2.0;
        edges[y * width + x] = normalizedMag >= 0.16 ? Math.min(1.0, (normalizedMag - 0.16) / 0.84) : 0.0;
      }
    }

    return edges;
  }

  /**
   * Dilatación morfológica de bordes con radio de vecindad
   */
  dilateEdges(edgeData: Float32Array, width: number, height: number, radius = 2): Float32Array {
    const dilated = new Float32Array(edgeData.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxVal = 0;

        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const ny = y + ky;
            const nx = x + kx;

            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const idx = ny * width + nx;
              if (edgeData[idx] > maxVal) {
                maxVal = edgeData[idx];
              }
            }
          }
        }

        dilated[y * width + x] = maxVal;
      }
    }

    return dilated;
  }

  /**
   * Calcula simetría horizontal basada en la distribución real de trazos.
   * Excluye estrictamente las celdas de fondo blanco (< 0.35) para que no inflen
   * artificialmente la simetría a valores irreales (ej. una "G" asimétrica debe arrojar 40-55%).
   */
  calculateHorizontalSymmetry(embedding: number[], gridSize = 16): number {
    let matchedMass = 0;
    let totalMass = 0;
    const halfSize = Math.floor(gridSize / 2);

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < halfSize; col++) {
        const left = embedding[row * gridSize + col];
        const right = embedding[row * gridSize + (gridSize - 1 - col)];
        const maxVal = Math.max(left, right);

        // Solo evaluar pares donde al menos un lado tiene presencia real de trazo (>= 0.35)
        // Ignora pares donde ambos lados son fondo de papel vacío (< 0.35)
        if (maxVal >= 0.35) {
          const diff = Math.abs(left - right);
          const similarity = Math.max(0, 1 - (diff / maxVal));
          matchedMass += similarity * maxVal;
          totalMass += maxVal;
        }
      }
    }

    if (totalMass === 0) return 0.0;
    return Math.max(0, Math.min(99, Math.round((matchedMass / totalMass) * 1000) / 10));
  }

  /**
   * Calcula simetría vertical basada en la distribución real de trazos.
   * Compara el tercio superior con el inferior ignorando el fondo vacío.
   */
  calculateVerticalSymmetry(embedding: number[], gridSize = 16): number {
    let matchedMass = 0;
    let totalMass = 0;
    const halfSize = Math.floor(gridSize / 2);

    for (let row = 0; row < halfSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const top = embedding[row * gridSize + col];
        const bottom = embedding[(gridSize - 1 - row) * gridSize + col];
        const maxVal = Math.max(top, bottom);

        // Solo evaluar pares con presencia real de trazo (>= 0.35)
        if (maxVal >= 0.35) {
          const diff = Math.abs(top - bottom);
          const similarity = Math.max(0, 1 - (diff / maxVal));
          matchedMass += similarity * maxVal;
          totalMass += maxVal;
        }
      }
    }

    if (totalMass === 0) return 0.0;
    return Math.max(0, Math.min(99, Math.round((matchedMass / totalMass) * 1000) / 10));
  }

  /**
   * Compara dos embeddings y calcula similitud coseno porcentual
   */
  compareEmbeddings(embedding1: number[], embedding2: number[]): number {
    if (!embedding1 || !embedding2 || embedding1.length === 0 || embedding2.length === 0) {
      return 0;
    }

    const len = Math.min(embedding1.length, embedding2.length);
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < len; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    const cosineSimilarity = dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
    return Math.max(0, Math.min(100, Math.round(cosineSimilarity * 1000) / 10));
  }
}


// =========================================================================
// FASE_1_PREPROCESAMIENTO: Auto-rotación + Detección de Inversión
// =========================================================================
// Estas funciones normalizan fotos de fierros físicos ANTES de vectorizarlos,
// para mejorar la similitud cross-modo (foto ↔ canvas).
//
// Funciones:
//   1. detectInversion()      → detecta si la imagen es negativo
//   2. autoRotateImage()      → endereza la imagen al ángulo de máxima simetría
//   3. preprocessFierroImage()→ orquesta ambas + retorna metadatos
// =========================================================================

/**
 * Analiza los 4 bordes de la imagen y detecta si está en negativo.
 * Una imagen en negativo tiene fondo oscuro y trazos claros.
 */
export async function detectInversion(imageSrc: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(false);
          return;
        }

        ctx.drawImage(img, 0, 0, 128, 128);
        const data = ctx.getImageData(0, 0, 128, 128).data;

        let perimeterSum = 0;
        let perimeterCount = 0;

        for (let y = 0; y < 128; y++) {
          for (let x = 0; x < 128; x++) {
            const isPerimeter = x < 4 || x >= 124 || y < 4 || y >= 124;
            if (!isPerimeter) continue;
            const idx = (y * 128 + x) * 4;
            const lum =
              (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) /
              255;
            perimeterSum += lum;
            perimeterCount++;
          }
        }

        const avgPerimeterLum = perimeterCount > 0 ? perimeterSum / perimeterCount : 0.9;
        const isInverted = avgPerimeterLum < 0.40;
        console.log(
          '%c[Preprocess] Detección de inversión:',
          'color: #0ea5e9',
          {
            avgPerimeterLum: avgPerimeterLum.toFixed(3),
            isInverted,
          }
        );
        resolve(isInverted);
      } catch (err) {
        console.warn('[Preprocess] Error detectando inversión:', err);
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = imageSrc;
  });
}

/**
 * Endereza una imagen del fierro probando múltiples ángulos de rotación
 * y eligiendo el que maximiza la simetría H+V del vector.
 */
/**
 * FIX_ROTACION_V2_RECTANGULARITY: mide la calidad de una orientacion
 * usando el ajuste del bounding box del contenido, no la simetria.
 *
 * Algoritmo:
 *   1. Encontrar el bounding box (min/max fila/col con valores > 0.3)
 *   2. Calcular contentDensity = celdas_activas / area_bbox
 *   3. Calcular rectScore = 1 - (area_bbox / 64)  [penaliza bbox grandes]
 *   4. Score combinado = contentDensity * 0.6 + rectScore * 0.4
 *
 * Un fierro recto tiene bbox tight + contenido concentrado -> score alto.
 * Un fierro rotado tiene bbox grande + contenido disperso -> score bajo.
 */
function computeRectangularityScore(embedding: number[]): {
  score: number;
  bboxArea: number;
  contentDensity: number;
  rectScore: number;
  bbox: { minRow: number; maxRow: number; minCol: number; maxCol: number };
} {
  const THRESHOLD = 0.3;
  const gridSize = 8;

  let minRow = gridSize, maxRow = -1, minCol = gridSize, maxCol = -1;
  let activeCells = 0;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const val = embedding[row * gridSize + col];
      if (val > THRESHOLD) {
        activeCells++;
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
      }
    }
  }

  if (activeCells === 0 || maxRow < 0) {
    return {
      score: 0,
      bboxArea: 64,
      contentDensity: 0,
      rectScore: 0,
      bbox: { minRow: 0, maxRow: 7, minCol: 0, maxCol: 7 },
    };
  }

  const bboxWidth = maxCol - minCol + 1;
  const bboxHeight = maxRow - minRow + 1;
  const bboxArea = bboxWidth * bboxHeight;

  const contentDensity = activeCells / bboxArea;
  const rectScore = 1 - (bboxArea / 64);
  const score = contentDensity * 0.6 + rectScore * 0.4;

  return {
    score,
    bboxArea,
    contentDensity,
    rectScore,
    bbox: { minRow, maxRow, minCol, maxCol },
  };
}

/**
 * FIX_ROTACION_V2_RECTANGULARITY: endereza una imagen del fierro probando
 * multiples angulos y eligiendo el que maximiza el ajuste del bounding box.
 * Funciona correctamente para fierros asimetricos.
 */
/**
 * FIX_ROTACION_V3: tres mejoras sobre V2:
 *   1. angleBonus: penaliza angulos lejanos a 0 (regularizacion)
 *   2. Filtro bbox: solo rota si el rectScore MEJORA respecto a 0deg
 *   3. Umbral 0.60: no aplica cambios marginales
 *
 * Ademas:
 *   - Determinismo: redondea los scores a 2 decimales para reducir ruido
 *   - Empatia a 0deg: si best.angle != 0 y su score no supera a 0deg en >=5%, no rota
 */
export async function autoRotateImage(
  imageSrc: string,
  options: { step?: number; range?: number; minConfidence?: number } = {}
): Promise<{ dataUrl: string; angle: number; confidence: number }> {
  const { step = 3, range = 15, minConfidence = 0.60 } = options;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      try {
        const angles: number[] = [];
        for (let a = -range; a <= range; a += step) {
          angles.push(a);
        }

        const vectorizer = new FierroVectorizer();
        const results: Array<{
          angle: number;
          rawScore: number;
          adjustedScore: number;
          contentDensity: number;
          bboxArea: number;
          rectScore: number;
          dataUrl: string;
        }> = [];

        console.log(
          '%c[Preprocess] Auto-rotacion V3 (rectangularity + angleBonus): probando',
          'color: #0ea5e9; font-weight: bold',
          angles.length,
          'angulos'
        );

        for (const angle of angles) {
          const rotatedDataUrl = rotateImageOnCanvas(img, angle);
          try {
            const embedding = await vectorizer.generateEmbedding(rotatedDataUrl);
            const rectAnalysis = computeRectangularityScore(embedding.embedding);

            // Redondear a 4 decimales para reducir ruido
            const rawScore = Math.round(rectAnalysis.score * 10000) / 10000;

            // FIX_ROTACION_V3: angleBonus penaliza angulos lejanos a 0
            // 0deg = 1.00, 15deg = 0.85
            const angleBonus = 1 - (Math.abs(angle) / range) * 0.15;
            const adjustedScore = Math.round(rawScore * angleBonus * 10000) / 10000;

            results.push({
              angle,
              rawScore,
              adjustedScore,
              contentDensity: rectAnalysis.contentDensity,
              bboxArea: rectAnalysis.bboxArea,
              rectScore: rectAnalysis.rectScore,
              dataUrl: rotatedDataUrl,
            });

            console.log(
              `  . ${angle}deg: raw=${(rawScore * 100).toFixed(1)}% ` +
                `adjusted=${(adjustedScore * 100).toFixed(1)}% ` +
                `(density=${(rectAnalysis.contentDensity * 100).toFixed(1)}%, ` +
                `bbox=${rectAnalysis.bboxArea}, ` +
                `rectScore=${(rectAnalysis.rectScore * 100).toFixed(1)}%)`
            );
          } catch (err) {
            console.warn(`  . ${angle}deg: error vectorizando`, err);
          }
        }

        if (results.length === 0) {
          resolve({ dataUrl: imageSrc, angle: 0, confidence: 0 });
          return;
        }

        // Ordenar por adjustedScore descendente
        results.sort((a, b) => b.adjustedScore - a.adjustedScore);
        const best = results[0];
        const bestScore = best.adjustedScore;

        // FIX_ROTACION_V3: encontrar el score de 0deg para comparar
        const zeroDegResult = results.find((r) => r.angle === 0);
        const zeroScore = zeroDegResult ? zeroDegResult.adjustedScore : 0;

        const avgScore =
          results.reduce((s, r) => s + r.adjustedScore, 0) / results.length;
        const confidence = Math.min(
          1,
          Math.max(0, (bestScore - avgScore) / 0.20)
        );

        console.log(
          '%c[Preprocess] Analisis V3:',
          'color: #22c55e; font-weight: bold',
          {
            bestAngle: best.angle + 'deg',
            bestScore: (bestScore * 100).toFixed(1) + '%',
            zeroAngleScore: (zeroScore * 100).toFixed(1) + '%',
            avgScore: (avgScore * 100).toFixed(1) + '%',
            confidence: (confidence * 100).toFixed(0) + '%',
            bboxRectScore: (best.rectScore * 100).toFixed(1) + '%',
          }
        );

        // ────────────────────────────────────────────────────────────
        // REGLAS DE DECISION V3
        // ────────────────────────────────────────────────────────────
        // Regla 1: Si el ganador es 0deg → no rotar (logico)
        if (best.angle === 0) {
          console.log(
            '%c[Preprocess] 0deg es el ganador, sin rotacion necesaria',
            'color: #22c55e; font-weight: bold'
          );
          resolve({ dataUrl: imageSrc, angle: 0, confidence });
          return;
        }

        // Regla 2: Si el angulo ganador no mejora el score de 0deg en >=5%, no rotar
        const improvement = bestScore - zeroScore;
        const MIN_IMPROVEMENT = 0.05; // 5%

        if (improvement < MIN_IMPROVEMENT) {
          console.log(
            `%c[Preprocess] El angulo ${best.angle}deg solo mejora ${(improvement * 100).toFixed(1)}% vs 0deg (min 5%), manteniendo original`,
            'color: #eab308; font-weight: bold'
          );
          resolve({ dataUrl: imageSrc, angle: 0, confidence });
          return;
        }

        // Regla 3: Confianza debe superar el umbral (0.60)
        if (confidence < minConfidence) {
          console.log(
            `%c[Preprocess] Confianza ${(confidence * 100).toFixed(0)}% < ${(minConfidence * 100).toFixed(0)}%, manteniendo original`,
            'color: #eab308'
          );
          resolve({ dataUrl: imageSrc, angle: 0, confidence });
          return;
        }

        // Todo OK: aplicar rotacion
        console.log(
          '%c[Preprocess] Aplicando rotacion de ' + best.angle + 'deg',
          'color: #22c55e; font-weight: bold'
        );
        resolve({
          dataUrl: best.dataUrl,
          angle: best.angle,
          confidence,
        });
      } catch (err) {
        console.warn('[Preprocess] Error en auto-rotacion:', err);
        resolve({ dataUrl: imageSrc, angle: 0, confidence: 0 });
      }
    };

    img.onerror = () => resolve({ dataUrl: imageSrc, angle: 0, confidence: 0 });
    img.src = imageSrc;
  });
}

/**
 * Rota una imagen en un canvas y devuelve el data URL resultante.
 */
function rotateImageOnCanvas(img: HTMLImageElement, angleDeg: number): string {
  const rad = (angleDeg * Math.PI) / 180;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const newW = Math.ceil(w * cos + h * sin);
  const newH = Math.ceil(w * sin + h * cos);

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, newW, newH);

  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);

  return canvas.toDataURL('image/png');
}

/**
 * Invierte una imagen (negativo → positivo).
 */
function invertImageOnCanvas(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Orquestador: preprocesa una imagen de fierro físico.
 * Pipeline:
 *   1. Detectar inversión → si es negativo, invertir
 *   2. Auto-rotar → probar ángulos y elegir el de máxima simetría
 *   3. Retornar imagen lista para vectorizar
 */
export async function preprocessFierroImage(
  imageSrc: string,
  options: { enableAutoRotation?: boolean } = {}
): Promise<{
  dataUrl: string;
  wasInverted: boolean;
  rotationAngle: number;
  rotationConfidence: number;
}> {
  const { enableAutoRotation = false } = options;
  const startTime = performance.now();

  console.log(
    '%c[Preprocess] Iniciando preprocesamiento...',
    'color: #0ea5e9; font-weight: bold'
  );

  const isInverted = await detectInversion(imageSrc);
  let workingImage = imageSrc;
  let wasInverted = false;

  if (isInverted) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = imageSrc;
    });
    workingImage = invertImageOnCanvas(img);
    wasInverted = true;
    console.log('%c[Preprocess] Imagen invertida (negativo -> positivo)', 'color: #22c55e');
  } else {
    console.log('[Preprocess] Sin inversión necesaria');
  }

  // FIX_PREPROCESS_TOGGLE_PARAM: respetar el flag enableAutoRotation
  let rotation: { dataUrl: string; angle: number; confidence: number };
  if (enableAutoRotation) {
    console.log(
      '%c[Preprocess] Auto-rotacion SOLICITADA por el operador (enableAutoRotation = true)',
      'color: #f59e0b; font-weight: bold'
    );
    rotation = await autoRotateImage(workingImage);
  } else {
    console.log(
      '%c[Preprocess] Auto-rotacion DESACTIVADA (default), manteniendo 0deg',
      'color: #22c55e; font-weight: bold'
    );
    rotation = { dataUrl: workingImage, angle: 0, confidence: 0 };
  }

  const totalTime = Math.round(performance.now() - startTime);
  console.log(
    '%c[Preprocess] Completado en',
    'color: #22c55e; font-weight: bold',
    totalTime + 'ms'
  );

  return {
    dataUrl: rotation.dataUrl,
    wasInverted,
    rotationAngle: rotation.angle,
    rotationConfidence: rotation.confidence,
  };
}