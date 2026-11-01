const STAGES = Object.freeze({
  1: 'name',
  2: 'location',
  3: 'occupation',
  4: 'progress',
  5: 'goals',
  6: 'objection',
  7: 'business_explanation',
  8: 'roadmap',
  9: 'id_selection',
  10: 'payment_submission',
  11: 'verification_followup',
  12: 'referral',
  13: 'full_payment',
  14: 'decision'
});

export function resolveStage({ currentStep, current_step, paymentStatus, payment_status, isActive, is_active, isLocked, is_locked } = {}) {
  currentStep = currentStep ?? current_step;
  paymentStatus = paymentStatus ?? payment_status;
  isActive = isActive ?? is_active;
  isLocked = isLocked ?? is_locked;
  const numericStep = Number(currentStep);
  if (Number.isInteger(numericStep) && STAGES[numericStep]) {
    return { stage: STAGES[numericStep], source: 'existing_current_step', currentStep: numericStep };
  }
  if (isActive === true || ['FULL_PAID', 'ACTIVE_GREEN'].includes(paymentStatus)) return { stage: 'active', source: 'existing_payment_state' };
  if (isLocked === true || paymentStatus === 'TOKEN_PAID') return { stage: 'position_locked', source: 'existing_payment_state' };
  return { stage: 'new_or_unverified', source: 'safe_default' };
}

export { STAGES };