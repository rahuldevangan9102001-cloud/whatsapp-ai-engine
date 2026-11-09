import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { isFinancialProblemMessage } from '../conversation/episodic_memory.js';
import { claimInboundMessage } from '../conversation/inbound_claim.js';

const source = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');

function extract(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing source boundary: ${start}`);
  return source.slice(first, last);
}

function harness(url = 'https://example.com/tree', claims = new Set()) {
  const sends = [];
  const records = [];
  const errors = [];
  const pending = new Map();
  let aiCalls = 0;
  let accountLookups = 0;
  const context = {
    console: { log() {}, error(...args) { errors.push(args.join(' ')); } },
    sock: { user: { id: '123@s.whatsapp.net' } },
    BINARY_TREE_PORTAL_URL: url,
    ADMIN_PHONE: '123',
    pendingUpsertQueue: new Map(),
    pendingAccountDataRequests: pending,
    processedMessageIds: new Map(),
    recentMessageHashes: new Map(),
    cleanupMessageDedup() {},
    claimInboundMessage: async (client, account, id) => claimInboundMessage({
      from(table) {
        assert.equal(table, 'whatsapp_inbound_claims');
        return {
          async insert({ claim_key: key }) {
            if (claims.has(key)) return { error: { code: '23505', message: 'duplicate' } };
            claims.add(key);
            return { error: null };
          }
        };
      }
    }, account, id),
    resolveRealPhone: async (sock, jid) => jid,
    extractContactDetails: () => ({ phone: '15551234567', pushName: 'Friend' }),
    createDedupIdentity: phone => phone,
    getImageMessage: message => message.imageMessage || null,
    normalizeMessageTimestamp: value => value,
    normalizeMessageText: text => text.trim().toLowerCase(),
    createMessageHash: (id, text) => `${id}:${text}`,
    isFinancialProblemMessage,
    sendBulletproofSingleReply: async (sock, jid, text, id, owner) => {
      sends.push({ jid, text, id, owner });
      return { key: { id } };
    },
    recordPortalConversation: async (...args) => { records.push(args); },
    fetchBinaryUserData: async () => {
      accountLookups++;
      return { name: 'Test User', total_income: 123 };
    },
    supabase: {
      from() {
        const query = {
          select() { return query; },
          eq() { return query; },
          maybeSingle: async () => ({ data: null, error: { message: 'not available' } })
        };
        return query;
      }
    },
    getLeadNotes: () => ({}),
    inferPersonalDetails: () => ({}),
    inferGender: () => 'neutral',
    getConversationTiming: () => ({}),
    generateAIResponse: async () => { aiCalls++; return { reply: 'casual reply' }; },
    createFallbackAIResponse: () => ({ reply: 'fallback' })
  };
  vm.createContext(context);
  vm.runInContext(
    extract('function isBinaryTreePortalRequest(text) {', '\nfunction normalizeMessageText(text) {') +
    extract('async function processMessagesUpsertEvent(', "\n    sock.ev.on('messages.upsert', processMessagesUpsertEvent);") +
    '\nthis.handle = processMessagesUpsertEvent;',
    context
  );
  const message = (id, text) => ({
    type: 'notify',
    messages: [{ key: { id, remoteJid: '15551234567@s.whatsapp.net' }, message: { conversation: text } }]
  });
  return { context, sends, records, errors, pending, message, get aiCalls() { return aiCalls; }, get accountLookups() { return accountLookups; } };
}

test('portal and binary link variants get exactly one URL and never invoke verification or AI', async () => {
  for (const text of [
    'portal link bhejo', 'binary link bhejo', 'binary tree link please',
    'डाउनलाइन का लिंक भेजो', 'मेरा बाइनरी लिंक चाहिए', 'app link aur income status bhejo',
    'link', 'PORTAL', 'Binary', 'video link bhejo', 'mera binary income batao',
    'portal status', 'link nahi chahiye', 'mujhe link ke baare mein batao',
    'linkbhejo meri income', 'myPORTALstatus', 'binarytree account status',
    'डाउनलाइनलिंककमाई', 'बाइनरीस्टेटस', 'पोर्टललिंक'
  ]) {
    const h = harness();
    h.context.getAccountDataRequestType = () => { throw new Error('verification must not run'); };
    h.context.extractRequestedAccountIdentity = () => { throw new Error('identity parsing must not run'); };
    const event = h.message('id-1', text);
    await Promise.all([h.context.handle(event), h.context.handle(event)]);
    assert.equal(h.sends.length, 1, text);
    assert.equal(h.sends[0].text, 'https://example.com/tree', text);
    assert.equal(h.sends[0].owner, 'BINARY_TREE_PORTAL');
    assert.equal(h.aiCalls, 0);
    assert.equal(h.accountLookups, 0);
    assert.equal(h.pending.size, 0);
    assert.equal(h.records.length, 1, text);
    assert.equal(h.records[0][3], 'https://example.com/tree', text);
    assert.equal(h.errors.length, 0, text);
  }
});

test('portal early return precedes user lookup and response selection', () => {
  const handler = extract('async function processMessagesUpsertEvent(', "\n    sock.ev.on('messages.upsert', processMessagesUpsertEvent);");
  assert.ok(handler.indexOf('const isPortalRequest = isBinaryTreePortalRequest(incomingText);') < handler.indexOf('await claimInboundMessage'));
  assert.ok(handler.indexOf('if (isPortalRequest)') < handler.indexOf('const selectResponse = async () =>'));
});

test('link is sent before contact lookup and bypasses verification, AI and fallback', async () => {
  const h = harness();
  const order = [];
  h.context.resolveRealPhone = async () => {
    order.push('contact');
    return '15551234567@s.whatsapp.net';
  };
  h.context.recordPortalConversation = async (...args) => {
    order.push('record');
    h.records.push(args);
  };
  h.context.sendBulletproofSingleReply = async (sock, jid, text) => {
    order.push('send');
    assert.equal(text, 'https://example.com/tree');
    return { key: {} };
  };
  h.context.getAccountDataRequestType = () => { throw new Error('verification must not run'); };
  h.context.generateAIResponse = () => { throw new Error('AI must not run'); };
  h.context.createFallbackAIResponse = () => { throw new Error('fallback must not run'); };
  await h.context.handle(h.message('top', 'binary aur income details'));
  assert.deepEqual(order, ['send', 'contact', 'record']);
  assert.equal(h.records.length, 1);
  assert.equal(h.errors.length, 0);
});

test('wrapped WhatsApp text also takes the top-level link bypass', async () => {
  const h = harness();
  h.context.getAccountDataRequestType = () => { throw new Error('verification must not run'); };
  await h.context.handle({
    type: 'notify',
    messages: [{
      key: { id: 'wrapped', remoteJid: '15551234567@s.whatsapp.net' },
      message: { ephemeralMessage: { message: { extendedTextMessage: { text: 'portal status' } } } }
    }]
  });
  assert.equal(h.sends.length, 1);
  assert.equal(h.sends[0].text, 'https://example.com/tree');
  assert.equal(h.aiCalls, 0);
  assert.equal(h.errors.length, 0);
});

test('duplicate events across processes and restarts have only one sender', async () => {
  const claims = new Set();
  const first = harness('https://example.com/tree', claims);
  const second = harness('https://example.com/tree', claims);
  const event = first.message('shared-id', 'portal link bhejo');
  await Promise.all([first.context.handle(event), second.context.handle(event)]);
  assert.equal(first.sends.length + second.sends.length, 1);
  assert.equal(first.records.length + second.records.length, 1);
  const restarted = harness('https://example.com/tree', claims);
  await restarted.context.handle(event);
  assert.equal(restarted.sends.length, 0);
  assert.equal(restarted.aiCalls, 0);
});

test('claim errors or missing stable IDs fail closed without verification or send', async () => {
  const h = harness();
  h.context.claimInboundMessage = async () => { throw new Error('database unavailable'); };
  await h.context.handle(h.message('claim-failure', 'binary link bhejo'));
  assert.equal(h.sends.length, 0);
  assert.equal(h.aiCalls, 0);
  assert.equal(h.accountLookups, 0);
  assert.ok(h.errors.some(error => error.includes('database unavailable')));
  const missingId = harness();
  await missingId.context.handle(missingId.message(undefined, 'portal link bhejo'));
  assert.equal(missingId.sends.length, 0);
  assert.ok(missingId.errors.some(error => error.includes('stable message ID')));
});

test('a claimed send failure is not retried on replay after restart', async () => {
  const claims = new Set();
  const first = harness('https://example.com/tree', claims);
  let attempts = 0;
  first.context.sendBulletproofSingleReply = async () => { attempts++; throw new Error('uncertain send'); };
  const event = first.message('uncertain', 'portal link bhejo');
  await first.context.handle(event);
  const restarted = harness('https://example.com/tree', claims);
  await restarted.context.handle(event);
  assert.equal(attempts, 1);
  assert.equal(first.records.length, 0);
  assert.equal(restarted.sends.length, 0);
});

test('different messages in one batch each get one response even with identical text', async () => {
  const h = harness();
  const first = h.message('first', 'portal link bhejo').messages[0];
  const second = h.message('second', 'portal link bhejo').messages[0];
  await h.context.handle({ type: 'notify', messages: [first, second] });
  assert.deepEqual(h.sends.map(send => send.id), ['first', 'second']);
  assert.ok(h.sends.every(send => send.text === 'https://example.com/tree'));
});

test('hardcoded payment response skips the AI and sends once', async () => {
  const h = harness();
  await h.context.handle(h.message('payment', 'payment done'));
  assert.equal(h.sends.length, 1);
  assert.equal(h.sends[0].owner, 'PAYMENT_ACK');
  assert.equal(h.aiCalls, 0);
});

test('send failure is logged without triggering another response', async () => {
  const h = harness();
  let attempts = 0;
  h.context.sendBulletproofSingleReply = async () => {
    attempts++;
    throw new Error('network unavailable');
  };
  await h.context.handle(h.message('failure', 'portal link bhejo'));
  assert.equal(attempts, 1);
  assert.equal(h.aiCalls, 0);
  assert.ok(h.errors.some(error => error.includes('network unavailable')));
});

test('real outbound guard blocks duplicate IDs but permits identical replies to distinct messages', async () => {
  const outbound = [];
  const context = {
    console: { log() {} },
    process: { pid: 1 },
    sentReplyKeys: new Map(),
    outboundSendDedup: new Map(),
    OUTBOUND_SAME_TEXT_DEDUP_TTL_MS: 5000,
    delay: async () => {},
    getRandomHumanDelay: () => 0
  };
  vm.createContext(context);
  vm.runInContext(
    extract('const activeSendingJids = new Set();', '\nasync function fetchBinaryUserData(') +
    extract('async function sendWhatsAppWithDiagnostics(', '\nfunction createQuickReplyButtons(') +
    '\nthis.send = sendBulletproofSingleReply;',
    context
  );
  const sock = {
    presenceSubscribe: async () => {},
    sendPresenceUpdate: async () => {},
    sendMessage: async (jid, payload) => { outbound.push({ jid, text: payload.text }); return { key: {} }; }
  };
  await context.send(sock, 'user', 'https://example.com/tree', 'first', 'BINARY_TREE_PORTAL');
  await context.send(sock, 'user', 'https://example.com/tree', 'first', 'BINARY_TREE_PORTAL');
  await context.send(sock, 'user', 'https://example.com/tree', 'second', 'BINARY_TREE_PORTAL');
  assert.equal(outbound.length, 2);
  assert.ok(outbound.every(item => item.text === 'https://example.com/tree'));
});

test('link request bypasses pending account verification; unrelated chat does not restart it', async () => {
  const h = harness();
  await h.context.handle(h.message('income', 'Meri income kitni hai'));
  assert.equal(h.pending.size, 1);
  assert.match(h.sends[0].text, /naam.*mobile number/i);
  await h.context.handle(h.message('link', 'binarytree income batao'));
  assert.equal(h.sends[1].text, 'https://example.com/tree');
  assert.equal(h.sends.length, 2);
  assert.equal(h.pending.size, 1);
  await h.context.handle(h.message('greeting', 'Hello'));
  assert.equal(h.sends[2].text, 'casual reply');
  assert.equal(h.aiCalls, 1);
  await h.context.handle(h.message('identity', 'Test User 15551234567'));
  assert.match(h.sends[3].text, /123/);
  assert.equal(h.accountLookups, 1);
});

test('personal account data still requires both fields and cannot bypass verification', async () => {
  const h = harness();
  await h.context.handle(h.message('account', 'Mera account status batao'));
  assert.equal(h.sends.length, 1);
  assert.match(h.sends[0].text, /naam.*mobile number/i);
  assert.equal(h.accountLookups, 0);
  await h.context.handle(h.message('wrong', 'Other Person 15551234567'));
  assert.match(h.sends[1].text, /record match nahi hua/);
  assert.equal(h.accountLookups, 1);
});

test('missing portal configuration returns one explicit error without verification', async () => {
  const h = harness('');
  await h.context.handle(h.message('link', 'portal link bhejo'));
  assert.equal(h.sends.length, 1);
  assert.match(h.sends[0].text, /link abhi configure nahi hai/);
  assert.match(h.errors[0], /BINARY_TREE_URL/);
  assert.equal(h.pending.size, 0);
  assert.equal(h.aiCalls, 0);
});

test('a portal link requested in an image caption bypasses payment acknowledgement', async () => {
  const h = harness();
  await h.context.handle({
    type: 'notify',
    messages: [{
      key: { id: 'caption', remoteJid: '15551234567@s.whatsapp.net' },
      message: { imageMessage: { caption: 'portal link bhejo' } }
    }]
  });
  assert.equal(h.sends.length, 1);
  assert.equal(h.sends[0].text, 'https://example.com/tree');
  assert.equal(h.sends[0].owner, 'BINARY_TREE_PORTAL');
});

test('general income discussion does not enter the personal account flow', () => {
  const h = harness();
  assert.equal(h.context.getAccountDataRequestType('income kaise kama sakte hain'), null);
  assert.equal(h.context.getAccountDataRequestType('Meri income kitni hai'), 'income');
  assert.equal(h.context.getAccountDataRequestType('Mera account status batao'), 'status');
});
