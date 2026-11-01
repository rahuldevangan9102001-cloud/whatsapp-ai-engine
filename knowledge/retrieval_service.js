export function createReadOnlyRetrievalService({ query = async () => [] } = {}) {
  return Object.freeze({
    async retrieve({ topic = null, text = '', limit = 5 } = {}) {
      const rows = await query({ topic, text: String(text), limit: Math.max(1, Number(limit) || 5) });
      return Array.isArray(rows) ? rows.slice(0, limit).map((row) => ({ ...row })) : [];
    },
    writesEnabled: false
  });
}