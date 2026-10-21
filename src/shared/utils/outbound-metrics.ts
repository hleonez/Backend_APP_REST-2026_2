// Config
import { outboundRequestDuration } from '../../config/metrics';

// Utils
import { currentRoute } from './request-context';

// Servicios externos que el backend consume. Lista cerrada para que las etiquetas
// de las métricas no crezcan sin control.
export type OutboundService =
  | 'sentiment'
  | 'ollama'
  | 'groq'
  | 'openrouter'
  | 'cloudflare_ai'
  | 'r2';

type Outcome = 'ok' | 'http_4xx' | 'http_5xx' | 'timeout' | 'error';

type Labels = { dependency: OutboundService; operation: string; route: string; outcome: Outcome };

const outcomeFromStatus = (status: number): Outcome => {
  if (status >= 500) return 'http_5xx';
  if (status >= 400) return 'http_4xx';
  return 'ok';
};

const outcomeFromError = (error: unknown): Outcome =>
  (error as { name?: string } | null)?.name === 'AbortError' ? 'timeout' : 'error';

// La observabilidad NUNCA puede romper el servicio que mide: si la métrica falla,
// la llamada al servicio externo sigue su curso como si no existiera.
let avisoEmitido = false;
const avisarUnaVez = (error: unknown): void => {
  if (avisoEmitido) return;
  avisoEmitido = true;
  console.warn('[METRICS] No se pudo registrar una métrica (se ignora):', (error as Error)?.message ?? error);
};

const iniciarMedicion = (): { route: string; stop: (labels: Labels) => void } => {
  try {
    const route = currentRoute();
    const stopTimer = outboundRequestDuration.startTimer();
    return {
      route,
      stop: (labels) => {
        try {
          stopTimer(labels);
        } catch (error) {
          avisarUnaVez(error);
        }
      },
    };
  } catch (error) {
    avisarUnaVez(error);
    return { route: 'none', stop: () => undefined };
  }
};

// Mide una operación asíncrona contra un servicio externo. Si lanza, registra el error
// (o timeout) y relanza la misma excepción: no cambia el comportamiento del llamador.
export const trackOutbound = async <T>(
  service: OutboundService,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const { route, stop } = iniciarMedicion();
  try {
    const result = await fn();
    stop({ dependency: service, operation, route, outcome: 'ok' });
    return result;
  } catch (error) {
    stop({ dependency: service, operation, route, outcome: outcomeFromError(error) });
    throw error;
  }
};

// Devuelve un `fetch` que mide cada llamada. Se puede pasar la implementación a
// envolver (los servicios la reciben por inyección en sus pruebas).
export const trackedFetch =
  (service: OutboundService, operation: string, fetchImpl: typeof fetch = fetch): typeof fetch =>
  async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const { route, stop } = iniciarMedicion();
    try {
      const response = await fetchImpl(...args);
      stop({ dependency: service, operation, route, outcome: outcomeFromStatus(response.status) });
      return response;
    } catch (error) {
      stop({ dependency: service, operation, route, outcome: outcomeFromError(error) });
      throw error;
    }
  };
