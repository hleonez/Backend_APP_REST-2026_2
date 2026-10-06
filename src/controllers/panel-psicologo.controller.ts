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
  getRegistroEmocionalEstudianteService,
  getEncuestasEstudianteService,
  getChatsEstudianteService,
  asignarActividadEstudianteService,
  actualizarActividadAsignadaService,
  eliminarActividadAsignadaService,
  getSugerenciasActividadesService,
} from '../services/panel-psicologo.service';

const estudianteIdSchema = z.object({
  estudianteId: z.coerce.number().int().positive(),
});

const actividadIdParamSchema = z.object({
  estudianteId: z.coerce.number().int().positive(),
  actividadId: z.coerce.number().int().positive(),
});

const asignarActividadBodySchema = z.object({
  opcion_id: z.number().int().positive().optional().nullable(),
  titulo_personalizado: z.string().min(1).max(255).optional().nullable(),
  descripcion_personalizada: z.string().optional().nullable(),
  dimension_objetivo: z.string().max(80).optional().nullable(),
  prioridad: z.enum(['baja', 'media', 'alta']).optional(),
  vencimiento: z.coerce.date().optional(),
  observaciones: z.string().optional().nullable(),
}).refine((data) => data.opcion_id || data.titulo_personalizado, {
  message: 'Debe especificar al menos una opción del catálogo (opcion_id) o un título personalizado',
});

const actualizarActividadBodySchema = z.object({
  opcion_id: z.number().int().positive().optional().nullable(),
  titulo_personalizado: z.string().min(1).max(255).optional().nullable(),
  descripcion_personalizada: z.string().optional().nullable(),
  dimension_objetivo: z.string().max(80).optional().nullable(),
  prioridad: z.enum(['baja', 'media', 'alta']).optional(),
  vencimiento: z.coerce.date().optional(),
  observaciones: z.string().optional().nullable(),
  estado: z.enum(['pendiente', 'completada', 'cancelada']).optional(),
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

// ============================================================
// GET /api/psicologo/pacientes/:estudianteId/registro-emocional
// (Javier - Fase 7)
// ============================================================

/**
 * Retorna el historial de registro emocional del estudiante, ordenado
 * cronológicamente (más antiguo primero).
 *
 * Seguridad (cadena aplicada en la ruta):
 *   authenticate → isPsicologo → esPsicologoDeEstudiante
 */
export const getRegistroEmocionalEstudiante = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = estudianteIdSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('ID de estudiante inválido'));
      return;
    }

    const registros = await getRegistroEmocionalEstudianteService(parsed.data.estudianteId);
    res.status(200).json(APISuccessResponse(registros, 'Registro emocional obtenido'));
  } catch (error) {
    console.error('[panel-psicologo] getRegistroEmocionalEstudiante:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

// ============================================================
// GET /api/psicologo/pacientes/:estudianteId/encuestas
// (Javier - Fase 7)
// ============================================================

/**
 * Retorna las respuestas del estudiante a encuestas institucionales,
 * de más reciente a más antigua.
 *
 * Seguridad (cadena aplicada en la ruta):
 *   authenticate → isPsicologo → esPsicologoDeEstudiante
 */
export const getEncuestasEstudiante = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = estudianteIdSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('ID de estudiante inválido'));
      return;
    }

    const respuestas = await getEncuestasEstudianteService(parsed.data.estudianteId);
    res.status(200).json(APISuccessResponse(respuestas, 'Respuestas de encuestas obtenidas'));
  } catch (error) {
    console.error('[panel-psicologo] getEncuestasEstudiante:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

// ============================================================
// GET /api/psicologo/pacientes/:estudianteId/chats
// (Javier - Fase 7)
// ============================================================

/**
 * Retorna el historial de conversaciones (chats) entre el psicólogo
 * autenticado y el estudiante indicado, cada una con sus mensajes en
 * orden cronológico.
 *
 * Seguridad (cadena aplicada en la ruta):
 *   authenticate → isPsicologo → esPsicologoDeEstudiante
 *
 * Además, el service filtra explícitamente por psicologo_id = req.user.id,
 * para que un psicólogo nunca vea chats de ese estudiante con otro psicólogo.
 */
export const getChatsEstudiante = async (
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

    const chats = await getChatsEstudianteService(parsed.data.estudianteId, psicologoId);
    res.status(200).json(APISuccessResponse(chats, 'Historial de conversaciones obtenido'));
  } catch (error) {
    console.error('[panel-psicologo] getChatsEstudiante:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

// ============================================================
// POST /api/psicologo/pacientes/:estudianteId/actividades
// ============================================================

/**
 * Asigna una actividad (del catálogo o personalizada) a un estudiante.
 */
export const asignarActividadEstudiante = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const psicologoId = req.user?.id;
    if (!psicologoId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const paramParsed = estudianteIdSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json(APIErrorResponse('ID de estudiante inválido'));
      return;
    }

    const bodyParsed = asignarActividadBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json(APIErrorResponse(bodyParsed.error.errors[0]?.message || 'Datos de actividad inválidos'));
      return;
    }

    const actividad = await asignarActividadEstudianteService({
      estudianteId: paramParsed.data.estudianteId,
      psicologoId,
      opcionId: bodyParsed.data.opcion_id,
      tituloPersonalizado: bodyParsed.data.titulo_personalizado,
      descripcionPersonalizada: bodyParsed.data.descripcion_personalizada,
      dimensionObjetivo: bodyParsed.data.dimension_objetivo,
      prioridad: bodyParsed.data.prioridad,
      vencimiento: bodyParsed.data.vencimiento,
      observaciones: bodyParsed.data.observaciones,
    });

    res.status(201).json(APISuccessResponse(actividad, 'Actividad asignada exitosamente al estudiante'));
  } catch (error) {
    console.error('[panel-psicologo] asignarActividadEstudiante:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO' || code === 'OPCION_NO_ENCONTRADA') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

// ============================================================
// PUT /api/psicologo/pacientes/:estudianteId/actividades/:actividadId
// ============================================================

/**
 * Actualiza una actividad asignada a un estudiante.
 */
export const actualizarActividadEstudiante = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const psicologoId = req.user?.id;
    if (!psicologoId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const paramParsed = actividadIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json(APIErrorResponse('Parámetros de ruta inválidos'));
      return;
    }

    const bodyParsed = actualizarActividadBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json(APIErrorResponse(bodyParsed.error.errors[0]?.message || 'Datos de actualización inválidos'));
      return;
    }

    const actividad = await actualizarActividadAsignadaService({
      actividadId: paramParsed.data.actividadId,
      estudianteId: paramParsed.data.estudianteId,
      psicologoId,
      opcionId: bodyParsed.data.opcion_id,
      tituloPersonalizado: bodyParsed.data.titulo_personalizado,
      descripcionPersonalizada: bodyParsed.data.descripcion_personalizada,
      dimensionObjetivo: bodyParsed.data.dimension_objetivo,
      prioridad: bodyParsed.data.prioridad,
      vencimiento: bodyParsed.data.vencimiento,
      observaciones: bodyParsed.data.observaciones,
      estado: bodyParsed.data.estado,
    });

    res.status(200).json(APISuccessResponse(actividad, 'Actividad actualizada exitosamente'));
  } catch (error) {
    console.error('[panel-psicologo] actualizarActividadEstudiante:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO' || code === 'ACTIVIDAD_NO_ENCONTRADA') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

// ============================================================
// DELETE /api/psicologo/pacientes/:estudianteId/actividades/:actividadId
// ============================================================

/**
 * Elimina (soft delete) una actividad asignada a un estudiante.
 */
export const eliminarActividadEstudiante = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const psicologoId = req.user?.id;
    if (!psicologoId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const paramParsed = actividadIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json(APIErrorResponse('Parámetros de ruta inválidos'));
      return;
    }

    await eliminarActividadAsignadaService(
      paramParsed.data.actividadId,
      paramParsed.data.estudianteId
    );

    res.status(200).json(APISuccessResponse(null, 'Actividad eliminada exitosamente'));
  } catch (error) {
    console.error('[panel-psicologo] eliminarActividadEstudiante:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO' || code === 'ACTIVIDAD_NO_ENCONTRADA') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

// ============================================================
// GET /api/psicologo/pacientes/:estudianteId/actividades/sugerencias
// ============================================================

/**
 * Sugerencias inteligentes de actividades según dimensiones en rojo/amarillo del semáforo.
 */
export const getSugerenciasActividades = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = estudianteIdSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('ID de estudiante inválido'));
      return;
    }

    const sugerencias = await getSugerenciasActividadesService(parsed.data.estudianteId);
    res.status(200).json(APISuccessResponse(sugerencias, 'Sugerencias de actividades obtenidas'));
  } catch (error) {
    console.error('[panel-psicologo] getSugerenciasActividades:', error);

    const code = error instanceof Error ? (error as any).code : undefined;
    if (code === 'ESTUDIANTE_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

