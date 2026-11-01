import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithReadOnlyFailureBoundary } from '../../autonomous/orchestrator_failure_boundary.js';

test('failure boundary returns safe flags when the analyzer fails', async () => {
  const result = await runWithReadOnlyFailureBoundary(async () => {
    throw new Error('analysis failed');
  });

  assert.equal(result.ok, false);
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
});

test('failure boundary does not expose execution capabilities on success', async () => {
  const result = await runWithReadOnlyFailureBoundary(async () => ({ suggestion: 'read-only' }), { text: 'hello' });

  assert.equal(result.ok, true);
  assert.deepEqual(result.result, { suggestion: 'read-only' });
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
});