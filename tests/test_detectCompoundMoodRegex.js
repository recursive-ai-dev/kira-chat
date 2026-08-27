const fs = require('fs');
const path = require('path');

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

const functionCode = extractFunction(kiraHtml, 'detectCompoundMoodRegex');

if (!functionCode) {
  console.error("[FAIL] detectCompoundMoodRegex function missing in kira_v3.html or could not be extracted.");
  process.exit(1);
}

const detectCompoundMoodRegex = new Function(`return ${functionCode}`)();

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing detectCompoundMoodRegex ---');
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

  // 1. Sarcastic
  runCase('Sarcastic patterns match', () => {
    assertStrictEqual(detectCompoundMoodRegex('Yeah, right'), 'sarcastic');
    assertStrictEqual(detectCompoundMoodRegex('Oh, sure'), 'sarcastic');
    assertStrictEqual(detectCompoundMoodRegex('As if!'), 'sarcastic');
    assertStrictEqual(detectCompoundMoodRegex('Wow, shocking'), 'sarcastic');
    assertStrictEqual(detectCompoundMoodRegex('Totally not what I expected'), 'sarcastic');
    assertStrictEqual(detectCompoundMoodRegex('Sure, Jan'), 'sarcastic');
  });

  // 2. Nostalgic
  runCase('Nostalgic patterns match', () => {
    assertStrictEqual(detectCompoundMoodRegex('Remember when we used to do that?'), 'nostalgic');
    assertStrictEqual(detectCompoundMoodRegex('Back in the day'), 'nostalgic');
    assertStrictEqual(detectCompoundMoodRegex('Those were the days...'), 'nostalgic');
    assertStrictEqual(detectCompoundMoodRegex('When I was a kid'), 'nostalgic');
    assertStrictEqual(detectCompoundMoodRegex('Years ago...'), 'nostalgic');
  });

  // 3. Excited
  runCase('Excited patterns match', () => {
    assertStrictEqual(detectCompoundMoodRegex("I can't wait!"), 'excited');
    assertStrictEqual(detectCompoundMoodRegex('So excited for this'), 'excited');
    assertStrictEqual(detectCompoundMoodRegex('I am super pumped'), 'excited');
    assertStrictEqual(detectCompoundMoodRegex('Hyped!'), 'excited');
    assertStrictEqual(detectCompoundMoodRegex('Stoked to see you'), 'excited');
    assertStrictEqual(detectCompoundMoodRegex('Thrilled about the news'), 'excited');
  });

  // 4. Multiple matches / tie-breaking
  runCase('Most frequent match wins', () => {
    // 2 nostalgic vs 1 excited
    assertStrictEqual(detectCompoundMoodRegex('Remember when we used to go there? I was so excited!'), 'nostalgic');
    // 2 excited vs 1 sarcastic
    assertStrictEqual(detectCompoundMoodRegex('Yeah, right... I am hyped and pumped!'), 'excited');
  });

  // 5. Neutral / no match
  runCase('No match returns null', () => {
    assertStrictEqual(detectCompoundMoodRegex('Hello there'), null);
    assertStrictEqual(detectCompoundMoodRegex('I am going to the store'), null);
    assertStrictEqual(detectCompoundMoodRegex('What is the weather today?'), null);
    assertStrictEqual(detectCompoundMoodRegex(''), null);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
