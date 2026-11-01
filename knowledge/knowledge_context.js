export function buildKnowledgeContext(entries = [], maxEntries = 5) {
  return entries.slice(0, maxEntries).map((entry) => ({
    topic: entry.topic || null,
    content: entry.content || null,
    source: entry.source || 'knowledge_base'
  }));
}