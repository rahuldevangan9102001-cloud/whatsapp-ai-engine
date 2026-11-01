import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStage } from '../../autonomous/stage_resolver.js';

test('existing current_step is authoritative', () => assert.equal(resolveStage({ currentStep: 10, paymentStatus: 'FULL_PAID' }).stage, 'payment_submission'));
test('payment state resolves when current_step is absent', () => assert.equal(resolveStage({ paymentStatus: 'TOKEN_PAID' }).stage, 'position_locked'));