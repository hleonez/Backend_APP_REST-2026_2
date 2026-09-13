import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, isAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Gestion administrativa de psicologos y estadisticas (solo rol admin)
 */

/**
 * @swagger
 * /api/admin/addPsychologist:
 *   post:
 *     summary: Registrar un nuevo psicologo
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombres:
 *                 type: string
 *               apellidos:
 *                 type: string
 *               correo:
 *                 type: string
 *               contrasena:
 *                 type: string
 *     responses:
 *       201:
 *         description: Psicologo registrado
 *       400:
 *         description: Datos invalidos
 *       403:
 *         description: Requiere rol admin
 *       409:
 *         description: El correo ya esta registrado
 */
router.post("/addPsychologist", authenticate, isAdmin, adminController.registerPsychologist);

/**
 * @swagger
 * /api/admin/count:
 *   get:
 *     summary: Conteo de usuarios del sistema
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conteo de usuarios
 *       403:
 *         description: Requiere rol admin
 */
router.get("/count", authenticate, isAdmin, adminController.countUsuarios);

/**
 * @swagger
 * /api/admin/students:
 *   get:
 *     summary: Listar estudiantes
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de estudiantes
 *       403:
 *         description: Requiere rol admin
 */
router.get("/students", authenticate, isAdmin, adminController.getStudents);

/**
 * @swagger
 * /api/admin/students/{id}:
 *   get:
 *     summary: Detalle de un estudiante
 *     tags: [Admin]
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
 *         description: Datos del estudiante
 *       403:
 *         description: Requiere rol admin
 *       404:
 *         description: Estudiante no encontrado
 */
router.get("/students/:id", authenticate, isAdmin, adminController.getStudentById);

/**
 * @swagger
 * /api/admin/psychologists:
 *   get:
 *     summary: Listar psicologos (incluye datos de contacto, solo admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de psicologos
 *       403:
 *         description: Requiere rol admin
 */
router.get("/psychologists", authenticate, isAdmin, adminController.getPsychologists);

/**
 * @swagger
 * /api/admin/psychologists/{id}:
 *   get:
 *     summary: Detalle de un psicologo (incluye datos de contacto, solo admin)
 *     tags: [Admin]
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
 *         description: Datos del psicologo
 *       403:
 *         description: Requiere rol admin
 *       404:
 *         description: Psicologo no encontrado
 */
router.get("/psychologists/:id", authenticate, isAdmin, adminController.getPsychologistById);

/**
 * @swagger
 * /api/admin/psychologists/{id}:
 *   put:
 *     summary: Actualizar datos de un psicologo
 *     tags: [Admin]
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
 *         description: Psicologo actualizado
 *       403:
 *         description: Requiere rol admin
 *       404:
 *         description: Psicologo no encontrado
 */
router.put("/psychologists/:id", authenticate, isAdmin, adminController.updatePsychologist);

/**
 * @swagger
 * /api/admin/psychologists/{id}:
 *   delete:
 *     summary: Eliminar (baja logica) un psicologo
 *     tags: [Admin]
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
 *         description: Psicologo eliminado
 *       403:
 *         description: Requiere rol admin
 *       404:
 *         description: Psicologo no encontrado
 */
router.delete("/psychologists/:id", authenticate, isAdmin, adminController.deletePsychologist);

export default router;