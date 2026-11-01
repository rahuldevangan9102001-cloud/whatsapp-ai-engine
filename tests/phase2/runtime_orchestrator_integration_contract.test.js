import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeAdapter } from '../../autonomous/runtime_adapter.js';
import { analyzeMessage } from '../../autonomous/orchestrator.js';
import { runWithReadOnlyFailureBoundary } from '../../autonomous/orchestrator_failure_boundary.js';

test('runtime adapter and orchestrator compose through an isolated injected contract', async () => {
  const input = {
    text: 'payment screenshot bhej diya',
    user: { id: 'integration-user', current_step: 10, payment_status: 'TOKEN_PAID' },
    recentMessages: [{ role: 'user', text: 'payment screenshot bhej diya' }],
    memories: [],
    knowledgeEntries: [{ topic: 'payment', content: 'read-only fixture' }]
  };
  const originalInput = structuredClone(input);
  const adapter = createRuntimeAdapter({ analyzer: (value) => analyzeMessage(value) });
  const result = await runWithReadOnlyFailureBoundary((value) => adapter.analyze(value), input);

  assert.equal(result.ok, true);
  assert.equal(result.result.result.intent.intent, 'payment_submitted');
  assert.equal(result.result.result.stage.stage, 'payment_submission');
  assert.equal(result.result.result.writesEnabled, false);
  assert.equal(result.result.result.outboundMessagingEnabled, false);
  assert.equal(result.result.result.paymentActionsEnabled, false);
  assert.deepEqual(input, originalInput);
});

test('integration contract has no outbound or mutation capability', async () => {
  const adapter = createRuntimeAdapter({ analyzer: async () => ({ suggestion: 'shadow-only' }) });
  const result = await runWithReadOnlyFailureBoundary((value) => adapter.analyze(value), { text: 'hello' });

  assert.equal(result.ok, true);
  assert.equal(result.result.result.suggestion, 'shadow-only');
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
  assert.equal(Object.hasOwn(adapter, 'sendMessage'), false);
  assert.equal(Object.hasOwn(adapter, 'mutatePayment'), false);
  assert.equal(Object.hasOwn(adapter, 'executeTask'), false);
});