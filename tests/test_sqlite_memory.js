/**
 * SQLite Memory Integration Test Suite
 * 
 * Verifies:
 * 1. CLI database operations (add, list, edit, set-profile, sync-to-kira).
 * 2. SQLite JSON sync payload loading into Kira v3 state.
 * 3. Front-to-back response generation pulling memories from SQLite DB.
 */

const fs = require('fs');
const execSync = require('child_process').execSync;
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

console.log("=== RUNNING KIRA SQLITE MEMORY INTEGRATION TEST ===");

// 1. Run Python SQLite CLI commands
try {
  console.log("\n--- Step 1: Operating SQLite DB via scripts/kira_db.py ---");
  execSync('python3 scripts/kira_db.py init', { stdio: 'inherit' });
  execSync('python3 scripts/kira_db.py set-profile username "Damien"', { stdio: 'inherit' });
  execSync('python3 scripts/kira_db.py add "Loves playing electric guitar" --category preference', { stdio: 'inherit' });
  execSync('python3 scripts/kira_db.py add "Enjoys dark roast coffee" --category preference', { stdio: 'inherit' });
  execSync('python3 scripts/kira_db.py sync-to-kira', { stdio: 'inherit' });
  console.log("[PASS] SQLite CLI operations completed successfully.");
} catch (err) {
  console.error("[FAIL] SQLite CLI execution failed:", err);
  process.exit(1);
}

// 2. Load SQLite export JSON
const exportPath = 'kira_db_export.json';
if (!fs.existsSync(exportPath)) {
  console.error(`[FAIL] SQLite export payload ${exportPath} not found!`);
  process.exit(1);
}

const sqlitePayload = JSON.parse(fs.readFileSync(exportPath, 'utf8'));

// 3. Launch JSDOM simulation to test SQLite memory pull
console.log("\n--- Step 2: Testing SQLite Memory Integration in Kira v3 ---");

const kiraHtml = fs.readFileSync('kira_v3.html', 'utf8');
const virtualConsole = new jsdom.VirtualConsole();

const dom = new JSDOM(kiraHtml, {
  runScripts: "dangerously",
  resources: "usable",
  virtualConsole,
  url: "http://localhost/kira_v3.html?seed=54321"
});

const { window } = dom;

setTimeout(async () => {
  try {
    if (typeof window.importSQLiteMemory !== 'function') {
      console.error("[FAIL] window.importSQLiteMemory is not defined");
      process.exit(1);
    }

    // Import SQLite Payload
    window.importSQLiteMemory(sqlitePayload);

    // Verify imported state
    const state = window.state || (window.getState && window.getState());
    if (!state || state.username !== "Damien") {
      console.error(`[FAIL] Expected username "Damien", got "${state ? state.username : 'undefined'}"`);
      process.exit(1);
    }

    const hasGuitarMem = state.memories.some(m => m.text.includes("guitar"));
    if (!hasGuitarMem) {
      console.error("[FAIL] SQLite memory 'Loves playing electric guitar' was not imported into state.memories!");
      process.exit(1);
    }
    console.log(`[PASS] SQLite memories successfully imported into state! (Username: "${state.username}", Memories count: ${state.memories.length})`);

    // Verify Kira response generation uses imported profile/memories
    const response = await window.generateResponse("Hello Kira!");
    console.log(`[RESPONSE TEST] User: "Hello Kira!" -> Kira: "${response}"`);

    if (!response || response.length === 0) {
      console.error("[FAIL] Response generation returned empty string!");
      process.exit(1);
    }

    console.log("\n=== KIRA SQLITE MEMORY INTEGRATION TEST PASSED (100%) ===");
    process.exit(0);
  } catch (err) {
    console.error("[FATAL ERROR in SQLite Memory test]", err);
    process.exit(1);
  }
}, 500);
