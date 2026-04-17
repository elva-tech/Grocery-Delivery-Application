import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../../components/shared/StatCard';
import TopProductsSection from './TopProductsSection';
import DailySalesChart from './DailySalesChart';
import RatingSummaryCard from './RatingSummaryCard';
import PlanUsageCard from './PlanUsageCard';
import { 
  ShoppingBag, 
  IndianRupee, 
  AlertCircle, 
  Truck, 
  TrendingUp, 
  CheckCircle2,
  XCircle,
  Clock,
  Loader 
} from 'lucide-react';
import { APP_CONFIG } from '../../config/appConfig';
import dashboardService from '../../services/dashboardApi';
import { apiService } from '../../services/apiService';

const DashboardHome = () => {
  const navigate = useNavigate();
  
  // State management
  const [dashboardMetrics, setDashboardMetrics] = useState({
    netRevenue: 0,
    stockValue: 0,
    pendingOrders: 0,
    activeOrders: 0,
  });
  
  const [revenueData, setRevenueData] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeFilter, setTimeFilter] = useState('7');

  // Analytics state
  const [topProducts, setTopProducts] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [ratingsSummary, setRatingsSummary] = useState(null);
  const [analyticsFilter, setAnalyticsFilter] = useState('30');
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Billing state
  const [billingData, setBillingData] = useState({ subscription: null, usage: null, invoice: null });
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState(null);
  
  const [lastUpdated, setLastUpdated] = useState(
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  );

  // ============================================
  // FETCH DASHBOARD DATA ON MOUNT
  // ============================================
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch all data in parallel
        const [activeOrdersRes, pendingOrdersRes, revenueRes, productsRes] = await Promise.all([
          dashboardService.getActiveOrders(),
          dashboardService.getPendingOrders(),
          dashboardService.getRevenue(parseInt(timeFilter)),
          dashboardService.getProducts(),
        ]);

        console.log('Active Orders Response:', activeOrdersRes);
        console.log('Pending Orders Response:', pendingOrdersRes);
        console.log('Revenue Response:', revenueRes);
        console.log('Products Response:', productsRes);

        // Process metrics
        const activeCount = activeOrdersRes.activeOrders || 0;
        const pendingCount = pendingOrdersRes.pendingOrders || 0;
        const totalRevenue = revenueRes.totalRevenue || 0;
        
        // Products - backend returns { success: true, products: [...] }
        let productsArray = [];
        if (Array.isArray(productsRes.products)) {
          productsArray = productsRes.products;
        } else if (Array.isArray(productsRes.data)) {
          productsArray = productsRes.data;
        } else if (Array.isArray(productsRes)) {
          productsArray = productsRes;
        }
        
        console.log('Processed Products Array:', productsArray);
        
        // Calculate stock value using availableQty (not stock)
        const stockValue = productsArray.reduce((acc, product) => {
          const qty = product.availableQty || product.stock || 0;
          const price = product.price || 0;
          const value = price * qty;
          console.log(`Product: ${product.name}, Price: ${price}, Qty: ${qty}, Value: ${value}`);
          return acc + value;
        }, 0);
        
        console.log('Total Stock Value:', stockValue);

        setDashboardMetrics({
          netRevenue: totalRevenue,
          stockValue: stockValue,
          pendingOrders: pendingCount,
          activeOrders: activeCount,
        });

        // Process revenue data for graph
        // Backend returns { success: true, days, totalRevenue, dailyRevenue }
        const revenueChartData = revenueRes.dailyRevenue || revenueRes.data || [];
        setRevenueData(revenueChartData);
        setProducts(productsArray);
        
        setLastUpdated(
          new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        );
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeFilter]);

  // ============================================
  // FETCH ANALYTICS DATA
  // ============================================
  useEffect(() => {
    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      // Fetch independently so one failure doesn't blank the other
      const [topResult, dailyResult, ratingsResult] = await Promise.allSettled([
        dashboardService.getTopProducts(5),
        dashboardService.getDailySales(parseInt(analyticsFilter)),
        dashboardService.getRatingsSummary(),
      ]);

      if (topResult.status === 'fulfilled') {
        setTopProducts(topResult.value?.data || []);
      } else {
        console.error('Top products fetch failed:', topResult.reason);
      }

      if (dailyResult.status === 'fulfilled') {
        setDailySales(dailyResult.value?.data || []);
      } else {
        console.error('Daily sales fetch failed:', dailyResult.reason);
      }

      if (ratingsResult.status === 'fulfilled') {
        setRatingsSummary(ratingsResult.value?.data || null);
      } else {
        console.error('Ratings summary fetch failed:', ratingsResult.reason);
      }

      setAnalyticsLoading(false);
    };

    fetchAnalytics();
  }, [analyticsFilter]);

  // ============================================
  // FETCH BILLING DATA
  // ============================================
  useEffect(() => {
    const fetchBilling = async () => {
      setBillingLoading(true);
      setBillingError(null);
      try {
        const [subRes, usageRes, invoiceRes] = await Promise.all([
          apiService.getSubscription(),
          apiService.getUsage(),
          apiService.getCurrentInvoice(),
        ]);
        setBillingData({
          subscription: subRes.data  || null,
          usage:        usageRes.data  || null,
          invoice:      invoiceRes.data || null,
        });
      } catch (err) {
        console.error('Billing fetch error:', err);
        setBillingError('Could not load billing data');
      } finally {
        setBillingLoading(false);
      }
    };
    fetchBilling();
  }, []);


  // ============================================
  // INVENTORY CALCULATIONS
  // ============================================
  const lowStockThreshold = APP_CONFIG?.settings?.lowStockThreshold || 10;
  const lowStockItems = products.filter(p => p.stock < lowStockThreshold);
  const stockOutCount = products.filter(p => p.stock === 0).length;

  // ============================================
  // PROCESS GRAPH DATA
  // ============================================
  const graphData = useMemo(() => {
    if (!revenueData || revenueData.length === 0) {
      return [];
    }

    // Handle different data formats from API
    const processedData = Array.isArray(revenueData)
      ? revenueData.map(item => ({
          label: item.date || item.label || '',
          amount: item.revenue || item.amount || 0,
          displayAmount: item.revenue || item.amount || 0,
        }))
      : [];

    return processedData;
  }, [revenueData]);

  // Calculate max amount for scaling, with minimum of 1000 to ensure visible scaling
  const maxAmount = graphData.length > 0 
    ? Math.max(...graphData.map(d => d.amount), 1000)
    : 1000;

  // ============================================
  // RENDER LOADING STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
          <p className="text-slate-600 font-semibold">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-[#1A4D2E]">System Overview</h1>
          <p className="text-slate-500 font-medium italic flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Time: {lastUpdated}
          </p>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <p className="text-red-700 font-semibold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div onClick={() => navigate('/reports')} className="cursor-pointer">
          <StatCard title="Net Revenue" value={`₹${dashboardMetrics.netRevenue.toLocaleString('en-IN')}`} icon={<IndianRupee />} color="emerald" />
        </div>
        <div onClick={() => navigate('/products')} className="cursor-pointer">
          <StatCard title="Stock Value" value={`₹${dashboardMetrics.stockValue.toLocaleString('en-IN')}`} icon={<ShoppingBag />} color="blue" />
        </div>
        <div onClick={() => navigate('/orders')} className="cursor-pointer">
          <StatCard title="Pending Status" value={dashboardMetrics.pendingOrders} icon={<Clock />} color="amber" />
        </div>
        <div onClick={() => navigate('/orders')} className="cursor-pointer">
          <StatCard title="Active Orders" value={dashboardMetrics.activeOrders} icon={<Truck />} color="purple" />
        </div>
      </div>

      <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden w-full">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-500" /> Revenue Flow
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Financial Performance</p>
          </div>
          <select 
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none cursor-pointer"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>
        
        {graphData && graphData.length > 0 ? (
          <div className="h-64 relative flex items-end w-full">
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 700 200" style={{ padding: '0 48px 56px 0' }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                // Calculate x positions safely
                const xPositions = graphData.map((d, i) => {
                  if (graphData.length === 1) {
                    return 350; // Center for single point
                  }
                  return (i / (graphData.length - 1)) * 700;
                });
                
                // Calculate y positions
                const points = graphData.map((d, i) => ({
                  x: xPositions[i],
                  y: 200 - (d.displayAmount / maxAmount * 150)
                }));
                
                // Create path string for area
                const areaPath = `M ${points.map((p, i) => `${p.x},${p.y}`).join(' L ')} L 700,200 L 0,200 Z`;
                
                // Create path string for line
                const linePath = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;
                
                return (
                  <>
                    <path 
                      d={areaPath}
                      fill="url(#areaGradient)"
                      className="transition-all duration-700 ease-in-out"
                    />
                    <path 
                      d={linePath}
                      fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                      className="transition-all duration-700 ease-in-out"
                    />
                  </>
                );
              })()}
            </svg>

            <div className="flex justify-between w-full relative z-10 px-2">
              {graphData.map((data, i) => (
                <div key={i} className="flex flex-col items-center flex-1 group relative">
                  {data.amount > 0 && (
                    <div className="absolute -top-12 scale-0 group-hover:scale-100 transition-transform bg-slate-800 text-white text-[10px] py-1 px-2 rounded font-bold z-20 whitespace-nowrap">
                      ₹{data.amount.toLocaleString('en-IN')}
                    </div>
                  )}
                  <div 
                    style={{ marginBottom: `${(data.displayAmount / maxAmount * 150) - 8}px` }}
                    className={`w-3 h-3 rounded-full border-2 border-white shadow-md transition-all duration-500 ${data.amount > 0 ? 'bg-emerald-500 scale-125' : 'bg-slate-200'}`}
                  />
                  <span className="text-[10px] text-gray-400 font-bold mt-4 uppercase">
                    {data.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-slate-500 font-semibold">No revenue data available for this period</p>
          </div>
        )}
      </div>

      {/* ── Analytics Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProductsSection data={topProducts} isLoading={analyticsLoading} />
        <DailySalesChart
          data={dailySales}
          isLoading={analyticsLoading}
          filter={analyticsFilter}
          onFilterChange={setAnalyticsFilter}
        />
      </div>

      {/* ── Ratings Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RatingSummaryCard data={ratingsSummary} isLoading={analyticsLoading} />
      </div>

      {/* ── Plan & Billing ───────────────────────────────────────── */}
      <PlanUsageCard
        subscription={billingData.subscription}
        usage={billingData.usage}
        invoice={billingData.invoice}
        loading={billingLoading}
        error={billingError}
      />

      <div className="bg-[#1A4D2E] p-8 rounded-[32px] text-white shadow-xl shadow-green-900/20 flex flex-col w-full">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="font-bold text-xl">Critical Inventory Alerts</h3>
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[2px]">Action Required</p>
          </div>
          <AlertCircle className={lowStockItems.length > 0 ? "text-red-400 animate-bounce" : "text-emerald-400"} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 flex-1">
          {lowStockItems.length > 0 ? (
            lowStockItems.slice(0, 6).map((p, i) => (
              <div key={i} className="space-y-2 group">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                  <span>{p.name}</span>
                  <span className="text-red-400">{p.stock} Units Left</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-400 rounded-full transition-all duration-700" 
                    style={{ width: `${(p.stock / lowStockThreshold) * 100}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-10 text-center bg-white/5 rounded-2xl border border-dashed border-white/20">
               <CheckCircle2 className="mx-auto mb-2 text-emerald-400" />
               <p className="text-sm font-bold text-emerald-100">All inventory levels are healthy!</p>
            </div>
          )}
        </div>

        <button 
          onClick={() => navigate('/products')}
          className="mt-10 w-full py-4 bg-white text-[#1A4D2E] hover:bg-emerald-50 rounded-2xl text-xs font-black transition-all uppercase tracking-widest shadow-lg"
        >
          Manage Full Inventory
        </button>
      </div>
    </div>
  );
};

export default DashboardHome;