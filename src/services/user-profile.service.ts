import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Servicio para construir y mantener el perfil emocional del usuario
 * Recopila datos de conversaciones para personalizar las respuestas de NOA
 */

export interface PerfilEmocional {
  emociones_frecuentes: string[];
  temas_recurrentes: string[];
  patrones_comportamiento: string[];
  ultimos_estados: string[];
  mejoras_detectadas: string[];
  riesgos_identificados: string[];
  preferencias_respuesta: string[];
  dias_sin_comunicacion: number;
}

interface DatosUsuario {
  id: number;
  nombre?: string;
  carrera?: string;
  semestre?: number;
  perfil_emocional?: PerfilEmocional;
  ultima_conversacion?: Date;
  total_conversaciones?: number;
}

/**
 * Analiza el historial de mensajes para identificar emociones recurrentes
 */
export const analizarPatronesEmocionales = async (userId: number, limit: number = 30): Promise<PerfilEmocional> => {
  try {
    // Obtener últimos mensajes del usuario
    const mensajes = await db
      .select({
        mensaje: schema.mensajes_chat.mensaje,
        enviado_en: schema.mensajes_chat.enviado_en,
      })
      .from(schema.mensajes_chat)
      .innerJoin(schema.chats, eq(schema.chats.id, schema.mensajes_chat.chat_id))
      .where(
        and(
          eq(schema.chats.estudiante_id, userId),
          eq(schema.chats.isSendByAi, true), // Solo chats con NOA
        ),
      )
      .orderBy(desc(schema.mensajes_chat.enviado_en))
      .limit(limit);

    const emocionesMap: Record<string, number> = {};
    const temasMap: Record<string, number> = {};
    const patrones: string[] = [];

    // Palabras clave por emoción
    const palabrasClave = {
      estrés_académico: ['examen', 'parcial', 'tareas', 'trabajos', 'calificacion', 'nota', 'evaluacion'],
      ansiedad: ['ansioso', 'ansiedad', 'nervios', 'nervioso', 'presion', 'preocup', 'miedo', 'pánico'],
      tristeza: ['triste', 'tristeza', 'deprim', 'vacío', 'melanc', 'llorar', 'mal', 'awful'],
      agotamiento: ['cansado', 'agotad', 'sin energia', 'sin ganas', 'fatigad', 'cansancio'],
      soledad: ['solo', 'aislad', 'sin nadie', 'no tengo amigos', 'alejaron', 'solitario', 'incomprendido'],
      desmotivación: ['desmotiv', 'sin interes', 'perdiendo interes', 'no quiero', 'aburre', 'monotono'],
      relaciones: ['familia', 'amigos', 'relacion', 'peleando', 'compañero', 'novio', 'conflicto'],
      alegría: ['feliz', 'bien', 'mejora', 'logre', 'consegui', 'orgulloso', 'ánimo'],
      autoestima_baja: ['no sirvo', 'incapaz', 'fracaso', 'inútil', 'no valgo', 'mediocre'],
      sueño: ['dormir', 'insomnio', 'no duermo', 'pesadilla', 'sueño', 'cansado'],
    };

    // Analizar mensajes
    mensajes.forEach((msg) => {
      const textoNormalizado = normalizarTexto(msg.mensaje);

      for (const [emocion, palabras] of Object.entries(palabrasClave)) {
        if (palabras.some((p) => textoNormalizado.includes(p))) {
          emocionesMap[emocion] = (emocionesMap[emocion] || 0) + 1;
        }
      }

      // Detectar temas
      if (textoNormalizado.includes('universi') || textoNormalizado.includes('estudi')) {
        temasMap['Académico'] = (temasMap['Académico'] || 0) + 1;
      }
      if (
        textoNormalizado.includes('familia') ||
        textoNormalizado.includes('casa') ||
        textoNormalizado.includes('padre') ||
        textoNormalizado.includes('madre')
      ) {
        temasMap['Familia'] = (temasMap['Familia'] || 0) + 1;
      }
      if (textoNormalizado.includes('amig') || textoNormalizado.includes('relacion')) {
        temasMap['Relaciones'] = (temasMap['Relaciones'] || 0) + 1;
      }
      if (textoNormalizado.includes('dormi') || textoNormalizado.includes('sueño')) {
        temasMap['Sueño'] = (temasMap['Sueño'] || 0) + 1;
      }
      if (textoNormalizado.includes('ejercicio') || textoNormalizado.includes('actividad')) {
        temasMap['Actividad Física'] = (temasMap['Actividad Física'] || 0) + 1;
      }
    });

    // Ordenar y obtener top 5
    const emociones_frecuentes = Object.entries(emocionesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emocion]) => emocion);

    const temas_recurrentes = Object.entries(temasMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([tema]) => tema);

    // Detectar patrones
    if (emociones_frecuentes.includes('estrés_académico') && emociones_frecuentes.includes('agotamiento')) {
      patrones.push('Sobrecarga académica con agotamiento emocional');
    }
    if (emociones_frecuentes.includes('ansiedad') && emociones_frecuentes.includes('soledad')) {
      patrones.push('Ansiedad asociada a sentimientos de aislamiento');
    }
    if (emociones_frecuentes.includes('desmotivación') && temas_recurrentes.includes('Académico')) {
      patrones.push('Desmotivación académica progresiva');
    }
    if (emociones_frecuentes.length > 0 && emociones_frecuentes[0] === 'alegría') {
      patrones.push('Mejora significativa en estado emocional');
    }

    // Obtener últimos 3 estados emocionales
    const ultimos_estados = emociones_frecuentes.slice(0, 3);

    return {
      emociones_frecuentes,
      temas_recurrentes,
      patrones_comportamiento: patrones,
      ultimos_estados,
      mejoras_detectadas: [],
      riesgos_identificados: [],
      preferencias_respuesta: detectarPreferenciasRespuesta(mensajes),
      dias_sin_comunicacion: calcularDiasSinComunicacion(mensajes),
    };
  } catch (error) {
    console.error('Error analizando patrones emocionales:', error);
    return {
      emociones_frecuentes: [],
      temas_recurrentes: [],
      patrones_comportamiento: [],
      ultimos_estados: [],
      mejoras_detectadas: [],
      riesgos_identificados: [],
      preferencias_respuesta: [],
      dias_sin_comunicacion: 0,
    };
  }
};

/**
 * Construye un resumen de perfil del usuario para contextualización
 */
export const construirResumenPerfil = async (userId: number, perfil?: PerfilEmocional): Promise<string> => {
  try {
    if (!perfil) {
      perfil = await analizarPatronesEmocionales(userId);
    }

    if (perfil.emociones_frecuentes.length === 0) {
      return ''; // No hay suficiente historial
    }

    const lineas: string[] = [];

    if (perfil.emociones_frecuentes.length > 0) {
      lineas.push(`El usuario ha experimentado principalmente: ${perfil.emociones_frecuentes.join(', ')}.`);
    }

    if (perfil.temas_recurrentes.length > 0) {
      lineas.push(`Temas recurrentes en sus conversaciones: ${perfil.temas_recurrentes.join(', ')}.`);
    }

    if (perfil.patrones_comportamiento.length > 0) {
      lineas.push(`Patrones detectados: ${perfil.patrones_comportamiento[0]}.`);
    }

    if (perfil.dias_sin_comunicacion > 7) {
      lineas.push(`No ha conversado hace ${perfil.dias_sin_comunicacion} días. Podría necesitar check-in amable.`);
    }

    return lineas.join(' ');
  } catch (error) {
    console.error('Error construyendo resumen de perfil:', error);
    return '';
  }
};

/**
 * Detecta preferencias de respuesta basadas en patrones históricos
 */
const detectarPreferenciasRespuesta = (mensajes: any[]): string[] => {
  const preferencias: string[] = [];

  // Analizar si el usuario responde mejor a:
  // - Respuestas cortas vs largas
  // - Preguntas abiertas
  // - Acciones concretas
  // - Validación emocional

  if (mensajes.length > 5) {
    const longitudPromedio = mensajes.reduce((sum, m) => sum + m.mensaje.length, 0) / mensajes.length;

    if (longitudPromedio < 50) {
      preferencias.push('respuestas_breves');
    }
    if (longitudPromedio > 150) {
      preferencias.push('respuestas_detalladas');
    }
  }

  return preferencias;
};

/**
 * Calcula días sin comunicación
 */
const calcularDiasSinComunicacion = (mensajes: any[]): number => {
  if (mensajes.length === 0) return 0;

  const ultimaMensaje = new Date(mensajes[0].enviado_en);
  const ahora = new Date();
  const diferencia = ahora.getTime() - ultimaMensaje.getTime();
  return Math.floor(diferencia / (1000 * 60 * 60 * 24));
};

/**
 * Normaliza texto para análisis
 */
const normalizarTexto = (texto: string): string => {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

/**
 * Obtiene datos completos del usuario con su perfil
 */
export const obtenerDatosUsuarioConPerfil = async (userId: number): Promise<DatosUsuario> => {
  try {
    // Obtener chat más reciente
    const chatReciente = await db
      .select({
        id: schema.chats.id,
        ultima_actividad: schema.chats.ultima_actividad,
      })
      .from(schema.chats)
      .where(
        and(
          eq(schema.chats.estudiante_id, userId),
          eq(schema.chats.isSendByAi, true),
        ),
      )
      .orderBy(desc(schema.chats.ultima_actividad))
      .limit(1);

    // Contar total de conversaciones
    const totalChats = await db
      .select()
      .from(schema.chats)
      .where(
        and(
          eq(schema.chats.estudiante_id, userId),
          eq(schema.chats.isSendByAi, true),
        ),
      );

    return {
      id: userId,
      perfil_emocional: await analizarPatronesEmocionales(userId),
      ultima_conversacion: chatReciente[0]?.ultima_actividad || undefined,
      total_conversaciones: totalChats.length,
    };
  } catch (error) {
    console.error('Error obteniendo datos del usuario:', error);
    return {
      id: userId,
    };
  }
};
