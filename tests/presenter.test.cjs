'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const {loadModel} = require('./helpers/load-model.cjs');
const {context} = loadModel();

// Use the adapters from the generated app, with the real dialogue model and
// controllable browser boundaries. Keep canonical objects inside its realm.
async function scenario(body) {
  const report = await vm.runInContext(`(async () => {
    const backing = new Map();
    let failSave = false, locked = false;
    const lockCalls = [];
    const storage = {
      getItem: key => backing.get(key) ?? null,
      setItem: (key, value) => { if (failSave) throw Error('Quota exceeded'); backing.set(key, value); },
      removeItem: key => backing.delete(key),
    };
    globalThis.navigator = {locks: {request: async (name, fn) => {
      lockCalls.push(name); locked = true;
      try { return await fn(); } finally { locked = false; }
    }}};
    const view = {
      renders: [], notices: [], busy: false,
      render(state) { this.renders.push(Kira.hash(state)); },
      status(message, kind) { this.notices.push({message, kind}); },
      error(message) { this.notices.push({message, kind: 'error'}); },
      setBusy(value) { this.busy = value; },
    };
    const bridge = {
      start: async () => 'inline',
      request: async (op, payload) => op === 'step'
        ? __dialogue.step(payload.state, payload.event)
        : __dialogue.replay(payload.events),
    };
    const store = new Kira.SessionStore(storage);
    const presenter = new Kira.Presenter(view, store, bridge);
    const capture = async fn => { try { await fn(); return 'ok'; } catch (e) { return e.message; } };
    const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
    const out = {};
    ${body}
    return JSON.stringify(out);
  })()`, context);
  return JSON.parse(report);
}

test('boot completes before an immediately queued turn changes the saved session', async () => {
  const out = await scenario(`
    const events = [{seq: 1, time: 1, type: 'message', text: 'I like coffee'}];
    backing.set(Kira.STORE_KEY, JSON.stringify(Kira.packSession(events, __dialogue.replay(events), Kira.APP_META)));
    const gate = deferred();
    bridge.start = () => gate.promise;
    const boot = presenter.boot();
    const message = presenter.message('My name is Alex');
    gate.resolve('inline');
    await Promise.all([boot, message]);
    out.events = presenter.events.map(e => e.text);
    out.matched = (await presenter.replay()).matched;
  `);
  assert.deepEqual(out.events, ['I like coffee', 'My name is Alex']);
  assert.equal(out.matched, true);
});

test('a failed save preserves committed state and the queue accepts a retry', async () => {
  const out = await scenario(`
    await presenter.boot();
    await presenter.message('I like coffee');
    const before = presenter.export(), raw = store.raw, renders = view.renders.length;
    failSave = true;
    out.error = await capture(() => presenter.message('I dislike coffee'));
    out.unchanged = presenter.export() === before && store.raw === raw && storage.getItem(Kira.STORE_KEY) === raw;
    out.notPublished = view.renders.length === renders;
    out.busy = view.busy;
    failSave = false;
    await presenter.message('I dislike coffee');
    out.events = presenter.events.length;
    out.matched = (await presenter.replay()).matched;
  `);
  assert.match(out.error, /Quota exceeded/);
  assert.equal(out.unchanged, true);
  assert.equal(out.notPublished, true);
  assert.equal(out.busy, false);
  assert.equal(out.events, 2);
  assert.equal(out.matched, true);
});

test('replay waits for pending turns and finishes before later turns begin', async () => {
  const out = await scenario(`
    await presenter.boot();
    const request = bridge.request;
    const gate = deferred(), started = deferred();
    bridge.request = async (op, payload) => {
      if (op === 'replay') { started.resolve(); await gate.promise; }
      return request(op, payload);
    };
    const first = presenter.message('I like coffee');
    const replay = presenter.replay();
    const second = presenter.message('My name is Alex');
    await started.promise;
    out.eventsDuringReplay = presenter.events.length;
    gate.resolve();
    out.replay = await replay;
    await Promise.all([first, second]);
    out.eventsAfter = presenter.events.length;
  `);
  assert.equal(out.eventsDuringReplay, 1);
  assert.equal(out.replay.matched, true);
  assert.equal(out.replay.events, 1);
  assert.equal(out.eventsAfter, 2);
});

test('import replay and all session writes hold the shared lock', async () => {
  const out = await scenario(`
    await presenter.boot();
    const set = storage.setItem, remove = storage.removeItem, request = bridge.request;
    const held = [];
    storage.setItem = (...args) => { held.push(locked); return set(...args); };
    storage.removeItem = (...args) => { held.push(locked); return remove(...args); };
    bridge.request = (op, payload) => { if (op === 'replay') held.push(locked); return request(op, payload); };
    await presenter.message('I like coffee');
    const envelope = JSON.parse(presenter.export());
    await presenter.reset();
    await presenter.importSession(envelope);
    out.held = held;
    out.locks = lockCalls;
    out.events = presenter.events.length;
    out.busy = view.busy;
  `);
  assert.deepEqual(out.held, [true, true, true, true]);
  assert.deepEqual(out.locks, Array(3).fill('kira-rse-session'));
  assert.equal(out.events, 1);
  assert.equal(out.busy, false);
});

test('imports with a false replay digest cannot replace the committed conversation', async () => {
  const out = await scenario(`
    await presenter.boot();
    await presenter.message('I like coffee');
    const before = presenter.export(), raw = store.raw;
    const invalid = Kira.packSession([], presenter.state, Kira.APP_META);
    out.error = await capture(() => presenter.importSession(invalid));
    out.unchanged = presenter.export() === before && store.raw === raw;
    out.busy = view.busy;
  `);
  assert.match(out.error, /does not replay/);
  assert.equal(out.unchanged, true);
  assert.equal(out.busy, false);
});

test('corrupt saves remain exportable and a reset unblocks the session', async () => {
  const out = await scenario(`
    backing.set(Kira.STORE_KEY, '{broken JSON');
    await presenter.boot();
    out.blocked = presenter.blocked;
    out.raw = store.rawExport();
    out.error = await capture(() => presenter.message('Hello'));
    await presenter.reset();
    await presenter.message('Hello');
    out.recovered = !presenter.blocked && (await presenter.replay()).matched;
  `);
  assert.equal(out.blocked, true);
  assert.equal(out.raw, '{broken JSON');
  assert.match(out.error, /saved-session error/);
  assert.equal(out.recovered, true);
});

test('temporary sessions keep their backup warning after import and reset without Web Locks', async () => {
  const out = await scenario(`
    delete globalThis.navigator;
    presenter.store = new Kira.SessionStore(null);
    await presenter.boot();
    await presenter.message('I like coffee');
    const envelope = JSON.parse(presenter.export());
    await presenter.reset();
    await presenter.importSession(envelope);
    out.notices = view.notices;
    out.matched = (await presenter.replay()).matched;
  `);
  assert.equal(out.notices.length, 4);
  assert.ok(out.notices.every(n => n.kind === 'warning' && /export before closing/.test(n.message)));
  assert.equal(out.matched, true);
});
