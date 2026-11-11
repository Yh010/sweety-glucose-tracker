import { formatDate, initials, shiftDate } from './dates';
it('shifts date-only strings through month and year boundaries', () => {
  expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
  expect(shiftDate('2024-02-28', 1)).toBe('2024-02-29');
  expect(formatDate('2026-10-15')).toBe('15 October 2026');
});
it('keeps initials readable for one-word names and Unicode', () => {
  expect(initials('Alex Morgan')).toBe('AM');
  expect(initials('李')).toBe('李');
  expect(initials(' A ')).toBe('A');
});
