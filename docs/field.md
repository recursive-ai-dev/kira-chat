# The ring field

Kira picks follow-up questions by where a conversation sits in a **field of rings**, not by a fixed list or a random draw. The field is a derived, unchecked layer beside the sealed lexicon (`src/model/field.js`). It never creates a memory or an ontology claim; it only chooses what to ask next. It is built from the artifact, the theme packs and the events, uses only `+ − × ÷` and comparisons, and keeps integers in state, so a replay produces identical replies on every device.

## Rings

Each topic (music, travel, philosophy…) is a ring of weighted members:

| Member | Weight |
| --- | --- |
| Curated concept tagged with the topic | 1.0 |
| Word in the topic's theme pack | 0.9 |
| Word declared in an `overlap:` line | 0.8 (in **both** rings) |
| Taxonomic neighbour of a core member (parent, child, sibling, part/role) | 0.4–0.5 |

Generic hub concepts (those with 60 or more hyponyms, like “food”) are not neighbours. A neighbour that has a topic of its own is core in that ring too, which is what makes neighbouring rings overlap.

**Overlap** of two rings is their weighted Jaccard index, in permille. The members they share are the **bridges** between them, strongest first. A pair of rings typically overlaps by 40–100‰, with half a dozen to a dozen bridging concepts. Authors declare bridges directly in a pack:

```text
topic: coffee
overlap: home | morning routine, mug, french press, quiet morning, breakfast
overlap: work | office, break, meeting, afternoon slump, colleagues
```

The shipped bridges are in `themes/bridges.txt`. Each pair is declared once and applies to both rings.

## Position

Ring centres are laid out in the plane by classical MDS on `1 − overlap`, by power iteration with a fixed start and iteration count, giving integer coordinates in [−1000, 1000]. Rings that share many concepts sit close together.

A conversation carries an **activation** per topic (an integer in permille). Each turn the old activation decays by 40%, the topics the message touches are pulsed (+500 for the first, +250 for others), and the strongest pulse spreads to its four nearest rings in proportion to overlap. The **position** of the conversation is the activation-weighted centroid of the ring centres. A direct-hit turn is recorded separately from spreading, so “was this discussed recently?” is not confused with “is this nearby?”.

Words that sit in two rings resolve to the ring the conversation is nearer to: “teammates” is sports in a sports thread and people in a family thread.

## Choosing the next move

After an answer in a topic thread the field picks one of three moves, in this order:

1. **Remind.** A remembered, positive, current preference whose topic ring overlaps this one by at least 50‰ (+300 if its concept is a member of this ring) and has not been discussed in the last 3 turns, nor reminded in the last 8. Kira generates an attributed report, such as “You told me that you like coffee”, and asks whether it connects to this subject. The memory is attached to the reply as a claim and a grounded sentence span. Declined subjects are excluded from automatic callbacks until explicitly reintroduced.
2. **Bridge.** After at least two follow-ups, when a neighbouring ring shares a bridge concept outside this ring's core with the answer touching it, or when the ladder is spent. The score is overlap × the neighbour's activation × a novelty factor (visited rings count 20%). A touched concept gets a natural question about it; otherwise Kira names the link. The thread then continues in the new ring. A bridge is not repeated within 5 turns.
3. **Ladder.** Stay and go deeper. The interaction grammar composes general questions, while matching authored theme cues and extensions can supply specific questions. Recent questions in a topic are remembered across topic switches and skipped during selection; this bounded history does not guarantee unlimited unique conversation.

A thread stays in its ring unless the answer is one or two words, says outright that the subject changed, returns to a topic discussed in the last four, or lands in a ring that overlaps one discussed in the last three turns by at least 60‰.

## Wording

The `⟦a|b|c⟧` slots pick by field position: the slot's own offset plus a phase derived from the position and turn selects the alternative, so wording drifts with the conversation instead of jumping. A slot still never repeats its previous choice.

Generated conversational and fictional wording uses explicit variation counters and typed plans instead of template slots. Both the counters and the field state replay from the same event log. The field chooses a conversational direction; it does not turn a creative scene into a fact or authorize a question after a pause.

## Inspecting a decision

Every reply carries its trace in `plan.policy.field` (visible under “Sources & reasoning”): the move, the topic, the three most active rings with their activation, the position, and for a bridge or reminder the rings, the concept it went through and its score.
