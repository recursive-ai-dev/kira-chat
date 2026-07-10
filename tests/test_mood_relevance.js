let _moduleContext = null;
if (typeof require !== 'undefined') {
  _moduleContext = require('../sentence_engine_wordbanks.js');
}

const moodRelevanceFn = (typeof moodRelevance !== 'undefined') ? moodRelevance : _moduleContext.moodRelevance;

function assertStrictEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}`);
  }
}

function runTests() {
  console.log('--- Testing moodRelevance ---');
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

  // 1. Known moods
  runCase('Known moods return correct weights', () => {
    assertStrictEqual(moodRelevanceFn('any', 'flirty'), 1.5);
    assertStrictEqual(moodRelevanceFn('any', 'happy'), 1.2);
    assertStrictEqual(moodRelevanceFn('any', 'vulnerable'), 1.3);
    assertStrictEqual(moodRelevanceFn('any', 'sad'), 0.8);
    assertStrictEqual(moodRelevanceFn('any', 'angry'), 0.6);
    assertStrictEqual(moodRelevanceFn('any', 'tired'), 0.7);
    assertStrictEqual(moodRelevanceFn('any', 'neutral'), 1.0);
  });

  // 2. Unknown moods
  runCase('Unknown moods return default 1.0 weight', () => {
    assertStrictEqual(moodRelevanceFn('any', 'ecstatic'), 1.0);
    assertStrictEqual(moodRelevanceFn('any', 'confused'), 1.0);
    assertStrictEqual(moodRelevanceFn('any', 'random_mood'), 1.0);
  });

  // 3. Null / Undefined mood
  runCase('Null or undefined mood returns default 1.0 weight', () => {
    assertStrictEqual(moodRelevanceFn('any', null), 1.0);
    assertStrictEqual(moodRelevanceFn('any', undefined), 1.0);
  });

  // 4. Missing parameters
  runCase('Missing parameters return default 1.0 weight', () => {
    assertStrictEqual(moodRelevanceFn(), 1.0);
    assertStrictEqual(moodRelevanceFn('any'), 1.0);
  });

  // 5. Types edge cases
  runCase('Different types of mood input return default 1.0 weight if no match', () => {
    assertStrictEqual(moodRelevanceFn('any', 123), 1.0);
    assertStrictEqual(moodRelevanceFn('any', {}), 1.0);
    assertStrictEqual(moodRelevanceFn('any', []), 1.0);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
