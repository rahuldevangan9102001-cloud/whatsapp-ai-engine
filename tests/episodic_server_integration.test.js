import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { formatEpisodes, formatMemoryTime, isFinancialProblemMessage } from '../conversation/episodic_memory.js';

const source = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');

function extract(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing source boundary: ${start}`);
  return source.slice(first, last);
}

test('AI prompt receives dated recent and old episodes, user context and solution-first rules', async () => {
  let capturedPrompt = '';
  const context = {
    autonomousSystemPrompt: '',
    BINARY_TREE_PORTAL_URL: '',
    BUSINESS_VIDEO_LINK: 'https://business.example/video',
    formatEpisodes,
    formatMemoryTime,
    isFinancialProblemMessage,
    isBinaryTreePortalRequest: () => false,
    createQuickReplyButtons: () => [],
    createFallbackAIResponse: () => ({ reply: 'fallback' }),
    generateContentWithRetry: async prompt => {
      capturedPrompt = prompt;
      return { response: { text: () => JSON.stringify({ reply: 'Pehle apna budget dekho.', confidence: 0.9 }) } };
    }
  };
  vm.createContext(context);
  vm.runInContext(
    extract('const SYSTEM_PROMPT = `', '\nlet globalSock = null;') +
    extract('function isBusinessVideoRequest(text) {', '\nfunction isBinaryTreePortalRequest(text) {') +
    extract('async function generateAIResponse(', '\nasync function startBot() {') +
    '\nthis.generate = generateAIResponse;',
    context
  );
  const reply = await context.generate('Mujhe paise ki jarurat hai, details batao', [
    { role: 'user', message_text: 'Mera naam Riya hai', created_at: '2026-11-06T09:00:00Z' }
  ], 'Riya', 'neutral', { city: 'Raipur' }, [
    { role: 'assistant', message_text: 'https://example.com/old', created_at: '2026-10-30T09:00:00Z' }
  ]);
  assert.equal(reply.reply, 'Pehle apna budget dekho.');
  assert.match(capturedPrompt, /EMPATHY AND SOLUTION FIRST/);
  assert.match(capturedPrompt, /CLIENT NEEDS/);
  assert.match(capturedPrompt, /Friday, 30 October 2026.*IST.*Assistant: https:\/\/example\.com\/old/);
  assert.match(capturedPrompt, /Friday, 6 November 2026.*IST.*User: Mera naam Riya hai/);
  assert.match(capturedPrompt, /"city":"Raipur"/);
  assert.doesNotMatch(reply.reply, /business\.example/);
});

test('AI explicitly reporting an unclear message uses the clarification fallback', async () => {
  const context = {
    autonomousSystemPrompt: '',
    BINARY_TREE_PORTAL_URL: '',
    BUSINESS_VIDEO_LINK: '',
    formatEpisodes,
    formatMemoryTime,
    isBinaryTreePortalRequest: () => false,
    createFallbackAIResponse: (intent, confidence) => ({
      understood: false, needsClarification: true, intent, confidence, reply: 'Please clarify'
    }),
    generateContentWithRetry: async () => ({
      response: { text: () => JSON.stringify({ understood: false, intent: 'unclear', confidence: 0.2, reply: 'guess' }) }
    })
  };
  vm.createContext(context);
  vm.runInContext(
    extract('const SYSTEM_PROMPT = `', '\nlet globalSock = null;') +
    extract('async function generateAIResponse(', '\nasync function startBot() {') +
    '\nthis.generate = generateAIResponse;',
    context
  );
  const reply = await context.generate('unclear');
  assert.equal(reply.understood, false);
  assert.equal(reply.needsClarification, true);
  assert.equal(reply.intent, 'unclear');
  assert.equal(reply.confidence, 0.2);
  assert.equal(reply.reply, 'Please clarify');
});

test('portal replies are persisted with their user and actual response', async () => {
  const inserts = [];
  const supabase = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        maybeSingle: async () => ({ data: { id: 'user-1' }, error: null }),
        insert(rows) { inserts.push({ table, rows }); return Promise.resolve({ error: null }); }
      };
      return query;
    }
  };
  const context = { supabase, console };
  vm.createContext(context);
  vm.runInContext(extract('async function recordPortalConversation(', '\nfunction inferPersonalDetails(text) {') + '\nthis.record = recordPortalConversation;', context);
  await context.record('15550000000', 'Test', 'portal link bhejo', 'https://example.com/tree');
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].table, 'conversation_logs');
  assert.equal(inserts[0].rows[0].user_id, 'user-1');
  assert.equal(inserts[0].rows[0].message_text, 'portal link bhejo');
  assert.equal(inserts[0].rows[1].role, 'assistant');
  assert.equal(inserts[0].rows[1].message_text, 'https://example.com/tree');
});

test('tree snapshot formats node depths without breaking the template literal', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extract('function formatBinaryTreeDetails(', '\nfunction createDedupIdentity(') + '\nthis.format = formatBinaryTreeDetails;', context);
  const result = context.format({
    downline: {
      leftActiveCount: 1, rightActiveCount: 1, totalActiveCount: 2, matchedPairs: 1,
      tree: [
        { depth: 1, side: 'Left', name: 'First', status: 'Active' },
        { depth: 3, side: 'Right', name: 'Second', status: 'Active' }
      ],
      truncated: false
    },
    memberships: [], portalUrl: '', memberFound: false
  });
  assert.match(result, /\nLeft leg — First: Active\n    Right leg — Second: Active/);
});
