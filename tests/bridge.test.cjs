'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the shipped bridge with deterministic transport failures and clocks.
const html = fs.readFileSync(path.join(__dirname, '..', 'Kira.html'), 'utf8');
const browser = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const viewStart = browser.indexOf("  const $=id=>document.getElementById(id)");
const adapters = browser.slice(0, browser.lastIndexOf("'use strict';", viewStart));

function setup({constructorFails = false} = {}) {
  const timers = new Map(), workers = [], revoked = [];
  let timerId = 0;
  class Worker {
    constructor() {
      if (constructorFails) throw Error('Worker unavailable');
      this.messages = []; this.terminated = false; workers.push(this);
    }
    postMessage(message) { if (this.postFails) throw Error('Cannot clone message'); this.messages.push(message); }
    terminate() { this.terminated = true; }
    reply(index, value = 'ready') { this.onmessage({data: {id: this.messages[index].id, ok: true, value}}); }
  }
  const context = vm.createContext({
    Worker, Blob: class Blob {}, console: {warn() {}},
    URL: {createObjectURL: () => 'blob:model', revokeObjectURL: url => revoked.push(url)},
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, {fn, ms}); return id; },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(`
    const Kira = {
      SemanticEngine: class { constructor() { this.verification = 'verified'; } query() { return 'inline query'; } },
      DialogueModel: class { replay() { return 'inline replay'; } }
    };
    ${adapters}
    globalThis.bridge = new Kira.ModelBridge('source');
  `, context);
  return {bridge: context.bridge, workers, timers, revoked,
    expire(ms) { const entries = [...timers].filter(([, timer]) => timer.ms === ms); for (const [id, timer] of entries) { timers.delete(id); timer.fn(); } }};
}

async function start(setup) {
  const operation = setup.bridge.start(); setup.workers[0].reply(0);
  assert.equal(await operation, 'worker');
  assert.equal(setup.timers.size, 0);
  return setup.workers[0];
}

test('worker constructor failure revokes its URL and starts the inline bridge', async () => {
  const s = setup({constructorFails: true});
  assert.equal(await s.bridge.start(), 'inline');
  assert.deepEqual(s.revoked, ['blob:model']);
  assert.equal(s.timers.size, 0);
  assert.equal(await s.bridge.request('query', {query: {}}), 'inline query');
  await assert.rejects(s.bridge.request('unknown', {}), /Unknown worker command/);
});

test('startup timeout settles concurrent requests and releases all resources', async () => {
  const s = setup(), boot = s.bridge.start();
  const query = assert.rejects(s.bridge.request('query', {}), /timed out/);
  s.expire(4000);
  assert.equal(await boot, 'inline'); await query;
  assert.equal(s.bridge.pending.size, 0);
  assert.equal(s.timers.size, 0);
  assert.equal(s.workers[0].terminated, true);
  assert.deepEqual(s.revoked, ['blob:model']);
});

for (const failure of ['error', 'messageerror', 'timeout', 'postMessage', 'malformed response']) {
  test(`${failure} settles pending requests and lets later calls use the inline model`, async () => {
    const s = setup(), worker = await start(s);
    const first = assert.rejects(s.bridge.request('query', {}));
    if (failure === 'postMessage') worker.postFails = true;
    const second = assert.rejects(s.bridge.request('replay', {}));
    if (failure === 'error') worker.onerror({preventDefault() {}});
    else if (failure === 'messageerror') worker.onmessageerror();
    else if (failure === 'timeout') s.expire(30000);
    else if (failure === 'malformed response') worker.onmessage({data: null});
    await Promise.all([first, second]);
    assert.equal(s.timers.size, 0);
    assert.equal(s.bridge.pending.size, 0);
    assert.equal(worker.terminated, true);
    assert.equal(s.bridge.worker, null);
    assert.equal(await s.bridge.request('query', {}), 'inline query');
    assert.deepEqual(s.revoked, ['blob:model']);
  });
}

test('a model validation rejection does not discard a healthy worker', async () => {
  const s = setup(), worker = await start(s);
  const request = assert.rejects(s.bridge.request('query', {}), /Invalid query/);
  worker.onmessage({data: {id: worker.messages[1].id, ok: false, error: 'Invalid query'}});
  await request;
  assert.equal(worker.terminated, false);
  assert.equal(s.timers.size, 0);
  const next = s.bridge.request('query', {}); worker.reply(2, 'checked');
  assert.equal(await next, 'checked');
});
