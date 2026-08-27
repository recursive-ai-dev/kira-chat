const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../kira_v3.html');
const kiraHtml = fs.readFileSync(htmlPath, 'utf8');

function extractFunction(code, functionName) {
    const startIndex = code.indexOf(`function ${functionName}(`);
    if (startIndex === -1) return null;

    const braceIndex = code.indexOf('{', startIndex);
    if (braceIndex === -1) return null;

    let openBraces = 1;
    let i = braceIndex + 1;
    while (i < code.length && openBraces > 0) {
        if (code[i] === '{') openBraces++;
        if (code[i] === '}') openBraces--;
        i++;
    }

    if (openBraces !== 0) return null;

    return code.substring(startIndex, i);
}

const functionCode = extractFunction(kiraHtml, 'updateHerMood');

if (!functionCode) {
  console.error("[FAIL] updateHerMood function missing in kira_v3.html or could not be extracted.");
  process.exit(1);
}

// Set up mock environment
let state = {
    mood: 'neutral',
    energy: 0.5
};

let mockTimeOfDay = 'afternoon';
let updateInsightDockCalled = false;
let pickCalledWith = null;

// Mock dependencies
const pick = (arr) => {
    pickCalledWith = arr;
    return arr[0]; // Just return the first element for deterministic testing
};
const getTimeOfDay = () => mockTimeOfDay;
const updateInsightDock = () => {
    updateInsightDockCalled = true;
};

const updateHerMood = new Function('state', 'pick', 'getTimeOfDay', 'updateInsightDock', `
  return ${functionCode}
`)(state, pick, getTimeOfDay, updateInsightDock);

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function resetMocks() {
    state.mood = 'neutral';
    state.energy = 0.5;
    mockTimeOfDay = 'afternoon';
    updateInsightDockCalled = false;
    pickCalledWith = null;
}

function runTests() {
  console.log('--- Testing updateHerMood edge cases ---');
  let passCount = 0;
  let failCount = 0;

  function runCase(name, fn) {
    resetMocks();
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passCount++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error(e.message);
      failCount++;
    }
  }

  // 1. Known mood
  runCase('Updates mood correctly for a known userMood', () => {
    updateHerMood('happy');
    assertStrictEqual(state.mood, 'happy'); // Because pick() returns arr[0] and happy:['happy','affectionate']
    assertStrictEqual(pickCalledWith.length, 2);
    assertStrictEqual(pickCalledWith[0], 'happy');
    assertStrictEqual(pickCalledWith[1], 'affectionate');
    assertStrictEqual(updateInsightDockCalled, true);
  });

  // 2. Unknown mood
  runCase('Defaults to neutral for unknown userMood', () => {
    updateHerMood('confused');
    assertStrictEqual(state.mood, 'neutral');
    assertStrictEqual(pickCalledWith.length, 1);
    assertStrictEqual(pickCalledWith[0], 'neutral');
  });

  // 3. Late night energy drop
  runCase('Decreases energy during late_night (above floor)', () => {
    mockTimeOfDay = 'late_night';
    state.energy = 0.5;
    updateHerMood('neutral');
    assertStrictEqual(Math.abs(state.energy - 0.45) < 0.0001, true, `Energy should be 0.45, got ${state.energy}`);
  });

  runCase('Decreases energy during late_night (hits floor)', () => {
    mockTimeOfDay = 'late_night';
    state.energy = 0.22;
    updateHerMood('neutral');
    assertStrictEqual(Math.abs(state.energy - 0.2) < 0.0001, true, `Energy should hit floor of 0.2, got ${state.energy}`);
  });

  // 4. Morning energy boost
  runCase('Sets energy to 0.9 during morning', () => {
    mockTimeOfDay = 'morning';
    state.energy = 0.1;
    updateHerMood('neutral');
    assertStrictEqual(Math.abs(state.energy - 0.9) < 0.0001, true, `Energy should be 0.9, got ${state.energy}`);
  });

  // 5. Normal energy increase
  runCase('Increases energy during other times (below ceiling)', () => {
    mockTimeOfDay = 'afternoon';
    state.energy = 0.5;
    updateHerMood('neutral');
    assertStrictEqual(Math.abs(state.energy - 0.52) < 0.0001, true, `Energy should be 0.52, got ${state.energy}`);
  });

  runCase('Increases energy during other times (hits ceiling)', () => {
    mockTimeOfDay = 'evening';
    state.energy = 0.99;
    updateHerMood('neutral');
    assertStrictEqual(Math.abs(state.energy - 1.0) < 0.0001, true, `Energy should hit ceiling of 1.0, got ${state.energy}`);
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
