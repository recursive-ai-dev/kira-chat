# Kira

**Offline dialogue with inspectable memory, deterministic replay, and checked semantics.**

Kira is an experimental fictional companion built around the **Rotational Semantic Engine (RSE), Draft 4.1**. She runs in a single HTML file and uses explicit parsing rules, a curated lexicon, attributed memories, and authored dialogue plans to carry a conversation.

The current release is **4.1.2**. It requires no account, API key, model download, or backend. The application runs locally and does not use an LLM.

Kira is also a working foundation for a longer-term goal: **NPC dialogue shaped by what characters know, remember, want, and experience in a world that continues without the player.** The current release is a standalone companion and engine demonstrator; a game integration SDK is future work.

## Quick start

1. Download [Kira-4.1.html](dist/Kira-4.1.html). Use your repository host’s download/raw-file option to save the actual HTML.
2. Open the downloaded file in a modern desktop browser.
3. Start a conversation. No installation is required.

The filename remains `Kira-4.1.html`; the application displays version **4.1.2**.

If you downloaded the complete source archive, open `kira/dist/Kira-4.1.html` after extracting it. Browser-only use does not require Node.js. A Web Worker runs the model where supported, with a main-thread fallback if the browser cannot start the local worker.

Try this sequence:

```text
Hello, my name is Damien
I like coffee
I don't like it anymore
Do I like coffee?
```

Kira records the original preference, supersedes it with the correction, and recalls the current report. Open **Memories** to inspect both records and their source messages. Then open **Engine lab → Verify deterministic replay** to reconstruct the conversation from its recorded inputs.

## What Kira can do

| Feature | Current behavior |
| --- | --- |
| Conversation | Introductions, preferences, feelings, attributed notes, supported questions, and contextual follow-ups |
| Memory | Source-linked records, explicit negation, past/present qualifiers, corrections, and retirement |
| Clarification | Meaning choices for ambiguous words; unresolved reports remain uncommitted |
| Personality | Warm, playful, thoughtful, and direct dialogue policies |
| Wording | Absolute register targets and checked alternatives within a shared meaning |
| Semantic queries | Taxonomy, typed part/role relations, lexical relation sets, and supported entailment contexts |
| Vocabulary explorer | Search forms and inspect concepts, parents, subtypes, wording variants, and checked links |
| Inspection | Reply interpretation, memory sources, semantic evidence, and policy traces |
| Replay | Reconstruct state from version-pinned events and compare a canonical digest |
| Local data | Browser saving, JSON export/import, profile images, and opaque image attachments |

Kira can store and display images, but she cannot interpret their contents. Familiarity is fictional character state, not evidence of awareness or emotion.

## A few things to try

| Message | What it exercises |
| --- | --- |
| `I am not sad` | Retains negation without inferring happiness |
| `I used to love coffee` | Keeps a report in the past |
| `Remember this: Alex said "I like tea"` | Saves an attributed note without treating it as your preference |
| `I like bass` | Asks which meaning you intend; try `bass guitar` |
| `I like bass and python` | Resolves both meanings before saving either report |
| `I like atmospheric black metal` | Recognizes a specific concept and opens a music discussion |
| `What is a synthesizer?` | Explains its place in the curated taxonomy |
| `Is python an animal?` | Clarifies the meaning before answering the semantic question |
| `What is a more formal word for synth?` | Checks a same-meaning register shift |
| `What do you remember about me?` | Recalls active attributed records |
| `Tell me a joke` | Selects an authored response deterministically |
| `Give me a writing prompt` | Selects an authored creative prompt |

The parser supports a bounded English grammar. These examples show its supported behavior; they are not a promise that every paraphrase or arbitrary sentence will be understood.

## Lexicon depth

Version 4.1.2 expands the vocabulary across music, instruments, software, hardware, game genres, literature, feelings, food, nature, science, and everyday objects.

| Metric | 4.1.1 | 4.1.2 |
| --- | ---: | ---: |
| Concepts | 83 | 411 |
| Stored word senses | 90 | 429 |
| Concept-alias entries | 106 | 814 |
| Materialized facts | 317 | 2,000 |

The deepest hierarchy spans **seven inclusion edges**. Alias entries include recognized plurals and abbreviations; a form can appear under multiple meanings, so alias counts are not counts of unique words or senses.

Related things remain distinct. Books are separate from reading, songs from music, and games from gaming. Words such as `python`, `bass`, `metal`, `rock`, `rust`, and `orange` have explicit alternative meanings. Style shifts operate only inside a declared meaning: `synth` can become `synthesizer`, while `like` cannot silently become `love`.

See [LEXICON.md](LEXICON.md) for the complete generated inventory, or explore it inside **Engine lab**.

## How it works

Kira follows **Model–View–Presenter** architecture.

| Component | Responsibility | Main files |
| --- | --- | --- |
| Semantic Model | Classify the ontology, answer queries, reconstruct candidate sets, and check evidence | `compiler.js`, `engine.js`, `checker.js`, `audit-query.js` |
| Dialogue Model | Interpret supported language, track conversation context, update memory, and construct reply plans | `parser.js`, `conversation.js`, `dialogue.js`, `dialogue-assets.js` |
| Presenter | Serialize turns, record timestamps, call the model, and save before publishing new state | `presenter.js`, `worker-entry.js` |
| View | Render conversation, memory, vocabulary, settings, and evidence | `view.js`, `shell.html`, `style.css` |
| Persistence adapter | Store a complete event log and validate exports/imports | `persistence.js` |

These files live in `src/`. The pure models do not read the DOM, browser storage, wall clock, network, or random generators.

Each turn consumes the previous state, an explicit recorded event, and versioned assets. Dialogue selection uses stable rules and tie-breaks. Replay reuses the original events and timestamps. Display details such as local time formatting sit outside the canonical model state.

Memories record **what the user reported**, including their source message. A correction supersedes a matching record; retirement excludes it from active recall while retaining its history. Conversational elaborations can remain quoted context without becoming asserted facts.

### What “checked” means

The semantic query engine proposes a result. A separately implemented reference checker reconstructs the expected result and evidence before the application uses it.

| RSE area | Implemented application profile |
| --- | --- |
| L1 | Named-concept subsumption, typed existential roles, explicit disjointness, supported transitive role chains, and closure checking |
| L2 | Integer potentials and bounded potential-difference costs |
| L3 | Seven-bit relation sets, generated composition/projectivity tables, possible equality under inclusion, and explicit non-vacuity premises |
| L4 | Two linear coordinates, exact weighted L1 distance, same-fiber candidate checks, relative shifts, and absolute realization |
| Routing | Capability admission and a strict-subsumption frontier followed by dialogue policy |
| Evidence | Artifact hashes, grounded proof references, computation certificates, and reply traces |

A successful check establishes a result **relative to the supplied axioms and premises**. It does not establish that those assumptions are true, that the parser understood arbitrary English, or that a user’s report is factual.

The lexicon is **experimental and independently unreviewed**. The checker is handwritten JavaScript, not formally verified or extracted from a proof assistant. This is a bounded implementation profile, not full implementation of every facility in Draft 4.1.

## Development

Use **Node.js 20 or newer**. The build and tests use Node’s built-in modules; no `npm install` is required.

Run these commands from the directory containing `package.json`:

```sh
# Rebuild the standalone app and run all tests
npm run verify

# Build or test separately
npm run build
npm test

# Regenerate the lexicon inventory after a build
node tools/lexicon-report.cjs

# Record timing samples on your machine
node tools/benchmark.cjs
```

Generated application files:

- `dist/Kira-4.1.html` — complete offline application.
- `dist/artifact.json` — compiled semantic artifact.
- `dist/manifest.json` — release metadata and content hashes.
- `dist/benchmark.json` — host-specific measurements, generated by the benchmark command.

### Extending Kira

| Change | Start here |
| --- | --- |
| Add vocabulary, aliases, and inclusion relationships | `src/lexicon-seed.js` |
| Change the base ontology or capability registry | `src/seed.js` |
| Add dialogue phrasing or topic prompts | `src/dialogue-assets.js` |
| Extend interpretation or follow-up handling | `src/parser.js`, `src/conversation.js` |
| Change memory or reply-planning behavior | `src/dialogue.js` |
| Change interface behavior or presentation | `src/view.js`, `src/shell.html`, `src/style.css` |

Keep concept and sense IDs stable, declare ambiguity explicitly, and retain provenance. New aliases must not collapse related concepts into a single meaning. Add regression cases for both the intended reading and plausible misreadings, then rebuild and verify.

For exploration in the browser developer console, the application exposes a small diagnostic API:

```js
await KiraApp.query({
  op: 'subsumes',
  a: 'c:analog-synthesizer',
  b: 'c:musical-instrument'
});

await KiraApp.replay();
```

This is a diagnostic interface, not a published game integration SDK.

## Saving, privacy, and compatibility

The application has no remote inference service, telemetry, or runtime network dependencies. Its content security policy blocks application network connections.

Sessions use browser-local storage where available. Local saves and exported JSON are **not encrypted**. Storage availability and file-origin behavior depend on the browser; moving the HTML, using private browsing, or clearing browser data can affect access to a session.

Use **Settings & data → Export session** to keep a portable backup. If the app reports a temporary session, export before closing it.

Exports contain recorded events and pinned asset identities, with a digest used to verify the reconstructed state. Imports replay the log rather than trusting a supplied state snapshot. A failed save leaves the previously committed conversation intact.

Version 4.1.2 uses a separate storage key, leaving older saves untouched. Earlier exports remain tied to their original model. The source package includes readers for [4.1.0](compat/Kira-4.1.0.html) and [4.1.1](compat/Kira-4.1.1.html). Changing parser rules, dialogue assets, or the ontology can change replay results; there is no automatic migration across incompatible model hashes.

Older Kira v3 transcripts can be appended as unverified archives. Their learned weights and inferred memories are not promoted into current semantic facts.

## Validation and current limits

The 4.1.2 build passed **60 automated tests**, covering semantic closure, forged evidence, numeric and Unicode behavior, ambiguity, negation, correction, memory attribution, worker execution, deterministic replay, corrupt imports, save failures, tab conflicts, and focused view regressions.

The bundle’s scripts and element references receive static checks. Real-browser visual and interaction coverage is still incomplete; the tests do not establish cross-browser conformance or formal verification. Benchmark results are measurements on the machine running the script, not performance guarantees for other devices.

Current practical limits:

- 1,000 recorded events per session, including settings and other state changes.
- 2,000 characters per message.
- An encoded-save guard below 4.5 million characters; browser quota may be smaller.
- Up to 200 legacy messages per import, with bounded image payloads.
- A bounded grammar and authored reply plans, rather than unrestricted language generation.

State copying, save encoding, and replay grow with session length. The implementation targets a compact personal dialogue and curated ontology. Web Locks are used for turn commits when available; fallback conflict checks do not provide a general atomic transaction across tabs.

L5 discovery, arbitrary ontology imports, unrestricted coordinate systems, neural learning, image understanding, and multi-agent world simulation are outside the current release.

## Direction

Kira is an experimental step toward natural-feeling NPC conversations whose content comes from character and world state. Areas to explore include individual knowledge and mistaken beliefs, character goals, witnessed events and rumors, relationship-aware dialogue, richer sentence realization, and reusable authoring tools.

Those are development directions, not shipped features. The immediate focus is improving conversational continuity while keeping behavior reproducible and inspectable.

## Reporting problems

A useful dialogue bug report includes:

- The application version and browser.
- The exact message sequence, including relevant settings or clarification choices.
- What happened and what you expected.
- Whether **Verify deterministic replay** reports a match.

A short reproducible conversation is especially useful. Review exported sessions before sharing them: they can contain personal messages, notes, and images.
