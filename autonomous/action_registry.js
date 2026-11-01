export const SHADOW_ACTIONS = Object.freeze([
  'classify_intent',
  'resolve_stage',
  'retrieve_knowledge',
  'suggest_reply',
  'suggest_human_review',
  'suggest_followup'
]);

export function createActionSuggestion(actionType, payload = {}, policyResult = null) {
  return Object.freeze({ actionType, payload: { ...payload }, policyResult, executed: false });
}