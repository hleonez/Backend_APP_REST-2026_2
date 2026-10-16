import { Response } from 'express';
import { z } from 'zod';
import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { AuthRequest } from '../../middleware/auth.middleware';
import {
  DIMENSIONES_SEMAFORO_PERMITIDAS,
  NIVELES_SEMAFORO_PERMITIDOS,
  OVA_STORAGE_SOURCE,
  OVA_TIPO_ACTIVIDAD,
} from '../../shared/const/ova.const';
import { StorageUriResolver } from '../../services/ova/storage-uri-resolver.service';
import { EffectivenessEvaluator } from '../../services/ova/effectiveness-evaluator.service';

const crearOvaSchema = z.object({
  titulo: z.string().min(3).max(255),
  descripcion: z.string().optional(),
  tipo_actividad: z.enum([
    OVA_TIPO_ACTIVIDAD.VIDEO,
    OVA_TIPO_ACTIVIDAD.RESPIRACION,
    OVA_TIPO_ACTIVIDAD.EJERCICIO_PRACTICO,
  ]),
  duracion_minutos: z.number().int().min(1).max(180).default(5),
  storage_source: z.enum([
    OVA_STORAGE_SOURCE.YOUTUBE,
    OVA_STORAGE_SOURCE.CLOUDFLARE_R2,
    OVA_STORAGE_SOURCE.EXTERNAL_URL,
  ]),
  resource_url: z.string().min(1),
  is_active: z.boolean().default(true),
});

const actualizarOvaSchema = z.object({
  titulo: z.string().min(3).max(255).optional(),
  descripcion: z.string().optional(),
  tipo_actividad: z
    .enum([
      OVA_TIPO_ACTIVIDAD.VIDEO,
      OVA_TIPO_ACTIVIDAD.RESPIRACION,
      OVA_TIPO_ACTIVIDAD.EJERCICIO_PRACTICO,
    ])
    .optional(),
  duracion_minutos: z.number().int().min(1).max(180).optional(),
  storage_source: z
    .enum([
      OVA_STORAGE_SOURCE.YOUTUBE,
      OVA_STORAGE_SOURCE.CLOUDFLARE_R2,
      OVA_STORAGE_SOURCE.EXTERNAL_URL,
    ])
    .optional(),
  resource_url: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

const crearReglaSchema = z
  .object({
    dimension: z.enum(DIMENSIONES_SEMAFORO_PERMITIDAS).optional(),
    nivel: z.enum(NIVELES_SEMAFORO_PERMITIDOS).optional(),
    prioridad: z.number().int().min(0).max(100).default(0),
    is_active: z.boolean().default(true),
  })
  .refine((data) => data.dimension !== undefined || data.nivel !== undefined, {
    message: 'Se requiere al menos especificar una dimension o un nivel de semaforo',
  });

const actualizarReglaSchema = z.object({
  dimension: z.enum(DIMENSIONES_SEMAFORO_PERMITIDAS).optional().nullable(),
  nivel: z.enum(NIVELES_SEMAFORO_PERMITIDOS).optional().nullable(),
  prioridad: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
});

export class OvaPsicologoController {
  /**
   * Lista el catálogo general de OVAs para el portal del psicólogo
   */
  public static async listarOvas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const q = req.query.q as string | undefined;
      const tipo = req.query.tipo as string | undefined;
      const activo = req.query.activo as string | undefined;

      const whereConditions = [isNull(schema.ovas.deleted_at)];

      if (activo !== undefined) {
        whereConditions.push(eq(schema.ovas.is_active, activo === 'true'));
      }

      if (tipo) {
        whereConditions.push(eq(schema.ovas.tipo_actividad, tipo));
      }

      if (q && q.trim().length > 0) {
        whereConditions.push(ilike(schema.ovas.titulo, `%${q.trim()}%`));
      }

      const lista = await db
        .select()
        .from(schema.ovas)
        .where(and(...whereConditions))
        .orderBy(desc(schema.ovas.created_at));

      const ovasConRecurso = lista.map((ova) => ({
        ...ova,
        recurso_resuelto: StorageUriResolver.resolve(ova.storage_source, ova.resource_url),
      }));

      res.json({
        total: ovasConRecurso.length,
        ovas: ovasConRecurso,
      });
    } catch (error) {
      console.error('[OvaPsicologoController] Error listando OVAs:', error);
      res.status(500).json({ message: 'Error interno obteniendo catálogo de OVAs' });
    }
  }

  /**
   * Crea un nuevo OVA en el catálogo
   */
  public static async crearOva(req: AuthRequest, res: Response): Promise<void> {
    try {
      const parsed = crearOvaSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
        return;
      }

      const { titulo, descripcion, tipo_actividad, duracion_minutos, storage_source, resource_url, is_active } =
        parsed.data;

      // Validación de URL con StorageUriResolver
      const validacionUrl = StorageUriResolver.validateResourceUrl(storage_source, resource_url);
      if (!validacionUrl.isValid) {
        res.status(400).json({ message: validacionUrl.error });
        return;
      }

      const [nuevo] = await db
        .insert(schema.ovas)
        .values({
          titulo,
          descripcion: descripcion || null,
          tipo_actividad,
          duracion_minutos,
          storage_source,
          resource_url: resource_url.trim(),
          is_active,
          creado_por: req.user?.id || null,
        })
        .returning();

      res.status(201).json({
        message: 'OVA creado exitosamente',
        ova: {
          ...nuevo,
          recurso_resuelto: StorageUriResolver.resolve(nuevo.storage_source, nuevo.resource_url),
        },
      });
    } catch (error) {
      console.error('[OvaPsicologoController] Error creando OVA:', error);
      res.status(500).json({ message: 'Error interno al registrar el OVA' });
    }
  }

  /**
   * Obtiene el detalle de un OVA con sus reglas
   */
  public static async obtenerOva(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ message: 'ID de OVA inválido' });
        return;
      }

      const [ova] = await db
        .select()
        .from(schema.ovas)
        .where(and(eq(schema.ovas.id, id), isNull(schema.ovas.deleted_at)))
        .limit(1);

      if (!ova) {
        res.status(404).json({ message: 'OVA no encontrado' });
        return;
      }

      const reglas = await db
        .select()
        .from(schema.ova_reglas)
        .where(and(eq(schema.ova_reglas.ova_id, id), isNull(schema.ova_reglas.deleted_at)))
        .orderBy(desc(schema.ova_reglas.prioridad));

      res.json({
        ...ova,
        recurso_resuelto: StorageUriResolver.resolve(ova.storage_source, ova.resource_url),
        reglas,
      });
    } catch (error) {
      console.error('[OvaPsicologoController] Error obteniendo OVA:', error);
      res.status(500).json({ message: 'Error interno obteniendo el OVA' });
    }
  }

  /**
   * Actualiza los datos de un OVA
   */
  public static async actualizarOva(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ message: 'ID de OVA inválido' });
        return;
      }

      const parsed = actualizarOvaSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
        return;
      }

      const [existente] = await db
        .select()
        .from(schema.ovas)
        .where(and(eq(schema.ovas.id, id), isNull(schema.ovas.deleted_at)))
        .limit(1);

      if (!existente) {
        res.status(404).json({ message: 'OVA no encontrado' });
        return;
      }

      const sourceAValidar = parsed.data.storage_source || existente.storage_source;
      const urlAValidar = parsed.data.resource_url || existente.resource_url;

      if (parsed.data.resource_url || parsed.data.storage_source) {
        const val = StorageUriResolver.validateResourceUrl(sourceAValidar, urlAValidar);
        if (!val.isValid) {
          res.status(400).json({ message: val.error });
          return;
        }
      }

      const [actualizado] = await db
        .update(schema.ovas)
        .set({
          ...parsed.data,
          resource_url: parsed.data.resource_url ? parsed.data.resource_url.trim() : undefined,
          updated_at: new Date(),
        })
        .where(eq(schema.ovas.id, id))
        .returning();

      res.json({
        message: 'OVA actualizado correctamente',
        ova: {
          ...actualizado,
          recurso_resuelto: StorageUriResolver.resolve(
            actualizado.storage_source,
            actualizado.resource_url
          ),
        },
      });
    } catch (error) {
      console.error('[OvaPsicologoController] Error actualizando OVA:', error);
      res.status(500).json({ message: 'Error interno actualizando el OVA' });
    }
  }

  /**
   * Cambia el estado activo/inactivo de un OVA
   */
  public static async cambiarEstadoOva(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const is_active = req.body.is_active;

      if (isNaN(id) || typeof is_active !== 'boolean') {
        res.status(400).json({ message: 'Parámetros inválidos (se requiere is_active booleano)' });
        return;
      }

      const [actualizado] = await db
        .update(schema.ovas)
        .set({ is_active, updated_at: new Date() })
        .where(and(eq(schema.ovas.id, id), isNull(schema.ovas.deleted_at)))
        .returning();

      if (!actualizado) {
        res.status(404).json({ message: 'OVA no encontrado' });
        return;
      }

      res.json({
        message: `OVA ${is_active ? 'activado' : 'desactivado'} exitosamente`,
        ova: actualizado,
      });
    } catch (error) {
      console.error('[OvaPsicologoController] Error cambiando estado:', error);
      res.status(500).json({ message: 'Error interno al cambiar estado del OVA' });
    }
  }

  /**
   * Soft delete de un OVA
   */
  public static async eliminarOva(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ message: 'ID de OVA inválido' });
        return;
      }

      const [eliminado] = await db
        .update(schema.ovas)
        .set({
          deleted_at: new Date(),
          is_active: false,
          updated_at: new Date(),
        })
        .where(and(eq(schema.ovas.id, id), isNull(schema.ovas.deleted_at)))
        .returning();

      if (!eliminado) {
        res.status(404).json({ message: 'OVA no encontrado' });
        return;
      }

      res.json({ message: 'OVA eliminado correctamente' });
    } catch (error) {
      console.error('[OvaPsicologoController] Error eliminando OVA:', error);
      res.status(500).json({ message: 'Error interno al eliminar el OVA' });
    }
  }

  /**
   * Listar reglas de un OVA
   */
  public static async listarReglas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ovaId = Number(req.params.id);
      if (isNaN(ovaId)) {
        res.status(400).json({ message: 'ID de OVA inválido' });
        return;
      }

      const reglas = await db
        .select()
        .from(schema.ova_reglas)
        .where(and(eq(schema.ova_reglas.ova_id, ovaId), isNull(schema.ova_reglas.deleted_at)))
        .orderBy(desc(schema.ova_reglas.prioridad));

      res.json({ total: reglas.length, reglas });
    } catch (error) {
      console.error('[OvaPsicologoController] Error listando reglas:', error);
      res.status(500).json({ message: 'Error interno listando reglas' });
    }
  }

  /**
   * Crea una regla para un OVA
   */
  public static async crearRegla(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ovaId = Number(req.params.id);
      if (isNaN(ovaId)) {
        res.status(400).json({ message: 'ID de OVA inválido' });
        return;
      }

      const parsed = crearReglaSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
        return;
      }

      // Validar que el OVA exista
      const [ova] = await db
        .select()
        .from(schema.ovas)
        .where(and(eq(schema.ovas.id, ovaId), isNull(schema.ovas.deleted_at)))
        .limit(1);

      if (!ova) {
        res.status(404).json({ message: 'OVA no encontrado' });
        return;
      }

      const dimension = parsed.data.dimension ?? null;
      const nivel = parsed.data.nivel ?? null;

      const [reglaExistente] = await db
        .select({ id: schema.ova_reglas.id })
        .from(schema.ova_reglas)
        .where(
          and(
            eq(schema.ova_reglas.ova_id, ovaId),
            isNull(schema.ova_reglas.deleted_at),
            sql`${schema.ova_reglas.dimension} IS NOT DISTINCT FROM ${dimension}`,
            sql`${schema.ova_reglas.nivel} IS NOT DISTINCT FROM ${nivel}`,
          ),
        )
        .limit(1);

      if (reglaExistente) {
        res.status(409).json({
          message: 'Ya existe una regla activa para este OVA con la misma dimensión y nivel',
        });
        return;
      }

      const [nuevaRegla] = await db
        .insert(schema.ova_reglas)
        .values({
          ova_id: ovaId,
          dimension,
          nivel,
          prioridad: parsed.data.prioridad,
          is_active: parsed.data.is_active,
          creado_por: req.user?.id || null,
        })
        .returning();

      res.status(201).json({
        message: 'Regla de asignación creada exitosamente',
        regla: nuevaRegla,
      });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(409).json({ message: 'Ya existe una regla idéntica para este OVA con la misma dimensión y nivel' });
        return;
      }
      console.error('[OvaPsicologoController] Error creando regla:', error);
      res.status(500).json({ message: 'Error interno al crear la regla' });
    }
  }

  /**
   * Actualiza una regla existente
   */
  public static async actualizarRegla(req: AuthRequest, res: Response): Promise<void> {
    try {
      const reglaId = Number(req.params.reglaId);
      if (isNaN(reglaId)) {
        res.status(400).json({ message: 'ID de regla inválido' });
        return;
      }

      const parsed = actualizarReglaSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
        return;
      }

      const [actualizada] = await db
        .update(schema.ova_reglas)
        .set({
          ...parsed.data,
          updated_at: new Date(),
        })
        .where(and(eq(schema.ova_reglas.id, reglaId), isNull(schema.ova_reglas.deleted_at)))
        .returning();

      if (!actualizada) {
        res.status(404).json({ message: 'Regla no encontrada' });
        return;
      }

      res.json({
        message: 'Regla actualizada exitosamente',
        regla: actualizada,
      });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(409).json({ message: 'Conflicto: ya existe otra regla activa para este OVA con esa combinación' });
        return;
      }
      console.error('[OvaPsicologoController] Error actualizando regla:', error);
      res.status(500).json({ message: 'Error interno al actualizar la regla' });
    }
  }

  /**
   * Soft delete de una regla
   */
  public static async eliminarRegla(req: AuthRequest, res: Response): Promise<void> {
    try {
      const reglaId = Number(req.params.reglaId);
      if (isNaN(reglaId)) {
        res.status(400).json({ message: 'ID de regla inválido' });
        return;
      }

      const [eliminada] = await db
        .update(schema.ova_reglas)
        .set({
          deleted_at: new Date(),
          is_active: false,
          updated_at: new Date(),
        })
        .where(and(eq(schema.ova_reglas.id, reglaId), isNull(schema.ova_reglas.deleted_at)))
        .returning();

      if (!eliminada) {
        res.status(404).json({ message: 'Regla no encontrada' });
        return;
      }

      res.json({ message: 'Regla eliminada correctamente' });
    } catch (error) {
      console.error('[OvaPsicologoController] Error eliminando regla:', error);
      res.status(500).json({ message: 'Error interno al eliminar la regla' });
    }
  }

  /**
   * Reporte global de efectividad de todos los OVAs
   */
  public static async reporteEfectividadGlobal(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const reporte = await EffectivenessEvaluator.obtenerReporteGlobal();
      res.json(reporte);
    } catch (error) {
      console.error('[OvaPsicologoController] Error en reporte efectividad global:', error);
      res.status(500).json({ message: 'Error interno generando reporte de efectividad' });
    }
  }

  /**
   * Reporte de efectividad específico para un OVA
   */
  public static async reporteEfectividadPorOva(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ovaId = Number(req.params.id);
      if (isNaN(ovaId)) {
        res.status(400).json({ message: 'ID de OVA inválido' });
        return;
      }

      const [ova] = await db
        .select()
        .from(schema.ovas)
        .where(and(eq(schema.ovas.id, ovaId), isNull(schema.ovas.deleted_at)))
        .limit(1);

      if (!ova) {
        res.status(404).json({ message: 'OVA no encontrado' });
        return;
      }

      const reporte = await EffectivenessEvaluator.obtenerReportePorOva(ovaId);
      res.json({
        ova: {
          id: ova.id,
          titulo: ova.titulo,
          tipo_actividad: ova.tipo_actividad,
          storage_source: ova.storage_source,
        },
        ...reporte,
      });
    } catch (error) {
      console.error('[OvaPsicologoController] Error en reporte efectividad por OVA:', error);
      res.status(500).json({ message: 'Error interno generando reporte de efectividad por OVA' });
    }
  }

  /**
   * Lectura clínica: Asignaciones de OVAs de un estudiante (con middleware esPsicologoDeEstudiante)
   */
  public static async listarAsignacionesPaciente(req: AuthRequest, res: Response): Promise<void> {
    try {
      const estudianteId = Number(req.params.estudianteId || req.params.id);
      if (isNaN(estudianteId)) {
        res.status(400).json({ message: 'ID de estudiante inválido' });
        return;
      }

      const asignaciones = await db
        .select({
          id: schema.ova_asignaciones.id,
          estudiante_id: schema.ova_asignaciones.estudiante_id,
          ova_id: schema.ova_asignaciones.ova_id,
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
          pre_estado_semaforo: schema.ova_asignaciones.pre_estado_semaforo,
          post_estado_semaforo: schema.ova_asignaciones.post_estado_semaforo,
          created_at: schema.ova_asignaciones.created_at,
          ova_titulo: schema.ovas.titulo,
          ova_tipo_actividad: schema.ovas.tipo_actividad,
          ova_duracion_minutos: schema.ovas.duracion_minutos,
          ova_storage_source: schema.ovas.storage_source,
          ova_resource_url: schema.ovas.resource_url,
        })
        .from(schema.ova_asignaciones)
        .innerJoin(schema.ovas, eq(schema.ova_asignaciones.ova_id, schema.ovas.id))
        .where(
          and(
            eq(schema.ova_asignaciones.estudiante_id, estudianteId),
            isNull(schema.ova_asignaciones.deleted_at)
          )
        )
        .orderBy(desc(schema.ova_asignaciones.created_at));

      res.json({
        estudiante_id: estudianteId,
        total: asignaciones.length,
        asignaciones: asignaciones.map((a) => ({
          ...a,
          recurso_resuelto: StorageUriResolver.resolve(a.ova_storage_source, a.ova_resource_url),
        })),
      });
    } catch (error) {
      console.error('[OvaPsicologoController] Error listando asignaciones paciente:', error);
      res.status(500).json({ message: 'Error interno obteniendo historial clínico de OVAs del paciente' });
    }
  }
}
