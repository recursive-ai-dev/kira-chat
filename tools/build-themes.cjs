#!/usr/bin/env node
'use strict';
// Compiles authored theme packs (themes/*.txt) into src/model/theme-packs.js.
//
// A pack deepens an existing topic or defines a new one: its vocabulary decides which topic a word
// belongs to, and its openers, question ladder, answer cues and phrase questions shape the replies.
// Packs only choose conversation questions. They never create ontology claims or memories.
// Format: docs/themes.md.   Usage: node tools/build-themes.cjs [--check]

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// The environment overrides exist so tests can compile throwaway packs.
const THEMES = process.env.KIRA_THEMES_DIR || path.join(ROOT, 'themes');
const OUTPUT = process.env.KIRA_THEMES_OUT || path.join(ROOT, 'src', 'model', 'theme-packs.js');
const WORD = /^[a-z][a-z' -]{1,38}[a-z]$/;
const TOPIC = /^[a-z][a-z-]{1,24}$/;

function fail(file, line, message) {
  throw new Error(`${path.relative(ROOT, file)}:${line}: ${message}`);
}

function parseFile(file) {
  const topics = [];
  let current = null, inWords = false;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((raw, index) => {
    const n = index + 1, line = raw.trim();
    if (!line || line.startsWith('#')) return;
    if (line === '---') { current = null; inWords = false; return; }
    if (/^topic:/.test(line)) {
      const name = line.slice(6).trim();
      if (!TOPIC.test(name)) fail(file, n, `invalid topic name "${name}"`);
      current = {topic: name, open: [], ask: [], cue: [], phrase: [], words: new Set(), groups: [], overlaps: []};
      topics.push(current);
      inWords = false;
      return;
    }
    if (!current) fail(file, n, 'content before "topic:"');
    if (inWords && /^\s/.test(raw)) {
      // A "label:" prefix only groups words for the author; it is not itself a word.
      const list = line.includes(':') ? line.slice(line.indexOf(':') + 1) : line;
      const label = line.includes(':') ? line.slice(0, line.indexOf(':')).trim().toLowerCase() : '';
      const group = [];
      for (const word of list.split(',').map(w => w.trim().toLowerCase()).filter(Boolean)) {
        if (!WORD.test(word)) fail(file, n, `invalid word "${word}" (letters, spaces, apostrophes, hyphens)`);
        current.words.add(word);
        group.push(word);
      }
      // Groups become the structure of the topic's ring: words that share a group sit closer together.
      if (group.length) current.groups.push([label, group]);
      return;
    }
    inWords = false;
    const m = line.match(/^(open|ask|cue|phrase|words|overlap):\s*(.*)$/);
    if (!m) fail(file, n, `unrecognised line "${line.slice(0, 40)}"`);
    const [, key, rest] = m;
    if (key === 'overlap') {
      // overlap: other-topic | word, word   — words that belong to both rings, the bridges between them.
      const [other, list] = rest.split('|').map(x => x.trim());
      if (!TOPIC.test(other || '') || !list) fail(file, n, 'overlap must look like: overlap: topic | word, word');
      if (other === current.topic) fail(file, n, 'a topic cannot overlap itself');
      const words = list.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      for (const word of words) if (!WORD.test(word)) fail(file, n, `invalid word "${word}"`);
      current.overlaps.push([other, words]);
      return;
    }
    if (key === 'words') { inWords = true; if (rest) fail(file, n, '"words:" takes an indented block'); return; }
    if (key === 'cue') {
      const c = rest.match(/^\/(.+)\/\s*=>\s*(.+)$/);
      if (!c) fail(file, n, 'cue must look like: /regex/ => question');
      try { new RegExp(c[1], 'i'); } catch (e) { fail(file, n, 'bad regex: ' + e.message); }
      current.cue.push([c[1], c[2].trim()]);
      return;
    }
    for (const item of rest.split('|').map(s => s.trim()).filter(Boolean)) {
      if (key === 'phrase' && !item.includes('{p}')) fail(file, n, 'phrase questions need a {p} placeholder');
      current[key].push(item);
    }
  });
  return topics;
}

function compile() {
  const packs = {}, owner = new Map();
  for (const name of fs.readdirSync(THEMES).filter(f => f.endsWith('.txt')).sort()) {
    const file = path.join(THEMES, name);
    for (const t of parseFile(file)) {
      const pack = packs[t.topic] || (packs[t.topic] = {open: [], ask: [], cue: [], phrase: [], words: [], groups: [], overlaps: []});
      for (const key of ['open', 'ask', 'cue', 'phrase', 'groups', 'overlaps']) pack[key].push(...t[key]);
      for (const word of t.words) {
        if (owner.has(word) && owner.get(word) !== t.topic) {
          throw new Error(`"${word}" is listed under both ${owner.get(word)} and ${t.topic}; keep it in one topic`);
        }
        owner.set(word, t.topic);
        if (!pack.words.includes(word)) pack.words.push(word);
      }
    }
  }
  for (const pack of Object.values(packs)) pack.words.sort();
  const ordered = Object.fromEntries(Object.keys(packs).sort().map(k => [k, packs[k]]));
  const total = Object.values(ordered).reduce((n, p) => n + p.words.length, 0);
  const body = "'use strict';\n// Generated by tools/build-themes.cjs from themes/*.txt. Do not edit.\n"
    + 'Kira.THEME_PACKS=' + JSON.stringify(ordered) + ';\n';
  return {body, summary: `${Object.keys(ordered).length} topics, ${total} words`};
}

const {body, summary} = compile();
if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== body) {
    console.error('src/model/theme-packs.js is out of date; run node tools/build-themes.cjs');
    process.exit(1);
  }
  console.log('theme-packs.js matches themes/*.txt (' + summary + ').');
} else {
  fs.writeFileSync(OUTPUT, body);
  console.log('Wrote src/model/theme-packs.js: ' + summary + '.');
}
