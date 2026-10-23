'use strict';
// Controlled surface realization. Trees contain meanings and grounded references, never executable
// templates. Verification reconstructs this grammar's derivation and exact text; it does not prove
// that arbitrary English has a meaning, nor that the user's attributed reports are true.
(function(K){
  const VERSION='realization/2',MAX_NODES=128,MAX_DEPTH=16,MAX_TEXT=32000;
  const VERBS={like:{past:'liked',gerund:'liking'},love:{past:'loved',gerund:'loving'},enjoy:{past:'enjoyed',gerund:'enjoying'},hate:{past:'hated',gerund:'hating'},dislike:{past:'disliked',gerund:'disliking'}};
  const check=(ok,reason)=>K.assert(ok,'Realization: '+reason);
  const own=(value,key)=>Object.hasOwn(value,key);
  function shape(value,keys,label){
    check(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object');
    check(Object.keys(value).length===keys.length&&keys.every(key=>own(value,key)),label+' has unknown or missing fields');
  }
  function text(value,label,max=2000){check(typeof value==='string'&&value.trim().length>0&&value.length<=max,label+' must be nonempty text');return value;}
  function core(memory){
    check(memory&&typeof memory==='object','memory is missing');
    check(memory.subject==='user','only attributed user reports are supported');
    check(['name','preference','mood','note'].includes(memory.kind),'unsupported memory kind');
    check(['positive','negative'].includes(memory.polarity),'unsupported polarity');
    check(memory.object&&typeof memory.object==='object','memory object is missing');
    text(memory.object.label,'object label');text(memory.object.key,'object key');
    if(memory.kind==='preference'){
      check(own(VERBS,memory.predicate),'unsupported preference predicate');
      check(['present','past'].includes(memory.temporal),'unsupported preference tense');
    }else if(memory.kind==='mood'){
      check(memory.predicate==='feels'&&['present','past'].includes(memory.temporal),'unsupported feeling predicate or tense');
    }else if(memory.kind==='name'){
      check(memory.predicate==='name'&&memory.polarity==='positive'&&memory.temporal==='present','unsupported name report');
    }else check(memory.predicate==='said'&&memory.polarity==='positive'&&memory.temporal==='recorded','unsupported note report');
    return memory;
  }
  function memory(value){
    core(value);text(value.id,'memory id',100);text(value.sourceMessage,'source message',100);
    return {type:'clause',memoryId:value.id,sourceMessage:value.sourceMessage,kind:value.kind,subject:value.subject,predicate:value.predicate,
      object:{key:value.object.key,label:value.object.label},polarity:value.polarity,temporal:value.temporal};
  }
  const coordinate=children=>({type:'coordination',children:K.clone(children)});
  const attributed=content=>({type:'attribution',content:K.clone(content)});
  const correction=(before,after)=>({type:'correction',before:K.clone(before),after:K.clone(after)});
  const question=(kind,details={})=>({type:'question',kind,...K.clone(details)});
  const creative=content=>({type:'creative',content:K.clone(content)});
  function auxiliary(past,contractions){return past?(contractions?'didn’t':'did not'):(contractions?'don’t':'do not');}
  function predicate(clause,contractions){
    const past=clause.temporal==='past',negative=clause.polarity==='negative';
    if(clause.kind==='mood')return negative?auxiliary(past,contractions)+' feel':past?'felt':'feel';
    if(clause.kind==='preference')return negative?auxiliary(past,contractions)+' '+clause.predicate:past?'used to '+clause.predicate:clause.predicate;
    return 'name is';
  }
  function describe(value,options={}){
    const m=core(value),contractions=options.contractions===true;
    if(m.kind==='note')return m.object.label;
    if(m.kind==='name')return 'Your name is '+m.object.label;
    return 'You '+predicate(m,contractions)+' '+m.object.label;
  }
  const lowerFirst=value=>value[0].toLowerCase()+value.slice(1);
  const terminal=value=>/[.!?][”"’')\]]*$/.test(value)?value:value+'.';
  const list=values=>values.length===1?values[0]:values.length===2?values.join(' and '):values.slice(0,-1).join(', ')+', and '+values.at(-1);
  const ambiguousLabel=label=>/[,;.!?"'“”‘’\r\n]|\b(?:and|or|but|i|you|we|he|she|they)\b/i.test(label);
  // An object label is data supplied by the user, not a syntax subtree. Quoting keeps a label
  // such as "coffee, I love tea" visibly inside one object instead of introducing another claim.
  const objectLabel=label=>ambiguousLabel(label)?JSON.stringify(label):label;
  function clauseBody(node,style){
    if(node.kind==='note')return 'You gave me this note: “'+node.object.label+'”';
    if(node.kind==='name')return 'Your name is '+objectLabel(node.object.label);
    return 'You '+predicate(node,style.contractions)+' '+objectLabel(node.object.label);
  }
  function realize(tree,options={}){
    check(Array.isArray(options.memories),'source memories are required');
    if(options.messages!==undefined)check(Array.isArray(options.messages),'source messages must be an array');
    for(const key of ['contractions','terminal'])if(options[key]!==undefined)check(typeof options[key]==='boolean',key+' must be boolean');
    const style={contractions:options.contractions===true,terminal:options.terminal!==false};
    const sources=new Map();
    for(const m of options.memories){check(m&&typeof m.id==='string'&&!sources.has(m.id),'duplicate or missing source memory id');sources.set(m.id,m);}
    const derivation=[],memoryIds=[],path=new Set(),scopes=new Set();let count=0;
    const step=(rule,inputs,output,nested)=>{const entry={rule,inputs,text:output};if(nested)entry.derivation=nested;derivation.push(entry);return output;};
    function grounded(node,historical){
      shape(node,['type','memoryId','sourceMessage','kind','subject','predicate','object','polarity','temporal'],'clause');
      shape(node.object,['key','label'],'clause object');core(node);
      text(node.memoryId,'memory id',100);text(node.sourceMessage,'source message',100);
      const source=sources.get(node.memoryId);
      check(source,'missing source memory '+node.memoryId);
      check(source.status===(historical?'superseded':'active'),'source memory is not '+(historical?'superseded':'active'));
      check(source.sourceMessage===node.sourceMessage&&source.subject===node.subject&&source.kind===node.kind&&source.predicate===node.predicate&&
        source.object.key===node.object.key&&source.object.label===node.object.label&&source.polarity===node.polarity&&source.temporal===node.temporal,'clause differs from its source memory');
      if(options.messages)check(options.messages.some(message=>message.id===node.sourceMessage&&message.role==='user'&&!message.legacy),'source user message is missing');
      if(!memoryIds.includes(node.memoryId))memoryIds.push(node.memoryId);
      scopes.add('reported');
      return source;
    }
    function render(node,depth=0,historical=false){
      check(depth<=MAX_DEPTH&&++count<=MAX_NODES,'sentence tree budget exceeded');
      check(node&&typeof node==='object'&&!Array.isArray(node),'sentence node is missing');
      check(!path.has(node),'cyclic sentence tree');path.add(node);
      let output;
      switch(node.type){
        case 'clause':{
          grounded(node,historical);
          output=clauseBody(node,style);
          output=step('clause.'+node.kind+'.'+node.temporal+'.'+node.polarity,[node.memoryId],output);
          break;
        }
        case 'coordination':{
          shape(node,['type','children'],'coordination');
          check(Array.isArray(node.children)&&node.children.length>=2&&node.children.length<=12,'coordination requires 2–12 children');
          const childSteps=[],parts=node.children.map(child=>{const part=render(child,depth+1,historical);childSteps.push(derivation.length-1);return part;}),first=node.children[0];
          const merged=first.type==='clause'&&['preference','mood'].includes(first.kind)&&node.children.every(child=>
            child.type==='clause'&&child.kind===first.kind&&child.predicate===first.predicate&&child.polarity===first.polarity&&child.temporal===first.temporal&&!ambiguousLabel(child.object.label));
          output=merged?'You '+predicate(first,style.contractions)+' '+list(node.children.map(child=>objectLabel(child.object.label))):parts.map(terminal).join(' ');
          output=step(merged?'coordination.objects':'coordination.sentences',childSteps,output);
          break;
        }
        case 'attribution':{
          shape(node,['type','content'],'attribution');
          check(node.content?.type==='clause'||node.content?.type==='coordination','attribution requires reports');
          const content=render(node.content,depth+1,historical),contentStep=derivation.length-1;
          if(node.content.type==='clause'&&node.content.kind==='note')output=content;
          else if(node.content.type==='coordination'){
            check(node.content.children.every(child=>child.type==='clause'&&child.kind!=='note'),'attribution coordination requires report clauses');
            const first=node.content.children[0];
            const merged=['preference','mood'].includes(first.kind)&&node.content.children.every(child=>child.kind===first.kind&&child.predicate===first.predicate&&child.polarity===first.polarity&&child.temporal===first.temporal&&!ambiguousLabel(child.object.label));
            output=merged?'You told me that '+lowerFirst(content):node.content.children.map(child=>'You told me that '+lowerFirst(clauseBody(child,style))).map(terminal).join(' ');
          }else output='You told me that '+lowerFirst(content);
          output=step('attribution.user',[contentStep],output);
          break;
        }
        case 'correction':{
          shape(node,['type','before','after'],'correction');
          check(node.before?.type==='clause'&&node.after?.type==='clause','correction requires two report clauses');
          check(node.before.kind==='preference'&&node.after.kind==='preference'&&node.before.temporal==='present'&&node.after.temporal==='present','correction supports present preference reports only');
          check(node.before.object.key===node.after.object.key&&node.before.object.label===node.after.object.label,'correction must refer to the same object');
          check(node.before.predicate!==node.after.predicate||node.before.polarity!==node.after.polarity,'correction must change the report');
          const before=grounded(node.before,true),after=grounded(node.after,false);
          check(before.supersededBy===after.id&&Array.isArray(after.supersedes)&&after.supersedes.includes(before.id),'correction is not a recorded supersession');
          render(node.before,depth+1,true);const beforeStep=derivation.length-1;
          render(node.after,depth+1,false);const afterStep=derivation.length-1;
          const phrase=(clause,object)=> (clause.polarity==='negative'?'not ':'')+VERBS[clause.predicate].gerund+' '+object;
          // Labels are opaque and carry no number feature: repeating one is safer than inventing
          // an "it"/"them" distinction (coffee, cats, and a band name need different treatment).
          output='You previously reported '+phrase(node.before,objectLabel(node.before.object.label))+', but now you report '+phrase(node.after,objectLabel(node.after.object.label));
          output=step('correction.attributed-gerunds',[beforeStep,afterStep],output);
          break;
        }
        case 'question':{
          scopes.add('conversation');
          const childSteps=[];
          if(node.kind==='name'){
            shape(node,['type','kind'],'name question');output='What name would you like me to use?';
          }else if(node.kind==='meaning'){
            shape(node,['type','kind','label','choices'],'meaning question');text(node.label,'ambiguous label');
            check(Array.isArray(node.choices)&&node.choices.length>=2&&node.choices.length<=16,'meaning question needs 2–16 choices');
            const ids=new Set();for(const choice of node.choices){shape(choice,['id','label'],'meaning choice');text(choice.id,'choice id',100);text(choice.label,'choice label');check(!ids.has(choice.id),'duplicate meaning choice');ids.add(choice.id);}
            output='When you say “'+node.label+'”, which meaning do you have in mind?\n'+node.choices.map((choice,index)=>(index+1)+'. '+choice.label).join('\n');
          }else if(node.kind==='choose_report'){
            shape(node,['type','kind','options'],'report question');
            check(Array.isArray(node.options)&&node.options.length>=2&&node.options.length<=12,'report question needs 2–12 options');
            check(node.options.every(option=>option?.type==='clause'),'report question options must be report clauses');
            const choices=node.options.map(option=>{const choice=render(option,depth+1,historical);childSteps.push(derivation.length-1);return choice;});
            output='Which report would you like to discuss first?\n'+choices.map((choice,index)=>(index+1)+'. '+terminal(choice)).join('\n');
          }else check(false,'unsupported question kind');
          output=step('question.'+node.kind,childSteps,output);break;
        }
        case 'interaction':{
          const result=K.Interaction.realize(node);K.Interaction.verify(result);
          scopes.add('conversation');output=step('interaction.grammar',[],result.text,result.derivation);break;
        }
        case 'creative':{
          shape(node,['type','content'],'creative node');
          const result=K.Creative.realize(node.content);K.Creative.verify(result);
          check(result.scope==='fiction'&&result.memoryIds.length===0,'creative generation must remain fiction');
          scopes.add('fiction');output=step('creative.grammar',[],result.text,result.derivation);break;
        }
        default:check(false,'unsupported sentence node');
      }
      path.delete(node);check(typeof output==='string'&&output.length<=MAX_TEXT,'generated text budget exceeded');return output;
    }
    const fragment=render(tree),scope=scopes.size===1?[...scopes][0]:'mixed';
    const result={version:VERSION,scope,tree:K.clone(tree),style,text:style.terminal&&tree.type!=='question'?terminal(fragment):fragment,derivation,memoryIds};
    result.digest=K.hash(result);return K.freeze(result);
  }
  function verify(result,options){
    shape(result,['version','scope','tree','style','text','derivation','memoryIds','digest'],'realization result');
    check(result.version===VERSION,'unsupported grammar version');
    shape(result.style,['contractions','terminal'],'realization style');
    const expected=realize(result.tree,{...options,contractions:result.style.contractions,terminal:result.style.terminal});
    check(result.scope===expected.scope,'generation scope differs from its sentence plan');
    check(result.text===expected.text,'text differs from its grammar derivation');
    check(K.hash(result.derivation)===K.hash(expected.derivation),'grammar derivation differs');
    check(K.hash(result.memoryIds)===K.hash(expected.memoryIds),'source reference list differs');
    check(result.digest===expected.digest,'realization digest differs');return true;
  }
  K.Realization=K.freeze({version:VERSION,memory,coordinate,attributed,correction,question,creative,describe,realize,verify});
})(Kira);
