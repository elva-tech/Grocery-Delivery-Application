import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import Header from './components/layout/Header';
import PromoBanners from './components/home/PromoBanners';
import CategoryStrip from './components/home/CategoryStrip';
import CategorySidebar from './components/category/CategorySidebar';
import LeafBanner from './components/home/LeafBanner';
import CartDrawer from './components/ui/cartDrawer';
import ProductGrid from './components/products/ProductGrid';
import { FreeDeliveryToast } from './components/ui/FreeDeliveryToast';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import Addresses from './pages/Addresses';
import LoginModal from './components/ui/LoginModal';
import { getCartCalculation } from './api/ordersApi';
import { useGetProductsQuery } from './api/apiSlice';
import type { RootState } from './store/store';
import { ChevronRight, Search, X } from 'lucide-react';
import Pagination from './components/ui/Pagination';
import confetti from 'canvas-confetti';
import Footer from './components/layout/Footer';
import Orders from './pages/Orders';
import LegalPage from './pages/LegalPage';

import { useGetStoreStatusQuery } from './api/apiSlice';

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  // UPDATED STATES FOR NESTED CATEGORIES
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showFreeToast, setShowFreeToast] = useState(false);
  const [wasFree, setWasFree] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const { data: products = [] } = useGetProductsQuery();
  const { items } = useSelector((state: RootState) => state.cart);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const timerRef = useRef<any>(null);


  const { data: storeStatus } = useGetStoreStatusQuery(undefined, {
    pollingInterval: 30000 // Every 30 seconds: call API again → update UI automatically
  });

  const isClosed = storeStatus?.isClosed ?? false;
  const reason = storeStatus?.reason ?? "";

  // RESET LOGIC: Clears filters when switching between Home and Browse
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // Only reset if moving between these specific paths to avoid "ghosting"
    if (location.pathname === '/' || location.pathname === '/browse') {
      setSelectedParentId(null);
      setSelectedSubId(null);
      setSearchQuery('');
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleMilestone = async () => {
      if (items.length === 0) {
        setWasFree(false);
        setShowFreeToast(false);
        return;
      }
      const data = await getCartCalculation(items);
      if (data.isFreeDelivery) {
        if (!wasFree) {
          const duration = 3 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
          const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 }, colors: ['#4b6f9e', '#22c55e', '#ffffff'] });
          }, 250);
          setWasFree(true);
        }
        setShowFreeToast(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setShowFreeToast(false), 5000);
      } else {
        setWasFree(false);
        setShowFreeToast(false);
      }
    };
    handleMilestone();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [items, wasFree]);

  // UPDATED FILTERING FOR NESTED CATEGORIES
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedSubId
        ? String(p.subCategoryId) === String(selectedSubId)
        : selectedParentId
          ? String(p.parentCategoryId) === String(selectedParentId)
          : true;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedParentId, selectedSubId, products]);

  // Reset to page 1 whenever filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedParentId, selectedSubId]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const handleBack = () => {
    setSearchQuery('');
    setSelectedParentId(null);
    setSelectedSubId(null);
    navigate('/');
  };

  const isBrowseMode = location.pathname === '/browse';
  const isCheckoutFlow = ['/checkout', '/addresses', '/success'].includes(location.pathname);

  const handleProceed = () => {
    setIsCartOpen(false);
    if (!isAuthenticated) {
      setIsLoginOpen(true);
    } else {
      navigate('/addresses');
    }
  };

  useEffect(() => {
    if (location.pathname === '/checkout' && !selectedAddress) {
      navigate('/addresses', { replace: true });
    }
    const protectedRoutes = ['/checkout', '/addresses'];
    if (protectedRoutes.includes(location.pathname) && items.length === 0) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, selectedAddress, items.length, navigate]);



  // {12 HOUR FOMAT}
  const formatTime = (time?: string) => {
    if (!time) return "";

    const [h, m] = time.split(":").map(Number);

    const hour = h % 12 || 12;
    const ampm = h >= 12 ? "PM" : "AM";

    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans">

      {isClosed && (
        <div className="fixed inset-0 bg-gradient-to-br from-black/70 to-black/50 backdrop-blur-md z-[9999] flex items-center justify-center px-4">

          <div className="bg-white p-8 rounded-3xl text-center max-w-md w-full shadow-2xl transform animate-fadeIn">

            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-black mb-3 text-gray-900">
              Store Closed
            </h2>

            {/* Reason */}
            <p className="text-base text-gray-600 mb-6 leading-relaxed">
              {reason || "We are currently not accepting orders"}
            </p>

            {/* TIME BASED */}
            {storeStatus?.type === "TIME" && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-700">
                  🕒 Closed Daily
                </p>
                <p className="text-sm text-red-600 mt-1">
                  {formatTime(storeStatus.startTime)} - {formatTime(storeStatus.endTime)}
                </p>
              </div>
            )}

            {/* DATE BASED */}
           {storeStatus?.type === "DATE" && (
  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
    <p className="text-sm font-semibold text-red-700">
      📅 Occasion Closure
    </p>

    <p className="text-sm text-red-600 mt-1">
      {storeStatus.startDate} to {storeStatus.endDate}
    </p>

    {storeStatus.startTime && storeStatus.endTime && (
      <p className="text-sm text-red-600 mt-1">
        {formatTime(storeStatus.startTime)} - {formatTime(storeStatus.endTime)}
      </p>
    )}
  </div>
)}

            {/* Optional: Contact Info */}
            <p className="text-xs text-gray-500 mt-6">
              Please check back later or contact us for more information
            </p>

          </div>

        </div>
      )}

      {/* Add to your global CSS or style tag */}
      <style>{`
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
`}</style>

      <Header
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          if (val && location.pathname !== '/browse') navigate('/browse');
        }}
        onCartClick={() => setIsCartOpen(true)}
        onLoginClick={() => setIsLoginOpen(true)}
      />

      <div className="flex-grow flex max-w-7xl mx-auto w-full min-h-[calc(100vh-80px)]">
        {isBrowseMode && (
          <CategorySidebar
            selectedParentId={selectedParentId}
            selectedSubId={selectedSubId}
            onSelectParent={setSelectedParentId}
            onSelectSub={setSelectedSubId}
          />
        )}

        <main className="flex-1 px-4 py-6 overflow-hidden">
          <Routes>
            <Route path="/" element={
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <PromoBanners />
                <LeafBanner />
                <CategoryStrip
                  selectedId={selectedParentId}
                  selectedSubId={selectedSubId}
                  onSelect={setSelectedParentId}
                  onSelectSub={setSelectedSubId}
                  onSeeAll={() => {
                    setSelectedParentId(null);
                    setSelectedSubId(null);
                    navigate('/browse');
                  }}
                />
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-8 w-1.5 bg-[#4b6f9e] rounded-full"></div>
                  <h3 className="font-black text-xl tracking-tight uppercase text-slate-800">
                    {selectedSubId || selectedParentId ? 'Filtered Products' : 'Trending Now'}
                  </h3>
                  {filteredProducts.length > 0 && (
                    <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                      {filteredProducts.length} Products
                    </span>
                  )}
                </div>

                {/* Inline search bar */}
                <div className="relative mb-5 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search products…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 placeholder:text-slate-300 outline-none focus:border-[#4b6f9e]/40 bg-white shadow-sm transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <ProductGrid products={paginatedProducts} />
                <Pagination
                  totalItems={filteredProducts.length}
                  pageSize={pageSize}
                  currentPage={safePage}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                />
              </div>
            } />

            <Route path="/browse" element={
              <div className="animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                  <button onClick={handleBack} className="group flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 text-[#4b6f9e] font-black text-xs uppercase tracking-widest hover:bg-[#4b6f9e] hover:text-white transition-all shadow-sm">
                    <ChevronRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" /> Back
                  </button>

                  {/* Search bar */}
                  <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search products…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 placeholder:text-slate-300 outline-none focus:border-[#4b6f9e]/40 bg-white shadow-sm transition-colors"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {filteredProducts.length > 0 && (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full whitespace-nowrap">
                      {filteredProducts.length} Results
                    </p>
                  )}
                </div>
                <ProductGrid products={paginatedProducts} />
                <Pagination
                  totalItems={filteredProducts.length}
                  pageSize={pageSize}
                  currentPage={safePage}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                />
              </div>
            } />

            <Route path="/product/:productId" element={<ProductDetail />} />
            <Route path="/addresses" element={<Addresses items={items} onSelect={(addr: any) => setSelectedAddress(addr)} />} />
            <Route path="/checkout" element={<Checkout address={selectedAddress} />} />
            <Route path="/success" element={<OrderSuccess />} />
            <Route
              path="/orders"
              element={<Orders openCart={() => setIsCartOpen(true)} />}
            />
            <Route path="/about" element={<LegalPage />} />
            <Route path="/contact" element={<LegalPage />} />
            <Route path="/faqs" element={<LegalPage />} />
            <Route path="/privacy" element={<LegalPage />} />
            <Route path="/terms" element={<LegalPage />} />
            <Route path="/refund" element={<LegalPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <FreeDeliveryToast show={showFreeToast} onClick={() => { setIsCartOpen(true); setShowFreeToast(false); }} />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceed={handleProceed}
      />

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {!isCheckoutFlow && (
        <Footer onCategoryClick={(id) => {
          setSelectedParentId(id);
          setSelectedSubId(null);
          setSearchQuery('');
          navigate('/browse');
        }} />
      )}
    </div>
  );
};

export default App;