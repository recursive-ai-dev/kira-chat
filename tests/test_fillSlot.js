let getBankWordsCalls = [];
globalThis.getBankWords = function(bank, ctx) {
  getBankWordsCalls.push({ bank, ctx });
  if (bank === 'mock_bank_happy') {
    if (ctx.mood === 'happy') return ['happy_word1', 'happy_word2'];
    return [];
  }
  if (bank === 'mock_bank_neutral') {
    if (ctx.mood === 'happy') return [];
    if (ctx.mood === 'neutral') return ['neutral_word1'];
    return [];
  }
  if (bank === 'mock_bank_all') {
    if (ctx.mood === 'happy' || ctx.mood === 'neutral') return [];
    if (ctx.mood === 'all') return ['all_word1'];
    return [];
  }
  if (bank === 'mock_bank_empty') {
    return [];
  }
  if (bank === 'nsfw_bank') {
    if (ctx.allowNSFW) return ['nsfw_word1', 'nsfw_word2'];
    return [];
  }
  return [];
};

// Mock RNG to always return 0.5 for deterministic testing
globalThis.rng = function() {
  return 0.5;
};

const { fillSlot } = require('../sentence_engine_templates.js');

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing fillSlot ---');
  let passCount = 0;
  let failCount = 0;

  function runCase(name, fn) {
    getBankWordsCalls = []; // Reset call log before each test
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

  const baseContext = {
    mood: 'happy',
    stage: 3,
    affection: 150,
    tod: 'day',
    allowNSFW: false
  };

  runCase('Happy path: retrieves word based on primary context', () => {
    // getBankWords returns 2 words for 'happy'. rng is 0.5.
    // idx = (Math.floor(0.5 * 2) + 0) % 2 = (1 + 0) % 2 = 1.
    // So it should pick 'happy_word2'
    const result = fillSlot({ bank: 'mock_bank_happy' }, baseContext);
    assertStrictEqual(result, 'happy_word2');
    assertStrictEqual(getBankWordsCalls.length, 1);
    assertStrictEqual(getBankWordsCalls[0].ctx.mood, 'happy');
  });

  runCase('Relaxation cascade (neutral): retries with neutral mood', () => {
    // getBankWords returns empty for happy, but 1 word for neutral.
    const result = fillSlot({ bank: 'mock_bank_neutral' }, baseContext);
    assertStrictEqual(result, 'neutral_word1');
    assertStrictEqual(getBankWordsCalls.length, 2);
    assertStrictEqual(getBankWordsCalls[0].ctx.mood, 'happy');
    assertStrictEqual(getBankWordsCalls[1].ctx.mood, 'neutral');
  });

  runCase('Relaxation cascade (all): retries with all mood', () => {
    // getBankWords returns empty for happy and neutral, but 1 word for all.
    const result = fillSlot({ bank: 'mock_bank_all' }, baseContext);
    assertStrictEqual(result, 'all_word1');
    assertStrictEqual(getBankWordsCalls.length, 3);
    assertStrictEqual(getBankWordsCalls[0].ctx.mood, 'happy');
    assertStrictEqual(getBankWordsCalls[1].ctx.mood, 'neutral');
    assertStrictEqual(getBankWordsCalls[2].ctx.mood, 'all');
  });

  runCase('Fallback: returns "..." if all attempts fail', () => {
    const result = fillSlot({ bank: 'mock_bank_empty' }, baseContext);
    assertStrictEqual(result, '...');
    assertStrictEqual(getBankWordsCalls.length, 3);
  });

  runCase('NSFW gate: allowNSFW is passed if bank starts with nsfw_', () => {
    // First, try with allowNSFW = true in context
    const nsfwContext = { ...baseContext, allowNSFW: true };
    const result1 = fillSlot({ bank: 'nsfw_bank' }, nsfwContext);
    // rng is 0.5, words.length is 2. Math.floor(0.5 * 2) = 1 -> 'nsfw_word2'
    assertStrictEqual(result1, 'nsfw_word2');
    assertStrictEqual(getBankWordsCalls[0].ctx.allowNSFW, true);

    // Reset and try with allowNSFW = false in context
    getBankWordsCalls = [];
    const result2 = fillSlot({ bank: 'nsfw_bank' }, baseContext);
    assertStrictEqual(result2, '...');
    assertStrictEqual(getBankWordsCalls[0].ctx.allowNSFW, false);

    // Check that allowNSFW is false even if true in context, but bank doesn't start with nsfw_
    getBankWordsCalls = [];
    fillSlot({ bank: 'mock_bank_happy' }, nsfwContext);
    assertStrictEqual(getBankWordsCalls[0].ctx.allowNSFW, false);
  });

  runCase('Variation/randomness: variation parameter shifts the index', () => {
    // rng = 0.5, words = 2. idx = (Math.floor(0.5 * 2) + variation) % 2.
    // Math.floor(0.5 * 2) = 1.
    // variation = 0 => (1 + 0) % 2 = 1 -> 'happy_word2'
    // variation = 1 => (1 + 1) % 2 = 0 -> 'happy_word1'
    const resultVariation0 = fillSlot({ bank: 'mock_bank_happy' }, baseContext, 0);
    assertStrictEqual(resultVariation0, 'happy_word2');

    const resultVariation1 = fillSlot({ bank: 'mock_bank_happy' }, baseContext, 1);
    assertStrictEqual(resultVariation1, 'happy_word1');
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
