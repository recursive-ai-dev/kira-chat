const fs = require('fs');
const path = require('path');

const htmlContent = fs.readFileSync(path.join(__dirname, '../kira_v3.html'), 'utf8');

// Global mocks required by generateSentenceCandidates
global.getStage = () => ({ name: 'Stranger' });
global.STAGES = [{ name: 'Stranger' }, { name: 'Friend' }];
global.isNSFWAllowed = () => false;
global._aiCtx = { similar: [] };

global.SENTENCE_TEMPLATES = [
  { moods: ['neutral', 'all'], minStage: 0, timeOfDay: ['morning', 'afternoon', 'evening'], topics: ['general'], allowNSFW: false },
  { moods: ['flirty'], minStage: 0, timeOfDay: ['evening'], topics: ['romance'], allowNSFW: true },
  { moods: ['neutral'], minStage: 1, timeOfDay: ['morning'], topics: ['general'], allowNSFW: false }
];

let sentenceCounter = 0;
global.generateSentence = (template, context) => {
    sentenceCounter++;
    // Generate valid lengths (>= 15 chars)
    return `Generated sentence number ${sentenceCounter} for mood ${context.mood}`;
}

const repeatedWordsRegex = "const REPEATED_WORDS_REGEX = /\\b([\\w'-]{4,})[.,!?;]*\\s+\\1\\b/i;";
const extractConceptTriple = "function extractConceptTriple(text) { return null; }";

function extractGenerateSentenceCandidates() {
    let start = htmlContent.indexOf("function generateSentenceCandidates(");
    let braces = 0;
    for(let i = start; i < htmlContent.length; i++) {
        if(htmlContent[i] === '{') braces++;
        if(htmlContent[i] === '}') {
            braces--;
            if(braces === 0) return htmlContent.substring(start, i+1);
        }
    }
}
const generateSentenceCandidatesCode = extractGenerateSentenceCandidates();

const envCode = `
  ${repeatedWordsRegex}
  ${extractConceptTriple}
  ${generateSentenceCandidatesCode}
  module.exports = { generateSentenceCandidates };
`;

const Module = module.constructor;
const m = new Module();
m._compile(envCode, 'dynamic_module.js');
const { generateSentenceCandidates } = m.exports;


function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing generateSentenceCandidates ---');
  let passCount = 0;
  let failCount = 0;

  function runCase(name, fn) {
    try {
      sentenceCounter = 0;
      fn();
      console.log(`[PASS] ${name}`);
      passCount++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error(e.message);
      failCount++;
    }
  }

  runCase('Generates candidates for default neutral context', () => {
    // Need to provide matching topics for the mocked template
    const candidates = generateSentenceCandidates({topics: ['general']});
    assertStrictEqual(candidates.length > 0, true);
    assertStrictEqual(candidates.length, 5);
  });

  runCase('Filters out invalid grammar (I are) and naturalness constraints', () => {
    global.generateSentence = (template, context) => {
      sentenceCounter++;
      if (sentenceCounter === 1) return "I are going to the store right now."; // should be filtered
      if (sentenceCounter === 2) return "you am going to the store right now."; // should be filtered
      return `Generated sentence number ${sentenceCounter} for mood ${context.mood}`;
    };
    const candidates = generateSentenceCandidates({topics: ['general']});
    assertStrictEqual(candidates.length, 3); // Two are skipped
    assertStrictEqual(candidates[0].includes("I are"), false);
    assertStrictEqual(candidates[0].includes("you am"), false);
  });

  runCase('Filters out repeated words', () => {
    global.generateSentence = (template, context) => {
      sentenceCounter++;
      if (sentenceCounter === 1) return "This is very very good stuff."; // very is repeated
      return `Generated sentence number ${sentenceCounter} for mood ${context.mood}`;
    };
    const candidates = generateSentenceCandidates({topics: ['general']});
    assertStrictEqual(candidates.length, 4); // One is skipped
    assertStrictEqual(candidates.some(c => c.includes("very very")), false);
  });

  runCase('Includes memory context if similar is high', () => {
     global.generateSentence = (template, context) => {
        return "Context memory was: " + context.memoryText;
     };
     global._aiCtx = { similar: [{sim: 0.6, text: "You said you liked apples yesterday"}] };
     const candidates = generateSentenceCandidates({topics: ['general']});
     assertStrictEqual(candidates.length > 0, true);
     assertStrictEqual(candidates[0], "Context memory was: You said you liked apples yesterday");

     // Reset
     global._aiCtx = { similar: [] };
  });

  runCase('Handles length constraints', () => {
    global.generateSentence = (template, context) => {
      sentenceCounter++;
      if (sentenceCounter === 1) return "Too short"; // should be filtered
      if (sentenceCounter === 2) return "A".repeat(501); // should be filtered
      return `Valid sentence number ${sentenceCounter} is long enough`;
    };
    const candidates = generateSentenceCandidates({topics: ['general']});
    assertStrictEqual(candidates.length, 3);
    assertStrictEqual(candidates.some(c => c === "Too short"), false);
    assertStrictEqual(candidates.some(c => c.length > 500), false);
  });

  runCase('Respects template filters (mood, stage, timeOfDay, topics)', () => {
    global.generateSentence = (template, context) => {
      return `Matched template with mood ${template.moods[0]} and index ${sentenceCounter++}`;
    };
    global.STAGES = [{ name: 'Stranger' }, { name: 'Friend' }];
    global.getStage = () => ({ name: 'Friend' });
    global.isNSFWAllowed = () => false;

    const context = { mood: 'neutral', tod: 'morning', topics: ['general'] };
    const candidates = generateSentenceCandidates(context);

    assertStrictEqual(candidates.length, 10);
    assertStrictEqual(candidates[0].includes("neutral"), true);
  });

  runCase('Handles missing properties on context safely', () => {
      // Pass null/empty context to see if it defaults correctly
      const candidates = generateSentenceCandidates({});
      // Since default topics is [], our first template (requires 'general' topic) will be skipped.
      // The second template is flirty, but default mood is neutral.
      // So candidates should be empty.
      assertStrictEqual(candidates.length, 0);
  });


  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
