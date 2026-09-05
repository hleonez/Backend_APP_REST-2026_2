/**
 * Wrapper del microservicio de sentimiento (Robertuito).
 *
 * Contrato de la API (ver Fase 1 / sentiment/app/main.py):
 *   POST /analyze
 *   body: { "texto": string }
 *   -> { "label": "NEG" | "NEU" | "POS", "scores": { "NEG": number, "NEU": number, "POS": number } }
 *
 * Prioridad de esta fase: validar que la integración end-to-end con el
 * encoder funciona correctamente para los casos esperados (NEG/NEU/POS).
 * El fallback de abajo es una red de seguridad para que el chatbot nunca
 * se caiga por un problema del encoder, pero no es el foco principal de
 * aceptación de esta iteración.
 *
 * Importante: este encoder NO debe usarse como mecanismo de detección de
 * riesgo suicida o crisis. Esa capa (PALABRAS_ALERTA_CRITICA) vive en
 * chat.controller.ts y siempre se evalúa antes y de forma independiente.
 */

const SENTIMENT_API_URL = process.env.SENTIMENT_API_URL || 'http://localhost:8000';
const SENTIMENT_TIMEOUT_MS = 2000;

export type SentimientoLabel = 'NEG' | 'NEU' | 'POS';

export interface SentimientoScores {
  NEG: number;
  NEU: number;
  POS: number;
}

export interface SentimientoResultado {
  label: SentimientoLabel;
  confianza: number;
  scores: SentimientoScores;
  origen: 'encoder' | 'fallback';
}

interface RespuestaEncoder {
  label: SentimientoLabel;
  scores: SentimientoScores;
}

/**
 * Resultado de respaldo seguro cuando el encoder no responde a tiempo o
 * falla. Se mantiene neutral e inocuo a propósito: el chatbot sigue
 * funcionando con `detectarEmocion` (heurística por palabras clave) para
 * generar la respuesta, tal como ya ocurre en ollama.service.ts.
 */
const FALLBACK_SEGURO: SentimientoResultado = {
  label: 'NEU',
  confianza: 0,
  scores: { NEG: 0, NEU: 1, POS: 0 },
  origen: 'fallback',
};

const esLabelValido = (label: unknown): label is SentimientoLabel =>
  label === 'NEG' || label === 'NEU' || label === 'POS';

const esScoresValido = (scores: unknown): scores is SentimientoScores => {
  if (!scores || typeof scores !== 'object') return false;
  const s = scores as Record<string, unknown>;
  return typeof s.NEG === 'number' && typeof s.NEU === 'number' && typeof s.POS === 'number';
};

const logDev = (resultado: SentimientoResultado) => {
  if (process.env.NODE_ENV === 'production') return;
  // Registro mínimo requerido en desarrollo: label;confianza
  console.log(`[SENTIMIENTO] label=${resultado.label};confianza=${resultado.confianza.toFixed(3)};origen=${resultado.origen}`);
};

/**
 * Analiza el sentimiento de un texto usando el microservicio Robertuito.
 *
 * Nunca lanza una excepción: ante timeout (2s), error de red, respuesta
 * no-OK o formato inesperado, devuelve un resultado de fallback seguro
 * para que el chatbot pueda continuar sin interrupciones.
 */
export const analizarSentimiento = async (texto: string): Promise<SentimientoResultado> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SENTIMENT_TIMEOUT_MS);

  try {
    const response = await fetch(`${SENTIMENT_API_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Encoder de sentimiento respondio con estado ${response.status}`);
    }

    const data = (await response.json()) as Partial<RespuestaEncoder>;

    if (!esLabelValido(data.label) || !esScoresValido(data.scores)) {
      throw new Error('Respuesta del encoder de sentimiento con formato inesperado');
    }

    const resultado: SentimientoResultado = {
      label: data.label,
      confianza: data.scores[data.label],
      scores: data.scores,
      origen: 'encoder',
    };

    logDev(resultado);
    return resultado;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.warn(`[SENTIMIENTO] Timeout de ${SENTIMENT_TIMEOUT_MS}ms alcanzado, usando fallback seguro`);
    } else {
      console.warn('[SENTIMIENTO] Error consultando el encoder, usando fallback seguro:', error?.message || error);
    }

    const resultado = { ...FALLBACK_SEGURO };
    logDev(resultado);
    return resultado;
  } finally {
    clearTimeout(timeout);
  }
};
