'use strict';
(function(K){
  const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const button=(text,cls,fn)=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  const clear=n=>n.replaceChildren();
  const labels={conversation:['YOUR OWN PACE','Conversation'],memories:['A LITTLE CONTINUITY','Memory notebook'],lab:['MEANING YOU CAN FOLLOW','Engine lab']};
  function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function detail(label,data){const d=el('details');d.append(el('summary','',label),el('pre','',typeof data==='string'?data:JSON.stringify(data,null,2)));return d;}
  function timeLabel(time){try{return new Date(time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}catch{return '';}}
  function table(headers,rows){const t=el('table','proof-table'),h=el('thead'),tr=el('tr');headers.forEach(x=>tr.append(el('th','',x)));h.append(tr);t.append(h);const body=el('tbody');rows.forEach(row=>{const r=el('tr');row.forEach(v=>r.append(el('td','',String(v))));body.append(r);});t.append(body);return t;}
  class View{
    constructor(){this.state=K.initialState();this.presenter=null;this.busy=false;this.screen='conversation';this.visible=80;this.rendered=[];this.lastResult=null;this.avatarDraft=null;this.lastCount=0;}
    attach(presenter){this.presenter=presenter;this.bind();this.queryFields();}
    error(message){$('notice').textContent=message;$('notice').className='notice error';$('notice').hidden=false;}
    status(message,kind){$('save-status').textContent=message;if(kind==='ok')$('notice').hidden=true;else{this.error(message);$('notice').className='notice';}}
    setBusy(value,label){this.busy=value;$('thinking').hidden=!value;if(label)$('thinking-label').textContent=label;this.inputMeta();}
    inputMeta(){$('input-count').textContent=$('message-input').value.length+' / 2000';$('send-button').disabled=this.busy||!$('message-input').value.trim();}
    async run(fn){try{return await fn();}catch(e){this.error(e.message);return null;}}
    show(screen){if(!labels[screen])screen='conversation';this.screen=screen;for(const key of Object.keys(labels))$('screen-'+key).hidden=key!==screen;document.querySelectorAll('.nav-item[data-screen]').forEach(b=>{b.classList.toggle('active',b.dataset.screen===screen);if(b.dataset.screen===screen)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});[$('screen-eyebrow').textContent,$('screen-title').textContent]=labels[screen];if(screen==='memories')this.renderMemories();if(screen==='lab')this.run(()=>this.searchLexicon());}
    render(state){
      this.state=state;document.body.classList.toggle('dawn',state.settings.theme==='dawn');$('theme-toggle').setAttribute('aria-label',state.settings.theme==='dawn'?'Switch to night theme':'Switch to dawn theme');
      $('persona-summary').textContent=K.DIALOGUE.personas[state.settings.persona].description;
      const portrait=$('portrait'),photo=portrait.querySelector('img');if(state.settings.avatar){if(!photo){const img=el('img');img.alt='Kira profile';img.src=state.settings.avatar;portrait.append(img);}else if(photo.src!==state.settings.avatar)photo.src=state.settings.avatar;}else if(photo)photo.remove();
      const active=state.memories.filter(m=>m.status==='active');$('memory-count').textContent=active.length;$('rail-count').textContent=active.length;$('stage-pill').textContent=K.relationshipStage(state.relationship.points);
      $('relationship-title').textContent=state.relationship.points>=32?'A familiar presence.':state.relationship.points>=12?'A rhythm of our own.':state.relationship.points>=4?'Little things add up.':'A first hello.';
      $('relationship-copy').textContent=state.turn?state.turn+' turn'+(state.turn===1?'':'s')+' together. The small details give this conversation its shape.':'There’s no rush. Start with something small.';
      $('familiarity-fill').style.width=Math.max(4,Math.min(100,Math.round(state.relationship.points/32*100)))+'%';
      clear($('memory-preview'));if(!active.length)$('memory-preview').append(el('p','tiny','A name, a preference, a detail worth keeping. Nothing assumed.'));else for(const m of active.slice(-3)){const n=el('div','preview-note',K.describeMemory(m));n.append(el('span','','You told Kira · turn '+m.turn));$('memory-preview').append(n);}
      this.renderMessages();this.renderMemories();this.quickPrompts();$('event-count').textContent=state.revision+' events';
      $('artifact-stats').textContent=K.ARTIFACT.concepts.length+' concepts · '+K.ARTIFACT.senses.length+' senses · '+K.ARTIFACT.classification.nodes.length+' checked facts\nSHA-256 '+K.ARTIFACT.hash;
    }
    welcome(){const n=el('div','welcome');n.append(el('div','welcome-symbol','✳'),el('div','eyebrow','HELLO, I’M KIRA.'));const h=el('h2');h.append(document.createTextNode('A little room'),el('br'),document.createTextNode('for conversation.'));n.append(h,el('p','','Tell me a preference, a feeling, or something you’d like me to remember. We can start small and see where it goes.'));const foot=el('div','welcome-foot');['Your words, remembered','Your pace, respected','Entirely offline'].forEach(x=>foot.append(el('span','',x)));n.append(foot);return n;}
    renderMessages(){
      const box=$('messages'),msgs=this.state.messages,start=Math.max(0,msgs.length-this.visible),current=msgs.slice(start),ids=current.map(m=>JSON.stringify([m.id,m.text,m.time,m.image,m.legacy,m.plan?.digest]));
      const prefix=this.rendered.length>0&&start===this.renderStart&&this.rendered.every((id,i)=>ids[i]===id);
      if(!msgs.length){if(this.rendered.length||!box.querySelector('.welcome')){clear(box);box.append(this.welcome());}this.rendered=[];this.renderStart=0;return;}
      if(!prefix){box.setAttribute('aria-live','off');clear(box);if(start>0)box.append(button('Load earlier messages','load-older',()=>{this.visible+=100;this.rendered=[];this.renderMessages();}));for(const m of current)box.append(this.messageNode(m));setTimeout(()=>box.setAttribute('aria-live','polite'),0);}
      else for(const m of current.slice(this.rendered.length))box.append(this.messageNode(m));
      const added=msgs.length>this.lastCount;this.rendered=ids;this.renderStart=start;this.lastCount=msgs.length;
      if(added)requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});
    }
    messageNode(m){
      const n=el('article','message '+m.role);n.id='msg-'+m.id;const label=el('div','message-label',m.role==='assistant'?'Kira':'You');label.append(el('span','',timeLabel(m.time)));n.append(label);
      if(m.legacy)label.append(el('span','legacy-badge','Legacy archive · unverified'));
      const bubble=el('div','bubble',m.image?'':m.text);if(m.image){const img=el('img','message-image');img.src=m.image;img.alt='Image shared in the conversation';img.tabIndex=0;const open=()=>{$('zoom-image').src=m.image;$('image-dialog').showModal();};img.addEventListener('click',open);img.addEventListener('keydown',e=>{if(e.key==='Enter')open();});bubble.append(img);}n.append(bubble);
      if(m.plan){const tools=el('div','message-tools');tools.append(button('Sources & reasoning ↗','inspect-button',()=>this.inspect(m.plan)));if(m.plan.claims.length)tools.append(el('span','',m.plan.claims.length+' attributed record'+(m.plan.claims.length===1?'':'s')));n.append(tools);}return n;
    }
    quickPrompts(){const box=$('quick-prompts');clear(box);const pending=this.state.context.pending;let prompts=this.state.turn?['What do you remember about me?','Tell me a joke','Give me a writing prompt']:['My name is…','I like music','How are you?'];if(pending?.choices)prompts=pending.choices.map(c=>c.aliases[0]||c.label);else if(pending?.kind==='confirmName')prompts=['Yes','No'];else if(pending?.kind==='name')prompts=['My name is…','Tell me about yourself'];else if(pending?.topic==='support')prompts=['Yes','Not really','Tell me a joke'];for(const s of prompts)box.append(button(s,'',()=>{$('message-input').value=s==='My name is…'?'My name is ':s;$('message-input').focus();this.inputMeta();}));}
    async searchLexicon(){
      const ticket=this.lexiconTicket=(this.lexiconTicket||0)+1,r=await this.presenter.lexicon({text:$('lexicon-search').value});if(ticket!==this.lexiconTicket)return;
      const box=$('lexicon-results');clear(box);$('lexicon-total').textContent=r.total+' matches · '+K.ARTIFACT.concepts.length+' concepts';
      if(!r.entries.length)box.append(el('p','tiny','No match yet. Try a broader subject or another spelling.'));
      for(const c of r.entries)box.append(button(c.label,'subtle',()=>this.run(()=>this.openLexicon(c.id))));
      if(r.total>r.entries.length)box.append(el('p','tiny','Showing the first '+r.entries.length+'. Type more to narrow the search.'));
    }
    async openLexicon(id){
      const ticket=this.detailTicket=(this.detailTicket||0)+1,r=await this.presenter.lexicon({id});if(ticket!==this.detailTicket)return;
      const box=$('lexicon-detail');clear(box);box.append(el('h3','',r.entry.label),el('p','tiny',r.entry.id),el('p','','Recognized forms: '+r.entry.aliases.join(', ')));
      for(const [title,items]of [['Is a kind of',r.parents],['More specific meanings',r.children]]){box.append(el('h4','',title));const row=el('div','button-row');for(const c of items)row.append(button(c.label,'text-button',()=>this.run(()=>this.openLexicon(c.id))));if(!items.length)row.append(el('span','tiny','None listed.'));box.append(row);}
      box.append(table(['Wording','Register','Affect'],r.senses.map(s=>[s.lemma,s.lin[0],s.lin[1]])),el('p','tiny','Conversation topic: '+(r.topic||'general')+'. Curation remains experimental.'));
      for(const p of r.parents)box.append(detail('Checked link to '+p.label,p.evidence));
    }
    renderMemories(){
      const box=$('memory-list');clear(box);const term=K.fold($('memory-search').value),all=$('show-retired').checked;
      const records=this.state.memories.filter(m=>(all||m.status==='active')&&K.fold(K.describeMemory(m)).includes(term)).slice().reverse();
      if(!records.length){const empty=el('div','empty-memory');empty.append(el('h3','','Nothing on this page yet.'),el('p','','Try “My name is Alex” or “I like coffee” to give Kira a place to start.'));box.append(empty);return;}
      for(const m of records){const card=el('article','memory-card '+(m.status==='active'?'':'retired')),type=el('div','memory-type',m.kind);type.append(el('span','',m.status));card.append(type,el('h3','',K.describeMemory(m)),el('p','',m.attribution.replace(/_/g,' ')+' · '+m.temporal));
        const source=this.state.messages.find(x=>x.id===m.sourceMessage);if(source)card.append(el('p','memory-source','“'+source.text+'”'));
        if(m.supersedes.length)card.append(el('p','tiny','Replaces '+(m.supersedes.length===1?'an earlier record':m.supersedes.length+' earlier records')));
        const meaning=m.object.concept&&K.ARTIFACT.concepts.find(c=>c.id===m.object.concept);if(meaning)card.append(el('p','tiny','Meaning · '+meaning.label));
        const footer=el('footer');footer.append(button('Source · turn '+m.turn,'source-link',()=>this.source(m.sourceMessage)));if(m.status==='active')footer.append(button('Retire','text-button',()=>this.run(()=>this.presenter.retire(m.id))));card.append(footer);box.append(card);
      }
    }
    source(id){this.visible=Math.max(this.visible,this.state.messages.length);this.rendered=[];this.renderMessages();this.show('conversation');$('inspect-dialog').close();const n=$('msg-'+id);if(n){n.scrollIntoView({block:'center'});n.classList.add('highlight-message');setTimeout(()=>n.classList.remove('highlight-message'),2500);}}
    inspect(plan){
      const box=$('inspect-content');clear(box);
      const interpretation=el('section');interpretation.append(el('h3','','1. The interpretation boundary'),el('p','','The parser’s supported reading is “'+plan.act+'”. This is a bounded grammar decision, not a proof of general English understanding.'));
      if(plan.interpretation)interpretation.append(detail('Parsed frames, scope, spans, and references',plan.interpretation));box.append(interpretation);
      const memories=el('section');memories.append(el('h3','','2. What the reply can attribute to you'));
      if(!plan.claims.length)memories.append(el('p','','This reply does not make a claim from your memory.'));
      for(const claim of plan.claims){const m=this.state.memories.find(m=>m.id===claim.memoryId);if(!m)continue;memories.append(el('p','',K.describeMemory(m)+' · record '+m.id+' · now '+m.status),button('Open the original message ↗','source-link',()=>this.source(m.sourceMessage)));}
      box.append(memories);const semantics=el('section');semantics.append(el('h3','','3. Checked semantic evidence'));
      for(const r of plan.semantics){semantics.append(el('p','',r.query.op+' → '+r.outcome+' · '+r.evidence?.type),detail('Inspect '+r.query.op+' certificate',r));}
      box.append(semantics);const policy=el('section');policy.append(el('h3','','4. The dialogue policy'),el('p','','Eligibility is semantic. Personality, repetition, familiarity, and wording selection are application policy.'),detail('Policy and constrained wording slots',{policy:plan.policy,slots:plan.slots}),el('p','tiny','Turn digest: '+(plan.digest||'Image acknowledgment')));box.append(policy);
      box.append(button('Export this reply and its semantic artifact ↓','secondary',()=>download('kira-reply-proof.json',JSON.stringify({artifact:K.ARTIFACT,plan},null,2))));$('inspect-dialog').showModal();
    }
    openSettings(){const s=this.state.settings;$('persona-select').value=s.persona;$('register-range').value=s.register;$('boundary-select').value=s.boundary;this.avatarDraft=s.avatar;this.settingsLabels();$('settings-dialog').showModal();}
    settingsLabels(){$('persona-description').textContent=K.DIALOGUE.personas[$('persona-select').value].description;const n=Number($('register-range').value);$('register-output').textContent=n<=-1500?'Very casual':n<0?'Casual':n>=1500?'Very formal':n>0?'Formal':'Neutral';}
    queryFields(){
      const kind=$('query-kind').value,box=$('query-fields');clear(box);
      const selectField=(id,title,values,selected)=>{const label=el('label','field-label',title);label.htmlFor=id;const select=el('select');select.id=id;for(const v of values){const o=el('option','',v.label);o.value=v.id;select.append(o);}if(selected)select.value=selected;box.append(label,select);return select;};
      const concepts=K.ARTIFACT.concepts.map(c=>({id:c.id,label:c.label+' · '+c.id})),senses=K.ARTIFACT.senses.map(s=>({id:s.id,label:s.lemma+' · '+s.id}));
      selectField('query-a',kind==='realize'?'Meaning':'From',kind==='subsumes'||kind==='existential'||kind==='realize'?concepts:senses,kind==='realize'?'c:bicycle':kind==='shift'?'s:bike':kind==='subsumes'||kind==='existential'?'c:dog':'s:dog');
      if(['subsumes','existential','relation','entails'].includes(kind))selectField('query-b','To',kind==='subsumes'||kind==='existential'?concepts:senses,kind==='subsumes'||kind==='existential'?'c:animal':'s:animal');
      if(kind==='existential')selectField('query-role','Typed role',[{id:'componentOf',label:'componentOf · transitive'},{id:'memberOf',label:'memberOf · not transitive'}],'componentOf');
      if(kind==='entails'){
        selectField('query-op','Extensional context',[{id:'identity',label:'Identity / positive context'},{id:'complement',label:'Negation / complement'},{id:'no',label:'No … (restrictor)'},{id:'intersection',label:'Intersection with context'},{id:'quotation',label:'Quotation (unsupported)'}],'identity');
        selectField('query-context','Intersection context',concepts,'c:animal');
      }
      if(kind==='shift'||kind==='realize'){
        const row=el('div','query-pair');for(const [id,label,value]of [['query-register','Register',2000],['query-affect','Affect',0]]){const d=el('div'),l=el('label','field-label',label);l.htmlFor=id;const input=el('input');input.type='number';input.id=id;input.value=value;input.step='500';d.append(l,input);row.append(d);}box.append(row,el('p','tiny',kind==='shift'?'A relative change. Candidates must move in every requested direction.':'An absolute target. The current wording remains eligible.'));
      }
    }
    buildQuery(){const kind=$('query-kind').value,a=$('query-a').value,b=$('query-b')?.value;
      if(kind==='realize')return {op:kind,c:a,target:[Number($('query-register').value),Number($('query-affect').value)]};
      if(kind==='shift')return {op:kind,s:a,delta:[Number($('query-register').value),Number($('query-affect').value)]};
      if(kind==='entails'){const e={pairs:[[a,b]],operator:$('query-op').value};if(e.operator==='intersection')e.context=$('query-context').value;return {op:kind,edits:[e]};}
      return {op:kind,a,b,...(kind==='existential'?{role:$('query-role').value}:{})};
    }
    example(name){const kind=name==='gap'?'shift':name==='no'?'entails':'subsumes';$('query-kind').value=kind;this.queryFields();if(name==='gap'){$('query-a').value='s:automobile';$('query-register').value=2000;}else if(name==='no'){$('query-a').value='s:animal';$('query-b').value='s:dog';$('query-op').value='no';}else{$('query-a').value='c:dog';$('query-b').value=name==='siblings'?'c:cat':'c:animal';}this.runQuery();}
    async runQuery(){const button=$('run-query');button.disabled=true;try{const r=await this.presenter.query(this.buildQuery());this.lastResult=r;this.renderResult(r);$('export-proof').hidden=false;}catch(e){this.error(e.message);}finally{button.disabled=false;}}
    renderResult(r){
      const box=$('query-result');clear(box);const unknown=['Unknown','Inconclusive','Gap','UnsupportedOperator','InvalidQuery','ArtifactMismatch'].includes(r.outcome);box.append(el('div','outcome'+(unknown?' unknown':''),r.outcome));
      const descriptions={Yes:'The supported query is entailed by the bundled axioms and any cited premises.',No:'An explicit contradiction / disjointness proof supports this answer.',Unknown:'L1 closure establishes neither subsumption nor explicit disjointness for this query.',Inconclusive:'The L3 relation set does not establish entailment or contradiction.',Relation:'The possible basic relations are kept as a set. Inclusion need not be strict.',Gap:'No same-fiber candidate moves in every requested direction.',Computed:'The checker independently reconstructed the candidate universe and checked the selection.',UnsupportedOperator:'This context has no supported extensional signature.',InvalidQuery:'The input failed a typed validation rule.',ArtifactMismatch:'The query belongs to a different artifact.'};
      box.append(el('p','result-summary',descriptions[r.outcome]||r.outcome));if(r.value.reason)box.append(el('p','tiny',r.value.reason));
      if(r.value.mask!==undefined){const masks=el('div','mask-pills');K.relationSymbols.forEach((s,i)=>{if(r.value.mask&(1<<i))masks.append(el('span','',s));});box.append(masks,el('p','tiny','Mask '+r.value.mask+' · ≡ equality, ⊏ inclusion, ⊐ reverse inclusion, ^ complement, | disjoint, ‿ cover, # independent.'));}
      if(r.value.chosen){const s=K.ARTIFACT.senses.find(s=>s.id===r.value.chosen);box.append(el('h2','',s.lemma),el('p','tiny','Meaning '+s.cid+' · absolute target ['+r.value.target.join(', ')+']'));}
      if(r.value.candidates)box.append(table(['Candidate','Coordinates','Distance'],r.value.candidates.map(c=>{const s=K.ARTIFACT.senses.find(s=>s.id===c.sid);return [(c.sid===r.value.chosen?'✓ ':'')+s.lemma,s.lin.join(', '),c.distance];})));
      if(r.value.edits)box.append(table(['Edit','Atomic mask','Projected mask'],r.value.edits.map((e,i)=>[i+1,e.atomic,e.projected])));
      box.append(el('div','result-meta',(r.checked?'Reference check passed. ':'')+(r.evidence?r.evidence.type+'. ':'Operational outcome. ')+'\nSHA-256 '+r.digest));
      if(r.evidence){const facts=r.evidence.nodes.filter(n=>n.tag==='L1Fact').map(n=>K.ARTIFACT.classification.nodes[Number(n.fields.ref)]);if(facts.length)box.append(detail('Grounded L1 derivations',this.expandFacts(facts)));}
      box.append(detail('Canonical query, result, and evidence',r));
    }
    expandFacts(roots){const seen=new Set();const visit=n=>{if(seen.has(n.id))return;for(const i of n.premises)visit(K.ARTIFACT.classification.nodes[i]);seen.add(n.id);};roots.forEach(visit);return [...seen].sort((a,b)=>a-b).map(i=>K.ARTIFACT.classification.nodes[i]);}
    bind(){
      document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>this.show(b.dataset.screen)));document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();this.show('conversation');});
      document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
      for(const id of ['settings-open','settings-shortcut','personality-open'])$(id)?.addEventListener('click',()=>this.openSettings());
      $('theme-toggle').addEventListener('click',()=>this.run(()=>this.presenter.settings({theme:this.state.settings.theme==='night'?'dawn':'night'})));
      const send=async()=>{const draft=$('message-input').value,text=draft.trim();if(!text||this.busy)return;const r=await this.run(()=>this.presenter.message(text));if(r){if($('message-input').value===draft)$('message-input').value='';this.inputMeta();$('message-input').focus();}};
      $('composer').addEventListener('submit',e=>{e.preventDefault();send();});$('message-input').addEventListener('input',()=>this.inputMeta());$('message-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send();}});
      $('memory-search').addEventListener('input',()=>this.renderMemories());$('show-retired').addEventListener('change',()=>this.renderMemories());
      $('persona-select').addEventListener('change',()=>{$('register-range').value=K.DIALOGUE.personas[$('persona-select').value].target[0];this.settingsLabels();});$('register-range').addEventListener('input',()=>this.settingsLabels());
      $('settings-form').addEventListener('submit',e=>{e.preventDefault();this.run(async()=>{await this.presenter.settings({persona:$('persona-select').value,register:Number($('register-range').value),boundary:$('boundary-select').value,avatar:this.avatarDraft});$('settings-dialog').close();});});
      for(const id of ['export-button','export-memory'])$(id).addEventListener('click',()=>this.run(()=>download('kira-session.json',this.presenter.export())));
      $('export-raw').addEventListener('click',()=>download('kira-saved-recovery.json',this.presenter.store.rawExport()||this.presenter.export()));
      $('import-button').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',()=>this.run(async()=>{const file=$('import-file').files[0];$('import-file').value='';if(!file)return;K.assert(file.size<5000000,'Import must be under 5 MB');const data=JSON.parse(await file.text());
        if(data.format==='kira-session/4.1'){if(!confirm('Replace this conversation with the imported session? Export the current one first if you want to keep it.'))return;await this.presenter.importSession(data);}
        else{const messages=data.chatHistory||data.messages;K.assert(Array.isArray(messages),'Not a Kira session or supported legacy transcript');if(!confirm('Append up to 200 old messages as an unverified archive? No inferred memories or neural weights will be imported.'))return;await this.presenter.legacy(messages.filter(m=>typeof m.text==='string').slice(-200).map(m=>({role:m.role,text:m.text})));}
        $('settings-dialog').close();}));
      $('reset-button').addEventListener('click',()=>this.run(async()=>{if(!confirm('Remove this app’s saved conversation, memories, settings, and images? Export a backup first if you want to keep them.'))return;await this.presenter.reset();this.rendered=[];this.renderMessages();$('settings-dialog').close();}));
      $('query-kind').addEventListener('change',()=>this.queryFields());$('run-query').addEventListener('click',()=>this.runQuery());document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>this.example(b.dataset.example)));
      $('lexicon-search').addEventListener('input',()=>{this.lexiconTicket=(this.lexiconTicket||0)+1;clearTimeout(this.lexiconTimer);this.lexiconTimer=setTimeout(()=>this.run(()=>this.searchLexicon()),150);});
      $('export-proof').addEventListener('click',()=>{if(this.lastResult)download('kira-semantic-proof.json',JSON.stringify({artifact:K.ARTIFACT,result:this.lastResult},null,2));});
      $('replay-button').addEventListener('click',()=>this.run(async()=>{const b=$('replay-button');b.disabled=true;try{const r=await this.presenter.replay();$('replay-result').textContent='Exact match · '+r.events+' events · '+r.turns+' turns\n'+r.digest;}finally{b.disabled=false;}}));
      $('attach-button').addEventListener('click',()=>$('image-file').click());$('avatar-upload').addEventListener('click',()=>$('avatar-file').click());$('avatar-remove').addEventListener('click',()=>{this.avatarDraft=null;$('avatar-upload').textContent='Choose image';});
      $('image-file').addEventListener('change',()=>this.run(async()=>{const file=$('image-file').files[0];$('image-file').value='';if(file)await this.presenter.image(await imageData(file));}));
      $('avatar-file').addEventListener('change',()=>this.run(async()=>{const file=$('avatar-file').files[0];$('avatar-file').value='';if(file){this.avatarDraft=await imageData(file);$('avatar-upload').textContent='Image selected';}}));
      window.addEventListener('storage',e=>{if(this.presenter.store.storage&&e.storageArea===this.presenter.store.storage&&(e.key===K.STORE_KEY||e.key===null)&&e.newValue!==this.presenter.store.raw){this.presenter.blocked=true;this.error('Another tab changed this conversation. Reload this page before continuing. Your unsent text is still here.');}});
    }
  }
  async function imageData(file){
    K.assert(['image/png','image/jpeg','image/webp'].includes(file.type),'Choose a PNG, JPEG, or WebP image');K.assert(file.size<=5000000,'Image must be under 5 MB');
    const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();K.assert(image.width<=8192&&image.height<=8192,'Image dimensions are too large');const scale=Math.min(1,768/image.width,768/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');context.fillStyle='#152124';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);for(const quality of [.82,.6,.4,.25]){const data=canvas.toDataURL('image/jpeg',quality);if(K.supportedImage(data))return data;}throw Error('Image is too large after resizing');}finally{URL.revokeObjectURL(url);}
  }
  K.View=View;
  let storage;try{storage=window.localStorage;storage.getItem(K.STORE_KEY);}catch{storage=null;}
  const view=new View(),store=new K.SessionStore(storage),bridge=new K.ModelBridge($('worker-source').textContent),presenter=new K.Presenter(view,store,bridge);view.attach(presenter);
  globalThis.KiraApp=Object.freeze({snapshot:()=>K.clone(presenter.state),exportSession:()=>presenter.export(),query:q=>presenter.query(q),replay:()=>presenter.replay(),version:K.APP_META});
  presenter.boot();
})(Kira);
