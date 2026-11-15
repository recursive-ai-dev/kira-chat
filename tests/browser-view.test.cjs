'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'Kira.html'), 'utf8');
const browser = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const viewStart = browser.lastIndexOf("'use strict';", browser.indexOf("  const $=id=>document.getElementById(id)"));
const viewCode = browser.slice(viewStart, browser.indexOf('  let storage;', viewStart)) + '\n})(Kira);';

function setup() {
  const timers = new Map(), nodes = new Map(); let timerId = 0;
  const document = {title: 'Kira', activeElement: null};
  class Node {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.style = {}; this.listeners = {}; this.attributes = {}; this.value = ''; this.textContent = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    focus() { document.activeElement = this; }
    select() { this.focus(); }
    remove() { document.body.children = document.body.children.filter(node => node !== this); }
    showModal() { this.open = true; }
  }
  document.getElementById = id => { if (!nodes.has(id)) nodes.set(id, new Node('div')); return nodes.get(id); };
  document.createElement = tag => new Node(tag);
  document.body = new Node('body');
  document.execCommand = () => true;
  const context = vm.createContext({document, navigator: {},
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id)});
  vm.runInContext(`const Kira = {initialState: () => ({memories: []}), fold: text => text.toLowerCase()}; ${viewCode}; globalThis.view = new Kira.View(); globalThis.api = Kira;`, context);
  return {context, document, view: context.view, api: context.api, node: id => document.getElementById(id), flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); }};
}

test('old success timers cannot hide a new error or temporary-session warning', () => {
  const s = setup();
  s.view.ok('Exported'); s.view.error('Quota exceeded'); s.flush();
  assert.equal(s.node('notice').hidden, false);
  assert.equal(s.node('notice-text').textContent, 'Quota exceeded');
  s.view.ok('Exported'); s.view.status('Export before closing', 'warning'); s.flush();
  assert.equal(s.node('notice').hidden, false);
  assert.equal(s.node('notice').attributes.role, 'status');
});

test('image keyboard buttons activate with Space and Enter and prevent scrolling', () => {
  const s = setup();
  const article = s.view.messageNode({role: 'user', id: 'image', text: '', time: 1, image: 'data:image/png;base64,AAAA'});
  const image = article.children[1].children[0];
  for (const key of [' ', 'Enter']) {
    let prevented = false; s.node('image-dialog').open = false;
    image.listeners.keydown({key, preventDefault() { prevented = true; }});
    assert.equal(prevented, true);
    assert.equal(s.node('image-dialog').open, true);
  }
});

test('memory filter rebuilding retains keyboard focus on the selected control', () => {
  const s = setup(); s.view.renderMemories();
  const previous = s.node('memory-kind-chips').children[2]; previous.focus(); previous.listeners.click();
  assert.notEqual(s.document.activeElement, previous);
  assert.equal(s.document.activeElement.dataset.memoryKind, 'preference');
  assert.equal(s.document.activeElement.attributes['aria-pressed'], 'true');
});

test('clipboard fallback failures stay honest and restore focus', async () => {
  const s = setup(), button = s.node('copy'); button.textContent = 'Copy digest'; button.focus();
  s.document.execCommand = () => false;
  await s.view.copyText('digest', button);
  assert.equal(button.textContent, 'Copy digest');
  assert.match(s.node('notice-text').textContent, /Could not copy/);
  assert.equal(s.document.activeElement, button);
  assert.equal(s.document.body.children.length, 0);
});

test('clipboard success restores the original label and selection after fallback', async () => {
  const s = setup(), button = s.node('copy'), input = s.node('draft'); button.textContent = 'Copy digest';
  input.selectionStart = 2; input.selectionEnd = 4; input.selectionDirection = 'backward';
  let selected; input.setSelectionRange = (...args) => { selected = args; }; input.focus();
  s.context.navigator.clipboard = {writeText: async () => { throw Error('Denied'); }};
  await s.view.copyText('digest', button);
  assert.equal(button.textContent, 'Copied');
  assert.equal(s.document.activeElement, input);
  assert.deepEqual(selected, [2, 4, 'backward']);
  s.flush(); assert.equal(button.textContent, 'Copy digest');
});

test('Yesterday follows local calendar dates across both daylight-saving transitions', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/Moncton';
    const s = setup();
    for (const [now, yesterday] of [
      ['2026-03-09T12:00:00-03:00', '2026-03-08T12:00:00-03:00'],
      ['2026-11-02T12:00:00-04:00', '2026-11-01T12:00:00-04:00'],
      ['2027-01-01T12:00:00-04:00', '2026-12-31T12:00:00-04:00'],
    ]) {
      vm.runInContext(`Date.now = () => ${Date.parse(now)}`, s.context);
      assert.equal(s.api.dayName(Date.parse(yesterday)), 'Yesterday');
      assert.equal(s.api.timeLabel(Date.parse(yesterday)), 'Yesterday');
      assert.equal(s.api.dayName(Date.parse(now)), 'Today');
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('every shipped dialog has an accessible name', () => {
  const dialogs = [...html.matchAll(/<dialog\b([^>]*)>/g)];
  assert.equal(dialogs.length, 3);
  for (const [, attributes] of dialogs) {
    const label = attributes.match(/aria-labelledby="([^"]+)"/);
    if (label) assert.ok(html.includes(`id="${label[1]}"`));
    else assert.match(attributes, /aria-label="[^"]+"/);
  }
});

test('renderMessages resets lastCount when clearing an emptied conversation', () => {
  const s = setup();
  const box = s.node('messages');
  box.querySelector = () => null;
  box.scrollHeight = 200;
  box.scrollTop = 200;
  box.clientHeight = 200;
  s.document.createTextNode = text => ({textContent: text});
  s.context.requestAnimationFrame = fn => fn();
  s.view.state = {memories: [], messages: [
    {id: 'm1', role: 'user', text: 'I like coffee', time: 1},
    {id: 'm2', role: 'assistant', text: 'Saved.', time: 2},
  ]};
  s.view.renderMessages();
  assert.equal(s.view.lastCount, 2);

  s.view.state.messages = [];
  s.view.renderMessages();
  assert.equal(s.view.lastCount, 0);

  s.document.hidden = true;
  s.view.state.messages = [{id: 'm3', role: 'user', text: 'Hello again', time: 3}];
  s.view.renderMessages();
  assert.equal(s.view.lastCount, 1);
  assert.equal(s.document.title, 'New reply · Kira');
});
