import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadOnlyRetrievalService } from '../../knowledge/retrieval_service.js';
import { detectKnowledgeConflicts } from '../../knowledge/conflict_detector.js';

test('retrieval service only reads injected rows', async () => {
  const service = createReadOnlyRetrievalService({ query: async () => [{ topic: 'price', content: 'existing' }] });
  assert.equal((await service.retrieve({ text: 'price' }))[0].content, 'existing');
  assert.equal(service.writesEnabled, false);
});
test('conflicts are reported and not resolved', () => assert.equal(detectKnowledgeConflicts([{ topic: 'price', content: 'a' }, { topic: 'price', content: 'b' }]).length, 1));