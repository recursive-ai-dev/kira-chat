'use strict';
// Merges the compiled theme packs into the conversation tables. Packs add openers, questions, answer
// cues and phrase questions; their vocabulary is consulted by the topic cue (see conversation.js).
(function(K){
  for(const [topic,pack] of Object.entries(K.THEME_PACKS||{})){
    const key='c:'+topic;
    if(pack.open.length)K.DIALOGUE.topics[key]=(K.DIALOGUE.topics[key]||[]).concat(pack.open);
    K.conversationQuestions[topic]=(K.conversationQuestions[topic]||[]).concat(pack.ask);
    K.conversationTailored[topic]=(K.conversationTailored[topic]||[]).concat(pack.cue.map(([source,question])=>[new RegExp(source,'i'),question]));
    K.conversationPhrases[topic]=(K.conversationPhrases[topic]||[]).concat(pack.phrase.map(template=>p=>template.split('{p}').join(p)));
  }
})(Kira);
