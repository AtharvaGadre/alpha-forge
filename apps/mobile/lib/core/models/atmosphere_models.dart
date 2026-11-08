// ============================================================================
// ALPHAFORGE ATMOSPHERE NATIVE MOBILE — CORE DATA MODELS (DART)
// Represents Geographic Targets, Weather Layers, Prediction Market &
// Weather-Backed Trade Ideas, News Trade Ideas, AI Executive Summary,
// and 28-Section Scientific Reports.
// ============================================================================

class MobileTargetLocation {
  final String id;
  final String name;
  final String countryName;
  final String countryIso2;
  final double lat;
  final double lng;
  final double altitudeMeters;

  const MobileTargetLocation({
    required this.id,
    required this.name,
    required this.countryName,
    required this.countryIso2,
    required this.lat,
    required this.lng,
    required this.altitudeMeters,
  });

  static const List<MobileTargetLocation> curatedTargets = [
    MobileTargetLocation(
      id: 'london-uk',
      name: 'London',
      countryName: 'United Kingdom',
      countryIso2: 'GB',
      lat: 51.5074,
      lng: -0.1278,
      altitudeMeters: 420000,
    ),
    MobileTargetLocation(
      id: 'sul-de-minas-br',
      name: 'Sul de Minas Coffee Belt',
      countryName: 'Brazil',
      countryIso2: 'BR',
      lat: -21.55,
      lng: -45.43,
      altitudeMeters: 520000,
    ),
    MobileTargetLocation(
      id: 'tokyo-jp',
      name: 'Tokyo & East Asia Hub',
      countryName: 'Japan',
      countryIso2: 'JP',
      lat: 35.6762,
      lng: 139.6503,
      altitudeMeters: 550000,
    ),
    MobileTargetLocation(
      id: 'new-york-us',
      name: 'New York & US Macro',
      countryName: 'United States',
      countryIso2: 'US',
      lat: 40.7128,
      lng: -74.0060,
      altitudeMeters: 480000,
    ),
    MobileTargetLocation(
      id: 'stockholm-se',
      name: 'Stockholm & Nordic Hydro',
      countryName: 'Sweden',
      countryIso2: 'SE',
      lat: 59.3293,
      lng: 18.0686,
      altitudeMeters: 460000,
    ),
  ];
}

class MobileAffectedInstrument {
  final String ticker;
  final String name;
  final String assetClass;
  final String expectedSensitivity;

  const MobileAffectedInstrument({
    required this.ticker,
    required this.name,
    required this.assetClass,
    required this.expectedSensitivity,
  });

  factory MobileAffectedInstrument.fromJson(Map<String, dynamic> json) {
    return MobileAffectedInstrument(
      ticker: (json['ticker'] ?? 'KC=F').toString(),
      name: (json['name'] ?? 'Market Instrument').toString(),
      assetClass: (json['assetClass'] ?? 'COMMODITY').toString(),
      expectedSensitivity: (json['expectedSensitivity'] ?? '+2.5%').toString(),
    );
  }
}

class MobileWeatherTradeIdea {
  final String id;
  final String countryIso2;
  final String regionLabel;
  final String contractQuestion;
  final double impliedProbabilityPct;
  final double probabilityChange24hPct;
  final String contractVolumeUsd;
  final String suggestedDirection;
  final int convictionScore;
  final String horizonDays;
  final String tradeThesisTitle;
  final String weatherEvidenceSummary;
  final List<String> forecastSourceModels;
  final String economicMechanism;
  final List<MobileAffectedInstrument> affectedInstruments;
  final String historicalAnalog;
  final String uncertaintyNotes;
  final String invalidationCriteria;

  const MobileWeatherTradeIdea({
    required this.id,
    required this.countryIso2,
    required this.regionLabel,
    required this.contractQuestion,
    required this.impliedProbabilityPct,
    required this.probabilityChange24hPct,
    required this.contractVolumeUsd,
    required this.suggestedDirection,
    required this.convictionScore,
    required this.horizonDays,
    required this.tradeThesisTitle,
    required this.weatherEvidenceSummary,
    required this.forecastSourceModels,
    required this.economicMechanism,
    required this.affectedInstruments,
    required this.historicalAnalog,
    required this.uncertaintyNotes,
    required this.invalidationCriteria,
  });

  factory MobileWeatherTradeIdea.fromJson(Map<String, dynamic> json) {
    final rawInst = (json['affectedInstruments'] as List<dynamic>?) ?? const [];
    final rawModels = (json['forecastSourceModels'] as List<dynamic>?) ?? const [];
    return MobileWeatherTradeIdea(
      id: (json['id'] ?? 'PM-IDEA').toString(),
      countryIso2: (json['countryIso2'] ?? 'BR').toString(),
      regionLabel: (json['regionLabel'] ?? 'Global Region').toString(),
      contractQuestion: (json['contractQuestion'] ?? '').toString(),
      impliedProbabilityPct:
          (json['impliedProbabilityPct'] as num?)?.toDouble() ?? 68.0,
      probabilityChange24hPct:
          (json['probabilityChange24hPct'] as num?)?.toDouble() ?? 4.2,
      contractVolumeUsd: (json['contractVolumeUsd'] ?? '\$2.5M').toString(),
      suggestedDirection: (json['suggestedDirection'] ?? 'LONG').toString(),
      convictionScore: (json['convictionScore'] as num?)?.toInt() ?? 84,
      horizonDays: (json['horizonDays'] ?? '5-14 Days').toString(),
      tradeThesisTitle: (json['tradeThesisTitle'] ?? '').toString(),
      weatherEvidenceSummary: (json['weatherEvidenceSummary'] ?? '').toString(),
      forecastSourceModels: rawModels.map((e) => e.toString()).toList(),
      economicMechanism: (json['economicMechanism'] ?? '').toString(),
      affectedInstruments: rawInst
          .whereType<Map<String, dynamic>>()
          .map(MobileAffectedInstrument.fromJson)
          .toList(),
      historicalAnalog: (json['historicalAnalog'] ?? '').toString(),
      uncertaintyNotes: (json['uncertaintyNotes'] ?? '').toString(),
      invalidationCriteria: (json['invalidationCriteria'] ?? '').toString(),
    );
  }
}

class MobileNewsTradeIdea {
  final String id;
  final String headline;
  final String sourceAgency;
  final String sourceTypeBadge;
  final String newsSummary;
  final String derivedTradeIdeaTitle;
  final String derivedTradeMechanism;
  final String suggestedDirection;
  final List<String> targetTickers;
  final String riskAndAlternativeView;

  const MobileNewsTradeIdea({
    required this.id,
    required this.headline,
    required this.sourceAgency,
    required this.sourceTypeBadge,
    required this.newsSummary,
    required this.derivedTradeIdeaTitle,
    required this.derivedTradeMechanism,
    required this.suggestedDirection,
    required this.targetTickers,
    required this.riskAndAlternativeView,
  });

  factory MobileNewsTradeIdea.fromJson(Map<String, dynamic> json) {
    final tickers = (json['targetTickers'] as List<dynamic>?) ?? const [];
    return MobileNewsTradeIdea(
      id: (json['id'] ?? 'NEWS-1').toString(),
      headline: (json['headline'] ?? '').toString(),
      sourceAgency: (json['sourceAgency'] ?? 'Meteorological Agency').toString(),
      sourceTypeBadge: (json['sourceTypeBadge'] ?? 'OFFICIAL').toString(),
      newsSummary: (json['newsSummary'] ?? '').toString(),
      derivedTradeIdeaTitle: (json['derivedTradeIdeaTitle'] ?? '').toString(),
      derivedTradeMechanism: (json['derivedTradeMechanism'] ?? '').toString(),
      suggestedDirection: (json['suggestedDirection'] ?? 'LONG').toString(),
      targetTickers: tickers.map((e) => e.toString()).toList(),
      riskAndAlternativeView: (json['riskAndAlternativeView'] ?? '').toString(),
    );
  }
}

class MobileBottomAiSummary {
  final String headline;
  final String weatherRegimeSynthesis;
  final String modelConsensusSynthesis;
  final String predictionMarketSynthesis;
  final String newsCatalystSynthesis;
  final String confidenceAndRiskCaveat;
  final String provenanceHash;

  const MobileBottomAiSummary({
    required this.headline,
    required this.weatherRegimeSynthesis,
    required this.modelConsensusSynthesis,
    required this.predictionMarketSynthesis,
    required this.newsCatalystSynthesis,
    required this.confidenceAndRiskCaveat,
    required this.provenanceHash,
  });
}
