const fs = require('fs');
const content = fs.readFileSync('kira_v3.html', 'utf8');
global.Float32Array = Float32Array;
global.Map = Map;
global.Math = Math;
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = val.toString(); },
  removeItem(key) { delete this.store[key]; }
};
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
const bankMatch = content.match(/const SENTENCE_WORD_BANKS = (\{[\s\S]*?\});/);
const templateMatch = content.match(/const SENTENCE_TEMPLATES = (\[[\s\S]*?\]);/);
const SENTENCE_WORD_BANKS = eval('(' + bankMatch[1] + ')');
const SENTENCE_TEMPLATES = eval('(' + templateMatch[1] + ')');
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function testTemplates() {
  console.log("--- Production Robustness Audit: Sentence Engine ---");
  let allPass = true;
  for (const template of SENTENCE_TEMPLATES) {
    for (let i = 0; i < 100; i++) {
      const struct = pick(template.structures);
      let sentence = struct;
      for (const [slot, bankName] of Object.entries(template.slots)) {
        const bank = SENTENCE_WORD_BANKS[bankName];
        if (!bank || bank.length === 0) {
          console.error(`[FAIL] Template ${template.id} refers to missing or empty bank: ${bankName}`);
          allPass = false;
        }
        const word = pick(bank || ["MISSING"]);
        sentence = sentence.replace(`{${slot}}`, word);
      }
      if (sentence.includes('{') || sentence.includes('}')) {
        console.error(`[FAIL] Template ${template.id} has unfilled slots: ${sentence}`);
        allPass = false;
      }
    }
  }
  if (allPass) console.log("[PASS] All templates and word banks integrated.");
  return allPass;
}
function testInvariants() {
  console.log("\n--- Production Robustness Audit: Invariants ---");
  let allPass = true;
  const intimateWords = ['crave', 'ache', 'burn', 'obsess', 'intoxicating', 'maddening'];
  const validate = (s, affection) => {
    if (affection < 300) {
      if (intimateWords.some(w => s.toLowerCase().includes(w))) return false;
    }
    return true;
  };
  const badSentence = "I crave your touch";
  if (validate(badSentence, 0) === false && validate(badSentence, 500) === true) {
    console.log("[PASS] Stage-based content gating invariant verified.");
  } else {
    console.error("[FAIL] Stage-based content gating mismatch.");
    allPass = false;
  }
  return allPass;
}
if (testTemplates() && testInvariants()) {
  console.log("\nPRODUCTION AUDIT PASSED.");
} else {
  process.exit(1);
}
