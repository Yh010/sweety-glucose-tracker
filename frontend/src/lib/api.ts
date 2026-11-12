import type { Meta, Period, Reading, ReadingInput, Report, User } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
let sessionGeneration = 0;
export function advanceSession() {
  sessionGeneration += 1;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  read: (response: Response) => Promise<T> = (response) => response.json() as Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const generation = sessionGeneration;
  try {
    const result = await performRequest(
      path,
      { ...options, signal: controller.signal },
      read,
      generation,
    );
    if (generation !== sessionGeneration)
      throw new ApiError(0, 'SESSION_CHANGED', 'Your session changed. Please try again.');
    return result;
  } catch (error) {
    if (controller.signal.aborted)
      throw new ApiError(
        0,
        'REQUEST_TIMEOUT',
        'This request took too long. Check the log before trying again. Your inputs are still here.',
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
async function performRequest<T>(
  path: string,
  options: RequestInit = {},
  read: (response: Response) => Promise<T> = (response) => response.json() as Promise<T>,
  generation: number,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'Sweety',
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Could not connect. Check your connection and try again.',
    );
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code: string; message: string };
    } | null;
    const error = new ApiError(
      response.status,
      payload?.error?.code ?? 'REQUEST_FAILED',
      payload?.error?.message ?? 'Something went wrong. Please try again.',
    );
    if (generation === sessionGeneration && response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('session-expired'));
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return read(response);
}
export const api = {
  meta: () => request<Meta>('/meta'),
  me: () => request<{ user: User }>('/auth/me'),
  login: (input: { email: string; password: string }) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  register: (input: { name: string; email: string; password: string }) =>
    request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  readings: (date: string) =>
    request<{ readings: Reading[] }>(`/readings?from=${date}&to=${date}&limit=4`),
  save: (input: ReadingInput, id?: string, version?: number) =>
    request<{ reading: Reading }>(`/readings${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(id ? { ...input, version } : input),
    }),
  remove: (id: string) => request<void>(`/readings/${id}`, { method: 'DELETE' }),
  exportReport: (date: string, period: Period) =>
    request<Blob>(`/reports/export?date=${date}&period=${period}`, {}, (response) =>
      response.blob(),
    ),
  report: (date: string, period: Period) =>
    request<Report>(`/reports?date=${date}&period=${period}`),
};
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';
