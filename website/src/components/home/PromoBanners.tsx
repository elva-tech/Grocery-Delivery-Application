import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import { getBanners } from '../../api/bannerApi';
import { API_BASE_URL, TENANT_ID } from '../../config';

import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

const BASE_URL = API_BASE_URL;

const PromoBanners = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getTenantId = () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.tenantId) return payload.tenantId;
      } catch {
        // ignore decode errors
      }
    }
    return TENANT_ID;
  };

  // ✅ derive tenantId once
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
    return null;
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
        {banners.map((banner) => (
          <SwiperSlide key={banner._id}>
            <div className="relative h-full w-full group">
              <img 
                src={`${BASE_URL}${banner.image.replace(/\\/g, "/")}`}
                className="w-full h-full object-cover transition-transform duration-[5000ms] group-hover:scale-110" 
                alt={banner.title} 
              />

              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent p-10 md:p-16 flex flex-col justify-center">
                <h2 className="text-white text-3xl md:text-5xl font-black max-w-md leading-[1.1] drop-shadow-2xl">
                  {banner.title}
                </h2>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      <style>{`
      .swiper-pagination-bullet { background: white !important; opacity: 0.5; }
      .swiper-pagination-bullet-active { background: white !important; opacity: 1; width: 25px !important; border-radius: 4px !important; }
    `}</style>
    </div>
  );
};
export default PromoBanners;