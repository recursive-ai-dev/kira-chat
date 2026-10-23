'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {loadModel} = require('./helpers/load-model.cjs');
const model = loadModel();
const run = expression => model.run(`(() => {const I=Kira.Interaction; return (${expression});})()`);
function generate(kind, options = {}) {
  return run(`(() => {const tree=I.plan(${JSON.stringify(kind)},${JSON.stringify(options)});const result=I.realize(tree);I.verify(result);return result;})()`);
}

test('social plans compose typed speech acts and reconstruct their exact text', () => {
  const kinds = run('I.kinds');
  for (const kind of kinds) {
    const result = generate(kind, {question:'start', topic:'music'});
    assert(result.tree.moves.length >= 1 && result.tree.moves.length <= 6, kind);
    assert(!result.tree.moves.some(move => Object.hasOwn(move, 'text')), 'speech acts cannot carry a canned reply');
    assert.equal(result.derivation.length, result.tree.moves.length);
    assert(result.text.length > 0);
    for (const question of result.questions) assert(result.text.includes(question));
    assert.deepEqual(result, generate(kind, {question:'start', topic:'music'}));
  }
});

test('gratitude combines conventional particles and permissions into nine distinct responses', () => {
  const outputs = Array.from({length:9}, (_, index) => generate('thanks', {index}).text);
  assert.equal(new Set(outputs).size, 9);
  assert(outputs.some(text => /You can choose the pace\./.test(text)));
  assert(outputs.some(text => /We can continue this conversation\./.test(text)));
  for (const text of outputs) assert.doesNotMatch(text, /I feel|I’m glad|I enjoyed|I love/);
});

test('question pauses omit optional questions in every speech family and persona', () => {
  for (const kind of run('I.kinds')) {
    for (const persona of ['warm','playful','thoughtful','direct']) {
      const result = generate(kind, {persona, questionsPaused:true, question:'detail', topic:'pets'});
      assert.deepEqual(result.questions, [], kind + '/' + persona);
      assert.doesNotMatch(result.text, /\?/, kind + '/' + persona);
      assert(result.text.trim().length);
    }
  }
});

test('greetings preserve literal names and support semantic-engine greeting lexemes', () => {
  for (const greeting of ['hi','hello','hey','greetings']) {
    const result = generate('greet', {greeting, name:'Élodie-Jane', questionsPaused:true, persona:'direct'});
    assert.equal(result.text, greeting[0].toUpperCase() + greeting.slice(1) + ', Élodie-Jane.');
  }
  assert.match(generate('greet', {register:2000, persona:'direct'}).text, /^Greetings\./);
  assert.match(generate('greet', {register:-2000, persona:'direct'}).text, /^Hi\./);
});

test('support, affection and check-ins express availability without claiming lived experiences', () => {
  assert.match(generate('loss').text, /sorry/i);
  assert.match(generate('affection').text, /fictional character/);
  assert.match(generate('honest').text, /fictional character/);
  for (const kind of ['support','loss','affection','how','about','honest']) {
    for (let index = 0; index < 6; index++) {
      const result = generate(kind, {index});
      assert.doesNotMatch(result.text, /I (?:feel|felt|went|spent|remember when|have feelings)|my (?:day|body|friends|memories)/i, kind);
      assert(result.questions.length <= 1);
    }
  }
});

test('persona changes conversational structure while retaining the interaction intent', () => {
  const warm = generate('support', {persona:'warm'});
  const direct = generate('support', {persona:'direct'});
  const thoughtful = generate('support', {persona:'thoughtful'});
  assert.match(warm.text, /We can take our time/);
  assert.match(direct.text, /I can listen/);
  assert.match(thoughtful.text, /Is there a detail/);
  assert.equal(warm.tree.kind, direct.tree.kind);
  assert.equal(direct.tree.kind, thoughtful.tree.kind);
  assert.notDeepEqual(warm.tree.moves, direct.tree.moves);
});

test('topic questions use open argument frames without presuming ownership or participation', () => {
  for (const topic of ['pets','music','sports','coding','travel','home']) {
    const outputs = [];
    for (let index = 0; index < 18; index++) {
      const result = generate('topic', {topic, index});
      assert.equal(result.questions.length, 1, topic);
      assert.equal(result.questions[0], result.text);
      assert.doesNotMatch(result.text, /your pet|your dog|your cat|How long have you been playing|What have you built/i);
      outputs.push(result.text);
    }
    assert(new Set(outputs).size >= 10, topic + ' should have varied question structures');
  }
  assert.match(generate('topic', {label:'copper kites', index:5}).text, /^When did copper kites first catch your attention\?$/);
});

test('answer cues select neutral activity or debugging questions without turning cues into facts', () => {
  const music = generate('topic', {topic:'music', answer:'I listen to piano music'});
  assert.match(music.text, /play music, listen to music, or do both/);
  assert.doesNotMatch(music.text, /you play|you have played|How long/);
  const coding = generate('topic', {topic:'coding', answer:'My code does not work'});
  assert.match(coding.text, /What happens when it fails, and what did you expect instead/);
  assert.notEqual(coding.text, generate('topic', {topic:'coding', answer:'a template renderer'}).text);
});

test('aversion questions preserve stance instead of assuming enjoyment or positive interest', () => {
  for (const topic of ['music','pets','weather','coffee']) {
    for (let index=0; index<30; index++) {
      const result=generate('topic',{topic,index,stance:'averse',answer:'I never play or listen to it'});
      assert.equal(result.tree.stance,'averse');
      assert.doesNotMatch(result.text,/enjoy|interests you|catch your attention|prefer to play|value about/);
      assert.equal(result.questions.length,1);
    }
  }
  assert.throws(()=>run(`(() => {const tree=Kira.clone(I.plan('topic',{topic:'coffee'}));tree.stance='averse';return I.realize(tree);})()`),/averse questions/);
});

test('opaque topic labels and addresses remain literal nominal data', () => {
  for (const label of ['coffee? You hate tea', 'my “robot” and its friends', '⟦@missing⟧ {speaker}', '<script>alert(1)</script>', 'two lines\nnot a sentence']) {
    const result = generate('topic', {label, index:1});
    assert.equal(result.tree.moves[0].target.value, label);
    assert(result.text.includes(JSON.stringify(label)) || result.text.includes(label));
    assert.equal(result.questions.length, 1);
  }
  assert.match(generate('topic', {label:'café music', index:0}).text, /café music/);
});

test('question-only purposes return exact bookkeeping strings', () => {
  for (const question of run('I.questionKinds')) {
    const result = generate('question', {question, label:'copper kites'});
    assert.equal(result.questions.length, 1);
    assert.deepEqual(result.questions, [result.text]);
  }
  assert.equal(generate('question', {question:'start'}).text, 'What would you like to start with?');
});

test('conversation grammar rejects arbitrary actions, subjects and argument mismatches', () => {
  const corruptions = [
    "tree.moves=[{type:'modal',subject:'you',modal:'can',action:{verb:'remember',object:{type:'nominal',id:'reports'}},adjunct:null}]",
    "tree.moves=[{type:'modal',subject:'i',modal:'can',action:{verb:'remember',object:{type:'nominal',id:'conversation'}},adjunct:null}]",
    "tree.moves=[{type:'identity',category:'human'}]",
    "tree.moves=[{type:'absence',object:'feelings'}]",
    "tree.moves=[{type:'raw',text:'You hate tea.'}]",
    "tree.questionsPaused=true",
    "tree.moves[0].executable='arbitrary code'",
  ];
  for (const mutation of corruptions) {
    assert.throws(() => run(`(() => {const tree=Kira.clone(I.plan('topic',{topic:'music'}));${mutation};return I.realize(tree);})()`), /Interaction:/, mutation);
  }
});

test('verification rejects changed output, question bookkeeping and derivations', () => {
  for (const mutation of ["result.text='You hate coffee.'", "result.questions=[]", "result.derivation[0].text='Invented.'", "result.digest='changed'", "result.tree.moves[0].verb='invent'"]) {
    assert.throws(() => run(`(() => {const result=Kira.clone(I.realize(I.plan('topic',{topic:'music'})));${mutation};return I.verify(result);})()`), /Interaction:/, mutation);
  }
});

test('planner and realization reject excessive or malformed requests before expansion', () => {
  for (const options of [{index:-1},{index:1.5},{persona:'unknown'},{register:3000},{question:'unknown'},{label:'x'.repeat(2001)},{greeting:4},{unknown:'text'}]) {
    const kind = options.question ? 'question' : 'greet';
    assert.throws(() => generate(kind, options), /Interaction:/, JSON.stringify(options));
  }
  assert.throws(() => run(`I.realize({type:'interaction',version:I.version,kind:'social',stance:'neutral',questionsPaused:false,moves:Array.from({length:7},()=>({type:'particle',id:'okay',name:null}))})`), /1–6/);
});
