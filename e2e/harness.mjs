// Shared set-up for the browser end-to-end tests: a production Astraeus server on a free port with every
// outbound weather call disabled, and one headless Chrome driven by puppeteer-core.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VIEWS = ['home', 'globe', 'markets', 'watchlist', 'advanced', 'research', 'accuracy', 'report', 'methodology'];

/** Chrome or Chromium binary: CHROME_PATH, else the usual install location for this platform. */
export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const defaults = {
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linux: '/usr/bin/google-chrome',
    win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  };
  return defaults[process.platform] ?? defaults.linux;
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}

/**
 * Starts `NODE_ENV=production tsx server.ts` against the existing dist/ build. PRECOMPUTE, TRACK_RECORD and the
 * Open-Meteo budget are all off, so the server makes no outbound weather calls and the UI must degrade gracefully.
 */
export async function startServer() {
  if (!existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('dist/ is missing: run `npm run build` first (npm run test:e2e does this).');
  const port = Number(process.env.E2E_PORT) || await freePort();
  const env = { ...process.env, NODE_ENV: 'production', PORT: String(port), PRECOMPUTE: '0', TRACK_RECORD: '0', OPEN_METEO_DAILY_BUDGET: '0', OPEN_METEO_RESERVE: '0', RATE_LIMIT_API_BURST: '1000', RATE_LIMIT_API_PER_MIN: '6000' };
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 45_000;
  for (;;) {
    if (child.exitCode != null) throw new Error(`server exited early (${child.exitCode}):\n${output}`);
    try { const r = await fetch(`${base}/api/v1/health`); if (r.ok) break; } catch { /* not listening yet */ }
    if (Date.now() > deadline) { child.kill('SIGKILL'); throw new Error(`server did not become healthy:\n${output}`); }
    await new Promise((r) => setTimeout(r, 250));
  }
  return {
    base,
    output: () => output,
    async stop() {
      if (child.exitCode != null) return;
      const exited = new Promise((r) => child.once('exit', r));
      child.kill('SIGTERM');
      await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
      if (child.exitCode == null) child.kill('SIGKILL');
    },
  };
}

export async function launchBrowser() {
  const executablePath = chromePath();
  if (!existsSync(executablePath)) throw new Error(`Chrome not found at ${executablePath}. Set CHROME_PATH to a Chrome or Chromium binary.`);
  return puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio'] });
}

// Requests that are expected to fail while the Open-Meteo budget is zero and no outlooks are precomputed.
const EXPECTED_FAILURES = [
  { status: 503, path: /^\/api\/v1\/weather\/globe$/ },
  { status: 503, path: /^\/api\/v1\/commodities\/[^/]+\/forecast$/ },
  { status: 404, path: /^\/api\/v1\/outlooks\/latest$/ },
];

/**
 * Opens a page with the tour dismissed and a fixed theme, recording uncaught errors, console errors and failed
 * same-origin requests (minus the expected budget-related ones above).
 */
export async function openPage(browser, base, { width = 1440, height = 900, theme = 'dark' } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Failed requests are judged by status below; this console line is the browser echoing them.
    if (/^Failed to load resource/.test(text)) return;
    problems.push(`console.error: ${text.slice(0, 300)}`);
  });
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (url.origin !== base || r.status() < 400) return;
    if (EXPECTED_FAILURES.some((f) => f.status === r.status() && f.path.test(url.pathname))) return;
    problems.push(`HTTP ${r.status()} ${url.pathname}`);
  });
  await page.evaluateOnNewDocument((t) => {
    try { localStorage.setItem('astraeus-theme', t); localStorage.setItem('astraeus-tour-v1', 'done'); } catch { /* storage blocked */ }
  }, theme);
  return { page, problems };
}

/** Selector that proves each view rendered its own content (not just the shell). */
export const VIEW_READY = {
  home: '.lp-hero h1',
  globe: '.af-globe-landing .af-earth-inspector',
  markets: '.af-commodity-list .af-commodity-row',
  watchlist: '.af-commodity-list .af-commodity-row',
  advanced: '.af-forecast-lab [role=tablist]',
  research: '.af-learning .af-learning-card',
  accuracy: '.sk-kpis',
  report: '.tr-section h2',
  methodology: '.af-methodology .af-method-grid',
};

/**
 * Elements wider than the viewport that are not inside a scrolling or clipping container. html/body use
 * overflow-x: clip, so scrollWidth alone would hide content that is cut off on a phone.
 */
export function horizontalOverflow(page) {
  return page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const insideScroller = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') return true;
      return false;
    };
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || (r.right <= cw + 1 && r.left >= -1)) continue;
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.visibility === 'hidden' || insideScroller(el)) continue;
      offenders.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} [${Math.round(r.left)}, ${Math.round(r.right)}]`);
      if (offenders.length >= 5) break;
    }
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: cw, offenders };
  });
}

/** Waits until no view transition is animating (clicks during one land on the transition overlay). */
export function settle(page) {
  return page.waitForFunction(() => !document.getAnimations().some((a) => String(a.effect?.pseudoElement ?? '').startsWith('::view-transition')), { timeout: 10_000 });
}
