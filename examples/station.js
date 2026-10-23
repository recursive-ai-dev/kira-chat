'use strict';
(async function(){
  const $=id=>document.getElementById(id);
  let world,state,events=[];
  const controls=[...document.querySelectorAll('button,input,select')];
  controls.forEach(c=>{c.disabled=true;});
  function line(who,text,kind=''){
    const div=document.createElement('div');div.className='turn '+kind;
    if(who){const label=document.createElement('strong');label.textContent=who;div.append(label);}
    const body=document.createElement('span');body.textContent=text;div.append(body);$('transcript').append(div);
    return div;
  }
  function inspect(){
    const rows=[];
    for(const c of world.definition.characters){
      const actor=state.actors[c.id],latest=new Map(actor.beliefs.map(b=>[b.fact,b]));
      rows.push(c.name+':');
      for(const b of latest.values())rows.push('  '+b.fact+' = '+b.value+' ('+b.kind+(b.source?', from '+b.source:'')+')');
      if(!latest.size)rows.push('  No facts learned.');
      const count=Object.values(actor.sessions).reduce((n,s)=>n+s.dialogue.memories.filter(m=>m.status==='active').length,0);
      rows.push('  Private memories: '+count);
      rows.push('  Goals: '+(world.activeGoals(state,c.id).map(g=>g.label).join('; ')||'none'));
    }
    $('inspection').textContent=rows.join('\n');
  }
  function publish(reply){
    const turn=line(world.characters.get(reply.actor).name+' → '+world.identities.get(reply.speaker).name,reply.text);
    const details=document.createElement('details'),summary=document.createElement('summary'),trace=document.createElement('pre');
    summary.textContent='Inspect reply';trace.textContent=JSON.stringify(reply,null,2);details.append(summary,trace);turn.append(details);
  }
  function step(input,label){
    const event={seq:events.length+1,time:events.length,...input};
    const result=world.step(state,event);
    // Publish only after the operation succeeds.
    state=result.state;events.push(event);
    if(label)line('',label,'event');
    if(input.type==='message')line('Traveller → '+world.characters.get(input.actor).name,input.text,'player');
    if(result.reply)publish(result.reply);
    inspect();$('transcript').scrollTop=$('transcript').scrollHeight;
    $('status').textContent=events.length+' recorded events · SDK '+Kira.Narrative.version;
  }
  function safely(fn){try{fn();}catch(error){$('status').textContent=error.message;}}
  try{
    const response=await fetch('station.json');if(!response.ok)throw Error('Could not load the example package.');
    world=new Kira.Narrative.WorldModel(Kira.Narrative.compile(await response.json()));state=world.initialState();
    inspect();controls.forEach(c=>{c.disabled=false;});$('status').textContent='Ready. No events recorded.';
    $('message-form').addEventListener('submit',e=>{e.preventDefault();safely(()=>{step({type:'message',actor:$('actor').value,speaker:'traveller',text:$('message').value});$('message').value='';$('message').focus();});});
    const actions={
      red:()=>step({type:'world',fact:'signal_red',value:true,witnesses:['keeper']},'The signal turns red. Only Mara sees it.'),
      clear:()=>step({type:'world',fact:'signal_red',value:false,witnesses:[]},'The signal clears. Neither character sees it.'),
      rumour:()=>step({type:'tell',from:'keeper',to:['porter'],fact:'signal_red'},'Mara tells Ivo what she believes about the signal.'),
      'false-report':()=>step({type:'claim',from:'traveller',to:['porter'],fact:'signal_red',value:true},'The traveller tells Ivo the signal is red. This changes his belief, not world truth.'),
      initiate:()=>step({type:'initiate',actor:$('actor').value,speaker:'traveller'}),
      arrive:()=>step({type:'world',fact:'train_arrived',value:true,witnesses:['keeper','porter']},'The train arrives. Both characters see it.'),
      verify:()=>{$('status').textContent=Kira.hash(world.replay(events))===Kira.hash(state)?'Replay verified: the complete state matches.':'Replay mismatch.';},
      export:()=>{
        const blob=new Blob([JSON.stringify(world.export(events),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download='last-station-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      },
      reset:()=>{state=world.initialState();events=[];$('transcript').replaceChildren();inspect();$('status').textContent='Example reset. No events recorded.';},
    };
    for(const [id,fn]of Object.entries(actions))$(id).addEventListener('click',()=>safely(fn));
    $('import').addEventListener('change',async()=>{
      try{
        const file=$('import').files[0];if(!file)return;if(file.size>Kira.Narrative.MAX_EXPORT)throw Error('Session file is too large.');
        const restored=world.import(JSON.parse(await file.text()));state=restored.state;events=restored.events;
        $('transcript').replaceChildren();line('', 'Restored '+events.length+' verified events. Earlier replies are retained in character state.','event');
        inspect();$('status').textContent='Session imported and replay verified.';
      }catch(error){$('status').textContent=error.message;}finally{$('import').value='';}
    });
  }catch(error){$('status').textContent=error.message+' Run npm run demo, then open http://localhost:8042/examples/station.html.';}
})();
