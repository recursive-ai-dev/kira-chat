let _moduleContext = null;
if (typeof require !== 'undefined') {
  _moduleContext = require('../sentence_engine_wordbanks.js');
}

const weightedRandomFn = (typeof weightedRandom !== 'undefined') ? weightedRandom : _moduleContext.weightedRandom;

function assertStrictEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}`);
  }
}

function runTests() {
  console.log('--- Testing weightedRandom edge cases ---');
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

  // 1. Empty array
  runCase('Empty array returns undefined', () => {
    assertStrictEqual(weightedRandomFn([], []), undefined);
    assertStrictEqual(weightedRandomFn(null, []), undefined);
  });

  // 2. Single element
  runCase('Single element returns the element', () => {
    assertStrictEqual(weightedRandomFn(['a'], [1]), 'a');
    assertStrictEqual(weightedRandomFn(['a']), 'a');
  });

  // 3. Missing weights (uniform pick)
  runCase('Missing weights falls back to uniform pick', () => {
    const arr = ['a', 'b', 'c'];
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.99;
      assertStrictEqual(weightedRandomFn(arr), 'c');
      Math.random = () => 0.01;
      assertStrictEqual(weightedRandomFn(arr), 'a');
    } finally {
      Math.random = originalRandom;
    }
  });

  // 4. Invalid or zero weights (uniform pick)
  runCase('Zero or invalid weights fall back to uniform pick', () => {
    const arr = ['a', 'b', 'c'];
    const weights = [0, -1, NaN];
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.99;
      assertStrictEqual(weightedRandomFn(arr, weights), 'c');
      Math.random = () => 0.01;
      assertStrictEqual(weightedRandomFn(arr, weights), 'a');
    } finally {
      Math.random = originalRandom;
    }
  });

  // 5. Valid weights
  runCase('Valid weights select correctly based on random value', () => {
    const arr = ['a', 'b', 'c'];
    const weights = [10, 20, 70]; // Total: 100
    const originalRandom = Math.random;

    try {
      // random * 100 = 5, select 'a' (5 <= 10)
      Math.random = () => 0.05;
      assertStrictEqual(weightedRandomFn(arr, weights), 'a');

      // random * 100 = 25, select 'b' (25 > 10, 25 <= 30)
      Math.random = () => 0.25;
      assertStrictEqual(weightedRandomFn(arr, weights), 'b');

      // random * 100 = 90, select 'c' (90 > 30, 90 <= 100)
      Math.random = () => 0.90;
      assertStrictEqual(weightedRandomFn(arr, weights), 'c');
    } finally {
      Math.random = originalRandom;
    }
  });

  // 6. Partial invalid weights
  runCase('Ignores invalid weights and calculates total correctly', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const weights = [10, -5, NaN, 10]; // Valid total = 20
    const originalRandom = Math.random;

    try {
      // random * 20 = 5, select 'a' (5 <= 10)
      Math.random = () => 0.25;
      assertStrictEqual(weightedRandomFn(arr, weights), 'a');

      // random * 20 = 15, select 'd' (ignores b and c)
      Math.random = () => 0.75;
      assertStrictEqual(weightedRandomFn(arr, weights), 'd');
    } finally {
      Math.random = originalRandom;
    }
  });

  // 7. Length mismatch (fewer weights)
  runCase('Handles fewer weights than array elements', () => {
    const arr = ['a', 'b', 'c'];
    const weights = [10]; // Total = 10, ignores 'b' and 'c'
    const originalRandom = Math.random;

    try {
      Math.random = () => 0.5; // select 'a'
      assertStrictEqual(weightedRandomFn(arr, weights), 'a');

      // In actual implementation if it goes through all n (which is 1),
      // and random doesn't trigger, it drops to `arr[n-1]` which is 'a'
      Math.random = () => 0.99;
      assertStrictEqual(weightedRandomFn(arr, weights), 'a');
    } finally {
      Math.random = originalRandom;
    }
  });

  // 8. Length mismatch (fewer array elements)
  runCase('Handles fewer array elements than weights', () => {
      const arr = ['a'];
      const weights = [10, 20];
      // Handled by arr.length === 1 already, but if it was > 1
      const arr2 = ['a', 'b'];
      const weights2 = [10, 20, 30]; // Total = 30
      const originalRandom = Math.random;

      try {
        Math.random = () => 0.2; // 0.2 * 30 = 6, select 'a'
        assertStrictEqual(weightedRandomFn(arr2, weights2), 'a');

        Math.random = () => 0.8; // 0.8 * 30 = 24, select 'b'
        assertStrictEqual(weightedRandomFn(arr2, weights2), 'b');
      } finally {
        Math.random = originalRandom;
      }
  });


  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
