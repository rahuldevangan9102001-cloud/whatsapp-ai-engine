export const SMART_FALLBACK_REPLY =
    'Main aapki baat samajh nahi paaya bhai, thoda aur clearly bataoge?';

export function createFallbackAIResponse(intent = 'unknown', confidence = 0) {
    return {
        understood: false,
        confidence,
        intent,
        needsClarification: true,
        reply: SMART_FALLBACK_REPLY,
        quickReplies: []
    };
}
