# Panel Psicólogo — Asignaciones y Directorio

> Estado: **En desarrollo — Fase 4 completada.**
> Última actualización: Fase 4 (Ciclo de aprobación y rechazo).

## Objetivo

Permitir que un estudiante solicite atención psicológica, que un psicólogo gestione las solicitudes dirigidas
a él (aprobar/rechazar), que exista un directorio público de psicólogos sin exponer datos sensibles, y que
cada psicólogo solo pueda ver/gestionar información de sus propios estudiantes asignados.

## Modelo de datos: `asignaciones`

Relaciona un `estudiante` con el `psicólogo` al que le solicitó atención.

| Campo | Tipo | Descripción |
|---|---|---|
| id | serial (PK) | Identificador único |
| estudiante_id | integer (FK → usuarios.id) | Estudiante que solicita atención |
| psicologo_id | integer (FK → usuarios.id) | Psicólogo destinatario de la solicitud |
| estado | varchar | `pendiente` \| `aprobado` \| `rechazado` \| `finalizado` |
| mensaje | text (opcional) | Mensaje del estudiante al solicitar |
| solicitado_en | timestamp | Fecha de creación de la solicitud |
| procesado_en | timestamp (nullable) | Fecha en que el psicólogo aprobó o rechazó |
| finalizado_en | timestamp (nullable) | Fecha en que la asignación aprobada se cerró |
| created_at / updated_at / deleted_at | timestamp | Auditoría y soft delete (convención del proyecto) |

### Reglas de negocio (validadas por el servicio `asignaciones.service.ts`)

- Un estudiante no puede autoasignarse (`estudiante_id !== psicologo_id`).
- No se permite una segunda solicitud **pendiente** al mismo psicólogo.
- No se permite solicitar si el estudiante ya tiene una asignación **aprobada** activa.
- El `psicologo_id` debe corresponder a un usuario con rol `psicologo`, activo y no eliminado.
- Los checks de duplicidad corren dentro de una transacción; el índice único parcial en la tabla es la última
  línea de defensa ante condiciones de carrera (error `23505` de Postgres, manejado explícitamente).

## Directorio público de psicólogos — `GET /api/psicologos`

**Acceso:** requiere autenticación (rol `usuario`).
**Privacidad certificada:** el endpoint **nunca** devuelve `correo` ni `telefono`. Campos expuestos:
`id`, `nombres`, `apellidos`, `especialidad_psicologo`, `ciudad`, `idioma`.

Esto lo diferencia del endpoint `GET /api/admin/psychologists` (exclusivo de administradores), que sí incluye
datos de contacto.

## Ciclo de Vida de una Solicitud (Fase 4)

```
              ┌──────────► aprobado ──────────► finalizado
              │
  (crear) ► pendiente
              │
              └──────────► rechazado
```

### Estados

| Estado | Descripción | Quién lo provoca | Endpoint |
|---|---|---|---|
| `pendiente` | Estado inicial al crear la solicitud | Estudiante | `POST /api/asignaciones/solicitar` |
| `aprobado` | El psicólogo acepta la solicitud | Psicólogo | `PATCH /api/asignaciones/:id/aprobar` |
| `rechazado` | El psicólogo rechaza la solicitud | Psicólogo | `PATCH /api/asignaciones/:id/rechazar` |
| `finalizado` | La asignación aprobada se cierra | Estudiante o Psicólogo | `DELETE /api/asignaciones/:id` |

### Flujo end-to-end

1. **Solicitud.** El estudiante solicita atención con `POST /api/asignaciones/solicitar` (`psicologo_id` +
   `mensaje` opcional). Nace en estado `pendiente`. Se validan las reglas de negocio (autoasignación,
   duplicidad, asignación aprobada existente, psicólogo válido).

2. **Buzón del psicólogo.** El psicólogo consulta `GET /api/asignaciones/psicologo/solicitudes` para ver las
   solicitudes pendientes dirigidas a él.

3. **Decisión del psicólogo:**
   - **Aprobar** — `PATCH /api/asignaciones/:id/aprobar`: cambia el estado a `aprobado` y registra
     `procesado_en`. Desde este momento el estudiante aparece en
     `GET /api/asignaciones/psicologo/mis-pacientes`, y el psicólogo obtiene acceso —a través del guard
     `esPsicologoDeEstudiante`— a las rutas del panel de seguimiento del estudiante
     (`/api/psicologo/pacientes/:estudianteId/...`).
   - **Rechazar** — `PATCH /api/asignaciones/:id/rechazar`: cambia el estado a `rechazado` y registra
     `procesado_en`. El estudiante **no** aparece en `mis-pacientes` y puede volver a solicitar atención (a
     este u otro psicólogo).

4. **Finalización.** Con una asignación `aprobada`, el estudiante o el psicólogo pueden finalizarla con
   `DELETE /api/asignaciones/:id`, lo que cambia el estado a `finalizado` y registra `finalizado_en`. Esto
   libera al estudiante para solicitar una nueva atención.

5. **Historial propio.** El estudiante consulta su propio historial en cualquier momento con
   `GET /api/asignaciones/mis-solicitudes`. Este historial está aislado por estudiante: uno nunca puede ver
   las solicitudes de otro (verificado en Fase 3, caso 9).

## Guard de aislamiento

- **`authorizeUserResource`**: solo el propio usuario o un administrador pueden acceder a un recurso de
  usuario por `:id`. Los psicólogos no tienen acceso libre a perfiles de estudiantes por esta vía.
- **`esPsicologoDeEstudiante`**: exige que exista una asignación con `estado = aprobado` (no eliminada) entre
  el psicólogo autenticado y el estudiante solicitado, antes de autorizar el acceso a las rutas del panel de
  seguimiento (`/api/psicologo/pacientes/:estudianteId/*`). Los administradores tienen acceso global.

## Cobertura de pruebas

### Fase 3 — Matriz de 9 casos sobre `POST /solicitar` y `GET /mis-solicitudes`

| # | Caso | Resultado |
|---|---|---|
| 1 | Solicitud exitosa | 201 ✅ |
| 2 | Autoasignación | 400 ✅ |
| 3 | Duplicada (pendiente repetida) | 400 ✅ |
| 4 | Psicólogo inexistente | 404 ✅ |
| 5 | Ya tiene asignación aprobada | 400 ✅ |
| 6 | Body inválido | 400 ✅ |
| 7 | Sin token | 401 ✅ |
| 8 | Historial propio | 200 ✅ |
| 9 | Aislamiento entre estudiantes | 200 (vacío) ✅ |

### Fase 4 — Ciclo completo de aprobación y rechazo

Ejecutado end-to-end en Postman (carpeta "Panel Psicologo"):

- **Ciclo de aprobación:** solicitar (201) → aparece en buzón del psicólogo (200) → aprobar (200,
  `estado="aprobado"`) → aparece en `mis-pacientes` (200).
- **Ciclo de rechazo:** solicitar con un segundo estudiante (201) → rechazar (200, `estado="rechazado"`) →
  **no** aparece en `mis-pacientes` (200, verificado por exclusión).
- **Finalización:** `DELETE /api/asignaciones/:id` sobre una asignación aprobada (200, `estado="finalizado"`).

Todas las requests están documentadas en la carpeta **"Panel Psicologo"** de la colección de Postman, con
scripts de test automatizados (aserciones de código de estado y de contenido de la respuesta) para cada paso.

## Pendientes / Próximas fases

- Conectar el guard `esPsicologoDeEstudiante` a las rutas de `panel-psicologo.routes.ts` en un flujo de
  pruebas dedicado (ya implementado en código; pendiente de verificación funcional completa).
- Definir si se requiere notificar al estudiante cuando su solicitud es aprobada o rechazada.
- Evaluar si `GET /api/asignaciones/psicologo/mis-pacientes` debe paginarse para psicólogos con muchos
  estudiantes activos.
