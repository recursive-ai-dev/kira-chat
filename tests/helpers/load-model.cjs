'use strict';

// Shared loader for the Node test suite.
//
// The app ships as one generated HTML file, so tests read the model out of
// Kira.html rather than concatenating src/ by hand. That keeps the tests honest:
// they exercise exactly the bytes a user would open.
//
// REALM NOTE: the model runs inside a vm context, so objects built in this
// (host) file have a *different* Object.prototype than objects built inside the
// context. Kira.canonical() requires plain objects whose prototype is the
// context's Object.prototype, so query objects must be constructed in-context.
// Always pass queries as JSON and parse them inside the context (see `query`),
// otherwise they are rejected as "Query is not canonical JSON data". This is a
// test-harness constraint only; in a browser the whole app shares one realm.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function loadModel({withPersistence = true} = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'Kira.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?: id="worker-source" type="text\/plain")?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]);
  assert.equal(scripts.length, 3, 'expected page model, worker model, and browser scripts');
  assert.ok(scripts[1].startsWith(scripts[0]), 'worker must share the page model exactly');

  const context = vm.createContext({TextEncoder, console});
  vm.runInContext(scripts[0], context, {filename: 'Kira.html', timeout: 60_000});
  if (withPersistence) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'browser', 'persistence.js'), 'utf8'), context);
  }

  // One shared engine inside the context, so repeated queries stay cheap.
  // `__call` marshals a JSON string in and a JSON string out, so every object
  // the model sees is created in ITS realm (see the realm note above).
  vm.runInContext(`
    globalThis.__engine = new Kira.SemanticEngine(Kira.ARTIFACT);
    globalThis.__dialogue = new Kira.DialogueModel(__engine, Kira.APP_META);
    globalThis.__call = (method, payload) => {
      const result = method === 'query'
        ? __engine.query(JSON.parse(payload))
        : __engine.lexicon(JSON.parse(payload));
      return JSON.stringify(result);
    };
  `, context);

  // Marshal through JSON so no context-realm object ever reaches this file.
  const unwrap = json => JSON.parse(json);

  return {
    context,
    K: context.Kira,
    engine: context.__engine,
    dialogue: context.__dialogue,
    query(spec) {
      return unwrap(context.__call('query', JSON.stringify(spec)));
    },
    lexicon(spec) {
      return unwrap(context.__call('lexicon', JSON.stringify(spec)));
    },
    // Escape hatch for assertions that must execute in-context. The returned
    // value is JSON-normalized so deepEqual works against host literals.
    run(code) {
      return unwrap(vm.runInContext(`JSON.stringify((${code}))`, context, {timeout: 120_000}));
    },
  };
}

// A single shared load, reused across test files in the same process. Building a
// fresh SemanticEngine per call would re-verify the artifact every time.
let shared = null;
module.exports = {
  loadModel() {
    if (!shared) shared = loadModel();
    return shared;
  },
  ROOT,
};
