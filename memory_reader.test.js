'use strict';

import assert from 'node:assert/strict';
import test from 'node:test';

import { createMemoryReader } from '../../autonomous/memory_reader.js';

test('reads memories without exposing source objects', () => {
  const memories = [
    {
      memoryKey: 'goal',
      memoryValue: 'build business',
      memoryType: 'general'
    }
  ];

  const reader = createMemoryReader({ memories });
  const result = reader.readMemories();

  assert.deepEqual(result, memories);
  assert.notStrictEqual(result, memories);
  assert.notStrictEqual(result[0], memories[0]);
});

test('reads agent state without exposing source object', () => {
  const agentState = {
    currentStep: 'qualification',
    score: 75
  };

  const reader = createMemoryReader({ agentState });
  const result = reader.readAgentState();

  assert.deepEqual(result, agentState);
  assert.notStrictEqual(result, agentState);
});

test('returns null when agent state is missing', () => {
  const reader = createMemoryReader();

  assert.equal(reader.readAgentState(), null);
});

test('reader exposes writesEnabled as false', () => {
  const reader = createMemoryReader();

  assert.equal(reader.writesEnabled, false);
});

test('reader does not mutate original memory data', () => {
  const memories = [
    {
      memoryKey: 'goal',
      memoryValue: 'old goal',
      memoryType: 'general'
    }
  ];

  const reader = createMemoryReader({ memories });
  const result = reader.readMemories();

  result[0].memoryValue = 'changed';

  assert.equal(memories[0].memoryValue, 'old goal');
});