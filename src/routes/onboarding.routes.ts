import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getPreguntasOnboarding,
  saveRespuestasOnboarding,
  getEstadoOnboarding,
} from '../controllers/onboarding.controller';

const router = Router();

router.get('/preguntas', authenticate, getPreguntasOnboarding);
router.post('/respuestas', authenticate, saveRespuestasOnboarding);
router.get('/estado', authenticate, getEstadoOnboarding);

export default router;
