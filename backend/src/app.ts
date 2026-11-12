import express from 'express';
import { Passwords } from './modules/auth/passwords.js';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Config } from './config.js';
import { AppError, errorHandler } from './lib/errors.js';
import { todayInZone } from './lib/dates.js';
import { authRoutes } from './modules/auth/routes.js';
import { requireAuth } from './modules/auth/session.js';
import { readingRoutes } from './modules/readings/routes.js';
import type { ReportCache } from './infrastructure/report-cache.js';
import { reportRoutes } from './modules/reports/routes.js';

export function createApp(pool: Pool, config: Config, cache?: ReportCache) {
  const app = express();
  const passwords = new Passwords(config.HASH_WORKERS, config.HASH_QUEUE_LIMIT);
  app.locals.closeServices = () => passwords.close();
  app.locals.passwords = passwords;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const requestId = randomUUID();
    const path = req.path;
    res.set({
      'X-Request-ID': requestId,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
    });
    if (config.NODE_ENV !== 'test')
      res.on('finish', () =>
        console.log(
          JSON.stringify({
            event: 'request',
            requestId,
            method: req.method,
            path,
            status: res.statusCode,
          }),
        ),
      );
    // A custom header prevents cross-site form requests; no CORS is enabled.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (
        req.get('X-Requested-With') !== 'Sweety' ||
        (req.get('Origin') && req.get('Origin') !== config.APP_ORIGIN)
      )
        throw new AppError(
          403,
          'ORIGIN_REJECTED',
          'Request origin could not be verified. Reload the page and try again.',
        );
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.get('/api/meta', (_req, res) =>
    res.json({ today: todayInZone(config.APP_TIMEZONE), timezone: config.APP_TIMEZONE }),
  );
  app.use('/api/auth', authRoutes(pool, config, passwords));
  app.use('/api/readings', requireAuth(pool), readingRoutes(pool, config.APP_TIMEZONE));
  app.use('/api/reports', requireAuth(pool), reportRoutes(pool, config.APP_TIMEZONE, cache));
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found.')));
  app.use(errorHandler);
  return app;
}
