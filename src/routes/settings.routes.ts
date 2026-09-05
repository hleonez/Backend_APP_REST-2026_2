import { Router } from 'express';
import * as settingsController from "../controllers/settings.controller";
import { authenticate, isUsuario } from '../middleware/auth.middleware';

const router = Router();

router.get("/profile", authenticate, isUsuario, settingsController.getProfile);
router.put("/profile", authenticate, isUsuario, settingsController.updateProfile);
router.put("/preferences", authenticate, isUsuario, settingsController.updatePreferences);
router.put("/change-password", authenticate, isUsuario, settingsController.changePassword);
router.post("/report", authenticate, isUsuario, settingsController.reportIssue);
router.post("/feedback", authenticate, isUsuario, settingsController.sendFeedback);
router.get("/code-of-conduct", authenticate, isUsuario, settingsController.getCodeOfConduct);
router.get("/privacy-policy", authenticate, isUsuario, settingsController.getPrivacyPolicy);
router.get("/terms", authenticate, isUsuario, settingsController.getTerms);

export default router;