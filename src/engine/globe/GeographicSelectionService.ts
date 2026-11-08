// ============================================================================
// ALPHAFORGE ATMOSPHERE — GEOGRAPHIC SELECTION & LANDMARK EXPLORATION SERVICE
// Supports Countries, Cities, Agricultural/Energy Regions, and 3D Landmarks
// Properly distinguishes Country-wide view from Capital/Financial Hub & 3D City
// ============================================================================

import {
  COUNTRY_REGISTRY,
  resolveCountryOrUnseenProfile,
} from '../worldPulseCountryEngine.ts';
import {
  getCountryDeepDiveProfile,
  searchCountriesAutocomplete,
  resolveNearestCountryFromViewport,
} from '../countryDeepDiveEngine.ts';

export type GeographicEntityKind =
  | 'COUNTRY'
  | 'CITY'
  | 'AGRICULTURAL_OR_ECONOMIC_REGION'
  | 'LANDMARK_3D';

export interface GeographicTargetLocation {
  id: string;
  name: string;
  subtitle: string;
  kind: GeographicEntityKind;
  countryIso2: string;
  countryName: string;
  capitalCity: string;
  financialCentre: string;
  lat: number;
  lng: number;
  cameraAltitudeMeters: number;
  cameraTiltDeg: number;
  cameraHeadingDeg: number;
  boundingBox: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  landmark?: {
    name: string;
    city: string;
    lat: number;
    lng: number;
    altitudeMeters: number;
    tiltDeg: number;
    headingDeg: number;
    description: string;
    attribution: string;
    wikipediaSlug: string;
  };
  weatherSummaryDefault: {
    temperatureC: number;
    conditionLabel: string;
    windSpeedMs: number;
    humidityPct: number;
    precipitation24hMm: number;
    next24hTempRangeC: [number, number];
    next24hRainProbPct: number;
    oneSentenceSummary: string;
    officialAgency: string;
  };
}

export const CURATED_GEOGRAPHIC_TARGETS: GeographicTargetLocation[] = [
  {
    id: 'LOC-GB-LONDON',
    name: 'London, United Kingdom',
    subtitle: 'United Kingdom · Country & 3D Landmark Exploration',
    kind: 'CITY',
    countryIso2: 'GB',
    countryName: 'United Kingdom',
    capitalCity: 'London',
    financialCentre: 'City of London & Canary Wharf',
    lat: 51.5055,
    lng: -0.0754,
    cameraAltitudeMeters: 3800,
    cameraTiltDeg: 58,
    cameraHeadingDeg: 25,
    boundingBox: { west: -8.6, south: 49.9, east: 1.8, north: 60.9 },
    landmark: {
      name: 'Tower Bridge & Thames Financial Corridor',
      city: 'London',
      lat: 51.5055,
      lng: -0.0754,
      altitudeMeters: 950,
      tiltDeg: 65,
      headingDeg: 35,
      description:
        'Photorealistic 3D view of Tower Bridge, the River Thames, and the City of London financial district.',
      attribution: 'Google Photorealistic 3D Tiles · UK Met Office · Wikimedia Commons (CC BY-SA)',
      wikipediaSlug: 'Tower_Bridge',
    },
    weatherSummaryDefault: {
      temperatureC: 11.4,
      conditionLabel: 'Scattered North Atlantic Frontal Cloud & Mild Breeze',
      windSpeedMs: 6.8,
      humidityPct: 76,
      precipitation24hMm: 4.2,
      next24hTempRangeC: [8.5, 13.2],
      next24hRainProbPct: 45,
      oneSentenceSummary:
        'Mild westerly flow brings light afternoon showers across the Thames Basin before high pressure builds tomorrow.',
      officialAgency: 'UK Met Office',
    },
  },
  {
    id: 'LOC-GB-COUNTRY',
    name: 'United Kingdom',
    subtitle: 'Country-Wide Synoptic View · North Sea Wind & Thames Basin',
    kind: 'COUNTRY',
    countryIso2: 'GB',
    countryName: 'United Kingdom',
    capitalCity: 'London',
    financialCentre: 'City of London',
    lat: 54.2,
    lng: -2.4,
    cameraAltitudeMeters: 1450000,
    cameraTiltDeg: 22,
    cameraHeadingDeg: 0,
    boundingBox: { west: -8.6, south: 49.9, east: 1.8, north: 60.9 },
    landmark: {
      name: 'Tower Bridge, London',
      city: 'London',
      lat: 51.5055,
      lng: -0.0754,
      altitudeMeters: 950,
      tiltDeg: 65,
      headingDeg: 35,
      description: 'Fly in to Tower Bridge and the City of London in 3D.',
      attribution: 'Google Photorealistic 3D Tiles · UK Met Office',
      wikipediaSlug: 'Tower_Bridge',
    },
    weatherSummaryDefault: {
      temperatureC: 10.8,
      conditionLabel: 'Brisk North Sea Westerlies & Passing Showers',
      windSpeedMs: 9.4,
      humidityPct: 78,
      precipitation24hMm: 6.5,
      next24hTempRangeC: [7.2, 12.8],
      next24hRainProbPct: 52,
      oneSentenceSummary:
        'Strong North Sea offshore wind generation conditions with moderate rainfall over western uplands.',
      officialAgency: 'UK Met Office',
    },
  },
  {
    id: 'LOC-JP-COUNTRY',
    name: 'Japan',
    subtitle: 'Archipelago Synoptic View · JMA Cold Surge & Pacific Corridor',
    kind: 'COUNTRY',
    countryIso2: 'JP',
    countryName: 'Japan',
    capitalCity: 'Tokyo',
    financialCentre: 'Tokyo (Marunouchi & Kabutocho)',
    lat: 36.2,
    lng: 138.25,
    cameraAltitudeMeters: 1850000,
    cameraTiltDeg: 28,
    cameraHeadingDeg: 0,
    boundingBox: { west: 129.0, south: 30.0, east: 146.0, north: 45.6 },
    landmark: {
      name: 'Tokyo Tower & Minato Skyline',
      city: 'Tokyo',
      lat: 35.6586,
      lng: 139.7454,
      altitudeMeters: 1200,
      tiltDeg: 64,
      headingDeg: 18,
      description: '3D exploration of Tokyo Tower, Tokyo Bay, and the Kanto power grid hub.',
      attribution: 'Google Photorealistic 3D Tiles · Japan Meteorological Agency (JMA)',
      wikipediaSlug: 'Tokyo_Tower',
    },
    weatherSummaryDefault: {
      temperatureC: 13.6,
      conditionLabel: 'Early Siberian Cold Intrusion & Clear Pacific Coast',
      windSpeedMs: 8.2,
      humidityPct: 62,
      precipitation24hMm: 14.8,
      next24hTempRangeC: [9.1, 15.4],
      next24hRainProbPct: 38,
      oneSentenceSummary:
        'A -2.9°C cold anomaly is advancing across northern and eastern Japan while moisture bands brush the southern Pacific coast.',
      officialAgency: 'Japan Meteorological Agency (JMA)',
    },
  },
  {
    id: 'LOC-JP-TOKYO',
    name: 'Tokyo, Japan',
    subtitle: 'Kanto Metropolitan Basin · JMA & JEPX Power Grid Hub',
    kind: 'CITY',
    countryIso2: 'JP',
    countryName: 'Japan',
    capitalCity: 'Tokyo',
    financialCentre: 'Tokyo (Marunouchi)',
    lat: 35.6586,
    lng: 139.7454,
    cameraAltitudeMeters: 4200,
    cameraTiltDeg: 58,
    cameraHeadingDeg: 15,
    boundingBox: { west: 138.9, south: 35.1, east: 140.4, north: 36.2 },
    landmark: {
      name: 'Tokyo Tower & Minato 3D',
      city: 'Tokyo',
      lat: 35.6586,
      lng: 139.7454,
      altitudeMeters: 1050,
      tiltDeg: 65,
      headingDeg: 20,
      description: 'High-resolution 3D cityscape of central Tokyo and Tokyo Tower.',
      attribution: 'Google Photorealistic 3D Tiles · JMA',
      wikipediaSlug: 'Tokyo_Tower',
    },
    weatherSummaryDefault: {
      temperatureC: 14.2,
      conditionLabel: 'Crisp Autumn Air · Cooler Evening Forecast',
      windSpeedMs: 6.4,
      humidityPct: 58,
      precipitation24hMm: 8.4,
      next24hTempRangeC: [9.8, 16.0],
      next24hRainProbPct: 30,
      oneSentenceSummary:
        'Cooler continental air lowers Tokyo evening temperatures by 2.9°C below normal, lifting Kanto heating electricity demand.',
      officialAgency: 'Japan Meteorological Agency (JMA)',
    },
  },
  {
    id: 'LOC-BR-COFFEE',
    name: 'Sul de Minas Coffee Belt, Brazil',
    subtitle: 'Minas Gerais Agricultural Region · Arabica Coffee & INMET Stations',
    kind: 'AGRICULTURAL_OR_ECONOMIC_REGION',
    countryIso2: 'BR',
    countryName: 'Brazil',
    capitalCity: 'Brasília',
    financialCentre: 'São Paulo (Faria Lima & B3)',
    lat: -21.25,
    lng: -45.45,
    cameraAltitudeMeters: 680000,
    cameraTiltDeg: 35,
    cameraHeadingDeg: 0,
    boundingBox: { west: -48.5, south: -23.5, east: -41.5, north: -18.0 },
    landmark: {
      name: 'São Paulo Financial Hub & Port of Santos',
      city: 'São Paulo',
      lat: -23.5614,
      lng: -46.6559,
      altitudeMeters: 2200,
      tiltDeg: 60,
      headingDeg: 40,
      description: '3D view of São Paulo Faria Lima / Paulista financial center and Santos export corridor.',
      attribution: 'Google Photorealistic 3D Tiles · INMET Brazil · CONAB',
      wikipediaSlug: 'Paulista_Avenue',
    },
    weatherSummaryDefault: {
      temperatureC: 28.4,
      conditionLabel: 'Persistent Moisture Deficit & Above-Normal Heat',
      windSpeedMs: 5.2,
      humidityPct: 44,
      precipitation24hMm: 2.5,
      next24hTempRangeC: [19.6, 30.2],
      next24hRainProbPct: 24,
      oneSentenceSummary:
        'Weighted multi-model ensemble projects 17.8 mm over the next 7 days vs 48 mm normal, maintaining soil-moisture stress during cherry development.',
      officialAgency: 'INMET (Instituto Nacional de Meteorologia)',
    },
  },
  {
    id: 'LOC-ASIA-REGION',
    name: 'East & Southeast Asia Corridor',
    subtitle: 'Pan-Asian Synoptic Basin · Japan, Taiwan Strait, South China Sea & India',
    kind: 'AGRICULTURAL_OR_ECONOMIC_REGION',
    countryIso2: 'JP',
    countryName: 'Asia Regional Basin',
    capitalCity: 'Tokyo / Taipei / Singapore / Mumbai',
    financialCentre: 'Tokyo · Hong Kong · Singapore · Mumbai',
    lat: 25.5,
    lng: 118.5,
    cameraAltitudeMeters: 4600000,
    cameraTiltDeg: 18,
    cameraHeadingDeg: 0,
    boundingBox: { west: 72.0, south: 5.0, east: 146.0, north: 45.0 },
    landmark: {
      name: 'Taipei 101 & Taiwan Strait Corridor',
      city: 'Taipei',
      lat: 25.0339,
      lng: 121.5645,
      altitudeMeters: 1400,
      tiltDeg: 62,
      headingDeg: 15,
      description: '3D view of Taipei 101 and northern Taiwan maritime weather corridor.',
      attribution: 'Google Photorealistic 3D Tiles · JMA · CWA · HKO',
      wikipediaSlug: 'Taipei_101',
    },
    weatherSummaryDefault: {
      temperatureC: 21.8,
      conditionLabel: 'Western Pacific Trough & Northern Siberian Cold Front',
      windSpeedMs: 17.0,
      humidityPct: 79,
      precipitation24hMm: 24.6,
      next24hTempRangeC: [14.0, 26.5],
      next24hRainProbPct: 78,
      oneSentenceSummary:
        'A bifurcated pattern brings a -2.9°C cold surge to Northeast Asia while a Western Pacific trough produces 82.1 mm ensemble rainfall along the Taiwan Strait.',
      officialAgency: 'JMA · CWA · CMA · IMD',
    },
  },
  {
    id: 'LOC-US-NYC',
    name: 'New York, United States',
    subtitle: 'Lower Manhattan Financial District & North Atlantic Storm Track',
    kind: 'CITY',
    countryIso2: 'US',
    countryName: 'United States',
    capitalCity: 'Washington, D.C.',
    financialCentre: 'New York (Wall Street & Midtown)',
    lat: 40.7128,
    lng: -74.006,
    cameraAltitudeMeters: 3600,
    cameraTiltDeg: 60,
    cameraHeadingDeg: 32,
    boundingBox: { west: -125.0, south: 24.5, east: -66.9, north: 49.4 },
    landmark: {
      name: 'Manhattan Skyline & One World Trade Center',
      city: 'New York',
      lat: 40.7127,
      lng: -74.0134,
      altitudeMeters: 1250,
      tiltDeg: 64,
      headingDeg: 28,
      description: 'Photorealistic 3D view of Lower Manhattan and New York Harbor.',
      attribution: 'Google Photorealistic 3D Tiles · NOAA NWS',
      wikipediaSlug: 'Lower_Manhattan',
    },
    weatherSummaryDefault: {
      temperatureC: 12.9,
      conditionLabel: 'Clear Barometric Ridge & Brisk Hudson Breeze',
      windSpeedMs: 5.9,
      humidityPct: 56,
      precipitation24hMm: 1.2,
      next24hTempRangeC: [8.4, 15.1],
      next24hRainProbPct: 18,
      oneSentenceSummary:
        'A 1024 hPa high-pressure ridge keeps the US Northeast dry and mild over the next 48 hours before a plains frontal system approaches.',
      officialAgency: 'NOAA National Weather Service (NWS)',
    },
  },
  {
    id: 'LOC-IN-MUMBAI',
    name: 'Mumbai, India',
    subtitle: 'Financial Centre (Mumbai) · Political Capital: New Delhi',
    kind: 'CITY',
    countryIso2: 'IN',
    countryName: 'India',
    capitalCity: 'New Delhi',
    financialCentre: 'Mumbai (Dalal Street & BKC)',
    lat: 18.922,
    lng: 72.8347,
    cameraAltitudeMeters: 4200,
    cameraTiltDeg: 56,
    cameraHeadingDeg: 45,
    boundingBox: { west: 68.1, south: 8.0, east: 97.4, north: 35.5 },
    landmark: {
      name: 'Gateway of India & Mumbai Harbour',
      city: 'Mumbai',
      lat: 18.922,
      lng: 72.8347,
      altitudeMeters: 1100,
      tiltDeg: 62,
      headingDeg: 50,
      description: '3D view of the Gateway of India and Mumbai financial peninsula.',
      attribution: 'Google Photorealistic 3D Tiles · India Meteorological Department (IMD)',
      wikipediaSlug: 'Gateway_of_India',
    },
    weatherSummaryDefault: {
      temperatureC: 30.8,
      conditionLabel: 'Warm Post-Monsoon Coastal Breeze',
      windSpeedMs: 4.8,
      humidityPct: 68,
      precipitation24hMm: 0.8,
      next24hTempRangeC: [25.2, 32.4],
      next24hRainProbPct: 12,
      oneSentenceSummary:
        'Warm, dry post-monsoon conditions across western India (+1.6°C anomaly) support port logistics and rabi crop planting.',
      officialAgency: 'India Meteorological Department (IMD)',
    },
  },
  {
    id: 'LOC-SE-STOCKHOLM',
    name: 'Stockholm, Sweden',
    subtitle: 'Nordic Hydro & Baltic Wind Basin · SMHI Telemetry',
    kind: 'CITY',
    countryIso2: 'SE',
    countryName: 'Sweden',
    capitalCity: 'Stockholm',
    financialCentre: 'Stockholm (Norrmalm)',
    lat: 59.3293,
    lng: 18.0686,
    cameraAltitudeMeters: 4500,
    cameraTiltDeg: 55,
    cameraHeadingDeg: 10,
    boundingBox: { west: 11.1, south: 55.3, east: 24.2, north: 69.1 },
    landmark: {
      name: 'Gamla Stan & Stockholm Waterfront',
      city: 'Stockholm',
      lat: 59.325,
      lng: 18.0708,
      altitudeMeters: 1100,
      tiltDeg: 62,
      headingDeg: 18,
      description: '3D view of central Stockholm archipelago and Gamla Stan.',
      attribution: 'Google Photorealistic 3D Tiles · SMHI Sweden',
      wikipediaSlug: 'Gamla_stan',
    },
    weatherSummaryDefault: {
      temperatureC: 6.4,
      conditionLabel: 'Crisp Baltic Westerlies & High Reservoir Storage',
      windSpeedMs: 7.6,
      humidityPct: 81,
      precipitation24hMm: 5.4,
      next24hTempRangeC: [3.2, 8.1],
      next24hRainProbPct: 42,
      oneSentenceSummary:
        'Mild North Atlantic moisture keeps Nordic hydro reservoirs +14.5% above seasonal average while supporting Baltic wind output.',
      officialAgency: 'SMHI (Swedish Meteorological and Hydrological Institute)',
    },
  },
];

/**
 * Resolves any search query (city, country, region, landmark, or coordinate pair)
 * into a structured `GeographicTargetLocation` without equating a country with its capital.
 */
export function resolveGeographicTarget(
  queryOrId: string,
  preferCity3D = false
): GeographicTargetLocation {
  const q = (queryOrId || '').trim();
  const qLower = q.toLowerCase();

  // 1. Direct ID match
  const exactId = CURATED_GEOGRAPHIC_TARGETS.find(
    (t) => t.id.toLowerCase() === qLower
  );
  if (exactId) return exactId;

  // 2. Coordinate pair match: e.g. "35.68, 139.76"
  const coordMatch = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = Math.max(-85, Math.min(85, Number(coordMatch[1])));
    const lng = Math.max(-180, Math.min(180, Number(coordMatch[2])));
    const nearest = resolveNearestCountryFromViewport(lat, lng);
    return buildTargetFromCountryIso(nearest.seed.iso2, {
      customLat: lat,
      customLng: lng,
      customName: `Coordinates (${lat.toFixed(2)}°, ${lng.toFixed(2)}°) · ${nearest.seed.name}`,
      isCity: preferCity3D,
    });
  }

  // 3. Special regional / city keyword checks
  if (qLower === 'london' || qLower.includes('tower bridge')) {
    return CURATED_GEOGRAPHIC_TARGETS[0];
  }
  if (
    qLower === 'uk' ||
    qLower === 'gb' ||
    qLower === 'united kingdom' ||
    qLower === 'britain'
  ) {
    return preferCity3D
      ? CURATED_GEOGRAPHIC_TARGETS[0]
      : CURATED_GEOGRAPHIC_TARGETS[1];
  }
  if (qLower === 'tokyo' || qLower.includes('tokyo tower')) {
    return CURATED_GEOGRAPHIC_TARGETS[3];
  }
  if (qLower === 'japan' || qLower === 'jp') {
    return preferCity3D
      ? CURATED_GEOGRAPHIC_TARGETS[3]
      : CURATED_GEOGRAPHIC_TARGETS[2];
  }
  if (
    qLower.includes('coffee') ||
    qLower.includes('minas') ||
    qLower === 'brazil' ||
    qLower === 'br'
  ) {
    return CURATED_GEOGRAPHIC_TARGETS[4];
  }
  if (qLower.includes('asia')) {
    return CURATED_GEOGRAPHIC_TARGETS[5];
  }
  if (qLower.includes('new york') || qLower.includes('manhattan') || qLower === 'nyc') {
    return CURATED_GEOGRAPHIC_TARGETS[6];
  }
  if (qLower.includes('mumbai') || qLower.includes('india') || qLower === 'in') {
    return CURATED_GEOGRAPHIC_TARGETS[7];
  }
  if (qLower.includes('stockholm') || qLower.includes('sweden') || qLower === 'se') {
    return CURATED_GEOGRAPHIC_TARGETS[8];
  }

  // 4. Search across all 45+ countries in countryDeepDiveEngine / worldPulseCountryEngine
  const hits = searchCountriesAutocomplete(q, 5);
  if (hits.length > 0) {
    return buildTargetFromCountryIso(hits[0].iso2, { isCity: preferCity3D });
  }

  const fallbackCountry = resolveCountryOrUnseenProfile(q || 'GB');
  return buildTargetFromCountryIso(fallbackCountry.iso2, { isCity: preferCity3D });
}

export function buildTargetFromCountryIso(
  iso2OrName: string,
  options?: {
    customLat?: number;
    customLng?: number;
    customName?: string;
    isCity?: boolean;
  }
): GeographicTargetLocation {
  const country = resolveCountryOrUnseenProfile(iso2OrName);
  const deep = getCountryDeepDiveProfile(country.iso2);
  const lat = options?.customLat ?? country.countryCameraView.lat;
  const lng = options?.customLng ?? country.countryCameraView.lng;
  const isCity = options?.isCity ?? false;

  const baseTemp = parseFloat(deep.weatherProfile.temperatureAnomalyC)
    ? 18 + parseFloat(deep.weatherProfile.temperatureAnomalyC)
    : 19.5;

  return {
    id: `LOC-${country.iso2}-${isCity ? 'CITY' : 'COUNTRY'}`,
    name:
      options?.customName ||
      (isCity
        ? `${country.featuredLandmark.city}, ${country.name}`
        : country.name),
    subtitle:
      country.capitalCity !== country.primaryFinancialCentre
        ? `Political Capital: ${country.capitalCity} · Financial Centre: ${country.primaryFinancialCentre}`
        : `${country.name} · ${country.primaryFinancialCentre}`,
    kind: isCity ? 'CITY' : 'COUNTRY',
    countryIso2: country.iso2,
    countryName: country.name,
    capitalCity: country.capitalCity,
    financialCentre: country.primaryFinancialCentre,
    lat: isCity ? country.featuredLandmark.lat : lat,
    lng: isCity ? country.featuredLandmark.lng : lng,
    cameraAltitudeMeters: isCity ? 3800 : 1650000,
    cameraTiltDeg: isCity ? 58 : 24,
    cameraHeadingDeg: isCity ? 25 : 0,
    boundingBox: {
      west: lng - 6,
      south: lat - 5,
      east: lng + 6,
      north: lat + 5,
    },
    landmark: {
      name: country.featuredLandmark.name,
      city: country.featuredLandmark.city,
      lat: country.featuredLandmark.lat,
      lng: country.featuredLandmark.lng,
      altitudeMeters: 1100,
      tiltDeg: 64,
      headingDeg: 30,
      description: country.featuredLandmark.financialDistrictContext,
      attribution: `${country.featuredLandmark.photographerAttribution} · ${country.featuredLandmark.license}`,
      wikipediaSlug: country.featuredLandmark.wikipediaSlug,
    },
    weatherSummaryDefault: {
      temperatureC: Number(baseTemp.toFixed(1)),
      conditionLabel: deep.weatherProfile.currentSeasonalPatternTitle,
      windSpeedMs: 6.5,
      humidityPct: 68,
      precipitation24hMm: 8.2,
      next24hTempRangeC: [
        Number((baseTemp - 3.5).toFixed(1)),
        Number((baseTemp + 2.8).toFixed(1)),
      ],
      next24hRainProbPct: 36,
      oneSentenceSummary: deep.weatherProfile.expectedPatternForecast,
      officialAgency: `${deep.weatherProfile.meteorologicalInstituteName} (${deep.weatherProfile.instituteAcronym})`,
    },
  };
}

export function searchGeographicTargets(query: string, limit = 8): GeographicTargetLocation[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return CURATED_GEOGRAPHIC_TARGETS.slice(0, limit);
  }

  const curatedMatches = CURATED_GEOGRAPHIC_TARGETS.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.countryName.toLowerCase().includes(q) ||
      t.countryIso2.toLowerCase() === q ||
      t.subtitle.toLowerCase().includes(q) ||
      t.landmark?.name.toLowerCase().includes(q)
  );

  const countryMatches = searchCountriesAutocomplete(query, limit)
    .filter((c) => !curatedMatches.some((m) => m.countryIso2 === c.iso2))
    .map((c) => buildTargetFromCountryIso(c.iso2));

  const registryMatches = COUNTRY_REGISTRY.filter(
    (c) =>
      (c.name.toLowerCase().includes(q) ||
        c.capitalCity.toLowerCase().includes(q) ||
        c.primaryFinancialCentre.toLowerCase().includes(q) ||
        c.featuredLandmark.name.toLowerCase().includes(q)) &&
      !curatedMatches.some((m) => m.countryIso2 === c.iso2) &&
      !countryMatches.some((m) => m.countryIso2 === c.iso2)
  ).map((c) => buildTargetFromCountryIso(c.iso2));

  return [...curatedMatches, ...countryMatches, ...registryMatches].slice(0, limit);
}
