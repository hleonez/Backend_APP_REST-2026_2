// ROUTES
import { Router } from 'express';

// CONTROLLERS
import * as authController from '../controllers/auth.controller';
import {
	loginRateLimiter,
	passwordResetRateLimiter,
	registerRateLimiter,
} from '../middleware/rate-limit.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticación y registro de usuarios
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombres
 *               - apellidos
 *               - correo
 *               - contrasena
 *             properties:
 *               nombres:
 *                 type: string
 *                 example: Samuel
 *               apellidos:
 *                 type: string
 *                 example: León
 *               correo:
 *                 type: string
 *                 example: samuel@example.com
 *               contrasena:
 *                 type: string
 *                 example: password123
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 */
router.post('/register', registerRateLimiter, authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión (Usuario / Psicólogo / Admin)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - correo
 *               - contrasena
 *             properties:
 *               correo:
 *                 type: string
 *                 example: usuario@test.com
 *               contrasena:
 *                 type: string
 *                 example: "12345678"
 *     responses:
 *       200:
 *         description: Login exitoso, retorna el Token JWT
 */
router.post('/login', loginRateLimiter, authController.login);

/**
 * @swagger
 * /api/auth/recover-password:
 *   post:
 *     summary: Recuperar contraseña
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - correo
 *               - nuevaContrasena
 *             properties:
 *               correo:
 *                 type: string
 *                 example: usuario@test.com
 *               nuevaContrasena:
 *                 type: string
 *                 example: nuevaClave123
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 */
router.post('/recover-password', passwordResetRateLimiter, authController.recoverPassword);

export default router; 