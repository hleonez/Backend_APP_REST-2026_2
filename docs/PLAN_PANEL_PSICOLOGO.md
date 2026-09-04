# PLAN DE TRABAJO — Panel Web de Psicólogo y Flujo de Asignación

> **Proyecto:** REST App — Salud Mental
> **Periodo de Ejecución:** 4 de septiembre de 2026 — 15 de septiembre de 2026
> **Tecnologías:** Node.js, Express, TypeScript, PostgreSQL, Drizzle ORM, Docker, Postman, Swagger/OpenAPI

---

## 1. Definición del Equipo y Roles

| Integrante | Rol Principal | Responsabilidades Clave |
|---|---|---|
| **Samuel** | Arquitectura y Seguridad | Modelo de datos en Drizzle ORM y migraciones. Middleware `esPsicologoDeEstudiante`. Code Review y soporte técnico. |
| **Javier** | Desarrollador Backend | Endpoints del Directorio de Psicólogos. Flujo de Solicitudes y Buzón. Consulta de actividades, evaluaciones y encuestas. |
| **Mariana** | QA y Documentación | Suite de pruebas en Postman. Verificación de privacidad y casos borde. Documentación técnica y Swagger. |

---

## 2. Objetivos del Sprint

1. **Modelo de Asignaciones:** Tabla N:N en PostgreSQL con restricciones únicas parciales.
2. **Flujo de Asignación:** Estudiante busca psicólogos y solicita atención; psicólogo gestiona buzón (aprobar/rechazar).
3. **Aislamiento de Privacidad:** Acceso del psicólogo restringido a sus pacientes asignados (`esPsicologoDeEstudiante`).
4. **Protección de Datos Sensibles:** Diarios, feedback y fallas técnicas 100% excluidos del panel.
5. **Entregables de Integración:** Swagger actualizado + colección Postman verificada para Frontend.

---

## 3. Cronograma de Trabajo por Fases

### SEMANA 1: Cimientos, Base de Datos y Flujo de Asignación

---

### FASE 1: Kick-off y Modelo de Datos

**Sam:**
- Modificación de `src/db/schema.ts` para crear la tabla `asignaciones`.
- Configuración de índices parciales (`UNIQUE estudiante_id WHERE estado = 'aprobado'` y `UNIQUE estudiante_id, psicologo_id WHERE estado = 'pendiente'`).
- Ejecución de migraciones: `npm run db:generate` y `npm run db:migrate`.

**Javier:**
- Configuración del entorno local y familiarización con `src/controllers/` y `src/routes/`.
- Creación de constantes de estado (`pendiente`, `aprobado`, `rechazado`, `finalizado`) en `src/shared/const/asignacion.const.ts`.

**Mariana:**
- Importación de la colección de Postman actual.
- Creación de carpeta "Panel Psicólogo - Asignaciones".
- Borrador de `docs/PANEL_PSICOLOGO.md`.

> **Entregable:** Base de datos migrada con la tabla `asignaciones` lista.

---

### FASE 2: Directorio y Guard de Seguridad

**Sam:**
- Middleware `esPsicologoDeEstudiante` en `src/middleware/authorization.middleware.ts`.
- Refactorización de `authorizeUserResource` para revocar accesos indebidos del psicólogo.

**Javier:**
- `src/controllers/psicologos.controller.ts` y rutas:
  - `GET /api/psicologos` — lista pública (sin correo ni teléfono).
  - `GET /api/psicologos/:id` — detalle del profesional.

**Mariana:**
- Pruebas Postman para `GET /api/psicologos`.
- Validación: no se filtran correos ni teléfonos.

> **Entregable:** Directorio público funcional + guard de aislamiento.

---

### FASE 3: Solicitudes del Estudiante

**Javier (Apoyo de Sam):**
- `src/services/asignaciones.service.ts` y `src/controllers/asignaciones.controller.ts`.
- `POST /api/asignaciones/solicitar` — validación de autoasignación y duplicados.
- `GET /api/asignaciones/mis-solicitudes` — historial del estudiante.

**Sam:**
- Depuración de `user.routes.ts`: eliminar permisos del rol psicólogo para listar/crear/eliminar usuarios.
- Acompañamiento técnico a Javier.

**Mariana:**
- Pruebas: solicitud exitosa (201), duplicidad (400), autoasignación (400).

> **Entregable:** El estudiante puede solicitar atención psicológica.

---

### FASE 4: Buzón del Psicólogo

**Javier:**
- `GET /api/asignaciones/psicologo/solicitudes` — pendientes dirigidas al psicólogo.
- `PATCH /api/asignaciones/:id/aprobar` — actualiza a `aprobado`, finaliza relaciones anteriores.
- `PATCH /api/asignaciones/:id/rechazar` — actualiza a `rechazado` con `procesado_en`.
- `GET /api/asignaciones/psicologo/mis-pacientes` — estudiantes activos a cargo.

**Sam:**
- Revisión de lógica de concurrencia al aprobar.
- Endpoint de finalización/cancelación `DELETE /api/asignaciones/:id`.

**Mariana:**
- Pruebas del flujo completo de aprobación y rechazo.
- Documentación del ciclo de vida en `docs/PANEL_PSICOLOGO.md`.

> **Entregable:** Ciclo completo solicitud → aprobación.

---

### FASE 5: Checkpoint y Validación

**Todo el equipo:**
- Prueba integral: Registro → Login → Directorio → Solicitud → Aprobación → Verificación BD.
- Retrospectiva técnica (15 min).

> **Entregable:** Hito 1 completado.

---

### SEMANA 2: Panel de Consulta, Aislamiento de Privacidad y Entrega

---

### FASE 6: Endpoints Base del Paciente

**Sam:**
- `src/controllers/panel-psicologo.controller.ts` con rutas protegidas: `authenticate` + `isPsicologo` + `esPsicologoDeEstudiante`.
- `GET /api/psicologo/pacientes/:estudianteId/resumen` — ficha consolidada.
- `GET /api/psicologo/pacientes/:estudianteId/perfil` — datos generales.

**Javier:**
- `GET /api/psicologo/pacientes/:estudianteId/evaluaciones` — historial semáforos/puntajes.
- `GET /api/psicologo/pacientes/:estudianteId/actividades` — actividades y vencimientos.

**Mariana:**
- Pruebas del guard: psicólogo no asignado → `403 Forbidden`.
- Inicio de documentación JSDoc / Swagger.

> **Entregable:** Panel inicial con aislamiento verificado.

---

### FASE 7: Estadísticas, Chats y Privacidad Estricta

**Sam:**
- `GET .../registro-emocional/estadisticas` — reutiliza `estadisticas-registro-emocional.service.ts`.
- `POST .../chat` — apertura de chat validando asignación activa.

**Javier:**
- `GET .../registro-emocional` — registros cronológicos.
- `GET .../encuestas` — respuestas a encuestas institucionales.
- `GET .../chats` — historial de conversaciones.

**Mariana (Auditoría de Privacidad):**
- Verificación: ninguna respuesta expone diario, feedback, fallas técnicas ni solicitudes de premios.

> **Entregable:** Panel completo + privacidad blindada.

---

### FASE 8: Swagger y Postman Final

**Mariana:**
- Anotaciones JSDoc `@swagger` en archivos de rutas.
- Verificación visual en Swagger UI.
- Colección Postman organizada con variables de entorno.

**Javier:**
- Corrección de bugs reportados por QA.
- Validación de códigos HTTP (200, 201, 400, 403, 404).

**Sam:**
- Actualización de `docs/modelo-datos.md`.
- Revisión de `docs/PANEL_PSICOLOGO.md`.

> **Entregable:** API documentada + colección de pruebas al 100%.

---

### FASE 9: Estabilización

**Todo el equipo:**
- Ejecución del Checklist de Validación.
- Prueba de estrés de roles:
  - Usuario regular → panel → **403**.
  - Psicólogo ajeno → paciente de otro → **403**.
  - Estudiante con relación finalizada → nueva solicitud → **Permitido**.

**Sam:**
- `npm run build` → cero errores TypeScript.
- Pull Request final hacia `main`/`develop`.

> **Entregable:** Build estable.

---

### FASE 10: Entrega Oficial

- Demostración final del flujo integrado.
- Entrega de documentación y colección Postman al equipo de Frontend.
- Cierre de la feature.

---

## 4. Checklist de Validación (Criterios de Aceptación)

- [ ] **Autenticación:** Todo endpoint del panel requiere token JWT válido.
- [ ] **Aislamiento:** Psicólogo → paciente no asignado → `403 Forbidden`.
- [ ] **Unicidad:** Máximo 1 asignación `aprobado` por estudiante.
- [ ] **Duplicados:** No se permite solicitud `pendiente` duplicada al mismo psicólogo.
- [ ] **Autoasignación:** `estudiante_id !== psicologo_id` → `400 Bad Request`.
- [ ] **Privacidad:** Ningún endpoint expone: Diario, Feedback, Fallas Técnicas, Solicitudes de Premios.
- [ ] **Directorio:** Lista de psicólogos no expone correos ni teléfonos.
- [ ] **Compilación:** `npm run build` → sin errores.

---

## 5. Resumen del Cronograma

| Fase | Enfoque | Entregable |
|---|---|---|
| Fase 1 | Kick-off y modelo de datos | BD migrada con tabla `asignaciones` |
| Fase 2 | Directorio y seguridad | Directorio público + guard |
| Fase 3 | Solicitudes del estudiante | Solicitud de atención funcional |
| Fase 4 | Buzón del psicólogo | Ciclo solicitud → aprobación |
| Fase 5 | Checkpoint | Hito 1 validado |
| Fase 6 | Endpoints base del paciente | Panel inicial + aislamiento |
| Fase 7 | Estadísticas, chats y privacidad | Panel completo + privacidad |
| Fase 8 | Swagger y Postman | API documentada |
| Fase 9 | Estabilización | Build estable |
| Fase 10 | Entrega oficial | Feature cerrada |

---

## 6. Decisiones Técnicas Confirmadas

| Decisión | Detalle |
|---|---|
| Relations de `usuarios` | **Opción 1:** Solo se agregan las relations de `asignaciones` con `relationName`. NO se modifican las relations existentes de `usuarios` ni `chats`. Queries se harán con joins manuales si es necesario. |
| Índices parciales | Se incluye `AND deleted_at IS NULL` para respetar soft delete. |
| Validación `estudiante_id !== psicologo_id` | Se implementa en el servicio, no como CHECK constraint en BD. |
| Middleware de aislamiento | Nuevo middleware `esPsicologoDeEstudiante` que consulta tabla `asignaciones` con `estado = 'aprobado'`. |
| Privacidad | Tablas `diario`, `feedback`, `fallas_tecnicas`, `solicitudes_premios` **nunca** se exponen en el panel del psicólogo. |
