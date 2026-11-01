export function createMemoryReader({ memories = [], agentState = null } = {}) {
  const readMemories = () => memories.map((memory) => ({ ...memory }));
  const readAgentState = () => (agentState ? { ...agentState } : null);
  return Object.freeze({ readMemories, readAgentState, writesEnabled: false });
}