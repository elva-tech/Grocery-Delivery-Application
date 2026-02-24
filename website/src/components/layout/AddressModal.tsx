import React, { useState, useEffect } from 'react';
import { X, Navigation, MapPin, Loader2, AlertCircle, Search, Check } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getAddressFromCoords, addAddress } from '../../api/addresses';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

const AddressModal: React.FC<AddressModalProps> = ({ isOpen, onClose }) => {
  const [form, setForm] = useState({ label: '', full: '', phone: '', altPhone: '', landmark: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [showMap, setShowMap] = useState(false);
  const [coords, setCoords] = useState<[number, number]>([12.9716, 77.5946]);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3000);
  };

  const handleSearchLocation = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const newCoords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        setCoords(newCoords);
        setForm(prev => ({ ...prev, full: data[0].display_name }));
      } else {
        showError("Location not found.");
      }
    } catch (err) {
      showError("Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        setCoords([e.latlng.lat, e.latlng.lng]);
        fetchAddressFromMap(e.latlng.lat, e.latlng.lng);
      },
    });
    return <Marker position={coords} />;
  };

  const fetchAddressFromMap = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const formatted = await getAddressFromCoords(lat, lng);
      setForm(prev => ({ ...prev, full: formatted }));
    } catch (err) {
      showError("Could not fetch address.");
    } finally {
      setLoading(false);
    }
  };

  const handleLiveLocation = async () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const newCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setCoords(newCoords);
      setShowMap(true);
      fetchAddressFromMap(newCoords[0], newCoords[1]);
    }, () => {
      setLoading(false);
      showError("Location permission denied.");
    });
  };

  const handleSave = async () => {
    const indiaPhoneRegex = /^[6-9]\d{9}$/;
    if (!form.label || !form.full || !form.phone) return showError("Required fields missing!");
    if (!indiaPhoneRegex.test(form.phone)) return showError("Phone must be 10 digits starting with 6-9");
    if (form.altPhone && !indiaPhoneRegex.test(form.altPhone)) return showError("Invalid Alt Phone");
    
    setLoading(true);
    try {
      await addAddress(form);
      setForm({ label: '', full: '', phone: '', altPhone: '', landmark: '' });
      setShowMap(false);
      onClose();
    } catch (e) {
      showError("Failed to save address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white w-full max-w-xl rounded-[3rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-300 my-auto" onClick={e => e.stopPropagation()}>
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-[#1e293b] tracking-tight uppercase italic">
            {showMap ? 'Pin Location' : 'New Address'}
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
              <input 
                className="flex-1 p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] font-bold text-sm"
                placeholder="Search building or area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()}
              />
              <button onClick={handleSearchLocation} className="bg-[#4b6f9e] text-white p-4 rounded-2xl hover:bg-[#1e293b] transition-colors">
                <Search size={20} />
              </button>
            </div>

            <div className="h-72 w-full rounded-[2rem] overflow-hidden border-4 border-slate-50 relative z-10">
              <MapContainer center={coords} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ChangeView center={coords} />
                <MapEvents />
              </MapContainer>
            </div>

            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-[10px] font-black text-[#4b6f9e] uppercase tracking-widest mb-1">Selected Location</p>
              <p className="text-slate-700 font-bold text-xs line-clamp-2">{loading ? 'Fetching...' : form.full}</p>
            </div>

            <button 
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
              onClick={handleLiveLocation}
              className="w-full py-4 mb-2 rounded-2xl border-2 border-dashed border-[#4b6f9e] flex items-center justify-center gap-3 text-[#4b6f9e] font-bold bg-blue-50 hover:bg-blue-100 transition-all group"
            >
              {loading ? <Loader2 className="animate-spin" size={20}/> : <><MapPin size={18} className="group-hover:scale-110 transition-transform"/> Use Map to Locate</>}
            </button>

            <div className="grid grid-cols-2 gap-4">
               <input 
                 className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm" 
                 placeholder="Label (Home / Work) *" 
                 value={form.label} 
                 onChange={e => setForm({...form, label: e.target.value})} 
               />
               <input 
                 className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm" 
                 placeholder="Landmark (Optional)" 
                 value={form.landmark} 
                 onChange={e => setForm({...form, landmark: e.target.value})} 
               />
            </div>

            <textarea 
              className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm min-h-[100px]" 
              placeholder="Complete Address *" 
              value={form.full} 
              onChange={e => setForm({...form, full: e.target.value})} 
            />

            <div className="grid grid-cols-2 gap-4">
              <input 
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm" 
                placeholder="Phone Number *" 
                value={form.phone} 
                maxLength={10}
                onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g, '')})} 
              />
              <input 
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:border-[#4b6f9e] focus:bg-white transition-all font-bold text-sm" 
                placeholder="Alt Phone (Optional)" 
                value={form.altPhone} 
                maxLength={10}
                onChange={e => setForm({...form, altPhone: e.target.value.replace(/\D/g, '')})} 
              />
            </div>
            
            <button 
              onClick={handleSave} 
              disabled={loading}
              className="w-full py-5 bg-[#1e293b] text-white rounded-[2rem] font-black text-lg shadow-xl hover:bg-[#4b6f9e] transition-all mt-4 disabled:bg-slate-200"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" /> : "Save Address"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressModal;