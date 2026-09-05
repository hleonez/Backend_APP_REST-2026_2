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