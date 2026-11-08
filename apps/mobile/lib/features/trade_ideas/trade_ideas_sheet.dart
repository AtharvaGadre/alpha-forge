// ============================================================================
// ALPHAFORGE ATMOSPHERE NATIVE MOBILE — UNDER-MAP WEATHER EFFECTS ON
// FINANCIAL MARKETS, PREDICTION MARKET TRADE IDEAS, NEWS IDEAS & AI SUMMARY
// ============================================================================

import 'package:flutter/material.dart';
import '../../core/models/atmosphere_models.dart';

class TradeIdeasBottomSheet extends StatelessWidget {
  final MobileTargetLocation selectedLocation;
  final List<MobileWeatherTradeIdea> tradeIdeas;
  final List<MobileNewsTradeIdea> newsIdeas;
  final VoidCallback onOpenReportScreen;
  final VoidCallback onAskArgonToNarrate;

  const TradeIdeasBottomSheet({
    super.key,
    required this.selectedLocation,
    required this.tradeIdeas,
    required this.newsIdeas,
    required this.onOpenReportScreen,
    required this.onAskArgonToNarrate,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF090F1E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Predicted Weather Effects on Financial Markets & Trade Ideas (${selectedLocation.countryName})',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Backed by multi-model meteorological forecasts (ECMWF, GFS, GraphCast, CPTEC) and cross-asset sensitivity.',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 12),
          ...tradeIdeas.map(
            (idea) => Card(
              color: const Color(0xFF0F172A),
              margin: const EdgeInsets.only(bottom: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: Color(0xFF1E293B)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'SUGGESTED TRADE: ${idea.suggestedDirection} (${idea.convictionScore}/100)',
                          style: const TextStyle(
                            color: Color(0xFF34D399),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '${idea.impliedProbabilityPct.toStringAsFixed(0)}% YES Odds',
                          style: const TextStyle(
                            color: Color(0xFF38BDF8),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      idea.tradeThesisTitle,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Predicted Weather Evidence: ${idea.weatherEvidenceSummary}',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Financial Market Effect: ${idea.economicMechanism}',
                      style: const TextStyle(
                        color: Color(0xFFA7F3D0),
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: idea.affectedInstruments
                          .map(
                            (inst) => Chip(
                              backgroundColor: const Color(0xFF020617),
                              label: Text(
                                '${inst.ticker} (${inst.expectedSensitivity})',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'General Trade Ideas from the News',
            style: TextStyle(
              color: Color(0xFF34D399),
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          ...newsIdeas.map(
            (news) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    news.headline,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Derived Trade Idea (${news.suggestedDirection}): ${news.derivedTradeIdeaTitle} [${news.targetTickers.join(', ')}]',
                    style: const TextStyle(
                      color: Color(0xFF38BDF8),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF0C192C),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF0284C7)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ARGON AI Executive Summary (Bottom Synthesis)',
                  style: TextStyle(
                    color: Color(0xFF38BDF8),
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Multi-model ensemble forecasts for ${selectedLocation.name} indicate weather-driven repricing across ${tradeIdeas.isNotEmpty ? tradeIdeas.first.affectedInstruments.map((i) => i.ticker).join(', ') : 'key regional contracts'}.',
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: onAskArgonToNarrate,
                        icon: const Icon(Icons.record_voice_over, size: 16),
                        label: const Text('Narrate with ARGON'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onOpenReportScreen,
                        icon: const Icon(Icons.description, size: 16),
                        label: const Text('28-Section Report'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
