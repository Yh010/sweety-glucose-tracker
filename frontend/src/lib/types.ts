export type User = { id: string; name: string; email: string };
export const slots = ['fasting', 'after_breakfast', 'after_lunch', 'after_dinner'] as const;
export type Slot = (typeof slots)[number];
export const slotLabels: Record<Slot, string> = {
  fasting: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};
export type ReadingInput = { date: string; slot: Slot; value: number };
export type Reading = ReadingInput & { id: string; version: number };
export type Period = 'daily' | 'mtd' | 'monthly';
export type Report = {
  period: Period;
  range: { start: string; end: string };
  summary: { count: number; highest: number | null; lowest: number | null; average: number | null };
  readings: Reading[];
};
export type Meta = { today: string; timezone: string };
