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

const functionCode = extractFunction(kiraHtml, 'detectUserMoodRegex');

if (!functionCode) {
  console.error("[FAIL] detectUserMoodRegex function missing in kira_v3.html or could not be extracted.");
  process.exit(1);
}

globalThis.state = { userMoods: [] };

const detectUserMoodRegex = new Function(`
  ${functionCode};
  return detectUserMoodRegex;
`)();

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing detectUserMoodRegex ---');
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

  runCase('Returns neutral for unmatched text', () => {
    assertStrictEqual(detectUserMoodRegex('hello world'), 'neutral');
    assertStrictEqual(detectUserMoodRegex('this is just a normal sentence'), 'neutral');
  });

  runCase('Detects happy mood', () => {
    assertStrictEqual(detectUserMoodRegex('I am so happy today!'), 'happy');
    assertStrictEqual(detectUserMoodRegex('lmao that is hilarious 😂'), 'happy');
  });

  runCase('Detects sad mood', () => {
    assertStrictEqual(detectUserMoodRegex('I feel so lonely and sad 😢'), 'sad');
    assertStrictEqual(detectUserMoodRegex('it hurts so much'), 'sad');
  });

  runCase('Detects angry mood', () => {
    assertStrictEqual(detectUserMoodRegex('I am so pissed right now'), 'angry');
    assertStrictEqual(detectUserMoodRegex('this pisses me off goddamn it'), 'angry');
  });

  runCase('Detects anxious mood', () => {
    assertStrictEqual(detectUserMoodRegex('I am terrified and freaking out'), 'anxious');
    assertStrictEqual(detectUserMoodRegex('feeling overwhelmed with stress'), 'anxious');
  });

  runCase('Detects flirty mood', () => {
    assertStrictEqual(detectUserMoodRegex('hey gorgeous 😏'), 'flirty');
    assertStrictEqual(detectUserMoodRegex('I miss you baby'), 'flirty');
  });

  runCase('Detects bored mood', () => {
    assertStrictEqual(detectUserMoodRegex('so bored with nothing to do'), 'bored');
    assertStrictEqual(detectUserMoodRegex('whatever meh'), 'bored');
  });

  runCase('Detects tired mood', () => {
    assertStrictEqual(detectUserMoodRegex('I am exhausted, need sleep'), 'tired');
    assertStrictEqual(detectUserMoodRegex('worn out from work'), 'tired');
  });

  runCase('Detects curious mood', () => {
    assertStrictEqual(detectUserMoodRegex('I wonder, what do you think?'), 'curious');
    assertStrictEqual(detectUserMoodRegex('tell me your thoughts on this'), 'curious');
  });

  runCase('Detects grateful mood', () => {
    assertStrictEqual(detectUserMoodRegex('thank you so much, appreciate it'), 'grateful');
    assertStrictEqual(detectUserMoodRegex('that means a lot, sweet of you'), 'grateful');
  });

  runCase('Detects vulnerable mood', () => {
    assertStrictEqual(detectUserMoodRegex('i feel like nobody cares'), 'vulnerable');
    assertStrictEqual(detectUserMoodRegex('be honest, am i worth it'), 'vulnerable');
  });

  runCase('Multiple matches - highest count wins', () => {
    // 2 happy matches ('happy', 'yay'), 1 sad ('sad')
    assertStrictEqual(detectUserMoodRegex('I am happy yay, but also sad'), 'happy');
    // 2 sad matches, 1 happy
    assertStrictEqual(detectUserMoodRegex('I am happy, but also sad and lonely'), 'sad');
  });

  runCase('State management - caps at 10 items', () => {
    globalThis.state.userMoods = [];
    for(let i = 0; i < 15; i++) {
        detectUserMoodRegex('happy');
    }
    assertStrictEqual(globalThis.state.userMoods.length, 10);
    assertStrictEqual(globalThis.state.userMoods[0], 'happy');
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
