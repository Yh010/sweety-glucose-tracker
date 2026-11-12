import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const example = await readFile(new URL('./.env.example', import.meta.url), 'utf8');
const populated = example.replace(/^(POSTGRES_ADMIN_PASSWORD|POSTGRES_MIGRATION_PASSWORD|POSTGRES_APP_PASSWORD|METRICS_TOKEN)=$/gm,
  (_line, name) => `${name}=${randomBytes(32).toString('hex')}`);
await writeFile(new URL('./.env.local', import.meta.url), populated, { flag: 'wx', mode: 0o600 });
console.log('Created ignored deploy/.env.local with independent secrets. Existing files are never overwritten.');
