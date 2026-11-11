import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import type { Pool } from 'pg';

export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(27110401)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const folder = new URL('../../migrations/', import.meta.url);
    for (const file of (await readdir(folder)).filter((f) => f.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(file, folder), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>('SELECT checksum FROM schema_migrations WHERE name = $1', [file]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${file}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)', [file, checksum]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
