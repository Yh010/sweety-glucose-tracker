import { loadConfig } from '../config.js';
import { createPool } from './pool.js';
import { seedDemo } from './seed.js';
const config = loadConfig();
if (config.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production.');
const pool = createPool(config);
try {
  await seedDemo(
    pool,
    config.APP_TIMEZONE,
    process.env.DEMO_EMAIL ?? 'demo@sweety.local',
    process.env.DEMO_PASSWORD ?? 'SweetyDemo123!',
  );
} finally {
  await pool.end();
}
