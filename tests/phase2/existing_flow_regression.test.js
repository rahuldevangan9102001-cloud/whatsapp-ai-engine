import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const seed = fs.readFileSync(path.join(root, 'seed_knowledge.js'), 'utf8');

test('phase 2 foundation does not require runtime integration yet', () => {
  assert.match(server, /const SYSTEM_PROMPT/);
  assert.match(server, /const SALES_STEP_PROMPTS/);
  assert.match(server, /cron\.schedule/);
  assert.doesNotMatch(server, /api\.telegram\.org|callback_query|sendTelegramPhoto/i);
  assert.match(seed, /businessKnowledge/);
});