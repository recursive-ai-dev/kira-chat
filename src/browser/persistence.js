'use strict';
// Adapter: one atomic localStorage value holds the complete version-pinned event log.
(function(K){
  const KEY='kira_rse_4_1_2';
  function pack(events,state,meta){const payload={format:'kira-session/4.1',assets:meta,events,stateDigest:K.hash(state)};return {...payload,checksum:K.hash(payload)};}
  function inspectEnvelope(value,meta){
    K.assert(value&&value.format==='kira-session/4.1','Unsupported save format');
    const payload={format:value.format,assets:value.assets,events:value.events,stateDigest:value.stateDigest};
    K.assert(value.checksum===K.hash(payload),'Save checksum mismatch');
    K.assert(K.hash(value.assets)===K.hash(meta),'This save requires a different version of Kira. Open it with its original app; the current session has not been changed.');
    K.assert(Array.isArray(value.events)&&value.events.length<=K.MAX_EVENTS,'Invalid event log');return value;
  }
  class SessionStore{
    constructor(storage){this.storage=storage;this.raw=null;this.temporary=!storage;this.key=KEY;}
    read(){this.raw=this.storage?this.storage.getItem(KEY):null;return this.raw?JSON.parse(this.raw):null;}
    commit(envelope){
      const encoded=JSON.stringify(envelope);K.assert(encoded.length<4500000,'Session is approaching the storage limit. Export it and begin a new conversation.');
      if(this.storage){K.assert(this.storage.getItem(KEY)===this.raw,'Another tab changed this conversation. Reload before sending again.');this.storage.setItem(KEY,encoded);}
      this.raw=encoded;return envelope;
    }
    clear(){if(this.storage){K.assert(this.storage.getItem(KEY)===this.raw,'Another tab changed this conversation. Reload before resetting.');this.storage.removeItem(KEY);}this.raw=null;}
    rawExport(){return this.raw||'';}
  }
  Object.assign(K,{SessionStore,packSession:pack,inspectEnvelope,STORE_KEY:KEY});
})(Kira);

