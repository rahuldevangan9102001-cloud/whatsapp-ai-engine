CREATE TABLE IF NOT EXISTS lead_followup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  idle_since timestamptz NOT NULL,
  followup_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_followup_events_idle_once
    UNIQUE (user_id, idle_since, followup_type)
);

CREATE INDEX IF NOT EXISTS idx_lead_followup_events_created_at
  ON lead_followup_events (created_at);

NOTIFY pgrst, 'reload schema';
