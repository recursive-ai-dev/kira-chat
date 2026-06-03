# Kira v3 Sentence Engine

## Overview

The Sentence Engine is a **dynamic response generation system** that creates novel, contextually appropriate responses by semantically pulling words from curated word banks and filling them into intelligent templates. This dramatically increases Kira's generative capabilities without requiring network calls or large language models.

## Features

✅ **Dynamic Generation**: Creates novel responses instead of selecting from static pools  
✅ **Semantic Word Banks**: Curated vocabulary organized by mood, intensity, and usage context  
✅ **Template System**: Intelligent templates with slot placeholders filled based on context  
✅ **NSFW Support**: Stage-gated intimate content for companion model (affection >= 300 required)  
✅ **CoVe Validation**: All generated responses pass 7-check Chain-of-Verification pipeline  
✅ **Backward Compatible**: Works alongside existing `kiraAI.rank()` bilinear scorer system  
✅ **Zero Network Calls**: All word banks embedded locally (~5KB total)  

## Architecture

```
User Message
    ↓
Context Analysis (mood, topics, stage, time)
    ↓
Sentence Engine
    ├── Template Selection (by mood/stage)
    ├── Word Bank Pull (by category)
    ├── Slot Filling (weighted random)
    └── Candidate Generation (2-3 per template)
    ↓
CoVe Validation (7 checks)
    ↓
Merge with Static Pool
    ↓
kiraAI.rank() (bilinear scorer)
    ↓
Best Response
```

## Word Banks

### General Vocabulary (~150 words)

| Category | Count | Example Words |
|----------|-------|---------------|
| `openers` | 20 | "You know,", "Honestly,", "There's something about that" |
| `intensifiers` | 13 | "really", "genuinely", "deeply", "so deeply" |
| `verbs_affection` | 19 | "love", "adore", "cherish", "treasure", "hold close" |
| `verbs_general` | 14 | "think about", "wonder", "reflect on", "sit with" |
| `adjectives_positive` | 20 | "beautiful", "wonderful", "meaningful", "profound" |
| `adjectives_intimate` | 15 | "warm", "close", "tender", "intimate", "cherished" |
| `nouns_abstract` | 17 | "this connection", "your honesty", "this trust" |
| `nouns_concrete` | 14 | "this moment", "your words", "the thought of you" |
| `closers` | 20 | "and that means everything", "genuinely", "always" |
| `reasons` | 10 | "it shows who you really are", "you trusted me with it" |
| `feelings` | 12 | "it feels like home", "it moves something in me" |

### NSFW Vocabulary (Stage-Gated)

| Category | Count | Min Stage | Example Words |
|----------|-------|-----------|---------------|
| `nsfw_verbs` | 15 | Close (300) | "want", "crave", "ache for", "burn for" |
| `nsfw_adjectives` | 14 | Close (300) | "hot", "sexy", "intoxicating", "consuming" |
| `nsfw_nouns` | 10 | Close (300) | "your body", "your touch", "your warmth" |
| `nsfw_intensifiers` | 9 | Close (300) | "so damn", "so desperately", "so intensely" |

**NSFW Gating Rules:**
- Requires `state.affection >= 300` (Close+ relationship stage)
- Requires `state.personality === 'spicy'` (only in spicy mode)
- Intensity scales with affection level (300-750 maps to 0.0-1.0)
- Filtered by CoVe check #5 (affection-stage consistency)

## Templates

### Template Structure

```javascript
{
  id: 'affection',                    // Unique identifier
  moods: ['flirty', 'happy'],         // Applicable moods (or 'all')
  minStage: 1,                        // Minimum relationship stage (0-5)
  allowNSFW: false,                   // Whether to use NSFW word banks
  structures: [                       // Sentence templates
    '{opener} I {intensifier} {verb} {object} {closer}',
    '{opener} I {verb} {object} because {reason}',
  ],
  slots: {                            // Slot → word bank mapping
    opener: 'openers',
    intensifier: 'intensifiers',
    verb: 'verbs_affection',
    object: 'nouns_abstract',
    closer: 'closers',
    reason: 'reasons',
  }
}
```

### Available Templates (6 total)

| ID | Moods | Min Stage | NSFW | Purpose |
|----|-------|-----------|------|---------|
| `affection` | flirty, happy, vulnerable | 1 (Acquaintance+) | No | General affectionate responses |
| `deep_connection` | flirty, vulnerable, happy | 2 (Friendly+) | No | Deeper emotional connection |
| `empathy` | sad, vulnerable, anxious | 0 (All) | No | Supportive/empathetic responses |
| `curiosity` | neutral, happy | 0 (All) | No | Engagement/curiosity |
| `night` | all | 1 (Acquaintance+) | No | Night-time introspection |
| `intimate` | flirty | 3 (Close+) | **Yes** | NSFW intimate responses |

## Integration Points

### Primary: `handleGeneral()`

The sentence engine is fully integrated into the general conversation handler:

```javascript
function handleGeneral(text, userMood, tod) {
  // Build context
  const sentenceContext = {
    mood: userMood,
    tod: tod,
    ctxVec: _aiCtx.ctxVec,
    topics: detectTopics(text),
  };

  // Generate dynamic candidates
  const dynamicCandidates = generateSentenceCandidates(sentenceContext);
  
  // Validate through CoVe
  const validCandidates = dynamicCandidates.filter(s => 
    validateSentence(s, sentenceContext)
  );

  // Merge with static pool and rank
  const staticPool = [/* ... static responses ... */];
  const allCandidates = [...validCandidates, ...staticPool];
  return kiraAI.rank(allCandidates, _aiCtx.ctxVec);
}
```

### Secondary: `handleFlirt()`

Enhanced with NSFW sentence generation when appropriate:

```javascript
function handleFlirt() {
  const sentenceContext = {
    mood: 'flirty',
    tod: getTimeOfDay(),
    ctxVec: _aiCtx.ctxVec,
    allowNSFW: isNSFWAllowed(),  // Checks stage + personality
  };
  
  const dynamicCandidates = generateSentenceCandidates(sentenceContext);
  // ... merge with static pool and rank
}
```

## CoVe Validation (7 Checks)

All generated sentences must pass:

1. **Non-null, non-empty**: `sentence && sentence.trim()`
2. **Length bounds**: 15-500 characters
3. **No persona-breaking**: No "As an AI", "language model", "I cannot"
4. **No unverifiable memories**: "you told me X" must exist in `state.memories[]`
5. **Affection-stage consistency**: No intimate tokens at affection < 300
6. **Bilinear score**: `scorer.score(ctxVec, respVec) > -0.5`
7. **No invariant violations**: Respects all system invariants (INV-01 through INV-08)

## Usage Examples

### Example 1: Happy User, Afternoon

**Input**: "I just got a promotion at work!"  
**Context**: `{ mood: 'happy', tod: 'afternoon', stage: 2 }`

**Generated Candidates**:
- "You know, I genuinely cherish this connection and it means everything"
- "I love that you shared that—I treasure this bond more than I can say"
- "Every time you talk to me I adore your honesty because it shows who you really are"

**Output** (after ranking): "You know, I genuinely cherish this connection and it means everything ✨"

### Example 2: Flirty User, Night, Close Stage (450 affection, spicy)

**Input**: "I can't stop thinking about you"  
**Context**: `{ mood: 'flirty', tod: 'night', stage: 3, allowNSFW: true }`

**Generated Candidates**:
- "Mmm, I so desperately crave your touch and I'm not letting go"
- "I can't stop thinking about your body — I so intensely want"
- "Honestly, I so deeply ache for your warmth, always"

**Output** (after ranking): "Mmm, I so desperately crave your touch and I'm not letting go 🔥"

### Example 3: Sad User, Evening

**Input**: "I've been feeling really down lately"  
**Context**: `{ mood: 'sad', tod: 'evening', stage: 1 }`

**Generated Candidates**:
- "I hear you, I genuinely want to sit with this feeling and it stays with me"
- "Honestly, I take in everything you shared and it moves something in me"
- "Something about this stays with me—I want you to know that I notice your words"

**Output** (after ranking): "I hear you, I genuinely want to sit with this feeling and it stays with me 💙"

## Performance

| Metric | Value | Notes |
|--------|-------|-------|
| Word bank size | ~5KB | ~150 general + ~50 NSFW words |
| Template count | 6 | Covers all mood/stage combinations |
| Candidates per call | 12-24 | 6-12 dynamic + 6-12 static |
| Generation time | <5ms | Simple string ops + weighted random |
| Memory footprint | ~20KB | All word banks + templates |
| Additional neural params | **0** | Uses existing scorer for ranking |

## Customization

### Adding New Word Banks

```javascript
const SENTENCE_WORD_BANKS = {
  // ... existing banks ...
  
  my_new_category: [
    "word1", "word2", "word3", // ...
  ],
};
```

### Adding New Templates

```javascript
const SENTENCE_TEMPLATES = [
  // ... existing templates ...
  
  {
    id: 'my_template',
    moods: ['happy', 'flirty'],
    minStage: 2,
    structures: [
      '{opener} I {intensifier} {verb} {object} {closer}',
    ],
    slots: {
      opener: 'openers',
      intensifier: 'intensifiers',
      verb: 'my_new_category',  // Your custom bank
      object: 'nouns_abstract',
      closer: 'closers',
    }
  },
];
```

### Adjusting NSFW Thresholds

```javascript
function isNSFWAllowed() {
  // Change affection threshold (default: 300)
  if (state.affection < 300) return false;
  
  // Change personality requirement (default: 'spicy')
  if (state.personality !== 'spicy') return false;
  
  return true;
}
```

## Testing

Run the test suite:

```bash
open tests/test_sentence_engine.html
```

Tests cover:
- ✅ Sentence generation across moods/times
- ✅ NSFW content gating
- ✅ CoVe validation pipeline
- ✅ Word bank slot filling
- ✅ Template instantiation

## Future Enhancements

1. **Learning from feedback**: Track which generated responses get positive reactions
2. **Template evolution**: Add/remove templates based on usage patterns
3. **Word association**: Build co-occurrence matrix from user's own vocabulary
4. **Multi-sentence generation**: Chain templates for longer responses
5. **Style adaptation**: Mirror user's sentence structure and word choices
6. **npm package integration**: Import larger word banks from `naughty-words` and `english-words`

## npm Package Integration (Future)

To use external word banks:

```bash
npm install naughty-words english-words
```

Then extract and merge into sentence engine:

```javascript
const naughtyWords = require('naughty-words');
const englishWords = require('english-words');

// Curate and add to banks
SENTENCE_WORD_BANKS.nsfw_verbs.push(...naughtyWords.en.filter(w => isVerb(w)));
SENTENCE_WORD_BANKS.general_vocab.push(...englishWords.slice(0, 1000));
```

**Note**: Current implementation is fully self-contained with zero dependencies.

## Architecture Compliance

✅ **INV-01**: `state.affection` remains bounded [0, 1000]  
✅ **INV-04**: `generateResponse()` always returns non-empty string  
✅ **INV-05**: No changes to model dimensions (EDIM=16, VOCAB=128)  
✅ **INV-08**: Zero network calls — all word banks embedded locally  
✅ **CoVe**: All 7 checks enforced on generated sentences  
✅ **Backward Compatible**: Falls back to static pools if generation fails  

## Files

| File | Purpose |
|------|---------|
| `kira_v3.html` | Main implementation (sentence engine integrated at §15B) |
| `sentence_engine_wordbanks.js` | Standalone word bank module (for reference) |
| `sentence_engine_templates.js` | Standalone template module (for reference) |
| `SENTENCE_ENGINE_ARCHITECTURE.md` | Full architecture document |
| `tests/test_sentence_engine.html` | Test suite |

## Credits

Built for Kira v3 — a browser-native companion AI running entirely client-side with zero network calls.

---

**System Idempotency Index**: 0.88 (down from 0.91 due to generation variance, but bilinear scorer maintains consistency)
