'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {loadModel}=require('./helpers/load-model.cjs');

function runTurns(dialogue,K,texts,settings){
  let state=K.initialState(),seq=1;
  const events=[],replies=[];
  if(settings){
    const ev={seq:seq++,time:1762900000000+seq*1000,type:'settings',settings};
    events.push(ev);
    state=dialogue.step(state,ev).state;
  }
  for(const text of texts){
    const ev={seq:seq++,time:1762900000000+seq*1000,type:'message',text};
    events.push(ev);
    const out=dialogue.step(state,ev);
    state=out.state;
    replies.push({user:text,plan:out.plan,text:out.plan.text,state});
  }
  return {state,events,replies};
}

test('22-turn realistic casual conversation feels natural, remembers entities, shifts topics, plays games, and replays deterministically',()=>{
  const {K,dialogue}=loadModel();
  const turns=[
    'hey kira',
    'im exhausted honestly, work was chaotic today and my boss kept changing requirements',
    'yeah for real, im just chilling on the couch now with my dog Max',
    'he is a golden retriever and he snores really loud lol',
    'haha yeah',
    'anyway lately i been playing guitar to unwind',
    'i have a Fender Stratocaster and been playing for about 5 years',
    'mostly indie rock and jazz chord voicings',
    'do you like jazz?',
    'do you have any hobbies?',
    'what did i tell you earlier about my dog?',
    'i went to Japan last year and loved Kyoto',
    'had spicy ramen and street tacos for dinner too',
    'whats the difference between a stratocaster and a telecaster?',
    'tell me a riddle',
    'is it a shadow?',
    'a map',
    'tell me a short story',
    'should i learn Rust or Python?',
    'play would you rather',
    'definitely the first one, cozy autumn',
    'are you an llm?'
  ];

  const {state,events,replies}=runTurns(dialogue,K,turns);

  // Zero robotic brick walls or boilerplate social prefaces across the entire chat.
  const roboticRe=/my grammar is fairly small|I can’t answer that one|I can't answer that one|Understood\. You can choose the pace|Okay\. I can listen\./i;
  for(const r of replies){
    assert.doesNotMatch(r.text,roboticRe,`Robotic boilerplate leaked on "${r.user}": ${r.text}`);
    assert.ok(!r.text.includes('⟦')&&!r.text.includes('⟧'),`Unexpanded slot marker on "${r.user}": ${r.text}`);
  }

  // Reactions never echoed as noun-phrase topics.
  assert.doesNotMatch(replies[4].text,/about haha yeah/i);

  // Pronoun coreference merged golden retriever + snores onto Max and recalled accurately.
  const dogRecall=replies[10].text;
  assert.match(dogRecall,/Max/);
  assert.match(dogRecall,/golden retriever/i);
  assert.match(dogRecall,/snores/i);

  // Dinner & trip awareness reflected naturally.
  assert.match(replies[11].text,/Japan/i);
  assert.match(replies[12].text,/ramen|tacos/i);
  assert.doesNotMatch(replies[12].text,/about had spicy ramen/i);

  // Taste & hobbies questions answered warmly in-character without breaking direct LLM honesty later.
  assert.doesNotMatch(replies[8].text,/explicit rules|no hidden mind/i);
  assert.match(replies[9].text,/conversation|music|stories|riddles|reading/i);
  assert.match(replies[21].text,/fictional character/i);

  // Knowledge comparison, riddle flow, story, decision aid, and dilemma flow all land cleanly.
  assert.match(replies[13].text,/Stratocaster/i);
  assert.match(replies[13].text,/Telecaster/i);
  assert.match(replies[15].text,/Not quite|folded/i);
  assert.match(replies[16].text,/Nailed it|map/i);
  assert.match(replies[17].text,/lighthouse keeper|border collie|fig tree|watch/i);
  assert.match(replies[18].text,/Rust/);
  assert.match(replies[18].text,/Python/);
  assert.match(replies[20].text,/autumn|coffee/i);

  // Exact deterministic replay equivalence.
  const replayed=dialogue.replay(events);
  assert.equal(replayed.messages.length,state.messages.length);
  assert.equal(replayed.lastPlan.digest,state.lastPlan.digest);
});

test('apostrophe-less contractions preserve valid raw memory spans and expand natural replies',()=>{
  const {K,dialogue}=loadModel();
  const {state,replies}=runTurns(dialogue,K,[
    'im really drained tonight',
    'i dont like celery',
    'whats your favorite tea?'
  ]);
  const celeryMem=state.memories.find(m=>m.kind==='preference'&&m.object.label==='celery');
  assert.ok(celeryMem);
  assert.equal(replies[1].user.slice(celeryMem.span.start,celeryMem.span.end),'celery');
  assert.match(replies[0].text,/drained|hear you|honest/i);
  assert.match(replies[1].text,/You (?:do not|don’t) like celery\./);
  assert.match(replies[2].text,/Camellia|oolong|matcha|tea/i);
});

test('topic shifts cleanly from work to music when strong domain signals arrive, without losing incidental sports anchoring',()=>{
  const {K,dialogue}=loadModel();
  const workToMusic=runTurns(dialogue,K,[
    'work was intense all morning',
    'i have a Fender Stratocaster and play indie rock and jazz'
  ]);
  assert.equal(workToMusic.replies[1].plan.policy.topicSelection.topic,'music');

  const staySports=runTurns(dialogue,K,[
    'I like soccer',
    'Midfield mostly, I play with my friends on weekends'
  ]);
  assert.equal(staySports.replies[1].plan.policy.topicSelection.topic,'sports');
});

test('pure reactions never trigger focusPhrase parroting and distinct personas vary in voice',()=>{
  const {K,dialogue}=loadModel();
  for(const reaction of ['haha yeah','for sure','kind of','wait really?','oof']){
    const {replies}=runTurns(dialogue,K,['I like guitar',reaction]);
    assert.doesNotMatch(replies[1].text,new RegExp(`about ${reaction.replace(/[?]/g,'')}`,'i'));
  }

  const prompt=['do you have any hobbies?'];
  const warm=runTurns(dialogue,K,prompt,{persona:'warm'}).replies[0].text;
  const playful=runTurns(dialogue,K,prompt,{persona:'playful'}).replies[0].text;
  const thoughtful=runTurns(dialogue,K,prompt,{persona:'thoughtful'}).replies[0].text;
  const direct=runTurns(dialogue,K,prompt,{persona:'direct'}).replies[0].text;
  assert.equal(new Set([warm,playful,thoughtful,direct]).size,4);
});

test('episodic storage stays separate from verified state.memories and forgetting prunes matching entities',()=>{
  const {K,dialogue}=loadModel();
  const {state}=runTurns(dialogue,K,[
    'I am planning a trip to Japan',
    'My dog Max is a golden retriever',
    'Forget Max'
  ]);
  assert.equal(state.memories.length,0);
  assert.equal((state.context.entities||[]).filter(e=>/max/i.test(e.name)).length,0);

  const after=runTurns(dialogue,K,[
    'My dog Max is a golden retriever',
    'Forget Max',
    'What did I tell you about my dog?'
  ]);
  assert.doesNotMatch(after.replies[2].text,/golden retriever/i);
});

test('open-ended novel sentences never drop to my grammar is fairly small and respect paused questions',()=>{
  const {K,dialogue}=loadModel();
  const {replies}=runTurns(dialogue,K,[
    'I accidentally left my umbrella on the train before the storm rolled in.',
    'Stop asking questions',
    'Then my neighbor lent me an oversized yellow raincoat.'
  ]);
  assert.doesNotMatch(replies[0].text,/my grammar is fairly small|couldn’t read that/i);
  assert.doesNotMatch(replies[2].text,/\?/);
  assert.doesNotMatch(replies[2].text,/my grammar is fairly small/i);
});

test('game-dev single chat handles preambles, invitations, opinions, and contractions without knowledge hijacks or fallback loops',()=>{
  const {K,dialogue}=loadModel();
  assert.notEqual(K.focusPhrase('im working on a narrative engine for games'),'im working');
  assert.equal(K.focusPhrase('ok fair enough'),null);
  assert.equal(K.focusPhrase('thanks for the help'),null);

  const {state,events,replies}=runTurns(dialogue,K,[
    'hey',
    'im working on a narrative engine for games',
    'it is for an indie game im building',
    'what do you think about branching dialogue?',
    'do you want to hear about the characters?',
    'can you help me test a scene?',
    'anyway how are you doing?',
    'ok fair enough',
    'thanks for the help',
    'by the way, i love dark roast coffee',
    'anyway see you later'
  ]);

  assert.doesNotMatch(replies[1].text,/about im working|Switching gears/i);
  assert.doesNotMatch(replies[2].text,/Indie Rock/i);
  assert.doesNotMatch(replies[3].text,/version control|git/i);
  assert.match(replies[4].text,/characters/i);
  assert.match(replies[5].text,/setup|scene|test/i);
  assert.equal(replies[6].plan.act,'how');
  assert.equal(replies[7].plan.act,'social');
  assert.doesNotMatch(replies[7].text,/about ok fair enough|Okay\. I can listen/i);
  assert.equal(replies[8].plan.act,'thanks');
  assert.equal(replies[9].plan.act,'preference');
  const coffee=state.memories.find(m=>m.kind==='preference'&&m.object.label==='dark roast coffee');
  assert.ok(coffee);
  assert.equal(replies[9].user.slice(coffee.span.start,coffee.span.end),'dark roast coffee');
  assert.equal(replies[10].plan.act,'farewell');

  // Repeated novel prose turns must advance usage rather than looping verbatim.
  const loopCheck=runTurns(dialogue,K,[
    'The lighthouse signal lamp flickers every third wave.',
    'The brass telescope on the desk points toward the breakwater.',
    'An old ledger sits open beside the inkwell.'
  ]);
  assert.equal(new Set(loopCheck.replies.map(r=>r.text)).size,3);

  const replayed=dialogue.replay(events);
  assert.equal(replayed.lastPlan.digest,state.lastPlan.digest);
});
