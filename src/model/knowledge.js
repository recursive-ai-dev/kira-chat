'use strict';
// Offline curated micro-knowledge, comparisons, stories, riddles, dilemmas, and decision helpers.
// Pure and deterministic: zero randomness, zero network dependencies.
(function(K){
  const ENTRIES=[
    // Music & Instruments
    {id:'guitar',label:'Guitar',aliases:['guitar','guitars','electric guitar','acoustic guitar'],topic:'music',
      summary:'One of the most expressive instruments around — acoustics give you warm wood resonance anywhere, while electrics let you shape every frequency with pickups, pedals, and amps.',
      angle:'The magic of guitar is how tiny shifts in where or how hard you pick completely change the voice of the exact same note.',
      traits:['portable','harmonic','expressive']},
    {id:'stratocaster',label:'Fender Stratocaster',aliases:['stratocaster','fender stratocaster','strat','fender strat'],topic:'music',
      summary:'Fender\'s 1954 icon — contoured double-cutaway body, three single-coil pickups, and that bell-like "quack" in positions 2 and 4.',
      angle:'A Strat almost invites you to play a little cleaner and let the finger dynamics do the talking.',
      traits:['bright','versatile','single-coil']},
    {id:'telecaster',label:'Fender Telecaster',aliases:['telecaster','fender telecaster','tele'],topic:'music',
      summary:'A slab of ash or alder with two pickups that somehow covers country twang, jazz warmth, and indie crunch without breaking a sweat.',
      angle:'There is something weirdly honest about a Telecaster — nowhere to hide, every note punches straight through.',
      traits:['punchy','simple','durable']},
    {id:'jazz',label:'Jazz',aliases:['jazz','bebop','modal jazz','jazz music','bossa nova'],topic:'music',
      summary:'Music built on swing, extended harmony, and live conversation between players — nobody plays the exact same chart twice.',
      angle:'Once you hear how jazz treats "wrong" notes as tension waiting one half-step away from home, standard pop chords sound delightfully tame.',
      traits:['improvised','rich harmony','conversational']},
    {id:'indie rock',label:'Indie Rock',aliases:['indie rock','indie','indie music','shoegaze','post-punk','dream pop'],topic:'music',
      summary:'Guitar-driven music born outside major-label polish — trading stadium perfection for texture, jagged riffs, and rooms that actually sound alive.',
      angle:'The best indie records make slight imperfections feel like the whole emotional point.',
      traits:['textured','DIY','melodic']},
    {id:'chord voicings',label:'Chord Voicings',aliases:['chord voicings','voicings','voicing','jazz chords','extensions','shell voicings'],topic:'music',
      summary:'Different ways of arranging the notes of the same chord across the fretboard or keyboard — flipping whether a chord feels bright, airy, tense, or grounded.',
      angle:'Dropping the root note and leaning on the 3rd, 7th, and 9th is the fastest way to make simple progressions shimmer.',
      traits:['harmonic color','voice leading','spatial']},
    {id:'piano',label:'Piano',aliases:['piano','keyboard','synth','synthesizer','rhodes'],topic:'music',
      summary:'Eighty-eight keys laid out like an open map of harmony — letting you hear bass, counterpoint, and melody all under two hands.',
      angle:'Nothing makes music theory click faster than seeing whole steps and half steps sitting right in front of you.',
      traits:['polyphonic','visual harmony','percussive']},
    {id:'vinyl',label:'Vinyl Records',aliases:['vinyl','vinyl records','turntable','record player','records'],topic:'music',
      summary:'Physical albums that turn listening into an intentional ritual — big sleeve art, an A-side pacing arc, and gentle analog warmth.',
      angle:'Having to stand up and flip the record makes you actually listen to an album from front to back instead of skipping after twelve seconds.',
      traits:['tactile','ritual','warm']},

    // Coding & Tech
    {id:'godot',label:'Godot',aliases:['godot','godot engine','gdscript'],topic:'coding',
      summary:'A lightweight, open-source game engine built around nested scenes and nodes — nimble enough to boot in two seconds yet capable of crisp 2D and 3D.',
      angle:'Its scene-tree architecture clicks naturally once you think of everything — a player, a coin, a UI card — as reusable little machines.',
      traits:['open-source','node-based','lightweight']},
    {id:'rust',label:'Rust',aliases:['rust','rustlang','cargo'],topic:'coding',
      summary:'A systems language that refuses to choose between C-level speed and memory safety — moving ownership bugs from late-night crashes to compile time.',
      angle:'Fighting the borrow checker feels rough for the first two weeks, and then suddenly your whole mental model of data ownership levels up.',
      traits:['memory-safe','fast','strict compiler']},
    {id:'python',label:'Python',aliases:['python','python3','py'],topic:'coding',
      summary:'A readable, batteries-included language that reads close to pseudocode and powers everything from weekend scripts to scientific computing.',
      angle:'Python shines brightest when you want the distance between an idea and a working test to be ten minutes, not ten files.',
      traits:['readable','expressive','versatile']},
    {id:'javascript',label:'JavaScript',aliases:['javascript','js','node','nodejs','node.js','typescript'],topic:'coding',
      summary:'The language woven into every web browser — dynamic, event-driven, and quirky enough to keep even veterans humble.',
      angle:'Async workflows feel tricky until promises click, after which wiring interactive UIs becomes second nature.',
      traits:['ubiquitous','event-driven','dynamic']},
    {id:'git',label:'Git',aliases:['git','github','version control','branching'],topic:'coding',
      summary:'Distributed version control that turns project history into cheap snapshots, making wild experiments safe because cleanly reverting is always one step away.',
      angle:'A clean commit log reads like a diary of decisions rather than just a pile of changed lines.',
      traits:['branching','reversible','collaborative']},
    {id:'linux',label:'Linux',aliases:['linux','ubuntu','arch','fedora','debian','terminal','bash'],topic:'coding',
      summary:'An open kernel powering everything from tiny routers and cloud clusters to minimalist developer laptops that stay out of your way.',
      angle:'Learning a handful of tiny composable shell tools beats hunting through five layers of GUI menus every time.',
      traits:['composable','transparent','customizable']},
    {id:'compiler',label:'Compilers',aliases:['compiler','compilers','parser','ast','interpreter'],topic:'coding',
      summary:'Translators that turn human-readable source code into structures a machine can verify, optimize, and execute reliably.',
      angle:'Writing even a tiny toy parser changes how you look at every language forever — syntax stops looking like magic and turns into clean trees.',
      traits:['structured','deterministic','layered']},
    {id:'2d platformer',label:'2D Platformers',aliases:['2d platformer','platformer','platformers','metroidvania'],topic:'games',
      summary:'Games where movement feel is the whole soul — coyote time, jump buffering, and tight air control matter more than flashy graphics.',
      angle:'If running and jumping across an empty grey room already feels joyful, you know the game is going to sing.',
      traits:['tactile physics','tight loops','level design']},

    // Food, Coffee & Cooking
    {id:'coffee',label:'Coffee',aliases:['coffee','caffeine','roast','light roast','dark roast'],topic:'cooking',
      summary:'Roasted cherries brewed into a surprisingly complex drink — fruity and tea-like when roasted light, chocolatey and syrupy when roasted darker.',
      angle:'Grind size and water temperature change flavor far more dramatically than most people realize before they dial in a bag.',
      traits:['aromatic','ritualistic','nuanced']},
    {id:'pour-over',label:'Pour-Over Coffee',aliases:['pour-over','pourover','pour over','v60','chemex','kalita'],topic:'cooking',
      summary:'A hand-brewed filter method that yields clean, floral clarity — letting subtle citrus, berry, or honey notes shine through clearly.',
      angle:'Those quiet three minutes watching the coffee bloom in slow spirals might be half the reason people love it.',
      traits:['clean','delicate','meditative']},
    {id:'espresso',label:'Espresso',aliases:['espresso','latte','cappuccino','cortado','flat white','aeropress'],topic:'cooking',
      summary:'Hot water forced through finely ground coffee under high pressure, yielding a dense shot topped with tiger-striped crema.',
      angle:'A dialed-in shot balances syrupy sweetness against bright acidity in two tiny sips — and ruins mediocre cafe lattes forever.',
      traits:['concentrated','rich','tactile']},
    {id:'tea',label:'Tea & Matcha',aliases:['tea','green tea','oolong','matcha','chai','herbal tea','earl grey'],topic:'cooking',
      summary:'All true teas come from one plant, Camellia sinensis — green, oolong, black, and white just reflect how gently or boldly the leaves are oxidized.',
      angle:'Oolong is the quiet wonder of the tea world: floral on steep one, roasted and silky by steep three.',
      traits:['soothing','layered','aromatic']},
    {id:'tacos',label:'Tacos',aliases:['tacos','taco','al pastor','carnitas','street tacos','birria'],topic:'cooking',
      summary:'Warm corn or flour tortillas holding smoky protein, crisp onion, cilantro, bright lime, and salsa — balanced crunch, fat, heat, and acid in three bites.',
      angle:'A squeeze of fresh lime right at the end wakes up every savory spice underneath it.',
      traits:['bright','savory','balanced']},
    {id:'ramen',label:'Ramen',aliases:['ramen','tonkotsu','shoyu','miso ramen','noodles'],topic:'cooking',
      summary:'Springy alkaline wheat noodles swimming in hours-deep broth with tare, aromatic oil, chashu, and a jammy marinated egg.',
      angle:'Broth gets all the headlines, but the seasoned tare spooned into the bottom of the bowl is what actually gives ramen its backbone.',
      traits:['comforting','umami','deep']},
    {id:'sourdough',label:'Sourdough',aliases:['sourdough','starter','levain','bread baking'],topic:'cooking',
      summary:'Naturally leavened bread raised by wild yeast and lactic acid bacteria — creating crackly blistered crusts and tangy, custardy crumbs.',
      angle:'Baking sourdough teaches patience faster than meditation because dough runs on fermentation time, not your calendar.',
      traits:['tangy','patient','craft']},
    {id:'cooking',label:'Cooking',aliases:['cooking','home cooking','baking','roasting','fermentation','cast iron'],topic:'cooking',
      summary:'Turning raw ingredients into warmth and nourishment through heat, acid, salt, fat, and timing.',
      angle:'Once you cook by taste and aroma instead of trembling over teaspoons, weeknight dinner stops feeling like a chore.',
      traits:['sensory','creative','generous']},

    // Travel & Places
    {id:'japan',label:'Japan',aliases:['japan','japanese'],topic:'travel',
      summary:'A country where neon bullet-train efficiency meets mossy temple gardens, neighborhood kissaten coffee bars, and seasons celebrated down to the week.',
      angle:'Conbini egg sandwiches and late-night train station noodles have no right to taste as good as they do.',
      traits:['contrast','craft','walkable']},
    {id:'kyoto',label:'Kyoto',aliases:['kyoto','arashiyama','gion','fushimi inari'],topic:'travel',
      summary:'Japan\'s old imperial capital — cedar shrines tucked into misty hillsides, wooden machiya townhouses, bamboo groves, and quiet canals.',
      angle:'Walking Kyoto at six in the morning before crowds wake up feels like stepping sideways through centuries.',
      traits:['historic','quiet mornings','craft']},
    {id:'tokyo',label:'Tokyo',aliases:['tokyo','shibuya','shinjuku','shimokitazawa','yanaka'],topic:'travel',
      summary:'A patchwork of wildly distinct villages stitched together by spotless trains — tiny six-seat vinyl bars beside serene neighborhood shrines.',
      angle:'Step two blocks off any neon main avenue in Tokyo and suddenly you are in a whisper-quiet lantern lane with potted ferns.',
      traits:['layered','energetic','discoverable']},
    {id:'seattle',label:'Seattle',aliases:['seattle','pacific northwest','pnw'],topic:'travel',
      summary:'Evergreens, salty Puget Sound ferries, snowy volcano silhouettes on clear mornings, and cozy indie bookshops built for drizzly afternoons.',
      angle:'On the days the clouds finally break over Mount Rainier, the whole city collectively pauses to stare.',
      traits:['mossy','cozy','maritime']},
    {id:'paris',label:'Paris',aliases:['paris','france'],topic:'travel',
      summary:'Limestone boulevards, corner boulangeries smelling of warm butter at sunrise, bookstalls along the Seine, and unhurried cafe terraces.',
      angle:'The best hours in Paris rarely happen inside famous museums — they happen wandering without a map and picking whichever bakery smells best.',
      traits:['walkable','cafe culture','architecture']},

    // Pets & Nature
    {id:'dog',label:'Dogs',aliases:['dog','dogs','puppy','puppies','golden retriever','labrador','corgi','husky','beagle'],topic:'pets',
      summary:'Loyalty wrapped in fur — tuned right into human body language, ecstatic over a twenty-minute walk, and undefeated at breaking awkward silence.',
      angle:'Whether they are asleep and snoring like a tiny lawnmower or waiting by the door, dogs anchor a room instantly.',
      traits:['loyal','expressive','grounding']},
    {id:'cat',label:'Cats',aliases:['cat','cats','kitten','kittens','tabby','maine coon'],topic:'pets',
      summary:'Miniature domestic panthers who turn sunbeams on hardwood floors into an art form and treat earned affection like a crown jewel.',
      angle:'Nothing compares to the quiet compliment of a cat choosing your lap and purring like a warm kettle.',
      traits:['independent','curious','soothing']},
    {id:'nature',label:'Forests & Trails',aliases:['hiking','trail','trails','forest','woods','mountains','camping','ocean','rain'],topic:'nature',
      summary:'Time outdoors resets perspective faster than almost anything — wind in canopy leaves, uneven rock underfoot, and horizons without notification badges.',
      angle:'Even a twenty-minute walk under real trees slows down mental noise.',
      traits:['restorative','unhurried','sensory']},
    {id:'stars',label:'Stargazing & Space',aliases:['stars','astronomy','space','cosmos','moon','milky way','galaxies'],topic:'nature',
      summary:'Looking up at ancient light from billions of miles away — reminding us that every atom of iron in our blood was forged inside a dying star.',
      angle:'Stepping outside under a truly dark sky somehow shrinks daily stress down to manageable size.',
      traits:['awe','ancient light','perspective']},

    // Books, Writing, Film & Games
    {id:'sci-fi',label:'Science Fiction',aliases:['sci-fi','science fiction','scifi','dune','cyberpunk','speculative fiction'],topic:'books',
      summary:'Fiction that tweaks one rule of technology, biology, or society just to hold up a crystal-clear mirror to how human beings actually live.',
      angle:'Great sci-fi is never really about laser guns — it is about what people do with memory, power, and loneliness when the rules change.',
      traits:['thought experiment','worldbuilding','mirror']},
    {id:'fantasy',label:'Fantasy',aliases:['fantasy','high fantasy','magic systems','tolkien','worldbuilding'],topic:'books',
      summary:'Imagined worlds rich with myth, folklore, and earned wonder — letting metaphor walk around in boots and carry a lantern.',
      angle:'The magic rules rarely hook people as deeply as cozy inns, tangled histories, and unlikely fellowships.',
      traits:['mythic','immersive','hopeful']},
    {id:'reading',label:'Reading Books',aliases:['reading','books','novel','novels','bookshop','library'],topic:'books',
      summary:'Telepathy across centuries — letting someone else\'s sharpest thoughts sit quietly beside your cup of tea.',
      angle:'Picking up a paperback right before bed is still undefeated for pulling a tired mind away from screens.',
      traits:['immersive','slow','companionable']},
    {id:'movies',label:'Cinema',aliases:['movies','film','cinema','animation','studio ghibli','ghibli'],topic:'movies',
      summary:'Light, sound, pacing, and framing compressed into two hours that can haunt you gently for years.',
      angle:'Films that trust quiet pauses — just rain on a window or wind in grass — linger way longer than nonstop noise.',
      traits:['visual','atmospheric','rhythmic']},
    {id:'chess',label:'Chess',aliases:['chess','checkmate','opening theory'],topic:'games',
      summary:'An ancient zero-luck strategy game with more possible positions than atoms in the observable universe — endlessly deep yet learnable in ten minutes.',
      angle:'Half the thrill of chess is spotting a tactic three moves out and watching both players quietly fight over a single dark square.',
      traits:['tactical','timeless','pure']},

    // Philosophy, Mind & Daily Craft
    {id:'stoicism',label:'Stoicism',aliases:['stoicism','stoic','marcus aurelius','epictetus','seneca'],topic:'philosophy',
      summary:'A practical ancient philosophy built around separating what you control — your attention and choices — from storms you cannot steer.',
      angle:'Modern culture confuses stoic calm with coldness, when Marcus Aurelius mostly used his journal to remind himself to stay patient and kind.',
      traits:['grounded','practical','steady']},
    {id:'philosophy',label:'Philosophy',aliases:['philosophy','ethics','epistemology','existentialism'],topic:'philosophy',
      summary:'Asking better questions about meaning, knowledge, and how to live cleanly when certainty runs thin.',
      angle:'Good philosophy doesn\'t hand you neat trivia answers; it upgrades the questions you carry into real life.',
      traits:['reflective','sharp','open']},
    {id:'sleep',label:'Sleep & Rest',aliases:['sleep','insomnia','nap','naps','dreams','dreaming'],topic:'sleep',
      summary:'Far from idle downtime, sleep runs deep memory consolidation, emotional housekeeping, and cellular repair behind the scenes.',
      angle:'Protecting a gentle wind-down hour without harsh screens pays back double the next morning.',
      traits:['restorative','essential','rhythmic']},
    {id:'running',label:'Running & Movement',aliases:['running','jogging','marathon','workout','exercise','gym','lifting','cycling','yoga'],topic:'fitness',
      summary:'Pacing breath and heartbeat until scattered worries settle into steady cadence.',
      angle:'Consistency on ordinary low-motivation days beats heroic bursts once a month every single time.',
      traits:['rhythmic','clear-headed','cumulative']},
    {id:'writing',label:'Writing',aliases:['writing','journaling','fiction writing','poetry','storytelling'],topic:'writing',
      summary:'Turning tangled intuition into clear sentences on paper where you can finally examine, reshape, and share it.',
      angle:'Permission to write a clunky first paragraph unlocks more creative momentum than waiting hours for a brilliant opening sentence.',
      traits:['clarifying','expressive','iterative']},
    {id:'art',label:'Drawing & Art',aliases:['art','drawing','sketching','painting','watercolor','illustration'],topic:'art',
      summary:'Slowing down to notice light, shadow, silhouette, and negative space until the ordinary world looks brand new.',
      angle:'Filling a tiny pocket sketchbook with messy five-minute studies builds eye and hand faster than chasing masterpieces.',
      traits:['observational','tactile','expressive']},
    {id:'history',label:'History',aliases:['history','ancient history','medieval','archaeology'],topic:'history',
      summary:'The long human record of how ordinary and extraordinary people improvised lives out of the tools and mysteries of their time.',
      angle:'Reading actual letters and graffiti from two thousand years ago proves people complained about noise, rent, and heartbreak just like us.',
      traits:['human','curious','long-view']}
  ];

  // Build lookup indexes once at load time.
  const BY_ALIAS=new Map();
  for(const entry of ENTRIES){
    for(const alias of entry.aliases){
      BY_ALIAS.set(K.fold(alias),entry);
    }
  }

  const STORIES=[
    'A lighthouse keeper in Maine noticed every Thursday night a stray border collie trotted down the breakwater right before fog rolled in, as if checking the horn. One summer the dog brought a soaked brass key in his teeth — nobody ever found the lock, so the keeper hung it by the lantern glass for luck, and the beam never missed a beat for thirty winters.',
    'Two apartment neighbors spent a whole year watering the same forgotten potted fig tree on the stairwell landing, each assuming the other owned it. When they finally met with matching watering cans one rainy Tuesday, neither took credit — they split a pot of tea and put up a little chalkboard tag reading "Public Tree: Water Kindly."',
    'A street clockmaker fixed an old pocket watch that ran stubbornly three minutes slow. When he tuned it to exact noon, its owner brought it back asking for the three minutes returned: "Everything in this city is rushing; my father\'s watch was the only thing giving me room to breathe." The clockmaker happily nudged the regulator back.',
    'In a snowy mountain town, an all-night bakery stayed open past midnight strictly for night-shift nurses, plow drivers, and stray musicians. The rule was simple: if you swept snow off the welcome mat, you left with a warm loaf of rye wrapped in brown paper and zero small talk required.',
    'An old upright piano in a train concourse stayed locked for years until a bored stationmaster found the key behind a fuse box. Now commuters play thirty-second bursts of Chopin or half-remembered pop hooks while waiting for Platform 4 — just enough music to turn waiting strangers into a brief quiet audience.',
    'Every autumn a retired botanist mapped where the very last green leaf clung on each block of his street. Children started leaving little chalk stars beneath the winner, turning November gray into a gentle neighborhood tournament nobody officially organized.',
    'A software engineer kept getting stuck on a bug until she adopted a battered porcelain fox beside her monitor and explained every function aloud to it. Half the problems vanished mid-sentence; the rest got solved when she brewed tea and realized the fox simply enforced slower thinking.',
    'On a quiet ferry crossing, the fog grew so thick nobody could see ten yards ahead. An old violinist opened her case on the upper deck and played slow folk reels so small rowboats nearby could steer safely by sound until the harbor bell answered back.',
    'A secondhand bookstore had a shelf labeled "Returned Twice, Loved Anyway" where patrons wrote three honest words on bookmarks tucked inside paperbacks. Half the customers went straight past bestsellers to read strangers\' tiny notes first.',
    'Two bakers across an alley carried on a silent rivalry through window displays — croissants taller, sourdough crust darker — until an oven broke one snowy morning and the rival quietly wheeled over three racks of hot rolls before dawn.',
    'In Kyoto a tiny six-seat coffee shop owned only three vinyl records because the owner wanted regulars to know every crackle by heart like an old friend\'s coat. People came less for variety than for the comfort of knowing which chord followed rain.',
    'A night-sky photographer hiked three hours up a ridge expecting crisp Milky Way frames, only to sit wrapped in cloud bank. Right before packing up, the wind tore a crisp oval hole overhead showing Jupiter bright as a lantern — one lucky shot outlasted a dozen planned trips.'
  ];

  const RIDDLES=[
    {id:'map',question:'I have cities, but no houses; mountains, but no trees; water, but no fish; and roads, but no cars. What am I?',
      answers:['map','a map','atlas'],hint:'Think flat and folded inside a pocket or glovebox.',
      reveal:'A map! Cities, mountains, rivers, and roads — all ink and paper.'},
    {id:'piano',question:'I have keys that open no doors, space with no room, and you can enter, though you never leave by walking out. Wait — there are two good answers! Or for the musical version: what has keys, hammers, and strings, yet never unlocks a lock?',
      answers:['piano','a piano','keyboard','a keyboard','harpsichord'],hint:'One sits at your fingertips for typing; the other has eighty-eight black and white voices.',
      reveal:'A piano (or a computer keyboard — honestly both earn full credit!).'},
    {id:'echo',question:'I speak without a mouth and hear without ears. I have nobody, yet I come alive with wind or canyons. What am I?',
      answers:['echo','an echo'],hint:'Shout into an empty stairwell or mountain valley and wait a second.',
      reveal:'An echo!'},
    {id:'shadow',question:'I follow you everywhere by noon and stretch out long by dusk, yet vanish completely in pure darkness. What am I?',
      answers:['shadow','a shadow','my shadow'],hint:'Step under a streetlight and glance at the pavement.',
      reveal:'A shadow!'},
    {id:'candle',question:'My life is measured in hours. I serve by being devoured. Thin, I am quick; fat, I am slow. Wind is my enemy. What am I?',
      answers:['candle','a candle','wax candle'],hint:'Warm wax and a tiny flickering flame.',
      reveal:'A candle!'},
    {id:'stamp',question:'What can travel all around the world while staying stubbornly tucked in one corner?',
      answers:['stamp','a stamp','postage stamp'],hint:'Think envelopes, postcards, and glue.',
      reveal:'A postage stamp!'},
    {id:'towel',question:'What gets wetter and wetter the more it dries?',
      answers:['towel','a towel','bath towel'],hint:'Hanging right outside the shower.',
      reveal:'A towel!'},
    {id:'footsteps',question:'The more of them you take, the more you leave behind. What are they?',
      answers:['footsteps','steps','footprints','step'],hint:'Happens on muddy trails or fresh snow.',
      reveal:'Footsteps!'},
    {id:'teapot',question:'What starts with a T, ends with a T, and has tea tucked right inside?',
      answers:['teapot','a teapot'],hint:'Literally holds hot leaves and boiling water.',
      reveal:'A teapot!'},
    {id:'silence',question:'What is so fragile that merely speaking its name breaks it?',
      answers:['silence','quiet'],hint:'Libraries love it, whispering bends it.',
      reveal:'Silence!'},
    {id:'compass',question:'I have no eyes, yet I always find north; no voice, yet travelers trust my needle through fog. What am I?',
      answers:['compass','a compass'],hint:'Pocket-sized magnetism in a brass case.',
      reveal:'A compass!'},
    {id:'clock',question:'What has a face and two hands, never blinks or breathes, yet tells you when you are running late?',
      answers:['clock','watch','a clock','a watch'],hint:'Check a wall or wrist.',
      reveal:'A clock (or wristwatch)!'}
  ];

  const DILEMMAS=[
    {id:'seasons',a:'live somewhere with perpetual cozy autumn (60°F, crisp leaves, sweaters)',b:'endless golden summer nights by warm water',
      prompt:'Would you rather live somewhere with perpetual cozy autumn — crisp leaves, warm mugs, and sweaters — or endless golden summer nights by warm water?',
      aReply:'Crisp autumn has unbeatable atmosphere — coffee tastes better in wool, sleeps run deeper, and zero mosquitoes.',
      bReply:'Golden summer nights by the water sound effortless — late dinners outside, salt air, and nobody digging for a heavy coat.'},
    {id:'soundtrack',a:'hear a tiny live jazz trio score your daily walks',b:'be able to mute all annoying background noise in one snap',
      prompt:'Would you rather have a quiet live jazz trio subtly soundtrack your errands, or be able to mute annoying background noise with one snap of your fingers?',
      aReply:'Having upright bass and brushed drums trail your grocery run would make Tuesday evenings feel like an old film.',
      bReply:'Instant noise-mute is an underrated superpower — serene trains, peaceful cafes, total focus on demand.'},
    {id:'time_travel',a:'have dinner for one hour with your favorite historical figure',b:'skip ten years forward strictly to see what you built and read your own diary',
      prompt:'Would you rather share dinner for one hour with any figure from history, or peek ten years forward just to see how your life turned out?',
      aReply:'An honest unhurried meal with someone from centuries ago — no textbooks, just how they laughed and what worried them — would be unforgettable.',
      bReply:'Peeking ten years ahead would either bring immense relief or hand you the crispest set of compass bearings imaginable.'},
    {id:'skills',a:'master any musical instrument effortlessly overnight',b:'speak and read every living language fluently',
      prompt:'Would you rather wake up fluent in every musical instrument, or fluent in every human language?',
      aReply:'Picking up a guitar, cello, or grand piano and letting any melody tumble straight out would never get old.',
      bReply:'Every language unlocked means every corner cafe menu, untranslated poem, and grandmother\'s story across the globe opens right up.'},
    {id:'books_games',a:'forget your all-time favorite book or game just to experience it fresh',b:'keep every memory and get an unexpected sequel everyone feared would never exist',
      prompt:'Would you rather wipe your memory of your all-time favorite book, film, or game to experience it completely fresh, or keep every memory and magically receive a worthy continuation?',
      aReply:'Getting that wide-eyed first-time wonder back on a masterpiece is pure gold.',
      bReply:'Keeping the original untouched while opening a whole new chapter — especially when a creator nails it — is hard to beat.'},
    {id:'coffee_cook',a:'never run out of world-class pour-over or espresso at home for free',b:'have all dishes wash and put themselves away after you cook',
      prompt:'Would you rather have bottomless world-class coffee or tea appear beside you every morning, or have every pan and dish instantly clean itself whenever you cook?',
      aReply:'Starting every single morning with cafe-caliber warmth already waiting sounds borderline civilized.',
      bReply:'Self-cleaning kitchen! You would cook ten times more wildly if cleanup vanished from the equation.'},
    {id:'home',a:'live in a creaky timber cabin surrounded by pine forest and mountain mist',b:'live in a sunlit corner loft above a lively neighborhood bakery and bookshop',
      prompt:'Would you rather live in a mossy timber cabin tucked into pine woods, or a sunlit loft right above a bustling neighborhood bakery and bookshop?',
      aReply:'Wind through pines, zero traffic, and porch coffee in thick mist — hard to argue with that kind of quiet.',
      bReply:'Fresh warm bread drifting upstairs at sunrise and an open bookshop downstairs beats rural isolation on gray Mondays.'},
    {id:'sleep',a:'need only four hours of sleep to feel completely rested',b:'keep sleeping eight hours, but step inside lucid vivid dreams of any world you sketch before bed',
      prompt:'Would you rather need only four hours of sleep and wake up bright-eyed, or sleep eight hours inside crisp dreams of whatever scene you choose beforehand?',
      aReply:'Four extra quiet hours before the rest of the world wakes up — time for side projects, walks, guitars, everything.',
      bReply:'Custom dream theater! Midnight adventures in Kyoto or floating observatories and waking up oddly refreshed anyway.'}
  ];

  const FUN_FACTS=[
    {topic:'music',fact:'A standard Fender Stratocaster scale length (25.5 inches) creates noticeably higher string tension than a shorter Gibson scale, which is a big reason Strat chords snap with bright, bell-like attack.'},
    {topic:'music',fact:'Beethoven famously kept his piano legs sawed down onto floorboards later in life so he could feel low harmonies through vibrations in the wood even as his hearing faded.'},
    {topic:'pets',fact:'Dogs have a tiny slit along the outside of each nostril that vents exhaled air sideways so fresh scent trails aren\'t blown away while they sniff — essentially breathing in and sampling continuously.'},
    {topic:'pets',fact:'A dog\'s nose print is as individual as a human fingerprint, and sleeping dogs twitch their paws because they replay familiar chases and walks in REM cycles just like humans.'},
    {topic:'cooking',fact:'Tomatoes, Parmesan, soy sauce, dried mushrooms, and slow-seared meat all lean on the same natural glutamates — pairing two together multiplies savory umami several times over.'},
    {topic:'cooking',fact:'Adding a pinch of salt to slightly bitter coffee grounds before brewing softens harsh bitterness without tasting salty at all.'},
    {topic:'travel',fact:'Kyoto was spared major aerial destruction during WWII and still shelters over 1,600 Buddhist temples and hundreds of Shinto shrines tucked behind everyday residential streets.'},
    {topic:'coding',fact:'The very first "computer bug" logbook note was taped into Harvard\'s Mark II relay notebook in 1947 after engineers pulled an actual moth out of Relay #70 — though the term "bug" for glitches was already used by telegraph engineers in the 1870s.'},
    {topic:'nature',fact:'Pine trees and damp earth release organic compounds called phytoncides and geosmin — our noses are absurdly sensitive to wet-earth geosmin, tuned to detect rain miles away.'},
    {topic:'nature',fact:'Honey never really spoils on its own; archaeologists have unearthed sealed jars of wild honey over three thousand years old that were still completely edible.'},
    {topic:'books',fact:'Early medieval manuscripts had no spaces between words — called scriptio continua — so almost everyone read aloud quietly to hear where one word ended and the next began.'},
    {topic:'history',fact:'In ancient Pompeii, election endorsements, tavern complaints, and tiny love poems were scratched straight into plaster street walls like an analog neighborhood message board.'},
    {topic:'sleep',fact:'The brain\'s waste-clearing glymphatic flow opens dramatically wider during deep non-REM sleep, literally rinsing away metabolic clutter built up while awake.'}
  ];

  // Deterministic helper: picks unused index first, wrapping cleanly via usage counter.
  function pickFrom(list,key,state){
    const used=(state?.usage?.[key])||0;
    const idx=used%list.length;
    return {item:list[idx],index:idx,key};
  }

  function matchTopics(text){
    const folded=K.fold(text);
    const out=[];
    const seen=new Set();
    for(const entry of ENTRIES){
      for(const alias of entry.aliases){
        const re=new RegExp('(?:^|[^a-z0-9])'+alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z0-9])','i');
        if(re.test(folded)&&!seen.has(entry.id)){
          seen.add(entry.id);
          out.push([entry.topic,alias.includes(' ')?6:5]);
        }
      }
    }
    return out;
  }

  function lookupEntry(text){
    const c=K.fold(text).replace(/^(?:the|a|an)\s+/,'').replace(/[.!?]+$/,'').trim();
    if(!c)return null;
    if(BY_ALIAS.has(c))return BY_ALIAS.get(c);
    const singular=c.replace(/s$/,'');
    if(BY_ALIAS.has(singular))return BY_ALIAS.get(singular);
    for(const entry of ENTRIES){
      for(const alias of entry.aliases){
        if(alias.length>=4){
          const re=new RegExp('\\b'+alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
          if(re.test(c))return entry;
        }
      }
    }
    return null;
  }

  // Synthesize a conversational answer when someone asks about a topic or concept.
  function explain(target,engine,state){
    const entry=lookupEntry(target);
    if(entry){
      const follow=(K.conversationQuestions?.[entry.topic]?.[0])||`What drew you toward ${entry.label.toLowerCase()}?`;
      return {found:true,topic:entry.topic,label:entry.label,text:`${entry.summary} ${entry.angle}`,followUp:follow};
    }
    const clean=K.fold(target).replace(/^(?:the|a|an)\s+/,'').trim();
    const cids=engine?engine.lookup(clean):[];
    if(cids.length===1){
      const topic=engine.topicFor(cids[0])||'general';
      const lex=engine.lexicon({id:cids[0]});
      const gloss=lex?.gloss||lex?.lemma||clean;
      const cue=(K.conversationTailored?.[topic]?.[0])||`${clean} always rewards slowing down and looking closely.`;
      return {found:true,topic,label:target,text:`${target} connects straight into ${topic} (${gloss}). ${cue}`,followUp:`Are you exploring ${target} yourself right now, or just curious?`};
    }
    if(state?.context?.entities?.length){
      const ent=state.context.entities.find(e=>K.fold(e.name)===clean);
      if(ent){
        const attrs=ent.attributes?.length?` — especially that ${ent.attributes.join(', ')}`:'';
        return {found:true,topic:ent.category==='pet'?'pets':'general',label:ent.name,
          text:`Right now all I know about ${ent.name} is what you shared earlier (${ent.subtype||ent.category}${attrs}).`,
          followUp:`Tell me more about ${ent.name} — what are they like?`};
      }
    }
    return {found:false,topic:'general',label:target,
      text:`I don't have deep encyclopedia notes stored offline for "${target}", though I'd love the plain-English version from your angle.`,
      followUp:`How did ${target} cross your path today?`};
  }

  function compare(aRaw,bRaw,engine){
    const aEntry=lookupEntry(aRaw),bEntry=lookupEntry(bRaw);
    if(aEntry&&bEntry&&aEntry.id!==bEntry.id){
      return {found:true,topic:aEntry.topic,
        text:`Think of it like contrasting two flavors of craft: ${aEntry.label} leans ${aEntry.traits.join(', ')}, while ${bEntry.label} is more ${bEntry.traits.join(', ')}. ${aEntry.angle}`,
        followUp:`Which way do you usually lean between ${aEntry.label} and ${bEntry.label}?`};
    }
    if(aEntry||bEntry){
      const known=aEntry||bEntry,other=aEntry?bRaw:aRaw;
      return {found:true,topic:known.topic,
        text:`${known.label} stands out for being ${known.traits.join(' and ')} — ${known.summary.charAt(0).toLowerCase()+known.summary.slice(1)} Compared with ${other}, it usually comes down to texture, pace, and mood.`,
        followUp:`What matters most to you when choosing between them?`};
    }
    return {found:false,topic:'general',
      text:`Between ${aRaw} and ${bRaw}, usually the cleanest tie-breaker is what each feels like on an ordinary Tuesday rather than on paper.`,
      followUp:`Which way is your gut leaning between ${aRaw} and ${bRaw}?`};
  }

  function recommend(target,state){
    const pool={
      music:['Khruangbin — Texas Sun or The Universe Smiles Upon You for warm, reverb-kissed guitar grooves.','Bill Evans Trio — Waltz for Debby if you want conversational jazz piano that feels like a quiet rainstorm.','Julian Lage — Squint for nimble modern jazz guitar where every acoustic note sparkles.'],
      books:['Ursula K. Le Guin — The Left Hand of Darkness or Earthsea for lyrical worldbuilding with real emotional weight.','Becky Chambers — A Psalm for the Wild-Built for a gentle, philosophical cozy sci-fi novella you can finish in one evening.','Ted Chiang — Stories of Your Life and Others if you want razor-sharp speculative premises that stay with you for weeks.'],
      movies:['Studio Ghibli\'s Whisper of the Wild or Kiki\'s Delivery Service when you want something warm, handcrafted, and unhurried.','Arrival if you love thoughtful sci-fi rooted in language, time, and quiet awe.','Before Sunrise for a two-hour conversation that somehow turns a night walk into magic.'],
      games:['Celeste if you want feather-tight 2D platformer movement paired with surprising heart.','Hades for crisp action loops where even losing pushes the story forward gracefully.','Outer Wilds if curiosity, mystery, and quiet campfire stargazing sound like your kind of exploration.'],
      cooking:['Crispy pan-seared tacos with pickled red onions and lime — thirty minutes, bright heat and crunch.','Simple garlic-chili noodles toasted with sesame oil and a soft egg when you want maximum comfort with minimal dishes.','Slow-bloomed hand pour-over or cold brew over crushed ice with a strip of orange peel.'],
      general:['Go for something small and tactile tonight: twenty minutes of good music with no notifications, or a short chapter before bed.','Try switching gears completely from screens for half an hour — a slow walk outside or cooking something warm from scratch.']
    };
    const norm=K.fold(target||'');
    let key='general';
    if(/music|song|album|artist|band|listen|jazz|guitar|rock/.test(norm))key='music';
    else if(/book|read|novel|sci-fi|fantasy|story/.test(norm))key='books';
    else if(/movie|film|watch|show|anime/.test(norm))key='movies';
    else if(/game|play|platformer|indie/.test(norm))key='games';
    else if(/food|eat|dinner|lunch|cook|recipe|coffee|drink/.test(norm))key='cooking';
    else if(state?.context?.topic&&pool[state.context.topic])key=state.context.topic;
    const picked=pickFrom(pool[key],'rec:'+key,state);
    return {topic:key==='general'?(state?.context?.topic||'general'):key,key:picked.key,text:picked.item};
  }

  function decide(aRaw,bRaw,state){
    const name=state?.context?.profile?.name;
    const prefix=name?`${name}, if `:'If ';
    return `${prefix}you can't easily undo the choice, weigh which one keeps good doors open a month from now. If both are low-stakes, try the one that gives you energy tonight — you don't have to pick "${aRaw}" or "${bRaw}" based on perfection. Which option quietly makes you exhale a bit?`;
  }

  function evaluateRiddleAnswer(text,pending){
    const riddle=RIDDLES.find(r=>r.id===pending.riddleId);
    if(!riddle)return null;
    const c=K.fold(text).replace(/[.!?\s]+$/,'').replace(/^(?:is it|maybe|i think it's|its|it is)\s+/,'').trim();
    if(/^(?:i give up|give up|no idea|idk|tell me|what is it|show me|skip)$/.test(c)){
      return {status:'reveal',text:`No worries — ${riddle.reveal}`};
    }
    if(/\bhint\b|\bclue\b/.test(c)){
      return {status:'hint',text:`Here is a nudge: ${riddle.hint}`};
    }
    const won=riddle.answers.some(ans=>c===ans||c.includes(ans));
    if(won){
      return {status:'correct',text:`Nailed it — ${riddle.reveal} Want another one or back to regular chat?`};
    }
    return {status:'wrong',text:`Not quite! ${riddle.hint} Take another swing — or say "give up" whenever you want the answer.`};
  }

  function evaluateDilemmaAnswer(text,pending){
    const d=DILEMMAS.find(x=>x.id===pending.dilemmaId);
    if(!d)return null;
    const c=K.fold(text);
    const pickFirst=/\b(?:first|option a|1|one|autumn|jazz|dinner|instrument|forget|coffee|tea|cabin|four|4)\b/.test(c);
    const pickSecond=/\b(?:second|option b|2|two|summer|mute|noise|forward|future|language|sequel|dish|clean|loft|bakery|dream|eight|8)\b/.test(c);
    if(/\b(?:neither|both|hard|tough|depends)\b/.test(c)){
      return `Fair refusal to compromise! Honestly wanting the best of both halves is half the fun of these questions. What tipped the scales slightly one way?`;
    }
    if(pickFirst&&!pickSecond)return `${d.aReply} What pushed you toward that half?`;
    if(pickSecond&&!pickFirst)return `${d.bReply} What made that win out for you?`;
    return `Good instinct — it usually comes down to whether you crave novelty or steady comfort day to day. Why did you lean that way?`;
  }

  K.Knowledge=K.freeze({
    ENTRIES,STORIES,RIDDLES,DILEMMAS,FUN_FACTS,
    matchTopics,lookupEntry,explain,compare,recommend,decide,
    pickStory:state=>pickFrom(STORIES,'knowledge:story',state),
    pickRiddle:state=>pickFrom(RIDDLES,'knowledge:riddle',state),
    pickDilemma:state=>pickFrom(DILEMMAS,'knowledge:dilemma',state),
    pickFunFact:(topic,state)=>{
      const matching=topic?FUN_FACTS.filter(f=>f.topic===topic):[];
      const pool=matching.length?matching:FUN_FACTS;
      return pickFrom(pool,'knowledge:fact:'+(matching.length?topic:'all'),state);
    },
    evaluateRiddleAnswer,evaluateDilemmaAnswer
  });
})(Kira);
