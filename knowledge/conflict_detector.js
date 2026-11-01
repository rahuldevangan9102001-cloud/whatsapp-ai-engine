export function detectKnowledgeConflicts(entries = []) {
  const grouped = new Map();
  for (const entry of entries) {
    const topic = String(entry.topic || 'unknown').toLowerCase();
    const content = String(entry.content || '').trim();
    if (!grouped.has(topic)) grouped.set(topic, new Set());
    grouped.get(topic).add(content);
  }
  return [...grouped.entries()]
    .filter(([, contents]) => contents.size > 1)
    .map(([topic, contents]) => ({ topic, values: [...contents] }));
}