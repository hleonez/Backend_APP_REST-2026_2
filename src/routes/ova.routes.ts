import { Router } from 'express';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import { OvaEstudianteController } from '../controllers/ova/ova-estudiante.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: OVAs - Estudiante
 *   description: >
 *     Endpoints para el estudiante: consulta de actividades asignadas dinámicamente por el motor de reglas,
 *     transición de estados ("¿ya lo hiciste?"), retroalimentación y enlace post-test.
 */

/**
 * @swagger
 * /api/ovas/asignaciones:
 *   get:
 *     summary: Lista de OVAs asignados al estudiante
 *     description: Retorna asignaciones activas (PENDING, IN_PROGRESS) y COMPLETED pendientes de post-test.
 *     tags: [OVAs - Estudiante]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de asignaciones activas
 *       401:
 *         description: No autenticado
 */
router.get('/asignaciones', authenticate, isUsuario, OvaEstudianteController.listarAsignaciones);

/**
 * @swagger
 * /api/ovas/asignaciones/{id}:
 *   get:
 *     summary: Detalle de una asignación de OVA
 *     description: Obtiene la información completa de la asignación y el recurso web resuelto (video embebido YouTube, artículo web o R2).
 *     tags: [OVAs - Estudiante]
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
 *         description: Detalle de la asignación
 *       404:
 *         description: Asignación no encontrada
 */
router.get('/asignaciones/:id', authenticate, isUsuario, OvaEstudianteController.obtenerDetalle);

/**
 * @swagger
 * /api/ovas/asignaciones/{id}/iniciar:
 *   patch:
 *     summary: Iniciar realización de una actividad OVA
 *     description: Cambia el estado de PENDING a IN_PROGRESS y registra la fecha de inicio.
 *     tags: [OVAs - Estudiante]
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
 *         description: Actividad iniciada
 *       400:
 *         description: Estado no válido para iniciar
 */
router.patch('/asignaciones/:id/iniciar', authenticate, isUsuario, OvaEstudianteController.iniciar);

/**
 * @swagger
 * /api/ovas/asignaciones/{id}/completar:
 *   post:
 *     summary: Completar actividad de OVA con feedback
 *     description: Marca la actividad como COMPLETED. Requiere campo 'liked' (booleano) y opcional 'rating' (1-5). Responde si requiere post-test.
 *     tags: [OVAs - Estudiante]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - liked
 *             properties:
 *               liked:
 *                 type: boolean
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       200:
 *         description: Actividad completada
 *       400:
 *         description: Error de validación o actividad ya completada
 */
router.post('/asignaciones/:id/completar', authenticate, isUsuario, OvaEstudianteController.completar);

/**
 * @swagger
 * /api/ovas/asignaciones/{id}/omitir:
 *   post:
 *     summary: Omitir o descartar un OVA asignado
 *     description: Permite indicar que no se realizará la actividad (SKIPPED o DISMISSED). Activa cooldown de 7 días.
 *     tags: [OVAs - Estudiante]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [SKIPPED, DISMISSED]
 *     responses:
 *       200:
 *         description: Actividad omitida
 *       400:
 *         description: Error de validación
 */
router.post('/asignaciones/:id/omitir', authenticate, isUsuario, OvaEstudianteController.omitir);

export default router;
