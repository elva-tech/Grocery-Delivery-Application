import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchPlaces, type PlaceSuggestion } from '@/api/mapService';

import type { AddressMapPickerProps } from './AddressMapPicker.types';

const SEARCH_DEBOUNCE_MS = 320;

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
  const mapRef = useRef<MapView>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchError, setSearchError] = useState('');
  /** True after a debounced request finished with zero results (not shown until then). */
  const [searchCompletedEmpty, setSearchCompletedEmpty] = useState(false);
  const deltaRef = useRef({ latitudeDelta: 0.005, longitudeDelta: 0.005 });

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSuggestions([]);
      setSearchError('');
      setSearchCompletedEmpty(false);
      setSearchFocused(false);
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

  const pickSuggestion = (place: PlaceSuggestion) => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery('');
    setSuggestions([]);
    setSearchError('');
    const next = {
      latitude: place.lat,
      longitude: place.lng,
      latitudeDelta: deltaRef.current.latitudeDelta,
      longitudeDelta: deltaRef.current.longitudeDelta,
    };
    mapRef.current?.animateToRegion(next, 450);
    // animateToRegion does not always fire onRegionChangeComplete on every platform build
    handleRegionComplete(next);
  };

  const showSuggestionPanel =
    searchFocused &&
    searchQuery.trim().length >= 3 &&
    (searchLoading || suggestions.length > 0 || !!searchError || searchCompletedEmpty);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={region ?? undefined}
          onRegionChangeComplete={handleRegionComplete}
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
