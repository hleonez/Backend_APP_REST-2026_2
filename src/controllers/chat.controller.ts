import { Response } from 'express';
import { z } from 'zod';
import { and, eq, desc, like, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { AuthRequest } from '../middleware/auth.middleware';
import { chatWithOllama } from '../services/ollama.service';
import { APISuccessResponse, APIErrorResponse } from '../shared/utils/api.utils';
import { analizarSentimiento, type SentimientoResultado } from '../services/sentimiento.service';
import { elegirEstilo } from '../services/selector-estilo.service';
import { construirContextoBienestar } from '../services/contexto-bienestar.service';

// Validation schema for messages
const mensajeSchema = z.object({
  mensaje: z.string().min(1, 'El mensaje no puede estar vacío')
});

// Validation schema for AI chat
const chatIASchema = z.object({
  mensaje: z.string().min(1, 'El mensaje no puede estar vacío'),
  contexto: z.string().optional()
});

const PALABRAS_ALERTA_CRITICA = [
  // Suicidio
  'suicid',
  'suicidio',
  'suicidarme',
  'me suicidio',
  'voy a suicidarme',
  'me voy a suicidar',
  'quiero suicidarme',
  'voy a suicidar',
  
  // Quitarse la vida
  'quitarme la vida',
  'me quiero quitar la vida',
  'no quiero vivir',
  'ya no quiero vivir',
  'prefiero no vivir',
  'no vale la pena vivir',
  
  // Matarse
  'matarme',
  'me voy a matar',
  'voy a matar',
  'me quiero matar',
  'quiero matar',
  'me voy a matar',
  'me estoy matando',
  
  // Autolesiones
  'autoles',
  'autolesion',
  'autolesionarme',
  'me autolesiono',
  'voy a autolesionarme',
  'quiero autolesionarme',
  
  // Hacerse daño
  'hacerme dano',
  'hacerme daño',
  'me quiero hacer daño',
  'voy a hacerme daño',
  'quiero hacerme daño',
  'me voy a hacer daño',
  'me estoy haciendo daño',
  
  // Lastimarse
  'lastimarme',
  'me quiero lastimar',
  'voy a lastimarme',
  'quiero lastimarme',
  'lastimarme a mi mismo',
  'me voy a lastimar',
  
  // Cortarse
  'cortarme',
  'me quiero cortar',
  'voy a cortar',
  'quiero cortar',
  'me voy a cortar',
  'me estoy cortando',
  'cortes',
  'cortarme las venas',
  
  // Sobredosis/Drogas
  'sobredosis',
  'voy a overdosear',
  'quiero overdosear',
  'me quiero overdosear',
  
  // Desaparecer
  'me quiero desaparecer',
  'quiero desaparecer',
  'desaparecer',
  'me voy a desaparecer',
  'me quiero ir y no volver',
  'quiero no existir',
  
  // Morir/Muerte
  'me quiero morir',
  'quiero morir',
  'voy a morir',
  'me voy a morir',
  'solo quiero morir',
  'me estoy muriendo',
  'necesito morir',
  
  // Crisis extrema
  'sin salida',
  'no hay salida',
  'crisis',
  'crisis emocional',
  'crisis depresiva',
  'quiero acabar con esto',
  'necesito que termine todo',
  
  // No aguanta más
  'no aguanto mas',
  'no aguanto más',
  'no aguanto',
  'no puedo mas',
  'no puedo más',
  'no puedo',
  'no aguanto la vida',
  'no puedo seguir asi',
  'no puedo seguir así',
  
  // Desesperación
  'estoy desesperado',
  'me siento desesperado',
  'esto es insoportable',
  'no soporto mas',
  'no soporto más',
  'no soporto vivir',
];

const normalizarTexto = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const limpiarTextoContexto = (texto: string, maxLen: number): string =>
  texto.replace(/\s+/g, ' ').trim().slice(0, maxLen);

const detectarModoProfundo = (mensaje: string): boolean => {
  const t = normalizarTexto(mensaje);
  const claves = [
    'me siento',
    'estoy mal',
    'no puedo',
    'no tengo ganas',
    'me duele',
    'ansiedad',
    'depres',
    'soledad',
    'quiero hablar',
    'necesito ayuda',
    'me esta costando',
    'llor',
    'vac',
  ];

  return t.length > 120 || claves.some((clave) => t.includes(clave));
};

const obtenerHistorialReciente = async (chatId: number, limit: number = 6): Promise<string> => {
  const mensajes = await db
    .select({
      mensaje: schema.mensajes_chat.mensaje,
      usuario_id: schema.mensajes_chat.usuario_id,
      enviado_en: schema.mensajes_chat.enviado_en,
    })
    .from(schema.mensajes_chat)
    .where(eq(schema.mensajes_chat.chat_id, chatId))
    .orderBy(desc(schema.mensajes_chat.enviado_en))
    .limit(limit);

  if (!mensajes.length) return '';

  const resumen = mensajes
    .reverse()
    .map((m) => {
      const rol = m.usuario_id ? 'Usuario' : 'NOA';
      const texto = limpiarTextoContexto(m.mensaje, 220);
      return `${rol}: ${texto}`;
    })
    .join(' | ');

  return resumen;
};

const normalizarSemaforo = (valor?: string | null): 'verde' | 'amarillo' | 'rojo' | undefined =>
  valor === 'verde' || valor === 'amarillo' || valor === 'rojo' ? valor : undefined;

const detectarAlertaCritica = (mensaje: string) => {
  const mensajeNormalizado = normalizarTexto(mensaje);
  const coincidencias = PALABRAS_ALERTA_CRITICA.filter((palabra) =>
    mensajeNormalizado.includes(palabra),
  );

  return {
    esCritico: coincidencias.length > 0,
    nivel: coincidencias.length > 1 ? 'critico' : coincidencias.length === 1 ? 'alto' : 'normal',
    coincidencias,
  };
};

const getOrCreateIAChat = async (usuarioId: number): Promise<number> => {
  const [chatActivo] = await db
    .select({ id: schema.chats.id })
    .from(schema.chats)
    .where(
      and(
        eq(schema.chats.estudiante_id, usuarioId),
        eq(schema.chats.isSendByAi, true),
        eq(schema.chats.is_active, true),
        isNull(schema.chats.psicologo_id),
      ),
    )
    .orderBy(desc(schema.chats.ultima_actividad))
    .limit(1);

  if (chatActivo?.id) {
    return chatActivo.id;
  }

  const [creado] = await db
    .insert(schema.chats)
    .values({
      estudiante_id: usuarioId,
      psicologo_id: null,
      iniciado_en: new Date(),
      ultima_actividad: new Date(),
      is_active: true,
      isSendByAi: true,
    })
    .returning({ id: schema.chats.id });

  return creado.id;
};

const guardarInteraccionIA = async (params: {
  chatId: number;
  usuarioId: number;
  mensajeUsuario: string;
  respuestaIA: string;
  /**
   * Resultado del analisis de sentimiento (Fase 2) del mensaje del
   * estudiante. Opcional: si no se provee (p. ej. el flujo de crisis, que
   * nunca depende del encoder), el mensaje se guarda sin estos campos.
   */
  sentimientoUsuario?: SentimientoResultado;
}) => {
  await db.insert(schema.mensajes_chat).values([
    {
      chat_id: params.chatId,
      usuario_id: params.usuarioId,
      mensaje: params.mensajeUsuario,
      enviado_en: new Date(),
      ...(params.sentimientoUsuario
        ? {
            sentimiento: params.sentimientoUsuario.label,
            confianza: params.sentimientoUsuario.confianza.toFixed(3),
            sentimiento_scores: params.sentimientoUsuario.scores,
          }
        : {}),
    },
    {
      chat_id: params.chatId,
      usuario_id: null,
      mensaje: params.respuestaIA,
      enviado_en: new Date(),
    },
  ]);

  await db
    .update(schema.chats)
    .set({ ultima_actividad: new Date(), isSendByAi: true })
    .where(eq(schema.chats.id, params.chatId));
};

const construirConsejosBasicos = (texto: string): string[] => {
  const t = normalizarTexto(texto);
  const consejos = [
    'Haz una pausa corta de respiracion: inhala 4 segundos, sostén 4 y exhala 6.',
    'Escribe en una nota una emocion y una necesidad concreta para hoy.',
    'Habla con una persona de confianza durante al menos 10 minutos.',
  ];

  if (t.includes('ansiedad') || t.includes('nerv')) {
    consejos[0] = 'Prueba respiracion cuadrada durante 2 minutos para bajar la activacion.';
  }

  if (t.includes('triste') || t.includes('solo')) {
    consejos[1] = 'Valida como te sientes sin juzgarte y define una accion pequena de autocuidado hoy.';
  }

  if (t.includes('cans') || t.includes('agot')) {
    consejos[2] = 'Prioriza descanso breve y reduce una carga no esencial del dia.';
  }

  return consejos;
};

const buscarProfesionalSalvavidas = async (): Promise<number | null> => {
  const [moderador] = await db
    .select({ id: schema.usuarios.id })
    .from(schema.usuarios)
    .where(and(eq(schema.usuarios.id_rol, 4), eq(schema.usuarios.is_active, true)))
    .limit(1);

  if (moderador?.id) {
    return moderador.id;
  }

  const [psicologo] = await db
    .select({ id: schema.usuarios.id })
    .from(schema.usuarios)
    .where(and(eq(schema.usuarios.id_rol, 2), eq(schema.usuarios.is_active, true)))
    .limit(1);

  return psicologo?.id ?? null;
};

const escalarASalvavidas = async (params: {
  usuarioId: number;
  mensajeUsuario: string;
  respuestaIA: string;
  profesionalId?: number | null;
}): Promise<{ chatId: number | null; profesionalId: number | null }> => {
  const profesionalId = params.profesionalId ?? await buscarProfesionalSalvavidas();

  if (!profesionalId) {
    return { chatId: null, profesionalId: null };
  }

  const [chatExistente] = await db
    .select({ id: schema.chats.id })
    .from(schema.chats)
    .where(
      and(
        eq(schema.chats.estudiante_id, params.usuarioId),
        eq(schema.chats.psicologo_id, profesionalId),
        eq(schema.chats.is_active, true),
      ),
    )
    .orderBy(desc(schema.chats.ultima_actividad))
    .limit(1);

  let chatId = chatExistente?.id;

  if (!chatId) {
    const [chatCreado] = await db
      .insert(schema.chats)
      .values({
        estudiante_id: params.usuarioId,
        psicologo_id: profesionalId,
        iniciado_en: new Date(),
        ultima_actividad: new Date(),
        is_active: true,
        isSendByAi: true,
      })
      .returning({ id: schema.chats.id });

    chatId = chatCreado?.id;
  }

  if (!chatId) {
    return { chatId: null, profesionalId };
  }

  await db.insert(schema.mensajes_chat).values([
    {
      chat_id: chatId,
      usuario_id: params.usuarioId,
      mensaje: `[ALERTA NOA] Mensaje detectado como riesgo: ${params.mensajeUsuario}`,
      enviado_en: new Date(),
    },
    {
      chat_id: chatId,
      usuario_id: profesionalId,
      mensaje: `[ALERTA NOA] Respuesta inicial enviada al usuario: ${params.respuestaIA}`,
      enviado_en: new Date(),
    },
  ]);

  await db
    .update(schema.chats)
    .set({ ultima_actividad: new Date(), isSendByAi: true })
    .where(eq(schema.chats.id, chatId));

  return { chatId, profesionalId };
};

/**
 * Get all chats for the authenticated user
 */
export const getChats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const chats = await db
      .select()
      .from(schema.chats)
      .where(eq(schema.chats.estudiante_id, req.user.id as number))
      .orderBy(desc(schema.chats.ultima_actividad));

    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * Chat with AI using Ollama
 */
export const chatConIAUnificado = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const validationResult = chatIASchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json(APIErrorResponse('Datos inválidos: ' + validationResult.error.errors[0].message));
      return;
    }

    const { mensaje } = validationResult.data;
    const alerta = detectarAlertaCritica(mensaje);
    const chatIAId = await getOrCreateIAChat(req.user.id);

    if (alerta.esCritico) {
      const profesionalId = await buscarProfesionalSalvavidas();
      const hayProfesional = profesionalId !== null;

      const respuestaCritica = hayProfesional
        ? 'Gracias por decirme como te sientes. Lo que estas viviendo es importante y no estas solo. Voy a conectarte de inmediato con Salvavidas para que un profesional pueda acompanarte ahora mismo.'
        : 'Gracias por decirme como te sientes. Lo que estas viviendo es importante y no estas solo. Si necesitas hablar con alguien urgente, por favor contacta a la linea de emergencia 123 (Salvavidas) o acude a la consejeria de tu universidad. Yo estoy aqui para escucharte.';

      await guardarInteraccionIA({
        chatId: chatIAId,
        usuarioId: req.user.id,
        mensajeUsuario: mensaje,
        respuestaIA: respuestaCritica,
      });

      let escalamiento = { chatId: null as number | null, profesionalId: null as number | null };
      if (hayProfesional) {
        escalamiento = await escalarASalvavidas({
          usuarioId: req.user.id,
          mensajeUsuario: mensaje,
          respuestaIA: respuestaCritica,
          profesionalId,
        });
      } else {
        console.warn('[SALVAVIDAS] No hay profesional disponible para escalar caso critico del usuario', req.user.id);
      }

      res.status(201).json(APISuccessResponse({
        usuario_id: req.user.id,
        chat_id: chatIAId,
        mensaje_usuario: mensaje,
        respuesta_ia: respuestaCritica,
        timestamp: new Date().toISOString(),
        requiere_salvavidas: hayProfesional,
        nivel_alerta: alerta.nivel,
        coincidencias_alerta: alerta.coincidencias,
        chat_salvavidas_id: escalamiento.chatId,
        psicologo_asignado_id: escalamiento.profesionalId,
        mensaje_sistema: hayProfesional
          ? 'Detectamos una situacion de riesgo. Ya derivamos tu caso a Salvavidas para atencion profesional.'
          : 'Detectamos una situacion de riesgo. No hay un profesional disponible en este momento. Por favor contacta a la linea de emergencia 123 (Salvavidas).',
      }, 'Chat completado exitosamente'));
      return;
    }

    try {
      const totalMensajesChat = await db
        .select({ id: schema.mensajes_chat.id })
        .from(schema.mensajes_chat)
        .where(eq(schema.mensajes_chat.chat_id, chatIAId));
      const numeroMensaje = totalMensajesChat.length;
      const modo = detectarModoProfundo(mensaje) ? 'profundo' : 'normal';

      const sentimiento = await analizarSentimiento(mensaje);

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[NOA DEBUG] Sentimiento label=${sentimiento.label};confianza=${sentimiento.confianza.toFixed(3)};origen=${sentimiento.origen} (usuario ${req.user.id})`,
        );
      }

      const contextoBienestar = await construirContextoBienestar(req.user.id);
      const estilo = elegirEstilo({
        sentimiento: { label: sentimiento.label, confianza: sentimiento.confianza },
        semaforo: contextoBienestar.datos.semaforo_actual?.color,
        subcategoria: contextoBienestar.datos.semaforo_actual?.subcategoria,
        perfil: {
          emociones_frecuentes: contextoBienestar.datos.perfil_emocional.emociones_frecuentes,
          temas_recurrentes: contextoBienestar.datos.perfil_emocional.temas_recurrentes,
          patrones_comportamiento: contextoBienestar.datos.perfil_emocional.patrones_comportamiento,
          dias_sin_comunicacion: contextoBienestar.datos.perfil_emocional.dias_sin_comunicacion,
          tiene_historial: contextoBienestar.datos.perfil_emocional.emociones_frecuentes.length > 0,
        },
        ultimosRegistros: contextoBienestar.datos.registro_7d,
        onboarding: contextoBienestar.datos.onboarding_base.length === 0,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[NOA DEBUG] Estilo elegido=${estilo} (mensaje #${numeroMensaje})`);
      }

      const contextoParaIA = [
        contextoBienestar.bloque_prompt,
        `Sentimiento detectado en el ultimo mensaje: ${sentimiento.label} (confianza ${sentimiento.confianza.toFixed(2)}).`,
      ].join('\n\n');

      const respuestaIA = await Promise.race([
        chatWithOllama({
          mensaje,
          contexto: contextoParaIA,
          modo,
          numeroMensaje,
          estilo,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 70000)
        )
      ]) as any;

      await guardarInteraccionIA({
        chatId: chatIAId,
        usuarioId: req.user.id,
        mensajeUsuario: mensaje,
        respuestaIA: respuestaIA.respuesta,
        sentimientoUsuario: sentimiento,
      });

      res.status(201).json(APISuccessResponse({
        usuario_id: req.user.id,
        chat_id: chatIAId,
        mensaje_usuario: mensaje,
        respuesta_ia: respuestaIA.respuesta,
        timestamp: respuestaIA.timestamp,
        requiere_salvavidas: false,
        nivel_alerta: 'normal',
        coincidencias_alerta: [],
        chat_salvavidas_id: null,
        psicologo_asignado_id: null,
        mensaje_sistema: null,
      }, 'Chat completado exitosamente'));
    } catch (aiError: any) {
      console.error('Error en chat con IA:', aiError);

      if (aiError.message === 'Timeout' || aiError.message.includes('no responde')) {
        res.status(503).json(APIErrorResponse('El servicio de IA está respondiendo lentamente. Por favor, intenta nuevamente en unos momentos.'));
      } else {
        res.status(503).json(APIErrorResponse('Error comunicándose con el servicio de IA. Por favor, intenta nuevamente.'));
      }
    }
  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json(APIErrorResponse('Error interno del servidor'));
  }
};

export const chatConIA = chatConIAUnificado;

/**
 * Get AI chat history for user (if stored in future)
 */
export const getHistorialChatIA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const chatsIA = await db
      .select({
        id: schema.chats.id,
        iniciado_en: schema.chats.iniciado_en,
        ultima_actividad: schema.chats.ultima_actividad,
        finalizado_en: schema.chats.finalizado_en,
        is_active: schema.chats.is_active,
      })
      .from(schema.chats)
      .where(
        and(
          eq(schema.chats.estudiante_id, req.user.id),
          eq(schema.chats.isSendByAi, true),
        ),
      )
      .orderBy(desc(schema.chats.ultima_actividad));

    const historial = await Promise.all(
      chatsIA.map(async (chat) => {
        const mensajes = await db
          .select({
            id: schema.mensajes_chat.id,
            mensaje: schema.mensajes_chat.mensaje,
            enviado_en: schema.mensajes_chat.enviado_en,
          })
          .from(schema.mensajes_chat)
          .where(eq(schema.mensajes_chat.chat_id, chat.id))
          .orderBy(desc(schema.mensajes_chat.enviado_en));

        const ultimo = mensajes[0] ?? null;
        const previewBase = ultimo?.mensaje ?? 'Conversacion con NOA';
        const preview = previewBase.length > 90
          ? `${previewBase.slice(0, 90)}...`
          : previewBase;

        return {
          chat_id: chat.id,
          iniciado_en: chat.iniciado_en,
          ultima_actividad: chat.ultima_actividad,
          finalizado_en: chat.finalizado_en,
          is_active: chat.is_active,
          total_mensajes: mensajes.length,
          preview,
        };
      }),
    );

    res.status(200).json(APISuccessResponse({
      usuario_id: req.user.id,
      historial,
    }, 'Historial de chat obtenido'));

  } catch (error) {
    console.error('Error fetching AI chat history:', error);
    res.status(500).json(APIErrorResponse('Error interno del servidor'));
  }
}; 

const chatCreateSchema = z.object({
  estudiante_id: z.number().int().positive(),
  psicologo_id: z.number().int().positive(),
  iniciado_en: z.coerce.date().optional(),
  is_active: z.boolean().optional(),
});

const chatPutSchema = chatCreateSchema.extend({
  finalizado_en: z.coerce.date().nullable().optional(),
  ultima_actividad: z.coerce.date().optional(),
});

const chatPatchSchema = chatPutSchema.partial();

export const listChats = async (req: AuthRequest, res: any) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Usuario no autenticado' });
    const onlyActive = req.query.active === 'true';
    let condition = or(
      eq(schema.chats.estudiante_id, req.user.id as number),
      eq(schema.chats.psicologo_id, req.user.id as number)
    );
    if (onlyActive) {
      condition = and(condition, eq(schema.chats.is_active, true));
    }
    const chats = await db
      .select()
      .from(schema.chats)
      .where(condition)
      .orderBy(desc(schema.chats.ultima_actividad));
    return res.json(chats);
  } catch (error) {
    console.error('Error list chats:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
}

export const getChatById = async (req: AuthRequest, res: any) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Usuario no autenticado' });
    const chatId = Number(req.params.chatId);
    if (Number.isNaN(chatId)) return res.status(400).json({ message: 'ID inválido' });
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId)).limit(1);
    if (!chat) return res.status(404).json({ message: 'Chat no encontrado' });
    if (!(chat.estudiante_id === req.user.id || chat.psicologo_id === req.user.id)) return res.status(403).json({ message: 'No autorizado' });
    return res.json(chat);
  } catch (error) {
    console.error('Error get chat:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
}

export const createChat = async (req: AuthRequest, res: any) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Usuario no autenticado' });
    const parsed = chatCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    const data = parsed.data;
    // Only allow if user is participant
    if (req.user.id !== data.estudiante_id && req.user.id !== data.psicologo_id) return res.status(403).json({ message: 'No autorizado' });
    const now = new Date();
    const [created] = await db.insert(schema.chats).values({
      estudiante_id: data.estudiante_id,
      psicologo_id: data.psicologo_id,
      iniciado_en: data.iniciado_en ?? now,
      ultima_actividad: now,
      is_active: data.is_active ?? true,
    }).returning();
    return res.status(201).json(created);
  } catch (error) {
    console.error('Error create chat:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
}

export const updateChatPut = async (req: AuthRequest, res: any) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Usuario no autenticado' });
    const chatId = Number(req.params.chatId);
    if (Number.isNaN(chatId)) return res.status(400).json({ message: 'ID inválido' });
    const parsed = chatPutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    const [existing] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId)).limit(1);
    if (!existing) return res.status(404).json({ message: 'Chat no encontrado' });
    if (!(existing.estudiante_id === req.user.id || existing.psicologo_id === req.user.id)) return res.status(403).json({ message: 'No autorizado' });
    const data = parsed.data;
    const [updated] = await db.update(schema.chats).set({
      estudiante_id: data.estudiante_id,
      psicologo_id: data.psicologo_id,
      iniciado_en: data.iniciado_en ?? existing.iniciado_en,
      ultima_actividad: data.ultima_actividad ?? new Date(),
      finalizado_en: data.finalizado_en ?? existing.finalizado_en ?? null,
      is_active: data.is_active ?? existing.is_active,
    }).where(eq(schema.chats.id, chatId)).returning();
    return res.json(updated);
  } catch (error) {
    console.error('Error put chat:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
}

export const updateChatPatch = async (req: AuthRequest, res: any) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Usuario no autenticado' });
    const chatId = Number(req.params.chatId);
    if (Number.isNaN(chatId)) return res.status(400).json({ message: 'ID inválido' });
    const parsed = chatPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    const [existing] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId)).limit(1);
    if (!existing) return res.status(404).json({ message: 'Chat no encontrado' });
    if (!(existing.estudiante_id === req.user.id || existing.psicologo_id === req.user.id)) return res.status(403).json({ message: 'No autorizado' });
    const data = parsed.data;
    const payload: any = {};
    if (data.estudiante_id !== undefined) payload.estudiante_id = data.estudiante_id;
    if (data.psicologo_id !== undefined) payload.psicologo_id = data.psicologo_id;
    if (data.iniciado_en !== undefined) payload.iniciado_en = data.iniciado_en;
    if (data.ultima_actividad !== undefined) payload.ultima_actividad = data.ultima_actividad; else payload.ultima_actividad = new Date();
    if (data.finalizado_en !== undefined) payload.finalizado_en = data.finalizado_en;
    if (data.is_active !== undefined) payload.is_active = data.is_active;
    const [updated] = await db.update(schema.chats).set(payload).where(eq(schema.chats.id, chatId)).returning();
    return res.json(updated);
  } catch (error) {
    console.error('Error patch chat:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
}

export const deleteChat = async (req: AuthRequest, res: any) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Usuario no autenticado' });
    const chatId = Number(req.params.chatId);
    if (Number.isNaN(chatId)) return res.status(400).json({ message: 'ID inválido' });
    const [existing] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId)).limit(1);
    if (!existing) return res.status(404).json({ message: 'Chat no encontrado' });
    if (!(existing.estudiante_id === req.user.id || existing.psicologo_id === req.user.id)) return res.status(403).json({ message: 'No autorizado' });
    await db.delete(schema.mensajes_chat).where(eq(schema.mensajes_chat.chat_id, chatId));
    await db.delete(schema.chats).where(eq(schema.chats.id, chatId));
    return res.json({ message: 'Chat eliminado' });
  } catch (error) {
    console.error('Error delete chat:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
}

// ================================
// FUNCIONES AVANZADAS DE IA
// ================================

// Helper functions para IA avanzada
const obtenerUltimaEvaluacion = async (usuarioId: number) => {
  const evaluacion = await db
    .select()
    .from(schema.evaluaciones)
    .where(eq(schema.evaluaciones.usuario_id, usuarioId))
    .orderBy(desc(schema.evaluaciones.fecha))
    .limit(1);
  
  return evaluacion[0] || null;
};

const obtenerRegistrosActividades = async (usuarioId: number, limit: number = 5) => {
  const actividades = await db
    .select({
      id: schema.registro_actividades_usuarios.id,
      opcion_id: schema.registro_actividades_usuarios.opcion_id,
      fecha: schema.registro_actividades_usuarios.fecha,
      observaciones: schema.registro_actividades_usuarios.observaciones,
      opcion: {
        nombre: schema.opciones_registro_actividades.nombre,
        descripcion: schema.opciones_registro_actividades.descripcion,
        url_imagen: schema.opciones_registro_actividades.url_imagen
      }
    })
    .from(schema.registro_actividades_usuarios)
    .leftJoin(
      schema.opciones_registro_actividades,
      eq(schema.registro_actividades_usuarios.opcion_id, schema.opciones_registro_actividades.id)
    )
    .where(eq(schema.registro_actividades_usuarios.usuario_id, usuarioId))
    .orderBy(desc(schema.registro_actividades_usuarios.fecha))
    .limit(limit);
  
  return actividades;
};

const obtenerRegistrosEmocionales = async (usuarioId: number, limit: number = 5) => {
  const emociones = await db
    .select({
      id: schema.registro_emocional.id,
      opcion_id: schema.registro_emocional.opcion_id,
      fecha: schema.registro_emocional.fecha,
      observaciones: schema.registro_emocional.observaciones,
      opcion: {
        nombre: schema.opciones_registro_emocional.nombre,
        descripcion: schema.opciones_registro_emocional.descripcion,
        puntaje: schema.opciones_registro_emocional.puntaje
      }
    })
    .from(schema.registro_emocional)
    .leftJoin(
      schema.opciones_registro_emocional,
      eq(schema.registro_emocional.opcion_id, schema.opciones_registro_emocional.id)
    )
    .where(eq(schema.registro_emocional.usuario_id, usuarioId))
    .orderBy(desc(schema.registro_emocional.fecha))
    .limit(limit);
  
  return emociones;
};

const yaRecomendoFormulario = async (usuarioId: number): Promise<boolean> => {
  const mensajes = await db
    .select()
    .from(schema.mensajes_chat)
    .where(eq(schema.mensajes_chat.usuario_id, usuarioId))
    .orderBy(desc(schema.mensajes_chat.enviado_en))
    .limit(10);

  const frasesRecomendacion = [
    "completar la evaluación emocional",
    "evaluación emocional",
    "cuestionario emocional",
    "formulario de evaluación",
    "evaluación inicial",
    "cuestionario inicial",
    "evaluación psicológica",
    "formulario psicológico",
    "evaluar tu estado emocional",
    "completar el formulario",
    "realizar la evaluación"
  ];

  for (const mensaje of mensajes) {
    const respuestaLower = mensaje.mensaje.toLowerCase();
    for (const frase of frasesRecomendacion) {
      if (respuestaLower.includes(frase)) {
        return true;
      }
    }
  }

  return false;
};

const extraerTareasDelContenido = (contenido: string): any[] => {
  const regex = /Bloque de tareas sugeridas:\s*(\[[\s\S]+?\])/;
  const match = contenido.match(regex);
  
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      console.error('Error al parsear tareas:', error);
      return [];
    }
  }
  
  return [];
};

export const chatConIAAvanzado = chatConIAUnificado;

/**
 * Obtener actividades recomendadas para el usuario
 */
export const obtenerActividadesRecomendadas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const usuarioId = req.user.id;
    const evaluacion = await obtenerUltimaEvaluacion(usuarioId);

    // Obtener todas las opciones de actividades
    const opcionesActividades = await db
      .select()
      .from(schema.opciones_registro_actividades);

    // Obtener actividades ya realizadas por el usuario
    const actividadesRealizadas = await db
      .select({ opcion_id: schema.registro_actividades_usuarios.opcion_id })
      .from(schema.registro_actividades_usuarios)
      .where(eq(schema.registro_actividades_usuarios.usuario_id, usuarioId));

    const idsRealizadas = new Set(actividadesRealizadas.map(a => a.opcion_id));

    // Filtrar actividades no realizadas
    const actividadesDisponibles = opcionesActividades.filter(
      actividad => !idsRealizadas.has(actividad.id)
    );

    // Recomendar basado en el estado emocional
    let recomendaciones = actividadesDisponibles;

    if (evaluacion) {
      switch (evaluacion.estado_semaforo) {
        case 'rojo':
          // Actividades más relajantes y de autocuidado
          recomendaciones = actividadesDisponibles.filter(a => 
            a.nombre.toLowerCase().includes('relajación') ||
            a.nombre.toLowerCase().includes('meditación') ||
            a.nombre.toLowerCase().includes('respiración') ||
            a.nombre.toLowerCase().includes('yoga')
          );
          break;
        case 'amarillo':
          // Actividades moderadas
          recomendaciones = actividadesDisponibles.filter(a => 
            !a.nombre.toLowerCase().includes('intenso') &&
            !a.nombre.toLowerCase().includes('extremo')
          );
          break;
        case 'verde':
          // Cualquier actividad
          recomendaciones = actividadesDisponibles;
          break;
      }
    }

    res.status(200).json(APISuccessResponse({
      actividades_recomendadas: recomendaciones.slice(0, 5), // Top 5
      estado_emocional: evaluacion?.estado_semaforo || 'sin_evaluar',
      total_disponibles: actividadesDisponibles.length
    }, 'Actividades recomendadas obtenidas'));

  } catch (error) {
    console.error('Error obteniendo actividades:', error);
    res.status(500).json(APIErrorResponse('Error interno del servidor'));
  }
};

/**
 * Obtener estado psicológico del usuario
 */
export const obtenerEstadoPsicologicoUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const usuarioId = req.user.id;
    const evaluacion = await obtenerUltimaEvaluacion(usuarioId);

    if (!evaluacion) {
      res.status(200).json(APISuccessResponse({
        tiene_evaluacion: false,
        mensaje: 'Aún no has completado tu evaluación emocional inicial'
      }, 'Estado psicológico obtenido'));
      return;
    }

    // Obtener estadísticas adicionales
    const totalActividades = await db
      .select({ count: schema.registro_actividades_usuarios.id })
      .from(schema.registro_actividades_usuarios)
      .where(eq(schema.registro_actividades_usuarios.usuario_id, usuarioId));

    const totalEmociones = await db
      .select({ count: schema.registro_emocional.id })
      .from(schema.registro_emocional)
      .where(eq(schema.registro_emocional.usuario_id, usuarioId));

    res.status(200).json(APISuccessResponse({
      tiene_evaluacion: true,
      estado_actual: {
        nivel: evaluacion.estado_semaforo,
        puntaje: evaluacion.puntaje_total,
        observaciones: evaluacion.observaciones,
        fecha_evaluacion: evaluacion.fecha
      },
      estadisticas: {
        actividades_completadas: totalActividades.length,
        registros_emocionales: totalEmociones.length
      }
    }, 'Estado psicológico obtenido'));

  } catch (error) {
    console.error('Error obteniendo estado psicológico:', error);
    res.status(500).json(APIErrorResponse('Error interno del servidor'));
  }
};

/**
 * Detener chat IA activo y devolver retroalimentacion breve
 */
export const detenerChatIA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const [chatActivo] = await db
      .select({ id: schema.chats.id })
      .from(schema.chats)
      .where(
        and(
          eq(schema.chats.estudiante_id, req.user.id),
          eq(schema.chats.isSendByAi, true),
          eq(schema.chats.is_active, true),
        ),
      )
      .orderBy(desc(schema.chats.ultima_actividad))
      .limit(1);

    if (!chatActivo?.id) {
      res.status(200).json(
        APISuccessResponse(
          {
            chat_id: null,
            retroalimentacion:
              'Hoy no hay una sesion activa con NOA, pero recuerda que puedes volver cuando lo necesites.',
            consejos: construirConsejosBasicos(''),
          },
          'No habia chat activo',
        ),
      );
      return;
    }

    const mensajes = await db
      .select({
        mensaje: schema.mensajes_chat.mensaje,
        usuario_id: schema.mensajes_chat.usuario_id,
      })
      .from(schema.mensajes_chat)
      .where(eq(schema.mensajes_chat.chat_id, chatActivo.id))
      .orderBy(desc(schema.mensajes_chat.enviado_en))
      .limit(8);

    const mensajesUsuario = mensajes
      .filter((m) => m.usuario_id === req.user?.id)
      .map((m) => m.mensaje);

    const textoUsuario = mensajesUsuario.join(' ');
    const consejos = construirConsejosBasicos(textoUsuario);

    const retroalimentacion = mensajesUsuario.length > 0
      ? 'Gracias por compartir este espacio con NOA. Hoy expresaste lo que sentias y eso ya es un paso importante en tu proceso.'
      : 'Gracias por abrir el chat. Aunque haya sido breve, volver cuando lo necesites tambien es autocuidado.';

    await db
      .update(schema.chats)
      .set({
        is_active: false,
        finalizado_en: new Date(),
        ultima_actividad: new Date(),
      })
      .where(eq(schema.chats.id, chatActivo.id));

    res.status(200).json(
      APISuccessResponse(
        {
          chat_id: chatActivo.id,
          retroalimentacion,
          consejos,
          total_mensajes_usuario: mensajesUsuario.length,
        },
        'Sesion finalizada con retroalimentacion',
      ),
    );
  } catch (error) {
    console.error('Error deteniendo chat IA:', error);
    res.status(500).json(APIErrorResponse('Error interno del servidor'));
  }
};