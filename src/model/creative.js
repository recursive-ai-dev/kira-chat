'use strict';
// Small fictional worlds and word-sense jokes are planned from compatible lexical frames.
// No sentence bank, clock, random source, external text, or conversation memory participates.
(function(K){
  const VERSION='creative/1',MAX_TEXT=8000;
  const check=(ok,reason)=>K.assert(ok,'Creative: '+reason);
  const has=(object,key)=>Object.hasOwn(object,key);
  const shape=(value,keys,label)=>check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>has(value,key)),label+' has unknown or missing fields');
  const noun=(lemma,article='a',number='singular',count='count')=>({lemma,article,number,count});
  const nouns={
    archivist:noun('archivist','an'),porter:noun('porter'),gardener:noun('gardener'),teacher:noun('music teacher'),mapmaker:noun('mapmaker'),caretaker:noun('caretaker'),baker:noun('baker'),watchmaker:noun('watchmaker'),
    courier:noun('courier'),postmaster:noun('postmaster'),keeper:noun('lighthouse keeper'),surveyor:noun('surveyor'),navigator:noun('navigator'),apprentice:noun('apprentice','an'),stationkeeper:noun('station keeper'),photographer:noun('photographer'),librarian:noun('librarian'),historian:noun('historian'),composer:noun('composer'),pianist:noun('pianist'),choirmaster:noun('choirmaster'),maker:noun('instrument maker','an'),beekeeper:noun('beekeeper'),ranger:noun('ranger'),botanist:noun('botanist'),
    station:noun('quiet railway station'),library:noun('midnight library'),cafe:noun('tiny café'),lighthouse:noun('remote lighthouse'),workshop:noun('cluttered workshop'),market:noun('covered market'),theatre:noun('empty theatre','an'),garden:noun('walled garden'),
    clock:noun('clock'),keyboard:noun('keyboard'),coffee:noun('cup of coffee'),calendar:noun('calendar'),tree:noun('tree'),lamp:noun('lamp'),book:noun('book'),piano:noun('piano'),
    letter:noun('sealed letter'),parcel:noun('parcel'),postcard:noun('postcard'),letters:noun('letters','', 'plural'),
    map:noun('map'),atlas:noun('atlas','an'),chart:noun('star chart'),maps:noun('maps','', 'plural'),
    pocketwatch:noun('pocket watch'),timetable:noun('timetable'),clocks:noun('clocks','', 'plural'),
    photograph:noun('photograph'),negatives:noun('box of negatives'),diary:noun('diary'),photographs:noun('photographs','', 'plural'),
    score:noun('musical score'),violin:noun('violin'),organ:noun('organ','an'),sheetmusic:noun('sheet music','', 'singular','mass'),
    seed:noun('seed'),orchid:noun('orchid','an'),wildflowers:noun('wildflowers','', 'plural'),hive:noun('beehive'),
    second:noun('second'),spacebar:noun('space bar'),grounds:noun('grounds','', 'plural','mass'),days:noun('days','', 'plural'),roots:noun('roots','', 'plural'),light:noun('light','', 'singular','mass'),spine:noun('spine'),keys:noun('keys','', 'plural'),
  };
  const actors=['archivist','porter','gardener','teacher','mapmaker','caretaker','baker','watchmaker'];
  const settings=['station','library','cafe','lighthouse','workshop','market','theatre','garden'];
  const modifiers={warm:{lemma:'patient',article:'a'},playful:{lemma:'overconfident',article:'an'},thoughtful:{lemma:'meticulous',article:'a'},direct:null};
  const jokeFrames={
    second:{subject:'clock',mechanism:'literal-unit',request:'help',response:'spare',tasks:['sorting tickets','packing books','hanging decorations','carrying supplies'],topics:['general','coding','work']},
    space:{subject:'keyboard',mechanism:'wrong-sense-resource',request:'room',response:'space',tasks:['another suitcase','an extra guest','a stack of books','a large painting'],topics:['general','coding','home']},
    grounds:{subject:'coffee',mechanism:'homonym',request:'reason',response:'grounds',tasks:['opening early','taking a break','changing the menu','staying up late'],topics:['general','coffee','cooking']},
    numbered:{subject:'calendar',mechanism:'literal-idiom',request:'future',response:'numbered',tasks:['the next celebration','the last train','the annual concert','the spring fair'],topics:['general','work','travel']},
    roots:{subject:'tree',mechanism:'literal-idiom',request:'ancestry',response:'roots',tasks:['a family history','an old village chronicle','a missing ancestor','a forgotten family name'],topics:['general','nature','people']},
    light:{subject:'lamp',mechanism:'literal-idiom',request:'clarify',response:'light',tasks:['a difficult passage','a confusing diagram','an unfinished plan','a mysterious note'],topics:['general','reading','science']},
    spine:{subject:'book',mechanism:'literal-idiom',request:'courage',response:'spine',tasks:['a strict reviewer','an impatient editor','a noisy critic','the town council'],topics:['general','reading','writing']},
    keys:{subject:'piano',mechanism:'wrong-sense-resource',request:'unlock',response:'keys',tasks:['a locked cupboard','the archive door','a heavy suitcase','a forgotten chest'],topics:['general','music','home']},
  };
  const domains={
    correspondence:{actors:['courier','postmaster','archivist','keeper'],objects:['letter','parcel','postcard','letters'],goal:'deliver',complications:['moving-address','future-date','reply-first','absent-recipient'],choices:[['deliver the message','hide the message'],['open the message','honor its privacy'],['trust the address','trust the intended recipient'],['return the message','follow its instructions']]},
    cartography:{actors:['mapmaker','surveyor','navigator','apprentice'],objects:['map','atlas','chart','maps'],goal:'finish',complications:['moving-route','changing-map','omitted-home','unvisited-place'],choices:[['publish the map','destroy the map'],['follow the route','erase the route'],['finish the map','leave one place unknown'],['guide the others','travel alone']]},
    time:{actors:['watchmaker','stationkeeper','caretaker','archivist'],objects:['clock','pocketwatch','timetable','clocks'],goal:'restore',complications:['one-day-ahead','stops-at-lies','unhappened-events','other-place-time'],choices:[['restore the old schedule','keep the new rhythm'],['set the time right','reveal what changed it'],['warn the others','test the mechanism first'],['stop the mechanism','let it run']]},
    memory:{actors:['archivist','photographer','librarian','historian'],objects:['photograph','negatives','diary','photographs'],goal:'preserve',complications:['changing-record','unknown-person','unlived-memory','fading-person'],choices:[['restore the old account','preserve the altered record'],['tell the truth','honor an old promise'],['open the archive','close it for good'],['seek a witness','preserve the mystery']]},
    music:{actors:['composer','pianist','choirmaster','maker'],objects:['score','violin','organ','sheetmusic'],goal:'restore',complications:['changing-melody','unwritten-music','unheard-listener','answering-music'],choices:[['perform the music','keep it unheard'],['change the ending','keep the written ending'],['share the melody','protect its creator'],['follow the music','bring it to a stop']]},
    nature:{actors:['gardener','beekeeper','ranger','botanist'],objects:['seed','orchid','wildflowers','hive'],goal:'protect',complications:['vanishing-growth','moving-growth','night-growth','remembering-growth'],choices:[['show the discovery to the town','keep its location secret'],['move the discovery to safety','stay and protect it'],['invite help','keep watch alone'],['follow the strange growth','close the trail']]},
  };
  const complicationDomain={};
  for(const [domain,definition]of Object.entries(domains))for(const id of definition.complications)complicationDomain[id]=domain;
  const forms=['narration','dialogue','question'],promptForms=['location-first','arrival','in-progress'];
  const perspectives=['dialogue','first-person','third-person','actions'];
  const stakes=['promise','celebration','confidence','departure'];
  const verbs={carry:{present:'carries',past:'carried'},contain:{present:'contains',past:'contained'},change:{present:'changes',past:'changed'},omit:{present:'omits',past:'omitted'},show:{present:'shows',past:'showed'},run:{present:'runs',past:'ran'},stop:{present:'stops',past:'stopped'},mark:{present:'marks',past:'marked'},keep:{present:'keeps',past:'kept'},record:{present:'records',past:'recorded'},lose:{present:'loses',past:'lost'},produce:{present:'produces',past:'produced'},respond:{present:'responds',past:'responded'},vanish:{present:'vanishes',past:'vanished'},move:{present:'moves',past:'moved'},appear:{present:'appears',past:'appeared'},remember:{present:'remembers',past:'remembered'}};
  const capitalize=value=>value[0].toUpperCase()+value.slice(1);
  function np(id,definite=false,modifier=null){
    const item=nouns[id];check(item,'unknown noun '+id);
    const body=(modifier?modifier.lemma+' ':'')+item.lemma;
    return definite?'the '+body:item.count==='mass'?'some '+body:item.number==='plural'?body:(modifier?.article||item.article)+' '+body;
  }
  const actorPhrase=(id,style,definite=false)=>np(id,definite,modifiers[style.persona]);
  const finite=(verb,id)=>nouns[id].number==='plural'?verb:verbs[verb].present;
  function style(value){
    shape(value,['persona','register'],'style');
    check(has(modifiers,value.persona),'unknown persona');
    check(Number.isInteger(value.register)&&value.register>=-2000&&value.register<=2000,'register must be an integer in -2000..2000');
  }
  function pool(kind,topic){
    check(kind==='joke'||kind==='prompt','unsupported creative kind');
    if(topic!==undefined&&topic!==null)check(typeof topic==='string'&&topic.length<=100,'topic must be bounded text');
    const all=Object.keys(kind==='joke'?jokeFrames:domains);
    if(kind==='prompt')return topic&&has(domains,topic)?[topic]:all;
    const matches=topic&&topic!=='general'?all.filter(id=>jokeFrames[id].topics.includes(topic)):[];
    return matches.length?matches:all;
  }
  function dimensions(kind,topic){return kind==='joke'?[pool(kind,topic).length,actors.length,settings.length,4,forms.length]:[pool(kind,topic).length,4,settings.length,4,4,stakes.length,perspectives.length,4,promptForms.length];}
  function capacity(kind,options={}){return dimensions(kind,options.topic).reduce((product,size)=>product*size,1);}
  function choices(index,sizes){
    let cursor=index,offset=0;
    return sizes.map(size=>{const digit=cursor%size,value=(digit+offset)%size;cursor=Math.floor(cursor/size);offset+=digit;return value;});
  }
  function plan(kind,options={}){
    check(Number.isSafeInteger(options.index)&&options.index>=0,'index must be a nonnegative safe integer');
    const voice={persona:options.persona??'warm',register:options.register??-1000};style(voice);
    const ids=pool(kind,options.topic),pick=choices(options.index%capacity(kind,options),dimensions(kind,options.topic));
    let tree;
    if(kind==='joke'){
      const [frame,actor,setting,task,form]=pick;
      tree={version:VERSION,kind,scope:'fiction',style:voice,frame:ids[frame],actor:actors[actor],setting:settings[setting],task,form:forms[form]};
    }else{
      const [domain,actor,setting,object,complication,stake,perspective,choice,form]=pick,definition=domains[ids[domain]];
      tree={version:VERSION,kind,scope:'fiction',style:voice,domain:ids[domain],actor:definition.actors[actor],setting:settings[setting],object:definition.objects[object],complication:definition.complications[complication],stake:stakes[stake],perspective:perspectives[perspective],choice,form:promptForms[form]};
    }
    return K.freeze(tree);
  }
  function request(frame,task,formal){
    switch(frame.request){
      case 'help':return (formal?'assist':'help')+' with '+task;
      case 'room':return 'make room for '+task;
      case 'reason':return 'give a reason for '+task;
      case 'future':return 'predict what would happen after '+task;
      case 'ancestry':return 'help trace '+task;
      case 'clarify':return 'make '+task+' clearer';
      case 'courage':return 'stand up to '+task;
      case 'unlock':return 'unlock '+task;
      default:check(false,'unsupported joke request');
    }
  }
  function answer(frame){
    // These are lexical sense relations expressed as clauses, not standalone stored jokes.
    const possessed=id=>'my '+nouns[id].lemma;
    switch(frame.response){
      case 'spare':return 'I can only spare '+np('second');
      case 'space':return 'Take '+possessed('spacebar');
      case 'grounds':return 'Consider '+possessed('grounds');
      case 'numbered':return capitalize(possessed('days'))+' are numbered';
      case 'roots':return 'Look at '+possessed('roots');
      case 'light':return 'I can shed '+np('light')+' on it';
      case 'spine':return 'I have the '+nouns.spine.lemma+' for it';
      case 'keys':return 'I have '+possessed('keys');
      default:check(false,'unsupported joke answer');
    }
  }
  function complication(tree){
    const object=np(tree.object,true),verb=id=>finite(id,tree.object);
    switch(tree.complication){
      case 'moving-address':return 'The address on '+object+' changes whenever someone reads it';
      case 'future-date':return capitalize(object)+' '+verb('carry')+' a date that has not happened yet';
      case 'reply-first':return capitalize(object)+' '+verb('contain')+' a reply to a question no one has asked';
      case 'absent-recipient':return 'No one in the place remembers the intended recipient';
      case 'moving-route':return 'A route on '+object+' leads to a place that moves each night';
      case 'changing-map':return capitalize(object)+' '+verb('change')+' whenever the maker looks away';
      case 'omitted-home':return capitalize(object)+' '+verb('omit')+' the only home the maker remembers';
      case 'unvisited-place':return capitalize(object)+' '+verb('show')+' a place no living person has visited';
      case 'one-day-ahead':return capitalize(object)+' '+verb('run')+' one day ahead of the town';
      case 'stops-at-lies':return capitalize(object)+' '+verb('stop')+' whenever someone nearby tells a lie';
      case 'unhappened-events':return capitalize(object)+' '+verb('mark')+' events that never happened';
      case 'other-place-time':return capitalize(object)+' '+verb('keep')+' time for a place that no longer exists';
      case 'changing-record':return capitalize(object)+' '+verb('change')+' whenever the keeper falls asleep';
      case 'unknown-person':return capitalize(object)+' '+verb('contain')+' a person no one recognizes';
      case 'unlived-memory':return capitalize(object)+' '+verb('record')+' a day its keeper has not lived';
      case 'fading-person':return capitalize(object)+' '+verb('lose')+' one familiar person at every dawn';
      case 'changing-melody':return capitalize(object)+' '+verb('change')+' melody whenever the listener remembers home';
      case 'unwritten-music':return capitalize(object)+' '+verb('produce')+' music that no one has written';
      case 'unheard-listener':return capitalize(object)+' '+verb('respond')+' to a listener nobody can see';
      case 'answering-music':return capitalize(object)+' '+verb('produce')+' an answer to the last question spoken nearby';
      case 'vanishing-growth':return capitalize(object)+' '+verb('vanish')+' whenever a visitor arrives';
      case 'moving-growth':return capitalize(object)+' '+verb('move')+' toward a different house each night';
      case 'night-growth':return capitalize(object)+' '+verb('appear')+' only after everyone has gone to sleep';
      case 'remembering-growth':return capitalize(object)+' '+verb('remember')+' the route to a long-lost garden';
      default:check(false,'unknown complication');
    }
  }
  function stake(id){
    switch(id){
      case 'promise':return 'The character has promised to finish before sunset';
      case 'celebration':return 'A local celebration depends on the work being finished';
      case 'confidence':return 'A trusted friend has asked the character to keep the discovery secret';
      case 'departure':return 'The character must leave the place at dawn';
      default:check(false,'unknown stake');
    }
  }
  function instruction(tree){
    const actor=np(tree.actor,true),[first,second]=domains[tree.domain].choices[tree.choice],choice='whether to '+first+' or '+second;
    switch(tree.perspective){
      case 'dialogue':return 'Write a conversation in which '+actor+' must choose '+choice;
      case 'first-person':return 'Tell the story in first person, making the narrator choose '+choice;
      case 'third-person':return 'Tell the story in third person, making '+actor+' choose '+choice;
      case 'actions':return 'Show through actions, rather than explanation, how '+actor+' chooses '+choice;
      default:check(false,'unknown perspective');
    }
  }
  function realize(tree){
    check(tree&&typeof tree==='object'&&!Array.isArray(tree),'tree must be an object');
    check(tree.version===VERSION&&tree.scope==='fiction','creative tree must have the supported version and fiction scope');style(tree.style);
    check(settings.includes(tree.setting),'unknown setting');
    const derivation=[],step=(rule,inputs,text,features={})=>{derivation.push({rule,inputs,text,features});return text;};
    const voice=tree.style,location='in '+np(tree.setting),formal=voice.register>0;
    let output;
    if(tree.kind==='joke'){
      shape(tree,['version','kind','scope','style','frame','actor','setting','task','form'],'joke tree');
      check(has(jokeFrames,tree.frame)&&actors.includes(tree.actor)&&forms.includes(tree.form),'unsupported joke frame, actor or form');
      const frame=jokeFrames[tree.frame];check(Number.isInteger(tree.task)&&tree.task>=0&&tree.task<frame.tasks.length,'task is incompatible with joke frame');
      const actor=step('noun.actor',[tree.actor],actorPhrase(tree.actor,voice),{number:'singular',count:'count'});
      const object=step('noun.personified-object',[frame.subject],np(frame.subject),{number:nouns[frame.subject].number,count:nouns[frame.subject].count});
      const action=step('joke.request.'+frame.request,[tree.frame,tree.task],request(frame,frame.tasks[tree.task],formal));
      const response=step('joke.word-sense.'+frame.mechanism,[tree.frame],answer(frame),{fiction:true});
      const ask='asked',reply=formal?'answered':'replied';
      let setup;
      if(tree.form==='narration')setup=capitalize(location)+', '+actor+' '+(formal?'asked':ask)+' '+object+' to '+action+'.';
      else if(tree.form==='dialogue')setup=capitalize(location)+', '+actor+' '+ask+' '+object+', “'+(formal?'Could':'Can')+' you '+action+'?”';
      else setup='What happened when '+actor+' '+(formal?'asked':ask)+' '+object+' to '+action+' '+location+'?';
      setup=step('joke.setup.'+tree.form,[0,1,2],setup);
      const punchline=step('joke.punchline',[3],'“'+response+',” '+np(frame.subject,true)+' '+reply+'.');
      output='Fictional joke: '+setup+' '+punchline;
    }else{
      shape(tree,['version','kind','scope','style','domain','actor','setting','object','complication','stake','perspective','choice','form'],'prompt tree');
      check(tree.kind==='prompt'&&has(domains,tree.domain),'unsupported prompt domain');
      const domain=domains[tree.domain];
      check(domain.actors.includes(tree.actor)&&domain.objects.includes(tree.object)&&domain.complications.includes(tree.complication)&&complicationDomain[tree.complication]===tree.domain,'prompt roles, object or complication are incompatible');
      check(stakes.includes(tree.stake)&&perspectives.includes(tree.perspective)&&promptForms.includes(tree.form),'unsupported narrative stake, perspective or form');
      check(Number.isInteger(tree.choice)&&tree.choice>=0&&tree.choice<domain.choices.length,'choice must belong to prompt domain');
      const actor=step('noun.actor',[tree.actor],actorPhrase(tree.actor,voice),{number:'singular',count:'count'});
      const object=step('noun.story-object',[tree.object],np(tree.object),{number:nouns[tree.object].number,count:nouns[tree.object].count});
      const goal=step('story.goal.'+domain.goal,[tree.domain,tree.object],domain.goal+' '+object);
      let opening;
      if(tree.form==='location-first')opening=capitalize(location)+', '+actor+' must '+goal+'.';
      else if(tree.form==='arrival')opening=capitalize(actor)+' arrives '+location+' to '+goal+'.';
      else opening='Begin with '+actor+' trying to '+goal+' '+location+'.';
      opening=step('story.opening.'+tree.form,[0,1,2],opening);
      const obstacle=step('story.complication.'+tree.complication,[tree.object],complication(tree)+'.',{subjectNumber:nouns[tree.object].number});
      const pressure=step('story.stake.'+tree.stake,[],stake(tree.stake)+'.');
      const direction=step('story.instruction.'+tree.perspective,[tree.domain,tree.choice],instruction(tree)+'.');
      output='Writing prompt: '+opening+' '+obstacle+' '+pressure+' '+direction;
    }
    check(typeof output==='string'&&output.length<=MAX_TEXT,'creative output is too long');
    const result={version:VERSION,tree:K.clone(tree),scope:'fiction',text:output,derivation,memoryIds:[]};result.digest=K.hash(result);return K.freeze(result);
  }
  function verify(result){
    shape(result,['version','tree','scope','text','derivation','memoryIds','digest'],'creative result');
    check(result.version===VERSION&&result.scope==='fiction','creative result must retain fiction scope');
    const expected=realize(result.tree);
    check(result.text===expected.text,'text differs from its creative derivation');
    check(K.hash(result.derivation)===K.hash(expected.derivation),'creative derivation differs');
    check(Array.isArray(result.memoryIds)&&result.memoryIds.length===0,'fiction cannot cite user memory as invented evidence');
    check(result.digest===expected.digest,'creative digest differs');return true;
  }
  K.Creative=K.freeze({version:VERSION,plan,realize,verify,capacity});
})(Kira);
