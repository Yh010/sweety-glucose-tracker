import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';
import type { Store, Options } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

export class AuthRateStore implements Store {
  readonly localKeys = false;
  private windowMs = 15 * 60 * 1000;
  private redis: Redis;
  private starting: Promise<void>;
  constructor(
    url: string,
    readonly prefix: string,
  ) {
    this.redis = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 1000,
      commandTimeout: 1000,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
    });
    this.redis.on('error', () => {});
    this.starting = this.redis.connect().then(
      () => {},
      () => {},
    );
  }
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  private key(key: string) {
    return `${this.prefix}:${createHash('sha256').update(key).digest('hex')}`;
  }
  async increment(key: string) {
    await this.starting;
    try {
      if (this.redis.status !== 'ready') throw new Error('unavailable');
      const result = (await this.redis.eval(
        `local hits=redis.call('INCR',KEYS[1]); local ttl=redis.call('PTTL',KEYS[1]); if ttl<0 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); ttl=tonumber(ARGV[1]); end; return {hits,ttl}`,
        1,
        this.key(key),
        this.windowMs,
      )) as [number, number];
      return { totalHits: result[0], resetTime: new Date(Date.now() + result[1]) };
    } catch {
      // Never silently give every API process a fresh local allowance during an outage.
      throw new AppError(
        503,
        'RATE_LIMIT_UNAVAILABLE',
        'Sign-in is temporarily unavailable. Please try again shortly.',
      );
    }
  }
  async decrement(key: string) {
    await this.redis.eval(
      `local count=tonumber(redis.call('GET',KEYS[1]) or '0'); if count>0 then redis.call('DECR',KEYS[1]); end`,
      1,
      this.key(key),
    );
  }
  async resetKey(key: string) {
    await this.redis.del(this.key(key));
  }
  snapshot() {
    return { ready: this.redis.status === 'ready' };
  }
  shutdown() {
    this.redis.disconnect();
  }
}
