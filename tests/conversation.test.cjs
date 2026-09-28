'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'Kira.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?: id="worker-source" type="text\/plain")?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.equal(scripts.length, 3, 'expected page model, worker model, and browser scripts');
assert.ok(scripts[1].startsWith(scripts[0]), 'worker must share the page model exactly');

const context = vm.createContext({TextEncoder});
vm.runInContext(scripts[0], context, {filename: 'Kira.html', timeout: 30_000});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'browser', 'persistence.js'), 'utf8'), context);
const K = context.Kira;
const engine = new K.SemanticEngine(K.ARTIFACT);
const dialogue = new K.DialogueModel(engine, K.APP_META);

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
  assert.match(replies[0].text, /I haven’t saved this message’s reports yet/);
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
  assert.equal(K.STORE_KEY, 'kira_rse_4_1_3');
  const oldMetadata = K.clone({...K.APP_META, version: '4.1.2', modelHash: 'old-model-hash'});
  const envelope = K.packSession([], K.initialState(), oldMetadata);
  assert.throws(() => K.inspectEnvelope(envelope, K.APP_META), /different version of Kira/);
});
