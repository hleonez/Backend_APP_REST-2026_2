# Módulo OVA (Objetos Virtuales de Aprendizaje)

Informe de flujo, arquitectura y tecnologías. Rama: `feature/OVA-Moudule`.

## 1. Objetivo del módulo

Incorporar un **catálogo de actividades y recursos de bienestar** (videos en YouTube,
recursos en Cloudflare R2 o URLs externas) que se **asignan automáticamente** a cada
estudiante según su perfil emocional (semáforo + dimensiones de la evaluación),
y que permite **medir la efectividad** de cada actividad comparando una evaluación
pre y una post.

## 2. Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `drizzle/0008_ovas.sql` | Migración de las 3 tablas del módulo |
| `src/shared/const/ova.const.ts` | Constantes: tipos de actividad, fuentes de storage, estados, cooldowns, dimensiones y niveles |
| `src/routes/ova.routes.ts` | Rutas para el estudiante (`/api/ovas`) |
| `src/routes/ova-psicologo.routes.ts` | Rutas de gestión para el psicólogo (`/api/psicologo/ovas`) |
| `src/controllers/ova/ova-estudiante.controller.ts` | Controlador del estudiante |
| `src/controllers/ova/ova-psicologo.controller.ts` | Controlador del psicólogo (catálogo, reglas, reportes, lectura clínica) |
| `src/services/ova/rule-assignment-engine.service.ts` | Motor de reglas que asigna OVAs |
| `src/services/ova/effectiveness-evaluator.service.ts` | Enlace de post-test y reportes de efectividad |
| `src/services/ova/follow-up-feedback.service.ts` | Ciclo de vida de la asignación y feedback |
| `src/services/ova/storage-uri-resolver.service.ts` | Validación y resolución de URLs (YouTube/R2/Externo) |

## 3. Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/db/schema.ts` | +3 tablas y sus relaciones Drizzle |
| `src/index.ts` | Registro de `ovaRoutes` y `ovaPsicologoRoutes` |
| `src/controllers/evaluacion.controller.ts` | Al crear evaluación: enlaza post-test y dispara el motor de OVAs |
| `src/controllers/asignacion-semaforo.controller.ts` | Dispara el motor de OVAs al asignar semáforo |
| `src/routes/panel-psicologo.routes.ts` | Endpoint de historial de OVAs por paciente |
| `drizzle/meta/_journal.json` | Registro de la migración `0008_ovas` |

## 4. Modelo de datos

### `ovas` — catálogo
`id`, `creado_por` (FK usuarios), `titulo`, `descripcion`, `tipo_actividad`
(`video` | `respiracion` | `ejercicio_practico`), `duracion_minutos`,
`storage_source` (`YOUTUBE` | `CLOUDFLARE_R2` | `EXTERNAL_URL`), `resource_url`,
`is_active`, timestamps y `deleted_at` (soft delete).

### `ova_reglas` — reglas de asignación
`id`, `ova_id` (FK), `creado_por`, `dimension`, `nivel`, `prioridad`, `is_active`,
`deleted_at`. Constraints:
- `CHECK (dimension IS NOT NULL OR nivel IS NOT NULL)`
- Índice único parcial `(ova_id, dimension, nivel)` donde `deleted_at IS NULL` (evita reglas duplicadas).

### `ova_asignaciones` — asignaciones + feedback + efectividad
`id`, `estudiante_id` (FK), `ova_id` (FK), `regla_id` (FK), `pre_evaluacion_id` (FK),
`post_evaluacion_id` (FK opcional), `estado`, snapshot del match
(`matched_dimension`, `matched_nivel`, `matched_subcategoria`, `prioridad`),
seguimiento (`started_at`, `completed_at`, `liked`, `rating`, `feedback_en`) y
efectividad (`pre_puntaje`, `post_puntaje`, `delta_puntaje`,
`pre_estado_semaforo`, `post_estado_semaforo`). Índices relevantes:
- único parcial `(estudiante_id, ova_id)` mientras `estado IN ('PENDING','IN_PROGRESS')` (evita duplicados activos)
- índice parcial de post-tests pendientes.

## 5. Flujo end-to-end

```
[PSICÓLOGO]
  crea OVA (tipo + storage + URL validada)
  define REGLAS (dimension y/o nivel + prioridad)
        │
        ▼
[ESTUDIANTE] completa una EVALUACIÓN (o se asigna semáforo)
        │
        ▼
RuleAssignmentEngine.run()
 1. lee reglas activas de OVAs activos
 2. matchea reglas vs dimensiones/nivel de esa evaluación
 3. aplica cooldowns y bloqueos de duplicados
 4. ordena por prioridad y toma máx. 3 (1 por OVA)
 5. inserta asignaciones en estado PENDING
        │
        ▼
[ESTUDIANTE] ve asignaciones → inicia (IN_PROGRESS) → completa (COMPLETED + liked/rating)
                                            └→ omite (SKIPPED | DISMISSED)
        │
        ▼
Al completar, se exige POST-TEST (nueva evaluación con ova_asignacion_id)
        │
        ▼
EffectivenessEvaluator.enlazarPostTest()
  delta = post_puntaje - pre_puntaje   (delta < 0 ⇒ mejoría)
        │
        ▼
[PSICÓLOGO] consulta reportes de efectividad y lectura clínica del paciente
```

### Reglas de negocio clave
- **Estados:** `PENDING → IN_PROGRESS → COMPLETED` (terminal) | `SKIPPED` | `DISMISSED`.
- **Cooldowns** (`ova.const.ts`): `COMPLETED` 14 días; `SKIPPED`/`DISMISSED` 7 días.
- **Máximo** `OVA_MAX_ASIGNACIONES_POR_EVALUACION = 3` por evaluación, 1 por OVA (mayor prioridad).
- **Match:** si la regla define dimensión sin nivel, dispara en `amarillo`/`rojo`; si define solo nivel, compara contra el semáforo global.
- **Idempotencia:** la inserción tolera el error `23505` (unique_violation) por concurrencia.

## 6. Endpoints

### Estudiante — `/api/ovas` (auth: usuario)
- `GET /asignaciones` — activas (PENDING/IN_PROGRESS + COMPLETED sin post-test)
- `GET /asignaciones/:id` — detalle con recurso resuelto
- `PATCH /asignaciones/:id/iniciar` — PENDING → IN_PROGRESS
- `POST /asignaciones/:id/completar` — body `{ liked, rating? }`; responde si requiere post-test
- `POST /asignaciones/:id/omitir` — body `{ estado: SKIPPED | DISMISSED }`

### Psicólogo — `/api/psicologo/ovas` (auth: psicólogo)
- Catálogo: `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `PATCH /:id/estado`, `DELETE /:id`
- Reglas: `GET /:id/reglas`, `POST /:id/reglas`, `PATCH /reglas/:reglaId`, `DELETE /reglas/:reglaId`
- Reportes: `GET /efectividad` (global), `GET /:id/efectividad` (por OVA)
- Lectura clínica: `GET /pacientes/:estudianteId/ovas` (middleware `esPsicologoDeEstudiante`); también expuesto en `/api/psicologo/pacientes/:estudianteId/ovas`

## 7. Tecnologías y patrones

- **Runtime/lenguaje:** Node.js + TypeScript.
- **API:** Express 4.
- **Persistencia:** PostgreSQL con **Drizzle ORM** (`drizzle-kit`), migraciones SQL versionadas + soft delete.
- **Validación:** **Zod** en todos los controladores.
- **Autenticación/autorización:** JWT + middlewares `authenticate`, `isUsuario`, `isPsicologo`, `esPsicologoDeEstudiante`.
- **Documentación:** **swagger-jsdoc** + **swagger-ui-express** (bloques JSDoc en las rutas).
- **Almacenamiento de recursos:** YouTube (embed con `youtube-nocookie`), Cloudflare R2 (URL pública vía `R2_PUBLIC_BASE_URL`), URL externa.
- **Patrones de diseño:** Controller–Service, motor de reglas basado en datos, snapshots de match, cooldown/idempotencia, soft delete.

## 8. Puntos de integración

- `evaluacion.controller.ts` (`crearEvaluacion`): acepta `ova_asignacion_id` opcional, enlaza post-test y ejecuta el motor; devuelve `ovas_asignados` y `post_test_enlazado`.
- `asignacion-semaforo.controller.ts`: ejecuta el motor tras recalcular el semáforo y añade `ovas_asignados` a la respuesta.

## 9. Observaciones / pendientes sugeridos

- `StorageUriResolver.resolve` genera `watch_url` con un typo: `https://www.youtube.com/watch?v=v=${id}` (doble `v=`). Corregir a `?v=${id}`.
- El motor corre de forma "best-effort": los errores se registran y devuelven `[]`, sin revertir la evaluación. Confirmar si se desea transacción atómica (`tx` ya está soportado en la firma de `run`).
- La migración no crea FK explícita para `matched_*` (correcto, son snapshots), pero conviene documentar que `post_evaluacion_id` se enlaza obligatoriamente vía `ova_asignacion_id` en la evaluación.
- No hay pruebas automatizadas del módulo; se sugiere cubrir el motor de reglas (match, cooldown, límite de 3) y el cálculo de delta.
- Al compartir con el compañero: el contrato de datos del frontend está en `follow-up-feedback.service.ts` (listarAsignaciones / detalle) y en los DTOs de efectividad.
