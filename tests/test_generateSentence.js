const fs = require('fs');

function extractFunction(source, funcName) {
    const fnSignature = `function ${funcName}(`;
    let startIndex = source.indexOf(fnSignature);
    if (startIndex === -1) return null;

    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let i = startIndex;

    while (i < source.length) {
        const char = source[i];

        if (char === '"' || char === "'" || char === '`') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (stringChar === char && source[i-1] !== '\\') {
                inString = false;
            }
        }

        if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    return source.substring(startIndex, i + 1);
                }
            }
        }
        i++;
    }
    return null;
}

const html = fs.readFileSync('kira_v3.html', 'utf8');

const generateSentenceStr = extractFunction(html, 'generateSentence');
const generateSentence = new Function('template', 'context', generateSentenceStr + '\nreturn generateSentence(template, context);');

// Mock dependencies
globalThis.pick = (arr) => arr[0]; // always pick first for deterministic testing
let fillSentenceSlotCalls = [];
globalThis.fillSentenceSlot = (bankDef, context) => {
    fillSentenceSlotCalls.push({bankDef, context});
    if (bankDef === 'bank_a') return 'apple';
    if (bankDef.bank === 'bank_b') return 'banana';
    return '...';
};
globalThis.polishSentence = (s) => s.trim() + ' (polished)'; // simple mock to verify it's called

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected "${expected}", got "${actual}". ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing generateSentence ---');
  let passCount = 0;
  let failCount = 0;

  function runCase(name, fn) {
    fillSentenceSlotCalls = []; // reset
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

  runCase('Happy path: replaces single slot with value and polishes', () => {
    const template = {
        structures: ['I like {slotA}'],
        slots: {
            slotA: 'bank_a'
        }
    };
    const context = { mood: 'happy' };

    const result = generateSentence(template, context);
    assertStrictEqual(result, 'I like apple (polished)');
    assertStrictEqual(fillSentenceSlotCalls.length, 1);
    assertStrictEqual(fillSentenceSlotCalls[0].bankDef, 'bank_a');
  });

  runCase('Memoization/caching: uses cached value for repeated slots', () => {
    const template = {
        structures: ['{slotA} is a good {slotA}'],
        slots: {
            slotA: 'bank_a'
        }
    };
    const context = {};

    const result = generateSentence(template, context);
    assertStrictEqual(result, 'apple is a good apple (polished)');
    // ensure fillSentenceSlot is only called ONCE despite two occurrences of {slotA}
    assertStrictEqual(fillSentenceSlotCalls.length, 1);
  });

  runCase('Multiple different slots', () => {
    const template = {
        structures: ['{slotA} and {slotB}'],
        slots: {
            slotA: 'bank_a',
            slotB: { bank: 'bank_b' }
        }
    };
    const context = {};

    const result = generateSentence(template, context);
    assertStrictEqual(result, 'apple and banana (polished)');
    assertStrictEqual(fillSentenceSlotCalls.length, 2);
  });

  runCase('Missing slot in template.slots', () => {
      // If a structure has a {slotName} but it's not defined in template.slots,
      // it should leave it as {slotName}
      const template = {
          structures: ['I have a {missingSlot}'],
          slots: {}
      };
      const context = {};

      const result = generateSentence(template, context);
      assertStrictEqual(result, 'I have a {missingSlot} (polished)');
      assertStrictEqual(fillSentenceSlotCalls.length, 0); // shouldn't call fillSentenceSlot for missing defs
  });

  runCase('No slots in structure', () => {
    const template = {
        structures: ['Just a static sentence'],
        slots: {}
    };
    const context = {};

    const result = generateSentence(template, context);
    assertStrictEqual(result, 'Just a static sentence (polished)');
    assertStrictEqual(fillSentenceSlotCalls.length, 0);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
