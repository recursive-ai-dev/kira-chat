let _moduleContext = null;
if (typeof require !== 'undefined') {
  _moduleContext = require('../sentence_engine_wordbanks.js');
}

const getBankWordsFn = (typeof globalThis.getBankWords !== 'undefined') ? globalThis.getBankWords : _moduleContext.getBankWords;

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function assertArrayEquals(actual, expected, message) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    throw new Error(`Assertion failed: one of the arguments is not an array. ${message || ''}`);
  }
  if (actual.length !== expected.length) {
    throw new Error(`Assertion failed: length mismatch. Expected ${expected.length}, got ${actual.length}. ${message || ''}`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(`Assertion failed at index ${i}: expected ${expected[i]}, got ${actual[i]}. ${message || ''}`);
    }
  }
}

function runTests() {
  console.log('--- Testing getBankWords ---');
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

  // 1. Isolated Mocks
  const mockBanks = {
    test_general: [
      { word: 'all_intensity1', mood: ['all'], intensity: 1 },
      { word: 'happy_intensity1', mood: ['happy'], intensity: 1 },
      { word: 'happy_intensity5', mood: ['happy'], intensity: 5 },
      { word: 'sad_intensity1', mood: ['sad'], intensity: 1 }
    ],
    nsfw_test: [
      { word: 'nsfw_stage1_intensity1', intensity: 1, minStage: 1 },
      { word: 'nsfw_stage5_intensity5', intensity: 5, minStage: 5 }
    ],
    emojis: {
      happy: ['😀', '😁'],
      sad: ['😢'],
      night: ['🌙', '😀'], // Overlap for dedup test
      nsfw: ['🔥'],
      spicy_high: ['🍑', '🍆']
    }
  };

  // 2. General Bank Tests
  runCase('General: matches exact mood and universal', () => {
    const result = getBankWordsFn('test_general', { mood: 'happy', maxIntensity: 5 }, mockBanks);
    assertArrayEquals(result, ['all_intensity1', 'happy_intensity1', 'happy_intensity5']);
  });

  runCase('General: filters by maxIntensity', () => {
    const result = getBankWordsFn('test_general', { mood: 'happy', maxIntensity: 2 }, mockBanks);
    assertArrayEquals(result, ['all_intensity1', 'happy_intensity1']);
  });

  runCase('General: falls back to "all" when mood is not present', () => {
    const result = getBankWordsFn('test_general', { mood: 'angry', maxIntensity: 5 }, mockBanks);
    assertArrayEquals(result, ['all_intensity1']);
  });

  runCase('General: returns empty array for non-existent bank', () => {
    const result = getBankWordsFn('nonexistent', {}, mockBanks);
    assertArrayEquals(result, []);
  });

  // 3. NSFW Bank Tests
  runCase('NSFW: returns empty if allowNSFW is false', () => {
    const result = getBankWordsFn('nsfw_test', { allowNSFW: false, affection: 500, stage: 5, maxIntensity: 5 }, mockBanks);
    assertArrayEquals(result, []);
  });

  runCase('NSFW: returns empty if affection < 300', () => {
    const result = getBankWordsFn('nsfw_test', { allowNSFW: true, affection: 299, stage: 5, maxIntensity: 5 }, mockBanks);
    assertArrayEquals(result, []);
  });

  runCase('NSFW: filters by minStage and maxIntensity', () => {
    const result1 = getBankWordsFn('nsfw_test', { allowNSFW: true, affection: 300, stage: 1, maxIntensity: 5 }, mockBanks);
    assertArrayEquals(result1, ['nsfw_stage1_intensity1']);

    const result2 = getBankWordsFn('nsfw_test', { allowNSFW: true, affection: 300, stage: 5, maxIntensity: 1 }, mockBanks);
    assertArrayEquals(result2, ['nsfw_stage1_intensity1']);

    const result3 = getBankWordsFn('nsfw_test', { allowNSFW: true, affection: 300, stage: 5, maxIntensity: 5 }, mockBanks);
    assertArrayEquals(result3, ['nsfw_stage1_intensity1', 'nsfw_stage5_intensity5']);
  });

  // 4. Emoji Tests
  runCase('Emoji: defaults to happy mood', () => {
    const result = getBankWordsFn('emojis', {}, mockBanks);
    assertArrayEquals(result, ['😀', '😁']);
  });

  runCase('Emoji: specific mood', () => {
    const result = getBankWordsFn('emojis', { mood: 'sad' }, mockBanks);
    assertArrayEquals(result, ['😢']);
  });

  runCase('Emoji: basic NSFW', () => {
    const result = getBankWordsFn('emojis', { isNSFW: true, affection: 300, stage: 3 }, mockBanks);
    assertArrayEquals(result, ['🔥']);
  });

  runCase('Emoji: high stage NSFW', () => {
    const result = getBankWordsFn('emojis', { isNSFW: true, affection: 300, stage: 5 }, mockBanks);
    assertArrayEquals(result, ['🍑', '🍆']);
  });

  runCase('Emoji: NSFW requires affection >= 300', () => {
    // Should fallback to default 'happy'
    const result = getBankWordsFn('emojis', { isNSFW: true, affection: 299, stage: 5 }, mockBanks);
    assertArrayEquals(result, ['😀', '😁']);
  });

  runCase('Emoji: night mode with deduplication', () => {
    // night has ['🌙', '😀'], happy has ['😀', '😁']
    // Should be ['🌙', '😀', '😁']
    const result = getBankWordsFn('emojis', { tod: 'night', mood: 'happy' }, mockBanks);
    assertArrayEquals(result, ['🌙', '😀', '😁']);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
