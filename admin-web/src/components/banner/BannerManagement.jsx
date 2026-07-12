import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Upload, ImageIcon, CheckCircle, XCircle, Loader2, Smartphone, Monitor } from 'lucide-react';
import { apiService } from '../../services/apiService';
import resolveImageUrl from '../../utils/resolveImageUrl';
import { dataUrlToFile } from '../../utils/bannerCrop';
import BannerCropEditor from './BannerCropEditor';

const resolveWebImageUrl = (banner) => {
  if (!banner || typeof banner !== 'object') return null;
  const web = typeof banner.imageWebUrl === 'string' ? banner.imageWebUrl.trim() : '';
  return web || resolveImageUrl(banner);
};

const BannerManagement = () => {
  const [title, setTitle] = useState('');
  const [cropSrc, setCropSrc] = useState(null);
  const [bannerList, setBannerList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');
  const [toast, setToast] = useState(null);
  const [fieldError, setFieldError] = useState('');

  const fileInputRef = useRef(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/')) {
      showToast('error', 'Please select an image file.');
      return;
    }
    setFieldError('');
    const reader = new FileReader();
    reader.onloadend = () => setCropSrc(reader.result);
    reader.readAsDataURL(selectedFile);
    e.target.value = '';
  };

  const fetchBanners = async () => {
    try {
      setLoadingList(true);
      setListError('');
      const res = await apiService.getBanners();
      setBannerList(res.data?.data || res.data || []);
    } catch (error) {
      console.error('Failed to load banners:', error);
      setListError('Failed to load banners');
      setBannerList([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleCropSave = async ({ image, imageWeb }) => {
    if (!title.trim()) {
      setFieldError('Promotion title is required.');
      return;
    }

    setFieldError('');
    setUploading(true);

    try {
      const appFile = dataUrlToFile(image, `banner-app-${Date.now()}.jpg`);
      const webFile = dataUrlToFile(imageWeb, `banner-web-${Date.now()}.jpg`);

      const [appUpload, webUpload] = await Promise.all([
        apiService.uploadFile(appFile, 'banners'),
        apiService.uploadFile(webFile, 'banners'),
      ]);

      const imageUrl = appUpload?.url || appUpload?.data?.url;
      const imageWebUrl = webUpload?.url || webUpload?.data?.url;

      if (!imageUrl || !imageWebUrl) {
        throw new Error('Image upload failed. Please try again.');
      }

      await apiService.createBanner({
        title: title.trim(),
        imageUrl,
        imagePublicId:
          typeof appUpload?.public_id === 'string' ? appUpload.public_id.trim() : '',
        imageWebUrl,
        imageWebPublicId:
          typeof webUpload?.public_id === 'string' ? webUpload.public_id.trim() : '',
      });

      setTitle('');
      setCropSrc(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

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
      {cropSrc && (
        <BannerCropEditor
          imageSrc={cropSrc}
          saving={uploading}
          onCancel={() => setCropSrc(null)}
          onSave={handleCropSave}
        />
      )}

      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl text-white font-bold text-sm transition-all
            ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'}`}
        >
          {toast.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          {toast.message}
        </div>
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
              onChange={(e) => {
                setTitle(e.target.value);
                setFieldError('');
              }}
            />
            {fieldError && (
              <p className="text-red-500 text-sm font-semibold mt-2 flex items-center gap-1">
                <XCircle size={14} /> {fieldError}
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Active Banners
            <span className="bg-emerald-500 w-2 h-2 rounded-full animate-ping" />
          </h2>

          {loadingList ? (
            <div className="bg-white rounded-[28px] border border-slate-100 p-12 flex flex-col items-center justify-center text-center">
              <Loader2 size={34} className="text-emerald-500 animate-spin mb-3" />
              <p className="font-bold text-slate-500">Loading banners...</p>
            </div>
          ) : listError ? (
            <div className="bg-red-50 rounded-[28px] border border-red-100 p-8 flex flex-col items-center justify-center text-center">
              <XCircle size={34} className="text-red-400 mb-3" />
              <p className="font-bold text-red-600">{listError}</p>
              <button
                onClick={fetchBanners}
                className="mt-4 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest"
              >
                Retry
              </button>
            </div>
          ) : bannerList.length === 0 ? (
            <div className="bg-white rounded-[28px] border border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-center">
              <ImageIcon size={40} className="text-slate-200 mb-3" />
              <p className="font-bold text-slate-400">No banners yet</p>
              <p className="text-sm text-slate-300 mt-1">Upload a banner to see it here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {bannerList.map((banner) => {
                const appSrc = resolveImageUrl(banner);
                const webSrc = resolveWebImageUrl(banner);
                return (
                  <div
                    key={banner._id}
                    className="bg-white p-4 rounded-[28px] border border-slate-100 flex gap-4 items-center group shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex gap-2 shrink-0">
                      <div className="relative">
                        {webSrc ? (
                          <img
                            src={webSrc}
                            className="w-24 h-8 rounded-lg object-cover shadow-inner"
                            alt={`${banner.title} web`}
                          />
                        ) : (
                          <div className="w-24 h-8 rounded-lg bg-slate-100 text-[10px] text-slate-400 flex items-center justify-center">
                            No Web
                          </div>
                        )}
                        <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white p-0.5 rounded">
                          <Monitor size={8} />
                        </span>
                      </div>
                      <div className="relative">
                        {appSrc ? (
                          <img
                            src={appSrc}
                            className="w-20 h-10 rounded-lg object-cover shadow-inner"
                            alt={`${banner.title} app`}
                          />
                        ) : (
                          <div className="w-20 h-10 rounded-lg bg-slate-100 text-[10px] text-slate-400 flex items-center justify-center">
                            No App
                          </div>
                        )}
                        <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white p-0.5 rounded">
                          <Smartphone size={8} />
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-lg uppercase leading-tight truncate">
                        {banner.title}
                      </p>
                      <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest truncate">
                        ID: {banner._id}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(banner._id)}
                      className="mr-2 bg-red-50 text-red-500 p-4 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-sm flex-shrink-0"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BannerManagement;
