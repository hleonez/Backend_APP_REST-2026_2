import { and, desc, eq, gte, lte, isNull } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { toIsoDate } from '../shared/utils/fechas.utils';
import { analizarPatronesEmocionales, type PerfilEmocional } from './user-profile.service';

type ColorSemaforo = 'verde' | 'amarillo' | 'rojo';
type NivelBienestar = 'bajo' | 'medio' | 'alto';

interface DimensionAgregada {
  dimension: string;
  media: number;
  nivel: NivelBienestar;
  total: number;
}

interface SemaforoActual {
  color: ColorSemaforo;
  subcategoria: string | null;
  puntaje_global: number;
}

export interface ContextoBienestar {
  semaforo_actual: SemaforoActual | null;
  registro_7d: DimensionAgregada[];
  onboarding_base: DimensionAgregada[];
  perfil_emocional: PerfilEmocional;
}

export interface ContextoBienestarConstruido {
  datos: ContextoBienestar;
  bloque_prompt: string;
}

interface PuntuacionDimensional {
  sumatoria: number;
  total: number;
}

interface ReglaDimension {
  dimension: string;
  keywords: string[];
}

const REGLAS_DIMENSIONES: ReglaDimension[] = [
  { dimension: 'sueno', keywords: ['sueño', 'sueno', 'dorm', 'insomnio', 'pesadilla'] },
  { dimension: 'energia', keywords: ['energía', 'energia', 'cansancio', 'cansado', 'fatig', 'agot'] },
  { dimension: 'apetito', keywords: ['apetito', 'comida', 'hambre'] },
  { dimension: 'autoestima', keywords: ['autoestima', 'autoval', 'valgo', 'fracaso', 'inutil', 'inútil'] },
  { dimension: 'concentracion', keywords: ['concentr', 'atencion', 'atención', 'enfoque'] },
  { dimension: 'calma', keywords: ['calma', 'relaj', 'tranquil', 'paz'] },
  { dimension: 'ansiedad', keywords: ['ansiedad', 'preocup', 'nerv', 'miedo', 'alerta'] },
  { dimension: 'estres', keywords: ['estrés', 'estres', 'estres', 'tension', 'tensión', 'estres diario', 'estrés diario'] },
  { dimension: 'apoyo_social', keywords: ['apoyo social', 'apoyo de las personas', 'compañ', 'compañía', 'soledad', 'solo'] },
  { dimension: 'motivacion', keywords: ['motiv', 'interés', 'interes', 'actividades'] },
  { dimension: 'satisfaccion', keywords: ['satisfacción', 'satisfaccion', 'optimismo', 'disfrutar', 'vida en general'] },
  { dimension: 'manejo_emocional', keywords: ['manejo de emociones', 'emocion', 'emoción', 'regular'] },
  { dimension: 'estado_animo', keywords: ['estado de ánimo', 'estado de animo', 'ánimo', 'animo', 'general'] },
  { dimension: 'general', keywords: [] },
];

const normalizarTexto = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const inferirDimension = (textoPregunta: string, textoOpcion?: string | null): string => {
  const texto = normalizarTexto(`${textoPregunta} ${textoOpcion ?? ''}`);

  for (const regla of REGLAS_DIMENSIONES) {
    if (regla.keywords.length === 0) continue;
    if (regla.keywords.some((keyword) => texto.includes(keyword))) {
      return regla.dimension;
    }
  }

  return 'general';
};

const calcularNivel = (media: number, maximo: number): NivelBienestar => {
  const normalizado = maximo <= 0 ? 0 : (media / maximo) * 100;

  if (normalizado >= 67) return 'alto';
  if (normalizado >= 34) return 'medio';
  return 'bajo';
};

const agruparPromedios = (
  items: Array<{ dimension: string; puntaje: number }>,
  maximo: number,
): DimensionAgregada[] => {
  const mapa: Record<string, PuntuacionDimensional> = {};

  for (const item of items) {
    const dimension = item.dimension || 'general';
    if (!mapa[dimension]) {
      mapa[dimension] = { sumatoria: 0, total: 0 };
    }

    mapa[dimension].sumatoria += Number(item.puntaje ?? 0);
    mapa[dimension].total += 1;
  }

  return Object.entries(mapa)
    .map(([dimension, stats]) => ({
      dimension,
      media: stats.total > 0 ? Number((stats.sumatoria / stats.total).toFixed(2)) : 0,
      nivel: calcularNivel(stats.total > 0 ? stats.sumatoria / stats.total : 0, maximo),
      total: stats.total,
    }))
    .sort((a, b) => b.media - a.media || b.total - a.total);
};

const determinarSemaforo = (puntaje: number): ColorSemaforo => {
  if (puntaje >= 70) return 'rojo';
  if (puntaje >= 40) return 'amarillo';
  return 'verde';
};

const formatearBloquePrompt = (ctx: ContextoBienestar): string => {
  const semaforo = ctx.semaforo_actual
    ? `color=${ctx.semaforo_actual.color} | subcategoria=${ctx.semaforo_actual.subcategoria ?? 'sin_dato'} | puntaje_global=${ctx.semaforo_actual.puntaje_global}`
    : 'sin_datos';

  const resumenDimensiones = (items: DimensionAgregada[]) =>
    items.length > 0
      ? items.map((item) => `- ${item.dimension}: nivel ${item.nivel} | media ${item.media} | registros ${item.total}`).join('\n')
      : '- sin_datos';

  const perfil = ctx.perfil_emocional;

  return [
    'Contexto de bienestar consolidado:',
    `Semaforo actual: ${semaforo}`,
    'Registro emocional últimos 7 días:',
    resumenDimensiones(ctx.registro_7d),
    'Onboarding inicial (base agregada por dimensión):',
    resumenDimensiones(ctx.onboarding_base),
    'Perfil emocional:',
    `- emociones_frecuentes: ${perfil.emociones_frecuentes.length > 0 ? perfil.emociones_frecuentes.join(', ') : 'sin_datos'}`,
    `- temas_recurrentes: ${perfil.temas_recurrentes.length > 0 ? perfil.temas_recurrentes.join(', ') : 'sin_datos'}`,
    `- patrones: ${perfil.patrones_comportamiento.length > 0 ? perfil.patrones_comportamiento.join(' | ') : 'sin_datos'}`,
    `- dias_sin_comunicacion: ${perfil.dias_sin_comunicacion}`,
  ].join('\n');
};

const obtenerUltimoSemaforo = async (usuarioId: number): Promise<SemaforoActual | null> => {
  const [ultimaEvaluacion] = await db
    .select({
      puntaje_total: schema.evaluaciones.puntaje_total,
      estado_semaforo: schema.evaluaciones.estado_semaforo,
    })
    .from(schema.evaluaciones)
    .where(
      and(
        eq(schema.evaluaciones.usuario_id, usuarioId),
        isNull(schema.evaluaciones.deleted_at),
      ),
    )
    .orderBy(desc(schema.evaluaciones.fecha))
    .limit(1);

  if (!ultimaEvaluacion) return null;

  const puntajeGlobal = Number(ultimaEvaluacion.puntaje_total ?? 0);
  const color = (ultimaEvaluacion.estado_semaforo as ColorSemaforo) ?? determinarSemaforo(puntajeGlobal);

  return {
    color,
    subcategoria: null,
    puntaje_global: puntajeGlobal,
  };
};

const obtenerDimensionesUltimaEvaluacion = async (usuarioId: number): Promise<DimensionAgregada[]> => {
  const [ultimaEvaluacion] = await db
    .select({
      id: schema.evaluaciones.id,
    })
    .from(schema.evaluaciones)
    .where(
      and(
        eq(schema.evaluaciones.usuario_id, usuarioId),
        isNull(schema.evaluaciones.deleted_at),
      ),
    )
    .orderBy(desc(schema.evaluaciones.fecha))
    .limit(1);

  if (!ultimaEvaluacion) return [];

  const respuestas = await db
    .select({
      respuesta: schema.respuestas.respuesta,
      pregunta_texto: schema.preguntas.texto,
    })
    .from(schema.respuestas)
    .innerJoin(schema.preguntas, eq(schema.respuestas.pregunta_id, schema.preguntas.id))
    .where(
      and(
        eq(schema.respuestas.evaluacion_id, ultimaEvaluacion.id),
        isNull(schema.respuestas.deleted_at),
        isNull(schema.preguntas.deleted_at),
      ),
    )
    .orderBy(desc(schema.respuestas.updated_at));

  const items = respuestas.map((item) => ({
    dimension: inferirDimension(item.pregunta_texto),
    puntaje: Number(item.respuesta ?? 0),
  }));

  return agruparPromedios(items, 5);
};

const obtenerRegistroEmocional7d = async (usuarioId: number): Promise<DimensionAgregada[]> => {
  const hoy = new Date();
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - 6);

  const registros = await db
    .select({
      puntaje: schema.registro_emocional.puntaje,
      pregunta_texto: schema.preguntas_registro_emocional.texto,
      opcion_nombre: schema.opciones_registro_emocional.nombre,
      fecha_dia: schema.registro_emocional.fecha_dia,
    })
    .from(schema.registro_emocional)
    .leftJoin(schema.preguntas_registro_emocional, eq(schema.registro_emocional.pregunta_id, schema.preguntas_registro_emocional.id))
    .leftJoin(schema.opciones_registro_emocional, eq(schema.registro_emocional.opcion_id, schema.opciones_registro_emocional.id))
    .where(
      and(
        eq(schema.registro_emocional.usuario_id, usuarioId),
        gte(schema.registro_emocional.fecha_dia, toIsoDate(inicio)),
        lte(schema.registro_emocional.fecha_dia, toIsoDate(hoy)),
        isNull(schema.registro_emocional.deleted_at),
        isNull(schema.preguntas_registro_emocional.deleted_at),
        isNull(schema.opciones_registro_emocional.deleted_at),
      ),
    );

  const items = registros.map((registro) => ({
    dimension: inferirDimension(registro.pregunta_texto ?? '', registro.opcion_nombre ?? ''),
    puntaje: Number(registro.puntaje ?? 0),
  }));

  return agruparPromedios(items, 4);
};

export const construirContextoBienestar = async (usuarioId: number): Promise<ContextoBienestarConstruido> => {
  const [perfilEmocional, semaforoActual, onboardingBase, registro7d] = await Promise.all([
    analizarPatronesEmocionales(usuarioId, 25),
    obtenerUltimoSemaforo(usuarioId),
    obtenerDimensionesUltimaEvaluacion(usuarioId),
    obtenerRegistroEmocional7d(usuarioId),
  ]);

  const semaforoConSubcategoria =
    semaforoActual && (onboardingBase[0]?.dimension || registro7d[0]?.dimension)
      ? {
          ...semaforoActual,
          subcategoria: onboardingBase[0]?.dimension ?? registro7d[0]?.dimension ?? null,
        }
      : semaforoActual;

  const datos: ContextoBienestar = {
    semaforo_actual: semaforoConSubcategoria,
    registro_7d: registro7d,
    onboarding_base: onboardingBase,
    perfil_emocional: perfilEmocional,
  };

  return {
    datos,
    bloque_prompt: formatearBloquePrompt(datos),
  };
};
