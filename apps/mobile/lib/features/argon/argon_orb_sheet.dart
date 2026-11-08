// ============================================================================
// ALPHAFORGE ATMOSPHERE NATIVE MOBILE — ARGON VOICE ASSISTANT ORB & SHEET
// Supports live voice capture, interruption, mute, model selection
// (`gemini-3.8-live` vs `gemini-3.8-live-extended-thinking`), and transcripts.
// ============================================================================

import 'package:flutter/material.dart';
import '../../core/audio/argon_native_audio_bridge.dart';

class ArgonOrbSheet extends StatefulWidget {
  final ArgonNativeAudioBridge audioBridge;
  final ValueChanged<String> onSubmitVoiceQuery;

  const ArgonOrbSheet({
    super.key,
    required this.audioBridge,
    required this.onSubmitVoiceQuery,
  });

  @override
  State<ArgonOrbSheet> createState() => _ArgonOrbSheetState();
}

class _ArgonOrbSheetState extends State<ArgonOrbSheet> {
  String _selectedModel = 'gemini-3.8-live-extended-thinking';
  String _liveTranscript =
      'Tap the ARGON orb or select a research prompt below to analyze how predicted weather affects financial markets.';

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Color(0xFF090F1E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ARGON — Autonomous Voice Intelligence',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              DropdownButton<String>(
                dropdownColor: const Color(0xFF0F172A),
                value: _selectedModel,
                items: const [
                  DropdownMenuItem(
                    value: 'gemini-3.8-live',
                    child: Text(
                      'Fast Voice (gemini-3.8-live)',
                      style: TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ),
                  DropdownMenuItem(
                    value: 'gemini-3.8-live-extended-thinking',
                    child: Text(
                      'Deep Research (extended-thinking)',
                      style: TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ),
                ],
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _selectedModel = val);
                    widget.audioBridge.configureVoiceSession(
                      voiceModel: val,
                      voiceName: 'Zephyr',
                    );
                  }
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _liveTranscript,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ActionChip(
                label: const Text('Brazil Coffee Rainfall & KC=F Trade Idea'),
                onPressed: () {
                  const q =
                      'Show me Brazil coffee regions and compare rainfall forecasts for the next ten days.';
                  setState(() => _liveTranscript = q);
                  widget.onSubmitVoiceQuery(q);
                },
              ),
              ActionChip(
                label: const Text('Asia Typhoons & LNG / Shipping Impact'),
                onPressed: () {
                  const q =
                      "Hey ARGON, analyse last week's weather across Asia and tell me which financial markets have been affected and what next week's weather could mean for those markets.";
                  setState(() => _liveTranscript = q);
                  widget.onSubmitVoiceQuery(q);
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final granted =
                        await widget.audioBridge.requestMicrophonePermission();
                    if (granted) {
                      await widget.audioBridge.startListening();
                      setState(() {
                        _liveTranscript = 'Listening via native microphone...';
                      });
                    }
                  },
                  icon: const Icon(Icons.mic),
                  label: const Text('Speak to ARGON'),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: () async {
                  await widget.audioBridge.stopSpeakingImmediate();
                  setState(() {
                    _liveTranscript = 'ARGON speech interrupted.';
                  });
                },
                icon: const Icon(Icons.stop_circle_outlined),
                label: const Text('Interrupt'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
