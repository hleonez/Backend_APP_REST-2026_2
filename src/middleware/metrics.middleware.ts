// Libs
import { NextFunction, Request, RequestHandler, Response } from 'express';

// Config
import { httpRequestDuration, httpRequestsInFlight, register } from '../config/metrics';

// Utils
import { requestContext, resolveRoute } from '../shared/utils/request-context';

// Estado que usa nginx/Caddy cuando el cliente cierra la conexión antes de la respuesta.
const CLIENT_CLOSED_STATUS = '499';

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

  // Todo el manejo de la petición corre dentro de este contexto, así las llamadas a
  // servicios externos saben qué endpoint las originó (ver shared/utils/outbound-metrics).
  requestContext.run({ req }, () => next());
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
