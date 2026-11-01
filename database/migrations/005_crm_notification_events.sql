CREATE TABLE IF NOT EXISTS public.crm_notification_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_crm_notification_events_pending
  ON public.crm_notification_events (next_attempt_at, created_at)
  WHERE status = 'pending';

NOTIFY pgrst, 'reload schema';
