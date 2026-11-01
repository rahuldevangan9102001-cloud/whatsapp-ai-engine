import { ZOOM_LINKS } from './config/config.js';

export function normalizeRecipientPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
        throw new Error('phone must contain between 8 and 15 digits');
    }
    return digits;
}

export function buildCrmNotification(event, adminPhone, zoomLinks = ZOOM_LINKS) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
        throw new Error('event must be an object');
    }

    if (event.type === 'message') {
        if (typeof event.message !== 'string' || !event.message.trim()) {
            throw new Error('message events require a non-empty message');
        }
        return {
            eventType: event.type,
            targets: [{
                phone: normalizeRecipientPhone(event.phone),
                message: event.message.trim()
            }]
        };
    }

    if (event.type === 'welcome') {
        const name = typeof event.name === 'string' && event.name.trim()
            ? ` ${event.name.trim()}`
            : '';
        return {
            eventType: event.type,
            targets: [{
                phone: normalizeRecipientPhone(event.phone),
                message: `Namaste${name}! The Alliance Syndicate mein aapka swagat hai 😊 Main aapko onboarding ke har step mein madad karunga. Aap jab ready hon, apna koi bhi sawal pooch sakte hain.`
            }]
        };
    }

    if (event.type === 'zoom' || event.type === 'zoom_reminder') {
        const stage = event.stage;
        const session = zoomLinks[stage];
        if (!session) {
            throw new Error(`unknown Zoom stage: ${stage}`);
        }
        if (!/^https:\/\/[^ ]+$/i.test(session.link) || /_here\b/i.test(session.link)) {
            throw new Error(`Zoom link for stage "${stage}" is not configured`);
        }

        const name = typeof event.name === 'string' && event.name.trim()
            ? ` ${event.name.trim()}`
            : '';
        return {
            eventType: event.type,
            targets: [{
                phone: normalizeRecipientPhone(event.phone),
                message: event.type === 'zoom_reminder'
                    ? `Namaste${name}! 😊 Reminder: ${session.description}\nTime: ${session.time}\nZoom link: ${session.link}`
                    : `Namaste${name}! ${session.description}\nTime: ${session.time}\nZoom link: ${session.link}`
            }]
        };
    }

    if (event.type === 'onboarding') {
        const leadPhone = normalizeRecipientPhone(event.phone);
        const name = typeof event.name === 'string' && event.name.trim()
            ? event.name.trim()
            : 'New lead';
        return {
            eventType: event.type,
            targets: [{
                phone: normalizeRecipientPhone(adminPhone),
                message: `New CRM onboarding: ${name} (+${leadPhone})`
            }]
        };
    }

    throw new Error('type must be one of: message, welcome, zoom, zoom_reminder, onboarding');
}
