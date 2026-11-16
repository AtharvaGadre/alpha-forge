// Browser end-to-end tests: `npm run test:e2e` (builds, then runs this file with node:test).
// Chrome comes from CHROME_PATH (default: the platform's usual Google Chrome location).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, VIEW_READY, horizontalOverflow, launchBrowser, openPage, settle, startServer } from './harness.mjs';

const WAIT = { timeout: 20_000 };
let server;
let browser;

before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.stop();
});

/** Loads `#view` from scratch and waits for the view's own content. */
async function load(view, options) {
  const ctx = await openPage(browser, server.base, options);
  await ctx.page.goto(`${server.base}/#${view}`, { waitUntil: 'domcontentloaded' });
  await ctx.page.waitForSelector(VIEW_READY[view], WAIT);
  return ctx;
}
const hash = (page) => page.evaluate(() => location.hash);

describe('every view', () => {
  for (const view of VIEWS) {
    test(`#${view} renders with no uncaught errors and carries the data attribution`, async () => {
      const { page, problems } = await load(view);
      assert.ok(await page.$('h1'), 'page has a title heading');
      // The attribution block sits wherever forecasts are displayed (workspace footer, landing footer).
      const attribution = await page.$eval(view === 'home' ? '#lp-data-sources' : '#data-sources', (el) => ({ text: el.textContent, links: [...el.querySelectorAll('a')].map((a) => a.href) }));
      assert.match(attribution.text, /Weather data by Open-Meteo\.com/);
      assert.match(attribution.text, /Contains modified Copernicus Climate Change Service information \d{4}/);
      assert.match(attribution.text, /not for trading/);
      assert.ok(attribution.links.includes('https://open-meteo.com/'), 'links Open-Meteo');
      await new Promise((r) => setTimeout(r, 400)); // let late requests (track record, research JSON) settle
      assert.deepEqual(problems, []);
      await page.close();
    });
  }
});

test('sidebar navigation, browser back/forward and the brand link', async () => {
  const { page, problems } = await load('globe');
  const clickNav = async (label) => { await settle(page); await page.click(`.af-sidebar nav button[aria-label="${label}"]`); };
  await clickNav('Commodity dashboard');
  await page.waitForSelector(VIEW_READY.markets, WAIT);
  assert.equal(await hash(page), '#markets');
  assert.equal(await page.$eval('.af-sidebar nav button[aria-current=page]', (b) => b.getAttribute('aria-label')), 'Commodity dashboard');
  await clickNav('Forecast skill');
  await page.waitForSelector(VIEW_READY.accuracy, WAIT);
  assert.equal(await hash(page), '#accuracy');
  await page.goBack();
  await page.waitForSelector(VIEW_READY.markets, WAIT);
  assert.equal(await hash(page), '#markets');
  await page.goBack();
  await page.waitForSelector(VIEW_READY.globe, WAIT);
  assert.equal(await hash(page), '#globe');
  await page.goForward();
  await page.waitForSelector(VIEW_READY.markets, WAIT);
  assert.equal(await hash(page), '#markets');
  await settle(page);
  await page.click('.af-brand');
  await page.waitForSelector(VIEW_READY.home, WAIT);
  assert.equal(await hash(page), '#home');
  assert.deepEqual(problems, []);
  await page.close();
});

test('landing "Open the terminal" enters the workspace', async () => {
  const { page, problems } = await openPage(browser, server.base);
  await page.goto(`${server.base}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(VIEW_READY.home, WAIT);
  const clicked = await page.$$eval('.lp-hero a', (links) => { const a = links.find((l) => /Open the terminal/.test(l.textContent)); a?.click(); return !!a; });
  assert.ok(clicked, 'hero has an "Open the terminal" link');
  await page.waitForSelector(VIEW_READY.globe, WAIT);
  assert.equal(await hash(page), '#globe');
  assert.ok(await page.$('.af-app .af-sidebar'), 'workspace shell is shown');
  assert.deepEqual(problems, []);
  await page.close();
});

test('#accuracy renders its charts and the live track record', async () => {
  const { page, problems } = await load('accuracy');
  await page.waitForSelector('.sk svg', WAIT);
  const charts = await page.$$eval('.sk svg', (svgs) => svgs.filter((s) => s.getBoundingClientRect().width > 100 && s.querySelector('path,line,rect,circle')).length);
  assert.ok(charts >= 3, `expected several rendered charts, found ${charts}`);
  const track = await page.waitForSelector('#track-record', WAIT);
  assert.match(await track.evaluate((el) => el.textContent), /live track record/i);
  await page.waitForFunction(() => !document.querySelector('#track-record [role=status]'), WAIT); // finished loading
  assert.doesNotMatch(await track.evaluate((el) => el.textContent), /could not be loaded/);
  assert.deepEqual(problems, []);
  await page.close();
});

test('#report renders its sections and a references list', async () => {
  const { page, problems } = await load('report');
  const sections = await page.$$eval('.tr-section h2', (h) => h.length);
  assert.ok(sections >= 4, `expected the report sections, found ${sections}`);
  const refs = await page.$$eval('#tr-refs li', (li) => li.map((l) => l.textContent));
  assert.ok(refs.length >= 10, `expected a references list, found ${refs.length}`);
  assert.ok(await page.$('#tr-refs a[href^="https://doi.org/"]'), 'references link DOIs');
  assert.deepEqual(problems, []);
  await page.close();
});

test('with the weather budget at zero the UI degrades gracefully', async () => {
  const { page, problems } = await load('globe');
  await page.waitForFunction(() => /Weather unavailable/.test(document.querySelector('.af-weather-status')?.textContent ?? ''), WAIT);
  assert.ok(await page.$('.af-weather-status button'), 'offers a retry');
  await settle(page);
  await page.click('.af-sidebar nav button[aria-label="Commodity dashboard"]');
  await page.waitForSelector(VIEW_READY.markets, WAIT);
  await page.$$eval('.af-analysis-controls button', (b) => b[0].click()); // "Run forecast": answered 503 by the budget gate
  const alert = await page.waitForSelector('.af-detail [role=alert]', WAIT);
  assert.match(await alert.evaluate((el) => el.textContent), /Live analysis unavailable/);
  assert.match(await alert.evaluate((el) => el.textContent), /No demo result has been substituted/);
  assert.deepEqual(problems, []);
  await page.close();
});

test('the first-visit tour opens as a centred modal and closes', async () => {
  const { page, problems } = await openPage(browser, server.base, { tour: true });
  await page.goto(`${server.base}/#globe`, { waitUntil: 'domcontentloaded' });
  const dialog = await page.waitForSelector('dialog.as-tour[open]', WAIT);
  const box = await dialog.boundingBox();
  assert.ok(Math.abs(box.x + box.width / 2 - 720) < 4, `dialog is horizontally centred (left ${box.x}, width ${box.width})`);
  assert.ok(box.y > 0, 'dialog is not pinned to the top edge');
  await page.click('.as-tour-close');
  await page.waitForFunction(() => !document.querySelector('dialog.as-tour[open]'), WAIT);
  assert.equal(await page.evaluate(() => localStorage.getItem('astraeus-tour-v1')), 'done');
  assert.deepEqual(problems, []);
  await page.close();
});

test('every interactive control has an accessible name', async () => {
  for (const view of VIEWS) {
    const { page } = await load(view);
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, a[href], [role=button], [role=tab], input, select, textarea')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return false;
        const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
        return !name && !el.getAttribute('aria-labelledby') && !el.closest('label') && !(el.id && document.querySelector(`label[for="${el.id}"]`));
      })
      .map((el) => el.outerHTML.slice(0, 120)));
    assert.deepEqual(unnamed, [], `#${view}`);
    await page.close();
  }
});

for (const theme of ['dark', 'light']) {
  test(`at 390x844 (${theme}) no view scrolls or overflows horizontally`, async () => {
    for (const view of VIEWS) {
      const { page } = await load(view, { width: 390, height: 844, theme });
      await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')));
      const { scrollWidth, clientWidth, offenders } = await horizontalOverflow(page);
      assert.ok(scrollWidth <= clientWidth, `#${view}: page scrolls horizontally (${scrollWidth} > ${clientWidth})`);
      assert.deepEqual(offenders, [], `#${view}: elements extend past the 390 px viewport`);
      await page.close();
    }
  });
}
