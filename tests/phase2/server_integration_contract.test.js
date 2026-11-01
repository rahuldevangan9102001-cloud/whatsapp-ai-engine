import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeAdapter } from '../../autonomous/runtime_adapter.js';
import { runWithReadOnlyFailureBoundary } from '../../autonomous/orchestrator_failure_boundary.js';

test('server integration contract keeps production behavior outside the shadow adapter', async () => {
  const existingFlow = Object.freeze({
    reply: 'existing customer reply',
    paymentStatus: 'TOKEN_PAID',
    referralSent: false,
    cronScheduled: true
  });
  const adapter = createRuntimeAdapter({ analyzer: async () => ({ suggestion: 'shadow suggestion' }) });
  const shadow = await runWithReadOnlyFailureBoundary(
    (context) => adapter.analyze(context),
    { text: 'customer message', user: { current_step: 9, payment_status: 'TOKEN_PAID' } }
  );

  assert.equal(shadow.ok, true);
  assert.equal(shadow.result.result.suggestion, 'shadow suggestion');
  assert.deepEqual(existingFlow, {
    reply: 'existing customer reply',
    paymentStatus: 'TOKEN_PAID',
    referralSent: false,
    cronScheduled: true
  });
  assert.equal(shadow.writesEnabled, false);
  assert.equal(shadow.outboundMessagingEnabled, false);
  assert.equal(shadow.paymentActionsEnabled, false);
  assert.equal(Object.hasOwn(shadow.result, 'sendMessage'), false);
  assert.equal(Object.hasOwn(shadow.result, 'mutatePayment'), false);
  assert.equal(Object.hasOwn(shadow.result, 'sendReferral'), false);
  assert.equal(Object.hasOwn(shadow.result, 'executeTask'), false);
});

test('server integration contract isolates shadow failures from existing flow', async () => {
  const existingReply = 'existing fallback reply';
  const adapter = createRuntimeAdapter({ analyzer: async () => { throw new Error('shadow-only failure'); } });
  const shadow = await runWithReadOnlyFailureBoundary(
    (context) => adapter.analyze(context),
    { text: 'customer message', user: { current_step: 1 } }
  );

  assert.equal(shadow.ok, true);
  assert.equal(shadow.result.ok, false);
  assert.equal(shadow.writesEnabled, false);
  assert.equal(shadow.outboundMessagingEnabled, false);
  assert.equal(shadow.paymentActionsEnabled, false);
  assert.equal(existingReply, 'existing fallback reply');
});