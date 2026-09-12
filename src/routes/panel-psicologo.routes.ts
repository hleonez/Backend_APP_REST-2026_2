import { Router } from 'express';
import { authenticate, isPsicologo } from '../middleware/auth.middleware';
import { esPsicologoDeEstudiante } from '../middleware/authorization.middleware';
import {
  getPerfilEstudiante,
  getResumenEstudiante,
  getEvaluacionesEstudiante,
  getActividadesEstudiante,
  getEstadisticasRegistroEmocional,
  abrirChat,
  getRegistroEmocionalEstudiante,
  getEncuestasEstudiante,
  getChatsEstudiante,
} from '../controllers/panel-psicologo.controller';

const router = Router();

// Cadena de seguridad compartida por todas las rutas del panel:
//   1. authenticate          — JWT valido y usuario activo
//   2. isPsicologo           — rol == 'psicologo'
//   3. esPsicologoDeEstudiante — asignacion aprobada activa con ese estudiante

/**
 * @swagger
 * tags:
 *   name: PanelPsicologo
 *   description: >
 *     Panel de seguimiento del psicologo sobre sus pacientes. Todas las rutas exigen
 *     autenticacion, rol "psicologo", y una asignacion en estado "aprobado" (no eliminada)
 *     con el estudiante solicitado. Si no existe esa asignacion, responde 403 Forbidden.
 */

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/perfil:
 *   get:
 *     summary: Datos generales del estudiante asignado
 *     description: No incluye correo, contrasena ni telefono.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Perfil del estudiante
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/perfil',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getPerfilEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/resumen:
 *   get:
 *     summary: Ficha consolidada del estudiante
 *     description: Perfil + ultima evaluacion (semaforo/dimensiones) + actividades vigentes.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ficha consolidada del estudiante
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/resumen',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getResumenEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/evaluaciones:
 *   get:
 *     summary: Historial de evaluaciones del estudiante
 *     description: Semaforos y puntajes historicos, con dimensiones.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Historial de evaluaciones
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/evaluaciones',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getEvaluacionesEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/actividades:
 *   get:
 *     summary: Historial de actividades del estudiante
 *     description: Actividades y sus vencimientos (vigentes y vencidas).
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Historial de actividades
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/actividades',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getActividadesEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/registro-emocional/estadisticas:
 *   get:
 *     summary: Estadisticas de registro emocional del estudiante
 *     description: Promedio, minimo, maximo y frecuencias del registro emocional.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estadisticas de registro emocional
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/registro-emocional/estadisticas',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getEstadisticasRegistroEmocional
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/chat:
 *   post:
 *     summary: Abrir o reanudar chat con el estudiante
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chat abierto o reanudado
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.post(
  '/pacientes/:estudianteId/chat',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  abrirChat
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/registro-emocional:
 *   get:
 *     summary: Historial de registro emocional del estudiante
 *     description: Ordenado cronologicamente.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Historial de registro emocional
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/registro-emocional',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getRegistroEmocionalEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/encuestas:
 *   get:
 *     summary: Respuestas a encuestas institucionales del estudiante
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Respuestas a encuestas
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/encuestas',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getEncuestasEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/chats:
 *   get:
 *     summary: Historial de conversaciones con el estudiante
 *     description: Solo las conversaciones del psicologo autenticado.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Historial de conversaciones
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/chats',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getChatsEstudiante
);

export default router;