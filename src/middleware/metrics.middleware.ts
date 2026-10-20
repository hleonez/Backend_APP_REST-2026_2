// Libs
import { NextFunction, Request, RequestHandler, Response } from 'express';

// Config
import { httpRequestDuration, httpRequestsInFlight, register } from '../config/metrics';

// Etiqueta para peticiones que no coinciden con ninguna ruta (404). Evita que
// URLs arbitrarias de un escáner generen una serie de métricas por cada una.
const UNMATCHED_ROUTE = 'unmatched';

// Estado que usa nginx/Caddy cuando el cliente cierra la conexión antes de la respuesta.
const CLIENT_CLOSED_STATUS = '499';

// La ruta se etiqueta con su plantilla (/api/users/:id), nunca con la URL real, para
// que el número de series se mantenga acotado por la cantidad de endpoints.
const resolveRoute = (req: Request): string => {
  if (req.route?.path === undefined) {
    return UNMATCHED_ROUTE;
  }
  return `${req.baseUrl}${String(req.route.path)}`;
};

export const metricsMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  // El propio scrape de Prometheus no se mide para no contaminar las estadísticas.
  if (req.path === '/metrics') {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  httpRequestsInFlight.inc();

  let recorded = false;
  const record = (statusCode: string): void => {
    if (recorded) {
      return;
    }
    recorded = true;
    httpRequestsInFlight.dec();
    const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    httpRequestDuration.observe(
      { method: req.method, route: resolveRoute(req), status_code: statusCode },
      seconds,
    );
  };

  res.on('finish', () => record(String(res.statusCode)));
  // 'close' sin 'finish' = el cliente cortó la conexión antes de recibir la respuesta.
  res.on('close', () => record(CLIENT_CLOSED_STATUS));

  next();
};

export const metricsHandler: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('Error generando métricas:', error);
    res.status(500).end();
  }
};
