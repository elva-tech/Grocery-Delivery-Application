import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import { getBanners } from '../../api/bannerApi';
import { getTenantId } from '../../utils/getTenantId';
import { resolveImageUrl } from '../../utils/resolveImageUrl';

import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

const PromoBanners = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // derive tenantId from hostname
  const tenantId = getTenantId();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getBanners(tenantId);
        setBanners(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tenantId]);

  if (error) {
    return (
      <p className="text-center text-red-500 py-10">
        Failed to load banners
      </p>
    );
  }

  if (loading || banners.length === 0) {
    return (
      <div className="mb-10 w-full h-[240px] md:h-[400px] rounded-[2.5rem] bg-slate-100 animate-pulse flex items-center justify-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Loading banners...
        </p>
      </div>
    );
  }

  return (
    <div className="mb-10 w-full overflow-hidden rounded-[2.5rem] shadow-2xl shadow-blue-900/10">
      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        spaceBetween={0}
        slidesPerView={1}
        loop={true}
        grabCursor={true}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        pagination={{ clickable: true, dynamicBullets: true }}
        className="h-[240px] md:h-[400px]"
      >
        {banners.map((banner) => {
          const imageSrc =
            (typeof banner.imageWebUrl === 'string' && banner.imageWebUrl.trim()) ||
            resolveImageUrl(banner);
          return (
          <SwiperSlide key={banner._id}>
            <div className="relative h-full w-full overflow-hidden">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  className="w-full h-full object-cover banner-slide-image"
                  alt={banner.title}
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-500 font-semibold">
                  No Image
                </div>
              )}

              {banner.title ? (
                <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/45 to-transparent px-6 pb-10 pt-16 md:px-10 md:pb-12 md:pt-20 banner-slide-overlay">
                  <h2 className="text-white text-lg md:text-2xl font-black max-w-2xl leading-snug drop-shadow-md banner-slide-title">
                    {banner.title}
                  </h2>
                </div>
              ) : null}
            </div>
          </SwiperSlide>
        );
        })}
      </Swiper>
      <style>{`
      .swiper-pagination-bullet { background: white !important; opacity: 0.5; transition: opacity 0.3s ease, width 0.3s ease; }
      .swiper-pagination-bullet-active { background: white !important; opacity: 1; width: 25px !important; border-radius: 4px !important; }
      .swiper-slide-active .banner-slide-image { animation: bannerFadeIn 0.8s ease-out; }
      .swiper-slide-active .banner-slide-overlay { animation: bannerOverlayIn 0.9s ease-out; }
      .swiper-slide-active .banner-slide-title { animation: bannerTitleIn 0.7s ease-out 0.15s both; }
      @keyframes bannerFadeIn {
        from { opacity: 0.85; transform: scale(1.02); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes bannerOverlayIn {
        from { opacity: 0.6; }
        to { opacity: 1; }
      }
      @keyframes bannerTitleIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
    </div>
  );
};
export default PromoBanners;