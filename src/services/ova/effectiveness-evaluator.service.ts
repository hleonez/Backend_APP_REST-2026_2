import { and, avg, count, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { OVA_ASIGNACION_ESTADO } from '../../shared/const/ova.const';

export interface EnlazarPostTestParams {
  ovaAsignacionId: number;
  postEvaluacionId: number;
  usuarioId: number;
  postPuntaje: number;
  postEstadoSemaforo: string;
  tx?: any;
}

export class EffectivenessEvaluator {
  /**
   * Enlaza una nueva evaluación como post-test de una asignación completada y calcula el delta.
   * delta_puntaje = post_puntaje - pre_puntaje (Delta negativo = mejoría).
   */
  public static async enlazarPostTest(params: EnlazarPostTestParams) {
    const { ovaAsignacionId, postEvaluacionId, usuarioId, postPuntaje, postEstadoSemaforo, tx } = params;
    const runner = tx || db;

    // 1. Validar la asignación
    const [asignacion] = await runner
      .select()
      .from(schema.ova_asignaciones)
      .where(
        and(
          eq(schema.ova_asignaciones.id, ovaAsignacionId),
          eq(schema.ova_asignaciones.estudiante_id, usuarioId),
          isNull(schema.ova_asignaciones.deleted_at)
        )
      )
      .limit(1);

    if (!asignacion) {
      console.warn(`[EffectivenessEvaluator] Asignación ${ovaAsignacionId} no encontrada para el usuario ${usuarioId}`);
      return null;
    }

    if (asignacion.estado !== OVA_ASIGNACION_ESTADO.COMPLETED) {
      console.warn(`[EffectivenessEvaluator] Asignación ${ovaAsignacionId} no está en estado COMPLETED (estado actual: ${asignacion.estado})`);
      return null;
    }

    if (asignacion.post_evaluacion_id !== null) {
      console.warn(`[EffectivenessEvaluator] Asignación ${ovaAsignacionId} ya tiene post-test asignado (${asignacion.post_evaluacion_id})`);
      return null;
    }

    if (asignacion.pre_evaluacion_id === postEvaluacionId) {
      console.warn(`[EffectivenessEvaluator] postEvaluacionId no puede ser igual a preEvaluacionId`);
      return null;
    }

    // 2. Obtener puntaje de la pre-evaluación
    const [preEvaluacion] = await runner
      .select({
        puntaje: schema.evaluaciones.puntaje_total,
        estado: schema.evaluaciones.estado_semaforo,
      })
      .from(schema.evaluaciones)
      .where(eq(schema.evaluaciones.id, asignacion.pre_evaluacion_id))
      .limit(1);

    const prePuntaje = preEvaluacion?.puntaje ?? 0;
    const preEstado = preEvaluacion?.estado ?? 'verde';

    // 3. Calcular Delta: post - pre
    const delta = Number((postPuntaje - prePuntaje).toFixed(2));

    // 4. Actualizar asignación con la fotografía de efectividad
    const [actualizada] = await runner
      .update(schema.ova_asignaciones)
      .set({
        post_evaluacion_id: postEvaluacionId,
        pre_puntaje: prePuntaje.toString(),
        post_puntaje: postPuntaje.toString(),
        delta_puntaje: delta.toString(),
        pre_estado_semaforo: preEstado,
        post_estado_semaforo: postEstadoSemaforo,
        updated_at: new Date(),
      })
      .where(eq(schema.ova_asignaciones.id, ovaAsignacionId))
      .returning();

    return actualizada;
  }

  /**
   * Genera el reporte agregado de efectividad global para el portal del psicólogo.
   */
  public static async obtenerReporteGlobal() {
    return this.calcularMetricasReporte();
  }

  /**
   * Genera el reporte de efectividad filtrado para un OVA específico.
   */
  public static async obtenerReportePorOva(ovaId: number) {
    return this.calcularMetricasReporte(ovaId);
  }

  private static async calcularMetricasReporte(ovaId?: number) {
    const condicionesWhere = [isNull(schema.ova_asignaciones.deleted_at)];
    if (ovaId) {
      condicionesWhere.push(eq(schema.ova_asignaciones.ova_id, ovaId));
    }

    const asignaciones = await db
      .select({
        id: schema.ova_asignaciones.id,
        ovaId: schema.ova_asignaciones.ova_id,
        estado: schema.ova_asignaciones.estado,
        liked: schema.ova_asignaciones.liked,
        rating: schema.ova_asignaciones.rating,
        deltaPuntaje: schema.ova_asignaciones.delta_puntaje,
        matchedDimension: schema.ova_asignaciones.matched_dimension,
        matchedNivel: schema.ova_asignaciones.matched_nivel,
        postEvaluacionId: schema.ova_asignaciones.post_evaluacion_id,
      })
      .from(schema.ova_asignaciones)
      .where(and(...condicionesWhere));

    const totalAsignadas = asignaciones.length;
    let totalCompletadas = 0;
    let totalOmitidas = 0;
    let totalLiked = 0;
    let totalFeedbackCount = 0;
    let sumaRating = 0;
    let countRating = 0;
    let sumaDelta = 0;
    let countDelta = 0;
    let totalConMejoria = 0; // delta < 0

    // Desgloses por dimensión y nivel
    const porDimension: Record<string, { total: number; completadas: number; conMejoria: number; deltas: number[] }> = {};
    const porNivel: Record<string, { total: number; completadas: number; conMejoria: number; deltas: number[] }> = {};

    for (const a of asignaciones) {
      const dim = a.matchedDimension || 'global';
      const niv = a.matchedNivel || 'no_especificado';

      if (!porDimension[dim]) {
        porDimension[dim] = { total: 0, completadas: 0, conMejoria: 0, deltas: [] };
      }
      porDimension[dim].total++;

      if (!porNivel[niv]) {
        porNivel[niv] = { total: 0, completadas: 0, conMejoria: 0, deltas: [] };
      }
      porNivel[niv].total++;

      if (a.estado === OVA_ASIGNACION_ESTADO.COMPLETED) {
        totalCompletadas++;
        porDimension[dim].completadas++;
        porNivel[niv].completadas++;

        if (a.liked !== null && a.liked !== undefined) {
          totalFeedbackCount++;
          if (a.liked) totalLiked++;
        }

        if (a.rating !== null && a.rating !== undefined) {
          sumaRating += Number(a.rating);
          countRating++;
        }

        if (a.deltaPuntaje !== null && a.deltaPuntaje !== undefined) {
          const deltaNum = Number(a.deltaPuntaje);
          sumaDelta += deltaNum;
          countDelta++;
          porDimension[dim].deltas.push(deltaNum);
          porNivel[niv].deltas.push(deltaNum);

          if (deltaNum < 0) {
            totalConMejoria++;
            porDimension[dim].conMejoria++;
            porNivel[niv].conMejoria++;
          }
        }
      } else if (
        a.estado === OVA_ASIGNACION_ESTADO.SKIPPED ||
        a.estado === OVA_ASIGNACION_ESTADO.DISMISSED
      ) {
        totalOmitidas++;
      }
    }

    const terminadas = totalCompletadas + totalOmitidas;
    const tasaAdherencia = terminadas > 0 ? Number(((totalCompletadas / terminadas) * 100).toFixed(1)) : 0;
    const porcentajeLiked = totalFeedbackCount > 0 ? Number(((totalLiked / totalFeedbackCount) * 100).toFixed(1)) : 0;
    const ratingPromedio = countRating > 0 ? Number((sumaRating / countRating).toFixed(1)) : null;
    const deltaPromedio = countDelta > 0 ? Number((sumaDelta / countDelta).toFixed(2)) : null;
    const porcentajeMejoria = countDelta > 0 ? Number(((totalConMejoria / countDelta) * 100).toFixed(1)) : 0;

    const desgloseDimension = Object.entries(porDimension).map(([dim, data]) => ({
      dimension: dim,
      total_asignadas: data.total,
      total_completadas: data.completadas,
      casos_con_mejoria: data.conMejoria,
      delta_promedio: data.deltas.length > 0 ? Number((data.deltas.reduce((acc, d) => acc + d, 0) / data.deltas.length).toFixed(2)) : null,
    }));

    const desgloseNivel = Object.entries(porNivel).map(([niv, data]) => ({
      nivel: niv,
      total_asignadas: data.total,
      total_completadas: data.completadas,
      casos_con_mejoria: data.conMejoria,
      delta_promedio: data.deltas.length > 0 ? Number((data.deltas.reduce((acc, d) => acc + d, 0) / data.deltas.length).toFixed(2)) : null,
    }));

    return {
      resumen: {
        total_asignadas: totalAsignadas,
        total_completadas: totalCompletadas,
        total_omitidas: totalOmitidas,
        tasa_adherencia_porcentaje: tasaAdherencia,
        porcentaje_liked: porcentajeLiked,
        rating_promedio: ratingPromedio,
        evaluaciones_post_test_completadas: countDelta,
        delta_promedio: deltaPromedio,
        casos_con_mejoria: totalConMejoria,
        porcentaje_mejoria: porcentajeMejoria,
      },
      desglose_por_dimension: desgloseDimension,
      desglose_por_nivel: desgloseNivel,
    };
  }
}
