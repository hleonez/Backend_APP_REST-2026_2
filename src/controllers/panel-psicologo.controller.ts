import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { APIErrorResponse, APISuccessResponse } from '../shared/utils/api.utils';
import {
  getPerfilEstudianteService,
  getResumenEstudianteService,
  getEvaluacionesEstudianteService,
  getActividadesEstudianteService,
  getEstadisticasRegistroEmocionalEstudianteService,
  abrirChatPsicologoService,
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

// ============================================================
// GET /api/psicologo/pacientes/:estudianteId/registro-emocional/estadisticas
// ============================================================

/**
 * Retorna las estadísticas agregadas de registro emocional del paciente
 * (promedio general, valor mínimo/máximo, total registros, emociones más frecuentes,
 * registros por semana).
 *
 * Seguridad (cadena aplicada en la ruta):
 *   authenticate → isPsicologo → esPsicologoDeEstudiante
 */
export const getEstadisticasRegistroEmocional = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = estudianteIdSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('ID de estudiante inválido'));
      return;
    }

    const estadisticas = await getEstadisticasRegistroEmocionalEstudianteService(
      parsed.data.estudianteId
    );
    res
      .status(200)
      .json(
        APISuccessResponse(
          estadisticas,
          'Estadísticas de registro emocional obtenidas correctamente'
        )
      );
  } catch (error) {
    console.error('[panel-psicologo] getEstadisticasRegistroEmocional:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

// ============================================================
// POST /api/psicologo/pacientes/:estudianteId/chat
// ============================================================

/**
 * Abre una nueva sesión de chat o reactiva la sesión existente entre el
 * psicólogo autenticado y el estudiante asignado.
 *
 * Seguridad (cadena aplicada en la ruta):
 *   authenticate → isPsicologo → esPsicologoDeEstudiante
 */
export const abrirChat = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const psicologoId = req.user?.id;
    if (!psicologoId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const parsed = estudianteIdSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('ID de estudiante inválido'));
      return;
    }

    const resultado = await abrirChatPsicologoService(
      psicologoId,
      parsed.data.estudianteId
    );

    const statusCode = resultado.reabierto ? 200 : 201;
    res
      .status(statusCode)
      .json(APISuccessResponse(resultado.chat, resultado.mensaje));
  } catch (error) {
    console.error('[panel-psicologo] abrirChat:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};
