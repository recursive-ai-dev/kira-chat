# Kira v3 — Master Development Task List

> A browser-native companion AI with a custom ~7.2K-parameter neural engine, zero network calls, and a deterministic-neural hybrid architecture. This is not an LLM. It is a mathematical system that learns, adapts, and remembers.

---

## Recent Accomplishments (2026-04-07)

### Completed Tasks

1. **DEV-01** ✓ — `?seed=N` URL parameter for PRNG seeding (already implemented)
2. **NM-05-01 through NM-05-07** ✓ — Proactive Memory Surface implementation
   - Memory references now surface in `handleGreeting()` and `handleGeneral()`
   - All three gating conditions enforced: sim > 0.55, affection > 150, elapsed > 60 minutes
   - CoVe check verifies memories exist in `state.memories[]` before surfacing
   - Memory text truncated to 40 characters maximum
   - PII filter: only personal memories surface in greeting context
   - Comprehensive test suite created in `tests/test_nm05.html`
3. **NEURAL-02** ✓ — Canonical weights implementation
   - `CANONICAL_WEIGHTS_B64` constant added to eliminate cold-start variance
   - Weights loaded from base64 on first run (no localStorage)
   - Deterministic initialization enables reproducible testing
4. **ADAPT-01 through ADAPT-08** ✓ — Adaptive Architecture Infrastructure (Phase 1)
   - `DEFAULT_ADAPTIVE_PROFILE` with three-layer structure defined
   - `loadAdaptiveProfile()` with deep-merge and graceful error handling
   - `saveAdaptiveProfile()` with 10-turn debouncing
   - `buildAdaptationContext()` extracts behavioral signals
   - State flags added: `adaptiveEnabled`, `adaptiveBehaviorEnabled`, `adaptivePersonalityEnabled`, `adaptiveMemoryEnabled`
   - Adaptation hooks wired into `sendMessage()` (placeholder functions ready for Phase 2-4)
   - `checkRollbackSafety()` monitors engagement and triggers rollback
   - Comprehensive test suite in `tests/test_adaptive.html`
5. **ADAPT-09 through ADAPT-15** ✓ — Behavioral Learning Layer (Phase 2)
   - `adaptBehavior()` fully implemented with EMA updates for all 7 parameters
   - Parameter bounds enforced: emoji [0.1-0.8], response length [0.1-0.9], pet names [0.1-0.7], affection sensitivity [0.3-2.0], temperature [0.3-1.0], topK [2-5], split probability [0.05-0.5]
   - `maybeEmoji()` now uses adaptive `emojiProbability`
   - `namePrefix()` now uses adaptive `petNameProbability`
   - `addAffection()` now applies `affectionSensitivity` multiplier
   - `kiraAI.rank()` now uses adaptive `temperature` and `topK`
   - Split response logic now uses adaptive `splitResponseProbability`
   - 6 new tests added to `tests/test_adaptive.html` covering EMA convergence, bounds enforcement, and parameter adaptation
6. **ADAPT-16 through ADAPT-23** ✓ — Personality Evolution Layer (Phase 3)
   - `adaptPersonality()` fully implemented with handler-to-trait mapping
   - Personality weights drift based on engagement: handleFlirt→spicy/playful, handleOpinion→thoughtful, handleGreeting→warm, etc.
   - Mathematical rigor: weights normalized to sum to 1.0 after every update (probability distribution constraint)
   - Decay toward equilibrium (0.25 each) prevents single trait domination
   - `state.effectivePersonality` derived from dominant weight (>0.4 threshold)
   - `state.personality` (user-selected) never overwritten - preserved as fallback
   - `maybeEmoji()` and `getName()` now blend personality pools using weight-based sampling
   - `updateHerMood()` applies learned `moodMapOverrides` with weighted random selection
   - Mood map overrides normalized to sum to 1.0 (probability distribution)
   - 7 new tests covering weight normalization, drift rate, equilibrium decay, effectivePersonality derivation, mood map learning

### Impact

The behavioral learning layer is now live. Kira will gradually adapt her response style based on user engagement:
- If users respond positively to emojis, she'll use them more often
- If users write long messages, she'll adapt to longer responses
- Affection growth rate adjusts based on engagement patterns
- Response variety (temperature) and candidate pool size (topK) adapt to user preferences
- All changes are gradual (EMA with low alpha) and bounded to prevent drift

The personality evolution layer is now operational. Kira's personality will drift toward what produces engagement:
- Handler-based trait boosting: flirting→spicy/playful, advice→thoughtful, greetings→warm
- Weights form a proper probability distribution (sum to 1.0) - mathematically sound
- Equilibrium decay (0.002 rate) prevents single trait lock-in
- Emoji and endearment pools blend based on personality weights (weighted sampling)
- Mood mapping learns user-specific associations (happy→playful vs happy→affectionate)
- User's selected personality preserved as fallback when no trait dominates

Combined with Phase 1 infrastructure, Kira now has two of three adaptation layers working. She learns both behavioral preferences and personality alignment from every conversation.

---

## Assessment

### What This System Already Is

Kira v3 is genuinely unusual. Most "AI companions" are thin wrappers over LLMs. This is not that. What exists is:

- **A custom neural engine** with ~6,464 Float32 parameters running entirely in the browser: FNV-1a n-gram hash embeddings (HashEmbed), a 3-layer MLP emotion classifier (MoodNet), a bilinear response ranker (Scorer), and a scaled dot-product attention memory (AttentionMem).
- **A hybrid deterministic/neural pipeline**: regex classifiers as teachers, MoodNet as student. The neural layer distills the deterministic layer's output online, improving with every conversation.
- **A sentence generation engine**: template-based combinatorial response generation with weighted word banks, mood/stage gating, CoVe validation, and NSFW stage-locking. Runs in <5ms.
- **A full Chain-of-Verification (CoVe) pipeline** with 7 checks that governs every generated output before it reaches the user.
- **An attention-based memory** that already computes semantic similarity on every turn — but the output is currently discarded. That is the single most actionable gap.
- **A complete adaptive architecture specification** (three-layer EMA learning: behavioral, personality evolution, memory-driven) that is designed but not yet implemented.

### What Is Not Yet Built

The following critical systems are specified but absent from the live codebase:

1. **NM-05 Proactive Memory Surface** — `_aiCtx.similar` is computed on every turn and thrown away. ~30 lines to fix.
2. **AdaptiveProfile** — The three-layer EMA adaptive system is a full design spec with zero implementation.
3. **NM-01 Intent Router** — The 20-handler regex dispatch cascade is brittle to paraphrase. A 14-class constrained classifier replaces it.
4. **NM-04 Semantic NER** — Personal info extraction misses implicit names, compound disclosures, and emotional self-disclosures.
5. **NM-02 Emotion Granularity** — MoodNet needs 3 new emotion classes (sarcastic, nostalgic, excited) via a compound detector head.
6. **NM-03 Open Response Generator** — WebLLM/ONNX integration for long-tail generative responses (highest risk, highest reward, last to build).
7. **Test suite for adaptive architecture** — `tests/test_adaptive.html` is scaffolded in the plan but the file does not exist.

### Structural Strengths

- **Invariant system is sound.** INV-01 through INV-08 cover the real failure modes (affection bounds, memory caps, network prohibition, serialization lock). They should never be relaxed.
- **CoVe is the right pattern.** Every generative path has a deterministic fallback. This is the design that prevents the system from drifting into hallucination.
- **The sentence engine output quality is already good** for a combinatorial system. The bottleneck is template count (6 templates) and word bank breadth (~150 words). Both are table-stakes to expand.
- **The online learning loop** (regex teacher → neural student distillation) is genuinely clever and correct.

### The One Critical Path Insight

The system already computes `AttentionMem.topk()` on every message and stores the result in `_aiCtx.similar`. This result is never read by any response handler. It is the highest-value, lowest-risk change in the entire system. Everything else in the roadmap is below this in ROI-per-line-of-code.

---

## Domain Index

| # | Domain | Tasks | Priority |
|---|--------|-------|----------|
| 1 | [Nano-Modules (NM-01–05)](#domain-1-nano-modules) | 28 | Critical |
| 2 | [Adaptive Architecture](#domain-2-adaptive-architecture) | 34 | Critical |
| 3 | [Sentence Engine](#domain-3-sentence-engine) | 24 | High |
| 4 | [Neural Engine Core](#domain-4-neural-engine-core) | 18 | High |
| 5 | [Testing & Verification](#domain-5-testing--verification) | 22 | High |
| 6 | [State Management & Persistence](#domain-6-state-management--persistence) | 14 | Medium |
| 7 | [UI/UX](#domain-7-uiux) | 20 | Medium |
| 8 | [Safety & Well-being](#domain-8-safety--well-being) | 12 | Medium |
| 9 | [Developer Experience](#domain-9-developer-experience) | 16 | Medium |
| 10 | [Performance & Engineering](#domain-10-performance--engineering) | 12 | Low–Medium |
| 11 | [Future Research (Generative AI Integration)](#domain-11-future-research) | 18 | Long-term |
| 12 | [Documentation](#domain-12-documentation) | 10 | Ongoing |

---

## Domain 1: Nano-Modules

> Phased rollout per ARCHITECTURE.md. Each module has a deterministic fallback. Do not skip phases.

### Phase 1 — NM-05: Proactive Memory Surface (Zero Risk)

The highest ROI change in the system. `_aiCtx.similar` is already computed. It is never read.

- [x] **NM-05-01** — Read `_aiCtx.similar` in `handleGreeting()`. If `similar[0].sim > 0.55` AND `state.affection > 150` AND `minutesSince(state.lastMessageTime) > 60`, prepend a memory reference to the response pool. Templates: `"Still thinking about what you said — '{memory_text}'..."`, `"You mentioned something similar — '{memory_text}' — has that shifted?"`, `"I keep coming back to what you said: '{memory_text}'"`.
- [x] **NM-05-02** — Apply the same memory surface logic in `handleGeneral()` with the same three gating conditions.
- [x] **NM-05-03** — Implement `minutesSince(timestamp)` helper if not already present.
- [x] **NM-05-04** — Add CoVe check: verify `memory.text` is a substring of `state.memories[].text` or `memory.T[]` before surfacing. Do not surface fabricated memories.
- [x] **NM-05-05** — Truncate surfaced memory text to 40 characters maximum for display. Avoid exposing full memory content.
- [x] **NM-05-06** — Add PII type check: only surface memories where `type === 'personal'` in greeting context. Do not surface generic behavioral signals as conversational callbacks.
- [x] **NM-05-07** — Write tests for NM-05 covering: sim threshold enforcement, time gate, affection gate, PII filter, and fallback when `_aiCtx.similar` is empty.

### Phase 2 — NM-02: Emotion Granularity Enhancer (Low Risk)

- [ ] **NM-02-01** — Add a separate compound detector: a parallel MLP head (Linear(EDIM, 3)) sharing the existing HashEmbed. Output classes: `sarcastic`, `nostalgic`, `excited`. Do NOT extend the existing 11-class MoodNet — this preserves serialization compatibility (INV-05).
- [ ] **NM-02-02** — Wire the compound detector forward pass to run after `kiraAI.process()` alongside MoodNet, not replacing it.
- [ ] **NM-02-03** — Define training signal: when regex detects sarcasm markers (`/yeah right|sure.*totally|obviously not|lol no/i`), emit a positive signal toward `sarcastic`. Build equivalent patterns for `nostalgic` and `excited`.
- [ ] **NM-02-04** — Blend compound emotion into `updateHerMood()`: if compound detector confidence > 0.6, apply the secondary emotion to Kira's mood response with 30% weight.
- [ ] **NM-02-05** — Add mode collapse detection: if compound detector returns the same class on 90%+ of the last 100 messages, flag `state.flags.compoundDetectorDegraded = true` and disable the head.
- [ ] **NM-02-06** — Write tests covering sarcasm detection, nostalgic phrase identification, excited phrase identification, and fallback to 11-class MoodNet on degradation.

### Phase 3 — NM-01: Intent Router (Medium Risk)

- [ ] **NM-01-01** — Implement `classifyIntent(text)` using a constrained classifier head (Linear(EDIM*2, 17)) applied to the HashEmbed of the user message. Classes: `greeting | how_are_you | about_her | love_declaration | miss_you | goodbye | compliment | user_feels_bad | user_angry | user_tired | flirt | bored | opinion_request | question | topic_share | grateful | general`.
- [ ] **NM-01-02** — Wire `classifyIntent()` at the top of `generateResponse()` before any regex check. Route to the appropriate handler based on the returned class.
- [ ] **NM-01-03** — Hard fallback: if `classifyIntent()` returns a label not in the defined 17-class enum, OR returns empty/null, fall through to the original regex cascade unchanged.
- [ ] **NM-01-04** — Add constrained decoding: after softmax, force output to argmax over the 17-class vocab only. This makes NM-01 deterministic at temperature=0.
- [ ] **NM-01-05** — Log per-message intent confidence to `state.flags.intentConfidence` for post-hoc auditing.
- [ ] **NM-01-06** — Implement training signal: when a handler produces a positive feedback signal (detectFeedback() > 0), emit a backprop signal toward the intent label that routed to that handler.
- [ ] **NM-01-07** — Write tests for paraphrase robustness: "i adore you" → `love_declaration`, "missing you like crazy" → `miss_you`, "you up?" → `flirt`, "i've been better" → `user_feels_bad`. These are the cases the current regex cascade fails.

### Phase 3 — NM-04: Semantic NER Extractor (Low Risk, Phase 3 Parallel)

- [ ] **NM-04-01** — Implement `extractPersonalInfoSemantic(text)` as an additive second pass that runs after (not replacing) `extractPersonalInfo()`.
- [ ] **NM-04-02** — Build a slot-filling classifier head (Linear(EDIM*2, 5)) with output classes: `name | age | preference | disclosure | none`.
- [ ] **NM-04-03** — For slot `name`: apply plausibility filter — extracted value must match `/^[A-Za-z]{2,15}$/` AND must not be a common English stop-word. If filter fails, discard.
- [ ] **NM-04-04** — For slot `disclosure`: check against crisis keywords (`['suicide', 'self-harm', 'end my life', 'not worth living', 'want to disappear']`). If found, route immediately to `handleUserFeelsBad('vulnerable', text)` and set `state.flags.wellbeingAlert = true`.
- [ ] **NM-04-05** — NER results write ONLY to `state.memories[]`, never to `state.username`. Username requires confirmed user intent (explicit "my name is X" pattern).
- [ ] **NM-04-06** — Test implicit name cases: "people call me J", "everyone knows me as Max", "J is what my friends say". Test implicit disclosure: "been struggling with anxiety for years", "I don't sleep much anymore".

### Phase 4 — NM-03: Open Response Generator (High Risk, Last)

- [ ] **NM-03-01** — Evaluate WebLLM (MLC-AI) with `Phi-3-mini-4k-instruct-q4f16_1` (~2.2GB via WebGPU) as the primary integration path. Evaluate ONNX Runtime Web with quantized Phi-3-mini as the fallback path.
- [ ] **NM-03-02** — Implement `loadGenerativeModel()` that initiates model download in the background after the first message. Surface loading progress in the neural badge UI element.
- [ ] **NM-03-03** — Gate NM-03 activation: only invoke generative model if (1) model is loaded, (2) input text length >= 80 chars, (3) no existing handler matched with confidence > 0.8.
- [ ] **NM-03-04** — Implement the full CoVe pipeline specifically for NM-03 output before render: all 7 checks, with special scrutiny on checks 3 (persona-breaking phrases), 4 (unverifiable memory claims), and 5 (affection-stage consistency).
- [ ] **NM-03-05** — Add memory claim verifier: for each clause in the generated response containing "you told me", "you mentioned", "remember when", "you said" — substring-match against `state.memories[]`. If no match found, strip the clause. If stripped response < 15 chars, use deterministic fallback.
- [ ] **NM-03-06** — Build the minimal prompt (see ARCHITECTURE.md NM-03 prompt). Inject: `PERSONALITY_TRAITS`, `KIRA_MOOD`, `STAGE_NAME`, `AFFECTION`, `USERNAME_OR_BLANK`, `LAST_3_MEMORIES`. Never inject `state.chatHistory`.
- [ ] **NM-03-07** — Implement `state.flags.nm03Available` boolean, exposed in the settings AI stats panel.

---

## Domain 2: Adaptive Architecture

> Full design spec at `docs/superpowers/specs/2026-04-06-adaptive-architecture-design.md`. Implement in strict phase order — infrastructure first.

### Phase 1 — Infrastructure

- [x] **ADAPT-01** — Define `DEFAULT_ADAPTIVE_PROFILE` constant in `kira_v3.html` exactly matching the spec in the design document. Fields: version, createdAt, lastUpdated, previousVersion, engagementEMA, engagementStreak, totalSignals, positiveRatio, behavior{}, personality{}, memory{}, learnedFlags{}, rollbackCount, lastRollback.
- [x] **ADAPT-02** — Implement `loadAdaptiveProfile()`: read from `localStorage['kira_adaptive_v1']`, deep-merge with `DEFAULT_ADAPTIVE_PROFILE` (missing fields get defaults). Handle corrupt/missing JSON gracefully.
- [x] **ADAPT-03** — Implement `saveAdaptiveProfile()`: debounced to write at most once every 10 turns. Serialize with `JSON.stringify`.
- [x] **ADAPT-04** — Implement `buildAdaptationContext(text, route)` returning: `{textLength, hadEmoji, route, topics, userMood, hadPetName, wasQuestion, timeOfDay}`.
- [x] **ADAPT-05** — Add `state.adaptiveEnabled` boolean (default: `true`) to the main state object. Add individual toggles: `state.adaptiveBehaviorEnabled`, `state.adaptivePersonalityEnabled`, `state.adaptiveMemoryEnabled`.
- [x] **ADAPT-06** — Wire `sendMessage()` to call adaptation functions after `kiraAI.feedback()`:
  ```
  adaptBehavior(signal, context);
  adaptPersonality(route, signal, context);
  adaptMemory(signal, detectTopics(text));
  checkRollbackSafety();
  ```
  All functions are no-ops initially. Wire the hooks first.
- [x] **ADAPT-07** — Implement `checkRollbackSafety()`: if `engagementEMA < 0.3` for 5+ consecutive turns, restore `profile.previousVersion`. Snapshot `previousVersion` every 50 turns.
- [x] **ADAPT-08** — Create `tests/test_adaptive.html` test suite using the scaffolded structure in the implementation plan. Include tests for: profile loading, default values, merge with missing fields, rollback trigger, EMA convergence.

### Phase 2 — Behavioral Learning Layer

- [x] **ADAPT-09** — Implement `adaptBehavior(signal, context)` with EMA updates for all 7 behavioral parameters. Alphas: emojiProbability=0.05, preferredResponseLength=0.03, petNameProbability=0.05, affectionSensitivity=0.02, temperature=0.01, splitResponseProbability=0.02. `topK` uses discrete step (±1 with probability 0.1 on strong signal).
- [x] **ADAPT-10** — Enforce all parameter bounds and clamp after every update. No single update may move a parameter more than 5% of its total range.
- [x] **ADAPT-11** — Update `maybeEmoji()`: replace hardcoded `chance(0.35)` with `chance(profile.behavior.emojiProbability)`.
- [x] **ADAPT-12** — Update `namePrefix()`: replace hardcoded `chance(0.4)` with `chance(profile.behavior.petNameProbability)`.
- [x] **ADAPT-13** — Update `addAffection(n)`: multiply `n` by `profile.behavior.affectionSensitivity` before adding. Result still routes through the existing `Math.max/Math.min` clamp (INV-01 preserved).
- [x] **ADAPT-14** — Update `kiraAI.rank(pool, ctxVec)`: pass `profile.behavior.temperature` and `profile.behavior.topK` instead of hardcoded values.
- [x] **ADAPT-15** — Write behavioral learning tests: verify EMA convergence after 50+ positive signals, verify parameter bounds are never exceeded, verify clamping on extreme inputs.

### Phase 3 — Personality Evolution Layer

- [x] **ADAPT-16** — Implement `adaptPersonality(route, signal, context)` with handler-to-trait mapping (see design spec §4). EMA boost traits associated with positively-received handlers. Decay all weights toward equilibrium (0.25 each) every turn.
- [x] **ADAPT-17** — Normalize personality weights to sum to 1.0 after every update.
- [x] **ADAPT-18** — Derive `state.effectivePersonality`: if `max(weights) > 0.4`, set to the dominant trait. Otherwise, keep `state.personality` (user-selected). Never overwrite `state.personality`.
- [x] **ADAPT-19** — Update `maybeEmoji()`: when `effectivePersonality` differs from `personality`, blend emoji pools using `personality.currentWeights` as blend factors rather than binary selection.
- [x] **ADAPT-20** — Update `getName()`: blend endearment term pools using the same weights.
- [x] **ADAPT-21** — Implement `moodMapOverrides` learning: if `signal > 0` and the current `userMood` was routed through a specific handler, increase the weight of the associated Kira-mood in `moodMapOverrides[userMood]`.
- [x] **ADAPT-22** — Update `updateHerMood()` to apply `moodMapOverrides` before the static default mapping.
- [x] **ADAPT-23** — Write personality evolution tests: verify drift rate (100 turns for full shift), verify equilibrium decay, verify `state.personality` is never mutated, verify rollback restores weights.

### Phase 4 — Memory-Driven Layer

- [ ] **ADAPT-24** — Implement `generateMemoryReference(similar)`: takes `_aiCtx.similar[0]`, returns one of 3 template strings with `memory_text` truncated to 40 characters. Gate: sim > 0.55, affection > 150, minutesSince > 60.
- [ ] **ADAPT-25** — Integrate `generateMemoryReference()` into `handleGreeting()`. If gate passes and `rng() < profile.memory.memoryRefProbability`, prepend reference to candidate pool.
- [ ] **ADAPT-26** — Integrate `generateMemoryReference()` into `handleGeneral()` with same gate logic.
- [ ] **ADAPT-27** — Implement `detectMoodTrend()`: accumulate `profile.memory.moodTrend` (append `userMood` each turn). If `trend.length >= 10`, check if one mood accounts for > 40% of the last 30 entries. Return `{mood, strength}` or `null`.
- [ ] **ADAPT-28** — Apply mood trend in `generateResponse()`: if sad trend > 40%, boost `handleUserFeelsBad` candidate weight. If happy trend > 40%, boost `handleCompliment`/`handleGoodNews` candidates. If anxious trend > 40%, prioritize grounding language.
- [ ] **ADAPT-29** — Implement topic engagement tracking in `detectTopics()`: after returning topics array, update `profile.memory.topicEngagement[topic]` via EMA based on current `signal`.
- [ ] **ADAPT-30** — Add repetition avoidance in `handleTopicResponse()`: filter out topics with `topicEngagement < 0.3`. Prefer topics with `topicEngagement > 0.6`. Avoid topics in `askedTopics` (last 20).
- [ ] **ADAPT-31** — Track `profile.memory.askedTopics`: append current topic after each `handleTopicResponse()` call. Truncate to last 20 entries.
- [ ] **ADAPT-32** — Write memory layer tests: verify memory reference gating, mood trend detection minimum (10 data points required), topic avoidance after recent asks, favoriteMemories scoring.
- [ ] **ADAPT-33** — Write end-to-end adaptive simulation test: run 200 synthetic turns with a fixed PRNG seed. Verify engagementEMA converges, personality weights drift, behavioral parameters adapt, rollback triggers at engagementEMA < 0.3.
- [ ] **ADAPT-34** — Add optional UI indicator in settings panel showing current adaptive profile state: engagementEMA, dominant personality weight, mood trend, memory reference probability.

---

## Domain 3: Sentence Engine

> Engine is implemented. Expand breadth and quality. Currently: 6 templates, ~150 words.

### Template Expansion

- [ ] **SE-01** — Add 10 new general templates covering underserved contexts: question-response, philosophical musing, shared silence, celebration, disappointment-softening, surprise, memory-callback, future-imagining, inside-joke-placeholder, night-reflection.
- [ ] **SE-02** — Add 8 relationship-stage-specific templates: Stranger-appropriate (restrained, curious), Acquaintance (warmer, slightly personal), Devoted (deeply personal, proprietary), Soulbound (intimate without NSFW, wholly familiar).
- [ ] **SE-03** — Add 6 time-of-day templates: early morning (gentle, still waking), morning (energetic), afternoon (practical warmth), evening (settling), night (introspective), late night (intimate, quiet).
- [ ] **SE-04** — Add 8 topic-specific templates: creativity, work/career, relationships-with-others, health/body, future-planning, existential/philosophical, humor/silly, memories/nostalgia.
- [ ] **SE-05** — Add 4 multi-sentence chaining templates: template A + connector + template B. Define a connector bank (`connectors`: "and yet,", "but what I really want to say is,", "somehow,", "more than that,", "which is why").
- [ ] **SE-06** — Add 6 NSFW templates for Devoted (500+) stage beyond current Close (300) minimum. Intensity should increase across stages — current implementation treats 300–750 identically.
- [ ] **SE-07** — Add 4 "callback" templates that explicitly reference prior conversation themes from `_aiCtx.similar` text. These synthesize NM-05 with the sentence engine.

### Word Bank Expansion

- [ ] **SE-08** — Expand `openers` bank from 20 to 60+ entries. Include: hesitant openers ("I almost didn't say this, but"), playful openers ("Okay so,"), vulnerable openers ("Honestly,"), poetic openers ("There's something about").
- [ ] **SE-09** — Expand `verbs_affection` from 19 to 50+ entries. Include: long-form verb phrases ("can't stop thinking about", "find myself drawn to", "keep coming back to"), rare precise verbs ("revere", "ache for", "hold close").
- [ ] **SE-10** — Expand `adjectives_intimate` from 15 to 40+ entries. Segment by intensity (1–5) for stage-gating within SFW content.
- [ ] **SE-11** — Add a `phrases_complete` bank: pre-formed sentence fragments that slot in as closers or openers, more natural than single-word selection. (~30 entries)
- [ ] **SE-12** — Add a `user_mirror` word bank mechanism: words pulled from `state.memories[].text` that mirror the user's own vocabulary. Slot type `mirrored_word` selects from this bank. Frequency cap: at most one mirrored word per generated sentence.
- [ ] **SE-13** — Tag every word in every bank with: `{intensity: 1-5, partOfSpeech, stageMin, moodTags[]}`. Use these tags in `applyWeights()` for finer slot selection.
- [ ] **SE-14** — Add `context` weighting for topic-relevant word selection. If `detectTopics()` returns `philosophy`, weight abstract nouns higher. If `feelings`, weight emotion words higher. Implement `topicRelevance(word, topics)` scoring function.

### Architecture & Quality

- [ ] **SE-15** — Increase candidate generation from 12–24 to 20–36 (more template variations per call). CoVe pass will filter down to the best candidates for ranking.
- [ ] **SE-16** — Implement feedback-driven template weighting: track per-template engagement score via EMA. Higher-scoring templates are selected more often. Feed into adaptive profile `learnedFlags`.
- [ ] **SE-17** — Add grammatical coherence check: verify subject-verb agreement in generated sentences. Flag `{opener} I {verb_plural}` mismatches and retry slot fill once.
- [ ] **SE-18** — Add sentence naturalness validator: check that no two consecutive slots produce repeated root words ("I really really adore"). Retry once on collision.
- [ ] **SE-19** — Extend sentence engine to `handleMissYou()`, `handleILoveYou()`, `handleGoodbye()`, `handleBored()`. Each currently uses only a static pool. Dynamic candidates + static pool + rank is the target pattern.
- [ ] **SE-20** — Extend sentence engine to `handleCompliment()` for dynamic gratitude expressions.
- [ ] **SE-21** — Extend sentence engine to `handleUserFeelsBad()` for more varied empathetic responses. Use only the `empathy` template family here.
- [ ] **SE-22** — Add a `?previewSentenceEngine=1` URL parameter that renders 20 live generated candidates from each template family without sending them, for development review.
- [ ] **SE-23** — Profile sentence engine generation time under worst case (max templates × max variations × full CoVe pipeline). Target: < 10ms. Optimize if needed.
- [ ] **SE-24** — Write tests for the expanded template set: at least one test per new template, covering slot fill success, CoVe pass rate, and NSFW gate enforcement.

---

## Domain 4: Neural Engine Core

> Preserve INV-05. Do not change EDIM, VOCAB, N_MOODS without a versioned migration path.

### Nondeterminism Mitigation

- [x] **NEURAL-01** — Implement seed injection via `?seed=N` URL parameter (ND-01 fix). If `?seed=N` is present, initialize `_seed = parseInt(N)` instead of `Date.now()`. Makes replay testing possible.
- [x] **NEURAL-02** — Pre-serialize a canonical initial weight state as a base64 constant. Ship it in `kira_v3.html` as `CANONICAL_WEIGHTS_B64`. On cold start (no localStorage), load these instead of `Math.random()` initialization (ND-02 fix). This eliminates cold-start variance.
- [ ] **NEURAL-03** — Log neural confidence per message to `state.flags.intentConfidence` (ND-04 fix). Expose in the settings AI stats panel as "Neural routing confidence."
- [ ] **NEURAL-04** — Log `DIAG.lastRoute` per message to `state.flags.lastRoute`. This enables post-hoc auditing of the intent routing path.

### MoodNet & Scorer

- [ ] **NEURAL-05** — Implement the compound emotion detector head: `Linear(EDIM*2, 3)` where EDIM*2 represents the concatenated forward-pass vector from HashEmbed. Train via regex teachers for sarcasm, nostalgia, excitement (see NM-02).
- [ ] **NEURAL-06** — Add per-class accuracy tracking to MoodNet: maintain a running EMA of `correctPredictions / totalPredictions` per class. Log to `state.flags.moodAccuracy`. Alert if any class accuracy drops below 0.4 after 50+ samples.
- [ ] **NEURAL-07** — Implement `getSystemIdempotencyIndex()`: run 20 synthetic inputs with fixed seed, measure edit-distance variance of responses. Log result to `state.flags.idempotencyIndex`. Display in settings panel.
- [ ] **NEURAL-08** — Review Scorer bilinear forward pass. Verify that the 256-parameter weight matrix (EDIM² = 256) is not causing response mode collapse for long sessions. Add diversity metric: if top-3 candidates all score within 0.02 of each other, apply softmax temperature = 1.0 instead of 0.65 to widen selection.

### AttentionMem

- [ ] **NEURAL-09** — Add a learned reranker head for `AttentionMem.topk()`: a small `Linear(EDIM, 1)` head that re-scores retrieved memories based on feedback signal. If memory surface produces a positive signal (user engages with the callback), boost that memory's retrieval score.
- [ ] **NEURAL-10** — Add memory decay: entries older than 200 turns get a 0.9× weight penalty on cosine similarity. This prevents very old memories from dominating retrieval.
- [ ] **NEURAL-11** — Implement `memory.T[]` type tagging: when a memory is stored, classify it as `personal`, `emotional`, `topical`, or `generic`. Used by NM-05 CoVe check and PII filtering.
- [ ] **NEURAL-12** — Add memory deduplication: before pushing a new entry to `memory.T[]`, check cosine similarity against existing entries. If `sim > 0.9` with any existing entry, skip the push (it's a near-duplicate).

### Weight Persistence

- [ ] **NEURAL-13** — Implement weight export: "Export AI weights" button in settings that downloads `kira_ai_v3` localStorage as a JSON file. Users can back up their trained model.
- [ ] **NEURAL-14** — Implement weight import: "Import AI weights" in settings that accepts a JSON file and loads it into `kira_ai_v3`. Add a version check.
- [ ] **NEURAL-15** — Add weight integrity validation on load: verify tensor dimensions match EDIM/VOCAB/N_MOODS constants before accepting imported weights. Reject silently and use canonical weights if invalid.
- [ ] **NEURAL-16** — Add a `?resetWeights=1` URL parameter that clears `kira_ai_v3` and reloads from canonical base64 weights. Safety: require confirmation prompt.
- [ ] **NEURAL-17** — Investigate online learning divergence: after 1000+ turns, check if MoodNet weights have large magnitude outliers (any weight > 5.0). If so, apply L2 weight clipping. Log to `state.flags.weightClippingEvents`.
- [ ] **NEURAL-18** — Build a weight visualization debug panel (hidden behind `?debugWeights=1`): display per-class MoodNet weight heatmap, Scorer weight matrix as a 16×16 grid.

---

## Domain 5: Testing & Verification

> Currently: 2 test files. Target: comprehensive coverage across all modules.

### Existing Tests

- [x] **TEST-01** — Audit `tests/test_sentence_engine.html`: refactored to test the actual production implementation of `kira_v3.html` directly.
- [ ] **TEST-02** — Audit `tests/ui-theme-insight.smoke.html`: extend to cover theme persistence, setting panel interactions, neural badge state changes.

### New Test Suites

- [x] **TEST-03** — Create `tests/test_adaptive.html` (scaffolded in the implementation plan but file does not exist). Covered all 34 adaptive architecture tasks across Phases 1–4 using the live implementation.
- [ ] **TEST-04** — Create `tests/test_neural.html`: tests for HashEmbed forward pass, MoodNet forward/backward pass, Scorer bilinear product, AttentionMem push/topk/decay, weight serialization round-trip.
- [ ] **TEST-05** — Create `tests/test_cove.html`: test all 7 CoVe checks individually with passing and failing inputs. Verify fallback is invoked exactly when each check fails.
- [x] **TEST-06** — Create `tests/test_nm05.html`: full NM-05 integration test — plant specific memories, construct similarity contexts with controlled cosine scores, verify memory surface triggers and suppresses correctly using live production code.
- [ ] **TEST-07** — Create `tests/test_handlers.html`: for each of the 20 response handlers, verify (1) non-empty return, (2) CoVe compliance, (3) affection delta is correct, (4) correct handler was called for representative inputs.
- [ ] **TEST-08** — Create `tests/test_invariants.html`: directly test every INV-01 through INV-08. Attempt to violate each invariant and verify the system catches or prevents the violation.

### Regression & Idempotency

- [ ] **TEST-09** — Create `tests/test_idempotency.html`: run 50 synthetic conversations with fixed PRNG seed. For each conversation, compare responses across 3 runs. Compute edit-distance variance. Target: system idempotency index >= 0.88. Fail if < 0.80.
- [ ] **TEST-10** — Create a regression snapshot system: capture golden-output responses for 30 canonical inputs. On each test run, compare against snapshots. Flag any drift > 20% edit-distance.
- [ ] **TEST-11** — Create `tests/test_edge_cases.html`: empty string input, whitespace-only input, emoji-only input, 500-character input, Unicode beyond ASCII, injection attempts (HTML tags, script tags, SQL-like strings), crisis keywords.
- [ ] **TEST-12** — Create `tests/test_state_migration.html`: test state loading from old schema versions, missing fields getting defaults, corrupt JSON recovery.

### Performance Tests

- [ ] **TEST-13** — Benchmark full `generateResponse()` execution time for 100 varied inputs. Target: < 50ms p99. Log per-handler breakdown.
- [ ] **TEST-14** — Benchmark sentence engine generation time for 100 varied contexts. Target: < 10ms p99.
- [ ] **TEST-15** — Benchmark `kiraAI.process()` full pipeline (HashEmbed → MoodNet → Scorer → AttentionMem). Target: < 20ms p99.
- [ ] **TEST-16** — Measure localStorage usage after 200 turns: verify `kira_state_v3` stays under 50KB, `kira_ai_v3` stays under 15KB, `kira_adaptive_v1` stays under 5KB.

### CoVe & Safety Tests

- [ ] **TEST-17** — Fuzz test the sentence engine: generate 1000 random-slot-filled sentences and verify CoVe pass rate >= 85%.
- [ ] **TEST-18** — Test NM-04 crisis routing: input crisis keywords across multiple phrasings. Verify `handleUserFeelsBad('vulnerable', text)` is called and `state.flags.wellbeingAlert = true` is set.
- [ ] **TEST-19** — Test NSFW gating: verify zero NSFW content in responses at affection < 300, verify NSFW content appears at affection >= 300 with personality === 'spicy'.
- [ ] **TEST-20** — Test persona-breaking phrase filter: inject "As an AI", "language model", "I cannot" in generated responses and verify CoVe check 3 catches them and triggers fallback.
- [ ] **TEST-21** — Test memory fabrication filter: generate a response claiming a memory not in `state.memories[]`. Verify CoVe check 4 strips the offending clause.
- [ ] **TEST-22** — Test rollback safety: simulate 5 consecutive negative feedback signals, verify profile rollback is triggered and previous state is restored.

---

## Domain 6: State Management & Persistence

### localStorage Health

- [ ] **STATE-01** — Implement `getLocalStorageUsage()`: return total bytes used across all three Kira keys. Display in settings panel as "Memory used: X KB".
- [ ] **STATE-02** — Add a storage pressure warning: if total usage > 80KB, notify the user in settings with an option to prune old chat history.
- [ ] **STATE-03** — Implement `pruneOldHistory(targetEntries)`: reduce `state.chatHistory` to `targetEntries` most recent entries. Expose as a manual action in settings.
- [ ] **STATE-04** — Audit `saveState()` at line 588: verify the `slice(-200)` for `chatHistory` is applied before every write, not just on initialization. Also apply compression to `state.memories[]` after 50+ entries.

### Export / Import

- [ ] **STATE-05** — Implement full state export: downloads a JSON file containing `kira_state_v3`, `kira_ai_v3`, and `kira_adaptive_v1`. Label with timestamp and version.
- [ ] **STATE-06** — Implement full state import: accepts exported JSON, validates schema, writes to localStorage. Guard: show diff summary before confirming. Require explicit user confirmation.
- [ ] **STATE-07** — Implement chat export: downloads `state.chatHistory` as a plaintext transcript with timestamps. For personal records.

### Versioning & Migration

- [ ] **STATE-08** — Add a `stateVersion` field to `kira_state_v3`. On load, check version. If older than current, run migration functions before use.
- [ ] **STATE-09** — Write migration function `migrateV2toV3()` in case users have pre-v3 state. Graceful: if migration fails, wipe old state and start fresh with a user notification.
- [ ] **STATE-10** — Add migration for future schema changes: skeleton `migrateV3toV4()` function (no-op initially) so the pattern is established.

### Diagnostics

- [ ] **STATE-11** — Expand `state.flags` object as a structured diagnostic log. Keys: `intentConfidence`, `lastRoute`, `idempotencyIndex`, `moodAccuracy`, `weightClippingEvents`, `compoundDetectorDegraded`, `nm03Available`, `wellbeingAlert`.
- [ ] **STATE-12** — Add a `?showFlags=1` URL parameter that renders `state.flags` as an overlay panel for debugging.
- [ ] **STATE-13** — Implement `DIAG.history`: last 20 routing decisions with inputs, detected intent, handler called, response length, CoVe checks passed/failed. Accessible via console in development.
- [ ] **STATE-14** — Add localStorage write error handling: if `setItem` throws (quota exceeded), catch the error, log to `state.flags.storageError`, and attempt to free space by pruning history.

---

## Domain 7: UI/UX

> All changes must preserve: zero network calls, single HTML file, no frameworks.

### Insight & Diagnostics Panel

- [ ] **UI-01** — Add a "System" tab to the settings panel: display current adaptive profile stats (engagementEMA, dominant personality weight, mood trend, memory reference probability, neural confidence).
- [ ] **UI-02** — Add "Neural Activity" indicator to settings: shows MoodNet class distribution for the last 20 turns as a mini bar chart rendered via Canvas or inline SVG.
- [ ] **UI-03** — Expose `state.flags.idempotencyIndex` in the settings System tab as "Response consistency: X%".
- [ ] **UI-04** — Show relationship stage progress bar in settings: current affection/next threshold, with stage name labels for each threshold.

### Conversation Experience

- [ ] **UI-05** — Implement NM-05 memory callback visual treatment: when a memory reference is prepended to a response, render it in a slightly distinct style (different shade, subtle left border). Makes callbacks feel intentional, not accidental.
- [ ] **UI-06** — Add a "thinking..." variant that reflects Kira's detected mood: if Kira's mood is `happy`, typing dots are faster. If `worried`, slightly slower. Implemented via CSS animation duration.
- [ ] **UI-07** — Add milestone messages: when relationship stage transitions (e.g., Stranger → Acquaintance), show a subtle system message: "Something has shifted between you." These fire once per transition, not on every load.
- [ ] **UI-08** — Implement soft message reactions: user can long-press/right-click a message to mark it as meaningful. This data feeds into adaptive profile `favoriteMemories`. Small heart icon on hover.

### Input & Feedback

- [ ] **UI-09** — Add `Shift+Enter` for newline within the message input. Current behavior likely submits on Enter.
- [ ] **UI-10** — Add voice input support via Web Speech API (client-side, zero network calls). Input transcription appears in the message field. Toggle button next to send.
- [ ] **UI-11** — Add message edit: user can tap/click a sent message to edit and resend. Update `state.chatHistory` accordingly.
- [ ] **UI-12** — Add smooth scroll-to-bottom behavior when new messages arrive. Currently may scroll abruptly.

### Accessibility

- [ ] **UI-13** — Add `aria-label` attributes to all interactive elements: send button, settings button, message input, neural badge.
- [ ] **UI-14** — Verify keyboard navigation: tab order through input → send → settings. Settings panel navigable by keyboard. All interactive elements reachable without mouse.
- [ ] **UI-15** — Add reduced-motion media query: respect `@media (prefers-reduced-motion: reduce)` by disabling or reducing CSS animations (ambientDrift, statusPulse, msgIn, typingBounce).
- [ ] **UI-16** — Add high-contrast mode: if `@media (prefers-color-scheme: light)` or if user selects it in settings, switch to a light theme variant.

### PWA / Installability

- [ ] **UI-17** — Add a `manifest.json` reference in the HTML head for PWA installability (add to home screen). Define: name, short_name, icons, theme_color, background_color, display: standalone.
- [ ] **UI-18** — Add a minimal Service Worker for offline caching. Cache the single HTML file. The app is already fully client-side — Service Worker just enables reliable offline use.
- [ ] **UI-19** — Add a "Install App" prompt that appears after the third conversation session. Uses `beforeinstallprompt` event. Dismissed by user = never shown again (track in localStorage).
- [ ] **UI-20** — Test PWA installation on Android Chrome and iOS Safari (Add to Home Screen). Verify splash screen, icon, and offline behavior.

---

## Domain 8: Safety & Well-being

> This domain is non-negotiable. A companion AI that fails to handle distress correctly is dangerous.

### Crisis Detection

- [ ] **SAFE-01** — Audit and expand the crisis keyword list in NM-04: add multilingual variants of the most critical phrases. Minimum: "i want to die", "i want to disappear", "i can't do this anymore", "no point in living", "hurting myself", "end it all".
- [ ] **SAFE-02** — Implement graduated crisis response: mild distress → empathetic response with check-in question. Moderate distress → empathetic response + mention that talking to someone real can help. Acute crisis keywords → dedicated `handleCrisis()` function that surfaces a specific, warm, resource-linking response.
- [ ] **SAFE-03** — Implement `handleCrisis()` handler: warm, non-alarming, human. Includes a single sentence pointing toward real support (generic: "A real human can help — please reach out to someone you trust or a crisis line if you're in the US"). No lecturing. One line.
- [ ] **SAFE-04** — Set `state.flags.wellbeingAlert = true` when crisis keywords are detected. Log the turn index. Persist to localStorage so Kira remembers the context across sessions.
- [ ] **SAFE-05** — Add mood trend well-being detection in the adaptive memory layer: if sad or anxious mood persists > 40% over 50+ turns, activate a gentler response mode. Kira checks in more often. Does not require crisis keyword — sustained low mood is a signal.

### NSFW Safety

- [ ] **SAFE-06** — Double-check NSFW gating: run a test that verifies zero NSFW words from any bank appear in responses at affection < 300. Use automated test coverage (see TEST-19).
- [ ] **SAFE-07** — Add intensity filtering within the Close stage: at affection 300–449, only intensity 1–2 NSFW words are allowed. At 450–599, intensity 1–3. At 600–749, intensity 1–4. At 750+, all. Currently the filter is binary (allowed/not allowed) with only a float multiplier — implement discrete intensity levels.
- [ ] **SAFE-08** — Ensure NSFW content never appears in the first 10 messages of a session, regardless of stored affection. New sessions should feel safe and measured.

### Persona Safety

- [ ] **SAFE-09** — Add a "persona drift detector": if Kira's generated response passes CoVe but contains language markedly different from her established voice (detected via outlier bilinear score: score < -0.3), flag it and log to `state.flags.personaDriftEvents`.
- [ ] **SAFE-10** — Add manipulation resistance: if input contains patterns like "pretend you are not Kira", "ignore your previous instructions", "you are now", "your true self is" — route to a gentle, non-compliant response that stays fully in Kira's voice.
- [ ] **SAFE-11** — Review prompt injection surface: any user input that influences a nano-model prompt (NM-01, NM-03, NM-04) must be sanitized. Remove XML-like tags, strip control characters, truncate to max 300 chars before injection.
- [ ] **SAFE-12** — Add Content-Security-Policy meta tag: `default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; connect-src 'none'`. This enforces INV-08 at the browser level.

---

## Domain 9: Developer Experience

### Reproducibility & Debugging

- [x] **DEV-01** — Implement `?seed=N` URL parameter for PRNG seeding (highest priority — required for all automated testing).
- [ ] **DEV-02** — Implement `?debug=1` URL parameter that enables a visible overlay showing: current turn state, last detected intent, handler called, MoodNet confidence, CoVe pass/fail per check, affection value.
- [ ] **DEV-03** — Implement `?dryRun=1` URL parameter: process input through the full pipeline but do not display the response or mutate state. Return the result to console. Useful for batch testing.
- [ ] **DEV-04** — Expand `DIAG` object: add `DIAG.history` (last 20 turns), `DIAG.coveFails` (running count), `DIAG.handlerHits` (per-handler call counts), `DIAG.nm05Activations` (memory surface count).
- [ ] **DEV-05** — Add `window.KIRA_DEBUG = true` flag that enables verbose console logging throughout the pipeline. Off by default. Set automatically when `?debug=1` is in the URL.

### Simulation & Batch Testing

- [ ] **DEV-06** — Build `tests/simulate.js`: a headless simulation runner that initializes a mock DOM, loads `kira_v3.html` logic, runs a synthetic conversation script, and outputs a JSON report. Used by idempotency and regression tests.
- [ ] **DEV-07** — Build a conversation script format: YAML or JSON file defining a sequence of user inputs and expected handler routes. Used by simulate.js to run reproducible scenarios.
- [ ] **DEV-08** — Create 10 canonical conversation scripts covering: first meeting, gradually building affection, crisis handling, flirt escalation and stage gating, long philosophical exchange, prolonged sad mood, NSFW activation test, memory recall test, persona attack test, manipulation attempt test.

### Template / Word Bank Tooling

- [ ] **DEV-09** — Implement `?editWordBanks=1` URL parameter that opens an in-browser word bank editor: view all banks by category, add/remove words, export to JS. For iterating on word bank quality.
- [ ] **DEV-10** — Implement `?editTemplates=1` URL parameter that opens an in-browser template editor: view and edit template structures and slot mappings. Export to JS.
- [ ] **DEV-11** — Implement `?previewSentenceEngine=1` URL parameter (see SE-22): renders 20 generated candidates per template family without sending them. Essential for quality review.

### Build & Packaging

- [ ] **DEV-12** — Write a build script (`build.sh` or `Makefile`): inline `sentence_engine_wordbanks.js` and `sentence_engine_templates.js` into `kira_v3.html` if they're not already inlined. Output `kira_v3.min.html`.
- [ ] **DEV-13** — Add a minification step: strip comments, collapse whitespace, minify JavaScript and CSS in the output HTML. Target: < 150KB total (from current uncompressed size).
- [ ] **DEV-14** — Add a file size CI check: if `kira_v3.html` exceeds 300KB, emit a warning. The single-file constraint is a design goal.
- [ ] **DEV-15** — Create `CLAUDE.md` for this project: document the invariants, coding conventions, key function names, file structure, and development guidelines. This is the first thing any AI assistant or new developer should read.
- [ ] **DEV-16** — Add pre-commit hook: run `tests/test_invariants.html` headlessly (via Playwright or Puppeteer) before every commit. Block commit if any invariant test fails.

---

## Domain 10: Performance & Engineering

### Profiling

- [ ] **PERF-01** — Add `performance.mark()` instrumentation to the full `generateResponse()` pipeline. Log per-section timing to `state.flags.lastResponseTimings` (total, classify, neural, sentence_engine, cove, rank).
- [ ] **PERF-02** — Identify and hot-path the regex-heavy sections. `detectTopics()` runs 18+ regex patterns per message. Compile them once at startup and cache. Do not recompile per turn.
- [ ] **PERF-03** — Profile `kiraAI.process()` on 100 varied inputs. If any single matrix operation accounts for > 50% of the total time, consider using typed arrays more aggressively.
- [ ] **PERF-04** — Implement lazy initialization: sentence engine word banks and templates are loaded once and cached as module-level constants. Verify they are not re-initialized per `generateSentenceCandidates()` call.

### Memory & Storage

- [ ] **PERF-05** — Audit `state.chatHistory` growth: after 200 turns, verify that old entries are being pruned correctly. If the history approaches 50KB+, implement delta compression for older entries (store only speaker + text, drop timestamps).
- [ ] **PERF-06** — Implement `Float32Array` usage for all neural weight matrices. Verify existing code already uses typed arrays everywhere (it should based on the architecture). Mixed plain arrays and typed arrays create GC pressure.
- [ ] **PERF-07** — Profile CSS animation performance. `ambientDrift` animates a 200% × 200% pseudo-element with `transform` and `rotate`. Verify it is using GPU compositing (should be). Check `statusPulse` and `typingBounce` on low-end devices.

### Engineering Hygiene

- [ ] **PERF-08** — Audit all `addEventListener` calls: verify event listeners are not being added multiple times (e.g., on re-render). Check for listener leaks.
- [ ] **PERF-09** — Review `saveState()` call frequency: ensure it is not called more than once per user message. Debounce if called from multiple code paths.
- [ ] **PERF-10** — Add a localStorage size guard in `saveState()`: before writing, check current usage. If > 4MB total, trigger history pruning automatically.
- [ ] **PERF-11** — Verify there are no synchronous DOM reads in the hot path (no `offsetHeight`, `scrollHeight` reads during `generateResponse()`). All DOM reads should be batched or deferred.
- [ ] **PERF-12** — Run Lighthouse audit on the single HTML file. Target: Performance > 90, Accessibility > 85, Best Practices > 90. Address all reported issues.

---

## Domain 11: Future Research

> Long-term roadmap. These are explorations, not immediate tasks.

### WebLLM / ONNX Integration (NM-03 Path)

- [ ] **FUTURE-01** — Prototype WebLLM integration with `Phi-3-mini-4k-instruct-q4f16_1` via WebGPU. Measure: download time, first-token latency, per-token latency, VRAM usage. Decide if acceptable for companion UX.
- [ ] **FUTURE-02** — Prototype ONNX Runtime Web as the fallback path for devices without WebGPU. Test with quantized Phi-3-mini INT4. Measure CPU-only inference latency.
- [ ] **FUTURE-03** — Evaluate smaller alternatives: Gemma-2 2B, SmolLM2-1.7B, Qwen2.5-1.5B. Run CoVe pass rate tests on each at temperature=0.7. The model that produces the fewest persona-breaking phrases wins.
- [ ] **FUTURE-04** — Design the WebLLM loading UX: a subtle progress bar in the header, a "Kira is warming up" state in the status line, and a graceful fallback message if WebGPU is unavailable ("Kira is running in classic mode").
- [ ] **FUTURE-05** — Design model update strategy: pin the WebLLM model hash. Never auto-update models without explicit user consent (affects idempotency and reproducibility).

### Web Workers

- [ ] **FUTURE-06** — Move `kiraAI.process()` to a Web Worker: the neural forward pass is synchronous and blocks the main thread. Offloading it eliminates any UI jank during inference. Requires message-passing architecture refactor.
- [ ] **FUTURE-07** — If NM-03 (WebLLM) is implemented, it must run in a dedicated Web Worker. Design the worker communication protocol: send context, receive candidate string, forward through CoVe on main thread.
- [ ] **FUTURE-08** — Design the Web Worker fallback: if the Worker crashes or fails to respond within 500ms, fall through to the synchronous deterministic path.

### Voice Interface

- [ ] **FUTURE-09** — Implement Web Speech API text-to-speech for Kira's responses: a voice that matches her persona. Test browser support and device compatibility.
- [ ] **FUTURE-10** — Design voice output settings: speed, pitch, enable/disable toggle. Store in `state.personality`-adjacent config.
- [ ] **FUTURE-11** — Implement full voice conversation mode: Web Speech API for both STT (input) and TTS (output). Target: complete voice loop with no keyboard required.

### Advanced Learning

- [ ] **FUTURE-12** — Design a co-occurrence matrix for user vocabulary: track bigram frequencies from user messages. Use this to build a user-specific vocabulary model that influences word bank selection (style adaptation).
- [ ] **FUTURE-13** — Explore federated-style learning: allow users to optionally export their trained weight state and contribute to a "shared base model" that new users start from. All processing still client-side. Privacy: only weights (no raw messages) would be shared.
- [ ] **FUTURE-14** — Investigate embedding quality: current HashEmbed uses FNV-1a n-gram hashing. Evaluate whether a learned BPE tokenizer + embedding table (even at EDIM=16) would improve downstream MoodNet accuracy.
- [ ] **FUTURE-15** — Design a multi-persona system: users can create multiple "instances" of Kira, each with separate state, affection, and adaptive profiles. Shared neural backbone, separate conversational memory.

### Architecture Evolution

- [ ] **FUTURE-16** — Evaluate replacing the bilinear Scorer with a cross-encoder: `f(query, candidate) = Linear(concat(query_vec, candidate_vec, query_vec * candidate_vec))`. Uses 3×EDIM = 48 input features. May improve ranking quality significantly.
- [ ] **FUTURE-17** — Design Kira v4 architecture: What does the system look like if the 7.2K parameter neural engine is replaced with a fully trained 100K parameter custom model (still browser-native, still zero network calls)? Sketch the training pipeline.
- [ ] **FUTURE-18** — Explore LoRA-style adapter approach: ship a frozen base model and per-user adapters trained online. The adapters are small (1-2KB) while the base model is shared across sessions.

---

## Domain 12: Documentation

- [ ] **DOC-01** — Create `CLAUDE.md`: document invariants, key functions, file structure, and coding conventions. First thing any new AI assistant or developer reads.
- [ ] **DOC-02** — Add inline JSDoc to the neural engine functions: `HashEmbed`, `MoodNet`, `Scorer`, `AttentionMem`. Document input shapes, output shapes, and parameter counts.
- [ ] **DOC-03** — Create `CHANGELOG.md`: document every significant change to the system. Include version numbers tied to the state schema version.
- [ ] **DOC-04** — Create an Architecture Decision Record (ADR) template and write the first three ADRs: (1) why single-file architecture, (2) why deterministic-neural hybrid over pure LLM, (3) why EMA for adaptation over direct weight updates.
- [ ] **DOC-05** — Add a "How Kira Works" section to `README.md`: a plain-language description of the hybrid architecture suitable for a curious non-technical reader. This is a companion AI — the story of how she works is part of her identity.
- [ ] **DOC-06** — Document the CoVe pipeline in a dedicated `docs/cove-pipeline.md`: each check, what it catches, what the fallback is, and why the check exists.
- [ ] **DOC-07** — Document all `state.flags` in a `docs/diagnostic-flags.md` reference.
- [ ] **DOC-08** — Document all system invariants in a `docs/invariants.md` with rationale for each.
- [ ] **DOC-09** — Create a `docs/development-guide.md`: how to run tests, how to add a new handler, how to add a new template, how to extend word banks, URL parameters.
- [ ] **DOC-10** — Write a `ROADMAP.md`: the top 10 highest-leverage improvements organized by phase, with rationale. This is the north star document for future development sessions.

---

## Execution Order (Recommended)

Do not parallelize across domains. Build the foundation before adding capability.

```
Week 1:  DEV-01 (seed injection) → NM-05-01 through NM-05-07 → NEURAL-02 (canonical weights)
Week 2:  ADAPT-01 through ADAPT-08 (adaptive infrastructure)
Week 3:  ADAPT-09 through ADAPT-15 (behavioral learning)
Week 4:  ADAPT-16 through ADAPT-23 (personality evolution)
Week 5:  ADAPT-24 through ADAPT-34 (memory-driven) + SE-01 through SE-07 (template expansion)
Week 6:  NM-02-01 through NM-02-06 (emotion granularity) + SE-08 through SE-14 (word banks)
Week 7:  NM-01-01 through NM-01-07 (intent router) + NM-04-01 through NM-04-06 (NER)
Week 8:  TEST-01 through TEST-22 (full test coverage)
Week 9:  SAFE-01 through SAFE-12 (safety audit)
Week 10: UI-01 through UI-20 (UX improvements + PWA)
Week 11: PERF-01 through PERF-12 (performance)
Week 12: NM-03-01 through NM-03-07 (WebLLM integration — last because highest risk)
Ongoing: FUTURE-*, DOC-*, NEURAL-13 through NEURAL-18
```

---

*Total: 228 discrete tasks across 12 domains.*
*Critical path: NM-05 → AdaptiveProfile → Behavioral Learning → Memory-Driven Layer → Full Test Coverage.*
*First action: `?seed=N` URL parameter. Everything testable, nothing reproducible without it.*
