'use strict';
// Pure Model: no DOM, storage, clock, randomness, network, or timers.
(function(K){
  const MAX_EVENTS=1000,MAX_IMAGE=450000;
  const stage=points=>points>=32?'Familiar company':points>=12?'Finding a rhythm':points>=4?'Getting acquainted':'A new conversation';
  function initialState(){return {schema:'kira-state/4.1',revision:0,turn:0,nextMemory:1,settings:{persona:'warm',register:-1000,theme:'night',boundary:'platonic',avatar:null},messages:[],memories:[],context:{focus:null,pending:null},usage:{},relationship:{points:0,seen:[]},lastPlan:null};}
  function describeMemory(m){
    if(m.kind==='name')return 'Your name is '+m.object.label;
    if(m.kind==='note')return m.object.label;
    if(m.kind==='mood')return 'You '+(m.temporal==='past'?'felt':'feel')+(m.polarity==='negative'?' not':'')+' '+m.object.label;
    const neg=m.polarity==='negative',past=m.temporal==='past';
    return 'You '+(past?(neg?'did not ':'used to '):(neg?'do not ':''))+m.predicate+' '+m.object.label;
  }
  function preferenceStance(frame){
    if(frame.kind!=='preference'||frame.temporal!=='present')return null;
    if(frame.polarity==='positive')return ['like','love','enjoy'].includes(frame.predicate)?'likes':['dislike','hate'].includes(frame.predicate)?'dislikes':null;
    return frame.predicate==='like'?'dislikes':null;
  }
  function conflictingPreferenceFrames(frames){
    for(let i=0;i<frames.length;i++)for(let j=i+1;j<frames.length;j++){
      const a=frames[i],b=frames[j],as=preferenceStance(a),bs=preferenceStance(b);
      if(a.kind==='preference'&&b.kind==='preference'&&a.temporal===b.temporal&&a.object.key===b.object.key&&
        (a.predicate===b.predicate&&a.polarity!==b.polarity||as&&bs&&as!==bs))return true;
    }
    return false;
  }
  function recordFrame(state,frame,sourceMessage,resolutionMessage){
    const stance=preferenceStance(frame);
    const current=state.memories.filter(m=>m.status==='active'&&m.kind===frame.kind&&m.temporal===frame.temporal&&
      (frame.kind==='name'||frame.kind==='mood'||m.object.key===frame.object.key&&(
        m.predicate===frame.predicate||stance&&preferenceStance(m)&&preferenceStance(m)!==stance)));
    const duplicate=current.find(m=>m.polarity===frame.polarity&&m.object.key===frame.object.key&&m.predicate===frame.predicate);
    if(duplicate)return {memory:duplicate,created:false};
    const id='memory:'+String(state.nextMemory++).padStart(5,'0'),supersedes=current.map(m=>m.id);
    state.memories=state.memories.map(m=>supersedes.includes(m.id)?{...m,status:'superseded',supersededBy:id}:m);
    const memory={...K.clone(frame),id,sourceMessage,resolutionMessage:resolutionMessage||null,turn:state.turn,status:'active',supersedes,supersededBy:null};
    state.memories.push(memory);return {memory,created:true};
  }
  const supportedImage=s=>typeof s==='string'&&s.length<=MAX_IMAGE&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(s);
  function validateEvent(state,e){
    K.assert(e&&e.seq===state.revision+1&&e.seq<=MAX_EVENTS,'Event sequence or session limit');
    K.assert(Number.isSafeInteger(e.time)&&e.time>=0&&e.time<=8640000000000000,'Explicit timestamp required');
    K.assert(['message','settings','retire','image','legacy'].includes(e.type),'Unknown event type');
    if(e.type==='message')K.assert(typeof e.text==='string'&&e.text.trim().length&&e.text.length<=2000,'Message must contain 1–2000 characters');
    if(e.type==='settings'){
      const s=e.settings;K.assert(s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).every(k=>['persona','register','theme','avatar','boundary'].includes(k)),'Unknown setting');
      if(s.persona!==undefined)K.assert(typeof s.persona==='string'&&Object.hasOwn(K.DIALOGUE.personas,s.persona),'Unknown persona');
      if(s.register!==undefined)K.assert(Number.isInteger(s.register)&&s.register>=-2000&&s.register<=2000,'Invalid register');
      if(s.theme!==undefined)K.assert(['night','dawn'].includes(s.theme),'Invalid theme');
      if(s.boundary!==undefined)K.assert(['platonic','flirty'].includes(s.boundary),'Invalid boundary');
      if(s.avatar!==undefined&&s.avatar!==null)K.assert(supportedImage(s.avatar),'Invalid avatar image');
    }
    if(e.type==='image')K.assert(supportedImage(e.data),'Invalid or oversized image');
    if(e.type==='retire')K.assert(typeof e.memoryId==='string'&&state.memories.some(m=>m.id===e.memoryId&&m.status==='active'),'Memory is not active');
    if(e.type==='legacy')K.assert(Array.isArray(e.messages)&&e.messages.length<=200&&e.messages.every(m=>['you','her','user','assistant'].includes(m.role)&&typeof m.text==='string'&&m.text.length<=4000),'Invalid legacy archive');
  }
  function choose(state,name,persona){
    const items=K.DIALOGUE.responses[name];K.assert(items?.length,'Missing response family '+name);
    const personalized=items.filter(t=>t.personas?.includes(persona));let pool=personalized.length?personalized:items;if(name==='affection')pool=[items[persona==='warm'||persona==='playful'?1:0]];
    const ranked=pool.slice().sort((a,b)=>(state.usage[a.id]||0)-(state.usage[b.id]||0)||K.cmp(a.id,b.id)),selected=ranked[0];
    state.usage[selected.id]=(state.usage[selected.id]||0)+1;
    return {id:selected.id,text:selected.text,selection:{kind:'dialogue_policy',rule:'least used template, then stable ID',candidates:pool.map(x=>x.id).sort(K.cmp),chosen:selected.id}};
  }
  class DialogueModel{
    constructor(engine,meta){this.engine=engine;this.meta=meta;}
    step(previous,event){
      validateEvent(previous,event);
      const state={...previous,revision:event.seq,settings:{...previous.settings},messages:previous.messages.slice(),memories:previous.memories.slice(),context:K.clone(previous.context),usage:{...previous.usage},relationship:{points:previous.relationship.points,seen:previous.relationship.seen.slice()}};
      if(event.type==='settings'){Object.assign(state.settings,event.settings);return {state,plan:null};}
      if(event.type==='retire'){
        state.memories=state.memories.map(m=>m.id===event.memoryId?{...m,status:'retired',retiredAt:event.seq}:m);
        const old=previous.memories.find(m=>m.id===event.memoryId);if(state.context.focus?.object.key===old.object.key)state.context.focus=null;
        return {state,plan:null};
      }
      if(event.type==='legacy'){
        for(let i=0;i<event.messages.length;i++){const m=event.messages[i];state.messages.push({id:'legacy:'+event.seq+':'+i,role:['you','user'].includes(m.role)?'user':'assistant',text:K.nfc(m.text),time:event.time,turn:0,legacy:true});}
        return {state,plan:null};
      }
      state.turn++;
      const uid='user:'+event.seq,aid='kira:'+event.seq;
      if(event.type==='image'){
        state.messages.push({id:uid,role:'user',text:'Shared an image',image:event.data,time:event.time,turn:state.turn});
        const plan={id:'plan:image',act:'acknowledge_image',claims:[],semantics:[],slots:[],policy:{kind:'dialogue_policy',rule:'Image bytes are opaque'},text:'I can keep this image in our chat, but I can’t see or interpret what it shows. Tell me what you’d like me to know about it.'};
        state.messages.push({id:aid,role:'assistant',text:plan.text,time:event.time,turn:state.turn,plan});state.lastPlan=plan;return {state,plan};
      }
      let parsed=K.parseConversation(event.text,previous,this.engine);
      if(conflictingPreferenceFrames(parsed.frames))parsed={...parsed,intent:'c:clarify',speechAct:'clarification',frames:[],supported:false,reasonCode:'conflicting_reports',reason:'Those reports conflict. Please send the current preference on its own so I can remember it correctly.'};
      state.messages.push({id:uid,role:'user',text:parsed.text,time:event.time,turn:state.turn});
      const routing=this.engine.query({op:'route',intent:parsed.intent,artifactHash:this.engine.a.hash});
      K.assert(routing.outcome==='Computed','Dialogue intent was not admitted');
      const intent=routing.value.pick.slice('handler:'.length),persona=state.settings.persona;
      const plan={id:'plan:'+event.seq,act:intent,claims:[],semantics:[routing],slots:[],policy:{kind:'dialogue_policy',handler:routing.value.pick,persona,relationshipStage:stage(state.relationship.points),boundary:state.settings.boundary},interpretation:parsed,text:''};
      const claims=memories=>{for(const m of memories)plan.claims.push({kind:'attribution',memoryId:m.id,sourceMessage:m.sourceMessage,predicate:m.predicate,objectKey:m.object.key,polarity:m.polarity,temporal:m.temporal});};
      const applyFrames=()=>{
        const added=parsed.frames.map(f=>recordFrame(state,f,parsed.sourceMessage||uid,parsed.resolvedPending||parsed.confirmedName?uid:null));claims(added.map(x=>x.memory));
        const last=added[added.length-1]?.memory;if(last?.kind==='preference')state.context.focus={object:K.clone(last.object),turn:state.turn,sourceMessage:last.sourceMessage};
        return added;
      };
      const generic=name=>{const t=choose(state,name,persona);plan.policy.template=t.selection;return t.text;};
      const meaningChoices=ids=>ids.map(id=>{const c=this.engine.concepts.get(id);return {id,label:c.label,aliases:c.aliases.filter(alias=>{const found=this.engine.lookup(alias);return found.length===1&&found[0]===id;})};});
      const ask=(topic,step,question)=>{const q=question||K.nextConversationQuestion(topic,step);state.context.pending={kind:'detail',topic:topic||'general',step,question:q,questionMessage:aid};return q;};
      const askLastQuestion=(topic,step)=>{const match=plan.text.match(/(?:^|[.!?]\s+)([^.!?]*\?)\s*$/u);K.assert(match,'Support reply must end in a question');return ask(topic,step,match[1]);};
      const discourse=(text,questionMessage)=>{plan.policy.discourse={kind:'quoted_conversation',sourceMessage:uid,questionMessage:questionMessage||null,text};state.context.thread=(state.context.thread||[]).concat({sourceMessage:uid,questionMessage:questionMessage||null,text}).slice(-8);};
      state.context.pending=null;
      switch(intent){
        case 'name':case 'preference':case 'mood':case 'note':{
          const records=applyFrames(),first=records[0]?.memory;
          if(!first){plan.text='What would you like me to remember?';break;}
          if(records.length>1)plan.text='I’ve kept those reports separately:\n'+records.map(r=>'• '+describeMemory(r.memory)+'.').join('\n')+'\n'+ask('general',0,'Which would you like to talk about first?');
          else if(first.kind==='name')plan.text=(parsed.nameConfirmation?'Yes—'+first.object.label+'.':records[0].created?(first.supersedes.length?'Got it, '+first.object.label+'. I’ve corrected your name.':'Hi, '+first.object.label+'. It’s good to meet you.'):first.object.label+'—I have your name saved.')+' '+ask('general',0,'What have you been spending time on lately?');
          else if(first.kind==='note')plan.text='I’ve kept that as a note you gave me: “'+first.object.label+'”';
          else if(first.kind==='mood'){
            if(first.polarity==='negative')plan.text='You said you '+(first.temporal==='past'?'weren’t':'aren’t')+' '+first.object.label+'. I won’t assume a different feeling from that. '+ask('general',0,'How would you describe it?');
            else if(parsed.negativeMood){plan.text=(persona==='direct'?'You said you feel '+first.object.label+'. ':'I hear you—you said you feel '+first.object.label+'. ')+generic('support');askLastQuestion('support',0);}
            else plan.text='You said you '+(first.temporal==='past'?'felt':'feel')+' '+first.object.label+'. '+ask('general',0,'What’s been behind that?');
          }else{
            const changed=first.supersedes.length>0,past=first.temporal==='past';
            plan.text=(changed?'I’ve updated that. ':records[0].created?'I’ll remember that. ':'I have that saved already. ')+describeMemory(first)+'.';
            if(!past&&first.polarity==='positive'&&records[0].created){const topic=this.engine.topicFor(first.object.concept)||K.conversationTopic(first.object.label,this.engine)||'general',averse=['hate','dislike'].includes(first.predicate);plan.text+=' '+ask(topic,0,averse?'What puts you off '+first.object.label+'?':K.DIALOGUE.topics['c:'+topic]?.[0]||'What draws you to '+first.object.label+'?');}
            if(past)plan.text+=' I won’t assume that is still your preference now.';
          }
          break;
        }
        case 'recall':{
          let records=state.memories.filter(m=>m.status==='active');
          if(parsed.nameOnly)records=records.filter(m=>m.kind==='name');
          else if(parsed.preferencesOnly)records=records.filter(m=>m.kind==='preference'&&m.temporal==='present');
          else if(parsed.object)records=records.filter(m=>m.kind==='preference'&&m.object.key===parsed.object.key&&m.temporal==='present');
          records=records.slice(-12);claims(records);
          plan.text=records.length?'Here’s what you’ve told me:\n'+records.map(m=>'• '+describeMemory(m)+' — turn '+m.turn+'.').join('\n'):'I don’t have that saved. You can tell me now if you want to.';
          if(records.length===1&&records[0].kind==='preference')state.context.focus={object:K.clone(records[0].object),turn:state.turn,sourceMessage:records[0].sourceMessage};
          break;
        }
        case 'forget':{
          const records=state.memories.filter(m=>m.status==='active'&&(m.object.key===parsed.object.key||K.fold(m.object.label)===K.fold(parsed.object.label)));
          const ids=records.map(m=>m.id);state.memories=state.memories.map(m=>ids.includes(m.id)?{...m,status:'retired',retiredAt:event.seq}:m);
          if(records.length)state.context.focus=null;
          plan.text=records.length?'I’ll stop using '+(records.length===1?'that memory':'those memories')+'. The original messages and retired records remain in the history; “Reset conversation” removes this app’s saved session.':'I don’t have an active memory matching that.';
          plan.policy.retired=ids;break;
        }
        case 'clarify':{
          if(parsed.ambiguity){const f=parsed.ambiguity,choices=meaningChoices(f.object.candidates);state.context.pending={kind:'sense',frame:f,frames:parsed.candidateFrames,sourceMessage:parsed.sourceMessage||uid,choices};plan.text='When you say “'+f.object.label+'”, which meaning do you have in mind?\n'+choices.map((c,i)=>(i+1)+'. '+c.label).join('\n')+'\nI haven’t saved this message’s reports yet.';}
          else if(parsed.semanticAmbiguity){const {slot,draft,candidates}=parsed.semanticAmbiguity,choices=meaningChoices(candidates);state.context.pending={kind:'semanticSense',slot,draft,choices};plan.text='Which meaning should I use for that question?\n'+choices.map((c,i)=>(i+1)+'. '+c.label).join('\n');}
          else if(parsed.nameCandidate){plan.text='Should I call you '+parsed.nameCandidate+'?';state.context.pending={kind:'confirmName',name:parsed.nameCandidate,span:parsed.nameSpan,sourceMessage:uid,questionMessage:aid};}
          else if(parsed.askName){plan.text=parsed.reason;state.context.pending={kind:'name',questionMessage:aid};}
          else if(parsed.repair){plan.text='You’re right to call that out. I lost the thread. What part of your last message should we pick up?';ask('repair',0,'What part of your last message should we pick up?');}
          else if(parsed.reasonCode==='unparsed'&&previous.context.pending?.choices){state.context.pending=K.clone(previous.context.pending);plan.text='I still need a meaning choice. Please use its name or number:\n'+state.context.pending.choices.map((c,i)=>(i+1)+'. '+c.label).join('\n');}
          else if(parsed.reasonCode==='unparsed'){
            const misses=(previous.context.misses||0)+1;state.context.misses=misses;
            const name=state.memories.find(m=>m.kind==='name'&&m.status==='active');
            if(!name&&K.isConversationName(parsed.text)&&/^\p{Lu}/u.test(parsed.text)){plan.text='Is “'+parsed.text+'” the name you’d like me to use? Please say “My name is '+parsed.text+'” to confirm.';state.context.pending={kind:'name',questionMessage:aid};}
            else{plan.text=misses===1?'I lost the thread there. '+ask('general',0,'What would you like me to know about that?'):'I’m still missing the meaning, and repeating the same answer won’t help. We can keep it as a note with “Remember this: …”, or start with one thing you want to talk about.';}
          }else plan.text=parsed.reason;
          break;
        }
        case 'semantic':{
          if(parsed.definition){const info=this.engine.lexicon({id:parsed.definition});plan.semantics.push(...info.parents.map(p=>p.evidence),...info.children.slice(0,4).map(c=>this.engine.query({op:'subsumes',a:c.id,b:info.entry.id})));plan.text=info.parents.length?'In this lexicon, '+info.entry.label+' is a kind of '+info.parents.map(p=>p.label).join(' and ')+'.':'That is a root concept in this lexicon.';if(info.children.length)plan.text+=' Listed subtypes include '+info.children.slice(0,4).map(c=>c.label).join(', ')+'.';plan.policy.definition={concept:info.entry.id,scope:'curated taxonomy, not a general encyclopedia'};break;}
          const answer=this.engine.query(parsed.query);plan.semantics.push(answer);
          if(parsed.query.op==='shift')plan.text=answer.outcome==='Computed'?'Within the same curated meaning, I’d choose “'+this.engine.a.senses.find(s=>s.id===answer.value.chosen).lemma+'”.':'There’s a lexical gap: my approved candidates don’t move in that direction.';
          else{const names=[parsed.query.a,parsed.query.b].map(id=>this.engine.a.concepts.find(c=>c.id===id).label);plan.text=answer.outcome==='Yes'?'Yes. In the bundled ontology, '+names[0]+' is a kind of '+names[1]+'.':answer.outcome==='No'?'No. The bundled ontology explicitly treats '+names[0]+' and '+names[1]+' as disjoint.':'Unknown. The bundled ontology proves neither that relationship nor its disjointness.';}
          break;
        }
        case 'topic':{
          if(parsed.followUp||parsed.activity){
            const f=parsed.followUp,answer=f?f.answer:parsed.activity,cue=K.conversationTopic(answer,this.engine),topic=cue||f?.topic||'general',step=f?(cue&&cue!==f.topic?0:f.step+1):0;
            discourse(answer,f?.questionMessage);plan.policy.topicSelection={rule:'lexical cue for question selection only',topic};
            if(/^(?:no|nope|not really)[.!]*$/i.test(answer)){plan.text='That’s fine. '+ask('general',0,'What would you rather talk about?');}
            else if(/^(?:yes|yeah|yep|sure|okay|ok)[.!]*$/i.test(answer)){plan.text='Go ahead. '+ask(topic,step,topic==='support'?'What happened?':'Which part would you like to start with?');}
            else{const openings=persona==='direct'?['You said: “','On “','To follow up on “']:['Let’s stay with “','Picking up on “','You mentioned “'];plan.text=openings[(state.turn-1)%openings.length]+answer.slice(0,240)+(answer.length>240?'…':'')+'”—'+ask(topic,step);}
            break;
          }
          const o=parsed.object,topic=this.engine.topicFor(o.concept),lines=K.DIALOGUE.topics['c:'+topic];
          if(o.candidates.length>1){const choices=meaningChoices(o.candidates);state.context.pending={kind:'topicSense',choices};plan.text='Which meaning would you like to talk about?\n'+choices.map((c,i)=>(i+1)+'. '+c.label).join('\n');}
          else if(lines){const count=state.usage['topic:'+o.key]||0;plan.text=lines[count%lines.length];state.usage['topic:'+o.key]=count+1;}
          else plan.text='I don’t have a prepared discussion of “'+o.label+'”. What interests you about it?';
          state.context.focus={object:K.clone(o),turn:state.turn,sourceMessage:uid};if(o.candidates.length<=1)ask(topic||'general',0,plan.text);break;
        }
        case 'boundary':state.settings.boundary=parsed.value;plan.text=parsed.value==='platonic'?'Of course. I’ll keep the conversation platonic.':'A little fictional flirting is fine. You can say “stop flirting” whenever you want.';break;
        case 'why':{
          const last=previous.lastPlan;plan.text=last?'I read your previous message as “'+last.act+'”. '+(last.claims.length?'The reply referred to '+last.claims.length+' attributed record'+(last.claims.length===1?'':'s')+'. ':'It made no claim from your memory. ')+'The semantic checker verified the handler’s eligibility; the wording was selected by dialogue policy. You can inspect the previous reply for the exact records and checks.':'There isn’t a previous reply to explain yet.';break;
        }
        case 'support':plan.text=parsed.answer==='no'?'That’s okay. We could try a joke or a writing prompt, or leave it there.':generic('support');if(parsed.answer!=='no')askLastQuestion('support',0);break;
        case 'affection':plan.text=generic(state.settings.boundary==='flirty'&&state.relationship.points>=4?'flirt':'affection');break;
        case 'greet':{
          const r=this.engine.query({op:'realize',c:'c:greeting-word',target:[state.settings.register,0]});plan.semantics.push(r);plan.slots.push({concept:'c:greeting-word',sense:r.value.chosen,type:'speech-act',context:'extensional'});
          const word=this.engine.a.senses.find(s=>s.id===r.value.chosen).lemma,name=state.memories.find(m=>m.kind==='name'&&m.status==='active');
          if(name){claims([name]);plan.text=word[0].toUpperCase()+word.slice(1)+', '+name.object.label+'. '+ask('general',0,'What’s on your mind?');}
          else{plan.text=generic('greet').replace('{greeting}',word[0].toUpperCase()+word.slice(1))+' What should I call you?';state.context.pending={kind:'name',questionMessage:aid};}break;
        }
        default:plan.text=generic(K.DIALOGUE.responses[intent]?intent:'about');
      }
      if(parsed.elaboration){discourse(parsed.elaboration);plan.text=plan.text.replace(/\s+[^.!?]*\?$/,'')+' You gave this reason: “'+parsed.elaboration+'”. '+ask(K.conversationTopic(parsed.text,this.engine)||'general',1);}
      for(const act of parsed.afterActs||[]){const r=this.engine.query({op:'route',intent:act.intent});K.assert(r.outcome==='Computed','Secondary act was not admitted');plan.semantics.push(r);const kind=act.intent.slice(2);plan.text+='\n\n'+generic(kind);plan.policy.secondaryActs=(plan.policy.secondaryActs||[]).concat(kind);state.context.pending=null;}
      if(['how','about'].includes(intent)||(parsed.afterActs||[]).some(a=>a.intent==='c:how'))ask('general',0,'How are you doing?');
      if(parsed.supported)state.context.misses=0;
      if(parsed.supported&&intent!=='crisis'){
        const fingerprint=K.hash(K.fold(parsed.text));if(!state.relationship.seen.includes(fingerprint)){state.relationship.seen.push(fingerprint);state.relationship.points=Math.min(100,state.relationship.points+1);}
      }
      this.verifyPlan(state,plan);
      plan.digest=K.hash({id:plan.id,act:plan.act,text:plan.text,claims:plan.claims,semantics:plan.semantics.map(s=>s.digest),slots:plan.slots,policy:plan.policy,interpretation:plan.interpretation});
      state.messages.push({id:aid,role:'assistant',text:plan.text,time:event.time,turn:state.turn,plan});state.lastPlan=plan;
      return {state,plan};
    }
    verifyPlan(state,plan){
      K.assert(typeof plan.text==='string'&&plan.text.length>0,'Empty reply plan');
      for(const c of plan.claims){const m=state.memories.find(m=>m.id===c.memoryId);K.assert(m&&m.status==='active'&&m.sourceMessage===c.sourceMessage&&m.predicate===c.predicate&&m.object.key===c.objectKey&&m.polarity===c.polarity&&m.temporal===c.temporal,'Ungrounded attributed claim');K.assert(state.messages.some(x=>x.id===m.sourceMessage&&x.role==='user'&&!x.legacy),'Missing source message');}
      for(const s of plan.slots)K.assert(s.context==='extensional'&&this.engine.a.senses.some(x=>x.id===s.sense&&x.cid===s.concept),'Slot violated its fiber constraint');
      for(const r of plan.semantics)K.assert(r.checked===true,'Unverified semantic result');
      if(plan.policy.discourse){const d=plan.policy.discourse,source=state.messages.find(m=>m.id===d.sourceMessage);K.assert(source?.role==='user'&&source.text.includes(d.text),'Missing quoted conversational source');if(d.questionMessage)K.assert(state.messages.some(m=>m.id===d.questionMessage&&m.role==='assistant'),'Missing conversational question');}
    }
    replay(events){K.assert(Array.isArray(events)&&events.length<=MAX_EVENTS,'Event log limit');let state=initialState();for(const e of events)state=this.step(state,e).state;return state;}
  }
  Object.assign(K,{DialogueModel,initialState,describeMemory,relationshipStage:stage,validateEvent,MAX_EVENTS,supportedImage});
})(Kira);

Kira.APP_META={"version":"4.1.3","artifactHash":"cd2a42985526286ce664ec04492ed59dbedb09d2957df1160c54cebe0e373128","modelHash":"ec50d3b01c3b7be5913765c046c71125628496326d88e0266874385c78d3a8ce","unicode":"15.0.0","profile":"EXPERIMENTAL"};
