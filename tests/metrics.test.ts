import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import http from 'node:http';
import { metricsHandler, metricsMiddleware } from '../src/middleware/metrics.middleware';

let server: http.Server;
let baseUrl: string;

before(async () => {
  const app = express();
  app.use(metricsMiddleware);

  const users = express.Router();
  users.get('/:id', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/users', users);

  app.get('/api/boom', (_req, res) => {
    res.status(500).json({ ok: false });
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

describe('metricas HTTP (Prometheus)', () => {
  it('etiqueta la ruta con su plantilla y no con el ID real, también en routers anidados', async () => {
    await fetch(`${baseUrl}/api/users/12345`);
    await fetch(`${baseUrl}/api/users/67890`);

    const body = await scrape();
    assert.match(body, /http_request_duration_seconds_count\{[^}]*route="\/api\/users\/:id"[^}]*\} 2/);
    assert.doesNotMatch(body, /12345|67890/);
  });

  it('agrupa las rutas inexistentes bajo una sola etiqueta "unmatched"', async () => {
    await fetch(`${baseUrl}/no-existe-uno`);
    await fetch(`${baseUrl}/no-existe-dos`);

    const body = await scrape();
    assert.match(body, /route="unmatched"[^}]*status_code="404"[^}]*\} 2/);
    assert.doesNotMatch(body, /no-existe/);
  });

  it('registra el código de estado de las respuestas con error', async () => {
    await fetch(`${baseUrl}/api/boom`);

    const body = await scrape();
    assert.match(body, /route="\/api\/boom"[^}]*status_code="500"/);
  });

  it('no mide el propio scrape de /metrics', async () => {
    const body = await scrape();
    assert.doesNotMatch(body, /route="\/metrics"/);
  });

  it('expone las métricas por defecto del proceso Node', async () => {
    const body = await scrape();
    assert.match(body, /process_cpu_user_seconds_total/);
    assert.match(body, /nodejs_heap_size_total_bytes/);
    assert.match(body, /http_requests_in_flight/);
  });
});
