import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import { PROMO_BANNERS } from '../../api/mockdata';

import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

const PromoBanners = () => (
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
      {PROMO_BANNERS.map((banner) => (
        <SwiperSlide key={banner.id}>
          <div className="relative h-full w-full group">
            <img 
              src={banner.image} 
              className="w-full h-full object-cover transition-transform duration-[5000ms] group-hover:scale-110" 
              alt={banner.title} 
            />
            {/* High-Contrast Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent p-10 md:p-16 flex flex-col justify-center">
              <h2 className="text-white text-3xl md:text-5xl font-black max-w-md leading-[1.1] drop-shadow-2xl">
                {banner.title}
              </h2>
              {/* <button className="mt-6 w-fit bg-white text-[#1e293b] px-8 py-3 rounded-2xl font-black text-sm shadow-xl hover:bg-[#4b6f9e] hover:text-white transition-all transform active:scale-95">
                Shop Now
              </button> */}
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

export default PromoBanners;