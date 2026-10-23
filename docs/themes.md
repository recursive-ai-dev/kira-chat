# Growing Kira's vocabulary and variety

Kira combines topic cues, generation grammars, and authored extensions. Each is deterministic, so a saved conversation replays to the identical replies.

| Layer | Source | Checked? | Used for |
| --- | --- | --- | --- |
| Curated lexicon | `tools/vocabulary.txt` → `src/model/artifact-data.js` | Yes, by `verifyArtifact` | Meaning, memories, semantic queries, topics |
| Theme packs | `themes/*.txt` → `src/model/theme-packs.js` | Validated by the compiler | Deeper topics: words, questions, answer cues |
| WordNet table | `tools/wordnet_topics.py` → `src/model/wordnet-topics.js` | No | Last-resort topic for words nothing else knows |
| Variable slots | `⟦a\|b\|c⟧` inside reply templates | n/a | Wording variety |
| Ring field | derived from all of the above, `src/model/field.js` | No | Where a conversation sits, bridging, reminders (see [field.md](field.md)) |
| Interaction grammar | `src/model/interaction.js` | Generated text reconstructed from speech acts | Social replies and general topic questions |
| Creative grammar | `src/model/creative.js` | Fiction scope, compatible frames and generated text reconstructed | Wordplay and writing prompts |

Everything except the curated lexicon only helps Kira choose a topic or a wording. None of it creates a memory or an ontology claim.

A message's topic is the first of these that recognises it: a lone curated concept, then theme-pack words, then curated concepts inside the sentence, then WordNet.

## Theme packs

A pack file in `themes/` can deepen an existing topic (for example `music`) or define a new one (`philosophy`, `history`). Run `npm run themes` after editing; `npm run check` fails if the generated file is stale.

```text
topic: philosophy
open: Philosophy usually starts with a question that will not stay quiet. What is yours?
ask: What question keeps coming back to you? | Where do you land on it today?
cue: /\b(?:free will|determinis\w*)\b/ => Does it change how you think about responsibility?
phrase: What draws you to {p}? | What is the strongest objection to {p}?
words:
  schools: stoicism, existentialism, utilitarianism
  thinkers: socrates, kant, nietzsche
```

- `topic:` starts a section; `---` ends it. A topic that already exists is extended, never replaced.
- `open:` lines are used on entry into a topic. `ask:` extends a thread after eight follow-up steps. `cue:` asks a particular question when the answer matches the regular expression (case-insensitive). `phrase:` can ask about a short noun phrase from the answer at every third step; `{p}` is that phrase. Unseen openers and matching cues take precedence over general generated questions. Aversion threads use neutral generated frames instead of positive authored prompts.
- `words:` is an indented block. A `label:` prefix only groups words for the author. Words are lowercase letters, spaces, apostrophes and hyphens; the same word may not belong to two topics.
- `overlap: other-topic | word, word` declares concepts that sit in both topics' rings. They are the bridges the [ring field](field.md) glides across; they do not change which topic a word is detected as. Each pair needs declaring once.
- Words in one `words:` line group stay together as structure in the ring.
- A thread stays on its topic unless the answer is one or two words or starts with “actually”, “anyway”, “speaking of”, “how about” or “what about”.

Authored pack questions remain authored text: `plan.policy.questionOrigin` identifies `authored_theme` or `authored_cue`, while generated general questions use `compositional` and carry grammar spans. Pack wording does not acquire a semantic certificate merely by steering a topic.

## Variable slots

Reply templates may contain slots. `⟦like most|enjoy most|find best⟧` picks one alternative. `⟦@remember⟧` picks from a named pool in `K.DIALOGUE.pools` (`src/model/variation.js`), which can have per-persona variants (`direct`, `warm`, `playful`, `thoughtful`) and falls back to `default`.

The choice is a hash of the message's sequence number, time and text plus the slot, so it looks random but replays identically. A slot never repeats its previous choice. A slot that opens a sentence is capitalised. Pool entries and alternatives must not contain `. ! ? |` (the question-detection code reads the sentence punctuation). The brackets are stripped from anything a user types.

## Curated vocabulary

`tools/vocabulary.txt` lists concepts, parents and topics, one per line; `@` lines tag existing concepts. `npm run vocab` regenerates every derived part of the sealed artifact (classification proof, potentials, caches, certificate, digest) and refuses to write unless `verifyArtifact` accepts it, then re-pins `APP_META`. The artifact is limited to 1,000 concepts.

## WordNet

`tools/wordnet_topics.py` builds the WordNet table from Princeton WordNet 3.0. Download `WNdb-3.0.tar.gz` from <https://wordnetcode.princeton.edu/3.0/>, extract it somewhere outside the repository, then:

```sh
python3 -I tools/wordnet_topics.py /path/to/dict --anchors   # review the senses chosen for each topic
python3 -I tools/wordnet_topics.py /path/to/dict             # write src/model/wordnet-topics.js
python3 tools/build.py --pin
```

Each topic is a list of anchor senses; a noun's most common sense joins the topic of the nearest anchor above it in the is-a hierarchy. Broad topics have a distance cap, and a short stop list removes common words whose first sense misleads. WordNet's license text is kept in `docs/WORDNET-LICENSE.txt` and at the top of the generated file, as it requires.

## After any model change

`python3 tools/build.py --pin` re-pins the model hash and rebuilds `Kira.html` and `KiraSDK.js`; `npm run verify` checks everything.
