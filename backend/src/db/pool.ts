import pg from 'pg';
import type { Config } from '../config.js';

// Preserve date-only values; the driver's default Date conversion uses the host timezone.
pg.types.setTypeParser(1082, (value: string) => value);
export function createPool(config: Config): pg.Pool {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: config.DB_POOL_SIZE,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
  });
  pool.on('error', () => console.error(JSON.stringify({ event: 'database_connection_error' })));
  return pool;
}
