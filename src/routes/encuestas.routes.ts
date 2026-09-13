import { Router } from 'express';
import { authenticate, isPsicologo } from '../middleware/auth.middleware';
import { listEncuestas, getEncuestaById, createEncuesta, updateEncuestaPut, updateEncuestaPatch, deleteEncuesta } from '../controllers/encuestas.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Encuestas
 *   description: Definicion de encuestas institucionales (gestion del psicologo)
 */

/**
 * @swagger
 * /api/encuestas:
 *   get:
 *     summary: Listar encuestas
 *     tags: [Encuestas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de encuestas
 *       403:
 *         description: Requiere rol psicologo
 */
router.get('/', authenticate, isPsicologo, listEncuestas);

/**
 * @swagger
 * /api/encuestas/{id}:
 *   get:
 *     summary: Obtener una encuesta por id
 *     tags: [Encuestas]
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
 *         description: Encuesta encontrada
 *       404:
 *         description: Encuesta no encontrada
 */
router.get('/:id', authenticate, isPsicologo, getEncuestaById);

/**
 * @swagger
 * /api/encuestas:
 *   post:
 *     summary: Crear una nueva encuesta
 *     tags: [Encuestas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Encuesta creada
 *       403:
 *         description: Requiere rol psicologo
 */
router.post('/', authenticate, isPsicologo, createEncuesta);

/**
 * @swagger
 * /api/encuestas/{id}:
 *   put:
 *     summary: Reemplazar una encuesta
 *     tags: [Encuestas]
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
 *         description: Encuesta actualizada
 *       404:
 *         description: Encuesta no encontrada
 */
router.put('/:id', authenticate, isPsicologo, updateEncuestaPut);

/**
 * @swagger
 * /api/encuestas/{id}:
 *   patch:
 *     summary: Actualizar parcialmente una encuesta
 *     tags: [Encuestas]
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
 *         description: Encuesta actualizada
 *       404:
 *         description: Encuesta no encontrada
 */
router.patch('/:id', authenticate, isPsicologo, updateEncuestaPatch);

/**
 * @swagger
 * /api/encuestas/{id}:
 *   delete:
 *     summary: Eliminar (baja logica) una encuesta
 *     tags: [Encuestas]
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
 *         description: Encuesta eliminada
 *       404:
 *         description: Encuesta no encontrada
 */
router.delete('/:id', authenticate, isPsicologo, deleteEncuesta);

export default router;