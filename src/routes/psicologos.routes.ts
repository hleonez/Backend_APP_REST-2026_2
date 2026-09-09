import { Router } from 'express';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import { listPsicologos, getPsicologoById } from '../controllers/psicologos.controller';

const router = Router();

router.get('/', authenticate, isUsuario, listPsicologos);
router.get('/:id', authenticate, isUsuario, getPsicologoById);

export default router;