import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCrmNotification, normalizeRecipientPhone } from '../crm_notifications.js';

test('builds a CRM message notification for a normalized phone number', () => {
    assert.deepEqual(buildCrmNotification({
        type: 'message',
        phone: '+1 (555) 123-4567',
        message: '  Welcome  '
    }, '15550000000'), {
        eventType: 'message',
        targets: [{ phone: '15551234567', message: 'Welcome' }]
    });
});

test('builds configured Zoom messages and rejects placeholder links', () => {
    const zoom = buildCrmNotification({
        type: 'zoom',
        stage: 'planShow',
        phone: '15551234567',
        name: 'A Lead'
    }, '15550000000', {
        planShow: {
            link: 'https://zoom.us/j/123',
            time: '06:00 PM',
            description: 'Plan presentation'
        }
    });
    assert.deepEqual(zoom, {
        eventType: 'zoom',
        targets: [{
            phone: '15551234567',
            message: 'Namaste A Lead! Plan presentation\nTime: 06:00 PM\nZoom link: https://zoom.us/j/123'
        }]
    });
    const reminder = buildCrmNotification({
        type: 'zoom_reminder',
        stage: 'planShow',
        phone: '15551234567',
        name: 'A Lead'
    }, '15550000000', {
        planShow: {
            link: 'https://zoom.us/j/123',
            time: '06:00 PM',
            description: 'Plan presentation'
        }
    });
    assert.match(reminder.targets[0].message, /^Namaste A Lead! 😊 Reminder:/);
    assert.match(reminder.targets[0].message, /https:\/\/zoom\.us\/j\/123/);
    assert.throws(
        () => buildCrmNotification({ type: 'zoom', stage: 'planShow', phone: '15551234567' }, '15550000000'),
        /not configured/
    );
    assert.throws(
        () => buildCrmNotification({ type: 'zoom', stage: 'unknown', phone: '15551234567' }, '15550000000'),
        /unknown Zoom stage/
    );
});

test('builds a welcome greeting for a new CRM contact', () => {
    const welcome = buildCrmNotification({
        type: 'welcome',
        phone: '+1 (555) 123-4567',
        name: 'A Lead'
    }, '15550000000');
    assert.equal(welcome.eventType, 'welcome');
    assert.equal(welcome.targets[0].phone, '15551234567');
    assert.match(welcome.targets[0].message, /Namaste A Lead!.*aapka swagat hai/);
});

test('routes onboarding alerts to the configured admin and validates recipients', () => {
    assert.deepEqual(buildCrmNotification({
        type: 'onboarding',
        name: 'A Lead',
        phone: '15551234567'
    }, '+1 555 000 0000'), {
        eventType: 'onboarding',
        targets: [{ phone: '15550000000', message: 'New CRM onboarding: A Lead (+15551234567)' }]
    });
    assert.throws(() => normalizeRecipientPhone('not a phone'), /between 8 and 15 digits/);
});

test('rejects malformed or unsupported CRM notifications', () => {
    assert.throws(() => buildCrmNotification(null, '15550000000'), /event must be an object/);
    assert.throws(() => buildCrmNotification({ type: 'message', phone: '15551234567', message: ' ' }, '15550000000'), /non-empty message/);
    assert.throws(() => buildCrmNotification({ type: 'other' }, '15550000000'), /type must be one of/);
});
