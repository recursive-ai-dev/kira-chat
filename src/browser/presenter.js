'use strict';
(function(K){
  class ModelBridge{
    constructor(source){this.source=source;this.worker=null;this.pending=new Map();this.serial=0;this.fallback=null;}
    async start(){
      try{
        const url=URL.createObjectURL(new Blob([this.source],{type:'text/javascript'}));this.worker=new Worker(url);URL.revokeObjectURL(url);
        this.worker.onmessage=e=>{const r=e.data,p=this.pending.get(r.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(r.id);r.ok?p.resolve(r.value):p.reject(Error(r.error));};
        this.worker.onerror=e=>{e.preventDefault();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('The model worker could not run.'));}this.pending.clear();};
        await this.request('ready',{});return 'worker';
      }catch(e){if(this.worker)this.worker.terminate();this.worker=null;this.makeFallback();return 'inline';}
    }
    makeFallback(){if(!this.fallback){const engine=new K.SemanticEngine(K.ARTIFACT);this.fallback={engine,dialogue:new K.DialogueModel(engine,K.APP_META)};}}
    request(op,payload){
      if(!this.worker){this.makeFallback();try{const {engine,dialogue}=this.fallback;return Promise.resolve(op==='step'?dialogue.step(payload.state,payload.event):op==='replay'?dialogue.replay(payload.events):op==='query'?engine.query(payload.query):op==='lexicon'?engine.lexicon(payload):{artifact:engine.verification});}catch(e){return Promise.reject(e);}}
      return new Promise((resolve,reject)=>{const id=++this.serial,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('The model timed out. Your previous save is unchanged.'));},30000);this.pending.set(id,{resolve,reject,timer});this.worker.postMessage({id,op,payload});});
    }
  }
  class Presenter{
    constructor(view,store,bridge){this.view=view;this.store=store;this.bridge=bridge;this.state=K.initialState();this.events=[];this.queue=Promise.resolve();this.blocked=false;this.mode='worker';}
    boot(){return this.enqueue(async()=>{
      this.view.setBusy(true,'Checking the semantic artifact…');
      try{
        this.mode=await this.bridge.start();const envelope=this.store.read();
        if(envelope){K.inspectEnvelope(envelope,K.APP_META);const restored=await this.bridge.request('replay',{events:envelope.events});K.assert(K.hash(restored)===envelope.stateDigest,'Saved conversation did not replay exactly');this.state=restored;this.events=envelope.events;}
        this.view.render(this.state);this.savedStatus();
        // First run only: follow the system color preference so the default theme feels native.
        if(!envelope&&globalThis.matchMedia?.('(prefers-color-scheme: light)')?.matches)await this.settings({theme:'dawn'});
      }catch(e){this.blocked=true;this.view.render(this.state);this.view.error('Could not open the saved conversation. '+e.message+' You can export the saved bytes or reset in Settings.');}
      finally{this.view.setBusy(false);}
    });}
    enqueue(action){const p=this.queue.then(action);this.queue=p.catch(()=>{});return p;}
    withLock(action){return globalThis.navigator?.locks? navigator.locks.request('kira-rse-session',action):action();}
    savedStatus(){this.view.status(this.store.temporary?'Temporary session · export before closing':'Saved on this device',this.store.temporary?'warning':'ok');}
    transact(eventData){return this.enqueue(async()=>{
      const operation=async()=>{
        if(this.blocked)throw Error('Resolve the saved-session error in Settings first.');
        const event={...eventData,seq:this.state.revision+1,time:Date.now()};
        this.view.setBusy(true,'Kira is considering your message…');
        try{
          const next=await this.bridge.request('step',{state:this.state,event});
          const events=this.events.concat(event),envelope=K.packSession(events,next.state,K.APP_META);
          this.store.commit(envelope);this.events=events;this.state=next.state;this.view.render(this.state);this.savedStatus();return next;
        }finally{this.view.setBusy(false);}
      };
      return this.withLock(operation);
    });}
    message(text){return this.transact({type:'message',text});}
    settings(settings){return this.transact({type:'settings',settings});}
    retire(memoryId){return this.transact({type:'retire',memoryId});}
    image(data){return this.transact({type:'image',data});}
    query(query){return this.bridge.request('query',{query});}
    lexicon(payload){return this.bridge.request('lexicon',payload);}
    replay(){return this.enqueue(async()=>{const state=await this.bridge.request('replay',{events:this.events});K.assert(K.hash(state)===K.hash(this.state),'Replay mismatch');return {events:this.events.length,turns:state.turn,digest:K.hash(state),matched:true};});}
    export(){return JSON.stringify(K.packSession(this.events,this.state,K.APP_META),null,2);}
    importSession(envelope){return this.enqueue(()=>this.withLock(async()=>{
      this.view.setBusy(true,'Checking the imported conversation…');
      try{
        K.inspectEnvelope(envelope,K.APP_META);const candidate=await this.bridge.request('replay',{events:envelope.events});K.assert(K.hash(candidate)===envelope.stateDigest,'Imported snapshot does not replay');
        this.store.commit(K.packSession(envelope.events,candidate,K.APP_META));this.state=candidate;this.events=envelope.events;this.blocked=false;this.view.render(this.state);this.savedStatus();return candidate;
      }finally{this.view.setBusy(false);}
    }));}
    reset(){return this.enqueue(()=>this.withLock(async()=>{this.store.clear();this.events=[];this.state=K.initialState();this.blocked=false;this.view.render(this.state);this.savedStatus();}));}
    legacy(messages){return this.transact({type:'legacy',messages});}
  }
  Object.assign(K,{ModelBridge,Presenter});
})(Kira);
