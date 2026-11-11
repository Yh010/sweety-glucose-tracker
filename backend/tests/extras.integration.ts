import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { Pool } from 'pg';
import { Redis } from 'ioredis';
import { QueueEvents } from 'bullmq';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { ReportCache } from '../src/infrastructure/report-cache.js';
import { getReport } from '../src/modules/reports/service.js';
import { logDailyReminders } from '../src/modules/reminders/process.js';
import {
  createReminderQueue,
  createReminderWorker,
  reminderQueueName,
} from '../src/modules/reminders/queue.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL || process.env.REDIS_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test'))
  throw new Error('Use a disposable TEST_DATABASE_URL ending in _test.');
if (!redisUrl)
  throw new Error('Set TEST_REDIS_URL to test the optional extras against Redis 6.2+.');
const id = randomUUID().replaceAll('-', '');
const schema = `extras_${id}`;
const prefix = `test:sweety:${id}`;
let admin: Pool, pool: Pool, redis: Redis, cache: ReportCache, server: Server, base: string;
let alice: { id: string; cookie: string },
  bob: { id: string; cookie: string },
  cara: { id: string; cookie: string };
async function call(path: string, method = 'GET', data?: unknown, cookie = alice.cookie) {
  return fetch(`${base}/api${path}`, {
    method,
    headers: { 'X-Requested-With': 'Sweety', 'Content-Type': 'application/json', Cookie: cookie },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
async function add(value = 100, slot = 'fasting', user = alice) {
  const response = await call(
    '/readings',
    'POST',
    { date: '2026-10-15', slot, value },
    user.cookie,
  );
  assert.equal(response.status, 201);
  return (await response.json()).reading;
}
const report = async (cookie = alice.cookie) =>
  (await call('/reports?date=2026-10-15&period=daily', 'GET', undefined, cookie)).json();

describe('real PostgreSQL + Redis + BullMQ extras', { concurrency: false }, () => {
  before(async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test', DATABASE_URL: databaseUrl });
    admin = createPool(config);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(databaseUrl!);
    scoped.searchParams.set('options', `-c search_path=${schema}`);
    pool = createPool({ ...config, DATABASE_URL: scoped.toString() });
    await migrate(pool);
    redis = new Redis(redisUrl!, { connectTimeout: 1000, retryStrategy: null });
    redis.on('error', () => {});
    await redis.ping();
    cache = new ReportCache(redis, `${prefix}:reports`);
    server = createApp(pool, config, cache).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    base = `http://127.0.0.1:${address.port}`;
    async function register(name: string) {
      const response = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'Sweety', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: `${name.toLowerCase()}@example.com`,
          password: 'TestingExtras123!',
        }),
      });
      assert.equal(response.status, 201);
      return {
        id: (await response.json()).user.id,
        cookie: response.headers.getSetCookie()[0]!.split(';')[0]!,
      };
    }
    alice = await register('Alice');
    bob = await register('Bob');
    cara = await register('Cara');
  });
  beforeEach(async () => {
    const keys = await redis.keys(`${prefix}:reports:*`);
    if (keys.length) await redis.del(...keys);
    await pool.query('DELETE FROM reminder_events');
    await pool.query('DELETE FROM readings');
    await pool.query('UPDATE users SET report_version=report_version+1');
  });
  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (redis) {
      const keys = await redis.keys(`${prefix}:*`);
      if (keys.length) await redis.del(...keys);
      redis.disconnect();
    }
    if (pool) await pool.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  });
  test('a full 31-day month keeps all 124 entries in reports, CSV and pagination', async () => {
    await pool.query(
      `INSERT INTO readings(id,user_id,date,slot,value)
      SELECT gen_random_uuid(),$1,day::date,slot,40+extract(day from day)::int
      FROM generate_series('2026-10-01'::date,'2026-10-31'::date,'1 day') day
      CROSS JOIN unnest(ARRAY['fasting','after_breakfast','after_lunch','after_dinner']) slot`,
      [alice.id],
    );
    const response = await call('/reports?date=2026-10-31&period=mtd');
    assert.equal(response.status, 200);
    const full = await response.json();
    assert.equal(full.summary.count, 124);
    assert.equal(full.readings.length, 124);
    assert.equal(full.summary.lowest, 41);
    assert.equal(full.summary.highest, 71);
    assert.equal(full.summary.average, 56);
    assert.deepEqual(await (await call('/reports?date=2026-10-31&period=mtd')).json(), full);
    const csv = await call('/reports/export?date=2026-11-11&period=monthly');
    assert.equal(csv.status, 200);
    assert.equal((await csv.text()).trim().split('\r\n').length, 125);
    const first = await (
      await call('/readings?from=2026-10-01&to=2026-10-31&limit=100&page=1')
    ).json();
    const second = await (
      await call('/readings?from=2026-10-01&to=2026-10-31&limit=100&page=2')
    ).json();
    assert.equal(first.readings.length, 100);
    assert.equal(second.readings.length, 24);
    assert.equal(
      new Set([...first.readings, ...second.readings].map((r: { id: string }) => r.id)).size,
      124,
    );
  });
  test('malformed cache records fall back to the database', async () => {
    await add(131);
    await report();
    const keys = await redis.keys(`${prefix}:reports:${alice.id}:*`);
    assert.equal(keys.length, 1);
    for (const value of ['{', '{}', '{"summary":{"count":1}}']) {
      await redis.set(keys[0]!, value);
      const response = await report();
      assert.equal(response.summary.average, 131);
      assert.equal(response.readings.length, 1);
    }
  });
  test('reports are cached per patient, have bounded retention, and invalidate on create/edit/delete', async () => {
    const created = await add();
    const first = await report();
    assert.equal(first.summary.average, 100);
    const keys = await redis.keys(`${prefix}:reports:${alice.id}:*`);
    assert.equal(keys.length, 1);
    assert.ok((await redis.ttl(keys[0]!)) > 0);
    assert.deepEqual(await report(), first);
    assert.equal((await report(bob.cookie)).summary.count, 0);
    await call(`/readings/${created.id}`, 'PUT', {
      date: '2026-10-15',
      slot: 'fasting',
      value: 150,
    });
    // Simulate an old request finishing its cache write after the mutation committed.
    await cache.set(keys[0]!.slice(`${prefix}:reports:`.length), first);
    assert.equal((await report()).summary.average, 150);
    await add(200, 'after_lunch');
    assert.equal((await report()).summary.count, 2);
    await call(`/readings/${created.id}`, 'DELETE');
    const changed = await report();
    assert.equal(changed.summary.count, 1);
    assert.equal(changed.summary.average, 200);
  });
  test('reports still work when the optional cache connection is unavailable', async () => {
    await add(110);
    const disconnected = redis.duplicate({ lazyConnect: true });
    disconnected.disconnect();
    try {
      const result = await getReport(
        pool,
        alice.id,
        '2026-10-15',
        'daily',
        new ReportCache(disconnected),
      );
      assert.equal(result.summary.average, 110);
    } finally {
      disconnected.disconnect();
    }
  });
  test('CSV exports use the chosen range and only the authenticated patient', async () => {
    await add(110);
    await add(500, 'fasting', bob);
    const response = await call('/reports/export?date=2026-10-15&period=daily');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type')!, /text\/csv/);
    assert.match(response.headers.get('content-disposition')!, /2026-10-15.*csv/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
    const csv = bytes.toString('utf8');
    assert.match(csv, /"2026-10-15","Morning \(fasting\)","110"/);
    assert.equal(csv.includes('500'), false);
    assert.ok(csv.includes('\r\n'));
    const unauthorized = await fetch(`${base}/api/reports/export?date=2026-10-15&period=daily`);
    assert.equal(unauthorized.status, 401);
    const empty = await call('/reports/export?date=2026-09-01&period=daily');
    assert.equal((await empty.text()).trim().split('\r\n').length, 1);
  });
  test('reminder logs exclude complete days and do not duplicate on retries', async () => {
    await add(100);
    await add(110, 'after_lunch');
    for (const slot of ['fasting', 'after_breakfast', 'after_lunch', 'after_dinner'])
      await add(120, slot, bob);
    assert.equal(await logDailyReminders(pool, '2026-10-15'), 2);
    assert.equal(await logDailyReminders(pool, '2026-10-15'), 0);
    const rows = await pool.query(
      'SELECT user_id,reading_count FROM reminder_events ORDER BY reading_count',
    );
    assert.deepEqual(rows.rows, [
      { user_id: cara.id, reading_count: 0 },
      { user_id: alice.id, reading_count: 2 },
    ]);
  });
  test('a real BullMQ worker processes a queued job and the daily scheduler keeps its timezone', async () => {
    const queuePrefix = `${prefix}:queue`;
    const producer = createReminderQueue(redisUrl!, queuePrefix);
    const consumer = createReminderWorker(pool, redisUrl!, 'Asia/Kolkata', queuePrefix);
    const eventConnection = redis.duplicate({ maxRetriesPerRequest: null });
    const events = new QueueEvents(reminderQueueName, {
      connection: eventConnection,
      prefix: queuePrefix,
    });
    try {
      await Promise.all([
        producer.queue.waitUntilReady(),
        consumer.worker.waitUntilReady(),
        events.waitUntilReady(),
      ]);
      const job = await producer.queue.add('daily-reminders', { date: '2026-10-15' });
      const result = await job.waitUntilFinished(events, 15000);
      assert.equal(result.count, 3);
      const retry = await producer.queue.add('daily-reminders', { date: '2026-10-15' });
      assert.equal((await retry.waitUntilFinished(events, 15000)).count, 0);
      await producer.queue.upsertJobScheduler(
        'daily-test',
        { pattern: '0 21 * * *', tz: 'Asia/Kolkata' },
        { name: 'daily-reminders', data: {} },
      );
      const scheduler = await producer.queue.getJobScheduler('daily-test');
      assert.equal(scheduler?.pattern, '0 21 * * *');
      assert.equal(scheduler?.tz, 'Asia/Kolkata');
    } finally {
      await consumer.worker.close();
      await events.close();
      eventConnection.disconnect();
      consumer.connection.disconnect();
      await producer.queue.obliterate({ force: true });
      await producer.queue.close();
      producer.connection.disconnect();
    }
  });
});
