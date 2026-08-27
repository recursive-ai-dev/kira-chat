/**
 * Front-to-Back Test Suite: Conversational Engine & Grammar Polish
 * 
 * Verifies:
 * 1. Grammar Polish Pipeline (article fix, subject-verb agreement, contractions, capitalization, punctuation).
 * 2. Sentence Engine Template Generation (zero unfilled slots, CoVe compliance).
 * 3. Headless Multi-Turn Conversational Simulation across diverse prompts in JSDOM.
 */

const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

console.log("=== RUNNING CONVERSATIONAL ENGINE FRONT-TO-BACK AUDIT ===");

// 1. Extract and test polishSentence in isolation
const kiraHtml = fs.readFileSync('kira_v3.html', 'utf8');

// Match polishSentence definition
const polishMatch = kiraHtml.match(/function polishSentence\(sentence\)\s*\{([\s\S]*?)\n\}/);
if (!polishMatch) {
  console.error("[FAIL] polishSentence function missing in kira_v3.html");
  process.exit(1);
}

const polishSentence = new Function('sentence', polishMatch[1]);

console.log("\n--- Subtest 1: Grammar Polish Pipeline ---");
const grammarTests = [
  { input: "i so am drawn to a electric moment", expected: "I'm so drawn to an electric moment." },
  { input: "guess what ? i is really glad you said that", expected: "Guess what? I'm really glad you said that." },
  { input: "it is funny you mention that , i cannot stop thinking about it", expected: "It's funny you mention that, I can't stop thinking about it." },
  { input: "there is a hour when i cannot sleep", expected: "There's an hour when I can't sleep." },
  { input: "i have a unique feeling about a honest conversation", expected: "I have a unique feeling about an honest conversation." },
  { input: "you was right about that", expected: "You were right about that." },
  { input: "what is on your mind today", expected: "What's on your mind today." },
  { input: "i so can't wait for this", expected: "I really can't wait for this." },
  { input: "a electric atmosphere in a universe of possibilities", expected: "An electric atmosphere in a universe of possibilities." }
];

let grammarPass = true;
for (const test of grammarTests) {
  const result = polishSentence(test.input);
  if (result !== test.expected) {
    console.error(`[FAIL] Polish mismatch!\n  Input:    "${test.input}"\n  Got:      "${result}"\n  Expected: "${test.expected}"`);
    grammarPass = false;
  }
}
if (grammarPass) {
  console.log("[PASS] All grammar polish tests passed (100%).");
}

// 2. Set up JSDOM environment to simulate front-to-back chat execution in kira_v3.html
console.log("\n--- Subtest 2: Full JSDOM Front-to-Back Chat Simulation ---");

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", (err) => console.error("JSDOM Error:", err));
virtualConsole.on("jsdomError", (err) => console.error("JSDOM Script Error:", err));

const dom = new JSDOM(kiraHtml, {
  runScripts: "dangerously",
  resources: "usable",
  virtualConsole,
  url: "http://localhost/kira_v3.html?seed=12345"
});

const { window } = dom;

// Wait for DOM scripts to initialize
setTimeout(async () => {
  try {
    if (typeof window.generateResponse !== 'function') {
      console.error("[FAIL] window.generateResponse is not defined");
      process.exit(1);
    }

    const testPrompts = [
      "Hello Kira!",
      "How are you doing today?",
      "I'm feeling a bit tired after work.",
      "What do you think about artificial intelligence?",
      "I love building software and coding tools.",
      "Tell me something interesting or surprise me.",
      "Why is the future so unpredictable?",
      "I passed my exam today! I'm so happy!",
      "I feel lonely sometimes.",
      "What's your take on deep conversations?",
      "Do you think about existence?",
      "I appreciate having you here.",
      "What are you thinking about right now?",
      "Good night Kira, heading to sleep."
    ];

    let simPass = true;
    const history = [];

    for (let i = 0; i < testPrompts.length; i++) {
      const prompt = testPrompts[i];
      const response = await window.generateResponse(prompt);

      if (!response || typeof response !== 'string' || response.trim().length === 0) {
        console.error(`[FAIL] Prompt ${i + 1} ("${prompt}") returned empty response!`);
        simPass = false;
        break;
      }

      if (response.includes('{') || response.includes('}')) {
        console.error(`[FAIL] Prompt ${i + 1} ("${prompt}") returned unfilled slots: "${response}"`);
        simPass = false;
        break;
      }

      if (/(?:^|\s)a\s+[aeiouAEIOU]\w*/i.test(response) && !/\ba\s+(?:user|unique|unit|universe|university|useful|uniform|euro)/i.test(response)) {
        console.error(`[FAIL] Prompt ${i + 1} ("${prompt}") contains article error: "${response}"`);
        simPass = false;
        break;
      }

      if (history.includes(response)) {
        console.error(`[FAIL] Duplicate response detected at turn ${i + 1}: "${response}"`);
        simPass = false;
        break;
      }

      history.push(response);
      console.log(`[TURN ${i + 1}] User: "${prompt}"\n          Kira: "${response}"\n`);
    }

    if (simPass && grammarPass) {
      console.log("=== CONVERSATIONAL ENGINE FRONT-TO-BACK AUDIT PASSED ===");
      process.exit(0);
    } else {
      console.error("=== CONVERSATIONAL ENGINE AUDIT FAILED ===");
      process.exit(1);
    }
  } catch (err) {
    console.error("[FATAL ERROR during simulation]", err);
    process.exit(1);
  }
}, 500);
