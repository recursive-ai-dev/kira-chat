'use strict';
(function(K){
  class QueryError extends Error{constructor(outcome,message){super(message);this.outcome=outcome;}}
  const bad=m=>{throw new QueryError('InvalidQuery',m);};
  const allowed=['subsumes','existential','relation','entails','shift','realize','route','path_cost'];
  function validateQuery(a,q){
    try{K.canonical(q);}catch{bad('Query is not canonical JSON data');}
    if(!q||typeof q!=='object'||Array.isArray(q)||typeof q.op!=='string')bad('Query object required');
    if(q.artifactHash&&q.artifactHash!==a.hash)throw new QueryError('ArtifactMismatch','Query references another artifact');
    if(!allowed.includes(q.op))throw new QueryError('UnsupportedOperator','Unsupported operation: '+q.op);
    const cid=c=>{if(!a.concepts.some(x=>x.id===c))bad('Unknown concept ID');};
    const sid=s=>{if(!a.senses.some(x=>x.id===s))bad('Unknown sense ID');};
    const vector=(v,max)=>{if(!Array.isArray(v)||v.length!==a.p||v.some(x=>!Number.isInteger(x)||Math.abs(x)>max))bad('Coordinate dimension or bound');};
    if(['subsumes','existential','path_cost'].includes(q.op)){cid(q.a);cid(q.b);}
    if(q.op==='existential'&&(typeof q.role!=='string'||!a.axioms.some(x=>x.role===q.role)))bad('Unknown role');
    if(q.op==='relation'){sid(q.a);sid(q.b);}
    if(q.op==='realize'){cid(q.c);vector(q.target,2**22);}
    if(q.op==='shift'){sid(q.s);vector(q.delta,2**21);if(q.lf&&!a.lexicalFunctions.some(l=>l.id===q.lf))bad('Unknown lexical function');}
    if(q.op==='route')cid(q.intent);
    if(q.op==='path_cost'&&q.lambda!==undefined&&(!Number.isInteger(q.lambda)||q.lambda<0||q.lambda>256))bad('Lambda outside C2');
    if(q.op==='entails'){
      if(!Array.isArray(q.edits)||!q.edits.length||q.edits.length>65536)bad('Expected 1..65536 edits');let pairs=0;
      let previous=null;
      for(const e of q.edits){if(!e||typeof e!=='object'||!Array.isArray(e.pairs)||!e.pairs.length||e.pairs.length>64)bad('Expected 1..64 candidate pairs');pairs+=e.pairs.length;for(const p of e.pairs){if(!Array.isArray(p)||p.length!==2)bad('Pair requires two sense IDs');p.forEach(sid);}if(!Object.hasOwn(a.tables.ops,e.operator))throw new QueryError('UnsupportedOperator','No extensional signature for '+e.operator);if(e.operator==='intersection')cid(e.context);
        if(previous){if(e.operator!==previous.operator||e.context!==previous.context)bad('An edit chain must keep the same supported expression context');const targets=[...new Set(previous.pairs.map(p=>p[1]))].sort(K.cmp),sources=[...new Set(e.pairs.map(p=>p[0]))].sort(K.cmp);if(K.hash(targets)!==K.hash(sources))bad('Edit chain endpoints do not match');}previous=e;
      }
      if(pairs>1048576)bad('Candidate lookup budget exceeded');
    }
  }
  function seal(a,q,outcome,value,support=[]){
    const semantic=['Yes','No','Relation','Inconclusive'].includes(outcome),type=semantic?'SemanticProof':'ComputationCertificate';
    const refs=[...new Set(support)].sort(K.cmp);
    const nodes=refs.map(ref=>({tag:ref.split('|')[0],fields:{ref:ref.slice(ref.indexOf('|')+1)},children:[]}));
    nodes.push({tag:q.op,fields:{outcome,value},children:nodes.map((_,i)=>i)});
    const evidence={type,nodes,root:K.merkle(nodes)},base={artifactHash:a.hash,query:K.clone(q),outcome,value,evidence};
    return {...base,digest:K.hash({artifact:a.hash,query:q,result:{outcome,value},evidenceRoot:evidence.root})};
  }
  function failure(a,q,e){
    let query;try{K.canonical(q);query=K.clone(q);}catch{query={op:typeof q?.op==='string'?q.op:'invalid',invalidEncoding:true};}
    return {artifactHash:a.hash,query,outcome:e.outcome||'InvalidQuery',value:{reason:e.message},evidence:null,digest:K.hash({artifact:a.hash,query,outcome:e.outcome||'InvalidQuery',reason:e.message})};
  }
  const distance=(s,target)=>Number(s.lin.reduce((v,x,i)=>v+BigInt(Math.abs(x-target[i])),0n));
  const verdict=m=>m&&!(m&~3)?'Yes':m&&!(m&~24)?'No':'Inconclusive';
  Object.assign(K,{QueryError,validateQuery,seal,failure,distance,verdict,relationSymbols:['≡','⊏','⊐','^','|','‿','#']});
})(Kira);

