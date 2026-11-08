import React, { useState } from 'react';
import { runSlippageMonteCarlo, SlippageSimulationResult } from './engine/slippageMonteCarlo';
import { runDeterministicBacktest, BacktestResult } from './engine/quantEngine';
import {
  resolveCountryOrUnseenProfile,
  type UserExperienceMode,
} from './engine/worldPulseCountryEngine';
import { OverviewCommandCentre, MainWorkspaceTab } from './components/OverviewCommandCentre';
import { SlippageMonteCarloLab } from './components/SlippageMonteCarloLab';
import { FactorBacktestStudio } from './components/FactorBacktestStudio';
import { QuantPhysicsLab } from './components/QuantPhysicsLab';
import { AutonomousGovernanceHub } from './components/AutonomousGovernanceHub';
import { WorldPulseApp } from './components/WorldPulseApp';

export default function App() {
  // Default to WorldPulse Global Financial Intelligence & Geospatial Research Engine
  const [activeTab, setActiveTab] = useState<MainWorkspaceTab>('WORLDPULSE');
  // Top-level Basic vs Advanced Mode Slider (Basic = clean Pocket Guide; Advanced = full Quant Lab options)
  const [userMode, setUserMode] = useState<UserExperienceMode>('BASIC');
  // Shared Geographic Context across all AlphaForge modules (defaults to Sweden SE)
  const [selectedCountryIso, setSelectedCountryIso] = useState<string>('SE');
  const activeCountryProfile = resolveCountryOrUnseenProfile(selectedCountryIso);

  const [slippageResult, setSlippageResult] = useState<SlippageSimulationResult>(() =>
    runSlippageMonteCarlo()
  );
  const [backtestResult, setBacktestResult] = useState<BacktestResult>(() =>
    runDeterministicBacktest()
  );

  const handleToggleUserMode = (nextMode: UserExperienceMode) => {
    setUserMode(nextMode);
    if (nextMode === 'BASIC') {
      setActiveTab('WORLDPULSE');
    }
  };

  // Quant Lab tabs shown when the slider is on ADVANCED
  const advancedNavItems: { id: MainWorkspaceTab; label: string; shortLabel: string }[] = [
    { id: 'WORLDPULSE', label: 'WorldPulse 3D', shortLabel: 'WorldPulse' },
    { id: 'SLIPPAGE_MC', label: 'Executions & Slippage', shortLabel: 'Executions' },
    { id: 'FACTOR_BACKTEST', label: 'Factors & Backtest', shortLabel: 'Factors' },
    { id: 'QUANT_PHYSICS', label: 'QuantPhysics', shortLabel: 'Physics' },
    { id: 'GOVERNANCE', label: 'Quant Agents & Reports', shortLabel: 'Agents' },
  ];

  // Unified AlphaForge Atmosphere & WorldPulse section anchors for consistent navigation across Website, Tablet & Mobile
  const worldPulseSections = [
    { href: '#section-argon-assistant', label: 'ARGON Voice AI', shortLabel: 'ARGON AI' },
    { href: '#section-globe-zoom', label: 'Globe & Zoom AI', shortLabel: '3D Globe' },
    { href: '#section-country-deepdive', label: 'Country Deep-Dive', shortLabel: 'Country Intel' },
    { href: '#section-trade-routes', label: 'Trade & AIS Ships', shortLabel: 'Trade & Ships' },
    { href: '#section-street-vision', label: 'Street Cam & AIS', shortLabel: 'Street Cam' },
  ];

  return (
    <div id="top" className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#050811] text-slate-100 flex flex-col pb-16 lg:pb-0">
      {/* 3-Zone Responsive Top Bar (Consistent across Mobile 375px+, Tablet 768px+, and Website 1440px) */}
      <header className="h-13 sm:h-14 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 border-b border-slate-800/90 bg-[#050811]/95 backdrop-blur-md sticky top-0 z-40 w-full">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('WORLDPULSE');
          }}
          className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          AlphaForge · <span className="text-cyan-400">Atmosphere</span>{' '}
          <span className="hidden sm:inline text-xs font-mono text-emerald-300">
            [ARGON]
          </span>
        </a>

        {/* Zone 2: Center Navigation Links (Desktop lg+ where bottom quick-nav is hidden) */}
        {userMode === 'BASIC' ? (
          <nav
            aria-label="AlphaForge Atmosphere and ARGON Section Navigation"
            className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs font-medium text-slate-300"
          >
            {worldPulseSections.map((sec) => (
              <a
                key={sec.href}
                href={sec.href}
                className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 py-1"
              >
                {sec.label}
              </a>
            ))}
          </nav>
        ) : (
          <nav
            aria-label="Advanced Quantitative Laboratory Navigation"
            className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs font-medium text-slate-400"
          >
            {advancedNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                  activeTab === item.id
                    ? 'text-white border-amber-400 font-semibold'
                    : 'border-transparent hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        {/* Zone 3: Tactile Basic <-> Advanced Slider (Compact on Mobile, Full Label on Tablet & Wide Desktop) */}
        <div className="flex items-center shrink-0">
          <div
            role="group"
            aria-label="Basic vs Advanced Experience Slider"
            className="inline-flex items-center rounded-full bg-slate-950 p-0.5 sm:p-1 border border-slate-800 shadow-inner whitespace-nowrap"
          >
            <button
              type="button"
              onClick={() => handleToggleUserMode('BASIC')}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                userMode === 'BASIC'
                  ? 'bg-cyan-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Basic</span>
              <span className="hidden sm:inline lg:hidden xl:inline"> · Pocket Guide</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleUserMode('ADVANCED')}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                userMode === 'ADVANCED'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Advanced</span>
              <span className="hidden sm:inline lg:hidden xl:inline"> · Quant Lab</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (Consistent Fluid Width on Mobile, Tablet & 1440px Website) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-5 lg:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5 min-w-0">
        {/* Mobile & Tablet Advanced Sub-Lab Switcher (Shown when userMode === ADVANCED on < lg) */}
        {userMode === 'ADVANCED' && (
          <div
            role="navigation"
            aria-label="Mobile and Tablet Advanced Quantitative Modules"
            className="lg:hidden grid grid-cols-5 gap-1 bg-slate-900/95 border border-slate-800 rounded-xl p-1"
          >
            {advancedNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-2 px-1 rounded-lg text-[11px] sm:text-xs font-semibold text-center truncate transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.shortLabel}
              </button>
            ))}
          </div>
        )}

        {/* Shared Geographic Context Banner across connected AlphaForge Labs (when inside an Advanced sub-lab) */}
        {activeTab !== 'WORLDPULSE' && (
          <div className="rounded-xl bg-slate-900/90 border border-cyan-500/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="font-mono font-bold text-cyan-300">
                  ACTIVE COUNTRY · {activeCountryProfile.name.toUpperCase()} ({activeCountryProfile.iso2})
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Financial Hub:{' '}
                  <strong className="text-slate-100">
                    {activeCountryProfile.primaryFinancialCentre}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Currency:{' '}
                  <strong className="text-cyan-300">
                    {activeCountryProfile.currency.name} ({activeCountryProfile.currency.code})
                  </strong>
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                <span>Connected Exposure:</span>
                {activeCountryProfile.geographicRelationships.map((exp, idx) => (
                  <span key={exp.entityOrInstrument} className="font-mono text-slate-200">
                    {idx > 0 ? '· ' : ''}
                    {exp.entityOrInstrument} ({exp.domesticRevenueSharePct}% Dom-Rev)
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('WORLDPULSE')}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-center"
            >
              Return to WorldPulse 3D
            </button>
          </div>
        )}

        {activeTab === 'WORLDPULSE' && (
          <WorldPulseApp
            userMode={userMode}
            onToggleUserMode={handleToggleUserMode}
            selectedCountryIso={selectedCountryIso}
            onSelectCountryIso={setSelectedCountryIso}
            onNavigateLab={(target) => {
              setUserMode('ADVANCED');
              if (target === 'SLIPPAGE_LAB') setActiveTab('SLIPPAGE_MC');
              else if (target === 'FACTOR_BACKTEST') setActiveTab('FACTOR_BACKTEST');
              else if (target === 'QUANT_PHYSICS') setActiveTab('QUANT_PHYSICS');
              else if (target === 'AGENT_GOVERNANCE') setActiveTab('GOVERNANCE');
            }}
          />
        )}
        {activeTab === 'OVERVIEW' && (
          <OverviewCommandCentre
            backtest={backtestResult}
            slippage={slippageResult}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === 'SLIPPAGE_MC' && (
          <SlippageMonteCarloLab
            simResult={slippageResult}
            onUpdateResult={setSlippageResult}
          />
        )}
        {activeTab === 'FACTOR_BACKTEST' && (
          <FactorBacktestStudio
            backtest={backtestResult}
            onUpdateBacktest={setBacktestResult}
          />
        )}
        {activeTab === 'QUANT_PHYSICS' && <QuantPhysicsLab />}
        {activeTab === 'GOVERNANCE' && (
          <AutonomousGovernanceHub
            backtest={backtestResult}
            slippage={slippageResult}
          />
        )}
      </main>

      {/* Mobile & Tablet Thumb-Zone Bottom Navigation Bar (Consistent with Website Top Nav, < 15% Sticky Cap) */}
      <nav
        aria-label="Mobile and Tablet Quick Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-13 bg-[#050811]/95 backdrop-blur-md border-t border-slate-800/90 grid grid-cols-5 items-center px-1.5"
      >
        {worldPulseSections.map((sec) => (
          <a
            key={sec.href}
            href={sec.href}
            onClick={() => {
              if (activeTab !== 'WORLDPULSE') {
                setActiveTab('WORLDPULSE');
              }
            }}
            className="flex flex-col items-center justify-center min-h-[44px] text-[10px] sm:text-[11px] font-semibold text-slate-300 hover:text-cyan-300 active:text-cyan-400 transition-colors whitespace-nowrap truncate px-1"
          >
            <span>{sec.shortLabel}</span>
          </a>
        ))}
      </nav>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-slate-800/80 px-4 sm:px-6 py-4 text-xs text-slate-400">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            AlphaForge — Autonomous Quantitative Research Laboratory · Open-Source Deterministic Research Platform
          </div>
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span>Snapshot: {backtestResult.datasetSnapshotId}</span>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/AtharvaGadre/agent-verse-project"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 underline"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
