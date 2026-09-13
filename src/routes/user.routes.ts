import { Router } from 'express';
import { authenticate, isAdmin, isUsuario } from '../middleware/auth.middleware';
import { authorizeUserResource } from '../middleware/authorization.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Usuarios
 *   description: Perfil, racha y administracion de usuarios
 */

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Obtener el perfil del usuario autenticado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *       401:
 *         description: No autenticado
 */
router.get('/profile', authenticate, isUsuario, userController.getProfile);

/**
 * @swagger
 * /api/users/streak-commitment:
 *   get:
 *     summary: Obtener el compromiso de racha del usuario autenticado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compromiso de racha
 */
router.get('/streak-commitment', authenticate, isUsuario, userController.getMyStreakCommitment);

/**
 * @swagger
 * /api/users/streak-commitment:
 *   put:
 *     summary: Actualizar el compromiso de racha del usuario autenticado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compromiso actualizado
 */
router.put('/streak-commitment', authenticate, isUsuario, userController.updateMyStreakCommitment);

/**
 * @swagger
 * /api/users/streak-commitment/register-daily:
 *   post:
 *     summary: Registrar el cumplimiento diario de la racha
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Racha diaria registrada
 */
router.post('/streak-commitment/register-daily', authenticate, isUsuario, userController.registerMyDailyStreak);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Listar todos los usuarios (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       403:
 *         description: Requiere rol admin
 */
router.get('/', authenticate, isAdmin, userController.listUsers);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Crear un usuario (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Usuario creado
 *       403:
 *         description: Requiere rol admin
 */
router.post('/', authenticate, isAdmin, userController.createUser);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Obtener un usuario por id (dueno del recurso o admin)
 *     tags: [Usuarios]
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
 *         description: Usuario encontrado
 *       403:
 *         description: Solo el propietario del recurso o un administrador puede acceder
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/:id', authenticate, authorizeUserResource, userController.getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Reemplazar los datos de un usuario (dueno con restricciones, o admin)
 *     tags: [Usuarios]
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
 *         description: Usuario actualizado
 *       403:
 *         description: Solo el propietario del recurso o un administrador puede acceder
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/:id', authenticate, authorizeUserResource, userController.updateUserPut);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Actualizar parcialmente un usuario
 *     tags: [Usuarios]
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
 *         description: Usuario actualizado
 *       403:
 *         description: Solo el propietario del recurso o un administrador puede acceder
 *       404:
 *         description: Usuario no encontrado
 */
router.patch('/:id', authenticate, authorizeUserResource, userController.updateUserPatch);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Eliminar un usuario (solo admin)
 *     tags: [Usuarios]
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
 *         description: Usuario eliminado
 *       403:
 *         description: Requiere rol admin
 *       404:
 *         description: Usuario no encontrado
 */
router.delete('/:id', authenticate, isAdmin, userController.deleteUser);

export default router;