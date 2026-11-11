import { loadConfig } from '../../config.js';
import { createReminderQueue } from './queue.js';
import { todayInZone } from '../../lib/dates.js';
const config = loadConfig();
if (!config.REDIS_URL) throw new Error('Set REDIS_URL to queue a reminder log.');
const { queue, connection } = createReminderQueue(config.REDIS_URL);
try {
  await queue.waitUntilReady();
  const date = todayInZone(config.APP_TIMEZONE);
  const job = await queue.add('daily-reminders', { date });
  console.log(`Queued reminder log ${job.id} for ${date}. Start npm run worker to process it.`);
} finally {
  await queue.close();
  connection.disconnect();
}
