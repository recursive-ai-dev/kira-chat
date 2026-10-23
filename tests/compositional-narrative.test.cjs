'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const K = require('../KiraSDK.js');

const engine = new K.SemanticEngine(K.ARTIFACT);
const station = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/station.json'), 'utf8'));

function game(source = station()) {
  const model = new K.Narrative.WorldModel(K.Narrative.compile(source), engine);
  let state = model.initialState();
  const events = [];
  return {
    model, events,
    get state() { return state; },
    step(input) {
      const event = {seq:events.length + 1, time:events.length, ...input};
      const result = model.step(state, event);
      state = result.state; events.push(event);
      return result.reply;
    },
    say(text, actor = 'keeper') { return this.step({type:'message', actor, speaker:'traveller', text}); },
  };
}

function verifySpans(reply, memories) {
  let end = 0;
  for (const span of reply.realizations) {
    assert(span.start >= end, 'realized clauses must not overlap');
    assert.equal(reply.text.slice(span.start, span.end), span.result.text);
    assert.doesNotThrow(() => K.Realization.verify(span.result, {memories}));
    end = span.end;
  }
  const {digest, ...payload} = reply;
  assert.equal(digest, K.hash(payload), 'the narrative digest binds grammar proofs');
}

test('authored report slots carry verified grammar fragments without duplicate punctuation', () => {
  const g = game();
  const reply = g.say('I like coffee');
  const session = g.state.actors.keeper.sessions.traveller.dialogue;
  assert.equal(reply.text, '“You like coffee. All right. I’ll keep that in mind.”');
  assert.equal(reply.origin, 'authored_rule');
  assert.equal(reply.realizations.length, 1);
  assert.equal(reply.realizations[0].result.text, 'You like coffee');
  assert.deepEqual(reply.realizations[0].result.memoryIds, ['memory:00001']);
  assert.deepEqual(session.lastPlan.realizations, reply.realizations);
  verifySpans(reply, session.memories);
  assert.doesNotThrow(() => g.model.dialogue.verifyPlan(session, session.lastPlan));
});

test('report spans track earlier slot substitutions, Unicode and repeated reports across parts', () => {
  const source = station();
  source.speakers[0].name = 'Zoë 🧭';
  const keeper = source.characters.find(c => c.id === 'keeper');
  keeper.name = 'Mára 🐈';
  keeper.rules.find(r => r.id === 'preference').parts = [
    '{character} greets {speaker}: “', ['{report}; ', '{report} / '], '{memory}. Again: {report}.”',
  ];
  const g = game(source);
  for (let i = 0; i < 2; i++) {
    const reply = g.say('I like coffee');
    const session = g.state.actors.keeper.sessions.traveller.dialogue;
    assert.match(reply.text, /^Mára 🐈 greets Zoë 🧭: “You like coffee/);
    assert.equal(reply.realizations.length, 2, 'raw memory labels have no grammar proof');
    verifySpans(reply, session.memories);
    assert.deepEqual(session.lastPlan.realizations, reply.realizations);
  }
  assert.equal(K.hash(g.model.replay(g.events)), K.hash(g.state));
});

test('fallbacks, literal authored rules and topic clarifications clear native grammar spans', () => {
  const fallback = game();
  assert.deepEqual(fallback.say('I like coffee', 'porter').realizations, []);
  assert.deepEqual(fallback.state.actors.porter.sessions.traveller.dialogue.lastPlan.realizations, []);

  const source = station();
  source.characters.find(c => c.id === 'keeper').rules.find(r => r.id === 'preference').parts = ['Mara listens.'];
  source.topics.push({id:'coffee', label:'Coffee', aliases:['coffee']}, {id:'tea', label:'Tea', aliases:['tea']});
  const g = game(source);
  const literal = g.say('I like coffee');
  assert.equal(literal.origin, 'authored_rule');
  assert.deepEqual(literal.realizations, []);
  assert.deepEqual(g.state.actors.keeper.sessions.traveller.dialogue.lastPlan.realizations, []);
  const clarify = g.say('I like coffee and tea');
  assert.equal(clarify.origin, 'topic_clarification');
  assert.deepEqual(clarify.realizations, []);
  assert.deepEqual(g.state.actors.keeper.sessions.traveller.dialogue.lastPlan.realizations, []);
});

test('parser clarifications preserve their displayed native question proof', () => {
  const g = game();
  const reply = g.say('I like bass');
  const session = g.state.actors.keeper.sessions.traveller.dialogue;
  assert.equal(reply.origin, 'parser_clarification');
  assert.equal(reply.realizations.length, 1);
  assert.equal(reply.realizations[0].result.tree.type, 'question');
  assert.match(reply.realizations[0].result.text, /which meaning/);
  assert.deepEqual(session.lastPlan.realizations, reply.realizations);
  assert.equal(session.memories.length, 0);
  verifySpans(reply, session.memories);
  g.say('bass guitar');
  assert.equal(g.state.actors.keeper.sessions.traveller.dialogue.memories[0].object.concept, 'c:bass-instrument');
});

test('initiated report clauses are grounded in their private session and replay with proofs', () => {
  const source = station();
  source.characters.find(c => c.id === 'keeper').rules.push({
    id:'memory_callback', on:{intent:'initiate'}, memoryKind:'preference', parts:['{speaker}, {report}.'],
  });
  const g = game(source);
  g.say('I like coffee');
  const reply = g.step({type:'initiate', actor:'keeper', speaker:'traveller'});
  assert.equal(reply.text, 'Traveller, You like coffee.');
  assert.equal(reply.realizations.length, 1);
  verifySpans(reply, g.state.actors.keeper.sessions.traveller.dialogue.memories);
  assert.equal(K.hash(g.model.replay(g.events)), K.hash(g.state));
  assert.deepEqual(g.model.import(g.model.export(g.events)).state, g.state);
  assert.equal(g.step({type:'initiate', actor:'keeper', speaker:'porter'}).rule, null);
});

test('copied native plans reject altered report proofs and misplaced spans', () => {
  const g = game();
  g.say('I like coffee');
  const session = g.state.actors.keeper.sessions.traveller.dialogue;
  const altered = structuredClone(session.lastPlan);
  altered.realizations[0].result.text = 'You hate coffee';
  assert.throws(() => g.model.dialogue.verifyPlan(session, altered));
  const misplaced = structuredClone(session.lastPlan);
  misplaced.realizations[0].start++;
  assert.throws(() => g.model.dialogue.verifyPlan(session, misplaced));
});
