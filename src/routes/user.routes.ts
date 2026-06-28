import { Router } from 'express';
import { authenticate, isPsicologo, isUsuario } from '../middleware/auth.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

// Listar usuarios (solo psicólogo)
router.get('/', authenticate, isPsicologo, userController.listUsers)
// Crear usuario (solo psicólogo)
router.post('/', authenticate, isPsicologo, userController.createUser)

/**
 * @route GET /api/users/profile
 * @desc Get authenticated user profile
 * @access Private
 */
router.get('/profile', authenticate, isUsuario, userController.getProfile);

// Compromiso de racha del usuario autenticado
router.get('/streak-commitment', authenticate, isUsuario, userController.getMyStreakCommitment);
router.put('/streak-commitment', authenticate, isUsuario, userController.updateMyStreakCommitment);
router.post('/streak-commitment/register-daily', authenticate, isUsuario, userController.registerMyDailyStreak);

// Obtener usuario por id (autenticado y dueño o psicólogo)
router.get('/:id', authenticate, userController.getUserById)
// Actualizar usuario completo (solo psicólogo o dueño con restricciones)
router.put('/:id', authenticate, userController.updateUserPut)
// Actualización parcial
router.patch('/:id', authenticate, userController.updateUserPatch)
// Eliminar usuario (solo psicólogo)
router.delete('/:id', authenticate, isPsicologo, userController.deleteUser)

export default router;