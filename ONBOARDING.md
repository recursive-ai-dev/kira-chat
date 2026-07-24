# Developer Onboarding Guide: Kira v3 Architecture & System Design

Welcome to the **Kira v3** codebase! This guide is designed for upcoming LLM, NLP, and AI developers looking to understand, maintain, or extend Kira's hybrid deterministic/neural architecture.

---

## 🏗️ 1. Architectural Philosophy

Traditional LLM assistants rely on heavy billions-of-parameters autoregressive weights that require GPU inference servers or heavy WebLLM downloads.

**Kira v3** takes a different approach: **achieving conversational-level English without large-model training**, operating 100% client-side inside a single browser file (`kira_v3.html`) with zero network dependencies.

### The 4 Hybrid Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Input Text                                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Input Analysis & Concept Unification                                │
│    • Regex Mood/Intent/NER Detectors                                   │
│    • ConceptUnificationEngine (extractConceptTriple: entity, emotion) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Sentence Engine (Combinatorial Synthesis)                          │
│    • 51 Dynamic Templates (mood, stage, topic, time-of-day gated)     │
│    • 18 Curated Word Banks + User Concept Triple Slot Binding          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Deterministic Grammar & Naturalness Polish (`polishSentence`)        │
│    • Article Correction (a vs an)                                      │
│    • Subject-Verb & Intensifier Agreement (you were, I am so)          │
│    • Dynamic Gerund Conversion (keep thinking, keep taking)            │
│    • Contraction & Punctuation Deduplication                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Neural & Bilinear Composite Ranking (`kiraAI.rank`)                 │
│    • Bilinear Matrix Scorer + Cosine Embedding Similarity              │
│    • Recent Response Deduplication (prevents turn repetition)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Selected Response                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 2. Core Codebase Layout

| File | Purpose |
|---|---|
| `kira_v3.html` | The primary application containing CSS styling, UI DOM rendering, neural worker kernel, sentence engine, grammar polish pipeline, and response routing cascade. |
| `kira_memory.db` | SQLite database storing persistent memories, user profile facts, and word banks. |
| `scripts/kira_db.py` | Command-line tool to view, add, edit, or delete SQLite memories outside of Kira. |
| `sentence_engine_templates.js` | Standalone template definitions synchronized with `kira_v3.html`. |
| `sentence_engine_wordbanks.js` | Standalone word bank definitions synchronized with `kira_v3.html`. |
| `tests/production_audit.js` | Node.js audit verifying all templates and word banks fill cleanly. |
| `tests/production_audit.py` | Python audit verifying template structure integrity. |
| `tests/test_conversational_engine.js` | Headless JSDOM 14-turn end-to-end conversation simulation. |
| `tests/test_sqlite_memory.js` | Headless test verifying SQLite DB operations and memory import into Kira. |

---

## ⚡ 3. Key Components Deep Dive

### A. The Neural Kernel (`KiraAIProxy` & Worker)
Located around lines 322–925 in [kira_v3.html](file:///home/ubunt/Projects/kira-chat/kira_v3.html#L322-L925):
- `HashEmbed`: Maps tokens to 16-dimensional dense vectors using FNV-1a hashing.
- `MoodNet`: 3-layer MLP classifying context embeddings into 11 mood classes.
- `Scorer`: Learns compatibility matrix $W$ to evaluate $ctx^T \cdot W \cdot resp$.
- `KiraAIProxy`: Manages Web Worker messaging in browsers with automatic inline execution fallback in test environments (Node / JSDOM).

### B. Algebraic Concept Unification (`extractConceptTriple`)
Located around lines 3505–3530 in [kira_v3.html](file:///home/ubunt/Projects/kira-chat/kira_v3.html#L3505-L3530):
- Extracts entities and emotions from user statements (e.g. *"I love building AI tools"* → `{ entity: "building AI tools", action: "engagement" }`).
- Passes concept triples to `fillSentenceSlot()`, filling `{object}` and `{user_mirror}` slots with exact user entities.

### C. Grammar Polish Pipeline (`polishSentence`)
Located around lines 3610–3705 in [kira_v3.html](file:///home/ubunt/Projects/kira-chat/kira_v3.html#L3610-L3705):
- Runs on every generated candidate string before validation and ranking.
- **Article Rule**: Replaces `a` with `an` before vowel sounds (*an electric moment*, *an hour*) while preserving consonant-sounding vowels (*a unique feeling*, *a universe*).
- **Subject-Verb Agreement**: Corrects ungrammatical pairings (*you was* → *you were*, *I is* → *I am*).
- **Gerund Rule**: Transforms verbs following *keep* into gerunds (*keep think* → *keep thinking*), while ignoring non-verbs (*keep the*).

### D. SQLite External Memory Integration
Located in [scripts/kira_db.py](file:///home/ubunt/Projects/kira-chat/scripts/kira_db.py):
- Allows developers to manage Kira's memory from the terminal outside the browser:
  ```bash
  python3 scripts/kira_db.py add "Loves playing electric guitar" --category preference
  python3 scripts/kira_db.py set-profile username "Alex"
  ```
- Generates `kira_db_export.json`, which is synced into Kira's `state.memories[]` and `state.username` via `importSQLiteMemory(payload)`.

---

## 🛠️ 4. How to Extend Kira

### Adding a New Template
1. Open `kira_v3.html` and `sentence_engine_templates.js`.
2. Add a new template object to `SENTENCE_TEMPLATES`:
   ```javascript
   {
     id: 'tech_reflection',
     moods: ['neutral', 'happy', 'thoughtful'],
     minStage: 0,
     topics: ['coding', 'tech'],
     structures: [
       '{opener} I {intensifier} {verb} {object} {closer}'
     ],
     slots: {
       opener: { bank: 'openers', strategy: 'mood' },
       intensifier: { bank: 'intensifiers', strategy: 'stage' },
       verb: { bank: 'verbs_general', strategy: 'mood' },
       object: { bank: 'nouns_abstract', strategy: 'context' },
       closer: { bank: 'closers', strategy: 'stage' }
     }
   }
   ```
3. Run `node tests/production_audit.js` to ensure all slot bank references are valid.

### Adding a New Grammar Rule
1. Open `polishSentence()` in `kira_v3.html`.
2. Add your regex replacement rule:
   ```javascript
   // Example: Fix double prepositions
   s = s.replace(/\b(in|on|at|to)\s+\1\b/gi, "$1");
   ```
3. Add a test case to `grammarTests` in `tests/test_conversational_engine.js`.
4. Run `node tests/test_conversational_engine.js`.

---

## 🛡️ 5. Invariants & Safety Constraints

Maintainers must respect these strictly enforced constraints:
- **INV-01**: `state.affection` is clamped to `[0, 1000]`.
- **INV-02**: `AttentionMem` capacity is hard-capped at 20 entries (`MEM_CAP`).
- **INV-03**: `state.chatHistory` capacity is capped at 200 entries.
- **INV-04**: `generateResponse()` must return a non-empty string under all execution paths.
- **INV-05**: Neural dimensions (`EDIM=16`, `VOCAB=128`, `N_MOODS=11`) are locked to preserve save-state compatibility.
- **INV-08**: **Zero network calls allowed during runtime**.

---

## 🧪 6. Testing Guide

Always run all four test suites before committing changes:

```bash
export PATH=/home/ubunt/.config/nvm/versions/node/v24.18.0/bin:$PATH
node tests/production_audit.js
python3 tests/production_audit.py
node tests/test_conversational_engine.js
node tests/test_sqlite_memory.js
```

All 4 commands should exit with code `0` and print `[PASS]`.
