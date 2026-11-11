import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceSession, api } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('request recovery', () => {
  it('ignores a delayed expired-session response after the account changes', async () => {
    let respond!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            respond = resolve;
          }),
      ),
    );
    const expired = vi.fn();
    window.addEventListener('session-expired', expired);
    try {
      const pending = api.report('2026-10-15', 'daily');
      advanceSession();
      respond(
        new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }), {
          status: 401,
        }),
      );
      await expect(pending).rejects.toMatchObject({ status: 401 });
      expect(expired).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('session-expired', expired);
    }
  });

  it('discards an export completing after the account changes', async () => {
    let respond!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            respond = resolve;
          }),
      ),
    );
    const pending = api.exportReport('2026-10-15', 'daily');
    advanceSession();
    respond(new Response('date,slot,value'));
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  });

  it('aborts a stalled request and clears its timer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );
    const pending = expect(
      api.save({ date: '2026-10-15', slot: 'fasting', value: 100 }),
    ).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(20000);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses a readable fallback when the server returns a non-JSON error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Service unavailable', { status: 503 })),
    );
    await expect(api.report('2026-10-15', 'daily')).rejects.toMatchObject({
      status: 503,
      code: 'REQUEST_FAILED',
      message: 'Something went wrong. Please try again.',
    });
  });
});
