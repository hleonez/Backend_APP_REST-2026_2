import { Server, Socket } from 'socket.io';
import { db } from '../db';
import * as schema from '../db/schema';
import { and, eq, isNull, or } from 'drizzle-orm';
import { verifyToken, JwtPayload } from '../config/jwt';

interface ChatMessage {
  chatId: number;
  mensaje: string;
}

interface TypingEvent {
  chatId: number;
  isTyping: boolean;
}

const getTokenFromSocket = (socket: Socket): string | null => {
  const authToken = socket.handshake.auth?.token;
  const authorization = socket.handshake.headers.authorization;
  const rawToken = typeof authToken === 'string' ? authToken : authorization;

  if (!rawToken) return null;

  const [scheme, token] = rawToken.trim().split(/\s+/);
  if (scheme?.toLowerCase() === 'bearer') return token || null;
  return typeof authToken === 'string' ? authToken : null;
};

export const setupWebSocket = (io: Server): void => {
  io.use(async (socket, next) => {
    const token = getTokenFromSocket(socket);
    const user = token ? verifyToken(token) : null;

    if (!user) {
      next(new Error('Unauthorized'));
      return;
    }

    try {
      const [activeUser] = await db
        .select({ id: schema.usuarios.id })
        .from(schema.usuarios)
        .where(and(
          eq(schema.usuarios.id, user.id),
          isNull(schema.usuarios.deleted_at),
          eq(schema.usuarios.is_active, true),
        ))
        .limit(1);

      if (!activeUser) {
        next(new Error('Unauthorized'));
        return;
      }

      socket.data.user = user;
      next();
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      next(new Error('Unauthorized'));
    }
  });

  const onlineUsers = new Map<number, Socket>();

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload;
    onlineUsers.set(user.id, socket);
    socket.emit('authenticated', { success: true, userId: user.id });

    void getChatsForUser(user.id).then((chats) => {
      chats.forEach((chatId) => socket.join(`chat:${chatId}`));
    });

    socket.on('chat_message', async (messageData: ChatMessage) => {
      try {
        const chatId = Number(messageData.chatId);
        if (!Number.isInteger(chatId) || typeof messageData.mensaje !== 'string' || !messageData.mensaje.trim()) {
          socket.emit('error', { message: 'Invalid message' });
          return;
        }

        const canAccessChat = await userCanAccessChat(user.id, chatId);
        if (!canAccessChat) {
          socket.emit('error', { message: 'Access forbidden' });
          return;
        }

        const [newMessage] = await db.insert(schema.mensajes_chat)
          .values({ chat_id: chatId, usuario_id: user.id, mensaje: messageData.mensaje })
          .returning();

        io.to(`chat:${chatId}`).emit('new_message', {
          id: newMessage.id,
          chatId,
          userId: user.id,
          mensaje: newMessage.mensaje,
          enviado_en: newMessage.enviado_en,
        });
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('join_chat', async (chatId: number) => {
      if (!Number.isInteger(chatId) || !(await userCanAccessChat(user.id, chatId))) {
        socket.emit('error', { message: 'Access forbidden' });
        return;
      }

      socket.join(`chat:${chatId}`);
      socket.emit('joined_chat', { chatId });
    });

    socket.on('typing', async (data: TypingEvent) => {
      if (!Number.isInteger(data.chatId) || !(await userCanAccessChat(user.id, data.chatId))) {
        return;
      }

      socket.to(`chat:${data.chatId}`).emit('user_typing', {
        chatId: data.chatId,
        userId: user.id,
        isTyping: data.isTyping,
      });
    });

    socket.on('disconnect', () => {
      if (onlineUsers.get(user.id)?.id === socket.id) {
        onlineUsers.delete(user.id);
      }
    });
  });
};

async function userCanAccessChat(userId: number, chatId: number): Promise<boolean> {
  const [chat] = await db
    .select({ id: schema.chats.id })
    .from(schema.chats)
    .where(and(
      eq(schema.chats.id, chatId),
      isNull(schema.chats.deleted_at),
      or(
        eq(schema.chats.estudiante_id, userId),
        eq(schema.chats.psicologo_id, userId),
      ),
    ))
    .limit(1);

  return Boolean(chat);
}

async function getChatsForUser(userId: number): Promise<number[]> {
  const chats = await db
    .select({ id: schema.chats.id })
    .from(schema.chats)
    .where(and(
      isNull(schema.chats.deleted_at),
      or(
        eq(schema.chats.estudiante_id, userId),
        eq(schema.chats.psicologo_id, userId),
      ),
    ));

  return chats.map((chat) => chat.id);
}
