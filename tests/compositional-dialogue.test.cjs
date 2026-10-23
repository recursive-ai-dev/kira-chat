'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {loadModel} = require('./helpers/load-model.cjs');
const {K, dialogue} = loadModel();

function conversation(steps, settings) {
  let state = K.initialState();
  const events = [];
  const replies = [];
  for (const step of [...(settings ? [{type:'settings', settings}] : []), ...steps]) {
    const event = {seq:events.length + 1, time:1_735_689_600_000 + events.length,
      ...(typeof step === 'string' ? {type:'message', text:step} : step)};
    const result = dialogue.step(state, event);
    state = result.state;
    events.push(event);
    if (result.plan) {
      replies.push(result.plan);
      for (const span of result.plan.realizations || []) {
        assert.equal(result.plan.text.slice(span.start, span.end), span.result.text,
          'the grammar evidence must describe exactly the displayed span');
        assert.ok(span.start >= 0 && span.end <= result.plan.text.length && span.start < span.end);
        K.Realization.verify(span.result, {memories:state.memories, messages:state.messages});
      }
      if (state.context.pending?.question) assert.ok(result.plan.text.includes(state.context.pending.question));
    }
  }
  assert.equal(K.hash(dialogue.replay(events)), K.hash(state), 'sentence plans and output must replay exactly');
  return {state, events, replies};
}

function generated(plan) {
  assert.ok(plan.realizations?.length, 'a supported memory reply must contain checked generation evidence');
  return plan.realizations.map(span => span.result.text).join(' ');
}

function active(state) { return state.memories.filter(memory => memory.status === 'active'); }

function proofMemoryIds(plan) {
  return [...new Set(plan.realizations.flatMap(span => span.result.memoryIds))];
}

test('new object combinations form one coordinated preference sentence', () => {
  const {state, replies} = conversation(['I like cloudberry jam and violet tea and copper kites']);
  const text = generated(replies[0]);
  assert.match(text, /You like cloudberry jam, violet tea, and copper kites\./);
  assert.doesNotMatch(text, /•/, 'coordination should build a sentence rather than a report list');
  assert.equal(active(state).length, 3);
  assert.equal(proofMemoryIds(replies[0]).length, 3, 'every conjunct must retain its own memory source');
});

test('coordination preserves different predicates, polarity and tense', () => {
  for (const [message, required] of [
    ['I like coffee and I love tea', [/like coffee/i, /love tea/i]],
    ['I like coffee and I do not like tea', [/like coffee/i, /(?:do not|don’t) like tea/i]],
    ['I used to like coffee and I like tea', [/used to like coffee/i, /(?:you )?like tea/i]],
    ['I like coffee. I enjoy tea. I dislike rain.', [/like coffee/i, /enjoy tea/i, /dislike rain/i]],
  ]) {
    const {state, replies} = conversation([message]);
    const text = generated(replies[0]);
    for (const expected of required) assert.match(text, expected, message);
    assert.equal(proofMemoryIds(replies[0]).length, active(state).length, message);
    assert.doesNotMatch(text, /like coffee and tea|love coffee and tea/i, 'mixed reports cannot acquire a shared predicate');
  }
});

test('repeated objects and repeated reports do not duplicate generated propositions', () => {
  const {state, replies} = conversation(['I like coffee and coffee', 'I like coffee', 'What do I like?']);
  assert.equal(active(state).length, 1);
  for (const plan of replies) {
    const text = plan.realizations.filter(span=>span.result.scope==='reported').map(span=>span.result.text).join(' ');
    assert.equal((text.match(/coffee/g) || []).length, 1, text);
    assert.equal(proofMemoryIds(plan).length, 1);
  }
});

test('generic recall handles exactly one stored report', () => {
  for (const query of ['What do I like?', 'What do you remember about me?']) {
    const {state, replies} = conversation(['I like violet tea', query]);
    assert.match(generated(replies.at(-1)), /You like violet tea\./);
    assert.deepEqual(proofMemoryIds(replies.at(-1)), [active(state)[0].id]);
  }
});

test('a correction across aliases preserves the current wording without throwing', () => {
  for (const [before, after, current] of [
    ['I like cats', 'I dislike cat', /You dislike cat\./],
    ['I like coffee', 'I dislike Coffee', /You dislike Coffee\./],
  ]) {
    const {state, replies} = conversation([before, after]);
    assert.equal(active(state).length, 1);
    assert.match(generated(replies.at(-1)), current);
    assert.equal(active(state)[0].sourceMessage, 'user:2');
  }
});

test('preference corrections contrast attributed reports and ground historical evidence', () => {
  const {state, replies} = conversation(['I like coffee', "I don't like it anymore"]);
  const text = generated(replies[1]);
  const before = state.memories[0], after = state.memories[1];
  assert.equal(before.status, 'superseded');
  assert.equal(after.status, 'active');
  assert.match(text, /(?:previously|earlier)/i);
  assert.match(text, /report|told|said/i, 'the old report must remain attributed');
  assert.match(text, /(?:not liking|do not like|don’t like)/i);
  assert.deepEqual(proofMemoryIds(replies[1]).sort(), [before.id, after.id].sort());
  assert.ok(replies[1].claims.every(claim => active(state).some(memory => memory.id === claim.memoryId)),
    'historical evidence must not masquerade as a current active claim');
  assert.notEqual(before.sourceMessage, after.sourceMessage);
});

test('repeating a corrected report does not regenerate superseded evidence', () => {
  const {state, replies} = conversation(['I like coffee', 'I dislike coffee', 'I dislike coffee']);
  const plan = replies.at(-1), text = generated(plan);
  assert.match(text, /You dislike coffee\./);
  assert.doesNotMatch(text, /previously|earlier|reported liking/i);
  assert.deepEqual(proofMemoryIds(plan), [active(state)[0].id]);
});

test('incompatible name and mood batches clarify before committing any reports', () => {
  for (const message of ['My name is Sam. My name is Jo.', 'I am sad and I am happy', 'I am sad. I am not sad.']) {
    const {state, replies} = conversation([message]);
    assert.equal(state.memories.length, 0, message);
    assert.equal(replies[0].act, 'clarify', message);
  }
  const distinct = conversation(['I was sad and I am happy']);
  assert.equal(active(distinct.state).length, 2, 'past and present feelings remain distinct reports');
  assert.match(generated(distinct.replies[0]), /felt sad/i);
  assert.match(generated(distinct.replies[0]), /feel happy/i);
});

test('recall combines active preferences and excludes superseded or forgotten reports', () => {
  const {state, replies} = conversation(['I like coffee', 'I like tea', 'I like jazz', 'I dislike coffee', 'Forget tea', 'What do I like?']);
  const plan = replies.at(-1), text = generated(plan);
  assert.match(text, /dislike coffee/i);
  assert.match(text, /like jazz/i);
  assert.doesNotMatch(text, /\blike coffee|\btea\b/i);
  assert.deepEqual(proofMemoryIds(plan).sort(), Array.from(active(state), memory => memory.id).sort());
});

test('past and negative mood recall is grammatical and preserves scope', () => {
  for (const [message, expected] of [
    ['I am not sad', /You do not feel sad/],
    ['I was not anxious', /You did not feel anxious/],
    ['I was sad', /You felt sad/],
  ]) {
    const {state, replies} = conversation([message, 'What do you remember about me?']);
    assert.match(generated(replies.at(-1)), expected);
    assert.match(K.describeMemory(state.memories[0]), expected);
    assert.doesNotMatch(replies.at(-1).text, /feel not|felt not/);
  }
});

test('literal notes remain quotations rather than interpreted grammar', () => {
  const note = 'My friend said “I love my dog.” Why would I change that?';
  const {state, replies} = conversation(['Remember this: ' + note, 'What do you remember about me?']);
  assert.equal(state.memories[0].object.label, note);
  for (const plan of replies) {
    assert.ok(generated(plan).includes(note));
    assert.ok(plan.text.includes(note));
  }
});

test('clarification questions are generated without asserting unchosen meanings', () => {
  const ambiguous = conversation(['I like bass']);
  const meaning = generated(ambiguous.replies[0]);
  assert.match(meaning, /bass/);
  assert.match(meaning, /meaning/i);
  assert.equal(ambiguous.state.memories.length, 0);
  assert.equal(ambiguous.state.context.pending.kind, 'sense');
  for (const choice of ambiguous.state.context.pending.choices) assert.ok(meaning.includes(choice.label));
  const unknownName = conversation(["What's my name?"]);
  assert.match(generated(unknownName.replies[0]), /\?$/);
  assert.equal(unknownName.state.context.pending.kind, 'name');
  assert.equal(unknownName.state.memories.length, 0);
});

test('a generated name recall preserves the confirmed name and source', () => {
  const {state, replies} = conversation(['My name is Élodie', "What's my name?"]);
  assert.match(generated(replies.at(-1)), /Your name is Élodie/);
  assert.deepEqual(proofMemoryIds(replies.at(-1)), [active(state)[0].id]);
});

test('generated spans reject changed wording and ungrounded semantic leaves', () => {
  const {state, replies} = conversation(['I like coffee and tea']);
  const plan = replies[0];
  generated(plan);
  const wording = K.clone(plan);
  wording.text = wording.text.replace('like coffee', 'hate coffee');
  assert.throws(() => dialogue.verifyPlan(state, wording), /realiz|generat|span|text|deriv|match/i);
  const wrongSource = K.clone(plan);
  function alter(node) {
    if (node?.type === 'clause') { node.sourceMessage = 'user:999'; return true; }
    for (const value of Object.values(node || {})) {
      if (Array.isArray(value)) { for (const child of value) if (typeof child === 'object' && alter(child)) return true; }
      else if (value && typeof value === 'object' && alter(value)) return true;
    }
    return false;
  }
  assert.ok(alter(wrongSource.realizations[0].result.tree), 'fixture must contain grounded clauses');
  assert.throws(() => dialogue.verifyPlan(state, wrongSource), /source|ground|realiz|generat|digest|deriv/i);
});

test('generation remains deterministic across personas, registers and Unicode labels', () => {
  for (const persona of ['warm', 'playful', 'thoughtful', 'direct']) {
    for (const register of [-2000, 0, 2000]) {
      const {replies} = conversation(['I like café music and crème brûlée', 'What do I like?', 'Stop asking me questions', 'I love violet tea'], {persona, register});
      assert.match(generated(replies[0]), /café music/);
      assert.match(generated(replies[0]), /crème brûlée/);
      assert.doesNotMatch(replies.at(-1).text, /\?/);
      generated(replies.at(-1));
    }
  }
});
