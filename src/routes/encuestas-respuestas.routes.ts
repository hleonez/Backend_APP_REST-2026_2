import { Router } from 'express';
import { authenticate, isPsicologo, isUsuario } from '../middleware/auth.middleware';
import { listRespuestas, getRespuestaById, createRespuesta, updateRespuestaPut, updateRespuestaPatch, deleteRespuesta } from '../controllers/encuestas-respuestas.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: EncuestasRespuestas
 *   description: Respuestas de los usuarios a encuestas institucionales
 */

/**
 * @swagger
 * /api/encuestas-respuestas:
 *   get:
 *     summary: Listar respuestas de encuestas
 *     tags: [EncuestasRespuestas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de respuestas
 *       401:
 *         description: No autenticado
 */
router.get('/', authenticate, listRespuestas);

/**
 * @swagger
 * /api/encuestas-respuestas/{id}:
 *   get:
 *     summary: Obtener una respuesta por id
 *     tags: [EncuestasRespuestas]
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
 *         description: Respuesta encontrada
 *       404:
 *         description: Respuesta no encontrada
 */
router.get('/:id', authenticate, getRespuestaById);

/**
 * @swagger
 * /api/encuestas-respuestas:
 *   post:
 *     summary: Registrar una respuesta a una encuesta
 *     tags: [EncuestasRespuestas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Respuesta registrada
 *       403:
 *         description: Requiere rol usuario
 */
router.post('/', authenticate, isUsuario, createRespuesta);

/**
 * @swagger
 * /api/encuestas-respuestas/{id}:
 *   put:
 *     summary: Reemplazar una respuesta
 *     tags: [EncuestasRespuestas]
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
 *         description: Respuesta actualizada
 *       404:
 *         description: Respuesta no encontrada
 */
router.put('/:id', authenticate, updateRespuestaPut);

/**
 * @swagger
 * /api/encuestas-respuestas/{id}:
 *   patch:
 *     summary: Actualizar parcialmente una respuesta
 *     tags: [EncuestasRespuestas]
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
 *         description: Respuesta actualizada
 *       404:
 *         description: Respuesta no encontrada
 */
router.patch('/:id', authenticate, updateRespuestaPatch);

/**
 * @swagger
 * /api/encuestas-respuestas/{id}:
 *   delete:
 *     summary: Eliminar (baja logica) una respuesta
 *     tags: [EncuestasRespuestas]
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
 *         description: Respuesta eliminada
 *       404:
 *         description: Respuesta no encontrada
 */
router.delete('/:id', authenticate, deleteRespuesta);

export default router;