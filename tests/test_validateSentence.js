const fs = require('fs');
const path = require('path');

// Extract the validateSentence function from kira_v3.html
const htmlContent = fs.readFileSync(path.join(__dirname, '../kira_v3.html'), 'utf-8');
const startIndex = htmlContent.indexOf('function validateSentence(sentence, context) {');
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
    console.error('Failed to extract validateSentence function');
    process.exit(1);
}

const funcStr = htmlContent.substring(startIndex, endIndex);

// Evaluate the function in current context
const validateSentence = new Function('sentence', 'context', funcStr + '\nreturn validateSentence(sentence, context);');

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected "${expected}", got "${actual}". ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing validateSentence edge cases ---');
  let passCount = 0;
  let failCount = 0;

  function runCase(name, setupState, fn) {
    try {
      // Setup global state/kiraAI
      if (setupState) {
        setupState();
      } else {
        globalThis.state = undefined;
        globalThis.kiraAI = undefined;
      }

      fn();
      console.log(`[PASS] ${name}`);
      passCount++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error(e.stack);
      failCount++;
    } finally {
      // Cleanup globals
      globalThis.state = undefined;
      globalThis.kiraAI = undefined;
    }
  }

  // Helper for generating strings of specific length
  const generateString = (len) => 'a'.repeat(len);

  // 1. null / undefined / empty
  runCase('Null, undefined, or empty/whitespace sentence returns false', null, () => {
    assertStrictEqual(validateSentence(null, {}), false);
    assertStrictEqual(validateSentence(undefined, {}), false);
    assertStrictEqual(validateSentence('', {}), false);
    assertStrictEqual(validateSentence('   ', {}), false);
  });

  // 2. Length limits
  runCase('Length limits [15, 500] are enforced', null, () => {
    assertStrictEqual(validateSentence(generateString(14), {}), false, 'Too short');
    assertStrictEqual(validateSentence(generateString(501), {}), false, 'Too long');
    assertStrictEqual(validateSentence(generateString(15), {}), true, 'Min length allowed');
    assertStrictEqual(validateSentence(generateString(500), {}), true, 'Max length allowed');
  });

  // 3. Recent responses
  runCase('Sentence in recentResponses returns false', () => {
    globalThis.state = { recentResponses: ['A valid sentence that was used before.'] };
  }, () => {
    assertStrictEqual(validateSentence('A valid sentence that was used before.', {}), false);
    assertStrictEqual(validateSentence('A valid sentence that is new.', {}), true);
  });

  // 4. Persona-breaking phrases
  runCase('Persona-breaking phrases return false', null, () => {
    assertStrictEqual(validateSentence('Hello, as an AI language model I cannot do that.', {}), false);
    assertStrictEqual(validateSentence('I cannot answer that question.', {}), false);
    assertStrictEqual(validateSentence('This is a completely normal valid sentence here.', {}), true);
  });

  // 5. Unverifiable memory claims (No state/memories)
  runCase('Unverifiable memory claims return false if state.memories is missing', null, () => {
    assertStrictEqual(validateSentence('You told me that you loved programming.', {}), false);
    assertStrictEqual(validateSentence('Remember when you said you hated bugs?', {}), false);
    assertStrictEqual(validateSentence('You shared your favorite color earlier.', {}), false);
  });

  // 6. Verifiable memory claims
  runCase('Verifiable memory claims return true if matching memory exists', () => {
    globalThis.state = {
      memories: [
        { text: 'that you loved programming so much.' }
      ]
    };
  }, () => {
    // Should match because 'that you loved programming so much.' slice(0,30) is 'that you loved programming so '
    // and sentence contains it. (case insensitive)
    assertStrictEqual(validateSentence('You told me that you loved programming so much.', {}), true);
    assertStrictEqual(validateSentence('You told me that you loved programming however.', {}), false, 'Does not match enough of the memory slice');
  });

  // 7. Affection-stage consistency
  runCase('Intimate words return false at low affection', () => {
    globalThis.state = { affection: 299 };
  }, () => {
    assertStrictEqual(validateSentence('I crave your attention today.', {}), false);
    assertStrictEqual(validateSentence('This feeling is intoxicating.', {}), false);
    assertStrictEqual(validateSentence('I am happy to see you today.', {}), true);
  });

  runCase('Intimate words return true at high affection', () => {
    globalThis.state = { affection: 300 };
  }, () => {
    assertStrictEqual(validateSentence('I crave your attention today.', {}), true);
  });

  // 8. Bilinear score
  runCase('Bilinear score <= -0.5 returns false', () => {
    globalThis.kiraAI = {
      scorer: {
        score: () => -0.5 // Edge case: exactly -0.5 is <= -0.5
      },
      respEnc: {
        fwd: () => [0.1, 0.2]
      }
    };
  }, () => {
    assertStrictEqual(validateSentence('This is a valid sentence string.', { ctxVec: [1, 2] }), false);
  });

  runCase('Bilinear score > -0.5 returns true', () => {
    globalThis.kiraAI = {
      scorer: {
        score: () => -0.49
      },
      respEnc: {
        fwd: () => [0.1, 0.2]
      }
    };
  }, () => {
    assertStrictEqual(validateSentence('This is a valid sentence string.', { ctxVec: [1, 2] }), true);
  });

  runCase('Bilinear score error fails safely (returns false)', () => {
    globalThis.kiraAI = {
      scorer: {
        score: () => { throw new Error('Scorer failure'); }
      },
      respEnc: {
        fwd: () => [0.1, 0.2]
      }
    };
  }, () => {
    assertStrictEqual(validateSentence('This is a valid sentence string.', { ctxVec: [1, 2] }), false);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
