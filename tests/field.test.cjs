'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {loadModel} = require('./helpers/load-model.cjs');
const {K, engine, dialogue} = loadModel();
const field = dialogue.field;

function talk(lines) {
  let state = K.initialState();
  const events = [];
  const plans = lines.map((text, i) => {
    const event = {seq: i + 1, time: 1_735_689_600_000 + i, type: 'message', text};
    events.push(event);
    const result = dialogue.step(state, event);
    state = result.state;
    return result.plan;
  });
  assert.equal(K.hash(dialogue.replay(events)), K.hash(state), 'the event log must replay exactly');
  return {plans, state};
}

test('rings overlap symmetrically and the layout is deterministic integer geometry', () => {
  const again = new K.RingField(engine);
  assert.deepEqual([...field.centre], [...again.centre]);
  for (const {x, y} of field.centre.values()) {
    assert.ok(Number.isInteger(x) && Number.isInteger(y) && Math.abs(x) <= 1000 && Math.abs(y) <= 1000);
  }
  for (const a of field.topics) {
    assert.equal(field.overlap(a, a), 1000);
    for (const b of field.topics) assert.equal(field.overlap(a, b), field.overlap(b, a));
  }
  assert.ok(field.topics.length >= 20);
});

test('related rings overlap through named bridges, unrelated rings barely at all', () => {
  assert.ok(field.overlap('coffee', 'home') > 40);
  assert.ok(field.shared('coffee', 'home').some(s => s.word === 'morning routine'));
  assert.ok(field.overlap('coffee', 'home') > field.overlap('coffee', 'philosophy'));
  assert.ok(field.shared('music', 'screen').map(s => s.word).includes('soundtrack'));
});

test('an ambiguous bridge word belongs to the ring the conversation is nearer to', () => {
  assert.deepEqual([...field.resolve('my teammates', {act: {sports: 400}})], ['sports']);
  assert.deepEqual([...field.resolve('my teammates', {act: {people: 400}})], ['people']);
});

test('a bridge goes through a concept outside the topic being discussed', () => {
  const ctx = field.advance(null, ['coffee'], 3);
  const move = field.nextMove({ctx, topic: 'coffee', step: 3, ladderLength: 3, answer: 'Sometimes with friends at a cafe', memories: [], turn: 3});
  assert.equal(move.kind, 'bridge');
  assert.notEqual(move.word, 'coffee');
  assert.ok((field.rings.get('coffee').get(move.word) || 0) < 1000, 'never one of the topic\'s own core words');
  // With questions left in the ladder and no bridge concept touched, the thread stays; once the ladder is spent it glides.
  const stays = field.nextMove({ctx, topic: 'coffee', step: 3, ladderLength: 10, answer: 'Coffee coffee coffee', memories: [], turn: 3});
  assert.equal(stays.kind, 'ladder');
  const spent = field.nextMove({ctx, topic: 'coffee', step: 3, ladderLength: 3, answer: 'Coffee coffee coffee', memories: [], turn: 3});
  assert.equal(spent.kind, 'bridge');
  assert.notEqual(spent.word, 'coffee');
});

test('a thread reminds the user of a remembered preference in an overlapping ring, once', () => {
  const {plans} = talk(['I like coffee', 'I like pizza', 'I make it from scratch', 'On weekends mostly', 'With my family', 'Mostly Italian', 'Usually on Sundays']);
  const reminders = plans.filter(p => p.policy.field?.kind === 'remind');
  assert.equal(reminders.length, 1, 'cooldown prevents repeats');
  assert.match(reminders[0].text, /you like coffee\. Does that connect with this at all\?/);
  assert.ok(reminders[0].claims.some(c => c.objectKey && c.predicate === 'like'), 'the reminder is grounded in a memory');
});

test('nothing is recalled about the topic that is being discussed right now', () => {
  const {plans} = talk(['I like coffee', 'Coffee in the morning is my ritual', 'I drink it black', 'With a little milk']);
  assert.ok(plans.every(p => p.policy.field?.kind !== 'remind'));
});

test('a landing near a recently discussed ring moves the thread there; an incidental word does not', () => {
  const dog = talk(['I like hiking', 'I like jazz', 'I go with my dog']).plans[2];
  assert.equal(dog.policy.topicSelection.topic, 'pets');
  const friends = talk(['I like soccer', 'Midfield mostly, I play with my friends on weekends']).plans[1];
  assert.equal(friends.policy.topicSelection.topic, 'sports');
});

test('a question is not asked twice in a topic, even after leaving and returning', () => {
  const {plans} = talk(['I like coffee', 'I like hiking', 'Coffee in the morning is my ritual', 'Mostly espresso']);
  const questions = plans.map(p => p.text.match(/([^.!?]*\?)\s*$/)?.[1].trim()).filter(Boolean);
  assert.equal(new Set(questions).size, questions.length, 'no repeated question');
});

test('every reply records an integer-only field trace', () => {
  const {plans} = talk(['I like soccer', 'I play on weekends', 'We lost last week']);
  for (const plan of plans) {
    const f = plan.policy.field;
    assert.ok(f && typeof f.kind === 'string');
    assert.ok(Number.isInteger(f.position.x) && Number.isInteger(f.position.y));
    assert.ok(f.active.every(([topic, a]) => typeof topic === 'string' && Number.isInteger(a)));
  }
});

test('wording phase drifts with the conversation position and stays inside [0, 1)', () => {
  const a = field.advance(null, ['music'], 1), b = field.advance(null, ['hiking'], 1);
  for (const ctx of [a, b]) for (let turn = 1; turn < 20; turn++) {
    const p = field.phase(ctx, turn);
    assert.ok(p >= 0 && p < 1);
  }
  assert.notEqual(field.phase(a, 1), field.phase(b, 1));
  assert.equal(field.phase(a, 5), field.phase(a, 5));
});
