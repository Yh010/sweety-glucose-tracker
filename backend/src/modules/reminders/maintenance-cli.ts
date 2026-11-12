import { loadConfig } from '../../config.js';
import { createPool } from '../../db/pool.js';
import { todayInZone } from '../../lib/dates.js';
import { runMaintenance } from './maintenance.js';
const config = loadConfig();
const pool = createPool({ ...config, DB_POOL_SIZE: config.DB_WORKER_POOL_SIZE });
try {
  console.log(
    JSON.stringify({
      event: 'maintenance',
      ...(await runMaintenance(pool, {
        today: todayInZone(config.APP_TIMEZONE),
        batchSize: config.MAINTENANCE_BATCH_SIZE,
        maxBatches: config.MAINTENANCE_MAX_BATCHES,
        retentionDays: config.REMINDER_RETENTION_DAYS,
      })),
    }),
  );
} finally {
  await pool.end();
}
