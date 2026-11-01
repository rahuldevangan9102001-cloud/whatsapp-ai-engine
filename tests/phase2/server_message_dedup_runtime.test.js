import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8').replace(/\r\n/g, '\n');
const handlerStartMarker = 'async function processMessagesUpsertEvent({ messages, type }, isQueuedReplay = false) {';
const handlerEndMarker = "sock.ev.on('messages.upsert', processMessagesUpsertEvent);";
const handlerStart = serverSource.indexOf(handlerStartMarker);
const handlerEnd = serverSource.indexOf(handlerEndMarker, handlerStart);

assert.notEqual(handlerStart, -1, 'messages.upsert handler registration must exist');
assert.notEqual(handlerEnd, -1, 'messages.upsert handler end boundary must exist');

const helperStart = serverSource.indexOf('function normalizeMessageText(text) {');
const helperEnd = serverSource.indexOf('\nconst rl = readline.createInterface', helperStart);
const contactStart = serverSource.indexOf('function extractContactDetails(msg, targetJid) {');
const contactEnd = serverSource.indexOf('\n// 5. BULLETPROOF NATURAL AI GENERATION', contactStart);
const handlerSource = serverSource.slice(handlerStart, handlerEnd).trim();

assert.notEqual(helperStart, -1, 'dedupe helper definitions must exist');
assert.notEqual(contactStart, -1, 'contact helper definitions must exist');

function createClock(start = 1_700_000_000_000) {
  let now = start;
  class TestDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }

    static now() {
      return now;
    }
  }

  return {
    Date: TestDate,
    now: () => now,
    advance: (milliseconds) => { now += milliseconds; }
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function createHarness({
  failFirstAI = false,
  holdFirstAI = null,
  accountActive = false,
  currentStep = 1,
  memberships = [{ name: 'Test User', status: 'Active' }],
  credentials = { memberId: 'USR100', password: 'member-secret' },
  treeLookupError = null
} = {}) {
  const clock = createClock();
  const currentUser = {
    id: 'test-user',
    phone_number: '15551230000',
    name: 'Test User',
    current_step: currentStep,
    lead_notes: '{"gender":"neutral"}',
    is_locked: false,
    is_active: accountActive,
    payment_status: accountActive ? 'FULL_PAID' : '',
    referral_sent: false
  };
  const state = {
    aiCalls: 0,
    sends: [],
    errors: [],
    lockAdds: 0,
    lockDeletes: 0,
    failFirstAI,
    aiContext: null,
    redactedText: false,
    lidToPn: new Map(),
    processingJids: null
  };

  class TrackingSet extends Set {
    add(value) {
      state.lockAdds += 1;
      return super.add(value);
    }

    delete(value) {
      state.lockDeletes += 1;
      return super.delete(value);
    }
  }

  state.processingJids = new TrackingSet();

  const context = {
    Date: clock.Date,
    process: { pid: 1234 },
    console: {
      log() {},
      warn() {},
      error(...args) { state.errors.push(args.join(' ')); }
    },
    sock: {
      user: { id: 'bot@s.whatsapp.net' },
      signalRepository: {
        lidMapping: {
          getPNForLID: async (jid) => state.lidToPn.get(jid) || null
        }
      },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async () => {},
      sendMessage: async (jid, payload) => { state.sends.push({ jid, payload }); }
    },
    sendWhatsAppWithDiagnostics: async (socket, jid, payload, sendPath, messageId, responseOwner, redactText) => {
      state.redactedText = Boolean(redactText);
      return socket.sendMessage(jid, payload);
    },
    supabase: {
      from(table) {
        const query = {
          select() { return query; },
          update(values) { query.updateValues = values; return query; },
          insert() { return query; },
          eq() { return query; },
          order() { return query; },
          limit() { return query; },
          single: async () => ({ data: currentUser, error: null }),
          maybeSingle: async () => ({ data: currentUser, error: null }),
          then(resolve, reject) {
            if (table === 'users' && query.updateValues) {
              Object.assign(currentUser, query.updateValues);
            }
            const data = table === 'conversation_logs' ? [] : null;
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          }
        };
        return query;
      }
    },
    binaryTreeService: {
      portalUrl: 'https://crm.example.com/tree',
      matchesMemberIdentity: async ({ phoneNumber, name }) => {
        state.crmLookupPhone = phoneNumber;
        state.crmLookupName = name;
        if (treeLookupError) throw treeLookupError;
        return memberships.some(member =>
          member.name.toLowerCase() === name.toLowerCase() && phoneNumber === '15551230000'
        );
      },
      getMemberNetwork: async ({ phoneNumber }) => {
        state.crmLookupPhone = phoneNumber;
        if (treeLookupError) throw treeLookupError;
        return {
          portalUrl: 'https://crm.example.com/tree',
          memberships,
          memberFound: memberships.length > 0,
          credentials: memberships.length === 1 ? credentials : null,
          downline: {
            leftActiveCount: 0,
            rightActiveCount: 0,
            totalActiveCount: 0,
            matchedPairs: 0,
            tree: [],
            truncated: false
          }
        };
      }
    },
    syncCustomerToSheet: async () => {},
    delay: async () => {},
    sendPaymentDetails: async () => {},
    handleSalesStateFlow: async () => false,
    getLeadNotes: (user) => JSON.parse(user?.lead_notes || '{}'),
    inferGender: () => 'neutral',
    getDynamicRoadmapDates: () => ({ d0: '', d1: '', d2: '' }),
    getFeatureFlags: () => ({ enabled: false, replyMode: 'off', dryRun: false }),
    autonomousRuntimeAdapter: { analyze: async () => ({}) },
    runWithReadOnlyFailureBoundary: async () => ({ ok: true }),
    ADMIN_PHONE: '15550000000',
    processedMessageIds: new Map(),
    inboundMessageIdEntryCount: new Map(),
    MESSAGE_DEDUP_TTL_MS: 10 * 60 * 1000,
    recentMessageHashes: new Map(),
    SAME_TEXT_DEDUP_TTL_MS: 8 * 1000,
    processingJids: state.processingJids,
    lastReconnectAt: 0,
    RECONNECT_REPLAY_GUARD_MS: 2 * 60 * 1000,
    completedMessageFingerprints: new Map(),
    AI_RESPONSE_DEDUP_TTL_MS: 10 * 60 * 1000,
    sentReplyKeys: new Map(),
    imageAckDedup: new Map(),
    IMAGE_ACK_DEDUP_TTL_MS: 60 * 1000,
    outboundSendDedup: new Map(),
    OUTBOUND_SAME_TEXT_DEDUP_TTL_MS: 5 * 1000,
    lastUnderstoodReplyAt: new Map(),
    SUPPRESS_FALLBACK_AFTER_UNDERSTOOD_MS: 60 * 1000,
    globalRecentEvents: new Map(),
    GLOBAL_EVENT_DEDUP_TTL_MS: 3 * 1000,
    pendingUpsertQueue: new Map(),
    generateAIResponse: async (...args) => {
      state.aiCalls += 1;
      state.aiContext = args[4];
      if (state.failFirstAI) {
        state.failFirstAI = false;
        throw new Error('simulated AI failure');
      }
      if (holdFirstAI) await holdFirstAI.promise;
      return { understood: true, confidence: 0.99, intent: 'test', reply: 'one reply' };
    }
  };

  vm.runInNewContext(serverSource.slice(helperStart, helperEnd), context);
  vm.runInNewContext(serverSource.slice(contactStart, contactEnd), context);
  const handler = vm.runInNewContext(`(${handlerSource})`, context);

  return { clock, context, currentUser, handler, state };
}

function textMessage({ jid = '15551230000@s.whatsapp.net', id, timestamp, text = 'weather details please' } = {}) {
  return {
    key: { remoteJid: jid, ...(id ? { id } : {}) },
    ...(timestamp == null ? {} : { messageTimestamp: timestamp }),
    message: { conversation: text }
  };
}

async function deliver(handler, message) {
  return handler({ messages: [message], type: 'notify' });
}

test('same WhatsApp message ID delivered twice generates one AI response and send', async () => {
  const harness = createHarness();
  const message = textMessage({ id: 'same-id', timestamp: 100 });

  await deliver(harness.handler, message);
  await deliver(harness.handler, message);

  assert.equal(harness.state.aiCalls, 1, harness.state.errors.join('\n'));
  assert.equal(harness.state.sends.length, 1);
});

test('image messages receive a WhatsApp-only acknowledgement without a verification claim', async () => {
  const harness = createHarness();
  const message = {
    key: { remoteJid: '15551230000@s.whatsapp.net', id: 'image-id' },
    message: { imageMessage: { mimetype: 'image/jpeg' } }
  };

  await deliver(harness.handler, message);

  assert.equal(harness.state.aiCalls, 0);
  assert.equal(harness.state.sends.length, 1);
  assert.match(harness.state.sends[0].payload.text, /Image mil gayi/);
  assert.doesNotMatch(harness.state.sends[0].payload.text, /verification|admin|approval/i);
});

test('binary-tree link request first asks for name and mobile without sending the link', async () => {
  const harness = createHarness();

  await deliver(harness.handler, textMessage({ id: 'login-id', text: 'Please send my binary tree link' }));

  assert.equal(harness.state.crmLookupPhone, undefined);
  assert.equal(harness.state.aiCalls, 0);
  assert.equal(harness.state.sends.length, 1);
  assert.match(harness.state.sends[0].payload.text, /naam aur.*mobile number/i);
  assert.doesNotMatch(harness.state.sends[0].payload.text, /https:\/\/crm\.example\.com\/tree/);
  assert.doesNotMatch(harness.state.sends[0].payload.text, /USR100|member-secret|Password:/);
  assert.equal(harness.state.redactedText, true);
});

test('greeting during pending tree verification reaches AI without repeating the identity prompt', async () => {
  const harness = createHarness({ currentStep: 11 });

  await deliver(harness.handler, textMessage({ id: 'tree-request-before-greeting', text: 'Please send my binary tree link' }));
  await deliver(harness.handler, textMessage({ id: 'greeting-during-verification', text: 'Hello' }));

  assert.equal(harness.state.aiCalls, 1);
  assert.equal(harness.state.sends.length, 2);
  assert.match(harness.state.sends[0].payload.text, /naam aur.*mobile number/i);
  assert.equal(harness.state.sends[1].payload.text, 'one reply');
  assert.equal(JSON.parse(harness.currentUser.lead_notes).tree_identity_pending, true);
});

test('binary-tree identity match returns the link but never credentials', async () => {
  const harness = createHarness();

  await deliver(harness.handler, textMessage({ id: 'tree-display-request', text: 'Mujhe mera Binary tree dikhaiye' }));
  await deliver(harness.handler, textMessage({ id: 'tree-identity', text: 'Test User 15551230000' }));

  assert.equal(harness.state.crmLookupPhone, '15551230000');
  assert.equal(harness.state.crmLookupName, 'Test User');
  assert.equal(harness.state.sends.length, 2);
  assert.match(harness.state.sends[0].payload.text, /naam aur.*mobile number/i);
  assert.match(harness.state.sends[1].payload.text, /https:\/\/crm\.example\.com\/tree/);
  assert.match(harness.state.sends[1].payload.text, /secure password-reset option/);
  assert.doesNotMatch(harness.state.sends[1].payload.text, /USR100|member-secret|Password:/);
});

test('binary-tree non-match returns the shared link without claiming payment grants live access', async () => {
  const harness = createHarness({ accountActive: false, memberships: [] });

  await deliver(harness.handler, textMessage({ id: 'tree-display', text: 'Mujhe mera Binary tree dikhaiye' }));
  await deliver(harness.handler, textMessage({ id: 'tree-identity', text: 'Other Person 15551230000' }));

  assert.equal(harness.state.aiCalls, 0);
  assert.equal(harness.state.sends.length, 2);
  assert.match(harness.state.sends[1].payload.text, /https:\/\/crm\.example\.com\/tree/);
  assert.match(harness.state.sends[1].payload.text, /secure password-reset option/);
  assert.doesNotMatch(harness.state.sends[1].payload.text, /match nahi hui|admin verification/i);
});

test('a supplied number different from the sender is not queried against another member', async () => {
  const harness = createHarness();

  await deliver(harness.handler, textMessage({ id: 'tree-link-request', text: 'binary tree link please' }));
  await deliver(harness.handler, textMessage({ id: 'tree-other-phone', text: 'Test User 15559990000' }));

  assert.equal(harness.state.crmLookupPhone, undefined);
  assert.match(harness.state.sends[1].payload.text, /https:\/\/crm\.example\.com\/tree/);
  assert.match(harness.state.sends[1].payload.text, /secure password-reset option/);
  assert.doesNotMatch(harness.state.sends[1].payload.text, /match nahi hui|admin verification/i);
  assert.doesNotMatch(harness.state.sends[1].payload.text, /member-secret|USR100|Password:/);
});

test('identity lookup failure returns link and clearly reports the lookup issue', async () => {
  const harness = createHarness({ treeLookupError: new Error('CRM unavailable') });

  await deliver(harness.handler, textMessage({ id: 'tree-link-request', text: 'binary tree link please' }));
  await deliver(harness.handler, textMessage({ id: 'tree-link-identity', text: 'Test User 15551230000' }));

  assert.equal(harness.state.sends.length, 2);
  assert.match(harness.state.sends[1].payload.text, /https:\/\/crm\.example\.com\/tree/);
  assert.match(harness.state.sends[1].payload.text, /secure password-reset option/);
  assert.doesNotMatch(harness.state.sends[1].payload.text, /record check nahi paya|match nahi hui/i);
  assert.equal(harness.state.errors.some(error => error.includes('CRM unavailable')), true);
});

test('login help never discloses credentials', async () => {
  const harness = createHarness({ accountActive: false, memberships: [] });

  await deliver(harness.handler, textMessage({ id: 'login-help', text: 'I need my password' }));

  assert.equal(harness.state.sends.length, 1);
  assert.equal(harness.state.crmLookupPhone, undefined);
  assert.match(harness.state.sends[0].payload.text, /naam aur.*mobile number/i);
  assert.doesNotMatch(harness.state.sends[0].payload.text, /https:\/\/crm\.example\.com\/tree/);
  assert.doesNotMatch(harness.state.sends[0].payload.text, /member-secret|USR100|Password:/);
});

test('login request with supplied name and sender number gets link and secure reset guidance', async () => {
  const harness = createHarness();

  await deliver(harness.handler, textMessage({ id: 'login-identity', text: 'Please send login details. Test User 15551230000' }));

  assert.equal(harness.state.aiCalls, 0);
  assert.equal(harness.state.sends.length, 1);
  assert.match(harness.state.sends[0].payload.text, /https:\/\/crm\.example\.com\/tree/);
  assert.match(harness.state.sends[0].payload.text, /secure password-reset option/);
  assert.doesNotMatch(harness.state.sends[0].payload.text, /member-secret|USR100|Password:/);
});

test('PN and mapped LID deliveries converge and generate one AI response', async () => {
  const harness = createHarness();
  const pnJid = '15551230000@s.whatsapp.net';
  const lidJid = '15556665758991@lid';
  harness.state.lidToPn.set(lidJid, pnJid);

  await deliver(harness.handler, textMessage({ jid: lidJid, id: 'lid-id', timestamp: 100 }));
  await deliver(harness.handler, textMessage({ jid: pnJid, id: 'pn-id', timestamp: 200 }));

  assert.equal(harness.state.aiCalls, 1);
  assert.equal(harness.state.sends.length, 1);
});

test('different IDs and timestamps with same normalized text inside TTL are suppressed', async () => {
  const harness = createHarness();

  await deliver(harness.handler, textMessage({ id: 'first', timestamp: 100, text: '  HELLO   there ' }));
  await deliver(harness.handler, textMessage({ id: 'second', timestamp: 200, text: 'hello there' }));

  assert.equal(harness.state.aiCalls, 1);
  assert.equal(harness.state.sends.length, 1);
});

test('same text with new ID and timestamp after the same-text TTL is processed', async () => {
  const harness = createHarness();

  await deliver(harness.handler, textMessage({ id: 'first', timestamp: 100, text: 'hello' }));
  harness.clock.advance(harness.context.SAME_TEXT_DEDUP_TTL_MS + 1);
  await deliver(harness.handler, textMessage({ id: 'second', timestamp: 200, text: 'hello' }));

  assert.equal(harness.state.aiCalls, 2);
  assert.equal(harness.state.sends.length, 2);
});

test('concurrent duplicate acquires one lock; a rejected second message cannot release it', async () => {
  const aiGate = createDeferred();
  const aiStarted = createDeferred();
  const harness = createHarness({
    holdFirstAI: { promise: aiGate.promise },
  });
  harness.context.generateAIResponse = async () => {
    harness.state.aiCalls += 1;
    aiStarted.resolve();
    await aiGate.promise;
    return { understood: true, confidence: 0.99, intent: 'test', reply: 'one reply' };
  };

  const firstDelivery = deliver(harness.handler, textMessage({ id: 'parallel-id', timestamp: 100 }));
  await aiStarted.promise;
  const duplicateDelivery = deliver(harness.handler, textMessage({ id: 'parallel-id', timestamp: 100 }));
  await duplicateDelivery;

  assert.equal(harness.state.processingJids.size, 3);
  assert.equal(harness.state.lockDeletes, 0);
  aiGate.resolve();
  await firstDelivery;

  assert.equal(harness.state.lockAdds, 3);
  assert.equal(harness.state.lockDeletes, 3);
  assert.equal(harness.state.aiCalls, 1);
  assert.equal(harness.state.sends.length, 1);
});

test('failed processing rolls back message reservations and allows retry after the event replay window', async () => {
  const harness = createHarness({ failFirstAI: true });
  const message = textMessage({ id: 'retry-id', timestamp: 300 });

  await deliver(harness.handler, message);
  assert.equal(harness.state.processingJids.size, 0);
  assert.equal(harness.context.processedMessageIds.size, 0);
  assert.equal(harness.context.recentMessageHashes.size, 0);
  assert.equal(harness.context.completedMessageFingerprints.size, 0);

  harness.clock.advance(harness.context.GLOBAL_EVENT_DEDUP_TTL_MS + 1);
  await deliver(harness.handler, message);
  assert.equal(harness.state.aiCalls, 2);
  assert.equal(harness.state.sends.length, 1);
});

test('successful message replayed after reconnect with stable ID is ignored', async () => {
  const harness = createHarness();
  const message = textMessage({ id: 'replay-id', timestamp: 400 });
  await deliver(harness.handler, message);
  harness.context.lastReconnectAt = harness.clock.now() - 100;

  await deliver(harness.handler, textMessage({ id: 'replay-id', timestamp: 999 }));

  assert.equal(harness.state.aiCalls, 1);
  assert.equal(harness.state.sends.length, 1);
});

test('stable identity and original timestamp dedup rejects changed-ID replay', async () => {
  const harness = createHarness();

  await deliver(harness.handler, textMessage({ id: 'original-id', timestamp: 500 }));
  await deliver(harness.handler, textMessage({ id: 'changed-id', timestamp: 500 }));

  assert.equal(harness.state.aiCalls, 1);
  assert.equal(harness.state.sends.length, 1);
});

test('unresolved replay with no stable metadata is not inferred from text beyond same-text TTL', async () => {
  const harness = createHarness();
  const lidMessage = textMessage({ jid: '987654321@lid', id: 'unresolved-first', text: 'hello' });
  await deliver(harness.handler, lidMessage);
  harness.context.lastReconnectAt = harness.clock.now() - 100;
  harness.clock.advance(harness.context.SAME_TEXT_DEDUP_TTL_MS + 1);
  await deliver(harness.handler, textMessage({ jid: '987654321@lid', id: 'unresolved-second', text: 'hello' }));

  assert.equal(harness.state.aiCalls, 2);
  assert.equal(harness.state.sends.length, 2);
});