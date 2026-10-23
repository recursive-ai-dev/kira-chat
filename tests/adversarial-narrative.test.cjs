'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const K = require('../KiraSDK.js');

const engine = new K.SemanticEngine(K.ARTIFACT);
const station = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/station.json'), 'utf8'));

function game(source) {
  const model = new K.Narrative.WorldModel(K.Narrative.compile(source), engine);
  let state = model.initialState();
  const events = [];
  return {
    model, events,
    get state() { return state; },
    step(input) {
      const event = {seq: events.length + 1, time: events.length, ...input};
      const result = model.step(state, event);
      state = result.state;
      events.push(event);
      return result.reply;
    },
    say(text) { return this.step({type:'message', actor:'keeper', speaker:'traveller', text}); },
  };
}

function phrases(sizes) {
  return {
    id:'phrase-probe', version:'1', speakers:[{id:'player', name:'Player'}], topics:[], facts:[],
    characters:[{
      id:'npc', name:'Guide', fallback:'Waiting.',
      rules:[{id:'speak', on:{intent:'initiate'}, parts:sizes.map((size, part) =>
        Array.from({length:size}, (_, alternative) => '[' + part + ':' + alternative + '] '))}],
    }],
  };
}

test('repeating an older preference responds to its grounded subject, polarity and tense', () => {
  const g = game(station());
  g.say('I like coffee');
  for (const distractor of ['I like tea', 'I do not like tea', 'I used to like tea']) {
    g.say(distractor);
    const reply = g.say('I like coffee');
    assert.match(reply.text, /You like coffee\./);
    assert.doesNotMatch(reply.text, /tea/);
    assert.equal(reply.evidence[0].memory, 'memory:00001');
    const plan = g.state.actors.keeper.sessions.traveller.dialogue.lastPlan;
    assert.equal(plan.claims[0].memoryId, reply.evidence[0].memory);
  }
  assert.equal(K.hash(g.model.replay(g.events)), K.hash(g.state));
});

test('a report rule cannot fill a different memory kind from an older disclosure', () => {
  const source = station();
  const keeper = source.characters.find(c => c.id === 'keeper');
  keeper.rules.push({id:'wrong_kind', priority:100, on:{intent:'preference'}, memoryKind:'mood', parts:['{report}']});
  const g = game(source);
  g.say('I feel sad');
  const reply = g.say('I like coffee');
  assert.equal(reply.rule, 'preference');
  assert.match(reply.text, /You like coffee\./);
  assert.doesNotMatch(reply.text, /sad/);
});

test('phrase parts reach every small combination before repeating and replay exactly', () => {
  for (const sizes of [[2, 2], [2, 3], [2, 2, 3], [1, 3, 2, 1]]) {
    const g = game(phrases(sizes));
    const count = sizes.reduce((product, size) => product * size, 1);
    const seen = new Set();
    let first;
    for (let i = 0; i < count; i++) {
      const reply = g.step({type:'initiate', actor:'npc', speaker:'player'});
      first ??= reply.text;
      assert(!seen.has(reply.text), 'repeated before exhausting combinations: ' + sizes);
      seen.add(reply.text);
      assert.equal(reply.text, reply.phrases.map((value, part) => '[' + part + ':' + value + '] ').join(''));
    }
    assert.equal(seen.size, count);
    assert.equal(g.step({type:'initiate', actor:'npc', speaker:'player'}).text, first);
    assert.equal(K.hash(g.model.replay(g.events)), K.hash(g.state));
  }
});

test('phrase composition handles huge products without enumerating them', () => {
  const g = game(phrases(Array(32).fill(32)));
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const reply = g.step({type:'initiate', actor:'npc', speaker:'player'});
    assert.equal(reply.phrases.length, 32);
    assert(reply.phrases.every(index => index >= 0 && index < 32));
    assert(!seen.has(reply.text), 'the first two 32-way parts must not stay synchronized');
    seen.add(reply.text);
  }
});

test('phrase rotation belongs to its character and rule across conversation partners', () => {
  const source = phrases([2, 2]);
  source.speakers.push({id:'other', name:'Other'});
  source.topics.push({id:'alternate', label:'Another subject', aliases:['alternate']});
  source.characters[0].rules.push({
    ...structuredClone(source.characters[0].rules[0]), id:'alternate', priority:1,
    on:{intent:'initiate', topic:'alternate'},
  });
  source.characters.push({...structuredClone(source.characters[0]), id:'second'});
  const g = game(source);
  const a = g.step({type:'initiate', actor:'npc', speaker:'player'});
  const b = g.step({type:'initiate', actor:'second', speaker:'player'});
  const separateRule = g.step({type:'initiate', actor:'npc', speaker:'player', topic:'alternate'});
  const c = g.step({type:'initiate', actor:'npc', speaker:'other'});
  assert.deepEqual(a.phrases, [0, 0]);
  assert.deepEqual(b.phrases, [0, 0]);
  assert.equal(separateRule.rule, 'alternate');
  assert.deepEqual(separateRule.phrases, [0, 0]);
  assert.deepEqual(c.phrases, [1, 1]);
});
