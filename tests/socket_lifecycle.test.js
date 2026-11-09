import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import vm from 'node:vm';
import { claimInboundMessage } from '../conversation/inbound_claim.js';
import { isFinancialProblemMessage } from '../conversation/episodic_memory.js';

const source = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');

function extract(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing source boundary: ${start}`);
  return source.slice(first, last);
}

function createHarness() {
  const sockets = [];
  const claims = new Set();
  const sends = [];
  const errors = [];
  const reconnects = [];
  const context = {
    console: { log() {}, error(...args) { errors.push(args.join(' ')); } },
    globalSock: null,
    whatsappConnected: false,
    whatsappSocketGeneration: 0,
    startBotInvocationCount: 0,
    messagesUpsertListenerRegistrations: 0,
    startInProgress: false,
    AUTH_SESSION_DIR: 'test',
    useMultiFileAuthState: async () => ({ state: {}, saveCreds() {} }),
    makeWASocket() {
      const sock = { ev: new EventEmitter(), user: { id: '123@s.whatsapp.net' } };
      sockets.push(sock);
      return sock;
    },
    pino: () => ({}),
    qrcode: { generate() {} },
    scheduleReconnect: reason => {
      if (!context.startInProgress) reconnects.push(reason);
    },
    pendingUpsertQueue: new Map(),
    pendingAccountDataRequests: new Map(),
    processedMessageIds: new Map(),
    cleanupMessageDedup() {},
    getImageMessage: message => message.imageMessage || null,
    claimInboundMessage: (client, account, id) => claimInboundMessage({
      from() {
        return {
          async insert({ claim_key: key }) {
            if (claims.has(key)) return { error: { code: '23505', message: 'duplicate' } };
            claims.add(key);
            return { error: null };
          }
        };
      }
    }, account, id),
    supabase: {
      from() {
        const query = {
          select() { return query; },
          eq() { return query; },
          maybeSingle: async () => ({ data: null, error: { message: 'test user lookup unavailable' } })
        };
        return query;
      }
    },
    BINARY_TREE_PORTAL_URL: 'https://example.com/tree',
    ADMIN_PHONE: '123',
    resolveRealPhone: async (sock, jid) => jid,
    extractContactDetails: () => ({ phone: '15551234567', pushName: 'Friend' }),
    isFinancialProblemMessage,
    getLeadNotes: () => ({}),
    inferPersonalDetails: () => ({}),
    inferGender: () => 'neutral',
    getConversationTiming: () => ({}),
    recordPortalConversation: async () => {},
    sendBulletproofSingleReply: async (sock, jid, text, id, owner) => {
      sends.push({ sock, jid, text, id, owner });
      return { key: { id } };
    },
    generateAIResponse: async () => ({ reply: 'AI reply' }),
    createFallbackAIResponse: () => ({ reply: 'fallback' })
  };
  vm.createContext(context);
  vm.runInContext(
    extract('function isBinaryTreePortalRequest(text) {', '\nfunction normalizeMessageText(text) {') +
    extract('async function startBot() {', '\nasync function shutdown(signal) {') +
    '\nthis.start = startBot;',
    context
  );
  const emit = async (sock, name, event) => {
    await Promise.all(sock.ev.listeners(name).map(listener => listener(event)));
  };
  const message = (id, jid, text = 'hello') => ({
    type: 'notify',
    messages: [{ key: { id, remoteJid: jid }, message: { conversation: text } }]
  });
  return { context, sockets, sends, errors, reconnects, emit, message };
}

test('repeated start registers one listener; close removes only its own listener', async () => {
  const h = createHarness();
  await Promise.all([h.context.start(), h.context.start()]);
  const first = h.sockets[0];
  assert.equal(h.sockets.length, 1);
  assert.equal(first.ev.listenerCount('messages.upsert'), 1);
  const otherListener = () => {};
  first.ev.on('messages.upsert', otherListener);
  await h.emit(first, 'connection.update', { connection: 'close' });
  assert.deepEqual(first.ev.listeners('messages.upsert'), [otherListener]);
  assert.equal(h.reconnects.length, 1);
  await h.context.start();
  assert.equal(h.sockets[1].ev.listenerCount('messages.upsert'), 1);
});

test('stale socket close and open cannot disturb the new active socket', async () => {
  const h = createHarness();
  await h.context.start();
  const first = h.sockets[0];
  await h.emit(first, 'connection.update', { connection: 'close' });
  await h.context.start();
  const second = h.sockets[1];
  await h.emit(second, 'connection.update', { connection: 'open' });
  await h.emit(first, 'connection.update', { connection: 'close' });
  assert.equal(h.context.globalSock, second);
  assert.equal(h.context.whatsappConnected, true);
  assert.equal(h.reconnects.length, 1);
  await h.emit(first, 'connection.update', { connection: 'open' });
  assert.equal(h.context.globalSock, second);
  assert.equal(second.ev.listenerCount('messages.upsert'), 1);
});

test('replayed and concurrent duplicate events produce only one reply across sockets', async () => {
  const h = createHarness();
  await h.context.start();
  const first = h.sockets[0];
  const event = h.message('id-1', 'user@s.whatsapp.net');
  await Promise.all([h.emit(first, 'messages.upsert', event), h.emit(first, 'messages.upsert', event)]);
  assert.equal(h.sends.length, 1);
  await h.emit(first, 'connection.update', { connection: 'close' });
  await h.context.start();
  await Promise.all([
    h.emit(first, 'messages.upsert', event),
    h.emit(h.sockets[1], 'messages.upsert', event)
  ]);
  assert.equal(h.sends.length, 1);
});

test('different users process simultaneously and distinct messages are not suppressed', async () => {
  const h = createHarness();
  await h.context.start();
  const sock = h.sockets[0];
  let entered = 0;
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  h.context.generateAIResponse = async () => {
    entered += 1;
    if (entered === 2) release();
    await barrier;
    return { reply: 'AI reply' };
  };
  let timeout;
  try {
    await Promise.race([
      Promise.all([
        h.emit(sock, 'messages.upsert', h.message('id-a', 'a@s.whatsapp.net')),
        h.emit(sock, 'messages.upsert', h.message('id-b', 'b@s.whatsapp.net'))
      ]),
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('users did not run independently')), 1000);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
  assert.equal(h.sends.length, 2);
  await h.emit(sock, 'messages.upsert', h.message('id-c', 'a@s.whatsapp.net'));
  assert.equal(h.sends.length, 3);
  assert.deepEqual(h.sends.map(send => send.id).sort(), ['id-a', 'id-b', 'id-c']);
});

test('startup failure schedules reconnect without registering on an undefined socket', async () => {
  const h = createHarness();
  h.context.useMultiFileAuthState = async () => { throw new Error('auth unavailable'); };
  await h.context.start();
  assert.equal(h.sockets.length, 0);
  assert.equal(h.context.startInProgress, false);
  assert.equal(h.reconnects.length, 1);
  assert.ok(h.errors.some(error => error.includes('auth unavailable')));
});

test('socket closing during startup is not left with a message listener', async () => {
  const h = createHarness();
  const makeSocket = h.context.makeWASocket;
  h.context.makeWASocket = options => {
    const sock = makeSocket(options);
    const on = sock.ev.on.bind(sock.ev);
    sock.ev.on = (event, listener) => {
      const result = on(event, listener);
      if (event === 'connection.update') listener({ connection: 'close' });
      return result;
    };
    return sock;
  };
  await h.context.start();
  assert.equal(h.sockets[0].ev.listenerCount('messages.upsert'), 0);
  assert.equal(h.context.globalSock, null);
  assert.equal(h.reconnects.length, 1);
});
