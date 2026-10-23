# Narrative SDK 0.1

The SDK runs multiple independent characters over one shared Kira semantic engine. It includes a narrative-data compiler, attributed beliefs, private conversation memory, authored phrase composition, character goals, and deterministic world-session replay. There are no runtime dependencies or inference calls.

The host controls time, world changes, audiences, and when characters speak. This release does not run a background world simulation or choose physical actions for characters.

## Run the example

```sh
npm run example
npm run demo
# Open http://localhost:8042/examples/station.html
```

The browser example lets you speak freely to Mara and Ivo, stage events, pass a rumour, inspect reply sources, and export/import an entire session. It keeps state in memory until exported. Both examples use [station.json](../examples/station.json); neither contains Building 78 content.

Try this sequence:

1. Tell Mara `I like coffee`.
2. Ask Ivo `What do you remember about me?` He has not heard that disclosure.
3. Turn the signal red with only Mara witnessing.
4. Ask each character about `the signal`. Their answers differ.
5. Have Mara tell Ivo. His reply now cites relayed information.
6. Clear the signal without witnesses. Their beliefs remain unchanged.
7. Let Mara initiate a conversation. Her active goal prompts a warning.
8. Have both witness the train arriving. Mara's goal completes.
9. Verify replay, export, reset, and import the exported JSON.

## Load the SDK

In CommonJS:

```js
const Kira = require('./KiraSDK.js');
const compiled = Kira.Narrative.compile(source);
const engine = new Kira.SemanticEngine(Kira.ARTIFACT);
const world = new Kira.Narrative.WorldModel(compiled, engine);
let state = world.initialState();
const events = [];

function dispatch(input) {
  const event = { seq: events.length + 1, time: events.length, ...input };
  const result = world.step(state, event);
  // Commit only after successful validation and evaluation.
  state = result.state;
  events.push(event);
  return result.reply;
}
```

In a browser, load `<script src="KiraSDK.js"></script>` before your adapter. It exposes `globalThis.Kira`. The CommonJS build uses a private namespace and does not assign Node's `globalThis.Kira`. Do not also load the companion HTML model into the same browser page: the SDK already contains that model.

One `WorldModel` handles all of a package's characters. Multiple worlds can reuse an explicitly supplied semantic engine while keeping their state separate. Character instances are state records, not workers or duplicated copies of the engine.

## Author and compile a world

A source package has these fields:

| Field | Contents |
| --- | --- |
| `id`, `version` | Package identity and author-controlled version |
| `speakers` | External participants: `{id, name}` |
| `topics` | Domain topics: `{id, label, aliases}` |
| `facts` | Declarative propositions: `{id, topic, text}` |
| `characters` | Voices, background beliefs, goals, and reply rules |

Character IDs can also act as conversation partners. Speaker and character IDs must be distinct. IDs start with a lowercase letter and contain lowercase letters, digits, underscores or hyphens, up to 64 characters; prototype-related reserved IDs are refused.

```sh
node tools/narrative.cjs examples/station.json /tmp/station.compiled.json
```

Or call `Kira.Narrative.compile(source)` directly. The compiler returns an immutable, normalized `{format, definition, hash}` package. `WorldModel` verifies this representation before accepting it. Declaration ordering is normalized; phrase ordering remains meaningful.

The compiler rejects unknown fields, duplicate IDs, colliding normalized topic aliases, missing references, invalid conditions, malformed slots, and phrases that insert fact text without a corresponding positive belief condition. Generated packages are JSON and can be committed with game assets.

**These topics and facts extend the narrative layer. They do not rebuild the pinned RSE semantic ontology.** That artifact and its checker remain unchanged. A topic alias can select a game-specific reply even when the companion's bounded parser cannot interpret the sentence as a report. It does not teach the companion parser every grammatical use of that word.

## Character definitions and rules

A character requires `id`, `name`, and an authored `fallback`. Optional fields are `persona`, `register`, `knowledge`, `goals`, and `rules`. Persona and register configure its separate Kira conversation states. Authored rules determine its actual voice; the general companion's social replies are not used as a default NPC persona.

`knowledge` supplies background beliefs, not world truth:

```json
"knowledge": [{"fact": "signal_red", "value": false}]
```

A rule can constrain topic, parsed intent, beliefs, relationship and active goal:

```json
{
  "id": "signal_seen",
  "priority": 10,
  "on": {"topic": "signal"},
  "requires": [{"fact": "signal_red", "value": true, "kind": "witnessed"}],
  "minRelationship": 0,
  "parts": [
    ["Mara checks the window. ", "Mara lowers her voice. "],
    "“{fact:signal_red} ",
    ["Wait here.”", "Stay away from the platform.”"]
  ]
}
```

Each `parts` entry is a literal string or a nonempty array of alternatives. Parts concatenate exactly; authors provide spaces and punctuation. Selection composes parts without enumerating their Cartesian product. Eligible rules rank by descending priority, then least use, then stable ID. Each part independently picks its least-used alternative, with source order breaking ties. Usage belongs to that character, across its interlocutors.

Rules match all supplied constraints. `on.intent` uses Kira's parsed act names (`greet`, `preference`, `recall`, etc.), plus `initiate`. `on.topic` matches whole normalized alias phrases, case-insensitively. Multiple matched topics produce a clarification rather than guessing. The player can restate one topic; a host UI can also supply a validated `topic` on a message event.

Conditions use the character's latest belief. Unknown is different from false. Optional `kind` matches `background`, `witnessed`, `reported`, or `relayed`; this lets first-hand testimony differ from hearsay. Older and conflicting beliefs remain in history.

### Phrase slots

| Slot | Value |
| --- | --- |
| `{character}` | Speaking character's name |
| `{speaker}` | Conversation partner's display name |
| `{fact:signal_red}` | Authored proposition text; requires a positive condition for that fact |
| `{memory}` | Selected active memory's object label |
| `{report}` | Kira's attributed description, such as `You like coffee` |

Memory slots require `memoryKind`: `name`, `preference`, `mood`, or `note`. Selection takes place only within that character's session with the current speaker. For recall questions it respects the companion model's grounded query selection; otherwise it chooses the latest active memory of that kind. Superseded or retired memories cannot fill slots.

Parser ambiguity that needs a meaning choice takes precedence over narrative rules. The original clarification is shown so the pending parser question matches the actual transcript. Other companion follow-up questions are cleared when authored wording replaces them. Unsupported text can receive a domain-topic reply or the character's fallback without silently becoming a memory.

### Goals and initiative

```json
{
  "id": "clear_platform",
  "label": "Keep the traveller off the platform",
  "requires": [{"fact": "signal_red", "value": true}],
  "completedBy": [{"fact": "train_arrived", "value": true}]
}
```

Goals activate when their conditions match the character's beliefs. A nonempty matching `completedBy` list suppresses a goal; an empty list does not complete it automatically. All conditions in a list must match. These are derived goals: a later belief change can reactivate one.

Use `world.activeGoals(state, characterId)` to inspect them. Give a rule `goal: "clear_platform"` and `on: {intent: "initiate"}` to author what the character says when the host gives it an opportunity to speak. Ordinary message rules never fire accidentally for initiative. The host remains responsible for location, timing, and avoiding unsolicited repeated interruptions.

## Host events

Every event has consecutive `seq` starting at 1 and an explicit nondecreasing integer `time`. A game tick works; no wall clock or random generator is read by the model.

| Type | Additional fields | Effect |
| --- | --- | --- |
| `world` | `fact`, boolean `value`, `witnesses: [character IDs]` | Updates world truth and named witnesses' beliefs. Empty witnesses keeps the change private to the host. |
| `claim` | `from`, `to: [character IDs]`, `fact`, boolean `value` | An explicit report, possibly mistaken or dishonest. Updates recipients' beliefs, not world truth or the source's beliefs. |
| `tell` | `from: character ID`, `to: [character IDs]`, `fact` | Relays that character's current belief and preserves the attribution chain. An unknown fact cannot be relayed. |
| `message` | `actor`, `speaker`, `text`, optional `topic` | Processes a private utterance and selects/composes a reply. |
| `initiate` | `actor`, `speaker`, optional `topic` | Selects a character-initiated reply without inventing a user message. |
| `relationship` | `actor`, `speaker`, integer `delta` | Adds a host-supplied relationship change, clamped to 0–100. Delta ranges from −100 to 100. |
| `retire` | `actor`, `speaker`, `memoryId` | Retires an active conversation memory in that specific pair's session. |

For `actor` events, `speaker` can be an external participant or another character, but not the actor itself. A message from one NPC to another must be delivered explicitly; reply text is not automatically fed to other characters. Likewise, merely mentioning a fact does not grant or relay knowledge. Use the structured events for consequential disclosures and rumours.

Relationship points are separate for each character/partner pair. Supported novel reports also use Kira's existing familiarity rules. Host relationship events let a game reflect favours and other actions in dialogue conditions.

## State, evidence and replay

`world.step(previousState, event)` returns `{state, reply}`. It copies state and does not mutate the supplied state or event. A failed event leaves them intact. Commit the returned result before displaying its reply.

World truth is stored under `state.world`. Each `state.actors[id]` has an append-only belief history, phrase usage, and private sessions keyed by partner ID. Each session contains its Kira dialogue state and emitted narrative replies. Corrections and retirement retain history.

Replies identify the actor, partner, selected rule and goal, matched topics, interpretation, phrase indices, and evidence. Belief evidence carries the delivery event, source, and relay chain. Memory evidence identifies the partner, memory and source message. The response has a canonical digest. Hosts should render text as text, not HTML.

The compiler checks structure and slot grounding. The semantic checker checks supported semantic queries. **Neither establishes that arbitrary authored prose is factually true or consistent with every belief.** Authors can deliberately write lies and unreliable voices; use conditions and attribution traces to make that intentional.

```js
const saved = world.export(events);
// Save JSON.stringify(saved) using the host's persistence adapter.
const restored = world.import(JSON.parse(json));
state = restored.state;
// restored.events is the verified event log for subsequent turns.
```

Exports pin the narrative package, SDK source hash, and companion model hash. Imports validate the envelope checksum, replay every event, and compare the final state digest; a supplied state snapshot is never trusted. Changing authored assets or SDK code requires a new session or an explicit future migration. A checksum is a consistency check, not authentication.

Limits are 128 characters, 128 external speakers, 512 topics, 2,000 facts, 512 rules per character, 32 parts per rule, 32 alternatives per part, 2,000 characters per message, 16,000 characters per generated reply, 128 links per rumour chain, 10,000 global events, and 16 million encoded characters per export. Each private Kira conversation still has its existing 1,000-event limit. State copying and replay grow with history; these bounds are guards, not performance guarantees for a maximum-size world.

## Build and verify

```sh
npm run build    # generate Kira.html and KiraSDK.js
npm run verify   # exact generated bytes + companion and SDK regressions
```

Narrative sources live in `src/narrative/`. The build hash pins both those sources and the shared model. The companion HTML and its 4.2.0 model/storage identity remain unchanged in platform release 4.3.0. The SDK's own version is 0.1.0; it has a separate session format and does not import companion session envelopes.
