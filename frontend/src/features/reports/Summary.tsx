import type { Report } from '../../lib/types';
export function Summary({ summary }: { summary: Report['summary'] }) {
  return <dl className="summary-strip" aria-label="Reading summary">{[
    ['Average', summary.average?.toFixed(1) ?? '—', 'mg/dl'],
    ['Highest', summary.highest ?? '—', 'mg/dl'],
    ['Lowest', summary.lowest ?? '—', 'mg/dl'],
    ['Readings', summary.count, 'entries'],
  ].map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd>{value}<span>{unit}</span></dd></div>)}</dl>;
}
