'use strict';

// Tests for the persistence adapter and the event-log guarantees that make
// replay possible: version pinning, checksum validation, and conflict refusal.
//
// Each test pushes one scenario through scenario(), which runs entirely inside
// the model realm and returns a JSON report. Model objects must never cross into
// this file: canonical()/hash() only accept objects whose prototype is the
// context's Object.prototype (see the realm note in the loader).

const assert = require('node:assert/strict');
const test = require('node:test');

const {loadModel} = require('./helpers/load-model.cjs');
const {K, run} = loadModel();

// Replays `lines` into a state and event log, then evaluates `body` with those
// in scope. `capture` records a success or a thrown reason without failing.
const scenario = (lines, body) =>
  run(`(() => {
    const lines = ${JSON.stringify(lines)};
    let state = Kira.initialState();
    const events = [];
    for (const text of lines) {
      const event = {seq: events.length + 1, time: 1735689600000 + events.length, type: 'message', text};
      state = __dialogue.step(state, event).state;
      events.push(event);
    }
    const capture = fn => { try { return 'ok:' + JSON.stringify(fn()); } catch (error) { return 'threw:' + error.message; } };
    const out = {};
    ${body}
    return out;
  })()`);

test('a packed session round-trips through its own envelope', () => {
  const out = scenario(['My name is Alex', 'I like coffee'], `
    const envelope = Kira.packSession(events, state, Kira.APP_META);
    out.format = envelope.format;
    out.inspect = capture(() => Kira.inspectEnvelope(envelope, Kira.APP_META) && 'accepted');
    out.replaysToSameDigest = Kira.hash(__dialogue.replay(envelope.events)) === envelope.stateDigest;
    out.events = envelope.events.length;
  `);
  assert.equal(out.format, 'kira-session/4.1');
  assert.equal(out.inspect, 'ok:"accepted"');
  assert.equal(out.replaysToSameDigest, true, 'replaying the log must reproduce the saved digest');
  assert.equal(out.events, 2);
});

test('an envelope with a broken checksum is refused', () => {
  const out = scenario(['I like coffee'], `
    const envelope = Kira.packSession(events, state, Kira.APP_META);
    const tampered = {...envelope, events: [...events, {seq: 9, time: 1, type: 'message', text: 'injected'}]};
    out.tampered = capture(() => Kira.inspectEnvelope(tampered, Kira.APP_META));
    out.alteredDigest = capture(() => Kira.inspectEnvelope({...envelope, stateDigest: '0'.repeat(64)}, Kira.APP_META));
  `);
  assert.match(out.tampered, /threw:.*checksum mismatch/);
  assert.match(out.alteredDigest, /threw:.*checksum mismatch/);
});

test('an envelope from a different release is refused', () => {
  const out = scenario(['I like coffee'], `
    const other = {...Kira.APP_META, version: '9.9.9', modelHash: 'other'};
    const envelope = Kira.packSession(events, state, other);
    out.mismatched = capture(() => Kira.inspectEnvelope(envelope, Kira.APP_META));
    out.wrongFormat = capture(() => Kira.inspectEnvelope({format: 'kira-session/0.1'}, Kira.APP_META));
    out.nullish = capture(() => Kira.inspectEnvelope(null, Kira.APP_META));
  `);
  assert.match(out.mismatched, /threw:.*different version of Kira/);
  assert.match(out.wrongFormat, /threw:.*Unsupported save format/);
  assert.match(out.nullish, /threw:.*Unsupported save format/);
});

test('the store refuses to overwrite a conversation another tab changed', () => {
  const out = scenario(['I like coffee'], `
    const backing = new Map();
    const storage = {
      getItem: k => (backing.has(k) ? backing.get(k) : null),
      setItem: (k, v) => backing.set(k, v),
      removeItem: k => backing.delete(k),
    };
    const store = new Kira.SessionStore(storage);
    const fresh = Kira.packSession(events, state, Kira.APP_META);
    out.temporary = store.temporary;

    store.read();
    store.commit(fresh);
    out.soloCommit = capture(() => { store.commit(fresh); return 'committed'; });

    // Another tab writes after this handle read the key.
    store.read();
    const more = events.concat([{seq: events.length + 1, time: 2, type: 'message', text: 'from the other tab'}]);
    backing.set(Kira.STORE_KEY, JSON.stringify(Kira.packSession(more, __dialogue.replay(more), Kira.APP_META)));
    out.conflictedCommit = capture(() => { store.commit(fresh); return 'committed'; });
    out.conflictedClear = capture(() => { store.clear(); return 'cleared'; });
    out.stillPresent = backing.has(Kira.STORE_KEY);
  `);
  assert.equal(out.temporary, false);
  assert.equal(out.soloCommit, 'ok:"committed"');
  assert.match(out.conflictedCommit, /threw:.*Another tab changed this conversation/);
  assert.match(out.conflictedClear, /threw:.*Another tab changed this conversation/);
  assert.equal(out.stillPresent, true, "a refused clear must not delete the other tab's save");
});

test('a store without storage degrades to a temporary session', () => {
  const out = scenario(['I like coffee'], `
    const store = new Kira.SessionStore(null);
    out.temporary = store.temporary;
    out.read = store.read();
    out.commit = capture(() => { store.commit(Kira.packSession(events, state, Kira.APP_META)); return 'committed'; });
    out.exportLength = store.rawExport().length;
  `);
  assert.equal(out.temporary, true);
  assert.equal(out.read, null);
  assert.equal(out.commit, 'ok:"committed"');
  assert.ok(out.exportLength > 0, 'raw export must still work for recovery');
});

test('the event log is bounded and sequence-checked', () => {

  const state = K.initialState();
  assert.equal(K.MAX_EVENTS, 1000);
  assert.throws(() => K.validateEvent(state, {seq: 2, time: 1, type: 'message', text: 'x'}), /Event sequence/);
  assert.throws(() => K.validateEvent(state, {seq: 1, time: 1, type: 'nope'}), /Unknown event type/);
  assert.throws(() => K.validateEvent(state, {seq: 1, time: 1, type: 'message', text: ''}), /1–2000 characters/);
  assert.throws(() => K.validateEvent(state, {seq: 1, time: 1, type: 'message', text: 'x'.repeat(2001)}), /1–2000 characters/);
  assert.throws(() => K.validateEvent(state, {seq: 1, time: -1, type: 'message', text: 'x'}), /timestamp/);
});

test('images are accepted only as bounded, well-formed data URLs', () => {

  const state = K.initialState();
  const png = 'data:image/png;base64,' + 'A'.repeat(64);
  assert.equal(K.supportedImage(png), true);
  assert.equal(K.supportedImage('data:image/png;base64,' + 'A'.repeat(450_000)), false, 'over the size limit');
  assert.equal(K.supportedImage('data:image/gif;base64,AAAA'), false, 'unsupported type');
  assert.equal(K.supportedImage('data:image/png;base64,!!!'), false, 'not base64');
  assert.equal(K.supportedImage('javascript:alert(1)'), false);
  assert.doesNotThrow(() => K.validateEvent(state, {seq: 1, time: 1, type: 'image', data: png}));
});

test('settings events only accept known keys and ranges', () => {

  const state = K.initialState();
  const ok = {persona: 'direct', register: 0, theme: 'dawn', boundary: 'flirty'};
  assert.doesNotThrow(() => K.validateEvent(state, {seq: 1, time: 1, type: 'settings', settings: ok}));
  assert.throws(() => K.validateEvent(state, {seq: 1, time: 1, type: 'settings', settings: {unknown: 1}}), /Unknown setting/);
  assert.throws(() => K.validateEvent(state, {seq: 1, time: 1, type: 'settings', settings: {persona: 'sarcastic'}}), /persona|Invalid/);
  assert.throws(() => K.validateEvent(state, {seq: 1, time: 1, type: 'settings', settings: {register: 9999}}), /register/);
  assert.throws(() => K.validateEvent(state, {seq: 1, time: 1, type: 'settings', settings: {theme: 'neon'}}), /theme/);
  assert.throws(() => K.validateEvent(state, {seq: 1, time: 1, type: 'settings', settings: {boundary: 'explicit'}}), /boundary/);
});
