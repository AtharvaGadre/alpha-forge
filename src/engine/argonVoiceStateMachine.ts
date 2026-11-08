// ============================================================================
// ALPHAFORGE ATMOSPHERE — DETERMINISTIC ARGON VOICE STATE MACHINE
// Authoritative Singleton Voice Controller:
// States: DISABLED -> READY -> WAKE_LISTENING -> ACTIVE_LISTENING ->
//         PROCESSING -> SPEAKING -> READY / WAKE_LISTENING
// Plus Recoverable States: PERMISSION_DENIED, CONNECTING, RECONNECTING, OFFLINE, ERROR
// ============================================================================

import { atmosphereStore } from '../state/atmosphereStore';
import { globeController } from './globe/GlobeController';
import { argonAudioManager } from './argonAudioManager';

export type ArgonVoiceState =
  | 'DISABLED'
  | 'READY'
  | 'WAKE_LISTENING'
  | 'ACTIVE_LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'PERMISSION_DENIED'
  | 'CONNECTING'
  | 'RECONNECTING'
  | 'OFFLINE'
  | 'ERROR';

export interface ArgonVoiceStatusSnapshot {
  state: ArgonVoiceState;
  handsFreeEnabled: boolean;
  handsFreePromptDismissed: boolean;
  argonExpanded: boolean;
  isLiveConnected: boolean;
  liveModelId: 'gemini-3.8-live' | 'gemini-3.8-live-extended-thinking';
  activeCaption: string;
  lastTranscript: string;
  activeToolStep: string;
  waveformBins: number[];
  errorMessage: string | null;
}

const WAKE_PHRASES = [
  'hey argon',
  'hi argon',
  'ok argon',
  'okay argon',
  'argon',
];

class ArgonVoiceStateMachine {
  private voiceState: ArgonVoiceState = 'READY';
  private handsFreeEnabled = false;
  private handsFreePromptDismissed = false;
  private argonExpanded = false;
  private activeCaption = '';
  private lastTranscript = '';
  private activeToolStep = '';
  private liveModelId: 'gemini-3.8-live' | 'gemini-3.8-live-extended-thinking' =
    'gemini-3.8-live';
  private isLiveConnected = false;
  private liveWs: WebSocket | null = null;
  private recognition: any = null;
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private waveformTimer: number | null = null;
  private waveformBins: number[] = [
    0.12, 0.18, 0.24, 0.32, 0.28, 0.2, 0.15, 0.12, 0.18, 0.26, 0.22, 0.14,
  ];
  private errorMessage: string | null = null;
  private listeners = new Set<(snapshot: ArgonVoiceStatusSnapshot) => void>();

  public subscribe(listener: (snapshot: ArgonVoiceStatusSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): ArgonVoiceStatusSnapshot {
    return {
      state: this.voiceState,
      handsFreeEnabled: this.handsFreeEnabled,
      handsFreePromptDismissed: this.handsFreePromptDismissed,
      argonExpanded: this.argonExpanded,
      isLiveConnected: this.isLiveConnected,
      liveModelId: this.liveModelId,
      activeCaption: this.activeCaption,
      lastTranscript: this.lastTranscript,
      activeToolStep: this.activeToolStep,
      waveformBins: [...this.waveformBins],
      errorMessage: this.errorMessage,
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  public setArgonExpanded(expanded: boolean): void {
    this.argonExpanded = expanded;
    this.notify();
  }

  public dismissHandsFreePrompt(): void {
    this.handsFreePromptDismissed = true;
    this.notify();
  }

  public setLiveModel(
    modelId: 'gemini-3.8-live' | 'gemini-3.8-live-extended-thinking'
  ): void {
    this.liveModelId = modelId;
    this.notify();
  }

  public transitionTo(
    nextState: ArgonVoiceState,
    errorMsg: string | null = null
  ): void {
    this.voiceState = nextState;
    this.errorMessage = errorMsg;
    this.updateWaveformLoop(nextState);
    this.notify();
  }

  /**
   * Method B: Opt-in Hands-Free `"Hey ARGON"` Mode
   */
  public async enableHandsFreeWakeWord(): Promise<boolean> {
    this.handsFreePromptDismissed = true;
    if (typeof window === 'undefined') return false;

    try {
      this.transitionTo('CONNECTING');
      if (navigator.mediaDevices?.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this.attachMicrophoneAnalyser(this.mediaStream);
      }

      this.handsFreeEnabled = true;
      argonAudioManager.triggerSound(
        'ARGON_ACTIVATED',
        'Hands-free "Hey ARGON" wake listener active'
      );
      this.startSpeechRecognitionLoop(true);
      this.transitionTo('WAKE_LISTENING');
      return true;
    } catch (err: any) {
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        String(err?.message || '')
          .toLowerCase()
          .includes('permission');
      this.handsFreeEnabled = false;
      this.transitionTo(
        isDenied ? 'PERMISSION_DENIED' : 'READY',
        isDenied
          ? 'Microphone permission was declined. You can still use the ARGON text command bar or enable microphone access in browser settings.'
          : 'Hands-free wake word unavailable in this browser; push-to-talk and text commands remain active.'
      );
      return false;
    }
  }

  public disableHandsFreeWakeWord(): void {
    this.handsFreeEnabled = false;
    this.stopSpeechRecognitionLoop();
    this.releaseMediaStream();
    this.transitionTo('READY');
  }

  /**
   * Method A: Push-to-Talk Microphone Button on the ARGON Orb
   */
  public async startActiveListening(): Promise<void> {
    this.handsFreePromptDismissed = true;
    this.argonExpanded = true;

    if (this.voiceState === 'SPEAKING') {
      argonAudioManager.stopSpeaking();
    }

    argonAudioManager.triggerSound('LISTENING_STARTED');
    this.transitionTo('ACTIVE_LISTENING');

    if (typeof window === 'undefined') return;

    try {
      if (!this.mediaStream && navigator.mediaDevices?.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this.attachMicrophoneAnalyser(this.mediaStream);
      }
      this.startSpeechRecognitionLoop(false);
    } catch (err: any) {
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError';
      if (isDenied) {
        this.transitionTo(
          'PERMISSION_DENIED',
          'Microphone access blocked. Type any command below or allow microphone access.'
        );
      }
    }
  }

  public stopListening(): void {
    argonAudioManager.triggerSound('LISTENING_ENDED');
    if (!this.handsFreeEnabled) {
      this.stopSpeechRecognitionLoop();
    }
    this.transitionTo(this.handsFreeEnabled ? 'WAKE_LISTENING' : 'READY');
  }

  public stopSpeaking(): void {
    argonAudioManager.stopSpeaking();
    this.transitionTo(this.handsFreeEnabled ? 'WAKE_LISTENING' : 'READY');
  }

  /**
   * Processes a spoken or typed natural-language instruction end-to-end:
   * 1. Strips wake-word prefix if present
   * 2. Executes deterministic GlobeController navigation & weather layer commands
   * 3. Runs multi-model weather/market investigation
   * 4. Queries `/api/v1/argon/voice-command` for verified Gemini synthesis
   * 5. Speaks the response aloud while displaying synchronized captions
   */
  public async processUserUtterance(rawText: string): Promise<void> {
    const cleaned = this.stripWakePhrase(rawText).trim();
    if (!cleaned) return;

    argonAudioManager.stopSpeaking();
    this.argonExpanded = true;
    this.lastTranscript = cleaned;
    this.activeCaption = '';
    this.activeToolStep = 'Interpreting geospatial & atmospheric directive...';
    argonAudioManager.triggerSound('RESEARCH_STARTED');
    this.transitionTo('PROCESSING');

    const lower = cleaned.toLowerCase();
    const isComplexQuery =
      lower.includes('market') ||
      lower.includes('sector') ||
      lower.includes('coffee') ||
      lower.includes('compare') ||
      lower.includes('report') ||
      lower.includes('economic') ||
      lower.includes('accuracy');
    this.liveModelId = isComplexQuery
      ? 'gemini-3.8-live-extended-thinking'
      : 'gemini-3.8-live';

    try {
      this.activeToolStep = 'Updating 3D Earth camera & atmospheric layers...';
      this.notify();

      const result = globeController.interpretAndExecuteDirective(cleaned, {
        openReportIfRequested: true,
      });

      const cmdSummary =
        result.executedCommands.map((c) => c.summary).join(' · ') ||
        'Updated Earth view.';
      argonAudioManager.triggerSound('MAP_TRANSITION', cmdSummary);
      this.activeToolStep = cmdSummary;
      this.notify();

      // Wait (briefly) for the live open-data investigation so ARGON speaks live numbers, not fixtures
      this.activeToolStep = 'Fetching live forecasts, verification archives & market data...';
      this.notify();
      const liveInv = await atmosphereStore.waitForLiveInvestigation(30000);
      const spokenInv = liveInv ?? result.investigation;

      const st = atmosphereStore.getState();
      let spokenResponse =
        st.userMode === 'ADVANCED'
          ? spokenInv.spokenExecutiveBriefingAdvanced
          : spokenInv.spokenExecutiveBriefingBasic;

      // Optional server-side Gemini Live/Voice enrichment
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3800);
        const res = await fetch('/api/v1/argon/voice-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: cleaned,
            currentCountry: st.selectedLocation.countryIso2,
            voiceModel: this.liveModelId,
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const payload = await res.json();
          if (
            payload?.spokenResponse &&
            typeof payload.spokenResponse === 'string'
          ) {
            spokenResponse = payload.spokenResponse;
          }
        }
      } catch {
        // Deterministic briefing already ready in spokenResponse
      }

      this.activeCaption = spokenResponse;
      this.activeToolStep = 'Speaking live audio response...';
      this.transitionTo('SPEAKING');

      await argonAudioManager.speakText(
        spokenResponse,
        (captionText, isFinished) => {
          this.activeCaption = captionText;
          this.activeToolStep = isFinished
            ? cmdSummary
            : 'Speaking live audio response...';
          this.notify();
        }
      );

      argonAudioManager.triggerSound('TASK_COMPLETED');
      this.transitionTo(this.handsFreeEnabled ? 'WAKE_LISTENING' : 'READY');
    } catch (err: any) {
      argonAudioManager.triggerSound('TASK_FAILED');
      this.transitionTo(
        'ERROR',
        err?.message || 'Unable to complete voice command'
      );
    }
  }

  private stripWakePhrase(text: string): string {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
    for (const phrase of WAKE_PHRASES) {
      if (lower.startsWith(phrase)) {
        return trimmed.slice(phrase.length).replace(/^[,.:;!\s-]+/, '');
      }
    }
    return trimmed;
  }

  private startSpeechRecognitionLoop(wakeWordMode: boolean): void {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      return;
    }

    this.stopSpeechRecognitionLoop();

    try {
      const rec = new SpeechRecognitionClass();
      rec.continuous = wakeWordMode;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        if (this.voiceState === 'SPEAKING') {
          return;
        }

        let transcript = '';
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }

        const cleanTranscript = transcript.trim();
        if (!cleanTranscript) return;

        if (wakeWordMode) {
          const lower = cleanTranscript.toLowerCase();
          const hasWakeWord = WAKE_PHRASES.some((w) => lower.includes(w));
          if (hasWakeWord) {
            this.argonExpanded = true;
            const afterWake = this.stripWakePhrase(cleanTranscript);
            this.lastTranscript = afterWake || cleanTranscript;
            this.activeToolStep = 'Wake word "Hey ARGON" detected...';
            this.notify();
            if (isFinal && afterWake.length > 2) {
              void this.processUserUtterance(afterWake);
            }
          }
        } else {
          this.lastTranscript = cleanTranscript;
          this.activeToolStep = 'Listening to voice command...';
          this.notify();
          if (isFinal) {
            void this.processUserUtterance(cleanTranscript);
          }
        }
      };

      rec.onerror = () => {
        // Recover gracefully
      };

      rec.onend = () => {
        if (this.handsFreeEnabled && this.voiceState === 'WAKE_LISTENING') {
          try {
            rec.start();
          } catch {
            // Ignore restart race
          }
        }
      };

      rec.start();
      this.recognition = rec;
    } catch {
      // SpeechRecognition unsupported in headless browser
    }
  }

  private stopSpeechRecognitionLoop(): void {
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }
  }

  private attachMicrophoneAnalyser(stream: MediaStream): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      const source = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      this.analyser = analyser;
    } catch {
      // Ignore audio analyser errors
    }
  }

  private releaseMediaStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  private updateWaveformLoop(state: ArgonVoiceState): void {
    if (typeof window === 'undefined') return;
    if (this.waveformTimer !== null) {
      window.clearInterval(this.waveformTimer);
      this.waveformTimer = null;
    }

    if (
      state === 'ACTIVE_LISTENING' ||
      state === 'SPEAKING' ||
      state === 'PROCESSING'
    ) {
      this.waveformTimer = window.setInterval(() => {
        if (this.analyser && state === 'ACTIVE_LISTENING') {
          const data = new Uint8Array(this.analyser.frequencyBinCount);
          this.analyser.getByteFrequencyData(data);
          this.waveformBins = Array.from({ length: 12 }, (_, idx) => {
            const val = data[idx * 2] || 0;
            return Math.max(0.12, Math.min(0.98, val / 255));
          });
        } else {
          const t = Date.now() / 160;
          this.waveformBins = Array.from({ length: 12 }, (_, idx) => {
            const amp = state === 'SPEAKING' ? 0.42 : 0.25;
            const base = state === 'SPEAKING' ? 0.35 : 0.22;
            return Math.max(
              0.1,
              Math.min(0.95, base + Math.sin(t + idx * 0.65) * amp)
            );
          });
        }
        this.notify();
      }, 90);
    } else {
      this.waveformBins = [
        0.12, 0.16, 0.2, 0.24, 0.2, 0.16, 0.14, 0.16, 0.2, 0.22, 0.18, 0.12,
      ];
    }
  }

  public connectLiveWebSocket(): void {
    if (typeof window === 'undefined' || this.liveWs) return;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/api/v1/argon/live-ws`;
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        this.isLiveConnected = true;
        this.notify();
      };
      ws.onclose = () => {
        this.isLiveConnected = false;
        this.liveWs = null;
        this.notify();
      };
      ws.onerror = () => {
        this.isLiveConnected = false;
      };
      this.liveWs = ws;
    } catch {
      this.isLiveConnected = false;
    }
  }
}

export const argonVoiceStateMachine = new ArgonVoiceStateMachine();
