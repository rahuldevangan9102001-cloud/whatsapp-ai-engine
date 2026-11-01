import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseReadAdapter } from '../../knowledge/supabase_read_adapter.js';
import { createReadOnlyRetrievalService } from '../../knowledge/retrieval_service.js';
import { buildKnowledgeContext } from '../../knowledge/knowledge_context.js';
import { detectKnowledgeConflicts } from '../../knowledge/conflict_detector.js';

function createInMemoryClient(rows) {
  const calls = [];
  const query = {
    select(fields) { calls.push(['select', fields]); return query; },
    limit(value) { calls.push(['limit', value]); return query; },
    eq(field, value) { calls.push(['eq', field, value]); return query; },
    ilike(field, value) { calls.push(['ilike', field, value]); return query; },
    then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); }
  };
  return { client: { from: (table) => { calls.push(['from', table]); return query; } }, calls };
}

test('read-only knowledge pipeline retrieves, formats, and detects conflicts', async () => {
  const rows = [
    { id: 'k1', topic: 'pricing', content: 'First approved value', embedding: [0.1] },
    { id: 'k2', topic: 'pricing', content: 'Second conflicting value', embedding: [0.2] }
  ];
  const fake = createInMemoryClient(rows);
  const adapter = createSupabaseReadAdapter({ client: fake.client });
  const retrieval = createReadOnlyRetrievalService({ query: (input) => adapter.retrieve(input) });

  const retrieved = await retrieval.retrieve({ topic: 'pricing', limit: 5 });
  const context = buildKnowledgeContext(retrieved);
  const conflicts = detectKnowledgeConflicts(retrieved);

  assert.equal(retrieved.length, 2);
  assert.equal(context.length, 2);
  assert.equal(context[0].topic, 'pricing');
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].topic, 'pricing');
  assert.deepEqual(fake.calls.map(([name]) => name), ['from', 'select', 'limit', 'eq']);
});

test('pipeline uses only the fake client and exposes no mutation or execution path', async () => {
  const fake = createInMemoryClient([{ id: 'k1', topic: 'support', content: 'Read-only' }]);
  const adapter = createSupabaseReadAdapter({ client: fake.client });
  const retrieval = createReadOnlyRetrievalService({ query: (input) => adapter.retrieve(input) });
  const retrieved = await retrieval.retrieve({ topic: 'support' });

  assert.equal(retrieval.writesEnabled, false);
  assert.equal(adapter.writesEnabled, false);
  assert.equal(Object.hasOwn(adapter, 'insert'), false);
  assert.equal(Object.hasOwn(adapter, 'update'), false);
  assert.equal(Object.hasOwn(adapter, 'delete'), false);
  assert.equal(retrieved[0].content, 'Read-only');
  assert.deepEqual(fake.calls.map(([name]) => name), ['from', 'select', 'limit', 'eq']);
  assert.equal(Object.hasOwn(retrieval, 'sendMessage'), false);
  assert.equal(Object.hasOwn(retrieval, 'approvePayment'), false);
  assert.equal(Object.hasOwn(retrieval, 'executeTask'), false);
});

test('pipeline contract does not require production files or external services', () => {
  const fake = createInMemoryClient([]);
  assert.equal(typeof fake.client.from, 'function');
  assert.equal(fake.calls.length, 0);
});