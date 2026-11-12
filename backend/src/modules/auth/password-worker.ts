import { parentPort, threadId } from 'node:worker_threads';
import bcrypt from 'bcryptjs';

const dummyHash = bcrypt.hashSync('not-a-real-user-password', 12);
parentPort!.on(
  'message',
  (job: { id: number; operation: 'hash' | 'compare'; password: string; hash?: string }) => {
    try {
      const result =
        job.operation === 'hash'
          ? bcrypt.hashSync(job.password, 12)
          : bcrypt.compareSync(job.password, job.hash ?? dummyHash);
      parentPort!.postMessage({ id: job.id, result, threadId });
    } catch {
      parentPort!.postMessage({ id: job.id, failed: true });
    }
  },
);
