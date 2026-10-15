export type TraditionalSymbol = 
  | 'none'
  | 'corona'        // Corona superior (3 puntas)
  | 'cruz'          // Cruz ganadera
  | 'estrella'      // Estrella central
  | 'medialuna'     // Media luna base
  | 'barra'         // Barra / Raya inferior
  | 'doble_barra'   // Doble barra estabilizadora
  | 'gancho_izq'    // Gancho forjado izquierdo
  | 'gancho_der'    // Gancho forjado derecho
  | 'herradura'     // Herradura en la base
  | 'flecha'        // Punta de flecha superior
  | 'flor_lis'      // Flor de lis
  | 'circulo';      // Aro exterior

export type BrandOrientation = 
  | 'normal'        // Vertical tradicional
  | 'enlazado'      // Monograma fundido/entrelazado
  | 'echado'        // Inclinado -90° (horizontal tradicional)
  | 'invertido'     // Reflejado horizontalmente
  | 'inclinado';    // Inclinado 45°

export type FinishStyle = 
  | 'forja_negra'   // Hierro forjado negro tradicional
  | 'candente'      // Hierro al rojo vivo
  | 'oxido'         // Pátina rústica envejecida
  | 'plata';        // Acero templado

// Catalogos Oficiales Reglamentarios de Pánuco, Ver.
export type TenureType = 'EJIDAL' | 'PROPIEDAD';

export type AssociatedRancherOption = 'NO' | 'SÍ';

export type LivestockSpecies = 
  | 'BOVINO'
  | 'EQUINO'
  | 'OVINO'
  | 'CAPRINO'
  | 'PORCINO'
  | 'COLMENA'
  | 'MIXTOS';

export type ZootechnicalPurpose = 
  | 'BOVINO Y DOBLE PROPÓSITO'
  | 'BOVINO EN LECHE'
  | 'BOVINO EN CARNE'
  | 'MIEL';

export const TENURE_TYPES: TenureType[] = ['EJIDAL', 'PROPIEDAD'];
export const ASSOCIATED_RANCHER_OPTIONS: AssociatedRancherOption[] = ['NO', 'SÍ'];
export const LIVESTOCK_SPECIES_OPTIONS: LivestockSpecies[] = [
  'BOVINO',
  'EQUINO',
  'OVINO',
  'CAPRINO',
  'PORCINO',
  'COLMENA',
  'MIXTOS',
];
export const ZOOTECHNICAL_PURPOSE_OPTIONS: ZootechnicalPurpose[] = [
  'BOVINO Y DOBLE PROPÓSITO',
  'BOVINO EN LECHE',
  'BOVINO EN CARNE',
  'MIEL',
];

export interface BrandConfig {
  initials: string;                 // e.g. "JA", "GZ", "HP"
  topSymbol: TraditionalSymbol;      // Símbolo superior
  bottomSymbol: TraditionalSymbol;   // Símbolo inferior / base
  centerSymbol: TraditionalSymbol;   // Símbolo accesorio
  orientation: BrandOrientation;     // Normal, Echado, etc.
  strokeWidth: number;               // Grosor de forja en px (8-24)
  slantAngle: number;                // Inclinación
  finish: FinishStyle;               // Acabado visual
  hasOuterRing: boolean;             // Aro perimetral
  hasSpurs: boolean;                 // Espuelas en terminales
  freehandPaths?: Array<{ points: Array<{ x: number; y: number }>; strokeWidth: number }>;
}

export interface ProducerData {
  // Datos del Productor
  fullName: string;
  curp: string;
  rfc: string;
  ine: string; // INE (Clave de Elector 18 caracteres o Folio/CIC de 10-13 dígitos)
  address: string;
  phone: string;
  municipio?: string;
  ejido: string;
  email: string;

  // Datos del Predio
  propertyName: string;
  surfaceHectares: number;
  tenureType: TenureType;
  cattleCount: number;
  species: LivestockSpecies;
  uppKey: string; // Clave UPP (Unidad de Producción Pecuaria)

  // Control Legal Municipal
  folio: string;
  registrationNumber: string;
  bookNumber: string;
  folioPage: string;
  validityRange: string; // Ej. "2026 - 2029"
  issueDate: string; // Formato YYYY-MM-DD
  status: 'Vigente' | 'En Trámite' | 'Renovación';

  // Firma Digital del Productor & Datos Adicionales Acta
  producerSignature?: string; // Data URL Base64 de la firma digital autógrafa
  producerPhoto?: string; // Data URL Base64 de la fotografía oficial del titular
  inePhoto?: string; // Data URL Base64 comprimida de la Credencial INE
  ineDriveUrl?: string; // URL pública de la INE en Google Drive
  fotoTitularDriveUrl?: string; // URL pública de la foto del titular en Drive
  firmaDriveUrl?: string; // URL pública de la firma en Drive
  certificadoDriveUrl?: string; // URL pública del certificado en Cloudinary
  certificadoImagenUrl?: string; // URL de la imagen PNG del certificado en Cloudinary
  fichaOriginalPhoto?: string; // Data URL Base64 comprimida de la Ficha Original escaneada
  fierroDigitalizadoPhoto?: string; // Data URL Base64 comprimida del Fierro Digitalizado
  certificadoGeneradoPhoto?: string; // Data URL Base64 comprimida del Certificado Generado
  associatedRancher?: AssociatedRancherOption;
  zootechnicalPurpose?: ZootechnicalPurpose;

  // FIX_VECTOR_64D_PRODUCER: vector matematico del fierro
  vector_64d?: number[];
  brandVector?: number[];
  vector_checksum?: string;
  vector_density?: number;
  vector_symmetry_h?: number;
  vector_symmetry_v?: number;
  vector_proportions?: string;
  vector_varianza?: number;
  fierroImageUrl?: string;
}

export interface DigitalExpedienteImages {
  ficha_original?: string; // Captura del documento escaneado (JPEG Base64 comprimido)
  credencial_ine?: string; // Foto de la INE (JPEG Base64 comprimido)
  fierro_digitalizado?: string; // Imagen del fierro generado/recortado (Base64)
  certificado_generado?: string; // Captura del certificado final (JPEG Base64 comprimido)
  foto_titular?: string; // FASE_0_3: URL o Base64 de la foto del titular
  firma?: string; // FASE_0_3: URL o Base64 de la firma del titular
}

export type TipoRegistroExpediente = 'HISTORICO' | 'NUEVO_ALTA';

export interface HistoricalRecord {
  id: string;
  id_registro?: string; // Clave principal vinculada en localStorage (ej. "REG-2026-4387")
  folio: string;
  productor?: string; // Nombre del productor (alias estándar de expediente digital)
  tipo_registro?: TipoRegistroExpediente; // "HISTORICO" o "NUEVO_ALTA"
  imagenes?: DigitalExpedienteImages; // Evidencias gráficas comprimidas en Base64
  datos_productor?: Record<string, any>; // Resto de la información estructurada del productor
  ownerName: string;
  curp: string;
  rfc: string;
  ine?: string;
  address: string;
  phone: string;
  propertyName: string;
  ejido: string;
  surfaceHectares: number;
  tenureType: TenureType;
  cattleCount: number;
  species: LivestockSpecies;
  initials: string;
  topSymbol: TraditionalSymbol;
  bottomSymbol: TraditionalSymbol;
  orientation: BrandOrientation;
  uppKey: string;
  year: number;
  issueDate: string;
  registrationNumber: string;
  bookNumber: string;
  folioPage: string;
  validityRange: string;
  status: 'Vigente' | 'Histórico' | 'Cancelado' | 'En Litigio';
  brandHash: string;
  producerSignature?: string;
  producerPhoto?: string;
  extractedBrandImage?: string; // Imagen recortada del fierro físico
  isHistoricalDigitized?: boolean; // Bandera de origen de digitalización
  digitizedAt?: string; // Fecha de procesamiento digital
  isLocal?: boolean; // Registro proveniente de localStorage ('fierros_historicos')
    hash_vector?: string; // Huella criptográfica del vector (ej. VEC64-56C58F6E-076B3EE1)
  imagen_base64?: string; // Imagen en formato Base64 para visualización local

  // FASE_0_3: URLs persistidas de Cloudinary para expediente digital
  ineDriveUrl?: string;
  fotoTitularDriveUrl?: string;
  firmaDriveUrl?: string;
  certificadoDriveUrl?: string; // FIX_VECTOR_64D_HISTORICAL: vector matematico del fierro
  certificadoImagenUrl?: string; // URL de la imagen PNG del certificado en Cloudinary
  vector_64d?: number[];
  brandVector?: number[];
  vector_checksum?: string;
  vector_density?: number;
  vector_symmetry_h?: number;
  vector_symmetry_v?: number;
  vector_proportions?: string;
  vector_varianza?: number;
  fierroImageUrl?: string;
}

export interface DigitizedHistoricalDocument {
  id: string;
  sourceType: 'scan_upload' | 'camera_capture' | 'archive_sample';
  documentTitle: string;
  documentYear?: number;
  extractedText?: string;
  documentImageUrl: string;
  // Extracted Producer & Land Data
  ownerName: string;
  curp?: string;
  rfc?: string;
  ine?: string;
  address: string;
  phone?: string;
  propertyName: string;
  ejido: string;
  municipio: string;
  surfaceHectares: number;
  tenureType: TenureType;
  cattleCount: number;
  species: LivestockSpecies;
  associatedRancher?: AssociatedRancherOption;
  zootechnicalPurpose?: ZootechnicalPurpose;
  uppKey?: string;
  folio: string;
  registrationNumber: string;
  bookNumber: string;
  folioPage: string;
  issueDate: string;
  validityRange: string;
  // Brand details
  initials: string;
  topSymbol: TraditionalSymbol;
  bottomSymbol: TraditionalSymbol;
  orientation: BrandOrientation;
  brandHash: string;
  extractedBrandImage?: string;
  vectorSvg?: string;
  brandVector?: number[];
  // Field Compatibility Filter
  omittedFields: Array<{
    field: string;
    label: string;
    reason: string;
  }>;
  confidenceScore: number;
}

export interface SimilarityMatch {
  record: HistoricalRecord;
  similarityPercentage: number;
  matchReasons: string[];
}

export interface MunicipalConfig {
  municipalityName: string;
  stateName: string;
  administrationPeriod: string;
  departmentName: string;
  mayorName: string;
  mayorTitle: string;
  treasurerName: string;
  treasurerTitle: string;
  directorName: string;
  directorTitle: string;
  officialSealText: string;
  legalBasisText: string;
  coatOfArmsUrl?: string;
  customLogoUrl?: string;
  municipalityAddress?: string;
  municipalityMotto?: string;
  municipalityPhone?: string;
  municipalityEmail?: string;
}

// User Authentication & Roles
export type MunicipalRole = 'Administrador' | 'Oficial de Registro' | 'Auditor' | 'Inspector';

export interface MunicipalUser {
  id: string;
  username: string;
  fullName: string;
  curp: string;
  email: string;
  role: MunicipalRole;
  department: string;
  badgeNumber: string;
}

// Audit Trail & Logging
export type AuditActionType =
  | 'REGISTRO_CREADO'
  | 'REGISTRO_MODIFICADO'
  | 'REGISTRO_ELIMINADO'
  | 'FIERRO_GENERADO'
  | 'CONSULTA_PADRON'
  | 'CARGA_CERTIFICADO'
  | 'IMPRESION_DOCUMENTO'
  | 'INICIO_SESION'
  | 'CIERRE_SESION'
  | 'RECUPERACION_ACCESO'
  | 'EXPORTACION_PADRON'
  | 'BORRADOR_RECUPERADO'
  | 'BORRADOR_GUARDADO'
  | 'ENVIO_DOCUMENTO_WHATSAPP'
  | 'ENVIO_DOCUMENTO_EMAIL'
  | 'DOCUMENTO_DIGITALIZADO'
  | 'EXPEDIENTE_ASENTADO'
  | 'ORDEN_COBRO_CREADA'
  | 'CANCELACION_DOCUMENTO'
  | 'CONSTANCIA_EMITIDA'
  | 'HUELLA_REGISTRADA'
  | 'HUELLA_VERIFICADA'
  | 'HUELLA_FALLIDA'
  | 'HUELLA_BLOQUEADA'
  | 'HUELLA_REVOCADA';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  formattedTime: string;
  userName: string;
  userRole: string;
  badgeNumber: string;
  actionType: AuditActionType;
  folioAffected?: string;
  producerAffected?: string;
  details: string;
  ipAddress: string;
}

// Municipal Agricultural Activities & Support Services (Entrega Semestral y Reportes Mensuales)
export type ActivityCategory =
  | 'apoyo_forraje'        // Entrega de forrajes, pacas y melaza en estiaje
  | 'sanidad_vacunacion'   // Vacunación contra derriengue, brucelosis y tuberculosis
  | 'siniiga_aretes'       // Dotación y colocación de aretes SINIIGA y alta en UPP
  | 'desazolve_presas'     // Desazolve y rehabilitación de presas de abrevadero
  | 'mejoramiento_genetico'// Entrega de sementales y dosis de inseminación
  | 'infraestructura_cercado' // Paquetes de alambre de púas y postes
  | 'servicio_constancia'  // Expedición de constancia de productor pecuario
  | 'servicio_inspeccion'  // Inspección de herrado y dictamen en corrales
  | 'servicio_guia';       // Validación de Guías de Tránsito Pecuario (REEMO)

export interface MunicipalSupportActivity {
  id: string;
  date: string; // YYYY-MM-DD
  category: ActivityCategory;
  title: string;
  description: string;
  ejido: string;
  beneficiariesCount: number;
  quantityOrMetric: string;
  estimatedCostOrSubsidio: number;
  operator: string;
  status: 'Completado' | 'En Proceso' | 'Programado';
}

// Módulo de Finanzas / Tesorería Municipal (Catálogo de Servicios y Órdenes de Cobro)
export type CategoriaConceptoFinanciero =
  | 'tramite'
  | 'constancia'
  | 'multa'
  | 'reposicion'
  | 'otro';

export interface ConceptoFinanciero {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaConceptoFinanciero;
  precioBase: number;
  moneda: string; // 'MXN'
  ivaAplicable: boolean;
  ivaPorcentaje: number;
  precioConIva: number; // calculado
  vigenciaDesde: string; // ISO date YYYY-MM-DD
  vigenciaHasta?: string | null;
  activo: boolean;
  ordenVisual: number;
  color: string;
  icono: string;
  requiereAutorizacion: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface HistorialPrecio {
  id: string;
  conceptoId: string;
  precioAnterior: number;
  precioNuevo: number;
  motivo: string;
  fechaCambio: string; // ISO
  userId: string;
  userName?: string;
}

export interface ConceptoEnOrden {
  conceptoId: string;
  codigo: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  ivaAplicable: boolean;
  ivaPorcentaje: number;
  ivaMonto: number;
  total: number;
  precioSobrescrito: boolean;
  motivoSobrescritura?: string | null;
}

export interface ConfigFinanzas {
  ivaGeneral: number;
  moneda: string;
  prefijoOrden: string;
  consecutivoOrdenActual: number;
  rellenoOrden: number;
  periodoActual: string;
  permitirSobrescrituraPrecio: boolean;
  requiereMotivoSobrescritura: boolean;
  actualizadoPor?: string;
  actualizadoEn?: string;
}

export interface PaymentOrder {
  id?: string;
  folio: string;
  // FIX_PAGOS_SHEETS: vincular pago al fierro especifico
  folioFierro?: string;
  exercise: string; // ej. "2026-2029"
  taxpayerName: string;
  rfc?: string;
  curp?: string;
  address: string;
  concepts: string[];
  itemsConceptos?: ConceptoEnOrden[];
  subtotalGeneral?: number;
  ivaGeneral?: number;
  totalGeneral?: number;
  customConcept?: string;
  period: string;
  amount: number;
  date: string;
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'CANCELLED';
  // FIX_PDF_RECIBOS: campos para PDF generado y vinculacion con el fierro
  pdfUrl?: string;           // URL del PDF en Cloudinary
  emailEnviado?: string;     // Email al que se envio el recibo
  whatsappEnviado?: string;  // WhatsApp al que se envio el recibo
  fechaEnvioEmail?: string;  // Fecha del ultimo envio por email
  fechaEnvioWhatsapp?: string; // Fecha del ultimo envio por WhatsApp
  metodoPago?: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta';
  referenciaPago?: string;
  emitidoPor?: string;
  cobradoPor?: string;
  notes?: string;
  cashierName?: string;
  createdAt?: any;
  updatedAt?: any;
  // FASE_0_3_BLOQUE_C: URLs del recibo y datos de pago
  urlReciboCloudinary?: string;
  urlReciboDrive?: string;
  urlReciboDriveId?: string;
  urlReporte?: string;
  fechaPago?: string;
  cajeroConfirmo?: string;
  operadorEntrego?: string;
  reciboTesoreria?: string;
}

/**
 * Payload de vinculación automática entre módulos operativos (Baja, Revalidación, Degüello, Alta, Constancia)
 * y el módulo de Finanzas (Órdenes de Cobro).
 */
export interface PreloadedOrderData {
  nombreContribuyente: string;
  domicilioContribuyente: string;
  rfc?: string;
  curp?: string;
  folio?: string;
  conceptosSeleccionados: string[];
  montoTotal: number;
  ejercicioFiscal: string;
  periodo: string;
  fechaExpedicion: string;
  tramiteOrigen?: 'ALTA' | 'REVALIDACION' | 'BAJA' | 'CONSTANCIA' | 'DEGUELLO';
  customConcept?: string;
  notas?: string;
  headCount?: number;
  species?: string;
}

// =========================================================================
// SISTEMA DE AUTENTICACIÓN BIOMÉTRICA (HUELLA DIGITAL / WEBAUTHN / FIDO2)
// =========================================================================
export type BiometricFingerIndex =
  | 'INDICE_DERECHO'
  | 'PULGAR_DERECHO'
  | 'INDICE_IZQUIERDO'
  | 'PULGAR_IZQUIERDO'
  | 'OTRO_DEDO';

export type BiometricCredentialStatus = 'ACTIVE' | 'REVOKED' | 'LOCKED';

export interface BiometricCredential {
  id: string; // ID único interno de registro
  userId: string; // ID del servidor público u operador
  userName: string; // Nombre completo del operador
  userRole?: string; // Cargo institucional
  credentialId: string; // Credential ID (base64url/hex)
  publicKey: string; // Clave pública / template biométrico seguro
  algorithm: string; // Algoritmo criptográfico (ej. 'ES256' o 'SHA256_MINUTIAE')
  fingerIndex: BiometricFingerIndex; // Dedo enrolado
  deviceLabel: string; // ej. "Sensor Biométrico Integrado Touch ID / Windows Hello" o "Lector USB DigitalPersona"
  registeredAt: string; // ISO String
  lastUsedAt: string; // ISO String
  counter: number; // Sign counter anti-replay
  status: BiometricCredentialStatus;
  failedAttempts: number; // Intentos fallidos consecutivos (máx 3)
  lockedUntil?: string | null; // Bloqueo temporal por 5 minutos si excede 3 fallos
  consentGiven: boolean; // Consentimiento expreso de protección de datos personales
  consentTimestamp: string;
}

export interface BiometricVerificationResult {
  success: boolean;
  message: string;
  userId?: string;
  userName?: string;
  credentialId?: string;
  fingerIndex?: BiometricFingerIndex;
  attemptsRemaining?: number;
  isLocked?: boolean;
  lockedUntil?: string;
  requiresPinFallback?: boolean;
  sessionToken?: string;
}

