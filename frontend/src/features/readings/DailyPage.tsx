import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { slots, type Reading, type ReadingInput, type Slot, type User } from '../../lib/types';
import { formatDate } from '../../lib/dates';
import { DatePicker } from '../../components/DatePicker';
import { ErrorState, Loading } from '../../components/Feedback';
import { DailyLog } from './DailyLog';
import { ReadingForm } from './ReadingForm';
import { Summary } from '../reports/Summary';

export function DailyPage({
  user,
  today,
  onReports,
}: {
  user: User;
  today: string;
  onReports: () => void;
}) {
  const client = useQueryClient();
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<Reading | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notice, setNotice] = useState('');
  const [formVersion, setFormVersion] = useState(0);
  const report = useQuery({
    queryKey: ['reports', date, 'daily'],
    queryFn: () => api.report(date, 'daily'),
  });
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['reports'] });
    void client.invalidateQueries({ queryKey: ['readings'] });
  };
  const save = useMutation({
    onMutate: () => setNotice(''),
    onError: invalidate,
    mutationFn: (input: ReadingInput) => api.save(input, editing?.id),
    onSuccess: ({ reading }) => {
      setNotice(editing ? 'Reading updated.' : 'Reading saved.');
      setEditing(null);
      setDate(reading.date);
      const next = slots.find(
        (s) => s !== reading.slot && !report.data?.readings.some((r) => r.slot === s),
      );
      setSlot(reading.date === date ? (next ?? null) : null);
      setFormVersion((v) => v + 1);
      invalidate();
    },
  });
  const remove = useMutation({
    onMutate: () => setNotice(''),
    onError: invalidate,
    mutationFn: async (reading: Reading) => {
      try {
        await api.remove(reading.id);
      } catch (error) {
        // A lost response or another tab may have already removed it.
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    },
    onSuccess: (_data, reading) => {
      if (editing?.id === reading.id) setEditing(null);
      setNotice('Reading deleted.');
      invalidate();
    },
  });
  function focusForm() {
    requestAnimationFrame(() => {
      document
        .getElementById('reading-form')
        ?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      document
        .querySelector<HTMLInputElement>('#reading-form input[type="number"]')
        ?.focus({ preventScroll: true });
    });
  }
  function changeDate(value: string) {
    setDate(value);
    setEditing(null);
    setSlot(null);
    save.reset();
    remove.reset();
    setNotice('');
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>
            {date === today
              ? `A little check-in, ${user.name.trim().split(/\s+/u)[0]}.`
              : 'One day at a time.'}
          </h1>
          <p className="text-muted mt-3">
            {date === today
              ? 'Make space for your daily readings.'
              : formatDate(date, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
          </p>
        </div>
        <DatePicker
          date={date}
          today={today}
          onChange={changeDate}
          disabled={save.isPending || remove.isPending}
        />
      </header>
      <div className="notice-region" aria-live="polite">
        {notice && (
          <p className="success-notice">
            <Check size={15} aria-hidden="true" />
            {notice}
          </p>
        )}
      </div>
      <div className="daily-layout">
        <div className="daily-main">
          {report.isPending ? (
            <Loading />
          ) : report.isError ? (
            <ErrorState error={report.error} retry={() => void report.refetch()} />
          ) : (
            <>
              <DailyLog
                readings={report.data.readings}
                onEdit={(reading) => {
                  setEditing(reading);
                  save.reset();
                  setNotice('');
                  focusForm();
                }}
                onAdd={(selected) => {
                  setEditing(null);
                  setSlot(selected);
                  setFormVersion((v) => v + 1);
                  save.reset();
                  setNotice('');
                  focusForm();
                }}
                onDelete={(reading) => {
                  remove.reset();
                  remove.mutate(reading);
                }}
                deleting={remove.isPending || save.isPending}
              />
              <section className="daily-summary">
                <div className="section-heading">
                  <h2>The day at a glance</h2>
                  <button className="text-button" onClick={onReports}>
                    View reports
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </button>
                </div>
                <Summary summary={report.data.summary} />
                {report.data.summary.count === 0 && (
                  <p className="field-hint mt-4">
                    Your summary will appear after your first reading.
                  </p>
                )}
              </section>
            </>
          )}
          {remove.isError && (
            <ErrorState
              error={remove.error}
              retry={() => {
                if (remove.variables) remove.mutate(remove.variables);
              }}
            />
          )}
          <div className="journal-note">
            <span className="journal-line" />
            <p>
              Every entry adds a little context.
              <br />
              <span>Keep a record you can come back to.</span>
            </p>
          </div>
        </div>
        {report.data && (
          <ReadingForm
            key={`${date}:${formVersion}`}
            today={today}
            defaultDate={date}
            selectedSlot={
              slot ??
              slots.find(
                (candidate) => !report.data.readings.some((reading) => reading.slot === candidate),
              ) ??
              'fasting'
            }
            dayComplete={report.data.summary.count === 4}
            editing={editing}
            pending={save.isPending}
            error={save.error}
            onSave={(input) => save.mutate(input)}
            onCancel={() => {
              setEditing(null);
              setSlot(null);
              setFormVersion((value) => value + 1);
              save.reset();
            }}
          />
        )}
      </div>
      <p className="page-footnote">Your readings are private. Only you can access your journal.</p>
    </>
  );
}
