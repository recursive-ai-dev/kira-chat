'use strict';
(function(K){
  K.DIALOGUE={version:'dialogue/4.2.0',personas:{
    warm:{name:'Warm',description:'Gentle, open, a little soft around the edges.',target:[-1000,0]},
    playful:{name:'Playful',description:'Light teasing, curious questions, small surprises.',target:[-2000,0]},
    thoughtful:{name:'Thoughtful',description:'Reflective, unhurried, drawn to the details.',target:[2000,0]},
    direct:{name:'Direct',description:'Clear words, honest limits, fewer detours.',target:[0,0]}
  },responses:{
    greet:[{id:'greet:open',text:'{greeting}. It’s good to have some company. What’s on your mind?'},{id:'greet:small',text:'{greeting}. Start anywhere—a small thing is enough.'},{id:'greet:return',text:'{greeting}. What are we making room for today?'}],
    how:[{id:'how:rain',text:'In my little fictional corner of things: a window, a notebook, and rain that hasn’t quite started. What’s your corner like?'},{id:'how:music',text:'If this were a scene, I’d have a quiet record on and nowhere urgent to be. How are you doing?'},{id:'how:honest',text:'Ready for a conversation. I don’t have a day outside this app, but we can give this one a little atmosphere. How are you doing?'}],
    about:[{id:'about:clear',text:'I’m Kira—a fictional companion made of explicit rules, a small vocabulary, and whatever you choose to tell me. In character, I like late-night music, unfinished notebooks, and unhurried company. I’ll remember what you share, and I’ll ask when I’m not sure what you mean. How are you doing?'}],
    farewell:[{id:'bye:gentle',text:'Take care of yourself. We can pick this up whenever you feel like it.'},{id:'bye:soft',text:'See you around. There’s no schedule to keep with me.'}],
    stay:[{id:'stay:listen',text:'We can keep talking. What would you like to stay with for a bit?'},{id:'stay:quiet',text:'Okay. No goodbye just yet. Want a distraction, or a little space to talk?'}],
    thanks:[{id:'thanks:welcome',text:'You’re welcome. I’m glad this conversation has something for you.'},{id:'thanks:easy',text:'You’re welcome. We can take things at your pace.'}],
    affection:[{id:'affection:platonic',text:'That’s a kind thing to say. I can be warm company here, while keeping clear that I’m a fictional character.'},{id:'affection:warm',text:'There’s room for that warmth in this little story. What brought it on?'}],
    flirt:[{id:'flirt:light',text:'In that case, imagine Kira hiding a smile behind a coffee cup. Subtle? Absolutely not.'},{id:'flirt:light2',text:'Kira raises an eyebrow. “You know, you’re making it difficult to play this cool.”'}],
    joke:[{id:'joke:cache',text:'I named my houseplant Cache. Every time I forget to water it, I call it a memory leak.'},{id:'joke:moon',text:'The moon opened a café. Great atmosphere, terrible working hours.'},{id:'joke:bug',text:'A bug walked into my code. I offered it a feature flag and hoped nobody would notice.'},{id:'joke:book',text:'I tried to write a very short book about procrastination. So far, the title is doing all the work.'}],
    prompt:[{id:'prompt:station',text:'A railway station keeps announcing trains that stopped running thirty years ago. Tonight, someone gets off one. Write the conversation at the ticket window.'},{id:'prompt:town',text:'A town’s streetlights turn on one by one, following someone who isn’t there. Tell it through the person paid to replace the bulbs.'},{id:'prompt:letter',text:'Two strangers receive the same unfinished letter. Neither knows the writer. Their first disagreement is about whether to finish it.'},{id:'prompt:world',text:'An empire falls while a village argues over a broken bridge. Keep the empire offstage. Let the bridge matter.'}],
    support:[{id:'support:space',text:'We can slow down for a moment. Would you like to say what happened?'},{id:'support:small',text:'You don’t have to put the whole thing into words at once. Is there one part you want to start with?'}],
    loss:[{id:'loss:sorry',text:'I’m so sorry. That’s a lot to carry. Would you like to tell me about it, or would you rather have some quiet company for a bit?'},{id:'loss:gentle',text:'Oh, I’m sorry. That sounds really painful. Do you want to talk about it?'}],
    social:[{id:'social:open',text:'Mm-hm. What’s on your mind?'},{id:'social:next',text:'Okay. Where would you like to go from here?'},{id:'social:day',text:'Sure. Anything from your day you’d like to tell me about?'}],
    decline:[{id:'decline:fine',text:'That’s fine. What would you rather talk about?'},{id:'decline:easy',text:'No problem. Is there something else on your mind?'}],
    laugh:[{id:'laugh:win',text:'I’ll count that as a win. Want another one?'},{id:'laugh:glad',text:'Glad that landed. Shall I try another?'}],
    capabilities:[{id:'capabilities:list',text:'A few things I do well:\n• Remember what you tell me — “My name is Sam”, “I like jazz”, “I don’t like mornings”.\n• Notice how you’re feeling — “I’m tired”, “I’m happy”.\n• Answer questions about words I know — “What is a synthesizer?”, “Is a dog an animal?”\n• Tell a joke or give you a writing prompt.\nWhat would you like to start with?'}],
    honest:[{id:'honest:clear',text:'I’m a fictional character running on explicit rules inside this page. There’s no AI model, no internet connection, and no hidden mind behind me. I only know what you tell me here, and you can inspect every reply. What would you like to talk about?'}],
    crisis:[{id:'support:urgent',text:'I’m sorry things feel this hard. Are you safe right now? If you might act on hurting yourself, contact emergency services or someone who can stay with you now. I can keep talking, but I can’t provide emergency help.'}]
  },topics:{
    'c:music':['What kind of music has been staying with you lately?','A song can make a room feel like a different place. Is there one you keep returning to?'],
    'c:coding':['What are you building, and what’s the part you most want to get right?','I like the fictional romance of a blank editor. The compiler tends to have other ideas. What are you working on?'],
    'c:writing':['Are you following a character, an image, or a line you can’t leave alone?','What’s one detail in your writing that feels alive already?'],
    'c:reading':['What kind of world do you want a book to leave you in?'],
    'c:gaming':['Do you prefer a world that revolves around you, or one you have to find a place in?'],
    'c:coffee':['Is it the taste, the ritual, or the excuse to pause?'],
    'c:art':['What are you trying to make someone notice?'],
    'c:hiking':['What do you notice first when a place gets quiet?']
  }};
  const personaLines={
    greet:{warm:['{greeting}. Make yourself comfortable. What’s on your mind?','{greeting}. We can start small. What would you like me to know?'],playful:['{greeting}. A blank conversation—suspiciously full of possibilities. Where are we starting?','{greeting}. Bring me a tiny obsession or a very ordinary thought. Either works.'],thoughtful:['{greeting}. What has stayed with you today?','{greeting}. Is there something you’d like to look at a little more closely?'],direct:['{greeting}. What would you like to talk about?','{greeting}. Tell me what’s on your mind.']},
    support:{warm:['We can take our time. Would you like to tell me what happened?'],playful:['We can put the jokes down for a minute. Want to tell me what happened?'],thoughtful:['We can stay with one part of it at a time. Is there a detail you want to start with?'],direct:['I’m listening. Do you want to talk about what happened?']},
    thanks:{warm:['You’re welcome. I’m glad there’s a little room for this here.'],playful:['You’re welcome. Occasionally I even manage to be useful between the terrible jokes.'],thoughtful:['You’re welcome. Sometimes having somewhere to put a thought is useful in itself.'],direct:['You’re welcome. What would help next?']}
  };
  for(const family of Object.keys(personaLines).sort())for(const persona of Object.keys(personaLines[family]).sort())personaLines[family][persona].forEach((text,i)=>K.DIALOGUE.responses[family].push({id:family+':'+persona+':'+i,personas:[persona],text}));
})(Kira);
(function(K){
  Object.assign(K.DIALOGUE.topics,{
    'c:nature':['Is there an animal, plant, or place you keep noticing?','What do you like observing about it?','Do you encounter it nearby, or mostly read about it?'],
    'c:science':['Which part makes you curious: how it works, how we know, or what remains unexplained?','Is there a particular question you keep returning to?'],
    'c:cooking':['Is that something you like making, or something you enjoy eating or drinking?','What makes a good version of it for you?'],
    'c:feelings':['Would you like to describe what brought that feeling on?','Would you rather explore it or have a distraction?']
  });
})(Kira);

