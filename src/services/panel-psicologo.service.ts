import { and, asc, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { getEstadisticasService } from './estadisticas-registro-emocional.service';

// ============================================================
// Tipos de respuesta
// ============================================================

export interface PerfilEstudiante {
  id: number;
  nombres: string;
  apellidos: string;
  ciudad: string | null;
  semestre_actual: string | null;
  edad: number | null;
  sexo: string | null;
  fecha_nacimiento: string | null;
  streak_count: number;
  streak_goal_days: number;
  streak_last_date: string | null;
  fecha_registro: Date;
  is_active: boolean;
}

export interface DimensionSemaforo {
  id: number;
  dimension: string;
  puntaje: number;
  nivel: string;
}

export interface UltimaEvaluacion {
  id: number;
  fecha: Date;
  puntaje_total: number | null;
  estado_semaforo: string | null;
  subcategoria_principal: string | null;
  observaciones: string | null;
  dimensiones: DimensionSemaforo[];
}

export interface ActividadVigente {
  id: number;
  vencimiento: Date;
  observaciones: string | null;
  opcion: {
    id: number;
    nombre: string;
    url_imagen: string;
    descripcion: string | null;
  } | null;
}

export interface ResumenEstudiante {
  perfil: PerfilEstudiante;
  ultima_evaluacion: UltimaEvaluacion | null;
  actividades_vigentes: ActividadVigente[];
}

export interface EvaluacionHistorial {
  id: number;
  fecha: Date;
  puntaje_total: number | null;
  estado_semaforo: string | null;
  subcategoria_principal: string | null;
  observaciones: string | null;
  dimensiones: DimensionSemaforo[];
}

export interface ActividadHistorial {
  id: number;
  fecha: Date;
  vencimiento: Date;
  vencida: boolean;
  observaciones: string | null;
  opcion: {
    id: number;
    nombre: string;
    url_imagen: string;
    descripcion: string | null;
  } | null;
}

// ============================================================
// Servicio: Perfil (datos generales seguros)
// ============================================================

/**
 * Retorna los datos generales del estudiante sin información sensible.
 *
 * Campos EXCLUIDOS intencionalmente por privacidad:
 *   - correo, contrasena, telefono
 *   - especialidad_psicologo (irrelevante para el panel del estudiante)
 *   - id_rol (detalle interno)
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si no existe o está eliminado.
 */
export const getPerfilEstudianteService = async (
  estudianteId: number
): Promise<PerfilEstudiante> => {
  const [estudiante] = await db
    .select({
      id: schema.usuarios.id,
      nombres: schema.usuarios.nombres,
      apellidos: schema.usuarios.apellidos,
      ciudad: schema.usuarios.ciudad,
      semestre_actual: schema.usuarios.semestre_actual,
      edad: schema.usuarios.edad,
      sexo: schema.usuarios.sexo,
      fecha_nacimiento: schema.usuarios.fecha_nacimiento,
      streak_count: schema.usuarios.streak_count,
      streak_goal_days: schema.usuarios.streak_goal_days,
      streak_last_date: schema.usuarios.streak_last_date,
      fecha_registro: schema.usuarios.fecha_registro,
      is_active: schema.usuarios.is_active,
    })
    .from(schema.usuarios)
    .where(
      and(
        eq(schema.usuarios.id, estudianteId),
        isNull(schema.usuarios.deleted_at)
      )
    )
    .limit(1);

  if (!estudiante) {
    const error = new Error('Estudiante no encontrado.');
    (error as any).code = 'ESTUDIANTE_NO_ENCONTRADO';
    throw error;
  }

  return estudiante;
};

// ============================================================
// Servicio: Resumen (ficha consolidada)
// ============================================================

/**
 * Retorna la ficha consolidada del estudiante para el panel del psicólogo:
 *   - Perfil (datos seguros, sin info sensible)
 *   - Última evaluación con dimensiones de semáforo
 *   - Actividades vigentes (vencimiento futuro, sin soft-delete)
 *
 * Tablas NUNCA consultadas (privacidad estricta):
 *   diario, feedback, fallas_tecnicas, solicitudes_premios
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si el estudiante no existe.
 */
export const getResumenEstudianteService = async (
  estudianteId: number
): Promise<ResumenEstudiante> => {
  // 1. Perfil del estudiante
  const perfil = await getPerfilEstudianteService(estudianteId);

  // 2. Última evaluación
  const [ultimaEval] = await db
    .select({
      id: schema.evaluaciones.id,
      fecha: schema.evaluaciones.fecha,
      puntaje_total: schema.evaluaciones.puntaje_total,
      estado_semaforo: schema.evaluaciones.estado_semaforo,
      subcategoria_principal: schema.evaluaciones.subcategoria_principal,
      observaciones: schema.evaluaciones.observaciones,
    })
    .from(schema.evaluaciones)
    .where(
      and(
        eq(schema.evaluaciones.usuario_id, estudianteId),
        isNull(schema.evaluaciones.deleted_at)
      )
    )
    .orderBy(desc(schema.evaluaciones.fecha))
    .limit(1);

  // 3. Dimensiones de esa evaluación (si existe)
  let dimensiones: DimensionSemaforo[] = [];
  if (ultimaEval) {
    dimensiones = await db
      .select({
        id: schema.semaforo_dimensiones.id,
        dimension: schema.semaforo_dimensiones.dimension,
        puntaje: schema.semaforo_dimensiones.puntaje,
        nivel: schema.semaforo_dimensiones.nivel,
      })
      .from(schema.semaforo_dimensiones)
      .where(
        and(
          eq(schema.semaforo_dimensiones.evaluacion_id, ultimaEval.id),
          isNull(schema.semaforo_dimensiones.deleted_at)
        )
      );
  }

  const ultima_evaluacion: UltimaEvaluacion | null = ultimaEval
    ? { ...ultimaEval, dimensiones }
    : null;

  // 4. Actividades vigentes (vencimiento >= ahora)
  const ahora = new Date();
  const actividadesRaw = await db
    .select({
      id: schema.registro_actividades_usuarios.id,
      vencimiento: schema.registro_actividades_usuarios.vencimiento,
      observaciones: schema.registro_actividades_usuarios.observaciones,
      opcion_id: schema.registro_actividades_usuarios.opcion_id,
      opcion_nombre: schema.opciones_registro_actividades.nombre,
      opcion_url_imagen: schema.opciones_registro_actividades.url_imagen,
      opcion_descripcion: schema.opciones_registro_actividades.descripcion,
    })
    .from(schema.registro_actividades_usuarios)
    .leftJoin(
      schema.opciones_registro_actividades,
      eq(
        schema.registro_actividades_usuarios.opcion_id,
        schema.opciones_registro_actividades.id
      )
    )
    .where(
      and(
        eq(schema.registro_actividades_usuarios.usuario_id, estudianteId),
        gt(schema.registro_actividades_usuarios.vencimiento, ahora),
        isNull(schema.registro_actividades_usuarios.deleted_at)
      )
    )
    .orderBy(schema.registro_actividades_usuarios.vencimiento);

  const actividades_vigentes: ActividadVigente[] = actividadesRaw.map((a) => ({
    id: a.id,
    vencimiento: a.vencimiento,
    observaciones: a.observaciones,
    opcion: a.opcion_id
      ? {
          id: a.opcion_id,
          nombre: a.opcion_nombre ?? '',
          url_imagen: a.opcion_url_imagen ?? '',
          descripcion: a.opcion_descripcion ?? null,
        }
      : null,
  }));

  return { perfil, ultima_evaluacion, actividades_vigentes };
};

// ============================================================
// Servicio: Historial de evaluaciones (semáforos y puntajes)
// ============================================================

/**
 * Retorna el historial completo de evaluaciones del estudiante, cada una con
 * sus dimensiones de semáforo, ordenadas de más reciente a más antigua.
 *
 * Precondición: el estudiante debe existir (usa el mismo check que perfil/resumen).
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si el estudiante no existe.
 */
export const getEvaluacionesEstudianteService = async (
  estudianteId: number
): Promise<EvaluacionHistorial[]> => {
  // Valida existencia del estudiante (misma regla que el resto del panel)
  await getPerfilEstudianteService(estudianteId);

  const evaluacionesRaw = await db
    .select({
      id: schema.evaluaciones.id,
      fecha: schema.evaluaciones.fecha,
      puntaje_total: schema.evaluaciones.puntaje_total,
      estado_semaforo: schema.evaluaciones.estado_semaforo,
      subcategoria_principal: schema.evaluaciones.subcategoria_principal,
      observaciones: schema.evaluaciones.observaciones,
    })
    .from(schema.evaluaciones)
    .where(
      and(
        eq(schema.evaluaciones.usuario_id, estudianteId),
        isNull(schema.evaluaciones.deleted_at)
      )
    )
    .orderBy(desc(schema.evaluaciones.fecha));

  if (evaluacionesRaw.length === 0) {
    return [];
  }

  const evaluacionIds = evaluacionesRaw.map((e) => e.id);

  const dimensionesRaw = await db
    .select({
      id: schema.semaforo_dimensiones.id,
      evaluacion_id: schema.semaforo_dimensiones.evaluacion_id,
      dimension: schema.semaforo_dimensiones.dimension,
      puntaje: schema.semaforo_dimensiones.puntaje,
      nivel: schema.semaforo_dimensiones.nivel,
    })
    .from(schema.semaforo_dimensiones)
    .where(
      and(
        inArray(schema.semaforo_dimensiones.evaluacion_id, evaluacionIds),
        isNull(schema.semaforo_dimensiones.deleted_at)
      )
    );

  const dimensionesPorEvaluacion = new Map<number, DimensionSemaforo[]>();
  for (const d of dimensionesRaw) {
    if (d.evaluacion_id === null) continue;
    const lista = dimensionesPorEvaluacion.get(d.evaluacion_id) ?? [];
    lista.push({ id: d.id, dimension: d.dimension, puntaje: d.puntaje, nivel: d.nivel });
    dimensionesPorEvaluacion.set(d.evaluacion_id, lista);
  }

  return evaluacionesRaw.map((e) => ({
    ...e,
    dimensiones: dimensionesPorEvaluacion.get(e.id) ?? [],
  }));
};

// ============================================================
// Servicio: Historial de actividades y vencimientos
// ============================================================

/**
 * Retorna el historial completo de actividades del estudiante (vigentes y
 * vencidas), con su fecha de registro y vencimiento, ordenadas de más
 * reciente a más antigua por vencimiento.
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si el estudiante no existe.
 */
export const getActividadesEstudianteService = async (
  estudianteId: number
): Promise<ActividadHistorial[]> => {
  await getPerfilEstudianteService(estudianteId);

  const ahora = new Date();

  const actividadesRaw = await db
    .select({
      id: schema.registro_actividades_usuarios.id,
      fecha: schema.registro_actividades_usuarios.fecha,
      vencimiento: schema.registro_actividades_usuarios.vencimiento,
      observaciones: schema.registro_actividades_usuarios.observaciones,
      opcion_id: schema.registro_actividades_usuarios.opcion_id,
      opcion_nombre: schema.opciones_registro_actividades.nombre,
      opcion_url_imagen: schema.opciones_registro_actividades.url_imagen,
      opcion_descripcion: schema.opciones_registro_actividades.descripcion,
    })
    .from(schema.registro_actividades_usuarios)
    .leftJoin(
      schema.opciones_registro_actividades,
      eq(
        schema.registro_actividades_usuarios.opcion_id,
        schema.opciones_registro_actividades.id
      )
    )
    .where(
      and(
        eq(schema.registro_actividades_usuarios.usuario_id, estudianteId),
        isNull(schema.registro_actividades_usuarios.deleted_at)
      )
    )
    .orderBy(desc(schema.registro_actividades_usuarios.vencimiento));

  return actividadesRaw.map((a) => ({
    id: a.id,
    fecha: a.fecha,
    vencimiento: a.vencimiento,
    vencida: a.vencimiento < ahora,
    observaciones: a.observaciones,
    opcion: a.opcion_id
      ? {
          id: a.opcion_id,
          nombre: a.opcion_nombre ?? '',
          url_imagen: a.opcion_url_imagen ?? '',
          descripcion: a.opcion_descripcion ?? null,
        }
      : null,
  }));
};

// ============================================================
// Servicio: Estadísticas de registro emocional (Fase 7)
// ============================================================

/**
 * Retorna las estadísticas agregadas de registro emocional del estudiante
 * (promedio general, valor mínimo/máximo, total registros, emociones más frecuentes,
 * registros por semana), reutilizando el servicio especializado.
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si el estudiante no existe.
 */
export const getEstadisticasRegistroEmocionalEstudianteService = async (
  estudianteId: number
) => {
  // Validar existencia del estudiante
  await getPerfilEstudianteService(estudianteId);

  return await getEstadisticasService(estudianteId);
};

// ============================================================
// Servicio: Apertura / Reanudación de Chat (Fase 7)
// ============================================================

export interface AbrirChatResultado {
  chat: typeof schema.chats.$inferSelect;
  reabierto: boolean;
  mensaje: string;
}

/**
 * Abre una nueva sesión de chat o recupera la sesión activa existente
 * entre el psicólogo autenticado y el estudiante.
 *
 * Precondición: la asignación activa ya fue validada por el middleware esPsicologoDeEstudiante.
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si el estudiante no existe.
 */
export const abrirChatPsicologoService = async (
  psicologoId: number,
  estudianteId: number
): Promise<AbrirChatResultado> => {
  // Validar existencia del estudiante
  await getPerfilEstudianteService(estudianteId);

  // Buscar si ya existe un chat activo entre ambos (no IA, no eliminado)
  const [chatActivo] = await db
    .select()
    .from(schema.chats)
    .where(
      and(
        eq(schema.chats.psicologo_id, psicologoId),
        eq(schema.chats.estudiante_id, estudianteId),
        eq(schema.chats.is_active, true),
        eq(schema.chats.isSendByAi, false),
        isNull(schema.chats.deleted_at)
      )
    )
    .orderBy(desc(schema.chats.ultima_actividad))
    .limit(1);

  if (chatActivo) {
    // Actualizar timestamp de última actividad
    const [chatActualizado] = await db
      .update(schema.chats)
      .set({
        ultima_actividad: new Date(),
        updated_at: new Date(),
      })
      .where(eq(schema.chats.id, chatActivo.id))
      .returning();

    return {
      chat: chatActualizado ?? chatActivo,
      reabierto: true,
      mensaje: 'Chat activo recuperado exitosamente',
    };
  }

  // Si no existe chat activo, crear uno nuevo
  const [nuevoChat] = await db
    .insert(schema.chats)
    .values({
      estudiante_id: estudianteId,
      psicologo_id: psicologoId,
      iniciado_en: new Date(),
      ultima_actividad: new Date(),
      isSendByAi: false,
      is_active: true,
    })
    .returning();

  return {
    chat: nuevoChat,
    reabierto: false,
    mensaje: 'Chat iniciado exitosamente',
  };
};

// ============================================================
// Tipos: registro emocional / encuestas / chats (Javier - Fase 7)
// ============================================================

export interface RegistroEmocionalHistorial {
  id: number;
  fecha: Date;
  fecha_dia: string;
  puntaje: number;
  observaciones: string | null;
  pregunta: {
    id: number;
    texto: string;
    categoria: string;
  } | null;
  opcion: {
    id: number;
    nombre: string;
    url_imagen: string;
  } | null;
}

export interface EncuestaRespuestaHistorial {
  id: number;
  fecha: Date;
  respuesta: string | null;
  encuesta: {
    id: number;
    codigo: string;
    titulo: string;
  } | null;
}

export interface MensajeChatHistorial {
  id: number;
  usuario_id: number | null;
  mensaje: string;
  sentimiento: string | null;
  enviado_en: Date;
}

export interface ChatHistorial {
  id: number;
  iniciado_en: Date;
  ultima_actividad: Date;
  finalizado_en: Date | null;
  is_active: boolean;
  mensajes: MensajeChatHistorial[];
}

// ============================================================
// Servicio: Historial de registro emocional
// ============================================================

/**
 * Retorna el historial de registro emocional del estudiante, ordenado
 * cronológicamente (de más antiguo a más reciente), con la pregunta y la
 * opción elegida en cada registro.
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si el estudiante no existe.
 */
export const getRegistroEmocionalEstudianteService = async (
  estudianteId: number
): Promise<RegistroEmocionalHistorial[]> => {
  await getPerfilEstudianteService(estudianteId);

  const registrosRaw = await db
    .select({
      id: schema.registro_emocional.id,
      fecha: schema.registro_emocional.fecha,
      fecha_dia: schema.registro_emocional.fecha_dia,
      puntaje: schema.registro_emocional.puntaje,
      observaciones: schema.registro_emocional.observaciones,
      pregunta_id: schema.preguntas_registro_emocional.id,
      pregunta_texto: schema.preguntas_registro_emocional.texto,
      pregunta_categoria: schema.preguntas_registro_emocional.categoria,
      opcion_id: schema.opciones_registro_emocional.id,
      opcion_nombre: schema.opciones_registro_emocional.nombre,
      opcion_url_imagen: schema.opciones_registro_emocional.url_imagen,
    })
    .from(schema.registro_emocional)
    .leftJoin(
      schema.preguntas_registro_emocional,
      eq(schema.registro_emocional.pregunta_id, schema.preguntas_registro_emocional.id)
    )
    .leftJoin(
      schema.opciones_registro_emocional,
      eq(schema.registro_emocional.opcion_id, schema.opciones_registro_emocional.id)
    )
    .where(
      and(
        eq(schema.registro_emocional.usuario_id, estudianteId),
        isNull(schema.registro_emocional.deleted_at)
      )
    )
    .orderBy(asc(schema.registro_emocional.fecha));

  return registrosRaw.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    fecha_dia: r.fecha_dia,
    puntaje: r.puntaje,
    observaciones: r.observaciones,
    pregunta: r.pregunta_id
      ? { id: r.pregunta_id, texto: r.pregunta_texto ?? '', categoria: r.pregunta_categoria ?? 'general' }
      : null,
    opcion: r.opcion_id
      ? { id: r.opcion_id, nombre: r.opcion_nombre ?? '', url_imagen: r.opcion_url_imagen ?? '' }
      : null,
  }));
};

// ============================================================
// Servicio: Respuestas a encuestas institucionales
// ============================================================

/**
 * Retorna las respuestas del estudiante a encuestas institucionales,
 * de más reciente a más antigua.
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si el estudiante no existe.
 */
export const getEncuestasEstudianteService = async (
  estudianteId: number
): Promise<EncuestaRespuestaHistorial[]> => {
  await getPerfilEstudianteService(estudianteId);

  const respuestasRaw = await db
    .select({
      id: schema.encuestasRespuestas.id,
      fecha: schema.encuestasRespuestas.fecha,
      respuesta: schema.encuestasRespuestas.respuesta,
      encuesta_id: schema.encuestas.id,
      encuesta_codigo: schema.encuestas.codigo,
      encuesta_titulo: schema.encuestas.titulo,
    })
    .from(schema.encuestasRespuestas)
    .leftJoin(
      schema.encuestas,
      eq(schema.encuestasRespuestas.encuesta_id, schema.encuestas.id)
    )
    .where(
      and(
        eq(schema.encuestasRespuestas.usuario_id, estudianteId),
        isNull(schema.encuestasRespuestas.deleted_at)
      )
    )
    .orderBy(desc(schema.encuestasRespuestas.fecha));

  return respuestasRaw.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    respuesta: r.respuesta,
    encuesta: r.encuesta_id
      ? { id: r.encuesta_id, codigo: r.encuesta_codigo ?? '', titulo: r.encuesta_titulo ?? '' }
      : null,
  }));
};

// ============================================================
// Servicio: Historial de conversaciones (chats)
// ============================================================

/**
 * Retorna el historial de chats entre el PSICÓLOGO AUTENTICADO y el
 * estudiante indicado, cada uno con sus mensajes en orden cronológico.
 *
 * Seguridad: se filtra explícitamente por `psicologo_id = psicologoId`
 * además de `estudiante_id`, para que un psicólogo nunca pueda ver
 * conversaciones de ese mismo estudiante con OTRO psicólogo, aunque
 * tenga una asignación activa vigente.
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si el estudiante no existe.
 */
export const getChatsEstudianteService = async (
  estudianteId: number,
  psicologoId: number
): Promise<ChatHistorial[]> => {
  await getPerfilEstudianteService(estudianteId);

  const chatsRaw = await db
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
        eq(schema.chats.estudiante_id, estudianteId),
        eq(schema.chats.psicologo_id, psicologoId),
        isNull(schema.chats.deleted_at)
      )
    )
    .orderBy(desc(schema.chats.iniciado_en));

  if (chatsRaw.length === 0) {
    return [];
  }

  const chatIds = chatsRaw.map((c) => c.id);

  const mensajesRaw = await db
    .select({
      id: schema.mensajes_chat.id,
      chat_id: schema.mensajes_chat.chat_id,
      usuario_id: schema.mensajes_chat.usuario_id,
      mensaje: schema.mensajes_chat.mensaje,
      sentimiento: schema.mensajes_chat.sentimiento,
      enviado_en: schema.mensajes_chat.enviado_en,
    })
    .from(schema.mensajes_chat)
    .where(
      and(
        inArray(schema.mensajes_chat.chat_id, chatIds),
        isNull(schema.mensajes_chat.deleted_at)
      )
    )
    .orderBy(asc(schema.mensajes_chat.enviado_en));

  const mensajesPorChat = new Map<number, MensajeChatHistorial[]>();
  for (const m of mensajesRaw) {
    if (m.chat_id === null) continue;
    const lista = mensajesPorChat.get(m.chat_id) ?? [];
    lista.push({
      id: m.id,
      usuario_id: m.usuario_id,
      mensaje: m.mensaje,
      sentimiento: m.sentimiento,
      enviado_en: m.enviado_en,
    });
    mensajesPorChat.set(m.chat_id, lista);
  }

  return chatsRaw.map((c) => ({
    ...c,
    mensajes: mensajesPorChat.get(c.id) ?? [],
  }));
};
