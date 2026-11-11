import EmbeddedPostgres from 'embedded-postgres';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Development only. This starts real PostgreSQL on loopback without installing a system service.
const databaseDir = resolve('.local/postgres');
await mkdir(databaseDir, { recursive: true });
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: 'sweety',
  password: 'sweety_local',
  port: 5432,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  authMethod: 'scram-sha-256',
  autoRehydrateSymlinks: true,
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: (message: unknown) => console.error(String(message)),
});
if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient();
await client.connect();
for (const database of ['sweety', 'sweety_test']) {
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
  if (!existing.rowCount)
    await client.query(
      `CREATE DATABASE ${database} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
}
await client.end();
console.log('Local PostgreSQL is ready on 127.0.0.1:5432. Press Ctrl+C to stop.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await postgres.stop();
  process.exit(0);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
await new Promise(() => {});
