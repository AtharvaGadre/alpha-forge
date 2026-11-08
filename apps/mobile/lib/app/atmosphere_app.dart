// ============================================================================
// ALPHAFORGE ATMOSPHERE NATIVE MOBILE — MAIN APPLICATION SHELL
// Implements the mobile-first Earth-centric layout:
// - Full-screen interactive 3D Earth with synchronized weather overlays
// - Top location search & Demo Access Preset selector
// - Bottom Forecast Timeline scrubber
// - Draggable Under-Map Sheet with Predicted Weather Market Effects,
//   Prediction Market Trade Ideas, News Trade Ideas, and Bottom AI Summary
// - Floating ARGON Voice Orb
// ============================================================================

import 'package:flutter/material.dart';
import '../core/api/atmosphere_api_client.dart';
import '../core/audio/argon_native_audio_bridge.dart';
import '../core/models/atmosphere_models.dart';
import '../features/argon/argon_orb_sheet.dart';
import '../features/globe/native_globe_view.dart';
import '../features/reports/mobile_report_screen.dart';
import '../features/trade_ideas/trade_ideas_sheet.dart';

class AlphaForgeAtmosphereMobileApp extends StatelessWidget {
  final AtmosphereApiClient? apiClient;

  const AlphaForgeAtmosphereMobileApp({super.key, this.apiClient});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AlphaForge Atmosphere',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF020617),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF38BDF8),
          secondary: Color(0xFF34D399),
          surface: Color(0xFF0F172A),
        ),
      ),
      home: AtmosphereHomeScreen(
        apiClient: apiClient ?? AtmosphereApiClient(),
      ),
    );
  }
}

class AtmosphereHomeScreen extends StatefulWidget {
  final AtmosphereApiClient apiClient;

  const AtmosphereHomeScreen({super.key, required this.apiClient});

  @override
  State<AtmosphereHomeScreen> createState() => _AtmosphereHomeScreenState();
}

class _AtmosphereHomeScreenState extends State<AtmosphereHomeScreen> {
  final ArgonNativeAudioBridge _audioBridge = ArgonNativeAudioBridge();
  MobileTargetLocation _selectedLocation =
      MobileTargetLocation.curatedTargets[1]; // Default to Brazil Coffee Belt
  String _selectedDemoPreset = 'COMMODITY_ANALYST';
  List<String> _activeLayers = ['TEMPERATURE', 'PRECIPITATION'];
  int _timelineOffsetHours = 0;

  late List<MobileWeatherTradeIdea> _tradeIdeas;
  late List<MobileNewsTradeIdea> _newsIdeas;

  @override
  void initState() {
    super.initState();
    _tradeIdeas = AtmosphereApiClient.getFallbackTradeIdeas(
      _selectedLocation.countryIso2,
    );
    _newsIdeas = AtmosphereApiClient.getFallbackNewsTradeIdeas(
      _selectedLocation.countryIso2,
    );
    _refreshLocationIntelligence(_selectedLocation);
  }

  Future<void> _refreshLocationIntelligence(
    MobileTargetLocation location,
  ) async {
    final ideas = await widget.apiClient.fetchTradeIdeas(location.countryIso2);
    final news =
        await widget.apiClient.fetchNewsTradeIdeas(location.countryIso2);
    if (!mounted) return;
    setState(() {
      _selectedLocation = location;
      _tradeIdeas = ideas;
      _newsIdeas = news;
    });
  }

  void _openArgonSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => ArgonOrbSheet(
        audioBridge: _audioBridge,
        onSubmitVoiceQuery: (query) {
          if (query.toLowerCase().contains('brazil')) {
            _refreshLocationIntelligence(MobileTargetLocation.curatedTargets[1]);
          } else if (query.toLowerCase().contains('asia') ||
              query.toLowerCase().contains('tokyo')) {
            _refreshLocationIntelligence(MobileTargetLocation.curatedTargets[2]);
          }
          Navigator.of(context).pop();
        },
      ),
    );
  }

  void _openReportScreen() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => MobileReportScreen(
          location: _selectedLocation,
          tradeIdeas: _tradeIdeas,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            // 1. Synchronized 3D Earth & Atmospheric Canvas
            Positioned.fill(
              child: NativeGlobeView(
                selectedLocation: _selectedLocation,
                activeLayers: _activeLayers,
                timelineOffsetHours: _timelineOffsetHours,
                onSelectLocation: _refreshLocationIntelligence,
              ),
            ),

            // 2. Top Search & Demo Preset Header
            Positioned(
              top: 10,
              left: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF090F1E).withOpacity(0.92),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFF1E293B)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'AlphaForge Atmosphere',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        DropdownButton<String>(
                          value: _selectedDemoPreset,
                          dropdownColor: const Color(0xFF0F172A),
                          underline: const SizedBox.shrink(),
                          items: const [
                            DropdownMenuItem(
                              value: 'GUEST_EXPLORER',
                              child: Text(
                                '[DEMO] Guest Explorer',
                                style: TextStyle(fontSize: 11),
                              ),
                            ),
                            DropdownMenuItem(
                              value: 'COMMODITY_ANALYST',
                              child: Text(
                                '[DEMO] Commodity Analyst',
                                style: TextStyle(fontSize: 11),
                              ),
                            ),
                            DropdownMenuItem(
                              value: 'WEATHER_RESEARCHER',
                              child: Text(
                                '[DEMO] Weather Researcher',
                                style: TextStyle(fontSize: 11),
                              ),
                            ),
                            DropdownMenuItem(
                              value: 'GLOBAL_MACRO_ANALYST',
                              child: Text(
                                '[DEMO] Global Macro',
                                style: TextStyle(fontSize: 11),
                              ),
                            ),
                          ],
                          onChanged: (preset) {
                            if (preset == null) return;
                            setState(() => _selectedDemoPreset = preset);
                            if (preset == 'COMMODITY_ANALYST') {
                              _refreshLocationIntelligence(
                                MobileTargetLocation.curatedTargets[1],
                              );
                            } else if (preset == 'WEATHER_RESEARCHER') {
                              _refreshLocationIntelligence(
                                MobileTargetLocation.curatedTargets[2],
                              );
                            } else {
                              _refreshLocationIntelligence(
                                MobileTargetLocation.curatedTargets[0],
                              );
                            }
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: MobileTargetLocation.curatedTargets.map((loc) {
                          final selected = loc.id == _selectedLocation.id;
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              label: Text(
                                loc.name,
                                style: const TextStyle(fontSize: 11),
                              ),
                              selected: selected,
                              onSelected: (_) =>
                                  _refreshLocationIntelligence(loc),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 3. Draggable Bottom Sheet: Under-Map Weather Market Effects, Trade Ideas, News & AI Summary
            DraggableScrollableSheet(
              initialChildSize: 0.38,
              minChildSize: 0.22,
              maxChildSize: 0.88,
              builder: (context, scrollController) {
                return SingleChildScrollView(
                  controller: scrollController,
                  child: TradeIdeasBottomSheet(
                    selectedLocation: _selectedLocation,
                    tradeIdeas: _tradeIdeas,
                    newsIdeas: _newsIdeas,
                    onOpenReportScreen: _openReportScreen,
                    onAskArgonToNarrate: _openArgonSheet,
                  ),
                );
              },
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openArgonSheet,
        backgroundColor: const Color(0xFF0284C7),
        icon: const Icon(Icons.Graphic_eq, color: Colors.white),
        label: const Text(
          'ARGON',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}
