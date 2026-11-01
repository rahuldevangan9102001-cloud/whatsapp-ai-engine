import { getAutonomousConfig } from '../config/autonomous_config.js';

export function getFeatureFlags(env = process.env) {
  const config = getAutonomousConfig(env);

  return Object.freeze({
    enabled: config.AUTONOMOUS_AI_ENABLED,
    replyMode: config.AUTONOMOUS_REPLY_MODE,
    knowledgeRetrieval: config.AUTONOMOUS_KNOWLEDGE_RETRIEVAL,
    paymentActions: config.AUTONOMOUS_PAYMENT_ACTIONS,
    followups: config.AUTONOMOUS_FOLLOWUPS,
    taskProcessor: config.AUTONOMOUS_TASK_PROCESSOR,
    memoryWrites: config.AUTONOMOUS_MEMORY_WRITES,
    auditLogging: config.AUTONOMOUS_AUDIT_LOGGING,
    dryRun: config.AUTONOMOUS_DRY_RUN
  });
}

export function isAutonomousRuntimeEnabled(env = process.env) {
  const flags = getFeatureFlags(env);
  return flags.enabled && flags.replyMode !== 'disabled';
}

export function areAutonomousActionsDisabled(env = process.env) {
  const flags = getFeatureFlags(env);
  return !flags.enabled || flags.replyMode === 'disabled' || flags.paymentActions === false || flags.taskProcessor === false;
}