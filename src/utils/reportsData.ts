import { MunicipalSupportActivity, ActivityCategory } from '../types';
import { PANUCO_EJIDOS } from './database';

const STORAGE_KEY = 'panuco_municipal_activities_v1';

export const ACTIVITY_CATEGORIES_INFO: Record<
  ActivityCategory,
  { label: string; group: 'apoyo' | 'servicio' | 'sanidad'; color: string; bgBadge: string }
> = {
  apoyo_forraje: {
    label: 'Entrega de Forraje y Melaza (Estiaje)',
    group: 'apoyo',
    color: '#d97706',
    bgBadge: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  sanidad_vacunacion: {
    label: 'Campaña Sanitaria (Rabia / Brucela / TB)',
    group: 'sanidad',
    color: '#dc2626',
    bgBadge: 'bg-rose-100 text-rose-900 border-rose-300',
  },
  siniiga_aretes: {
    label: 'Aretes SINIIGA y Registro UPP',
    group: 'servicio',
    color: '#0284c7',
    bgBadge: 'bg-sky-100 text-sky-900 border-sky-300',
  },
  desazolve_presas: {
    label: 'Desazolve de Presas y Ollas Ejidales',
    group: 'apoyo',
    color: '#059669',
    bgBadge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  mejoramiento_genetico: {
    label: 'Mejoramiento Genético / Sementales',
    group: 'apoyo',
    color: '#7c3aed',
    bgBadge: 'bg-purple-100 text-purple-900 border-purple-300',
  },
  infraestructura_cercado: {
    label: 'Paquetes de Alambre y Postes',
    group: 'apoyo',
    color: '#b45309',
    bgBadge: 'bg-stone-200 text-stone-900 border-stone-400',
  },
  servicio_constancia: {
    label: 'Constancias de Productor Pecuario',
    group: 'servicio',
    color: '#2563eb',
    bgBadge: 'bg-blue-100 text-blue-900 border-blue-300',
  },
  servicio_inspeccion: {
    label: 'Inspección de Herrado y Corrales',
    group: 'servicio',
    color: '#0f766e',
    bgBadge: 'bg-teal-100 text-teal-900 border-teal-300',
  },
  servicio_guia: {
    label: 'Guías de Tránsito Pecuario (REEMO)',
    group: 'servicio',
    color: '#4f46e5',
    bgBadge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  },
};

const SEED_ACTIVITIES: MunicipalSupportActivity[] = [
  {
    id: 'act-2026-001',
    date: '2026-01-14',
    category: 'apoyo_forraje',
    title: 'Entrega Emergente de Pacas de Zacate Estrella',
    description: 'Dotación de forraje subsidiado al 60% para amortiguar época seca en potreros comunales.',
    ejido: 'Reventadero',
    beneficiariesCount: 42,
    quantityOrMetric: '1,200 Pacas de Heno',
    estimatedCostOrSubsidio: 72000,
    operator: 'Ing. Faustino Meraz Sobrevilla',
    status: 'Completado',
  },
  {
    id: 'act-2026-002',
    date: '2026-01-22',
    category: 'siniiga_aretes',
    title: 'Jornada de Areteo SINIIGA e Identificación Individual',
    description: 'Brigada móvil de ventanilla autorizada para colocación de aretes amarillos y alta en padrón.',
    ejido: 'Tamos',
    beneficiariesCount: 28,
    quantityOrMetric: '350 Aretes SINIIGA',
    estimatedCostOrSubsidio: 21000,
    operator: 'C.P. Fernando Aradillas Castillo',
    status: 'Completado',
  },
  {
    id: 'act-2026-003',
    date: '2026-02-05',
    category: 'sanidad_vacunacion',
    title: 'Campaña de Vacunación contra Derriengue (Rabia Bovina)',
    description: 'Barrido sanitario y aplicación de biológicos antirrábicos en hatos vulnerables limítrofes con Tamesí.',
    ejido: 'Villa Cacalilao',
    beneficiariesCount: 65,
    quantityOrMetric: '1,850 Dosis Aplicadas',
    estimatedCostOrSubsidio: 55500,
    operator: 'Dr. Zootecnista Ramón Maya',
    status: 'Completado',
  },
  {
    id: 'act-2026-004',
    date: '2026-02-18',
    category: 'desazolve_presas',
    title: 'Rehabilitación y Desazolve de Presa Ejidal Comunitaria',
    description: 'Trabajos con retroexcavadora municipal para ampliación de capacidad de almacenamiento de agua de lluvia.',
    ejido: 'Canoas',
    beneficiariesCount: 54,
    quantityOrMetric: '3 Presas Rehabilitadas',
    estimatedCostOrSubsidio: 128000,
    operator: 'Ing. Faustino Meraz Sobrevilla',
    status: 'Completado',
  },
  {
    id: 'act-2026-005',
    date: '2026-03-04',
    category: 'servicio_constancia',
    title: 'Emisión Masiva de Constancias de Productor Pecuario',
    description: 'Cotejo con actas ejidales y verificación de fierro quemador para trámites de programas federales.',
    ejido: 'Moralillo',
    beneficiariesCount: 78,
    quantityOrMetric: '78 Constancias Expedidas',
    estimatedCostOrSubsidio: 15600,
    operator: 'C.P. Fernando Aradillas Castillo',
    status: 'Completado',
  },
  {
    id: 'act-2026-006',
    date: '2026-03-19',
    category: 'mejoramiento_genetico',
    title: 'Subsidio Municipal para Adquisición de Sementales Brangus y Beefmaster',
    description: 'Apoyo económico directo de $15,000 por ejemplar con registro genealógico para pequeños ganaderos.',
    ejido: 'Mahuaves',
    beneficiariesCount: 16,
    quantityOrMetric: '16 Sementales de Registro',
    estimatedCostOrSubsidio: 240000,
    operator: 'Mtro. Óscar Guzmán de Paz',
    status: 'Completado',
  },
  {
    id: 'act-2026-007',
    date: '2026-04-10',
    category: 'apoyo_forraje',
    title: 'Distribución de Melaza Líquida y Sales Minerales',
    description: 'Entrega de tambos de melaza enriquecida con urea para suplementación calórica del ganado.',
    ejido: 'Bermúdez',
    beneficiariesCount: 36,
    quantityOrMetric: '72 Tambos de 200 L',
    estimatedCostOrSubsidio: 68400,
    operator: 'Ing. Faustino Meraz Sobrevilla',
    status: 'Completado',
  },
  {
    id: 'act-2026-008',
    date: '2026-04-24',
    category: 'servicio_inspeccion',
    title: 'Inspección de Corrales y Dictamen Técnico de Fierro Marcador',
    description: 'Peritaje in situ para resolver aclaraciones de similitud y confirmación de huella de marca.',
    ejido: 'Oviedo',
    beneficiariesCount: 22,
    quantityOrMetric: '22 Dictámenes Emitidos',
    estimatedCostOrSubsidio: 11000,
    operator: 'Ing. Faustino Meraz Sobrevilla',
    status: 'Completado',
  },
  {
    id: 'act-2026-009',
    date: '2026-05-08',
    category: 'infraestructura_cercado',
    title: 'Dotación de Paquetes de Alambre de Púas Ganadero',
    description: 'Rollos de alambre de 360 m y postes de mezquite para delimitación de predios y división de potreros.',
    ejido: 'Topila',
    beneficiariesCount: 45,
    quantityOrMetric: '180 Rollos de Alambre',
    estimatedCostOrSubsidio: 108000,
    operator: 'C.P. Fernando Aradillas Castillo',
    status: 'Completado',
  },
  {
    id: 'act-2026-010',
    date: '2026-05-27',
    category: 'servicio_guia',
    title: 'Modulo de Validación Rápida de Guías REEMO y Sanidad',
    description: 'Atención especial a introductores y criadores para movilización segura a subastas y rastros autorizados.',
    ejido: 'Corcovado',
    beneficiariesCount: 92,
    quantityOrMetric: '210 Guías Expedidas',
    estimatedCostOrSubsidio: 25200,
    operator: 'Dr. Zootecnista Ramón Maya',
    status: 'Completado',
  },
  {
    id: 'act-2026-011',
    date: '2026-06-12',
    category: 'desazolve_presas',
    title: 'Desazolve de Presa Comunal y Canales de Abrevadero',
    description: 'Despeje de sedimentos antes del temporal de lluvias para captación máxima de escorrentías.',
    ejido: 'El Barco',
    beneficiariesCount: 38,
    quantityOrMetric: '2 Presas Ejidales',
    estimatedCostOrSubsidio: 95000,
    operator: 'Ing. Faustino Meraz Sobrevilla',
    status: 'Completado',
  },
  {
    id: 'act-2026-012',
    date: '2026-06-25',
    category: 'sanidad_vacunacion',
    title: 'Toma de Muestras Sanguíneas para Hato Libre de Brucelosis',
    description: 'Muestreo oficial para refrendo de certificación de zona B y tránsito interestatal.',
    ejido: 'Tancheche',
    beneficiariesCount: 31,
    quantityOrMetric: '750 Cabezas Muestreadas',
    estimatedCostOrSubsidio: 45000,
    operator: 'Dr. Zootecnista Ramón Maya',
    status: 'Completado',
  },
  {
    id: 'act-2026-013',
    date: '2026-07-09',
    category: 'apoyo_forraje',
    title: 'Paquetes Forrajeros para Segundo Periodo de Secas',
    description: 'Suministro de silo de maíz y concentrado pecuario a cooperativas ganaderas ejidales.',
    ejido: 'Calentadores',
    beneficiariesCount: 40,
    quantityOrMetric: '800 Bultos de Silo',
    estimatedCostOrSubsidio: 88000,
    operator: 'Ing. Faustino Meraz Sobrevilla',
    status: 'Completado',
  },
  {
    id: 'act-2026-014',
    date: '2026-08-14',
    category: 'siniiga_aretes',
    title: 'Regularización de Aretes SINIIGA y Claves UPP Inactivas',
    description: 'Trámite simplificado en coordinación con la Asociación Ganadera Local de Pánuco.',
    ejido: 'Ex-Hacienda Chintón',
    beneficiariesCount: 34,
    quantityOrMetric: '410 Aretes Asignados',
    estimatedCostOrSubsidio: 24600,
    operator: 'C.P. Fernando Aradillas Castillo',
    status: 'Completado',
  },
  {
    id: 'act-2026-015',
    date: '2026-09-02',
    category: 'servicio_constancia',
    title: 'Expedición de Constancias y Certificados de Padrón Pecuario',
    description: 'Documentación oficial para acreditar tenencia de ganado y marcas vigentes.',
    ejido: 'Mayorazgo',
    beneficiariesCount: 48,
    quantityOrMetric: '48 Constancias Emitidas',
    estimatedCostOrSubsidio: 9600,
    operator: 'Ing. Faustino Meraz Sobrevilla',
    status: 'Completado',
  },
];

export function getMunicipalActivities(): MunicipalSupportActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading municipal activities', e);
  }

  // Seed default activities
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ACTIVITIES));
  return SEED_ACTIVITIES;
}

export function saveMunicipalActivity(activity: MunicipalSupportActivity): MunicipalSupportActivity[] {
  const list = getMunicipalActivities();
  const updated = [activity, ...list];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving municipal activity', e);
  }
  return updated;
}

export function resetActivitiesToDefault(): MunicipalSupportActivity[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ACTIVITIES));
  return SEED_ACTIVITIES;
}
