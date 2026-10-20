// Libs
import { Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

// Registro propio (no el global) para controlar exactamente qué se expone en /metrics.
export const register = new Registry();
register.setDefaultLabels({ app: 'rest-backend' });

// Métricas del proceso Node: CPU, memoria, heap, event loop, GC y file descriptors.
collectDefaultMetrics({ register });

// Duración de cada petición HTTP. Los buckets llegan a 60 s porque el pipeline de
// chat con IA (Ollama + sentimiento) puede tardar mucho más que un endpoint CRUD.
const DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP en segundos',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: DURATION_BUCKETS,
  registers: [register],
});

// Peticiones que el servidor está atendiendo en este momento.
export const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'Peticiones HTTP en curso',
  registers: [register],
});

// Llamadas salientes a servicios externos (sentimiento, Ollama, Groq, OpenRouter,
// Cloudflare AI, R2). `route` es el endpoint que las originó, para ver qué endpoint
// depende de qué servicio y cuál de ellos lo vuelve lento.
// OJO: la etiqueta se llama `dependency` y no `service` porque Prometheus (job `rest`)
// añade su propia etiqueta `service` a todo lo que raspa y sobrescribiría la nuestra.
export const outboundRequestDuration = new Histogram({
  name: 'outbound_request_duration_seconds',
  help: 'Duración de las llamadas a servicios externos en segundos',
  labelNames: ['dependency', 'operation', 'route', 'outcome'] as const,
  buckets: DURATION_BUCKETS,
  registers: [register],
});

// Estado del pool de conexiones a Postgres. `waiting` > 0 de forma sostenida indica
// que las peticiones esperan una conexión libre (pool saturado).
export const registerDbPoolMetrics = (pool: {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}): void => {
  new Gauge({
    name: 'db_pool_connections',
    help: 'Conexiones del pool de Postgres por estado (total, idle, waiting)',
    labelNames: ['state'] as const,
    registers: [register],
    collect() {
      this.set({ state: 'total' }, pool.totalCount);
      this.set({ state: 'idle' }, pool.idleCount);
      this.set({ state: 'waiting' }, pool.waitingCount);
    },
  });
};

// Clientes conectados por WebSocket (Socket.IO) en este momento.
export const registerSocketMetrics = (io: { engine: { clientsCount: number } }): void => {
  new Gauge({
    name: 'socketio_connected_clients',
    help: 'Clientes conectados por Socket.IO',
    registers: [register],
    collect() {
      this.set(io.engine.clientsCount);
    },
  });
};
