const FORBIDDEN_ACTIONS = Object.freeze([
  'approve_payment',
  'reject_payment',
  'mutate_payment_status',
  'activate_account',
  'unlock_account',
  'send_whatsapp_message',
  'execute_task',
  'send_followup',
  'mutate_business_state'
]);

const ALLOWED_ACTIONS = Object.freeze([
  'classify_intent',
  'resolve_stage',
  'retrieve_knowledge',
  'suggest_reply',
  'suggest_human_review',
  'suggest_followup'
]);

export function evaluateAction(actionType, { mode = 'shadow', dryRun = true } = {}) {
  if (FORBIDDEN_ACTIONS.includes(actionType)) return { allowed: false, reason: 'action_forbidden_in_read_only_layer' };
  if (!ALLOWED_ACTIONS.includes(actionType)) return { allowed: false, reason: 'action_not_registered' };
  if (mode === 'disabled') return { allowed: false, reason: 'autonomous_mode_disabled' };
  if (dryRun !== true) return { allowed: false, reason: 'phase_2_requires_dry_run' };
  return { allowed: true, reason: 'read_only_shadow_action' };
}

export { ALLOWED_ACTIONS, FORBIDDEN_ACTIONS };