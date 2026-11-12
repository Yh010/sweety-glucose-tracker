import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('E2E requires TEST_DATABASE_URL ending in _test');
const config = loadConfig({
  ...process.env,
  DATABASE_URL: url,
  NODE_ENV: 'test',
  PORT: '4001',
  APP_ORIGIN: 'http://localhost:5174',
  AUTH_RATE_LIMIT: '1000',
});
const admin = createPool(config);
const token = randomUUID();
const schema = `e2e_${randomUUID().replaceAll('-', '')}`;
await admin.query(`CREATE SCHEMA ${schema}`);
await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../.local/e2e-session.json', import.meta.url),
  JSON.stringify({ schema, token }),
);
const scoped = new URL(url);
scoped.searchParams.set('options', `-c search_path=${schema}`);
const pool = createPool({ ...config, DATABASE_URL: scoped.toString() });
await migrate(pool);
const app = createApp(pool, config);
const server = createServer((req, res) => {
  if (
    req.method === 'POST' &&
    req.url === '/__e2e__/shutdown' &&
    req.headers['x-e2e-token'] === token
  ) {
    res.end('stopping');
    setTimeout(() => void shutdown(), 100);
  } else app(req, res);
}).listen(config.PORT, '127.0.0.1');
async function shutdown() {
  server.closeAllConnections();
  server.close();
  await app.locals.closeServices();
  await pool.end();
  await admin.end();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
