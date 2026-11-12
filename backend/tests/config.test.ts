import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
const env = { DATABASE_URL: 'postgresql://example:example@localhost/example' };
test('database process pools must fit an explicit budget', () => {
  assert.throws(
    () =>
      loadConfig({ ...env, API_PROCESSES: '20', RATE_LIMIT_REDIS_URL: 'redis://localhost:6379' }),
    /connection budget/,
  );
  const config = loadConfig({
    ...env,
    API_PROCESSES: '4',
    DB_POOL_SIZE: '10',
    WORKER_PROCESSES: '2',
    DB_WORKER_POOL_SIZE: '2',
    DB_CONNECTION_BUDGET: '60',
    DB_RESERVED_CONNECTIONS: '10',
    RATE_LIMIT_REDIS_URL: 'redis://localhost:6379',
  });
  assert.equal(config.API_PROCESSES, 4);
  assert.throws(() => loadConfig({ ...env, API_PROCESSES: '2' }), /shared authentication limits/);
});
test('proxy trust accepts explicit IP ranges and rejects blanket trust', () => {
  assert.deepEqual(loadConfig({ ...env, TRUST_PROXY: '127.0.0.1/32, ::1/128' }).TRUST_PROXY, [
    '127.0.0.1/32',
    '::1/128',
  ]);
  for (const value of ['true', '1', '10.0.0.1/99', 'unknown'])
    assert.throws(() => loadConfig({ ...env, TRUST_PROXY: value }), /trusted proxy/);
  assert.deepEqual(loadConfig(env).TRUST_PROXY, []);
});
