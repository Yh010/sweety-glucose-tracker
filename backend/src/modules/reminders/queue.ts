import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { todayInZone, dateSchema } from '../../lib/dates.js';
import { runMaintenance } from './maintenance.js';
import { logDailyReminders } from './process.js';

export type ReminderJob = { date?: string };
export const reminderQueueName = 'sweety-reminders';
export function reminderDate(
  job: Pick<Job<ReminderJob>, 'data' | 'opts' | 'timestamp'>,
  timezone: string,
): string {
  const date =
    job.data.date ?? todayInZone(timezone, new Date(job.opts.prevMillis ?? job.timestamp));
  return dateSchema.parse(date);
}
export function createReminderQueue(url: string, prefix = 'sweety:bull') {
  const connection = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 2000,
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
  queue.on('error', () => console.error(JSON.stringify({ event: 'reminder_queue_error' })));
  return { queue, connection };
}
export function createReminderWorker(
  pool: Pool,
  url: string,
  timezone: string,
  prefix = 'sweety:bull',
  options: { batchSize?: number; maxMaintenanceBatches?: number; retentionDays?: number } = {},
) {
  const connection = new Redis(url, { maxRetriesPerRequest: null, connectTimeout: 2000 });
  connection.on('error', () => {});
  const worker = new Worker<ReminderJob>(
    reminderQueueName,
    async (job: Job<ReminderJob>) => {
      if (job.name === 'database-maintenance')
        return runMaintenance(pool, {
          today: todayInZone(timezone),
          batchSize: options.batchSize,
          maxBatches: options.maxMaintenanceBatches,
          retentionDays: options.retentionDays,
        });
      const date = reminderDate(job, timezone);
      const cutoff = new Date(`${todayInZone(timezone)}T00:00:00Z`);
      cutoff.setUTCDate(cutoff.getUTCDate() - (options.retentionDays ?? 90));
      if (date < cutoff.toISOString().slice(0, 10)) return { date, count: 0, expired: true };
      if (!job.data.date) await job.updateData({ date });
      const count = await logDailyReminders(pool, date, {
        batchSize: options.batchSize,
        onBatch: async (progress) => {
          await job.updateProgress(progress);
        },
      });
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
