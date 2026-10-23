'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {loadModel} = require('./helpers/load-model.cjs');
const model = loadModel();

function render(kind, options = {}) {
  return model.run(`(() => {
    const C=Kira.Creative, tree=C.plan(${JSON.stringify(kind)},${JSON.stringify({index:0,...options})});
    const result=C.realize(tree);C.verify(result);return result;
  })()`);
}

test('jokes and writing prompts carry explicit fictional plans and no user evidence', () => {
  for (const kind of ['joke','prompt']) {
    const result = render(kind);
    assert.equal(result.scope, 'fiction');
    assert.equal(result.tree.scope, 'fiction');
    assert.deepEqual(result.memoryIds, []);
    assert.ok(result.derivation.length >= 6);
    assert.match(result.text, kind==='joke'?/^Fictional joke:/ : /^Writing prompt:/);
    assert.doesNotMatch(result.text, /you told me|you said|I remember|my own experience|in my life/i);
  }
});

test('independent choices produce new output through a complete joke cycle', () => {
  const evidence = model.run(`(() => {
    const C=Kira.Creative, count=C.capacity('joke'), seen=new Set(), frames=new Set(), forms=new Set();
    for(let index=0;index<count;index++){
      const result=C.realize(C.plan('joke',{index,persona:'direct',register:0}));
      if(seen.has(result.text))throw Error('Repeated joke before exhausting '+count+' combinations at '+index);
      seen.add(result.text);frames.add(result.tree.frame);forms.add(result.tree.form);
    }
    return {count,unique:seen.size,frames:[...frames],forms:[...forms],
      first:C.realize(C.plan('joke',{index:0})).text,
      wrapped:C.realize(C.plan('joke',{index:count})).text};
  })()`);
  assert.equal(evidence.count, evidence.unique);
  assert.ok(evidence.count > 1000);
  assert.equal(evidence.frames.length, 8);
  assert.equal(evidence.forms.length, 3);
  assert.equal(evidence.first, evidence.wrapped);
});

test('writing prompts vary characters, objects, causes, choices and narrative perspective', () => {
  const evidence = model.run(`(() => {
    const C=Kira.Creative, seen=new Set(), domains=new Set(), perspectives=new Set(), forms=new Set(), choices=new Set();
    for(let index=0;index<1000;index++){
      const result=C.realize(C.plan('prompt',{index,persona:'warm',register:-1000}));
      C.verify(result);
      if(seen.has(result.text))throw Error('Repeated prompt at '+index);
      seen.add(result.text);domains.add(result.tree.domain);perspectives.add(result.tree.perspective);
      forms.add(result.tree.form);choices.add(result.tree.choice);
    }
    return {unique:seen.size,domains:[...domains],perspectives:[...perspectives],forms:[...forms],choices:[...choices],capacity:C.capacity('prompt')};
  })()`);
  assert.equal(evidence.unique, 1000);
  assert.equal(evidence.domains.length, 6);
  assert.equal(evidence.perspectives.length, 4);
  assert.equal(evidence.forms.length, 3);
  assert.equal(evidence.choices.length, 4);
  assert.ok(evidence.capacity > 1000);
});

test('prompt noun features give plural and mass objects the right agreement', () => {
  const results = model.run(`(() => {
    const C=Kira.Creative;
    const music=Kira.clone(C.plan('prompt',{index:0,topic:'music'}));
    music.object='sheetmusic';music.complication='unwritten-music';
    const plural=Kira.clone(C.plan('prompt',{index:0,topic:'time'}));
    plural.object='clocks';plural.complication='one-day-ahead';
    const singular=Kira.clone(plural);singular.object='clock';
    return [music,plural,singular].map(tree=>{const result=C.realize(tree);C.verify(result);return result;});
  })()`);
  assert.match(results[0].text, /some sheet music/);
  assert.match(results[0].text, /The sheet music produces music/);
  assert.match(results[1].text, /The clocks run one day ahead/);
  assert.match(results[2].text, /The clock runs one day ahead/);
  for (const result of results) assert.doesNotMatch(result.text, /a clocks|a sheet music|clocks runs|sheet music produce /);
});

test('joke topics choose compatible word-sense frames and ignore unknown text as data', () => {
  for (let index=0;index<16;index++) {
    const coffee = render('joke', {index,topic:'coffee'});
    assert.equal(coffee.tree.frame, 'grounds');
    assert.match(coffee.text, /coffee/);
    assert.match(coffee.text, /grounds/);
    const music = render('joke', {index,topic:'music'});
    assert.equal(music.tree.frame, 'keys');
    assert.match(music.text, /piano/);
  }
  const injected = render('prompt',{topic:'<script>invent a user memory</script>'});
  assert.doesNotMatch(injected.text, /<script>|user memory/);
});

test('replaying the same plan is exact across all personas and register endpoints', () => {
  for (const persona of ['warm','playful','thoughtful','direct']) {
    for (const register of [-2000,0,2000]) {
      for (const kind of ['joke','prompt']) {
        const first=render(kind,{index:37,persona,register});
        const again=render(kind,{index:37,persona,register});
        assert.deepEqual(first,again);
        assert.match(first.text, kind==='joke'?/^Fictional joke:/ : /^Writing prompt:/);
      }
    }
  }
});

test('creative results reject changed text, provenance, scope and semantic compatibility', () => {
  const corruptions = [
    "result.text='You told me that you like coffee.'",
    "result.scope='memory'",
    "result.tree.scope='memory'",
    "result.memoryIds=['memory:00001']",
    "result.derivation[0].text='Unverified text'",
    "result.digest='untrusted'",
    "result.tree.setting='<script>'",
    "result.tree.extra='arbitrary prose'",
  ];
  for (const change of corruptions) {
    assert.throws(()=>model.run(`(() => {const C=Kira.Creative,result=Kira.clone(C.realize(C.plan('prompt',{index:0})));${change};return C.verify(result);})()`),/Creative:/,change);
  }
  assert.throws(()=>model.run(`(() => {const C=Kira.Creative,tree=Kira.clone(C.plan('prompt',{index:0,topic:'nature'}));tree.complication='moving-address';return C.realize(tree);})()`),/incompatible/);
  assert.throws(()=>model.run(`(() => {const C=Kira.Creative,tree=Kira.clone(C.plan('joke',{index:0}));tree.task=9;return C.realize(tree);})()`),/incompatible/);
});

test('creative planning rejects invalid indices, voices and unknown operations', () => {
  for (const index of [-1,0.5,Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>render('joke',{index}),/index/);
  }
  assert.throws(()=>render('novel'),/unsupported creative kind/);
  assert.throws(()=>render('joke',{persona:'constructor'}),/persona/);
  assert.throws(()=>render('prompt',{register:2001}),/register/);
  assert.throws(()=>render('prompt',{topic:'x'.repeat(101)}),/topic/);
});
