CREATE TABLE IF NOT EXISTS payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  message_id text,
  image_hash text,
  extracted_amount numeric(12, 2),
  extracted_utr text,
  extraction_confidence numeric(5, 4),
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_review_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_submission_id uuid NOT NULL,
  user_id text NOT NULL,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status text NOT NULL DEFAULT 'pending',
  assigned_to text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_submission_id uuid NOT NULL,
  user_id text NOT NULL,
  risk_type text NOT NULL,
  risk_value text,
  severity text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  user_id text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);