import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { OVA_ASIGNACION_ESTADO, OvaAsignacionEstado } from '../../shared/const/ova.const';
import { StorageUriResolver } from './storage-uri-resolver.service';

export interface CompletarAsignacionInput {
  liked: boolean;
  rating?: number;
}

export class FollowUpAndFeedbackService {
  /**
   * Obtiene las asignaciones activas de un estudiante:
   * - PENDING e IN_PROGRESS (para realizarlas o responder "¿ya lo hiciste?")
   * - COMPLETED pero sin post_evaluacion_id (cola pendiente de post-test para medir efectividad)
   */
  public static async listarAsignacionesEstudiante(usuarioId: number) {
    const asignaciones = await db
      .select({
        id: schema.ova_asignaciones.id,
        estudiante_id: schema.ova_asignaciones.estudiante_id,
        ova_id: schema.ova_asignaciones.ova_id,
        regla_id: schema.ova_asignaciones.regla_id,
        pre_evaluacion_id: schema.ova_asignaciones.pre_evaluacion_id,
        post_evaluacion_id: schema.ova_asignaciones.post_evaluacion_id,
        estado: schema.ova_asignaciones.estado,
        matched_dimension: schema.ova_asignaciones.matched_dimension,
        matched_nivel: schema.ova_asignaciones.matched_nivel,
        matched_subcategoria: schema.ova_asignaciones.matched_subcategoria,
        prioridad: schema.ova_asignaciones.prioridad,
        started_at: schema.ova_asignaciones.started_at,
        completed_at: schema.ova_asignaciones.completed_at,
        liked: schema.ova_asignaciones.liked,
        rating: schema.ova_asignaciones.rating,
        pre_puntaje: schema.ova_asignaciones.pre_puntaje,
        post_puntaje: schema.ova_asignaciones.post_puntaje,
        delta_puntaje: schema.ova_asignaciones.delta_puntaje,
        created_at: schema.ova_asignaciones.created_at,
        ova_titulo: schema.ovas.titulo,
        ova_descripcion: schema.ovas.descripcion,
        ova_tipo_actividad: schema.ovas.tipo_actividad,
        ova_duracion_minutos: schema.ovas.duracion_minutos,
        ova_storage_source: schema.ovas.storage_source,
        ova_resource_url: schema.ovas.resource_url,
      })
      .from(schema.ova_asignaciones)
      .innerJoin(schema.ovas, eq(schema.ova_asignaciones.ova_id, schema.ovas.id))
      .where(
        and(
          eq(schema.ova_asignaciones.estudiante_id, usuarioId),
          isNull(schema.ova_asignaciones.deleted_at),
          or(
            inArray(schema.ova_asignaciones.estado, [
              OVA_ASIGNACION_ESTADO.PENDING,
              OVA_ASIGNACION_ESTADO.IN_PROGRESS,
            ]),
            and(
              eq(schema.ova_asignaciones.estado, OVA_ASIGNACION_ESTADO.COMPLETED),
              isNull(schema.ova_asignaciones.post_evaluacion_id)
            )
          )
        )
      )
      .orderBy(desc(schema.ova_asignaciones.created_at));

    return asignaciones.map((a) => {
      const resolved = StorageUriResolver.resolve(a.ova_storage_source, a.ova_resource_url);
      const requierePostTest =
        a.estado === OVA_ASIGNACION_ESTADO.COMPLETED && a.post_evaluacion_id === null;

      return {
        id: a.id,
        estudiante_id: a.estudiante_id,
        ova_id: a.ova_id,
        pre_evaluacion_id: a.pre_evaluacion_id,
        post_evaluacion_id: a.post_evaluacion_id,
        estado: a.estado,
        requiere_post_test: requierePostTest,
        matched: {
          dimension: a.matched_dimension,
          nivel: a.matched_nivel,
          subcategoria: a.matched_subcategoria,
          prioridad: a.prioridad,
        },
        feedback: {
          started_at: a.started_at,
          completed_at: a.completed_at,
          liked: a.liked,
          rating: a.rating,
        },
        efectividad: {
          pre_puntaje: a.pre_puntaje,
          post_puntaje: a.post_puntaje,
          delta_puntaje: a.delta_puntaje,
        },
        ova: {
          id: a.ova_id,
          titulo: a.ova_titulo,
          descripcion: a.ova_descripcion,
          tipo_actividad: a.ova_tipo_actividad,
          duracion_minutos: a.ova_duracion_minutos,
          storage_source: a.ova_storage_source,
          recurso: resolved,
        },
        created_at: a.created_at,
      };
    });
  }

  /**
   * Obtiene el detalle de una asignación específica para el estudiante autenticado.
   */
  public static async obtenerAsignacionDetalle(asignacionId: number, usuarioId: number) {
    const [asignacion] = await db
      .select({
        id: schema.ova_asignaciones.id,
        estudiante_id: schema.ova_asignaciones.estudiante_id,
        ova_id: schema.ova_asignaciones.ova_id,
        regla_id: schema.ova_asignaciones.regla_id,
        pre_evaluacion_id: schema.ova_asignaciones.pre_evaluacion_id,
        post_evaluacion_id: schema.ova_asignaciones.post_evaluacion_id,
        estado: schema.ova_asignaciones.estado,
        matched_dimension: schema.ova_asignaciones.matched_dimension,
        matched_nivel: schema.ova_asignaciones.matched_nivel,
        matched_subcategoria: schema.ova_asignaciones.matched_subcategoria,
        prioridad: schema.ova_asignaciones.prioridad,
        started_at: schema.ova_asignaciones.started_at,
        completed_at: schema.ova_asignaciones.completed_at,
        liked: schema.ova_asignaciones.liked,
        rating: schema.ova_asignaciones.rating,
        pre_puntaje: schema.ova_asignaciones.pre_puntaje,
        post_puntaje: schema.ova_asignaciones.post_puntaje,
        delta_puntaje: schema.ova_asignaciones.delta_puntaje,
        created_at: schema.ova_asignaciones.created_at,
        ova_titulo: schema.ovas.titulo,
        ova_descripcion: schema.ovas.descripcion,
        ova_tipo_actividad: schema.ovas.tipo_actividad,
        ova_duracion_minutos: schema.ovas.duracion_minutos,
        ova_storage_source: schema.ovas.storage_source,
        ova_resource_url: schema.ovas.resource_url,
      })
      .from(schema.ova_asignaciones)
      .innerJoin(schema.ovas, eq(schema.ova_asignaciones.ova_id, schema.ovas.id))
      .where(
        and(
          eq(schema.ova_asignaciones.id, asignacionId),
          eq(schema.ova_asignaciones.estudiante_id, usuarioId),
          isNull(schema.ova_asignaciones.deleted_at)
        )
      )
      .limit(1);

    if (!asignacion) {
      return null;
    }

    const resolved = StorageUriResolver.resolve(
      asignacion.ova_storage_source,
      asignacion.ova_resource_url
    );
    const requierePostTest =
      asignacion.estado === OVA_ASIGNACION_ESTADO.COMPLETED &&
      asignacion.post_evaluacion_id === null;

    return {
      id: asignacion.id,
      estudiante_id: asignacion.estudiante_id,
      ova_id: asignacion.ova_id,
      pre_evaluacion_id: asignacion.pre_evaluacion_id,
      post_evaluacion_id: asignacion.post_evaluacion_id,
      estado: asignacion.estado,
      requiere_post_test: requierePostTest,
      matched: {
        dimension: asignacion.matched_dimension,
        nivel: asignacion.matched_nivel,
        subcategoria: asignacion.matched_subcategoria,
        prioridad: asignacion.prioridad,
      },
      feedback: {
        started_at: asignacion.started_at,
        completed_at: asignacion.completed_at,
        liked: asignacion.liked,
        rating: asignacion.rating,
      },
      efectividad: {
        pre_puntaje: asignacion.pre_puntaje,
        post_puntaje: asignacion.post_puntaje,
        delta_puntaje: asignacion.delta_puntaje,
      },
      ova: {
        id: asignacion.ova_id,
        titulo: asignacion.ova_titulo,
        descripcion: asignacion.ova_descripcion,
        tipo_actividad: asignacion.ova_tipo_actividad,
        duracion_minutos: asignacion.ova_duracion_minutos,
        storage_source: asignacion.ova_storage_source,
        recurso: resolved,
      },
      created_at: asignacion.created_at,
    };
  }

  /**
   * Transición: PENDING -> IN_PROGRESS
   */
  public static async iniciarAsignacion(asignacionId: number, usuarioId: number) {
    const [asignacion] = await db
      .select()
      .from(schema.ova_asignaciones)
      .where(
        and(
          eq(schema.ova_asignaciones.id, asignacionId),
          eq(schema.ova_asignaciones.estudiante_id, usuarioId),
          isNull(schema.ova_asignaciones.deleted_at)
        )
      )
      .limit(1);

    if (!asignacion) {
      return { error: 'Asignación no encontrada o no autorizada', status: 404 };
    }

    if (asignacion.estado === OVA_ASIGNACION_ESTADO.COMPLETED) {
      return { error: 'La actividad ya fue completada previamente', status: 400 };
    }

    if (
      asignacion.estado === OVA_ASIGNACION_ESTADO.SKIPPED ||
      asignacion.estado === OVA_ASIGNACION_ESTADO.DISMISSED
    ) {
      return { error: 'La actividad fue omitida o descartada', status: 400 };
    }

    const [actualizada] = await db
      .update(schema.ova_asignaciones)
      .set({
        estado: OVA_ASIGNACION_ESTADO.IN_PROGRESS,
        started_at: asignacion.started_at || new Date(),
        updated_at: new Date(),
      })
      .where(eq(schema.ova_asignaciones.id, asignacionId))
      .returning();

    return { data: actualizada };
  }

  /**
   * Transición: PENDING | IN_PROGRESS -> COMPLETED
   */
  public static async completarAsignacion(
    asignacionId: number,
    usuarioId: number,
    input: CompletarAsignacionInput
  ) {
    const [asignacion] = await db
      .select()
      .from(schema.ova_asignaciones)
      .where(
        and(
          eq(schema.ova_asignaciones.id, asignacionId),
          eq(schema.ova_asignaciones.estudiante_id, usuarioId),
          isNull(schema.ova_asignaciones.deleted_at)
        )
      )
      .limit(1);

    if (!asignacion) {
      return { error: 'Asignación no encontrada o no autorizada', status: 404 };
    }

    // COMPLETED es un estado terminal
    if (asignacion.estado === OVA_ASIGNACION_ESTADO.COMPLETED) {
      return {
        error: 'Esta asignación ya se encuentra completada',
        status: 400,
        requiere_post_test: asignacion.post_evaluacion_id === null,
        pre_evaluacion_id: asignacion.pre_evaluacion_id,
      };
    }

    if (
      asignacion.estado === OVA_ASIGNACION_ESTADO.SKIPPED ||
      asignacion.estado === OVA_ASIGNACION_ESTADO.DISMISSED
    ) {
      return { error: 'No se puede completar una actividad omitida o descartada', status: 400 };
    }

    const ahora = new Date();
    const ratingNormalizado =
      typeof input.rating === 'number' && input.rating >= 1 && input.rating <= 5
        ? Math.round(input.rating)
        : null;

    const [actualizada] = await db
      .update(schema.ova_asignaciones)
      .set({
        estado: OVA_ASIGNACION_ESTADO.COMPLETED,
        started_at: asignacion.started_at || ahora,
        completed_at: ahora,
        feedback_en: ahora,
        liked: Boolean(input.liked),
        rating: ratingNormalizado,
        updated_at: ahora,
      })
      .where(eq(schema.ova_asignaciones.id, asignacionId))
      .returning();

    return {
      data: {
        asignacion: actualizada,
        requiere_post_test: true,
        pre_evaluacion_id: actualizada.pre_evaluacion_id,
      },
    };
  }

  /**
   * Transición: PENDING | IN_PROGRESS -> SKIPPED | DISMISSED
   */
  public static async omitirAsignacion(
    asignacionId: number,
    usuarioId: number,
    estadoDestino: 'SKIPPED' | 'DISMISSED'
  ) {
    const [asignacion] = await db
      .select()
      .from(schema.ova_asignaciones)
      .where(
        and(
          eq(schema.ova_asignaciones.id, asignacionId),
          eq(schema.ova_asignaciones.estudiante_id, usuarioId),
          isNull(schema.ova_asignaciones.deleted_at)
        )
      )
      .limit(1);

    if (!asignacion) {
      return { error: 'Asignación no encontrada o no autorizada', status: 404 };
    }

    if (asignacion.estado === OVA_ASIGNACION_ESTADO.COMPLETED) {
      return { error: 'No se puede omitir una actividad que ya fue completada', status: 400 };
    }

    const [actualizada] = await db
      .update(schema.ova_asignaciones)
      .set({
        estado: estadoDestino,
        updated_at: new Date(),
      })
      .where(eq(schema.ova_asignaciones.id, asignacionId))
      .returning();

    return { data: actualizada };
  }
}
