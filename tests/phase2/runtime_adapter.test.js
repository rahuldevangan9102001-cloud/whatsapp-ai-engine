import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeAdapter } from '../../autonomous/runtime_adapter.js';

test('adapter normalizes existing snake_case user fields without mutation', async () => {
  let receivedInput;
  const adapter = createRuntimeAdapter({ analyzer: async (input) => {
    receivedInput = input;
    return { analyzed: true };
  } });
  const user = { current_step: 10, payment_status: 'TOKEN_PAID', is_active: false, is_locked: true };
  await adapter.analyze({ text: 'payment screenshot bhej diya', user });
  assert.equal(receivedInput.user.currentStep, 10);
  assert.equal(receivedInput.user.paymentStatus, 'TOKEN_PAID');
  assert.equal(receivedInput.user.isLocked, true);
  assert.equal(user.currentStep, undefined);
});

test('adapter exposes only read-only capabilities', () => {
  const adapter = createRuntimeAdapter({ analyzer: async () => ({}) });
  assert.equal(adapter.capabilities.writesEnabled, false);
  assert.equal(adapter.capabilities.paymentActionsEnabled, false);
  assert.equal(adapter.capabilities.outboundMessagingEnabled, false);
  assert.equal(adapter.capabilities.databaseMutationEnabled, false);
  assert.equal(adapter.capabilities.externalServiceExecutionEnabled, false);
  assert.equal(Object.prototype.hasOwnProperty.call(adapter, 'sendMessage'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(adapter, 'approvePayment'), false);
});

test('adapter returns a safe failure result without throwing', async () => {
  const adapter = createRuntimeAdapter({ analyzer: async () => { throw new Error('test failure'); } });
  const result = await adapter.analyze({ text: 'hello' });
  assert.equal(result.ok, false);
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
});