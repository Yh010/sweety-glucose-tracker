import type { Report } from './service.js';
import { slotLabels } from '../readings/schema.js';

export function reportToCsv(report: Report): string {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ['Date', 'Time slot', 'Glucose (mg/dl)'],
    ...report.readings.map((r) => [r.date, slotLabels[r.slot], r.value]),
  ];
  return '\uFEFF' + rows.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
}
