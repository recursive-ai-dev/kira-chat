const fs = require('fs');

let _moduleContext = null;
if (typeof require !== 'undefined') {
  // We need to extract mulberry32 from kira_v3.html
  const path = require('path');
  const htmlPath = path.join(__dirname, '../kira_v3.html');
  const content = fs.readFileSync(htmlPath, 'utf8');

  // Extract the mulberry32 function from line 1175
  const match = content.match(/function mulberry32\(a\)\{return function\(\)\{[\s\S]*?\};\}/);
  if (!match) {
    console.error("Could not find mulberry32 function in kira_v3.html");
    process.exit(1);
  }

  _moduleContext = {
    mulberry32: eval('(' + match[0] + ')')
  };
}

const mulberry32Fn = (typeof mulberry32 !== 'undefined') ? mulberry32 : _moduleContext.mulberry32;

function assertClose(actual, expected, tolerance = 1e-10, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}. ${message || ''}`);
  }
}

function runTests() {
  console.log('--- Testing mulberry32 edge cases ---');
  let passCount = 0;
  let failCount = 0;

  function runCase(name, fn) {
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

  // 1. Determinism
  runCase('Determinism: same seed produces same sequence', () => {
    const rng1 = mulberry32Fn(12345);
    const rng2 = mulberry32Fn(12345);

    for (let i = 0; i < 10; i++) {
      assertClose(rng1(), rng2());
    }
  });

  // 2. Specific known values
  runCase('Specific known values for seed 12345', () => {
    const rng = mulberry32Fn(12345);
    assertClose(rng(), 0.9797282677609473);
    assertClose(rng(), 0.3067522644996643);
    assertClose(rng(), 0.484205421525985);
  });

  // 3. Type coercion (Float to Int)
  runCase('Type coercion: float seed coerces to integer', () => {
    const rngInt = mulberry32Fn(10);
    const rngFloat = mulberry32Fn(10.999);

    for (let i = 0; i < 5; i++) {
      assertClose(rngInt(), rngFloat());
    }
  });

  // 4. Type coercion (NaN / undefined)
  runCase('Type coercion: NaN / missing args coerces to 0', () => {
    const rngZero = mulberry32Fn(0);
    const rngNaN = mulberry32Fn(NaN);
    const rngUndefined = mulberry32Fn();

    for (let i = 0; i < 5; i++) {
      const val = rngZero();
      assertClose(rngNaN(), val);
      assertClose(rngUndefined(), val);
    }
  });

  // 5. Output bounds
  runCase('Output bounds: 0 <= output < 1', () => {
    const rng = mulberry32Fn(99999);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      if (val < 0 || val >= 1) {
        throw new Error(`Value out of bounds: ${val}`);
      }
    }
  });

  console.log(`\nTests passed: ${passCount}`);
  console.log(`Tests failed: ${failCount}`);
  if (typeof process !== 'undefined' && failCount > 0) process.exit(1);
}

runTests();
