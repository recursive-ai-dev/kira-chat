let _moduleContext = null;
if (typeof require !== 'undefined') {
  _moduleContext = require('../sentence_engine_wordbanks.js');
}

const deepFreezeFn = (typeof _deepFreezeBanks !== 'undefined') ? _deepFreezeBanks : _moduleContext._deepFreezeBanks;

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing _deepFreezeBanks edge cases ---');
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

  runCase('Freezes a shallow object', () => {
    const obj = { a: 1, b: 2 };
    deepFreezeFn(obj);
    assertStrictEqual(Object.isFrozen(obj), true);
  });

  runCase('Freezes a deep object', () => {
    const obj = { a: { b: { c: 1 } } };
    deepFreezeFn(obj);
    assertStrictEqual(Object.isFrozen(obj), true);
    assertStrictEqual(Object.isFrozen(obj.a), true);
    assertStrictEqual(Object.isFrozen(obj.a.b), true);
  });

  runCase('Freezes arrays', () => {
    const arr = [1, { a: 2 }];
    deepFreezeFn(arr);
    assertStrictEqual(Object.isFrozen(arr), true);
    assertStrictEqual(Object.isFrozen(arr[1]), true);
  });

  runCase('Handles null values without error', () => {
    const obj = { a: null, b: { c: null } };
    deepFreezeFn(obj);
    assertStrictEqual(Object.isFrozen(obj), true);
    assertStrictEqual(Object.isFrozen(obj.b), true);
  });

  runCase('Handles primitive values gracefully', () => {
    deepFreezeFn(null);
    deepFreezeFn(undefined);
    deepFreezeFn(1);
    deepFreezeFn('string');
    deepFreezeFn(true);
  });

  runCase('Handles circular references without infinite loops', () => {
    const obj = { a: 1 };
    obj.self = obj;
    deepFreezeFn(obj);
    assertStrictEqual(Object.isFrozen(obj), true);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
