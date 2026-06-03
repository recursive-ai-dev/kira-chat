# Kira v3 — Adaptive Architecture Design

**Date:** 2026-04-06  
**Status:** Draft  
**Author:** Qwen Code  
**Reviewers:** Kira development team

---

## Summary

This document specifies a three-layer adaptive architecture for Kira v3 that enables behavioral learning, personality evolution, and memory-driven responses. All three layers share a unified reward signal (the existing `detectFeedback()` output) and use conservative exponential moving averages (EMA) for gradual drift over days/weeks of interaction. The design is fully backward compatible, adds zero neural parameters, and includes rollback safety.

---

## 1. Architecture Overview

### Shared Reward Signal

All three layers read from a single `AdaptiveProfile` object persisted in localStorage (`kira_adaptive_v1`). The profile is updated by the existing `kiraAI.feedback()` signal (+1/-1/0 from `detectFeedback()`), giving all layers a unified reward signal to optimize toward.

### Three Independent Layers

```
User Message
    ↓
detectFeedback() → signal (+1, -1, 0)
    ↓
┌─────────────────────────────────────────┐
│         AdaptiveProfile                  │
│  (shared read/write, localStorage)       │
│                                          │
│  - engagementEMA (exponential moving avg)│
│  - responseStylePreferences{}            │
│  - moodTrend[]                           │
│  - personalityDrift{}                    │
│  - learnedFlags{}                        │
│  - topicEngagement{}                     │
└────┬────────────┬────────────┬───────────┘
     │            │            │
     ▼            ▼            ▼
┌─────────┐ ┌──────────┐ ┌─────────────┐
│Behavior │ │Personality│ │  Memory     │
│Learning │ │Evolution  │ │  Driven     │
│Layer    │ │Layer      │ │  Layer      │
└────┬────┘ └─────┬────┘ └──────┬──────┘
     │            │              │
     ▼            ▼              ▼
 Adjust:      Drift:        Activate:
 - emoji prob  - personality  - topk() refs
 - resp length  - mood map    - mood trends
 - pet name freq- temp/sample - avoid repeats
 - affection    - handler     - surface mem
   sensitivity    weights        contextually
```

### Key Design Decisions

1. **Exponential Moving Averages (EMA)** — All adaptation uses EMA with low alpha (0.01–0.05). Kira's changes are gradual "drifts" over days/weeks, not sudden shifts.

2. **Read-heavy, write-rare** — The profile is read on every turn but only written when meaningful adaptation occurs (every ~10–20 turns).

3. **All layers are opt-out** — A `state.adaptiveEnabled` flag disables everything. Each individual layer also has its own toggle.

4. **No new neural parameters** — All adaptation adjusts configuration values (probabilities, weights, thresholds), not model weights. The existing MoodNet/Scorer remain untouched.

5. **Rollback safety** — The profile keeps a `previousVersion` snapshot. If engagement EMA drops below 0.3 for 5+ consecutive turns, the system rolls back.

---

## 2. AdaptiveProfile Data Structure

Single source of truth for all adaptation. Stored as `kira_adaptive_v1` in localStorage.

```javascript
const DEFAULT_ADAPTIVE_PROFILE = {
  // ── Versioning & Safety ──────────────────────────────
  version: 1,
  createdAt: null,
  lastUpdated: null,
  previousVersion: null,

  // ── Global Engagement Tracking ───────────────────────
  engagementEMA: 0.5,
  engagementStreak: 0,
  totalSignals: 0,
  positiveRatio: 0.5,

  // ── Behavioral Learning (Layer 1) ────────────────────
  behavior: {
    emojiProbability: 0.35,
    preferredResponseLength: 0.5,
    petNameProbability: 0.4,
    affectionSensitivity: 1.0,
    temperature: 0.65,
    topK: 3,
    splitResponseProbability: 0.22,
  },

  // ── Personality Evolution (Layer 2) ──────────────────
  personality: {
    currentWeights: {
      warm: 1.0,
      playful: 0.0,
      thoughtful: 0.0,
      spicy: 0.0,
    },
    moodMapOverrides: {},
    handlerEngagement: {},
    driftRate: 0.01,
  },

  // ── Memory-Driven Responses (Layer 3) ────────────────
  memory: {
    moodTrend: [],
    topicEngagement: {},
    askedTopics: [],
    avoidedPatterns: [],
    favoriteMemories: [],
    memoryRefProbability: 0.3,
    moodTrendSensitivity: 0.4,
  },

  // ── Learned Flags (General Purpose) ──────────────────
  learnedFlags: {},

  // ── Rollback Safety ──────────────────────────────────
  rollbackCount: 0,
  lastRollback: null,
};
```

**Size estimate:** 2–4KB serialized, well within localStorage limits.

---

## 3. Layer 1: Behavioral Learning

### Purpose

Makes Kira gradually adapt her response style based on what the user engages with.

### Algorithm

```
Every turn:
  1. Read signal from detectFeedback() (+1, -1, 0)
  2. Update engagementEMA: alpha * signal + (1 - alpha) * engagementEMA
  3. For each behavior parameter:
     - If signal > 0: move parameter toward observed behavior
     - If signal < 0: move parameter away from observed behavior
     - If signal == 0: no change
  4. Clamp all parameters to min/max bounds
  5. Save profile (debounced: every 10 turns)
```

### Parameter Adaptation

| Parameter | Default | Alpha | Range | Adapts To |
|-----------|---------|-------|-------|-----------|
| `emojiProbability` | 0.35 | 0.05 | [0.1, 0.8] | User response to emojis |
| `preferredResponseLength` | 0.5 | 0.03 | [0.1, 0.9] | User's typical message length |
| `petNameProbability` | 0.4 | 0.05 | [0.1, 0.7] | User engagement with endearments |
| `affectionSensitivity` | 1.0 | 0.02 | [0.3, 2.0] | How quickly affection should grow |
| `temperature` | 0.65 | 0.01 | [0.3, 1.0] | Preference for variety vs consistency |
| `topK` | 3 | N/A | [2, 5] | Candidate pool size preference |
| `splitResponseProbability` | 0.22 | 0.02 | [0.05, 0.5] | Preference for multi-part responses |

### Integration Points

| Location | Current | After |
|----------|---------|-------|
| `maybeEmoji()` | `chance(0.35)` | `chance(profile.behavior.emojiProbability)` |
| `namePrefix()` | `chance(0.4)` | `chance(profile.behavior.petNameProbability)` |
| `addAffection()` | `state.affection += n` | `state.affection += n * profile.behavior.affectionSensitivity` |
| `kiraAI.rank()` | `T = 0.65, K = 3` | `T = profile.behavior.temperature, K = profile.behavior.topK` |
| `sendMessage()` | — | `if (chance(profile.behavior.splitResponseProbability)) splitResponse()` |

### Safeguards

- All parameters have hard min/max bounds
- No single update moves a parameter more than 5% of its range
- If `engagementEMA < 0.3` for 5+ turns → triggers rollback

---

## 4. Layer 2: Personality Evolution

### Purpose

Kira's personality drifts toward whatever produces the best engagement with the user, rather than staying locked to a manually-selected setting.

### Algorithm

```
Every turn:
  1. Read signal and current route (which handler was called)
  2. Update handlerEngagement[route] via EMA
  3. Map handler to associated personality traits
  4. If signal > 0: boost associated traits by driftRate
  5. Decay all weights slightly toward equilibrium (0.25 each)
  6. Normalize weights to sum to 1.0
  7. Derive effectivePersonality from dominant weight
  8. Adapt moodMapOverrides based on signal + mood
  9. Save profile (debounced: every 20 turns)
```

### Personality Blend

`state.personality` (user-selected) is never overwritten. Instead, `state.effectivePersonality` is derived from the dominant weight:

```
if (max(weights) > 0.4) effectivePersonality = dominantTrait
else effectivePersonality = state.personality
```

### Handler → Personality Mapping

| Handler | Associated Traits |
|---------|-------------------|
| `handleFlirt` | spicy, playful |
| `handleBored` | playful |
| `handleOpinion` | thoughtful |
| `handleGreeting` | warm |
| `handleUserFeelsBad` | warm, thoughtful |
| `handleAdviceRequest` | thoughtful |
| `handleHypothetical` | thoughtful |
| `handleGoodNews` | warm, playful |
| `handleSurpriseMe` | thoughtful, playful |
| `handleGeneral` | neutral (no boost) |

### Mood Map Learning

The current static mood→Kira-mood map becomes adaptive:

```javascript
// Default (static)
happy: ['happy', 'affectionate'],
sad: ['worried', 'affectionate'],

// After learning (overrides)
moodMapOverrides: {
  happy: { playful: 0.4, happy: 0.3, affectionate: 0.3 },
  sad: { affectionate: 0.5, worried: 0.3, thoughtful: 0.2 },
}
```

Overrides are applied in `updateHerMood()` before the default mapping.

### Integration Points

| Location | Current | After |
|----------|---------|-------|
| `sendMessage()` | — | `adaptPersonality(route, signal, context)` |
| `maybeEmoji()` | `P().emojis[state.personality]` | Blended pools weighted by `personality.currentWeights` |
| `getName()` | `P().terms[state.personality]` | Blended endearment pools |
| `updateHerMood()` | Static map | Applies `moodMapOverrides` if they exist |
| `handleFlirt()` | Checks `state.personality === 'spicy'` | Checks `state.effectivePersonality` |

### Safeguards

- `driftRate` starts at 0.01 — ~100 turns for full personality shift
- Decay toward equilibrium prevents domination
- User-selected `state.personality` is never overwritten
- Rollback resets personality weights if engagement drops

---

## 5. Layer 3: Memory-Driven Responses

### Purpose

Activates dead code (`topk()`, `userMoods[]`, `askedAbout`) to make Kira genuinely reference past conversations, detect mood trends, and avoid repetition.

### 5a. Memory Reference Activation (NM-05)

The existing `AttentionMem.topk()` computes similar past conversations but no handler consumes them. This layer fixes that.

```
In handleGreeting() and handleGeneral():
  1. Read _aiCtx.similar (already computed)
  2. Find best match with sim > 0.55
  3. Check if memory has positive engagement association
  4. If yes (30% chance) or if very positive (sim > 0.7):
     - Generate memory reference from template
     - Prepend to response with line break
  5. Update favoriteMemories with engagement score
```

**Templates:**
- `"Still thinking about what you said before: \"{memory_text}..."`
- `"You mentioned something similar last time — \"{memory_text}..." — has that shifted?"`
- `"I keep coming back to what you said: \"{memory_text}..." It stayed with me.`

### 5b. Mood Trend Detection

```
In generateResponse():
  1. Read profile.memory.moodTrend (appended each turn)
  2. If trend.length >= 10:
     - Count mood frequencies over last 30 entries
     - If one mood > 40%: detect trend
  3. If trend detected:
     - Sad trend → more empathetic language, check in
     - Happy trend → more playful, celebratory
     - Anxious trend → more grounding, reassuring
     - Flirty trend → slightly more flirtatious responses
```

**Integration:** Mood trend influences handler candidate pool weighting and adds a "trend-aware" clause to select handlers (e.g., if user has been sad 45% of last 30 interactions, boost `handleUserFeelsBad` candidates).

### 5c. Topic Engagement & Repetition Avoidance

```
In detectTopics() and handleTopicResponse():
  1. Update topicEngagement[topic] via EMA based on signal
  2. Track askedTopics (last 20 topics Kira asked about)
  3. In handleTopicResponse():
     - Filter out topics with engagement < 0.3
     - Prefer topics with engagement > 0.6
     - Avoid recently-asked topics
```

### Integration Points

| Location | Current | After |
|----------|---------|-------|
| `kiraAI.process()` | `_aiCtx.similar` computed, unused | Consumed by `generateMemoryReference()` |
| `handleGreeting()` | Static pool | May prepend memory reference |
| `handleGeneral()` | Static pool | May prepend memory reference, checks mood trend |
| `handleTopicResponse()` | All topics equal | Filters low-engagement topics |
| `detectTopics()` | Counts only | Updates `topicEngagement` scores |
| `updateHerMood()` | Static map | Influenced by mood trend detection |

### Safeguards

- Memory references only for `sim > 0.55`
- Memory text truncated to 40 characters
- Mood trends require minimum 10 data points
- Topic avoidance is temporary (20 most recent, then forgotten)

---

## 6. Integration & Rollback Safety

### Integration Point: `sendMessage()`

Three new calls after existing `kiraAI.feedback()`:

```javascript
function sendMessage(text) {
  // ... existing code ...
  
  const signal = detectFeedback(text);
  const regexMoodNow = detectUserMoodRegex(text);
  const regexIdx = MOOD_LABELS.indexOf(regexMoodNow);
  kiraAI.feedback(signal, regexIdx);
  
  // NEW: Adaptive layers
  const route = DIAG.lastRoute;
  const context = buildAdaptationContext(text, route);
  
  adaptBehavior(signal, context);           // Layer 1
  adaptPersonality(route, signal, context); // Layer 2
  adaptMemory(signal, detectTopics(text));  // Layer 3
  
  checkRollbackSafety();
  
  // ... rest of existing code ...
}
```

### Context Builder

```javascript
function buildAdaptationContext(text, route) {
  return {
    textLength: text.length,
    hadEmoji: /[✨💕🔥💋💛💜💙🥀😏😘🥺🤍🌟💫🌙🌌😈💦]/.test(text),
    route: route,
    topics: detectTopics(text),
    userMood: _aiCtx.mood,
    hadPetName: /\b(sweetie|hon|babe|love|dork|cutie|trouble|darling|my dear|gorgeous|handsome)\b/i.test(text),
    wasQuestion: text.trim().endsWith('?'),
    timeOfDay: getTimeOfDay(),
  };
}
```

### Rollback Safety

```
Every turn:
  1. If engagementEMA < 0.3:
     - Increment rollbackCount
     - If rollbackCount >= 5:
       - Restore profile.previousVersion
       - Reset rollbackCount to 0
       - Record lastRollback timestamp
  2. Else:
     - Reset rollbackCount to 0
  3. Every 50 turns:
     - Snapshot profile to previousVersion
```

### Guarantees

1. **Self-correcting** — If Kira starts acting worse, rollback within ~5 turns
2. **No catastrophic failure** — Worst case is reverting to default profile
3. **User personality never overwritten** — Only `effectivePersonality` adapts
4. **All adaptation logged** — To trace system for debugging
5. **Can be disabled** — `state.adaptiveEnabled = false`

### localStorage Keys

| Key | Contents | Size |
|-----|----------|------|
| `kira_state_v3` | Main conversation state | ~5–50KB |
| `kira_ai_v3` | Neural model weights | ~10KB |
| `kira_adaptive_v1` | **NEW** — adaptive profile | ~2–4KB |

### Migration

- `loadAdaptiveProfile()` merges defaults with stored profile on boot
- Missing fields get defaults
- Version field enables future schema migrations
- First run: all defaults, no adaptation until sufficient data

---

## 7. Implementation Phases

### Phase 1: Infrastructure (Priority: Highest)
- Add `AdaptiveProfile` data structure and persistence
- Add `loadAdaptiveProfile()` / `saveAdaptiveProfile()`
- Add `buildAdaptationContext()` helper
- Add `state.adaptiveEnabled` flag
- Wire up `sendMessage()` to call all three adaptation functions (no-op initially)
- Add `checkRollbackSafety()`

### Phase 2: Behavioral Learning (Layer 1)
- Implement `adaptBehavior()` with all parameter updates
- Update `maybeEmoji()` to read from profile
- Update `namePrefix()` to read from profile
- Update `addAffection()` to apply sensitivity multiplier
- Update `kiraAI.rank()` to use adaptive temperature/topK
- Test parameter bounds and EMA convergence

### Phase 3: Personality Evolution (Layer 2)
- Implement `adaptPersonality()` with handler engagement tracking
- Derive `state.effectivePersonality` from weights
- Update `maybeEmoji()` to blend pools
- Update `getName()` to blend endearments
- Implement `moodMapOverrides` learning
- Update `updateHerMood()` to apply overrides
- Test personality drift over simulated conversations

### Phase 4: Memory-Driven Responses (Layer 3)
- Implement `generateMemoryReference()` using `_aiCtx.similar`
- Integrate memory references into `handleGreeting()` and `handleGeneral()`
- Implement `detectMoodTrend()` and mood trend influence on handler selection
- Implement topic engagement tracking in `detectTopics()`
- Add repetition avoidance to `handleTopicResponse()`
- Test memory reference quality and mood trend detection

### Phase 5: Polish & Testing
- Run extended conversation simulations
- Verify rollback safety under negative feedback scenarios
- Test all parameter bounds and convergence
- Verify no regression in existing functionality
- Add UI indicator showing adaptive profile state (optional)

---

## 8. System Invariants

| ID | Invariant | Preserved By This Design |
|----|-----------|--------------------------|
| INV-01 | `state.affection` in [0, 1000] | Yes — `affectionSensitivity` is a multiplier but result still clamped |
| INV-02 | `AttentionMem` entries max 20 | Yes — no changes to MEM_CAP |
| INV-03 | `state.chatHistory` max 200 | Yes — no changes |
| INV-04 | `generateResponse()` returns non-empty string | Yes — adaptation only affects candidate selection, not return guarantee |
| INV-05 | Model dimensions locked | Yes — zero changes to EDIM, VOCAB, N_MOODS |
| INV-06 | Relationship stage thresholds | Yes — no changes to stage logic |
| INV-07 | localStorage keys | Yes — adds new key, doesn't modify existing ones |
| INV-08 | Zero network calls | Yes — all adaptation is local computation |

---

## 9. Future Extensions

1. **Learning from feedback** — Track which generated sentence engine responses get positive reactions
2. **Template evolution** — Add/remove sentence engine templates based on usage patterns
3. **Word association** — Build co-occurrence matrix from user's own vocabulary
4. **Multi-sentence generation** — Chain templates for longer responses
5. **Style adaptation** — Mirror user's sentence structure and word choices
6. **Well-being detection** — Use mood trends to detect prolonged negative states and respond with extra care

---

## 10. Files Changed

| File | Change | Lines |
|------|--------|-------|
| `kira_v3.html` | Add adaptive architecture | ~500-700 |
| `docs/superpowers/specs/2026-04-06-adaptive-architecture-design.md` | This document | — |

---

**System Idempotency Index:** Expected to decrease from 0.91 to ~0.85 due to adaptive variance, but rollback safety and conservative EMA rates minimize drift.

**End of Document**
