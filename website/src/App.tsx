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
import { getCartCalculation } from './api/mockdata';
import { useGetProductsQuery } from './api/apiSlice';
import type { RootState } from './store/store';
import { ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import Footer from './components/layout/Footer';
import Orders from './pages/Orders';
import LegalPage from './pages/LegalPage';
import { useGetCategoriesQuery } from './api/apiSlice';

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showFreeToast, setShowFreeToast] = useState(false);
  const [wasFree, setWasFree] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false); 

  const { data: products = [] } = useGetProductsQuery();
  const { items } = useSelector((state: RootState) => state.cart);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth); 
  const timerRef = useRef<any>(null);
  const { data: categories = [] } = useGetCategoriesQuery();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (location.pathname === '/' || location.pathname === '/browse') {
      setSelectedParentId(null);
      setSelectedSubId(null);
      setSearchQuery('');
    }
  }, [location.pathname]);

 const filteredProducts = useMemo(() => {
  if (!products || products.length === 0) return [];

  return products.filter(p => {

    const matchesSearch = p.name
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());

    let matchesCategory = true;

    // ✅ SUBCATEGORY CLICK
    if (selectedSubId) {
      matchesCategory =
        String(p.subCategoryId) === String(selectedSubId);
    }

    // ✅ PARENT CATEGORY CLICK
    else if (selectedParentId) {
      matchesCategory =
        String(p.parentCategoryId) === String(selectedParentId);
    }

    return matchesSearch && matchesCategory;
  });

}, [searchQuery, selectedParentId, selectedSubId, products]);
  // ⭐⭐⭐⭐⭐ END FIX ⭐⭐⭐⭐⭐

  const handleBack = () => {
    setSearchQuery('');
    setSelectedParentId(null);
    setSelectedSubId(null);
    navigate('/');
  };

  const isBrowseMode = location.pathname === '/browse';
  const isCheckoutFlow = ['/checkout', '/addresses', '/success'].includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans">

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
              <div>
                <PromoBanners />
                <LeafBanner />
                <CategoryStrip
                  selectedId={selectedParentId}
                  selectedSubId={selectedSubId}
                  onSelect={setSelectedParentId}
                  onSelectSub={setSelectedSubId}
                  onSeeAll={() => navigate('/browse')}
                />

                <ProductGrid products={filteredProducts} />
              </div>
            } />

            <Route path="/browse" element={
              <ProductGrid products={filteredProducts} />
            } />

            <Route path="/product/:productId" element={<ProductDetail />} />

          </Routes>

        </main>
      </div>
    </div>
  );
};

export default App;