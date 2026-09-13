import { Router } from 'express';
import * as settingsController from "../controllers/settings.controller";
import { authenticate, isUsuario } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: >
 *     Configuracion de cuenta, reportes tecnicos y feedback del usuario. El
 *     feedback y las fallas tecnicas reportadas aqui son datos internos del
 *     sistema: nunca se exponen a traves del panel del psicologo.
 */

/**
 * @swagger
 * /api/settings/profile:
 *   get:
 *     summary: Obtener el perfil de configuracion del usuario autenticado
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *       403:
 *         description: Requiere rol usuario
 */
router.get("/profile", authenticate, isUsuario, settingsController.getProfile);

/**
 * @swagger
 * /api/settings/profile:
 *   put:
 *     summary: Actualizar el perfil del usuario autenticado
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *       403:
 *         description: Requiere rol usuario
 */
router.put("/profile", authenticate, isUsuario, settingsController.updateProfile);

/**
 * @swagger
 * /api/settings/preferences:
 *   put:
 *     summary: Actualizar las preferencias del usuario autenticado
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferencias actualizadas
 *       403:
 *         description: Requiere rol usuario
 */
router.put("/preferences", authenticate, isUsuario, settingsController.updatePreferences);

/**
 * @swagger
 * /api/settings/report:
 *   post:
 *     summary: Reportar una falla tecnica
 *     description: Dato interno del sistema; nunca se expone en el panel del psicologo.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Falla tecnica registrada
 *       403:
 *         description: Requiere rol usuario
 */
router.post("/report", authenticate, isUsuario, settingsController.reportIssue);

/**
 * @swagger
 * /api/settings/feedback:
 *   post:
 *     summary: Enviar feedback sobre la aplicacion
 *     description: Dato interno del sistema; nunca se expone en el panel del psicologo.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Feedback registrado
 *       403:
 *         description: Requiere rol usuario
 */
router.post("/feedback", authenticate, isUsuario, settingsController.sendFeedback);

/**
 * @swagger
 * /api/settings/code-of-conduct:
 *   get:
 *     summary: Obtener el codigo de conducta
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Texto del codigo de conducta
 */
router.get("/code-of-conduct", authenticate, isUsuario, settingsController.getCodeOfConduct);

/**
 * @swagger
 * /api/settings/privacy-policy:
 *   get:
 *     summary: Obtener la politica de privacidad
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Texto de la politica de privacidad
 */
router.get("/privacy-policy", authenticate, isUsuario, settingsController.getPrivacyPolicy);

/**
 * @swagger
 * /api/settings/terms:
 *   get:
 *     summary: Obtener los terminos y condiciones
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Texto de terminos y condiciones
 */
router.get("/terms", authenticate, isUsuario, settingsController.getTerms);

export default router;