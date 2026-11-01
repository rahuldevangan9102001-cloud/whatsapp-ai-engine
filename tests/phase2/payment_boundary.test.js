import test from 'node:test';
import assert from 'node:assert/strict';
import { FORBIDDEN_ACTIONS, evaluateAction } from '../../autonomous/policy_engine.js';

test('all payment and outbound actions remain forbidden', () => {
  for (const action of ['approve_payment', 'reject_payment', 'mutate_payment_status', 'send_whatsapp_message']) {
    assert.ok(FORBIDDEN_ACTIONS.includes(action));
    assert.equal(evaluateAction(action).allowed, false);
  }
});