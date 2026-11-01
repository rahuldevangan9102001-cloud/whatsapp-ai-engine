export function createAuditEvent({ userId = null, actionType, decision, policyResult = 'not_executed', executionResult = 'not_executed', actorType = 'ai', correlationId = null, inputSnapshot = null }) {
  return Object.freeze({
    userId,
    actionType,
    inputSnapshot,
    decision,
    policyResult,
    executionResult,
    actorType,
    correlationId,
    createdAt: new Date().toISOString()
  });
}

export function createDisabledAuditService() {
  return Object.freeze({
    enabled: false,
    record: async () => ({ recorded: false, reason: 'autonomous audit logging is disabled' })
  });
}