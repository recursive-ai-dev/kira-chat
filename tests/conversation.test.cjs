'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {loadModel} = require('./helpers/load-model.cjs');
const {K, dialogue} = loadModel();

function conversation(steps) {
  let state = K.initialState();
  const events = [];
  const replies = [];
  for (const step of steps) {
    const event = {
      seq: events.length + 1,
      time: 1_735_689_600_000 + events.length,
      ...(typeof step === 'string' ? {type: 'message', text: step} : step),
    };
    const result = dialogue.step(state, event);
    state = result.state;
    events.push(event);
    if (result.plan) replies.push(result.plan);
  }
  assert.equal(K.hash(dialogue.replay(events)), K.hash(state), 'event log must replay exactly');
  return {state, replies};
}

const active = state => state.memories.filter(memory => memory.status === 'active');

test('pronoun correction supersedes the earlier preference', () => {
  const {state, replies} = conversation([
    'I like coffee',
    "I don't like it anymore",
    'Do I like coffee?',
  ]);
  assert.equal(active(state).length, 1);
  assert.equal(K.describeMemory(active(state)[0]), 'You do not like coffee');
  assert.equal(state.memories[0].status, 'superseded');
  assert.match(replies.at(-1).text, /You do not like coffee/);
});

test('a new aversion supersedes an incompatible liking', () => {
  const {state, replies} = conversation([
    'I like coffee',
    'I dislike coffee',
    'Do I like coffee?',
  ]);
  assert.equal(active(state).length, 1);
  assert.equal(K.describeMemory(active(state)[0]), 'You dislike coffee');
  assert.equal(state.memories[0].status, 'superseded');
  assert.match(replies.at(-1).text, /You dislike coffee/);
  assert.doesNotMatch(replies.at(-1).text, /You like coffee/);
});

test('a new liking supersedes an incompatible aversion', () => {
  const {state} = conversation(['I dislike coffee', 'I like coffee']);
  assert.equal(active(state).length, 1);
  assert.equal(K.describeMemory(active(state)[0]), 'You like coffee');
  assert.equal(state.memories[0].status, 'superseded');
});

test('conflicting reports in one message ask for clarification before saving', () => {
  for (const text of ['I like coffee and I dislike coffee', 'I like coffee. I dislike coffee.']) {
    const {state, replies} = conversation([text]);
    assert.equal(state.memories.length, 0);
    assert.equal(replies[0].act, 'clarify');
    assert.match(replies[0].text, /reports conflict/);
  }
});

test('not loving something does not erase a reported liking', () => {
  const {state} = conversation(['I like coffee', "I don't love coffee"]);
  assert.deepEqual(Array.from(active(state), K.describeMemory), ['You like coffee', 'You do not love coffee']);
});

test('ambiguous reports stay uncommitted until a meaning is selected', () => {
  const {state, replies} = conversation(['I like bass', 'bass guitar']);
  assert.match(replies[0].text, /I’ll save it once I know which one you mean/);
  assert.equal(active(state).length, 1);
  assert.equal(active(state)[0].object.concept, 'c:bass-instrument');
  assert.equal(active(state)[0].sourceMessage, 'user:1');
  assert.equal(active(state)[0].resolutionMessage, 'user:2');
});

test('quoted or conditional statements do not become memories', () => {
  const {state} = conversation(['If I liked coffee, I would say so', 'Alex said "I like tea"']);
  assert.equal(active(state).length, 0);
});

test('support follow-up stores the exact question the user saw', () => {
  for (const persona of ['warm', 'playful', 'thoughtful', 'direct']) {
    for (const message of ['I am sad', 'I need support']) {
      const {state, replies} = conversation([
        {type: 'settings', settings: {persona}},
        message,
      ]);
      const question = state.context.pending?.question;
      assert.ok(question?.endsWith('?'));
      assert.ok(replies.at(-1).text.endsWith(question));
      if (persona === 'thoughtful') assert.equal(question, 'Is there a detail you want to start with?');
    }
  }
});

test('answering a support follow-up keeps attribution to the source message', () => {
  const {state, replies} = conversation(['I am sad', 'I lost my notebook']);
  assert.equal(active(state).length, 1);
  assert.equal(active(state)[0].sourceMessage, 'user:1');
  assert.equal(replies.at(-1).act, 'topic');
  assert.equal(replies.at(-1).policy.discourse.sourceMessage, 'user:2');
  assert.equal(replies.at(-1).policy.discourse.questionMessage, 'kira:1');
});

test('the new model rejects an older version-pinned session', () => {
  assert.equal(K.STORE_KEY, 'kira_rse_4_2_0');
  const oldMetadata = K.clone({...K.APP_META, version: '4.1.3', modelHash: 'old-model-hash'});
  const envelope = K.packSession([], K.initialState(), oldMetadata);
  assert.throws(() => K.inspectEnvelope(envelope, K.APP_META), /different version of Kira/);
});

test('emphasis words do not become part of a preference', () => {
  const {state, replies} = conversation(['I really like cats', 'I like pizza a lot', 'I like pizza so much']);
  assert.deepEqual([...active(state).map(K.describeMemory)], ['You like cats', 'You like pizza']);
  assert.match(replies[2].text, /I have that saved already/);
});

test('a stated favorite is saved as a preference with its original casing', () => {
  const {state} = conversation(['my favorite band is Radiohead', 'coffee is my favourite drink']);
  assert.deepEqual([...active(state).map(K.describeMemory)], ['You love Radiohead', 'You love coffee']);
});

test('hard news gets a gentle reply and saves nothing', () => {
  const {state, replies} = conversation(['my dog died']);
  assert.equal(replies[0].act, 'support');
  assert.match(replies[0].text, /sorry/i);
  assert.equal(state.memories.length, 0);
  assert.equal(state.context.pending.topic, 'support');
});

test('confirming a suggested name saves it', () => {
  const {state, replies} = conversation(["I'm Damien", 'yes', "what's my name?"]);
  assert.deepEqual([...active(state).map(K.describeMemory)], ['Your name is Damien']);
  assert.equal(replies.at(-1).text, 'You’re Damien.');
});

test('recall finds a preference saved under a clarified meaning', () => {
  const {replies} = conversation(['I like bass', 'bass guitar', 'Do I like bass?']);
  assert.match(replies.at(-1).text, /^You like bass/);
});

test('small talk, jokes, and questions about Kira get direct replies', () => {
  const {replies} = conversation(['Tell me a joke', 'another one', 'haha', 'yes', 'ok', 'are you real?', 'what can you do?']);
  const jokes = replies.slice(0, 4).filter(r => r.act === 'joke').map(r => r.text);
  assert.equal(jokes.length, 3);
  assert.equal(new Set(jokes).size, 3, 'jokes should not repeat');
  assert.equal(replies[2].act, 'social');
  assert.equal(replies[4].act, 'social');
  assert.match(replies[5].text, /fictional character/);
  assert.match(replies[6].text, /What would you like to start with\?$/);
  for (const r of replies) assert.doesNotMatch(r.text, /lost the thread|lexicon yet/);
});

test('the vocabulary explorer lists words by label without dialogue internals', () => {
  const {lexicon} = loadModel();
  const {entries} = lexicon({text: ''});
  assert.ok(!entries.some(e => e.id === 'c:about' || e.id === 'c:affection'));
  const labels = entries.map(e => K.fold(e.label));
  assert.deepEqual(labels, labels.slice().sort());
});

test('duplicate word in preference list is treated as one preference, not two', () => {
  // "I like coffee and coffee" — the same label appears twice in a conjunction.
  // The model must save exactly one memory and must NOT reply with the spurious
  // "I've kept those reports separately" message (which implies two distinct items).
  const {state, replies} = conversation(['I like coffee and coffee']);
  const activeMemories = state.memories.filter(m => m.status === 'active');
  assert.equal(activeMemories.length, 1, 'only one memory should be created');
  assert.equal(K.describeMemory(activeMemories[0]), 'You like coffee');
  assert.doesNotMatch(replies[0].text, /kept those reports separately/,
    'duplicate input must not trigger the multi-item reply');
  assert.match(replies[0].text, /coffee/, 'reply must mention the preference');
});

test('repeating the same preference conjunction says "already saved", not "kept separately"', () => {
  // When a user repeats "I like coffee and tea" verbatim, both memories already
  // exist so nothing new is created. The reply must NOT say "I've kept those
  // reports separately" (which implies a new operation). Instead it must
  // acknowledge the memories were already saved.
  const {state, replies} = conversation(['I like coffee and tea', 'I like coffee and tea']);
  const activeMemories = state.memories.filter(m => m.status === 'active');
  assert.equal(activeMemories.length, 2, 'still exactly two memories');
  assert.doesNotMatch(replies[1].text, /kept those reports separately/,
    'second identical conjunction must not trigger the "kept separately" reply');
  assert.match(replies[1].text, /saved already/,
    'reply must acknowledge the memories were already saved');
});

test('mixed-new/existing conjunction must not say "kept separately" for the known item', () => {
  // When user says "I like coffee and tea" then "I like coffee and pizza",
  // coffee is already saved (created=false) and pizza is brand new (created=true).
  // Saying "I've kept those reports separately" is misleading because coffee was
  // already known — the reply must not use that phrase, and must mention pizza
  // (the newly added preference).
  const {state, replies} = conversation(['I like coffee and tea', 'I like coffee and pizza']);
  const activeMemories = state.memories.filter(m => m.status === 'active');
  assert.equal(activeMemories.length, 3, 'three active memories: coffee, tea, pizza');
  assert.doesNotMatch(replies[1].text, /kept those reports separately/,
    'mixed new/existing conjunction must not trigger the "kept separately" reply');
  assert.match(replies[1].text, /pizza/,
    'reply must mention the newly added preference');
});

test('"forget my name" retires the saved name memory', () => {
  // When the user says "forget my name", the forget handler must retire the
  // active name memory even though "my name" does not appear in the lexicon and
  // therefore yields a literal key that will not match the stored name object key.
  // Before the fix, this replied "I don't have an active memory matching that."
  // while the name was still active.
  const {state, replies} = conversation(['My name is Alice', 'forget my name']);
  const activeMemories = state.memories.filter(m => m.status === 'active');
  assert.equal(activeMemories.length, 0, 'name memory must be retired after "forget my name"');
  assert.doesNotMatch(replies[1].text, /don't have an active memory/,
    'must not claim no matching memory when the name is saved');
  assert.match(replies[1].text, /stop using/,
    'reply must confirm the memory was retired');
});
