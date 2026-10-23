'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {loadModel} = require('./helpers/load-model.cjs');
const {K, dialogue} = loadModel();

function conversation(messages, persona = 'warm', register = -1000) {
  let state = K.initialState();
  const events = [{seq: 1, time: 0, type: 'settings', settings: {persona, register}}];
  state = dialogue.step(state, events[0]).state;
  const replies = [];
  for (const text of messages) {
    const event = {seq: events.length + 1, time: events.length, type: 'message', text};
    const out = dialogue.step(state, event);
    state = out.state;
    replies.push(out.plan);
    events.push(event);
    const question = state.context.pending?.question;
    if (question) {
      assert.ok(out.plan.text.includes(question), 'pending question must match wording actually shown: ' + question);
      assert.doesNotMatch(question, /[⟦⟧]/);
    }
  }
  assert.equal(K.hash(dialogue.replay(events)), K.hash(state), 'replies and state replay exactly');
  return {state, replies};
}

for (const persona of ['warm', 'playful', 'thoughtful', 'direct']) {
  test('past feelings retain their tense in ' + persona + ' replies', () => {
    for (const [message, expected] of [['I was sad', 'felt sad'], ['I felt lonely', 'felt lonely'], ['I was not anxious', 'did not feel anxious']]) {
      const {replies, state} = conversation([message], persona);
      assert.ok(replies[0].text.includes(expected), replies[0].text);
      assert.doesNotMatch(replies[0].text, /you (?:feel|are|aren’t) (?:sad|lonely|anxious)/);
      assert.equal(state.memories[0].temporal, 'past');
    }
  });
}

test('possessives stay in the user perspective throughout an object phrase', () => {
  for (const [message, expected] of [
    ['I enjoy my time with my friends', 'You enjoy your time with your friends'],
    ['I love our dog', 'You love your dog'],
    ['I like my walks with our dog', 'You like your walks with your dog'],
  ]) {
    const {state, replies} = conversation([message, 'What do you remember about me?']);
    assert.ok(replies[0].text.includes(expected), replies[0].text);
    assert.ok(replies[1].text.includes(expected), replies[1].text);
    assert.equal(K.describeMemory(state.memories[0]), expected);
  }
});

test('attributed notes preserve original pronouns and punctuation', () => {
  for (const note of ['My friend said “I love my dog.”', 'I miss my friends and our dog', 'Where is my notebook?', 'I’m missing my friends']) {
    const {state, replies} = conversation(['Remember this: ' + note]);
    assert.equal(state.memories[0].object.label, note);
    assert.ok(replies[0].text.includes(note));
  }
});

test('literal notes can be forgotten using their original wording', () => {
  for (const note of ['my dog', 'I miss my friends', 'our dog', 'I’m missing my friends', 'Where is my notebook?', 'My friend said “I love my dog.”', 'Remember my dog.']) {
    const {state, replies} = conversation(['Remember this: ' + note, 'Forget ' + note]);
    assert.equal(state.memories[0].status, 'retired', note);
    assert.equal(replies.at(-1).policy.retired.length, 1);
  }
});

test('pausing follow-ups covers composed replies while retaining literal question marks', () => {
  for (const message of ['I like coffee. Tell me a joke.', 'I like coffee. How are you?', 'I like coffee. Who are you? How are you?', 'hello', 'I love you', 'I like coffee because it tastes good']) {
    const {replies, state} = conversation(['Stop asking me questions', message]);
    assert.doesNotMatch(replies.at(-1).text, /\?/, message);
    assert.equal(state.context.pending, null, message);
  }
  const {replies} = conversation(['Stop asking me questions', 'Remember this: Where is my notebook?']);
  assert.ok(replies.at(-1).text.includes('Where is my notebook?'));
  const reason = conversation(['Stop asking me questions', 'I like coffee because Is it the taste, the ritual, or the excuse to pause?']);
  assert.ok(reason.replies.at(-1).text.includes('“Is it the taste, the ritual, or the excuse to pause?”'));
  const sense = conversation(['Stop asking me questions', 'I like bass']);
  assert.equal(sense.state.context.pending.kind, 'sense');
  assert.match(sense.replies.at(-1).text, /which meaning/);
});

test('a compound check-in followed by a joke does not invent an unspoken question', () => {
  const {state, replies} = conversation(['How are you? Tell me a joke.']);
  assert.equal(state.context.pending, null);
  assert.ok(replies[0].policy.secondaryActs.includes('joke'));
});

test('comparative preferences never become malformed literal likes', () => {
  for (const message of ['I prefer tea to coffee', 'I prefer tea over coffee', 'I prefer tea rather than coffee']) {
    const {state, replies} = conversation([message]);
    assert.equal(state.memories.length, 0, message);
    assert.equal(replies[0].act, 'clarify');
    assert.match(replies[0].text, /compar|direct preference/i);
  }
  assert.equal(conversation(['I prefer tea']).state.memories[0].object.label, 'tea');
});

test('variant expansion respects sentence openings inside quotation marks', () => {
  for (const template of ['“⟦hello|hi⟧.”', 'A pause. “⟦hello|hi⟧.”', '\n(⟦hello|hi⟧.)']) {
    const output = K.expandVariants(template, {seed: 'test', usage: {}, persona: 'warm'});
    assert.match(output, /(?:Hello|Hi)/, output);
  }
  assert.match(K.expandVariants('I said “⟦hello|hi⟧”', {seed: 'test', usage: {}, persona: 'warm'}), /“(?:hello|hi)”/);
});

test('all generated follow-up questions store their rendered wording', () => {
  for (const persona of ['warm', 'playful', 'thoughtful', 'direct']) {
    for (const register of [-2000, 0, 2000]) {
      conversation(['I like coffee', 'espresso', 'black', 'every morning', 'at home', 'for the taste', 'warm', 'quiet', 'smooth', 'strong', 'simple', 'daily'], persona, register);
      conversation(['How are you?', 'I am fine', 'What can you do?', 'I like jazz', 'I listen to piano music', 'Tell me about coding', 'mostly compilers', 'the type checker', 'no thanks'], persona, register);
    }
  }
});
