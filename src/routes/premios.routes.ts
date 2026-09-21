import { Router } from 'express';

import { authenticate, isBienestarUniversitario, isUsuario } from '../middleware/auth.middleware';
import {
        actualizarSolicitudPremioPanel,
        getPremiosCatalogo,
        getSolicitudesPremiosPanel,
        solicitarPremio,
} from '../controllers/premios.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Premios
 *   description: >
 *     Catalogo de premios y solicitudes de canje. Las solicitudes de premios
 *     son un dato sensible: nunca se exponen a traves del panel del psicologo.
 */

/**
 * @swagger
 * /api/premios/catalogo:
 *   get:
 *     summary: Consultar el catalogo de premios disponibles
 *     tags: [Premios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Catalogo de premios
 *       403:
 *         description: Requiere rol usuario
 */
router.get('/catalogo', authenticate, isUsuario, getPremiosCatalogo);

/**
 * @swagger
 * /api/premios/solicitar:
 *   post:
 *     summary: Solicitar el canje de un premio
 *     tags: [Premios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Solicitud de canje creada
 *       400:
 *         description: Estrellas insuficientes o datos invalidos
 *       403:
 *         description: Requiere rol usuario
 */
router.post('/solicitar', authenticate, isUsuario, solicitarPremio);

/**
 * @swagger
 * /api/premios/panel/solicitudes:
 *   get:
 *     summary: Panel de Bienestar Universitario - listar solicitudes de premios
 *     tags: [Premios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de solicitudes de premios
 *       403:
 *         description: Requiere rol Bienestar Universitario
 */
router.get('/panel/solicitudes', authenticate, isBienestarUniversitario, getSolicitudesPremiosPanel);

/**
 * @swagger
 * /api/premios/panel/solicitudes/{id}:
 *   patch:
 *     summary: Panel de Bienestar Universitario - aprobar/rechazar una solicitud de premio
 *     tags: [Premios]
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
 *         description: Solicitud actualizada
 *       403:
 *         description: Requiere rol Bienestar Universitario
 *       404:
 *         description: Solicitud no encontrada
 */
router.patch('/panel/solicitudes/:id', authenticate, isBienestarUniversitario, actualizarSolicitudPremioPanel);

export default router;