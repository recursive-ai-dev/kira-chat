'use strict';
const fs = require('node:fs');
const path = require('node:path');
const K = require('../KiraSDK.js');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'station.json'), 'utf8'));
const compiled = K.Narrative.compile(source);
const world = new K.Narrative.WorldModel(compiled);
let state = world.initialState();
const events = [];
function step(input) {
  const event = {seq: events.length + 1, time: events.length, ...input};
  const result = world.step(state, event);
  events.push(event); state = result.state;
  if (result.reply) console.log(result.reply.actor + ': ' + result.reply.text);
  return result;
}
step({type: 'message', actor: 'keeper', speaker: 'traveller', text: 'Hello'});
step({type: 'message', actor: 'porter', speaker: 'traveller', text: 'Hello'});
// Only Mara sees the signal change. Ivo does not acquire omniscient knowledge.
step({type: 'world', fact: 'signal_red', value: true, witnesses: ['keeper']});
step({type: 'message', actor: 'porter', speaker: 'traveller', text: 'What about the signal?'});
step({type: 'message', actor: 'keeper', speaker: 'traveller', text: 'What about the signal?'});
step({type: 'tell', from: 'keeper', to: ['porter'], fact: 'signal_red'});
const heard = step({type: 'message', actor: 'porter', speaker: 'traveller', text: 'What about the signal?'});
console.log('  Source:', JSON.stringify(heard.reply.evidence));
step({type: 'message', actor: 'keeper', speaker: 'traveller', text: 'I like coffee'});
step({type: 'message', actor: 'porter', speaker: 'traveller', text: 'What do you remember about me?'});
step({type: 'message', actor: 'keeper', speaker: 'traveller', text: 'What do you remember about me?'});
step({type: 'initiate', actor: 'keeper', speaker: 'traveller'});
step({type: 'world', fact: 'train_arrived', value: true, witnesses: ['keeper', 'porter']});
console.log('Active keeper goals:', world.activeGoals(state, 'keeper'));
const saved = world.export(events);
console.log('Exact replay:', K.hash(world.import(saved).state) === K.hash(state));
