const fs = require('fs');
const content = fs.readFileSync('kira_v3.html', 'utf8');
if (!content.includes('class KiraAIProxy')) {
  console.log('KiraAIProxy missing');
  process.exit(1);
}
if (!content.includes('<script id="kira-worker-code" type="javascript/worker">')) {
  console.log('Worker missing');
  process.exit(1);
}
console.log('run_v3 test passed');
