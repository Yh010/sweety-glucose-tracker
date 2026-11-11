import { ChevronLeft, ChevronRight } from 'lucide-react';
import { shiftDate } from '../lib/dates';
export function DatePicker({
  date,
  today,
  onChange,
  disabled = false,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="date-picker">
      {date !== today && (
        <button className="today-button" disabled={disabled} onClick={() => onChange(today)}>
          Today
        </button>
      )}
      <button
        className="icon-button"
        aria-label="Previous day"
        disabled={disabled || date <= '1900-01-01'}
        onClick={() => onChange(shiftDate(date, -1))}
      >
        <ChevronLeft size={18} />
      </button>
      <input
        aria-label="Selected date"
        disabled={disabled}
        type="date"
        value={date}
        min="1900-01-01"
        max={today}
        onChange={(e) => {
          if (e.target.value >= '1900-01-01' && e.target.value <= today) onChange(e.target.value);
        }}
      />
      <button
        className="icon-button"
        aria-label="Next day"
        disabled={disabled || date >= today}
        onClick={() => onChange(shiftDate(date, 1))}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
