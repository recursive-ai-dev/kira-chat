'use strict';
// Deterministic Natural Language Understanding (NLU) and episodic entity extraction.
// Extracts affect, conversational acts, entities, events, coreference, and topic cues
// without altering Kira's verified semantic/memory provenance guarantees.
(function(K){
  const CONTRACTIONS=[
    [/\bi'm\b|\bim\b/gi,"I'm"],[/\bi've\b|\bive\b/gi,"I've"],[/\bi'll\b|\bill\b(?=\s+(?:be|go|do|try|make|take|get|have|see|keep|start|play|work|send|tell|check|think))/gi,"I'll"],
    [/\bi'd\b|\bid\b(?=\s+(?:like|love|hate|prefer|rather|better|say|think|want|be|go))/gi,"I'd"],
    [/\bdont\b/gi,"don't"],[/\bdidnt\b/gi,"didn't"],[/\bdoesnt\b/gi,"doesn't"],[/\bcant\b/gi,"can't"],[/\bwont\b/gi,"won't"],
    [/\bisnt\b/gi,"isn't"],[/\barent\b/gi,"aren't"],[/\bwasnt\b/gi,"wasn't"],[/\bwerent\b/gi,"weren't"],
    [/\bhavent\b/gi,"haven't"],[/\bhasnt\b/gi,"hasn't"],[/\bhadnt\b/gi,"hadn't"],
    [/\bcouldnt\b/gi,"couldn't"],[/\bwouldnt\b/gi,"wouldn't"],[/\bshouldnt\b/gi,"shouldn't"],
    [/\bwhats\b/gi,"what's"],[/\bthats\b/gi,"that's"],[/\bhows\b/gi,"how's"],[/\bwhos\b/gi,"who's"],[/\bwheres\b/gi,"where's"],[/\bwhens\b/gi,"when's"],[/\bwhys\b/gi,"why's"],
    [/\btheres\b/gi,"there's"],[/\byoure\b/gi,"you're"],[/\btheyre\b/gi,"they're"],[/\bweve\b/gi,"we've"],[/\byouve\b/gi,"you've"],
    [/\bgonna\b/gi,'going to'],[/\bwanna\b/gi,'want to'],[/\bgotta\b/gi,'got to'],[/\bkinda\b/gi,'kind of'],[/\bsorta\b/gi,'sort of'],
    [/\btbh\b/gi,'to be honest'],[/\bngl\b/gi,'not going to lie'],[/\brn\b/gi,'right now'],
    [/\bits\b(?=\s+(?:a|an|the|so|very|pretty|really|kind|sort|not|been|just|actually|honestly|getting|hard|easy|good|bad|great|nice|tough|late|early|cold|hot|warm|raining|snowing))/gi,"it's"]
  ];
  const PREAMBLE=/^(?:(?:oh|ah|aw|aww|ooh|hm+|hmm+|well|so|honestly|truthfully|to be honest|not going to lie|frankly|actually|anyway|wait|man|dude|oof|ugh|yay|woohoo|nice|cool|haha+|hahaha+|lol|lmao|hehe+|yeah|yep|yup|nah|no|ok|okay|i mean|you know|basically|literally|seriously)[,!.\s]+)+/i;
  const STOP_ENTITIES=new Set(['i','me','my','mine','you','your','we','our','us','they','them','their','he','him','his','she','her','it','its','this','that','these','those','something','anything','everything','nothing','someone','anyone','everyone','stuff','thing','things','lot','bit','kind','sort','part','way','time','day','today','tonight','yesterday','tomorrow','now','here','there','home','work','school','life','world','haha','yeah','lol','lmao','okay','ok','yes','no','sure','maybe','really','mostly','just','actually','honestly','pretty','very','quite','good','bad','great','nice','long','rough','hard','little','more','much','many','some']);

  // Normalize casual English without mutating user-quoted spans when building discourse features.
  function normalize(text){
    let out=K.nfc(String(text||'')).trim().replace(/[’‘]/g,"'").replace(/[“”]/g,'"');
    for(const [re,rep] of CONTRACTIONS)out=out.replace(re,rep);
    return out.replace(/\s+/g,' ').trim();
  }

  function stripPreambles(text){
    const preambles=[];let rest=text;
    for(let i=0;i<3;i++){
      const m=rest.match(PREAMBLE);
      if(!m||m[0].length>=rest.length)break;
      const chunk=m[0].replace(/[,!.\s]+$/,'').trim();
      if(chunk)preambles.push(chunk.toLowerCase());
      rest=rest.slice(m[0].length).trim();
    }
    return {preambles,core:rest};
  }

  // Classify subtle affect, emotional subtext, and conversational energy across free-form prose.
  function analyzeAffect(text){
    const lower=K.fold(text);
    const rules=[
      ['tired',/\b(?:tired|exhausted|wiped|drained|sleepy|sleep deprived|insomnia|burnout|burnt out|burned out|worn out|long day|long week|need a nap)\b/i,'negative','low'],
      ['stressed',/\b(?:stressed|stressing|overwhelmed|swamped|deadline|behind|pressure|crunch|chaotic|chaos|frantic|last minute|kept changing|panic|anxious|worried|nervous)\b/i,'negative','tense'],
      ['frustrated',/\b(?:frustrated|annoying|annoyed|irritating|infuriating|driving me crazy|broken|crashed|keeps failing|stuck on|mess|ridiculous|ugh|sigh)\b/i,'negative','tense'],
      ['sad',/\b(?:sad|down|bummed|lonely|isolated|miss(?:ing)?|heartbroken|grief|upset|miserable|empty|depressed|rough day|tough day|bad day|hard time|rough week|could be better)\b/i,'negative','low'],
      ['bored',/\b(?:bored|boring|uninspired|nothing to do|restless|slow day|dragging|meh)\b/i,'negative','low'],
      ['excited',/\b(?:excited|pumped|stoked|hyped|thrilled|can't wait|cannot wait|looking forward|amazing|awesome|incredible|fantastic)\b/i,'positive','high'],
      ['proud',/\b(?:proud|nailed|finished|finally got|accomplished|promoted|promotion|shipped|launched|solved|fixed|figured out)\b/i,'positive','high'],
      ['amused',/\b(?:haha+|hahaha+|lol|lmao|hehe+|hilarious|funny|snores|cracked me up|made me laugh)\b/i,'positive','playful'],
      ['happy',/\b(?:happy|glad|great|wonderful|loved|love|enjoyed|enjoying|delighted|good mood|feeling good|pretty good)\b/i,'positive','warm'],
      ['calm',/\b(?:calm|peaceful|cozy|cosy|relaxed|relaxing|chilling|chill|quiet|serene|content|mellow|pleasant|grateful|thankful|relieved)\b/i,'positive','calm'],
      ['curious',/\b(?:curious|wondering|wonder|fascinating|interesting|intrigued|trying to learn|learning|exploring)\b/i,'positive','curious'],
      ['nostalgic',/\b(?:nostalgic|used to|back when|last year|years ago|reminds me|miss the|childhood|old days)\b/i,'mixed','calm']
    ];
    const tags=[];let valence='neutral',energy='calm';
    for(const [tag,re,v,e] of rules){
      if(re.test(lower)){
        tags.push(tag);
        if(valence==='neutral')valence=v;
        else if(valence!==v&&v!=='neutral')valence='mixed';
        if(energy==='calm'||e==='tense'||e==='high')energy=e;
      }
    }
    if(/\bnot (?:bad|terrible|too bad)\b/.test(lower)&&valence==='negative')valence='neutral';
    if(/\b(?:honestly|to be honest|frankly)\b/.test(lower)&&valence==='neutral')energy='candid';
    return {tags,primary:tags[0]||null,valence,energy};
  }

  // Reactions and backchannels that should never be parsed as noun-phrase topics.
  function classifyReaction(text){
    const c=K.fold(text).replace(/[.!?\s]+$/,'').replace(/^(?:oh|ah|well),?\s+/,'').trim();
    if(/^(?:(?:haha+|hahaha+|hehe+|lol|lmao|rofl)(?:\s+(?:yeah|yep|yup|true|right|fair|same|totally|i know|for real|fr|man|seriously))?|(?:yeah|yep|yup|oh)\s+(?:haha+|lol|lmao|that's funny|too funny))$/.test(c))return 'laugh';
    if(/^(?:yeah|yep|yup|for sure|definitely|totally|absolutely|same|true|fair|fair enough|pretty much|mostly|right|exactly|i know|i get that|makes sense|good point|for real|fr|no kidding|tell me about it|you know it|word|bet|same here|i hear you|sounds good|sounds right|of course)$/.test(c))return 'agree';
    if(/^(?:kind of|kinda|sort of|sorta|a bit|a little|maybe|i guess|i suppose|hard to say|not really sure|not sure|depends|sometimes|a mix|both|neither|either way|who knows|probably|possibly|to some extent)$/.test(c))return 'hedge';
    if(/^(?:oof|ugh|yikes|ouch|damn|welp|sigh|man|oh man|oh no|rough|rip)$/.test(c))return 'empathy_cue';
    if(/^(?:wait what|really\??|no way|seriously\??|wait really\??|oh really\??|huh\??|what\??)$/.test(c))return 'surprise';
    if(/^(?:nice|neat|cool|awesome|sweet|amazing|lovely|interesting|wild|crazy|wow|ooh|oh nice|that's nice|that's cool|that's awesome|love that)$/.test(c))return 'ack';
    return null;
  }

  // Extract people, pets, places, items, activities, durations, and daily-life events from prose.
  function extractEpisodic(rawText,normalized,state,turn,sourceMessage){
    const entities=[],events=[],facts=[];
    const clean=v=>v.replace(/[.!?,;:]+$/,'').replace(/\s+/g,' ').trim();
    let m;

    // Named pets: "my dog Max", "a golden retriever named Max", "I have a cat called Luna"
    const petMatch=normalized.match(/\b(?:[Mm]y|[Oo]ur)\s+(dog|puppy|cat|kitten|pet|bird|parrot|rabbit|hamster|ferret|lizard|gecko|snake|turtle|fish|goldfish)\s+([A-Z][\p{L}'-]{1,24})\b/u)
      ||normalized.match(/\b(?:dog|puppy|cat|kitten|pet|golden retriever|labrador|poodle|husky|beagle|tabby|siamese)\s+(?:named|called)\s+([A-Z][\p{L}'-]{1,24})\b/u);
    if(petMatch){
      const isNamedPattern=petMatch.length===2;
      const kind=isNamedPattern?'pet':petMatch[1].toLowerCase();
      const name=clean(isNamedPattern?petMatch[1]:petMatch[2]);
      if(!STOP_ENTITIES.has(K.fold(name))){
        entities.push({name,category:'pet',subtype:kind,attributes:[],sourceMessage,turn});
      }
    }else if((m=normalized.match(/\b(?:i have|we have|i got|i own|my|our)\s+(?:a|an|two|three)?\s*(golden retriever|labrador|german shepherd|poodle|husky|beagle|corgi|dachshund|bulldog|border collie|shiba|dog|puppy|cat|kitten|hamster|guinea pig|ferret|parrot|gecko|bearded dragon|snake|rabbit)\b/i))){
      const subtype=m[1].toLowerCase();
      entities.push({name:'your '+subtype,category:'pet',subtype,attributes:[],sourceMessage,turn});
    }

    // Pet breed or habit attributes (including pronoun coreference to an active pet)
    const breedMatch=normalized.match(/\b(?:is|he's|she's|it's|they're)\s+(?:a|an)\s+(golden retriever|labrador|german shepherd|poodle|husky|beagle|corgi|dachshund|bulldog|border collie|shiba|tabby|siamese|calico|maine coon|ragdoll|rescue|mutt)\b/i);
    const petTraitMatch=normalized.match(/\b(?:snores?(?: really| very| so)? loud(?:ly)?|is asleep(?: next to me)?|is sleeping(?: next to me)?|is curled up|loves? (?:walks|treats|naps|belly rubs|fetching)|barks? a lot|purrs?)\b/i);
    if(breedMatch||petTraitMatch){
      const attrs=[breedMatch?.[1]?.toLowerCase(),petTraitMatch?.[0]?.toLowerCase()].filter(Boolean);
      const curPet=entities.find(e=>e.category==='pet');
      if(curPet)curPet.attributes.push(...attrs);
      else if(state.context?.activeEntity?.category==='pet'){
        entities.push({...state.context.activeEntity,attributes:[...attrs],refOnly:true});
      }
    }

    // Named people & relationships: "my sister Sarah", "my friend Alex", "my boss", "my partner Jamie"
    const relRe=/\b(?:[Mm]y|[Oo]ur)\s+(sister|brother|mom|mother|dad|father|partner|wife|husband|girlfriend|boyfriend|friend|best friend|roommate|housemate|boss|manager|coworker|colleague|mentor|teacher|professor|neighbor|neighbour|cousin|aunt|uncle|son|daughter|kid|child)(?:\s+([A-Z][\p{L}'-]{1,24}))?\b/gu;
    for(const rm of normalized.matchAll(relRe)){
      const role=rm[1].toLowerCase(),name=rm[2]&&!STOP_ENTITIES.has(K.fold(rm[2]))?rm[2]:null;
      entities.push({name:name||'my '+role,category:'person',subtype:role,attributes:[],sourceMessage,turn});
    }

    // Possessions / instruments / gear / creations: "I have a Fender Stratocaster", "I'm building a 2d platformer in Godot"
    if((m=normalized.match(/\b(?:i have|i've got|i own|i play|i use|i drive|i cook with|i brew with)\s+(?:a|an|my|this)\s+([a-z0-9][a-z0-9 '&+-]{1,42}?)(?=\s*(?:,|and\b|but\b|for\b|which\b|that\b|because\b|right now\b|lately\b|[.!?]|$))/i))){
      const item=clean(m[1]);
      if(item&&item.length>=2&&!STOP_ENTITIES.has(K.fold(item))&&!/\b(?:good|bad|rough|long|hard|great|nice|tough|lot|bit|few|couple)\s+(?:day|week|time|night|morning|while)\b/i.test(item)){
        facts.push({kind:'item',relation:'has_or_uses',value:item,sourceMessage,turn});
      }
    }

    // Duration / experience: "been playing [guitar] for 5 years"
    if((m=normalized.match(/\b(?:been\s+)?([a-z]+ing)\s+([a-z0-9 '&-]{1,32}?)?\s*for\s+(?:about\s+|around\s+|nearly\s+|almost\s+|over\s+)?(\d+\s+(?:years?|months?|weeks?|days?)|a few (?:years|months|weeks)|a long time|ages)\b/i))){
      const activity=clean([m[1],m[2]||''].join(' ')),duration=clean(m[3]);
      facts.push({kind:'experience',relation:'duration',value:activity+' ('+duration+')',subject:m[2]?clean(m[2]):m[1].toLowerCase(),duration,sourceMessage,turn});
    }

    // Role / study / location: "I'm a software engineer", "I work as a teacher", "I study biology", "I live in Seattle"
    if((m=normalized.match(/\bi(?:'m| am| work as)\s+(?:a|an)\s+([a-z][a-z -]{2,34}?)(?=\s*(?:at\b|in\b|for\b|and\b|but\b|[.!?,]|$))/i))){
      const role=clean(m[1]);
      if(!/^(?:bit|little|lot|mess|fan|huge|big|total|good|bad|great|new)\b/i.test(role)&&!/\b(?:day|week|night|morning|person|guy|girl|human|bot|ai)\b/i.test(role)){
        facts.push({kind:'role',relation:'occupation_or_role',value:role,sourceMessage,turn});
      }
    }
    if((m=normalized.match(/\bi\s+(?:live|stay|am based|grew up)\s+in\s+([A-Z][\p{L} .'-]{1,30}|[a-z][a-z -]{2,24})(?=\s*(?:,|and\b|but\b|now\b|[.!?]|$))/u))){
      facts.push({kind:'place',relation:'lives_or_from',value:clean(m[1]),sourceMessage,turn});
    }

    // Trips & past events: "went to Japan last year", "visited Kyoto", "had tacos for dinner"
    if((m=normalized.match(/\bi\s+(?:went to|visited|traveled to|travelled to|just got back from)\s+([A-Z][\p{L} .'-]{1,32}|[a-z][a-z -]{2,28})(?:\s+(last (?:year|month|week|summer|winter|weekend)|recently|a while ago|yesterday|once))?/iu))){
      const place=clean(m[1]),when=m[2]?clean(m[2]):null;
      events.push({kind:'trip',action:'visited',object:place,when,sourceMessage,turn});
      entities.push({name:place,category:'place',subtype:'destination',attributes:when?['visited '+when]:[],sourceMessage,turn});
    }
    if((m=normalized.match(/(?:^|\bi\s+)(?:had|ate|made|cooked|ordered)\s+([a-z0-9 '&-]{2,46}?)\s+for\s+(breakfast|lunch|dinner|supper|brunch|dessert)\b/i))){
      events.push({kind:'meal',action:'ate',object:clean(m[1]),meal:m[2].toLowerCase(),sourceMessage,turn});
    }
    if((m=normalized.match(/\bi(?:'m| am)\s+(?:currently\s+)?(reading|watching|playing|listening to|building|working on|learning|writing|making|designing|studying|practicing|trying to learn)\s+(.+?)(?=\s*(?:,|and\b|but\b|because\b|lately\b|right now\b|[.!?]|$))/i))){
      const verb=m[1].toLowerCase(),target=clean(m[2]).replace(/^(?:a|an|the)\s+(?=lot\b)/i,'');
      if(target&&target.length<=60&&!/^(?:to|about|around|here|there|out|it|that|this)$/i.test(target)){
        events.push({kind:'activity',action:verb,object:target,sourceMessage,turn});
      }
    }
    if((m=normalized.match(/\b(?:loved|really liked|enjoyed|hated|didn't like)\s+([A-Z][\p{L} .'-]{1,32}|[a-z][a-z -]{2,32})(?=\s*(?:,|and\b|but\b|too\b|[.!?]|$))/u))){
      const obj=clean(m[1]);
      if(!STOP_ENTITIES.has(K.fold(obj)))facts.push({kind:'experience',relation:'past_reaction',value:obj,polarity:/hate|didn't like/i.test(m[0])?'negative':'positive',sourceMessage,turn});
    }

    // Work/life stressors or highlights as events
    if((m=normalized.match(/\b(?:my|our|the)\s+(boss|manager|client|team|teacher|professor|neighbor|neighbour)\s+((?:kept|has been|was|is)\s+[^.!?]{4,60})/i))){
      events.push({kind:'interpersonal',actor:m[1].toLowerCase(),detail:clean(m[2]),sourceMessage,turn});
    }

    return {entities,events,facts};
  }

  // Extract a clean main-clause gist for novel sentences Kira hasn't seen before.
  function extractClauseGist(text){
    const s=stripPreambles(text).core.replace(/[.!?]+$/,'').trim();
    if(!s)return null;
    let m;
    if((m=s.match(/^i\s+(?:just\s+)?(?:really\s+)?wanted to\s+(.+)$/i)))return {pattern:'desire',phrase:m[1].trim()};
    if((m=s.match(/^i(?:'m| am)\s+(?:just\s+)?(?:trying to|attempting to)\s+(.+)$/i)))return {pattern:'effort',phrase:m[1].trim()};
    if((m=s.match(/^i\s+(?:spent|wasted|took)\s+(?:the\s+\w+\s+|all\s+\w+\s+)?([a-z]+ing\b.*)$/i)))return {pattern:'activity',phrase:m[1].trim()};
    if((m=s.match(/^i\s+(?:had|just had|have)\s+(.+)$/i)))return {pattern:'experience',phrase:m[1].trim()};
    if((m=s.match(/^i\s+(went|got|made|built|wrote|finished|started|tried|found|learned|saw|heard|read|watched|played)\s+(.+)$/i)))return {pattern:'action',verb:m[1].toLowerCase(),phrase:m[2].trim()};
    if((m=s.match(/^i(?:'m| am)\s+(.+)$/i)))return {pattern:'state',phrase:m[1].trim()};
    if((m=s.match(/^(?:my|our)\s+([a-z][a-z ']{1,24}?)\s+(is|was|are|were|kept|has|had|got|seems?|looks?|feels?)\s+(.+)$/i)))return {pattern:'subject_state',subject:m[1].trim(),verb:m[2].toLowerCase(),phrase:m[3].trim()};
    if((m=s.match(/^(?:it's|it is|that's|that is)\s+(.+)$/i)))return {pattern:'it_is',phrase:m[1].trim()};
    return {pattern:'statement',phrase:s};
  }

  // Classify high-level conversational acts that go beyond the rigid fixed parser patterns.
  function classifyAct(rawText,normalized,state,engine){
    const {preambles,core}=stripPreambles(normalized);
    const trimmed=core.replace(/[.!?]+$/,'').trim();
    const folded=K.fold(trimmed);
    const isQuestion=/\?\s*$/.test(core)||/^(?:what|who|where|when|why|how|do|does|did|is|are|was|were|can|could|would|should|have|has|will|which)\b/i.test(folded);
    let m;

    // 1. Reaction-only turns
    const reaction=classifyReaction(normalized);
    if(reaction)return {kind:'reaction',reaction,preambles};

    // 2. Meta-clarification on Kira's last turn
    if(/^(?:what do you mean(?: by that)?|how so|what does that mean|huh|why do you ask|why did you ask(?: that)?|elaborate|say more|go on|keep going)$/i.test(folded)){
      return {kind:'clarify_last',preambles};
    }
    if(folded==='why'&&state.lastPlan&&!['why','clarify','capabilities'].includes(state.lastPlan.act)){
      return {kind:'clarify_last',preambles};
    }

    // 3. Creative, games, stories, facts, advice, recommendations
    if(/^(?:tell me|spin me|give me|write me|share)?\s*(?:a )?(?:short |bedtime |little |quick )?story\b/i.test(folded))return {kind:'story',preambles};
    if(/^(?:tell me|give me|share)?\s*(?:a )?(?:fun |random |interesting |cool )?(?:fact|trivia)\b|^tell me something (?:interesting|cool|weird|random|surprising|new)$|^surprise me$/i.test(folded)){
      return {kind:'fun_fact',preambles};
    }
    if(/^(?:tell me|give me|ask me)?\s*(?:a )?riddle\b/i.test(folded))return {kind:'riddle',preambles};
    if(/^(?:let's play|play|ask me|give me)?\s*(?:a )?(?:would you rather|wyr|word game|game)\b/i.test(folded))return {kind:'dilemma',preambles};
    if((m=trimmed.match(/^(?:help me (?:decide|choose)|should i)\s+(.+?)\s+or\s+(.+)$/i))){
      return {kind:'decide',a:m[1].trim(),b:m[2].trim(),preambles};
    }
    if((m=folded.match(/^(?:recommend|suggest|give me an idea|any ideas|what should i)\s*(?:me\s+)?(?:for\s+|to\s+)?(.+)?$/i))){
      const target=(m[1]||'').replace(/^(?:a|an|some)\s+/,'').trim();
      return {kind:'recommend',target,preambles};
    }
    if(/^(?:cheer me up|make me smile|i need a distraction|distract me|say something nice|compliment me)$/i.test(folded)){
      return {kind:'cheer_up',preambles};
    }

    // 4. Weather / time / live-world honest offline check-in
    if(/^(?:what(?:'s| is) the weather(?: like)?|is it raining|is it cold|what time is it|what(?:'s| is) the time|what day is it|what(?:'s| is) today(?:'s date)?|what(?:'s| is) the news)/i.test(folded)){
      return {kind:'live_world',subject:/time|day|date/.test(folded)?'time':/news/.test(folded)?'news':'weather',preambles};
    }

    // 5. Episodic / specific memory queries ("what did I tell you about my dog?", "do you remember Max?")
    if((m=folded.match(/^(?:what (?:did i|have i) (?:tell|told|say|said|mention|mentioned)(?: you)?(?: earlier| before)? about|do you remember(?: anything about)?|what do you know about|did i mention|tell me what you remember about)\s+(.+)$/i))
      ||(m=folded.match(/^(?:what(?:'s| is) my|who is my)\s+([a-z0-9 ']+?)(?:'s name|\s+called)?$/i))){
      const target=m[1].replace(/^(?:my|the|a|an)\s+/,'').replace(/\?+$/,'').trim();
      if(target&&target!=='name'&&!/^(?:you remember|me)$/.test(target))return {kind:'episodic_recall',target,preambles};
    }
    if(/^(?:what do i do(?: for work| for a living)?|where do i live|where did i go|do i have (?:any )?pets?|what have we talked about)$/i.test(folded)){
      return {kind:'episodic_recall',target:folded,preambles};
    }

    // 6. Questions about Kira in-character (NOT direct reality/LLM ontological tests)
    if(/^(?:do you have (?:any )?hobbies|what are your hobbies|what do you do for fun|what do you like to do|what(?:'s| is) your (?:vibe|aesthetic|story)|tell me (?:something )?(?:more )?about yourself|how(?:'s| is) your (?:day|night|evening|morning)|what makes you (?:happy|laugh)|do you ever get bored)$/i.test(folded)){
      return {kind:'kira_persona',topic:folded,preambles};
    }
    if((m=folded.match(/^(?:what kind of|what sort of|what type of)\s+(.+?)\s+do you (?:like|love|enjoy|listen to|read|watch|play|prefer)$/i))){
      return {kind:'kira_taste',target:m[1].trim(),preambles};
    }

    // 7. Comparisons ("what's the difference between X and Y?", "compare X and Y", "X vs Y")
    if((m=folded.match(/^(?:what(?:'s| is) the difference between|compare|contrast)\s+(.+?)\s+(?:and|vs\.?|versus|with)\s+(.+)$/i))
      ||(m=folded.match(/^(.+?)\s+(?:vs\.?|versus)\s+(.+)$/i))){
      return {kind:'compare',a:m[1].replace(/^(?:a|an|the)\s+/,'').trim(),b:m[2].replace(/^(?:a|an|the)\s+/,'').trim(),preambles};
    }

    // 8. Knowledge / "do you know what X is?" / "have you heard of X?" / "tell me something about X"
    if((m=folded.match(/^(?:do you know what|have you heard of|do you know about|what do you know about|tell me something about|explain)\s+(?:a |an |the )?(.+)$/i))){
      const target=m[1].replace(/\s+is$/,'').trim();
      if(target&&!/^(?:i |my |you )/.test(target))return {kind:'knowledge',target,preambles};
    }
    if((m=folded.match(/^(?:what(?:'s| is)|what are|who(?:'s| is))\s+(?:a |an |the )?(.+)$/i))&&isQuestion){
      const target=m[1].trim();
      // Only treat as knowledge fallback if not already handled by Kira's built-in identity/name/recall/semantic exact concept.
      if(target&&!/^(?:your name|my name|you|up|wrong|new|next|that|this|it|going on|happening|your fav|the difference)/.test(target)){
        return {kind:'knowledge_candidate',target,preambles};
      }
    }

    return {kind:isQuestion?'open_question':'statement',preambles,gist:extractClauseGist(normalized)};
  }

  // Collect all topic signals with explicit weights so Kira shifts smoothly when a message changes subject.
  function scoreTopics(text,engine){
    const scores=new Map();
    const bump=(topic,weight)=>{if(topic)scores.set(topic,(scores.get(topic)||0)+weight);};
    const words=K.fold(text).replace(/[^a-z0-9' -]+/g,' ').split(/\s+/).filter(Boolean).slice(0,80);

    // 1. Exact curated concepts & phrases
    for(let size=Math.min(4,words.length);size>=1;size--){
      for(let i=0;i+size<=words.length;i++){
        const phrase=words.slice(i,i+size).join(' ');
        const matches=engine.lookup(phrase);
        if(matches.length===1)bump(engine.topicFor(matches[0]),size>1?5:3);
      }
    }
    // 2. Authored theme packs
    for(const [topic,pack] of Object.entries(K.THEME_PACKS||{})){
      for(let i=0;i<words.length;i++){
        const two=i+1<words.length?words[i]+' '+words[i+1]:null;
        if(two&&pack.words.includes(two))bump(topic,7);
        else if(pack.words.includes(words[i])||pack.words.includes(words[i].replace(/s$/,'')))bump(topic,6);
      }
    }
    // 3. Curated knowledge entries (e.g., stratocaster -> music, tacos -> cooking, kyoto -> travel)
    if(K.Knowledge?.matchTopics){
      for(const [topic,w] of K.Knowledge.matchTopics(text))bump(topic,w);
    }
    // 4. WordNet fallback (lightweight vote)
    const wn=K.conversationTopics?K.conversationTopics(text,engine):[];
    for(const t of wn)bump(t,1);

    return [...scores.entries()].sort((a,b)=>b[1]-a[1]||K.cmp(a[0],b[0]));
  }

  function analyze(rawText,state,engine){
    const raw=K.nfc(String(rawText||'')).trim();
    const normalized=normalize(raw);
    const {preambles,core}=stripPreambles(normalized);
    const affect=analyzeAffect(normalized);
    const act=classifyAct(raw,normalized,state,engine);
    const topicScores=scoreTopics(normalized,engine);
    return {raw,normalized,core,preambles,affect,act,topicScores};
  }

  K.NLU=K.freeze({normalize,stripPreambles,analyzeAffect,classifyReaction,extractEpisodic,extractClauseGist,classifyAct,scoreTopics,analyze,STOP_ENTITIES});
})(Kira);
