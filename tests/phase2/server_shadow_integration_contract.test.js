import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeAdapter } from '../../autonomous/runtime_adapter.js';
import { runWithReadOnlyFailureBoundary } from '../../autonomous/orchestrator_failure_boundary.js';

test('server shadow integration contract preserves the existing response path', async () => {
  const existingResponse = { text: 'existing response', sent: false };
  const incomingContext = Object.freeze({
    text: 'customer question',
    user: Object.freeze({ id: 'shadow-user', current_step: 8 }),
    recentMessages: Object.freeze([]),
    memories: Object.freeze([]),
    knowledgeEntries: Object.freeze([])
  });
  const adapter = createRuntimeAdapter({ analyzer: async () => ({ suggestion: 'shadow-only' }) });

  const shadowResult = await runWithReadOnlyFailureBoundary(
    (context) => adapter.analyze(context),
    incomingContext
  );

  assert.equal(shadowResult.ok, true);
  assert.equal(shadowResult.result.result.suggestion, 'shadow-only');
  assert.deepEqual(existingResponse, { text: 'existing response', sent: false });
  assert.equal(shadowResult.writesEnabled, false);
  assert.equal(shadowResult.outboundMessagingEnabled, false);
  assert.equal(shadowResult.paymentActionsEnabled, false);
  assert.equal(Object.hasOwn(shadowResult.result, 'sendMessage'), false);
  assert.equal(Object.hasOwn(shadowResult.result, 'mutatePayment'), false);
  assert.equal(Object.hasOwn(shadowResult.result, 'executeTask'), false);
});

test('shadow integration failure does not replace the existing response path', async () => {
  const existingResponse = { text: 'fallback response', sent: false };
  const adapter = createRuntimeAdapter({ analyzer: async () => { throw new Error('shadow failure'); } });

  const shadowResult = await runWithReadOnlyFailureBoundary(
    (context) => adapter.analyze(context),
    { text: 'customer question', user: { current_step: 1 } }
  );

  assert.equal(shadowResult.ok, true);
  assert.equal(shadowResult.result.ok, false);
  assert.equal(shadowResult.writesEnabled, false);
  assert.equal(shadowResult.outboundMessagingEnabled, false);
  assert.equal(shadowResult.paymentActionsEnabled, false);
  assert.deepEqual(existingResponse, { text: 'fallback response', sent: false });
});