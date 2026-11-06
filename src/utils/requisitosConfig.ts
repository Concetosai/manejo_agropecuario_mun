/**
 * REQUISITOS OFICIALES POR TRÁMITE
 * H. Ayuntamiento Constitucional de Pánuco, Ver.
 * Dirección de Fomento Agropecuario y Desarrollo Rural
 *
 * Basado en los carteles oficiales de la Mesa de Ganadería.
 * Teléfono: 846-109-6645
 */

export interface RequisitoItem {
  id: string;
  label: string;
  descripcion?: string;
  critico: boolean;        // Si true: bloquea el trámite
  grupo: 'documento' | 'fotografia' | 'fisico' | 'legal';
}

export interface RequisitosPorTramite {
  [tramite: string]: {
    titulo: string;
    descripcion: string;
    requisitos: RequisitoItem[];
  };
}

export const REQUISITOS_OFICIALES: RequisitosPorTramite = {
  // ═══════════════════════════════════════════════════════════════
  // ALTA DE FIERRO QUEMADOR
  // ═══════════════════════════════════════════════════════════════
  ALTA: {
    titulo: 'Requisitos para Alta de Fierro Quemador',
    descripcion: 'Traer de 3 a 5 diseños ANTES de elaborar el fierro. Una vez autorizado el diseño, presentar la siguiente documentación:',
    requisitos: [
      {
        id: 'alta_disenos_3a5',
        label: 'Traer 3 a 5 diseños propuestos',
        descripcion: 'Antes de elaborar el fierro quemador',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'alta_fierro_8x8',
        label: 'Fierro quemador físico de 8×8 cm',
        descripcion: 'Ya autorizado el diseño, elaborado en hierro',
        critico: true,
        grupo: 'fisico',
      },
      {
        id: 'alta_acta_nacimiento',
        label: 'Acta de nacimiento (original + copia)',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'alta_ine_2copias',
        label: 'Credencial INE vigente (original + 2 copias)',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'alta_fotos_3',
        label: '3 fotografías tamaño infantil (recientes)',
        descripcion: 'Sin sombrero, sin cachucha',
        critico: true,
        grupo: 'fotografia',
      },
      {
        id: 'alta_curp',
        label: 'Copia del CURP',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'alta_rfc',
        label: 'Copia del R.F.C.',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'alta_upp',
        label: 'Copia de la UPP',
        descripcion: 'Unidad de Producción Pecuaria',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'alta_escritura',
        label: 'Escritura o certificado parcelario (original + copia)',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'alta_arrendamiento',
        label: 'Contrato de arrendamiento notariado (si aplica)',
        descripcion: 'Con copias de credenciales del arrendatario, arrendador y testigos',
        critico: false,
        grupo: 'legal',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // REVALIDACIÓN DE FIERRO QUEMADOR
  // ═══════════════════════════════════════════════════════════════
  REVALIDACION: {
    titulo: 'Requisitos para Revalidación de Fierro Quemador',
    descripcion: 'Mesa de Ganadería: 846-109-6645. Si no es el titular de la patente, presentar poder notariado.',
    requisitos: [
      {
        id: 'rev_ultima_revalidacion',
        label: 'Copia de la última revalidación',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'rev_ultimo_recibo',
        label: 'Copia del último recibo de pago',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'rev_fotos_3',
        label: '3 fotografías tamaño infantil (recientes)',
        descripcion: 'Sin sombrero, sin cachucha',
        critico: true,
        grupo: 'fotografia',
      },
      {
        id: 'rev_ine_copia',
        label: 'Copia de credencial de elector (vigente)',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'rev_curp_copia',
        label: 'Copia del CURP',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'rev_upp_copia',
        label: 'Copia de la UPP',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'rev_constancia_fiscal',
        label: 'Copia de constancia de situación fiscal',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'rev_fierro_fisico',
        label: 'TRAER FIERRO QUEMADOR EN FÍSICO',
        descripcion: 'Para comparar con el padrón municipal',
        critico: true,
        grupo: 'fisico',
      },
      {
        id: 'rev_vigentes',
        label: 'INE, CURP y constancia VIGENTES',
        descripcion: 'Verificar fechas de vigencia',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'rev_poder_notariado',
        label: 'Poder notariado (si no es titular)',
        descripcion: 'Solo si el solicitante no es el titular de la patente',
        critico: false,
        grupo: 'legal',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // BAJA DE FIERRO QUEMADOR
  // ═══════════════════════════════════════════════════════════════
  BAJA: {
    titulo: 'Requisitos para Baja de Fierro Quemador',
    descripcion: 'Según la causa de baja, los requisitos varían. La causa más común es defunción del titular.',
    requisitos: [
      {
        id: 'baja_patente_original',
        label: 'Patente ORIGINAL del fierro quemador',
        critico: true,
        grupo: 'fisico',
      },
      {
        id: 'baja_revalidaciones_originales',
        label: 'Todas las revalidaciones originales',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'baja_recibo_original',
        label: 'Recibo de pago original',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'baja_acta_defuncion',
        label: 'Acta de defunción (si aplica por defunción)',
        critico: false,
        grupo: 'legal',
      },
      {
        id: 'baja_documento_notariado',
        label: 'Documento notariado con designación de beneficiario',
        descripcion: 'Aplica si hay sucesión o cesión de derechos',
        critico: true,
        grupo: 'legal',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // CONSTANCIA
  // ═══════════════════════════════════════════════════════════════
  CONSTANCIA: {
    titulo: 'Requisitos para Emisión de Constancia',
    descripcion: 'Documentación básica del productor para acreditar su registro pecuario.',
    requisitos: [
      {
        id: 'const_ine_vigente',
        label: 'Credencial INE vigente (original + copia)',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'const_curp',
        label: 'Copia del CURP',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'const_patente_vigente',
        label: 'Patente de fierro VIGENTE',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'const_upp_copia',
        label: 'Copia de la UPP',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'const_comprobante_domicilio',
        label: 'Comprobante de domicilio',
        critico: true,
        grupo: 'documento',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // DEGÜELLO
  // ═══════════════════════════════════════════════════════════════
  DEGUELLO: {
    titulo: 'Requisitos para Permiso de Degüello',
    descripcion: 'Verificación sanitaria y control de sacrificio. Requiere fierro de procedencia verificado.',
    requisitos: [
      {
        id: 'deg_fierro_procedencia',
        label: 'Fierro de procedencia VERIFICADO',
        descripcion: 'Debe estar activo en el padrón municipal',
        critico: true,
        grupo: 'fisico',
      },
      {
        id: 'deg_guia_transito',
        label: 'Guía de tránsito zoosanitaria',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'deg_certificado_sanitario',
        label: 'Certificado sanitario (CFS)',
        critico: false,
        grupo: 'documento',
      },
      {
        id: 'deg_ine_introductor',
        label: 'Credencial INE del introductor',
        critico: true,
        grupo: 'documento',
      },
      {
        id: 'deg_constancia_upp',
        label: 'Constancia UPP del predio de origen',
        critico: true,
        grupo: 'documento',
      },
    ],
  },
};

export function getRequisitosPorTramite(tramite: string): {
  titulo: string;
  descripcion: string;
  requisitos: RequisitoItem[];
} | null {
  return REQUISITOS_OFICIALES[tramite.toUpperCase()] || null;
}

export function contarRequisitosCriticos(requisitos: RequisitoItem[]): number {
  return requisitos.filter((r) => r.critico).length;
}