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
    const finish=r=>({...r,text:raw,version:'conversation-parser/4.2.0'});
    if(/^(?:remember (?:this|that)|note):?\s+/i.test(text))return finish(base());
    const questionReply=(answer,thread)=>finish({intent:'c:topic',speechAct:'answer',supported:true,frames:[],quoted:[],followUp:{answer,question:thread.question,questionMessage:thread.questionMessage,topic:thread.topic,step:thread.step||0,asked:thread.asked||[]},reason:null});
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
    support:['What’s been the hardest part?','How are you holding up right now?','Has anything helped, even a little?','Would you like to keep talking about it, or take a breather with something lighter?'],
    general:['How do you feel about that?','What’s that like for you?','Would you like to stay with that, or talk about something else?']
  };
  // Answer-aware questions: the first rule whose cue appears in the answer and whose question has not
  // been asked yet in this thread wins; otherwise the fixed list continues. Cues only choose a question.
  const tailored={
    gaming:[[/\b(?:art|pixel|sprites?|drawings?|animation|visuals?|painted|hand[- ]drawn)\b/i,'What look are you going for with the art, and how does it shape the way the game plays?'],[/\b(?:story|narrative|characters?|dialogue|writing)\b/i,'Whose story does the player get to live through?'],[/\b(?:puzzle|puzzles)\b/i,'What is the first puzzle the player will meet?'],[/\b(?:multiplayer|co-?op|online|friends)\b/i,'How do the players affect each other?'],[/\b(?:platformer|jump|jumping|movement)\b/i,'What does moving through the world feel like?'],[/\b(?:unity|godot|unreal|engine|javascript|python|c\+\+|c#|lua|phaser|love2d)\b/i,'How is that setup working for you so far?'],[/\b(?:stuck|hard|struggling|can't|cannot|bug|bugs)\b/i,'What is the part that keeps getting in the way?'],[/\b(?:solo|alone|myself|by myself)\b/i,'What is it like building the whole thing on your own?']],
    coding:[[/\b(?:bug|bugs|error|errors|broken|crash|crashes|stuck)\b/i,'What happens when it fails, and what did you expect instead?'],[/\b(?:web|website|browser|html|javascript|frontend|react)\b/i,'Who is the page for, and what should they be able to do first?'],[/\b(?:python|rust|go|java|c\+\+|c#|lua|typescript)\b/i,'What made you choose that language for it?'],[/\b(?:game|engine)\b/i,'Which system in it are you working on right now?'],[/\b(?:learning|beginner|new to|tutorial)\b/i,'What would feel like a good first win?']],
    music:[[/\b(?:guitar|bass|drums?|piano|keys|synth|violin|sing|singing|vocals?)\b/i,'How long have you been playing, and what do you reach for first?'],[/\b(?:lyrics?|songwriting|write|writing)\b/i,'Where do your songs usually start, with a line, a sound, or a feeling?'],[/\b(?:metal|rock|punk|rap|hip-?hop|jazz|folk|pop|electronic|classical)\b/i,'What is it about that sound that works for you?'],[/\b(?:producing|production|mixing|recording|daw|beats?)\b/i,'What does your setup look like when you sit down to make something?']],
    writing:[[/\b(?:poem|poetry|poems)\b/i,'Do your poems start with an image or with a line?'],[/\b(?:novel|book|chapter)\b/i,'Where are you in it, and what comes next?'],[/\b(?:character|characters|protagonist)\b/i,'What does that character want that they cannot say out loud?'],[/\b(?:stuck|blocked|can't|cannot)\b/i,'What usually unblocks you, even slightly?']],
    art:[[/\b(?:digital|procreate|photoshop|tablet|pixel)\b/i,'What do you like about working digitally?'],[/\b(?:paint|painting|oil|watercolou?r|acrylic)\b/i,'What do you find yourself painting most?'],[/\b(?:draw|drawing|sketch|sketching|ink)\b/i,'Do you sketch loosely first, or start with the final lines?']]
  };
  const anyTopic=[[/\b(?:stuck|struggling|blocked|can't figure|cannot figure|bug|bugs)\b/i,'What is the part that keeps getting in the way?'],[/\b(?:solo|alone|by myself|just me|on my own)\b/i,'What is it like doing that on your own?'],[/\b(?:godot|unity|unreal|phaser|love2d)\b/i,'How is that engine working out for you so far?']];
  // Pull a short noun phrase out of an answer ("Making 2d games with custom art" -> "2d games") so a
  // question can name it. Returns null unless the result is short and plainly a phrase.
  function focusPhrase(answer){
    if(typeof answer!=='string')return null;
    let t=answer.trim().replace(/[.!?,;:]+$/,'').replace(/^(?:well|so|um|uh|honestly|mostly|just|really|basically|mainly)[, ]+/i,'');
    t=t.replace(/^(?:i(?:'m| am| have been|'ve been| have)?\s+)?(?:currently |mostly |just |really |also )*(?:making|building|working on|writing|creating|playing|learning|studying|doing|designing|drawing|painting|listening to|reading|using|trying)\s+/i,'');
    t=t.replace(/\s+(?:with|using|in|on|for|at|from|because|but|and|so|that|which|when|while|since)\s+.*$/i,'').replace(/\s+(?:mostly|mainly|lately|now|these days|right now|a lot|at the moment|too)$/i,'').trim();
    const words=t.split(/\s+/).filter(Boolean);
    if(words.length<1||words.length>4||t.length>32)return null;
    if(/^(?:yes|yeah|yep|no|nope|nothing|something|anything|everything|it|that|this|them|stuff|things?|idk|maybe|sure|not sure)$/i.test(t))return null;
    if(/\b(?:i|i'm|i've|me|my|you|your|we|is|are|was|were|be|do|does|did|not|don't|can't|won't)\b/i.test(t))return null;
    // A sentence-initial capital is only lowercased when the next word is lowercase ("Pixel platformers", not "Stardew Valley" or "Godot").
    return words.length>1&&/^\p{Lu}\p{Ll}+$/u.test(words[0])&&/^\p{Ll}/u.test(words[1])?t[0].toLowerCase()+t.slice(1):t;
  }
  const phraseQuestions={
    gaming:[p=>'What got you started on '+p+'?',p=>'Which part of '+p+' do you enjoy most?'],
    coding:[p=>'What has been the hardest part of '+p+' so far?',p=>'What would make '+p+' feel finished to you?'],
    music:[p=>'What first drew you to '+p+'?',p=>'When do you find yourself coming back to '+p+'?'],
    writing:[p=>'What made you start on '+p+'?',p=>'What do you want '+p+' to feel like?'],
    art:[p=>'What do you like most about '+p+'?',p=>'How did you first get into '+p+'?'],
    general:[p=>'What do you like most about '+p+'?',p=>'What got you interested in '+p+'?']
  };
  function nextQuestion(topic,step,answer,asked){
    const seen=asked||[];
    if(typeof answer==='string')for(const [cue,q] of (tailored[topic]||[]).concat(anyTopic))if(cue.test(answer)&&!seen.includes(q))return q;
    const phrase=seen.length%2===0?focusPhrase(answer):null;
    if(phrase){const t=phraseQuestions[topic]||phraseQuestions.general;for(let i=0;i<t.length;i++){const q=t[((seen.length)+i)%t.length](phrase);if(!seen.includes(q))return q;}}
    const q=questions[topic]||questions.general;return step<q.length?q[step]:'Would you like to keep talking about this, or pick another subject?';
  }
  // Short acknowledgements for follow-up answers; the answer itself stays in the discourse record.
  const acknowledgements={gentle:['Thank you for telling me.','I’m listening.','That makes sense.'],direct:['Understood.','Okay.','Got it.'],default:['I’m with you.','Mm, okay.','Thanks for sharing that.','That’s good to know.']};
  // A short answer is echoed back verbatim (never rewritten) so the reply visibly responds to it.
  const echoes=[a=>'“'+a+'” — noted.',a=>'“'+a+'.” Got it.',a=>a+' — that gives me a clearer picture.'];
  const acknowledge=(topic,persona,turn,answer)=>{
    const gentle=['support','feelings','repair'].includes(topic),a=gentle?acknowledgements.gentle:persona==='direct'?acknowledgements.direct:acknowledgements.default;
    const quote=typeof answer==='string'?answer.trim().replace(/[.!?\s]+$/,''):'';
    if(!gentle&&quote&&quote.length<=60&&quote.split(/\s+/).length>=3)return echoes[turn%echoes.length](quote);
    return a[turn%a.length];
  };
  Object.assign(K,{parseConversation,conversationTopic:topicCue,nextConversationQuestion:nextQuestion,conversationQuestions:questions,focusPhrase,acknowledge});
})(Kira);

