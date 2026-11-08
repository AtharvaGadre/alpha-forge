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
