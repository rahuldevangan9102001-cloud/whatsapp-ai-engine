import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeAdapter } from '../../autonomous/runtime_adapter.js';
import { analyzeMessage } from '../../autonomous/orchestrator.js';
import { runWithReadOnlyFailureBoundary } from '../../autonomous/orchestrator_failure_boundary.js';
import { buildKnowledgeContext } from '../../knowledge/knowledge_context.js';

test('runtime pipeline remains isolated, read-only, and preserves existing stage state', async () => {
  let analyzerInput;
  const input = {
    text: 'payment screenshot bhej diya',
    user: {
      id: 'memory-user',
      current_step: 10,
      payment_status: 'TOKEN_PAID',
      is_active: false,
      is_locked: true
    },
    recentMessages: [{ role: 'user', text: 'payment screenshot bhej diya' }],
    memories: [{ memoryKey: 'goal', memoryValue: 'growth' }],
    knowledgeEntries: [{ topic: 'payment', content: 'Read-only knowledge value' }]
  };
  const originalInput = structuredClone(input);
  const adapter = createRuntimeAdapter({
    analyzer: async (value) => {
      analyzerInput = value;
      return analyzeMessage(value);
    }
  });

  const result = await runWithReadOnlyFailureBoundary((value) => adapter.analyze(value), input);
  const knowledgeContext = buildKnowledgeContext(input.knowledgeEntries);

  assert.equal(result.ok, true);
  assert.equal(analyzerInput.user.currentStep, 10);
  assert.equal(analyzerInput.user.paymentStatus, 'TOKEN_PAID');
  assert.equal(result.result.result.stage.stage, 'payment_submission');
  assert.equal(result.result.result.intent.intent, 'payment_submitted');
  assert.equal(knowledgeContext[0].content, 'Read-only knowledge value');
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
  assert.equal(result.result.writesEnabled, false);
  assert.equal(result.result.outboundMessagingEnabled, false);
  assert.equal(result.result.paymentActionsEnabled, false);
  assert.deepEqual(input, originalInput);
  assert.equal(Object.hasOwn(result.result, 'sendMessage'), false);
  assert.equal(Object.hasOwn(result.result, 'approvePayment'), false);
  assert.equal(Object.hasOwn(result.result, 'executeTask'), false);
});

test('failure boundary converts analyzer failures into safe results', async () => {
  const result = await runWithReadOnlyFailureBoundary(async () => {
    throw new Error('isolated analyzer failure');
  }, { text: 'hello' });

  assert.equal(result.ok, false);
  assert.equal(result.writesEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
});