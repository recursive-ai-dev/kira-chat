'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {loadModel} = require('./helpers/load-model.cjs');
const {K, dialogue} = loadModel();

function talk(messages, persona = 'warm', register = -1000) {
  const events = [{seq:1,time:0,type:'settings',settings:{persona,register}}];
  let state = dialogue.step(K.initialState(),events[0]).state;
  const plans = [];
  for (const text of messages) {
    const event = {seq:events.length+1,time:events.length,type:'message',text};
    const out = dialogue.step(state,event);state=out.state;events.push(event);plans.push(out.plan);
    for (const {result,start,end} of out.plan.realizations) {
      assert.equal(out.plan.text.slice(start,end),result.text);
      assert.equal(K.Realization.verify(result,{memories:state.memories,messages:state.messages}),true);
    }
    if (state.context.pending?.question) assert.ok(out.plan.text.includes(state.context.pending.question));
  }
  assert.equal(K.hash(dialogue.replay(events)),K.hash(state),'generated turns and scopes replay exactly');
  return {state,plans};
}

const scopes = plan => Array.from(plan.realizations,span=>span.result.scope);

test('social replies use conversational speech plans without inventing reported memories', () => {
  for (const message of ['hello','thanks','bye','How are you?','What can you do?','Are you real?','I need support','My dog died','I love you']) {
    const {state,plans}=talk([message]);
    assert.ok(scopes(plans[0]).includes('conversation'),message);
    assert.equal(state.memories.length,0,message);
    assert.ok(plans[0].realizations.every(span=>span.result.memoryIds.length===0));
    assert.doesNotMatch(plans[0].text,/I (?:went|ate|slept|woke|felt)|my (?:body|childhood|family)/i);
  }
});

test('general topic questions are generated from neutral frames and record exact shown wording', () => {
  for (const message of ['I like violet tea','Tell me about coffee','Tell me about pets','I am building a compiler']) {
    const {state,plans}=talk([message]);
    assert.equal(plans[0].policy.questionOrigin,'compositional',message);
    const questions=plans[0].realizations.filter(span=>span.result.scope==='conversation');
    assert.ok(questions.length,message);
    assert.ok(state.context.pending?.question.endsWith('?'));
    assert.doesNotMatch(plans[0].text,/your (?:pets?|songs?)|How long have you been playing|What is their name/i);
  }
});

test('question pauses apply before social generation and can be resumed', () => {
  for (const message of ['hello','thanks','How are you?','I need support','Tell me about coffee','I like coffee. How are you?']) {
    const {state,plans}=talk(['Stop asking me questions',message]);
    assert.doesNotMatch(plans.at(-1).text,/\?/,message);
    assert.equal(state.context.pending,null,message);
  }
  const {state,plans}=talk(['Stop asking me questions','thanks','Please ask me a question']);
  assert.ok(state.context.pending?.question);
  assert.ok(scopes(plans.at(-1)).includes('conversation'));
});

test('creative requests generate distinct explicit fiction with no factual memory claims', () => {
  for (const [request,kind] of [['Tell me a joke','joke'],['Give me a writing prompt','prompt']]) {
    const {state,plans}=talk([request,...Array(31).fill('another one')]);
    assert.equal(new Set(plans.map(plan=>plan.text)).size,32,kind);
    assert.equal(state.memories.length,0);
    for (const plan of plans) {
      assert.equal(plan.act,kind);
      assert.deepEqual(scopes(plan),['fiction']);
      assert.equal(plan.claims.length,0);
      assert.equal(plan.realizations[0].result.memoryIds.length,0);
      assert.match(plan.text,kind==='joke'?/fictional joke/i:/writing prompt/i);
    }
  }
});

test('creative offers, contextual continuation, and memory remain distinct', () => {
  const {state,plans}=talk(['I like coffee','Tell me a joke','haha','yes','What do I like?']);
  assert.equal(plans[2].act,'social');
  assert.equal(plans[3].act,'joke');
  assert.notEqual(plans[1].text,plans[3].text);
  assert.deepEqual(scopes(plans[3]),['fiction']);
  assert.equal(state.memories.filter(memory=>memory.status==='active').length,1);
  assert.match(plans.at(-1).text,/You like coffee/);
  assert.ok(scopes(plans.at(-1)).includes('reported'));
});

test('scope and social or creative text cannot be altered while retaining a valid grammar proof', () => {
  for (const message of ['thanks','Tell me a joke','Give me a writing prompt']) {
    const {state,plans}=talk([message]);
    const altered=K.clone(plans[0]);altered.realizations[0].result.scope='reported';
    assert.throws(()=>dialogue.verifyPlan(state,altered),/scope|digest|realiz/i);
    const wording=K.clone(plans[0]);wording.text='You hate coffee. '+wording.text;
    assert.throws(()=>dialogue.verifyPlan(state,wording),/span|display|match/i);
  }
});

test('new generation preserves literal reasons and supports every persona and register', () => {
  for (const persona of ['warm','playful','thoughtful','direct']) for (const register of [-2000,0,2000]) {
    const {plans}=talk(['I like coffee because it helps me pause','How are you?','Tell me a joke','Give me a writing prompt'],persona,register);
    assert.ok(plans[0].text.includes('“it helps me pause”'));
    assert.ok(scopes(plans[0]).includes('reported'));
    assert.ok(scopes(plans[0]).includes('conversation'));
    assert.deepEqual(scopes(plans[2]),['fiction']);
    assert.deepEqual(scopes(plans[3]),['fiction']);
  }
});

test('refused subjects stay out of automatic recalls until explicitly reintroduced', () => {
  const {state,plans}=talk(['I like coffee','no thanks','nothing','thanks','Tell me about coffee']);
  for (const plan of plans.slice(2,4)) assert.doesNotMatch(plan.text,/coffee/i);
  assert.match(plans.at(-1).text,/coffee/i);
  assert.equal(state.memories.filter(memory=>memory.status==='active').length,1);
  assert.ok(!state.context.declinedTopics.includes('coffee'));
});

test('every generated social invitation links the next answer to its displayed question', () => {
  for (const message of ['I love you','Stay with me','thanks']) {
    const first=talk([message],'direct');
    const question=first.state.context.pending?.question;
    assert.ok(question,message);
    assert.ok(first.plans[0].text.endsWith(question),message);
    const continued=talk([message,'A small coding project'],'direct');
    assert.equal(continued.plans[1].policy.discourse.questionMessage,first.state.context.pending.questionMessage);
    assert.equal(continued.plans[1].interpretation.followUp.question,question);
  }
});

test('compound turns ask only the final conversational question and fiction offers none', () => {
  const conversational=talk(['My name is Élodie. How are you?']);
  assert.equal((conversational.plans[0].text.match(/\?/g)||[]).length,1);
  assert.ok(conversational.plans[0].text.endsWith(conversational.state.context.pending.question));
  const creative=talk(['I like coffee. How are you? Give me a writing prompt.']);
  assert.equal((creative.plans[0].text.match(/\?/g)||[]).length,0);
  assert.equal(creative.state.context.pending,null);
  assert.ok(scopes(creative.plans[0]).includes('fiction'));
  assert.ok(scopes(creative.plans[0]).includes('reported'));
});

test('creative continuation follows the final displayed act of a compound reply', () => {
  for (const [request,kind] of [['Tell me a joke','joke'],['Give me a writing prompt','prompt']]) {
    const {plans}=talk(['I like coffee. '+request+'.','another one','haha','yes']);
    assert.equal(plans[0].act,'preference');
    assert.equal(plans[1].act,kind);
    assert.equal(plans[3].act,kind);
    assert.deepEqual(scopes(plans[1]),['fiction']);
    assert.notEqual(plans[1].text,plans[3].text);
  }
});

test('answering a check-in advances to detail instead of repeating the check-in', () => {
  for (const message of ['I have been feeling tired lately','I am fine','I am happy']) {
    const {state,plans}=talk(['How are you?',message]);
    const first=plans[0].realizations.flatMap(span=>span.result.tree.type==='interaction'?K.Interaction.realize(span.result.tree).questions:[]).at(-1);
    assert.ok(first);
    assert.ok(state.context.pending?.question);
    assert.notEqual(state.context.pending.question,first);
    assert.doesNotMatch(plans[1].text,/How are you doing\?/);
  }
});
