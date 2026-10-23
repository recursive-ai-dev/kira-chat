'use strict';
// Pure multi-character host model. World truth and character beliefs are kept
// separate; only explicit host events move information between characters.
(function(K){
  const N=K.Narrative,MAX_EVENTS=10000,MAX_EXPORT=16000000;
  const newest=(beliefs,fact)=>{for(let i=beliefs.length-1;i>=0;i--)if(beliefs[i].fact===fact)return beliefs[i];return null;};
  const meets=(actor,conditions)=>conditions.every(c=>{
    const belief=newest(actor.beliefs,c.fact);
    return belief?.value===c.value&&(c.kind===undefined||belief.kind===c.kind);
  });
  class WorldModel{
    constructor(pkg,engine){
      this.package=N.verify(pkg);
      this.definition=this.package.definition;
      this.engine=engine||new K.SemanticEngine(K.ARTIFACT);
      N.check(this.engine.a.hash===K.APP_META.artifactHash,'semantic engine artifact mismatch');
      this.dialogue=new K.DialogueModel(this.engine,K.APP_META);
      this.characters=new Map(this.definition.characters.map(c=>[c.id,c]));
      this.identities=new Map(this.definition.speakers.concat(this.definition.characters).map(c=>[c.id,c]));
      this.facts=new Map(this.definition.facts.map(f=>[f.id,f]));
      this.topics=new Map(this.definition.topics.map(t=>[t.id,t]));
    }
    assets(){return {sdkHash:K.NARRATIVE_META.sdkHash,modelHash:K.APP_META.modelHash,packageHash:this.package.hash};}
    initialState(){
      const actors={};
      for(const c of this.definition.characters)actors[c.id]={beliefs:c.knowledge.map(f=>({...f,event:0,kind:'background',source:c.id,chain:[]})),sessions:{},usage:{}};
      return {schema:'kira-world-state/1',assets:this.assets(),revision:0,time:0,world:{},actors};
    }
    validate(state,event){
      N.check(state&&state.schema==='kira-world-state/1'&&K.hash(state.assets)===K.hash(this.assets()),'state belongs to different assets');
      N.object(event,'event',['seq','time','type','fact','value','witnesses','from','to','actor','speaker','text','topic','memoryId','delta']);
      N.integer(event.seq,'event sequence',1,MAX_EVENTS);N.check(event.seq===state.revision+1,'event sequence is not next');
      N.integer(event.time,'event time',0,8640000000000000);N.check(event.time>=state.time,'event time moved backwards');
      const fields={world:['fact','value','witnesses'],claim:['fact','value','from','to'],tell:['fact','from','to'],message:['actor','speaker','text','topic'],initiate:['actor','speaker','topic'],retire:['actor','speaker','memoryId'],relationship:['actor','speaker','delta']};
      N.check(Object.hasOwn(fields,event.type),'unknown event type');
      N.check(Object.keys(event).every(k=>['seq','time','type'].includes(k)||fields[event.type].includes(k)),'event has fields for a different type');
      if(['world','claim','tell'].includes(event.type)){
        N.check(this.facts.has(event.fact),'unknown event fact');
        if(event.type!=='tell')N.check(typeof event.value==='boolean','event fact value must be boolean');
        const audience=event.type==='world'?event.witnesses:event.to;
        N.array(audience,'audience',128);N.check(new Set(audience).size===audience.length,'duplicate audience member');
        N.check(audience.every(id=>this.characters.has(id)),'unknown audience character');
        if(event.type!=='world'){
          N.check(audience.length>0,'empty report audience');N.check(this.identities.has(event.from),'unknown report source');
          N.check(!audience.includes(event.from),'a character cannot report to itself');
          if(event.type==='tell')N.check(this.characters.has(event.from)&&newest(state.actors[event.from].beliefs,event.fact),'source has no belief to relay');
        }
      }else{
        N.check(this.characters.has(event.actor),'unknown actor');N.check(this.identities.has(event.speaker)&&event.speaker!==event.actor,'unknown or identical conversation partner');
        if(event.topic!==undefined)N.check(this.topics.has(event.topic),'unknown selected topic');
        if(event.type==='message')N.text(event.text,'message',2000);
        if(event.type==='retire')N.text(event.memoryId,'memory id',100);
        if(event.type==='relationship')N.integer(event.delta,'relationship change',-100,100);
      }
    }
    session(actor,character,speaker){
      if(!actor.sessions[speaker]){
        const state=K.initialState();
        state.settings.persona=character.persona;state.settings.register=character.register;
        actor.sessions[speaker]={dialogue:state,replies:[]};
      }
      return actor.sessions[speaker];
    }
    activeGoals(state,id){
      N.check(this.characters.has(id),'unknown goal character');
      const actor=state.actors[id];
      return this.characters.get(id).goals.filter(g=>meets(actor,g.requires)&&!(g.completedBy.length&&meets(actor,g.completedBy))).map(g=>({id:g.id,label:g.label}));
    }
    topicsFor(input){
      const words=' '+N.terms(input)+' ';
      return this.definition.topics.filter(t=>t.aliases.some(alias=>words.includes(' '+alias+' '))).map(t=>t.id);
    }
    step(previous,input){
      // Marshal/validate before copying: rejected events never mutate the caller.
      this.validate(previous,input);
      const event=K.clone(input),state=K.clone(previous);
      state.revision=event.seq;state.time=event.time;
      if(['world','claim','tell'].includes(event.type)){
        let report={fact:event.fact,value:event.value,event:event.seq,kind:event.type==='world'?'witnessed':'reported',source:event.type==='world'?null:event.from,chain:[]};
        if(event.type==='world')state.world[event.fact]={value:event.value,event:event.seq};
        if(event.type==='tell'){
          const source=newest(state.actors[event.from].beliefs,event.fact);
          report={...report,value:source.value,kind:'relayed',chain:source.chain.concat({actor:event.from,event:source.event,kind:source.kind,source:source.source})};
          N.check(report.chain.length<=128,'rumour chain is too long');
        }
        for(const id of event.type==='world'?event.witnesses:event.to)state.actors[id].beliefs.push(K.clone(report));
        return {state,reply:null};
      }
      const actor=state.actors[event.actor],character=this.characters.get(event.actor);
      const session=this.session(actor,character,event.speaker);
      if(event.type==='relationship'){
        session.dialogue.relationship.points=Math.max(0,Math.min(100,session.dialogue.relationship.points+event.delta));
        return {state,reply:null};
      }
      if(event.type==='retire'){
        session.dialogue=this.dialogue.step(session.dialogue,{seq:session.dialogue.revision+1,time:event.time,type:'retire',memoryId:event.memoryId}).state;
        return {state,reply:null};
      }
      let native=null;
      if(event.type==='message'){
        const result=this.dialogue.step(session.dialogue,{seq:session.dialogue.revision+1,time:event.time,type:'message',text:event.text});
        session.dialogue=result.state;native=result.plan;
      }
      const topics=event.topic?[event.topic]:event.type==='message'?this.topicsFor(event.text):[];
      const intent=event.type==='initiate'?'initiate':native.act,topic=topics.length===1?topics[0]:null;
      const goals=new Set(this.activeGoals(state,event.actor).map(g=>g.id));
      const memoryFor=r=>{
        const candidates=session.dialogue.memories.filter(m=>m.status==='active'&&m.kind===r.memoryKind);
        // A question about coffee must never be answered from a newer memory
        // about tea. The companion's grounded recall selection is authoritative.
        if(native?.act==='recall')return candidates.filter(m=>native.claims.some(c=>c.memoryId===m.id)).at(-1);
        return candidates.at(-1);
      };
      const pending=session.dialogue.context.pending,clarification=native?.act==='clarify'&&pending&&pending.kind!=='detail';
      const candidates=topics.length>1||clarification?[]:character.rules.filter(r=>
        (r.on.topic===undefined||r.on.topic===topic)&&(r.on.intent===undefined||r.on.intent===intent)&&
        // A message wildcard must never accidentally initiate an NPC's goals.
        (intent!=='initiate'||r.on.intent==='initiate')&&
        meets(actor,r.requires)&&session.dialogue.relationship.points>=r.minRelationship&&
        (!r.memoryKind||memoryFor(r))&&(!r.goal||goals.has(r.goal))
      ).sort((a,b)=>b.priority-a.priority||(actor.usage['rule:'+a.id]||0)-(actor.usage['rule:'+b.id]||0)||K.cmp(a.id,b.id));
      const rule=candidates[0],evidence=[],memory=rule?.memoryKind?memoryFor(rule):null;
      if(memory)evidence.push({kind:'memory',speaker:event.speaker,memory:memory.id,sourceMessage:memory.sourceMessage});
      if(rule){
        const conditions=rule.requires.concat(rule.goal?character.goals.find(g=>g.id===rule.goal).requires:[]);
        for(const fact of new Set(conditions.map(c=>c.fact)))evidence.push({kind:'belief',belief:K.clone(newest(actor.beliefs,fact))});
      }
      let text=character.fallback,phrases=[];
      if(clarification)text=native.text;
      else if(topics.length>1)text='Which subject do you mean: '+topics.map(id=>this.topics.get(id).label).join(' / ')+'?';
      else if(rule){
        actor.usage['rule:'+rule.id]=(actor.usage['rule:'+rule.id]||0)+1;
        text=rule.parts.map((alternatives,part)=>{
          const key='phrase:'+rule.id+':'+part+':';
          const index=alternatives.map((_,i)=>i).sort((a,b)=>(actor.usage[key+a]||0)-(actor.usage[key+b]||0)||a-b)[0];
          actor.usage[key+index]=(actor.usage[key+index]||0)+1;phrases.push(index);
          return alternatives[index].replace(/\{([^{}]+)\}/g,(_,slot)=>{
            if(slot==='character')return character.name;
            if(slot==='speaker')return this.identities.get(event.speaker).name;
            if(slot==='memory')return memory.object.label;
            if(slot==='report')return K.describeMemory(memory);
            return this.facts.get(slot.slice(5)).text;
          });
        }).join('');
      }
      N.check(text.length<=16000,'generated reply is too long');
      const payload={event:event.seq,actor:event.actor,speaker:event.speaker,text,rule:rule?.id??null,goal:rule?.goal??null,topic,intent,topics,phrases,evidence,
        interpretation:native?.interpretation??null,origin:clarification?'parser_clarification':topics.length>1?'topic_clarification':rule?'authored_rule':'authored_fallback'};
      const reply={...payload,digest:K.hash(payload)};
      session.replies.push(reply);
      if(native){
        // Follow-up state must describe the sentence actually shown, rather
        // than a question from the companion persona which was never spoken.
        if(!clarification)session.dialogue.context.pending=null;
        const plan={...native,text,policy:{...native.policy,narrative:{rule:reply.rule,replyDigest:reply.digest}},digest:null};
        plan.digest=K.hash({id:plan.id,act:plan.act,text:plan.text,claims:plan.claims,semantics:plan.semantics.map(s=>s.digest),slots:plan.slots,policy:plan.policy,interpretation:plan.interpretation});
        session.dialogue.lastPlan=plan;
        const assistant=session.dialogue.messages.at(-1);assistant.text=text;assistant.plan=plan;
      }
      return {state,reply};
    }
    replay(events){
      N.array(events,'world event log',MAX_EVENTS);let state=this.initialState();
      for(const event of events)state=this.step(state,event).state;
      return state;
    }
    export(events){
      const state=this.replay(events);
      const payload={format:'kira-world-session/1',assets:this.assets(),events:K.clone(events),stateDigest:K.hash(state)};
      const envelope={...payload,checksum:K.hash(payload)};
      N.check(JSON.stringify(envelope).length<=MAX_EXPORT,'world export is too large');return envelope;
    }
    import(envelope){
      N.object(envelope,'world session',['format','assets','events','stateDigest','checksum']);
      N.check(JSON.stringify(envelope).length<=MAX_EXPORT,'world export is too large');
      N.check(envelope.format==='kira-world-session/1','unsupported world session format');
      const {checksum,...payload}=envelope;
      N.check(checksum===K.hash(payload),'world session checksum mismatch');
      N.check(K.hash(envelope.assets)===K.hash(this.assets()),'world session requires different SDK or narrative assets');
      const state=this.replay(envelope.events);
      N.check(K.hash(state)===envelope.stateDigest,'world replay digest mismatch');
      return {state,events:K.clone(envelope.events)};
    }
  }
  Object.assign(N,{WorldModel,MAX_EVENTS,MAX_EXPORT});
})(Kira);
