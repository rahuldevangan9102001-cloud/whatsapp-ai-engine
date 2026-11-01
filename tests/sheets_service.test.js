import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheetsService } from '../sheets_service.js';

test('syncCustomer posts the customer columns and optional bearer token', async () => {
  let request;
  const service = createSheetsService({
    webhookUrl: 'https://example.test/sheets',
    webhookToken: 'test-token',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    }
  });

  const result = await service.syncCustomer({
    name: 'WhatsApp Name',
    phone_number: '15551230000',
    current_step: 4,
    lead_status: 'New',
    lead_notes: JSON.stringify({ name: 'Asha', city_state: 'Pune' })
  });

  assert.equal(request.url, 'https://example.test/sheets');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(request.options.body), {
    'Name': 'Asha',
    'Mobile No': '15551230000',
    'City': 'Pune',
    'Current Step': 4,
    'Status': 'New'
  });
  assert.equal(result.synced, true);
});

test('syncCustomer is a no-op when webhook integration is not configured', async () => {
  const service = createSheetsService({ webhookUrl: '' });

  assert.deepEqual(await service.syncCustomer({ phone_number: '15551230000' }), {
    synced: false,
    reason: 'not_configured'
  });
});

test('syncCustomer reports webhook errors to the caller', async () => {
  const service = createSheetsService({
    webhookUrl: 'https://example.test/sheets',
    fetchImpl: async () => ({ ok: false, status: 503 })
  });

  await assert.rejects(
    service.syncCustomer({ phone_number: '15551230000' }),
    /HTTP 503/
  );
});