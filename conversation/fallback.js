export const SMART_FALLBACK_REPLY =
    'Main aapki is baat ko poori tarah samajh nahi paaya. Kya aap apna Naam aur Mobile Number bata sakte hain taaki main aapka binary tree aur account status check kar sakoon?';

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
