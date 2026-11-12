import 'dotenv/config';
import { z } from 'zod';
import { isIP } from 'node:net';

function validProxy(value: string) {
  const [ip, mask, extra] = value.split('/');
  const family = isIP(ip ?? '');
  return (
    family > 0 &&
    extra === undefined &&
    (mask === undefined || (/^\d+$/.test(mask) && Number(mask) <= (family === 4 ? 32 : 128)))
  );
}

const schema = z
  .object({
    TRUST_PROXY: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((ip) => ip.trim())
          .filter(Boolean),
      )
      .refine((values) => values.every(validProxy), 'Use explicit trusted proxy IPs or CIDRs.'),
    RATE_LIMIT_REDIS_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .url()
        .refine((value) => /^rediss?:\/\//i.test(value))
        .optional(),
    ),
    RATE_LIMIT_PREFIX: z
      .string()
      .regex(/^[a-zA-Z0-9:_-]{1,100}$/)
      .default('sweety:auth-rate:v1'),
    API_PROCESSES: z.coerce.number().int().min(1).max(100).default(1),
    WORKER_PROCESSES: z.coerce.number().int().min(0).max(100).default(1),
    DB_WORKER_POOL_SIZE: z.coerce.number().int().min(1).max(20).default(2),
    DB_CONNECTION_BUDGET: z.coerce.number().int().min(5).max(10000).default(80),
    DB_RESERVED_CONNECTIONS: z.coerce.number().int().min(1).max(1000).default(10),
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
    REPORT_CACHE_REDIS_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .url()
        .refine((value) => /^rediss?:\/\//i.test(value))
        .optional(),
    ),
    REDIS_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .url()
        .refine((v) => /^rediss?:\/\//i.test(v), 'Use redis:// or rediss://')
        .optional(),
    ),
    MAINTENANCE_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(500),
    MAINTENANCE_MAX_BATCHES: z.coerce.number().int().min(1).max(100).default(20),
    REMINDER_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
    WORKER_METRICS_PORT: z.coerce.number().int().min(1).max(65535).default(4002),
    REMINDER_HOUR: z.coerce.number().int().min(0).max(23).default(21),
    API_MAX_CONCURRENT: z.coerce.number().int().min(1).max(256).default(32),
    API_MAX_QUEUED: z.coerce.number().int().min(0).max(512).default(64),
    API_QUEUE_WAIT_MS: z.coerce.number().int().min(50).max(5000).default(1000),
    METRICS_TOKEN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(32).optional(),
    ),
    HASH_WORKERS: z.coerce.number().int().min(1).max(8).default(2),
    HASH_QUEUE_LIMIT: z.coerce.number().int().min(0).max(64).default(16),
    AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(30),
    DB_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  })
  .superRefine((config, context) => {
    if (
      config.API_PROCESSES * config.DB_POOL_SIZE +
        config.WORKER_PROCESSES * config.DB_WORKER_POOL_SIZE +
        config.DB_RESERVED_CONNECTIONS >
      config.DB_CONNECTION_BUDGET
    )
      context.addIssue({
        code: 'custom',
        path: ['DB_CONNECTION_BUDGET'],
        message: 'Declared process pools exceed the database connection budget.',
      });
    if (config.API_PROCESSES > 1 && !config.RATE_LIMIT_REDIS_URL)
      context.addIssue({
        code: 'custom',
        path: ['RATE_LIMIT_REDIS_URL'],
        message: 'Multiple API processes require shared authentication limits.',
      });
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
