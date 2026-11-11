import { Redis } from 'ioredis';
import { cachedReportSchema } from '../modules/reports/schema.js';
import type { Report } from '../modules/reports/service.js';

export class ReportCache {
  constructor(
    private redis: Redis,
    private prefix = 'sweety:reports:v1',
  ) {}
  private key(key: string) {
    return `${this.prefix}:${key}`;
  }
  async get(key: string): Promise<Report | null> {
    if (this.redis.status !== 'ready') return null;
    try {
      const value = await this.redis.get(this.key(key));
      if (!value) return null;
      const parsed = cachedReportSchema.safeParse(JSON.parse(value));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
  async set(key: string, report: Report): Promise<void> {
    if (this.redis.status !== 'ready') return;
    // Versions invalidate immediately. TTL bounds storage of unreachable older versions.
    try {
      await this.redis.set(this.key(key), JSON.stringify(report), 'EX', 600);
    } catch {
      /* PostgreSQL remains the source of truth. */
    }
  }
}

export function connectReportCache(url: string) {
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    commandTimeout: 1000,
    retryStrategy: (attempt) => Math.min(attempt * 250, 5000),
  });
  let warned = false;
  redis.on('error', () => {
    if (!warned)
      console.warn(JSON.stringify({ event: 'report_cache_unavailable', fallback: 'postgresql' }));
    warned = true;
  });
  redis.on('ready', () => {
    warned = false;
  });
  void redis.connect().catch(() => {});
  return { cache: new ReportCache(redis), close: () => redis.disconnect() };
}
