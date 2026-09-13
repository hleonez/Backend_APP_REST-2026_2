import { Router } from 'express';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import { listRegistros, getRegistroById, createRegistro, updateRegistroPut, updateRegistroPatch, deleteRegistro } from '../controllers/registro-actividades.controller';
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