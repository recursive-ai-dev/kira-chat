'use strict';
// Small reference checker. It never calls the classifier or the query optimizer.
(function(K){
  const A=K.assert,eq=(a,b)=>K.hash(a)===K.hash(b),key=f=>JSON.stringify(f);
  function regeneratedTables(){
    const classify=(x,y,U)=>{const same=x.size===y.size&&[...x].every(v=>y.has(v));if(same)return 0;if([...x].every(v=>y.has(v)))return 1;if([...y].every(v=>x.has(v)))return 2;const dis=[...x].every(v=>!y.has(v)),cov=new Set([...x,...y]).size===U.size;return dis?(cov?3:4):(cov?5:6);};
    const join=Array.from({length:7},()=>Array(7).fill(0)),ops={};
    for(const name of ['identity','complement','intersection','no'])ops[name]={sig:Array(7).fill(0),vacuous:Array(7).fill(false)};
    for(let occupancy=1;occupancy<256;occupancy++){
      const U=new Set(),sets=[new Set(),new Set(),new Set()];
      for(let r=0;r<8;r++)if(Math.floor(occupancy/2**r)%2){U.add(r);for(let j=0;j<3;j++)if(Math.floor(r/2**(2-j))%2)sets[j].add(r);}
      if(sets.some(s=>!s.size||s.size===U.size))continue;
      const [x,y,z]=sets,r=classify(x,y,U);join[r][classify(y,z,U)]|=2**classify(x,z,U);
      for(const op of ['identity','complement','intersection']){
        const apply=s=>new Set([...U].filter(v=>op==='identity'?s.has(v):op==='complement'?!s.has(v):s.has(v)&&z.has(v)));
        const p=apply(x),q=apply(y);
        if(!p.size||p.size===U.size||!q.size||q.size===U.size)ops[op].vacuous[r]=true;else ops[op].sig[r]|=2**classify(p,q,U);
      }
    }
    for(let occupancy=1;occupancy<16;occupancy++){
      const U=new Set(),x=new Set(),y=new Set();
      for(let r=0;r<4;r++)if(Math.floor(occupancy/2**r)%2){U.add(r);if(r>=2)x.add(r);if(r%2)y.add(r);}
      if(!x.size||x.size===U.size||!y.size||y.size===U.size)continue;
      const scopes=new Set(),p=new Set(),q=new Set();
      for(let mask=0;mask<16;mask++){const s=new Set([0,1,2,3].filter(v=>Math.floor(mask/2**v)%2));if([...s].some(v=>!U.has(v)))continue;scopes.add(mask);if([...s].every(v=>!x.has(v)))p.add(mask);if([...s].every(v=>!y.has(v)))q.add(mask);}
      ops.no.sig[classify(x,y,U)]|=2**classify(p,q,scopes);
    }
    return {join,ops};
  }
  function verifyArtifact(a,options={}){
    try{
      A(a.schema==='rse-kira/4.1.0'&&a.unicode===K.UNICODE.version,'Artifact schema / Unicode mismatch');
      const bare=K.clone(a);delete bare.hash;A(K.hash(bare)===a.hash,'Artifact digest mismatch');
      A(a.p===2&&eq(a.weights,[1,1]),'Unsupported coordinate dimensions');
      const ids=a.concepts.map(c=>c.id),cs=new Set(ids),sids=a.senses.map(s=>s.id);
      for(const arr of [ids,sids,a.axioms.map(x=>x.id),a.registry.map(x=>x.id)])A(arr.every((v,i)=>typeof v==='string'&&/^[\x20-\x7e]+$/.test(v)&&(i===0||arr[i-1]<v)),'IDs must be unique, ASCII, sorted');
      A(ids.length>=2&&ids.length<=1000,'Artifact size limit for this implementation');
      for(const c of a.concepts){A(typeof c.label==='string'&&c.label.length>0&&Array.isArray(c.aliases)&&c.aliases.length>0&&c.aliases.every(s=>typeof s==='string'&&s.trim().length>0&&K.nfc(s)===s),'Invalid lexical entry');A(c.topic===undefined||typeof c.topic==='string','Invalid dialogue topic');}
      const provenance=(p,dual=false)=>{A(p&&p.source&&p.evidence&&p.annotators.length&&p.stratum==='EXPERIMENTAL'&&p.review==='UNREVIEWED'&&p.decisionDigest,'Missing or mislabeled provenance');if(options.requireReviewed&&dual)A(new Set(p.approvals).size>=2,'Independent approvals missing');};
      for(const ax of a.axioms){A(['sub','ex','disj','trans'].includes(ax.kind),'Unsupported axiom');if(ax.kind!=='trans')A(cs.has(ax.a)&&cs.has(ax.b),'Unknown axiom concept');if(['ex','trans'].includes(ax.kind))A(typeof ax.role==='string'&&ax.role.length>0,'Invalid role');provenance(ax.provenance,['disj','trans'].includes(ax.kind));}
      const axById=new Map(a.axioms.map(x=>[x.id,x])),seen=new Map(),nodes=a.classification.nodes;
      for(let i=0;i<nodes.length;i++){
        const n=nodes[i],f=n.f,p=n.premises.map(j=>{A(Number.isInteger(j)&&j>=0&&j<i,'Cyclic or dangling premise');return nodes[j].f;}),ax=axById.get(n.axiom);
        A(n.id===i&&!seen.has(key(f)),'Duplicate fact / bad derivation index');
        A(['sub','ex','bot'].includes(f[0])&&cs.has(f[1]),'Malformed fact');
        if(f[0]==='sub')A(f.length===3&&cs.has(f[2]),'Bad subsumption fact');
        if(f[0]==='ex')A(f.length===4&&cs.has(f[3]),'Bad existential fact');
        if(f[0]==='bot')A(f.length===2,'Bad bottom fact');
        let ok=false;
        switch(n.rule){
          case 'Refl':ok=p.length===0&&n.axiom===null&&eq(f,['sub',f[1],f[1]]);break;
          case 'Trans':ok=p.length===1&&ax?.kind==='sub'&&p[0][0]==='sub'&&p[0][2]===ax.a&&eq(f,['sub',p[0][1],ax.b]);break;
          case 'ExSub':ok=p.length===1&&ax?.kind==='ex'&&p[0][0]==='sub'&&p[0][2]===ax.a&&eq(f,['ex',p[0][1],ax.role,ax.b]);break;
          case 'ExSup':ok=p.length===2&&n.axiom===null&&p[0][0]==='ex'&&p[1][0]==='sub'&&p[0][3]===p[1][1]&&eq(f,['ex',p[0][1],p[0][2],p[1][2]]);break;
          case 'Chain':ok=p.length===2&&ax?.kind==='trans'&&p.every(x=>x[0]==='ex'&&x[2]===ax.role)&&p[0][3]===p[1][1]&&eq(f,['ex',p[0][1],ax.role,p[1][3]]);break;
          case 'Disj':ok=p.length===2&&ax?.kind==='disj'&&p.every(x=>x[0]==='sub')&&p[0][1]===p[1][1]&&p[0][2]===ax.a&&p[1][2]===ax.b&&eq(f,['bot',p[0][1]]);break;
          case 'Bot':ok=p.length===2&&n.axiom===null&&p[0][0]==='ex'&&p[1][0]==='bot'&&p[0][3]===p[1][1]&&eq(f,['bot',p[0][1]]);break;
        }
        A(ok,'Invalid '+n.rule+' proof at '+i);seen.set(key(f),i);
      }
      const has=f=>seen.has(key(f)),must=f=>A(has(f),'Classification not closed: '+key(f));
      for(const c of ids)must(['sub',c,c]);
      // One complete rule pass over the supplied materialization, not reclassification.
      for(const n of nodes){
        const f=n.f;
        if(f[0]==='sub')for(const ax of a.axioms){if(ax.kind==='sub'&&f[2]===ax.a)must(['sub',f[1],ax.b]);if(ax.kind==='ex'&&f[2]===ax.a)must(['ex',f[1],ax.role,ax.b]);}
        if(f[0]==='ex')for(const m of nodes){const g=m.f;if(g[0]==='sub'&&g[1]===f[3])must(['ex',f[1],f[2],g[2]]);if(g[0]==='bot'&&g[1]===f[3])must(['bot',f[1]]);if(g[0]==='ex'&&g[1]===f[3]&&g[2]===f[2]&&a.axioms.some(ax=>ax.kind==='trans'&&ax.role===f[2]))must(['ex',f[1],f[2],g[3]]);}
      }
      for(const c of ids)for(const ax of a.axioms)if(ax.kind==='disj'&&has(['sub',c,ax.a])&&has(['sub',c,ax.b]))must(['bot',c]);
      const unsat=ids.filter(c=>has(['bot',c]));A(eq(unsat,a.classification.unsat)&&eq(unsat,a.declaredUnsat),'Unintended unsatisfiable concept');
      // The live artifact is a quotient DAG. Equivalent distinct concepts are forbidden.
      for(const x of ids)for(const y of ids)if(x!==y&&!unsat.includes(x)&&!unsat.includes(y))A(!(has(['sub',x,y])&&has(['sub',y,x])),'Equivalent concepts must be merged');
      const nvIds=new Set();for(const nv of a.nonVacuity){A(!nvIds.has(nv.id)&&cs.has(nv.cid)&&['NonEmpty','NonUniversal'].includes(nv.kind),'Invalid non-vacuity record');nvIds.add(nv.id);provenance(nv.provenance);if(nv.kind==='NonEmpty')A(!unsat.includes(nv.cid),'Nonempty bottom');}
      for(const c of a.complements){A(cs.has(c.a)&&cs.has(c.b)&&c.a!==c.b,'Invalid complement');provenance(c.provenance,true);}
      for(const c of a.nonCoverage){A(cs.has(c.a)&&cs.has(c.b),'Invalid coverage record');provenance(c.provenance);}
      for(const f of a.expressionNV){A(cs.has(f.arg)&&cs.has(f.context)&&f.operator==='intersection','Invalid expression premise');provenance(f.provenance);A(f.nonEmpty===true&&f.nonUniversal===true,'Missing image premise');}
      A(eq(a.tables,regeneratedTables()),'Forged relation tables');
      A(a.senses.every(s=>cs.has(s.cid)&&s.lin.length===a.p&&s.lin.every(x=>Number.isInteger(x)&&Math.abs(x)<=2**20)&&typeof s.lemma==='string'),'Invalid sense / coordinates');
      A(ids.every(c=>a.senses.some(s=>s.cid===c)),'Empty fiber');
      A(a.fibers.length===ids.length&&new Set(a.fibers.map(f=>f.cid)).size===ids.length,'Missing fiber records');
      for(const f of a.fibers){A(cs.has(f.cid),'Unknown fiber');provenance(f.provenance,a.senses.filter(s=>s.cid===f.cid).length>1);}
      const pots=new Map(a.potentials.map(p=>[p.cid,p]));A(pots.size===ids.length,'Potential universe incomplete');
      const memo=new Map();for(const c of ids){const n=ids.filter(x=>x!==c&&has(['sub',x,c])).length;if(!memo.has(n))memo.set(n,K.phi(n,ids.length));A(pots.get(c)?.hypo===n&&pots.get(c)?.phi===memo.get(n),'Incorrect potential');}
      for(const ax of a.axioms)if(ax.kind==='sub'&&ax.a!==ax.b&&!unsat.includes(ax.a))A(pots.get(ax.a).phi>pots.get(ax.b).phi,'Potential not strictly monotone');
      for(const r of a.registry)A(cs.has(r.capability),'Unknown capability');
      for(const l of a.lexicalFunctions){A(sids.includes(l.from)&&sids.includes(l.to)&&l.delta.length===2&&l.delta.every(x=>Number.isInteger(x)&&Math.abs(x)<=2**21),'Malformed LF');provenance(l.provenance);}
      const truth={};for(const k of ['schema','profile','unicode','concepts','axioms','nonVacuity','expressionNV','complements','nonCoverage','fibers'])truth[k]=a[k];
      A(a.cache.dependencyRoot===K.hash(truth),'Stale cache');
      A(eq(a.cache.fibers,ids.map(cid=>({cid,sids:a.senses.filter(s=>s.cid===cid).map(s=>s.id)}))),'Fiber cache omitted / added a sense');
      A(a.certificate.classificationRoot===K.hash(a.classification)&&a.certificate.tableRoot===K.hash(a.tables),'Bad artifact certificate');
      if(options.requireReviewed)A(a.profile!=='EXPERIMENTAL','Experimental artifact cannot be promoted by a flag');
      return {accepted:true,artifactHash:a.hash,profile:a.profile,formalVerification:false};
    }catch(e){return {accepted:false,outcome:'ArtifactRejected',reason:e.message};}
  }
  K.verifyArtifact=verifyArtifact;K.regeneratedTables=regeneratedTables;
})(Kira);

