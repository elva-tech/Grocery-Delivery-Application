import React, { useState, useRef } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { Trash2, Plus, Upload, ImageIcon } from 'lucide-react';

const BannerManagement = () => {
  const { banners, addBanner, deleteBanner } = useAppState(); 
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (!preview) return alert("Select an image");
    addBanner({ 
      image: preview, 
      title: title || 'New Promotion' 
    });
    setPreview(null); setTitle('');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-[#1A4D2E] p-8 rounded-[32px] text-white flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-3xl font-black italic">APP BANNERS</h1>
          <p className="opacity-70 font-medium">Live control for Mobile Home Screen</p>
        </div>
        <ImageIcon size={40} className="opacity-40" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Upload Section */}
        <div className="lg:col-span-5 bg-white p-8 rounded-[32px] border shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-slate-800">New Promotion</h2>
          
          <div 
            onClick={() => fileInputRef.current.click()}
            className="group w-full h-56 border-4 border-dashed border-slate-100 rounded-[28px] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-200 hover:bg-emerald-50/30 transition-all overflow-hidden"
          >
            {preview ? (
              <img src={preview} className="w-full h-full object-cover" alt="Preview" />
            ) : (
              <div className="text-center">
                <div className="bg-slate-100 p-4 rounded-full inline-block mb-3 group-hover:bg-emerald-100 transition-colors">
                  <Upload size={24} className="text-slate-400 group-hover:text-emerald-600" />
                </div>
                <p className="text-slate-500 font-bold text-sm">Upload Image</p>
              </div>
            )}
          </div>

          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

          <input 
            className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold placeholder:text-slate-300" 
            placeholder="Promotion Title..." 
            value={title} 
            onChange={e => setTitle(e.target.value)}
          />

          <button 
            onClick={handleUpload} 
            className="w-full bg-[#1A4D2E] text-white p-5 rounded-2xl font-black shadow-xl shadow-green-900/20 active:scale-95 transition-all"
          >
            UPDATE MOBILE APP
          </button>
        </div>

        {/* Right: Preview List */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Active on App <span className="bg-emerald-500 w-2 h-2 rounded-full animate-ping" />
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {banners.map(b => (
              <div key={b.id} className="bg-white p-4 rounded-[28px] border border-slate-100 flex gap-5 items-center group shadow-sm hover:shadow-md transition-all">
                <img src={b.image} className="w-32 h-20 rounded-2xl object-cover shadow-inner" alt={b.title} />
                <div className="flex-1">
                  <p className="font-black text-slate-800 text-lg uppercase leading-tight">{b.title}</p>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">ID: {b.id}</p>
                </div>
                <button 
                  onClick={() => deleteBanner(b.id)} 
                  className="mr-2 bg-red-50 text-red-500 p-4 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-sm"
                >
                  <Trash2 size={20}/>
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