import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMessage } from '../../autonomous/orchestrator.js';

test('orchestrator handles missing context without enabling actions', async () => {
  const result = await analyzeMessage();
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
  assert.equal(result.intent.intent, 'unknown');
});

test('orchestrator reports knowledge conflicts without resolving them', async () => {
  const result = await analyzeMessage({
    text: 'price batao',
    knowledgeEntries: [
      { topic: 'price', content: 'first value' },
      { topic: 'price', content: 'second value' }
    ]
  });
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
});