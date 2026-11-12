import { existsSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { AppError } from '../../lib/errors.js';

type Job = {
  id: number;
  operation: 'hash' | 'compare';
  password: string;
  hash?: string;
  resolve: (value: string | boolean) => void;
  reject: (error: Error) => void;
};
type Slot = { worker: Worker; job?: Job; stopped: boolean };

export class Passwords {
  private slots: Slot[] = [];
  private waiting: Job[] = [];
  private nextId = 0;
  private closed = false;
  private completedThread = 0;

  constructor(
    private concurrency = 2,
    private queueLimit = 16,
  ) {}

  hash(password: string): Promise<string> {
    return this.run('hash', password) as Promise<string>;
  }
  compare(password: string, hash?: string): Promise<boolean> {
    return this.run('compare', password, hash) as Promise<boolean>;
  }
  snapshot() {
    return {
      running: this.slots.filter((slot) => slot.job).length,
      waiting: this.waiting.length,
      workers: this.slots.length,
      completedThread: this.completedThread,
    };
  }

  private run(operation: 'hash' | 'compare', password: string, hash?: string) {
    if (this.closed) return Promise.reject(this.unavailable());
    if (this.snapshot().running >= this.concurrency && this.waiting.length >= this.queueLimit)
      return Promise.reject(
        new AppError(503, 'AUTH_BUSY', 'Sign-in is busy. Please try again shortly.'),
      );
    return new Promise<string | boolean>((resolve, reject) => {
      this.waiting.push({ id: ++this.nextId, operation, password, hash, resolve, reject });
      this.dispatch();
    });
  }
  private unavailable() {
    return new AppError(
      503,
      'AUTH_UNAVAILABLE',
      'Sign-in is temporarily unavailable. Please try again.',
    );
  }

  private dispatch() {
    if (this.closed) return;
    while (
      this.waiting.length &&
      (this.slots.some((slot) => !slot.job) || this.slots.length < this.concurrency)
    ) {
      let slot = this.slots.find((item) => !item.job);
      if (!slot) {
        const built = new URL('./password-worker.js', import.meta.url);
        const source = !existsSync(built);
        const worker = new Worker(
          source ? new URL('./password-worker.ts', import.meta.url) : built,
          { execArgv: source ? ['--import', 'tsx'] : [] },
        );
        slot = { worker, stopped: false };
        const current = slot;
        this.slots.push(current);
        worker.on(
          'message',
          (message: {
            id: number;
            result: string | boolean;
            threadId: number;
            failed?: boolean;
          }) => {
            const job = current.job;
            if (!job || message.id !== job.id) return;
            current.job = undefined;
            if (message.failed) job.reject(this.unavailable());
            else {
              this.completedThread = message.threadId;
              job.resolve(message.result);
            }
            worker.unref();
            this.dispatch();
          },
        );
        const failed = () => {
          if (current.stopped) return;
          current.stopped = true;
          current.job?.reject(this.unavailable());
          this.slots = this.slots.filter((item) => item !== current);
          // A broken worker startup must not spawn an unbounded replacement loop.
          this.waiting.splice(0).forEach((job) => job.reject(this.unavailable()));
          void worker.terminate();
        };
        worker.on('error', failed);
        worker.on('exit', failed);
      }
      const job = this.waiting.shift()!;
      slot.job = job;
      slot.worker.ref();
      slot.worker.postMessage({
        id: job.id,
        operation: job.operation,
        password: job.password,
        hash: job.hash,
      });
    }
  }
  async close() {
    this.closed = true;
    this.waiting.splice(0).forEach((job) => job.reject(this.unavailable()));
    await Promise.all(
      this.slots.map((slot) => {
        slot.stopped = true;
        slot.job?.reject(this.unavailable());
        return slot.worker.terminate();
      }),
    );
    this.slots = [];
  }
}
