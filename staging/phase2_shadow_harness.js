import { analyzeMessage } from '../autonomous/orchestrator.js';
import { createRuntimeAdapter } from '../autonomous/runtime_adapter.js';
import { runWithReadOnlyFailureBoundary } from '../autonomous/orchestrator_failure_boundary.js';

const STAGING_SHADOW_CONFIG = Object.freeze({
  mode: 'isolated-staging-shadow',
  enabled: true,
  replyMode: 'shadow',
  dryRun: true,
  knowledgeRetrieval: false,
  paymentActions: false,
  followups: false,
  taskProcessor: false,
  memoryWrites: false,
  auditLogging: false
});

const READ_ONLY_CAPABILITIES = Object.freeze({
  writesEnabled: false,
  outboundMessagingEnabled: false,
  paymentActionsEnabled: false,
  databaseMutationEnabled: false,
  externalServiceExecutionEnabled: false
});

export async function runPhase2ShadowHarness({
  text = '',
  user = {},
  recentMessages = [],
  memories = [],
  knowledgeEntries = []
} = {}) {
  const adapter = createRuntimeAdapter({ analyzer: analyzeMessage });
  const result = await runWithReadOnlyFailureBoundary(
    (context) => adapter.analyze(context),
    {
      text,
      user,
      recentMessages,
      memories,
      knowledgeEntries
    }
  );

  return Object.freeze({
    ...result,
    flags: STAGING_SHADOW_CONFIG,
    ...READ_ONLY_CAPABILITIES,
    analysis: result.result || null
  });
}

export { READ_ONLY_CAPABILITIES, STAGING_SHADOW_CONFIG };