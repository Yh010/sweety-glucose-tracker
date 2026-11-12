import type { RequestHandler, Response } from 'express';
import { AppError } from '../lib/errors.js';

type Waiting = { start: () => void; reject: () => void; response: Response; timer: NodeJS.Timeout };
export class Admission {
  private active = 0;
  private waiting: Waiting[] = [];
  private stopping = false;
  private rejected = 0;
  constructor(
    private concurrency: number,
    private queueLimit: number,
    private waitMs: number,
  ) {}
  snapshot() {
    return {
      active: this.active,
      waiting: this.waiting.length,
      rejected: this.rejected,
      stopping: this.stopping,
    };
  }
  middleware: RequestHandler = (req, res, next) => {
    if (['/health', '/live'].includes(req.path)) return next();
    const reject = () => {
      this.rejected++;
      next(new AppError(503, 'SERVER_BUSY', 'The service is busy. Please try again shortly.'));
    };
    if (this.stopping) return reject();
    const start = () => {
      if (res.destroyed || res.writableEnded) return;
      this.active++;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this.active--;
        while (!this.stopping && this.active < this.concurrency && this.waiting.length) {
          const queued = this.waiting.shift()!;
          clearTimeout(queued.timer);
          queued.start();
        }
      };
      res.once('finish', release);
      res.once('close', release);
      next();
    };
    if (this.active < this.concurrency) return start();
    if (this.waiting.length >= this.queueLimit) return reject();
    const queued: Waiting = {
      start,
      reject,
      response: res,
      timer: setTimeout(() => {
        this.waiting = this.waiting.filter((item) => item !== queued);
        reject();
      }, this.waitMs),
    };
    this.waiting.push(queued);
    res.once('close', () => {
      clearTimeout(queued.timer);
      this.waiting = this.waiting.filter((item) => item !== queued);
    });
  };
  stop() {
    this.stopping = true;
    this.waiting.splice(0).forEach((item) => {
      clearTimeout(item.timer);
      if (!item.response.destroyed) item.reject();
    });
  }
}
