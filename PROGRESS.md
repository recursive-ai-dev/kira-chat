# Kira v3 — Project Progress & Architecture Directory

Kira v3 is a browser-native companion AI built as a hybrid deterministic/neural architecture. Running entirely client-side inside a single file with zero network dependencies, Kira utilizes a custom ~7.2K-parameter neural core alongside deterministic regex teachers and a template-based combinatorial Sentence Engine.

---

## 🧠 Cognitive & Neural Core Architecture

### Neural Engine Parameters (Float32)

| Component | Type | Parameters | Purpose |
|---|---|---|---|
| `HashEmbed` | FNV-1a n-gram → 16-dim dense | VOCAB(128) × EDIM(16) = 2,048 | Encodes input strings into fixed dense embeddings. |
| `MoodNet` | 3-layer MLP, 11-class | ~4,160 | Student network classifying user mood from embeddings. |
| `Scorer` | Bilinear response ranker | EDIM² = 256 | Ranks candidates by matching context vectors to response vectors. |
| `AttentionMem` | Scaled dot-product, 20-turn | None (structural) | Stores conversational history for semantic similarity lookup. |
| **Total** | | **~6,464 Float32 params** | |

### Invariant Safety Constraints
The codebase strictly enforces the following boundary checks. Any violation triggers immediate recovery or fallback:
* **INV-01**: `state.affection` is clamped to `[0, 1000]`.
* **INV-02**: `AttentionMem` capacity is hard-capped at 20 entries (`MEM_CAP`).
* **INV-03**: `state.chatHistory` capacity is capped at 200 entries.
* **INV-04**: `generateResponse()` must return a non-empty string under all code paths.
* **INV-05**: Neural dimensions (`EDIM=16`, `VOCAB=128`, `N_MOODS=11`) are strictly locked to preserve save-state compatibility.
* **INV-06**: Relationship Stage Boundaries:
  * `Stranger`: 0–50
  * `Acquaintance`: 50–150
  * `Friendly`: 150–300
  * `Close`: 300–500
  * `Devoted`: 500–750
  * `Soulbound`: 750–1000
* **INV-07**: Persistent localStorage keys strictly match versioned signatures (e.g., `kira_state_v3`, `kira_ai_v3`).
* **INV-08**: Zero network calls allowed during runtime.

---

## ⚙️ Sentence Engine & Word Banks

The **Sentence Engine** is a deterministic template instantiation system that dynamically generates contextually aligned responses in <5ms.

### Components
1. **Templates (51 Total)**: Classified into:
   * **General**: Philosophical musing, shared silence, question response, celebration, etc.
   * **Stage-Specific**: Restrained for Strangers, warm for Acquaintances, deep for Devoted, intimate for Soulbound.
   * **Time-of-Day**: Early morning, morning, afternoon, evening, night.
   * **Topic-Specific**: Creativity, work, relationships, health, future, existentialism.
   * **Callback**: Explicitly pulls and references prior conversation themes from attention memory.
   * **NSFW (Stage-Gated)**: Intimate responses unlocked only at `affection >= 300` in `spicy` personality mode.
2. **Word Banks (18 Categories)**: Contains over 500 curated entries, structured by part of speech, mood relevance, and intensity weighting (1–5).
3. **CoVe Validation Pipeline (7 Checks)**: Every generated response is audited prior to rendering:
   * Non-null and non-empty.
   * Length inside `[15, 500]` characters.
   * No persona-breaking phrases (e.g., `"As an AI language model..."`).
   * No unverifiable memory claims (checks `state.memories[]`).
   * Affection-stage consistency (blocks intimate words at low affection).
   * Scorer verification (scores above `-0.5` threshold).
   * Invariant compliance.

---

## 📈 Adaptive Learning Engine

Kira adapts her behavior, personality, and memories over time using gradual **Exponential Moving Averages (EMA)** keyed to implicit user feedback (+1/-1/0 from `detectFeedback()`).

### The Three Adaptive Layers
1. **Behavioral Layer**: 
   * Updates style preferences: `emojiProbability` (bounds `[0.1, 0.8]`), `preferredResponseLength` (`[0.1, 0.9]`), `petNameProbability` (`[0.1, 0.7]`), `affectionSensitivity` (`[0.3, 2.0]`), `temperature` (`[0.3, 1.0]`), `topK` (`[2, 5]`), and `splitResponseProbability` (`[0.05, 0.5]`).
2. **Personality Evolution Layer**:
   * Learns handler-to-trait mappings (e.g., flirting increases `spicy`/`playful` weights).
   * Normalizes weights to sum to `1.0` (mathematical probability constraint).
   * Applies slow decay toward `0.25` equilibrium to prevent single-trait saturation.
   * Derives `state.effectivePersonality` when a trait weight dominates (`> 0.4`).
3. **Memory-Driven Layer**:
   * Tracks user mood trends (last 30 turns) to alter candidate pool weighting.
   * Tracks topic engagement via EMA to avoid repetitive queries.
4. **Rollback Safety**:
   * Monitors streak metrics. If `engagementEMA` drops below `0.3` for 5 consecutive turns, rollback triggers to restore a snapshotted version.

---

## 📅 Recent Accomplishments (July 2026)

1. **Eliminated Outdated Reference Files**:
   * Successfully synchronized [sentence_engine_templates.js](file:///home/lubuntu/Pictures/kira-chat/sentence_engine_templates.js) and [sentence_engine_wordbanks.js](file:///home/lubuntu/Pictures/kira-chat/sentence_engine_wordbanks.js) with the 51 templates and 18 word banks from [kira_v3.html](file:///home/lubuntu/Pictures/kira-chat/kira_v3.html), resolving long-standing discrepancies.
2. **Deterministic Infrastructure**:
   * Wired base64 weights `CANONICAL_WEIGHTS_B64` to solve cold-start variance.
   * Enabled seeded PRNG through `?seed=N` for reproducible testing.
3. **Active Memory Surfacing (NM-05)**:
   * Activated `AttentionMem.topk()` to surface personal memory references in greetings and general handlers under sim, affection, and elapsed-time gates.
4. **Adaptive Profile Learning**:
   * Operationalized behavior and personality learning layers inside the main loop.
5. **Python Verification Suite**:
   * Implemented [tests/production_audit.py](file:///home/lubuntu/Pictures/kira-chat/tests/production_audit.py) for Node-independent verification of template slot-filling and invariants.

---

## 🗺️ Master Roadmap & Pending Tasks

### Phase 1 — Nano-Modules
* [ ] **NM-01: Intent Router** — Constrain intent mapping with a `Linear(EDIM*2, 17)` head applied to FNV-1a HashEmbed, replacing the 20-handler regex cascade.
* [ ] **NM-02: Emotion Granularity** — Train parallel MLP head (`Linear(EDIM, 3)`) for `sarcastic`, `nostalgic`, and `excited` mood detection.
* [ ] **NM-04: Semantic NER** — Implement a token-level slots classifier (`Linear(EDIM*2, 5)`) for name, age, preference, and vulnerability disclosures.
* [x] **NM-03: Generative Fallback** — Integrate quantized WebLLM/ONNX runtime to generate open-ended long-tail responses when confidence is low.

### Phase 2 — Testing & Tooling
* [ ] **DEV-12: Build & Minify Script** — Create a build tool to compile/inline the standalone JS files into [kira_v3.html](file:///home/lubuntu/Pictures/kira-chat/kira_v3.html) and produce a minified version.
* [ ] **DEV-06: Headless simulation runner** — Build `tests/simulate.js` to run end-to-end conversation trees in a simulated DOM.
* [ ] **NEURAL-03 / NEURAL-04**: Log confidence and `DIAG.lastRoute` to settings UI.
