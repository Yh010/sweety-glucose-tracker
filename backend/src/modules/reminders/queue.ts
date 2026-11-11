import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { todayInZone } from '../../lib/dates.js';
import { logDailyReminders } from './process.js';

export type ReminderJob = { date?: string };
export const reminderQueueName = 'sweety-reminders';
export function createReminderQueue(url: string, prefix = 'sweety:bull') {
  const connection = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    enableOfflineQueue: false,
  });
  connection.on('error', () => {});
  const queue = new Queue<ReminderJob>(reminderQueueName, {
    connection,
    prefix,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  });
  return { queue, connection };
}
export function createReminderWorker(
  pool: Pool,
  url: string,
  timezone: string,
  prefix = 'sweety:bull',
) {
  const connection = new Redis(url, { maxRetriesPerRequest: null, connectTimeout: 2000 });
  connection.on('error', () => {});
  const worker = new Worker<ReminderJob>(
    reminderQueueName,
    async (job: Job<ReminderJob>) => {
      const date = job.data.date ?? todayInZone(timezone);
      if (!job.data.date) await job.updateData({ date });
      const count = await logDailyReminders(pool, date);
      // No emails, names, glucose values or patient identifiers in the log.
      console.log(JSON.stringify({ event: 'daily_reminders_logged', date, count }));
      return { date, count };
    },
    { connection, prefix, concurrency: 1 },
  );
  worker.on('error', () => console.error(JSON.stringify({ event: 'reminder_worker_error' })));
  worker.on('failed', () => console.error(JSON.stringify({ event: 'reminder_job_failed' })));
  return { worker, connection };
}
