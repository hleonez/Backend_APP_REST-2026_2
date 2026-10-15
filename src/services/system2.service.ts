import type { OllamaChatMessage } from './ollama.service';

const TIMEOUT_MS = 20_000;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class Sistema2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Sistema2Error';
  }
}

export interface MensajeChat {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DependenciasSistema2 {
  fetchImpl?: typeof fetch;
  provider?: string;
  groqKey?: string;
  groqModel?: string;
  openRouterKey?: string;
  openRouterModel?: string;
}

export const proveedorSistema2 = (): 'ollama' | 'groq' =>
  (process.env.SYSTEM2_PROVIDER || 'ollama').toLowerCase() === 'groq' ? 'groq' : 'ollama';

const leerTexto = (cuerpo: unknown): string => {
  if (!cuerpo || typeof cuerpo !== 'object') return '';
  const choices = (cuerpo as { choices?: Array<{ message?: { content?: string } }> }).choices;
  return choices?.[0]?.message?.content?.trim() || '';
};

const postChat = async (
  fetchImpl: typeof fetch,
  url: string,
  apiKey: string,
  model: string,
  messages: MensajeChat[],
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; texto: string }> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.55,
        max_tokens: 512,
        stream: false,
      }),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, texto: leerTexto(json) };
  } finally {
    clearTimeout(timeout);
  }
};

export const generarConSistema2 = async (
  messages: MensajeChat[],
  deps: DependenciasSistema2 = {},
): Promise<{ texto: string; proveedor: 'groq' | 'openrouter' }> => {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const groqKey = deps.groqKey ?? process.env.GROQ_API_KEY ?? '';
  const groqModel = deps.groqModel ?? process.env.GROQ_MODEL ?? '';
  const openRouterKey = deps.openRouterKey ?? process.env.OPENROUTER_API_KEY ?? '';
  const openRouterModel = deps.openRouterModel ?? process.env.OPENROUTER_MODEL ?? '';

  if (!groqKey || !groqModel) {
    throw new Sistema2Error('Faltan GROQ_API_KEY o GROQ_MODEL');
  }

  let groqStatus = 0;
  try {
    const groq = await postChat(fetchImpl, GROQ_URL, groqKey, groqModel, messages);
    groqStatus = groq.status;
    if (groq.status === 200 && groq.texto) {
      return { texto: groq.texto, proveedor: 'groq' };
    }
    if (groq.status !== 429 && groq.status !== 503) {
      throw new Sistema2Error(`Groq respondió ${groq.status}`);
    }
  } catch (error) {
    if (error instanceof Sistema2Error) throw error;
    groqStatus = 503;
  }

  if (groqStatus !== 429 && groqStatus !== 503) {
    throw new Sistema2Error('Groq no disponible');
  }

  if (!openRouterKey || !openRouterModel) {
    throw new Sistema2Error('Groq limitado y OpenRouter no está configurado');
  }

  try {
    const respaldo = await postChat(
      fetchImpl,
      OPENROUTER_URL,
      openRouterKey,
      openRouterModel,
      messages,
      { 'HTTP-Referer': 'https://noa.local', 'X-Title': 'NOA' },
    );
    if (respaldo.status === 200 && respaldo.texto) {
      return { texto: respaldo.texto, proveedor: 'openrouter' };
    }
    throw new Sistema2Error(`OpenRouter respondió ${respaldo.status}`);
  } catch (error) {
    if (error instanceof Sistema2Error) throw error;
    throw new Sistema2Error('OpenRouter no respondió');
  }
};

export const mensajesParaSistema2 = (
  system: string,
  historial: OllamaChatMessage[],
  mensaje: string,
): MensajeChat[] => {
  const previos = historial
    .filter((turno) => turno.role === 'user' || turno.role === 'assistant')
    .slice(-8)
    .map((turno) => ({ role: turno.role, content: turno.content }));

  return [
    { role: 'system', content: system },
    ...previos,
    { role: 'user', content: mensaje },
  ];
};
