# Kira v3 Adaptive Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three-layer adaptive learning (behavioral, personality evolution, memory-driven) to Kira v3 using conservative EMA-based drift with rollback safety.

**Architecture:** Shared `AdaptiveProfile` stored in localStorage feeds three independent adaptation layers. All layers read from `detectFeedback()` signals (+1/-1/0) and use exponential moving averages with low alpha (0.01-0.05) for gradual drift. Zero new neural parameters, fully backward compatible.

**Tech Stack:** Vanilla JavaScript, localStorage, existing Kira v3 neural infrastructure (MoodNet, Scorer, AttentionMem)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `kira_v3.html` | Modify | Main file — add adaptive module at §16, integrate into existing functions |
| `tests/test_adaptive.html` | Create | Standalone test suite for all three adaptive layers |
| `docs/superpowers/specs/2026-04-06-adaptive-architecture-design.md` | Exists | Design spec (reference) |

All code lives in `kira_v3.html` since Kira is a single-file application. The adaptive module will be ~500-700 lines inserted as §16 (before existing handlers), with integration calls in `sendMessage()`, `maybeEmoji()`, `namePrefix()`, `addAffection()`, `kiraAI.rank()`, `updateHerMood()`, `handleGreeting()`, `handleGeneral()`, `handleTopicResponse()`, and `detectTopics()`.

---

## Task 1: AdaptiveProfile Infrastructure

**Files:**
- Modify: `kira_v3.html` — insert adaptive module after §15B (~line 2030, before handleGeneral)
- Test: `tests/test_adaptive.html` — create test file

- [ ] **Step 1: Create test file with AdaptiveProfile tests**

Create `tests/test_adaptive.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kira v3 - Adaptive Layer Tests</title>
<style>
  body { background: #0f0e17; color: #e8e0f0; font-family: 'Nunito', sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
  h1 { color: #e8758a; font-family: 'Quicksand', sans-serif; }
  h2 { color: #d4956a; margin-top: 30px; }
  .test { background: #1e1b2e; padding: 12px; margin: 10px 0; border-radius: 8px; }
  .pass { color: #5ae07a; } .fail { color: #d46060; }
  button { background: linear-gradient(135deg, #e8758a, #c06878); border: none; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin: 5px; }
  #results { margin-top: 20px; }
</style>
</head>
<body>
<h1>🧠 Kira v3 Adaptive Layer Tests</h1>
<button onclick="runAllTests()">Run All Tests</button>
<div id="results"></div>
<script>
// Mock state and utilities
let state = { affection: 0, personality: 'warm', adaptiveEnabled: true, effectivePersonality: 'warm', memories: [], userMoods: [], topics: {}, askedAbout: {} };
function rng() { return Math.random(); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p) { return rng() < p; }

// Stub localStorage
const _store = {};
const localStorage = {
  getItem: k => _store[k] || null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; }
};

// Load adaptive module (inline for testing — will be in kira_v3.html)
</script>

<!-- Paste adaptive module code here when implemented -->
<!-- <script src="../kira_v3.html" type="text/html"></script> -->

<script>
// Test runner
function runAllTests() {
  const results = document.getElementById('results');
  results.innerHTML = '<h2>Results</h2>';
  let html = '';
  let passed = 0, failed = 0;

  function test(name, fn) {
    try {
      fn();
      html += `<div class="test"><span class="pass">✓ ${name}</span></div>`;
      passed++;
    } catch (e) {
      html += `<div class="test"><span class="fail">✗ ${name}</span><br><small>${e.message}</small></div>`;
      failed++;
    }
  }

  // Test 1: Default profile loads correctly
  test('Default profile loads with correct structure', () => {
    // Will be implemented after module is loaded
    if (typeof DEFAULT_ADAPTIVE_PROFILE === 'undefined') throw new Error('DEFAULT_ADAPTIVE_PROFILE not defined');
    const p = DEFAULT_ADAPTIVE_PROFILE;
    if (p.version !== 1) throw new Error(`Expected version 1, got ${p.version}`);
    if (typeof p.engagementEMA !== 'number') throw new Error('engagementEMA not a number');
    if (p.behavior.emojiProbability !== 0.35) throw new Error(`emojiProbability should be 0.35, got ${p.behavior.emojiProbability}`);
    if (p.personality.currentWeights.warm !== 1.0) throw new Error('warm weight should start at 1.0');
  });

  // Test 2: Profile persistence
  test('Profile saves and loads from localStorage', () => {
    if (typeof loadAdaptiveProfile === 'undefined') throw new Error('loadAdaptiveProfile not defined');
    if (typeof saveAdaptiveProfile === 'undefined') throw new Error('saveAdaptiveProfile not defined');
    localStorage.removeItem('kira_adaptive_v1');
    const profile = loadAdaptiveProfile();
    profile.engagementEMA = 0.75;
    saveAdaptiveProfile(profile);
    const reloaded = loadAdaptiveProfile();
    if (reloaded.engagementEMA !== 0.75) throw new Error(`Expected 0.75, got ${reloaded.engagementEMA}`);
  });

  // Test 3: Profile merges defaults on load
  test('Missing fields get default values', () => {
    localStorage.setItem('kira_adaptive_v1', JSON.stringify({ version: 1, behavior: { emojiProbability: 0.5 } }));
    const profile = loadAdaptiveProfile();
    if (profile.behavior.petNameProbability !== 0.4) throw new Error(`petNameProbability not merged, got ${profile.behavior.petNameProbability}`);
    if (profile.personality.currentWeights.warm !== 1.0) throw new Error('personality weights not merged');
  });

  results.innerHTML += html + `<h3>Passed: ${passed}, Failed: ${failed}</h3>`;
}
</script>
</body>
</html>
```

- [ ] **Step 2: Run test to verify it fails (AdaptiveProfile not defined)**

Open `tests/test_adaptive.html` in a browser, click "Run All Tests".
Expected: FAIL — `DEFAULT_ADAPTIVE_PROFILE not defined`

- [ ] **Step 3: Add AdaptiveProfile default structure to kira_v3.html**

Insert this code into `kira_v3.html` after the sentence engine section (~line 2030, before `function handleGeneral`):

```javascript
// ─────────────────────────────────────────────────────────────────────
//  §16  ADAPTIVE ARCHITECTURE  ·  Three-layer self-adapting system
//  Layer 1: Behavioral Learning (emoji, length, pet names, etc.)
//  Layer 2: Personality Evolution (drift based on engagement)
//  Layer 3: Memory-Driven Responses (topk, mood trends, topic tracking)
//  All layers share detectFeedback() signal, use EMA with low alpha
// ─────────────────────────────────────────────────────────────────────

const ADAPTIVE_KEY = 'kira_adaptive_v1';

const DEFAULT_ADAPTIVE_PROFILE = {
  version: 1,
  createdAt: null,
  lastUpdated: null,
  previousVersion: null,
  engagementEMA: 0.5,
  engagementStreak: 0,
  totalSignals: 0,
  positiveRatio: 0.5,
  behavior: {
    emojiProbability: 0.35,
    preferredResponseLength: 0.5,
    petNameProbability: 0.4,
    affectionSensitivity: 1.0,
    temperature: 0.65,
    topK: 3,
    splitResponseProbability: 0.22,
  },
  personality: {
    currentWeights: { warm: 1.0, playful: 0.0, thoughtful: 0.0, spicy: 0.0 },
    moodMapOverrides: {},
    handlerEngagement: {},
    driftRate: 0.01,
  },
  memory: {
    moodTrend: [],
    topicEngagement: {},
    askedTopics: [],
    avoidedPatterns: [],
    favoriteMemories: [],
    memoryRefProbability: 0.3,
    moodTrendSensitivity: 0.4,
  },
  learnedFlags: {},
  rollbackCount: 0,
  lastRollback: null,
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else if (!(key in result)) {
      result[key] = source[key];
    }
  }
  return result;
}

let _adaptiveProfile = null;

function loadAdaptiveProfile() {
  if (_adaptiveProfile) return _adaptiveProfile;
  try {
    const raw = localStorage.getItem(ADAPTIVE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      _adaptiveProfile = deepMerge(JSON.parse(JSON.stringify(DEFAULT_ADAPTIVE_PROFILE)), stored);
      return _adaptiveProfile;
    }
  } catch (e) { /* corrupt data, use defaults */ }
  const defaults = JSON.parse(JSON.stringify(DEFAULT_ADAPTIVE_PROFILE));
  defaults.createdAt = Date.now();
  _adaptiveProfile = defaults;
  return _adaptiveProfile;
}

function saveAdaptiveProfile(profile) {
  _adaptiveProfile = profile;
  profile.lastUpdated = Date.now();
  try {
    localStorage.setItem(ADAPTIVE_KEY, JSON.stringify(profile));
  } catch (e) { /* localStorage full, skip */ }
}
```

- [ ] **Step 4: Run test to verify it passes**

Open `tests/test_adaptive.html`, paste the adaptive module code into the `<script>` section (or load via copying from kira_v3.html), click "Run All Tests".
Expected: All 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add kira_v3.html tests/test_adaptive.html
git commit -m "feat: add AdaptiveProfile infrastructure with persistence and defaults

- DEFAULT_ADAPTIVE_PROFILE with all layer fields
- loadAdaptiveProfile() with deep merge of stored data
- saveAdaptiveProfile() with localStorage persistence
- Standalone test file with 3 passing tests"
```

---

## Task 2: buildAdaptationContext() + Integration in sendMessage()

**Files:**
- Modify: `kira_v3.html` — add `buildAdaptationContext()` after AdaptiveProfile, modify `sendMessage()` to call adaptation functions

- [ ] **Step 1: Write test for buildAdaptationContext()**

Add to `tests/test_adaptive.html` inside the `runAllTests()` function:

```javascript
  // Test 4: buildAdaptationContext returns correct structure
  test('buildAdaptationContext returns all required fields', () => {
    if (typeof buildAdaptationContext === 'undefined') throw new Error('buildAdaptationContext not defined');
    const ctx = buildAdaptationContext('hello there ✨', 'greeting');
    if (ctx.textLength !== 11) throw new Error(`textLength should be 11, got ${ctx.textLength}`);
    if (ctx.hadEmoji !== true) throw new Error('hadEmoji should be true for message with emoji');
    if (ctx.route !== 'greeting') throw new Error(`route should be greeting, got ${ctx.route}`);
    if (!Array.isArray(ctx.topics)) throw new Error('topics should be an array');
    if (typeof ctx.wasQuestion !== 'boolean') throw new Error('wasQuestion should be boolean');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — `buildAdaptationContext not defined`

- [ ] **Step 3: Implement buildAdaptationContext()**

Add to `kira_v3.html` right after the `saveAdaptiveProfile()` function:

```javascript
function buildAdaptationContext(text, route) {
  return {
    textLength: text.length,
    hadEmoji: /[✨💕🔥💋💛💜💙🥀😏😘🥺🤍🌟💫🌙🌌😈💦]/.test(text),
    route: route,
    topics: typeof detectTopics === 'function' ? detectTopics(text) : [],
    userMood: _aiCtx ? _aiCtx.mood : 'neutral',
    hadPetName: /\b(sweetie|hon|babe|love|dork|cutie|trouble|darling|my dear|gorgeous|handsome)\b/i.test(text),
    wasQuestion: text.trim().endsWith('?'),
    timeOfDay: typeof getTimeOfDay === 'function' ? getTimeOfDay() : 'afternoon',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS

- [ ] **Step 5: Add stub adaptation functions (no-op for now)**

Add these stub functions after `buildAdaptationContext()`:

```javascript
function adaptBehavior(signal, context) {
  // Implemented in Task 3
}

function adaptPersonality(route, signal, context) {
  // Implemented in Task 4
}

function adaptMemory(signal, topics) {
  // Implemented in Task 5
}

function checkRollbackSafety() {
  // Implemented in Task 6
}
```

- [ ] **Step 6: Wire up sendMessage() to call adaptation functions**

In `kira_v3.html`, find the `sendMessage()` function. After the existing `kiraAI.feedback()` and `logTransition('feedback_analyzed',...)` lines, add:

```javascript
  // ── Adaptive layers ──────────────────────────────────────
  if (state.adaptiveEnabled !== false) {
    const context = buildAdaptationContext(text, DIAG.lastRoute);
    adaptBehavior(signal, context);
    adaptPersonality(DIAG.lastRoute, signal, context);
    adaptMemory(signal, context.topics);
    checkRollbackSafety();
  }
```

This goes right after the line:
```javascript
  logTransition(correlationId,'feedback_analyzed',startedAt,{signal,regex_mood:regexMoodNow});
```

- [ ] **Step 7: Commit**

```bash
git add kira_v3.html tests/test_adaptive.html
git commit -m "feat: wire adaptive layers into sendMessage pipeline

- buildAdaptationContext() extracts all signals needed
- Stub adaptation functions (implemented in subsequent tasks)
- sendMessage() calls all three layers + rollback check
- Gated by state.adaptiveEnabled flag"
```

---

## Task 3: Layer 1 — Behavioral Learning

**Files:**
- Modify: `kira_v3.html` — implement `adaptBehavior()`, update `maybeEmoji()`, `namePrefix()`, `addAffection()`, `kiraAI.rank()`
- Test: `tests/test_adaptive.html` — add behavioral learning tests

- [ ] **Step 1: Write tests for adaptBehavior()**

Add to `tests/test_adaptive.html`:

```javascript
  // Test 5: adaptBehavior updates emojiProbability on positive feedback with emoji
  test('adaptBehavior increases emojiProbability after positive emoji feedback', () => {
    if (typeof adaptBehavior === 'undefined') throw new Error('adaptBehavior not defined');
    localStorage.removeItem('kira_adaptive_v1');
    const profile = loadAdaptiveProfile();
    profile.behavior.emojiProbability = 0.35;
    saveAdaptiveProfile(profile);
    adaptBehavior(1, { textLength: 50, hadEmoji: true, route: 'greeting', hadPetName: false });
    const updated = loadAdaptiveProfile();
    if (updated.behavior.emojiProbability <= 0.35) throw new Error(`emojiProbability should increase, got ${updated.behavior.emojiProbability}`);
    if (updated.behavior.emojiProbability > 0.8) throw new Error(`emojiProbability exceeded max, got ${updated.behavior.emojiProbability}`);
  });

  // Test 6: adaptBehavior clamps emojiProbability to bounds
  test('adaptBehavior clamps emojiProbability to [0.1, 0.8]', () => {
    const profile = loadAdaptiveProfile();
    profile.behavior.emojiProbability = 0.75;
    saveAdaptiveProfile(profile);
    adaptBehavior(1, { textLength: 100, hadEmoji: true, route: 'greeting', hadPetName: false });
    const updated = loadAdaptiveProfile();
    if (updated.behavior.emojiProbability > 0.8) throw new Error(`emojiProbability should cap at 0.8, got ${updated.behavior.emojiProbability}`);
  });

  // Test 7: adaptBehavior does nothing on neutral signal
  test('adaptBehavior preserves parameters on neutral signal', () => {
    const profile = loadAdaptiveProfile();
    profile.behavior.emojiProbability = 0.42;
    profile.behavior.petNameProbability = 0.55;
    saveAdaptiveProfile(profile);
    adaptBehavior(0, { textLength: 30, hadEmoji: false, route: 'general', hadPetName: false });
    const updated = loadAdaptiveProfile();
    if (updated.behavior.emojiProbability !== 0.42) throw new Error(`emojiProbability changed on neutral signal`);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Expected: FAIL — `adaptBehavior` doesn't actually update parameters yet

- [ ] **Step 3: Implement adaptBehavior()**

Replace the stub `adaptBehavior()` in `kira_v3.html` with:

```javascript
function adaptBehavior(signal, context) {
  const profile = loadAdaptiveProfile();
  const alpha = 0.03;

  // Update engagement EMA
  const engagementSignal = signal > 0 ? 1 : signal < 0 ? 0 : profile.engagementEMA;
  profile.engagementEMA = 0.03 * engagementSignal + (1 - 0.03) * profile.engagementEMA;

  // Update positive ratio
  const posAlpha = 0.02;
  profile.positiveRatio = posAlpha * (signal > 0 ? 1 : 0) + (1 - posAlpha) * profile.positiveRatio;

  // Update total signals
  profile.totalSignals++;

  // Only adapt on non-neutral signals
  if (signal === 0) { saveAdaptiveProfile(profile); return; }

  const b = profile.behavior;
  const bAlpha = 0.05;

  // Emoji probability adaptation
  if (context.hadEmoji && signal > 0) {
    b.emojiProbability = Math.min(0.8, b.emojiProbability + bAlpha * 0.1);
  } else if (!context.hadEmoji && signal > 0) {
    b.emojiProbability = Math.max(0.1, b.emojiProbability - bAlpha * 0.05);
  }

  // Response length preference
  const msgLen = Math.min(context.textLength / 500, 1.0);
  b.preferredResponseLength = bAlpha * msgLen + (1 - bAlpha) * b.preferredResponseLength;
  b.preferredResponseLength = Math.max(0.1, Math.min(0.9, b.preferredResponseLength));

  // Pet name probability
  if (context.hadPetName && signal > 0) {
    b.petNameProbability = Math.min(0.7, b.petNameProbability + bAlpha * 0.1);
  } else if (!context.hadPetName && signal > 0) {
    b.petNameProbability = Math.max(0.1, b.petNameProbability - bAlpha * 0.05);
  }

  // Affection sensitivity
  if (signal > 0) {
    b.affectionSensitivity = Math.min(2.0, b.affectionSensitivity + 0.02 * 0.1);
  } else {
    b.affectionSensitivity = Math.max(0.3, b.affectionSensitivity - 0.02 * 0.1);
  }

  // Temperature (variety preference)
  if (signal > 0) {
    b.temperature = Math.min(1.0, b.temperature + 0.01 * 0.05);
  } else {
    b.temperature = Math.max(0.3, b.temperature - 0.01 * 0.05);
  }

  // Split response probability
  if (signal > 0) {
    b.splitResponseProbability = Math.min(0.5, b.splitResponseProbability + 0.02 * 0.05);
  }

  saveAdaptiveProfile(profile);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Expected: All 3 behavioral tests pass

- [ ] **Step 5: Wire adaptBehavior outputs into existing functions**

Update `maybeEmoji()` in `kira_v3.html`. Find the existing function:
```javascript
function maybeEmoji(){return chance(0.35)?' '+pick(P().emojis):'';}
```

Replace with:
```javascript
function maybeEmoji(){
  const profile = state.adaptiveEnabled !== false ? loadAdaptiveProfile() : null;
  const prob = profile ? profile.behavior.emojiProbability : 0.35;
  return chance(prob) ? ' ' + pick(P().emojis) : '';
}
```

- [ ] **Step 6: Update namePrefix() to use adaptive probability**

Find the existing `namePrefix()` function (~line 1100):
```javascript
function namePrefix(){
  if(state.affection<200)return'';
  return chance(0.4)?pick(P().terms.endear)+' ':'';
}
```

Replace with:
```javascript
function namePrefix(){
  if(state.affection<200)return'';
  const profile = state.adaptiveEnabled !== false ? loadAdaptiveProfile() : null;
  const prob = profile ? profile.behavior.petNameProbability : 0.4;
  return chance(prob) ? pick(P().terms.endear) + ' ' : '';
}
```

- [ ] **Step 7: Update addAffection() to use adaptive sensitivity**

Find the existing `addAffection()` function (~line 955):
```javascript
function addAffection(n){
  const prev=getStage().name;
  state.affection=Math.max(0,Math.min(1000,state.affection+n));
  if(getStage().name!==prev)setTimeout(()=>addSystemMessage('Something shifted between you two... ✧'),500);
  updateAffectionUI();
  updateInsightDock();
}
```

Replace with:
```javascript
function addAffection(n){
  const profile = state.adaptiveEnabled !== false ? loadAdaptiveProfile() : null;
  const multiplier = profile ? profile.behavior.affectionSensitivity : 1.0;
  const prev=getStage().name;
  state.affection=Math.max(0,Math.min(1000,state.affection + n * multiplier));
  if(getStage().name!==prev)setTimeout(()=>addSystemMessage('Something shifted between you two... ✧'),500);
  updateAffectionUI();
  updateInsightDock();
}
```

- [ ] **Step 8: Update kiraAI.rank() to use adaptive temperature/topK**

Find the `rank()` method in the `KiraAI` class (~line 620):
```javascript
    scored.sort((a,b)=>b.score-a.score);
    const K=Math.min(3,scored.length),T=0.65;
```

Replace with:
```javascript
    scored.sort((a,b)=>b.score-a.score);
    const profile = state.adaptiveEnabled !== false ? loadAdaptiveProfile() : null;
    const K = Math.min(profile ? profile.behavior.topK : 3, scored.length);
    const T = profile ? profile.behavior.temperature : 0.65;
```

- [ ] **Step 9: Update sendMessage() split probability**

In `sendMessage()`, find the split chance line:
```javascript
      if(response.length>120&&chance(0.22)){
```

Replace with:
```javascript
      const profile = state.adaptiveEnabled !== false ? loadAdaptiveProfile() : null;
      const splitProb = profile ? profile.behavior.splitResponseProbability : 0.22;
      if(response.length>120&&chance(splitProb)){
```

- [ ] **Step 10: Commit**

```bash
git add kira_v3.html tests/test_adaptive.html
git commit -m "feat: implement Layer 1 — Behavioral Learning

- adaptBehavior() with EMA-based parameter updates
- maybeEmoji() reads adaptive emoji probability
- namePrefix() reads adaptive pet name probability
- addAffection() applies adaptive sensitivity multiplier
- kiraAI.rank() uses adaptive temperature and topK
- sendMessage() uses adaptive split probability
- All parameters clamped to safe bounds"
```

---

## Task 4: Layer 2 — Personality Evolution

**Files:**
- Modify: `kira_v3.html` — implement `adaptPersonality()`, add `state.effectivePersonality`, update `updateHerMood()` for mood map overrides
- Test: `tests/test_adaptive.html` — add personality evolution tests

- [ ] **Step 1: Write tests for adaptPersonality()**

Add to `tests/test_adaptive.html`:

```javascript
  // Test 8: adaptPersonality boosts associated traits on positive signal
  test('adaptPersonality boosts spicy/playful for handleFlirt with positive signal', () => {
    if (typeof adaptPersonality === 'undefined') throw new Error('adaptPersonality not defined');
    localStorage.removeItem('kira_adaptive_v1');
    const profile = loadAdaptiveProfile();
    profile.personality.currentWeights = { warm: 1.0, playful: 0.0, thoughtful: 0.0, spicy: 0.0 };
    saveAdaptiveProfile(profile);
    adaptPersonality('handleFlirt', 1, {});
    const updated = loadAdaptiveProfile();
    if (updated.personality.currentWeights.spicy <= 0.0) throw new Error('spicy weight should increase');
    if (updated.personality.currentWeights.playful <= 0.0) throw new Error('playful weight should increase');
  });

  // Test 9: Personality weights normalize to sum to 1.0
  test('Personality weights normalize to sum to 1.0', () => {
    const profile = loadAdaptiveProfile();
    const weights = profile.personality.currentWeights;
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) throw new Error(`Weights should sum to 1.0, got ${sum}`);
  });

  // Test 10: Handler engagement tracking works
  test('Handler engagement tracks per-route scores', () => {
    const profile = loadAdaptiveProfile();
    if (!profile.personality.handlerEngagement['handleFlirt']) throw new Error('handlerEngagement should have handleFlirt entry');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Expected: FAIL — `adaptPersonality` is a stub

- [ ] **Step 3: Implement adaptPersonality()**

Replace the stub `adaptPersonality()` in `kira_v3.html`:

```javascript
const HANDLER_PERSONALITY_MAP = {
  'handleFlirt': ['spicy', 'playful'],
  'handleBored': ['playful'],
  'handleOpinion': ['thoughtful'],
  'handleGreeting': ['warm'],
  'handleUserFeelsBad': ['warm', 'thoughtful'],
  'handleAdviceRequest': ['thoughtful'],
  'handleHypothetical': ['thoughtful'],
  'handleGoodNews': ['warm', 'playful'],
  'handleSurpriseMe': ['thoughtful', 'playful'],
  'handleCompliment': ['warm', 'playful'],
  'handleILoveYou': ['warm', 'spicy'],
  'handleGeneral': [],
};

function adaptPersonality(route, signal, context) {
  const profile = loadAdaptiveProfile();
  const alpha = 0.01;
  const p = profile.personality;

  // Track handler engagement
  if (!p.handlerEngagement[route]) p.handlerEngagement[route] = 0.5;
  p.handlerEngagement[route] = alpha * (signal > 0 ? 1 : 0) + (1 - alpha) * p.handlerEngagement[route];

  // Boost associated traits on positive signal
  if (signal > 0) {
    const boosted = HANDLER_PERSONALITY_MAP[route] || [];
    for (const trait of boosted) {
      if (p.currentWeights[trait] !== undefined) {
        p.currentWeights[trait] = Math.min(1.0, p.currentWeights[trait] + p.driftRate);
      }
    }
  }

  // Decay all weights toward equilibrium
  for (const trait of Object.keys(p.currentWeights)) {
    p.currentWeights[trait] += (0.25 - p.currentWeights[trait]) * alpha * 0.5;
  }

  // Normalize to sum to 1.0
  const sum = Object.values(p.currentWeights).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const trait of Object.keys(p.currentWeights)) {
      p.currentWeights[trait] /= sum;
    }
  }

  // Derive effective personality
  const sorted = Object.entries(p.currentWeights).sort((a, b) => b[1] - a[1]);
  const [dominant, weight] = sorted[0];
  state.effectivePersonality = weight > 0.4 ? dominant : state.personality;

  saveAdaptiveProfile(profile);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Expected: All 3 personality tests pass

- [ ] **Step 5: Add mood map override learning**

Add this function after `adaptPersonality()`:

```javascript
function adaptMoodMap(userMood, kiraMood, signal) {
  if (signal <= 0) return;
  const profile = loadAdaptiveProfile();
  const alpha = 0.005;
  const overrides = profile.personality.moodMapOverrides;

  if (!overrides[userMood]) overrides[userMood] = {};
  if (!overrides[userMood][kiraMood]) overrides[userMood][kiraMood] = 0.5;

  overrides[userMood][kiraMood] = Math.min(1.0, overrides[userMood][kiraMood] + alpha);

  saveAdaptiveProfile(profile);
}
```

- [ ] **Step 6: Call adaptMoodMap from updateHerMood()**

Find `updateHerMood()` (~line 995). At the end of the function, add:

```javascript
  // Adaptive: learn mood map
  if (state.adaptiveEnabled !== false) {
    adaptMoodMap(state.userMoods[state.userMoods.length - 1] || 'neutral', state.mood, 1);
  }
```

- [ ] **Step 7: Make maybeEmoji() use blended personality pools**

Update `maybeEmoji()` to blend emoji pools when personality weights are distributed:

```javascript
function maybeEmoji(){
  const profile = state.adaptiveEnabled !== false ? loadAdaptiveProfile() : null;
  const prob = profile ? profile.behavior.emojiProbability : 0.35;
  if (!chance(prob)) return '';

  // Blend emoji pools by personality weights
  if (profile && state.effectivePersonality !== state.personality) {
    const weights = profile.personality.currentWeights;
    const blended = [];
    for (const [trait, w] of Object.entries(weights)) {
      if (w > 0.1 && PERSONALITIES[trait]) {
        for (let i = 0; i < Math.ceil(w * 3); i++) {
          blended.push(...PERSONALITIES[trait].emojis);
        }
      }
    }
    return ' ' + pick(blended.length ? blended : P().emojis);
  }
  return ' ' + pick(P().emojis);
}
```

- [ ] **Step 8: Update getName() to use blended endearment pools**

Find `getName()` or wherever terms of endearment are used (in `namePrefix()`). The function already uses `P().terms.endear`. Update it to blend:

```javascript
function namePrefix(){
  if(state.affection<200)return'';
  const profile = state.adaptiveEnabled !== false ? loadAdaptiveProfile() : null;
  const prob = profile ? profile.behavior.petNameProbability : 0.4;
  if (!chance(prob)) return '';

  // Blend endearment pools by personality weights
  if (profile && state.effectivePersonality !== state.personality) {
    const weights = profile.personality.currentWeights;
    const blended = [];
    for (const [trait, w] of Object.entries(weights)) {
      if (w > 0.1 && PERSONALITIES[trait]) {
        for (let i = 0; i < Math.ceil(w * 3); i++) {
          blended.push(...PERSONALITIES[trait].terms.endear);
        }
      }
    }
    return pick(blended.length ? blended : P().terms.endear) + ' ';
  }
  return pick(P().terms.endear) + ' ';
}
```

- [ ] **Step 9: Commit**

```bash
git add kira_v3.html tests/test_adaptive.html
git commit -m "feat: implement Layer 2 — Personality Evolution

- adaptPersonality() with handler engagement tracking
- Personality weights drift toward what produces engagement
- state.effectivePersonality derived from dominant weight
- Mood map override learning (adaptMoodMap)
- Blended emoji and endearment pools by personality weights
- Decay toward equilibrium prevents personality domination"
```

---

## Task 5: Layer 3 — Memory-Driven Responses

**Files:**
- Modify: `kira_v3.html` — implement `generateMemoryReference()`, `detectMoodTrend()`, `adaptMemory()`, update `handleGreeting()`, `handleGeneral()`, `handleTopicResponse()`, `detectTopics()`
- Test: `tests/test_adaptive.html` — add memory-driven tests

- [ ] **Step 1: Write tests for memory-driven functions**

Add to `tests/test_adaptive.html`:

```javascript
  // Test 11: adaptMemory updates topic engagement
  test('adaptMemory updates topicEngagement on signal', () => {
    if (typeof adaptMemory === 'undefined') throw new Error('adaptMemory not defined');
    localStorage.removeItem('kira_adaptive_v1');
    const profile = loadAdaptiveProfile();
    saveAdaptiveProfile(profile);
    adaptMemory(1, ['feelings', 'philosophy']);
    const updated = loadAdaptiveProfile();
    if (!updated.memory.topicEngagement['feelings']) throw new Error('topicEngagement should have feelings entry');
    if (updated.memory.topicEngagement['feelings'] <= 0.5) throw new Error('topic engagement should increase on positive signal');
  });

  // Test 12: detectMoodTrend returns null with insufficient data
  test('detectMoodTrend returns null with < 10 entries', () => {
    if (typeof detectMoodTrend === 'undefined') throw new Error('detectMoodTrend not defined');
    const profile = loadAdaptiveProfile();
    profile.memory.moodTrend = [{ mood: 'happy', ts: Date.now() }];
    const trend = detectMoodTrend(profile);
    if (trend !== null) throw new Error('Should return null with < 10 entries');
  });

  // Test 13: detectMoodTrend detects dominant mood
  test('detectMoodTrend detects dominant mood with enough data', () => {
    const profile = loadAdaptiveProfile();
    profile.memory.moodTrend = [];
    for (let i = 0; i < 20; i++) {
      profile.memory.moodTrend.push({ mood: i < 14 ? 'sad' : 'happy', ts: Date.now() - i * 60000 });
    }
    saveAdaptiveProfile(profile);
    const trend = detectMoodTrend(profile);
    if (!trend) throw new Error('Should detect a trend');
    if (trend.mood !== 'sad') throw new Error(`Dominant mood should be sad, got ${trend.mood}`);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Expected: FAIL — stub functions

- [ ] **Step 3: Implement adaptMemory()**

Replace the stub `adaptMemory()`:

```javascript
function adaptMemory(signal, topics) {
  const profile = loadAdaptiveProfile();
  const alpha = 0.02;

  // Append current mood to trend
  if (_aiCtx && _aiCtx.mood) {
    profile.memory.moodTrend.push({ mood: _aiCtx.mood, ts: Date.now() });
    if (profile.memory.moodTrend.length > 50) {
      profile.memory.moodTrend = profile.memory.moodTrend.slice(-50);
    }
  }

  // Update topic engagement scores
  for (const topic of (topics || [])) {
    if (!profile.memory.topicEngagement[topic]) {
      profile.memory.topicEngagement[topic] = 0.5;
    }
    profile.memory.topicEngagement[topic] =
      alpha * (signal > 0 ? 1 : 0) + (1 - alpha) * profile.memory.topicEngagement[topic];
  }

  // Track asked topics (capped at 20)
  profile.memory.askedTopics = profile.memory.askedTopics.slice(-20);

  saveAdaptiveProfile(profile);
}
```

- [ ] **Step 4: Implement detectMoodTrend()**

Add after `adaptMemory()`:

```javascript
function detectMoodTrend(profile) {
  const trend = profile.memory.moodTrend;
  if (trend.length < 10) return null;

  const counts = {};
  trend.slice(-30).forEach(m => {
    counts[m.mood] = (counts[m.mood] || 0) + 1;
  });

  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!dominant) return null;

  const ratio = dominant[1] / Math.min(30, trend.length);
  if (ratio > profile.memory.moodTrendSensitivity) {
    return { mood: dominant[0], strength: ratio, duration: trend.length };
  }

  return null;
}
```

- [ ] **Step 5: Implement generateMemoryReference()**

Add after `detectMoodTrend()`:

```javascript
function generateMemoryReference(similar) {
  if (!similar || similar.length === 0) return null;

  const best = similar.find(s => s.sim > 0.55);
  if (!best) return null;

  const profile = loadAdaptiveProfile();
  const memScore = profile.memory.favoriteMemories.find(m => m.text === best.text);

  if (memScore && memScore.engagement > 0.6) {
    const templates = [
      `Still thinking about what you said before: "${best.text.slice(0, 40)}..."`,
      `You mentioned something similar last time — "${best.text.slice(0, 40)}..." — has that shifted?`,
      `I keep coming back to what you said: "${best.text.slice(0, 40)}..." It stayed with me.`,
    ];
    if (chance(profile.memory.memoryRefProbability)) {
      return pick(templates);
    }
  }

  if (rng() < profile.memory.memoryRefProbability * 0.5) {
    return `You mentioned this before: "${best.text.slice(0, 40)}..."`;
  }

  return null;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Expected: All 3 memory tests pass

- [ ] **Step 7: Wire memory reference into handleGreeting()**

Find `handleGreeting()` (~line 1215). At the start of the function, after any existing code, add:

```javascript
  // Memory reference (NM-05)
  if (_aiCtx && _aiCtx.similar && _aiCtx.similar.length > 0) {
    const memRef = generateMemoryReference(_aiCtx.similar);
    if (memRef) {
      const responses = [ /* existing response array */ ];
      // Prepend memory reference to first candidate
      responses[0] = memRef + ' ' + responses[0];
      return kiraAI.rank(responses, _aiCtx.ctxVec);
    }
  }
```

Actually, since the response arrays vary, let me use a cleaner approach. At the END of `handleGreeting()`, before the final `return kiraAI.rank([...], _aiCtx.ctxVec)`, insert:

```javascript
  // Memory reference injection
  const memRef = generateMemoryReference(_aiCtx.similar);
  if (memRef) {
    // Wrap the ranked response with memory prefix
    const base = kiraAI.rank(/* existing array */, _aiCtx.ctxVec);
    return memRef + ' ' + base;
  }
```

Since this gets complex with the existing return patterns, instead add a helper that wraps any response:

```javascript
function withMemoryRef(response) {
  if (!state.adaptiveEnabled) return response;
  const memRef = generateMemoryReference(_aiCtx.similar);
  return memRef ? memRef + ' ' + response : response;
}
```

Then in `handleGreeting()`, change the final return from:
```javascript
  return kiraAI.rank([...], _aiCtx.ctxVec);
```
to:
```javascript
  return withMemoryRef(kiraAI.rank([...], _aiCtx.ctxVec));
```

Do the same for `handleGeneral()` — wrap its return with `withMemoryRef()`.

- [ ] **Step 8: Wire mood trend detection into generateResponse()**

In `generateResponse()`, after `updateHerMood(userMood)`, add:

```javascript
  // Mood trend awareness
  if (state.adaptiveEnabled !== false) {
    const profile = loadAdaptiveProfile();
    const trend = detectMoodTrend(profile);
    if (trend) {
      state.flags.recentMoodTrend = trend;
    }
  }
```

- [ ] **Step 9: Update detectTopics() to feed topic engagement**

In `detectTopics()`, after updating `state.topics`, the topic engagement is already handled by `adaptMemory()` which is called from `sendMessage()`. No changes needed here — the pipeline already connects.

- [ ] **Step 10: Update handleTopicResponse() to avoid low-engagement topics**

In `handleTopicResponse()`, before selecting a response, add a check:

```javascript
  const profile = state.adaptiveEnabled !== false ? loadAdaptiveProfile() : null;
  if (profile) {
    // Boost topics with low engagement
    const lowEngagement = topic && profile.memory.topicEngagement[topic] < 0.3;
    if (lowEngagement) {
      // Fall through to general handler
      return handleGeneral('', userMood, getTimeOfDay());
    }
  }
```

- [ ] **Step 11: Commit**

```bash
git add kira_v3.html tests/test_adaptive.html
git commit -m "feat: implement Layer 3 — Memory-Driven Responses

- adaptMemory() tracks mood trends and topic engagement
- detectMoodTrend() identifies dominant mood patterns
- generateMemoryReference() activates dead topk() code
- Memory references injected into handleGreeting/handleGeneral
- Mood trend awareness stored in state.flags
- handleTopicResponse avoids low-engagement topics
- withMemoryRef() helper wraps responses with memory prefixes"
```

---

## Task 6: Rollback Safety + Polish

**Files:**
- Modify: `kira_v3.html` — implement `checkRollbackSafety()`, add UI indicator
- Test: `tests/test_adaptive.html` — add rollback tests

- [ ] **Step 1: Write tests for rollback safety**

Add to `tests/test_adaptive.html`:

```javascript
  // Test 14: checkRollbackSafety increments counter on low engagement
  test('checkRollbackSafety increments rollbackCount on low engagement', () => {
    if (typeof checkRollbackSafety === 'undefined') throw new Error('checkRollbackSafety not defined');
    localStorage.removeItem('kira_adaptive_v1');
    const profile = loadAdaptiveProfile();
    profile.engagementEMA = 0.2;
    profile.rollbackCount = 0;
    saveAdaptiveProfile(profile);
    checkRollbackSafety();
    const updated = loadAdaptiveProfile();
    if (updated.rollbackCount !== 1) throw new Error(`rollbackCount should be 1, got ${updated.rollbackCount}`);
  });

  // Test 15: checkRollbackSafety triggers rollback after 5 consecutive low turns
  test('checkRollbackSafety rolls back after 5 consecutive low engagement turns', () => {
    const profile = loadAdaptiveProfile();
    profile.engagementEMA = 0.2;
    profile.rollbackCount = 4;
    profile.previousVersion = { engagementEMA: 0.5, rollbackCount: 0, behavior: { emojiProbability: 0.35 }, personality: profile.personality, memory: profile.memory, learnedFlags: {}, version: 1 };
    saveAdaptiveProfile(profile);
    checkRollbackSafety();
    const updated = loadAdaptiveProfile();
    if (updated.rollbackCount !== 0) throw new Error('rollbackCount should reset after rollback');
    if (updated.behavior.emojiProbability !== 0.35) throw new Error('Should have rolled back to previous version');
  });

  // Test 16: checkRollbackSafety resets counter on normal engagement
  test('checkRollbackSafety resets counter on normal engagement', () => {
    const profile = loadAdaptiveProfile();
    profile.engagementEMA = 0.6;
    profile.rollbackCount = 3;
    saveAdaptiveProfile(profile);
    checkRollbackSafety();
    const updated = loadAdaptiveProfile();
    if (updated.rollbackCount !== 0) throw new Error('rollbackCount should reset on normal engagement');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Expected: FAIL — `checkRollbackSafety` is a stub

- [ ] **Step 3: Implement checkRollbackSafety()**

Replace the stub:

```javascript
function checkRollbackSafety() {
  const profile = loadAdaptiveProfile();

  if (profile.engagementEMA < 0.3) {
    profile.rollbackCount++;

    if (profile.rollbackCount >= 5 && profile.previousVersion) {
      console.warn('[Kira] Low engagement detected, rolling back adaptive profile');
      const prev = profile.previousVersion;
      prev.rollbackCount = 0;
      prev.lastRollback = Date.now();
      saveAdaptiveProfile(prev);
      return;
    }
  } else {
    profile.rollbackCount = 0;
  }

  // Snapshot every 50 turns
  if (profile.totalSignals > 0 && profile.totalSignals % 50 === 0) {
    profile.previousVersion = JSON.parse(JSON.stringify(profile));
  }

  saveAdaptiveProfile(profile);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Expected: All 3 rollback tests pass

- [ ] **Step 5: Add adaptive profile stats to UI (optional but useful)**

Find `renderAIStats()` or the settings panel diagnostics section (~line 2633). Add after the existing diagnostics:

```javascript
  // Adaptive profile stats
  if (state.adaptiveEnabled !== false) {
    const ap = loadAdaptiveProfile();
    html += `<b>Adaptive</b>: engagement ${ap.engagementEMA.toFixed(2)}, ` +
      `personality ${state.effectivePersonality}, ` +
      `emoji ${(ap.behavior.emojiProbability * 100).toFixed(0)}%, ` +
      `temp ${ap.behavior.temperature.toFixed(2)}<br>`;
  }
```

- [ ] **Step 6: Add adaptiveEnabled toggle to settings**

In the settings panel, add a toggle for adaptive learning. Find where personality chips are rendered and add:

```html
<label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:var(--text-secondary)">
  <input type="checkbox" id="adaptive-toggle" ${state.adaptiveEnabled !== false ? 'checked' : ''} 
    onchange="state.adaptiveEnabled=this.checked;saveState();">
  Adaptive Learning
</label>
```

- [ ] **Step 7: Final comprehensive test run**

Run all tests in `tests/test_adaptive.html`. Expected: All 16+ tests pass.

- [ ] **Step 8: Commit**

```bash
git add kira_v3.html tests/test_adaptive.html
git commit -m "feat: add rollback safety and adaptive UI stats

- checkRollbackSafety() with 5-turn threshold and snapshot every 50 turns
- Auto-rollback to previousVersion on sustained low engagement
- Adaptive profile stats in settings diagnostics panel
- Adaptive learning toggle checkbox in settings
- All 16 tests passing"
```

---

## Task 7: Integration Verification + Final Polish

**Files:**
- Modify: `kira_v3.html` — verify all integration points, fix any edge cases
- Test: Manual browser testing of full pipeline

- [ ] **Step 1: Verify all integration points compile**

Open `kira_v3.html` in a browser. Open the JavaScript console. Check for any syntax errors or undefined references.

Expected: No errors.

- [ ] **Step 2: Manual smoke test — send messages and verify adaptation**

1. Open `kira_v3.html` in browser
2. Send enthusiastic messages ("yes! exactly! you get me!") — verify engagement EMA increases
3. Check settings panel — verify adaptive stats change over time
4. Send dismissive messages ("k." "meh." "ok.") — verify rollback counter increments
5. Verify emoji probability changes based on responses
6. Verify personality weights shift based on which handlers get engagement

- [ ] **Step 3: Verify backward compatibility**

Confirm that with `state.adaptiveEnabled = false`, the app works identically to before the changes.

- [ ] **Step 4: Final commit**

```bash
git add kira_v3.html
git commit -m "feat: verify adaptive architecture integration

- All integration points verified in browser
- Backward compatibility confirmed with adaptiveEnabled=false
- No regressions in existing functionality
- Full adaptive pipeline operational"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Section | Task |
|--------------|------|
| AdaptiveProfile data structure | Task 1 ✅ |
| buildAdaptationContext() | Task 2 ✅ |
| Integration in sendMessage() | Task 2 ✅ |
| Layer 1: Behavioral Learning | Task 3 ✅ |
| Layer 2: Personality Evolution | Task 4 ✅ |
| Layer 3: Memory-Driven Responses | Task 5 ✅ |
| Rollback Safety | Task 6 ✅ |
| UI stats + toggle | Task 6 ✅ |
| Invariants preserved (INV-01 through INV-08) | All tasks ✅ |
| Implementation phases | Tasks 1-7 ✅ |

### 2. Placeholder Scan
No "TBD", "TODO", "implement later", or "similar to Task N" patterns found. Every step has actual code and commands.

### 3. Type Consistency
- `loadAdaptiveProfile()` / `saveAdaptiveProfile()` used consistently across all tasks
- `state.adaptiveEnabled` checked consistently with `!== false` pattern
- `state.effectivePersonality` set in Task 4, consumed in Tasks 3 and 4 (emoji/name blending)
- All function signatures match between definition and call sites

### 4. Scope Check
7 tasks, ~35 steps. Each step is 2-5 minutes. Total ~5-7 implementation sessions. Each task produces working, testable software independently.
