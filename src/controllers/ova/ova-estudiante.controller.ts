import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth.middleware';
import { FollowUpAndFeedbackService } from '../../services/ova/follow-up-feedback.service';
import { OVA_ASIGNACION_ESTADO } from '../../shared/const/ova.const';

const completarSchema = z.object({
  liked: z.boolean({ required_error: 'El campo liked es requerido' }),
  rating: z.number().int().min(1).max(5).optional(),
});

const omitirSchema = z.object({
  estado: z.enum([OVA_ASIGNACION_ESTADO.SKIPPED, OVA_ASIGNACION_ESTADO.DISMISSED], {
    required_error: 'El estado debe ser SKIPPED o DISMISSED',
  }),
});

export class OvaEstudianteController {
  /**
   * Obtiene la lista de asignaciones activas (PENDING, IN_PROGRESS y COMPLETED pendientes de post-test)
   */
  public static async listarAsignaciones(req: AuthRequest, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        res.status(401).json({ message: 'Usuario no autenticado' });
        return;
      }

      const asignaciones = await FollowUpAndFeedbackService.listarAsignacionesEstudiante(usuarioId);
      res.json({
        total: asignaciones.length,
        asignaciones,
      });
    } catch (error) {
      console.error('[OvaEstudianteController] Error listando asignaciones:', error);
      res.status(500).json({ message: 'Error interno obteniendo las asignaciones de OVAs' });
    }
  }

  /**
   * Obtiene el detalle de una asignación específica con su recurso web resuelto
   */
  public static async obtenerDetalle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      const asignacionId = Number(req.params.id);

      if (!usuarioId || isNaN(asignacionId)) {
        res.status(400).json({ message: 'Identificador de asignación inválido' });
        return;
      }

      const asignacion = await FollowUpAndFeedbackService.obtenerAsignacionDetalle(asignacionId, usuarioId);
      if (!asignacion) {
        res.status(404).json({ message: 'Asignación no encontrada o no autorizada' });
        return;
      }

      res.json(asignacion);
    } catch (error) {
      console.error('[OvaEstudianteController] Error obteniendo detalle:', error);
      res.status(500).json({ message: 'Error interno obteniendo el detalle de la asignación' });
    }
  }

  /**
   * Marca una asignación como iniciada (IN_PROGRESS)
   */
  public static async iniciar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      const asignacionId = Number(req.params.id);

      if (!usuarioId || isNaN(asignacionId)) {
        res.status(400).json({ message: 'Identificador de asignación inválido' });
        return;
      }

      const resultado = await FollowUpAndFeedbackService.iniciarAsignacion(asignacionId, usuarioId);
      if (resultado.error) {
        res.status(resultado.status || 400).json({ message: resultado.error });
        return;
      }

      res.json({
        message: 'Actividad iniciada correctamente',
        asignacion: resultado.data,
      });
    } catch (error) {
      console.error('[OvaEstudianteController] Error iniciando asignación:', error);
      res.status(500).json({ message: 'Error interno al iniciar la actividad' });
    }
  }

  /**
   * Marca una asignación como completada con feedback obligatorio
   */
  public static async completar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      const asignacionId = Number(req.params.id);

      if (!usuarioId || isNaN(asignacionId)) {
        res.status(400).json({ message: 'Identificador de asignación inválido' });
        return;
      }

      const parsed = completarSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Datos de feedback inválidos', errors: parsed.error.errors });
        return;
      }

      const resultado = await FollowUpAndFeedbackService.completarAsignacion(
        asignacionId,
        usuarioId,
        {
          liked: Boolean(parsed.data.liked),
          rating: parsed.data.rating,
        }
      );

      if (resultado.error) {
        res.status(resultado.status || 400).json({
          message: resultado.error,
          requiere_post_test: resultado.requiere_post_test,
          pre_evaluacion_id: resultado.pre_evaluacion_id,
        });
        return;
      }

      res.json({
        message: 'Actividad completada exitosamente',
        ...resultado.data,
      });
    } catch (error) {
      console.error('[OvaEstudianteController] Error completando asignación:', error);
      res.status(500).json({ message: 'Error interno al completar la actividad' });
    }
  }

  /**
   * Omite o descarta una asignación (SKIPPED | DISMISSED)
   */
  public static async omitir(req: AuthRequest, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      const asignacionId = Number(req.params.id);

      if (!usuarioId || isNaN(asignacionId)) {
        res.status(400).json({ message: 'Identificador de asignación inválido' });
        return;
      }

      const parsed = omitirSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
        return;
      }

      const resultado = await FollowUpAndFeedbackService.omitirAsignacion(
        asignacionId,
        usuarioId,
        parsed.data.estado
      );

      if (resultado.error) {
        res.status(resultado.status || 400).json({ message: resultado.error });
        return;
      }

      res.json({
        message: `Actividad marcada como ${parsed.data.estado}`,
        asignacion: resultado.data,
      });
    } catch (error) {
      console.error('[OvaEstudianteController] Error omitiendo asignación:', error);
      res.status(500).json({ message: 'Error interno al omitir la actividad' });
    }
  }
}
