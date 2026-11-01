import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const seed = fs.readFileSync(path.join(root, 'seed_knowledge.js'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

test('existing knowledge and workflow anchors remain present', () => {
  for (const symbol of ['const SYSTEM_PROMPT', 'const SALES_STEP_PROMPTS', 'payment', 'referral', 'cron.schedule']) assert.match(server, new RegExp(symbol.replace('.', '\\.'), 'i'));
  assert.doesNotMatch(server, /api\.telegram\.org|callback_query|sendTelegramPhoto/i);
  assert.match(seed, /businessKnowledge|knowledge_base/i);
});

test('phase 2 shadow integration remains guarded and dependencies are unchanged', () => {
  assert.match(server, /runtime_adapter/);
  assert.match(server, /autonomousFlags\.enabled/);
  assert.doesNotMatch(packageJson, /autonomous|vitest|jest|mocha/i);
});