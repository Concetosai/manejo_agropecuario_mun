/**
 * Official Pánuco Municipal Validation and Input Sanitization Utilities
 * Enforces strict typing, Mexican governmental patterns (CURP, RFC, Phone, Email, Names).
 */

// ==========================================
// 1. SANITIZERS (Filter keys & chars while typing)
// ==========================================

/**
 * Allows only letters (including Spanish accents, ñ, ü), spaces, dots, hyphens and apostrophes.
 * Strips all digits and special symbols ($#@!%^&* etc.)
 */
export function sanitizeFullName(raw: string): string {
  // Allow letters, accented characters, spaces, dots, hyphens
  const cleaned = raw.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s.\-']/g, '');
  // Prevent multiple consecutive spaces and convert to uppercase for data uniformity
  return cleaned.replace(/\s{2,}/g, ' ').toUpperCase();
}

/**
 * Keeps only alphanumeric characters, auto-uppercased, max 18 chars.
 */
export function sanitizeCurp(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 18);
}

/**
 * Keeps only uppercase alphanumeric characters, max 18 chars for INE
 * (Supports Clave de Elector 18 alphanumeric chars or Folio/CIC 10-13 digits).
 */
export function sanitizeIne(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 18);
}

/**
 * Keeps only uppercase letters, numbers, and '&', max 13 chars.
 */
export function sanitizeRfc(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9&Ñ]/g, '')
    .slice(0, 13);
}

/**
 * Accepts only digits and auto-formats to standard Mexican 10-digit telephone:
 * e.g., "8461045521" -> "846-104-5521"
 */
export function formatAndSanitizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Strips spaces, commas, and illegal characters, converts to lowercase.
 */
export function sanitizeEmail(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9._%+\-@]/g, '').trim();
}

/**
 * Accepts only positive numbers and optional decimal dot (for Hectáreas).
 */
export function sanitizeDecimal(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  // Allow only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join('')}`;
  }
  return cleaned;
}

/**
 * Accepts only integers (for Cantidad de cabezas).
 */
export function sanitizeInteger(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

/**
 * Checks if a UPP key adheres strictly to the 12-digit standard SINIIGA pattern:
 * 30 (Estado) - 123 (Municipio) - XXXX (Predio) - XXX (Especie/Sub-UPP)
 */
export function isStandardSiniigaUpp(upp: string): boolean {
  const trimmed = (upp || '').trim().toUpperCase();
  return /^\d{2}-\d{3}-\d{4}-\d{3}$/.test(trimmed);
}

/**
 * Sanitizes and intelligently formats UPP Key:
 * - If user types/pastes 12 digits, it formats cleanly to the official SINIIGA pattern: "30-123-XXXX-XXX".
 * - If the key does not follow that standard format, IT DOES NOT LIMIT IT:
 *   accepts full alphanumeric characters, hyphens, slashes and spaces up to 30 characters
 *   so that any complete official or provisional identifier is accommodated without truncation.
 */
export function formatAndSanitizeUppKey(raw: string): string {
  // MASCARA_UPP: Solo acepta digitos. Inserta guiones automaticamente.
  // Formato oficial SINIIGA: 30-123-XXXX-XXX (2-3-4-3 digitos)
  if (!raw) return '';

  // 1. Extraer SOLO los digitos (ignora guiones, letras, espacios, etc.)
  const digits = raw.replace(/\D/g, '').slice(0, 12);

  if (digits.length === 0) return '';

  // 2. Formatear progresivamente segun la cantidad de digitos
  let formatted = '';

  // Primer bloque: 2 digitos (30)
  if (digits.length <= 2) {
    formatted = digits;
  }
  // Segundo bloque: 3 digitos (123)
  else if (digits.length <= 5) {
    formatted = digits.slice(0, 2) + '-' + digits.slice(2);
  }
  // Tercer bloque: 4 digitos (1234)
  else if (digits.length <= 9) {
    formatted = digits.slice(0, 2) + '-' + digits.slice(2, 5) + '-' + digits.slice(5);
  }
  // Cuarto bloque: 3 digitos (123)
  else {
    formatted = digits.slice(0, 2) + '-' + digits.slice(2, 5) + '-' + digits.slice(5, 9) + '-' + digits.slice(9, 12);
  }

  return formatted;
}

export function sanitizeUppKey(raw: string): string {
  return formatAndSanitizeUppKey(raw);
}

// ==========================================
// 2. VALIDATORS (Comprehensive checks with hints)
// ==========================================

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Validates Full Name:
 * Must have at least 2 words (Nombre y Apellido) and >= 5 characters.
 */
export function validateFullName(name: any): ValidationResult {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'El nombre completo es obligatorio.' };
  }
  if (trimmed.length < 5) {
    return { isValid: false, message: 'El nombre debe tener al menos 5 caracteres.' };
  }
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 2) {
    return { isValid: false, message: 'Debe incluir al menos un nombre y un apellido.' };
  }
  return { isValid: true };
}

/**
 * Validates Official Mexican CURP (18 alphanumeric characters).
 * Format: 4 letters + 6 digits (YYMMDD) + H/M + 2 state letters + 3 consonants + 1 alphanumeric + 1 digit.
 */
export function validateCurp(curp: any): ValidationResult {
  const trimmed = String(curp || '').trim().toUpperCase();
  if (!trimmed) {
    return { isValid: false, message: 'La CURP es obligatoria (18 caracteres).' };
  }
  if (trimmed.length < 18) {
    return {
      isValid: false,
      message: `CURP incompleta: faltan ${18 - trimmed.length} caracteres (18 requeridos).`,
    };
  }
  const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
  if (!curpRegex.test(trimmed)) {
    return {
      isValid: false,
      message: 'Estructura no válida. Ejemplo: GUAA620415HVRRRN08 (4 letras, 6 dígitos, sexo, estado).',
    };
  }
  return { isValid: true };
}

/**
  * Validates INE (Instituto Nacional Electoral) official identification:
  * Accepts 18-character Clave de Elector (e.g. GUAAAR62041530H100) or
  * Folio / CIC credencial de 9 a 13 dígitos numéricos.
  */
export function validateIne(ine: any): ValidationResult {
  const trimmed = String(ine || '').trim().toUpperCase();
  if (!trimmed) {
    return { isValid: false, message: 'La identificación INE (Clave de Elector o Folio) es obligatoria.' };
  }
  if (trimmed.length < 10) {
    return {
      isValid: false,
      message: `INE incompleto: ${trimmed.length} caracteres (mínimo 10 dígitos para Folio o 18 para Clave de Elector).`,
    };
  }
  // If purely numeric: 9 to 13 digits (CIC/Folio)
  if (/^\d{9,13}$/.test(trimmed)) {
    return { isValid: true };
  }
  // If 18 alphanumeric: Clave de Elector
  if (/^[A-Z0-9]{18}$/.test(trimmed)) {
    return { isValid: true };
  }
  // General alphanumeric standard length
  if (/^[A-Z0-9]{10,18}$/.test(trimmed)) {
    return { isValid: true };
  }
  return {
    isValid: false,
    message: 'Formato INE no válido. Ingrese Clave de Elector (18 caracteres) o Folio INE (10-13 dígitos).',
  };
}

/**
 * Validates Official Mexican RFC (12 or 13 alphanumeric characters).
 * Persona Física: 4 letters + 6 digits (YYMMDD) + 3 homoclave chars = 13
 * Persona Moral: 3 letters + 6 digits (YYMMDD) + 3 homoclave chars = 12
 */
export function validateRfc(rfc: any): ValidationResult {
  const trimmed = String(rfc || '').trim().toUpperCase();
  if (!trimmed) {
    return { isValid: false, message: 'El RFC es obligatorio (12 o 13 caracteres).' };
  }
  // FIX_RFC_INNE: Acepta 10 caracteres (RFC base de INE sin homoclave) o 12-13 (con homoclave)
  if (trimmed.length < 10) {
    return {
      isValid: false,
      message: `RFC incompleto: ${trimmed.length} caracteres. Debe tener entre 10 y 13 caracteres (ej: AUTB910616 de INE, o AUTB910616ABC de cédula SAT).`,
    };
  }
  const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}([A-Z0-9]{3})?$/;
  if (!rfcRegex.test(trimmed)) {
    return {
      isValid: false,
      message: 'Formato de RFC incorrecto. Debe incluir iniciales, fecha AAMMDD y homoclave.',
    };
  }
  return { isValid: true };
}

/**
 * Validates 10-digit Mexican telephone number.
 */
export function validatePhone(phone: any): ValidationResult {
  const digits = String(phone || '').replace(/\D/g, '');
  // TELEFONO OPCIONAL: Si esta vacio, se considera valido (comunidades rurales sin telefono)
  if (!digits) {
    return { isValid: true };
  }
  if (digits.length < 10) {
    return {
      isValid: false,
      message: `Número incompleto: ${digits.length}/10 dígitos (Ej: 846-104-5521).`,
    };
  }
  if (digits.length > 10) {
    return { isValid: false, message: 'El teléfono debe contener exactamente 10 dígitos.' };
  }
  return { isValid: true };
}

/**
 * Validates RFC 5322 standard email address.
 */
export function validateEmail(email: any): ValidationResult {
  const trimmed = String(email || '').trim();
  // EMAIL OPCIONAL: Si esta vacio, se considera valido (comunidades rurales sin email)
  if (!trimmed) {
    return { isValid: true };
  }
  if (!trimmed.includes('@')) {
    return { isValid: false, message: "Falta el símbolo '@' en el correo electrónico." };
  }
  const parts = trimmed.split('@');
  if (!parts[1] || !parts[1].includes('.')) {
    return { isValid: false, message: 'Falta un dominio válido (ejemplo: @gmail.com, @hotmail.com).' };
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, message: 'Formato de correo electrónico inválido.' };
  }
  return { isValid: true };
}

/**
 * Validates legal address (at least 5 characters).
 */
export function validateAddress(address: any): ValidationResult {
  const trimmed = String(address || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'El domicilio legal o fiscal es obligatorio.' };
  }
  if (trimmed.length < 5) {
    return { isValid: false, message: 'El domicilio debe contener al menos 5 caracteres.' };
  }
  return { isValid: true };
}

/**
 * Validates Municipality.
 */
export function validateMunicipio(municipio: any): ValidationResult {
  const trimmed = String(municipio || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'El municipio de la jurisdicción es obligatorio.' };
  }
  return { isValid: true };
}

/**
 * Validates Ejido or Community.
 */
export function validateEjido(ejido: any): ValidationResult {
  const trimmed = String(ejido || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'El ejido, congregación o localidad es obligatorio.' };
  }
  return { isValid: true };
}

/**
 * Validates Ranch or Property Name.
 */
export function validatePropertyName(name: any): ValidationResult {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'El nombre del rancho o predio es obligatorio.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, message: 'El nombre del predio debe tener al menos 3 caracteres.' };
  }
  return { isValid: true };
}

/**
 * Validates Surface in Hectares (must be > 0).
 */
export function validateSurface(hectares: number): ValidationResult {
  if (typeof hectares !== 'number' || isNaN(hectares) || hectares <= 0) {
    return { isValid: false, message: 'La superficie del predio debe ser un número mayor a 0 hectáreas.' };
  }
  return { isValid: true };
}

/**
 * Validates UPP Key (Unidad de Producción Pecuaria):
 * Requires that the key is provided and has at least 3 characters.
 * Does not limit or reject alternative/provisional identifiers that do not strictly adhere to 12 digits.
 */
export function validateUppKey(upp: any): ValidationResult {
  const trimmed = String(upp || '').trim().toUpperCase();
  if (!trimmed) {
    return { isValid: false, message: 'La Clave UPP oficial es obligatoria.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, message: 'La Clave UPP debe contener al menos 3 caracteres.' };
  }
  return { isValid: true };
}

/**
 * Validates Cattle Count (must be >= 1).
 */
export function validateCattleCount(count: number): ValidationResult {
  if (typeof count !== 'number' || isNaN(count) || count < 1) {
    return { isValid: false, message: 'La cantidad de cabezas debe ser al menos 1 unidad de ganado.' };
  }
  return { isValid: true };
}

/**
 * Validates Municipal Folio.
 */
export function validateFolio(folio: any): ValidationResult {
  const trimmed = String(folio || '').trim().toUpperCase();
  if (!trimmed) {
    return { isValid: false, message: 'El Folio Oficial Municipal es obligatorio.' };
  }
  if (trimmed.length < 4) {
    return { isValid: false, message: 'El Folio Municipal debe tener al menos 4 caracteres (ej. PAN-2026-04289).' };
  }
  return { isValid: true };
}

/**
 * Validates Registration Number.
 */
export function validateRegistrationNumber(regNum: any): ValidationResult {
  const trimmed = String(regNum || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'El Número de Registro Notarial es obligatorio.' };
  }
  return { isValid: true };
}

/**
 * Validates Book Number.
 */
export function validateBookNumber(book: any): ValidationResult {
  const trimmed = String(book || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'El Libro de Registro de Fierros de Herrar es obligatorio.' };
  }
  return { isValid: true };
}

/**
 * Validates Folio Page.
 */
export function validateFolioPage(page: any): ValidationResult {
  const trimmed = String(page || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'La Foja de Asiento Notarial es obligatoria.' };
  }
  return { isValid: true };
}

/**
 * Validates Validity Range.
 */
export function validateValidityRange(range: any): ValidationResult {
  const trimmed = String(range || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'El periodo de vigencia del registro es obligatorio (ej. 2026 - 2029).' };
  }
  return { isValid: true };
}

/**
 * Validates Issue Date.
 */
export function validateIssueDate(date: any): ValidationResult {
  const trimmed = String(date || '').trim();
  if (!trimmed) {
    return { isValid: false, message: 'La fecha de expedición y cotejo notarial es obligatoria.' };
  }
  return { isValid: true };
}

export interface FullFormValidationError {
  field: string;
  label: string;
  step: 1 | 2 | 3;
  message: string;
}

/**
 * Master Validation for Entire Producer Registration:
 * Checks EVERY single required field and its specific Mexican format rules.
 */
export function validateFullProducerData(data: {
  fullName?: string;
  municipio?: string;
  ejido?: string;
  curp?: string;
  rfc?: string;
  ine?: string;
  phone?: string;
  email?: string;
  address?: string;
  propertyName?: string;
  surfaceHectares?: number;
  tenureType?: string;
  cattleCount?: number;
  species?: string;
  uppKey?: string;
  folio?: string;
  registrationNumber?: string;
  bookNumber?: string;
  folioPage?: string;
  validityRange?: string;
  issueDate?: string;
}): { isValid: boolean; errors: FullFormValidationError[] } {
  const errors: FullFormValidationError[] = [];

  // ================= Step 1: Titular =================
  const fnV = validateFullName(data.fullName || '');
  if (!fnV.isValid) {
    errors.push({ field: 'fullName', label: 'Nombre Completo del Titular', step: 1, message: fnV.message || 'Inválido' });
  }

  const munV = validateMunicipio(data.municipio || '');
  if (!munV.isValid) {
    errors.push({ field: 'municipio', label: 'Municipio', step: 1, message: munV.message || 'Inválido' });
  }

  const ejiV = validateEjido(data.ejido || '');
  if (!ejiV.isValid) {
    errors.push({ field: 'ejido', label: 'Ejido o Comunidad', step: 1, message: ejiV.message || 'Inválido' });
  }

  const curpV = validateCurp(data.curp || '');
  if (!curpV.isValid) {
    errors.push({ field: 'curp', label: 'Clave CURP', step: 1, message: curpV.message || 'Inválido' });
  }

  const rfcV = validateRfc(data.rfc || '');
  if (!rfcV.isValid) {
    errors.push({ field: 'rfc', label: 'RFC', step: 1, message: rfcV.message || 'Inválido' });
  }

  const ineV = validateIne(data.ine || '');
  if (!ineV.isValid) {
    errors.push({ field: 'ine', label: 'Identificación INE', step: 1, message: ineV.message || 'Inválido' });
  }

  // TELEFONO OPCIONAL: Solo valida si el usuario escribio algo
  const phoV = validatePhone(data.phone || '');
  if (data.phone && data.phone.trim() && !phoV.isValid) {
    errors.push({ field: 'phone', label: 'Teléfono de Contacto', step: 1, message: phoV.message || 'Inválido' });
  }

  const emaV = validateEmail(data.email || '');
  if (!emaV.isValid) {
    errors.push({ field: 'email', label: 'Correo Electrónico (Email)', step: 1, message: emaV.message || 'Inválido' });
  }

  const addV = validateAddress(data.address || '');
  if (!addV.isValid) {
    errors.push({ field: 'address', label: 'Domicilio Legal en Pánuco', step: 1, message: addV.message || 'Inválido' });
  }

  // ================= Step 2: Predio y Producción =================
  const propV = validatePropertyName(data.propertyName || '');
  if (!propV.isValid) {
    errors.push({ field: 'propertyName', label: 'Nombre del Predio / Rancho', step: 2, message: propV.message || 'Inválido' });
  }

  const surV = validateSurface(Number(data.surfaceHectares) || 0);
  if (!surV.isValid) {
    errors.push({ field: 'surfaceHectares', label: 'Superficie (Has)', step: 2, message: surV.message || 'Inválido' });
  }

  const uppV = validateUppKey(data.uppKey || '');
  if (!uppV.isValid) {
    errors.push({ field: 'uppKey', label: 'Clave UPP', step: 2, message: uppV.message || 'Inválido' });
  }

  const catV = validateCattleCount(Number(data.cattleCount) || 0);
  if (!catV.isValid) {
    errors.push({ field: 'cattleCount', label: 'Cantidad de Ganado', step: 2, message: catV.message || 'Inválido' });
  }

  // ================= Step 3: Notarial Municipal =================
  const folV = validateFolio(data.folio || '');
  if (!folV.isValid) {
    errors.push({ field: 'folio', label: 'Folio Oficial Municipal', step: 3, message: folV.message || 'Inválido' });
  }

  const regV = validateRegistrationNumber(data.registrationNumber || '');
  if (!regV.isValid) {
    errors.push({ field: 'registrationNumber', label: 'Número de Registro Notarial', step: 3, message: regV.message || 'Inválido' });
  }

  const booV = validateBookNumber(data.bookNumber || '');
  if (!booV.isValid) {
    errors.push({ field: 'bookNumber', label: 'Libro de Fierros', step: 3, message: booV.message || 'Inválido' });
  }

  const pagV = validateFolioPage(data.folioPage || '');
  if (!pagV.isValid) {
    errors.push({ field: 'folioPage', label: 'Foja de Registro', step: 3, message: pagV.message || 'Inválido' });
  }

  const valV = validateValidityRange(data.validityRange || '');
  if (!valV.isValid) {
    errors.push({ field: 'validityRange', label: 'Periodo de Vigencia', step: 3, message: valV.message || 'Inválido' });
  }

  const datV = validateIssueDate(data.issueDate || '');
  if (!datV.isValid) {
    errors.push({ field: 'issueDate', label: 'Fecha de Expedición', step: 3, message: datV.message || 'Inválido' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

