'use strict';
(function(K){
  class ModelBridge{
    constructor(source){this.source=source;this.worker=null;this.workerUrl=null;this.pending=new Map();this.serial=0;this.fallback=null;this.startPromise=null;}
    start(){if(!this.startPromise)this.startPromise=this.startWorker();return this.startPromise;}
    releaseUrl(){if(this.workerUrl){URL.revokeObjectURL(this.workerUrl);this.workerUrl=null;}}
    failWorker(error){
      const failure=Error(error?.message||String(error));failure.workerFailure=true;
      if(this.worker){this.worker.onmessage=this.worker.onerror=this.worker.onmessageerror=null;this.worker.terminate();this.worker=null;}
      this.releaseUrl();
      for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(failure);}this.pending.clear();
    }
    async startWorker(){
      try{
        this.workerUrl=URL.createObjectURL(new Blob([this.source],{type:'text/javascript'}));this.worker=new Worker(this.workerUrl);
        this.worker.onmessage=e=>{const r=e.data;if(!r||!Number.isSafeInteger(r.id)||typeof r.ok!=='boolean'){this.failWorker(Error('The model worker returned an invalid response.'));return;}const p=this.pending.get(r.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(r.id);r.ok?p.resolve(r.value):p.reject(Error(typeof r.error==='string'?r.error:'The model request failed.'));};
        this.worker.onerror=e=>{e.preventDefault?.();this.failWorker(Error('The model worker could not run. Retry to continue with the inline model.'));};
        this.worker.onmessageerror=()=>this.failWorker(Error('The model worker response could not be read. Retry to continue with the inline model.'));
        await this.request('ready',{},4000);this.releaseUrl();return 'worker';
      }catch(e){console.warn('Kira: worker unavailable, running inline.',e);this.failWorker(e);this.makeFallback();return 'inline';}
    }
    makeFallback(){if(!this.fallback){const engine=new K.SemanticEngine(K.ARTIFACT);this.fallback={engine,dialogue:new K.DialogueModel(engine,K.APP_META)};}}
    request(op,payload,timeout=30000){
      if(!this.worker){try{this.makeFallback();const {engine,dialogue}=this.fallback;let value;if(op==='step')value=dialogue.step(payload.state,payload.event);else if(op==='replay')value=dialogue.replay(payload.events);else if(op==='query')value=engine.query(payload.query);else if(op==='lexicon')value=engine.lexicon(payload);else if(op==='ready')value={artifact:engine.verification};else throw Error('Unknown worker command');return Promise.resolve(value);}catch(e){return Promise.reject(e);}}
      return new Promise((resolve,reject)=>{const id=++this.serial,timer=setTimeout(()=>this.failWorker(Error('The model timed out. Your previous save is unchanged. Retry to continue with the inline model.')),timeout);this.pending.set(id,{resolve,reject,timer});try{this.worker.postMessage({id,op,payload});}catch(e){this.failWorker(e);}});
    }
  }
  class Presenter{
    constructor(view,store,bridge){this.view=view;this.store=store;this.bridge=bridge;this.state=K.initialState();this.events=[];this.queue=Promise.resolve();this.blocked=false;this.mode='worker';}
    boot(){return this.enqueue(async()=>{
      this.view.setBusy(true,'Checking the semantic artifact…');
      try{
        this.mode=await this.bridge.start();this.view.setBusy(true,'Model ready ('+this.mode+'). Restoring conversation…');const envelope=this.store.read();
        if(envelope){
          K.inspectEnvelope(envelope,K.APP_META);let restored;
          try{restored=await this.bridge.request('replay',{events:envelope.events});}
          catch(e){if(!e.workerFailure||this.bridge.worker)throw e;this.mode='inline';restored=await this.bridge.request('replay',{events:envelope.events});}
          K.assert(K.hash(restored)===envelope.stateDigest,'Saved conversation did not replay exactly');this.state=restored;this.events=envelope.events;
        }
        this.view.render(this.state);this.savedStatus();
        // First run only: follow the system color preference so the default theme feels native.
        if(!envelope&&globalThis.matchMedia?.('(prefers-color-scheme: light)')?.matches){try{await this.withLock(()=>this.step({type:'settings',settings:{theme:'dawn'}}));}catch(e){this.view.error('The default theme could not be saved. '+e.message+' You can keep using this conversation and retry saving.');}}
      }catch(e){console.error('Kira boot failed',e);this.blocked=true;this.view.render(this.state);this.view.error('Could not open the saved conversation. '+e.message+' You can export the saved bytes or reset in Settings.');}
      finally{this.view.setBusy(false);}
    });}
    enqueue(action){const p=this.queue.then(action);this.queue=p.catch(()=>{});return p;}
    withLock(action){return globalThis.navigator?.locks? navigator.locks.request('kira-rse-session',action):action();}
    savedStatus(){this.view.status(this.store.temporary?'Temporary session · export before closing':'Saved on this device',this.store.temporary?'warning':'ok');}
    async step(eventData){
      if(this.blocked)throw Error('Resolve the saved-session error in Settings first.');
      const event={...eventData,seq:this.state.revision+1,time:Date.now()};
      this.view.setBusy(true,'Kira is considering your message…');
      try{
        const next=await this.bridge.request('step',{state:this.state,event});
        const events=this.events.concat(event),envelope=K.packSession(events,next.state,K.APP_META);
        this.store.commit(envelope);this.events=events;this.state=next.state;this.view.render(this.state);this.savedStatus();return next;
      }finally{this.view.setBusy(false);}
    }
    transact(eventData){let snapshot;try{K.canonical(eventData);snapshot=K.clone(eventData);}catch(e){return Promise.reject(e);}return this.enqueue(()=>this.withLock(()=>this.step(snapshot)));}
    message(text){return this.transact({type:'message',text});}
    settings(settings){return this.transact({type:'settings',settings});}
    retire(memoryId){return this.transact({type:'retire',memoryId});}
    image(data){return this.transact({type:'image',data});}
    query(query){return this.bridge.request('query',{query});}
    lexicon(payload){return this.bridge.request('lexicon',payload);}
    replay(){return this.enqueue(async()=>{const state=await this.bridge.request('replay',{events:this.events});K.assert(K.hash(state)===K.hash(this.state),'Replay mismatch');return {events:this.events.length,turns:state.turn,digest:K.hash(state),matched:true};});}
    export(){return K.encodeSession(K.packSession(this.events,this.state,K.APP_META));}
    importSession(envelope){let snapshot;try{K.canonical(envelope);snapshot=K.clone(envelope);}catch(e){return Promise.reject(e);}return this.enqueue(()=>this.withLock(async()=>{
      this.view.setBusy(true,'Checking the imported conversation…');
      try{
        K.inspectEnvelope(snapshot,K.APP_META);const candidate=await this.bridge.request('replay',{events:snapshot.events});K.assert(K.hash(candidate)===snapshot.stateDigest,'Imported snapshot does not replay');
        this.store.commit(K.packSession(snapshot.events,candidate,K.APP_META));this.state=candidate;this.events=snapshot.events;this.blocked=false;this.view.render(this.state);this.savedStatus();return candidate;
      }finally{this.view.setBusy(false);}
    }));}
    reset(){return this.enqueue(()=>this.withLock(async()=>{this.store.clear();this.events=[];this.state=K.initialState();this.blocked=false;this.view.render(this.state);this.savedStatus();}));}
    legacy(messages){return this.transact({type:'legacy',messages});}
  }
  Object.assign(K,{ModelBridge,Presenter});
})(Kira);
