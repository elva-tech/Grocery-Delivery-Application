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
import { getOlaMapsApiKey } from '@/src/utils/olaMapsApiKey';

import { buildOlaMapPickerHtml } from './olaMapPickerHtml';
import type { AddressMapPickerProps } from './AddressMapPicker.types';

const SEARCH_DEBOUNCE_MS = 320;
const DEFAULT_LAT = 12.9716;
const DEFAULT_LNG = 77.5946;

type MapWebMessage =
  | { type: 'ready' }
  | { type: 'error'; message?: string }
  | { type: 'location'; lat: number; lng: number };

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
  const webViewRef = useRef<WebView>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deltaRef = useRef({ latitudeDelta: 0.005, longitudeDelta: 0.005 });
  const mapReadyRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchCompletedEmpty, setSearchCompletedEmpty] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [mapHtml, setMapHtml] = useState<string | null>(null);

  const initialLat = region?.latitude ?? DEFAULT_LAT;
  const initialLng = region?.longitude ?? DEFAULT_LNG;

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSuggestions([]);
      setSearchError('');
      setSearchCompletedEmpty(false);
      setSearchFocused(false);
      setMapLoading(true);
      setMapError('');
      setMapHtml(null);
      mapReadyRef.current = false;
      searchAbortRef.current?.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    (async () => {
      setMapLoading(true);
      setMapError('');
      try {
        const apiKey = await getOlaMapsApiKey();
        if (cancelled) return;
        if (!apiKey) {
          setMapError(
            'Map is unavailable — Ola Maps API key is not configured on the backend (OLA_MAPS_API_KEY).',
          );
          setMapHtml(null);
          return;
        }
        setMapHtml(
          buildOlaMapPickerHtml({
            apiKey,
            lat: initialLat,
            lng: initialLng,
          }),
        );
      } catch (e: unknown) {
        if (cancelled) return;
        setMapError(e instanceof Error ? e.message : 'Could not load map');
        setMapHtml(null);
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, initialLat, initialLng]);

  useEffect(() => {
    if (!visible || !mapReadyRef.current || !region) return;
    webViewRef.current?.injectJavaScript(
      `window.__setMapCenter(${region.latitude}, ${region.longitude}, true); true;`,
    );
  }, [visible, region?.latitude, region?.longitude]);

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

  const handleRegionComplete = useCallback(
    (r: Parameters<AddressMapPickerProps['onRegionChangeComplete']>[0]) => {
      deltaRef.current = {
        latitudeDelta: r.latitudeDelta,
        longitudeDelta: r.longitudeDelta,
      };
      onRegionChangeComplete(r);
    },
    [onRegionChangeComplete],
  );

  const onWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as MapWebMessage;
        if (data.type === 'ready') {
          mapReadyRef.current = true;
          setMapLoading(false);
          return;
        }
        if (data.type === 'error') {
          mapReadyRef.current = false;
          setMapError(data.message || 'Map failed to load');
          setMapLoading(false);
          return;
        }
        if (data.type === 'location') {
          handleRegionComplete({
            latitude: data.lat,
            longitude: data.lng,
            latitudeDelta: deltaRef.current.latitudeDelta,
            longitudeDelta: deltaRef.current.longitudeDelta,
          });
        }
      } catch {
        /* ignore malformed messages */
      }
    },
    [handleRegionComplete],
  );

  const pickSuggestion = (place: PlaceSuggestion) => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery('');
    setSuggestions([]);
    setSearchError('');
    webViewRef.current?.injectJavaScript(
      `window.__setMapCenter(${place.lat}, ${place.lng}, true); true;`,
    );
    handleRegionComplete({
      latitude: place.lat,
      longitude: place.lng,
      latitudeDelta: deltaRef.current.latitudeDelta,
      longitudeDelta: deltaRef.current.longitudeDelta,
    });
  };

  const showSuggestionPanel =
    searchFocused &&
    searchQuery.trim().length >= 3 &&
    (searchLoading || suggestions.length > 0 || !!searchError || searchCompletedEmpty);

  const mapSource = useMemo(
    () => (mapHtml ? { html: mapHtml } : undefined),
    [mapHtml],
  );

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {mapSource ? (
          <WebView
            ref={webViewRef}
            source={mapSource}
            style={{ flex: 1 }}
            onMessage={onWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
            originWhitelist={['*']}
            setSupportMultipleWindows={false}
          />
        ) : (
          <View style={styles.mapFallback}>
            {mapLoading ? (
              <>
                <ActivityIndicator size="large" color="#4b6f9e" />
                <Text style={styles.mapFallbackText}>Loading map…</Text>
              </>
            ) : (
              <>
                <Ionicons name="map-outline" size={48} color="#94a3b8" />
                <Text style={styles.mapFallbackText}>
                  {mapError || 'Map unavailable. Check your connection and try again.'}
                </Text>
              </>
            )}
          </View>
        )}

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
              onChangeText={t => {
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
                  keyExtractor={item => item.id}
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
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#e2e8f0',
    gap: 12,
  },
  mapFallbackText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
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
