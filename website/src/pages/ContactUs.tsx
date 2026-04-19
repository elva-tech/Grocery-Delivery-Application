import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Phone, Mail, Store, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTenantDetails, type TenantDetails } from '../api/tenantApi';

const ContactUs = () => {
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTenantDetails()
      .then(setTenant)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 min-h-screen">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 mb-10 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-[#4b6f9e] transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-5xl font-black italic tracking-tighter uppercase text-slate-900 mb-2 leading-none">
        Get in Touch.
      </h1>
      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-12">
        We're here to help
      </p>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-slate-300" size={32} />
        </div>
      )}

      {error && !loading && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm font-medium">
          {error}
        </div>
      )}

      {tenant && !loading && (
        <div className="space-y-6">
          {/* Store Identity */}
          <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 flex items-center gap-5">
            {tenant.logo ? (
              <img
                src={tenant.logo}
                alt={tenant.storeName}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Store size={28} className="text-slate-400" />
              </div>
            )}
            <div>
              <p className="font-black text-xl text-slate-900 uppercase tracking-tight leading-none">
                {tenant.storeName}
              </p>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                {tenant.tenantId}.enandi.com
              </p>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            {tenant.phoneNumber && (
              <a
                href={`tel:+91${tenant.phoneNumber}`}
                className="flex items-center gap-4 bg-white border-2 border-slate-100 rounded-[2rem] p-5 hover:border-[#4b6f9e] transition-colors group"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#4b6f9e] flex items-center justify-center flex-shrink-0">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</p>
                  <p className="font-bold text-slate-800 text-sm group-hover:text-[#4b6f9e] transition-colors">
                    +91 {tenant.phoneNumber}
                  </p>
                </div>
              </a>
            )}

            {tenant.contactEmail && (
              <a
                href={`mailto:${tenant.contactEmail}`}
                className="flex items-center gap-4 bg-white border-2 border-slate-100 rounded-[2rem] p-5 hover:border-[#4b6f9e] transition-colors group"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#4b6f9e] flex items-center justify-center flex-shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                  <p className="font-bold text-slate-800 text-sm group-hover:text-[#4b6f9e] transition-colors">
                    {tenant.contactEmail}
                  </p>
                </div>
              </a>
            )}

            {tenant.storeAddress && (
              <div className="flex items-start gap-4 bg-white border-2 border-slate-100 rounded-[2rem] p-5">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#4b6f9e] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</p>
                  <p className="font-bold text-slate-800 text-sm leading-relaxed mt-0.5">
                    {tenant.storeAddress}
                  </p>
                </div>
              </div>
            )}

            {/* Fallback if no contact details have been filled in yet */}
            {!tenant.phoneNumber && !tenant.contactEmail && !tenant.storeAddress && (
              <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-400 font-bold text-xs uppercase tracking-widest">
                Contact details not set up yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactUs;
