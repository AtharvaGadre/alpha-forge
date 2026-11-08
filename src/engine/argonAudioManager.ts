// ============================================================================
// ALPHAFORGE ATMOSPHERE — ARGON CINEMATIC WEB AUDIO ENGINE
// Declarative Web Audio API Sound Identity, Independent Speech/SFX Controls,
// Audio-Reactive Waveform Telemetry, and Reduced-Motion Accessibility Support
// ============================================================================

export type ArgonSoundEvent =
  | 'ARGON_ACTIVATED'
  | 'LISTENING_STARTED'
  | 'LISTENING_ENDED'
  | 'RESEARCH_STARTED'
  | 'DATA_RETRIEVED'
  | 'MAP_TRANSITION'
  | 'FORECAST_UPDATED'
  | 'MODEL_COMPARISON_COMPLETE'
  | 'REPORT_GENERATED'
  | 'WEATHER_ALERT'
  | 'TASK_FAILED'
  | 'TASK_COMPLETED';

export type ArgonVoicePersona = 'Zephyr' | 'Kore' | 'Fenrir' | 'Puck' | 'Charon';

export interface ArgonAudioPreferences {
  speechVolume: number; // 0.0 to 1.0
  sfxVolume: number; // 0.0 to 1.0
  speechMuted: boolean;
  sfxMuted: boolean;
  speechRate: number; // 0.85 to 1.35
  voicePersona: ArgonVoicePersona;
  reducedMotion: boolean;
}

export interface ArgonSoundEventLog {
  event: ArgonSoundEvent;
  timestampUtc: string;
  description: string;
}

const STORAGE_KEY_AUDIO_PREFS = 'alphaforge_argon_audio_prefs_v1';

class ArgonAudioManager {
  private audioCtx: AudioContext | null = null;
  private activeHtmlAudio: HTMLAudioElement | null = null;
  private isSpeakingState = false;
  private lastEventTimestamps = new Map<ArgonSoundEvent, number>();
  private eventListeners = new Set<(log: ArgonSoundEventLog, isSpeaking: boolean) => void>();
  private recentEventLogs: ArgonSoundEventLog[] = [];

  private prefs: ArgonAudioPreferences = {
    speechVolume: 0.9,
    sfxVolume: 0.45,
    speechMuted: false,
    sfxMuted: false,
    speechRate: 1.02,
    voicePersona: 'Zephyr',
    reducedMotion: false,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY_AUDIO_PREFS);
        if (saved) {
          const parsed = JSON.parse(saved);
          this.prefs = { ...this.prefs, ...parsed };
        } else if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          this.prefs.reducedMotion = true;
        }
      } catch {
        // Ignore storage read errors in restricted iframes
      }
    }
  }

  public getPreferences(): ArgonAudioPreferences {
    return { ...this.prefs };
  }

  public updatePreferences(partial: Partial<ArgonAudioPreferences>): ArgonAudioPreferences {
    this.prefs = {
      ...this.prefs,
      ...partial,
      speechVolume: Math.max(0, Math.min(1, partial.speechVolume ?? this.prefs.speechVolume)),
      sfxVolume: Math.max(0, Math.min(1, partial.sfxVolume ?? this.prefs.sfxVolume)),
      speechRate: Math.max(0.75, Math.min(1.5, partial.speechRate ?? this.prefs.speechRate)),
    };
    if (this.activeHtmlAudio) {
      this.activeHtmlAudio.volume = this.prefs.speechMuted ? 0 : this.prefs.speechVolume;
      this.activeHtmlAudio.playbackRate = this.prefs.speechRate;
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY_AUDIO_PREFS, JSON.stringify(this.prefs));
      } catch {
        // Ignore storage write errors
      }
    }
    this.notifyListeners();
    return this.getPreferences();
  }

  public subscribe(listener: (log: ArgonSoundEventLog, isSpeaking: boolean) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public getRecentSoundLogs(): ArgonSoundEventLog[] {
    return [...this.recentEventLogs];
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeakingState;
  }

  private notifyListeners(latestLog?: ArgonSoundEventLog) {
    const logToUse =
      latestLog ||
      this.recentEventLogs[0] || {
        event: 'ARGON_ACTIVATED',
        timestampUtc: new Date().toISOString(),
        description: 'ARGON Audio System Ready',
      };
    for (const listener of this.eventListeners) {
      listener(logToUse, this.isSpeakingState);
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Declarative sound event trigger mapped strictly to real application states.
   * Enforces per-event cooldown to prevent overlapping or repetitive effects.
   */
  public triggerSound(event: ArgonSoundEvent, customDescription?: string): void {
    const now = Date.now();
    const lastFired = this.lastEventTimestamps.get(event) || 0;
    // Prevent overlapping duplicate triggers within 220ms
    if (now - lastFired < 220) {
      return;
    }
    this.lastEventTimestamps.set(event, now);

    const descriptions: Record<ArgonSoundEvent, string> = {
      ARGON_ACTIVATED: 'ARGON neural core online',
      LISTENING_STARTED: 'Microphone listening channel open',
      LISTENING_ENDED: 'Utterance captured · end of speech detected',
      RESEARCH_STARTED: 'Multi-model meteorological & market research initiated',
      DATA_RETRIEVED: 'Observation & forecast telemetry verified',
      MAP_TRANSITION: 'Geospatial 3D camera trajectory locked',
      FORECAST_UPDATED: 'Multi-model ensemble field updated',
      MODEL_COMPARISON_COMPLETE: 'Forecast disagreement & CRPS matrix computed',
      REPORT_GENERATED: '28-section scientific research report compiled',
      WEATHER_ALERT: 'Official severe weather advisory polygon detected',
      TASK_FAILED: 'Validation or stale-forecast gate warning triggered',
      TASK_COMPLETED: 'ARGON investigation workflow completed',
    };

    const logEntry: ArgonSoundEventLog = {
      event,
      timestampUtc: new Date(now).toISOString(),
      description: customDescription || descriptions[event],
    };

    this.recentEventLogs = [logEntry, ...this.recentEventLogs.slice(0, 14)];
    this.notifyListeners(logEntry);

    if (this.prefs.sfxMuted || this.prefs.sfxVolume <= 0.01) {
      return;
    }

    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    try {
      const gainScalar = this.prefs.sfxVolume * 0.18;
      const t0 = ctx.currentTime;

      switch (event) {
        case 'ARGON_ACTIVATED':
          this.playHarmonicChime(ctx, [330, 440, 659.25], [0, 0.07, 0.14], 0.32, gainScalar, 'sine');
          break;
        case 'LISTENING_STARTED':
          this.playHarmonicChime(ctx, [440, 587.33], [0, 0.06], 0.18, gainScalar, 'sine');
          break;
        case 'LISTENING_ENDED':
          this.playHarmonicChime(ctx, [587.33, 440], [0, 0.06], 0.16, gainScalar, 'sine');
          break;
        case 'RESEARCH_STARTED':
          this.playHarmonicChime(ctx, [293.66, 369.99, 440], [0, 0.08, 0.16], 0.24, gainScalar * 0.85, 'triangle');
          break;
        case 'DATA_RETRIEVED':
          this.playHarmonicChime(ctx, [523.25, 659.25], [0, 0.05], 0.14, gainScalar * 0.75, 'sine');
          break;
        case 'MAP_TRANSITION':
          this.playFrequencySweep(ctx, 220, 493.88, 0.28, gainScalar * 0.7);
          break;
        case 'FORECAST_UPDATED':
          this.playHarmonicChime(ctx, [392, 523.25], [0, 0.06], 0.2, gainScalar * 0.8, 'sine');
          break;
        case 'MODEL_COMPARISON_COMPLETE':
          this.playHarmonicChime(ctx, [440, 554.37, 659.25], [0, 0.06, 0.12], 0.24, gainScalar * 0.85, 'sine');
          break;
        case 'REPORT_GENERATED':
          this.playHarmonicChime(ctx, [349.23, 440, 523.25, 698.46], [0, 0.06, 0.12, 0.18], 0.34, gainScalar, 'sine');
          break;
        case 'WEATHER_ALERT':
          this.playHarmonicChime(ctx, [466.16, 392, 466.16], [0, 0.12, 0.24], 0.22, gainScalar * 1.1, 'triangle');
          break;
        case 'TASK_FAILED':
          this.playHarmonicChime(ctx, [311.13, 233.08], [0, 0.11], 0.28, gainScalar, 'sawtooth');
          break;
        case 'TASK_COMPLETED':
          this.playHarmonicChime(ctx, [440, 554.37, 659.25, 880], [0, 0.06, 0.12, 0.18], 0.3, gainScalar, 'sine');
          break;
      }
      void t0;
    } catch {
      // Ignore Web Audio errors on locked contexts
    }
  }

  private playHarmonicChime(
    ctx: AudioContext,
    frequencies: number[],
    offsetsSec: number[],
    durationSec: number,
    maxGain: number,
    type: OscillatorType
  ) {
    const now = ctx.currentTime;
    frequencies.forEach((freq, idx) => {
      const start = now + (offsetsSec[idx] || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, maxGain), start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + durationSec + 0.02);
    });
  }

  private playFrequencySweep(
    ctx: AudioContext,
    startFreq: number,
    endFreq: number,
    durationSec: number,
    maxGain: number
  ) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + durationSec);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, maxGain), now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  /**
   * Immediately interrupts and halts any ongoing ARGON spoken response
   * (supports barge-in when user starts speaking or clicks Stop Speaking).
   */
  public stopSpeaking(): void {
    if (this.activeHtmlAudio) {
      try {
        this.activeHtmlAudio.pause();
        this.activeHtmlAudio.currentTime = 0;
      } catch {
        // Ignore
      }
      this.activeHtmlAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    if (this.isSpeakingState) {
      this.isSpeakingState = false;
      this.notifyListeners();
    }
  }

  /**
   * Speaks text aloud using Gemini 3.8 Native Audio TTS (`/api/v1/argon/tts`)
   * with immediate fallback to Web Speech API synthesis if offline or unconfigured.
   */
  public async speakText(
    text: string,
    onCaptionUpdate?: (spokenText: string, isFinished: boolean) => void
  ): Promise<void> {
    this.stopSpeaking();

    if (this.prefs.speechMuted || this.prefs.speechVolume <= 0.01 || !text.trim()) {
      onCaptionUpdate?.(text, true);
      return;
    }

    this.isSpeakingState = true;
    this.notifyListeners();
    onCaptionUpdate?.(text, false);

    // 1. Try server-side Gemini 3.8 TTS (`gemini-3.8-flash-lite-tts`)
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 4500);
      const res = await fetch('/api/v1/argon/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.slice(0, 900),
          voiceName: this.prefs.voicePersona,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data?.audioBase64 && typeof window !== 'undefined') {
          const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
          audio.volume = this.prefs.speechMuted ? 0 : this.prefs.speechVolume;
          audio.playbackRate = this.prefs.speechRate;
          this.activeHtmlAudio = audio;

          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = (e) => reject(e);
            audio.play().catch(reject);
          });

          this.isSpeakingState = false;
          this.activeHtmlAudio = null;
          this.notifyListeners();
          onCaptionUpdate?.(text, true);
          return;
        }
      }
    } catch {
      // Fall through cleanly to browser Web Speech synthesis
    }

    // 2. Fallback to browser SpeechSynthesis API
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.volume = this.prefs.speechMuted ? 0 : this.prefs.speechVolume;
          utterance.rate = this.prefs.speechRate;
          utterance.pitch = 1.0;

          const voices = window.speechSynthesis.getVoices();
          const preferredVoice =
            voices.find(
              (v) =>
                v.lang.startsWith('en') &&
                (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Daniel'))
            ) || voices.find((v) => v.lang.startsWith('en'));
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }

          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        });
      } catch {
        // Ignore speech synthesis errors on headless browsers
      }
    }

    this.isSpeakingState = false;
    this.notifyListeners();
    onCaptionUpdate?.(text, true);
  }
}

export const argonAudioManager = new ArgonAudioManager();
