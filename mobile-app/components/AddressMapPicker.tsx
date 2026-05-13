import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchPlaces, type PlaceSuggestion } from '@/api/mapService';

import type { AddressMapPickerProps } from './AddressMapPicker.types';

const SEARCH_DEBOUNCE_MS = 320;

const OLA_MAPS_API_KEY = (process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY || '').trim();
const OLA_STYLE_URL =
  'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json';

/**
 * Renders Ola map tiles inside a WebView using MapLibre GL JS (the same renderer the Ola Web SDK uses).
 * Tile + style requests are signed with the project's Ola key via `transformRequest`.
 */
function buildMapHtml(apiKey: string, lat: number, lng: number): string {
  const safeKey = apiKey.replace(/"/g, '\\"');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
  body { background: #f1f5f9; -webkit-tap-highlight-color: transparent; }
  .err {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    padding: 24px; text-align: center; font: 500 14px -apple-system, system-ui, sans-serif; color: #475569;
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="err" class="err" style="display:none"></div>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
(function () {
  var post = function (msg) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  };
  var showErr = function (text) {
    var el = document.getElementById('err');
    el.style.display = 'flex';
    el.textContent = text;
    post({ type: 'error', message: text });
  };
  var API_KEY = "${safeKey}";
  if (!API_KEY) { showErr('Missing Ola Maps API key (EXPO_PUBLIC_OLA_MAPS_API_KEY).'); return; }

  try {
    var map = new maplibregl.Map({
      container: 'map',
      style: '${OLA_STYLE_URL}',
      center: [${lng}, ${lat}],
      zoom: 16,
      attributionControl: false,
      transformRequest: function (url) {
        if (url.indexOf('api.olamaps.io') === -1) return { url: url };
        var sep = url.indexOf('?') === -1 ? '?' : '&';
        return { url: url + sep + 'api_key=' + encodeURIComponent(API_KEY) };
      }
    });

    map.on('load', function () {
      post({ type: 'ready' });
      var c = map.getCenter();
      post({ type: 'region', lat: c.lat, lng: c.lng });
    });

    var debounce = null;
    map.on('moveend', function () {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(function () {
        var c = map.getCenter();
        post({ type: 'region', lat: c.lat, lng: c.lng });
      }, 80);
    });

    // Swallow non-fatal style/source warnings (Ola style references a 3d_model layer that is
    // not in the basic tileset). The map still renders, so we do not surface these as errors.
    map.on('error', function () { });

    window.__flyTo = function (lng, lat) {
      try { map.flyTo({ center: [lng, lat], zoom: 16, essential: true }); } catch (e) {}
    };
  } catch (e) {
    showErr((e && e.message) || 'Failed to initialize map.');
  }
})();
true;
</script>
</body>
</html>`;
}

export default function AddressMapPicker({
  visible,
  region,
  line1,
  isFetchingAddress,
  onRegionChangeComplete,
  onConfirm,
  onClose,
}: AddressMapPickerProps) {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deltaRef = useRef({ latitudeDelta: 0.005, longitudeDelta: 0.005 });

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchCompletedEmpty, setSearchCompletedEmpty] = useState(false);
  const [mapError, setMapError] = useState('');

  const initialLat = region?.latitude ?? 12.9716;
  const initialLng = region?.longitude ?? 77.5946;
  const html = useMemo(
    () => buildMapHtml(OLA_MAPS_API_KEY, initialLat, initialLng),
    [initialLat, initialLng],
  );

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSuggestions([]);
      setSearchError('');
      setSearchCompletedEmpty(false);
      setSearchFocused(false);
      setMapError('');
      searchAbortRef.current?.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    }
  }, [visible]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearchLoading(false);
      setSearchCompletedEmpty(false);
      searchAbortRef.current?.abort();
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearchLoading(true);
      setSearchError('');
      setSearchCompletedEmpty(false);
      try {
        const list = await searchPlaces(q, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setSuggestions(list);
          setSearchCompletedEmpty(list.length === 0);
        }
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string };
        if (err?.name === 'AbortError') return;
        setSuggestions([]);
        setSearchCompletedEmpty(false);
        setSearchError(err?.message || 'Search failed');
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery]);

  const flyMapTo = useCallback((lat: number, lng: number) => {
    webRef.current?.injectJavaScript(
      `(function(){try{window.__flyTo && window.__flyTo(${lng}, ${lat});}catch(e){}})();true;`,
    );
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as
          | { type: 'region'; lat: number; lng: number }
          | { type: 'ready' }
          | { type: 'error'; message?: string };
        if (data.type === 'region') {
          onRegionChangeComplete({
            latitude: data.lat,
            longitude: data.lng,
            latitudeDelta: deltaRef.current.latitudeDelta,
            longitudeDelta: deltaRef.current.longitudeDelta,
          });
        } else if (data.type === 'error') {
          setMapError(data.message || 'Map error');
        }
      } catch {
        /* ignore malformed message */
      }
    },
    [onRegionChangeComplete],
  );

  const pickSuggestion = (place: PlaceSuggestion) => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery('');
    setSuggestions([]);
    setSearchError('');
    flyMapTo(place.lat, place.lng);
  };

  const showSuggestionPanel =
    searchFocused &&
    searchQuery.trim().length >= 3 &&
    (searchLoading || suggestions.length > 0 || !!searchError || searchCompletedEmpty);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://localhost' }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          style={{ flex: 1 }}
        />

        <View style={[styles.mapHeader, { paddingTop: Math.max(insets.top, 8) }]} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              onClose();
            }}
            style={styles.mapHeaderBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.mapHeaderTitle} numberOfLines={1}>
            Pin location
          </Text>
          <View style={styles.mapHeaderSpacer} />
        </View>

        <View
          style={[styles.searchWrap, { paddingTop: Math.max(insets.top, 8) + 48 }]}
          pointerEvents="box-none"
        >
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#64748b" style={styles.searchIcon} />
            <TextInput
              placeholder="Search area or landmark…"
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                setSearchError('');
                setSearchCompletedEmpty(false);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              editable
              returnKeyType="search"
              onSubmitEditing={() => {
                if (suggestions.length > 0) pickSuggestion(suggestions[0]);
              }}
            />
            {searchLoading ? (
              <ActivityIndicator size="small" color="#4b6f9e" style={styles.searchSpinner} />
            ) : null}
          </View>

          {showSuggestionPanel ? (
            <View style={styles.suggestionsBox}>
              {searchError ? (
                <Text style={styles.suggestionMeta}>{searchError}</Text>
              ) : searchLoading ? (
                <Text style={styles.suggestionMeta}>Searching…</Text>
              ) : suggestions.length === 0 ? (
                <Text style={styles.suggestionMeta}>No suggestions — try another phrase or move the map.</Text>
              ) : (
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 220 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.suggestionRow} onPress={() => pickSuggestion(item)}>
                      <Ionicons name="location-outline" size={18} color="#4b6f9e" />
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.markerFixed} pointerEvents="none">
          <Ionicons name="location" size={40} color="#ef4444" />
        </View>

        <View style={styles.mapFooter}>
          {mapError ? <Text style={styles.mapError}>{mapError}</Text> : null}
          <Text style={styles.mapAddr}>{isFetchingAddress ? 'Fetching address...' : line1}</Text>
          <TouchableOpacity style={styles.mapConfirmBtn} onPress={() => void onConfirm()}>
            <Text style={styles.mapConfirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  mapHeaderBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  mapHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  mapHeaderSpacer: { width: 44 },
  searchWrap: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, height: 46, fontSize: 15, color: '#1e293b' },
  searchSpinner: { marginLeft: 6 },
  suggestionsBox: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    maxHeight: 240,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  suggestionText: { flex: 1, fontSize: 14, color: '#1e293b' },
  suggestionMeta: { padding: 14, fontSize: 13, color: '#64748b' },
  markerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40 },
  mapFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  mapError: {
    marginBottom: 8,
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  mapAddr: { marginBottom: 15, color: '#1e293b', fontWeight: '500' },
  mapConfirmBtn: {
    backgroundColor: '#4b6f9e',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  mapConfirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
