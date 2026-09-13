import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
const router = Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Resumen general del usuario autenticado
 */

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Obtener el dashboard del usuario autenticado
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del dashboard
 *       401:
 *         description: No autenticado
 */
router.get('/', authenticate, isUsuario, getDashboard);
export default router;