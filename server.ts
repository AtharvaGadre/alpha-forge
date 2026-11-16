import { marketContext } from './src/engine/marketContext.ts';
import { configureBacktestFetch, createForecastLedger, issuedSignal, runForecastBacktest } from './src/engine/forecastBacktest.ts';
import { researchFor, papersFor } from './src/engine/commodityResearch.ts';
import { normalizeCrossref } from './src/engine/paperDiscovery.ts';
import { fetchGlobeWeather, type GlobeWeatherField } from './src/engine/liveGlobeWeather.ts';
import { TRANSMISSION_VERSION, TRANSMISSION_NODES, TRANSMISSION_LINKS, traceTransmission } from './src/engine/commodityTransmissionEngine.ts';
import { COMMODITIES, commodityTarget, type CommodityForecast } from './src/engine/commodityForecastEngine.ts';
import { runLiveAtmospherePipeline } from './src/engine/liveAtmospherePipeline.ts';
import { createHash } from 'node:crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createOutbound, OutboundError } from './server/outbound.ts';
import { buildCsp, rateLimit, securityHeaders } from './server/security.ts';
import { issueCommodityForecast, loadLatestOutlooks, outlookPaths, type OutlookFile } from './server/precompute.ts';
import { startScheduler } from './server/dailyJob.ts';
import { buildSummary, type TrackRecordSummary } from './server/trackRecordStore.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const production = process.env.NODE_ENV === 'production';
const flag = (name: string, fallback: boolean) => (process.env[name] == null || process.env[name] === '' ? fallback : !['0', 'false', 'off', 'no'].includes(String(process.env[name]).toLowerCase()));
const num = (name: string, fallback: number) => (Number.isFinite(Number(process.env[name])) && process.env[name] !== '' && process.env[name] != null ? Number(process.env[name]) : fallback);
const PACKAGE_VERSION = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version as string; } catch { return 'unknown'; } })();
const startedAt = new Date();
const log = (m: string) => console.log(`[astraeus ${new Date().toISOString()}] ${m}`);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  // Behind a reverse proxy / Cloud Run set TRUST_PROXY (e.g. 1) so rate limits key on the client address.
  if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
  app.disable('x-powered-by');

  // ---------------------------------------------------------------------------
  // Shared outbound layer: TTL cache, de-duplication, Open-Meteo budget and key
  // ---------------------------------------------------------------------------
  const dataDir = path.join(__dirname, '.astraeus-data');
  const outbound = createOutbound({
    dataDir,
    dailyBudget: num('OPEN_METEO_DAILY_BUDGET', 5000),
    reserve: num('OPEN_METEO_RESERVE', 1500),
    apiKey: process.env.OPEN_METEO_API_KEY || undefined,
  });
  configureBacktestFetch((url, timeoutMs) => outbound.fetchJson(url, timeoutMs, { priority: 'interactive' }));
  const forecastLedger = createForecastLedger(dataDir);

  // ---------------------------------------------------------------------------
  // Security headers and per-IP rate limits
  // ---------------------------------------------------------------------------
  const distPath = path.join(__dirname, 'dist');
  let csp: string | null = null;
  if (production) {
    try { csp = buildCsp(fs.readFileSync(path.join(distPath, 'index.html'), 'utf8')); } catch { csp = buildCsp(''); }
  }
  app.use(securityHeaders({ csp }));
  app.use(express.json({ limit: '64kb' }));
  const apiLimit = rateLimit({ name: 'api', capacity: num('RATE_LIMIT_API_BURST', 120), refillPerSecond: num('RATE_LIMIT_API_PER_MIN', 120) / 60 });
  const expensiveLimit = rateLimit({ name: 'live-analysis', capacity: num('RATE_LIMIT_EXPENSIVE_BURST', 12), refillPerSecond: num('RATE_LIMIT_EXPENSIVE_PER_MIN', 8) / 60 });
  app.use('/api', apiLimit);
  for (const route of ['/api/v1/commodities/:id/forecast', '/api/v1/commodities/:id/backtest', '/api/v1/commodities/:id/context', '/api/v1/research/papers', '/api/v2/atmosphere/investigate']) app.use(route, expensiveLimit);

  // ---------------------------------------------------------------------------
  // Precomputed outlooks + track record (state shared with the scheduler)
  // ---------------------------------------------------------------------------
  let latestOutlooks: OutlookFile | null = loadLatestOutlooks(__dirname);
  let trackSummary: { at: number; value: TrackRecordSummary } | null = null;
  const trackRecordSummary = () => {
    if (!trackSummary || Date.now() - trackSummary.at > 5 * 60_000) trackSummary = { at: Date.now(), value: buildSummary(__dirname) };
    return trackSummary.value;
  };
  const PRECOMPUTE = flag('PRECOMPUTE', production);
  const TRACK_RECORD = flag('TRACK_RECORD', production);
  const scheduler = PRECOMPUTE
    ? startScheduler({
        root: __dirname, outbound, allowance: num('PRECOMPUTE_ALLOWANCE', 1500), trackRecord: TRACK_RECORD, log,
        onIssued: (f) => forecastLedger.append(issuedSignal(f)),
        onComplete: (file) => { latestOutlooks = file; trackSummary = null; },
      })
    : null;

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------
  const health = (_req: express.Request, res: express.Response) => {
    const tr = (() => { try { return trackRecordSummary(); } catch { return null; } })();
    res.json({
      status: 'ok',
      service: 'astraeus',
      version: PACKAGE_VERSION,
      environment: production ? 'production' : 'development',
      startedAtUtc: startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      precompute: { enabled: PRECOMPUTE, issuedAtUtc: latestOutlooks?.issuedAtUtc ?? null, results: latestOutlooks ? Object.keys(latestOutlooks.results).length : 0, openMeteoWeight: latestOutlooks?.openMeteo.weightedCalls ?? null },
      trackRecord: { enabled: TRACK_RECORD, snapshots: tr?.snapshots ?? 0, ledgerHead: tr?.ledger.head ?? null, ledgerOk: tr?.ledger.ok ?? null },
      openMeteo: { ...outbound.budget.snapshot(), commercialKey: outbound.keyConfigured, coolingDownUntil: outbound.stats().cooldownUntil },
    });
  };
  app.get('/api/v1/health', health);
  app.get('/api/health', health); // legacy alias

  // ---------------------------------------------------------------------------
  // Measured weather skill (published benchmark, never fixtures)
  // ---------------------------------------------------------------------------
  app.get('/api/v1/models/skill', async (_req, res) => {
    try {
      const raw = await fs.promises.readFile(path.join(process.cwd(), 'public', 'research', 'weather-skill.json'), 'utf8');
      const r = JSON.parse(raw);
      res.json({ version: r.version, period: r.periodLabel, generatedAt: r.generatedAt, headlineMethod: r.headlineMethod, sites: r.sites?.length, summary: r.summary?.map(({ pit, reliability, ...row }: any) => row), singleModels: r.singleModels, provenance: r.provenance, caveats: r.caveats, fullResults: '/research/weather-skill.json' });
    } catch {
      res.status(503).json({ error: 'Benchmark results not generated. Run: npx tsx research/weather-benchmark.ts --suite final --period confirm' });
    }
  });

  // Full live pipeline output for any place (raw inputs, skill, consequences, data log). Rate-limited and budgeted.
  const handleLiveInvestigate = async (req: express.Request, res: express.Response) => {
    const query = String(req.body?.query ?? req.query.q ?? '').trim().slice(0, 300);
    if (!query) { res.status(400).json({ error: 'Provide ?q=<question or place> or {"query": "..."}' }); return; }
    if (outbound.budget.remaining('interactive') < 20) { res.status(503).json({ error: 'The daily live-data budget for this server is used up. Try again after 00:00 UTC.', dataMode: 'LIVE_UNAVAILABLE' }); return; }
    try {
      const live = await runLiveAtmospherePipeline({ query, fetchJson: outbound.fetcher({ priority: 'interactive' }) });
      res.json(live);
    } catch (err: any) {
      res.status(502).json({ error: String(err?.message || err), dataMode: 'LIVE_UNAVAILABLE' });
    }
  };
  app.get('/api/v2/atmosphere/investigate', handleLiveInvestigate);
  app.post('/api/v2/atmosphere/investigate', handleLiveInvestigate);

  // ---------------------------------------------------------------------------
  // Commodity catalogue, research, transmission
  // ---------------------------------------------------------------------------
  app.get('/api/v1/prediction-markets', (_req, res) => {
    res.status(410).json({ error: 'Prediction markets have been removed. Use /api/v1/commodities.' });
  });
  app.get(['/api/v1/commodities', '/api/v1/trade-ideas'], (_req, res) => {
    res.json({ commodities: COMMODITIES, count: COMMODITIES.length });
  });
  // Old fixture news and summaries must not leak fictional contract data to older clients.
  app.get(['/api/v1/news-trade-ideas', '/api/v1/ai-summary'], (_req, res) => {
    res.status(410).json({ error: 'Fixture trade decks retired. Use commodity forecasts with traceable evidence.' });
  });

  // Global GFS wind / rain field: 144 grid points (≈144 weighted calls) per refresh, so it is cached for
  // GLOBE_TTL_MIN (default 180; GFS runs every 6 h) and the last good field is served when providers or the budget fail.
  let weatherGridCache: { field: GlobeWeatherField; expires: number } | null = null;
  let weatherGridPending: Promise<GlobeWeatherField> | null = null;
  const globeTtlMs = num('GLOBE_TTL_MIN', 180) * 60_000;
  app.get('/api/v1/weather/globe', async (_req, res) => {
    if (weatherGridCache && weatherGridCache.expires > Date.now()) { res.json({ ...weatherGridCache.field, cached: true }); return; }
    try {
      if (!weatherGridPending) {
        weatherGridPending = (async () => {
          const field = await fetchGlobeWeather((url) => outbound.fetchJson(url, 20_000, { priority: 'interactive' }));
          const inputSha256 = createHash('sha256').update(JSON.stringify({ model: field.model, initialized: field.modelInitializedAtUtc, frames: field.frames })).digest('hex');
          const result: GlobeWeatherField = { ...field, inputSha256 };
          weatherGridCache = { field: result, expires: Date.now() + globeTtlMs };
          return result;
        })().finally(() => { weatherGridPending = null; });
      }
      res.json({ ...await weatherGridPending, cached: false });
    } catch (err: any) {
      if (weatherGridCache) { res.json({ ...weatherGridCache.field, cached: true, stale: true }); return; }
      res.status(err instanceof OutboundError && err.code === 'OM_BUDGET' ? 503 : 502).json({ error: err?.message || 'Weather grid unavailable.', dataMode: 'LIVE_UNAVAILABLE' });
    }
  });

  app.get('/api/v1/commodities/:id/research', (req, res) => {
    const commodity = COMMODITIES.find(c => c.id === req.params.id);
    if (!commodity) { res.status(404).json({ error: 'Unknown commodity.' }); return; }
    res.json({ commodityId: commodity.id, profile: researchFor(commodity.id), papers: papersFor(commodity.id), reviewedAt: '2026-11-12', note: 'Publication records and editorial summaries; physical mechanisms do not establish current price forecast skill.' });
  });
  const paperSearchCache = new Map<string, { expires: number; papers: ReturnType<typeof normalizeCrossref> }>();
  app.get('/api/v1/research/papers', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 3 || q.length > 180) { res.status(400).json({ error: 'Use a search query between 3 and 180 characters.' }); return; }
    const key = q.toLowerCase(), cached = paperSearchCache.get(key);
    if (cached && cached.expires > Date.now()) { res.json({ provider: 'Crossref', papers: cached.papers, cached: true }); return; }
    try {
      const response = await fetch('https://api.crossref.org/works?rows=8&query.bibliographic=' + encodeURIComponent(q), { signal: AbortSignal.timeout(18000), headers: { 'User-Agent': 'AlphaForgeCommodityResearch/1.0' } });
      if (!response.ok) throw new Error(response.status === 429 ? 'The paper provider is rate-limited. Try later or open Google Scholar.' : `Paper provider returned HTTP ${response.status}.`);
      const data = await response.json(); const papers = normalizeCrossref(Array.isArray(data.message?.items) ? data.message.items : []);
      if (paperSearchCache.size >= 100) paperSearchCache.delete(paperSearchCache.keys().next().value!);
      paperSearchCache.set(key, { papers, expires: Date.now() + 3600_000 }); res.json({ provider: 'Crossref', papers, cached: false });
    } catch (error: any) { res.status(502).json({ error: error?.message || 'Paper discovery unavailable. The reviewed library remains available.' }); }
  });
  app.get('/api/v1/commodities/transmission', (_req, res) => {
    res.json({ version: TRANSMISSION_VERSION, nodes: TRANSMISSION_NODES, links: TRANSMISSION_LINKS, evidence: 'MECHANISM_ONLY' });
  });
  app.get('/api/v1/commodities/transmission/scenario', (req, res) => {
    const source = String(req.query.source ?? '');
    const direction = String(req.query.direction ?? 'UP');
    const hops = Number(req.query.hops ?? 2);
    if (!COMMODITIES.some(c => c.id === source) || !['UP', 'DOWN'].includes(direction)) {
      res.status(400).json({ error: 'Choose a catalogue commodity and direction UP or DOWN.' }); return;
    }
    try {
      const paths = traceTransmission(source, direction as 'UP' | 'DOWN', hops);
      res.json({ version: TRANSMISSION_VERSION, origin: 'MANUAL_HYPOTHESIS', source, direction, hops, paths, note: 'Conditional mechanisms only; costs, demand and prices stay separate. No calibrated return forecast.' });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // ---------------------------------------------------------------------------
  // Price context and backtests
  // ---------------------------------------------------------------------------
  const backtestPending = new Map<string, Promise<Awaited<ReturnType<typeof runForecastBacktest>>>>();
  const backtestCache = new Map<string, { data: Awaited<ReturnType<typeof runForecastBacktest>>; expires: number }>();
  app.get('/api/v1/commodities/:id/context', async (req, res) => {
    const commodity = COMMODITIES.find(c => c.id === req.params.id); if (!commodity) { res.status(404).json({ error: 'Unknown commodity' }); return; }
    try { res.json(await marketContext(commodity.name, String(req.query.start ?? ''), String(req.query.end ?? ''))); } catch (e: any) { res.status(502).json({ error: e.message }); }
  });
  app.get('/api/v1/commodities/:id/backtest', async (req, res) => {
    const options = { commodityId: String(req.params.id), regionId: String(req.query.region ?? ''), mode: String(req.query.mode ?? 'REPLAY') as 'REPLAY' | 'ISSUED', start: String(req.query.start ?? ''), end: String(req.query.end ?? ''), horizon: Number(req.query.horizon ?? 5), costBps: Number(req.query.costBps ?? 0), cadence: String(req.query.cadence ?? 'DAILY') as 'DAILY' | 'WEEKLY' };
    const key = JSON.stringify(options), hit = backtestCache.get(key);
    if (hit && hit.expires > Date.now()) { res.json({ ...hit.data, cached: true }); return; }
    if (backtestPending.size >= 2 && !backtestPending.has(key)) { res.status(429).json({ error: 'Two backtests are already running. Please retry shortly.' }); return; }
    try {
      let job = backtestPending.get(key);
      if (!job) { job = runForecastBacktest(options, forecastLedger); backtestPending.set(key, job); }
      const data = await job;
      if (backtestCache.size >= 30) backtestCache.delete(backtestCache.keys().next().value!);
      backtestCache.set(key, { data, expires: Date.now() + 5 * 60_000 }); res.json({ ...data, cached: false });
    } catch (error: any) { res.status(502).json({ error: error.message || 'Backtest providers unavailable. No sample results were substituted.' }); }
    finally { backtestPending.delete(key); }
  });

  // ---------------------------------------------------------------------------
  // Live regional analysis
  // ---------------------------------------------------------------------------
  const commodityCache = new Map<string, { result: CommodityForecast; expires: number }>();
  const commodityPending = new Map<string, Promise<CommodityForecast>>();
  app.get('/api/v1/commodities/:id/forecast', async (req, res) => {
    const commodity = COMMODITIES.find(c => c.id === req.params.id);
    if (!commodity) { res.status(404).json({ error: 'Unknown commodity.' }); return; }
    const region = req.query.region == null ? commodity.regions[0] : commodity.regions.find(r => r.id === String(req.query.region));
    if (!region) { res.status(400).json({ error: 'Choose a region from this commodity’s catalogue.' }); return; }
    const key = `${commodity.id}:${region.id}`;
    const hit = commodityCache.get(key);
    if (hit && hit.expires > Date.now()) { res.json({ ...hit.result, cached: true }); return; }
    const precomputed = latestOutlooks?.results[key];
    const budgetFallback = (reason: string) => {
      if (precomputed) { res.json({ ...precomputed, cached: true, notice: `${reason} Showing the precomputed outlook issued ${precomputed.precomputed?.issuedAtUtc ?? latestOutlooks?.issuedAtUtc}.` }); return; }
      res.status(503).json({ error: `${reason} No precomputed outlook exists for this region; try again after 00:00 UTC.`, dataMode: 'LIVE_UNAVAILABLE' });
    };
    if (!commodityPending.has(key) && (outbound.budget.remaining('interactive') < 20 || outbound.coolingDown())) {
      budgetFallback(outbound.coolingDown() ? 'The weather provider is rate-limiting this server.' : 'The daily live-data budget for this server is used up.');
      return;
    }
    try {
      let pending = commodityPending.get(key);
      if (!pending) {
        pending = (async () => {
          const live = await runLiveAtmospherePipeline({ query: `${commodity.name}: ${region.name}`, target: commodityTarget(commodity, region), fetchJson: outbound.fetcher({ priority: 'interactive' }) });
          const result = issueCommodityForecast(commodity, region, live);
          await forecastLedger.append(issuedSignal(result));
          for (const [testKey, test] of backtestCache) if (test.data.mode === 'ISSUED' && test.data.commodityId === commodity.id && test.data.regionId === region.id) backtestCache.delete(testKey);
          commodityCache.set(key, { result, expires: Date.now() + 15 * 60_000 });
          return result;
        })().finally(() => commodityPending.delete(key));
        commodityPending.set(key, pending);
      }
      res.json({ ...await pending, cached: false });
    } catch (err: any) {
      if (outbound.budget.remaining('interactive') < 20 || outbound.coolingDown()) { budgetFallback('Live data became unavailable during this analysis.'); return; }
      res.status(502).json({ error: err?.message || 'Live data unavailable.', dataMode: 'LIVE_UNAVAILABLE' });
    }
  });

  // ---------------------------------------------------------------------------
  // Precomputed outlooks and the live track record
  // ---------------------------------------------------------------------------
  app.get('/api/v1/outlooks/latest', (req, res) => {
    if (!latestOutlooks) latestOutlooks = loadLatestOutlooks(__dirname);
    if (!latestOutlooks) { res.status(404).json({ error: 'No precomputed outlooks yet. They are issued daily after 06:30 UTC.' }); return; }
    res.setHeader('Cache-Control', 'public, max-age=300');
    const gz = outlookPaths(__dirname).latestGz;
    if (/\bgzip\b/.test(String(req.headers['accept-encoding'] ?? '')) && fs.existsSync(gz)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      fs.createReadStream(gz).pipe(res);
      return;
    }
    res.json(latestOutlooks);
  });
  app.get('/api/v1/track-record', (_req, res) => {
    try { res.setHeader('Cache-Control', 'public, max-age=300'); res.json({ ...trackRecordSummary(), enabled: TRACK_RECORD }); }
    catch (err: any) { res.status(500).json({ error: err?.message || 'Track record unavailable.' }); }
  });

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Unknown API route.' }); });

  // Vite middleware in development or static dist serving in production
  if (!production) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath, { index: false, maxAge: '1h', setHeaders: (res, file) => { if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  httpServer.listen(PORT, '0.0.0.0', () => {
    log(`Astraeus listening on http://0.0.0.0:${PORT} (${production ? 'production' : 'development'}; precompute ${PRECOMPUTE ? 'on' : 'off'}, track record ${TRACK_RECORD ? 'on' : 'off'})`);
  });
  const shutdown = () => { scheduler?.stop(); outbound.flush(); httpServer.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
