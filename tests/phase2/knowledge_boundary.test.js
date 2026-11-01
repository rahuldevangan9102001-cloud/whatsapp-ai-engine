import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadOnlyRetrievalService } from '../../knowledge/retrieval_service.js';
import { buildKnowledgeContext } from '../../knowledge/knowledge_context.js';
import { detectKnowledgeConflicts } from '../../knowledge/conflict_detector.js';

test('retrieval is limited to injected query results and remains read-only', async () => {
  let queryInput;
  const service = createReadOnlyRetrievalService({ query: async (input) => {
    queryInput = input;
    return Array.from({ length: 8 }, (_, index) => ({ topic: `topic-${index}`, content: `content-${index}` }));
  } });
  const results = await service.retrieve({ text: 'price', limit: 3 });
  assert.equal(queryInput.text, 'price');
  assert.equal(results.length, 3);
  assert.equal(service.writesEnabled, false);
});

test('knowledge context does not mutate entries and conflicts remain explicit', () => {
  const entries = [{ topic: 'price', content: 'a' }, { topic: 'price', content: 'b' }];
  const context = buildKnowledgeContext(entries);
  assert.deepEqual(entries, [{ topic: 'price', content: 'a' }, { topic: 'price', content: 'b' }]);
  assert.equal(detectKnowledgeConflicts(entries).length, 1);
  assert.deepEqual(context[0], { topic: 'price', content: 'a', source: 'knowledge_base' });
});

test('retrieval errors remain caller-visible without enabling writes', async () => {
  const service = createReadOnlyRetrievalService({ query: async () => { throw new Error('read failed'); } });
  await assert.rejects(() => service.retrieve({ text: 'x' }), /read failed/);
  assert.equal(service.writesEnabled, false);
});