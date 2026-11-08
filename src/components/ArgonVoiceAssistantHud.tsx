import React, { useEffect, useRef, useState } from 'react';
import {
  ATMOSPHERE_WEATHER_LAYERS,
  WEATHER_MODEL_REGISTRY,
  executeArgonVoiceWorkflow,
  type ArgonInvestigationResult,
  type ArgonVoiceModelId,
  type AtmosphereWeatherLayerId,
} from '../engine/argonAtmosphereEngine.ts';
import {
  argonAudioManager,
  type ArgonAudioPreferences,
  type ArgonSoundEventLog,
  type ArgonVoicePersona,
} from '../engine/argonAudioManager.ts';
import { ArgonScientificReportModal } from './ArgonScientificReportModal.tsx';

interface ArgonVoiceAssistantHudProps {
  userMode: 'BASIC' | 'ADVANCED';
  currentCountryIso2: string;
  onNavigateGlobeToTarget: (
    lat: number,
    lng: number,
    rangeMeters: number,
    label: string,
    countryIso2?: string
  ) => void;
  activeWeatherLayers?: AtmosphereWeatherLayerId[];
  onChangeWeatherLayers?: (layers: AtmosphereWeatherLayerId[]) => void;
}

const STORAGE_KEY_ARGON_HISTORY = 'alphaforge_argon_investigation_history_v1';

export const ArgonVoiceAssistantHud: React.FC<ArgonVoiceAssistantHudProps> = ({
  userMode,
  currentCountryIso2,
  onNavigateGlobeToTarget,
  activeWeatherLayers: externalWeatherLayers,
  onChangeWeatherLayers,
}) => {
  // Configurable Gemini Live Model Selection
  const [selectedVoiceModel, setSelectedVoiceModel] =
    useState<ArgonVoiceModelId>('gemini-3.8-live-extended-thinking');

  // Voice & Microphone State (Never listens without explicit user consent)
  const [micPermissionGranted, setMicPermissionGranted] =
    useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState<boolean>(false);
  const [wakePhrase, setWakePhrase] = useState<string>('Hey ARGON');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [liveCaptionText, setLiveCaptionText] = useState<string>(
    'ARGON Ready · Say "Hey ARGON" (when mic is enabled) or enter any weather & market directive below.'
  );
  const [textInputQuery, setTextInputQuery] = useState<string>('');
  const [liveWsConnected, setLiveWsConnected] = useState<boolean>(false);

  // Expandable HUD Tabs
  const [hudExpanded, setHudExpanded] = useState<boolean>(true);
  const [activeHudSubTab, setActiveHudSubTab] = useState<
    | 'BRIEFING_AND_STEPS'
    | 'EPISTEMIC_MATRIX_AF'
    | 'MULTI_MODEL_ENSEMBLE'
    | 'WEATHER_LAYERS_17'
    | 'AUDIO_AND_HISTORY'
  >('BRIEFING_AND_STEPS');

  // Forecast Timeline Horizon Slider (-168h Historical Replay to +168h Forecast)
  const [timelineHorizonHours, setTimelineHorizonHours] = useState<number>(72);
  const [internalWeatherLayers, setInternalWeatherLayers] = useState<
    AtmosphereWeatherLayerId[]
  >(['TEMPERATURE', 'RAINFALL_ACCUMULATION', 'RAINFALL_ANOMALIES', 'SEVERE_WEATHER_WARNINGS']);

  const activeWeatherLayers = externalWeatherLayers ?? internalWeatherLayers;

  const handleToggleWeatherLayer = (layerId: AtmosphereWeatherLayerId) => {
    const exists = activeWeatherLayers.includes(layerId);
    const updated = exists
      ? activeWeatherLayers.filter((id) => id !== layerId)
      : [...activeWeatherLayers, layerId];
    setInternalWeatherLayers(updated);
    onChangeWeatherLayers?.(updated);
    argonAudioManager.triggerSound(
      'FORECAST_UPDATED',
      `Weather Layer ${exists ? 'Disabled' : 'Enabled'}: ${layerId}`
    );
  };

  // Audio Manager Preferences & Telemetry Log
  const [audioPrefs, setAudioPrefs] = useState<ArgonAudioPreferences>(() =>
    argonAudioManager.getPreferences()
  );
  const [latestSoundLog, setLatestSoundLog] = useState<ArgonSoundEventLog>({
    event: 'ARGON_ACTIVATED',
    timestampUtc: new Date().toISOString(),
    description: 'ARGON Neural Core Ready',
  });

  // Persistent Investigation History (survives voice-session or page restart)
  const [investigationHistory, setInvestigationHistory] = useState<
    ArgonInvestigationResult[]
  >(() => {
    const initialAsia = executeArgonVoiceWorkflow({
      query:
        "Hey ARGON, analyse last week's weather across Asia and tell me which financial markets have been affected and what next week's weather could mean for those markets.",
      currentCountryIso2: 'JP',
    });
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY_ARGON_HISTORY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.investigationId) {
            return parsed;
          }
        }
      } catch {
        // Fallback to initialAsia
      }
    }
    return [initialAsia];
  });

  const [activeInvestigation, setActiveInvestigation] =
    useState<ArgonInvestigationResult>(() => investigationHistory[0]);

  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);

  // SpeechRecognition & Gemini Live WebSocket Refs
  const recognitionRef = useRef<any>(null);
  const liveWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const unsubscribe = argonAudioManager.subscribe((log, speakingState) => {
      setLatestSoundLog(log);
      setIsSpeaking(speakingState);
    });
    return unsubscribe;
  }, []);

  // Save investigation history to localStorage whenever it updates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          STORAGE_KEY_ARGON_HISTORY,
          JSON.stringify(investigationHistory.slice(0, 12))
        );
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [investigationHistory]);

  /**
   * Executes an ARGON voice/text research command end-to-end:
   * 1. Interrupts any ongoing speech (barge-in)
   * 2. Calls backend `/api/v1/assistant/query` (which invokes Gemini + deterministic weather/market tools)
   * 3. Updates the 3D Globe camera, weather layers, A-F epistemic matrix, and 10-step trace
   * 4. Speaks the executive briefing aloud via Gemini 3.8 TTS / Live Audio
   */
  const runArgonInvestigationCommand = async (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    // Barge-in: immediately stop any ongoing speech
    argonAudioManager.stopSpeaking();
    argonAudioManager.triggerSound('RESEARCH_STARTED', `ARGON Investigating: "${trimmed.slice(0, 64)}"`);
    setIsProcessing(true);
    setLiveCaptionText(`ARGON Processing: "${trimmed}"...`);

    // 1. Compute immediate deterministic + stateful workflow baseline
    let nextResult = executeArgonVoiceWorkflow({
      query: trimmed,
      currentCountryIso2,
      previousInvestigation: activeInvestigation,
    });

    // 2. Query backend `/api/v1/assistant/query` for live Open-Meteo + Gemini 3.8 / 4 Argon tool synthesis
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5500);
      const response = await fetch('/api/v1/assistant/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          voiceModel: selectedVoiceModel,
          userMode,
          currentCountryIso2,
          previousScopeType: activeInvestigation.resolvedScope.scopeType,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const serverData = await response.json();
        if (serverData?.investigation?.investigationId) {
          nextResult = serverData.investigation;
        }
      }
    } catch {
      // Deterministic + cached workflow already computed in `nextResult`
    }

    argonAudioManager.triggerSound('DATA_RETRIEVED', 'Multi-model weather & market evidence verified');

    setActiveInvestigation(nextResult);
    setInvestigationHistory((prev) => [
      nextResult,
      ...prev.filter((item) => item.investigationId !== nextResult.investigationId).slice(0, 11),
    ]);

    // Synchronize 3D Globe Camera & Weather Layers
    argonAudioManager.triggerSound(
      'MAP_TRANSITION',
      `Globe Camera → ${nextResult.resolvedScope.regionLabel}`
    );
    onNavigateGlobeToTarget(
      nextResult.resolvedScope.targetLat,
      nextResult.resolvedScope.targetLng,
      nextResult.resolvedScope.targetRangeMeters,
      nextResult.resolvedScope.regionLabel,
      nextResult.resolvedScope.countryIso2
    );

    if (nextResult.resolvedScope.activeWeatherLayers.length > 0) {
      setInternalWeatherLayers(nextResult.resolvedScope.activeWeatherLayers);
      onChangeWeatherLayers?.(nextResult.resolvedScope.activeWeatherLayers);
    }

    argonAudioManager.triggerSound(
      'MODEL_COMPARISON_COMPLETE',
      `Ensemble ŷ = ${nextResult.modelComparison.ensembleResult.ensemblePrecipitationMm} mm`
    );

    setIsProcessing(false);

    // If the user explicitly asked to generate a report or show equations, open the relevant view
    const lower = trimmed.toLowerCase();
    if (lower.includes('report')) {
      setReportModalOpen(true);
      argonAudioManager.triggerSound('REPORT_GENERATED', '28-Section Scientific Report Opened');
    } else if (lower.includes('equation') || lower.includes('disagree') || lower.includes('model')) {
      setActiveHudSubTab('MULTI_MODEL_ENSEMBLE');
    }

    const spokenScript =
      userMode === 'BASIC'
        ? nextResult.spokenExecutiveBriefingBasic
        : nextResult.spokenExecutiveBriefingAdvanced;

    setLiveCaptionText(spokenScript);
    argonAudioManager.triggerSound('TASK_COMPLETED', 'ARGON Executive Briefing Ready');
    await argonAudioManager.speakText(spokenScript, (caption) => {
      setLiveCaptionText(caption);
    });
  };

  /**
   * Starts or stops explicit user-consented microphone listening.
   * Supports local wake-word detection ("Hey ARGON") and automatic end-of-utterance detection.
   */
  const handleToggleMicrophoneListening = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
      setIsListening(false);
      argonAudioManager.triggerSound('LISTENING_ENDED', 'Microphone listening stopped');
      return;
    }

    // Barge-in: stop speaking if ARGON is currently talking
    argonAudioManager.stopSpeaking();

    // Request explicit browser microphone permission
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately release raw track if SpeechRecognition manages its own stream
        stream.getTracks().forEach((t) => t.stop());
        setMicPermissionGranted(true);
      } catch {
        setLiveCaptionText(
          'Microphone permission unavailable or declined. Use the text input bar or quick voice directives below.'
        );
        argonAudioManager.triggerSound('TASK_FAILED', 'Microphone permission unavailable — using text/click fallback');
      }
    }

    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionClass) {
      setIsListening(true);
      argonAudioManager.triggerSound('LISTENING_STARTED', 'Voice channel active (Simulated / WebSocket mode)');
      setLiveCaptionText(
        'Listening active · Click any spoken prompt below or type in the command box.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = wakeWordEnabled;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        argonAudioManager.triggerSound('LISTENING_STARTED', 'Microphone active · Speak naturally to ARGON');
        setLiveCaptionText(
          wakeWordEnabled
            ? `Wake-Word Mode Active: Say "${wakePhrase}, ..." to trigger investigation.`
            : 'Listening... Speak your weather or market research question now.'
        );
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interim += transcript;
          }
        }

        if (interim) {
          // Barge-in on user voice activity
          argonAudioManager.stopSpeaking();
          setLiveCaptionText(`Hearing: "${interim}"...`);
        }

        if (finalTranscript.trim()) {
          const cleaned = finalTranscript.trim();
          if (wakeWordEnabled) {
            const normWake = wakePhrase.toLowerCase();
            if (
              cleaned.toLowerCase().includes(normWake) ||
              cleaned.toLowerCase().includes('argon')
            ) {
              argonAudioManager.triggerSound('ARGON_ACTIVATED', 'Wake word "Hey ARGON" recognized');
              void runArgonInvestigationCommand(cleaned);
            } else {
              setLiveCaptionText(
                `Heard "${cleaned}" (Waiting for wake phrase "${wakePhrase}")`
              );
            }
          } else {
            setIsListening(false);
            argonAudioManager.triggerSound('LISTENING_ENDED', 'Utterance captured');
            void runArgonInvestigationCommand(cleaned);
          }
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        if (!wakeWordEnabled) {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Optional Gemini Live WebSocket Bridge Connection Toggle (`/api/v1/argon/live-ws`)
  const handleToggleGeminiLiveWebSocket = () => {
    if (liveWsConnected && liveWsRef.current) {
      liveWsRef.current.close();
      liveWsRef.current = null;
      setLiveWsConnected(false);
      return;
    }

    if (typeof window === 'undefined') return;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${proto}//${window.location.host}/api/v1/argon/live-ws?model=${encodeURIComponent(
          selectedVoiceModel
        )}&voice=${encodeURIComponent(audioPrefs.voicePersona)}`
      );
      ws.onopen = () => {
        setLiveWsConnected(true);
        argonAudioManager.triggerSound(
          'ARGON_ACTIVATED',
          `Connected to Gemini Live API (${selectedVoiceModel})`
        );
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.outputTranscript) {
            setLiveCaptionText(msg.outputTranscript);
          }
          if (msg.investigation && msg.investigation.investigationId) {
            setActiveInvestigation(msg.investigation);
          }
        } catch {
          // Ignore malformed WS frames
        }
      };
      ws.onclose = () => {
        setLiveWsConnected(false);
      };
      ws.onerror = () => {
        setLiveWsConnected(false);
      };
      liveWsRef.current = ws;
    } catch {
      setLiveWsConnected(false);
    }
  };

  const ens = activeInvestigation.modelComparison.ensembleResult;
  const ver = activeInvestigation.modelComparison.verificationMetrics;

  return (
    <section
      aria-label="ARGON Gemini-Powered Autonomous Voice Weather and Market Intelligence Assistant"
      className="rounded-2xl bg-gradient-to-b from-[#071022]/98 to-[#050914]/98 border border-cyan-400/50 shadow-[0_0_35px_rgba(34,211,238,0.12)] p-3.5 sm:p-5 space-y-4 overflow-hidden"
    >
      {/* ===================================================================== */}
      {/* TOP BAR: ARGON IDENTITY, WAVEFORM, MODEL SELECTOR & VOICE CONTROLS    */}
      {/* ===================================================================== */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-800/90 pb-3.5">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          {/* Animated ARGON Core Orb & Audio-Reactive Waveform */}
          <div
            aria-hidden="true"
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 transition-all ${
              isListening
                ? 'bg-rose-500/25 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.5)]'
                : isSpeaking
                ? 'bg-cyan-500/25 border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.5)]'
                : isProcessing
                ? 'bg-amber-500/25 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                : 'bg-cyan-500/15 border-cyan-500/40'
            }`}
          >
            <div className="flex items-end gap-0.5 h-5">
              {[0.5, 0.9, 0.65, 1.0, 0.7].map((bar, idx) => (
                <span
                  key={idx}
                  style={{
                    height:
                      (isListening || isSpeaking || isProcessing) &&
                      !audioPrefs.reducedMotion
                        ? `${Math.round(bar * 18)}px`
                        : '6px',
                  }}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isListening
                      ? 'bg-rose-400 animate-pulse'
                      : isSpeaking
                      ? 'bg-cyan-300 animate-bounce'
                      : isProcessing
                      ? 'bg-amber-300 animate-pulse'
                      : 'bg-cyan-400/80'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-400 text-slate-950 text-[11px] font-mono font-extrabold uppercase tracking-wider">
                ARGON · VOICE WEATHER &amp; MARKET AI
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isListening
                    ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                    : isSpeaking
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : isProcessing
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {isListening
                  ? '● MIC ACTIVE · LISTENING'
                  : isSpeaking
                  ? '◉ SPEAKING BRIEFING (INTERRUPTIBLE)'
                  : isProcessing
                  ? '◌ EXECUTING RESEARCH TOOLS'
                  : '◎ STANDBY (MIC OFF UNTIL ENABLED)'}
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                SFX: {latestSoundLog.event}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white mt-1 truncate">
              AlphaForge Atmosphere · What&apos;s Happening, What&apos;s Next, How Confident Are We &amp; Why It Matters
            </h2>
          </div>
        </div>

        {/* Right Controls: Gemini Live Model Selector + Mic / Wake-Word / Stop / Report Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Configurable Gemini Live Model Selector */}
          <label className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-slate-300">
            <span className="text-cyan-400 font-bold">MODEL:</span>
            <select
              aria-label="Select ARGON Gemini Voice Model"
              value={selectedVoiceModel}
              onChange={(e) =>
                setSelectedVoiceModel(e.target.value as ArgonVoiceModelId)
              }
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="gemini-3.8-live-extended-thinking" className="bg-slate-950">
                gemini-3.8-live-extended-thinking (Complex Research)
              </option>
              <option value="gemini-3.8-live" className="bg-slate-950">
                gemini-3.8-live (Fast Voice)
              </option>
            </select>
          </label>

          {/* Click-to-Talk / Enable Microphone Button */}
          <button
            type="button"
            onClick={handleToggleMicrophoneListening}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-500 text-white border-rose-300 shadow-lg'
                : 'bg-cyan-400 text-slate-950 border-cyan-300 hover:bg-cyan-300 shadow-md'
            }`}
          >
            {isListening ? '■ Stop Listening' : '🎙 Enable Mic / Speak to ARGON'}
          </button>

          {/* Opt-In Local Wake-Word Toggle ("Hey ARGON") */}
          <button
            type="button"
            onClick={() => {
              const next = !wakeWordEnabled;
              setWakeWordEnabled(next);
              argonAudioManager.triggerSound(
                'ARGON_ACTIVATED',
                next
                  ? `Wake-Word "${wakePhrase}" Opt-In Enabled`
                  : 'Wake-Word Detection Disabled'
              );
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              wakeWordEnabled
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Wake &quot;{wakePhrase}&quot;: {wakeWordEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Interrupt / Stop Speaking Control */}
          <button
            type="button"
            onClick={() => {
              argonAudioManager.stopSpeaking();
              setLiveCaptionText('Spoken briefing interrupted by user.');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-amber-400 text-xs font-semibold text-amber-300 cursor-pointer"
          >
            ⏹ Stop Speaking
          </button>

          {/* Open 28-Section Interactive Report Viewer */}
          <button
            type="button"
            onClick={() => {
              setReportModalOpen(true);
              argonAudioManager.triggerSound(
                'REPORT_GENERATED',
                'Opened 28-Section Interactive Scientific Report Viewer'
              );
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-400 text-slate-950 text-xs font-extrabold hover:bg-emerald-300 transition-colors cursor-pointer"
          >
            📄 28-Section Report &amp; PDF
          </button>

          <button
            type="button"
            onClick={() => setHudExpanded(!hudExpanded)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white cursor-pointer"
          >
            {hudExpanded ? ' Collapse [–]' : 'Expand [+]'}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* NATURAL VOICE / TEXT INPUT BAR & ONE-CLICK FLAGSHIP WORKFLOWS         */}
      {/* ===================================================================== */}
      <div className="space-y-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (textInputQuery.trim()) {
              void runArgonInvestigationCommand(textInputQuery);
            }
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <input
            type="text"
            value={textInputQuery}
            onChange={(e) => setTextInputQuery(e.target.value)}
            placeholder='Ask ARGON anything, e.g. "Hey ARGON, analyse last week&#39;s weather across Asia and tell me which financial markets have been affected..."'
            aria-label="Ask ARGON Voice or Text Research Directive"
            className="flex-1 bg-slate-950 border border-cyan-500/40 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 text-xs font-extrabold hover:from-cyan-300 hover:to-emerald-300 transition-all shadow-md cursor-pointer"
            >
              {isProcessing ? 'ARGON Researching...' : 'Ask ARGON →'}
            </button>
            <button
              type="button"
              onClick={() =>
                argonAudioManager.speakText(
                  userMode === 'BASIC'
                    ? activeInvestigation.spokenExecutiveBriefingBasic
                    : activeInvestigation.spokenExecutiveBriefingAdvanced
                )
              }
              className="px-3 py-2 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
            >
              🔊 Replay Audio
            </button>
          </div>
        </form>

        {/* Flagship Acceptance Workflow Triggers & Stateful Follow-Up Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold mr-1">
            FLAGSHIP VOICE WORKFLOWS:
          </span>
          <button
            type="button"
            onClick={() =>
              void runArgonInvestigationCommand(
                "Hey ARGON, analyse last week's weather across Asia and tell me which financial markets have been affected and what next week's weather could mean for those markets."
              )
            }
            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[11px] font-semibold hover:bg-cyan-500/30 cursor-pointer"
          >
            🌏 1. Asia Weather-to-Market (Last 7d &amp; Next 7d)
          </button>
          <button
            type="button"
            onClick={() =>
              void runArgonInvestigationCommand(
                'Hey ARGON, analyse the rainfall forecasts for Brazil, compare the major models, explain the uncertainty and generate a detailed report on the potential effects on coffee production and prices.'
              )
            }
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-[11px] font-semibold hover:bg-emerald-500/30 cursor-pointer"
          >
            ☕ 2. Brazil Coffee Rainfall &amp; Model Math
          </button>
          {activeInvestigation.followUpSuggestions.slice(0, 5).map((followUp) => (
            <button
              key={followUp}
              type="button"
              onClick={() => void runArgonInvestigationCommand(followUp)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-400/50 text-slate-300 hover:text-white text-[11px] cursor-pointer"
            >
              &ldquo;{followUp}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* Live Captions & Spoken Briefing Banner */}
      <div
        aria-live="polite"
        className="rounded-xl bg-slate-950/95 border border-cyan-500/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div className="space-y-0.5 min-w-0">
          <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold">
            ARGON LIVE CAPTION &amp; SPOKEN TRANSCRIPT ({userMode} MODE · VOICE: {audioPrefs.voicePersona.toUpperCase()})
          </div>
          <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
            {liveCaptionText}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              argonAudioManager.speakText(
                activeInvestigation.thirtySecondSpokenSummary,
                (c) => setLiveCaptionText(c)
              )
            }
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-[11px] font-mono text-cyan-300 cursor-pointer"
          >
            30s Audio Brief
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* EXPANDABLE ARGON WORKSPACE: 5 SUB-TABS                                */}
      {/* ===================================================================== */}
      {hudExpanded && (
        <div className="space-y-4 pt-1">
          {/* Sub-Navigation Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-1.5">
            {(
              [
                {
                  id: 'BRIEFING_AND_STEPS',
                  label: '1. Investigation & 10-Step Trace',
                  badge: `${activeInvestigation.workflowSteps.length} Steps`,
                },
                {
                  id: 'EPISTEMIC_MATRIX_AF',
                  label: '2. Epistemic Matrix (A–F) & Watchlist',
                  badge: 'Observed vs Forecast',
                },
                {
                  id: 'MULTI_MODEL_ENSEMBLE',
                  label: '3. Multi-Model Math (ŷ = Σwᵢŷᵢ)',
                  badge: `${ens.ensemblePrecipitationMm} mm`,
                },
                {
                  id: 'WEATHER_LAYERS_17',
                  label: '4. 17 Weather Layers & Timeline',
                  badge: `${activeWeatherLayers.length}/17 Active`,
                },
                {
                  id: 'AUDIO_AND_HISTORY',
                  label: '5. Audio Engine & Saved History',
                  badge: `${investigationHistory.length} Saved`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveHudSubTab(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                  activeHudSubTab === tab.id
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-sm'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="truncate">{tab.label}</span>
                <span className="text-[10px] font-mono text-cyan-300 shrink-0">
                  {tab.badge}
                </span>
              </button>
            ))}
          </div>

          {/* TAB 1: INVESTIGATION SUMMARY & 10-STEP TOOL EXECUTION TRACE */}
          {activeHudSubTab === 'BRIEFING_AND_STEPS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 5 Cols: Three Core Questions Summary */}
              <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-cyan-300 font-bold">
                    ACTIVE SCOPE: {activeInvestigation.resolvedScope.regionLabel}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300">
                    {activeInvestigation.investigationId}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="font-bold text-cyan-300">
                      1. What&apos;s happening with the weather? (Observed)
                    </div>
                    <p className="text-slate-200 mt-1">
                      {activeInvestigation.epistemicMatrix.A_whatWeatherOccurred[0]}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="font-bold text-emerald-300">
                      2. What is likely to happen next? (Forecast: {activeInvestigation.resolvedScope.forecastWindowLabel})
                    </div>
                    <p className="text-slate-200 mt-1">
                      {activeInvestigation.epistemicMatrix.B_whatModelsPredict[0]}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="font-bold text-amber-300">
                      3. How confident are we, and why does it matter?
                    </div>
                    <p className="text-slate-200 mt-1">
                      {ens.disagreementExplanation}{' '}
                      {activeInvestigation.epistemicMatrix.C_economicMechanisms[0]}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right 7 Cols: Step-by-Step Tool Execution Trace */}
              <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5 max-h-[340px] overflow-y-auto">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="text-cyan-300 font-bold uppercase">
                    ARGON AUTONOMOUS ORCHESTRATOR · TOOL EXECUTION LOG
                  </span>
                  <span>
                    Historical: {activeInvestigation.resolvedScope.historicalWindowLabel}
                  </span>
                </div>
                <div className="space-y-2">
                  {activeInvestigation.workflowSteps.map((step) => (
                    <div
                      key={step.stepNumber}
                      className="p-2.5 rounded-lg bg-slate-900/85 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1 font-mono">
                        <span className="font-bold text-white">
                          {step.stepTitle}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          Tool: {step.toolCalled}()
                        </span>
                      </div>
                      <p className="text-slate-200 leading-relaxed">
                        {step.summary}
                      </p>
                      <div className="text-[10px] font-mono text-slate-400">
                        Source: {step.sourceCitation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EPISTEMIC SEPARATION MATRIX (A-F) & CONDITIONAL RESEARCH WATCHLIST */}
          {activeHudSubTab === 'EPISTEMIC_MATRIX_AF' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  {
                    title: 'A. What Weather Actually Occurred (Observed)',
                    items: activeInvestigation.epistemicMatrix.A_whatWeatherOccurred,
                    color: 'text-cyan-300 border-cyan-500/40',
                  },
                  {
                    title: 'B. What Forecasting Models Predict',
                    items: activeInvestigation.epistemicMatrix.B_whatModelsPredict,
                    color: 'text-emerald-300 border-emerald-500/40',
                  },
                  {
                    title: 'C. Economic Transmission Mechanisms',
                    items: activeInvestigation.epistemicMatrix.C_economicMechanisms,
                    color: 'text-purple-300 border-purple-500/40',
                  },
                  {
                    title: 'D. What Asset Prices Actually Did (Observed)',
                    items: activeInvestigation.epistemicMatrix.D_whatAssetPricesDid,
                    color: 'text-amber-300 border-amber-500/40',
                  },
                  {
                    title: 'E. Model-Supported Future Scenarios',
                    items:
                      activeInvestigation.epistemicMatrix.E_modelSupportedFutureScenarios,
                    color: 'text-cyan-200 border-cyan-400/40',
                  },
                  {
                    title: 'F. What Remains Uncertain or Unverified',
                    items:
                      activeInvestigation.epistemicMatrix
                        .F_whatRemainsUncertainOrUnverified,
                    color: 'text-rose-300 border-rose-500/40',
                  },
                ].map((box) => (
                  <div
                    key={box.title}
                    className={`bg-slate-950 border rounded-xl p-3.5 space-y-2 ${box.color}`}
                  >
                    <div className="text-xs font-mono font-bold uppercase">
                      {box.title}
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-200 list-disc list-inside">
                      {box.items.map((it, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Conditional Research Watchlist (Never claims guaranteed buy/sell outcomes) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-amber-300 uppercase">
                    EVIDENCE-BACKED CONDITIONAL RESEARCH WATCHLIST (NO LIVE ORDER EXECUTION)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Co-occurrence ≠ Causation · All hypotheses include invalidation criteria &amp; transaction costs
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {activeInvestigation.conditionalWatchlist.map((item) => (
                    <div
                      key={item.instrument}
                      className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-cyan-300">
                          {item.instrument} · {item.name}
                        </span>
                        <span className="text-emerald-300">
                          7d Obs: {item.observed7DayMovePct}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        <strong>Observed Attribution:</strong>{' '}
                        {item.observedMoveAttributionNote}
                      </p>
                      <p className="text-[11px] text-emerald-200">
                        <strong>Positive Scenario:</strong>{' '}
                        {item.positiveWeatherScenario}
                      </p>
                      <p className="text-[11px] text-rose-200">
                        <strong>Negative Scenario:</strong>{' '}
                        {item.negativeWeatherScenario}
                      </p>
                      <div className="p-2 rounded bg-slate-950 border border-amber-500/30 text-[11px] font-mono text-amber-200">
                        {item.conditionalHypothesisLabel} (Cost: {item.transactionCostAssumptionBps} bps)
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        <strong>Invalidation:</strong> {item.invalidationCriteria}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MULTI-MODEL ENSEMBLE MATHEMATICS & VERIFICATION */}
          {activeHudSubTab === 'MULTI_MODEL_ENSEMBLE' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 overflow-x-auto">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-cyan-300 uppercase">
                    MULTI-MODEL ENSEMBLE SYNTHESIS: ŷ = Σ(wᵢ × ŷᵢ), Σwᵢ = {ens.weightSumCheck}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-300">
                    90% Calibrated PI: [{ens.calibrated90PctIntervalMm[0]}, {ens.calibrated90PctIntervalMm[1]}] mm
                  </span>
                </div>

                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-1.5 pr-2">Model</th>
                      <th className="py-1.5 px-2">Weight wᵢ</th>
                      <th className="py-1.5 px-2">Precip ŷᵢ</th>
                      <th className="py-1.5 px-2">Temp</th>
                      <th className="py-1.5 px-2">Wind</th>
                      <th className="py-1.5 pl-2">P(&gt;20mm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-200">
                    {activeInvestigation.modelComparison.modelInputs.map(
                      (m, idx) => {
                        const nw = ens.normalizedWeights[idx]?.weight ?? m.weight;
                        return (
                          <tr key={m.modelId}>
                            <td className="py-1.5 pr-2 font-bold text-white">
                              {m.modelName}
                            </td>
                            <td className="py-1.5 px-2 text-cyan-300">
                              {nw.toFixed(3)}
                            </td>
                            <td className="py-1.5 px-2">
                              {m.predictedPrecipitationMm} mm
                            </td>
                            <td className="py-1.5 px-2">
                              {m.predictedTemperatureC}°C
                            </td>
                            <td className="py-1.5 px-2">
                              {m.predictedWindSpeedMs} m/s
                            </td>
                            <td className="py-1.5 pl-2">
                              {Math.round(m.probExceedance20Mm * 100)}%
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200">
                  <strong className="text-amber-300">
                    Model Disagreement Analysis ({ens.disagreementIndexMm} mm Spread):
                  </strong>{' '}
                  {ens.disagreementExplanation}
                </div>
              </div>

              <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-mono font-bold text-purple-300 uppercase">
                  OUT-OF-SAMPLE VERIFICATION &amp; CALIBRATION METRICS
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Validation Dataset: {ver.validationPeriodLabel} (N = {ver.sampleSizeN})
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">MAE = mean(|y - ŷ|)</div>
                    <div className="text-sm font-bold text-white">{ver.mae} mm</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">RMSE (±SE)</div>
                    <div className="text-sm font-bold text-cyan-300">
                      {ver.rmse} ± {ver.rmseStandardError} mm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">CRPS / Brier Skill</div>
                    <div className="text-sm font-bold text-emerald-300">
                      {ver.crps} mm / BSS {ver.brierSkillScore}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">90% PI Coverage</div>
                    <div className="text-sm font-bold text-amber-300">
                      {ver.predictionIntervalCoverage90Pct}% (Nominal 90%)
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong>Ensemble Spread vs Calibrated Uncertainty:</strong> Raw ensemble spread is{' '}
                  <span className="font-mono text-white">{ens.rawEnsembleSpreadMm} mm</span>, whereas post-EMOS calibrated predictive standard deviation is{' '}
                  <span className="font-mono text-cyan-300">{ens.calibratedPredictiveStdMm} mm</span>.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: ALL 17 WEATHER LAYERS & OBSERVATION/FORECAST TIMELINE */}
          {activeHudSubTab === 'WEATHER_LAYERS_17' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
              {/* Observation & Forecast Timeline Slider */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono font-bold text-cyan-300 uppercase">
                    OBSERVATION &amp; FORECAST HORIZON TIMELINE ({timelineHorizonHours < 0 ? `HISTORICAL REPLAY ${timelineHorizonHours}h` : timelineHorizonHours === 0 ? 'CURRENT OBSERVATION (0h UTC)' : `FORECAST LEAD TIME +${timelineHorizonHours}h`})
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Scrub from preceding 7-day observations (-168h) through current synoptic analysis (0h) to 7-day multi-model forecasts (+168h).
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-80 font-mono text-xs">
                  <span className="text-slate-400">-168h</span>
                  <input
                    type="range"
                    min={-168}
                    max={168}
                    step={12}
                    value={timelineHorizonHours}
                    onChange={(e) => {
                      setTimelineHorizonHours(Number(e.target.value));
                      argonAudioManager.triggerSound('FORECAST_UPDATED');
                    }}
                    aria-label="Observation and Forecast Horizon Timeline Hours"
                    className="flex-1 accent-cyan-400"
                  />
                  <span className="text-cyan-300 font-bold">+168h</span>
                </div>
              </div>

              {/* 17 Weather Layers Grid with Legends */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {ATMOSPHERE_WEATHER_LAYERS.map((layer) => {
                  const isEnabled = activeWeatherLayers.includes(layer.id);
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => handleToggleWeatherLayer(layer.id)}
                      className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer space-y-1 ${
                        isEnabled
                          ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-sm'
                          : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold truncate">
                          {layer.label}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-300 shrink-0">
                          {layer.unit}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        {layer.provider}
                      </div>
                      <div className="flex items-center gap-1 pt-0.5">
                        {layer.legendStops.map((stop) => (
                          <span
                            key={stop.valueLabel}
                            style={{ backgroundColor: stop.colorHex }}
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold text-slate-950"
                          >
                            {stop.valueLabel}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: CINEMATIC AUDIO CONTROLS, GEMINI LIVE WS & PERSISTENT RESEARCH HISTORY */}
          {activeHudSubTab === 'AUDIO_AND_HISTORY' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 6 Cols: Independent Speech & Sound Effects Controls */}
              <div className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-300 uppercase">
                    ARGON CINEMATIC WEB AUDIO ENGINE &amp; VOICE PERSONA
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleGeminiLiveWebSocket}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border cursor-pointer ${
                      liveWsConnected
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-900 border-slate-700 text-cyan-300 hover:border-cyan-400'
                    }`}
                  >
                    {liveWsConnected
                      ? '● Gemini Live WS Stream Connected'
                      : 'Connect Gemini Live WebSocket'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <label className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
                    <div className="flex justify-between text-cyan-300">
                      <span>Speech Volume</span>
                      <span>
                        {audioPrefs.speechMuted
                          ? 'MUTED'
                          : `${Math.round(audioPrefs.speechVolume * 100)}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={audioPrefs.speechVolume}
                      onChange={(e) =>
                        setAudioPrefs(
                          argonAudioManager.updatePreferences({
                            speechVolume: Number(e.target.value),
                            speechMuted: false,
                          })
                        )
                      }
                      className="w-full accent-cyan-400"
                    />
                  </label>

                  <label className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
                    <div className="flex justify-between text-emerald-300">
                      <span>UI Sound Effects Volume</span>
                      <span>
                        {audioPrefs.sfxMuted
                          ? 'MUTED'
                          : `${Math.round(audioPrefs.sfxVolume * 100)}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={audioPrefs.sfxVolume}
                      onChange={(e) =>
                        setAudioPrefs(
                          argonAudioManager.updatePreferences({
                            sfxVolume: Number(e.target.value),
                            sfxMuted: false,
                          })
                        )
                      }
                      className="w-full accent-emerald-400"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setAudioPrefs(
                        argonAudioManager.updatePreferences({
                          speechMuted: !audioPrefs.speechMuted,
                        })
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg font-mono border cursor-pointer ${
                      audioPrefs.speechMuted
                        ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  >
                    Speech Mute: {audioPrefs.speechMuted ? 'ON' : 'OFF'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setAudioPrefs(
                        argonAudioManager.updatePreferences({
                          sfxMuted: !audioPrefs.sfxMuted,
                        })
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg font-mono border cursor-pointer ${
                      audioPrefs.sfxMuted
                        ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  >
                    SFX Mute: {audioPrefs.sfxMuted ? 'ON' : 'OFF'}
                  </button>

                  <label className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono">
                    <span className="text-slate-400">Voice:</span>
                    <select
                      aria-label="Select ARGON Synthesized Voice Persona"
                      value={audioPrefs.voicePersona}
                      onChange={(e) =>
                        setAudioPrefs(
                          argonAudioManager.updatePreferences({
                            voicePersona: e.target.value as ArgonVoicePersona,
                          })
                        )
                      }
                      className="bg-transparent text-cyan-300 font-bold focus:outline-none"
                    >
                      {(['Zephyr', 'Kore', 'Fenrir', 'Puck', 'Charon'] as const).map(
                        (v) => (
                          <option key={v} value={v} className="bg-slate-950">
                            {v}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>

                <div className="text-[11px] font-mono text-slate-400">
                  Weather Model Registry Active:{' '}
                  {WEATHER_MODEL_REGISTRY.map((m) => m.modelId).join(' · ')}
                </div>
              </div>

              {/* Right 6 Cols: Persistent Research History (Survives Restart) */}
              <div className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5 max-h-[260px] overflow-y-auto">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-emerald-300 uppercase">
                    PERSISTED INVESTIGATION &amp; REPORT HISTORY (SURVIVES SESSION RESTART)
                  </span>
                  <span className="text-slate-400">
                    {investigationHistory.length} Records
                  </span>
                </div>
                <div className="space-y-2">
                  {investigationHistory.map((item) => {
                    const isCurrent =
                      item.investigationId === activeInvestigation.investigationId;
                    return (
                      <div
                        key={item.investigationId}
                        onClick={() => {
                          setActiveInvestigation(item);
                          onNavigateGlobeToTarget(
                            item.resolvedScope.targetLat,
                            item.resolvedScope.targetLng,
                            item.resolvedScope.targetRangeMeters,
                            item.resolvedScope.regionLabel,
                            item.resolvedScope.countryIso2
                          );
                        }}
                        className={`p-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          isCurrent
                            ? 'bg-cyan-950/40 border-cyan-400 text-white'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {item.resolvedScope.regionLabel}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            &ldquo;{item.userQuery}&rdquo;
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-cyan-300 shrink-0">
                          ŷ={item.modelComparison.ensembleResult.ensemblePrecipitationMm}mm
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 28-Section Interactive Report Viewer Modal */}
      {reportModalOpen && (
        <ArgonScientificReportModal
          investigation={activeInvestigation}
          userMode={userMode}
          onClose={() => setReportModalOpen(false)}
          onUpdateInvestigation={(updated) => setActiveInvestigation(updated)}
        />
      )}
    </section>
  );
};
