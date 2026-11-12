import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { transaction } from '../../db/transaction.js';
import { AppError } from '../../lib/errors.js';
import { slotLabels, type Reading, type ReadingInput } from './schema.js';

export async function saveReading(
  pool: Pool,
  userId: string,
  input: ReadingInput,
  id?: string,
  expectedVersion?: number,
): Promise<Reading> {
  try {
    return await transaction(pool, async (client) => {
      // Serialize writes for this patient only. Other patients can write concurrently.
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (id) {
        const existing = await client.query(
          'SELECT id,version FROM readings WHERE id = $1 AND user_id = $2',
          [id, userId],
        );
        if (!existing.rowCount) throw new AppError(404, 'NOT_FOUND', 'Reading not found.');
        if (existing.rows[0].version !== expectedVersion)
          throw new AppError(
            409,
            'STALE_READING',
            'This reading changed elsewhere. Cancel editing and reopen it to see the latest value. Your draft is still here.',
          );
      }
      const count = await client.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM readings WHERE user_id = $1 AND date = $2 AND ($3::uuid IS NULL OR id <> $3)',
        [userId, input.date, id ?? null],
      );
      if (count.rows[0]!.count >= 4)
        throw new AppError(409, 'DAILY_LIMIT', 'You can add only 4 readings per day.');
      const result = id
        ? await client.query<Reading>(
            'UPDATE readings SET date=$1, slot=$2, value=$3, updated_at=now(), version=version+1 WHERE id=$4 AND user_id=$5 AND version=$6 RETURNING id, date, slot, value, version',
            [input.date, input.slot, input.value, id, userId, expectedVersion],
          )
        : await client.query<Reading>(
            'INSERT INTO readings(id,user_id,date,slot,value) VALUES($1,$2,$3,$4,$5) RETURNING id,date,slot,value,version',
            [randomUUID(), userId, input.date, input.slot, input.value],
          );
      if (!result.rowCount)
        throw new AppError(
          409,
          'STALE_READING',
          'This reading changed elsewhere. Cancel editing and reopen it to see the latest value.',
        );
      await client.query('UPDATE users SET report_version=report_version+1 WHERE id=$1', [userId]);
      return result.rows[0]!;
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505')
      throw new AppError(
        409,
        'DUPLICATE_SLOT',
        `You already have an ${slotLabels[input.slot]} reading for this date.`,
      );
    throw error;
  }
}

export async function deleteReading(pool: Pool, userId: string, id: string): Promise<void> {
  await transaction(pool, async (client) => {
    // Match saveReading: patient first, reading second, version update last.
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const deleted = await client.query(
      'DELETE FROM readings WHERE id=$1 AND user_id=$2 RETURNING id',
      [id, userId],
    );
    if (!deleted.rowCount) throw new AppError(404, 'NOT_FOUND', 'Reading not found.');
    await client.query('UPDATE users SET report_version=report_version+1 WHERE id=$1', [userId]);
  });
}
