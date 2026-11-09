import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { claimInboundMessage } from '../conversation/inbound_claim.js';

function clientWithStore(store, error = null) {
  return {
    from(table) {
      assert.equal(table, 'whatsapp_inbound_claims');
      return {
        async insert(row) {
          if (error) return { error };
          if (store.has(row.claim_key)) return { error: { code: '23505', message: 'duplicate' } };
          store.add(row.claim_key);
          return { error: null };
        }
      };
    }
  };
}

test('atomic claims distinguish accounts and message IDs but normalize device JIDs', async () => {
  const claims = new Set();
  const client = clientWithStore(claims);
  const results = await Promise.all([
    claimInboundMessage(client, '123:1@s.whatsapp.net', 'msg-1'),
    claimInboundMessage(client, '123:2@s.whatsapp.net', 'msg-1')
  ]);
  assert.deepEqual(results, [true, false]);
  assert.equal(await claimInboundMessage(client, '123@s.whatsapp.net', 'msg-2'), true);
  assert.equal(await claimInboundMessage(client, '456@s.whatsapp.net', 'msg-1'), true);
  assert.equal(claims.size, 3);
  for (const key of claims) assert.match(key, /^[a-f0-9]{64}$/);
});

test('claim failure and invalid identity are explicit', async () => {
  const client = clientWithStore(new Set(), { code: 'PGRST205', message: 'missing table' });
  await assert.rejects(claimInboundMessage(client, '123@s.whatsapp.net', 'msg'), /missing table/);
  await assert.rejects(claimInboundMessage(client, '', 'msg'), /account and inbound message ID/);
  await assert.rejects(claimInboundMessage(client, '123@s.whatsapp.net', ''), /account and inbound message ID/);
});

test('migration adds a permanent service-role-only unique claim table', () => {
  const sql = fs.readFileSync(new URL('../database/migrations/006_whatsapp_inbound_claims.sql', import.meta.url), 'utf8');
  assert.match(sql, /claim_key text PRIMARY KEY/i);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /REVOKE ALL.*anon, authenticated/i);
  assert.match(sql, /GRANT INSERT.*service_role/i);
  assert.match(sql, /NOTIFY pgrst/i);
});
