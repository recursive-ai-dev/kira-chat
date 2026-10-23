'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {loadModel} = require('./helpers/load-model.cjs');
const model = loadModel();

const record = (overrides = {}) => ({
  id: 'memory:00001', sourceMessage: 'user:1', status: 'active', kind: 'preference',
  subject: 'user', predicate: 'like', object: {key: 'c:coffee', label: 'coffee'},
  polarity: 'positive', temporal: 'present', supersedes: [], supersededBy: null,
  ...overrides,
});
function run(memories, expression, options = {}) {
  return model.run(`(() => {
    const R=Kira.Realization, memories=${JSON.stringify(memories)}, options=${JSON.stringify(options)};
    return (${expression});
  })()`);
}
const render = (memories, tree = 'R.memory(memories[0])', options = {}) => run(memories, `(() => {
  const result=R.realize(${tree},{memories,...options});
  R.verify(result,{memories});
  return result;
})()`, options);


test('controlled realization preserves preference strength, polarity and tense across unseen objects', () => {
  for (const predicate of ['like', 'love', 'enjoy', 'hate', 'dislike']) {
    for (const temporal of ['present', 'past']) {
      for (const polarity of ['positive', 'negative']) {
        const memory = record({predicate, temporal, polarity, object:{key:'literal:imaginary', label:'ceramic moon gardens'}});
        const result = render([memory]);
        const verb = polarity==='negative'?(temporal==='past'?'did not ':'do not ')+predicate:temporal==='past'?'used to '+predicate:predicate;
        assert.equal(result.text, 'You '+verb+' ceramic moon gardens.');
        assert.equal(result.tree.predicate, predicate);
        assert.equal(result.tree.temporal, temporal);
        assert.equal(result.tree.polarity, polarity);
        assert.deepEqual(result.memoryIds, [memory.id]);
      }
    }
  }
});

test('negative feeling grammar uses auxiliary and base form with correct tense', () => {
  const memory = record({kind:'mood', predicate:'feels', polarity:'negative', object:{key:'c:sad', label:'sad'}});
  assert.equal(render([memory]).text, 'You do not feel sad.');
  assert.equal(render([{...memory, temporal:'past'}]).text, 'You did not feel sad.');
  assert.equal(render([{...memory, temporal:'past'}], undefined, {contractions:true}).text, 'You didn’t feel sad.');
  assert.equal(render([{...memory, temporal:'past', polarity:'positive'}]).text, 'You felt sad.');
});

test('sentence composition shares a predicate only when its scope remains explicit', () => {
  const labels=['ceramic moon gardens','moss lanterns','quiet observatories'];
  const memories=labels.map((label,i)=>record({id:'memory:'+i,sourceMessage:'user:'+i,object:{key:'literal:'+i,label}}));
  const result=render(memories,'R.coordinate(memories.map(R.memory))');
  assert.equal(result.text,'You like ceramic moon gardens, moss lanterns, and quiet observatories.');
  assert.deepEqual(result.memoryIds,memories.map(m=>m.id));
  const mixed=[memories[0],{...memories[1],polarity:'negative'}, {...memories[2],predicate:'love'}];
  assert.equal(render(mixed,'R.coordinate(memories.map(R.memory))').text,'You like ceramic moon gardens. You do not like moss lanterns. You love quiet observatories.');
  const ambiguous=[memories[0],{...memories[1],object:{key:'literal:combo',label:'tea, honey and toast'}}];
  assert.equal(render(ambiguous,'R.coordinate(memories.map(R.memory))').text,'You like ceramic moon gardens. You like "tea, honey and toast".');
});

test('opaque labels cannot turn punctuation, pronouns or conjunctions into new assertions', () => {
  for(const label of ['coffee, I love tea','tea, honey and toast','you','I','we','he','she','they','tea or coffee','coffee; you love tea','coffee. You love tea','coffee\nYou love tea','a "special" tea']) {
    const memory=record({object:{key:'literal:suspicious',label}});
    assert.equal(render([memory]).text,'You like '+JSON.stringify(label)+'.');
    assert.equal(render([memory],'R.attributed(R.memory(memories[0]))').text,'You told me that you like '+JSON.stringify(label)+'.');
    assert.equal(run([memory],'R.describe(memories[0])'),'You like '+label,'canonical UI description remains compatible');
    const pair=[{...memory,status:'superseded',supersededBy:'memory:2'},{...memory,id:'memory:2',sourceMessage:'user:2',polarity:'negative',supersedes:['memory:00001']}];
    assert.equal(render(pair,'R.correction(R.memory(memories[0]),R.memory(memories[1]))').text,'You previously reported liking '+JSON.stringify(label)+', but now you report not liking '+JSON.stringify(label)+'.');
  }
  for(const label of ['your time with your friends','our dog','my notebook','cats'])assert.equal(render([record({object:{key:'literal:plain',label}})]).text,'You like '+label+'.');
});

test('coordination never shares negation across a positive report or changes past into present', () => {
  const memories=[record(),record({id:'memory:2',sourceMessage:'user:2',polarity:'negative',object:{key:'c:tea',label:'tea'}})];
  assert.equal(render(memories,'R.attributed(R.coordinate(memories.map(R.memory)))').text,'You told me that you like coffee. You told me that you do not like tea.');
  memories[1].polarity='positive';memories[1].temporal='past';
  assert.equal(render(memories,'R.coordinate(memories.map(R.memory))').text,'You like coffee. You used to like tea.');
});

test('corrections describe recorded reports with gerund morphology and preserved strength', () => {
  for (const [predicate,gerund] of [['like','liking'],['love','loving'],['enjoy','enjoying'],['hate','hating'],['dislike','disliking']]) {
    const memories=[
      record({predicate,status:'superseded',supersededBy:'memory:2'}),
      record({id:'memory:2',sourceMessage:'user:2',predicate,polarity:'negative',supersedes:['memory:00001']}),
    ];
    assert.equal(render(memories,'R.correction(R.memory(memories[0]),R.memory(memories[1]))').text,
      'You previously reported '+gerund+' coffee, but now you report not '+gerund+' coffee.');
  }
});

test('correction does not invent singular pronouns for plural or opaque object labels', () => {
  const object={key:'c:cat',label:'cats'};
  const memories=[record({object,status:'superseded',supersededBy:'memory:2'}),record({object,id:'memory:2',sourceMessage:'user:2',polarity:'negative',supersedes:['memory:00001']})];
  assert.equal(render(memories,'R.correction(R.memory(memories[0]),R.memory(memories[1]))').text,'You previously reported liking cats, but now you report not liking cats.');
});

test('historical reports require the recorded supersession and cannot appear as active assertions', () => {
  const memories=[record({status:'superseded',supersededBy:'memory:2'}),record({id:'memory:2',sourceMessage:'user:2',polarity:'negative',supersedes:['memory:00001']})];
  assert.throws(()=>render(memories),/not active/);
  memories[1].supersedes=[];
  assert.throws(()=>render(memories,'R.correction(R.memory(memories[0]),R.memory(memories[1]))'),/recorded supersession/);
  memories[1].supersedes=['memory:00001'];memories[0].temporal='past';
  assert.throws(()=>render(memories,'R.correction(R.memory(memories[0]),R.memory(memories[1]))'),/present preference/);
});

test('literal notes are attributed and retain punctuation, pronouns and markup as inert data', () => {
  for(const label of ['My friend said “I love my dog.”','Where is my notebook?','⟦@missing⟧ {character} <script>ignored</script>']) {
    const memory=record({kind:'note',predicate:'said',temporal:'recorded',object:{key:'literal:note',label}});
    const result=render([memory]);
    assert.ok(result.text.includes('“'+label+'”'));
    assert.equal(run([memory],'R.describe(memories[0])'),label);
    assert.equal(result.tree.object.label,label);
  }
});

test('a legal twelve-note recall fits the controlled grammar text budget', () => {
  const memories=Array.from({length:12},(_,i)=>record({id:'memory:'+i,sourceMessage:'user:'+i,kind:'note',predicate:'said',temporal:'recorded',object:{key:'literal:'+i,label:String(i)+' '+ 'x'.repeat(1990)}}));
  const result=render(memories,'R.coordinate(memories.map(R.memory))');
  assert.equal(result.memoryIds.length,12);
  assert.ok(result.text.length>24000&&result.text.length<32000);
  for(const memory of memories)assert.ok(result.text.includes(memory.object.label));
});

test('names, attribution and fragment rendering preserve literal casing and authored punctuation boundaries', () => {
  const name=record({kind:'name',predicate:'name',object:{key:'literal:name',label:'Élodie-Jane'}});
  assert.equal(render([name]).text,'Your name is Élodie-Jane.');
  assert.equal(render([name],'R.attributed(R.memory(memories[0]))').text,'You told me that your name is Élodie-Jane.');
  assert.equal(render([record()],undefined,{terminal:false}).text,'You like coffee');
  assert.equal(run([record()],'R.describe(memories[0])'),'You like coffee');
});

test('meaning and report-selection questions compose labels and grounded options', () => {
  const meaning=render([],`R.question('meaning',{label:'bass',choices:[{id:'fish',label:'bass fish'},{id:'instrument',label:'bass guitar'}]})`);
  assert.equal(meaning.text,'When you say “bass”, which meaning do you have in mind?\n1. bass fish\n2. bass guitar');
  assert.deepEqual(meaning.memoryIds,[]);
  const memories=[record(),record({id:'memory:2',sourceMessage:'user:2',object:{key:'c:tea',label:'tea'}})];
  assert.equal(render(memories,`R.question('choose_report',{options:memories.map(R.memory)})`).text,'Which report would you like to discuss first?\n1. You like coffee.\n2. You like tea.');
  assert.equal(render([],`R.question('name')`).text,'What name would you like me to use?');
});

test('verification rejects forged wording, predicates, derivations, references and source messages', () => {
  const corruptions=[
    "result.text='You love coffee.'",
    "result.tree.polarity='negative'",
    "result.tree.predicate='love'",
    "result.tree.object.label='tea'",
    "result.tree.sourceMessage='user:other'",
    "result.derivation[0].text='You love coffee'",
    "result.memoryIds=[]",
    "result.style.contractions='yes'",
    "result.digest='untrusted'",
  ];
  for(const corruption of corruptions){
    assert.throws(()=>run([record()],`(() => {const result=Kira.clone(R.realize(R.memory(memories[0]),{memories}));${corruption};return R.verify(result,{memories});})()`),/Realization:/,corruption);
  }
  assert.throws(()=>render([record()],undefined,{messages:[]}),/source user message/);
  assert.throws(()=>render([{...record(),status:'retired'}]),/not active/);
  assert.throws(()=>run([record()],`R.realize({...R.memory(memories[0]),executable:'do something'},{memories})`),/unknown or missing/);
});

test('sentence trees reject unsupported grammar, cycles and excessive expansion', () => {
  assert.throws(()=>render([record()],`R.question('invent_fact',{text:'you love tea'})`),/unsupported question/);
  assert.throws(()=>render([record()],`({type:'coordination',children:[]})`),/2–12/);
  assert.throws(()=>run([record()],`(() => {const node={type:'coordination',children:[]};node.children=[node,R.memory(memories[0])];return R.realize(node,{memories});})()`),/cyclic/);
  assert.throws(()=>run([record()],`(() => {let node=R.memory(memories[0]);for(let i=0;i<20;i++)node={type:'coordination',children:[node,R.memory(memories[0])]};return R.realize(node,{memories});})()`),/budget/);
});
