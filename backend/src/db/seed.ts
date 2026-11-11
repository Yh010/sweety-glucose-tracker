import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import { todayInZone } from '../lib/dates.js';
import { slots } from '../modules/readings/schema.js';

export async function seedDemo(pool: Pool, timezone: string, email: string, password: string) {
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('Demo password must have at least 8 characters and at most 72 UTF-8 bytes.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await client.query<{ id: string }>('SELECT id FROM users WHERE email=$1', [
      email.toLowerCase(),
    ]);
    if (existing.rows[0]) {
      console.log('Demo account already exists; existing data and password were left unchanged.');
      await client.query('COMMIT');
      return;
    }
    const id = randomUUID();
    await client.query('INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)', [
      id,
      'Alex Morgan',
      email.toLowerCase(),
      passwordHash,
    ]);
    const today = todayInZone(timezone);
    const selected = new Date(`${today}T12:00:00Z`);
    // Start at the previous calendar month so all three report modes have demo data.
    const start = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() - 1, 1, 12));
    let day = 0;
    for (
      const cursor = new Date(start);
      cursor <= selected;
      cursor.setUTCDate(cursor.getUTCDate() + 1), day++
    ) {
      const date = cursor.toISOString().slice(0, 10);
      if (date !== today && day % 9 === 5) continue;
      const count = date === today ? 2 : day % 5 === 0 ? 2 : 4;
      for (let i = 0; i < count; i++) {
        const value = 94 + ((day * 7 + i * 19) % 48);
        await client.query(
          'INSERT INTO readings(id,user_id,date,slot,value) VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), id, date, slots[i], value],
        );
      }
    }
    await client.query('COMMIT');
    console.log(`Demo account created: ${email}. All sample readings are synthetic.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
