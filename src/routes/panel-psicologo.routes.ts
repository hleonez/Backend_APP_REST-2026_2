import { Router } from 'express';
import { authenticate, isPsicologo } from '../middleware/auth.middleware';
import { esPsicologoDeEstudiante } from '../middleware/authorization.middleware';
import {
  getPerfilEstudiante,
  getResumenEstudiante,
  getEvaluacionesEstudiante,
  getActividadesEstudiante,
  getEstadisticasRegistroEmocional,
  abrirChat,
  getRegistroEmocionalEstudiante,
  getEncuestasEstudiante,
  getChatsEstudiante,
  asignarActividadEstudiante,
  actualizarActividadEstudiante,
  eliminarActividadEstudiante,
  getSugerenciasActividades,
} from '../controllers/panel-psicologo.controller';

const router = Router();

// Cadena de seguridad compartida por todas las rutas del panel:
//   1. authenticate          — JWT valido y usuario activo
//   2. isPsicologo           — rol == 'psicologo'
//   3. esPsicologoDeEstudiante — asignacion aprobada activa con ese estudiante

/**
 * @swagger
 * tags:
 *   name: PanelPsicologo
 *   description: >
 *     Panel de seguimiento del psicologo sobre sus pacientes. Todas las rutas exigen
 *     autenticacion, rol "psicologo", y una asignacion en estado "aprobado" (no eliminada)
 *     con el estudiante solicitado. Si no existe esa asignacion, responde 403 Forbidden.
 */

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/perfil:
 *   get:
 *     summary: Datos generales del estudiante asignado
 *     description: No incluye correo, contrasena ni telefono.
 *     tags: [PanelPsicologo]
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
 *         description: Perfil del estudiante
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/perfil',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getPerfilEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/resumen:
 *   get:
 *     summary: Ficha consolidada del estudiante
 *     description: Perfil + ultima evaluacion (semaforo/dimensiones) + actividades vigentes.
 *     tags: [PanelPsicologo]
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
 *         description: Ficha consolidada del estudiante
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/resumen',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getResumenEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/evaluaciones:
 *   get:
 *     summary: Historial de evaluaciones del estudiante
 *     description: Semaforos y puntajes historicos, con dimensiones.
 *     tags: [PanelPsicologo]
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
 *         description: Historial de evaluaciones
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/evaluaciones',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getEvaluacionesEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/actividades:
 *   get:
 *     summary: Historial y listado de actividades del estudiante (vigentes y vencidas)
 *     description: >
 *       Retorna todas las actividades registradas o asignadas al estudiante, incluyendo su
 *       estado actual, prioridad, vencimiento, observaciones del psicólogo y reflexiones del estudiante.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         description: ID numérico del estudiante asignado
 *         schema:
 *           type: integer
 *           example: 12
 *     responses:
 *       200:
 *         description: Historial de actividades obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Historial de actividades obtenido
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 45
 *                       fecha:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-10-06T12:00:00.000Z"
 *                       vencimiento:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-10-13T23:59:59.000Z"
 *                       vencida:
 *                         type: boolean
 *                         description: Indica si la fecha de vencimiento ya pasó y no se completó
 *                         example: false
 *                       observaciones:
 *                         type: string
 *                         nullable: true
 *                         example: "Realizar antes de dormir para bajar la rumiación cognitiva."
 *                       asignado_por_id:
 *                         type: integer
 *                         nullable: true
 *                         example: 3
 *                       asignado_por_nombre:
 *                         type: string
 *                         nullable: true
 *                         example: "Lic. Andrea Morales"
 *                       titulo_personalizado:
 *                         type: string
 *                         nullable: true
 *                         example: "Respiración 4-7-8 Guiada"
 *                       descripcion_personalizada:
 *                         type: string
 *                         nullable: true
 *                         example: "Inhala en 4s, sostén 7s y exhala en 8s por 4 ciclos continuos."
 *                       dimension_objetivo:
 *                         type: string
 *                         nullable: true
 *                         example: "Ansiedad"
 *                       prioridad:
 *                         type: string
 *                         enum: [baja, media, alta]
 *                         example: "alta"
 *                       estado:
 *                         type: string
 *                         enum: [pendiente, completada, cancelada]
 *                         example: "pendiente"
 *                       fecha_completada:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: null
 *                       reflexiones_estudiante:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       opcion:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 2
 *                           nombre:
 *                             type: string
 *                             example: "Meditación Mindfulness"
 *                           url_imagen:
 *                             type: string
 *                             example: "https://ejemplo.com/meditacion.png"
 *                           descripcion:
 *                             type: string
 *                             nullable: true
 *                             example: "Técnica de atención plena"
 *       400:
 *         description: ID de estudiante inválido
 *       403:
 *         description: El psicólogo no tiene una asignación aprobada con este estudiante
 *       404:
 *         description: Estudiante no encontrado
 */
router.get(
  '/pacientes/:estudianteId/actividades',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getActividadesEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/actividades:
 *   post:
 *     summary: Asignar o personalizar una actividad clínica para el estudiante
 *     description: >
 *       Permite al psicólogo asignar una tarea terapéutica al paciente. Puede vincularse a una actividad
 *       predefinida del catálogo mediante `opcion_id` y/o contener título e instrucciones 100% personalizadas.
 *       Se puede asociar a una dimensión clínica ('Ansiedad', 'Estrés Académico', etc.) y definir prioridad y fecha de vencimiento.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         description: ID del estudiante al que se asignará la actividad
 *         schema:
 *           type: integer
 *           example: 12
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               opcion_id:
 *                 type: integer
 *                 nullable: true
 *                 description: ID de la opción del catálogo predefinido (opcional si se especifica titulo_personalizado)
 *                 example: 2
 *               titulo_personalizado:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 description: Nombre o título de la actividad clínica personalizada
 *                 example: "Técnica de Respiración 4-7-8 y Desconexión"
 *               descripcion_personalizada:
 *                 type: string
 *                 nullable: true
 *                 description: Instrucciones paso a paso redactadas por el psicólogo para el paciente
 *                 example: "Antes de acostarte, siéntate erguido, inhala 4 seg, sostén 7 seg y suelta en 8 seg durante 5 minutos."
 *               dimension_objetivo:
 *                 type: string
 *                 maxLength: 80
 *                 nullable: true
 *                 description: Dimensión del semáforo a la que apunta la intervención
 *                 example: "Ansiedad"
 *               prioridad:
 *                 type: string
 *                 enum: [baja, media, alta]
 *                 default: media
 *                 description: Nivel de urgencia o prioridad de la actividad
 *                 example: "alta"
 *               vencimiento:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha límite para que el estudiante realice la actividad (por defecto 7 días si se omite)
 *                 example: "2026-10-15T23:59:59.000Z"
 *               observaciones:
 *                 type: string
 *                 nullable: true
 *                 description: Notas o recomendaciones adicionales del psicólogo
 *                 example: "Registrar en el diario cómo se sintió la frecuencia cardíaca después de la técnica."
 *     responses:
 *       201:
 *         description: Actividad clínica asignada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Actividad asignada exitosamente al estudiante"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 46
 *                     fecha:
 *                       type: string
 *                       format: date-time
 *                     vencimiento:
 *                       type: string
 *                       format: date-time
 *                     vencida:
 *                       type: boolean
 *                       example: false
 *                     observaciones:
 *                       type: string
 *                       example: "Registrar en el diario cómo se sintió la frecuencia cardíaca después de la técnica."
 *                     asignado_por_id:
 *                       type: integer
 *                       example: 3
 *                     asignado_por_nombre:
 *                       type: string
 *                       example: "Lic. Andrea Morales"
 *                     titulo_personalizado:
 *                       type: string
 *                       example: "Técnica de Respiración 4-7-8 y Desconexión"
 *                     descripcion_personalizada:
 *                       type: string
 *                       example: "Antes de acostarte, siéntate erguido, inhala 4 seg..."
 *                     dimension_objetivo:
 *                       type: string
 *                       example: "Ansiedad"
 *                     prioridad:
 *                       type: string
 *                       example: "alta"
 *                     estado:
 *                       type: string
 *                       example: "pendiente"
 *                     fecha_completada:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     reflexiones_estudiante:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     opcion:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 2
 *                         nombre:
 *                           type: string
 *                           example: "Meditación Mindfulness"
 *                         url_imagen:
 *                           type: string
 *                           example: "https://ejemplo.com/meditacion.png"
 *                         descripcion:
 *                           type: string
 *                           example: "Técnica de atención plena"
 *       400:
 *         description: Datos inválidos (e.g. no se envió ni opcion_id ni titulo_personalizado)
 *       403:
 *         description: No autorizado o no es psicólogo asignado al paciente
 *       404:
 *         description: Estudiante o catálogo opcion_id no encontrado
 */
router.post(
  '/pacientes/:estudianteId/actividades',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  asignarActividadEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/actividades/{actividadId}:
 *   put:
 *     summary: Actualizar o modificar una actividad asignada
 *     description: >
 *       Permite al psicólogo modificar las instrucciones, fechas de vencimiento, prioridad, notas o estado de una actividad asignada.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 12
 *       - in: path
 *         name: actividadId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 46
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               opcion_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 2
 *               titulo_personalizado:
 *                 type: string
 *                 example: "Respiración 4-7-8 Actualizada"
 *               descripcion_personalizada:
 *                 type: string
 *                 example: "Aumentar a 8 ciclos en total."
 *               dimension_objetivo:
 *                 type: string
 *                 example: "Ansiedad"
 *               prioridad:
 *                 type: string
 *                 enum: [baja, media, alta]
 *                 example: "media"
 *               vencimiento:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-10-20T23:59:59.000Z"
 *               observaciones:
 *                 type: string
 *                 example: "Se ajustó la meta según sesión de chat."
 *               estado:
 *                 type: string
 *                 enum: [pendiente, completada, cancelada]
 *                 example: "pendiente"
 *     responses:
 *       200:
 *         description: Actividad actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Actividad actualizada exitosamente"
 *                 data:
 *                   type: object
 *                   description: Objeto de la actividad modificada con formato completo ActividadHistorial
 *       400:
 *         description: Parámetros o cuerpo de la petición inválidos
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Actividad o estudiante no encontrado
 */
router.put(
  '/pacientes/:estudianteId/actividades/:actividadId',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  actualizarActividadEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/actividades/{actividadId}:
 *   delete:
 *     summary: Eliminar (baja lógica) una actividad asignada
 *     description: Realiza un soft delete de la actividad clínica asignada al estudiante.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 12
 *       - in: path
 *         name: actividadId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 46
 *     responses:
 *       200:
 *         description: Actividad eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Actividad eliminada exitosamente"
 *                 data:
 *                   type: null
 *                   example: null
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Actividad no encontrada
 */
router.delete(
  '/pacientes/:estudianteId/actividades/:actividadId',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  eliminarActividadEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/actividades/sugerencias:
 *   get:
 *     summary: Sugerencias clínicas inteligentes de actividades terapéuticas según dimensiones críticas
 *     description: >
 *       Analiza la última evaluación y semáforo del paciente, identifica las dimensiones en estado crítico
 *       ('rojo' o 'amarillo') y genera sugerencias terapéuticas accionables con recomendaciones de catálogo
 *       y prioridad calculada. Ideal para que el frontend del psicólogo muestre tarjetas de recomendación rápida
 *       y permita precargar el formulario de asignación con un solo clic.
 *     tags: [PanelPsicologo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estudianteId
 *         required: true
 *         description: ID numérico del estudiante asignado
 *         schema:
 *           type: integer
 *           example: 12
 *     responses:
 *       200:
 *         description: Sugerencias clínicas y catálogo disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Sugerencias de actividades obtenidas"
 *                 data:
 *                   type: object
 *                   properties:
 *                     estudianteId:
 *                       type: integer
 *                       example: 12
 *                     ultima_evaluacion:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 101
 *                         fecha:
 *                           type: string
 *                           format: date-time
 *                         estado_semaforo:
 *                           type: string
 *                           enum: [verde, amarillo, rojo]
 *                           example: "rojo"
 *                         puntaje_total:
 *                           type: number
 *                           example: 78
 *                         subcategoria_principal:
 *                           type: string
 *                           nullable: true
 *                           example: "Ansiedad elevada"
 *                         dimensiones:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               dimension:
 *                                 type: string
 *                                 example: "Ansiedad"
 *                               puntaje:
 *                                 type: number
 *                                 example: 85
 *                               nivel:
 *                                 type: string
 *                                 enum: [verde, amarillo, rojo]
 *                                 example: "rojo"
 *                     dimensionesCriticas:
 *                       type: array
 *                       description: Lista de dimensiones que requieren atención ('rojo' o 'amarillo')
 *                       items:
 *                         type: object
 *                         properties:
 *                           dimension:
 *                             type: string
 *                             example: "Ansiedad"
 *                           puntaje:
 *                             type: number
 *                             example: 85
 *                           nivel:
 *                             type: string
 *                             example: "rojo"
 *                     sugerencias:
 *                       type: object
 *                       description: Mapa de sugerencias indexado por nombre de dimensión clínica
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           sugerencia:
 *                             type: string
 *                             example: "Se recomiendan ejercicios de respiración 4-7-8, relajación progresiva y pausas de grounding sensorial."
 *                           prioridadRecomendada:
 *                             type: string
 *                             enum: [alta, media]
 *                             example: "alta"
 *                           actividadesRecomendadas:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                   example: 1
 *                                 nombre:
 *                                   type: string
 *                                   example: "Respiración 4-7-8"
 *                                 descripcion:
 *                                   type: string
 *                                   example: "Técnica de respiración diafragmática para modular el sistema nervioso autónomo."
 *                                 url_imagen:
 *                                   type: string
 *                                   example: "https://ejemplo.com/respiracion.png"
 *                     catalogoCompleto:
 *                       type: array
 *                       description: Todas las actividades predefinidas disponibles en la plataforma para selección libre
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           nombre:
 *                             type: string
 *                             example: "Respiración Diafragmática"
 *                           descripcion:
 *                             type: string
 *                             example: "Inhalación profunda inflando el abdomen"
 *                           url_imagen:
 *                             type: string
 *                             example: "https://ejemplo.com/icono.png"
 *       400:
 *         description: ID de estudiante inválido
 *       403:
 *         description: El psicólogo no tiene una asignación aprobada con este estudiante
 *       404:
 *         description: Estudiante no encontrado
 */
router.get(
  '/pacientes/:estudianteId/actividades/sugerencias',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getSugerenciasActividades
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/registro-emocional/estadisticas:
 *   get:
 *     summary: Estadisticas de registro emocional del estudiante
 *     description: Promedio, minimo, maximo y frecuencias del registro emocional.
 *     tags: [PanelPsicologo]
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
 *         description: Estadisticas de registro emocional
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/registro-emocional/estadisticas',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getEstadisticasRegistroEmocional
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/chat:
 *   post:
 *     summary: Abrir o reanudar chat con el estudiante
 *     tags: [PanelPsicologo]
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
 *         description: Chat abierto o reanudado
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.post(
  '/pacientes/:estudianteId/chat',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  abrirChat
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/registro-emocional:
 *   get:
 *     summary: Historial de registro emocional del estudiante
 *     description: Ordenado cronologicamente.
 *     tags: [PanelPsicologo]
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
 *         description: Historial de registro emocional
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/registro-emocional',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getRegistroEmocionalEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/encuestas:
 *   get:
 *     summary: Respuestas a encuestas institucionales del estudiante
 *     tags: [PanelPsicologo]
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
 *         description: Respuestas a encuestas
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/encuestas',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getEncuestasEstudiante
);

/**
 * @swagger
 * /api/psicologo/pacientes/{estudianteId}/chats:
 *   get:
 *     summary: Historial de conversaciones con el estudiante
 *     description: Solo las conversaciones del psicologo autenticado.
 *     tags: [PanelPsicologo]
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
 *         description: Historial de conversaciones
 *       403:
 *         description: El psicologo no tiene una asignacion aprobada con este estudiante
 */
router.get(
  '/pacientes/:estudianteId/chats',
  authenticate,
  isPsicologo,
  esPsicologoDeEstudiante,
  getChatsEstudiante
);

export default router;