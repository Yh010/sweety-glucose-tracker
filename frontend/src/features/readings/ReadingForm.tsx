import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, Plus, X } from 'lucide-react';
import { slots, slotLabels, type Reading, type ReadingInput, type Slot } from '../../lib/types';
import { errorMessage } from '../../lib/api';

type Props = {
  today: string;
  defaultDate: string;
  selectedSlot: Slot;
  editing: Reading | null;
  pending: boolean;
  error: unknown;
  onSave: (input: ReadingInput) => void;
  onCancel: () => void;
};
export function ReadingForm({
  today,
  defaultDate,
  selectedSlot,
  editing,
  pending,
  error,
  onSave,
  onCancel,
}: Props) {
  const id = useId();
  const valueRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(editing?.date ?? defaultDate);
  const [slot, setSlot] = useState<Slot>(editing?.slot ?? selectedSlot);
  const [value, setValue] = useState(editing ? String(editing.value) : '');
  const [validation, setValidation] = useState('');
  useEffect(() => {
    setDate(editing?.date ?? defaultDate);
    setSlot(editing?.slot ?? selectedSlot);
    setValue(editing ? String(editing.value) : '');
    setValidation('');
  }, [editing, defaultDate, selectedSlot]);
  useEffect(() => {
    if (editing) valueRef.current?.focus({ preventScroll: true });
  }, [editing]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) {
      setValidation('Please enter a glucose value.');
      valueRef.current?.focus();
      return;
    }
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 40 || numeric > 600) {
      setValidation('Value must be a whole number between 40 and 600 mg/dl.');
      valueRef.current?.focus();
      return;
    }
    if (!date || date < '1900-01-01') {
      setValidation('Choose a valid date from 1900 onwards.');
      return;
    }
    if (date > today) {
      setValidation('Date cannot be in the future.');
      return;
    }
    setValidation('');
    onSave({ date, slot, value: numeric });
  }
  const message = validation || (error ? errorMessage(error) : '');
  return (
    <section className="reading-form-panel" id="reading-form" aria-labelledby={`${id}-heading`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${id}-heading`}>{editing ? 'Edit reading' : 'Add a reading'}</h2>
        {editing ? (
          <button
            className="icon-button"
            aria-label="Cancel editing"
            disabled={pending}
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        ) : (
          <span className="form-heading-icon">
            <Plus size={19} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="text-muted text-sm mt-2">
        {editing ? 'Update the details of this entry.' : 'A quick entry. A little more clarity.'}
      </p>
      <form className="reading-form" noValidate onSubmit={submit}>
        <fieldset disabled={pending} className="form-fields">
          <label className="field" htmlFor={`${id}-date`}>
            Date
            <input
              id={`${id}-date`}
              type="date"
              min="1900-01-01"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="field" htmlFor={`${id}-slot`}>
            Time slot
            <select
              id={`${id}-slot`}
              value={slot}
              onChange={(e) => setSlot(e.target.value as Slot)}
            >
              {slots.map((s) => (
                <option key={s} value={s}>
                  {slotLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <label htmlFor={`${id}-value`}>Glucose value</label>
            <span className="glucose-input">
              <input
                ref={valueRef}
                id={`${id}-value`}
                type="number"
                inputMode="numeric"
                min={40}
                max={600}
                step={1}
                placeholder="e.g. 110"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-invalid={Boolean(message)}
                aria-describedby={`${id}-hint${message ? ` ${id}-error` : ''}`}
              />
              <span aria-hidden="true">mg/dl</span>
            </span>
          </div>
          <p className="field-hint" id={`${id}-hint`}>
            Whole numbers from 40 to 600 mg/dl.
          </p>
          {message && (
            <p id={`${id}-error`} className="field-error" role="alert">
              {message}
            </p>
          )}
          <button className="button button-primary w-full justify-center" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Save reading'}
            {editing ? (
              <Check size={17} aria-hidden="true" />
            ) : (
              <ArrowUpRight size={17} aria-hidden="true" />
            )}
          </button>
          {editing && (
            <button className="text-button justify-center w-full" type="button" onClick={onCancel}>
              Cancel editing
            </button>
          )}
        </fieldset>
      </form>
      <div className="form-note">
        <span className="note-dot" />
        <p>
          One reading per time slot.
          <br />
          Up to four entries each day.
        </p>
      </div>
    </section>
  );
}
