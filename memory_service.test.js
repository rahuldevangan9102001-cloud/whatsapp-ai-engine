'use strict';

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeMemory,
  createMemoryService
} from './autonomous/memory_service.js';

test('normalizes a valid memory', () => {
  const result = normalizeMemory({
    memoryKey: 'goal',
    memoryValue: 'business growth'
  });

  assert.deepEqual(result, {
    memoryKey: 'goal',
    memoryValue: 'business growth',
    memoryType: 'general'
  });
});

test('rejects memory without a key', () => {
  assert.throws(
    () =>
      normalizeMemory({
        memoryValue: 'business growth'
      }),
    /memoryKey is required/
  );
});

test('rejects memory without a value', () => {
  assert.throws(
    () =>
      normalizeMemory({
        memoryKey: 'goal'
      }),
    /memoryValue is required/
  );
});

test('adds and lists memories without external services', () => {
  const service = createMemoryService();

  service.add({
    memoryKey: 'goal',
    memoryValue: 'business growth'
  });

  assert.deepEqual(service.list(), [
    {
      memoryKey: 'goal',
      memoryValue: 'business growth',
      memoryType: 'general'
    }
  ]);
});

test('updates an existing memory instead of duplicating it', () => {
  const service = createMemoryService();

  service.add({
    memoryKey: 'goal',
    memoryValue: 'old goal'
  });

  service.add({
    memoryKey: 'goal',
    memoryValue: 'new goal'
  });

  assert.deepEqual(service.list(), [
    {
      memoryKey: 'goal',
      memoryValue: 'new goal',
      memoryType: 'general'
    }
  ]);
});