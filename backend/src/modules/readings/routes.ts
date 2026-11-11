import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { todayInZone } from '../../lib/dates.js';
import { AppError } from '../../lib/errors.js';
import { listSchema, readingSchema, type Reading } from './schema.js';
import { saveReading } from './repository.js';

export function readingRoutes(pool: Pool, timezone: string): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    const query = listSchema.parse(req.query);
    const values = [req.user!.id, query.from ?? null, query.to ?? null];
    const where =
      'user_id=$1 AND ($2::date IS NULL OR date >= $2) AND ($3::date IS NULL OR date <= $3)';
    const count = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM readings WHERE ${where}`,
      values,
    );
    const readings = await pool.query<Reading>(
      `SELECT id,date,slot,value FROM readings WHERE ${where} ORDER BY date DESC, CASE slot WHEN 'fasting' THEN 0 WHEN 'after_breakfast' THEN 1 WHEN 'after_lunch' THEN 2 ELSE 3 END LIMIT $4 OFFSET $5`,
      [...values, query.limit, (query.page - 1) * query.limit],
    );
    res.json({
      readings: readings.rows,
      pagination: { page: query.page, limit: query.limit, total: count.rows[0]!.total },
    });
  });
  router.post('/', async (req, res) => {
    const input = readingSchema.parse(req.body);
    if (input.date > todayInZone(timezone))
      throw new AppError(400, 'FUTURE_DATE', 'Date cannot be in the future.');
    res.status(201).json({ reading: await saveReading(pool, req.user!.id, input) });
  });
  router.put('/:id', async (req, res) => {
    const id = z.uuid('Invalid reading ID.').parse(req.params.id);
    const input = readingSchema.parse(req.body);
    if (input.date > todayInZone(timezone))
      throw new AppError(400, 'FUTURE_DATE', 'Date cannot be in the future.');
    res.json({ reading: await saveReading(pool, req.user!.id, input, id) });
  });
  router.delete('/:id', async (req, res) => {
    const id = z.uuid('Invalid reading ID.').parse(req.params.id);
    const result = await pool.query('DELETE FROM readings WHERE id=$1 AND user_id=$2', [
      id,
      req.user!.id,
    ]);
    if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'Reading not found.');
    res.status(204).end();
  });
  return router;
}
