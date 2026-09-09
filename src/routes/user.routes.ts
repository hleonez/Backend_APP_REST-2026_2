import { Router } from 'express';
import { authenticate, isAdmin, isUsuario } from '../middleware/auth.middleware';
import { authorizeUserResource } from '../middleware/authorization.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

/**
 * @route GET /api/users/profile
 * @desc Get authenticated user profile
 * @access Private (usuario autenticado)
 */
router.get('/profile', authenticate, isUsuario, userController.getProfile);

// Compromiso de racha del usuario autenticado
router.get('/streak-commitment', authenticate, isUsuario, userController.getMyStreakCommitment);
router.put('/streak-commitment', authenticate, isUsuario, userController.updateMyStreakCommitment);
router.post('/streak-commitment/register-daily', authenticate, isUsuario, userController.registerMyDailyStreak);

// Listar usuarios (solo admin)
router.get('/', authenticate, isAdmin, userController.listUsers);
// Crear usuario (solo admin)
router.post('/', authenticate, isAdmin, userController.createUser);

// Obtener usuario por id (autenticado y dueño, o admin)
router.get('/:id', authenticate, authorizeUserResource, userController.getUserById);
// Actualizar usuario completo (solo dueño con restricciones o admin)
router.put('/:id', authenticate, authorizeUserResource, userController.updateUserPut);
// Actualización parcial
router.patch('/:id', authenticate, authorizeUserResource, userController.updateUserPatch);
// Eliminar usuario (solo admin)
router.delete('/:id', authenticate, isAdmin, userController.deleteUser);

export default router;