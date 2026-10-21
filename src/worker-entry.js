
'use strict';
const semanticModel=new Kira.SemanticEngine(Kira.ARTIFACT);
const dialogueModel=new Kira.DialogueModel(semanticModel,Kira.APP_META);
self.onmessage=event=>{
  const {id,op,payload}=event.data;
  try{
    let value;
    if(op==='ready')value={artifact:semanticModel.verification};
    else if(op==='step')value=dialogueModel.step(payload.state,payload.event);
    else if(op==='replay')value=dialogueModel.replay(payload.events);
    else if(op==='query')value=semanticModel.query(payload.query);
    else if(op==='lexicon')value=semanticModel.lexicon(payload);
    else throw Error('Unknown worker command');
    self.postMessage({id,ok:true,value});
  }catch(error){self.postMessage({id,ok:false,error:error.message});}
};
