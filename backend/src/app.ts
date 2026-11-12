import express from 'express';
import { resolve } from 'node:path';
import { AuthRateStore } from './infrastructure/auth-rate-store.js';
import { Passwords } from './modules/auth/passwords.js';
import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Admission } from './infrastructure/admission.js';
import { RequestMetrics } from './infrastructure/metrics.js';
import type { Pool } from 'pg';
import type { Config } from './config.js';
import { AppError, errorHandler } from './lib/errors.js';
import { todayInZone } from './lib/dates.js';
import { authRoutes } from './modules/auth/routes.js';
import { requireAuth } from './modules/auth/session.js';
import { readingRoutes } from './modules/readings/routes.js';
import type { ReportCache } from './infrastructure/report-cache.js';
import { reportRoutes } from './modules/reports/routes.js';

export function createApp(
  pool: Pool,
  config: Config,
  cache?: ReportCache,
  frontendDirectory?: string,
) {
  const app = express();
  const passwords = new Passwords(config.HASH_WORKERS, config.HASH_QUEUE_LIMIT);
  const rateStore = config.RATE_LIMIT_REDIS_URL
    ? new AuthRateStore(config.RATE_LIMIT_REDIS_URL, config.RATE_LIMIT_PREFIX)
    : undefined;
  app.set('trust proxy', config.TRUST_PROXY.length ? config.TRUST_PROXY : false);
  const admission = new Admission(
    config.API_MAX_CONCURRENT,
    config.API_MAX_QUEUED,
    config.API_QUEUE_WAIT_MS,
  );
  const metrics = new RequestMetrics();
  app.locals.admission = admission;
  app.locals.metrics = metrics;
  app.locals.beginShutdown = () => admission.stop();
  app.locals.rateLimitStore = rateStore;
  app.locals.closeServices = async () => {
    admission.stop();
    rateStore?.shutdown();
    await passwords.close();
  };
  app.locals.passwords = passwords;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const requestId = randomUUID();
    const started = performance.now();
    res.once('finish', () => metrics.observe(res.statusCode, performance.now() - started));
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
            durationMs: Math.round(performance.now() - started),
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
  app.use('/api', admission.middleware);
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/live', (_req, res) => res.json({ status: 'up' }));
  app.get('/internal/metrics', (req, res) => {
    if (!config.METRICS_TOKEN) throw new AppError(404, 'NOT_FOUND', 'Endpoint not found.');
    const actual = createHash('sha256')
      .update(req.get('Authorization') ?? '')
      .digest();
    const expected = createHash('sha256').update(`Bearer ${config.METRICS_TOKEN}`).digest();
    if (!timingSafeEqual(actual, expected))
      throw new AppError(401, 'METRICS_AUTH_REQUIRED', 'Metrics authorization required.');
    res.json({
      requests: metrics.snapshot(),
      admission: admission.snapshot(),
      database: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        processLimit: config.DB_POOL_SIZE,
      },
      passwords: passwords.snapshot(),
      sharedRateLimit: rateStore?.snapshot() ?? { enabled: false },
    });
  });
  app.get('/api/health', async (_req, res) => {
    if (admission.snapshot().stopping)
      throw new AppError(503, 'DRAINING', 'The service is restarting. Please try again shortly.');
    await pool.query('SELECT 1');
    if (rateStore && !rateStore.snapshot().ready)
      throw new AppError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Sign-in is temporarily unavailable. Please try again shortly.',
      );
    res.json({ status: 'ok' });
  });
  app.get('/api/meta', (_req, res) =>
    res.json({ today: todayInZone(config.APP_TIMEZONE), timezone: config.APP_TIMEZONE }),
  );
  app.use('/api/auth', authRoutes(pool, config, passwords, rateStore));
  app.use('/api/readings', requireAuth(pool), readingRoutes(pool, config.APP_TIMEZONE));
  app.use('/api/reports', requireAuth(pool), reportRoutes(pool, config.APP_TIMEZONE, cache));
  if (frontendDirectory) {
    const directory = resolve(frontendDirectory);
    app.use((req, res, next) => {
      if (/^\/(api|internal)(\/|$)/.test(req.path)) return next();
      res.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      next();
    });
    app.use(express.static(directory, { index: false, redirect: false }));
    app.get('/{*path}', (req, res, next) => {
      if (
        /^\/(api|internal)(\/|$)/.test(req.path) ||
        !req.accepts('html') ||
        /\.[^/]+$/.test(req.path)
      )
        return next();
      res.sendFile(resolve(directory, 'index.html'));
    });
  }
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found.')));
  app.use(errorHandler);
  return app;
}
