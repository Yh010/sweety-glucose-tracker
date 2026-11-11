import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.').refine((date) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && date >= '1900-01-01';
}, 'Choose a valid date from 1900 onwards.');

export function todayInZone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export type ReportPeriod = 'daily' | 'mtd' | 'monthly';
export function reportRange(date: string, period: ReportPeriod): { start: string; end: string } {
  const selected = new Date(`${date}T00:00:00Z`);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (period === 'daily') return { start: date, end: date };
  if (period === 'mtd') return { start: `${date.slice(0, 7)}-01`, end: date };
  return {
    start: iso(new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() - 1, 1))),
    end: iso(new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 0))),
  };
}
