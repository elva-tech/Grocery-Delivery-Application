import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { reportOrderIssueApi } from '../api/ordersApi';
import { useGetAppSettingsQuery } from '../api/apiSlice';
import { API_BASE_URL, getTenantId } from '../config';

const REPORT_REASONS = ["Item damaged", "Wrong item received", "Quality issue", "Items missing", "Package tampered"];

const ReportIssueModal = ({ isOpen, onClose, order, onSuccess }: any) => {
  const { data: settings } = useGetAppSettingsQuery();
  
  const [selectedReason, setSelectedReason] = useState('');
  const [comment, setComment] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedReason('');
      setComment('');
      setPreview(null);
      setEvidenceUrl('');
      setError(null);
    }
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [isOpen]);

  // Safety: If feature is disabled via backend, do not render modal
  if (!isOpen || !(settings?.allowReportIssue || settings?.allowRefunds)) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        return setError("Image size must be less than 5MB");
      }
      setError(null);
      setEvidenceUrl('');
      const url = URL.createObjectURL(file);
      setPreview(url);

      try {
        setUploadingImage(true);
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('token');
        const uploadRes = await axios.post(
          `${API_BASE_URL}/api/upload/returns?category=returns`,
          formData,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              'x-tenant-id': getTenantId(),
            },
          }
        );

        if (!uploadRes?.data?.url) {
          throw new Error('Upload failed');
        }

        setEvidenceUrl(uploadRes.data.url);
      } catch (err: unknown) {
        setEvidenceUrl('');
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Failed to upload image. Please try again.';
        setError(msg);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason) return setError("Please select a reason");
    if (!evidenceUrl) return setError("Evidence photo is required");
    
    setLoading(true);
    setError(null);

    try {
      await reportOrderIssueApi({
        orderId: order.id,
        reason: selectedReason,
        comment: comment.trim() || "No comment",
        evidenceUrl,
      });
      onSuccess(); 
      setStep(2);
    } catch (err) {
      setError("Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        {step === 1 ? (
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Return Request</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Order #{order?.id}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>

            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-500 p-4 rounded-2xl flex items-center gap-3 text-xs font-black uppercase animate-in slide-in-from-top-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">What went wrong?</label>
                <div className="flex flex-wrap gap-2">
                  {REPORT_REASONS.map(r => (
                    <button 
                      key={r} 
                      type="button"
                      onClick={() => { setSelectedReason(r); setError(null); }} 
                      className={`px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${selectedReason === r ? 'border-[#4b6f9e] bg-blue-50 text-[#4b6f9e]' : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Additional Details (Optional)</label>
                <textarea 
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-[#4b6f9e] outline-none text-sm font-bold h-24 resize-none transition-all placeholder:text-slate-300" 
                  placeholder="Tell us more about the issue..." 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)} 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Product photo (required)</label>
                <div 
                  onClick={() => fileRef.current?.click()} 
                  className={`w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${preview ? 'border-[#4b6f9e]' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  {preview ? (
                    <div className="relative w-full h-full group">
                      <img src={preview} className="w-full h-full object-cover" alt="Preview" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="text-white" size={24} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Camera className="text-slate-300 mb-1" size={24} />
                      <span className="text-[10px] font-black text-slate-400 uppercase">Click to upload photo</span>
                    </>
                  )}
                </div>
                <input type="file" ref={fileRef} className="hidden" onChange={handleFileChange} accept="image/*" />
              </div>

              <button 
                disabled={loading || uploadingImage} 
                onClick={handleSubmit} 
                className="w-full bg-[#1e293b] text-white h-16 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#4b6f9e] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200 disabled:opacity-50"
              >
                {loading || uploadingImage ? <Loader2 className="animate-spin" /> : "Submit Report"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner shadow-emerald-200/50">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Report Sent.</h3>
              <p className="text-slate-500 font-bold text-sm mt-2 mb-10 leading-relaxed">Our support team will investigate and <br/> reach out within 24 hours.</p>
              <button 
                onClick={onClose} 
                className="w-full border-2 border-slate-100 h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 hover:border-slate-200 transition-all"
              >
                Return to History
              </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportIssueModal;