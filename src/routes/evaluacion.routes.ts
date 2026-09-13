import { Router } from 'express';
import * as evaluacionController from '../controllers/evaluacion.controller';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import { asignarSemaforoUsuarioAutenticado } from '../controllers/asignacion-semaforo.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Evaluaciones
 *   description: Evaluaciones de semaforo (puntajes y dimensiones) del estudiante
 */

/**
 * @swagger
 * /api/evaluaciones/preguntas:
 *   get:
 *     summary: Obtener el banco de preguntas de evaluacion
 *     tags: [Evaluaciones]
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de preguntas
 */
router.get('/preguntas', evaluacionController.getPreguntas);

/**
 * @swagger
 * /api/evaluaciones:
 *   post:
 *     summary: Crear una nueva evaluacion
 *     tags: [Evaluaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Evaluacion creada
 *       403:
 *         description: Requiere rol usuario
 */
router.post('/', authenticate, isUsuario, evaluacionController.crearEvaluacion);

/**
 * @swagger
 * /api/evaluaciones/asignacion-semaforo:
 *   post:
 *     summary: Asignar estado de semaforo al usuario autenticado
 *     tags: [Evaluaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Semaforo asignado
 *       403:
 *         description: Requiere rol usuario
 */
router.post('/asignacion-semaforo', authenticate, isUsuario, asignarSemaforoUsuarioAutenticado);

/**
 * @swagger
 * /api/evaluaciones:
 *   get:
 *     summary: Listar evaluaciones del usuario autenticado
 *     tags: [Evaluaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de evaluaciones
 *       403:
 *         description: Requiere rol usuario
 */
router.get('/', authenticate, isUsuario, evaluacionController.getEvaluaciones);

/**
 * @swagger
 * /api/evaluaciones/{id}:
 *   get:
 *     summary: Obtener una evaluacion especifica por id
 *     tags: [Evaluaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Evaluacion encontrada
 *       404:
 *         description: Evaluacion no encontrada
 */
router.get('/:id', authenticate, isUsuario, evaluacionController.getEvaluacion);

export default router;