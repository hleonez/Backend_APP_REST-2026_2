import type { SentimientoResultado } from './sentimiento.service';
import {
  interpretarClef,
  preguntasClef,
  UMBRAL_CRISIS_DEFECTO,
  UMBRAL_DOMINIO_DEFECTO,
  type DecisionClef,
} from './clef-decision';

const INTENTOS = 3;
const TIMEOUT_MS = 8000;

export interface DependenciasClef {
  fetchImpl?: typeof fetch;
  accountId?: string;
  token?: string;
  umbralCrisis?: number;
  umbralDominio?: number;
}

const numeroDeEntorno = (nombre: string, defecto: number): number => {
  const crudo = process.env[nombre];
  if (!crudo) return defecto;
  const valor = Number(crudo);
  return Number.isFinite(valor) ? valor : defecto;
};

const extraerAnswers = (cuerpo: unknown): Record<string, unknown> | undefined => {
  if (!cuerpo || typeof cuerpo !== 'object') return undefined;
  const raiz = cuerpo as Record<string, unknown>;
  const result = (raiz.result && typeof raiz.result === 'object'
    ? raiz.result
    : raiz) as Record<string, unknown>;
  const answers = result.answers;
  if (!answers || typeof answers !== 'object') return undefined;
  return answers as Record<string, unknown>;
};

export const clasificarConClef = async (
  mensaje: string,
  sentimiento: SentimientoResultado,
  deps: DependenciasClef = {},
): Promise<DecisionClef> => {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const accountId = deps.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
  const token = deps.token ?? process.env.CLOUDFLARE_AUTH_TOKEN ?? '';
  const umbrales = {
    crisis: deps.umbralCrisis ?? numeroDeEntorno('CLEF_CRISIS_UMBRAL', UMBRAL_CRISIS_DEFECTO),
    dominio: deps.umbralDominio ?? numeroDeEntorno('CLEF_DOMINIO_UMBRAL', UMBRAL_DOMINIO_DEFECTO),
  };

  if (!accountId || !token) {
    return { disponible: false, fueraDeDominio: false, crisis: false };
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef-flash`;
  const body = JSON.stringify({
    model: 'clef-flash',
    state: {
      frase: mensaje,
      label: sentimiento.label,
      scores: sentimiento.scores,
      origen: sentimiento.origen,
    },
    questions: preguntasClef(),
  });

  let ultimoError: unknown;
  for (let intento = 1; intento <= INTENTOS; intento += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        console.error('[CLEF] Credencial rechazada');
        return { disponible: false, fueraDeDominio: false, crisis: false };
      }

      if (!response.ok) {
        throw new Error(`Clef respondió ${response.status}`);
      }

      const json = (await response.json()) as unknown;
      const answers = extraerAnswers(json);
      if (!answers) {
        throw new Error('Clef no devolvió answers');
      }

      return interpretarClef(answers, sentimiento, umbrales);
    } catch (error) {
      ultimoError = error;
      console.warn(`[CLEF] Intento ${intento} de ${INTENTOS} falló`);
    } finally {
      clearTimeout(timeout);
    }
  }

  console.error('[CLEF] Sin respuesta tras los reintentos', ultimoError instanceof Error ? ultimoError.message : '');
  return { disponible: false, fueraDeDominio: false, crisis: false };
};
