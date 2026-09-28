'use strict';
// Discourse adapter: preserves raw reports and records question/answer links.
// Topic cues select questions only; they never establish ontology or memory facts.
(function(K){
  const reserved=/\b(?:and|but|because|or|if|not|happy|sad|tired|lonely|anxious|angry|excited|calm|okay|fine|overwhelmed|building|working|writing|making|coding|feeling|from|years|old|hello|hi|hey|thanks|yes|no|sure)\b/i;
  K.isConversationName=s=>typeof s==='string'&&s.length<=50&&/^[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*(?: [\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*){0,3}$/u.test(s)&&!reserved.test(s);
  const topicCue=(text,engine)=>{
    const t=K.fold(text);
    if(engine){
      const exact=engine.lookup(text);if(exact.length>1)return null;if(exact.length===1)return engine.topicFor(exact[0]);
      const words=t.replace(/[.,!?]/g,' ').split(/\s+/).filter(Boolean).slice(0,60);
      for(let size=Math.min(4,words.length);size>0;size--)for(let i=0;i+size<=words.length;i++){const matches=engine.lookup(words.slice(i,i+size).join(' '));if(matches.length===1){const topic=engine.topicFor(matches[0]);if(topic)return topic;}}
      return null;
    }
    for(const [key,re] of [['gaming',/\b(?:game|games|gaming|dating sim|rpg)\b/],['coding',/\b(?:code|coding|programming|software|app|engine)\b/],['music',/\b(?:music|song|songs|album|guitar|metal|rap)\b/],['writing',/\b(?:writing|novel|poem|story|stories)\b/],['coffee',/\bcoffee\b/]])if(re.test(t))return key;
    return null;
  };
  function parseConversation(input,state,engine){
    const raw=K.nfc(input).trim(),text=raw.replace(/[’‘]/g,"'"),pending=state.context.pending;
    const base=(s=text)=>K.parseInput(s,state,engine);
    const finish=r=>({...r,text:raw,version:'conversation-parser/4.1.2'});
    if(/^(?:remember (?:this|that)|note):?\s+/i.test(text))return finish(base());
    const questionReply=(answer,thread)=>finish({intent:'c:topic',speechAct:'answer',supported:true,frames:[],quoted:[],followUp:{answer,question:thread.question,questionMessage:thread.questionMessage,topic:thread.topic,step:thread.step||0},reason:null});
    // Do not turn a quoted or explicitly conditional statement into a report.
    const protectedText=/["“”]|^(?:if|suppose|imagine|maybe|perhaps)\b/i.test(text);
    if(!protectedText){
      const salutation=text.match(/^(?:hello|hi|hey|yo|good morning|good afternoon|good evening)(?:[ ,]+kira\b)?(?:\s*[,!.:]\s*|\s+)(?=\S)/i);
      let body=salutation?text.slice(salutation[0].length):text,offset=salutation?salutation[0].length:0;
      // Conventional introduction shorthand, without treating arbitrary 'I am X' as a name.
      const intro=body.match(/^i(?:'m| am)\s+(.+?)[.!]*$/i);
      if(intro&&K.isConversationName(intro[1])&&/^\p{Lu}/u.test(intro[1])&&!base(body).supported){
        return finish({intent:'c:clarify',speechAct:'clarification',supported:false,frames:[],quoted:[],nameCandidate:intro[1],nameSpan:{start:text.indexOf(intro[1],offset),end:text.indexOf(intro[1],offset)+intro[1].length},reason:null});
      }
      const parts=[...body.matchAll(/[^.!?]+[.!?]*/g)].map(m=>({text:m[0].trim(),offset:offset+m.index+m[0].indexOf(m[0].trim())})).filter(p=>p.text);
      if(parts.length>1&&parts.length<=6){
        const parsed=parts.map(p=>{const r=base(p.text);for(const f of r.frames)f.span={start:f.span.start+p.offset,end:f.span.end+p.offset};return r;});
        const social=new Set(['c:greet','c:how','c:about','c:thanks','c:joke','c:prompt']);
        if(parsed.every(r=>r.supported&&(r.frames.length||social.has(r.intent)))){
          const frames=parsed.flatMap(r=>r.frames),acts=parsed.filter(r=>!r.frames.length&&r.intent!=='c:greet');
          const primary=frames.length?parsed.find(r=>r.frames.length):parsed.find(r=>r.intent!=='c:greet')||parsed[0];
          return finish({...primary,frames,negativeMood:parsed.some(r=>r.negativeMood),greeted:!!salutation||parsed.some(r=>r.intent==='c:greet'),afterActs:frames.length?acts:acts.filter(r=>r!==primary),parts:parsed});
        }
        // Never fall through to pending-answer handling and commit partial reports.
        return finish({...base(),reasonCode:'compound',reason:'There are a few parts there. Could we take the first one on its own? I haven’t saved any of those reports.'});
      }
      // A reason is kept as a conversational quote, separately from the asserted report.
      const because=body.match(/^(.+?)\s+because\s+(.+)$/i);
      if(because){const r=base(because[1]);if(r.supported&&r.frames.length&&r.frames.every(f=>['preference','mood'].includes(f.kind))){for(const f of r.frames)f.span={start:f.span.start+offset,end:f.span.end+offset};return finish({...r,greeted:!!salutation,elaboration:raw.slice(text.indexOf(because[2],offset))});}}
      if(salutation){const r=base(body);for(const f of r.frames)f.span={start:f.span.start+offset,end:f.span.end+offset};if(r.supported||r.ambiguity)return finish({...r,greeted:true});}
    }
    const parsed=base();
    if(parsed.supported||parsed.ambiguity)return finish(parsed);
    if(pending?.kind==='confirmName'&&/^(?:yes|yeah|yep|correct)[.!]*$/i.test(text)){const r=base('My name is '+pending.name);r.frames[0].span=K.clone(pending.span);return finish({...r,sourceMessage:pending.sourceMessage,questionMessage:pending.questionMessage,confirmedName:true});}
    if(pending?.kind==='confirmName'&&/^(?:no|nope)[.!]*$/i.test(text))return finish({...parsed,askName:true,reason:'Thanks for correcting me. What name would you like me to use?'});
    if(pending?.kind==='name'&&!protectedText&&K.isConversationName(text.replace(/[.!]+$/,''))){
      const name=text.replace(/[.!]+$/,''),r=base('My name is '+name);r.frames[0].span={start:0,end:name.length};return finish({...r,answeredName:true,questionMessage:pending.questionMessage});
    }
    // Repeating the name just acknowledged is a conversational confirmation.
    const known=state.memories.find(m=>m.kind==='name'&&m.status==='active'&&K.fold(m.object.label)===K.fold(text));
    if(known&&state.lastPlan?.claims.some(c=>c.memoryId===known.id)){const r=base('My name is '+known.object.label);r.frames[0].span={start:0,end:raw.length};return finish({...r,nameConfirmation:true});}
    // Questions always beat a pending answer; safety/negation/attribution failures stay failures.
    const yesNo=/^(?:yes|yeah|yep|sure|no|nope|not really|okay|ok)[.!]*$/i.test(text);
    if(pending?.kind==='detail'&&!protectedText&&!/\?$/.test(text)&&(parsed.reasonCode==='unparsed'||yesNo)&&!/^\s*(?:i (?:might|think|wish)|do i|what|who|why|how|can you|could you)\b/i.test(text))return questionReply(raw,pending);
    if(!protectedText&&parsed.reasonCode==='unparsed'&&/^i(?:'m| am)\s+(?:building|working on|writing|making|coding|creating)\s+.+/i.test(text))return finish({intent:'c:topic',speechAct:'statement',supported:true,frames:[],quoted:[],activity:raw,topicHint:topicCue(raw),reason:null});
    if(parsed.reasonCode==='unparsed'&&/\b(?:don't understand|do not understand|template|generic|robotic|not listening|doesn't work|does not work)\b/i.test(text))return finish({...parsed,repair:true});
    return finish(parsed);
  }
  const questions={
    gaming:['What kind of game are you making or thinking about?','What should the player be able to change in that world?','What keeps happening when the player does nothing?','Which interaction would you want to try first?'],
    coding:['What are you building?','Which part needs to work first?','What is the smallest example that would show whether it works?','What tradeoff is giving you the most trouble?'],
    music:['What kind of music has your attention?','Is there a particular sound or lyric that stays with you?','What changes for you when you hear it?','Would you rather talk about making music or listening to it?'],
    writing:['What are you writing?','Is there a character or scene you keep coming back to?','What makes that detail matter to you?','What would you like the reader to leave with?'],
    coffee:['Is it the taste, the ritual, or the excuse to pause?','What is your usual way of making it?','Is that something you enjoy alone or with company?','What else belongs in that little routine?'],
    nature:['What draws your attention to it?','What have you noticed about it yourself?','Is there a place you associate with it?'],
    science:['Which part makes you curious?','What is the question you most want answered?','Would you like to explore the vocabulary around it in Engine lab?'],
    cooking:['Do you enjoy making it or eating it?','What makes a good version for you?','Is there a routine or memory attached to it?'],
    reading:['What do you like to read?','Is there a character or setting that stayed with you?','What did that change about the way you saw the story?'],
    art:['What kind of art draws you in?','Is it the subject, the materials, or the way it makes you feel?','Are you making something yourself?'],
    hiking:['Is there a place you like to return to?','What do you notice there that you miss elsewhere?','Do you go for the movement or the quiet?'],
    feelings:['Would you like to describe what brought that on?','What feels most important to say about it?','Would you like to stay with this, or take a break from the subject?'],
    general:['What would you like me to know about that?','Which part matters most to you?','Would you like to stay with that, or change the subject?']
  };
  function nextQuestion(topic,step){const q=questions[topic]||questions.general;return step<q.length?q[step]:'Would you like to keep talking about this, or pick another subject?';}
  Object.assign(K,{parseConversation,conversationTopic:topicCue,nextConversationQuestion:nextQuestion});
})(Kira);

