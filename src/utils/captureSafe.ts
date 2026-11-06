import html2canvas from 'html2canvas-pro';

export async function captureElementSafe(
  element: HTMLElement,
  options: { backgroundColor?: string } = {}
): Promise<HTMLCanvasElement> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  await new Promise((r) => setTimeout(r, 300));

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.left = '-100000px';
  clone.style.top = '0';
  clone.style.overflow = 'visible';
  clone.style.maxWidth = 'none';
  
  if (element.classList.contains('print-page-letter')) {
    clone.style.width = '800px';
    clone.style.height = '1040px';
    clone.style.minWidth = '800px';
    clone.style.minHeight = '1040px';
    clone.style.display = 'flex';
    clone.style.flexDirection = 'column';
  } else {
    clone.style.width = element.offsetWidth + 'px';
  }

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
      windowWidth: 800,
      windowHeight: 1040,
    });
  } finally {
    if (clone.parentNode) clone.parentNode.removeChild(clone);
  }
}