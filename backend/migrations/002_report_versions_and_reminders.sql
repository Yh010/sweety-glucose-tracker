ALTER TABLE users ADD COLUMN report_version bigint NOT NULL DEFAULT 0;
CREATE TABLE reminder_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  reading_count integer NOT NULL CHECK (reading_count BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
