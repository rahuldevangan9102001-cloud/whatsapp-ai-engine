const INTENTS = Object.freeze([
  'greeting',
  'information_request',
  'price_question',
  'earning_question',
  'objection',
  'payment_intent',
  'payment_submitted',
  'payment_status',
  'referral_question',
  'activation_question',
  'support_request',
  'complaint',
  'human_request',
  'opt_out',
  'unknown'
]);

const PATTERNS = [
  ['opt_out', /\b(stop|unsubscribe|opt.?out|do not message|dont message)\b|message mat karo/i],
  ['human_request', /\b(human|agent|admin|person|insaan)\b|admin se baat/i],
  ['payment_submitted', /\b(utr|transaction id|screenshot|payment done|paid)\b|payment kar diya/i],
  ['payment_status', /payment.*(status|verify)|verify.*payment|approve hua/i],
  ['payment_intent', /\b(pay|payment|upi|qr|token|amount|price|cost)\b|paise dene/i],
  ['referral_question', /\b(referral|refer|sponsor|link)\b/i],
  ['activation_question', /\b(login|activate|activation|credential|id kab)\b/i],
  ['complaint', /\b(complaint|fraud|fake|scam|cheat|refund)\b|shikayat/i],
  ['objection', /\b(doubt|confused|problem|not interested|nahi karna|time nahi)\b/i],
  ['earning_question', /\b(earn|earning|income|payout|profit|kamai)\b/i],
  ['price_question', /\b(price|cost|kitna|amount|fees|fee)\b/i],
  ['greeting', /^(hi|hello|hey|hii|namaste|good morning|good evening)[!. ]*$/i],
  ['support_request', /\b(help|support|problem|issue|madad)\b/i],
  ['information_request', /\b(what|how|kaise|kya|batao|explain|samjhao)\b/i]
];

export function classifyIntent(text = '') {
  const normalizedText = String(text).trim();
  const match = PATTERNS.find(([, pattern]) => pattern.test(normalizedText));
  if (!match) return { intent: 'unknown', confidence: 0.2, matched: false };
  return { intent: match[0], confidence: 0.85, matched: true };
}

export { INTENTS };