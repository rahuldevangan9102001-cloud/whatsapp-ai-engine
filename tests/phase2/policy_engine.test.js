import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAction } from '../../autonomous/policy_engine.js';

test('payment mutations are forbidden', () => assert.equal(evaluateAction('approve_payment').allowed, false));
test('read-only shadow actions are allowed as suggestions', () => assert.equal(evaluateAction('classify_intent').allowed, true));