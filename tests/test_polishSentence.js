const fs = require('fs');
const path = require('path');

// Extract the polishSentence function from kira_v3.html
const htmlContent = fs.readFileSync(path.join(__dirname, '../kira_v3.html'), 'utf-8');
const startIndex = htmlContent.indexOf('function polishSentence(sentence) {');
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
    console.error('Failed to extract polishSentence function');
    process.exit(1);
}

const funcStr = htmlContent.substring(startIndex, endIndex);
// Evaluate the function in current context
const polishSentence = new Function('return ' + funcStr)();

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected "${expected}", got "${actual}". ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing polishSentence edge cases ---');
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

  // 1. Edge/Invalid Inputs
  runCase('null/undefined/empty string/non-string returns empty string', () => {
    assertStrictEqual(polishSentence(null), '');
    assertStrictEqual(polishSentence(undefined), '');
    assertStrictEqual(polishSentence(''), '');
    assertStrictEqual(polishSentence(123), '');
    assertStrictEqual(polishSentence({}), '');
  });

  // 2. Whitespace & punctuation spacing (Step 1)
  runCase('Whitespace & punctuation spacing', () => {
    assertStrictEqual(polishSentence('  hello   world  '), 'Hello world.');
    assertStrictEqual(polishSentence('hello , world ! '), 'Hello, world!');
    assertStrictEqual(polishSentence('in in the room'), 'In the room.');
    assertStrictEqual(polishSentence('hello,, world!!'), 'Hello, world!');
    assertStrictEqual(polishSentence('wait...'), 'Wait.');
    assertStrictEqual(polishSentence('what??'), 'What?');
    assertStrictEqual(polishSentence('why?,'), 'Why?');
    assertStrictEqual(polishSentence('okay.,'), 'Okay.');
    assertStrictEqual(polishSentence('okay,.'), 'Okay.');
    assertStrictEqual(polishSentence('okay!.'), 'Okay!');
    assertStrictEqual(polishSentence('about because'), 'About it, because.');
  });

  // 3. Article correction (a vs an) (Step 2)
  runCase('Article correction (a vs an)', () => {
    assertStrictEqual(polishSentence('a apple'), 'An apple.');
    assertStrictEqual(polishSentence('A apple'), 'An apple.');
    assertStrictEqual(polishSentence('a unique thing'), 'A unique thing.');
    assertStrictEqual(polishSentence('a hour'), 'An hour.');
    assertStrictEqual(polishSentence('a honest mistake'), 'An honest mistake.');
    assertStrictEqual(polishSentence('a house'), 'A house.');
  });

  // 4. Subject-verb & intensifier ordering (Step 3)
  runCase('Subject-verb & intensifier ordering', () => {
    assertStrictEqual(polishSentence('I so am tired'), "I'm so tired."); // I so am -> I am so -> I'm so
    assertStrictEqual(polishSentence("I so can't do this"), "I really can't do this.");
    assertStrictEqual(polishSentence('I really am'), "I'm really."); // I really am -> I am really -> I'm really
    assertStrictEqual(polishSentence('I is happy'), "I'm happy."); // I is -> I am -> I'm
    assertStrictEqual(polishSentence('you was there'), "You were there.");
    assertStrictEqual(polishSentence('he are here'), 'He is here.');
    assertStrictEqual(polishSentence('she are here'), 'She is here.');
    assertStrictEqual(polishSentence('it are here'), "It's here."); // it are -> it is -> it's
    assertStrictEqual(polishSentence('keep think about it'), 'Keep thinking about it.');
    assertStrictEqual(polishSentence('keep go'), 'Keep going.');
    assertStrictEqual(polishSentence('keep search'), 'Keep searching.');
    assertStrictEqual(polishSentence('keep try'), 'Keep trying.');
    assertStrictEqual(polishSentence('keep make'), 'Keep making.');
    assertStrictEqual(polishSentence('keep the money'), 'Keep the money.'); // 'the' is in NON_VERBS
  });

  // 5. Natural conversational contractions (Step 4)
  runCase('Natural conversational contractions', () => {
    assertStrictEqual(polishSentence('I am happy'), "I'm happy.");
    assertStrictEqual(polishSentence('do not go'), "Don't go.");
    assertStrictEqual(polishSentence('cannot wait'), "Can't wait.");
    assertStrictEqual(polishSentence('can not wait'), "Can't wait.");
    assertStrictEqual(polishSentence('it is good'), "It's good.");
    assertStrictEqual(polishSentence('you are good'), "You're good.");
    assertStrictEqual(polishSentence('that is fine'), "That's fine.");
    assertStrictEqual(polishSentence('what is that'), "What's that.");
    assertStrictEqual(polishSentence('there is a way'), "There's a way.");
  });

  // 6. Redundant words (Step 5)
  runCase('Redundant words', () => {
    assertStrictEqual(polishSentence('very very good'), 'Very good.');
    assertStrictEqual(polishSentence('she is is happy'), "She is happy."); // she is is -> she is
    assertStrictEqual(polishSentence('really really'), 'Really.');
  });

  // 7. Standalone 'i' (Step 6)
  runCase("Standalone 'i'", () => {
    assertStrictEqual(polishSentence('i think i can'), 'I think I can.');
    assertStrictEqual(polishSentence("i'm sure"), "I'm sure.");
    assertStrictEqual(polishSentence("i've done it"), "I've done it.");
    assertStrictEqual(polishSentence("i'll go"), "I'll go.");
    assertStrictEqual(polishSentence("i'd like that"), "I'd like that.");
  });

  // 8. Capitalization & terminal punctuation (Step 7)
  runCase('Capitalization & terminal punctuation', () => {
    assertStrictEqual(polishSentence('hello world'), 'Hello world.');
    assertStrictEqual(polishSentence('hello world!'), 'Hello world!');
    assertStrictEqual(polishSentence('hello? yes.'), 'Hello? Yes.');
    assertStrictEqual(polishSentence('wow! amazing.'), 'Wow! Amazing.');
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
