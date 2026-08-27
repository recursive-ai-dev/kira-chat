const fs = require('fs');
const path = require('path');

// Extract the topicRelevance function from kira_v3.html
const htmlContent = fs.readFileSync(path.join(__dirname, '../kira_v3.html'), 'utf-8');
const startIndex = htmlContent.indexOf('function topicRelevance(wordObj, topics) {');
let endIndex = -1;
let openBraces = 0;

if (startIndex !== -1) {
    for (let i = startIndex; i < htmlContent.length; i++) {
        if (htmlContent[i] === '{') openBraces++;
        else if (htmlContent[i] === '}') {
            openBraces--;
            if (openBraces === 0) {
                endIndex = i + 1;
                break;
            }
        }
    }
}

if (startIndex === -1 || endIndex === -1) {
    console.error('Failed to extract topicRelevance function');
    process.exit(1);
}

const funcStr = htmlContent.substring(startIndex, endIndex);
// Evaluate the function in current context
const topicRelevance = new Function('return ' + funcStr)();

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing topicRelevance ---');
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

  // 1. No topics
  runCase('No topics provided returns 1.0', () => {
    assertStrictEqual(topicRelevance({ word: 'apple' }, null), 1.0);
    assertStrictEqual(topicRelevance({ word: 'apple' }, undefined), 1.0);
  });

  // 2. Empty topics
  runCase('Empty array of topics provided returns 1.0', () => {
    assertStrictEqual(topicRelevance({ word: 'apple' }, []), 1.0);
  });

  // 3. No word property
  runCase('Topics provided but word object has no word property returns 1.0', () => {
    assertStrictEqual(topicRelevance({}, ['fruit']), 1.0);
    assertStrictEqual(topicRelevance({ intensity: 5 }, ['fruit']), 1.0);
    assertStrictEqual(topicRelevance({ word: null }, ['fruit']), 1.0);
    assertStrictEqual(topicRelevance({ word: undefined }, ['fruit']), 1.0);
  });

  // 4. No match
  runCase('Topics provided, word object has word, but no match returns 1.0', () => {
    assertStrictEqual(topicRelevance({ word: 'apple' }, ['car', 'dog']), 1.0);
  });

  // 5. Single match
  runCase('Topics provided, word object has word, and single match returns 3.0', () => {
    assertStrictEqual(topicRelevance({ word: 'apple' }, ['apple', 'dog']), 3.0);
    assertStrictEqual(topicRelevance({ word: 'green apple' }, ['apple', 'dog']), 3.0);
  });

  // 6. Multiple matches
  runCase('Topics provided, word object has word, and multiple matches returns > 3.0', () => {
    assertStrictEqual(topicRelevance({ word: 'apple tree' }, ['apple', 'tree']), 5.0);
  });

  // 7. Case insensitivity
  runCase('Match is case-insensitive', () => {
    assertStrictEqual(topicRelevance({ word: 'APPLE' }, ['apple']), 3.0);
    assertStrictEqual(topicRelevance({ word: 'apple' }, ['APPLE']), 3.0);
    assertStrictEqual(topicRelevance({ word: 'ApPlE' }, ['aPpLe']), 3.0);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
