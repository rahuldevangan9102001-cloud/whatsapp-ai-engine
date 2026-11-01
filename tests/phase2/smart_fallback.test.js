import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFallbackAIResponse, SMART_FALLBACK_REPLY } from '../../conversation/fallback.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('smart fallback response uses the exact requested clarification', () => {
  assert.deepEqual(createFallbackAIResponse('unknown', 0), {
    understood: false,
    confidence: 0,
    intent: 'unknown',
    needsClarification: true,
    reply: 'Main aapki is baat ko poori tarah samajh nahi paaya. Kya aap apna Naam aur Mobile Number bata sakte hain taaki main aapka binary tree aur account status check kar sakoon?',
    quickReplies: []
  });
  assert.equal(SMART_FALLBACK_REPLY, createFallbackAIResponse().reply);
});

test('server uses deterministic fallback for unclear messages and AI failures', () => {
  assert.match(server, /If NOT understood:[\s\S]*Return exactly this reply: "\$\{SMART_FALLBACK_REPLY\}"/);
  assert.match(server, /if \(!understood\) \{\s*return createFallbackAIResponse/);
  assert.match(server, /return createFallbackAIResponse\('ai_error'\)/);
  assert.match(server, /Using deterministic clarification/);
  assert.match(server, /text: SMART_FALLBACK_REPLY/);
});
