import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { geocodeApproxFromIndianPincode } from '../utils/indiaPincode';

const DEFAULT_CENTER = [20.5937, 78.9629]; // India
const DEFAULT_ZOOM = 5;

function fixLeafletIcons() {
  const Icon = L.Icon.Default;
  Icon.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
  });
}

/**
 * Pick delivery hub lat/lng (OpenStreetMap + Leaflet). Does not call paid map `/process`.
 */
export default function StoreHubMapPicker({
  lat,
  lng,
  pincode,
  onChange,
  disabled,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinErr, setPinErr] = useState('');

  const hasCoords =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat !== 0 || lng !== 0);

  useEffect(() => {
    fixLeafletIcons();
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView(hasCoords ? [lat, lng] : DEFAULT_CENTER, hasCoords ? 15 : DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const m = L.marker(hasCoords ? [lat, lng] : DEFAULT_CENTER, { draggable: !disabled }).addTo(map);
    markerRef.current = m;
    mapInstanceRef.current = map;

    const onDrag = () => {
      const p = m.getLatLng();
      onChange?.({ lat: p.lat, lng: p.lng });
    };
    m.on('dragend', onDrag);

    map.on('click', (e) => {
      if (disabled) return;
      const { lat: la, lng: ln } = e.latlng;
      m.setLatLng([la, ln]);
      onChange?.({ lat: la, lng: ln });
    });

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      m.off('dragend', onDrag);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const m = markerRef.current;
    if (!map || !m || !hasCoords) return;
    const ll = L.latLng(lat, lng);
    if (!m.getLatLng().equals(ll)) {
      m.setLatLng(ll);
      map.setView(ll, Math.max(map.getZoom(), 14));
    }
  }, [lat, lng, hasCoords]);

  const handleSnapPin = async () => {
    setPinErr('');
    const p = String(pincode || '').replace(/\D/g, '').slice(0, 6);
    if (!/^[1-9]\d{5}$/.test(p)) {
      setPinErr('Enter a valid 6-digit PIN first.');
      return;
    }
    setPinBusy(true);
    try {
      const coords = await geocodeApproxFromIndianPincode(p);
      if (!coords) {
        setPinErr('Could not centre map from this PIN — drag the pin manually.');
        return;
      }
      const map = mapInstanceRef.current;
      const m = markerRef.current;
      if (m && map) {
        m.setLatLng([coords.lat, coords.lng]);
        map.setView([coords.lat, coords.lng], 14);
      }
      onChange?.({ lat: coords.lat, lng: coords.lng });
    } finally {
      setPinBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSnapPin}
          disabled={disabled || pinBusy}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          {pinBusy ? 'Looking up PIN…' : 'Centre map from PIN (approx.)'}
        </button>
        <span className="text-[11px] text-gray-500">
          Or click the map / drag the pin — no routing API call.
        </span>
      </div>
      {pinErr && <p className="text-xs text-amber-700 font-medium">{pinErr}</p>}
      <div
        ref={mapRef}
        className="w-full h-56 rounded-xl border border-gray-200 overflow-hidden z-0 bg-slate-100"
        aria-label="Store hub map"
      />
      <div className="flex flex-wrap gap-4 text-xs font-mono text-gray-600">
        <span>
          Lat:{' '}
          <strong className="text-gray-900">{hasCoords ? lat.toFixed(6) : '—'}</strong>
        </span>
        <span>
          Lng:{' '}
          <strong className="text-gray-900">{hasCoords ? lng.toFixed(6) : '—'}</strong>
        </span>
      </div>
    </div>
  );
}
