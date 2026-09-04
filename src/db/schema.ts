import { relations, sql } from 'drizzle-orm';
import { pgTable, serial, varchar, integer, timestamp, boolean, text, date, index, uniqueIndex } from 'drizzle-orm/pg-core';

// ================================
// USUARIOS
// ================================

export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),

  id_rol: integer('id_rol')
    .references(() => roles.id, { onDelete: 'set null' }),

  nombres: varchar('nombres', { length: 255 }).notNull(),
  apellidos: varchar('apellidos', { length: 255 }).notNull(),

  correo: varchar('correo', { length: 255 }).unique().notNull(),
  contrasena: varchar('contrasena', { length: 255 }).notNull(),
  
  ciudad: varchar('ciudad', { length: 255 }),
  semestre_actual: varchar('semestre_actual', { length: 255 }),
  telefono: varchar('telefono', { length: 50 }),
  edad: integer('edad'),
  sexo: varchar('sexo', { length: 10 }),
  fecha_nacimiento: date('fecha_nacimiento'),

  idioma: varchar('idioma', { length: 255 }),

  especialidad_psicologo: varchar('especialidad_psicologo', { length: 255 }),

  streak_goal_days: integer('streak_goal_days').default(7).notNull(),
  streak_count: integer('streak_count').default(0).notNull(),
  streak_last_date: date('streak_last_date'),
  streak_goal_set: boolean('streak_goal_set').default(false).notNull(),

  fecha_registro: timestamp('fecha_registro').defaultNow().notNull(),

  is_active: boolean('is_active').default(true).notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxUsuariosIdRol: index('idx_usuarios_id_rol').on(t.id_rol),
}));

export const usuariosrelations = relations(usuarios, ({ one }) => ({
  rol: one(roles, {
    fields: [usuarios.id_rol],
    references: [roles.id],
  }),
}));

// ================================
// ROLES
// ================================

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),

  nombre: varchar('nombre', { length: 255 }).unique().notNull(),
  descripcion: text('descripcion'),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
});

export const rolesrelations = relations(roles, ({ many }) => ({
  usuarios: many(usuarios),
}));

// ================================
// PREGUNTAS Y RESPUESTAS (ej: test personal diario)
// ================================
export const evaluaciones = pgTable('evaluaciones', {
  id: serial('id').primaryKey(),
  usuario_id: integer('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
  fecha: timestamp('fecha').defaultNow().notNull(),
  puntaje_total: integer('puntaje_total'),
  estado_semaforo: varchar('estado_semaforo', { length: 50 }),
  observaciones: text('observaciones'),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxEvaluacionesUsuarioId: index('idx_evaluaciones_usuario_id').on(t.usuario_id),
}));

export const evaluacionesrelations = relations(evaluaciones, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [evaluaciones.usuario_id],
    references: [usuarios.id],
  }),
}));

export const preguntas = pgTable('preguntas', {
  id: serial('id').primaryKey(),
  texto: text('texto').notNull(),
  peso: integer('peso').default(1).notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
});

export const preguntasrelations = relations(preguntas, ({ many }) => ({
  respuestas: many(respuestas),
}));

export const respuestas = pgTable('respuestas', {
  id: serial('id').primaryKey(),

  evaluacion_id: integer('evaluacion_id')
    .references(() => evaluaciones.id, { onDelete: 'set null' }),

  pregunta_id: integer('pregunta_id')
    .references(() => preguntas.id, { onDelete: 'set null' }),

  respuesta: integer('respuesta'),
  puntaje_calculado: integer('puntaje_calculado'),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxRespuestasEvaluacionId: index('idx_respuestas_evaluacion_id').on(t.evaluacion_id),
  idxRespuestasPreguntaId: index('idx_respuestas_pregunta_id').on(t.pregunta_id),
}));

export const respuestasrelations = relations(respuestas, ({ one }) => ({
  pregunta: one(preguntas, {
    fields: [respuestas.pregunta_id],
    references: [preguntas.id],
  }),
  evaluacion: one(evaluaciones, {
    fields: [respuestas.evaluacion_id],
    references: [evaluaciones.id],
  }),
}));

export const evaluacionesRespuestasUsuarios = pgTable('evaluaciones_respuestas_usuarios', {
  id: serial('id').primaryKey(),

  usuario_id: integer('usuario_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  evaluacion_id: integer('evaluacion_id')
    .references(() => evaluaciones.id, { onDelete: 'set null' }),

  respuestas: text('respuestas'), // JSON con las respuestas de la evaluacion
  fecha: timestamp('fecha').defaultNow().notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxEvalRespUsuariosUsuarioId: index('idx_eval_resp_usuarios_usuario_id').on(t.usuario_id),
  idxEvalRespUsuariosEvaluacionId: index('idx_eval_resp_usuarios_evaluacion_id').on(t.evaluacion_id),
}));

export const evaluacionesRespuestasUsuariosrelations = relations(evaluacionesRespuestasUsuarios, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [evaluacionesRespuestasUsuarios.usuario_id],
    references: [usuarios.id],
  }),
  evaluacion: one(evaluaciones, {
    fields: [evaluacionesRespuestasUsuarios.evaluacion_id],
    references: [evaluaciones.id],
  }),
}));

// ================================
// ESTADISTICAS (cómo supiste de mí, ...)
// ================================

export const encuestas = pgTable('encuestas', {
  id: serial('id').primaryKey(),

  codigo: varchar('codigo', { length: 255 }).unique().notNull(),

  titulo: varchar('titulo', { length: 255 }).notNull(),
  opciones: text('opciones'), // JSON con las opciones de la encuesta

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
});

export const encuestasRespuestas = pgTable('encuestas_respuestas', {
  id: serial('id').primaryKey(),

  usuario_id: integer('usuario_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  encuesta_id: integer('encuesta_id')
    .references(() => encuestas.id, { onDelete: 'set null' }),

  respuesta: text('respuesta'), // JSON con la respuesta de la encuesta
  fecha: timestamp('fecha').defaultNow().notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxEncuestasRespuestasUsuarioId: index('idx_encuestas_respuestas_usuario_id').on(t.usuario_id),
  idxEncuestasRespuestasEncuestaId: index('idx_encuestas_respuestas_encuesta_id').on(t.encuesta_id),
}));

export const encuestasRespuestasrelations = relations(encuestasRespuestas, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [encuestasRespuestas.usuario_id],
    references: [usuarios.id],
  }),
  encuesta: one(encuestas, {
    fields: [encuestasRespuestas.encuesta_id],
    references: [encuestas.id],
  }),
}));


// ================================
// REGISTRO EMOCIONAL
// ================================

export const preguntas_registro_emocional = pgTable('preguntas_registro_emocional', {
  id: serial('id').primaryKey(),

  texto: text('texto').notNull(),
  is_active: boolean('is_active').default(true).notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  uqPreguntasRegistroEmocionalTexto: uniqueIndex('uq_preguntas_registro_emocional_texto').on(t.texto),
}));

export const opciones_registro_emocional = pgTable('opciones_registro_emocional', {
  id: serial('id').primaryKey(),

  pregunta_id: integer('pregunta_id')
    .references(() => preguntas_registro_emocional.id, { onDelete: 'set null' }),

  nombre: varchar('nombre', { length: 255 }).notNull(),
  descripcion: text('descripcion'),

  url_imagen: varchar('url_imagen', { length: 255 }).notNull(),

  puntaje: integer('puntaje').notNull(),
  is_active: boolean('is_active').default(true).notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
});

export const registro_emocional = pgTable('registro_emocional', {
  id: serial('id').primaryKey(),

  usuario_id: integer('usuario_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  pregunta_id: integer('pregunta_id')
    .references(() => preguntas_registro_emocional.id, { onDelete: 'set null' }),
  
  opcion_id: integer('opcion_id')
    .references(() => opciones_registro_emocional.id, { onDelete: 'set null' }),

  puntaje: integer('puntaje').default(0).notNull(),

  fecha_dia: date('fecha_dia').default(sql`CURRENT_DATE`).notNull(),
  fecha: timestamp('fecha').defaultNow().notNull(),

  observaciones: text('observaciones'),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxRegistroEmocionalUsuarioId: index('idx_registro_emocional_usuario_id').on(t.usuario_id),
  idxRegistroEmocionalPreguntaId: index('idx_registro_emocional_pregunta_id').on(t.pregunta_id),
  idxRegistroEmocionalOpcionId: index('idx_registro_emocional_opcion_id').on(t.opcion_id),
  uqRegistroEmocionalUsuarioPreguntaFechaDia: uniqueIndex('uq_registro_emocional_usuario_pregunta_fecha_dia')
    .on(t.usuario_id, t.pregunta_id, t.fecha_dia),
}));

export const registro_emocional_usuariosrelations = relations(registro_emocional, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [registro_emocional.usuario_id],
    references: [usuarios.id],
  }),
  pregunta: one(preguntas_registro_emocional, {
    fields: [registro_emocional.pregunta_id],
    references: [preguntas_registro_emocional.id],
  }),
  opcion: one(opciones_registro_emocional, {
    fields: [registro_emocional.opcion_id],
    references: [opciones_registro_emocional.id],
  }),
}));

export const preguntas_registro_emocionalrelations = relations(preguntas_registro_emocional, ({ many }) => ({
  opciones: many(opciones_registro_emocional),
  registros: many(registro_emocional),
}));

export const opciones_registro_emocionalrelations = relations(opciones_registro_emocional, ({ one }) => ({
  pregunta: one(preguntas_registro_emocional, {
    fields: [opciones_registro_emocional.pregunta_id],
    references: [preguntas_registro_emocional.id],
  }),
}));

// ================================
// REGISTRO ACTIVIDADES
// ================================

export const opciones_registro_actividades = pgTable('opciones_registro_actividades', {
  id: serial('id').primaryKey(),

  nombre: varchar('nombre', { length: 255 }).notNull(),
  descripcion: text('descripcion'),

  url_imagen: varchar('url_imagen', { length: 255 }).notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
});

export const registro_actividades_usuarios = pgTable('registro_actividades_usuarios', {
  id: serial('id').primaryKey(),

  usuario_id: integer('usuario_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  opcion_id: integer('opcion_id')
    .references(() => opciones_registro_actividades.id, { onDelete: 'set null' }),

  vencimiento: timestamp('vencimiento').defaultNow().notNull(),
  fecha: timestamp('fecha').defaultNow().notNull(),

  observaciones: text('observaciones'),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxRegistroActividadesUsuariosUsuarioId: index('idx_registro_actividades_usuarios_usuario_id').on(t.usuario_id),
  idxRegistroActividadesUsuariosOpcionId: index('idx_registro_actividades_usuarios_opcion_id').on(t.opcion_id),
}));

export const registro_actividades_usuariosrelations = relations(registro_actividades_usuarios, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [registro_actividades_usuarios.usuario_id],
    references: [usuarios.id],
  }),
  opcion: one(opciones_registro_actividades, {
    fields: [registro_actividades_usuarios.opcion_id],
    references: [opciones_registro_actividades.id],
  }),
}));

// ================================
// PREMIOS Y CANJES
// ================================

export const premios = pgTable('premios', {
  id: serial('id').primaryKey(),

  nombre: varchar('nombre', { length: 255 }).notNull(),
  descripcion: text('descripcion'),
  estrellas_requeridas: integer('estrellas_requeridas').notNull(),

  is_active: boolean('is_active').default(true).notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxPremiosEstrellasRequeridas: index('idx_premios_estrellas_requeridas').on(t.estrellas_requeridas),
  uqPremiosNombre: uniqueIndex('uq_premios_nombre').on(t.nombre),
}));

export const solicitudes_premios = pgTable('solicitudes_premios', {
  id: serial('id').primaryKey(),

  usuario_id: integer('usuario_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  premio_id: integer('premio_id')
    .references(() => premios.id, { onDelete: 'set null' }),

  estado: varchar('estado', { length: 30 }).default('pendiente').notNull(),
  estrellas_requeridas: integer('estrellas_requeridas').notNull(),

  periodo_anio: integer('periodo_anio').notNull(),
  periodo_mes: integer('periodo_mes').notNull(),

  solicitado_en: timestamp('solicitado_en').defaultNow().notNull(),
  procesado_en: timestamp('procesado_en'),
  observaciones: text('observaciones'),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxSolicitudesPremiosUsuarioId: index('idx_solicitudes_premios_usuario_id').on(t.usuario_id),
  idxSolicitudesPremiosPremioId: index('idx_solicitudes_premios_premio_id').on(t.premio_id),
  idxSolicitudesPremiosPeriodo: index('idx_solicitudes_premios_periodo').on(t.periodo_anio, t.periodo_mes),
}));

export const premiosrelations = relations(premios, ({ many }) => ({
  solicitudes: many(solicitudes_premios),
}));

export const solicitudes_premiosrelations = relations(solicitudes_premios, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [solicitudes_premios.usuario_id],
    references: [usuarios.id],
  }),
  premio: one(premios, {
    fields: [solicitudes_premios.premio_id],
    references: [premios.id],
  }),
}));

// ================================
// CHATS
// ================================
export const chats = pgTable('chats', {
  id: serial('id').primaryKey(),

  estudiante_id: integer('estudiante_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  psicologo_id: integer('psicologo_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  iniciado_en: timestamp('iniciado_en').defaultNow().notNull(),
  ultima_actividad: timestamp('ultima_actividad').defaultNow().notNull(),
  finalizado_en: timestamp('finalizado_en'),

  isSendByAi: boolean('isSendByAi').default(false).notNull(),
  
  is_active: boolean('is_active').default(true).notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxChatsEstudianteId: index('idx_chats_estudiante_id').on(t.estudiante_id),
  idxChatsPsicologoId: index('idx_chats_psicologo_id').on(t.psicologo_id),
}));

export const mensajes_chat = pgTable('mensajes_chat', {
  id: serial('id').primaryKey(),

  chat_id: integer('chat_id')
    .references(() => chats.id, { onDelete: 'set null' }),

  usuario_id: integer('usuario_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  mensaje: text('mensaje').notNull(),
  
  enviado_en: timestamp('enviado_en').defaultNow().notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxMensajesChatChatId: index('idx_mensajes_chat_chat_id').on(t.chat_id),
  idxMensajesChatUsuarioId: index('idx_mensajes_chat_usuario_id').on(t.usuario_id),
})); 

export const mensajes_chat_usuariosrelations = relations(mensajes_chat, ({ one }) => ({
  chat: one(chats, {
    fields: [mensajes_chat.chat_id],
    references: [chats.id],
  }),
  usuario: one(usuarios, {
    fields: [mensajes_chat.usuario_id],
    references: [usuarios.id],
  }),
}));

// ================================
// ASIGNACIONES (Estudiante ↔ Psicólogo)
// ================================

export const asignaciones = pgTable('asignaciones', {
  id: serial('id').primaryKey(),

  estudiante_id: integer('estudiante_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  psicologo_id: integer('psicologo_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  estado: varchar('estado', { length: 30 }).default('pendiente').notNull(),
  mensaje: text('mensaje'),

  solicitado_en: timestamp('solicitado_en').defaultNow().notNull(),
  procesado_en: timestamp('procesado_en'),
  finalizado_en: timestamp('finalizado_en'),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxAsignacionesEstudianteId: index('idx_asignaciones_estudiante_id').on(t.estudiante_id),
  idxAsignacionesPsicologoId: index('idx_asignaciones_psicologo_id').on(t.psicologo_id),

  // UNIQUE parcial: máximo 1 asignación activa (aprobada) por estudiante
  uqAsignacionesEstudianteAprobado: uniqueIndex('uq_asignaciones_estudiante_aprobado')
    .on(t.estudiante_id)
    .where(sql`estado = 'aprobado' AND deleted_at IS NULL`),

  // UNIQUE parcial: evitar solicitudes pendientes duplicadas al mismo psicólogo
  uqAsignacionesEstudiantePsicologoPendiente: uniqueIndex('uq_asignaciones_estudiante_psicologo_pendiente')
    .on(t.estudiante_id, t.psicologo_id)
    .where(sql`estado = 'pendiente' AND deleted_at IS NULL`),
}));

export const asignacionesrelations = relations(asignaciones, ({ one }) => ({
  estudiante: one(usuarios, {
    fields: [asignaciones.estudiante_id],
    references: [usuarios.id],
    relationName: 'asignacionesComoEstudiante',
  }),
  psicologo: one(usuarios, {
    fields: [asignaciones.psicologo_id],
    references: [usuarios.id],
    relationName: 'asignacionesComoPsicologo',
  }),
}));

// ================================
// DIARIO
// ================================

export const diario = pgTable('diario', {
  id: serial('id').primaryKey(),

  usuario_id: integer('usuario_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  titulo: varchar('titulo', { length: 255 }).notNull(),
  contenido: text('contenido').notNull(),

  fecha: timestamp('fecha').defaultNow().notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxDiarioUsuarioId: index('idx_diario_usuario_id').on(t.usuario_id),
}));


// ================================
// FEEDBACK
// ================================

export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),

  usuario_id: integer('usuario_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  puntaje: integer('puntaje').notNull(),
  que_mas_te_gusto: text('que_mas_te_gusto').notNull(),
  comentarios: text('comentarios'),

  fecha: timestamp('fecha').defaultNow().notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxFeedbackUsuarioId: index('idx_feedback_usuario_id').on(t.usuario_id),
}));

export const feedbackrelations = relations(feedback, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [feedback.usuario_id],
    references: [usuarios.id],
  }),
}));

// ================================
// FALLAS TECNICAS
// ================================

export const fallas_tecnicas = pgTable('fallas_tecnicas', {
  id: serial('id').primaryKey(),

  usuario_id: integer('usuario_id')
    .references(() => usuarios.id, { onDelete: 'set null' }),

  titulo: varchar('titulo', { length: 255 }).notNull(),
  descripcion: text('descripcion').notNull(),

  fecha: timestamp('fecha').defaultNow().notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
}, (t) => ({
  idxFallasTecnicasUsuarioId: index('idx_fallas_tecnicas_usuario_id').on(t.usuario_id),
}));

export const fallas_tecnicasrelations = relations(fallas_tecnicas, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [fallas_tecnicas.usuario_id],
    references: [usuarios.id],
  }),
}));

// ================================
// TEXTO APLICACIÓN
// ================================

// TERMINOS Y CONDICIONES, PRIVACIDAD, CODIGO DE CONDUCTA, etc.

export const texto_aplicacion = pgTable('texto_aplicacion', {
  id: serial('id').primaryKey(),

  codigo: varchar('codigo', { length: 255 }).unique().notNull(),
  
  titulo: varchar('titulo', { length: 255 }).notNull(),
  texto: text('texto').notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
});