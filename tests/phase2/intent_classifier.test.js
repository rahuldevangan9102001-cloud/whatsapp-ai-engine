import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from '../../autonomous/intent_classifier.js';

test('classifies payment screenshot as submitted payment', () => assert.equal(classifyIntent('payment screenshot bhej diya').intent, 'payment_submitted'));
test('unknown messages fail to unknown intent', () => assert.equal(classifyIntent('xyz').intent, 'unknown'));