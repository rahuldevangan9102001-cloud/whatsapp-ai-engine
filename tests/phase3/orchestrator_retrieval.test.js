import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeMessage } from '../../autonomous/orchestrator.js';

test('retrieval results are consumed by the orchestrator knowledge pipeline', async () => {
  const retrievalService = {
    async retrieve({ text }) {
      if (text === 'pricing question') {
        return [
          { topic: 'pricing', content: 'Base plan is $29', source: 'retrieval' },
          { topic: 'pricing', content: 'Annual plan saves 20%', source: 'retrieval' }
        ];
      }
      return [];
    },
    writesEnabled: false
  };

  const result = await analyzeMessage({
    text: 'pricing question',
    retrievalService
  });

  assert.equal(result.knowledge.length, 2);
  assert.equal(result.knowledge[0].content, 'Base plan is $29');
  assert.equal(result.knowledge[1].content, 'Annual plan saves 20%');
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
});

test('retrieval failure falls back safely without breaking the response path', async () => {
  const retrievalService = {
    async retrieve() {
      throw new Error('retrieval failed');
    },
    writesEnabled: false
  };

  const result = await analyzeMessage({
    text: 'status update',
    retrievalService,
    knowledgeEntries: [{ topic: 'support', content: 'Fallback content' }]
  });

  assert.equal(result.knowledge.length, 1);
  assert.equal(result.knowledge[0].content, 'Fallback content');
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
});

test('default behavior without retrieval remains unchanged', async () => {
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
  assert.equal(result.paymentActionsEnabled, false);
});

test('retrieval injection does not introduce writes or external side effects', async () => {
  let writesAttempted = false;
  let externalCall = false;

  const retrievalService = {
    async retrieve() {
      externalCall = true;
      return [{ topic: 'support', content: 'Read-only content' }];
    },
    writesEnabled: false,
    async sendMessage() {
      writesAttempted = true;
    },
    async approvePayment() {
      writesAttempted = true;
    },
    async executeTask() {
      writesAttempted = true;
    }
  };

  const result = await analyzeMessage({ text: 'support question', retrievalService });

  assert.equal(externalCall, true);
  assert.equal(writesAttempted, false);
  assert.equal(result.knowledge.length, 1);
  assert.equal(result.knowledge[0].content, 'Read-only content');
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
});
