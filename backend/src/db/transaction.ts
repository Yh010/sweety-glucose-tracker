import { setTimeout as delay } from 'node:timers/promises';
import type { Pool, PoolClient } from 'pg';

// Callbacks must contain database work only: a retry must not repeat external effects.
export async function transaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const client = await pool.connect();
    let failure: unknown;
    let broken = false;
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      failure = error;
      try {
        await client.query('ROLLBACK');
      } catch {
        broken = true;
      }
    } finally {
      client.release(broken);
    }
    const code = (failure as { code?: string })?.code;
    if (attempt >= 2 || !['40P01', '40001'].includes(code ?? '')) throw failure;
    // Release the connection before backing off; never retry arbitrary write failures.
    await delay(20 * 2 ** attempt + Math.floor(Math.random() * 20));
  }
}
