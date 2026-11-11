import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { dateSchema, todayInZone } from '../../lib/dates.js';
import { AppError } from '../../lib/errors.js';
import type { ReportCache } from '../../infrastructure/report-cache.js';
import { getReport } from './service.js';
import { reportToCsv } from './csv.js';

const querySchema = z
  .object({ date: dateSchema, period: z.enum(['daily', 'mtd', 'monthly']) })
  .strict();
export function reportRoutes(pool: Pool, timezone: string, cache?: ReportCache): Router {
  const router = Router();
  router.get(['/', '/export'], async (req, res) => {
    const { date, period } = querySchema.parse(req.query);
    if (date > todayInZone(timezone))
      throw new AppError(400, 'FUTURE_DATE', 'Date cannot be in the future.');
    const report = await getReport(pool, req.user!.id, date, period, cache);
    if (req.path === '/export') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="sweety-${period}-${report.range.start}-to-${report.range.end}.csv"`,
      );
      res.send(reportToCsv(report));
    } else res.json(report);
  });
  return router;
}
