'use strict';

// npm run test:browser (after npx playwright install chromium).
// Test only the shipped HTML, served locally with no external application assets.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

const TIMEOUT = 30000;

async function exercise(browser, url, inline) {
  const mode = inline ? 'Inline' : 'Worker';
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.setDefaultNavigationTimeout(TIMEOUT);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());

    async function wait(predicate, arg, description) {
      try { await page.waitForFunction(predicate, arg, {timeout: TIMEOUT}); }
      catch (cause) {
        const details = await page.evaluate(() => ({
          notice: document.querySelector('#notice-text')?.textContent,
          draft: document.querySelector('#message-input')?.value,
          thinking: !document.querySelector('#thinking')?.hidden,
          revision: window.KiraApp?.snapshot().revision,
          turn: window.KiraApp?.snapshot().turn,
        })).catch(() => ({pageUnavailable: true}));
        throw new Error(`${mode}: ${description} did not complete. ${JSON.stringify({...details, errors})}`, {cause});
      }
    }

    await page.addInitScript(inline ? () => {
      window.Worker = class { constructor() { throw Error('Forced browser smoke fallback'); } };
    } : () => {
      const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        constructor(...args) { super(...args); window.__smokeWorker = this; }
      };
    });
    await page.goto(url);
    await wait(() => window.KiraApp && document.querySelector('#thinking').hidden &&
      document.querySelector('#save-status').textContent.includes('Saved'), null, 'startup');
    if (!inline) assert.equal(await page.evaluate(() => !!window.__smokeWorker), true, 'A real worker must start');

    const messages = ['My name is Alex', 'I like coffee', "I don't like it anymore", 'Do I like coffee?'];
    for (const [index, message] of messages.entries()) {
      await page.locator('#message-input').fill(message);
      // Pointer clicks are intentional: Enter alone missed a mobile focus/layout
      // regression that moved this button between pointerdown and pointerup.
      await page.locator('#send-button').click();
      await wait(turn => document.querySelector('#thinking').hidden &&
        !document.querySelector('#message-input').value && KiraApp.snapshot().turn === turn,
      index + 1, `sending message ${index + 1} with the mobile Send button`);
    }
    const report = await page.evaluate(async () => ({
      state: KiraApp.snapshot(), replay: await KiraApp.replay(),
      query: await KiraApp.query({op: 'subsumes', a: 'c:dog', b: 'c:animal'}),
      session: KiraApp.exportSession(),
    }));
    assert.equal(report.replay.matched, true, `${mode}: conversation replay must match`);
    assert.equal(report.query.outcome, 'Yes', `${mode}: semantic query must succeed`);
    const preference = report.state.memories.find(memory => memory.status === 'active' && memory.kind === 'preference');
    assert.equal(preference?.polarity, 'negative', `${mode}: correction must supersede the preference`);

    await page.reload();
    await wait(() => window.KiraApp && document.querySelector('#thinking').hidden && KiraApp.snapshot().turn === 4,
      null, 'restoring the saved conversation');
    assert.equal(await page.evaluate(async () => (await KiraApp.replay()).digest), report.replay.digest,
      `${mode}: reload must preserve the replay digest`);

    await page.locator('#settings-shortcut').click();
    await page.getByRole('dialog', {name: 'Settings & data'}).waitFor();
    const [download] = await Promise.all([
      page.waitForEvent('download'), page.locator('#export-button').click(),
    ]);
    assert.equal(await download.failure(), null, `${mode}: session download must complete`);
    const downloadedText = await fs.readFile(await download.path(), 'utf8');
    assert.equal(downloadedText, report.session, `${mode}: export must contain the committed session`);
    await page.locator('#reset-button').click();
    await wait(() => KiraApp.snapshot().revision === 0, null, 'reset');
    await page.locator('#settings-shortcut').click();
    await page.locator('#import-file').setInputFiles({
      name: 'session.json', mimeType: 'application/json', buffer: Buffer.from(downloadedText),
    });
    await wait(() => KiraApp.snapshot().turn === 4 && !document.querySelector('#settings-dialog').open,
      null, 'importing the downloaded backup');
    assert.equal(await page.evaluate(async () => (await KiraApp.replay()).digest), report.replay.digest,
      `${mode}: imported backup must replay exactly`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      `${mode}: mobile layout must not overflow horizontally`);

    if (!inline) {
      await page.evaluate(() => window.__smokeWorker.dispatchEvent(new ErrorEvent('error', {
        cancelable: true, message: 'Forced worker failure',
      })));
      await page.locator('#message-input').fill('Hello');
      await page.locator('#send-button').click();
      await wait(() => KiraApp.snapshot().turn === 5 && document.querySelector('#thinking').hidden &&
        !document.querySelector('#message-input').value, null, 'sending after worker failure');
      assert.equal(await page.evaluate(async () => (await KiraApp.replay()).matched), true,
        'Inline recovery must preserve deterministic replay');
    }
    assert.deepEqual(errors, [], `${mode}: the page must have no uncaught errors`);
    console.log(`${mode}: mobile Send, correction, query, replay, reload, export/reset/import${inline ? '' : ', worker recovery'} passed`);
  } finally { await context.close(); }
}

async function main() {
  const html = await fs.readFile(path.join(__dirname, '..', 'Kira.html'));
  const server = http.createServer((request, response) => {
    if (request.url === '/Kira.html' && request.method === 'GET') {
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
      response.end(html);
    } else { response.writeHead(404); response.end(); }
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const url = `http://127.0.0.1:${server.address().port}/Kira.html`;
    browser = await chromium.launch({headless: true, timeout: TIMEOUT});
    for (const inline of [false, true]) await exercise(browser, url, inline);
  } finally {
    try { if (browser) await browser.close(); }
    finally { server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
