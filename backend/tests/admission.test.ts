import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Admission } from '../src/infrastructure/admission.js';
import { RequestMetrics } from '../src/infrastructure/metrics.js';
import { errorHandler } from '../src/lib/errors.js';

test('request admission bounds active/waiting work, expires the queue and recovers', async () => {
  const admission = new Admission(1, 1, 100);
  const app = express();
  let release!: () => void, entered!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  app.use(admission.middleware);
  app.get('/live', (_req, res) => res.json({ status: 'up' }));
  app.get('/work', async (_req, res) => {
    entered();
    await held;
    res.json({ status: 'done' });
  });
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}`;
  const first = fetch(`${url}/work`);
  try {
    await started;
    const queued = fetch(`${url}/work`);
    for (let i = 0; i < 100 && admission.snapshot().waiting !== 1; i++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(admission.snapshot().active, 1);
    assert.equal(admission.snapshot().waiting, 1);
    const refused = await fetch(`${url}/work`);
    assert.equal(refused.status, 503);
    assert.equal((await refused.json()).error.code, 'SERVER_BUSY');
    assert.equal((await fetch(`${url}/live`)).status, 200);
    assert.equal((await queued).status, 503);
    assert.equal(admission.snapshot().waiting, 0);
    release();
    assert.equal((await first).status, 200);
    assert.equal((await fetch(`${url}/work`)).status, 200);
    admission.stop();
    assert.equal((await fetch(`${url}/work`)).status, 503);
    assert.equal((await fetch(`${url}/live`)).status, 200);
    assert.equal(admission.snapshot().active, 0);
  } finally {
    release();
    await first;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('a disconnected queued request releases its waiting position', async () => {
  const admission = new Admission(1, 1, 1000);
  const app = express();
  let release!: () => void, entered!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  app.use(admission.middleware);
  app.get('/work', async (_req, res) => {
    entered();
    await held;
    res.end('done');
  });
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/work`;
  const first = fetch(url);
  const controller = new AbortController();
  try {
    await started;
    const queued = assert.rejects(fetch(url, { signal: controller.signal }));
    for (let i = 0; i < 100 && !admission.snapshot().waiting; i++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(admission.snapshot().waiting, 1);
    controller.abort();
    await queued;
    for (let i = 0; i < 100 && admission.snapshot().waiting; i++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(admission.snapshot().waiting, 0);
  } finally {
    controller.abort();
    release();
    await first;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('request metrics retain a bounded recent latency sample', () => {
  const metrics = new RequestMetrics();
  for (let i = 0; i < 1000; i++) metrics.observe(i % 10 === 0 ? 503 : 200, i);
  const result = metrics.snapshot();
  assert.equal(result.requests, 1000);
  assert.equal(result.serverErrors, 100);
  assert.equal(result.recentSamples, 256);
  assert.ok(result.recentP95Ms > 900);
});
