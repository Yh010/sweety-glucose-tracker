CREATE TABLE reminder_runs (
  date date PRIMARY KEY,
  cursor uuid,
  upper_bound uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  processed bigint NOT NULL DEFAULT 0 CHECK (processed >= 0),
  inserted bigint NOT NULL DEFAULT 0 CHECK (inserted >= 0),
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reminder_events_retention_idx ON reminder_events(date, id);
