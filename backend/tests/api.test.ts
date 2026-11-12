import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { todayInZone } from '../src/lib/dates.js';
import { seedDemo } from '../src/db/seed.js';
import { transaction } from '../src/db/transaction.js';
import { slots } from '../src/modules/readings/schema.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (
  !databaseUrl ||
  databaseUrl === process.env.DATABASE_URL ||
  !new URL(databaseUrl).pathname.endsWith('_test')
) {
  throw new Error(
    'Set TEST_DATABASE_URL to a separate disposable database whose name ends with _test. See .env.example.',
  );
}
const schema = `test_${randomUUID().replaceAll('-', '')}`;
let closeServices: () => Promise<void>;
let admin: Pool, pool: Pool, server: Server, base: string;
let aliceCookie: string, bobCookie: string, aliceId: string;
const credentials = { email: 'alice@example.com', password: 'securePassword123!' };
async function call(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie?: string,
  headers: Record<string, string> = {},
) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'Sweety',
      Origin: 'http://localhost:5173',
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = response.status === 204 ? null : await response.json();
  return {
    status: response.status,
    data,
    cookie: response.headers
      .getSetCookie()
      .find((c) => c.startsWith('sweety_session='))
      ?.split(';')[0],
    headers: response.headers,
  };
}
const reading = (overrides: Record<string, unknown> = {}) => ({
  date: '2026-10-15',
  slot: 'fasting',
  value: 100,
  ...overrides,
});
const update = (overrides: Record<string, unknown> = {}) => reading({ version: 1, ...overrides });
const add = (overrides: Record<string, unknown> = {}, cookie = aliceCookie) =>
  call('/readings', 'POST', reading(overrides), cookie);

describe('PostgreSQL-backed API', { concurrency: false }, () => {
  before(async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATABASE_URL: databaseUrl });
    admin = createPool(config);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(databaseUrl!);
    scoped.searchParams.set('options', `-c search_path=${schema}`);
    pool = createPool({ ...config, DATABASE_URL: scoped.toString() });
    await migrate(pool);
    await migrate(pool); // Migration replay must be safe.
    const app = createApp(pool, config);
    closeServices = app.locals.closeServices;
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    base = `http://127.0.0.1:${address.port}`;
    const alice = await call('/auth/register', 'POST', { ...credentials, name: 'Alice' });
    assert.equal(alice.status, 201);
    aliceCookie = alice.cookie!;
    aliceId = alice.data.user.id;
    const bob = await call('/auth/register', 'POST', {
      name: 'Bob',
      email: 'bob@example.com',
      password: 'anotherPassword123!',
    });
    assert.equal(bob.status, 201);
    bobCookie = bob.cookie!;
  });
  beforeEach(async () => {
    await pool.query('DELETE FROM readings');
  });
  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (closeServices) await closeServices();
    if (pool) await pool.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  });
  test('registration rolls back the account when session creation fails, then retries cleanly', async () => {
    await pool.query(`CREATE FUNCTION reject_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic session failure'; END $$;
      CREATE TRIGGER reject_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_session()`);
    const input = {
      name: 'Atomic registration',
      email: 'atomic@example.com',
      password: 'SyntheticAtomic123!',
    };
    try {
      const failed = await call('/auth/register', 'POST', input);
      assert.equal(failed.status, 500);
      assert.equal(failed.headers.getSetCookie().length, 0);
      assert.equal(
        (await pool.query('SELECT count(*)::int AS count FROM users WHERE email=$1', [input.email]))
          .rows[0].count,
        0,
      );
    } finally {
      await pool.query('DROP TRIGGER reject_session ON sessions; DROP FUNCTION reject_session()');
    }
    const retried = await call('/auth/register', 'POST', input);
    assert.equal(retried.status, 201);
    assert.equal((await call('/auth/me', 'GET', undefined, retried.cookie)).status, 200);
  });
  test('failed session replacement keeps the previous login valid and sends no cookie', async () => {
    await pool.query(`CREATE FUNCTION reject_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic session failure'; END $$;
      CREATE TRIGGER reject_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_session()`);
    try {
      const failed = await call('/auth/login', 'POST', credentials, aliceCookie);
      assert.equal(failed.status, 500);
      assert.equal(failed.headers.getSetCookie().length, 0);
      assert.equal((await call('/auth/me', 'GET', undefined, aliceCookie)).status, 200);
    } finally {
      await pool.query('DROP TRIGGER reject_session ON sessions; DROP FUNCTION reject_session()');
    }
  });
  test('deletion waits for the patient lock before taking a reading lock', async () => {
    const created = await add();
    const control = await pool.connect();
    let deletion: ReturnType<typeof call> | undefined;
    try {
      await control.query('BEGIN');
      await control.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [aliceId]);
      const pid = (await control.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      deletion = call(`/readings/${created.data.reading.id}`, 'DELETE', undefined, aliceCookie);
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await pool.query(
          'SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS blocked',
          [pid],
        );
        if (result.rows[0].blocked) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(blocked, 'the delete must overlap the patient transaction');
      // The old DELETE CTE held this lock while waiting for the patient, causing a deadlock.
      const available = await control.query(
        'SELECT id FROM readings WHERE id=$1 FOR UPDATE NOWAIT',
        [created.data.reading.id],
      );
      assert.equal(available.rowCount, 1);
    } finally {
      await control.query('ROLLBACK');
      control.release();
      if (deletion) assert.equal((await deletion).status, 204);
    }
  });
  test('overlapping edits and deletions never return a server error', async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const created = await add();
      const id = created.data.reading.id;
      const [edit, deletion] = await Promise.all([
        call(`/readings/${id}`, 'PUT', update({ value: 111 }), aliceCookie),
        call(`/readings/${id}`, 'DELETE', undefined, aliceCookie),
      ]);
      assert.ok([200, 404].includes(edit.status));
      assert.equal(deletion.status, 204);
      assert.equal(
        (await pool.query('SELECT count(*)::int AS count FROM readings WHERE id=$1', [id])).rows[0]
          .count,
        0,
      );
    }
  });
  test('transaction retries roll back partial work and have a fixed retry limit', async () => {
    let attempts = 0;
    const id = randomUUID();
    await transaction(pool, async (client) => {
      attempts++;
      await client.query(
        'INSERT INTO readings(id,user_id,date,slot,value) VALUES($1,$2,$3,$4,$5)',
        [id, aliceId, '2026-10-15', 'fasting', 100],
      );
      if (attempts === 1)
        throw Object.assign(new Error('synthetic serialization conflict'), { code: '40001' });
    });
    assert.equal(attempts, 2);
    assert.equal(
      (await pool.query('SELECT count(*)::int AS count FROM readings WHERE id=$1', [id])).rows[0]
        .count,
      1,
    );
    attempts = 0;
    await assert.rejects(
      transaction(pool, async () => {
        attempts++;
        throw Object.assign(new Error('synthetic deadlock'), { code: '40P01' });
      }),
      { code: '40P01' },
    );
    assert.equal(attempts, 3);
    attempts = 0;
    await assert.rejects(
      transaction(pool, async () => {
        attempts++;
        throw new Error('non-retryable');
      }),
      /non-retryable/,
    );
    assert.equal(attempts, 1);
  });
  test('operational metrics require a secret and readiness fails while draining', async () => {
    const token = 'synthetic-metrics-token-1234567890';
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      METRICS_TOKEN: token,
    });
    const app = createApp(pool, config);
    const instance = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => instance.once('listening', resolve));
    const address = instance.address();
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}`;
    try {
      assert.equal((await fetch(`${url}/internal/metrics`)).status, 401);
      const health = await fetch(`${url}/api/health`);
      assert.equal(health.status, 200);
      assert.ok(health.headers.get('x-request-id'));
      const response = await fetch(`${url}/internal/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
      const snapshot = await response.json();
      assert.ok(snapshot.requests.requests >= 2);
      assert.equal(typeof snapshot.database.waiting, 'number');
      assert.equal(typeof snapshot.passwords.running, 'number');
      assert.equal(snapshot.admission.waiting, 0);
      app.locals.beginShutdown();
      assert.equal((await fetch(`${url}/api/health`)).status, 503);
      assert.equal((await fetch(`${url}/api/live`)).status, 200);
      assert.equal((await fetch(`${url}/api/meta`)).status, 503);
    } finally {
      await new Promise<void>((resolve) => instance.close(() => resolve()));
      await app.locals.closeServices();
    }
  });
  test('authentication throttling is enforced without blocking health or profile reads', async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      AUTH_RATE_LIMIT: '1',
    });
    const limited = createApp(pool, config).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => limited.once('listening', resolve));
    const address = limited.address();
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}/api`;
    try {
      const options = {
        method: 'POST',
        headers: { 'X-Requested-With': 'Sweety', 'Content-Type': 'application/json' },
        body: '{}',
      };
      assert.equal((await fetch(`${url}/auth/login`, options)).status, 400);
      const blocked = await fetch(`${url}/auth/login`, options);
      assert.equal(blocked.status, 429);
      assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
      assert.ok(blocked.headers.get('retry-after'));
      assert.equal((await fetch(`${url}/health`)).status, 200);
      assert.equal(
        (await fetch(`${url}/auth/me`, { headers: { Cookie: aliceCookie } })).status,
        200,
      );
    } finally {
      await new Promise<void>((resolve) => limited.close(() => resolve()));
    }
  });
  test('hashes passwords using bcrypt and normalizes emails', async () => {
    const row = await pool.query('SELECT password_hash FROM users WHERE id=$1', [aliceId]);
    assert.notEqual(row.rows[0].password_hash, credentials.password);
    assert.equal(await bcrypt.compare(credentials.password, row.rows[0].password_hash), true);
    const result = await call('/auth/login', 'POST', {
      email: ' ALICE@EXAMPLE.COM ',
      password: credentials.password,
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.user.id, aliceId);
    const cookieHeader = result.headers.get('set-cookie')!;
    assert.match(cookieHeader, /HttpOnly/);
    assert.match(cookieHeader, /SameSite=Lax/);
    assert.match(cookieHeader, /Path=\/api/);
    assert.equal('password_hash' in result.data.user, false);
  });
  test('rejects duplicate email registration regardless of case', async () => {
    const result = await call('/auth/register', 'POST', {
      ...credentials,
      email: 'ALICE@example.com',
      name: 'Someone else',
    });
    assert.equal(result.status, 409);
    assert.equal(result.data.error.code, 'EMAIL_EXISTS');
  });
  test('login errors do not distinguish missing accounts from bad passwords', async () => {
    const wrong = await call('/auth/login', 'POST', { ...credentials, password: 'wrong' });
    const missing = await call('/auth/login', 'POST', {
      ...credentials,
      email: 'missing@example.com',
    });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.data, missing.data);
  });
  test('rejects passwords longer than bcrypt’s UTF-8 byte limit', async () => {
    const result = await call('/auth/register', 'POST', {
      name: 'Long',
      email: 'long@example.com',
      password: 'é'.repeat(40),
    });
    assert.equal(result.status, 400);
  });
  test('requires authentication and rejects cross-origin mutations', async () => {
    assert.equal((await call('/readings')).status, 401);
    assert.equal((await call('/reports?date=2026-10-15&period=daily')).status, 401);
    assert.equal(
      (
        await call('/readings', 'POST', reading(), aliceCookie, {
          Origin: 'https://unrelated.example',
        })
      ).status,
      403,
    );
    assert.equal(
      (await call('/readings', 'POST', reading(), aliceCookie, { 'X-Requested-With': '' })).status,
      403,
    );
  });
  test('metadata supplies the date and configured timezone', async () => {
    const result = await call('/meta');
    assert.equal(result.data.today, todayInZone('Asia/Kolkata'));
    assert.equal(result.data.timezone, 'Asia/Kolkata');
  });
  test('creates, lists, updates and deletes a reading', async () => {
    const created = await add();
    assert.equal(created.status, 201);
    const id = created.data.reading.id;
    const list = await call(
      '/readings?from=2026-10-15&to=2026-10-15',
      'GET',
      undefined,
      aliceCookie,
    );
    assert.equal(list.data.readings.length, 1);
    assert.equal(list.data.readings[0].date, '2026-10-15');
    const updated = await call(
      `/readings/${id}`,
      'PUT',
      update({ date: '2026-10-14', slot: 'after_lunch', value: 120 }),
      aliceCookie,
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.data.reading.value, 120);
    assert.equal((await call(`/readings/${id}`, 'DELETE', undefined, aliceCookie)).status, 204);
    assert.equal((await call(`/readings/${id}`, 'DELETE', undefined, aliceCookie)).status, 404);
  });
  test('rejects empty, fractional, nonnumeric and out-of-range values', async () => {
    for (const value of [null, '', '100', 39, 601, 100.5, true])
      assert.equal((await add({ value })).status, 400);
    const { value: _value, ...noValue } = reading();
    assert.equal(
      (await call('/readings', 'POST', noValue, aliceCookie)).data.error.message,
      'Please enter a glucose value.',
    );
    assert.equal((await add({ value: 40 })).status, 201);
    assert.equal((await add({ value: 600, slot: 'after_lunch' })).status, 201);
  });
  test('rejects invalid slots, invalid calendar dates, future dates and ownership fields', async () => {
    for (const input of [
      { slot: 'snack' },
      { date: '2026-02-30' },
      { date: '2999-01-01' },
      { user_id: aliceId },
    ])
      assert.equal((await add(input)).status, 400);
    assert.equal((await add({ date: '2999-01-01' })).data.error.code, 'FUTURE_DATE');
  });
  test('allows each slot once and reports a clear daily limit', async () => {
    await add();
    const duplicate = await add();
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.data.error.code, 'DUPLICATE_SLOT');
    for (const slot of slots.slice(1)) assert.equal((await add({ slot })).status, 201);
    assert.equal((await add()).data.error.code, 'DAILY_LIMIT');
    assert.equal((await add({ date: '2026-10-16' })).status, 201);
  });
  test('simultaneous duplicate requests create exactly one reading', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => add()));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 5);
  });
  test('simultaneous slot submissions cannot exceed four readings', async () => {
    const results = await Promise.all([...slots, ...slots].map((slot) => add({ slot })));
    assert.equal(results.filter((r) => r.status === 201).length, 4);
    const total = await pool.query('SELECT count(*)::int AS count FROM readings WHERE user_id=$1', [
      aliceId,
    ]);
    assert.equal(total.rows[0].count, 4);
  });
  test('outdated edits are rejected and the latest version is preserved', async () => {
    const created = await add();
    assert.equal(created.data.reading.version, 1);
    const path = `/readings/${created.data.reading.id}`;
    const missing = await call(path, 'PUT', reading({ value: 111 }), aliceCookie);
    assert.equal(missing.status, 400);
    const results = await Promise.all([
      call(path, 'PUT', update({ value: 111 }), aliceCookie),
      call(path, 'PUT', update({ value: 122 }), aliceCookie),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(results.find((r) => r.status === 409)!.data.error.code, 'STALE_READING');
    const latest = (
      await pool.query('SELECT value,version FROM readings WHERE id=$1', [created.data.reading.id])
    ).rows[0];
    assert.equal(latest.version, 2);
    assert.equal(latest.value, results.find((r) => r.status === 200)!.data.reading.value);
    const saved = await call(
      path,
      'PUT',
      update({ value: 133, version: latest.version }),
      aliceCookie,
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.data.reading.version, 3);
  });
  test('editing the same slot succeeds while conflicting edits roll back', async () => {
    const first = await add();
    const second = await add({ slot: 'after_lunch' });
    assert.equal(
      (await call(`/readings/${first.data.reading.id}`, 'PUT', update({ value: 110 }), aliceCookie))
        .status,
      200,
    );
    const conflict = await call(
      `/readings/${first.data.reading.id}`,
      'PUT',
      update({ slot: 'after_lunch', version: 2 }),
      aliceCookie,
    );
    assert.equal(conflict.status, 409);
    const row = await pool.query('SELECT value,slot FROM readings WHERE id=$1', [
      first.data.reading.id,
    ]);
    assert.deepEqual(row.rows[0], { value: 110, slot: 'fasting' });
    assert.ok(second.data.reading.id);
  });
  test('an edit cannot move a reading into an already full day', async () => {
    for (const slot of slots) await add({ slot });
    const other = await add({ date: '2026-10-14' });
    const result = await call(`/readings/${other.data.reading.id}`, 'PUT', update(), aliceCookie);
    assert.equal(result.data.error.code, 'DAILY_LIMIT');
  });
  test('another user cannot see, update or delete a reading, or include it in reports', async () => {
    const first = await add();
    const id = first.data.reading.id;
    assert.equal((await call('/readings', 'GET', undefined, bobCookie)).data.pagination.total, 0);
    assert.equal(
      (await call(`/readings/${id}`, 'PUT', update({ value: 500 }), bobCookie)).status,
      404,
    );
    assert.equal((await call(`/readings/${id}`, 'DELETE', undefined, bobCookie)).status, 404);
    assert.equal(
      (await call('/reports?date=2026-10-15&period=daily', 'GET', undefined, bobCookie)).data
        .summary.count,
      0,
    );
    assert.equal((await add({}, bobCookie)).status, 201);
  });
  test('database constraints independently reject invalid values and duplicate slots', async () => {
    await add();
    await assert.rejects(
      pool.query('INSERT INTO readings(id,user_id,date,slot,value) VALUES($1,$2,$3,$4,$5)', [
        randomUUID(),
        aliceId,
        '2026-10-15',
        'fasting',
        101,
      ]),
      { code: '23505' },
    );
    await assert.rejects(
      pool.query('INSERT INTO readings(id,user_id,date,slot,value) VALUES($1,$2,$3,$4,$5)', [
        randomUUID(),
        aliceId,
        '2026-10-15',
        'snack',
        100,
      ]),
      { code: '23514' },
    );
    await assert.rejects(
      pool.query('INSERT INTO readings(id,user_id,date,slot,value) VALUES($1,$2,$3,$4,$5)', [
        randomUUID(),
        aliceId,
        '2026-10-15',
        'after_lunch',
        700,
      ]),
      { code: '23514' },
    );
  });
  test('reports use inclusive boundaries and round averages to one decimal', async () => {
    await add({ date: '2026-09-01', value: 90 });
    await add({ date: '2026-09-30', value: 130 });
    await add({ date: '2026-08-31', value: 600 });
    await add({ date: '2026-10-01', value: 100 });
    await add({ value: 101 });
    await add({ slot: 'after_lunch', value: 102 });
    await add({ slot: 'after_dinner', value: 104 });
    await add({ date: '2026-10-16', value: 500 });
    const daily = (
      await call('/reports?date=2026-10-15&period=daily', 'GET', undefined, aliceCookie)
    ).data;
    assert.deepEqual(daily.summary, { count: 3, highest: 104, lowest: 101, average: 102.3 });
    assert.deepEqual(
      daily.readings.map((r: { slot: string }) => r.slot),
      ['fasting', 'after_lunch', 'after_dinner'],
    );
    const mtd = (await call('/reports?date=2026-10-15&period=mtd', 'GET', undefined, aliceCookie))
      .data;
    assert.deepEqual(mtd.summary, { count: 4, highest: 104, lowest: 100, average: 101.8 });
    const monthly = (
      await call('/reports?date=2026-10-15&period=monthly', 'GET', undefined, aliceCookie)
    ).data;
    assert.deepEqual(monthly.range, { start: '2026-09-01', end: '2026-09-30' });
    assert.deepEqual(monthly.summary, { count: 2, highest: 130, lowest: 90, average: 110 });
  });
  test('empty reports return count zero and null aggregates', async () => {
    const result = await call(
      '/reports?date=2026-10-15&period=daily',
      'GET',
      undefined,
      aliceCookie,
    );
    assert.deepEqual(result.data.summary, { count: 0, highest: null, lowest: null, average: null });
    assert.deepEqual(result.data.readings, []);
  });
  test('pagination is bounded, ordered and validated', async () => {
    for (const slot of slots) await add({ slot });
    const result = await call('/readings?page=2&limit=2', 'GET', undefined, aliceCookie);
    assert.deepEqual(result.data.pagination, { page: 2, limit: 2, total: 4 });
    assert.deepEqual(
      result.data.readings.map((r: { slot: string }) => r.slot),
      ['after_lunch', 'after_dinner'],
    );
    for (const query of ['limit=101', 'page=0', 'limit=bad', 'from=2026-10-16&to=2026-10-15'])
      assert.equal((await call(`/readings?${query}`, 'GET', undefined, aliceCookie)).status, 400);
  });
  test('seed data covers today and the previous month and can be rerun safely', async () => {
    await seedDemo(pool, 'Asia/Kolkata', 'seed@example.com', 'SeedPassword123!');
    const today = todayInZone('Asia/Kolkata');
    const rows = await pool.query(
      'SELECT r.date, count(*)::int AS count FROM readings r JOIN users u ON u.id=r.user_id WHERE u.email=$1 GROUP BY r.date',
      ['seed@example.com'],
    );
    assert.equal(rows.rows.find((row) => row.date === today)?.count, 2);
    assert.ok(rows.rows.some((row) => row.date.slice(0, 7) < today.slice(0, 7)));
    assert.ok(rows.rows.every((row) => row.count <= 4 && row.date <= today));
    const count = rows.rows.reduce((sum, row) => sum + row.count, 0);
    await seedDemo(pool, 'Asia/Kolkata', 'seed@example.com', 'ChangedPassword123!');
    const seeded = await pool.query('SELECT password_hash FROM users WHERE email=$1', [
      'seed@example.com',
    ]);
    assert.equal(await bcrypt.compare('SeedPassword123!', seeded.rows[0].password_hash), true);
    assert.equal(
      (await pool.query('SELECT count(*)::int AS count FROM readings')).rows[0].count,
      count,
    );
  });
  test('logout revokes the server session and expired sessions fail', async () => {
    const login = await call('/auth/login', 'POST', credentials);
    assert.equal((await call('/auth/me', 'GET', undefined, login.cookie)).status, 200);
    assert.equal((await call('/auth/logout', 'POST', undefined, login.cookie)).status, 204);
    assert.equal((await call('/auth/me', 'GET', undefined, login.cookie)).status, 401);
    const another = await call('/auth/login', 'POST', credentials);
    await pool.query("UPDATE sessions SET expires_at=now()-interval '1 hour' WHERE user_id=$1", [
      aliceId,
    ]);
    assert.equal((await call('/auth/me', 'GET', undefined, another.cookie)).status, 401);
  });
});
