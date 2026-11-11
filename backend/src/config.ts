import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  APP_TIMEZONE: z
    .string()
    .default('Asia/Kolkata')
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: zone });
        return true;
      } catch {
        return false;
      }
    }, 'Use a valid IANA timezone'),
  REDIS_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .url()
      .refine(
        (v) => ['redis:', 'rediss:'].includes(new URL(v).protocol),
        'Use redis:// or rediss://',
      )
      .optional(),
  ),
  REMINDER_HOUR: z.coerce.number().int().min(0).max(23).default(21),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
});

export type Config = z.infer<typeof schema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    // Do not include environment values (which may contain credentials) in diagnostics.
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return result.data;
}
