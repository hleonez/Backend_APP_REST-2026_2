import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  getPreguntasOnboardingService,
  saveRespuestasOnboardingService,
  getEstadoOnboardingService,
} from '../services/onboarding.service';

const respuestasSchema = z.object({
  respuestas: z.array(
    z.object({
      pregunta_id: z.string().min(1),
      puntaje: z.number().int().min(0).max(4),
    }),
  ).min(1),
});

export const getPreguntasOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ message: 'Usuario no autenticado' }); return; }

    const data = await getPreguntasOnboardingService(req.user.id);
    res.status(200).json(data);
  } catch (error) {
    console.error('Error get preguntas onboarding:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const saveRespuestasOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ message: 'Usuario no autenticado' }); return; }

    const parsed = respuestasSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
      return;
    }

    const respuestas: Array<{ pregunta_id: string; puntaje: number }> = parsed.data.respuestas.map((r) => ({
      pregunta_id: r.pregunta_id,
      puntaje: r.puntaje,
    }));

    const result = await saveRespuestasOnboardingService(req.user.id, respuestas);
    res.json(result);
  } catch (error: any) {
    console.error('Error save respuestas onboarding:', error);
    if (error.message === 'El onboarding ya fue completado anteriormente') {
      res.status(409).json({ message: error.message });
      return;
    }
    if (error?.code === 'ENCUESTA_NO_ENCONTRADA') {
      res.status(404).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const getEstadoOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ message: 'Usuario no autenticado' }); return; }

    const estado = await getEstadoOnboardingService(req.user.id);
    res.json(estado);
  } catch (error) {
    console.error('Error get estado onboarding:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};
