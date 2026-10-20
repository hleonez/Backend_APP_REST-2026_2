// Libs
import { Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

// Registro propio (no el global) para controlar exactamente qué se expone en /metrics.
export const register = new Registry();
register.setDefaultLabels({ app: 'rest-backend' });

// Métricas del proceso Node: CPU, memoria, heap, event loop, GC y file descriptors.
collectDefaultMetrics({ register });

// Duración de cada petición HTTP. Los buckets llegan a 60 s porque el pipeline de
// chat con IA (Ollama + sentimiento) puede tardar mucho más que un endpoint CRUD.
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP en segundos',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

// Peticiones que el servidor está atendiendo en este momento.
export const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'Peticiones HTTP en curso',
  registers: [register],
});
