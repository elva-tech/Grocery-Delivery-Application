import { ArrowLeft, MapPin, Phone, Mail, Store, Loader2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenantBranding } from '../context/TenantBrandingContext';

const ContactUs = () => {
  const navigate = useNavigate();
  const { loading, error, raw, storeName } = useTenantBranding();
  const tenant = raw;

  const domainLine =
    tenant?.customerDomain?.trim() ||
    (tenant?.tenantId ? `${tenant.tenantId}.localhost` : '');

  const supportHours = tenant?.supportHours?.trim();
  const supportEmail = tenant?.supportEmail?.trim();
  const supportPhone = tenant?.supportPhone?.trim()?.replace(/\D/g, '').slice(-10);
  const generalPhone = tenant?.phoneNumber?.trim()?.replace(/\D/g, '').slice(-10);
  const displayPhone = supportPhone || generalPhone;
  const phoneIsSupport = Boolean(supportPhone);
  const supportMail = supportEmail || tenant?.contactEmail?.trim();
  const emailIsSupport = Boolean(supportEmail);

  const hasAnyContact =
    Boolean(displayPhone) ||
    Boolean(supportMail) ||
    Boolean(tenant?.storeAddress?.trim()) ||
    Boolean(supportHours);

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
          <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 flex items-center gap-5">
            {tenant.logo ? (
              <img
                src={tenant.logo}
                alt={storeName}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Store size={28} className="text-slate-400" />
              </div>
            )}
            <div>
              <p className="font-black text-xl text-slate-900 uppercase tracking-tight leading-none">
                {tenant.storeName || storeName}
              </p>
              {domainLine && (
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                  {domainLine}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {supportHours && (
              <div className="flex items-start gap-4 bg-white border-2 border-slate-100 rounded-[2rem] p-5">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#4b6f9e] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Support hours</p>
                  <p className="font-bold text-slate-800 text-sm leading-relaxed mt-0.5 whitespace-pre-line">
                    {supportHours}
                  </p>
                </div>
              </div>
            )}

            {displayPhone && (
              <a
                href={`tel:+91${displayPhone}`}
                className="flex items-center gap-4 bg-white border-2 border-slate-100 rounded-[2rem] p-5 hover:border-[#4b6f9e] transition-colors group"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#4b6f9e] flex items-center justify-center flex-shrink-0">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {phoneIsSupport ? 'Support phone' : 'Phone'}
                  </p>
                  <p className="font-bold text-slate-800 text-sm group-hover:text-[#4b6f9e] transition-colors">
                    +91 {displayPhone}
                  </p>
                </div>
              </a>
            )}

            {supportMail && (
              <a
                href={`mailto:${supportMail}`}
                className="flex items-center gap-4 bg-white border-2 border-slate-100 rounded-[2rem] p-5 hover:border-[#4b6f9e] transition-colors group"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#4b6f9e] flex items-center justify-center flex-shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {emailIsSupport ? 'Support email' : 'Email'}
                  </p>
                  <p className="font-bold text-slate-800 text-sm group-hover:text-[#4b6f9e] transition-colors">
                    {supportMail}
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

            {!hasAnyContact && (
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
