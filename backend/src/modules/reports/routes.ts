import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { dateSchema, reportRange, todayInZone } from '../../lib/dates.js';
import { AppError } from '../../lib/errors.js';
import type { Reading } from '../readings/schema.js';

const querySchema = z
  .object({ date: dateSchema, period: z.enum(['daily', 'mtd', 'monthly']) })
  .strict();
export function reportRoutes(pool: Pool, timezone: string): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    const { date, period } = querySchema.parse(req.query);
    if (date > todayInZone(timezone))
      throw new AppError(400, 'FUTURE_DATE', 'Date cannot be in the future.');
    const range = reportRange(date, period);
    const parameters = [req.user!.id, range.start, range.end];
    // A single query snapshot keeps the summary, chart and daily rows consistent.
    const result = await pool.query<{
      count: number;
      highest: number | null;
      lowest: number | null;
      average: string | null;
      readings: Reading[];
    }>(
      `
      WITH selected AS (
        SELECT id,date,slot,value FROM readings WHERE user_id=$1 AND date BETWEEN $2::date AND $3::date
      ) SELECT count(*)::int AS count, max(value) AS highest, min(value) AS lowest,
        round(avg(value),1)::text AS average,
        coalesce(json_agg(selected ORDER BY date, CASE slot WHEN 'fasting' THEN 0 WHEN 'after_breakfast' THEN 1 WHEN 'after_lunch' THEN 2 ELSE 3 END),'[]'::json) AS readings
      FROM selected`,
      parameters,
    );
    const row = result.rows[0]!;
    res.json({
      period,
      range,
      summary: {
        count: row.count,
        highest: row.highest,
        lowest: row.lowest,
        average: row.average === null ? null : Number(row.average),
      },
      readings: row.readings,
    });
  });
  return router;
}
