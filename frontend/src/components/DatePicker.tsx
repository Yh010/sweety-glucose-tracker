import { ChevronLeft, ChevronRight } from 'lucide-react';
import { shiftDate } from '../lib/dates';
export function DatePicker({ date, today, onChange }: { date: string; today: string; onChange: (date: string) => void }) {
  return <div className="date-picker"><button className="icon-button" aria-label="Previous day" disabled={date <= '1900-01-01'} onClick={() => onChange(shiftDate(date, -1))}><ChevronLeft size={18} /></button><input aria-label="Selected date" type="date" value={date} min="1900-01-01" max={today} onChange={(e) => { if (e.target.value >= '1900-01-01' && e.target.value <= today) onChange(e.target.value); }} /><button className="icon-button" aria-label="Next day" disabled={date >= today} onClick={() => onChange(shiftDate(date, 1))}><ChevronRight size={18} /></button></div>;
}
