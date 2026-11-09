const IST_OFFSET_MS = 330 * 60 * 1000;
const STOP_WORDS = new Set([
    'about', 'aur', 'batao', 'bheja', 'bhejo', 'hai', 'have', 'hoon', 'hume',
    'kaise', 'kahan', 'kya', 'mujhe', 'mera', 'mere', 'meri', 'mein', 'nahi',
    'please', 'sent', 'that', 'the', 'this', 'tumne', 'tum', 'was', 'your',
    'लिंक', 'भेजा', 'मुझे', 'मेरा', 'मेरी', 'क्या', 'था', 'थी', 'आपने'
]);

function dayRange(year, month, day) {
    const utc = Date.UTC(year, month - 1, day);
    const date = new Date(utc);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    const start = utc - IST_OFFSET_MS;
    return { start: new Date(start).toISOString(), end: new Date(start + 86400000).toISOString() };
}

export function getMentionedDay(text, now = new Date()) {
    const value = String(text || '').toLowerCase();
    const iso = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (iso) return dayRange(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const localDate = value.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
    if (localDate) return dayRange(Number(localDate[3]), Number(localDate[2]), Number(localDate[1]));

    const localNow = new Date(now.getTime() + IST_OFFSET_MS);
    let daysAgo = null;
    if (/\bday before yesterday\b/i.test(value)) daysAgo = 2;
    else if (/\byesterday\b|बीते कल/i.test(value)) daysAgo = 1;
    else if (/\b(?:kal|parso|parson)\b|कल|परसों/i.test(value) &&
        /\b(?:tha|thi|the|thaa|bheja|bheji|bataya|pichle|last|ago)\b|था|थी|थे|भेजा|बताया/i.test(value)) {
        daysAgo = /\b(?:parso|parson)\b|परसों/i.test(value) ? 2 : 1;
    } else if (/\b(?:tha|thi|the|bheja|bheji|bataya|last|previous|ago)\b|था|थी|थे|भेजा|बताया/i.test(value)) {
        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const mentioned = weekdays.findIndex(day => new RegExp(`\\b${day}\\b`, 'i').test(value));
        if (mentioned >= 0) daysAgo = (localNow.getUTCDay() - mentioned + 7) % 7 || 7;
    }
    if (daysAgo === null) return null;
    localNow.setUTCDate(localNow.getUTCDate() - daysAgo);
    return dayRange(localNow.getUTCFullYear(), localNow.getUTCMonth() + 1, localNow.getUTCDate());
}

export function getMemorySearchTerms(text) {
    const value = String(text || '').toLowerCase();
    const terms = [];
    if (/\b(?:link|url|website|portal)\b|लिंक|पोर्टल/i.test(value)) terms.push('http');
    const words = value.match(/[\p{L}\p{N}]+/gu) || [];
    for (const word of words) {
        if (word.length >= 4 && !STOP_WORDS.has(word) && !terms.includes(word)) terms.push(word);
        if (terms.length === 3) break;
    }
    return terms;
}

export async function fetchRelevantEpisodes(client, userId, text, now = new Date()) {
    if (!userId) throw new TypeError('userId is required for episodic memory');
    const day = getMentionedDay(text, now);
    const searches = getMemorySearchTerms(text).map(term => ({ term }));
    if (day) searches.unshift({ day });
    const results = await Promise.all(searches.map(async search => {
        let query = client.from('conversation_logs')
            .select('role, message_text, created_at')
            .eq('user_id', userId);
        if (search.day) query = query.gte('created_at', search.day.start).lt('created_at', search.day.end);
        else query = query.ilike('message_text', `%${search.term}%`);
        const { data, error } = await query.order('created_at', { ascending: false }).limit(8);
        if (error) throw new Error(`Episodic memory query failed: ${error.message}`);
        return data || [];
    }));
    const unique = new Map();
    for (const entry of results.flat()) {
        const key = JSON.stringify([entry.role, entry.message_text, entry.created_at]);
        unique.set(key, entry);
    }
    return [...unique.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

export function formatEpisodes(episodes) {
    return episodes.map(entry => {
        const when = formatMemoryTime(entry.created_at);
        const role = entry.role === 'assistant' || entry.role === 'model' ? 'Assistant' : 'User';
        return `[${when}] ${role}: ${entry.message_text}`;
    }).join('\n');
}

export function formatMemoryTime(value) {
    const timestamp = value ? new Date(value) : new Date(NaN);
    if (!Number.isFinite(timestamp.getTime())) return 'time unknown';
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short'
    });
    return `${formatter.format(timestamp)} IST`;
}

export function isFinancialProblemMessage(text) {
    const value = String(text || '');
    if (/\b(?:account|status|balance|profile|registered|downline)\b|खाता|अकाउंट|स्टेटस|बैलेंस/i.test(value)) return false;
    const money = /\b(?:paisa|paise|paison|pese|income|earning|money|cash|debt|loan|salary|kamai|payment|pay)\b|पैस[ेोंा]*|कमाई|आमदनी|कर्ज|ऋण|सैलरी|भुगतान/i.test(value);
    const need = /\b(?:chahiye|chahie|zarurat|jarurat|zaroorat|nahi|nahin|need|needs|needed|short|struggling|problem|problems|dikkat|tangi|kam|less|lost|unable|cannot)\b|चाहिए|जरूरत|ज़रूरत|नहीं|दिक्कत|परेशान|कमी|समस्या/i.test(value);
    return money && need;
}
