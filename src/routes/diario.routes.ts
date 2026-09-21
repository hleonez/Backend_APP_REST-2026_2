import { Router } from 'express';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import { listDiario, getDiarioById, createDiario, updateDiarioPut, updateDiarioPatch, deleteDiario } from '../controllers/diario.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Diario
 *   description: >
 *     Diario personal del estudiante. Dato estrictamente privado: nunca se expone
 *     al psicologo a traves del panel de seguimiento.
 */

/**
 * @swagger
 * /api/diario:
 *   get:
 *     summary: Listar entradas del diario del usuario autenticado
 *     tags: [Diario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de entradas del diario
 *       401:
 *         description: No autenticado
 */
router.get('/', authenticate, isUsuario, listDiario);

/**
 * @swagger
 * /api/diario/{id}:
 *   get:
 *     summary: Obtener una entrada del diario por id
 *     tags: [Diario]
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
 *         description: Entrada del diario
 *       404:
 *         description: Entrada no encontrada
 */
router.get('/:id', authenticate, isUsuario, getDiarioById);

/**
 * @swagger
 * /api/diario:
 *   post:
 *     summary: Crear una nueva entrada de diario
 *     tags: [Diario]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - contenido
 *             properties:
 *               titulo:
 *                 type: string
 *               contenido:
 *                 type: string
 *     responses:
 *       201:
 *         description: Entrada creada
 *       400:
 *         description: Datos invalidos
 */
router.post('/', authenticate, isUsuario, createDiario);

/**
 * @swagger
 * /api/diario/{id}:
 *   put:
 *     summary: Reemplazar una entrada de diario
 *     tags: [Diario]
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
 *         description: Entrada actualizada
 *       404:
 *         description: Entrada no encontrada
 */
router.put('/:id', authenticate, isUsuario, updateDiarioPut);

/**
 * @swagger
 * /api/diario/{id}:
 *   patch:
 *     summary: Actualizar parcialmente una entrada de diario
 *     tags: [Diario]
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
 *         description: Entrada actualizada
 *       404:
 *         description: Entrada no encontrada
 */
router.patch('/:id', authenticate, isUsuario, updateDiarioPatch);

/**
 * @swagger
 * /api/diario/{id}:
 *   delete:
 *     summary: Eliminar (baja logica) una entrada de diario
 *     tags: [Diario]
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
 *         description: Entrada eliminada
 *       404:
 *         description: Entrada no encontrada
 */
router.delete('/:id', authenticate, isUsuario, deleteDiario);

export default router;