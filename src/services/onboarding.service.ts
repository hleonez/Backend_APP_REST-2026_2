import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';

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

  if (!encuesta) {
    throw new Error('Encuesta de onboarding no encontrada');
  }

  const [usuario] = await db
    .select({ onboarding_completado: schema.usuarios.onboarding_completado })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, usuarioId))
    .limit(1);

  const data: OnboardingData = encuesta.opciones
    ? JSON.parse(encuesta.opciones)
    : { preguntas: [] };

  return {
    encuesta_id: encuesta.id,
    titulo: encuesta.titulo,
    preguntas: data.preguntas,
    completado: usuario?.onboarding_completado ?? false,
  };
};

export const saveRespuestasOnboardingService = async (
  usuarioId: number,
  respuestas: Array<{ pregunta_id: string; puntaje: number }>,
) => {
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

  if (!encuesta) {
    throw new Error('Encuesta de onboarding no encontrada');
  }

  const [usuario] = await db
    .select({ onboarding_completado: schema.usuarios.onboarding_completado })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, usuarioId))
    .limit(1);

  if (usuario?.onboarding_completado) {
    throw new Error('El onboarding ya fue completado anteriormente');
  }

  await db.transaction(async (tx) => {
    await tx.insert(schema.encuestasRespuestas).values({
      usuario_id: usuarioId,
      encuesta_id: encuesta.id,
      respuesta: JSON.stringify({ respuestas }),
    });

    await tx
      .update(schema.usuarios)
      .set({ onboarding_completado: true, updated_at: new Date() })
      .where(eq(schema.usuarios.id, usuarioId));
  });

  return { message: 'Onboarding completado exitosamente' };
};

export const getEstadoOnboardingService = async (usuarioId: number) => {
  const [usuario] = await db
    .select({ onboarding_completado: schema.usuarios.onboarding_completado })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, usuarioId))
    .limit(1);

  return { completado: usuario?.onboarding_completado ?? false };
};
