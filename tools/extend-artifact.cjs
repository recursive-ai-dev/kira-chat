#!/usr/bin/env node
'use strict';
// Rebuilds the sealed lexical artifact from tools/vocabulary.txt.
//
// The checked artifact carries derived data (classification proof, potentials, caches,
// certificate, digest). This tool regenerates all of it from the authored concepts and axioms,
// then refuses to write unless the existing verifyArtifact() accepts the result.
//
// Usage: node tools/extend-artifact.cjs [--check]   (then: python3 tools/build.py --pin)

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'model', 'artifact-data.js');
const K = require(path.join(ROOT, 'KiraSDK.js'));
const DATE = '2026-10-23';
const SOURCE = 'Kira 4.4 vocabulary expansion, ' + DATE;

const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const slug = id => id.slice(2);

function plural(word) {
  if (/(?:s|x|z|ch|sh)$/.test(word)) return word + 'es';
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
  return word + 's';
}

function parse(text) {
  const concepts = [], patches = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const cells = line.replace(/^@\s*/, '').split('|').map(c => c.trim());
    if (line.startsWith('@')) {
      const patch = {id: 'c:' + cells[0], aliases: [], parents: []};
      for (const cell of cells.slice(1)) {
        const [key, value] = cell.split('=');
        if (key === 'topic') patch.topic = value;
        else if (key === '+parents') patch.parents = value.split(',').map(x => 'c:' + x.trim());
        else if (key === '+aliases') patch.aliases = value.split(',').map(x => x.trim());
        else throw Error('Unknown patch field: ' + line);
      }
      patches.push(patch);
      continue;
    }
    if (cells.length < 4 || cells.length > 5) throw Error('Expected 4 or 5 fields: ' + line);
    const mass = cells[1].startsWith('~'), label = cells[1].replace(/^~/, '');
    const extras = cells[2] ? cells[2].split(',').map(x => x.trim()).filter(Boolean) : [];
    const aliases = [];
    for (const word of [label, ...extras]) {
      aliases.push(word);
      if (!mass) aliases.push(plural(word));
    }
    concepts.push({
      id: 'c:' + cells[0], label, aliases: [...new Set(aliases.map(a => K.nfc(a)))],
      parents: cells[3].split(',').map(x => 'c:' + x.trim()).filter(x => x !== 'c:'),
      topic: cells[4] || undefined
    });
  }
  return {concepts, patches};
}

function provenance(id, evidence) {
  const p = {id: 'prov:' + id, source: SOURCE, evidence, annotators: ['implementation-author'], approvals: [],
    review: 'UNREVIEWED', stratum: 'EXPERIMENTAL', date: DATE};
  p.decisionDigest = K.sha256(p.id + '\n' + evidence);
  return p;
}

const axiomId = (a, b) => 'ax:sub:' + slug(a) + '::' + slug(b);
const subAxiom = (a, b) => ({
  id: axiomId(a, b), kind: 'sub', a, b,
  provenance: provenance('sub' + slug(a) + slug(b), 'Explicit curated sub axiom in the supported fragment.')
});

// Closure of the supported rules, with a derivation index for every fact.
function classify(artifact) {
  const ids = artifact.concepts.map(c => c.id), nodes = [], index = new Map();
  const key = f => f.join('\u0000');
  const add = (f, rule, premises, axiom) => {
    if (index.has(key(f))) return false;
    index.set(key(f), nodes.length);
    nodes.push({id: nodes.length, f, rule, premises, axiom});
    return true;
  };
  for (const c of ids) add(['sub', c, c], 'Refl', [], null);
  const subs = artifact.axioms.filter(x => x.kind === 'sub'), exs = artifact.axioms.filter(x => x.kind === 'ex');
  const disj = artifact.axioms.filter(x => x.kind === 'disj'), trans = artifact.axioms.filter(x => x.kind === 'trans');
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < nodes.length; i++) {
      const f = nodes[i].f;
      if (f[0] === 'sub') {
        for (const ax of subs) if (ax.a === f[2]) changed = add(['sub', f[1], ax.b], 'Trans', [i], ax.id) || changed;
        for (const ax of exs) if (ax.a === f[2]) changed = add(['ex', f[1], ax.role, ax.b], 'ExSub', [i], ax.id) || changed;
        for (const ax of disj) {
          if (ax.a === f[2] && index.has(key(['sub', f[1], ax.b]))) throw Error('Unsatisfiable concept: ' + f[1]);
        }
      } else if (f[0] === 'ex') {
        for (const m of nodes.slice()) {
          if (m.f[0] === 'sub' && m.f[1] === f[3]) changed = add(['ex', f[1], f[2], m.f[2]], 'ExSup', [i, m.id], null) || changed;
          if (m.f[0] === 'ex' && m.f[1] === f[3] && m.f[2] === f[2]) {
            for (const ax of trans) if (ax.role === f[2]) changed = add(['ex', f[1], f[2], m.f[3]], 'Chain', [i, m.id], ax.id) || changed;
          }
        }
      }
    }
  }
  return {nodes, unsat: []};
}

function rebuild(base, vocab) {
  const a = JSON.parse(JSON.stringify(base));
  const authored = new Set(vocab.concepts.map(c => c.id));
  // Drop the previous generation of authored concepts so the tool is idempotent.
  a.concepts = a.concepts.filter(c => !authored.has(c.id));
  a.axioms = a.axioms.filter(x => !(x.kind === 'sub' && authored.has(x.a)));
  a.senses = a.senses.filter(s => !authored.has(s.cid));
  a.fibers = a.fibers.filter(f => !authored.has(f.cid));
  a.nonVacuity = a.nonVacuity.filter(n => !authored.has(n.cid));

  const known = new Set([...a.concepts.map(c => c.id), ...authored]);
  const owner = new Map();
  for (const c of a.concepts) for (const al of c.aliases) owner.set(K.fold(al), c.id);
  for (const c of vocab.concepts) {
    if (a.concepts.some(x => x.id === c.id)) throw Error('Concept already exists: ' + c.id);
    for (const p of c.parents) if (!known.has(p)) throw Error(c.id + ' has unknown parent ' + p);
    // Aliases may be shared only deliberately; report any that collide with another concept.
    for (const al of c.aliases) {
      const other = owner.get(K.fold(al));
      if (other && other !== c.id) console.warn('alias "' + al + '" of ' + c.id + ' is also ' + other);
      if (!other) owner.set(K.fold(al), c.id);
    }
    const entry = {id: c.id, label: c.label, aliases: c.aliases, grammar: 'noun'};
    if (c.topic) entry.topic = c.topic;
    a.concepts.push(entry);
    for (const p of c.parents) a.axioms.push(subAxiom(c.id, p));
    a.senses.push({id: 's:' + slug(c.id), cid: c.id, lemma: c.label, lin: [0, 0], grammar: 'noun'});
    a.fibers.push({cid: c.id, provenance: provenance('c:' + slug(c.id),
      'One stipulated denotation. Lexical variants require independent human review before promotion.')});
    for (const kind of ['NonEmpty', 'NonUniversal']) {
      a.nonVacuity.push({id: 'nv:' + kind + ':' + c.id, kind, cid: c.id, provenance: provenance(kind + c.id,
        'Explicit non-vacuity assumption in this small demonstration domain; not derived from satisfiability.')});
    }
  }
  for (const patch of vocab.patches) {
    const c = a.concepts.find(x => x.id === patch.id);
    if (!c) throw Error('Patch for unknown concept ' + patch.id);
    if (patch.topic) c.topic = patch.topic;
    for (const al of patch.aliases) if (!c.aliases.includes(al)) c.aliases.push(al);
    for (const p of patch.parents) {
      if (!known.has(p)) throw Error(patch.id + ' has unknown parent ' + p);
      if (!a.axioms.some(x => x.id === axiomId(patch.id, p))) a.axioms.push(subAxiom(patch.id, p));
    }
  }

  a.concepts.sort((x, y) => byId(x.id, y.id));
  a.axioms.sort((x, y) => byId(x.id, y.id));
  a.senses.sort((x, y) => byId(x.id, y.id));
  a.fibers.sort((x, y) => byId(x.cid, y.cid));
  a.nonVacuity.sort((x, y) => byId(x.id, y.id));
  a.classification = classify(a);

  const ids = a.concepts.map(c => c.id), has = new Set(a.classification.nodes.map(n => n.f.join('\u0000')));
  a.potentials = ids.map(cid => {
    const hypo = ids.filter(x => x !== cid && has.has(['sub', x, cid].join('\u0000'))).length;
    return {cid, hypo, phi: K.phi(hypo, ids.length)};
  });
  a.cache = {
    dependencyRoot: '',
    fibers: ids.map(cid => ({cid, sids: a.senses.filter(s => s.cid === cid).map(s => s.id)}))
  };
  const truth = {};
  for (const k of ['schema', 'profile', 'unicode', 'concepts', 'axioms', 'nonVacuity', 'expressionNV', 'complements', 'nonCoverage', 'fibers']) truth[k] = a[k];
  a.cache.dependencyRoot = K.hash(truth);
  a.certificate = {...a.certificate, classificationRoot: K.hash(a.classification), tableRoot: K.hash(a.tables)};
  delete a.hash;
  a.hash = K.hash(a);
  return a;
}

function main() {
  const vocab = parse(fs.readFileSync(path.join(__dirname, 'vocabulary.txt'), 'utf8'));
  const base = JSON.parse(JSON.stringify(K.ARTIFACT));
  const next = rebuild(base, vocab);
  const verdict = K.verifyArtifact(next);
  if (!verdict.accepted) {
    console.error('Rebuilt artifact rejected: ' + verdict.reason);
    return 1;
  }
  console.log(`Artifact accepted: ${next.concepts.length} concepts, ${next.senses.length} senses, ${next.axioms.length} axioms, ${next.classification.nodes.length} derived facts.`);
  if (process.argv.includes('--check')) return 0;
  fs.writeFileSync(DATA, "'use strict';\nKira.ARTIFACT=" + JSON.stringify(next) + ';\n');
  console.log('Wrote src/model/artifact-data.js; now run: python3 tools/build.py --pin');
  return 0;
}

process.exitCode = main();
