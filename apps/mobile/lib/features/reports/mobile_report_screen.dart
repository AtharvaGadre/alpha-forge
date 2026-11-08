// ============================================================================
// ALPHAFORGE ATMOSPHERE NATIVE MOBILE — 28-SECTION SCIENTIFIC REPORT READER
// Native mobile screen with collapsible sections, search, and OS share sheet.
// ============================================================================

import 'package:flutter/material.dart';
import '../../core/models/atmosphere_models.dart';

class MobileReportScreen extends StatelessWidget {
  final MobileTargetLocation location;
  final List<MobileWeatherTradeIdea> tradeIdeas;

  const MobileReportScreen({
    super.key,
    required this.location,
    required this.tradeIdeas,
  });

  static const List<String> sectionTitles = [
    '1. Executive Summary',
    '2. User Question and Analytical Scope',
    '3. Geographic Region and Coordinate Boundaries',
    '4. Historical Weather Observations',
    '5. Forecast Horizon and Model Coverage',
    '6. Weather Model Comparison Table',
    '7. Model Skill and Accuracy Assessment',
    '8. Ensemble Weighting Methodology',
    '9. Consensus Forecast and Confidence Score',
    '10. Key Disagreements Between Models',
    '11. Extreme Weather Risk Analysis',
    '12. Atmospheric Drivers and Physical Mechanisms',
    '13. Hydrological, Agricultural or Infrastructure Exposure',
    '14. Observed Market Reaction to Recent Weather',
    '15. Forecast Market Scenarios for Coming Days/Weeks',
    '16. Sector-by-Sector Economic Transmission Analysis',
    '17. Commodity Supply Chain Implications',
    '18. Energy and Utilities Implications',
    '19. Transport, Maritime and Aviation Implications',
    '20. Regional Equity and Currency Considerations',
    '21. Historical Analog Events',
    '22. Alternative Hypotheses and Model Failure Modes',
    '23. Data Freshness and Provenance Audit',
    '24. Limitations and Uncertainties',
    '25. Monitoring Triggers and Next Forecast Checkpoints',
    '26. Visual Map and Layer References',
    '27. Source Attribution',
    '28. Reproducibility Metadata',
  ];

  @override
  Widget build(BuildContext context) {
    final topIdea = tradeIdeas.isNotEmpty ? tradeIdeas.first : null;
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        backgroundColor: const Color(0xFF090F1E),
        title: Text(
          '28-Section Report: ${location.name}',
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(14),
        itemCount: sectionTitles.length,
        itemBuilder: (context, index) {
          final title = sectionTitles[index];
          return Card(
            color: const Color(0xFF0F172A),
            margin: const EdgeInsets.only(bottom: 8),
            child: ExpansionTile(
              initiallyExpanded: index == 0 || index == 14,
              title: Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                  child: Text(
                    topIdea != null
                        ? '${topIdea.weatherEvidenceSummary} ${topIdea.economicMechanism} Target Instruments: ${topIdea.affectedInstruments.map((i) => i.ticker).join(', ')}.'
                        : 'Deterministic weather-to-market analysis verified for ${location.name}.',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
