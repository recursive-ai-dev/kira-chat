let _moduleContext = null;
if (typeof require !== 'undefined') {
  _moduleContext = require('../sentence_engine_templates.js');
}

const capitalizeFirstFn = (typeof capitalizeFirst !== 'undefined') ? capitalizeFirst : _moduleContext.capitalizeFirst;

function assertStrictEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected "${expected}", got "${actual}"`);
  }
}

function runTests() {
  console.log('--- Testing capitalizeFirst edge cases ---');
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

  // 1. Empty string
  runCase('Empty string returns empty string', () => {
    assertStrictEqual(capitalizeFirstFn(''), '');
  });

  // 2. Normal string (lowercase)
  runCase('Normal lowercase string gets capitalized', () => {
    assertStrictEqual(capitalizeFirstFn('hello'), 'Hello');
    assertStrictEqual(capitalizeFirstFn('hello world'), 'Hello world');
  });

  // 3. Already capitalized string
  runCase('Already capitalized string remains unchanged', () => {
    assertStrictEqual(capitalizeFirstFn('Hello'), 'Hello');
    assertStrictEqual(capitalizeFirstFn('WORLD'), 'WORLD');
  });

  // 4. Single character string
  runCase('Single character gets capitalized', () => {
    assertStrictEqual(capitalizeFirstFn('a'), 'A');
    assertStrictEqual(capitalizeFirstFn('Z'), 'Z');
  });

  // 5. Strings starting with non-letters (numbers, punctuation, whitespace)
  runCase('Strings starting with non-letters remain unchanged', () => {
    assertStrictEqual(capitalizeFirstFn('123hello'), '123hello');
    assertStrictEqual(capitalizeFirstFn('!hello'), '!hello');
    assertStrictEqual(capitalizeFirstFn(' hello'), ' hello');
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
