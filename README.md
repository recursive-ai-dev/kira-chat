# Kira

**Offline dialogue with inspectable memory, deterministic replay, and checked semantics.**

Kira is an experimental fictional companion built around the **Rotational Semantic Engine (RSE), Draft 4.1**. She runs in a single HTML file and uses explicit parsing rules, a curated lexicon, attributed memories, and structured sentence plans to carry a conversation. Controlled grammars compose memory replies, social dialogue, general topic questions, fictional jokes, and writing prompts.

The platform release is **4.5.0**: the **4.4.0 companion app**, plus **Narrative SDK 0.3.0** for independent game characters. Neither requires an account, API key, model download, backend, or LLM.

Kira also provides **NPC dialogue shaped by what characters know, remember, and want**. The new SDK shares one semantic engine across independent characters, keeps private conversations separate, delivers witnessed events and attributed rumours, composes authored phrases, and replays complete world sessions. The host game controls time and actions. See the [Narrative SDK guide](docs/narrative-sdk.md).

## Multi-character narrative SDK

```sh
npm run example   # a complete deterministic two-character demonstration
npm run demo      # http://localhost:8042/examples/station.html
```

Load `KiraSDK.js` in a browser or `require('./KiraSDK.js')` in Node. Author custom topics, facts, characters, goals and reply rules in JSON; compile them with `node tools/narrative.cjs source.json compiled.json`. The SDK combines authored phrases with grammar-generated memory reports, with a separate Kira conversation state for each character/partner pair.

The station example demonstrates different voices, information held by only one character, rumours, memory callbacks, goal-driven initiative, and exact export/import replay. Custom narrative vocabulary is separate from the existing compiled RSE ontology. Full API, event formats, authoring rules and limits are in the [SDK guide](docs/narrative-sdk.md).

## Android app

`android/` wraps the unchanged `Kira.html` in a small native WebView shell (no network permission, no dependencies beyond the Android Gradle plugin). The page is served from an internal `https://` origin so saving, the Web Worker and replay behave exactly as in a desktop browser. The shell adds a file picker for imports and images, a system save dialog for exports, the back button, and system-bar colours that follow the theme. Phones get a bottom tab bar.

```sh
npm run build                    # regenerate Kira.html first
cd android && gradle assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

Requires JDK 17 and an Android SDK (platform 36); set `sdk.dir` in `android/local.properties`. The release APK is signed with the debug key so it can be sideloaded; supply your own signing config before publishing. Data lives in the app's private storage, so use **Settings → Export** before uninstalling.

## Vocabulary, themes and variety

Kira's topics and wording grow through four layers, all deterministic and replay-safe: a checked curated lexicon (646 concepts), authored theme packs (`themes/`), a WordNet-derived word table, and variable `⟦a|b|c⟧` slots that vary wording. Add your own themes as short text files. See [docs/themes.md](docs/themes.md). On top of them, a **ring field** places every topic as an overlapping ring and moves the conversation through it, so follow-ups, bridges between topics and “that reminds me…” recalls follow geometry instead of chance. See [docs/field.md](docs/field.md).

## Quick start

1. Download [Kira.html](Kira.html). Use your repository host’s download/raw-file option to save the actual HTML.
2. Open the downloaded file in a modern desktop browser.
3. Start a conversation. No installation is required.

The bundled application version is **4.4.0**.

If you downloaded the complete source archive, open `Kira.html` after extracting it. Browser-only use does not require a build step. A Web Worker runs the model where supported, with a main-thread fallback if the browser cannot start the local worker.

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
| Sentence generation | Grounded memory clauses, coordinated reports, corrections, conversational speech acts, and general topic questions |
| Creative generation | Explicitly fictional wordplay and story prompts composed from compatible lexical frames |
| Semantic queries | Taxonomy, typed part/role relations, lexical relation sets, and supported entailment contexts |
| Vocabulary explorer | Search forms and inspect concepts, parents, subtypes, wording variants, and checked links |
| Inspection | Reply interpretation, memory sources, semantic evidence, and policy traces |
| Replay | Reconstruct state from version-pinned events and compare a canonical digest |
| Local data | Browser saving, JSON export/import, profile images, and opaque image attachments |

Kira can store and display images, but she cannot interpret their contents. Familiarity is fictional character state, not evidence of awareness or emotion.

## Sentences from meaning

Memory acknowledgments and recalls use sentence trees containing subject, predicate, object, tense, polarity, and source references. The grammar coordinates compatible objects, keeps mixed reports in separate clauses, and inflects negation and correction verbs. It can compose object combinations that have no authored reply sentence:

| Reports | Generated wording |
| --- | --- |
| `I like cloudberry jam and violet tea` | `You like cloudberry jam and violet tea.` |
| `I like coffee and I do not like tea` | `You like coffee. You do not like tea.` |
| `I was not anxious` | `You told me that you did not feel anxious.` |
| `I like coffee`, then `I don't like it anymore` | `You previously reported liking coffee, but now you report not liking coffee.` |

Each generated span carries its sentence tree, grammar derivation, source memory IDs, and digest. Verification grounds its clauses in the records and reconstructs its exact text. Historical clauses are allowed only inside a correction linked to an actual supersession. Notes stay attributed quotations; potentially clause-like object labels are quoted as literals. Open **Sources & reasoning** to inspect the derivations.

These checks apply to the generated spans. They do not certify the meaning of arbitrary authored prose or the truth of a user's reports. The input parser remains bounded; sentence generation does not give Kira unrestricted understanding or new world knowledge.

Social turns now compose speech acts such as greetings, permission, availability, acknowledgment, and invitations. Question plans use grammatical argument frames and preserve the exact question displayed to the user. Refused subjects stay out of automatic memory callbacks until explicitly reintroduced; compound turns ask at most one optional conversational question.

Jokes combine personified objects, word-sense mechanisms, compatible requests, characters, and settings. Writing prompts combine a character, goal, setting, complication, stakes, perspective, and decision within six story domains. Their visible `Fictional joke:` and `Writing prompt:` prefixes identify invention. Generated spans record `reported`, `conversation`, `fiction`, or `mixed` scope, reconstructed by the checker. Fiction never becomes a user memory or evidence for a world fact. Grammar and compatibility checks do not judge humor or literary quality.

## A few things to try

| Message | What it exercises |
| --- | --- |
| `I am not sad` | Retains negation without inferring happiness |
| `I used to love coffee` | Keeps a report in the past |
| `I like coffee, tea, and jazz` | Coordinates a comma list while retaining separate source-linked memories |
| `Coffee is something I enjoy` | Interprets an explicit preference paraphrase without changing its strength |
| `I no longer like coffee` | Corrects the current preference while preserving its history |
| `Remember this: Alex said "I like tea"` | Saves an attributed note without treating it as your preference |
| `I like bass` | Asks which meaning you intend; try `bass guitar` |
| `I like bass and python` | Resolves both meanings before saving either report |
| `I like atmospheric black metal` | Recognizes a specific concept and opens a music discussion |
| `My favorite band is Radiohead` | Saves a stated favorite as a preference, keeping your casing |
| `What can you do?` | Lists the kinds of sentences Kira understands |
| `What is a synthesizer?` | Explains its place in the curated taxonomy |
| `Is python an animal?` | Clarifies the meaning before answering the semantic question |
| `What is a more formal word for synth?` | Checks a same-meaning register shift |
| `What do you remember about me?` | Recalls active attributed records |
| `Tell me a joke`, then `another one` | Composes distinct fictional wordplay deterministically |
| `Give me a writing prompt` | Composes a fictional situation and a writing task |
| `Can you remind me what I like?` | Recalls current preferences through a natural question paraphrase |

The parser supports a bounded English grammar. These examples show its supported behavior; they are not a promise that every paraphrase or arbitrary sentence will be understood.

## Lexicon depth

Version 4.2.0 ships the expanded vocabulary across music, instruments, software, hardware, game genres, literature, feelings, food, nature, science, and everyday objects. The figures below compare 4.1.1 with the expanded 4.1.2 lexicon, which 4.2.0 carries forward unchanged.

| Metric | 4.1.1 | 4.1.2 |
| --- | ---: | ---: |
| Concepts | 83 | 411 |
| Stored word senses | 90 | 429 |
| Concept-alias entries | 106 | 814 |
| Materialized facts | 317 | 2,000 |

The deepest hierarchy spans **seven inclusion edges**. Alias entries include recognized plurals and abbreviations; a form can appear under multiple meanings, so alias counts are not counts of unique words or senses.

Related things remain distinct. Books are separate from reading, songs from music, and games from gaming. Words such as `python`, `bass`, `metal`, `rock`, `rust`, and `orange` have explicit alternative meanings. Style shifts operate only inside a declared meaning: `synth` can become `synthesizer`, while `like` cannot silently become `love`.

Explore the vocabulary inside **Engine lab**.

## How it works

Kira follows **Model–View–Presenter** architecture.

| Component | Responsibility | Main files |
| --- | --- | --- |
| Semantic Model | Answer queries and check evidence against the bundled artifact | `src/model/artifact-checker.js`, `query-checker.js`, `engine.js` |
| Dialogue Model | Interpret supported language, track conversation context, update memory, and construct reply plans | `src/model/parser.js`, `conversation.js`, `dialogue.js`, `dialogue-assets.js` |
| Sentence realizer | Build and check sentences from grounded meaning trees | `src/model/realization.js` |
| Conversation generator | Plan speech acts and questions from grammatical argument frames | `src/model/interaction.js` |
| Creative generator | Plan and check compatible fictional scenes and wordplay | `src/model/creative.js` |
| Presenter | Serialize turns, record timestamps, call the model, and save before publishing new state | `src/browser/presenter.js`, `src/worker-entry.js` |
| View | Render conversation, memory, vocabulary, settings, and evidence | `src/browser/view.js`, `src/shell.html`, `src/style.css` |
| Persistence adapter | Store a complete event log and validate exports/imports | `src/browser/persistence.js` |

The shared model is bundled once for the page and once for the worker by `tools/build.py`. The pure models do not read the DOM, browser storage, wall clock, network, or random generators. `src/model/artifact-data.js` and `unicode-data.js` contain frozen compiled data; this checkout does not include the source compiler or lexicon seed used to create them.

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

Use **Python 3.9 or newer** to rebuild the standalone file and **Node.js 20 or newer** to run the tests. Browser-only use needs no development tools. There are no runtime or test dependencies to install.

Run these commands from the repository root:

```sh
# Rebuild the standalone app
python3 tools/build.py

# Check that the standalone app matches the modular source
python3 tools/build.py --check

# Run the conversation, canonical, persistence, and presenter tests
node --test tests/*.test.cjs
```

Or, with npm:

```sh
npm run build     # rebuild Kira.html and KiraSDK.js
npm run check     # verify both generated deliverables
npm test          # run every test file
npm run test:nlg  # adversarial dialogue, grammar, composition and source-grounding regressions
npm run verify    # check + test, the same pair CI runs
```

Every push to `main` and every pull request runs the build checks and tests on Node 20 and Node 24 with the documented Python floor.

`Kira.html` is the generated offline application. The build concatenates the model modules in a fixed order for both the page and the worker, then inserts the browser code, style, and HTML shell. `--check` verifies the generated file byte for byte. The build also checks that the pinned model hash matches the model source; dialogue changes require a new release version and storage key.

### Test layout

| File | Covers |
| --- | --- |
| `tests/conversation.test.cjs` | Memory correction, ambiguity, attribution, support follow-ups, deterministic replay |
| `tests/canonical.test.cjs` | SHA-256 vectors, canonical encoding, NFC, merkle roots, potentials, artifact verification and tamper rejection, optimizer against the reference checker |
| `tests/persistence.test.cjs` | Session envelopes, checksum and version pinning, multi-tab conflicts, event validation |
| `tests/presenter.test.cjs` | Startup and replay ordering, save failures, import/reset locking, corrupt-save recovery, temporary sessions |
| `tests/narrative.test.cjs` | Compiler validation, character/speaker isolation, beliefs, rumours, goals, phrase composition, SDK loading, and world replay |
| `tests/adversarial-*.test.cjs` | Refusals and question pauses, repair feedback, tense and pronouns, literal notes, exact displayed follow-ups, grounded report slots, and phrase-combination coverage |
| `tests/realization.test.cjs` | Grammar and morphology, novel combinations, correction provenance, literal quoting, tamper rejection, and expansion bounds |
| `tests/compositional-*.test.cjs` | Generated companion replies, exact text spans, SDK report fragments, honest authored overrides, and deterministic replay |
| `tests/generative-dialogue.test.cjs` | Conversation and fiction scope, continued creative requests, exact question links, pauses, refusals, and compound turns |
| `tests/helpers/load-model.cjs` | Loads the model and browser adapters out of `Kira.html` and runs code inside its realm |

Companion tests read the model and browser adapters out of generated `Kira.html`; narrative tests load generated `KiraSDK.js`. Both exercise shipped bytes rather than re-concatenating `src/`.

The adversarial suite includes long conversations across all four personas and three register settings, with exact replay checks. It tests inputs such as “Stop asking me questions”, “I was sad”, “I prefer tea to coffee”, and repeated coffee reports after newer tea memories. The companion now respects question pauses until explicitly resumed, retains past tense and note wording, and asks for a direct preference when it cannot safely store a comparison. The SDK grounds report wording in the selected source memory and cycles through phrase combinations without building their Cartesian product. These checks cover a bounded English grammar; they do not measure general language fluency.

One constraint is worth knowing before adding tests: the model runs inside a `vm` context, and `canonical()` only accepts objects whose prototype is that context's `Object.prototype`. A query object built in a test file is therefore rejected as *not canonical JSON data*. Build such objects with the loader's `query()`/`run()` helpers, which marshal them through JSON into the model's realm. In a browser the whole app shares one realm, so this never affects the application.

### Extending Kira

| Change | Start here |
| --- | --- |
| Add dialogue phrasing or topic prompts | `src/model/dialogue-assets.js` |
| Extend interpretation or follow-up handling | `src/model/parser.js`, `src/model/conversation.js` |
| Change memory or reply-planning behavior | `src/model/dialogue.js` |
| Add sentence structures or grammar rules | `src/model/realization.js` |
| Add social acts or general question frames | `src/model/interaction.js` |
| Add compatible story or wordplay structures | `src/model/creative.js` |
| Change query behavior or checking | `src/model/engine.js`, `src/model/query-checker.js` |
| Change interface behavior or presentation | `src/browser/view.js`, `src/shell.html`, `src/style.css` |

The compiled semantic artifact is version pinned. Changing vocabulary or ontology data requires regenerating the artifact and its hashes with the original compiler, which is not included here. For dialogue changes, add regression cases for the intended reading and plausible misreadings, then rebuild and check the standalone file. Existing session exports remain tied to their original model hash.

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

Version 4.4.0 uses a separate storage key, leaving older saves untouched. Earlier exports remain tied to their original model. Changing parser rules, dialogue assets, or the ontology can change replay results; there is no automatic migration across incompatible model hashes.

Older Kira v3 transcripts can be appended as unverified archives. Their learned weights and inferred memories are not promoted into current semantic facts.

## Validation and current limits

The source checkout includes a byte-for-byte build check and a focused test suite covering corrections, ambiguity, unsupported reports, support follow-ups, attribution, deterministic replay, canonical hashing and encoding, artifact verification, query auditing, and session persistence. Real-browser visual and interaction coverage is incomplete; these checks do not establish cross-browser conformance or formal verification.

Current practical limits:

- 1,000 recorded events per session, including settings and other state changes.
- 2,000 characters per message.
- An encoded-save guard below 4.5 million characters; browser quota may be smaller.
- Up to 200 legacy messages per import, with bounded image payloads.
- A bounded input parser and controlled generation grammars, with explicit lists of supported paraphrases, speech acts, and fictional frames. Quoted, uncertain, attributed, malformed, and oversized report batches remain uncommitted.
- Authored theme openers and specialized cues, crisis wording, fictional flirting, semantic explanations, and operational messages remain available. Only marked generated spans carry grammar derivations.

State copying, save encoding, and replay grow with session length. The implementation targets a compact personal dialogue and curated ontology. Web Locks are used for turn commits, imports, and resets when available; fallback conflict checks do not provide a general atomic transaction across tabs.

L5 discovery, arbitrary ontology imports, unrestricted coordinate systems, neural learning, image understanding, and autonomous world simulation are outside the current release. Narrative SDK limits and explicit host-controlled event delivery are documented separately in the [SDK guide](docs/narrative-sdk.md).

## Direction

The Narrative SDK now supplies a first reusable implementation of private character memory, individual and mistaken beliefs, witnessed events, attributed rumours, relationship conditions, goals, and compositional reply authoring. It is independent of any particular game.

Next directions include broader language interpretation, richer conversational and fictional planning, evaluation of dialogue and creative quality, tooling for larger authored worlds, explicit asset migrations, and host integrations that schedule characters and physical actions. Autonomous simulation and a compiler for the underlying RSE ontology remain future work.

## Reporting problems

A useful dialogue bug report includes:

- The application version and browser.
- The exact message sequence, including relevant settings or clarification choices.
- What happened and what you expected.
- Whether **Verify deterministic replay** reports a match.

A short reproducible conversation is especially useful. Review exported sessions before sharing them: they can contain personal messages, notes, and images.
