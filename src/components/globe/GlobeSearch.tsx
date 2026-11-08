// ============================================================================
// ALPHAFORGE ATMOSPHERE — MINIMAL GLOBE LOCATION SEARCH BAR
// Supports Countries, Cities, Regions, Agricultural Zones, and Coordinates
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Compass, X } from 'lucide-react';
import {
  searchGeographicTargets,
  type GeographicTargetLocation,
} from '../../engine/globe/GeographicSelectionService';
import { atmosphereStore, useAtmosphereStore } from '../../state/atmosphereStore';
import { globeController } from '../../engine/globe/GlobeController';
import { argonAudioManager } from '../../engine/argonAudioManager';

export const GlobeSearch: React.FC = () => {
  const state = useAtmosphereStore();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<GeographicTargetLocation[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setResults(searchGeographicTargets(query, 8));
  }, [query]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectPlace = (place: GeographicTargetLocation) => {
    atmosphereStore.selectLocation(place, { openSummary: true });
    argonAudioManager.triggerSound('MAP_TRANSITION', `Flew to ${place.name}`);
    setQuery(place.name);
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    const coordMatch = trimmed.match(
      /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/
    );
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      globeController.flyToCoordinates(lat, lng, 380_000);
      argonAudioManager.triggerSound('MAP_TRANSITION');
      setIsOpen(false);
      return;
    }

    if (results.length > 0) {
      handleSelectPlace(results[0]);
    } else {
      globeController.executeCommand('fly_to_city', { city: trimmed });
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 bg-slate-950/75 hover:bg-slate-900/85 backdrop-blur-md border border-slate-700/60 focus-within:border-sky-400/80 rounded-full px-3.5 py-1.5 shadow-lg transition-colors"
      >
        <Search className="w-4 h-4 text-sky-400 shrink-0" />
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder={
            state.locationSummaryOpen && state.selectedLocation
              ? `${state.selectedLocation.name} — Search Earth...`
              : 'Search country, city, or region...'
          }
          aria-label="Search country, city, region, or coordinates"
          data-testid="globe-search-input"
          className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(true);
            }}
            aria-label="Clear search"
            className="text-slate-400 hover:text-slate-200 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      {isOpen && results.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-2 bg-slate-950/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-72 overflow-y-auto"
          role="listbox"
          data-testid="globe-search-results"
        >
          {results.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => handleSelectPlace(place)}
              data-testid={`search-option-${place.id}`}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-sky-500/15 transition-colors border-b border-slate-800/50 last:border-b-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {place.kind === 'CITY' ? (
                  <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                ) : (
                  <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <div className="truncate">
                  <div className="text-xs sm:text-sm font-medium text-slate-100 truncate">
                    {place.name}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {place.subtitle}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-400 ml-2 shrink-0">
                {place.lat.toFixed(1)}°, {place.lng.toFixed(1)}°
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
