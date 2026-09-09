import { and, desc, eq, gte, lte, isNull } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { toIsoDate } from '../shared/utils/fechas.utils';
import { analizarPatronesEmocionales, type PerfilEmocional } from './user-profile.service';
import { DIMENSIONES_SEMAFORO } from '../shared/utils/semaforo-dimensiones.utils';

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
      subcategoria_principal: schema.evaluaciones.subcategoria_principal,
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
    subcategoria: ultimaEvaluacion.subcategoria_principal ?? null,
    puntaje_global: puntajeGlobal,
  };
};

/**
 * Fase 7: Lee las respuestas reales del onboarding de encuestas_respuestas,
 * asociadas a la encuesta con codigo='ONBOARDING_INICIAL'. Las respuestas
 * se almacenan como JSON con formato { respuestas: [{ pregunta_id, puntaje }] }.
 * Cada pregunta del onboarding tiene una categoria que mapea a las 7 dimensiones
 * canónicas del semáforo.
 */
const obtenerOnboardingBase = async (usuarioId: number): Promise<DimensionAgregada[]> => {
  const [encuesta] = await db
    .select({ id: schema.encuestas.id })
    .from(schema.encuestas)
    .where(
      and(
        eq(schema.encuestas.codigo, 'ONBOARDING_INICIAL'),
        isNull(schema.encuestas.deleted_at),
      ),
    )
    .limit(1);

  if (!encuesta) return [];

  const [respuestaEncuesta] = await db
    .select({ respuesta: schema.encuestasRespuestas.respuesta })
    .from(schema.encuestasRespuestas)
    .where(
      and(
        eq(schema.encuestasRespuestas.usuario_id, usuarioId),
        eq(schema.encuestasRespuestas.encuesta_id, encuesta.id),
        isNull(schema.encuestasRespuestas.deleted_at),
      ),
    )
    .orderBy(desc(schema.encuestasRespuestas.fecha))
    .limit(1);

  if (!respuestaEncuesta?.respuesta) return [];

  try {
    const data = JSON.parse(respuestaEncuesta.respuesta) as {
      respuestas: Array<{ pregunta_id: string; puntaje: number }>;
    };

    if (!data.respuestas || !Array.isArray(data.respuestas)) return [];

    const [encuestaRow] = await db
      .select({ opciones: schema.encuestas.opciones })
      .from(schema.encuestas)
      .where(eq(schema.encuestas.id, encuesta.id))
      .limit(1);

    if (!encuestaRow?.opciones) return [];

    const preguntasData = JSON.parse(encuestaRow.opciones) as {
      preguntas: Array<{ id: string; categoria: string }>;
    };

    const preguntaDimensionMap = new Map<string, string>();
    for (const p of preguntasData.preguntas) {
      preguntaDimensionMap.set(p.id, p.categoria);
    }

    const items = data.respuestas.map((r) => ({
      dimension: preguntaDimensionMap.get(r.pregunta_id) ?? 'general',
      puntaje: r.puntaje,
    }));

    return agruparPromedios(items, 4);
  } catch {
    return [];
  }
};

/**
 * Lee el registro emocional de los últimos 7 días usando directamente la
 * columna categoria de preguntas_registro_emocional (las 7 dimensiones
 * canónicas), en lugar de inferir la dimensión por heurísticas de texto.
 */
const obtenerRegistroEmocional7d = async (usuarioId: number): Promise<DimensionAgregada[]> => {
  const hoy = new Date();
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - 6);

  const registros = await db
    .select({
      puntaje: schema.registro_emocional.puntaje,
      categoria: schema.preguntas_registro_emocional.categoria,
    })
    .from(schema.registro_emocional)
    .leftJoin(schema.preguntas_registro_emocional, eq(schema.registro_emocional.pregunta_id, schema.preguntas_registro_emocional.id))
    .where(
      and(
        eq(schema.registro_emocional.usuario_id, usuarioId),
        gte(schema.registro_emocional.fecha_dia, toIsoDate(inicio)),
        lte(schema.registro_emocional.fecha_dia, toIsoDate(hoy)),
        isNull(schema.registro_emocional.deleted_at),
        isNull(schema.preguntas_registro_emocional.deleted_at),
      ),
    );

  const items = registros.map((registro) => ({
    dimension: registro.categoria ?? 'general',
    puntaje: Number(registro.puntaje ?? 0),
  }));

  return agruparPromedios(items, 4);
};

export const construirContextoBienestar = async (usuarioId: number): Promise<ContextoBienestarConstruido> => {
  const [perfilEmocional, semaforoActual, onboardingBase, registro7d] = await Promise.all([
    analizarPatronesEmocionales(usuarioId, 25),
    obtenerUltimoSemaforo(usuarioId),
    obtenerOnboardingBase(usuarioId),
    obtenerRegistroEmocional7d(usuarioId),
  ]);

  // Fase 5: si la evaluación ya trae `subcategoria_principal` persistida
  // (ver `obtenerUltimoSemaforo`), se respeta tal cual. Solo se recurre al
  // fallback heurístico (dimensión con mayor severidad en los últimos datos
  // agregados) cuando no hay subcategoría calculada, típicamente para
  // evaluaciones anteriores a esta fase.
  const semaforoConSubcategoria =
    semaforoActual && !semaforoActual.subcategoria && (onboardingBase[0]?.dimension || registro7d[0]?.dimension)
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

/**
 * Función auxiliar exportada para que otros servicios puedan leer la base
 * de onboarding de un usuario (ej: selector-estilo, registro emocional adaptativo).
 */
export const obtenerOnboardingBaseDimensiones = obtenerOnboardingBase;
