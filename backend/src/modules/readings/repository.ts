import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { AppError } from '../../lib/errors.js';
import { slotLabels, type Reading, type ReadingInput } from './schema.js';

export async function saveReading(
  pool: Pool,
  userId: string,
  input: ReadingInput,
  id?: string,
): Promise<Reading> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize writes for this patient only. Other patients can write concurrently.
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (id) {
      const existing = await client.query(
        'SELECT id FROM readings WHERE id = $1 AND user_id = $2',
        [id, userId],
      );
      if (!existing.rowCount) throw new AppError(404, 'NOT_FOUND', 'Reading not found.');
    }
    const count = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM readings WHERE user_id = $1 AND date = $2 AND ($3::uuid IS NULL OR id <> $3)',
      [userId, input.date, id ?? null],
    );
    if (count.rows[0]!.count >= 4)
      throw new AppError(409, 'DAILY_LIMIT', 'You can add only 4 readings per day.');
    const result = id
      ? await client.query<Reading>(
          'UPDATE readings SET date=$1, slot=$2, value=$3, updated_at=now() WHERE id=$4 AND user_id=$5 RETURNING id, date, slot, value',
          [input.date, input.slot, input.value, id, userId],
        )
      : await client.query<Reading>(
          'INSERT INTO readings(id,user_id,date,slot,value) VALUES($1,$2,$3,$4,$5) RETURNING id,date,slot,value',
          [randomUUID(), userId, input.date, input.slot, input.value],
        );
    await client.query('COMMIT');
    return result.rows[0]!;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505')
      throw new AppError(
        409,
        'DUPLICATE_SLOT',
        `You already have an ${slotLabels[input.slot]} reading for this date.`,
      );
    throw error;
  } finally {
    client.release();
  }
}
