export function buildCustomerContext({ user = null, recentMessages = [], memory = [] } = {}) {
  return Object.freeze({
    user: user ? { ...user } : null,
    recentMessages: Array.isArray(recentMessages) ? recentMessages.map((message) => ({ ...message })) : [],
    memory: Array.isArray(memory) ? memory.map((item) => ({ ...item })) : []
  });
}