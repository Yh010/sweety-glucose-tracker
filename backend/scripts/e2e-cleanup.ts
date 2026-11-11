import { readFile, unlink } from 'node:fs/promises';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db/pool.js';
const file = new URL('../.local/e2e-session.json', import.meta.url);
let raw: string;
try {
  raw = await readFile(file, 'utf8');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') process.exit(0);
  throw error;
}
const { schema } = JSON.parse(raw) as { schema: string };
const url = process.env.TEST_DATABASE_URL;
if (!/^e2e_[a-f0-9]{32}$/.test(schema) || !url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Unsafe E2E cleanup target');
const pool = createPool(loadConfig({ ...process.env, DATABASE_URL: url }));
try {
  await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await unlink(file);
} finally {
  await pool.end();
}
