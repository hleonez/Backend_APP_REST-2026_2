import { Router } from 'express';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import { listPsicologos, getPsicologoById } from '../controllers/psicologos.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Psicologos
 *   description: Directorio publico de psicologos (sin datos de contacto)
 */

/**
 * @swagger
 * /api/psicologos:
 *   get:
 *     summary: Listar directorio publico de psicologos
 *     description: >
 *       Devuelve el listado de psicologos activos. Por privacidad, nunca incluye
 *       `correo` ni `telefono`; solo datos aptos para un directorio publico.
 *     tags: [Psicologos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de psicologos activos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   nombres:
 *                     type: string
 *                   apellidos:
 *                     type: string
 *                   especialidad_psicologo:
 *                     type: string
 *                     nullable: true
 *                   ciudad:
 *                     type: string
 *                     nullable: true
 *                   idioma:
 *                     type: string
 *                     nullable: true
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Rol no autorizado (solo usuarios con rol "usuario")
 */
router.get('/', authenticate, isUsuario, listPsicologos);

/**
 * @swagger
 * /api/psicologos/{id}:
 *   get:
 *     summary: Detalle publico de un psicologo
 *     description: Mismos campos permitidos que el listado (sin correo ni telefono).
 *     tags: [Psicologos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del psicologo
 *     responses:
 *       200:
 *         description: Datos publicos del psicologo
 *       400:
 *         description: ID invalido
 *       404:
 *         description: Psicologo no encontrado
 */
router.get('/:id', authenticate, isUsuario, getPsicologoById);

export default router;