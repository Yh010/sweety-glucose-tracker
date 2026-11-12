import type { Pool } from 'pg';
import { z } from 'zod';
import { transaction } from '../../db/transaction.js';
import { dateSchema } from '../../lib/dates.js';

export async function runMaintenance(
  pool: Pool,
  options: { today: string; batchSize?: number; maxBatches?: number; retentionDays?: number },
) {
  dateSchema.parse(options.today);
  const batchSize = z
    .number()
    .int()
    .min(1)
    .max(1000)
    .parse(options.batchSize ?? 500);
  const maxBatches = z
    .number()
    .int()
    .min(1)
    .max(100)
    .parse(options.maxBatches ?? 20);
  const retention = z
    .number()
    .int()
    .min(1)
    .max(3650)
    .parse(options.retentionDays ?? 90);
  const cutoff = new Date(`${options.today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - retention);
  const totals = { sessions: 0, reminders: 0, runs: 0, more: false };
  for (let batch = 0; batch < maxBatches; batch++) {
    const counts = await transaction(pool, async (client) => {
      const sessions = await client.query(
        `DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires_at < now() ORDER BY expires_at LIMIT $1 FOR UPDATE SKIP LOCKED)`,
        [batchSize],
      );
      const reminders = await client.query(
        `DELETE FROM reminder_events WHERE id IN (SELECT id FROM reminder_events WHERE date < $1::date ORDER BY date,id LIMIT $2 FOR UPDATE SKIP LOCKED)`,
        [cutoff.toISOString().slice(0, 10), batchSize],
      );
      const runs = await client.query(
        `DELETE FROM reminder_runs WHERE date IN (SELECT date FROM reminder_runs WHERE date < $1::date ORDER BY date LIMIT $2 FOR UPDATE SKIP LOCKED)`,
        [cutoff.toISOString().slice(0, 10), batchSize],
      );
      return {
        sessions: sessions.rowCount ?? 0,
        reminders: reminders.rowCount ?? 0,
        runs: runs.rowCount ?? 0,
      };
    });
    totals.sessions += counts.sessions;
    totals.reminders += counts.reminders;
    totals.runs += counts.runs;
    totals.more = Object.values(counts).some((count) => count === batchSize);
    if (!totals.more) break;
  }
  return totals;
}
