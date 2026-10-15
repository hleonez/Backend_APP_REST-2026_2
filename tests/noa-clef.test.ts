import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  directrizDeRaiz,
  estiloParaRaiz,
  interpretarClef,
  RAICES,
  type RaizId,
} from '../src/services/clef-decision';
import { clasificarConClef } from '../src/services/clef.service';
import { generarConSistema2, Sistema2Error } from '../src/services/system2.service';
import type { SentimientoResultado } from '../src/services/sentimiento.service';

const sentimiento = (
  label: SentimientoResultado['label'],
  origen: SentimientoResultado['origen'] = 'encoder',
): SentimientoResultado => ({
  label,
  confianza: 0.9,
  scores: {
    NEG: label === 'NEG' ? 0.9 : 0.05,
    NEU: label === 'NEU' ? 0.9 : 0.05,
    POS: label === 'POS' ? 0.9 : 0.05,
  },
  origen,
});

describe('interpretarClef', () => {
  it('no trata un modismo como crisis si el score es bajo', () => {
    const decision = interpretarClef(
      { alerta_crisis: 0.4, raiz: 'estres_academico', fuera_de_dominio: 0.1 },
      sentimiento('NEG'),
    );
    assert.equal(decision.crisis, false);
    assert.equal(decision.raiz, 'estres_academico');
  });

  it('marca crisis cuando el score llega al nivel crítico', () => {
    const decision = interpretarClef(
      { alerta_crisis: 2.5, raiz: 'sintomas_depresivos', fuera_de_dominio: 0 },
      sentimiento('NEG'),
    );
    assert.equal(decision.crisis, true);
  });

  it('marca crisis cuando Clef nombra el criterio crítico', () => {
    const decision = interpretarClef(
      {
        alerta_crisis: { answer: 'Riesgo critico inmediato', score: 1 },
        raiz: 'malestar_general',
      },
      sentimiento('NEG'),
    );
    assert.equal(decision.crisis, true);
  });

  it('no redirige una integral si el encoder vino en fallback NEU', () => {
    const decision = interpretarClef(
      { fuera_de_dominio: 0.99, raiz: 'checkin_plano', alerta_crisis: 0 },
      sentimiento('NEU', 'fallback'),
    );
    assert.equal(decision.fueraDeDominio, false);
  });

  it('no redirige si el tono es NEG aunque Clef vea léxico académico', () => {
    const decision = interpretarClef(
      { fuera_de_dominio: 0.99, raiz: 'estres_academico', alerta_crisis: 0 },
      sentimiento('NEG'),
    );
    assert.equal(decision.fueraDeDominio, false);
  });

  it('redirige tarea sin malestar cuando el encoder respondió NEU', () => {
    const decision = interpretarClef(
      { fuera_de_dominio: 0.9, raiz: 'carga_academica_sin_desborde', alerta_crisis: 0 },
      sentimiento('NEU'),
    );
    assert.equal(decision.fueraDeDominio, true);
  });

  it('elige la opción con más probabilidad', () => {
    const decision = interpretarClef(
      {
        raiz: { probabilities: { ansiedad_panico: 0.7, estres_academico: 0.2 } },
        alerta_crisis: 0,
        fuera_de_dominio: 0,
      },
      sentimiento('NEG'),
    );
    assert.equal(decision.raiz, 'ansiedad_panico');
  });

  it('no deja una raíz positiva si el encoder dijo NEG', () => {
    const decision = interpretarClef(
      { raiz: 'logro_o_alivio', alerta_crisis: 0, fuera_de_dominio: 0 },
      sentimiento('NEG'),
    );
    assert.equal(decision.raiz, 'malestar_general');
  });

  it('tiene directriz para cada raíz y contiene en ansiedad, depresión y ruptura', () => {
    for (const raiz of RAICES) {
      assert.ok(directrizDeRaiz(raiz as RaizId).length > 20);
    }
    assert.equal(estiloParaRaiz('ansiedad_panico', 'conversacion_neutral'), 'contencion_emocional');
    assert.equal(estiloParaRaiz('sintomas_depresivos', 'refuerzo_positivo'), 'contencion_emocional');
    assert.equal(estiloParaRaiz('ruptura_relacion', 'apoyo_practico'), 'contencion_emocional');
    assert.equal(estiloParaRaiz('logro_o_alivio', 'refuerzo_positivo'), 'refuerzo_positivo');
  });
});

describe('clasificarConClef', () => {
  it('reintenta y usa la tercera respuesta', async () => {
    let llamadas = 0;
    const fetchImpl = (async () => {
      llamadas += 1;
      if (llamadas < 3) {
        return new Response('no', { status: 503 });
      }
      return new Response(JSON.stringify({
        result: {
          answers: {
            raiz: 'animo_gratitud',
            alerta_crisis: 0,
            fuera_de_dominio: 0.1,
          },
        },
      }), { status: 200 });
    }) as typeof fetch;

    const decision = await clasificarConClef('hoy estoy contento', sentimiento('POS'), {
      fetchImpl,
      accountId: 'acc',
      token: 'tok',
    });
    assert.equal(llamadas, 3);
    assert.equal(decision.raiz, 'animo_gratitud');
    assert.equal(decision.disponible, true);
  });
});

describe('generarConSistema2', () => {
  const mensajes = [{ role: 'system' as const, content: 'NOA' }, { role: 'user' as const, content: 'hola' }];

  it('cae a OpenRouter cuando Groq responde 429', async () => {
    const fetchImpl = (async (url: string) => {
      if (String(url).includes('groq.com')) {
        return new Response('{}', { status: 429 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'desde openrouter' } }],
      }), { status: 200 });
    }) as typeof fetch;

    const generado = await generarConSistema2(mensajes, {
      fetchImpl,
      groqKey: 'gsk',
      groqModel: 'modelo-groq',
      openRouterKey: 'or',
      openRouterModel: 'modelo-gratis',
    });
    assert.equal(generado.proveedor, 'openrouter');
    assert.equal(generado.texto, 'desde openrouter');
  });

  it('no llama a un modelo local si Groq y OpenRouter fallan', async () => {
    const fetchImpl = (async (url: string) => {
      if (String(url).includes('groq.com')) return new Response('{}', { status: 503 });
      return new Response('{}', { status: 503 });
    }) as typeof fetch;

    await assert.rejects(
      () => generarConSistema2(mensajes, {
        fetchImpl,
        groqKey: 'gsk',
        groqModel: 'modelo-groq',
        openRouterKey: 'or',
        openRouterModel: 'modelo-gratis',
      }),
      (error: unknown) => error instanceof Sistema2Error,
    );
  });
});
