import { loadConfig } from '../config.js';
import { createPool } from './pool.js';
import { migrate } from './migrate.js';

const pool = createPool(loadConfig());
try { await migrate(pool); console.log('Database migrations applied.'); }
finally { await pool.end(); }
