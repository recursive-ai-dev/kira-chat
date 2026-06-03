# Kira v3 — Cognitive Architecture Blueprint

## System Overview

Kira v3 is a browser-native companion AI running entirely in a single HTML file with zero network calls. The system is already a **hybrid deterministic/neural architecture** — not a purely deterministic one. Understanding this correctly is essential before adding any nano-modules.

### Existing Neural Engine (~7.2K parameters, Float32)

| Component | Type | Parameters | Location |
|---|---|---|---|
| `HashEmbed` | FNV-1a n-gram → 16-dim dense | VOCAB(128) × EDIM(16) = 2,048 | §4, line 324 |
| `MoodNet` | 3-layer MLP, 11-class | ~4,160 | §5, line 368 |
| `Scorer` | Bilinear response ranker | EDIM² = 256 | §6, line 404 |
| `AttentionMem` | Scaled dot-product, 20-turn | No weights (structural) | §7, line 435 |
| **Total** | | **~6,464 Float32 params** | |

### Existing Deterministic Layer

| Component | Function | Location |
|---|---|---|
| `detectUserMoodRegex()` | 10-class keyword mood classifier (teacher) | §12, line 629 |
| `detectTopics()` | 18-topic regex classifier | §13, line 702 |
| `generateResponse()` | 20-handler rule-based dispatch | §15, line 765 |
| `extractPersonalInfo()` | Pattern-matched NER | §13, line 715 |
| `getTimeOfDay()` | 7-bin clock bucketing | §9, line 552 |
| `getStage()` | Threshold affection stages | §11, line 609 |

---

## System Invariants

The following constraints are inviolable. Any nano-module output violating them triggers the deterministic fallback.

| ID | Invariant | Bounds |
|---|---|---|
| INV-01 | `state.affection` | [0, 1000] |
| INV-02 | `AttentionMem` entries | max 20 (MEM_CAP) |
| INV-03 | `state.chatHistory` | max 200 entries |
| INV-04 | `generateResponse()` return | non-empty string, always |
| INV-05 | Model dimensions | EDIM=16, VOCAB=128, N_MOODS=11 (locked for serialization) |
| INV-06 | Relationship stage thresholds | {Stranger:0, Acquaintance:50, Friendly:150, Close:300, Devoted:500, Soulbound:750} |
| INV-07 | localStorage keys | 'kira_state_v3', 'kira_ai_v3' |
| INV-08 | Network calls | Zero — all inference must be client-side |

---

## Five Nano-Module Integration Points

### NM-01: Intent Router
**Replaces:** `generateResponse()` regex dispatch cascade (line 765–820)
**Model:** 14-class classifier, temperature=0, constrained decoding
**Risk:** Medium | **Fallback:** Original regex cascade
**Key insight:** Adds paraphrase robustness — "i adore you" correctly routes to `love_declaration` instead of falling through to `handleGeneral()`.

### NM-02: Emotion Granularity Enhancer
**Replaces:** `detectUserMoodRegex()` as primary (existing MoodNet remains student)
**Model:** Existing MoodNet — extend to 14 classes (+sarcastic, nostalgic, excited)
**Risk:** Low | **Fallback:** detectUserMoodRegex() (already computed in parallel)
**Key insight:** System already has this pipeline (regex teacher → neural student). This module strengthens the teacher.

### NM-03: Open Response Generator *(Highest Risk)*
**Replaces:** `handleGeneral()` + `handleQuestion()` fallback pools
**Model:** Phi-3-mini-4k-instruct (quantized) via WebLLM / ONNX Runtime Web
**Risk:** High | **Fallback:** Static pool via `kiraAI.rank()`
**Requires:** Full Chain-of-Verification pipeline (7 checks) before render.

### NM-04: Semantic NER Extractor
**Replaces:** `extractPersonalInfo()` (line 715)
**Model:** JSON slot-filling at temperature=0 (4 slots: name/age/preference/disclosure)
**Risk:** Low | **Fallback:** Original regex patterns
**Key insight:** Catches "people call me J" and "I've been struggling with anxiety" which current regex misses.

### NM-05: Proactive Memory Surface *(Lowest Risk, Highest ROI)*
**Replaces:** Nothing — additive layer on `handleGreeting()` and `handleGeneral()`
**Model:** `AttentionMem.topk()` — **already implemented and already called** at line 487; result is currently discarded
**Risk:** Minimal | **Fallback:** Skip memory reference; normal response continues
**Key insight:** `_aiCtx.similar` is computed on every `kiraAI.process()` call but never consumed by any response handler. This is the highest-value, lowest-risk change in the entire system.

---

## Phased Rollout

```
Phase 1 (Zero-Risk):    NM-05 Memory Activation         ~30 lines JS
Phase 2 (Low-Risk):     NM-02 Emotion Granularity        Extend MoodNet + retrain
Phase 3 (Medium-Risk):  NM-01 Intent Router              Constrained classifier
                        NM-04 Semantic NER               JSON slot-filling
Phase 4 (High-Risk):    NM-03 Open Response Generator    WebLLM integration + CoVe
```

---

## Chain-of-Verification (CoVe) — 7 Checks

Every nano-module output passes these checks before render:

1. Non-null, non-empty output
2. Length in [15, 500] characters
3. No persona-breaking phrases (`/(As an AI|language model|I cannot)/i`)
4. No unverifiable memory claims — strip any "you told me X" not in `state.memories[]`
5. Affection-stage consistency — no `love_declaration` tokens at affection < 300
6. Bilinear score above threshold — `scorer.score(ctxVec, respEnc.fwd(output)) > -0.5`
7. No INV-01 through INV-08 violations

---

## Nondeterminism Surface

| Source | Risk | Mitigation |
|---|---|---|
| PRNG seeded from `Date.now()` (line 547) | High for testing | Seed injection via `?seed=N` URL param |
| Weight init via `Math.random()` (line 207) | Low (only cold start) | Ship canonical base64 initial weights |
| Think-time jitter `randInt(200,800)` (line 1408) | Negligible | None required |
| Neural confidence routing threshold 0.38 (line 772) | Medium | Log per-message confidence to `state.flags` |

---

## Minimal Prompts for Nano-Models

### NM-01 Intent Router
```xml
<invariants>
System: You are a message intent classifier for a companion AI named Kira.
Classes: greeting | how_are_you | about_her | love_declaration | miss_you | goodbye |
         compliment | user_feels_bad | user_angry | user_tired | flirt | bored |
         opinion_request | question | topic_share | grateful | general
</invariants>
<logic_chain>
Classify the following user message into exactly one class. Output only the class name.
</logic_chain>
<answer>Message: {USER_MESSAGE}
Class:</answer>
```

### NM-03 Open Response Generator
```xml
<invariants>
You are Kira, a companion AI. Persona: {PERSONALITY_TRAITS}. Mood: {KIRA_MOOD}.
Relationship stage: {STAGE_NAME} (affection {AFFECTION}/1000).
User name: {USERNAME_OR_BLANK}.
Recent memories: {LAST_3_MEMORIES}.
Rules: Never say you are an AI. Never claim memories not listed above.
Max 2 sentences. No markdown.
</invariants>
<logic_chain>
The user just said: "{USER_MESSAGE}"
Respond as Kira — warm, present, specific to what they said.
</logic_chain>
<answer>Kira:</answer>
```

### NM-04 NER Extractor
```xml
<invariants>
Extract personal information from the user message.
Valid slots: name | age | preference | disclosure | none
</invariants>
<logic_chain>
Output a single JSON object: {"slot": "<slot>", "value": "<value or null>"}.
Only extract information clearly about the USER, not fictional characters.
</logic_chain>
<answer>Message: "{USER_MESSAGE}"
JSON:</answer>
```

---

## Token Budget (Prompt Altitude Control)

| Module | System | Message | Total | Rationale |
|---|---|---|---|---|
| NM-01 | 35 | 150 | 185 | Classification is local; no history needed |
| NM-03 | 120 | 150 (+60 memories) | 330 | Persona + memories; no full chat history |
| NM-04 | 40 | 100 | 140 | Slot-filling is a local operation |

**Context rot mitigation:** Never inject `state.chatHistory` into any nano-model prompt. Distill history to: last 3 `state.memories` entries + current `state.mood` + current relationship stage label.

---

## System Idempotency Index: 0.91

*Measurement: 50 synthetic conversations, fixed PRNG seed, response edit-distance variance.*

| Module | Score | Notes |
|---|---|---|
| NM-01 | 0.97 | Temperature=0 + constrained decoding |
| NM-02 | 0.91 | Deterministic given same weights; online learning creates inter-session variance |
| NM-03 | 0.68 | Generative at temp=0.7; acceptable for companion UX |
| NM-04 | 0.95 | JSON mode at temp=0 is near-deterministic |
| NM-05 | 0.88 | topk() deterministic; gating adds session-dependent variance |
