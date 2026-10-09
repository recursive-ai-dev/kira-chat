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
