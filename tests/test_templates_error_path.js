const { SENTENCE_TEMPLATES, generateFromTemplates } = require('../sentence_engine_templates.js');

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing error path in generateFromTemplates ---');
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

  runCase('Skips failed generations when a slot throws an error', () => {
      // Mock _rand to be deterministic for this test
      const oldRand = global._rand;
      global._rand = () => 0.5;

      // Inject a malicious template
      SENTENCE_TEMPLATES.push({
        id: 'malicious_template',
        moods: ['error_test'],
        minStage: 0,
        structures: ['{bad_slot} test string'],
        slots: {
          bad_slot: {
            get bank() { throw new Error("Injected error for testing"); }
          }
        }
      });

      const context = { mood: 'error_test', stage: 1 };

      // Should not throw, but should skip the malicious template and return candidates
      // generated from other fallback templates (if any match the context) or return empty/default
      let caughtError = false;
      let candidates = [];
      try {
          candidates = generateFromTemplates(context, 1);
      } catch (err) {
          caughtError = true;
      }

      assertStrictEqual(caughtError, false, 'generateFromTemplates threw an exception instead of catching it');

      // Verify the bad template is skipped without completely failing
      // (The test is successful because it didn't throw)

      // Cleanup
      global._rand = oldRand;
      SENTENCE_TEMPLATES.pop(); // Remove the malicious template
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
