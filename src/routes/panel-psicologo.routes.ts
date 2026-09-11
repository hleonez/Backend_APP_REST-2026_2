import { Router } from 'express';
import { authenticate, isPsicologo } from '../middleware/auth.middleware';
import { esPsicologoDeEstudiante } from '../middleware/authorization.middleware';
import {
  getPerfilEstudiante,
  getResumenEstudiante,
} from '../controllers/panel-psicologo.controller';

const router = Router();

// Cadena de seguridad compartida por todas las rutas del panel:
//   1. authenticate          — JWT válido y usuario activo
//   2. isPsicologo           — rol == 'psicologo'
//   3. esPsicologoDeEstudiante — asignación aprobada activa con ese estudiante

/**
 * @route   GET /api/psicologo/pacientes/:estudianteId/perfil
 * @desc    Datos generales del estudiante (sin correo, contraseña ni teléfono)
 * @access  Psicólogo con asignación activa
 */
router.get(
  '/pacientes/:estudianteId/perfil',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getPerfilEstudiante
);

/**
 * @route   GET /api/psicologo/pacientes/:estudianteId/resumen
 * @desc    Ficha consolidada: perfil + última evaluación (semáforo/dimensiones) + actividades vigentes
 * @access  Psicólogo con asignación activa
 */
router.get(
  '/pacientes/:estudianteId/resumen',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getResumenEstudiante
);

export default router;
