import type { Pool } from 'pg';
import { z } from 'zod';
import { dateSchema } from '../../lib/dates.js';
import { transaction } from '../../db/transaction.js';

export type ReminderProgress = { processed: number; inserted: number; completed: boolean };
export async function logDailyReminders(
  pool: Pool,
  date: string,
  options: { batchSize?: number; onBatch?: (progress: ReminderProgress) => Promise<void> } = {},
): Promise<number> {
  dateSchema.parse(date);
  const batchSize = z
    .number()
    .int()
    .min(1)
    .max(1000)
    .parse(options.batchSize ?? 500);
  let created = 0;
  for (;;) {
    const batch = await transaction(pool, async (client) => {
      await client.query(
        `INSERT INTO reminder_runs(date,upper_bound) VALUES($1,(SELECT id FROM users ORDER BY id DESC LIMIT 1)) ON CONFLICT(date) DO NOTHING`,
        [date],
      );
      const run = (
        await client.query<{
          cursor: string | null;
          upper_bound: string | null;
          started_at: Date;
          processed: string;
          inserted: string;
          completed: boolean;
        }>('SELECT * FROM reminder_runs WHERE date=$1 FOR UPDATE', [date])
      ).rows[0]!;
      if (run.completed)
        return {
          processed: Number(run.processed),
          inserted: Number(run.inserted),
          completed: true,
          added: 0,
        };
      const result = await client.query<{ added: number; count: number; cursor: string | null }>(
        `
        WITH cohort AS MATERIALIZED (
          SELECT id FROM users WHERE ($2::uuid IS NULL OR id>$2::uuid) AND id<=$3::uuid AND created_at<=(SELECT started_at FROM reminder_runs WHERE date=$1::date)
          ORDER BY id LIMIT $4
        ), inserted AS (
          INSERT INTO reminder_events(user_id,date,reading_count)
          SELECT u.id,$1::date,count(r.id)::int FROM cohort u LEFT JOIN readings r ON r.user_id=u.id AND r.date=$1::date
          GROUP BY u.id HAVING count(r.id)<4 ON CONFLICT(user_id,date) DO NOTHING RETURNING id
        ) SELECT (SELECT count(*)::int FROM inserted) AS added, (SELECT count(*)::int FROM cohort) AS count,
          (SELECT id FROM cohort ORDER BY id DESC LIMIT 1) AS cursor`,
        [date, run.cursor, run.upper_bound, batchSize],
      );
      const row = result.rows[0]!;
      const completed = row.count < batchSize;
      await client.query(
        'UPDATE reminder_runs SET cursor=coalesce($2,cursor),processed=processed+$3,inserted=inserted+$4,completed=$5,updated_at=now() WHERE date=$1',
        [date, row.cursor, row.count, row.added, completed],
      );
      return {
        processed: Number(run.processed) + row.count,
        inserted: Number(run.inserted) + row.added,
        completed,
        added: row.added,
      };
    });
    created += batch.added;
    // The checkpoint and events are committed together before queue progress is published.
    await options.onBatch?.({
      processed: batch.processed,
      inserted: batch.inserted,
      completed: batch.completed,
    });
    if (batch.completed) return created;
  }
}
