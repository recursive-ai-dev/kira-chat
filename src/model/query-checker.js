'use strict';
// Reference query checking: scans certified tables and reconstructs full universes.
// No use of the optimizer's indexes, candidates, caches, result or evidence.
(function(K){
  function referenceQuery(a,q){
    const refs=[],facts=a.classification.nodes;
    const fact=f=>{const n=facts.find(n=>n.f.length===f.length&&n.f.every((x,i)=>x===f[i]));if(n)refs.push('L1Fact|'+n.id);return !!n;};
    const has=f=>facts.some(n=>n.f.length===f.length&&n.f.every((x,i)=>x===f[i]));
    const included=(x,y,record=true)=>record?(fact(['bot',x])||fact(['sub',x,y])):(has(['bot',x])||has(['sub',x,y]));
    function disjoint(x,y){
      if(fact(['bot',x])||fact(['bot',y]))return true;
      for(const ax of a.axioms){if(ax.kind!=='disj')continue;
        let left=null,right=null;
        if(included(x,ax.a,false)&&included(y,ax.b,false)){left=x;right=y;}
        else if(included(y,ax.a,false)&&included(x,ax.b,false)){left=y;right=x;}
        if(left!==null){refs.push('Ax|'+ax.id);included(left,ax.a);included(right,ax.b);return true;}
      }return false;
    }
    const sense=id=>a.senses.find(s=>s.id===id),potential=id=>a.potentials.find(p=>p.cid===id).phi;
    function nonvacuous(cid){const records=a.nonVacuity.filter(x=>x.cid===cid);if(!records.some(x=>x.kind==='NonEmpty')||!records.some(x=>x.kind==='NonUniversal'))return false;records.forEach(x=>refs.push('NV|'+x.id));return true;}
    function atomic(x,y){
      const u=sense(x).cid,v=sense(y).cid;refs.push('Sense|'+x,'Sense|'+y);
      if(u===v){refs.push('Fiber|'+u);return 1;}
      if(!nonvacuous(u)||!nonvacuous(v))return 127;
      if(included(u,v))return 3;if(included(v,u))return 5;
      for(const e of a.complements)if((e.a===u&&e.b===v)||(e.a===v&&e.b===u)){refs.push('Complement|'+e.id);return 8;}
      if(disjoint(u,v)){for(const e of a.nonCoverage)if((e.a===u&&e.b===v)||(e.a===v&&e.b===u)){refs.push('NonCoverage|'+e.id);return 16;}return 24;}return 127;
    }
    try{
      K.validateQuery(a,q);let outcome,value;
      switch(q.op){
        case 'subsumes':outcome=included(q.a,q.b)?'Yes':disjoint(q.a,q.b)?'No':'Unknown';value={a:q.a,b:q.b};break;
        case 'existential':outcome=fact(['bot',q.a])||fact(['ex',q.a,q.role,q.b])?'Yes':'Unknown';value={a:q.a,b:q.b,role:q.role};break;
        case 'path_cost':{
          if(!included(q.a,q.b))throw new K.QueryError('InvalidQuery','Path cost requires proven subsumption');
          if(a.classification.unsat.includes(q.a))throw new K.QueryError('InvalidQuery','Unsatisfiable source has no ranking cost');
          const v=BigInt(potential(q.a))*BigInt(q.lambda??1)-BigInt(potential(q.b))*BigInt(q.lambda??1);
          outcome='Computed';value={cost:Number(v)};break;
        }
        case 'relation':outcome='Relation';value={mask:atomic(q.a,q.b)};break;
        case 'entails':{
          let running=[0];const steps=[];
          for(const e of q.edits){const possible=new Set();for(const [x,y]of e.pairs){const m=atomic(x,y);for(let r=0;r<7;r++)if(Math.floor(m/2**r)%2)possible.add(r);}
            const input=[...possible].reduce((v,r)=>v+2**r,0);let projected=new Set();
            if(input===1)projected.add(0);
            else{
              let requireImages=false;for(const r of possible){const m=a.tables.ops[e.operator].sig[r];for(let t=0;t<7;t++)if(Math.floor(m/2**t)%2)projected.add(t);if(a.tables.ops[e.operator].vacuous[r])requireImages=true;}
              if(requireImages){let all=true;const inputs=[...new Set(e.pairs.flat())];for(const sid of inputs){const n=a.expressionNV.find(n=>n.operator===e.operator&&n.arg===sense(sid).cid&&n.context===e.context);if(n)refs.push('ImageNV|'+n.id);else all=false;}if(!all)projected=new Set([0,1,2,3,4,5,6]);}
            }
            const next=new Set();for(const r of running)for(const s of projected){const composed=a.tables.join[r][s];for(let t=0;t<7;t++)if(Math.floor(composed/2**t)%2)next.add(t);}
            running=[...next];steps.push({atomic:input,projected:[...projected].reduce((v,r)=>v+2**r,0)});
          }
          const mask=running.reduce((v,r)=>v+2**r,0);outcome=running.length&&running.every(r=>r===0||r===1)?'Yes':running.length&&running.every(r=>r===3||r===4)?'No':'Inconclusive';value={mask,edits:steps};break;
        }
        case 'realize':case 'shift':{
          const src=q.op==='shift'?sense(q.s):null,cid=src?src.cid:q.c;
          const target=src?[src.lin[0]+q.delta[0],src.lin[1]+q.delta[1]]:q.target.slice();
          const candidates=[];
          for(const s of a.senses){if(s.cid!==cid||s.id===src?.id)continue;
            let admitted=true;if(src)for(let i=0;i<a.p;i++)if(q.delta[i]>0?s.lin[i]<=src.lin[i]:q.delta[i]<0?s.lin[i]>=src.lin[i]:false)admitted=false;
            if(admitted){let d=0n;for(let i=0;i<a.p;i++){const v=BigInt(s.lin[i])-BigInt(target[i]);d+=BigInt(a.weights[i])*(v<0n?-v:v);}candidates.push({sid:s.id,distance:Number(d)});}
          }
          candidates.sort((x,y)=>x.distance===y.distance?K.cmp(x.sid,y.sid):x.distance-y.distance);
          let chosen=candidates.length?candidates[0].sid:null,lf=null;
          if(src&&q.lf){const l=a.lexicalFunctions.find(l=>l.id===q.lf);if(l.from===src.id&&l.delta.every((x,i)=>x===q.delta[i])&&candidates.some(s=>s.sid===l.to)){chosen=l.to;lf=l.id;}}
          refs.push('Fiber|'+cid);outcome=chosen?'Computed':'Gap';value={cid,target,candidates,chosen,lf};break;
        }
        case 'route':{
          if(has(['bot',q.intent]))throw new K.QueryError('InvalidQuery','Unsatisfiable intent');
          const admitted=[];for(const service of a.registry)if(included(q.intent,service.capability))admitted.push(service);
          const frontier=[];for(const service of admitted){let dominated=false;for(const other of admitted)if(other.id!==service.id&&included(other.capability,service.capability,false)&&!included(service.capability,other.capability,false))dominated=true;if(!dominated)frontier.push(service);}
          const ranked=frontier.map(s=>({id:s.id,cost:potential(q.intent)-potential(s.capability)}));ranked.sort((x,y)=>x.cost-y.cost||K.cmp(x.id,y.id));
          outcome=frontier.length?'Computed':'Unroutable';value={admitted:admitted.map(x=>x.id),frontier:frontier.map(x=>x.id),policy:'minimum potential gap, then stable service ID',ranked,pick:ranked.length?ranked[0].id:null};break;
        }
      }
      return K.seal(a,q,outcome,value,refs);
    }catch(e){if(e instanceof K.QueryError)return K.failure(a,q,e);throw e;}
  }
  function auditQuery(a,q,result){
    try{const expected=referenceQuery(a,q),copy=K.clone(result);delete copy.checked;K.assert(K.hash(expected)===K.hash(copy),'Result, proof, candidate universe or digest differs from the reference check');return {accepted:true};}
    catch(e){return {accepted:false,reason:e.message};}
  }
  K.referenceQuery=referenceQuery;K.auditQuery=auditQuery;
})(Kira);

