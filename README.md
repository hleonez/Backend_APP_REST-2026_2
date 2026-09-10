# Backend - Mental Health App
Aplicación de evaluación de salud mental con sistema de semáforo (verde, amarillo, rojo) que permite conectar usuarios con psicólogos en caso de alerta.

## Características
- Sistema de semáforo para evaluación de salud mental
- Conexión con psicólogos mediante WebSockets en caso de alerta roja
- Autenticación con JWT
- Integración con OpenAI para análisis de respuestas
- Persistencia de datos con PostgreSQL y Drizzle ORM
- Implementado en TypeScript y Express.js
- Dockerizado para fácil despliegue

## Estructura de carpetas
```
├── drizzle/                 # Migraciones de Drizzle ORM
├── src/
│   ├── config/              # Configuración de la aplicación (JWT)
│   ├── controllers/         # Controladores de API
│   ├── db/                  # Configuración de base de datos y esquemas
│   ├── middleware/          # Middleware de autenticación
│   ├── models/              # Modelos de datos (vacío)
│   ├── routes/              # Rutas de la API
│   ├── services/            # Servicios (OpenAI, etc.)
│   ├── utils/               # Utilidades (vacío)
│   ├── websocket/           # Implementación de WebSockets
│   └── index.ts             # Punto de entrada
├── dist/                    # Código compilado
├── sentiment/               # Microservicio de análisis de sentimiento (Python)
├── Dockerfile               # Configuración de Docker
├── docker-compose.yml       # Configuración de Docker Compose
├── docker-compose.dev.yml   # Override solo para desarrollo (expone puertos internos)
├── drizzle.config.ts        # Configuración de Drizzle ORM
└── package.json             # Dependencias
```

## Requisitos
- Tener Docker instalado en el sistema. Se recomienda docker desktop https://www.docker.com/products/docker-desktop/

## Luego de tener docker (recomendado docker desktop) instalado
- Esto instala y descarga todo (puede demorar un poco dependiendo de la conexión a internet)
```bash
docker compose up -d --build
```

- Verficia que todos esté corriendo correctamente
```bash
docker compose ps
```
- Debería mostrar algo así en consola:
NAME                               IMAGE                       SERVICE    PORTS
backend_app_semillero-app-1        backend_app_semillero-app   app        0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
backend_app_semillero-ollama-1     ollama/ollama:latest        ollama     0.0.0.0:11434->11434/tcp, [::]:11434->11434/tcp
backend_app_semillero-postgres-1   postgres:14                 postgres   0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp

- Y finalmente, para seguir los logs de la aplicación en tiempo real
```bash
docker compose logs -f app
```
- Debería mostrar algo así:
app-1  | Modelo qwen2.5:0.5b descargado exitosamente
app-1  | Ollama inicializado correctamente
app-1  | Ollama initialized successfully
app-1  | Server is running on port 3000
app-1  | Health check available at http://localhost:3000/health
app-1  | AI Chat available at http://localhost:3000/api/chats/ia

- ADICIONAL PERO RECOMENDADO:
Hacer 'npm install' para que el editor de código no de error en todas las importaciones

### Servicios y puertos
- App (API): `3000` → `http://localhost:3000`
- Ollama: `11434` → `http://localhost:11434`
- Postgres: `5433` en la máquina (mapeado a `5432` en el contenedor) -> se pone en el puerto 5433 por si la máquina ya tiene postgres instalado este por defecto usa el 5432,
así no hay conflicto, esto se puede cambiar a usar el 5434 o 5435 según se necesite.
- Sentiment (microservicio de sentimiento): `8000` → solo expuesto en desarrollo (ver sección "Servicio de sentimiento")

Las variables se definen en `docker-compose.yml`, esto por simplicidad de desarrollo, pero en producción se debe modificar eso para cargarla desde un .env por seguridad.

## Servicio de sentimiento

Microservicio Python (FastAPI + pysentimiento/RoBERTuito) que clasifica el sentimiento de un texto en `NEG`, `NEU` o `POS`.

- **Imagen**: se construye desde `sentiment/` (`python:3.10-slim`).
- **Puerto interno**: `8000`. **No se expone al host en producción**; solo mediante el override de desarrollo.
- **Modelo**: se descarga de HuggingFace en la primera arrancada (~500MB) y se cachea en el volumen `hf_cache` (sobrevive a recreaciones del contenedor).
- **Primera arrancada**: el healthcheck queda en estado `starting` (start_period 60s) hasta que se descarga el modelo y el servicio responde `GET /health`.

### Uso en desarrollo local (expone puerto 8000 para pruebas)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build sentiment
```

### Uso en producción (VPS, sin exponer el puerto)

```bash
docker compose up -d --build
# Verifica que sentiment no aparece con puerto expuesto:
docker compose ps
```

### Prueba de validación

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"texto":"Hoy me fue súper mal en el parcial 😭"}'
```
Debe devolver algo como:
```JSON
{"label": "NEG", "scores": {"NEG": 0.97, "NEU": 0.02, "POS": 0.01}}
```

### Variables de entorno
- `SENTIMENT_API_URL`: URL del microservicio. En Docker Compose se resuelve a `http://sentiment:8000`. Para desarrollo local fuera de Docker apunta a `http://localhost:8000`.
- `TRANSFORMERS_CACHE`: dentro del contenedor apunta al volumen `hf_cache`.

## Fase 8: Flujo de pruebas end-to-end

Esta sección documenta cómo probar la Fase 8 completa: microservicio de sentimiento, chatbot IA con sentimiento persistido, onboarding y encuesta adaptativa. Todos los endpoints, campos y respuestas descritos existen en el código (`src/routes/`, `src/controllers/`, `src/services/`, `sentiment/`).

### 0) Obtener un token JWT

Los endpoints de chat y registro emocional exigen autenticación. Se usa el flujo real de `POST /api/auth/register` y `POST /api/auth/login`.

```bash
# Registro (campos obligatorios según registerSchema en auth.controller.ts)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombres": "Samuel",
    "apellidos": "León",
    "correo": "samuel@example.com",
    "contrasena": "password123",
    "telefono": "3001234567",
    "ciudad": "Bogotá",
    "edad": 20
  }'
```

```bash
# Login (para reutilizar el token)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo": "samuel@example.com", "contrasena": "password123"}'
```

Ambos devuelven `{ "message": "...", "user": { ... }, "token": "<JWT>" }`. Usa ese token como cabecera `Authorization: Bearer <token>` en todos los pasos siguientes.

### A) Iniciar y verificar el microservicio de sentimiento

El servicio es una app FastAPI en `sentiment/` que escucha en el puerto `8000` (ver `sentiment/Dockerfile` y `sentiment/app/main.py`).

Opción 1 — Docker (override de desarrollo que expone el puerto 8000):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build sentiment
docker compose ps sentiment
```

Opción 2 — Sin Docker (la imagen se construye desde `python:3.10-slim`, pero basta con Python 3.10+ y las dependencias de `sentiment/requirements.txt`):

```bash
cd sentiment
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Comprobar que responde:

```bash
# Health (GET /health)
curl http://localhost:8000/health
# {"status":"ok"}

# Análisis de sentimiento (POST /analyze, body: {"texto": "..."})
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"texto":"Hoy me fue súper mal en el parcial 😭"}'
# {"label":"NEG","scores":{"NEG":0.97,"NEU":0.02,"POS":0.01}}
```

La primera arrancada tarda (~60s) porque descarga el modelo RoBERTuito de HuggingFace; en Docker el healthcheck pega a `GET /health` con `start_period` de 60s (ver `docker-compose.yml`).

### B) Enviar un mensaje al chatbot y verificar que el sentimiento queda almacenado

Endpoint real: `POST /api/chats/ia`.

```bash
curl -X POST http://localhost:3000/api/chats/ia \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"mensaje":"No he podido dormir por culpa de los parciales"}'
```

Respuesta esperada (HTTP 201, envoltura `APISuccessResponse`):

```json
{
  "success": true,
  "message": "Chat completado exitosamente",
  "data": {
    "usuario_id": 1,
    "chat_id": 1,
    "mensaje_usuario": "No he podido dormir por culpa de los parciales",
    "respuesta_ia": "...",
    "timestamp": "...",
    "requiere_salvavidas": false,
    "nivel_alerta": "normal",
    "coincidencias_alerta": [],
    "chat_salvavidas_id": null,
    "psicologo_asignado_id": null,
    "mensaje_sistema": null
  },
  "errors": null
}
```

El mensaje del usuario se guarda en `mensajes_chat` con las columnas `sentimiento`, `confianza` y `sentimiento_scores` (ver `src/db/schema.ts`, líneas 518-520). Estas columnas no se devuelven en el historial de chat (`GET /api/chats/ia/historial` devuelve `id`, `mensaje`, `enviado_en`), así que se verifican directamente en Postgres:

```bash
docker compose exec postgres psql -U postgres -d mental_health_app -c \
  "SELECT id, mensaje, sentimiento, confianza, sentimiento_scores
   FROM mensajes_chat
   WHERE usuario_id = <TU_USUARIO_ID> AND sentimiento IS NOT NULL
   ORDER BY id DESC LIMIT 2;"
```

Se debe ver `sentimiento` igual a `NEG`, `NEU` o `POS`; `confianza` como número; y `sentimiento_scores` como `{"NEG":..., "NEU":..., "POS":...}`. En los logs de la app (`docker compose logs -f app`) aparecerá `[NOA DEBUG] Sentimiento label=...;confianza=...;origen=...`.

Nota sobre el fallback: si el servicio no responde en 2s, `analizarSentimiento` (`src/services/sentimiento.service.ts`) devuelve un fallback seguro `{ label: "NEU", confianza: 0, scores: {"NEG":0, "NEU":1, "POS":0}, origen: "fallback" }` y el chatbot continúa sin romperse.

### C) Completar el onboarding

El onboarding no es un endpoint independiente: es un estado del flujo del chatbot. Se determina en `chatConIAUnificado` (`src/controllers/chat.controller.ts`) con `onboarding_base.length === 0`, donde `onboarding_base` son las dimensiones de la última evaluación del usuario (`obtenerDimensionesUltimaEvaluacion` en `src/services/contexto-bienestar.service.ts`). Mientras el usuario no tenga ninguna `evaluaciones`, el chatbot responde en modo onboarding e invita a "evaluar tu estado emocional".

Para completarlo se usa el flujo real de evaluación:

1) Obtener las preguntas (endpoint público `GET /api/evaluaciones/preguntas`):

```bash
curl http://localhost:3000/api/evaluaciones/preguntas
# [{"id":1,"texto":"...","peso":1,"created_at":"...","updated_at":"...","deleted_at":null}]
```

2) Enviar la evaluación con las respuestas (`POST /api/evaluaciones`) — `respuesta` va de 1 a 5:

```bash
curl -X POST http://localhost:3000/api/evaluaciones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "respuestas": [
      {"pregunta_id": 1, "respuesta": 4},
      {"pregunta_id": 2, "respuesta": 3}
    ],
    "observaciones": "Estoy manejando mejor el estrés"
  }'
```

Respuesta esperada (201): `message`, `evaluacion` (con `puntaje_total`, `estado_semaforo`, `subcategoria_principal` y `dimensiones`) y `analisis`.

3) (Opcional) Asignar el semáforo (`POST /api/evaluaciones/asignacion-semaforo`); el body `{"puntaje_manual": <0-100>}` es opcional:

```bash
curl -X POST http://localhost:3000/api/evaluaciones/asignacion-semaforo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{}'
# 200: { "message": "...", "data": { "usuario_id": 1, "estado_semaforo": "verde|amarillo|rojo", "puntaje_total": ..., "subcategoria_principal": ..., "dimensiones": [...], "evaluacion": { ... } } }
```

Verificación: vuelve a enviar un mensaje a `POST /api/chats/ia`. Con al menos una evaluación creada, `onboarding_base.length > 0` y el chatbot deja el modo onboarding. También se puede confirmar la evaluación en Postgres:

```bash
docker compose exec postgres psql -U postgres -d mental_health_app -c \
  "SELECT id, puntaje_total, estado_semaforo, subcategoria_principal
   FROM evaluaciones WHERE usuario_id = <TU_USUARIO_ID> ORDER BY id DESC LIMIT 1;"
```

### D) Ejecutar la encuesta adaptativa

No existe un endpoint "iniciar encuesta": primero se obtienen preguntas adaptativas (según la dimensión dominante del usuario) y luego se guardan las respuestas.

1) Obtener las preguntas adaptativas (`GET /api/registro-emocional/preguntas`):

```bash
curl http://localhost:3000/api/registro-emocional/preguntas \
  -H "Authorization: Bearer <token>"
```

Respuesta esperada (200): `APISuccessResponse` cuyo `data` es un arreglo de 5 preguntas, cada una con `id`, `texto`, `categoria`, `is_active`, `created_at`, `updated_at` y `opciones` (cada opción con `id`, `nombre`, `descripcion`, `url_imagen`, `puntaje`, `is_active`).

2) Por cada pregunta devuelta, escoger el `id` de una de sus `opciones`.

3) Guardar las respuestas (`POST /api/registro-emocional`) — `usuario_id` debe coincidir con el usuario del token y cada `opcion_id` debe pertenecer a su `pregunta_id`:

```bash
curl -X POST http://localhost:3000/api/registro-emocional \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "usuario_id": 1,
    "respuestas": [
      {"pregunta_id": 1, "opcion_id": 3},
      {"pregunta_id": 2, "opcion_id": 7},
      {"pregunta_id": 3, "opcion_id": 11},
      {"pregunta_id": 4, "opcion_id": 14},
      {"pregunta_id": 5, "opcion_id": 18}
    ]
  }'
```

Respuesta esperada (201, `APISuccessResponse`):

```json
{
  "success": true,
  "message": "Respuestas de registro emocional guardadas",
  "data": {
    "usuario_id": 1,
    "fecha_dia": "2026-09-09",
    "registro_del_dia": true,
    "total_puntaje": 16,
    "respuestas_guardadas": 5,
    "respuestas": [ ... ]
  },
  "errors": null
}
```

Códigos de error reales: `400` body inválido, `403` si `usuario_id` no coincide con el token y `409` si ya se completó el test emocional del día.

## Base de datos (Drizzle ORM)

### Migraciones automáticas al iniciar
La imagen de la app ejecuta `node dist/db/migrate.js` en el arranque, por lo que al levantar con Docker Compose se aplican migraciones automáticamente.

### Migración inicial (cuando no existe la carpeta `drizzle/`)
Para crear la carpeta `drizzle/` y el primer SQL **en tu proyecto local**, ejecuta:
```bash
npm run db:generate
```
Luego levanta Docker:
```bash
docker compose up -d --build
```

### Flujo recomendado cuando se cambia el esquema de drizzle, es decir, cuando se quiere hacer alguna modificación a la base de datos
Ejecuta un único comando para generar y aplicar migraciones:
```bash
docker compose exec app npm run db:deploy
```

### Comandos útiles (manuales)
```bash
# Generar + aplicar migraciones en un solo paso
docker compose exec app npm run db:deploy

# Aplicar migraciones manualmente (opcional)
docker compose exec app npm run db:migrate

# Correr seeders (data inicial)
docker compose exec app npm run db:seed
```

## Ollama
```bash
curl http://localhost:11434/api/tags
```
Devuelve algo así:
```JSON
{
  "models": [
    {
      "name": "qwen2.5:0.5b",
      "model": "qwen2.5:0.5b",
      "modified_at": "2026-03-13T12:12:11.697068223Z",
      "size": 397821319,
      "digest": "a8b0c51577010a279d933d14c2a8ab4b268079d44c5c8830c0a93900f1827c67",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "qwen2",
        "families": [
          "qwen2"
        ],
        "parameter_size": "494.03M",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

## Manejo de errores
```bash
docker compose ps # ver todos los contenedores corriendo
docker compose logs -f postgres # Ver logs de postgres
docker compose logs -f app # Ver logs de la app (api)
docker compose restart app # Reiniciar la api

# Reset total (borra datos) - También se puede hacer desde docker desktop borrando todo y volviendo a hacer 'docker compose up -d --build' en la consola
docker compose down -v
docker compose up -d --build
```

## GitHub Actions (CI + convención de ramas)
El repositorio usa GitHub Actions para validar el build en cada Pull
Request y para mantener `develop` sincronizada con `main` después de cada
release. La convención de ramas es:

```
feature/*  -->  develop   (todo el trabajo nuevo)
develop    -->  main      (release)
main       -->  develop   (PR automático que se autofusiona -auto-merge-
                            en cuanto pasan los checks, sin intervención
                            manual y sin reescribir historia)
```

Ver la guía completa de activación (permisos, protección de ramas, checks
obligatorios) en [`docs/github-actions.md`](docs/github-actions.md).