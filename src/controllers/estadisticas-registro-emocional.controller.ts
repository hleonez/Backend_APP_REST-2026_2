import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { APISuccessResponse, APIErrorResponse } from '../shared/utils/api.utils';
import {
  getCalendarioEmocionalService,
  getRachasService,
  getEstadisticasService,
  getResumenDiaService,
  getPantallaPersonalService,
  activarRachaDiariaService,
} from '../services/estadisticas-registro-emocional.service';

/**
 * Obtener calendario emocional con rango de fechas
 */
export const getCalendarioEmocional = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const { inicio = '2024-01-01', fin = '2026-12-31' } = req.query;

    if (!usuarioId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    // Validar fechas (formato YYYY-MM-DD)
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(inicio as string) || !fechaRegex.test(fin as string)) {
      res.status(400).json(APIErrorResponse('Formato de fecha inválido. Usa YYYY-MM-DD'));
      return;
    }

    const calendarioData = await getCalendarioEmocionalService(
      usuarioId,
      inicio as string,
      fin as string
    );

    res.status(200).json(APISuccessResponse(calendarioData, 'Calendario emocional obtenido correctamente'));
  } catch (error) {
    console.error('Error en getCalendarioEmocional:', error);
    res.status(500).json(APIErrorResponse('Error al obtener calendario'));
  }
};

/**
 * Obtener información de rachas (consistencia)
 */
export const getRachas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const rachasData = await getRachasService(usuarioId);

    res.status(200).json(APISuccessResponse(rachasData, 'Información de rachas obtenida'));
  } catch (error) {
    console.error('Error en getRachas:', error);
    res.status(500).json(APIErrorResponse('Error al obtener rachas'));
  }
};

/**
 * Obtener estadísticas detalladas
 */
export const getEstadisticas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const { dias_atras = '30' } = req.query;

    if (!usuarioId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    // Validar que dias_atras sea un número
    const diasAtras = parseInt(dias_atras as string);
    if (isNaN(diasAtras) || diasAtras < 1) {
      res.status(400).json(APIErrorResponse('dias_atras debe ser un número positivo'));
      return;
    }

    const estadisticasData = await getEstadisticasService(usuarioId);

    res.status(200).json(APISuccessResponse(estadisticasData, 'Estadísticas obtenidas correctamente'));
  } catch (error) {
    console.error('Error en getEstadisticas:', error);
    res.status(500).json(APIErrorResponse('Error al obtener estadísticas'));
  }
};

/**
 * Obtener resumen del día específico
 */
export const getResumenDia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const { fecha } = req.params;

    if (!usuarioId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    if (!fecha) {
      res.status(400).json(APIErrorResponse('Fecha requerida (formato: YYYY-MM-DD)'));
      return;
    }

    // Validar formato (YYYY-MM-DD)
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
      res.status(400).json(APIErrorResponse('Formato de fecha inválido. Usa YYYY-MM-DD'));
      return;
    }

    const resumenData = await getResumenDiaService(usuarioId, fecha);

    res.status(200).json(APISuccessResponse(resumenData, 'Resumen del día obtenido correctamente'));
  } catch (error) {
    console.error('Error en getResumenDia:', error);
    res.status(500).json(APIErrorResponse('Error al obtener resumen del día'));
  }
};

/**
 * Obtener datos completos para la pantalla personal
 */
export const getPantallaPersonal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const data = await getPantallaPersonalService(usuarioId);
    res.status(200).json(APISuccessResponse(data, 'Pantalla personal obtenida correctamente'));
  } catch (error) {
    console.error('Error en getPantallaPersonal:', error);
    res.status(500).json(APIErrorResponse('Error al obtener datos de pantalla personal'));
  }
};

/**
 * Activar racha diaria y otorgar una estrella del día
 */
export const activarRachaDiaria = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const data = await activarRachaDiariaService(usuarioId);
    res.status(200).json(APISuccessResponse(data, data.mensaje));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al activar racha diaria';

    if (message.toLowerCase().includes('debes completar tu registro emocional')) {
      res.status(409).json(APIErrorResponse(message));
      return;
    }

    console.error('Error en activarRachaDiaria:', error);
    res.status(500).json(APIErrorResponse('Error al activar racha diaria'));
  }
};
