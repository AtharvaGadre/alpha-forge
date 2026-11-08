// ============================================================================
// ALPHAFORGE ATMOSPHERE — LIVE VERIFICATION PANEL
// Shows the held-out skill experiment, per-model error by lead time and real model
// run timestamps for investigations computed by liveAtmospherePipeline.ts.
// ============================================================================
import React from 'react';
import type { LiveAtmosphereInvestigation } from '../engine/liveAtmospherePipeline.ts';
import type { ArgonInvestigationResult } from '../engine/argonAtmosphereEngine.ts';

/** Small LIVE / OFFLINE badge for any investigation. */
export const DataModeBadge: React.FC<{ inv: ArgonInvestigationResult; status?: 'LOADING' | 'LIVE' | 'OFFLINE_FALLBACK' }> = ({ inv, status }) => {
  const live = inv.dataMode === 'LIVE_OPEN_DATA';
  const label = live ? '● LIVE OPEN DATA' : status === 'LOADING' ? '◌ LOADING LIVE DATA…' : '◆ OFFLINE DEMO FIXTURE';
  return (
    <span
      data-testid="data-mode-badge"
      title={live ? `Computed from live public data at ${inv.createdAtUtc}` : 'Built-in demonstration values — live data not available yet'}
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold border whitespace-nowrap ${
        live ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300' : 'bg-amber-500/15 border-amber-400 text-amber-200'
      }`}
    >
      {label}
    </span>
  );
};

/** Live provenance, held-out experiment and per-model skill (only for LIVE_OPEN_DATA investigations). */
export const LiveVerificationPanel: React.FC<{ live: LiveAtmosphereInvestigation }> = ({ live }) => {
  const v = live.verification;
  const models = Array.from(new Set(live.skillByLead.map((r) => r.name)));
  const cell = (name: string, lead: number) =>
    live.skillByLead.find((r) => r.name === name && r.leadDays === lead);
  return (
    <div className="bg-slate-950 border border-emerald-900/60 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-mono font-bold text-emerald-300 uppercase">
          Live verification · forecasts scored against ERA5 (what actually happened)
        </span>
        <span className="text-[11px] font-mono text-slate-400">
          SHA-256 {live.reproducibility.inputsSha256.slice(0, 16)}… · reconciliation{' '}
          {live.reproducibility.reconciliationPassed ? 'passed' : 'FAILED'}
        </span>
      </div>

      {v ? (
        <p className="text-xs text-slate-200 leading-relaxed">
          <strong className={v.verdict === 'SKILL_WEIGHTING_IMPROVED' ? 'text-emerald-300' : 'text-amber-300'}>
            {v.verdict === 'SKILL_WEIGHTING_IMPROVED' ? 'Skill weighting kept:' : 'Skill weighting rejected:'}
          </strong>{' '}
          weights fitted on {v.trainWindow} ({v.nTrain} point-days), scored on unseen {v.testWindow} ({v.nTest}{' '}
          point-days). CRPS {v.equalWeight.crps} → {v.skillWeighted.crps} mm, RMSE {v.equalWeight.rmse} →{' '}
          {v.skillWeighted.rmse} mm, 90% interval coverage {v.skillWeighted.predictionIntervalCoverage90Pct}% (spread ×
          {v.calibrationInflation}). Best single model on training days: {v.bestSingleModel.name}.
        </p>
      ) : (
        <p className="text-xs text-amber-200">
          Held-out verification unavailable for this location (archive overlap too short) — equal weights used.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <table className="w-full text-left border-collapse text-[11px] font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-1 pr-2">Daily rain MAE (mm)</th>
              <th className="py-1 px-2">Day 1</th>
              <th className="py-1 px-2">Day 3</th>
              <th className="py-1 px-2">Day 5</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-slate-200">
            {models.map((name) => (
              <tr key={name}>
                <td className="py-1 pr-2 text-white">{name}</td>
                {[1, 3, 5].map((lead) => (
                  <td key={lead} className="py-1 px-2">
                    {cell(name, lead)?.precipMae ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <table className="w-full text-left border-collapse text-[11px] font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-1 pr-2">Model run</th>
              <th className="py-1 px-2">Initialised (UTC)</th>
              <th className="py-1 px-2">Used?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-slate-200">
            {live.modelForecasts.map((m) => {
              const prov = live.provenance.find((p) => p.modelId === m.modelId);
              return (
                <tr key={m.modelId}>
                  <td className="py-1 pr-2 text-white">{m.name}</td>
                  <td className="py-1 px-2">{prov?.initTimestampUtc?.slice(0, 16).replace('T', ' ') ?? 'unknown'}</td>
                  <td className={`py-1 px-2 ${m.includedInEnsemble ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {m.includedInEnsemble ? 'yes' : m.exclusionReason}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-slate-400">
        Sources: {Array.from(new Set(live.dataLog.filter((d) => d.ok).map((d) => d.source.replace(/ \(.*\)$/, '')))).join(' · ')}
      </div>
    </div>
  );
};

const DIRECTION_STYLE: Record<string, string> = {
  UPWARD_PRESSURE: 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300',
  DOWNWARD_PRESSURE: 'bg-rose-500/15 border-rose-400/60 text-rose-300',
  NO_MATERIAL_SIGNAL: 'bg-slate-800 border-slate-600 text-slate-300',
};

/**
 * Research ideas generated from the live consequence chains — hypotheses with their
 * evidence, confidence and invalidation criteria. No orders, sizes or payouts.
 */
export const LiveResearchIdeas: React.FC<{ live: LiveAtmosphereInvestigation }> = ({ live }) => (
  <div data-testid="live-research-ideas" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-300">
          Live research ideas · {live.target.label}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Generated {new Date(live.generatedAtUtc).toUTCString()} from {live.modelInputs.length} weather models,
          10-year climatology and observed market data. Hypotheses for research — not trading recommendations; no
          orders are placed.
        </p>
      </div>
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-emerald-500/15 border-emerald-400 text-emerald-300">
        ● LIVE OPEN DATA
      </span>
    </div>

    {live.consequences.length === 0 && (
      <div className="p-4 rounded-2xl bg-slate-900/85 border border-slate-800 text-sm text-slate-300">
        No market exposure is mapped for {live.target.label} yet, so AlphaForge reports the physical forecast only:{' '}
        {live.epistemic.B_whatModelsPredict[0]}
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {live.consequences.map((c) => {
        const sig = c.driverSignal;
        const v = live.verification;
        return (
          <article
            key={c.exposure.symbol}
            data-testid={`live-idea-${c.exposure.symbol}`}
            className="p-4 rounded-2xl bg-slate-900/85 border border-slate-800 space-y-3 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-mono font-bold text-white text-sm">{c.exposure.symbol}</div>
                <div className="text-slate-400">{c.exposure.name}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded border font-mono text-[10px] font-bold ${DIRECTION_STYLE[c.hypothesisDirection]}`}>
                  {c.hypothesisDirection.replaceAll('_', ' ')}
                </span>
                <span className="px-2 py-0.5 rounded border border-slate-600 font-mono text-[10px] text-slate-200">
                  CONFIDENCE {c.confidence}
                </span>
              </div>
            </div>

            <p className="text-slate-200 leading-relaxed">{c.hypothesis}</p>

            <div className="text-[11px] text-slate-400">{c.steps.join(' → ')}</div>

            <dl className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <dt className="text-slate-500">Weather signal</dt>
                <dd className="text-white">
                  {sig ? `${sig.anomaly >= 0 ? '+' : ''}${sig.anomaly} ${sig.unit} (z ${sig.zScore})` : 'n/a'}
                </dd>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <dt className="text-slate-500">Observed 5-session move</dt>
                <dd className="text-white">
                  {c.observedMove ? `${c.observedMove.return5dPct >= 0 ? '+' : ''}${c.observedMove.return5dPct}% (${c.observedMove.moveInSigma}σ)` : 'unavailable'}
                </dd>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <dt className="text-slate-500">10-yr weather↔price test</dt>
                <dd className="text-white">
                  {c.historical ? `r ${c.historical.sameMonthR}, p ${c.historical.sameMonthP}` : 'not tested'}
                </dd>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <dt className="text-slate-500">Forecast verification</dt>
                <dd className="text-white">
                  {v ? `CRPS ${v.skillWeighted.crps} vs ${v.equalWeight.crps}` : 'unavailable'}
                </dd>
              </div>
            </dl>

            <ul className="list-disc pl-4 text-[11px] text-slate-400 space-y-0.5">
              {c.confidenceReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {c.offsettingFactors.length > 0 && (
              <div className="text-[11px] text-slate-400">
                <span className="text-amber-300">Could offset it:</span> {c.offsettingFactors.join(' · ')}
              </div>
            )}
            <div className="text-[11px] text-slate-500">
              <span className="text-slate-300">Invalidation:</span> {c.invalidationCriteria}
            </div>
          </article>
        );
      })}
    </div>
  </div>
);

/** Banner shown above illustrative fixture content while live data is unavailable. */
export const FixtureBanner: React.FC = () => (
  <div className="px-3 py-2 rounded-xl border border-amber-400/50 bg-amber-500/10 text-[11px] text-amber-200">
    ◆ Illustrative demo content (fixed values). Live research ideas replace this when live data loads.
  </div>
);

/** Compact hero card: the leading live hypothesis for the selected place, with its evidence. */
export const LiveHeroCard: React.FC<{
  live: LiveAtmosphereInvestigation;
  onOpenIdeas: () => void;
  onOpenReport: () => void;
}> = ({ live, onOpenIdeas, onOpenReport }) => {
  const lead =
    live.consequences.find((c) => c.hypothesisDirection !== 'NO_MATERIAL_SIGNAL') ??
    live.consequences.find((c) => c.exposure.driver !== 'CONTEXT') ??
    live.consequences[0];
  const ens = live.ensemble;
  const pn = live.signals.find((s) => s.id === 'PRECIP_NEXT7');
  const tn = live.signals.find((s) => s.id === 'TEMP_NEXT7');
  return (
    <div data-testid="live-hero-card" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="px-2.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
          Weather → markets · live
        </span>
        <span className="px-2 py-0.5 rounded bg-slate-900 border border-sky-500/30 font-mono text-[10px] text-sky-300">
          {live.windows.forecastLabel}
        </span>
      </div>
      <h3 className="text-base font-extrabold text-white">{live.target.label}</h3>

      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-slate-500">Next-7-day rain</div>
          <div className="text-white">
            {ens.ensemblePrecipitationMm} mm {pn ? `(normal ${pn.normal})` : ''}
          </div>
          <div className="text-slate-500">90%: {ens.calibrated90PctIntervalMm.join('–')} mm</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-slate-500">Mean temperature</div>
          <div className="text-white">
            {ens.ensembleTemperatureC} °C {tn ? `(normal ${tn.normal})` : ''}
          </div>
          <div className="text-slate-500">{live.modelInputs.length} models · {live.ensembleMembers.ecmwfMembers + live.ensembleMembers.gefsMembers} members</div>
        </div>
      </div>

      {lead ? (
        <div className="p-3 rounded-xl bg-[#0b1220] border border-slate-700 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-bold text-white text-sm">{lead.exposure.symbol}</span>
            <span className={`px-2 py-0.5 rounded border font-mono text-[10px] font-bold ${DIRECTION_STYLE[lead.hypothesisDirection]}`}>
              {lead.hypothesisDirection.replaceAll('_', ' ')} · {lead.confidence}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{lead.hypothesis}</p>
          {lead.observedMove && (
            <p className="text-[10px] font-mono text-slate-400">
              Observed: {lead.observedMove.return5dPct >= 0 ? '+' : ''}
              {lead.observedMove.return5dPct}% in 5 sessions (not attributed to weather)
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-300">No market exposure mapped here yet — physical forecast only.</p>
      )}

      <p className="text-[10px] text-slate-500">Research hypotheses only — no orders are placed.</p>

      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenIdeas}
          className="flex-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-xs font-semibold text-emerald-200"
        >
          Evidence & all ideas
        </button>
        <button
          type="button"
          onClick={onOpenReport}
          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200"
        >
          28-Section Report
        </button>
      </div>
    </div>
  );
};
