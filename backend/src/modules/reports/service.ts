import type { Pool } from 'pg';
import type { ReportCache } from '../../infrastructure/report-cache.js';
import { reportRange, type ReportPeriod } from '../../lib/dates.js';
import type { Reading } from '../readings/schema.js';

export type Report = {
  period: ReportPeriod;
  range: { start: string; end: string };
  summary: { count: number; highest: number | null; lowest: number | null; average: number | null };
  readings: Reading[];
};
export async function getReport(
  pool: Pool,
  userId: string,
  date: string,
  period: ReportPeriod,
  cache?: ReportCache,
): Promise<Report> {
  let key: string | undefined;
  if (cache) {
    const version = await pool.query<{ report_version: string }>(
      'SELECT report_version FROM users WHERE id=$1',
      [userId],
    );
    key = `${userId}:${version.rows[0]!.report_version}:${period}:${date}`;
    const cached = await cache.get(key);
    if (cached) return cached;
  }
  const range = reportRange(date, period);
  // One PostgreSQL snapshot keeps summaries and chart points consistent.
  const result = await pool.query<{
    count: number;
    highest: number | null;
    lowest: number | null;
    average: string | null;
    readings: Reading[];
  }>(
    `
    WITH selected AS (
      SELECT id,date,slot,value,version FROM readings WHERE user_id=$1 AND date BETWEEN $2::date AND $3::date
    ) SELECT count(*)::int AS count, max(value) AS highest, min(value) AS lowest,
      round(avg(value),1)::text AS average,
      coalesce(json_agg(selected ORDER BY date, CASE slot WHEN 'fasting' THEN 0 WHEN 'after_breakfast' THEN 1 WHEN 'after_lunch' THEN 2 ELSE 3 END),'[]'::json) AS readings
    FROM selected`,
    [userId, range.start, range.end],
  );
  const row = result.rows[0]!;
  const report: Report = {
    period,
    range,
    summary: {
      count: row.count,
      highest: row.highest,
      lowest: row.lowest,
      average: row.average === null ? null : Number(row.average),
    },
    readings: row.readings,
  };
  if (cache && key) await cache.set(key, report);
  return report;
}
