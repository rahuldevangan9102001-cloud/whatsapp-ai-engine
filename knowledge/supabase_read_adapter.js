const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const KNOWLEDGE_FIELDS = 'id,topic,content,embedding,source,version,approved,is_active';

function normalizeLimit(limit) {
  const numericLimit = Number(limit);
  if (!Number.isFinite(numericLimit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(numericLimit)));
}

function sanitizeRow(row = {}) {
  return {
    id: row.id ?? null,
    topic: row.topic ?? null,
    content: row.content ?? null,
    embedding: row.embedding ?? null,
    source: row.source ?? null,
    version: row.version ?? null,
    approved: row.approved ?? null,
    is_active: row.is_active ?? null
  };
}

function validateClient(client) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('a Supabase-like read client is required');
  }
}

export function createSupabaseReadAdapter({ client } = {}) {
  validateClient(client);

  return Object.freeze({
    writesEnabled: false,
    async retrieve({ topic = null, text = null, limit = DEFAULT_LIMIT } = {}) {
      const query = client.from('knowledge_base').select(KNOWLEDGE_FIELDS).limit(normalizeLimit(limit));
      if (topic && typeof query.eq === 'function') query.eq('topic', String(topic));
      if (text && typeof query.ilike === 'function') query.ilike('content', `%${String(text)}%`);

      const response = await query;
      if (response?.error) throw response.error;
      const rows = Array.isArray(response?.data) ? response.data : [];
      return rows.map(sanitizeRow);
    }
  });
}

export { DEFAULT_LIMIT, MAX_LIMIT, KNOWLEDGE_FIELDS };