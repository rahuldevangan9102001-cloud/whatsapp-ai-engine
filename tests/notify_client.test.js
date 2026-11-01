import test from 'node:test';
import assert from 'node:assert/strict';
import {
    notifyCrmEvent,
    sendCrmMessage,
    sendWelcomeGreeting,
    sendZoomReminder
} from '../notify.js';

test('CRM client helpers target the dedicated routes with event IDs', async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return {
            ok: true,
            status: 202,
            statusText: 'Accepted',
            json: async () => ({ ok: true, status: 'queued' })
        };
    };

    try {
        const options = { baseUrl: 'http://engine.test/', apiKey: 'test-key' };
        await sendCrmMessage({ eventId: 'message-1', phone: '15551234567', message: 'Hello' }, options);
        await sendWelcomeGreeting({ eventId: 'welcome-1', phone: '15551234567', name: 'Lead' }, options);
        await sendZoomReminder({ eventId: 'zoom-1', phone: '15551234567', name: 'Lead', stage: 'planShow' }, options);
        await notifyCrmEvent({ eventId: 'event-1', type: 'onboarding', phone: '15551234567' }, options);

        assert.deepEqual(calls.map(({ url }) => url), [
            'http://engine.test/crm/messages',
            'http://engine.test/crm/welcome',
            'http://engine.test/crm/zoom-reminders',
            'http://engine.test/crm/events'
        ]);
        assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
        assert.equal(JSON.parse(calls[2].options.body).stage, 'planShow');
        assert.equal(JSON.parse(calls[3].options.body).eventId, 'event-1');
    } finally {
        globalThis.fetch = originalFetch;
    }
});
