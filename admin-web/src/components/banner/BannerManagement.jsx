import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Upload, ImageIcon, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { apiService } from "../../services/apiService";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const BannerManagement = () => {
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [bannerList, setBannerList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }
  const [fieldError, setFieldError] = useState(''); // inline validation error

  const fileInputRef = useRef(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFieldError('');
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(selectedFile);
    }
  };

  const fetchBanners = async () => {
    try {
      const res = await apiService.getBanners();
      setBannerList(res.data?.data || res.data || []);
    } catch (error) {
      console.error('Failed to load banners:', error);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleUpload = async () => {
    // Validate both fields
    if (!title.trim() && !file) {
      setFieldError('Promotion title and image are required.');
      return;
    }
    if (!title.trim()) {
      setFieldError('Promotion title is required.');
      return;
    }
    if (!file) {
      setFieldError('Please select a banner image.');
      return;
    }

    setFieldError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("image", file);

      await apiService.createBanner(formData);

      setTitle("");
      setPreview(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      await fetchBanners();
      showToast('success', 'Banner uploaded successfully!');
    } catch (err) {
      console.error(err);
      const reason =
        err?.message || err?.error || err?.msg || 'Upload failed. Please try again.';
      showToast('error', reason);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deleteBanner(id);
      await fetchBanners();
      showToast('success', 'Banner deleted.');
    } catch (error) {
      console.error(error);
      showToast('error', 'Failed to delete banner.');
    }
  };

  return (
    <div className="p-6 space-y-6">

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl text-white font-bold text-sm transition-all
            ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'}`}
        >
          {toast.type === 'success'
            ? <CheckCircle size={20} />
            : <XCircle size={20} />}
          {toast.message}
        </div>
      )}

      <div className="bg-[#1A4D2E] p-8 rounded-[32px] text-white flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-3xl font-black italic">APP BANNERS</h1>
          <p className="opacity-70 font-medium">Live control for Mobile Home Screen</p>
        </div>
        <ImageIcon size={40} className="opacity-40" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Upload Section */}
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

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />

          <div>
            <input
              className={`w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold placeholder:text-slate-300 border-2 transition-colors
                ${fieldError ? 'border-red-300 bg-red-50' : 'border-transparent'}`}
              placeholder="Promotion Title..."
              value={title}
              onChange={(e) => { setTitle(e.target.value); setFieldError(''); }}
            />
            {fieldError && (
              <p className="text-red-500 text-sm font-semibold mt-2 flex items-center gap-1">
                <XCircle size={14} /> {fieldError}
              </p>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-[#1A4D2E] text-white p-5 rounded-2xl font-black shadow-xl shadow-green-900/20 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Uploading...
              </>
            ) : (
              'UPDATE MOBILE APP'
            )}
          </button>

        </div>

        {/* Banner List */}
        <div className="lg:col-span-7 space-y-4">

          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Active on App
            <span className="bg-emerald-500 w-2 h-2 rounded-full animate-ping" />
          </h2>

          {bannerList.length === 0 ? (
            <div className="bg-white rounded-[28px] border border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-center">
              <ImageIcon size={40} className="text-slate-200 mb-3" />
              <p className="font-bold text-slate-400">No banners yet</p>
              <p className="text-sm text-slate-300 mt-1">Upload a banner to see it here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {bannerList.map((b) => (
                <div
                  key={b._id}
                  className="bg-white p-4 rounded-[28px] border border-slate-100 flex gap-5 items-center group shadow-sm hover:shadow-md transition-all"
                >
                  <img
                    src={`${API_BASE_URL}${b.image}`}
                    className="w-32 h-20 rounded-2xl object-cover shadow-inner"
                    alt={b.title}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 text-lg uppercase leading-tight truncate">
                      {b.title}
                    </p>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest truncate">
                      ID: {b._id}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(b._id)}
                    className="mr-2 bg-red-50 text-red-500 p-4 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-sm flex-shrink-0"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default BannerManagement;