'use strict';
// Variable slots in reply templates.
//
//   ⟦like most|enjoy most|find best⟧   inline pool: one alternative is chosen
//   ⟦@remember⟧                         named pool from K.DIALOGUE.pools (optionally per persona)
//
// Choices look random but are a pure function of the event (sequence, time, text) and the slot, so a
// replayed conversation produces identical replies. A slot never repeats its previous choice, and
// the last choice lives in state.usage so it replays too. Alternatives must not contain . ! ? or |.
(function(K){
  K.DIALOGUE.pools={
    // A short acknowledgement that stands alone, e.g. “Got it.”
    ack:{
      default:['Okay','Got it','Mm, okay','Right','I see','Understood'],
      direct:['Understood','Noted','Got it','Okay'],
      warm:['I hear you','Mm, okay','Got it','Okay','Thank you for that'],
      playful:['Ooh, okay','Right','Got it','Okay then','Noted with great ceremony'],
      thoughtful:['I see','Mm, okay','That makes sense','Understood','Right']
    },
    // Fits mid-sentence: “… — noted.”
    noted:{default:['noted','understood','got it','I’ve got that','taken in']},
    remember:{
      default:['I’ll remember that','I’ll keep that in mind','Noted—I’ll hold on to that','I’ll hang on to that'],
      direct:['Noted','Saved','I’ll remember that'],
      playful:['I’ll tuck that away','Filed under “important”','I’ll remember that']
    },
    updated:{default:['I’ve updated that','Okay, I’ve changed that','Got it—I’ve corrected that','Updated that for you']},
    saved:{default:['I have that saved already','I already have that','That’s already saved','Yes, I’ve got that one']},
    sharing:{default:['sharing that','telling me that','letting me know','putting that into words']},
    interest:{default:['got you interested in','first drew you to','started your interest in']}
  };
  const SLOT=/⟦([^⟦⟧]+)⟧/g;
  function choose(alternatives,seed,key,occurrence,memory,phase){
    if(alternatives.length===1)return alternatives[0];
    const memoryKey='slot:'+K.sha256(key).slice(0,12),last=memory[memoryKey];
    const h=parseInt(K.sha256(seed+'|'+key+'|'+occurrence).slice(0,8),16);
    let index=h%alternatives.length;
    if(phase!==undefined){
      // Wording follows the conversation's position in the ring field: the slot's own offset plus the
      // field phase picks the alternative, so it drifts with the conversation instead of jumping.
      const slot=parseInt(K.sha256(key).slice(0,4),16)/65536,v=phase+slot+occurrence*0.2360679775;
      index=Math.floor((v-Math.floor(v))*alternatives.length);
      if(index===last)return alternatives[memory[memoryKey]=(index+1)%alternatives.length];
      memory[memoryKey]=index;return alternatives[index];
    }
    // Move off the previous choice by a hash-chosen offset, so the replacement is varied too.
    if(index===last)index=(index+1+Math.floor(h/alternatives.length)%(alternatives.length-1))%alternatives.length;
    memory[memoryKey]=index;
    return alternatives[index];
  }
  K.expandVariants=(text,{seed,usage,persona,phase,replacements})=>{
    let occurrence=0;
    return text.replace(SLOT,(match,body,offset)=>{
      let alternatives;
      if(body.startsWith('@')){
        const pool=K.DIALOGUE.pools[body.slice(1)];
        K.assert(pool,'Unknown variation pool '+body);
        alternatives=pool[persona]||pool.default;
      }else alternatives=body.split('|');
      const picked=choose(alternatives,seed,body,occurrence++,usage,phase);
      // Capitalise when the slot opens a sentence.
      const rendered=/(?:^|[.!?]\s+|\n\s*)[“"‘'(\[]*$/.test(text.slice(0,offset))?picked[0].toUpperCase()+picked.slice(1):picked;
      if(replacements)replacements.push({start:offset,end:offset+match.length,text:rendered});
      return rendered;
    });
  };
  // User text may not contain slot brackets, so nobody can inject one into a reply.
  K.stripVariantMarks=s=>s.replace(/[⟦⟧]/g,'');
})(Kira);
