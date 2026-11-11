import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, NotebookPen } from 'lucide-react';
import { api } from '../../lib/api';
import type { Period } from '../../lib/types';
import { formatDate } from '../../lib/dates';
import { DatePicker } from '../../components/DatePicker';
import { ErrorState, Loading } from '../../components/Feedback';
import { Summary } from './Summary';
import { TrendChart } from './TrendChart';
import { slotLabels } from '../../lib/types';

export function ReportsPage({ today, onLog }: { today: string; onLog: () => void }) {
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState<Period>('mtd');
  const report = useQuery({ queryKey: ['reports', date, period], queryFn: () => api.report(date, period) });
  return <><header className="page-heading"><div><h1>A clearer picture.</h1><p className="text-muted mt-3">Your readings, brought together.</p></div><DatePicker date={date} today={today} onChange={setDate} /></header><div className="report-controls"><div className="segmented-control" role="group" aria-label="Report period">{([['daily', 'Daily'], ['mtd', 'Month to date'], ['monthly', 'Previous month']] as const).map(([value, label]) => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div></div>{report.isPending ? <Loading label="Preparing your report…" /> : report.isError ? <ErrorState error={report.error} retry={() => void report.refetch()} /> : <><div className="report-range"><h2>{period === 'monthly' ? 'Previous month' : period === 'mtd' ? 'Month to date' : 'Daily report'}</h2><p>{formatDate(report.data.range.start)}{report.data.range.end !== report.data.range.start && ` – ${formatDate(report.data.range.end)}`}</p></div><Summary summary={report.data.summary} />{report.data.summary.count === 0 ? <section className="empty-state"><span className="empty-icon"><NotebookPen size={28} strokeWidth={1.5} aria-hidden="true" /></span><h2>A fresh page in your journal.</h2><p>No readings in this date range yet.<br />Add an entry to start building your picture.</p><button className="button button-primary" onClick={onLog}><PlusIcon />Go to daily log</button></section> : <section className="report-detail"><div className="section-heading"><div><h2>{period === 'daily' ? 'Readings for the day' : 'Your month, one day at a time'}</h2><p className="text-muted text-sm mt-2">{period === 'daily' ? 'Every recorded time slot, in order.' : 'Daily averages across this report’s date range.'}</p></div><BarChart3 size={21} className="text-muted" aria-hidden="true" /></div>{period === 'daily' ? <div className="report-table-wrap"><table><thead><tr><th>Time slot</th><th className="text-right">Glucose</th></tr></thead><tbody>{report.data.readings.map((r) => <tr key={r.id}><td>{slotLabels[r.slot]}</td><td className="text-right tabular-nums"><strong>{r.value}</strong> <span className="text-muted">mg/dl</span></td></tr>)}</tbody></table></div> : <TrendChart report={report.data} />}</section>}</>}<p className="page-footnote">A record for your reference. Review your readings with your healthcare professional.</p></>;
}
function PlusIcon() { return <NotebookPen size={16} aria-hidden="true" />; }
