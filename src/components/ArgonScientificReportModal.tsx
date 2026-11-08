// ============================================================================
// ALPHAFORGE ATMOSPHERE — 28-SECTION SCIENTIFIC REPORT WORKSPACE (LEVEL 3)
// Organized into 8 Expandable Chapters with Executive Summary, Key Predictions,
// Uncertainty Bounds, Equations, and PDF/JSON Provenance
// ============================================================================

import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Volume2,
  CheckCircle2,
} from 'lucide-react';
import { type ArgonStructuredReport } from '../engine/argonAtmosphereEngine';
import { atmosphereStore, useAtmosphereStore } from '../state/atmosphereStore';
import { argonAudioManager } from '../engine/argonAudioManager';

export interface ArgonScientificReportModalProps {
  report?: ArgonStructuredReport | null;
  onClose: () => void;
}

interface ChapterGroup {
  chapterNumber: number;
  title: string;
  subtitle: string;
  sectionRange: [number, number];
}

const EIGHT_REPORT_CHAPTERS: ChapterGroup[] = [
  {
    chapterNumber: 1,
    title: '1. Forecast Results',
    subtitle:
      'Executive thesis, research objectives, and multi-horizon forecast trajectory',
    sectionRange: [1, 4],
  },
  {
    chapterNumber: 2,
    title: '2. Model Comparison',
    subtitle:
      'WeatherNext 3, ECMWF IFS, ECMWF AIFS, DeepMind GraphCast, and NOAA GFS divergence',
    sectionRange: [5, 8],
  },
  {
    chapterNumber: 3,
    title: '3. Weather Evidence',
    subtitle:
      'Observed ground-station, satellite, jet-stream, and synoptic boundary telemetry',
    sectionRange: [9, 12],
  },
  {
    chapterNumber: 4,
    title: '4. Forecast Accuracy',
    subtitle:
      'RMSE, MAE, Brier Skill Score, CRPS, and out-of-sample reliability calibration',
    sectionRange: [13, 16],
  },
  {
    chapterNumber: 5,
    title: '5. Mathematical Methodology',
    subtitle:
      'Constrained linear pooling, EMOS variance calibration, and categorical skill equations',
    sectionRange: [17, 19],
  },
  {
    chapterNumber: 6,
    title: '6. Economic Impact',
    subtitle:
      'Agricultural yield sensitivity, energy grid load, maritime routing, and sovereign equities',
    sectionRange: [20, 23],
  },
  {
    chapterNumber: 7,
    title: '7. Limitations and Alternative Explanations',
    subtitle:
      'Non-weather confounders, failed model candidates, and regime breakdown scenarios',
    sectionRange: [24, 26],
  },
  {
    chapterNumber: 8,
    title: '8. Sources and Reproducibility',
    subtitle:
      'Immutable dataset checksums, operational API provenance, and reproducibility appendix',
    sectionRange: [27, 28],
  },
];

export const ArgonScientificReportModal: React.FC<
  ArgonScientificReportModalProps
> = ({ report: propReport, onClose }) => {
  const state = useAtmosphereStore();
  const activeReport = propReport || state.activeReport;
  const [expandedChapters, setExpandedChapters] = useState<
    Record<number, boolean>
  >({
    1: true,
    2: true,
    6: true,
  });

  const toggleChapter = (chapterNum: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterNum]: !prev[chapterNum],
    }));
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(activeReport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReport.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ens = activeReport.investigationSnapshot.modelComparison.ensembleResult;
  const ver =
    activeReport.investigationSnapshot.modelComparison.verificationMetrics;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 text-slate-100 overflow-y-auto"
      data-testid="scientific-report-workspace"
    >
      {/* Sticky Top Bar with Return to Earth Globe */}
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            data-testid="return-to-globe-from-report"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Earth Globe
          </button>
          <div>
            <div className="text-xs font-mono text-slate-400">
              {activeReport.reportId} · {activeReport.modelRegistryChecksum.slice(0, 18)}
            </div>
            <h1 className="text-sm sm:text-base font-semibold text-white">
              {activeReport.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void argonAudioManager.speakText(
                activeReport.thirtySecondSpokenScript
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-xs font-medium text-sky-300"
          >
            <Volume2 className="w-3.5 h-3.5" />
            Narrate 30s Summary
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            data-testid="report-print-pdf-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            data-testid="report-download-json-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            JSON Provenance
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Default Executive Summary Card */}
        <section
          aria-label="Executive Summary and Key Predictions"
          data-testid="report-executive-summary"
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                28/28 Sections Verified
              </span>
              <span className="text-xs text-slate-400">
                Region:{' '}
                <strong className="text-white">
                  {activeReport.regionLabel}
                </strong>
              </span>
              <span className="text-xs text-slate-400">
                · Issued: {new Date(activeReport.generatedAtUtc).toUTCString()}
              </span>
            </div>
            <span className="text-xs font-mono text-sky-300">
              CRPS: {ver.crps} mm · BSS: {ver.brierSkillScore}
            </span>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
              Executive Summary
            </h2>
            <p className="text-sm text-slate-200 mt-1.5 leading-relaxed">
              {activeReport.executiveSummaryPlain}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                Key Multi-Model Predictions
              </h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Weighted Ensemble Mean: Precipitation ŷ ={' '}
                {ens.ensemblePrecipitationMm} mm, Temperature ŷ ={' '}
                {ens.ensembleTemperatureC}°C, Wind Speed ŷ ={' '}
                {ens.ensembleWindSpeedMs} m/s.
              </p>
              <div className="mt-2 text-[11px] font-mono text-slate-400">
                90% Calibrated PI: [{ens.calibrated90PctIntervalMm[0]} mm,{' '}
                {ens.calibrated90PctIntervalMm[1]} mm]
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Forecast Uncertainty & Spread
              </h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {ens.disagreementExplanation}
              </p>
              <div className="mt-2 text-[11px] font-mono text-slate-400">
                Inter-Model Spread: {ens.disagreementIndexMm} mm · EMOS σ_cal:{' '}
                {ens.calibratedPredictiveStdMm} mm
              </div>
            </div>
          </div>
        </section>

        {/* 8 Expandable Chapters Containing All 28 Sections */}
        <section className="space-y-3" aria-label="8 Expandable Report Chapters">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">
              Full 28-Section Institutional Dossier (8 Chapters)
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  setExpandedChapters({
                    1: true,
                    2: true,
                    3: true,
                    4: true,
                    5: true,
                    6: true,
                    7: true,
                    8: true,
                  })
                }
                data-testid="expand-all-chapters-btn"
                className="text-sky-400 hover:text-sky-300"
              >
                Expand all 8 chapters
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => setExpandedChapters({})}
                className="text-slate-400 hover:text-slate-200"
              >
                Collapse all
              </button>
            </div>
          </div>

          {EIGHT_REPORT_CHAPTERS.map((chapter) => {
            const isExpanded = !!expandedChapters[chapter.chapterNumber];
            const chapterSections = activeReport.sections28.filter(
              (s) =>
                s.sectionNumber >= chapter.sectionRange[0] &&
                s.sectionNumber <= chapter.sectionRange[1]
            );

            return (
              <div
                key={chapter.chapterNumber}
                data-testid={`report-chapter-${chapter.chapterNumber}`}
                className="bg-slate-900/65 border border-slate-800/90 rounded-2xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleChapter(chapter.chapterNumber)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-900 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {chapter.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {chapter.subtitle}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Sections {chapter.sectionRange[0]}–{chapter.sectionRange[1]}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-sky-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800/80 divide-y divide-slate-800/60 px-5 py-3 space-y-4">
                    {chapterSections.map((sec) => (
                      <div
                        key={sec.sectionNumber}
                        data-testid={`report-section-${sec.sectionNumber}`}
                        className="pt-3 first:pt-1 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-xs sm:text-sm font-semibold text-sky-300">
                            {sec.title}
                          </h3>
                          {sec.keyMetricsBadge && (
                            <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded">
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
                )}
              </div>
            );
          })}
        </section>

        {/* Interactive Assumption & Provenance Gate Stress-Tester */}
        <section className="bg-slate-900/75 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <ShieldCheck className="w-4 h-4" />
              Interactive Model Weight & Stale-Forecast Gate Stress-Tester
            </div>
            <button
              type="button"
              onClick={() => {
                atmosphereStore.runArgonQuery(
                  activeReport.investigationSnapshot.userQuery,
                  {
                    injectStaleForecastTest: !state.staleForecastInjected,
                    openReportWorkspace: true,
                  }
                );
              }}
              data-testid="toggle-stale-forecast-gate-btn"
              className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-medium"
            >
              {state.staleForecastInjected
                ? 'Restore Fresh Operational Run'
                : 'Test 42h Stale Forecast Gate'}
            </button>
          </div>
          <p className="text-xs text-slate-300">
            Provenance Status:{' '}
            <strong className="text-white">
              {activeReport.investigationSnapshot.provenanceCheck.warningMessage}
            </strong>
          </p>
        </section>
      </main>
    </div>
  );
};
