let _moduleContext = null;
if (typeof require !== 'undefined') {
  _moduleContext = require('../sentence_engine_wordbanks.js');
}

const isNSFWAllowedFn = (typeof isNSFWAllowed !== 'undefined') ? isNSFWAllowed : _moduleContext.isNSFWAllowed;

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing isNSFWAllowed edge cases ---');
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

  // 1. Empty context / missing properties
  runCase('Empty context or missing properties returns allowed: false', () => {
    const res1 = isNSFWAllowedFn({});
    assertStrictEqual(res1.allowed, false);

    const res2 = isNSFWAllowedFn({ affection: 400 });
    assertStrictEqual(res2.allowed, false);

    const res3 = isNSFWAllowedFn({ personality: 'spicy' });
    assertStrictEqual(res3.allowed, false);
  });

  // 2. Affection below threshold
  runCase('Affection < 300 returns allowed: false', () => {
    const res = isNSFWAllowedFn({ affection: 299, personality: 'spicy' });
    assertStrictEqual(res.allowed, false);
  });

  // 3. Personality not spicy
  runCase('Personality not spicy returns allowed: false (even with sufficient affection)', () => {
    const res = isNSFWAllowedFn({ affection: 400, personality: 'playful' });
    assertStrictEqual(res.allowed, false);
  });

  // 4. Minimum threshold
  runCase('Affection = 300 and personality = spicy returns allowed: true, intensity: 0', () => {
    const res = isNSFWAllowedFn({ affection: 300, personality: 'spicy' });
    assertStrictEqual(res.allowed, true);
    assertStrictEqual(res.intensity, 0);
  });

  // 5. Mid-range threshold
  runCase('Affection = 525 and personality = spicy returns allowed: true, intensity: 0.5', () => {
    const res = isNSFWAllowedFn({ affection: 525, personality: 'spicy' });
    assertStrictEqual(res.allowed, true);
    assertStrictEqual(res.intensity, 0.5);
  });

  // 6. Maximum threshold
  runCase('Affection = 750 and personality = spicy returns allowed: true, intensity: 1.0', () => {
    const res = isNSFWAllowedFn({ affection: 750, personality: 'spicy' });
    assertStrictEqual(res.allowed, true);
    assertStrictEqual(res.intensity, 1.0);
  });

  // 7. Above max threshold capping
  runCase('Affection > 750 and personality = spicy returns allowed: true, intensity capped at 1.0', () => {
    const res = isNSFWAllowedFn({ affection: 1000, personality: 'spicy' });
    assertStrictEqual(res.allowed, true);
    assertStrictEqual(res.intensity, 1.0);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
