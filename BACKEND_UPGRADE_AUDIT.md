# Kira v3 Reliability Upgrade — 5-Stage Delivery

## Stage 1 — Logic Chain Reconnaissance

### 1) Logic Chain Map (input → state transition → side effects)

| Chain ID | Entry | State transitions | Side effects | Reliability surface |
|---|---|---|---|---|
| LC-01 | `sendMessage(text)` | `messagesSent++`, `lastMessageTime`, `conversationCount`, `messagesReceived`, `chatHistory[]`, `CTX.*` | UI append, delayed response, localStorage writes | Atomicity + idempotency + deterministic RNG seed |
| LC-02 | `generateResponse(userText)` | `conversationDepth++`, `messagesReceived++`, `affection`, `mood`, `energy`, topic counters, memory extraction | MoodNet online updates, scorer ranking, trace append | Deterministic dispatch ordering + bounded updates |
| LC-03 | `detectUserMoodRegex(text)` | `userMoods[]` append/prune | none | Deterministic classification + bounded list |
| LC-04 | `addAffection(n)` | clamped `affection` + stage transition | system message emit | Invariant enforcement (0..1000), monotonic clamp |
| LC-05 | `addMemory(text,type)` | append/prune `memories[]` | none | Deterministic timestamp and bounded memory |
| LC-06 | `persistAtomically(reason)` | none directly (snapshot only) | staged + committed localStorage persistence for state+AI | **Atomicity-critical** (no split brain between state and AI) |
| LC-07 | image upload/paste handlers | `messagesSent++`, `conversationCount++`, `chatHistory[]` | FileReader, canvas compression, image cache write, localStorage write | Atomicity and bounded cache consistency |
| LC-08 | `boot()` | streak fields, `lastVisit`, `lastGreeting` | history render, initial message enqueue, persistence | Recovery semantics for interrupted persistence |

### 2) Reliability Surfaces

| Surface | Where required | Current/updated requirement |
|---|---|---|
| Atomicity | state + AI persistence | Commit both snapshots together (`persistAtomically`) with transaction marker and recovery sweep |
| Idempotency | retries after exceptions and delayed callbacks | deterministic correlation IDs, bounded appends, replay-safe save path |
| Determinism | routing, timestamps, random picks, IDs | injected `ENV` clock/seed/id factories and seeded RNG routing |
| Invariant safety | affection/history/memory caps | strict clamps/pruning on every transition boundary |

### 3) Function Index (intent + dependencies)

| Function | Intent | Dependencies |
|---|---|---|
| `trace` | append diagnostics trace ring buffer | `DIAG`, `ENV.nowMs` |
| `setRoute` | persist current route label for diagnostics | `DIAG`, `trace` |
| `summarizeTrace` | compact trace-tail string for settings panel | `DIAG.traces` |
| `setCTX` | reset conversation context thread | `CTX` |
| `advanceCTX` | increment context age, clear stale context | `CTX` |
| `isContinuation` | classify message as answer to pending question | `CTX.pendingQ`, regex |
| `handleContinuation` | continuity follow-up reply selection | `CTX`, `kiraAI.rank` |
| `loadImages` | hydrate image cache from storage | `localStorage`, `IMG_KEY` |
| `_saveImages` | persist image cache with eviction on quota | `localStorage`, recursion |
| `storeImage` | generate image ID + cache image payload | `_imgCache`, `ENV.makeId` |
| `getImage` | image lookup by opaque ID | `_imgCache` |
| `pruneImages` | remove unreferenced images from cache | `state.chatHistory`, `_saveImages` |
| `loadProfilePic` | load avatar image from storage | `PIC_KEY`, `localStorage` |
| `saveProfilePic` | persist avatar image | `PIC_KEY`, `localStorage` |
| `removeProfilePic` | delete avatar image | `PIC_KEY`, `localStorage` |
| `applyProfilePic` | render avatar in header/settings | DOM nodes |
| `mulberry32` | seeded PRNG generator | integer math |
| `parseSeed` | parse deterministic seed from URL | `location.search`, `Date.now` fallback |
| `pick` | sample one value | `rng` |
| `chance` | Bernoulli draw | `rng` |
| `randInt` | integer draw on interval | `rng` |
| `getTimeOfDay` | map clock hour to 7 bins | `ENV.nowDate` |
| `getDateLabel` | day separator label | `ENV.nowDate`, locale format |
| `minutesSince` | elapsed minutes helper | `ENV.nowMs` |
| `snapshotState` | deep-copy + prune chat history | `state` |
| `persistAtomically` | state+AI two-phase persistence | `snapshotState`, `kiraAI.save`, `localStorage`, `trace` |
| `recoverIncompleteTx` | startup cleanup for interrupted txn marker | `TX_KEY`, `localStorage`, `trace` |
| `loadState` | hydrate app state + defaults | `DEFAULT_STATE`, `localStorage`, `ENV.nowMs` |
| `saveState` | persistence façade for state | `persistAtomically` |
| `loadAI` | hydrate neural engine weights | `kiraAI.load`, `AI_KEY` |
| `saveAI` | persistence façade for AI | `persistAtomically` |
| `getStage` | affection→relationship stage map | `STAGES`, `state.affection` |
| `addAffection` | clamped affection updates + stage shift signal | `state.affection`, `addSystemMessage` |
| `updateAffectionUI` | render affection meter and stage text | DOM nodes |
| `detectUserMoodRegex` | regex teacher mood classifier | regex table, `state.userMoods` |
| `updateHerMood` | derive Kira mood and energy from user mood/time | `pick`, `getTimeOfDay`, `state` |
| `detectFeedback` | implicit reward signal extraction | regex rules |
| `detectTopics` | topic classifier + per-topic counts | `TOPIC_PATTERNS`, `state.topics` |
| `addMemory` | append bounded memory entries | `state.memories`, `ENV.nowMs` |
| `extractPersonalInfo` | name/age/preferences extraction | regex + `addMemory` + `state.username` |
| `P` | personality resolver | `state.personality`, `PERSONALITIES` |
| `maybeEmoji` | persona emoji injection | `chance`, `pick`, `P` |
| `getName` | dynamic user naming style | `state.username`, `state.affection`, `pick` |
| `namePrefix` | punctuation-aware conversational prefix | `getName`, `chance` |
| `generateResponse` | core route dispatcher + state transitions | `kiraAI`, regex/topic extractors, handlers, `logTransition` |
| `handleGreeting` | greeting responses by time/staleness | `minutesSince`, `kiraAI.rank` |
| `handleHowAreYou` | “how are you” branch | `kiraAI.rank`, mood/time |
| `handleAboutHer` | identity/persona response branch | `state`, `kiraAI.rank` |
| `handleILoveYou` | affectional response branch | `addAffection`, `getStage`, `kiraAI.rank` |
| `handleIMissYou` | attachment response branch | `addAffection`, `kiraAI.rank` |
| `handleGoodbye` | farewell branch | `kiraAI.rank`, `getTimeOfDay` |
| `handleCompliment` | compliment handling | `addAffection`, `kiraAI.rank` |
| `handleUserFeelsBad` | sadness/anxiety/vulnerability branch | `setCTX`, `addAffection`, `kiraAI.rank` |
| `handleUserAngry` | anger de-escalation branch | `kiraAI.rank` |
| `handleUserTired` | tiredness branch | `kiraAI.rank`, `getTimeOfDay` |
| `handleFlirt` | flirt branch | `addAffection`, stage gates, `kiraAI.rank` |
| `handleBored` | boredom branch | `setCTX`, `kiraAI.rank` |
| `handleOpinionQuestion` | opinion request branch | topics + `kiraAI.rank` |
| `handleQuestion` | general question branch | question heuristics + `kiraAI.rank` |
| `handleTopicResponse` | topic-specific response pools | `kiraAI.rank`, `detectTopics` output |
| `handleGrateful` | gratitude branch | `addAffection`, `kiraAI.rank` |
| `handleGeneral` | fallback engagement strategy by message length | `CTX.pendingQ`, `addAffection`, `kiraAI.rank` |
| `handleSurpriseMe` | novelty/fact branch | `setCTX`, `kiraAI.rank` |
| `handleWhatOnMind` | introspective branch | `setCTX`, `kiraAI.rank` |
| `handleImFine` | short status update branch | regex + `kiraAI.rank` |
| `handleGoodNews` | positive event branch | `addAffection`, `kiraAI.rank` |
| `handleSomethingHappened` | event narration branch | `setCTX`, `kiraAI.rank` |
| `handleAdviceRequest` | advice-seeking branch | `setCTX`, `kiraAI.rank` |
| `handleHypothetical` | “what if” branch | regex + `kiraAI.rank` |
| `getInitialMessage` | session opener by recency | `minutesSince`, `pick` |
| `openImageZoom` | open image lightbox | DOM overlay nodes |
| `processImageFile` | compress image to JPEG dataURL | `FileReader`, `Image`, `<canvas>` |
| `addImageMessage` | render/store image chat bubble | `getImage`, `addDateSeparator`, `saveState` path |
| `setContextPill` | brief contextual badge render | DOM + timeout |
| `addDateSeparator` | per-day separator render | `getDateLabel` |
| `addSystemMessage` | render out-of-band system text | DOM |
| `addMessage` | render/store text bubble | `addDateSeparator`, `state.chatHistory`, `saveState` |
| `scrollToBottom` | chat viewport follow | `requestAnimationFrame` |
| `showTyping` | typing indicator on | DOM state |
| `hideTyping` | typing indicator off | DOM state |
| `flashLearning` | neural badge pulse | DOM class toggle |
| `sendMessage` | user send pipeline + feedback + delayed AI turn | `detectFeedback`, `generateResponse`, persistence |
| `updateInputMeta` | live input length meter | DOM |
| `updateSendBtn` | send-button activation guard | DOM + `updateInputMeta` |
| `renderHistory` | replay persisted chat history | `state.chatHistory`, DOM |
| `renderAIStats` | diagnostics/stats UI | model constants, `DIAG` |
| `renderPersonalityChips` | personality selector render | `PERSONALITIES`, DOM |
| `boot` | startup orchestration | load/recover/render/init message/persist |

## Stage 2 — Rigorous Architectural Audit

### Critical-function audit (Tree-of-Thoughts + leverage score)

| Function | Failure mode A | Failure mode B | Failure mode C | First-principles critique | Leverage (0-5) |
|---|---|---|---|---|---|
| `persistAtomically` | write state succeeds but AI fails | tx marker left forever | malformed snapshot silently written | Persistence is a consistency boundary; split-brain corrupts behavior over time more than crashes | 5 |
| `sendMessage` | duplicate callback appends | delayed callback after state mutation | unbounded retries causing repeated side effects | User-turn orchestration is a multi-step state machine and must be correlation-scoped | 5 |
| `generateResponse` | route drift under nondeterministic RNG | mood routing mismatch (regex vs neural confidence) | silent invariant breach in affection/history | Must be pure-ish transition function with explicit inputs and bounded outputs | 5 |
| `loadState` | invalid JSON partial merge | stale schema data missing defaults | clock-dependent firstMeet mismatch | State hydration is trust boundary; needs deterministic defaults and schema normalization | 4 |
| `addMessage` | append succeeds, save fails | duplicated entries on rerender race | timestamp nondeterminism breaks replay | Rendering and persistence must be decoupled but transactionally linked | 4 |
| `addImageMessage` | orphaned image IDs | cache references missing blobs | oversized payload causes quota churn | Binary payload paths are high-corruption surfaces; IDs must be deterministic and recoverable | 4 |
| `boot` | interrupted boot writes greeting twice | stale tx marker ignored | streak math depends on local timezone drift | Initialization must be idempotent and recover interrupted persistence first | 4 |
| `detectUserMoodRegex` | false positives by substring collisions | mutable regex branch order bias | userMoods growth if cap bypassed | Teacher model should be deterministic and bounded; probabilistic semantics belong in student | 3 |

## Stage 3 — Upgrade Skeleton (SoT)

### Chain Contracts (typed IO + invariants + failures)

| Script/Function | Typed input | Typed output | Preconditions / invariants | Failure semantics |
|---|---|---|---|---|
| `persistAtomically` | `{ reason: string }` | `boolean` | state serializable; chatHistory <= 200; AI snapshot serializable | `PERSIST_TXN_FAILED`, `PERSIST_QUOTA_EXCEEDED` |
| `sendMessage` | DOM text input (`string`) | `void` | input 1..300 chars; correlation id exists; deterministic RNG seeded | `INPUT_TOO_LONG`, `TURN_EXECUTION_FAILED` |
| `generateResponse` | `userText: string` | `response: string` | non-empty text; mood/topic extraction total | `ROUTE_RESOLUTION_FAILED`, fallback to general handler |
| `loadState` | none | hydrated `state` object | defaults merged exactly once | `STATE_PARSE_FAILED` with default fallback |
| `addMessage`/`addImageMessage` | role + payload + optional ts | rendered node + optional persisted record | role in `{you,her}`; timestamp deterministic | `RENDER_FAILED`, `PERSIST_FAILED` (logged) |
| `boot` | none | running initialized UI state | recover incomplete tx first | `BOOT_RECOVERY_FAILED` with degraded mode |

### Upgrade logic blueprint (implementation bullets)

- Introduce deterministic runtime env (`ENV`) to inject seed, clock, and correlation-id generation.
- Replace direct `Date.now()` usage in transition-critical paths with `ENV.nowMs()`.
- Introduce two-phase local persistence boundary `persistAtomically(reason)` for state+AI snapshots.
- Add transaction recovery hook `recoverIncompleteTx()` in boot prelude.
- Add structured transition logging (`correlation_id`, `step_name`, `latency_ms`) for send and response chains.
- Route all save façades (`saveState`, `saveAI`) through transactional persistence boundary.
- Replace image ID random source with deterministic `ENV.makeId('img')`.
- Ensure all high-volume arrays remain capped at transition boundaries (`chatHistory`, `memories`, `userMoods`).

## Stage 4 — Script-for-Script Implementation

Implemented in `kira_v3.html`:

- Added deterministic `ENV` injection layer and seed parsing (`?seed=`) for reproducible routing and IDs.
- Added `persistAtomically`, `snapshotState`, and `recoverIncompleteTx` for no-silent-partial-update persistence.
- Wired `saveState`/`saveAI` through atomic persistence boundary.
- Added structured transition logging helper `logTransition` and integrated into `sendMessage` and `generateResponse`.
- Replaced transition-critical wall-clock calls with injected clock (`ENV.nowMs` / `ENV.nowDate`).
- Upgraded image and message flows to persist via atomic boundary.

## Stage 5 — Metacognitive Self-Correction

### Logical disconnect audit

| Module | Confidence | Why |
|---|---:|---|
| Transition pipeline (`sendMessage` + `generateResponse`) | 88% | Correlation IDs and latency logging now exist on critical steps; some minor handlers still return early without explicit transition logs. |
| Persistence (`persistAtomically` + recovery) | 82% | Eliminates split writes between state and AI in normal flow; browser localStorage itself is not true ACID, but marker+recovery reduces silent divergence. |
| Determinism controls (`ENV`) | 79% | Seed/time injection now centralized for chain-critical paths; cold-start weight init still uses baseline randomness before seeded routing dominates. |

### Necessary revision(s) detected

- Residual nondeterminism in cold-start model weight initialization remains intentionally unchanged to avoid backwards-compatibility break with serialized weights; if strict replay is required, ship canonical fixed initial weights in a migration.
