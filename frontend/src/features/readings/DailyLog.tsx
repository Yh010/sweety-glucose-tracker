import { useState } from 'react';
import {
  Check,
  RotateCcw,
  Coffee,
  Moon,
  Pencil,
  Plus,
  Sunrise,
  Trash2,
  Utensils,
} from 'lucide-react';
import { slots, slotLabels, type Reading, type Slot } from '../../lib/types';
const slotIcons = {
  fasting: Sunrise,
  after_breakfast: Coffee,
  after_lunch: Utensils,
  after_dinner: Moon,
};
export function DailyLog({
  readings,
  onEdit,
  onAdd,
  onDelete,
  deleting,
  refreshing,
  onRefresh,
}: {
  readings: Reading[];
  onEdit: (reading: Reading) => void;
  onAdd: (slot: Slot) => void;
  onDelete: (reading: Reading) => void;
  deleting: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return (
    <section className="log-panel" aria-labelledby="log-heading">
      <div className="section-heading">
        <div>
          <h2 id="log-heading">Your daily log</h2>
          <p className="text-muted text-sm mt-2">Four daily check-ins. Values in mg/dl.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="text-button"
            onClick={onRefresh}
            disabled={refreshing || deleting}
            aria-label="Refresh readings"
          >
            <RotateCcw size={14} aria-hidden="true" />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <span className="count-badge">{readings.length} of 4 recorded</span>
        </div>
      </div>
      <div className="log-rows">
        {slots.map((slot) => {
          const reading = readings.find((r) => r.slot === slot);
          const Icon = slotIcons[slot];
          return (
            <div className={`log-row ${reading ? 'is-recorded' : ''}`} key={slot}>
              <span className={`slot-icon slot-${slot}`}>
                <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div className="slot-description">
                <h3>{slotLabels[slot]}</h3>
                <p>
                  {reading ? (
                    <>
                      <Check size={12} aria-hidden="true" />
                      Recorded
                    </>
                  ) : (
                    'Not recorded yet'
                  )}
                </p>
              </div>
              {reading ? (
                <>
                  <div className="reading-value">
                    {reading.value}
                    <span>mg/dl</span>
                  </div>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${slotLabels[slot]} reading`}
                      onClick={() => {
                        setConfirmId(null);
                        onEdit(reading);
                      }}
                      disabled={deleting}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button danger-hover"
                      aria-label={`Delete ${slotLabels[slot]} reading`}
                      onClick={() => setConfirmId(reading.id)}
                      disabled={deleting}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {confirmId === reading.id && (
                    <div className="delete-confirm" role="group" aria-label="Confirm deletion">
                      <span>Delete this reading?</span>
                      <button
                        className="text-button danger-text"
                        onClick={() => onDelete(reading)}
                        disabled={deleting}
                      >
                        {deleting ? 'Deleting…' : 'Delete'}
                      </button>
                      <button
                        className="text-button"
                        disabled={deleting}
                        onClick={() => setConfirmId(null)}
                      >
                        Keep it
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button
                  className="text-button record-button"
                  disabled={deleting}
                  onClick={() => {
                    setConfirmId(null);
                    onAdd(slot);
                  }}
                >
                  <Plus size={15} aria-hidden="true" />
                  Record<span className="sr-only"> {slotLabels[slot]}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="log-footer">
        <span className="legend-dot" />
        {readings.length === 4
          ? 'All four entries are in. Your daily record is complete.'
          : 'Missing an entry? You can add readings for past dates, too.'}
      </div>
    </section>
  );
}
