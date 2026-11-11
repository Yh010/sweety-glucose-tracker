import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateSchema, reportRange, todayInZone } from '../src/lib/dates.js';
import { readingSchema } from '../src/modules/readings/schema.js';

test('calendar dates reject overflow and allow leap days', () => {
  for (const value of ['2026-02-29', '2026-04-31', 'not-a-date', '2026-13-01', '1899-12-31'])
    assert.equal(dateSchema.safeParse(value).success, false);
  assert.equal(dateSchema.parse('2024-02-29'), '2024-02-29');
});
test('report windows include the full previous calendar month across years and leap years', () => {
  assert.deepEqual(reportRange('2026-10-15', 'daily'), { start: '2026-10-15', end: '2026-10-15' });
  assert.deepEqual(reportRange('2026-10-15', 'mtd'), { start: '2026-10-01', end: '2026-10-15' });
  assert.deepEqual(reportRange('2026-10-15', 'monthly'), {
    start: '2026-09-01',
    end: '2026-09-30',
  });
  assert.deepEqual(reportRange('2026-01-01', 'monthly'), {
    start: '2025-12-01',
    end: '2025-12-31',
  });
  assert.deepEqual(reportRange('2024-03-31', 'monthly'), {
    start: '2024-02-01',
    end: '2024-02-29',
  });
});
test('today uses the application timezone at UTC midnight boundaries', () => {
  const now = new Date('2026-11-10T20:00:00Z');
  assert.equal(todayInZone('Asia/Kolkata', now), '2026-11-11');
  assert.equal(todayInZone('America/New_York', now), '2026-11-10');
});
test('reading values are strict JSON numbers and inclusive integers from 40 to 600', () => {
  const input = { date: '2026-10-15', slot: 'fasting' };
  for (const value of [undefined, null, '', '100', 39, 601, 100.5, true])
    assert.equal(readingSchema.safeParse({ ...input, value }).success, false);
  for (const value of [40, 600])
    assert.equal(readingSchema.parse({ ...input, value }).value, value);
  assert.equal(readingSchema.safeParse({ ...input, value: 100, slot: 'snack' }).success, false);
});
