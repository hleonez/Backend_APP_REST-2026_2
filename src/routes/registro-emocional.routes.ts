import { Router } from 'express';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import {
  validateGetRespuestasUsuarioPorFecha,
  validateSaveRespuestasRegistroEmocional,
} from '../middleware/registro-emocional.middleware';
import {
  getPreguntasRegistroEmocional,
  getRespuestasUsuarioPorFecha,
  saveRespuestasRegistroEmocional,
} from '../controllers/registro-emocional.controller';
import {
  getCalendarioEmocional,
  getRachas,
  getEstadisticas,
  getResumenDia,
  getPantallaPersonal,
  activarRachaDiaria,
} from '../controllers/estadisticas-registro-emocional.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: RegistroEmocional
 *   description: Registro emocional diario del estudiante, rachas y estadisticas
 */

// Rutas basicas

/**
 * @swagger
 * /api/registro-emocional/preguntas:
 *   get:
 *     summary: Obtener las preguntas de registro emocional
 *     tags: [RegistroEmocional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de preguntas
 *       401:
 *         description: No autenticado
 */
router.get('/preguntas', authenticate, getPreguntasRegistroEmocional);

/**
 * @swagger
 * /api/registro-emocional/usuarios/{usuarioId}/fecha/{fecha}:
 *   get:
 *     summary: Obtener las respuestas de registro emocional de un usuario en una fecha
 *     tags: [RegistroEmocional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Respuestas del dia
 *       403:
 *         description: Requiere rol usuario
 */
router.get(
  '/usuarios/:usuarioId/fecha/:fecha',
  authenticate,
  isUsuario,
  validateGetRespuestasUsuarioPorFecha,
  getRespuestasUsuarioPorFecha,
);

/**
 * @swagger
 * /api/registro-emocional:
 *   post:
 *     summary: Guardar las respuestas de registro emocional del dia
 *     tags: [RegistroEmocional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Respuestas guardadas
 *       400:
 *         description: Datos invalidos
 *       403:
 *         description: Requiere rol usuario
 */
router.post('/', authenticate, isUsuario, validateSaveRespuestasRegistroEmocional, saveRespuestasRegistroEmocional);

// Rutas de estadisticas y analisis (deben ir antes de las rutas con parametros generales)

/**
 * @swagger
 * /api/registro-emocional/calendario:
 *   get:
 *     summary: Calendario emocional del usuario autenticado
 *     tags: [RegistroEmocional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Calendario emocional
 *       403:
 *         description: Requiere rol usuario
 */
router.get('/calendario', authenticate, isUsuario, getCalendarioEmocional);

/**
 * @swagger
 * /api/registro-emocional/rachas:
 *   get:
 *     summary: Rachas de registro emocional del usuario autenticado
 *     tags: [RegistroEmocional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informacion de rachas
 *       403:
 *         description: Requiere rol usuario
 */
router.get('/rachas', authenticate, isUsuario, getRachas);

/**
 * @swagger
 * /api/registro-emocional/estadisticas:
 *   get:
 *     summary: Estadisticas de registro emocional del usuario autenticado
 *     tags: [RegistroEmocional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadisticas agregadas
 *       403:
 *         description: Requiere rol usuario
 */
router.get('/estadisticas', authenticate, isUsuario, getEstadisticas);

/**
 * @swagger
 * /api/registro-emocional/pantalla-personal:
 *   get:
 *     summary: Datos de la pantalla personal (racha, estado del dia, etc.)
 *     tags: [RegistroEmocional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos de pantalla personal
 *       403:
 *         description: Requiere rol usuario
 */
router.get('/pantalla-personal', authenticate, isUsuario, getPantallaPersonal);

/**
 * @swagger
 * /api/registro-emocional/pantalla-personal/activar-racha:
 *   post:
 *     summary: Activar/registrar la racha diaria del usuario
 *     tags: [RegistroEmocional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Racha activada
 *       403:
 *         description: Requiere rol usuario
 */
router.post('/pantalla-personal/activar-racha', authenticate, isUsuario, activarRachaDiaria);

/**
 * @swagger
 * /api/registro-emocional/resumen-dia/{fecha}:
 *   get:
 *     summary: Resumen del registro emocional de un dia especifico
 *     tags: [RegistroEmocional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Resumen del dia
 *       403:
 *         description: Requiere rol usuario
 */
router.get('/resumen-dia/:fecha', authenticate, isUsuario, getResumenDia);

export default router;