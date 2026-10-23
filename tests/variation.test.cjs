'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {loadModel} = require('./helpers/load-model.cjs');
const {K, dialogue} = loadModel();

const expand = (text, seed, persona = 'warm', usage = {}) => K.expandVariants(text, {seed, usage, persona});

test('a slot chooses deterministically from its pool', () => {
  const a = expand('I ⟦like|love|enjoy⟧ it', 'seed-1');
  assert.equal(a, expand('I ⟦like|love|enjoy⟧ it', 'seed-1'));
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(expand('I ⟦like|love|enjoy⟧ it', 'seed-' + i));
  assert.equal(seen.size, 3, 'every alternative is reachable');
});

test('a slot never repeats its previous choice', () => {
  const usage = {};
  let previous = null;
  for (let i = 0; i < 60; i++) {
    const out = expand('⟦red|green|blue⟧', 'turn-' + i, 'warm', usage);
    assert.notEqual(out.toLowerCase(), previous);
    previous = out.toLowerCase();
  }
});

test('named pools follow the persona and fall back to the default', () => {
  const direct = new Set(), fallback = new Set();
  for (let i = 0; i < 60; i++) {
    direct.add(expand('⟦@ack⟧', 'd' + i, 'direct'));
    fallback.add(expand('⟦@ack⟧', 'f' + i, 'no-such-persona'));
  }
  assert.deepEqual([...direct].sort(), ['Got it', 'Noted', 'Okay', 'Understood']);
  assert.ok(fallback.has('Right') && fallback.has('I see'));
  assert.throws(() => expand('⟦@missing⟧', 's'), /Unknown variation pool/);
});

test('a slot that opens a sentence is capitalised, and mid-sentence slots are not', () => {
  assert.match(expand('⟦ok|fine⟧ then. ⟦yes|sure⟧.', 's'), /^(?:Ok|Fine) then\. (?:Yes|Sure)\.$/);
  assert.match(expand('I said ⟦ok|fine⟧', 's'), /^I said (?:ok|fine)$/);
});

test('users cannot inject slots, and conversations replay exactly with variation', () => {
  const events = ['I like ⟦cats|dogs⟧', 'I like coffee', 'I like tea', 'I like jazz'].map((text, i) => (
    {seq: i + 1, time: 1_735_689_600_000 + i, type: 'message', text}));
  let state = K.initialState();
  const texts = [];
  for (const event of events) {
    const result = dialogue.step(state, event);
    state = result.state;
    texts.push(result.plan.text);
  }
  assert.ok(texts.every(t => !/[⟦⟧]/.test(t)), 'no unexpanded markup in any reply');
  assert.equal(K.hash(dialogue.replay(events)), K.hash(state));
  assert.deepEqual(dialogue.replay(events).messages.map(m => m.text), state.messages.map(m => m.text));
});

test('every slot in the shipped templates expands cleanly for every persona', () => {
  for (const persona of Object.keys(K.DIALOGUE.personas)) {
    for (const pool of Object.values(K.DIALOGUE.pools)) {
      for (const choice of pool[persona] || pool.default) assert.doesNotMatch(choice, /[.!?|⟦⟧]/, 'pool entries are plain phrases');
    }
  }
});
