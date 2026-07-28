let _moduleContext = null;
if (typeof require !== 'undefined') {
  // Mock dependencies before requiring the module
  global.getBankWords = function(bankName, ctx) {
    if (global._mockBanks && global._mockBanks[bankName]) {
      return global._mockBanks[bankName];
    }
    return [];
  };

  // Predictable rng for deterministic tests
  let _mockRandValue = 0.5;
  global.rng = function() {
    _mockRandValue = (_mockRandValue + 0.1) % 1;
    return _mockRandValue;
  };

  _moduleContext = require('../sentence_engine_templates.js');
}

const generateFromTemplatesFn = (typeof generateFromTemplates !== 'undefined') ? generateFromTemplates : _moduleContext.generateFromTemplates;
const SENTENCE_TEMPLATES = (typeof _moduleContext !== 'undefined' && _moduleContext.SENTENCE_TEMPLATES) ? _moduleContext.SENTENCE_TEMPLATES : global.SENTENCE_TEMPLATES;

function assertStrictEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected "${expected}", got "${actual}"`);
  }
}

function assertArrayEquals(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    throw new Error(`Assertion failed: expected array`);
  }
  if (actual.length !== expected.length) {
    throw new Error(`Assertion failed: length mismatch. Expected ${expected.length}, got ${actual.length}. Actual array: [${actual.join(', ')}]`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(`Assertion failed at index ${i}: expected "${expected[i]}", got "${actual[i]}"`);
    }
  }
}

function runTests() {
  console.log('--- Testing generateFromTemplates ---');
  let passCount = 0;
  let failCount = 0;

  function runCase(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passCount++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error(e.message);
      failCount++;
    }
  }

  // Backup original templates
  const originalTemplates = [...SENTENCE_TEMPLATES];

  function setTestTemplates(templates) {
    SENTENCE_TEMPLATES.length = 0;
    templates.forEach(t => SENTENCE_TEMPLATES.push(t));
  }

  // Set up mock banks
  global._mockBanks = {
    'bank_a': ['apple', 'banana', 'cherry'],
    'bank_long': ['a'.repeat(501)],
    'bank_empty': []
  };

  runCase('Generates valid sentences (length >= 15)', () => {
    setTestTemplates([{
      id: 'test1',
      moods: ['all'],
      minStage: 0,
      structures: ['I like {slot_a} and this makes the sentence long enough'],
      slots: { slot_a: { bank: 'bank_a' } }
    }]);

    const result = generateFromTemplatesFn({ mood: 'all', stage: 1 }, 2);
    // Should return 2 distinct variations.
    assertStrictEqual(result.length, 2);
    assertStrictEqual(result[0].startsWith('I like '), true);
    assertStrictEqual(result[0].length >= 15, true);
    assertStrictEqual(result[1].startsWith('I like '), true);
    assertStrictEqual(result[1].length >= 15, true);
    // Values should be distinct because rng cycles
    assertStrictEqual(result[0] !== result[1], true);
  });

  runCase('Drops short sentences (< 15 chars)', () => {
    setTestTemplates([{
      id: 'test2',
      moods: ['all'],
      minStage: 0,
      structures: ['{slot_a}'], // length < 15
      slots: { slot_a: { bank: 'bank_a' } }
    }]);

    const result = generateFromTemplatesFn({ mood: 'all', stage: 1 }, 3);
    assertArrayEquals(result, []);
  });

  runCase('Drops long sentences (> 500 chars)', () => {
    setTestTemplates([{
      id: 'test3',
      moods: ['all'],
      minStage: 0,
      structures: ['{slot_long}'], // length > 500
      slots: { slot_long: { bank: 'bank_long' } }
    }]);

    const result = generateFromTemplatesFn({ mood: 'all', stage: 1 }, 3);
    assertArrayEquals(result, []);
  });

  runCase('Respects numVariations and deduplicates identical variations', () => {
    setTestTemplates([{
      id: 'test4',
      moods: ['all'],
      minStage: 0,
      structures: ['This is a static sentence with enough length'],
      slots: {}
    }]);

    // Even if numVariations is 5, it should only return 1 because the rest are duplicates
    const result = generateFromTemplatesFn({ mood: 'all', stage: 1 }, 5);
    assertStrictEqual(result.length, 1);
    assertStrictEqual(result[0], 'This is a static sentence with enough length');
  });

  runCase('Fallback to "..." on empty word bank', () => {
    setTestTemplates([{
      id: 'test5',
      moods: ['all'],
      minStage: 0,
      structures: ['The bank returned {slot_empty} for this long sentence'],
      slots: { slot_empty: { bank: 'bank_empty' } }
    }]);

    const result = generateFromTemplatesFn({ mood: 'all', stage: 1 }, 2);
    assertStrictEqual(result.length, 1); // Deduplicated to 1 since there's no variation
    assertStrictEqual(result[0], 'The bank returned ... for this long sentence');
  });

  // Restore original templates
  SENTENCE_TEMPLATES.length = 0;
  originalTemplates.forEach(t => SENTENCE_TEMPLATES.push(t));

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
