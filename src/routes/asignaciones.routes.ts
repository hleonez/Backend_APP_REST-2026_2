import { Router } from 'express';
import { authenticate, isUsuario, isPsicologo } from '../middleware/auth.middleware';
import { solicitarAsignacion, misSolicitudes, solicitudesPsicologo, aprobarSolicitud, rechazarSolicitud, misPacientes } from '../controllers/asignaciones.controller';

const router = Router();

/**
 * @route POST /api/asignaciones/solicitar
 * @desc Estudiante solicita atención a un psicólogo
 * @access Private (Estudiante)
 */
router.post('/solicitar', authenticate, isUsuario, solicitarAsignacion);

/**
 * @route GET /api/asignaciones/mis-solicitudes
 * @desc Historial de solicitudes del estudiante autenticado
 * @access Private (Estudiante)
 */
router.get('/mis-solicitudes', authenticate, isUsuario, misSolicitudes);

/**
 * @route GET /api/asignaciones/psicologo/solicitudes
 * @desc Buzón: solicitudes pendientes dirigidas al psicólogo autenticado
 * @access Private (Psicólogo)
 */
router.get('/psicologo/solicitudes', authenticate, isPsicologo, solicitudesPsicologo);

/**
 * @route GET /api/asignaciones/psicologo/mis-pacientes
 * @desc Estudiantes activos (asignación aprobada) a cargo del psicólogo autenticado
 * @access Private (Psicólogo)
 */
router.get('/psicologo/mis-pacientes', authenticate, isPsicologo, misPacientes);

/**
 * @route PATCH /api/asignaciones/:id/aprobar
 * @desc Aprueba una solicitud pendiente dirigida al psicólogo autenticado
 * @access Private (Psicólogo)
 */
router.patch('/:id/aprobar', authenticate, isPsicologo, aprobarSolicitud);

/**
 * @route PATCH /api/asignaciones/:id/rechazar
 * @desc Rechaza una solicitud pendiente dirigida al psicólogo autenticado
 * @access Private (Psicólogo)
 */
router.patch('/:id/rechazar', authenticate, isPsicologo, rechazarSolicitud);

export default router;