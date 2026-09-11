import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { APIErrorResponse, APISuccessResponse } from '../shared/utils/api.utils';
import { crearSolicitudService, getMisSolicitudesService, getSolicitudesPsicologoService, aprobarSolicitudService, rechazarSolicitudService, getMisPacientesService } from '../services/asignaciones.service';

const solicitarSchema = z.object({
  psicologo_id: z.number().int().positive(),
  mensaje: z.string().max(1000).optional(),
});

export const solicitarAsignacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const estudianteId = req.user?.id;
    if (!estudianteId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const parsed = solicitarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('Datos inválidos', parsed.error.errors.map((e) => e.message)));
      return;
    }

    const creada = await crearSolicitudService({
      estudiante_id: estudianteId,
      psicologo_id: parsed.data.psicologo_id,
      mensaje: parsed.data.mensaje,
    });

    res.status(201).json(APISuccessResponse(creada, 'Solicitud enviada correctamente'));
  } catch (error) {
    console.error('Error creando solicitud de asignación:', error);

    const code = error instanceof Error ? (error as any).code : undefined;

    if (code === 'AUTOASIGNACION' || code === 'SOLICITUD_DUPLICADA' || code === 'ASIGNACION_ACTIVA_EXISTENTE') {
      res.status(400).json(APIErrorResponse((error as Error).message));
      return;
    }

    if (code === 'PSICOLOGO_NO_ENCONTRADO') {
      res.status(404).json(APIErrorResponse((error as Error).message));
      return;
    }

    // Última línea de defensa: violación de índice único parcial en BD (condición de carrera)
    if (code === '23505') {
      res.status(400).json(APIErrorResponse('Ya existe una solicitud o asignación que entra en conflicto con esta.'));
      return;
    }

    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

export const misSolicitudes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const estudianteId = req.user?.id;
    if (!estudianteId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const items = await getMisSolicitudesService(estudianteId);
    res.status(200).json(APISuccessResponse(items, 'Historial de solicitudes obtenido'));
  } catch (error) {
    console.error('Error obteniendo historial de solicitudes:', error);
    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * GET /api/asignaciones/psicologo/solicitudes
 * Buzón de entrada: solicitudes pendientes dirigidas al psicólogo autenticado.
 */
export const solicitudesPsicologo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const psicologoId = req.user?.id;
    if (!psicologoId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const items = await getSolicitudesPsicologoService(psicologoId);
    res.status(200).json(APISuccessResponse(items, 'Solicitudes pendientes obtenidas'));
  } catch (error) {
    console.error('Error obteniendo solicitudes del psicólogo:', error);
    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

/**
 * PATCH /api/asignaciones/:id/aprobar
 */
export const aprobarSolicitud = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const psicologoId = req.user?.id;
    if (!psicologoId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const parsedParams = idParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json(APIErrorResponse('ID inválido'));
      return;
    }

    const actualizada = await aprobarSolicitudService(parsedParams.data.id, psicologoId);
    res.status(200).json(APISuccessResponse(actualizada, 'Solicitud aprobada correctamente'));
  } catch (error) {
    console.error('Error aprobando solicitud:', error);
    handleAsignacionError(error, res);
  }
};

/**
 * PATCH /api/asignaciones/:id/rechazar
 */
export const rechazarSolicitud = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const psicologoId = req.user?.id;
    if (!psicologoId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const parsedParams = idParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json(APIErrorResponse('ID inválido'));
      return;
    }

    const actualizada = await rechazarSolicitudService(parsedParams.data.id, psicologoId);
    res.status(200).json(APISuccessResponse(actualizada, 'Solicitud rechazada correctamente'));
  } catch (error) {
    console.error('Error rechazando solicitud:', error);
    handleAsignacionError(error, res);
  }
};

/**
 * GET /api/asignaciones/psicologo/mis-pacientes
 */
export const misPacientes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const psicologoId = req.user?.id;
    if (!psicologoId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const items = await getMisPacientesService(psicologoId);
    res.status(200).json(APISuccessResponse(items, 'Pacientes activos obtenidos'));
  } catch (error) {
    console.error('Error obteniendo pacientes activos:', error);
    res.status(500).json(APIErrorResponse('Error en el servidor'));
  }
};

function handleAsignacionError(error: unknown, res: Response): void {
  const code = error instanceof Error ? (error as any).code : undefined;

  if (code === 'NO_AUTORIZADO') {
    res.status(403).json(APIErrorResponse((error as Error).message));
    return;
  }

  if (code === 'SOLICITUD_NO_ENCONTRADA') {
    res.status(404).json(APIErrorResponse((error as Error).message));
    return;
  }

  if (code === 'SOLICITUD_YA_PROCESADA' || code === 'SOLICITUD_INVALIDA') {
    res.status(400).json(APIErrorResponse((error as Error).message));
    return;
  }

  if (code === '23505') {
    res.status(400).json(APIErrorResponse('Conflicto de estado: ya existe una asignación aprobada activa.'));
    return;
  }

  res.status(500).json(APIErrorResponse('Error en el servidor'));
}