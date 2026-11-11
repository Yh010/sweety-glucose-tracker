import type { Meta, Period, Reading, ReadingInput, Report, User } from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'Sweety', ...options.headers } });
  } catch { throw new ApiError(0, 'NETWORK_ERROR', 'Could not connect. Check your connection and try again.'); }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code: string; message: string } } | null;
    const error = new ApiError(response.status, payload?.error?.code ?? 'REQUEST_FAILED', payload?.error?.message ?? 'Something went wrong. Please try again.');
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const api = {
  meta: () => request<Meta>('/meta'),
  me: () => request<{ user: User }>('/auth/me'),
  login: (input: { email: string; password: string }) => request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  register: (input: { name: string; email: string; password: string }) => request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  readings: (date: string) => request<{ readings: Reading[] }>(`/readings?from=${date}&to=${date}&limit=4`),
  save: (input: ReadingInput, id?: string) => request<{ reading: Reading }>(`/readings${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/readings/${id}`, { method: 'DELETE' }),
  report: (date: string, period: Period) => request<Report>(`/reports?date=${date}&period=${period}`),
};
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
