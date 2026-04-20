import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Twitter, Facebook, Instagram, Linkedin } from 'lucide-react';
import { useGetCategoriesQuery } from '../../api/apiSlice';
import { useTenantBranding } from '../../context/TenantBrandingContext';

function splitBrandWords(storeName: string) {
  const words = storeName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { head: 'STORE', tail: '' };
  if (words.length === 1) {
    const w = words[0].toUpperCase();
    const mid = Math.max(1, Math.floor(w.length / 2));
    return { head: w.slice(0, mid), tail: w.slice(mid) };
  }
  return {
    head: words.slice(0, -1).join(' ').toUpperCase(),
    tail: words[words.length - 1].toUpperCase(),
  };
}

interface FooterProps {
  onCategoryClick?: (id: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onCategoryClick }) => {
  const { storeName, tagline } = useTenantBranding();
  const brand = useMemo(() => splitBrandWords(storeName), [storeName]);
  const { data: categories = [] } = useGetCategoriesQuery();
  const navigate = useNavigate();

  const usefulLinks = [
    { name: "About Us", path: "/about" },
    { name: "Contact Us", path: "/contact" },
    { name: "FAQs", path: "/faqs" },
    { name: "Privacy Policy", path: "/privacy" },
    { name: "Terms and Conditions", path: "/terms" },
    { name: "Refund Policy", path: "/refund" }
  ];

  const handleCategorySelect = (id: string) => {
    if (onCategoryClick) {
      onCategoryClick(id);
    }
    navigate('/browse');
  };

  return (
    <footer className="bg-white border-t border-slate-100 pt-16 pb-12 mt-auto">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* MAIN SPLIT SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
          
          {/* LEFT: CATEGORIES */}
          <div className="lg:col-span-8">
            <h3 className="text-sm font-black text-slate-900 mb-8 uppercase tracking-[0.2em] italic">Categories</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-y-4 gap-x-4">
              {categories.map((cat: any) => (
                <button 
                  key={cat.id} 
                  onClick={() => handleCategorySelect(cat.id)}
                  className="text-left text-slate-500 hover:text-[#4b6f9e] text-[13px] font-bold transition-colors uppercase tracking-tight"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: USEFUL LINKS */}
          <div className="lg:col-span-4 lg:border-l lg:pl-12 border-slate-50">
            <h3 className="text-sm font-black text-slate-900 mb-8 uppercase tracking-[0.2em] italic">Useful Links</h3>
            <div className="grid grid-cols-1 gap-y-4">
              {usefulLinks.map((link, i) => (
                <button 
                  key={i} 
                  onClick={() => navigate(link.path)} 
                  className="text-left text-slate-500 hover:text-black text-[13px] font-bold transition-colors uppercase tracking-tight"
                >
                  {link.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="pt-12 border-t border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            
            {/* BRAND & COPYRIGHT */}
            <div className="space-y-1 text-center md:text-left">
              <h2 className="text-2xl font-black tracking-tighter italic uppercase text-slate-900">
                {brand.head}
                {brand.tail ? (
                  <>
                    {' '}
                    <span className="text-[#4b6f9e]">{brand.tail}</span>
                  </>
                ) : null}
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                © {new Date().getFullYear()} {tagline}
              </p>
            </div>

            {/* DOWNLOAD BUTTONS */}
            <div className="flex items-center gap-4">
              <a href="https://play.google.com/store" target="_blank" rel="noreferrer" className="transition-transform hover:scale-105">
                <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Play Store" className="h-10" />
              </a>
              <a href="https://apps.apple.com" target="_blank" rel="noreferrer" className="transition-transform hover:scale-105">
                <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" className="h-10" />
              </a>
            </div>

            {/* SOCIALS */}
            <div className="flex gap-3">
              {[Twitter, Facebook, Instagram, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-[#4b6f9e] hover:text-white transition-all shadow-sm">
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* DISCLAIMER */}
        <p className="mt-12 text-[10px] text-slate-300 leading-relaxed text-center italic font-medium max-w-3xl mx-auto">
          Product images and trademarks belong to their respective owners. {storeName} is operated as an independent storefront.
        </p>
      </div>
    </footer>
  );
};

export default Footer;