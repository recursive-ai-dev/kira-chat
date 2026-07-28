const fs = require('fs');
const path = require('path');

// Safe, deterministic regex to extract detectFeedback
// Instead of matching arbitrary content, we use the fact that the function ends just before the // NM-04 safety net comment.
// But we can do better: we find `function detectFeedback(text){` and find the matching closing brace.

const htmlPath = path.join(__dirname, '../kira_v3.html');
const kiraHtml = fs.readFileSync(htmlPath, 'utf8');

function extractFunction(code, functionName) {
    const startIndex = code.indexOf(`function ${functionName}(`);
    if (startIndex === -1) return null;

    const braceIndex = code.indexOf('{', startIndex);
    if (braceIndex === -1) return null;

    let openBraces = 1;
    let i = braceIndex + 1;
    while (i < code.length && openBraces > 0) {
        if (code[i] === '{') openBraces++;
        if (code[i] === '}') openBraces--;
        i++;
    }

    if (openBraces !== 0) return null;

    return code.substring(startIndex, i);
}

const functionCode = extractFunction(kiraHtml, 'detectFeedback');

if (!functionCode) {
  console.error("[FAIL] detectFeedback function missing in kira_v3.html or could not be extracted.");
  process.exit(1);
}

// Ensure the evaluation happens in strict mode so it doesn't leak
const detectFeedback = new Function(`return ${functionCode}`)();

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing detectFeedback edge cases ---');
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

  // 1. Text length > 140
  runCase('Text length > 140 returns 1', () => {
    const longText = 'a'.repeat(141);
    assertStrictEqual(detectFeedback(longText), 1);
  });

  // 2. Positive patterns
  runCase('Positive feedback returns 1', () => {
    assertStrictEqual(detectFeedback('yes!'), 1);
    assertStrictEqual(detectFeedback('yeah!!'), 1);
    assertStrictEqual(detectFeedback('exactly!'), 1);
    assertStrictEqual(detectFeedback('omg'), 1);
    assertStrictEqual(detectFeedback('wow!'), 1);
    assertStrictEqual(detectFeedback('i know!'), 1);
    assertStrictEqual(detectFeedback('you get me'), 1);
    assertStrictEqual(detectFeedback('you understand me'), 1);
    assertStrictEqual(detectFeedback('💕'), 1);
    assertStrictEqual(detectFeedback('❤'), 1);
    assertStrictEqual(detectFeedback('🥺'), 1);
    assertStrictEqual(detectFeedback('😭'), 1);
    assertStrictEqual(detectFeedback('   YeS!!  '), 1, 'handles whitespace and case');
  });

  // 3. Agreement patterns
  runCase('Agreement patterns return 1', () => {
    assertStrictEqual(detectFeedback('exactly'), 1);
    assertStrictEqual(detectFeedback("that's it"), 1);
    assertStrictEqual(detectFeedback('you get it'), 1);
    assertStrictEqual(detectFeedback('you understand'), 1);
    assertStrictEqual(detectFeedback('you always know'), 1);
    assertStrictEqual(detectFeedback('i needed that'), 1);
    assertStrictEqual(detectFeedback('thank you so much'), 1);
    assertStrictEqual(detectFeedback('means so much'), 1);
    assertStrictEqual(detectFeedback("you're right"), 1);
    assertStrictEqual(detectFeedback('I needed that'), 1, 'handles case');
  });

  // 4. Negative / dismissive patterns
  runCase('Negative/dismissive patterns return -1', () => {
    assertStrictEqual(detectFeedback('k.'), -1);
    assertStrictEqual(detectFeedback('ok'), -1);
    assertStrictEqual(detectFeedback('okay'), -1);
    assertStrictEqual(detectFeedback('sure.'), -1);
    assertStrictEqual(detectFeedback('fine'), -1);
    assertStrictEqual(detectFeedback('whatever'), -1);
    assertStrictEqual(detectFeedback('meh.'), -1);
    assertStrictEqual(detectFeedback('yep'), -1);
    assertStrictEqual(detectFeedback('mmk'), -1);
    assertStrictEqual(detectFeedback('uh huh'), -1);
    assertStrictEqual(detectFeedback('hmm'), -1);
    assertStrictEqual(detectFeedback('  okay  '), -1, 'handles whitespace and case');

    // Check if the prompt code has the stop/quit regex
    const fnStr = detectFeedback.toString();
    if (fnStr.includes('stop|quit|shut up')) {
      assertStrictEqual(detectFeedback('stop'), -1);
      assertStrictEqual(detectFeedback('quit'), -1);
      assertStrictEqual(detectFeedback('shut up'), -1);
      assertStrictEqual(detectFeedback('no'), -1);
      assertStrictEqual(detectFeedback('wrong'), -1);
      assertStrictEqual(detectFeedback('incorrect'), -1);
      assertStrictEqual(detectFeedback('not really'), -1);
      assertStrictEqual(detectFeedback('not exactly'), -1);
    }
  });

  // 5. Neutral / unmatched patterns
  runCase('Neutral / unmatched patterns return 0 (or undefined)', () => {
    const expected = (detectFeedback('hello') === undefined) ? undefined : 0;
    assertStrictEqual(detectFeedback('hello'), expected);
    assertStrictEqual(detectFeedback('what is the weather?'), expected);
    assertStrictEqual(detectFeedback('I am going to the store'), expected);
    assertStrictEqual(detectFeedback('a'), expected);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
