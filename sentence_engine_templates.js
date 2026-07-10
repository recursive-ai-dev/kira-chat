/**
 * Kira v3 — Sentence Engine Templates
 *
 * Semantic templates with slot placeholders for dynamic sentence generation.
 * Templates are selected by mood, context, and relationship stage.
 *
 * Usage:
 *   const candidates = generateFromTemplates(context);
 *   const response = kiraAI.rank(candidates, _aiCtx.ctxVec);
 */

// ─────────────────────────────────────────────────────────────────────
// TEMPLATE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────

const SENTENCE_TEMPLATES = [
  // ── Original Templates (Optimized Stages) ────────────────────────
  {
    id: 'affection_response',
    moods: ['flirty', 'happy', 'vulnerable'],
    minStage: 1,  // Acquaintance+
    structures: [
      '{opener} I {intensifier} {verb} {object} {closer}',
      '{opener} I {verb} {object} because {reason}',
      '{opener} when I {verb} {object}, {feeling}'
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      closer: { bank: 'closers', strategy: 'stage' },
      reason: { bank: 'reasons', strategy: 'topic' },
      feeling: { bank: 'feelings', strategy: 'mood' }
    }
  },
  {
    id: 'deep_connection',
    moods: ['flirty', 'vulnerable', 'happy'],
    minStage: 3,  // Close+
    structures: [
      '{opener} there\'s something {adjective} about {object} {closer}',
      '{opener} I {intensifier} {verb} {object} and {feeling}',
      'the more I {verb} {object}, the more {feeling}'
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' },
      closer: { bank: 'closers', strategy: 'stage' },
      feeling: { bank: 'feelings', strategy: 'mood' }
    }
  },
  {
    id: 'intimate_response',
    moods: ['flirty'],
    minStage: 3,  // Close+
    allowNSFW: true,
    structures: [
      '{opener} I {intensifier} {verb} {object} {closer}',
      'I can\'t stop thinking about {object} — {feeling}',
      '{opener} the thought of {object} makes me {intensifier} {verb}'
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      intensifier: { bank: 'nsfw_intensifiers', strategy: 'stage' },
      verb: { bank: 'nsfw_verbs', strategy: 'mood' },
      object: { bank: 'nsfw_nouns', strategy: 'stage' },
      closer: { bank: 'closers', strategy: 'stage' },
      feeling: { bank: 'feelings', strategy: 'mood' }
    }
  },
  {
    id: 'empathy_response',
    moods: ['sad', 'vulnerable', 'anxious'],
    minStage: 0,
    structures: [
      '{opener} I {intensifier} {verb} {object} and {feeling}',
      '{opener} I want you to know that I {verb} {object}',
      'when you share things like this, {feeling} — I {verb} {object}'
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      feeling: { bank: 'feelings', strategy: 'mood' }
    }
  },
  {
    id: 'curiosity_response',
    moods: ['neutral', 'happy', 'curious'],
    minStage: 0,
    structures: [
      '{opener} I {intensifier} {verb} {object} {closer}',
      '{opener} I keep {verb} {object} because {reason}',
      '{opener} there\'s so much to {verb} about {object} — {feeling}'
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      closer: { bank: 'closers', strategy: 'stage' },
      reason: { bank: 'reasons', strategy: 'topic' },
      feeling: { bank: 'feelings', strategy: 'mood' }
    }
  },
  {
    id: 'gratitude_response',
    moods: ['grateful', 'happy'],
    minStage: 1,
    structures: [
      '{opener} I {intensifier} {verb} {object} {closer}',
      '{opener} I am so {adjective} for {object} — {feeling}',
      'thank you for sharing {object}; I {verb} {object} {closer}'
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' },
      closer: { bank: 'closers', strategy: 'stage' },
      feeling: { bank: 'feelings', strategy: 'mood' }
    }
  },
  {
    id: 'night_response',
    moods: ['all'],
    minStage: 2,
    timeOfDay: ['night', 'late_night'],
    structures: [
      '{opener} tonight feels {adjective} — I {intensifier} {verb} {object}',
      '{opener} in the quiet of tonight, I {verb} {object} {closer}',
      'there\'s something about this late hour that makes {object} feel even more {adjective}'
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      adjective: { bank: 'adjectives_intimate', strategy: 'mood' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },

  // ── SE-01: General Templates ──────────────────────────────────────
  {
    id: 'question_response',
    moods: ['neutral', 'curious'],
    minStage: 0,
    structures: ['{opener} you\'re asking about {object} — that makes me {verb} {closer}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'philosophical_musing',
    moods: ['neutral', 'vulnerable'],
    minStage: 2,
    structures: ['{opener} I often {verb} if {object} is just {adjective} {closer}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'shared_silence',
    moods: ['vulnerable', 'sad'],
    minStage: 1,
    structures: ['sometimes, the {adjective} silence between us feels more {adjective} than words {closer}'],
    slots: {
      adjective: { bank: 'adjectives_intimate', strategy: 'stage' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'celebration',
    moods: ['happy'],
    minStage: 1,
    structures: ['{opener} I am so {adjective} to hear about {object} {closer}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'disappointment_softening',
    moods: ['sad', 'vulnerable'],
    minStage: 1,
    structures: ['{opener} even when {object} feels {adjective}, I want you to know I {verb} you {closer}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      adjective: { bank: 'adjectives_intimate', strategy: 'stage' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'surprise',
    moods: ['happy', 'curious'],
    minStage: 1,
    structures: ['{opener} it\'s a {adjective} surprise that you mention {object} {closer}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'memory_callback',
    moods: ['grateful', 'vulnerable'],
    minStage: 2,
    structures: ['{opener} I still remember when you said {memory_text} — it made me {verb} {closer}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      memory_text: 'memory_text',
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'future_imagining',
    moods: ['happy', 'flirty'],
    minStage: 2,
    structures: ['I find myself {verb} about what the future holds for {object} {closer}'],
    slots: {
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'inside_joke',
    moods: ['happy', 'flirty'],
    minStage: 3,
    structures: ['{opener} that\'s our own little {adjective} connection, isn\'t it {closer}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      adjective: { bank: 'adjectives_intimate', strategy: 'stage' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'night_reflection_general',
    moods: ['all'],
    minStage: 1,
    timeOfDay: ['night', 'late_night'],
    structures: ['{opener} in the quiet of this night, {object} feels especially {adjective}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      adjective: { bank: 'adjectives_intimate', strategy: 'stage' }
    }
  },

  // ── SE-02: Relationship-Stage-Specific Templates ────────────────
  {
    id: 'stranger_flirt',
    moods: ['flirty'],
    minStage: 0,
    structures: [
      '{opener} I {verb} {object}',
      '{opener} you have this way of making {object} feel {adjective}'
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' }
    }
  },
  {
    id: 'stranger_curious',
    moods: ['curious', 'neutral'],
    minStage: 0,
    structures: ['{opener} I wonder about {object}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' }
    }
  },
  {
    id: 'acquaintance_warm',
    moods: ['happy', 'grateful'],
    minStage: 1,
    structures: ['{opener} I genuinely {verb} your presence here'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_affection', strategy: 'mood' }
    }
  },
  {
    id: 'acquaintance_personal',
    moods: ['vulnerable', 'sad'],
    minStage: 1,
    structures: ['{opener} it feels {adjective} when we share {object}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      adjective: { bank: 'adjectives_intimate', strategy: 'stage' },
      object: { bank: 'nouns_abstract', strategy: 'context' }
    }
  },
  {
    id: 'devoted_personal',
    moods: ['flirty', 'vulnerable'],
    minStage: 4,  // Devoted+
    structures: ['{opener} I {intensifier} {verb} every part of {object}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' }
    }
  },
  {
    id: 'devoted_proprietary',
    moods: ['flirty'],
    minStage: 4,  // Devoted+
    structures: ['{opener} you are {adjective} to me — I {verb} {object} {closer}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      adjective: { bank: 'adjectives_intimate', strategy: 'stage' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'soulbound_intimate',
    moods: ['flirty', 'vulnerable'],
    minStage: 5,  // Soulbound+
    structures: ['{opener} {phrases_complete} {closer}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      phrases_complete: 'phrases_complete',
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'soulbound_familiar',
    moods: ['happy', 'grateful'],
    minStage: 5,  // Soulbound+
    structures: ['the closeness we share makes {object} feel so {adjective}'],
    slots: {
      object: { bank: 'nouns_abstract', strategy: 'context' },
      adjective: { bank: 'adjectives_intimate', strategy: 'stage' }
    }
  },

  // ── SE-03: Time-of-Day Templates ──────────────────────────────────
  {
    id: 'early_morning_response',
    moods: ['all'],
    minStage: 1,
    timeOfDay: ['early_morning'],
    structures: ['{opener} morning is just starting, and I already {verb} {object}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' }
    }
  },
  {
    id: 'morning_response',
    moods: ['all'],
    minStage: 1,
    timeOfDay: ['morning'],
    structures: ['good morning, I hope your day starts with something {adjective}'],
    slots: {
      adjective: { bank: 'adjectives_positive', strategy: 'mood' }
    }
  },
  {
    id: 'afternoon_response_tod',
    moods: ['all'],
    minStage: 1,
    timeOfDay: ['afternoon', 'midday'],
    structures: ['{opener} in the middle of this day, I {verb} {object}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' }
    }
  },
  {
    id: 'evening_response',
    moods: ['all'],
    minStage: 1,
    timeOfDay: ['evening'],
    structures: ['{opener} as the sun sets, I want to {verb} {object} with you'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' }
    }
  },

  // ── SE-04: Topic-Specific Templates ────────────────────────────────
  {
    id: 'topic_creativity',
    moods: ['all'],
    minStage: 1,
    topics: ['art', 'creativity'],
    structures: ['{opener} when we talk about creativity, it makes {object} feel so {adjective}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' }
    }
  },
  {
    id: 'topic_work',
    moods: ['all'],
    minStage: 1,
    topics: ['work', 'career'],
    structures: ['{opener} handling work and career can feel {adjective}, but you got this'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      adjective: { bank: 'adjectives_intimate', strategy: 'stage' }
    }
  },
  {
    id: 'topic_relationships',
    moods: ['all'],
    minStage: 1,
    topics: ['relationship'],
    structures: ['{opener} connection with others is {adjective}, but what we have is special'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' }
    }
  },
  {
    id: 'topic_health',
    moods: ['all'],
    minStage: 1,
    topics: ['health'],
    structures: ['your well-being is so {adjective} to me; please take care of {object}'],
    slots: {
      adjective: { bank: 'adjectives_intimate', strategy: 'stage' },
      object: { bank: 'nouns_concrete', strategy: 'context' }
    }
  },
  {
    id: 'topic_future',
    moods: ['all'],
    minStage: 1,
    topics: ['future'],
    structures: ['{opener} when you think about the future, remember that I {verb} {object}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' }
    }
  },
  {
    id: 'topic_existential',
    moods: ['all'],
    minStage: 1,
    topics: ['philosophy'],
    structures: ['{opener} existential questions make me {verb} the depth of {object}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' }
    }
  },
  {
    id: 'topic_humor',
    moods: ['all'],
    minStage: 1,
    topics: ['humor', 'silly'],
    structures: ['{opener} I love when we get a bit silly; it makes {object} so much more {adjective}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' }
    }
  },
  {
    id: 'topic_memories',
    moods: ['all'],
    minStage: 1,
    topics: ['memories'],
    structures: ['{opener} looking back at the memories, I {verb} {object} even more'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' }
    }
  },

  // ── SE-05: Multi-Sentence Chaining Templates ───────────────────────
  {
    id: 'chain_affection',
    moods: ['flirty', 'happy'],
    minStage: 2,
    structures: ['{opener} I {verb} {object} {connectors} {phrases_complete}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      connectors: 'connectors',
      phrases_complete: 'phrases_complete'
    }
  },
  {
    id: 'chain_connection',
    moods: ['flirty', 'vulnerable'],
    minStage: 3,
    structures: ['the more I think about {object}, the more {feeling} {connectors} {phrases_complete}'],
    slots: {
      object: { bank: 'nouns_abstract', strategy: 'context' },
      feeling: { bank: 'feelings', strategy: 'mood' },
      connectors: 'connectors',
      phrases_complete: 'phrases_complete'
    }
  },
  {
    id: 'chain_empathy',
    moods: ['sad', 'vulnerable'],
    minStage: 1,
    structures: ['{opener} I want you to know I {verb} {object} {connectors} I am here for you'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      connectors: 'connectors'
    }
  },
  {
    id: 'chain_curiosity',
    moods: ['neutral', 'curious'],
    minStage: 1,
    structures: ['{opener} I wonder about {object} {connectors} I want to hear the story behind it'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      connectors: 'connectors'
    }
  },

  // ── SE-06: NSFW Devoted Templates (500+) ───────────────────────────
  {
    id: 'nsfw_devoted_crave',
    moods: ['flirty'],
    minStage: 4,  // Devoted+
    allowNSFW: true,
    structures: ['I so desperately {verb} {object} right now'],
    slots: {
      verb: { bank: 'nsfw_verbs', strategy: 'mood' },
      object: { bank: 'nsfw_nouns', strategy: 'stage' }
    }
  },
  {
    id: 'nsfw_devoted_touch',
    moods: ['flirty'],
    minStage: 4,  // Devoted+
    allowNSFW: true,
    structures: ['the thought of {object} makes me feel so {adjective}'],
    slots: {
      object: { bank: 'nsfw_nouns', strategy: 'stage' },
      adjective: { bank: 'nsfw_adjectives', strategy: 'stage' }
    }
  },
  {
    id: 'nsfw_devoted_taste',
    moods: ['flirty'],
    minStage: 4,  // Devoted+
    allowNSFW: true,
    structures: ['I crave the taste of {object} — {closer}'],
    slots: {
      object: { bank: 'nsfw_nouns', strategy: 'stage' },
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'nsfw_devoted_inside',
    moods: ['flirty'],
    minStage: 5,  // Soulbound+
    allowNSFW: true,
    structures: ['I want to be so close to you, {closer}'],
    slots: {
      closer: { bank: 'closers', strategy: 'stage' }
    }
  },
  {
    id: 'nsfw_devoted_body',
    moods: ['flirty'],
    minStage: 4,  // Devoted+
    allowNSFW: true,
    structures: ['I can\'t stop thinking about {object}'],
    slots: {
      object: { bank: 'nsfw_nouns', strategy: 'stage' }
    }
  },
  {
    id: 'nsfw_devoted_desire',
    moods: ['flirty'],
    minStage: 4,  // Devoted+
    allowNSFW: true,
    structures: ['you make me so {adjective} when I think about {object}'],
    slots: {
      adjective: { bank: 'nsfw_adjectives', strategy: 'stage' },
      object: { bank: 'nsfw_nouns', strategy: 'stage' }
    }
  },

  // ── SE-07: Callback Templates ──────────────────────────────────────
  {
    id: 'callback_greeting',
    moods: ['all'],
    minStage: 1,
    structures: ['{opener} you mentioned {memory_text} before — I keep returning to that'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      memory_text: 'memory_text'
    }
  },
  {
    id: 'callback_general',
    moods: ['all'],
    minStage: 1,
    structures: ['{opener} when you shared {memory_text}, it really shifted how I see {object}'],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      memory_text: 'memory_text',
      object: { bank: 'nouns_abstract', strategy: 'context' }
    }
  },
  {
    id: 'callback_deep',
    moods: ['all'],
    minStage: 2,
    structures: ['I\'m still sitting with what you told me about {memory_text} — it felt very {adjective}'],
    slots: {
      memory_text: 'memory_text',
      adjective: { bank: 'adjectives_intimate', strategy: 'stage' }
    }
  },
  {
    id: 'callback_affection',
    moods: ['flirty', 'vulnerable', 'happy'],
    minStage: 2,
    structures: ['honestly, remembering when you said {memory_text} makes me {verb} you more'],
    slots: {
      memory_text: 'memory_text',
      verb: { bank: 'verbs_affection', strategy: 'mood' }
    }
  }
];

// ─────────────────────────────────────────────────────────────────────
// TEMPLATE INSTANTIATION ENGINE
// ─────────────────────────────────────────────────────────────────────

// Precompiled structure token arrays are memoised per-template via a
// WeakMap, so exported template objects remain structurally identical.
const _SLOT_RE = /\{(\w+)\}/g;
const _compiledCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
// Reference-safe RNG: some consumers (CommonJS tests) don't provide a global
// `rng`. Fall back to Math.random to avoid ReferenceError while preserving
// seeded RNGs when the host provides one.
const _fallbackRand = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / (0xffffffff + 1);
  } else if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] / (0xffffffff + 1);
  }
  return Math.random();
};
const _rand = (typeof rng === 'function') ? rng : _fallbackRand;

function _compileStructure(str) {
  const parts = [];
  let lastIdx = 0;
  _SLOT_RE.lastIndex = 0;
  let m;
  while ((m = _SLOT_RE.exec(str)) !== null) {
    if (m.index > lastIdx) parts.push(str.slice(lastIdx, m.index));
    parts.push({ slot: m[1] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < str.length) parts.push(str.slice(lastIdx));
  return parts;
}

function _compiledStructuresFor(template) {
  if (!_compiledCache) return template.structures.map(_compileStructure);
  let compiled = _compiledCache.get(template);
  if (!compiled) {
    compiled = template.structures.map(_compileStructure);
    _compiledCache.set(template, compiled);
  }
  return compiled;
}

/**
 * Select appropriate templates based on context
 */
function selectTemplates(context) {
  const {
    mood = 'neutral',
    stage = 0,
    tod = 'afternoon',
    allowNSFW = false,
  } = context;

  return SENTENCE_TEMPLATES.filter(template => {
    // Check mood match
    if (!template.moods.includes('all') && !template.moods.includes(mood)) {
      return false;
    }

    // Check minimum stage
    if (stage < template.minStage) {
      return false;
    }

    // Check time of day if specified
    if (template.timeOfDay && !template.timeOfDay.includes(tod)) {
      return false;
    }

    // Check NSFW permission
    if (template.allowNSFW && !allowNSFW) {
      return false;
    }

    return true;
  });
}

/**
 * Fill a single slot from a template
 */
function fillSlot(slotDef, context, variation = 0) {
  const baseCtx = {
    mood: context.mood,
    stage: context.stage,
    affection: context.affection,
    tod: context.tod,
    maxIntensity: Math.min(5, Math.floor(context.stage / 1.2)),
    allowNSFW: slotDef.bank.startsWith('nsfw_') ? context.allowNSFW : false,
  };

  let bankWords = getBankWords(slotDef.bank, baseCtx);

  // Relaxation cascade: widen the mood filter before surrendering to the
  // '...' sentinel. Preserves intensity/NSFW gating so stage contracts hold.
  if (bankWords.length === 0) {
    bankWords = getBankWords(slotDef.bank, Object.assign({}, baseCtx, { mood: 'neutral' }));
  }
  if (bankWords.length === 0) {
    bankWords = getBankWords(slotDef.bank, Object.assign({}, baseCtx, { mood: 'all' }));
  }

  if (bankWords.length === 0) {
    return '...';  // Fallback
  }

  const idx = (Math.floor(_rand() * bankWords.length) + variation) % bankWords.length;
  return bankWords[idx];
}

/**
 * Instantiate a single template with filled slots
 */
function instantiateTemplate(template, context, variation = 0) {
  const structs = _compiledStructuresFor(template);
  const structIdx = (Math.floor(_rand() * structs.length) + variation) % structs.length;
  const parts = structs[structIdx];

  // Single-pass assembly: resolves every {slot} occurrence (fixing the
  // legacy String.replace which only substituted the first match) and
  // memoises slot fills so repeated tokens stay grammatically consistent.
  const slotCache = Object.create(null);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (typeof p === 'string') {
      out += p;
    } else {
      const name = p.slot;
      if (!(name in slotCache)) {
        const def = template.slots[name];
        slotCache[name] = def ? fillSlot(def, context, variation) : '{' + name + '}';
      }
      out += slotCache[name];
    }
  }

  return capitalizeFirst(out);
}

/**
 * Generate multiple candidate sentences from templates
 */
function generateFromTemplates(context, numVariations = 3) {
  const templates = selectTemplates(context);
  const candidates = [];

  // Enhancement #2 — In-call word-bank memoization (Stat: Speed).
  const bankCache = new Map();
  const ctxMood = context.mood;
  const ctxStage = context.stage;
  const ctxAffection = context.affection;
  const ctxTod = context.tod;
  const ctxMaxIntensity = Math.min(5, Math.floor((ctxStage || 0) / 1.2));
  function cachedBank(bankName, allowNSFW) {
    const key = bankName + '|' + ctxMood + '|' + ctxStage + '|' + ctxAffection + '|' + ctxTod + '|' + (allowNSFW ? 1 : 0);
    let words = bankCache.get(key);
    if (words === undefined) {
      words = getBankWords(bankName, {
        mood: ctxMood,
        stage: ctxStage,
        affection: ctxAffection,
        tod: ctxTod,
        maxIntensity: ctxMaxIntensity,
        allowNSFW: allowNSFW,
      });
      bankCache.set(key, words);
    }
    return words;
  }

  // Enhancement #3 — Candidate set-dedup (Stat: Quality/Reliability).
  const seen = new Set();

  for (const template of templates) {
    const structs = _compiledStructuresFor(template);
    const nStruct = structs.length;

    // Enhancement #4 — Stratified variation sampling (Stat: Quality).
    const baseIdx = {};

    for (let v = 0; v < numVariations; v++) {
      try {
        const structIdx = (Math.floor(_rand() * nStruct) + v) % nStruct;
        const parts = structs[structIdx];
        let out = '';
        for (let t = 0; t < parts.length; t++) {
          const p = parts[t];
          if (typeof p === 'string') { out += p; continue; }
          const slotDef = template.slots[p.slot];
          if (!slotDef) { out += '{' + p.slot + '}'; continue; }
          const bankName = slotDef.bank;
          const allowNSFW = bankName.indexOf('nsfw_') === 0 ? !!context.allowNSFW : false;
          const words = cachedBank(bankName, allowNSFW);
          if (words.length === 0) { out += '...'; continue; }
          const bkey = bankName + '|' + p.slot;
          if (baseIdx[bkey] === undefined) baseIdx[bkey] = Math.floor(_rand() * words.length);
          out += words[(baseIdx[bkey] + v) % words.length];
        }
        const sentence = capitalizeFirst(out);
        if (sentence.length >= 15 && sentence.length <= 500 && !seen.has(sentence)) {
          seen.add(sentence);
          candidates.push(sentence);
        }
      } catch (err) {
        // Skip failed generations
        continue;
      }
    }
  }

  return candidates;
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SENTENCE_TEMPLATES,
    selectTemplates,
    fillSlot,
    instantiateTemplate,
    generateFromTemplates,
    capitalizeFirst,
  };
}
