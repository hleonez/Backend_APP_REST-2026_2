import { Router } from 'express';
import * as evaluacionController from '../controllers/evaluacion.controller';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import { asignarSemaforoUsuarioAutenticado } from '../controllers/asignacion-semaforo.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Evaluaciones
 *   description: Evaluaciones psicológicas y asignación de semáforo emocional
 */

/**
 * @swagger
 * /api/evaluaciones/preguntas:
 *   get:
 *     summary: Obtener todas las preguntas de la evaluación
 *     tags: [Evaluaciones]
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de preguntas. Cada pregunta contiene `id`, `texto`, `peso`, `created_at`, `updated_at` y `deleted_at`.
 *       500:
 *         description: Error en el servidor
 */
router.get('/preguntas', evaluacionController.getPreguntas);

/**
 * @swagger
 * /api/evaluaciones:
 *   post:
 *     summary: Crear una nueva evaluación (analiza las respuestas con IA y genera semáforo y dimensiones)
 *     tags: [Evaluaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - respuestas
 *             properties:
 *               respuestas:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - pregunta_id
 *                     - respuesta
 *                   properties:
 *                     pregunta_id:
 *                       type: integer
 *                       example: 1
 *                     respuesta:
 *                       type: integer
 *                       minimum: 1
 *                       maximum: 5
 *                       example: 4
 *               observaciones:
 *                 type: string
 *                 example: Me siento ansioso por los parciales
 *     responses:
 *       201:
 *         description: Evaluación creada. Devuelve `message`, `evaluacion` (incluye `dimensiones`) y `analisis` (estado del semáforo, puntaje, observaciones, recomendaciones y dimensiones).
 *       400:
 *         description: Datos inválidos (formato de respuestas u observaciones)
 *       401:
 *         description: Usuario no autenticado
 *       500:
 *         description: Error en el servidor
 */
router.post('/', authenticate, isUsuario, evaluacionController.crearEvaluacion);

/**
 * @swagger
 * /api/evaluaciones/asignacion-semaforo:
 *   post:
 *     summary: Asignar el estado de semáforo al usuario autenticado (combina última evaluación con registro emocional)
 *     tags: [Evaluaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               puntaje_manual:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Puntaje manual opcional que reemplaza al de la última evaluación o del registro emocional
 *                 example: 75
 *     responses:
 *       200:
 *         description: Semáforo asignado. Devuelve `message` y `data` con `usuario_id`, `estado_semaforo`, `puntaje_total`, `subcategoria_principal`, `dimensiones` y `evaluacion`.
 *       400:
 *         description: Datos inválidos o no hay información suficiente para asignar el semáforo
 *       401:
 *         description: Usuario no autenticado
 *       500:
 *         description: Error en el servidor
 */
router.post('/asignacion-semaforo', authenticate, isUsuario, asignarSemaforoUsuarioAutenticado);

/**
 * @swagger
 * /api/evaluaciones:
 *   get:
 *     summary: Obtener todas las evaluaciones del usuario autenticado
 *     tags: [Evaluaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de evaluaciones del usuario. Cada evaluación incluye `id`, `usuario_id`, `puntaje_total`, `estado_semaforo`, `observaciones`, `subcategoria_principal`, `fecha` y el arreglo `dimensiones`.
 *       401:
 *         description: Usuario no autenticado
 *       500:
 *         description: Error en el servidor
 */
router.get('/', authenticate, isUsuario, evaluacionController.getEvaluaciones);

/**
 * @swagger
 * /api/evaluaciones/{id}:
 *   get:
 *     summary: Obtener una evaluación específica por ID
 *     tags: [Evaluaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la evaluación
 *     responses:
 *       200:
 *         description: Evaluación encontrada. Incluye sus columnas y el arreglo `dimensiones`.
 *       400:
 *         description: ID de evaluación inválido
 *       401:
 *         description: Usuario no autenticado
 *       403:
 *         description: No tienes acceso a esta evaluación
 *       404:
 *         description: Evaluación no encontrada
 *       500:
 *         description: Error en el servidor
 */
router.get('/:id', authenticate, isUsuario, evaluacionController.getEvaluacion);

export default router;