## Run 5 (2026-10-10): "forget my name" fails to retire name memory (+1 net)
- **Bug:** "forget my name" replied "I don't have an active memory matching that." even when the name was saved. The forget parser passed "my name" through the generic object() helper, producing a literal hash key that never matches the stored name memory's key.
- **Fix:** Added nameOnly flag to forget intent in parser.js; extended forget filter in dialogue.js to match m.kind==="name" when parsed.nameOnly. Mirrors the existing pattern in recall.
- **Lesson:** The forget handler was asymmetric to recall — this is now closed.

## Run 4 — 2026-10-10
**Bug:** Mixed-new/existing conjunction (e.g. "I like coffee and pizza" after coffee is already saved) triggered "I've kept those reports separately" — a message designed for all-new conjunctions.
**Root cause:** The `records.length > 1` branch used `anyNew = records.some(r=>r.created)` which fires even for partially-new conjunctions.
**Fix:** Replaced `anyNew` with `allNew = records.every(r=>r.created)` for the "kept separately" message, adding a third "noted those" case for mixed sets with `(already saved)` labels on pre-existing items.
**Lesson:** The multi-item reply branch now has the complete three-way classification: allNew → "kept separately", mixed → "noted those", allExisting → "saved already". This branch is fully hardened against conjunction-state edge cases.

## Run 3 — 2026-10-10
**Bug:** Repeated preference conjunction (e.g. 'I like coffee and tea' said twice) triggered 'I've kept those reports separately' even when no new memory was created.
**Fix:** Added `anyNew = records.some(r => r.created)` guard in the `records.length > 1` branch of dialogue.js. Reply now says 'I have those saved already' when all items exist.
**Lesson:** The multi-item branch at `records.length > 1` is a semantic hotspot — always check the `created` flag before choosing the reply variant. Probe edge cases with repeated identical conjunctions.

## Run 2 (2026-10-09) — Duplicate-Word Preference Conjunction Bug
- **Easiest bug category:** Logic bugs in dialogue state machines caught by targeted adversarial input testing
- **Strategy that worked:** Enumerate conjunction edge cases (same word twice, empty, very long) and run them through the live model to observe unexpected replies
- **Bug found:** `applyFrames()` in `dialogue.js` — when the same label appears twice in "I like X and X", both frames resolve to one memory but two entries are returned, triggering the spurious "kept separately" multi-item reply
- **Fix pattern:** Deduplicate result by `memory.id` inside `applyFrames` before passing to `claims()` and returning; 4-line change
- **Test pattern that worked:** Verify both the memory count (`.memories.filter(active).length === 1`) and the reply text (does NOT match /kept those reports separately/)

## Next Run Ideas
- Test other edge cases in conjunction parsing: "I like X and Y and X" (three items, first duplicated at end)
- Test mood conjunction duplicates: "I feel happy and happy"
- Check if `recordFrame` for `mood` (not just `preference`) also hits the same path — moods don't check same-predicate but the multi-records path is shared
- Look for edge cases around the `pending` context expiring (turn > 3 but context.focus still referenced)
