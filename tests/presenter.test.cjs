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
    delete globalThis.matchMedia;
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

test('boot retries a failed worker transport once inline without blocking a valid save', async () => {
  const out = await scenario(`
    const events = [{seq: 1, time: 1, type: 'message', text: 'I like coffee'}];
    backing.set(Kira.STORE_KEY, JSON.stringify(Kira.packSession(events, __dialogue.replay(events), Kira.APP_META)));
    const request = bridge.request; let failed = false, calls = 0;
    bridge.start = async () => 'worker';
    bridge.request = async (op, payload) => {
      calls++;
      if (!failed) { failed = true; throw Object.assign(Error('Worker crashed'), {workerFailure: true}); }
      return request(op, payload);
    };
    await presenter.boot();
    out.blocked = presenter.blocked; out.calls = calls; out.mode = presenter.mode;
    out.events = presenter.events.length; out.matched = (await presenter.replay()).matched;
  `);
  assert.equal(out.blocked, false);
  assert.equal(out.calls, 2);
  assert.equal(out.mode, 'inline');
  assert.equal(out.events, 1);
  assert.equal(out.matched, true);
});

test('boot does not retry model rejections as transport failures', async () => {
  const out = await scenario(`
    const events = [{seq: 1, time: 1, type: 'message', text: 'I like coffee'}];
    backing.set(Kira.STORE_KEY, JSON.stringify(Kira.packSession(events, __dialogue.replay(events), Kira.APP_META)));
    let calls = 0;
    bridge.request = async () => { calls++; throw Error('Invalid saved event'); };
    await presenter.boot();
    out.blocked = presenter.blocked; out.calls = calls; out.raw = !!store.rawExport();
  `);
  assert.equal(out.blocked, true);
  assert.equal(out.calls, 1);
  assert.equal(out.raw, true);
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

test('queued settings and legacy inputs are owned snapshots', async () => {
  const out = await scenario(`
    await presenter.boot();
    const settings = {theme: 'dawn'}, messages = [{role: 'user', text: 'Original archive'}];
    const setting = presenter.settings(settings), legacy = presenter.legacy(messages);
    settings.theme = 'night'; messages[0].text = 'Changed archive'; messages.push({role: 'user', text: 'Injected'});
    await Promise.all([setting, legacy]);
    out.theme = presenter.state.settings.theme;
    out.messages = presenter.events[1].messages;
    out.matched = (await presenter.replay()).matched;
  `);
  assert.equal(out.theme, 'dawn');
  assert.deepEqual(out.messages, [{role: 'user', text: 'Original archive'}]);
  assert.equal(out.matched, true);
});

test('snapshotting rejects non-JSON values instead of silently discarding invalid fields', async () => {
  const out = await scenario(`
    await presenter.boot();
    out.error = await capture(() => presenter.settings({theme: 'dawn', unknown: undefined}));
    out.events = presenter.events.length;
    await presenter.message('Hello');
    out.matched = (await presenter.replay()).matched;
  `);
  assert.match(out.error, /canonical/);
  assert.equal(out.events, 0);
  assert.equal(out.matched, true);
});

test('mutation while a worker processes a turn cannot alter committed events', async () => {
  const out = await scenario(`
    await presenter.boot();
    const request = bridge.request, started = deferred(), gate = deferred();
    bridge.request = async (op, payload) => {
      const owned = Kira.clone(payload);
      if (op === 'step') { started.resolve(); await gate.promise; }
      return request(op, owned);
    };
    const settings = {theme: 'dawn'};
    const operation = presenter.settings(settings);
    await started.promise;
    settings.theme = 'night';
    gate.resolve(); await operation;
    out.theme = presenter.events[0].settings.theme;
    out.matched = (await presenter.replay()).matched;
  `);
  assert.equal(out.theme, 'dawn');
  assert.equal(out.matched, true);
});

test('imports own their event log during replay and after committing', async () => {
  const out = await scenario(`
    await presenter.boot(); await presenter.message('I like coffee');
    const envelope = JSON.parse(presenter.export());
    await presenter.reset();
    const request = bridge.request, started = deferred(), gate = deferred();
    bridge.request = async (op, payload) => {
      const owned = Kira.clone(payload);
      if (op === 'replay') { started.resolve(); await gate.promise; }
      return request(op, owned);
    };
    const importing = presenter.importSession(envelope);
    await started.promise;
    envelope.events[0].text = 'I dislike coffee';
    gate.resolve(); await importing;
    const before = presenter.export();
    envelope.events.length = 0;
    out.unchanged = before === presenter.export();
    out.text = presenter.events[0].text;
    out.matched = (await presenter.replay()).matched;
  `);
  assert.equal(out.unchanged, true);
  assert.equal(out.text, 'I like coffee');
  assert.equal(out.matched, true);
});

test('optional first-run theme save failure does not block a usable conversation', async () => {
  const out = await scenario(`
    globalThis.matchMedia = () => ({matches: true});
    failSave = true;
    await presenter.boot();
    out.blocked = presenter.blocked;
    out.eventsBefore = presenter.events.length;
    out.notice = view.notices.at(-1).message;
    failSave = false;
    await presenter.message('Hello');
    out.matched = (await presenter.replay()).matched;
    delete globalThis.matchMedia;
  `);
  assert.equal(out.blocked, false);
  assert.equal(out.eventsBefore, 0);
  assert.match(out.notice, /default theme could not be saved/);
  assert.equal(out.matched, true);
});

test('session exports use the same UTF-8 bound and compact bytes as persisted sessions', async () => {
  const out = await scenario(`
    await presenter.boot(); await presenter.message('Remember this: 漢字 and 🦊');
    const exported = presenter.export();
    out.exactBytes = exported === store.raw;
    out.withinLimit = Kira.sessionBytes(exported) < Kira.MAX_SESSION_BYTES;
    await presenter.reset(); await presenter.importSession(JSON.parse(exported));
    out.matched = (await presenter.replay()).matched;
  `);
  assert.equal(out.exactBytes, true);
  assert.equal(out.withinLimit, true);
  assert.equal(out.matched, true);
});
