import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const seed = fs.readFileSync(path.join(root, 'seed_knowledge.js'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

test('existing prompts and workflow anchors remain present', () => {
  assert.match(server, /const SYSTEM_PROMPT/);
  assert.match(server, /const SALES_STEP_PROMPTS/);
  assert.match(server, /payment/i);
  assert.doesNotMatch(server, /api\.telegram\.org|callback_query|sendTelegramPhoto/i);
  assert.match(server, /referral/i);
  assert.match(server, /cron\.schedule/);
  assert.match(seed, /businessKnowledge/);
});

test('server shadow integration is present and guarded', () => {
  assert.match(server, /runtime_adapter/);
  assert.match(server, /autonomousFlags\.enabled/);
  assert.doesNotMatch(packageJson, /autonomous|vitest|jest|mocha/i);
});