import { Router } from 'express';

import { authenticate, isBienestarUniversitario, isUsuario } from '../middleware/auth.middleware';
import {
	actualizarSolicitudPremioPanel,
	getPremiosCatalogo,
	getSolicitudesPremiosPanel,
	solicitarPremio,
} from '../controllers/premios.controller';

const router = Router();

router.get('/catalogo', authenticate, isUsuario, getPremiosCatalogo);
router.post('/solicitar', authenticate, isUsuario, solicitarPremio);
router.get('/panel/solicitudes', authenticate, isBienestarUniversitario, getSolicitudesPremiosPanel);
router.patch('/panel/solicitudes/:id', authenticate, isBienestarUniversitario, actualizarSolicitudPremioPanel);

export default router;
