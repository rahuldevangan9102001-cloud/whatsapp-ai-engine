import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerContext } from '../../autonomous/context_builder.js';

test('context builder returns isolated read-only-shaped context', () => {
  const context = buildCustomerContext({ user: { id: 'u1' }, recentMessages: [{ role: 'user', text: 'hi' }] });
  assert.equal(context.user.id, 'u1');
  assert.deepEqual(context.memory, []);
  assert.notEqual(context.user, undefined);
});