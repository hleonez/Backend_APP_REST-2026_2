# Modelo de Datos — Mental Health App

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Motor de BD | PostgreSQL |
| ORM | Drizzle ORM v0.29.4 |
| Validación | Zod v3.22.4 |
| Migraciones | Drizzle Kit |
| Conexión | `pg` (Pool) vía `DATABASE_URL` o variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| Nombre BD | `mental_health_app` |

---

## Convenciones Generales

- **Soft delete**: Todas las tablas incluyen `deleted_at` (timestamp nullable) para borrado lógico.
- **Auditoría**: Todas las tablas incluyen `created_at` y `updated_at` con `defaultNow()`.
- **Claves foráneas**: Usan `ON DELETE SET NULL`, `ON UPDATE NO ACTION`.
- **Idioma del esquema**: Español (nombres de tablas y campos en español).

---

## Diagrama de Entidades y Relaciones

```
roles (1) ---< usuarios (N)
usuarios (1) ---< evaluaciones (N)
usuarios (1) ---< evaluaciones_respuestas_usuarios (N)
usuarios (1) ---< encuestas_respuestas (N)
usuarios (1) ---< registro_emocional (N)
usuarios (1) ---< registro_actividades_usuarios (N)
usuarios (1) ---< solicitudes_premios (N)
usuarios (1) ---< diario (N)
usuarios (1) ---< feedback (N)
usuarios (1) ---< fallas_tecnicas (N)
usuarios (1) ---< chats (estudiante_id) (N)
usuarios (1) ---< chats (psicologo_id) (N)
usuarios (1) ---< mensajes_chat (N)
chats (1) ---< mensajes_chat (N)
evaluaciones (1) ---< respuestas (N)
evaluaciones (1) ---< evaluaciones_respuestas_usuarios (N)
preguntas (1) ---< respuestas (N)
encuestas (1) ---< encuestas_respuestas (N)
preguntas_registro_emocional (1) ---< opciones_registro_emocional (N)
preguntas_registro_emocional (1) ---< registro_emocional (N)
opciones_registro_emocional (1) ---< registro_emocional (N)
opciones_registro_actividades (1) ---< registro_actividades_usuarios (N)
premios (1) ---< solicitudes_premios (N)
```

---

## Descripción de Tablas

### 1. `roles`

Almacena los roles del sistema de usuarios.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `nombre` | `varchar(255)` | NOT NULL, **UNIQUE** | — |
| `descripcion` | `text` | nullable | — |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable (soft delete) | — |

**Datos semilla:**

| ID | Nombre | Descripción |
|---|---|---|
| 1 | `admin` | Administrador del sistema |
| 2 | `psicologo` | Psicólogo |
| 3 | `usuario` | Usuario regular (estudiante) |
| 4 | `moderador` | Moderador / soporte |
| 5 | `invitado` | Invitado (solo lectura) |

---

### 2. `usuarios`

Usuarios del sistema. Pueden ser estudiantes, psicólogos o administradores según su `id_rol`.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `id_rol` | `integer` | FK → `roles.id` | nullable |
| `nombres` | `varchar(255)` | NOT NULL | — |
| `apellidos` | `varchar(255)` | NOT NULL | — |
| `correo` | `varchar(255)` | NOT NULL, **UNIQUE** | — |
| `contrasena` | `varchar(255)` | NOT NULL | — |
| `ciudad` | `varchar(255)` | nullable | — |
| `semestre_actual` | `varchar(255)` | nullable | — |
| `telefono` | `varchar(50)` | nullable | — |
| `edad` | `integer` | nullable | — |
| `sexo` | `varchar(10)` | nullable | — |
| `fecha_nacimiento` | `date` | nullable | — |
| `idioma` | `varchar(255)` | nullable | — |
| `especialidad_psicologo` | `varchar(255)` | nullable (solo psicólogos) | — |
| `fecha_registro` | `timestamp` | NOT NULL | `now()` |
| `is_active` | `boolean` | NOT NULL | `true` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_usuarios_id_rol` sobre `id_rol`

**Relaciones:** N-1 con `roles` vía `id_rol`

---

### 3. `evaluaciones`

Evaluaciones psicológicas que genera el sistema de semáforo emocional. Núcleo del monitoreo de salud mental.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `usuario_id` | `integer` | FK → `usuarios.id` | nullable |
| `fecha` | `timestamp` | NOT NULL | `now()` |
| `puntaje_total` | `integer` | nullable | — |
| `estado_semaforo` | `varchar(50)` | nullable (`verde`, `amarillo`, `rojo`) | — |
| `observaciones` | `text` | nullable | — |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_evaluaciones_usuario_id` sobre `usuario_id`

**Umbrales del semáforo:**

- **Verde** (estable): puntaje < 40
- **Amarillo** (precaución): puntaje ≥ 40 y < 70
- **Rojo** (alerta): puntaje ≥ 70

---

### 4. `preguntas`

Catálogo de preguntas que componen las evaluaciones.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `texto` | `text` | NOT NULL | — |
| `peso` | `integer` | NOT NULL | `1` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

---

### 5. `respuestas`

Respuestas individuales a cada pregunta de una evaluación.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `evaluacion_id` | `integer` | FK → `evaluaciones.id` | nullable |
| `pregunta_id` | `integer` | FK → `preguntas.id` | nullable |
| `respuesta` | `integer` | nullable (escala 1–5) | — |
| `puntaje_calculado` | `integer` | nullable | — |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_respuestas_evaluacion_id`, `idx_respuestas_pregunta_id`

---

### 6. `evaluaciones_respuestas_usuarios`

Almacenamiento alternativo de respuestas de evaluación en formato JSON consolidado.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `usuario_id` | `integer` | FK → `usuarios.id` | nullable |
| `evaluacion_id` | `integer` | FK → `evaluaciones.id` | nullable |
| `respuestas` | `text` | nullable (JSON blob) | — |
| `fecha` | `timestamp` | NOT NULL | `now()` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_eval_resp_usuarios_usuario_id`, `idx_eval_resp_usuarios_evaluacion_id`

---

### 7. `encuestas`

Encuestas personalizadas definidas por administradores.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `codigo` | `varchar(255)` | NOT NULL, **UNIQUE** | — |
| `titulo` | `varchar(255)` | NOT NULL | — |
| `opciones` | `text` | nullable (JSON) | — |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

---

### 8. `encuestas_respuestas`

Respuestas de usuarios a las encuestas.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `usuario_id` | `integer` | FK → `usuarios.id` | nullable |
| `encuesta_id` | `integer` | FK → `encuestas.id` | nullable |
| `respuesta` | `text` | nullable (JSON) | — |
| `fecha` | `timestamp` | NOT NULL | `now()` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_encuestas_respuestas_usuario_id`, `idx_encuestas_respuestas_encuesta_id`

---

### 9. `preguntas_registro_emocional`

Preguntas para el registro emocional diario. Se sembraron inicialmente 20 preguntas.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `texto` | `text` | NOT NULL, **UNIQUE** | — |
| `is_active` | `boolean` | NOT NULL | `true` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índice único:** `uq_preguntas_registro_emocional_texto` sobre `texto`

---

### 10. `opciones_registro_emocional`

Opciones de respuesta tipo escala Likert (0–4) asociadas a cada pregunta del registro emocional.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `pregunta_id` | `integer` | FK → `preguntas_registro_emocional.id` | nullable |
| `nombre` | `varchar(255)` | NOT NULL | — |
| `descripcion` | `text` | nullable | — |
| `url_imagen` | `varchar(255)` | NOT NULL | — |
| `puntaje` | `integer` | NOT NULL (0–4) | — |
| `is_active` | `boolean` | NOT NULL | `true` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Opciones por pregunta:**

| Nombre | Puntaje |
|---|---|
| Muy mal | 0 |
| Mal | 1 |
| Normal | 2 |
| Bien | 3 |
| Excelente | 4 |

---

### 11. `registro_emocional`

Registro diario de respuestas emocionales. Central para el cálculo de rachas y el sistema de estrellas.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `usuario_id` | `integer` | FK → `usuarios.id` | nullable |
| `pregunta_id` | `integer` | FK → `preguntas_registro_emocional.id` | nullable |
| `opcion_id` | `integer` | FK → `opciones_registro_emocional.id` | nullable |
| `puntaje` | `integer` | NOT NULL | `0` |
| `fecha_dia` | `date` | NOT NULL | `CURRENT_DATE` |
| `fecha` | `timestamp` | NOT NULL | `now()` |
| `observaciones` | `text` | nullable | — |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_registro_emocional_usuario_id`, `idx_registro_emocional_pregunta_id`, `idx_registro_emocional_opcion_id`

**Índice único compuesto:** `uq_registro_emocional_usuario_pregunta_fecha_dia` sobre `(usuario_id, pregunta_id, fecha_dia)` — garantiza una respuesta por pregunta por usuario por día.

---

### 12. `opciones_registro_actividades`

Catálogo de actividades predefinidas que los usuarios pueden registrar.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `nombre` | `varchar(255)` | NOT NULL | — |
| `descripcion` | `text` | nullable | — |
| `url_imagen` | `varchar(255)` | NOT NULL | — |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Actividades semilla:**

| Nombre |
|---|
| Meditación guiada |
| Ejercicio físico moderado |
| Respiración profunda |
| Diario reflexivo |
| Relajación muscular progresiva |
| Yoga |
| Escuchar música relajante |
| Lectura |
| Paseo en la naturaleza |
| Conexión social |

---

### 13. `registro_actividades_usuarios`

Registro de actividades realizadas por usuarios. Además se usa como respaldo del sistema de estrellas (cada entrada cuenta como una estrella).

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `usuario_id` | `integer` | FK → `usuarios.id` | nullable |
| `opcion_id` | `integer` | FK → `opciones_registro_actividades.id` | nullable |
| `vencimiento` | `timestamp` | NOT NULL | `now()` |
| `fecha` | `timestamp` | NOT NULL | `now()` |
| `observaciones` | `text` | nullable | — |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_registro_actividades_usuarios_usuario_id`, `idx_registro_actividades_usuarios_opcion_id`

---

### 14. `premios`

Premios canjeables por estrellas. Módulo de gamificación.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `nombre` | `varchar(255)` | NOT NULL, **UNIQUE** | — |
| `descripcion` | `text` | nullable | — |
| `estrellas_requeridas` | `integer` | NOT NULL | — |
| `is_active` | `boolean` | NOT NULL | `true` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_premios_estrellas_requeridas`, `uq_premios_nombre`

**Premios semilla:**

| Nombre | Estrellas Requeridas |
|---|---|
| Snack saludable | 20 |
| Kit antiestrés | 45 |
| Clase de bienestar | 80 |
| Pack premium bienestar | 120 |

---

### 15. `solicitudes_premios`

Solicitudes de canje de premios realizadas por usuarios.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `usuario_id` | `integer` | FK → `usuarios.id` | nullable |
| `premio_id` | `integer` | FK → `premios.id` | nullable |
| `estado` | `varchar(30)` | NOT NULL | `'pendiente'` |
| `estrellas_requeridas` | `integer` | NOT NULL | — |
| `periodo_anio` | `integer` | NOT NULL | — |
| `periodo_mes` | `integer` | NOT NULL | — |
| `solicitado_en` | `timestamp` | NOT NULL | `now()` |
| `procesado_en` | `timestamp` | nullable | — |
| `observaciones` | `text` | nullable | — |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_solicitudes_premios_usuario_id`, `idx_solicitudes_premios_premio_id`, `idx_solicitudes_premios_periodo` sobre `(periodo_anio, periodo_mes)`

**Estados posibles:** `pendiente`, `aprobado`, `rechazado`

**Sistema de estrellas:** Las estrellas se calculan como el conteo de registros en `registro_actividades_usuarios` durante el mes actual. Las estrellas reservadas son la suma de `estrellas_requeridas` de todas las solicitudes en estado `pendiente` o `aprobado`.

---

### 16. `chats`

Canales de chat que conectan estudiantes con psicólogos o con la IA "NOA".

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `estudiante_id` | `integer` | FK → `usuarios.id` | nullable |
| `psicologo_id` | `integer` | FK → `usuarios.id` | nullable |
| `iniciado_en` | `timestamp` | NOT NULL | `now()` |
| `ultima_actividad` | `timestamp` | NOT NULL | `now()` |
| `finalizado_en` | `timestamp` | nullable | — |
| `isSendByAi` | `boolean` | NOT NULL | `false` |
| `is_active` | `boolean` | NOT NULL | `true` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_chats_estudiante_id`, `idx_chats_psicologo_id`

**Nota:** Tanto `estudiante_id` como `psicologo_id` referencian la misma tabla `usuarios` (auto-referencia).

---

### 17. `mensajes_chat`

Mensajes individuales dentro de un chat.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `chat_id` | `integer` | FK → `chats.id` | nullable |
| `usuario_id` | `integer` | FK → `usuarios.id` | nullable |
| `mensaje` | `text` | NOT NULL | — |
| `enviado_en` | `timestamp` | NOT NULL | `now()` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_mensajes_chat_chat_id`, `idx_mensajes_chat_usuario_id`

---

### 18. `diario`

Diario personal del usuario para registrar pensamientos y reflexiones.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `usuario_id` | `integer` | FK → `usuarios.id` | nullable |
| `titulo` | `varchar(255)` | NOT NULL | — |
| `contenido` | `text` | NOT NULL | — |
| `fecha` | `timestamp` | NOT NULL | `now()` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_diario_usuario_id`

---

### 19. `feedback`

Retroalimentación enviada por los usuarios sobre la aplicación.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `usuario_id` | `integer` | FK → `usuarios.id` | nullable |
| `puntaje` | `integer` | NOT NULL (1–5) | — |
| `que_mas_te_gusto` | `text` | NOT NULL | — |
| `comentarios` | `text` | nullable | — |
| `fecha` | `timestamp` | NOT NULL | `now()` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_feedback_usuario_id`

---

### 20. `fallas_tecnicas`

Reportes de fallas técnicas o bugs enviados por los usuarios.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `usuario_id` | `integer` | FK → `usuarios.id` | nullable |
| `titulo` | `varchar(255)` | NOT NULL | — |
| `descripcion` | `text` | NOT NULL | — |
| `fecha` | `timestamp` | NOT NULL | `now()` |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Índices:** `idx_fallas_tecnicas_usuario_id`

---

### 21. `texto_aplicacion`

Almacena contenido textual dinámico de la aplicación: términos y condiciones, políticas de privacidad, código de conducta, técnicas de relajación, etc.

| Campo | Tipo | Restricciones | Por Defecto |
|---|---|---|---|
| `id` | `serial` | PK | auto-increment |
| `codigo` | `varchar(255)` | NOT NULL, **UNIQUE** | — |
| `titulo` | `varchar(255)` | NOT NULL | — |
| `texto` | `text` | NOT NULL | — |
| `created_at` | `timestamp` | NOT NULL | `now()` |
| `updated_at` | `timestamp` | NOT NULL | `now()` |
| `deleted_at` | `timestamp` | nullable | — |

**Códigos conocidos:** `TECNICAS_RELAX`, `code_of_conduct`, `privacy_policy`, `terms`

---

## Resumen de Índices

### Índices B-tree

| Tabla | Nombre del Índice | Columnas |
|---|---|---|
| `usuarios` | `idx_usuarios_id_rol` | `id_rol` |
| `evaluaciones` | `idx_evaluaciones_usuario_id` | `usuario_id` |
| `respuestas` | `idx_respuestas_evaluacion_id` | `evaluacion_id` |
| `respuestas` | `idx_respuestas_pregunta_id` | `pregunta_id` |
| `evaluaciones_respuestas_usuarios` | `idx_eval_resp_usuarios_usuario_id` | `usuario_id` |
| `evaluaciones_respuestas_usuarios` | `idx_eval_resp_usuarios_evaluacion_id` | `evaluacion_id` |
| `encuestas_respuestas` | `idx_encuestas_respuestas_usuario_id` | `usuario_id` |
| `encuestas_respuestas` | `idx_encuestas_respuestas_encuesta_id` | `encuesta_id` |
| `registro_emocional` | `idx_registro_emocional_usuario_id` | `usuario_id` |
| `registro_emocional` | `idx_registro_emocional_pregunta_id` | `pregunta_id` |
| `registro_emocional` | `idx_registro_emocional_opcion_id` | `opcion_id` |
| `registro_actividades_usuarios` | `idx_registro_actividades_usuarios_usuario_id` | `usuario_id` |
| `registro_actividades_usuarios` | `idx_registro_actividades_usuarios_opcion_id` | `opcion_id` |
| `premios` | `idx_premios_estrellas_requeridas` | `estrellas_requeridas` |
| `solicitudes_premios` | `idx_solicitudes_premios_usuario_id` | `usuario_id` |
| `solicitudes_premios` | `idx_solicitudes_premios_premio_id` | `premio_id` |
| `solicitudes_premios` | `idx_solicitudes_premios_periodo` | `(periodo_anio, periodo_mes)` |
| `chats` | `idx_chats_estudiante_id` | `estudiante_id` |
| `chats` | `idx_chats_psicologo_id` | `psicologo_id` |
| `mensajes_chat` | `idx_mensajes_chat_chat_id` | `chat_id` |
| `mensajes_chat` | `idx_mensajes_chat_usuario_id` | `usuario_id` |
| `diario` | `idx_diario_usuario_id` | `usuario_id` |
| `feedback` | `idx_feedback_usuario_id` | `usuario_id` |
| `fallas_tecnicas` | `idx_fallas_tecnicas_usuario_id` | `usuario_id` |

### Índices Únicos

| Tabla | Nombre del Índice | Columnas |
|---|---|---|
| `preguntas_registro_emocional` | `uq_preguntas_registro_emocional_texto` | `texto` |
| `registro_emocional` | `uq_registro_emocional_usuario_pregunta_fecha_dia` | `(usuario_id, pregunta_id, fecha_dia)` |
| `premios` | `uq_premios_nombre` | `nombre` |

### Restricciones UNIQUE (sin índice explícito en Drizzle)

| Tabla | Columna |
|---|---|
| `usuarios` | `correo` |
| `roles` | `nombre` |
| `encuestas` | `codigo` |
| `texto_aplicacion` | `codigo` |

---

## Autenticación JWT

| Propiedad | Valor |
|---|---|
| Secreto | `JWT_SECRET` (variable de entorno) |
| Expiración | 24 horas |
| Payload | `{ id: number, correo: string, role: RoleNombre }` |
| Roles | `admin`, `psicologo`, `usuario`, `moderador`, `invitado` |

---

## Archivos Relevantes

| Propósito | Ruta |
|---|---|
| Esquema completo de la BD (21 tablas) | `src/db/schema.ts` |
| Conexión y configuración de Drizzle ORM | `src/db/index.ts` |
| Script de migraciones | `src/db/migrate.ts` |
| Datos semilla | `src/db/seed.ts` |
| Migraciones SQL generadas | `drizzle/` |
| Configuración de Drizzle Kit | `drizzle.config.ts` |
| Configuración JWT | `src/config/jwt.ts` |
| Tipos de roles | `src/shared/types/roles.types.ts` |
| Constantes de roles | `src/shared/const/roles.const.ts` |
| Tipos de API | `src/shared/types/api.types.ts` |
| Diagrama de clases (Draw.io) | `diagrama_clases.drawio` |
| Configuración Docker | `docker-compose.yml` |
