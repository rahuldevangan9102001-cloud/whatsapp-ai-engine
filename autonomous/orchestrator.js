import { buildCustomerContext } from './context_builder.js';
import { classifyIntent } from './intent_classifier.js';
import { resolveStage } from './stage_resolver.js';
import { safeConfidence } from './confidence.js';
import { evaluateAction } from './policy_engine.js';
import { createActionSuggestion } from './action_registry.js';
import { createMemoryReader } from './memory_reader.js';
import { buildKnowledgeContext } from '../knowledge/knowledge_context.js';
import { detectKnowledgeConflicts } from '../knowledge/conflict_detector.js';

export async function analyzeMessage({ text = '', user = null, recentMessages = [], memories = [], agentState = null, knowledgeEntries = [], mode = 'shadow', retrievalService = null } = {}) {
  const memoryReader = createMemoryReader({ memories, agentState });
  const context = buildCustomerContext({ user, recentMessages, memory: memoryReader.readMemories() });
  const intent = classifyIntent(text);
  const stage = resolveStage(user || {});

  let effectiveKnowledgeEntries = knowledgeEntries;

  if (retrievalService && typeof retrievalService.retrieve === 'function') {
    try {
      const retrieved = await retrievalService.retrieve({ text, topic: null, limit: 5 });
      if (Array.isArray(retrieved) && retrieved.length > 0) {
        effectiveKnowledgeEntries = retrieved;
      }
    } catch (error) {
      effectiveKnowledgeEntries = knowledgeEntries;
    }
  }

  const knowledge = buildKnowledgeContext(effectiveKnowledgeEntries);
  const conflicts = detectKnowledgeConflicts(effectiveKnowledgeEntries);
  const actions = ['classify_intent', 'resolve_stage', 'retrieve_knowledge'].map((actionType) =>
    createActionSuggestion(actionType, {}, evaluateAction(actionType, { mode, dryRun: true }))
  );

  return Object.freeze({
    context,
    intent: { ...intent, confidence: safeConfidence(intent.confidence) },
    stage,
    knowledge,
    conflicts,
    actions,
    writesEnabled: false,
    outboundMessagingEnabled: false,
    paymentActionsEnabled: false
  });
}