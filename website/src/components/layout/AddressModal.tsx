import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { X, MapPin, Loader2, AlertCircle, Check } from 'lucide-react';
import type { RootState } from '../../store/store';
import { OlaMaps } from 'olamaps-web-sdk';
import { getAddressDetailsFromCoords, addAddress, updateAddress } from '../../api/addresses';
import { searchPlaces } from '../../api/mapApi';
import { WEBSITE_DELIVERY_COORDS_CHANGED } from '../../api/deliveryEligibilityApi';
import {
  formatAddressSummary,
  isValidIndianPincode,
  lookupIndianPincode,
  sanitizeIndianPincode,
} from '../../utils/indiaPincode';
import { requestPrecisePosition } from '../../utils/geolocation';
import { parseAddressLatLng } from '../../utils/coordinates';
import { getOlaMapsApiKey } from '../../utils/olaMapsApiKey';

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, modal edits this saved address (must include `id`). */
  editAddress?: Record<string, unknown> | null;
  /** New addresses only: open directly on the map pin step first. */
  startWithMap?: boolean;
  /** Called after a successful save with normalized fields (id, lat, lng, full, …). */
  onAddressSaved?: (address: Record<string, unknown>) => void;
}

const emptyForm = (phone: string) => ({
  label: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  phone,
  altPhone: '',
});

function digits10FromStored(phone: unknown): string {
  const s = String(phone ?? '').replace(/^\+91\s*/, '').replace(/\D/g, '');
  return s.slice(-10);
}

type PlaceSuggestion = { id: string; name: string; lat: number; lng: number };

const MAP_SEARCH_DEBOUNCE_MS = 320;

const AddressModal: React.FC<AddressModalProps> = ({
  isOpen,
  onClose,
  editAddress = null,
  startWithMap = false,
  onAddressSaved,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const userPhone = (user?.phone || '').replace(/^\+91\s*/, '');
  const [form, setForm] = useState(() => emptyForm(userPhone));
  const [loading, setLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showMap, setShowMap] = useState(false);
  const [coords, setCoords] = useState<[number, number]>([12.9716, 77.5946]);
  const [searchQuery, setSearchQuery] = useState('');
  const mapContainerId = useMemo(
    () => `address-modal-map-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  /** Latest coords for async map init (avoids stale closure after GPS updates). */
  const coordsRef = useRef<[number, number]>([12.9716, 77.5946]);

  const [searchSuggestions, setSearchSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHadNoResults, setSearchHadNoResults] = useState(false);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  useEffect(() => {
    return () => searchAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!showMap) {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setSearchSuggestions([]);
      setSearchLoading(false);
      setSearchHadNoResults(false);
      setSearchQuery('');
    }
  }, [showMap]);

  useEffect(() => {
    if (!isOpen || !showMap) return undefined;

    const q = searchQuery.trim();
    if (q.length < 3) {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setSearchSuggestions([]);
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
        .then((rows: PlaceSuggestion[]) => {
          if (ctrl.signal.aborted) return;
          setSearchSuggestions(rows);
          setSearchHadNoResults(rows.length === 0);
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          if (!ctrl.signal.aborted) {
            setSearchSuggestions([]);
            setSearchHadNoResults(false);
          }
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setSearchLoading(false);
        });
    }, MAP_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchQuery, showMap, isOpen]);

  const upsertMarker = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    const marker = new OlaMaps.Marker({ draggable: true })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);

    marker.on('dragend', () => {
      const dragged = marker.getLngLat();
      const draggedLat = Number(dragged.lat);
      const draggedLng = Number(dragged.lng);
      setCoords([draggedLat, draggedLng]);
      fetchAddressFromMap(draggedLat, draggedLng);
    });

    markerRef.current = marker;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const ed = editAddress as Record<string, any> | null | undefined;
    const mapFirst = Boolean(startWithMap && !ed?.id);
    setShowMap(mapFirst);
    setSearchQuery('');
    setErrorMsg(null);
    if (ed?.id) {
      setForm({
        label: String(ed.label || ''),
        line1: String(ed.line1 || ed.full || ''),
        line2: String(ed.line2 || ''),
        landmark: String(ed.landmark || ''),
        city: String(ed.city || ''),
        state: String(ed.state || ''),
        pincode: String(ed.pincode || '').replace(/\D/g, '').slice(0, 6),
        phone: digits10FromStored(ed.phone) || userPhone,
        altPhone: ed.altPhone ? digits10FromStored(ed.altPhone) : '',
      });
      const pin = parseAddressLatLng(ed as { lat?: unknown; lng?: unknown });
      const lat = pin?.lat ?? 12.9716;
      const lng = pin?.lng ?? 77.5946;
      setCoords([lat, lng]);
    } else {
      setForm(emptyForm(userPhone));
      setCoords([12.9716, 77.5946]);
    }
  }, [isOpen, editAddress, userPhone, startWithMap]);

  useEffect(() => {
    if (!isOpen || !showMap) return;

    let disposed = false;

    const initMap = async () => {
      if (mapRef.current) return;

      const apiKey = await getOlaMapsApiKey();
      if (!apiKey) {
        showError(
          'Map is unavailable — Ola Maps API key is not configured. Redeploy the site with VITE_OLA_MAPS_API_KEY or set OLA_MAPS_API_KEY on the backend.',
        );
        return;
      }

      try {
        const [lat0, lng0] = coordsRef.current;
        const olaMaps = new OlaMaps({ apiKey });
        const map = await olaMaps.init({
          style: 'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json',
          container: mapContainerId,
          center: [lng0, lat0],
          zoom: 15,
        });

        if (disposed) {
          map.remove();
          return;
        }

        mapRef.current = map;
        const [lat, lng] = coordsRef.current;
        if (typeof map.jumpTo === 'function') {
          map.jumpTo({ center: [lng, lat], zoom: 15, essential: true });
        } else {
          map.setCenter?.([lng, lat]);
        }
        upsertMarker(lat, lng);

        map.on('click', (event: any) => {
          const clickedLat = Number(event.lngLat.lat);
          const clickedLng = Number(event.lngLat.lng);
          setCoords([clickedLat, clickedLng]);
          upsertMarker(clickedLat, clickedLng);
          fetchAddressFromMap(clickedLat, clickedLng);
        });
      } catch {
        showError('Unable to initialize map.');
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
  }, [isOpen, showMap, mapContainerId, upsertMarker]);

  useEffect(() => {
    if (!showMap || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [coords[1], coords[0]],
      zoom: 15,
      essential: true,
    });
    upsertMarker(coords[0], coords[1]);
  }, [coords, showMap, upsertMarker]);

  if (!isOpen) return null;

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  const applyPinLookup = async (pinRaw: string) => {
    const p = sanitizeIndianPincode(pinRaw);
    if (p.length !== 6) return;
    if (!isValidIndianPincode(p)) {
      showError('Invalid Indian PIN code (use 6 digits, not starting with 0).');
      return;
    }
    setPinLoading(true);
    const r = await lookupIndianPincode(p);
    setPinLoading(false);
    if (!r.ok) {
      showError('PIN code not found. Enter a valid Indian PIN.');
      return;
    }
    setForm(prev => ({ ...prev, pincode: r.pincode, city: r.city, state: r.state }));
  };

  const fetchAddressFromMap = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const details = await getAddressDetailsFromCoords(lat, lng);
      setForm(prev => ({
        ...prev,
        line1: details.line1 || prev.line1,
        pincode: details.pincode || prev.pincode,
        city: details.city || prev.city,
        state: details.state || prev.state,
      }));

      if (details.pincode && isValidIndianPincode(details.pincode)) {
        const lookup = await lookupIndianPincode(details.pincode);
        if (lookup.ok) {
          setForm(prev => ({
            ...prev,
            pincode: lookup.pincode,
            city: lookup.city,
            state: lookup.state,
          }));
        }
      }
    } catch {
      showError('Could not fetch address.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickSearchSuggestion = (place: PlaceSuggestion) => {
    setSearchQuery('');
    setSearchSuggestions([]);
    setSearchHadNoResults(false);
    setSearchFocused(false);
    const next: [number, number] = [place.lat, place.lng];
    coordsRef.current = next;
    setCoords(next);
    void fetchAddressFromMap(place.lat, place.lng);
  };

  const handleSearchEnter = () => {
    if (searchSuggestions.length > 0) {
      handlePickSearchSuggestion(searchSuggestions[0]);
    }
  };

  const handleLiveLocation = async (openMap = false) => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported on this device.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { lat, lng, accuracyMeters } = await requestPrecisePosition();
      const next: [number, number] = [lat, lng];
      coordsRef.current = next;
      setCoords(next);
      if (openMap) setShowMap(true);
      await fetchAddressFromMap(lat, lng);
      if (accuracyMeters > 3500) {
        showError('GPS accuracy is low — drag the pin on the map to your exact spot.');
      }
    } catch (err: unknown) {
      const geo = err as GeolocationPositionError | undefined;
      if (geo && geo.code === 1) {
        showError('Location permission denied. Enable location for this site in your browser.');
      } else {
        showError('Could not detect location. Try again outdoors or tap the map to choose.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const indiaPhoneRegex = /^[6-9]\d{9}$/;
    if (!form.label?.trim() || !form.line1?.trim() || !form.landmark?.trim() || !form.phone) {
      return showError('Label, address line 1, landmark, and phone are required.');
    }
    if (!indiaPhoneRegex.test(form.phone)) return showError('Phone must be 10 digits starting with 6-9');
    if (form.altPhone && !indiaPhoneRegex.test(form.altPhone)) return showError('Invalid Alt Phone');

    const p = sanitizeIndianPincode(form.pincode);
    if (!isValidIndianPincode(p)) return showError('Enter a valid 6-digit Indian PIN code.');
    setPinLoading(true);
    const lookup = await lookupIndianPincode(p);
    setPinLoading(false);
    if (!lookup.ok) return showError('PIN code not found. Enter a valid Indian PIN.');

    const merged = {
      ...form,
      pincode: lookup.pincode,
      city: lookup.city,
      state: lookup.state,
      full: formatAddressSummary({
        line1: form.line1,
        line2: form.line2,
        landmark: form.landmark,
        city: lookup.city,
        state: lookup.state,
        pincode: lookup.pincode,
      }),
    };

    setLoading(true);
    try {
      const payload = { ...merged, lat: coords[0], lng: coords[1], isMyAddress: true };
      const ed = editAddress as { id?: string } | null | undefined;
      const apiResult = ed?.id
        ? await updateAddress(ed.id, payload)
        : await addAddress(payload);
      const normalized: Record<string, unknown> = {
        ...merged,
        lat: coords[0],
        lng: coords[1],
        isMyAddress: true,
        ...(typeof apiResult === 'object' && apiResult ? apiResult : {}),
      };
      if (!normalized.id && ed?.id) normalized.id = ed.id;
      onAddressSaved?.(normalized);
      window.dispatchEvent(
        new CustomEvent(WEBSITE_DELIVERY_COORDS_CHANGED, {
          detail: { lat: coords[0], lng: coords[1] },
        }),
      );
      setForm(emptyForm(userPhone));
      setShowMap(false);
      onClose();
    } catch {
      showError('Failed to save address.');
    } finally {
      setLoading(false);
    }
  };

  const isEdit = Boolean((editAddress as { id?: string } | null)?.id);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white w-full max-w-xl rounded-[3rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-300 my-auto" onClick={e => e.stopPropagation()}>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-[#1e293b] tracking-tight uppercase italic">
            {showMap ? 'Pin Location' : isEdit ? 'Edit Address' : 'New Address'}
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 transition-colors"><X size={20}/></button>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
            <AlertCircle size={18} />
            <p className="text-xs font-black uppercase tracking-widest">{errorMsg}</p>
          </div>
        )}

        {showMap ? (
          <div className="space-y-4">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <input
                  type="search"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] font-bold text-sm"
                  placeholder="Search area (min 3 letters)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchEnter()}
                  aria-expanded={
                    !!(
                      searchFocused &&
                      searchQuery.trim().length >= 3 &&
                      (searchSuggestions.length > 0 ||
                        searchLoading ||
                        searchHadNoResults)
                    )
                  }
                  aria-controls={`${mapContainerId}-search-list`}
                  aria-autocomplete="list"
                />
                {searchFocused &&
                  searchQuery.trim().length >= 3 &&
                  (searchSuggestions.length > 0 ||
                    searchLoading ||
                    searchHadNoResults) && (
                    <ul
                      id={`${mapContainerId}-search-list`}
                      role="listbox"
                      className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl"
                    >
                      {searchLoading && searchSuggestions.length === 0 && (
                        <li
                          className="px-4 py-3 text-xs font-bold text-slate-400"
                          role="presentation"
                        >
                          Searching…
                        </li>
                      )}
                      {!searchLoading &&
                        searchHadNoResults &&
                        searchSuggestions.length === 0 && (
                          <li
                            className="px-4 py-3 text-xs font-bold text-slate-400"
                            role="presentation"
                          >
                            No suggestions — try another phrase or tap the map.
                          </li>
                        )}
                      {searchSuggestions.map(place => (
                        <li key={place.id} role="presentation">
                          <button
                            type="button"
                            role="option"
                            className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => handlePickSearchSuggestion(place)}
                          >
                            {place.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
              <button
                type="button"
                onClick={() => handleLiveLocation(false)}
                disabled={loading}
                className="bg-[#4b6f9e] text-white px-4 rounded-2xl hover:bg-[#1e293b] transition-colors disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Use Current'}
              </button>
            </div>

            <div className="h-72 w-full rounded-[2rem] overflow-hidden border-4 border-slate-50 relative z-10">
              <div id={mapContainerId} style={{ height: '100%', width: '100%' }} />
            </div>

            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-[10px] font-black text-[#4b6f9e] uppercase tracking-widest mb-1">Selected area (edit as Address line 1 after)</p>
              <p className="text-slate-700 font-bold text-xs line-clamp-2">{loading ? 'Fetching...' : form.line1}</p>
            </div>

            <button
              type="button"
              onClick={() => setShowMap(false)}
              className="w-full py-5 bg-[#4b6f9e] text-white rounded-[2rem] font-black text-lg shadow-xl flex items-center justify-center gap-2 hover:bg-[#1e293b] transition-all"
            >
              <Check size={20} /> Confirm Location
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
                onClick={() => handleLiveLocation(true)}
              className="w-full py-4 mb-2 rounded-2xl border-2 border-dashed border-[#4b6f9e] flex items-center justify-center gap-3 text-[#4b6f9e] font-bold bg-blue-50 hover:bg-blue-100 transition-all group"
            >
              {loading ? <Loader2 className="animate-spin" size={20}/> : <><MapPin size={18} className="group-hover:scale-110 transition-transform"/> Use Map to Locate</>}
            </button>

            <div className="grid grid-cols-2 gap-4">
              <input
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm"
                placeholder="Label (Home / Work) *"
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
              />
              <input
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm"
                placeholder="Landmark *"
                value={form.landmark}
                onChange={e => setForm({ ...form, landmark: e.target.value })}
              />
            </div>

            <input
              className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm"
              placeholder="Address line 1 *"
              value={form.line1}
              onChange={e => setForm({ ...form, line1: e.target.value })}
            />
            <input
              className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm"
              placeholder="Address line 2 (optional)"
              value={form.line2}
              onChange={e => setForm({ ...form, line2: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <input
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm"
                placeholder="City (from PIN)"
                readOnly
                value={form.city}
              />
              <input
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm"
                placeholder="State (from PIN)"
                readOnly
                value={form.state}
              />
            </div>

            <div className="relative">
              <input
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm pr-12"
                placeholder="PIN code *"
                inputMode="numeric"
                maxLength={6}
                value={form.pincode}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setForm({ ...form, pincode: v });
                }}
                onBlur={() => applyPinLookup(form.pincode)}
              />
              {pinLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 className="animate-spin text-[#4b6f9e]" size={20} />
                </div>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 -mt-2 px-1">
              City and state update automatically from a valid PIN (even if you typed them before).
            </p>

            <div className="grid grid-cols-2 gap-4">
              <input
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm"
                placeholder="Phone Number *"
                value={form.phone}
                maxLength={10}
                onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
              />
              <input
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm"
                placeholder="Alt Phone (Optional)"
                value={form.altPhone}
                maxLength={10}
                onChange={e => setForm({ ...form, altPhone: e.target.value.replace(/\D/g, '') })}
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading || pinLoading}
              className="w-full py-5 bg-[#1e293b] text-white rounded-[2rem] font-black text-lg shadow-xl hover:bg-[#4b6f9e] transition-all mt-4 disabled:bg-slate-200"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" /> : isEdit ? 'Update Address' : 'Save Address'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressModal;
