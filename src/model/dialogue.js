'use strict';
// Pure Model: no DOM, storage, clock, randomness, network, or timers.
(function(K){
  const MAX_EVENTS=1000,MAX_IMAGE=450000;
  const upbeat=new Set(['happy','glad','excited','calm','good','great','well','relaxed','content','okay','ok','fine','alright']);
  const actLabels={name:'you telling me your name',preference:'a preference you shared',mood:'you telling me how you feel',note:'a note to keep',recall:'a question about what you’ve told me',forget:'a request to forget something',clarify:'something I couldn’t read confidently',semantic:'a question about what a word means',topic:'part of our ongoing conversation',greet:'a greeting',farewell:'a goodbye',how:'a check-in',about:'a question about me',thanks:'a thank-you',joke:'a request for a joke',prompt:'a request for a writing prompt',support:'a sign that things are hard right now',social:'a quick reaction',affection:'something kind',boundary:'a boundary for our conversation',stay:'a request to keep talking',why:'a question about my last reply'};
  const stage=points=>points>=32?'Familiar company':points>=12?'Finding a rhythm':points>=4?'Getting acquainted':'A new conversation';
  function initialState(){return {schema:'kira-state/4.1',revision:0,turn:0,nextMemory:1,settings:{persona:'warm',register:-1000,theme:'night',boundary:'platonic',avatar:null},messages:[],memories:[],context:{focus:null,pending:null},usage:{},relationship:{points:0,seen:[]},lastPlan:null};}
  const describeMemory=m=>K.Realization.describe(m);
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
  function exclusiveReportFrames(frames){
    return frames.some((a,i)=>['name','mood'].includes(a.kind)&&frames.slice(i+1).some(b=>
      a.kind===b.kind&&a.temporal===b.temporal&&(a.object.key!==b.object.key||a.polarity!==b.polarity)));
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
    constructor(engine,meta){this.engine=engine;this.meta=meta;this.field=new K.RingField(engine);}
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
      let parsed=K.parseConversation(K.stripVariantMarks(event.text),previous,this.engine);
      if(conflictingPreferenceFrames(parsed.frames))parsed={...parsed,intent:'c:clarify',speechAct:'clarification',frames:[],supported:false,reasonCode:'conflicting_reports',reason:'Those reports conflict. Please send the current preference on its own so I can remember it correctly.'};
      else if(exclusiveReportFrames(parsed.frames))parsed={...parsed,intent:'c:clarify',speechAct:'clarification',frames:[],supported:false,reasonCode:'exclusive_reports',reason:'I can keep one name or feeling report for each time period. Please send those reports separately. I haven’t saved any part of that message.'};
      state.messages.push({id:uid,role:'user',text:parsed.text,time:event.time,turn:state.turn});
      const routing=this.engine.query({op:'route',intent:parsed.intent,artifactHash:this.engine.a.hash});
      K.assert(routing.outcome==='Computed','Dialogue intent was not admitted');
      const intent=routing.value.pick.slice('handler:'.length),persona=state.settings.persona;
      const plan={id:'plan:'+event.seq,act:intent,claims:[],semantics:[routing],slots:[],realizations:[],policy:{kind:'dialogue_policy',handler:routing.value.pick,persona,relationshipStage:stage(state.relationship.points),boundary:state.settings.boundary},interpretation:parsed,text:''};
      const generated=[];
      let elaborating=false,allowQuestions=!(parsed.afterActs?.length);
      const generate=tree=>{
        const result=K.Realization.realize(tree,{memories:state.memories});
        generated.push(result);return result.text;
      };
      const report=m=>K.Realization.memory(m);
      const reports=memories=>memories.length===1?report(memories[0]):K.Realization.coordinate(memories.map(report));
      const claims=memories=>{for(const m of memories)plan.claims.push({kind:'attribution',memoryId:m.id,sourceMessage:m.sourceMessage,predicate:m.predicate,objectKey:m.object.key,polarity:m.polarity,temporal:m.temporal});};
      const applyFrames=()=>{
        const seen=new Set(),added=parsed.frames.map(f=>recordFrame(state,f,parsed.sourceMessage||uid,parsed.resolvedPending||parsed.confirmedName?uid:null)).filter(r=>{if(seen.has(r.memory.id))return false;seen.add(r.memory.id);return true;});claims(added.map(x=>x.memory));
        const last=added[added.length-1]?.memory;if(last?.kind==='preference')state.context.focus={object:K.clone(last.object),turn:state.turn,sourceMessage:last.sourceMessage};
        return added;
      };
      const withoutFinalQuestion=text=>{const match=text.match(/(?:^|[.!?]\s+)([^.!?]*\?)\s*$/u);return match?text.slice(0,text.lastIndexOf(match[1])).trim():text;};
      const interact=(kind,options={})=>{
        const key='interaction:'+kind,index=state.usage[key]||0;state.usage[key]=index+1;
        return generate(K.Interaction.plan(kind,{persona,register:state.settings.register,index,questionsPaused:state.context.questionsPaused||parsed.elaboration&&!elaborating||!allowQuestions,...options}));
      };
      const generic=(name,options={})=>{
        if(['joke','prompt'].includes(name)){
          const key='creative:'+name,index=state.usage[key]||0;state.usage[key]=index+1;
          plan.policy.creative={kind:name,index,scope:'fiction'};
          return generate(K.Realization.creative(K.Creative.plan(name,{index,persona,register:state.settings.register})));
        }
        if(K.Interaction.kinds.includes(name))return interact(name,options);
        const t=choose(state,name,persona);plan.policy.template=t.selection;
        return state.context.questionsPaused&&!['crisis','joke','prompt'].includes(name)?withoutFinalQuestion(t.text)||'I’m listening.':t.text;
      };
      const meaningChoices=ids=>ids.map(id=>{const c=this.engine.concepts.get(id);return {id,label:c.label,aliases:c.aliases.filter(alias=>{const found=this.engine.lookup(alias);return found.length===1&&found[0]===id;})};});
      const ask=(topic,step,question,answer,asked,stance,opening=false)=>{
        if(state.context.questionsPaused||parsed.elaboration&&!elaborating||!allowQuestions)return '';
        // Questions already asked in a topic stay remembered across topic switches, so a ladder never repeats itself.
        const field=state.context.field,seen=(asked||[]).concat(field?.askedBy?.[topic]||[]);
        stance=stance||(previous.context.pending?.topic===topic?previous.context.pending.stance:null)||'neutral';
        let q=question;
        if(q&&typeof q==='object'){
          const key='question-purpose:'+q.purpose,index=state.usage[key]||0;state.usage[key]=index+1;
          q=generate(K.Interaction.plan('question',{question:q.purpose,label:q.label,topic:topic||'general',index,persona,register:state.settings.register}));
          plan.policy.questionOrigin='compositional';
        }
        if(!q){
          const pack=K.THEME_PACKS?.[topic],phrase=K.focusPhrase(answer);
          const opener=opening&&stance==='neutral'?pack?.open.find(text=>!seen.includes(text)):null;
          const tailored=stance==='neutral'?(pack?.cue||[]).find(([source,text])=>typeof answer==='string'&&new RegExp(source,'i').test(answer)&&!seen.includes(text)):null;
          const extension=stance==='neutral'&&step>=8?pack?.ask.find(text=>!seen.includes(text)):null;
          const phraseQuestion=stance==='neutral'&&step>=2&&step%3===2&&phrase?pack?.phrase.map(text=>text.split('{p}').join(phrase)).find(text=>!seen.includes(text)):null;
          if(opener){q=opener;plan.policy.questionOrigin='authored_theme';}
          else if(tailored){q=tailored[1];plan.policy.questionOrigin='authored_cue';}
          else if(extension||phraseQuestion){q=extension||phraseQuestion;plan.policy.questionOrigin='authored_theme';}
          else{
            const key='question:'+topic,index=state.usage[key]||0;let tree;
            for(let offset=0;offset<64;offset++){
              tree=K.Interaction.plan('topic',{topic:topic||'general',label:K.focusPhrase(answer)||undefined,persona,register:state.settings.register,index:index+offset,answer,stance});
              const candidate=K.Interaction.realize(tree).text;
              if(!seen.includes(candidate)||offset===63){state.usage[key]=index+offset+1;break;}
            }
            q=generate(tree);plan.policy.questionOrigin='compositional';
          }
        }
        state.context.pending={kind:'detail',topic:topic||'general',stance,step,question:q,questionMessage:aid,asked:(asked||[]).concat(q).slice(-12)};
        if(field){const by=field.askedBy,key=topic||'general';by[key]=(by[key]||[]).concat(q).slice(-8);const keys=Object.keys(by);if(keys.length>12)delete by[keys[0]];}
        return q;
      };
      // A returning-conversation hook: the least-recalled positive preference, grounded as a claim.
      const memoryTopic=m=>(m.object.concept&&this.engine.topicFor(m.object.concept))||K.conversationTopic(m.object.label,this.engine)||'general';
      const recallHook=()=>{
        const prefs=state.memories.filter(m=>m.status==='active'&&m.kind==='preference'&&m.polarity==='positive'&&m.temporal==='present'&&['like','love','enjoy'].includes(m.predicate)&&!(state.context.declinedTopics||[]).includes(memoryTopic(m)));
        if(!prefs.length)return null;
        const m=prefs.slice().sort((a,b)=>(state.usage['recall:'+a.id]||0)-(state.usage['recall:'+b.id]||0)||K.cmp(a.id,b.id))[0],n=state.usage['recall:'+m.id]||0;
        state.usage['recall:'+m.id]=n+1;claims([m]);
        const topic=memoryTopic(m);
        return {text:generate(K.Realization.attributed(report(m))),topic};
      };
      const askLastQuestion=(topic,step)=>{
        if(state.context.questionsPaused||parsed.elaboration&&!elaborating||!allowQuestions)return '';
        for(const result of generated.slice().reverse())if(result.tree.type==='interaction'){
          const question=K.Interaction.realize(result.tree).questions.at(-1);
          if(question&&plan.text.endsWith(question))return ask(topic,step,question);
        }
        const match=plan.text.match(/(?:^|[.!?]\s+)([^.!?]*\?)\s*$/u);K.assert(match,'Reply must end in a question');return ask(topic,step,match[1]);
      };
      const discourse=(text,questionMessage)=>{plan.policy.discourse={kind:'quoted_conversation',sourceMessage:uid,questionMessage:questionMessage||null,text};state.context.thread=(state.context.thread||[]).concat({sourceMessage:uid,questionMessage:questionMessage||null,text}).slice(-8);};
      state.context.pending=null;
      // Where this message lands in the ring field; the field also decides how a topic thread continues.
      const prevField=previous.context.field,hits=K.conversationTopics(parsed.text,this.engine);
      for(const t of this.field.resolve(parsed.text,prevField))if(!hits.includes(t))hits.push(t);
      state.context.field=this.field.advance(prevField,hits,state.turn);
      if(parsed.supported&&!['social','greet','thanks','how','about','stay','joke','prompt'].includes(intent))state.context.declinedTopics=(state.context.declinedTopics||[]).filter(topic=>!hits.includes(topic));
      switch(intent){
        case 'name':case 'preference':case 'mood':case 'note':{
          const records=applyFrames(),first=records[0]?.memory;
          if(!first){plan.text='What would you like me to remember?';break;}
          if(records.length>1)plan.text=generate(reports(records.map(r=>r.memory)))+' '+ask('general',0,{purpose:'start'});
          else if(first.kind==='name')plan.text=generate(report(first))+' '+(records[0].created?(first.supersedes.length?'I’ve corrected your name.':'It’s good to meet you.'):'I have your name saved.')+' '+ask('general',0,{purpose:'check_in'});
          else if(first.kind==='note')plan.text=generate(report(first));
          else if(first.kind==='mood'){
            const statement=generate(K.Realization.attributed(report(first)));
            if(first.polarity==='negative')plan.text=statement+' I won’t assume a different feeling from that. '+ask('general',0,{purpose:'detail'});
            else if(parsed.negativeMood&&['tired','exhausted'].includes(first.object.label)&&first.temporal==='present')plan.text=statement+' '+ask('support',1,{purpose:'detail'});
            else if(parsed.negativeMood){plan.text=statement+' '+generic('support');askLastQuestion('support',0);}
            else if(first.temporal==='present'&&upbeat.has(first.object.label))plan.text=statement+' '+ask('general',0,{purpose:'detail'});
            else plan.text=statement+' '+ask('general',0,{purpose:first.object.label==='bored'?'alternative':'detail'});
          }else{
            const changed=records[0].created&&first.supersedes.length>0,past=first.temporal==='past';
            const before=changed?state.memories.find(m=>m.id===first.supersedes.at(-1)):null;
            const tree=before&&before.temporal==='present'&&!past&&before.object.key===first.object.key&&before.object.label===first.object.label?K.Realization.correction(report(before),report(first)):report(first);
            plan.text=(changed?'⟦@updated⟧. ':records[0].created?'⟦@remember⟧. ':'⟦@saved⟧. ')+generate(tree);
            if(!past&&first.polarity==='positive'&&records[0].created){
              const topic=this.engine.topicFor(first.object.concept)||K.conversationTopic(first.object.label,this.engine)||'general';
              plan.text+=' '+ask(topic,0,undefined,first.object.label,[],['hate','dislike'].includes(first.predicate)?'averse':'neutral',true);
            }
            if(past)plan.text+=' I won’t assume that is still your preference now.';
          }
          break;
        }
        case 'recall':{
          let records=state.memories.filter(m=>m.status==='active');
          if(parsed.nameOnly)records=records.filter(m=>m.kind==='name');
          else if(parsed.preferencesOnly)records=records.filter(m=>m.kind==='preference'&&m.temporal==='present');
          else if(parsed.object)records=records.filter(m=>m.kind==='preference'&&(m.object.key===parsed.object.key||parsed.object.candidates.includes(m.object.key))&&m.temporal==='present');
          records=records.slice(-12);claims(records);
          if(!records.length){
            if(parsed.nameOnly){plan.text='You haven’t told me your name yet.';if(!state.context.questionsPaused){plan.text+=' '+generate(K.Realization.question('name',{}));state.context.pending={kind:'name',questionMessage:aid};}}
            else plan.text=parsed.object?'You haven’t told me how you feel about '+parsed.object.label+' yet.':'You haven’t told me anything to remember yet. You could start with your name, or something you like.';
          }
          else if(parsed.nameOnly)plan.text=generate(report(records[records.length-1]));
          else if(parsed.object&&records.length===1)plan.text=generate(report(records[0]))+' That’s what you told me.';
          else plan.text='Here’s what you’ve told me: '+generate(reports(records));
          if(records.length===1&&records[0].kind==='preference')state.context.focus={object:K.clone(records[0].object),turn:state.turn,sourceMessage:records[0].sourceMessage};
          break;
        }
        case 'forget':{
          const noteTargets=[parsed.rawObjectLabel,parsed.rawObjectLabel.replace(/[.!?]+$/,'')].map(K.fold);
          const records=state.memories.filter(m=>m.status==='active'&&(m.object.key===parsed.object.key||parsed.object.candidates.includes(m.object.key)||K.fold(m.object.label)===K.fold(parsed.object.label)||m.kind==='note'&&noteTargets.includes(K.fold(m.object.label))));
          const ids=records.map(m=>m.id);state.memories=state.memories.map(m=>ids.includes(m.id)?{...m,status:'retired',retiredAt:event.seq}:m);
          if(records.length)state.context.focus=null;
          plan.text=records.length?'I’ll stop using '+(records.length===1?'that memory':'those memories')+'. The original messages and retired records remain in the history; “Reset conversation” removes this app’s saved session.':'I don’t have an active memory matching that.';
          plan.policy.retired=ids;break;
        }
        case 'clarify':{
          if(parsed.control){
            plan.policy.conversationControl=parsed.control;
            if(['decline','change_subject'].includes(parsed.control)){
              const topic=previous.context.pending?.topic||previous.context.field?.topic;
              if(topic)state.context.declinedTopics=[...new Set((state.context.declinedTopics||[]).concat(topic))].slice(-8);
              state.context.focus=null;
            }
            if(parsed.control==='stop_questions'){state.context.questionsPaused=true;plan.text='Okay. I’ll pause the questions. You can tell me what you’d like to share.';}
            else if(parsed.control==='resume_questions'){state.context.questionsPaused=false;plan.text='Okay. '+ask('general',0,{purpose:'start'});}
            else if(parsed.control==='change_subject'){state.context.thread=[];state.context.focus=null;state.context.field=this.field.advance(null,[],state.turn);plan.text='Of course. We can start fresh. '+ask('general',0,{purpose:'start'});}
            else plan.text='That’s okay. We can leave that subject there. You can share something else whenever you like.';
          }
          else if(parsed.ambiguity){const f=parsed.ambiguity,choices=meaningChoices(f.object.candidates);state.context.pending={kind:'sense',frame:f,frames:parsed.candidateFrames,sourceMessage:parsed.sourceMessage||uid,choices};plan.text=generate(K.Realization.question('meaning',{label:f.object.label,choices:choices.map(({id,label})=>({id,label}))}))+'\nI’ll save it once I know which one you mean.';}
          else if(parsed.semanticAmbiguity){const {slot,draft,candidates}=parsed.semanticAmbiguity,choices=meaningChoices(candidates);state.context.pending={kind:'semanticSense',slot,draft,choices};plan.text=generate(K.Realization.question('meaning',{label:draft.labels?.[slot]||'that term',choices:choices.map(({id,label})=>({id,label}))}));}
          else if(parsed.nameCandidate){plan.text='Should I call you '+parsed.nameCandidate+'?';state.context.pending={kind:'confirmName',name:parsed.nameCandidate,span:parsed.nameSpan,sourceMessage:uid,questionMessage:aid};}
          else if(parsed.askName){plan.text=parsed.reason;state.context.pending={kind:'name',questionMessage:aid};}
          else if(parsed.repair){plan.text='You’re right to call that out. I lost the thread. '+ask('repair',0,{purpose:'detail'});}
          else if(parsed.reasonCode==='unparsed'&&previous.context.pending?.choices){state.context.pending=K.clone(previous.context.pending);plan.text='I still need a meaning choice. Please use its name or number:\n'+state.context.pending.choices.map((c,i)=>(i+1)+'. '+c.label).join('\n');}
          else if(parsed.reasonCode==='unparsed'){
            let topicCue=null;
            const misses=(previous.context.misses||0)+1;state.context.misses=misses;
            const name=state.memories.find(m=>m.kind==='name'&&m.status==='active');
            if(!name&&K.isConversationName(parsed.text)&&/^\p{Lu}/u.test(parsed.text)){plan.text='Is “'+parsed.text+'” the name you’d like me to use? Please say “My name is '+parsed.text+'” to confirm.';state.context.pending={kind:'name',questionMessage:aid};}
            else if(!/\?\s*$/.test(parsed.text)&&(topicCue=K.conversationTopic(parsed.text,this.engine))){
              // A statement the grammar cannot store, but whose words name a known concept: keep the conversation on that topic.
              state.context.misses=0;discourse(parsed.text);plan.policy.topicSelection={rule:'lexical cue for question selection only',topic:topicCue,fallback:'unparsed statement'};
              plan.text=interact('social',{questionsPaused:true})+' '+ask(topicCue,0,undefined,parsed.text,[]);
            }
            else if(misses===1)plan.text=/\?\s*$/.test(parsed.text)?'I can’t answer that one. I can answer things like “What do you remember about me?”, “What is a guitar?”, or “Is a violin an instrument?”.':/^i(?:'m| am|'ve| have| want| need| think| wish| would| had| was| got| went| work| play| make| write)\b/i.test(parsed.text)?'I couldn’t read that as something to remember. Could you say it as “I like …”, “I feel …”, or “I love …”, or keep it as a note with “Remember this: …”?':'I didn’t quite catch that. Could you put it another way? Short sentences like “I like …”, “I feel …”, or “My name is …” work best.';
            else plan.text='I’m still not following, sorry—my grammar is fairly small. Ask “What can you do?” to see what I understand, or keep this as a note with “Remember this: …”.';
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
            const f=parsed.followUp,answer=f?f.answer:parsed.activity,found=K.conversationTopic(answer,this.engine);
            // A thread stays on its topic unless the answer is only a short phrase or says outright that the subject has changed.
            // Returning to a topic that was in play a moment ago, or landing near a ring that is still warm, also counts as a move.
            const back=f?hits.find(t=>t!==f.topic&&((prevField?.visited||[]).slice(-4).includes(t)||this.field.warm(prevField,t,f.topic,state.turn))):null;
            const settled=f&&f.topic&&f.topic!=='general',moves=!settled||!!back||/^(?:actually|anyway|by the way|speaking of|on another note|how about|what about)\b/i.test(answer)||answer.trim().split(/\s+/).length<=2;
            const cue=moves?(back||found):null,topic=cue||f?.topic||'general',step=f?(cue&&cue!==f.topic?0:f.step+1):0;
            discourse(answer,f?.questionMessage);plan.policy.topicSelection={rule:'lexical cue for question selection only',topic};
            if(/^(?:no|nope|not really)[.!]*$/i.test(answer)){plan.text='That’s fine. '+ask('general',0,{purpose:'start'});}
            else if(/^(?:yes|yeah|yep|sure|okay|ok)[.!]*$/i.test(answer)){plan.text='Go ahead. '+ask(topic,step,{purpose:'detail'});}
            else{
              const lead=interact('social',{questionsPaused:true}),asked=cue&&cue!==f?.topic?[]:f?.asked;
              const move=f?this.field.nextMove({ctx:state.context.field,topic,step,ladderLength:(K.conversationQuestions[topic]||[]).length,answer,memories:state.memories.filter(m=>!(state.context.declinedTopics||[]).includes(memoryTopic(m))),turn:state.turn}):{kind:'ladder'};
              if(move.kind==='remind'){claims([move.memory]);plan.text=lead+' '+generate(K.Realization.attributed(report(move.memory)))+' '+ask(topic,step,'Does that connect with this at all?',answer,asked);}
              else if(move.kind==='bridge'){plan.text=lead+' '+ask(move.topic,1,move.question,answer,[]);}
              else plan.text=lead+' '+ask(topic,step,undefined,answer,asked);
              if(move.trace){plan.policy.field=move.trace;this.field.record(state.context.field,move,state.turn);}
            }
            break;
          }
          const o=parsed.object,topic=this.engine.topicFor(o.concept)||K.conversationTopic(o.label,this.engine)||'general';
          if(o.candidates.length>1){const choices=meaningChoices(o.candidates);state.context.pending={kind:'topicSense',choices};plan.text=generate(K.Realization.question('meaning',{label:o.label,choices:choices.map(({id,label})=>({id,label}))}));}
          else plan.text=ask(topic,0,undefined,o.label,[],'neutral',true)||interact('social',{questionsPaused:true});
          state.context.focus={object:K.clone(o),turn:state.turn,sourceMessage:uid};break;
        }
        case 'boundary':state.settings.boundary=parsed.value;plan.text=parsed.value==='platonic'?'Of course. I’ll keep the conversation platonic.':'A little fictional flirting is fine. You can say “stop flirting” whenever you want.';break;
        case 'why':{
          const last=previous.lastPlan,read=actLabels[last?.act]||'part of our conversation';plan.text=last?'I took your last message as '+read+'. '+(last.claims.length?'My reply drew on '+(last.claims.length===1?'one thing':last.claims.length+' things')+' you’ve told me. ':'My reply didn’t rely on anything you’ve told me before. ')+'The wording comes from my sentence grammar and dialogue policy—open “Sources & reasoning” under any reply to see every record and check.':'There isn’t a previous reply to explain yet.';break;
        }
        case 'support':plan.text=parsed.answer==='no'?'That’s okay. We could try a joke or a writing prompt, or leave it there.':generic(parsed.loss?'loss':'support');if(parsed.answer!=='no')askLastQuestion('support',0);break;
        case 'about':{
          const kind=parsed.aboutKind,o=parsed.object;
          if(kind==='capabilities'||kind==='honest'){plan.text=generic(kind);askLastQuestion('general',0);}
          else if(kind==='taste'||kind==='favorite'){
            const topic=o.candidates.length===1?this.engine.topicFor(o.concept):null;
            plan.text=generic('honest',{questionsPaused:true})+' '+ask(topic||'general',0,undefined,o.label);
          }else plan.text=generic('about');
          break;
        }
        case 'social':{
          const kind=parsed.socialKind,priorAct=previous.lastPlan?.policy.secondaryActs?.at(-1)||previous.lastPlan?.act;
          if(kind==='laugh'&&['joke','prompt'].includes(priorAct)){plan.text=generic('laugh');if(!state.context.questionsPaused)state.context.pending={kind:'offer',act:priorAct};}
          else{const hook=kind==='ack'||kind==='decline'?recallHook():null;if(hook){plan.text=hook.text+' '+ask(hook.topic,0);}else{plan.text=generic(kind==='decline'?'decline':'social');askLastQuestion('general',0);}}
          break;
        }
        case 'affection':plan.text=generic(state.settings.boundary==='flirty'&&state.relationship.points>=4?'flirt':'affection');break;
        case 'greet':{
          const r=this.engine.query({op:'realize',c:'c:greeting-word',target:[state.settings.register,0]});plan.semantics.push(r);plan.slots.push({concept:'c:greeting-word',sense:r.value.chosen,type:'speech-act',context:'extensional'});
          const word=this.engine.a.senses.find(s=>s.id===r.value.chosen).lemma,name=state.memories.find(m=>m.kind==='name'&&m.status==='active');
          if(name){claims([name]);const hook=recallHook(),hello=generic('greet',{greeting:word,name:name.object.label,questionsPaused:true})+' ';plan.text=hello+(hook?hook.text+' '+ask(hook.topic,0):ask('general',0));}
          else{plan.text=generic('greet',{greeting:word,questionsPaused:true});if(!state.context.questionsPaused){plan.text+=' '+generate(K.Realization.question('name',{}));state.context.pending={kind:'name',questionMessage:aid};}}break;
        }
        default:plan.text=generic(K.DIALOGUE.responses[intent]?intent:'about');
      }
      if(parsed.elaboration){elaborating=true;discourse(parsed.elaboration);plan.text=plan.text+' You gave this reason: “'+parsed.elaboration+'”. '+ask(K.conversationTopic(parsed.text,this.engine)||'general',1);}
      for(const [index,act] of (parsed.afterActs||[]).entries()){allowQuestions=index===parsed.afterActs.length-1;const r=this.engine.query({op:'route',intent:act.intent});K.assert(r.outcome==='Computed','Secondary act was not admitted');plan.semantics.push(r);const kind=act.intent.slice(2);plan.text+='\n\n'+generic(kind);plan.policy.secondaryActs=(plan.policy.secondaryActs||[]).concat(kind);state.context.pending=null;}
      if(!state.context.pending&&!state.context.questionsPaused)for(const result of generated.slice().reverse())if(result.tree.type==='interaction'){
        const question=K.Interaction.realize(result.tree).questions.at(-1);
        if(question&&plan.text.endsWith(question)){ask('general',0,question);break;}
      }
      plan.text=plan.text.trim();
      if(parsed.supported)state.context.misses=0;
      if(parsed.supported&&intent!=='crisis'){
        const fingerprint=K.hash(K.fold(parsed.text));if(!state.relationship.seen.includes(fingerprint)){state.relationship.seen.push(fingerprint);state.relationship.points=Math.min(100,state.relationship.points+1);}
      }
      plan.policy.field=plan.policy.field||this.field.trace(state.context.field,'none');
      const template=plan.text,replacements=[];
      plan.text=K.expandVariants(template,{seed:K.sha256(event.seq+'|'+event.time+'|'+parsed.text),usage:state.usage,persona,phase:this.field.phase(state.context.field,state.turn),replacements});
      if(state.context.pending?.question){
        // Resolve the same slot occurrences as the displayed reply without selecting wording twice.
        const question=state.context.pending.question,start=template.lastIndexOf(question);
        if(start>=0){
          let rendered='',cursor=start;
          for(const r of replacements)if(r.start>=start&&r.end<=start+question.length){rendered+=template.slice(cursor,r.start)+r.text;cursor=r.end;}
          state.context.pending.question=rendered+template.slice(cursor,start+question.length);
        }
      }
      const positions=new Map();
      for(const result of generated){
        const start=plan.text.indexOf(result.text,positions.get(result.text)||0);
        K.assert(start>=0,'Generated sentence was changed or removed during reply composition');
        const end=start+result.text.length;plan.realizations.push({result,start,end});positions.set(result.text,end);
      }
      this.verifyPlan(state,plan);
      plan.digest=K.hash({id:plan.id,act:plan.act,text:plan.text,claims:plan.claims,semantics:plan.semantics.map(s=>s.digest),slots:plan.slots,realizations:plan.realizations,policy:plan.policy,interpretation:plan.interpretation});
      state.messages.push({id:aid,role:'assistant',text:plan.text,time:event.time,turn:state.turn,plan});state.lastPlan=plan;
      return {state,plan};
    }
    verifyPlan(state,plan){
      K.assert(typeof plan.text==='string'&&plan.text.length>0,'Empty reply plan');
      for(const c of plan.claims){const m=state.memories.find(m=>m.id===c.memoryId);K.assert(m&&m.status==='active'&&m.sourceMessage===c.sourceMessage&&m.predicate===c.predicate&&m.object.key===c.objectKey&&m.polarity===c.polarity&&m.temporal===c.temporal,'Ungrounded attributed claim');K.assert(state.messages.some(x=>x.id===m.sourceMessage&&x.role==='user'&&!x.legacy),'Missing source message');}
      for(const s of plan.slots)K.assert(s.context==='extensional'&&this.engine.a.senses.some(x=>x.id===s.sense&&x.cid===s.concept),'Slot violated its fiber constraint');
      for(const r of plan.semantics)K.assert(r.checked===true,'Unverified semantic result');
      const spans=(plan.realizations||[]).slice().sort((a,b)=>a.start-b.start);let end=0;
      for(const span of spans){
        K.assert(Number.isSafeInteger(span.start)&&Number.isSafeInteger(span.end)&&span.start>=end&&span.end>span.start&&span.end<=plan.text.length&&plan.text.slice(span.start,span.end)===span.result.text,'Generated sentence span does not match the displayed reply');
        K.Realization.verify(span.result,{memories:state.memories});end=span.end;
        for(const id of span.result.memoryIds){const m=state.memories.find(m=>m.id===id);K.assert(m&&state.messages.some(message=>message.id===m.sourceMessage&&message.role==='user'&&!message.legacy),'Missing generated sentence source message');}
      }
      if(plan.policy.discourse){const d=plan.policy.discourse,source=state.messages.find(m=>m.id===d.sourceMessage);K.assert(source?.role==='user'&&source.text.includes(d.text),'Missing quoted conversational source');if(d.questionMessage)K.assert(state.messages.some(m=>m.id===d.questionMessage&&m.role==='assistant'),'Missing conversational question');}
    }
    replay(events){K.assert(Array.isArray(events)&&events.length<=MAX_EVENTS,'Event log limit');let state=initialState();for(const e of events)state=this.step(state,e).state;return state;}
  }
  Object.assign(K,{DialogueModel,initialState,describeMemory,relationshipStage:stage,validateEvent,MAX_EVENTS,supportedImage});
})(Kira);

Kira.APP_META={"version":"4.4.0","artifactHash":"e0161a12cde6f8c7f33a21c30543ce71d936e70caff323cd766c5ebce7ccf571","modelHash":"bbc697c38b97e93d6e16f4f1242ddbfcf8b89a105df7587f2032ea6e68df9d9e","unicode":"15.0.0","profile":"EXPERIMENTAL"};
