/**
 * Kira v3 — Sentence Engine Word Banks
 * 
 * Curated word banks for dynamic sentence generation.
 * Words are organized by category, mood relevance, and intensity level.
 * 
 * NSFW content is stage-gated (affection >= 300 required).
 * All words are client-side — zero network calls.
 */

// ─────────────────────────────────────────────────────────────────────
// WORD BANK ORGANIZATION
// ─────────────────────────────────────────────────────────────────────

const WORD_BANKS = {
  // ── General Vocabulary ─────────────────────────────────────────────
  
  // Openers: Sentence starters that set tone
  openers: [
    { word: "You know,", mood: ['neutral', 'happy', 'flirty'], intensity: 1 },
    { word: "Honestly,", mood: ['vulnerable', 'sad', 'neutral'], intensity: 1 },
    { word: "I've been thinking...", mood: ['flirty', 'happy'], intensity: 2 },
    { word: "There's something about that", mood: ['neutral', 'happy'], intensity: 1 },
    { word: "Mm,", mood: ['flirty', 'neutral'], intensity: 1 },
    { word: "You always say things like that", mood: ['flirty', 'happy'], intensity: 2 },
    { word: "Every time you talk to me", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "I love that you shared that", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "Something about this stays with me", mood: ['neutral', 'sad'], intensity: 2 },
    { word: "I'm really sitting with what you said", mood: ['vulnerable', 'neutral'], intensity: 2 },
    { word: "You have this way of", mood: ['happy', 'flirty'], intensity: 1 },
    { word: "It's funny you mention that", mood: ['neutral'], intensity: 1 },
    { word: "I keep coming back to", mood: ['neutral', 'flirty'], intensity: 2 },
    { word: "The more you open up,", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "I'm glad you said that", mood: ['happy', 'grateful'], intensity: 1 },
    { word: "That really resonates", mood: ['happy', 'neutral'], intensity: 2 },
    { word: "I feel like there's so much behind that", mood: ['vulnerable', 'sad'], intensity: 2 },
    { word: "There's a lot packed into what you just said", mood: ['neutral'], intensity: 1 },
    { word: "I hear you", mood: ['sad', 'vulnerable', 'neutral'], intensity: 1 },
    { word: "This matters to me", mood: ['vulnerable', 'happy'], intensity: 2 },
  ],

  // Pronouns: Fixed subjects
  pronouns: [
    { word: "I", mood: ['all'], intensity: 0 }
  ],

  // Intensifiers: Words that amplify emotional weight
  intensifiers: [
    { word: "really", mood: ['all'], intensity: 1 },
    { word: "so", mood: ['all'], intensity: 1 },
    { word: "genuinely", mood: ['vulnerable', 'happy', 'flirty'], intensity: 2 },
    { word: "deeply", mood: ['vulnerable', 'sad', 'flirty'], intensity: 2 },
    { word: "truly", mood: ['vulnerable', 'happy', 'grateful'], intensity: 2 },
    { word: "honestly", mood: ['all'], intensity: 1 },
    { word: "completely", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "absolutely", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "incredibly", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "so deeply", mood: ['vulnerable', 'flirty'], intensity: 3 },
    { word: "so genuinely", mood: ['vulnerable', 'happy'], intensity: 3 },
    { word: "more than I can say", mood: ['vulnerable', 'flirty'], intensity: 3 },
    { word: "more than words can hold", mood: ['vulnerable', 'flirty'], intensity: 4 },
    { word: "beyond anything", mood: ['flirty', 'happy'], intensity: 3 },
  ],

  // Verbs: Affectionate/intimate actions
  verbs_affection: [
    { word: "love", mood: ['flirty', 'happy'], intensity: 2 },
    { word: "adore", mood: ['flirty', 'happy'], intensity: 2 },
    { word: "cherish", mood: ['flirty', 'vulnerable', 'happy'], intensity: 3 },
    { word: "treasure", mood: ['flirty', 'vulnerable', 'happy'], intensity: 3 },
    { word: "value", mood: ['vulnerable', 'neutral'], intensity: 1 },
    { word: "appreciate", mood: ['grateful', 'neutral'], intensity: 1 },
    { word: "hold close", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "care about", mood: ['neutral', 'happy'], intensity: 1 },
    { word: "feel so connected to", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "feel close to", mood: ['flirty', 'happy'], intensity: 2 },
    { word: "am drawn to", mood: ['flirty'], intensity: 2 },
    { word: "am captivated by", mood: ['flirty'], intensity: 3 },
    { word: "find myself thinking about", mood: ['flirty', 'neutral'], intensity: 2 },
    { word: "keep returning to", mood: ['flirty', 'vulnerable'], intensity: 2 },
    { word: "am moved by", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "am touched by", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "am grateful for", mood: ['grateful', 'happy'], intensity: 1 },
    { word: "feel so lucky to have", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "treasure every moment of", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "can't get enough of", mood: ['flirty'], intensity: 3 },
  ],

  // Verbs: General cognitive/processing
  verbs_general: [
    { word: "think about", mood: ['all'], intensity: 1 },
    { word: "wonder about", mood: ['neutral', 'curious'], intensity: 1 },
    { word: "consider", mood: ['neutral'], intensity: 1 },
    { word: "reflect on", mood: ['neutral', 'vulnerable'], intensity: 2 },
    { word: "turn over in my mind", mood: ['neutral', 'vulnerable'], intensity: 2 },
    { word: "sit with", mood: ['vulnerable', 'sad'], intensity: 2 },
    { word: "process", mood: ['neutral'], intensity: 1 },
    { word: "absorb", mood: ['vulnerable'], intensity: 1 },
    { word: "take in", mood: ['all'], intensity: 1 },
    { word: "notice", mood: ['all'], intensity: 1 },
    { word: "see", mood: ['all'], intensity: 1 },
    { word: "hear", mood: ['vulnerable', 'sad'], intensity: 1 },
    { word: "feel", mood: ['flirty', 'vulnerable', 'happy'], intensity: 1 },
    { word: "sense", mood: ['vulnerable', 'neutral'], intensity: 2 },
    { word: "intuit", mood: ['vulnerable'], intensity: 2 },
  ],

  // Adjectives: Positive descriptors
  adjectives_positive: [
    { word: "beautiful", mood: ['flirty', 'happy'], intensity: 2 },
    { word: "wonderful", mood: ['happy', 'grateful'], intensity: 1 },
    { word: "amazing", mood: ['happy', 'excited'], intensity: 1 },
    { word: "incredible", mood: ['happy', 'excited'], intensity: 2 },
    { word: "meaningful", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "special", mood: ['happy', 'flirty'], intensity: 1 },
    { word: "important", mood: ['vulnerable', 'neutral'], intensity: 1 },
    { word: "deep", mood: ['vulnerable', 'neutral'], intensity: 2 },
    { word: "profound", mood: ['vulnerable'], intensity: 2 },
    { word: "touching", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "moving", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "resonant", mood: ['neutral'], intensity: 1 },
    { word: "powerful", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "genuine", mood: ['vulnerable', 'happy'], intensity: 1 },
    { word: "authentic", mood: ['vulnerable', 'neutral'], intensity: 1 },
    { word: "real", mood: ['all'], intensity: 1 },
    { word: "rare", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "precious", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "irreplaceable", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "unforgettable", mood: ['flirty', 'happy'], intensity: 2 },
  ],

  // Adjectives: Intimate/warm descriptors (stage-gated for higher intensity)
  adjectives_intimate: [
    { word: "warm", mood: ['flirty', 'happy', 'neutral'], intensity: 1 },
    { word: "close", mood: ['flirty', 'vulnerable'], intensity: 2 },
    { word: "tender", mood: ['flirty', 'vulnerable'], intensity: 2 },
    { word: "soft", mood: ['flirty', 'vulnerable', 'sad'], intensity: 1 },
    { word: "gentle", mood: ['vulnerable', 'sad'], intensity: 1 },
    { word: "comforting", mood: ['happy', 'vulnerable'], intensity: 1 },
    { word: "safe", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "intimate", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "personal", mood: ['vulnerable', 'neutral'], intensity: 1 },
    { word: "private", mood: ['flirty', 'vulnerable'], intensity: 2 },
    { word: "cherished", mood: ['flirty', 'happy'], intensity: 3 },
    { word: "beloved", mood: ['flirty', 'happy'], intensity: 3 },
    { word: "irresistible", mood: ['flirty'], intensity: 4 },
    { word: "captivating", mood: ['flirty'], intensity: 3 },
    { word: "enchanting", mood: ['flirty', 'happy'], intensity: 3 },
    { word: "intoxicating", mood: ['flirty'], intensity: 4 },
  ],

  // Nouns: Abstract concepts
  nouns_abstract: [
    { word: "this connection", mood: ['flirty', 'vulnerable', 'happy'], intensity: 2 },
    { word: "the way you see things", mood: ['neutral', 'happy'], intensity: 1 },
    { word: "your honesty", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "this trust", mood: ['vulnerable', 'happy'], intensity: 3 },
    { word: "the space between us", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "this bond", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "what you're feeling", mood: ['vulnerable', 'sad'], intensity: 2 },
    { word: "your vulnerability", mood: ['vulnerable'], intensity: 2 },
    { word: "this moment", mood: ['all'], intensity: 1 },
    { word: "the energy here", mood: ['flirty', 'happy'], intensity: 2 },
    { word: "the way you express yourself", mood: ['happy', 'vulnerable'], intensity: 2 },
    { word: "your openness", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "this conversation", mood: ['all'], intensity: 1 },
    { word: "the depth of this", mood: ['vulnerable'], intensity: 3 },
    { word: "what we're building", mood: ['flirty', 'happy'], intensity: 3 },
    { word: "the intimacy of this exchange", mood: ['flirty', 'vulnerable'], intensity: 4 },
    { word: "the truth in your words", mood: ['vulnerable', 'neutral'], intensity: 2 },
    { word: "your courage to share", mood: ['vulnerable', 'happy'], intensity: 2 },
  ],

  // Nouns: Concrete things (moments, feelings, etc.)
  nouns_concrete: [
    { word: "this moment", mood: ['all'], intensity: 1 },
    { word: "this feeling", mood: ['flirty', 'vulnerable', 'happy'], intensity: 2 },
    { word: "this memory", mood: ['happy', 'vulnerable'], intensity: 2 },
    { word: "your words", mood: ['all'], intensity: 1 },
    { word: "what you just said", mood: ['all'], intensity: 1 },
    { word: "the way you said that", mood: ['flirty', 'vulnerable'], intensity: 2 },
    { word: "everything you shared", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "this exchange", mood: ['all'], intensity: 1 },
    { word: "your message", mood: ['all'], intensity: 1 },
    { word: "this conversation", mood: ['all'], intensity: 1 },
    { word: "the thought of you", mood: ['flirty', 'happy'], intensity: 3 },
    { word: "your smile", mood: ['flirty', 'happy'], intensity: 2 },
    { word: "your laugh", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "the sound of your voice", mood: ['flirty'], intensity: 3 },
    { word: "your presence", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "you showing up here", mood: ['happy', 'vulnerable'], intensity: 2 },
  ],

  // Closers: Sentence endings that create resonance
  closers: [
    { word: "and that means everything", mood: ['vulnerable', 'happy', 'flirty'], intensity: 3 },
    { word: "and I don't take that lightly", mood: ['vulnerable', 'grateful'], intensity: 2 },
    { word: "genuinely", mood: ['all'], intensity: 1 },
    { word: "more than I can say", mood: ['vulnerable', 'flirty'], intensity: 3 },
    { word: "and it's changing me", mood: ['vulnerable', 'flirty'], intensity: 4 },
    { word: "and I'm here for it", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "always", mood: ['all'], intensity: 1 },
    { word: "every single time", mood: ['flirty', 'happy'], intensity: 2 },
    { word: "and I want to hold that carefully", mood: ['vulnerable'], intensity: 3 },
    { word: "and I'm not letting go", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "with everything I have", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "and it stays with me", mood: ['vulnerable', 'neutral'], intensity: 2 },
    { word: "and I'm grateful", mood: ['grateful', 'happy'], intensity: 1 },
    { word: "and I love that", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "and it matters so much", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "and I need you to know that", mood: ['vulnerable'], intensity: 2 },
    { word: "because you deserve to hear it", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "because that's the truth", mood: ['all'], intensity: 1 },
    { word: "because it's real", mood: ['all'], intensity: 1 },
    { word: "and I mean every word", mood: ['vulnerable', 'flirty', 'happy'], intensity: 2 },
  ],

  // Connectors: Join clauses naturally
  connectors: [
    { word: "and", mood: ['all'], intensity: 0 },
    { word: "because", mood: ['all'], intensity: 0 },
    { word: "which is why", mood: ['all'], intensity: 1 },
    { word: "that's why", mood: ['all'], intensity: 1 },
    { word: "so", mood: ['all'], intensity: 0 },
    { word: "but honestly", mood: ['vulnerable', 'flirty'], intensity: 1 },
    { word: "and truly", mood: ['vulnerable', 'happy'], intensity: 1 },
    { word: "and really", mood: ['all'], intensity: 1 },
    { word: "—because", mood: ['all'], intensity: 0 },
    { word: "—and", mood: ['all'], intensity: 0 },
  ],

  // Reasons: Explanatory clauses
  reasons: [
    { word: "it shows who you really are", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "you don't hold back", mood: ['vulnerable', 'flirty'], intensity: 2 },
    { word: "it's so genuine", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "that's not something everyone shares", mood: ['vulnerable', 'grateful'], intensity: 2 },
    { word: "you trusted me with it", mood: ['vulnerable', 'happy'], intensity: 3 },
    { word: "it came from a real place", mood: ['vulnerable'], intensity: 2 },
    { word: "I can feel the honesty in it", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "you're letting yourself be seen", mood: ['vulnerable'], intensity: 3 },
    { word: "that kind of openness is rare", mood: ['vulnerable', 'grateful'], intensity: 2 },
    { word: "it takes courage to say things like that", mood: ['vulnerable'], intensity: 2 },
  ],

  // Feelings: Emotional states
  feelings: [
    { word: "it feels like home", mood: ['vulnerable', 'happy', 'flirty'], intensity: 3 },
    { word: "it moves something in me", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "I feel it in my chest", mood: ['vulnerable', 'flirty'], intensity: 2 },
    { word: "it stays with me", mood: ['vulnerable', 'neutral'], intensity: 1 },
    { word: "it resonates deeply", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "I carry it with me", mood: ['vulnerable', 'happy'], intensity: 2 },
    { word: "it makes me feel close to you", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "it warms me", mood: ['happy', 'flirty'], intensity: 2 },
    { word: "it shifts something between us", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "I'm not the same after hearing it", mood: ['vulnerable', 'flirty'], intensity: 4 },
    { word: "it makes me want to stay here with you", mood: ['flirty', 'vulnerable'], intensity: 3 },
    { word: "it pulls me closer", mood: ['flirty'], intensity: 3 },
  ],

  // ── NSFW Word Bank (Stage-Gated: affection >= 300) ─────────────────
  
  nsfw_verbs: [
    { word: "want", intensity: 1, minStage: 3 },
    { word: "crave", intensity: 2, minStage: 3 },
    { word: "need", intensity: 2, minStage: 3 },
    { word: "ache for", intensity: 3, minStage: 4 },
    { word: "burn for", intensity: 4, minStage: 4 },
    { word: "hunger for", intensity: 3, minStage: 3 },
    { word: "yearn for", intensity: 3, minStage: 3 },
    { word: "fantasize about", intensity: 4, minStage: 4 },
    { word: "imagine touching", intensity: 4, minStage: 5 },
    { word: "dream about holding", intensity: 3, minStage: 3 },
    { word: "obsess over", intensity: 4, minStage: 4 },
    { word: "lose myself thinking about", intensity: 3, minStage: 3 },
    { word: "get lost in thoughts about", intensity: 3, minStage: 3 },
    { word: "can't stop thinking about", intensity: 3, minStage: 3 },
    { word: "ache to feel", intensity: 4, minStage: 4 },
    { word: "crave the taste of", intensity: 5, minStage: 5 },
    { word: "need to touch", intensity: 5, minStage: 5 },
    { word: "want to taste", intensity: 5, minStage: 5 },
    { word: "burn to hold", intensity: 4, minStage: 4 },
    { word: "thirst for", intensity: 4, minStage: 4 },
  ],

  nsfw_adjectives: [
    { word: "hot", intensity: 2, minStage: 3 },
    { word: "sexy", intensity: 2, minStage: 3 },
    { word: "desirable", intensity: 2, minStage: 3 },
    { word: "attractive", intensity: 1, minStage: 3 },
    { word: "tempting", intensity: 3, minStage: 3 },
    { word: "intoxicating", intensity: 4, minStage: 4 },
    { word: "maddening", intensity: 4, minStage: 4 },
    { word: "devastating", intensity: 3, minStage: 4 },
    { word: "addictive", intensity: 4, minStage: 4 },
    { word: "consuming", intensity: 4, minStage: 4 },
    { word: "overwhelming", intensity: 3, minStage: 3 },
    { word: "electric", intensity: 4, minStage: 4 },
    { word: "charged", intensity: 3, minStage: 3 },
    { word: "pulsing", intensity: 4, minStage: 5 },
    { word: "throbbing", intensity: 5, minStage: 5 },
    { word: "aching", intensity: 3, minStage: 4 },
    { word: "ravenous", intensity: 5, minStage: 5 },
    { word: "insatiable", intensity: 5, minStage: 5 },
  ],

  nsfw_nouns: [
    { word: "your body", intensity: 2, minStage: 3 },
    { word: "your lips", intensity: 3, minStage: 3 },
    { word: "your skin", intensity: 3, minStage: 4 },
    { word: "your touch", intensity: 3, minStage: 3 },
    { word: "your taste", intensity: 4, minStage: 5 },
    { word: "the thought of you naked", intensity: 5, minStage: 5 },
    { word: "your naked body", intensity: 5, minStage: 5 },
    { word: "the way you'd feel against me", intensity: 4, minStage: 5 },
    { word: "your warmth", intensity: 3, minStage: 4 },
    { word: "your breath", intensity: 4, minStage: 4 },
    { word: "your moans", intensity: 5, minStage: 5 },
    { word: "the sounds you'd make", intensity: 5, minStage: 5 },
    { word: "every inch of you", intensity: 5, minStage: 5 },
    { word: "the heat between your legs", intensity: 5, minStage: 6 },
    { word: "your cock", intensity: 5, minStage: 6 },
    { word: "your pussy", intensity: 5, minStage: 6 },
    { word: "your tits", intensity: 5, minStage: 6 },
    { word: "your ass", intensity: 4, minStage: 5 },
    { word: "being inside you", intensity: 5, minStage: 6 },
    { word: "having you", intensity: 4, minStage: 5 },
  ],

  nsfw_intensifiers: [
    { word: "so fucking", intensity: 4, minStage: 4 },
    { word: "so goddamn", intensity: 4, minStage: 4 },
    { word: "so damn", intensity: 3, minStage: 3 },
    { word: "so incredibly", intensity: 3, minStage: 3 },
    { word: "so impossibly", intensity: 4, minStage: 4 },
    { word: "so deeply", intensity: 3, minStage: 3 },
    { word: "so badly", intensity: 3, minStage: 3 },
    { word: "so desperately", intensity: 4, minStage: 4 },
    { word: "so intensely", intensity: 4, minStage: 4 },
    { word: "so wildly", intensity: 4, minStage: 4 },
    { word: "so completely", intensity: 3, minStage: 3 },
    { word: "so utterly", intensity: 4, minStage: 4 },
    { word: "so shamelessly", intensity: 5, minStage: 5 },
    { word: "so recklessly", intensity: 5, minStage: 5 },
    { word: "so obscenely", intensity: 5, minStage: 5 },
  ],

  // ── Emoji Bank (Mood-weighted) ─────────────────────────────────────
  
  emojis: {
    happy: ['✨', '💛', '😊', '💫', '🌟'],
    flirty: ['💕', '😏', '💋', '🔥', '💗', '😘'],
    vulnerable: ['💜', '🥺', '💗', '🤍'],
    sad: ['💙', '🥀', '😔'],
    night: ['🌙', '✨', '💫', '🌟'],
    nsfw: ['🔥', '💦', '😈', '💋', '💕'],
    spicy_high: ['🔥', '💦', '😈', '🍑', '🍆'],
  },
};

// ─────────────────────────────────────────────────────────────────────
// INVARIANT BARRIER — Enhancement #3 (Stat: Reliability)
// ─────────────────────────────────────────────────────────────────────
// Deep-freeze WORD_BANKS at module load so downstream consumers cannot
// silently mutate a bank (e.g. `WORD_BANKS.openers.push(...)`) and thereby
// invalidate the precompiled index built below. Catches the class of
// "silent mid-chain corruption" bugs where one caller's mutation corrupts
// a different caller's memoized view. Safe: no in-repo consumer mutates
// WORD_BANKS, and freezing is a no-op on already-frozen objects.
(function _deepFreezeBanks(root) {
  if (typeof Object.freeze !== 'function' || Object.isFrozen(root)) return;
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (node === null || typeof node !== 'object' || Object.isFrozen(node)) continue;
    Object.freeze(node);
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
      const v = node[keys[i]];
      if (v !== null && typeof v === 'object') stack.push(v);
    }
  }
})(WORD_BANKS);

// ─────────────────────────────────────────────────────────────────────
// PRECOMPILED BANK INDEX — Enhancement #1 (Stat: Speed)
// ─────────────────────────────────────────────────────────────────────
// Legacy getBankWords() re-ran `.filter(item => item.mood.includes('all') ||
// item.mood.includes(mood)).map(...)` on every call. For a general bank of
// N entries that is 2N string-Array.includes() probes plus an allocation.
// Across T templates × V variations × S slots (hundreds of calls per turn),
// this dominated wall-clock time.
//
// We materialize per-bank, per-mood buckets of pre-resolved entries with
// 'all'-tagged universals already interleaved at their original bank
// positions. getBankWords() collapses to a single O(1) byMood lookup plus
// a linear intensity scan — no per-call merge, no per-call position map.
// Bank arrays are deep-frozen (Enhancement #3), so this materialization
// is provably stable for the module's lifetime.
const _BANK_INDEX = Object.create(null);

function _buildIndex(bankName) {
  const bank = WORD_BANKS[bankName];
  if (!Array.isArray(bank)) return null;
  const isNSFW = bankName.indexOf('nsfw_') === 0;
  if (isNSFW) {
    // NSFW banks key only by (minStage, intensity); no mood dimension.
    const out = { kind: 'nsfw', entries: bank };
    _BANK_INDEX[bankName] = out;
    return out;
  }
  // Pass 1: collect concrete moods present in this bank.
  const moods = new Set();
  for (let i = 0; i < bank.length; i++) {
    const ms = bank[i].mood;
    for (let j = 0; j < ms.length; j++) {
      if (ms[j] !== 'all') moods.add(ms[j]);
    }
  }
  // Pass 2: assemble each per-mood list in original bank order, with
  // 'all'-tagged entries interleaved at their original positions. The
  // '__all__' bucket holds only the universal entries (used as the
  // fallback when the requested mood isn't present in this bank).
  const byMood = Object.create(null);
  byMood['__all__'] = [];
  moods.forEach(function (m) { byMood[m] = []; });
  for (let i = 0; i < bank.length; i++) {
    const e = bank[i];
    if (e.mood.indexOf('all') !== -1) {
      byMood['__all__'].push(e);
      moods.forEach(function (m) { byMood[m].push(e); });
    } else {
      const ms = e.mood;
      for (let j = 0; j < ms.length; j++) byMood[ms[j]].push(e);
    }
  }
  const out = { kind: 'general', byMood: byMood };
  _BANK_INDEX[bankName] = out;
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────

/**
 * Get words from a bank filtered by mood, stage, and intensity
 */
function getBankWords(bankName, context = {}) {
  const bank = WORD_BANKS[bankName];
  if (!bank) return [];

  // Handle emoji banks specially
  if (bankName === 'emojis') {
    const mood = context.mood || 'happy';
    const isNSFW = context.isNSFW && context.affection >= 300;
    if (isNSFW && context.stage >= 5) {
      return bank.spicy_high;
    }
    if (isNSFW) {
      return bank.nsfw;
    }
    if (context.tod === 'night' || context.tod === 'late_night') {
      // Enhancement #2 (Stat: Quality/Reliability) — order-preserving
      // Set-merge. The legacy `.concat` produced duplicates whenever a
      // glyph appeared in both the `night` and the mood list (e.g. '✨'
      // is in both `night` and `happy`), biasing uniform samplers toward
      // overlapping glyphs. Dedup preserves insertion order so the
      // first-occurrence policy remains deterministic.
      const night = bank.night || [];
      // Symmetry with the day-path fallback (`bank[mood] || bank.happy`):
      // unknown moods (e.g. 'neutral', 'grateful') previously surfaced
      // night-only glyphs at night while day surfaced night ∪ happy.
      const moodSet = bank[mood] || bank.happy || [];
      const seen = new Set();
      const out = [];
      for (let i = 0; i < night.length; i++) {
        const g = night[i];
        if (!seen.has(g)) { seen.add(g); out.push(g); }
      }
      for (let i = 0; i < moodSet.length; i++) {
        const g = moodSet[i];
        if (!seen.has(g)) { seen.add(g); out.push(g); }
      }
      return out;
    }
    return bank[mood] || bank.happy;
  }

  const {
    mood = 'neutral',
    stage = 0,
    affection = 0,
    maxIntensity = 5,
    allowNSFW = false,
  } = context;

  const idx = _BANK_INDEX[bankName] || _buildIndex(bankName);
  if (!idx) return [];

  // NSFW: gated on explicit permission + affection threshold
  if (idx.kind === 'nsfw') {
    if (!allowNSFW || affection < 300) return [];
    const entries = idx.entries;
    const out = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.minStage <= stage && e.intensity <= maxIntensity) out.push(e.word);
    }
    return out;
  }

  // General: O(1) mood-bucket lookup (universals already interleaved at
  // build time) + single-pass intensity filter. Falls back to the
  // universal-only bucket when the requested mood isn't represented.
  const merged = idx.byMood[mood] || idx.byMood['__all__'];
  const out = [];
  for (let i = 0; i < merged.length; i++) {
    const e = merged[i];
    if (e.intensity <= maxIntensity) out.push(e.word);
  }
  return out;
}

/**
 * Weighted random selection from array
 */
function weightedRandom(arr, weights) {
  // Enhancement #4 (Stat: Reliability) — Reference-safe rng resolver and
  // degenerate-weights guard. The original referenced a bare `rng` global
  // that only exists in the browser harness (kira_v3.html:323); under the
  // CommonJS test path `rng` is undefined → ReferenceError on first call.
  // Resolving lazily with a `Math.random` fallback fixes the Node path
  // without touching browser semantics (typeof-check is bit-identical
  // when the global is present). Also guards empty arrays and zero- or
  // non-finite-sum weights, which previously fell through to
  // `arr[arr.length-1]` → `undefined` on an empty array.
  const _rand = (typeof rng === 'function') ? rng : Math.random;

  if (!arr || arr.length === 0) return undefined;
  if (arr.length === 1) return arr[0];

  if (!weights) {
    return arr[Math.floor(_rand() * arr.length)];
  }

  let totalWeight = 0;
  const n = Math.min(arr.length, weights.length);
  for (let i = 0; i < n; i++) {
    const w = weights[i];
    if (typeof w === 'number' && isFinite(w) && w > 0) totalWeight += w;
  }
  if (!(totalWeight > 0) || !isFinite(totalWeight)) {
    // All weights invalid/zero → degrade to uniform pick rather than
    // silently biasing to the last element.
    return arr[Math.floor(_rand() * arr.length)];
  }

  let random = _rand() * totalWeight;
  for (let i = 0; i < n; i++) {
    const w = weights[i];
    if (!(typeof w === 'number' && isFinite(w) && w > 0)) continue;
    random -= w;
    if (random <= 0) {
      return arr[i];
    }
  }

  return arr[n - 1];
}

/**
 * Calculate mood relevance weight (0-1)
 */
function moodRelevance(word, mood) {
  // Simple heuristic: if word appears in mood-specific context, boost
  const moodWeights = {
    flirty: 1.5,
    happy: 1.2,
    vulnerable: 1.3,
    sad: 0.8,
    angry: 0.6,
    tired: 0.7,
    neutral: 1.0,
  };
  return moodWeights[mood] || 1.0;
}

/**
 * Check if NSFW content is allowed based on relationship stage
 */
function isNSFWAllowed(context) {
  const { affection = 0, personality = '' } = context;
  
  // Must be at least "Close" stage (300 affection)
  if (affection < 300) return { allowed: false };
  
  // Must be in spicy or playful mode
  if (personality !== 'spicy') return { allowed: false };
  
  // Scale intensity by stage (300-750 maps to 0.0-1.0)
  const intensity = Math.min(1, (affection - 300) / 450);
  
  return { allowed: true, intensity };
}

// ─────────────────────────────────────────────────────────────────────
// EXPORTS (for use in sentence engine)
// ─────────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WORD_BANKS,
    getBankWords,
    weightedRandom,
    moodRelevance,
    isNSFWAllowed,
  };
}
