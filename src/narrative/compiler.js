'use strict';
// A narrative authoring compiler. This does not alter the pinned RSE ontology.
(function(K){
  const FORMAT='kira-narrative-package/1';
  const ID=/^[a-z][a-z0-9_-]{0,63}$/;
  const own=(o,k)=>Object.hasOwn(o,k);
  const fail=message=>{throw new Error('Narrative: '+message);};
  const check=(ok,message)=>{if(!ok)fail(message);};
  function object(value,label,keys){
    check(value&&Object.getPrototypeOf(value)===Object.prototype,label+' must be a plain object');
    check(Object.keys(value).every(key=>keys.includes(key)),label+' has an unknown field');
  }
  function text(value,label,max=2000){check(typeof value==='string'&&value.trim().length>0&&value.length<=max,label+' must be nonempty text (max '+max+')');return K.nfc(value);}
  function id(value,label){check(typeof value==='string'&&ID.test(value)&&!['constructor','prototype','__proto__'].includes(value),label+' is not a safe identifier');return value;}
  function integer(value,label,min,max){check(Number.isSafeInteger(value)&&value>=min&&value<=max,label+' must be an integer in '+min+'..'+max);return value;}
  function array(value,label,max=2000){check(Array.isArray(value)&&value.length<=max,label+' must be an array (max '+max+')');return value;}
  function unique(rows,label){const keys=rows.map(row=>row.id);check(new Set(keys).size===keys.length,'duplicate '+label);return rows;}
  const terms=value=>K.fold(value).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function compile(source){
    object(source,'source',['id','version','speakers','topics','facts','characters']);
    const def={id:id(source.id,'package id'),version:text(source.version,'package version',64)};
    def.speakers=unique(array(source.speakers,'speakers',128).map(s=>{
      object(s,'speaker',['id','name']);return {id:id(s.id,'speaker id'),name:text(s.name,'speaker name',100)};
    }),'speaker');
    def.topics=unique(array(source.topics,'topics',512).map(t=>{
      object(t,'topic',['id','label','aliases']);
      const aliases=[...new Set(array(t.aliases,'topic aliases',64).map(a=>terms(text(a,'topic alias',100))))].sort(K.cmp);
      check(aliases.length>0&&aliases.every(Boolean),'topic needs a word alias');
      return {id:id(t.id,'topic id'),label:text(t.label,'topic label',100),aliases};
    }),'topic');
    const topicIds=new Set(def.topics.map(t=>t.id)),aliasOwners=new Map();
    for(const t of def.topics)for(const alias of t.aliases){check(!aliasOwners.has(alias),'ambiguous topic alias: '+alias);aliasOwners.set(alias,t.id);}
    def.facts=unique(array(source.facts,'facts',2000).map(f=>{
      object(f,'fact',['id','text','topic']);check(topicIds.has(f.topic),'unknown fact topic: '+f.topic);
      return {id:id(f.id,'fact id'),text:text(f.text,'fact text'),topic:f.topic};
    }),'fact');
    const factIds=new Set(def.facts.map(f=>f.id));
    function conditions(value,label,withKind=false){
      const result=array(value??[],label,64).map(c=>{
        object(c,label,withKind?['fact','value','kind']:['fact','value']);check(factIds.has(c.fact),'unknown condition fact: '+c.fact);check(typeof c.value==='boolean','fact value must be boolean');
        if(c.kind!==undefined)check(['background','witnessed','reported','relayed'].includes(c.kind),'unknown belief kind');
        return {fact:c.fact,value:c.value,...(c.kind===undefined?{}:{kind:c.kind})};
      });
      check(new Set(result.map(c=>c.fact)).size===result.length,'duplicate or contradictory fact conditions');return result;
    }
    def.characters=unique(array(source.characters,'characters',128).map(c=>{
      object(c,'character',['id','name','persona','register','fallback','knowledge','goals','rules']);
      const character={id:id(c.id,'character id'),name:text(c.name,'character name',100),persona:c.persona??'warm',register:c.register??-1000,fallback:text(c.fallback,'character fallback')};
      check(own(K.DIALOGUE.personas,character.persona),'unknown character persona');integer(character.register,'character register',-2000,2000);
      character.knowledge=conditions(c.knowledge,'initial knowledge');
      character.goals=unique(array(c.goals??[],'goals',64).map(g=>{
        object(g,'goal',['id','label','requires','completedBy']);
        return {id:id(g.id,'goal id'),label:text(g.label,'goal label',200),requires:conditions(g.requires,'goal conditions',true),completedBy:conditions(g.completedBy,'goal completion',true)};
      }),'goal');
      const goals=new Set(character.goals.map(g=>g.id));
      character.rules=unique(array(c.rules??[],'rules',512).map(r=>{
        object(r,'rule',['id','priority','on','requires','memoryKind','minRelationship','goal','parts']);
        object(r.on,'rule trigger',['topic','intent']);
        check(Object.keys(r.on).length>0,'rule needs a topic or intent');
        if(r.on.topic!==undefined)check(topicIds.has(r.on.topic),'unknown rule topic: '+r.on.topic);
        if(r.on.intent!==undefined)check(['name','preference','mood','note','recall','forget','clarify','semantic','topic','greet','farewell','how','about','thanks','joke','prompt','support','social','affection','boundary','stay','why','crisis','initiate'].includes(r.on.intent),'unknown rule intent: '+r.on.intent);
        const rule={id:id(r.id,'rule id'),priority:integer(r.priority??0,'rule priority',-1000,1000),on:{...r.on},requires:conditions(r.requires,'rule conditions',true),memoryKind:r.memoryKind??null,minRelationship:integer(r.minRelationship??0,'minimum relationship',0,100),goal:r.goal??null};
        check(rule.memoryKind===null||['name','preference','mood','note'].includes(rule.memoryKind),'unknown memory kind');
        check(rule.goal===null||goals.has(rule.goal),'unknown rule goal');
        rule.parts=array(r.parts,'rule parts',32).map(p=>{
          const alternatives=typeof p==='string'?[p]:array(p,'phrase alternatives',32);
          check(alternatives.length>0,'empty phrase alternatives');
          return alternatives.map(s=>{
            const value=text(s,'phrase');
            const stripped=value.replace(/\{([^{}]+)\}/g,(_,slot)=>{
              if(['character','speaker'].includes(slot))return '';
              if(['memory','report'].includes(slot)){check(rule.memoryKind!==null,'memory slot needs memoryKind');return '';}
              if(slot.startsWith('fact:')){
                const fact=slot.slice(5);check(factIds.has(fact),'unknown fact slot');
                check(rule.requires.some(c=>c.fact===fact&&c.value),'fact slot needs a positive knowledge condition: '+fact);return '';
              }
              fail('unknown phrase slot: '+slot);
            });
            check(!/[{}]/.test(stripped),'malformed phrase slot');return value;
          });
        });
        check(rule.parts.length>0,'rule needs at least one phrase');
        check(rule.parts.reduce((sum,part)=>sum+Math.max(...part.map(s=>s.length)),0)<=8000,'rule can generate too much text');
        const expanded=rule.parts.reduce((sum,part)=>sum+Math.max(...part.map(s=>s.replace(/\{([^{}]+)\}/g,(_,slot)=>{
          const length=slot.startsWith('fact:')?def.facts.find(f=>f.id===slot.slice(5)).text.length:['memory','report'].includes(slot)?2200:100;
          return 'x'.repeat(length);
        }).length)),0);
        check(expanded<=16000,'expanded rule can generate too much text');
        return rule;
      }),'rule');
      return character;
    }),'character');
    check(def.characters.length>0,'at least one character is required');
    const identities=def.speakers.concat(def.characters).map(c=>c.id);
    check(new Set(identities).size===identities.length,'speaker and character ids must be distinct');
    // Stable ordering means harmless source list reordering does not change assets.
    for(const rows of [def.speakers,def.topics,def.facts,def.characters])rows.sort((a,b)=>K.cmp(a.id,b.id));
    for(const c of def.characters){
      c.knowledge.sort((a,b)=>K.cmp(a.fact,b.fact));c.goals.sort((a,b)=>K.cmp(a.id,b.id));c.rules.sort((a,b)=>K.cmp(a.id,b.id));
      for(const r of c.rules)r.requires.sort((a,b)=>K.cmp(a.fact,b.fact));
      for(const g of c.goals)for(const list of [g.requires,g.completedBy])list.sort((a,b)=>K.cmp(a.fact,b.fact));
    }
    const payload={format:FORMAT,definition:def};
    return K.freeze({...payload,hash:K.hash(payload)});
  }
  function verify(pkg){
    object(pkg,'compiled package',['format','definition','hash']);check(pkg.format===FORMAT,'unsupported package format');
    // Recompile rather than trusting a hash supplied with arbitrary structure.
    const rebuilt=compile(pkg.definition);
    check(pkg.hash===rebuilt.hash&&K.hash(pkg)===K.hash(rebuilt),'compiled package does not match its definition');return rebuilt;
  }
  K.Narrative={compile,verify,terms,check,object,text,id,integer,array,version:'0.1.0'};
})(Kira);
