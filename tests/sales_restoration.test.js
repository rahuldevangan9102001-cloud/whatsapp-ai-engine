import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { isFinancialProblemMessage } from '../conversation/episodic_memory.js';

const source = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');

function extract(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing boundary: ${start}`);
  return source.slice(first, last);
}

function salesHarness({ qr = false, failUpdate = false } = {}) {
  const sends = [];
  const updates = [];
  const synced = [];
  const ctx = {
    fs: { existsSync: () => qr, readFileSync: () => Buffer.from('mock-qr') },
    path: { resolve: value => value },
    isFinancialProblemMessage,
    getLeadNotes: user => {
      try { return JSON.parse(user?.lead_notes || '{}'); } catch { return {}; }
    },
    getDynamicRoadmapDates: () => ({ d0: '', d1: '', d2: '' }),
    createQuickReplyButtons: labels => labels.map(label => ({ label, id: label })),
    syncCustomerToSheet: async user => { synced.push({ ...user }); },
    sendWhatsAppWithDiagnostics: async (...args) => { sends.push(args); return {}; },
    supabase: {
      from(table) {
        assert.equal(table, 'users');
        return {
          update(update) {
            updates.push(update);
            return { eq: () => ({ select: () => ({ single: async () => failUpdate
              ? { error: { message: 'update failed' } }
              : { data: { ...ctx.user, ...update }, error: null } }) }) };
          }
        };
      }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(
    extract('const SALES_STEP_PROMPTS = {', '\nasync function generateAIResponse(') +
    '\nthis.api = { SALES_STEP_PROMPTS, getRequestedIds, getPaymentPayload, sendPaymentDetails, getSalesStepResponse, handleSalesStateFlow, classifyMessageIntent };',
    ctx
  );
  const user = (step, notes = { consultant_flow_version: 2 }) => {
    ctx.user = { id: 'user-id', name: 'Test', phone_number: '123', current_step: step, nodes_count: 2, lead_notes: JSON.stringify(notes) };
    return ctx.user;
  };
  const run = (step, text, extra = {}) => ctx.api.handleSalesStateFlow({
    sock: {}, currentUser: user(step), targetJid: 'user', incomingText: text,
    pushName: 'Test', realNumber: '123', messageId: 'message-id', ...extra
  });
  return { ctx, sends, updates, synced, user, run };
}

test('baseline prompts, intent classification, ID counts, and payment amounts are available', () => {
  const { ctx } = salesHarness();
  assert.equal(Object.keys(ctx.api.SALES_STEP_PROMPTS).length, 14);
  for (let step = 1; step <= 14; step++) {
    assert.equal(ctx.api.getSalesStepResponse(step), ctx.api.SALES_STEP_PROMPTS[step]);
  }
  assert.equal(ctx.api.getSalesStepResponse(99), ctx.api.SALES_STEP_PROMPTS[1]);
  assert.equal(ctx.api.getRequestedIds('3 IDs'), 3);
  assert.equal(ctx.api.getRequestedIds('tripod'), 3);
  assert.equal(ctx.api.getRequestedIds('two'), 2);
  assert.equal(ctx.api.getRequestedIds('none'), 1);
  assert.match(ctx.api.getPaymentPayload(2), /₹200/);
  assert.match(ctx.api.getPaymentPayload(2, true), /₹3,998/);
  assert.match(ctx.api.getPaymentPayload(4), /maximum 3 IDs/);
  for (const [text, intent] of [['hello', 'greeting'], ['yes', 'acknowledgement'], ['join', 'business'], ['income', 'earning'], ['upi', 'payment'], ['status', 'status'], ['kaise', 'question'], ['abc', 'unclear'], ['', 'empty']]) {
    assert.equal(ctx.api.classifyMessageIntent(text), intent);
  }
});

test('payment helper sends either one text or one QR image with its caption', async () => {
  for (const qr of [false, true]) {
    const h = salesHarness({ qr });
    await h.ctx.api.sendPaymentDetails({}, 'user', 2, true, true, 'id');
    assert.equal(h.sends.length, 1);
    const payload = h.sends[0][2];
    assert.match(payload.text || payload.caption, /₹3,998/);
    assert.match(payload.text || payload.caption, /1, 2, 3/);
    if (qr) assert.equal(payload.image.toString(), 'mock-qr');
    else assert.equal(payload.image, undefined);
  }
});

test('saved sales steps retain their baseline transitions and sync user updates', async () => {
  const cases = [
    [2, 'Raipur', 3], [3, 'join plan', 4], [4, 'yes', 5],
    [5, '2 ids full', 10], [6, 'join plan', 7], [7, 'join plan', 8],
    [8, 'join plan', 9], [9, '2 ids', 10], [10, '2 ids', 10],
    [12, 'join plan', 13], [13, 'join plan', 14], [14, 'join plan', 14]
  ];
  for (const [step, text, expected] of cases) {
    const h = salesHarness();
    assert.equal(await h.run(step, text), true, `step ${step}`);
    assert.equal(h.sends.length, 1, `step ${step}`);
    assert.equal(h.ctx.user.current_step, expected, `step ${step}`);
    assert.equal(h.updates.length, 1, `step ${step}`);
    assert.equal(h.synced.length, 1, `step ${step}`);
    assert.equal(JSON.parse(h.ctx.user.lead_notes).last_user_message, text);
  }
});

test('greetings and step 1 or 11 fall through; returning greetings and objections send once', async () => {
  for (const [step, text] of [[1, 'join plan'], [11, 'join plan'], [8, 'hello']]) {
    const h = salesHarness();
    assert.equal(await h.run(step, text), false);
    assert.equal(h.sends.length, 0);
  }
  const returning = salesHarness();
  assert.equal(await returning.run(4, 'hello', { returningAfterBreak: true }), true);
  assert.equal(returning.sends.length, 1);
  const objection = salesHarness();
  assert.equal(await objection.run(4, 'scam'), true);
  assert.equal(objection.sends.length, 1);
  assert.equal(JSON.parse(objection.ctx.user.lead_notes).objection, 'scam');
  const financial = salesHarness();
  assert.equal(await financial.run(4, 'paise nahi hain'), true);
  assert.match(financial.sends[0][2].text, /bina kisi payment/i);
  assert.doesNotMatch(financial.sends[0][2].text, /daily income|lagat/i);
});

test('legacy saved users are migrated by existing notes and address is preserved', async () => {
  const h = salesHarness();
  const currentUser = h.user(1, { address: 'Raipur', existing: 'kept' });
  assert.equal(await h.ctx.api.handleSalesStateFlow({
    sock: {}, currentUser, targetJid: 'user', incomingText: 'hello',
    pushName: 'Test', realNumber: '123'
  }), false);
  assert.equal(currentUser.current_step, 3);
  const notes = JSON.parse(currentUser.lead_notes);
  assert.equal(notes.consultant_flow_version, 2);
  assert.equal(notes.address, 'Raipur');
  assert.equal(notes.existing, 'kept');
  assert.equal(h.synced.length, 1);
});

test('sales update failure is surfaced before payment can be sent', async () => {
  const h = salesHarness({ failUpdate: true });
  await assert.rejects(h.run(5, '2 ids full'), /update failed/);
  assert.equal(h.sends.length, 0);
});

function eventHarness({ qr = false, claims = new Set(), users = {}, send = null } = {}) {
  const h = salesHarness({ qr });
  const ctx = h.ctx;
  const outbound = [];
  const logs = [];
  const errors = [];
  let aiCalls = 0;
  Object.assign(ctx, {
    console: { log() {}, error(...args) { errors.push(args.join(' ')); } },
    sock: { user: { id: 'bot@s.whatsapp.net' } },
    BINARY_TREE_PORTAL_URL: 'https://example.com/tree',
    ADMIN_PHONE: '123',
    pendingUpsertQueue: new Map(),
    pendingAccountDataRequests: new Map(),
    processedMessageIds: new Map(),
    recentMessageHashes: new Map(),
    cleanupMessageDedup() {},
    claimInboundMessage: async (db, account, id) => {
      const key = `${account}:${id}`;
      if (claims.has(key)) return false;
      claims.add(key);
      return true;
    },
    resolveRealPhone: async (sock, jid) => jid,
    extractContactDetails: (message, jid) => ({ phone: jid, pushName: 'Test' }),
    createDedupIdentity: value => value,
    getImageMessage: message => message.imageMessage || null,
    normalizeMessageTimestamp: value => value,
    normalizeMessageText: text => text.trim().toLowerCase(),
    createMessageHash: (id, text) => `${id}:${text}`,
    sendBulletproofSingleReply: async (sock, jid, payload, id, owner) => {
      if (send) await send(jid);
      outbound.push({ jid, payload, id, owner });
      return { key: { id } };
    },
    recordPortalConversation: async () => {},
    fetchBinaryUserData: async () => { throw new Error('unexpected account lookup'); },
    inferPersonalDetails: () => ({}),
    inferGender: () => 'neutral',
    getConversationTiming: () => ({}),
    fetchRelevantEpisodes: async () => [],
    generateAIResponse: async () => { aiCalls++; return { reply: 'AI reply' }; },
    createFallbackAIResponse: () => ({ reply: 'fallback' })
  });
  ctx.supabase = {
    from(table) {
      if (table === 'conversation_logs') {
        return {
          select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
          insert: async rows => { logs.push(...rows); return { error: null }; }
        };
      }
      assert.equal(table, 'users');
      return {
        select: () => ({ eq: (field, value) => ({ maybeSingle: async () => ({ data: users[value] || null, error: null }) }) }),
        insert: rows => ({ select: () => ({ single: async () => {
          const user = { id: rows[0].phone_number, ...rows[0] };
          users[user.phone_number] = user;
          return { data: user, error: null };
        } }) }),
        update: update => ({
          eq(field, value) {
            const user = Object.values(users).find(item => item[field] === value);
            assert.ok(user, `missing user ${value}`);
            Object.assign(user, update);
            const result = { data: user, error: null };
            return {
              select: () => ({ single: async () => result }),
              then: resolve => resolve(result)
            };
          }
        })
      };
    }
  };
  vm.runInContext(
    extract('function isBinaryTreePortalRequest(text) {', '\nfunction normalizeMessageText(text) {') +
    extract('async function processMessagesUpsertEvent(', "\n    sock.ev.on('messages.upsert', processMessagesUpsertEvent);") +
    '\nthis.handle = processMessagesUpsertEvent;',
    ctx
  );
  const event = (id, jid, text, image = false) => ({
    type: 'notify',
    messages: [{ key: { id, remoteJid: jid }, message: image ? { imageMessage: { caption: text } } : { conversation: text } }]
  });
  return { ...h, outbound, logs, errors, users, event, get aiCalls() { return aiCalls; } };
}

function savedUser(jid, step = 5) {
  return { id: jid, phone_number: jid, name: 'Test', current_step: step, nodes_count: 2, lead_notes: JSON.stringify({ consultant_flow_version: 2 }) };
}

test('message handler delivers payment details or QR once and logs the actual reply', async () => {
  for (const [qr, step] of [[false, 5], [true, 5], [false, 10]]) {
    const jid = 'one@s.whatsapp.net';
    const h = eventHarness({ qr, users: { [jid]: savedUser(jid, step) } });
    const event = h.event('payment-details', jid, '2 ids full payment details chahiye');
    await Promise.all([h.ctx.handle(event), h.ctx.handle(event)]);
    assert.equal(h.outbound.length, 1);
    assert.equal(h.outbound[0].owner, 'SALES_FLOW');
    const payload = h.outbound[0].payload;
    assert.match(payload.text || payload.caption, /₹3,998/);
    assert.equal(Boolean(payload.image), qr);
    assert.equal(h.logs.length, 2);
    assert.equal(h.logs[1].message_text, payload.text || payload.caption);
    assert.equal(h.aiCalls, 0);
    assert.equal(h.errors.length, 0);
  }
});

test('questions fall through to AI and financial difficulty gets the selected supportive sales response', async () => {
  const jid = 'one@s.whatsapp.net';
  const h = eventHarness({ users: { [jid]: savedUser(jid, 9) } });
  await h.ctx.handle(h.event('question', jid, 'kaise samjhao?'));
  assert.equal(h.aiCalls, 1);
  assert.equal(h.outbound[0].owner, 'AI_FLOW');
  await h.ctx.handle(h.event('hardship', jid, 'paise nahi hain'));
  assert.equal(h.aiCalls, 1);
  assert.equal(h.outbound[1].owner, 'SALES_FLOW');
  assert.match(h.outbound[1].payload.text, /bina kisi payment/i);
  assert.equal(h.errors.length, 0);
});

test('portal, account verification and payment acknowledgements retain priority over sales', async () => {
  const jid = 'one@s.whatsapp.net';
  const h = eventHarness({ users: { [jid]: savedUser(jid, 9) } });
  for (const [id, text, image, owner] of [
    ['portal', 'binary payment details', false, 'BINARY_TREE_PORTAL'],
    ['account', 'Mera account status batao', false, 'ACCOUNT_DATA_VERIFICATION'],
    ['done', 'payment done', false, 'PAYMENT_ACK'],
    ['image', 'payment details', true, 'PAYMENT_ACK']
  ]) {
    await h.ctx.handle(h.event(id, jid, text, image));
    assert.equal(h.outbound.at(-1).owner, owner);
  }
  assert.equal(h.outbound.length, 4);
  assert.equal(h.aiCalls, 0);
  assert.equal(h.errors.length, 0);
});

test('sales duplicate replay is suppressed and different users process independently', async () => {
  const a = 'a@s.whatsapp.net';
  const b = 'b@s.whatsapp.net';
  const users = { [a]: savedUser(a, 2), [b]: savedUser(b, 2) };
  const claims = new Set();
  let entered = 0;
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const h = eventHarness({ users, claims, send: async () => { entered++; await barrier; } });
  const first = h.ctx.handle(h.event('a1', a, 'Raipur'));
  const second = h.ctx.handle(h.event('b1', b, 'Delhi'));
  for (let i = 0; i < 30 && entered < 2; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(entered, 2, 'both users must reach the send independently');
  release();
  await Promise.all([first, second]);
  assert.equal(h.outbound.length, 2);
  const restarted = eventHarness({ users, claims });
  await restarted.ctx.handle(restarted.event('a1', a, 'Raipur'));
  assert.equal(restarted.outbound.length, 0);
  await h.ctx.handle(h.event('a2', a, 'join plan'));
  assert.equal(h.outbound.length, 3);
  assert.equal(h.errors.length, 0);
});

test('new users remain on baseline step 1 and ordinary greetings still reach AI', async () => {
  const jid = 'new@s.whatsapp.net';
  const h = eventHarness();
  await h.ctx.handle(h.event('new1', jid, 'hello'));
  assert.equal(h.users[jid].current_step, 1);
  assert.equal(JSON.parse(h.users[jid].lead_notes).consultant_flow_version, 2);
  assert.equal(h.aiCalls, 1);
  assert.equal(h.outbound.length, 1);
  assert.equal(h.errors.length, 0);
});

test('sales send failure is logged and never followed by an AI reply', async () => {
  const jid = 'one@s.whatsapp.net';
  const h = eventHarness({
    users: { [jid]: savedUser(jid, 2) },
    send: async () => { throw new Error('offline'); }
  });
  await h.ctx.handle(h.event('failed', jid, 'Raipur'));
  assert.equal(h.outbound.length, 0);
  assert.equal(h.aiCalls, 0);
  assert.ok(h.errors.some(error => error.includes('offline')));
  assert.equal(h.users[jid].current_step, 2);
});

test('media and text share the inbound reply deduplication guard', async () => {
  const outbound = [];
  const ctx = {
    console: { log() {} }, process: { pid: 1 }, sentReplyKeys: new Map(),
    outboundSendDedup: new Map(), OUTBOUND_SAME_TEXT_DEDUP_TTL_MS: 5000,
    delay: async () => {}, getRandomHumanDelay: () => 0
  };
  vm.createContext(ctx);
  vm.runInContext(
    extract('const activeSendingJids = new Set();', '\nasync function fetchBinaryUserData(') +
    extract('async function sendWhatsAppWithDiagnostics(', '\nfunction createQuickReplyButtons(') +
    '\nthis.send = sendBulletproofSingleReply;',
    ctx
  );
  const sock = {
    presenceSubscribe: async () => {}, sendPresenceUpdate: async () => {},
    sendMessage: async (jid, payload) => { outbound.push(payload); return { key: {} }; }
  };
  await ctx.send(sock, 'user', { image: Buffer.from('qr'), caption: 'payment' }, 'same', 'SALES_FLOW');
  await ctx.send(sock, 'user', 'extra text', 'same', 'AI_FLOW');
  await ctx.send(sock, 'user', 'another message', 'different', 'AI_FLOW');
  assert.equal(outbound.length, 2);
  assert.equal(outbound[0].caption, 'payment');
});
