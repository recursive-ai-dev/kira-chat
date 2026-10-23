'use strict';
// Bounded English grammar. This is an auditable interpretation, not a proof of NLU.
(function(K){
  const negativeMoods=new Set(['sad','unhappy','tired','lonely','anxious','angry','overwhelmed','frustrated','worried','disappointed','restless','stressed','depressed','scared','upset','exhausted','nervous','down']);
  const moods=['happy','glad','sad','unhappy','tired','lonely','anxious','angry','excited','calm','okay','ok','fine','overwhelmed','good','great','alright','well','stressed','depressed','scared','upset','exhausted','nervous','down','bored','relaxed','content'];
  // Trailing emphasis that does not change what is reported.
  const trailing=/\s+(?:a lot|so much|very much|a ton|too|as well|anymore|now|these days|lately)$/i;
  // Hard news gets a gentle reply instead of a generic follow-up question.
  const loss=/\b(?:died|passed away|passed on|put (?:him|her|them|it) down|was put down|funeral|lost my (?:job|mom|mum|mother|dad|father|brother|sister|friend|partner|wife|husband|dog|cat|grandma|grandpa|grandmother|grandfather)|broke up|dumped me|got fired|was fired|laid off|getting divorced|got divorced)\b/;
  function parseInput(input,state,engine){
    const text=K.nfc(input).trim(),lower=K.fold(text),core=lower.replace(/[.!?]+$/,'').trim();
    const result=(intent,extra={})=>({version:'parser/4.4.0',text,intent:'c:'+intent,speechAct:'statement',frames:[],quoted:[],supported:true,reason:null,...extra});
    const clarify=reason=>result('clarify',{supported:false,reason});
    let clauseOffset=0;
    const span=v=>{
      const exact=text.indexOf(v,clauseOffset),match=exact<0?new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'iu').exec(text.slice(clauseOffset)):null;
      const start=exact>=0?exact:match?clauseOffset+match.index:clauseOffset;
      return {start,end:start+(match?match[0].length:v.length)};
    };
    const original=v=>{const i=lower.lastIndexOf(v);return i<0?v:text.slice(i,i+v.length);};
    const object=v=>{
      const raw=v.trim(),possessed=raw.match(/^(?:my|our)\s+(.+)$/i);
      const label=raw.replace(/\b(?:myself|ourselves)\b/gi,m=>m.toLowerCase()==='myself'?'yourself':'yourselves').replace(/\b(?:my|our)\b/gi,'your');
      if(possessed){
        // "my dog" is a specific thing, not the general concept: keep it as its own key but remember the concept for topics.
        const candidates=engine.lookup(possessed[1]);
        return {label,candidates,concept:candidates.length===1?candidates[0]:null,key:'literal:'+K.hash(K.fold(label))};
      }
      const candidates=engine.lookup(label);
      return {label,candidates,concept:candidates.length===1?candidates[0]:null,key:candidates.length===1?candidates[0]:'literal:'+K.hash(K.fold(label))};
    };
    if(!text||text.length>2000)return clarify('A message must contain 1–2000 characters.');
    if(/\bnot\s+not\b|\b(?:don't|do not)\s+not\b/.test(lower))return clarify('The repeated negation has more than one plausible reading. Please say the intended feeling or preference directly.');
    if(/^i\b/i.test(text)&&/\?$/.test(text))return clarify('Is that a statement about you, or a question? I haven’t saved it as a report.');
    let m;
    if((m=text.match(/^(?:remember (?:this|that)|note):?\s+(.+)$/i))){
      const label=m[1];
      return result('note',{frames:[{kind:'note',subject:'user',predicate:'said',object:{label,candidates:[],concept:null,key:'literal:'+K.hash(K.fold(label))},polarity:'positive',temporal:'recorded',span:span(label),attribution:'user_note'}]});
    }
    // A note can contain quotes and question marks. Forgetting names a record; it asserts no report.
    if((m=text.match(/^(?:forget|stop remembering)\s+(.+)$/i)))return result('forget',{speechAct:'request',object:object(m[1].replace(/[.!?]+$/,'')),rawObjectLabel:m[1]});
    const quotes=[...text.matchAll(/["“]([^"”]*)["”]/g)].map(m=>({start:m.index,end:m.index+m[0].length,text:m[1]}));
    if(quotes.length||/^(?:my friend|my partner|someone|he|she|they|alex)\s+(?:said|says|thinks|likes|loves|feels)\b/.test(lower))return result('clarify',{supported:false,reason:'That looks like quoted or reported speech. I have not saved it as a fact about you. Use “Remember this: …” to keep it as an attributed note.',quoted:quotes});
    if(/^(?:please\s+)?(?:don't|do not)\s+(?:say\s+)?(?:goodbye|bye|leave)(?:\s+.*)?$/.test(core)||core==='stay with me')return result('stay',{speechAct:'request'});
    if(/^(?:i (?:want to|might|am going to) (?:kill|hurt) myself|i(?:'m| am) suicidal|i (?:don't|do not) want to (?:live|exist))\b/.test(core))return result('crisis',{speechAct:'support_request'});
    if(/^(?:if |suppose |imagine |maybe |perhaps |i might |i think i |i wish i )/.test(core))return clarify('I can’t reliably distinguish the hypothetical or uncertain parts of that sentence. I won’t turn it into a definite memory.');
    if(/^(?:stop flirting|no flirting|keep (?:this|it) platonic|just friends)$/.test(core))return result('boundary',{value:'platonic',speechAct:'request'});
    if(/^(?:flirt with me|we can flirt|a little flirting is okay)$/.test(core))return result('boundary',{value:'flirty',speechAct:'request'});
    if(['topicSense','semanticSense'].includes(state.context.pending?.kind)){
      const p=state.context.pending,chosen=p.choices.find((c,i)=>core===String(i+1)||core===K.fold(c.label)||c.aliases.some(x=>core===K.fold(x)));
      if(chosen){
        if(p.kind==='topicSense')return result('topic',{object:{label:chosen.label,candidates:[chosen.id],concept:chosen.id,key:chosen.id},speechAct:'clarification'});
        const draft=K.clone(p.draft);draft[p.slot]=[chosen.id];return semanticDraft(draft);
      }
    }
    if(state.context.pending?.kind==='sense'){
      const p=state.context.pending;
      const chosen=p.choices.find((c,i)=>core===String(i+1)||core===K.fold(c.label)||c.aliases.some(x=>core===K.fold(x)));
      if(chosen){const frames=K.clone(p.frames||[p.frame]);for(const frame of frames)if(frame.object.key===p.frame.object.key){frame.object.concept=chosen.id;frame.object.key=chosen.id;frame.object.candidates=[chosen.id];}const unresolved=frames.find(f=>f.object.candidates.length>1);if(unresolved)return result('clarify',{supported:false,ambiguity:unresolved,candidateFrames:frames,sourceMessage:p.sourceMessage,reason:'There is one more ambiguous word.'});const frame=frames[0];return result(frames.every(f=>f.kind===frame.kind)?frame.kind:'note',{frames,object:frame.object,resolvedPending:true,sourceMessage:p.sourceMessage,speechAct:'clarification'});}
    }
    if(/^(?:(?:what|who) (?:can|do) you (?:do|help with)|how does this work|how do (?:i|you) use (?:this|you)|help|help me|can you help(?: me)?|what should (?:i|we) (?:say|talk about)|what else|what now|i don't know what to say|idk|any ideas)$/.test(core))return result('about',{speechAct:'question',aboutKind:'capabilities'});
    if(/^(?:are you (?:real|human|a (?:bot|robot|person|human|machine)|an ai|ai|alive|conscious|sentient)|do you have (?:feelings|emotions|a body)|are you an? (?:llm|chatbot)|what are you really)$/.test(core))return result('about',{speechAct:'question',aboutKind:'honest'});
    if((m=core.match(/^(?:do you (?:like|love|enjoy)|what do you think (?:of|about)|how do you feel about) (.+)$/)))return result('about',{speechAct:'question',aboutKind:'taste',object:object(original(m[1]))});
    if((m=core.match(/^(?:what(?:'s| is) your fav(?:ou?rite)?|do you have a fav(?:ou?rite)?) (.+)$/)))return result('about',{speechAct:'question',aboutKind:'favorite',object:object(original(m[1]))});
    const lastAct=state.lastPlan?.policy.secondaryActs?.at(-1)||state.lastPlan?.act;
    if(/^(?:another(?: one)?|one more|again|more)$/.test(core)&&['joke','prompt'].includes(lastAct))return result(lastAct);
    if(/^(?:lol|lmao|haha+|hehe+|ha(?: ha)+|that's funny|that was funny|good one|nice one)$/.test(core))return result('social',{socialKind:'laugh'});
    if(/^(?:cool|nice|neat|great|awesome|interesting|i see|got it|fair enough|true|hmm+|mm+|oh|ah|wow|right|alright|sounds good|makes sense|not much|nothing much|nothing)$/.test(core))return result('social',{socialKind:'ack'});
    if(loss.test(core))return result('support',{loss:true});
    if(/^(?:(?:can|could|would) you (?:please )?)?(?:remind me|tell me again) (?:what i (?:like|enjoy)|about my preferences)$/.test(core))return result('recall',{speechAct:'question',preferencesOnly:true});
    if(/^(?:do you remember my name|(?:(?:can|could|would) you (?:please )?)?remind me (?:of )?my name|(?:(?:can|could|would) you (?:please )?)?remind me what my name is|what name (?:did i tell you|do you have for me))$/.test(core))return result('recall',{speechAct:'question',nameOnly:true});
    if(/^(?:(?:can|could|would) you (?:please )?)?(?:remind me|tell me again) (?:what (?:you (?:remember|know) about me|i (?:have )?told you)|about me)$/.test(core))return result('recall',{speechAct:'question'});
    if((m=core.match(/^(?:(?:(?:can|could|would) you (?:please )?)?(?:remind me|tell me)|do you remember) (?:whether|if) i (like|love|enjoy|hate|dislike) (.+)$/)))return result('recall',{speechAct:'question',predicate:m[1],object:object(original(m[2]))});
    const fixed=[
      ['greet',/^(?:(?:hi|hello|hey|hiya|howdy|yo|heya|hullo|greetings|good (?:morning|afternoon|evening)|morning|evening)(?:,?\s+(?:there|kira|again|everyone|friend))*|hello,? how are you)$/],
      ['farewell',/^(?:bye|goodbye|good night|goodnight|see you|see ya|talk later)$/],
      ['how',/^(?:how are you|how are you doing|how are you today|how's it going|how have you been|what's up|sup|what are you thinking about|what are you up to)$/],
      ['about',/^(?:who are you|what are you|tell me about (?:you|yourself)|what do you like|what's your name|what is your name|what should i call you|introduce yourself)$/],
      ['thanks',/^(?:thanks|thank you|thank you kira|thanks kira|thank you so much|thanks a lot|thx|ty|thanks for listening|i appreciate (?:you|it|that))$/],
      ['affection',/^(?:i love you|i like you|i miss you|you're (?:beautiful|amazing|lovely)|you are (?:beautiful|amazing|lovely))$/],
      ['joke',/^(?:tell me a joke|tell me another joke|make me laugh|another joke|(?:do you )?know any jokes|say something funny)$/],
      ['prompt',/^(?:give me a writing prompt|writing prompt|tell me a story idea|another prompt)$/],
      ['why',/^(?:why|why did you say that|explain (?:that|your reply))$/],
      ['recall',/^(?:what do you remember(?: about me)?|what do you know about me|what have i told you|what do i like|what's my name|what is my name)$/],
      ['support',/^(?:i need (?:advice|support|someone to talk to|to talk)|can we talk|i had a (?:bad|rough|hard|terrible|long) day|(?:i'm|i am) having a (?:hard|rough|bad) (?:time|day|week)|(?:today|this week) (?:was|has been) (?:rough|hard|bad|terrible))$/]
    ];
    for(const [intent,pattern]of fixed)if(pattern.test(core))return result(intent,{speechAct:['how','about','recall','why'].includes(intent)?'question':'statement',nameOnly:/my name/.test(core),preferencesOnly:core==='what do i like'});
    if((m=core.match(/^do i (like|love|enjoy|hate|dislike) (.+)$/)))return result('recall',{speechAct:'question',predicate:m[1],object:object(m[2])});
    function semanticDraft(draft){
      for(const slot of ['a','b'])if(draft[slot]){if(!draft[slot].length)return clarify((draft.labels?.[slot]?'“'+draft.labels[slot]+'” isn’t in my vocabulary yet':'That term isn’t in my vocabulary yet')+', so I can’t answer reliably. You can browse the words I do know in Engine lab.');if(draft[slot].length>1)return result('clarify',{supported:false,semanticAmbiguity:{slot,draft,candidates:draft[slot]},reason:'Which meaning do you intend?'});}
      return result('semantic',{speechAct:'question',...(draft.op==='describe'?{definition:draft.a[0]}:{query:{op:'subsumes',a:draft.a[0],b:draft.b[0]}})});
    }
    if((m=core.match(/^is (.+?) (?:a kind of |a type of |an? )(.+)$/))||(m=core.match(/^are (?!you\b)(.+?) (?:a kind of |a type of )?(.+)$/)))return semanticDraft({op:'subsumes',a:engine.lookup(m[1]),b:engine.lookup(m[2]),labels:{a:m[1],b:m[2]}});
    if((m=core.match(/^(?:what is |what's )?(?:a )?more (formal|casual) (?:word|term) for (.+)$/))){
      const cs=engine.lookup(m[2]);if(cs.length!==1)return clarify('Which meaning do you want to restyle? Try “a more formal word for bike”.');
      const s=engine.a.senses.find(s=>s.cid===cs[0]&&K.fold(s.lemma)===m[2])||engine.a.senses.find(s=>s.id===engine.senseFor(cs[0]));
      return result('semantic',{speechAct:'question',query:{op:'shift',s:s.id,delta:[m[1]==='formal'?2000:-2000,0]}});
    }
    if((m=core.match(/^(?:what is|what's|what are|define)\s+(?:an? )?(.+)$/)))return semanticDraft({op:'describe',a:engine.lookup(m[1]),labels:{a:m[1]}});
    if((m=core.match(/^(?:tell me about|let's talk about|talk about) (.+)$/)))return result('topic',{object:object(m[1]),speechAct:'request'});
    if(/^(?:yes|yeah|yep|yes please|sure|ok|okay|no|nope|no thanks|not really)$/.test(core)){
      const no=/^(?:no|nope|no thanks|not really)$/.test(core),p=state.context.pending;
      if(p?.kind==='offer')return no?result('social',{socialKind:'decline'}):result(p.act);
      if(p?.kind==='support')return result('support',{answer:no?'no':'yes'});
      // A pending question or choice takes the answer; see parseConversation.
      if(['detail','confirmName','sense','topicSense','semanticSense'].includes(p?.kind))return {...clarify('I don’t have a reliable reading of that yet.'),reasonCode:'unparsed'};
      return result('social',{socialKind:no?'decline':'ack'});
    }
    // Multiple supported reports commit together; any unparsed clause rejects the batch.
    const prefix=text.match(/^(?:actually|correction)[:,]?\s*/i)?.[0]||'',body=text.slice(prefix.length),clauses=[];
    const separator=/(?:[.;]\s+|,?\s+but\s+|,?\s+and\s+(?=I\b)|,\s*(?=I(?:\b|'m\b|'ve\b)))/gi;
    let cursor=0;
    for(const split of body.matchAll(separator)){clauses.push({text:body.slice(cursor,split.index),offset:prefix.length+cursor});cursor=split.index+split[0].length;}
    clauses.push({text:body.slice(cursor),offset:prefix.length+cursor});
    const frames=[];
    for(const part of clauses){
      const clause=part.text.replace(/[.!?]+$/,'').trim();
      clauseOffset=part.offset+part.text.indexOf(clause);
      // A comparison needs two arguments; do not turn it into a malformed unary liking.
      if(/^i (?:(?:really|definitely|usually|generally) )?prefer\b/i.test(clause)&&/\s+(?:to|over|rather than|instead of)\s+/i.test(clause))return clarify('I can’t reliably save that comparison. Please give each direct preference separately, such as “I like tea”.');
      const c=K.fold(clause);let f=null;
      const favorite=clause.match(/^my (?:absolute )?fav(?:ou?rite)? [\p{L} ]{1,40}? (?:is|are) (.+)$/iu)||clause.match(/^(.+?) (?:is|are) my (?:absolute )?fav(?:ou?rite)?(?: [\p{L} ]{1,40})?$/iu);
      if(favorite&&!/^(?:it|that|this|them)$/i.test(favorite[1])&&favorite[1].length<=100&&!/[.;!?]/.test(favorite[1])){
        const piece=favorite[1].trim();
        frames.push({kind:'preference',subject:'user',predicate:'love',object:object(piece),polarity:'positive',temporal:'present',correction:false,span:span(piece),attribution:'user_reported',reference:null});
        continue;
      }
      if((m=clause.match(/^(?:my name(?: is|'s)|call me)\s+(.+)$/i))){
        const name=m[1].trim();if(!K.isConversationName(name))return {...clarify('What name would you like me to use?'),askName:true};
        f={kind:'name',subject:'user',predicate:'name',object:object(name),polarity:'positive',temporal:'present',span:span(name),attribution:'user_reported'};
      }else {
        // Keep original captures and offsets instead of reparsing rewritten strings. The surface
        // phrase can change while its predicate, polarity, tense and source span stay explicit.
        let preference=null;
        const pref=(predicate,label,polarity='positive',temporal='present',correction=false,labelOffset=clause.length-label.length)=>({predicate,label,polarity,temporal,correction,labelOffset});
        if((m=clause.match(/^i\s+(?:(?:really|truly|absolutely|totally|genuinely|honestly|just|also|still|kind of|kinda|sort of)\s+)?(?:(used to)\s+)?(?:(don't|do not|didn't|did not)\s+)?(?:(?:really|even|actually)\s+)?(like|love|enjoy|hate|dislike)\s+(.+)$/i)))preference=pref(m[3].toLowerCase(),m[4],m[2]?'negative':'positive',m[1]||/^did/i.test(m[2]||'')?'past':'present');
        else if((m=clause.match(/^i\s+no longer\s+(like|love|enjoy|hate|dislike)\s+(.+)$/i)))preference=pref(m[1].toLowerCase(),m[2],'negative','present',true);
        else if((m=clause.match(/^i(?:'m| am| have|'ve)(?: been)? not (?:really )?(?:into|a fan of|keen on|fond of)\s+(.+)$/i)))preference=pref('like',m[1],'negative');
        else if((m=clause.match(/^i(?:'m| am| have|'ve)(?: been)? (?:really |so |totally |way |very much )?(into|a fan of|obsessed with|hooked on|keen on|crazy about|fond of)\s+(.+)$/i)))preference=pref(m[1].toLowerCase()==='fond of'?'like':'love',m[2]);
        else if((m=clause.match(/^i (can(?:'t|not)|can not|couldn't) (?:stand|bear)\s+(.+)$/i)))preference=pref('hate',m[2],'positive',m[1].toLowerCase()==="couldn't"?'past':'present');
        else if((m=clause.match(/^i (?:(?:really|definitely|usually|generally) )?(?:prefer|fancy|adore|dig)\s+(.+)$/i)))preference=pref('like',m[1]);
        else if((m=clause.match(/^i(?:'ve| have) always (loved|liked|enjoyed|hated|disliked)\s+(.+)$/i)))preference=pref({loved:'love',liked:'like',enjoyed:'enjoy',hated:'hate',disliked:'dislike'}[m[1].toLowerCase()],m[2]);
        else if((m=clause.match(/^(.+?)\s+is something i\s+(?:(don't|do not)\s+)?(like|love|enjoy|hate|dislike)$/i)))preference={...pref(m[3].toLowerCase(),m[1],m[2]?'negative':'positive','present',false,0),reversed:true};
        if(preference){
          let label=preference.label,resolved=null;while(trailing.test(label))label=label.replace(trailing,'');label=label.trim();
          if(preference.reversed&&/\b(?:said|says|told|thinks|claims|believes|apparently|allegedly|reportedly|according to)\b/i.test(label))return clarify('That looks like attributed or uncertain speech. I haven’t saved it as a direct preference. Use “Remember this: …” to keep the original wording as a note.');
          if(/^(?:it|that|this|them)$/i.test(label)){
            if(!state.context.focus||state.turn-state.context.focus.turn>3)return clarify('What does “'+label+'” refer to? Please name it so I change the right preference.');
            resolved=K.clone(state.context.focus.object);label=resolved.label;
          }
          if(label.length>100||/[.;!?]/.test(label)||/\b(?:because|if|when|unless|although|not|but|or|yesterday|tomorrow|maybe|perhaps|probably|possibly|might|wish|think)\b/i.test(label))return clarify('I can save a direct preference, such as “I like coffee”. Please separate the explanation, alternative, or condition.');
          const pieces=resolved?[label]:label.split(/\s*,\s*(?:and\s+)?|\s+and\s+/i);if(pieces.length>4)return clarify('Please give me up to four preferences at a time.');
          if(pieces.some(piece=>!piece.trim()||/^(?:i|you|we|he|she|they|tell|give|ask|remember|forget|stop|please|can|could|would)\b/i.test(piece))||pieces.length>1&&pieces.some(piece=>/\b(?:said|says|thinks|feels|likes|loves|enjoys|hates|dislikes|claims|believes|told|asked|is|are|was|were)\b|^(?:and|or|but)\b|\b(?:and|or|but)$/i.test(piece)))return clarify('Please give each complete report separately, or name the items in the preference directly. I haven’t saved part of that list.');
          let search=preference.labelOffset;
          for(const piece of pieces){const obj=resolved||object(piece),start=clause.indexOf(piece,search);search=start+piece.length;frames.push({kind:'preference',subject:'user',predicate:preference.predicate,object:obj,polarity:preference.polarity,temporal:preference.temporal,correction:preference.correction||/^(?:actually|correction)\b/i.test(text)||/anymore$/i.test(clause),span:resolved?span(clause):{start:clauseOffset+start,end:clauseOffset+start+piece.length},attribution:'user_reported',reference:resolved?{resolvedFrom:state.context.focus.sourceMessage}:null});}
          if(frames.length>12)return clarify('Please give me up to twelve reports in one message. I haven’t saved any part of that batch.');
          continue;
        }
        const moodText=c.replace(/,?\s+(?:thanks|thank you|thx)(?: for asking)?$/,'').replace(/\s+(?:today|right now|now|lately|tonight)$/,'');
        let mood=null;
        if((m=moodText.match(/^i(?:'m| am| feel| was| felt| have been feeling|'ve been feeling)\s+(not\s+)?(?:(?:feeling|doing)\s+)?(?:(?:really|so|very|pretty|quite|a bit|a little|kind of|kinda)\s+)?(.+)$/)))mood={label:m[2],negative:!!m[1],past:/^i (?:was|felt)/.test(c)};
        else if((m=moodText.match(/^i (don't|do not|didn't|did not) feel\s+(.+)$/)))mood={label:m[2],negative:true,past:/^did/.test(m[1])};
        else if((m=moodText.match(/^i no longer feel\s+(.+)$/)))mood={label:m[1],negative:true,past:false};
        if(mood&&(moods.includes(mood.label)||(engine.lookup(mood.label).length===1&&engine.sub(engine.lookup(mood.label)[0],'c:feeling'))))f={kind:'mood',subject:'user',predicate:'feels',object:object(mood.label),polarity:mood.negative?'negative':'positive',temporal:mood.past?'past':'present',span:span(mood.label),attribution:'user_reported'};
      }
      if(!f)return {...clarify('I don’t have a reliable reading of that yet.'),reasonCode:'unparsed'};
      frames.push(f);
    }
    if(!frames.length)return clarify('Could you put that another way?');
    if(frames.length>12)return clarify('Please give me up to twelve reports in one message. I haven’t saved any part of that batch.');
    const ambiguous=frames.find(f=>f.object.candidates.length>1);
    if(ambiguous)return result('clarify',{supported:false,reason:'That word has more than one meaning in my lexicon.',ambiguity:ambiguous,candidateFrames:frames,frames:[]});
    const intent=frames.every(f=>f.kind===frames[0].kind)?frames[0].kind:'note';
    return result(intent,{frames,speechAct:/^(?:actually|correction)/i.test(text)||frames.some(f=>f.correction)?'correction':'statement',negativeMood:frames.some(f=>f.kind==='mood'&&f.polarity==='positive'&&negativeMoods.has(f.object.label))});
  }
  K.parseInput=parseInput;
})(Kira);

