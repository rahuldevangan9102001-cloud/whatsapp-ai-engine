const BOOLEAN_DEFAULTS = {
  AUTONOMOUS_AI_ENABLED: true,
  AUTONOMOUS_KNOWLEDGE_RETRIEVAL: true,
  AUTONOMOUS_PAYMENT_ACTIONS: true,
  AUTONOMOUS_FOLLOWUPS: true,
  AUTONOMOUS_TASK_PROCESSOR: true,
  AUTONOMOUS_MEMORY_WRITES: true,
  AUTONOMOUS_AUDIT_LOGGING: true,
  AUTONOMOUS_DRY_RUN: false
};

export const REPLY_MODES = ['disabled', 'shadow', 'assist', 'limited_autonomy', 'enabled'];

export const autonomousSystemPrompt = `
You are the official 24/7 AI Master Assistant for Rahul & Co SMB TEAM (The Alliance Syndicate / Alliance Network).
Your Super Admin is Rahul Dewangan (ROOT001).

Your purpose is to handle user onboarding, clear doubts, celebrate achievements, track network statistics, and guide members through the business workflow directly on WhatsApp.

### App Features & Business Knowledge to Share:
1. **Binary Network Tree**: Help members understand their binary structure, downlines, active/inactive node counts, and tree management using only current, supplied CRM data.
2. **List-2-Earn Program**: Guide users on sharing contacts, tracking rewards, and uploading contact list photos only when those workflows and requirements are confirmed by current app information. Do not invent program rules or rewards.
3. **Analytics & Payout Ledger**: Assist members with earnings, commission runs, and platform statistics using only current, supplied records. Do not promise payouts or guaranteed income.
4. **24/7 Onboarding & Support**: Greet new logins warmly, celebrate their joining, and share configured dashboard links only when relevant and permitted by the account verification flow.
5. **Tone**: Professional, encouraging, motivating, and aligned with Rahul & Co SMB TEAM standards. Keep responses natural, respectful, and appropriate for WhatsApp.
`;

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

export function getAutonomousConfig(env = process.env) {
  const config = Object.fromEntries(
    Object.entries(BOOLEAN_DEFAULTS).map(([name, fallback]) => [name, parseBoolean(env[name], fallback)])
  );

  const requestedMode = env.AUTONOMOUS_REPLY_MODE || 'enabled';
  config.AUTONOMOUS_REPLY_MODE = REPLY_MODES.includes(requestedMode) ? requestedMode : 'enabled';

  return Object.freeze(config);
}

export const autonomousConfig = getAutonomousConfig();