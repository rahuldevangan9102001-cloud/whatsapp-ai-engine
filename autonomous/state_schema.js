export const AUTONOMOUS_TABLES = Object.freeze({
  core: [
    'customer_agent_state',
    'customer_memory',
    'agent_tasks',
    'agent_action_log',
    'lead_score_events'
  ],
  payment: [
    'payment_submissions',
    'payment_review_tasks',
    'payment_risk_events',
    'payment_idempotency_keys'
  ]
});

export const TASK_STATUSES = Object.freeze(['pending', 'running', 'completed', 'retryable', 'failed', 'cancelled', 'awaiting_approval']);
export const PAYMENT_SUBMISSION_STATUSES = Object.freeze(['received', 'extracting', 'awaiting_review', 'approved', 'rejected', 'needs_more_info', 'duplicate', 'expired']);