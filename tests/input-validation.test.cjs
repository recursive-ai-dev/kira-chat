'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {K, dialogue} = require('./helpers/load-model.cjs').loadModel();

test('malformed events are rejected without changing the previous conversation', () => {
  const state = K.initialState();
  const before = K.hash(state);
  const base = {seq: 1, time: 1};
  const malformed = [
    {...base, type: 'message', text: 'hello', settings: {theme: 'dawn'}},
    {...base, type: 'legacy', messages: [null]},
    {...base, type: 'legacy', messages: [false]},
    {...base, type: 'legacy', messages: new Array(1)},
    {...base, type: 'legacy', messages: [{role: 'user', text: 5}]},
    Object.assign([], {...base, type: 'message', text: 'hello'}),
  ];
  for (const event of malformed) {
    assert.throws(() => dialogue.step(state, event), /Event|Invalid legacy/);
    assert.equal(K.hash(state), before);
  }
});

test('image payloads require canonical base64 lengths and padding bits', () => {
  const prefix = 'data:image/png;base64,';
  for (const value of ['AAAA', 'AA==', 'AAA=', 'AAAAAA==', 'AAAAAAAA']) {
    assert.equal(K.supportedImage(prefix + value), true, value);
  }
  for (const value of ['', 'A', 'AA', 'AAA', 'A===', 'AAAA=', 'AAAA==', 'AB==', 'AAB=', 'AA==AAAA', 'AAAA\n']) {
    assert.equal(K.supportedImage(prefix + value), false, value);
    assert.throws(() => dialogue.step(K.initialState(), {seq: 1, time: 1, type: 'image', data: prefix + value}), /Invalid or oversized image/);
  }
});
