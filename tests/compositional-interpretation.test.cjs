'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {loadModel} = require('./helpers/load-model.cjs');
const {K, dialogue, engine} = loadModel();

function conversation(steps) {
  let state = K.initialState();
  const events = [], replies = [];
  for (const text of steps) {
    const event = {seq:events.length + 1, time:1_735_689_600_000 + events.length, type:'message', text};
    const out = dialogue.step(state, event);
    state = out.state; events.push(event); replies.push(out.plan);
    assert.equal(out.plan.interpretation.text, K.nfc(text).trim(), 'the interpretation retains the original user message');
    for (const memory of state.memories) {
      const source = state.messages.find(message => message.id === memory.sourceMessage);
      assert.ok(source, 'every report keeps its original source');
      assert.ok(memory.span.start >= 0 && memory.span.end <= source.text.length && memory.span.end > memory.span.start,
        'source spans remain bounded in the actual report message');
    }
  }
  assert.equal(K.hash(dialogue.replay(events)), K.hash(state));
  return {state, replies};
}
const active = state => Array.from(state.memories).filter(memory => memory.status === 'active');
const descriptions = state => active(state).map(K.describeMemory);
const parse = text => K.parseConversation(text, K.initialState(), engine);


test('comma and Oxford lists become distinct grounded objects with exact source spans', () => {
  for (const message of ['I like coffee, tea, and jazz', 'I like coffee, tea and jazz', 'I like coffee,tea,jazz']) {
    const {state, replies} = conversation([message]);
    assert.deepEqual(descriptions(state), ['You like coffee', 'You like tea', 'You like jazz']);
    assert.equal(replies[0].claims.length, 3);
    for (const memory of active(state)) assert.equal(message.slice(memory.span.start, memory.span.end), memory.object.label);
  }
});

test('explicit comma-separated reports preserve each predicate and polarity', () => {
  for (const message of ['I like coffee, I love tea', 'I like coffee, I love tea, and I dislike rain', 'I like coffee,I do not like tea']) {
    const {state} = conversation([message]);
    for (const memory of active(state)) assert.equal(message.slice(memory.span.start, memory.span.end), memory.object.label);
    assert.ok(active(state).length >= 2);
  }
  assert.deepEqual(descriptions(conversation(['I like coffee, I love tea, and I dislike rain']).state),
    ['You like coffee', 'You love tea', 'You dislike rain']);
});

test('preference paraphrases preserve the stated predicate and object casing', () => {
  for (const [message, expected] of [
    ["I'm fond of Radiohead", 'You like Radiohead'],
    ["I'm not fond of coffee", 'You do not like coffee'],
    ['Violet tea is something I enjoy', 'You enjoy Violet tea'],
    ['Coffee is something I do not love', 'You do not love Coffee'],
    ["I've always liked jazz", 'You like jazz'],
    ["I've always loved hiking", 'You love hiking'],
    ["I couldn't stand cilantro", 'You used to hate cilantro'],
  ]) {
    const {state} = conversation([message]);
    assert.deepEqual(descriptions(state), [expected], message);
    const memory = active(state)[0];
    assert.equal(message.slice(memory.span.start, memory.span.end), memory.object.label, message);
  }
});

test('no-longer corrections supersede only the matching direct report', () => {
  const {state} = conversation(['I like coffee', 'I love tea', 'I no longer like coffee']);
  assert.equal(state.memories[0].status, 'superseded');
  assert.deepEqual(descriptions(state), ['You love tea', 'You do not like coffee']);
  assert.equal(active(state).at(-1).correction, true);
  assert.equal(active(state).at(-1).sourceMessage, 'user:3');
});

test('mood paraphrases retain negative scope and past tense', () => {
  for (const [message, expected] of [
    ["I've been feeling anxious", 'You feel anxious'],
    ['I have been feeling tired lately', 'You feel tired'],
    ['I do not feel sad', 'You do not feel sad'],
    ["I didn't feel anxious", 'You did not feel anxious'],
    ['I no longer feel sad', 'You do not feel sad'],
  ]) {
    const {state} = conversation([message]);
    assert.deepEqual(descriptions(state), [expected], message);
    const memory = active(state)[0];
    assert.equal(message.slice(memory.span.start, memory.span.end).toLowerCase(), memory.object.label, message);
  }
});

test('natural recall questions stay questions and never add reports', () => {
  const {state, replies} = conversation(['My name is Élodie', 'I like coffee',
    'Can you remind me what I like?', 'Could you remind me of my name?',
    'Can you remind me what I told you?', 'Do you remember if I like coffee?']);
  assert.equal(state.memories.length, 2);
  for (const plan of replies.slice(2)) assert.equal(plan.act, 'recall');
  assert.equal(replies[2].interpretation.preferencesOnly, true);
  assert.equal(replies[3].interpretation.nameOnly, true);
  assert.equal(replies.at(-1).interpretation.object.label, 'coffee');
});

test('unsafe, uncertain and partly unsupported lists stay atomic', () => {
  for (const message of [
    'I like coffee, maybe tea', 'I like coffee, or tea', 'I like coffee, not tea',
    'I like coffee,, tea', 'I like coffee, I might like tea',
    'I like coffee and, tea', 'I like coffee, and, tea',
    'I like coffee, I am an astronaut',
    'I like coffee, Alex loves tea', 'I like coffee, tell me a joke',
    'Maybe I am fond of tea', 'If I were fond of tea, I would say so',
    'Alex said "I am fond of tea"', 'I like coffee, tea, jazz, hiking, pizza',
    'Jamie said tea is something I enjoy', 'According to Alex tea is something I enjoy',
  ]) {
    const {state} = conversation([message]);
    assert.equal(state.memories.length, 0, message);
  }
});

test('compound reports exceeding the grammar budget are rejected before committing', () => {
  const messages = [
    Array.from({length:13}, (_, i) => 'I like object '+i).join(', '),
    ['I like a, b, c, d', 'I like e, f, g, h', 'I like j, k, l, m', 'I like n'].join('. '),
  ];
  for (const message of messages) {
    const {state, replies} = conversation([message]);
    assert.equal(state.memories.length, 0, message);
    assert.equal(replies[0].act, 'clarify');
  }
});

test('salutations, corrections and repeated objects retain their own raw span positions', () => {
  for (const message of [
    'Hi Kira, I am fond of Café music',
    'Actually, I like coffee, tea, and jazz',
    'I like coffee, I love coffee',
    'Hello! I like Straße music. I enjoy tea.',
  ]) {
    const {state} = conversation([message]);
    for (const memory of active(state)) assert.equal(message.slice(memory.span.start, memory.span.end), memory.object.label, message);
  }
  const raw = 'I like coffee, I love coffee';
  const frames = parse(raw).frames;
  assert.notEqual(frames[0].span.start, frames[1].span.start);
});

test('ambiguous list spans survive greeting adaptation and deferred resolution', () => {
  const message = 'Hello Kira, I like bass, tea, and jazz';
  const unresolved = parse(message);
  assert.ok(unresolved.ambiguity);
  for (const frame of unresolved.candidateFrames) assert.equal(message.slice(frame.span.start, frame.span.end), frame.object.label);
  const {state} = conversation([message, 'bass guitar']);
  assert.equal(active(state).length, 3);
  for (const memory of active(state)) {
    assert.equal(memory.sourceMessage, 'user:1');
    assert.equal(message.slice(memory.span.start, memory.span.end), memory.object.label);
  }
});

test('paraphrased reasons stay quoted discourse rather than newly asserted facts', () => {
  const message = "I'm fond of tea because it helps me relax";
  const {state, replies} = conversation([message]);
  assert.deepEqual(descriptions(state), ['You like tea']);
  assert.equal(replies[0].policy.discourse.text, 'it helps me relax');
  assert.equal(message.slice(state.memories[0].span.start, state.memories[0].span.end), 'tea');
});
