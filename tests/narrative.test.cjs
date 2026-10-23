'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const {spawnSync} = require('node:child_process');
const os = require('node:os');
const K = require('../KiraSDK.js');
const {loadModel} = require('./helpers/load-model.cjs');
const source = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/station.json'), 'utf8'));
const engine = new K.SemanticEngine(K.ARTIFACT);
function game(definition = source()) {
  const model = new K.Narrative.WorldModel(K.Narrative.compile(definition), engine);
  let state = model.initialState();
  const events = [];
  return {
    model, events,
    get state() { return state; },
    step(data) {
      const event = {seq:events.length + 1, time:events.length, ...data};
      const result = model.step(state, event);
      state = result.state; events.push(event);
      return result.reply;
    },
    say(actor, text, speaker = 'traveller') { return this.step({type:'message', actor, speaker, text}); },
    world(fact, value, witnesses) { return this.step({type:'world', fact, value, witnesses}); },
  };
}

test('SDK contains the exact companion model and does not pollute Node globals', () => {
  assert.equal(globalThis.Kira, undefined);
  assert.deepEqual(K.APP_META, loadModel().run('Kira.APP_META'));
  const code = fs.readFileSync(path.join(__dirname, '../KiraSDK.js'), 'utf8');
  const context = vm.createContext({TextEncoder});
  vm.runInContext(code, context);
  assert.equal(context.Kira.Narrative.version, '0.3.0');
  assert.equal(context.Kira.APP_META.modelHash, K.APP_META.modelHash);
});

test('compiler is stable across declaration ordering and rejects tampering', () => {
  const a = source(), b = source();
  b.characters.reverse(); b.topics.reverse(); b.facts.reverse();
  for (const c of b.characters) c.rules.reverse();
  const compiled = K.Narrative.compile(a);
  assert.equal(compiled.hash, K.Narrative.compile(b).hash);
  assert.deepEqual(K.Narrative.verify(compiled), compiled);
  assert(Object.isFrozen(compiled.definition.characters[0].rules));
  const altered = structuredClone(compiled);
  altered.definition.facts[0].text = 'A changed fact.';
  assert.throws(() => new K.Narrative.WorldModel(altered, engine), /does not match/);
});

test('compiler rejects unsafe identities, dangling references and ungrounded slots', () => {
  const bad = [
    s => { s.characters[0].id = 'constructor'; },
    s => { s.characters[1].id = s.characters[0].id; },
    s => { s.speakers[0].id = s.characters[0].id; },
    s => { s.topics[1].aliases.push('RED LAMP'); },
    s => { s.characters[0].rules[0].on.topic = 'missing'; },
    s => { s.characters[0].knowledge = [{fact:'missing', value:true}]; },
    s => { s.characters[0].rules[0].parts = ['{fact:signal_red}']; },
    s => { s.characters[0].rules[0].parts = ['{memory}']; },
    s => { s.characters[0].rules[0].parts = ['{typo}']; },
    s => { s.characters[0].rules[0].parts = ['{broken']; },
    s => { s.characters[0].rules[0].goal = 'missing'; },
    s => { s.characters[0].rules[0].minRelationship = -1; },
    s => { s.characters[0].rules[0].requires = [{fact:'signal_red', value:true}, {fact:'signal_red', value:false}]; },
    s => { s.characters[0].unknown = 'typo'; },
  ];
  for (const mutate of bad) {
    const s = source(); mutate(s);
    assert.throws(() => K.Narrative.compile(s), /Narrative:/);
  }
});

test('one shared engine serves independent character identities and voices', () => {
  const a = game(), b = game();
  assert.equal(a.model.engine, b.model.engine);
  assert.match(a.say('keeper', 'Hello').text, /Mara/);
  assert.match(a.say('porter', 'Hello').text, /Ivo/);
  assert.equal(Object.keys(a.state.actors.keeper.sessions).length, 1);
  assert.equal(Object.keys(b.state.actors.keeper.sessions).length, 0);
});

test('private conversation memory is isolated by character AND by speaker', () => {
  const g = game();
  g.say('keeper', 'I like coffee');
  assert.equal(g.say('keeper', 'What do you remember about me?').rule, 'recall');
  assert.equal(g.say('porter', 'What do you remember about me?').rule, null);
  assert.equal(g.say('keeper', 'What do you remember about me?', 'porter').rule, null);
  assert.equal(g.state.actors.keeper.sessions.traveller.dialogue.memories.length, 1);
  assert.equal(g.state.actors.keeper.sessions.porter.dialogue.memories.length, 0);
});

test('supported free-text corrections and retirement survive character wording', () => {
  const g = game();
  g.say('keeper', 'I like coffee');
  const corrected = g.say('keeper', "I don't like it anymore");
  assert.match(corrected.text, /You do not like coffee/);
  const memories = g.state.actors.keeper.sessions.traveller.dialogue.memories;
  assert.equal(memories[0].status, 'superseded');
  const memory = memories.at(-1);
  g.step({type:'retire', actor:'keeper', speaker:'traveller', memoryId:memory.id});
  assert.equal(g.say('keeper', 'What do you remember about me?').rule, null);
  assert.equal(K.hash(g.model.replay(g.events)), K.hash(g.state));
});

test('word-sense clarification asks the question actually shown before committing', () => {
  const g = game();
  const reply = g.say('keeper', 'I like bass');
  assert.equal(reply.origin, 'parser_clarification');
  assert.match(reply.text, /which meaning/i);
  assert.equal(g.state.actors.keeper.sessions.traveller.dialogue.memories.length, 0);
  g.say('keeper', 'bass guitar');
  assert.equal(g.state.actors.keeper.sessions.traveller.dialogue.memories[0].object.concept, 'c:bass-instrument');
  // The authored greeting never asked the companion's name question.
  g.say('porter', 'Hello');
  assert.equal(g.state.actors.porter.sessions.traveller.dialogue.context.pending, null);
});

test('world truth reaches only named witnesses and never leaks into hidden replies', () => {
  const a = game(), b = game();
  a.world('signal_red', true, []);
  b.world('signal_red', false, []);
  assert.deepEqual(a.say('keeper', 'signal'), b.say('keeper', 'signal'));
  assert.equal(a.state.actors.keeper.beliefs.length, 0);
  a.world('signal_red', true, ['keeper']);
  assert.equal(a.say('keeper', 'signal').rule, 'signal_known');
  assert.equal(a.say('porter', 'signal').rule, 'signal_unknown');
});

test('reports can be mistaken without rewriting the authoritative world', () => {
  const g = game();
  g.world('signal_red', false, []);
  g.step({type:'claim', from:'traveller', to:['porter'], fact:'signal_red', value:true});
  const reply = g.say('porter', 'signal');
  assert.equal(g.state.world.signal_red.value, false);
  assert.equal(reply.rule, 'signal_known');
  assert.equal(reply.evidence[0].belief.kind, 'reported');
  assert.equal(reply.evidence[0].belief.source, 'traveller');
});

test('rumours retain attribution through relays, and unknown beliefs cannot be relayed', () => {
  const g = game();
  const previous = K.hash(g.state);
  assert.throws(() => g.step({type:'tell', from:'porter', to:['keeper'], fact:'signal_red'}), /no belief/);
  assert.equal(K.hash(g.state), previous);
  g.world('signal_red', true, ['keeper']);
  g.step({type:'tell', from:'keeper', to:['porter'], fact:'signal_red'});
  g.step({type:'tell', from:'porter', to:['keeper'], fact:'signal_red'});
  const evidence = g.say('keeper', 'signal').evidence[0].belief;
  assert.equal(evidence.kind, 'relayed');
  assert.equal(evidence.source, 'porter');
  assert.equal(evidence.chain.length, 2);
  assert.equal(evidence.chain[0].kind, 'witnessed');
  assert.equal(evidence.chain[0].actor, 'keeper');
});

test('contradictory accounts stay in history while the latest belief drives dialogue', () => {
  const g = game();
  g.world('signal_red', true, ['keeper']);
  g.world('signal_red', false, ['keeper']);
  assert.equal(g.say('keeper', 'signal').rule, 'signal_clear');
  assert.deepEqual(g.state.actors.keeper.beliefs.map(b => b.value), [true, false]);
});

test('domain aliases have word boundaries and ambiguous topics request clarification', () => {
  const g = game();
  assert.deepEqual(g.model.topicsFor('Signalling is not a topic'), []);
  assert.deepEqual(g.model.topicsFor('What about the RED-LAMP?'), ['signal']);
  const reply = g.say('keeper', 'The signal and the train');
  assert.equal(reply.origin, 'topic_clarification');
  assert.equal(reply.rule, null);
  const resolved = g.step({type:'message', actor:'keeper', speaker:'traveller', text:'The signal and the train', topic:'signal'});
  assert.equal(resolved.rule, 'signal_unknown');
});

test('goals can initiate dialogue and complete only on character knowledge', () => {
  const g = game();
  assert.equal(g.model.activeGoals(g.state, 'keeper').length, 0);
  g.world('signal_red', true, ['keeper']);
  assert.equal(g.model.activeGoals(g.state, 'keeper')[0].id, 'clear_platform');
  const reply = g.step({type:'initiate', actor:'keeper', speaker:'traveller'});
  assert.equal(reply.goal, 'clear_platform');
  assert.equal(reply.rule, 'warn');
  g.world('train_arrived', true, []);
  assert.equal(g.model.activeGoals(g.state, 'keeper').length, 1);
  g.world('train_arrived', true, ['keeper']);
  assert.equal(g.model.activeGoals(g.state, 'keeper').length, 0);
  assert.equal(g.step({type:'initiate', actor:'keeper', speaker:'traveller'}).rule, null);
});

test('phrases compose deterministically, rotate, and replay exactly', () => {
  const g = game();
  g.world('signal_red', true, ['keeper']);
  const before = g.state;
  const first = g.say('keeper', 'signal'), second = g.say('keeper', 'signal');
  assert.notEqual(first.text, second.text);
  assert.deepEqual(first.phrases, [0, 0, 0]);
  assert.deepEqual(second.phrases, [1, 0, 1]);
  assert.equal(Object.keys(before.actors.keeper.sessions).length, 0, 'previous state must remain untouched');
  assert.equal(K.hash(g.model.replay(g.events)), K.hash(g.state));
});

test('invalid and oversized events are rejected atomically', () => {
  const g = game();
  g.say('keeper', 'Hello');
  const before = K.hash(g.state);
  const mutations = [
    {seq:99, time:1, type:'world', fact:'signal_red', value:true, witnesses:[]},
    {seq:2, time:-1, type:'message', actor:'keeper', speaker:'traveller', text:'Hello'},
    {seq:2, time:1, type:'message', actor:'missing', speaker:'traveller', text:'Hello'},
    {seq:2, time:1, type:'message', actor:'keeper', speaker:'keeper', text:'Hello'},
    {seq:2, time:1, type:'message', actor:'keeper', speaker:'traveller', text:'x'.repeat(2001)},
    {seq:2, time:1, type:'world', fact:'signal_red', value:true, witnesses:['keeper','keeper']},
    {seq:2, time:1, type:'world', fact:'signal_red', value:true, witnesses:['missing']},
    {seq:2, time:1, type:'world', fact:'missing', value:true, witnesses:[]},
    {seq:2, time:1, type:'message', actor:'keeper', speaker:'traveller', text:'Hello', fact:'signal_red'},
  ];
  for (const event of mutations) {
    assert.throws(() => g.model.step(g.state, event), /Narrative:/);
    assert.equal(K.hash(g.state), before);
  }
});

test('world exports validate checksum, replay digest and exact SDK/package pins', () => {
  const g = game();
  g.world('signal_red', true, ['keeper']); g.say('keeper', 'signal');
  const saved = g.model.export(g.events);
  assert.equal(K.hash(g.model.import(saved).state), K.hash(g.state));
  const broken = structuredClone(saved); broken.events[0].value = false;
  assert.throws(() => g.model.import(broken), /checksum/);
  const wrongDigest = structuredClone(saved); wrongDigest.stateDigest = 'wrong';
  const {checksum:_, ...payload} = wrongDigest; wrongDigest.checksum = K.hash(payload);
  assert.throws(() => g.model.import(wrongDigest), /replay digest/);
  const other = source(); other.version = '2.0.0';
  assert.throws(() => game(other).model.import(saved), /different SDK or narrative/);
  const foreign = structuredClone(saved); foreign.assets.sdkHash = 'another-runtime';
  const {checksum:__, ...foreignPayload} = foreign; foreign.checksum = K.hash(foreignPayload);
  assert.throws(() => g.model.import(foreign), /different SDK/);
});

test('command-line compiler emits the same package as the API', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kira-narrative-'));
  try {
    const output = path.join(dir, 'compiled.json');
    const result = spawnSync(process.execPath, ['tools/narrative.cjs', 'examples/station.json', output], {cwd:path.join(__dirname, '..'), encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), K.Narrative.compile(source()));
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
});

test('a recall question selects its subject rather than the newest unrelated memory', () => {
  const g = game();
  g.say('keeper', 'I like coffee'); g.say('keeper', 'I like tea');
  assert.match(g.say('keeper', 'Do I like coffee?').text, /coffee/);
  assert.doesNotMatch(g.say('keeper', 'Do I like coffee?').text, /tea/);
  assert.equal(g.say('keeper', 'Do I like jazz?').rule, null);
  assert.equal(g.say('keeper', 'What is my name?').rule, null);
});

test('rules distinguish a witnessed fact from the same reported proposition', () => {
  const g = game();
  g.step({type:'claim', from:'traveller', to:['keeper'], fact:'signal_red', value:false});
  assert.equal(g.say('keeper', 'signal').rule, 'signal_unknown');
  g.world('signal_red', false, ['keeper']);
  assert.equal(g.say('keeper', 'signal').rule, 'signal_clear');
  assert.equal(g.state.actors.keeper.beliefs.length, 2);
});

test('host relationship changes gate rules per partner and replay correctly', () => {
  const s = source();
  s.characters[0].rules.find(r => r.id === 'greeting').minRelationship = 5;
  const g = game(s);
  assert.equal(g.say('keeper', 'Hello').rule, null);
  g.step({type:'relationship', actor:'keeper', speaker:'traveller', delta:10});
  assert.equal(g.say('keeper', 'Hello').rule, 'greeting');
  assert.equal(g.say('keeper', 'Hello', 'porter').rule, null);
  g.step({type:'relationship', actor:'keeper', speaker:'traveller', delta:-100});
  assert.equal(g.state.actors.keeper.sessions.traveller.dialogue.relationship.points, 0);
  assert.equal(K.hash(g.model.replay(g.events)), K.hash(g.state));
});

test('compiler bounds expanded slot output, and malformed packages fail validation', () => {
  const s = source();
  s.facts[0].text = 'x'.repeat(2000);
  s.characters[0].rules[0].requires = [{fact:'signal_red', value:true}];
  s.characters[0].rules[0].parts = Array(9).fill('{fact:signal_red}');
  assert.throws(() => K.Narrative.compile(s), /expanded rule/);
  assert.throws(() => K.Narrative.verify({format:'kira-narrative-package/1', definition:null, hash:'fake'}), /plain object/);
});
