import { Router } from 'express';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import { solicitarAsignacion, misSolicitudes } from '../controllers/asignaciones.controller';

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

export default router;