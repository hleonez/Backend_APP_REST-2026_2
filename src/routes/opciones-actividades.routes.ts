import { Router } from 'express';
import { authenticate, isPsicologo } from '../middleware/auth.middleware';
import { listOpciones, getOpcionById, createOpcion, updateOpcionPut, updateOpcionPatch, deleteOpcion } from '../controllers/opciones-actividades.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: OpcionesActividades
 *   description: Catalogo de opciones de actividades (gestion del psicologo)
 */

/**
 * @swagger
 * /api/opciones-actividades:
 *   get:
 *     summary: Listar opciones de actividades
 *     tags: [OpcionesActividades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de opciones
 *       403:
 *         description: Requiere rol psicologo
 */
router.get('/', authenticate, isPsicologo, listOpciones);

/**
 * @swagger
 * /api/opciones-actividades/{id}:
 *   get:
 *     summary: Obtener una opcion de actividad por id
 *     tags: [OpcionesActividades]
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
 *         description: Opcion encontrada
 *       404:
 *         description: Opcion no encontrada
 */
router.get('/:id', authenticate, isPsicologo, getOpcionById);

/**
 * @swagger
 * /api/opciones-actividades:
 *   post:
 *     summary: Crear una nueva opcion de actividad
 *     tags: [OpcionesActividades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Opcion creada
 *       403:
 *         description: Requiere rol psicologo
 */
router.post('/', authenticate, isPsicologo, createOpcion);

/**
 * @swagger
 * /api/opciones-actividades/{id}:
 *   put:
 *     summary: Reemplazar una opcion de actividad
 *     tags: [OpcionesActividades]
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
 *         description: Opcion actualizada
 *       404:
 *         description: Opcion no encontrada
 */
router.put('/:id', authenticate, isPsicologo, updateOpcionPut);

/**
 * @swagger
 * /api/opciones-actividades/{id}:
 *   patch:
 *     summary: Actualizar parcialmente una opcion de actividad
 *     tags: [OpcionesActividades]
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
 *         description: Opcion actualizada
 *       404:
 *         description: Opcion no encontrada
 */
router.patch('/:id', authenticate, isPsicologo, updateOpcionPatch);

/**
 * @swagger
 * /api/opciones-actividades/{id}:
 *   delete:
 *     summary: Eliminar (baja logica) una opcion de actividad
 *     tags: [OpcionesActividades]
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
 *         description: Opcion eliminada
 *       404:
 *         description: Opcion no encontrada
 */
router.delete('/:id', authenticate, isPsicologo, deleteOpcion);

export default router;