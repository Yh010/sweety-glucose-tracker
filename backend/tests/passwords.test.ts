import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { Passwords } from '../src/modules/auth/passwords.js';

test('password hashes stay compatible and execute in a worker thread', async () => {
  const passwords = new Passwords(1, 2);
  try {
    const hash = await passwords.hash('WorkerPassword123!');
    assert.equal(await bcrypt.compare('WorkerPassword123!', hash), true);
    assert.equal(await passwords.compare('WorkerPassword123!', hash), true);
    assert.equal(await passwords.compare('incorrect', hash), false);
    assert.equal(await passwords.compare('incorrect'), false);
    assert.ok(passwords.snapshot().completedThread > 0);
    assert.deepEqual(
      { running: passwords.snapshot().running, waiting: passwords.snapshot().waiting },
      { running: 0, waiting: 0 },
    );
  } finally {
    await passwords.close();
  }
});

test('password concurrency and waiting work are bounded; overload recovers', async () => {
  const passwords = new Passwords(1, 1);
  try {
    const first = passwords.hash('FirstWorker123!');
    const second = passwords.hash('SecondWorker123!');
    await assert.rejects(passwords.hash('RejectedWorker123!'), { status: 503, code: 'AUTH_BUSY' });
    assert.equal(passwords.snapshot().running, 1);
    assert.equal(passwords.snapshot().waiting, 1);
    await Promise.all([first, second]);
    assert.equal(await passwords.compare('wrong', await passwords.hash('Recovered123!')), false);
  } finally {
    await passwords.close();
  }
});

test('closing the password pool rejects pending jobs and refuses new work', async () => {
  const passwords = new Passwords(1, 1);
  const first = assert.rejects(passwords.hash('FirstWorker123!'), { code: 'AUTH_UNAVAILABLE' });
  const second = assert.rejects(passwords.hash('SecondWorker123!'), { code: 'AUTH_UNAVAILABLE' });
  await passwords.close();
  await Promise.all([first, second]);
  await assert.rejects(passwords.hash('AfterClose123!'), { code: 'AUTH_UNAVAILABLE' });
});
