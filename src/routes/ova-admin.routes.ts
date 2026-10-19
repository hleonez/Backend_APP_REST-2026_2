import { Router } from 'express';
import { authenticate, isAdmin } from '../middleware/auth.middleware';
import { recibirArchivoOva } from '../middleware/ova-archivo.middleware';
import { OvaPsicologoController } from '../controllers/ova/ova-psicologo.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: OVAs - Admin
 *   description: Carga de archivos del catálogo OVA al bucket público de R2. El estudiante solo consulta.
 */

/**
 * @swagger
 * /api/admin/ovas/archivos:
 *   post:
 *     summary: Subir un archivo de OVA a Cloudflare R2
 *     description: >
 *       Igual que el portal del psicólogo. Guarda la object key bajo `ovas/` y el estudiante
 *       la abre con la URL pública. No firma enlaces ni acepta fotos de perfil.
 *     tags: [OVAs - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - archivo
 *             properties:
 *               archivo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Archivo cargado. `resource_url` es la object key.
 *       403:
 *         description: Requiere rol admin
 *       503:
 *         description: Faltan credenciales o la URL pública de R2
 */
router.post('/archivos', authenticate, isAdmin, recibirArchivoOva, OvaPsicologoController.subirArchivo);

/**
 * @swagger
 * /api/admin/ovas:
 *   post:
 *     summary: Registrar un OVA en el catálogo
 *     description: Para un archivo de R2, `resource_url` es la key devuelta por `POST /api/admin/ovas/archivos`.
 *     tags: [OVAs - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - tipo_actividad
 *               - storage_source
 *               - resource_url
 *             properties:
 *               titulo:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               tipo_actividad:
 *                 type: string
 *                 enum: [video, respiracion, ejercicio_practico]
 *               duracion_minutos:
 *                 type: integer
 *               storage_source:
 *                 type: string
 *                 enum: [YOUTUBE, CLOUDFLARE_R2, EXTERNAL_URL]
 *               resource_url:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: OVA creado
 *       403:
 *         description: Requiere rol admin
 */
router.post('/', authenticate, isAdmin, OvaPsicologoController.crearOva);

export default router;
