import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OlaMaps } from 'olamaps-web-sdk';
import { processSelectedLocation, searchPlaces } from '../../api/mapApi';
import { getAccurateLocation } from '../../utils/geolocation';
import './LocationPicker.css';

const BANGALORE_CENTER = { lat: 12.9716, lng: 77.5946 };
const MAP_STYLE_URL =
  'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json';

const SEARCH_DEBOUNCE_MS = 320;

function isLikelyDesktopBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    ua,
  );
}

/** Non-blocking copy for GPS accuracy tiers (desktop skips the strongest wording). */
function accuracyHintMessage(accuracyMeters, desktop) {
  if (accuracyMeters <= 500) return '';

  if (accuracyMeters <= 3000) {
    return 'Location may be slightly off. You can drag the pin to adjust.';
  }

  if (desktop) {
    return 'Location may be slightly off. You can drag the pin to adjust.';
  }

  return "We've set your approximate location. Adjust pin if needed.";
}

function getMapsApiKey() {
  return (
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.REACT_APP_OLA_MAPS_API_KEY ||
        import.meta.env.VITE_OLA_MAPS_API_KEY)) ||
    (typeof process !== 'undefined' &&
      process.env &&
      process.env.REACT_APP_OLA_MAPS_API_KEY) ||
    ''
  );
}

function LocationPicker({
  points = [],
  requestConfig = {
    maxDistanceKm: 10,
    enableEligibilityCheck: true,
  },
  onLocationConfirmed,
}) {
  const mapContainerId = useMemo(
    () => `ola-location-map-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const searchAbortRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [result, setResult] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHadNoResults, setSearchHadNoResults] = useState(false);

  const upsertMarker = useCallback((lat, lng) => {
    if (!mapRef.current) return;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    const marker = new OlaMaps.Marker({ draggable: true })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);

    marker.on('dragend', () => {
      setInfoMessage('');
      const draggedPosition = marker.getLngLat();
      setSelectedLocation({
        lat: Number(draggedPosition.lat.toFixed(6)),
        lng: Number(draggedPosition.lng.toFixed(6)),
      });
    });

    markerRef.current = marker;
  }, [setInfoMessage]);

  const setLocation = useCallback(
    ({ lat, lng }, shouldFlyTo = false) => {
      const nextLocation = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      };

      setSelectedLocation(nextLocation);
      upsertMarker(nextLocation.lat, nextLocation.lng);

      if (shouldFlyTo && mapRef.current) {
        mapRef.current.flyTo({
          center: [nextLocation.lng, nextLocation.lat],
          zoom: 15,
          essential: true,
        });
      }
    },
    [upsertMarker],
  );

  useEffect(() => {
    return () => searchAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setSuggestions([]);
      setSearchLoading(false);
      setSearchHadNoResults(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      searchAbortRef.current?.abort();
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      setSearchLoading(true);
      setSearchHadNoResults(false);

      searchPlaces(q, { signal: ctrl.signal })
        .then((rows) => {
          if (ctrl.signal.aborted) return;
          setSuggestions(rows);
          setSearchHadNoResults(rows.length === 0);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          if (!ctrl.signal.aborted) {
            setSuggestions([]);
            setSearchHadNoResults(false);
          }
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setSearchLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const handlePickSuggestion = useCallback(
    (place) => {
      setError('');
      setInfoMessage('');
      setSearchQuery('');
      setSuggestions([]);
      setSearchHadNoResults(false);
      setSearchFocused(false);
      setLocation({ lat: place.lat, lng: place.lng }, true);
    },
    [setLocation],
  );

  useEffect(() => {
    let disposed = false;

    const initMap = async () => {
      const apiKey = getMapsApiKey();

      if (!apiKey) {
        setError('Missing maps API key. Add REACT_APP_OLA_MAPS_API_KEY.');
        return;
      }

      try {
        const olaMaps = new OlaMaps({ apiKey });
        const map = await olaMaps.init({
          style: MAP_STYLE_URL,
          container: mapContainerId,
          center: [BANGALORE_CENTER.lng, BANGALORE_CENTER.lat],
          zoom: 15,
        });

        if (disposed) {
          map.remove();
          return;
        }

        mapRef.current = map;
        setMapReady(true);

        map.on('click', (event) => {
          setInfoMessage('');
          const clickedLat = event.lngLat.lat;
          const clickedLng = event.lngLat.lng;
          setLocation({ lat: clickedLat, lng: clickedLng });
        });

        map.on('error', () => {
          setError('Map loading issue detected. Please refresh and try again.');
        });
      } catch (initError) {
        setError(initError?.message || 'Unable to initialize map.');
      }
    };

    initMap();

    return () => {
      disposed = true;
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapContainerId, setLocation]);

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setInfoMessage('');
      setError('Geolocation is not supported in this browser.');
      return;
    }

    const desktop = isLikelyDesktopBrowser();

    setError('');
    setInfoMessage('');
    setIsFetchingLocation(true);

    try {
      const { lat, lng, accuracyMeters } = await getAccurateLocation();
      setLocation({ lat, lng }, true);
      setInfoMessage(accuracyHintMessage(accuracyMeters, desktop));
    } catch (geoError) {
      setInfoMessage('');
      if (geoError?.code === 1) {
        setError(
          'Location permission is off. Enable it in your browser settings, or pick a spot on the map.',
        );
      } else {
        setError(
          'Could not detect precise location. Please adjust manually on the map.',
        );
      }
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleConfirmLocation = async () => {
    if (!selectedLocation) {
      setInfoMessage('');
      setError('Select a location by clicking the map or dragging the marker.');
      return;
    }

    if (!Array.isArray(points) || points.length === 0) {
      setInfoMessage('');
      setError('At least one destination point is required.');
      return;
    }

    setError('');
    setInfoMessage('');
    setIsSubmitting(true);

    const payload = {
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      points,
      config: requestConfig,
    };

    try {
      const apiResponse = await processSelectedLocation(payload);
      setResult(apiResponse);

      if (typeof onLocationConfirmed === 'function') {
        onLocationConfirmed({
          selectedLocation,
          response: apiResponse,
        });
      }
    } catch (apiError) {
      setError(apiError?.message || 'Unable to process selected location.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="location-picker">
      <div className="location-picker__header">
        <h2>Select Delivery Location</h2>
        <p>Search, use GPS, or tap the map to choose your spot.</p>
      </div>

      <div className="location-picker__search">
        <label className="location-picker__search-label" htmlFor={`${mapContainerId}-search`}>
          Search area or landmark
        </label>
        <div className="location-picker__search-field">
          <input
            id={`${mapContainerId}-search`}
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Try Whitefield, MG Road…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              window.setTimeout(() => setSearchFocused(false), 180);
            }}
            disabled={!mapReady}
            aria-expanded={
              !!(
                searchFocused &&
                searchQuery.trim().length >= 3 &&
                (suggestions.length > 0 || searchLoading || searchHadNoResults)
              )
            }
            aria-controls={`${mapContainerId}-suggestions`}
            aria-autocomplete="list"
          />
          {searchFocused &&
            searchQuery.trim().length >= 3 &&
            (suggestions.length > 0 || searchLoading || searchHadNoResults) && (
              <ul
                id={`${mapContainerId}-suggestions`}
                className="location-picker__suggestions"
                role="listbox"
              >
                {searchLoading && suggestions.length === 0 && (
                  <li className="location-picker__suggestion-muted" role="presentation">
                    Searching…
                  </li>
                )}
                {!searchLoading &&
                  searchHadNoResults &&
                  suggestions.length === 0 && (
                    <li className="location-picker__suggestion-muted" role="presentation">
                      No suggestions — try another phrase or pick on the map.
                    </li>
                  )}
                {suggestions.map((place) => (
                  <li key={place.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className="location-picker__suggestion-btn"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePickSuggestion(place)}
                    >
                      {place.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>

      <div id={mapContainerId} className="location-picker__map" />

      <div className="location-picker__actions">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={!mapReady || isFetchingLocation}
        >
          {isFetchingLocation ? 'Fetching your location...' : 'Use Current Location'}
        </button>

        <button
          type="button"
          className="primary"
          onClick={handleConfirmLocation}
          disabled={!mapReady || !selectedLocation || isSubmitting}
        >
          {isSubmitting ? 'Confirming...' : 'Confirm Location'}
        </button>
      </div>

      {selectedLocation && (
        <p className="location-picker__coords">
          Lat: {selectedLocation.lat}, Lng: {selectedLocation.lng}
        </p>
      )}

      {infoMessage && (
        <p className="location-picker__info" role="status">
          {infoMessage}
        </p>
      )}

      {error && <p className="location-picker__error">{error}</p>}

      {result && (
        <div className="location-picker__result">
          <h3>Delivery Check Result</h3>
          <p>Address: {result.address || 'N/A'}</p>
          <p>Distance: {result.distance ?? 'N/A'} km</p>
          <p>ETA: {result.duration ?? 'N/A'} mins</p>
          <p>
            Eligibility:{' '}
            {typeof result.isEligible === 'boolean'
              ? result.isEligible
                ? 'Yes'
                : 'No'
              : 'N/A'}
          </p>
          <p>Message: {result.message || 'N/A'}</p>
        </div>
      )}
    </section>
  );
}

export default LocationPicker;
