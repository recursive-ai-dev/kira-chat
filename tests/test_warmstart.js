/**
 * Evaluates the neural engine improvements:
 *   1. The worker kernel (with warm-start distillation) constructs without error.
 *   2. MoodNet / IntentNet / CompoundMoodNet / NERNet generalize to held-out
 *      phrasings (same keywords, different surface) far above the 1/N chance rate.
 *
 * Run:  node tests/test_warmstart.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'kira_v3.html'), 'utf8');
const m = html.match(/<script id="kira-worker-code"[^>]*>([\s\S]*?)<\/script>/);
if (!m) { console.error('[FAIL] worker script not found'); process.exit(1); }

const ctx = {
  crypto: require('crypto').webcrypto,
  btoa: s => Buffer.from(s, 'binary').toString('base64'),
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  console, setTimeout, clearTimeout,
  postMessage: () => {}, onmessage: null
};

let engine;
try {
  engine = vm.runInNewContext('(function(){' + m[1] + '\n return {kiraAI, MOOD_LABELS, INTENT_LABELS, COMPOUND_LABELS, NER_LABELS};})()', ctx);
} catch (e) {
  console.error('[FAIL] worker kernel threw during construction/warm-start:\n', e);
  process.exit(1);
}

const { kiraAI, MOOD_LABELS, INTENT_LABELS, COMPOUND_LABELS, NER_LABELS } = engine;

function argmax(probs) {
  let mi = 0, mv = -Infinity;
  for (let i = 0; i < probs.length; i++) if (probs[i] > mv) { mv = probs[i]; mi = i; }
  return mi;
}

// Held-out probes: same keyword families as the curriculum but different surface,
// so a correct prediction reflects learned n-gram -> class structure, not memory.
const PROBES = {
  mood: [
    ['happy', "that's great to hear"], ['happy', "happy about this"],
    ['sad', "so sad today"], ['sad', "feeling lonely again"],
    ['angry', "this is annoying me"], ['angry', "i hate that guy"],
    ['anxious', "really anxious now"], ['anxious', "so worried about it"],
    ['flirty', "you're so cute"], ['flirty', "love you babe"],
    ['bored', "so bored today"], ['bored', "this is boring me"],
    ['tired', "i'm tired now"], ['tired', "exhausted and sleepy"],
    ['curious', "i wonder about this"], ['curious', "tell me your opinion"],
    ['grateful', "thank you so much"], ['grateful', "i appreciate you always"],
    ['vulnerable', "do you even care"], ['vulnerable', "am i enough for you"],
    ['neutral', "okay then"], ['neutral', "i see what you mean"]
  ],
  intent: [
    ['greeting', "hi there"], ['greeting', "good morning kira"],
    ['how_are_you', "how are you doing"], ['how_are_you', "how have you been lately"],
    ['about_her', "who are you really"], ['about_her', "what's your name again"],
    ['love_declaration', "i love you kira"], ['miss_you', "i miss you so much"],
    ['goodbye', "good night love"], ['goodbye', "see ya later"],
    ['compliment', "you're so amazing"], ['compliment', "you're perfect for me"],
    ['general', "the weather is nice today"], ['general', "my cat slept all day"]
  ],
  compound: [
    ['sarcastic', "oh sure jan"], ['sarcastic', "as if that's true"],
    ['nostalgic', "back in the day"], ['nostalgic', "those were the days"],
    ['excited', "i can't wait"], ['excited', "so excited finally"]
  ],
  ner: [
    ['name', "my name is alex"], ['name', "call me sam please"],
    ['age', "i am 30 years old"], ['preference', "i really like coffee"],
    ['disclosure', "i was diagnosed with depression"], ['vulnerability', "nobody understands me"]
  ]
};

function evaluate(name, labels, net, table) {
  let correct = 0;
  for (const [label, text] of table) {
    const idx = labels.indexOf(label);
    const pred = argmax(net.fwd(text));
    if (pred === idx) correct++;
  }
  const n = table.length;
  const acc = correct / n;
  const chance = 1 / labels.length;
  const passed = acc > chance * 1.5; // must beat chance meaningfully
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}: ${(acc * 100).toFixed(1)}% accuracy ` +
    `(chance=${(chance * 100).toFixed(1)}%, ${correct}/${n})`);
  return passed;
}

let ok = true;
ok = evaluate('MoodNet', MOOD_LABELS, kiraAI.moodNet, PROBES.mood) && ok;
ok = evaluate('IntentNet', INTENT_LABELS, kiraAI.intentNet, PROBES.intent) && ok;
ok = evaluate('CompoundMoodNet', COMPOUND_LABELS, kiraAI.compoundMoodNet, PROBES.compound) && ok;
ok = evaluate('NERNet', NER_LABELS, kiraAI.nerNet, PROBES.ner) && ok;

// Bilinear scorer should now produce structured (non-degenerate) scores.
const ctxVec = kiraAI.encoder.fwd("i'm so happy today");
const goodResp = kiraAI.respEnc.fwd("i'm really glad you're here");
const s = kiraAI.scorer.score(ctxVec, goodResp);
console.log(`[INFO] bilinear score sample (ctx=positive, resp=warm): ${s.toFixed(4)}`);

if (ok) { console.log('\n=== WARM-START NEURAL ENGINE VERIFIED ==='); process.exit(0); }
else { console.error('\n=== WARM-START BELOW THRESHOLD ==='); process.exit(1); }
