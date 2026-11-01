import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeAdapter } from '../../autonomous/runtime_adapter.js';
import { analyzeMessage } from '../../autonomous/orchestrator.js';
import { runWithReadOnlyFailureBoundary } from '../../autonomous/orchestrator_failure_boundary.js';
import { createSupabaseReadAdapter } from '../../knowledge/supabase_read_adapter.js';
import { createReadOnlyRetrievalService } from '../../knowledge/retrieval_service.js';
import { buildKnowledgeContext } from '../../knowledge/knowledge_context.js';
import { detectKnowledgeConflicts } from '../../knowledge/conflict_detector.js';

function createInMemoryKnowledgeClient(rows) {
  const calls = [];
  const query = {
    select(fields) { calls.push(['select', fields]); return query; },
    limit(value) { calls.push(['limit', value]); return query; },
    eq(field, value) { calls.push(['eq', field, value]); return query; },
    then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); }
  };
  return { client: { from: (table) => { calls.push(['from', table]); return query; } }, calls };
}

test('Phase 2 foundation composes as an isolated read-only pipeline', async () => {
  const input = {
    text: 'payment screenshot bhej diya',
    user: { id: 'foundation-user', current_step: 10, payment_status: 'TOKEN_PAID', is_locked: true },
    recentMessages: [{ role: 'user', text: 'payment screenshot bhej diya' }],
    memories: [],
    knowledgeEntries: []
  };
  const originalInput = structuredClone(input);
  const fakeKnowledge = createInMemoryKnowledgeClient([
    { id: 'k1', topic: 'payment', content: 'read-only payment fact' }
  ]);
  const readAdapter = createSupabaseReadAdapter({ client: fakeKnowledge.client });
  const retrieval = createReadOnlyRetrievalService({ query: (query) => readAdapter.retrieve(query) });
  const retrieved = await retrieval.retrieve({ topic: 'payment' });
  const context = buildKnowledgeContext(retrieved);
  const conflicts = detectKnowledgeConflicts(retrieved);
  const runtimeAdapter = createRuntimeAdapter({ analyzer: (value) => analyzeMessage(value) });
  const result = await runWithReadOnlyFailureBoundary(
    (value) => runtimeAdapter.analyze({ ...value, knowledgeEntries: retrieved }),
    input
  );

  assert.equal(context[0].content, 'read-only payment fact');
  assert.equal(conflicts.length, 0);
  assert.equal(result.ok, true);
  assert.equal(result.result.result.intent.intent, 'payment_submitted');
  assert.equal(result.result.result.stage.stage, 'payment_submission');
  assert.equal(result.writesEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.result.result.writesEnabled, false);
  assert.deepEqual(input, originalInput);
  assert.deepEqual(fakeKnowledge.calls.map(([name]) => name), ['from', 'select', 'limit', 'eq']);
  assert.equal(Object.hasOwn(result.result, 'sendMessage'), false);
  assert.equal(Object.hasOwn(result.result, 'approvePayment'), false);
  assert.equal(Object.hasOwn(result.result, 'executeTask'), false);
});

test('foundation failure boundary remains safe without execution capabilities', async () => {
  const result = await runWithReadOnlyFailureBoundary(async () => {
    throw new Error('foundation failure');
  });

  assert.equal(result.ok, false);
  assert.equal(result.writesEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
});