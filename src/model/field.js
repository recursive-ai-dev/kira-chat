'use strict';
// The ring field: a derived, UNCHECKED layer that decides where a conversation sits among topics.
//
// Every topic is a ring of weighted members: curated concepts (1.0), theme-pack words (0.9), declared
// overlap words (0.8) and the taxonomic neighbours of members (about 0.5). Two rings overlap by the
// members they share; those shared members are the bridges between them. Ring centres are laid out in
// the plane by classical MDS on 1 - overlap, and a conversation carries a per-topic activation that
// decays each turn and spreads to neighbouring rings in proportion to overlap. Its weighted centroid
// is the conversation's position in the field.
//
// Nothing here is random, and nothing creates memories or ontology claims. It only chooses which
// question to ask next. Everything is derived from the artifact, the theme packs and the events, using
// only + - * / and comparisons, and state holds integers only, so replays are exact on every device.
(function(K){
  const HUB=60;                 // concepts with at least this many hyponyms are generic hubs, not neighbours
  const DECAY=600,HIT=500,ALSO=250,SPREAD=300,CAP=1000;
  const MIN_BRIDGE=40,MIN_REMIND=50,REMIND_COOLDOWN=8,REMIND_QUIET=3,WARM=3,MIN_WARM=60,BRIDGE_COOLDOWN=5,VISITED=8,RECENT=12;
  const EXCLUDED=new Set(['support','general']);
  const label=s=>K.fold(s).trim();
  const cmpLabel=(a,b)=>K.cmp(a,b);

  class RingField{
    constructor(engine){
      this.engine=engine;
      const a=engine.a;
      this.hypo=new Map(a.potentials.map(p=>[p.cid,p.hypo]));
      this.kids=new Map(a.concepts.map(c=>[c.id,[]]));
      for(const [id,parents] of engine.parents)for(const p of parents)this.kids.get(p).push(id);
      this.related=new Map(a.concepts.map(c=>[c.id,[]]));
      for(const ax of a.axioms)if(ax.kind==='ex'){this.related.get(ax.a).push(ax.b);this.related.get(ax.b).push(ax.a);}
      this.rings=new Map();
      this.overlaps=new Map();
      this.groups=new Map();    // word -> groups of theme-pack words that sit together
      this.build();
      this.layout();
    }
    ring(topic){let r=this.rings.get(topic);if(!r){r=new Map();this.rings.set(topic,r);}return r;}
    put(topic,word,weight){const r=this.ring(topic);if((r.get(word)||0)<weight)r.set(word,weight);}
    neighbours(id){
      const out=[],hub=x=>(this.hypo.get(x)||0)>=HUB,seen=new Set([id]);
      const add=(x,w)=>{if(!seen.has(x)&&!hub(x)){seen.add(x);out.push([x,w]);}};
      const parents=this.engine.parents.get(id)||[];
      for(const p of parents)add(p,500);
      for(const k of this.kids.get(id))add(k,500);
      for(const x of this.related.get(id))add(x,500);
      for(const p of parents)if(!hub(p))for(const s of this.kids.get(p).slice().sort(cmpLabel).slice(0,6))add(s,400);
      return out;
    }
    build(){
      const engine=this.engine,packs=K.THEME_PACKS||{},core=new Map();
      const topics=new Set(Object.keys(K.conversationQuestions||{}).filter(t=>!EXCLUDED.has(t)));
      for(const t of Object.keys(packs))topics.add(t);
      for(const c of engine.a.concepts){
        const t=engine.topicFor(c.id);
        if(!t||EXCLUDED.has(t))continue;
        topics.add(t);this.put(t,label(c.label),1000);
        if(!core.has(t))core.set(t,[]);core.get(t).push(c.id);
      }
      for(const t of [...topics].sort(cmpLabel))this.ring(t);
      for(const [t,p] of Object.entries(packs)){
        for(const w of p.words)this.put(t,w,900);
        for(const [other,words] of p.overlaps||[])for(const w of words){this.put(t,w,800);this.put(other,w,800);}
        for(const [,words] of p.groups||[])for(const w of words){if(!this.groups.has(w))this.groups.set(w,[]);this.groups.get(w).push(words);}
      }
      // Fringe: taxonomic neighbours of core members. A neighbour with a topic of its own is core in that
      // ring too, which is what makes neighbouring rings overlap.
      for(const [t,ids] of core)for(const id of ids)for(const [n,w] of this.neighbours(id))this.put(t,label(engine.concepts.get(n).label),w);
      this.topics=[...this.rings.keys()].sort(cmpLabel);
    }
    /** Weighted Jaccard overlap of two rings, in permille. */
    overlap(a,b){
      if(a===b)return 1000;
      const key=a<b?a+'|'+b:b+'|'+a;
      if(this.overlaps.has(key))return this.overlaps.get(key);
      const ra=this.rings.get(a),rb=this.rings.get(b);let lo=0,hi=0;
      if(ra&&rb){
        for(const [w,x] of ra){const y=rb.get(w)||0;lo+=Math.min(x,y);hi+=Math.max(x,y);}
        for(const [w,y] of rb)if(!ra.has(w))hi+=y;
      }
      const value=hi?Math.floor(lo*1000/hi):0;
      this.overlaps.set(key,value);return value;
    }
    /** Members of both rings, strongest first: the bridges between two topics. */
    shared(a,b){
      const ra=this.rings.get(a),rb=this.rings.get(b),out=[];
      if(!ra||!rb)return out;
      for(const [w,x] of ra)if(rb.has(w))out.push({word:w,weight:Math.min(x,rb.get(w))});
      return out.sort((p,q)=>q.weight-p.weight||cmpLabel(p.word,q.word));
    }
    /** Classical MDS on 1 - overlap, by power iteration. Integer coordinates in [-1000, 1000]. */
    layout(){
      const T=this.topics,n=T.length,D=[];
      for(let i=0;i<n;i++){D.push([]);for(let j=0;j<n;j++){const d=1-this.overlap(T[i],T[j])/1000;D[i].push(d*d);}}
      const rowMean=D.map(r=>r.reduce((s,x)=>s+x,0)/n),total=rowMean.reduce((s,x)=>s+x,0)/n,B=[];
      for(let i=0;i<n;i++){B.push([]);for(let j=0;j<n;j++)B[i].push(-0.5*(D[i][j]-rowMean[i]-rowMean[j]+total));}
      const axes=[];
      for(let k=0;k<2;k++){
        let v=T.map((_,i)=>((i*37+k*11)%n)-n/2+0.5);
        for(let iter=0;iter<300;iter++){
          let w=B.map(row=>row.reduce((s,x,j)=>s+x*v[j],0));
          for(const u of axes){const dot=w.reduce((s,x,i)=>s+x*u[i],0),norm=u.reduce((s,x)=>s+x*x,0);for(let i=0;i<n;i++)w[i]-=dot/norm*u[i];}
          const top=w.reduce((m,x)=>Math.max(m,Math.abs(x)),0)||1;
          v=w.map(x=>x/top);
        }
        axes.push(v);
      }
      this.centre=new Map(T.map((t,i)=>[t,{x:Math.round(axes[0][i]*1000),y:Math.round(axes[1][i]*1000)}]));
    }
    /**
     * Topics for words that sit in a ring but are not in any lookup table. A word shared by two rings
     * belongs to the one the conversation is nearer to, which is how position settles ambiguity.
     */
    resolve(text,ctx){
      const words=K.fold(text).replace(/[^a-z0-9' -]+/g,' ').split(/\s+/).filter(Boolean).slice(0,60),out=[];
      const topicsFor=w=>this.topics.filter(t=>(this.rings.get(t).get(w)||0)>=800);
      for(let i=0;i<words.length;i++){
        const candidates=(i+1<words.length&&topicsFor(words[i]+' '+words[i+1]))||[];
        const found=candidates.length?candidates:topicsFor(words[i]);
        if(!found.length)continue;
        const pick=found.slice().sort((a,b)=>(ctx?.act?.[b]||0)-(ctx?.act?.[a]||0)||this.rings.get(b).get(words[i])-this.rings.get(a).get(words[i])||cmpLabel(a,b))[0];
        if(!out.includes(pick))out.push(pick);
      }
      return out;
    }
    /** Is `topic` close to a ring that was discussed a moment ago, other than the thread's own? Then the field has been heading there. */
    warm(ctx,topic,thread,turn){
      if(!ctx)return false;
      // Warm means directly discussed within the last few turns, not merely lit up by spreading.
      return this.topics.some(u=>u!==thread&&u!==topic&&turn-(ctx.hit[u]??-99)<=WARM&&this.overlap(topic,u)>=MIN_WARM);
    }
    /** The conversation's position: the centroid of the ring centres, weighted by activation. */
    position(ctx){
      let sx=0,sy=0,sw=0;
      for(const t of this.topics){const a=ctx?.act?.[t]||0;if(a){const c=this.centre.get(t);sx+=a*c.x;sy+=a*c.y;sw+=a;}}
      return sw?{x:Math.round(sx/sw),y:Math.round(sy/sw)}:{x:0,y:0};
    }
    /** A deterministic phase in [0, 1) that drifts as the conversation moves; slots use it to pick wording. */
    phase(ctx,turn){
      const p=this.position(ctx),v=(Math.abs(p.x)*7+Math.abs(p.y)*3)/1000*0.61803398875+turn*0.381966011;
      return v-Math.floor(v);
    }
    /** Decay the old activation, then pulse the topics this message touched and let it spread through overlaps. */
    advance(previous,hits,turn){
      const ctx={act:{},visited:(previous?.visited||[]).slice(),bridgeTurn:previous?.bridgeTurn??-99,bridged:(previous?.bridged||[]).slice(),reminded:{...(previous?.reminded||{})},askedBy:JSON.parse(JSON.stringify(previous?.askedBy||{})),hit:{...(previous?.hit||{})},topic:previous?.topic??null};
      for(const [t,a] of Object.entries(previous?.act||{})){const v=Math.floor(a*DECAY/1000);if(v>0)ctx.act[t]=v;}
      const list=[...new Set(hits.filter(t=>this.rings.has(t)))];
      list.forEach((t,i)=>{ctx.act[t]=Math.min(CAP,(ctx.act[t]||0)+(i===0?HIT:ALSO));ctx.hit[t]=turn;});
      if(list.length){
        const first=list[0],near=this.topics.filter(t=>t!==first).map(t=>[t,this.overlap(first,t)]).filter(x=>x[1]>0).sort((p,q)=>q[1]-p[1]||cmpLabel(p[0],q[0])).slice(0,4);
        for(const [t,ov] of near)ctx.act[t]=Math.min(CAP,(ctx.act[t]||0)+Math.floor(SPREAD*ov/near[0][1]));
        if(ctx.visited[ctx.visited.length-1]!==first)ctx.visited.push(first);
        ctx.visited=ctx.visited.slice(-VISITED);ctx.topic=first;
      }
      return ctx;
    }
    trace(ctx,kind,extra={}){
      const active=Object.entries(ctx.act).sort((p,q)=>q[1]-p[1]||cmpLabel(p[0],q[0])).slice(0,3);
      return {kind,topic:ctx.topic,active,position:this.position(ctx),...extra};
    }
    /**
     * Where the thread goes next: remind (an earlier memory sits in an overlapping ring), bridge (glide
     * to a neighbouring ring through a shared concept) or ladder (stay and go deeper).
     */
    nextMove({ctx,topic,step,ladderLength,answer,memories,turn}){
      const engine=this.engine,here=this.rings.get(topic),text=' '+K.fold(answer||'').replace(/[^a-z0-9' -]+/g,' ')+' ';
      if(!here||!ctx)return {kind:'ladder'};
      // 1. A remembered preference whose ring overlaps this one, not mentioned lately.
      if(step>=1){
        let best=null;
        for(const m of memories){
          if(m.status!=='active'||m.kind!=='preference'||m.polarity!=='positive'||m.temporal!=='present'||!['like','love','enjoy'].includes(m.predicate))continue;
          const mt=(m.object.concept&&engine.topicFor(m.object.concept))||K.conversationTopic(m.object.label,engine);
          if(!mt||mt===topic||!this.rings.has(mt)||turn-(ctx.hit[mt]??-99)<REMIND_QUIET)continue;
          if(text.includes(' '+label(m.object.label.replace(/^your /,''))+' '))continue;
          if(turn-(ctx.reminded[m.id]??-99)<REMIND_COOLDOWN)continue;
          const score=this.overlap(topic,mt)+(here.has(label(m.object.label.replace(/^your /,'')))?300:0);
          if(score>=MIN_REMIND&&(!best||score>best.score||score===best.score&&cmpLabel(m.id,best.memory.id)<0))best={memory:m,topic:mt,score};
        }
        if(best){
          const q='⟦That reminds me|That rings a bell|That sits near something you told me⟧: you '+best.memory.predicate+' '+best.memory.object.label+'. Does that connect with this at all?';
          return {kind:'remind',question:q,memory:best.memory,topic,trace:this.trace(ctx,'remind',{from:topic,memoryTopic:best.topic,score:best.score})};
        }
      }
      // 2. A neighbouring ring, reached through a shared concept the user touched or one that is simply strongest.
      if(turn-ctx.bridgeTurn>=BRIDGE_COOLDOWN){
        let best=null;
        for(const t of this.topics){
          if(t===topic)continue;
          const ov=this.overlap(topic,t);if(ov<MIN_BRIDGE)continue;
          const shared=this.shared(topic,t).filter(s=>!ctx.bridged.includes(s.word)&&(here.get(s.word)||0)<1000);
          if(!shared.length)continue;
          const touched=shared.find(s=>text.includes(' '+s.word+' '));
          const exhausted=step>=ladderLength;
          if(step<2||(!touched&&!exhausted))continue;
          const novelty=ctx.visited.includes(t)?200:1000,score=Math.floor(ov*(1000+(ctx.act[t]||0))/1000*novelty/1000)+(touched?500:0);
          if(!best||score>best.score||score===best.score&&cmpLabel(t,best.topic)<0)best={topic:t,score,word:(touched||shared[0]).word,touched:!!touched};
        }
        if(best){
          // A concept the user just named is asked about from the neighbouring ring's side; otherwise Kira names the link.
          const touchedAsks=['What is it about '+best.word+' that ⟦stands out|matters|keeps it in the picture⟧ for you?','How does '+best.word+' fit into all this for you?','Tell me more about '+best.word+'. How did it end up part of this?'],
            q=best.touched?touchedAsks[turn%touchedAsks.length]:'⟦That touches on|That sits close to|That leads somewhere near⟧ '+best.word+'. Does it come into this for you?';
          return {kind:'bridge',question:q,topic:best.topic,word:best.word,trace:this.trace(ctx,'bridge',{from:topic,to:best.topic,through:best.word,score:best.score,touched:best.touched?1:0})};
        }
      }
      return {kind:'ladder',trace:this.trace(ctx,'ladder')};
    }
    /** Remember a move so the same bridge or reminder is not repeated soon. */
    record(ctx,move,turn){
      if(move.kind==='bridge'){ctx.bridgeTurn=turn;ctx.bridged=ctx.bridged.concat(move.word).slice(-RECENT);ctx.topic=move.topic;}
      if(move.kind==='remind'){
        ctx.reminded[move.memory.id]=turn;
        const keep=Object.entries(ctx.reminded).sort((p,q)=>q[1]-p[1]||cmpLabel(p[0],q[0])).slice(0,RECENT);
        ctx.reminded=Object.fromEntries(keep);
      }
    }
  }
  K.RingField=RingField;
})(Kira);
