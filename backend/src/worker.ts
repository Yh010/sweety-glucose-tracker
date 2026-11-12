import { startWorkerMetrics } from './modules/reminders/metrics.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createReminderQueue, createReminderWorker } from './modules/reminders/queue.js';

const config = loadConfig();
if (!config.REDIS_URL) throw new Error('Set REDIS_URL to run the optional reminder worker.');
const pool = createPool({ ...config, DB_POOL_SIZE: config.DB_WORKER_POOL_SIZE });
await pool.query('SELECT 1');
const producer = createReminderQueue(config.REDIS_URL);
await producer.queue.waitUntilReady();
await producer.queue.upsertJobScheduler(
  'daily-reminders-v1',
  { pattern: `0 ${config.REMINDER_HOUR} * * *`, tz: config.APP_TIMEZONE },
  { name: 'daily-reminders', data: {} },
);
await producer.queue.upsertJobScheduler(
  'maintenance-v1',
  { pattern: '0 * * * *', tz: config.APP_TIMEZONE },
  { name: 'database-maintenance', data: {} },
);
const consumer = createReminderWorker(pool, config.REDIS_URL, config.APP_TIMEZONE, 'sweety:bull', {
  batchSize: config.MAINTENANCE_BATCH_SIZE,
  maxMaintenanceBatches: config.MAINTENANCE_MAX_BATCHES,
  retentionDays: config.REMINDER_RETENTION_DAYS,
});
await consumer.worker.waitUntilReady();
const metricsServer = await startWorkerMetrics(
  { token: config.METRICS_TOKEN, port: config.WORKER_METRICS_PORT },
  producer.queue,
  pool,
  () => consumer.worker.isRunning(),
);
console.log(
  `Reminder worker ready. Daily log at ${config.REMINDER_HOUR}:00 (${config.APP_TIMEZONE}). No messages are sent.`,
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 15000).unref();
  if (metricsServer) await new Promise<void>((resolve) => metricsServer.close(() => resolve()));
  await consumer.worker.close();
  await producer.queue.close();
  consumer.connection.disconnect();
  producer.connection.disconnect();
  await pool.end();
  clearTimeout(timeout);
  process.exit(0);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
