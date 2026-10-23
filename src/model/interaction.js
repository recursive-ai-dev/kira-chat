'use strict';
// Pragmatic planning and controlled conversational grammar. Plans contain speech acts and argument
// frames, not complete authored replies. These acts ask, offer or state the app's capabilities; they
// never establish user memories, world facts, or a fictional character's real experiences.
(function(K){
  const VERSION='interaction/1',MAX_MOVES=6,MAX_TEXT=16000;
  const kinds=['greet','farewell','thanks','how','social','decline','laugh','stay','about','capabilities','honest','support','loss','affection','topic','question'];
  const questionKinds=['start','check_in','reason','detail','alternative','continue','offer_more','name_topic'];
  const personas=['warm','playful','thoughtful','direct'];
  const TOPICS={gaming:'games',coding:'coding',music:'music',writing:'writing',coffee:'coffee',nature:'nature',science:'science',cooking:'cooking',reading:'reading',art:'art',hiking:'hiking',feelings:'feelings',support:'this subject',general:'this subject',sports:'sports',screen:'films and television',pets:'pets',people:'people',travel:'travel',weather:'weather',school:'school',work:'work',hobbies:'hobbies',home:'home',history:'history',philosophy:'philosophy'};
  // Nominals carry their own determiners. Opaque user labels are a different node type and never
  // supply verbs, prepositions, inflection rules or another sentence.
  const NOMINALS={
    conversation:{head:'conversation',determiner:'this'},time:{head:'time',determiner:'our'},pace:{head:'pace',determiner:'the'},
    detail:{head:'detail',determiner:'one'},thought:{head:'thought',determiner:'a'},subject:{head:'subject',determiner:'this'},
    more:{head:'more',determiner:''},another:{head:'one',determiner:'another'},care:{head:'care of yourself',determiner:''},
    pause:{head:'pause',determiner:'a'},space:{head:'space',determiner:'some'},reports:{head:'reports',determiner:'your'},
    meanings:{head:'meanings',determiner:'uncertain'},sentences:{head:'sentences',determiner:''},grammar:{head:'grammar rules',determiner:'explicit'},
    character:{head:'character',determiner:'a',adjective:'fictional'},body:{head:'body',determiner:'a'},outside_life:{head:'life outside this chat',determiner:'a'},
    safety:{head:'space to talk',determiner:'some'},today:{head:'today',determiner:''},question:{head:'question',determiner:'a'},
    step:{head:'step',determiner:'the next'},perspective:{head:'perspective',determiner:'another'},start:{head:'start',determiner:'a'},
    music:{head:'music',determiner:''},sports:{head:'sports',determiner:''},another_subject:{head:'subject',determiner:'another'}
  };
  // Valency and permitted object classes are shared by statements, offers and questions.
  const VERBS={
    listen:{base:'listen',ing:'listening',objects:[null]},talk:{base:'talk',ing:'talking',preposition:'about',objects:['subject','literal']},
    continue:{base:'continue',ing:'continuing',objects:['conversation']},take:{base:'take',ing:'taking',objects:['time','pause']},
    choose:{base:'choose',ing:'choosing',objects:['pace','subject','another_subject','step']},start:{base:'start',ing:'starting',preposition:'with',objects:['detail','thought','question','literal']},
    share:{base:'share',ing:'sharing',objects:['thought','more','literal']},explore:{base:'explore',ing:'exploring',objects:['subject','perspective','literal']},
    pause:{base:'pause',ing:'pausing',objects:[null]},return:{base:'return',ing:'returning',preposition:'to',objects:['conversation','subject','literal']},
    hear:{base:'hear',ing:'hearing',objects:['another']},remember:{base:'remember',ing:'remembering',objects:['reports']},
    clarify:{base:'clarify',ing:'clarifying',objects:['meanings']},compose:{base:'compose',ing:'composing',objects:['sentences']},
    work:{base:'work',ing:'working',preposition:'with',objects:['grammar']},give:{base:'give',ing:'giving',objects:['space','safety']},
    take_care:{base:'take',ing:'taking',objects:['care']},play:{base:'play',ing:'playing',objects:['music','sports']},
    listen_to:{base:'listen',ing:'listening',preposition:'to',objects:['music']},watch:{base:'watch',ing:'watching',objects:['sports']}
  };
  const PARTICLES={hello:'Hello',hi:'Hi',hey:'Hey',greetings:'Greetings',okay:'Okay',understood:'Understood',noted:'Noted',right:'All right',welcome:'You’re welcome',of_course:'Of course',anytime:'Anytime',thank_you:'Thank you',sorry:'I’m sorry',take_care:'Take care',goodbye:'Goodbye',see_you:'See you later'};
  const check=(ok,reason)=>K.assert(ok,'Interaction: '+reason);
  const own=(object,key)=>Object.hasOwn(object,key);
  function shape(value,keys,label){check(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object');check(Object.keys(value).length===keys.length&&keys.every(key=>own(value,key)),label+' has unknown or missing fields');}
  function text(value,label,max=2000){check(typeof value==='string'&&value.trim().length>0&&value.length<=max,label+' must be nonempty bounded text');return value;}
  const cap=value=>value[0].toUpperCase()+value.slice(1);
  const end=value=>/[.!?]$/.test(value)?value:value+'.';
  const literal=value=>({type:'literal',value});
  const nominal=id=>({type:'nominal',id});
  const action=(verb,object=null)=>({verb,object:object===null?null:typeof object==='string'?nominal(object):object});
  const particle=id=>({type:'particle',id,name:null});
  const modal=(subject,verb,object=null,adjunct=null)=>({type:'modal',subject,modal:'can',action:action(verb,object),adjunct});
  const q=(frame,extra={})=>({type:'question',frame,...extra});
  function np(node){
    check(node&&typeof node==='object','nominal is missing');
    if(node.type==='literal'){
      shape(node,['type','value'],'literal nominal');text(node.value,'literal label');
      return /[,;.!?"'“”‘’\r\n]|\b(?:and|or|but|i|you|we|he|she|they)\b/i.test(node.value)?JSON.stringify(node.value):node.value;
    }
    shape(node,['type','id'],'nominal');check(own(NOMINALS,node.id),'unknown nominal');
    const value=NOMINALS[node.id];return [value.determiner,value.adjective||'',value.head].filter(Boolean).join(' ');
  }
  function vp(node,gap=false){
    shape(node,['verb','object'],'verb phrase');check(own(VERBS,node.verb),'unknown action verb');
    const verb=VERBS[node.verb],objectKind=node.object===null?null:node.object.type==='literal'?'literal':node.object.id;
    if(gap)check(node.object===null&&['talk','share','start','explore'].includes(node.verb),'unsupported question gap');
    else check(verb.objects.includes(objectKind),'action has an incompatible argument');
    const object=node.object===null?'':np(node.object);
    return [verb.base,verb.preposition||'',object].filter(Boolean).join(' ');
  }
  function renderQuestion(move){
    const frame=move.frame;
    if(frame==='desired'){
      shape(move,['type','frame','action'],'desired question');return 'What would you like to '+vp(move.action,true)+'?';
    }
    if(frame==='polar'){
      shape(move,['type','frame','action'],'polar question');return 'Would you like to '+vp(move.action)+'?';
    }
    if(frame==='choice'){
      shape(move,['type','frame','actions'],'choice question');check(Array.isArray(move.actions)&&move.actions.length===2,'a choice needs two alternatives');
      return 'Would you rather '+move.actions.map(a=>vp(a)).join(' or ')+'?';
    }
    if(frame==='check_in'){
      shape(move,['type','frame','aspect'],'check-in question');check(['doing','feeling'].includes(move.aspect),'unknown check-in aspect');return 'How are you '+move.aspect+'?';
    }
    if(frame==='existential'){
      shape(move,['type','frame','noun','action'],'existential question');check(['detail','part','question'].includes(move.noun),'unknown discussion unit');
      return 'Is there a '+move.noun+' you would like to '+vp(move.action,true)+'?';
    }
    if(frame==='wh_object'){
      shape(move,['type','frame','verb','target'],'object question');check(['enjoy','notice','value','remember'].includes(move.verb),'unknown question predicate');
      return 'What do you '+move.verb+' about '+np(move.target)+'?';
    }
    if(frame==='wh_subject'){
      shape(move,['type','frame','verb','target'],'subject question');check(['interest','matter','stand_out'].includes(move.verb),'unknown attention predicate');
      const predicate=move.verb==='interest'?'interests you':move.verb==='matter'?'matters to you':'stands out to you';
      return 'What '+predicate+' about '+np(move.target)+'?';
    }
    if(frame==='learn'){
      shape(move,['type','frame','verb','target'],'learning question');check(['learn','understand','discover'].includes(move.verb),'unknown learning action');
      return 'What would you like to '+move.verb+' about '+np(move.target)+'?';
    }
    if(frame==='experience'){
      shape(move,['type','frame','target'],'experience question');return 'What is your experience with '+np(move.target)+'?';
    }
    if(frame==='time'){
      shape(move,['type','frame','target'],'time question');return 'When did '+np(move.target)+' first catch your attention?';
    }
    if(frame==='part'){
      shape(move,['type','frame','target','action'],'part question');check(['explore','understand'].includes(move.action),'unknown part action');
      return 'Which part of '+np(move.target)+' would you like to '+move.action+'?';
    }
    if(frame==='connection'){
      shape(move,['type','frame','target'],'connection question');return 'Is there a memory you connect with '+np(move.target)+'?';
    }
    if(frame==='change'){
      shape(move,['type','frame','target'],'hypothetical change question');return 'What would you change about '+np(move.target)+'?';
    }
    if(frame==='describe'){
      shape(move,['type','frame','target'],'description question');return 'How would you describe '+np(move.target)+'?';
    }
    if(frame==='engagement'){
      shape(move,['type','frame','activities'],'engagement question');
      check(Array.isArray(move.activities)&&move.activities.length===2,'engagement needs two activities');
      check(move.activities.every(a=>['play','listen_to','watch'].includes(a?.verb)),'unsupported engagement activity');
      return 'Do you prefer to '+move.activities.map(a=>vp(a)).join(', ') +', or do both?';
    }
    if(frame==='debug'){
      shape(move,['type','frame'],'debug question');return 'What happens when it fails, and what did you expect instead?';
    }
    check(false,'unknown question frame');
  }
  function realize(tree){
    shape(tree,['type','version','kind','stance','questionsPaused','moves'],'interaction tree');
    check(tree.type==='interaction'&&tree.version===VERSION&&kinds.includes(tree.kind),'unknown interaction kind or grammar version');
    check(typeof tree.questionsPaused==='boolean','question pause must be explicit');
    check(['neutral','averse'].includes(tree.stance),'unknown conversational stance');
    check(Array.isArray(tree.moves)&&tree.moves.length>=1&&tree.moves.length<=MAX_MOVES,'interaction requires 1–6 moves');
    const derivation=[],questions=[];
    const parts=tree.moves.map(move=>{
      check(move&&typeof move==='object'&&!Array.isArray(move),'speech act is missing');let output;
      switch(move.type){
        case 'particle':
          shape(move,['type','id','name'],'particle');check(own(PARTICLES,move.id),'unknown conversational particle');
          output=PARTICLES[move.id];if(move.name!==null){text(move.name,'address name',100);check(['hello','hi','hey','greetings'].includes(move.id),'only greetings address a name');output+=', '+np(literal(move.name));}output=end(output);break;
        case 'modal':
          shape(move,['type','subject','modal','action','adjunct'],'modal clause');
          check(['i','we','you'].includes(move.subject)&&move.modal==='can','unsupported conversational modal');
          // These combinations state conversational permission/capability, not external facts.
          const allowed={i:['listen','remember','clarify','compose','give'],we:['talk','continue','take','start','pause','return','explore'],you:['choose','share','pause','start']};
          check(allowed[move.subject].includes(move.action?.verb),'unsupported subject capability');
          check(move.adjunct===null||move.adjunct==='another_time','unknown adjunct');
          check(move.adjunct===null||['continue','return'].includes(move.action.verb),'time adjunct needs continuation');
          output=cap(move.subject)+' can '+vp(move.action)+(move.adjunct?' another time':'')+'.';break;
        case 'identity':
          shape(move,['type','category'],'identity clause');check(move.category==='character','unsupported identity');output='I am '+np(nominal(move.category))+'.';break;
        case 'absence':
          shape(move,['type','object'],'absence clause');check(['body','outside_life'].includes(move.object),'unsupported absence');output='I do not have '+np(nominal(move.object))+'.';break;
        case 'mechanism':
          shape(move,['type','action'],'mechanism clause');check(move.action?.verb==='work','unsupported mechanism');output='I '+vp(move.action)+'.';break;
        case 'imperative':
          shape(move,['type','action'],'imperative');check(['take_care','pause','choose','share'].includes(move.action?.verb),'unsupported conversational imperative');output=cap(vp(move.action))+'.';break;
        case 'question':
          if(tree.kind==='topic'&&tree.stance==='averse')check(!['wh_subject','time','engagement'].includes(move.frame)&&!(move.frame==='wh_object'&&['enjoy','value'].includes(move.verb)),'averse questions cannot assume positive interest');
          check(!tree.questionsPaused,'paused interaction cannot contain optional questions');output=renderQuestion(move);questions.push(output);break;
        default:check(false,'unknown speech act');
      }
      check(output.length<=MAX_TEXT,'speech act text budget exceeded');derivation.push({rule:'interaction.'+move.type,inputs:K.clone(move),text:output});return output;
    });
    const renderedText=parts.join(' ');check(renderedText.length<=MAX_TEXT,'interaction text budget exceeded');
    const result={version:VERSION,tree:K.clone(tree),text:renderedText,derivation,questions};result.digest=K.hash(result);return K.freeze(result);
  }
  function verify(result){
    shape(result,['version','tree','text','derivation','questions','digest'],'interaction result');check(result.version===VERSION,'unknown result version');
    const expected=realize(result.tree);check(result.text===expected.text,'text differs from its speech acts');
    check(K.hash(result.derivation)===K.hash(expected.derivation),'derivation differs');check(K.hash(result.questions)===K.hash(expected.questions),'question list differs');check(result.digest===expected.digest,'interaction digest differs');return true;
  }
  function plan(kind,options={}){
    check(kinds.includes(kind),'unsupported plan kind');check(options&&typeof options==='object'&&!Array.isArray(options),'options must be an object');
    const allowed=['persona','register','index','topic','label','answer','questionsPaused','question','greeting','name','stance'];
    check(Object.keys(options).every(key=>allowed.includes(key)),'unknown planner option');
    const persona=options.persona??'warm',register=options.register??-1000,index=options.index??0,paused=options.questionsPaused===true;
    check(personas.includes(persona),'unknown persona');check(Number.isInteger(register)&&register>=-2000&&register<=2000,'invalid register');
    check(Number.isSafeInteger(index)&&index>=0,'invalid variation index');
    if(options.questionsPaused!==undefined)check(typeof options.questionsPaused==='boolean','questionsPaused must be boolean');
    const stance=options.stance??'neutral';check(['neutral','averse'].includes(stance),'unknown conversational stance');
    if(options.topic!==undefined)text(options.topic,'topic',100);
    if(options.label!==undefined&&options.label!==null)text(options.label,'topic label');
    if(options.answer!==undefined&&options.answer!==null)text(options.answer,'answer');
    const moves=[],add=move=>moves.push(move),ask=move=>{if(!paused)add(move);};
    const p=personas.indexOf(persona),target=literal(options.label||TOPICS[options.topic]||TOPICS.general);
    const startQuestion=()=>q('desired',{action:action('talk')});
    const detailQuestion=()=>q('existential',{noun:persona==='thoughtful'?'detail':'part',action:action('start')});
    const invite=()=>ask(index%2?q('polar',{action:action('share','thought')}):startQuestion());
    if(kind==='topic'){
      const variant=Math.floor(index/9)%3;
      const questions=[
        q('wh_subject',{verb:['interest','matter','stand_out'][variant],target}),
        q('wh_object',{verb:['notice','enjoy','value'][variant],target}),
        q('learn',{verb:['learn','understand','discover'][variant],target}),
        q('experience',{target}),q('part',{target,action:variant===1?'understand':'explore'}),
        q('time',{target}),q('connection',{target}),
        q('wh_object',{verb:['remember','value','enjoy'][variant],target}),
        q('choice',{actions:[action('explore',target),action('talk','subject')]})
      ];
      const answer=options.answer||'';
      const averseQuestions=[q('wh_object',{verb:'notice',target}),q('learn',{verb:['understand','learn','discover'][variant],target}),q('experience',{target}),q('describe',{target}),q('change',{target}),q('part',{target,action:'understand'}),q('choice',{actions:[action('talk',target),action('choose','another_subject')]})];
      if(stance==='averse')ask(averseQuestions[index%averseQuestions.length]);
      else if(index%9===0&&options.topic==='music'&&/\b(?:guitar|piano|bass|drums?|violin|synth|instruments?|listen\w*|play\w*)\b/i.test(answer))ask(q('engagement',{activities:[action('play','music'),action('listen_to','music')]}));
      else if(index%9===0&&options.topic==='sports'&&/\b(?:play\w*|watch\w*|team|match|game)\b/i.test(answer))ask(q('engagement',{activities:[action('play','sports'),action('watch','sports')]}));
      else if(index%9===0&&options.topic==='coding'&&/\b(?:bugs?|errors?|crash\w*|fails?|broken|does not work|doesn't work)\b/i.test(answer))ask(q('debug'));
      else ask(questions[index%questions.length]);
    }else if(kind==='question'){
      check(questionKinds.includes(options.question),'unsupported question purpose');
      const questions={
        start:()=>q('desired',{action:action('start')}),check_in:()=>q('check_in',{aspect:index%2?'feeling':'doing'}),
        reason:()=>q('wh_subject',{verb:'interest',target}),detail:detailQuestion,
        alternative:()=>q('choice',{actions:[action('talk','subject'),action('pause')]}),
        continue:()=>q('polar',{action:action('continue','conversation')}),
        offer_more:()=>q('polar',{action:action('hear','another')}),
        name_topic:()=>q('learn',{verb:['learn','understand','discover'][index%3],target})
      };ask(questions[options.question]());
    }else if(kind==='greet'){
      if(options.greeting!==undefined)text(options.greeting,'greeting lexeme',20);
      const greeting=options.greeting===undefined?(register>=1000?'greetings':register<=-1500?'hi':['hello','hi','hey'][index%3]):options.greeting.toLowerCase();
      check(['hello','hi','hey','greetings'].includes(greeting),'unsupported greeting lexeme');
      const salutation=particle(greeting);if(options.name!==undefined&&options.name!==null){text(options.name,'address name',100);salutation.name=options.name;}add(salutation);
      if(persona!=='direct')add(index%2?modal('i','listen'):modal('we','start','detail'));invite();
    }else if(kind==='thanks'){
      add(particle(['welcome','of_course','anytime'][index%3]));
      const actions=[modal('we','take','time'),modal('you','choose','pace'),modal('we','continue','conversation')];add(actions[Math.floor(index/3)%3]);
      if(persona==='direct')invite();
    }else if(kind==='farewell'){
      const id=['goodbye','see_you','take_care'][index%3];add(particle(id));
      add(index%2&&id!=='take_care'?{type:'imperative',action:action('take_care','care')}:modal('we','continue','conversation','another_time'));
    }else if(kind==='how'){
      add(index%2?modal('i','listen'):modal('we','talk','subject'));ask(q('check_in',{aspect:index%2?'feeling':'doing'}));
    }else if(kind==='about'||kind==='honest'||kind==='capabilities'){
      if(kind!=='capabilities')add({type:'identity',category:'character'});
      if(kind==='honest')add({type:'absence',object:index%2?'body':'outside_life'});
      if(kind==='about')add({type:'mechanism',action:action('work','grammar')});
      if(kind==='capabilities'){
        const capabilities=[modal('i','remember','reports'),modal('i','clarify','meanings'),modal('i','compose','sentences')];
        add(capabilities[index%3]);add(capabilities[(index+1)%3]);
      }
      ask(kind==='capabilities'?q('desired',{action:action('start')}):startQuestion());
    }else if(kind==='support'||kind==='loss'){
      if(kind==='loss')add(particle('sorry'));
      add(persona==='direct'?modal('i','listen'):modal('we',index%2?'start':'take',index%2?'detail':'time'));
      ask(persona==='thoughtful'?detailQuestion():index%2?q('polar',{action:action('share','thought')}):q('desired',{action:action('share')}));
    }else if(kind==='decline'){
      add(particle(index%2?'understood':'okay'));add(modal('you','choose','another_subject'));ask(startQuestion());
    }else if(kind==='laugh'){
      add(particle(['okay','right','noted'][index%3]));ask(q('polar',{action:action('hear','another')}));
    }else if(kind==='stay'){
      add(modal('we','continue','conversation'));ask(index%2?q('choice',{actions:[action('talk','subject'),action('take','pause')]}):startQuestion());
    }else if(kind==='affection'){
      add(particle('thank_you'));add({type:'identity',category:'character'});
      if(persona!=='direct')add(modal('i','listen'));invite();
    }else{
      add(particle(['okay','understood','right','noted'][(index+p)%4]));
      if(persona==='warm'||persona==='thoughtful')add(index%2?modal('you','choose','pace'):modal('i','listen'));
      invite();
    }
    if(!moves.length)add(modal('i','listen'));
    const tree={type:'interaction',version:VERSION,kind,stance,questionsPaused:paused,moves};
    realize(tree);return K.freeze(tree);
  }
  K.Interaction=K.freeze({version:VERSION,kinds,questionKinds,plan,realize,verify});
})(Kira);
