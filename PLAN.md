# ALMEE Execution Plan — kira-chat

## Purpose Summary
`kira-chat` (v4.6.0) is a deterministic, single-file offline reflective companion (`Kira.html`) paired with a Narrative SDK (`KiraSDK.js`, v0.4.0) and an Android wrapper (`android/`). User messages flow through a bounded semantic parser (`src/model/parser.js`), a conversational act/context parser (`src/model/conversation.js`), a verifiable state-machine and dialogue planner (`src/model/dialogue.js`, `src/model/engine.js`), and an algorithmic ring-field/grammar NLG pipeline (`src/model/field.js`, `src/model/interaction.js`, `src/model/creative.js`, `src/model/realization.js`), rendered in the browser via an MVP bridge (`src/browser/presenter.js`, `src/browser/view.js`, `src/browser/persistence.js`). Build tooling (`tools/build.py`) compiles `src/` into `Kira.html` and `KiraSDK.js` with pinned SHA-256 `APP_META` digests.

Phases 1–3 audit identified three concrete logic-chain and UI-state defects:
1. Multi-sentence (`2..6` sentences) answers to a pending `detail` follow-up question are misclassified as rejected `compound` reports in `src/model/conversation.js`, wiping `state.context.pending`.
2. Secondary `c:about` acts inside compound messages drop `act.aboutKind` and `act.object` in `src/model/dialogue.js`, and `state.context.pending = null` runs after handling the secondary act instead of before.
3. Empty-conversation resets in `src/browser/view.js` clear `rendered`, `renderStart`, and `lastDay` without resetting `lastCount`, breaking post-reset scroll-to-latest, `#jump-latest`, and hidden-tab title updates until the previous message count is exceeded.

## Code Map
- **Core Model (`src/model/`)**:
  - `canonical.js`, `unicode.js`, `artifact-checker.js`, `query-types.js`, `query-checker.js`, `engine.js`: canonical CBOR, hashing, bounded queries (`route`, `verifyPlan`), artifact verification.
  - `parser.js`: bounded frame extraction (`preference`, `mood`, `note`, `recall`, `forget`, `sense`).
  - `conversation.js`: conversational act classification (`c:*`), compound splitting, repair detection, `pending` follow-up resolution, question ladders (`questionReply`).
  - `dialogue.js`: `DialogueModel` state transitions, `afterActs` handling, `ask`/`askLastQuestion`, `verifyPlan`, `replay`, `Kira.APP_META`.
  - `field.js`, `variation.js`, `interaction.js`, `creative.js`, `realization.js`, `dialogue-assets.js`, `themes.js`: NLG ring field and template/grammar realization.
- **Browser UI (`src/browser/`, `src/`)**:
  - `persistence.js`, `presenter.js`, `view.js`, `worker-entry.js`, `shell.html`, `style.css`: IndexedDB/localStorage state, Web Worker bridge with inline fallback, incremental DOM message rendering (`View.renderMessages`).
- **Narrative SDK (`src/narrative/`)**:
  - `compiler.js`, `world.js`: narrative package compilation and world simulation (`KiraSDK.js`).
- **Build & Packaging (`tools/`, `tests/`)**:
  - `tools/build.py`, `tools/build-themes.cjs`, `tools/extend-artifact.cjs`, `tools/package-release.py`, `tests/*.test.cjs`, `tests/test_*.py`.

## Architectural Risks
- **Generated Deliverable Drift**: Tests load `Kira.html` (`tests/helpers/load-model.cjs`) and `KiraSDK.js`, and `tools/build.py --check` enforces byte-for-byte parity plus matching `APP_META.modelHash`/`artifactHash`. Any edit under `src/` requires running `python3 tools/build.py --pin` before running Node tests.
- **Compound vs. Follow-up Ambiguity**: Relaxing compound rejection in `src/model/conversation.js` must not allow partial report commits, ambiguous inputs, non-`unparsed` failures, trailing questions, or repair feedback (whole-message or per-part) to slip into `questionReply`.
- **Browser Smoke Environment**: `node tools/browser-smoke.cjs` currently fails in this environment because Playwright's chromium headless shell binary is not installed; DOM view behavior is verified via `tests/browser-view.test.cjs`.

## Roadmap
- [x] **ALMEE-01** — Fix multi-sentence `detail` follow-up replies in `src/model/conversation.js`
  - **Objective**: Extract a shared `isRepairFeedback(sample)` helper and route `2..6`-sentence purely unparsed non-question, non-repair answers to a `pending.kind === 'detail'` question to `questionReply(raw, pending)` instead of rejecting them as `compound`, while preserving strict `compound` rejection for partial reports, ambiguities, non-`unparsed` failures, questions, and repair feedback.
  - **Target Files**: `src/model/conversation.js`
  - **Verification**: Code inspection + passing `tests/conversation.test.cjs` and `tests/adversarial-conversation.test.cjs` (after `ALMEE-04` build).
- [x] **ALMEE-02** — Preserve `aboutKind`/`object` and `pending` ordering for secondary `c:about` acts in `src/model/dialogue.js`
  - **Objective**: Extract `replyAbout(act)` inside `step()` so both primary `case 'about'` and `afterActs` entries with `act.intent === 'c:about'` handle `capabilities`, `honest`, `taste`, `favorite`, and fallback `'about'` consistently (trimming trailing whitespace when `ask(...)` returns empty string), and clear `state.context.pending = null` before rendering each `afterActs` item so follow-up questions posed by `taste`/`favorite` on the final act survive.
  - **Target Files**: `src/model/dialogue.js`
  - **Verification**: Code inspection + passing `tests/generative-dialogue.test.cjs` and `tests/conversation.test.cjs` (after `ALMEE-04` build).
- [x] **ALMEE-03** — Reset `lastCount` on empty message list in `src/browser/view.js`
  - **Objective**: Set `this.lastCount = 0;` in the `!msgs.length` branch of `View.renderMessages()` so post-reset messages accurately compute `added = msgs.length > this.lastCount`.
  - **Target Files**: `src/browser/view.js`
  - **Verification**: Code inspection + passing `tests/browser-view.test.cjs` (after `ALMEE-04` build).
- [x] **ALMEE-04** — Rebuild pinned deliverables and add targeted regression tests
  - **Objective**: Run `python3 tools/build.py --pin` to update `APP_META` hashes and regenerate `Kira.html` and `KiraSDK.js`, and add focused regression tests covering all three fixes.
  - **Target Files**: `Kira.html`, `KiraSDK.js`, `src/model/dialogue.js`, `tests/adversarial-conversation.test.cjs`, `tests/browser-view.test.cjs`
  - **Verification**: `python3 tools/build.py --check` and new regression assertions pass.
- [x] **ALMEE-05** — Run full verification suite and finalize `PLAN.md`
  - **Objective**: Run `tools/build.py --check`, `tools/build-themes.cjs --check`, `tools/extend-artifact.cjs --check`, `node --test tests/*.test.cjs`, `python3 -m unittest discover -s tests -p 'test_*.py'`, and `node examples/station.cjs`; mark all steps `[x]` and finalize the Execution Log.
  - **Target Files**: `PLAN.md`
  - **Verification**: All verification checks exit 0 with zero test failures.

## Execution Log
- **Baseline (pre-edit)**: `tools/build.py --check`, `tools/build-themes.cjs --check`, `tools/extend-artifact.cjs --check`, `node --test tests/*.test.cjs` (`242` pass, `0` fail), and `python3 -m unittest discover -s tests -p 'test_*.py'` (`3` pass) all passed on commit `fc0a5b7`. `node tools/browser-smoke.cjs` failed due to missing Playwright browser binary.
- **ALMEE-01 [x]**: Extracted `isRepairFeedback` and `isDetailAnswerText` in `src/model/conversation.js` and allowed purely unparsed, non-question, non-repair multi-sentence (`2..6` sentences) answers to `pending?.kind === 'detail'` questions to reach `questionReply(raw, pending)` instead of triggering `compound` rejection.
- **ALMEE-02 [x]**: Extracted `appendAbout(act, prefix)` in `src/model/dialogue.js`, cleared `state.context.pending = null` before evaluating each secondary act in `afterActs`, and routed secondary `c:about` acts through `appendAbout(act, '\n\n')` so `aboutKind`, `object`, and final follow-up `pending` state are preserved.
- **ALMEE-03 [x]**: Updated `View.renderMessages()` in `src/browser/view.js` to reset `this.lastCount = 0` when `!msgs.length`.
- **ALMEE-04 [x]**: Rebuilt and pinned `Kira.html` and `KiraSDK.js` via `python3 tools/build.py --pin` (`artifactHash e0161a12cde6…`, `modelHash 35617ceafae9…`) and added 3 regression tests in `tests/adversarial-conversation.test.cjs` and `tests/browser-view.test.cjs`.
- **ALMEE-05 [x]**: Full verification suite exited 0:
  - `python3 tools/build.py --check`: `Kira.html matches the modular source.` / `KiraSDK.js matches the modular source.`
  - `node tools/build-themes.cjs --check`: `theme-packs.js matches themes/*.txt (23 topics, 328 words).`
  - `node tools/extend-artifact.cjs --check`: `Artifact accepted: 646 concepts, 664 senses, 674 axioms, 3050 derived facts.`
  - `node --test --test-reporter=dot tests/*.test.cjs`: `245` tests passed (`0` failures; `19/19` in targeted `tests/adversarial-conversation.test.cjs` + `tests/browser-view.test.cjs`).
  - `python3 -m unittest discover -s tests -p 'test_*.py'`: `3` tests passed in `0.208s` (`OK`).
  - `node examples/station.cjs`: `Exact replay: true`.
