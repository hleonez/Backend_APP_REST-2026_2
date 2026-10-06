import { Router } from 'express';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import {
  listRegistros,
  getRegistroById,
  createRegistro,
  updateRegistroPut,
  updateRegistroPatch,
  deleteRegistro,
  completarActividad,
  listarActividadesAsignadasPsicologo,
} from '../controllers/registro-actividades.controller';
import { asignarActividadDiaria, getActividadesDiarias } from '../controllers/actividades-diarias.controller';
import { listarTecnicasRelajacion, registrarPracticaTecnica } from '../controllers/tecnicas-relajacion.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: RegistroActividades
 *   description: Registro de actividades del estudiante, actividades diarias y tecnicas de relajacion
 */

/**
 * @swagger
 * /api/registro-actividades:
 *   get:
 *     summary: Listar registros de actividades del usuario autenticado
 *     tags: [RegistroActividades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de registros
 *       403:
 *         description: Requiere rol usuario
 */
router.get('/', authenticate, isUsuario, listRegistros);

/**
 * @swagger
 * /api/registro-actividades/asignadas-psicologo:
 *   get:
 *     summary: Listar actividades terapéuticas personalizadas asignadas por el psicólogo al estudiante autenticado
 *     description: >
 *       Retorna la lista de tareas y actividades asignadas directamente por el psicólogo tratante al estudiante actual.
 *       Incluye título personalizado, instrucciones paso a paso (`descripcion_personalizada`), dimensión objetivo,
 *       prioridad (`baja`, `media`, `alta`), fecha límite de vencimiento, estado actual (`pendiente`, `completada`, `cancelada`),
 *       y reflexiones enviadas por el estudiante.
 *     tags: [RegistroActividades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de actividades asignadas por el psicólogo
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 46
 *                   fecha:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-10-06T12:00:00.000Z"
 *                   vencimiento:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-10-15T23:59:59.000Z"
 *                   observaciones:
 *                     type: string
 *                     nullable: true
 *                     example: "Registrar en el diario cómo se sintió la frecuencia cardíaca después de la técnica."
 *                   asignado_por_id:
 *                     type: integer
 *                     example: 3
 *                   titulo_personalizado:
 *                     type: string
 *                     nullable: true
 *                     example: "Técnica de Respiración 4-7-8 y Desconexión"
 *                   descripcion_personalizada:
 *                     type: string
 *                     nullable: true
 *                     example: "Antes de acostarte, siéntate erguido, inhala 4 seg, sostén 7 seg y suelta en 8 seg durante 5 minutos."
 *                   dimension_objetivo:
 *                     type: string
 *                     nullable: true
 *                     example: "Ansiedad"
 *                   prioridad:
 *                     type: string
 *                     enum: [baja, media, alta]
 *                     example: "alta"
 *                   estado:
 *                     type: string
 *                     enum: [pendiente, completada, cancelada]
 *                     example: "pendiente"
 *                   fecha_completada:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                     example: null
 *                   reflexiones_estudiante:
 *                     type: string
 *                     nullable: true
 *                     example: null
 *                   opcion:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 2
 *                       nombre:
 *                         type: string
 *                         example: "Meditación Mindfulness"
 *                       descripcion:
 *                         type: string
 *                         example: "Técnica de atención plena"
 *                       url_imagen:
 *                         type: string
 *                         example: "https://ejemplo.com/meditacion.png"
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Requiere rol usuario (estudiante)
 */
router.get('/asignadas-psicologo', authenticate, isUsuario, listarActividadesAsignadasPsicologo);

/**
 * @swagger
 * /api/registro-actividades/diarias:
 *   get:
 *     summary: Obtener las actividades diarias asignadas al usuario
 *     tags: [RegistroActividades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Actividades diarias
 *       403:
 *         description: Requiere rol usuario
 */
router.get('/diarias', authenticate, isUsuario, getActividadesDiarias);

/**
 * @swagger
 * /api/registro-actividades/diarias/asignar:
 *   post:
 *     summary: Asignar una actividad diaria al usuario autenticado
 *     tags: [RegistroActividades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Actividad diaria asignada
 *       403:
 *         description: Requiere rol usuario
 */
router.post('/diarias/asignar', authenticate, isUsuario, asignarActividadDiaria);

/**
 * @swagger
 * /api/registro-actividades/{id}/completar:
 *   post:
 *     summary: Marcar una actividad asignada como completada con reflexiones del estudiante
 *     description: >
 *       Permite al estudiante dar por concluida una actividad terapéutica asignada por su psicólogo,
 *       adjuntando opcionalmente sus reflexiones subjetivas (`reflexiones_estudiante`) sobre la experiencia o dificultad.
 *     tags: [RegistroActividades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID numérico del registro de actividad asignada
 *         schema:
 *           type: integer
 *           example: 46
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reflexiones_estudiante:
 *                 type: string
 *                 description: Comentarios, sensaciones o reflexiones del estudiante al realizar la actividad
 *                 example: "Me ayudó a calmar la mente antes del examen y pude dormir mucho más rápido."
 *     responses:
 *       200:
 *         description: Actividad completada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Actividad completada exitosamente"
 *                 actividad:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 46
 *                     usuario_id:
 *                       type: integer
 *                       example: 12
 *                     estado:
 *                       type: string
 *                       example: "completada"
 *                     fecha_completada:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-10-06T14:30:00.000Z"
 *                     reflexiones_estudiante:
 *                       type: string
 *                       example: "Me ayudó a calmar la mente antes del examen y pude dormir mucho más rápido."
 *       400:
 *         description: ID o datos inválidos
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Actividad no encontrada para este usuario
 */
router.post('/:id/completar', authenticate, isUsuario, completarActividad);

/**
 * @swagger
 * /api/registro-actividades/tecnicas-relajacion:
 *   get:
 *     summary: Listar tecnicas de relajacion disponibles
 *     tags: [RegistroActividades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tecnicas de relajacion
 *       403:
 *         description: Requiere rol usuario
 */
router.get('/tecnicas-relajacion', authenticate, isUsuario, listarTecnicasRelajacion);

/**
 * @swagger
 * /api/registro-actividades/tecnicas-relajacion/practicar:
 *   post:
 *     summary: Registrar la practica de una tecnica de relajacion
 *     tags: [RegistroActividades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Practica registrada
 *       403:
 *         description: Requiere rol usuario
 */
router.post('/tecnicas-relajacion/practicar', authenticate, isUsuario, registrarPracticaTecnica);

/**
 * @swagger
 * /api/registro-actividades/{id}:
 *   get:
 *     summary: Obtener un registro de actividad por id
 *     tags: [RegistroActividades]
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
 *         description: Registro encontrado
 *       404:
 *         description: Registro no encontrado
 */
router.get('/:id', authenticate, isUsuario, getRegistroById);

/**
 * @swagger
 * /api/registro-actividades:
 *   post:
 *     summary: Crear un nuevo registro de actividad
 *     tags: [RegistroActividades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Registro creado
 *       403:
 *         description: Requiere rol usuario
 */
router.post('/', authenticate, isUsuario, createRegistro);

/**
 * @swagger
 * /api/registro-actividades/{id}:
 *   put:
 *     summary: Reemplazar un registro de actividad
 *     tags: [RegistroActividades]
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
 *         description: Registro actualizado
 *       404:
 *         description: Registro no encontrado
 */
router.put('/:id', authenticate, isUsuario, updateRegistroPut);

/**
 * @swagger
 * /api/registro-actividades/{id}:
 *   patch:
 *     summary: Actualizar parcialmente un registro de actividad
 *     tags: [RegistroActividades]
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
 *         description: Registro actualizado
 *       404:
 *         description: Registro no encontrado
 */
router.patch('/:id', authenticate, isUsuario, updateRegistroPatch);

/**
 * @swagger
 * /api/registro-actividades/{id}:
 *   delete:
 *     summary: Eliminar (baja logica) un registro de actividad
 *     tags: [RegistroActividades]
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
 *         description: Registro eliminado
 *       404:
 *         description: Registro no encontrado
 */
router.delete('/:id', authenticate, isUsuario, deleteRegistro);

export default router;