import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import type { Queue } from 'bullmq';

export async function startWorkerMetrics(
  options: { token?: string; port: number },
  queue: Queue,
  pool: Pool,
  running: () => boolean,
) {
  if (!options.token) return undefined;
  const expected = createHash('sha256').update(`Bearer ${options.token}`).digest();
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'GET' || req.url !== '/internal/metrics') {
      res.writeHead(404).end('{}');
      return;
    }
    const actual = createHash('sha256')
      .update(req.headers.authorization ?? '')
      .digest();
    if (!timingSafeEqual(actual, expected)) {
      res.writeHead(401).end('{}');
      return;
    }
    try {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed',
      );
      const result = await pool.query(
        'SELECT date::text,processed::text,inserted::text,completed,updated_at FROM reminder_runs ORDER BY date DESC LIMIT 1',
      );
      res.end(
        JSON.stringify({
          running: running(),
          jobs: counts,
          database: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
          lastRun: result.rows[0] ?? null,
        }),
      );
    } catch {
      res.writeHead(503).end(JSON.stringify({ error: 'Worker metrics temporarily unavailable' }));
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.listen(options.port, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return server;
}
