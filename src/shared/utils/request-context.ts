// Libs
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';

// Contexto de la petición HTTP en curso. Permite saber, desde cualquier servicio
// (sentimiento, Ollama, Groq...), qué endpoint originó una llamada saliente sin
// tener que pasar el `req` por todas las funciones.
interface RequestContext {
  req: Request;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// Etiqueta para peticiones que no coinciden con ninguna ruta (404). Evita que
// URLs arbitrarias de un escáner generen una serie de métricas por cada una.
export const UNMATCHED_ROUTE = 'unmatched';

// Etiqueta para trabajo fuera de una petición HTTP (arranque, WebSocket...).
export const NO_ROUTE = 'none';

// La ruta se etiqueta con su plantilla (/api/users/:id), nunca con la URL real, para
// que el número de series se mantenga acotado por la cantidad de endpoints.
export const resolveRoute = (req: Request): string => {
  if (req.route?.path === undefined) {
    return UNMATCHED_ROUTE;
  }
  return `${req.baseUrl}${String(req.route.path)}`;
};

// Endpoint que está atendiendo el código en ejecución, o NO_ROUTE si no hay petición.
export const currentRoute = (): string => {
  const store = requestContext.getStore();
  return store ? resolveRoute(store.req) : NO_ROUTE;
};
