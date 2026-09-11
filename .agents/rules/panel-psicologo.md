# Regla: Panel de Psicólogo — Contexto Obligatorio

Este proyecto está ejecutando actualmente el **Plan de Trabajo del Panel Web de Psicólogo** (4–15 sept 2026). Antes de implementar cualquier cambio relacionado con:

- Asignaciones estudiante ↔ psicólogo
- Directorio de psicólogos
- Panel del psicólogo
- Middleware de aislamiento (`esPsicologoDeEstudiante`)
- Privacidad de datos del estudiante

**DEBES** consultar el plan completo en `docs/PLAN_PANEL_PSICOLOGO.md` para entender el contexto, las fases, las decisiones confirmadas y quién es responsable de cada tarea.

## Decisiones Técnicas Fijas (no modificar sin confirmación del usuario)

1. **Relations de Drizzle**: Solo agregar relations de `asignaciones` con `relationName`. NO modificar `usuariosrelations` ni relations de `chats`.
2. **Soft delete en índices parciales**: Los índices UNIQUE parciales incluyen `AND deleted_at IS NULL`.
3. **Validación `estudiante_id !== psicologo_id`**: Se realiza en el servicio, NO con CHECK constraint en BD.
4. **Privacidad estricta**: Las tablas `diario`, `feedback`, `fallas_tecnicas` y `solicitudes_premios` NUNCA se exponen en endpoints del panel del psicólogo.
5. **Directorio público**: `GET /api/psicologos` excluye `correo` y `telefono` de la respuesta.
6. **Guard de aislamiento**: Todo endpoint del panel usa la cadena `authenticate` → `isPsicologo` → `esPsicologoDeEstudiante`.

## Estructura de Archivos del Panel

| Archivo | Propósito |
|---|---|
| `src/db/schema.ts` | Tabla `asignaciones` (Fase 1 — Sam) |
| `src/shared/const/asignacion.const.ts` | Estados: pendiente, aprobado, rechazado, finalizado (Fase 1 — Javier) |
| `src/middleware/authorization.middleware.ts` | Middleware `esPsicologoDeEstudiante` (Fase 2 — Sam) |
| `src/controllers/psicologos.controller.ts` | Directorio público de psicólogos (Fase 2 — Javier) |
| `src/services/asignaciones.service.ts` | Lógica de negocio de asignaciones (Fase 3 — Javier) |
| `src/controllers/asignaciones.controller.ts` | Endpoints de solicitud y buzón (Fases 3-4 — Javier) |
| `src/controllers/panel-psicologo.controller.ts` | Consulta de pacientes asignados (Fase 6 — Sam) |
| `docs/PANEL_PSICOLOGO.md` | Documentación técnica del panel (Mariana) |

## Equipo

- **Samuel**: Arquitectura, seguridad, modelo de datos, code review
- **Javier**: Endpoints backend (directorio, solicitudes, buzón, consultas)
- **Mariana**: QA (Postman), documentación (Swagger), auditoría de privacidad
