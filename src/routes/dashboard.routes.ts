import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
const router = Router();

router.get('/', authenticate, isUsuario, getDashboard);
export default router;