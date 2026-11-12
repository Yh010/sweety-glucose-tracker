import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

test('same-origin hosting serves pages and assets without hiding API or missing asset errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sweety-web-'));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>Sweety</title>');
  await writeFile(join(directory, 'assets', 'app.js'), 'console.log("Sweety");');
  const app = createApp(
    {} as Pool,
    loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/sweety_test' }),
    undefined,
    directory,
  );
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const path of ['/', '/reports']) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'self'/);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match(await response.text(), /<title>Sweety/);
    }
    assert.equal((await fetch(`${base}/assets/app.js`)).status, 200);
    for (const path of ['/api/unknown', '/internal/unknown', '/assets/missing.js']) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error.code, 'NOT_FOUND');
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await app.locals.closeServices();
    await rm(directory, { recursive: true, force: true });
  }
});
