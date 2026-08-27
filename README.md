# Kira v3 — Deterministic & Neural Hybrid Companion AI

**Kira v3** is a browser-native single-page companion AI built on a hybrid architecture combining a custom ~6.5K Float32 parameter neural engine with a deterministic 51-template Sentence Engine, algebraic concept unification, an automated grammar polishing pipeline, and an external SQLite database memory system (`kira_memory.db`).

The entire runtime operates **100% client-side with zero network dependencies**.

---

## 🌟 Key Capabilities

1. **Deterministic Grammar Polish & Naturalness Engine (`polishSentence`)**
   - **Article Harmony**: Corrects `a` vs `an` before vowel sounds and silent consonants (*an electric moment*, *a unique feeling*, *an hour*).
   - **Subject-Verb & Order Agreement**: Fixes irregular verb combinations (*you were*, *I am*, *I am so*).
   - **Dynamic Gerund Conversion**: Automatically converts verb phrases following *keep* into gerunds (*keep thinking*, *keep taking*) while preserving articles and prepositions (*keep the*).
   - **Contraction & Cadence Smoothing**: Converts rigid phrasing into spoken natural English (*I'm*, *can't*, *it's*, *that's*).
   - **Punctuation & Formatting**: Deduplicates punctuation marks, fixes spacing around clauses, capitalizes sentence starts, and ensures proper terminal punctuation.

2. **Algebraic Concept Unification Engine (`extractConceptTriple`)**
   - Inspired by algebraic concept structures and SLM data pipelines.
   - Parses user input into semantic triples `(entity, action, emotion)`.
   - Dynamically binds user-specified entities (e.g. *"building AI tools"*, *"my exam"*) directly into template slot fillers (`{object}`, `{user_mirror}`), enabling Kira to echo exact personal context.

3. **External SQLite Memory System (`kira_memory.db` & `scripts/kira_db.py`)**
   - Stores memories, user profile facts, and vocabulary in an SQLite database.
   - Includes a standalone command-line management tool ([scripts/kira_db.py](file:///home/ubunt/Projects/kira-chat/scripts/kira_db.py)) to view, add, edit, or delete memories from the terminal outside of Kira.
   - Syncs SQLite state directly into Kira's `state.memories[]` and `AttentionMem`.

4. **Neural Core & Bilinear Response Scorer**
   - **HashEmbed**: FNV-1a n-gram hashing into 16-dimensional dense embedding space (Vocab 128 × Edim 16).
   - **MoodNet**: 3-layer MLP classifying user mood into 11 categories.
   - **Bilinear Scorer**: Ranks response candidates using $Score = 0.55 \cdot \tanh(ctx^T \cdot W \cdot resp) + 0.45 \cdot \cos(ctx, resp)$.
   - **AttentionMem**: 20-turn scaled dot-product context memory.

5. **Adaptive Learning Engine**
   - Adapts personality traits, emoji probability, response length, and temperature using Exponential Moving Averages (EMA) based on implicit user feedback signals.

---

## 🚀 Quickstart

### Running the App
Simply open `kira_v3.html` in any modern web browser (Firefox, Chrome, Edge, Safari):
```bash
# Double-click or open in browser
open kira_v3.html
```

### Operating the SQLite Database CLI
Manage Kira's SQLite memory outside of the browser using Python:
```bash
# List all stored memories & profile facts
python3 scripts/kira_db.py list

# Add a memory
python3 scripts/kira_db.py add "Loves building AI tools" --category preference

# Set user profile facts
python3 scripts/kira_db.py set-profile username "Alex"

# Edit or delete memories
python3 scripts/kira_db.py edit 1 "Updated memory text"
python3 scripts/kira_db.py delete 1

# Export SQLite payload to Kira
python3 scripts/kira_db.py sync-to-kira
```

---

## 🧪 Testing & Verification

Kira v3 includes 4 automated test suites running front-to-back:

```bash
# Run all test runners
export PATH=/home/ubunt/.config/nvm/versions/node/v24.18.0/bin:$PATH
node tests/production_audit.js           # Sentence Engine & Template Audit (Node)
python3 tests/production_audit.py        # Sentence Engine & Template Audit (Python)
node tests/test_conversational_engine.js # 14-Turn JSDOM Multi-Prompt Simulation
node tests/test_sqlite_memory.js        # SQLite DB Integration & Memory Sync Test
```

---

## 📁 Repository Structure

```
kira-chat/
├── kira_v3.html                  # Single-file HTML/CSS/JS application runtime
├── kira_memory.db                # SQLite database storing memories & user profile
├── kira_db_export.json           # Export payload synced between SQLite and Kira
├── sentence_engine_templates.js  # Standalone 51 dynamic sentence templates
├── sentence_engine_wordbanks.js  # Standalone 18 curated word banks
├── AI_RULES.md                   # Invariants & technology guidelines
├── PROGRESS.md                   # Architecture specification & roadmap
├── ONBOARDING.md                 # Developer onboarding guide for LLM engineers
├── scripts/
│   └── kira_db.py                # External SQLite database CLI tool
└── tests/
    ├── production_audit.js       # Production audit (Node.js)
    ├── production_audit.py       # Production audit (Python)
    ├── test_conversational_engine.js # Conversational Engine & Grammar Test
    └── test_sqlite_memory.js     # SQLite Memory Sync Test
```

---

## 📄 License
Licensed under MIT. See `LICENSE` for details.
