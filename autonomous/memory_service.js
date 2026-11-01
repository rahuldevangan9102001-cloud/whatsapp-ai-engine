'use strict';

const DEFAULT_LIMIT = 20;

function normalizeMemory(memory) {
  if (!memory || typeof memory !== 'object') {
    throw new TypeError('memory must be an object');
  }

  const memoryKey = String(memory.memoryKey || '').trim();
  const memoryValue = String(memory.memoryValue || '').trim();

  if (!memoryKey) {
    throw new TypeError('memoryKey is required');
  }

  if (!memoryValue) {
    throw new TypeError('memoryValue is required');
  }

  return {
    memoryKey,
    memoryValue,
    memoryType: String(memory.memoryType || 'general').trim() || 'general'
  };
}

function createMemoryService({ store = [] } = {}) {
  const memories = Array.isArray(store) ? store : [];

  return {
    add(memory) {
      const normalized = normalizeMemory(memory);

      const existingIndex = memories.findIndex(
        item =>
          item.memoryKey === normalized.memoryKey &&
          item.memoryType === normalized.memoryType
      );

      if (existingIndex >= 0) {
        memories[existingIndex] = normalized;
      } else {
        memories.push(normalized);
      }

      return { ...normalized };
    },

    list(limit = DEFAULT_LIMIT) {
      const safeLimit = Number.isInteger(limit) && limit > 0
        ? limit
        : DEFAULT_LIMIT;

      return memories
        .slice(-safeLimit)
        .map(memory => ({ ...memory }));
    },

    clear() {
      memories.length = 0;
    }
  };
}

export {
  DEFAULT_LIMIT,
  normalizeMemory,
  createMemoryService
};