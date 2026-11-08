import React, { useMemo, useState } from 'react';
import {
  generateArgonScientificReport,
  executeArgonVoiceWorkflow,
  type ArgonInvestigationResult,
  type ArgonReportTier,
  type ArgonStructuredReport,
} from '../engine/argonAtmosphereEngine.ts';
import { argonAudioManager } from '../engine/argonAudioManager.ts';

interface ArgonScientificReportModalProps {
  investigation: ArgonInvestigationResult;
  userMode: 'BASIC' | 'ADVANCED';
  onClose: () => void;
  onUpdateInvestigation?: (updated: ArgonInvestigationResult) => void;
}

export const ArgonScientificReportModal: React.FC<ArgonScientificReportModalProps> = ({
  investigation,
  userMode,
  onClose,
  onUpdateInvestigation,
}) => {
  const [activeTier, setActiveTier] = useState<ArgonReportTier>(
    userMode === 'BASIC'
      ? 'PLAIN_ENGLISH_BRIEFING'
      : 'FULL_28_SECTION_SCIENTIFIC_REPORT'
  );

  // Interactive Judge Assumption Challenge Controls
  const [weatherNext3Weight, setWeatherNext3Weight] = useState<number>(0.30);
  const [ecmwfIfsWeight, setEcmwfIfsWeight] = useState<number>(0.24);
  const [noaaGfsWeight, setNoaaGfsWeight] = useState<number>(0.10);
  const [staleForecastInjected, setStaleForecastInjected] = useState<boolean>(
    !investigation.provenanceCheck.accepted
  );
  const [searchSectionFilter, setSearchSectionFilter] = useState<string>('');

  // Recompute deterministic investigation & 28-section report whenever judge changes assumptions
  const recomputedInvestigation: ArgonInvestigationResult = useMemo(() => {
    return executeArgonVoiceWorkflow({
      query: investigation.userQuery,
      currentCountryIso2: investigation.resolvedScope.countryIso2,
      previousInvestigation: investigation,
      customWeights: {
        WEATHERNEXT_3: weatherNext3Weight,
        ECMWF_IFS: ecmwfIfsWeight,
        NOAA_GFS: noaaGfsWeight,
      },
      injectStaleForecastTest: staleForecastInjected,
    });
  }, [
    investigation,
    weatherNext3Weight,
    ecmwfIfsWeight,
    noaaGfsWeight,
    staleForecastInjected,
  ]);

  const structuredReport: ArgonStructuredReport = useMemo(
    () => generateArgonScientificReport(recomputedInvestigation, activeTier),
    [recomputedInvestigation, activeTier]
  );

  const ens = recomputedInvestigation.modelComparison.ensembleResult;
  const ver = recomputedInvestigation.modelComparison.verificationMetrics;

  const filteredSections = useMemo(() => {
    if (!searchSectionFilter.trim()) return structuredReport.sections28;
    const q = searchSectionFilter.toLowerCase();
    return structuredReport.sections28.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    );
  }, [structuredReport.sections28, searchSectionFilter]);

  const handleDownloadFormattedPdfHtml = () => {
    argonAudioManager.triggerSound(
      'REPORT_GENERATED',
      'Exported 28-Section Scientific Report Document'
    );
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${structuredReport.title}</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #0f172a; max-width: 920px; margin: 28px auto; padding: 0 24px; line-height: 1.55; }
    h1 { font-size: 22px; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 6px; }
    h2 { font-size: 16px; color: #0369a1; margin-top: 22px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    .meta { font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 10px 12px; border-radius: 6px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; }
    th { background: #e2e8f0; font-weight: 700; }
    .eq-box { font-family: monospace; background: #f8fafc; border-left: 4px solid #0284c7; padding: 8px 12px; margin: 8px 0; font-size: 12px; }
    .sec-card { margin-bottom: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    @media print { body { margin: 10px; } }
  </style>
</head>
<body>
  <h1>${structuredReport.title}</h1>
  <div class="meta">
    <strong>Report ID:</strong> ${structuredReport.reportId} |
    <strong>Generated:</strong> ${structuredReport.generatedAtUtc} |
    <strong>Commit:</strong> ${structuredReport.commitHash} |
    <strong>Dataset:</strong> ${structuredReport.datasetSnapshotId} |
    <strong>Checksum:</strong> ${structuredReport.modelRegistryChecksum}
  </div>
  <h2>Table of Contents</h2>
  <p>Sections 1–28 · Equations Eq. (1)–Eq. (8) · Figure 1 (Multi-Model Ensemble Comparison) · Figure 2 (Verification & Calibration Matrix) · Reproducibility Appendix</p>

  <h2>Figure 1 — Multi-Model Forecast Comparison (${recomputedInvestigation.modelComparison.variableLabel})</h2>
  <table>
    <thead>
      <tr><th>Model</th><th>Normalized Weight (wᵢ)</th><th>Precip (mm)</th><th>Temp (°C)</th><th>Wind (m/s)</th><th>P(&gt;20mm)</th></tr>
    </thead>
    <tbody>
      ${recomputedInvestigation.modelComparison.modelInputs
        .map((m, i) => {
          const nw = ens.normalizedWeights[i]?.weight ?? m.weight;
          return `<tr><td>${m.modelName}</td><td>${nw.toFixed(4)}</td><td>${m.predictedPrecipitationMm} mm</td><td>${m.predictedTemperatureC} °C</td><td>${m.predictedWindSpeedMs} m/s</td><td>${Math.round(m.probExceedance20Mm * 100)}%</td></tr>`;
        })
        .join('')}
      <tr><th>Calibrated Multi-Model Ensemble (ŷ)</th><th>Σ wᵢ = ${ens.weightSumCheck}</th><th>${ens.ensemblePrecipitationMm} mm (90% PI: [${ens.calibrated90PctIntervalMm[0]}, ${ens.calibrated90PctIntervalMm[1]}] mm)</th><th>${ens.ensembleTemperatureC} °C</th><th>${ens.ensembleWindSpeedMs} m/s</th><th>${(ens.calibratedProbExceedance20Mm * 100).toFixed(1)}%</th></tr>
    </tbody>
  </table>

  <h2>Numbered Mathematical Equations (Eq. 1 – Eq. 8)</h2>
  ${structuredReport.equations
    .map(
      (eq) =>
        `<div class="eq-box"><strong>${eq.equationNumber} — ${eq.title} [${eq.implementationStatus}]:</strong><br/>${eq.latexOrFormula}<br/><em>${eq.variableDefinitions}</em></div>`
    )
    .join('')}

  <h2>28-Section Scientific & Quantitative Report</h2>
  ${structuredReport.sections28
    .map(
      (s) =>
        `<div class="sec-card"><strong>${s.title}</strong><p>${s.content}</p></div>`
    )
    .join('')}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${structuredReport.reportId}-Scientific-Report.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJsonProvenance = () => {
    argonAudioManager.triggerSound(
      'DATA_RETRIEVED',
      'Exported Reproducible JSON Snapshot'
    );
    const blob = new Blob([JSON.stringify(structuredReport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${structuredReport.reportId}-Provenance.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ARGON Interactive 28-Section Scientific & Economic Report Viewer"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-[#070b16] border border-cyan-500/50 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-bold">
                ARGON SCIENTIFIC REPORT ENGINE · 28 SECTIONS
              </span>
              <span className="text-slate-400">
                ID: <strong className="text-white">{structuredReport.reportId}</strong>
              </span>
              <span className="text-emerald-300">
                Checksum: {structuredReport.modelRegistryChecksum.slice(0, 18)}…
              </span>
            </div>
            <h2 className="text-sm sm:text-lg font-bold text-white mt-1 truncate">
              {structuredReport.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                argonAudioManager.speakText(
                  structuredReport.thirtySecondSpokenScript
                )
              }
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/30 cursor-pointer"
            >
              🔊 Speak 30s Summary
            </button>
            <button
              type="button"
              onClick={handleDownloadFormattedPdfHtml}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/30 cursor-pointer"
            >
              ⬇ Export Print/PDF Report
            </button>
            <button
              type="button"
              onClick={handleDownloadJsonProvenance}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:border-cyan-400 cursor-pointer"
            >
              ⬇ JSON Provenance
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Scientific Report Viewer"
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold hover:bg-rose-500/30 cursor-pointer"
            >
              Close [×]
            </button>
          </div>
        </div>

        {/* 3 Report Tier Switcher Tabs */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                {
                  id: 'PLAIN_ENGLISH_BRIEFING',
                  label: '1. Plain-English Weather Briefing (Basic)',
                },
                {
                  id: 'DETAILED_METEOROLOGICAL_ECONOMIC_REPORT',
                  label: '2. Detailed Meteorological & Economic Impact',
                },
                {
                  id: 'FULL_28_SECTION_SCIENTIFIC_REPORT',
                  label: '3. Full 28-Section Scientific & Math Report (Advanced)',
                },
              ] as Array<{ id: ArgonReportTier; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTier(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  activeTier === t.id
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchSectionFilter}
            onChange={(e) => setSearchSectionFilter(e.target.value)}
            placeholder="Filter 28 sections or equations..."
            aria-label="Filter report sections"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-100 focus:outline-none focus:border-cyan-400 w-full sm:w-56"
          />
        </div>

        {/* Scrollable Report Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Stale Forecast Provenance Gate Banner */}
          <div
            className={`rounded-xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              recomputedInvestigation.provenanceCheck.accepted
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/50 border-rose-500/60 text-rose-200'
            }`}
          >
            <div className="text-xs space-y-0.5">
              <div className="font-mono font-bold uppercase">
                PROVENANCE &amp; SAFETY GATE:{' '}
                {recomputedInvestigation.provenanceCheck.status}
              </div>
              <p className="text-slate-200">
                {recomputedInvestigation.provenanceCheck.warningMessage}{' '}
                {recomputedInvestigation.provenanceCheck.safetyDisclosure}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !staleForecastInjected;
                setStaleForecastInjected(next);
                argonAudioManager.triggerSound(
                  next ? 'TASK_FAILED' : 'DATA_RETRIEVED',
                  next
                    ? 'Injected 42h Stale Forecast — Quarantined by Provenance Gate'
                    : 'Restored Fresh Operational Forecast Run'
                );
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-xs font-mono font-semibold text-amber-300 shrink-0 cursor-pointer"
            >
              {staleForecastInjected
                ? 'Restore Fresh Forecast Run (3h old)'
                : 'Judge Test: Inject Stale Forecast (42h old)'}
            </button>
          </div>

          {/* Interactive Judge Assumption Challenger & Recompute Box */}
          <div className="rounded-xl bg-slate-900/90 border border-cyan-500/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono uppercase text-cyan-300 font-bold">
                  JUDGE REPRODUCIBILITY &amp; ASSUMPTION CHALLENGER (ŷ = Σ wᵢ ŷᵢ, Σ wᵢ = {ens.weightSumCheck})
                </div>
                <p className="text-xs text-slate-300">
                  Adjust model weights below to challenge ensemble assumptions and recompute the forecast mean, 90% calibrated interval, and all 28 report sections in real time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWeatherNext3Weight(0.30);
                  setEcmwfIfsWeight(0.24);
                  setNoaaGfsWeight(0.10);
                  if (onUpdateInvestigation) {
                    onUpdateInvestigation(recomputedInvestigation);
                  }
                }}
                className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer"
              >
                Reset Default Validation Weights
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <label className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <div className="flex justify-between text-cyan-300">
                  <span>WeatherNext 3 Prior Weight</span>
                  <span>{weatherNext3Weight.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={weatherNext3Weight}
                  onChange={(e) => setWeatherNext3Weight(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </label>

              <label className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <div className="flex justify-between text-emerald-300">
                  <span>ECMWF IFS Prior Weight</span>
                  <span>{ecmwfIfsWeight.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={ecmwfIfsWeight}
                  onChange={(e) => setEcmwfIfsWeight(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </label>

              <label className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <div className="flex justify-between text-amber-300">
                  <span>NOAA GFS Prior Weight</span>
                  <span>{noaaGfsWeight.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={noaaGfsWeight}
                  onChange={(e) => setNoaaGfsWeight(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </label>
            </div>

            {/* Live Recomputed Ensemble & Verification Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 pt-1 font-mono">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400">ENSEMBLE MEAN (ŷ)</div>
                <div className="text-sm font-bold text-cyan-300">
                  {ens.ensemblePrecipitationMm} mm
                </div>
                <div className="text-[10px] text-slate-400">
                  Σwᵢ = {ens.weightSumCheck}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400">CALIBRATED 90% PI</div>
                <div className="text-sm font-bold text-emerald-300">
                  [{ens.calibrated90PctIntervalMm[0]}, {ens.calibrated90PctIntervalMm[1]}] mm
                </div>
                <div className="text-[10px] text-slate-400">
                  σ_cal = {ens.calibratedPredictiveStdMm} vs σ_raw = {ens.rawEnsembleSpreadMm}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400">MODEL SPREAD</div>
                <div className="text-sm font-bold text-amber-300">
                  {ens.disagreementIndexMm} mm
                </div>
                <div className="text-[10px] text-slate-400">
                  {ens.disagreementLevel}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400">OOS MAE / RMSE</div>
                <div className="text-sm font-bold text-white">
                  {ver.mae} / {ver.rmse} mm
                </div>
                <div className="text-[10px] text-slate-400">
                  N = {ver.sampleSizeN} holdout
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400">CRPS / BRIER SKILL</div>
                <div className="text-sm font-bold text-purple-300">
                  {ver.crps} mm / {ver.brierSkillScore}
                </div>
                <div className="text-[10px] text-slate-400">
                  BS = {ver.brierScore}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400">90% PI COVERAGE</div>
                <div className="text-sm font-bold text-emerald-300">
                  {ver.predictionIntervalCoverage90Pct}%
                </div>
                <div className="text-[10px] text-slate-400">
                  POD {ver.probabilityOfDetectionPod} · CSI {ver.criticalSuccessIndexCsi}
                </div>
              </div>
            </div>
          </div>

          {/* Executive Summary Card (Always Visible) */}
          <div className="rounded-xl bg-slate-900/95 border border-slate-800 p-4 space-y-2">
            <div className="text-xs font-mono font-bold text-cyan-300 uppercase">
              EXECUTIVE SUMMARY ({activeTier.replace(/_/g, ' ')})
            </div>
            <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
              {activeTier === 'PLAIN_ENGLISH_BRIEFING'
                ? recomputedInvestigation.spokenExecutiveBriefingBasic
                : recomputedInvestigation.spokenExecutiveBriefingAdvanced}
            </p>
          </div>

          {/* Figure 1: Multi-Model Forecast Comparison Table */}
          <div className="rounded-xl bg-slate-900/95 border border-slate-800 p-4 space-y-3 overflow-x-auto">
            <div className="text-xs font-mono font-bold text-cyan-300 uppercase">
              FIGURE 1 — MULTI-MODEL COMPARISON TABLE ({recomputedInvestigation.modelComparison.variableLabel})
            </div>
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3">Model / Provider</th>
                  <th className="py-2 px-3">Normalized Weight (wᵢ)</th>
                  <th className="py-2 px-3">Precip (ŷᵢ)</th>
                  <th className="py-2 px-3">Temp (°C)</th>
                  <th className="py-2 px-3">Wind (m/s)</th>
                  <th className="py-2 pl-3">Exceedance P(&gt;20mm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {recomputedInvestigation.modelComparison.modelInputs.map((m, idx) => {
                  const nw = ens.normalizedWeights[idx]?.weight ?? m.weight;
                  return (
                    <tr key={m.modelId}>
                      <td className="py-2 pr-3 font-bold text-white">{m.modelName}</td>
                      <td className="py-2 px-3 text-cyan-300">{nw.toFixed(4)}</td>
                      <td className="py-2 px-3">{m.predictedPrecipitationMm} mm</td>
                      <td className="py-2 px-3">{m.predictedTemperatureC}°C</td>
                      <td className="py-2 px-3">{m.predictedWindSpeedMs} m/s</td>
                      <td className="py-2 pl-3">{Math.round(m.probExceedance20Mm * 100)}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-cyan-950/30 font-bold text-cyan-200 border-t-2 border-cyan-500/40">
                  <td className="py-2.5 pr-3">
                    Calibrated Ensemble (ŷ = Σ wᵢ ŷᵢ)
                  </td>
                  <td className="py-2.5 px-3">Σwᵢ = {ens.weightSumCheck}</td>
                  <td className="py-2.5 px-3">
                    {ens.ensemblePrecipitationMm} mm (90% PI: [{ens.calibrated90PctIntervalMm[0]}, {ens.calibrated90PctIntervalMm[1]}])
                  </td>
                  <td className="py-2.5 px-3">{ens.ensembleTemperatureC}°C</td>
                  <td className="py-2.5 px-3">{ens.ensembleWindSpeedMs} m/s</td>
                  <td className="py-2.5 pl-3">
                    {(ens.calibratedProbExceedance20Mm * 100).toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Numbered Mathematical Equations (Shown in Detailed & Full 28-Section Views) */}
          {activeTier !== 'PLAIN_ENGLISH_BRIEFING' && (
            <div className="rounded-xl bg-slate-900/95 border border-slate-800 p-4 space-y-3">
              <div className="text-xs font-mono font-bold text-purple-300 uppercase">
                MATHEMATICAL FORMULATION &amp; EQUATIONS (IMPLEMENTED VS EXPLANATORY DISTINCTION)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {structuredReport.equations.map((eq) => (
                  <div
                    key={eq.equationNumber}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {eq.equationNumber} · {eq.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          eq.implementationStatus === 'IMPLEMENTED_IN_ENGINE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {eq.implementationStatus}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 font-mono text-xs text-white overflow-x-auto">
                      {eq.latexOrFormula}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {eq.variableDefinitions}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Autonomous Forecast Improvement Experiments (Including Validated + Failed/Rejected Candidate) */}
          <div className="rounded-xl bg-slate-900/95 border border-slate-800 p-4 space-y-3">
            <div className="text-xs font-mono font-bold text-emerald-300 uppercase">
              AUTONOMOUS FORECAST IMPROVEMENT LABORATORY (VALIDATED &amp; FAILED CANDIDATE AUDIT)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recomputedInvestigation.autonomousImprovements.map((exp) => (
                <div
                  key={exp.experimentId}
                  className={`rounded-xl p-3.5 border space-y-2 ${
                    exp.status === 'VALIDATED_IMPROVEMENT'
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-rose-950/20 border-rose-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {exp.experimentId} · {exp.regionName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        exp.status === 'VALIDATED_IMPROVEMENT'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {exp.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    <strong>Diagnosis:</strong> {exp.diagnosis}
                  </p>
                  <p className="text-xs text-slate-200">
                    <strong>Proposed Change:</strong> {exp.proposedAlgorithmChange}
                  </p>
                  <div className="text-[11px] font-mono text-cyan-300 bg-slate-950/80 p-2 rounded border border-slate-800">
                    N = {exp.validationSampleSizeN} Unseen Holdout · Baseline RMSE: {exp.baselineRmse} → Candidate RMSE: {exp.candidateRmse} | Baseline CRPS: {exp.baselineCrps} → Candidate CRPS: {exp.candidateCrps} | 90% PI Coverage: {exp.baseline90PiCoveragePct}% → {exp.candidate90PiCoveragePct}%
                  </div>
                  <p className="text-xs font-semibold text-white">
                    {exp.observedResultSummary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* All 28 Required Scientific Sections */}
          <div className="space-y-3">
            <div className="text-xs font-mono font-bold text-cyan-300 uppercase">
              COMPLETE 28-SECTION SCIENTIFIC &amp; REPRODUCIBLE REPORT ({filteredSections.length} / 28 SECTIONS SHOWN)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSections.map((sec) => (
                <div
                  key={sec.sectionNumber}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-cyan-300">
                      {sec.title}
                    </h3>
                    {sec.keyMetricsBadge && (
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-emerald-300 shrink-0">
                        {sec.keyMetricsBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {sec.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
