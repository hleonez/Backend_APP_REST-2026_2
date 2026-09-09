import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { APIErrorResponse, APISuccessResponse } from '../shared/utils/api.utils';
import { crearSolicitudService, getMisSolicitudesService } from '../services/asignaciones.service';

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