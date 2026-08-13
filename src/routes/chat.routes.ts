import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { 
  listChats, 
  getChatById, 
  createChat, 
  updateChatPut, 
  updateChatPatch, 
  deleteChat, 
  chatConIA, 
  getHistorialChatIA,
  detenerChatIA,
  chatConIAAvanzado,
  obtenerActividadesRecomendadas,
  obtenerEstadoPsicologicoUsuario
} from '../controllers/chat.controller';
import { createMensaje, deleteMensaje, getMensajeById, listMensajes, updateMensajePatch, updateMensajePut } from '../controllers/chat-mensajes.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Chats & IA
 *   description: Endpoints para interacción con el Chatbot IA y salas de chat
 */

/**
 * @swagger
 * /api/chats/ia:
 *   post:
 *     summary: Enviar un mensaje al Chatbot IA
 *     tags: [Chats & IA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mensaje
 *             properties:
 *               mensaje:
 *                 type: string
 *                 example: ¿Cómo puedo manejar la ansiedad antes de un examen?
 *     responses:
 *       200:
 *         description: Respuesta generada por la IA
 */
router.post('/ia', authenticate, chatConIA);

/**
 * @swagger
 * /api/chats/ia/historial:
 *   get:
 *     summary: Obtener el historial de chat con la IA
 *     tags: [Chats & IA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de mensajes anteriores con la IA
 */
router.get('/ia/historial', authenticate, getHistorialChatIA);

router.post('/ia/detener', authenticate, detenerChatIA);

/**
 * @swagger
 * /api/chats/ia/avanzado:
 *   post:
 *     summary: Consulta avanzada a la IA con contexto de registro emocional
 *     tags: [Chats & IA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mensaje:
 *                 type: string
 *                 example: Analiza mi estado emocional y dame recomendaciones
 *               contexto:
 *                 type: string
 *                 example: registro_emocional
 *     responses:
 *       200:
 *         description: Análisis contextualizado e inteligencias de bienestar
 */
router.post('/ia/avanzado', authenticate, chatConIAAvanzado);

router.get('/actividades/recomendadas', authenticate, obtenerActividadesRecomendadas);
router.get('/estado-psicologico', authenticate, obtenerEstadoPsicologicoUsuario);

// CRUD de Chats (después de rutas /ia)
router.get('/', authenticate, listChats)
router.post('/', authenticate, createChat)
router.get('/:chatId', authenticate, getChatById)
router.put('/:chatId', authenticate, updateChatPut)
router.patch('/:chatId', authenticate, updateChatPatch)
router.delete('/:chatId', authenticate, deleteChat)

// Subrutas de Mensajes
router.get('/:chatId/mensajes', authenticate, listMensajes)
router.get('/:chatId/mensajes/:mensajeId', authenticate, getMensajeById)
router.post('/:chatId/mensajes', authenticate, createMensaje)
router.put('/:chatId/mensajes/:mensajeId', authenticate, updateMensajePut)
router.patch('/:chatId/mensajes/:mensajeId', authenticate, updateMensajePatch)
router.delete('/:chatId/mensajes/:mensajeId', authenticate, deleteMensaje)

export default router;