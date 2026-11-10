import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFallbackAIResponse, SMART_FALLBACK_REPLY } from '../../conversation/fallback.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('smart fallback asks a natural clarification without requesting unrelated identity details', () => {
  assert.deepEqual(createFallbackAIResponse('unknown', 0), {
    understood: false,
    confidence: 0,
    intent: 'unknown',
    needsClarification: true,
    reply: 'Aap thoda detail mein bata sakte hain ki kya check karna chahte hain?',
    quickReplies: []
  });
  assert.equal(SMART_FALLBACK_REPLY, createFallbackAIResponse().reply);
  assert.match(createFallbackAIResponse('ai_error').reply, /Maafi chahunga/);
});

test('server falls back deterministically for unclear responses and AI failures', () => {
  assert.match(server, /if \(parsed\.understood === false\) \{\s*return createFallbackAIResponse/);
  assert.match(server, /return createFallbackAIResponse\('ai_error'\)/);
  assert.match(server, /CURRENT SENDER ROLE:/);
  assert.match(server, /Never reveal raw code, stack traces, database details/);
});
