export const OVA_TIPO_ACTIVIDAD = {
  VIDEO: 'video',
  RESPIRACION: 'respiracion',
  EJERCICIO_PRACTICO: 'ejercicio_practico',
} as const;

export type OvaTipoActividad = typeof OVA_TIPO_ACTIVIDAD[keyof typeof OVA_TIPO_ACTIVIDAD];

export const OVA_STORAGE_SOURCE = {
  YOUTUBE: 'YOUTUBE',
  CLOUDFLARE_R2: 'CLOUDFLARE_R2',
  EXTERNAL_URL: 'EXTERNAL_URL',
} as const;

export type OvaStorageSource = typeof OVA_STORAGE_SOURCE[keyof typeof OVA_STORAGE_SOURCE];

export const OVA_ASIGNACION_ESTADO = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
  DISMISSED: 'DISMISSED',
} as const;

export type OvaAsignacionEstado = typeof OVA_ASIGNACION_ESTADO[keyof typeof OVA_ASIGNACION_ESTADO];

export const OVA_COOLDOWN_DAYS = {
  COMPLETED: 14,
  SKIPPED: 7,
  DISMISSED: 7,
} as const;

export const OVA_MAX_ASIGNACIONES_POR_EVALUACION = 3;

export const DIMENSIONES_SEMAFORO_PERMITIDAS = [
  'ansiedad',
  'estres_academico',
  'humor_depresivo',
  'sueno',
  'relaciones_sociales',
  'autoestima_autocuidado',
  'energia_motivacion',
] as const;

export type DimensionSemaforo = typeof DIMENSIONES_SEMAFORO_PERMITIDAS[number];

export const NIVELES_SEMAFORO_PERMITIDOS = ['verde', 'amarillo', 'rojo'] as const;
export type NivelSemaforo = typeof NIVELES_SEMAFORO_PERMITIDOS[number];
