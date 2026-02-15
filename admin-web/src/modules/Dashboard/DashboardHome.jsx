import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../context/AppStateContext';
import StatCard from '../../components/shared/StatCard';
import { 
  ShoppingBag, 
  IndianRupee, 
  AlertCircle, 
  Truck, 
  TrendingUp, 
  CheckCircle2,
  XCircle,
  Clock 
} from 'lucide-react';
import { APP_CONFIG } from '../../config/appConfig';

const DashboardHome = () => {
  const { products, orders } = useAppState();
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState('7days');

  const graphData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const labels = {
      yesterday: ['00:00', '06:00', '12:00', '18:00', '21:00'],
      '7days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      month: ['Day 1-7', 'Day 8-14', 'Day 15-21', 'Day 22+']
    };
    const currentLabels = labels[timeFilter] || labels['7days'];

    return currentLabels.map((label, index) => {
      const revenue = orders.reduce((acc, order) => {
        if (order.status?.toUpperCase() === 'CANCELLED') return acc;
        const orderDate = new Date(order.date);
        const oMonth = orderDate.getMonth();
        const oYear = orderDate.getFullYear();
        const oDate = orderDate.getDate();

        if (timeFilter === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);
          if (orderDate.toDateString() !== yesterday.toDateString()) return acc;
          const hour = orderDate.getHours();
          const labelHour = parseInt(label.split(':')[0]);
          if (hour >= labelHour && hour < labelHour + 6) return acc + (order.totalAmount || order.total || 0);
        }

        if (timeFilter === '7days') {
          const dayIndex = orderDate.getDay() === 0 ? 6 : orderDate.getDay() - 1;
          if (dayIndex === index) {
            const diffTime = Math.abs(now - orderDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) return acc + (order.totalAmount || order.total || 0);
          }
        }

        if (timeFilter === 'month') {
          if (oMonth === currentMonth && oYear === currentYear) {
            if (index === 0 && oDate <= 7) return acc + (order.totalAmount || order.total || 0);
            if (index === 1 && oDate > 7 && oDate <= 14) return acc + (order.totalAmount || order.total || 0);
            if (index === 2 && oDate > 14 && oDate <= 21) return acc + (order.totalAmount || order.total || 0);
            if (index === 3 && oDate > 21) return acc + (order.totalAmount || order.total || 0);
          }
        }
        return acc;
      }, 0);

      return { label, amount: revenue, displayAmount: revenue };
    });
  }, [orders, timeFilter]);

  const maxAmount = Math.max(...graphData.map(d => d.amount), 1000);

  // INVENTORY CALCULATIONS
  const lowStockThreshold = APP_CONFIG?.settings?.lowStockThreshold || 10;
  const lowStockItems = products.filter(p => p.stock < lowStockThreshold);
  const inventoryValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
  const stockOutCount = products.filter(p => p.stock === 0).length;

  // REVENUE
  const totalRevenue = orders
    .filter(o => o.status?.toUpperCase() !== 'CANCELLED')
    .reduce((acc, curr) => acc + (curr.totalAmount || curr.total || 0), 0);
  
  // FIXED STATUS MATCHING (Case Insensitive)
  const pendingActionsCount = orders.filter(o => 
    ['PLACED', 'CONFIRMED'].includes(o.status?.toUpperCase())
  ).length;

  const activeOrdersCount = orders.filter(o => 
    ['CONFIRMED', 'OUT_FOR_DELIVERY'].includes(o.status?.toUpperCase())
  ).length;
  
  const [lastUpdated] = useState(new Date().toLocaleTimeString('en-IN', { 
    hour: '2-digit', minute: '2-digit', hour12: true 
  }));

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div onClick={() => navigate('/reports')} className="cursor-pointer">
          <StatCard title="Net Revenue" value={`₹${totalRevenue.toLocaleString('en-IN')}`} icon={<IndianRupee />} color="emerald" />
        </div>
        <div onClick={() => navigate('/products')} className="cursor-pointer">
          <StatCard title="Stock Value" value={`₹${inventoryValue.toLocaleString('en-IN')}`} icon={<ShoppingBag />} color="blue" />
        </div>
        <div onClick={() => navigate('/orders')} className="cursor-pointer">
          <StatCard title="Pending Status" value={pendingActionsCount} icon={<Clock />} color="amber" />
        </div>
        <div onClick={() => navigate('/orders')} className="cursor-pointer">
          <StatCard title="Active Orders" value={activeOrdersCount} icon={<Truck />} color="purple" />
        </div>
        <div onClick={() => navigate('/products')} className="cursor-pointer">
          <StatCard title="Stock-Outs" value={stockOutCount} icon={<XCircle />} color="red" />
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
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="month">This Month</option>
          </select>
        </div>
        
        <div className="h-64 relative flex items-end w-full">
            <svg className="absolute inset-0 w-full h-full px-12 pb-14" preserveAspectRatio="none" viewBox="0 0 700 200">
                <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path 
                    d={`M ${graphData.map((d, i) => `${(i * (700 / (graphData.length - 1)))},${200 - (d.displayAmount / maxAmount * 150)}`).join(' L ')} L 700,200 L 0,200 Z`}
                    fill="url(#areaGradient)"
                    className="transition-all duration-700 ease-in-out"
                />
                <path 
                    d={`M ${graphData.map((d, i) => `${(i * (700 / (graphData.length - 1)))},${200 - (d.displayAmount / maxAmount * 150)}`).join(' L ')}`}
                    fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round"
                    className="transition-all duration-700 ease-in-out"
                />
            </svg>

            <div className="flex justify-between w-full relative z-10 px-2">
                {graphData.map((data, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 group relative">
                        {data.amount > 0 && (
                          <div className="absolute -top-12 scale-0 group-hover:scale-100 transition-transform bg-slate-800 text-white text-[10px] py-1 px-2 rounded font-bold z-20">
                              ₹{data.amount.toLocaleString('en-IN')}
                          </div>
                        )}
                        <div 
                           style={{ marginBottom: `${(data.displayAmount / maxAmount * 150) - 8}px` }}
                           className={`w-3 h-3 rounded-full border-2 border-white shadow-md transition-all duration-500
                            ${data.amount > 0 ? 'bg-emerald-500 scale-125' : 'bg-slate-200'}
                            `}
                        />
                        <span className="text-[10px] text-gray-400 font-bold mt-4 uppercase">
                            {data.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
      </div>

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