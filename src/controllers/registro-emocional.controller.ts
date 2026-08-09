import { Request, Response } from 'express';
import { APIErrorResponse, APISuccessResponse } from '../shared/utils/api.utils';
import {
  getPreguntasRegistroEmocionalService,
  getPreguntasAleatoriosService,
  getRespuestasUsuarioPorFechaService,
  saveRespuestasRegistroEmocionalService,
} from '../services/registro-emocional.service';

export const getPreguntasRegistroEmocional = async (_req: Request, res: Response): Promise<void> => {
  try {
    const preguntas = await getPreguntasAleatoriosService();
    res.status(200).json(APISuccessResponse(preguntas, 'Preguntas aleatorias de registro emocional obtenidas'));
  } catch (error) {
    console.error('Error obteniendo preguntas de registro emocional:', error);
    res.status(500).json(APIErrorResponse('Error interno del servidor'));
  }
};

export const getRespuestasUsuarioPorFecha = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarioId = Number(req.params.usuarioId);
    const fecha = req.params.fecha;

    const result = await getRespuestasUsuarioPorFechaService(usuarioId, fecha);
    res.status(200).json(APISuccessResponse(result, 'Respuestas del usuario obtenidas'));
  } catch (error) {
    console.error('Error obteniendo respuestas por fecha:', error);

    if (error instanceof Error && error.message.includes('Formato de fecha inválido')) {
      res.status(400).json(APIErrorResponse(error.message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error interno del servidor'));
  }
};

export const saveRespuestasRegistroEmocional = async (req: Request, res: Response): Promise<void> => {
  try {
    const { usuario_id, respuestas } = req.body as {
      usuario_id: number;
      respuestas: Array<{ pregunta_id: number; opcion_id: number }>;
    };

    const result = await saveRespuestasRegistroEmocionalService({ usuario_id, respuestas });
    res.status(201).json(APISuccessResponse(result, 'Respuestas de registro emocional guardadas'));
  } catch (error) {
    console.error('Error guardando respuestas de registro emocional:', error);

    if (error instanceof Error && (error as any).code === 'REGISTRO_DUPLICADO') {
      res.status(409).json(APIErrorResponse(error.message));
      return;
    }

    if (error instanceof Error) {
      res.status(400).json(APIErrorResponse(error.message));
      return;
    }

    res.status(500).json(APIErrorResponse('Error interno del servidor'));
  }
};
