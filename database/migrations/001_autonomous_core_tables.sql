CREATE TABLE IF NOT EXISTS customer_agent_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  current_stage text,
  intent text,
  lead_score integer NOT NULL DEFAULT 0,
  temperature text,
  next_best_action text,
  confidence numeric(5, 4),
  escalation_level integer NOT NULL DEFAULT 0,
  followup_due_at timestamptz,
  last_action_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  memory_type text NOT NULL,
  memory_key text NOT NULL,
  memory_value jsonb NOT NULL,
  confidence numeric(5, 4),
  source text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  task_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  idempotency_key text NOT NULL,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  action_type text NOT NULL,
  input_snapshot jsonb,
  decision jsonb,
  policy_result text,
  execution_result text,
  actor_type text NOT NULL DEFAULT 'ai',
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  previous_score integer,
  new_score integer NOT NULL,
  reason text NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);