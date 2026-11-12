import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderDate } from '../src/modules/reminders/queue.js';
test('scheduled reminder dates use the due time when execution is delayed across midnight', () => {
  assert.equal(
    reminderDate(
      {
        data: {},
        opts: { prevMillis: Date.parse('2026-10-15T15:30:00Z') },
        timestamp: Date.parse('2026-10-14T15:30:00Z'),
      },
      'Asia/Kolkata',
    ),
    '2026-10-15',
  );
  assert.equal(
    reminderDate({ data: { date: '2026-10-13' }, opts: {}, timestamp: Date.now() }, 'Asia/Kolkata'),
    '2026-10-13',
  );
  assert.throws(() =>
    reminderDate({ data: { date: 'invalid' }, opts: {}, timestamp: Date.now() }, 'Asia/Kolkata'),
  );
});
