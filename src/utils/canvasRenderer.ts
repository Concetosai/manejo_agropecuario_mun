import { BrandConfig, TraditionalSymbol } from '../types';

export interface RenderOptions {
  background?: 'transparent' | 'white' | 'parchment' | 'leather';
  showShadow?: boolean;
  resolutionScale?: number; // default 1
}

export function renderBrandToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: BrandConfig,
  options: RenderOptions = {}
) {
  const { background = 'transparent', showShadow = false, resolutionScale = 1 } = options;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Draw Background if requested
  if (background === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  } else if (background === 'parchment') {
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, width, height);
    // Subtle parchment texture
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.08)';
    ctx.strokeRect(10, 10, width - 20, height - 20);
  } else if (background === 'leather') {
    ctx.fillStyle = '#451a03'; // deep saddle leather
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Setup Forge styling & colors
  let primaryStroke = '#171717'; // default forja negra
  let glowColor = 'transparent';
  let glowBlur = 0;

  if (config.finish === 'candente') {
    primaryStroke = '#ef4444'; // glowing red
    glowColor = '#f97316';
    glowBlur = 12;
  } else if (config.finish === 'oxido') {
    primaryStroke = '#78350f'; // rust patina
  } else if (config.finish === 'plata') {
    primaryStroke = '#475569'; // burnished steel
  }

  if (background === 'leather') {
    // Brand burnt into leather
    primaryStroke = '#1a0d05';
    glowColor = 'rgba(234, 88, 12, 0.3)';
    glowBlur = 6;
  }

  ctx.strokeStyle = primaryStroke;
  ctx.fillStyle = primaryStroke;
  ctx.lineWidth = (config.strokeWidth || 12) * resolutionScale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (showShadow) {
    ctx.shadowColor = glowBlur > 0 ? glowColor : 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = glowBlur > 0 ? glowBlur : 6;
    ctx.shadowOffsetX = glowBlur > 0 ? 0 : 2;
    ctx.shadowOffsetY = glowBlur > 0 ? 0 : 3;
  }

  const cx = width / 2;
  const cy = height / 2;

  ctx.save();
  ctx.translate(cx, cy);

  // Apply Brand Orientation Transformations
  if (config.orientation === 'echado') {
    ctx.rotate(-Math.PI / 2); // -90 deg
  } else if (config.orientation === 'invertido') {
    ctx.scale(-1, 1); // Mirrored horizontal
  } else if (config.orientation === 'inclinado') {
    ctx.rotate((config.slantAngle || 45) * (Math.PI / 180));
  }

  // 3. Draw Outer Ring if enabled
  if (config.hasOuterRing) {
    const ringRadius = Math.min(width, height) * 0.44;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 4. Draw Traditional Top Symbol
  const topY = -height * 0.28;
  drawSymbol(ctx, config.topSymbol, 0, topY, width * 0.22, 'top');

  // 5. Draw Initials / Monogram
  const initials = (config.initials || 'P').toUpperCase();
  const fontSize = Math.min(width, height) * (initials.length > 2 ? 0.36 : 0.44);

  ctx.font = `900 ${fontSize}px "Cinzel", "Playfair Display", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textY = (config.topSymbol !== 'none' ? 10 : 0) + (config.bottomSymbol !== 'none' ? -10 : 0);

  if (config.orientation === 'enlazado' && initials.length > 1) {
    // Interlocked Monogram Effect: draw with overlap and connecting forge crossbar
    const spacing = fontSize * 0.52;
    const startX = -((initials.length - 1) * spacing) / 2;

    // Draw connecting forge bar behind letters
    ctx.beginPath();
    ctx.moveTo(startX - 20, textY);
    ctx.lineTo(startX + (initials.length - 1) * spacing + 20, textY);
    ctx.stroke();

    for (let i = 0; i < initials.length; i++) {
      const charX = startX + i * spacing;
      ctx.strokeText(initials[i], charX, textY);
      ctx.fillText(initials[i], charX, textY);
    }
  } else {
    // Standard bold forged letters
    ctx.strokeText(initials, 0, textY);
    ctx.fillText(initials, 0, textY);
  }

  // 6. Draw Traditional Bottom Symbol
  const bottomY = height * 0.30;
  drawSymbol(ctx, config.bottomSymbol, 0, bottomY, width * 0.24, 'bottom');

  // 7. Draw Terminal Spurs if enabled
  if (config.hasSpurs) {
    ctx.beginPath();
    ctx.moveTo(-width * 0.26, textY + fontSize * 0.28);
    ctx.lineTo(-width * 0.32, textY + fontSize * 0.36);
    ctx.moveTo(width * 0.26, textY + fontSize * 0.28);
    ctx.lineTo(width * 0.32, textY + fontSize * 0.36);
    ctx.stroke();
  }

  ctx.restore();

  // 8. Render Freehand User Drawing Paths if present
  if (config.freehandPaths && config.freehandPaths.length > 0) {
    ctx.save();
    for (const path of config.freehandPaths) {
      if (!path.points || path.points.length < 2) continue;
      ctx.beginPath();
      ctx.lineWidth = (path.strokeWidth || config.strokeWidth) * resolutionScale;
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: TraditionalSymbol,
  x: number,
  y: number,
  size: number,
  position: 'top' | 'bottom'
) {
  if (symbol === 'none') return;

  ctx.save();
  ctx.translate(x, y);

  switch (symbol) {
    case 'corona': {
      // 3-point crown with circular jewels
      const w = size * 1.4;
      const h = size * 0.8;
      ctx.beginPath();
      // Base line
      ctx.moveTo(-w / 2, h / 2);
      ctx.lineTo(w / 2, h / 2);
      // Right peak
      ctx.lineTo(w / 2, -h / 2 + 5);
      // Right inner valley
      ctx.lineTo(w / 4, 0);
      // Center higher peak
      ctx.lineTo(0, -h / 2 - 10);
      // Left inner valley
      ctx.lineTo(-w / 4, 0);
      // Left peak
      ctx.lineTo(-w / 2, -h / 2 + 5);
      ctx.closePath();
      ctx.stroke();

      // Top decorative spheres
      [-w / 2, 0, w / 2].forEach((px, idx) => {
        const py = idx === 1 ? -h / 2 - 12 : -h / 2 + 4;
        ctx.beginPath();
        ctx.arc(px, py, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }

    case 'cruz': {
      // Ganadera Cross (Cross Patée / flared arms)
      const arm = size * 0.7;
      ctx.beginPath();
      // Vertical bar
      ctx.moveTo(0, -arm);
      ctx.lineTo(0, arm);
      // Horizontal bar
      ctx.moveTo(-arm * 0.8, -arm * 0.15);
      ctx.lineTo(arm * 0.8, -arm * 0.15);
      ctx.stroke();

      // Flared tips
      const tip = size * 0.2;
      ctx.beginPath();
      ctx.moveTo(-tip, -arm);
      ctx.lineTo(tip, -arm);
      ctx.moveTo(-arm * 0.8, -arm * 0.15 - tip);
      ctx.lineTo(-arm * 0.8, -arm * 0.15 + tip);
      ctx.moveTo(arm * 0.8, -arm * 0.15 - tip);
      ctx.lineTo(arm * 0.8, -arm * 0.15 + tip);
      ctx.stroke();
      break;
    }

    case 'estrella': {
      // 5-point star
      const spikes = 5;
      const outerRadius = size * 0.65;
      const innerRadius = size * 0.28;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        let px = Math.cos(rot) * outerRadius;
        let py = Math.sin(rot) * outerRadius;
        ctx.lineTo(px, py);
        rot += step;

        px = Math.cos(rot) * innerRadius;
        py = Math.sin(rot) * innerRadius;
        ctx.lineTo(px, py);
        rot += step;
      }
      ctx.lineTo(0, -outerRadius);
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'medialuna': {
      // Crescent Moon Cradle (Facing upward)
      const r = size * 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0.15 * Math.PI, 0.85 * Math.PI, false);
      ctx.stroke();

      // Curved tips
      ctx.beginPath();
      ctx.arc(-r * Math.cos(0.15 * Math.PI), r * Math.sin(0.15 * Math.PI), 8, 0, Math.PI * 2);
      ctx.arc(r * Math.cos(0.15 * Math.PI), r * Math.sin(0.15 * Math.PI), 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'barra': {
      // Solid Cattle Stabilizer Forge Bar
      const len = size * 1.5;
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 2, 0);
      ctx.stroke();
      break;
    }

    case 'doble_barra': {
      // Double stabilizer bar
      const len = size * 1.4;
      ctx.beginPath();
      ctx.moveTo(-len / 2, -10);
      ctx.lineTo(len / 2, -10);
      ctx.moveTo(-len / 2, 10);
      ctx.lineTo(len / 2, 10);
      ctx.stroke();
      break;
    }

    case 'herradura': {
      // Base Horseshoe
      const r = size * 0.65;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0.8 * Math.PI, 0.2 * Math.PI, true);
      ctx.stroke();

      // Left heel & right heel
      ctx.beginPath();
      ctx.moveTo(-r * Math.cos(0.2 * Math.PI), r * Math.sin(0.2 * Math.PI));
      ctx.lineTo(-r * Math.cos(0.2 * Math.PI) - 10, r * Math.sin(0.2 * Math.PI) + 10);
      ctx.moveTo(r * Math.cos(0.2 * Math.PI), r * Math.sin(0.2 * Math.PI));
      ctx.lineTo(r * Math.cos(0.2 * Math.PI) + 10, r * Math.sin(0.2 * Math.PI) + 10);
      ctx.stroke();
      break;
    }

    case 'gancho_izq': {
      // Curved forge hook to the left
      const len = size * 1.2;
      ctx.beginPath();
      ctx.moveTo(len / 2, 0);
      ctx.lineTo(-len / 3, 0);
      ctx.bezierCurveTo(-len / 2, 0, -len / 2, -size * 0.6, -len / 3, -size * 0.6);
      ctx.stroke();
      break;
    }

    case 'gancho_der': {
      // Curved forge hook to the right
      const len = size * 1.2;
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 3, 0);
      ctx.bezierCurveTo(len / 2, 0, len / 2, -size * 0.6, len / 3, -size * 0.6);
      ctx.stroke();
      break;
    }

    case 'flecha': {
      // Spear / Arrowhead
      const h = size * 0.8;
      const w = size * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(0, -h * 0.3);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'flor_lis': {
      // Heraldic Fleur-de-lis
      const h = size * 0.8;
      ctx.beginPath();
      // Center leaf
      ctx.moveTo(0, -h);
      ctx.quadraticCurveTo(size * 0.25, -h * 0.3, 0, 0);
      ctx.quadraticCurveTo(-size * 0.25, -h * 0.3, 0, -h);
      // Horizontal band
      ctx.moveTo(-size * 0.4, -h * 0.2);
      ctx.lineTo(size * 0.4, -h * 0.2);
      // Left curl
      ctx.moveTo(0, -h * 0.2);
      ctx.quadraticCurveTo(-size * 0.5, -h * 0.5, -size * 0.4, 0);
      // Right curl
      ctx.moveTo(0, -h * 0.2);
      ctx.quadraticCurveTo(size * 0.5, -h * 0.5, size * 0.4, 0);
      ctx.stroke();
      break;
    }

    case 'circulo': {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

/**
 * Returns a high-resolution PNG data URL for printing or exporting
 */
export function getBrandDataUrl(config: BrandConfig, size = 1024): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  renderBrandToCanvas(ctx, size, size, config, {
    background: 'transparent',
    showShadow: false,
    resolutionScale: size / 400,
  });

  return canvas.toDataURL('image/png');
}
