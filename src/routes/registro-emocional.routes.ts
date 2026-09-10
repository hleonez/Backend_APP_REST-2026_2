import { Router } from 'express';
import { authenticate, isUsuario } from '../middleware/auth.middleware';
import {
  validateGetRespuestasUsuarioPorFecha,
  validateSaveRespuestasRegistroEmocional,
} from '../middleware/registro-emocional.middleware';
import {
  getPreguntasRegistroEmocional,
  getRespuestasUsuarioPorFecha,
  saveRespuestasRegistroEmocional,
} from '../controllers/registro-emocional.controller';
import {
  getCalendarioEmocional,
  getRachas,
  getEstadisticas,
  getResumenDia,
  getPantallaPersonal,
  activarRachaDiaria,
} from '../controllers/estadisticas-registro-emocional.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Registro Emocional
 *   description: Registro emocional diario, encuesta adaptativa y estadísticas
 */

// Rutas básicas

/**
 * @swagger
 * /api/registro-emocional/preguntas:
 *   get:
 *     summary: Obtener las preguntas adaptativas del registro emocional (encuesta adaptativa)
 *     tags: [Registro Emocional]
 *     security:
 *       - bearerAuth: []
 *     description: Devuelve 5 preguntas seleccionadas según la dimensión dominante del usuario (o balanceadas si no hay historial). Cada pregunta incluye `id`, `texto`, `categoria`, `is_active`, `created_at`, `updated_at` y `opciones` (`id`, `nombre`, `descripcion`, `url_imagen`, `puntaje`, `is_active`).
 *     responses:
 *       200:
 *         description: Preguntas adaptativas obtenidas. Respuesta envuelta en `APISuccessResponse` (`success`, `message`, `data`, `errors`).
 *       500:
 *         description: Error interno del servidor
 */
router.get('/preguntas', authenticate, getPreguntasRegistroEmocional);

/**
 * @swagger
 * /api/registro-emocional/usuarios/{usuarioId}/fecha/{fecha}:
 *   get:
 *     summary: Obtener las respuestas de registro emocional de un usuario en una fecha
 *     tags: [Registro Emocional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario (debe coincidir con el usuario autenticado)
 *       - in: path
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{2}-\d{2}-\d{4}$'
 *         description: Fecha en formato DD-MM-YYYY
 *     responses:
 *       200:
 *         description: Respuestas del día. `data` contiene `usuario_id`, `fecha`, `fecha_iso`, `registro_del_dia` y `respuestas` (cada una con `pregunta` y `opcion`).
 *       400:
 *         description: Parámetros inválidos o formato de fecha inválido
 *       401:
 *         description: Usuario no autenticado
 *       403:
 *         description: No puedes consultar los registros de otro usuario
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  '/usuarios/:usuarioId/fecha/:fecha',
  authenticate,
  isUsuario,
  validateGetRespuestasUsuarioPorFecha,
  getRespuestasUsuarioPorFecha,
);

/**
 * @swagger
 * /api/registro-emocional:
 *   post:
 *     summary: Guardar las respuestas del registro emocional del día
 *     tags: [Registro Emocional]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - usuario_id
 *               - respuestas
 *             properties:
 *               usuario_id:
 *                 type: integer
 *                 description: ID del usuario autenticado
 *                 example: 1
 *               respuestas:
 *                 type: array
 *                 minItems: 1
 *                 description: Al menos una respuesta y sin preguntas repetidas
 *                 items:
 *                   type: object
 *                   required:
 *                     - pregunta_id
 *                     - opcion_id
 *                   properties:
 *                     pregunta_id:
 *                       type: integer
 *                       example: 1
 *                     opcion_id:
 *                       type: integer
 *                       description: Debe pertenecer a la pregunta indicada
 *                       example: 3
 *     responses:
 *       201:
 *         description: Respuestas guardadas. `data` contiene `usuario_id`, `fecha_dia`, `registro_del_dia`, `total_puntaje`, `respuestas_guardadas` y `respuestas`.
 *       400:
 *         description: Body inválido (usuario_id o respuestas con formato incorrecto)
 *       401:
 *         description: Usuario no autenticado
 *       403:
 *         description: No puedes guardar registros para otro usuario
 *       409:
 *         description: Ya completaste el test emocional de hoy
 *       500:
 *         description: Error interno del servidor
 */
router.post('/', authenticate, isUsuario, validateSaveRespuestasRegistroEmocional, saveRespuestasRegistroEmocional);

// Rutas de estadísticas y análisis (deben ir antes de las rutas con parámetros generales)

/**
 * @swagger
 * /api/registro-emocional/calendario:
 *   get:
 *     summary: Obtener el calendario emocional del usuario (rango de fechas)
 *     tags: [Registro Emocional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: inicio
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Fecha inicial en formato YYYY-MM-DD (default 2024-01-01)
 *       - in: query
 *         name: fin
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Fecha final en formato YYYY-MM-DD (default 2026-12-31)
 *     responses:
 *       200:
 *         description: Calendario emocional obtenido
 *       400:
 *         description: Formato de fecha inválido (se espera YYYY-MM-DD)
 *       401:
 *         description: Usuario no autenticado
 *       500:
 *         description: Error al obtener calendario
 */
router.get('/calendario', authenticate, isUsuario, getCalendarioEmocional);

/**
 * @swagger
 * /api/registro-emocional/rachas:
 *   get:
 *     summary: Obtener la información de rachas (consistencia) del usuario
 *     tags: [Registro Emocional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Información de rachas obtenida
 *       401:
 *         description: Usuario no autenticado
 *       500:
 *         description: Error al obtener rachas
 */
router.get('/rachas', authenticate, isUsuario, getRachas);

/**
 * @swagger
 * /api/registro-emocional/estadisticas:
 *   get:
 *     summary: Obtener las estadísticas detalladas del registro emocional
 *     tags: [Registro Emocional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dias_atras
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Días hacia atrás a considerar (default 30)
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas
 *       400:
 *         description: dias_atras debe ser un número positivo
 *       401:
 *         description: Usuario no autenticado
 *       500:
 *         description: Error al obtener estadísticas
 */
router.get('/estadisticas', authenticate, isUsuario, getEstadisticas);

/**
 * @swagger
 * /api/registro-emocional/pantalla-personal:
 *   get:
 *     summary: Obtener los datos de la pantalla personal del usuario
 *     tags: [Registro Emocional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pantalla personal obtenida
 *       401:
 *         description: Usuario no autenticado
 *       500:
 *         description: Error al obtener datos de pantalla personal
 */
router.get('/pantalla-personal', authenticate, isUsuario, getPantallaPersonal);

/**
 * @swagger
 * /api/registro-emocional/pantalla-personal/activar-racha:
 *   post:
 *     summary: Activar la racha diaria del usuario
 *     tags: [Registro Emocional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Racha diaria activada (`data` incluye `mensaje`)
 *       401:
 *         description: Usuario no autenticado
 *       409:
 *         description: No se puede activar la racha en este momento
 *       500:
 *         description: Error al activar racha diaria
 */
router.post('/pantalla-personal/activar-racha', authenticate, isUsuario, activarRachaDiaria);

/**
 * @swagger
 * /api/registro-emocional/resumen-dia/{fecha}:
 *   get:
 *     summary: Obtener el resumen emocional de un día específico
 *     tags: [Registro Emocional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Fecha en formato YYYY-MM-DD
 *     responses:
 *       200:
 *         description: Resumen del día obtenido
 *       400:
 *         description: Fecha requerida o formato de fecha inválido (se espera YYYY-MM-DD)
 *       401:
 *         description: Usuario no autenticado
 *       500:
 *         description: Error al obtener resumen del día
 */
router.get('/resumen-dia/:fecha', authenticate, isUsuario, getResumenDia);

export default router;
