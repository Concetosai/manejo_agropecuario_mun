import type { ProducerData } from '../types';

/**
 * P4-QR · Verificación de Certificados por Código QR
 * ---------------------------------------------------------------------------
 * El QR impreso en el certificado codifica una URL pública de verificación:
 *
 *   https://<host>/?verificar=<token>
 *
 * donde <token> es un JSON compacto en Base64URL con los datos esenciales del
 * fierro y un checksum de integridad (no criptográfico, pero suficiente para
 * detectar manipulación accidental o corrupción del código).
 *
 * Ventajas del diseño autónomo (self-contained):
 *   - Cualquier celular con cámara abre la página de verificación, sin login.
 *   - No requiere columnas nuevas en la hoja de cálculo ni guardar el QR en
 *     Cloudinary (aunque es opcional hacerlo como respaldo).
 *   - El escáner dentro de la app lee la misma URL y abre el expediente.
 */

export interface VerificationData {
  v: number; // versión del formato
  f: string; // folio oficial (ej. PAN-2026-04290)
  r: string; // número de registro (ej. REG-HAYTO-4290)
  t: string; // titular
  c: string; // CURP
  p: string; // predio
  u: string; // clave UPP
  e: string; // fecha de expedición (YYYY-MM-DD)
  g: string; // vigencia (ej. 2026 - 2029)
  i?: string; // URL pública de la imagen del fierro (opcional, solo http/https)
  s: string; // checksum de integridad
}

const QR_SALT = 'PAN-2026-FIERRO-VERIF';

function canonical(d: Omit<VerificationData, 's'>): string {
  return [d.f, d.r, d.t, d.c, d.p, d.u, d.e, d.g, d.i || ''].join('|');
}

/** Checksum determinista (FNV-1a de 64 bits emulado) del contenido del QR. */
export function computeVerificationChecksum(d: Omit<VerificationData, 's'>): string {
  const input = `${QR_SALT}::${canonical(d)}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = (Math.imul(h2 ^ code, 0x85ebca6b) + code) >>> 0;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return (hex(h1) + hex(h2)).toUpperCase();
}

/** Construye el objeto de verificación a partir de los datos del productor. */
export function buildVerificationData(p: ProducerData): VerificationData {
  const imgCandidate = p.fierroImageUrl || p.certificadoImagenUrl || '';
  const img = /^https?:\/\//i.test(imgCandidate) ? imgCandidate : '';
  const base: Omit<VerificationData, 's'> = {
    v: 1,
    f: (p.folio || '').trim(),
    r: (p.registrationNumber || '').trim(),
    t: (p.fullName || '').trim(),
    c: (p.curp || '').trim().toUpperCase(),
    p: (p.propertyName || '').trim(),
    u: (p.uppKey || '').trim(),
    e: (p.issueDate || '').trim(),
    g: (p.validityRange || '').trim(),
    i: img,
  };
  return { ...base, s: computeVerificationChecksum(base) };
}

function base64UrlEncode(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}

export function encodeVerificationToken(data: VerificationData): string {
  return base64UrlEncode(JSON.stringify(data));
}

export function decodeVerificationToken(token: string): VerificationData | null {
  if (!token) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(token));
    if (parsed && typeof parsed === 'object' && typeof parsed.f === 'string') {
      return parsed as VerificationData;
    }
    return null;
  } catch {
    return null;
  }
}

/** Verifica que el checksum del payload coincida (integridad). */
export function isVerificationValid(data: VerificationData | null): boolean {
  if (!data || !data.s) return false;
  const { s, ...rest } = data;
  return computeVerificationChecksum(rest as Omit<VerificationData, 's'>) === s;
}

/** URL pública que se codifica dentro del QR. */
export function buildVerificationUrl(data: VerificationData, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/?verificar=${encodeVerificationToken(data)}`;
}

/** Devuelve el token ?verificar= de la URL actual, o null. */
export function getVerificationToken(search?: string): string | null {
  const source = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!source) return null;
  return new URLSearchParams(source).get('verificar');
}

/**
 * Extrae un folio a partir del texto escaneado (URL con token, JSON, token
 * Base64URL directo, o folio en texto plano). Usado por el escáner interno.
 */
export function extractFolioFromScan(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();

  // 1) URL con ?verificar=<token>
  const urlMatch = trimmed.match(/[?&]verificar=([^&\s]+)/);
  if (urlMatch) {
    const decoded = decodeVerificationToken(decodeURIComponent(urlMatch[1]));
    if (decoded?.f) return decoded.f.toUpperCase();
  }

  // 2) JSON directo
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.folio) return String(parsed.folio).toUpperCase();
    if (parsed?.f) return String(parsed.f).toUpperCase();
  } catch {
    /* no es JSON */
  }

  // 3) Token Base64URL directo
  const direct = decodeVerificationToken(trimmed);
  if (direct?.f) return direct.f.toUpperCase();

  // 4) Folios en texto plano (PAN-2026-00000 / REG-HAYTO-0000)
  const m1 = trimmed.match(/PAN-\d{4}-\d{5}/i);
  if (m1) return m1[0].toUpperCase();
  const m2 = trimmed.match(/\b(?:REG|PAN)[-_][A-Z0-9-]+\b/i);
  if (m2) return m2[0].toUpperCase();

  return null;
}

/** Enmascara parte de la CURP para mostrarla en la vista pública. */
export function maskCurp(curp: string): string {
  if (!curp || curp.length < 10) return curp || '';
  return `${curp.slice(0, 4)}******${curp.slice(10)}`;
}
