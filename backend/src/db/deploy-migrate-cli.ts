import { loadConfig } from '../config.js';
import { createPool } from './pool.js';
import { migrate } from './migrate.js';

// Used by the one-shot deployment service, with the separate migration-role URL.
const pool = createPool(loadConfig());
try {
  await migrate(pool);
  await pool.query(
    'GRANT SELECT,INSERT,UPDATE,DELETE ON users,sessions,readings,reminder_events,reminder_runs TO sweety_runtime',
  );
  console.log('Deployment migrations and runtime grants applied.');
} finally {
  await pool.end();
}
