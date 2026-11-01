import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerContext } from '../../autonomous/context_builder.js';

test('context builder handles missing and invalid collection inputs safely', () => {
  const context = buildCustomerContext({ user: null, recentMessages: null, memory: null });
  assert.equal(context.user, null);
  assert.deepEqual(context.recentMessages, []);
  assert.deepEqual(context.memory, []);
});

test('context builder copies collection entries without mutating input', () => {
  const message = { role: 'user', text: 'hello' };
  const memory = { memoryKey: 'goal', memoryValue: 'growth' };
  const context = buildCustomerContext({ user: { id: 'u1' }, recentMessages: [message], memory: [memory] });
  assert.notEqual(context.recentMessages[0], message);
  assert.notEqual(context.memory[0], memory);
  assert.deepEqual(message, { role: 'user', text: 'hello' });
  assert.deepEqual(memory, { memoryKey: 'goal', memoryValue: 'growth' });
});