import { Router } from 'express';
import { authenticate, isUsuario, isPsicologo } from '../middleware/auth.middleware';
import { solicitarAsignacion, misSolicitudes, solicitudesPsicologo, aprobarSolicitud, rechazarSolicitud, misPacientes, finalizarAsignacion } from '../controllers/asignaciones.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Asignaciones
 *   description: Solicitudes de atencion psicologica (estudiante <-> psicologo)
 */

/**
 * @swagger
 * /api/asignaciones/solicitar:
 *   post:
 *     summary: El estudiante solicita atencion a un psicologo
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - psicologo_id
 *             properties:
 *               psicologo_id:
 *                 type: integer
 *               mensaje:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Solicitud creada en estado "pendiente"
 *       400:
 *         description: Autoasignacion, solicitud duplicada, asignacion aprobada ya existente, o body invalido
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Psicologo no encontrado
 */
/**
 * @route POST /api/asignaciones/solicitar
 * @desc Estudiante solicita atención a un psicólogo
 * @access Private (Estudiante)
 */
router.post('/solicitar', authenticate, isUsuario, solicitarAsignacion);

/**
 * @swagger
 * /api/asignaciones/mis-solicitudes:
 *   get:
 *     summary: Historial de solicitudes del estudiante autenticado
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historial de solicitudes (aislado por estudiante)
 *       401:
 *         description: No autenticado
 */
/**
 * @route GET /api/asignaciones/mis-solicitudes
 * @desc Historial de solicitudes del estudiante autenticado
 * @access Private (Estudiante)
 */
router.get('/mis-solicitudes', authenticate, isUsuario, misSolicitudes);

/**
 * @swagger
 * /api/asignaciones/psicologo/solicitudes:
 *   get:
 *     summary: Buzon de solicitudes pendientes del psicologo autenticado
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Solicitudes pendientes dirigidas al psicologo
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Rol no autorizado (requiere rol psicologo)
 */
/**
 * @route GET /api/asignaciones/psicologo/solicitudes
 * @desc Buzón: solicitudes pendientes dirigidas al psicólogo autenticado
 * @access Private (Psicólogo)
 */
router.get('/psicologo/solicitudes', authenticate, isPsicologo, solicitudesPsicologo);

/**
 * @swagger
 * /api/asignaciones/psicologo/mis-pacientes:
 *   get:
 *     summary: Estudiantes activos (asignacion aprobada) del psicologo autenticado
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de pacientes activos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Rol no autorizado (requiere rol psicologo)
 */
/**
 * @route GET /api/asignaciones/psicologo/mis-pacientes
 * @desc Estudiantes activos (asignación aprobada) a cargo del psicólogo autenticado
 * @access Private (Psicólogo)
 */
router.get('/psicologo/mis-pacientes', authenticate, isPsicologo, misPacientes);

/**
 * @swagger
 * /api/asignaciones/{id}/aprobar:
 *   patch:
 *     summary: Aprueba una solicitud pendiente dirigida al psicologo autenticado
 *     tags: [Asignaciones]
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
 *         description: Solicitud aprobada, estado cambia a "aprobado"
 *       400:
 *         description: ID invalido
 *       403:
 *         description: La solicitud no pertenece a este psicologo
 *       404:
 *         description: Solicitud no encontrada
 */
/**
 * @route PATCH /api/asignaciones/:id/aprobar
 * @desc Aprueba una solicitud pendiente dirigida al psicólogo autenticado
 * @access Private (Psicólogo)
 */
router.patch('/:id/aprobar', authenticate, isPsicologo, aprobarSolicitud);

/**
 * @swagger
 * /api/asignaciones/{id}/rechazar:
 *   patch:
 *     summary: Rechaza una solicitud pendiente dirigida al psicologo autenticado
 *     tags: [Asignaciones]
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
 *         description: Solicitud rechazada, estado cambia a "rechazado"
 *       400:
 *         description: ID invalido
 *       403:
 *         description: La solicitud no pertenece a este psicologo
 *       404:
 *         description: Solicitud no encontrada
 */
/**
 * @route PATCH /api/asignaciones/:id/rechazar
 * @desc Rechaza una solicitud pendiente dirigida al psicólogo autenticado
 * @access Private (Psicólogo)
 */
router.patch('/:id/rechazar', authenticate, isPsicologo, rechazarSolicitud);

/**
 * @swagger
 * /api/asignaciones/{id}:
 *   delete:
 *     summary: Finaliza o cancela una asignacion aprobada
 *     tags: [Asignaciones]
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
 *         description: Asignacion finalizada, estado cambia a "finalizado"
 *       400:
 *         description: ID invalido
 *       403:
 *         description: No autorizado sobre esta asignacion
 *       404:
 *         description: Asignacion no encontrada
 */
/**
 * @route DELETE /api/asignaciones/:id
 * @desc Finaliza o cancela una asignación (estudiante o psicólogo)
 * @access Private
 */
router.delete('/:id', authenticate, finalizarAsignacion);

export default router;