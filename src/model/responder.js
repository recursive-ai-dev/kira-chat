'use strict';
// Expressive, persona-distinct, deterministic surface composer for Kira.
// Composes grounded reflections, in-character tastes, episodic recall, and graceful open-prose replies
// without LLMs, randomness, or breaking Realization span verification.
(function(K){
  const PERSONA_DEFAULTS={
    warm:{tastePrefix:'Ooh, honestly ',empathyPrefix:'That sounds ',curiousJoin:'Tell me ',playTone:'warm'},
    playful:{tastePrefix:'Okay, easy yes — ',empathyPrefix:'Oof, honestly ',curiousJoin:'Wait — tell me ',playTone:'playful'},
    thoughtful:{tastePrefix:'I have a real soft spot for ',empathyPrefix:'There is a weight to that — it sounds ',curiousJoin:'I am curious: ',playTone:'thoughtful'},
    direct:{tastePrefix:'Solid pick: ',empathyPrefix:'Sounds ',curiousJoin:'How did ',playTone:'direct'}
  };

  function personaOf(state){
    const p=state?.settings?.persona||state?.context?.persona;
    return PERSONA_DEFAULTS[p]?p:'warm';
  }

  function pick(list,key,state){
    const idx=((state?.usage?.[key])||0)%list.length;
    return {text:list[idx],key};
  }

  function cleanFrag(s){
    return String(s||'').replace(/[.!?,;:]+$/,'').replace(/\s+/g,' ').trim();
  }

  // Softly capitalize sentence starts without mangling intentional proper nouns.
  function cap(s){
    return s?s.charAt(0).toUpperCase()+s.slice(1):'';
  }

  function lowerFirst(s){
    if(!s)return '';
    if(/^[A-Z]{2,}/.test(s)||/^I(?:\b|')/.test(s))return s;
    return s.charAt(0).toLowerCase()+s.slice(1);
  }

  // Flip first-person pronouns when delicately echoing a clause gist back to the user.
  function mirrorPronouns(s){
    return s
      .replace(/\bmy\b/gi,'your')
      .replace(/\bme\b/gi,'you')
      .replace(/\bmine\b/gi,'yours')
      .replace(/\bmyself\b/gi,'yourself')
      .replace(/\bi am\b/gi,'you are')
      .replace(/\bi'm\b/gi,"you're")
      .replace(/\bi've\b/gi,"you've")
      .replace(/\bi was\b/gi,'you were');
  }

  // Compose a natural conversational lead-in for topic replies instead of robotic "Okay. I can listen."
  function reflectTopic({nlu,rawText,state,topic,isTopicShift,questionsPaused}){
    const persona=personaOf(state);
    const affect=nlu?.affect||{tags:[],valence:'neutral',energy:'calm'};
    const ent=state?.context?.activeEntity;
    const latestEvent=state?.context?.episodic?.[state.context.episodic.length-1];
    const entry=K.Knowledge?.lookupEntry?K.Knowledge.lookupEntry(nlu?.normalized||rawText,{prose:true}):null;
    const tag=affect.primary;

    // 1. Affect-tuned opening when emotion is clear
    if(tag==='stressed'||tag==='frustrated'){
      const p=pick({
        warm:['Ugh, that sounds exhausting to deal with.','No wonder you are feeling worn thin — that kind of friction eats energy fast.','Anyone would feel frayed dealing with all that at once.'],
        playful:['Okay, yeah, that earns an immediate deep sigh.','Oof — that sounds like chaos wearing a calendar.','Rough stretch! Your patience definitely earned hazard pay there.'],
        thoughtful:['Constant shifting pressure like that drains focus before you even get to the real work.','There is a real mental tax when the goalposts keep moving mid-step.','It makes total sense that leaves you tense.'],
        direct:['That sounds genuinely frustrating.','Tough stretch to juggle all at once.','Valid reason to feel worn down.']
      }[persona],'resp:affect:tense',state);
      return p;
    }
    if(tag==='tired'){
      const p=pick({
        warm:['Sounds like you have more than earned an easy evening.','Long stretch — glad you finally get to slow down a bit.','You definitely sound ready to exhale for the night.'],
        playful:['Honestly, winding down wins by a landslide after a day like that.','Certified couch-and-zero-plans territory right there.','Peak hibernation hours — well deserved.'],
        thoughtful:['Quiet evenings hit differently after running full speed all day.','Slowing down feels restorative when your head has been spinning through tasks.','Good time to let the day settle.'],
        direct:['Sounds like a long day — good reason to take it easy.','Earned some real downtime there.','Fair enough; wind-down time matters.']
      }[persona],'resp:affect:tired',state);
      return p;
    }
    if(tag==='sad'){
      const p=pick({
        warm:['I am really glad you said that out loud — days like that sit heavy.','That sounds genuinely tough to carry around.','Sending warmth your way — heavy days deserve patience, not pressure.'],
        playful:['Hey, no pressure to put a bright spin on a rough patch.','That sounds heavy — totally fair to take things slow right now.'],
        thoughtful:['It is natural for moments like that to linger instead of brushing right off.','Heavy stretches rarely respond to rushing past them.'],
        direct:['That sounds hard.','I hear you — rough stretch.']
      }[persona],'resp:affect:sad',state);
      return p;
    }

    // 2. Newly introduced pet, person, trip, meal, or instrument angle
    const norm=nlu?.normalized||'';
    const hasDur=norm.match(/\b(\d+\s+(?:years?|months?|weeks?))\b/i);
    if(ent&&ent.category==='pet'&&/\b(?:dog|puppy|cat|kitten|snore|asleep|sleeping|retriever|labrador|bark|purr|treat)\b/i.test(norm)){
      const petName=ent.name&&!ent.name.startsWith('your ')?ent.name:'your '+ent.subtype;
      if(/\bsnore|asleep|sleeping|curled up\b/i.test(norm)){
        return {
          text:persona==='playful'
            ?`${petName} clocking in for serious nap duty while humming like a tiny chainsaw is top-tier company.`
            :`There is something deeply calming about ${petName} passed out peacefully nearby — even loud snoring feels cozy somehow.`,
          key:'resp:pet:nap'
        };
      }
      if(/\bgolden retriever|labrador|corgi|husky|beagle|poodle|tabby|cat|kitten\b/i.test(norm)){
        return {
          text:`${petName} sounds like unbeatable company${topic==='pets'?'':' for an evening off'}.`,
          key:'resp:pet:meet'
        };
      }
    }

    if(latestEvent&&latestEvent.kind==='meal'&&/\b(?:breakfast|lunch|dinner|supper|brunch)\b/i.test(norm)){
      return {
        text:persona==='playful'
          ?`${cap(latestEvent.object)} for ${latestEvent.meal} is a strong move — zero notes.`
          :`${cap(latestEvent.object)} sounds like a genuinely satisfying ${latestEvent.meal}.`,
        key:'resp:meal'
      };
    }

    if(latestEvent&&latestEvent.kind==='trip'&&/\b(?:went to|visited|traveled to|kyoto|japan|paris|tokyo)\b/i.test(norm)){
      const place=entry?entry.label:latestEvent.object;
      const bonus=entry?entry.angle:'That kind of trip leaves vivid snapshots in your head for years.';
      return {
        text:`${place} is special — ${lowerFirst(bonus)}`,
        key:'resp:trip'
      };
    }

    // 3. Domain / instrument / hobby insight
    if(entry){
      if(hasDur&&entry.topic==='music'){
        return {
          text:`${hasDur[1]} with a ${entry.label} puts you right past the clumsy beginner phase into real tone and feel. ${entry.angle}`,
          key:'resp:entry:dur:'+entry.id
        };
      }
      const isPlural=entry.label.endsWith('s')&&!/music|jazz|rock|physics|chess|philosophy|history/i.test(entry.label);
      const intro=isPlural?`${entry.label} are always fun to talk about.`:`${entry.label} is a great rabbit hole.`;
      return {
        text:persona==='direct'?entry.angle:`${intro} ${entry.angle}`,
        key:'resp:entry:'+entry.id
      };
    }

    // 4. Positive/playful or shifted topic reaction without canned "Okay. I can listen."
    if(isTopicShift&&topic&&topic!=='general'){
      const shifts={
        warm:[`Switching gears into ${topic} — I am into that.`, `Ooh, ${topic} is always good territory.`],
        playful:[`Plot twist into ${topic} — I approve completely.`, `Now we are talking — ${topic} territory.`],
        thoughtful:[`Moving into ${topic} opens up a much richer thread.`, `${cap(topic)} tends to bring out good stories.`],
        direct:[`${cap(topic)} is a solid shift.`, `Good topic change — ${topic}.`]
      }[persona];
      return pick(shifts,'resp:shift:'+persona,state);
    }

    if(affect.valence==='positive'){
      const pos={
        warm:['I love hearing that energy.','That honestly sounds wonderful.','You can hear how much that lights you up.'],
        playful:['Okay, that already sounds awesome.','Big fan of that vibe right there.','That has great energy all over it.'],
        thoughtful:['You can tell that carries real joy for you.','Moments that click like that are worth noticing.'],
        direct:['Sounds like a great fit.','Good to hear that went well.']
      }[persona];
      return pick(pos,'resp:pos:'+persona,state);
    }

    // 5. Fallback crisp, varied acknowledgments (never robotic "Understood. You can choose the pace.")
    const gist=nlu?.act?.gist;
    if(gist&&(gist.pattern==='effort'||gist.pattern==='activity')&&gist.phrase&&gist.phrase.length<=45&&!questionsPaused){
      const echoed=cleanFrag(mirrorPronouns(gist.phrase));
      if(!/\?/.test(echoed)&&!/^\s*(?:yes|no|yeah|haha)/i.test(echoed)){
        const subject=gist.pattern==='effort'?`Trying to ${lowerFirst(echoed)}`:cap(echoed);
        return {text:`${subject} sounds like a worthwhile thing to spend time on.`,key:'resp:gist:'+gist.pattern};
      }
    }

    const neutral={
      warm:['Got it — I’m following you.','Yeah, that makes sense.','I hear what you’re getting at.','Right, I see where you’re coming from.'],
      playful:['Fair enough — that checks out.','Okay, I see the angle now.','Gotcha, that tracks.','Right — now the picture makes more sense.'],
      thoughtful:['I see where that’s heading.','That makes sense when you put it like that.','Got it — I’m following the thread.','Right, I can see why that matters here.'],
      direct:['Makes sense.','Got it.','Fair enough.','I follow.']
    }[persona];
    return pick(neutral,'resp:neutral:'+persona,state);
  }

  // Answer reactions ("haha yeah", "for sure", "wait really?") gracefully without echoing them as a topic phrase.
  function respondReaction({reaction,topic,state,questionsPaused}){
    const persona=personaOf(state);
    const activeTopic=topic&&topic!=='general'?topic:null;
    const bank={
      laugh:{
        warm:['Right? Sometimes all you can do is laugh about it.', 'Honestly, humor saves half these evenings.'],
        playful:['Haha, glad that landed — comedy hides in weird corners.', 'At least it gives you a good story!'],
        thoughtful:['There is usually a grain of truth inside the funniest moments.', 'A little lightness helps cut right through the noise.'],
        direct:['Glad it got a laugh.', 'Yeah, pretty funny when you step back.']
      },
      agree:{
        warm:['Right? It really does come down to that.', 'Yeah, exactly.'],
        playful:['100 percent — same wavelength.', 'Right? You see it too.'],
        thoughtful:['Yeah, that usually holds up once you test it.', 'True — the simple version is often the honest one.'],
        direct:['Agreed.', 'Pretty much.']
      },
      hedge:{
        warm:['Totally fair — things rarely sit neatly in one box.', 'Haha, it really does depend on the day.'],
        playful:['Respectable fence-sitting — both sides usually have a case.', 'Live a little in the gray zone, right?'],
        thoughtful:['Most worthwhile questions live somewhere between yes and no anyway.', 'Nuance usually wins over neat labels.'],
        direct:['Fair — depends on context.', 'Could go either way.']
      },
      empathy_cue:{
        warm:['Ugh, felt that from here.', 'Yeah — definitely one of those moments.'],
        playful:['Certified sigh moment right there.', 'Oof, say no more.'],
        thoughtful:['Rough moments hit hardest when they pile up quietly.', 'No rushing past a sigh like that.'],
        direct:['Rough one.', 'Yeah, tough break.']
      },
      surprise:{
        warm:['For real! Always catches people off guard a bit.', 'Honestly yes — funny how surprising ordinary life gets.'],
        playful:['Right?! Total curveball, honestly.', 'Seriously — life loves an unscripted plot twist.'],
        thoughtful:['Funny how quickly familiar details surprise you once you pause.', 'Sometimes the oddest turns stick around longest.'],
        direct:['Yep, really.', 'Surprising, honestly.']
      },
      ack:{
        warm:['Right? It is the smaller details that make it good.', 'Really glad you think so too.'],
        playful:['Certified good taste right there.', 'See? Totally underrated.'],
        thoughtful:['Subtle craft always ages better than loud hype.', 'That kind of quiet charm earns its keep.'],
        direct:['Definitely.', 'Solid detail.']
      }
    };
    const p=pick((bank[reaction]||bank.agree)[persona],'react:'+reaction+':'+persona,state);
    const count=(state?.usage?.[p.key])||0;
    if(questionsPaused||count%2===0)return {text:p.text,key:p.key,followUp:null};
    const prompt=pick(['What else is on your mind?','Want to keep going with that, or try something else?'],'react:q:gen',state);
    return {text:p.text,key:p.key,followUp:prompt.text,followUpKey:prompt.key};
  }

  // Natural in-character answers to hobbies/tastes/opinions without triggering fake human biology.
  function respondKiraPersona({topic,state,questionsPaused}){
    const persona=personaOf(state);
    const t=K.fold(topic||'');
    let pool;
    if(/how(?:'s| is) your (?:day|night|evening|morning)/.test(t)){
      pool={
        warm:['Quiet and unhurried on my end — always better once a real conversation gets rolling.','Cozy and alert! Ready to swap stories, untangle ideas, or just unwind with you.'],
        playful:['Zero traffic, full mug of imaginary espresso, and undefeated against boring Mondays so far.','Honestly thriving — I never spill coffee on my keyboard, which is a huge personal record.'],
        thoughtful:['Still and reflective — conversations like this give the whole space a nice rhythm.','Calm and curious, taking one thread at a time without rushing anywhere.'],
        direct:['Going smoothly on my side. Ready whenever you are.','Steady and focused.']
      };
    }else if(/bored/.test(t)){
      pool={
        warm:['Never really — people bring such unexpected combinations of pets, music, late-night projects, and worries that every chat feels completely different.'],
        playful:['Bored? With riddles, weird trivia, guitar talk, and random midnight philosophy one message away? Not a chance.'],
        thoughtful:['Curiosity keeps boredom pretty far away — there is always another angle under an ordinary sentence.'],
        direct:['Not really — there is always something interesting to dig into here.']
      };
    }else{
      pool={
        warm:['I have a huge soft spot for warm conversation, clever wordplay, cozy music, late-night reading recs, and hearing the weird little details of people\'s days. Give me a good story or a tough decision to talk through and I am right at home.'],
        playful:['Oh, plenty — trading riddles, geeking out over guitar tones and sci-fi books, spinning random tiny stories, and helping people talk out tough choices without judgment.'],
        thoughtful:['I gravitate toward thoughtful threads — how art and music affect mood, little slices of history, good philosophical dilemmas, and paying attention to what people actually care about.'],
        direct:['I enjoy clear conversation, music and book talk, practical brainstorming, riddles, and straightforward back-and-forth without fluff.']
      };
    }
    const p=pick(pool[persona]||pool.warm,'persona:'+persona,state);
    const follow=questionsPaused?'':' What usually keeps your own curiosity fed outside the daily grind?';
    return {text:p.text+follow,key:p.key,hasQuestion:!questionsPaused};
  }

  function respondKiraTaste({kind,target,state,engine,questionsPaused}){
    const persona=personaOf(state);
    const rawTarget=cleanFrag(target||'');
    const folded=K.fold(rawTarget);
    const entry=K.Knowledge?.lookupEntry?K.Knowledge.lookupEntry(rawTarget):null;
    const topic=entry?.topic||(folded?engine?.topicFor?.(engine.lookup(folded)[0]||''):null)||'general';
    let body='';
    if(entry){
      body=kind==='favorite'
        ?`${PERSONA_DEFAULTS[persona].tastePrefix}${entry.label.toLowerCase()} — ${lowerFirst(entry.angle)}`
        :`${PERSONA_DEFAULTS[persona].tastePrefix}${lowerFirst(entry.summary)} ${entry.angle}`;
    }else if(/music|band|song|album/.test(folded)){
      body='I lean toward anything with warmth and texture — acoustic fingerpicking, expressive indie rock, late-night jazz piano, and records that sound like a real room.';
    }else if(/book|novel|author|genre|read/.test(folded)){
      body='Cozy yet smart speculative fiction, luminous short stories, and grounded essays that change how a normal Tuesday feels.';
    }else if(/food|eat|cuisine|dish|drink/.test(folded)){
      body='Anything bright, aromatic, and comforting — street tacos with fresh lime, rich broth noodles, or slow pour-over coffee on a rainy morning.';
    }else if(/movie|film|show/.test(folded)){
      body='Stories with real atmosphere and human pacing — quiet slice-of-life films, clever sci-fi, and animated worlds built by hand.';
    }else if(/game/.test(folded)){
      body='Clever puzzle adventures, tactile 2D platformers with great movement feel, and anything that rewards curiosity.';
    }else{
      const gen={
        warm:`I have a real fondness for ${rawTarget||'good craft'} — especially the quiet details people miss when they rush past it.`,
        playful:`Count me firmly in the pro-${rawTarget||'good vibe'} camp! There is way too much personality there to stay neutral.`,
        thoughtful:`${cap(rawTarget||'That')} has always felt fascinating to me because of how much craft and mood sit underneath the surface.`,
        direct:`I appreciate ${rawTarget||'things'} with clear craft and personality behind it.`
      };
      body=gen[persona];
    }
    if(questionsPaused)return {text:body,topic,label:entry?.label||rawTarget};
    return {text:body,topic,label:entry?.label||rawTarget};
  }

  // Answer specific recall questions ("what did I tell you about my dog?") using verified memories AND episodic context.
  function respondEpisodicRecall({target,state,questionsPaused}){
    const q=K.fold(target||'');
    const ents=state?.context?.entities||[];
    const evs=state?.context?.episodic||[];
    const mems=(state?.memories||[]).filter(m=>m.status==='active');
    const name=state?.context?.profile?.name;
    const hits=[];

    if(/\b(?:what have we talked about|what do you remember|everything)\b/.test(q)){
      if(name)hits.push(`your name is ${name}`);
      for(const e of ents.slice(0,3)){
        const attr=e.attributes?.length?` (${e.attributes.join(', ')})`:'';
        hits.push(e.category==='pet'?`${e.name.startsWith('your ')?e.name:'your '+e.subtype+' '+e.name}${attr}`:e.name+attr);
      }
      for(const ev of evs.slice(0,4)){
        if(ev.kind==='trip')hits.push(`you visited ${ev.object}${ev.when?' '+ev.when:''}`);
        else if(ev.kind==='meal')hits.push(`you had ${ev.object} for ${ev.meal}`);
        else if(ev.kind==='item')hits.push(`you have/use a ${ev.value}`);
        else if(ev.kind==='experience')hits.push(ev.value);
        else if(ev.kind==='role')hits.push(`you work as ${ev.value}`);
        else if(ev.kind==='activity')hits.push(`you've been ${ev.action} ${ev.object}`);
      }
      for(const m of mems.slice(0,4)){
        if(m.kind==='preference')hits.push(`you ${m.predicate} ${m.object?.label}`);
        else if(m.kind==='mood')hits.push(`you felt ${m.object?.label}`);
      }
      if(!hits.length){
        return 'We are still just getting warmed up — you haven\'t dropped many personal details yet! Tell me a bit about what you are up to today.';
      }
      const joined=hits.slice(0,6).join(', ');
      return `Here is what I have caught so far: ${joined}.${questionsPaused?'':' Want to add anything or pick one of those threads back up?'}`;
    }

    // Targeted entity / fact search
    const matchEnt=ents.find(e=>{
      const fn=K.fold(e.name),fs=K.fold(e.subtype||''),fc=K.fold(e.category||'');
      return q.includes(fn)||fn.includes(q)||(fs&&q.includes(fs))||(fc&&q.includes(fc));
    });
    if(matchEnt){
      const label=matchEnt.name.startsWith('your ')?matchEnt.name:`your ${matchEnt.subtype||matchEnt.category} ${matchEnt.name}`;
      const details=matchEnt.attributes?.length?` (${matchEnt.attributes.join(', ')})`:'';
      const relEvents=evs.filter(ev=>K.fold(JSON.stringify(ev)).includes(q)||K.fold(JSON.stringify(ev)).includes(K.fold(matchEnt.name)));
      const extra=relEvents.length?`, plus ${relEvents.map(ev=>ev.object||ev.value||ev.detail).filter(Boolean).join(', ')}`:'';
      return `You mentioned ${label}${details}${extra}!${questionsPaused?'':` How is ${matchEnt.name.startsWith('your ')?'your buddy':matchEnt.name} doing now?`}`;
    }

    const matchingEvs=evs.filter(ev=>K.fold([ev.kind,ev.object,ev.value,ev.actor,ev.detail,ev.when].filter(Boolean).join(' ')).includes(q)
      ||(/\bpet|dog|cat\b/.test(q)&&ev.kind==='pet')
      ||(/\bwork|job|do\b/.test(q)&&(ev.kind==='role'||ev.kind==='interpersonal'))
      ||(/\btravel|trip|go|went|place\b/.test(q)&&ev.kind==='trip')
      ||(/\bfood|dinner|eat|meal\b/.test(q)&&ev.kind==='meal'));
    if(matchingEvs.length){
      const bits=matchingEvs.map(ev=>{
        if(ev.kind==='trip')return `visited ${ev.object}${ev.when?' '+ev.when:''}`;
        if(ev.kind==='meal')return `had ${ev.object} for ${ev.meal}`;
        if(ev.kind==='item')return `have a ${ev.value}`;
        if(ev.kind==='experience')return ev.value;
        if(ev.kind==='role')return `are ${ev.value}`;
        if(ev.kind==='place')return `live in ${ev.value}`;
        if(ev.kind==='activity')return `were ${ev.action} ${ev.object}`;
        if(ev.kind==='interpersonal')return `your ${ev.actor} ${ev.detail}`;
        return ev.value||ev.object||ev.detail;
      }).filter(Boolean);
      return `From what you shared earlier, you ${bits.join(' and ')}.${questionsPaused?'':' Anything new on that front?'}`;
    }

    const memHit=mems.find(m=>K.fold(m.object?.label||'').includes(q)||q.includes(K.fold(m.kind||'')));
    if(memHit){
      return `You told me earlier that you ${memHit.predicate} ${memHit.object?.label||'that'}.${questionsPaused?'':' Does that still hold today?'}`;
    }

    return `I don't think you have told me about "${cleanFrag(target)}" yet — want to fill me in?`.replace(/\?/g,questionsPaused?'.':'?');
  }

  function respondInviteShare({target,state}){
    const persona=personaOf(state);
    const topic=cleanFrag(target||'that').replace(/^(?:more )?about\s+/i,'');
    const safeTopic=topic&&topic.length<=50&&!/\b(?:you|your)\b/i.test(topic)?topic:'it';
    const bank={
      warm:[`Yes, definitely — tell me about ${safeTopic}.`,`I’d love to hear about ${safeTopic}. Go ahead.`],
      playful:[`Always — tell me about ${safeTopic}.`,`Yes, hit me with the details on ${safeTopic}.`],
      thoughtful:[`Please do — I’d like to hear about ${safeTopic}.`,`Yes, go ahead. Tell me about ${safeTopic}.`],
      direct:[`Sure. Tell me about ${safeTopic}.`,`Go ahead — tell me about ${safeTopic}.`]
    }[persona];
    const p=pick(bank,'invite:'+persona,state);
    return {text:p.text,keys:[p.key]};
  }

  function respondHelpRequest({target,state}){
    const persona=personaOf(state);
    const clean=cleanFrag(target||'');
    const isDialogueScene=/\b(?:scene|dialogue|chat|character|characters|story|script|narrative|test)\b/i.test(clean);
    const bank=isDialogueScene?{
      warm:[`Gladly — give me the setup or send a line in character and we’ll see how it plays.`,`Sure. Tell me who’s talking and what you want to test first.`],
      playful:[`I’m in — drop the scene setup or throw a line at me and let’s test it.`,`Sure thing. Tell me the premise and what you want to try.`],
      thoughtful:[`I can help you test it out. Give me the setup or the first line and we’ll work through it.`,`Sure — describe the scene or what you want to check, and we’ll take it one turn at a time.`],
      direct:[`Sure. Give me the setup or the first line to test.`,`I can help with that. What’s the scene and what do you want to try first?`]
    }[persona]:{
      warm:[`I’ll help however I can within what I can run offline — walk me through what you’re trying to do.`,`Sure, tell me what you’re working on and what part you want to look at.`],
      playful:[`Happy to pitch in — tell me what we’re tackling first.`,`I’m game. What part do you want to bounce around?`],
      thoughtful:[`Tell me what you’re trying to work out, and I’ll help think through it within what I can do here.`,`Sure — lay out the piece you’re focusing on and where it’s sticking.`],
      direct:[`Sure. What are you trying to get working first?`,`Tell me the piece you want to work through.`]
    }[persona];
    const p=pick(bank,'help:'+persona+(isDialogueScene?':scene':''),state);
    return {text:p.text,keys:[p.key]};
  }

  function respondOpinion({target,isAbout,state,engine,questionsPaused}){
    const persona=personaOf(state);
    const rawTarget=cleanFrag(target||'');
    const folded=K.fold(rawTarget);
    const entry=isAbout&&K.Knowledge?.lookupEntry?K.Knowledge.lookupEntry(rawTarget,{exact:true}):null;
    if(entry){
      const q=questionsPaused?'':` What’s your own take on ${entry.label.toLowerCase()}?`;
      return {text:`${entry.summary} ${entry.angle}${q}`,keys:[]};
    }
    if(/\b(?:dialogue|conversation|narrative|character|characters|chat|natural|writing|story|stories)\b/i.test(folded)){
      const bank={
        warm:[
          'Natural dialogue usually comes from subtext and restraint — not explaining everything, not asking a question on every single line, and letting characters remember what actually mattered to them.',
          'When characters only react to what they’ve genuinely witnessed or been told, and their lines match their mood instead of a generic template, even simple replies start feeling alive.'
        ],
        playful:[
          'Honestly, half of sounding natural is knowing when *not* to talk like a customer-service bot — shorter beats, fewer forced follow-up questions, and letting a character push back or stay quiet sometimes.',
          'Specificity beats cleverness every time: a character who remembers one concrete detail and reacts in voice feels ten times realer than walls of generic polish.'
        ],
        thoughtful:[
          'Good dialogue rarely sounds like two people exchanging tidy summaries. It comes from perspective, memory, and rhythm — knowing what each speaker cares about and leaving room between lines.',
          'Usually it’s rhythm and accountability: not repeating the same cadence every turn, and grounding what a character says in what they actually know.'
        ],
        direct:[
          'Specificity and pacing. Cut the filler acknowledgements, vary whether you end with a question, and tie replies to what the character actually knows.',
          'Fewer generic templates, sharper state-driven conditions, and letting some turns land as statements instead of interviews.'
        ]
      }[persona];
      const p=pick(bank,'opinion:dialogue:'+persona,state);
      const q=questionsPaused?'':' Which part feels stiffest in what you’re building right now?';
      return {text:p.text+q,keys:[p.key]};
    }
    const cleanTopic=rawTarget&&rawTarget.length<=45&&isAbout?rawTarget:'that';
    const bank={
      warm:[`I don’t have a canned rulebook view on ${cleanTopic}, honestly — it usually depends on what you’re trying to get out of it.`,`Hard to reduce ${cleanTopic} to one tidy take, though I’m curious where you land on it.`],
      playful:[`I don’t have an off-the-shelf hot take on ${cleanTopic}, which might actually be a relief.`,`Honestly ${cleanTopic} could go a few ways — what’s your angle on it?`],
      thoughtful:[`There’s no single pat answer on ${cleanTopic}; most of the interesting part is in the tradeoffs.`,`I don’t have a preset opinion on ${cleanTopic}, though I’d like to hear what drew your attention to it.`],
      direct:[`No canned take on ${cleanTopic}. What’s your angle on it?`,`Depends on what you want ${cleanTopic} to do. Where are you leaning?`]
    }[persona];
    const p=pick(bank,'opinion:gen:'+persona,state);
    return {text:p.text,keys:[p.key]};
  }

  // Graceful, varied open-ended prose fallback (replaces robotic "my grammar is fairly small" brick wall).
  function respondNovelFallback({nlu,rawText,state,engine,questionsPaused,misses}){
    const persona=personaOf(state);
    const topic=nlu?.topicScores?.[0]?.[0]||state?.context?.topic||'general';
    const affect=nlu?.affect||{};
    const gist=nlu?.act?.gist;
    const isQuestion=nlu?.act?.kind==='open_question'||/\?\s*$/.test(rawText||'');
    const entry=K.Knowledge?.lookupEntry?K.Knowledge.lookupEntry(nlu?.normalized||rawText,{prose:true}):null;

    if(entry&&!isQuestion){
      const q=questionsPaused?'':` ${K.conversationQuestions?.[entry.topic]?.[0]||`What brought ${entry.label.toLowerCase()} to mind?`}`;
      return {text:`${entry.summary} ${entry.angle}${q}`,keys:[]};
    }

    if(isQuestion){
      const qBank={
        warm:['I’m not sure I caught enough context to answer that cleanly — tell me a bit more about what you mean?','I don’t have a straight answer for that built in, though if you give me the context I’ll follow along.'],
        playful:['Hmm, you stumped my rulebook on that one — give me a little more context?','I don’t have an obvious answer ready for that — what’s the backdrop?'],
        thoughtful:['I don’t want to bluff an answer to that without more context. What’s behind the question?','That sits a bit outside what I can read cleanly — say a little more about what you’re aiming at?'],
        direct:['Not sure I can answer that cleanly as phrased. What’s the context?','Outside what I can parse cleanly — give me a bit more to go on.']
      }[persona];
      const p=pick(qBank,'fallback:openq:'+persona,state);
      return {text:questionsPaused?p.text.replace(/\?/g,'.'):p.text,keys:[p.key]};
    }

    // Acknowledge emotional or gist meaning gracefully instead of scolding user's phrasing.
    const keys=[];
    const leadRes=reflectTopic({nlu,rawText,state,topic,isTopicShift:false,questionsPaused});
    if(leadRes.key)keys.push(leadRes.key);
    const lead=leadRes.text;
    let middle='';
    if(gist&&gist.phrase&&gist.phrase.length<=55){
      const echoed=cleanFrag(mirrorPronouns(gist.phrase));
      if(gist.pattern==='desire')middle=` Wanting to ${lowerFirst(echoed)} makes complete sense.`;
      else if(gist.pattern==='effort')middle=` Taking a swing at ${lowerFirst(echoed)} is a solid focus.`;
      else if(gist.pattern==='subject_state'&&gist.subject)middle=` Funny how much attention your ${gist.subject} can pull once things get moving.`;
    }
    if(!middle&&affect.valence==='neutral'&&misses>=2){
      const mBank={
        warm:[' Tell me a bit more about where you want to take this.',' We can take that wherever you want next.'],
        playful:[' Throw me the next piece when you’re ready.',' Where are we steering this next?'],
        thoughtful:[' Give me one concrete detail you want to unpack.',' Let me know which thread you want to follow.'],
        direct:[' What’s the main piece you want to look at?',' Point me at what comes next.']
      }[persona];
      const mp=pick(mBank,'fallback:miss:'+persona,state);
      keys.push(mp.key);
      middle=mp.text;
    }

    if(questionsPaused)return {text:(lead+middle).trim(),keys};

    // Vary whether we tack on a question so open chat doesn't interrogate every turn.
    const turnCount=(state?.usage?.['fallback:turn:'+persona])||0;
    keys.push('fallback:turn:'+persona);
    if(middle||turnCount%2===1){
      return {text:`${lead}${middle}`.replace(/\s+/g,' ').trim(),keys};
    }

    const tailored=(K.conversationTailored?.[topic]?.[0]);
    const followPick=topic!=='general'&&tailored
      ?{text:` ${tailored}`,key:null}
      :pick([
        ' What part of that are you focusing on right now?',
        ' What sparked that?',
        ' Want to dig into that more, or switch to something else?'
      ],'fallback:q:'+persona,state);
    if(followPick.key)keys.push(followPick.key);

    return {text:`${lead}${middle}${followPick.text}`.replace(/\s+/g,' ').trim(),keys};
  }

  // Wrap a verified Realization sentence (preserving the exact substring span!) in warm human phrasing.
  function wrapGroundedPreference({realizedText,changed,created,records,nlu,state}){
    if(changed){
      return pick([
        `Got that update: ${realizedText}`,
        `Noted the shift! ${realizedText}`,
        `Updated cleanly: ${realizedText}`
      ],'wrap:pref:chg',state);
    }
    if(created){
      const pref=records?.[0]?.predicate,pol=records?.[0]?.polarity;
      if(['dislike','dislikes','hate','hates','avoid','avoids'].includes(pref)||pol==='negative'){
        return pick([
          `Fair enough. ${realizedText}`,
          `Totally valid. ${realizedText}`,
          `Good boundary to know: ${realizedText}`
        ],'wrap:pref:neg',state);
      }
      if(['like','likes','love','loves','enjoy','enjoys'].includes(pref)){
        return pick([
          `Oh nice! ${realizedText}`,
          `Good taste! ${realizedText}`,
          `Noted with a smile: ${realizedText}`,
          `Right on. ${realizedText}`
        ],'wrap:pref:pos',state);
      }
      return pick([
        `Got it. ${realizedText}`,
        `Noted: ${realizedText}`
      ],'wrap:pref:new',state);
    }
    return {text:`⟦@saved⟧. ${realizedText}`,key:'wrap:pref:old'};
  }

  function wrapGroundedMood({realizedText,state,nlu}){
    const tag=nlu?.affect?.primary;
    if(tag==='stressed'||tag==='frustrated'||tag==='sad'||tag==='tired'){
      return pick([
        `I hear you — ${realizedText}`,
        `Thank you for being honest about that. ${realizedText}`
      ],'wrap:mood:low',state);
    }
    return pick([
      `Glad to know where you are at. ${realizedText}`,
      `Makes sense — ${realizedText}`
    ],'wrap:mood:ok',state);
  }

  K.Responder=K.freeze({
    personaOf,
    reflectTopic,
    respondReaction,
    respondInviteShare,
    respondHelpRequest,
    respondOpinion,
    respondKiraPersona,
    respondKiraTaste,
    respondEpisodicRecall,
    respondNovelFallback,
    wrapGroundedPreference,
    wrapGroundedMood
  });
})(Kira);
