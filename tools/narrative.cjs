#!/usr/bin/env node
'use strict';
// Compile an authored narrative package without a service, dependency, or model.
const fs = require('node:fs');
const path = require('node:path');
const K = require('../KiraSDK.js');

function compileFile(input, output) {
  const source = path.resolve(input), destination = path.resolve(output);
  const sourceInfo = fs.statSync(source);
  let destinationInfo;
  try { destinationInfo = fs.statSync(destination); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (source === destination || (destinationInfo && sourceInfo.dev === destinationInfo.dev && sourceInfo.ino === destinationInfo.ino)) {
    throw new Error('Source and output must be different files; the authoring source has not been changed.');
  }
  if (destinationInfo && !destinationInfo.isFile()) throw new Error('Output must be a regular file.');

  const compiled = K.Narrative.compile(JSON.parse(fs.readFileSync(source, 'utf8')));
  const encoded = JSON.stringify(compiled, null, 2) + '\n';
  // A sibling directory keeps rename on the destination's filesystem. Failures
  // before rename leave both the editable source and any prior output intact.
  const temporary = fs.mkdtempSync(path.join(path.dirname(destination), '.kira-narrative-'));
  try {
    const staged = path.join(temporary, 'compiled.json');
    const fd = fs.openSync(staged, 'wx', destinationInfo ? destinationInfo.mode & 0o777 : 0o666);
    try { fs.writeFileSync(fd, encoded, 'utf8'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(staged, destination);
  } finally {
    fs.rmSync(temporary, {recursive:true, force:true});
  }
  return compiled;
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node tools/narrative.cjs source.json compiled.json');
  process.exitCode = 1;
} else {
  try {
    const compiled = compileFile(args[0], args[1]);
    console.log('Compiled ' + compiled.definition.id + ' (' + compiled.definition.characters.length + ' characters; ' + compiled.hash + ')');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
