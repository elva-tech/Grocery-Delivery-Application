import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import Header from './components/layout/Header';
import StoreClosingSoonBanner from './components/layout/StoreClosingSoonBanner';
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
import {
  useGetProductsQuery,
  useGetStoreStatusQuery,
  invalidateProductsCache,
  apiSlice,
} from './api/apiSlice';
import type { RootState } from './store/store';
import { getTenantId } from './utils/getTenantId';
import { clearCart } from './store/slices/cartSlice';
import { AlertCircle, ChevronRight, Loader2, Search, X } from 'lucide-react';
import Pagination from './components/ui/Pagination';
import confetti from 'canvas-confetti';
import Footer from './components/layout/Footer';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Account from './pages/Account';
import SavedAddresses from './pages/SavedAddresses';
import LegalPage from './pages/LegalPage';
import ContactUs from './pages/ContactUs';
import { WEB_COPY, customerFacingDeliveryUnavailable } from './constants/copy';
import { requestPrecisePosition } from './utils/geolocation';
import {
  checkDeliveryEligibility,
  WEBSITE_DELIVERY_COORDS_CHANGED,
  type DeliveryEligibilityResponse,
} from './api/deliveryEligibilityApi';
import { geocodeApproxFromIndianPincode, isValidIndianPincode, sanitizeIndianPincode } from './utils/indiaPincode';
import { parseAddressLatLng } from './utils/coordinates';

const TENANT_SCOPE_KEY = 'website_cart_tenant_scope';

function DeliveryEligibilityAlerts(props: {
  deliveryEligibility: {
    checking: boolean;
    eligible: boolean | null;
    message: string;
  };
}) {
  const { checking, eligible, message } = props.deliveryEligibility;

  if (checking) {
    return (
      <div className="mb-5 p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-[#4b6f9e] animate-spin shrink-0" />
        <p className="text-xs font-bold text-slate-600">Checking delivery availability for your location…</p>
      </div>
    );
  }

  if (eligible === false) {
    return (
      <div className="mb-5 p-4 rounded-2xl border border-red-200 bg-red-50">
        <p className="text-xs font-black uppercase tracking-widest text-red-600">{WEB_COPY.delivery.bannerTitle}</p>
        <p className="text-sm font-semibold text-red-700 mt-1">{customerFacingDeliveryUnavailable(message)}</p>
      </div>
    );
  }

  if (eligible === null && message) {
    return (
      <div className="mb-5 p-4 rounded-2xl border border-amber-200 bg-amber-50">
        <p className="text-xs font-black uppercase tracking-widest text-amber-800">Delivery check unavailable</p>
        <p className="text-sm font-semibold text-amber-900 mt-1">{message}</p>
        <p className="text-[10px] font-bold text-amber-700/80 mt-2">
          Tip: In dev, Map Service uses same-origin{' '}
          <span className="font-mono">/map-service-remote</span> (Vite → Render), then{' '}
          <span className="font-mono">/map-service</span> → localhost:3000. Production needs{' '}
          <span className="font-mono">VITE_MAP_SERVICE_BASE_URL</span> to a backend proxy if Render still has no CORS.
        </p>
      </div>
    );
  }

  return null;
}

const App = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  // UPDATED STATES FOR NESTED CATEGORIES
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const [selectedAddress, setSelectedAddress] = useState<any>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('user_addresses') || '[]');
      return saved[0] || null;
    } catch { return null; }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showFreeToast, setShowFreeToast] = useState(false);
  const [wasFree, setWasFree] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [deliveryEligibility, setDeliveryEligibility] = useState<{
    checking: boolean;
    eligible: boolean | null;
    message: string;
    details: DeliveryEligibilityResponse | null;
  }>({
    checking: false,
    eligible: null,
    message: '',
    details: null,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const {
    data: products = [],
    isLoading: isProductsLoading,
    isFetching: isProductsFetching,
    isError: isProductsError,
    refetch: refetchProducts,
  } = useGetProductsQuery(getTenantId());
  const { items } = useSelector((state: RootState) => state.cart);

  /** If tenant scope changes (env / host), cart + product cache must reset or checkout uses wrong product IDs. */
  useEffect(() => {
    const t = getTenantId();
    try {
      const prev = sessionStorage.getItem(TENANT_SCOPE_KEY);
      if (prev && prev !== t) {
        dispatch(clearCart());
        invalidateProductsCache();
        dispatch(apiSlice.util.resetApiState());
      }
      sessionStorage.setItem(TENANT_SCOPE_KEY, t);
    } catch {
      /* private mode */
    }
  }, [dispatch]);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const timerRef = useRef<any>(null);


  const { data: storeStatus } = useGetStoreStatusQuery(undefined, {
    pollingInterval: 30000 // Every 30 seconds: call API again → update UI automatically
  });

  const isClosed = storeStatus?.isClosed ?? false;
  const reason = storeStatus?.reason ?? "";
  const showClosingSoon =
    !isClosed &&
    Boolean(storeStatus?.closingSoon) &&
    (storeStatus?.minutesUntilClose ?? 0) > 0;

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

  const applyDeliveryAddress = useCallback((addr: Record<string, unknown>) => {
    setSelectedAddress(addr);
    try {
      const raw = localStorage.getItem('user_addresses');
      const parsed = JSON.parse(raw || '[]');
      const list = Array.isArray(parsed) ? parsed : [];
      const id = addr.id != null ? String(addr.id) : '';
      const rest = id ? list.filter((a: any) => a && String(a?.id) !== id) : [...list];
      rest.unshift(addr);
      localStorage.setItem('user_addresses', JSON.stringify(rest.slice(0, 30)));
    } catch {
      try {
        localStorage.setItem('user_addresses', JSON.stringify([addr]));
      } catch {
        /* private mode */
      }
    }
    const pin = parseAddressLatLng(addr as { lat?: unknown; lng?: unknown });
    if (pin) {
      window.dispatchEvent(
        new CustomEvent(WEBSITE_DELIVERY_COORDS_CHANGED, {
          detail: { lat: pin.lat, lng: pin.lng },
        }),
      );
    }
  }, []);

  const runDeliveryCheck = useCallback(async (lat: number, lng: number) => {
    setDeliveryEligibility((prev) => ({ ...prev, checking: true, message: '', details: null }));
    try {
      const result = await checkDeliveryEligibility(lat, lng);
      const raw = result as unknown as Record<string, unknown>;
      const eligible =
        typeof raw.isEligible === 'boolean'
          ? raw.isEligible
          : typeof raw.eligible === 'boolean'
            ? raw.eligible
            : false;
      setDeliveryEligibility({
        checking: false,
        eligible,
        message: result.message || '',
        details: result,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to verify delivery availability';
      setDeliveryEligibility({
        checking: false,
        eligible: null,
        message: msg,
        details: null,
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runCheck = (lat: number, lng: number) => {
      if (cancelled) return;
      void runDeliveryCheck(lat, lng);
    };

    const addrPin = parseAddressLatLng(
      selectedAddress as { lat?: unknown; lng?: unknown } | null | undefined,
    );

    if (addrPin) {
      void runCheck(addrPin.lat, addrPin.lng);
      return () => {
        cancelled = true;
      };
    }

    const pinRaw =
      selectedAddress && typeof selectedAddress === 'object'
        ? sanitizeIndianPincode(String((selectedAddress as { pincode?: string }).pincode || ''))
        : '';

    if (selectedAddress && isValidIndianPincode(pinRaw)) {
      setDeliveryEligibility((prev) => ({ ...prev, checking: true, message: '', details: null }));
      void (async () => {
        try {
          const coords = await geocodeApproxFromIndianPincode(pinRaw);
          if (cancelled) return;
          if (!coords) {
            setDeliveryEligibility({
              checking: false,
              eligible: null,
              message:
                'Could not locate this PIN for delivery check. Try another PIN or use an address saved with a map pin.',
              details: null,
            });
            return;
          }
          void runCheck(coords.lat, coords.lng);
        } catch {
          if (cancelled) return;
          setDeliveryEligibility({
            checking: false,
            eligible: null,
            message: 'Could not verify delivery for this PIN.',
            details: null,
          });
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (!navigator.geolocation) {
      setDeliveryEligibility({
        checking: false,
        eligible: null,
        message: 'Enable location access to check delivery availability',
        details: null,
      });
      return () => {
        cancelled = true;
      };
    }

    setDeliveryEligibility((prev) => ({ ...prev, checking: true, message: '' }));
    void (async () => {
      try {
        const { lat, lng } = await requestPrecisePosition({ highAccuracyTimeoutMs: 20000 });
        if (cancelled) return;
        void runCheck(lat, lng);
      } catch (err: unknown) {
        if (cancelled) return;
        const geo = err as GeolocationPositionError | undefined;
        const msg =
          geo && geo.code === 1
            ? 'Location permission denied — allow access to check delivery for your area.'
            : 'Could not detect your location — allow access or choose a saved address.';
        setDeliveryEligibility({
          checking: false,
          eligible: null,
          message: msg,
          details: null,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedAddress, runDeliveryCheck]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ lat?: number; lng?: number }>;
      const lat = e.detail?.lat;
      const lng = e.detail?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      void runDeliveryCheck(lat, lng);
    };
    window.addEventListener(WEBSITE_DELIVERY_COORDS_CHANGED, handler);
    return () => window.removeEventListener(WEBSITE_DELIVERY_COORDS_CHANGED, handler);
  }, [runDeliveryCheck]);

  useEffect(() => {
    if (location.pathname === '/checkout' && !selectedAddress) {
      navigate('/addresses', { replace: true });
    }
    const protectedRoutes = ['/checkout', '/addresses'];
    if (protectedRoutes.includes(location.pathname) && items.length === 0) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, selectedAddress, items.length, navigate]);
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

            {storeStatus?.nextChange && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-700">
                  Next update
                </p>
                <p className="text-sm text-red-600 mt-1">
                  {storeStatus.nextChange}
                </p>
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
        selectedDeliveryAddress={selectedAddress}
        onSelectDeliveryAddress={applyDeliveryAddress}
      />

      {showClosingSoon && storeStatus?.minutesUntilClose != null && (
        <StoreClosingSoonBanner
          minutesUntilClose={storeStatus.minutesUntilClose}
          closesAt={storeStatus.closesAt}
        />
      )}

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
                <DeliveryEligibilityAlerts deliveryEligibility={deliveryEligibility} />
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

                {isProductsLoading || (isProductsFetching && products.length === 0) ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-[#4b6f9e] animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Loading products...
                    </p>
                  </div>
                ) : isProductsError ? (
                  <div className="py-16 px-4">
                    <div className="max-w-xl mx-auto bg-red-50 border border-red-100 rounded-2xl p-5 flex items-start gap-3">
                      <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-red-700">
                          We could not load products right now.
                        </p>
                        <button
                          onClick={() => refetchProducts()}
                          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <ProductGrid products={paginatedProducts} />
                    <Pagination
                      totalItems={filteredProducts.length}
                      pageSize={pageSize}
                      currentPage={safePage}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                    />
                  </>
                )}
              </div>
            } />

            <Route path="/browse" element={
              <div className="animate-in fade-in duration-500">
                <DeliveryEligibilityAlerts deliveryEligibility={deliveryEligibility} />
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
                {isProductsLoading || (isProductsFetching && products.length === 0) ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-[#4b6f9e] animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Loading products...
                    </p>
                  </div>
                ) : isProductsError ? (
                  <div className="py-16 px-4">
                    <div className="max-w-xl mx-auto bg-red-50 border border-red-100 rounded-2xl p-5 flex items-start gap-3">
                      <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-red-700">
                          We could not load products right now.
                        </p>
                        <button
                          onClick={() => refetchProducts()}
                          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <ProductGrid products={paginatedProducts} />
                    <Pagination
                      totalItems={filteredProducts.length}
                      pageSize={pageSize}
                      currentPage={safePage}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                    />
                  </>
                )}
              </div>
            } />

            <Route path="/product/:productId" element={<ProductDetail />} />
            <Route
              path="/addresses"
              element={<Addresses items={items} onSelect={(addr: any) => applyDeliveryAddress(addr)} />}
            />
            <Route
              path="/checkout"
              element={<Checkout address={selectedAddress} deliveryEligibility={deliveryEligibility} />}
            />
            <Route path="/success" element={<OrderSuccess />} />
            <Route
              path="/orders"
              element={<Orders openCart={() => setIsCartOpen(true)} />}
            />
            <Route
              path="/profile"
              element={
                <Profile
                  openCart={() => setIsCartOpen(true)}
                  onLogin={() => setIsLoginOpen(true)}
                />
              }
            />
            <Route
              path="/account"
              element={<Account onLogin={() => setIsLoginOpen(true)} />}
            />
            <Route
              path="/saved-addresses"
              element={<SavedAddresses onLogin={() => setIsLoginOpen(true)} />}
            />
            <Route path="/about" element={<LegalPage />} />
            <Route path="/contact" element={<ContactUs />} />
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