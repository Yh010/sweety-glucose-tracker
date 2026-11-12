import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { connectReportCache } from './infrastructure/report-cache.js';
import { createApp } from './app.js';

const config = loadConfig({
  ...process.env,
  ...(process.env.RENDER_EXTERNAL_URL ? { APP_ORIGIN: process.env.RENDER_EXTERNAL_URL } : {}),
});
const pool = createPool(config);
await pool.query('SELECT 1');
const cacheUrl = config.REPORT_CACHE_REDIS_URL ?? config.REDIS_URL;
const reportCache = cacheUrl ? connectReportCache(cacheUrl) : undefined;
const app = createApp(pool, config, reportCache?.cache, process.env.FRONTEND_DIR);
const server = app.listen(config.PORT, () =>
  console.log(`Sweety API listening on port ${config.PORT}`),
);
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  app.locals.beginShutdown();
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  server.close(() => {
    reportCache?.close();
    void app.locals
      .closeServices()
      .then(() => pool.end())
      .then(() => {
        clearTimeout(timeout);
        process.exit(0);
      });
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
