// Sends a WhatsApp message through the engine's POST /notify endpoint (server.js).
// Env: WHATSAPP_SERVER_URL (default http://127.0.0.1:3000), NOTIFY_API_KEY (required).
export async function notify(phone, message, { baseUrl, apiKey, timeoutMs = 15000 } = {}) {
    const url = `${(baseUrl || process.env.WHATSAPP_SERVER_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '')}/notify`;
    const key = apiKey || process.env.NOTIFY_API_KEY;
    if (!key) throw new Error('NOTIFY_API_KEY is not configured');

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ phone: String(phone), message }),
        signal: AbortSignal.timeout(timeoutMs)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(`notify failed (${response.status}): ${body.error || response.statusText}`);
    }
    return body;
}

async function postCrmEvent(endpoint, payload, { baseUrl, apiKey, timeoutMs = 15000 } = {}) {
    const url = `${(baseUrl || process.env.WHATSAPP_SERVER_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '')}${endpoint}`;
    const key = apiKey || process.env.NOTIFY_API_KEY;
    if (!key) throw new Error('NOTIFY_API_KEY is not configured');

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(`CRM WhatsApp request failed (${response.status}): ${body.error || response.statusText}`);
    }
    return body;
}

export function notifyCrmEvent(event, options = {}) {
    return postCrmEvent('/crm/events', event, options);
}

export function sendWelcomeGreeting({ eventId, phone, name }, options = {}) {
    return postCrmEvent('/crm/welcome', { eventId, phone, name }, options);
}

export function sendZoomReminder({ eventId, phone, name, stage }, options = {}) {
    return postCrmEvent('/crm/zoom-reminders', { eventId, phone, name, stage }, options);
}

export function sendCrmMessage({ eventId, phone, message }, options = {}) {
    return postCrmEvent('/crm/messages', { eventId, phone, message }, options);
}
