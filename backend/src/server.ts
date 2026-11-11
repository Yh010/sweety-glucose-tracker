import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createApp } from './app.js';

const config = loadConfig();
const pool = createPool(config);
await pool.query('SELECT 1');
const server = createApp(pool, config).listen(config.PORT, () => console.log(`Sweety API listening on port ${config.PORT}`));
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  server.close(() => { void pool.end().then(() => { clearTimeout(timeout); process.exit(0); }); });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
