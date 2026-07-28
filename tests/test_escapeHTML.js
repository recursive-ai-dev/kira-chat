const fs = require('fs');
const path = require('path');

// Extract the escapeHTML function from kira_v3.html
const htmlContent = fs.readFileSync(path.join(__dirname, '../kira_v3.html'), 'utf-8');
const startIndex = htmlContent.indexOf('function escapeHTML(str) {');
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
    console.error('Failed to extract escapeHTML function');
    process.exit(1);
}

const funcStr = htmlContent.substring(startIndex, endIndex);
// Evaluate the function in current context
const escapeHTML = new Function('return ' + funcStr)();

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected "${expected}", got "${actual}". ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing escapeHTML edge cases ---');
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

  // 1. null / undefined
  runCase('null/undefined returns empty string', () => {
    assertStrictEqual(escapeHTML(null), '');
    assertStrictEqual(escapeHTML(undefined), '');
  });

  // 2. No special characters
  runCase('String without special characters remains unchanged', () => {
    assertStrictEqual(escapeHTML('hello world 123'), 'hello world 123');
  });

  // 3. Single special character
  runCase('Single special characters are escaped', () => {
    assertStrictEqual(escapeHTML('&'), '&amp;');
    assertStrictEqual(escapeHTML('<'), '&lt;');
    assertStrictEqual(escapeHTML('>'), '&gt;');
    assertStrictEqual(escapeHTML('"'), '&quot;');
    assertStrictEqual(escapeHTML("'"), '&#039;');
  });

  // 4. Multiple occurrences of the same character
  runCase('Multiple identical special characters are escaped globally', () => {
    assertStrictEqual(escapeHTML('&&'), '&amp;&amp;');
    assertStrictEqual(escapeHTML('<<'), '&lt;&lt;');
  });

  // 5. Mixed special characters
  runCase('Mixed special characters are escaped', () => {
    assertStrictEqual(escapeHTML('<script>alert("hi & bye")</script>'), '&lt;script&gt;alert(&quot;hi &amp; bye&quot;)&lt;/script&gt;');
  });

  // 6. Non-string inputs (numbers, booleans, objects)
  runCase('Non-string inputs are converted to strings and escaped', () => {
    assertStrictEqual(escapeHTML(123), '123');
    assertStrictEqual(escapeHTML(true), 'true');
    // objects like arrays
    assertStrictEqual(escapeHTML(['<']), '&lt;');
    assertStrictEqual(escapeHTML({}), '[object Object]');
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
