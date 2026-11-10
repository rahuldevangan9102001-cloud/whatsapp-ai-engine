export const SMART_FALLBACK_REPLY =
    'Aap thoda detail mein bata sakte hain ki kya check karna chahte hain?';

export function createFallbackAIResponse(intent = 'unknown', confidence = 0) {
    return {
        understood: false,
        confidence,
        intent,
        needsClarification: true,
        reply: intent === 'ai_error'
            ? 'Maafi chahunga, abhi service par thoda update chal raha hai. Kripya kuch der baad try karein.'
            : SMART_FALLBACK_REPLY,
        quickReplies: []
    };
}
