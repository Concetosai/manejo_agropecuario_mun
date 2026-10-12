/**
 * Mathematical Guilloché Security Patterns generator
 * Inspired by Texas Certificates, High-Security Land Titles, and Mexican Municipal Seals.
 * Uses hypotrochoids, epitrochoids, and harmonic sine waves.
 */

export function generateGuillocheRosettePath(
  cx: number,
  cy: number,
  R: number,      // Major radius
  r: number,      // Minor radius
  d: number,      // Pen offset
  steps = 360,
  revolutions = 6
): string {
  const points: Array<[number, number]> = [];
  const maxTheta = revolutions * 2 * Math.PI;
  const dTheta = maxTheta / steps;

  for (let theta = 0; theta <= maxTheta; theta += dTheta) {
    // Hypotrochoid formula:
    // x = (R - r) * cos(theta) + d * cos((R - r) * theta / r)
    // y = (R - r) * sin(theta) - d * sin((R - r) * theta / r)
    const k = (R - r) / r;
    const x = cx + (R - r) * Math.cos(theta) + d * Math.cos(k * theta);
    const y = cy + (R - r) * Math.sin(theta) - d * Math.sin(k * theta);
    points.push([x, y]);
  }

  if (points.length === 0) return '';
  let path = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i][0].toFixed(2)} ${points[i][1].toFixed(2)}`;
  }
  return path + ' Z';
}

export function generateGuillocheWavePath(
  width: number,
  height: number,
  lines = 24,
  frequency = 4,
  amplitude = 18
): string {
  let paths = '';
  const stepY = height / (lines + 1);

  for (let i = 1; i <= lines; i++) {
    const baseY = i * stepY;
    const phaseShift = (i / lines) * Math.PI * 2;
    let path = `M 0 ${(baseY + Math.sin(phaseShift) * amplitude).toFixed(2)}`;

    for (let x = 0; x <= width; x += 15) {
      const theta = (x / width) * Math.PI * 2 * frequency + phaseShift;
      const y = baseY + Math.sin(theta) * amplitude + Math.cos(theta * 1.5) * (amplitude * 0.35);
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    paths += ` ${path}`;
  }

  return paths;
}

export function drawGuillocheBorderOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin = 20
) {
  ctx.save();

  // Outer primary hairline
  ctx.strokeStyle = '#831843'; // Burgundy
  ctx.lineWidth = 1.5;
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

  // Inner gold hairline
  ctx.strokeStyle = '#d97706'; // Gold/Amber
  ctx.lineWidth = 1.0;
  ctx.strokeRect(margin + 5, margin + 5, width - (margin + 5) * 2, height - (margin + 5) * 2);

  // Imperial green frame
  ctx.strokeStyle = '#15803d'; // Imperial Green
  ctx.lineWidth = 0.75;
  ctx.strokeRect(margin + 9, margin + 9, width - (margin + 9) * 2, height - (margin + 9) * 2);

  // Corner rosettes
  const cornerRadius = 35;
  const corners = [
    { cx: margin + cornerRadius, cy: margin + cornerRadius },
    { cx: width - margin - cornerRadius, cy: margin + cornerRadius },
    { cx: margin + cornerRadius, cy: height - margin - cornerRadius },
    { cx: width - margin - cornerRadius, cy: height - margin - cornerRadius },
  ];

  corners.forEach(({ cx, cy }) => {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(131, 24, 67, 0.4)';
    ctx.lineWidth = 0.5;

    // Draw small rosette in corner
    for (let t = 0; t < Math.PI * 4; t += 0.08) {
      const r = 24 * Math.cos(5 * t);
      const x = cx + r * Math.cos(t);
      const y = cy + r * Math.sin(t);
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  });

  ctx.restore();
}
