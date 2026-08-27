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

const functionCode = extractFunction(kiraHtml, 'detectIntentRegex');

if (!functionCode) {
  console.error("[FAIL] detectIntentRegex function missing in kira_v3.html or could not be extracted.");
  process.exit(1);
}

const detectIntentRegex = new Function(`return ${functionCode}`)();

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. Input: "${message}"`);
  }
}

function runTests() {
  console.log('--- Testing detectIntentRegex ---');
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

  runCase('Greeting intent', () => {
    assertStrictEqual(detectIntentRegex('hello'), 'greeting', 'hello');
    assertStrictEqual(detectIntentRegex('hi!'), 'greeting', 'hi!');
    assertStrictEqual(detectIntentRegex('hey'), 'greeting', 'hey');
    assertStrictEqual(detectIntentRegex('yo'), 'greeting', 'yo');
    assertStrictEqual(detectIntentRegex('sup'), 'greeting', 'sup');
    assertStrictEqual(detectIntentRegex("what's up"), 'greeting', "what's up");
    assertStrictEqual(detectIntentRegex('howdy'), 'greeting', 'howdy');
    assertStrictEqual(detectIntentRegex('greetings'), 'greeting', 'greetings');
    assertStrictEqual(detectIntentRegex('good morning'), 'greeting', 'good morning');
    assertStrictEqual(detectIntentRegex('good night'), 'greeting', 'good night');
    assertStrictEqual(detectIntentRegex('hiya'), 'greeting', 'hiya');
    assertStrictEqual(detectIntentRegex('heya'), 'greeting', 'heya');
  });

  runCase('How are you intent', () => {
    assertStrictEqual(detectIntentRegex('how are you'), 'how_are_you', 'how are you');
    assertStrictEqual(detectIntentRegex('how are you?'), 'how_are_you', 'how are you?');
    assertStrictEqual(detectIntentRegex('how r u'), 'how_are_you', 'how r u');
    assertStrictEqual(detectIntentRegex('how you doing'), 'how_are_you', 'how you doing');
    assertStrictEqual(detectIntentRegex('how have you been'), 'how_are_you', 'how have you been');
    assertStrictEqual(detectIntentRegex('wyd'), 'how_are_you', 'wyd');
    assertStrictEqual(detectIntentRegex('what are you up to'), 'how_are_you', 'what are you up to');
    assertStrictEqual(detectIntentRegex('what are you doing?'), 'how_are_you', 'what are you doing?');
  });

  runCase('About her intent', () => {
    assertStrictEqual(detectIntentRegex('who are you'), 'about_her', 'who are you');
    assertStrictEqual(detectIntentRegex('what\'s your name'), 'about_her', 'what\'s your name');
    assertStrictEqual(detectIntentRegex('what is your name'), 'about_her', 'what is your name');
    assertStrictEqual(detectIntentRegex('what is your favorite color'), 'about_her', 'what is your favorite color');
    assertStrictEqual(detectIntentRegex('what\'s your fav food'), 'about_her', 'what\'s your fav food');
    assertStrictEqual(detectIntentRegex('tell me about yourself'), 'about_her', 'tell me about yourself');
    assertStrictEqual(detectIntentRegex('tell me about you'), 'about_her', 'tell me about you');
    assertStrictEqual(detectIntentRegex('what do you like?'), 'about_her', 'what do you like?');
    assertStrictEqual(detectIntentRegex('what do you enjoy'), 'about_her', 'what do you enjoy');
    assertStrictEqual(detectIntentRegex('what do you do'), 'about_her', 'what do you do');
  });

  runCase('Love declaration intent', () => {
    assertStrictEqual(detectIntentRegex('i love you'), 'love_declaration', 'i love you');
    assertStrictEqual(detectIntentRegex('I luv you'), 'love_declaration', 'I luv you');
    assertStrictEqual(detectIntentRegex('i luh u'), 'love_declaration', 'i luh u');
    assertStrictEqual(detectIntentRegex('i love u too'), 'love_declaration', 'i love u too');
  });

  runCase('Miss you intent', () => {
    assertStrictEqual(detectIntentRegex('i miss you'), 'miss_you', 'i miss you');
    assertStrictEqual(detectIntentRegex('I miss u so much'), 'miss_you', 'I miss u so much');
  });

  runCase('Goodbye intent', () => {
    assertStrictEqual(detectIntentRegex('i am going to sleep, good night!'), 'goodbye', 'i am going to sleep, good night!');
    assertStrictEqual(detectIntentRegex('gn'), 'goodbye', 'gn');
    assertStrictEqual(detectIntentRegex('night'), 'goodbye', 'night');
    assertStrictEqual(detectIntentRegex('nighty'), 'goodbye', 'nighty');
    assertStrictEqual(detectIntentRegex('sleep well'), 'goodbye', 'sleep well');
    assertStrictEqual(detectIntentRegex('i\'m going to bed'), 'goodbye', 'i\'m going to bed');
    assertStrictEqual(detectIntentRegex('im gonna sleep'), 'goodbye', 'im gonna sleep');
    assertStrictEqual(detectIntentRegex('bye'), 'goodbye', 'bye');
    assertStrictEqual(detectIntentRegex('goodbye'), 'goodbye', 'goodbye');
    assertStrictEqual(detectIntentRegex('ttyl'), 'goodbye', 'ttyl');
    assertStrictEqual(detectIntentRegex('gotta go'), 'goodbye', 'gotta go');
    assertStrictEqual(detectIntentRegex('heading out'), 'goodbye', 'heading out');
    assertStrictEqual(detectIntentRegex('talk later'), 'goodbye', 'talk later');
    assertStrictEqual(detectIntentRegex('see ya'), 'goodbye', 'see ya');
  });

  runCase('Compliment intent', () => {
    assertStrictEqual(detectIntentRegex('you are beautiful'), 'compliment', 'you are beautiful');
    assertStrictEqual(detectIntentRegex('you\'re so cute'), 'compliment', 'you\'re so cute');
    assertStrictEqual(detectIntentRegex('you are really pretty'), 'compliment', 'you are really pretty');
    assertStrictEqual(detectIntentRegex('you are amazing'), 'compliment', 'you are amazing');
    assertStrictEqual(detectIntentRegex('you\'re very kind'), 'compliment', 'you\'re very kind');
    assertStrictEqual(detectIntentRegex('you are perfect'), 'compliment', 'you are perfect');
    assertStrictEqual(detectIntentRegex('you are the best'), 'compliment', 'you are the best');
    assertStrictEqual(detectIntentRegex('i like you'), 'compliment', 'i like you');
    assertStrictEqual(detectIntentRegex('i appreciate you'), 'compliment', 'i appreciate you');
    assertStrictEqual(detectIntentRegex('i adore you'), 'compliment', 'i adore you');
  });

  runCase('General intent', () => {
    assertStrictEqual(detectIntentRegex('tell me a joke'), 'general', 'tell me a joke');
    assertStrictEqual(detectIntentRegex('what is the capital of france'), 'general', 'what is the capital of france');
    assertStrictEqual(detectIntentRegex('blah blah blah'), 'general', 'blah blah blah');
    assertStrictEqual(detectIntentRegex(''), 'general', 'empty string');
    assertStrictEqual(detectIntentRegex('can you help me?'), 'general', 'can you help me?');
    assertStrictEqual(detectIntentRegex('i miss youth'), 'general', 'i miss youth');
    assertStrictEqual(detectIntentRegex('i love your dress'), 'general', 'i love your dress');
    assertStrictEqual(detectIntentRegex('a bye b'), 'goodbye', 'a bye b');
    assertStrictEqual(detectIntentRegex('abye'), 'general', 'abye');
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
