import type { Pool } from 'pg';
import { dateSchema } from '../../lib/dates.js';

export async function logDailyReminders(pool: Pool, date: string): Promise<number> {
  dateSchema.parse(date);
  // Bulk insertion keeps processing bounded in Node. The unique key makes retries idempotent.
  const result = await pool.query<{ count: number }>(
    `
    WITH inserted AS (
      INSERT INTO reminder_events(user_id,date,reading_count)
      SELECT u.id,$1::date,count(r.id)::int FROM users u
      LEFT JOIN readings r ON r.user_id=u.id AND r.date=$1::date
      GROUP BY u.id HAVING count(r.id)<4
      ON CONFLICT(user_id,date) DO NOTHING RETURNING id
    ) SELECT count(*)::int AS count FROM inserted`,
    [date],
  );
  return result.rows[0]!.count;
}
