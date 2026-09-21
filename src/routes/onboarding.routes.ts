import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getPreguntasOnboarding,
  saveRespuestasOnboarding,
  getEstadoOnboarding,
} from '../controllers/onboarding.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Onboarding
 *   description: Encuesta inicial de bienvenida para usuarios nuevos
 */

/**
 * @swagger
 * /api/onboarding/preguntas:
 *   get:
 *     summary: Obtener las preguntas de la encuesta de onboarding
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de preguntas de onboarding
 *       401:
 *         description: No autenticado
 */
router.get('/preguntas', authenticate, getPreguntasOnboarding);

/**
 * @swagger
 * /api/onboarding/respuestas:
 *   post:
 *     summary: Guardar las respuestas de onboarding del usuario autenticado
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Respuestas guardadas
 *       400:
 *         description: Datos invalidos
 */
router.post('/respuestas', authenticate, saveRespuestasOnboarding);

/**
 * @swagger
 * /api/onboarding/estado:
 *   get:
 *     summary: Consultar si el usuario ya completo el onboarding
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado del onboarding
 *       401:
 *         description: No autenticado
 */
router.get('/estado', authenticate, getEstadoOnboarding);

export default router;