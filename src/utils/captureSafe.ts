import html2canvas from 'html2canvas-pro';

/**
 * Captura un elemento HTML a canvas de forma segura para certificados oficiales.
 * - Espera a que TODAS las fuentes (Cinzel, Playfair, JetBrains Mono) estén listas.
 * - Clona el nodo off-screen para no alterar el DOM real (local se ve idéntico).
 * - Fuerza scale basado en devicePixelRatio para que los bordes finos no se pierdan.
 * - Quita overflow-hidden en el clon para que el SVG inline no se recorte.
 */
export async function captureElementSafe(
  element: HTMLElement,
  options: { backgroundColor?: string } = {}
): Promise<HTMLCanvasElement> {
  // 1. Esperar fuentes
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  // 2. Margen para que el SVG inline se pinte y las imágenes carguen
  await new Promise((r) => setTimeout(r, 300));

  // 3. Clonar el nodo para no alterar el DOM real
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.left = '-100000px';
  clone.style.top = '0';
  clone.style.overflow = 'visible';
  clone.style.maxWidth = 'none';
  clone.style.width = element.offsetWidth + 'px';
  clone.style.zIndex = '-1';
  clone.style.pointerEvents = 'none';
  document.body.appendChild(clone);

  try {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(2, dpr * 2);

    return await html2canvas(clone, {
      scale,
      backgroundColor: options.backgroundColor || '#faf7ef',
      useCORS: true,
      logging: false,
      allowTaint: false,
      windowWidth: clone.scrollWidth,
      windowHeight: clone.scrollHeight,
    });
  } finally {
    if (clone.parentNode) clone.parentNode.removeChild(clone);
  }
}
