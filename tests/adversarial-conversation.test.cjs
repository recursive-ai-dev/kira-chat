'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {loadModel} = require('./helpers/load-model.cjs');
const {K, dialogue} = loadModel();

function conversation(messages) {
  let state = K.initialState();
  const events = [];
  const replies = [];
  for (const text of messages) {
    const event = {type: 'message', text, seq: events.length + 1, time: 1_735_689_600_000 + events.length};
    const result = dialogue.step(state, event);
    state = result.state;
    events.push(event);
    replies.push(result.plan);
  }
  assert.equal(K.hash(dialogue.replay(events)), K.hash(state), 'controls must replay exactly');
  return {state, replies};
}

test('refusing a follow-up ends the question without consuming the refusal as an answer', () => {
  for (const refusal of ['no thanks', "I don't want to talk about it", 'I do not want to discuss that', "I'd rather not", 'not now']) {
    const {state, replies} = conversation(['I am sad', refusal]);
    const reply = replies.at(-1);
    assert.equal(reply.interpretation.control, 'decline', refusal);
    assert.equal(state.context.pending, null, refusal);
    assert.doesNotMatch(reply.text, /\?|holding up|hardest part|that makes sense/i, refusal);
    assert.equal(state.memories.length, 1, 'a refusal is not a memory');
  }
});

test('requests to change subject escape the current topic ladder', () => {
  for (const request of ['change the subject', "Let's talk about something else", 'Can we change the topic?', 'Please switch topics']) {
    const {state, replies} = conversation(['I like coffee', request]);
    const reply = replies.at(-1);
    assert.equal(reply.interpretation.control, 'change_subject', request);
    assert.notEqual(state.context.pending?.topic, 'coffee', request);
    assert.doesNotMatch(reply.text, /usual way of making|coffee|clearer picture|fills in the picture/i, request);
  }
});

test('requests to stop asking questions are acknowledged without another question', () => {
  for (const request of ['Stop asking me questions', 'No more questions please', "Please don't ask any more questions", 'stop asking questions']) {
    const {state, replies} = conversation(['I love music', request]);
    const reply = replies.at(-1);
    assert.equal(reply.interpretation.control, 'stop_questions', request);
    assert.equal(state.context.pending, null, request);
    assert.doesNotMatch(reply.text, /\?|clearer picture|fills in the picture/i, request);
  }
});

test('misunderstanding and repeated-question feedback reaches repair before pending answers', () => {
  for (const feedback of ["I don't understand", 'I don’t understand', 'you already asked that', 'that is not what I said', 'please rephrase that', 'these replies are generic', "Kira, you're not listening", "Your question doesn't make sense", 'not listening', "doesn't work"]) {
    const {replies} = conversation(['I like coffee', feedback]);
    const reply = replies.at(-1);
    assert.equal(reply.interpretation.repair, true, feedback);
    assert.equal(reply.interpretation.followUp, undefined, feedback);
    assert.doesNotMatch(reply.text, /usual way of making|clearer picture|fills in the picture/i, feedback);
  }
});

test('technical details that resemble feedback remain answers to the coding question', () => {
  for (const answer of ['I am building a template renderer', 'My code does not work', 'I do not understand recursion', 'I am using generic types', 'The robot does not work']) {
    const {replies} = conversation(['I like coding', answer]);
    const reply = replies.at(-1);
    assert.equal(reply.interpretation.repair, undefined, answer);
    assert.equal(reply.act, 'topic', answer);
    assert.ok(reply.interpretation.followUp, answer);
    assert.equal(reply.policy.discourse.text, answer, answer);
    assert.doesNotMatch(reply.text, /lost the thread/i, answer);
  }
});

test('pausing questions persists across later reports and can be explicitly resumed', () => {
  const {state, replies} = conversation(['I like coffee', 'Stop asking me questions', 'I like tea', 'Please ask me a question']);
  assert.doesNotMatch(replies[2].text, /\?/);
  assert.match(replies[2].text, /You like tea/);
  assert.equal(replies[3].interpretation.control, 'resume_questions');
  assert.match(replies[3].text, /\?$/);
  assert.ok(state.context.pending);
  assert.equal(state.context.questionsPaused, false);
});

test('an instrument mentioned by a listener does not establish that they play it', () => {
  for (const answer of ['guitar', 'I listen to guitar, I never play']) {
    const {replies} = conversation(['I like music', answer]);
    assert.match(replies.at(-1).text, /guitar\?|play music.*listen to music.*both\?/);
    assert.equal(replies.at(-1).policy.questionOrigin, 'compositional');
    assert.doesNotMatch(replies.at(-1).text, /How long have you been playing/);
  }
});

test('quoted and conditional conversation controls stay outside instruction handling', () => {
  for (const text of ['Alex said "stop asking questions"', 'If I said change the subject, would you understand?', 'Remember this: "no more questions"', 'I like music because it calms me']) {
    const {replies} = conversation(['I like coffee', text]);
    assert.equal(replies.at(-1).interpretation.control, undefined, text);
  }
});

test('a short place, reason, or time fragment is not spliced into a noun-phrase question', () => {
  for (const phrase of ['at home', 'for the taste', 'every morning', 'with friends', 'because it helps', 'all the time', 'usually', 'not really']) {
    assert.equal(K.focusPhrase(phrase), null, phrase);
  }
  assert.equal(K.focusPhrase('Making games mostly'), 'games');
  assert.equal(K.focusPhrase('Pixel platformers'), 'pixel platformers');
  assert.equal(K.focusPhrase('Godot'), 'Godot');
});
