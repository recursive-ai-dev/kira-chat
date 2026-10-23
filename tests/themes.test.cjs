'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {loadModel} = require('./helpers/load-model.cjs');
const {K, dialogue} = loadModel();
const ROOT = path.join(__dirname, '..');
const COMPILER = path.join(ROOT, 'tools', 'build-themes.cjs');

function talk(lines) {
  let state = K.initialState();
  return lines.map((text, i) => {
    const result = dialogue.step(state, {seq: i + 1, time: 1_735_689_600_000 + i, type: 'message', text});
    state = result.state;
    return result.plan;
  });
}

function compile(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kira-themes-'));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  try {
    execFileSync('node', [COMPILER], {env: {...process.env, KIRA_THEMES_DIR: dir, KIRA_THEMES_OUT: path.join(dir, 'out.js')}, stdio: 'pipe'});
    return {ok: true, output: fs.readFileSync(path.join(dir, 'out.js'), 'utf8')};
  } catch (error) {
    return {ok: false, error: String(error.stderr)};
  }
}

test('the committed theme packs match themes/*.txt', () => {
  execFileSync('node', [COMPILER, '--check'], {stdio: 'pipe'});
});

test('a valid pack compiles with normalized words and ordered output', () => {
  const result = compile({'a.txt': 'topic: demo\nask: One? | Two?\ncue: /\\bfoo\\b/ => Foo?\nphrase: About {p}?\nwords:\n  group: Zebra, apple\n'});
  assert.ok(result.ok, result.error);
  assert.match(result.output, /"words":\["apple","zebra"\]/);
});

test('the pack compiler rejects malformed packs and cross-topic duplicates', () => {
  assert.match(compile({'a.txt': 'ask: no topic yet\n'}).error, /before "topic:"/);
  assert.match(compile({'a.txt': 'topic: demo\nphrase: no placeholder\n'}).error, /\{p\}/);
  assert.match(compile({'a.txt': 'topic: demo\ncue: /(/ => Bad?\n'}).error, /bad regex/);
  assert.match(compile({'a.txt': 'topic: demo\nwords:\n  x: Bad_Word\n'}).error, /invalid word/);
  assert.match(compile({'a.txt': 'topic: one\nwords:\n  x: shared\n---\ntopic: two\nwords:\n  x: shared\n'}).error, /both one and two/);
});

test('pack vocabulary steers topic, openers and answer cues', () => {
  const [first, second] = talk(['I have been reading Nietzsche', 'I think free will might be an illusion']);
  assert.equal(first.policy.topicSelection.topic, 'philosophy');
  assert.match(second.text, /responsibility, yours or anyone else/);
  const [history] = talk(['I love Roman history']);
  assert.match(history.text, /period, a person, or an event/);
});

test('a pack deepens an existing topic after the built-in questions', () => {
  const ladder = K.conversationQuestions.music;
  assert.ok(ladder.includes('What kind of music has your attention?'));
  assert.ok(ladder.indexOf('Do you read music, play by ear, or a bit of both?') > ladder.indexOf('What kind of music has your attention?'));
  const [, reply] = talk(['I like jazz', 'Coltrane mostly']);
  assert.match(reply.text, /written themes or the moments where they start to improvise/);
});

test('WordNet-derived cues cover words the curated lexicon lacks, and curated words win', () => {
  assert.equal(K.conversationTopic('lacrosse', null) === null, true, 'no engine: regex fallback only');
  const [soccer] = talk(['I like lacrosse']);
  assert.equal(soccer.policy.template === undefined, true);
  assert.match(soccer.text, /plays it, watches it, or both/);
  const [coffee] = talk(['I like espresso']);
  assert.match(coffee.text, /taste, the ritual/);
});
