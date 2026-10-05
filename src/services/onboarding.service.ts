import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import {
  agruparPuntajesPorDimension,
  construirSubcategoriaPrincipal,
  determinarDimensionDominante,
  calcularNivelPorPuntaje,
  obtenerRecomendacionesPorEstado,
  DIMENSION_GENERAL,
} from '../shared/utils/semaforo-dimensiones.utils';

interface PreguntaOnboarding {
  id: string;
  texto: string;
  categoria: string;
  escala: string;
}

interface OnboardingData {
  preguntas: PreguntaOnboarding[];
}

export const getPreguntasOnboardingService = async (usuarioId: number) => {
  const [encuesta] = await db
    .select()
    .from(schema.encuestas)
    .where(
      and(
        eq(schema.encuestas.codigo, 'ONBOARDING_INICIAL'),
        isNull(schema.encuestas.deleted_at),
      ),
    )
    .limit(1);

  const [usuario] = await db
    .select({ onboarding_completado: schema.usuarios.onboarding_completado })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, usuarioId))
    .limit(1);

  const completado = usuario?.onboarding_completado ?? false;

  // La ausencia del catalogo no es un error de servidor: es un estado valido
  // de negocio (encuesta aun no sembrada). Se responde 200 con lista vacia.
  if (!encuesta) {
    return {
      encuesta_id: null,
      titulo: null,
      preguntas: [],
      completado,
    };
  }

  let data: OnboardingData = { preguntas: [] };
  if (encuesta.opciones) {
    try {
      data = JSON.parse(encuesta.opciones) as OnboardingData;
    } catch (error) {
      console.warn('No se pudo parsear encuesta.opciones del onboarding:', error);
      data = { preguntas: [] };
    }
  }

  return {
    encuesta_id: encuesta.id,
    titulo: encuesta.titulo,
    preguntas: Array.isArray(data.preguntas) ? data.preguntas : [],
    completado,
  };
};

export const saveRespuestasOnboardingService = async (
  usuarioId: number,
  respuestas: Array<{ pregunta_id: string; puntaje: number }>,
) => {
  const [encuesta] = await db
    .select()
    .from(schema.encuestas)
    .where(
      and(
        eq(schema.encuestas.codigo, 'ONBOARDING_INICIAL'),
        isNull(schema.encuestas.deleted_at),
      ),
    )
    .limit(1);

  if (!encuesta) {
    const error = new Error('Encuesta de onboarding no encontrada');
    (error as any).code = 'ENCUESTA_NO_ENCONTRADA';
    throw error;
  }

  let onboardingData: OnboardingData = { preguntas: [] };
  if (encuesta.opciones) {
    try {
      onboardingData = JSON.parse(encuesta.opciones) as OnboardingData;
    } catch (error) {
      console.warn('No se pudo parsear encuesta.opciones del onboarding:', error);
    }
  }

  const preguntasMap = new Map(onboardingData.preguntas.map((p) => [p.id, p]));

  // Escala onboarding 0-4: 0 = "Muy mal" (100% gravedad), 4 = "Excelente" (0% gravedad)
  // "Normal" (2) => 50% gravedad => Amarillo (40-69)
  const itemsPorDimension = respuestas.map((r) => {
    const pregunta = preguntasMap.get(r.pregunta_id);
    const dimension = pregunta?.categoria || DIMENSION_GENERAL;
    const puntajeNormalizado = Math.max(0, Math.min(100, ((4 - r.puntaje) / 4) * 100));
    return { dimension, puntaje: puntajeNormalizado };
  });

  const totalPuntaje = respuestas.reduce((acc, item) => acc + (item.puntaje ?? 0), 0);
  const promedioPuntaje = respuestas.length > 0 ? totalPuntaje / respuestas.length : 2;
  const puntajeGravedad = Math.round(
    Math.max(0, Math.min(100, ((4 - promedioPuntaje) / 4) * 100))
  );

  const estado = calcularNivelPorPuntaje(puntajeGravedad);
  const dimensionesCalculadas = agruparPuntajesPorDimension(itemsPorDimension);
  const dimensionDominante = determinarDimensionDominante(dimensionesCalculadas);
  const subcategoriaPrincipal = dimensionDominante
    ? construirSubcategoriaPrincipal(estado, dimensionDominante.dimension)
    : null;

  const recs = obtenerRecomendacionesPorEstado(estado, subcategoriaPrincipal);

  const { evaluacionRow } = await db.transaction(async (tx) => {
    // Guardar respuesta de la encuesta de onboarding
    await tx.insert(schema.encuestasRespuestas).values({
      usuario_id: usuarioId,
      encuesta_id: encuesta.id,
      respuesta: JSON.stringify({ respuestas }),
    });

    await tx
      .update(schema.usuarios)
      .set({ onboarding_completado: true, updated_at: new Date() })
      .where(eq(schema.usuarios.id, usuarioId));

    // Sincronizar la tabla de evaluaciones
    const [ultimaEvaluacion] = await tx
      .select()
      .from(schema.evaluaciones)
      .where(eq(schema.evaluaciones.usuario_id, usuarioId))
      .orderBy(desc(schema.evaluaciones.fecha))
      .limit(1);

    let evaluacion;
    const observacionOnboarding = `Onboarding inicial: ${estado} (puntaje ${puntajeGravedad})`;

    if (ultimaEvaluacion) {
      [evaluacion] = await tx
        .update(schema.evaluaciones)
        .set({
          puntaje_total: puntajeGravedad,
          estado_semaforo: estado,
          observaciones: observacionOnboarding,
          subcategoria_principal: subcategoriaPrincipal ?? ultimaEvaluacion.subcategoria_principal,
          updated_at: new Date(),
        })
        .where(eq(schema.evaluaciones.id, ultimaEvaluacion.id))
        .returning();
    } else {
      [evaluacion] = await tx
        .insert(schema.evaluaciones)
        .values({
          usuario_id: usuarioId,
          puntaje_total: puntajeGravedad,
          estado_semaforo: estado,
          observaciones: observacionOnboarding,
          subcategoria_principal: subcategoriaPrincipal,
        })
        .returning();
    }

    if (evaluacion && dimensionesCalculadas.length > 0) {
      await tx
        .update(schema.semaforo_dimensiones)
        .set({ deleted_at: new Date() })
        .where(eq(schema.semaforo_dimensiones.evaluacion_id, evaluacion.id));

      await tx.insert(schema.semaforo_dimensiones).values(
        dimensionesCalculadas.map((d) => ({
          evaluacion_id: evaluacion.id,
          dimension: d.dimension,
          puntaje: d.puntaje,
          nivel: d.nivel,
        }))
      );
    }

    return { evaluacionRow: evaluacion };
  });

  const evaluacionPayload = {
    ...evaluacionRow,
    estado: estado,
    estado_semaforo: estado,
    puntaje: puntajeGravedad,
    puntaje_total: puntajeGravedad,
    subcategoria_principal: subcategoriaPrincipal,
    dimensiones: dimensionesCalculadas,
    recomendaciones: recs,
    sugerencias: recs,
  };

  return {
    message: 'Onboarding completado exitosamente',
    estado: estado,
    estado_semaforo: estado,
    puntaje: puntajeGravedad,
    puntaje_total: puntajeGravedad,
    subcategoria_principal: subcategoriaPrincipal,
    dimensiones: dimensionesCalculadas,
    recomendaciones: recs,
    sugerencias: recs,
    evaluacion: evaluacionPayload,
  };
};


export const getEstadoOnboardingService = async (usuarioId: number) => {
  const [usuario] = await db
    .select({ onboarding_completado: schema.usuarios.onboarding_completado })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, usuarioId))
    .limit(1);

  return { completado: usuario?.onboarding_completado ?? false };
};
