import { Router } from 'express';
import { authenticate, isPsicologo } from '../middleware/auth.middleware';
import { esPsicologoDeEstudiante } from '../middleware/authorization.middleware';
import {
  getPerfilEstudiante,
  getResumenEstudiante,
  getEvaluacionesEstudiante,
  getActividadesEstudiante,
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

/**
 * @route   GET /api/psicologo/pacientes/:estudianteId/evaluaciones
 * @desc    Historial completo de evaluaciones (semáforos y puntajes), con dimensiones
 * @access  Psicólogo con asignación activa
 */
router.get(
  '/pacientes/:estudianteId/evaluaciones',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getEvaluacionesEstudiante
);

/**
 * @route   GET /api/psicologo/pacientes/:estudianteId/actividades
 * @desc    Historial completo de actividades y sus vencimientos (vigentes y vencidas)
 * @access  Psicólogo con asignación activa
 */
router.get(
  '/pacientes/:estudianteId/actividades',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getActividadesEstudiante
);

export default router;
