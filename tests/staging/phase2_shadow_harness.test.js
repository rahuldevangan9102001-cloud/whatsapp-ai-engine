import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPhase2ShadowHarness } from '../../staging/phase2_shadow_harness.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const harnessPath = path.join(root, 'staging', 'phase2_shadow_harness.js');

test('isolated staging harness runs read-only shadow analysis with in-memory fixtures', async () => {
  const input = {
    text: 'payment screenshot bhej diya',
    user: {
      id: 'staging-user',
      current_step: 10,
      payment_status: 'TOKEN_PAID',
      is_locked: true
    },
    recentMessages: [{ role: 'user', text: 'payment screenshot bhej diya' }],
    memories: [],
    knowledgeEntries: []
  };
  const originalInput = structuredClone(input);
  const result = await runPhase2ShadowHarness(input);

  assert.equal(result.flags.mode, 'isolated-staging-shadow');
  assert.equal(result.flags.enabled, true);
  assert.equal(result.flags.replyMode, 'shadow');
  assert.equal(result.flags.dryRun, true);
  assert.equal(result.analysis.result.intent.intent, 'payment_submitted');
  assert.equal(result.analysis.result.stage.stage, 'payment_submission');
  assert.equal(result.writesEnabled, false);
  assert.equal(result.outboundMessagingEnabled, false);
  assert.equal(result.paymentActionsEnabled, false);
  assert.equal(result.databaseMutationEnabled, false);
  assert.equal(result.externalServiceExecutionEnabled, false);
  assert.deepEqual(input, originalInput);
});

test('all real autonomous actions remain disabled in the harness', async () => {
  const result = await runPhase2ShadowHarness({
    text: 'hello',
    user: { current_step: 1 }
  });

  assert.equal(result.flags.knowledgeRetrieval, false);
  assert.equal(result.flags.paymentActions, false);
  assert.equal(result.flags.followups, false);
  assert.equal(result.flags.taskProcessor, false);
  assert.equal(result.flags.memoryWrites, false);
  assert.equal(result.flags.auditLogging, false);
  assert.equal(Object.hasOwn(result, 'sendMessage'), false);
  assert.equal(Object.hasOwn(result, 'approvePayment'), false);
  assert.equal(Object.hasOwn(result, 'executeTask'), false);
});

test('harness source is isolated from server and external runtime imports', () => {
  const source = fs.readFileSync(harnessPath, 'utf8');

  assert.doesNotMatch(
    source,
    /server\.js|dotenv|supabase|baileys|axios|fetch\s*\(/i
  );
});