import { Router } from 'express';
import { authenticate, isPsicologo } from '../middleware/auth.middleware';
import { esPsicologoDeEstudiante } from '../middleware/authorization.middleware';
import { OvaPsicologoController } from '../controllers/ova/ova-psicologo.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: OVAs - Portal Psicólogo
 *   description: >
 *     Gestión global del catálogo de OVAs, configuración de reglas de asignación por métricas/comportamiento,
 *     reportes de efectividad Pre vs Post, y lectura clínica de pacientes asignados.
 */

// ==========================================
// 1. Catálogo de OVAs
// ==========================================

/**
 * @swagger
 * /api/psicologo/ovas:
 *   get:
 *     summary: Listar catálogo general de OVAs
 *     tags: [OVAs - Portal Psicólogo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Búsqueda por título
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [video, respiracion, ejercicio_practico]
 *       - in: query
 *         name: activo
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Lista de OVAs con URLs resueltas
 */
router.get('/', authenticate, isPsicologo, OvaPsicologoController.listarOvas);

/**
 * @swagger
 * /api/psicologo/ovas:
 *   post:
 *     summary: Crear un nuevo OVA en el catálogo
 *     tags: [OVAs - Portal Psicólogo]
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
 *                 default: 5
 *               storage_source:
 *                 type: string
 *                 enum: [YOUTUBE, CLOUDFLARE_R2, EXTERNAL_URL]
 *               resource_url:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: OVA creado exitosamente
 *       400:
 *         description: URL o campos inválidos
 */
router.post('/', authenticate, isPsicologo, OvaPsicologoController.crearOva);

/**
 * @swagger
 * /api/psicologo/ovas/efectividad:
 *   get:
 *     summary: Reporte global de efectividad de los OVAs
 *     description: Retorna métricas de adherencia, % de feedback positivo, rating promedio y delta de mejora pre vs post.
 *     tags: [OVAs - Portal Psicólogo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen estadístico y desgloses
 */
router.get('/efectividad', authenticate, isPsicologo, OvaPsicologoController.reporteEfectividadGlobal);

/**
 * @swagger
 * /api/psicologo/ovas/{id}:
 *   get:
 *     summary: Detalle de un OVA con sus reglas
 *     tags: [OVAs - Portal Psicólogo]
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
 *         description: Detalle del OVA
 *       404:
 *         description: OVA no encontrado
 */
router.get('/:id', authenticate, isPsicologo, OvaPsicologoController.obtenerOva);

/**
 * @swagger
 * /api/psicologo/ovas/{id}:
 *   patch:
 *     summary: Actualizar datos de un OVA
 *     tags: [OVAs - Portal Psicólogo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *       200:
 *         description: OVA actualizado
 */
router.patch('/:id', authenticate, isPsicologo, OvaPsicologoController.actualizarOva);

/**
 * @swagger
 * /api/psicologo/ovas/{id}/estado:
 *   patch:
 *     summary: Activar o desactivar un OVA
 *     tags: [OVAs - Portal Psicólogo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_active
 *             properties:
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch('/:id/estado', authenticate, isPsicologo, OvaPsicologoController.cambiarEstadoOva);

/**
 * @swagger
 * /api/psicologo/ovas/{id}:
 *   delete:
 *     summary: Eliminar un OVA (Soft delete)
 *     tags: [OVAs - Portal Psicólogo]
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
 *         description: OVA eliminado
 */
router.delete('/:id', authenticate, isPsicologo, OvaPsicologoController.eliminarOva);

// ==========================================
// 2. Reglas de Asignación por Métrica
// ==========================================

/**
 * @swagger
 * /api/psicologo/ovas/{id}/reglas:
 *   get:
 *     summary: Listar reglas de un OVA
 *     tags: [OVAs - Portal Psicólogo]
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
 *         description: Lista de reglas asociadas al OVA
 */
router.get('/:id/reglas', authenticate, isPsicologo, OvaPsicologoController.listarReglas);

/**
 * @swagger
 * /api/psicologo/ovas/{id}/reglas:
 *   post:
 *     summary: Crear una regla de asignación para un OVA
 *     description: Asigna el OVA automáticamente a estudiantes según dimensión y/o nivel de semáforo.
 *     tags: [OVAs - Portal Psicólogo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dimension:
 *                 type: string
 *                 enum: [ansiedad, estres_academico, humor_depresivo, sueno, relaciones_sociales, autoestima_autocuidado, energia_motivacion]
 *               nivel:
 *                 type: string
 *                 enum: [verde, amarillo, rojo]
 *               prioridad:
 *                 type: integer
 *                 default: 0
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Regla creada
 *       409:
 *         description: Regla duplicada para este OVA
 */
router.post('/:id/reglas', authenticate, isPsicologo, OvaPsicologoController.crearRegla);

/**
 * @swagger
 * /api/psicologo/ovas/reglas/{reglaId}:
 *   patch:
 *     summary: Actualizar una regla de asignación
 *     tags: [OVAs - Portal Psicólogo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reglaId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Regla actualizada
 */
router.patch('/reglas/:reglaId', authenticate, isPsicologo, OvaPsicologoController.actualizarRegla);

/**
 * @swagger
 * /api/psicologo/ovas/reglas/{reglaId}:
 *   delete:
 *     summary: Eliminar una regla de asignación
 *     tags: [OVAs - Portal Psicólogo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reglaId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Regla eliminada
 */
router.delete('/reglas/:reglaId', authenticate, isPsicologo, OvaPsicologoController.eliminarRegla);

/**
 * @swagger
 * /api/psicologo/ovas/{id}/efectividad:
 *   get:
 *     summary: Reporte de efectividad específico para un OVA
 *     tags: [OVAs - Portal Psicólogo]
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
 *         description: Reporte estadístico del OVA
 */
router.get('/:id/efectividad', authenticate, isPsicologo, OvaPsicologoController.reporteEfectividadPorOva);

// ==========================================
// 3. Lectura clínica por paciente
// ==========================================

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/ovas:
 *   get:
 *     summary: Historial de OVAs asignados automáticamente a un paciente
 *     description: Requiere asignación aprobada activa entre el psicólogo y el estudiante.
 *     tags: [OVAs - Portal Psicólogo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Historial de asignaciones de OVAs del paciente
 *       403:
 *         description: No autorizado o sin asignación activa
 */
router.get(
  '/pacientes/:estudianteId/ovas',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  OvaPsicologoController.listarAsignacionesPaciente
);

export default router;
