'use strict';
// Discourse adapter: preserves raw reports and records question/answer links.
// Topic cues select questions only; they never establish ontology or memory facts.
(function(K){
  const reserved=/\b(?:i|i'm|my|me|we|our|you|your|he|she|they|the|is|am|are|was|were|have|has|had|do|does|did|would|could|just|mostly|really|very|that|this|there|and|but|because|or|if|not|happy|sad|tired|lonely|anxious|angry|excited|calm|okay|fine|overwhelmed|building|working|writing|making|coding|feeling|from|years|old|hello|hi|hey|thanks|yes|no|sure)\b/i;
  K.isConversationName=s=>typeof s==='string'&&s.length<=50&&/^[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*(?: [\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*){0,3}$/u.test(s)&&!reserved.test(s);
  // Unchecked word -> topic tables. They only choose which questions to ask; they never create ontology
  // claims or memories. Authored theme packs are the specific signal and outrank both the generic curated
  // lexicon and the WordNet-derived table, which is the last resort.
  let wordTables=null;
  function wordTopic(table,word){
    if(!wordTables){
      const pack=new Map(),wordnet=new Map();
      for(const [topic,list] of Object.entries(K.WORDNET_TOPICS||{}))for(const w of list.split(','))wordnet.set(w,topic);
      for(const [topic,p] of Object.entries(K.THEME_PACKS||{}))for(const w of p.words)pack.set(w,topic);
      wordTables={pack,wordnet};
    }
    const forms=[word];
    if(/ies$/.test(word))forms.push(word.slice(0,-3)+'y');
    if(/(?:ses|xes|zes|ches|shes)$/.test(word))forms.push(word.slice(0,-2));
    if(/s$/.test(word))forms.push(word.slice(0,-1));
    for(const form of forms){const topic=wordTables[table].get(form);if(topic)return topic;}
    return null;
  }
  // Topics named by the words of a phrase, most votes first; ties go to the earliest word.
  function tableVotes(table,words){
    const votes=new Map();
    for(let i=0;i<words.length;i++){
      const topic=(i+1<words.length&&wordTopic(table,words[i]+' '+words[i+1]))||wordTopic(table,words[i]);
      if(topic)votes.set(topic,(votes.get(topic)||0)+1);
    }
    return [...votes.keys()].sort((a,b)=>votes.get(b)-votes.get(a));
  }
  const tableCue=(table,words)=>tableVotes(table,words)[0]||null;
  // Every topic a phrase touches, strongest source first: a lone concept, theme-pack words, curated
  // concepts inside the sentence, then WordNet. The ring field uses all of them, not just the first.
  function topicList(text,engine){
    const out=[],add=t=>{if(t&&!out.includes(t))out.push(t);};
    const words=K.fold(text).replace(/[.,!?]/g,' ').split(/\s+/).filter(Boolean).slice(0,60);
    const exact=engine.lookup(text);if(exact.length===1)add(engine.topicFor(exact[0]));
    for(const t of tableVotes('pack',words))add(t);
    for(let size=Math.min(4,words.length);size>0;size--)for(let i=0;i+size<=words.length;i++){const m=engine.lookup(words.slice(i,i+size).join(' '));if(m.length===1)add(engine.topicFor(m[0]));}
    for(const t of tableVotes('wordnet',words))add(t);
    return out;
  }
  const topicCue=(text,engine)=>{
    const t=K.fold(text);
    if(engine){
      const exact=engine.lookup(text);if(exact.length>1)return null;if(exact.length===1)return engine.topicFor(exact[0]);
      const words=t.replace(/[.,!?]/g,' ').split(/\s+/).filter(Boolean).slice(0,60);
      const authored=tableCue('pack',words);if(authored)return authored;
      for(let size=Math.min(4,words.length);size>0;size--)for(let i=0;i+size<=words.length;i++){const matches=engine.lookup(words.slice(i,i+size).join(' '));if(matches.length===1){const topic=engine.topicFor(matches[0]);if(topic)return topic;}}
      return tableCue('wordnet',words);
    }
    for(const [key,re] of [['gaming',/\b(?:game|games|gaming|dating sim|rpg)\b/],['coding',/\b(?:code|coding|programming|software|app|engine)\b/],['music',/\b(?:music|song|songs|album|guitar|metal|rap)\b/],['writing',/\b(?:writing|novel|poem|story|stories)\b/],['coffee',/\bcoffee\b/]])if(re.test(t))return key;
    return null;
  };
  function parseConversation(input,state,engine){
    const raw=K.nfc(input).trim(),text=raw.replace(/[’‘]/g,"'"),pending=state.context.pending;
    const base=(s=text)=>K.parseInput(s,state,engine);
    const finish=r=>({...r,text:raw,version:'conversation-parser/4.4.0'});
    const relocate=(r,offset)=>{
      // Pending sense resolution retains spans in the original source message. Fresh parses use
      // offsets into this raw message, including uncommitted candidate frames awaiting a choice.
      if(!r.sourceMessage)for(const frame of new Set([...(r.frames||[]),...(r.candidateFrames||[]),r.ambiguity].filter(Boolean)))frame.span={start:frame.span.start+offset,end:frame.span.end+offset};
      return r;
    };
    if(/^(?:remember (?:this|that)|note):?\s+/i.test(text))return finish(base(raw));
    const questionReply=(answer,thread)=>finish({intent:'c:topic',speechAct:'answer',supported:true,frames:[],quoted:[],followUp:{answer,question:thread.question,questionMessage:thread.questionMessage,topic:thread.topic,step:thread.step||0,asked:thread.asked||[]},reason:null});
    // Do not turn a quoted or explicitly conditional statement into a report.
    const protectedText=/["“”]|^(?:if|suppose|imagine|maybe|perhaps)\b/i.test(text);
    // Conversation controls take precedence over a pending answer. Otherwise a refusal is echoed as
    // if it supplied a detail, and the next question continues the subject the user just declined.
    if(!protectedText){
      const command=K.fold(text).replace(/[.!?]+$/,'').trim().replace(/^please\s+/,'').replace(/,?\s+please$/,'');
      const control=(kind,reason)=>finish({intent:'c:clarify',speechAct:'request',supported:false,frames:[],quoted:[],control:kind,reasonCode:'conversation_control',reason});
      if(/^(?:stop asking(?: me)?(?: any| more)? questions|no more questions|(?:don't|do not) ask(?: me)?(?: any)?(?: more)? questions)$/.test(command))return control('stop_questions','Okay. I’ll leave the questions there. You can lead the conversation.');
      if(/^(?:ask me (?:a|another) question|you can ask(?: me)? questions(?: again)?|(?:start|resume) asking(?: me)? questions(?: again)?)$/.test(command))return control('resume_questions','Okay. What would you like to talk about?');
      if(/^(?:(?:let's|can we|could we) )?(?:(?:change|switch)(?: the)? (?:subject|topics?)|talk about something else)$/.test(command)||command==='something else'&&pending?.kind==='detail')return control('change_subject','Of course. We can talk about something else.');
      if(/^(?:no thanks|no thank you|not now|i(?:'d| would) rather not(?: (?:talk(?: about)?|discuss)(?: (?:it|that|this))?)?|i (?:don't|do not) want to (?:talk(?: about)?|discuss)(?: (?:it|that|this))?(?: anymore)?|(?:let's )?leave it(?: there)?|drop (?:it|the subject))$/.test(command)||['detail','support','offer'].includes(pending?.kind)&&/^(?:no|nope|not really)$/.test(command))return control('decline','That’s okay. We can leave it there.');
    }
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
        const parsed=parts.map(p=>relocate(base(p.text),p.offset));
        const social=new Set(['c:greet','c:how','c:about','c:thanks','c:joke','c:prompt']);
        if(parsed.every(r=>r.supported&&(r.frames.length||social.has(r.intent)))){
          const frames=parsed.flatMap(r=>r.frames),acts=parsed.filter(r=>!r.frames.length&&r.intent!=='c:greet');
          if(frames.length>12)return finish({intent:'c:clarify',speechAct:'clarification',supported:false,frames:[],quoted:[],reasonCode:'compound',reason:'Please give me up to twelve reports in one message. I haven’t saved any part of that batch.'});
          const primary=frames.length?parsed.find(r=>r.frames.length):parsed.find(r=>r.intent!=='c:greet')||parsed[0];
          return finish({...primary,frames,negativeMood:parsed.some(r=>r.negativeMood),greeted:!!salutation||parsed.some(r=>r.intent==='c:greet'),afterActs:frames.length?acts:acts.filter(r=>r!==primary),parts:parsed});
        }
        // Never fall through to pending-answer handling and commit partial reports.
        return finish({...base(),reasonCode:'compound',reason:'There are a few parts there. Could we take the first one on its own? I haven’t saved any of those reports.'});
      }
      // A reason is kept as a conversational quote, separately from the asserted report.
      const because=body.match(/^(.+?)\s+because\s+(.+)$/i);
      if(because){const r=relocate(base(because[1]),offset);if(r.supported&&r.frames.length&&r.frames.every(f=>['preference','mood'].includes(f.kind)))return finish({...r,greeted:!!salutation,elaboration:raw.slice(text.indexOf(because[2],offset))});}
      if(salutation){const r=relocate(base(body),offset);if(r.supported||r.ambiguity)return finish({...r,greeted:true});}
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
    // Feedback concerns the conversation itself, rather than the detail we happened to ask for.
    // Match complete feedback or an explicit reply reference: "generic types", a "template renderer"
    // and "I do not understand recursion" are substantive answers, not requests to repair this chat.
    if(!protectedText&&parsed.reasonCode==='unparsed'){
      const feedback=text.replace(/[.!?]+$/,'').trim().replace(/^kira[, :]\s*/i,'').replace(/^please\s+/i,'').replace(/,?\s+please$/i,'');
      const bare=/^(?:(?:i )?(?:don't|do not) understand(?: (?:you|that|this|it))?|(?:(?:that|this|it) )?(?:doesn't|does not) work|not listening|generic|robotic|templated|template)$/i;
      const reply=/^(?:(?:your|these|those|the|that|this)(?: last)? (?:repl(?:y|ies)|responses?|questions?|answers?|wording|conversation)|you)(?: (?:are|is|sound|sounds|seem|seems|feel|feels)(?: too| very| so)? (?:generic|robotic|templated)| (?:don't|do not|doesn't|does not) (?:work|make sense|listen)|(?:'re| are) not listening)$/i;
      const understanding=/^i (?:don't|do not) understand (?:your|the|that|this)(?: last)? (?:reply|response|question|answer|wording|conversation)$/i;
      const correction=/^(?:(?:you )?already asked(?: me)?(?: that| this)?|(?:that|this) (?:is not|isn't|was not|wasn't) what i said|i (?:didn't|did not) say that|(?:(?:can|could|would) you )?rephrase(?: (?:that|this|it|(?:your|the)(?: last)? (?:reply|response|question|answer)))?)$/i;
      if([bare,reply,understanding,correction].some(pattern=>pattern.test(feedback)))return finish({...parsed,repair:true});
    }
    // Questions always beat a pending answer; safety/negation/attribution failures stay failures.
    const yesNo=/^(?:yes|yeah|yep|sure|no|nope|not really|okay|ok)[.!]*$/i.test(text);
    if(pending?.kind==='detail'&&!protectedText&&!/\?$/.test(text)&&(parsed.reasonCode==='unparsed'||yesNo)&&!/^\s*(?:i (?:might|think|wish)|do i|what|who|why|how|can you|could you)\b/i.test(text))return questionReply(raw,pending);
    if(!protectedText&&parsed.reasonCode==='unparsed'&&/^i(?:'m| am)\s+(?:building|working on|writing|making|coding|creating)\s+.+/i.test(text))return finish({intent:'c:topic',speechAct:'statement',supported:true,frames:[],quoted:[],activity:raw,topicHint:topicCue(raw),reason:null});
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
    music:[[/\b(?:guitar|bass|drums?|piano|keys|synth|violin|sing|singing|vocals?)\b/i,'Do you play it yourself, listen to it, or both?'],[/\b(?:lyrics?|songwriting|write|writing)\b/i,'Where do your songs usually start, with a line, a sound, or a feeling?'],[/\b(?:metal|rock|punk|rap|hip-?hop|jazz|folk|pop|electronic|classical)\b/i,'What is it about that sound that works for you?'],[/\b(?:producing|production|mixing|recording|daw|beats?)\b/i,'What does your setup look like when you sit down to make something?']],
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
    // Places, reasons and time/frequency answers are useful discourse, but cannot fill a noun slot.
    if(/^(?:at|in|on|to|from|with|without|by|for|about|because|during|after|before|under|over|around|through|every|each|all|once|twice)\b/i.test(t)||/^(?:usually|sometimes|often|always|never|daily|weekly|recently|yesterday|today|tomorrow|tonight)$/i.test(t))return null;
    if(/^(?:yes|yeah|yep|no|nope|nothing|something|anything|everything|it|that|this|them|stuff|things?|idk|maybe|sure|not sure)$/i.test(t))return null;
    if(/\b(?:i|i'm|i've|me|my|you|your|we|is|are|was|were|be|do|does|did|not|don't|can't|won't|matters?|means?|helps?|works?|feels?|gets?|seems?|looks?|makes?|goes|takes?|keeps?|needs?|wants?|loves?|likes?)\b/i.test(t))return null;
    // A sentence-initial capital is only lowercased when the next word is lowercase ("Pixel platformers", not "Stardew Valley" or "Godot").
    return words.length>1&&/^\p{Lu}\p{Ll}+$/u.test(words[0])&&/^\p{Ll}/u.test(words[1])?t[0].toLowerCase()+t.slice(1):t;
  }
  const phraseQuestions={
    gaming:[p=>'What got you started on '+p+'?',p=>'Which part of '+p+' do you enjoy most?'],
    coding:[p=>'What has been the hardest part of '+p+' so far?',p=>'What would make '+p+' feel finished to you?'],
    music:[p=>'What first drew you to '+p+'?',p=>'When do you find yourself coming back to '+p+'?'],
    writing:[p=>'What made you start on '+p+'?',p=>'What do you want '+p+' to feel like?'],
    art:[p=>'What do you like most about '+p+'?',p=>'How did you first get into '+p+'?'],
    general:[p=>'What do you ⟦like most|enjoy most|find best⟧ about '+p+'?',p=>'What ⟦@interest⟧ '+p+'?']
  };
  // Topics added with the 4.4 vocabulary. Each has a question ladder, answer-aware cues and phrase questions.
  Object.assign(questions,{
    sports:['Do you play it yourself, or mostly watch?','What do you love most about it: the game, the people, or the way it feels?','Is there a memory you have attached to it?','Is there a team, a routine, or a place you associate with it?','What would you like to get better at, or see more of?'],
    screen:['What have you been watching lately?','What made it stick with you?','Do you prefer watching alone or with someone?','Is there a character you keep thinking about?','What would you tell someone to start with?'],
    pets:['What are they like?','What is their name, if you’d like to share it?','What is a habit of theirs that makes you smile?','How did they come into your life?','What does an ordinary day together look like?'],
    people:['What are they like?','What do you two usually do together?','What do you appreciate most about them?','Is there something you’d like them to know?','How long have you known each other?'],
    travel:['Is that a place you’ve been, or one you’re dreaming about?','What draws you there?','What would a perfect day there look like?','Do you like to plan every step, or wander?','What would you bring back with you?'],
    weather:['How does it make you feel?','Do you like being out in it, or watching it from inside?','Is there a memory you connect to it?','What’s your favourite thing to do when it’s like that?'],
    school:['Are you in it now, or looking back on it?','What is the part you enjoy most?','What is the part that wears you down?','Who made a difference to you there?','What would you like to learn next?'],
    work:['What does a normal day look like?','What part do you enjoy most?','What part wears on you?','Who do you work with, and how is that?','What would you change about it if you could?'],
    hobbies:['What got you started?','What is the part where you lose track of time?','Is there something you made that you’re especially proud of?','Do you do it alone, or with others?','What would you like to try next?'],
    home:['What is your favourite part of it?','What does a quiet evening look like there?','Is there something in it that matters more than it looks?','What would you change if you could?','Who or what makes it feel like home?']
  });
  // Longer ladders for the older topics, so a conversation does not run out after three questions.
  const longer={
    gaming:['What would make you proud to show it to someone?','Who would you most like to play it?'],
    coding:['What would you do differently if you started over?','How will you know when it’s ready?'],
    music:['Is there a song that marks a particular time in your life?','If you could hear it live anywhere, where would it be?'],
    writing:['What is the first line you’d want a stranger to read?','Where do you write best?'],
    coffee:['What would the perfect cup look like?','Is there a place you have it that matters to you?'],
    nature:['What would you want to learn about it?','Which season is it best in?'],
    science:['What would you do with the answer if you had it?','Who first made you curious about it?'],
    cooking:['What would you make for someone you wanted to look after?','Is there a dish that reminds you of someone?'],
    reading:['Is there a book you would give to someone you care about?','Where do you read best?'],
    art:['What would you want to make next?','Who has shaped the way you look at things?'],
    hiking:['What would you pack for it?','What is the best view you remember?'],
    general:['What would you like to say about it that you haven’t yet?']
  };
  for(const [topic,more] of Object.entries(longer))questions[topic]=questions[topic].concat(more);
  Object.assign(tailored,{
    sports:[[/\b(?:team|club|league|season|fans?)\b/i,'What is it like being part of that?'],[/\b(?:won|win|lost|lose|score[ds]?|match|final)\b/i,'What was the moment that stuck with you?'],[/\b(?:injur\w*|hurt|sore|pain)\b/i,'How are you looking after yourself while that heals?'],[/\b(?:learn\w*|practice|train\w*|improv\w*|better)\b/i,'What does practice look like for you?'],[/\b(?:friends?|family|dad|mom|kids?)\b/i,'Who do you usually do that with?']],
    screen:[[/\b(?:horror|scary|thriller)\b/i,'What is it about being a little frightened that you enjoy?'],[/\b(?:anime|animated|cartoons?)\b/i,'What does the animation give you that live action doesn’t?'],[/\b(?:comedy|funny|sitcom|laugh\w*)\b/i,'What was the last thing that made you actually laugh?'],[/\b(?:sci-?fi|space|future)\b/i,'What future would you want to see on screen?'],[/\b(?:rewatch\w*|again|favou?rite)\b/i,'What do you find when you come back to it?'],[/\b(?:characters?|actors?|actress)\b/i,'What is it about that character that works for you?']],
    pets:[[/\b(?:adopt\w*|rescue\w*|found|shelter)\b/i,'What was the day you met like?'],[/\b(?:walk\w*|park|outside|runs?)\b/i,'Where do you like to go together?'],[/\b(?:sick|vet|passed|died|lost)\b/i,'That sounds like it matters a lot. Would you like to tell me about them?'],[/\b(?:funny|silly|weird|quirk\w*)\b/i,'What is the funniest thing they have done?'],[/\b(?:sleep\w*|naps?|cuddl\w*)\b/i,'Where do they like to settle down?']],
    people:[[/\b(?:miss\w*|far|away|long distance|moved)\b/i,'How do you stay in touch?'],[/\b(?:visit\w*|coming|dinner|together)\b/i,'What are you hoping the time together looks like?'],[/\b(?:argu\w*|fight|fought|upset|angry|mad)\b/i,'That sounds uncomfortable. What do you wish they understood?'],[/\b(?:birthday|wedding|party|celebrat\w*)\b/i,'What would make the day feel special?'],[/\b(?:proud|love|adore)\b/i,'What is the story behind that?']],
    travel:[[/\b(?:plan\w*|booked|book|itinerary|tickets?|flight)\b/i,'How much of it have you planned, and how much are you leaving open?'],[/\b(?:food|eat|restaurants?|cuisine)\b/i,'What do you most want to taste there?'],[/\b(?:alone|solo|by myself)\b/i,'What do you like about travelling on your own?'],[/\b(?:friends?|family|together|partner|wife|husband)\b/i,'Who’s coming with you?'],[/\b(?:beach|mountains?|city|village|island|forest)\b/i,'What is it about that kind of place for you?'],[/\b(?:spring|summer|winter|autumn)\b/i,'What is it about that time of year that appeals to you?']],
    weather:[[/\b(?:hate|can't stand|freezing|grey|gray|gloomy|dark)\b/i,'What helps you get through days like that?'],[/\b(?:love|cozy|cosy|warm|sunny|bright)\b/i,'What do you do when it’s like that?'],[/\b(?:snow\w*|rain\w*|storm\w*|thunder\w*)\b/i,'What do you like about the sound of it?'],[/\b(?:walk|outside|outdoors|hike)\b/i,'Where do you like to be when it’s like that?']],
    school:[[/\b(?:exams?|test|finals|deadlines?|due|assignments?|homework)\b/i,'How are you handling the pressure?'],[/\b(?:teachers?|professors?|tutors?)\b/i,'What did they do that stuck with you?'],[/\b(?:friends?|classmates?)\b/i,'What is it like having them around?'],[/\b(?:math\w*|science|history|english|physics|biology|chemistry)\b/i,'What is it about that subject that holds you?'],[/\b(?:stress\w*|tired|overwhelm\w*|behind)\b/i,'What is one thing that would make this week lighter?']],
    work:[[/\b(?:boss|manager|supervisor)\b/i,'What is it like working with them?'],[/\b(?:deadlines?|busy|overtime|swamped|behind|stress\w*)\b/i,'What would make the week feel more manageable?'],[/\b(?:quit\w*|leaving|new job|interviews?|offer)\b/i,'What are you hoping the next thing looks like?'],[/\b(?:remote|office|commute)\b/i,'How does that setup suit you?'],[/\b(?:team|colleagues?|coworkers?)\b/i,'What are they like to work with?'],[/\b(?:projects?|launch\w*|ship\w*)\b/i,'What would make the project feel finished?']],
    hobbies:[[/\b(?:learn\w*|beginner|started|new)\b/i,'What has been the hardest part to get the hang of?'],[/\b(?:proud|finished|made|built|grew|grown)\b/i,'What was it like to see it done?'],[/\b(?:relax\w*|calm|quiet|peace\w*)\b/i,'What changes in you while you do it?'],[/\b(?:friends?|family|group|club)\b/i,'Who do you share it with?']],
    home:[[/\b(?:sleep\w*|naps?|tired|bed|insomnia|rest)\b/i,'What helps you wind down at the end of the day?'],[/\b(?:clean\w*|tidy\w*|mess\w*|clutter\w*)\b/i,'Does a tidy space change how you feel?'],[/\b(?:garden|balcony|yard|plants?)\b/i,'What grows or lives there?'],[/\b(?:moving|moved|new place|rent\w*)\b/i,'What are you hoping the new place feels like?'],[/\b(?:cozy|cosy|candle|blanket)\b/i,'What makes it feel cosy for you?']]
  });
  Object.assign(phraseQuestions,{
    sports:[p=>'What first got you into '+p+'?',p=>'When does '+p+' feel best for you?'],
    screen:[p=>'What drew you to '+p+'?',p=>'Who would you tell to watch '+p+'?'],
    pets:[p=>'What do you love most about '+p+'?',p=>'What does a good day look like for '+p+'?'],
    people:[p=>'What do you love about '+p+'?',p=>'What is '+p+' like when you’re together?'],
    travel:[p=>'What draws you to '+p+'?',p=>'What would you do first in '+p+'?'],
    weather:[p=>'What do you like about '+p+'?',p=>'What does '+p+' bring up for you?'],
    school:[p=>'What do you enjoy most about '+p+'?',p=>'What has '+p+' taught you so far?'],
    work:[p=>'What do you like most about '+p+'?',p=>'What would you change about '+p+'?'],
    hobbies:[p=>'What got you into '+p+'?',p=>'What is the best part of '+p+'?'],
    home:[p=>'What do you love about '+p+'?',p=>'What makes '+p+' feel like yours?']
  });
  function nextQuestion(topic,step,answer,asked){
    const seen=asked||[];
    if(typeof answer==='string')for(const [cue,q] of (tailored[topic]||[]).concat(anyTopic))if(cue.test(answer)&&!seen.includes(q))return q;
    const phrase=seen.length%2===0?focusPhrase(answer):null;
    if(phrase){const t=phraseQuestions[topic]||phraseQuestions.general;for(let i=0;i<t.length;i++){const q=t[((seen.length)+i)%t.length](phrase);if(!seen.includes(q))return q;}}
    // Ladder questions already asked in this topic (even earlier in the conversation) are skipped.
    const q=questions[topic]||questions.general;
    for(let i=step;i<q.length;i++)if(!seen.includes(q[i]))return q[i];
    return 'Would you like to keep talking about this, or pick another subject?';
  }
  // Short acknowledgements for follow-up answers; the answer itself stays in the discourse record.
  const acknowledgements={gentle:['Thank you for ⟦@sharing⟧.','I’m listening.','That makes sense.'],direct:['⟦@ack⟧.'],default:['I’m with you.','⟦@ack⟧.','Thanks for ⟦@sharing⟧.','That’s good to know.']};
  // A short answer is echoed back verbatim (never rewritten) so the reply visibly responds to it.
  const echoes=[a=>'“'+a+'” — ⟦@noted⟧.',a=>'“'+a+'.” ⟦@ack⟧.',a=>a+' — ⟦that gives me a clearer picture|that helps me see it|that fills in the picture⟧.'];
  const acknowledge=(topic,persona,turn,answer)=>{
    const gentle=['support','feelings','repair'].includes(topic),a=gentle?acknowledgements.gentle:persona==='direct'?acknowledgements.direct:acknowledgements.default;
    const quote=typeof answer==='string'?answer.trim().replace(/[.!?\s]+$/,''):'';
    if(!gentle&&quote&&quote.length<=60&&quote.split(/\s+/).length>=3)return echoes[turn%echoes.length](quote);
    return a[turn%a.length];
  };
  Object.assign(K,{parseConversation,conversationTopic:topicCue,conversationTopics:topicList,nextConversationQuestion:nextQuestion,conversationQuestions:questions,conversationTailored:tailored,conversationPhrases:phraseQuestions,focusPhrase,acknowledge});
})(Kira);

