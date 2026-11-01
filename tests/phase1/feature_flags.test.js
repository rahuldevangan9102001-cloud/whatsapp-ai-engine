import test from 'node:test';
import assert from 'node:assert/strict';
import { areAutonomousActionsDisabled, getFeatureFlags, isAutonomousRuntimeEnabled } from '../../autonomous/feature_flags.js';

test('autonomous flags default to disabled and dry-run', () => {
  const flags = getFeatureFlags({});
  assert.equal(flags.enabled, false);
  assert.equal(flags.replyMode, 'disabled');
  assert.equal(flags.dryRun, true);
  assert.equal(isAutonomousRuntimeEnabled({}), false);
  assert.equal(areAutonomousActionsDisabled({}), true);
});

test('invalid flag values fail closed', () => {
  const flags = getFeatureFlags({ AUTONOMOUS_AI_ENABLED: 'yes', AUTONOMOUS_REPLY_MODE: 'unknown', AUTONOMOUS_DRY_RUN: 'no' });
  assert.equal(flags.enabled, false);
  assert.equal(flags.replyMode, 'disabled');
  assert.equal(flags.dryRun, true);
});

test('phase 1 cannot execute payment actions or task processing', () => {
  const flags = getFeatureFlags({
    AUTONOMOUS_AI_ENABLED: 'true',
    AUTONOMOUS_REPLY_MODE: 'shadow',
    AUTONOMOUS_PAYMENT_ACTIONS: 'true',
    AUTONOMOUS_TASK_PROCESSOR: 'true'
  });
  assert.equal(flags.paymentActions, true);
  assert.equal(flags.taskProcessor, true);
  assert.equal(areAutonomousActionsDisabled({}), true);
});