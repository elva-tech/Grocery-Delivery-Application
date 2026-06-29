import React, { useState, useRef } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { Trash2, Upload, ImageIcon, Smartphone, Monitor } from 'lucide-react';
import BannerCropEditor from './BannerCropEditor';

const BannerManagement = () => {
  const { banners, addBanner, deleteBanner } = useAppState();
  const [title, setTitle] = useState('');
  const [cropSrc, setCropSrc] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please select an image file');
    const reader = new FileReader();
    reader.onloadend = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropSave = async ({ image, imageWeb }) => {
    setSaving(true);
    try {
      addBanner({
        image,
        imageWeb,
        title: title.trim() || 'New Promotion',
      });
      setCropSrc(null);
      setTitle('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {cropSrc && (
        <BannerCropEditor
          imageSrc={cropSrc}
          saving={saving}
          onCancel={() => setCropSrc(null)}
          onSave={handleCropSave}
        />
      )}

      <div className="bg-[#1A4D2E] p-8 rounded-[32px] text-white flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-3xl font-black italic">APP BANNERS</h1>
          <p className="opacity-70 font-medium">Crop once · preview for website &amp; mobile app</p>
        </div>
        <ImageIcon size={40} className="opacity-40" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-white p-8 rounded-[32px] border shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-slate-800">New Promotion</h2>

          <div
            onClick={() => fileInputRef.current.click()}
            className="group w-full h-56 border-4 border-dashed border-slate-100 rounded-[28px] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
          >
            <div className="text-center">
              <div className="bg-slate-100 p-4 rounded-full inline-block mb-3 group-hover:bg-emerald-100 transition-colors">
                <Upload size={24} className="text-slate-400 group-hover:text-emerald-600" />
              </div>
              <p className="text-slate-500 font-bold text-sm">Upload Image</p>
              <p className="text-slate-400 text-xs mt-1 font-medium">Any size · crop before publish</p>
            </div>
          </div>

          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

          <input
            className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold placeholder:text-slate-300"
            placeholder="Promotion Title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Active Banners <span className="bg-emerald-500 w-2 h-2 rounded-full animate-ping" />
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {banners.map((b) => (
              <div
                key={b.id}
                className="bg-white p-4 rounded-[28px] border border-slate-100 flex gap-4 items-center group shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex gap-2 shrink-0">
                  <div className="relative">
                    <img
                      src={b.imageWeb || b.image}
                      className="w-24 h-8 rounded-lg object-cover shadow-inner"
                      alt={`${b.title} web`}
                    />
                    <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[8px] font-bold px-1 rounded">
                      <Monitor size={8} className="inline" />
                    </span>
                  </div>
                  <div className="relative">
                    <img src={b.image} className="w-20 h-10 rounded-lg object-cover shadow-inner" alt={`${b.title} app`} />
                    <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[8px] font-bold px-1 rounded">
                      <Smartphone size={8} className="inline" />
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-lg uppercase leading-tight truncate">{b.title}</p>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">ID: {b.id}</p>
                </div>
                <button
                  onClick={() => deleteBanner(b.id)}
                  className="mr-2 bg-red-50 text-red-500 p-4 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-sm"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BannerManagement;
