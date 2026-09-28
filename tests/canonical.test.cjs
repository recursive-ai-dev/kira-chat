'use strict';

// Tests for the canonical and checking layers: the code the "checked semantics"
// and "deterministic replay" claims rest on, which conversation.test.cjs only
// exercises indirectly.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {loadModel} = require('./helpers/load-model.cjs');
const {K, engine, query, run} = loadModel();

test('sha256 matches published vectors and the platform digest', () => {
  // NIST/RFC known answers, independent of any other implementation.
  assert.equal(K.sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(K.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

  // And it must agree with a completely separate implementation.
  for (const value of ['', 'abc', 'kira', 'a'.repeat(1000), 'e\u0301lan', '🎧\u00a0x']) {
    assert.equal(K.sha256(value), crypto.createHash('sha256').update(value, 'utf8').digest('hex'));
  }
});

test('sha256 handles multi-block and boundary-length inputs', () => {
  for (const length of [54, 55, 56, 63, 64, 65, 119, 120, 127, 128]) {
    const value = 'x'.repeat(length);
    assert.equal(K.sha256(value), crypto.createHash('sha256').update(value, 'utf8').digest('hex'), `length ${length}`);
  }
});

test('canonical encoding is deterministic and order-independent', () => {
  // Built in-context: canonical() only accepts objects whose prototype is the
  // context's Object.prototype (see the realm note in the loader).
  const report = run(`(() => {
    const bytes = o => Array.from(Kira.canonical(o));
    const attempt = value => { try { Kira.canonical(value); return 'accepted'; } catch (error) { return error.message; } };
    return {
      same: JSON.stringify(bytes({b: 1, a: [1, 'x', null, true]})) ===
            JSON.stringify(bytes({a: [1, 'x', null, true], b: 1})),
      hashSame: Kira.hash({b: 1, a: 2}) === Kira.hash({a: 2, b: 1}),
      // CBOR has a dedicated negative-integer encoding, so -1 is legal input.
      negativeOk: attempt(-1),
      fractional: attempt(1.5),
      infinite: attempt(Infinity),
      notANumber: attempt(NaN),
      undefinedValue: attempt(undefined),
      // CBOR encodes the magnitude as uint64 with a sign flag, so -2^64 is the
      // most negative legal value; one further is out of range.
      tooNegative: attempt(-(2n ** 64n) - 1n),
      tooLarge: attempt(2n ** 64n),
      mostNegative: attempt(-(2n ** 64n)),
    };
  })()`);
  assert.equal(report.same, true, 'key order must not affect the encoding');
  assert.equal(report.hashSame, true, 'hash must be order-independent');
  assert.equal(report.negativeOk, 'accepted', 'CBOR encodes negative integers');
  assert.match(report.fractional, /exact integers/);
  assert.match(report.infinite, /exact integers/);
  assert.match(report.notANumber, /exact integers/);
  assert.match(report.undefinedValue, /Unsupported canonical value/);
  assert.match(report.tooNegative, /outside uint64/);
  assert.match(report.tooLarge, /outside uint64/);
  assert.equal(report.mostNegative, 'accepted', '-2^64 is the most negative CBOR integer');
});

test('nfc and fold normalize text for matching', () => {
  assert.equal(K.nfc('e\u0301'), '\u00e9');
  assert.equal(K.nfc('\u1100\u1161'), '\uac00');
  assert.equal(K.nfc('A\u030a'), '\u00c5');
  assert.equal(K.fold('\u2019s'), "'s");
  assert.equal(K.fold('ABC'), 'abc');
  assert.throws(() => K.nfc('\ud800'), /surrogate/);
});


test('merkle roots reject ungrounded evidence', () => {
  const report = run(`(() => {
    const good = Kira.merkle([{tag: 'A', fields: {}, children: []}, {tag: 'B', fields: {}, children: [0]}]);
    const attempt = nodes => { try { Kira.merkle(nodes); return 'accepted'; } catch (error) { return error.message; } };
    return {
      good,
      forward: attempt([{tag: 'A', fields: {}, children: [1]}]),
      negative: attempt([{tag: 'A', fields: {}, children: [-1]}]),
    };
  })()`);
  assert.match(report.good, /^[0-9a-f]{64}$/);
  assert.match(report.forward, /Ungrounded/);
  assert.match(report.negative, /Ungrounded/);
});

test('phi yields a bounded, strictly monotone potential', () => {
  const values = [1, 2, 5, 17, 64, 200].map(n => K.phi(n, 256));
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] < values[i - 1], 'potential must fall as the hypothesis set grows');
  }
  assert.equal(K.phi(0, 256), 4294967296);
  assert.equal(K.phi(255, 256), 0);
  assert.throws(() => K.phi(-1, 256));
});

test('the bundled artifact passes its own checker', () => {
  const result = K.verifyArtifact(K.ARTIFACT);
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.artifactHash, K.APP_META.artifactHash);
  assert.equal(result.formalVerification, false, 'must not claim formal verification');
});

test('the checker rejects a tampered artifact', () => {
  const verify = body => run(`(() => {
    const copy = Kira.clone(Kira.ARTIFACT);
    ${body}
    return Kira.verifyArtifact(copy);
  })()`);
  // Flip a concept label: the digest no longer matches.
  assert.equal(verify("copy.concepts[0].label = 'tampered';").accepted, false);
  // Forge a relation table the reference generator would not produce.
  assert.equal(verify('copy.tables.join[3][3] = 0;').accepted, false);
  // Break closure by deleting a classified fact.
  assert.equal(verify('copy.classification.nodes.pop();').accepted, false);
});


test('a query is checked against the independent reference implementation', () => {
  const result = query({op: 'subsumes', a: 'c:analog-synthesizer', b: 'c:musical-instrument'});
  assert.equal(result.outcome, 'Yes');
  assert.equal(result.checked, true);
  assert.equal(result.evidence.type, 'SemanticProof');
  assert.match(result.evidence.root, /^[0-9a-f]{64}$/);
  assert.match(result.digest, /^[0-9a-f]{64}$/);
  for (const node of result.evidence.nodes) {
    assert.equal(typeof node.tag, 'string');
    for (const child of node.children) assert.ok(child >= 0 && child < result.evidence.nodes.length);
  }
});

test('optimizer and reference checker agree across sampled operators', () => {
  const report = run(`(() => {
    const out = {subsumes: 0, relation: 0, realize: 0, route: 0, failures: 0, firstFailure: ''};
    const ids = Kira.ARTIFACT.concepts.map(c => c.id);
    const sids = Kira.ARTIFACT.senses.map(s => s.id);
    const attempt = (name, q) => {
      const r = __engine.query(q);
      if (r.outcome === 'InvalidQuery' || r.outcome === 'ArtifactMismatch') return;
      if (r.checked !== true) { out.failures++; if (!out.firstFailure) out.firstFailure = name + ':' + r.outcome; }
      else out[name]++;
    };
    for (let i = 0; i < ids.length; i += 37) {
      attempt('subsumes', {op: 'subsumes', a: ids[i], b: ids[(i + 11) % ids.length]});
      attempt('realize', {op: 'realize', c: ids[i], target: [0, 0]});
      attempt('route', {op: 'route', intent: ids[i]});
    }
    for (let i = 0; i < sids.length; i += 23) attempt('relation', {op: 'relation', a: sids[i], b: sids[(i + 13) % sids.length]});
    return out;
  })()`);
  assert.equal(report.failures, 0, 'no query may escape the reference check (first: ' + report.firstFailure + ')');
  assert.ok(report.subsumes > 5 && report.relation > 5 && report.realize > 5 && report.route > 5,
    `expected a meaningful sample of each operator, got ${JSON.stringify(report)}`);

test('a wrong answer is rejected rather than returned', () => {
  // The point of auditQuery: a lying optimizer must never reach the UI.
  const outcome = run(`(() => {
    const forged = new Kira.SemanticEngine(Kira.ARTIFACT);
    const honest = forged.propose.bind(forged);
    forged.propose = q => ({...honest(q), outcome: 'No'});
    try { forged.query({op: 'subsumes', a: 'c:analog-synthesizer', b: 'c:musical-instrument'}); return 'ACCEPTED'; }
    catch (error) { return error.message; }
  })()`);
  assert.match(outcome, /Query rejected/);
});

test('malformed queries fail with a reason instead of throwing raw', () => {
  for (const [spec, outcome, pattern] of [
    // An unknown operator is reported as such, not folded into InvalidQuery.
    [{op: 'nope', a: 'c:coffee', b: 'c:drink'}, 'UnsupportedOperator', /Unsupported operation/],
    [{op: 'subsumes', a: 'c:does-not-exist', b: 'c:drink'}, 'InvalidQuery', /Unknown concept/],
    [{op: 'relation', a: 'no-sense', b: 'no-sense'}, 'InvalidQuery', /Unknown sense/],
    [{op: 'realize', c: 'c:coffee', target: [1, 2, 3]}, 'InvalidQuery', /Coordinate dimension/],
    [{op: 'entails', edits: []}, 'InvalidQuery', /edits/],
  ]) {
    const result = query(spec);
    assert.equal(result.outcome, outcome, `outcome for ${JSON.stringify(spec)}`);
    assert.equal(result.evidence, null, 'a rejected query must carry no proof');
    assert.match(result.value.reason, pattern);
  }
});

test('a query pinned to another artifact is refused', () => {
  assert.equal(query({op: 'subsumes', a: 'c:coffee', b: 'c:drink', artifactHash: 'other-hash'}).outcome, 'ArtifactMismatch');
});

test('an experimental artifact cannot be promoted to reviewed', () => {
  // The shipped artifact is EXPERIMENTAL and its provenance is UNREVIEWED, so
  // demanding review must fail. It fails on the missing independent approvals
  // before it ever reaches the profile guard.
  const result = run('Kira.verifyArtifact(Kira.ARTIFACT, {requireReviewed: true})');
  assert.equal(result.accepted, false);
  assert.match(result.reason, /Independent approvals missing/);
  assert.equal(K.ARTIFACT.profile, 'EXPERIMENTAL');
});

test('the engine exposes only concepts its artifact declares', () => {
  const report = run(`(() => {
    const attempt = fn => { try { return 'ok:' + JSON.stringify(fn()); } catch (error) { return 'threw:' + error.message; } };
    return {
      unknown: attempt(() => __engine.lookup('definitely-not-in-the-lexicon')),
      coffee: attempt(() => __engine.lookup('coffee').length),
      longSearch: attempt(() => __engine.lexicon({text: 'x'.repeat(201)})),
      badConcept: attempt(() => __engine.lexicon({id: 'c:does-not-exist'})),
    };
  })()`);
  assert.equal(report.unknown, 'ok:[]');
  assert.equal(report.coffee, 'ok:1');
  assert.match(report.longSearch, /threw:.*under 200 characters/);
  assert.match(report.badConcept, /threw:.*Unknown concept/);
});

});

test('identical queries are byte-for-byte deterministic', () => {
  const first = query({op: 'subsumes', a: 'c:coffee', b: 'c:drink'});
  for (let i = 0; i < 3; i++) assert.deepEqual(query({op: 'subsumes', a: 'c:coffee', b: 'c:drink'}), first);
});
