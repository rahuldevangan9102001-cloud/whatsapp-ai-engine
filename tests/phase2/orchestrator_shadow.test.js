import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMessage } from '../../autonomous/orchestrator.js';

test('orchestrator produces a read-only shadow result', async () => {
  const result = await analyzeMessage({ text: 'payment screenshot bhej diya', user: { current_step: 10 } });
  assert.equal(result.intent.intent, 'payment_submitted');
  assert.equal(result.stage.stage, 'payment_submission');
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
});