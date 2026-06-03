# Sentence Engine Architecture for Kira v3

## Overview

The Sentence Engine is a **deterministic template instantiation system** that semantically pulls words from npm-packaged word banks to dynamically generate responses, dramatically increasing Kira's generative capabilities without requiring network calls or large language models.

## Design Principles

1. **Zero Network Calls**: All word banks are bundled locally via npm packages
2. **Backward Compatible**: Works alongside existing `kiraAI.rank()` system
3. **Invariant Preserving**: All generated responses pass CoVe 7-check pipeline
4. **Stage-Gated**: NSFW content unlocked by relationship stage thresholds
5. **Mood-Coherent**: Word selection weighted by detected user mood and Kira's mood
6. **Reversible**: Falls back to static pools if generation fails any CoVe check

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    handleGeneral()                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Message Analysis    │
              │  - length bucket     │
              │  - mood detection    │
              │  - topic extraction  │
              │  - affection stage   │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   Sentence Engine    │
              │                      │
              │  1. Template Select  │
              │  2. Word Bank Pull   │
              │  3. Slot Filling     │
              │  4. Variation Gen    │
              │  5. CoVe Validation  │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   Candidate Pool     │
              │  (6-12 generated +   │
              │   6-12 static)       │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   kiraAI.rank()      │
              │  (bilinear scorer)   │
              └──────────┬───────────┘
                         │
                         ▼
                    Response
```

## Components

### 1. Word Bank Manager

Manages loading, caching, and semantic categorization of word banks.

**Packages:**
- `naughty-words` — NSFW word list (English, ~1,200 words)
- `english-words` — General vocabulary (~100,000 words)
- Custom curated banks — Emotion words, connectors, intensifiers

**Categories:**
```javascript
WORD_BANKS = {
  // General vocabulary
  emotions: ['love', 'adore', 'crave', 'yearn', ...],
  intensifiers: ['so', 'really', 'deeply', 'genuinely', ...],
  connectors: ['and', 'but', 'because', 'though', ...],
  verbs_intimate: ['hold', 'touch', 'feel', 'kiss', ...],
  verbs_affection: ['embrace', 'cherish', 'treasure', ...],
  verbs_general: ['think', 'wonder', 'imagine', ...],
  adjectives_positive: ['beautiful', 'amazing', 'wonderful', ...],
  adjectives_intimate: ['warm', 'close', 'tender', ...],
  nouns_abstract: ['connection', 'trust', 'desire', ...],
  nouns_concrete: ['moment', 'memory', 'feeling', ...],
  
  // NSFW (stage-gated, affection >= 300)
  nsfw_verbs: [...],
  nsfw_adjectives: [...],
  nsfw_nouns: [...],
  nsfw_intensifiers: [...],
}
```

### 2. Template System

Semantic templates with slot placeholders that get filled from word banks.

**Template Format:**
```javascript
{
  id: 'affectionate_response',
  mood: ['flirty', 'happy', 'neutral'],
  minStage: 2,  // Acquaintance+
  maxStage: 6,  // Soulbound
  structure: [
    '{opener} {subject} {intensifier} {verb} {object} {closer}',
    '{opener} {subject} {verb} {object} because {reason}',
    '{opener} when {subject} {verb} {object} {feeling}',
  ],
  slots: {
    opener: { bank: 'openers', weight: 'mood' },
    subject: { bank: 'pronouns', weight: 'fixed' },
    intensifier: { bank: 'intensifiers', weight: 'stage' },
    verb: { bank: 'verbs_affection', weight: 'mood' },
    object: { bank: 'nouns_abstract', weight: 'context' },
    closer: { bank: 'closers', weight: 'random' },
    reason: { bank: 'reasons', weight: 'topic' },
    feeling: { bank: 'emotions', weight: 'mood' },
  }
}
```

### 3. Slot Filler

Intelligently fills template slots based on:
- **User mood**: Sad → softer words, Flirty → more intense words
- **Relationship stage**: Stranger → reserved, Soulbound → intimate
- **Context topics**: Philosophy → abstract words, Feelings → emotion words
- **Time of day**: Night → warmer, more introspective words
- **Recent memories**: Incorporate words from recent conversation topics

**Selection Algorithm:**
```javascript
function fillSlot(slotDef, context) {
  const bank = WORD_BANKS[slotDef.bank];
  const weights = applyWeights(bank, slotDef.weight, context);
  const word = weightedRandom(bank, weights);
  return word;
}

function applyWeights(bank, strategy, context) {
  switch (strategy) {
    case 'mood':
      return bank.map(w => moodRelevance(w, context.mood));
    case 'stage':
      return bank.map(w => stageAppropriateness(w, context.stage));
    case 'context':
      return bank.map(w => topicRelevance(w, context.topics));
    case 'fixed':
      return bank.map(() => 1); // uniform
    case 'random':
      return bank.map(() => rng());
    default:
      return bank.map(() => 1);
  }
}
```

### 4. Generator Function

Main entry point that produces candidate responses:

```javascript
function generateSentenceCandidates(context) {
  const templates = selectTemplates(context);
  const candidates = [];
  
  for (const template of templates) {
    for (let i = 0; i < 3; i++) {  // 3 variations per template
      let sentence = template.structure[i % template.structure.length];
      for (const [slot, slotDef] of Object.entries(template.slots)) {
        const word = fillSlot(slotDef, { ...context, variation: i });
        sentence = sentence.replace(`{${slot}}`, word);
      }
      candidates.push(capitalizeFirst(sentence));
    }
  }
  
  return candidates;
}
```

### 5. CoVe Validation

All generated sentences pass through the existing 7-check pipeline:

```javascript
function validateSentence(sentence, context) {
  // 1. Non-null, non-empty
  if (!sentence || !sentence.trim()) return false;
  
  // 2. Length in [15, 500] characters
  if (sentence.length < 15 || sentence.length > 500) return false;
  
  // 3. No persona-breaking phrases
  if (/(As an AI|language model|I cannot)/i.test(sentence)) return false;
  
  // 4. No unverifiable memory claims
  if (hasUnverifiableMemory(sentence, state.memories)) return false;
  
  // 5. Affection-stage consistency
  if (!isStageAppropriate(sentence, state.affection)) return false;
  
  // 6. Bilinear score above threshold
  const score = kiraAI.scorer.score(context.ctxVec, kiraAI.respEnc.fwd(sentence));
  if (score <= -0.5) return false;
  
  // 7. No invariant violations
  if (hasInvariantViolation(sentence)) return false;
  
  return true;
}
```

### 6. NSFW Content Gating

NSFW words are gated by relationship stage to maintain appropriateness:

```javascript
function isNSFWAllowed(context) {
  // Stage thresholds: 
  // 0-Stranger, 50-Acquaintance, 150-Friendly, 
  // 300-Close, 500-Devoted, 750-Soulbound
  
  if (state.affection < 300) return false;  // Close+ required
  if (state.personality !== 'spicy') return false;  // Only in spicy mode
  
  // Even in spicy mode, scale intensity by stage
  const stageFactor = (state.affection - 300) / 450;  // 0.0 to 1.0
  return { allowed: true, intensity: stageFactor };
}

function getWordBank(category, context) {
  if (category.startsWith('nsfw_')) {
    const gate = isNSFWAllowed(context);
    if (!gate.allowed) return null;
    
    // Filter by intensity
    const bank = WORD_BANKS[category];
    return bank.filter(w => w.intensity <= gate.intensity);
  }
  
  return WORD_BANKS[category];
}
```

## Integration Points

### Primary: handleGeneral()

```javascript
function handleGeneral(text, userMood, tod) {
  const n = namePrefix();
  const len = text.length;
  
  // Get context
  const context = {
    mood: userMood,
    stage: getStage(state.affection),
    topics: detectTopics(text),
    timeOfDay: tod,
    affection: state.affection,
    ctxVec: _aiCtx.ctxVec,
    name: state.userName,
  };
  
  // Generate dynamic candidates
  const dynamicCandidates = generateSentenceCandidates(context);
  
  // Filter through CoVe
  const validCandidates = dynamicCandidates.filter(c => 
    validateSentence(c, context)
  );
  
  // Merge with static pool (fallback)
  const staticPool = getStaticPool(len, tod);
  const allCandidates = [...validCandidates, ...staticPool];
  
  // Rank with existing bilinear scorer
  return kiraAI.rank(allCandidates, _aiCtx.ctxVec);
}
```

### Secondary: Other Handlers

- `handleFlirt()` — Enhanced with NSFW word bank (stage-gated)
- `handleILoveYou()` — More varied affectionate responses
- `handleCompliment()` — Dynamic gratitude expressions
- `handleUserFeelsBad()` — Softer, more empathetic word choices

## Word Bank Curation Strategy

### 1. Automated Import
```bash
npm install naughty-words english-words
```

### 2. Manual Curation
- Remove overly offensive words from NSFW bank
- Add relationship-appropriate intimate vocabulary
- Curate emotion word lists by mood category
- Add connector phrases for natural flow

### 3. Semantic Enrichment
- Tag words with mood relevance scores
- Assign intensity levels (1-5) for stage gating
- Categorize by part of speech for template fitting
- Add usage context tags (night-appropriate, deep-conversation, etc.)

## Implementation Plan

### Phase 1: Infrastructure (Week 1)
1. Install npm packages and extract word lists
2. Create word bank manager with categorization
3. Build template system skeleton
4. Implement basic slot filler

### Phase 2: Core Generation (Week 2)
1. Write 50+ response templates
2. Implement generator function
3. Add CoVe validation layer
4. Test with mock contexts

### Phase 3: Integration (Week 3)
1. Integrate into handleGeneral()
2. Add to 3-4 other handlers
3. Test backward compatibility
4. Verify all invariants hold

### Phase 4: NSFW Support (Week 4)
1. Implement stage gating logic
2. Add NSFW templates for flirt/love handlers
3. Test intensity scaling
4. Verify no leakage to low-affection states

### Phase 5: Polish (Week 5)
1. Tune word selection weights
2. Add more template variety
3. Optimize performance
4. Run extensive CoVe tests

## Performance Considerations

- **Word bank size**: ~5,000 curated words (from 100K+ available)
- **Template count**: 50-100 templates across all handlers
- **Candidates per call**: 12-24 (6-12 dynamic + 6-12 static)
- **Generation time**: <5ms (simple string ops + weighted random)
- **Memory footprint**: ~200KB for all word banks + templates
- **No additional neural params**: Uses existing scorer for ranking

## Example Generation

**Input**: "i've been thinking about you a lot lately"
**Context**: { mood: 'flirty', stage: 'Close', affection: 450, tod: 'night' }

**Template**: `{opener} {subject} {intensifier} {verb} {object} {closer}`

**Slots filled**:
- opener: "You know,"
- subject: "I"
- intensifier: "really"
- verb: "cherish" (from verbs_affection, mood-weighted)
- object: "this connection" (from nouns_abstract, topic-weighted)
- closer: "it means everything" (from closers, stage-weighted)

**Generated**: "You know, I really cherish this connection—it means everything"

**CoVe checks**: ✅ All pass
**Ranked with static pool**: Selected by bilinear scorer
**Output**: "You know, I really cherish this connection—it means everything ✨"

## Future Extensions

1. **Learning from feedback**: Track which generated responses get positive reactions
2. **Template evolution**: Add/remove templates based on usage patterns
3. **Word association**: Build co-occurrence matrix from user's own vocabulary
4. **Multi-sentence generation**: Chain templates for longer responses
5. **Style adaptation**: Mirror user's sentence structure and word choices
