import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';

import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

const PromoBanners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch banners from API
    const fetchBanners = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/banners/get-banners');
        const data = await response.json();
        if (data.success) {
          setBanners(data.data);
        } else {
          console.error('Failed to fetch banners:', data.message);
        }
      } catch (err) {
        console.error('Error fetching banners:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  if (loading) return <p>Loading banners...</p>;

  if (!banners.length) return <p>No banners available.</p>;

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
                src={`http://localhost:5000/${banner.image}`} 
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