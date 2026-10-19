import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import * as schema from '../../db/schema';
import {
  OVA_ASIGNACION_ESTADO,
  OVA_COOLDOWN_DAYS,
  OVA_MAX_ASIGNACIONES_POR_EVALUACION,
} from '../../shared/const/ova.const';
import { StorageUriResolver } from './storage-uri-resolver.service';

export interface EvaluacionDimensionInput {
  dimension: string;
  nivel: string;
  puntaje: number;
}

export interface RunEngineParams {
  evaluacionId: number;
  usuarioId: number;
  estadoSemaforo: string;
  subcategoriaPrincipal?: string | null;
  dimensiones: EvaluacionDimensionInput[];
  tx?: any;
}

interface MatchCandidate {
  ovaId: number;
  reglaId: number;
  prioridad: number;
  matchedDimension: string | null;
  matchedNivel: string | null;
}

export class RuleAssignmentEngine {
  /**
   * Ejecuta el motor de reglas tras persistir una evaluación o actualizar el semáforo.
   */
  public static async run(params: RunEngineParams): Promise<any[]> {
    const { evaluacionId, usuarioId, estadoSemaforo, subcategoriaPrincipal, dimensiones, tx } = params;
    const runner = tx || db;

    try {
      // 1. Obtener reglas activas de OVAs activos
      const reglasActivas = await runner
        .select({
          reglaId: schema.ova_reglas.id,
          ovaId: schema.ova_reglas.ova_id,
          dimension: schema.ova_reglas.dimension,
          nivel: schema.ova_reglas.nivel,
          prioridad: schema.ova_reglas.prioridad,
        })
        .from(schema.ova_reglas)
        .innerJoin(schema.ovas, eq(schema.ova_reglas.ova_id, schema.ovas.id))
        .where(
          and(
            eq(schema.ova_reglas.is_active, true),
            isNull(schema.ova_reglas.deleted_at),
            eq(schema.ovas.is_active, true),
            isNull(schema.ovas.deleted_at)
          )
        )
        .orderBy(desc(schema.ova_reglas.prioridad));

      if (!reglasActivas || reglasActivas.length === 0) {
        return [];
      }

      // Mapa de dimensiones de la evaluación actual (en minúsculas para robustez)
      const dimensionesMap = new Map<string, string>();
      for (const d of dimensiones) {
        if (d.dimension && d.nivel) {
          dimensionesMap.set(d.dimension.toLowerCase().trim(), d.nivel.toLowerCase().trim());
        }
      }

      const estadoSemaforoNormalizado = (estadoSemaforo || '').toLowerCase().trim();

      // 2. Filtrar matches
      const candidatos: MatchCandidate[] = [];

      for (const regla of reglasActivas) {
        const reglaDim = regla.dimension ? regla.dimension.toLowerCase().trim() : null;
        const reglaNivel = regla.nivel ? regla.nivel.toLowerCase().trim() : null;

        let match = false;
        let matchedDim: string | null = null;
        let matchedNiv: string | null = null;

        if (reglaDim) {
          // La regla especifica dimensión
          const nivelEvaluado = dimensionesMap.get(reglaDim);
          if (nivelEvaluado) {
            if (reglaNivel) {
              if (nivelEvaluado === reglaNivel) {
                match = true;
                matchedDim = regla.dimension;
                matchedNiv = regla.nivel;
              }
            } else {
              // Si no tiene nivel, dispara si está en amarillo o rojo (no en verde)
              if (nivelEvaluado === 'amarillo' || nivelEvaluado === 'rojo') {
                match = true;
                matchedDim = regla.dimension;
                matchedNiv = nivelEvaluado;
              }
            }
          }
        } else if (reglaNivel) {
          // La regla solo especifica nivel global del semáforo
          if (estadoSemaforoNormalizado === reglaNivel) {
            match = true;
            matchedDim = null;
            matchedNiv = regla.nivel;
          }
        }

        if (match) {
          candidatos.push({
            ovaId: regla.ovaId,
            reglaId: regla.reglaId,
            prioridad: regla.prioridad,
            matchedDimension: matchedDim,
            matchedNivel: matchedNiv,
          });
        }
      }

      if (candidatos.length === 0) {
        return [];
      }

      // 3. Obtener historial reciente del estudiante para aplicar cooldowns y evitar duplicados
      const ovaIdsCandidatos = Array.from(new Set(candidatos.map((c) => c.ovaId)));

      const asignacionesPrevias = await runner
        .select({
          id: schema.ova_asignaciones.id,
          ovaId: schema.ova_asignaciones.ova_id,
          estado: schema.ova_asignaciones.estado,
          completedAt: schema.ova_asignaciones.completed_at,
          updatedAt: schema.ova_asignaciones.updated_at,
          createdAt: schema.ova_asignaciones.created_at,
        })
        .from(schema.ova_asignaciones)
        .where(
          and(
            eq(schema.ova_asignaciones.estudiante_id, usuarioId),
            inArray(schema.ova_asignaciones.ova_id, ovaIdsCandidatos),
            isNull(schema.ova_asignaciones.deleted_at)
          )
        );

      const ahora = new Date();
      const ovasBloqueadosPorCooldown = new Set<number>();

      for (const prev of asignacionesPrevias) {
        // Bloqueo estricto: Si ya tiene PENDING o IN_PROGRESS, no puede recibir otra
        if (
          prev.estado === OVA_ASIGNACION_ESTADO.PENDING ||
          prev.estado === OVA_ASIGNACION_ESTADO.IN_PROGRESS
        ) {
          ovasBloqueadosPorCooldown.add(prev.ovaId);
          continue;
        }

        // Cooldown tras COMPLETED (14 días)
        if (prev.estado === OVA_ASIGNACION_ESTADO.COMPLETED) {
          const fechaRef = prev.completedAt || prev.updatedAt || prev.createdAt;
          const diffMs = ahora.getTime() - new Date(fechaRef).getTime();
          const diffDias = diffMs / (1000 * 60 * 60 * 24);
          if (diffDias < OVA_COOLDOWN_DAYS.COMPLETED) {
            ovasBloqueadosPorCooldown.add(prev.ovaId);
            continue;
          }
        }

        // Cooldown tras SKIPPED o DISMISSED (7 días)
        if (
          prev.estado === OVA_ASIGNACION_ESTADO.SKIPPED ||
          prev.estado === OVA_ASIGNACION_ESTADO.DISMISSED
        ) {
          const fechaRef = prev.updatedAt || prev.createdAt;
          const diffMs = ahora.getTime() - new Date(fechaRef).getTime();
          const diffDias = diffMs / (1000 * 60 * 60 * 24);
          if (diffDias < OVA_COOLDOWN_DAYS.SKIPPED) {
            ovasBloqueadosPorCooldown.add(prev.ovaId);
            continue;
          }
        }
      }

      // 4. Filtrar y ordenar candidatos válidos por prioridad descendente
      // Garantizar 1 recomendación por OVA (el de mayor prioridad si hay múltiples reglas)
      const candidatosFiltrados = candidatos.filter((c) => !ovasBloqueadosPorCooldown.has(c.ovaId));
      candidatosFiltrados.sort((a, b) => b.prioridad - a.prioridad);

      const seleccionadosPorOva = new Map<number, MatchCandidate>();
      for (const cand of candidatosFiltrados) {
        if (!seleccionadosPorOva.has(cand.ovaId)) {
          seleccionadosPorOva.set(cand.ovaId, cand);
        }
        if (seleccionadosPorOva.size >= OVA_MAX_ASIGNACIONES_POR_EVALUACION) {
          break;
        }
      }

      const matchesFinales = Array.from(seleccionadosPorOva.values());
      if (matchesFinales.length === 0) {
        return [];
      }

      // 5. Insertar asignaciones PENDING
      const asignacionesCreadas: any[] = [];

      for (const m of matchesFinales) {
        try {
          const [nuevaAsignacion] = await runner
            .insert(schema.ova_asignaciones)
            .values({
              estudiante_id: usuarioId,
              ova_id: m.ovaId,
              regla_id: m.reglaId,
              pre_evaluacion_id: evaluacionId,
              estado: OVA_ASIGNACION_ESTADO.PENDING,
              matched_dimension: m.matchedDimension,
              matched_nivel: m.matchedNivel,
              matched_subcategoria: subcategoriaPrincipal || null,
              prioridad: m.prioridad,
            })
            .returning();

          if (nuevaAsignacion) {
            // Traer datos del OVA para devolverlo resuelto
            const [ovaData] = await runner
              .select()
              .from(schema.ovas)
              .where(eq(schema.ovas.id, m.ovaId))
              .limit(1);

            const resolved = ovaData
              ? StorageUriResolver.resolve(ovaData.storage_source, ovaData.resource_url)
              : null;

            asignacionesCreadas.push({
              ...nuevaAsignacion,
              ova: ovaData ? { ...ovaData, recurso_resuelto: resolved } : null,
            });
          }
        } catch (err: any) {
          // Tragar error 23505 (unique_violation) por concurrencia idempotente
          if (err.code === '23505') {
            console.warn(`[RuleAssignmentEngine] Asignación duplicada evitada por índice único para usuario ${usuarioId}, ova ${m.ovaId}`);
          } else {
            console.error('[RuleAssignmentEngine] Error insertando asignación de OVA:', err);
          }
        }
      }

      return asignacionesCreadas;
    } catch (globalErr) {
      console.error('[RuleAssignmentEngine] Error inesperado en el motor de asignaciones:', globalErr);
      return [];
    }
  }
}
