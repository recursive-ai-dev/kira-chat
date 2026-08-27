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

// 1. Extract TOPIC_PATTERNS
const startIndexPatterns = kiraHtml.indexOf('const TOPIC_PATTERNS={');
const endIndexPatterns = kiraHtml.indexOf('};', startIndexPatterns);
const topicPatternsCode = kiraHtml.substring(startIndexPatterns, endIndexPatterns + 2);

// 2. Extract detectTopics
const functionCode = extractFunction(kiraHtml, 'detectTopics');

if (!functionCode) {
  console.error("[FAIL] detectTopics function missing in kira_v3.html or could not be extracted.");
  process.exit(1);
}

// Mock global state
global.state = {
  topics: {}
};

// Evaluate TOPIC_PATTERNS properly
eval(topicPatternsCode.replace('const ', 'global.'));

// Ensure the evaluation happens with access to global context
const detectTopics = new Function(`return ${functionCode}`)();

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`Assertion failed: expected ${e}, got ${a}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing detectTopics ---');
  let passCount = 0;
  let failCount = 0;

  function runCase(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passCount++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error(e.stack);
      failCount++;
    }
  }

  // 1. Single match
  runCase('Single topic detection', () => {
    global.state.topics = {};
    const found = detectTopics("I love the rain outside");
    assertDeepEqual(found, ['weather', 'relationship']); // 'love' triggers 'relationship'
    assertDeepEqual(global.state.topics, { weather: 1, relationship: 1 });
  });

  runCase('Single topic detection (isolated)', () => {
    global.state.topics = {};
    const found = detectTopics("It is raining outside");
    assertDeepEqual(found, ['weather']);
    assertDeepEqual(global.state.topics, { weather: 1 });
  });

  // 2. Multiple matches
  runCase('Multiple topic detection', () => {
    global.state.topics = {};
    const found = detectTopics("My mom took our dog for a walk in the sun");
    assertDeepEqual(found.sort(), ['weather', 'family', 'pets'].sort());
    assertDeepEqual(global.state.topics, { weather: 1, family: 1, pets: 1 });
  });

  // 3. No match
  runCase('No topic detected', () => {
    global.state.topics = {};
    const found = detectTopics("I just bought a new computer");
    assertDeepEqual(found, []);
    assertDeepEqual(global.state.topics, {});
  });

  // 4. Case insensitivity
  runCase('Case insensitivity', () => {
    global.state.topics = {};
    const found = detectTopics("I had a NIGHTMARE about a PUPPY");
    assertDeepEqual(found.sort(), ['dreams', 'pets'].sort());
    assertDeepEqual(global.state.topics, { dreams: 1, pets: 1 });
  });

  // 5. Word boundaries
  runCase('Respects word boundaries', () => {
    global.state.topics = {};
    // "brain" shouldn't match "rain"
    // "smarty" shouldn't match "art"
    const found = detectTopics("The smarty brain will fly over the sunny patch");
    assertDeepEqual(found, ['travel']);
    assertDeepEqual(global.state.topics, { travel: 1 });
  });

  // 6. Cumulative topics count
  runCase('Topics count accumulates', () => {
    global.state.topics = { weather: 5, pets: 2 };
    const found = detectTopics("I love when the sun comes out");
    assertDeepEqual(found.sort(), ['weather', 'relationship'].sort());
    assertDeepEqual(global.state.topics, { weather: 6, pets: 2, relationship: 1 });
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
