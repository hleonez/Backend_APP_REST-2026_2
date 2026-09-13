# Panel Psicólogo — Asignaciones, Directorio y Consulta de Pacientes

> Estado: **Fase 8 Completada — Swagger y Postman Final al 100%.**  
> Última actualización: Fase 8 (Documentación OpenAPI/Swagger completa, colección Postman con 100% de cobertura y aislamiento de datos validado).

---

## 1. Objetivo General

Permitir que un estudiante consulte el directorio de profesionales y solicite atención psicológica, que un psicólogo gestione su buzón de solicitudes (aprobar/rechazar) y consulte a sus pacientes asignados, garantizando un aislamiento estricto de datos privados y médicos a través de guards de autorización en cascada.

---

## 2. Modelo de Datos: `asignaciones`

Relaciona un `estudiante` con el `psicólogo` al que le solicitó atención.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `serial` | PK | Identificador único de la asignación |
| `estudiante_id` | `integer` | FK → `usuarios.id` | Estudiante que solicita atención |
| `psicologo_id` | `integer` | FK → `usuarios.id` | Psicólogo destinatario de la solicitud |
| `estado` | `varchar(30)` | NOT NULL (def: `'pendiente'`) | `pendiente` \| `aprobado` \| `rechazado` \| `finalizado` |
| `mensaje` | `text` | nullable | Mensaje opcional del estudiante al solicitar |
| `solicitado_en` | `timestamp` | NOT NULL (def: `now()`) | Fecha de creación de la solicitud |
| `procesado_en` | `timestamp` | nullable | Fecha en que el psicólogo aprobó o rechazó |
| `finalizado_en` | `timestamp` | nullable | Fecha en que la asignación aprobada se cerró |
| `created_at` | `timestamp` | NOT NULL (def: `now()`) | Registro de auditoría |
| `updated_at` | `timestamp` | NOT NULL (def: `now()`) | Registro de auditoría |
| `deleted_at` | `timestamp` | nullable | Borrado lógico (soft delete) |

### Restricciones e Índices Parciales (PostgreSQL)

1. `uq_asignaciones_estudiante_aprobado`:  
   `UNIQUE (estudiante_id) WHERE estado = 'aprobado' AND deleted_at IS NULL`  
   → Garantiza un máximo de **1 asignación activa** por estudiante.
2. `uq_asignaciones_estudiante_psicologo_pendiente`:  
   `UNIQUE (estudiante_id, psicologo_id) WHERE estado = 'pendiente' AND deleted_at IS NULL`  
   → Previene solicitudes pendientes duplicadas al mismo psicólogo.
3. Índices de búsqueda: `idx_asignaciones_estudiante_id` e `idx_asignaciones_psicologo_id`.

### Reglas de Negocio (Validadas en `asignaciones.service.ts`)

- **Prohibición de autoasignación:** `estudiante_id !== psicologo_id` (retorna `400 Bad Request`).
- **Validación de rol destinatario:** `psicologo_id` debe pertenecer a un usuario con rol `psicologo`, activo y no eliminado (retorna `404 Not Found` si no existe o no es psicólogo).
- **Control de estado previo:** No se permite solicitar si el estudiante ya tiene una asignación activa en estado `aprobado` (retorna `400 Bad Request`).
- **Manejo de concurrencia:** Manejo explícito del código de error Postgres `23505` (violación de índice único).

---

## 3. Directorio Público de Psicólogos

Permite a los estudiantes autenticados explorar los profesionales disponibles.

| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/psicologos` | Rol `usuario` (`authenticate`) | Lista pública de psicólogos activos |
| `GET` | `/api/psicologos/:id` | Rol `usuario` (`authenticate`) | Perfil detallado del psicólogo |

### Política de Privacidad del Directorio
El directorio público **nunca expone datos de contacto sensibles**:
- **Campos retornados:** `id`, `nombres`, `apellidos`, `especialidad_psicologo`, `ciudad`, `idioma`.
- **Campos bloqueados/omitidos:** `correo`, `telefono`, `contrasena`.  
*(Nota: El endpoint administrativo `GET /api/admin/psychologists` es exclusivo para administradores y sí incluye datos de contacto).*

---

## 4. Ciclo de Vida de las Asignaciones

```
              ┌──────────► aprobado ──────────► finalizado
              │
  (crear) ► pendiente
              │
              └──────────► rechazado
```

### Endpoints del Ciclo de Asignación

| Método | Endpoint | Rol Requerido | Descripción |
|---|---|---|---|
| `POST` | `/api/asignaciones/solicitar` | `usuario` | Estudiante solicita atención psicológica a un psicólogo |
| `GET` | `/api/asignaciones/mis-solicitudes` | `usuario` | Estudiante consulta su historial de solicitudes |
| `GET` | `/api/asignaciones/psicologo/solicitudes` | `psicologo` | Psicólogo consulta buzón de solicitudes pendientes |
| `PATCH` | `/api/asignaciones/:id/aprobar` | `psicologo` | Psicólogo aprueba una solicitud pendiente dirigida a él |
| `PATCH` | `/api/asignaciones/:id/rechazar` | `psicologo` | Psicólogo rechaza una solicitud pendiente dirigida a él |
| `DELETE` | `/api/asignaciones/:id` | `usuario` / `psicologo` | Cierra/finaliza una asignación aprobada activa |
| `GET` | `/api/asignaciones/psicologo/mis-pacientes` | `psicologo` | Psicólogo lista los estudiantes con asignación aprobada activa |

---

## 5. Endpoints de Consulta y Seguimiento de Pacientes (Panel)

Rutas base: `/api/psicologo/pacientes/:estudianteId/*`  
**Cadena de seguridad compartida:** `authenticate` → `isPsicologo` → `esPsicologoDeEstudiante`.

| Método | Endpoint | Guard | Descripción |
|---|---|---|---|
| `GET` | `/api/psicologo/pacientes/:estudianteId/perfil` | `esPsicologoDeEstudiante` | Datos demográficos y generales del estudiante (sin teléfono ni correo) |
| `GET` | `/api/psicologo/pacientes/:estudianteId/resumen` | `esPsicologoDeEstudiante` | Ficha clínica consolidada (perfil + última evaluación con semáforo y 7 dimensiones + actividades vigentes) |
| `GET` | `/api/psicologo/pacientes/:estudianteId/evaluaciones` | `esPsicologoDeEstudiante` | Historial completo de evaluaciones psicológicas, puntajes, semáforos y desglose de dimensiones |
| `GET` | `/api/psicologo/pacientes/:estudianteId/actividades` | `esPsicologoDeEstudiante` | Historial de actividades realizadas, vigentes y vencidas |
| `GET` | `/api/psicologo/pacientes/:estudianteId/registro-emocional/estadisticas` | `esPsicologoDeEstudiante` | Métricas estadísticas agregadas (promedio de bienestar, puntaje mín/máx, frecuencias y distribución de estados) |
| `GET` | `/api/psicologo/pacientes/:estudianteId/registro-emocional` | `esPsicologoDeEstudiante` | Registros emocionales diarios ordenados cronológicamente |
| `GET` | `/api/psicologo/pacientes/:estudianteId/encuestas` | `esPsicologoDeEstudiante` | Historial de respuestas a encuestas institucionales del estudiante |
| `POST` | `/api/psicologo/pacientes/:estudianteId/chat` | `esPsicologoDeEstudiante` | Apertura o recuperación del canal de chat con el estudiante validando asignación activa |
| `GET` | `/api/psicologo/pacientes/:estudianteId/chats` | `esPsicologoDeEstudiante` | Historial de conversaciones de chat entre el psicólogo autenticado y el estudiante |

---

## 6. Seguridad y Blindaje de Privacidad

### 6.1 Cadena de Middlewares y Guards

1. **`authenticate`:** Verifica la firma y vigencia del JWT (`Authorization: Bearer <token>`) y que el usuario se encuentre activo (`is_active = true`).
2. **`isPsicologo`:** Exige que `req.user.role === 'psicologo'`.
3. **`esPsicologoDeEstudiante`:** Verifica que exista un registro en `asignaciones` con:
   - `estudiante_id = :estudianteId`
   - `psicologo_id = req.user.id`
   - `estado = 'aprobado'`
   - `deleted_at IS NULL`  
   *Si no existe una relación aprobada activa, retorna inmediatamente `403 Forbidden`.* (Los administradores cuentan con bypass de auditoría).
4. **`authorizeUserResource`:** Impide que los psicólogos accedan a perfiles de usuarios mediante endpoints genéricos de usuario (`/api/usuarios/:id`).

### 6.2 Matriz de Exclusión de Datos Confidenciales

Para cumplir con las normas de privacidad y ética clínica, los siguientes recursos del estudiante están **estrictamente excluidos** del panel del psicólogo:

| Recurso / Tabla | Estado de Acceso | Motivo |
|---|---|---|
| `diario` | 🚫 **Bloqueado (100% privado)** | Espacio personal e íntimo de autorreflexión del estudiante |
| `feedback` | 🚫 **Bloqueado** | Evaluaciones sobre la plataforma institucional |
| `fallas_tecnicas` | 🚫 **Bloqueado** | Reportes técnicos gestionados por administradores |
| `solicitudes_premios` | 🚫 **Bloqueado** | Módulo de gamificación y canjes ajeno al tratamiento clínico |
| `telefono` y `correo` | 🚫 **Oculto en panel y directorio** | Prevención de contacto no autorizado por fuera de los canales oficiales |

---

## 7. Documentación y Pruebas (Fase 8)

### 7.1 OpenAPI / Swagger UI

Todos los endpoints del Panel de Psicólogo, Directorio y Asignaciones cuentan con anotaciones JSDoc `@swagger` completas, incluyendo:
- Tags organizados: `Psicologos`, `Asignaciones`, `PanelPsicologo`.
- Parámetros de ruta y esquemas de payload.
- Respuestas HTTP tipadas (`200`, `201`, `400`, `401`, `403`, `404`, `500`).
- Esquema de seguridad `bearerAuth`.

> **URL de Swagger UI:** `http://localhost:3000/api-docs`

### 7.2 Colección de Pruebas en Postman (100% de Cobertura)

La colección `Mental-Health-App-Testing.postman_collection.json` incluye la carpeta **"Panel Psicologo"** con suites de tests automáticos:

| Suite / Flujo | Casos Verificados | Resultado |
|---|---|---|
| **Directorio de Psicólogos** | Listado público, detalle por ID, omisión de correo y teléfono | 200 ✅ |
| **Solicitudes (Fase 3)** | Solicitud exitosa (201), autoasignación (400), duplicada (400), psicólogo inexistente (404), historial propio (200), aislamiento entre estudiantes (200 vacío) | 100% ✅ |
| **Buzón y Ciclo (Fase 4)** | Consulta de pendientes (200), aprobación con transición (200), rechazo con transición (200), finalización (200), lista `mis-pacientes` (200) | 100% ✅ |
| **Panel de Pacientes (Fases 6 y 7)** | Perfil (200), resumen consolidado (200), evaluaciones y 7 dimensiones (200), actividades vigentes/vencidas (200), estadísticas emocionales (200), registro emocional cronológico (200), encuestas (200), abrir chat (200), listar chats (200) | 100% ✅ |
| **Aislamiento y Guards (Fases 7 y 8)** | Intento de acceso de psicólogo no asignado a paciente ajeno (`403 Forbidden`), intento de usuario regular (`403 Forbidden`), ausencia de token (`401 Unauthorized`) | 100% ✅ |

---

## 8. Hitos Siguientes

- **Fase 9: Estabilización** — Validación de compilación sin errores (`npm run build`), pruebas de estrés de permisos y verificación de integridad referencial.
- **Fase 10: Entrega Oficial** — Handoff al equipo de Frontend con la colección de Postman y la especificación OpenAPI/Swagger lista para consumo en el cliente web/móvil.
