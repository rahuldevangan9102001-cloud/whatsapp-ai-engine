import { analyzeMessage } from './orchestrator.js';

const READ_ONLY_CAPABILITIES = Object.freeze({
  readsInjectedContext: true,
  writesEnabled: false,
  paymentActionsEnabled: false,
  outboundMessagingEnabled: false,
  databaseMutationEnabled: false,
  externalServiceExecutionEnabled: false
});

function normalizeUser(user = {}) {
  return {
    ...user,
    currentStep: user.currentStep ?? user.current_step,
    paymentStatus: user.paymentStatus ?? user.payment_status,
    isActive: user.isActive ?? user.is_active,
    isLocked: user.isLocked ?? user.is_locked
  };
}

function createSafeFailure(error) {
  return Object.freeze({
    ok: false,
    error: error instanceof Error ? error.message : 'read-only analysis failed',
    writesEnabled: false,
    outboundMessagingEnabled: false,
    paymentActionsEnabled: false
  });
}

export function createRuntimeAdapter({ analyzer = analyzeMessage } = {}) {
  if (typeof analyzer !== 'function') throw new TypeError('analyzer must be a function');

  return Object.freeze({
    capabilities: READ_ONLY_CAPABILITIES,
    async analyze({ text = '', user = {}, recentMessages = [], memories = [], agentState = null, knowledgeEntries = [] } = {}) {
      try {
        const result = await analyzer({
          text: String(text),
          user: normalizeUser(user),
          recentMessages: Array.isArray(recentMessages) ? recentMessages.map((message) => ({ ...message })) : [],
          memories: Array.isArray(memories) ? memories.map((memory) => ({ ...memory })) : [],
          agentState: agentState ? { ...agentState } : null,
          knowledgeEntries: Array.isArray(knowledgeEntries) ? knowledgeEntries.map((entry) => ({ ...entry })) : [],
          mode: 'shadow'
        });

        return Object.freeze({
          ok: true,
          result,
          ...READ_ONLY_CAPABILITIES
        });
      } catch (error) {
        return createSafeFailure(error);
      }
    }
  });
}

export const runtimeAdapter = createRuntimeAdapter();