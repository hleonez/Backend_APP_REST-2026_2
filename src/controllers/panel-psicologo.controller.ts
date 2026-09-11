import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { APIErrorResponse, APISuccessResponse } from '../shared/utils/api.utils';
import {
  getPerfilEstudianteService,
  getResumenEstudianteService,
  getEvaluacionesEstudianteService,
  getActividadesEstudianteService,
} from '../services/panel-psicologo.service';

const estudianteIdSchema = z.object({
  estudianteId: z.coerce.number().int().positive(),
});

// ============================================================
// GET /api/psicologo/pacientes/:estudianteId/perfil
// ============================================================

/**
 * Retorna los datos generales del estudiante asignado.
 *
 * Seguridad (cadena aplicada en la ruta):
 *   authenticate → isPsicologo → esPsicologoDeEstudiante
 *
 * Privacidad: correo, contraseña y teléfono jamás se exponen.
 */
export const getPerfilEstudiante = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = estudianteIdSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('ID de estudiante inválido'));
      return;
    }

    const perfil = await getPerfilEstudianteService(parsed.data.estudianteId);
    res.status(200).json(APISuccessResponse(perfil, 'Perfil del estudiante obtenido'));
  } catch (error) {
    console.error('[panel-psicologo] getPerfilEstudiante:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

// ============================================================
// GET /api/psicologo/pacientes/:estudianteId/resumen
// ============================================================

/**
 * Retorna la ficha consolidada del estudiante asignado:
 *   - Datos generales (perfil)
 *   - Última evaluación con semáforo y dimensiones
 *   - Actividades vigentes (vencimiento futuro)
 *
 * Seguridad (cadena aplicada en la ruta):
 *   authenticate → isPsicologo → esPsicologoDeEstudiante
 *
 * Tablas NUNCA expuestas: diario, feedback, fallas_tecnicas, solicitudes_premios.
 */
export const getResumenEstudiante = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = estudianteIdSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('ID de estudiante inválido'));
      return;
    }

    const resumen = await getResumenEstudianteService(parsed.data.estudianteId);
    res.status(200).json(APISuccessResponse(resumen, 'Resumen del estudiante obtenido'));
  } catch (error) {
    console.error('[panel-psicologo] getResumenEstudiante:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

// ============================================================
// GET /api/psicologo/pacientes/:estudianteId/evaluaciones
// ============================================================

/**
 * Retorna el historial completo de evaluaciones del estudiante (semáforos y
 * puntajes), cada una con sus dimensiones, de más reciente a más antigua.
 *
 * Seguridad (cadena aplicada en la ruta):
 *   authenticate → isPsicologo → esPsicologoDeEstudiante
 */
export const getEvaluacionesEstudiante = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = estudianteIdSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('ID de estudiante inválido'));
      return;
    }

    const evaluaciones = await getEvaluacionesEstudianteService(parsed.data.estudianteId);
    res.status(200).json(APISuccessResponse(evaluaciones, 'Historial de evaluaciones obtenido'));
  } catch (error) {
    console.error('[panel-psicologo] getEvaluacionesEstudiante:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

// ============================================================
// GET /api/psicologo/pacientes/:estudianteId/actividades
// ============================================================

/**
 * Retorna el historial completo de actividades del estudiante (vigentes y
 * vencidas), con su fecha de registro, vencimiento y bandera `vencida`.
 *
 * Seguridad (cadena aplicada en la ruta):
 *   authenticate → isPsicologo → esPsicologoDeEstudiante
 */
export const getActividadesEstudiante = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = estudianteIdSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('ID de estudiante inválido'));
      return;
    }

    const actividades = await getActividadesEstudianteService(parsed.data.estudianteId);
    res.status(200).json(APISuccessResponse(actividades, 'Historial de actividades obtenido'));
  } catch (error) {
    console.error('[panel-psicologo] getActividadesEstudiante:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};
