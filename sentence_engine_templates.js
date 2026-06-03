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
  // ── Affectionate Response Templates ────────────────────────────────
  {
    id: 'affection_response',
    moods: ['flirty', 'happy', 'vulnerable'],
    minStage: 1,  // Acquaintance+
    structures: [
      '{opener} {subject} {intensifier} {verb} {object} {closer}',
      '{opener} {subject} {verb} {object} because {reason}',
      '{opener} when {subject} {verb} {object}, {feeling}',
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      subject: { bank: 'pronouns', strategy: 'fixed' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      closer: { bank: 'closers', strategy: 'stage' },
      reason: { bank: 'reasons', strategy: 'topic' },
      feeling: { bank: 'feelings', strategy: 'mood' },
    },
  },

  // ── Deep Connection Templates (Stage-Gated) ───────────────────────
  {
    id: 'deep_connection',
    moods: ['flirty', 'vulnerable', 'happy'],
    minStage: 3,  // Friendly+
    structures: [
      '{opener} there\'s something {adjective} about {object} {closer}',
      '{opener} {subject} {intensifier} {verb} {object} and {feeling}',
      'the more {subject} {verb} {object}, the more {feeling}',
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      subject: { bank: 'pronouns', strategy: 'fixed' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' },
      closer: { bank: 'closers', strategy: 'stage' },
      feeling: { bank: 'feelings', strategy: 'mood' },
    },
  },

  // ── Intimate Response Templates (NSFW, Stage-Gated) ───────────────
  {
    id: 'intimate_response',
    moods: ['flirty'],
    minStage: 4,  // Close+ (affection >= 300)
    allowNSFW: true,
    structures: [
      '{opener} {subject} {intensifier} {verb} {object} {closer}',
      'I can\'t stop thinking about {object} — {subject} {intensifier} {verb} {feeling}',
      '{opener} the thought of {object} makes me {intensifier} {verb}',
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      subject: { bank: 'pronouns', strategy: 'fixed' },
      intensifier: { bank: 'nsfw_intensifiers', strategy: 'stage' },
      verb: { bank: 'nsfw_verbs', strategy: 'mood' },
      object: { bank: 'nsfw_nouns', strategy: 'stage' },
      closer: { bank: 'closers', strategy: 'stage' },
      feeling: { bank: 'feelings', strategy: 'mood' },
    },
  },

  // ── Empathy/Support Templates ──────────────────────────────────────
  {
    id: 'empathy_response',
    moods: ['sad', 'vulnerable', 'anxious'],
    minStage: 0,  // All stages
    structures: [
      '{opener} {subject} {intensifier} {verb} {object} and {feeling}',
      '{opener} {subject} want you to know that {subject} {verb} {object}',
      'when you share things like this, {feeling} — {subject} {verb} {object}',
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      subject: { bank: 'pronouns', strategy: 'fixed' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      feeling: { bank: 'feelings', strategy: 'mood' },
    },
  },

  // ── Curiosity/Engagement Templates ─────────────────────────────────
  {
    id: 'curiosity_response',
    moods: ['neutral', 'happy', 'curious'],
    minStage: 0,
    structures: [
      '{opener} {subject} {intensifier} {verb} {object} {closer}',
      '{opener} {subject} keep {verb} {object} because {reason}',
      '{opener} there\'s so much to {verb} about {object} — {feeling}',
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      subject: { bank: 'pronouns', strategy: 'fixed' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      closer: { bank: 'closers', strategy: 'random' },
      reason: { bank: 'reasons', strategy: 'topic' },
      feeling: { bank: 'feelings', strategy: 'mood' },
    },
  },

  // ── Gratitude Templates ───────────────────────────────────────────
  {
    id: 'gratitude_response',
    moods: ['grateful', 'happy'],
    minStage: 1,
    structures: [
      '{opener} {subject} {intensifier} {verb} {object} {closer}',
      '{opener} {subject} am so {adjective} for {object} — {feeling}',
      'thank you for sharing {object}; {subject} {verb} {object} {closer}',
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      subject: { bank: 'pronouns', strategy: 'fixed' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_affection', strategy: 'mood' },
      object: { bank: 'nouns_concrete', strategy: 'context' },
      adjective: { bank: 'adjectives_positive', strategy: 'mood' },
      closer: { bank: 'closers', strategy: 'stage' },
      feeling: { bank: 'feelings', strategy: 'mood' },
    },
  },

  // ── Night-Time Introspection Templates ────────────────────────────
  {
    id: 'night_response',
    moods: ['all'],
    minStage: 2,
    timeOfDay: ['night', 'late_night'],
    structures: [
      '{opener} tonight feels {adjective} — {subject} {intensifier} {verb} {object}',
      '{opener} in the quiet of tonight, {subject} {verb} {object} {closer}',
      'there\'s something about this late hour that makes {object} feel even more {adjective}',
    ],
    slots: {
      opener: { bank: 'openers', strategy: 'mood' },
      subject: { bank: 'pronouns', strategy: 'fixed' },
      intensifier: { bank: 'intensifiers', strategy: 'stage' },
      verb: { bank: 'verbs_general', strategy: 'mood' },
      object: { bank: 'nouns_abstract', strategy: 'context' },
      adjective: { bank: 'adjectives_intimate', strategy: 'mood' },
      closer: { bank: 'closers', strategy: 'stage' },
    },
  },
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
const _rand = (typeof rng === 'function') ? rng : Math.random;

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
  };
}
