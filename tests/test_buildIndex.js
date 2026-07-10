let _moduleContext = null;
if (typeof require !== 'undefined') {
  _moduleContext = require('../sentence_engine_wordbanks.js');
}

const buildIndex = _moduleContext._buildIndex;
const WORD_BANKS = _moduleContext.WORD_BANKS;

function assertStrictEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}`);
  }
}

function runTests() {
  console.log('--- Testing _buildIndex ---');
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

  runCase('Handles NSFW banks (nsfw_ prefix) using real banks', () => {
      // nsfw_verbs is a real bank that exists
      const result = buildIndex('nsfw_verbs');
      assertStrictEqual(result.kind, 'nsfw');

      // result.entries should point to the real bank array
      assertStrictEqual(result.entries === WORD_BANKS['nsfw_verbs'], true);
      assertStrictEqual(result.byMood, undefined);
  });

  runCase('Handles general banks correctly using real banks', () => {
      // pronouns is a real bank that exists and has 'all' tag
      const result = buildIndex('pronouns');
      assertStrictEqual(result.kind, 'general');

      // it should have __all__ initialized and populated
      assertStrictEqual(Array.isArray(result.byMood['__all__']), true);
      // Since it's a known bank, we can verify there are elements
      if (result.byMood['__all__'].length === 0) {
          throw new Error('__all__ array is empty but we expected elements');
      }

      // The openers bank does not have 'all', check that too
      const openersResult = buildIndex('openers');
      assertStrictEqual(openersResult.kind, 'general');
      assertStrictEqual(Array.isArray(openersResult.byMood['__all__']), true);
      assertStrictEqual(openersResult.byMood['__all__'].length, 0); // No 'all' in openers

      // it should have the happy mood
      assertStrictEqual(Array.isArray(openersResult.byMood['happy']), true);
      if (openersResult.byMood['happy'].length === 0) {
          throw new Error('happy array is surprisingly empty');
      }

      // Verify that all elements in a mood bucket have either that mood or 'all'
      openersResult.byMood['happy'].forEach(entry => {
         const hasHappy = entry.mood.indexOf('happy') !== -1;
         const hasAll = entry.mood.indexOf('all') !== -1;
         assertStrictEqual(hasHappy || hasAll, true);
      });
  });

  runCase('Returns null for non-array banks', () => {
    assertStrictEqual(buildIndex('nonexistent_bank'), null);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
