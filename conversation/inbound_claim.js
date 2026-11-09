import { createHash } from 'node:crypto';

export async function claimInboundMessage(client, accountJid, messageId) {
    const account = String(accountJid || '').split('@')[0].split(':')[0].trim();
    const id = typeof messageId === 'string' ? messageId.trim() : '';
    if (!account || !id) {
        throw new Error('WhatsApp account and inbound message ID are required for durable deduplication');
    }

    const claimKey = createHash('sha256')
        .update(JSON.stringify([account, id]))
        .digest('hex');
    const { error } = await client.from('whatsapp_inbound_claims').insert({ claim_key: claimKey });
    if (!error) return true;
    if (error.code === '23505') return false;
    throw new Error(`Inbound message claim failed: ${error.message}`);
}
