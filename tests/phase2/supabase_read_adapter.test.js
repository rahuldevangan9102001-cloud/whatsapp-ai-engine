import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseReadAdapter, KNOWLEDGE_FIELDS, MAX_LIMIT } from '../../knowledge/supabase_read_adapter.js';

function createFakeQuery(rows = []) {
  const calls = [];
  const query = {
    select(fields) { calls.push(['select', fields]); return query; },
    limit(value) { calls.push(['limit', value]); return query; },
    eq(field, value) { calls.push(['eq', field, value]); return query; },
    ilike(field, value) { calls.push(['ilike', field, value]); return query; },
    then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); }
  };
  return { query, calls };
}

test('adapter performs bounded knowledge_base reads and sanitizes rows', async () => {
  const fake = createFakeQuery([{ id: 1, topic: 'price', content: 'existing', secret: 'remove' }]);
  const adapter = createSupabaseReadAdapter({ client: { from: () => fake.query } });
  const result = await adapter.retrieve({ topic: 'price', text: 'existing', limit: 999 });
  assert.equal(fake.calls[0][0], 'select');
  assert.equal(fake.calls[0][1], KNOWLEDGE_FIELDS);
  assert.deepEqual(fake.calls.find((call) => call[0] === 'limit'), ['limit', MAX_LIMIT]);
  assert.deepEqual(result[0], { id: 1, topic: 'price', content: 'existing', embedding: null, source: null, version: null, approved: null, is_active: null });
});

test('adapter exposes no mutation capability', () => {
  const fake = createFakeQuery();
  const adapter = createSupabaseReadAdapter({ client: { from: () => fake.query } });
  assert.equal(adapter.writesEnabled, false);
  assert.equal(Object.hasOwn(adapter, 'insert'), false);
  assert.equal(Object.hasOwn(adapter, 'update'), false);
  assert.equal(Object.hasOwn(adapter, 'delete'), false);
});

test('adapter surfaces read errors and rejects invalid clients', async () => {
  const error = new Error('read failed');
  const query = { select: () => query, limit: () => query, then: (resolve) => Promise.resolve({ data: null, error }).then(resolve) };
  const adapter = createSupabaseReadAdapter({ client: { from: () => query } });
  await assert.rejects(() => adapter.retrieve(), /read failed/);
  assert.throws(() => createSupabaseReadAdapter({ client: null }), /read client is required/);
});