#!/usr/bin/env node
'use strict';
// Compile an authored narrative package without a service, dependency, or model.
const fs = require('node:fs');
const K = require('../KiraSDK.js');
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node tools/narrative.cjs source.json compiled.json');
  process.exitCode = 1;
} else {
  try {
    const compiled = K.Narrative.compile(JSON.parse(fs.readFileSync(args[0], 'utf8')));
    fs.writeFileSync(args[1], JSON.stringify(compiled, null, 2) + '\n');
    console.log('Compiled ' + compiled.definition.id + ' (' + compiled.definition.characters.length + ' characters; ' + compiled.hash + ')');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
