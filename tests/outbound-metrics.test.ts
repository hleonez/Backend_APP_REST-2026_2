import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import http from 'node:http';
import { registerDbPoolMetrics, registerSocketMetrics } from '../src/config/metrics';
import { metricsHandler, metricsMiddleware } from '../src/middleware/metrics.middleware';
import { trackOutbound, trackedFetch } from '../src/shared/utils/outbound-metrics';

const respuesta = (status: number): typeof fetch => async () => new Response('{}', { status });
const abortError = (): Error => Object.assign(new Error('aborted'), { name: 'AbortError' });
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let server: http.Server;
let baseUrl: string;

before(async () => {
  const app = express();
  app.use(metricsMiddleware);

  // Simula el chat: llama a sentimiento y luego a Ollama dentro del mismo endpoint.
  app.post('/api/chats/ia', async (_req, res) => {
    await trackedFetch('sentiment', 'analyze', respuesta(200))('http://sentiment/analyze');
    await trackedFetch('ollama', 'chat', respuesta(200))('http://ollama/api/chat');
    res.json({ ok: true });
  });

  // Dos endpoints lentos y concurrentes: el contexto no debe mezclarse entre ellos.
  app.get('/api/lento-a', async (_req, res) => {
    await sleep(40);
    await trackedFetch('groq', 'chat', respuesta(200))('http://groq/chat');
    res.json({ ok: true });
  });
  app.get('/api/lento-b', async (_req, res) => {
    await sleep(10);
    await trackedFetch('openrouter', 'chat', respuesta(200))('http://openrouter/chat');
    res.json({ ok: true });
  });

  app.get('/metrics', metricsHandler);

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const scrape = async (): Promise<string> => (await fetch(`${baseUrl}/metrics`)).text();

const contador = (body: string, labels: Record<string, string>): number => {
  const linea = body
    .split('\n')
    .find(
      (l) =>
        l.startsWith('outbound_request_duration_seconds_count{') &&
        Object.entries(labels).every(([k, v]) => l.includes(`${k}="${v}"`)),
    );
  return linea ? Number(linea.split(' ').pop()) : 0;
};

describe('metricas de llamadas salientes', () => {
  it('clasifica el resultado de la llamada: ok, 4xx, 5xx, timeout y error de red', async () => {
    await trackedFetch('sentiment', 'analyze', respuesta(200))('http://x');
    await trackedFetch('sentiment', 'analyze', respuesta(429))('http://x');
    await trackedFetch('sentiment', 'analyze', respuesta(503))('http://x');
    await assert.rejects(
      trackedFetch('sentiment', 'analyze', async () => { throw abortError(); })('http://x'),
    );
    await assert.rejects(
      trackedFetch('sentiment', 'analyze', async () => { throw new Error('ECONNREFUSED'); })('http://x'),
    );

    const body = await scrape();
    for (const outcome of ['ok', 'http_4xx', 'http_5xx', 'timeout', 'error']) {
      assert.equal(contador(body, { dependency: 'sentiment', route: 'none', outcome }), 1, outcome);
    }
  });

  it('no usa la etiqueta "service": Prometheus (job rest) la sobrescribe con service="rest"', async () => {
    await trackedFetch('sentiment', 'analyze', respuesta(200))('http://x');

    const body = await scrape();
    const lineas = body.split('\n').filter((l) => l.startsWith('outbound_request_duration_seconds'));
    assert.ok(lineas.length > 0);
    assert.ok(lineas.every((l) => !/[{,]service=/.test(l)));
    assert.ok(lineas.some((l) => l.includes('dependency="sentiment"')));
  });

  it('relanza la misma excepción y no altera la respuesta del fetch', async () => {
    const falla = new Error('fallo original');
    await assert.rejects(
      trackedFetch('ollama', 'chat', async () => { throw falla; })('http://x'),
      (error) => error === falla,
    );
    const response = await trackedFetch('ollama', 'chat', respuesta(200))('http://x');
    assert.equal(response.status, 200);
  });

  it('asocia cada llamada con el endpoint que la originó', async () => {
    await fetch(`${baseUrl}/api/chats/ia`, { method: 'POST' });

    const body = await scrape();
    assert.equal(contador(body, { dependency: 'sentiment', operation: 'analyze', route: '/api/chats/ia', outcome: 'ok' }), 1);
    assert.equal(contador(body, { dependency: 'ollama', operation: 'chat', route: '/api/chats/ia', outcome: 'ok' }), 1);
  });

  it('no mezcla el endpoint entre peticiones concurrentes', async () => {
    await Promise.all([fetch(`${baseUrl}/api/lento-a`), fetch(`${baseUrl}/api/lento-b`)]);

    const body = await scrape();
    assert.equal(contador(body, { dependency: 'groq', route: '/api/lento-a' }), 1);
    assert.equal(contador(body, { dependency: 'openrouter', route: '/api/lento-b' }), 1);
    assert.equal(contador(body, { dependency: 'groq', route: '/api/lento-b' }), 0);
    assert.equal(contador(body, { dependency: 'openrouter', route: '/api/lento-a' }), 0);
  });

  it('trackOutbound mide operaciones que no son fetch (p. ej. R2) y relanza errores', async () => {
    const valor = await trackOutbound('r2', 'put_object', async () => 'subido');
    assert.equal(valor, 'subido');
    await assert.rejects(
      trackOutbound('r2', 'put_object', async () => { throw new Error('AccessDenied'); }),
      /AccessDenied/,
    );

    const body = await scrape();
    assert.equal(contador(body, { dependency: 'r2', operation: 'put_object', outcome: 'ok' }), 1);
    assert.equal(contador(body, { dependency: 'r2', operation: 'put_object', outcome: 'error' }), 1);
  });

  it('expone el estado del pool de Postgres y los clientes de Socket.IO', async () => {
    registerDbPoolMetrics({ totalCount: 7, idleCount: 5, waitingCount: 2 });
    registerSocketMetrics({ engine: { clientsCount: 3 } });

    const body = await scrape();
    assert.match(body, /db_pool_connections\{[^}]*state="total"[^}]*\} 7/);
    assert.match(body, /db_pool_connections\{[^}]*state="idle"[^}]*\} 5/);
    assert.match(body, /db_pool_connections\{[^}]*state="waiting"[^}]*\} 2/);
    assert.match(body, /socketio_connected_clients\{[^}]*\} 3/);
  });
});
