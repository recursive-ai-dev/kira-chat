'use strict';
// UNTRUSTED indexed optimizer. Every outward result passes auditQuery.
(function(K){
  class SemanticEngine{
    constructor(a){
      const checked=K.verifyArtifact(a);if(!checked.accepted)throw Error(checked.reason);this.a=K.freeze(a);this.verification=checked;
      this.facts=new Map(a.classification.nodes.map(n=>[JSON.stringify(n.f),n.id]));this.senses=new Map(a.senses.map(s=>[s.id,s]));this.phis=new Map(a.potentials.map(p=>[p.cid,p.phi]));this.fibers=new Map(a.cache.fibers.map(f=>[f.cid,f.sids.map(s=>this.senses.get(s))]));
      this.concepts=new Map(a.concepts.map(c=>[c.id,c]));this.aliases=new Map();
      const add=(word,cid)=>{const key=this.lookupKey(word);if(!this.aliases.has(key))this.aliases.set(key,new Set());this.aliases.get(key).add(cid);};
      for(const c of a.concepts)for(const alias of [c.label,...c.aliases])add(alias,c.id);
      for(const s of a.senses)add(s.lemma,s.cid);
      this.parents=new Map(a.concepts.map(c=>[c.id,[]]));for(const ax of a.axioms)if(ax.kind==='sub'&&ax.a!==ax.b)this.parents.get(ax.a).push(ax.b);
      this.topicCache=new Map();
    }
    fact(f,refs){const i=this.facts.get(JSON.stringify(f));if(i!==undefined&&refs)refs.push('L1Fact|'+i);return i!==undefined;}
    sub(a,b,refs){if(this.fact(['bot',a],refs))return true;return this.fact(['sub',a,b],refs);}
    disjoint(a,b,refs){
      if(this.fact(['bot',a],refs)||this.fact(['bot',b],refs))return true;
      for(const ax of this.a.axioms)if(ax.kind==='disj')for(const [x,y]of [[a,b],[b,a]])if(this.sub(x,ax.a)&&this.sub(y,ax.b)){refs?.push('Ax|'+ax.id);this.sub(x,ax.a,refs);this.sub(y,ax.b,refs);return true;}return false;
    }
    nv(cid,refs){const ns=this.a.nonVacuity.filter(n=>n.cid===cid);if(!['NonEmpty','NonUniversal'].every(k=>ns.some(n=>n.kind===k)))return false;for(const n of ns)refs?.push('NV|'+n.id);return true;}
    lexical(sa,sb,refs){
      const a=this.senses.get(sa),b=this.senses.get(sb);refs.push('Sense|'+sa,'Sense|'+sb);
      if(a.cid===b.cid){refs.push('Fiber|'+a.cid);return 1;}
      if(!this.nv(a.cid,refs)||!this.nv(b.cid,refs))return 127;
      if(this.sub(a.cid,b.cid,refs))return 3;if(this.sub(b.cid,a.cid,refs))return 5;
      const pair=this.a.complements.find(p=>(p.a===a.cid&&p.b===b.cid)||(p.b===a.cid&&p.a===b.cid));if(pair){refs.push('Complement|'+pair.id);return 8;}
      if(this.disjoint(a.cid,b.cid,refs)){const nc=this.a.nonCoverage.find(p=>(p.a===a.cid&&p.b===b.cid)||(p.b===a.cid&&p.a===b.cid));if(nc)refs.push('NonCoverage|'+nc.id);return nc?16:24;}return 127;
    }
    propose(q){
      const a=this.a,refs=[];try{
        K.validateQuery(a,q);let outcome,value;
        if(['subsumes','existential','path_cost'].includes(q.op)){
          const yes=q.op==='existential'?(this.fact(['bot',q.a],refs)||this.fact(['ex',q.a,q.role,q.b],refs)):this.sub(q.a,q.b,refs);
          if(q.op==='path_cost'){
            if(!yes)throw new K.QueryError('InvalidQuery','Path cost requires proven subsumption');
            if(a.classification.unsat.includes(q.a))throw new K.QueryError('InvalidQuery','Unsatisfiable source has no ranking cost');
            outcome='Computed';value={cost:Number(BigInt(q.lambda??1)*BigInt(this.phis.get(q.a)-this.phis.get(q.b)))};
          }else{outcome=yes?'Yes':q.op==='subsumes'&&this.disjoint(q.a,q.b,refs)?'No':'Unknown';value={a:q.a,b:q.b,...(q.op==='existential'?{role:q.role}:{})};}
        }else if(q.op==='relation'){value={mask:this.lexical(q.a,q.b,refs)};outcome='Relation';}
        else if(q.op==='entails'){
          let mask=1;const edits=[];
          for(const e of q.edits){let atom=0;for(const p of e.pairs)atom|=this.lexical(p[0],p[1],refs);let projected=0;
            if(atom===1)projected=1;
            else{const op=a.tables.ops[e.operator];let needs=false;for(let i=0;i<7;i++)if(atom&(1<<i)){projected|=op.sig[i];needs=needs||op.vacuous[i];}
              if(needs){let supplied=true;for(const s of [...new Set(e.pairs.flat())]){const cid=this.senses.get(s).cid,record=a.expressionNV.find(n=>n.operator===e.operator&&n.arg===cid&&n.context===e.context);if(record)refs.push('ImageNV|'+record.id);else supplied=false;}if(!supplied)projected=127;}
            }
            let next=0;for(let i=0;i<7;i++)if(mask&(1<<i))for(let j=0;j<7;j++)if(projected&(1<<j))next|=a.tables.join[i][j];mask=next;edits.push({atomic:atom,projected});
          }
          outcome=K.verdict(mask);value={mask,edits};
        }else if(q.op==='realize'||q.op==='shift'){
          const source=q.op==='shift'?this.senses.get(q.s):null,cid=source?source.cid:q.c,target=source?source.lin.map((x,i)=>x+q.delta[i]):q.target;
          let candidates=this.fibers.get(cid).slice();
          if(source)candidates=candidates.filter(s=>s.id!==source.id&&q.delta.every((d,i)=>!d||Math.sign(s.lin[i]-source.lin[i])===Math.sign(d)));
          const ranked=candidates.map(s=>({sid:s.id,distance:K.distance(s,target)})).sort((x,y)=>x.distance-y.distance||K.cmp(x.sid,y.sid));
          let chosen=ranked[0]?.sid||null,lf=null;
          if(source&&q.lf){const l=a.lexicalFunctions.find(l=>l.id===q.lf);if(l.from===source.id&&K.hash(l.delta)===K.hash(q.delta)&&candidates.some(s=>s.id===l.to)){chosen=l.to;lf=l.id;}}
          refs.push('Fiber|'+cid);outcome=chosen?'Computed':'Gap';value={cid,target,candidates:ranked,chosen,lf};
        }else if(q.op==='route'){
          if(this.fact(['bot',q.intent]))throw new K.QueryError('InvalidQuery','Unsatisfiable intent');
          const admitted=a.registry.filter(r=>this.sub(q.intent,r.capability,refs));
          const frontier=admitted.filter(r=>!admitted.some(s=>s.id!==r.id&&this.sub(s.capability,r.capability)&&!this.sub(r.capability,s.capability)));
          const ranked=frontier.map(r=>({id:r.id,cost:this.phis.get(q.intent)-this.phis.get(r.capability)})).sort((x,y)=>x.cost-y.cost||K.cmp(x.id,y.id));
          outcome=ranked.length?'Computed':'Unroutable';value={admitted:admitted.map(r=>r.id),frontier:frontier.map(r=>r.id),policy:'minimum potential gap, then stable service ID',ranked,pick:ranked[0]?.id||null};
        }
        return K.seal(a,q,outcome,value,refs);
      }catch(e){if(e instanceof K.QueryError)return K.failure(a,q,e);throw e;}
    }
    query(q){const proposed=this.propose(q),checked=K.auditQuery(this.a,q,proposed);if(!checked.accepted)throw Error('Query rejected: '+checked.reason);return {...proposed,checked:true};}
    lookupKey(text){return K.fold(text).trim().replace(/\s+/g,' ').replace(/^(?:a|an|the) /,'');}
    lookup(text){return [...(this.aliases.get(this.lookupKey(text))||[])].sort(K.cmp);}
    topicFor(cid){
      if(this.topicCache.has(cid))return this.topicCache.get(cid);
      const candidates=this.a.concepts.filter(c=>c.topic&&this.sub(cid,c.id));
      candidates.sort((a,b)=>this.phis.get(b.id)-this.phis.get(a.id)||K.cmp(a.id,b.id));
      const topic=candidates[0]?.topic||null;this.topicCache.set(cid,topic);return topic;
    }
    lexicon({text='',id=null}={}){
      K.assert(typeof text==='string'&&text.length<=200,'Search must be under 200 characters');
      if(id){const c=this.concepts.get(id);K.assert(c,'Unknown concept');return {entry:K.clone(c),parents:this.parents.get(id).map(parent=>({id:parent,label:this.concepts.get(parent).label,evidence:this.query({op:'subsumes',a:id,b:parent})})),children:this.a.axioms.filter(ax=>ax.kind==='sub'&&ax.b===id&&ax.a!==id).map(ax=>({id:ax.a,label:this.concepts.get(ax.a).label})),senses:this.fibers.get(id).map(K.clone),topic:this.topicFor(id)};}
      const needle=this.lookupKey(text),exact=new Set(this.lookup(text));
      const results=this.a.concepts.filter(c=>!needle||c.aliases.some(s=>this.lookupKey(s).includes(needle))||c.id.includes(needle));
      results.sort((a,b)=>Number(exact.has(b.id))-Number(exact.has(a.id))||K.cmp(a.id,b.id));
      return {total:results.length,entries:results.slice(0,40).map(c=>({id:c.id,label:c.label,aliases:c.aliases,topic:this.topicFor(c.id)}))};
    }
    senseFor(cid){return this.a.senses.find(s=>s.cid===cid&&s.lin[0]===0&&s.lin[1]===0)?.id||this.a.senses.find(s=>s.cid===cid).id;}
  }
  K.SemanticEngine=SemanticEngine;
})(Kira);

