let _moduleContext = null;
if (typeof require !== 'undefined') {
  const fs = require('fs');
  const html = fs.readFileSync('kira_v3.html', 'utf-8');

  // Extract stageAppropriateness function robustly using bracket counting
  const functionSignature = 'function stageAppropriateness(wordObj, stage) {';
  const startIndex = html.indexOf(functionSignature);

  if (startIndex !== -1) {
    let braceCount = 1;
    let endIndex = startIndex + functionSignature.length;

    while (braceCount > 0 && endIndex < html.length) {
      if (html[endIndex] === '{') braceCount++;
      else if (html[endIndex] === '}') braceCount--;
      endIndex++;
    }

    if (braceCount === 0) {
      const functionBody = html.substring(startIndex, endIndex);
      eval(functionBody);
    }
  }
}

const fn = (typeof stageAppropriateness !== 'undefined') ? stageAppropriateness : null;

function assertStrictEqual(actual, expected, message) {
  // Use a small tolerance for floating point comparisons
  if (Math.abs(actual - expected) > 1e-10) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing stageAppropriateness ---');
  let passCount = 0;
  let failCount = 0;

  if (!fn) {
    console.error('[FAIL] Could not load stageAppropriateness function');
    if (typeof process !== 'undefined') process.exit(1);
    return;
  }

  function runCase(name, testFn) {
    try {
      testFn();
      console.log(`[PASS] ${name}`);
      passCount++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error(e.message);
      failCount++;
    }
  }

  // 1. Exact match (intensity == targetIntensity)
  runCase('Exact match returns 1.0 (max appropriateness)', () => {
    // stage 0 -> Math.floor(0) + 1 = 1
    // targetIntensity = min(5, 1) = 1
    // if intensity = 1, diff = 0, exp(0) = 1.0
    assertStrictEqual(fn({ intensity: 1 }, 0), 1.0);

    // stage 1.2 -> Math.floor(1) + 1 = 2
    // targetIntensity = min(5, 2) = 2
    assertStrictEqual(fn({ intensity: 2 }, 1.2), 1.0);
  });

  // 2. Default intensity
  runCase('Missing intensity defaults to 1', () => {
    // stage 0 -> target 1
    // default intensity 1 -> diff 0 -> exp(0) = 1.0
    assertStrictEqual(fn({}, 0), 1.0);
  });

  // 3. Different differences
  runCase('Calculates exponential decay correctly for diffs', () => {
    // stage 0 -> target 1
    // intensity 2 -> diff 1 -> exp(-1/2) = 0.6065306597
    assertStrictEqual(fn({ intensity: 2 }, 0), Math.exp(-0.5));

    // intensity 3 -> diff 2 -> exp(-2) = 0.1353352832
    assertStrictEqual(fn({ intensity: 3 }, 0), Math.exp(-2.0));
  });

  // 4. Max target intensity limit
  runCase('Target intensity is capped at 5', () => {
    // stage 6 -> Math.floor(5) + 1 = 6
    // targetIntensity = min(5, 6) = 5
    // intensity 5 -> diff 0 -> exp(0) = 1.0
    assertStrictEqual(fn({ intensity: 5 }, 6), 1.0);

    // stage 100 -> targetIntensity = 5
    // intensity 5 -> diff 0 -> exp(0) = 1.0
    assertStrictEqual(fn({ intensity: 5 }, 100), 1.0);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
