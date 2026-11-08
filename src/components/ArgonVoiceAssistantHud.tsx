// ============================================================================
// ALPHAFORGE ATMOSPHERE — FUTURISTIC ARGON FLOATING ORB & HUD
// Compact Floating Orb (Bottom-Right, Collapsed by Default)
// Supports Method A (Mic Button), Method B ("Hey ARGON" Opt-In Wake Word),
// and Text Command Bar
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Send,
  ChevronDown,
  FileText,
  Sparkles,
  ArrowUpRight,
  Radio,
} from 'lucide-react';
import { atmosphereStore } from '../state/atmosphereStore';
import {
  argonVoiceStateMachine,
  type ArgonVoiceStatusSnapshot,
} from '../engine/argonVoiceStateMachine';

export interface ArgonVoiceAssistantHudProps {
  selectedCountry?: string;
  userMode?: string;
  currentCountryIso2?: string;
  onNavigateGlobeToTarget?: (
    lat: number,
    lng: number,
    rangeMeters: number,
    label: string,
    countryIso2?: string
  ) => void;
  onExecuteNavigationCommand?: (cmd: any) => void;
  onOpenScientificReport?: (report: any) => void;
}

export const ArgonVoiceAssistantHud: React.FC<
  ArgonVoiceAssistantHudProps
> = () => {
  const [voiceSnap, setVoiceSnap] = useState<ArgonVoiceStatusSnapshot>(() =>
    argonVoiceStateMachine.getSnapshot()
  );
  const [textCommand, setTextCommand] = useState('');

  useEffect(() => {
    argonVoiceStateMachine.connectLiveWebSocket();
    return argonVoiceStateMachine.subscribe(setVoiceSnap);
  }, []);

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textCommand.trim()) return;
    const cmd = textCommand.trim();
    setTextCommand('');
    void argonVoiceStateMachine.processUserUtterance(cmd);
  };

  const stateBadgeLabel: Record<string, string> = {
    DISABLED: 'Standby',
    READY: 'ARGON',
    WAKE_LISTENING: 'Listening for "Hey ARGON"',
    ACTIVE_LISTENING: 'Listening...',
    PROCESSING: 'Researching...',
    SPEAKING: 'Speaking...',
    PERMISSION_DENIED: 'Mic Blocked · Text Ready',
    CONNECTING: 'Connecting...',
    RECONNECTING: 'Reconnecting...',
    OFFLINE: 'Offline Fallback',
    ERROR: 'Attention',
  };

  const isListening = voiceSnap.state === 'ACTIVE_LISTENING';
  const isSpeaking = voiceSnap.state === 'SPEAKING';
  const isProcessing = voiceSnap.state === 'PROCESSING';

  return (
    <div
      className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2.5 pointer-events-auto"
      data-testid="argon-hud-container"
    >
      {/* First-Visit Hands-Free Opt-In Prompt */}
      {!voiceSnap.handsFreePromptDismissed && !voiceSnap.argonExpanded && (
        <div
          data-testid="argon-hands-free-prompt"
          className="w-80 bg-slate-950/92 backdrop-blur-xl border border-sky-500/40 rounded-2xl p-3.5 shadow-2xl text-slate-100"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            Enable hands-free ARGON?
          </div>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
            Allow microphone access to activate ARGON by saying{' '}
            <span className="text-white font-semibold">
              &ldquo;Hey ARGON&rdquo;
            </span>
            , or use the microphone button anytime.
          </p>
          <div className="flex items-center gap-1.5 mt-2.5">
            <button
              type="button"
              onClick={() =>
                void argonVoiceStateMachine.enableHandsFreeWakeWord()
              }
              data-testid="enable-hands-free-btn"
              className="px-2.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-[11px] transition-colors"
            >
              Enable hands-free
            </button>
            <button
              type="button"
              onClick={() => {
                argonVoiceStateMachine.dismissHandsFreePrompt();
                argonVoiceStateMachine.setArgonExpanded(true);
              }}
              data-testid="use-mic-button-btn"
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] border border-slate-700"
            >
              Use mic button
            </button>
            <button
              type="button"
              onClick={() => argonVoiceStateMachine.dismissHandsFreePrompt()}
              data-testid="dismiss-hands-free-btn"
              className="px-2 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-[11px]"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Expanded Compact ARGON Assistant Card */}
      {voiceSnap.argonExpanded && (
        <div
          data-testid="argon-expanded-panel"
          className="w-[92vw] max-w-sm bg-slate-950/92 backdrop-blur-2xl border border-slate-800/90 rounded-2xl p-4 shadow-2xl text-slate-100 space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isListening
                    ? 'bg-emerald-400 animate-ping'
                    : isSpeaking
                    ? 'bg-sky-400 animate-pulse'
                    : isProcessing
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-sky-400'
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  ARGON Voice Intelligence
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                    {stateBadgeLabel[voiceSnap.state] || voiceSnap.state}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {voiceSnap.liveModelId} ·{' '}
                  {voiceSnap.handsFreeEnabled
                    ? '"Hey ARGON" Wake Active'
                    : 'Push-to-Talk Ready'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => argonVoiceStateMachine.setArgonExpanded(false)}
              aria-label="Collapse ARGON panel"
              data-testid="argon-collapse-btn"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Live Audio Waveform Strip */}
          {(isListening || isSpeaking || isProcessing) && (
            <div className="flex items-center justify-center gap-1 h-8 bg-slate-900/80 rounded-xl px-3 border border-slate-800/80">
              {voiceSnap.waveformBins.map((val, idx) => (
                <span
                  key={idx}
                  className={`w-1.5 rounded-full transition-all duration-75 ${
                    isListening
                      ? 'bg-emerald-400'
                      : isSpeaking
                      ? 'bg-sky-400'
                      : 'bg-amber-400'
                  }`}
                  style={{ height: `${Math.max(4, Math.round(val * 26))}px` }}
                />
              ))}
            </div>
          )}

          {/* Concise Tool / Research Step */}
          {voiceSnap.activeToolStep && (
            <div className="text-[11px] text-sky-300 font-mono bg-sky-500/10 border border-sky-500/20 rounded-xl px-3 py-1.5">
              {voiceSnap.activeToolStep}
            </div>
          )}

          {/* User Transcript & Live ARGON Caption */}
          {(voiceSnap.lastTranscript || voiceSnap.activeCaption) && (
            <div className="bg-slate-900/75 border border-slate-800/80 rounded-xl p-3 space-y-1.5 max-h-36 overflow-y-auto">
              {voiceSnap.lastTranscript && (
                <div className="text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">You: </span>
                  &ldquo;{voiceSnap.lastTranscript}&rdquo;
                </div>
              )}
              {voiceSnap.activeCaption && (
                <div
                  className="text-xs text-slate-100 leading-relaxed"
                  data-testid="argon-live-caption"
                >
                  {voiceSnap.activeCaption}
                </div>
              )}
            </div>
          )}

          {/* Error / Permission Recovery Message */}
          {voiceSnap.errorMessage && (
            <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
              {voiceSnap.errorMessage}
            </div>
          )}

          {/* Quick Scenario Prompts */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              {
                label: 'Asia Weather & Markets',
                prompt:
                  "Hey ARGON, how have last week's weather patterns across Asia affected the markets, and which sectors could be affected by next week's forecast?",
              },
              {
                label: 'Brazil Coffee Forecast',
                prompt:
                  'Hey ARGON, compare the rainfall and temperature forecast for Brazil coffee regions over the next 7 days and explain whether Arabica coffee prices could be affected.',
              },
              {
                label: 'London 24h Rain & Wind',
                prompt: 'Fly to London and show rainfall and wind for tomorrow.',
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() =>
                  void argonVoiceStateMachine.processUserUtterance(item.prompt)
                }
                data-testid={`argon-quick-prompt-${item.label
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')}`}
                className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white whitespace-nowrap transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Voice + Text Input Bar */}
          <form onSubmit={handleSubmitText} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (isListening) {
                  argonVoiceStateMachine.stopListening();
                } else {
                  void argonVoiceStateMachine.startActiveListening();
                }
              }}
              aria-label={isListening ? 'Stop listening' : 'Start voice input'}
              data-testid="argon-mic-toggle-btn"
              className={`p-2 rounded-xl border transition-colors shrink-0 ${
                isListening
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-slate-900 hover:bg-slate-800 text-sky-300 border-slate-700'
              }`}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {isSpeaking && (
              <button
                type="button"
                onClick={() => argonVoiceStateMachine.stopSpeaking()}
                aria-label="Stop speaking"
                data-testid="argon-stop-speaking-btn"
                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 shrink-0"
              >
                <Square className="w-4 h-4" />
              </button>
            )}

            <input
              type="text"
              value={textCommand}
              onChange={(e) => setTextCommand(e.target.value)}
              placeholder='Ask ARGON or say "Hey ARGON"...'
              aria-label="Ask ARGON a question"
              data-testid="argon-text-input"
              className="flex-1 bg-slate-900/90 border border-slate-800 focus:border-sky-400 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none"
            />

            <button
              type="submit"
              aria-label="Send command to ARGON"
              data-testid="argon-send-btn"
              className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Completed Action Links */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
            <button
              type="button"
              onClick={() =>
                atmosphereStore.openWorkspace(
                  'ADVANCED_RESEARCH',
                  'WEATHER_RESEARCH'
                )
              }
              data-testid="argon-open-research-btn"
              className="text-sky-300 hover:text-sky-200 flex items-center gap-1 font-medium"
            >
              Open research <ArrowUpRight className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (voiceSnap.handsFreeEnabled) {
                  argonVoiceStateMachine.disableHandsFreeWakeWord();
                } else {
                  void argonVoiceStateMachine.enableHandsFreeWakeWord();
                }
              }}
              data-testid="argon-toggle-wakeword-btn"
              className="text-slate-400 hover:text-slate-200"
            >
              {voiceSnap.handsFreeEnabled ? 'Wake Word: ON' : 'Wake Word: OFF'}
            </button>

            <button
              type="button"
              onClick={() => atmosphereStore.openWorkspace('SCIENTIFIC_REPORT')}
              data-testid="argon-generate-report-btn"
              className="text-emerald-300 hover:text-emerald-200 flex items-center gap-1 font-medium"
            >
              <FileText className="w-3 h-3" />
              Generate report
            </button>
          </div>
        </div>
      )}

      {/* Compact Floating ARGON Voice Orb (Always Accessible Bottom-Right) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            argonVoiceStateMachine.dismissHandsFreePrompt();
            argonVoiceStateMachine.setArgonExpanded(!voiceSnap.argonExpanded);
          }}
          aria-label="Toggle ARGON Assistant"
          data-testid="argon-orb-button"
          className={`group relative flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full backdrop-blur-xl border shadow-2xl transition-all ${
            isListening
              ? 'bg-emerald-950/90 border-emerald-400/80 text-emerald-200 shadow-emerald-500/25'
              : isSpeaking
              ? 'bg-sky-950/90 border-sky-400/80 text-sky-200 shadow-sky-500/25'
              : 'bg-slate-950/90 hover:bg-slate-900 border-sky-500/50 text-slate-100'
          }`}
        >
          <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 via-cyan-300 to-emerald-400 text-slate-950 shadow-inner">
            <Sparkles className="w-3.5 h-3.5" />
            {(isListening || isSpeaking || voiceSnap.handsFreeEnabled) && (
              <span className="absolute inset-0 rounded-full border border-sky-300 animate-ping opacity-60" />
            )}
          </span>

          <div className="text-left">
            <div className="text-xs font-semibold tracking-wide text-white leading-none">
              {stateBadgeLabel[voiceSnap.state] || 'ARGON'}
            </div>
            <div className="text-[10px] text-sky-300/90 mt-0.5 leading-none">
              {voiceSnap.handsFreeEnabled
                ? 'Say "Hey ARGON"'
                : 'Voice & Earth AI'}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isListening) {
              argonVoiceStateMachine.stopListening();
            } else {
              void argonVoiceStateMachine.startActiveListening();
            }
          }}
          aria-label="Speak to ARGON now"
          data-testid="argon-orb-mic-trigger"
          className={`w-11 h-11 rounded-full flex items-center justify-center border shadow-xl transition-all ${
            isListening
              ? 'bg-emerald-500 text-slate-950 border-emerald-300 scale-105'
              : 'bg-slate-950/90 hover:bg-sky-500 hover:text-slate-950 text-sky-300 border-sky-500/50'
          }`}
        >
          {isListening ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
